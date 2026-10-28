# Nestora – Secure Online PG and Room Booking Management System

A complete, enterprise-grade, public-facing PG and room booking management system developed using **HTML5, CSS3, modern JavaScript (ES6+), Python Flask, MySQL / SQLite**, and a **cryptographically secure SMS OTP verification gateway**.

The platform provides a public website for prospective tenants to browse available rooms with real-time pricing and photos, complete online registrations with mobile phone verification, track booking status via a private OTP-secured customer portal, and grants administrative managers comprehensive control over room inventory, booking approvals, resident check-ins/checkouts, and operational audit logs.

---

## 🌟 Architecture & Core Capabilities

### 1. Public-Facing Website (Zero Mandatory Login)
- **Home Landing Page**: Clean responsive hero section with key guarantees: verified security, 200 Mbps Wi-Fi, 3 homestyle meals, power backup, and zero brokerage.
- **Room Categories & Pricing**: 4 distinct categories:
  - **Single Room (AC)** – Private premium suite with split AC, attached washroom, workstation.
  - **Single Room (Non-AC)** – Economical private room with ceiling fan, attached or shared washroom.
  - **Double Room (AC)** – Twin sharing accommodation with AC, lockers, dual study desks.
  - **Double Room (Non-AC)** – Budget-friendly twin sharing with high-speed Wi-Fi and power backup.
- **Real-Time Available Rooms Explorer**: Filter rooms dynamically by Category, Climate Control (AC/Non-AC), Bathroom Type (Attached/Shared), and Maximum Monthly Rent slider.
- **Photos Gallery**: High-definition room and facility photo gallery with categorized filter tabs (Bedrooms, Bathrooms, Workstations).
- **Facilities & Amenities**: Detailed cards covering fiber internet, 3 meals/day, 24/7 CCTV & biometric access, power backup, daily housekeeping, RO drinking water, automatic laundry, and two-wheeler parking.
- **About Us & Contact Us**: Property location, booking desk helplines, interactive contact inquiry form, and legal policies.

---

