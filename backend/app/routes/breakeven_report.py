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


def resolve_prepared_by_name(
    current_user: User,
    explicit_prepared_by_name: Optional[str] = None,
) -> str:
    value = (explicit_prepared_by_name or "").strip()
    if value:
        return value

    full_name = (getattr(current_user, "full_name", None) or "").strip()
    if full_name:
        return full_name

    username = (getattr(current_user, "username", None) or "").strip()
    if username:
        return username

    email = (getattr(current_user, "email", None) or "").strip()
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
)
def list_breakeven_settings(
    scope_type: Optional[str] = Query(
        default=None,
        description="Filter by scope_type: global or monthly",
    ),
    month: Optional[int] = Query(
        default=None,
        ge=1,
        le=12,
        description="Filter by month",
    ),
    year: Optional[int] = Query(
        default=None,
        ge=2000,
        le=9999,
        description="Filter by year",
    ),
    is_active: Optional[bool] = Query(
        default=None,
        description="Filter active/inactive settings",
    ),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> List[BreakevenSettingRead]:
    return breakeven_report_service.list_settings(
        db=db,
        scope_type=scope_type,
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
)
def get_breakeven_summary_report(
    report_date: Optional[date] = Query(
        default=None,
        description="Optional report date YYYY-MM-DD. Used to resolve month/year if not provided.",
    ),
    month: Optional[int] = Query(
        default=None,
        ge=1,
        le=12,
        description="Report month",
    ),
    year: Optional[int] = Query(
        default=None,
        ge=2000,
        le=9999,
        description="Report year",
    ),
    setting_id: Optional[UUID] = Query(
        default=None,
        description="Optional breakeven setting ID override",
    ),
    order_type: Optional[str] = Query(
        default=None,
        description="Optional order type filter",
    ),
    order_profile: Optional[str] = Query(
        default=None,
        description="Optional order profile filter",
    ),
    order_subtype: Optional[str] = Query(
        default=None,
        description="Optional order subtype filter",
    ),
    enterprise_name: Optional[str] = Query(
        default=None,
        description="Optional enterprise/client filter",
    ),
    jurisdiction: Optional[str] = Query(
        default=None,
        description="Optional jurisdiction filter",
    ),
    prepared_by: Optional[str] = Query(
        default=None,
        description="Optional prepared by override",
    ),
    include_rows: bool = Query(
        default=True,
        description="Include table rows in response",
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
        order_type=order_type,
        order_profile=order_profile,
        order_subtype=order_subtype,
        enterprise_name=enterprise_name,
        jurisdiction=jurisdiction,
        prepared_by=resolve_prepared_by_name(current_user, prepared_by),
        include_rows=include_rows,
    )
    return breakeven_report_service.build_breakeven_summary_report(db, payload)