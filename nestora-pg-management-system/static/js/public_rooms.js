// Nestora - Public Rooms Browser, Category Summaries & Photo Gallery

let allPublicRooms = [];

async function loadCategoriesSummary() {
    const container = document.getElementById('categories-container');
    if (!container) return;

    try {
        const res = await fetch('/api/public/categories-summary');
        const categories = await res.json();

        container.innerHTML = categories.map(cat => `
            <div class="category-card">
                <div class="cat-header">
                    <span class="cat-badge">${cat.room_type} Room</span>
                    <span class="cat-ac ${cat.ac_type.toLowerCase()}">${cat.ac_type}</span>
                </div>
                <h3 class="cat-title">${cat.category_name}</h3>
                <p class="cat-desc">${cat.description}</p>
                <div class="cat-price-wrap">
                    <span class="cat-price">₹${cat.starting_rent.toLocaleString()}</span>
                    <small>/ month onwards</small>
                </div>
                <div class="cat-availability">
                    <i class="fa-solid fa-door-open text-success"></i>
                    <span><strong>${cat.available_rooms}</strong> of ${cat.total_rooms} rooms available</span>
                </div>
                <button class="btn btn-primary btn-block btn-sm mt-3" onclick="filterByCategory('${cat.room_type}', '${cat.ac_type}')">
                    <i class="fa-solid fa-magnifying-glass"></i> Explore ${cat.category_name}
                </button>
            </div>
        `).join('');
    } catch (err) {
        console.error('Failed to load category summaries', err);
    }
}

function filterByCategory(roomType, acType) {
    document.getElementById('pub-filter-category').value = roomType;
    document.getElementById('pub-filter-ac').value = acType;
    loadPublicRooms();
    scrollToSection('rooms-section');
}

async function loadPublicRooms() {
    const category = document.getElementById('pub-filter-category').value;
    const ac = document.getElementById('pub-filter-ac').value;
    const bathroom = document.getElementById('pub-filter-bathroom').value;
    const maxPrice = document.getElementById('pub-filter-rent').value;

    const params = new URLSearchParams({
        room_type: category,
        ac_type: ac,
        bathroom_type: bathroom,
        max_price: maxPrice
    });

    try {
        const res = await fetch(`/api/public/rooms?${params.toString()}`);
        allPublicRooms = await res.json();
        renderPublicRoomsGrid(allPublicRooms);
    } catch (err) {
        console.error('Failed to load public rooms', err);
    }
}

