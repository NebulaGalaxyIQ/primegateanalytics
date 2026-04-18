from __future__ import annotations

import logging
import os
import traceback
from datetime import date
from io import BytesIO
from typing import Annotated, Callable, Optional, TypeVar

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_active_user
from app.models.inventory import ConsumableStoreName, ProductStoreName
from app.models.user import User
from app.schemas.inventory import (
    ConsumableDailySheetResponse,
    ConsumableInventoryBulkUpsertRequest,
    ConsumableInventoryBulkUpsertResponse,
    ConsumableInventoryReportRequest,
    ConsumableInventoryReportResponse,
    ConsumableOpeningBalancePreviewResponse,
    ConsumableStoreInventoryCreate,
    ConsumableStoreInventoryFilter,
    ConsumableStoreInventoryListResponse,
    ConsumableStoreInventoryRead,
    ConsumableStoreInventoryUpdate,
    InventoryBootstrapResponse,
    InventoryConsumableCategoryCreate,
    InventoryConsumableCategoryRead,
    InventoryConsumableCategoryUpdate,
    InventoryConsumableItemCreate,
    InventoryConsumableItemRead,
    InventoryConsumableItemUpdate,
    InventoryExportFileResponse,
    InventoryProductCategoryCreate,
    InventoryProductCategoryRead,
    InventoryProductCategoryUpdate,
    InventoryProductCreate,
    InventoryProductRead,
    InventoryProductUpdate,
    ProductBalanceUnit,
    ProductDailySheetResponse,
    ProductInventoryBulkUpsertRequest,
    ProductInventoryBulkUpsertResponse,
    ProductInventoryReportRequest,
    ProductInventoryReportResponse,
    ProductOpeningBalancePreviewResponse,
    ProductStoreInventoryCreate,
    ProductStoreInventoryFilter,
    ProductStoreInventoryListResponse,
    ProductStoreInventoryRead,
    ProductStoreInventoryUpdate,
)
from app.services.inventory_service import (
    InventoryConflictError,
    InventoryNotFoundError,
    InventoryService,
    InventoryServiceError,
)

router = APIRouter(prefix="/inventory", tags=["Inventory"])

logger = logging.getLogger(__name__)
DEBUG_INVENTORY_ERRORS = os.getenv("INVENTORY_DEBUG_ERRORS", "true").strip().lower() in {
    "1",
    "true",
    "yes",
    "on",
}

T = TypeVar("T")


# =============================================================================
# DEPENDENCIES
# =============================================================================

def get_inventory_service(
    db: Annotated[Session, Depends(get_db)],
) -> InventoryService:
    return InventoryService(db)


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

    if isinstance(exc, InventoryNotFoundError):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        )

    if isinstance(exc, InventoryConflictError):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        )

    if isinstance(exc, InventoryServiceError):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )

    logger.exception("Unhandled inventory endpoint error", exc_info=exc)

    if DEBUG_INVENTORY_ERRORS:
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unexpected inventory error: {exc.__class__.__name__}: {exc}",
        )

    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="Unexpected inventory error.",
    )


def _run_inventory_action(action: Callable[[], T]) -> T:
    try:
        return action()
    except Exception as exc:
        _raise_http_error(exc)
        raise


# =============================================================================
# FILTER BUILDERS
# =============================================================================

def build_product_inventory_filter(
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    store: ProductStoreName | None = Query(default=None),
    product_category_id: str | None = Query(default=None),
    product_id: str | None = Query(default=None),
    balance_unit: ProductBalanceUnit | None = Query(default=None),
    checked_by_initials: str | None = Query(default=None),
    search: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=500),
) -> ProductStoreInventoryFilter:
    return ProductStoreInventoryFilter.model_validate(
        {
            "start_date": start_date,
            "end_date": end_date,
            "store": store,
            "product_category_id": product_category_id,
            "product_id": product_id,
            "balance_unit": balance_unit,
            "checked_by_initials": checked_by_initials,
            "search": search,
            "page": page,
            "page_size": page_size,
        }
    )


def build_consumable_inventory_filter(
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    store: ConsumableStoreName | None = Query(default=None),
    item_category_id: str | None = Query(default=None),
    item_id: str | None = Query(default=None),
    unit: str | None = Query(default=None),
    checked_by_initials: str | None = Query(default=None),
    search: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=500),
) -> ConsumableStoreInventoryFilter:
    return ConsumableStoreInventoryFilter.model_validate(
        {
            "start_date": start_date,
            "end_date": end_date,
            "store": store,
            "item_category_id": item_category_id,
            "item_id": item_id,
            "unit": unit,
            "checked_by_initials": checked_by_initials,
            "search": search,
            "page": page,
            "page_size": page_size,
        }
    )


