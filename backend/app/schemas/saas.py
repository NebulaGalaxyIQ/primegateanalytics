from __future__ import annotations

from calendar import month_name
from datetime import date, datetime, timedelta
from decimal import Decimal, ROUND_HALF_UP
from typing import List, Literal, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


DECIMAL_ZERO_2 = Decimal("0.00")
DECIMAL_ZERO_3 = Decimal("0.000")
TWOPLACES = Decimal("0.01")
THREEPLACES = Decimal("0.001")


def normalize_text(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    value = value.strip()
    return value or None


def to_decimal(
    value,
    *,
    places: Decimal,
    default: Decimal,
) -> Decimal:
    if value is None or value == "":
        return default
    if isinstance(value, Decimal):
        return value.quantize(places, rounding=ROUND_HALF_UP)
    return Decimal(str(value)).quantize(places, rounding=ROUND_HALF_UP)


class SaaSSchemaBase(BaseModel):
    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
        str_strip_whitespace=True,
        extra="ignore",
    )


# =============================================================================
# INPUT / MUTATION SCHEMAS
# =============================================================================
class SaaSCreate(SaaSSchemaBase):
    service_date: date
    client_name: Optional[str] = Field(default=None, max_length=255)
    animal_type: Optional[str] = Field(default=None, max_length=100)
    total_animals: int = Field(default=0, ge=0)
    unit_price_per_head_usd: Decimal = Field(default=DECIMAL_ZERO_3)
    unit_price_offal_usd: Decimal = Field(default=DECIMAL_ZERO_3)
    notes: Optional[str] = None
    is_active: bool = True

    @field_validator("client_name", "animal_type", "notes", mode="before")
    @classmethod
    def validate_text_fields(cls, value):
        return normalize_text(value)

    @field_validator("unit_price_per_head_usd", "unit_price_offal_usd", mode="before")
    @classmethod
    def validate_unit_prices(cls, value):
        value = to_decimal(value, places=THREEPLACES, default=DECIMAL_ZERO_3)
        if value < 0:
            raise ValueError("Price values cannot be negative.")
        return value


class SaaSUpdate(SaaSSchemaBase):
    service_date: Optional[date] = None
    client_name: Optional[str] = Field(default=None, max_length=255)
    animal_type: Optional[str] = Field(default=None, max_length=100)
    total_animals: Optional[int] = Field(default=None, ge=0)
    unit_price_per_head_usd: Optional[Decimal] = None
    unit_price_offal_usd: Optional[Decimal] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None

    @field_validator("client_name", "animal_type", "notes", mode="before")
    @classmethod
    def validate_text_fields(cls, value):
        return normalize_text(value)

    @field_validator("unit_price_per_head_usd", "unit_price_offal_usd", mode="before")
    @classmethod
    def validate_unit_prices(cls, value):
        if value is None or value == "":
            return None
        value = to_decimal(value, places=THREEPLACES, default=DECIMAL_ZERO_3)
        if value < 0:
            raise ValueError("Price values cannot be negative.")
        return value


# =============================================================================
# READ SCHEMAS
# =============================================================================
class SaaSRead(SaaSSchemaBase):
    id: UUID
    service_date: date
    client_name: Optional[str] = None
    animal_type: Optional[str] = None
    total_animals: int = 0

    unit_price_per_head_usd: Decimal = DECIMAL_ZERO_3
    total_revenue_usd: Decimal = DECIMAL_ZERO_2

    unit_price_offal_usd: Decimal = DECIMAL_ZERO_3
    total_offal_revenue_usd: Decimal = DECIMAL_ZERO_2
    total_combined_revenue_usd: Decimal = DECIMAL_ZERO_2

    notes: Optional[str] = None
    is_active: bool = True
    created_at: datetime
    updated_at: datetime

    @field_validator("unit_price_per_head_usd", "unit_price_offal_usd", mode="before")
    @classmethod
    def quantize_unit_prices(cls, value):
        return to_decimal(value, places=THREEPLACES, default=DECIMAL_ZERO_3)

    @field_validator(
        "total_revenue_usd",
        "total_offal_revenue_usd",
        "total_combined_revenue_usd",
        mode="before",
    )
    @classmethod
    def quantize_totals(cls, value):
        return to_decimal(value, places=TWOPLACES, default=DECIMAL_ZERO_2)


