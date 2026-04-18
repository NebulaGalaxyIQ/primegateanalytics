from __future__ import annotations

from datetime import date
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_active_user
from app.models.user import User
from app.schemas.saas import (
    SaaSAnimalSummaryRow,
    SaaSClientSummaryRow,
    SaaSCreate,
    SaaSDateRangeReportData,
    SaaSDateRangeReportRequest,
    SaaSDailyReportData,
    SaaSDailyReportRequest,
    SaaSExportRequest,
    SaaSListQuery,
    SaaSListResponse,
    SaaSMonthlyReportData,
    SaaSMonthlyReportRequest,
    SaaSRead,
    SaaSReportTotals,
    SaaSUpdate,
    SaaSWeeklyReportData,
    SaaSWeeklyReportRequest,
)
from app.services.saas_export_service import ExportedFile, SaaSExportService
from app.services.saas_service import SaaSService

router = APIRouter(
    prefix="/saas",
    tags=["Slaughter Services"],
)


def get_saas_service() -> SaaSService:
    return SaaSService()


def get_saas_export_service(
    service: SaaSService = Depends(get_saas_service),
) -> SaaSExportService:
    return SaaSExportService(service=service)


def build_export_response(exported: ExportedFile) -> Response:
    return Response(
        content=exported.content,
        media_type=exported.media_type,
        headers={
            "Content-Disposition": f'attachment; filename="{exported.filename}"'
        },
    )


def resolve_prepared_by_name(
    current_user: User,
    explicit_prepared_by_name: str | None = None,
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


def build_common_export_payload(
    *,
    export_format: str,
    scope: str,
    current_user: User,
    report_date: date | None = None,
    reference_date: date | None = None,
    week_starts_on: str = "monday",
    month: int | None = None,
    year: int | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
    client_name: str | None = None,
    animal_type: str | None = None,
    is_active: bool | None = True,
    report_title: str | None = "UMG Slaughter Services Report",
    file_name: str | None = None,
    prepared_by_name: str | None = None,
    prepared_on: date | None = None,
    organization_name: str | None = "Union Meat Group",
    include_rows: bool = True,
    include_totals: bool = True,
    include_client_summary: bool = True,
    include_animal_summary: bool = True,
) -> SaaSExportRequest:
    return SaaSExportRequest(
        export_format=export_format,
        scope=scope,
        report_date=report_date,
        reference_date=reference_date,
        week_starts_on=week_starts_on,
        month=month,
        year=year,
        start_date=start_date,
        end_date=end_date,
        client_name=client_name,
        animal_type=animal_type,
        is_active=is_active,
        report_title=report_title,
        file_name=file_name,
        prepared_by_name=resolve_prepared_by_name(current_user, prepared_by_name),
        prepared_on=prepared_on,
        organization_name=organization_name,
        include_rows=include_rows,
        include_totals=include_totals,
        include_client_summary=include_client_summary,
        include_animal_summary=include_animal_summary,
    )


# =============================================================================
# CRUD - CREATE / LIST
# =============================================================================
@router.post(
    "",
    response_model=SaaSRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create a slaughter service record",
)
def create_saas_record(
    payload: SaaSCreate,
    db: Session = Depends(get_db),
    service: SaaSService = Depends(get_saas_service),
) -> SaaSRead:
    return service.create(db, payload)


@router.get(
    "",
    response_model=SaaSListResponse,
    summary="List slaughter service records",
)
def list_saas_records(
    start_date: date | None = Query(
        default=None,
        description="Filter from date YYYY-MM-DD",
    ),
    end_date: date | None = Query(
        default=None,
        description="Filter to date YYYY-MM-DD",
    ),
    client_name: str | None = Query(
        default=None,
        description="Client name search",
    ),
    animal_type: str | None = Query(
        default=None,
        description="Animal type search",
    ),
    is_active: bool | None = Query(
        default=None,
        description="Active/inactive filter",
    ),
    month: int | None = Query(
        default=None,
        ge=1,
        le=12,
        description="Month number",
    ),
    year: int | None = Query(
        default=None,
        ge=2000,
        le=9999,
        description="Year",
    ),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=1000),
    sort_by: str = Query(
        default="service_date",
        description=(
            "Sort field: service_date, client_name, animal_type, total_animals, "
            "total_revenue_usd, total_offal_revenue_usd, total_combined_revenue_usd, "
            "created_at, updated_at"
        ),
    ),
    sort_order: str = Query(default="desc", description="asc or desc"),
    db: Session = Depends(get_db),
    service: SaaSService = Depends(get_saas_service),
) -> SaaSListResponse:
    params = SaaSListQuery(
        start_date=start_date,
        end_date=end_date,
        client_name=client_name,
        animal_type=animal_type,
        is_active=is_active,
        month=month,
        year=year,
        skip=skip,
        limit=limit,
        sort_by=sort_by,
        sort_order=sort_order,
    )
    return service.list(db, params)


