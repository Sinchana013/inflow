import random
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from app.database import Base, engine, SessionLocal
from app.models.models import Customer, Product, Order, OrderItem, InventoryMovement, BusinessActivity

def seed_database(db: Session, force: bool = False):
    # Ensure tables exist
    Base.metadata.create_all(bind=engine)

    # Check if already seeded
    existing_customers = db.query(Customer).count()
    if existing_customers > 0 and not force:
        print(f"Database already contains {existing_customers} customers. Skipping seed.")
        return

    if force:
        # Clear tables in reverse dependency order
        db.query(BusinessActivity).delete()
        db.query(InventoryMovement).delete()
        db.query(OrderItem).delete()
        db.query(Order).delete()
        db.query(Product).delete()
        db.query(Customer).delete()
        db.commit()

    random.seed(42)
    now = datetime(2026, 10, 1, 12, 0, 0)  # Fixed reference anchor for deterministic dates

    # Regions and Channels
    regions = ["North America", "Europe", "Asia Pacific", "Latin America"]
    channels = ["Direct Web", "Enterprise", "Retail Partner", "Marketplace"]

    # 1. Seed 30 Products across 5 categories
    # Categories: Electronics, Furniture, Office Supplies, Apparel, Fitness
    products_data = [
        # Electronics (6)
        {"id": 1, "name": "Mechanical Keyboard Pro", "category": "Electronics", "price": 149.99, "cost": 65.0, "stock": 85, "threshold": 15},  # Declining sales, high inventory
        {"id": 2, "name": "Wireless Noise-Canceling Earbuds", "category": "Electronics", "price": 199.99, "cost": 85.0, "stock": 4, "threshold": 12},  # Surging demand, low stock!
        {"id": 3, "name": "Ultra HD 4K Monitor 27-inch", "category": "Electronics", "price": 389.99, "cost": 210.0, "stock": 18, "threshold": 8},
        {"id": 4, "name": "USB-C Multiport Hub 8-in-1", "category": "Electronics", "price": 59.99, "cost": 22.0, "stock": 45, "threshold": 10},
        {"id": 5, "name": "Smart Fitness Tracker Band", "category": "Electronics", "price": 89.99, "cost": 38.0, "stock": 0, "threshold": 15},  # Out of stock
        {"id": 6, "name": "Fast Wireless Charging Pad", "category": "Electronics", "price": 34.99, "cost": 12.0, "stock": 52, "threshold": 10},

        # Furniture (6) - Will show MoM decline
        {"id": 7, "name": "Ergonomic Mesh Task Chair", "category": "Furniture", "price": 289.99, "cost": 130.0, "stock": 22, "threshold": 10},
        {"id": 8, "name": "Electric Standing Desk Frame", "category": "Furniture", "price": 459.99, "cost": 220.0, "stock": 14, "threshold": 6},
        {"id": 9, "name": "Solid Oak Monitor Riser", "category": "Furniture", "price": 79.99, "cost": 28.0, "stock": 35, "threshold": 10},
        {"id": 10, "name": "Steel 3-Drawer Filing Cabinet", "category": "Furniture", "price": 179.99, "cost": 85.0, "stock": 8, "threshold": 5},
        {"id": 11, "name": "Acoustic Desk Privacy Screen", "category": "Furniture", "price": 119.99, "cost": 48.0, "stock": 0, "threshold": 8},  # Out of stock
        {"id": 12, "name": "Anti-Fatigue Standing Mat", "category": "Furniture", "price": 49.99, "cost": 18.0, "stock": 60, "threshold": 15},

        # Office Supplies (6)
        {"id": 13, "name": "Premium Hardcover Notebook A5", "category": "Office Supplies", "price": 24.99, "cost": 7.5, "stock": 120, "threshold": 25},
        {"id": 14, "name": "Gel Ink Rollerball Pens (12pk)", "category": "Office Supplies", "price": 18.99, "cost": 5.0, "stock": 150, "threshold": 30},
        {"id": 15, "name": "Magnetic Whiteboard 36x24", "category": "Office Supplies", "price": 84.99, "cost": 36.0, "stock": 16, "threshold": 8},
        {"id": 16, "name": "Aluminum Document Tray Set", "category": "Office Supplies", "price": 39.99, "cost": 14.0, "stock": 6, "threshold": 8},  # Low stock
        {"id": 17, "name": "Heavy Duty Desktop Stapler", "category": "Office Supplies", "price": 29.99, "cost": 10.0, "stock": 40, "threshold": 10},
        {"id": 18, "name": "Recycled Laser Printer Paper 500ct", "category": "Office Supplies", "price": 32.99, "cost": 15.0, "stock": 90, "threshold": 20},

        # Apparel (6)
        {"id": 19, "name": "Merino Wool Zip Cardigan", "category": "Apparel", "price": 129.99, "cost": 55.0, "stock": 25, "threshold": 10},
        {"id": 20, "name": "Performance Stretch Chino", "category": "Apparel", "price": 89.99, "cost": 34.0, "stock": 38, "threshold": 12},
        {"id": 21, "name": "Organic Cotton Crewneck Tee", "category": "Apparel", "price": 34.99, "cost": 11.0, "stock": 110, "threshold": 25},
        {"id": 22, "name": "Waterproof Commuter Backpack", "category": "Apparel", "price": 119.99, "cost": 45.0, "stock": 5, "threshold": 10},  # Low stock
        {"id": 23, "name": "Tailored Oxford Button-Down", "category": "Apparel", "price": 74.99, "cost": 26.0, "stock": 42, "threshold": 15},
        {"id": 24, "name": "Thermal Insulated Travel Vest", "category": "Apparel", "price": 99.99, "cost": 40.0, "stock": 19, "threshold": 8},

        # Fitness (6)
        {"id": 25, "name": "Adjustable Cast Iron Dumbbells (50lb)", "category": "Fitness", "price": 229.99, "cost": 105.0, "stock": 15, "threshold": 5},
        {"id": 26, "name": "High-Density Foam Yoga Mat", "category": "Fitness", "price": 44.99, "cost": 16.0, "stock": 65, "threshold": 15},
        {"id": 27, "name": "Resistance Exercise Bands 5-Pack", "category": "Fitness", "price": 28.99, "cost": 8.0, "stock": 3, "threshold": 12},  # Low stock
        {"id": 28, "name": "Stainless Steel Shaker Bottle 24oz", "category": "Fitness", "price": 22.99, "cost": 7.0, "stock": 80, "threshold": 20},
        {"id": 29, "name": "Speed Jump Rope with Ball Bearings", "category": "Fitness", "price": 19.99, "cost": 6.0, "stock": 48, "threshold": 10},
        {"id": 30, "name": "Deep Tissue Percussion Massage Gun", "category": "Fitness", "price": 159.99, "cost": 65.0, "stock": 24, "threshold": 8},
    ]

    product_objects = []
    for p in products_data:
        prod = Product(
            id=p["id"],
            name=p["name"],
            category=p["category"],
            selling_price=p["price"],
            unit_cost=p["cost"],
            stock_quantity=p["stock"],
            reorder_threshold=p["threshold"],
            sku=f"SKU-{p['id']:04d}",
            created_at=now - timedelta(days=220),
            updated_at=now - timedelta(days=5)
        )
        db.add(prod)
        product_objects.append(prod)

        # Initial inventory movement
        db.add(InventoryMovement(
            product_id=p["id"],
            quantity_change=p["stock"] + 40,
            movement_type="Initial",
            reason="Opening inventory load",
            created_at=now - timedelta(days=210)
        ))

    db.commit()

    # 2. Seed 100 Customers
    first_names = [
        "James", "Mary", "Robert", "Patricia", "John", "Jennifer", "Michael", "Linda",
        "William", "Elizabeth", "David", "Barbara", "Richard", "Susan", "Joseph", "Jessica",
        "Thomas", "Sarah", "Charles", "Karen", "Christopher", "Nancy", "Daniel", "Lisa",
        "Matthew", "Betty", "Anthony", "Margaret", "Mark", "Sandra", "Donald", "Ashley",
        "Steven", "Kimberly", "Paul", "Emily", "Andrew", "Donna", "Joshua", "Michelle",
        "Kenneth", "Dorothy", "Kevin", "Carol", "Brian", "Amanda", "George", "Melissa",
        "Edward", "Deborah", "Ronald", "Stephanie", "Timothy", "Rebecca", "Jason", "Sharon",
        "Jeffrey", "Laura", "Ryan", "Cynthia", "Jacob", "Kathleen", "Gary", "Amy",
        "Nicholas", "Shirley", "Eric", "Angela", "Jonathan", "Helen", "Stephen", "Anna",
        "Larry", "Brenda", "Justin", "Pamela", "Scott", "Nicole", "Brandon", "Emma",
        "Benjamin", "Samantha", "Samuel", "Katherine", "Gregory", "Christine", "Frank", "Debra",
        "Alexander", "Rachel", "Raymond", "Catherine", "Patrick", "Carolyn", "Jack", "Janet",
        "Dennis", "Ruth", "Jerry", "Maria"
    ]
    last_names = [
        "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis",
        "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson",
        "Thomas", "Taylor", "Moore", "Jackson", "Martin", "Lee", "Perez", "Thompson",
        "White", "Harris", "Sanchez", "Clark", "Ramirez", "Lewis", "Robinson", "Walker",
        "Young", "Allen", "King", "Wright", "Scott", "Torres", "Nguyen", "Hill", "Flores",
        "Green", "Adams", "Nelson", "Baker", "Hall", "Rivera", "Campbell", "Mitchell",
        "Carter", "Roberts"
    ]

    customers = []
    # Dedicated special customer #10: Sarah Jenkins (Repeat, High Value)
    for i in range(1, 101):
        if i == 10:
            name = "Sarah Jenkins"
            email = "sarah.jenkins@enterprise-apex.com"
            region = "North America"
            reg_date = now - timedelta(days=175)
        elif i == 18:
            name = "Kenji Sato"
            email = "kenji.sato@global-tokyo.jp"
            region = "Asia Pacific"
            reg_date = now - timedelta(days=160)
        elif i == 45:
            name = "Elena Rostova"
            email = "elena.rostova@berlin-nordic.de"
            region = "Europe"
            reg_date = now - timedelta(days=140)
        else:
            fn = first_names[(i - 1) % len(first_names)]
            ln = last_names[(i * 3) % len(last_names)]
            name = f"{fn} {ln}"
            email = f"{fn.lower()}.{ln.lower()}{i}@example.com"
            region = regions[i % len(regions)]
            reg_date = now - timedelta(days=random.randint(20, 200))

        cust = Customer(
            id=i,
            name=name,
            email=email,
            region=region,
            registration_date=reg_date,
            created_at=reg_date
        )
        db.add(cust)
        customers.append(cust)

    db.commit()

    # 3. Seed Orders and OrderItems across last 6 months (approx 200 orders)
    # We will curate specific patterns:
    # - Product 1 (Mechanical Keyboard): had strong sales in Month 1 & 2 (12 orders), then plunged to 1 order in Month 5-6. (Declining sales, high inventory)
    # - Product 2 (Noise-Canceling Earbuds): had 2 sales in Month 1-3, but surged to 20 sales in Month 5-6! (Surging demand, low stock remaining)
    # - "Furniture" category: High sales in Months 1-3, dropped severely in Month 5-6 (Month-over-month decline)
    # - "Asia Pacific" region: Exponential growth from Month 1 (3 orders) to Month 6 (22 orders)
    # - Customer 10 ("Sarah Jenkins"): 7 separate Completed orders across months 1 to 6 (Repeat & High value)

    order_id_counter = 1001
    orders_list = []
    order_items_list = []
    movements_list = []

    # Let's define the 6 monthly brackets (30 days each, backwards from now)
    # Month 1 (oldest: 180 to 150 days ago)
    # Month 2 (150 to 120 days ago)
    # ...
    # Month 6 (most recent: 30 to 0 days ago)

    # Specific orders for Customer 10 (Sarah Jenkins)
    sarah_order_days = [170, 142, 115, 88, 62, 35, 8]
    for d_ago in sarah_order_days:
        o_date = now - timedelta(days=d_ago, hours=random.randint(1, 10))
        order = Order(
            id=order_id_counter,
            customer_id=10,
            order_date=o_date,
            region="North America",
            sales_channel="Enterprise",
            status="Completed",
            created_at=o_date
        )
        orders_list.append(order)
        # Sarah buys premium products (Monitor, Standing desk, etc.)
        p_chosen = random.choice([3, 7, 8, 25])
        prod = products_data[p_chosen - 1]
        qty = random.choice([1, 2])
        order_items_list.append(OrderItem(
            order_id=order_id_counter,
            product_id=p_chosen,
            quantity=qty,
            unit_price=prod["price"],
            unit_cost_at_sale=prod["cost"]
        ))
        movements_list.append(InventoryMovement(
            product_id=p_chosen,
            quantity_change=-qty,
            movement_type="Sale",
            reason=f"Order #{order_id_counter} fulfillment",
            created_at=o_date
        ))
        order_id_counter += 1

    # Specific pattern: Product 1 (Declining) vs Product 2 (Surging)
    # Product 1: 10 orders in months 1-3 (days 180 to 90), only 1 order in months 4-6 (days 90 to 0)
    for _ in range(10):
        d_ago = random.randint(95, 175)
        c_id = random.choice([c.id for c in customers if c.id != 10])
        o_date = now - timedelta(days=d_ago, hours=random.randint(1, 12))
        order = Order(
            id=order_id_counter,
            customer_id=c_id,
            order_date=o_date,
            region=random.choice(regions),
            sales_channel=random.choice(channels),
            status="Completed",
            created_at=o_date
        )
        orders_list.append(order)
        order_items_list.append(OrderItem(
            order_id=order_id_counter,
            product_id=1,
            quantity=random.choice([1, 2]),
            unit_price=149.99,
            unit_cost_at_sale=65.0
        ))
        movements_list.append(InventoryMovement(
            product_id=1,
            quantity_change=-1,
            movement_type="Sale",
            reason=f"Order #{order_id_counter} fulfillment",
            created_at=o_date
        ))
        order_id_counter += 1

    # Product 1 single late order
    d_ago_late = random.randint(5, 25)
    c_id = random.choice([c.id for c in customers if c.id != 10])
    o_date = now - timedelta(days=d_ago_late)
    order = Order(
        id=order_id_counter,
        customer_id=c_id,
        order_date=o_date,
        region="North America",
        sales_channel="Direct Web",
        status="Completed",
        created_at=o_date
    )
    orders_list.append(order)
    order_items_list.append(OrderItem(
        order_id=order_id_counter,
        product_id=1,
        quantity=1,
        unit_price=149.99,
        unit_cost_at_sale=65.0
    ))
    order_id_counter += 1

    # Product 2: Surging demand: 2 orders in early months (180-90 days), 18 orders in late months (90-0 days)
    for _ in range(2):
        d_ago = random.randint(100, 160)
        c_id = random.choice([c.id for c in customers if c.id != 10])
        o_date = now - timedelta(days=d_ago)
        order = Order(
            id=order_id_counter,
            customer_id=c_id,
            order_date=o_date,
            region=random.choice(regions),
            sales_channel=random.choice(channels),
            status="Completed",
            created_at=o_date
        )
        orders_list.append(order)
        order_items_list.append(OrderItem(
            order_id=order_id_counter,
            product_id=2,
            quantity=1,
            unit_price=199.99,
            unit_cost_at_sale=85.0
        ))
        order_id_counter += 1

    for _ in range(16):
        d_ago = random.randint(2, 75)
        c_id = random.choice([c.id for c in customers if c.id != 10])
        o_date = now - timedelta(days=d_ago, hours=random.randint(1, 15))
        order = Order(
            id=order_id_counter,
            customer_id=c_id,
            order_date=o_date,
            region=random.choice(["Asia Pacific", "North America", "Europe"]),
            sales_channel=random.choice(channels),
            status="Completed",
            created_at=o_date
        )
        orders_list.append(order)
        order_items_list.append(OrderItem(
            order_id=order_id_counter,
            product_id=2,
            quantity=random.choice([1, 2]),
            unit_price=199.99,
            unit_cost_at_sale=85.0
        ))
        movements_list.append(InventoryMovement(
            product_id=2,
            quantity_change=-1,
            movement_type="Sale",
            reason=f"Order #{order_id_counter} fulfillment",
            created_at=o_date
        ))
        order_id_counter += 1

    # Fill remaining ~165 orders distributed across the 180 days
    # Ensuring:
    # - Furniture orders drop off in the last 45 days compared to days 45-135
    # - Asia Pacific has more orders in recent 60 days
    # - Status mixture: 82% Completed, 8% Processing, 6% Cancelled, 4% Returned
    statuses_weights = ["Completed"] * 80 + ["Processing"] * 8 + ["Cancelled"] * 7 + ["Returned"] * 5

    remaining_count = 210 - len(orders_list)
    for _ in range(remaining_count):
        d_ago = random.randint(1, 180)
        c_id = random.choice([c.id for c in customers])
        cust = next(c for c in customers if c.id == c_id)

        # Region biasing: if in recent 60 days, bump Asia Pacific
        if d_ago <= 60 and random.random() < 0.45:
            reg = "Asia Pacific"
        else:
            reg = cust.region

        st = random.choice(statuses_weights)
        # If in last 5 days, higher chance of Processing
        if d_ago <= 4 and random.random() < 0.4:
            st = "Processing"

        o_date = now - timedelta(days=d_ago, hours=random.randint(1, 23), minutes=random.randint(1, 59))
        order = Order(
            id=order_id_counter,
            customer_id=c_id,
            order_date=o_date,
            region=reg,
            sales_channel=random.choice(channels),
            status=st,
            created_at=o_date
        )
        orders_list.append(order)

        # Select 1 to 3 items
        num_items = random.choices([1, 2, 3], weights=[0.65, 0.25, 0.10])[0]
        # Choose products. Avoid furniture if recent 45 days with high prob
        available_pids = list(range(3, 31))
        if d_ago <= 45:
            # Depress furniture (7 to 12)
            weights = [0.2 if 7 <= pid <= 12 else 1.0 for pid in available_pids]
            chosen_pids = random.choices(available_pids, weights=weights, k=num_items)
        else:
            chosen_pids = random.sample(available_pids, k=num_items)

        for pid in set(chosen_pids):
            prod = products_data[pid - 1]
            qty = random.randint(1, 3)
            order_items_list.append(OrderItem(
                order_id=order_id_counter,
                product_id=pid,
                quantity=qty,
                unit_price=prod["price"],
                unit_cost_at_sale=prod["cost"]
            ))

            if st in ["Completed", "Processing"]:
                movements_list.append(InventoryMovement(
                    product_id=pid,
                    quantity_change=-qty,
                    movement_type="Sale",
                    reason=f"Order #{order_id_counter} checkout",
                    created_at=o_date
                ))
            elif st == "Returned":
                movements_list.append(InventoryMovement(
                    product_id=pid,
                    quantity_change=qty,
                    movement_type="Return",
                    reason=f"Order #{order_id_counter} returned to stock",
                    created_at=o_date + timedelta(days=random.randint(3, 7))
                ))

        order_id_counter += 1

    # Bulk insert orders and items
    for o in orders_list:
        db.add(o)
    db.commit()

    for item in order_items_list:
        db.add(item)
    for mov in movements_list:
        db.add(mov)
    db.commit()

    # 4. Seed Business Activity
    recent_activities = [
        ("Inventory Adjustment", "inventory", 2, "Stock levels for 'Wireless Noise-Canceling Earbuds' reached critical threshold (4 units).", now - timedelta(hours=3)),
        ("Order Placed", "order", 1005, "Order #1005 placed via Enterprise channel for North America.", now - timedelta(hours=6)),
        ("Restock", "inventory", 14, "Restocked 50 units of 'Gel Ink Rollerball Pens (12pk)'.", now - timedelta(hours=14)),
        ("Customer Onboarding", "customer", 10, "Sarah Jenkins reached VIP High-Value status ($1,500+ spend threshold).", now - timedelta(days=1, hours=2)),
        ("Order Cancelled", "order", 1042, "Order #1042 was cancelled by customer prior to shipment.", now - timedelta(days=1, hours=9)),
        ("Sales Milestone", "product", 2, "Product 'Wireless Noise-Canceling Earbuds' achieved +140% demand surge.", now - timedelta(days=2)),
        ("Order Returned", "order", 1088, "Order #1088 return processed and stock restored.", now - timedelta(days=2, hours=12)),
        ("Stock Alert", "inventory", 5, "Product 'Smart Fitness Tracker Band' is completely OUT OF STOCK (0 units).", now - timedelta(days=3)),
    ]

    for act_type, entity_type, entity_id, desc, act_time in recent_activities:
        db.add(BusinessActivity(
            activity_type=act_type,
            entity_type=entity_type,
            entity_id=entity_id,
            description=desc,
            created_at=act_time
        ))

    db.commit()
    print(f"Successfully seeded database with {len(customers)} customers, {len(products_data)} products, {len(orders_list)} orders, and activity log.")

if __name__ == "__main__":
    db = SessionLocal()
    try:
        seed_database(db, force=True)
    finally:
        db.close()
