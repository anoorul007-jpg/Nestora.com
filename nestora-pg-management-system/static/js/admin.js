// Nestora - Administrator Control Center, Room CRUD & Resident Lifecycle

document.addEventListener('DOMContentLoaded', () => {
    initAdminNavigation();
    initAdminForms();
});

// Initialize Admin Navigation & Tabs
function initAdminNavigation() {
    document.querySelectorAll('.admin-nav-item[data-admin-tab]').forEach(item => {
        item.addEventListener('click', () => {
            const tabId = item.getAttribute('data-admin-tab');
            switchAdminTab(tabId);
        });
    });
}

// Switch between Admin Tabs
function switchAdminTab(tabId) {
    // Nav items
    document.querySelectorAll('.admin-nav-item').forEach(el => el.classList.remove('active'));
    const targetNav = document.querySelector(`.admin-nav-item[data-admin-tab="${tabId}"]`);
    if (targetNav) targetNav.classList.add('active');

    // Tab content sections
    document.querySelectorAll('.admin-tab-content').forEach(el => el.classList.remove('active'));
    const targetTab = document.getElementById(tabId);
    if (targetTab) targetTab.classList.add('active');

    // Update Topbar Title
    const heading = document.getElementById('admin-section-heading');
    if (heading) {
        const titles = {
            'admin-tab-overview': 'Overview Dashboard',
            'admin-tab-rooms': 'Room Management',
            'admin-tab-bookings': 'Bookings & Check-in Control',
            'admin-tab-customers': 'Customer & Resident Directory',
            'admin-tab-audit': 'Security & Operational Audit Trail'
        };
        heading.textContent = titles[tabId] || 'Admin Portal';
    }

    // Load data for active tab
    if (tabId === 'admin-tab-overview') loadAdminDashboard();
    else if (tabId === 'admin-tab-rooms') loadAdminRooms();
    else if (tabId === 'admin-tab-bookings') loadAdminBookings();
    else if (tabId === 'admin-tab-customers') loadAdminCustomers();
    else if (tabId === 'admin-tab-audit') loadAdminAuditLogs();
}

// Admin Panel View Toggle
async function openAdminModal() {
    try {
        const res = await fetch('/api/admin/check-session');
        const data = await res.json();

        if (data.logged_in) {
            showAdminPanelView();
            switchAdminTab('admin-tab-overview');
        } else {
            openModal('modal-admin-login');
            setTimeout(() => {
                const userField = document.getElementById('adm-user');
                if (userField) userField.focus();
            }, 100);
        }
    } catch (err) {
        openModal('modal-admin-login');
    }
}

function showAdminPanelView() {
    document.getElementById('public-content').style.display = 'none';
    document.getElementById('public-navbar').style.display = 'none';
    document.getElementById('admin-panel-view').style.display = 'block';
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function closeAdminPanel() {
    document.getElementById('admin-panel-view').style.display = 'none';
    document.getElementById('public-content').style.display = 'block';
    document.getElementById('public-navbar').style.display = 'block';
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Check session on initial load
async function checkAdminSession() {
    try {
        const res = await fetch('/api/admin/check-session');
        const data = await res.json();
        if (data.logged_in) {
            console.log('Admin session active:', data.admin?.username);
        }
    } catch (err) {
        // ignore
    }
}

// Forms Initialization
function initAdminForms() {
    // 1. Admin Login Form
    const loginForm = document.getElementById('form-admin-login');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('adm-user').value.trim();
            const password = document.getElementById('adm-pass').value.trim();

            try {
                const res = await fetch('/api/admin/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });
                const data = await res.json();

                if (data.success) {
                    showToast(`Welcome back, ${data.admin?.full_name || 'Administrator'}!`, 'success');
                    closeModal('modal-admin-login');
                    loginForm.reset();
                    showAdminPanelView();
                    switchAdminTab('admin-tab-overview');
                } else {
                    showToast(data.message || 'Invalid administrator credentials', 'danger');
                }
            } catch (err) {
                showToast('Login request failed', 'danger');
            }
        });
    }

    // 2. Add / Edit Room Form
    const saveRoomForm = document.getElementById('form-admin-save-room');
    if (saveRoomForm) {
        saveRoomForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await handleSaveRoomSubmit();
        });
    }
}

// Admin Logout
async function handleAdminLogout() {
    try {
        await fetch('/api/admin/logout', { method: 'POST' });
        showToast('Signed out of Administrator Portal', 'info');
        closeAdminPanel();
    } catch (err) {
        closeAdminPanel();
    }
}

// ==========================================
// 1. OVERVIEW DASHBOARD
// ==========================================
async function loadAdminDashboard() {
    try {
        const res = await fetch('/api/admin/dashboard');
        if (!res.ok) {
            if (res.status === 401) {
                closeAdminPanel();
                openModal('modal-admin-login');
            }
            return;
        }

        const data = await res.json();
        const m = data.metrics || {};

        document.getElementById('adm-total-rooms').textContent = m.total_rooms || 0;
        document.getElementById('adm-available-rooms').textContent = m.available_rooms || 0;
        document.getElementById('adm-occupied-rooms').textContent = m.occupied_rooms || 0;
        document.getElementById('adm-pending-bookings').textContent = m.pending_bookings || 0;
        document.getElementById('adm-active-residents').textContent = m.active_residencies || 0;
        document.getElementById('adm-monthly-revenue').textContent = `₹${Number(m.monthly_revenue || 0).toLocaleString()}`;

        // Populate Recent Bookings Table
        const tbody = document.getElementById('adm-recent-bookings-tbody');
        if (tbody) {
            const bookings = data.recent_bookings || [];
            if (bookings.length === 0) {
                tbody.innerHTML = `<tr><td colspan="7" class="text-center p-3 text-muted">No recent bookings recorded.</td></tr>`;
            } else {
                tbody.innerHTML = bookings.map(b => `
                    <tr>
                        <td><strong>${b.booking_reference}</strong></td>
                        <td>${escapeHtml(b.customer_name)}</td>
                        <td><i class="fa-solid fa-circle-check text-success"></i> ${b.customer_mobile}</td>
                        <td>Room ${b.room_number} <small class="text-muted">(${b.room_type} ${b.ac_type})</small></td>
                        <td>${formatDate(b.move_in_date)}</td>
                        <td><span class="badge-pill ${getBadgeClass(b.status)}">${b.status}</span></td>
                        <td>
                            <div class="action-btn-group">
                                ${b.status === 'Pending' ? `
                                    <button class="btn btn-success btn-xs" title="Approve Booking" onclick="handleBookingAction(${b.id}, 'approve')">
                                        <i class="fa-solid fa-check"></i>
                                    </button>
                                    <button class="btn btn-danger btn-xs" title="Reject Booking" onclick="handleBookingAction(${b.id}, 'reject')">
                                        <i class="fa-solid fa-xmark"></i>
                                    </button>
                                ` : ''}
                                ${b.status === 'Confirmed' ? `
                                    <button class="btn btn-primary btn-xs" title="Check-In Resident" onclick="handleBookingAction(${b.id}, 'check-in')">
                                        <i class="fa-solid fa-key"></i> Check In
                                    </button>
                                ` : ''}
                                ${b.status === 'Occupied' ? `
                                    <button class="btn btn-warning btn-xs" title="Vacate Room" onclick="handleBookingAction(${b.id}, 'checkout')">
                                        <i class="fa-solid fa-arrow-right-from-bracket"></i> Vacate
                                    </button>
                                ` : ''}
                                <button class="btn btn-secondary btn-xs" title="View Details / Receipt" onclick="viewBookingDetailsById(${b.id})">
                                    <i class="fa-solid fa-eye"></i>
                                </button>
                            </div>
                        </td>
                    </tr>
                `).join('');
            }
        }
    } catch (err) {
        console.error('Failed to load admin dashboard:', err);
    }
}

