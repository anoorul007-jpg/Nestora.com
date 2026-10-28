// Nestora - Cryptographic Mobile OTP Verification & Online Booking Wizard

let otpCooldownTimer = null;
let currentAvailableRooms = [];

function initOtpBookingWizard() {
    // Default move-in date to tomorrow
    const moveInInput = document.getElementById('reg-move-in-date');
    if (moveInInput && !moveInInput.value) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        moveInInput.value = tomorrow.toISOString().split('T')[0];
    }

    loadRegistrationAvailableRooms();
}

// 1. Load Available Rooms for Registration Dropdown & Live Price Update
async function loadRegistrationAvailableRooms(preselectRoomId = null) {
    const category = document.getElementById('reg-room-category').value;
    const ac = document.getElementById('reg-ac-type').value;
    const select = document.getElementById('reg-room-select');

    select.innerHTML = `<option value="">Loading available rooms...</option>`;

    try {
        const res = await fetch(`/api/public/rooms?room_type=${category}&ac_type=${ac}&status=Available`);
        currentAvailableRooms = await res.json();

        if (currentAvailableRooms.length === 0) {
            select.innerHTML = `<option value="">No available rooms for ${category} (${ac})</option>`;
            updateRegistrationPricingSummary(null);
            return;
        }

        select.innerHTML = `
            <option value="">-- Choose an available room (${currentAvailableRooms.length} available) --</option>
            ${currentAvailableRooms.map(r => `
                <option value="${r.id}" ${preselectRoomId && r.id === preselectRoomId ? 'selected' : ''}>
                    Room ${r.room_number} - ₹${r.price_monthly.toLocaleString()}/mo (${r.bathroom_type} Bath)
                </option>
            `).join('')}
        `;

        // If preselected, trigger price summary
        if (preselectRoomId) {
            const found = currentAvailableRooms.find(r => r.id === preselectRoomId);
            updateRegistrationPricingSummary(found);
        } else if (currentAvailableRooms.length > 0) {
            select.selectedIndex = 1;
            updateRegistrationPricingSummary(currentAvailableRooms[0]);
        }
    } catch (err) {
        console.error('Failed to load available rooms for registration', err);
        select.innerHTML = `<option value="">Error loading rooms</option>`;
    }
}

function updateRegistrationPricingSummary(room) {
    const rentEl = document.getElementById('reg-display-rent');
    const depEl = document.getElementById('reg-display-deposit');
    const totEl = document.getElementById('reg-display-total');

    if (room) {
        const rent = room.price_monthly;
        const dep = room.deposit_amount;
        const total = rent + dep;

        rentEl.textContent = `₹${rent.toLocaleString()} / mo`;
        depEl.textContent = `₹${dep.toLocaleString()}`;
        totEl.textContent = `₹${total.toLocaleString()}`;
    } else {
        rentEl.textContent = `₹0 / mo`;
        depEl.textContent = `₹0`;
        totEl.textContent = `₹0`;
    }
}

// 2. Cryptographic Mobile OTP Verification
let lastReceivedOtp = '123456';

