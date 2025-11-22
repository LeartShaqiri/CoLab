const API_BASE = '/api';

// Tab switching
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const tabName = btn.dataset.tab;
        
        // Update buttons
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        // Update content
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        document.getElementById(tabName).classList.add('active');
    });
});

// Register form
document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const resultDiv = document.getElementById('registerResult');
    
    const skills = document.getElementById('regSkills').value
        .split(',')
        .map(s => s.trim())
        .filter(s => s);
    
    const userData = {
        email: document.getElementById('regEmail').value,
        username: document.getElementById('regUsername').value,
        full_name: document.getElementById('regFullName').value,
        bio: document.getElementById('regBio').value || null,
        location: document.getElementById('regLocation').value || null,
        timezone: document.getElementById('regTimezone').value || null,
        availability: document.getElementById('regAvailability').value || null,
        skill_names: skills
    };
    
    try {
        const response = await fetch(`${API_BASE}/users`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userData)
        });
        
        if (response.ok) {
            const user = await response.json();
            resultDiv.className = 'result success';
            resultDiv.innerHTML = `
                <strong>Success!</strong> User created with ID: ${user.id}<br>
                <strong>Username:</strong> ${user.username}<br>
                <strong>Email:</strong> ${user.email}
            `;
            document.getElementById('registerForm').reset();
        } else {
            const error = await response.json();
            resultDiv.className = 'result error';
            resultDiv.textContent = `Error: ${error.detail || 'Failed to create user'}`;
        }
    } catch (error) {
        resultDiv.className = 'result error';
        resultDiv.textContent = `Error: ${error.message}`;
    }
});

// Load users
document.getElementById('loadUsersBtn').addEventListener('click', async () => {
    const usersList = document.getElementById('usersList');
    usersList.innerHTML = '<div class="loading">Loading users...</div>';
    
    try {
        const response = await fetch(`${API_BASE}/users`);
        const users = await response.json();
        
        if (users.length === 0) {
            usersList.innerHTML = '<p>No users found. Register to get started!</p>';
            return;
        }
        
        usersList.innerHTML = users.map(user => `
            <div class="user-card">
                <h3>${user.full_name}</h3>
                <div class="username">@${user.username}</div>
                ${user.bio ? `<div class="bio">${user.bio}</div>` : ''}
                ${user.location ? `<div><strong>Location:</strong> ${user.location}</div>` : ''}
                ${user.availability ? `<div><strong>Available:</strong> ${user.availability}</div>` : ''}
                <div class="skills">
                    ${user.skills.map(skill => `<span class="skill-tag">${skill.name}</span>`).join('')}
                </div>
            </div>
        `).join('');
    } catch (error) {
        usersList.innerHTML = `<div class="result error">Error: ${error.message}</div>`;
    }
});