class SaaSListResponse(SaaSSchemaBase):
    items: List[SaaSRead] = Field(default_factory=list)
    total: int = 0
    skip: int = 0
    limit: int = 100


# =============================================================================
# FILTER / QUERY SCHEMAS
# =============================================================================
class SaaSListQuery(SaaSSchemaBase):
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    client_name: Optional[str] = None
    animal_type: Optional[str] = None
    is_active: Optional[bool] = None

    month: Optional[int] = Field(default=None, ge=1, le=12)
    year: Optional[int] = Field(default=None, ge=2000, le=9999)

    skip: int = Field(default=0, ge=0)
    limit: int = Field(default=100, ge=1, le=1000)

    sort_by: Literal[
        "service_date",
        "client_name",
        "animal_type",
        "total_animals",
        "total_revenue_usd",
        "total_offal_revenue_usd",
        "total_combined_revenue_usd",
        "created_at",
        "updated_at",
    ] = "service_date"

    sort_order: Literal["asc", "desc"] = "desc"

    @field_validator("client_name", "animal_type", mode="before")
    @classmethod
    def validate_text_filters(cls, value):
        return normalize_text(value)

    @model_validator(mode="after")
    def validate_dates(self):
        if self.start_date and self.end_date and self.start_date > self.end_date:
            raise ValueError("start_date cannot be later than end_date.")
        return self

    @model_validator(mode="after")
    def validate_month_year_pair(self):
        if self.month is not None and self.year is None:
            raise ValueError("year is required when month is provided.")
        return self


# =============================================================================
# REPORT ROWS / TOTALS / SUMMARIES
# =============================================================================
class SaaSReportRow(SaaSSchemaBase):
    id: Optional[UUID] = None
    service_date: date
    client_name: Optional[str] = None
    animal_type: Optional[str] = None
    total_animals: int = 0

    unit_price_per_head_usd: Decimal = DECIMAL_ZERO_3
    total_revenue_usd: Decimal = DECIMAL_ZERO_2

    unit_price_offal_usd: Decimal = DECIMAL_ZERO_3
    total_offal_revenue_usd: Decimal = DECIMAL_ZERO_2
    total_combined_revenue_usd: Decimal = DECIMAL_ZERO_2

    @field_validator("unit_price_per_head_usd", "unit_price_offal_usd", mode="before")
    @classmethod
    def quantize_unit_prices(cls, value):
        return to_decimal(value, places=THREEPLACES, default=DECIMAL_ZERO_3)

    @field_validator(
        "total_revenue_usd",
        "total_offal_revenue_usd",
        "total_combined_revenue_usd",
        mode="before",
    )
    @classmethod
    def quantize_totals(cls, value):
        return to_decimal(value, places=TWOPLACES, default=DECIMAL_ZERO_2)


class SaaSReportTotals(SaaSSchemaBase):
    total_rows: int = 0
    total_clients_served: int = 0
    total_animals: int = 0
    total_service_revenue_usd: Decimal = DECIMAL_ZERO_2
    total_offal_revenue_usd: Decimal = DECIMAL_ZERO_2
    total_combined_revenue_usd: Decimal = DECIMAL_ZERO_2

    @field_validator(
        "total_service_revenue_usd",
        "total_offal_revenue_usd",
        "total_combined_revenue_usd",
        mode="before",
    )
    @classmethod
    def quantize_totals(cls, value):
        return to_decimal(value, places=TWOPLACES, default=DECIMAL_ZERO_2)


class SaaSClientSummaryRow(SaaSSchemaBase):
    client_name: Optional[str] = None
    rows_count: int = 0
    total_animals: int = 0
    total_service_revenue_usd: Decimal = DECIMAL_ZERO_2
    total_offal_revenue_usd: Decimal = DECIMAL_ZERO_2
    total_combined_revenue_usd: Decimal = DECIMAL_ZERO_2

    @field_validator(
        "total_service_revenue_usd",
        "total_offal_revenue_usd",
        "total_combined_revenue_usd",
        mode="before",
    )
    @classmethod
    def quantize_totals(cls, value):
        return to_decimal(value, places=TWOPLACES, default=DECIMAL_ZERO_2)


