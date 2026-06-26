"""
Dynamic Ranch Inventory Models
==============================

One unified inventory engine for ranch management departments:
- Crops Department
- Animals Department
- Machineries & Maintenance

Design principle:
Users enter INPUT values only. The system owns OUTPUT calculations through
inventory templates and calculation rules. This keeps the system simple,
consistent, auditable, and report-ready.

Place this file at:
backend/app/models/dynamic_inventory.py
"""

from __future__ import annotations

import enum

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    Date,
    DateTime,
    Enum as SAEnum,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.ext.mutable import MutableDict, MutableList
from sqlalchemy.orm import relationship
from typing import Any, Dict, List, Optional
from sqlalchemy.dialects.postgresql import JSONB

try:
    from app.core.database import Base
except Exception:  # pragma: no cover - project import fallback
    try:
        from app.core.database import Base
    except Exception:  # pragma: no cover - project import fallback
        from app.core.database import Base

# -----------------------------------------------------------------------------
# Enum helpers
# -----------------------------------------------------------------------------


class ValueEnum(str, enum.Enum):
    """String enum whose API value is friendly lowercase/snake_case.

    Important for PostgreSQL enum compatibility:
    SQLAlchemy stores enum MEMBER NAMES by default, e.g. ANIMALS, ACTIVE,
    FORMULA. The public API can still expose .value, e.g. "animals".
    """

    def __str__(self) -> str:
        return self.value


# -----------------------------------------------------------------------------
# Ranch departments and module types
# -----------------------------------------------------------------------------


class RanchDepartment(ValueEnum):
    CROPS = "crops"
    ANIMALS = "animals"
    MACHINERY = "machinery"


class InventoryTemplateType(ValueEnum):
    # Animals
    GOAT_INVENTORY = "goat_inventory"
    CATTLE_INVENTORY = "cattle_inventory"
    SHEEP_INVENTORY = "sheep_inventory"
    POULTRY_INVENTORY = "poultry_inventory"
    ANIMAL_MOVEMENT = "animal_movement"
    ANIMAL_BIRTHS = "animal_births"
    ANIMAL_DEATHS = "animal_deaths"
    ANIMAL_SALES = "animal_sales"
    ANIMAL_PURCHASES = "animal_purchases"
    FEED_INVENTORY = "feed_inventory"
    VACCINATION_RECORDS = "vaccination_records"
    TREATMENT_RECORDS = "treatment_records"
    MILK_PRODUCTION = "milk_production"
    EGG_PRODUCTION = "egg_production"

    # Crops
    CROP_STOCK = "crop_stock"
    CROP_PLANTING = "crop_planting"
    HARVEST_RECORDS = "harvest_records"
    SEEDS_INVENTORY = "seeds_inventory"
    FERTILIZER_INVENTORY = "fertilizer_inventory"
    CHEMICAL_INVENTORY = "chemical_inventory"
    IRRIGATION_RECORDS = "irrigation_records"
    CROP_SALES = "crop_sales"
    STORAGE_STOCK = "storage_stock"
    FIELD_RECORDS = "field_records"
    CROP_PRODUCTION_COST = "crop_production_cost"

    # Machinery and maintenance
    MACHINERY_REGISTER = "machinery_register"
    FUEL_USAGE = "fuel_usage"
    SERVICE_RECORDS = "service_records"
    REPAIR_RECORDS = "repair_records"
    SPARE_PARTS_INVENTORY = "spare_parts_inventory"
    MAINTENANCE_SCHEDULE = "maintenance_schedule"
    BREAKDOWN_RECORDS = "breakdown_records"
    OIL_CHANGE_RECORDS = "oil_change_records"
    TYRE_RECORDS = "tyre_records"
    OPERATOR_RECORDS = "operator_records"
    MACHINE_RUNNING_HOURS = "machine_running_hours"

    # Custom/admin-controlled extension point
    CUSTOM = "custom"


class InventoryLookupGroup(ValueEnum):
    ANIMAL_TYPE = "animal_type"
    ANIMAL_BREED = "animal_breed"
    ANIMAL_CATEGORY = "animal_category"
    CROP_TYPE = "crop_type"
    CROP_VARIETY = "crop_variety"
    FIELD_OR_PLOT = "field_or_plot"
    MACHINE_TYPE = "machine_type"
    MACHINE_NAME = "machine_name"
    FEED_TYPE = "feed_type"
    FERTILIZER_TYPE = "fertilizer_type"
    CHEMICAL_TYPE = "chemical_type"
    SEED_TYPE = "seed_type"
    SUPPLIER = "supplier"
    CUSTOMER = "customer"
    OPERATOR = "operator"
    TECHNICIAN = "technician"
    UNIT = "unit"
    LOCATION = "location"
    OTHER = "other"


class InventoryAccessType(ValueEnum):
    ADMIN_ONLY = "admin_only"
    ASSIGNED_USERS = "assigned_users"
    INVENTORY_CREDENTIALS = "inventory_credentials"
    MIXED = "mixed"


class InventoryStatus(ValueEnum):
    DRAFT = "draft"
    ACTIVE = "active"
    INACTIVE = "inactive"
    ARCHIVED = "archived"
    DELETED = "deleted"


# -----------------------------------------------------------------------------
# Fields, values, calculations, reports
# -----------------------------------------------------------------------------


class InventoryFieldType(ValueEnum):
    TEXT = "text"
    LONG_TEXT = "long_text"
    NUMBER = "number"
    INTEGER = "integer"
    DECIMAL = "decimal"
    CURRENCY = "currency"
    PERCENTAGE = "percentage"
    DATE = "date"
    DATETIME = "datetime"
    BOOLEAN = "boolean"
    DROPDOWN = "dropdown"
    MULTI_SELECT = "multi_select"
    FILE = "file"
    IMAGE = "image"
    SYSTEM_CALCULATED = "system_calculated"
    FORMULA = "formula"  # kept for backward compatibility; system-owned only


class InventoryFieldDirection(ValueEnum):
    INPUT = "input"
    OUTPUT = "output"
    SYSTEM = "system"


class InventoryFieldCategory(ValueEnum):
    GENERAL = "general"
    STOCK = "stock"
    QUANTITY = "quantity"
    COST = "cost"
    SALES = "sales"
    HEALTH = "health"
    PRODUCTION = "production"
    MAINTENANCE = "maintenance"
    REPORTING = "reporting"


class InventoryPeriodType(ValueEnum):
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    YEARLY = "yearly"
    CUSTOM = "custom"


