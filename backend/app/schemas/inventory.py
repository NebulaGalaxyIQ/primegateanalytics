from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.models.inventory import (
    ConsumableStoreName,
    ProductBalanceUnit,
    ProductStoreName,
)

InventoryReportType = Literal["daily", "weekly"]
InventoryExportFormat = Literal["pdf", "csv", "docx"]
InventoryDailyRowSource = Literal["saved", "generated"]


def clean_text(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = " ".join(str(value).strip().split())
    return cleaned or None


def clean_initials(value: str | None) -> str | None:
    cleaned = clean_text(value)
    return cleaned.upper()[:20] if cleaned else None


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
# MASTER / LOOKUP SCHEMAS
# =============================================================================

class InventoryProductCategoryBase(BaseSchema):
    name: str = Field(..., min_length=1, max_length=150)
    description: str | None = None
    is_active: bool = True
    sort_order: int = Field(default=0, ge=0)

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        cleaned = clean_text(value)
        if not cleaned:
            raise ValueError("Product category name is required.")
        return cleaned

    @field_validator("description")
    @classmethod
    def validate_description(cls, value: str | None) -> str | None:
        return clean_text(value)


class InventoryProductCategoryCreate(InventoryProductCategoryBase):
    pass


class InventoryProductCategoryUpdate(BaseSchema):
    name: str | None = Field(default=None, min_length=1, max_length=150)
    description: str | None = None
    is_active: bool | None = None
    sort_order: int | None = Field(default=None, ge=0)

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str | None) -> str | None:
        return clean_text(value)

    @field_validator("description")
    @classmethod
    def validate_description(cls, value: str | None) -> str | None:
        return clean_text(value)


class InventoryProductCategoryRead(InventoryProductCategoryBase):
    id: str
    created_at: datetime
    updated_at: datetime


class InventoryProductBase(BaseSchema):
    category_id: str
    name: str = Field(..., min_length=1, max_length=200)
    default_stock_unit: ProductBalanceUnit = ProductBalanceUnit.KG
    description: str | None = None
    is_active: bool = True
    sort_order: int = Field(default=0, ge=0)

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        cleaned = clean_text(value)
        if not cleaned:
            raise ValueError("Product name is required.")
        return cleaned

    @field_validator("description")
    @classmethod
    def validate_description(cls, value: str | None) -> str | None:
        return clean_text(value)


class InventoryProductCreate(InventoryProductBase):
    pass


class InventoryProductUpdate(BaseSchema):
    category_id: str | None = None
    name: str | None = Field(default=None, min_length=1, max_length=200)
    default_stock_unit: ProductBalanceUnit | None = None
    description: str | None = None
    is_active: bool | None = None
    sort_order: int | None = Field(default=None, ge=0)

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str | None) -> str | None:
        return clean_text(value)

    @field_validator("description")
    @classmethod
    def validate_description(cls, value: str | None) -> str | None:
        return clean_text(value)


class InventoryProductRead(InventoryProductBase):
    id: str
    created_at: datetime
    updated_at: datetime
    category_name: str | None = None


class InventoryProductCategoryWithProducts(InventoryProductCategoryRead):
    products: list[InventoryProductRead] = Field(default_factory=list)


class InventoryConsumableCategoryBase(BaseSchema):
    name: str = Field(..., min_length=1, max_length=150)
    description: str | None = None
    is_active: bool = True
    sort_order: int = Field(default=0, ge=0)

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        cleaned = clean_text(value)
        if not cleaned:
            raise ValueError("Consumable category name is required.")
        return cleaned

    @field_validator("description")
    @classmethod
    def validate_description(cls, value: str | None) -> str | None:
        return clean_text(value)


class InventoryConsumableCategoryCreate(InventoryConsumableCategoryBase):
    pass


class InventoryConsumableCategoryUpdate(BaseSchema):
    name: str | None = Field(default=None, min_length=1, max_length=150)
    description: str | None = None
    is_active: bool | None = None
    sort_order: int | None = Field(default=None, ge=0)

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str | None) -> str | None:
        return clean_text(value)

    @field_validator("description")
    @classmethod
    def validate_description(cls, value: str | None) -> str | None:
        return clean_text(value)