# =============================================================================
# BOOTSTRAP
# =============================================================================

@router.get("/bootstrap", response_model=InventoryBootstrapResponse)
def get_inventory_bootstrap(
    service: Annotated[InventoryService, Depends(get_inventory_service)],
    current_user: User = Depends(get_current_active_user),
) -> InventoryBootstrapResponse:
    _ = current_user
    return _run_inventory_action(lambda: service.get_bootstrap_data())


# =============================================================================
# PRODUCT CATEGORY ROUTES
# =============================================================================

@router.get("/product-categories", response_model=list[InventoryProductCategoryRead])
def list_product_categories(
    active_only: bool = Query(default=False),
    service: Annotated[InventoryService, Depends(get_inventory_service)] = None,
    current_user: User = Depends(get_current_active_user),
) -> list[InventoryProductCategoryRead]:
    _ = current_user
    return _run_inventory_action(lambda: service.list_product_categories(active_only=active_only))


@router.get("/product-categories/{category_id}", response_model=InventoryProductCategoryRead)
def get_product_category(
    category_id: str,
    service: Annotated[InventoryService, Depends(get_inventory_service)],
    current_user: User = Depends(get_current_active_user),
) -> InventoryProductCategoryRead:
    _ = current_user
    return _run_inventory_action(
        lambda: InventoryProductCategoryRead.model_validate(service.get_product_category_or_404(category_id))
    )


@router.post(
    "/product-categories",
    response_model=InventoryProductCategoryRead,
    status_code=status.HTTP_201_CREATED,
)
def create_product_category(
    payload: InventoryProductCategoryCreate,
    service: Annotated[InventoryService, Depends(get_inventory_service)],
    current_user: User = Depends(get_current_active_user),
) -> InventoryProductCategoryRead:
    _ = current_user
    return _run_inventory_action(lambda: service.create_product_category(payload))


@router.patch("/product-categories/{category_id}", response_model=InventoryProductCategoryRead)
def update_product_category(
    category_id: str,
    payload: InventoryProductCategoryUpdate,
    service: Annotated[InventoryService, Depends(get_inventory_service)],
    current_user: User = Depends(get_current_active_user),
) -> InventoryProductCategoryRead:
    _ = current_user
    return _run_inventory_action(lambda: service.update_product_category(category_id, payload))


@router.delete("/product-categories/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product_category(
    category_id: str,
    service: Annotated[InventoryService, Depends(get_inventory_service)],
    current_user: User = Depends(get_current_active_user),
) -> Response:
    _ = current_user

    def action() -> Response:
        service.delete_product_category(category_id)
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    return _run_inventory_action(action)


# =============================================================================
# PRODUCT ROUTES
# =============================================================================

@router.get("/products", response_model=list[InventoryProductRead])
def list_products(
    active_only: bool = Query(default=False),
    service: Annotated[InventoryService, Depends(get_inventory_service)] = None,
    current_user: User = Depends(get_current_active_user),
) -> list[InventoryProductRead]:
    _ = current_user
    return _run_inventory_action(lambda: service.list_products(active_only=active_only))


@router.get("/products/{product_id}", response_model=InventoryProductRead)
def get_product(
    product_id: str,
    service: Annotated[InventoryService, Depends(get_inventory_service)],
    current_user: User = Depends(get_current_active_user),
) -> InventoryProductRead:
    _ = current_user

    def action() -> InventoryProductRead:
        row = service.get_product_or_404(product_id)
        return InventoryProductRead.model_validate(
            {
                **row.__dict__,
                "category_name": row.category.name if row.category else None,
            }
        )

    return _run_inventory_action(action)


@router.post("/products", response_model=InventoryProductRead, status_code=status.HTTP_201_CREATED)
def create_product(
    payload: InventoryProductCreate,
    service: Annotated[InventoryService, Depends(get_inventory_service)],
    current_user: User = Depends(get_current_active_user),
) -> InventoryProductRead:
    _ = current_user
    return _run_inventory_action(lambda: service.create_product(payload))


@router.patch("/products/{product_id}", response_model=InventoryProductRead)
def update_product(
    product_id: str,
    payload: InventoryProductUpdate,
    service: Annotated[InventoryService, Depends(get_inventory_service)],
    current_user: User = Depends(get_current_active_user),
) -> InventoryProductRead:
    _ = current_user
    return _run_inventory_action(lambda: service.update_product(product_id, payload))


