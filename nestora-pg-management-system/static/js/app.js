// Nestora - Main Application, Routing & Modal Management

document.addEventListener('DOMContentLoaded', () => {
    initPublicNavigation();
    initGlobalModals();

    // Load public components
    if (window.loadCategoriesSummary) loadCategoriesSummary();
    if (window.loadPublicRooms) loadPublicRooms();
    if (window.loadPublicGallery) loadPublicGallery();
    if (window.initOtpBookingWizard) initOtpBookingWizard();

    // Check if admin is already logged in
    if (window.checkAdminSession) checkAdminSession();
});

// Toast notification helper
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    if (!toast) return;

    toast.textContent = message;
    toast.className = `toast show ${type}`;

    setTimeout(() => {
        toast.className = 'toast';
    }, 4500);
}

// Smooth scrolling to public section
function scrollToSection(sectionId) {
    const target = document.getElementById(sectionId);
    if (target) {
        target.scrollIntoView({ behavior: 'smooth' });
    }

    // Close mobile nav drawer if open
    const menu = document.getElementById('nav-menu');
    if (menu) menu.classList.remove('mobile-active');
}

// Public Mobile Navigation
function initPublicNavigation() {
    const toggle = document.getElementById('public-menu-toggle');
    const menu = document.getElementById('nav-menu');

    if (toggle && menu) {
        toggle.addEventListener('click', () => {
            menu.classList.toggle('mobile-active');
        });
    }

    // Public Contact Form submission
    const contactForm = document.getElementById('form-public-contact');
    if (contactForm) {
        contactForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const payload = {
                name: document.getElementById('contact-name').value.trim(),
                email: document.getElementById('contact-email').value.trim(),
                message: document.getElementById('contact-message').value.trim()
            };

            try {
                const res = await fetch('/api/public/contact', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const data = await res.json();
                if (data.success) {
                    showToast(data.message, 'success');
                    contactForm.reset();
                } else {
                    showToast(data.message, 'danger');
                }
            } catch (err) {
                showToast('Failed to submit message', 'danger');
            }
        });
    }
}

// Modal System
function initGlobalModals() {
    document.querySelectorAll('[data-close]').forEach(el => {
        el.addEventListener('click', () => {
            const targetModalId = el.getAttribute('data-close');
            closeModal(targetModalId);
        });
    });
}

function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('active');
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('active');
}

// Legal Privacy Policy & Terms Modal Content
function openPrivacyModal() {
    const title = document.getElementById('modal-legal-title');
    const content = document.getElementById('modal-legal-content');

    title.innerHTML = `<i class="fa-solid fa-user-shield text-primary"></i> Nestora Privacy Policy`;
    content.innerHTML = `
        <h4 style="font-weight:800; color:#0f172a; margin-bottom:0.5rem;">1. Customer Data Protection & Safety</h4>
        <p>Nestora collects customer information solely for legitimate PG hostel management, room reservations, and local regulatory tenancy records. We do not sell or monetize personal information.</p>
        
        <h4 style="font-weight:800; color:#0f172a; margin-top:1rem; margin-bottom:0.5rem;">2. Mobile Number Verification</h4>
        <p>To prevent unauthorized, fake, or duplicate bookings, every customer mobile number is verified through cryptographically secure One-Time Passwords (OTP). OTP codes are hashed with SHA-256 and never logged or exposed in plain text.</p>

        <h4 style="font-weight:800; color:#0f172a; margin-top:1rem; margin-bottom:0.5rem;">3. Data Retention & Deletion Rights</h4>
        <p>Active resident information is maintained securely during the tenancy term. When a customer vacates, personal data is archived in compliance with tenancy laws. Customers may submit an official correction or deletion request through the customer portal.</p>
    `;

    openModal('modal-privacy-terms');
}

function openTermsModal() {
    const title = document.getElementById('modal-legal-title');
    const content = document.getElementById('modal-legal-content');

    title.innerHTML = `<i class="fa-solid fa-file-contract text-primary"></i> Booking Terms & Conditions`;
    content.innerHTML = `
        <h4 style="font-weight:800; color:#0f172a; margin-bottom:0.5rem;">1. Room Reservation & Confirmation</h4>
        <p>Submitting an online booking holds the room under 'Pending' status. Room allocation is confirmed once administrative onboarding is completed.</p>

        <h4 style="font-weight:800; color:#0f172a; margin-top:1rem; margin-bottom:0.5rem;">2. Security Deposit & Monthly Rent</h4>
        <p>Security deposit is collected at move-in and is 100% refundable upon vacating, subject to room handover in clean, undamaged condition and a standard 30-day notice.</p>

        <h4 style="font-weight:800; color:#0f172a; margin-top:1rem; margin-bottom:0.5rem;">3. Code of Conduct & Facilities</h4>
        <p>Residents enjoy 200 Mbps Wi-Fi, 3 daily meals, daily housekeeping, and 24/7 biometric security. Peaceful living standards and noise discipline are strictly enforced.</p>
    `;

    openModal('modal-privacy-terms');
}

window.showToast = showToast;
window.scrollToSection = scrollToSection;
window.openModal = openModal;
window.closeModal = closeModal;
window.openPrivacyModal = openPrivacyModal;
window.openTermsModal = openTermsModal;