class SaaSAnimalSummaryRow(SaaSSchemaBase):
    animal_type: Optional[str] = None
    rows_count: int = 0
    total_animals: int = 0
    total_service_revenue_usd: Decimal = DECIMAL_ZERO_2
    total_offal_revenue_usd: Decimal = DECIMAL_ZERO_2
    total_combined_revenue_usd: Decimal = DECIMAL_ZERO_2

    @field_validator(
        "total_service_revenue_usd",
        "total_offal_revenue_usd",
        "total_combined_revenue_usd",
        mode="before",
    )
    @classmethod
    def quantize_totals(cls, value):
        return to_decimal(value, places=TWOPLACES, default=DECIMAL_ZERO_2)


class SaaSReportMeta(SaaSSchemaBase):
    organization_name: str = "Union Meat Group"
    report_title: str = "UMG Slaughter Services Report"
    report_type: Optional[Literal["daily", "weekly", "monthly", "range"]] = None
    scope_label: Optional[str] = None
    prepared_by_name: Optional[str] = None
    prepared_on: Optional[date] = None


# =============================================================================
# COMMON REPORT FILTERS
# =============================================================================
class SaaSReportFilterBase(SaaSSchemaBase):
    client_name: Optional[str] = None
    animal_type: Optional[str] = None
    is_active: Optional[bool] = True

    include_rows: bool = True
    include_totals: bool = True
    include_client_summary: bool = True
    include_animal_summary: bool = True

    report_title: Optional[str] = "UMG Slaughter Services Report"
    prepared_by_name: Optional[str] = None
    prepared_on: Optional[date] = None
    organization_name: Optional[str] = "Union Meat Group"

    @field_validator(
        "client_name",
        "animal_type",
        "report_title",
        "prepared_by_name",
        "organization_name",
        mode="before",
    )
    @classmethod
    def validate_text_filters(cls, value):
        return normalize_text(value)


# =============================================================================
# REPORT REQUEST SCHEMAS
# =============================================================================
class SaaSDailyReportRequest(SaaSReportFilterBase):
    report_date: date

    @property
    def scope_label(self) -> str:
        return f"Daily Report - {self.report_date.day}/{self.report_date.month}/{self.report_date.year}"


class SaaSWeeklyReportRequest(SaaSReportFilterBase):
    reference_date: date
    week_starts_on: Literal["monday", "sunday"] = "monday"

    @property
    def week_start_date(self) -> date:
        weekday = self.reference_date.weekday()  # Monday=0 ... Sunday=6
        if self.week_starts_on == "monday":
            return self.reference_date - timedelta(days=weekday)
        return self.reference_date - timedelta(days=(weekday + 1) % 7)

    @property
    def week_end_date(self) -> date:
        return self.week_start_date + timedelta(days=6)

    @property
    def scope_label(self) -> str:
        start = self.week_start_date
        end = self.week_end_date
        return (
            f"Weekly Report - "
            f"{start.day}/{start.month}/{start.year} to {end.day}/{end.month}/{end.year}"
        )


class SaaSMonthlyReportRequest(SaaSReportFilterBase):
    month: int = Field(..., ge=1, le=12)
    year: int = Field(..., ge=2000, le=9999)

    @property
    def month_label(self) -> str:
        return f"{month_name[self.month]} {self.year}"

    @property
    def scope_label(self) -> str:
        return f"Monthly Report - {month_name[self.month]} {self.year}"


class SaaSDateRangeReportRequest(SaaSReportFilterBase):
    start_date: date
    end_date: date

    @model_validator(mode="after")
    def validate_dates(self):
        if self.start_date > self.end_date:
            raise ValueError("start_date cannot be later than end_date.")
        return self

    @property
    def scope_label(self) -> str:
        start = self.start_date
        end = self.end_date
        return (
            f"Date Range Report - "
            f"{start.day}/{start.month}/{start.year} to {end.day}/{end.month}/{end.year}"
        )


# =============================================================================
# REPORT RESPONSE SCHEMAS
# =============================================================================
class SaaSDailyReportData(SaaSSchemaBase):
    meta: SaaSReportMeta = Field(default_factory=lambda: SaaSReportMeta(report_type="daily"))
    report_date: date
    rows: List[SaaSReportRow] = Field(default_factory=list)
    totals: SaaSReportTotals = Field(default_factory=SaaSReportTotals)
    client_summary: List[SaaSClientSummaryRow] = Field(default_factory=list)
    animal_summary: List[SaaSAnimalSummaryRow] = Field(default_factory=list)


