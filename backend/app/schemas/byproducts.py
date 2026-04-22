from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.models.byproducts import (
    ByproductCustomerType,
    ByproductPaymentMode,
    ByproductSaleStatus,
    ByproductTemplateFormat,
    ByproductTemplateStorageBackend,
    ByproductTemplateType,
    ByproductUnit,
)


# =============================================================================
# HELPERS
# =============================================================================


def _clean_text(value: str | None) -> str | None:
    if value is None:
        return None
    value = value.strip()
    return value or None


def _clean_upper_text(value: str | None) -> str | None:
    value = _clean_text(value)
    return value.upper() if value else None


def _clean_path_text(value: str | None) -> str | None:
    value = _clean_text(value)
    if value is None:
        return None
    return value.replace("\\", "/")


def _clean_url_text(value: str | None) -> str | None:
    return _clean_text(value)


# =============================================================================
# BASE SCHEMA
# =============================================================================


class AppSchema(BaseModel):
    model_config = ConfigDict(
        from_attributes=True,
        extra="forbid",
        populate_by_name=True,
    )


# =============================================================================
# COMMON / SHARED
# =============================================================================


class AuditReadMixin(AppSchema):
    id: UUID
    is_active: bool
    is_deleted: bool

    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None

    created_by_id: int | None = None
    updated_by_id: int | None = None
    deleted_by_id: int | None = None


class MessageResponse(AppSchema):
    message: str


class SoftDeleteRequest(AppSchema):
    reason: str | None = Field(default=None, max_length=500)

    @field_validator("reason")
    @classmethod
    def validate_reason(cls, value: str | None) -> str | None:
        return _clean_text(value)


class DateRangeFilter(AppSchema):
    date_from: date
    date_to: date

    @model_validator(mode="after")
    def validate_date_range(self) -> "DateRangeFilter":
        if self.date_to < self.date_from:
            raise ValueError("date_to cannot be earlier than date_from")
        return self


# =============================================================================
# CATEGORY SCHEMAS
# =============================================================================


class ByproductCategoryBase(AppSchema):
    code: str = Field(..., min_length=1, max_length=50)
    name: str = Field(..., min_length=1, max_length=150)
    description: str | None = Field(default=None, max_length=2000)
    sort_order: int = Field(default=0, ge=0)
    is_active: bool = True

    @field_validator("code")
    @classmethod
    def validate_code(cls, value: str) -> str:
        cleaned = _clean_upper_text(value)
        if not cleaned:
            raise ValueError("code is required")
        return cleaned

    @field_validator("name", "description")
    @classmethod
    def validate_text_fields(cls, value: str | None) -> str | None:
        return _clean_text(value)


class ByproductCategoryCreate(ByproductCategoryBase):
    pass


class ByproductCategoryUpdate(AppSchema):
    code: str | None = Field(default=None, min_length=1, max_length=50)
    name: str | None = Field(default=None, min_length=1, max_length=150)
    description: str | None = Field(default=None, max_length=2000)
    sort_order: int | None = Field(default=None, ge=0)
    is_active: bool | None = None

    @field_validator("code")
    @classmethod
    def validate_code(cls, value: str | None) -> str | None:
        return _clean_upper_text(value)

    @field_validator("name", "description")
    @classmethod
    def validate_text_fields(cls, value: str | None) -> str | None:
        return _clean_text(value)


class ByproductCategoryRead(AuditReadMixin):
    code: str
    name: str
    description: str | None = None
    sort_order: int


class ByproductCategoryListResponse(AppSchema):
    items: list[ByproductCategoryRead] = Field(default_factory=list)
    total: int


class ByproductCategoryFilter(AppSchema):
    search: str | None = None
    is_active: bool | None = None
    include_deleted: bool = False

    @field_validator("search")
    @classmethod
    def validate_search(cls, value: str | None) -> str | None:
        return _clean_text(value)


# =============================================================================
# BYPRODUCT ITEM SCHEMAS
# =============================================================================


