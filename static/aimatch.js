// AI Match functionality
let currentMatch = null;

document.addEventListener('DOMContentLoaded', function() {
    // Initialize the page
    initializeAIMatch();

    // Bind event listeners
    bindEvents();
});

function initializeAIMatch() {
    // Check if user is logged in
    const user = getCurrentUser();
    if (!user) {
        showLoginPrompt();
        return;
    }

    // Show initial state
    showInitialState();
}

function bindEvents() {
    // Find match button
    document.getElementById('findMatchBtn').addEventListener('click', findAIMatch);
    document.getElementById('retryBtn').addEventListener('click', findAIMatch);

    // Message button
    document.getElementById('connectBtn').addEventListener('click', messageMatch);

    // Find another match button
    document.getElementById('findAnotherBtn').addEventListener('click', findAIMatch);
}

function showInitialState() {
    document.getElementById('initialState').style.display = 'block';
    document.getElementById('matchCard').style.display = 'none';
    document.getElementById('loadingState').style.display = 'none';
    document.getElementById('errorState').style.display = 'none';
}

function showLoadingState() {
    document.getElementById('initialState').style.display = 'none';
    document.getElementById('matchCard').style.display = 'none';
    document.getElementById('loadingState').style.display = 'block';
    document.getElementById('errorState').style.display = 'none';
}

function showErrorState() {
    document.getElementById('initialState').style.display = 'none';
    document.getElementById('matchCard').style.display = 'none';
    document.getElementById('loadingState').style.display = 'none';
    document.getElementById('errorState').style.display = 'block';
}

function showMatchCard() {
    document.getElementById('initialState').style.display = 'none';
    document.getElementById('matchCard').style.display = 'block';
    document.getElementById('loadingState').style.display = 'none';
    document.getElementById('errorState').style.display = 'none';
}

function findAIMatch() {
    const user = getCurrentUser();
    if (!user) {
        showLoginPrompt();
        return;
    }

    showLoadingState();

    // Call the AI match API
    fetch(`/api/aimatch/${user.id}`)
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to find match');
            }
            return response.json();
        })
        .then(match => {
            currentMatch = match;
            displayMatch(match);
            showMatchCard();
        })
        .catch(error => {
            console.error('Error finding AI match:', error);
            showErrorState();
        });
}

function displayMatch(match) {
    // Update match percentage
    const percentage = Math.round(match.interest_match * 100);
    document.getElementById('matchPercentage').textContent = `${percentage}% Match`;

    // Update profile image
    const profileImg = document.getElementById('matchProfileImg');
    profileImg.src = match.profile_picture || 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22120%22 height=%22120%22%3E%3Ccircle cx=%2260%22 cy=%2260%22 r=%2255%22 fill=%22%231dbf73%22/%3E%3Ctext x=%2260%22 y=%2268%22 font-size=%2236%22 fill=%22white%22 text-anchor=%22middle%22%3E?%3C/text%3E%3C/svg%3E';

    // Update user info
    document.getElementById('matchName').textContent = match.full_name;
    document.getElementById('matchUsername').textContent = `@${match.username}`;

    // Update profile type
    const profileTypeEl = document.getElementById('matchProfileType');
    if (match.profile_type) {
        profileTypeEl.textContent = match.profile_type === 'Coworker' ? '🤝 Coworker' : '💻 SoloDev';
        profileTypeEl.style.display = 'inline-block';
    } else {
        profileTypeEl.style.display = 'none';
    }

    // Update bio
    document.getElementById('matchBio').textContent = match.bio || 'No bio provided.';

    // Update interests
    const interestsContainer = document.getElementById('matchInterests');
    interestsContainer.innerHTML = '';
    if (match.interests && match.interests.length > 0) {
        match.interests.forEach(interest => {
            const tag = document.createElement('span');
            tag.className = 'tag';
            tag.textContent = interest;
            interestsContainer.appendChild(tag);
        });
    } else {
        interestsContainer.innerHTML = '<span class="no-data">No interests specified</span>';
    }

    // Update skills
    const skillsContainer = document.getElementById('matchSkills');
    skillsContainer.innerHTML = '';
    if (match.skills && match.skills.length > 0) {
        match.skills.forEach(skill => {
            const tag = document.createElement('span');
            tag.className = 'tag';
            tag.textContent = skill.name;
            skillsContainer.appendChild(tag);
        });
    } else {
        skillsContainer.innerHTML = '<span class="no-data">No skills specified</span>';
    }

    // Update location
    const locationEl = document.getElementById('matchLocation');
    let locationText = '';
    if (match.location) locationText += match.location;
    if (match.timezone) locationText += (locationText ? ' • ' : '') + match.timezone;
    if (match.availability) locationText += (locationText ? ' • ' : '') + match.availability;
    locationEl.textContent = locationText || 'Location not specified';

    // Update suggestion
    document.getElementById('matchSuggestion').textContent = match.teaming_suggestion;
}

