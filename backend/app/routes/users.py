from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import require_admin
from app.models.user import User
from app.schemas.user import (
    MessageResponse,
    ResetPasswordSchema,
    UserAdminCreate,
    UserListResponse,
    UserResponse,
    UserRoleUpdateSchema,
    UserStatusUpdateSchema,
    UserUpdate,
)
from app.services.user_service import (
    admin_reset_user_password,
    create_user_by_admin,
    delete_user,
    get_user_by_id,
    list_users,
    update_user,
    update_user_role,
    update_user_status,
)

router = APIRouter(prefix="/users", tags=["Users"])


def _handle_service_error(error: ValueError) -> None:
    message = str(error)

    if message == "User not found":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=message,
        )

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=message,
    )


@router.post(
    "",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_user(
    payload: UserAdminCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin()),
):
    try:
        user = create_user_by_admin(
            db=db,
            user_data=payload,
            created_by=current_user,
        )
        return user
    except ValueError as error:
        _handle_service_error(error)


@router.get(
    "",
    response_model=UserListResponse,
    status_code=status.HTTP_200_OK,
)
def get_users(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=100),
    search: Optional[str] = Query(default=None),
    role: Optional[str] = Query(default=None),
    is_active: Optional[bool] = Query(default=None),
    department: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin()),
):
    result = list_users(
        db=db,
        page=page,
        page_size=page_size,
        search=search,
        role=role,
        is_active=is_active,
        department=department,
    )
    return UserListResponse(**result)


@router.get(
    "/{user_id}",
    response_model=UserResponse,
    status_code=status.HTTP_200_OK,
)
def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin()),
):
    user = get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    return user


@router.patch(
    "/{user_id}",
    response_model=UserResponse,
    status_code=status.HTTP_200_OK,
)
def patch_user(
    user_id: int,
    payload: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin()),
):
    try:
        user = update_user(
            db=db,
            user_id=user_id,
            payload=payload,
            updated_by=current_user,
        )
        return user
    except ValueError as error:
        _handle_service_error(error)


@router.patch(
    "/{user_id}/role",
    response_model=UserResponse,
    status_code=status.HTTP_200_OK,
)
def patch_user_role(
    user_id: int,
    payload: UserRoleUpdateSchema,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin()),
):
    try:
        user = update_user_role(
            db=db,
            user_id=user_id,
            payload=payload,
        )
        return user
    except ValueError as error:
        _handle_service_error(error)


@router.patch(
    "/{user_id}/status",
    response_model=UserResponse,
    status_code=status.HTTP_200_OK,
)
def patch_user_status(
    user_id: int,
    payload: UserStatusUpdateSchema,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin()),
):
    try:
        user = update_user_status(
            db=db,
            user_id=user_id,
            payload=payload,
            updated_by=current_user,
        )
        return user
    except ValueError as error:
        _handle_service_error(error)


@router.post(
    "/{user_id}/reset-password",
    response_model=MessageResponse,
    status_code=status.HTTP_200_OK,
)
def reset_user_password(
    user_id: int,
    payload: ResetPasswordSchema,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin()),
):
    try:
        admin_reset_user_password(
            db=db,
            user_id=user_id,
            new_password=payload.new_password,
        )
        return MessageResponse(message="Password reset successfully")
    except ValueError as error:
        _handle_service_error(error)


@router.delete(
    "/{user_id}",
    response_model=MessageResponse,
    status_code=status.HTTP_200_OK,
)
def remove_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin()),
):
    try:
        delete_user(
            db=db,
            user_id=user_id,
            deleted_by=current_user,
        )
        return MessageResponse(message="User deleted successfully")
    except ValueError as error:
        _handle_service_error(error)