class InventoryPeriodStatus(ValueEnum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    APPROVED = "approved"
    REJECTED = "rejected"
    LOCKED = "locked"
    ARCHIVED = "archived"


class InventoryMetricType(ValueEnum):
    SUM = "sum"
    AVERAGE = "average"
    COUNT = "count"
    MIN = "min"
    MAX = "max"
    RATE = "rate"
    PERCENTAGE = "percentage"
    SYSTEM_CALCULATION = "system_calculation"
    FORMULA = "formula"  # backward compatibility




class InventoryFormulaScope(ValueEnum):
    """Backward-compatible formula scope enum.

    The ranch system no longer asks normal users to write formulas, but schemas
    and older frontend/service code still reference these names. Keeping them
    here prevents import errors and allows safe transition to system-owned
    calculations.
    """

    ROW = "row"
    SUMMARY = "summary"
    REPORT = "report"


class InventoryFormulaApplyMode(ValueEnum):
    """Backward-compatible formula apply mode enum."""

    ALL_ROWS = "all_rows"
    PER_ROW = "per_row"

class InventoryCalculationScope(ValueEnum):
    ROW = "row"
    PERIOD = "period"
    REPORT = "report"
    DASHBOARD = "dashboard"


class InventoryCalculationRuleType(ValueEnum):
    # Animals
    ANIMAL_CURRENT_BALANCE = "animal_current_balance"
    ANIMAL_NET_MOVEMENT = "animal_net_movement"
    ANIMAL_TOTAL_ADDITIONS = "animal_total_additions"
    ANIMAL_TOTAL_REDUCTIONS = "animal_total_reductions"
    ANIMAL_MORTALITY_RATE = "animal_mortality_rate"
    ANIMAL_BIRTH_RATE = "animal_birth_rate"
    ANIMAL_SALES_VALUE = "animal_sales_value"
    FEED_CLOSING_STOCK = "feed_closing_stock"
    FEED_TOTAL_COST = "feed_total_cost"
    FEED_DAYS_REMAINING = "feed_days_remaining"

    # Crops
    CROP_CLOSING_STOCK = "crop_closing_stock"
    CROP_YIELD_PER_ACRE = "crop_yield_per_acre"
    CROP_TOTAL_PRODUCTION_COST = "crop_total_production_cost"
    CROP_ESTIMATED_SALES_VALUE = "crop_estimated_sales_value"
    CROP_PROFIT_LOSS = "crop_profit_loss"
    CROP_COST_PER_UNIT = "crop_cost_per_unit"

    # Machinery
    MACHINE_RUNNING_HOURS = "machine_running_hours"
    FUEL_TOTAL_COST = "fuel_total_cost"
    FUEL_PER_HOUR = "fuel_per_hour"
    SPARE_PARTS_CLOSING_STOCK = "spare_parts_closing_stock"
    SPARE_PARTS_REMAINING_VALUE = "spare_parts_remaining_value"
    MAINTENANCE_TOTAL_COST = "maintenance_total_cost"
    SERVICE_DUE_STATUS = "service_due_status"

    # Generic
    GENERIC_CLOSING_STOCK = "generic_closing_stock"
    GENERIC_TOTAL_COST = "generic_total_cost"
    CUSTOM_SYSTEM_RULE = "custom_system_rule"


class InventoryReportType(ValueEnum):
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    YEARLY = "yearly"
    CUSTOM_RANGE = "custom_range"
    DEPARTMENT_SUMMARY = "department_summary"
    INVENTORY_SUMMARY = "inventory_summary"


class InventoryReportFormat(ValueEnum):
    PDF = "pdf"
    EXCEL = "excel"
    CSV = "csv"
    JSON = "json"


class InventoryReportStatus(ValueEnum):
    GENERATED = "generated"
    LOCKED = "locked"
    ARCHIVED = "archived"
    FAILED = "failed"


class InventoryUserRole(ValueEnum):
    ADMIN = "admin"
    MANAGER = "manager"
    EDITOR = "editor"
    VIEWER = "viewer"
    REPORTER = "reporter"
    APPROVER = "approver"


class InventoryAuditAction(ValueEnum):
    CREATE_INVENTORY = "create_inventory"
    UPDATE_INVENTORY = "update_inventory"
    ARCHIVE_INVENTORY = "archive_inventory"
    RESTORE_INVENTORY = "restore_inventory"
    DELETE_INVENTORY = "delete_inventory"
    CREATE_TEMPLATE = "create_template"
    UPDATE_TEMPLATE = "update_template"
    CREATE_PERIOD = "create_period"
    UPDATE_PERIOD = "update_period"
    SUBMIT_PERIOD = "submit_period"
    APPROVE_PERIOD = "approve_period"
    REJECT_PERIOD = "reject_period"
    LOCK_PERIOD = "lock_period"
    UNLOCK_PERIOD = "unlock_period"
    CREATE_ROW = "create_row"
    UPDATE_ROW = "update_row"
    DELETE_ROW = "delete_row"
    RESTORE_ROW = "restore_row"
    CREATE_FIELD = "create_field"
    UPDATE_FIELD = "update_field"
    ARCHIVE_FIELD = "archive_field"
    CREATE_REPORT = "create_report"
    EXPORT_REPORT = "export_report"
    ASSIGN_USER = "assign_user"
    REMOVE_USER = "remove_user"
    CREATE_CREDENTIAL = "create_credential"
    RESET_CREDENTIAL = "reset_credential"
    SYSTEM_CALCULATION = "system_calculation"


class InventoryAlertLevel(ValueEnum):
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"


class InventoryAlertStatus(ValueEnum):
    OPEN = "open"
    ACKNOWLEDGED = "acknowledged"
    RESOLVED = "resolved"
    DISMISSED = "dismissed"


# -----------------------------------------------------------------------------
# Mixins
# -----------------------------------------------------------------------------


class TimestampMixin:
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class UserTrackingMixin:
    created_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    updated_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)


class SoftDeleteMixin:
    archived_at = Column(DateTime(timezone=True), nullable=True, index=True)
    deleted_at = Column(DateTime(timezone=True), nullable=True, index=True)
    archived_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    deleted_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)


# -----------------------------------------------------------------------------
# Templates
# -----------------------------------------------------------------------------


