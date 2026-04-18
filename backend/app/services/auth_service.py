from datetime import datetime
from typing import Optional

from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.security import create_access_token, hash_password, verify_password
from app.models.user import User
from app.schemas.user import TokenWithUserSchema, UserCreate


def normalize_email(value: str) -> str:
    return (value or "").strip().lower()


def normalize_username(value: str) -> str:
    return (value or "").strip()


def normalize_role(value: Optional[str]) -> str:
    role = (value or "").strip().lower().replace("-", "_").replace(" ", "_")
    while "__" in role:
        role = role.replace("__", "_")
    return role or User.ROLE_PRODUCTION_MANAGER


def get_user_by_id(db: Session, user_id: int) -> Optional[User]:
    return db.query(User).filter(User.id == user_id).first()


def get_user_by_username(db: Session, username: str) -> Optional[User]:
    username = normalize_username(username)
    if not username:
        return None
    return db.query(User).filter(User.username == username).first()


def get_user_by_email(db: Session, email: str) -> Optional[User]:
    email = normalize_email(email)
    if not email:
        return None
    return db.query(User).filter(User.email == email).first()


def get_user_by_username_or_email(db: Session, username_or_email: str) -> Optional[User]:
    value = (username_or_email or "").strip()
    if not value:
        return None

    return (
        db.query(User)
        .filter(
            or_(
                User.username == value,
                User.email == value.lower(),
            )
        )
        .first()
    )


def create_user(db: Session, user_data: UserCreate) -> User:
    username = normalize_username(user_data.username)
    email = normalize_email(str(user_data.email))
    role = normalize_role(user_data.role)

    existing_username = get_user_by_username(db, username)
    if existing_username:
        raise ValueError("Username already exists")

    existing_email = get_user_by_email(db, email)
    if existing_email:
        raise ValueError("Email already exists")

    user = User(
        full_name=user_data.full_name.strip(),
        username=username,
        email=email,
        phone_number=(user_data.phone_number or "").strip() or None,
        department=(user_data.department or "").strip() or None,
        role=role,
        hashed_password=hash_password(user_data.password),
        is_active=True,
        is_verified=False,
        is_superuser=(role == User.ROLE_ADMIN),
    )

    try:
        db.add(user)
        db.commit()
        db.refresh(user)
        return user
    except IntegrityError:
        db.rollback()
        raise ValueError("User with the same username or email already exists")


def authenticate_user(db: Session, username_or_email: str, password: str) -> Optional[User]:
    user = get_user_by_username_or_email(db, username_or_email)
    if not user:
        return None

    if not verify_password(password, user.hashed_password):
        return None

    if not user.is_active:
        return None

    return user


def login_user(
    db: Session,
    username_or_email: str,
    password: str,
) -> Optional[TokenWithUserSchema]:
    user = authenticate_user(db, username_or_email, password)
    if not user:
        return None

    user.last_login_at = datetime.utcnow()

    db.add(user)
    db.commit()
    db.refresh(user)

    access_token = create_access_token(
        data={
            "sub": user.username,
            "user_id": user.id,
            "role": user.role,
        }
    )

    return TokenWithUserSchema(
        access_token=access_token,
        token_type="bearer",
        user=user,
    )


def change_password(
    db: Session,
    user: User,
    current_password: str,
    new_password: str,
) -> User:
    if not verify_password(current_password, user.hashed_password):
        raise ValueError("Current password is incorrect")

    if current_password == new_password:
        raise ValueError("New password must be different from current password")

    user.hashed_password = hash_password(new_password)
    user.password_changed_at = datetime.utcnow()

    db.add(user)
    db.commit()
    db.refresh(user)
    return user