"""
Dynamic Ranch Inventory Schemas
===============================

Comprehensive Pydantic schemas for the unified Ranch Management Inventory Engine.

Place this file at:
backend/app/schemas/dynamic_inventory.py

Design principle:
- Users enter INPUT fields only.
- OUTPUT fields are calculated by system-owned calculation rules.
- Departments are Crops, Animals, and Machineries & Maintenance.
- Supports templates, daily periods, reports, approvals, access, credentials,
  lookup dropdowns, audit logs, alerts, and attachments.
"""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional, Union

from pydantic import BaseModel, Field, field_validator, model_validator

try:
    from pydantic import ConfigDict
except Exception:  # pragma: no cover
    ConfigDict = None  # type: ignore

from app.models.dynamic_inventory import (
    InventoryAccessType,
    InventoryAlertLevel,
    InventoryAlertStatus,
    InventoryAuditAction,
    InventoryCalculationRuleType,
    InventoryCalculationScope,
    InventoryFieldCategory,
    InventoryFieldDirection,
    InventoryFieldType,
    InventoryFormulaApplyMode,
    InventoryFormulaScope,
    InventoryLookupGroup,
    InventoryMetricType,
    InventoryPeriodStatus,
    InventoryPeriodType,
    InventoryReportFormat,
    InventoryReportStatus,
    InventoryReportType,
    InventoryStatus,
    InventoryTemplateType,
    InventoryUserRole,
    RanchDepartment,
)

JsonDict = Dict[str, Any]
JsonList = List[Any]
PrimitiveValue = Union[str, int, float, bool, Decimal, date, datetime, None, JsonDict, JsonList]


# =============================================================================
# Pydantic compatibility base
# =============================================================================


class ORMBaseModel(BaseModel):
    """Base schema that supports SQLAlchemy ORM objects."""

    if ConfigDict is not None:
        model_config = ConfigDict(from_attributes=True, use_enum_values=True, arbitrary_types_allowed=True)
    else:  # pragma: no cover - Pydantic v1 fallback
        class Config:
            orm_mode = True
            use_enum_values = True
            arbitrary_types_allowed = True


class MessageOut(ORMBaseModel):
    message: str
    detail: Optional[str] = None


class PaginatedOut(ORMBaseModel):
    total: int = 0
    page: int = 1
    page_size: int = 50
    items: List[Any] = Field(default_factory=list)


# =============================================================================
# Helper / request schemas
# =============================================================================


class DateRangePayload(ORMBaseModel):
    start_date: date
    end_date: date

    @model_validator(mode="after")
    def validate_range(self):
        if self.end_date < self.start_date:
            raise ValueError("end_date must be greater than or equal to start_date")
        return self


class PeriodActionPayload(ORMBaseModel):
    notes: Optional[str] = None
    reason: Optional[str] = None


class BulkIdsPayload(ORMBaseModel):
    ids: List[int] = Field(default_factory=list)


class ExportOptionsPayload(ORMBaseModel):
    include_inputs: bool = True
    include_outputs: bool = True
    include_summary: bool = True
    include_raw_data: bool = True
    visible_fields_only: bool = True
    lock_report_snapshot: bool = False
    timezone: Optional[str] = None


# =============================================================================
# Lookup options / dropdown master data
# =============================================================================


class LookupOptionBase(ORMBaseModel):
    department: Optional[RanchDepartment] = None
    group: InventoryLookupGroup
    option_key: str = Field(..., min_length=1, max_length=140)
    label: str = Field(..., min_length=1, max_length=180)
    value: str = Field(..., min_length=1, max_length=140)
    code: Optional[str] = Field(default=None, max_length=80)
    parent_group: Optional[InventoryLookupGroup] = None
    parent_value: Optional[str] = Field(default=None, max_length=140)
    description: Optional[str] = None
    metadata_json: JsonDict = Field(default_factory=dict)
    is_system_option: bool = True
    is_active: bool = True
    order_index: int = 0


class LookupOptionCreate(LookupOptionBase):
    pass


class LookupOptionUpdate(ORMBaseModel):
    department: Optional[RanchDepartment] = None
    group: Optional[InventoryLookupGroup] = None
    option_key: Optional[str] = Field(default=None, min_length=1, max_length=140)
    label: Optional[str] = Field(default=None, min_length=1, max_length=180)
    value: Optional[str] = Field(default=None, min_length=1, max_length=140)
    code: Optional[str] = Field(default=None, max_length=80)
    parent_group: Optional[InventoryLookupGroup] = None
    parent_value: Optional[str] = Field(default=None, max_length=140)
    description: Optional[str] = None
    metadata_json: Optional[JsonDict] = None
    is_system_option: Optional[bool] = None
    is_active: Optional[bool] = None
    order_index: Optional[int] = None


class LookupOptionOut(LookupOptionBase):
    id: int
    created_by_user_id: Optional[int] = None
    updated_by_user_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime


# =============================================================================
# Template fields, rules, metrics
# =============================================================================


