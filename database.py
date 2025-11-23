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
    password = Column(String, nullable=True)  # Simple password for now
    full_name = Column(String, nullable=False)
    bio = Column(Text, nullable=True)
    profile_picture = Column(String, nullable=True)  # URL or base64
    interests = Column(Text, nullable=True)  # JSON array of interests with #
    looking_for = Column(Text, nullable=True)  # JSON array of programming languages with #
    location = Column(String, nullable=True)
    timezone = Column(String, nullable=True)
    availability = Column(String, nullable=True)  # e.g., "weekends", "evenings", "any"
    linkedin_url = Column(String, nullable=True)
    github_url = Column(String, nullable=True)
    profile_type = Column(String, nullable=True)  # "Coworker" or "SoloDev"
    created_at = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=True)
    
    # Relationships
    skills = relationship("Skill", secondary=user_skills, back_populates="users")
    projects_owned = relationship("Project", back_populates="owner", foreign_keys="Project.owner_id")
    projects_member = relationship("Project", secondary=project_members, back_populates="members")
    matches_sent = relationship("Match", foreign_keys="Match.requester_id", back_populates="requester")
    matches_received = relationship("Match", foreign_keys="Match.matched_user_id", back_populates="matched_user")
    conversations_as_user1 = relationship("Conversation", foreign_keys="Conversation.user1_id", back_populates="user1")
    conversations_as_user2 = relationship("Conversation", foreign_keys="Conversation.user2_id", back_populates="user2")


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


class Conversation(Base):
    """Conversation model representing a chat between two users."""
    __tablename__ = 'conversations'
    
    id = Column(Integer, primary_key=True, index=True)
    user1_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    user2_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user1 = relationship("User", foreign_keys=[user1_id], back_populates="conversations_as_user1")
    user2 = relationship("User", foreign_keys=[user2_id], back_populates="conversations_as_user2")
    messages = relationship("Message", back_populates="conversation", cascade="all, delete-orphan")


class Message(Base):
    """Message model representing individual messages in a conversation."""
    __tablename__ = 'messages'
    
    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey('conversations.id'), nullable=False)
    sender_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    content = Column(Text, nullable=False)
    is_initial_greeting = Column(Boolean, default=False)  # True for the first pre-written message
    slot_request_id = Column(Integer, ForeignKey('slot_requests.id'), nullable=True)  # Link to slot request if this is a slot request message
    read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    conversation = relationship("Conversation", back_populates="messages")
    sender = relationship("User", foreign_keys=[sender_id])
    slot_request = relationship("SlotRequest", foreign_keys=[slot_request_id])


class Post(Base):
    """Post model representing user posts with collaboration slots."""
    __tablename__ = 'posts'
    
    id = Column(Integer, primary_key=True, index=True)
    author_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    content = Column(Text, nullable=True)  # Text content
    image = Column(Text, nullable=True)  # Base64 image or URL
    slot_count = Column(Integer, nullable=False, default=1)  # Number of slots (1-5)
    post_type = Column(String(20), nullable=True, default='regular')  # 'regular' or 'help'
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    author = relationship("User", foreign_keys=[author_id])
    slots = relationship("PostSlot", back_populates="post", cascade="all, delete-orphan")
    help_requests = relationship("HelpRequest", back_populates="post", cascade="all, delete-orphan")
    slot_requests = relationship("SlotRequest", back_populates="post", cascade="all, delete-orphan")
    comments = relationship("Comment", back_populates="post", cascade="all, delete-orphan")


class PostSlot(Base):
    """PostSlot model representing filled slots in a post."""
    __tablename__ = 'post_slots'
    
    id = Column(Integer, primary_key=True, index=True)
    post_id = Column(Integer, ForeignKey('posts.id'), nullable=False)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    post = relationship("Post", back_populates="slots")
    user = relationship("User", foreign_keys=[user_id])


class HelpRequest(Base):
    """HelpRequest model representing help requests for posts."""
    __tablename__ = 'help_requests'

    id = Column(Integer, primary_key=True, index=True)
    post_id = Column(Integer, ForeignKey('posts.id'), nullable=False)
    helper_user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    post = relationship("Post", back_populates="help_requests")
    helper_user = relationship("User", foreign_keys=[helper_user_id])


class SlotRequest(Base):
    """SlotRequest model representing pending slot requests for posts."""
    __tablename__ = 'slot_requests'

    id = Column(Integer, primary_key=True, index=True)
    post_id = Column(Integer, ForeignKey('posts.id'), nullable=False)
    requester_user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    status = Column(String(20), default="pending")  # "pending", "accepted", "rejected"
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    post = relationship("Post", back_populates="slot_requests")
    requester_user = relationship("User", foreign_keys=[requester_user_id])


