from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from typing import List, Optional

from pydantic import BaseModel, Field, field_validator, model_validator


VALID_REPORT_FORMATS = {"csv", "pdf", "docx"}
VALID_REPORT_TYPES = {"orders_monthly", "frozen_containers_monthly"}

VALID_ORDER_TYPES = {"local", "chilled", "frozen"}
VALID_ORDER_PROFILES = {"standard_order", "frozen_container"}
VALID_ORDER_STATUSES = {
    "draft",
    "confirmed",
    "in_progress",
    "completed",
    "cancelled",
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


def normalize_report_format(value: str) -> str:
    value = (value or "").strip().lower()
    if value not in VALID_REPORT_FORMATS:
        raise ValueError("Invalid report format. Use csv, pdf, or docx.")
    return value


def normalize_report_type(value: str) -> str:
    value = normalize_slug(value)
    if value not in VALID_REPORT_TYPES:
        raise ValueError(
            "Invalid report type. Supported values are orders_monthly and frozen_containers_monthly."
        )
    return value


def normalize_order_type(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    value = normalize_slug(value)
    if value not in VALID_ORDER_TYPES:
        raise ValueError("Invalid order type. Use local, chilled, or frozen.")
    return value


def normalize_order_profile(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    value = normalize_slug(value)
    if value not in VALID_ORDER_PROFILES:
        raise ValueError("Invalid order profile. Use standard_order or frozen_container.")
    return value


def normalize_order_status(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    value = normalize_slug(value)
    if value not in VALID_ORDER_STATUSES:
        raise ValueError(
            "Invalid status. Use draft, confirmed, in_progress, completed, or cancelled."
        )
    return value


def parse_decimal(
    value,
    field_name: str,
    places: str = "0.01",
) -> Optional[Decimal]:
    if value in (None, "", "null"):
        return None

    try:
        number = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        raise ValueError(f"{field_name} must be a valid number")

    if number < 0:
        raise ValueError(f"{field_name} cannot be negative")

    return number.quantize(Decimal(places))


class ReportRequestBase(BaseModel):
    report_type: str = Field(..., max_length=100)
    format: str = Field(..., max_length=10)
    prepared_by: Optional[str] = Field(default=None, max_length=150)

    @field_validator("report_type")
    @classmethod
    def validate_report_type(cls, value: str) -> str:
        return normalize_report_type(value)

    @field_validator("format")
    @classmethod
    def validate_format(cls, value: str) -> str:
        return normalize_report_format(value)

    @field_validator("prepared_by")
    @classmethod
    def validate_prepared_by(cls, value: Optional[str]) -> Optional[str]:
        return normalize_text(value)


class OrdersMonthlyReportRequest(ReportRequestBase):
    report_type: str = Field(default="orders_monthly", max_length=100)
    month: int = Field(..., ge=1, le=12)
    year: int = Field(..., ge=2000, le=2100)

    order_type: Optional[str] = Field(default=None, max_length=30)
    order_profile: Optional[str] = Field(default=None, max_length=30)
    order_subtype: Optional[str] = Field(default=None, max_length=50)
    status: Optional[str] = Field(default=None, max_length=30)
    enterprise_name: Optional[str] = Field(default=None, max_length=200)
    jurisdiction: Optional[str] = Field(default=None, max_length=100)

    breakeven_quantity_kg: Optional[Decimal] = Field(default=None, ge=0)

    include_summary: bool = True
    include_sections: bool = True
    include_totals: bool = True
    include_animal_projection: bool = True
    include_financial_summary: bool = True

    @field_validator("order_type")
    @classmethod
    def validate_order_type(cls, value: Optional[str]) -> Optional[str]:
        return normalize_order_type(value)

    @field_validator("order_profile")
    @classmethod
    def validate_order_profile(cls, value: Optional[str]) -> Optional[str]:
        return normalize_order_profile(value)

    @field_validator("order_subtype")
    @classmethod
    def validate_order_subtype(cls, value: Optional[str]) -> Optional[str]:
        value = normalize_text(value)
        return normalize_slug(value) if value else None

    @field_validator("status")
    @classmethod
    def validate_status(cls, value: Optional[str]) -> Optional[str]:
        return normalize_order_status(value)

    @field_validator("enterprise_name")
    @classmethod
    def validate_enterprise_name(cls, value: Optional[str]) -> Optional[str]:
        return normalize_text(value)

    @field_validator("jurisdiction")
    @classmethod
    def validate_jurisdiction(cls, value: Optional[str]) -> Optional[str]:
        return normalize_text(value)

    @field_validator("breakeven_quantity_kg")
    @classmethod
    def validate_breakeven_quantity_kg(cls, value: Optional[Decimal]) -> Optional[Decimal]:
        return parse_decimal(value, "breakeven_quantity_kg", "0.01")


class FrozenContainersMonthlyReportRequest(ReportRequestBase):
    report_type: str = Field(default="frozen_containers_monthly", max_length=100)
    month: int = Field(..., ge=1, le=12)
    year: int = Field(..., ge=2000, le=2100)

    status: Optional[str] = Field(default=None, max_length=30)
    enterprise_name: Optional[str] = Field(default=None, max_length=200)
    jurisdiction: Optional[str] = Field(default=None, max_length=100)

    include_summary: bool = True
    include_rows: bool = True
    include_totals: bool = True

    @field_validator("status")
    @classmethod
    def validate_status(cls, value: Optional[str]) -> Optional[str]:
        return normalize_order_status(value)

    @field_validator("enterprise_name")
    @classmethod
    def validate_enterprise_name(cls, value: Optional[str]) -> Optional[str]:
        return normalize_text(value)

    @field_validator("jurisdiction")
    @classmethod
    def validate_jurisdiction(cls, value: Optional[str]) -> Optional[str]:
        return normalize_text(value)


class ReportFileMeta(BaseModel):
    filename: str
    media_type: str
    format: str
    generated_at: datetime

    @field_validator("format")
    @classmethod
    def validate_format(cls, value: str) -> str:
        return normalize_report_format(value)


class ReportSummaryItem(BaseModel):
    key: str = Field(..., max_length=100)
    label: str = Field(..., max_length=200)
    value: str = Field(..., max_length=200)
    unit: Optional[str] = Field(default=None, max_length=50)

    @field_validator("key", "label", "value", "unit")
    @classmethod
    def normalize_string_fields(cls, value: Optional[str]) -> Optional[str]:
        return normalize_text(value)


class OrdersMonthlySummary(BaseModel):
    total_orders: int = 0
    total_quantity_kg: Decimal = Decimal("0.00")
    total_pieces_required: int = 0
    total_animals_required: int = 0

    total_shipment_value_usd: Decimal = Decimal("0.00")
    total_amount_paid_usd: Decimal = Decimal("0.00")
    total_balance_usd: Decimal = Decimal("0.00")

    breakeven_quantity_kg: Optional[Decimal] = None
    breakeven_achieved_quantity_kg: Optional[Decimal] = None
    breakeven_balance_quantity_kg: Optional[Decimal] = None
    breakeven_achieved_percentage: Optional[Decimal] = None
    breakeven_balance_percentage: Optional[Decimal] = None

    local_total_orders: int = 0
    local_total_quantity_kg: Decimal = Decimal("0.00")
    local_total_pieces_required: int = 0
    local_total_animals_required: int = 0

    chilled_total_orders: int = 0
    chilled_total_quantity_kg: Decimal = Decimal("0.00")
    chilled_total_pieces_required: int = 0
    chilled_total_animals_required: int = 0

    frozen_total_orders: int = 0
    frozen_total_quantity_kg: Decimal = Decimal("0.00")
    frozen_total_pieces_required: int = 0
    frozen_total_animals_required: int = 0


class OrdersReportRow(BaseModel):
    serial_no: int
    order_id: int
    order_number: str = Field(..., max_length=100)
    enterprise_name: str = Field(..., max_length=200)

    order_type: str = Field(..., max_length=30)
    order_profile: str = Field(default="standard_order", max_length=30)
    order_subtype: Optional[str] = Field(default=None, max_length=50)
    status: str = Field(..., max_length=30)

    order_ratio: Optional[str] = None
    jurisdiction: Optional[str] = None

    product_summary: Optional[str] = None
    total_quantity_kg: Decimal = Decimal("0.00")
    total_pieces_required: int = 0
    total_animals_required: int = 0

    goat_quantity_kg: Decimal = Decimal("0.00")
    goat_pieces_required: int = 0
    goats_required: int = 0

    sheep_quantity_kg: Decimal = Decimal("0.00")
    sheep_pieces_required: int = 0
    sheep_required: int = 0

    cattle_quantity_kg: Decimal = Decimal("0.00")
    cattle_pieces_required: int = 0
    cattle_required: int = 0

    shipment_value_usd: Optional[Decimal] = None
    price_per_kg_usd: Optional[Decimal] = None
    amount_paid_usd: Optional[Decimal] = None
    balance_usd: Optional[Decimal] = None

    slaughter_schedule: Optional[date] = None
    expected_delivery: Optional[date] = None
    container_gate_in: Optional[date] = None
    departure_date: Optional[date] = None

    notes: Optional[str] = None

    @field_validator("order_type")
    @classmethod
    def validate_order_type(cls, value: str) -> str:
        normalized = normalize_order_type(value)
        if normalized is None:
            raise ValueError("order_type is required")
        return normalized

    @field_validator("order_profile")
    @classmethod
    def validate_order_profile(cls, value: str) -> str:
        normalized = normalize_order_profile(value)
        if normalized is None:
            raise ValueError("order_profile is required")
        return normalized

    @field_validator("order_subtype")
    @classmethod
    def validate_order_subtype(cls, value: Optional[str]) -> Optional[str]:
        value = normalize_text(value)
        return normalize_slug(value) if value else None

    @field_validator("status")
    @classmethod
    def validate_status(cls, value: str) -> str:
        normalized = normalize_order_status(value)
        if normalized is None:
            raise ValueError("status is required")
        return normalized

    @field_validator("order_ratio", "jurisdiction", "product_summary", "notes")
    @classmethod
    def validate_text_fields(cls, value: Optional[str]) -> Optional[str]:
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


class OrdersReportSection(BaseModel):
    section_key: str = Field(..., max_length=50)
    section_title: str = Field(..., max_length=150)
    total_orders: int = 0
    total_quantity_kg: Decimal = Decimal("0.00")
    total_pieces_required: int = 0
    total_animals_required: int = 0
    total_shipment_value_usd: Decimal = Decimal("0.00")
    total_amount_paid_usd: Decimal = Decimal("0.00")
    total_balance_usd: Decimal = Decimal("0.00")
    rows: List[OrdersReportRow] = Field(default_factory=list)

    @field_validator("section_key")
    @classmethod
    def validate_section_key(cls, value: str) -> str:
        value = normalize_slug(value)
        if value not in VALID_ORDER_TYPES:
            raise ValueError("section_key must be local, chilled, or frozen")
        return value

    @field_validator("section_title")
    @classmethod
    def validate_section_title(cls, value: str) -> str:
        value = (value or "").strip()
        if not value:
            raise ValueError("section_title is required")
        return value


class AnimalProjectionRow(BaseModel):
    label: str = Field(..., max_length=100)
    goats: int = 0
    sheep: int = 0
    cattle: int = 0
    total_animals: int = 0

    @field_validator("label")
    @classmethod
    def validate_label(cls, value: str) -> str:
        value = (value or "").strip()
        if not value:
            raise ValueError("Projection row label is required")
        return value

    @model_validator(mode="after")
    def compute_total_animals(self):
        self.total_animals = int(self.goats or 0) + int(self.sheep or 0) + int(self.cattle or 0)
        return self


class AnimalProjectionBlock(BaseModel):
    title: str = Field(default="ANIMAL REQUIREMENTS PROJECTION")
    rows: List[AnimalProjectionRow] = Field(default_factory=list)
    total_goats: int = 0
    total_sheep: int = 0
    total_cattle: int = 0
    grand_total_animals: int = 0

    @field_validator("title")
    @classmethod
    def validate_title(cls, value: str) -> str:
        value = (value or "").strip()
        if not value:
            raise ValueError("Projection title is required")
        return value

    @model_validator(mode="after")
    def compute_totals(self):
        self.total_goats = sum(int(row.goats or 0) for row in self.rows)
        self.total_sheep = sum(int(row.sheep or 0) for row in self.rows)
        self.total_cattle = sum(int(row.cattle or 0) for row in self.rows)
        self.grand_total_animals = self.total_goats + self.total_sheep + self.total_cattle
        return self


class OrdersMonthlyTotals(BaseModel):
    total_orders: int = 0
    total_quantity_kg: Decimal = Decimal("0.00")
    total_pieces_required: int = 0
    total_animals_required: int = 0
    total_shipment_value_usd: Decimal = Decimal("0.00")
    total_amount_paid_usd: Decimal = Decimal("0.00")
    total_balance_usd: Decimal = Decimal("0.00")


class FrozenContainersMonthlySummary(BaseModel):
    total_orders: int = 0
    total_quantity_kg: Decimal = Decimal("0.00")
    total_pieces_required: int = 0

    total_container_value_usd: Decimal = Decimal("0.00")
    total_down_payment_usd: Decimal = Decimal("0.00")
    total_balance_usd: Decimal = Decimal("0.00")

    average_price_per_kg_usd: Optional[Decimal] = None


class FrozenContainersReportRow(BaseModel):
    serial_no: int
    order_id: int
    order_number: str = Field(..., max_length=100)

    client_name: str = Field(..., max_length=200)
    order_ratio: Optional[str] = Field(default=None, max_length=30)
    status: str = Field(..., max_length=30)

    container_value_usd: Optional[Decimal] = None
    price_per_kg_usd: Optional[Decimal] = None
    down_payment_usd: Optional[Decimal] = None
    balance_usd: Optional[Decimal] = None

    container_gate_in: Optional[date] = None
    departure_date: Optional[date] = None
    jurisdiction: Optional[str] = Field(default=None, max_length=100)

    total_quantity_kg: Decimal = Decimal("0.00")
    total_pieces_required: int = 0

    @field_validator("client_name")
    @classmethod
    def validate_client_name(cls, value: str) -> str:
        value = (value or "").strip()
        if not value:
            raise ValueError("client_name is required")
        return value

    @field_validator("order_ratio")
    @classmethod
    def validate_order_ratio(cls, value: Optional[str]) -> Optional[str]:
        return normalize_text(value)

    @field_validator("status")
    @classmethod
    def validate_status(cls, value: str) -> str:
        normalized = normalize_order_status(value)
        if normalized is None:
            raise ValueError("status is required")
        return normalized

    @field_validator("jurisdiction")
    @classmethod
    def validate_jurisdiction(cls, value: Optional[str]) -> Optional[str]:
        return normalize_text(value)

    @field_validator("container_value_usd")
    @classmethod
    def validate_container_value_usd(cls, value: Optional[Decimal]) -> Optional[Decimal]:
        return parse_decimal(value, "container_value_usd", "0.01")

    @field_validator("price_per_kg_usd")
    @classmethod
    def validate_price_per_kg_usd(cls, value: Optional[Decimal]) -> Optional[Decimal]:
        return parse_decimal(value, "price_per_kg_usd", "0.0001")

    @field_validator("down_payment_usd")
    @classmethod
    def validate_down_payment_usd(cls, value: Optional[Decimal]) -> Optional[Decimal]:
        return parse_decimal(value, "down_payment_usd", "0.01")

    @field_validator("balance_usd")
    @classmethod
    def validate_balance_usd(cls, value: Optional[Decimal]) -> Optional[Decimal]:
        return parse_decimal(value, "balance_usd", "0.01")


class FrozenContainersMonthlyTotals(BaseModel):
    total_orders: int = 0
    total_quantity_kg: Decimal = Decimal("0.00")
    total_pieces_required: int = 0
    total_container_value_usd: Decimal = Decimal("0.00")
    total_down_payment_usd: Decimal = Decimal("0.00")
    total_balance_usd: Decimal = Decimal("0.00")


class OrdersMonthlyReportData(BaseModel):
    report_type: str = Field(default="orders_monthly", max_length=100)
    title: str = Field(default="Order Confirmation Report", max_length=200)
    subtitle: Optional[str] = Field(default=None, max_length=300)
    organization_name: Optional[str] = Field(default=None, max_length=200)
    prepared_by: Optional[str] = Field(default=None, max_length=150)
    generated_at: datetime

    month: int = Field(..., ge=1, le=12)
    year: int = Field(..., ge=2000, le=2100)

    filters_order_type: Optional[str] = Field(default=None, max_length=30)
    filters_order_profile: Optional[str] = Field(default=None, max_length=30)
    filters_order_subtype: Optional[str] = Field(default=None, max_length=50)
    filters_status: Optional[str] = Field(default=None, max_length=30)
    filters_enterprise_name: Optional[str] = Field(default=None, max_length=200)
    filters_jurisdiction: Optional[str] = Field(default=None, max_length=100)

    summary: Optional[OrdersMonthlySummary] = None
    sections: List[OrdersReportSection] = Field(default_factory=list)
    totals: Optional[OrdersMonthlyTotals] = None
    animal_projection: Optional[AnimalProjectionBlock] = None

    @field_validator("report_type")
    @classmethod
    def validate_report_type(cls, value: str) -> str:
        return normalize_report_type(value)

    @field_validator(
        "title",
        "subtitle",
        "organization_name",
        "prepared_by",
        "filters_enterprise_name",
        "filters_jurisdiction",
    )
    @classmethod
    def validate_text_fields(cls, value: Optional[str]) -> Optional[str]:
        return normalize_text(value)

    @field_validator("filters_order_type")
    @classmethod
    def validate_filters_order_type(cls, value: Optional[str]) -> Optional[str]:
        return normalize_order_type(value)

    @field_validator("filters_order_profile")
    @classmethod
    def validate_filters_order_profile(cls, value: Optional[str]) -> Optional[str]:
        return normalize_order_profile(value)

    @field_validator("filters_order_subtype")
    @classmethod
    def validate_filters_order_subtype(cls, value: Optional[str]) -> Optional[str]:
        value = normalize_text(value)
        return normalize_slug(value) if value else None

    @field_validator("filters_status")
    @classmethod
    def validate_filters_status(cls, value: Optional[str]) -> Optional[str]:
        return normalize_order_status(value)


class FrozenContainersMonthlyReportData(BaseModel):
    report_type: str = Field(default="frozen_containers_monthly", max_length=100)
    title: str = Field(default="Frozen Confirmed Orders", max_length=200)
    subtitle: Optional[str] = Field(default=None, max_length=300)
    organization_name: Optional[str] = Field(default=None, max_length=200)
    prepared_by: Optional[str] = Field(default=None, max_length=150)
    generated_at: datetime

    month: int = Field(..., ge=1, le=12)
    year: int = Field(..., ge=2000, le=2100)

    filters_status: Optional[str] = Field(default=None, max_length=30)
    filters_enterprise_name: Optional[str] = Field(default=None, max_length=200)
    filters_jurisdiction: Optional[str] = Field(default=None, max_length=100)

    summary: Optional[FrozenContainersMonthlySummary] = None
    rows: List[FrozenContainersReportRow] = Field(default_factory=list)
    totals: Optional[FrozenContainersMonthlyTotals] = None

    @field_validator("report_type")
    @classmethod
    def validate_report_type(cls, value: str) -> str:
        return normalize_report_type(value)

    @field_validator(
        "title",
        "subtitle",
        "organization_name",
        "prepared_by",
        "filters_enterprise_name",
        "filters_jurisdiction",
    )
    @classmethod
    def validate_text_fields(cls, value: Optional[str]) -> Optional[str]:
        return normalize_text(value)

    @field_validator("filters_status")
    @classmethod
    def validate_filters_status(cls, value: Optional[str]) -> Optional[str]:
        return normalize_order_status(value)


class ReportGenerationResponse(BaseModel):
    success: bool = True
    message: str
    file_meta: ReportFileMeta


class MessageResponse(BaseModel):
    message: str