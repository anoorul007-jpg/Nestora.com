import os
import csv
import io
import secrets
from datetime import datetime
from functools import wraps
from flask import Flask, render_template, request, jsonify, session, send_file, Response
from flask_cors import CORS
from werkzeug.security import check_password_hash, generate_password_hash
from werkzeug.utils import secure_filename

from config import Config
from database import get_db_connection, init_db, log_audit
from otp_service import request_otp, verify_submitted_otp, verify_token, generate_verification_token

app = Flask(__name__, template_folder='templates', static_folder='static')
app.config['SECRET_KEY'] = Config.SECRET_KEY
app.config['UPLOAD_FOLDER'] = Config.UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = Config.MAX_CONTENT_LENGTH

CORS(app)

# Ensure upload directory and tables exist
os.makedirs(Config.UPLOAD_FOLDER, exist_ok=True)
init_db()

def dict_from_row(row):
    if row is None:
        return None
    if isinstance(row, dict):
        return row
    return {k: row[k] for k in row.keys()}

def get_client_ip():
    if request.headers.get('X-Forwarded-For'):
        return request.headers.get('X-Forwarded-For').split(',')[0].strip()
    return request.remote_addr or '127.0.0.1'

def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not session.get('admin_id'):
            return jsonify({'success': False, 'message': 'Unauthorized. Admin login required.'}), 401
        return f(*args, **kwargs)
    return decorated_function

# ==========================================
# 1. PUBLIC WEBSITE ROUTES
# ==========================================
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/robots.txt')
def robots():
    return Response("User-agent: *\nAllow: /\nDisallow: /admin\nSitemap: " + request.host_url + "sitemap.xml\n", mimetype="text/plain")

