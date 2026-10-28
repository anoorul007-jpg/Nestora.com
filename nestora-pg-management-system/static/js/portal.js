// Nestora - Online Registration Portal, Dynamic Pricing & Collision Guard

let globalPricingRules = [];

async function loadPortal() {
    await fetchPricingRules();
    updatePortalPricingDisplay();
    await loadPortalAvailableRooms();

    // Default joining date to today
    const joiningInput = document.getElementById('portal-joining-date');
    if (joiningInput && !joiningInput.value) {
        joiningInput.value = new Date().toISOString().split('T')[0];
    }
}

async function fetchPricingRules() {
    try {
        const res = await fetch('/api/pricing');
        globalPricingRules = await res.json();
    } catch (err) {
        console.error('Failed to fetch pricing rules', err);
    }
}

function updatePortalPricingDisplay() {
    const roomType = document.getElementById('portal-room-type').value;
    const acType = document.getElementById('portal-ac-type').value;

    const rule = globalPricingRules.find(p => p.room_type === roomType && p.ac_type === acType);

    const rentEl = document.getElementById('portal-price-rent');
    const depEl = document.getElementById('portal-price-deposit');

    if (rule) {
        rentEl.textContent = `₹${rule.monthly_rent.toLocaleString()} / mo`;
        depEl.textContent = `₹${rule.deposit_amount.toLocaleString()} (Deposit)`;
    } else {
        // Fallback defaults
        const defaults = {
            'Single_AC': { rent: 12500, dep: 20000 },
            'Single_Non-AC': { rent: 9000, dep: 15000 },
            'Double_AC': { rent: 8000, dep: 12000 },
            'Double_Non-AC': { rent: 6000, dep: 10000 }
        };
        const key = `${roomType}_${acType}`;
        if (defaults[key]) {
            rentEl.textContent = `₹${defaults[key].rent.toLocaleString()} / mo`;
            depEl.textContent = `₹${defaults[key].dep.toLocaleString()} (Deposit)`;
        }
    }
}

async function loadPortalAvailableRooms() {
    const roomType = document.getElementById('portal-room-type').value;
    const acType = document.getElementById('portal-ac-type').value;
    const roomSelect = document.getElementById('portal-room-select');
    const hint = document.getElementById('portal-room-hint');

    roomSelect.innerHTML = `<option value="">Loading available rooms...</option>`;

    try {
        const res = await fetch(`/api/portal/available-rooms?room_type=${roomType}&ac_type=${acType}`);
        const availableRooms = await res.json();

        if (availableRooms.length === 0) {
            roomSelect.innerHTML = `<option value="">No available rooms for ${roomType} (${acType})</option>`;
            hint.innerHTML = `<span style="color:#ef4444;"><i class="fa-solid fa-triangle-exclamation"></i> All rooms in this category are currently full. Please try another category or check back later.</span>`;
            document.getElementById('btn-submit-registration').disabled = true;
            return;
        }

        document.getElementById('btn-submit-registration').disabled = false;
        hint.innerHTML = `<span style="color:#10b981;"><i class="fa-solid fa-circle-check"></i> ${availableRooms.length} available room(s) ready for instant booking.</span>`;

        roomSelect.innerHTML = `
            <option value="">-- Choose an available room (${availableRooms.length} available) --</option>
            ${availableRooms.map(r => `
                <option value="${r.id}">
                    Room ${r.room_number} - ₹${r.price_monthly.toLocaleString()}/mo (${r.facilities || 'Standard Room'})
                </option>
            `).join('')}
        `;
    } catch (err) {
        console.error('Failed to load available portal rooms', err);
        roomSelect.innerHTML = `<option value="">Error loading rooms</option>`;
    }
}

// Pricing System View Functions
async function loadPricing() {
    await fetchPricingRules();
    const container = document.getElementById('pricing-cards-container');
    if (!container) return;

    if (globalPricingRules.length === 0) {
        container.innerHTML = `<p style="grid-column:1/-1; text-align:center; color:#94a3b8;">No pricing rules configured.</p>`;
        return;
    }

    container.innerHTML = globalPricingRules.map(p => `
        <div class="pricing-plan-card">
            <h3 class="pricing-plan-title">${p.room_type} Room</h3>
            <span class="pricing-plan-ac tag-ac">${p.ac_type} Climate</span>
            <div class="pricing-plan-amount">₹${p.monthly_rent.toLocaleString()}</div>
            <div class="pricing-plan-sub">Per Month / Resident</div>
            <div style="font-size:0.85rem; color:#475569; margin-bottom:1.5rem; background:#f8fafc; padding:0.6rem; border-radius:6px; border:1px solid #e2e8f0;">
                Security Deposit: <strong>₹${p.deposit_amount.toLocaleString()}</strong>
            </div>
            <button class="btn btn-secondary btn-block" onclick="openEditPricingModal('${p.room_type}', '${p.ac_type}', ${p.monthly_rent}, ${p.deposit_amount})">
                <i class="fa-solid fa-pen"></i> Edit Category Price
            </button>
        </div>
    `).join('');
}

function openEditPricingModal(roomType, acType, rent, deposit) {
    document.getElementById('pricing-edit-type').value = roomType;
    document.getElementById('pricing-edit-ac').value = acType;
    document.getElementById('pricing-display-category').value = `${roomType} Room - ${acType}`;
    document.getElementById('pricing-input-rent').value = rent;
    document.getElementById('pricing-input-deposit').value = deposit;

    openModal('modal-pricing-edit');
}