class InventoryConsumableCategoryRead(InventoryConsumableCategoryBase):
    id: str
    created_at: datetime
    updated_at: datetime


class InventoryConsumableItemBase(BaseSchema):
    category_id: str
    name: str = Field(..., min_length=1, max_length=200)
    default_unit: str = Field(..., min_length=1, max_length=50)
    description: str | None = None
    is_active: bool = True
    sort_order: int = Field(default=0, ge=0)

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        cleaned = clean_text(value)
        if not cleaned:
            raise ValueError("Consumable item name is required.")
        return cleaned

    @field_validator("default_unit")
    @classmethod
    def validate_default_unit(cls, value: str) -> str:
        cleaned = clean_text(value)
        if not cleaned:
            raise ValueError("Default unit is required.")
        return cleaned

    @field_validator("description")
    @classmethod
    def validate_description(cls, value: str | None) -> str | None:
        return clean_text(value)


class InventoryConsumableItemCreate(InventoryConsumableItemBase):
    pass


class InventoryConsumableItemUpdate(BaseSchema):
    category_id: str | None = None
    name: str | None = Field(default=None, min_length=1, max_length=200)
    default_unit: str | None = Field(default=None, min_length=1, max_length=50)
    description: str | None = None
    is_active: bool | None = None
    sort_order: int | None = Field(default=None, ge=0)

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str | None) -> str | None:
        return clean_text(value)

    @field_validator("default_unit")
    @classmethod
    def validate_default_unit(cls, value: str | None) -> str | None:
        return clean_text(value)

    @field_validator("description")
    @classmethod
    def validate_description(cls, value: str | None) -> str | None:
        return clean_text(value)


class InventoryConsumableItemRead(InventoryConsumableItemBase):
    id: str
    created_at: datetime
    updated_at: datetime
    category_name: str | None = None


class InventoryConsumableCategoryWithItems(InventoryConsumableCategoryRead):
    items: list[InventoryConsumableItemRead] = Field(default_factory=list)


# =============================================================================
# PRODUCT STORE INVENTORY SCHEMAS
# =============================================================================

class ProductStoreInventoryBase(BaseSchema):
    entry_date: date
    store: ProductStoreName
    product_category_id: str | None = None
    product_id: str
    balance_unit: ProductBalanceUnit | None = None

    opening_balance: Decimal | None = Field(default=None, ge=0, decimal_places=2, max_digits=14)
    inflow_production: Decimal = Field(default=Decimal("0.00"), ge=0, decimal_places=2, max_digits=14)
    inflow_transfers_in: Decimal = Field(default=Decimal("0.00"), ge=0, decimal_places=2, max_digits=14)
    outflow_dispatch: Decimal = Field(default=Decimal("0.00"), ge=0, decimal_places=2, max_digits=14)
    outflow_transfers_out: Decimal = Field(default=Decimal("0.00"), ge=0, decimal_places=2, max_digits=14)

    total_boxes: int = Field(default=0, ge=0)
    total_pieces: int = Field(default=0, ge=0)

    remarks: str | None = None
    checked_by_initials: str | None = None

    @field_validator("remarks")
    @classmethod
    def validate_remarks(cls, value: str | None) -> str | None:
        return clean_text(value)

    @field_validator("checked_by_initials")
    @classmethod
    def validate_checked_by(cls, value: str | None) -> str | None:
        return clean_initials(value)


class ProductStoreInventoryCreate(ProductStoreInventoryBase):
    serial_no: int | None = Field(default=None, ge=0)
    overwrite_opening_balance: bool = False


