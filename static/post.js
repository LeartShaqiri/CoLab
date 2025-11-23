// Post page specific functionality
const API_BASE = '/api';
let currentPostType = 'thought'; // 'thought' or 'help'
let selectedImage = null;

// Initialize page
window.addEventListener('DOMContentLoaded', () => {
    // Initialize theme first (before checkAuth)
    initDarkMode();
    checkAuth();
    handlePostFormVisibility();
    initPostTypeSelector();
    initImageUpload();
    initSlotSelector();
    loadPosts();
    
    // Form submission
    const form = document.getElementById('createPostForm');
    if (form) {
        form.addEventListener('submit', handlePostSubmit);
    }
    
    // Refresh button
    const refreshBtn = document.getElementById('refreshPostsBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', loadPosts);
    }
});

// Initialize dark mode from localStorage
function initDarkMode() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateDarkModeIcon(savedTheme);
    
    // Setup dark mode toggle - wait a bit to ensure element exists
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

// Check authentication and show/hide post form
function handlePostFormVisibility() {
    const createPostSection = document.querySelector('.create-post-section');
    const userData = localStorage.getItem('currentUser');
    
    if (!userData && createPostSection) {
        createPostSection.style.display = 'none';
    } else if (createPostSection) {
        createPostSection.style.display = 'block';
    }
}

// Post type selector
function initPostTypeSelector() {
    const thoughtBtn = document.getElementById('thoughtBtn');
    const helpBtn = document.getElementById('helpBtn');
    const slotGroup = document.getElementById('slotGroup');
    
    const selectedPostTypeDiv = document.getElementById('selectedPostType');
    const selectedTypeText = document.getElementById('selectedTypeText');
    
    if (thoughtBtn) {
        thoughtBtn.addEventListener('click', (e) => {
            e.preventDefault();
            currentPostType = 'thought';
            thoughtBtn.classList.add('active');
            if (helpBtn) helpBtn.classList.remove('active');
            if (slotGroup) slotGroup.style.display = 'none';
            const selectedSlots = document.getElementById('selectedSlots');
            if (selectedSlots) selectedSlots.value = '1';
            if (selectedPostTypeDiv) selectedPostTypeDiv.style.display = 'block';
            if (selectedTypeText) selectedTypeText.textContent = 'Share a Thought';
            console.log('Post type selected: thought');
        });
    }
    
    if (helpBtn) {
        helpBtn.addEventListener('click', (e) => {
            e.preventDefault();
            currentPostType = 'help';
            helpBtn.classList.add('active');
            if (thoughtBtn) thoughtBtn.classList.remove('active');
            if (slotGroup) slotGroup.style.display = 'block';
            if (selectedPostTypeDiv) selectedPostTypeDiv.style.display = 'block';
            if (selectedTypeText) selectedTypeText.textContent = 'Need Help';
            console.log('Post type selected: help');
        });
    }
    
    // Show selected type indicator on page load (default is thought)
    if (selectedPostTypeDiv && selectedTypeText) {
        selectedPostTypeDiv.style.display = 'block';
        selectedTypeText.textContent = 'Share a Thought';
    }
}

// Image upload with size validation
function initImageUpload() {
    const imageInput = document.getElementById('postImageInput');
    const imagePreview = document.getElementById('postImagePreview');
    const imagePreviewImg = document.getElementById('postImagePreviewImg');
    const removeBtn = document.getElementById('removePostImageBtn');
    const imageError = document.getElementById('imageError');
    
    if (imageInput) {
        imageInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            // Check file size (max 2MB)
            const maxSize = 2 * 1024 * 1024; // 2MB in bytes
            if (file.size > maxSize) {
                imageError.style.display = 'block';
                imageError.className = 'alert error';
                imageError.textContent = 'Image size must be less than 2MB. Please choose a smaller image.';
                imageInput.value = '';
                selectedImage = null;
                return;
            }
            
            // Check if it's an image
            if (!file.type.startsWith('image/')) {
                imageError.style.display = 'block';
                imageError.className = 'alert error';
                imageError.textContent = 'Please select a valid image file.';
                imageInput.value = '';
                selectedImage = null;
                return;
            }
            
            // Read and preview image
            const reader = new FileReader();
            reader.onload = (event) => {
                selectedImage = event.target.result; // Base64 string
                imagePreviewImg.src = selectedImage;
                imagePreview.style.display = 'block';
                imageError.style.display = 'none';
            };
            reader.readAsDataURL(file);
        });
    }
    
    if (removeBtn) {
        removeBtn.addEventListener('click', () => {
            selectedImage = null;
            imagePreview.style.display = 'none';
            if (imageInput) imageInput.value = '';
            if (imageError) imageError.style.display = 'none';
        });
    }
}