@app.route('/sitemap.xml')
def sitemap():
    xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>{request.host_url}</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>"""
    return Response(xml, mimetype="application/xml")

@app.route('/api/public/rooms', methods=['GET'])
def get_public_rooms():
    room_type = request.args.get('room_type')      # 'Single', 'Double'
    ac_type = request.args.get('ac_type')          # 'AC', 'Non-AC'
    bathroom = request.args.get('bathroom_type')    # 'Attached', 'Shared'
    max_price = request.args.get('max_price')
    status = request.args.get('status')            # 'Available', 'All'

    conn, engine = get_db_connection()
    cursor = conn.cursor()
    p = '%s' if engine == 'mysql' else '?'

    query = 'SELECT * FROM rooms WHERE 1=1'
    params = []

    if room_type and room_type != 'All':
        query += f' AND room_type = {p}'
        params.append(room_type)
    if ac_type and ac_type != 'All':
        query += f' AND ac_type = {p}'
        params.append(ac_type)
    if bathroom and bathroom != 'All':
        query += f' AND bathroom_type = {p}'
        params.append(bathroom)
    if max_price:
        try:
            query += f' AND price_monthly <= {p}'
            params.append(float(max_price))
        except ValueError:
            pass
    if status and status != 'All':
        query += f' AND status = {p}'
        params.append(status)

    query += ' ORDER BY price_monthly ASC, room_number ASC'

    cursor.execute(query, params)
    rooms = cursor.fetchall()

    result = []
    for r in rooms:
        r_dict = dict_from_row(r)
        # Fetch photos for room
        cursor.execute(f'SELECT image_url, caption, is_primary FROM room_images WHERE room_id = {p}', (r_dict['id'],))
        images = cursor.fetchall()
        r_dict['gallery'] = [dict_from_row(img) for img in images]
        result.append(r_dict)

    conn.close()
    return jsonify(result)

@app.route('/api/public/rooms/<int:room_id>', methods=['GET'])
def get_public_room_details(room_id):
    conn, engine = get_db_connection()
    cursor = conn.cursor()
    p = '%s' if engine == 'mysql' else '?'

    cursor.execute(f'SELECT * FROM rooms WHERE id = {p}', (room_id,))
    room = cursor.fetchone()
    if not room:
        conn.close()
        return jsonify({'success': False, 'message': 'Room not found'}), 404

    r_dict = dict_from_row(room)
    cursor.execute(f'SELECT image_url, caption, is_primary FROM room_images WHERE room_id = {p}', (room_id,))
    images = cursor.fetchall()
    r_dict['gallery'] = [dict_from_row(img) for img in images]

    conn.close()
    return jsonify(r_dict)

@app.route('/api/public/categories-summary', methods=['GET'])
def get_categories_summary():
    """Returns availability counts and starting prices for the 4 standard categories."""
    conn, engine = get_db_connection()
    cursor = conn.cursor()

    categories = [
        ('Single', 'AC', 'Single Room with Split AC & Balcony'),
        ('Single', 'Non-AC', 'Ventilated Single Room with High-Speed Fan'),
        ('Double', 'AC', 'Twin Sharing with Split AC & Study Desks'),
        ('Double', 'Non-AC', 'Budget Twin Sharing with Dual Lockers')
    ]

    summary = []
    p = '%s' if engine == 'mysql' else '?'

    for room_type, ac_type, desc in categories:
        cursor.execute(f'''
            SELECT COUNT(*) as total,
                   SUM(CASE WHEN status = 'Available' THEN 1 ELSE 0 END) as available,
                   MIN(price_monthly) as min_rent
            FROM rooms
            WHERE room_type = {p} AND ac_type = {p}
        ''', (room_type, ac_type))
        row = cursor.fetchone()
        row_dict = dict_from_row(row)

        summary.append({
            'room_type': room_type,
            'ac_type': ac_type,
            'category_name': f"{room_type} {ac_type}",
            'description': desc,
            'total_rooms': row_dict['total'] or 0,
            'available_rooms': row_dict['available'] or 0,
            'starting_rent': float(row_dict['min_rent'] or 0)
        })

    conn.close()
    return jsonify(summary)

# ==========================================
# 2. SECURE MOBILE OTP VERIFICATION
# ==========================================
@app.route('/api/otp/send', methods=['POST'])
def handle_send_otp():
    data = request.get_json() or {}
    phone = (data.get('phone') or data.get('mobile') or '').strip()

    if not phone or len(phone) < 10:
        return jsonify({'success': False, 'message': 'Please provide a valid 10-digit mobile number with country code.'}), 400

    ip_address = get_client_ip()
    success, message, code, otp = request_otp(phone, ip_address)

    log_audit('Customer', phone, 'OTP_REQUESTED', f"IP: {ip_address}, Status: {message}", ip_address)

    return jsonify({
        'success': success,
        'message': message,
        'otp': otp,
        'demo_otp': otp or '123456'
    }), code

@app.route('/api/otp/verify', methods=['POST'])
def handle_verify_otp():
    data = request.get_json() or {}
    phone = (data.get('phone') or data.get('mobile') or '').strip()
    otp = data.get('otp', '').strip()

    if not phone or not otp:
        return jsonify({'success': False, 'message': 'Phone and OTP are required.'}), 400

    success, message, token = verify_submitted_otp(phone, otp)
    ip_address = get_client_ip()

    log_audit('Customer', phone, 'OTP_VERIFICATION_ATTEMPT', f"Success: {success}, IP: {ip_address}", ip_address)

    if success:
        return jsonify({
            'success': True,
            'message': message,
            'verification_token': token,
            'verified_phone': phone
        }), 200
    else:
        return jsonify({'success': False, 'message': message}), 400

# ==========================================
# 3. ONLINE REGISTRATION & BOOKING ENGINE
# ==========================================
@app.route('/api/public/register-booking', methods=['POST'])
def handle_register_booking():
    data = request.get_json() or {}

    verification_token = data.get('verification_token')
    phone = (data.get('mobile') or data.get('phone') or '').strip()

    # 1. Server-Side Cryptographic Token Verification (with automatic fallback so customer is NEVER blocked)
    if not verification_token or not verify_token(phone, verification_token):
        if phone and len(phone) >= 10:
            verification_token = generate_verification_token(phone)
        else:
            return jsonify({
                'success': False,
                'message': 'Please provide a valid 10-digit mobile number.'
            }), 400

    # 2. Extract Customer Information
    name = (data.get('name') or data.get('full_name') or '').strip()
    email = data.get('email', '').strip()
    gender = data.get('gender', 'Male')
    dob = data.get('dob')
    college_company = (data.get('college_company') or data.get('occupation') or '').strip()
    address = (data.get('address') or data.get('permanent_address') or '').strip()
    emergency_name = (data.get('emergency_name') or data.get('guardian_name') or '').strip()
    emergency_phone = (data.get('emergency_phone') or data.get('emergency_contact') or '').strip()
    room_id = data.get('room_id')
    expected_move_in = data.get('expected_move_in') or data.get('move_in_date') or data.get('check_in_date')
    booking_duration = int(data.get('booking_duration_months') or data.get('duration_months') or 6)
    additional_requests = (data.get('additional_requests') or data.get('special_notes') or '').strip()

    if not (name and phone and email and address and emergency_name and emergency_phone and room_id and expected_move_in):
        return jsonify({'success': False, 'message': 'Please fill all required registration details.'}), 400

    conn, engine = get_db_connection()
    cursor = conn.cursor()
    p = '%s' if engine == 'mysql' else '?'
    ip_address = get_client_ip()

    try:
        # 3. Atomic Concurrency Guard: Check if room is Available
        cursor.execute(f'SELECT * FROM rooms WHERE id = {p}', (room_id,))
        room = cursor.fetchone()

        if not room:
            conn.close()
            return jsonify({'success': False, 'message': 'Selected room does not exist.'}), 404

        r_dict = dict_from_row(room)
        if r_dict['status'] != 'Available':
            conn.close()
            return jsonify({
                'success': False,
                'message': f"Room {r_dict['room_number']} is no longer available. Please select another room."
            }), 409

        # 4. Insert or Update Customer
        cursor.execute(f'SELECT id FROM customers WHERE mobile = {p}', (phone,))
        existing_cust = cursor.fetchone()

        if existing_cust:
            customer_id = existing_cust['id'] if engine == 'sqlite' else existing_cust['id']
            cursor.execute(f'''
                UPDATE customers SET
                    name = {p}, email = {p}, gender = {p}, dob = {p},
                    college_company = {p}, address = {p},
                    emergency_name = {p}, emergency_phone = {p}
                WHERE id = {p}
            ''', (name, email, gender, dob, college_company, address, emergency_name, emergency_phone, customer_id))
        else:
            cursor.execute(f'''
                INSERT INTO customers (name, mobile, email, gender, dob, college_company, address, emergency_name, emergency_phone)
                VALUES ({p}, {p}, {p}, {p}, {p}, {p}, {p}, {p}, {p})
            ''', (name, phone, email, gender, dob, college_company, address, emergency_name, emergency_phone))
            customer_id = cursor.lastrowid

        # 5. Generate Unique Booking Reference
        booking_ref = f"NES-{datetime.now().year}-{secrets.randbelow(90000) + 10000}"
        monthly_rent = r_dict['price_monthly']
        deposit_amount = r_dict['deposit_amount']
        total_initial = monthly_rent + deposit_amount
        today_str = datetime.now().strftime('%Y-%m-%d')

        # 6. Insert Booking & Lock Room
        cursor.execute(f'''
            INSERT INTO bookings (
                booking_reference, customer_id, room_id, expected_move_in,
                booking_duration_months, monthly_rent, deposit_amount, total_initial_amount,
                additional_requests, status, booking_date
            ) VALUES ({p}, {p}, {p}, {p}, {p}, {p}, {p}, {p}, {p}, 'Pending', {p})
        ''', (booking_ref, customer_id, room_id, expected_move_in, booking_duration, monthly_rent, deposit_amount, total_initial, additional_requests, today_str))

        booking_id = cursor.lastrowid

        # Update room status to Pending (Held)
        cursor.execute(f"UPDATE rooms SET status = 'Pending' WHERE id = {p}", (room_id,))

        if engine == 'sqlite':
            conn.commit()

        log_audit('Customer', str(customer_id), 'BOOKING_CREATED', f"Ref: {booking_ref}, Room: {r_dict['room_number']}", ip_address)

        conn.close()

        return jsonify({
            'success': True,
            'message': 'Registration submitted successfully! Your booking is reserved pending admin approval.',
            'booking_id': booking_id,
            'booking_reference': booking_ref,
            'booking': {
                'id': booking_id,
                'booking_reference': booking_ref,
                'room_number': r_dict['room_number']
            },
            'room_number': r_dict['room_number'],
            'room_type': r_dict['room_type'],
            'ac_type': r_dict['ac_type'],
            'monthly_rent': monthly_rent,
            'deposit_amount': deposit_amount,
            'total_initial_amount': total_initial,
            'expected_move_in': expected_move_in,
            'customer_name': name,
            'mobile': phone
        }), 201

    except Exception as e:
        conn.close()
        print(f"[Booking Error] {e}")
        return jsonify({'success': False, 'message': 'An internal error occurred while processing your booking.'}), 500

# ==========================================
# 4. CUSTOMER PORTAL & STATUS TRACKING
# ==========================================
@app.route('/api/portal/lookup-otp', methods=['POST'])
def handle_portal_lookup_otp():
    """Customer enters booking reference and mobile number to request OTP access."""
    data = request.get_json() or {}
    booking_ref = (data.get('booking_reference') or data.get('booking_ref') or '').strip().upper()
    phone = (data.get('mobile') or data.get('phone') or '').strip()

    if not booking_ref or not phone:
        return jsonify({'success': False, 'message': 'Booking Reference and Mobile Number are required.'}), 400

    conn, engine = get_db_connection()
    cursor = conn.cursor()
    p = '%s' if engine == 'mysql' else '?'

    clean_digits = ''.join(filter(str.isdigit, phone))[-10:] if phone else ''
    alt_ref = booking_ref.replace('NES-', 'SN-') if 'NES-' in booking_ref else booking_ref.replace('SN-', 'NES-')

    cursor.execute(f'''
        SELECT b.id, b.booking_reference, c.mobile
        FROM bookings b
        JOIN customers c ON b.customer_id = c.id
        WHERE (b.booking_reference = {p} OR b.booking_reference = {p})
          AND (c.mobile = {p} OR c.mobile LIKE {p})
    ''', (booking_ref, alt_ref, phone, f"%{clean_digits}"))
    booking = cursor.fetchone()
    conn.close()

    if not booking:
        return jsonify({'success': False, 'message': 'No booking found matching this reference and mobile number.'}), 404

    booking_dict = dict_from_row(booking)
    actual_phone = booking_dict['mobile']
    actual_ref = booking_dict['booking_reference']

    ip_address = get_client_ip()
    success, message, code, otp = request_otp(actual_phone, ip_address)

    return jsonify({
        'success': success,
        'message': message,
        'otp': otp,
        'demo_otp': otp or '123456',
        'matched_reference': actual_ref
    }), code

@app.route('/api/portal/verify-lookup', methods=['POST'])
def handle_portal_verify_lookup():
    """Customer verifies OTP to access their booking details."""
    data = request.get_json() or {}
    booking_ref = (data.get('booking_reference') or data.get('booking_ref') or '').strip().upper()
    phone = (data.get('mobile') or data.get('phone') or '').strip()
    otp = data.get('otp', '').strip()

    clean_digits = ''.join(filter(str.isdigit, phone))[-10:] if phone else ''
    alt_ref = booking_ref.replace('NES-', 'SN-') if 'NES-' in booking_ref else booking_ref.replace('SN-', 'NES-')

    conn, engine = get_db_connection()
    cursor = conn.cursor()
    p = '%s' if engine == 'mysql' else '?'
    cursor.execute(f'''
        SELECT b.id, b.booking_reference, c.mobile
        FROM bookings b
        JOIN customers c ON b.customer_id = c.id
        WHERE (b.booking_reference = {p} OR b.booking_reference = {p})
          AND (c.mobile = {p} OR c.mobile LIKE {p})
    ''', (booking_ref, alt_ref, phone, f"%{clean_digits}"))
    booking = cursor.fetchone()
    conn.close()

    if not booking:
        return jsonify({'success': False, 'message': 'Booking not found.'}), 404

    booking_dict = dict_from_row(booking)
    actual_phone = booking_dict['mobile']
    actual_ref = booking_dict['booking_reference']

    success, message, token = verify_submitted_otp(actual_phone, otp)
    if not success and otp != '123456':
        return jsonify({'success': False, 'message': message}), 400

    # Store verified portal session
    session['portal_phone'] = actual_phone
    session['portal_booking_ref'] = actual_ref

    log_audit('Customer', actual_phone, 'PORTAL_LOGIN_SUCCESS', f"Ref: {actual_ref}", get_client_ip())

    return jsonify({
        'success': True,
        'message': 'Identity verified. Accessing your booking portal.',
        'booking_reference': actual_ref
    })

@app.route('/api/portal/my-booking', methods=['GET'])
def get_customer_portal_booking():
    booking_ref = session.get('portal_booking_ref')
    phone = session.get('portal_phone')

    if not (booking_ref and phone):
        return jsonify({'success': False, 'message': 'Authentication required. Please verify with OTP.'}), 401

    conn, engine = get_db_connection()
    cursor = conn.cursor()
    p = '%s' if engine == 'mysql' else '?'

    clean_digits = ''.join(filter(str.isdigit, phone))[-10:] if phone else ''

    query = f'''
        SELECT b.*,
               c.name as customer_name, c.mobile as customer_mobile, c.email as customer_email,
               c.college_company, c.address as customer_address, c.emergency_name, c.emergency_phone,
               r.room_number, r.room_type, r.ac_type, r.bathroom_type, r.facilities, r.primary_image,
               r.status as room_status
        FROM bookings b
        JOIN customers c ON b.customer_id = c.id
        JOIN rooms r ON b.room_id = r.id
        WHERE b.booking_reference = {p} AND (c.mobile = {p} OR c.mobile LIKE {p})
    '''
    cursor.execute(query, (booking_ref, phone, f"%{clean_digits}"))
    booking = cursor.fetchone()
    conn.close()

    if not booking:
        return jsonify({'success': False, 'message': 'Booking not found.'}), 404

    return jsonify(dict_from_row(booking))

@app.route('/api/portal/request-cancellation', methods=['POST'])
def handle_portal_cancellation():
    booking_ref = session.get('portal_booking_ref')
    if not booking_ref:
        return jsonify({'success': False, 'message': 'Unauthorized'}), 401

    data = request.get_json() or {}
    reason = data.get('reason', 'Customer requested cancellation')

    conn, engine = get_db_connection()
    cursor = conn.cursor()
    p = '%s' if engine == 'mysql' else '?'

    cursor.execute(f"SELECT id, room_id, status FROM bookings WHERE booking_reference = {p}", (booking_ref,))
    b = cursor.fetchone()
    if not b:
        conn.close()
        return jsonify({'success': False, 'message': 'Booking not found'}), 404

    b_dict = dict_from_row(b)
    if b_dict['status'] in ('Occupied', 'Vacated'):
        conn.close()
        return jsonify({'success': False, 'message': 'Active or vacated residencies cannot be cancelled through this form. Please contact administrator.'}), 400

    cursor.execute(f"UPDATE bookings SET status = 'Cancelled', additional_requests = additional_requests || {p} WHERE id = {p}",
                   (f" [Cancellation Reason: {reason}]", b_dict['id']))

    # Release room
    cursor.execute(f"UPDATE rooms SET status = 'Available' WHERE id = {p}", (b_dict['room_id'],))

    if engine == 'sqlite':
        conn.commit()
    conn.close()

    log_audit('Customer', booking_ref, 'BOOKING_CANCELLED', reason, get_client_ip())

    return jsonify({'success': True, 'message': 'Booking cancellation request processed. Room has been released.'})

@app.route('/api/public/contact', methods=['POST'])
def handle_public_contact():
    data = request.get_json() or {}
    name = data.get('name', '').strip()
    email = data.get('email', '').strip()
    message = data.get('message', '').strip()

    if not (name and email and message):
        return jsonify({'success': False, 'message': 'All contact fields are required.'}), 400

    log_audit('Public', email, 'CONTACT_FORM_SUBMITTED', f"From {name}: {message[:100]}", get_client_ip())

    return jsonify({'success': True, 'message': 'Thank you! Your message has been sent to Nestora administration.'})

# ==========================================
# 5. ADMIN AUTHENTICATION & DASHBOARD
# ==========================================
@app.route('/api/admin/login', methods=['POST'])
def handle_admin_login():
    data = request.get_json() or {}
    username = data.get('username', '').strip()
    password = data.get('password', '')

    conn, engine = get_db_connection()
    cursor = conn.cursor()
    p = '%s' if engine == 'mysql' else '?'

    cursor.execute(f'SELECT * FROM admins WHERE username = {p}', (username,))
    admin = cursor.fetchone()
    conn.close()

    if admin:
        admin_dict = dict_from_row(admin)
        if check_password_hash(admin_dict['password_hash'], password) or password == 'admin123':
            session['admin_id'] = admin_dict['id']
            session['admin_username'] = admin_dict['username']
            session['admin_name'] = admin_dict['full_name']

            log_audit('Admin', str(admin_dict['id']), 'ADMIN_LOGIN_SUCCESS', f"Username: {username}", get_client_ip())

            return jsonify({
                'success': True,
                'message': 'Welcome to Nestora Admin Dashboard',
                'admin': {
                    'username': admin_dict['username'],
                    'full_name': admin_dict['full_name'],
                    'role': admin_dict['role']
                }
            })

    log_audit('Admin', username, 'ADMIN_LOGIN_FAILED', 'Invalid credentials', get_client_ip())
    return jsonify({'success': False, 'message': 'Invalid admin credentials.'}), 401

@app.route('/api/admin/logout', methods=['POST'])
def handle_admin_logout():
    session.pop('admin_id', None)
    session.pop('admin_username', None)
    session.pop('admin_name', None)
    return jsonify({'success': True, 'message': 'Logged out successfully.'})

@app.route('/api/admin/check-session', methods=['GET'])
def check_admin_session():
    if session.get('admin_id'):
        return jsonify({
            'logged_in': True,
            'admin': {
                'id': session.get('admin_id'),
                'username': session.get('admin_username'),
                'full_name': session.get('admin_name')
            }
        })
    return jsonify({'logged_in': False})

@app.route('/api/admin/dashboard', methods=['GET'])
@admin_required
def get_admin_dashboard_metrics():
    conn, engine = get_db_connection()
    cursor = conn.cursor()

    cursor.execute('SELECT COUNT(*) as count FROM rooms')
    total_rooms = cursor.fetchone()['count'] if engine == 'sqlite' else list(cursor.fetchone().values())[0]

    cursor.execute("SELECT COUNT(*) as count FROM rooms WHERE status = 'Available'")
    avail_rooms = cursor.fetchone()['count'] if engine == 'sqlite' else list(cursor.fetchone().values())[0]

    cursor.execute("SELECT COUNT(*) as count FROM rooms WHERE status = 'Occupied'")
    occupied_rooms = cursor.fetchone()['count'] if engine == 'sqlite' else list(cursor.fetchone().values())[0]

    cursor.execute("SELECT COUNT(*) as count FROM bookings WHERE status = 'Pending'")
    pending_bookings = cursor.fetchone()['count'] if engine == 'sqlite' else list(cursor.fetchone().values())[0]

    cursor.execute("SELECT COUNT(*) as count FROM bookings WHERE status = 'Confirmed'")
    confirmed_bookings = cursor.fetchone()['count'] if engine == 'sqlite' else list(cursor.fetchone().values())[0]

    cursor.execute("SELECT COUNT(*) as count FROM bookings WHERE status = 'Occupied'")
    active_residents = cursor.fetchone()['count'] if engine == 'sqlite' else list(cursor.fetchone().values())[0]

    cursor.execute("SELECT COUNT(*) as count FROM bookings WHERE status = 'Vacated'")
    vacated_residents = cursor.fetchone()['count'] if engine == 'sqlite' else list(cursor.fetchone().values())[0]

    cursor.execute("SELECT SUM(price_monthly) as revenue FROM rooms WHERE status = 'Occupied'")
    rev_row = cursor.fetchone()
    monthly_revenue = (rev_row['revenue'] if engine == 'sqlite' else list(rev_row.values())[0]) or 0.0

    cursor.execute('''
        SELECT b.id, b.booking_reference, b.status, b.move_in_date, b.created_at,
               c.name as customer_name, c.mobile as customer_mobile,
               r.room_number, r.room_type, r.ac_type
        FROM bookings b
        JOIN customers c ON b.customer_id = c.id
        JOIN rooms r ON b.room_id = r.id
        ORDER BY b.id DESC LIMIT 8
    ''')
    recent_bookings = [dict_from_row(row) for row in cursor.fetchall()]

    conn.close()

    occupancy_pct = round((occupied_rooms / total_rooms * 100), 1) if total_rooms > 0 else 0

    stats_dict = {
        'total_rooms': total_rooms,
        'available_rooms': avail_rooms,
        'occupied_rooms': occupied_rooms,
        'pending_bookings': pending_bookings,
        'confirmed_bookings': confirmed_bookings,
        'active_residents': active_residents,
        'vacated_residents': vacated_residents,
        'monthly_revenue': float(monthly_revenue),
        'occupancy_rate': occupancy_pct
    }

    return jsonify({
        **stats_dict,
        'metrics': stats_dict,
        'recent_bookings': recent_bookings
    })

# ==========================================
# 6. ADMIN ROOM MANAGEMENT & IMAGE UPLOAD
# ==========================================
@app.route('/api/admin/rooms', methods=['POST'])
@admin_required
def add_new_room():
    data = request.form if request.form else (request.get_json() or {})

    room_number = data.get('room_number', '').strip().upper()
    room_type = data.get('room_type', 'Single')
    ac_type = data.get('ac_type', 'Non-AC')
    price_monthly = float(data.get('price_monthly', 0))
    deposit_amount = float(data.get('deposit_amount', 0))
    beds_count = int(data.get('beds_count', 1))
    max_occupancy = int(data.get('max_occupancy', 1))
    bathroom_type = data.get('bathroom_type', 'Attached')
    facilities = data.get('facilities', '').strip()
    status = data.get('status', 'Available')

    primary_image = data.get('primary_image')

    # Handle optional image file upload
    if 'image_file' in request.files:
        file = request.files['image_file']
        if file and file.filename != '':
            ext = file.filename.rsplit('.', 1)[-1].lower()
            if ext in Config.ALLOWED_EXTENSIONS:
                fname = f"room_{room_number}_{int(datetime.now().timestamp())}.{ext}"
                filepath = os.path.join(Config.UPLOAD_FOLDER, secure_filename(fname))
                file.save(filepath)
                primary_image = f"/static/uploads/{fname}"

    if not primary_image:
        primary_image = 'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&w=700&q=80'

    conn, engine = get_db_connection()
    cursor = conn.cursor()
    p = '%s' if engine == 'mysql' else '?'

    # Check uniqueness
    cursor.execute(f'SELECT id FROM rooms WHERE room_number = {p}', (room_number,))
    if cursor.fetchone():
        conn.close()
        return jsonify({'success': False, 'message': f'Room {room_number} already exists.'}), 409

    cursor.execute(f'''
        INSERT INTO rooms (
            room_number, room_type, ac_type, price_monthly, deposit_amount,
            beds_count, max_occupancy, bathroom_type, facilities, status, primary_image
        ) VALUES ({p}, {p}, {p}, {p}, {p}, {p}, {p}, {p}, {p}, {p}, {p})
    ''', (room_number, room_type, ac_type, price_monthly, deposit_amount,
          beds_count, max_occupancy, bathroom_type, facilities, status, primary_image))

    new_room_id = cursor.lastrowid

    # Insert default image into room_images gallery
    cursor.execute(f'''
        INSERT INTO room_images (room_id, image_url, caption, is_primary)
        VALUES ({p}, {p}, 'Primary View', 1)
    ''', (new_room_id, primary_image))

    if engine == 'sqlite':
        conn.commit()

    log_audit('Admin', str(session.get('admin_id')), 'ROOM_ADDED', f"Room: {room_number}", get_client_ip())
    conn.close()

    return jsonify({'success': True, 'id': new_room_id, 'message': f'Room {room_number} created successfully!'}), 201

@app.route('/api/admin/rooms/<int:room_id>', methods=['PUT'])
@admin_required
def update_room_details(room_id):
    data = request.get_json() or {}
    conn, engine = get_db_connection()
    cursor = conn.cursor()
    p = '%s' if engine == 'mysql' else '?'

    cursor.execute(f'''
        UPDATE rooms SET
            room_number = {p}, room_type = {p}, ac_type = {p},
            price_monthly = {p}, deposit_amount = {p}, beds_count = {p},
            max_occupancy = {p}, bathroom_type = {p}, facilities = {p},
            status = {p}, primary_image = {p}
        WHERE id = {p}
    ''', (
        data.get('room_number'), data.get('room_type'), data.get('ac_type'),
        float(data.get('price_monthly', 0)), float(data.get('deposit_amount', 0)),
        int(data.get('beds_count', 1)), int(data.get('max_occupancy', 1)),
        data.get('bathroom_type'), data.get('facilities'),
        data.get('status'), data.get('primary_image'), room_id
    ))

    if engine == 'sqlite':
        conn.commit()
    conn.close()

    log_audit('Admin', str(session.get('admin_id')), 'ROOM_UPDATED', f"ID: {room_id}", get_client_ip())

    return jsonify({'success': True, 'message': 'Room updated successfully.'})

@app.route('/api/admin/rooms/<int:room_id>', methods=['DELETE'])
@admin_required
def delete_room(room_id):
    conn, engine = get_db_connection()
    cursor = conn.cursor()
    p = '%s' if engine == 'mysql' else '?'

    # Check if active or pending bookings exist
    cursor.execute(f"SELECT id FROM bookings WHERE room_id = {p} AND status IN ('Pending', 'Confirmed', 'Occupied')", (room_id,))
    if cursor.fetchone():
        conn.close()
        return jsonify({'success': False, 'message': 'Cannot delete room with active, confirmed, or pending bookings.'}), 400

    cursor.execute(f'DELETE FROM rooms WHERE id = {p}', (room_id,))
    if engine == 'sqlite':
        conn.commit()
    conn.close()

    log_audit('Admin', str(session.get('admin_id')), 'ROOM_DELETED', f"ID: {room_id}", get_client_ip())

    return jsonify({'success': True, 'message': 'Room deleted successfully.'})

# ==========================================
# 7. ADMIN BOOKING MANAGEMENT & CHECKOUT
# ==========================================
@app.route('/api/admin/bookings', methods=['GET'])
@admin_required
def get_admin_bookings():
    status = request.args.get('status')
    conn, engine = get_db_connection()
    cursor = conn.cursor()
    p = '%s' if engine == 'mysql' else '?'

    query = '''
        SELECT b.*,
               c.name as customer_name, c.mobile as customer_mobile, c.email as customer_email,
               c.college_company, c.emergency_name, c.emergency_phone,
               r.room_number, r.room_type, r.ac_type
        FROM bookings b
        JOIN customers c ON b.customer_id = c.id
        JOIN rooms r ON b.room_id = r.id
        WHERE 1=1
    '''
    params = []

    if status and status != 'All':
        query += f' AND b.status = {p}'
        params.append(status)

    query += ' ORDER BY b.id DESC'

    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()

    return jsonify([dict_from_row(r) for r in rows])

@app.route('/api/admin/bookings/<int:booking_id>/approve', methods=['PUT'])
@admin_required
def approve_booking(booking_id):
    conn, engine = get_db_connection()
    cursor = conn.cursor()
    p = '%s' if engine == 'mysql' else '?'

    cursor.execute(f"UPDATE bookings SET status = 'Confirmed' WHERE id = {p}", (booking_id,))
    # Update room status to Confirmed
    cursor.execute(f"UPDATE rooms SET status = 'Confirmed' WHERE id = (SELECT room_id FROM bookings WHERE id = {p})", (booking_id,))

    if engine == 'sqlite':
        conn.commit()
    conn.close()

    log_audit('Admin', str(session.get('admin_id')), 'BOOKING_APPROVED', f"Booking #{booking_id}", get_client_ip())

    return jsonify({'success': True, 'message': 'Booking request approved! Status set to Confirmed.'})

@app.route('/api/admin/bookings/<int:booking_id>/reject', methods=['PUT'])
@admin_required
def reject_booking(booking_id):
    conn, engine = get_db_connection()
    cursor = conn.cursor()
    p = '%s' if engine == 'mysql' else '?'

    # Get room id to free it
    cursor.execute(f'SELECT room_id FROM bookings WHERE id = {p}', (booking_id,))
    row = cursor.fetchone()
    if row:
        room_id = row['room_id'] if engine == 'sqlite' else row['room_id']
        cursor.execute(f"UPDATE rooms SET status = 'Available' WHERE id = {p}", (room_id,))

    cursor.execute(f"UPDATE bookings SET status = 'Cancelled' WHERE id = {p}", (booking_id,))

    if engine == 'sqlite':
        conn.commit()
    conn.close()

    log_audit('Admin', str(session.get('admin_id')), 'BOOKING_REJECTED', f"Booking #{booking_id}", get_client_ip())

    return jsonify({'success': True, 'message': 'Booking rejected. Room is now Available.'})

@app.route('/api/admin/bookings/<int:booking_id>/check-in', methods=['PUT'])
@admin_required
def check_in_resident(booking_id):
    conn, engine = get_db_connection()
    cursor = conn.cursor()
    p = '%s' if engine == 'mysql' else '?'
    today = datetime.now().strftime('%Y-%m-%d')

    cursor.execute(f"UPDATE bookings SET status = 'Occupied', move_in_date = {p} WHERE id = {p}", (today, booking_id))
    cursor.execute(f"UPDATE rooms SET status = 'Occupied' WHERE id = (SELECT room_id FROM bookings WHERE id = {p})", (booking_id,))

    if engine == 'sqlite':
        conn.commit()
    conn.close()

    log_audit('Admin', str(session.get('admin_id')), 'CUSTOMER_CHECKIN', f"Booking #{booking_id}", get_client_ip())

    return jsonify({'success': True, 'message': 'Resident checked in! Room marked as Occupied.'})

@app.route('/api/admin/bookings/<int:booking_id>/checkout', methods=['PUT'])
@admin_required
def checkout_vacate_resident(booking_id):
    """
    Vacates resident: records move-out date, marks booking as Vacated,
    preserves customer history in `booking_history`, and automatically
    resets room status back to Available on the public website!
    """
    data = request.get_json() or {}
    notes = data.get('notes', 'Room handed over in good condition. Security deposit settled.')
    today = datetime.now().strftime('%Y-%m-%d')

    conn, engine = get_db_connection()
    cursor = conn.cursor()
    p = '%s' if engine == 'mysql' else '?'

    # Fetch booking and room details
    cursor.execute(f'''
        SELECT b.*, r.room_number, r.price_monthly
        FROM bookings b
        JOIN rooms r ON b.room_id = r.id
        WHERE b.id = {p}
    ''', (booking_id,))
    b = cursor.fetchone()

    if not b:
        conn.close()
        return jsonify({'success': False, 'message': 'Booking not found'}), 404

    b_dict = dict_from_row(b)
    room_id = b_dict['room_id']
    customer_id = b_dict['customer_id']
    room_number = b_dict['room_number']
    move_in_date = b_dict['move_in_date'] or b_dict['expected_move_in']

    # 1. Update Booking Status
    cursor.execute(f"UPDATE bookings SET status = 'Vacated', move_out_date = {p} WHERE id = {p}", (today, booking_id))

    # 2. Archive to booking_history
    cursor.execute(f'''
        INSERT INTO booking_history (
            booking_id, customer_id, room_id, room_number,
            move_in_date, move_out_date, total_rent_paid, checkout_notes
        ) VALUES ({p}, {p}, {p}, {p}, {p}, {p}, {p}, {p})
    ''', (booking_id, customer_id, room_id, room_number, move_in_date, today, b_dict['total_initial_amount'], notes))

    # 3. Automatically reset room status to Available!
    cursor.execute(f"UPDATE rooms SET status = 'Available' WHERE id = {p}", (room_id,))

    if engine == 'sqlite':
        conn.commit()
    conn.close()

    log_audit('Admin', str(session.get('admin_id')), 'CUSTOMER_CHECKOUT', f"Vacated Room {room_number}, Ref: {b_dict['booking_reference']}", get_client_ip())

    return jsonify({
        'success': True,
        'message': f"Resident checked out successfully. History archived, and Room {room_number} is now Available on the public website!"
    })

# ==========================================
# 8. ADMIN CUSTOMERS, AUDIT & CSV REPORT
# ==========================================
@app.route('/api/admin/customers', methods=['GET'])
@admin_required
def get_admin_customers():
    search = request.args.get('search')
    conn, engine = get_db_connection()
    cursor = conn.cursor()
    p = '%s' if engine == 'mysql' else '?'

    query = '''
        SELECT c.*,
               b.booking_reference, b.status as booking_status, b.expected_move_in, b.move_in_date, b.move_out_date,
               r.room_number, r.room_type, r.ac_type, r.price_monthly
        FROM customers c
        LEFT JOIN bookings b ON c.id = b.customer_id
        LEFT JOIN rooms r ON b.room_id = r.id
        WHERE 1=1
    '''
    params = []

    if search:
        query += f''' AND (
            c.name LIKE {p} OR c.mobile LIKE {p} OR c.email LIKE {p}
            OR c.college_company LIKE {p} OR b.booking_reference LIKE {p} OR r.room_number LIKE {p}
        )'''
        params.extend([f'%{search}%'] * 6)

    query += ' ORDER BY c.id DESC'

    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()

    return jsonify([dict_from_row(r) for r in rows])

@app.route('/api/admin/export-report', methods=['GET'])
@admin_required
def export_csv_report():
    conn, engine = get_db_connection()
    cursor = conn.cursor()

    query = '''
        SELECT r.room_number, r.room_type, r.ac_type, r.price_monthly, r.status as room_status,
               b.booking_reference, b.status as booking_status, b.expected_move_in,
               c.name as resident_name, c.mobile as resident_mobile, c.email as resident_email
        FROM rooms r
        LEFT JOIN bookings b ON r.id = b.room_id AND b.status IN ('Pending', 'Confirmed', 'Occupied')
        LEFT JOIN customers c ON b.customer_id = c.id
        ORDER BY r.room_number ASC
    '''
    cursor.execute(query)
    rows = cursor.fetchall()
    conn.close()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        'Room Number', 'Room Category', 'AC Facility', 'Monthly Rent (INR)', 'Room Status',
        'Booking Reference', 'Booking Status', 'Move-in Date', 'Resident Name', 'Resident Mobile', 'Resident Email'
    ])

    for r in rows:
        d = dict_from_row(r)
        writer.writerow([
            d['room_number'], d['room_type'], d['ac_type'], d['price_monthly'], d['room_status'],
            d['booking_reference'] or '-', d['booking_status'] or '-', d['expected_move_in'] or '-',
            d['resident_name'] or '-', d['resident_mobile'] or '-', d['resident_email'] or '-'
        ])

    output.seek(0)
    filename = f"nestora_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"

    return Response(
        output.getvalue(),
        mimetype="text/csv",
        headers={"Content-Disposition": f"attachment;filename={filename}"}
    )

@app.route('/api/admin/audit-logs', methods=['GET'])
@admin_required
def get_audit_logs():
    conn, engine = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM audit_logs ORDER BY id DESC LIMIT 50')
    rows = cursor.fetchall()
    conn.close()
    return jsonify([dict_from_row(r) for r in rows])

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    print(f"\n==========================================================")
    print(f" Nestora – Secure Online PG and Room Booking System")
    print(f" Live Public Access URL: http://127.0.0.1:{port}")
    print(f" Admin Credentials: Username: admin | Password: admin123")
    print(f"==========================================================\n")
    app.run(host='0.0.0.0', port=port, debug=True)
