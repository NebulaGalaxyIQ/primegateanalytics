from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_active_user
from app.models.user import User
from app.schemas.user import (
    ChangePasswordSchema,
    LoginSchema,
    MessageResponse,
    TokenWithUserSchema,
    UserCreate,
    UserResponse,
)
from app.services.auth_service import change_password, create_user, login_user

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
)
def register_user(
    user_data: UserCreate,
    db: Session = Depends(get_db),
):
    try:
        user = create_user(db, user_data)
        return user
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.post(
    "/login",
    response_model=TokenWithUserSchema,
    status_code=status.HTTP_200_OK,
)
def login(
    credentials: LoginSchema,
    db: Session = Depends(get_db),
):
    auth_result = login_user(
        db=db,
        username_or_email=credentials.username_or_email,
        password=credentials.password,
    )

    if not auth_result:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username/email or password",
        )

    return auth_result


@router.get(
    "/me",
    response_model=UserResponse,
    status_code=status.HTTP_200_OK,
)
def get_me(
    current_user: User = Depends(get_current_active_user),
):
    return current_user


@router.post(
    "/change-password",
    response_model=MessageResponse,
    status_code=status.HTTP_200_OK,
)
def update_password(
    payload: ChangePasswordSchema,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    try:
        change_password(
            db=db,
            user=current_user,
            current_password=payload.current_password,
            new_password=payload.new_password,
        )
        return MessageResponse(message="Password changed successfully")
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )