from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal, ROUND_HALF_UP
from typing import List, Literal, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

DECIMAL_ZERO_2 = Decimal("0.00")
DECIMAL_ZERO_4 = Decimal("0.0000")
TWO_PLACES = Decimal("0.01")
FOUR_PLACES = Decimal("0.0001")

DEFAULT_BREAK_EVEN_QUANTITY_TONNES = Decimal("133.70")
DEFAULT_BREAK_EVEN_VALUE_USD = Decimal("77347.00")
DEFAULT_BREAK_EVEN_USD_PER_TONNE = (
    DEFAULT_BREAK_EVEN_VALUE_USD / DEFAULT_BREAK_EVEN_QUANTITY_TONNES
).quantize(FOUR_PLACES, rounding=ROUND_HALF_UP)


def quantize_2(value: Decimal | int | float | str | None) -> Decimal:
    if value is None or value == "":
        return DECIMAL_ZERO_2
    return Decimal(str(value)).quantize(TWO_PLACES, rounding=ROUND_HALF_UP)


def quantize_4(value: Decimal | int | float | str | None) -> Decimal:
    if value is None or value == "":
        return DECIMAL_ZERO_4
    return Decimal(str(value)).quantize(FOUR_PLACES, rounding=ROUND_HALF_UP)


def compute_break_even_value_usd(
    break_even_quantity_tonnes: Decimal | int | float | str | None,
    break_even_usd_per_tonne: Decimal | int | float | str | None,
) -> Decimal:
    quantity = quantize_2(break_even_quantity_tonnes)
    rate = quantize_4(break_even_usd_per_tonne)
    return (quantity * rate).quantize(TWO_PLACES, rounding=ROUND_HALF_UP)


class BreakevenSchemaBase(BaseModel):
    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
        arbitrary_types_allowed=True,
        str_strip_whitespace=True,
    )


# =============================================================================
# Settings schemas
# =============================================================================
class BreakevenSettingBase(BreakevenSchemaBase):
    setting_name: str = Field(
        default="Default Breakeven Setting",
        max_length=120,
    )
    description: Optional[str] = Field(default=None, max_length=1000)
    scope_type: Literal["global", "monthly"] = "global"
    month: Optional[int] = Field(default=None, ge=1, le=12)
    year: Optional[int] = Field(default=None, ge=2000, le=9999)
    break_even_quantity_tonnes: Decimal = Field(
        default=DEFAULT_BREAK_EVEN_QUANTITY_TONNES,
        gt=Decimal("0.00"),
        decimal_places=2,
    )
    break_even_usd_per_tonne: Decimal = Field(
        default=DEFAULT_BREAK_EVEN_USD_PER_TONNE,
        gt=Decimal("0.0000"),
        decimal_places=4,
    )
    notes: Optional[str] = Field(default=None, max_length=2000)
    is_active: bool = True

    @model_validator(mode="after")
    def validate_scope(self) -> "BreakevenSettingBase":
        if self.scope_type == "monthly":
            if self.month is None or self.year is None:
                raise ValueError("month and year are required when scope_type is 'monthly'.")
        else:
            self.month = None
            self.year = None
        return self


class BreakevenSettingCreate(BreakevenSettingBase):
    pass


class BreakevenSettingUpdate(BreakevenSchemaBase):
    setting_name: Optional[str] = Field(default=None, max_length=120)
    description: Optional[str] = Field(default=None, max_length=1000)
    scope_type: Optional[Literal["global", "monthly"]] = None
    month: Optional[int] = Field(default=None, ge=1, le=12)
    year: Optional[int] = Field(default=None, ge=2000, le=9999)
    break_even_quantity_tonnes: Optional[Decimal] = Field(
        default=None,
        gt=Decimal("0.00"),
        decimal_places=2,
    )
    break_even_usd_per_tonne: Optional[Decimal] = Field(
        default=None,
        gt=Decimal("0.0000"),
        decimal_places=4,
    )
    notes: Optional[str] = Field(default=None, max_length=2000)
    is_active: Optional[bool] = None

    @model_validator(mode="after")
    def validate_scope(self) -> "BreakevenSettingUpdate":
        if self.scope_type == "monthly":
            if self.month is None or self.year is None:
                raise ValueError("month and year are required when scope_type is 'monthly'.")
        if self.scope_type == "global":
            self.month = None
            self.year = None
        return self


class BreakevenSettingRead(BreakevenSchemaBase):
    id: UUID
    setting_name: str
    description: Optional[str] = None
    scope_type: Literal["global", "monthly"]
    month: Optional[int] = None
    year: Optional[int] = None
    break_even_quantity_tonnes: Decimal
    break_even_usd_per_tonne: Decimal
    break_even_value_usd: Decimal
    notes: Optional[str] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime


# =============================================================================
# Report request / response schemas
# =============================================================================
class BreakevenSummaryReportRequest(BreakevenSchemaBase):
    report_type: Literal["breakeven_summary"] = "breakeven_summary"
    report_date: Optional[date] = None
    month: Optional[int] = Field(default=None, ge=1, le=12)
    year: Optional[int] = Field(default=None, ge=2000, le=9999)

    setting_id: Optional[UUID] = None

    order_type: Optional[str] = None
    order_profile: Optional[str] = None
    order_subtype: Optional[str] = None
    enterprise_name: Optional[str] = None
    jurisdiction: Optional[str] = None

    prepared_by: Optional[str] = None
    include_rows: bool = True

    @model_validator(mode="after")
    def validate_period(self) -> "BreakevenSummaryReportRequest":
        if (self.month is None) != (self.year is None):
            raise ValueError("month and year must be provided together.")
        return self


class BreakevenSummaryRow(BreakevenSchemaBase):
    index: int
    metric: str

    quantity_tonnes: Optional[Decimal] = None
    usd_total: Optional[Decimal] = None
    percentage: Optional[Decimal] = None

    quantity_display: Optional[str] = None
    usd_display: Optional[str] = None
    percentage_display: Optional[str] = None


class BreakevenSummaryTotals(BreakevenSchemaBase):
    break_even_quantity_tonnes: Decimal = DECIMAL_ZERO_2
    break_even_value_usd: Decimal = DECIMAL_ZERO_2

    total_booked_quantity_tonnes: Decimal = DECIMAL_ZERO_2
    total_booked_value_usd: Decimal = DECIMAL_ZERO_2

    total_delivered_quantity_tonnes: Decimal = DECIMAL_ZERO_2
    total_delivered_value_usd: Decimal = DECIMAL_ZERO_2

    booked_vs_break_even_percentage: Decimal = DECIMAL_ZERO_2
    delivered_vs_break_even_percentage: Decimal = DECIMAL_ZERO_2


class BreakevenSummaryReportData(BreakevenSchemaBase):
    report_type: Literal["breakeven_summary"] = "breakeven_summary"
    title: str = "BREAKEVEN SUMMARY REPORT"
    organization_name: str = "Union Meat Group"
    prepared_by: Optional[str] = None
    generated_at: datetime

    report_date: Optional[date] = None
    month: Optional[int] = None
    year: Optional[int] = None

    filters_order_type: Optional[str] = None
    filters_order_profile: Optional[str] = None
    filters_order_subtype: Optional[str] = None
    filters_enterprise_name: Optional[str] = None
    filters_jurisdiction: Optional[str] = None

    setting: Optional[BreakevenSettingRead] = None
    totals: BreakevenSummaryTotals
    rows: List[BreakevenSummaryRow] = Field(default_factory=list)