# =============================================================================
# SUMMARIES
# =============================================================================
@router.get(
    "/summary/totals",
    response_model=SaaSReportTotals,
    summary="Get slaughter service totals summary",
)
def get_saas_totals_summary(
    start_date: date | None = Query(
        default=None,
        description="Filter from date YYYY-MM-DD",
    ),
    end_date: date | None = Query(
        default=None,
        description="Filter to date YYYY-MM-DD",
    ),
    client_name: str | None = Query(
        default=None,
        description="Client name search",
    ),
    animal_type: str | None = Query(
        default=None,
        description="Animal type search",
    ),
    is_active: bool | None = Query(
        default=True,
        description="Active/inactive filter",
    ),
    month: int | None = Query(
        default=None,
        ge=1,
        le=12,
        description="Month number",
    ),
    year: int | None = Query(
        default=None,
        ge=2000,
        le=9999,
        description="Year",
    ),
    db: Session = Depends(get_db),
    service: SaaSService = Depends(get_saas_service),
) -> SaaSReportTotals:
    return service.get_totals(
        db,
        start_date=start_date,
        end_date=end_date,
        client_name=client_name,
        animal_type=animal_type,
        is_active=is_active,
        month=month,
        year=year,
    )


@router.get(
    "/summary/clients",
    response_model=List[SaaSClientSummaryRow],
    summary="Get slaughter service summary grouped by client",
)
def get_saas_client_summary(
    start_date: date | None = Query(
        default=None,
        description="Filter from date YYYY-MM-DD",
    ),
    end_date: date | None = Query(
        default=None,
        description="Filter to date YYYY-MM-DD",
    ),
    client_name: str | None = Query(
        default=None,
        description="Client name search",
    ),
    animal_type: str | None = Query(
        default=None,
        description="Animal type search",
    ),
    is_active: bool | None = Query(
        default=True,
        description="Active/inactive filter",
    ),
    month: int | None = Query(
        default=None,
        ge=1,
        le=12,
        description="Month number",
    ),
    year: int | None = Query(
        default=None,
        ge=2000,
        le=9999,
        description="Year",
    ),
    db: Session = Depends(get_db),
    service: SaaSService = Depends(get_saas_service),
) -> List[SaaSClientSummaryRow]:
    return service.get_client_summary(
        db,
        start_date=start_date,
        end_date=end_date,
        client_name=client_name,
        animal_type=animal_type,
        is_active=is_active,
        month=month,
        year=year,
    )


@router.get(
    "/summary/animals",
    response_model=List[SaaSAnimalSummaryRow],
    summary="Get slaughter service summary grouped by animal type",
)
def get_saas_animal_summary(
    start_date: date | None = Query(
        default=None,
        description="Filter from date YYYY-MM-DD",
    ),
    end_date: date | None = Query(
        default=None,
        description="Filter to date YYYY-MM-DD",
    ),
    client_name: str | None = Query(
        default=None,
        description="Client name search",
    ),
    animal_type: str | None = Query(
        default=None,
        description="Animal type search",
    ),
    is_active: bool | None = Query(
        default=True,
        description="Active/inactive filter",
    ),
    month: int | None = Query(
        default=None,
        ge=1,
        le=12,
        description="Month number",
    ),
    year: int | None = Query(
        default=None,
        ge=2000,
        le=9999,
        description="Year",
    ),
    db: Session = Depends(get_db),
    service: SaaSService = Depends(get_saas_service),
) -> List[SaaSAnimalSummaryRow]:
    return service.get_animal_summary(
        db,
        start_date=start_date,
        end_date=end_date,
        client_name=client_name,
        animal_type=animal_type,
        is_active=is_active,
        month=month,
        year=year,
    )