@router.delete("/products/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product(
    product_id: str,
    service: Annotated[InventoryService, Depends(get_inventory_service)],
    current_user: User = Depends(get_current_active_user),
) -> Response:
    _ = current_user

    def action() -> Response:
        service.delete_product(product_id)
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    return _run_inventory_action(action)


# =============================================================================
# CONSUMABLE CATEGORY ROUTES
# =============================================================================

@router.get("/consumable-categories", response_model=list[InventoryConsumableCategoryRead])
def list_consumable_categories(
    active_only: bool = Query(default=False),
    service: Annotated[InventoryService, Depends(get_inventory_service)] = None,
    current_user: User = Depends(get_current_active_user),
) -> list[InventoryConsumableCategoryRead]:
    _ = current_user
    return _run_inventory_action(lambda: service.list_consumable_categories(active_only=active_only))


@router.get("/consumable-categories/{category_id}", response_model=InventoryConsumableCategoryRead)
def get_consumable_category(
    category_id: str,
    service: Annotated[InventoryService, Depends(get_inventory_service)],
    current_user: User = Depends(get_current_active_user),
) -> InventoryConsumableCategoryRead:
    _ = current_user
    return _run_inventory_action(
        lambda: InventoryConsumableCategoryRead.model_validate(service.get_consumable_category_or_404(category_id))
    )


@router.post(
    "/consumable-categories",
    response_model=InventoryConsumableCategoryRead,
    status_code=status.HTTP_201_CREATED,
)
def create_consumable_category(
    payload: InventoryConsumableCategoryCreate,
    service: Annotated[InventoryService, Depends(get_inventory_service)],
    current_user: User = Depends(get_current_active_user),
) -> InventoryConsumableCategoryRead:
    _ = current_user
    return _run_inventory_action(lambda: service.create_consumable_category(payload))


@router.patch("/consumable-categories/{category_id}", response_model=InventoryConsumableCategoryRead)
def update_consumable_category(
    category_id: str,
    payload: InventoryConsumableCategoryUpdate,
    service: Annotated[InventoryService, Depends(get_inventory_service)],
    current_user: User = Depends(get_current_active_user),
) -> InventoryConsumableCategoryRead:
    _ = current_user
    return _run_inventory_action(lambda: service.update_consumable_category(category_id, payload))


@router.delete("/consumable-categories/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_consumable_category(
    category_id: str,
    service: Annotated[InventoryService, Depends(get_inventory_service)],
    current_user: User = Depends(get_current_active_user),
) -> Response:
    _ = current_user

    def action() -> Response:
        service.delete_consumable_category(category_id)
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    return _run_inventory_action(action)


# =============================================================================
# CONSUMABLE ITEM ROUTES
# =============================================================================

@router.get("/consumable-items", response_model=list[InventoryConsumableItemRead])
def list_consumable_items(
    active_only: bool = Query(default=False),
    service: Annotated[InventoryService, Depends(get_inventory_service)] = None,
    current_user: User = Depends(get_current_active_user),
) -> list[InventoryConsumableItemRead]:
    _ = current_user
    return _run_inventory_action(lambda: service.list_consumable_items(active_only=active_only))


@router.get("/consumable-items/{item_id}", response_model=InventoryConsumableItemRead)
def get_consumable_item(
    item_id: str,
    service: Annotated[InventoryService, Depends(get_inventory_service)],
    current_user: User = Depends(get_current_active_user),
) -> InventoryConsumableItemRead:
    _ = current_user

    def action() -> InventoryConsumableItemRead:
        row = service.get_consumable_item_or_404(item_id)
        return InventoryConsumableItemRead.model_validate(
            {
                **row.__dict__,
                "category_name": row.category.name if row.category else None,
            }
        )

    return _run_inventory_action(action)


@router.post(
    "/consumable-items",
    response_model=InventoryConsumableItemRead,
    status_code=status.HTTP_201_CREATED,
)
def create_consumable_item(
    payload: InventoryConsumableItemCreate,
    service: Annotated[InventoryService, Depends(get_inventory_service)],
    current_user: User = Depends(get_current_active_user),
) -> InventoryConsumableItemRead:
    _ = current_user
    return _run_inventory_action(lambda: service.create_consumable_item(payload))