// ==========================================
// 2. ROOM INVENTORY MANAGEMENT
// ==========================================
async function loadAdminRooms() {
    const tbody = document.getElementById('adm-rooms-tbody');
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="9" class="text-center p-3"><i class="fa-solid fa-spinner fa-spin text-primary"></i> Loading rooms...</td></tr>`;

    try {
        const res = await fetch('/api/public/rooms');
        const rooms = await res.json();

        if (rooms.length === 0) {
            tbody.innerHTML = `<tr><td colspan="9" class="text-center p-3 text-muted">No rooms currently in inventory. Click "Add New Room" above.</td></tr>`;
            return;
        }

        tbody.innerHTML = rooms.map(r => `
            <tr>
                <td><strong>Room ${r.room_number}</strong></td>
                <td>
                    <img src="${r.primary_image || 'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&w=120&q=80'}" 
                         alt="Room ${r.room_number}" class="table-thumb"
                         onerror="this.src='https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&w=120&q=80'">
                </td>
                <td>${r.room_type} Room</td>
                <td><span class="badge ${r.ac_type === 'AC' ? 'badge-primary' : 'badge-secondary'}">${r.ac_type}</span></td>
                <td>${r.bathroom_type}</td>
                <td><strong>₹${Number(r.price_monthly).toLocaleString()}</strong> / mo</td>
                <td>₹${Number(r.deposit_amount).toLocaleString()}</td>
                <td><span class="badge-pill ${getBadgeClass(r.status)}">${r.status}</span></td>
                <td>
                    <div class="action-btn-group">
                        <button class="btn btn-secondary btn-xs" title="Edit Room" onclick="openEditRoomModal(${r.id})">
                            <i class="fa-solid fa-pen-to-square"></i> Edit
                        </button>
                        <button class="btn btn-danger btn-xs" title="Delete Room" onclick="handleDeleteRoom(${r.id}, '${r.room_number}')" ${r.status === 'Occupied' ? 'disabled' : ''}>
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="9" class="text-center p-3 text-danger">Failed to load rooms.</td></tr>`;
    }
}

// Add Room Modal Opener
function openAddRoomModal() {
    const form = document.getElementById('form-admin-save-room');
    if (form) form.reset();

    document.getElementById('adm-room-edit-id').value = '';
    document.getElementById('adm-room-modal-title').innerHTML = `<i class="fa-solid fa-bed"></i> Add PG Room`;
    openModal('modal-admin-room');
}

// Edit Room Modal Opener
async function openEditRoomModal(roomId) {
    try {
        const res = await fetch(`/api/public/rooms/${roomId}`);
        if (!res.ok) throw new Error('Room not found');
        const r = await res.json();

        document.getElementById('adm-room-edit-id').value = r.id;
        document.getElementById('adm-room-num').value = r.room_number;
        document.getElementById('adm-room-type').value = r.room_type;
        document.getElementById('adm-room-ac').value = r.ac_type;
        document.getElementById('adm-room-bath').value = r.bathroom_type;
        document.getElementById('adm-room-rent').value = r.price_monthly;
        document.getElementById('adm-room-deposit').value = r.deposit_amount;
        document.getElementById('adm-room-status').value = r.status;
        document.getElementById('adm-room-image-url').value = r.primary_image || '';
        document.getElementById('adm-room-facilities').value = r.facilities || '';

        document.getElementById('adm-room-modal-title').innerHTML = `<i class="fa-solid fa-pen-to-square"></i> Edit Room ${r.room_number}`;
        openModal('modal-admin-room');
    } catch (err) {
        showToast('Failed to load room details for editing', 'danger');
    }
}

// Save Room (Add or Edit) Submit Handler
async function handleSaveRoomSubmit() {
    const editId = document.getElementById('adm-room-edit-id').value;
    const fileInput = document.getElementById('adm-room-image-file');

    const roomData = {
        room_number: document.getElementById('adm-room-num').value.trim().toUpperCase(),
        room_type: document.getElementById('adm-room-type').value,
        ac_type: document.getElementById('adm-room-ac').value,
        bathroom_type: document.getElementById('adm-room-bath').value,
        price_monthly: parseFloat(document.getElementById('adm-room-rent').value) || 0,
        deposit_amount: parseFloat(document.getElementById('adm-room-deposit').value) || 0,
        status: document.getElementById('adm-room-status').value,
        facilities: document.getElementById('adm-room-facilities').value.trim(),
        primary_image: document.getElementById('adm-room-image-url').value.trim(),
        beds_count: document.getElementById('adm-room-type').value === 'Double' ? 2 : 1,
        max_occupancy: document.getElementById('adm-room-type').value === 'Double' ? 2 : 1
    };

    try {
        let res;
        if (editId) {
            // Update Room (PUT)
            res = await fetch(`/api/admin/rooms/${editId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(roomData)
            });
        } else {
            // Add Room (POST) - with multipart support if file is chosen
            if (fileInput && fileInput.files.length > 0) {
                const formData = new FormData();
                for (const key in roomData) {
                    formData.append(key, roomData[key]);
                }
                formData.append('image_file', fileInput.files[0]);

                res = await fetch('/api/admin/rooms', {
                    method: 'POST',
                    body: formData
                });
            } else {
                res = await fetch('/api/admin/rooms', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(roomData)
                });
            }
        }

        const data = await res.json();
        if (data.success) {
            showToast(data.message, 'success');
            closeModal('modal-admin-room');
            loadAdminRooms();
            loadAdminDashboard();
            if (window.loadPublicRooms) window.loadPublicRooms();
            if (window.loadCategoriesSummary) window.loadCategoriesSummary();
        } else {
            showToast(data.message || 'Operation failed', 'danger');
        }
    } catch (err) {
        showToast('Error saving room details', 'danger');
    }
}

