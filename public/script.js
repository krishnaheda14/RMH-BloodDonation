/**
 * Blood Donation Event Website
 * Frontend JavaScript - Vanilla JS
 * Handles form submission, validation, redirects, and dashboard updates
 */

// ============================================
// CONFIGURATION
// ============================================
const CONFIG = {
    API_BASE_URL: window.location.origin,
    THANK_YOU_DURATION: 10, // seconds
    STATS_REFRESH_INTERVAL: 5000, // 5 seconds
    SLOGAN_INTERVAL: 4000, // 4 seconds
    COUNT_ANIMATION_DURATION: 2000 // 2 seconds
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Makes an API request with error handling
 * @param {string} endpoint - API endpoint
 * @param {object} options - Fetch options
 * @returns {Promise} Response data
 */
async function apiRequest(endpoint, options = {}) {
    try {
        const response = await fetch(`${CONFIG.API_BASE_URL}${endpoint}`, {
            headers: {
                'Content-Type': 'application/json',
            },
            ...options
        });

        // Try to parse JSON only when content-type is application/json
        const contentType = response.headers.get('content-type') || '';
        let data = null;

        if (contentType.includes('application/json')) {
            data = await response.json();
        } else {
            // Non-JSON response (likely an error HTML/text). Read as text for debugging.
            const text = await response.text();
            // Attach rawText for upstream handling
            data = { rawText: text };
        }

        if (!response.ok) {
            const msg = data && data.message ? data.message : (data && data.rawText ? data.rawText : 'Request failed');
            throw new Error(msg);
        }

        return data;
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}

/**
 * Validates form field and shows error message
 * @param {HTMLElement} field - Input field
 * @param {string} errorId - Error message element ID
 * @param {string} message - Error message to display
 * @returns {boolean} Is field valid
 */
function validateField(field, errorId, message) {
    const errorElement = document.getElementById(errorId);
    const formGroup = field.closest('.form-group');

    if (!field.value.trim()) {
        errorElement.textContent = message;
        errorElement.classList.add('show');
        formGroup.classList.add('error');
        return false;
    }

    errorElement.classList.remove('show');
    formGroup.classList.remove('error');
    return true;
}

/**
 * Animates a number counting up
 * @param {HTMLElement} element - Element to update
 * @param {number} start - Starting number
 * @param {number} end - Ending number
 * @param {number} duration - Animation duration in ms
 */
function animateNumber(element, start, end, duration) {
    const startTime = performance.now();
    const difference = end - start;

    function updateNumber(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Easing function for smooth animation
        const easeOutQuart = 1 - Math.pow(1 - progress, 4);
        const currentValue = Math.floor(start + (difference * easeOutQuart));

        element.textContent = currentValue.toLocaleString();

        if (progress < 1) {
            requestAnimationFrame(updateNumber);
        } else {
            element.textContent = end.toLocaleString();
        }
    }

    requestAnimationFrame(updateNumber);
}

/**
 * Stores donor info in session storage for thank you page
 * @param {object} donorInfo - Donor information
 */
function storeDonorInfo(donorInfo) {
    sessionStorage.setItem('donorInfo', JSON.stringify(donorInfo));
}

/**
 * Retrieves donor info from session storage
 * @returns {object|null} Donor information
 */
function getDonorInfo() {
    const info = sessionStorage.getItem('donorInfo');
    return info ? JSON.parse(info) : null;
}

/**
 * Clears donor info from session storage
 */
function clearDonorInfo() {
    sessionStorage.removeItem('donorInfo');
}

/**
 * Formats a date to readable string
 * @param {string} dateString - ISO date string
 * @returns {string} Formatted date
 */
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// ============================================
// REGISTRATION FORM (index.html)
// ============================================

/**
 * Shows a random toast notification after donation
 * @param {string} name - Donor name
 */
function showToast(name) {
    const messages = [
        `Thank you ${name}, you saved a life! ❤️`,
        `${name}, you're a hero! Your donation will save up to 3 lives!`,
        `Amazing ${name}! You just gave someone a second chance at life!`,
        `${name}, your generosity will make a huge difference!`,
        `Thank you ${name}! You're a real-life superhero!`,
        `${name}, your donation is priceless - you're saving lives!`,
        `Incredible ${name}! Someone's life just got better because of you!`
    ];
    
    const randomMessage = messages[Math.floor(Math.random() * messages.length)];
    
    // Create toast element
    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    toast.innerHTML = `<span class="toast-icon">❤️</span>${randomMessage}`;
    
    document.body.appendChild(toast);
    
    // Show toast
    setTimeout(() => toast.classList.add('show'), 100);
    
    // Hide and remove toast after 5 seconds
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 400);
    }, 5000);
}

