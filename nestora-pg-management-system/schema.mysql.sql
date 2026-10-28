-- Nestora – Secure Online PG and Room Booking Management System
-- Production MySQL DDL Schema
-- Version: 2.0

CREATE DATABASE IF NOT EXISTS nestora_pg_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE nestora_pg_db;

-- 1. Administrators Table
CREATE TABLE IF NOT EXISTS admins (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL,
    role VARCHAR(50) DEFAULT 'Admin',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Rooms Table
CREATE TABLE IF NOT EXISTS rooms (
    id INT AUTO_INCREMENT PRIMARY KEY,
    room_number VARCHAR(20) UNIQUE NOT NULL,
    room_type ENUM('Single', 'Double') NOT NULL,
    ac_type ENUM('AC', 'Non-AC') NOT NULL,
    price_monthly DECIMAL(10,2) NOT NULL,
    deposit_amount DECIMAL(10,2) NOT NULL,
    beds_count INT NOT NULL DEFAULT 1,
    max_occupancy INT NOT NULL DEFAULT 1,
    bathroom_type ENUM('Attached', 'Shared') NOT NULL DEFAULT 'Attached',
    facilities TEXT,
    status ENUM('Available', 'Pending', 'Confirmed', 'Occupied', 'Maintenance') NOT NULL DEFAULT 'Available',
    primary_image VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_category (room_type, ac_type),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Room Images Gallery
CREATE TABLE IF NOT EXISTS room_images (
    id INT AUTO_INCREMENT PRIMARY KEY,
    room_id INT NOT NULL,
    image_url VARCHAR(255) NOT NULL,
    caption VARCHAR(100),
    is_primary TINYINT(1) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
    INDEX idx_room_id (room_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. Customers Table
CREATE TABLE IF NOT EXISTS customers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    mobile VARCHAR(20) UNIQUE NOT NULL,
    email VARCHAR(100) NOT NULL,
    gender ENUM('Male', 'Female', 'Other') NOT NULL,
    dob DATE,
    college_company VARCHAR(150),
    address TEXT NOT NULL,
    emergency_name VARCHAR(100) NOT NULL,
    emergency_phone VARCHAR(20) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_mobile (mobile),
    INDEX idx_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5. OTP Verifications Table
CREATE TABLE IF NOT EXISTS otp_verifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    phone VARCHAR(20) NOT NULL,
    otp_hash VARCHAR(255) NOT NULL,
    verification_token VARCHAR(255),
    expires_at TIMESTAMP NOT NULL,
    attempts_count INT DEFAULT 0,
    is_verified TINYINT(1) DEFAULT 0,
    ip_address VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_phone_verified (phone, is_verified)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 6. Bookings Table
CREATE TABLE IF NOT EXISTS bookings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    booking_reference VARCHAR(50) UNIQUE NOT NULL,
    customer_id INT NOT NULL,
    room_id INT NOT NULL,
    expected_move_in DATE NOT NULL,
    booking_duration_months INT DEFAULT 6,
    monthly_rent DECIMAL(10,2) NOT NULL,
    deposit_amount DECIMAL(10,2) NOT NULL,
    total_initial_amount DECIMAL(10,2) NOT NULL,
    additional_requests TEXT,
    status ENUM('Pending', 'Confirmed', 'Occupied', 'Vacated', 'Cancelled') NOT NULL DEFAULT 'Pending',
    booking_date DATE NOT NULL,
    move_in_date DATE,
    move_out_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (room_id) REFERENCES rooms(id),
    INDEX idx_ref (booking_reference),
    INDEX idx_booking_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 7. Payments Table
CREATE TABLE IF NOT EXISTS payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    booking_id INT NOT NULL,
    customer_id INT NOT NULL,
    invoice_no VARCHAR(50) UNIQUE NOT NULL,
    payment_type ENUM('Security Deposit', 'Monthly Rent', 'Initial Booking Package') NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    payment_status ENUM('Paid', 'Pending', 'Failed', 'Refunded') NOT NULL DEFAULT 'Pending',
    payment_method VARCHAR(50) DEFAULT 'UPI / NetBanking',
    transaction_ref VARCHAR(100),
    payment_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (booking_id) REFERENCES bookings(id),
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    INDEX idx_invoice (invoice_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 8. Booking History Table (Preserved on checkout)
CREATE TABLE IF NOT EXISTS booking_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    booking_id INT NOT NULL,
    customer_id INT NOT NULL,
    room_id INT NOT NULL,
    room_number VARCHAR(20) NOT NULL,
    move_in_date DATE NOT NULL,
    move_out_date DATE NOT NULL,
    total_rent_paid DECIMAL(10,2) DEFAULT 0.00,
    checkout_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (booking_id) REFERENCES bookings(id),
    FOREIGN KEY (customer_id) REFERENCES customers(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 9. Audit Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    actor_type VARCHAR(20) NOT NULL,
    actor_id VARCHAR(50),
    action VARCHAR(100) NOT NULL,
    details TEXT,
    ip_address VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_action (action)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
