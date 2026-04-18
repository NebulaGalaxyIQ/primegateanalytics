from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_active_user
from app.models.user import User
from app.schemas.breakeven_report import BreakevenSummaryReportRequest
from app.schemas.report import (
    FrozenContainersMonthlyReportRequest,
    OrdersMonthlyReportRequest,
)
from app.services.report_generator import generate_report
from app.services.report_service import (
    DEFAULT_BREAKEVEN_QUANTITY_KG,
    build_breakeven_summary_report_data,
    build_frozen_containers_monthly_report_data,
    build_orders_monthly_report_data,
    build_report_data,
)

router = APIRouter(prefix="/reports", tags=["Reports"])

ALLOWED_EXPORT_FORMATS = {"csv", "pdf", "docx"}
ALLOWED_REPORT_TYPES = {
    "orders_monthly",
    "frozen_containers_monthly",
    "breakeven_summary",
}


# =============================================================================
# Helpers
# =============================================================================
def _resolve_prepared_by(
    current_user: User,
    prepared_by: Optional[str],
) -> Optional[str]:
    if prepared_by and prepared_by.strip():
        return prepared_by.strip()

    full_name = getattr(current_user, "full_name", None)
    if full_name and str(full_name).strip():
        return str(full_name).strip()

    username = getattr(current_user, "username", None)
    if username and str(username).strip():
        return str(username).strip()

    email = getattr(current_user, "email", None)
    if email and str(email).strip():
        return str(email).strip()

    return None


def _normalize_export_format(value: str) -> str:
    normalized = str(value or "").strip().lower()
    if normalized not in ALLOWED_EXPORT_FORMATS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported export format. Allowed formats: csv, pdf, docx.",
        )
    return normalized


def _normalize_report_type(value: str) -> str:
    normalized = str(value or "").strip().lower().replace("-", "_").replace(" ", "_")
    if normalized not in ALLOWED_REPORT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Unsupported report type. Allowed report types: "
                "orders_monthly, frozen_containers_monthly, breakeven_summary."
            ),
        )
    return normalized


def _handle_bad_request(error: Exception) -> None:
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=str(error) or "Invalid report request",
    )


def _handle_runtime_error(error: Exception) -> None:
    message = str(error) or "Failed to generate report"

    if "requires reportlab" in message:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=message,
        )

    if "requires python-docx" in message:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=message,
        )

    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail=message,
    )


def _build_file_response(generated) -> Response:
    return Response(
        content=generated.content,
        media_type=generated.media_type,
        headers={
            "Content-Disposition": f'attachment; filename="{generated.filename}"'
        },
    )


def _build_orders_request(
    *,
    month: int,
    year: int,
    report_format: str,
    order_type: Optional[str],
    order_profile: Optional[str],
    order_subtype: Optional[str],
    status_value: Optional[str],
    enterprise_name: Optional[str],
    jurisdiction: Optional[str],
    breakeven_quantity_kg: Optional[Decimal],
    prepared_by: Optional[str],
    include_summary: bool,
    include_sections: bool,
    include_totals: bool,
    include_animal_projection: bool,
    include_financial_summary: bool,
) -> OrdersMonthlyReportRequest:
    return OrdersMonthlyReportRequest(
        report_type="orders_monthly",
        format=report_format,
        month=month,
        year=year,
        order_type=order_type,
        order_profile=order_profile,
        order_subtype=order_subtype,
        status=status_value,
        enterprise_name=enterprise_name,
        jurisdiction=jurisdiction,
        breakeven_quantity_kg=(
            breakeven_quantity_kg
            if breakeven_quantity_kg is not None
            else DEFAULT_BREAKEVEN_QUANTITY_KG
        ),
        prepared_by=prepared_by,
        include_summary=include_summary,
        include_sections=include_sections,
        include_totals=include_totals,
        include_animal_projection=include_animal_projection,
        include_financial_summary=include_financial_summary,
    )


def _build_frozen_request(
    *,
    month: int,
    year: int,
    report_format: str,
    status_value: Optional[str],
    enterprise_name: Optional[str],
    jurisdiction: Optional[str],
    prepared_by: Optional[str],
    include_summary: bool,
    include_rows: bool,
    include_totals: bool,
) -> FrozenContainersMonthlyReportRequest:
    return FrozenContainersMonthlyReportRequest(
        report_type="frozen_containers_monthly",
        format=report_format,
        month=month,
        year=year,
        status=status_value,
        enterprise_name=enterprise_name,
        jurisdiction=jurisdiction,
        prepared_by=prepared_by,
        include_summary=include_summary,
        include_rows=include_rows,
        include_totals=include_totals,
    )


