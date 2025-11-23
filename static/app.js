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
    // Initialize theme first (before other operations)
    initDarkMode();
    
    // Check auth first, then load users (so match percentages are included)
    checkAuth();
    
    // Only load users if we're on the home page (index.html)
    if (document.getElementById('usersList')) {
        loadUsers();
    }
});

// Dark Mode Toggle
function initDarkMode() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateDarkModeIcon(savedTheme);
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

// Setup dark mode toggle - check if element exists first
const darkModeToggle = document.getElementById('darkModeToggle');
if (darkModeToggle) {
    // Remove any existing listeners to avoid duplicates
    darkModeToggle.removeEventListener('click', toggleDarkMode);
    darkModeToggle.addEventListener('click', toggleDarkMode);
}

// Quiz Data
const frontendQuizzes = [
    {
        code: `<div class="container">
    <h1>Welcome</h1>
    <p class="text">Hello World</p>
    <button onclick="submit()">Submit</button>
</div>

<style>
    .container {
        width: 100%;
        padding: 20px;
    }
    h1 {
        color: blue;
        font-size: 24px;
    }
    .text {
        color: red;
    }
    button {
        background-color: green;
        color: white;
    }
</style>`,
        correctLines: [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25],
        description: "The CSS is placed inside the HTML file, but it should be in a separate file or properly formatted."
    },
    {
        code: `<div>
    <h1>Title</h1>
    <p>Content</p>
</div>

<style>
    div {
        color: blue;
    }
    h1 {
        font-size: 24px;
    }
    p {
        margin: 10px;
    }
</style>`,
        correctLines: [8],
        description: "The CSS selector 'div' is too broad and will affect all divs. It should be more specific."
    },
    {
        code: `<button class="btn-primary">Click Me</button>

<style>
    .btn-primary {
        background-color: #1dbf73;
        color: white;
        padding: 10px 20px;
        border: none;
        border-radius: 5px;
    }
    .btn-primary:hover {
        background-color: #19a463;
    }
</style>`,
        correctLines: [5, 6, 7, 8, 9, 10, 11],
        description: "The button is missing a cursor pointer style and transition effects for better UX."
    }
];

const pythonQuizzes = [
    {
        code: `def calculate_sum(a, b):
    result = a + b
    return result

def main():
    x = 10
    y = 20
    sum_result = calculate_sum(x, y)
    print("The sum is: " + sum_result)

main()`,
        correctLines: [7],
        description: "Type error: trying to concatenate string with integer. Should convert sum_result to string."
    },
    {
        code: `def divide_numbers(a, b):
    result = a / b
    return result

x = 10
y = 0
result = divide_numbers(x, y)
print(f"Result: {result}")`,
        correctLines: [2, 6],
        description: "Division by zero error. Need to check if b is zero before dividing."
    },
    {
        code: `def get_item(lst, index):
    return lst[index]

my_list = [1, 2, 3]
item = get_item(my_list, 5)
print(item)`,
        correctLines: [2, 5],
        description: "Index out of range error. Need to check if index is within list bounds."
    },
    {
        code: `def process_data(data):
    if data is None:
        return "No data"
    processed = data.upper()
    return processed

result = process_data(123)
print(result)`,
        correctLines: [4, 6],
        description: "AttributeError: integers don't have .upper() method. Need to check data type."
    }
];

// Quiz State
let frontendQuizIndex = 0;
let pythonQuizIndex = 0;
let frontendSelectedLines = new Set();
let pythonSelectedLines = new Set();

// Frontend Quiz Functions
function openFrontendQuiz() {
    const modal = document.getElementById('frontendQuizModal');
    modal.style.display = 'block';
    resetFrontendQuiz();
    loadFrontendQuestion();
}

function loadFrontendQuestion() {
    if (frontendQuizIndex >= frontendQuizzes.length) {
        frontendQuizIndex = 0;
    }
    
    const quiz = frontendQuizzes[frontendQuizIndex];
    frontendSelectedLines.clear();
    
    document.getElementById('frontendQuestionNum').textContent = frontendQuizIndex + 1;
    const codeBlock = document.getElementById('frontendCodeBlock');
    
    const lines = quiz.code.split('\n');
    codeBlock.innerHTML = lines.map((line, index) => {
        const lineNum = index + 1;
        return `<div class="code-line" data-line="${lineNum}" style="padding: 4px 8px; cursor: pointer; user-select: none; border-radius: 4px; transition: background 0.2s;">${escapeHtml(line || ' ')}</div>`;
    }).join('');
    
    // Add click handlers
    codeBlock.querySelectorAll('.code-line').forEach(lineEl => {
        lineEl.addEventListener('click', function() {
            const lineNum = parseInt(this.dataset.line);
            if (frontendSelectedLines.has(lineNum)) {
                frontendSelectedLines.delete(lineNum);
                this.style.background = '';
            } else {
                frontendSelectedLines.add(lineNum);
                this.style.background = 'rgba(29, 191, 115, 0.3)';
            }
        });
    });
    
    document.getElementById('frontendSubmitBtn').style.display = 'inline-block';
    document.getElementById('frontendNextBtn').style.display = 'none';
    document.getElementById('frontendQuizResult').style.display = 'none';
}