// Slot selector
function initSlotSelector() {
    const slotOptions = document.querySelectorAll('.slot-option');
    const selectedSlotsInput = document.getElementById('selectedSlots');
    
    slotOptions.forEach(option => {
        option.addEventListener('click', () => {
            slotOptions.forEach(opt => opt.classList.remove('active'));
            option.classList.add('active');
            if (selectedSlotsInput) {
                selectedSlotsInput.value = option.getAttribute('data-slots');
            }
        });
    });
    
    // Set first option as active by default
    if (slotOptions.length > 0 && selectedSlotsInput) {
        slotOptions[0].classList.add('active');
        selectedSlotsInput.value = slotOptions[0].getAttribute('data-slots');
    }
}

// Handle post submission
async function handlePostSubmit(e) {
    e.preventDefault();
    
    // Check if user is logged in
    const userData = localStorage.getItem('currentUser');
    if (!userData) {
        alert('Please login first to create a post');
        return;
    }
    
    const currentUser = JSON.parse(userData);
    
    // Validate post type is selected
    if (!currentPostType) {
        showPostResult('Please select a post type (Share a Thought or Need Help)', 'error');
        return;
    }
    
    const content = document.getElementById('postContent').value.trim();
    if (!content) {
        showPostResult('Please enter some content for your post', 'error');
        return;
    }
    
    const submitBtn = document.getElementById('submitPostBtn');
    const resultDiv = document.getElementById('postResult');
    
    // Disable submit button
    submitBtn.disabled = true;
    submitBtn.textContent = 'Posting...';
    resultDiv.style.display = 'none';
    
    try {
        // Prepare post data
        const postData = {
            content: content,
            image: selectedImage || null,
            slot_count: currentPostType === 'help' ? parseInt(document.getElementById('selectedSlots').value) : 1,
            post_type: currentPostType
        };
        
        const userData = localStorage.getItem('currentUser');
        if (!userData) {
            showPostResult('Please login first to create a post', 'error');
            return;
        }
        
        const currentUser = JSON.parse(userData);
        const response = await fetch(`${API_BASE}/posts?author_id=${currentUser.id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(postData)
        });
        
        if (response.ok) {
            const post = await safeJsonParse(response);
            showPostResult('Post created successfully!', 'success');
            
            // Reset form
            document.getElementById('createPostForm').reset();
            selectedImage = null;
            const imagePreview = document.getElementById('postImagePreview');
            if (imagePreview) imagePreview.style.display = 'none';
            const imageInput = document.getElementById('postImageInput');
            if (imageInput) imageInput.value = '';
            
            // Reset post type to default
            currentPostType = 'thought';
            const thoughtBtn = document.getElementById('thoughtBtn');
            const helpBtn = document.getElementById('helpBtn');
            const slotGroup = document.getElementById('slotGroup');
            if (thoughtBtn) thoughtBtn.classList.add('active');
            if (helpBtn) helpBtn.classList.remove('active');
            if (slotGroup) slotGroup.style.display = 'none';
            
            // Reload posts and scroll to the new post
            setTimeout(async () => {
                await loadPosts();
                resultDiv.style.display = 'none';
                
                // Scroll to the posts feed section to show the new post
                const postsSection = document.querySelector('.posts-section');
                if (postsSection) {
                    // Small delay to ensure DOM is updated
                    setTimeout(() => {
                        postsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        
                        // Highlight the new post briefly
                        const newPost = document.querySelector(`[data-post-id="${post.id}"]`);
                        if (newPost) {
                            newPost.style.transition = 'all 0.3s ease';
                            newPost.style.transform = 'scale(1.02)';
                            newPost.style.boxShadow = '0 8px 24px rgba(29, 191, 115, 0.3)';
                            setTimeout(() => {
                                newPost.style.transform = 'scale(1)';
                                newPost.style.boxShadow = '';
                            }, 2000);
                        }
                    }, 300);
                }
            }, 1000);
        } else {
            const error = await safeJsonParse(response);
            showPostResult(error.detail || 'Failed to create post', 'error');
        }
    } catch (error) {
        showPostResult(`Error: ${error.message}`, 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Post';
    }
}

// Show post result message
function showPostResult(message, type) {
    const resultDiv = document.getElementById('postResult');
    resultDiv.textContent = message;
    resultDiv.className = `alert ${type}`;
    resultDiv.style.display = 'block';
}

// Load and display posts
async function loadPosts() {
    const postsFeed = document.getElementById('postsFeed');
    if (!postsFeed) return;
    
    postsFeed.innerHTML = '<div class="loading">Loading posts...</div>';
    
    try {
        const response = await fetch(`${API_BASE}/posts`);
        if (response.ok) {
            const posts = await safeJsonParse(response);
            
            if (posts.length === 0) {
                postsFeed.innerHTML = '<div class="empty-state"><h3>No posts yet</h3><p>Be the first to share something!</p></div>';
                return;
            }
            
            // Sort posts by created_at (newest first)
            posts.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            
            postsFeed.innerHTML = posts.map((post, index) => {
                const author = post.author || {};
                const initials = author.full_name ? author.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : '?';
                const avatar = author.profile_picture || `data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2250%22 height=%2250%22%3E%3Ccircle cx=%2225%22 cy=%2225%22 r=%2223%22 fill=%22%231dbf73%22/%3E%3Ctext x=%2225%22 y=%2230%22 font-size=%2216%22 fill=%22white%22 text-anchor=%22middle%22%3E${initials}%3C/text%3E%3C/svg%3E`;
                
                const postType = post.post_type || 'thought';
                const postTypeLabel = postType === 'help' ? '🆘 Need Help' : '💭 Share a Thought';
                const postTypeClass = postType === 'help' ? 'post-type-help' : 'post-type-thought';
                
                const timeAgo = getTimeAgo(new Date(post.created_at));
                
                return `
                    <div class="post-card ${postTypeClass}" data-post-id="${post.id}">
                        <div class="post-header">
                            <img src="${avatar}" alt="${author.full_name || 'User'}" class="post-author-avatar" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2250%22 height=%2250%22%3E%3Ccircle cx=%2225%22 cy=%2225%22 r=%2223%22 fill=%22%231dbf73%22/%3E%3Ctext x=%2225%22 y=%2230%22 font-size=%2216%22 fill=%22white%22 text-anchor=%22middle%22%3E${initials}%3C/text%3E%3C/svg%3E'">
                            <div class="post-author-info">
                                <h3>${author.full_name || 'Unknown User'}</h3>
                                <div class="post-time">${timeAgo}</div>
                            </div>
                            <div class="post-type-badge ${postTypeClass}">${postTypeLabel}</div>
                        </div>
                        <div class="post-content">${escapeHtml(post.content || '')}</div>
                        ${post.image ? `
                            <div class="post-image">
                                <img src="${post.image}" alt="Post image" style="max-width: 100%; max-height: 500px; border-radius: 8px; object-fit: contain;">
                            </div>
                        ` : ''}
                        ${postType === 'help' && post.slot_count ? `
                            <div class="post-slots-info">
                                <strong>Collaboration Slots:</strong> ${post.filled_slots || 0} / ${post.slot_count}
                                ${post.slots && post.slots.length > 0 ? `
                                    <div class="slot-users" style="margin-top: 10px;">
                                        ${post.slots.map(slot => {
                                            const slotUser = slot.user || {};
                                            return `<span class="slot-user-tag">${slotUser.full_name || slotUser.username || 'User'}</span>`;
                                        }).join('')}
                                    </div>
                                ` : ''}
                            </div>
                        ` : ''}
                    </div>
                `;
            }).join('');
        } else {
            postsFeed.innerHTML = '<div class="alert error">Failed to load posts</div>';
        }
    } catch (error) {
        postsFeed.innerHTML = `<div class="alert error">Error: ${error.message}</div>`;
    }
}

// Helper function to get time ago
function getTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    
    return date.toLocaleDateString();
}

// Helper function to escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML.replace(/\n/g, '<br>');
}

// Helper function to safely parse JSON
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