def _build_breakeven_request(
    *,
    report_date: Optional[date],
    month: Optional[int],
    year: Optional[int],
    setting_id: Optional[UUID],
    order_type: Optional[str],
    order_profile: Optional[str],
    order_subtype: Optional[str],
    enterprise_name: Optional[str],
    jurisdiction: Optional[str],
    prepared_by: Optional[str],
    include_rows: bool,
) -> BreakevenSummaryReportRequest:
    return BreakevenSummaryReportRequest(
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
        prepared_by=prepared_by,
        include_rows=include_rows,
    )


# =============================================================================
# ORDERS MONTHLY REPORT
# =============================================================================
@router.get(
    "/orders/monthly",
    status_code=status.HTTP_200_OK,
)
def get_orders_monthly_report_data_endpoint(
    month: int = Query(..., ge=1, le=12),
    year: int = Query(..., ge=2000, le=2100),
    order_type: Optional[str] = Query(default=None),
    order_profile: Optional[str] = Query(default=None),
    order_subtype: Optional[str] = Query(default=None),
    status_value: Optional[str] = Query(default=None, alias="status"),
    enterprise_name: Optional[str] = Query(default=None),
    jurisdiction: Optional[str] = Query(default=None),
    breakeven_quantity_kg: Optional[Decimal] = Query(
        default=DEFAULT_BREAKEVEN_QUANTITY_KG,
        ge=0,
    ),
    prepared_by: Optional[str] = Query(default=None),
    include_summary: bool = Query(default=True),
    include_sections: bool = Query(default=True),
    include_totals: bool = Query(default=True),
    include_animal_projection: bool = Query(default=True),
    include_financial_summary: bool = Query(default=True),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    try:
        request = _build_orders_request(
            month=month,
            year=year,
            report_format="csv",
            order_type=order_type,
            order_profile=order_profile,
            order_subtype=order_subtype,
            status_value=status_value,
            enterprise_name=enterprise_name,
            jurisdiction=jurisdiction,
            breakeven_quantity_kg=breakeven_quantity_kg,
            prepared_by=_resolve_prepared_by(current_user, prepared_by),
            include_summary=include_summary,
            include_sections=include_sections,
            include_totals=include_totals,
            include_animal_projection=include_animal_projection,
            include_financial_summary=include_financial_summary,
        )
        return build_orders_monthly_report_data(db=db, request=request)

    except (ValueError, ValidationError) as error:
        _handle_bad_request(error)
    except HTTPException:
        raise
    except Exception as error:
        _handle_runtime_error(error)


@router.get(
    "/orders/monthly/export",
    status_code=status.HTTP_200_OK,
)
def export_orders_monthly_report_endpoint(
    month: int = Query(..., ge=1, le=12),
    year: int = Query(..., ge=2000, le=2100),
    report_format: str = Query(..., alias="format"),
    order_type: Optional[str] = Query(default=None),
    order_profile: Optional[str] = Query(default=None),
    order_subtype: Optional[str] = Query(default=None),
    status_value: Optional[str] = Query(default=None, alias="status"),
    enterprise_name: Optional[str] = Query(default=None),
    jurisdiction: Optional[str] = Query(default=None),
    breakeven_quantity_kg: Optional[Decimal] = Query(
        default=DEFAULT_BREAKEVEN_QUANTITY_KG,
        ge=0,
    ),
    prepared_by: Optional[str] = Query(default=None),
    include_summary: bool = Query(default=True),
    include_sections: bool = Query(default=True),
    include_totals: bool = Query(default=True),
    include_animal_projection: bool = Query(default=True),
    include_financial_summary: bool = Query(default=True),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    try:
        normalized_format = _normalize_export_format(report_format)

        request = _build_orders_request(
            month=month,
            year=year,
            report_format=normalized_format,
            order_type=order_type,
            order_profile=order_profile,
            order_subtype=order_subtype,
            status_value=status_value,
            enterprise_name=enterprise_name,
            jurisdiction=jurisdiction,
            breakeven_quantity_kg=breakeven_quantity_kg,
            prepared_by=_resolve_prepared_by(current_user, prepared_by),
            include_summary=include_summary,
            include_sections=include_sections,
            include_totals=include_totals,
            include_animal_projection=include_animal_projection,
            include_financial_summary=include_financial_summary,
        )

        report_data = build_orders_monthly_report_data(db=db, request=request)
        generated = generate_report(
            report_data=report_data,
            output_format=normalized_format,
        )
        return _build_file_response(generated)

    except (ValueError, ValidationError) as error:
        _handle_bad_request(error)
    except HTTPException:
        raise
    except Exception as error:
        _handle_runtime_error(error)


# =============================================================================
# FROZEN CONTAINERS MONTHLY REPORT
# =============================================================================
@router.get(
    "/orders/frozen-containers/monthly",
    status_code=status.HTTP_200_OK,
)
def get_frozen_containers_monthly_report_data_endpoint(
    month: int = Query(..., ge=1, le=12),
    year: int = Query(..., ge=2000, le=2100),
    status_value: Optional[str] = Query(default=None, alias="status"),
    enterprise_name: Optional[str] = Query(default=None),
    jurisdiction: Optional[str] = Query(default=None),
    prepared_by: Optional[str] = Query(default=None),
    include_summary: bool = Query(default=True),
    include_rows: bool = Query(default=True),
    include_totals: bool = Query(default=True),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    try:
        request = _build_frozen_request(
            month=month,
            year=year,
            report_format="csv",
            status_value=status_value,
            enterprise_name=enterprise_name,
            jurisdiction=jurisdiction,
            prepared_by=_resolve_prepared_by(current_user, prepared_by),
            include_summary=include_summary,
            include_rows=include_rows,
            include_totals=include_totals,
        )
        return build_frozen_containers_monthly_report_data(db=db, request=request)

    except (ValueError, ValidationError) as error:
        _handle_bad_request(error)
    except HTTPException:
        raise
    except Exception as error:
        _handle_runtime_error(error)


@router.get(
    "/orders/frozen-containers/monthly/export",
    status_code=status.HTTP_200_OK,
)
def export_frozen_containers_monthly_report_endpoint(
    month: int = Query(..., ge=1, le=12),
    year: int = Query(..., ge=2000, le=2100),
    report_format: str = Query(..., alias="format"),
    status_value: Optional[str] = Query(default=None, alias="status"),
    enterprise_name: Optional[str] = Query(default=None),
    jurisdiction: Optional[str] = Query(default=None),
    prepared_by: Optional[str] = Query(default=None),
    include_summary: bool = Query(default=True),
    include_rows: bool = Query(default=True),
    include_totals: bool = Query(default=True),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    try:
        normalized_format = _normalize_export_format(report_format)

        request = _build_frozen_request(
            month=month,
            year=year,
            report_format=normalized_format,
            status_value=status_value,
            enterprise_name=enterprise_name,
            jurisdiction=jurisdiction,
            prepared_by=_resolve_prepared_by(current_user, prepared_by),
            include_summary=include_summary,
            include_rows=include_rows,
            include_totals=include_totals,
        )

        report_data = build_frozen_containers_monthly_report_data(
            db=db,
            request=request,
        )
        generated = generate_report(
            report_data=report_data,
            output_format=normalized_format,
        )
        return _build_file_response(generated)

    except (ValueError, ValidationError) as error:
        _handle_bad_request(error)
    except HTTPException:
        raise
    except Exception as error:
        _handle_runtime_error(error)


# =============================================================================
# BREAKEVEN SUMMARY REPORT
# =============================================================================
@router.get(
    "/breakeven/summary",
    status_code=status.HTTP_200_OK,
)
def get_breakeven_summary_report_data_endpoint(
    report_date: Optional[date] = Query(default=None),
    month: Optional[int] = Query(default=None, ge=1, le=12),
    year: Optional[int] = Query(default=None, ge=2000, le=2100),
    setting_id: Optional[UUID] = Query(default=None),
    order_type: Optional[str] = Query(default=None),
    order_profile: Optional[str] = Query(default=None),
    order_subtype: Optional[str] = Query(default=None),
    enterprise_name: Optional[str] = Query(default=None),
    jurisdiction: Optional[str] = Query(default=None),
    prepared_by: Optional[str] = Query(default=None),
    include_rows: bool = Query(default=True),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    try:
        request = _build_breakeven_request(
            report_date=report_date,
            month=month,
            year=year,
            setting_id=setting_id,
            order_type=order_type,
            order_profile=order_profile,
            order_subtype=order_subtype,
            enterprise_name=enterprise_name,
            jurisdiction=jurisdiction,
            prepared_by=_resolve_prepared_by(current_user, prepared_by),
            include_rows=include_rows,
        )
        return build_breakeven_summary_report_data(db=db, request=request)

    except (ValueError, ValidationError) as error:
        _handle_bad_request(error)
    except HTTPException:
        raise
    except Exception as error:
        _handle_runtime_error(error)


@router.get(
    "/breakeven/summary/export",
    status_code=status.HTTP_200_OK,
)
def export_breakeven_summary_report_endpoint(
    report_format: str = Query(..., alias="format"),
    report_date: Optional[date] = Query(default=None),
    month: Optional[int] = Query(default=None, ge=1, le=12),
    year: Optional[int] = Query(default=None, ge=2000, le=2100),
    setting_id: Optional[UUID] = Query(default=None),
    order_type: Optional[str] = Query(default=None),
    order_profile: Optional[str] = Query(default=None),
    order_subtype: Optional[str] = Query(default=None),
    enterprise_name: Optional[str] = Query(default=None),
    jurisdiction: Optional[str] = Query(default=None),
    prepared_by: Optional[str] = Query(default=None),
    include_rows: bool = Query(default=True),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    try:
        normalized_format = _normalize_export_format(report_format)

        request = _build_breakeven_request(
            report_date=report_date,
            month=month,
            year=year,
            setting_id=setting_id,
            order_type=order_type,
            order_profile=order_profile,
            order_subtype=order_subtype,
            enterprise_name=enterprise_name,
            jurisdiction=jurisdiction,
            prepared_by=_resolve_prepared_by(current_user, prepared_by),
            include_rows=include_rows,
        )

        report_data = build_breakeven_summary_report_data(db=db, request=request)
        generated = generate_report(
            report_data=report_data,
            output_format=normalized_format,
        )
        return _build_file_response(generated)

    except (ValueError, ValidationError) as error:
        _handle_bad_request(error)
    except HTTPException:
        raise
    except Exception as error:
        _handle_runtime_error(error)


# =============================================================================
# GENERIC EXPORT ENDPOINT
# Supports:
# /reports/export?report_type=breakeven_summary&format=csv&report_date=2026-04-16
# =============================================================================
@router.get(
    "/export",
    status_code=status.HTTP_200_OK,
)
def export_report_endpoint(
    report_type: str = Query(...),
    report_format: str = Query(..., alias="format"),

    month: Optional[int] = Query(default=None, ge=1, le=12),
    year: Optional[int] = Query(default=None, ge=2000, le=2100),
    report_date: Optional[date] = Query(default=None),
    setting_id: Optional[UUID] = Query(default=None),

    order_type: Optional[str] = Query(default=None),
    order_profile: Optional[str] = Query(default=None),
    order_subtype: Optional[str] = Query(default=None),
    status_value: Optional[str] = Query(default=None, alias="status"),
    enterprise_name: Optional[str] = Query(default=None),
    jurisdiction: Optional[str] = Query(default=None),

    breakeven_quantity_kg: Optional[Decimal] = Query(
        default=DEFAULT_BREAKEVEN_QUANTITY_KG,
        ge=0,
    ),

    prepared_by: Optional[str] = Query(default=None),

    include_summary: bool = Query(default=True),
    include_sections: bool = Query(default=True),
    include_totals: bool = Query(default=True),
    include_rows: bool = Query(default=True),
    include_animal_projection: bool = Query(default=True),
    include_financial_summary: bool = Query(default=True),

    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    try:
        normalized_report_type = _normalize_report_type(report_type)
        normalized_format = _normalize_export_format(report_format)
        resolved_prepared_by = _resolve_prepared_by(current_user, prepared_by)

        if normalized_report_type == "orders_monthly":
            if month is None or year is None:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="month and year are required for orders_monthly export.",
                )

            request = _build_orders_request(
                month=month,
                year=year,
                report_format=normalized_format,
                order_type=order_type,
                order_profile=order_profile,
                order_subtype=order_subtype,
                status_value=status_value,
                enterprise_name=enterprise_name,
                jurisdiction=jurisdiction,
                breakeven_quantity_kg=breakeven_quantity_kg,
                prepared_by=resolved_prepared_by,
                include_summary=include_summary,
                include_sections=include_sections,
                include_totals=include_totals,
                include_animal_projection=include_animal_projection,
                include_financial_summary=include_financial_summary,
            )

        elif normalized_report_type == "frozen_containers_monthly":
            if month is None or year is None:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="month and year are required for frozen_containers_monthly export.",
                )

            request = _build_frozen_request(
                month=month,
                year=year,
                report_format=normalized_format,
                status_value=status_value,
                enterprise_name=enterprise_name,
                jurisdiction=jurisdiction,
                prepared_by=resolved_prepared_by,
                include_summary=include_summary,
                include_rows=include_rows,
                include_totals=include_totals,
            )

        elif normalized_report_type == "breakeven_summary":
            request = _build_breakeven_request(
                report_date=report_date,
                month=month,
                year=year,
                setting_id=setting_id,
                order_type=order_type,
                order_profile=order_profile,
                order_subtype=order_subtype,
                enterprise_name=enterprise_name,
                jurisdiction=jurisdiction,
                prepared_by=resolved_prepared_by,
                include_rows=include_rows,
            )

        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported report type: {normalized_report_type}",
            )

        report_data = build_report_data(db=db, request=request)
        generated = generate_report(
            report_data=report_data,
            output_format=normalized_format,
        )
        return _build_file_response(generated)

    except (ValueError, ValidationError) as error:
        _handle_bad_request(error)
    except HTTPException:
        raise
    except Exception as error:
        _handle_runtime_error(error)