from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.models.audit import AuditPeriodType
from app.models.inventory import ConsumableStoreName, ProductStoreName


AuditExportFormat = Literal["pdf", "csv"]


def clean_text(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = " ".join(str(value).strip().split())
    return cleaned or None


class BaseSchema(BaseModel):
    model_config = ConfigDict(
        from_attributes=True,
        str_strip_whitespace=True,
        use_enum_values=False,
    )


class MessageSchema(BaseSchema):
    success: bool = True
    message: str


class PaginationSchema(BaseSchema):
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=500)


class PaginatedResponseBase(BaseSchema):
    total: int = Field(..., ge=0)
    page: int = Field(..., ge=1)
    page_size: int = Field(..., ge=1, le=500)
    total_pages: int = Field(..., ge=0)


# =============================================================================
# GENERATE / REFRESH REQUESTS
# =============================================================================


class AuditGenerateRequest(BaseSchema):
    audit_period_type: AuditPeriodType
    period_end_date: date

    @model_validator(mode="after")
    def validate_period_end_date(self):
        if not self.period_end_date:
            raise ValueError("period_end_date is required.")
        return self


class ProductAuditGenerateRequest(AuditGenerateRequest):
    store: ProductStoreName | None = None
    product_category_id: str | None = None
    product_id: str | None = None


class ConsumableAuditGenerateRequest(AuditGenerateRequest):
    store: ConsumableStoreName | None = None
    item_category_id: str | None = None
    item_id: str | None = None


class AuditGenerateResponse(BaseSchema):
    audit_period_type: AuditPeriodType
    period_end_date: date
    generated_count: int = Field(default=0, ge=0)
    updated_count: int = Field(default=0, ge=0)
    total_processed: int = Field(default=0, ge=0)
    message: str


# =============================================================================
# REMARKS UPDATE
# =============================================================================


class AuditRemarksUpdate(BaseSchema):
    remarks: str | None = None

    @field_validator("remarks")
    @classmethod
    def validate_remarks(cls, value: str | None) -> str | None:
        return clean_text(value)


# =============================================================================
# FILTER SCHEMAS
# =============================================================================


class ProductAuditFilter(PaginationSchema):
    audit_period_type: AuditPeriodType | None = None
    period_start_date: date | None = None
    period_end_date: date | None = None
    store: ProductStoreName | None = None
    product_category_id: str | None = None
    product_id: str | None = None
    search: str | None = None

    @field_validator("search")
    @classmethod
    def validate_search(cls, value: str | None) -> str | None:
        return clean_text(value)

    @model_validator(mode="after")
    def validate_dates(self):
        if (
            self.period_start_date
            and self.period_end_date
            and self.period_end_date < self.period_start_date
        ):
            raise ValueError("period_end_date cannot be earlier than period_start_date.")
        return self


class ConsumableAuditFilter(PaginationSchema):
    audit_period_type: AuditPeriodType | None = None
    period_start_date: date | None = None
    period_end_date: date | None = None
    store: ConsumableStoreName | None = None
    item_category_id: str | None = None
    item_id: str | None = None
    search: str | None = None

    @field_validator("search")
    @classmethod
    def validate_search(cls, value: str | None) -> str | None:
        return clean_text(value)

    @model_validator(mode="after")
    def validate_dates(self):
        if (
            self.period_start_date
            and self.period_end_date
            and self.period_end_date < self.period_start_date
        ):
            raise ValueError("period_end_date cannot be earlier than period_start_date.")
        return self


# =============================================================================
# PRODUCT AUDIT READ / LIST
# =============================================================================


class ProductAuditRead(BaseSchema):
    id: str

    audit_period_type: AuditPeriodType
    period_start_date: date
    period_end_date: date

    store: ProductStoreName

    product_category_id: str | None = None
    product_id: str | None = None
    product_category_name: str
    product_name: str

    count_pcs: int
    sample_size_pcs: int
    sample_weight_kg: Decimal
    avg_weight_kg_per_pc: Decimal
    calculated_total_kg: Decimal

    ledger_opening_kg: Decimal
    ledger_inflows_kg: Decimal
    ledger_outflows_kg: Decimal
    ledger_closing_kg: Decimal

    variance_kg: Decimal
    variance_pct: Decimal

    remarks: str | None = None

    is_system_generated: bool = True
    generated_at: datetime
    last_recalculated_at: datetime | None = None

    created_by: str | None = None
    updated_by: str | None = None
    created_at: datetime
    updated_at: datetime


class ProductAuditListResponse(PaginatedResponseBase):
    items: list[ProductAuditRead] = Field(default_factory=list)


# =============================================================================
# CONSUMABLE AUDIT READ / LIST
# =============================================================================


class ConsumableAuditRead(BaseSchema):
    id: str

    audit_period_type: AuditPeriodType
    period_start_date: date
    period_end_date: date

    store: ConsumableStoreName

    item_category_id: str | None = None
    item_id: str | None = None
    item_category_name: str
    item_name: str
    unit: str

    opening_ledger: Decimal
    issues_total: Decimal
    expected_closing: Decimal
    physical_count: Decimal
    variance: Decimal
    variance_pct: Decimal

    remarks: str | None = None

    is_system_generated: bool = True
    generated_at: datetime
    last_recalculated_at: datetime | None = None

    created_by: str | None = None
    updated_by: str | None = None
    created_at: datetime
    updated_at: datetime