function submitFrontendAnswer() {
    const quiz = frontendQuizzes[frontendQuizIndex];
    const selected = Array.from(frontendSelectedLines).sort((a, b) => a - b);
    const correct = quiz.correctLines.sort((a, b) => a - b);
    
    const isCorrect = selected.length === correct.length && 
                     selected.every((val, idx) => val === correct[idx]);
    
    const resultDiv = document.getElementById('frontendQuizResult');
    resultDiv.style.display = 'block';
    
    if (isCorrect) {
        resultDiv.className = 'alert success';
        resultDiv.innerHTML = '<strong>✅ Correct!</strong> You found the problem!';
        document.getElementById('frontendSubmitBtn').style.display = 'none';
        document.getElementById('frontendNextBtn').style.display = 'inline-block';
    } else {
        resultDiv.className = 'alert error';
        resultDiv.innerHTML = '<strong>❌ Incorrect.</strong> Try again! The problem is: ' + quiz.description;
    }
}

function loadNextFrontendQuestion() {
    frontendQuizIndex++;
    loadFrontendQuestion();
}

function resetFrontendQuiz() {
    frontendQuizIndex = 0;
    frontendSelectedLines.clear();
    loadFrontendQuestion();
}

// Python Quiz Functions
function openPythonQuiz() {
    const modal = document.getElementById('pythonQuizModal');
    modal.style.display = 'block';
    resetPythonQuiz();
    loadPythonQuestion();
}

function loadPythonQuestion() {
    if (pythonQuizIndex >= pythonQuizzes.length) {
        pythonQuizIndex = 0;
    }
    
    const quiz = pythonQuizzes[pythonQuizIndex];
    pythonSelectedLines.clear();
    
    document.getElementById('pythonQuestionNum').textContent = pythonQuizIndex + 1;
    const codeBlock = document.getElementById('pythonCodeBlock');
    
    const lines = quiz.code.split('\n');
    codeBlock.innerHTML = lines.map((line, index) => {
        const lineNum = index + 1;
        return `<div class="code-line" data-line="${lineNum}" style="padding: 4px 8px; cursor: pointer; user-select: none; border-radius: 4px; transition: background 0.2s;">${escapeHtml(line || ' ')}</div>`;
    }).join('');
    
    // Add click handlers
    codeBlock.querySelectorAll('.code-line').forEach(lineEl => {
        lineEl.addEventListener('click', function() {
            const lineNum = parseInt(this.dataset.line);
            if (pythonSelectedLines.has(lineNum)) {
                pythonSelectedLines.delete(lineNum);
                this.style.background = '';
            } else {
                pythonSelectedLines.add(lineNum);
                this.style.background = 'rgba(29, 191, 115, 0.3)';
            }
        });
    });
    
    document.getElementById('pythonSubmitBtn').style.display = 'inline-block';
    document.getElementById('pythonNextBtn').style.display = 'none';
    document.getElementById('pythonQuizResult').style.display = 'none';
}

function submitPythonAnswer() {
    const quiz = pythonQuizzes[pythonQuizIndex];
    const selected = Array.from(pythonSelectedLines).sort((a, b) => a - b);
    const correct = quiz.correctLines.sort((a, b) => a - b);
    
    const isCorrect = selected.length === correct.length && 
                     selected.every((val, idx) => val === correct[idx]);
    
    const resultDiv = document.getElementById('pythonQuizResult');
    resultDiv.style.display = 'block';
    
    if (isCorrect) {
        resultDiv.className = 'alert success';
        resultDiv.innerHTML = '<strong>✅ Correct!</strong> You found the bug!';
        document.getElementById('pythonSubmitBtn').style.display = 'none';
        document.getElementById('pythonNextBtn').style.display = 'inline-block';
    } else {
        resultDiv.className = 'alert error';
        resultDiv.innerHTML = '<strong>❌ Incorrect.</strong> Try again! The problem is: ' + quiz.description;
    }
}

function loadNextPythonQuestion() {
    pythonQuizIndex++;
    loadPythonQuestion();
}

function resetPythonQuiz() {
    pythonQuizIndex = 0;
    pythonSelectedLines.clear();
    loadPythonQuestion();
}

