from __future__ import annotations

from io import BytesIO
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_active_user
from app.models.audit import AuditPeriodType
from app.models.inventory import ConsumableStoreName, ProductStoreName
from app.models.user import User
from app.schemas.audit import (
    AuditExportFileResponse,
    AuditGenerateResponse,
    AuditRemarksUpdate,
    ConsumableAuditFilter,
    ConsumableAuditGenerateRequest,
    ConsumableAuditListResponse,
    ConsumableAuditRead,
    ConsumableAuditReportRequest,
    ConsumableAuditReportResponse,
    ProductAuditFilter,
    ProductAuditGenerateRequest,
    ProductAuditListResponse,
    ProductAuditRead,
    ProductAuditReportRequest,
    ProductAuditReportResponse,
)
from app.services.audit_service import (
    AuditConflictError,
    AuditNotFoundError,
    AuditService,
    AuditServiceError,
)

router = APIRouter(prefix="/audit", tags=["Audit"])


# =============================================================================
# DEPENDENCIES
# =============================================================================


def get_audit_service(
    db: Annotated[Session, Depends(get_db)],
) -> AuditService:
    return AuditService(db)


def resolve_actor_id(current_user: User) -> str | None:
    user_id = getattr(current_user, "id", None)
    if user_id is None:
        return None
    return str(user_id)


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


def _raise_http_error(exc: Exception) -> None:
    if isinstance(exc, HTTPException):
        raise exc
    if isinstance(exc, AuditNotFoundError):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    if isinstance(exc, AuditConflictError):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))
    if isinstance(exc, AuditServiceError):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="Unexpected audit error.",
    )


# =============================================================================
# FILTER BUILDERS
# =============================================================================


def build_product_audit_filter(
    audit_period_type: AuditPeriodType | None = Query(default=None),
    period_start_date=None,
    period_end_date=None,
    store: ProductStoreName | None = Query(default=None),
    product_category_id: str | None = Query(default=None),
    product_id: str | None = Query(default=None),
    search: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=500),
) -> ProductAuditFilter:
    return ProductAuditFilter.model_validate(
        {
            "audit_period_type": audit_period_type,
            "period_start_date": period_start_date,
            "period_end_date": period_end_date,
            "store": store,
            "product_category_id": product_category_id,
            "product_id": product_id,
            "search": search,
            "page": page,
            "page_size": page_size,
        }
    )


def build_consumable_audit_filter(
    audit_period_type: AuditPeriodType | None = Query(default=None),
    period_start_date=None,
    period_end_date=None,
    store: ConsumableStoreName | None = Query(default=None),
    item_category_id: str | None = Query(default=None),
    item_id: str | None = Query(default=None),
    search: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=500),
) -> ConsumableAuditFilter:
    return ConsumableAuditFilter.model_validate(
        {
            "audit_period_type": audit_period_type,
            "period_start_date": period_start_date,
            "period_end_date": period_end_date,
            "store": store,
            "item_category_id": item_category_id,
            "item_id": item_id,
            "search": search,
            "page": page,
            "page_size": page_size,
        }
    )


# =============================================================================
# PRODUCT AUDIT GENERATION
# =============================================================================


@router.post(
    "/product/generate",
    response_model=AuditGenerateResponse,
    status_code=status.HTTP_200_OK,
)
def generate_product_audit(
    payload: ProductAuditGenerateRequest,
    service: Annotated[AuditService, Depends(get_audit_service)],
    current_user: User = Depends(get_current_active_user),
) -> AuditGenerateResponse:
    try:
        return service.generate_product_audit(
            payload,
            actor_id=resolve_actor_id(current_user),
        )
    except Exception as exc:
        _raise_http_error(exc)


# =============================================================================
# PRODUCT AUDIT LIST / READ / UPDATE REMARKS
# =============================================================================


@router.get("/product", response_model=ProductAuditListResponse)
def list_product_audits(
    filters: Annotated[ProductAuditFilter, Depends(build_product_audit_filter)],
    service: Annotated[AuditService, Depends(get_audit_service)],
    current_user: User = Depends(get_current_active_user),
) -> ProductAuditListResponse:
    try:
        return service.list_product_audits(filters)
    except Exception as exc:
        _raise_http_error(exc)


@router.get("/product/{audit_id}", response_model=ProductAuditRead)
def get_product_audit(
    audit_id: str,
    service: Annotated[AuditService, Depends(get_audit_service)],
    current_user: User = Depends(get_current_active_user),
) -> ProductAuditRead:
    try:
        return service._to_product_audit_read(service.get_product_audit_or_404(audit_id))
    except Exception as exc:
        _raise_http_error(exc)


@router.patch("/product/{audit_id}/remarks", response_model=ProductAuditRead)
def update_product_audit_remarks(
    audit_id: str,
    payload: AuditRemarksUpdate,
    service: Annotated[AuditService, Depends(get_audit_service)],
    current_user: User = Depends(get_current_active_user),
) -> ProductAuditRead:
    try:
        return service.update_product_audit_remarks(
            audit_id,
            payload,
            updated_by=resolve_actor_id(current_user),
        )
    except Exception as exc:
        _raise_http_error(exc)


# =============================================================================
# PRODUCT AUDIT REPORTS
# =============================================================================


@router.post("/product/reports/generate", response_model=ProductAuditReportResponse)
def generate_product_audit_report(
    payload: ProductAuditReportRequest,
    service: Annotated[AuditService, Depends(get_audit_service)],
    current_user: User = Depends(get_current_active_user),
) -> ProductAuditReportResponse:
    try:
        return service.build_product_audit_report(payload)
    except Exception as exc:
        _raise_http_error(exc)