class ConsumableAuditListResponse(PaginatedResponseBase):
    items: list[ConsumableAuditRead] = Field(default_factory=list)


# =============================================================================
# REPORT / EXPORT REQUESTS
# =============================================================================


class ProductAuditReportRequest(BaseSchema):
    audit_period_type: AuditPeriodType
    period_start_date: date
    period_end_date: date
    export_format: AuditExportFormat | None = None

    store: ProductStoreName | None = None
    product_category_id: str | None = None
    product_id: str | None = None

    include_rows: bool = True
    include_totals: bool = True
    include_summary: bool = True

    @model_validator(mode="after")
    def validate_dates(self):
        if self.period_end_date < self.period_start_date:
            raise ValueError("period_end_date cannot be earlier than period_start_date.")
        return self


class ConsumableAuditReportRequest(BaseSchema):
    audit_period_type: AuditPeriodType
    period_start_date: date
    period_end_date: date
    export_format: AuditExportFormat | None = None

    store: ConsumableStoreName | None = None
    item_category_id: str | None = None
    item_id: str | None = None

    include_rows: bool = True
    include_totals: bool = True
    include_summary: bool = True

    @model_validator(mode="after")
    def validate_dates(self):
        if self.period_end_date < self.period_start_date:
            raise ValueError("period_end_date cannot be earlier than period_start_date.")
        return self


# =============================================================================
# PRODUCT AUDIT REPORT RESPONSE SCHEMAS
# =============================================================================


class ProductAuditReportRow(BaseSchema):
    index: int | None = None
    period_end_date: date
    store: ProductStoreName
    product_category_name: str
    product_name: str

    count_pcs: int
    sample_size_pcs: int
    sample_weight_kg: Decimal
    avg_weight_kg_per_pc: Decimal
    calculated_total_kg: Decimal

    ledger_opening_kg: Decimal
    ledger_inflows_kg: Decimal
    ledger_outflows_kg: Decimal
    ledger_closing_kg: Decimal

    variance_kg: Decimal
    variance_pct: Decimal
    remarks: str | None = None


class ProductAuditReportSummary(BaseSchema):
    count_pcs: int = 0
    sample_size_pcs: int = 0
    sample_weight_kg: Decimal = Decimal("0.00")
    calculated_total_kg: Decimal = Decimal("0.00")
    ledger_opening_kg: Decimal = Decimal("0.00")
    ledger_inflows_kg: Decimal = Decimal("0.00")
    ledger_outflows_kg: Decimal = Decimal("0.00")
    ledger_closing_kg: Decimal = Decimal("0.00")
    variance_kg: Decimal = Decimal("0.00")


class ProductAuditReportGroup(BaseSchema):
    label: str
    period_start_date: date
    period_end_date: date
    rows: list[ProductAuditReportRow] = Field(default_factory=list)
    summary: ProductAuditReportSummary = Field(default_factory=ProductAuditReportSummary)


class ProductAuditReportResponse(BaseSchema):
    audit_period_type: AuditPeriodType
    export_format: AuditExportFormat | None = None
    generated_at: datetime

    period_start_date: date
    period_end_date: date
    store: ProductStoreName | None = None
    product_category_id: str | None = None
    product_id: str | None = None

    groups: list[ProductAuditReportGroup] = Field(default_factory=list)
    grand_totals: ProductAuditReportSummary = Field(default_factory=ProductAuditReportSummary)


# =============================================================================
# CONSUMABLE AUDIT REPORT RESPONSE SCHEMAS
# =============================================================================


class ConsumableAuditReportRow(BaseSchema):
    index: int | None = None
    period_end_date: date
    store: ConsumableStoreName
    item_name: str
    unit: str

    opening_ledger: Decimal
    issues_total: Decimal
    expected_closing: Decimal
    physical_count: Decimal
    variance: Decimal
    variance_pct: Decimal
    remarks: str | None = None


class ConsumableAuditReportSummary(BaseSchema):
    opening_ledger: Decimal = Decimal("0.00")
    issues_total: Decimal = Decimal("0.00")
    expected_closing: Decimal = Decimal("0.00")
    physical_count: Decimal = Decimal("0.00")
    variance: Decimal = Decimal("0.00")


class ConsumableAuditReportGroup(BaseSchema):
    label: str
    period_start_date: date
    period_end_date: date
    rows: list[ConsumableAuditReportRow] = Field(default_factory=list)
    summary: ConsumableAuditReportSummary = Field(default_factory=ConsumableAuditReportSummary)


class ConsumableAuditReportResponse(BaseSchema):
    audit_period_type: AuditPeriodType
    export_format: AuditExportFormat | None = None
    generated_at: datetime

    period_start_date: date
    period_end_date: date
    store: ConsumableStoreName | None = None
    item_category_id: str | None = None
    item_id: str | None = None

    groups: list[ConsumableAuditReportGroup] = Field(default_factory=list)
    grand_totals: ConsumableAuditReportSummary = Field(default_factory=ConsumableAuditReportSummary)


# =============================================================================
# EXPORT FILE RESPONSE
# =============================================================================


class AuditExportFileResponse(BaseSchema):
    filename: str
    content_type: str
    audit_period_type: AuditPeriodType
    export_format: AuditExportFormat
    generated_at: datetime