"""
Pydantic models for API request/response validation.
"""
from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator
from typing import List, Optional, Dict, Any, Union
from datetime import datetime
import json


# User Models
class UserCreate(BaseModel):
    """Model for creating a new user."""
    email: EmailStr
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=6)
    full_name: str = Field(..., min_length=1, max_length=100)
    bio: Optional[str] = None
    location: Optional[str] = None
    timezone: Optional[str] = None
    availability: Optional[str] = None
    skill_names: List[str] = []  # List of skill names to associate


class UserLogin(BaseModel):
    """Model for user login."""
    username: str
    password: str


class UserUpdate(BaseModel):
    """Model for updating user profile."""
    full_name: Optional[str] = None
    bio: Optional[str] = None
    profile_picture: Optional[str] = None
    interests: Optional[List[str]] = None  # List of interest tags with #
    looking_for: Optional[List[str]] = None  # List of programming languages with #
    location: Optional[str] = None
    timezone: Optional[str] = None
    availability: Optional[str] = None
    linkedin_url: Optional[str] = None
    github_url: Optional[str] = None
    profile_type: Optional[str] = None  # "Coworker" or "SoloDev"
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
    profile_picture: Optional[str] = None
    interests: Optional[List[str]] = None
    looking_for: Optional[List[str]] = None
    location: Optional[str] = None
    timezone: Optional[str] = None
    availability: Optional[str] = None
    linkedin_url: Optional[str] = None
    github_url: Optional[str] = None
    profile_type: Optional[str] = None  # "Coworker" or "SoloDev"
    skills: List[SkillResponse] = []
    interest_match: Optional[float] = None  # Match percentage with current user
    created_at: datetime

    model_config = {"from_attributes": True}
    
    @field_validator('interests', 'looking_for', mode='before')
    @classmethod
    def parse_json_string(cls, v: Union[str, List[str], None]) -> Optional[List[str]]:
        """Parse JSON string to list if needed."""
        if v is None:
            return None
        if isinstance(v, list):
            return v
        if isinstance(v, str):
            if not v.strip():
                return None
            try:
                parsed = json.loads(v)
                if isinstance(parsed, list):
                    return parsed
                return None
            except (json.JSONDecodeError, TypeError):
                return None
        return None


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


# Message Models
class MessageCreate(BaseModel):
    """Model for creating a new message."""
    content: str
    is_initial_greeting: bool = False


class MessageResponse(BaseModel):
    """Message response model."""
    id: int
    conversation_id: int
    sender_id: int
    content: str
    is_initial_greeting: bool
    read: bool
    created_at: datetime
    
    model_config = {"from_attributes": True}


class ConversationResponse(BaseModel):
    """Conversation response model."""
    id: int
    user1_id: int
    user2_id: int
    created_at: datetime
    updated_at: datetime
    other_user: Optional[UserResponse] = None
    last_message: Optional[MessageResponse] = None
    unread_count: int = 0
    
    model_config = {"from_attributes": True}


class ConversationCreate(BaseModel):
    """Model for creating a conversation with initial message."""
    other_user_id: int
    initial_message: str  # One of the 3 pre-written messages


# Post Models
class PostCreate(BaseModel):
    """Model for creating a post."""
    content: Optional[str] = None
    image: Optional[str] = None  # Base64 image or URL
    slot_count: int = Field(..., ge=1, le=5)  # Number of slots (1-5)
    post_type: Optional[str] = Field(default="regular", description="Type of post: 'regular' or 'help'")


class PostSlotResponse(BaseModel):
    """Model for post slot response."""
    id: int
    user_id: int
    user: Optional[UserResponse] = None
    created_at: datetime
    
    model_config = {"from_attributes": True}


class PostResponse(BaseModel):
    """Model for post response."""
    id: int
    author_id: int
    author: Optional[UserResponse] = None
    content: Optional[str] = None
    image: Optional[str] = None
    slot_count: int
    filled_slots: int = 0
    slots: List[PostSlotResponse] = []
    post_type: Optional[str] = "regular"
    help_request_count: Optional[int] = 0
    created_at: datetime
    
    model_config = {"from_attributes": True}


class ClaimSlotRequest(BaseModel):
    """Model for claiming a slot in a post."""
    user_id: int


# Help Request Models
class HelpRequestCreate(BaseModel):
    """Model for creating a help request."""
    helper_user_id: int


class HelpRequestResponse(BaseModel):
    """Model for help request response."""
    id: int
    post_id: int
    helper_user_id: int
    created_at: datetime
    
    model_config = {"from_attributes": True}