# =============================================================================
# REPORTS
# =============================================================================
@router.get(
    "/reports/daily",
    response_model=SaaSDailyReportData,
    summary="Get daily slaughter service report",
)
def get_daily_saas_report(
    report_date: date = Query(description="Report date YYYY-MM-DD"),
    client_name: str | None = Query(
        default=None,
        description="Client name filter",
    ),
    animal_type: str | None = Query(
        default=None,
        description="Animal type filter",
    ),
    is_active: bool | None = Query(
        default=True,
        description="Active/inactive filter",
    ),
    prepared_by_name: str | None = Query(
        default=None,
        description="Prepared by name override",
    ),
    prepared_on: date | None = Query(
        default=None,
        description="Prepared on date YYYY-MM-DD",
    ),
    organization_name: str | None = Query(
        default="Union Meat Group",
        description="Organization name",
    ),
    report_title: str | None = Query(
        default="UMG Slaughter Services Report",
        description="Custom report title",
    ),
    include_rows: bool = Query(default=True),
    include_totals: bool = Query(default=True),
    include_client_summary: bool = Query(default=True),
    include_animal_summary: bool = Query(default=True),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    service: SaaSService = Depends(get_saas_service),
) -> SaaSDailyReportData:
    payload = SaaSDailyReportRequest(
        report_date=report_date,
        client_name=client_name,
        animal_type=animal_type,
        is_active=is_active,
        prepared_by_name=resolve_prepared_by_name(current_user, prepared_by_name),
        prepared_on=prepared_on,
        organization_name=organization_name,
        report_title=report_title,
        include_rows=include_rows,
        include_totals=include_totals,
        include_client_summary=include_client_summary,
        include_animal_summary=include_animal_summary,
    )
    return service.get_daily_report(db, payload)


@router.get(
    "/reports/weekly",
    response_model=SaaSWeeklyReportData,
    summary="Get weekly slaughter service report",
)
def get_weekly_saas_report(
    reference_date: date = Query(
        description="Any date within the week YYYY-MM-DD"
    ),
    week_starts_on: str = Query(
        default="monday",
        description="monday or sunday",
    ),
    client_name: str | None = Query(
        default=None,
        description="Client name filter",
    ),
    animal_type: str | None = Query(
        default=None,
        description="Animal type filter",
    ),
    is_active: bool | None = Query(
        default=True,
        description="Active/inactive filter",
    ),
    prepared_by_name: str | None = Query(
        default=None,
        description="Prepared by name override",
    ),
    prepared_on: date | None = Query(
        default=None,
        description="Prepared on date YYYY-MM-DD",
    ),
    organization_name: str | None = Query(
        default="Union Meat Group",
        description="Organization name",
    ),
    report_title: str | None = Query(
        default="UMG Slaughter Services Report",
        description="Custom report title",
    ),
    include_rows: bool = Query(default=True),
    include_totals: bool = Query(default=True),
    include_client_summary: bool = Query(default=True),
    include_animal_summary: bool = Query(default=True),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    service: SaaSService = Depends(get_saas_service),
) -> SaaSWeeklyReportData:
    payload = SaaSWeeklyReportRequest(
        reference_date=reference_date,
        week_starts_on=week_starts_on,
        client_name=client_name,
        animal_type=animal_type,
        is_active=is_active,
        prepared_by_name=resolve_prepared_by_name(current_user, prepared_by_name),
        prepared_on=prepared_on,
        organization_name=organization_name,
        report_title=report_title,
        include_rows=include_rows,
        include_totals=include_totals,
        include_client_summary=include_client_summary,
        include_animal_summary=include_animal_summary,
    )
    return service.get_weekly_report(db, payload)


@router.get(
    "/reports/monthly",
    response_model=SaaSMonthlyReportData,
    summary="Get monthly slaughter service report",
)
def get_monthly_saas_report(
    month: int = Query(ge=1, le=12, description="Month number"),
    year: int = Query(ge=2000, le=9999, description="Year"),
    client_name: str | None = Query(
        default=None,
        description="Client name filter",
    ),
    animal_type: str | None = Query(
        default=None,
        description="Animal type filter",
    ),
    is_active: bool | None = Query(
        default=True,
        description="Active/inactive filter",
    ),
    prepared_by_name: str | None = Query(
        default=None,
        description="Prepared by name override",
    ),
    prepared_on: date | None = Query(
        default=None,
        description="Prepared on date YYYY-MM-DD",
    ),
    organization_name: str | None = Query(
        default="Union Meat Group",
        description="Organization name",
    ),
    report_title: str | None = Query(
        default="UMG Slaughter Services Report",
        description="Custom report title",
    ),
    include_rows: bool = Query(default=True),
    include_totals: bool = Query(default=True),
    include_client_summary: bool = Query(default=True),
    include_animal_summary: bool = Query(default=True),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    service: SaaSService = Depends(get_saas_service),
) -> SaaSMonthlyReportData:
    payload = SaaSMonthlyReportRequest(
        month=month,
        year=year,
        client_name=client_name,
        animal_type=animal_type,
        is_active=is_active,
        prepared_by_name=resolve_prepared_by_name(current_user, prepared_by_name),
        prepared_on=prepared_on,
        organization_name=organization_name,
        report_title=report_title,
        include_rows=include_rows,
        include_totals=include_totals,
        include_client_summary=include_client_summary,
        include_animal_summary=include_animal_summary,
    )
    return service.get_monthly_report(db, payload)