@router.patch("/consumable-items/{item_id}", response_model=InventoryConsumableItemRead)
def update_consumable_item(
    item_id: str,
    payload: InventoryConsumableItemUpdate,
    service: Annotated[InventoryService, Depends(get_inventory_service)],
    current_user: User = Depends(get_current_active_user),
) -> InventoryConsumableItemRead:
    _ = current_user
    return _run_inventory_action(lambda: service.update_consumable_item(item_id, payload))


@router.delete("/consumable-items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_consumable_item(
    item_id: str,
    service: Annotated[InventoryService, Depends(get_inventory_service)],
    current_user: User = Depends(get_current_active_user),
) -> Response:
    _ = current_user

    def action() -> Response:
        service.delete_consumable_item(item_id)
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    return _run_inventory_action(action)


# =============================================================================
# PRODUCT STORE DAILY SHEET ROUTES
# =============================================================================

@router.get("/product-store/daily-sheet", response_model=ProductDailySheetResponse)
def get_product_store_daily_sheet(
    entry_date: date = Query(...),
    store: ProductStoreName = Query(...),
    active_only: bool = Query(default=True),
    service: Annotated[InventoryService, Depends(get_inventory_service)] = None,
    current_user: User = Depends(get_current_active_user),
) -> ProductDailySheetResponse:
    _ = current_user

    def action() -> ProductDailySheetResponse:
        result = service.get_product_daily_sheet(
            entry_date=entry_date,
            store=store,
            active_only=active_only,
        )
        return ProductDailySheetResponse.model_validate(result)

    return _run_inventory_action(action)


@router.post(
    "/product-store/entries/bulk",
    response_model=ProductInventoryBulkUpsertResponse,
)
def bulk_upsert_product_store_entries(
    payload: ProductInventoryBulkUpsertRequest,
    service: Annotated[InventoryService, Depends(get_inventory_service)],
    current_user: User = Depends(get_current_active_user),
) -> ProductInventoryBulkUpsertResponse:
    return _run_inventory_action(
        lambda: ProductInventoryBulkUpsertResponse.model_validate(
            service.bulk_upsert_product_inventory(
                entry_date=payload.entry_date,
                store=payload.store,
                rows=[row.model_dump(mode="python", exclude_none=True) for row in payload.rows],
                actor_id=resolve_actor_id(current_user),
            )
        )
    )


# =============================================================================
# PRODUCT STORE INVENTORY ENTRY ROUTES
# =============================================================================

@router.get("/product-store/entries", response_model=ProductStoreInventoryListResponse)
def list_product_store_entries(
    filters: Annotated[ProductStoreInventoryFilter, Depends(build_product_inventory_filter)],
    service: Annotated[InventoryService, Depends(get_inventory_service)],
    current_user: User = Depends(get_current_active_user),
) -> ProductStoreInventoryListResponse:
    _ = current_user
    return _run_inventory_action(lambda: service.list_product_inventory(filters))


@router.get("/product-store/entries/{entry_id}", response_model=ProductStoreInventoryRead)
def get_product_store_entry(
    entry_id: str,
    service: Annotated[InventoryService, Depends(get_inventory_service)],
    current_user: User = Depends(get_current_active_user),
) -> ProductStoreInventoryRead:
    _ = current_user
    return _run_inventory_action(lambda: service._to_product_inventory_read(service.get_product_inventory_or_404(entry_id)))


@router.post(
    "/product-store/entries",
    response_model=ProductStoreInventoryRead,
    status_code=status.HTTP_201_CREATED,
)
def create_product_store_entry(
    payload: ProductStoreInventoryCreate,
    service: Annotated[InventoryService, Depends(get_inventory_service)],
    current_user: User = Depends(get_current_active_user),
) -> ProductStoreInventoryRead:
    return _run_inventory_action(
        lambda: service.create_product_inventory_entry(
            payload,
            created_by=resolve_actor_id(current_user),
        )
    )


@router.patch("/product-store/entries/{entry_id}", response_model=ProductStoreInventoryRead)
def update_product_store_entry(
    entry_id: str,
    payload: ProductStoreInventoryUpdate,
    service: Annotated[InventoryService, Depends(get_inventory_service)],
    current_user: User = Depends(get_current_active_user),
) -> ProductStoreInventoryRead:
    return _run_inventory_action(
        lambda: service.update_product_inventory_entry(
            entry_id,
            payload,
            updated_by=resolve_actor_id(current_user),
        )
    )