class ProductStoreInventoryUpdate(BaseSchema):
    entry_date: date | None = None
    store: ProductStoreName | None = None
    product_category_id: str | None = None
    product_id: str | None = None
    balance_unit: ProductBalanceUnit | None = None

    opening_balance: Decimal | None = Field(default=None, ge=0, decimal_places=2, max_digits=14)
    inflow_production: Decimal | None = Field(default=None, ge=0, decimal_places=2, max_digits=14)
    inflow_transfers_in: Decimal | None = Field(default=None, ge=0, decimal_places=2, max_digits=14)
    outflow_dispatch: Decimal | None = Field(default=None, ge=0, decimal_places=2, max_digits=14)
    outflow_transfers_out: Decimal | None = Field(default=None, ge=0, decimal_places=2, max_digits=14)

    total_boxes: int | None = Field(default=None, ge=0)
    total_pieces: int | None = Field(default=None, ge=0)

    remarks: str | None = None
    checked_by_initials: str | None = None
    overwrite_opening_balance: bool = False

    @field_validator("remarks")
    @classmethod
    def validate_remarks(cls, value: str | None) -> str | None:
        return clean_text(value)

    @field_validator("checked_by_initials")
    @classmethod
    def validate_checked_by(cls, value: str | None) -> str | None:
        return clean_initials(value)


class ProductStoreInventoryRead(BaseSchema):
    id: str
    serial_no: int | None = None
    entry_date: date
    store: ProductStoreName

    product_category_id: str
    product_id: str
    product_category_name: str
    product_name: str
    balance_unit: ProductBalanceUnit

    opening_balance: Decimal
    inflow_production: Decimal
    inflow_transfers_in: Decimal
    outflow_dispatch: Decimal
    outflow_transfers_out: Decimal
    total_boxes: int
    total_pieces: int
    closing_balance: Decimal

    remarks: str | None = None
    checked_by_initials: str | None = None

    created_by: str | None = None
    updated_by: str | None = None
    created_at: datetime
    updated_at: datetime

    week_start_date: date | None = None
    week_end_date: date | None = None
    net_movement: Decimal | None = None


class ProductStoreInventoryListResponse(PaginatedResponseBase):
    items: list[ProductStoreInventoryRead] = Field(default_factory=list)


# =============================================================================
# CONSUMABLE STORE INVENTORY SCHEMAS
# =============================================================================

class ConsumableStoreInventoryBase(BaseSchema):
    entry_date: date
    store: ConsumableStoreName
    item_category_id: str | None = None
    item_id: str
    unit: str | None = Field(default=None, min_length=1, max_length=50)

    opening_balance: Decimal | None = Field(default=None, ge=0, decimal_places=2, max_digits=14)
    issued_today: Decimal = Field(default=Decimal("0.00"), ge=0, decimal_places=2, max_digits=14)

    remarks: str | None = None
    checked_by_initials: str | None = None

    @field_validator("unit")
    @classmethod
    def validate_unit(cls, value: str | None) -> str | None:
        return clean_text(value)

    @field_validator("remarks")
    @classmethod
    def validate_remarks(cls, value: str | None) -> str | None:
        return clean_text(value)

    @field_validator("checked_by_initials")
    @classmethod
    def validate_checked_by(cls, value: str | None) -> str | None:
        return clean_initials(value)


class ConsumableStoreInventoryCreate(ConsumableStoreInventoryBase):
    serial_no: int | None = Field(default=None, ge=0)
    overwrite_opening_balance: bool = False


class ConsumableStoreInventoryUpdate(BaseSchema):
    entry_date: date | None = None
    store: ConsumableStoreName | None = None
    item_category_id: str | None = None
    item_id: str | None = None
    unit: str | None = Field(default=None, min_length=1, max_length=50)

    opening_balance: Decimal | None = Field(default=None, ge=0, decimal_places=2, max_digits=14)
    issued_today: Decimal | None = Field(default=None, ge=0, decimal_places=2, max_digits=14)

    remarks: str | None = None
    checked_by_initials: str | None = None
    overwrite_opening_balance: bool = False

    @field_validator("unit")
    @classmethod
    def validate_unit(cls, value: str | None) -> str | None:
        return clean_text(value)

    @field_validator("remarks")
    @classmethod
    def validate_remarks(cls, value: str | None) -> str | None:
        return clean_text(value)

    @field_validator("checked_by_initials")
    @classmethod
    def validate_checked_by(cls, value: str | None) -> str | None:
        return clean_initials(value)


