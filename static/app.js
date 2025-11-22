const API_BASE = '/api';
let currentUser = null;

// Helper function to safely parse JSON responses
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

// Load users on page load
window.addEventListener('DOMContentLoaded', () => {
    // Check auth first, then load users (so match percentages are included)
    checkAuth();
    loadUsers();
});

// Check if user is logged in
function checkAuth() {
    const userData = localStorage.getItem('currentUser');
    if (userData) {
        currentUser = JSON.parse(userData);
        showUserProfile();
    }
}

// Show user profile in header
function showUserProfile() {
    document.getElementById('headerActions').style.display = 'none';
    document.getElementById('userProfile').style.display = 'flex';
    document.getElementById('profileName').textContent = currentUser.full_name;
    if (currentUser.profile_picture) {
        document.getElementById('profileImg').src = currentUser.profile_picture;
    }
    document.getElementById('searchSection').style.display = 'block';
}

// Hide user profile
function hideUserProfile() {
    document.getElementById('headerActions').style.display = 'flex';
    document.getElementById('userProfile').style.display = 'none';
    document.getElementById('searchSection').style.display = 'none';
    currentUser = null;
    localStorage.removeItem('currentUser');
}

// Modal handling
const loginModal = document.getElementById('loginModal');
const signupModal = document.getElementById('signupModal');
const profileModal = document.getElementById('profileModal');

document.getElementById('loginBtn').addEventListener('click', () => {
    loginModal.style.display = 'block';
});

document.getElementById('signupBtn').addEventListener('click', () => {
    signupModal.style.display = 'block';
});

document.getElementById('editProfileBtn').addEventListener('click', () => {
    openProfileModal();
});

document.getElementById('logoutBtn').addEventListener('click', () => {
    hideUserProfile();
});

document.querySelectorAll('.close').forEach(closeBtn => {
    closeBtn.addEventListener('click', (e) => {
        e.target.closest('.modal').style.display = 'none';
    });
});

window.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
        e.target.style.display = 'none';
    }
});

// Login
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const resultDiv = document.getElementById('loginResult');
    resultDiv.className = 'alert';
    resultDiv.textContent = '';
    
    const credentials = {
        username: document.getElementById('loginUsername').value,
        password: document.getElementById('loginPassword').value
    };
    
    try {
        const response = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(credentials)
        });
        
        if (response.ok) {
            currentUser = await safeJsonParse(response);
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            resultDiv.className = 'alert success';
            resultDiv.textContent = 'Login successful!';
            setTimeout(() => {
                loginModal.style.display = 'none';
                showUserProfile();
                document.getElementById('loginForm').reset();
                loadUsers(); // Reload users to show match percentages
            }, 1000);
        } else {
            try {
                const error = await safeJsonParse(response);
                resultDiv.className = 'alert error';
                resultDiv.textContent = error.detail || 'Login failed';
            } catch (e) {
                resultDiv.className = 'alert error';
                resultDiv.textContent = `Login failed: ${e.message}`;
            }
        }
    } catch (error) {
        resultDiv.className = 'alert error';
        resultDiv.textContent = `Error: ${error.message}`;
    }
});

// Signup
document.getElementById('signupForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const resultDiv = document.getElementById('signupResult');
    resultDiv.className = 'alert';
    resultDiv.textContent = '';
    
    const userData = {
        email: document.getElementById('signupEmail').value,
        username: document.getElementById('signupUsername').value,
        password: document.getElementById('signupPassword').value,
        full_name: document.getElementById('signupFullName').value
    };
    
    try {
        const response = await fetch(`${API_BASE}/users`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userData)
        });
        
        if (response.ok) {
            const user = await safeJsonParse(response);
            resultDiv.className = 'alert success';
            resultDiv.textContent = 'Account created! Please login.';
            setTimeout(() => {
                signupModal.style.display = 'none';
                loginModal.style.display = 'block';
                document.getElementById('signupForm').reset();
            }, 1500);
        } else {
            try {
                const error = await safeJsonParse(response);
                resultDiv.className = 'alert error';
                resultDiv.textContent = error.detail || 'Signup failed';
            } catch (e) {
                resultDiv.className = 'alert error';
                resultDiv.textContent = `Signup failed: ${e.message}`;
            }
        }
    } catch (error) {
        resultDiv.className = 'alert error';
        resultDiv.textContent = `Error: ${error.message}`;
    }
});