class TemplateFieldBase(ORMBaseModel):
    field_name: str = Field(..., min_length=1, max_length=180)
    field_key: str = Field(..., min_length=1, max_length=120)
    field_code: Optional[str] = Field(default=None, max_length=20)
    field_type: InventoryFieldType
    field_direction: InventoryFieldDirection = InventoryFieldDirection.INPUT
    field_category: InventoryFieldCategory = InventoryFieldCategory.GENERAL
    lookup_group: Optional[InventoryLookupGroup] = None
    description: Optional[str] = None
    placeholder: Optional[str] = Field(default=None, max_length=220)
    default_value: Optional[str] = None
    unit_label: Optional[str] = Field(default=None, max_length=40)

    is_required: bool = False
    is_unique: bool = False
    is_searchable: bool = False
    is_filterable: bool = False
    is_sortable: bool = False
    is_indexed: bool = False
    is_report_visible: bool = True
    is_dashboard_visible: bool = False
    is_system_calculated: bool = False
    is_user_editable: bool = True
    calculation_key: Optional[str] = Field(default=None, max_length=120)

    options_json: JsonList = Field(default_factory=list)
    validation_json: JsonDict = Field(default_factory=dict)
    display_json: JsonDict = Field(default_factory=dict)
    settings_json: JsonDict = Field(default_factory=dict)
    order_index: int = 0

    @model_validator(mode="after")
    def validate_output_fields(self):
        if self.field_direction == InventoryFieldDirection.OUTPUT:
            self.is_system_calculated = True
            self.is_user_editable = False
        if self.is_system_calculated:
            self.is_user_editable = False
        return self


class TemplateFieldCreate(TemplateFieldBase):
    pass


class TemplateFieldUpdate(ORMBaseModel):
    field_name: Optional[str] = Field(default=None, min_length=1, max_length=180)
    field_key: Optional[str] = Field(default=None, min_length=1, max_length=120)
    field_code: Optional[str] = Field(default=None, max_length=20)
    field_type: Optional[InventoryFieldType] = None
    field_direction: Optional[InventoryFieldDirection] = None
    field_category: Optional[InventoryFieldCategory] = None
    lookup_group: Optional[InventoryLookupGroup] = None
    description: Optional[str] = None
    placeholder: Optional[str] = Field(default=None, max_length=220)
    default_value: Optional[str] = None
    unit_label: Optional[str] = Field(default=None, max_length=40)
    is_required: Optional[bool] = None
    is_unique: Optional[bool] = None
    is_searchable: Optional[bool] = None
    is_filterable: Optional[bool] = None
    is_sortable: Optional[bool] = None
    is_indexed: Optional[bool] = None
    is_report_visible: Optional[bool] = None
    is_dashboard_visible: Optional[bool] = None
    is_system_calculated: Optional[bool] = None
    is_user_editable: Optional[bool] = None
    calculation_key: Optional[str] = Field(default=None, max_length=120)
    options_json: Optional[JsonList] = None
    validation_json: Optional[JsonDict] = None
    display_json: Optional[JsonDict] = None
    settings_json: Optional[JsonDict] = None
    order_index: Optional[int] = None


class TemplateFieldOut(TemplateFieldBase):
    id: int
    template_id: int
    created_by_user_id: Optional[int] = None
    updated_by_user_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime


class TemplateCalculationRuleBase(ORMBaseModel):
    rule_key: str = Field(..., min_length=1, max_length=140)
    rule_name: str = Field(..., min_length=1, max_length=180)
    rule_type: InventoryCalculationRuleType
    scope: InventoryCalculationScope = InventoryCalculationScope.ROW
    inputs_json: JsonDict = Field(default_factory=dict)
    outputs_json: JsonDict = Field(default_factory=dict)
    expression_label: Optional[str] = None
    rule_config_json: JsonDict = Field(default_factory=dict)
    is_active: bool = True
    run_on_create: bool = True
    run_on_update: bool = True
    run_before_report: bool = True
    order_index: int = 0


class TemplateCalculationRuleCreate(TemplateCalculationRuleBase):
    pass


class TemplateCalculationRuleUpdate(ORMBaseModel):
    rule_key: Optional[str] = Field(default=None, min_length=1, max_length=140)
    rule_name: Optional[str] = Field(default=None, min_length=1, max_length=180)
    rule_type: Optional[InventoryCalculationRuleType] = None
    scope: Optional[InventoryCalculationScope] = None
    inputs_json: Optional[JsonDict] = None
    outputs_json: Optional[JsonDict] = None
    expression_label: Optional[str] = None
    rule_config_json: Optional[JsonDict] = None
    is_active: Optional[bool] = None
    run_on_create: Optional[bool] = None
    run_on_update: Optional[bool] = None
    run_before_report: Optional[bool] = None
    order_index: Optional[int] = None


class TemplateCalculationRuleOut(TemplateCalculationRuleBase):
    id: int
    template_id: int
    created_by_user_id: Optional[int] = None
    updated_by_user_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime


class TemplateMetricBase(ORMBaseModel):
    metric_key: str = Field(..., min_length=1, max_length=140)
    metric_type: InventoryMetricType
    label: str = Field(..., min_length=1, max_length=180)
    field_key: Optional[str] = Field(default=None, max_length=120)
    calculation_rule_key: Optional[str] = Field(default=None, max_length=140)
    unit_label: Optional[str] = Field(default=None, max_length=40)
    is_enabled: bool = True
    is_report_visible: bool = True
    is_dashboard_visible: bool = True
    settings_json: JsonDict = Field(default_factory=dict)
    order_index: int = 0


class TemplateMetricCreate(TemplateMetricBase):
    pass


