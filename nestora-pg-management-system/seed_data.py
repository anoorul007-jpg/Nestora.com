from werkzeug.security import generate_password_hash
from database import get_db_connection, init_db

def seed_database():
    init_db()
    conn, engine = get_db_connection()
    cursor = conn.cursor()
    p = '%s' if engine == 'mysql' else '?'

    # Clear existing data in reverse order of foreign keys
    for table in ['audit_logs', 'booking_history', 'payments', 'bookings', 'otp_verifications', 'customers', 'room_images', 'rooms', 'admins']:
        cursor.execute(f'DELETE FROM {table}')

    # 1. Administrators (Hashed password using Werkzeug PBKDF2:SHA256)
    admin_pw_hash = generate_password_hash('admin123', method='scrypt')
    cursor.execute(f'''
        INSERT INTO admins (username, password_hash, full_name, email, role)
        VALUES ({p}, {p}, {p}, {p}, 'SuperAdmin')
    ''', ('admin', admin_pw_hash, 'Nestora Administrator', 'admin@nestora.com'))

    # 2. Rooms across all 4 categories: Single AC, Single Non-AC, Double AC, Double Non-AC
    rooms_data = [
        # Single AC
        (
            'R-101', 'Single', 'AC', 13500.00, 20000.00, 1, 1, 'Attached',
            'Private Balcony, Split AC, Attached Western Washroom, Geyser, Wardrobe, Study Table, 200Mbps Wi-Fi, Daily Housekeeping',
            'Occupied',
            'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&w=700&q=80'
        ),
        (
            'R-102', 'Single', 'AC', 13500.00, 20000.00, 1, 1, 'Attached',
            'Executive Single Room, Smart TV, Mini-Fridge, Split AC, Attached Washroom, Ergonomic Chair, Wi-Fi',
            'Available',
            'https://images.unsplash.com/photo-1598928506311-c55ded91a20c?auto=format&fit=crop&w=700&q=80'
        ),
        (
            'R-201', 'Single', 'AC', 14000.00, 22000.00, 1, 1, 'Attached',
            'Corner Deluxe Single Suite, Sunlit Large Windows, Split AC, Premium Mattress, Wi-Fi, RO Water',
            'Available',
            'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=700&q=80'
        ),

        # Single Non-AC
        (
            'R-103', 'Single', 'Non-AC', 9500.00, 15000.00, 1, 1, 'Attached',
            'Spacious Single Bed, High-Speed Ceiling Fan, Attached Washroom, Geyser, Study Table, Wardrobe, Wi-Fi',
            'Available',
            'https://images.unsplash.com/photo-1595526114035-0d45ed16cfbf?auto=format&fit=crop&w=700&q=80'
        ),
        (
            'R-104', 'Single', 'Non-AC', 9000.00, 14000.00, 1, 1, 'Shared',
            'Peaceful Garden View Single Room, Wardrobe, Study Desk, Wi-Fi, Shared Clean Western Bathroom',
            'Occupied',
            'https://images.unsplash.com/photo-1540518614846-7eded433c457?auto=format&fit=crop&w=700&q=80'
        ),
        (
            'R-202', 'Single', 'Non-AC', 9500.00, 15000.00, 1, 1, 'Attached',
            'Well Ventilated Single Room, Large Wardrobe, Study Desk with Lamp, Geyser, High-Speed Wi-Fi',
            'Maintenance',
            'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=700&q=80'
        ),

        # Double AC
        (
            'R-203', 'Double', 'AC', 8500.00, 12000.00, 2, 2, 'Attached',
            'Twin Sharing Suite, Dual Study Desks, Lockers, Split AC, Attached Washroom with Geyser, Wi-Fi',
            'Occupied',
            'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=700&q=80'
        ),
        (
            'R-204', 'Double', 'AC', 8500.00, 12000.00, 2, 2, 'Attached',
            'Modern Double Room, Individual Wardrobes, Split AC, Attached Washroom, 200Mbps Wi-Fi, Food Included',
            'Available',
            'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=700&q=80'
        ),
        (
            'R-301', 'Double', 'AC', 8000.00, 12000.00, 2, 2, 'Attached',
            'Twin Beds with Balcony, Split AC, Ergonomic Study Chairs, Wi-Fi, Power Backup, Laundry Access',
            'Available',
            'https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=700&q=80'
        ),

        # Double Non-AC
        (
            'R-302', 'Double', 'Non-AC', 6500.00, 10000.00, 2, 2, 'Attached',
            'Budget Friendly Twin Room, Dual Wardrobes, Study Desks, Attached Washroom, RO Water, Wi-Fi',
            'Available',
            'https://images.unsplash.com/photo-1555854877-bab0e564b8d5?auto=format&fit=crop&w=700&q=80'
        ),
        (
            'R-303', 'Double', 'Non-AC', 6500.00, 10000.00, 2, 2, 'Attached',
            'Well-Lit Double Sharing, Individual Lockers, Attached Washroom, High Speed Wi-Fi, Power Backup',
            'Available',
            'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=700&q=80'
        ),
        (
            'R-304', 'Double', 'Non-AC', 6000.00, 9000.00, 2, 2, 'Shared',
            'Economical Double Room, Study Tables, Wardrobes, Clean Shared Bathroom, Wi-Fi, Kitchen Mess',
            'Available',
            'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=700&q=80'
        )
    ]

    for r in rooms_data:
        cursor.execute(f'''
            INSERT INTO rooms (
                room_number, room_type, ac_type, price_monthly, deposit_amount,
                beds_count, max_occupancy, bathroom_type, facilities, status, primary_image
            ) VALUES ({p}, {p}, {p}, {p}, {p}, {p}, {p}, {p}, {p}, {p}, {p})
        ''', r)

    # 3. Room Images Gallery (Photos)
    cursor.execute('SELECT id, room_number FROM rooms')
    all_rooms = cursor.fetchall()
    for rm in all_rooms:
        r_id = rm['id'] if engine == 'sqlite' else rm['id']
        cursor.execute(f'''
            INSERT INTO room_images (room_id, image_url, caption, is_primary)
            VALUES ({p}, {p}, {p}, 1)
        ''', (r_id, 'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&w=700&q=80', 'Bedroom Overview'))
        cursor.execute(f'''
            INSERT INTO room_images (room_id, image_url, caption, is_primary)
            VALUES ({p}, {p}, {p}, 0)
        ''', (r_id, 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=700&q=80', 'Clean Attached Bathroom'))
        cursor.execute(f'''
            INSERT INTO room_images (room_id, image_url, caption, is_primary)
            VALUES ({p}, {p}, {p}, 0)
        ''', (r_id, 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=700&q=80', 'Study Table & Workstation'))

    # 4. Customers
    customers_data = [
        (
            'Aarav Sharma', '+919876543210', 'aarav.sharma@example.com', 'Male', '1999-04-12',
            'Software Engineer at Wipro', 'Flat 302, Green Glen Layout, Bellandur, Bangalore',
            'Ramesh Sharma (Father)', '+919822011223'
        ),
        (
            'Ananya Iyer', '+919876543211', 'ananya.iyer@example.com', 'Female', '2001-08-19',
            'Data Scientist at Swiggy', 'B-14, 100ft Road, Indiranagar, Bangalore',
            'Kavita Iyer (Mother)', '+919811233445'
        ),
        (
            'Rohan Verma', '+919876543212', 'rohan.verma@example.com', 'Male', '2000-01-25',
            'MBA Student at Christ University', '104, Koramangala 4th Block, Bangalore',
            'Sunil Verma (Father)', '+919723455667'
        )
    ]
    customer_ids = []
    for c in customers_data:
        cursor.execute(f'''
            INSERT INTO customers (
                name, mobile, email, gender, dob, college_company,
                address, emergency_name, emergency_phone
            ) VALUES ({p}, {p}, {p}, {p}, {p}, {p}, {p}, {p}, {p})
        ''', c)
        customer_ids.append(cursor.lastrowid)

    # Fetch room IDs by room number
    cursor.execute('SELECT id, room_number FROM rooms')
    room_map = {row['room_number']: row['id'] for row in cursor.fetchall()}

    # 5. Bookings
    bookings_data = [
        # Aarav Sharma in Room R-101
        ('NES-2026-10821', customer_ids[0], room_map['R-101'], '2026-08-01', 12, 13500.00, 20000.00, 33500.00, 'Requires parking slot for two-wheeler', 'Occupied', '2026-07-25', '2026-08-01', None),
        # Ananya Iyer in Room R-104
        ('NES-2026-20943', customer_ids[1], room_map['R-104'], '2026-09-01', 6, 9000.00, 14000.00, 23000.00, 'Vegetarian food preferred', 'Occupied', '2026-08-28', '2026-09-01', None),
        # Rohan Verma in Room R-203
        ('NES-2026-30115', customer_ids[2], room_map['R-203'], '2026-09-15', 12, 8500.00, 12000.00, 20500.00, 'Quiet study corner', 'Occupied', '2026-09-10', '2026-09-15', None)
    ]
    for b in bookings_data:
        cursor.execute(f'''
            INSERT INTO bookings (
                booking_reference, customer_id, room_id, expected_move_in,
                booking_duration_months, monthly_rent, deposit_amount, total_initial_amount,
                additional_requests, status, booking_date, move_in_date, move_out_date
            ) VALUES ({p}, {p}, {p}, {p}, {p}, {p}, {p}, {p}, {p}, {p}, {p}, {p}, {p})
        ''', b)

    # 6. Past Booking History (Example showing preserved resident record upon vacating)
    cursor.execute(f'''
        INSERT INTO booking_history (
            booking_id, customer_id, room_id, room_number,
            move_in_date, move_out_date, total_rent_paid, checkout_notes
        ) VALUES ({p}, {p}, {p}, {p}, {p}, {p}, {p}, {p})
    ''', (1, customer_ids[0], room_map['R-103'], 'R-103', '2026-01-01', '2026-07-31', 66500.00, 'Full deposit refunded upon room handover in clean condition.'))

    if engine == 'sqlite':
        conn.commit()
    conn.close()
    print("[Nestora DB] Database seeded successfully with admins, 12 rooms, photo gallery, customers, and bookings!")

if __name__ == '__main__':
    seed_database()
