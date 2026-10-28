// Nestora - Admin Dashboard Analytics

async function loadDashboard() {
    await fetchDashboardMetrics();
    await fetchRecentRegistrations();
    await fetchRoomMatrix();
}

async function fetchDashboardMetrics() {
    try {
        const res = await fetch('/api/dashboard/stats');
        const stats = await res.json();

        document.getElementById('dash-total-rooms').textContent = stats.total_rooms;
        document.getElementById('dash-avail-rooms').textContent = stats.available_rooms;
        document.getElementById('dash-occupied-rooms').textContent = stats.occupied_rooms;
        document.getElementById('dash-active-customers').textContent = stats.active_customers;
        document.getElementById('dash-occupancy-rate').textContent = `${stats.occupancy_rate}%`;
        document.getElementById('dash-monthly-revenue').textContent = `₹${stats.monthly_revenue.toLocaleString()}`;
    } catch (err) {
        console.error('Failed to load dashboard metrics', err);
    }
}

async function fetchRecentRegistrations() {
    const tbody = document.getElementById('dash-recent-table-body');
    try {
        const res = await fetch('/api/dashboard/recent-registrations');
        const list = await res.json();

        if (list.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#94a3b8; padding:2rem;">No recent customer registrations found.</td></tr>`;
            return;
        }

        tbody.innerHTML = list.map(c => `
            <tr>
                <td>
                    <strong>${c.name}</strong><br>
                    <small style="color:#64748b;">${c.occupation}</small>
                </td>
                <td>
                    <i class="fa-solid fa-phone" style="font-size:0.75rem; color:#64748b;"></i> ${c.mobile}<br>
                    <small style="color:#64748b;">${c.email}</small>
                </td>
                <td>
                    ${c.room_number ? `
                        <span class="badge-pill pill-approved"><i class="fa-solid fa-door-closed"></i> ${c.room_number}</span>
                        <small style="color:#64748b; display:block;">${c.room_type} (${c.ac_type})</small>
                    ` : `<span style="color:#94a3b8;">Unassigned</span>`}
                </td>
                <td>${c.joining_date}</td>
                <td><strong>₹${(c.price_monthly || 0).toLocaleString()}</strong></td>
            </tr>
        `).join('');
    } catch (err) {
        console.error('Failed to load recent registrations', err);
    }
}

async function fetchRoomMatrix() {
    const container = document.getElementById('dash-room-matrix');
    try {
        const res = await fetch('/api/rooms');
        const rooms = await res.json();

        if (rooms.length === 0) {
            container.innerHTML = `<p style="grid-column:1/-1; text-align:center; color:#94a3b8;">No rooms added yet.</p>`;
            return;
        }

        container.innerHTML = rooms.map(r => {
            const statusClass = r.status.toLowerCase();
            return `
                <div class="matrix-room-box ${statusClass}" title="${r.room_number} - ${r.room_type} (${r.ac_type}) - ${r.status}">
                    <span class="matrix-room-num">${r.room_number}</span>
                    <span class="matrix-room-type">${r.room_type}</span>
                </div>
            `;
        }).join('');
    } catch (err) {
        console.error('Failed to load room matrix', err);
    }
}

window.loadDashboard = loadDashboard;