@router.get(
    "/reports/range",
    response_model=SaaSDateRangeReportData,
    summary="Get date-range slaughter service report",
)
def get_date_range_saas_report(
    start_date: date = Query(description="Start date YYYY-MM-DD"),
    end_date: date = Query(description="End date YYYY-MM-DD"),
    client_name: str | None = Query(
        default=None,
        description="Client name filter",
    ),
    animal_type: str | None = Query(
        default=None,
        description="Animal type filter",
    ),
    is_active: bool | None = Query(
        default=True,
        description="Active/inactive filter",
    ),
    prepared_by_name: str | None = Query(
        default=None,
        description="Prepared by name override",
    ),
    prepared_on: date | None = Query(
        default=None,
        description="Prepared on date YYYY-MM-DD",
    ),
    organization_name: str | None = Query(
        default="Union Meat Group",
        description="Organization name",
    ),
    report_title: str | None = Query(
        default="UMG Slaughter Services Report",
        description="Custom report title",
    ),
    include_rows: bool = Query(default=True),
    include_totals: bool = Query(default=True),
    include_client_summary: bool = Query(default=True),
    include_animal_summary: bool = Query(default=True),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    service: SaaSService = Depends(get_saas_service),
) -> SaaSDateRangeReportData:
    payload = SaaSDateRangeReportRequest(
        start_date=start_date,
        end_date=end_date,
        client_name=client_name,
        animal_type=animal_type,
        is_active=is_active,
        prepared_by_name=resolve_prepared_by_name(current_user, prepared_by_name),
        prepared_on=prepared_on,
        organization_name=organization_name,
        report_title=report_title,
        include_rows=include_rows,
        include_totals=include_totals,
        include_client_summary=include_client_summary,
        include_animal_summary=include_animal_summary,
    )
    return service.get_date_range_report(db, payload)


# =============================================================================
# EXPORTS - GENERIC
# =============================================================================
@router.get(
    "/exports",
    summary="Export slaughter service report as Excel or PDF",
)
def export_saas_report(
    export_format: str = Query(default="excel", description="excel or pdf"),
    scope: str = Query(
        default="monthly",
        description="daily, weekly, monthly, range",
    ),
    report_date: date | None = Query(
        default=None,
        description="Daily report date YYYY-MM-DD",
    ),
    reference_date: date | None = Query(
        default=None,
        description="Weekly reference date YYYY-MM-DD",
    ),
    week_starts_on: str = Query(
        default="monday",
        description="monday or sunday",
    ),
    month: int | None = Query(
        default=None,
        ge=1,
        le=12,
        description="Month number",
    ),
    year: int | None = Query(
        default=None,
        ge=2000,
        le=9999,
        description="Year",
    ),
    start_date: date | None = Query(
        default=None,
        description="Start date YYYY-MM-DD",
    ),
    end_date: date | None = Query(
        default=None,
        description="End date YYYY-MM-DD",
    ),
    client_name: str | None = Query(
        default=None,
        description="Client name filter",
    ),
    animal_type: str | None = Query(
        default=None,
        description="Animal type filter",
    ),
    is_active: bool | None = Query(
        default=True,
        description="Active/inactive filter",
    ),
    report_title: str | None = Query(
        default="UMG Slaughter Services Report",
        description="Custom report title",
    ),
    file_name: str | None = Query(
        default=None,
        description="Custom file name without extension",
    ),
    prepared_by_name: str | None = Query(
        default=None,
        description="Prepared by name override",
    ),
    prepared_on: date | None = Query(
        default=None,
        description="Prepared on date YYYY-MM-DD",
    ),
    organization_name: str | None = Query(
        default="Union Meat Group",
        description="Organization name",
    ),
    include_rows: bool = Query(default=True),
    include_totals: bool = Query(default=True),
    include_client_summary: bool = Query(default=True),
    include_animal_summary: bool = Query(default=True),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    export_service: SaaSExportService = Depends(get_saas_export_service),
) -> Response:
    payload = build_common_export_payload(
        export_format=export_format,
        scope=scope,
        current_user=current_user,
        report_date=report_date,
        reference_date=reference_date,
        week_starts_on=week_starts_on,
        month=month,
        year=year,
        start_date=start_date,
        end_date=end_date,
        client_name=client_name,
        animal_type=animal_type,
        is_active=is_active,
        report_title=report_title,
        file_name=file_name,
        prepared_by_name=prepared_by_name,
        prepared_on=prepared_on,
        organization_name=organization_name,
        include_rows=include_rows,
        include_totals=include_totals,
        include_client_summary=include_client_summary,
        include_animal_summary=include_animal_summary,
    )
    exported = export_service.export(db, payload)
    return build_export_response(exported)


