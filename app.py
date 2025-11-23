"""
Main FastAPI application for the collaboration platform.
Connects people with complementary skills to collaborate.
"""
from fastapi import FastAPI, Depends, HTTPException, status, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, FileResponse, JSONResponse
from sqlalchemy.orm import Session
from typing import List, Optional
import os

from database import (
    init_db, get_db, User, Skill, Project, Match, Conversation, Message, Post, PostSlot,
    user_skills, project_skills
)
from models import (
    UserCreate, UserLogin, UserUpdate, UserResponse, SkillResponse,
    ProjectCreate, ProjectUpdate, ProjectResponse,
    MatchRequest, MatchResponse, MatchDetail,
    ConnectionRequest, ConnectionResponse,
    MessageCreate, MessageResponse, ConversationResponse, ConversationCreate,
    PostCreate, PostResponse, PostSlotResponse, ClaimSlotRequest
)
from matching import find_best_matches
import hashlib
import json

def safe_json_loads(json_str):
    """Safely parse JSON string, return empty list if invalid."""
    if not json_str:
        return []
    try:
        return json.loads(json_str)
    except (json.JSONDecodeError, TypeError):
        return []

# Initialize FastAPI app
app = FastAPI(
    title="CoLab - Collaboration Platform",
    description="Connect with people who have complementary skills",
    version="1.0.0"
)

# CORS middleware for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify actual origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """Handle all exceptions and return JSON responses."""
    import traceback
    print(f"Error: {exc}")
    print(traceback.format_exc())
    return JSONResponse(
        status_code=500,
        content={"detail": str(exc) if str(exc) else "Internal server error"}
    )

# Initialize database on startup
@app.on_event("startup")
async def startup_event():
    init_db()
    # Create some default skills if they don't exist
    db = next(get_db())
    default_skills = [
        "Python", "JavaScript", "React", "Node.js", "FastAPI",
        "SQL", "MongoDB", "Docker", "AWS", "Git",
        "UI/UX Design", "Figma", "Photoshop", "Illustrator",
        "Machine Learning", "Data Science", "TensorFlow", "PyTorch",
        "DevOps", "Kubernetes", "CI/CD", "Linux",
        "Marketing", "SEO", "Content Writing", "Social Media",
        "Project Management", "Agile", "Scrum"
    ]
    for skill_name in default_skills:
        existing = db.query(Skill).filter(Skill.name == skill_name).first()
        if not existing:
            skill = Skill(name=skill_name, category="programming" if skill_name in ["Python", "JavaScript", "React"] else "other")
            db.add(skill)
    db.commit()
    db.close()


# Serve static files (frontend)
static_dir = "static"
if not os.path.exists(static_dir):
    os.makedirs(static_dir)
app.mount("/static", StaticFiles(directory=static_dir), name="static")


# Root endpoint - serve frontend
@app.get("/", response_class=HTMLResponse)
async def read_root():
    """Serve the main frontend page."""
    html_file = os.path.join(static_dir, "index.html")
    if os.path.exists(html_file):
        return FileResponse(html_file)
    return HTMLResponse(content="<h1>CoLab Platform</h1><p>Frontend coming soon. Use the API endpoints.</p>")

@app.get("/post", response_class=HTMLResponse)
async def post_page():
    """Serve the post page."""
    html_file = os.path.join(static_dir, "post.html")
    if os.path.exists(html_file):
        return FileResponse(html_file)
    return HTMLResponse(content="<h1>Post Page</h1><p>Page not found.</p>")

@app.get("/quickmatch", response_class=HTMLResponse)
async def quickmatch_page():
    """Serve the quick match page."""
    html_file = os.path.join(static_dir, "quickmatch.html")
    if os.path.exists(html_file):
        return FileResponse(html_file)
    return HTMLResponse(content="<h1>Quick Match Page</h1><p>Page not found.</p>")


# ========== User Endpoints ==========