class ConsumableStoreInventoryRead(BaseSchema):
    id: str
    serial_no: int | None = None
    entry_date: date
    store: ConsumableStoreName

    item_category_id: str
    item_id: str
    item_category_name: str
    item_name: str
    unit: str

    opening_balance: Decimal
    issued_today: Decimal
    closing_balance: Decimal

    remarks: str | None = None
    checked_by_initials: str | None = None

    created_by: str | None = None
    updated_by: str | None = None
    created_at: datetime
    updated_at: datetime

    week_start_date: date | None = None
    week_end_date: date | None = None


class ConsumableStoreInventoryListResponse(PaginatedResponseBase):
    items: list[ConsumableStoreInventoryRead] = Field(default_factory=list)


# =============================================================================
# DAILY SHEET SCHEMAS
# =============================================================================

class ProductDailySheetRow(BaseSchema):
    id: str | None = None
    entry_id: str | None = None
    serial_no: int | None = None
    entry_date: date
    store: ProductStoreName

    product_category_id: str | None = None
    product_id: str
    product_category_name: str | None = None
    product_name: str | None = None
    balance_unit: ProductBalanceUnit | None = None

    opening_balance: Decimal = Decimal("0.00")
    inflow_production: Decimal = Decimal("0.00")
    inflow_transfers_in: Decimal = Decimal("0.00")
    outflow_dispatch: Decimal = Decimal("0.00")
    outflow_transfers_out: Decimal = Decimal("0.00")
    total_boxes: int = 0
    total_pieces: int = 0
    closing_balance: Decimal = Decimal("0.00")

    remarks: str | None = None
    checked_by_initials: str | None = None

    created_by: str | None = None
    updated_by: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None

    week_start_date: date | None = None
    week_end_date: date | None = None
    net_movement: Decimal | None = None

    is_existing: bool = False
    source: InventoryDailyRowSource = "generated"

    @field_validator("remarks")
    @classmethod
    def validate_remarks(cls, value: str | None) -> str | None:
        return clean_text(value)

    @field_validator("checked_by_initials")
    @classmethod
    def validate_checked_by(cls, value: str | None) -> str | None:
        return clean_initials(value)


class ProductDailySheetResponse(BaseSchema):
    entry_date: date
    store: ProductStoreName
    total_rows: int = Field(default=0, ge=0)
    saved_rows: int = Field(default=0, ge=0)
    generated_rows: int = Field(default=0, ge=0)
    has_saved_rows: bool = False
    rows: list[ProductDailySheetRow] = Field(default_factory=list)


class ConsumableDailySheetRow(BaseSchema):
    id: str | None = None
    entry_id: str | None = None
    serial_no: int | None = None
    entry_date: date
    store: ConsumableStoreName

    item_category_id: str | None = None
    item_id: str
    item_category_name: str | None = None
    item_name: str | None = None
    unit: str | None = None

    opening_balance: Decimal = Decimal("0.00")
    issued_today: Decimal = Decimal("0.00")
    closing_balance: Decimal = Decimal("0.00")

    remarks: str | None = None
    checked_by_initials: str | None = None

    created_by: str | None = None
    updated_by: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None

    week_start_date: date | None = None
    week_end_date: date | None = None

    is_existing: bool = False
    source: InventoryDailyRowSource = "generated"

    @field_validator("unit")
    @classmethod
    def validate_unit(cls, value: str | None) -> str | None:
        return clean_text(value)

    @field_validator("remarks")
    @classmethod
    def validate_remarks(cls, value: str | None) -> str | None:
        return clean_text(value)

    @field_validator("checked_by_initials")
    @classmethod
    def validate_checked_by(cls, value: str | None) -> str | None:
        return clean_initials(value)


class ConsumableDailySheetResponse(BaseSchema):
    entry_date: date
    store: ConsumableStoreName
    total_rows: int = Field(default=0, ge=0)
    saved_rows: int = Field(default=0, ge=0)
    generated_rows: int = Field(default=0, ge=0)
    has_saved_rows: bool = False
    rows: list[ConsumableDailySheetRow] = Field(default_factory=list)