@router.delete("/product-store/entries/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product_store_entry(
    entry_id: str,
    service: Annotated[InventoryService, Depends(get_inventory_service)],
    current_user: User = Depends(get_current_active_user),
) -> Response:
    _ = current_user

    def action() -> Response:
        service.delete_product_inventory_entry(entry_id)
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    return _run_inventory_action(action)


@router.get("/product-store/opening-balance", response_model=ProductOpeningBalancePreviewResponse)
def get_product_store_opening_balance(
    entry_date: date = Query(...),
    store: ProductStoreName = Query(...),
    product_id: str = Query(...),
    service: Annotated[InventoryService, Depends(get_inventory_service)] = None,
    current_user: User = Depends(get_current_active_user),
) -> ProductOpeningBalancePreviewResponse:
    _ = current_user

    def action() -> ProductOpeningBalancePreviewResponse:
        opening_balance = service.get_product_opening_balance_preview(
            entry_date=entry_date,
            store=store,
            product_id=product_id,
        )
        return ProductOpeningBalancePreviewResponse(
            entry_date=entry_date,
            store=store,
            product_id=product_id,
            opening_balance=opening_balance,
        )

    return _run_inventory_action(action)


# =============================================================================
# CONSUMABLE STORE DAILY SHEET ROUTES
# =============================================================================

@router.get("/consumable-store/daily-sheet", response_model=ConsumableDailySheetResponse)
def get_consumable_store_daily_sheet(
    entry_date: date = Query(...),
    store: ConsumableStoreName = Query(...),
    active_only: bool = Query(default=True),
    service: Annotated[InventoryService, Depends(get_inventory_service)] = None,
    current_user: User = Depends(get_current_active_user),
) -> ConsumableDailySheetResponse:
    _ = current_user

    def action() -> ConsumableDailySheetResponse:
        result = service.get_consumable_daily_sheet(
            entry_date=entry_date,
            store=store,
            active_only=active_only,
        )
        return ConsumableDailySheetResponse.model_validate(result)

    return _run_inventory_action(action)


@router.post(
    "/consumable-store/entries/bulk",
    response_model=ConsumableInventoryBulkUpsertResponse,
)
def bulk_upsert_consumable_store_entries(
    payload: ConsumableInventoryBulkUpsertRequest,
    service: Annotated[InventoryService, Depends(get_inventory_service)],
    current_user: User = Depends(get_current_active_user),
) -> ConsumableInventoryBulkUpsertResponse:
    return _run_inventory_action(
        lambda: ConsumableInventoryBulkUpsertResponse.model_validate(
            service.bulk_upsert_consumable_inventory(
                entry_date=payload.entry_date,
                store=payload.store,
                rows=[row.model_dump(mode="python", exclude_none=True) for row in payload.rows],
                actor_id=resolve_actor_id(current_user),
            )
        )
    )


# =============================================================================
# CONSUMABLE STORE INVENTORY ENTRY ROUTES
# =============================================================================

@router.get("/consumable-store/entries", response_model=ConsumableStoreInventoryListResponse)
def list_consumable_store_entries(
    filters: Annotated[ConsumableStoreInventoryFilter, Depends(build_consumable_inventory_filter)],
    service: Annotated[InventoryService, Depends(get_inventory_service)],
    current_user: User = Depends(get_current_active_user),
) -> ConsumableStoreInventoryListResponse:
    _ = current_user
    return _run_inventory_action(lambda: service.list_consumable_inventory(filters))


@router.get("/consumable-store/entries/{entry_id}", response_model=ConsumableStoreInventoryRead)
def get_consumable_store_entry(
    entry_id: str,
    service: Annotated[InventoryService, Depends(get_inventory_service)],
    current_user: User = Depends(get_current_active_user),
) -> ConsumableStoreInventoryRead:
    _ = current_user
    return _run_inventory_action(
        lambda: service._to_consumable_inventory_read(service.get_consumable_inventory_or_404(entry_id))
    )


@router.post(
    "/consumable-store/entries",
    response_model=ConsumableStoreInventoryRead,
    status_code=status.HTTP_201_CREATED,
)
def create_consumable_store_entry(
    payload: ConsumableStoreInventoryCreate,
    service: Annotated[InventoryService, Depends(get_inventory_service)],
    current_user: User = Depends(get_current_active_user),
) -> ConsumableStoreInventoryRead:
    return _run_inventory_action(
        lambda: service.create_consumable_inventory_entry(
            payload,
            created_by=resolve_actor_id(current_user),
        )
    )


