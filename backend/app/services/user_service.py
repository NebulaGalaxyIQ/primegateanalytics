from datetime import datetime
from typing import Optional, Union

from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models.user import User
from app.schemas.user import (
    UserAdminCreate,
    UserCreate,
    UserRoleUpdateSchema,
    UserStatusUpdateSchema,
    UserUpdate,
)


def normalize_text(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    value = value.strip()
    return value or None


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


def get_user_by_id_or_raise(db: Session, user_id: int) -> User:
    user = get_user_by_id(db, user_id)
    if not user:
        raise ValueError("User not found")
    return user


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


def get_user_by_username_or_email(db: Session, value: str) -> Optional[User]:
    value = (value or "").strip()
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


def ensure_username_available(
    db: Session,
    username: str,
    exclude_user_id: Optional[int] = None,
) -> None:
    query = db.query(User).filter(User.username == normalize_username(username))
    if exclude_user_id is not None:
        query = query.filter(User.id != exclude_user_id)

    if query.first():
        raise ValueError("Username already exists")


def ensure_email_available(
    db: Session,
    email: str,
    exclude_user_id: Optional[int] = None,
) -> None:
    query = db.query(User).filter(User.email == normalize_email(email))
    if exclude_user_id is not None:
        query = query.filter(User.id != exclude_user_id)

    if query.first():
        raise ValueError("Email already exists")


def create_user_by_admin(
    db: Session,
    user_data: Union[UserCreate, UserAdminCreate],
    created_by: Optional[User] = None,
) -> User:
    username = normalize_username(user_data.username)
    email = normalize_email(str(user_data.email))
    role = normalize_role(user_data.role)

    ensure_username_available(db, username)
    ensure_email_available(db, email)

    is_active = True
    is_verified = False
    is_superuser = role == User.ROLE_ADMIN

    if isinstance(user_data, UserAdminCreate):
        is_active = bool(user_data.is_active)
        is_verified = bool(user_data.is_verified)
        is_superuser = bool(user_data.is_superuser) or role == User.ROLE_ADMIN

    user = User(
        full_name=(user_data.full_name or "").strip(),
        username=username,
        email=email,
        phone_number=normalize_text(user_data.phone_number),
        role=role,
        department=normalize_text(user_data.department),
        hashed_password=hash_password(user_data.password),
        is_active=is_active,
        is_verified=is_verified,
        is_superuser=is_superuser,
        created_by_id=created_by.id if created_by else None,
    )

    try:
        db.add(user)
        db.commit()
        db.refresh(user)
        return user
    except IntegrityError:
        db.rollback()
        raise ValueError("User with the same username or email already exists")


def list_users(
    db: Session,
    page: int = 1,
    page_size: int = 10,
    search: Optional[str] = None,
    role: Optional[str] = None,
    is_active: Optional[bool] = None,
    department: Optional[str] = None,
) -> dict:
    page = max(page, 1)
    page_size = max(min(page_size, 100), 1)

    query = db.query(User)

    if search:
        term = f"%{search.strip()}%"
        query = query.filter(
            or_(
                User.full_name.ilike(term),
                User.username.ilike(term),
                User.email.ilike(term),
                User.phone_number.ilike(term),
                User.department.ilike(term),
                User.role.ilike(term),
            )
        )

    if role:
        query = query.filter(User.role == normalize_role(role))

    if is_active is not None:
        query = query.filter(User.is_active == is_active)

    if department:
        query = query.filter(User.department.ilike(f"%{department.strip()}%"))

    total = query.count()

    items = (
        query.order_by(User.created_at.desc(), User.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
    }


def update_user(
    db: Session,
    user_id: int,
    payload: UserUpdate,
    updated_by: Optional[User] = None,
) -> User:
    user = get_user_by_id_or_raise(db, user_id)

    data = payload.model_dump(exclude_unset=True)

    if "username" in data and data["username"] is not None:
        new_username = normalize_username(data["username"])
        ensure_username_available(db, new_username, exclude_user_id=user.id)
        user.username = new_username

    if "email" in data and data["email"] is not None:
        new_email = normalize_email(str(data["email"]))
        ensure_email_available(db, new_email, exclude_user_id=user.id)
        user.email = new_email

    if "full_name" in data and data["full_name"] is not None:
        user.full_name = data["full_name"].strip()

    if "phone_number" in data:
        user.phone_number = normalize_text(data["phone_number"])

    if "department" in data:
        user.department = normalize_text(data["department"])

    if "role" in data and data["role"] is not None:
        new_role = normalize_role(data["role"])
        user.role = new_role
        if new_role == User.ROLE_ADMIN:
            user.is_superuser = True

    if "is_active" in data and data["is_active"] is not None:
        user.is_active = bool(data["is_active"])

    if "is_verified" in data and data["is_verified"] is not None:
        user.is_verified = bool(data["is_verified"])

    if "is_superuser" in data and data["is_superuser"] is not None:
        user.is_superuser = bool(data["is_superuser"]) or normalize_role(user.role) == User.ROLE_ADMIN

    if updated_by and updated_by.id == user.id and user.is_active is False:
        raise ValueError("You cannot deactivate your own account")

    try:
        db.add(user)
        db.commit()
        db.refresh(user)
        return user
    except IntegrityError:
        db.rollback()
        raise ValueError("Failed to update user because of duplicate username or email")


def update_user_role(
    db: Session,
    user_id: int,
    payload: UserRoleUpdateSchema,
) -> User:
    user = get_user_by_id_or_raise(db, user_id)

    new_role = normalize_role(payload.role)
    user.role = new_role

    if new_role == User.ROLE_ADMIN:
        user.is_superuser = True

    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def update_user_status(
    db: Session,
    user_id: int,
    payload: UserStatusUpdateSchema,
    updated_by: Optional[User] = None,
) -> User:
    user = get_user_by_id_or_raise(db, user_id)

    data = payload.model_dump(exclude_unset=True)

    if "is_active" in data and data["is_active"] is not None:
        if updated_by and updated_by.id == user.id and data["is_active"] is False:
            raise ValueError("You cannot deactivate your own account")
        user.is_active = bool(data["is_active"])

    if "is_verified" in data and data["is_verified"] is not None:
        user.is_verified = bool(data["is_verified"])

    if "is_superuser" in data and data["is_superuser"] is not None:
        new_is_superuser = bool(data["is_superuser"])
        if normalize_role(user.role) == User.ROLE_ADMIN:
            user.is_superuser = True
        else:
            user.is_superuser = new_is_superuser

    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def admin_reset_user_password(
    db: Session,
    user_id: int,
    new_password: str,
) -> User:
    user = get_user_by_id_or_raise(db, user_id)

    password = (new_password or "").strip()
    if len(password) < 6:
        raise ValueError("Password must be at least 6 characters long")

    user.hashed_password = hash_password(password)
    user.password_changed_at = datetime.utcnow()

    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def delete_user(
    db: Session,
    user_id: int,
    deleted_by: Optional[User] = None,
) -> None:
    user = get_user_by_id_or_raise(db, user_id)

    if deleted_by and deleted_by.id == user.id:
        raise ValueError("You cannot delete your own account")

    db.delete(user)
    db.commit()