// Profile Management
let interests = [];
let languages = [];

function openProfileModal() {
    if (!currentUser) return;
    
    // Load current profile data
    document.getElementById('profilePictureUrl').value = currentUser.profile_picture || '';
    document.getElementById('profileBio').value = currentUser.bio || '';
    document.getElementById('profileLocation').value = currentUser.location || '';
    document.getElementById('profileLinkedIn').value = currentUser.linkedin_url || '';
    document.getElementById('profileGitHub').value = currentUser.github_url || '';
    
    interests = currentUser.interests || [];
    languages = currentUser.looking_for || [];
    
    renderInterests();
    renderLanguages();
    updateProfilePreview();
    
    profileModal.style.display = 'block';
}

// Interests handling
document.getElementById('interestInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        const value = e.target.value.trim();
        if (value && !value.startsWith('#')) {
            addInterest('#' + value);
        } else if (value) {
            addInterest(value);
        }
        e.target.value = '';
    }
});

function addInterest(tag) {
    if (tag && !interests.includes(tag)) {
        interests.push(tag);
        renderInterests();
    }
}

function removeInterest(tag) {
    interests = interests.filter(t => t !== tag);
    renderInterests();
}


function renderInterests() {
    const container = document.getElementById('interestsContainer');
    container.innerHTML = interests.map((tag, index) => `
        <span class="tag interest" data-tag-index="${index}">
            ${tag}
            <span class="remove" data-action="remove-interest" data-index="${index}">×</span>
        </span>
    `).join('');
    
    // Add event listeners
    container.querySelectorAll('[data-action="remove-interest"]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = parseInt(e.target.dataset.index);
            interests.splice(index, 1);
            renderInterests();
        });
    });
}

// Languages handling
document.getElementById('addLanguageBtn').addEventListener('click', () => {
    const input = document.getElementById('languageInput');
    const value = input.value.trim().toLowerCase();
    if (value) {
        addLanguage('#' + value);
        input.value = '';
    }
});

document.getElementById('languageInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        const value = e.target.value.trim().toLowerCase();
        if (value) {
            addLanguage('#' + value);
            e.target.value = '';
        }
    }
});

function addLanguage(tag) {
    if (tag && !languages.includes(tag)) {
        languages.push(tag);
        renderLanguages();
    }
}

function removeLanguage(tag) {
    languages = languages.filter(t => t !== tag);
    renderLanguages();
}

function renderLanguages() {
    const container = document.getElementById('languagesContainer');
    container.innerHTML = languages.map((tag, index) => `
        <span class="tag language" data-tag-index="${index}">
            ${tag}
            <span class="remove" data-action="remove-language" data-index="${index}">×</span>
        </span>
    `).join('');
    
    // Add event listeners
    container.querySelectorAll('[data-action="remove-language"]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = parseInt(e.target.dataset.index);
            languages.splice(index, 1);
            renderLanguages();
        });
    });
}

// Profile picture preview
document.getElementById('profilePictureUrl').addEventListener('input', updateProfilePreview);

function updateProfilePreview() {
    const url = document.getElementById('profilePictureUrl').value;
    const preview = document.getElementById('profilePreview');
    if (url) {
        preview.innerHTML = `<img src="${url}" alt="Preview" onerror="this.style.display='none'">`;
    } else {
        preview.innerHTML = '';
    }
}