# =============================================================================
# EXPORTS - DAILY
# =============================================================================
@router.get(
    "/exports/daily/excel",
    summary="Export daily slaughter service report to Excel",
)
def export_daily_saas_excel(
    report_date: date = Query(description="Daily report date YYYY-MM-DD"),
    client_name: str | None = Query(
        default=None,
        description="Client name filter",
    ),
    animal_type: str | None = Query(
        default=None,
        description="Animal type filter",
    ),
    is_active: bool | None = Query(
        default=True,
        description="Active/inactive filter",
    ),
    report_title: str | None = Query(
        default="UMG Slaughter Services Report",
        description="Custom report title",
    ),
    file_name: str | None = Query(
        default=None,
        description="Custom file name without extension",
    ),
    prepared_by_name: str | None = Query(
        default=None,
        description="Prepared by name override",
    ),
    prepared_on: date | None = Query(
        default=None,
        description="Prepared on date YYYY-MM-DD",
    ),
    organization_name: str | None = Query(
        default="Union Meat Group",
        description="Organization name",
    ),
    include_rows: bool = Query(default=True),
    include_totals: bool = Query(default=True),
    include_client_summary: bool = Query(default=True),
    include_animal_summary: bool = Query(default=True),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    export_service: SaaSExportService = Depends(get_saas_export_service),
) -> Response:
    payload = build_common_export_payload(
        export_format="excel",
        scope="daily",
        current_user=current_user,
        report_date=report_date,
        client_name=client_name,
        animal_type=animal_type,
        is_active=is_active,
        report_title=report_title,
        file_name=file_name,
        prepared_by_name=prepared_by_name,
        prepared_on=prepared_on,
        organization_name=organization_name,
        include_rows=include_rows,
        include_totals=include_totals,
        include_client_summary=include_client_summary,
        include_animal_summary=include_animal_summary,
    )
    exported = export_service.export(db, payload)
    return build_export_response(exported)


@router.get(
    "/exports/daily/pdf",
    summary="Export daily slaughter service report to PDF",
)
def export_daily_saas_pdf(
    report_date: date = Query(description="Daily report date YYYY-MM-DD"),
    client_name: str | None = Query(
        default=None,
        description="Client name filter",
    ),
    animal_type: str | None = Query(
        default=None,
        description="Animal type filter",
    ),
    is_active: bool | None = Query(
        default=True,
        description="Active/inactive filter",
    ),
    report_title: str | None = Query(
        default="UMG Slaughter Services Report",
        description="Custom report title",
    ),
    file_name: str | None = Query(
        default=None,
        description="Custom file name without extension",
    ),
    prepared_by_name: str | None = Query(
        default=None,
        description="Prepared by name override",
    ),
    prepared_on: date | None = Query(
        default=None,
        description="Prepared on date YYYY-MM-DD",
    ),
    organization_name: str | None = Query(
        default="Union Meat Group",
        description="Organization name",
    ),
    include_rows: bool = Query(default=True),
    include_totals: bool = Query(default=True),
    include_client_summary: bool = Query(default=True),
    include_animal_summary: bool = Query(default=True),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    export_service: SaaSExportService = Depends(get_saas_export_service),
) -> Response:
    payload = build_common_export_payload(
        export_format="pdf",
        scope="daily",
        current_user=current_user,
        report_date=report_date,
        client_name=client_name,
        animal_type=animal_type,
        is_active=is_active,
        report_title=report_title,
        file_name=file_name,
        prepared_by_name=prepared_by_name,
        prepared_on=prepared_on,
        organization_name=organization_name,
        include_rows=include_rows,
        include_totals=include_totals,
        include_client_summary=include_client_summary,
        include_animal_summary=include_animal_summary,
    )
    exported = export_service.export(db, payload)
    return build_export_response(exported)


