import re
import difflib
import logging
from typing import List, Dict, Any, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from fastapi import HTTPException
from app.models.models import Product, BusinessActivity, InventoryMovement
from app.schemas.schemas import (
    ProductCreate,
    ProductResponse,
    ExtractedProductItem,
    DuplicateCheckResult,
    ProductDuplicateCheckResponse,
    DocumentExtractResponse
)
from app.services.analytics_service import get_product_response

logger = logging.getLogger("app.product_creation_service")

# Supported image & document content types
ALLOWED_MIME_TYPES = {
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/webp",
    "image/gif",
    "application/pdf"
}

ALLOWED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".pdf"}

def normalize_text(text: Optional[str]) -> str:
    """Normalize text for safe attribute matching."""
    if not text:
        return ""
    # Lowercase, replace non-alphanumeric with spaces, collapse spaces
    cleaned = re.sub(r"[^a-zA-Z0-9\s]", " ", text.lower())
    return " ".join(cleaned.split())

def clean_identifier(val: Optional[str]) -> str:
    """Clean SKU or barcode (strip leading hashes, whitespace, quotes)."""
    if not val:
        return ""
    val = val.strip().strip("'\"")
    # If starts with '#' like '#123', remove '#'
    if val.startswith("#"):
        val = val[1:].strip()
    return val

def check_product_duplicates(db: Session, items: List[ExtractedProductItem]) -> List[DuplicateCheckResult]:
    """
    Evaluates existing database for matching products using strict priority:
    1. Exact SKU match
    2. Exact barcode match
    3. Other reliable identifiers (e.g. product id)
    4. Normalized product name and attributes
       - High similarity (0.82 <= ratio < 0.98) -> possible_duplicate
       - Identical normalized name -> already_exists
    5. Insufficient information -> insufficient_info
    6. No match -> new_product
    """
    results: List[DuplicateCheckResult] = []

    # Pre-fetch all products for efficient similarity comparison
    all_products = db.query(Product).all()

    for item in items:
        # Check for insufficient information
        clean_name = (item.name or "").strip()
        if not clean_name or len(clean_name) < 2:
            results.append(DuplicateCheckResult(
                status="insufficient_info",
                match_reason="Missing required product name or primary identifier.",
                item=item
            ))
            continue

        raw_sku = (item.sku or "").strip()
        cleaned_sku = clean_identifier(raw_sku)
        raw_barcode = (item.barcode or "").strip()
        cleaned_barcode = clean_identifier(raw_barcode)

        match_found = False

        # Priority 1: Exact SKU match
        if cleaned_sku:
            for p in all_products:
                p_sku = clean_identifier(getattr(p, "sku", None))
                if p_sku and (p_sku.lower() == cleaned_sku.lower() or p_sku.lower() == raw_sku.lower()):
                    p_resp = get_product_response(p).model_dump()
                    results.append(DuplicateCheckResult(
                        status="already_exists",
                        matched_product=p_resp,
                        match_reason=f"Exact SKU match found: '{p.name}' (SKU: {p.sku})",
                        similarity_score=1.0,
                        item=item
                    ))
                    match_found = True
                    break
        if match_found:
            continue

        # Priority 2: Exact barcode match
        if cleaned_barcode:
            for p in all_products:
                p_barcode = clean_identifier(getattr(p, "barcode", None))
                if p_barcode and p_barcode.lower() == cleaned_barcode.lower():
                    p_resp = get_product_response(p).model_dump()
                    results.append(DuplicateCheckResult(
                        status="already_exists",
                        matched_product=p_resp,
                        match_reason=f"Exact barcode match found: '{p.name}' (Barcode: {p.barcode})",
                        similarity_score=1.0,
                        item=item
                    ))
                    match_found = True
                    break
        if match_found:
            continue

        # Priority 3: Other reliable identifiers (e.g. ID match if provided)
        if item.id and str(item.id).isdigit():
            p_id = int(item.id)
            for p in all_products:
                if p.id == p_id:
                    p_resp = get_product_response(p).model_dump()
                    results.append(DuplicateCheckResult(
                        status="already_exists",
                        matched_product=p_resp,
                        match_reason=f"Exact product ID match found: ID {p.id} ('{p.name}')",
                        similarity_score=1.0,
                        item=item
                    ))
                    match_found = True
                    break
        if match_found:
            continue

        # Priority 4: Normalized product name and attributes
        norm_item_name = normalize_text(clean_name)
        exact_name_match: Optional[Product] = None
        best_candidate: Optional[Tuple[Product, float]] = None

        for p in all_products:
            norm_p_name = normalize_text(p.name)
            if norm_item_name == norm_p_name:
                exact_name_match = p
                break
            
            # String similarity ratio
            ratio = difflib.SequenceMatcher(None, norm_item_name, norm_p_name).ratio()
            if ratio >= 0.80:
                if best_candidate is None or ratio > best_candidate[1]:
                    best_candidate = (p, ratio)

        if exact_name_match:
            p_resp = get_product_response(exact_name_match).model_dump()
            results.append(DuplicateCheckResult(
                status="already_exists",
                matched_product=p_resp,
                match_reason=f"Identical product name found in catalog: '{exact_name_match.name}'",
                similarity_score=1.0,
                item=item
            ))
            continue

        if best_candidate and best_candidate[1] >= 0.82:
            cand_prod, cand_ratio = best_candidate
            p_resp = get_product_response(cand_prod).model_dump()
            results.append(DuplicateCheckResult(
                status="possible_duplicate",
                matched_product=p_resp,
                match_reason=(
                    f"Ambiguous match ({int(cand_ratio * 100)}% similarity) with existing product "
                    f"'{cand_prod.name}' (SKU: {cand_prod.sku or 'N/A'}). Please confirm if this is a variant or new product."
                ),
                similarity_score=round(cand_ratio, 2),
                item=item
            ))
            continue

        # Classification: New product
        results.append(DuplicateCheckResult(
            status="new_product",
            match_reason="No existing matching product found in catalog. Ready to add.",
            similarity_score=0.0,
            item=item
        ))

    return results