function messageMatch() {
    if (!currentMatch) return;

    const user = getCurrentUser();
    if (!user) {
        showLoginPrompt();
        return;
    }

    // Open messaging modal
    openMessagingModal();

    // Check if there's an existing conversation
    checkExistingConversation(user.id, currentMatch.id);
}

function checkExistingConversation(currentUserId, matchUserId) {
    // Check if conversation already exists
    fetch(`/api/conversations/${currentUserId}`)
        .then(response => response.json())
        .then(conversations => {
            // Find conversation with the matched user
            const existingConversation = conversations.find(conv =>
                conv.other_user.id === matchUserId
            );

            if (existingConversation) {
                // Existing conversation found - go to chat interface
                showChatInterface(existingConversation);
            } else {
                // No existing conversation - show greeting options
                showGreetingSelection(matchUserId);
            }
        })
        .catch(error => {
            console.error('Error checking conversations:', error);
            // Default to greeting selection on error
            showGreetingSelection(matchUserId);
        });
}

function showChatInterface(conversation) {
    document.getElementById('conversationsList').style.display = 'none';
    document.getElementById('greetingSelection').style.display = 'none';
    document.getElementById('chatInterface').style.display = 'block';

    // Set up chat interface for existing conversation
    document.getElementById('chatUserName').textContent = conversation.other_user.full_name;

    // Load messages for this conversation
    loadConversationMessages(conversation.id, conversation.other_user);
}

function showGreetingSelection(matchUserId) {
    document.getElementById('conversationsList').style.display = 'none';
    document.getElementById('greetingSelection').style.display = 'block';
    document.getElementById('chatInterface').style.display = 'none';

    // Load greeting options
    loadGreetingOptions(matchUserId);
}

function loadConversationMessages(conversationId, otherUser) {
    const user = getCurrentUser();
    if (!user) return;

    fetch(`/api/conversations/${conversationId}/messages?user_id=${user.id}`)
        .then(response => response.json())
        .then(messages => {
            const messagesContainer = document.getElementById('messagesContainer');
            messagesContainer.innerHTML = '';

            if (messages.length === 0) {
                messagesContainer.innerHTML = '<div style="text-align: center; color: var(--text-light); padding: 20px;">No messages yet. Start the conversation!</div>';
                return;
            }

            messages.forEach(message => {
                const messageDiv = document.createElement('div');
                messageDiv.className = `message ${message.sender_id === user.id ? 'sent' : 'received'}`;

                const messageContent = document.createElement('div');
                messageContent.className = 'message-content';
                messageContent.textContent = message.content;

                const messageTime = document.createElement('div');
                messageTime.className = 'message-time';
                messageTime.textContent = new Date(message.created_at).toLocaleString();

                messageDiv.appendChild(messageContent);
                messageDiv.appendChild(messageTime);
                messagesContainer.appendChild(messageDiv);
            });

            // Scroll to bottom
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        })
        .catch(error => {
            console.error('Error loading messages:', error);
        });

    // Set up message sending
    setupMessageSending(conversationId);
}

