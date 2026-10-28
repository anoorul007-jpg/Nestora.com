// Nestora - Customer Booking Status Tracking & Resident Portal

let portalCooldownTimer = null;
let lastPortalLookupOtp = '123456';

document.addEventListener('DOMContentLoaded', () => {
    initCustomerPortalEvents();
});

function initCustomerPortalEvents() {
    const lookupForm = document.getElementById('form-portal-lookup');
    if (lookupForm) {
        lookupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await verifyPortalOtpAndLogin();
        });
    }
}

// Open Booking Lookup Modal
function openPortalLookupModal() {
    const form = document.getElementById('form-portal-lookup');
    if (form) form.reset();

    const otpBox = document.getElementById('lookup-otp-box');
    if (otpBox) otpBox.style.display = 'none';

    const sendBtn = document.getElementById('btn-lookup-send-otp');
    if (sendBtn) {
        sendBtn.disabled = false;
        sendBtn.innerHTML = `<i class="fa-solid fa-key"></i> Send OTP to Mobile`;
    }

    if (portalCooldownTimer) {
        clearInterval(portalCooldownTimer);
        portalCooldownTimer = null;
    }

    openModal('modal-portal-lookup');
}

// Request OTP for Tracking
async function requestPortalLookupOtp() {
    const ref = document.getElementById('lookup-ref').value.trim();
    const phone = document.getElementById('lookup-phone').value.trim();
    const sendBtn = document.getElementById('btn-lookup-send-otp');

    if (!ref) {
        showToast('Please enter your Booking Reference number (e.g. SN-2026-...)', 'danger');
        document.getElementById('lookup-ref').focus();
        return;
    }

    if (!phone || phone.length < 10) {
        showToast('Please enter your 10-digit registered mobile number', 'danger');
        document.getElementById('lookup-phone').focus();
        return;
    }

    sendBtn.disabled = true;
    sendBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Verifying details & sending OTP...`;

    try {
        const res = await fetch('/api/portal/lookup-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ booking_reference: ref, mobile: phone })
        });
        const data = await res.json();

        if (data.success) {
            showToast(data.message, 'success');
            lastPortalLookupOtp = data.otp || data.demo_otp || '123456';
            const otpBox = document.getElementById('lookup-otp-box');
            if (otpBox) {
                otpBox.style.display = 'block';
                document.getElementById('lookup-otp').focus();
            }
            const notice = document.getElementById('lookup-otp-notice');
            if (notice) {
                notice.innerHTML = `<i class="fa-solid fa-circle-info"></i> Didn't receive SMS on phone? Your code: <strong>${lastPortalLookupOtp}</strong> (or click Auto-fill)`;
            }

            // Start 60s cooldown
            let countdown = 60;
            sendBtn.innerHTML = `<i class="fa-solid fa-clock"></i> Resend OTP (${countdown}s)`;
            portalCooldownTimer = setInterval(() => {
                countdown--;
                if (countdown <= 0) {
                    clearInterval(portalCooldownTimer);
                    portalCooldownTimer = null;
                    sendBtn.disabled = false;
                    sendBtn.innerHTML = `<i class="fa-solid fa-rotate-right"></i> Resend OTP`;
                } else {
                    sendBtn.innerHTML = `<i class="fa-solid fa-clock"></i> Resend OTP (${countdown}s)`;
                }
            }, 1000);
        } else {
            showToast(data.message || 'Verification request failed', 'danger');
            sendBtn.disabled = false;
            sendBtn.innerHTML = `<i class="fa-solid fa-key"></i> Send OTP to Mobile`;
        }
    } catch (err) {
        console.error('Portal lookup error:', err);
        showToast('Server communication failure. Please check your connection.', 'danger');
        sendBtn.disabled = false;
        sendBtn.innerHTML = `<i class="fa-solid fa-key"></i> Send OTP to Mobile`;
    }
}

function autoFillLookupOtp() {
    const input = document.getElementById('lookup-otp');
    if (input) input.value = lastPortalLookupOtp || '123456';
}

