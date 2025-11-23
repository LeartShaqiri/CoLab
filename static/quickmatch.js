// Quick Match page specific functionality
const API_BASE = '/api';
let allUsers = [];
let currentUserIndex = 0;
let currentCard = null;
let startX = 0;
let currentX = 0;
let isDragging = false;

// Initialize page
window.addEventListener('DOMContentLoaded', () => {
    // Initialize theme first
    initDarkMode();
    
    // Check authentication
    checkAuthAndLoadUsers();
});

// Initialize dark mode from localStorage
function initDarkMode() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateDarkModeIcon(savedTheme);
    
    // Setup dark mode toggle - wait a bit to ensure element exists and avoid conflicts
    setTimeout(() => {
        const darkModeToggle = document.getElementById('darkModeToggle');
        if (darkModeToggle) {
            // Remove any existing listeners to avoid duplicates
            const newToggle = darkModeToggle.cloneNode(true);
            darkModeToggle.parentNode.replaceChild(newToggle, darkModeToggle);
            newToggle.addEventListener('click', toggleDarkMode);
        }
    }, 100);
}

function toggleDarkMode() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateDarkModeIcon(newTheme);
}

function updateDarkModeIcon(theme) {
    const moonIcon = document.querySelector('.moon-icon');
    const sunIcon = document.querySelector('.sun-icon');
    if (theme === 'dark') {
        if (moonIcon) moonIcon.style.display = 'none';
        if (sunIcon) sunIcon.style.display = 'block';
    } else {
        if (moonIcon) moonIcon.style.display = 'block';
        if (sunIcon) sunIcon.style.display = 'none';
    }
}

// Check authentication and load users
async function checkAuthAndLoadUsers() {
    const userData = localStorage.getItem('currentUser');
    if (!userData) {
        // User not logged in - show message
        const swipeContainer = document.getElementById('swipeContainer');
        const actionButtons = document.getElementById('actionButtons');
        
        if (swipeContainer) {
            swipeContainer.innerHTML = `
                <div class="empty-state" style="text-align: center; padding: 60px 20px;">
                    <h3>🔒 Login Required</h3>
                    <p style="margin: 20px 0;">Please login to access Quick Match</p>
                    <button class="btn-primary" onclick="document.getElementById('loginBtn').click()">Login</button>
                </div>
            `;
        }
        if (actionButtons) {
            actionButtons.style.display = 'none';
        }
        return;
    }
    
    // User is logged in - load users and initialize swipe
    const swipeCards = document.getElementById('swipeCards');
    if (swipeCards) {
        swipeCards.innerHTML = '<div class="loading">Loading users...</div>';
    }
    
    await loadAllUsers();
    
    if (allUsers.length === 0) {
        const swipeCards = document.getElementById('swipeCards');
        if (swipeCards) {
            swipeCards.innerHTML = `
                <div class="empty-state">
                    <h3>No users available</h3>
                    <p>Check back later for more matches.</p>
                </div>
            `;
        }
        return;
    }
    
    initializeSwipeInterface();
}

// Load all users randomly
async function loadAllUsers() {
    const userData = localStorage.getItem('currentUser');
    if (!userData) {
        allUsers = [];
        return;
    }
    
    const currentUser = JSON.parse(userData);
    
    try {
        const response = await fetch(`${API_BASE}/users?current_user_id=${currentUser.id}`);
        if (response.ok) {
            const users = await safeJsonParse(response);
            
            // Filter out current user and shuffle randomly
            allUsers = users
                .filter(user => user.id !== currentUser.id)
                .sort(() => Math.random() - 0.5); // Random shuffle
            
            currentUserIndex = 0;
            console.log(`Loaded ${allUsers.length} users for Quick Match`);
        } else {
            console.error('Failed to load users:', response.status);
            const swipeCards = document.getElementById('swipeCards');
            if (swipeCards) {
                swipeCards.innerHTML = `<div class="alert error">Failed to load users. Please try again.</div>`;
            }
            allUsers = [];
        }
    } catch (error) {
        console.error('Error loading users:', error);
        const swipeCards = document.getElementById('swipeCards');
        if (swipeCards) {
            swipeCards.innerHTML = `<div class="alert error">Error: ${error.message}</div>`;
        }
        allUsers = [];
    }
}

