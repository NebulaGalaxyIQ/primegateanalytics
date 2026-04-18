from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field, ValidationInfo, field_validator


def normalize_text(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    value = value.strip()
    return value or None


def normalize_role_value(value: str) -> str:
    value = (value or "").strip().lower().replace("-", "_").replace(" ", "_")
    while "__" in value:
        value = value.replace("__", "_")
    if not value:
        raise ValueError("Role is required")
    return value


class UserBase(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=150)
    username: str = Field(..., min_length=3, max_length=100)
    email: EmailStr
    phone_number: Optional[str] = Field(default=None, max_length=30)
    role: str = Field(default="production_manager", min_length=2, max_length=100)
    department: Optional[str] = Field(default=None, max_length=100)

    @field_validator("full_name")
    @classmethod
    def validate_full_name(cls, value: str) -> str:
        value = (value or "").strip()
        if not value:
            raise ValueError("Full name is required")
        return value

    @field_validator("username")
    @classmethod
    def validate_username(cls, value: str) -> str:
        value = (value or "").strip()
        if not value:
            raise ValueError("Username is required")
        if " " in value:
            raise ValueError("Username must not contain spaces")
        return value

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: EmailStr) -> str:
        return str(value).strip().lower()

    @field_validator("phone_number")
    @classmethod
    def normalize_phone_number(cls, value: Optional[str]) -> Optional[str]:
        return normalize_text(value)

    @field_validator("department")
    @classmethod
    def normalize_department(cls, value: Optional[str]) -> Optional[str]:
        return normalize_text(value)

    @field_validator("role")
    @classmethod
    def normalize_role(cls, value: str) -> str:
        return normalize_role_value(value)


class UserCreate(UserBase):
    password: str = Field(..., min_length=6, max_length=128)

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        value = (value or "").strip()
        if len(value) < 6:
            raise ValueError("Password must be at least 6 characters long")
        return value


class UserAdminCreate(UserCreate):
    is_active: bool = True
    is_verified: bool = False
    is_superuser: bool = False


class UserRegister(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=150)
    username: str = Field(..., min_length=3, max_length=100)
    email: EmailStr
    phone_number: Optional[str] = Field(default=None, max_length=30)
    password: str = Field(..., min_length=6, max_length=128)
    department: Optional[str] = Field(default=None, max_length=100)

    @field_validator("full_name")
    @classmethod
    def validate_full_name(cls, value: str) -> str:
        value = (value or "").strip()
        if not value:
            raise ValueError("Full name is required")
        return value

    @field_validator("username")
    @classmethod
    def validate_username(cls, value: str) -> str:
        value = (value or "").strip()
        if not value:
            raise ValueError("Username is required")
        if " " in value:
            raise ValueError("Username must not contain spaces")
        return value

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: EmailStr) -> str:
        return str(value).strip().lower()

    @field_validator("phone_number")
    @classmethod
    def normalize_phone_number(cls, value: Optional[str]) -> Optional[str]:
        return normalize_text(value)

    @field_validator("department")
    @classmethod
    def normalize_department(cls, value: Optional[str]) -> Optional[str]:
        return normalize_text(value)

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        value = (value or "").strip()
        if len(value) < 6:
            raise ValueError("Password must be at least 6 characters long")
        return value