// Helper function to escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Close quiz modals
document.addEventListener('DOMContentLoaded', () => {
    const frontendModal = document.getElementById('frontendQuizModal');
    const pythonModal = document.getElementById('pythonQuizModal');
    
    if (frontendModal) {
        frontendModal.querySelector('.close').onclick = () => {
            frontendModal.style.display = 'none';
            resetFrontendQuiz();
        };
    }
    
    if (pythonModal) {
        pythonModal.querySelector('.close').onclick = () => {
            pythonModal.style.display = 'none';
        };
    }
    
    window.onclick = (event) => {
        if (event.target === frontendModal) {
            frontendModal.style.display = 'none';
            resetFrontendQuiz();
        }
        if (event.target === pythonModal) {
            pythonModal.style.display = 'none';
        }
    };
});

// Helper function to get profile type emoji
function getProfileTypeEmoji(profileType) {
    if (!profileType) return '';
    return profileType === 'Coworker' ? '🤝' : '💻';
}

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
    const emoji = getProfileTypeEmoji(currentUser.profile_type);
    document.getElementById('profileName').textContent = `${emoji} ${currentUser.full_name}`;
    if (currentUser.profile_picture) {
        document.getElementById('profileImg').src = currentUser.profile_picture;
    }
    
    // Display profile type badge
    const badge = document.getElementById('profileTypeBadge');
    if (currentUser.profile_type) {
        badge.textContent = currentUser.profile_type === 'Coworker' ? '🤝' : '💻';
        badge.style.display = 'flex';
    } else {
        badge.style.display = 'none';
    }
    
    document.getElementById('searchSection').style.display = 'block';
    updateMessageBadge(); // Load message count
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
const userViewModal = document.getElementById('userViewModal');

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

// Message button
// Messaging functionality
let currentConversationId = null;
let currentChatUserId = null;

// Global function for onclick handlers
window.openMessagingModal = async function(userId, userName) {
    if (!currentUser) {
        alert('Please login to send messages');
        return;
    }
    
    currentChatUserId = userId;
    const messagingModal = document.getElementById('messagingModal');
    const greetingSelection = document.getElementById('greetingSelection');
    const chatInterface = document.getElementById('chatInterface');
    
    // Check if conversation already exists
    try {
        const conversationsResponse = await fetch(`${API_BASE}/conversations/${currentUser.id}`);
        if (conversationsResponse.ok) {
            const conversations = await safeJsonParse(conversationsResponse);
            const existingConv = conversations.find(c => 
                c.other_user.id === userId
            );
            
            if (existingConv) {
                // Open existing conversation
                currentConversationId = existingConv.id;
                currentChatUserId = userId;
                const chatInterface = document.getElementById('chatInterface');
                document.getElementById('chatUserName').textContent = `${getProfileTypeEmoji(existingConv.other_user.profile_type)} ${userName}`;
                greetingSelection.style.display = 'none';
                chatInterface.style.display = 'block';
                loadMessages(existingConv.id);
                messagingModal.style.display = 'block';
                return;
            }
        }
    } catch (error) {
        console.error('Error checking conversations:', error);
    }
    
    // Show greeting selection for new conversation
    greetingSelection.style.display = 'block';
    chatInterface.style.display = 'none';
    
    // Load pre-written messages
    try {
        const response = await fetch(`${API_BASE}/messages/pre-written`);
        if (response.ok) {
            const data = await safeJsonParse(response);
            const optionsContainer = document.getElementById('greetingOptions');
            optionsContainer.innerHTML = data.messages.map((msg, index) => `
                <button class="greeting-option" onclick="sendInitialMessage(${index}, '${msg.replace(/'/g, "\\'")}')" style="padding: 15px; text-align: left; border: 2px solid var(--border); border-radius: 8px; background: var(--bg); cursor: pointer; transition: all 0.2s;">
                    ${msg}
                </button>
            `).join('');
        }
    } catch (error) {
        console.error('Error loading pre-written messages:', error);
    }
    
    messagingModal.style.display = 'block';
}