// Verify OTP & Open Portal
async function verifyPortalOtpAndLogin() {
    const ref = document.getElementById('lookup-ref').value.trim();
    const phone = document.getElementById('lookup-phone').value.trim();
    const otp = document.getElementById('lookup-otp').value.trim() || lastPortalLookupOtp || '123456';

    if (!otp || otp.length !== 6) {
        showToast('Please enter the 6-digit OTP received on your mobile.', 'danger');
        document.getElementById('lookup-otp').focus();
        return;
    }

    try {
        const res = await fetch('/api/portal/verify-lookup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                booking_reference: ref,
                mobile: phone,
                otp: otp
            })
        });
        const data = await res.json();

        if (data.success) {
            showToast(data.message, 'success');
            closeModal('modal-portal-lookup');
            await loadCustomerPortalBooking();
        } else {
            showToast(data.message || 'Invalid or expired OTP', 'danger');
        }
    } catch (err) {
        console.error('Portal verify error:', err);
        showToast('Failed to authenticate OTP', 'danger');
    }
}

// Fetch & Display Customer Portal Details
async function loadCustomerPortalBooking() {
    const content = document.getElementById('customer-portal-content');
    if (!content) return;

    content.innerHTML = `
        <div style="text-align:center; padding:3rem 1rem;">
            <i class="fa-solid fa-spinner fa-spin fa-2x text-primary"></i>
            <p style="margin-top:1rem; color:#64748b;">Loading your booking profile and stay details...</p>
        </div>
    `;
    openModal('modal-customer-portal');

    try {
        const res = await fetch('/api/portal/my-booking');
        if (!res.ok) {
            const errData = await res.json();
            content.innerHTML = `
                <div class="empty-state">
                    <i class="fa-solid fa-circle-exclamation text-danger fa-3x mb-3"></i>
                    <h4>Authentication Required</h4>
                    <p>${errData.message || 'Unable to access booking.'}</p>
                    <button class="btn btn-primary mt-3" onclick="openPortalLookupModal()">Log In with Phone & OTP</button>
                </div>
            `;
            return;
        }

        const b = await res.json();

        // Status badge formatting
        let statusBadgeClass = 'pill-pending';
        let statusIcon = 'fa-hourglass-half';
        if (b.status === 'Confirmed') {
            statusBadgeClass = 'pill-confirmed';
            statusIcon = 'fa-check-circle';
        } else if (b.status === 'Occupied') {
            statusBadgeClass = 'pill-occupied';
            statusIcon = 'fa-house-user';
        } else if (b.status === 'Vacated') {
            statusBadgeClass = 'pill-vacated';
            statusIcon = 'fa-arrow-right-from-bracket';
        } else if (b.status === 'Cancelled') {
            statusBadgeClass = 'pill-cancelled';
            statusIcon = 'fa-ban';
        }

        const facilities = b.facilities ? b.facilities.split(',').map(f => f.trim()) : ['Wi-Fi', 'Attached Washroom', 'Housekeeping'];

        content.innerHTML = `
            <div class="portal-dashboard">
                <!-- Status Header Banner -->
                <div class="portal-status-banner">
                    <div class="psb-left">
                        <span class="psb-ref">Booking Ref: <strong>${b.booking_reference}</strong></span>
                        <h2 class="psb-title">Welcome, ${escapeHtml(b.customer_name)}</h2>
                        <span class="psb-date"><i class="fa-regular fa-calendar"></i> Booked on ${formatDate(b.created_at)}</span>
                    </div>
                    <div class="psb-right">
                        <span class="badge-pill ${statusBadgeClass} text-lg">
                            <i class="fa-solid ${statusIcon}"></i> ${b.status}
                        </span>
                    </div>
                </div>

                <!-- Main Details Grid -->
                <div class="portal-details-grid">
                    <!-- Left Column: Allocated Room -->
                    <div class="portal-card">
                        <div class="portal-card-header">
                            <h4><i class="fa-solid fa-bed text-primary"></i> Allocated Room Details</h4>
                            <span class="badge badge-primary">Room ${b.room_number}</span>
                        </div>
                        <div class="portal-room-preview">
                            <img src="${b.primary_image || 'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&w=600&q=80'}" 
                                 alt="Room ${b.room_number}" class="portal-room-img"
                                 onerror="this.src='https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&w=600&q=80'">
                            <div class="portal-room-meta">
                                <div class="prm-item">
                                    <span class="prm-label">Category:</span>
                                    <span class="prm-val">${b.room_type} Room (${b.ac_type})</span>
                                </div>
                                <div class="prm-item">
                                    <span class="prm-label">Bathroom:</span>
                                    <span class="prm-val">${b.bathroom_type} Western Washroom</span>
                                </div>
                                <div class="prm-item">
                                    <span class="prm-label">Monthly Rent:</span>
                                    <span class="prm-val text-primary font-bold">₹${Number(b.monthly_rent || 0).toLocaleString()} / month</span>
                                </div>
                                <div class="prm-item">
                                    <span class="prm-label">Security Deposit:</span>
                                    <span class="prm-val">₹${Number(b.security_deposit || 0).toLocaleString()} (Refundable)</span>
                                </div>
                            </div>
                        </div>

                        <div class="portal-amenities-tags mt-3">
                            <span class="tags-title">Included Amenities:</span>
                            <div class="tags-list">
                                ${facilities.map(f => `<span class="amenity-chip"><i class="fa-solid fa-check text-success"></i> ${escapeHtml(f)}</span>`).join('')}
                            </div>
                        </div>
                    </div>

                    <!-- Right Column: Tenancy & Customer Profile -->
                    <div class="portal-card">
                        <div class="portal-card-header">
                            <h4><i class="fa-solid fa-user-check text-primary"></i> Resident Information</h4>
                            <span class="badge badge-success"><i class="fa-solid fa-shield-check"></i> Phone Verified</span>
                        </div>
                        
                        <div class="portal-info-list">
                            <div class="pil-row">
                                <span class="pil-label"><i class="fa-solid fa-mobile-screen"></i> Verified Mobile:</span>
                                <span class="pil-val font-bold">${b.customer_mobile}</span>
                            </div>
                            <div class="pil-row">
                                <span class="pil-label"><i class="fa-solid fa-envelope"></i> Email:</span>
                                <span class="pil-val">${escapeHtml(b.customer_email || 'N/A')}</span>
                            </div>
                            <div class="pil-row">
                                <span class="pil-label"><i class="fa-solid fa-building"></i> College / Org:</span>
                                <span class="pil-val">${escapeHtml(b.college_company || 'N/A')}</span>
                            </div>
                            <div class="pil-row">
                                <span class="pil-label"><i class="fa-solid fa-calendar-day"></i> Move-in Date:</span>
                                <span class="pil-val font-bold text-dark">${formatDate(b.move_in_date)}</span>
                            </div>
                            <div class="pil-row">
                                <span class="pil-label"><i class="fa-solid fa-clock"></i> Duration:</span>
                                <span class="pil-val">${b.stay_duration_months || 6} Months</span>
                            </div>
                            <div class="pil-row">
                                <span class="pil-label"><i class="fa-solid fa-phone-volume"></i> Emergency Contact:</span>
                                <span class="pil-val">${escapeHtml(b.emergency_name)} (${b.emergency_phone})</span>
                            </div>
                            <div class="pil-row">
                                <span class="pil-label"><i class="fa-solid fa-location-dot"></i> Permanent Address:</span>
                                <span class="pil-val">${escapeHtml(b.customer_address || 'N/A')}</span>
                            </div>
                            ${b.additional_requests ? `
                            <div class="pil-row">
                                <span class="pil-label"><i class="fa-solid fa-comment-dots"></i> Special Notes:</span>
                                <span class="pil-val">${escapeHtml(b.additional_requests)}</span>
                            </div>
                            ` : ''}
                        </div>
                    </div>
                </div>

                <!-- Footer Action Buttons -->
                <div class="portal-actions-bar">
                    <button class="btn btn-secondary" onclick="renderAndShowReceipt(${JSON.stringify(b).replace(/"/g, '&quot;')})">
                        <i class="fa-solid fa-receipt"></i> View & Print Booking Receipt
                    </button>
                    ${(b.status === 'Pending' || b.status === 'Confirmed') ? `
                        <button class="btn btn-outline-danger" onclick="triggerPortalCancellation('${b.booking_reference}')">
                            <i class="fa-solid fa-ban"></i> Request Cancellation
                        </button>
                    ` : ''}
                    <button class="btn btn-primary" onclick="closeModal('modal-customer-portal')">
                        <i class="fa-solid fa-check"></i> Done
                    </button>
                </div>
            </div>
        `;
    } catch (err) {
        console.error('Error rendering customer portal:', err);
        content.innerHTML = `<div class="text-danger p-4">An error occurred while loading your booking details.</div>`;
    }
}