### 2. Cryptographic Mobile OTP Verification
- **High-Entropy OTP Generation**: 6-digit random code generated via Python's cryptographically strong `secrets` module.
- **SHA-256 Salted Hashing**: OTPs are **never stored in plaintext** in the database. Only a unique salt and its SHA-256 hash are recorded.
- **Cooldown & Expiry Security**: Enforces 60-second resend cooldown, 5-minute code expiration, and a strict limit of 3 invalid attempts before code invalidation.
- **Server-Signed HMAC Verification Token**: Upon successful OTP validation, the server generates a time-bounded HMAC-SHA256 verification token. When submitting the registration form, this token proves authentic control of the verified mobile number, preventing registration spoofing or client-side bypass.
- **Pluggable SMS Gateway**: Supports:
  1. **Twilio SMS** (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`)
  2. **Generic HTTP REST SMS Gateway** (`SMS_GATEWAY_URL`, `SMS_API_KEY`)
  3. **Local Secure Sandbox Logger** (Active by default for development and evaluation without requiring external credit).

---

### 3. Customer Online Registration & Concurrency Guard
- **4-Step Booking Wizard**:
  - **Step 1**: Choose room category, climate type, and select an available room. Displays a live pricing breakdown (monthly rent, refundable security deposit, and initial payable total).
  - **Step 2**: Enter mobile number, receive real SMS OTP, verify code, and lock verified status.
  - **Step 3**: Enter resident details: Full Name, Email, Gender, Date of Birth, College/Company, Permanent Residential Address, Emergency Contact Name & Phone, Move-in Date, Duration (3, 6, 12 months), and special preferences.
  - **Step 4**: Terms & Privacy Policy consent, followed by booking submission.
- **Atomic Concurrency Guard**: Uses database row locking. If two customers attempt to book the same room simultaneously, the second request is safely rejected with a `409 Conflict` notification.
- **Printable Booking Receipt**: Automatically generates a formal Nestora booking voucher with reference number, room number, payment schedule, and verification seal.

---

### 4. Customer Booking Portal & Status Tracking
- **Anti-Scraping Protection**: Requires **Booking Reference + Mobile Number + OTP Verification** to access booking details. Prevents unauthorized users from guessing reference numbers or viewing resident personal data.
- **Resident Dashboard**:
  - Live residency status badge (`Pending`, `Confirmed`, `Occupied`, `Vacated`, `Cancelled`).
  - Allocated room specifications, photos, and monthly pricing.
  - Tenancy dates, emergency contact, and profile details.
  - Quick action to view and reprint the official reservation receipt.
  - Online cancellation request with reason submission (only available prior to physical check-in).

---

### 5. Administrator Control Center
- **Secure Access**: Hashed administrator credentials (`PBKDF2:SHA-256` / `scrypt`).
- **Overview Dashboard**:
  - KPI Stat Cards: Total Rooms, Available Rooms, Occupied Rooms, Pending Approvals, Active Residents, and Monthly Rental Yield.
  - Recent Booking Applications feed with instant approve/reject actions.
- **Room Inventory Management**:
  - Add new rooms with number, category, climate, bathroom type, rent, deposit, facilities list, and room photograph (URL or local file upload).
  - Edit room details and prices.
  - Delete unoccupied rooms.
- **Booking Approval & State Machine Workflow**:
  - `Available` ➔ Room displayed on public portal.
  - `Pending` ➔ Customer submits booking with verified OTP; room is held.
  - `Confirmed` ➔ Admin reviews application and approves reservation.
  - `Occupied` ➔ Resident completes physical onboarding and check-in.
  - `Vacated` ➔ Resident check-out. **Room status is automatically restored to `Available` on the public website, and tenancy details are archived in `booking_history`**.
- **Customer Directory**: Search active and past residents across name, phone, email, college/company, room number, and reference.
- **Operational & Security Audit Trail**: Records timestamps, actor type (`Admin`, `Customer`), action type (`ROOM_ADDED`, `OTP_REQUESTED`, `BOOKING_APPROVED`, `CUSTOMER_CHECKIN`, `CUSTOMER_CHECKOUT`), IP address, and details.
- **CSV Data Export**: One-click download of all bookings and revenue records.

---

## 🗄️ Relational Database Schema (9 Tables)

The system includes a production-grade relational schema compatible with both **MySQL 8.0+** and **SQLite 3**:

```
                 +-------------------+
                 |      admins       |
                 +-------------------+
                          |
+-------------------+     |     +--------------------+
|       rooms       |-----+---->|     audit_logs     |
+-------------------+     |     +--------------------+
   |             |        |
   | 1:N         | 1:N    |
   v             v        |
+-------------+ +-------------+
| room_images | |  bookings   |<----+
+-------------+ +-------------+     |
                       |            |
                       | 1:N        |
                       v            |
                +-------------+     |
                |  payments   |     |
                +-------------+     |
                       |            |
                       v            |
                +-----------------+ |
                | booking_history | |
                +-----------------+ |
                       ^            |
                       |            |
+--------------------+ |            |
|     customers      |-+------------+
+--------------------+
   |
   | 1:N
   v
+--------------------+
| otp_verifications  |
+--------------------+
```

1. **`admins`**: Administrator accounts, hashed credentials, and roles.
2. **`rooms`**: Room inventory, category (`Single`/`Double`), climate (`AC`/`Non-AC`), bathroom (`Attached`/`Shared`), rent, deposit, and status.
3. **`room_images`**: Photo gallery attachments per room with primary view flag.
4. **`customers`**: Resident profiles, contact information, emergency details, and KYC metadata.
5. **`otp_verifications`**: Cryptographic OTP hashes (salt + SHA-256), expiry timestamps, attempt counters, and signed verification tokens.
6. **`bookings`**: Booking reservations, references, dates, pricing, and state machine status.
7. **`payments`**: Payment transaction logs, advance rentals, and security deposit records.
8. **`booking_history`**: Permanent archive of vacated residents, stay durations, total rent paid, and checkout condition notes.
9. **`audit_logs`**: System-wide security and operations audit trail with IP addresses.

---

## 📂 Project Structure

```
staynest-pg-management-system/
├── app.py                      # Flask REST API backend & state machine controllers
├── config.py                   # Configuration, security secrets & database settings
├── database.py                 # 9-table schema initialization (SQLite & MySQL)
├── otp_service.py              # Cryptographic OTP generator, SHA-256 hashing & SMS dispatch
├── seed_data.py                # Database seeder with 12 rooms, gallery photos & bookings
├── test_system.py              # 11-step automated end-to-end integration test suite
├── schema.mysql.sql            # Native MySQL schema & DDL script
├── requirements.txt            # Python dependencies (Flask, PyMySQL, Cryptography, Twilio)
├── .env.example                # Environment variables template
├── run.bat                     # Windows CMD one-click launcher
├── run.ps1                     # Windows PowerShell launcher
├── README.md                   # Complete documentation
├── static/
│   ├── css/
│   │   └── style.css           # Master responsive stylesheet
│   └── js/
│       ├── app.js              # Navigation router, toast alerts, legal modal openers
│       ├── public_rooms.js     # Public room explorer, filters, category cards & gallery
│       ├── otp_booking.js      # 4-step OTP registration wizard & receipt generator
│       ├── customer_portal.js  # OTP status tracking, resident stay details & cancellation
│       └── admin.js            # Admin dashboard, room CRUD, booking state machine & audit
└── templates/
    └── index.html              # Unified responsive Single-Page Application
```

---

## 🚀 Quick Start Guide

### Option 1: One-Click Windows Launch (Recommended)
Simply execute `run.bat` or run in PowerShell:
```powershell
.\run.ps1
```
This script will:
1. Create and configure the virtual environment `.venv`.
2. Install all required dependencies from `requirements.txt`.
3. Initialize and seed the database.
4. Start the Flask application on `http://127.0.0.1:5000`.

---

### Option 2: Manual Terminal Setup

1. **Activate the virtual environment**:
   ```powershell
   .\.venv\Scripts\Activate.ps1
   ```

2. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

3. **Seed the database**:
   ```bash
   python seed_data.py
   ```

4. **Run the integration test suite (optional)**:
   ```bash
   python test_system.py
   ```

5. **Start the application**:
   ```bash
   python app.py
   ```

6. **Open in browser**:
   Navigate to [http://127.0.0.1:5000](http://127.0.0.1:5000).

---

## 🔑 Default Credentials & Demo Data

### Administrator Portal
- **URL**: Click **"Admin Portal"** on the top notice bar or footer
- **Username**: `admin`
- **Password**: `admin123`

### Sample Tracking Reference (Customer Portal)
- **URL**: Click **"Track My Booking"**
- **Booking Reference**: `SN-2026-10821`
- **Mobile Number**: `+919876543210`
- *(In Sandbox mode, the 6-digit OTP is printed to the terminal console)*

---

## ⚙️ Production Configuration (MySQL & Twilio SMS)

Create a `.env` file from `.env.example`:

```ini
# Flask Secrets
SECRET_KEY=generate-a-strong-random-secret-key

# Database Selection (Set USE_MYSQL=True for MySQL)
USE_MYSQL=False
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=staynest_user
MYSQL_PASSWORD=your_secure_password
MYSQL_DB=staynest_pg

# SMS Gateway Configuration (Set SMS_PROVIDER=twilio or http)
SMS_PROVIDER=sandbox
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=+1234567890
```

---

## 🛡️ Security Best Practices Implemented
- **No Plaintext Passwords or OTPs**: Passwords use `scrypt`/`PBKDF2`, OTPs use salted SHA-256.
- **HMAC Verification Token**: Ensures that only mobile numbers verified in the current session can be registered.
- **State Machine Integrity**: Rooms cannot be double-booked; vacating automatically resets rooms to `Available`.
- **Audit Logging**: Every sensitive operation (login, room update, OTP request, checkout) is tracked with timestamp and IP address.