/**
 * Initializes the donor registration form
 */
function initRegistrationForm() {
    const form = document.getElementById('donorForm');
    if (!form) return;

    const submitBtn = document.getElementById('submitBtn');
    const formMessage = document.getElementById('formMessage');

    // Form submission handler
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Get form values
        const fullName = document.getElementById('fullName');
        const bloodGroup = document.getElementById('bloodGroup');
        const age = document.getElementById('age');
        const year = document.getElementById('year');

        // Reset previous errors
        document.querySelectorAll('.error-message').forEach(el => el.classList.remove('show'));
        document.querySelectorAll('.form-group').forEach(el => el.classList.remove('error'));
        formMessage.className = 'form-message';

        // Validate all fields
        let isValid = true;

        if (!validateField(fullName, 'fullNameError', 'Please enter your full name')) {
            isValid = false;
        }

        if (!validateField(bloodGroup, 'bloodGroupError', 'Please select your blood group')) {
            isValid = false;
        }

        if (!validateField(age, 'ageError', 'Please enter your age')) {
            isValid = false;
        } else if (parseInt(age.value) < 18) {
            document.getElementById('ageError').textContent = 'You must be at least 18 years old';
            document.getElementById('ageError').classList.add('show');
            age.closest('.form-group').classList.add('error');
            isValid = false;
        } else if (parseInt(age.value) > 65) {
            document.getElementById('ageError').textContent = 'Maximum age for donation is 65 years';
            document.getElementById('ageError').classList.add('show');
            age.closest('.form-group').classList.add('error');
            isValid = false;
        }

        if (!validateField(year, 'yearError', 'Please select your academic year')) {
            isValid = false;
        }

        if (!isValid) return;

        // Show loading state
        submitBtn.classList.add('loading');

        try {
            // Submit donation
            const response = await apiRequest('/api/donate', {
                method: 'POST',
                body: JSON.stringify({
                    fullName: fullName.value.trim(),
                    bloodGroup: bloodGroup.value,
                    age: parseInt(age.value),
                    year: year.value
                })
            });

            console.log('Donation successful:', response);
            
            // Show toast notification with random message
            showToast(fullName.value.trim());
            
            // Show success message on form
            formMessage.textContent = 'Registration successful! Thank you!';
            formMessage.className = 'form-message success';
            
            // Reset form
            form.reset();
            submitBtn.classList.remove('loading');

        } catch (error) {
            // Show error message
            formMessage.textContent = error.message || 'Registration failed. Please try again.';
            formMessage.className = 'form-message error';
            submitBtn.classList.remove('loading');
        }
    });

    // Real-time validation on blur
    document.getElementById('fullName').addEventListener('blur', (e) => {
        validateField(e.target, 'fullNameError', 'Please enter your full name');
    });

    document.getElementById('bloodGroup').addEventListener('change', (e) => {
        validateField(e.target, 'bloodGroupError', 'Please select your blood group');
    });

    document.getElementById('age').addEventListener('blur', (e) => {
        if (e.target.value && parseInt(e.target.value) < 18) {
            document.getElementById('ageError').textContent = 'You must be at least 18 years old';
            document.getElementById('ageError').classList.add('show');
            e.target.closest('.form-group').classList.add('error');
        } else if (e.target.value && parseInt(e.target.value) > 65) {
            document.getElementById('ageError').textContent = 'Maximum age for donation is 65 years';
            document.getElementById('ageError').classList.add('show');
            e.target.closest('.form-group').classList.add('error');
        } else {
            validateField(e.target, 'ageError', 'Please enter your age');
        }
    });

    document.getElementById('year').addEventListener('change', (e) => {
        validateField(e.target, 'yearError', 'Please select your academic year');
    });
}

// ============================================
// THANK YOU PAGE (thankyou.html)
// ============================================

/**
 * Initializes the thank you page with countdown
 */