@router.patch("/consumable-store/entries/{entry_id}", response_model=ConsumableStoreInventoryRead)
def update_consumable_store_entry(
    entry_id: str,
    payload: ConsumableStoreInventoryUpdate,
    service: Annotated[InventoryService, Depends(get_inventory_service)],
    current_user: User = Depends(get_current_active_user),
) -> ConsumableStoreInventoryRead:
    return _run_inventory_action(
        lambda: service.update_consumable_inventory_entry(
            entry_id,
            payload,
            updated_by=resolve_actor_id(current_user),
        )
    )


@router.delete("/consumable-store/entries/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_consumable_store_entry(
    entry_id: str,
    service: Annotated[InventoryService, Depends(get_inventory_service)],
    current_user: User = Depends(get_current_active_user),
) -> Response:
    _ = current_user

    def action() -> Response:
        service.delete_consumable_inventory_entry(entry_id)
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    return _run_inventory_action(action)


@router.get("/consumable-store/opening-balance", response_model=ConsumableOpeningBalancePreviewResponse)
def get_consumable_store_opening_balance(
    entry_date: date = Query(...),
    store: ConsumableStoreName = Query(...),
    item_id: str = Query(...),
    service: Annotated[InventoryService, Depends(get_inventory_service)] = None,
    current_user: User = Depends(get_current_active_user),
) -> ConsumableOpeningBalancePreviewResponse:
    _ = current_user

    def action() -> ConsumableOpeningBalancePreviewResponse:
        opening_balance = service.get_consumable_opening_balance_preview(
            entry_date=entry_date,
            store=store,
            item_id=item_id,
        )
        return ConsumableOpeningBalancePreviewResponse(
            entry_date=entry_date,
            store=store,
            item_id=item_id,
            opening_balance=opening_balance,
        )

    return _run_inventory_action(action)


# =============================================================================
# PRODUCT REPORT ROUTES
# =============================================================================

@router.post("/product-store/reports/generate", response_model=ProductInventoryReportResponse)
def generate_product_store_report(
    payload: ProductInventoryReportRequest,
    service: Annotated[InventoryService, Depends(get_inventory_service)],
    current_user: User = Depends(get_current_active_user),
) -> ProductInventoryReportResponse:
    _ = current_user
    return _run_inventory_action(lambda: service.build_product_inventory_report(payload))


@router.post("/product-store/reports/export", response_model=InventoryExportFileResponse)
def export_product_store_report_info(
    payload: ProductInventoryReportRequest,
    service: Annotated[InventoryService, Depends(get_inventory_service)],
    current_user: User = Depends(get_current_active_user),
) -> InventoryExportFileResponse:
    _ = current_user
    return _run_inventory_action(
        lambda: service.export_product_file_info(
            payload,
            prepared_by=resolve_prepared_by_name(current_user),
        )
    )


@router.post("/product-store/reports/download")
def download_product_store_report(
    payload: ProductInventoryReportRequest,
    service: Annotated[InventoryService, Depends(get_inventory_service)],
    current_user: User = Depends(get_current_active_user),
):
    def action():
        generated = service.export_product_inventory_report(
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

    return _run_inventory_action(action)


# =============================================================================
# CONSUMABLE REPORT ROUTES
# =============================================================================

@router.post("/consumable-store/reports/generate", response_model=ConsumableInventoryReportResponse)
def generate_consumable_store_report(
    payload: ConsumableInventoryReportRequest,
    service: Annotated[InventoryService, Depends(get_inventory_service)],
    current_user: User = Depends(get_current_active_user),
) -> ConsumableInventoryReportResponse:
    _ = current_user
    return _run_inventory_action(lambda: service.build_consumable_inventory_report(payload))


@router.post("/consumable-store/reports/export", response_model=InventoryExportFileResponse)
def export_consumable_store_report_info(
    payload: ConsumableInventoryReportRequest,
    service: Annotated[InventoryService, Depends(get_inventory_service)],
    current_user: User = Depends(get_current_active_user),
) -> InventoryExportFileResponse:
    _ = current_user
    return _run_inventory_action(
        lambda: service.export_consumable_file_info(
            payload,
            prepared_by=resolve_prepared_by_name(current_user),
        )
    )


@router.post("/consumable-store/reports/download")
def download_consumable_store_report(
    payload: ConsumableInventoryReportRequest,
    service: Annotated[InventoryService, Depends(get_inventory_service)],
    current_user: User = Depends(get_current_active_user),
):
    def action():
        generated = service.export_consumable_inventory_report(
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

    return _run_inventory_action(action)