# =============================================================================
# BULK UPSERT SCHEMAS
# =============================================================================

class ProductInventoryBulkRow(BaseSchema):
    serial_no: int | None = Field(default=None, ge=0)
    product_category_id: str | None = None
    product_id: str
    balance_unit: ProductBalanceUnit | None = None

    opening_balance: Decimal | None = Field(default=None, ge=0, decimal_places=2, max_digits=14)
    inflow_production: Decimal = Field(default=Decimal("0.00"), ge=0, decimal_places=2, max_digits=14)
    inflow_transfers_in: Decimal = Field(default=Decimal("0.00"), ge=0, decimal_places=2, max_digits=14)
    outflow_dispatch: Decimal = Field(default=Decimal("0.00"), ge=0, decimal_places=2, max_digits=14)
    outflow_transfers_out: Decimal = Field(default=Decimal("0.00"), ge=0, decimal_places=2, max_digits=14)

    total_boxes: int = Field(default=0, ge=0)
    total_pieces: int = Field(default=0, ge=0)

    remarks: str | None = None
    checked_by_initials: str | None = None
    overwrite_opening_balance: bool = False

    @field_validator("remarks")
    @classmethod
    def validate_remarks(cls, value: str | None) -> str | None:
        return clean_text(value)

    @field_validator("checked_by_initials")
    @classmethod
    def validate_checked_by(cls, value: str | None) -> str | None:
        return clean_initials(value)


class ProductInventoryBulkUpsertRequest(BaseSchema):
    entry_date: date
    store: ProductStoreName
    rows: list[ProductInventoryBulkRow] = Field(default_factory=list, min_length=1)


class ProductInventoryBulkUpsertResponse(BaseSchema):
    entry_date: date
    store: ProductStoreName
    total_rows: int = Field(default=0, ge=0)
    created_count: int = Field(default=0, ge=0)
    updated_count: int = Field(default=0, ge=0)
    items: list[ProductStoreInventoryRead] = Field(default_factory=list)


class ConsumableInventoryBulkRow(BaseSchema):
    serial_no: int | None = Field(default=None, ge=0)
    item_category_id: str | None = None
    item_id: str
    unit: str | None = Field(default=None, min_length=1, max_length=50)

    opening_balance: Decimal | None = Field(default=None, ge=0, decimal_places=2, max_digits=14)
    issued_today: Decimal = Field(default=Decimal("0.00"), ge=0, decimal_places=2, max_digits=14)

    remarks: str | None = None
    checked_by_initials: str | None = None
    overwrite_opening_balance: bool = False

    @field_validator("unit")
    @classmethod
    def validate_unit(cls, value: str | None) -> str | None:
        return clean_text(value)

    @field_validator("remarks")
    @classmethod
    def validate_remarks(cls, value: str | None) -> str | None:
        return clean_text(value)

    @field_validator("checked_by_initials")
    @classmethod
    def validate_checked_by(cls, value: str | None) -> str | None:
        return clean_initials(value)


class ConsumableInventoryBulkUpsertRequest(BaseSchema):
    entry_date: date
    store: ConsumableStoreName
    rows: list[ConsumableInventoryBulkRow] = Field(default_factory=list, min_length=1)


class ConsumableInventoryBulkUpsertResponse(BaseSchema):
    entry_date: date
    store: ConsumableStoreName
    total_rows: int = Field(default=0, ge=0)
    created_count: int = Field(default=0, ge=0)
    updated_count: int = Field(default=0, ge=0)
    items: list[ConsumableStoreInventoryRead] = Field(default_factory=list)


# =============================================================================
# FILTER SCHEMAS
# =============================================================================