class TemplateMetricUpdate(ORMBaseModel):
    metric_key: Optional[str] = Field(default=None, min_length=1, max_length=140)
    metric_type: Optional[InventoryMetricType] = None
    label: Optional[str] = Field(default=None, min_length=1, max_length=180)
    field_key: Optional[str] = Field(default=None, max_length=120)
    calculation_rule_key: Optional[str] = Field(default=None, max_length=140)
    unit_label: Optional[str] = Field(default=None, max_length=40)
    is_enabled: Optional[bool] = None
    is_report_visible: Optional[bool] = None
    is_dashboard_visible: Optional[bool] = None
    settings_json: Optional[JsonDict] = None
    order_index: Optional[int] = None


class TemplateMetricOut(TemplateMetricBase):
    id: int
    template_id: int
    created_by_user_id: Optional[int] = None
    updated_by_user_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime


class InventoryTemplateBase(ORMBaseModel):
    template_key: str = Field(..., min_length=1, max_length=120)
    name: str = Field(..., min_length=1, max_length=180)
    description: Optional[str] = None
    department: RanchDepartment
    inventory_type: InventoryTemplateType
    is_active: bool = True
    is_system_template: bool = True
    version: int = 1
    fields_json: JsonList = Field(default_factory=list)
    calculation_rules_json: JsonList = Field(default_factory=list)
    metrics_json: JsonList = Field(default_factory=list)
    report_config_json: JsonDict = Field(default_factory=dict)
    dashboard_config_json: JsonDict = Field(default_factory=dict)
    settings_json: JsonDict = Field(default_factory=dict)


class InventoryTemplateCreate(InventoryTemplateBase):
    template_fields: List[TemplateFieldCreate] = Field(default_factory=list)
    template_calculation_rules: List[TemplateCalculationRuleCreate] = Field(default_factory=list)
    template_metrics: List[TemplateMetricCreate] = Field(default_factory=list)


class InventoryTemplateUpdate(ORMBaseModel):
    template_key: Optional[str] = Field(default=None, min_length=1, max_length=120)
    name: Optional[str] = Field(default=None, min_length=1, max_length=180)
    description: Optional[str] = None
    department: Optional[RanchDepartment] = None
    inventory_type: Optional[InventoryTemplateType] = None
    is_active: Optional[bool] = None
    is_system_template: Optional[bool] = None
    version: Optional[int] = None
    fields_json: Optional[JsonList] = None
    calculation_rules_json: Optional[JsonList] = None
    metrics_json: Optional[JsonList] = None
    report_config_json: Optional[JsonDict] = None
    dashboard_config_json: Optional[JsonDict] = None
    settings_json: Optional[JsonDict] = None


class InventoryTemplateOut(InventoryTemplateBase):
    id: int
    created_by_user_id: Optional[int] = None
    updated_by_user_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    template_fields: List[TemplateFieldOut] = Field(default_factory=list)
    template_calculation_rules: List[TemplateCalculationRuleOut] = Field(default_factory=list)
    template_metrics: List[TemplateMetricOut] = Field(default_factory=list)


# =============================================================================
# Inventory fields and calculation rules
# =============================================================================


class InventoryFieldBase(ORMBaseModel):
    field_name: str = Field(..., min_length=1, max_length=180)
    field_key: str = Field(..., min_length=1, max_length=120)
    field_code: Optional[str] = Field(default=None, max_length=20)
    field_type: InventoryFieldType
    field_direction: InventoryFieldDirection = InventoryFieldDirection.INPUT
    field_category: InventoryFieldCategory = InventoryFieldCategory.GENERAL
    lookup_group: Optional[InventoryLookupGroup] = None
    description: Optional[str] = None
    placeholder: Optional[str] = Field(default=None, max_length=220)
    default_value: Optional[str] = None
    unit_label: Optional[str] = Field(default=None, max_length=40)
    is_required: bool = False
    is_unique: bool = False
    is_searchable: bool = False
    is_filterable: bool = False
    is_sortable: bool = False
    is_indexed: bool = False
    is_report_visible: bool = True
    is_dashboard_visible: bool = False
    is_system_calculated: bool = False
    is_user_editable: bool = True
    calculation_key: Optional[str] = Field(default=None, max_length=120)
    formula_expression: Optional[str] = None
    formula_scope: InventoryFormulaScope = InventoryFormulaScope.ROW
    formula_apply_mode: InventoryFormulaApplyMode = InventoryFormulaApplyMode.ALL_ROWS
    is_auto_calculated: bool = True
    allow_formula_override: bool = False
    options_json: JsonList = Field(default_factory=list)
    validation_json: JsonDict = Field(default_factory=dict)
    display_json: JsonDict = Field(default_factory=dict)
    settings_json: JsonDict = Field(default_factory=dict)
    order_index: int = 0
    is_active: bool = True
    is_archived: bool = False
    is_locked: bool = False

    @model_validator(mode="after")
    def validate_direction(self):
        if self.field_direction == InventoryFieldDirection.OUTPUT:
            self.is_system_calculated = True
            self.is_user_editable = False
        if self.is_system_calculated:
            self.is_user_editable = False
        return self


class InventoryFieldCreate(InventoryFieldBase):
    pass


