from __future__ import annotations

from datetime import date
from pathlib import Path
from typing import Any
from uuid import UUID

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    Query,
    UploadFile,
    status,
)
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_active_user
from app.models.byproducts import (
    ByproductTemplateFormat,
    ByproductTemplateType,
)
from app.models.user import User
from app.schemas.byproducts import (
    ByproductCategoryCreate,
    ByproductCategoryFilter,
    ByproductCategoryListResponse,
    ByproductCategoryRead,
    ByproductCategoryUpdate,
    ByproductCustomerCreate,
    ByproductCustomerFilter,
    ByproductCustomerListResponse,
    ByproductCustomerRead,
    ByproductCustomerUpdate,
    ByproductDashboardResponse,
    ByproductGenerateReportDocumentRequest,
    ByproductGeneratedDocumentResponse,
    ByproductItemCreate,
    ByproductItemFilter,
    ByproductItemListResponse,
    ByproductItemRead,
    ByproductItemUpdate,
    ByproductReportFilter,
    ByproductReportResponse,
    ByproductReportTemplateCreate,
    ByproductReportTemplateFilter,
    ByproductReportTemplateListResponse,
    ByproductReportTemplateRead,
    ByproductReportTemplateUpdate,
    ByproductSaleCreate,
    ByproductSaleFilter,
    ByproductSaleListResponse,
    ByproductSaleRead,
    ByproductSaleUpdate,
    MessageResponse,
)
from app.services.byproducts_report_service import (
    build_report,
    compare_with_previous_period,
    get_accumulation_report,
    get_byproduct_summary,
    get_category_summary,
    get_customer_summary,
    get_daily_report,
    get_dashboard_summary,
    get_monthly_report,
    get_trend_report,
    get_weekly_report,
    get_custom_period_report,
)
from app.services.byproducts_service import (
    create_category,
    create_customer,
    create_item,
    create_sale,
    delete_category,
    delete_customer,
    delete_item,
    delete_sale,
    delete_sale_line,
    get_active_categories_for_selection,
    get_active_customers_for_selection,
    get_active_items_for_selection,
    get_category,
    get_customer,
    get_item,
    get_sale,
    list_categories,
    list_customers,
    list_items,
    list_sales,
    restore_category,
    restore_customer,
    restore_item,
    restore_sale,
    update_category,
    update_customer,
    update_item,
    update_sale,
    void_sale,
)
from app.services.byproducts_template_service import (
    create_template,
    create_template_from_upload,
    delete_template,
    generate_report_document,
    get_default_template_for_type,
    get_template,
    list_templates,
    preview_template_placeholders,
    refresh_template_placeholders,
    replace_template_file,
    restore_template,
    set_default_template,
    update_template,
)

router = APIRouter(prefix="/byproducts", tags=["Byproducts"])


def _actor_id(current_user: User | None) -> UUID | None:
    return getattr(current_user, "id", None)


# =============================================================================
# CATEGORY ROUTES
# =============================================================================