function initThankYouPage() {
    const donorNameEl = document.getElementById('donorName');
    const donorBloodGroupEl = document.getElementById('donorBloodGroup');
    const countdownEl = document.getElementById('countdown');
    const progressFill = document.getElementById('progressFill');

    if (!donorNameEl || !countdownEl) return;

    // Get donor info from session storage
    const donorInfo = getDonorInfo();

    if (donorInfo) {
        donorNameEl.textContent = donorInfo.fullName;
        donorBloodGroupEl.textContent = donorInfo.bloodGroup;
    } else {
        // If no donor info, redirect to home
        donorNameEl.textContent = 'Anonymous Hero';
        donorBloodGroupEl.textContent = '❤️';
    }

    // Countdown timer
    let countdown = CONFIG.THANK_YOU_DURATION;
    const totalDuration = CONFIG.THANK_YOU_DURATION;

    // Update progress bar
    function updateProgress() {
        const remaining = countdown / totalDuration;
        progressFill.style.width = `${remaining * 100}%`;
    }

    // Initial progress
    updateProgress();

    // Countdown interval
    const countdownInterval = setInterval(() => {
        countdown--;
        countdownEl.textContent = countdown;
        updateProgress();

        if (countdown <= 0) {
            clearInterval(countdownInterval);
            clearDonorInfo();
            window.location.href = '/dashboard';
        }
    }, 1000);
}

// ============================================
// DASHBOARD PAGE (dashboard.html)
// ============================================

/**
 * Initializes the dashboard with live stats
 */
