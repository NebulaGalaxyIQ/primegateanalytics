from __future__ import annotations

from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_active_user, require_admin
from app.models.user import User
from app.schemas.order import (
    MessageResponse,
    OrderCreate,
    OrderDeliveryUpdateSchema,
    OrderFilterSchema,
    OrderFinancialUpdateSchema,
    OrderListResponse,
    OrderResponse,
    OrderStatusUpdateSchema,
    OrderUpdate,
)
from app.services.order_service import (
    create_order,
    delete_order,
    get_order_by_id,
    list_orders,
    update_order,
    update_order_delivery,
    update_order_financial,
    update_order_status,
)

router = APIRouter(prefix="/orders", tags=["Orders"])


def _handle_service_error(error: ValueError) -> None:
    message = str(error)

    if message == "Order not found":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=message,
        )

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=message,
    )


def _build_filter_schema(
    search: Optional[str],
    order_type: Optional[str],
    order_profile: Optional[str],
    order_subtype: Optional[str],
    status_value: Optional[str],
    report_month: Optional[int],
    report_year: Optional[int],
    jurisdiction: Optional[str],
    slaughter_date_from: Optional[date],
    slaughter_date_to: Optional[date],
    delivery_date_from: Optional[date],
    delivery_date_to: Optional[date],
    container_gate_in_from: Optional[date],
    container_gate_in_to: Optional[date],
    departure_date_from: Optional[date],
    departure_date_to: Optional[date],
    page: int,
    page_size: int,
) -> OrderFilterSchema:
    return OrderFilterSchema(
        search=search,
        order_type=order_type,
        order_profile=order_profile,
        order_subtype=order_subtype,
        status=status_value,
        report_month=report_month,
        report_year=report_year,
        jurisdiction=jurisdiction,
        slaughter_date_from=slaughter_date_from,
        slaughter_date_to=slaughter_date_to,
        delivery_date_from=delivery_date_from,
        delivery_date_to=delivery_date_to,
        container_gate_in_from=container_gate_in_from,
        container_gate_in_to=container_gate_in_to,
        departure_date_from=departure_date_from,
        departure_date_to=departure_date_to,
        page=page,
        page_size=page_size,
    )


@router.post(
    "",
    response_model=OrderResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_order_endpoint(
    payload: OrderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    try:
        order = create_order(
            db=db,
            payload=payload,
            current_user=current_user,
        )
        return order
    except ValueError as error:
        _handle_service_error(error)


@router.get(
    "",
    response_model=OrderListResponse,
    status_code=status.HTTP_200_OK,
)
def list_orders_endpoint(
    search: Optional[str] = Query(default=None),
    order_type: Optional[str] = Query(default=None),
    order_profile: Optional[str] = Query(default=None),
    order_subtype: Optional[str] = Query(default=None),
    status_value: Optional[str] = Query(default=None, alias="status"),
    report_month: Optional[int] = Query(default=None, ge=1, le=12),
    report_year: Optional[int] = Query(default=None, ge=2000, le=2100),
    jurisdiction: Optional[str] = Query(default=None),
    slaughter_date_from: Optional[date] = Query(default=None),
    slaughter_date_to: Optional[date] = Query(default=None),
    delivery_date_from: Optional[date] = Query(default=None),
    delivery_date_to: Optional[date] = Query(default=None),
    container_gate_in_from: Optional[date] = Query(default=None),
    container_gate_in_to: Optional[date] = Query(default=None),
    departure_date_from: Optional[date] = Query(default=None),
    departure_date_to: Optional[date] = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    try:
        filters = _build_filter_schema(
            search=search,
            order_type=order_type,
            order_profile=order_profile,
            order_subtype=order_subtype,
            status_value=status_value,
            report_month=report_month,
            report_year=report_year,
            jurisdiction=jurisdiction,
            slaughter_date_from=slaughter_date_from,
            slaughter_date_to=slaughter_date_to,
            delivery_date_from=delivery_date_from,
            delivery_date_to=delivery_date_to,
            container_gate_in_from=container_gate_in_from,
            container_gate_in_to=container_gate_in_to,
            departure_date_from=departure_date_from,
            departure_date_to=departure_date_to,
            page=page,
            page_size=page_size,
        )
        result = list_orders(db=db, filters=filters)
        return OrderListResponse(**result)
    except ValueError as error:
        _handle_service_error(error)


@router.get(
    "/{order_id}",
    response_model=OrderResponse,
    status_code=status.HTTP_200_OK,
)
def get_order_endpoint(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    order = get_order_by_id(db, order_id)
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found",
        )
    return order


@router.patch(
    "/{order_id}",
    response_model=OrderResponse,
    status_code=status.HTTP_200_OK,
)
def update_order_endpoint(
    order_id: int,
    payload: OrderUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    try:
        order = update_order(
            db=db,
            order_id=order_id,
            payload=payload,
            updated_by=current_user,
        )
        return order
    except ValueError as error:
        _handle_service_error(error)


@router.patch(
    "/{order_id}/status",
    response_model=OrderResponse,
    status_code=status.HTTP_200_OK,
)
def update_order_status_endpoint(
    order_id: int,
    payload: OrderStatusUpdateSchema,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    try:
        order = update_order_status(
            db=db,
            order_id=order_id,
            payload=payload,
            updated_by=current_user,
        )
        return order
    except ValueError as error:
        _handle_service_error(error)


@router.patch(
    "/{order_id}/delivery",
    response_model=OrderResponse,
    status_code=status.HTTP_200_OK,
)
def update_order_delivery_endpoint(
    order_id: int,
    payload: OrderDeliveryUpdateSchema,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    try:
        order = update_order_delivery(
            db=db,
            order_id=order_id,
            payload=payload,
            updated_by=current_user,
        )
        return order
    except ValueError as error:
        _handle_service_error(error)


@router.patch(
    "/{order_id}/financial",
    response_model=OrderResponse,
    status_code=status.HTTP_200_OK,
)
def update_order_financial_endpoint(
    order_id: int,
    payload: OrderFinancialUpdateSchema,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    try:
        order = update_order_financial(
            db=db,
            order_id=order_id,
            payload=payload,
            updated_by=current_user,
        )
        return order
    except ValueError as error:
        _handle_service_error(error)


@router.delete(
    "/{order_id}",
    response_model=MessageResponse,
    status_code=status.HTTP_200_OK,
)
def delete_order_endpoint(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin()),
):
    try:
        delete_order(db=db, order_id=order_id)
        return MessageResponse(message="Order deleted successfully")
    except ValueError as error:
        _handle_service_error(error)