class ByproductItemBase(AppSchema):
    category_id: UUID | None = None
    code: str = Field(..., min_length=1, max_length=50)
    name: str = Field(..., min_length=1, max_length=180)
    short_name: str | None = Field(default=None, max_length=100)
    description: str | None = Field(default=None, max_length=3000)

    unit_of_measure: ByproductUnit = ByproductUnit.PIECE
    allow_fractional_quantity: bool = False

    default_unit_price: Decimal = Field(default=Decimal("0.00"), ge=0)
    minimum_unit_price: Decimal | None = Field(default=None, ge=0)
    maximum_unit_price: Decimal | None = Field(default=None, ge=0)

    report_label: str | None = Field(default=None, max_length=180)
    notes: str | None = Field(default=None, max_length=3000)
    is_active: bool = True

    @field_validator("code")
    @classmethod
    def validate_code(cls, value: str) -> str:
        cleaned = _clean_upper_text(value)
        if not cleaned:
            raise ValueError("code is required")
        return cleaned

    @field_validator("name", "short_name", "description", "report_label", "notes")
    @classmethod
    def validate_text_fields(cls, value: str | None) -> str | None:
        return _clean_text(value)

    @model_validator(mode="after")
    def validate_price_range(self) -> "ByproductItemBase":
        if (
            self.minimum_unit_price is not None
            and self.maximum_unit_price is not None
            and self.maximum_unit_price < self.minimum_unit_price
        ):
            raise ValueError("maximum_unit_price cannot be less than minimum_unit_price")

        if (
            self.minimum_unit_price is not None
            and self.default_unit_price < self.minimum_unit_price
        ):
            raise ValueError("default_unit_price cannot be less than minimum_unit_price")

        if (
            self.maximum_unit_price is not None
            and self.default_unit_price > self.maximum_unit_price
        ):
            raise ValueError("default_unit_price cannot be greater than maximum_unit_price")

        return self


class ByproductItemCreate(ByproductItemBase):
    pass


class ByproductItemUpdate(AppSchema):
    category_id: UUID | None = None
    code: str | None = Field(default=None, min_length=1, max_length=50)
    name: str | None = Field(default=None, min_length=1, max_length=180)
    short_name: str | None = Field(default=None, max_length=100)
    description: str | None = Field(default=None, max_length=3000)

    unit_of_measure: ByproductUnit | None = None
    allow_fractional_quantity: bool | None = None

    default_unit_price: Decimal | None = Field(default=None, ge=0)
    minimum_unit_price: Decimal | None = Field(default=None, ge=0)
    maximum_unit_price: Decimal | None = Field(default=None, ge=0)

    report_label: str | None = Field(default=None, max_length=180)
    notes: str | None = Field(default=None, max_length=3000)
    is_active: bool | None = None

    @field_validator("code")
    @classmethod
    def validate_code(cls, value: str | None) -> str | None:
        return _clean_upper_text(value)

    @field_validator("name", "short_name", "description", "report_label", "notes")
    @classmethod
    def validate_text_fields(cls, value: str | None) -> str | None:
        return _clean_text(value)

    @model_validator(mode="after")
    def validate_price_range(self) -> "ByproductItemUpdate":
        if (
            self.minimum_unit_price is not None
            and self.maximum_unit_price is not None
            and self.maximum_unit_price < self.minimum_unit_price
        ):
            raise ValueError("maximum_unit_price cannot be less than minimum_unit_price")
        return self


class ByproductItemRead(AuditReadMixin):
    category_id: UUID | None = None
    code: str
    name: str
    short_name: str | None = None
    description: str | None = None

    unit_of_measure: ByproductUnit
    allow_fractional_quantity: bool

    default_unit_price: Decimal
    minimum_unit_price: Decimal | None = None
    maximum_unit_price: Decimal | None = None

    report_label: str | None = None
    notes: str | None = None


class ByproductItemListResponse(AppSchema):
    items: list[ByproductItemRead] = Field(default_factory=list)
    total: int


class ByproductItemFilter(AppSchema):
    search: str | None = None
    category_id: UUID | None = None
    unit_of_measure: ByproductUnit | None = None
    is_active: bool | None = None
    include_deleted: bool = False

    @field_validator("search")
    @classmethod
    def validate_search(cls, value: str | None) -> str | None:
        return _clean_text(value)


# =============================================================================
# CUSTOMER SCHEMAS
# =============================================================================