function initDashboard() {
    const totalUnitsEl = document.getElementById('totalUnits');
    const livesSavedEl = document.getElementById('livesSaved');
    const lastUpdatedEl = document.getElementById('lastUpdated');
    const donorsListEl = document.getElementById('donorsList');

    if (!totalUnitsEl) return;

    let previousTotal = 0;
    let isFirstLoad = true;

    /**
     * Shows the thank you popup overlay
     */
    function showThankYouPopup(donorName, bloodGroup) {
        const overlay = document.getElementById('thankYouOverlay');
        const nameEl = document.getElementById('overlayDonorName');
        const bloodEl = document.getElementById('overlayBloodGroup');

        if (overlay) {
            if (nameEl) nameEl.textContent = donorName;
            if (bloodEl) bloodEl.textContent = bloodGroup;
            overlay.classList.add('show');

            // Hide after 10 seconds
            setTimeout(() => {
                overlay.classList.remove('show');
            }, 10000);
        }
    }

    /**
     * Shows a professional celebration notification for new donor
     */
    function showCelebrationNotification(donorName, bloodGroup) {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = 'new-donor-notification';
        notification.innerHTML = `
            <div class="notification-header">
                <div class="notification-icon">
                    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 21C12 21 3 13.5 3 8.5C3 5.5 5.5 3 8.5 3C10.5 3 12 4.5 12 4.5C12 4.5 13.5 3 15.5 3C18.5 3 21 5.5 21 8.5C21 13.5 12 21 12 21Z" fill="currentColor"/>
                    </svg>
                </div>
                <div class="notification-text">
                    <h3>New Donor!</h3>
                </div>
            </div>
            <div class="notification-body">
                <div class="donor-name-display">
                    <div class="name">${escapeHtml(donorName)}</div>
                    <div class="subtitle">Thank you for saving lives</div>
                </div>
                <div class="notification-badge">${escapeHtml(bloodGroup)}</div>
            </div>
        `;

        document.body.appendChild(notification);

        // Trigger confetti effect
        createConfetti();

        // Animate stat card
        const primaryCard = document.querySelector('.primary-card');
        if (primaryCard) {
            primaryCard.classList.add('celebrate');
            setTimeout(() => primaryCard.classList.remove('celebrate'), 600);
        }

        // Show notification
        setTimeout(() => notification.classList.add('show'), 100);

        // Hide and remove notification after 5 seconds
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 500);
        }, 5000);
    }

    /**
     * Creates elegant confetti effect
     */
    function createConfetti() {
        const container = document.createElement('div');
        container.className = 'confetti-container';
        document.body.appendChild(container);

        const colors = ['#DC143C', '#FF4D6A', '#FF6B6B', '#FFFFFF'];
        const confettiCount = 50;

        for (let i = 0; i < confettiCount; i++) {
            const confetti = document.createElement('div');
            confetti.className = 'confetti';
            confetti.style.left = Math.random() * 100 + '%';
            confetti.style.background = colors[Math.floor(Math.random() * colors.length)];
            confetti.style.animationDelay = Math.random() * 0.3 + 's';
            confetti.style.animationDuration = (Math.random() * 2 + 2) + 's';
            
            // Random shapes
            if (Math.random() > 0.5) {
                confetti.style.borderRadius = '50%';
            }

            container.appendChild(confetti);
            
            // Trigger animation
            setTimeout(() => confetti.classList.add('animate'), 10);
        }

        // Remove container after animation
        setTimeout(() => container.remove(), 5000);
    }

    /**
     * Fetches the latest donor and shows popup
     */
    async function fetchLatestDonorAndShowPopup() {
        try {
            const response = await apiRequest('/api/donors?limit=1');
            if (response.data && response.data.length > 0) {
                const latestDonor = response.data[0];
                showCelebrationNotification(latestDonor.fullName, latestDonor.bloodGroup);
                showThankYouPopup(latestDonor.fullName, latestDonor.bloodGroup);
            }
        } catch (error) {
            console.error('Failed to fetch latest donor:', error);
        }
    }

    /**
     * Fetches and updates statistics
     */
    async function fetchStats() {
        try {
            const response = await apiRequest('/api/stats');
            const { totalBloodUnits, lastUpdated } = response.data;

            // Detect new donor (count increased) - skip on first load
            if (!isFirstLoad && totalBloodUnits > previousTotal) {
                // New donor detected, fetch and show popup
                fetchLatestDonorAndShowPopup();
            }

            // Animate number if changed
            if (totalBloodUnits !== previousTotal) {
                animateNumber(totalUnitsEl, previousTotal, totalBloodUnits, CONFIG.COUNT_ANIMATION_DURATION);
                
                // Calculate lives saved (each unit can save up to 3 lives)
                const livesSaved = totalBloodUnits * 3;
                animateNumber(livesSavedEl, previousTotal * 3, livesSaved, CONFIG.COUNT_ANIMATION_DURATION);
                
                previousTotal = totalBloodUnits;
            }

            isFirstLoad = false;

            // Update last updated time
            if (lastUpdated) {
                lastUpdatedEl.textContent = `Last updated: ${formatDate(lastUpdated)}`;
            }

        } catch (error) {
            console.error('Failed to fetch stats:', error);
        }
    }

    /**
     * Fetches and displays recent donors
     */
    async function fetchRecentDonors() {
        try {
            const response = await apiRequest('/api/donors?limit=8');
            const donors = response.data;

            if (donors.length === 0) {
                donorsListEl.innerHTML = '<p class="no-donors">No donors registered yet. Be the first!</p>';
                return;
            }

            donorsListEl.innerHTML = donors.map((donor, index) => `
                <div class="donor-chip" style="animation-delay: ${index * 0.08}s">
                    <span class="donor-name">${escapeHtml(donor.fullName)}</span>
                    <span class="blood-badge">${escapeHtml(donor.bloodGroup)}</span>
                </div>
            `).join('');

        } catch (error) {
            console.error('Failed to fetch donors:', error);
            donorsListEl.innerHTML = '<p class="loading-state">Failed to load donors</p>';
        }
    }

    /**
     * Escapes HTML to prevent XSS
     * @param {string} text - Text to escape
     * @returns {string} Escaped text
     */
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Initial fetch
    fetchStats();
    fetchRecentDonors();

    // Auto-refresh stats
    setInterval(fetchStats, CONFIG.STATS_REFRESH_INTERVAL);
    setInterval(fetchRecentDonors, CONFIG.STATS_REFRESH_INTERVAL);

    // Initialize slogans carousel
    initSlogansCarousel();
    
    // Initialize all donors modal
    initAllDonorsModal();
}

/**
 * Initializes the quotes carousel (dashboard)
 */
function initSlogansCarousel() {
    const quotes = document.querySelectorAll('.quote-slide');
    const indicators = document.querySelectorAll('.carousel-indicators .indicator');

    if (quotes.length === 0) return;

    let currentIndex = 0;

    function showQuote(index) {
        // Remove active class from all
        quotes.forEach(quote => {
            quote.classList.remove('active');
        });
        indicators.forEach(ind => ind.classList.remove('active'));

        // Show new quote
        currentIndex = index;
        quotes[currentIndex].classList.add('active');
        if (indicators[currentIndex]) {
            indicators[currentIndex].classList.add('active');
        }
    }

    function nextQuote() {
        const nextIndex = (currentIndex + 1) % quotes.length;
        showQuote(nextIndex);
    }

    // Auto-rotate quotes
    setInterval(nextQuote, CONFIG.SLOGAN_INTERVAL);

    // Click on indicators
    indicators.forEach((indicator, index) => {
        indicator.addEventListener('click', () => {
            showQuote(index);
        });
    });
}