class DynamicInventoryTemplate(Base, TimestampMixin, UserTrackingMixin):
    """Predefined department templates.

    Examples:
    - Animals / Goat Inventory
    - Crops / Harvest Records
    - Machinery / Fuel Usage

    Templates contain the standard inputs, system outputs, automatic calculation
    rules, metrics, and report layout used when creating a new inventory module.
    """

    __tablename__ = "dynamic_inventory_templates"

    id = Column(Integer, primary_key=True, index=True)
    template_key = Column(String(120), nullable=False, unique=True, index=True)
    name = Column(String(180), nullable=False, index=True)
    description = Column(Text, nullable=True)

    department = Column(SAEnum(RanchDepartment, name="ranchdepartment"), nullable=False, index=True)
    inventory_type = Column(SAEnum(InventoryTemplateType, name="inventorytemplatetype"), nullable=False, index=True)

    is_active = Column(Boolean, nullable=False, default=True, index=True)
    is_system_template = Column(Boolean, nullable=False, default=True)
    version = Column(Integer, nullable=False, default=1)

    # JSON definitions used by services to seed inventories.
    fields_json = Column(MutableList.as_mutable(JSONB), nullable=False, default=list)
    calculation_rules_json = Column(MutableList.as_mutable(JSONB), nullable=False, default=list)
    metrics_json = Column(MutableList.as_mutable(JSONB), nullable=False, default=list)
    report_config_json = Column(MutableDict.as_mutable(JSONB), nullable=False, default=dict)
    dashboard_config_json = Column(MutableDict.as_mutable(JSONB), nullable=False, default=dict)
    settings_json = Column(MutableDict.as_mutable(JSONB), nullable=False, default=dict)

    template_fields = relationship("DynamicInventoryTemplateField", back_populates="template", cascade="all, delete-orphan", order_by="DynamicInventoryTemplateField.order_index")
    template_calculation_rules = relationship("DynamicInventoryTemplateCalculationRule", back_populates="template", cascade="all, delete-orphan", order_by="DynamicInventoryTemplateCalculationRule.order_index")
    template_metrics = relationship("DynamicInventoryTemplateMetric", back_populates="template", cascade="all, delete-orphan", order_by="DynamicInventoryTemplateMetric.order_index")
    inventories = relationship("DynamicInventory", back_populates="template")

    __table_args__ = (
        Index("ix_dynamic_inventory_templates_department_type", "department", "inventory_type"),
    )


class DynamicInventoryTemplateField(Base, TimestampMixin, UserTrackingMixin):
    """Field definition stored under an inventory template.

    These are copied into DynamicInventoryField when an inventory module is
    created from a ranch template.
    """

    __tablename__ = "dynamic_inventory_template_fields"

    id = Column(Integer, primary_key=True, index=True)
    template_id = Column(Integer, ForeignKey("dynamic_inventory_templates.id", ondelete="CASCADE"), nullable=False, index=True)

    field_name = Column(String(180), nullable=False)
    field_key = Column(String(120), nullable=False, index=True)
    field_code = Column(String(20), nullable=True)

    field_type = Column(SAEnum(InventoryFieldType, name="inventoryfieldtype"), nullable=False, index=True)
    field_direction = Column(SAEnum(InventoryFieldDirection, name="inventoryfielddirection"), nullable=False, default=InventoryFieldDirection.INPUT, index=True)
    field_category = Column(SAEnum(InventoryFieldCategory, name="inventoryfieldcategory"), nullable=False, default=InventoryFieldCategory.GENERAL, index=True)
    lookup_group = Column(SAEnum(InventoryLookupGroup, name="inventorylookupgroup"), nullable=True, index=True)

    description = Column(Text, nullable=True)
    placeholder = Column(String(220), nullable=True)
    default_value = Column(Text, nullable=True)
    unit_label = Column(String(40), nullable=True)

    is_required = Column(Boolean, nullable=False, default=False)
    is_unique = Column(Boolean, nullable=False, default=False)
    is_searchable = Column(Boolean, nullable=False, default=False)
    is_filterable = Column(Boolean, nullable=False, default=False)
    is_sortable = Column(Boolean, nullable=False, default=False)
    is_indexed = Column(Boolean, nullable=False, default=False)
    is_report_visible = Column(Boolean, nullable=False, default=True)
    is_dashboard_visible = Column(Boolean, nullable=False, default=False)

    is_system_calculated = Column(Boolean, nullable=False, default=False, index=True)
    is_user_editable = Column(Boolean, nullable=False, default=True)
    calculation_key = Column(String(120), nullable=True, index=True)

    options_json = Column(MutableList.as_mutable(JSONB), nullable=False, default=list)
    validation_json = Column(MutableDict.as_mutable(JSONB), nullable=False, default=dict)
    display_json = Column(MutableDict.as_mutable(JSONB), nullable=False, default=dict)
    settings_json = Column(MutableDict.as_mutable(JSONB), nullable=False, default=dict)

    order_index = Column(Integer, nullable=False, default=0, index=True)
    is_active = Column(Boolean, nullable=False, default=True, index=True)

    template = relationship("DynamicInventoryTemplate", back_populates="template_fields")

    __table_args__ = (
        UniqueConstraint("template_id", "field_key", name="uq_dynamic_inventory_template_field_key"),
        UniqueConstraint("template_id", "field_code", name="uq_dynamic_inventory_template_field_code"),
        Index("ix_dynamic_inventory_template_fields_template_order", "template_id", "order_index"),
    )


class DynamicInventoryTemplateCalculationRule(Base, TimestampMixin, UserTrackingMixin):
    """Calculation rule stored under an inventory template."""

    __tablename__ = "dynamic_inventory_template_calculation_rules"

    id = Column(Integer, primary_key=True, index=True)
    template_id = Column(Integer, ForeignKey("dynamic_inventory_templates.id", ondelete="CASCADE"), nullable=False, index=True)

    rule_key = Column(String(140), nullable=False, index=True)
    rule_name = Column(String(180), nullable=False)
    rule_type = Column(SAEnum(InventoryCalculationRuleType, name="inventorycalculationruletype"), nullable=False, index=True)
    scope = Column(SAEnum(InventoryCalculationScope, name="inventorycalculationscope"), nullable=False, default=InventoryCalculationScope.ROW, index=True)

    inputs_json = Column(MutableDict.as_mutable(JSONB), nullable=False, default=dict)
    outputs_json = Column(MutableDict.as_mutable(JSONB), nullable=False, default=dict)
    expression_label = Column(Text, nullable=True)
    rule_config_json = Column(MutableDict.as_mutable(JSONB), nullable=False, default=dict)

    is_active = Column(Boolean, nullable=False, default=True, index=True)
    run_on_create = Column(Boolean, nullable=False, default=True)
    run_on_update = Column(Boolean, nullable=False, default=True)
    run_before_report = Column(Boolean, nullable=False, default=True)
    order_index = Column(Integer, nullable=False, default=0, index=True)

    template = relationship("DynamicInventoryTemplate", back_populates="template_calculation_rules")

    __table_args__ = (
        UniqueConstraint("template_id", "rule_key", name="uq_dynamic_inventory_template_rule_key"),
        Index("ix_dynamic_inventory_template_rules_template_scope", "template_id", "scope"),
    )


