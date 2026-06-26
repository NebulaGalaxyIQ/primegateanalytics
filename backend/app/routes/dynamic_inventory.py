"""
Dynamic Ranch Inventory Router
==============================

Place this file at:
    backend/app/routes/dynamic_inventory.py

Then include it in your FastAPI app:
    from app.routes.dynamic_inventory import router as dynamic_inventory_router
    app.include_router(dynamic_inventory_router)

This router exposes the unified Ranch Management Inventory Engine for:
- Crops Department
- Animals Department
- Machineries & Maintenance

Design rule:
Users enter INPUT values only. The backend service calculates OUTPUT values
from system-owned department templates and calculation rules.

Auth note:
This router reads temporary headers so it works immediately while you connect
it to your real auth dependency:
    X-User-Id: 1
    X-Is-Admin: true
"""

from __future__ import annotations

from datetime import date
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from sqlalchemy.orm import Session

try:
    from app.core.database import get_db
except Exception as exc:  # pragma: no cover
    raise RuntimeError(
        "Could not import app.database.get_db. Adjust the import in "
        "app/routes/dynamic_inventory.py to match your project."
    ) from exc

from app.models.dynamic_inventory import (
    InventoryAlertStatus,
    InventoryLookupGroup,
    InventoryPeriodType,
    InventoryReportFormat,
    InventoryReportType,
    InventoryTemplateType,
    RanchDepartment,
)
from app.schemas.dynamic_inventory import (
    CreateInventoryFromTemplatePayload,
    DateRangePayload,
    DynamicInventoryOut,
    DynamicInventorySummaryOut,
    InventoryAccessCreate,
    InventoryAccessOut,
    InventoryAlertCreate,
    InventoryAlertOut,
    InventoryAttachmentCreate,
    InventoryAttachmentOut,
    InventoryAuditLogOut,
    InventoryCredentialCreate,
    InventoryCredentialOut,
    InventoryOut,
    InventoryPeriodCreate,
    InventoryPeriodDetailOut,
    InventoryPeriodOut,
    InventoryReportDataOut,
    InventoryReportRequest,
    InventoryRowCreate,
    InventoryRowOut,
    InventoryRowUpdate,
    InventoryTemplateOut,
    InventoryCreate,
    InventoryUpdate,
    LookupOptionCreate,
    LookupOptionOut,
    MessageOut,
    PeriodActionPayload,
    RanchDashboardOut,
    RowDeletePayload,
)
from app.services.dynamic_inventory_service import DynamicInventoryService


router = APIRouter(prefix="/inventory-systems", tags=["Ranch Inventory"])


@router.get("/health", response_model=MessageOut)
def dynamic_inventory_health_early():
    return {"message": "Ranch inventory system is running"}


# =============================================================================
# Auth helpers
# =============================================================================


def get_actor_user_id(request: Request) -> Optional[int]:
    """Temporary user resolver; replace with your real auth dependency."""

    raw = request.headers.get("X-User-Id") or request.headers.get("x-user-id")
    if not raw:
        return None
    try:
        return int(raw)
    except (TypeError, ValueError):
        return None



def is_admin_request(request: Request) -> bool:
    """Temporary admin resolver; replace with your real role check."""

    raw = request.headers.get("X-Is-Admin") or request.headers.get("x-is-admin")
    if raw is None:
        # Keep admin-friendly by default while developing locally.
        return True
    return str(raw).strip().lower() in {"1", "true", "yes", "y", "admin", "superuser"}



