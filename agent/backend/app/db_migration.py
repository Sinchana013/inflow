import logging
from sqlalchemy import inspect, text

logger = logging.getLogger("app.db_migration")

def ensure_product_schema(engine):
    """
    Idempotent schema migration for products table:
    Ensures columns 'sku', 'barcode', 'description', 'supplier', 'image_url' exist.
    Assigns deterministic default SKUs to existing products without one.
    """
    try:
        inspector = inspect(engine)
        if not inspector.has_table("products"):
            return

        columns = {c["name"].lower() for c in inspector.get_columns("products")}

        with engine.begin() as conn:
            if "sku" not in columns:
                logger.info("Adding column 'sku' to products table")
                conn.execute(text("ALTER TABLE products ADD COLUMN sku VARCHAR(100)"))
            if "barcode" not in columns:
                logger.info("Adding column 'barcode' to products table")
                conn.execute(text("ALTER TABLE products ADD COLUMN barcode VARCHAR(100)"))
            if "description" not in columns:
                logger.info("Adding column 'description' to products table")
                conn.execute(text("ALTER TABLE products ADD COLUMN description TEXT"))
            if "supplier" not in columns:
                logger.info("Adding column 'supplier' to products table")
                conn.execute(text("ALTER TABLE products ADD COLUMN supplier VARCHAR(150)"))
            if "image_url" not in columns:
                logger.info("Adding column 'image_url' to products table")
                conn.execute(text("ALTER TABLE products ADD COLUMN image_url VARCHAR(500)"))

        # Populate SKUs for existing rows if null or blank
        with engine.begin() as conn:
            # Check if dialect is SQLite or Postgres
            dialect = engine.dialect.name
            if dialect == "sqlite":
                conn.execute(text("UPDATE products SET sku = 'SKU-' || substr('0000' || id, -4, 4) WHERE sku IS NULL OR sku = ''"))
            else:
                conn.execute(text("UPDATE products SET sku = 'SKU-' || LPAD(id::text, 4, '0') WHERE sku IS NULL OR sku = ''"))
                # Reset Postgres serial sequence to max(id)
                conn.execute(text("SELECT setval(pg_get_serial_sequence('products', 'id'), coalesce(max(id), 1)) FROM products;"))

        logger.info("Product schema verification and migration completed successfully.")
    except Exception as e:
        logger.warning("Schema migration notice (safe if already applied): %s", e)