class ProductStoreInventoryFilter(BaseSchema):
    start_date: date | None = None
    end_date: date | None = None
    store: ProductStoreName | None = None
    product_category_id: str | None = None
    product_id: str | None = None
    balance_unit: ProductBalanceUnit | None = None
    checked_by_initials: str | None = None
    search: str | None = None
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=500)

    @field_validator("checked_by_initials")
    @classmethod
    def validate_checked_by(cls, value: str | None) -> str | None:
        return clean_initials(value)

    @field_validator("search")
    @classmethod
    def validate_search(cls, value: str | None) -> str | None:
        return clean_text(value)

    @model_validator(mode="after")
    def validate_dates(self):
        if self.start_date and self.end_date and self.end_date < self.start_date:
            raise ValueError("end_date cannot be earlier than start_date.")
        return self


class ConsumableStoreInventoryFilter(BaseSchema):
    start_date: date | None = None
    end_date: date | None = None
    store: ConsumableStoreName | None = None
    item_category_id: str | None = None
    item_id: str | None = None
    unit: str | None = None
    checked_by_initials: str | None = None
    search: str | None = None
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=500)

    @field_validator("unit")
    @classmethod
    def validate_unit(cls, value: str | None) -> str | None:
        return clean_text(value)

    @field_validator("checked_by_initials")
    @classmethod
    def validate_checked_by(cls, value: str | None) -> str | None:
        return clean_initials(value)

    @field_validator("search")
    @classmethod
    def validate_search(cls, value: str | None) -> str | None:
        return clean_text(value)

    @model_validator(mode="after")
    def validate_dates(self):
        if self.start_date and self.end_date and self.end_date < self.start_date:
            raise ValueError("end_date cannot be earlier than start_date.")
        return self


# =============================================================================
# REPORT / EXPORT REQUEST SCHEMAS
# =============================================================================

class ProductInventoryReportRequest(BaseSchema):
    start_date: date
    end_date: date
    report_type: InventoryReportType = "daily"
    export_format: InventoryExportFormat | None = None

    store: ProductStoreName | None = None
    product_category_id: str | None = None
    product_id: str | None = None
    balance_unit: ProductBalanceUnit | None = None
    checked_by_initials: str | None = None

    include_rows: bool = True
    include_totals: bool = True
    include_summary: bool = True

    @field_validator("checked_by_initials")
    @classmethod
    def validate_checked_by(cls, value: str | None) -> str | None:
        return clean_initials(value)

    @model_validator(mode="after")
    def validate_dates(self):
        if self.end_date < self.start_date:
            raise ValueError("end_date cannot be earlier than start_date.")
        return self


class ConsumableInventoryReportRequest(BaseSchema):
    start_date: date
    end_date: date
    report_type: InventoryReportType = "daily"
    export_format: InventoryExportFormat | None = None

    store: ConsumableStoreName | None = None
    item_category_id: str | None = None
    item_id: str | None = None
    unit: str | None = None
    checked_by_initials: str | None = None

    include_rows: bool = True
    include_totals: bool = True
    include_summary: bool = True

    @field_validator("unit")
    @classmethod
    def validate_unit(cls, value: str | None) -> str | None:
        return clean_text(value)

    @field_validator("checked_by_initials")
    @classmethod
    def validate_checked_by(cls, value: str | None) -> str | None:
        return clean_initials(value)

    @model_validator(mode="after")
    def validate_dates(self):
        if self.end_date < self.start_date:
            raise ValueError("end_date cannot be earlier than start_date.")
        return self


# =============================================================================
# PRODUCT REPORT RESPONSE SCHEMAS
# =============================================================================

class ProductInventoryReportRow(BaseSchema):
    serial_no: int | None = None
    entry_date: date
    store: ProductStoreName
    product_category_name: str
    product_name: str
    balance_unit: ProductBalanceUnit

    opening_balance: Decimal
    inflow_production: Decimal
    inflow_transfers_in: Decimal
    outflow_dispatch: Decimal
    outflow_transfers_out: Decimal
    total_boxes: int
    total_pieces: int
    closing_balance: Decimal

    remarks: str | None = None
    checked_by_initials: str | None = None