// Find matches
document.getElementById('matchForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const matchesList = document.getElementById('matchesList');
    matchesList.innerHTML = '<div class="loading">Finding matches...</div>';
    
    const skills = document.getElementById('matchSkills').value
        .split(',')
        .map(s => s.trim())
        .filter(s => s);
    
    const matchData = {
        user_id: parseInt(document.getElementById('matchUserId').value),
        required_skill_names: skills.length > 0 ? skills : null,
        top_k: parseInt(document.getElementById('matchTopK').value) || 10
    };
    
    try {
        const response = await fetch(`${API_BASE}/match`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(matchData)
        });
        
        if (response.ok) {
            const result = await response.json();
            
            if (result.matches.length === 0) {
                matchesList.innerHTML = '<p>No matches found. Try adjusting your search criteria.</p>';
                return;
            }
            
            matchesList.innerHTML = result.matches.map(match => `
                <div class="match-card">
                    <div class="match-header">
                        <h3>${match.matched_user.full_name} (@${match.matched_user.username})</h3>
                        <div class="match-score">${(match.match_score * 100).toFixed(1)}% Match</div>
                    </div>
                    ${match.matched_user.bio ? `<p>${match.matched_user.bio}</p>` : ''}
                    <div class="match-details">
                        <div class="match-section">
                            <h4>Complementary Skills</h4>
                            <ul>
                                ${match.complementary_skills.length > 0 
                                    ? match.complementary_skills.map(s => `<li>✓ ${s}</li>`).join('')
                                    : '<li>None</li>'}
                            </ul>
                        </div>
                        <div class="match-section">
                            <h4>Shared Skills</h4>
                            <ul>
                                ${match.shared_skills.length > 0 
                                    ? match.shared_skills.map(s => `<li>• ${s}</li>`).join('')
                                    : '<li>None</li>'}
                            </ul>
                        </div>
                        ${match.missing_skills.length > 0 ? `
                        <div class="match-section">
                            <h4>Missing Skills</h4>
                            <ul>
                                ${match.missing_skills.map(s => `<li>✗ ${s}</li>`).join('')}
                            </ul>
                        </div>
                        ` : ''}
                    </div>
                </div>
            `).join('');
        } else {
            const error = await response.json();
            matchesList.innerHTML = `<div class="result error">Error: ${error.detail || 'Failed to find matches'}</div>`;
        }
    } catch (error) {
        matchesList.innerHTML = `<div class="result error">Error: ${error.message}</div>`;
    }
});

// Load projects
document.getElementById('loadProjectsBtn').addEventListener('click', async () => {
    const projectsList = document.getElementById('projectsList');
    projectsList.innerHTML = '<div class="loading">Loading projects...</div>';
    
    try {
        const response = await fetch(`${API_BASE}/projects`);
        const projects = await response.json();
        
        if (projects.length === 0) {
            projectsList.innerHTML = '<p>No projects found. Create one to get started!</p>';
            return;
        }
        
        projectsList.innerHTML = projects.map(project => `
            <div class="project-card">
                <h3>${project.title}</h3>
                ${project.description ? `<p>${project.description}</p>` : ''}
                <div><strong>Status:</strong> ${project.status}</div>
                <div><strong>Owner ID:</strong> ${project.owner_id}</div>
                <div class="skills" style="margin-top: 10px;">
                    ${project.required_skills.map(skill => `<span class="skill-tag">${skill.name}</span>`).join('')}
                </div>
            </div>
        `).join('');
    } catch (error) {
        projectsList.innerHTML = `<div class="result error">Error: ${error.message}</div>`;
    }
});

// Toggle create project form
document.getElementById('createProjectBtn').addEventListener('click', () => {
    const form = document.getElementById('createProjectForm');
    form.classList.toggle('hidden');
});

// Create project
document.getElementById('submitProjectBtn').addEventListener('click', async () => {
    const resultDiv = document.getElementById('projectsList');
    resultDiv.innerHTML = '<div class="loading">Creating project...</div>';
    
    const skills = document.getElementById('projectSkills').value
        .split(',')
        .map(s => s.trim())
        .filter(s => s);
    
    const projectData = {
        title: document.getElementById('projectTitle').value,
        description: document.getElementById('projectDescription').value || null,
        required_skill_names: skills
    };
    
    const ownerId = parseInt(document.getElementById('projectOwnerId').value);
    
    try {
        const response = await fetch(`${API_BASE}/projects?owner_id=${ownerId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(projectData)
        });
        
        if (response.ok) {
            const project = await response.json();
            resultDiv.innerHTML = `
                <div class="result success">
                    <strong>Success!</strong> Project created with ID: ${project.id}<br>
                    <strong>Title:</strong> ${project.title}
                </div>
            `;
            document.getElementById('createProjectForm').classList.add('hidden');
            document.getElementById('projectTitle').value = '';
            document.getElementById('projectDescription').value = '';
            document.getElementById('projectSkills').value = '';
        } else {
            const error = await response.json();
            resultDiv.innerHTML = `<div class="result error">Error: ${error.detail || 'Failed to create project'}</div>`;
        }
    } catch (error) {
        resultDiv.innerHTML = `<div class="result error">Error: ${error.message}</div>`;
    }
});