class DynamicInventoryTemplateMetric(Base, TimestampMixin, UserTrackingMixin):
    """Default metric stored under an inventory template."""

    __tablename__ = "dynamic_inventory_template_metrics"

    id = Column(Integer, primary_key=True, index=True)
    template_id = Column(Integer, ForeignKey("dynamic_inventory_templates.id", ondelete="CASCADE"), nullable=False, index=True)

    metric_key = Column(String(140), nullable=False, index=True)
    metric_type = Column(SAEnum(InventoryMetricType, name="inventorymetrictype"), nullable=False, index=True)
    label = Column(String(180), nullable=False)
    field_key = Column(String(120), nullable=True, index=True)
    calculation_rule_key = Column(String(140), nullable=True, index=True)
    unit_label = Column(String(40), nullable=True)

    is_enabled = Column(Boolean, nullable=False, default=True, index=True)
    is_report_visible = Column(Boolean, nullable=False, default=True)
    is_dashboard_visible = Column(Boolean, nullable=False, default=True)
    settings_json = Column(MutableDict.as_mutable(JSONB), nullable=False, default=dict)
    order_index = Column(Integer, nullable=False, default=0, index=True)

    template = relationship("DynamicInventoryTemplate", back_populates="template_metrics")

    __table_args__ = (
        UniqueConstraint("template_id", "metric_key", name="uq_dynamic_inventory_template_metric_key"),
        Index("ix_dynamic_inventory_template_metrics_template_order", "template_id", "order_index"),
    )


# -----------------------------------------------------------------------------
# Main inventory module
# -----------------------------------------------------------------------------


class DynamicInventory(Base, TimestampMixin, UserTrackingMixin, SoftDeleteMixin):
    """One ranch inventory module.

    Examples:
    - Goat Inventory
    - Harvest Records
    - Fuel Usage

    The module belongs to a department and can be created from a template.
    Users fill daily records; the system calculates outputs automatically.
    """

    __tablename__ = "dynamic_inventories"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(180), nullable=False, index=True)
    slug = Column(String(220), nullable=False, unique=True, index=True)
    description = Column(Text, nullable=True)

    department = Column(SAEnum(RanchDepartment, name="ranchdepartment"), nullable=False, index=True)
    inventory_type = Column(SAEnum(InventoryTemplateType, name="inventorytemplatetype"), nullable=False, index=True)
    template_id = Column(Integer, ForeignKey("dynamic_inventory_templates.id", ondelete="SET NULL"), nullable=True, index=True)

    report_title = Column(String(220), nullable=True)
    reporter_name = Column(String(180), nullable=True)
    company_name = Column(String(180), nullable=True)
    logo_url = Column(Text, nullable=True)

    access_type = Column(SAEnum(InventoryAccessType, name="inventoryaccesstype"), nullable=False, default=InventoryAccessType.ASSIGNED_USERS, index=True)
    status = Column(SAEnum(InventoryStatus, name="inventorystatus"), nullable=False, default=InventoryStatus.ACTIVE, index=True)
    is_active = Column(Boolean, nullable=False, default=True, index=True)

    # Date field used for report filtering. If null, period_date is used.
    report_date_field_id = Column(Integer, nullable=True, index=True)

    # System-owned calculation profile. Example: {"balance_mode":"opening_plus_additions_minus_reductions"}
    calculation_profile_json = Column(MutableDict.as_mutable(JSONB), nullable=False, default=dict)

    settings_json = Column(MutableDict.as_mutable(JSONB), nullable=False, default=dict)
    report_config_json = Column(MutableDict.as_mutable(JSONB), nullable=False, default=dict)
    dashboard_config_json = Column(MutableDict.as_mutable(JSONB), nullable=False, default=dict)

    template = relationship("DynamicInventoryTemplate", back_populates="inventories")
    fields = relationship(
        "DynamicInventoryField",
        back_populates="inventory",
        cascade="all, delete-orphan",
        order_by="DynamicInventoryField.order_index",
    )
    calculation_rules = relationship(
        "DynamicInventoryCalculationRule",
        back_populates="inventory",
        cascade="all, delete-orphan",
        order_by="DynamicInventoryCalculationRule.order_index",
    )
    periods = relationship("DynamicInventoryPeriod", back_populates="inventory", cascade="all, delete-orphan")
    rows = relationship("DynamicInventoryRow", back_populates="inventory", cascade="all, delete-orphan")
    values = relationship("DynamicInventoryValue", back_populates="inventory", cascade="all, delete-orphan")
    metrics = relationship(
        "DynamicInventoryMetric",
        back_populates="inventory",
        cascade="all, delete-orphan",
        order_by="DynamicInventoryMetric.order_index",
    )
    reports = relationship("DynamicInventoryReport", back_populates="inventory", cascade="all, delete-orphan")
    user_access = relationship("DynamicInventoryUserAccess", back_populates="inventory", cascade="all, delete-orphan")
    credentials = relationship("DynamicInventoryCredential", back_populates="inventory", cascade="all, delete-orphan")
    audit_logs = relationship("DynamicInventoryAuditLog", back_populates="inventory", cascade="all, delete-orphan")
    alerts = relationship("DynamicInventoryAlert", back_populates="inventory", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_dynamic_inventories_department_status", "department", "status"),
        Index("ix_dynamic_inventories_type_status", "inventory_type", "status"),
        Index("ix_dynamic_inventories_active_deleted", "is_active", "deleted_at"),
    )


# -----------------------------------------------------------------------------
# Fields / columns
# -----------------------------------------------------------------------------