@app.post("/api/users", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(user: UserCreate, db: Session = Depends(get_db)):
    """Create a new user account."""
    # Check if email or username already exists
    existing_email = db.query(User).filter(User.email == user.email).first()
    if existing_email:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    existing_username = db.query(User).filter(User.username == user.username).first()
    if existing_username:
        raise HTTPException(status_code=400, detail="Username already taken")
    
    # Hash password (simple hash for now)
    password_hash = hashlib.sha256(user.password.encode()).hexdigest()
    
    # Create user
    db_user = User(
        email=user.email,
        username=user.username,
        password=password_hash,
        full_name=user.full_name,
        bio=user.bio,
        location=user.location,
        timezone=user.timezone,
        availability=user.availability
    )
    db.add(db_user)
    db.flush()
    
    # Add skills
    for skill_name in user.skill_names:
        skill = db.query(Skill).filter(Skill.name.ilike(skill_name)).first()
        if not skill:
            skill = Skill(name=skill_name)
            db.add(skill)
            db.flush()
        db_user.skills.append(skill)
    
    db.commit()
    db.refresh(db_user)
    
    # Return user with parsed JSON fields
    user_dict = {
        "id": db_user.id,
        "email": db_user.email,
        "username": db_user.username,
        "full_name": db_user.full_name,
        "bio": db_user.bio,
        "profile_picture": db_user.profile_picture,
        "interests": safe_json_loads(db_user.interests),
        "looking_for": safe_json_loads(db_user.looking_for),
        "location": db_user.location,
        "timezone": db_user.timezone,
        "availability": db_user.availability,
        "linkedin_url": db_user.linkedin_url,
        "github_url": db_user.github_url,
        "profile_type": db_user.profile_type,
        "skills": [{"id": s.id, "name": s.name, "category": s.category} for s in db_user.skills],
        "created_at": db_user.created_at
    }
    return user_dict


@app.get("/api/users", response_model=List[UserResponse])
def get_users(
    skip: int = 0, 
    limit: int = 100, 
    current_user_id: Optional[int] = Query(None, description="ID of logged-in user to calculate match percentages"),
    db: Session = Depends(get_db)
):
    """Get all users. If current_user_id is provided, includes interest match percentages."""
    from matching import get_interest_match_for_user
    
    users = db.query(User).filter(User.is_active == True).offset(skip).limit(limit).all()
    
    # Get current user if provided
    current_user = None
    if current_user_id:
        current_user = db.query(User).filter(User.id == current_user_id).first()
    
    # Parse JSON fields for each user
    result = []
    for user in users:
        user_dict = {
            "id": user.id,
            "email": user.email,
            "username": user.username,
            "full_name": user.full_name,
            "bio": user.bio,
            "profile_picture": user.profile_picture,
            "interests": safe_json_loads(user.interests),
            "looking_for": safe_json_loads(user.looking_for),
            "location": user.location,
            "timezone": user.timezone,
            "availability": user.availability,
            "linkedin_url": user.linkedin_url,
            "github_url": user.github_url,
            "profile_type": user.profile_type,
            "skills": [{"id": s.id, "name": s.name, "category": s.category} for s in user.skills],
            "created_at": user.created_at
        }
        
        # Calculate interest match if current user is provided and it's not the same user
        if current_user and current_user.id != user.id:
            match_percentage = get_interest_match_for_user(current_user, user)
            user_dict["interest_match"] = match_percentage
        
        result.append(user_dict)
    
    return result


@app.post("/api/auth/login", response_model=UserResponse)
def login(credentials: UserLogin, db: Session = Depends(get_db)):
    """Login user."""
    password_hash = hashlib.sha256(credentials.password.encode()).hexdigest()
    user = db.query(User).filter(
        User.username == credentials.username,
        User.password == password_hash,
        User.is_active == True
    ).first()
    
    if not user:
        raise HTTPException(status_code=401, detail="Invalid username or password")
    
    # Parse JSON fields
    user_dict = {
        "id": user.id,
        "email": user.email,
        "username": user.username,
        "full_name": user.full_name,
        "bio": user.bio,
        "profile_picture": user.profile_picture,
        "interests": safe_json_loads(user.interests),
        "looking_for": safe_json_loads(user.looking_for),
        "location": user.location,
        "timezone": user.timezone,
        "availability": user.availability,
        "linkedin_url": user.linkedin_url,
        "github_url": user.github_url,
        "profile_type": user.profile_type,
        "skills": [{"id": s.id, "name": s.name, "category": s.category} for s in user.skills],
        "created_at": user.created_at
    }
    return user_dict


@app.get("/api/users/{user_id}", response_model=UserResponse)
def get_user(user_id: int, db: Session = Depends(get_db)):
    """Get a specific user by ID. Public endpoint - accessible to everyone."""
    user = db.query(User).filter(User.id == user_id, User.is_active == True).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Parse JSON fields
    user_dict = {
        "id": user.id,
        "email": user.email,
        "username": user.username,
        "full_name": user.full_name,
        "bio": user.bio,
        "profile_picture": user.profile_picture,
        "interests": safe_json_loads(user.interests),
        "looking_for": safe_json_loads(user.looking_for),
        "location": user.location,
        "timezone": user.timezone,
        "availability": user.availability,
        "linkedin_url": user.linkedin_url,
        "github_url": user.github_url,
        "profile_type": user.profile_type,
        "skills": [{"id": s.id, "name": s.name, "category": s.category} for s in user.skills],
        "created_at": user.created_at
    }
    return user_dict


@app.put("/api/users/{user_id}", response_model=UserResponse)
def update_user(user_id: int, user_update: UserUpdate, db: Session = Depends(get_db)):
    """Update user profile."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Update fields
    if user_update.full_name is not None:
        user.full_name = user_update.full_name
    if user_update.bio is not None:
        user.bio = user_update.bio
    if user_update.profile_picture is not None:
        user.profile_picture = user_update.profile_picture
    if user_update.interests is not None:
        user.interests = json.dumps(user_update.interests)
    if user_update.looking_for is not None:
        user.looking_for = json.dumps(user_update.looking_for)
    if user_update.location is not None:
        user.location = user_update.location
    if user_update.timezone is not None:
        user.timezone = user_update.timezone
    if user_update.availability is not None:
        user.availability = user_update.availability
    if user_update.linkedin_url is not None:
        user.linkedin_url = user_update.linkedin_url
    if user_update.github_url is not None:
        user.github_url = user_update.github_url
    if user_update.profile_type is not None:
        user.profile_type = user_update.profile_type
    
    # Update skills if provided
    if user_update.skill_names is not None:
        user.skills.clear()
        for skill_name in user_update.skill_names:
            skill = db.query(Skill).filter(Skill.name.ilike(skill_name)).first()
            if not skill:
                skill = Skill(name=skill_name)
                db.add(skill)
                db.flush()
            user.skills.append(skill)
    
    db.commit()
    db.refresh(user)
    
    # Return user with parsed JSON fields
    user_dict = {
        "id": user.id,
        "email": user.email,
        "username": user.username,
        "full_name": user.full_name,
        "bio": user.bio,
        "profile_picture": user.profile_picture,
        "interests": safe_json_loads(user.interests),
        "looking_for": safe_json_loads(user.looking_for),
        "location": user.location,
        "timezone": user.timezone,
        "availability": user.availability,
        "skills": [{"id": s.id, "name": s.name, "category": s.category} for s in user.skills],
        "created_at": user.created_at
    }
    return user_dict


# ========== Skill Endpoints ==========

@app.get("/api/skills", response_model=List[SkillResponse])
def get_skills(db: Session = Depends(get_db)):
    """Get all available skills."""
    skills = db.query(Skill).all()
    return skills


# ========== Project Endpoints ==========

@app.post("/api/projects", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
def create_project(project: ProjectCreate, owner_id: int = Query(..., description="ID of the project owner"), db: Session = Depends(get_db)):
    """Create a new project."""
    owner = db.query(User).filter(User.id == owner_id).first()
    if not owner:
        raise HTTPException(status_code=404, detail="Owner not found")
    
    db_project = Project(
        title=project.title,
        description=project.description,
        owner_id=owner_id
    )
    db.add(db_project)
    db.flush()
    
    # Add required skills
    for skill_name in project.required_skill_names:
        skill = db.query(Skill).filter(Skill.name.ilike(skill_name)).first()
        if not skill:
            skill = Skill(name=skill_name)
            db.add(skill)
            db.flush()
        db_project.required_skills.append(skill)
    
    db.commit()
    db.refresh(db_project)
    return db_project


@app.get("/api/projects", response_model=List[ProjectResponse])
def get_projects(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """Get all projects."""
    projects = db.query(Project).offset(skip).limit(limit).all()
    return projects


@app.get("/api/projects/{project_id}", response_model=ProjectResponse)
def get_project(project_id: int, db: Session = Depends(get_db)):
    """Get a specific project."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


# ========== Matching Endpoints ==========

@app.post("/api/match", response_model=MatchResponse)
def find_matches(match_request: MatchRequest, db: Session = Depends(get_db)):
    """Find users with complementary skills for a given user/project."""
    requester = db.query(User).filter(User.id == match_request.user_id).first()
    if not requester:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get required skills from project if specified
    required_skills = match_request.required_skill_names
    if match_request.project_id and not required_skills:
        project = db.query(Project).filter(Project.id == match_request.project_id).first()
        if project:
            required_skills = [s.name for s in project.required_skills]
    
    # Get all active users
    all_users = db.query(User).filter(User.is_active == True).all()
    
    # Find matches
    matches = find_best_matches(
        requester=requester,
        all_users=all_users,
        required_skills=required_skills,
        top_k=match_request.top_k
    )
    
    # Format response
    from matching import get_interest_match_for_user
    match_details = []
    for candidate, score, details in matches:
        # Calculate interest match
        interest_match = get_interest_match_for_user(requester, candidate)
        
        # Convert ORM object to dict with parsed JSON fields
        candidate_dict = {
            "id": candidate.id,
            "email": candidate.email,
            "username": candidate.username,
            "full_name": candidate.full_name,
            "bio": candidate.bio,
            "profile_picture": candidate.profile_picture,
            "interests": safe_json_loads(candidate.interests),
            "looking_for": safe_json_loads(candidate.looking_for),
            "location": candidate.location,
            "timezone": candidate.timezone,
            "availability": candidate.availability,
            "skills": [{"id": s.id, "name": s.name, "category": s.category} for s in candidate.skills],
            "interest_match": interest_match,  # Add interest match percentage
            "created_at": candidate.created_at
        }
        match_details.append(MatchDetail(
            matched_user=UserResponse.model_validate(candidate_dict),
            match_score=score,
            complementary_skills=details.get("complementary_skills", []),
            shared_skills=details.get("shared_skills", []),
            missing_skills=details.get("missing_skills", []),
            match_reasons=details
        ))
    
    return MatchResponse(matches=match_details, total_found=len(match_details))


# ========== Connection Endpoints ==========

@app.post("/api/connections", response_model=ConnectionResponse, status_code=status.HTTP_201_CREATED)
def create_connection(connection: ConnectionRequest, db: Session = Depends(get_db)):
    """Create a connection request between users."""
    requester = db.query(User).filter(User.id == connection.requester_id).first()
    matched_user = db.query(User).filter(User.id == connection.matched_user_id).first()
    
    if not requester or not matched_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Calculate match score
    from matching import compute_complementary_match
    score, _ = compute_complementary_match(requester, matched_user)
    
    # Create match record
    db_match = Match(
        requester_id=connection.requester_id,
        matched_user_id=connection.matched_user_id,
        project_id=connection.project_id,
        match_score=score,
        status="pending"
    )
    db.add(db_match)
    db.commit()
    db.refresh(db_match)
    return db_match


@app.get("/api/connections/{user_id}", response_model=List[ConnectionResponse])
def get_connections(user_id: int, db: Session = Depends(get_db)):
    """Get all connections for a user."""
    connections = db.query(Match).filter(
        (Match.requester_id == user_id) | (Match.matched_user_id == user_id)
    ).all()
    return connections


# ========== Messaging Endpoints ==========

PRE_WRITTEN_MESSAGES = [
    "Hi! I saw your profile and I'm interested in collaborating. Would you like to chat?",
    "Hello! Your skills align perfectly with what I'm looking for. Let's connect!",
    "Hey there! I think we could work well together. Want to discuss potential collaboration?"
]

@app.get("/api/messages/pre-written")
def get_pre_written_messages():
    """Get the 3 pre-written hello messages."""
    return {"messages": PRE_WRITTEN_MESSAGES}


@app.post("/api/conversations", response_model=ConversationResponse, status_code=status.HTTP_201_CREATED)
def create_conversation(conversation: ConversationCreate, sender_id: int = Query(..., description="ID of the user sending the message"), db: Session = Depends(get_db)):
    """Create a new conversation with an initial greeting message."""
    sender = db.query(User).filter(User.id == sender_id).first()
    other_user = db.query(User).filter(User.id == conversation.other_user_id).first()
    
    if not sender or not other_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if sender_id == conversation.other_user_id:
        raise HTTPException(status_code=400, detail="Cannot message yourself")
    
    # Check if conversation already exists
    existing = db.query(Conversation).filter(
        ((Conversation.user1_id == sender_id) & (Conversation.user2_id == conversation.other_user_id)) |
        ((Conversation.user1_id == conversation.other_user_id) & (Conversation.user2_id == sender_id))
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail="Conversation already exists")
    
    # Create conversation
    db_conversation = Conversation(
        user1_id=min(sender_id, conversation.other_user_id),
        user2_id=max(sender_id, conversation.other_user_id)
    )
    db.add(db_conversation)
    db.flush()
    
    # Create initial message
    db_message = Message(
        conversation_id=db_conversation.id,
        sender_id=sender_id,
        content=conversation.initial_message,
        is_initial_greeting=True
    )
    db.add(db_message)
    db.commit()
    db.refresh(db_conversation)
    
    # Get other user info
    other_user_dict = {
        "id": other_user.id,
        "email": other_user.email,
        "username": other_user.username,
        "full_name": other_user.full_name,
        "bio": other_user.bio,
        "profile_picture": other_user.profile_picture,
        "interests": safe_json_loads(other_user.interests),
        "looking_for": safe_json_loads(other_user.looking_for),
        "location": other_user.location,
        "timezone": other_user.timezone,
        "availability": other_user.availability,
        "linkedin_url": other_user.linkedin_url,
        "github_url": other_user.github_url,
        "profile_type": other_user.profile_type,
        "skills": [{"id": s.id, "name": s.name, "category": s.category} for s in other_user.skills],
        "created_at": other_user.created_at
    }
    
    return {
        "id": db_conversation.id,
        "user1_id": db_conversation.user1_id,
        "user2_id": db_conversation.user2_id,
        "created_at": db_conversation.created_at,
        "updated_at": db_conversation.updated_at,
        "other_user": other_user_dict,
        "last_message": {
            "id": db_message.id,
            "conversation_id": db_message.conversation_id,
            "sender_id": db_message.sender_id,
            "content": db_message.content,
            "is_initial_greeting": db_message.is_initial_greeting,
            "read": db_message.read,
            "created_at": db_message.created_at
        },
        "unread_count": 0
    }


@app.get("/api/conversations/{user_id}", response_model=List[ConversationResponse])
def get_conversations(user_id: int, db: Session = Depends(get_db)):
    """Get all conversations for a user."""
    conversations = db.query(Conversation).filter(
        (Conversation.user1_id == user_id) | (Conversation.user2_id == user_id)
    ).order_by(Conversation.updated_at.desc()).all()
    
    result = []
    for conv in conversations:
        other_user_id = conv.user2_id if conv.user1_id == user_id else conv.user1_id
        other_user = db.query(User).filter(User.id == other_user_id).first()
        
        # Get last message
        last_message = db.query(Message).filter(Message.conversation_id == conv.id).order_by(Message.created_at.desc()).first()
        
        # Count unread messages
        unread_count = db.query(Message).filter(
            Message.conversation_id == conv.id,
            Message.sender_id != user_id,
            Message.read == False
        ).count()
        
        other_user_dict = {
            "id": other_user.id,
            "email": other_user.email,
            "username": other_user.username,
            "full_name": other_user.full_name,
            "bio": other_user.bio,
            "profile_picture": other_user.profile_picture,
            "interests": safe_json_loads(other_user.interests),
            "looking_for": safe_json_loads(other_user.looking_for),
            "location": other_user.location,
            "timezone": other_user.timezone,
            "availability": other_user.availability,
            "linkedin_url": other_user.linkedin_url,
            "github_url": other_user.github_url,
            "profile_type": other_user.profile_type,
            "skills": [{"id": s.id, "name": s.name, "category": s.category} for s in other_user.skills],
            "created_at": other_user.created_at
        }
        
        result.append({
            "id": conv.id,
            "user1_id": conv.user1_id,
            "user2_id": conv.user2_id,
            "created_at": conv.created_at,
            "updated_at": conv.updated_at,
            "other_user": other_user_dict,
            "last_message": {
                "id": last_message.id,
                "conversation_id": last_message.conversation_id,
                "sender_id": last_message.sender_id,
                "content": last_message.content,
                "is_initial_greeting": last_message.is_initial_greeting,
                "read": last_message.read,
                "created_at": last_message.created_at
            } if last_message else None,
            "unread_count": unread_count
        })
    
    return result


@app.get("/api/conversations/{conversation_id}/messages", response_model=List[MessageResponse])
def get_messages(conversation_id: int, user_id: int = Query(..., description="ID of the user requesting messages"), db: Session = Depends(get_db)):
    """Get all messages in a conversation."""
    conversation = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    if conversation.user1_id != user_id and conversation.user2_id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized to view this conversation")
    
    messages = db.query(Message).filter(Message.conversation_id == conversation_id).order_by(Message.created_at.asc()).all()
    
    # Mark messages as read
    db.query(Message).filter(
        Message.conversation_id == conversation_id,
        Message.sender_id != user_id,
        Message.read == False
    ).update({"read": True})
    db.commit()
    
    return messages


@app.post("/api/conversations/{conversation_id}/messages", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
def send_message(conversation_id: int, message: MessageCreate, sender_id: int = Query(..., description="ID of the user sending the message"), db: Session = Depends(get_db)):
    """Send a message in a conversation."""
    conversation = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    if conversation.user1_id != sender_id and conversation.user2_id != sender_id:
        raise HTTPException(status_code=403, detail="Not authorized to send messages in this conversation")
    
    # Check if this is the first message after initial greeting
    existing_messages = db.query(Message).filter(Message.conversation_id == conversation_id).all()
    if len(existing_messages) == 1:
        first_message = existing_messages[0]
        # If the first message is an initial greeting from the same sender, they must wait for a reply
        if first_message.is_initial_greeting and first_message.sender_id == sender_id:
            raise HTTPException(status_code=400, detail="Please wait for the other user to reply to your initial message")
    
    db_message = Message(
        conversation_id=conversation_id,
        sender_id=sender_id,
        content=message.content,
        is_initial_greeting=message.is_initial_greeting
    )
    db.add(db_message)
    
    # Update conversation timestamp
    from datetime import datetime
    conversation.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(db_message)
    return db_message


# ========== Post Endpoints ==========

@app.post("/api/posts", response_model=PostResponse, status_code=status.HTTP_201_CREATED)
def create_post(post: PostCreate, author_id: int = Query(..., description="ID of the user creating the post"), db: Session = Depends(get_db)):
    """Create a new post."""
    author = db.query(User).filter(User.id == author_id).first()
    if not author:
        raise HTTPException(status_code=404, detail="User not found")
    
    db_post = Post(
        author_id=author_id,
        content=post.content,
        image=post.image,
        slot_count=post.slot_count,
        post_type=post.post_type or 'thought'
    )
    db.add(db_post)
    db.commit()
    db.refresh(db_post)
    
    # Build response with author info
    post_dict = {
        "id": db_post.id,
        "author_id": db_post.author_id,
        "content": db_post.content,
        "image": db_post.image,
        "slot_count": db_post.slot_count,
        "post_type": db_post.post_type or 'thought',
        "filled_slots": 0,
        "slots": [],
        "created_at": db_post.created_at
    }
    
    # Add author info
    author_dict = {
        "id": author.id,
        "email": author.email,
        "username": author.username,
        "full_name": author.full_name,
        "bio": author.bio,
        "profile_picture": author.profile_picture,
        "interests": safe_json_loads(author.interests) if author.interests else [],
        "looking_for": safe_json_loads(author.looking_for) if author.looking_for else [],
        "location": author.location,
        "timezone": author.timezone,
        "availability": author.availability,
        "linkedin_url": author.linkedin_url,
        "github_url": author.github_url,
        "profile_type": author.profile_type,
        "created_at": author.created_at,
        "is_active": author.is_active
    }
    post_dict["author"] = author_dict
    
    return post_dict


@app.get("/api/posts", response_model=List[PostResponse])
def get_posts(skip: int = 0, limit: int = 50, db: Session = Depends(get_db)):
    """Get all posts."""
    posts = db.query(Post).order_by(Post.created_at.desc()).offset(skip).limit(limit).all()
    
    result = []
    for post in posts:
        author = db.query(User).filter(User.id == post.author_id).first()
        slots = db.query(PostSlot).filter(PostSlot.post_id == post.id).all()
        
        post_dict = {
            "id": post.id,
            "author_id": post.author_id,
            "content": post.content,
            "image": post.image,
            "slot_count": post.slot_count,
            "post_type": post.post_type or 'thought',
            "filled_slots": len(slots),
            "slots": [],
            "created_at": post.created_at
        }
        
        # Add author info
        if author:
            author_dict = {
                "id": author.id,
                "email": author.email,
                "username": author.username,
                "full_name": author.full_name,
                "bio": author.bio,
                "profile_picture": author.profile_picture,
                "interests": safe_json_loads(author.interests) if author.interests else [],
                "looking_for": safe_json_loads(author.looking_for) if author.looking_for else [],
                "location": author.location,
                "timezone": author.timezone,
                "availability": author.availability,
                "linkedin_url": author.linkedin_url,
                "github_url": author.github_url,
                "profile_type": author.profile_type,
                "created_at": author.created_at,
                "is_active": author.is_active
            }
            post_dict["author"] = author_dict
        
        # Add slot info
        slot_list = []
        for slot in slots:
            slot_user = db.query(User).filter(User.id == slot.user_id).first()
            slot_dict = {
                "id": slot.id,
                "user_id": slot.user_id,
                "created_at": slot.created_at
            }
            if slot_user:
                slot_user_dict = {
                    "id": slot_user.id,
                    "email": slot_user.email,
                    "username": slot_user.username,
                    "full_name": slot_user.full_name,
                    "bio": slot_user.bio,
                    "profile_picture": slot_user.profile_picture,
                    "interests": safe_json_loads(slot_user.interests) if slot_user.interests else [],
                    "looking_for": safe_json_loads(slot_user.looking_for) if slot_user.looking_for else [],
                    "location": slot_user.location,
                    "timezone": slot_user.timezone,
                    "availability": slot_user.availability,
                    "linkedin_url": slot_user.linkedin_url,
                    "github_url": slot_user.github_url,
                    "profile_type": slot_user.profile_type,
                    "created_at": slot_user.created_at,
                    "is_active": slot_user.is_active
                }
                slot_dict["user"] = slot_user_dict
            slot_list.append(slot_dict)
        post_dict["slots"] = slot_list
        
        result.append(post_dict)
    
    return result


@app.post("/api/posts/{post_id}/claim-slot", response_model=PostSlotResponse)
def claim_slot(post_id: int, request: ClaimSlotRequest, db: Session = Depends(get_db)):
    """Claim a slot in a post."""
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    # Check if user exists
    user = db.query(User).filter(User.id == request.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check if user is the author (can't claim their own slot)
    if post.author_id == request.user_id:
        raise HTTPException(status_code=400, detail="You cannot claim a slot in your own post")
    
    # Check if user already claimed a slot
    existing_slot = db.query(PostSlot).filter(
        PostSlot.post_id == post_id,
        PostSlot.user_id == request.user_id
    ).first()
    if existing_slot:
        raise HTTPException(status_code=400, detail="You have already claimed a slot in this post")
    
    # Check if all slots are filled
    filled_slots = db.query(PostSlot).filter(PostSlot.post_id == post_id).count()
    if filled_slots >= post.slot_count:
        raise HTTPException(status_code=400, detail="All slots are already filled")
    
    # Create slot
    db_slot = PostSlot(
        post_id=post_id,
        user_id=request.user_id
    )
    db.add(db_slot)
    db.commit()
    db.refresh(db_slot)
    
    # Build response
    slot_dict = {
        "id": db_slot.id,
        "user_id": db_slot.user_id,
        "created_at": db_slot.created_at
    }
    
    user_dict = {
        "id": user.id,
        "email": user.email,
        "username": user.username,
        "full_name": user.full_name,
        "bio": user.bio,
        "profile_picture": user.profile_picture,
        "interests": safe_json_loads(user.interests) if user.interests else [],
        "looking_for": safe_json_loads(user.looking_for) if user.looking_for else [],
        "location": user.location,
        "timezone": user.timezone,
        "availability": user.availability,
        "linkedin_url": user.linkedin_url,
        "github_url": user.github_url,
        "profile_type": user.profile_type,
        "created_at": user.created_at,
        "is_active": user.is_active
    }
    slot_dict["user"] = user_dict
    
    return slot_dict


@app.delete("/api/posts/{post_id}/slots/{slot_id}")
def remove_slot(post_id: int, slot_id: int, user_id: int = Query(..., description="ID of the user removing the slot"), db: Session = Depends(get_db)):
    """Remove a slot (user can remove their own slot or post author can remove any slot)."""
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    slot = db.query(PostSlot).filter(PostSlot.id == slot_id, PostSlot.post_id == post_id).first()
    if not slot:
        raise HTTPException(status_code=404, detail="Slot not found")
    
    # Check if user is the slot owner or post author
    if slot.user_id != user_id and post.author_id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized to remove this slot")
    
    db.delete(slot)
    db.commit()
    return {"message": "Slot removed successfully"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