class ByproductCustomerBase(AppSchema):
    customer_code: str = Field(..., min_length=1, max_length=50)
    customer_name: str = Field(..., min_length=1, max_length=180)
    transaction_name: str | None = Field(default=None, max_length=180)
    contact_person: str | None = Field(default=None, max_length=180)

    phone_number: str | None = Field(default=None, max_length=50)
    alternative_phone_number: str | None = Field(default=None, max_length=50)
    email: str | None = Field(default=None, max_length=180)

    address: str | None = Field(default=None, max_length=2000)
    business_location: str | None = Field(default=None, max_length=180)
    district: str | None = Field(default=None, max_length=120)
    region: str | None = Field(default=None, max_length=120)

    tin_number: str | None = Field(default=None, max_length=100)
    registration_number: str | None = Field(default=None, max_length=100)

    customer_type: ByproductCustomerType = ByproductCustomerType.RETAIL
    default_payment_mode: ByproductPaymentMode | None = None

    credit_allowed: bool = False
    credit_limit: Decimal | None = Field(default=None, ge=0)

    notes: str | None = Field(default=None, max_length=3000)
    is_active: bool = True

    @field_validator("customer_code")
    @classmethod
    def validate_customer_code(cls, value: str) -> str:
        cleaned = _clean_upper_text(value)
        if not cleaned:
            raise ValueError("customer_code is required")
        return cleaned

    @field_validator(
        "customer_name",
        "transaction_name",
        "contact_person",
        "phone_number",
        "alternative_phone_number",
        "email",
        "address",
        "business_location",
        "district",
        "region",
        "tin_number",
        "registration_number",
        "notes",
    )
    @classmethod
    def validate_text_fields(cls, value: str | None) -> str | None:
        return _clean_text(value)

    @model_validator(mode="after")
    def validate_credit_fields(self) -> "ByproductCustomerBase":
        if not self.credit_allowed and self.credit_limit not in (
            None,
            Decimal("0"),
            Decimal("0.00"),
        ):
            raise ValueError("credit_limit can only be set when credit_allowed is true")
        return self


class ByproductCustomerCreate(ByproductCustomerBase):
    pass


class ByproductCustomerUpdate(AppSchema):
    customer_code: str | None = Field(default=None, min_length=1, max_length=50)
    customer_name: str | None = Field(default=None, min_length=1, max_length=180)
    transaction_name: str | None = Field(default=None, max_length=180)
    contact_person: str | None = Field(default=None, max_length=180)

    phone_number: str | None = Field(default=None, max_length=50)
    alternative_phone_number: str | None = Field(default=None, max_length=50)
    email: str | None = Field(default=None, max_length=180)

    address: str | None = Field(default=None, max_length=2000)
    business_location: str | None = Field(default=None, max_length=180)
    district: str | None = Field(default=None, max_length=120)
    region: str | None = Field(default=None, max_length=120)

    tin_number: str | None = Field(default=None, max_length=100)
    registration_number: str | None = Field(default=None, max_length=100)

    customer_type: ByproductCustomerType | None = None
    default_payment_mode: ByproductPaymentMode | None = None

    credit_allowed: bool | None = None
    credit_limit: Decimal | None = Field(default=None, ge=0)

    notes: str | None = Field(default=None, max_length=3000)
    is_active: bool | None = None

    @field_validator("customer_code")
    @classmethod
    def validate_customer_code(cls, value: str | None) -> str | None:
        return _clean_upper_text(value)

    @field_validator(
        "customer_name",
        "transaction_name",
        "contact_person",
        "phone_number",
        "alternative_phone_number",
        "email",
        "address",
        "business_location",
        "district",
        "region",
        "tin_number",
        "registration_number",
        "notes",
    )
    @classmethod
    def validate_text_fields(cls, value: str | None) -> str | None:
        return _clean_text(value)

    @model_validator(mode="after")
    def validate_credit_fields(self) -> "ByproductCustomerUpdate":
        if self.credit_allowed is False and self.credit_limit not in (
            None,
            Decimal("0"),
            Decimal("0.00"),
        ):
            raise ValueError("credit_limit can only be set when credit_allowed is true")
        return self


class ByproductCustomerRead(AuditReadMixin):
    customer_code: str
    customer_name: str
    transaction_name: str | None = None
    contact_person: str | None = None

    phone_number: str | None = None
    alternative_phone_number: str | None = None
    email: str | None = None

    address: str | None = None
    business_location: str | None = None
    district: str | None = None
    region: str | None = None

    tin_number: str | None = None
    registration_number: str | None = None

    customer_type: ByproductCustomerType
    default_payment_mode: ByproductPaymentMode | None = None

    credit_allowed: bool
    credit_limit: Decimal | None = None

    notes: str | None = None


