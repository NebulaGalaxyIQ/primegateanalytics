from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.core.database import Base


class User(Base):
    __tablename__ = "users"

    # Optional built-in role names for consistency
    ROLE_ADMIN = "admin"
    ROLE_PRODUCTION_MANAGER = "production_manager"
    ROLE_AUDITOR = "auditor"
    ROLE_STORE_MANAGER = "store_manager"
    ROLE_CUTS_MANAGER = "cuts_manager"

    id = Column(Integer, primary_key=True, index=True)

    full_name = Column(String(150), nullable=False)
    username = Column(String(100), unique=True, index=True, nullable=False)
    email = Column(String(150), unique=True, index=True, nullable=False)
    phone_number = Column(String(30), nullable=True)

    hashed_password = Column(String(255), nullable=False)

    # Free-text role so admin can create any role without changing code
    role = Column(String(100), nullable=False, default=ROLE_PRODUCTION_MANAGER, index=True)

    department = Column(String(100), nullable=True)

    is_active = Column(Boolean, default=True, nullable=False)
    is_verified = Column(Boolean, default=False, nullable=False)
    is_superuser = Column(Boolean, default=False, nullable=False)

    # Tracks which admin/user created this account
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_by = relationship(
        "User",
        remote_side=[id],
        backref="created_users",
        foreign_keys=[created_by_id],
    )

    last_login_at = Column(DateTime, nullable=True)
    password_changed_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )

    def __repr__(self) -> str:
        return f"<User(id={self.id}, username='{self.username}', role='{self.role}')>"