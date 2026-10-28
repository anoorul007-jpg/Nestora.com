// Nestora - Room Management CRUD & Filters

async function loadRooms() {
    const category = document.getElementById('filter-room-category').value;
    const ac = document.getElementById('filter-room-ac').value;
    const status = document.getElementById('filter-room-status').value;
    const search = document.getElementById('filter-room-search').value.trim();

    const params = new URLSearchParams({
        room_type: category,
        ac_type: ac,
        status: status,
        search: search
    });

    try {
        const res = await fetch(`/api/rooms?${params.toString()}`);
        const rooms = await res.json();
        renderRoomsTable(rooms);
    } catch (err) {
        console.error('Failed to load rooms', err);
    }
}

function renderRoomsTable(rooms) {
    const tbody = document.getElementById('rooms-table-body');
    if (!tbody) return;

    if (rooms.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:#94a3b8; padding:3rem;">No rooms matched your criteria.</td></tr>`;
        return;
    }

    tbody.innerHTML = rooms.map(r => {
        const statusClass = r.status === 'Available' ? 'pill-available' :
                           r.status === 'Occupied' ? 'pill-occupied' : 'pill-maintenance';

        return `
            <tr>
                <td><strong>${r.room_number}</strong></td>
                <td><span class="tag-cat">${r.room_type} Room</span></td>
                <td><span class="tag-ac">${r.ac_type}</span></td>
                <td><strong>₹${r.price_monthly.toLocaleString()}</strong> / mo</td>
                <td>₹${r.deposit_amount.toLocaleString()}</td>
                <td><small style="color:#64748b;">${r.facilities || 'Standard Room'}</small></td>
                <td>
                    <span class="badge-pill ${statusClass}">
                        <i class="fa-solid fa-circle" style="font-size:0.5rem;"></i> ${r.status}
                    </span>
                </td>
                <td>
                    <button class="btn btn-secondary btn-xs" onclick="openEditRoomModal(${r.id})" title="Edit Room">
                        <i class="fa-solid fa-pen"></i> Edit
                    </button>
                    <button class="btn btn-danger btn-xs" onclick="deleteRoom(${r.id}, '${r.room_number}')" title="Delete Room">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

function openAddRoomModal() {
    document.getElementById('modal-room-title').innerHTML = `<i class="fa-solid fa-bed"></i> Add New PG Room`;
    document.getElementById('form-save-room').reset();
    document.getElementById('room-edit-id').value = '';

    // Auto-fill pricing from selected category defaults if available
    updateModalPriceDefaults();

    openModal('modal-room');
}

async function openEditRoomModal(roomId) {
    try {
        const res = await fetch(`/api/rooms/${roomId}`);
        const r = await res.json();

        document.getElementById('modal-room-title').innerHTML = `<i class="fa-solid fa-pen-to-square"></i> Edit Room ${r.room_number}`;
        document.getElementById('room-edit-id').value = r.id;
        document.getElementById('room-input-number').value = r.room_number;
        document.getElementById('room-input-category').value = r.room_type;
        document.getElementById('room-input-ac').value = r.ac_type;
        document.getElementById('room-input-status').value = r.status;
        document.getElementById('room-input-rent').value = r.price_monthly;
        document.getElementById('room-input-deposit').value = r.deposit_amount;
        document.getElementById('room-input-facilities').value = r.facilities || '';

        openModal('modal-room');
    } catch (err) {
        showToast('Failed to load room details', 'danger');
    }
}

async function deleteRoom(roomId, roomNumber) {
    if (!confirm(`Are you sure you want to delete room ${roomNumber}? This cannot be undone.`)) return;

    try {
        const res = await fetch(`/api/rooms/${roomId}`, { method: 'DELETE' });
        const data = await res.json();

        if (data.success) {
            showToast(`Room ${roomNumber} deleted successfully`, 'success');
            loadRooms();
            if (window.loadDashboard) loadDashboard();
        } else {
            showToast(data.message, 'danger');
        }
    } catch (err) {
        showToast('Error deleting room', 'danger');
    }
}

function updateModalPriceDefaults() {
    const cat = document.getElementById('room-input-category').value;
    const ac = document.getElementById('room-input-ac').value;

    const defaults = {
        'Single_AC': { rent: 12500, deposit: 20000 },
        'Single_Non-AC': { rent: 9000, deposit: 15000 },
        'Double_AC': { rent: 8000, deposit: 12000 },
        'Double_Non-AC': { rent: 6000, deposit: 10000 }
    };

    const key = `${cat}_${ac}`;
    if (defaults[key]) {
        document.getElementById('room-input-rent').value = defaults[key].rent;
        document.getElementById('room-input-deposit').value = defaults[key].deposit;
    }
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    // Room Filter Triggers
    ['filter-room-category', 'filter-room-ac', 'filter-room-status'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', loadRooms);
    });

    const searchInput = document.getElementById('filter-room-search');
    if (searchInput) {
        let debounceTimer;
        searchInput.addEventListener('input', () => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(loadRooms, 300);
        });
    }

    // Modal category/ac change defaults
    ['room-input-category', 'room-input-ac'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('change', () => {
                if (!document.getElementById('room-edit-id').value) {
                    updateModalPriceDefaults();
                }
            });
        }
    });

    // Save Room Form (Add / Edit)
    const formSaveRoom = document.getElementById('form-save-room');
    if (formSaveRoom) {
        formSaveRoom.addEventListener('submit', async (e) => {
            e.preventDefault();
            const editId = document.getElementById('room-edit-id').value;

            const payload = {
                room_number: document.getElementById('room-input-number').value.trim(),
                room_type: document.getElementById('room-input-category').value,
                ac_type: document.getElementById('room-input-ac').value,
                status: document.getElementById('room-input-status').value,
                price_monthly: parseFloat(document.getElementById('room-input-rent').value),
                deposit_amount: parseFloat(document.getElementById('room-input-deposit').value),
                facilities: document.getElementById('room-input-facilities').value.trim()
            };

            try {
                let res;
                if (editId) {
                    res = await fetch(`/api/rooms/${editId}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });
                } else {
                    res = await fetch('/api/rooms', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });
                }

                const data = await res.json();
                if (data.success) {
                    closeModal('modal-room');
                    showToast(data.message, 'success');
                    loadRooms();
                    if (window.loadDashboard) loadDashboard();
                } else {
                    showToast(data.message || 'Failed to save room', 'danger');
                }
            } catch (err) {
                showToast('Network error saving room', 'danger');
            }
        });
    }
});

window.loadRooms = loadRooms;
window.openAddRoomModal = openAddRoomModal;
window.openEditRoomModal = openEditRoomModal;
window.deleteRoom = deleteRoom;