# =============================================================================
# EXPORTS - WEEKLY
# =============================================================================
@router.get(
    "/exports/weekly/excel",
    summary="Export weekly slaughter service report to Excel",
)
def export_weekly_saas_excel(
    reference_date: date = Query(
        description="Any date within the week YYYY-MM-DD"
    ),
    week_starts_on: str = Query(
        default="monday",
        description="monday or sunday",
    ),
    client_name: str | None = Query(
        default=None,
        description="Client name filter",
    ),
    animal_type: str | None = Query(
        default=None,
        description="Animal type filter",
    ),
    is_active: bool | None = Query(
        default=True,
        description="Active/inactive filter",
    ),
    report_title: str | None = Query(
        default="UMG Slaughter Services Report",
        description="Custom report title",
    ),
    file_name: str | None = Query(
        default=None,
        description="Custom file name without extension",
    ),
    prepared_by_name: str | None = Query(
        default=None,
        description="Prepared by name override",
    ),
    prepared_on: date | None = Query(
        default=None,
        description="Prepared on date YYYY-MM-DD",
    ),
    organization_name: str | None = Query(
        default="Union Meat Group",
        description="Organization name",
    ),
    include_rows: bool = Query(default=True),
    include_totals: bool = Query(default=True),
    include_client_summary: bool = Query(default=True),
    include_animal_summary: bool = Query(default=True),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    export_service: SaaSExportService = Depends(get_saas_export_service),
) -> Response:
    payload = build_common_export_payload(
        export_format="excel",
        scope="weekly",
        current_user=current_user,
        reference_date=reference_date,
        week_starts_on=week_starts_on,
        client_name=client_name,
        animal_type=animal_type,
        is_active=is_active,
        report_title=report_title,
        file_name=file_name,
        prepared_by_name=prepared_by_name,
        prepared_on=prepared_on,
        organization_name=organization_name,
        include_rows=include_rows,
        include_totals=include_totals,
        include_client_summary=include_client_summary,
        include_animal_summary=include_animal_summary,
    )
    exported = export_service.export(db, payload)
    return build_export_response(exported)


@router.get(
    "/exports/weekly/pdf",
    summary="Export weekly slaughter service report to PDF",
)
def export_weekly_saas_pdf(
    reference_date: date = Query(
        description="Any date within the week YYYY-MM-DD"
    ),
    week_starts_on: str = Query(
        default="monday",
        description="monday or sunday",
    ),
    client_name: str | None = Query(
        default=None,
        description="Client name filter",
    ),
    animal_type: str | None = Query(
        default=None,
        description="Animal type filter",
    ),
    is_active: bool | None = Query(
        default=True,
        description="Active/inactive filter",
    ),
    report_title: str | None = Query(
        default="UMG Slaughter Services Report",
        description="Custom report title",
    ),
    file_name: str | None = Query(
        default=None,
        description="Custom file name without extension",
    ),
    prepared_by_name: str | None = Query(
        default=None,
        description="Prepared by name override",
    ),
    prepared_on: date | None = Query(
        default=None,
        description="Prepared on date YYYY-MM-DD",
    ),
    organization_name: str | None = Query(
        default="Union Meat Group",
        description="Organization name",
    ),
    include_rows: bool = Query(default=True),
    include_totals: bool = Query(default=True),
    include_client_summary: bool = Query(default=True),
    include_animal_summary: bool = Query(default=True),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    export_service: SaaSExportService = Depends(get_saas_export_service),
) -> Response:
    payload = build_common_export_payload(
        export_format="pdf",
        scope="weekly",
        current_user=current_user,
        reference_date=reference_date,
        week_starts_on=week_starts_on,
        client_name=client_name,
        animal_type=animal_type,
        is_active=is_active,
        report_title=report_title,
        file_name=file_name,
        prepared_by_name=prepared_by_name,
        prepared_on=prepared_on,
        organization_name=organization_name,
        include_rows=include_rows,
        include_totals=include_totals,
        include_client_summary=include_client_summary,
        include_animal_summary=include_animal_summary,
    )
    exported = export_service.export(db, payload)
    return build_export_response(exported)