@router.post("/product/reports/export", response_model=AuditExportFileResponse)
def export_product_audit_report_info(
    payload: ProductAuditReportRequest,
    service: Annotated[AuditService, Depends(get_audit_service)],
    current_user: User = Depends(get_current_active_user),
) -> AuditExportFileResponse:
    try:
        return service.export_product_file_info(
            payload,
            prepared_by=resolve_prepared_by_name(current_user),
        )
    except Exception as exc:
        _raise_http_error(exc)


@router.post("/product/reports/download")
def download_product_audit_report(
    payload: ProductAuditReportRequest,
    service: Annotated[AuditService, Depends(get_audit_service)],
    current_user: User = Depends(get_current_active_user),
):
    try:
        generated = service.export_product_audit_report(
            payload,
            prepared_by=resolve_prepared_by_name(current_user),
        )
        return StreamingResponse(
            BytesIO(generated.data),
            media_type=generated.content_type,
            headers={
                "Content-Disposition": f'attachment; filename="{generated.filename}"',
            },
        )
    except Exception as exc:
        _raise_http_error(exc)


# =============================================================================
# CONSUMABLE AUDIT GENERATION
# =============================================================================


@router.post(
    "/consumable/generate",
    response_model=AuditGenerateResponse,
    status_code=status.HTTP_200_OK,
)
def generate_consumable_audit(
    payload: ConsumableAuditGenerateRequest,
    service: Annotated[AuditService, Depends(get_audit_service)],
    current_user: User = Depends(get_current_active_user),
) -> AuditGenerateResponse:
    try:
        return service.generate_consumable_audit(
            payload,
            actor_id=resolve_actor_id(current_user),
        )
    except Exception as exc:
        _raise_http_error(exc)


# =============================================================================
# CONSUMABLE AUDIT LIST / READ / UPDATE REMARKS
# =============================================================================


@router.get("/consumable", response_model=ConsumableAuditListResponse)
def list_consumable_audits(
    filters: Annotated[ConsumableAuditFilter, Depends(build_consumable_audit_filter)],
    service: Annotated[AuditService, Depends(get_audit_service)],
    current_user: User = Depends(get_current_active_user),
) -> ConsumableAuditListResponse:
    try:
        return service.list_consumable_audits(filters)
    except Exception as exc:
        _raise_http_error(exc)


@router.get("/consumable/{audit_id}", response_model=ConsumableAuditRead)
def get_consumable_audit(
    audit_id: str,
    service: Annotated[AuditService, Depends(get_audit_service)],
    current_user: User = Depends(get_current_active_user),
) -> ConsumableAuditRead:
    try:
        return service._to_consumable_audit_read(service.get_consumable_audit_or_404(audit_id))
    except Exception as exc:
        _raise_http_error(exc)


@router.patch("/consumable/{audit_id}/remarks", response_model=ConsumableAuditRead)
def update_consumable_audit_remarks(
    audit_id: str,
    payload: AuditRemarksUpdate,
    service: Annotated[AuditService, Depends(get_audit_service)],
    current_user: User = Depends(get_current_active_user),
) -> ConsumableAuditRead:
    try:
        return service.update_consumable_audit_remarks(
            audit_id,
            payload,
            updated_by=resolve_actor_id(current_user),
        )
    except Exception as exc:
        _raise_http_error(exc)


# =============================================================================
# CONSUMABLE AUDIT REPORTS
# =============================================================================


@router.post("/consumable/reports/generate", response_model=ConsumableAuditReportResponse)
def generate_consumable_audit_report(
    payload: ConsumableAuditReportRequest,
    service: Annotated[AuditService, Depends(get_audit_service)],
    current_user: User = Depends(get_current_active_user),
) -> ConsumableAuditReportResponse:
    try:
        return service.build_consumable_audit_report(payload)
    except Exception as exc:
        _raise_http_error(exc)


@router.post("/consumable/reports/export", response_model=AuditExportFileResponse)
def export_consumable_audit_report_info(
    payload: ConsumableAuditReportRequest,
    service: Annotated[AuditService, Depends(get_audit_service)],
    current_user: User = Depends(get_current_active_user),
) -> AuditExportFileResponse:
    try:
        return service.export_consumable_file_info(
            payload,
            prepared_by=resolve_prepared_by_name(current_user),
        )
    except Exception as exc:
        _raise_http_error(exc)


@router.post("/consumable/reports/download")
def download_consumable_audit_report(
    payload: ConsumableAuditReportRequest,
    service: Annotated[AuditService, Depends(get_audit_service)],
    current_user: User = Depends(get_current_active_user),
):
    try:
        generated = service.export_consumable_audit_report(
            payload,
            prepared_by=resolve_prepared_by_name(current_user),
        )
        return StreamingResponse(
            BytesIO(generated.data),
            media_type=generated.content_type,
            headers={
                "Content-Disposition": f'attachment; filename="{generated.filename}"',
            },
        )
    except Exception as exc:
        _raise_http_error(exc)


# =============================================================================
# HEALTH / SIMPLE PING
# =============================================================================


@router.get("/health", response_model=dict)
def audit_health_check(
    current_user: User = Depends(get_current_active_user),
) -> dict:
    return {
        "success": True,
        "message": "Audit router is active.",
    }