// Delete Room Handler
async function handleDeleteRoom(roomId, roomNumber) {
    if (!confirm(`Are you sure you want to permanently delete Room ${roomNumber}? This cannot be undone.`)) {
        return;
    }

    try {
        const res = await fetch(`/api/admin/rooms/${roomId}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
            showToast(data.message, 'success');
            loadAdminRooms();
            loadAdminDashboard();
            if (window.loadPublicRooms) window.loadPublicRooms();
            if (window.loadCategoriesSummary) window.loadCategoriesSummary();
        } else {
            showToast(data.message || 'Could not delete room', 'danger');
        }
    } catch (err) {
        showToast('Error deleting room', 'danger');
    }
}

// ==========================================
// 3. BOOKINGS MANAGEMENT & RESIDENT LIFECYCLE
// ==========================================
async function loadAdminBookings() {
    const tbody = document.getElementById('adm-all-bookings-tbody');
    if (!tbody) return;

    const statusFilter = document.getElementById('adm-booking-filter-status')?.value || 'All';
    tbody.innerHTML = `<tr><td colspan="8" class="text-center p-3"><i class="fa-solid fa-spinner fa-spin text-primary"></i> Loading applications...</td></tr>`;

    try {
        const res = await fetch(`/api/admin/bookings?status=${statusFilter}`);
        const bookings = await res.json();

        if (bookings.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" class="text-center p-3 text-muted">No bookings found for the selected filter.</td></tr>`;
            return;
        }

        tbody.innerHTML = bookings.map(b => `
            <tr>
                <td>
                    <strong>${b.booking_reference}</strong>
                    <div style="font-size:0.75rem; color:#64748b;">${formatDate(b.created_at)}</div>
                </td>
                <td>
                    <div style="font-weight:700;">${escapeHtml(b.customer_name)}</div>
                    <div style="font-size:0.8rem; color:#475569;"><i class="fa-solid fa-phone text-muted"></i> ${b.customer_mobile}</div>
                    <div style="font-size:0.78rem; color:#64748b;">${escapeHtml(b.customer_email || '')}</div>
                </td>
                <td>
                    <div style="font-weight:700;">Room ${b.room_number}</div>
                    <div style="font-size:0.8rem; color:#64748b;">${b.room_type} (${b.ac_type})</div>
                </td>
                <td>
                    <div><strong>₹${Number(b.monthly_rent || 0).toLocaleString()}</strong> / mo</div>
                    <small style="color:#64748b;">Dep: ₹${Number(b.security_deposit || 0).toLocaleString()}</small>
                </td>
                <td>
                    <div>${formatDate(b.move_in_date)}</div>
                    <small style="color:#64748b;">${b.stay_duration_months || 6} mo duration</small>
                </td>
                <td>
                    <div style="font-size:0.85rem;">${escapeHtml(b.emergency_name)}</div>
                    <small style="color:#64748b;">${b.emergency_phone}</small>
                </td>
                <td>
                    <span class="badge-pill ${getBadgeClass(b.status)}">${b.status}</span>
                </td>
                <td>
                    <div class="action-btn-group">
                        ${b.status === 'Pending' ? `
                            <button class="btn btn-success btn-xs" onclick="handleBookingAction(${b.id}, 'approve')" title="Approve Reservation">
                                <i class="fa-solid fa-check"></i> Approve
                            </button>
                            <button class="btn btn-danger btn-xs" onclick="handleBookingAction(${b.id}, 'reject')" title="Reject Application">
                                <i class="fa-solid fa-xmark"></i> Reject
                            </button>
                        ` : ''}
                        ${b.status === 'Confirmed' ? `
                            <button class="btn btn-primary btn-xs" onclick="handleBookingAction(${b.id}, 'check-in')" title="Check In Resident Today">
                                <i class="fa-solid fa-door-open"></i> Check In
                            </button>
                        ` : ''}
                        ${b.status === 'Occupied' ? `
                            <button class="btn btn-warning btn-xs" onclick="handleBookingAction(${b.id}, 'checkout')" title="Checkout Resident & Handover Room">
                                <i class="fa-solid fa-arrow-right-from-bracket"></i> Vacate
                            </button>
                        ` : ''}
                        <button class="btn btn-secondary btn-xs" onclick="viewBookingDetailsById(${b.id})" title="Print Receipt">
                            <i class="fa-solid fa-receipt"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center p-3 text-danger">Failed to load bookings list.</td></tr>`;
    }
}

// Booking State Transition Action (Approve, Reject, Check-In, Checkout)
async function handleBookingAction(bookingId, action) {
    let confirmMsg = '';
    let payload = {};

    if (action === 'approve') confirmMsg = 'Confirm this booking reservation? Room will be locked for the applicant.';
    else if (action === 'reject') confirmMsg = 'Reject this booking reservation? Room will immediately become Available on the public portal.';
    else if (action === 'check-in') confirmMsg = 'Confirm physical check-in of the resident today? Room will be marked as Occupied.';
    else if (action === 'checkout') {
        const notes = prompt('Resident Checkout: Enter checkout notes, security deposit settlement details, or room condition handover remarks:');
        if (notes === null) return;
        payload = { notes: notes.trim() || 'Room vacated in good condition. Deposit settled.' };
        confirmMsg = 'Confirm checkout? The resident stay will be archived in booking history, and the room will immediately be released to Available for new bookings.';
    }

    if (confirmMsg && !confirm(confirmMsg)) return;

    try {
        const res = await fetch(`/api/admin/bookings/${bookingId}/${action}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();

        if (data.success) {
            showToast(data.message, 'success');
            loadAdminBookings();
            loadAdminDashboard();
            loadAdminRooms();
            if (window.loadPublicRooms) window.loadPublicRooms();
            if (window.loadCategoriesSummary) window.loadCategoriesSummary();
        } else {
            showToast(data.message || 'Operation failed', 'danger');
        }
    } catch (err) {
        showToast('Error updating booking status', 'danger');
    }
}

// View details / receipt by booking ID
async function viewBookingDetailsById(bookingId) {
    try {
        const res = await fetch('/api/admin/bookings');
        const list = await res.json();
        const b = list.find(item => item.id === bookingId);
        if (b && window.renderAndShowReceipt) {
            window.renderAndShowReceipt(b);
        } else {
            showToast('Unable to load receipt details', 'danger');
        }
    } catch (err) {
        showToast('Error loading receipt', 'danger');
    }
}

// ==========================================
// 4. CUSTOMER DIRECTORY
// ==========================================
let customerSearchTimeout = null;
function handleCustomerSearchInput() {
    clearTimeout(customerSearchTimeout);
    customerSearchTimeout = setTimeout(() => {
        loadAdminCustomers();
    }, 300);
}

async function loadAdminCustomers() {
    const tbody = document.getElementById('adm-customers-tbody');
    if (!tbody) return;

    const query = document.getElementById('adm-customer-search')?.value.trim() || '';
    tbody.innerHTML = `<tr><td colspan="7" class="text-center p-3"><i class="fa-solid fa-spinner fa-spin text-primary"></i> Searching directory...</td></tr>`;

    try {
        const res = await fetch(`/api/admin/customers?search=${encodeURIComponent(query)}`);
        const customers = await res.json();

        if (customers.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center p-3 text-muted">No customers matching "${escapeHtml(query)}".</td></tr>`;
            return;
        }

        tbody.innerHTML = customers.map(c => `
            <tr>
                <td>
                    <div style="font-weight:700;">${escapeHtml(c.name)}</div>
                    <small style="color:#64748b;">Joined: ${formatDate(c.created_at)}</small>
                </td>
                <td>
                    <div><i class="fa-solid fa-shield-check text-success"></i> ${c.mobile}</div>
                    <div style="font-size:0.8rem; color:#64748b;">${escapeHtml(c.email || 'N/A')}</div>
                </td>
                <td>${escapeHtml(c.college_company || 'N/A')}</td>
                <td>
                    ${c.current_room ? `
                        <span class="badge badge-primary">Room ${c.current_room}</span>
                        <div style="font-size:0.75rem; color:#64748b;">Ref: ${c.booking_ref || ''}</div>
                    ` : '<span class="text-muted">No Active Stay</span>'}
                </td>
                <td>
                    <small style="color:#475569; max-width:200px; display:inline-block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${escapeHtml(c.address || '')}">
                        ${escapeHtml(c.address || 'N/A')}
                    </small>
                </td>
                <td>
                    <div style="font-size:0.85rem;">${escapeHtml(c.emergency_name || 'N/A')}</div>
                    <small style="color:#64748b;">${c.emergency_phone || ''}</small>
                </td>
                <td>
                    <span class="badge-pill ${c.stay_status === 'Active Resident' ? 'pill-occupied' : 'pill-vacated'}">
                        ${c.stay_status}
                    </span>
                </td>
            </tr>
        `).join('');
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center p-3 text-danger">Failed to load customer directory.</td></tr>`;
    }
}

// ==========================================
// 5. AUDIT LOGS
// ==========================================
async function loadAdminAuditLogs() {
    const tbody = document.getElementById('adm-audit-tbody');
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="6" class="text-center p-3"><i class="fa-solid fa-spinner fa-spin text-primary"></i> Fetching audit trail...</td></tr>`;

    try {
        const res = await fetch('/api/admin/audit-logs');
        const logs = await res.json();

        if (logs.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="text-center p-3 text-muted">No audit logs recorded yet.</td></tr>`;
            return;
        }

        tbody.innerHTML = logs.map(l => `
            <tr>
                <td style="font-size:0.8rem; color:#64748b;">${formatDateTime(l.created_at)}</td>
                <td><span class="badge ${l.actor_type === 'Admin' ? 'badge-primary' : 'badge-secondary'}">${l.actor_type}</span></td>
                <td><strong>${escapeHtml(l.actor_id)}</strong></td>
                <td><code style="font-weight:700; color:#4f46e5;">${escapeHtml(l.action)}</code></td>
                <td><small style="color:#334155;">${escapeHtml(l.details || '')}</small></td>
                <td><small style="font-family:monospace; color:#64748b;">${l.ip_address || '127.0.0.1'}</small></td>
            </tr>
        `).join('');
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center p-3 text-danger">Failed to load audit logs.</td></tr>`;
    }
}