class DynamicInventoryField(Base, TimestampMixin, UserTrackingMixin):
    """Column definition for an inventory module.

    Inputs are editable by users.
    Outputs are system-calculated and usually read-only.
    """

    __tablename__ = "dynamic_inventory_fields"

    id = Column(Integer, primary_key=True, index=True)
    inventory_id = Column(Integer, ForeignKey("dynamic_inventories.id", ondelete="CASCADE"), nullable=False, index=True)

    field_name = Column(String(180), nullable=False)
    field_key = Column(String(120), nullable=False, index=True)
    field_code = Column(String(20), nullable=True)  # Excel-like column code: A, B, C

    field_type = Column(SAEnum(InventoryFieldType, name="inventoryfieldtype"), nullable=False, index=True)
    field_direction = Column(SAEnum(InventoryFieldDirection, name="inventoryfielddirection"), nullable=False, default=InventoryFieldDirection.INPUT, index=True)
    field_category = Column(SAEnum(InventoryFieldCategory, name="inventoryfieldcategory"), nullable=False, default=InventoryFieldCategory.GENERAL, index=True)
    lookup_group = Column(SAEnum(InventoryLookupGroup, name="inventorylookupgroup"), nullable=True, index=True)

    description = Column(Text, nullable=True)
    placeholder = Column(String(220), nullable=True)
    default_value = Column(Text, nullable=True)
    unit_label = Column(String(40), nullable=True)  # kg, litres, heads, acres, TZS, etc.

    is_required = Column(Boolean, nullable=False, default=False)
    is_unique = Column(Boolean, nullable=False, default=False)
    is_searchable = Column(Boolean, nullable=False, default=False)
    is_filterable = Column(Boolean, nullable=False, default=False)
    is_sortable = Column(Boolean, nullable=False, default=False)
    is_indexed = Column(Boolean, nullable=False, default=False)
    is_report_visible = Column(Boolean, nullable=False, default=True)
    is_dashboard_visible = Column(Boolean, nullable=False, default=False)

    # System-calculated output controls.
    is_system_calculated = Column(Boolean, nullable=False, default=False, index=True)
    is_user_editable = Column(Boolean, nullable=False, default=True)
    calculation_key = Column(String(120), nullable=True, index=True)

    # Backward-compatible formula fields. In the ranch system, these are owned by
    # templates/system rules, not normal users.
    formula_expression = Column(Text, nullable=True)
    formula_scope = Column(SAEnum(InventoryCalculationScope, name="inventorycalculationscope"), nullable=False, default=InventoryCalculationScope.ROW)
    formula_apply_mode = Column(String(40), nullable=False, default="all_rows")
    is_auto_calculated = Column(Boolean, nullable=False, default=True)
    allow_formula_override = Column(Boolean, nullable=False, default=False)

    options_json = Column(MutableList.as_mutable(JSONB), nullable=False, default=list)
    validation_json = Column(MutableDict.as_mutable(JSONB), nullable=False, default=dict)
    display_json = Column(MutableDict.as_mutable(JSONB), nullable=False, default=dict)
    settings_json = Column(MutableDict.as_mutable(JSONB), nullable=False, default=dict)

    order_index = Column(Integer, nullable=False, default=0, index=True)
    is_active = Column(Boolean, nullable=False, default=True, index=True)
    is_archived = Column(Boolean, nullable=False, default=False, index=True)
    is_locked = Column(Boolean, nullable=False, default=False)
    archived_at = Column(DateTime(timezone=True), nullable=True, index=True)
    deleted_at = Column(DateTime(timezone=True), nullable=True, index=True)

    inventory = relationship("DynamicInventory", back_populates="fields")
    values = relationship("DynamicInventoryValue", back_populates="field", cascade="all, delete-orphan")
    metrics = relationship("DynamicInventoryMetric", back_populates="field")

    __table_args__ = (
        UniqueConstraint("inventory_id", "field_key", name="uq_dynamic_inventory_field_key"),
        UniqueConstraint("inventory_id", "field_code", name="uq_dynamic_inventory_field_code"),
        Index("ix_dynamic_inventory_fields_inventory_direction", "inventory_id", "field_direction"),
        Index("ix_dynamic_inventory_fields_inventory_order", "inventory_id", "order_index"),
        Index("ix_dynamic_inventory_fields_calculated", "inventory_id", "is_system_calculated"),
    )


# -----------------------------------------------------------------------------
# System calculation rules
# -----------------------------------------------------------------------------


class DynamicInventoryCalculationRule(Base, TimestampMixin, UserTrackingMixin):
    """System-owned calculation rule.

    This replaces user-entered formulas. Services read these rules and compute
    output fields automatically.
    """

    __tablename__ = "dynamic_inventory_calculation_rules"

    id = Column(Integer, primary_key=True, index=True)
    inventory_id = Column(Integer, ForeignKey("dynamic_inventories.id", ondelete="CASCADE"), nullable=False, index=True)
    template_id = Column(Integer, ForeignKey("dynamic_inventory_templates.id", ondelete="SET NULL"), nullable=True, index=True)

    rule_key = Column(String(140), nullable=False, index=True)
    rule_name = Column(String(180), nullable=False)
    rule_type = Column(SAEnum(InventoryCalculationRuleType, name="inventorycalculationruletype"), nullable=False, index=True)
    scope = Column(SAEnum(InventoryCalculationScope, name="inventorycalculationscope"), nullable=False, default=InventoryCalculationScope.ROW, index=True)

    # Input and output mapping examples:
    # inputs_json: {"opening":"opening_balance", "born":"born", "sold":"sold"}
    # outputs_json: {"current_balance":"current_balance"}
    inputs_json = Column(MutableDict.as_mutable(JSONB), nullable=False, default=dict)
    outputs_json = Column(MutableDict.as_mutable(JSONB), nullable=False, default=dict)

    # Optional human-readable formula/explanation for admin/report display.
    expression_label = Column(Text, nullable=True)

    # Machine-readable rule configuration. Example:
    # {"operation":"opening + additions - reductions", "safe_divide": true}
    rule_config_json = Column(MutableDict.as_mutable(JSONB), nullable=False, default=dict)

    is_active = Column(Boolean, nullable=False, default=True, index=True)
    is_system_rule = Column(Boolean, nullable=False, default=True)
    run_on_create = Column(Boolean, nullable=False, default=True)
    run_on_update = Column(Boolean, nullable=False, default=True)
    run_before_report = Column(Boolean, nullable=False, default=True)
    order_index = Column(Integer, nullable=False, default=0, index=True)

    inventory = relationship("DynamicInventory", back_populates="calculation_rules")
    template = relationship("DynamicInventoryTemplate")

    __table_args__ = (
        UniqueConstraint("inventory_id", "rule_key", name="uq_dynamic_inventory_calculation_rule_key"),
        Index("ix_dynamic_inventory_calc_rules_inventory_scope", "inventory_id", "scope"),
    )


# -----------------------------------------------------------------------------
# Periods / daily sheets
# -----------------------------------------------------------------------------


class DynamicInventoryPeriod(Base, TimestampMixin, UserTrackingMixin):
    """Daily/weekly/monthly/yearly record period.

    For normal operation, the frontend opens today's DAILY period. If it does not
    exist, the service creates a blank period automatically.
    """

    __tablename__ = "dynamic_inventory_periods"

    id = Column(Integer, primary_key=True, index=True)
    inventory_id = Column(Integer, ForeignKey("dynamic_inventories.id", ondelete="CASCADE"), nullable=False, index=True)

    period_type = Column(SAEnum(InventoryPeriodType, name="inventoryperiodtype"), nullable=False, default=InventoryPeriodType.DAILY, index=True)
    period_date = Column(Date, nullable=False, index=True)
    start_date = Column(Date, nullable=False, index=True)
    end_date = Column(Date, nullable=False, index=True)
    title = Column(String(220), nullable=True)

    status = Column(SAEnum(InventoryPeriodStatus, name="inventoryperiodstatus"), nullable=False, default=InventoryPeriodStatus.DRAFT, index=True)
    notes = Column(Text, nullable=True)
    rejection_reason = Column(Text, nullable=True)

    submitted_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    approved_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    rejected_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    locked_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)

    submitted_at = Column(DateTime(timezone=True), nullable=True, index=True)
    approved_at = Column(DateTime(timezone=True), nullable=True, index=True)
    rejected_at = Column(DateTime(timezone=True), nullable=True, index=True)
    locked_at = Column(DateTime(timezone=True), nullable=True, index=True)

    summary_json = Column(MutableDict.as_mutable(JSONB), nullable=False, default=dict)
    settings_json = Column(MutableDict.as_mutable(JSONB), nullable=False, default=dict)

    inventory = relationship("DynamicInventory", back_populates="periods")
    rows = relationship("DynamicInventoryRow", back_populates="period", cascade="all, delete-orphan", order_by="DynamicInventoryRow.row_number")
    reports = relationship("DynamicInventoryReport", back_populates="period")

    __table_args__ = (
        UniqueConstraint("inventory_id", "period_type", "period_date", name="uq_dynamic_inventory_period_date"),
        Index("ix_dynamic_inventory_periods_inventory_date", "inventory_id", "period_date"),
        Index("ix_dynamic_inventory_periods_inventory_status", "inventory_id", "status"),
    )