class InventoryFieldUpdate(ORMBaseModel):
    field_name: Optional[str] = Field(default=None, min_length=1, max_length=180)
    field_key: Optional[str] = Field(default=None, min_length=1, max_length=120)
    field_code: Optional[str] = Field(default=None, max_length=20)
    field_type: Optional[InventoryFieldType] = None
    field_direction: Optional[InventoryFieldDirection] = None
    field_category: Optional[InventoryFieldCategory] = None
    lookup_group: Optional[InventoryLookupGroup] = None
    description: Optional[str] = None
    placeholder: Optional[str] = Field(default=None, max_length=220)
    default_value: Optional[str] = None
    unit_label: Optional[str] = Field(default=None, max_length=40)
    is_required: Optional[bool] = None
    is_unique: Optional[bool] = None
    is_searchable: Optional[bool] = None
    is_filterable: Optional[bool] = None
    is_sortable: Optional[bool] = None
    is_indexed: Optional[bool] = None
    is_report_visible: Optional[bool] = None
    is_dashboard_visible: Optional[bool] = None
    is_system_calculated: Optional[bool] = None
    is_user_editable: Optional[bool] = None
    calculation_key: Optional[str] = Field(default=None, max_length=120)
    formula_expression: Optional[str] = None
    formula_scope: Optional[InventoryFormulaScope] = None
    formula_apply_mode: Optional[InventoryFormulaApplyMode] = None
    is_auto_calculated: Optional[bool] = None
    allow_formula_override: Optional[bool] = None
    options_json: Optional[JsonList] = None
    validation_json: Optional[JsonDict] = None
    display_json: Optional[JsonDict] = None
    settings_json: Optional[JsonDict] = None
    order_index: Optional[int] = None
    is_active: Optional[bool] = None
    is_archived: Optional[bool] = None
    is_locked: Optional[bool] = None


class InventoryFieldOut(InventoryFieldBase):
    id: int
    inventory_id: int
    archived_at: Optional[datetime] = None
    deleted_at: Optional[datetime] = None
    created_by_user_id: Optional[int] = None
    updated_by_user_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime


class InventoryCalculationRuleBase(ORMBaseModel):
    rule_key: str = Field(..., min_length=1, max_length=140)
    rule_name: str = Field(..., min_length=1, max_length=180)
    rule_type: InventoryCalculationRuleType
    scope: InventoryCalculationScope = InventoryCalculationScope.ROW
    inputs_json: JsonDict = Field(default_factory=dict)
    outputs_json: JsonDict = Field(default_factory=dict)
    expression_label: Optional[str] = None
    rule_config_json: JsonDict = Field(default_factory=dict)
    is_active: bool = True
    is_system_rule: bool = True
    run_on_create: bool = True
    run_on_update: bool = True
    run_before_report: bool = True
    order_index: int = 0


class InventoryCalculationRuleCreate(InventoryCalculationRuleBase):
    template_id: Optional[int] = None


class InventoryCalculationRuleUpdate(ORMBaseModel):
    rule_key: Optional[str] = Field(default=None, min_length=1, max_length=140)
    rule_name: Optional[str] = Field(default=None, min_length=1, max_length=180)
    rule_type: Optional[InventoryCalculationRuleType] = None
    scope: Optional[InventoryCalculationScope] = None
    inputs_json: Optional[JsonDict] = None
    outputs_json: Optional[JsonDict] = None
    expression_label: Optional[str] = None
    rule_config_json: Optional[JsonDict] = None
    is_active: Optional[bool] = None
    is_system_rule: Optional[bool] = None
    run_on_create: Optional[bool] = None
    run_on_update: Optional[bool] = None
    run_before_report: Optional[bool] = None
    order_index: Optional[int] = None


class InventoryCalculationRuleOut(InventoryCalculationRuleBase):
    id: int
    inventory_id: int
    template_id: Optional[int] = None
    created_by_user_id: Optional[int] = None
    updated_by_user_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime


# =============================================================================
# Values, rows, periods
# =============================================================================


class InventoryValueBase(ORMBaseModel):
    field_id: Optional[int] = None
    field_key: Optional[str] = None
    value_text: Optional[str] = None
    value_number: Optional[Decimal] = None
    value_date: Optional[date] = None
    value_boolean: Optional[bool] = None
    value_json: Optional[JsonDict] = None
    display_value: Optional[str] = None
    is_system_value: bool = False
    calculation_rule_id: Optional[int] = None

    @model_validator(mode="after")
    def validate_field_reference(self):
        if self.field_id is None and not self.field_key:
            raise ValueError("Either field_id or field_key is required")
        return self


class InventoryValueCreate(InventoryValueBase):
    raw_value: Optional[PrimitiveValue] = None


class InventoryValueUpdate(ORMBaseModel):
    field_id: Optional[int] = None
    field_key: Optional[str] = None
    raw_value: Optional[PrimitiveValue] = None
    value_text: Optional[str] = None
    value_number: Optional[Decimal] = None
    value_date: Optional[date] = None
    value_boolean: Optional[bool] = None
    value_json: Optional[JsonDict] = None
    display_value: Optional[str] = None


class InventoryValueOut(ORMBaseModel):
    id: int
    inventory_id: int
    row_id: int
    field_id: int
    value_text: Optional[str] = None
    value_number: Optional[Decimal] = None
    value_date: Optional[date] = None
    value_boolean: Optional[bool] = None
    value_json: Optional[JsonDict] = None
    display_value: Optional[str] = None
    is_system_value: bool = False
    calculation_rule_id: Optional[int] = None
    created_by_user_id: Optional[int] = None
    updated_by_user_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime


class InventoryRowBase(ORMBaseModel):
    row_number: Optional[int] = None
    row_label: Optional[str] = Field(default=None, max_length=220)
    record_date: Optional[date] = None
    primary_entity_type: Optional[str] = Field(default=None, max_length=140)
    primary_entity_name: Optional[str] = Field(default=None, max_length=180)
    primary_entity_code: Optional[str] = Field(default=None, max_length=120)
    computed_json: JsonDict = Field(default_factory=dict)
    metadata_json: JsonDict = Field(default_factory=dict)


class InventoryRowCreate(InventoryRowBase):
    # Flexible simple API: values can be a dict keyed by field_key, plus optional detailed values list.
    values: Dict[str, PrimitiveValue] = Field(default_factory=dict)
    value_items: List[InventoryValueCreate] = Field(default_factory=list)


class InventoryRowUpdate(ORMBaseModel):
    row_label: Optional[str] = Field(default=None, max_length=220)
    record_date: Optional[date] = None
    primary_entity_type: Optional[str] = Field(default=None, max_length=140)
    primary_entity_name: Optional[str] = Field(default=None, max_length=180)
    primary_entity_code: Optional[str] = Field(default=None, max_length=120)
    values: Optional[Dict[str, PrimitiveValue]] = None
    value_items: Optional[List[InventoryValueUpdate]] = None
    metadata_json: Optional[JsonDict] = None


class RowDeletePayload(ORMBaseModel):
    reason: Optional[str] = None


class InventoryRowOut(InventoryRowBase):
    id: int
    inventory_id: int
    period_id: int
    row_number: int
    is_deleted: bool = False
    deleted_at: Optional[datetime] = None
    deleted_by_user_id: Optional[int] = None
    delete_reason: Optional[str] = None
    values: Dict[str, PrimitiveValue] = Field(default_factory=dict)
    value_items: List[InventoryValueOut] = Field(default_factory=list)
    created_by_user_id: Optional[int] = None
    updated_by_user_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime


class InventoryPeriodBase(ORMBaseModel):
    period_type: InventoryPeriodType = InventoryPeriodType.DAILY
    period_date: date
    start_date: date
    end_date: date
    title: Optional[str] = Field(default=None, max_length=220)
    status: InventoryPeriodStatus = InventoryPeriodStatus.DRAFT
    notes: Optional[str] = None
    rejection_reason: Optional[str] = None
    summary_json: JsonDict = Field(default_factory=dict)
    settings_json: JsonDict = Field(default_factory=dict)

    @model_validator(mode="after")
    def validate_period_dates(self):
        if self.end_date < self.start_date:
            raise ValueError("end_date must be greater than or equal to start_date")
        return self


class InventoryPeriodCreate(InventoryPeriodBase):
    pass


class InventoryPeriodUpdate(ORMBaseModel):
    period_type: Optional[InventoryPeriodType] = None
    period_date: Optional[date] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    title: Optional[str] = Field(default=None, max_length=220)
    status: Optional[InventoryPeriodStatus] = None
    notes: Optional[str] = None
    rejection_reason: Optional[str] = None
    summary_json: Optional[JsonDict] = None
    settings_json: Optional[JsonDict] = None


class InventoryPeriodOut(InventoryPeriodBase):
    id: int
    inventory_id: int
    submitted_by_user_id: Optional[int] = None
    approved_by_user_id: Optional[int] = None
    rejected_by_user_id: Optional[int] = None
    locked_by_user_id: Optional[int] = None
    submitted_at: Optional[datetime] = None
    approved_at: Optional[datetime] = None
    rejected_at: Optional[datetime] = None
    locked_at: Optional[datetime] = None
    created_by_user_id: Optional[int] = None
    updated_by_user_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime


class InventoryPeriodDetailOut(InventoryPeriodOut):
    fields: List[InventoryFieldOut] = Field(default_factory=list)
    rows: List[InventoryRowOut] = Field(default_factory=list)
    summary: JsonDict = Field(default_factory=dict)


# =============================================================================
# Main inventory module schemas
# =============================================================================


class DynamicInventoryBase(ORMBaseModel):
    title: str = Field(..., min_length=1, max_length=180)
    slug: Optional[str] = Field(default=None, max_length=220)
    description: Optional[str] = None
    department: RanchDepartment
    inventory_type: InventoryTemplateType
    template_id: Optional[int] = None
    report_title: Optional[str] = Field(default=None, max_length=220)
    reporter_name: Optional[str] = Field(default=None, max_length=180)
    company_name: Optional[str] = Field(default=None, max_length=180)
    logo_url: Optional[str] = None
    access_type: InventoryAccessType = InventoryAccessType.ASSIGNED_USERS
    status: InventoryStatus = InventoryStatus.ACTIVE
    is_active: bool = True
    report_date_field_id: Optional[int] = None
    calculation_profile_json: JsonDict = Field(default_factory=dict)
    settings_json: JsonDict = Field(default_factory=dict)
    report_config_json: JsonDict = Field(default_factory=dict)
    dashboard_config_json: JsonDict = Field(default_factory=dict)


class DynamicInventoryCreate(DynamicInventoryBase):
    fields: List[InventoryFieldCreate] = Field(default_factory=list)
    calculation_rules: List[InventoryCalculationRuleCreate] = Field(default_factory=list)
    metrics: List["InventoryMetricCreate"] = Field(default_factory=list)
    user_access: List["InventoryAccessCreate"] = Field(default_factory=list)
    credentials: List["InventoryCredentialCreate"] = Field(default_factory=list)