// Initialize swipe interface
function initializeSwipeInterface() {
    if (allUsers.length === 0) {
        document.getElementById('swipeCards').innerHTML = `
            <div class="empty-state">
                <h3>No users available</h3>
                <p>Check back later for more matches.</p>
            </div>
        `;
        return;
    }
    
    // Show action buttons
    const actionButtons = document.getElementById('actionButtons');
    if (actionButtons) {
        actionButtons.style.display = 'flex';
    }
    
    // Setup button listeners
    const swipeLeftBtn = document.getElementById('swipeLeftBtn');
    const swipeRightBtn = document.getElementById('swipeRightBtn');
    
    if (swipeLeftBtn) {
        swipeLeftBtn.addEventListener('click', () => handleSwipe('left'));
    }
    if (swipeRightBtn) {
        swipeRightBtn.addEventListener('click', () => handleSwipe('right'));
    }
    
    // Display first card
    showNextCard();
}

// Show next card
function showNextCard() {
    const swipeCards = document.getElementById('swipeCards');
    const noMoreCards = document.getElementById('noMoreCards');
    
    if (!swipeCards) {
        console.error('swipeCards element not found');
        return;
    }
    
    if (currentUserIndex >= allUsers.length) {
        swipeCards.innerHTML = '';
        if (noMoreCards) {
            noMoreCards.style.display = 'block';
        }
        const actionButtons = document.getElementById('actionButtons');
        if (actionButtons) {
            actionButtons.style.display = 'none';
        }
        return;
    }
    
    if (noMoreCards) {
        noMoreCards.style.display = 'none';
    }
    
    const user = allUsers[currentUserIndex];
    
    if (!user) {
        console.error('User not found at index:', currentUserIndex);
        currentUserIndex++;
        showNextCard();
        return;
    }
    
    const initials = user.full_name ? user.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : '?';
    const avatar = user.profile_picture || `data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%22100%22%3E%3Ccircle cx=%2250%22 cy=%2250%22 r=%2248%22 fill=%22%231dbf73%22/%3E%3Ctext x=%2250%22 y=%2258%22 font-size=%2232%22 fill=%22white%22 text-anchor=%22middle%22%3E${initials}%3C/text%3E%3C/svg%3E`;
    
    const profileTypeEmoji = user.profile_type === 'Coworker' ? '🤝' : '💻';
    
    swipeCards.innerHTML = `
        <div class="swipe-card" id="currentCard">
            <div class="swipe-card-content">
                <div class="swipe-card-header">
                    <img src="${avatar}" alt="${user.full_name}" class="swipe-card-avatar" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%22100%22%3E%3Ccircle cx=%2250%22 cy=%2250%22 r=%2248%22 fill=%22%231dbf73%22/%3E%3Ctext x=%2250%22 y=%2258%22 font-size=%2232%22 fill=%22white%22 text-anchor=%22middle%22%3E${initials}%3C/text%3E%3C/svg%3E'">
                    <div class="swipe-card-user-info">
                        <h2>${profileTypeEmoji} ${user.full_name}</h2>
                        <div class="swipe-card-username">@${user.username}</div>
                        ${user.location ? `<div class="swipe-card-location">📍 ${user.location}</div>` : ''}
                    </div>
                </div>
                ${user.bio ? `<div class="swipe-card-bio">${escapeHtml(user.bio)}</div>` : ''}
                ${user.interests && user.interests.length > 0 ? `
                    <div class="swipe-card-section">
                        <h4>Interests</h4>
                        <div class="swipe-card-tags">
                            ${user.interests.map(i => `<span class="swipe-tag">${i}</span>`).join('')}
                        </div>
                    </div>
                ` : ''}
                ${user.looking_for && user.looking_for.length > 0 ? `
                    <div class="swipe-card-section">
                        <h4>Looking For</h4>
                        <div class="swipe-card-tags">
                            ${user.looking_for.map(l => `<span class="swipe-tag">${l}</span>`).join('')}
                        </div>
                    </div>
                ` : ''}
                ${(user.linkedin_url || user.github_url) ? `
                    <div class="swipe-card-links">
                        ${user.linkedin_url ? `<a href="${user.linkedin_url}" target="_blank" rel="noopener noreferrer" class="swipe-link" onclick="event.stopPropagation()">🔗 LinkedIn</a>` : ''}
                        ${user.github_url ? `<a href="${user.github_url}" target="_blank" rel="noopener noreferrer" class="swipe-link" onclick="event.stopPropagation()">💻 GitHub</a>` : ''}
                    </div>
                ` : ''}
            </div>
        </div>
    `;
    
    currentCard = document.getElementById('currentCard');
    
    // Setup touch/mouse events for swiping
    setupSwipeEvents();
}

