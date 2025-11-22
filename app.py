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
    init_db, get_db, User, Skill, Project, Match,
    user_skills, project_skills
)
from models import (
    UserCreate, UserLogin, UserUpdate, UserResponse, SkillResponse,
    ProjectCreate, ProjectUpdate, ProjectResponse,
    MatchRequest, MatchResponse, MatchDetail,
    ConnectionRequest, ConnectionResponse
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
        "skills": [{"id": s.id, "name": s.name, "category": s.category} for s in user.skills],
        "created_at": user.created_at
    }
    return user_dict


@app.get("/api/users/{user_id}", response_model=UserResponse)
def get_user(user_id: int, db: Session = Depends(get_db)):
    """Get a specific user by ID."""
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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
