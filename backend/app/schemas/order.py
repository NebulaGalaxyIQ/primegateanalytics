from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field, ValidationInfo, field_validator, model_validator

from app.schemas.user import UserMiniResponse


VALID_ORDER_TYPES = {"local", "chilled", "frozen"}
VALID_ORDER_PROFILES = {"standard_order", "frozen_container"}
VALID_ORDER_STATUSES = {
    "draft",
    "confirmed",
    "in_progress",
    "completed",
    "cancelled",
}
VALID_ANIMAL_TYPES = {"goat", "sheep", "cattle"}

ANIMAL_TYPE_ALIASES = {
    "goat": "goat",
    "goat_meat": "goat",
    "sheep": "sheep",
    "lamb": "sheep",
    "mutton": "sheep",
    "cattle": "cattle",
    "beef": "cattle",
    "cow": "cattle",
}


def normalize_text(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    value = value.strip()
    return value or None


def normalize_slug(value: Optional[str]) -> str:
    value = (value or "").strip().lower().replace("-", "_").replace(" ", "_")
    while "__" in value:
        value = value.replace("__", "_")
    return value


def normalize_order_type(value: str) -> str:
    value = normalize_slug(value)
    if value not in VALID_ORDER_TYPES:
        raise ValueError("Invalid order type. Use local, chilled, or frozen.")
    return value


def normalize_order_profile(value: str) -> str:
    value = normalize_slug(value)
    if value not in VALID_ORDER_PROFILES:
        raise ValueError("Invalid order profile. Use standard_order or frozen_container.")
    return value


def normalize_order_status(value: str) -> str:
    value = normalize_slug(value)
    if value not in VALID_ORDER_STATUSES:
        raise ValueError(
            "Invalid status. Use draft, confirmed, in_progress, completed, or cancelled."
        )
    return value


def normalize_animal_type(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    cleaned = normalize_slug(value)
    mapped = ANIMAL_TYPE_ALIASES.get(cleaned)
    if mapped not in VALID_ANIMAL_TYPES:
        raise ValueError("Invalid animal type. Use goat, sheep/lamb, or cattle/beef.")
    return mapped


def parse_decimal(value, field_name: str, places: str = "0.01") -> Optional[Decimal]:
    if value in (None, "", "null"):
        return None

    try:
        number = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        raise ValueError(f"{field_name} must be a valid number")

    if number < 0:
        raise ValueError(f"{field_name} cannot be negative")

    return number.quantize(Decimal(places))


class OrderItemInput(BaseModel):
    product_name: Optional[str] = Field(default=None, max_length=150)
    animal_type: Optional[str] = Field(default=None, max_length=50)
    quantity_kg: float = Field(..., gt=0)
    notes: Optional[str] = Field(default=None, max_length=500)

    @field_validator("product_name")
    @classmethod
    def validate_product_name(cls, value: Optional[str]) -> Optional[str]:
        return normalize_text(value)

    @field_validator("animal_type")
    @classmethod
    def validate_animal_type(cls, value: Optional[str]) -> Optional[str]:
        return normalize_animal_type(value)

    @field_validator("notes")
    @classmethod
    def validate_notes(cls, value: Optional[str]) -> Optional[str]:
        return normalize_text(value)

    @field_validator("quantity_kg")
    @classmethod
    def validate_quantity_kg(cls, value: float) -> float:
        if value <= 0:
            raise ValueError("Quantity must be greater than zero")
        return round(float(value), 2)

    @model_validator(mode="after")
    def validate_product_or_animal_type(self):
        if not self.product_name and not self.animal_type:
            raise ValueError("Each order item must include product_name or animal_type")
        return self


class OrderItemResponse(BaseModel):
    product_name: str
    animal_type: str
    quantity_kg: float
    pieces_required: int
    animals_required: int
    notes: Optional[str] = None


class OrderBase(BaseModel):
    enterprise_name: str = Field(..., min_length=2, max_length=200)

    order_type: str = Field(default="local", min_length=3, max_length=30)
    order_profile: str = Field(default="standard_order", min_length=3, max_length=30)
    order_subtype: Optional[str] = Field(default=None, max_length=50)

    status: str = Field(default="draft", min_length=3, max_length=30)

    report_month: Optional[int] = Field(default=None, ge=1, le=12)
    report_year: Optional[int] = Field(default=None, ge=2000, le=2100)

    order_ratio: Optional[str] = Field(default=None, max_length=30)

    shipment_value_usd: Optional[Decimal] = Field(default=None, ge=0)
    price_per_kg_usd: Optional[Decimal] = Field(default=None, ge=0)
    amount_paid_usd: Optional[Decimal] = Field(default=None, ge=0)
    balance_usd: Optional[Decimal] = Field(default=None, ge=0)

    container_gate_in: Optional[date] = None
    departure_date: Optional[date] = None
    jurisdiction: Optional[str] = Field(default=None, max_length=100)

    items_json: List[OrderItemInput] = Field(default_factory=list)

    slaughter_schedule: Optional[date] = None
    expected_delivery: Optional[date] = None
    is_delivery_date_manual: bool = False
    delivery_days_offset: Optional[int] = Field(default=None, ge=0, le=365)

    notes: Optional[str] = None

    @field_validator("enterprise_name")
    @classmethod
    def validate_enterprise_name(cls, value: str) -> str:
        value = (value or "").strip()
        if not value:
            raise ValueError("Enterprise name is required")
        return value

    @field_validator("order_type")
    @classmethod
    def validate_order_type(cls, value: str) -> str:
        return normalize_order_type(value)

    @field_validator("order_profile")
    @classmethod
    def validate_order_profile(cls, value: str) -> str:
        return normalize_order_profile(value)

    @field_validator("order_subtype")
    @classmethod
    def validate_order_subtype(cls, value: Optional[str]) -> Optional[str]:
        value = normalize_text(value)
        return normalize_slug(value) if value else None

    @field_validator("status")
    @classmethod
    def validate_status(cls, value: str) -> str:
        return normalize_order_status(value)

    @field_validator("order_ratio")
    @classmethod
    def validate_order_ratio(cls, value: Optional[str]) -> Optional[str]:
        return normalize_text(value)

    @field_validator("jurisdiction")
    @classmethod
    def validate_jurisdiction(cls, value: Optional[str]) -> Optional[str]:
        return normalize_text(value)

    @field_validator("notes")
    @classmethod
    def validate_notes(cls, value: Optional[str]) -> Optional[str]:
        return normalize_text(value)

    @field_validator("shipment_value_usd")
    @classmethod
    def validate_shipment_value_usd(cls, value: Optional[Decimal]) -> Optional[Decimal]:
        return parse_decimal(value, "shipment_value_usd", "0.01")

    @field_validator("price_per_kg_usd")
    @classmethod
    def validate_price_per_kg_usd(cls, value: Optional[Decimal]) -> Optional[Decimal]:
        return parse_decimal(value, "price_per_kg_usd", "0.0001")

    @field_validator("amount_paid_usd")
    @classmethod
    def validate_amount_paid_usd(cls, value: Optional[Decimal]) -> Optional[Decimal]:
        return parse_decimal(value, "amount_paid_usd", "0.01")

    @field_validator("balance_usd")
    @classmethod
    def validate_balance_usd(cls, value: Optional[Decimal]) -> Optional[Decimal]:
        return parse_decimal(value, "balance_usd", "0.01")

    @field_validator("items_json")
    @classmethod
    def validate_items_json(cls, value: List[OrderItemInput]) -> List[OrderItemInput]:
        if not value:
            raise ValueError("At least one order item is required")
        return value

    @model_validator(mode="after")
    def validate_business_rules(self):
        if self.is_delivery_date_manual and self.expected_delivery is None:
            raise ValueError(
                "expected_delivery is required when is_delivery_date_manual is true"
            )

        if (self.report_month is None) ^ (self.report_year is None):
            raise ValueError("report_month and report_year must be provided together")

        if self.order_profile == "frozen_container":
            self.order_type = "frozen"

        if (
            self.order_profile == "frozen_container"
            and self.order_type != "frozen"
        ):
            raise ValueError("Frozen container orders must use order_type='frozen'")

        return self


class OrderCreate(OrderBase):
    order_number: Optional[str] = Field(default=None, max_length=100)


class OrderUpdate(BaseModel):
    order_number: Optional[str] = Field(default=None, max_length=100)

    enterprise_name: Optional[str] = Field(default=None, min_length=2, max_length=200)

    order_type: Optional[str] = Field(default=None, min_length=3, max_length=30)
    order_profile: Optional[str] = Field(default=None, min_length=3, max_length=30)
    order_subtype: Optional[str] = Field(default=None, max_length=50)

    status: Optional[str] = Field(default=None, min_length=3, max_length=30)

    report_month: Optional[int] = Field(default=None, ge=1, le=12)
    report_year: Optional[int] = Field(default=None, ge=2000, le=2100)

    order_ratio: Optional[str] = Field(default=None, max_length=30)

    shipment_value_usd: Optional[Decimal] = Field(default=None, ge=0)
    price_per_kg_usd: Optional[Decimal] = Field(default=None, ge=0)
    amount_paid_usd: Optional[Decimal] = Field(default=None, ge=0)
    balance_usd: Optional[Decimal] = Field(default=None, ge=0)

    container_gate_in: Optional[date] = None
    departure_date: Optional[date] = None
    jurisdiction: Optional[str] = Field(default=None, max_length=100)

    items_json: Optional[List[OrderItemInput]] = None

    slaughter_schedule: Optional[date] = None
    expected_delivery: Optional[date] = None
    is_delivery_date_manual: Optional[bool] = None
    delivery_days_offset: Optional[int] = Field(default=None, ge=0, le=365)

    notes: Optional[str] = None

    @field_validator("enterprise_name")
    @classmethod
    def validate_enterprise_name(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        value = value.strip()
        if not value:
            raise ValueError("Enterprise name cannot be empty")
        return value

    @field_validator("order_type")
    @classmethod
    def validate_order_type(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        return normalize_order_type(value)

    @field_validator("order_profile")
    @classmethod
    def validate_order_profile(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        return normalize_order_profile(value)

    @field_validator("order_subtype")
    @classmethod
    def validate_order_subtype(cls, value: Optional[str]) -> Optional[str]:
        value = normalize_text(value)
        return normalize_slug(value) if value else None

    @field_validator("status")
    @classmethod
    def validate_status(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        return normalize_order_status(value)

    @field_validator("order_ratio")
    @classmethod
    def validate_order_ratio(cls, value: Optional[str]) -> Optional[str]:
        return normalize_text(value)

    @field_validator("jurisdiction")
    @classmethod
    def validate_jurisdiction(cls, value: Optional[str]) -> Optional[str]:
        return normalize_text(value)

    @field_validator("notes")
    @classmethod
    def validate_notes(cls, value: Optional[str]) -> Optional[str]:
        return normalize_text(value)

    @field_validator("shipment_value_usd")
    @classmethod
    def validate_shipment_value_usd(cls, value: Optional[Decimal]) -> Optional[Decimal]:
        return parse_decimal(value, "shipment_value_usd", "0.01")

    @field_validator("price_per_kg_usd")
    @classmethod
    def validate_price_per_kg_usd(cls, value: Optional[Decimal]) -> Optional[Decimal]:
        return parse_decimal(value, "price_per_kg_usd", "0.0001")

    @field_validator("amount_paid_usd")
    @classmethod
    def validate_amount_paid_usd(cls, value: Optional[Decimal]) -> Optional[Decimal]:
        return parse_decimal(value, "amount_paid_usd", "0.01")

    @field_validator("balance_usd")
    @classmethod
    def validate_balance_usd(cls, value: Optional[Decimal]) -> Optional[Decimal]:
        return parse_decimal(value, "balance_usd", "0.01")

    @field_validator("items_json")
    @classmethod
    def validate_items_json(cls, value: Optional[List[OrderItemInput]]) -> Optional[List[OrderItemInput]]:
        if value is not None and len(value) == 0:
            raise ValueError("items_json cannot be empty")
        return value

    @model_validator(mode="after")
    def validate_delivery_fields(self):
        if self.is_delivery_date_manual is True and self.expected_delivery is None:
            raise ValueError(
                "expected_delivery is required when is_delivery_date_manual is true"
            )

        if (self.report_month is None) ^ (self.report_year is None):
            raise ValueError("report_month and report_year must be provided together")

        if self.order_profile == "frozen_container" and self.order_type not in (None, "frozen"):
            raise ValueError("Frozen container orders must use order_type='frozen'")

        return self


class OrderStatusUpdateSchema(BaseModel):
    status: str = Field(..., min_length=3, max_length=30)

    @field_validator("status")
    @classmethod
    def validate_status(cls, value: str) -> str:
        return normalize_order_status(value)


class OrderDeliveryUpdateSchema(BaseModel):
    slaughter_schedule: Optional[date] = None
    expected_delivery: Optional[date] = None
    is_delivery_date_manual: bool = False
    delivery_days_offset: Optional[int] = Field(default=None, ge=0, le=365)

    @model_validator(mode="after")
    def validate_delivery_update(self):
        if self.is_delivery_date_manual and self.expected_delivery is None:
            raise ValueError(
                "expected_delivery is required when is_delivery_date_manual is true"
            )
        return self


class OrderFinancialUpdateSchema(BaseModel):
    shipment_value_usd: Optional[Decimal] = Field(default=None, ge=0)
    price_per_kg_usd: Optional[Decimal] = Field(default=None, ge=0)
    amount_paid_usd: Optional[Decimal] = Field(default=None, ge=0)
    balance_usd: Optional[Decimal] = Field(default=None, ge=0)

    @field_validator("shipment_value_usd")
    @classmethod
    def validate_shipment_value_usd(cls, value: Optional[Decimal]) -> Optional[Decimal]:
        return parse_decimal(value, "shipment_value_usd", "0.01")

    @field_validator("price_per_kg_usd")
    @classmethod
    def validate_price_per_kg_usd(cls, value: Optional[Decimal]) -> Optional[Decimal]:
        return parse_decimal(value, "price_per_kg_usd", "0.0001")

    @field_validator("amount_paid_usd")
    @classmethod
    def validate_amount_paid_usd(cls, value: Optional[Decimal]) -> Optional[Decimal]:
        return parse_decimal(value, "amount_paid_usd", "0.01")

    @field_validator("balance_usd")
    @classmethod
    def validate_balance_usd(cls, value: Optional[Decimal]) -> Optional[Decimal]:
        return parse_decimal(value, "balance_usd", "0.01")


class OrderFilterSchema(BaseModel):
    search: Optional[str] = None

    order_type: Optional[str] = None
    order_profile: Optional[str] = None
    order_subtype: Optional[str] = None
    status: Optional[str] = None

    report_month: Optional[int] = Field(default=None, ge=1, le=12)
    report_year: Optional[int] = Field(default=None, ge=2000, le=2100)

    jurisdiction: Optional[str] = None

    slaughter_date_from: Optional[date] = None
    slaughter_date_to: Optional[date] = None
    delivery_date_from: Optional[date] = None
    delivery_date_to: Optional[date] = None
    container_gate_in_from: Optional[date] = None
    container_gate_in_to: Optional[date] = None
    departure_date_from: Optional[date] = None
    departure_date_to: Optional[date] = None

    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=10, ge=1, le=100)

    @field_validator("search")
    @classmethod
    def validate_search(cls, value: Optional[str]) -> Optional[str]:
        return normalize_text(value)

    @field_validator("order_type")
    @classmethod
    def validate_order_type(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        return normalize_order_type(value)

    @field_validator("order_profile")
    @classmethod
    def validate_order_profile(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        return normalize_order_profile(value)

    @field_validator("order_subtype")
    @classmethod
    def validate_order_subtype(cls, value: Optional[str]) -> Optional[str]:
        value = normalize_text(value)
        return normalize_slug(value) if value else None

    @field_validator("status")
    @classmethod
    def validate_status(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        return normalize_order_status(value)

    @field_validator("jurisdiction")
    @classmethod
    def validate_jurisdiction(cls, value: Optional[str]) -> Optional[str]:
        return normalize_text(value)

    @model_validator(mode="after")
    def validate_ranges(self):
        if (self.report_month is None) ^ (self.report_year is None):
            raise ValueError("report_month and report_year must be provided together")

        if (
            self.slaughter_date_from
            and self.slaughter_date_to
            and self.slaughter_date_from > self.slaughter_date_to
        ):
            raise ValueError("slaughter_date_from cannot be after slaughter_date_to")

        if (
            self.delivery_date_from
            and self.delivery_date_to
            and self.delivery_date_from > self.delivery_date_to
        ):
            raise ValueError("delivery_date_from cannot be after delivery_date_to")

        if (
            self.container_gate_in_from
            and self.container_gate_in_to
            and self.container_gate_in_from > self.container_gate_in_to
        ):
            raise ValueError("container_gate_in_from cannot be after container_gate_in_to")

        if (
            self.departure_date_from
            and self.departure_date_to
            and self.departure_date_from > self.departure_date_to
        ):
            raise ValueError("departure_date_from cannot be after departure_date_to")

        return self


class OrderExportQuerySchema(BaseModel):
    month: int = Field(..., ge=1, le=12)
    year: int = Field(..., ge=2000, le=2100)

    order_type: Optional[str] = None
    order_profile: Optional[str] = None
    status: Optional[str] = None
    jurisdiction: Optional[str] = None

    format: str = Field(..., pattern="^(csv|pdf|docx)$")

    @field_validator("order_type")
    @classmethod
    def validate_order_type(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        return normalize_order_type(value)

    @field_validator("order_profile")
    @classmethod
    def validate_order_profile(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        return normalize_order_profile(value)

    @field_validator("status")
    @classmethod
    def validate_status(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        return normalize_order_status(value)

    @field_validator("jurisdiction")
    @classmethod
    def validate_jurisdiction(cls, value: Optional[str]) -> Optional[str]:
        return normalize_text(value)

    @field_validator("format")
    @classmethod
    def validate_format(cls, value: str) -> str:
        value = (value or "").strip().lower()
        if value not in {"csv", "pdf", "docx"}:
            raise ValueError("format must be csv, pdf, or docx")
        return value


class OrderResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    order_number: str
    enterprise_name: str

    order_type: str
    order_profile: str
    order_subtype: Optional[str] = None

    status: str

    report_month: Optional[int] = None
    report_year: Optional[int] = None

    order_ratio: Optional[str] = None
    shipment_value_usd: Optional[Decimal] = None
    price_per_kg_usd: Optional[Decimal] = None
    amount_paid_usd: Optional[Decimal] = None
    balance_usd: Optional[Decimal] = None

    container_gate_in: Optional[date] = None
    departure_date: Optional[date] = None
    jurisdiction: Optional[str] = None

    product_summary: Optional[str] = None
    items_json: List[OrderItemResponse]

    total_quantity_kg: Decimal
    total_pieces_required: int
    total_animals_required: int

    goat_quantity_kg: Decimal
    goat_pieces_required: int
    goats_required: int

    sheep_quantity_kg: Decimal
    sheep_pieces_required: int
    sheep_required: int

    cattle_quantity_kg: Decimal
    cattle_pieces_required: int
    cattle_required: int

    slaughter_schedule: Optional[date] = None
    expected_delivery: Optional[date] = None
    is_delivery_date_manual: bool
    delivery_days_offset: Optional[int] = None
    notes: Optional[str] = None

    created_by_id: Optional[int] = None
    updated_by_id: Optional[int] = None
    created_by: Optional[UserMiniResponse] = None
    updated_by: Optional[UserMiniResponse] = None

    created_at: datetime
    updated_at: datetime


class OrderListResponse(BaseModel):
    items: List[OrderResponse]
    total: int
    page: int = 1
    page_size: int = 10


class MonthlyOrderSummaryRow(BaseModel):
    order_type: str
    total_orders: int
    total_quantity_kg: Decimal
    total_pieces_required: int
    total_animals_required: int


class MonthlyOrderSummaryResponse(BaseModel):
    month: int
    year: int

    total_orders: int
    total_quantity_kg: Decimal
    total_pieces_required: int
    total_animals_required: int

    breakeven_quantity_kg: Optional[Decimal] = None
    breakeven_achieved_quantity_kg: Optional[Decimal] = None
    breakeven_balance_quantity_kg: Optional[Decimal] = None
    breakeven_achieved_percentage: Optional[Decimal] = None
    breakeven_balance_percentage: Optional[Decimal] = None

    local_orders: MonthlyOrderSummaryRow
    chilled_orders: MonthlyOrderSummaryRow
    frozen_orders: MonthlyOrderSummaryRow


class MessageResponse(BaseModel):
    message: str