class CreateInventoryFromTemplatePayload(ORMBaseModel):
    title: str = Field(..., min_length=1, max_length=180)
    department: RanchDepartment
    inventory_type: InventoryTemplateType
    template_id: Optional[int] = None
    description: Optional[str] = None
    report_title: Optional[str] = None
    reporter_name: Optional[str] = None
    company_name: Optional[str] = None
    access_type: InventoryAccessType = InventoryAccessType.ASSIGNED_USERS
    settings_json: JsonDict = Field(default_factory=dict)
    assigned_user_ids: List[int] = Field(default_factory=list)


class DynamicInventoryUpdate(ORMBaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=180)
    slug: Optional[str] = Field(default=None, max_length=220)
    description: Optional[str] = None
    department: Optional[RanchDepartment] = None
    inventory_type: Optional[InventoryTemplateType] = None
    template_id: Optional[int] = None
    report_title: Optional[str] = Field(default=None, max_length=220)
    reporter_name: Optional[str] = Field(default=None, max_length=180)
    company_name: Optional[str] = Field(default=None, max_length=180)
    logo_url: Optional[str] = None
    access_type: Optional[InventoryAccessType] = None
    status: Optional[InventoryStatus] = None
    is_active: Optional[bool] = None
    report_date_field_id: Optional[int] = None
    calculation_profile_json: Optional[JsonDict] = None
    settings_json: Optional[JsonDict] = None
    report_config_json: Optional[JsonDict] = None
    dashboard_config_json: Optional[JsonDict] = None


class DynamicInventorySummaryOut(ORMBaseModel):
    id: int
    title: str
    slug: str
    description: Optional[str] = None
    department: RanchDepartment
    inventory_type: InventoryTemplateType
    template_id: Optional[int] = None
    report_title: Optional[str] = None
    reporter_name: Optional[str] = None
    company_name: Optional[str] = None
    access_type: InventoryAccessType
    status: InventoryStatus
    is_active: bool
    last_period_status: Optional[InventoryPeriodStatus] = None
    today_period_id: Optional[int] = None
    today_row_count: int = 0
    pending_approvals: int = 0
    open_alerts: int = 0
    created_at: datetime
    updated_at: datetime


class DynamicInventoryOut(DynamicInventoryBase):
    id: int
    slug: str
    created_by_user_id: Optional[int] = None
    updated_by_user_id: Optional[int] = None
    archived_by_user_id: Optional[int] = None
    deleted_by_user_id: Optional[int] = None
    archived_at: Optional[datetime] = None
    deleted_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    fields: List[InventoryFieldOut] = Field(default_factory=list)
    calculation_rules: List[InventoryCalculationRuleOut] = Field(default_factory=list)
    metrics: List["InventoryMetricOut"] = Field(default_factory=list)
    user_access: List["InventoryAccessOut"] = Field(default_factory=list)
    credentials: List["InventoryCredentialOut"] = Field(default_factory=list)


class DepartmentGroupOut(ORMBaseModel):
    department: RanchDepartment
    title: str
    description: Optional[str] = None
    inventories: List[DynamicInventorySummaryOut] = Field(default_factory=list)
    totals: JsonDict = Field(default_factory=dict)


class RanchDashboardOut(ORMBaseModel):
    title: str = "Ranch Management"
    departments: List[DepartmentGroupOut] = Field(default_factory=list)
    totals: JsonDict = Field(default_factory=dict)
    recent_alerts: List["InventoryAlertOut"] = Field(default_factory=list)
    pending_approvals: List[InventoryPeriodOut] = Field(default_factory=list)


# =============================================================================
# Metrics and report schemas
# =============================================================================


class InventoryMetricBase(ORMBaseModel):
    field_id: Optional[int] = None
    calculation_rule_id: Optional[int] = None
    metric_key: str = Field(..., min_length=1, max_length=140)
    metric_type: InventoryMetricType
    label: str = Field(..., min_length=1, max_length=180)
    description: Optional[str] = None
    unit_label: Optional[str] = Field(default=None, max_length=40)
    is_enabled: bool = True
    is_report_visible: bool = True
    is_dashboard_visible: bool = True
    order_index: int = 0
    formula_expression: Optional[str] = None
    formula_scope: InventoryFormulaScope = InventoryFormulaScope.REPORT
    is_auto_calculated: bool = True
    settings_json: JsonDict = Field(default_factory=dict)


class InventoryMetricCreate(InventoryMetricBase):
    pass


class InventoryMetricUpdate(ORMBaseModel):
    field_id: Optional[int] = None
    calculation_rule_id: Optional[int] = None
    metric_key: Optional[str] = Field(default=None, min_length=1, max_length=140)
    metric_type: Optional[InventoryMetricType] = None
    label: Optional[str] = Field(default=None, min_length=1, max_length=180)
    description: Optional[str] = None
    unit_label: Optional[str] = Field(default=None, max_length=40)
    is_enabled: Optional[bool] = None
    is_report_visible: Optional[bool] = None
    is_dashboard_visible: Optional[bool] = None
    order_index: Optional[int] = None
    formula_expression: Optional[str] = None
    formula_scope: Optional[InventoryFormulaScope] = None
    is_auto_calculated: Optional[bool] = None
    settings_json: Optional[JsonDict] = None