// Setup swipe events
function setupSwipeEvents() {
    if (!currentCard) return;
    
    currentCard.addEventListener('touchstart', handleStart, { passive: true });
    currentCard.addEventListener('touchmove', handleMove, { passive: true });
    currentCard.addEventListener('touchend', handleEnd);
    
    currentCard.addEventListener('mousedown', handleStart);
    currentCard.addEventListener('mousemove', handleMove);
    currentCard.addEventListener('mouseup', handleEnd);
    currentCard.addEventListener('mouseleave', handleEnd);
}

function handleStart(e) {
    isDragging = true;
    startX = e.touches ? e.touches[0].clientX : e.clientX;
    currentCard.style.transition = 'none';
}

function handleMove(e) {
    if (!isDragging || !currentCard) return;
    
    e.preventDefault();
    currentX = (e.touches ? e.touches[0].clientX : e.clientX) - startX;
    const rotation = currentX * 0.1;
    
    currentCard.style.transform = `translateX(${currentX}px) rotate(${rotation}deg)`;
    
    // Change opacity based on swipe direction
    if (currentX > 0) {
        currentCard.style.borderColor = '#1dbf73';
    } else if (currentX < 0) {
        currentCard.style.borderColor = '#ff4757';
    }
}

function handleEnd() {
    if (!isDragging || !currentCard) return;
    
    isDragging = false;
    currentCard.style.transition = 'transform 0.3s ease-out';
    
    const threshold = 100;
    
    if (Math.abs(currentX) > threshold) {
        if (currentX > 0) {
            // Swipe right - connect
            swipeCard('right');
        } else {
            // Swipe left - skip
            swipeCard('left');
        }
    } else {
        // Snap back
        currentCard.style.transform = 'translateX(0) rotate(0deg)';
        currentCard.style.borderColor = '';
    }
    
    currentX = 0;
}

// Handle swipe action
function handleSwipe(direction) {
    if (!currentCard) return;
    swipeCard(direction);
}

// Animate card swipe
function swipeCard(direction) {
    if (!currentCard) return;
    
    const directionValue = direction === 'right' ? 1000 : -1000;
    currentCard.style.transform = `translateX(${directionValue}px) rotate(${direction === 'right' ? 30 : -30}deg)`;
    currentCard.style.opacity = '0';
    
    setTimeout(() => {
        if (direction === 'right') {
            // User swiped right - connect/accept
            handleConnect();
        } else {
            // User swiped left - skip
            handleSkip();
        }
        
        currentUserIndex++;
        showNextCard();
    }, 300);
}

// Handle connect (swipe right)
async function handleConnect() {
    const user = allUsers[currentUserIndex];
    console.log('Connected with:', user.full_name);
    
    // Here you could create a connection/match record
    // For now, just show a notification
    showNotification(`✅ Connected with ${user.full_name}!`, 'success');
}

// Handle skip (swipe left)
function handleSkip() {
    const user = allUsers[currentUserIndex];
    console.log('Skipped:', user.full_name);
    showNotification(`Skipped ${user.full_name}`, 'info');
}

// Show notification
function showNotification(message, type) {
    // Create a temporary notification element
    const notification = document.createElement('div');
    notification.className = `swipe-notification ${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 25px;
        background: ${type === 'success' ? '#1dbf73' : '#74767e'};
        color: white;
        border-radius: 8px;
        z-index: 1000;
        animation: slideIn 0.3s ease-out;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 2000);
}

// Helper functions
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

async function safeJsonParse(response) {
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
        try {
            return await response.json();
        } catch (e) {
            const text = await response.text();
            throw new Error(text || 'Invalid JSON response');
        }
    } else {
        const text = await response.text();
        try {
            return JSON.parse(text);
        } catch (e) {
            throw new Error(text || 'Server error');
        }
    }
}