def _empty_to_none(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    value = str(value).strip()
    return value or None





def _enum_value_safe(value):
    if value is None:
        return None
    if hasattr(value, "value"):
        return value.value
    return value


def _lookup_option_response(option):
    """Return a response-model safe lookup option payload.

    Some deployed databases/models do not have physical option_key/code columns,
    while the API schema expects option_key. Build option_key from value/label so
    /inventory-systems/lookup-options never fails response validation.
    """

    label = getattr(option, "label", None) or ""
    value = getattr(option, "value", None) or label
    option_key = getattr(option, "option_key", None) or str(value or label or getattr(option, "id", "option")).strip().lower().replace(" ", "_")

    return {
        "id": getattr(option, "id", None),
        "department": _enum_value_safe(getattr(option, "department", None)),
        "group": _enum_value_safe(getattr(option, "group", None)),
        "option_key": option_key,
        "label": label,
        "value": value,
        "code": getattr(option, "code", None),
        "parent_group": _enum_value_safe(getattr(option, "parent_group", None)),
        "parent_value": getattr(option, "parent_value", None),
        "description": getattr(option, "description", None),
        "metadata_json": getattr(option, "metadata_json", None) or {},
        "is_system_option": bool(getattr(option, "is_system_option", False)),
        "is_active": bool(getattr(option, "is_active", True)),
        "order_index": int(getattr(option, "order_index", 0) or 0),
        "created_by_user_id": getattr(option, "created_by_user_id", None),
        "updated_by_user_id": getattr(option, "updated_by_user_id", None),
        "created_at": getattr(option, "created_at", None),
        "updated_at": getattr(option, "updated_at", None),
    }


def _report_request_from_query(
    *,
    report_type: InventoryReportType,
    start_date: date,
    end_date: date,
    report_format: Optional[InventoryReportFormat] = None,
    period_id: Optional[int] = None,
    include_inputs: bool = True,
    include_outputs: bool = True,
    include_summary: bool = True,
    include_raw_data: bool = True,
    visible_fields_only: bool = True,
) -> InventoryReportRequest:
    return InventoryReportRequest(
        report_type=report_type,
        report_format=report_format,
        period_id=period_id,
        start_date=start_date,
        end_date=end_date,
        include_inputs=include_inputs,
        include_outputs=include_outputs,
        include_summary=include_summary,
        include_raw_data=include_raw_data,
        visible_fields_only=visible_fields_only,
    )


# =============================================================================
# Seeding / setup
# =============================================================================


@router.post("/seed/lookups", response_model=Dict[str, int])
def seed_lookup_options(request: Request, db: Session = Depends(get_db)):
    """Seed default lookup options such as animal/crop/machine types."""

    return DynamicInventoryService.seed_default_lookup_options(
        db,
        actor_user_id=get_actor_user_id(request),
    )


@router.post("/seed/templates", response_model=Dict[str, int])
def seed_templates(request: Request, db: Session = Depends(get_db)):
    """Seed default ranch templates with input fields and automatic outputs."""

    return DynamicInventoryService.seed_default_templates(
        db,
        actor_user_id=get_actor_user_id(request),
    )


@router.post("/seed/defaults", response_model=Dict[str, Dict[str, int]])
def seed_all_defaults(request: Request, db: Session = Depends(get_db)):
    """Seed both lookup options and templates."""

    user_id = get_actor_user_id(request)
    return {
        "lookup_options": DynamicInventoryService.seed_default_lookup_options(db, actor_user_id=user_id),
        "templates": DynamicInventoryService.seed_default_templates(db, actor_user_id=user_id),
    }


# =============================================================================
# Dashboard / department navigation
# =============================================================================


@router.get("/dashboard", response_model=RanchDashboardOut)
def get_ranch_inventory_dashboard(
    request: Request,
    db: Session = Depends(get_db),
):
    return DynamicInventoryService.get_dashboard(
        db,
        user_id=get_actor_user_id(request),
        is_admin=is_admin_request(request),
    )


@router.get("/department-options", response_model=List[Dict[str, Any]])
def get_department_options():
    """Return department options for frontend filters/dropdowns."""

    return [
        {
            "department": RanchDepartment.CROPS.value,
            "label": "Crops Department",
            "description": "Crop stock, harvests, seeds, fertilizer, chemicals, irrigation, and crop sales.",
        },
        {
            "department": RanchDepartment.ANIMALS.value,
            "label": "Animals Department",
            "description": "Animal stock, births, deaths, purchases, sales, feed, vaccination, and treatment records.",
        },
        {
            "department": RanchDepartment.MACHINERY.value,
            "label": "Machineries & Maintenance",
            "description": "Fuel usage, service records, repairs, spare parts, breakdowns, and running hours.",
        },
    ]


@router.get("/inventory-type-options", response_model=List[Dict[str, Any]])
def get_inventory_type_options(department: Optional[RanchDepartment] = Query(default=None)):
    """Return inventory type options, optionally filtered by department."""

    animals = {
        InventoryTemplateType.GOAT_INVENTORY,
        InventoryTemplateType.CATTLE_INVENTORY,
        InventoryTemplateType.SHEEP_INVENTORY,
        InventoryTemplateType.POULTRY_INVENTORY,
        InventoryTemplateType.ANIMAL_MOVEMENT,
        InventoryTemplateType.ANIMAL_BIRTHS,
        InventoryTemplateType.ANIMAL_DEATHS,
        InventoryTemplateType.ANIMAL_SALES,
        InventoryTemplateType.ANIMAL_PURCHASES,
        InventoryTemplateType.FEED_INVENTORY,
        InventoryTemplateType.VACCINATION_RECORDS,
        InventoryTemplateType.TREATMENT_RECORDS,
        InventoryTemplateType.MILK_PRODUCTION,
        InventoryTemplateType.EGG_PRODUCTION,
    }
    crops = {
        InventoryTemplateType.CROP_STOCK,
        InventoryTemplateType.CROP_PLANTING,
        InventoryTemplateType.HARVEST_RECORDS,
        InventoryTemplateType.SEEDS_INVENTORY,
        InventoryTemplateType.FERTILIZER_INVENTORY,
        InventoryTemplateType.CHEMICAL_INVENTORY,
        InventoryTemplateType.IRRIGATION_RECORDS,
        InventoryTemplateType.CROP_SALES,
        InventoryTemplateType.STORAGE_STOCK,
        InventoryTemplateType.FIELD_RECORDS,
        InventoryTemplateType.CROP_PRODUCTION_COST,
    }
    machinery = {
        InventoryTemplateType.MACHINERY_REGISTER,
        InventoryTemplateType.FUEL_USAGE,
        InventoryTemplateType.SERVICE_RECORDS,
        InventoryTemplateType.REPAIR_RECORDS,
        InventoryTemplateType.SPARE_PARTS_INVENTORY,
        InventoryTemplateType.MAINTENANCE_SCHEDULE,
        InventoryTemplateType.BREAKDOWN_RECORDS,
        InventoryTemplateType.OIL_CHANGE_RECORDS,
        InventoryTemplateType.TYRE_RECORDS,
        InventoryTemplateType.OPERATOR_RECORDS,
        InventoryTemplateType.MACHINE_RUNNING_HOURS,
    }

    allowed: Optional[set] = None
    if department == RanchDepartment.ANIMALS:
        allowed = animals
    elif department == RanchDepartment.CROPS:
        allowed = crops
    elif department == RanchDepartment.MACHINERY:
        allowed = machinery

    items = []
    for item in InventoryTemplateType:
        if item == InventoryTemplateType.CUSTOM:
            dept = None
        elif item in animals:
            dept = RanchDepartment.ANIMALS
        elif item in crops:
            dept = RanchDepartment.CROPS
        elif item in machinery:
            dept = RanchDepartment.MACHINERY
        else:
            dept = None

        if allowed is not None and item not in allowed:
            continue

        items.append(
            {
                "inventory_type": item.value,
                "department": dept.value if dept else None,
                "label": item.value.replace("_", " ").title(),
            }
        )
    return items


# =============================================================================
# Templates
# =============================================================================


@router.get("/templates", response_model=List[InventoryTemplateOut])
def list_templates(
    department: Optional[RanchDepartment] = Query(default=None),
    active_only: bool = Query(default=True),
    db: Session = Depends(get_db),
):
    return DynamicInventoryService.list_templates(db, department=department, active_only=active_only)


@router.get("/templates/{template_id:int}", response_model=InventoryTemplateOut)
def get_template(template_id: int, db: Session = Depends(get_db)):
    return DynamicInventoryService.get_template(db, template_id)


@router.post("/from-template", response_model=DynamicInventoryOut, status_code=status.HTTP_201_CREATED)
def create_inventory_from_template(
    payload: CreateInventoryFromTemplatePayload,
    request: Request,
    db: Session = Depends(get_db),
):
    return DynamicInventoryService.create_inventory_from_template(
        db,
        payload,
        actor_user_id=get_actor_user_id(request),
    )


# =============================================================================
# Lookup options / dropdown data
# =============================================================================


@router.get("/lookup-options", response_model=List[LookupOptionOut])
def list_lookup_options(
    group: Optional[InventoryLookupGroup] = Query(default=None),
    department: Optional[RanchDepartment] = Query(default=None),
    active_only: bool = Query(default=True),
    db: Session = Depends(get_db),
):
    options = DynamicInventoryService.list_lookup_options(
        db,
        group=group,
        department=department,
        active_only=active_only,
    )
    return [_lookup_option_response(option) for option in options]


@router.post("/lookup-options", response_model=LookupOptionOut, status_code=status.HTTP_201_CREATED)
def create_lookup_option(
    payload: LookupOptionCreate,
    request: Request,
    db: Session = Depends(get_db),
):
    option = DynamicInventoryService.create_lookup_option(
        db,
        payload,
        actor_user_id=get_actor_user_id(request),
    )
    return _lookup_option_response(option)


# =============================================================================
# Inventory modules
# =============================================================================


@router.post("", response_model=DynamicInventoryOut, status_code=status.HTTP_201_CREATED)
def create_inventory(
    payload: InventoryCreate,
    request: Request,
    db: Session = Depends(get_db),
):
    return DynamicInventoryService.create_inventory(
        db,
        payload,
        actor_user_id=get_actor_user_id(request),
    )


@router.get("", response_model=List[DynamicInventoryOut])
def list_inventories(
    request: Request,
    department: Optional[RanchDepartment] = Query(default=None),
    inventory_type: Optional[InventoryTemplateType] = Query(default=None),
    include_archived: bool = Query(default=False),
    include_deleted: bool = Query(default=False),
    search: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
):
    return DynamicInventoryService.list_inventories(
        db,
        department=department,
        inventory_type=inventory_type,
        include_archived=include_archived,
        include_deleted=include_deleted,
        user_id=get_actor_user_id(request),
        is_admin=is_admin_request(request),
        search=_empty_to_none(search),
    )


@router.get("/summaries", response_model=List[DynamicInventorySummaryOut])
def list_inventory_summaries(
    request: Request,
    department: Optional[RanchDepartment] = Query(default=None),
    inventory_type: Optional[InventoryTemplateType] = Query(default=None),
    include_archived: bool = Query(default=False),
    include_deleted: bool = Query(default=False),
    search: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
):
    return DynamicInventoryService.list_inventory_summaries(
        db,
        department=department,
        inventory_type=inventory_type,
        include_archived=include_archived,
        include_deleted=include_deleted,
        user_id=get_actor_user_id(request),
        is_admin=is_admin_request(request),
        search=_empty_to_none(search),
    )


@router.get("/{inventory_id:int}", response_model=DynamicInventoryOut)
def get_inventory(
    inventory_id: int,
    include_deleted: bool = Query(default=False),
    db: Session = Depends(get_db),
):
    return DynamicInventoryService.get_inventory(db, inventory_id, include_deleted=include_deleted)


@router.put("/{inventory_id:int}", response_model=DynamicInventoryOut)
def update_inventory(
    inventory_id: int,
    payload: InventoryUpdate,
    request: Request,
    db: Session = Depends(get_db),
):
    return DynamicInventoryService.update_inventory(
        db,
        inventory_id,
        payload,
        actor_user_id=get_actor_user_id(request),
    )


@router.patch("/{inventory_id:int}", response_model=DynamicInventoryOut)
def patch_inventory(
    inventory_id: int,
    payload: InventoryUpdate,
    request: Request,
    db: Session = Depends(get_db),
):
    return DynamicInventoryService.update_inventory(
        db,
        inventory_id,
        payload,
        actor_user_id=get_actor_user_id(request),
    )


@router.patch("/{inventory_id:int}/archive", response_model=DynamicInventoryOut)
def archive_inventory(inventory_id: int, request: Request, db: Session = Depends(get_db)):
    return DynamicInventoryService.archive_inventory(
        db,
        inventory_id,
        actor_user_id=get_actor_user_id(request),
    )


@router.patch("/{inventory_id:int}/restore", response_model=DynamicInventoryOut)
def restore_inventory(inventory_id: int, request: Request, db: Session = Depends(get_db)):
    return DynamicInventoryService.restore_inventory(
        db,
        inventory_id,
        actor_user_id=get_actor_user_id(request),
    )


@router.delete("/{inventory_id:int}", response_model=Dict[str, Any])
def delete_inventory(
    inventory_id: int,
    request: Request,
    permanent: bool = Query(default=False),
    db: Session = Depends(get_db),
):
    return DynamicInventoryService.delete_inventory(
        db,
        inventory_id,
        permanent=permanent,
        actor_user_id=get_actor_user_id(request),
    )


# =============================================================================
# Periods / daily sheets
# =============================================================================


@router.get("/{inventory_id:int}/today", response_model=InventoryPeriodDetailOut)
def get_today_period(inventory_id: int, request: Request, db: Session = Depends(get_db)):
    return DynamicInventoryService.get_or_create_today_period(
        db,
        inventory_id,
        actor_user_id=get_actor_user_id(request),
    )


@router.post("/{inventory_id:int}/periods", response_model=InventoryPeriodOut, status_code=status.HTTP_201_CREATED)
def create_period(
    inventory_id: int,
    payload: InventoryPeriodCreate,
    request: Request,
    db: Session = Depends(get_db),
):
    return DynamicInventoryService.create_period(
        db,
        inventory_id,
        payload,
        actor_user_id=get_actor_user_id(request),
    )


@router.get("/{inventory_id:int}/periods/get-or-create", response_model=InventoryPeriodOut)
def get_or_create_period(
    inventory_id: int,
    request: Request,
    period_date: Optional[date] = Query(default=None),
    period_type: InventoryPeriodType = Query(default=InventoryPeriodType.DAILY),
    db: Session = Depends(get_db),
):
    return DynamicInventoryService.get_or_create_period(
        db,
        inventory_id,
        period_date=period_date,
        period_type=period_type,
        actor_user_id=get_actor_user_id(request),
    )


@router.get("/periods/{period_id:int}", response_model=InventoryPeriodDetailOut)
def get_period_detail(period_id: int, db: Session = Depends(get_db)):
    return DynamicInventoryService.get_period_detail(db, period_id)


@router.post("/periods/{period_id:int}/submit", response_model=InventoryPeriodOut)
def submit_period(
    period_id: int,
    payload: PeriodActionPayload,
    request: Request,
    db: Session = Depends(get_db),
):
    return DynamicInventoryService.submit_period(
        db,
        period_id,
        payload,
        actor_user_id=get_actor_user_id(request),
    )


@router.post("/periods/{period_id:int}/approve", response_model=InventoryPeriodOut)
def approve_period(
    period_id: int,
    payload: PeriodActionPayload,
    request: Request,
    db: Session = Depends(get_db),
):
    return DynamicInventoryService.approve_period(
        db,
        period_id,
        payload,
        actor_user_id=get_actor_user_id(request),
    )


@router.post("/periods/{period_id:int}/reject", response_model=InventoryPeriodOut)
def reject_period(
    period_id: int,
    payload: PeriodActionPayload,
    request: Request,
    db: Session = Depends(get_db),
):
    return DynamicInventoryService.reject_period(
        db,
        period_id,
        payload,
        actor_user_id=get_actor_user_id(request),
    )


@router.post("/periods/{period_id:int}/lock", response_model=InventoryPeriodOut)
def lock_period(period_id: int, request: Request, db: Session = Depends(get_db)):
    return DynamicInventoryService.lock_period(
        db,
        period_id,
        actor_user_id=get_actor_user_id(request),
    )


@router.post("/periods/{period_id:int}/recalculate", response_model=Dict[str, Any])
def recalculate_period(period_id: int, db: Session = Depends(get_db)):
    """Recalculate all system output fields for every row in a period."""

    return DynamicInventoryService.recalculate_period(db, period_id, commit=True)


# =============================================================================
# Rows / records
# =============================================================================


@router.post("/{inventory_id:int}/periods/{period_id:int}/rows", response_model=InventoryRowOut, status_code=status.HTTP_201_CREATED)
def create_row(
    inventory_id: int,
    period_id: int,
    payload: InventoryRowCreate,
    request: Request,
    db: Session = Depends(get_db),
):
    return DynamicInventoryService.create_row(
        db,
        inventory_id,
        period_id,
        payload,
        actor_user_id=get_actor_user_id(request),
    )


@router.put("/rows/{row_id:int}", response_model=InventoryRowOut)
def update_row(
    row_id: int,
    payload: InventoryRowUpdate,
    request: Request,
    db: Session = Depends(get_db),
):
    return DynamicInventoryService.update_row(
        db,
        row_id,
        payload,
        actor_user_id=get_actor_user_id(request),
    )


@router.patch("/rows/{row_id:int}", response_model=InventoryRowOut)
def patch_row(
    row_id: int,
    payload: InventoryRowUpdate,
    request: Request,
    db: Session = Depends(get_db),
):
    return DynamicInventoryService.update_row(
        db,
        row_id,
        payload,
        actor_user_id=get_actor_user_id(request),
    )


@router.delete("/rows/{row_id:int}", response_model=Dict[str, Any])
def delete_row(
    row_id: int,
    request: Request,
    payload: Optional[RowDeletePayload] = None,
    db: Session = Depends(get_db),
):
    return DynamicInventoryService.delete_row(
        db,
        row_id,
        payload,
        actor_user_id=get_actor_user_id(request),
    )


# =============================================================================
# History / reports / exports
# =============================================================================


@router.get("/{inventory_id:int}/history", response_model=Dict[str, Any])
def get_history(
    inventory_id: int,
    start_date: Optional[date] = Query(default=None),
    end_date: Optional[date] = Query(default=None),
    db: Session = Depends(get_db),
):
    return DynamicInventoryService.get_history(
        db,
        inventory_id,
        start_date=start_date,
        end_date=end_date,
    )


@router.post("/{inventory_id:int}/reports/data", response_model=InventoryReportDataOut)
def get_report_data(
    inventory_id: int,
    payload: InventoryReportRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    return DynamicInventoryService.get_report_data(
        db,
        inventory_id,
        payload,
        actor_user_id=get_actor_user_id(request),
    )


@router.get("/{inventory_id:int}/reports/data", response_model=InventoryReportDataOut)
def get_report_data_query(
    inventory_id: int,
    request: Request,
    report_type: InventoryReportType = Query(default=InventoryReportType.DAILY),
    start_date: date = Query(...),
    end_date: date = Query(...),
    period_id: Optional[int] = Query(default=None),
    include_inputs: bool = Query(default=True),
    include_outputs: bool = Query(default=True),
    include_summary: bool = Query(default=True),
    include_raw_data: bool = Query(default=True),
    visible_fields_only: bool = Query(default=True),
    db: Session = Depends(get_db),
):
    payload = _report_request_from_query(
        report_type=report_type,
        start_date=start_date,
        end_date=end_date,
        period_id=period_id,
        include_inputs=include_inputs,
        include_outputs=include_outputs,
        include_summary=include_summary,
        include_raw_data=include_raw_data,
        visible_fields_only=visible_fields_only,
    )
    return DynamicInventoryService.get_report_data(
        db,
        inventory_id,
        payload,
        actor_user_id=get_actor_user_id(request),
    )


@router.get("/{inventory_id:int}/reports/excel")
def export_report_excel(
    inventory_id: int,
    request: Request,
    report_type: InventoryReportType = Query(default=InventoryReportType.DAILY),
    start_date: date = Query(...),
    end_date: date = Query(...),
    period_id: Optional[int] = Query(default=None),
    include_inputs: bool = Query(default=True),
    include_outputs: bool = Query(default=True),
    include_summary: bool = Query(default=True),
    include_raw_data: bool = Query(default=True),
    visible_fields_only: bool = Query(default=True),
    db: Session = Depends(get_db),
):
    payload = _report_request_from_query(
        report_type=report_type,
        report_format=InventoryReportFormat.EXCEL,
        start_date=start_date,
        end_date=end_date,
        period_id=period_id,
        include_inputs=include_inputs,
        include_outputs=include_outputs,
        include_summary=include_summary,
        include_raw_data=include_raw_data,
        visible_fields_only=visible_fields_only,
    )
    return DynamicInventoryService.export_report_excel(
        db,
        inventory_id,
        payload,
        actor_user_id=get_actor_user_id(request),
    )


@router.get("/{inventory_id:int}/reports/pdf")
def export_report_pdf(
    inventory_id: int,
    request: Request,
    report_type: InventoryReportType = Query(default=InventoryReportType.DAILY),
    start_date: date = Query(...),
    end_date: date = Query(...),
    period_id: Optional[int] = Query(default=None),
    include_inputs: bool = Query(default=True),
    include_outputs: bool = Query(default=True),
    include_summary: bool = Query(default=True),
    include_raw_data: bool = Query(default=True),
    visible_fields_only: bool = Query(default=True),
    db: Session = Depends(get_db),
):
    payload = _report_request_from_query(
        report_type=report_type,
        report_format=InventoryReportFormat.PDF,
        start_date=start_date,
        end_date=end_date,
        period_id=period_id,
        include_inputs=include_inputs,
        include_outputs=include_outputs,
        include_summary=include_summary,
        include_raw_data=include_raw_data,
        visible_fields_only=visible_fields_only,
    )
    return DynamicInventoryService.export_report_pdf(
        db,
        inventory_id,
        payload,
        actor_user_id=get_actor_user_id(request),
    )


@router.get("/{inventory_id:int}/reports/csv")
def export_report_csv(
    inventory_id: int,
    request: Request,
    report_type: InventoryReportType = Query(default=InventoryReportType.DAILY),
    start_date: date = Query(...),
    end_date: date = Query(...),
    period_id: Optional[int] = Query(default=None),
    include_inputs: bool = Query(default=True),
    include_outputs: bool = Query(default=True),
    include_summary: bool = Query(default=True),
    include_raw_data: bool = Query(default=True),
    visible_fields_only: bool = Query(default=True),
    db: Session = Depends(get_db),
):
    payload = _report_request_from_query(
        report_type=report_type,
        report_format=InventoryReportFormat.CSV,
        start_date=start_date,
        end_date=end_date,
        period_id=period_id,
        include_inputs=include_inputs,
        include_outputs=include_outputs,
        include_summary=include_summary,
        include_raw_data=include_raw_data,
        visible_fields_only=visible_fields_only,
    )
    return DynamicInventoryService.export_report_csv(
        db,
        inventory_id,
        payload,
        actor_user_id=get_actor_user_id(request),
    )


# =============================================================================
# Access / credentials
# =============================================================================


@router.post("/{inventory_id:int}/access", response_model=InventoryAccessOut, status_code=status.HTTP_201_CREATED)
def create_access(
    inventory_id: int,
    payload: InventoryAccessCreate,
    request: Request,
    db: Session = Depends(get_db),
):
    return DynamicInventoryService.create_access(
        db,
        inventory_id,
        payload,
        actor_user_id=get_actor_user_id(request),
    )


@router.post("/{inventory_id:int}/credentials", response_model=InventoryCredentialOut, status_code=status.HTTP_201_CREATED)
def create_credential(
    inventory_id: int,
    payload: InventoryCredentialCreate,
    request: Request,
    db: Session = Depends(get_db),
):
    return DynamicInventoryService.create_credential(
        db,
        inventory_id,
        payload,
        actor_user_id=get_actor_user_id(request),
    )


# =============================================================================
# Alerts / attachments / audit logs
# =============================================================================


@router.post("/{inventory_id:int}/alerts", response_model=InventoryAlertOut, status_code=status.HTTP_201_CREATED)
def create_alert(
    inventory_id: int,
    payload: InventoryAlertCreate,
    request: Request,
    db: Session = Depends(get_db),
):
    return DynamicInventoryService.create_alert(
        db,
        inventory_id,
        payload,
        actor_user_id=get_actor_user_id(request),
    )


@router.get("/alerts", response_model=List[InventoryAlertOut])
def list_alerts(
    inventory_id: Optional[int] = Query(default=None),
    status_filter: Optional[InventoryAlertStatus] = Query(default=None, alias="status"),
    db: Session = Depends(get_db),
):
    return DynamicInventoryService.list_alerts(
        db,
        inventory_id=inventory_id,
        status=status_filter,
    )


@router.patch("/alerts/{alert_id:int}/acknowledge", response_model=InventoryAlertOut)
def acknowledge_alert(alert_id: int, request: Request, db: Session = Depends(get_db)):
    return DynamicInventoryService.acknowledge_alert(
        db,
        alert_id,
        actor_user_id=get_actor_user_id(request),
    )


@router.patch("/alerts/{alert_id:int}/resolve", response_model=InventoryAlertOut)
def resolve_alert(alert_id: int, request: Request, db: Session = Depends(get_db)):
    return DynamicInventoryService.resolve_alert(
        db,
        alert_id,
        actor_user_id=get_actor_user_id(request),
    )


@router.post("/{inventory_id:int}/attachments", response_model=InventoryAttachmentOut, status_code=status.HTTP_201_CREATED)
def create_attachment(
    inventory_id: int,
    payload: InventoryAttachmentCreate,
    request: Request,
    db: Session = Depends(get_db),
):
    return DynamicInventoryService.create_attachment(
        db,
        inventory_id,
        payload,
        actor_user_id=get_actor_user_id(request),
    )


@router.get("/audit-logs", response_model=List[InventoryAuditLogOut])
def list_audit_logs(
    inventory_id: Optional[int] = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
):
    return DynamicInventoryService.list_audit_logs(
        db,
        inventory_id=inventory_id,
        limit=limit,
    )


# =============================================================================
# Health
# =============================================================================


@router.get("/health", response_model=MessageOut)
def dynamic_inventory_health():
    return MessageOut(message="Ranch inventory router is active")