class InventoryMetricOut(InventoryMetricBase):
    id: int
    inventory_id: int
    created_by_user_id: Optional[int] = None
    updated_by_user_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime


class InventoryMetricValueOut(ORMBaseModel):
    metric_id: Optional[int] = None
    metric_key: str
    label: str
    metric_type: InventoryMetricType
    value: Optional[Union[int, float, Decimal, str]] = None
    unit_label: Optional[str] = None
    field_key: Optional[str] = None
    calculation_rule_key: Optional[str] = None


class InventorySummaryOut(ORMBaseModel):
    row_count: int = 0
    input_totals: JsonDict = Field(default_factory=dict)
    output_totals: JsonDict = Field(default_factory=dict)
    metrics: List[InventoryMetricValueOut] = Field(default_factory=list)
    alerts: JsonDict = Field(default_factory=dict)


class InventoryReportRequest(DateRangePayload):
    report_type: InventoryReportType = InventoryReportType.DAILY
    report_format: Optional[InventoryReportFormat] = None
    period_id: Optional[int] = None
    include_inputs: bool = True
    include_outputs: bool = True
    include_summary: bool = True
    include_raw_data: bool = True
    visible_fields_only: bool = True
    lock_report_snapshot: bool = False
    options: JsonDict = Field(default_factory=dict)


class InventoryReportBase(ORMBaseModel):
    report_type: InventoryReportType
    report_format: InventoryReportFormat
    status: InventoryReportStatus = InventoryReportStatus.GENERATED
    title: str = Field(..., min_length=1, max_length=220)
    start_date: date
    end_date: date
    file_url: Optional[str] = None
    file_name: Optional[str] = Field(default=None, max_length=260)
    file_size_bytes: Optional[int] = None
    error_message: Optional[str] = None
    input_snapshot_json: JsonDict = Field(default_factory=dict)
    output_snapshot_json: JsonDict = Field(default_factory=dict)
    summary_json: JsonDict = Field(default_factory=dict)
    report_config_json: JsonDict = Field(default_factory=dict)


class InventoryReportCreate(InventoryReportBase):
    period_id: Optional[int] = None


class InventoryReportOut(InventoryReportBase):
    id: int
    inventory_id: int
    period_id: Optional[int] = None
    generated_by_user_id: Optional[int] = None
    generated_at: datetime
    locked_at: Optional[datetime] = None
    archived_at: Optional[datetime] = None
    created_by_user_id: Optional[int] = None
    updated_by_user_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime


class InventoryReportDataOut(ORMBaseModel):
    inventory: DynamicInventorySummaryOut
    report_title: str
    report_type: InventoryReportType
    start_date: date
    end_date: date
    fields: List[InventoryFieldOut] = Field(default_factory=list)
    rows: List[InventoryRowOut] = Field(default_factory=list)
    summary: InventorySummaryOut = Field(default_factory=InventorySummaryOut)
    generated_at: datetime = Field(default_factory=datetime.utcnow)


# =============================================================================
# Access / credentials
# =============================================================================


class InventoryAccessBase(ORMBaseModel):
    user_id: int
    role: InventoryUserRole = InventoryUserRole.EDITOR
    can_add_rows: bool = True
    can_edit_rows: bool = True
    can_delete_rows: bool = False
    can_submit_periods: bool = True
    can_approve_periods: bool = False
    can_view_history: bool = True
    can_export_reports: bool = True
    can_manage_fields: bool = False
    can_manage_users: bool = False
    can_manage_templates: bool = False
    can_manage_lookups: bool = False
    is_active: bool = True
    expires_at: Optional[datetime] = None
    settings_json: JsonDict = Field(default_factory=dict)


class InventoryAccessCreate(InventoryAccessBase):
    pass


class InventoryAccessUpdate(ORMBaseModel):
    role: Optional[InventoryUserRole] = None
    can_add_rows: Optional[bool] = None
    can_edit_rows: Optional[bool] = None
    can_delete_rows: Optional[bool] = None
    can_submit_periods: Optional[bool] = None
    can_approve_periods: Optional[bool] = None
    can_view_history: Optional[bool] = None
    can_export_reports: Optional[bool] = None
    can_manage_fields: Optional[bool] = None
    can_manage_users: Optional[bool] = None
    can_manage_templates: Optional[bool] = None
    can_manage_lookups: Optional[bool] = None
    is_active: Optional[bool] = None
    expires_at: Optional[datetime] = None
    settings_json: Optional[JsonDict] = None


class InventoryAccessOut(InventoryAccessBase):
    id: int
    inventory_id: int
    created_by_user_id: Optional[int] = None
    updated_by_user_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime


class InventoryCredentialBase(ORMBaseModel):
    username: str = Field(..., min_length=3, max_length=120)
    role: InventoryUserRole = InventoryUserRole.EDITOR
    must_change_password: bool = True
    is_active: bool = True
    expires_at: Optional[datetime] = None
    permissions_json: JsonDict = Field(default_factory=dict)
    settings_json: JsonDict = Field(default_factory=dict)


class InventoryCredentialCreate(InventoryCredentialBase):
    password: str = Field(..., min_length=6, max_length=128)


