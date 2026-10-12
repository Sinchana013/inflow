from datetime import datetime
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import desc
from app.models.models import Product, InventoryMovement, BusinessActivity
from app.schemas.schemas import StockAdjustmentRequest, InventoryMovementResponse, InventoryAlertResponse

def adjust_product_stock(
    db: Session,
    product_id: int,
    adjustment: StockAdjustmentRequest
) -> Product:
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise ValueError(f"Product with ID {product_id} not found.")

    new_stock = product.stock_quantity + adjustment.quantity_change
    if new_stock < 0:
        raise ValueError(f"Invalid stock change: cannot reduce stock below zero (current: {product.stock_quantity}, change: {adjustment.quantity_change}).")

    # Update product
    product.stock_quantity = new_stock
    product.updated_at = datetime.utcnow()

    # Record movement
    movement = InventoryMovement(
        product_id=product.id,
        quantity_change=adjustment.quantity_change,
        movement_type=adjustment.movement_type,
        reason=adjustment.reason or "Stock level manual adjustment",
        created_at=datetime.utcnow()
    )
    db.add(movement)

    # Record business activity
    activity_desc = f"Stock for '{product.name}' adjusted by {adjustment.quantity_change:+d} ({adjustment.reason}). New stock: {new_stock}."
    db.add(BusinessActivity(
        activity_type="Stock Adjusted",
        entity_type="inventory",
        entity_id=product.id,
        description=activity_desc,
        created_at=datetime.utcnow()
    ))

    db.commit()
    db.refresh(product)
    return product

def get_product_movements(db: Session, product_id: int, limit: int = 50) -> List[InventoryMovementResponse]:
    movements = db.query(InventoryMovement).filter(
        InventoryMovement.product_id == product_id
    ).order_by(desc(InventoryMovement.created_at)).limit(limit).all()

    res = []
    for m in movements:
        res.append(InventoryMovementResponse(
            id=m.id,
            product_id=m.product_id,
            product_name=m.product.name if m.product else "",
            quantity_change=m.quantity_change,
            movement_type=m.movement_type,
            reason=m.reason,
            created_at=m.created_at
        ))
    return res

def get_inventory_alerts(db: Session) -> List[InventoryAlertResponse]:
    low_stock = db.query(Product).filter(
        Product.stock_quantity <= Product.reorder_threshold
    ).order_by(Product.stock_quantity.asc()).all()

    alerts = []
    for p in low_stock:
        st = "Out of Stock" if p.stock_quantity <= 0 else "Low Stock"
        urgency = "Critical" if p.stock_quantity <= 0 else ("Critical" if p.stock_quantity <= p.reorder_threshold / 2 else "Warning")
        alerts.append(InventoryAlertResponse(
            product_id=p.id,
            product_name=p.name,
            category=p.category,
            current_stock=p.stock_quantity,
            reorder_threshold=p.reorder_threshold,
            stock_status=st,
            urgency=urgency
        ))
    return alerts
