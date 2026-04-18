from datetime import datetime, timedelta, timezone
from typing import Callable, Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.models.user import User
from app.schemas.user import TokenData

pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def normalize_role(role: Optional[str]) -> str:
    value = (role or "").strip().lower().replace("-", "_").replace(" ", "_")
    while "__" in value:
        value = value.replace("__", "_")
    return value


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(
    data: dict,
    expires_delta: Optional[timedelta] = None,
) -> str:
    to_encode = data.copy()

    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )

    # keep role normalized inside token if provided
    if "role" in to_encode:
        to_encode["role"] = normalize_role(to_encode.get("role"))

    to_encode.update({"exp": expire})

    encoded_jwt = jwt.encode(
        to_encode,
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM,
    )
    return encoded_jwt


def decode_access_token(token: str) -> Optional[TokenData]:
    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM],
        )

        username = payload.get("sub")
        user_id = payload.get("user_id")
        role = payload.get("role")

        if username is None:
            return None

        return TokenData(
            sub=str(username),
            user_id=user_id,
            role=normalize_role(role) if role is not None else None,
        )

    except JWTError:
        return None


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate authentication credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    token_data = decode_access_token(token)
    if token_data is None or token_data.sub is None:
        raise credentials_exception

    user = None

    if token_data.user_id is not None:
        user = db.query(User).filter(User.id == token_data.user_id).first()

    if user is None:
        user = db.query(User).filter(User.username == token_data.sub).first()

    if user is None:
        user = db.query(User).filter(User.email == token_data.sub.lower()).first()

    if user is None:
        raise credentials_exception

    return user


def get_current_active_user(
    current_user: User = Depends(get_current_user),
) -> User:
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user account",
        )
    return current_user


def is_admin(user: User) -> bool:
    return normalize_role(user.role) == "admin" or bool(user.is_superuser)


def require_admin() -> Callable:
    def admin_checker(current_user: User = Depends(get_current_active_user)) -> User:
        if not is_admin(current_user):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin access required",
            )
        return current_user

    return admin_checker


def require_roles(*allowed_roles: str) -> Callable:
    allowed_values = {normalize_role(role) for role in allowed_roles if role}

    def role_checker(current_user: User = Depends(get_current_active_user)) -> User:
        user_role = normalize_role(current_user.role)

        if is_admin(current_user):
            return current_user

        if user_role not in allowed_values:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to perform this action",
            )
        return current_user

    return role_checker