# -----------------------------------------------------------------------------
# Rows and values
# -----------------------------------------------------------------------------


class DynamicInventoryRow(Base, TimestampMixin, UserTrackingMixin):
    """One data row inside a period."""

    __tablename__ = "dynamic_inventory_rows"

    id = Column(Integer, primary_key=True, index=True)
    inventory_id = Column(Integer, ForeignKey("dynamic_inventories.id", ondelete="CASCADE"), nullable=False, index=True)
    period_id = Column(Integer, ForeignKey("dynamic_inventory_periods.id", ondelete="CASCADE"), nullable=False, index=True)

    row_number = Column(Integer, nullable=False, default=1, index=True)
    row_label = Column(String(220), nullable=True)
    record_date = Column(Date, nullable=True, index=True)

    is_deleted = Column(Boolean, nullable=False, default=False, index=True)
    deleted_at = Column(DateTime(timezone=True), nullable=True, index=True)
    deleted_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    delete_reason = Column(Text, nullable=True)

    # Stores calculated row summary for quick display, but source of truth remains values.
    computed_json = Column(MutableDict.as_mutable(JSONB), nullable=False, default=dict)
    metadata_json = Column(MutableDict.as_mutable(JSONB), nullable=False, default=dict)

    inventory = relationship("DynamicInventory", back_populates="rows")
    period = relationship("DynamicInventoryPeriod", back_populates="rows")
    values = relationship("DynamicInventoryValue", back_populates="row", cascade="all, delete-orphan", order_by="DynamicInventoryValue.field_id")

    __table_args__ = (
        UniqueConstraint("period_id", "row_number", name="uq_dynamic_inventory_period_row_number"),
        Index("ix_dynamic_inventory_rows_inventory_period", "inventory_id", "period_id"),
        Index("ix_dynamic_inventory_rows_inventory_record_date_v2", "inventory_id", "record_date"),
        Index("ix_dynamic_inventory_rows_deleted", "inventory_id", "is_deleted"),
    )


class DynamicInventoryValue(Base, TimestampMixin, UserTrackingMixin):
    """Typed cell value.

    The unique constraint prevents duplicate values for the same row+field.
    System-calculated output fields are stored here just like user inputs, so
    reports and exports remain simple and fast.
    """

    __tablename__ = "dynamic_inventory_values"

    id = Column(Integer, primary_key=True, index=True)
    inventory_id = Column(Integer, ForeignKey("dynamic_inventories.id", ondelete="CASCADE"), nullable=False, index=True)
    row_id = Column(Integer, ForeignKey("dynamic_inventory_rows.id", ondelete="CASCADE"), nullable=False, index=True)
    field_id = Column(Integer, ForeignKey("dynamic_inventory_fields.id", ondelete="CASCADE"), nullable=False, index=True)

    value_text = Column(Text, nullable=True)
    value_number = Column(Numeric(20, 4), nullable=True)
    value_date = Column(Date, nullable=True)
    value_boolean = Column(Boolean, nullable=True)
    value_json = Column(MutableDict.as_mutable(JSONB), nullable=True)
    display_value = Column(Text, nullable=True)

    # True when value was calculated by the system, not typed by user.
    is_system_value = Column(Boolean, nullable=False, default=False, index=True)
    calculation_rule_id = Column(Integer, ForeignKey("dynamic_inventory_calculation_rules.id", ondelete="SET NULL"), nullable=True, index=True)

    inventory = relationship("DynamicInventory", back_populates="values")
    row = relationship("DynamicInventoryRow", back_populates="values")
    field = relationship("DynamicInventoryField", back_populates="values")
    calculation_rule = relationship("DynamicInventoryCalculationRule")

    __table_args__ = (
        UniqueConstraint("row_id", "field_id", name="uq_dynamic_inventory_row_field_value"),
        Index("ix_dynamic_inventory_values_inventory_field", "inventory_id", "field_id"),
        Index("ix_dynamic_inventory_values_number", "field_id", "value_number"),
        Index("ix_dynamic_inventory_values_date", "field_id", "value_date"),
        Index("ix_dynamic_inventory_values_text", "field_id", "value_text"),
    )


# -----------------------------------------------------------------------------
# Metrics and reports
# -----------------------------------------------------------------------------


class DynamicInventoryMetric(Base, TimestampMixin, UserTrackingMixin):
    """Report/dashboard metric.

    Metrics can be direct aggregates over a field or system calculation summaries.
    """

    __tablename__ = "dynamic_inventory_metrics"

    id = Column(Integer, primary_key=True, index=True)
    inventory_id = Column(Integer, ForeignKey("dynamic_inventories.id", ondelete="CASCADE"), nullable=False, index=True)
    field_id = Column(Integer, ForeignKey("dynamic_inventory_fields.id", ondelete="SET NULL"), nullable=True, index=True)
    calculation_rule_id = Column(Integer, ForeignKey("dynamic_inventory_calculation_rules.id", ondelete="SET NULL"), nullable=True, index=True)

    metric_key = Column(String(140), nullable=False, index=True)
    metric_type = Column(SAEnum(InventoryMetricType, name="inventorymetrictype"), nullable=False, index=True)
    label = Column(String(180), nullable=False)
    description = Column(Text, nullable=True)
    unit_label = Column(String(40), nullable=True)

    is_enabled = Column(Boolean, nullable=False, default=True, index=True)
    is_report_visible = Column(Boolean, nullable=False, default=True)
    is_dashboard_visible = Column(Boolean, nullable=False, default=True)
    order_index = Column(Integer, nullable=False, default=0, index=True)

    # Backward-compatible formula fields. In the ranch system, metrics are
    # generated by calculation rules or safe service logic.
    formula_expression = Column(Text, nullable=True)
    formula_scope = Column(SAEnum(InventoryCalculationScope, name="inventorycalculationscope"), nullable=False, default=InventoryCalculationScope.REPORT)
    is_auto_calculated = Column(Boolean, nullable=False, default=True)

    settings_json = Column(MutableDict.as_mutable(JSONB), nullable=False, default=dict)

    inventory = relationship("DynamicInventory", back_populates="metrics")
    field = relationship("DynamicInventoryField", back_populates="metrics")
    calculation_rule = relationship("DynamicInventoryCalculationRule")

    __table_args__ = (
        UniqueConstraint("inventory_id", "metric_key", name="uq_dynamic_inventory_metric_key"),
        Index("ix_dynamic_inventory_metrics_inventory_enabled", "inventory_id", "is_enabled"),
    )