class ProductInventoryReportSummary(BaseSchema):
    opening_balance: Decimal = Decimal("0.00")
    inflow_production: Decimal = Decimal("0.00")
    inflow_transfers_in: Decimal = Decimal("0.00")
    outflow_dispatch: Decimal = Decimal("0.00")
    outflow_transfers_out: Decimal = Decimal("0.00")
    total_boxes: int = 0
    total_pieces: int = 0
    closing_balance: Decimal = Decimal("0.00")


class ProductInventoryReportGroup(BaseSchema):
    label: str
    start_date: date
    end_date: date
    rows: list[ProductInventoryReportRow] = Field(default_factory=list)
    summary: ProductInventoryReportSummary = Field(default_factory=ProductInventoryReportSummary)


class ProductInventoryReportResponse(BaseSchema):
    report_type: InventoryReportType
    export_format: InventoryExportFormat | None = None
    generated_at: datetime

    start_date: date
    end_date: date
    store: ProductStoreName | None = None
    product_category_id: str | None = None
    product_id: str | None = None
    balance_unit: ProductBalanceUnit | None = None

    groups: list[ProductInventoryReportGroup] = Field(default_factory=list)
    grand_totals: ProductInventoryReportSummary = Field(default_factory=ProductInventoryReportSummary)


# =============================================================================
# CONSUMABLE REPORT RESPONSE SCHEMAS
# =============================================================================

class ConsumableInventoryReportRow(BaseSchema):
    serial_no: int | None = None
    entry_date: date
    store: ConsumableStoreName
    item_category_name: str
    item_name: str
    unit: str

    opening_balance: Decimal
    issued_today: Decimal
    closing_balance: Decimal

    remarks: str | None = None
    checked_by_initials: str | None = None


class ConsumableInventoryReportSummary(BaseSchema):
    opening_balance: Decimal = Decimal("0.00")
    issued_today: Decimal = Decimal("0.00")
    closing_balance: Decimal = Decimal("0.00")


class ConsumableInventoryReportGroup(BaseSchema):
    label: str
    start_date: date
    end_date: date
    rows: list[ConsumableInventoryReportRow] = Field(default_factory=list)
    summary: ConsumableInventoryReportSummary = Field(default_factory=ConsumableInventoryReportSummary)


class ConsumableInventoryReportResponse(BaseSchema):
    report_type: InventoryReportType
    export_format: InventoryExportFormat | None = None
    generated_at: datetime

    start_date: date
    end_date: date
    store: ConsumableStoreName | None = None
    item_category_id: str | None = None
    item_id: str | None = None
    unit: str | None = None

    groups: list[ConsumableInventoryReportGroup] = Field(default_factory=list)
    grand_totals: ConsumableInventoryReportSummary = Field(default_factory=ConsumableInventoryReportSummary)


# =============================================================================
# OPENING BALANCE PREVIEW SCHEMAS
# =============================================================================

class ProductOpeningBalancePreviewResponse(BaseSchema):
    entry_date: date
    store: ProductStoreName
    product_id: str
    opening_balance: Decimal


class ConsumableOpeningBalancePreviewResponse(BaseSchema):
    entry_date: date
    store: ConsumableStoreName
    item_id: str
    opening_balance: Decimal


# =============================================================================
# OPTIONS / BOOTSTRAP / EXPORT FILE RESPONSE
# =============================================================================

class InventoryOptionSchema(BaseSchema):
    id: str
    name: str


class InventoryStoreOptionSchema(BaseSchema):
    value: str
    label: str


class InventoryBootstrapResponse(BaseSchema):
    product_stores: list[InventoryStoreOptionSchema] = Field(default_factory=list)
    consumable_stores: list[InventoryStoreOptionSchema] = Field(default_factory=list)
    product_categories: list[InventoryProductCategoryRead] = Field(default_factory=list)
    products: list[InventoryProductRead] = Field(default_factory=list)
    consumable_categories: list[InventoryConsumableCategoryRead] = Field(default_factory=list)
    consumable_items: list[InventoryConsumableItemRead] = Field(default_factory=list)


class InventoryExportFileResponse(BaseSchema):
    filename: str
    content_type: str
    report_type: InventoryReportType
    export_format: InventoryExportFormat
    generated_at: datetime