class ByproductCustomerListResponse(AppSchema):
    items: list[ByproductCustomerRead] = Field(default_factory=list)
    total: int


class ByproductCustomerFilter(AppSchema):
    search: str | None = None
    customer_type: ByproductCustomerType | None = None
    business_location: str | None = None
    district: str | None = None
    region: str | None = None
    is_active: bool | None = None
    include_deleted: bool = False

    @field_validator("search", "business_location", "district", "region")
    @classmethod
    def validate_search_fields(cls, value: str | None) -> str | None:
        return _clean_text(value)


# =============================================================================
# SALE LINE SCHEMAS
# =============================================================================


class ByproductSaleLineBase(AppSchema):
    byproduct_id: UUID | None = None
    byproduct_name: str | None = Field(default=None, max_length=180)
    line_number: int = Field(default=1, ge=1)

    quantity: Decimal = Field(..., gt=0)
    unit_price: Decimal = Field(..., ge=0)

    remarks: str | None = Field(default=None, max_length=1000)
    extra_meta: dict[str, Any] | None = None

    @field_validator("byproduct_name", "remarks")
    @classmethod
    def validate_text_fields(cls, value: str | None) -> str | None:
        return _clean_text(value)

    @model_validator(mode="after")
    def validate_line_reference(self) -> "ByproductSaleLineBase":
        if not self.byproduct_id and not self.byproduct_name:
            raise ValueError("either byproduct_id or byproduct_name must be provided")
        return self


class ByproductSaleLineCreate(ByproductSaleLineBase):
    pass


class ByproductSaleLineUpdate(AppSchema):
    id: UUID | None = None
    byproduct_id: UUID | None = None
    byproduct_name: str | None = Field(default=None, max_length=180)
    line_number: int | None = Field(default=None, ge=1)

    quantity: Decimal | None = Field(default=None, gt=0)
    unit_price: Decimal | None = Field(default=None, ge=0)

    remarks: str | None = Field(default=None, max_length=1000)
    extra_meta: dict[str, Any] | None = None
    is_active: bool | None = None

    @field_validator("byproduct_name", "remarks")
    @classmethod
    def validate_text_fields(cls, value: str | None) -> str | None:
        return _clean_text(value)


class ByproductSaleLineRead(AuditReadMixin):
    sale_id: UUID
    byproduct_id: UUID | None = None

    line_number: int

    byproduct_code_snapshot: str | None = None
    byproduct_name_snapshot: str
    byproduct_category_snapshot: str | None = None
    unit_of_measure_snapshot: str | None = None

    quantity: Decimal
    unit_price: Decimal
    line_total: Decimal

    remarks: str | None = None
    extra_meta: dict[str, Any] | None = None


# =============================================================================
# SALE SCHEMAS
# =============================================================================


class ByproductSaleBase(AppSchema):
    sale_date: date
    customer_id: UUID | None = None

    customer_name: str | None = Field(default=None, max_length=180)
    transaction_name: str | None = Field(default=None, max_length=180)

    payment_mode: ByproductPaymentMode | None = None
    discount_amount: Decimal = Field(default=Decimal("0.00"), ge=0)
    adjustment_amount: Decimal = Field(default=Decimal("0.00"))
    amount_paid: Decimal = Field(default=Decimal("0.00"), ge=0)

    remarks: str | None = Field(default=None, max_length=2000)
    extra_meta: dict[str, Any] | None = None

    @field_validator("customer_name", "transaction_name", "remarks")
    @classmethod
    def validate_text_fields(cls, value: str | None) -> str | None:
        return _clean_text(value)


class ByproductSaleCreate(ByproductSaleBase):
    sale_number: str | None = Field(default=None, max_length=60)
    status: ByproductSaleStatus = ByproductSaleStatus.POSTED
    lines: list[ByproductSaleLineCreate] = Field(..., min_length=1)

    @field_validator("sale_number")
    @classmethod
    def validate_sale_number(cls, value: str | None) -> str | None:
        return _clean_upper_text(value)

    @model_validator(mode="after")
    def validate_customer_reference(self) -> "ByproductSaleCreate":
        if not self.customer_id and not self.customer_name:
            raise ValueError("either customer_id or customer_name must be provided")
        return self


