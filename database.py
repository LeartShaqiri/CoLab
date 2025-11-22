"""
Database models and setup for the collaboration platform.
Uses SQLite for simplicity, but structured for easy migration to PostgreSQL.
"""
from sqlalchemy import create_engine, Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Table, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime

Base = declarative_base()

# Association table for many-to-many relationship between users and skills
user_skills = Table(
    'user_skills',
    Base.metadata,
    Column('user_id', Integer, ForeignKey('users.id'), primary_key=True),
    Column('skill_id', Integer, ForeignKey('skills.id'), primary_key=True)
)

# Association table for project skills needed
project_skills = Table(
    'project_skills',
    Base.metadata,
    Column('project_id', Integer, ForeignKey('projects.id'), primary_key=True),
    Column('skill_id', Integer, ForeignKey('skills.id'), primary_key=True)
)

# Association table for project members
project_members = Table(
    'project_members',
    Base.metadata,
    Column('project_id', Integer, ForeignKey('projects.id'), primary_key=True),
    Column('user_id', Integer, ForeignKey('users.id'), primary_key=True)
)


class User(Base):
    """User model representing platform members."""
    __tablename__ = 'users'
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    username = Column(String, unique=True, index=True, nullable=False)
    full_name = Column(String, nullable=False)
    bio = Column(Text, nullable=True)
    location = Column(String, nullable=True)
    timezone = Column(String, nullable=True)
    availability = Column(String, nullable=True)  # e.g., "weekends", "evenings", "any"
    created_at = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=True)
    
    # Relationships
    skills = relationship("Skill", secondary=user_skills, back_populates="users")
    projects_owned = relationship("Project", back_populates="owner", foreign_keys="Project.owner_id")
    projects_member = relationship("Project", secondary=project_members, back_populates="members")
    matches_sent = relationship("Match", foreign_keys="Match.requester_id", back_populates="requester")
    matches_received = relationship("Match", foreign_keys="Match.matched_user_id", back_populates="matched_user")


class Skill(Base):
    """Skill model representing different skills/technologies."""
    __tablename__ = 'skills'
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    category = Column(String, nullable=True)  # e.g., "programming", "design", "marketing"
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    users = relationship("User", secondary=user_skills, back_populates="skills")
    projects = relationship("Project", secondary=project_skills, back_populates="required_skills")


class Project(Base):
    """Project model representing collaboration opportunities."""
    __tablename__ = 'projects'
    
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    owner_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    status = Column(String, default="open")  # "open", "in_progress", "completed", "cancelled"
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    owner = relationship("User", foreign_keys=[owner_id], back_populates="projects_owned")
    members = relationship("User", secondary=project_members, back_populates="projects_member")
    required_skills = relationship("Skill", secondary=project_skills, back_populates="projects")


class Match(Base):
    """Match model representing connections between users."""
    __tablename__ = 'matches'
    
    id = Column(Integer, primary_key=True, index=True)
    requester_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    matched_user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    project_id = Column(Integer, ForeignKey('projects.id'), nullable=True)
    match_score = Column(Float, nullable=False)
    status = Column(String, default="pending")  # "pending", "accepted", "rejected", "connected"
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    requester = relationship("User", foreign_keys=[requester_id], back_populates="matches_sent")
    matched_user = relationship("User", foreign_keys=[matched_user_id], back_populates="matches_received")
    project = relationship("Project")


# Database setup
SQLALCHEMY_DATABASE_URL = "sqlite:///./collab_platform.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, 
    connect_args={"check_same_thread": False}  # Needed for SQLite
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def init_db():
    """Initialize the database by creating all tables."""
    Base.metadata.create_all(bind=engine)


def get_db():
    """Dependency to get database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