@router.post(
    "/categories",
    response_model=ByproductCategoryRead,
    status_code=status.HTTP_201_CREATED,
)
def create_byproduct_category(
    payload: ByproductCategoryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return create_category(db, payload, actor_id=_actor_id(current_user))


@router.get(
    "/categories",
    response_model=ByproductCategoryListResponse,
)
def list_byproduct_categories(
    search: str | None = Query(default=None),
    is_active: bool | None = Query(default=None),
    include_deleted: bool = Query(default=False),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    filters = ByproductCategoryFilter(
        search=search,
        is_active=is_active,
        include_deleted=include_deleted,
    )
    return list_categories(db, filters, skip=skip, limit=limit)


@router.get(
    "/categories/selection",
    response_model=list[ByproductCategoryRead],
)
def get_byproduct_category_selection(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return get_active_categories_for_selection(db)


@router.get(
    "/categories/{category_id}",
    response_model=ByproductCategoryRead,
)
def read_byproduct_category(
    category_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return get_category(db, category_id)


@router.put(
    "/categories/{category_id}",
    response_model=ByproductCategoryRead,
)
def update_byproduct_category(
    category_id: UUID,
    payload: ByproductCategoryUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return update_category(db, category_id, payload, actor_id=_actor_id(current_user))


@router.delete(
    "/categories/{category_id}",
    response_model=MessageResponse,
)
def delete_byproduct_category(
    category_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return delete_category(db, category_id, actor_id=_actor_id(current_user))


@router.post(
    "/categories/{category_id}/restore",
    response_model=ByproductCategoryRead,
)
def restore_byproduct_category(
    category_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return restore_category(db, category_id, actor_id=_actor_id(current_user))


# =============================================================================
# ITEM ROUTES
# =============================================================================


@router.post(
    "/items",
    response_model=ByproductItemRead,
    status_code=status.HTTP_201_CREATED,
)
def create_byproduct_item(
    payload: ByproductItemCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return create_item(db, payload, actor_id=_actor_id(current_user))


@router.get(
    "/items",
    response_model=ByproductItemListResponse,
)
def list_byproduct_items(
    search: str | None = Query(default=None),
    category_id: UUID | None = Query(default=None),
    unit_of_measure: str | None = Query(default=None),
    is_active: bool | None = Query(default=None),
    include_deleted: bool = Query(default=False),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    filters = ByproductItemFilter(
        search=search,
        category_id=category_id,
        unit_of_measure=unit_of_measure,
        is_active=is_active,
        include_deleted=include_deleted,
    )
    return list_items(db, filters, skip=skip, limit=limit)


@router.get(
    "/items/selection",
    response_model=list[ByproductItemRead],
)
def get_byproduct_item_selection(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return get_active_items_for_selection(db)


@router.get(
    "/items/{item_id}",
    response_model=ByproductItemRead,
)
def read_byproduct_item(
    item_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return get_item(db, item_id)


@router.put(
    "/items/{item_id}",
    response_model=ByproductItemRead,
)
def update_byproduct_item(
    item_id: UUID,
    payload: ByproductItemUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return update_item(db, item_id, payload, actor_id=_actor_id(current_user))


@router.delete(
    "/items/{item_id}",
    response_model=MessageResponse,
)
def delete_byproduct_item(
    item_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return delete_item(db, item_id, actor_id=_actor_id(current_user))


@router.post(
    "/items/{item_id}/restore",
    response_model=ByproductItemRead,
)
def restore_byproduct_item(
    item_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return restore_item(db, item_id, actor_id=_actor_id(current_user))


# =============================================================================
# CUSTOMER ROUTES
# =============================================================================


@router.post(
    "/customers",
    response_model=ByproductCustomerRead,
    status_code=status.HTTP_201_CREATED,
)
def create_byproduct_customer(
    payload: ByproductCustomerCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return create_customer(db, payload, actor_id=_actor_id(current_user))


@router.get(
    "/customers",
    response_model=ByproductCustomerListResponse,
)
def list_byproduct_customers(
    search: str | None = Query(default=None),
    customer_type: str | None = Query(default=None),
    business_location: str | None = Query(default=None),
    district: str | None = Query(default=None),
    region: str | None = Query(default=None),
    is_active: bool | None = Query(default=None),
    include_deleted: bool = Query(default=False),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    filters = ByproductCustomerFilter(
        search=search,
        customer_type=customer_type,
        business_location=business_location,
        district=district,
        region=region,
        is_active=is_active,
        include_deleted=include_deleted,
    )
    return list_customers(db, filters, skip=skip, limit=limit)


@router.get(
    "/customers/selection",
    response_model=list[ByproductCustomerRead],
)
def get_byproduct_customer_selection(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return get_active_customers_for_selection(db)


@router.get(
    "/customers/{customer_id}",
    response_model=ByproductCustomerRead,
)
def read_byproduct_customer(
    customer_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return get_customer(db, customer_id)


@router.put(
    "/customers/{customer_id}",
    response_model=ByproductCustomerRead,
)
def update_byproduct_customer(
    customer_id: UUID,
    payload: ByproductCustomerUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return update_customer(db, customer_id, payload, actor_id=_actor_id(current_user))


@router.delete(
    "/customers/{customer_id}",
    response_model=MessageResponse,
)
def delete_byproduct_customer(
    customer_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return delete_customer(db, customer_id, actor_id=_actor_id(current_user))


@router.post(
    "/customers/{customer_id}/restore",
    response_model=ByproductCustomerRead,
)
def restore_byproduct_customer(
    customer_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return restore_customer(db, customer_id, actor_id=_actor_id(current_user))


# =============================================================================
# SALE ROUTES
# =============================================================================


@router.post(
    "/sales",
    response_model=ByproductSaleRead,
    status_code=status.HTTP_201_CREATED,
)
def create_byproduct_sale(
    payload: ByproductSaleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return create_sale(db, payload, actor_id=_actor_id(current_user))


@router.get(
    "/sales",
    response_model=ByproductSaleListResponse,
)
def list_byproduct_sales(
    search: str | None = Query(default=None),
    sale_date_from: date | None = Query(default=None),
    sale_date_to: date | None = Query(default=None),
    customer_id: UUID | None = Query(default=None),
    byproduct_id: UUID | None = Query(default=None),
    category_id: UUID | None = Query(default=None),
    payment_mode: str | None = Query(default=None),
    status_value: str | None = Query(default=None, alias="status"),
    include_deleted: bool = Query(default=False),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    filters = ByproductSaleFilter(
        search=search,
        sale_date_from=sale_date_from,
        sale_date_to=sale_date_to,
        customer_id=customer_id,
        byproduct_id=byproduct_id,
        category_id=category_id,
        payment_mode=payment_mode,
        status=status_value,
        include_deleted=include_deleted,
    )
    return list_sales(db, filters, skip=skip, limit=limit)


@router.get(
    "/sales/{sale_id}",
    response_model=ByproductSaleRead,
)
def read_byproduct_sale(
    sale_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return get_sale(db, sale_id)


@router.put(
    "/sales/{sale_id}",
    response_model=ByproductSaleRead,
)
def update_byproduct_sale(
    sale_id: UUID,
    payload: ByproductSaleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return update_sale(db, sale_id, payload, actor_id=_actor_id(current_user))


@router.delete(
    "/sales/{sale_id}",
    response_model=MessageResponse,
)
def delete_byproduct_sale(
    sale_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return delete_sale(db, sale_id, actor_id=_actor_id(current_user))


@router.post(
    "/sales/{sale_id}/restore",
    response_model=ByproductSaleRead,
)
def restore_byproduct_sale(
    sale_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return restore_sale(db, sale_id, actor_id=_actor_id(current_user))


@router.post(
    "/sales/{sale_id}/void",
    response_model=ByproductSaleRead,
)
def void_byproduct_sale(
    sale_id: UUID,
    remarks: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return void_sale(db, sale_id, actor_id=_actor_id(current_user), remarks=remarks)


@router.delete(
    "/sales/{sale_id}/lines/{line_id}",
    response_model=ByproductSaleRead,
)
def delete_byproduct_sale_line(
    sale_id: UUID,
    line_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return delete_sale_line(db, sale_id, line_id, actor_id=_actor_id(current_user))


# =============================================================================
# REPORT ROUTES
# =============================================================================


@router.post(
    "/reports/query",
    response_model=ByproductReportResponse,
)
def query_byproduct_report(
    payload: ByproductReportFilter,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return build_report(db, payload)


@router.get(
    "/reports/daily",
    response_model=ByproductReportResponse,
)
def daily_byproduct_report(
    report_date: date = Query(...),
    customer_id: UUID | None = Query(default=None),
    byproduct_id: UUID | None = Query(default=None),
    category_id: UUID | None = Query(default=None),
    include_void: bool = Query(default=False),
    include_deleted: bool = Query(default=False),
    group_by: str | None = Query(default=None),
    search: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return get_daily_report(
        db,
        report_date,
        customer_id=customer_id,
        byproduct_id=byproduct_id,
        category_id=category_id,
        include_void=include_void,
        include_deleted=include_deleted,
        group_by=group_by,
        search=search,
    )


@router.get(
    "/reports/weekly",
    response_model=ByproductReportResponse,
)
def weekly_byproduct_report(
    target_date: date = Query(...),
    customer_id: UUID | None = Query(default=None),
    byproduct_id: UUID | None = Query(default=None),
    category_id: UUID | None = Query(default=None),
    include_void: bool = Query(default=False),
    include_deleted: bool = Query(default=False),
    group_by: str | None = Query(default=None),
    search: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return get_weekly_report(
        db,
        target_date,
        customer_id=customer_id,
        byproduct_id=byproduct_id,
        category_id=category_id,
        include_void=include_void,
        include_deleted=include_deleted,
        group_by=group_by,
        search=search,
    )


@router.get(
    "/reports/monthly",
    response_model=ByproductReportResponse,
)
def monthly_byproduct_report(
    year: int = Query(..., ge=2000, le=2100),
    month: int = Query(..., ge=1, le=12),
    customer_id: UUID | None = Query(default=None),
    byproduct_id: UUID | None = Query(default=None),
    category_id: UUID | None = Query(default=None),
    include_void: bool = Query(default=False),
    include_deleted: bool = Query(default=False),
    group_by: str | None = Query(default=None),
    search: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return get_monthly_report(
        db,
        year,
        month,
        customer_id=customer_id,
        byproduct_id=byproduct_id,
        category_id=category_id,
        include_void=include_void,
        include_deleted=include_deleted,
        group_by=group_by,
        search=search,
    )


@router.get(
    "/reports/custom",
    response_model=ByproductReportResponse,
)
def custom_period_byproduct_report(
    date_from: date = Query(...),
    date_to: date = Query(...),
    customer_id: UUID | None = Query(default=None),
    byproduct_id: UUID | None = Query(default=None),
    category_id: UUID | None = Query(default=None),
    include_void: bool = Query(default=False),
    include_deleted: bool = Query(default=False),
    group_by: str | None = Query(default=None),
    search: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return get_custom_period_report(
        db,
        date_from,
        date_to,
        customer_id=customer_id,
        byproduct_id=byproduct_id,
        category_id=category_id,
        include_void=include_void,
        include_deleted=include_deleted,
        group_by=group_by,
        search=search,
    )


@router.get(
    "/reports/accumulation",
    response_model=ByproductReportResponse,
)
def accumulation_byproduct_report(
    date_from: date = Query(...),
    date_to: date = Query(...),
    customer_id: UUID | None = Query(default=None),
    byproduct_id: UUID | None = Query(default=None),
    category_id: UUID | None = Query(default=None),
    include_void: bool = Query(default=False),
    include_deleted: bool = Query(default=False),
    group_by: str | None = Query(default=None),
    search: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return get_accumulation_report(
        db,
        date_from,
        date_to,
        customer_id=customer_id,
        byproduct_id=byproduct_id,
        category_id=category_id,
        include_void=include_void,
        include_deleted=include_deleted,
        group_by=group_by,
        search=search,
    )


@router.post(
    "/reports/trend",
    response_model=Any,
)
def byproduct_trend_report(
    payload: ByproductReportFilter,
    interval: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return get_trend_report(db, payload, interval=interval)


@router.post(
    "/reports/compare",
    response_model=Any,
)
def compare_byproduct_report_with_previous_period(
    payload: ByproductReportFilter,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return compare_with_previous_period(db, payload)


@router.get(
    "/reports/dashboard",
    response_model=ByproductDashboardResponse,
)
def byproduct_dashboard(
    date_from: date = Query(...),
    date_to: date = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return get_dashboard_summary(db, date_from=date_from, date_to=date_to)


@router.get(
    "/reports/summaries/customers",
    response_model=Any,
)
def byproduct_customer_summary(
    date_from: date = Query(...),
    date_to: date = Query(...),
    customer_id: UUID | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return get_customer_summary(
        db,
        date_from=date_from,
        date_to=date_to,
        customer_id=customer_id,
    )


@router.get(
    "/reports/summaries/byproducts",
    response_model=Any,
)
def byproduct_item_summary(
    date_from: date = Query(...),
    date_to: date = Query(...),
    category_id: UUID | None = Query(default=None),
    byproduct_id: UUID | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return get_byproduct_summary(
        db,
        date_from=date_from,
        date_to=date_to,
        category_id=category_id,
        byproduct_id=byproduct_id,
    )


@router.get(
    "/reports/summaries/categories",
    response_model=Any,
)
def byproduct_category_summary(
    date_from: date = Query(...),
    date_to: date = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return get_category_summary(db, date_from=date_from, date_to=date_to)


# =============================================================================
# TEMPLATE ROUTES
# =============================================================================


@router.post(
    "/templates",
    response_model=ByproductReportTemplateRead,
    status_code=status.HTTP_201_CREATED,
)
def create_byproduct_template(
    payload: ByproductReportTemplateCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return create_template(db, payload, actor_id=_actor_id(current_user))


@router.post(
    "/templates/upload",
    response_model=ByproductReportTemplateRead,
    status_code=status.HTTP_201_CREATED,
)
def upload_byproduct_template(
    name: str = Form(...),
    template_code: str = Form(...),
    template_type: ByproductTemplateType = Form(...),
    template_format: ByproductTemplateFormat = Form(...),
    is_default: bool = Form(False),
    notes: str | None = Form(default=None),
    is_active: bool = Form(True),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return create_template_from_upload(
        db,
        upload=file,
        name=name,
        template_code=template_code,
        template_type=template_type,
        template_format=template_format,
        is_default=is_default,
        notes=notes,
        is_active=is_active,
        actor_id=_actor_id(current_user),
    )


@router.get(
    "/templates",
    response_model=ByproductReportTemplateListResponse,
)
def list_byproduct_templates(
    search: str | None = Query(default=None),
    template_type: ByproductTemplateType | None = Query(default=None),
    template_format: ByproductTemplateFormat | None = Query(default=None),
    is_default: bool | None = Query(default=None),
    is_active: bool | None = Query(default=None),
    include_deleted: bool = Query(default=False),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    filters = ByproductReportTemplateFilter(
        search=search,
        template_type=template_type,
        template_format=template_format,
        is_default=is_default,
        is_active=is_active,
        include_deleted=include_deleted,
    )
    return list_templates(db, filters, skip=skip, limit=limit)


@router.get(
    "/templates/default",
    response_model=ByproductReportTemplateRead | None,
)
def get_default_byproduct_template(
    template_type: ByproductTemplateType = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return get_default_template_for_type(db, template_type)


@router.get(
    "/templates/{template_id}",
    response_model=ByproductReportTemplateRead,
)
def read_byproduct_template(
    template_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return get_template(db, template_id)


@router.put(
    "/templates/{template_id}",
    response_model=ByproductReportTemplateRead,
)
def update_byproduct_template(
    template_id: UUID,
    payload: ByproductReportTemplateUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return update_template(db, template_id, payload, actor_id=_actor_id(current_user))


@router.post(
    "/templates/{template_id}/replace-file",
    response_model=ByproductReportTemplateRead,
)
def replace_byproduct_template_file(
    template_id: UUID,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return replace_template_file(
        db,
        template_id,
        upload=file,
        actor_id=_actor_id(current_user),
    )


@router.delete(
    "/templates/{template_id}",
    response_model=MessageResponse,
)
def delete_byproduct_template(
    template_id: UUID,
    delete_file_from_disk: bool = Query(default=False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return delete_template(
        db,
        template_id,
        actor_id=_actor_id(current_user),
        delete_file_from_disk=delete_file_from_disk,
    )


@router.post(
    "/templates/{template_id}/restore",
    response_model=ByproductReportTemplateRead,
)
def restore_byproduct_template(
    template_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return restore_template(db, template_id, actor_id=_actor_id(current_user))


@router.post(
    "/templates/{template_id}/set-default",
    response_model=ByproductReportTemplateRead,
)
def set_default_byproduct_template(
    template_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return set_default_template(db, template_id, actor_id=_actor_id(current_user))


@router.post(
    "/templates/{template_id}/refresh-placeholders",
    response_model=ByproductReportTemplateRead,
)
def refresh_byproduct_template_placeholders(
    template_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return refresh_template_placeholders(db, template_id, actor_id=_actor_id(current_user))


@router.get(
    "/templates/{template_id}/placeholders",
    response_model=Any,
)
def preview_byproduct_template_placeholders(
    template_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return preview_template_placeholders(db, template_id)


@router.post(
    "/templates/generate",
    response_model=ByproductGeneratedDocumentResponse,
)
def generate_byproduct_report_document(
    payload: ByproductGenerateReportDocumentRequest,
    company_name: str | None = Query(default=None),
    company_address: str | None = Query(default=None),
    company_phone: str | None = Query(default=None),
    report_title: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return generate_report_document(
        db,
        payload,
        company_name=company_name,
        company_address=company_address,
        company_phone=company_phone,
        report_title=report_title,
    )