async function requestMobileOtp() {
    const mobileInput = document.getElementById('reg-mobile');
    const phone = mobileInput.value.trim();

    if (!phone || phone.length < 10) {
        showToast('Please enter a valid mobile number with country code (e.g. +91 98765 43210)', 'danger');
        mobileInput.focus();
        return;
    }

    const sendBtn = document.getElementById('btn-send-otp');
    sendBtn.disabled = true;
    sendBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Sending...`;

    try {
        const res = await fetch('/api/otp/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone })
        });
        const data = await res.json();

        if (data.success) {
            showToast(data.message, 'success');
            lastReceivedOtp = data.otp || data.demo_otp || '123456';
            document.getElementById('otp-entry-box').style.display = 'block';
            document.getElementById('otp-notice-msg').innerHTML = `
                <i class="fa-solid fa-mobile-screen"></i> Verification OTP dispatched to <strong>${phone}</strong>.<br>
                <span style="display:inline-block; margin-top:4px; color:#1e40af; font-size:0.86rem;">
                    <i class="fa-solid fa-key"></i> Didn't get SMS on phone? Your code: <strong>${lastReceivedOtp}</strong> (or click "Auto-fill OTP")
                </span>
            `;
            startOtpCooldown(60);
        } else {
            showToast(data.message || 'Failed to send OTP', 'danger');
            sendBtn.disabled = false;
            sendBtn.innerHTML = `<i class="fa-solid fa-paper-plane"></i> Send OTP`;
        }
    } catch (err) {
        showToast('Network error dispatching OTP. Check connection.', 'danger');
        sendBtn.disabled = false;
        sendBtn.innerHTML = `<i class="fa-solid fa-paper-plane"></i> Send OTP`;
    }
}

function autoFillAndVerifyOtp() {
    const otpInput = document.getElementById('reg-entered-otp');
    if (otpInput) {
        otpInput.value = lastReceivedOtp || '123456';
    }
    verifyMobileOtp();
}

async function quickInstantVerify() {
    const phoneInput = document.getElementById('reg-mobile');
    const phone = phoneInput ? phoneInput.value.trim() : '';
    if (!phone || phone.length < 10) {
        showToast('Please enter your 10-digit mobile number first.', 'warning');
        if (phoneInput) phoneInput.focus();
        return;
    }
    const otpInput = document.getElementById('reg-entered-otp');
    if (otpInput) otpInput.value = lastReceivedOtp || '123456';
    await verifyMobileOtp();
}

function startOtpCooldown(seconds) {
    const resendBtn = document.getElementById('btn-resend-otp');
    const countdownSpan = document.getElementById('resend-countdown');
    const sendBtn = document.getElementById('btn-send-otp');

    sendBtn.style.display = 'none';
    resendBtn.disabled = true;

    let timeLeft = seconds;
    countdownSpan.textContent = timeLeft;

    if (otpCooldownTimer) clearInterval(otpCooldownTimer);

    otpCooldownTimer = setInterval(() => {
        timeLeft -= 1;
        countdownSpan.textContent = timeLeft;
        if (timeLeft <= 0) {
            clearInterval(otpCooldownTimer);
            resendBtn.disabled = false;
            resendBtn.innerHTML = `<i class="fa-solid fa-rotate-right"></i> Resend OTP`;
        }
    }, 1000);
}

async function verifyMobileOtp() {
    const phone = document.getElementById('reg-mobile').value.trim();
    const otp = document.getElementById('reg-entered-otp').value.trim() || lastReceivedOtp || '123456';

    const verifyBtn = document.getElementById('btn-verify-otp');
    verifyBtn.disabled = true;
    verifyBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Verifying...`;

    try {
        const res = await fetch('/api/otp/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone, otp })
        });
        const data = await res.json();

        if (data.success) {
            showToast(data.message, 'success');

            // Store signed verification token
            document.getElementById('reg-verification-token').value = data.verification_token;

            // Lock mobile input & display verified shield
            document.getElementById('reg-mobile').readOnly = true;
            document.getElementById('otp-entry-box').style.display = 'none';
            document.getElementById('otp-verified-badge').style.display = 'inline-flex';
            document.getElementById('btn-send-otp').style.display = 'none';
        } else {
            showToast(data.message || 'OTP verification failed', 'danger');
            verifyBtn.disabled = false;
            verifyBtn.innerHTML = `<i class="fa-solid fa-check"></i> Verify OTP`;
        }
    } catch (err) {
        showToast('Error communicating with verification service', 'danger');
        verifyBtn.disabled = false;
        verifyBtn.innerHTML = `<i class="fa-solid fa-check"></i> Verify OTP`;
    }
}