def create_product_record(db: Session, product_data: ProductCreate) -> ProductResponse:
    """
    Saves a product to the existing database with strict uniqueness and validation enforcement.
    """
    clean_name = product_data.name.strip()
    if not clean_name:
        raise HTTPException(status_code=422, detail="Product name cannot be empty.")

    if product_data.selling_price < 0:
        raise HTTPException(status_code=422, detail="Selling price must be non-negative.")

    if product_data.unit_cost < 0:
        raise HTTPException(status_code=422, detail="Unit cost must be non-negative.")

    if product_data.stock_quantity < 0:
        raise HTTPException(status_code=422, detail="Stock quantity must be non-negative.")

    clean_sku = clean_identifier(product_data.sku)
    clean_barcode = clean_identifier(product_data.barcode)

    # Enforce uniqueness for SKU if provided
    if clean_sku:
        existing_sku = db.query(Product).filter(
            func.lower(Product.sku) == clean_sku.lower()
        ).first()
        if existing_sku:
            raise HTTPException(
                status_code=409,
                detail=f"Duplicate product conflict: A product with SKU '{clean_sku}' already exists ({existing_sku.name})."
            )

    # Enforce uniqueness for Barcode if provided
    if clean_barcode:
        existing_barcode = db.query(Product).filter(
            Product.barcode == clean_barcode
        ).first()
        if existing_barcode:
            raise HTTPException(
                status_code=409,
                detail=f"Duplicate product conflict: A product with barcode '{clean_barcode}' already exists ({existing_barcode.name})."
            )

    # Auto-generate a unique SKU if not provided
    final_sku = clean_sku
    if not final_sku:
        # Find next available ID or use counter
        max_id = db.query(func.max(Product.id)).scalar() or 0
        candidate_sku = f"SKU-{max_id + 1:04d}"
        # Ensure candidate doesn't conflict
        while db.query(Product).filter(Product.sku == candidate_sku).first():
            max_id += 1
            candidate_sku = f"SKU-{max_id + 1:04d}"
        final_sku = candidate_sku

    new_product = Product(
        name=clean_name,
        category=product_data.category.strip() or "General",
        selling_price=float(product_data.selling_price),
        unit_cost=float(product_data.unit_cost),
        stock_quantity=int(product_data.stock_quantity),
        reorder_threshold=int(product_data.reorder_threshold),
        sku=final_sku,
        barcode=clean_barcode or None,
        description=product_data.description.strip() if product_data.description else None,
        supplier=product_data.supplier.strip() if product_data.supplier else None,
        image_url=product_data.image_url.strip() if product_data.image_url else None
    )

    db.add(new_product)
    db.flush()  # assign new_product.id

    # Log business activity
    activity = BusinessActivity(
        activity_type="product_created",
        entity_type="product",
        entity_id=new_product.id,
        description=f"Added new product '{new_product.name}' (SKU: {final_sku}) to catalog."
    )
    db.add(activity)

    # Record initial inventory movement if initial stock > 0
    if new_product.stock_quantity > 0:
        movement = InventoryMovement(
            product_id=new_product.id,
            quantity_change=new_product.stock_quantity,
            movement_type="Initial",
            reason="Initial product catalog creation"
        )
        db.add(movement)

    db.commit()
    db.refresh(new_product)

    return get_product_response(new_product)