function renderPublicRoomsGrid(rooms) {
    const container = document.getElementById('public-rooms-container');
    const countEl = document.getElementById('available-rooms-count');
    if (!container) return;

    const availableCount = rooms.filter(r => r.status === 'Available').length;
    if (countEl) countEl.textContent = availableCount;

    if (rooms.length === 0) {
        container.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 4rem 1.5rem; background:#fff; border-radius:12px; border:1px solid #e2e8f0;">
                <i class="fa-solid fa-bed" style="font-size:3rem; color:#cbd5e1; margin-bottom:1rem;"></i>
                <h3 style="font-weight:800; color:#1e293b;">No rooms matched your selected filters</h3>
                <p style="color:#64748b; font-size:0.92rem;">Try adjusting the price slider or resetting category filters.</p>
                <button class="btn btn-secondary mt-3" onclick="document.getElementById('pub-reset-filters').click()">
                    <i class="fa-solid fa-rotate-left"></i> Reset All Filters
                </button>
            </div>
        `;
        return;
    }

    container.innerHTML = rooms.map(room => {
        const isAvailable = room.status === 'Available';
        const statusClass = isAvailable ? 'pill-available' :
                           room.status === 'Occupied' ? 'pill-occupied' :
                           room.status === 'Pending' ? 'pill-warning' : 'pill-maintenance';

        const facilitiesList = room.facilities
            ? room.facilities.split(',').slice(0, 4).map(f => `<span class="room-facility-chip"><i class="fa-solid fa-check"></i> ${f.trim()}</span>`).join('')
            : '<span class="room-facility-chip">Wi-Fi, Geyser, Wardrobe</span>';

        return `
            <div class="room-card">
                <div class="room-card-img-wrap">
                    <img src="${room.primary_image || 'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&w=700&q=80'}" alt="Room ${room.room_number}" class="room-card-img" loading="lazy">
                    <span class="badge-pill ${statusClass} room-status-badge">
                        <i class="fa-solid fa-circle" style="font-size:0.45rem;"></i> ${room.status}
                    </span>
                    <span class="room-category-badge">
                        ${room.room_type} Room (${room.ac_type})
                    </span>
                </div>
                <div class="room-card-body">
                    <div class="room-card-top">
                        <h3 class="room-card-title">Room ${room.room_number}</h3>
                        <span class="room-bath-tag"><i class="fa-solid fa-bath"></i> ${room.bathroom_type} Bath</span>
                    </div>

                    <div class="room-specs-row">
                        <span><i class="fa-solid fa-bed"></i> ${room.beds_count} Bed(s)</span>
                        <span><i class="fa-solid fa-users"></i> Max ${room.max_occupancy} Person(s)</span>
                    </div>

                    <div class="room-facilities-strip">
                        ${facilitiesList}
                    </div>

                    <div class="room-card-footer">
                        <div class="room-price-box">
                            <span class="room-price">₹${room.price_monthly.toLocaleString()}</span>
                            <small>/ month (Deposit: ₹${room.deposit_amount.toLocaleString()})</small>
                        </div>
                        <div class="room-card-actions">
                            <button class="btn btn-secondary btn-sm" onclick="viewRoomDetails(${room.id})" title="View Room Details">
                                Details
                            </button>
                            ${isAvailable ? `
                                <button class="btn btn-primary btn-sm" onclick="quickBookRoom(${room.id}, '${room.room_type}', '${room.ac_type}', '${room.room_number}')">
                                    <i class="fa-solid fa-calendar-check"></i> Book Now
                                </button>
                            ` : `
                                <button class="btn btn-secondary btn-sm" disabled style="opacity:0.6; cursor:not-allowed;">
                                    Unavailable
                                </button>
                            `}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

async function viewRoomDetails(roomId) {
    try {
        const res = await fetch(`/api/public/rooms/${roomId}`);
        const room = await res.json();

        const title = document.getElementById('mrd-room-title');
        const content = document.getElementById('mrd-content');

        title.innerHTML = `<i class="fa-solid fa-hotel text-primary"></i> Room ${room.room_number} Details (${room.room_type} - ${room.ac_type})`;

        const galleryHtml = room.gallery && room.gallery.length > 0
            ? room.gallery.map(img => `
                <div class="mrd-gallery-item">
                    <img src="${img.image_url}" alt="${img.caption || 'Room Photo'}" class="mrd-gallery-img">
                    <small>${img.caption || 'Interior View'}</small>
                </div>
            `).join('')
            : `<img src="${room.primary_image}" alt="Room Photo" style="width:100%; height:250px; object-fit:cover; border-radius:8px;">`;

        content.innerHTML = `
            <div class="mrd-gallery-grid">
                ${galleryHtml}
            </div>

            <div style="display:grid; grid-template-columns:1fr 1fr; gap:1.25rem; margin:1.5rem 0; font-size:0.9rem;">
                <div><strong>Category:</strong> ${room.room_type} Room</div>
                <div><strong>Climate Facility:</strong> ${room.ac_type}</div>
                <div><strong>Bathroom Type:</strong> ${room.bathroom_type} Bathroom</div>
                <div><strong>Maximum Capacity:</strong> ${room.max_occupancy} Resident(s)</div>
                <div><strong>Monthly Rent:</strong> ₹${room.price_monthly.toLocaleString()} / month</div>
                <div><strong>Security Deposit:</strong> ₹${room.deposit_amount.toLocaleString()} (Refundable)</div>
            </div>

            <div style="background:#f8fafc; border:1px solid #e2e8f0; padding:1.25rem; border-radius:8px; margin-bottom:1.5rem;">
                <h4 style="font-size:0.95rem; font-weight:700; color:#0f172a; margin-bottom:0.5rem;"><i class="fa-solid fa-star text-warning"></i> Included Amenities</h4>
                <p style="font-size:0.88rem; color:#475569; line-height:1.6;">${room.facilities || 'High-speed Wi-Fi, 3 Meals, Daily Housekeeping, RO Water, Security'}</p>
            </div>

            <div style="display:flex; justify-content:space-between; align-items:center;">
                <span class="badge-pill ${room.status === 'Available' ? 'pill-available' : 'pill-occupied'}">
                    Status: ${room.status}
                </span>
                ${room.status === 'Available' ? `
                    <button class="btn btn-primary" onclick="closeModal('modal-room-details'); quickBookRoom(${room.id}, '${room.room_type}', '${room.ac_type}', '${room.room_number}')">
                        <i class="fa-solid fa-calendar-check"></i> Book This Room Now
                    </button>
                ` : ''}
            </div>
        `;

        openModal('modal-room-details');
    } catch (err) {
        showToast('Failed to load room details', 'danger');
    }
}

function quickBookRoom(roomId, roomType, acType, roomNumber) {
    document.getElementById('reg-room-category').value = roomType;
    document.getElementById('reg-ac-type').value = acType;

    // Trigger available rooms reload and preselect room
    if (window.loadRegistrationAvailableRooms) {
        window.loadRegistrationAvailableRooms(roomId);
    }

    scrollToSection('registration-section');
    showToast(`Selected Room ${roomNumber}. Please complete mobile OTP verification below.`, 'info');
}

function loadPublicGallery() {
    const container = document.getElementById('gallery-container');
    if (!container) return;

    const photos = [
        { url: 'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&w=700&q=80', cat: 'bedroom', title: 'Single Deluxe Bedroom' },
        { url: 'https://images.unsplash.com/photo-1598928506311-c55ded91a20c?auto=format&fit=crop&w=700&q=80', cat: 'bedroom', title: 'Double Sharing Suite' },
        { url: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=700&q=80', cat: 'bathroom', title: 'Modern Attached Bathroom' },
        { url: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=700&q=80', cat: 'study', title: 'Ergonomic Workstation' },
        { url: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=700&q=80', cat: 'bedroom', title: 'Sunlit Balcony Bedroom' },
        { url: 'https://images.unsplash.com/photo-1595526114035-0d45ed16cfbf?auto=format&fit=crop&w=700&q=80', cat: 'study', title: 'High-Speed Wi-Fi Work Desks' }
    ];

    container.innerHTML = photos.map(p => `
        <div class="gallery-card" data-category="${p.cat}">
            <img src="${p.url}" alt="${p.title}" class="gallery-img" loading="lazy">
            <div class="gallery-overlay">
                <span>${p.title}</span>
            </div>
        </div>
    `).join('');

    // Gallery Tab Filtering
    const tabs = document.querySelectorAll('.gallery-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            const filter = tab.getAttribute('data-filter');

            document.querySelectorAll('.gallery-card').forEach(card => {
                if (filter === 'all' || card.getAttribute('data-category') === filter) {
                    card.style.display = 'block';
                } else {
                    card.style.display = 'none';
                }
            });
        });
    });
}

// Filter Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    ['pub-filter-category', 'pub-filter-ac', 'pub-filter-bathroom'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', loadPublicRooms);
    });

    const rentSlider = document.getElementById('pub-filter-rent');
    const rentVal = document.getElementById('pub-rent-val');
    if (rentSlider && rentVal) {
        rentSlider.addEventListener('input', (e) => {
            rentVal.textContent = `₹${parseInt(e.target.value).toLocaleString()}`;
            loadPublicRooms();
        });
    }

    const resetBtn = document.getElementById('pub-reset-filters');
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            document.getElementById('pub-filter-category').value = 'All';
            document.getElementById('pub-filter-ac').value = 'All';
            document.getElementById('pub-filter-bathroom').value = 'All';
            if (rentSlider) {
                rentSlider.value = 25000;
                rentVal.textContent = '₹25,000';
            }
            loadPublicRooms();
        });
    }
});

window.loadCategoriesSummary = loadCategoriesSummary;
window.loadPublicRooms = loadPublicRooms;
window.viewRoomDetails = viewRoomDetails;
window.quickBookRoom = quickBookRoom;
window.loadPublicGallery = loadPublicGallery;
window.filterByCategory = filterByCategory;