// Registration Form Handler & Collision Prevention
document.addEventListener('DOMContentLoaded', () => {
    // Room category/ac dropdown changes
    ['portal-room-type', 'portal-ac-type'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('change', async () => {
                updatePortalPricingDisplay();
                await loadPortalAvailableRooms();
            });
        }
    });

    // Submit Registration Form
    const regForm = document.getElementById('form-portal-registration');
    if (regForm) {
        regForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const roomId = document.getElementById('portal-room-select').value;
            if (!roomId) {
                showToast('Please select an available room from the dropdown', 'warning');
                return;
            }

            const payload = {
                name: document.getElementById('portal-name').value.trim(),
                mobile: document.getElementById('portal-mobile').value.trim(),
                email: document.getElementById('portal-email').value.trim(),
                gender: document.getElementById('portal-gender').value,
                dob: document.getElementById('portal-dob').value,
                occupation: document.getElementById('portal-occupation').value.trim(),
                address: document.getElementById('portal-address').value.trim(),
                emergency_contact: document.getElementById('portal-emergency').value.trim(),
                room_id: parseInt(roomId),
                joining_date: document.getElementById('portal-joining-date').value
            };

            const submitBtn = document.getElementById('btn-submit-registration');
            submitBtn.disabled = true;
            submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Confirming Booking...`;

            try {
                const res = await fetch('/api/portal/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                const data = await res.json();

                if (data.success) {
                    showToast(data.message, 'success');
                    regForm.reset();

                    // Display confirmation receipt modal
                    displayRegistrationReceipt(data, payload);

                    // Refresh availability and backend data
                    await loadPortalAvailableRooms();
                    if (window.loadDashboard) loadDashboard();
                    if (window.loadRooms) loadRooms();
                    if (window.loadCustomers) loadCustomers();
                } else {
                    // Collision error or validation error
                    showToast(data.message || 'Registration failed', 'danger');
                    await loadPortalAvailableRooms();
                }
            } catch (err) {
                showToast('Network error while processing registration', 'danger');
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = `<i class="fa-solid fa-circle-check"></i> Confirm Registration & Book Room`;
            }
        });
    }

    // Save Category Pricing Form
    const pricingForm = document.getElementById('form-save-pricing');
    if (pricingForm) {
        pricingForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const payload = {
                room_type: document.getElementById('pricing-edit-type').value,
                ac_type: document.getElementById('pricing-edit-ac').value,
                monthly_rent: parseFloat(document.getElementById('pricing-input-rent').value),
                deposit_amount: parseFloat(document.getElementById('pricing-input-deposit').value)
            };

            try {
                const res = await fetch('/api/pricing', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                const data = await res.json();
                if (data.success) {
                    closeModal('modal-pricing-edit');
                    showToast(data.message, 'success');
                    await loadPricing();
                    if (window.loadRooms) loadRooms();
                    if (window.loadPortal) loadPortal();
                }
            } catch (err) {
                showToast('Failed to update pricing rule', 'danger');
            }
        });
    }
});

function displayRegistrationReceipt(result, customer) {
    const container = document.getElementById('receipt-modal-content');
    const today = new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });

    container.innerHTML = `
        <div class="receipt-box">
            <div class="receipt-header">
                <div>
                    <div class="receipt-brand-title">Nestora PG Management System</div>
                    <p style="font-size:0.85rem; color:#64748b;">Official Booking & Registration Acknowledgment</p>
                    <small style="color:#64748b;">Date: ${today} | Customer ID: #NES-CUST-${result.customer_id}</small>
                </div>
                <div class="receipt-stamp">
                    <i class="fa-solid fa-check-circle"></i> Confirmed & Occupied
                </div>
            </div>

            <div class="receipt-room-highlight">
                <div>
                    <h4 style="font-size:1.15rem; font-weight:800; color:#312e81; margin-bottom:0.25rem;">
                        Allocated Room: ${result.room_number}
                    </h4>
                    <p style="font-size:0.85rem; color:#4338ca;">
                        ${result.room_type} Room (${result.ac_type}) - High-Speed Wi-Fi & Food Included
                    </p>
                </div>
                <div style="text-align:right;">
                    <span style="font-size:1.35rem; font-weight:800; color:#312e81;">₹${result.price_monthly.toLocaleString()}</span>
                    <small style="display:block; color:#4338ca;">/ month</small>
                </div>
            </div>

            <div class="receipt-details-grid">
                <div>
                    <h5 style="font-weight:700; color:#0f172a; margin-bottom:0.4rem;">Customer Information:</h5>
                    <p><strong>Name:</strong> ${customer.name}</p>
                    <p><strong>Mobile:</strong> ${customer.mobile}</p>
                    <p><strong>Email:</strong> ${customer.email}</p>
                    <p><strong>Occupation:</strong> ${customer.occupation}</p>
                </div>
                <div>
                    <h5 style="font-weight:700; color:#0f172a; margin-bottom:0.4rem;">Tenancy Terms:</h5>
                    <p><strong>Move-in Date:</strong> ${customer.joining_date}</p>
                    <p><strong>Security Deposit:</strong> ₹${result.deposit_amount.toLocaleString()}</p>
                    <p><strong>Emergency Contact:</strong> ${customer.emergency_contact}</p>
                    <p><strong>Room Status:</strong> Automatically set to <span style="color:#ef4444; font-weight:700;">Occupied</span></p>
                </div>
            </div>

            <div style="background:#f8fafc; border-radius:6px; padding:0.75rem; border:1px solid #e2e8f0; font-size:0.8rem; color:#64748b; text-align:center;">
                All booking and registration records have been saved persistently to the database.
            </div>
        </div>
    `;

    openModal('modal-receipt');
}

window.loadPortal = loadPortal;
window.loadPricing = loadPricing;
window.loadPortalAvailableRooms = loadPortalAvailableRooms;
window.openEditPricingModal = openEditPricingModal;