# =============================================================================
# EXPORTS - MONTHLY
# =============================================================================
@router.get(
    "/exports/monthly/excel",
    summary="Export monthly slaughter service report to Excel",
)
def export_monthly_saas_excel(
    month: int = Query(ge=1, le=12, description="Month number"),
    year: int = Query(ge=2000, le=9999, description="Year"),
    client_name: str | None = Query(
        default=None,
        description="Client name filter",
    ),
    animal_type: str | None = Query(
        default=None,
        description="Animal type filter",
    ),
    is_active: bool | None = Query(
        default=True,
        description="Active/inactive filter",
    ),
    report_title: str | None = Query(
        default="UMG Slaughter Services Report",
        description="Custom report title",
    ),
    file_name: str | None = Query(
        default=None,
        description="Custom file name without extension",
    ),
    prepared_by_name: str | None = Query(
        default=None,
        description="Prepared by name override",
    ),
    prepared_on: date | None = Query(
        default=None,
        description="Prepared on date YYYY-MM-DD",
    ),
    organization_name: str | None = Query(
        default="Union Meat Group",
        description="Organization name",
    ),
    include_rows: bool = Query(default=True),
    include_totals: bool = Query(default=True),
    include_client_summary: bool = Query(default=True),
    include_animal_summary: bool = Query(default=True),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    export_service: SaaSExportService = Depends(get_saas_export_service),
) -> Response:
    payload = build_common_export_payload(
        export_format="excel",
        scope="monthly",
        current_user=current_user,
        month=month,
        year=year,
        client_name=client_name,
        animal_type=animal_type,
        is_active=is_active,
        report_title=report_title,
        file_name=file_name,
        prepared_by_name=prepared_by_name,
        prepared_on=prepared_on,
        organization_name=organization_name,
        include_rows=include_rows,
        include_totals=include_totals,
        include_client_summary=include_client_summary,
        include_animal_summary=include_animal_summary,
    )
    exported = export_service.export(db, payload)
    return build_export_response(exported)


@router.get(
    "/exports/monthly/pdf",
    summary="Export monthly slaughter service report to PDF",
)
def export_monthly_saas_pdf(
    month: int = Query(ge=1, le=12, description="Month number"),
    year: int = Query(ge=2000, le=9999, description="Year"),
    client_name: str | None = Query(
        default=None,
        description="Client name filter",
    ),
    animal_type: str | None = Query(
        default=None,
        description="Animal type filter",
    ),
    is_active: bool | None = Query(
        default=True,
        description="Active/inactive filter",
    ),
    report_title: str | None = Query(
        default="UMG Slaughter Services Report",
        description="Custom report title",
    ),
    file_name: str | None = Query(
        default=None,
        description="Custom file name without extension",
    ),
    prepared_by_name: str | None = Query(
        default=None,
        description="Prepared by name override",
    ),
    prepared_on: date | None = Query(
        default=None,
        description="Prepared on date YYYY-MM-DD",
    ),
    organization_name: str | None = Query(
        default="Union Meat Group",
        description="Organization name",
    ),
    include_rows: bool = Query(default=True),
    include_totals: bool = Query(default=True),
    include_client_summary: bool = Query(default=True),
    include_animal_summary: bool = Query(default=True),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    export_service: SaaSExportService = Depends(get_saas_export_service),
) -> Response:
    payload = build_common_export_payload(
        export_format="pdf",
        scope="monthly",
        current_user=current_user,
        month=month,
        year=year,
        client_name=client_name,
        animal_type=animal_type,
        is_active=is_active,
        report_title=report_title,
        file_name=file_name,
        prepared_by_name=prepared_by_name,
        prepared_on=prepared_on,
        organization_name=organization_name,
        include_rows=include_rows,
        include_totals=include_totals,
        include_client_summary=include_client_summary,
        include_animal_summary=include_animal_summary,
    )
    exported = export_service.export(db, payload)
    return build_export_response(exported)


# =============================================================================
# EXPORTS - RANGE
# =============================================================================
@router.get(
    "/exports/range/excel",
    summary="Export date-range slaughter service report to Excel",
)
def export_range_saas_excel(
    start_date: date = Query(description="Start date YYYY-MM-DD"),
    end_date: date = Query(description="End date YYYY-MM-DD"),
    client_name: str | None = Query(
        default=None,
        description="Client name filter",
    ),
    animal_type: str | None = Query(
        default=None,
        description="Animal type filter",
    ),
    is_active: bool | None = Query(
        default=True,
        description="Active/inactive filter",
    ),
    report_title: str | None = Query(
        default="UMG Slaughter Services Report",
        description="Custom report title",
    ),
    file_name: str | None = Query(
        default=None,
        description="Custom file name without extension",
    ),
    prepared_by_name: str | None = Query(
        default=None,
        description="Prepared by name override",
    ),
    prepared_on: date | None = Query(
        default=None,
        description="Prepared on date YYYY-MM-DD",
    ),
    organization_name: str | None = Query(
        default="Union Meat Group",
        description="Organization name",
    ),
    include_rows: bool = Query(default=True),
    include_totals: bool = Query(default=True),
    include_client_summary: bool = Query(default=True),
    include_animal_summary: bool = Query(default=True),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    export_service: SaaSExportService = Depends(get_saas_export_service),
) -> Response:
    payload = build_common_export_payload(
        export_format="excel",
        scope="range",
        current_user=current_user,
        start_date=start_date,
        end_date=end_date,
        client_name=client_name,
        animal_type=animal_type,
        is_active=is_active,
        report_title=report_title,
        file_name=file_name,
        prepared_by_name=prepared_by_name,
        prepared_on=prepared_on,
        organization_name=organization_name,
        include_rows=include_rows,
        include_totals=include_totals,
        include_client_summary=include_client_summary,
        include_animal_summary=include_animal_summary,
    )
    exported = export_service.export(db, payload)
    return build_export_response(exported)