class ByproductSaleUpdate(AppSchema):
    sale_date: date | None = None
    customer_id: UUID | None = None

    customer_name: str | None = Field(default=None, max_length=180)
    transaction_name: str | None = Field(default=None, max_length=180)

    status: ByproductSaleStatus | None = None
    payment_mode: ByproductPaymentMode | None = None

    discount_amount: Decimal | None = Field(default=None, ge=0)
    adjustment_amount: Decimal | None = None
    amount_paid: Decimal | None = Field(default=None, ge=0)

    remarks: str | None = Field(default=None, max_length=2000)
    extra_meta: dict[str, Any] | None = None

    lines: list[ByproductSaleLineUpdate] | None = None
    deleted_line_ids: list[UUID] = Field(default_factory=list)

    @field_validator("customer_name", "transaction_name", "remarks")
    @classmethod
    def validate_text_fields(cls, value: str | None) -> str | None:
        return _clean_text(value)


class ByproductSaleRead(AuditReadMixin):
    sale_number: str
    sale_date: date
    customer_id: UUID | None = None

    customer_name_snapshot: str
    transaction_name_snapshot: str | None = None
    customer_phone_snapshot: str | None = None
    customer_business_location_snapshot: str | None = None

    status: ByproductSaleStatus
    payment_mode: ByproductPaymentMode | None = None

    subtotal_amount: Decimal
    discount_amount: Decimal
    adjustment_amount: Decimal
    total_amount: Decimal

    amount_paid: Decimal
    balance_due: Decimal

    remarks: str | None = None
    extra_meta: dict[str, Any] | None = None

    lines: list[ByproductSaleLineRead] = Field(default_factory=list)


class ByproductSaleSummaryRead(AppSchema):
    id: UUID
    sale_number: str
    sale_date: date
    customer_id: UUID | None = None
    customer_name_snapshot: str
    transaction_name_snapshot: str | None = None
    status: ByproductSaleStatus
    payment_mode: ByproductPaymentMode | None = None
    total_amount: Decimal
    amount_paid: Decimal
    balance_due: Decimal
    is_active: bool
    is_deleted: bool
    created_at: datetime
    updated_at: datetime


class ByproductSaleListResponse(AppSchema):
    items: list[ByproductSaleSummaryRead] = Field(default_factory=list)
    total: int


class ByproductSaleFilter(AppSchema):
    search: str | None = None
    sale_date_from: date | None = None
    sale_date_to: date | None = None

    customer_id: UUID | None = None
    byproduct_id: UUID | None = None
    category_id: UUID | None = None

    payment_mode: ByproductPaymentMode | None = None
    status: ByproductSaleStatus | None = None

    include_deleted: bool = False

    @field_validator("search")
    @classmethod
    def validate_search(cls, value: str | None) -> str | None:
        return _clean_text(value)

    @model_validator(mode="after")
    def validate_range(self) -> "ByproductSaleFilter":
        if (
            self.sale_date_from is not None
            and self.sale_date_to is not None
            and self.sale_date_to < self.sale_date_from
        ):
            raise ValueError("sale_date_to cannot be earlier than sale_date_from")
        return self


# =============================================================================
# REPORT SCHEMAS
# =============================================================================


ReportGroupBy = Literal["day", "week", "month", "customer", "byproduct", "category"]
ReportType = Literal["daily", "weekly", "monthly", "custom_period", "accumulation"]


class ByproductReportFilter(AppSchema):
    report_type: ReportType = "custom_period"

    date_from: date
    date_to: date

    customer_id: UUID | None = None
    byproduct_id: UUID | None = None
    category_id: UUID | None = None

    include_void: bool = False
    include_deleted: bool = False

    group_by: ReportGroupBy | None = None
    search: str | None = None

    @field_validator("search")
    @classmethod
    def validate_search(cls, value: str | None) -> str | None:
        return _clean_text(value)

    @model_validator(mode="after")
    def validate_date_range(self) -> "ByproductReportFilter":
        if self.date_to < self.date_from:
            raise ValueError("date_to cannot be earlier than date_from")
        return self


class ByproductReportRow(AppSchema):
    sale_id: UUID | None = None
    sale_line_id: UUID | None = None

    sale_date: date
    sale_number: str | None = None

    customer_id: UUID | None = None
    customer_name: str | None = None
    transaction_name: str | None = None
    business_location: str | None = None

    byproduct_id: UUID | None = None
    byproduct_name: str | None = None
    byproduct_category: str | None = None
    unit_of_measure: str | None = None

    quantity: Decimal
    unit_price: Decimal
    line_total: Decimal

    payment_mode: ByproductPaymentMode | None = None
    status: ByproductSaleStatus | None = None


