from __future__ import annotations

from datetime import date
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_active_user
from app.models.user import User
from app.schemas.breakeven_report import (
    BreakevenSettingCreate,
    BreakevenSettingRead,
    BreakevenSettingUpdate,
    BreakevenSummaryReportData,
    BreakevenSummaryReportRequest,
)
from app.services.breakeven_report_service import breakeven_report_service

router = APIRouter(
    prefix="/breakeven",
    tags=["Breakeven Analysis"],
)


# =============================================================================
# Helpers
# =============================================================================
def clean_query_text(value: Optional[str]) -> Optional[str]:
    """
    Keep query filters clean before sending them to the service.

    Empty strings should behave the same as omitted filters.
    """
    if value is None:
        return None

    cleaned = str(value).strip()
    return cleaned or None


def resolve_prepared_by_name(
    current_user: User,
    explicit_prepared_by_name: Optional[str] = None,
) -> str:
    """
    Determines the report preparer name.

    Priority:
    1. Explicit prepared_by query value
    2. Current user's full name
    3. Current user's username
    4. Current user's email
    5. System fallback
    """
    value = clean_query_text(explicit_prepared_by_name)
    if value:
        return value

    full_name = clean_query_text(getattr(current_user, "full_name", None))
    if full_name:
        return full_name

    username = clean_query_text(getattr(current_user, "username", None))
    if username:
        return username

    email = clean_query_text(getattr(current_user, "email", None))
    if email:
        return email

    return "System"


# =============================================================================
# SETTINGS
# =============================================================================
@router.post(
    "/settings",
    response_model=BreakevenSettingRead,
    summary="Create a breakeven setting",
    description=(
        "Create a breakeven setting for global or monthly use. "
        "The breakeven setting defines the monthly breakeven quantity and "
        "monthly overhead recovery target used by the CVP report."
    ),
)
def create_breakeven_setting(
    payload: BreakevenSettingCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> BreakevenSettingRead:
    return breakeven_report_service.create_setting(db, payload)


@router.get(
    "/settings",
    response_model=List[BreakevenSettingRead],
    summary="List breakeven settings",
    description=(
        "List global or monthly breakeven settings. "
        "Monthly settings override global settings for the selected month/year."
    ),
)
def list_breakeven_settings(
    scope_type: Optional[str] = Query(
        default=None,
        description="Filter by scope_type: global or monthly.",
    ),
    month: Optional[int] = Query(
        default=None,
        ge=1,
        le=12,
        description="Filter by month.",
    ),
    year: Optional[int] = Query(
        default=None,
        ge=2000,
        le=9999,
        description="Filter by year.",
    ),
    is_active: Optional[bool] = Query(
        default=None,
        description="Filter active or inactive settings.",
    ),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> List[BreakevenSettingRead]:
    return breakeven_report_service.list_settings(
        db=db,
        scope_type=clean_query_text(scope_type),
        month=month,
        year=year,
        is_active=is_active,
    )


@router.get(
    "/settings/{setting_id}",
    response_model=BreakevenSettingRead,
    summary="Get one breakeven setting",
)
def get_breakeven_setting(
    setting_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> BreakevenSettingRead:
    return breakeven_report_service.get_setting(db, setting_id)


@router.put(
    "/settings/{setting_id}",
    response_model=BreakevenSettingRead,
    summary="Update a breakeven setting",
    description=(
        "Update a breakeven setting. If the setting is active, the service "
        "will ensure only one active global setting or one active monthly "
        "setting per month/year remains active."
    ),
)
def update_breakeven_setting(
    setting_id: UUID,
    payload: BreakevenSettingUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> BreakevenSettingRead:
    return breakeven_report_service.update_setting(db, setting_id, payload)


@router.post(
    "/settings/{setting_id}/activate",
    response_model=BreakevenSettingRead,
    summary="Activate a breakeven setting",
)
def activate_breakeven_setting(
    setting_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> BreakevenSettingRead:
    return breakeven_report_service.activate_setting(db, setting_id)


@router.post(
    "/settings/{setting_id}/deactivate",
    response_model=BreakevenSettingRead,
    summary="Deactivate a breakeven setting",
)
def deactivate_breakeven_setting(
    setting_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> BreakevenSettingRead:
    return breakeven_report_service.deactivate_setting(db, setting_id)


# =============================================================================
# SUMMARY REPORT
# =============================================================================
@router.get(
    "/summary",
    response_model=BreakevenSummaryReportData,
    summary="Get breakeven summary report",
    description=(
        "Generate the monthly breakeven summary report. "
        "The report is recalculated live from orders for the selected month. "
        "Total Booked Turnover and Total Delivered Turnover are calculated "
        "using quantity kg × USD 5.40/kg. "
        "Projected GP is calculated using the CVP basis: "
        "quantity kg ÷ 9 kg/head × USD 5.20/head. "
        "Projected GP does not subtract monthly breakeven overheads. "
        "Monthly breakeven overheads are shown separately as "
        "'Less Monthly Breakeven Overheads'. "
        "Position Against Breakeven is calculated as "
        "Projected GP minus Monthly Breakeven Overheads."
    ),
)
def get_breakeven_summary_report(
    report_date: Optional[date] = Query(
        default=None,
        description=(
            "Optional report date in YYYY-MM-DD format. "
            "Used to resolve month/year if month/year are not provided."
        ),
    ),
    month: Optional[int] = Query(
        default=None,
        ge=1,
        le=12,
        description=(
            "Report month. If omitted, it is derived from report_date or today's date."
        ),
    ),
    year: Optional[int] = Query(
        default=None,
        ge=2000,
        le=9999,
        description=(
            "Report year. If omitted, it is derived from report_date or today's date."
        ),
    ),
    setting_id: Optional[UUID] = Query(
        default=None,
        description="Optional breakeven setting ID override.",
    ),
    order_type: Optional[str] = Query(
        default=None,
        description="Optional order type filter.",
    ),
    order_profile: Optional[str] = Query(
        default=None,
        description="Optional order profile filter.",
    ),
    order_subtype: Optional[str] = Query(
        default=None,
        description="Optional order subtype filter.",
    ),
    enterprise_name: Optional[str] = Query(
        default=None,
        description="Optional enterprise/client filter.",
    ),
    jurisdiction: Optional[str] = Query(
        default=None,
        description="Optional jurisdiction filter.",
    ),
    prepared_by: Optional[str] = Query(
        default=None,
        description="Optional prepared-by override. Defaults to the authenticated user.",
    ),
    include_rows: bool = Query(
        default=True,
        description=(
            "Whether to include the table rows in the response. "
            "Rows include turnover, projected GP, breakeven overheads, "
            "position against breakeven, and breakeven percentages."
        ),
    ),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> BreakevenSummaryReportData:
    payload = BreakevenSummaryReportRequest(
        report_type="breakeven_summary",
        report_date=report_date,
        month=month,
        year=year,
        setting_id=setting_id,
        order_type=clean_query_text(order_type),
        order_profile=clean_query_text(order_profile),
        order_subtype=clean_query_text(order_subtype),
        enterprise_name=clean_query_text(enterprise_name),
        jurisdiction=clean_query_text(jurisdiction),
        prepared_by=resolve_prepared_by_name(current_user, prepared_by),
        include_rows=include_rows,
    )

    return breakeven_report_service.build_breakeven_summary_report(db, payload)