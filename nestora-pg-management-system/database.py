import sqlite3
import os
from config import Config

def get_db_connection():
    if Config.USE_MYSQL:
        try:
            import pymysql
            conn = pymysql.connect(
                host=Config.MYSQL_HOST,
                port=Config.MYSQL_PORT,
                user=Config.MYSQL_USER,
                password=Config.MYSQL_PASSWORD,
                database=Config.MYSQL_DB,
                cursorclass=pymysql.cursors.DictCursor,
                autocommit=True
            )
            return conn, 'mysql'
        except Exception as e:
            print(f"[Nestora DB] MySQL connection failed ({e}). Falling back to SQLite.")

    # SQLite Connection
    conn = sqlite3.connect(Config.SQLITE_PATH)
    conn.row_factory = sqlite3.Row
    return conn, 'sqlite'

def init_db():
    conn, engine = get_db_connection()
    cursor = conn.cursor()

    if engine == 'sqlite':
        # 1. Admins Table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS admins (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                full_name TEXT NOT NULL,
                email TEXT NOT NULL,
                role TEXT DEFAULT 'Admin',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')

        # 2. Rooms Table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS rooms (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                room_number TEXT UNIQUE NOT NULL,
                room_type TEXT CHECK(room_type IN ('Single', 'Double')) NOT NULL,
                ac_type TEXT CHECK(ac_type IN ('AC', 'Non-AC')) NOT NULL,
                price_monthly REAL NOT NULL,
                deposit_amount REAL NOT NULL,
                beds_count INTEGER NOT NULL DEFAULT 1,
                max_occupancy INTEGER NOT NULL DEFAULT 1,
                bathroom_type TEXT CHECK(bathroom_type IN ('Attached', 'Shared')) NOT NULL DEFAULT 'Attached',
                facilities TEXT,
                status TEXT CHECK(status IN ('Available', 'Pending', 'Confirmed', 'Occupied', 'Maintenance')) NOT NULL DEFAULT 'Available',
                primary_image TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')

        # 3. Room Images Table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS room_images (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                room_id INTEGER NOT NULL,
                image_url TEXT NOT NULL,
                caption TEXT,
                is_primary INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
            )
        ''')

        # 4. Customers Table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS customers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                mobile TEXT UNIQUE NOT NULL,
                email TEXT NOT NULL,
                gender TEXT CHECK(gender IN ('Male', 'Female', 'Other')) NOT NULL,
                dob TEXT,
                college_company TEXT,
                address TEXT NOT NULL,
                emergency_name TEXT NOT NULL,
                emergency_phone TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')

        # 5. OTP Verifications Table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS otp_verifications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                phone TEXT NOT NULL,
                otp_hash TEXT NOT NULL,
                verification_token TEXT,
                expires_at TEXT NOT NULL,
                attempts_count INTEGER DEFAULT 0,
                is_verified INTEGER DEFAULT 0,
                ip_address TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')

        # 6. Bookings Table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS bookings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                booking_reference TEXT UNIQUE NOT NULL,
                customer_id INTEGER NOT NULL,
                room_id INTEGER NOT NULL,
                expected_move_in TEXT NOT NULL,
                booking_duration_months INTEGER DEFAULT 6,
                monthly_rent REAL NOT NULL,
                deposit_amount REAL NOT NULL,
                total_initial_amount REAL NOT NULL,
                additional_requests TEXT,
                status TEXT CHECK(status IN ('Pending', 'Confirmed', 'Occupied', 'Vacated', 'Cancelled')) NOT NULL DEFAULT 'Pending',
                booking_date TEXT NOT NULL,
                move_in_date TEXT,
                move_out_date TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (customer_id) REFERENCES customers(id),
                FOREIGN KEY (room_id) REFERENCES rooms(id)
            )
        ''')

        # 7. Payments Table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS payments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                booking_id INTEGER NOT NULL,
                customer_id INTEGER NOT NULL,
                invoice_no TEXT UNIQUE NOT NULL,
                payment_type TEXT CHECK(payment_type IN ('Security Deposit', 'Monthly Rent', 'Initial Booking Package')) NOT NULL,
                amount REAL NOT NULL,
                payment_status TEXT CHECK(payment_status IN ('Paid', 'Pending', 'Failed', 'Refunded')) NOT NULL DEFAULT 'Pending',
                payment_method TEXT DEFAULT 'UPI / NetBanking',
                transaction_ref TEXT,
                payment_date TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (booking_id) REFERENCES bookings(id),
                FOREIGN KEY (customer_id) REFERENCES customers(id)
            )
        ''')

        # 8. Booking History Table (Preserves customer history after vacating)
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS booking_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                booking_id INTEGER NOT NULL,
                customer_id INTEGER NOT NULL,
                room_id INTEGER NOT NULL,
                room_number TEXT NOT NULL,
                move_in_date TEXT NOT NULL,
                move_out_date TEXT NOT NULL,
                total_rent_paid REAL DEFAULT 0,
                checkout_notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (booking_id) REFERENCES bookings(id),
                FOREIGN KEY (customer_id) REFERENCES customers(id)
            )
        ''')

        # 9. Audit Logs Table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS audit_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                actor_type TEXT NOT NULL,
                actor_id TEXT,
                action TEXT NOT NULL,
                details TEXT,
                ip_address TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')

        conn.commit()

    conn.close()
    print(f"[Nestora DB] 9 core tables verified and ready on {engine.upper()} engine.")

def log_audit(actor_type, actor_id, action, details, ip_address="127.0.0.1"):
    """Helper to log security, booking, and administrative events."""
    try:
        conn, engine = get_db_connection()
        cursor = conn.cursor()
        p = '%s' if engine == 'mysql' else '?'
        cursor.execute(f'''
            INSERT INTO audit_logs (actor_type, actor_id, action, details, ip_address)
            VALUES ({p}, {p}, {p}, {p}, {p})
        ''', (actor_type, str(actor_id), action, details, ip_address))
        if engine == 'sqlite':
            conn.commit()
        conn.close()
    except Exception as e:
        print(f"[Audit Log Error] {e}")

if __name__ == '__main__':
    init_db()