// Global function for onclick handlers
window.sendInitialMessage = async function(index, message) {
    if (!currentUser || !currentChatUserId) return;
    
    try {
        const response = await fetch(`${API_BASE}/conversations?sender_id=${currentUser.id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                other_user_id: parseInt(currentChatUserId),
                initial_message: message
            })
        });
        
        if (response.ok) {
            const conversation = await safeJsonParse(response);
            currentConversationId = conversation.id;
            
            // Show success message and update badge
            updateMessageBadge();
            document.getElementById('greetingSelection').innerHTML = `
                <div style="text-align: center; padding: 40px;">
                    <div style="font-size: 3em; margin-bottom: 20px;">✅</div>
                    <h3>Message Sent!</h3>
                    <p style="color: var(--text-light);">Your message has been sent. Please wait for ${conversation.other_user.full_name} to reply.</p>
                    <button class="btn-primary" onclick="document.getElementById('messagingModal').style.display='none'; showConversationsList()" style="margin-top: 20px;">View Conversations</button>
                </div>
            `;
        } else {
            const error = await safeJsonParse(response);
            alert(error.detail || 'Failed to send message');
        }
    } catch (error) {
        alert('Error sending message: ' + error.message);
    }
}

async function loadMessages(conversationId) {
    if (!currentUser) return;
    
    const container = document.getElementById('messagesContainer');
    const inputContainer = document.getElementById('messageInputContainer');
    container.innerHTML = '<div class="loading">Loading messages...</div>';
    
    try {
        const response = await fetch(`${API_BASE}/conversations/${conversationId}/messages?user_id=${currentUser.id}`);
        if (response.ok) {
            const messages = await safeJsonParse(response);
            
            // Check if waiting for reply (only 1 message and it's an initial greeting from current user)
            const canSend = !(messages.length === 1 && messages[0].is_initial_greeting && messages[0].sender_id === currentUser.id);
            
            if (!canSend) {
                inputContainer.innerHTML = `
                    <div style="width: 100%; padding: 15px; background: var(--bg-light); border-radius: 8px; text-align: center; color: var(--text-light);">
                        ⏳ Waiting for reply... You can send messages once they respond.
                    </div>
                `;
            } else {
                inputContainer.innerHTML = `
                    <div style="display: flex; flex-direction: column; gap: 10px; width: 100%;">
                        <div style="display: flex; gap: 10px;">
                            <input type="text" id="messageInput" placeholder="Type your message..." style="flex: 1; padding: 12px; border: 1px solid var(--border); border-radius: 6px; font-size: 1em;">
                            <input type="file" id="imageFileInput" accept="image/*" style="display: none;">
                            <button class="btn-secondary" id="attachImageBtn" title="Attach Image" style="padding: 12px 16px; white-space: nowrap;">📷</button>
                            <button class="btn-primary" id="sendMessageBtn">Send</button>
                        </div>
                        <div id="imagePreviewContainer" style="display: none; margin-top: 10px;">
                            <div style="position: relative; display: inline-block;">
                                <img id="imagePreview" src="" alt="Preview" style="max-width: 200px; max-height: 200px; border-radius: 8px; border: 2px solid var(--border);">
                                <button id="removeImageBtn" style="position: absolute; top: -8px; right: -8px; background: var(--error, #ff4757); color: white; border: none; border-radius: 50%; width: 24px; height: 24px; cursor: pointer; font-size: 14px; display: flex; align-items: center; justify-content: center;">×</button>
                            </div>
                        </div>
                    </div>
                `;
                // Re-attach event listeners
                setTimeout(() => {
                    const messageInput = document.getElementById('messageInput');
                    const sendBtn = document.getElementById('sendMessageBtn');
                    const attachImageBtn = document.getElementById('attachImageBtn');
                    const imageFileInput = document.getElementById('imageFileInput');
                    const imagePreviewContainer = document.getElementById('imagePreviewContainer');
                    const imagePreview = document.getElementById('imagePreview');
                    const removeImageBtn = document.getElementById('removeImageBtn');
                    
                    if (messageInput && sendBtn) {
                        messageInput.addEventListener('keypress', (e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                sendMessageHandler();
                            }
                        });
                        sendBtn.addEventListener('click', sendMessageHandler);
                    }
                    
                    if (attachImageBtn && imageFileInput) {
                        attachImageBtn.addEventListener('click', () => {
                            imageFileInput.click();
                        });
                    }
                    
                    if (imageFileInput) {
                        imageFileInput.addEventListener('change', (e) => {
                            const file = e.target.files[0];
                            if (file && file.type.startsWith('image/')) {
                                const reader = new FileReader();
                                reader.onload = (event) => {
                                    imagePreview.src = event.target.result;
                                    imagePreviewContainer.style.display = 'block';
                                };
                                reader.readAsDataURL(file);
                            } else {
                                alert('Please select a valid image file');
                            }
                        });
                    }
                    
                    if (removeImageBtn) {
                        removeImageBtn.addEventListener('click', () => {
                            imagePreview.src = '';
                            imagePreviewContainer.style.display = 'none';
                            if (imageFileInput) imageFileInput.value = '';
                        });
                    }
                }, 100);
            }
            
            container.innerHTML = messages.map(msg => {
                const isOwn = msg.sender_id === currentUser.id;
                const processedContent = processMessageContent(msg.content);
                return `
                    <div style="display: flex; justify-content: ${isOwn ? 'flex-end' : 'flex-start'}; margin-bottom: 8px;">
                        <div style="max-width: 70%; padding: 12px 16px; background: ${isOwn ? 'var(--primary)' : 'var(--bg)'}; color: ${isOwn ? 'white' : 'var(--text)'}; border-radius: 12px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                            <div style="font-size: 0.9em; margin-bottom: 4px; word-wrap: break-word;">${processedContent}</div>
                            <div style="font-size: 0.75em; opacity: 0.7; text-align: right; margin-top: 6px;">${new Date(msg.created_at).toLocaleTimeString()}</div>
                        </div>
                    </div>
                `;
            }).join('');
            
            container.scrollTop = container.scrollHeight;
            
            // Update badge after loading messages (in case unread count changed)
            updateMessageBadge();
        }
    } catch (error) {
        container.innerHTML = `<div class="alert error">Error loading messages: ${error.message}</div>`;
    }
}

// Process message content to detect links and images
function processMessageContent(content) {
    if (!content) return '';
    
    // Check if content is a data URL (base64 image)
    if (content.startsWith('data:image/')) {
        return `<img src="${content}" alt="Uploaded Image" style="max-width: 100%; max-height: 300px; border-radius: 8px; margin: 8px 0; display: block; cursor: pointer;" onclick="window.open('${content}', '_blank')">`;
    }
    
    // Split content by newlines to handle mixed content
    const parts = content.split('\n');
    let processedParts = [];
    
    for (let part of parts) {
        // Check if this part is a data URL
        if (part.startsWith('data:image/')) {
            processedParts.push(`<img src="${part}" alt="Uploaded Image" style="max-width: 100%; max-height: 300px; border-radius: 8px; margin: 8px 0; display: block; cursor: pointer;" onclick="window.open('${part}', '_blank')">`);
        } else {
            // Escape HTML to prevent XSS - don't convert URLs to links
            let escaped = escapeHtml(part);
            processedParts.push(escaped);
        }
    }
    
    // Join parts with <br> for line breaks
    return processedParts.join('<br>');
}

// Helper function to escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function sendMessageHandler() {
    const input = document.getElementById('messageInput');
    const imagePreview = document.getElementById('imagePreview');
    const imagePreviewContainer = document.getElementById('imagePreviewContainer');
    if (!input) return;
    
    const message = input.value.trim();
    const imageDataUrl = imagePreview ? imagePreview.src : '';
    
    if (!message && !imageDataUrl) return;
    if (!currentConversationId || !currentUser) return;
    
    // Combine message and image
    let finalMessage = message;
    if (imageDataUrl && imageDataUrl !== '') {
        if (finalMessage) {
            finalMessage += '\n' + imageDataUrl;
        } else {
            finalMessage = imageDataUrl;
        }
    }
    
    sendMessageToConversation(finalMessage);
    
    // Clear inputs
    input.value = '';
    if (imagePreview) imagePreview.src = '';
    if (imagePreviewContainer) imagePreviewContainer.style.display = 'none';
    const imageFileInput = document.getElementById('imageFileInput');
    if (imageFileInput) imageFileInput.value = '';
}

async function sendMessageToConversation(message) {
    if (!currentConversationId || !currentUser) return;
    
    try {
        const response = await fetch(`${API_BASE}/conversations/${currentConversationId}/messages?sender_id=${currentUser.id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                content: message,
                is_initial_greeting: false
            })
        });
        
        if (response.ok) {
            const input = document.getElementById('messageInput');
            if (input) input.value = '';
            loadMessages(currentConversationId);
            updateMessageBadge(); // Update badge after sending
        } else {
            const error = await safeJsonParse(response);
            alert(error.detail || 'Failed to send message');
        }
    } catch (error) {
        alert('Error sending message: ' + error.message);
    }
}