class SaaSWeeklyReportData(SaaSSchemaBase):
    meta: SaaSReportMeta = Field(default_factory=lambda: SaaSReportMeta(report_type="weekly"))
    reference_date: date
    week_start_date: date
    week_end_date: date
    rows: List[SaaSReportRow] = Field(default_factory=list)
    totals: SaaSReportTotals = Field(default_factory=SaaSReportTotals)
    client_summary: List[SaaSClientSummaryRow] = Field(default_factory=list)
    animal_summary: List[SaaSAnimalSummaryRow] = Field(default_factory=list)


class SaaSMonthlyReportData(SaaSSchemaBase):
    meta: SaaSReportMeta = Field(default_factory=lambda: SaaSReportMeta(report_type="monthly"))
    month: int
    year: int
    month_label: str
    rows: List[SaaSReportRow] = Field(default_factory=list)
    totals: SaaSReportTotals = Field(default_factory=SaaSReportTotals)
    client_summary: List[SaaSClientSummaryRow] = Field(default_factory=list)
    animal_summary: List[SaaSAnimalSummaryRow] = Field(default_factory=list)


class SaaSDateRangeReportData(SaaSSchemaBase):
    meta: SaaSReportMeta = Field(default_factory=lambda: SaaSReportMeta(report_type="range"))
    start_date: date
    end_date: date
    rows: List[SaaSReportRow] = Field(default_factory=list)
    totals: SaaSReportTotals = Field(default_factory=SaaSReportTotals)
    client_summary: List[SaaSClientSummaryRow] = Field(default_factory=list)
    animal_summary: List[SaaSAnimalSummaryRow] = Field(default_factory=list)


# =============================================================================
# EXPORT SCHEMAS
# =============================================================================
class SaaSExportRequest(SaaSSchemaBase):
    export_format: Literal["excel", "pdf"] = "excel"
    scope: Literal["daily", "weekly", "monthly", "range"] = "monthly"

    report_date: Optional[date] = None
    reference_date: Optional[date] = None
    week_starts_on: Literal["monday", "sunday"] = "monday"

    month: Optional[int] = Field(default=None, ge=1, le=12)
    year: Optional[int] = Field(default=None, ge=2000, le=9999)

    start_date: Optional[date] = None
    end_date: Optional[date] = None

    client_name: Optional[str] = None
    animal_type: Optional[str] = None
    is_active: Optional[bool] = True

    report_title: Optional[str] = "UMG Slaughter Services Report"
    file_name: Optional[str] = None
    prepared_by_name: Optional[str] = None
    prepared_on: Optional[date] = None
    organization_name: Optional[str] = "Union Meat Group"

    include_rows: bool = True
    include_totals: bool = True
    include_client_summary: bool = True
    include_animal_summary: bool = True

    @field_validator(
        "client_name",
        "animal_type",
        "report_title",
        "file_name",
        "prepared_by_name",
        "organization_name",
        mode="before",
    )
    @classmethod
    def validate_text_fields(cls, value):
        return normalize_text(value)

    @model_validator(mode="after")
    def validate_scope(self):
        if self.scope == "daily":
            if self.report_date is None:
                raise ValueError("report_date is required for daily export.")
            if any(v is not None for v in [self.reference_date, self.month, self.year, self.start_date, self.end_date]):
                raise ValueError("Daily export accepts only report_date for scope selection.")
            return self

        if self.scope == "weekly":
            if self.reference_date is None:
                raise ValueError("reference_date is required for weekly export.")
            if any(v is not None for v in [self.report_date, self.month, self.year, self.start_date, self.end_date]):
                raise ValueError("Weekly export accepts only reference_date for scope selection.")
            return self

        if self.scope == "monthly":
            if self.month is None or self.year is None:
                raise ValueError("Both month and year are required for monthly export.")
            if any(v is not None for v in [self.report_date, self.reference_date, self.start_date, self.end_date]):
                raise ValueError("Monthly export accepts only month and year for scope selection.")
            return self

        if self.scope == "range":
            if self.start_date is None or self.end_date is None:
                raise ValueError("Both start_date and end_date are required for date-range export.")
            if self.start_date > self.end_date:
                raise ValueError("start_date cannot be later than end_date.")
            if any(v is not None for v in [self.report_date, self.reference_date, self.month, self.year]):
                raise ValueError("Date-range export accepts only start_date and end_date for scope selection.")
            return self

        return self