class ByproductGroupedReportRow(AppSchema):
    group_key: str
    group_label: str
    quantity_total: Decimal
    amount_total: Decimal
    average_unit_price: Decimal | None = None
    transaction_count: int = 0


class ByproductReportTotals(AppSchema):
    total_quantity: Decimal = Decimal("0")
    subtotal_amount: Decimal = Decimal("0.00")
    discount_amount: Decimal = Decimal("0.00")
    adjustment_amount: Decimal = Decimal("0.00")
    total_amount: Decimal = Decimal("0.00")
    amount_paid: Decimal = Decimal("0.00")
    balance_due: Decimal = Decimal("0.00")
    transaction_count: int = 0
    line_count: int = 0
    customer_count: int = 0
    byproduct_count: int = 0


class ByproductReportPeriodInfo(AppSchema):
    report_type: ReportType
    date_from: date
    date_to: date
    generated_at: datetime


class ByproductReportResponse(AppSchema):
    period: ByproductReportPeriodInfo
    filters: ByproductReportFilter
    rows: list[ByproductReportRow] = Field(default_factory=list)
    grouped_rows: list[ByproductGroupedReportRow] = Field(default_factory=list)
    totals: ByproductReportTotals


class ByproductTrendPoint(AppSchema):
    period_key: str
    period_label: str
    quantity_total: Decimal
    amount_total: Decimal
    transaction_count: int = 0


class ByproductTrendResponse(AppSchema):
    filters: ByproductReportFilter
    points: list[ByproductTrendPoint] = Field(default_factory=list)
    totals: ByproductReportTotals


# =============================================================================
# TEMPLATE SCHEMAS
# =============================================================================


class ByproductTemplatePlaceholderMeta(AppSchema):
    placeholders: list[str] = Field(default_factory=list)

    @field_validator("placeholders")
    @classmethod
    def validate_placeholders(cls, value: list[str]) -> list[str]:
        cleaned: list[str] = []
        seen: set[str] = set()

        for item in value or []:
            text = _clean_text(item)
            if not text:
                continue
            if text not in seen:
                cleaned.append(text)
                seen.add(text)

        return cleaned


class ByproductReportTemplateBase(AppSchema):
    name: str = Field(..., min_length=1, max_length=180)
    template_code: str = Field(..., min_length=1, max_length=60)

    template_type: ByproductTemplateType
    template_format: ByproductTemplateFormat

    is_default: bool = False
    notes: str | None = Field(default=None, max_length=3000)
    placeholders_meta: ByproductTemplatePlaceholderMeta | None = None
    is_active: bool = True

    @field_validator("name", "notes")
    @classmethod
    def validate_text_fields(cls, value: str | None) -> str | None:
        return _clean_text(value)

    @field_validator("template_code")
    @classmethod
    def validate_template_code(cls, value: str) -> str:
        cleaned = _clean_upper_text(value)
        if not cleaned:
            raise ValueError("template_code is required")
        return cleaned


class ByproductReportTemplateCreate(ByproductReportTemplateBase):
    """
    Manual JSON template creation schema.

    This still supports legacy/manual disk-path registration.
    Normal uploaded templates should use the /templates/upload route,
    which stores file bytes in the database.
    """

    storage_backend: ByproductTemplateStorageBackend = ByproductTemplateStorageBackend.DISK
    file_name: str = Field(..., min_length=1, max_length=255)
    file_path: str | None = Field(default=None, max_length=1000)
    mime_type: str | None = Field(default=None, max_length=120)
    file_size_bytes: int | None = Field(default=None, ge=0)

    @field_validator("file_name", "mime_type")
    @classmethod
    def validate_file_fields(cls, value: str | None) -> str | None:
        return _clean_text(value)

    @field_validator("file_path")
    @classmethod
    def validate_file_path(cls, value: str | None) -> str | None:
        return _clean_path_text(value)

    @model_validator(mode="after")
    def validate_storage_payload(self) -> "ByproductReportTemplateCreate":
        if self.storage_backend == ByproductTemplateStorageBackend.DISK and not self.file_path:
            raise ValueError("file_path is required when storage_backend is 'disk'")
        return self