function setupMessageSending(conversationId) {
    const sendButton = document.getElementById('sendMessageBtn');
    const messageInput = document.getElementById('messageInput');

    // Remove existing event listeners
    sendButton.replaceWith(sendButton.cloneNode(true));
    messageInput.replaceWith(messageInput.cloneNode(true));

    // Get fresh references
    const newSendButton = document.getElementById('sendMessageBtn');
    const newMessageInput = document.getElementById('messageInput');

    function sendMessage() {
        const message = newMessageInput.value.trim();
        if (!message) return;

        const user = getCurrentUser();
        if (!user) return;

        fetch(`/api/conversations/${conversationId}/messages?sender_id=${user.id}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                content: message,
                is_initial_greeting: false
            })
        })
        .then(response => response.json())
        .then(newMessage => {
            // Add message to UI
            addMessageToUI(newMessage, user.id);

            // Clear input
            newMessageInput.value = '';

            // Update conversation timestamp
            updateConversationTimestamp(conversationId);
        })
        .catch(error => {
            console.error('Error sending message:', error);
            alert('Failed to send message. Please try again.');
        });
    }

    newSendButton.addEventListener('click', sendMessage);
    newMessageInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
}

function addMessageToUI(message, currentUserId) {
    const messagesContainer = document.getElementById('messagesContainer');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${message.sender_id === currentUserId ? 'sent' : 'received'}`;

    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';
    messageContent.textContent = message.content;

    const messageTime = document.createElement('div');
    messageTime.className = 'message-time';
    messageTime.textContent = new Date(message.created_at).toLocaleString();

    messageDiv.appendChild(messageContent);
    messageDiv.appendChild(messageTime);
    messagesContainer.appendChild(messageDiv);

    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function updateConversationTimestamp(conversationId) {
    // This will trigger the conversation to appear at the top of the list
    // The backend should handle updating the updated_at timestamp
}

function showLoginPrompt() {
    // Show login modal
    const loginModal = document.getElementById('loginModal');
    loginModal.style.display = 'block';

    // Add close functionality
    const closeBtn = loginModal.querySelector('.close');
    closeBtn.onclick = function() {
        loginModal.style.display = 'none';
    };

    // Close when clicking outside
    window.onclick = function(event) {
        if (event.target == loginModal) {
            loginModal.style.display = 'none';
        }
    };
}

// Helper functions from app.js
function getCurrentUser() {
    const userStr = localStorage.getItem('currentUser');
    return userStr ? JSON.parse(userStr) : null;
}

function openMessagingModal() {
    const modal = document.getElementById('messagingModal');
    modal.style.display = 'block';
}

function loadGreetingOptions(otherUserId) {
    fetch('/api/messages/pre-written')
        .then(response => response.json())
        .then(data => {
            const container = document.getElementById('greetingOptions');
            container.innerHTML = '';

            data.messages.forEach((message, index) => {
                const button = document.createElement('button');
                button.className = 'btn-secondary greeting-option';
                button.textContent = message;
                button.onclick = () => selectGreeting(message, otherUserId);
                container.appendChild(button);
            });
        })
        .catch(error => {
            console.error('Error loading greetings:', error);
        });
}

function selectGreeting(message, otherUserId) {
    const user = getCurrentUser();
    if (!user) return;

    // Create conversation with selected greeting
    fetch('/api/conversations', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            other_user_id: otherUserId,
            initial_message: message,
            sender_id: user.id
        })
    })
    .then(response => response.json())
    .then(data => {
        // Close AI match modal and show success message
        document.getElementById('messagingModal').style.display = 'none';
        alert('Connection request sent! Check your messages to continue the conversation.');
    })
    .catch(error => {
        console.error('Error creating conversation:', error);
        alert('Failed to send connection request. Please try again.');
    });
}