class InventoryCredentialUpdate(ORMBaseModel):
    username: Optional[str] = Field(default=None, min_length=3, max_length=120)
    password: Optional[str] = Field(default=None, min_length=6, max_length=128)
    role: Optional[InventoryUserRole] = None
    must_change_password: Optional[bool] = None
    is_active: Optional[bool] = None
    expires_at: Optional[datetime] = None
    permissions_json: Optional[JsonDict] = None
    settings_json: Optional[JsonDict] = None


class InventoryCredentialOut(InventoryCredentialBase):
    id: int
    inventory_id: int
    last_login_at: Optional[datetime] = None
    created_by_user_id: Optional[int] = None
    updated_by_user_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime


# =============================================================================
# Alerts, audit logs, attachments
# =============================================================================


class InventoryAlertBase(ORMBaseModel):
    period_id: Optional[int] = None
    row_id: Optional[int] = None
    alert_key: str = Field(..., min_length=1, max_length=140)
    title: str = Field(..., min_length=1, max_length=220)
    message: Optional[str] = None
    level: InventoryAlertLevel = InventoryAlertLevel.INFO
    status: InventoryAlertStatus = InventoryAlertStatus.OPEN
    threshold_json: JsonDict = Field(default_factory=dict)
    context_json: JsonDict = Field(default_factory=dict)


class InventoryAlertCreate(InventoryAlertBase):
    pass


class InventoryAlertUpdate(ORMBaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=220)
    message: Optional[str] = None
    level: Optional[InventoryAlertLevel] = None
    status: Optional[InventoryAlertStatus] = None
    threshold_json: Optional[JsonDict] = None
    context_json: Optional[JsonDict] = None


class InventoryAlertOut(InventoryAlertBase):
    id: int
    inventory_id: int
    acknowledged_by_user_id: Optional[int] = None
    resolved_by_user_id: Optional[int] = None
    acknowledged_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None
    created_by_user_id: Optional[int] = None
    updated_by_user_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime


class InventoryAuditLogOut(ORMBaseModel):
    id: int
    inventory_id: Optional[int] = None
    period_id: Optional[int] = None
    row_id: Optional[int] = None
    field_id: Optional[int] = None
    actor_user_id: Optional[int] = None
    action: InventoryAuditAction
    description: Optional[str] = None
    old_value_json: Optional[JsonDict] = None
    new_value_json: Optional[JsonDict] = None
    context_json: JsonDict = Field(default_factory=dict)
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    created_at: datetime


class InventoryAttachmentBase(ORMBaseModel):
    period_id: Optional[int] = None
    row_id: Optional[int] = None
    field_id: Optional[int] = None
    file_name: str = Field(..., min_length=1, max_length=260)
    file_url: str
    content_type: Optional[str] = Field(default=None, max_length=120)
    file_size_bytes: Optional[int] = None
    description: Optional[str] = None
    metadata_json: JsonDict = Field(default_factory=dict)


class InventoryAttachmentCreate(InventoryAttachmentBase):
    pass


class InventoryAttachmentUpdate(ORMBaseModel):
    file_name: Optional[str] = Field(default=None, min_length=1, max_length=260)
    file_url: Optional[str] = None
    content_type: Optional[str] = Field(default=None, max_length=120)
    file_size_bytes: Optional[int] = None
    description: Optional[str] = None
    metadata_json: Optional[JsonDict] = None


class InventoryAttachmentOut(InventoryAttachmentBase):
    id: int
    inventory_id: int
    created_by_user_id: Optional[int] = None
    updated_by_user_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime


# =============================================================================
# Ranch template convenience payloads
# =============================================================================


class DepartmentTemplateOptionOut(ORMBaseModel):
    department: RanchDepartment
    inventory_type: InventoryTemplateType
    template_id: Optional[int] = None
    template_key: Optional[str] = None
    name: str
    description: Optional[str] = None
    standard_inputs: List[str] = Field(default_factory=list)
    automatic_outputs: List[str] = Field(default_factory=list)
    report_metrics: List[str] = Field(default_factory=list)


class RanchDepartmentConfigOut(ORMBaseModel):
    department: RanchDepartment
    label: str
    description: str
    lookup_groups: List[InventoryLookupGroup] = Field(default_factory=list)
    templates: List[DepartmentTemplateOptionOut] = Field(default_factory=list)


class SystemCalculationPreviewRequest(ORMBaseModel):
    department: RanchDepartment
    inventory_type: InventoryTemplateType
    values: Dict[str, PrimitiveValue] = Field(default_factory=dict)


class SystemCalculationPreviewOut(ORMBaseModel):
    department: RanchDepartment
    inventory_type: InventoryTemplateType
    inputs: Dict[str, PrimitiveValue] = Field(default_factory=dict)
    outputs: Dict[str, PrimitiveValue] = Field(default_factory=dict)
    explanations: List[str] = Field(default_factory=list)


# =============================================================================
# Backward-compatible aliases for earlier route/service names
# =============================================================================


InventoryCreate = DynamicInventoryCreate
InventoryUpdate = DynamicInventoryUpdate
InventoryOut = DynamicInventoryOut
InventorySummaryListOut = DynamicInventorySummaryOut
InventoryHistoryOut = ORMBaseModel  # service can replace with concrete response if needed

# Resolve forward refs for Pydantic v2
for _model in [
    DynamicInventoryCreate,
    DynamicInventoryOut,
    RanchDashboardOut,
]:
    try:
        _model.model_rebuild()
    except Exception:
        pass