class ByproductReportTemplateUpdate(AppSchema):
    name: str | None = Field(default=None, min_length=1, max_length=180)
    template_code: str | None = Field(default=None, min_length=1, max_length=60)

    template_type: ByproductTemplateType | None = None
    template_format: ByproductTemplateFormat | None = None
    storage_backend: ByproductTemplateStorageBackend | None = None

    file_name: str | None = Field(default=None, max_length=255)
    file_path: str | None = Field(default=None, max_length=1000)
    mime_type: str | None = Field(default=None, max_length=120)
    file_size_bytes: int | None = Field(default=None, ge=0)

    is_default: bool | None = None
    notes: str | None = Field(default=None, max_length=3000)
    placeholders_meta: ByproductTemplatePlaceholderMeta | None = None
    is_active: bool | None = None

    @field_validator("name", "file_name", "mime_type", "notes")
    @classmethod
    def validate_text_fields(cls, value: str | None) -> str | None:
        return _clean_text(value)

    @field_validator("file_path")
    @classmethod
    def validate_file_path(cls, value: str | None) -> str | None:
        return _clean_path_text(value)

    @field_validator("template_code")
    @classmethod
    def validate_template_code(cls, value: str | None) -> str | None:
        return _clean_upper_text(value)


class ByproductReportTemplateRead(AuditReadMixin):
    name: str
    template_code: str

    template_type: ByproductTemplateType
    template_format: ByproductTemplateFormat
    storage_backend: ByproductTemplateStorageBackend

    file_name: str
    file_path: str | None = None
    mime_type: str | None = None
    file_size_bytes: int | None = None

    is_default: bool
    notes: str | None = None
    placeholders_meta: ByproductTemplatePlaceholderMeta | None = None

    @field_validator("file_path")
    @classmethod
    def validate_file_path(cls, value: str | None) -> str | None:
        return _clean_path_text(value)


class ByproductReportTemplateListResponse(AppSchema):
    items: list[ByproductReportTemplateRead] = Field(default_factory=list)
    total: int


class ByproductReportTemplateFilter(AppSchema):
    search: str | None = None
    template_type: ByproductTemplateType | None = None
    template_format: ByproductTemplateFormat | None = None
    storage_backend: ByproductTemplateStorageBackend | None = None
    is_default: bool | None = None
    is_active: bool | None = None
    include_deleted: bool = False

    @field_validator("search")
    @classmethod
    def validate_search(cls, value: str | None) -> str | None:
        return _clean_text(value)


class ByproductGenerateReportDocumentRequest(AppSchema):
    template_id: UUID | None = None
    template_code: str | None = Field(default=None, max_length=60)

    report_filter: ByproductReportFilter
    output_format: Literal["pdf", "docx", "html"] = "pdf"

    @field_validator("template_code")
    @classmethod
    def validate_template_code(cls, value: str | None) -> str | None:
        return _clean_upper_text(value)

    @model_validator(mode="after")
    def validate_template_reference(self) -> "ByproductGenerateReportDocumentRequest":
        if not self.template_id and not self.template_code:
            raise ValueError("either template_id or template_code must be provided")
        return self


class ByproductGeneratedDocumentResponse(AppSchema):
    file_name: str
    file_path: str
    download_url: str | None = None
    mime_type: str
    size_bytes: int | None = None

    @field_validator("file_name", "mime_type")
    @classmethod
    def validate_text_fields(cls, value: str | None) -> str | None:
        cleaned = _clean_text(value)
        if cleaned is None:
            raise ValueError("value is required")
        return cleaned

    @field_validator("file_path")
    @classmethod
    def validate_file_path(cls, value: str | None) -> str:
        cleaned = _clean_path_text(value)
        if not cleaned:
            raise ValueError("file_path is required")
        return cleaned

    @field_validator("download_url")
    @classmethod
    def validate_download_url(cls, value: str | None) -> str | None:
        return _clean_url_text(value)


# =============================================================================
# DASHBOARD / SUMMARY SCHEMAS
# =============================================================================


class ByproductDashboardCard(AppSchema):
    title: str
    value: Decimal | int | str
    subtitle: str | None = None


class ByproductDashboardResponse(AppSchema):
    date_from: date
    date_to: date
    cards: list[ByproductDashboardCard] = Field(default_factory=list)
    top_customers: list[ByproductGroupedReportRow] = Field(default_factory=list)
    top_byproducts: list[ByproductGroupedReportRow] = Field(default_factory=list)
    trend: list[ByproductTrendPoint] = Field(default_factory=list)