document.getElementById('closeChatBtn').addEventListener('click', () => {
    document.getElementById('messagingModal').style.display = 'none';
    currentConversationId = null;
    currentChatUserId = null;
});

// Update message badge with unread count
async function updateMessageBadge() {
    if (!currentUser) return;
    
    try {
        const response = await fetch(`${API_BASE}/conversations/${currentUser.id}`);
        if (response.ok) {
            const conversations = await safeJsonParse(response);
            const totalUnread = conversations.reduce((sum, conv) => sum + (conv.unread_count || 0), 0);
            const badge = document.getElementById('messageBadge');
            if (totalUnread > 0) {
                badge.textContent = totalUnread > 99 ? '99+' : totalUnread;
                badge.style.display = 'flex';
            } else {
                badge.style.display = 'none';
            }
        }
    } catch (error) {
        console.error('Error updating message badge:', error);
    }
}

// Show conversations list
async function showConversationsList() {
    if (!currentUser) {
        alert('Please login to view messages');
        return;
    }
    
    const messagingModal = document.getElementById('messagingModal');
    const conversationsList = document.getElementById('conversationsList');
    const greetingSelection = document.getElementById('greetingSelection');
    const chatInterface = document.getElementById('chatInterface');
    const container = document.getElementById('conversationsContainer');
    
    // Show conversations list, hide others
    conversationsList.style.display = 'block';
    greetingSelection.style.display = 'none';
    chatInterface.style.display = 'none';
    messagingModal.style.display = 'block';
    
    container.innerHTML = '<div class="loading">Loading conversations...</div>';
    
    try {
        const response = await fetch(`${API_BASE}/conversations/${currentUser.id}`);
        if (response.ok) {
            const conversations = await safeJsonParse(response);
            
            if (conversations.length === 0) {
                container.innerHTML = '<div class="empty-state"><h3>No messages yet</h3><p>Start a conversation by viewing a user profile and clicking "Send Message"</p></div>';
                return;
            }
            
            container.innerHTML = conversations.map(conv => {
                const otherUser = conv.other_user;
                const lastMsg = conv.last_message;
                const initials = otherUser.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
                const avatar = otherUser.profile_picture || `data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2240%22 height=%2240%22%3E%3Ccircle cx=%2220%22 cy=%2220%22 r=%2218%22 fill=%22%231dbf73%22/%3E%3Ctext x=%2220%22 y=%2225%22 font-size=%2214%22 fill=%22white%22 text-anchor=%22middle%22%3E${initials}%3C/text%3E%3C/svg%3E`;
                const unreadBadge = conv.unread_count > 0 ? `<span class="conversation-unread">${conv.unread_count}</span>` : '';
                const lastMsgPreview = lastMsg ? (lastMsg.content.length > 50 ? lastMsg.content.substring(0, 50) + '...' : lastMsg.content) : 'No messages yet';
                const timeAgo = lastMsg ? getTimeAgo(new Date(lastMsg.created_at)) : '';
                
                return `
                    <div class="conversation-item" onclick="openConversation(${conv.id}, ${otherUser.id}, '${otherUser.full_name.replace(/'/g, "\\'")}')" style="display: flex; align-items: center; gap: 12px; padding: 15px; border-bottom: 1px solid var(--border); cursor: pointer; transition: background 0.2s; position: relative;">
                        <img src="${avatar}" alt="${otherUser.full_name}" style="width: 50px; height: 50px; border-radius: 50%; object-fit: cover; border: 2px solid var(--primary);" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2250%22 height=%2250%22%3E%3Ccircle cx=%2225%22 cy=%2225%22 r=%2223%22 fill=%22%231dbf73%22/%3E%3Ctext x=%2225%22 y=%2230%22 font-size=%2214%22 fill=%22white%22 text-anchor=%22middle%22%3E${initials}%3C/text%3E%3C/svg%3E'">
                        <div style="flex: 1; min-width: 0;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                                <h3 style="margin: 0; font-size: 1em; color: var(--text);">${getProfileTypeEmoji(otherUser.profile_type)} ${otherUser.full_name}</h3>
                                ${timeAgo ? `<span style="font-size: 0.8em; color: var(--text-light);">${timeAgo}</span>` : ''}
                            </div>
                            <p style="margin: 0; font-size: 0.9em; color: var(--text-light); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${lastMsgPreview}</p>
                        </div>
                        ${unreadBadge}
                    </div>
                `;
            }).join('');
            
            // Add hover effect
            container.querySelectorAll('.conversation-item').forEach(item => {
                item.addEventListener('mouseenter', function() {
                    this.style.background = 'var(--bg-light)';
                });
                item.addEventListener('mouseleave', function() {
                    this.style.background = 'transparent';
                });
            });
        } else {
            container.innerHTML = '<div class="alert error">Error loading conversations</div>';
        }
    } catch (error) {
        container.innerHTML = `<div class="alert error">Error: ${error.message}</div>`;
    }
}

