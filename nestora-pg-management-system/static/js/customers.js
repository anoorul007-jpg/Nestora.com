// Nestora - Customer Management & Automatic Room Vacating

async function loadCustomers() {
    const status = document.getElementById('filter-customer-status').value;
    const search = document.getElementById('filter-customer-search').value.trim();

    const params = new URLSearchParams({
        status: status,
        search: search
    });

    try {
        const res = await fetch(`/api/customers?${params.toString()}`);
        const customers = await res.json();
        renderCustomersTable(customers);
    } catch (err) {
        console.error('Failed to load customers', err);
    }
}

function renderCustomersTable(customers) {
    const tbody = document.getElementById('customers-table-body');
    if (!tbody) return;

    if (customers.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; color:#94a3b8; padding:3rem;">No customer records found.</td></tr>`;
        return;
    }

    tbody.innerHTML = customers.map(c => {
        const statusClass = c.status === 'Active' ? 'pill-active' : 'pill-vacated';

        return `
            <tr>
                <td>
                    <strong>${c.name}</strong><br>
                    <small style="color:#64748b;">${c.email}</small>
                </td>
                <td>
                    <i class="fa-solid fa-phone" style="font-size:0.75rem; color:#64748b;"></i> <strong>${c.mobile}</strong>
                </td>
                <td>
                    <span>${c.gender}</span><br>
                    <small style="color:#64748b;">DOB: ${c.dob}</small>
                </td>
                <td>${c.occupation}</td>
                <td>
                    ${c.room_number ? `
                        <span class="badge-pill pill-approved"><i class="fa-solid fa-door-closed"></i> ${c.room_number}</span><br>
                        <small style="color:#64748b;">${c.room_type} (${c.ac_type}) - ₹${c.price_monthly}/mo</small>
                    ` : `<span style="color:#94a3b8;">No Active Room</span>`}
                </td>
                <td>${c.joining_date}</td>
                <td>
                    <small style="color:#475569;"><i class="fa-solid fa-shield-halved" style="color:#ef4444;"></i> ${c.emergency_contact}</small>
                </td>
                <td>
                    <span class="badge-pill ${statusClass}">
                        <i class="fa-solid fa-circle" style="font-size:0.5rem;"></i> ${c.status}
                    </span>
                    ${c.vacating_date ? `<br><small style="color:#64748b;">Vacated: ${c.vacating_date}</small>` : ''}
                </td>
                <td>
                    <div style="display:flex; gap:0.35rem;">
                        <button class="btn btn-secondary btn-xs" onclick="viewCustomerProfile(${c.id})" title="View Profile">
                            <i class="fa-solid fa-id-card"></i> View
                        </button>
                        ${c.status === 'Active' ? `
                            <button class="btn btn-danger btn-xs" onclick="vacateCustomer(${c.id}, '${escapeHtml(c.name)}', '${c.room_number || ''}')" title="Mark Vacated & Free Room">
                                <i class="fa-solid fa-person-walking-arrow-right"></i> Vacate
                            </button>
                        ` : ''}
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/'/g, "\\'").replace(/"/g, "&quot;");
}

async function viewCustomerProfile(customerId) {
    try {
        const res = await fetch(`/api/customers/${customerId}`);
        const c = await res.json();

        const container = document.getElementById('customer-profile-content');
        container.innerHTML = `
            <div style="display:flex; align-items:center; gap:1.25rem; margin-bottom:1.5rem; background:#f8fafc; padding:1.25rem; border-radius:10px; border:1px solid #e2e8f0;">
                <div style="width:60px; height:60px; border-radius:50%; background:#e0e7ff; color:#4f46e5; display:flex; align-items:center; justify-content:center; font-size:1.8rem; font-weight:800;">
                    ${c.name.charAt(0)}
                </div>
                <div>
                    <h3 style="font-size:1.25rem; font-weight:800; color:#0f172a; margin-bottom:0.25rem;">${c.name}</h3>
                    <p style="font-size:0.85rem; color:#64748b; margin-bottom:0.4rem;">${c.occupation}</p>
                    <span class="badge-pill ${c.status === 'Active' ? 'pill-active' : 'pill-vacated'}">${c.status} Resident</span>
                </div>
            </div>

            <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem; font-size:0.88rem; margin-bottom:1.25rem;">
                <div><strong>Mobile:</strong> ${c.mobile}</div>
                <div><strong>Email:</strong> ${c.email}</div>
                <div><strong>Gender:</strong> ${c.gender}</div>
                <div><strong>Date of Birth:</strong> ${c.dob}</div>
                <div><strong>Joining Date:</strong> ${c.joining_date}</div>
                <div><strong>Vacating Date:</strong> ${c.vacating_date || 'Currently Active'}</div>
            </div>

            <div style="background:#fff; border:1px solid #e2e8f0; border-radius:8px; padding:1rem; margin-bottom:1rem; font-size:0.88rem;">
                <h4 style="font-size:0.9rem; font-weight:700; color:#1e293b; margin-bottom:0.4rem;"><i class="fa-solid fa-location-dot text-danger"></i> Permanent Address</h4>
                <p style="color:#475569;">${c.address}</p>
            </div>

            <div style="background:#fff; border:1px solid #e2e8f0; border-radius:8px; padding:1rem; margin-bottom:1rem; font-size:0.88rem;">
                <h4 style="font-size:0.9rem; font-weight:700; color:#1e293b; margin-bottom:0.4rem;"><i class="fa-solid fa-phone-volume text-danger"></i> Emergency Contact</h4>
                <p style="color:#475569;">${c.emergency_contact}</p>
            </div>

            ${c.room_number ? `
                <div style="background:#eef2ff; border:1px solid #c7d2fe; border-radius:8px; padding:1rem; font-size:0.88rem;">
                    <h4 style="font-size:0.9rem; font-weight:800; color:#3730a3; margin-bottom:0.4rem;"><i class="fa-solid fa-bed text-primary"></i> Allocated Room: ${c.room_number}</h4>
                    <p style="color:#4338ca;">Category: <strong>${c.room_type} Room (${c.ac_type})</strong> | Monthly Rent: <strong>₹${c.price_monthly.toLocaleString()}</strong></p>
                </div>
            ` : ''}
        `;

        openModal('modal-customer');
    } catch (err) {
        showToast('Could not load customer details', 'danger');
    }
}

// Automatic Room Availability: Vacating customer frees up the room immediately
async function vacateCustomer(customerId, customerName, roomNumber) {
    const confirmMessage = roomNumber
        ? `Are you sure you want to mark ${customerName} as Vacated?\n\nRoom ${roomNumber} will automatically be marked as AVAILABLE across the entire system!`
        : `Are you sure you want to mark ${customerName} as Vacated?`;

    if (!confirm(confirmMessage)) return;

    try {
        const res = await fetch(`/api/customers/${customerId}/vacate`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' }
        });

        const data = await res.json();
        if (data.success) {
            showToast(data.message, 'success');
            loadCustomers();
            if (window.loadRooms) loadRooms();
            if (window.loadDashboard) loadDashboard();
            if (window.loadPortalAvailableRooms) loadPortalAvailableRooms();
        } else {
            showToast(data.message || 'Failed to vacate customer', 'danger');
        }
    } catch (err) {
        showToast('Error processing vacate request', 'danger');
    }
}

// Event Listeners for Filters
document.addEventListener('DOMContentLoaded', () => {
    const statusSelect = document.getElementById('filter-customer-status');
    if (statusSelect) {
        statusSelect.addEventListener('change', loadCustomers);
    }

    const searchInput = document.getElementById('filter-customer-search');
    if (searchInput) {
        let debounceTimer;
        searchInput.addEventListener('input', () => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(loadCustomers, 300);
        });
    }
});

window.loadCustomers = loadCustomers;
window.viewCustomerProfile = viewCustomerProfile;
window.vacateCustomer = vacateCustomer;