@router.get(
    "/exports/range/pdf",
    summary="Export date-range slaughter service report to PDF",
)
def export_range_saas_pdf(
    start_date: date = Query(description="Start date YYYY-MM-DD"),
    end_date: date = Query(description="End date YYYY-MM-DD"),
    client_name: str | None = Query(
        default=None,
        description="Client name filter",
    ),
    animal_type: str | None = Query(
        default=None,
        description="Animal type filter",
    ),
    is_active: bool | None = Query(
        default=True,
        description="Active/inactive filter",
    ),
    report_title: str | None = Query(
        default="UMG Slaughter Services Report",
        description="Custom report title",
    ),
    file_name: str | None = Query(
        default=None,
        description="Custom file name without extension",
    ),
    prepared_by_name: str | None = Query(
        default=None,
        description="Prepared by name override",
    ),
    prepared_on: date | None = Query(
        default=None,
        description="Prepared on date YYYY-MM-DD",
    ),
    organization_name: str | None = Query(
        default="Union Meat Group",
        description="Organization name",
    ),
    include_rows: bool = Query(default=True),
    include_totals: bool = Query(default=True),
    include_client_summary: bool = Query(default=True),
    include_animal_summary: bool = Query(default=True),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    export_service: SaaSExportService = Depends(get_saas_export_service),
) -> Response:
    payload = build_common_export_payload(
        export_format="pdf",
        scope="range",
        current_user=current_user,
        start_date=start_date,
        end_date=end_date,
        client_name=client_name,
        animal_type=animal_type,
        is_active=is_active,
        report_title=report_title,
        file_name=file_name,
        prepared_by_name=prepared_by_name,
        prepared_on=prepared_on,
        organization_name=organization_name,
        include_rows=include_rows,
        include_totals=include_totals,
        include_client_summary=include_client_summary,
        include_animal_summary=include_animal_summary,
    )
    exported = export_service.export(db, payload)
    return build_export_response(exported)


# =============================================================================
# CRUD - SINGLE RECORD ROUTES LAST
# =============================================================================
@router.get(
    "/{saas_id}",
    response_model=SaaSRead,
    summary="Get one slaughter service record",
)
def get_saas_record(
    saas_id: UUID,
    db: Session = Depends(get_db),
    service: SaaSService = Depends(get_saas_service),
) -> SaaSRead:
    return service.get(db, saas_id)


@router.put(
    "/{saas_id}",
    response_model=SaaSRead,
    summary="Update a slaughter service record",
)
def update_saas_record(
    saas_id: UUID,
    payload: SaaSUpdate,
    db: Session = Depends(get_db),
    service: SaaSService = Depends(get_saas_service),
) -> SaaSRead:
    return service.update(db, saas_id, payload)


@router.delete(
    "/{saas_id}",
    response_model=SaaSRead,
    summary="Soft delete a slaughter service record",
)
def soft_delete_saas_record(
    saas_id: UUID,
    db: Session = Depends(get_db),
    service: SaaSService = Depends(get_saas_service),
) -> SaaSRead:
    return service.soft_delete(db, saas_id)


@router.post(
    "/{saas_id}/restore",
    response_model=SaaSRead,
    summary="Restore a soft-deleted slaughter service record",
)
def restore_saas_record(
    saas_id: UUID,
    db: Session = Depends(get_db),
    service: SaaSService = Depends(get_saas_service),
) -> SaaSRead:
    return service.restore(db, saas_id)


@router.delete(
    "/{saas_id}/hard",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Permanently delete a slaughter service record",
)
def hard_delete_saas_record(
    saas_id: UUID,
    db: Session = Depends(get_db),
    service: SaaSService = Depends(get_saas_service),
) -> Response:
    service.hard_delete(db, saas_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)