// Helper function to get time ago
function getTimeAgo(date) {
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
}

// Open conversation from list (global function for onclick)
window.openConversation = async function(conversationId, userId, userName) {
    currentConversationId = conversationId;
    currentChatUserId = userId;
    
    const conversationsList = document.getElementById('conversationsList');
    const chatInterface = document.getElementById('chatInterface');
    const greetingSelection = document.getElementById('greetingSelection');
    
    conversationsList.style.display = 'none';
    greetingSelection.style.display = 'none';
    chatInterface.style.display = 'block';
    
    // Get user info for header
    try {
        const userResponse = await fetch(`${API_BASE}/users/${userId}`);
        if (userResponse.ok) {
            const user = await safeJsonParse(userResponse);
            document.getElementById('chatUserName').textContent = `${getProfileTypeEmoji(user.profile_type)} ${user.full_name}`;
        } else {
            document.getElementById('chatUserName').textContent = userName;
        }
    } catch (error) {
        document.getElementById('chatUserName').textContent = userName;
    }
    
    loadMessages(conversationId);
}

document.getElementById('messagesBtn').addEventListener('click', showConversationsList);

document.getElementById('backToConversationsBtn').addEventListener('click', () => {
    showConversationsList();
});

// Periodically update message badge (every 30 seconds)
setInterval(() => {
    if (currentUser) {
        updateMessageBadge();
    }
}, 30000);


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