class Comment(Base):
    """Comment model representing comments on posts."""
    __tablename__ = 'comments'

    id = Column(Integer, primary_key=True, index=True)
    post_id = Column(Integer, ForeignKey('posts.id'), nullable=False)
    author_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    post = relationship("Post", back_populates="comments")
    author = relationship("User", foreign_keys=[author_id])


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
    migrate_db()


def migrate_db():
    """Add missing columns to existing database tables."""
    from sqlalchemy import inspect, text
    
    inspector = inspect(engine)
    table_names = inspector.get_table_names()
    
    # Only migrate if users table exists
    if 'users' not in table_names:
        return
    
    existing_columns = [col['name'] for col in inspector.get_columns('users')]
    
    with engine.begin() as conn:  # Use begin() for automatic transaction handling
        # Add password column if it doesn't exist
        if 'password' not in existing_columns:
            try:
                conn.execute(text("ALTER TABLE users ADD COLUMN password VARCHAR"))
                print("Added 'password' column to users table")
            except Exception as e:
                print(f"Could not add password column: {e}")
        
        # Add profile_picture column if it doesn't exist
        if 'profile_picture' not in existing_columns:
            try:
                conn.execute(text("ALTER TABLE users ADD COLUMN profile_picture VARCHAR"))
                print("Added 'profile_picture' column to users table")
            except Exception as e:
                print(f"Could not add profile_picture column: {e}")
        
        # Add interests column if it doesn't exist
        if 'interests' not in existing_columns:
            try:
                conn.execute(text("ALTER TABLE users ADD COLUMN interests TEXT"))
                print("Added 'interests' column to users table")
            except Exception as e:
                print(f"Could not add interests column: {e}")
        
        # Add looking_for column if it doesn't exist
        if 'looking_for' not in existing_columns:
            try:
                conn.execute(text("ALTER TABLE users ADD COLUMN looking_for TEXT"))
                print("Added 'looking_for' column to users table")
            except Exception as e:
                print(f"Could not add looking_for column: {e}")
        
        # Add linkedin_url column if it doesn't exist
        if 'linkedin_url' not in existing_columns:
            try:
                conn.execute(text("ALTER TABLE users ADD COLUMN linkedin_url VARCHAR"))
                print("Added 'linkedin_url' column to users table")
            except Exception as e:
                print(f"Could not add linkedin_url column: {e}")
        
        # Add github_url column if it doesn't exist
        if 'github_url' not in existing_columns:
            try:
                conn.execute(text("ALTER TABLE users ADD COLUMN github_url VARCHAR"))
                print("Added 'github_url' column to users table")
            except Exception as e:
                print(f"Could not add github_url column: {e}")
        
        # Add profile_type column if it doesn't exist
        if 'profile_type' not in existing_columns:
            try:
                conn.execute(text("ALTER TABLE users ADD COLUMN profile_type VARCHAR"))
                print("Added 'profile_type' column to users table")
            except Exception as e:
                print(f"Could not add profile_type column: {e}")
        if 'linkedin_url' not in existing_columns:
            try:
                conn.execute(text("ALTER TABLE users ADD COLUMN linkedin_url VARCHAR"))
                print("Added 'linkedin_url' column to users table")
            except Exception as e:
                print(f"Could not add linkedin_url column: {e}")
        
        # Add github_url column if it doesn't exist
        if 'github_url' not in existing_columns:
            try:
                conn.execute(text("ALTER TABLE users ADD COLUMN github_url VARCHAR"))
                print("Added 'github_url' column to users table")
            except Exception as e:
                print(f"Could not add github_url column: {e}")

    # Check and migrate posts table
    if 'posts' in table_names:
        posts_columns = [col['name'] for col in inspector.get_columns('posts')]

        with engine.begin() as conn:
            # Add post_type column if it doesn't exist
            if 'post_type' not in posts_columns:
                try:
                    conn.execute(text("ALTER TABLE posts ADD COLUMN post_type VARCHAR(20) DEFAULT 'regular'"))
                    print("Added 'post_type' column to posts table")
                except Exception as e:
                    print(f"Could not add post_type column to posts table: {e}")

    # Check and migrate messages table
    if 'messages' in table_names:
        messages_columns = [col['name'] for col in inspector.get_columns('messages')]

        with engine.begin() as conn:
            # Add slot_request_id column if it doesn't exist
            if 'slot_request_id' not in messages_columns:
                try:
                    conn.execute(text("ALTER TABLE messages ADD COLUMN slot_request_id INTEGER"))
                    print("Added 'slot_request_id' column to messages table")
                except Exception as e:
                    print(f"Could not add slot_request_id column to messages table: {e}")


def get_db():
    """Dependency to get database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