// Save profile
document.getElementById('profileForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentUser) return;
    
    const resultDiv = document.getElementById('profileResult');
    resultDiv.className = 'alert';
    resultDiv.textContent = '';
    
    const updateData = {
        profile_picture: document.getElementById('profilePictureUrl').value || null,
        bio: document.getElementById('profileBio').value || null,
        interests: interests,
        looking_for: languages,
        location: document.getElementById('profileLocation').value || null,
        linkedin_url: document.getElementById('profileLinkedIn').value || null,
        github_url: document.getElementById('profileGitHub').value || null
    };
    
    try {
        const response = await fetch(`${API_BASE}/users/${currentUser.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updateData)
        });
        
        if (response.ok) {
            const updated = await safeJsonParse(response);
            currentUser = updated;
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            resultDiv.className = 'alert success';
            resultDiv.textContent = 'Profile updated successfully!';
            showUserProfile();
            setTimeout(() => {
                profileModal.style.display = 'none';
            }, 1500);
        } else {
            try {
                const error = await safeJsonParse(response);
                resultDiv.className = 'alert error';
                resultDiv.textContent = error.detail || 'Failed to update profile';
            } catch (e) {
                resultDiv.className = 'alert error';
                resultDiv.textContent = `Failed to update profile: ${e.message}`;
            }
        }
    } catch (error) {
        resultDiv.className = 'alert error';
        resultDiv.textContent = `Error: ${error.message}`;
    }
});

// Load users
function loadUsers() {
    const usersList = document.getElementById('usersList');
    usersList.innerHTML = '<div class="loading">Loading users...</div>';
    
    // Include current user ID if logged in to get match percentages
    const url = currentUser 
        ? `${API_BASE}/users?current_user_id=${currentUser.id}`
        : `${API_BASE}/users`;
    
    fetch(url)
        .then(async res => {
            if (!res.ok) {
                throw new Error(`HTTP error! status: ${res.status}`);
            }
            return await safeJsonParse(res);
        })
        .then(users => {
            if (users.length === 0) {
                usersList.innerHTML = '<div class="empty-state"><h3>No users yet</h3><p>Be the first to sign up!</p></div>';
                return;
            }
            
            usersList.innerHTML = users.map(user => {
                const initials = user.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
                const avatar = user.profile_picture || `data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2250%22 height=%2250%22%3E%3Ccircle cx=%2225%22 cy=%2225%22 r=%2223%22 fill=%22%231dbf73%22/%3E%3Ctext x=%2225%22 y=%2230%22 font-size=%2216%22 fill=%22white%22 text-anchor=%22middle%22%3E${initials}%3C/text%3E%3C/svg%3E`;
                
                // Show match percentage if available
                const matchBadge = user.interest_match !== undefined && user.interest_match !== null
                    ? `<div class="interest-match-badge">${(user.interest_match * 100).toFixed(0)}% Match</div>`
                    : '';
                
                return `
                    <div class="user-card">
                        ${matchBadge}
                        <div class="user-card-header">
                            <img src="${avatar}" alt="${user.full_name}" class="user-avatar" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2250%22 height=%2250%22%3E%3Ccircle cx=%2225%22 cy=%2225%22 r=%2223%22 fill=%22%231dbf73%22/%3E%3Ctext x=%2225%22 y=%2230%22 font-size=%2216%22 fill=%22white%22 text-anchor=%22middle%22%3E${initials}%3C/text%3E%3C/svg%3E'">
                            <div class="user-info">
                                <h3>${user.full_name}</h3>
                                <div class="username">@${user.username}</div>
                            </div>
                        </div>
                        ${user.location ? `<div class="location">📍 ${user.location}</div>` : ''}
                        ${user.bio ? `<div class="bio">${user.bio}</div>` : ''}
                        ${user.interests && user.interests.length > 0 ? `
                            <div class="skills">
                                ${user.interests.map(i => `<span class="skill-tag">${i}</span>`).join('')}
                            </div>
                        ` : ''}
                        ${user.looking_for && user.looking_for.length > 0 ? `
                            <div class="skills" style="margin-top: 8px;">
                                <strong style="font-size: 0.85em; color: var(--text-light);">Looking for:</strong>
                                ${user.looking_for.map(l => `<span class="skill-tag">${l}</span>`).join('')}
                            </div>
                        ` : ''}
                        ${(user.linkedin_url || user.github_url) ? `
                            <div class="social-links" style="margin-top: 12px; display: flex; gap: 10px;">
                                ${user.linkedin_url ? `<a href="${user.linkedin_url}" target="_blank" rel="noopener noreferrer" class="social-link linkedin">🔗 LinkedIn</a>` : ''}
                                ${user.github_url ? `<a href="${user.github_url}" target="_blank" rel="noopener noreferrer" class="social-link github">💻 GitHub</a>` : ''}
                            </div>
                        ` : ''}
                    </div>
                `;
            }).join('');
        })
        .catch(error => {
            usersList.innerHTML = `<div class="alert error">Error: ${error.message}</div>`;
        });
}

document.getElementById('loadUsersBtn').addEventListener('click', loadUsers);

// Find matches
document.getElementById('matchForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentUser) {
        alert('Please login first');
        return;
    }
    
    const matchesList = document.getElementById('matchesList');
    matchesList.innerHTML = '<div class="loading">🔍 Finding your perfect matches...</div>';
    
    const skills = document.getElementById('matchSkills').value
        .split(',')
        .map(s => s.trim())
        .filter(s => s);
    
    const matchData = {
        user_id: currentUser.id,
        required_skill_names: skills.length > 0 ? skills : null,
        top_k: 12
    };
    
    try {
        const response = await fetch(`${API_BASE}/match`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(matchData)
        });
        
        if (response.ok) {
            const result = await safeJsonParse(response);
            
            if (result.matches.length === 0) {
                matchesList.innerHTML = '<div class="empty-state"><h3>No matches found</h3><p>Try adjusting your search criteria.</p></div>';
                return;
            }
            
            matchesList.innerHTML = result.matches.map(match => {
                const user = match.matched_user;
                const initials = user.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
                const avatar = user.profile_picture || `data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2250%22 height=%2250%22%3E%3Ccircle cx=%2225%22 cy=%2225%22 r=%2223%22 fill=%22%231dbf73%22/%3E%3Ctext x=%2225%22 y=%2230%22 font-size=%2216%22 fill=%22white%22 text-anchor=%22middle%22%3E${initials}%3C/text%3E%3C/svg%3E`;
                
                // Interest match percentage
                const interestMatch = user.interest_match !== undefined && user.interest_match !== null
                    ? `<div class="interest-match-score">${(user.interest_match * 100).toFixed(0)}% Interest Match</div>`
                    : '';
                
                return `
                    <div class="match-card">
                        <div class="match-score">${(match.match_score * 100).toFixed(0)}% Skill Match</div>
                        ${interestMatch}
                        <div class="match-card-header">
                            <div class="user-card-header">
                                <img src="${avatar}" alt="${user.full_name}" class="user-avatar" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2250%22 height=%2250%22%3E%3Ccircle cx=%2225%22 cy=%2225%22 r=%2223%22 fill=%22%231dbf73%22/%3E%3Ctext x=%2225%22 y=%2230%22 font-size=%2216%22 fill=%22white%22 text-anchor=%22middle%22%3E${initials}%3C/text%3E%3C/svg%3E'">
                                <div class="user-info">
                                    <h3>${user.full_name}</h3>
                                    <div class="username">@${user.username}</div>
                                </div>
                            </div>
                        </div>
                        ${user.bio ? `<div class="bio">${user.bio}</div>` : ''}
                        ${(user.linkedin_url || user.github_url) ? `
                            <div class="social-links" style="margin-bottom: 15px; display: flex; gap: 10px;">
                                ${user.linkedin_url ? `<a href="${user.linkedin_url}" target="_blank" rel="noopener noreferrer" class="social-link linkedin">🔗 LinkedIn</a>` : ''}
                                ${user.github_url ? `<a href="${user.github_url}" target="_blank" rel="noopener noreferrer" class="social-link github">💻 GitHub</a>` : ''}
                            </div>
                        ` : ''}
                        <div class="match-details">
                            ${match.complementary_skills.length > 0 ? `
                                <div class="match-detail-row">
                                    <strong>Adds Skills:</strong>
                                    <div class="skills">
                                        ${match.complementary_skills.map(s => `<span class="skill-tag">${s}</span>`).join('')}
                                    </div>
                                </div>
                            ` : ''}
                            ${match.shared_skills.length > 0 ? `
                                <div class="match-detail-row">
                                    <strong>Shared Skills:</strong>
                                    <div class="skills">
                                        ${match.shared_skills.map(s => `<span class="skill-tag shared">${s}</span>`).join('')}
                                    </div>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                `;
            }).join('');
        } else {
            try {
                const error = await safeJsonParse(response);
                matchesList.innerHTML = `<div class="alert error">Error: ${error.detail || 'Failed to find matches'}</div>`;
            } catch (e) {
                matchesList.innerHTML = `<div class="alert error">Error: ${e.message}</div>`;
            }
        }
    } catch (error) {
        matchesList.innerHTML = `<div class="alert error">Error: ${error.message}</div>`;
    }
});