// Request Cancellation from Customer Portal
async function triggerPortalCancellation(bookingRef) {
    const reason = prompt('Please provide a brief reason for cancelling your room reservation:');
    if (reason === null) return; // user clicked cancel on prompt

    const finalReason = reason.trim() || 'Customer requested reservation cancellation via portal.';

    try {
        const res = await fetch('/api/portal/request-cancellation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason: finalReason })
        });
        const data = await res.json();

        if (data.success) {
            showToast(data.message, 'success');
            await loadCustomerPortalBooking();
            if (window.loadPublicRooms) window.loadPublicRooms();
            if (window.loadCategoriesSummary) window.loadCategoriesSummary();
        } else {
            showToast(data.message || 'Failed to cancel reservation.', 'danger');
        }
    } catch (err) {
        console.error('Cancellation error:', err);
        showToast('Error sending cancellation request.', 'danger');
    }
}

// Render Printable Receipt Modal
function renderAndShowReceipt(b) {
    const receiptBox = document.getElementById('booking-receipt-content');
    if (!receiptBox) return;

    receiptBox.innerHTML = `
        <div class="receipt-box" id="printable-receipt-card">
            <div class="receipt-header">
                <div>
                    <div class="receipt-brand-title">
                        <i class="fa-solid fa-hotel"></i> Nestora PG Management
                    </div>
                    <p style="font-size:0.8rem; color:#64748b; margin-top:2px;">Koramangala 4th Block, 100ft Road, Bangalore, KA - 560034</p>
                    <p style="font-size:0.78rem; color:#64748b;">Helpline: +91 98765 43210 | support@nestora.com</p>
                </div>
                <div class="receipt-stamp">
                    VERIFIED BOOKING
                </div>
            </div>

            <div class="receipt-meta-row" style="display:flex; justify-content:space-between; margin-bottom:1.25rem; font-size:0.85rem; border-bottom:1px dashed #cbd5e1; padding-bottom:0.75rem;">
                <div><strong>Booking Ref:</strong> ${b.booking_reference}</div>
                <div><strong>Booking Date:</strong> ${formatDate(b.created_at)}</div>
                <div><strong>Status:</strong> <span style="font-weight:700; color:#10b981;">${b.status}</span></div>
            </div>

            <div class="receipt-details-grid">
                <div>
                    <h5 style="color:#1e293b; font-weight:700; margin-bottom:0.4rem; text-transform:uppercase; font-size:0.75rem; letter-spacing:0.5px;">Resident Details</h5>
                    <p><strong>Name:</strong> ${escapeHtml(b.customer_name)}</p>
                    <p><strong>Mobile (Verified):</strong> ${b.customer_mobile}</p>
                    <p><strong>Email:</strong> ${escapeHtml(b.customer_email || 'N/A')}</p>
                    <p><strong>Company/College:</strong> ${escapeHtml(b.college_company || 'N/A')}</p>
                    <p><strong>Emergency:</strong> ${escapeHtml(b.emergency_name)} (${b.emergency_phone})</p>
                </div>
                <div>
                    <h5 style="color:#1e293b; font-weight:700; margin-bottom:0.4rem; text-transform:uppercase; font-size:0.75rem; letter-spacing:0.5px;">Accommodation Details</h5>
                    <p><strong>Room Number:</strong> Room ${b.room_number}</p>
                    <p><strong>Category:</strong> ${b.room_type} Room (${b.ac_type})</p>
                    <p><strong>Washroom:</strong> ${b.bathroom_type} Western Washroom</p>
                    <p><strong>Move-in Date:</strong> ${formatDate(b.move_in_date)}</p>
                    <p><strong>Duration:</strong> ${b.stay_duration_months || 6} Months</p>
                </div>
            </div>

            <div class="receipt-room-highlight">
                <div>
                    <div style="font-weight:700; font-size:0.95rem; color:#1e293b;">Room ${b.room_number} (${b.room_type} - ${b.ac_type})</div>
                    <div style="font-size:0.8rem; color:#64748b;">Includes 3 Meals/Day, 200Mbps Wi-Fi, Daily Housekeeping, 24/7 Security</div>
                </div>
                <div style="text-align:right;">
                    <div style="font-weight:800; font-size:1.15rem; color:#4f46e5;">₹${Number(b.monthly_rent || 0).toLocaleString()} <small style="font-size:0.75rem; color:#64748b;">/ mo</small></div>
                </div>
            </div>

            <table style="width:100%; border-collapse:collapse; margin-top:1rem; font-size:0.88rem;">
                <thead>
                    <tr style="border-bottom:2px solid #e2e8f0; text-align:left;">
                        <th style="padding:0.5rem 0;">Fee Description</th>
                        <th style="padding:0.5rem 0; text-align:right;">Amount (INR)</th>
                    </tr>
                </thead>
                <tbody>
                    <tr style="border-bottom:1px solid #f1f5f9;">
                        <td style="padding:0.5rem 0;">First Month Rental Advance</td>
                        <td style="padding:0.5rem 0; text-align:right; font-weight:600;">₹${Number(b.monthly_rent || 0).toLocaleString()}</td>
                    </tr>
                    <tr style="border-bottom:1px solid #f1f5f9;">
                        <td style="padding:0.5rem 0;">Refundable Tenancy Security Deposit</td>
                        <td style="padding:0.5rem 0; text-align:right; font-weight:600;">₹${Number(b.security_deposit || 0).toLocaleString()}</td>
                    </tr>
                    <tr style="border-top:2px solid #1e293b; font-weight:800; font-size:1rem;">
                        <td style="padding:0.75rem 0;">Total Move-in Payable:</td>
                        <td style="padding:0.75rem 0; text-align:right; color:#4f46e5;">₹${(Number(b.monthly_rent || 0) + Number(b.security_deposit || 0)).toLocaleString()}</td>
                    </tr>
                </tbody>
            </table>

            <div style="margin-top:1.25rem; padding-top:0.75rem; border-top:1px dashed #cbd5e1; font-size:0.75rem; color:#64748b; line-height:1.5;">
                * This document serves as an official Nestora room reservation receipt. Please present this reference code or your registered mobile number during physical check-in.
            </div>
        </div>
    `;

    openModal('modal-booking-receipt');
}

// Helper: Escape HTML
function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Helper: Format Date
function formatDate(dateStr) {
    if (!dateStr) return 'N/A';
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
        return dateStr;
    }
}

// Expose on window
window.openPortalLookupModal = openPortalLookupModal;
window.requestPortalLookupOtp = requestPortalLookupOtp;
window.loadCustomerPortalBooking = loadCustomerPortalBooking;
window.triggerPortalCancellation = triggerPortalCancellation;
window.renderAndShowReceipt = renderAndShowReceipt;
window.autoFillLookupOtp = autoFillLookupOtp;