class UserUpdate(BaseModel):
    full_name: Optional[str] = Field(default=None, min_length=2, max_length=150)
    username: Optional[str] = Field(default=None, min_length=3, max_length=100)
    email: Optional[EmailStr] = None
    phone_number: Optional[str] = Field(default=None, max_length=30)
    role: Optional[str] = Field(default=None, min_length=2, max_length=100)
    department: Optional[str] = Field(default=None, max_length=100)
    is_active: Optional[bool] = None
    is_verified: Optional[bool] = None
    is_superuser: Optional[bool] = None

    @field_validator("full_name")
    @classmethod
    def validate_full_name(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        value = value.strip()
        if not value:
            raise ValueError("Full name cannot be empty")
        return value

    @field_validator("username")
    @classmethod
    def validate_username(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        value = value.strip()
        if not value:
            raise ValueError("Username cannot be empty")
        if " " in value:
            raise ValueError("Username must not contain spaces")
        return value

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: Optional[EmailStr]) -> Optional[str]:
        if value is None:
            return value
        return str(value).strip().lower()

    @field_validator("phone_number")
    @classmethod
    def normalize_phone_number(cls, value: Optional[str]) -> Optional[str]:
        return normalize_text(value)

    @field_validator("department")
    @classmethod
    def normalize_department(cls, value: Optional[str]) -> Optional[str]:
        return normalize_text(value)

    @field_validator("role")
    @classmethod
    def normalize_role(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        return normalize_role_value(value)


class UserSelfUpdate(BaseModel):
    full_name: Optional[str] = Field(default=None, min_length=2, max_length=150)
    email: Optional[EmailStr] = None
    phone_number: Optional[str] = Field(default=None, max_length=30)
    department: Optional[str] = Field(default=None, max_length=100)

    @field_validator("full_name")
    @classmethod
    def validate_full_name(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        value = value.strip()
        if not value:
            raise ValueError("Full name cannot be empty")
        return value

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: Optional[EmailStr]) -> Optional[str]:
        if value is None:
            return value
        return str(value).strip().lower()

    @field_validator("phone_number")
    @classmethod
    def normalize_phone_number(cls, value: Optional[str]) -> Optional[str]:
        return normalize_text(value)

    @field_validator("department")
    @classmethod
    def normalize_department(cls, value: Optional[str]) -> Optional[str]:
        return normalize_text(value)


class ChangePasswordSchema(BaseModel):
    current_password: str = Field(..., min_length=6, max_length=128)
    new_password: str = Field(..., min_length=6, max_length=128)
    confirm_password: str = Field(..., min_length=6, max_length=128)

    @field_validator("current_password", "new_password", "confirm_password")
    @classmethod
    def validate_password_fields(cls, value: str) -> str:
        value = (value or "").strip()
        if len(value) < 6:
            raise ValueError("Password must be at least 6 characters long")
        return value

    @field_validator("confirm_password")
    @classmethod
    def validate_password_match(cls, value: str, info: ValidationInfo) -> str:
        new_password = info.data.get("new_password")
        if new_password and value != new_password:
            raise ValueError("Confirm password does not match new password")
        return value


class ResetPasswordSchema(BaseModel):
    new_password: str = Field(..., min_length=6, max_length=128)
    confirm_password: str = Field(..., min_length=6, max_length=128)

    @field_validator("new_password", "confirm_password")
    @classmethod
    def validate_password_fields(cls, value: str) -> str:
        value = (value or "").strip()
        if len(value) < 6:
            raise ValueError("Password must be at least 6 characters long")
        return value

    @field_validator("confirm_password")
    @classmethod
    def validate_password_match(cls, value: str, info: ValidationInfo) -> str:
        new_password = info.data.get("new_password")
        if new_password and value != new_password:
            raise ValueError("Confirm password does not match new password")
        return value


class LoginSchema(BaseModel):
    username_or_email: str = Field(..., min_length=3, max_length=150)
    password: str = Field(..., min_length=6, max_length=128)

    @field_validator("username_or_email")
    @classmethod
    def normalize_username_or_email(cls, value: str) -> str:
        value = (value or "").strip()
        if not value:
            raise ValueError("Username or email is required")
        return value

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        value = (value or "").strip()
        if len(value) < 6:
            raise ValueError("Password must be at least 6 characters long")
        return value


class TokenData(BaseModel):
    sub: Optional[str] = None
    user_id: Optional[int] = None
    role: Optional[str] = None


class TokenSchema(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserMiniResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    full_name: str
    username: str
    email: EmailStr
    role: str
    department: Optional[str] = None
    is_active: bool


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    full_name: str
    username: str
    email: EmailStr
    phone_number: Optional[str] = None
    role: str
    department: Optional[str] = None

    is_active: bool
    is_verified: bool
    is_superuser: bool

    created_by_id: Optional[int] = None
    created_by: Optional[UserMiniResponse] = None

    last_login_at: Optional[datetime] = None
    password_changed_at: Optional[datetime] = None

    created_at: datetime
    updated_at: datetime


class TokenWithUserSchema(TokenSchema):
    user: UserResponse


class UserListResponse(BaseModel):
    items: List[UserResponse]
    total: int
    page: int = 1
    page_size: int = 10


class UserRoleUpdateSchema(BaseModel):
    role: str = Field(..., min_length=2, max_length=100)

    @field_validator("role")
    @classmethod
    def normalize_role(cls, value: str) -> str:
        return normalize_role_value(value)


class UserStatusUpdateSchema(BaseModel):
    is_active: Optional[bool] = None
    is_verified: Optional[bool] = None
    is_superuser: Optional[bool] = None


class MessageResponse(BaseModel):
    message: str


# Backward-compatible aliases for older imports in your codebase
UserLogin = LoginSchema
AuthResponse = TokenWithUserSchema
ChangePasswordRequest = ChangePasswordSchema


TokenWithUserSchema.model_rebuild()
UserResponse.model_rebuild()