/**
 * Initializes the all donors modal
 */
function initAllDonorsModal() {
    const modal = document.getElementById('allDonorsModal');
    const openBtn = document.getElementById('viewAllDonorsBtn');
    const closeBtn = document.getElementById('closeModalBtn');
    const backdrop = document.getElementById('modalBackdrop');
    const searchInput = document.getElementById('donorSearch');
    const content = document.getElementById('allDonorsContent');
    const countEl = document.getElementById('donorCount');

    if (!modal || !openBtn) return;

    let allDonors = [];

    /**
     * Formats date for display
     */
    function formatDonorDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    /**
     * Renders donors table
     */
    function renderDonors(donors) {
        if (donors.length === 0) {
            content.innerHTML = `
                <div class="no-results">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="11" cy="11" r="8"/>
                        <path d="M21 21l-4.35-4.35"/>
                    </svg>
                    <p>No donors found</p>
                </div>
            `;
            return;
        }

        const html = `
            <div class="donors-table">
                <div class="donors-table-header">
                    <span>Name</span>
                    <span>Blood Group</span>
                    <span>Date</span>
                </div>
                ${donors.map((donor, index) => `
                    <div class="donor-row" style="animation-delay: ${index * 0.03}s">
                        <span class="donor-name">${escapeHtml(donor.fullName)}</span>
                        <span class="donor-blood">${escapeHtml(donor.bloodGroup)}</span>
                        <span class="donor-date">${formatDonorDate(donor.donatedAt)}</span>
                    </div>
                `).join('')}
            </div>
        `;

        content.innerHTML = html;
    }

    /**
     * Filters donors based on search
     */
    function filterDonors(searchTerm) {
        const filtered = allDonors.filter(donor => {
            const name = donor.fullName.toLowerCase();
            const blood = donor.bloodGroup.toLowerCase();
            const term = searchTerm.toLowerCase();
            return name.includes(term) || blood.includes(term);
        });
        renderDonors(filtered);
    }

    /**
     * Fetches all donors from API
     */
    async function loadAllDonors() {
        try {
            content.innerHTML = `
                <div class="loading-state">
                    <div class="loading-spinner"></div>
                    <span>Loading all donors...</span>
                </div>
            `;

            const response = await apiRequest('/api/donors?limit=1000');
            allDonors = response.data;
            
            countEl.textContent = `${allDonors.length} ${allDonors.length === 1 ? 'donor' : 'donors'} registered`;
            renderDonors(allDonors);

        } catch (error) {
            console.error('Failed to load all donors:', error);
            content.innerHTML = `
                <div class="no-results">
                    <p>Failed to load donors. Please try again.</p>
                </div>
            `;
        }
    }

    /**
     * Opens modal
     */
    function openModal() {
        modal.classList.add('show');
        document.body.style.overflow = 'hidden';
        loadAllDonors();
    }

    /**
     * Closes modal
     */
    function closeModal() {
        modal.classList.remove('show');
        document.body.style.overflow = '';
        searchInput.value = '';
        allDonors = [];
    }

    /**
     * Escapes HTML to prevent XSS
     */
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Event listeners
    openBtn.addEventListener('click', openModal);
    closeBtn.addEventListener('click', closeModal);
    backdrop.addEventListener('click', closeModal);

    // Search functionality
    searchInput.addEventListener('input', (e) => {
        filterDonors(e.target.value);
    });

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('show')) {
            closeModal();
        }
    });
}

// ============================================
// PAGE INITIALIZATION
// ============================================

// Theme removed — app is light-only now

/**
 * Determines current page and initializes appropriate functionality
 */
function initializePage() {
    const path = window.location.pathname;

    // Determine which page we're on and initialize
    if (path === '/' || path === '/index.html' || path.endsWith('index.html')) {
        initRegistrationForm();
    } else if (path === '/thank-you' || path.includes('thankyou')) {
        initThankYouPage();
    } else if (path === '/dashboard' || path.includes('dashboard')) {
        initDashboard();
    }

    console.log('🩸 Blood Donation Website initialized');
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', initializePage);