class DynamicInventoryReport(Base, TimestampMixin, UserTrackingMixin):
    """Generated report record."""

    __tablename__ = "dynamic_inventory_reports"

    id = Column(Integer, primary_key=True, index=True)
    inventory_id = Column(Integer, ForeignKey("dynamic_inventories.id", ondelete="CASCADE"), nullable=False, index=True)
    period_id = Column(Integer, ForeignKey("dynamic_inventory_periods.id", ondelete="SET NULL"), nullable=True, index=True)

    report_type = Column(SAEnum(InventoryReportType, name="inventoryreporttype"), nullable=False, index=True)
    report_format = Column(SAEnum(InventoryReportFormat, name="inventoryreportformat"), nullable=False, index=True)
    status = Column(SAEnum(InventoryReportStatus, name="inventoryreportstatus"), nullable=False, default=InventoryReportStatus.GENERATED, index=True)

    title = Column(String(240), nullable=False)
    start_date = Column(Date, nullable=False, index=True)
    end_date = Column(Date, nullable=False, index=True)

    file_url = Column(Text, nullable=True)
    file_name = Column(String(260), nullable=True)
    file_size_bytes = Column(Integer, nullable=True)
    content_type = Column(String(120), nullable=True)

    summary_json = Column(MutableDict.as_mutable(JSONB), nullable=False, default=dict)
    report_data_json = Column(MutableDict.as_mutable(JSONB), nullable=False, default=dict)
    filters_json = Column(MutableDict.as_mutable(JSONB), nullable=False, default=dict)
    settings_json = Column(MutableDict.as_mutable(JSONB), nullable=False, default=dict)

    generated_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    generated_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    locked_at = Column(DateTime(timezone=True), nullable=True, index=True)
    archived_at = Column(DateTime(timezone=True), nullable=True, index=True)

    inventory = relationship("DynamicInventory", back_populates="reports")
    period = relationship("DynamicInventoryPeriod", back_populates="reports")

    __table_args__ = (
        Index("ix_dynamic_inventory_reports_inventory_dates", "inventory_id", "start_date", "end_date"),
        Index("ix_dynamic_inventory_reports_type_status", "report_type", "status"),
    )


# -----------------------------------------------------------------------------
# User access and credentials
# -----------------------------------------------------------------------------