// 6. CSV Report Export
function exportAdminReport() {
    window.location.href = '/api/admin/export-report';
}

// Helper: Badge class mapper
function getBadgeClass(status) {
    switch (status) {
        case 'Available': return 'pill-available';
        case 'Pending': return 'pill-pending';
        case 'Confirmed': return 'pill-confirmed';
        case 'Occupied': return 'pill-occupied';
        case 'Vacated': return 'pill-vacated';
        case 'Cancelled': return 'pill-cancelled';
        case 'Maintenance': return 'pill-maintenance';
        default: return 'pill-secondary';
    }
}

// Helper: Format DateTime
function formatDateTime(str) {
    if (!str) return 'N/A';
    try {
        const d = new Date(str);
        if (isNaN(d.getTime())) return str;
        return d.toLocaleString('en-IN', {
            day: '2-digit', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit', second: '2-digit'
        });
    } catch {
        return str;
    }
}

// Expose on window
window.openAdminModal = openAdminModal;
window.closeAdminPanel = closeAdminPanel;
window.switchAdminTab = switchAdminTab;
window.checkAdminSession = checkAdminSession;
window.handleAdminLogout = handleAdminLogout;
window.loadAdminDashboard = loadAdminDashboard;
window.loadAdminRooms = loadAdminRooms;
window.openAddRoomModal = openAddRoomModal;
window.openEditRoomModal = openEditRoomModal;
window.handleDeleteRoom = handleDeleteRoom;
window.loadAdminBookings = loadAdminBookings;
window.handleBookingAction = handleBookingAction;
window.viewBookingDetailsById = viewBookingDetailsById;
window.loadAdminCustomers = loadAdminCustomers;
window.loadAdminAuditLogs = loadAdminAuditLogs;
window.exportAdminReport = exportAdminReport;
