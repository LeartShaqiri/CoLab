"""
Pydantic models for API request/response validation.
"""
from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional, Dict, Any
from datetime import datetime


# User Models
class UserCreate(BaseModel):
    """Model for creating a new user."""
    email: EmailStr
    username: str = Field(..., min_length=3, max_length=50)
    full_name: str = Field(..., min_length=1, max_length=100)
    bio: Optional[str] = None
    location: Optional[str] = None
    timezone: Optional[str] = None
    availability: Optional[str] = None
    skill_names: List[str] = []  # List of skill names to associate


class UserUpdate(BaseModel):
    """Model for updating user profile."""
    full_name: Optional[str] = None
    bio: Optional[str] = None
    location: Optional[str] = None
    timezone: Optional[str] = None
    availability: Optional[str] = None
    skill_names: Optional[List[str]] = None


class SkillResponse(BaseModel):
    """Skill response model."""
    id: int
    name: str
    category: Optional[str] = None

    model_config = {"from_attributes": True}


class UserResponse(BaseModel):
    """User response model."""
    id: int
    email: str
    username: str
    full_name: str
    bio: Optional[str] = None
    location: Optional[str] = None
    timezone: Optional[str] = None
    availability: Optional[str] = None
    skills: List[SkillResponse] = []
    created_at: datetime

    model_config = {"from_attributes": True}


# Project Models
class ProjectCreate(BaseModel):
    """Model for creating a new project."""
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    required_skill_names: List[str] = []


class ProjectUpdate(BaseModel):
    """Model for updating a project."""
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    required_skill_names: Optional[List[str]] = None


class ProjectResponse(BaseModel):
    """Project response model."""
    id: int
    title: str
    description: Optional[str] = None
    owner_id: int
    status: str
    required_skills: List[SkillResponse] = []
    members: List[UserResponse] = []
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# Matching Models
class MatchRequest(BaseModel):
    """Model for requesting matches."""
    user_id: int
    project_id: Optional[int] = None
    required_skill_names: Optional[List[str]] = None
    top_k: int = Field(default=10, ge=1, le=50)


class MatchDetail(BaseModel):
    """Detailed match information."""
    matched_user: UserResponse
    match_score: float
    complementary_skills: List[str]  # Skills the matched user has that requester lacks
    shared_skills: List[str]  # Skills both users have
    missing_skills: List[str]  # Skills needed but matched user doesn't have
    match_reasons: Dict[str, Any]  # Detailed breakdown of match score


class MatchResponse(BaseModel):
    """Match response model."""
    matches: List[MatchDetail]
    total_found: int


# Connection Models
class ConnectionRequest(BaseModel):
    """Model for requesting a connection."""
    requester_id: int
    matched_user_id: int
    project_id: Optional[int] = None
    message: Optional[str] = None


class ConnectionResponse(BaseModel):
    """Connection response model."""
    id: int
    requester_id: int
    matched_user_id: int
    project_id: Optional[int] = None
    match_score: float
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}