class DynamicInventoryUserAccess(Base, TimestampMixin, UserTrackingMixin):
    """Assign existing system users to inventory modules."""

    __tablename__ = "dynamic_inventory_user_access"

    id = Column(Integer, primary_key=True, index=True)
    inventory_id = Column(Integer, ForeignKey("dynamic_inventories.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    role = Column(SAEnum(InventoryUserRole, name="inventoryuserrole"), nullable=False, default=InventoryUserRole.EDITOR, index=True)

    can_add_rows = Column(Boolean, nullable=False, default=True)
    can_edit_rows = Column(Boolean, nullable=False, default=True)
    can_delete_rows = Column(Boolean, nullable=False, default=False)
    can_submit_periods = Column(Boolean, nullable=False, default=True)
    can_approve_periods = Column(Boolean, nullable=False, default=False)
    can_view_history = Column(Boolean, nullable=False, default=True)
    can_export_reports = Column(Boolean, nullable=False, default=True)
    can_manage_fields = Column(Boolean, nullable=False, default=False)
    can_manage_users = Column(Boolean, nullable=False, default=False)
    can_manage_templates = Column(Boolean, nullable=False, default=False)
    can_manage_lookups = Column(Boolean, nullable=False, default=False)

    is_active = Column(Boolean, nullable=False, default=True, index=True)
    expires_at = Column(DateTime(timezone=True), nullable=True, index=True)
    settings_json = Column(MutableDict.as_mutable(JSONB), nullable=False, default=dict)

    inventory = relationship("DynamicInventory", back_populates="user_access")

    __table_args__ = (
        UniqueConstraint("inventory_id", "user_id", name="uq_dynamic_inventory_user_access"),
        Index("ix_dynamic_inventory_user_access_user_active", "user_id", "is_active"),
    )


class DynamicInventoryCredential(Base, TimestampMixin, UserTrackingMixin):
    """Optional inventory-specific username/password.

    Admin can create separate credentials for a module, but normal preference is
    assigned existing system users.
    """

    __tablename__ = "dynamic_inventory_credentials"

    id = Column(Integer, primary_key=True, index=True)
    inventory_id = Column(Integer, ForeignKey("dynamic_inventories.id", ondelete="CASCADE"), nullable=False, index=True)

    username = Column(String(120), nullable=False, unique=True, index=True)
    password_hash = Column(Text, nullable=False)
    role = Column(SAEnum(InventoryUserRole, name="inventoryuserrole"), nullable=False, default=InventoryUserRole.EDITOR)

    must_change_password = Column(Boolean, nullable=False, default=True)
    is_active = Column(Boolean, nullable=False, default=True, index=True)
    last_login_at = Column(DateTime(timezone=True), nullable=True, index=True)
    expires_at = Column(DateTime(timezone=True), nullable=True, index=True)

    permissions_json = Column(MutableDict.as_mutable(JSONB), nullable=False, default=dict)
    settings_json = Column(MutableDict.as_mutable(JSONB), nullable=False, default=dict)

    inventory = relationship("DynamicInventory", back_populates="credentials")

    __table_args__ = (
        Index("ix_dynamic_inventory_credentials_inventory_active", "inventory_id", "is_active"),
    )


# -----------------------------------------------------------------------------
# Lookup / dropdown master data
# -----------------------------------------------------------------------------


class DynamicInventoryLookupOption(Base, TimestampMixin, UserTrackingMixin):
    """Reusable dropdown option for ranch classification fields.

    Examples:
    - animal_type: Goat, Cattle, Sheep
    - crop_type: Maize, Beans, Rice
    - machine_type: Tractor, Truck, Generator
    """

    __tablename__ = "dynamic_inventory_lookup_options"

    id = Column(Integer, primary_key=True, index=True)
    department = Column(SAEnum(RanchDepartment, name="ranchdepartment"), nullable=True, index=True)
    group = Column(SAEnum(InventoryLookupGroup, name="inventorylookupgroup"), nullable=False, index=True)

    label = Column(String(180), nullable=False, index=True)
    value = Column(String(180), nullable=False, index=True)
    description = Column(Text, nullable=True)

    parent_group = Column(SAEnum(InventoryLookupGroup, name="inventorylookupgroup"), nullable=True, index=True)
    parent_value = Column(String(180), nullable=True, index=True)

    is_active = Column(Boolean, nullable=False, default=True, index=True)
    is_system_option = Column(Boolean, nullable=False, default=False)
    order_index = Column(Integer, nullable=False, default=0, index=True)
    metadata_json = Column(MutableDict.as_mutable(JSONB), nullable=False, default=dict)

    __table_args__ = (
        UniqueConstraint("department", "group", "value", name="uq_dynamic_inventory_lookup_department_group_value"),
        Index("ix_dynamic_inventory_lookup_group_active", "group", "is_active"),
        Index("ix_dynamic_inventory_lookup_department_group", "department", "group"),
    )


# -----------------------------------------------------------------------------
# Alerts, audit logs, attachments
# -----------------------------------------------------------------------------


class DynamicInventoryAlert(Base, TimestampMixin, UserTrackingMixin):
    """System alerts like low stock, high mortality, service due, etc."""

    __tablename__ = "dynamic_inventory_alerts"

    id = Column(Integer, primary_key=True, index=True)
    inventory_id = Column(Integer, ForeignKey("dynamic_inventories.id", ondelete="CASCADE"), nullable=False, index=True)
    period_id = Column(Integer, ForeignKey("dynamic_inventory_periods.id", ondelete="SET NULL"), nullable=True, index=True)
    row_id = Column(Integer, ForeignKey("dynamic_inventory_rows.id", ondelete="SET NULL"), nullable=True, index=True)

    alert_key = Column(String(140), nullable=False, index=True)
    title = Column(String(220), nullable=False)
    message = Column(Text, nullable=True)
    level = Column(SAEnum(InventoryAlertLevel, name="inventoryalertlevel"), nullable=False, default=InventoryAlertLevel.INFO, index=True)
    status = Column(SAEnum(InventoryAlertStatus, name="inventoryalertstatus"), nullable=False, default=InventoryAlertStatus.OPEN, index=True)

    threshold_json = Column(MutableDict.as_mutable(JSONB), nullable=False, default=dict)
    context_json = Column(MutableDict.as_mutable(JSONB), nullable=False, default=dict)

    acknowledged_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    resolved_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    acknowledged_at = Column(DateTime(timezone=True), nullable=True, index=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True, index=True)

    inventory = relationship("DynamicInventory", back_populates="alerts")
    period = relationship("DynamicInventoryPeriod")
    row = relationship("DynamicInventoryRow")

    __table_args__ = (
        Index("ix_dynamic_inventory_alerts_inventory_status", "inventory_id", "status"),
        Index("ix_dynamic_inventory_alerts_level_status", "level", "status"),
    )


class DynamicInventoryAuditLog(Base):
    """Immutable audit trail."""

    __tablename__ = "dynamic_inventory_audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    inventory_id = Column(Integer, ForeignKey("dynamic_inventories.id", ondelete="CASCADE"), nullable=True, index=True)
    period_id = Column(Integer, ForeignKey("dynamic_inventory_periods.id", ondelete="SET NULL"), nullable=True, index=True)
    row_id = Column(Integer, ForeignKey("dynamic_inventory_rows.id", ondelete="SET NULL"), nullable=True, index=True)
    field_id = Column(Integer, ForeignKey("dynamic_inventory_fields.id", ondelete="SET NULL"), nullable=True, index=True)

    actor_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    action = Column(
        SAEnum(
            InventoryAuditAction,
            name="inventoryauditaction",
            values_callable=lambda enum_cls: [member.value for member in enum_cls],
            native_enum=True,
            validate_strings=True,
        ),
        nullable=False,
        index=True,
    )
    description = Column(Text, nullable=True)

    old_value_json = Column(MutableDict.as_mutable(JSONB), nullable=True)
    new_value_json = Column(MutableDict.as_mutable(JSONB), nullable=True)
    context_json = Column(MutableDict.as_mutable(JSONB), nullable=False, default=dict)

    ip_address = Column(String(80), nullable=True)
    user_agent = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)

    inventory = relationship("DynamicInventory", back_populates="audit_logs")
    period = relationship("DynamicInventoryPeriod")
    row = relationship("DynamicInventoryRow")
    field = relationship("DynamicInventoryField")

    __table_args__ = (
        Index("ix_dynamic_inventory_audit_inventory_created", "inventory_id", "created_at"),
        Index("ix_dynamic_inventory_audit_actor_created", "actor_user_id", "created_at"),
        Index("ix_dynamic_inventory_audit_action_created", "action", "created_at"),
    )


class DynamicInventoryAttachment(Base, TimestampMixin, UserTrackingMixin):
    """Optional attachments for records, services, invoices, receipts, photos, etc."""

    __tablename__ = "dynamic_inventory_attachments"

    id = Column(Integer, primary_key=True, index=True)
    inventory_id = Column(Integer, ForeignKey("dynamic_inventories.id", ondelete="CASCADE"), nullable=False, index=True)
    period_id = Column(Integer, ForeignKey("dynamic_inventory_periods.id", ondelete="SET NULL"), nullable=True, index=True)
    row_id = Column(Integer, ForeignKey("dynamic_inventory_rows.id", ondelete="SET NULL"), nullable=True, index=True)
    field_id = Column(Integer, ForeignKey("dynamic_inventory_fields.id", ondelete="SET NULL"), nullable=True, index=True)

    file_name = Column(String(260), nullable=False)
    file_url = Column(Text, nullable=False)
    content_type = Column(String(120), nullable=True)
    file_size_bytes = Column(Integer, nullable=True)
    description = Column(Text, nullable=True)

    metadata_json = Column(MutableDict.as_mutable(JSONB), nullable=False, default=dict)

    inventory = relationship("DynamicInventory")
    period = relationship("DynamicInventoryPeriod")
    row = relationship("DynamicInventoryRow")
    field = relationship("DynamicInventoryField")

    __table_args__ = (
        Index("ix_dynamic_inventory_attachments_inventory", "inventory_id"),
        Index("ix_dynamic_inventory_attachments_row", "row_id"),
    )


# -----------------------------------------------------------------------------
# Helpful constraints
# -----------------------------------------------------------------------------


CheckConstraint("end_date >= start_date", name="ck_dynamic_inventory_period_date_range")


# Department classification field defaults used by the service to seed templates.
RANCH_CLASSIFICATION_FIELDS = {
    RanchDepartment.ANIMALS: ["animal_type", "breed", "animal_category"],
    RanchDepartment.CROPS: ["crop_type", "crop_variety", "field_or_plot"],
    RanchDepartment.MACHINERY: ["machine_type", "machine_name", "asset_code"],
}