// View user profile (public - accessible to everyone)
async function viewUserProfile(userId) {
    const userViewContent = document.getElementById('userViewContent');
    userViewModal.style.display = 'block';
    userViewContent.innerHTML = '<div class="loading">Loading profile...</div>';
    
    try {
        const response = await fetch(`${API_BASE}/users/${userId}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const user = await safeJsonParse(response);
        
        const initials = user.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
        const avatar = user.profile_picture || `data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%22100%22%3E%3Ccircle cx=%2250%22 cy=%2250%22 r=%2248%22 fill=%22%231dbf73%22/%3E%3Ctext x=%2250%22 y=%2260%22 font-size=%2232%22 fill=%22white%22 text-anchor=%22middle%22%3E${initials}%3C/text%3E%3C/svg%3E`;
        
        // Calculate match percentage if logged in
        let matchInfo = '';
        if (currentUser && currentUser.id !== user.id) {
            const usersResponse = await fetch(`${API_BASE}/users?current_user_id=${currentUser.id}`);
            if (usersResponse.ok) {
                const allUsers = await safeJsonParse(usersResponse);
                const matchedUser = allUsers.find(u => u.id === user.id);
                if (matchedUser && matchedUser.interest_match !== undefined && matchedUser.interest_match !== null) {
                    matchInfo = `<div class="interest-match-badge" style="margin-bottom: 20px; font-size: 1.1em; padding: 10px 20px;">${(matchedUser.interest_match * 100).toFixed(0)}% Interest Match</div>`;
                }
            }
        }
        
        userViewContent.innerHTML = `
            <div class="user-profile-view">
                ${matchInfo}
                <div class="profile-header" style="display: flex; align-items: center; gap: 20px; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid var(--border);">
                    <img src="${avatar}" alt="${user.full_name}" style="width: 120px; height: 120px; border-radius: 50%; object-fit: cover; border: 3px solid var(--primary-color);" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22120%22 height=%22120%22%3E%3Ccircle cx=%2260%22 cy=%2260%22 r=%2257%22 fill=%22%231dbf73%22/%3E%3Ctext x=%2260%22 y=%2270%22 font-size=%2240%22 fill=%22white%22 text-anchor=%22middle%22%3E${initials}%3C/text%3E%3C/svg%3E'">
                    <div>
                        <h2 style="margin: 0 0 5px 0; color: var(--text);">${getProfileTypeEmoji(user.profile_type)} ${user.full_name}</h2>
                        <div style="font-size: 1.1em; color: var(--text-light); margin-bottom: 10px;">@${user.username}</div>
                        ${user.location ? `<div style="color: var(--text-light); margin-top: 5px;">📍 ${user.location}</div>` : ''}
                        ${user.availability ? `<div style="color: var(--text-light); margin-top: 5px;">⏰ ${user.availability}</div>` : ''}
                    </div>
                </div>
                
                ${user.bio ? `
                    <div class="profile-section" style="margin-bottom: 25px;">
                        <h3 style="margin-bottom: 10px; color: var(--text);">About</h3>
                        <p style="line-height: 1.6; color: var(--text);">${user.bio}</p>
                    </div>
                ` : ''}
                
                ${user.interests && user.interests.length > 0 ? `
                    <div class="profile-section" style="margin-bottom: 25px;">
                        <h3 style="margin-bottom: 10px; color: var(--text);">Interests</h3>
                        <div class="tags-container" style="display: flex; flex-wrap: wrap; gap: 8px; border: none; background: transparent; padding: 0; min-height: auto;">
                            ${user.interests.map(i => `<span class="tag interest">${i}</span>`).join('')}
                        </div>
                    </div>
                ` : ''}
                
                ${user.looking_for && user.looking_for.length > 0 ? `
                    <div class="profile-section" style="margin-bottom: 25px;">
                        <h3 style="margin-bottom: 10px; color: var(--text);">Looking For</h3>
                        <div class="tags-container" style="display: flex; flex-wrap: wrap; gap: 8px; border: none; background: transparent; padding: 0; min-height: auto;">
                            ${user.looking_for.map(l => `<span class="tag language">${l}</span>`).join('')}
                        </div>
                    </div>
                ` : ''}
                
                ${user.skills && user.skills.length > 0 ? `
                    <div class="profile-section" style="margin-bottom: 25px;">
                        <h3 style="margin-bottom: 10px; color: var(--text);">Skills</h3>
                        <div class="skills" style="display: flex; flex-wrap: wrap; gap: 8px;">
                            ${user.skills.map(s => `<span class="skill-tag">${s.name}</span>`).join('')}
                        </div>
                    </div>
                ` : ''}
                
                ${(user.linkedin_url || user.github_url) ? `
                    <div class="profile-section" style="margin-bottom: 25px;">
                        <h3 style="margin-bottom: 10px; color: var(--text);">Social Links</h3>
                        <div class="social-links" style="display: flex; gap: 15px; flex-wrap: wrap;">
                            ${user.linkedin_url ? `<a href="${user.linkedin_url}" target="_blank" rel="noopener noreferrer" class="social-link linkedin" style="padding: 10px 20px; background: #0077b5; color: white; text-decoration: none; border-radius: 5px; display: inline-flex; align-items: center; gap: 8px;">🔗 LinkedIn</a>` : ''}
                            ${user.github_url ? `<a href="${user.github_url}" target="_blank" rel="noopener noreferrer" class="social-link github" style="padding: 10px 20px; background: #333; color: white; text-decoration: none; border-radius: 5px; display: inline-flex; align-items: center; gap: 8px;">💻 GitHub</a>` : ''}
                        </div>
                    </div>
                ` : ''}
                
                ${user.timezone ? `
                    <div class="profile-section" style="margin-bottom: 25px;">
                        <h3 style="margin-bottom: 10px; color: var(--text);">Timezone</h3>
                        <p style="color: var(--text);">${user.timezone}</p>
                    </div>
                ` : ''}
                
                ${currentUser && currentUser.id !== user.id ? `
                    <div class="profile-section" style="margin-top: 30px; padding-top: 20px; border-top: 2px solid var(--border);">
                        <button class="btn-primary" onclick="openMessagingModal(${user.id}, '${user.full_name.replace(/'/g, "\\'")}')" style="width: 100%; padding: 14px; font-size: 1.1em;">
                            💬 Send Message
                        </button>
                    </div>
                ` : ''}
            </div>
        `;
    } catch (error) {
        userViewContent.innerHTML = `<div class="alert error">Error loading profile: ${error.message}</div>`;
    }
}

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
    
    // Set profile type radio button
    if (currentUser.profile_type === 'Coworker') {
        document.getElementById('profileTypeCoworker').checked = true;
    } else if (currentUser.profile_type === 'SoloDev') {
        document.getElementById('profileTypeSoloDev').checked = true;
    }
    
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
    
    const profileType = document.querySelector('input[name="profileType"]:checked');
    
    const updateData = {
        profile_picture: document.getElementById('profilePictureUrl').value || null,
        bio: document.getElementById('profileBio').value || null,
        interests: interests,
        looking_for: languages,
        location: document.getElementById('profileLocation').value || null,
        linkedin_url: document.getElementById('profileLinkedIn').value || null,
        github_url: document.getElementById('profileGitHub').value || null,
        profile_type: profileType ? profileType.value : null
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
                    <div class="user-card" style="cursor: pointer;" data-user-id="${user.id}" onclick="viewUserProfile(${user.id})">
                        ${matchBadge}
                        <div class="user-card-header">
                            <img src="${avatar}" alt="${user.full_name}" class="user-avatar" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2250%22 height=%2250%22%3E%3Ccircle cx=%2225%22 cy=%2225%22 r=%2223%22 fill=%22%231dbf73%22/%3E%3Ctext x=%2225%22 y=%2230%22 font-size=%2216%22 fill=%22white%22 text-anchor=%22middle%22%3E${initials}%3C/text%3E%3C/svg%3E'">
                            <div class="user-info">
                                <h3>${getProfileTypeEmoji(user.profile_type)} ${user.full_name}</h3>
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
                                ${user.linkedin_url ? `<a href="${user.linkedin_url}" target="_blank" rel="noopener noreferrer" class="social-link linkedin" onclick="event.stopPropagation()">🔗 LinkedIn</a>` : ''}
                                ${user.github_url ? `<a href="${user.github_url}" target="_blank" rel="noopener noreferrer" class="social-link github" onclick="event.stopPropagation()">💻 GitHub</a>` : ''}
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
                    <div class="match-card" style="cursor: pointer;" onclick="viewUserProfile(${user.id})">
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
                                ${user.linkedin_url ? `<a href="${user.linkedin_url}" target="_blank" rel="noopener noreferrer" class="social-link linkedin" onclick="event.stopPropagation()">🔗 LinkedIn</a>` : ''}
                                ${user.github_url ? `<a href="${user.github_url}" target="_blank" rel="noopener noreferrer" class="social-link github" onclick="event.stopPropagation()">💻 GitHub</a>` : ''}
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