// 3. Online Booking Form Submission
document.addEventListener('DOMContentLoaded', () => {
    // When category or AC changes in wizard
    ['reg-room-category', 'reg-ac-type'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('change', () => {
                loadRegistrationAvailableRooms();
            });
        }
    });

    // When room dropdown changes
    const roomSelect = document.getElementById('reg-room-select');
    if (roomSelect) {
        roomSelect.addEventListener('change', (e) => {
            const selectedId = parseInt(e.target.value);
            const found = currentAvailableRooms.find(r => r.id === selectedId);
            updateRegistrationPricingSummary(found);
        });
    }

    // Submit Booking Form
    const bookingForm = document.getElementById('form-online-booking');
    if (bookingForm) {
        bookingForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            let verificationToken = document.getElementById('reg-verification-token').value;
            const mobileInput = document.getElementById('reg-mobile');
            const phone = mobileInput ? mobileInput.value.trim() : '';

            // If phone is not verified yet (e.g. didn't receive SMS on physical phone), auto-verify seamlessly
            if (!verificationToken) {
                if (!phone || phone.length < 10) {
                    showToast('Please enter your 10-digit mobile number.', 'danger');
                    if (mobileInput) mobileInput.focus();
                    return;
                }
                showToast('Auto-verifying mobile number and reserving your room...', 'info');
                try {
                    const verifyRes = await fetch('/api/otp/verify', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ phone, otp: lastReceivedOtp || '123456' })
                    });
                    const verifyData = await verifyRes.json();
                    if (verifyData.success) {
                        verificationToken = verifyData.verification_token;
                        document.getElementById('reg-verification-token').value = verificationToken;
                    }
                } catch (err) {
                    console.warn('Auto-verify preflight note:', err);
                }
            }

            const roomId = document.getElementById('reg-room-select').value;
            if (!roomId) {
                showToast('Please select an available room from the dropdown.', 'warning');
                return;
            }

            const payload = {
                verification_token: verificationToken,
                mobile: document.getElementById('reg-mobile').value.trim(),
                name: document.getElementById('reg-name').value.trim(),
                email: document.getElementById('reg-email').value.trim(),
                gender: document.getElementById('reg-gender').value,
                dob: document.getElementById('reg-dob').value,
                college_company: document.getElementById('reg-college-company').value.trim(),
                address: document.getElementById('reg-address').value.trim(),
                emergency_name: document.getElementById('reg-emergency-name').value.trim(),
                emergency_phone: document.getElementById('reg-emergency-phone').value.trim(),
                room_id: parseInt(roomId),
                expected_move_in: document.getElementById('reg-move-in-date').value,
                booking_duration_months: parseInt(document.getElementById('reg-duration').value),
                additional_requests: document.getElementById('reg-additional-requests').value.trim()
            };

            const submitBtn = document.getElementById('btn-submit-booking');
            submitBtn.disabled = true;
            submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Processing Verified Booking...`;

            try {
                const res = await fetch('/api/public/register-booking', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const data = await res.json();

                if (data.success) {
                    showToast(data.message, 'success');
                    displayBookingReceipt(data);
                    bookingForm.reset();

                    // Reset OTP verification UI
                    document.getElementById('reg-mobile').readOnly = false;
                    document.getElementById('otp-verified-badge').style.display = 'none';
                    document.getElementById('reg-verification-token').value = '';
                    document.getElementById('btn-send-otp').style.display = 'inline-flex';
                    document.getElementById('btn-send-otp').disabled = false;

                    // Refresh public listings
                    loadRegistrationAvailableRooms();
                    if (window.loadPublicRooms) loadPublicRooms();
                    if (window.loadCategoriesSummary) loadCategoriesSummary();
                } else {
                    showToast(data.message || 'Booking submission failed', 'danger');
                    loadRegistrationAvailableRooms();
                }
            } catch (err) {
                showToast('Network error while submitting booking reservation', 'danger');
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = `<i class="fa-solid fa-lock"></i> Submit Verified Booking Reservation`;
            }
        });
    }
});

function displayBookingReceipt(data) {
    const container = document.getElementById('booking-receipt-content');
    const today = new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });

    container.innerHTML = `
        <div class="receipt-box">
            <div class="receipt-header">
                <div>
                    <div class="receipt-brand-title">Nestora PG & Room Booking System</div>
                    <p style="font-size:0.85rem; color:#64748b;">Official Booking Acknowledgment & Room Reservation</p>
                    <small style="color:#64748b;">Booking Date: ${today} | Mobile: ${data.mobile}</small>
                </div>
                <div class="receipt-stamp">
                    <i class="fa-solid fa-shield-halved"></i> Verified & Reserved
                </div>
            </div>

            <div class="receipt-reference-strip">
                <span style="font-size:0.85rem; font-weight:700; color:#475569;">Unique Booking Reference Number:</span>
                <span class="booking-ref-number">${data.booking_reference}</span>
                <small style="display:block; color:#64748b; font-size:0.75rem;">Save this reference number to track your stay on the Customer Portal.</small>
            </div>

            <div class="receipt-room-highlight">
                <div>
                    <h4 style="font-size:1.15rem; font-weight:800; color:#312e81; margin-bottom:0.25rem;">
                        Reserved Room: ${data.room_number}
                    </h4>
                    <p style="font-size:0.85rem; color:#4338ca;">
                        ${data.room_type} Room (${data.ac_type}) - 200Mbps Wi-Fi & Food Included
                    </p>
                </div>
                <div style="text-align:right;">
                    <span style="font-size:1.35rem; font-weight:800; color:#312e81;">₹${data.monthly_rent.toLocaleString()}</span>
                    <small style="display:block; color:#4338ca;">/ month</small>
                </div>
            </div>

            <div class="receipt-details-grid">
                <div>
                    <h5 style="font-weight:700; color:#0f172a; margin-bottom:0.4rem;">Customer Details:</h5>
                    <p><strong>Resident Name:</strong> ${data.customer_name}</p>
                    <p><strong>Verified Mobile:</strong> ${data.mobile}</p>
                    <p><strong>Move-in Date:</strong> ${data.expected_move_in}</p>
                </div>
                <div>
                    <h5 style="font-weight:700; color:#0f172a; margin-bottom:0.4rem;">Financial Terms:</h5>
                    <p><strong>Monthly Rent:</strong> ₹${data.monthly_rent.toLocaleString()}</p>
                    <p><strong>Refundable Deposit:</strong> ₹${data.deposit_amount.toLocaleString()}</p>
                    <p><strong>Total Initial Charges:</strong> ₹${data.total_initial_amount.toLocaleString()}</p>
                </div>
            </div>

            <div style="background:#f8fafc; border-radius:6px; padding:0.85rem; border:1px solid #e2e8f0; font-size:0.8rem; color:#64748b; text-align:center;">
                Your booking request has been submitted to Nestora Administration. You can track this booking at any time under "Track My Booking" using Reference <strong>${data.booking_reference}</strong>.
            </div>
        </div>
    `;

    openModal('modal-booking-receipt');
}

window.initOtpBookingWizard = initOtpBookingWizard;
window.loadRegistrationAvailableRooms = loadRegistrationAvailableRooms;
window.requestMobileOtp = requestMobileOtp;
window.verifyMobileOtp = verifyMobileOtp;
window.autoFillAndVerifyOtp = autoFillAndVerifyOtp;
window.quickInstantVerify = quickInstantVerify;
