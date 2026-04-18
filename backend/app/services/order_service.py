from __future__ import annotations

from calendar import monthrange
from datetime import date
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from typing import Any, Dict, List, Optional

from sqlalchemy import and_, or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.order import Order
from app.models.user import User
from app.schemas.order import (
    MonthlyOrderSummaryResponse,
    MonthlyOrderSummaryRow,
    OrderCreate,
    OrderDeliveryUpdateSchema,
    OrderExportQuerySchema,
    OrderFilterSchema,
    OrderFinancialUpdateSchema,
    OrderStatusUpdateSchema,
    OrderUpdate,
)


def normalize_text(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    value = value.strip()
    return value or None


def normalize_order_type(value: Optional[str]) -> str:
    return Order.normalize_order_type(value)


def normalize_order_profile(value: Optional[str]) -> str:
    return Order.normalize_order_profile(value)


def normalize_order_status(value: Optional[str]) -> str:
    return Order.normalize_status(value)


def normalize_order_subtype(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    return Order.normalize_order_subtype(value)


def normalize_jurisdiction(value: Optional[str]) -> Optional[str]:
    return normalize_text(value)


def serialize_items(items: List[Any]) -> List[Dict[str, Any]]:
    serialized: List[Dict[str, Any]] = []

    for item in items:
        if hasattr(item, "model_dump"):
            serialized.append(item.model_dump())
        elif isinstance(item, dict):
            serialized.append(item)
        else:
            raise ValueError("Invalid order item payload")

    return serialized


def decimal_zero() -> Decimal:
    return Decimal("0.00")


def parse_decimal(value: Any, places: str = "0.01") -> Optional[Decimal]:
    if value in (None, "", "null"):
        return None

    try:
        number = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        raise ValueError("Invalid decimal value")

    return number.quantize(Decimal(places), rounding=ROUND_HALF_UP)


def build_month_date_range(month: int, year: int) -> tuple[date, date]:
    start_date = date(year, month, 1)
    end_date = date(year, month, monthrange(year, month)[1])
    return start_date, end_date


def get_order_by_id(db: Session, order_id: int) -> Optional[Order]:
    return db.query(Order).filter(Order.id == order_id).first()


def get_order_by_id_or_raise(db: Session, order_id: int) -> Order:
    order = get_order_by_id(db, order_id)
    if not order:
        raise ValueError("Order not found")
    return order


def get_order_by_number(db: Session, order_number: str) -> Optional[Order]:
    order_number = (order_number or "").strip()
    if not order_number:
        return None
    return db.query(Order).filter(Order.order_number == order_number).first()


def ensure_order_number_available(
    db: Session,
    order_number: str,
    exclude_order_id: Optional[int] = None,
) -> None:
    order_number = (order_number or "").strip()
    if not order_number:
        raise ValueError("Order number is required")

    query = db.query(Order).filter(Order.order_number == order_number)

    if exclude_order_id is not None:
        query = query.filter(Order.id != exclude_order_id)

    if query.first():
        raise ValueError("Order number already exists")


def resolve_order_anchor_date_for_number(
    payload: OrderCreate | OrderUpdate | None = None,
    order: Optional[Order] = None,
) -> Optional[date]:
    if payload is not None:
        payload_data = payload.model_dump(exclude_unset=False)
        order_profile = payload_data.get("order_profile")
        if order_profile == Order.ORDER_PROFILE_FROZEN_CONTAINER:
            return (
                payload_data.get("container_gate_in")
                or payload_data.get("departure_date")
                or payload_data.get("slaughter_schedule")
                or payload_data.get("expected_delivery")
            )
        return (
            payload_data.get("slaughter_schedule")
            or payload_data.get("expected_delivery")
            or payload_data.get("container_gate_in")
            or payload_data.get("departure_date")
        )

    if order is not None:
        return Order.get_reporting_anchor_date(order)

    return None


def generate_order_number(db: Session, order_date: Optional[date] = None) -> str:
    order_date = order_date or date.today()
    prefix = f"ORD-{order_date.strftime('%Y%m%d')}-"

    last_order = (
        db.query(Order)
        .filter(Order.order_number.like(f"{prefix}%"))
        .order_by(Order.id.desc())
        .first()
    )

    next_sequence = 1

    if last_order and last_order.order_number:
        try:
            next_sequence = int(last_order.order_number.split("-")[-1]) + 1
        except (ValueError, IndexError):
            next_sequence = 1

    candidate = f"{prefix}{next_sequence:04d}"

    while get_order_by_number(db, candidate):
        next_sequence += 1
        candidate = f"{prefix}{next_sequence:04d}"

    return candidate


def apply_create_payload_to_order(
    order: Order,
    payload: OrderCreate,
    current_user: Optional[User] = None,
) -> Order:
    items = serialize_items(payload.items_json)

    order.order_number = normalize_text(payload.order_number) or order.order_number or ""
    order.enterprise_name = payload.enterprise_name.strip()

    order.order_type = normalize_order_type(payload.order_type)
    order.order_profile = normalize_order_profile(payload.order_profile)
    order.order_subtype = normalize_order_subtype(payload.order_subtype)

    order.status = normalize_order_status(payload.status)

    order.report_month = payload.report_month
    order.report_year = payload.report_year

    order.order_ratio = normalize_text(payload.order_ratio)

    order.shipment_value_usd = payload.shipment_value_usd
    order.price_per_kg_usd = payload.price_per_kg_usd
    order.amount_paid_usd = payload.amount_paid_usd
    order.balance_usd = payload.balance_usd

    order.container_gate_in = payload.container_gate_in
    order.departure_date = payload.departure_date
    order.jurisdiction = normalize_jurisdiction(payload.jurisdiction)

    order.items_json = items

    order.slaughter_schedule = payload.slaughter_schedule
    order.delivery_days_offset = payload.delivery_days_offset
    order.notes = normalize_text(payload.notes)

    if payload.expected_delivery is not None:
        order.expected_delivery = payload.expected_delivery
        order.is_delivery_date_manual = True
    else:
        order.is_delivery_date_manual = bool(payload.is_delivery_date_manual)

    if current_user:
        order.created_by_id = current_user.id
        order.updated_by_id = current_user.id

    return order


def apply_update_payload_to_order(
    order: Order,
    payload: OrderUpdate,
    updated_by: Optional[User] = None,
) -> Order:
    data = payload.model_dump(exclude_unset=True)

    if "order_number" in data and data["order_number"] is not None:
        order.order_number = normalize_text(data["order_number"]) or order.order_number

    if "enterprise_name" in data and data["enterprise_name"] is not None:
        order.enterprise_name = data["enterprise_name"].strip()

    if "order_type" in data and data["order_type"] is not None:
        order.order_type = normalize_order_type(data["order_type"])

    if "order_profile" in data and data["order_profile"] is not None:
        order.order_profile = normalize_order_profile(data["order_profile"])

    if "order_subtype" in data:
        order.order_subtype = normalize_order_subtype(data["order_subtype"])

    if "status" in data and data["status"] is not None:
        order.status = normalize_order_status(data["status"])

    if "report_month" in data:
        order.report_month = data["report_month"]

    if "report_year" in data:
        order.report_year = data["report_year"]

    if "order_ratio" in data:
        order.order_ratio = normalize_text(data["order_ratio"])

    if "shipment_value_usd" in data:
        order.shipment_value_usd = data["shipment_value_usd"]

    if "price_per_kg_usd" in data:
        order.price_per_kg_usd = data["price_per_kg_usd"]

    if "amount_paid_usd" in data:
        order.amount_paid_usd = data["amount_paid_usd"]

    if "balance_usd" in data:
        order.balance_usd = data["balance_usd"]

    if "container_gate_in" in data:
        order.container_gate_in = data["container_gate_in"]

    if "departure_date" in data:
        order.departure_date = data["departure_date"]

    if "jurisdiction" in data:
        order.jurisdiction = normalize_jurisdiction(data["jurisdiction"])

    if "items_json" in data and data["items_json"] is not None:
        order.items_json = serialize_items(data["items_json"])

    if "slaughter_schedule" in data:
        order.slaughter_schedule = data["slaughter_schedule"]

    if "delivery_days_offset" in data:
        order.delivery_days_offset = data["delivery_days_offset"]

    if "notes" in data:
        order.notes = normalize_text(data["notes"])

    expected_delivery_provided = "expected_delivery" in data and data["expected_delivery"] is not None
    manual_flag_provided = "is_delivery_date_manual" in data

    if expected_delivery_provided:
        order.expected_delivery = data["expected_delivery"]
        order.is_delivery_date_manual = True
    elif manual_flag_provided:
        order.is_delivery_date_manual = bool(data["is_delivery_date_manual"])
        if order.is_delivery_date_manual is False:
            order.expected_delivery = None

    if updated_by:
        order.updated_by_id = updated_by.id

    return order


def create_order(
    db: Session,
    payload: OrderCreate,
    current_user: Optional[User] = None,
) -> Order:
    order = Order()

    apply_create_payload_to_order(order, payload, current_user=current_user)

    if not order.order_number:
        anchor_date = resolve_order_anchor_date_for_number(payload=payload)
        order.order_number = generate_order_number(db, anchor_date)

    ensure_order_number_available(db, order.order_number)

    try:
        db.add(order)
        db.commit()
        db.refresh(order)
        return order
    except IntegrityError:
        db.rollback()
        raise ValueError("Failed to create order because the order number already exists")


def update_order(
    db: Session,
    order_id: int,
    payload: OrderUpdate,
    updated_by: Optional[User] = None,
) -> Order:
    order = get_order_by_id_or_raise(db, order_id)

    old_order_number = order.order_number

    apply_update_payload_to_order(order, payload, updated_by=updated_by)

    if not normalize_text(order.order_number):
        anchor_date = resolve_order_anchor_date_for_number(order=order)
        order.order_number = old_order_number or generate_order_number(db, anchor_date)

    ensure_order_number_available(db, order.order_number, exclude_order_id=order.id)

    try:
        db.add(order)
        db.commit()
        db.refresh(order)
        return order
    except IntegrityError:
        db.rollback()
        raise ValueError("Failed to update order because the order number already exists")


def update_order_status(
    db: Session,
    order_id: int,
    payload: OrderStatusUpdateSchema,
    updated_by: Optional[User] = None,
) -> Order:
    order = get_order_by_id_or_raise(db, order_id)
    order.status = normalize_order_status(payload.status)

    if updated_by:
        order.updated_by_id = updated_by.id

    db.add(order)
    db.commit()
    db.refresh(order)
    return order


def update_order_delivery(
    db: Session,
    order_id: int,
    payload: OrderDeliveryUpdateSchema,
    updated_by: Optional[User] = None,
) -> Order:
    order = get_order_by_id_or_raise(db, order_id)

    if payload.slaughter_schedule is not None:
        order.slaughter_schedule = payload.slaughter_schedule

    order.delivery_days_offset = payload.delivery_days_offset

    if payload.expected_delivery is not None:
        order.expected_delivery = payload.expected_delivery
        order.is_delivery_date_manual = True
    else:
        order.is_delivery_date_manual = bool(payload.is_delivery_date_manual)
        if order.is_delivery_date_manual is False:
            order.expected_delivery = None

    if updated_by:
        order.updated_by_id = updated_by.id

    db.add(order)
    db.commit()
    db.refresh(order)
    return order


def update_order_financial(
    db: Session,
    order_id: int,
    payload: OrderFinancialUpdateSchema,
    updated_by: Optional[User] = None,
) -> Order:
    order = get_order_by_id_or_raise(db, order_id)

    data = payload.model_dump(exclude_unset=True)

    if "shipment_value_usd" in data:
        order.shipment_value_usd = data["shipment_value_usd"]

    if "price_per_kg_usd" in data:
        order.price_per_kg_usd = data["price_per_kg_usd"]

    if "amount_paid_usd" in data:
        order.amount_paid_usd = data["amount_paid_usd"]

    if "balance_usd" in data:
        order.balance_usd = data["balance_usd"]

    if updated_by:
        order.updated_by_id = updated_by.id

    db.add(order)
    db.commit()
    db.refresh(order)
    return order


def delete_order(db: Session, order_id: int) -> None:
    order = get_order_by_id_or_raise(db, order_id)
    db.delete(order)
    db.commit()


def build_order_query(db: Session, filters: Optional[OrderFilterSchema] = None):
    query = db.query(Order)

    if not filters:
        return query

    if filters.search:
        term = f"%{filters.search.strip()}%"
        query = query.filter(
            or_(
                Order.order_number.ilike(term),
                Order.enterprise_name.ilike(term),
                Order.product_summary.ilike(term),
                Order.notes.ilike(term),
                Order.order_type.ilike(term),
                Order.order_profile.ilike(term),
                Order.order_subtype.ilike(term),
                Order.status.ilike(term),
                Order.jurisdiction.ilike(term),
                Order.order_ratio.ilike(term),
            )
        )

    if filters.order_type:
        query = query.filter(Order.order_type == normalize_order_type(filters.order_type))

    if filters.order_profile:
        query = query.filter(Order.order_profile == normalize_order_profile(filters.order_profile))

    if filters.order_subtype:
        query = query.filter(Order.order_subtype == normalize_order_subtype(filters.order_subtype))

    if filters.status:
        query = query.filter(Order.status == normalize_order_status(filters.status))

    if filters.report_month is not None and filters.report_year is not None:
        query = query.filter(
            and_(
                Order.report_month == filters.report_month,
                Order.report_year == filters.report_year,
            )
        )

    if filters.jurisdiction:
        query = query.filter(Order.jurisdiction.ilike(f"%{filters.jurisdiction}%"))

    if filters.slaughter_date_from:
        query = query.filter(Order.slaughter_schedule >= filters.slaughter_date_from)

    if filters.slaughter_date_to:
        query = query.filter(Order.slaughter_schedule <= filters.slaughter_date_to)

    if filters.delivery_date_from:
        query = query.filter(Order.expected_delivery >= filters.delivery_date_from)

    if filters.delivery_date_to:
        query = query.filter(Order.expected_delivery <= filters.delivery_date_to)

    if filters.container_gate_in_from:
        query = query.filter(Order.container_gate_in >= filters.container_gate_in_from)

    if filters.container_gate_in_to:
        query = query.filter(Order.container_gate_in <= filters.container_gate_in_to)

    if filters.departure_date_from:
        query = query.filter(Order.departure_date >= filters.departure_date_from)

    if filters.departure_date_to:
        query = query.filter(Order.departure_date <= filters.departure_date_to)

    return query


def list_orders(
    db: Session,
    filters: Optional[OrderFilterSchema] = None,
) -> dict:
    page = filters.page if filters else 1
    page_size = filters.page_size if filters else 10

    query = build_order_query(db, filters)

    total = query.count()

    items = (
        query.order_by(Order.created_at.desc(), Order.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
    }


def list_orders_for_month(
    db: Session,
    month: int,
    year: int,
    order_type: Optional[str] = None,
    order_profile: Optional[str] = None,
    status: Optional[str] = None,
    jurisdiction: Optional[str] = None,
) -> List[Order]:
    start_date, end_date = build_month_date_range(month, year)

    query = db.query(Order).filter(
        or_(
            and_(
                Order.report_month == month,
                Order.report_year == year,
            ),
            and_(
                Order.report_month.is_(None),
                Order.report_year.is_(None),
                or_(
                    and_(
                        Order.slaughter_schedule.isnot(None),
                        Order.slaughter_schedule >= start_date,
                        Order.slaughter_schedule <= end_date,
                    ),
                    and_(
                        Order.expected_delivery.isnot(None),
                        Order.expected_delivery >= start_date,
                        Order.expected_delivery <= end_date,
                    ),
                    and_(
                        Order.container_gate_in.isnot(None),
                        Order.container_gate_in >= start_date,
                        Order.container_gate_in <= end_date,
                    ),
                    and_(
                        Order.departure_date.isnot(None),
                        Order.departure_date >= start_date,
                        Order.departure_date <= end_date,
                    ),
                ),
            ),
        )
    )

    if order_type:
        query = query.filter(Order.order_type == normalize_order_type(order_type))

    if order_profile:
        query = query.filter(Order.order_profile == normalize_order_profile(order_profile))

    if status:
        query = query.filter(Order.status == normalize_order_status(status))

    if jurisdiction:
        query = query.filter(Order.jurisdiction.ilike(f"%{jurisdiction}%"))

    return query.order_by(
        Order.report_year.asc().nullslast(),
        Order.report_month.asc().nullslast(),
        Order.slaughter_schedule.asc().nullslast(),
        Order.container_gate_in.asc().nullslast(),
        Order.departure_date.asc().nullslast(),
        Order.id.asc(),
    ).all()


def get_orders_for_export(
    db: Session,
    query_data: OrderExportQuerySchema,
) -> List[Order]:
    return list_orders_for_month(
        db=db,
        month=query_data.month,
        year=query_data.year,
        order_type=query_data.order_type,
        order_profile=query_data.order_profile,
        status=query_data.status,
        jurisdiction=query_data.jurisdiction,
    )


def summarize_orders_by_type(orders: List[Order], order_type: str) -> MonthlyOrderSummaryRow:
    matching = [order for order in orders if order.order_type == order_type]

    total_orders = len(matching)
    total_quantity_kg = sum(
        (Decimal(str(order.total_quantity_kg or 0)) for order in matching),
        start=decimal_zero(),
    )
    total_pieces_required = sum(int(order.total_pieces_required or 0) for order in matching)
    total_animals_required = sum(int(order.total_animals_required or 0) for order in matching)

    return MonthlyOrderSummaryRow(
        order_type=order_type,
        total_orders=total_orders,
        total_quantity_kg=total_quantity_kg,
        total_pieces_required=total_pieces_required,
        total_animals_required=total_animals_required,
    )


def compute_breakeven_metrics(
    total_quantity_kg: Decimal,
    breakeven_quantity_kg: Optional[Decimal] = None,
) -> dict:
    if breakeven_quantity_kg is None:
        return {
            "breakeven_quantity_kg": None,
            "breakeven_achieved_quantity_kg": None,
            "breakeven_balance_quantity_kg": None,
            "breakeven_achieved_percentage": None,
            "breakeven_balance_percentage": None,
        }

    breakeven_target = Decimal(str(breakeven_quantity_kg)).quantize(
        Decimal("0.01"),
        rounding=ROUND_HALF_UP,
    )

    if breakeven_target <= 0:
        return {
            "breakeven_quantity_kg": breakeven_target,
            "breakeven_achieved_quantity_kg": Decimal("0.00"),
            "breakeven_balance_quantity_kg": Decimal("0.00"),
            "breakeven_achieved_percentage": Decimal("0.00"),
            "breakeven_balance_percentage": Decimal("0.00"),
        }

    achieved_quantity = min(total_quantity_kg, breakeven_target).quantize(
        Decimal("0.01"),
        rounding=ROUND_HALF_UP,
    )
    balance_quantity = max(breakeven_target - total_quantity_kg, Decimal("0.00")).quantize(
        Decimal("0.01"),
        rounding=ROUND_HALF_UP,
    )

    achieved_percentage = ((achieved_quantity / breakeven_target) * Decimal("100")).quantize(
        Decimal("0.01"),
        rounding=ROUND_HALF_UP,
    )
    balance_percentage = ((balance_quantity / breakeven_target) * Decimal("100")).quantize(
        Decimal("0.01"),
        rounding=ROUND_HALF_UP,
    )

    return {
        "breakeven_quantity_kg": breakeven_target,
        "breakeven_achieved_quantity_kg": achieved_quantity,
        "breakeven_balance_quantity_kg": balance_quantity,
        "breakeven_achieved_percentage": achieved_percentage,
        "breakeven_balance_percentage": balance_percentage,
    }


def get_monthly_order_summary(
    db: Session,
    month: int,
    year: int,
    breakeven_quantity_kg: Optional[Decimal] = None,
) -> MonthlyOrderSummaryResponse:
    orders = list_orders_for_month(
        db=db,
        month=month,
        year=year,
        order_type=None,
        order_profile=None,
        status=None,
        jurisdiction=None,
    )

    total_orders = len(orders)
    total_quantity_kg = sum(
        (Decimal(str(order.total_quantity_kg or 0)) for order in orders),
        start=decimal_zero(),
    )
    total_pieces_required = sum(int(order.total_pieces_required or 0) for order in orders)
    total_animals_required = sum(int(order.total_animals_required or 0) for order in orders)

    local_summary = summarize_orders_by_type(orders, Order.ORDER_TYPE_LOCAL)
    chilled_summary = summarize_orders_by_type(orders, Order.ORDER_TYPE_CHILLED)
    frozen_summary = summarize_orders_by_type(orders, Order.ORDER_TYPE_FROZEN)

    breakeven_metrics = compute_breakeven_metrics(
        total_quantity_kg=total_quantity_kg,
        breakeven_quantity_kg=breakeven_quantity_kg,
    )

    return MonthlyOrderSummaryResponse(
        month=month,
        year=year,
        total_orders=total_orders,
        total_quantity_kg=total_quantity_kg,
        total_pieces_required=total_pieces_required,
        total_animals_required=total_animals_required,
        breakeven_quantity_kg=breakeven_metrics["breakeven_quantity_kg"],
        breakeven_achieved_quantity_kg=breakeven_metrics["breakeven_achieved_quantity_kg"],
        breakeven_balance_quantity_kg=breakeven_metrics["breakeven_balance_quantity_kg"],
        breakeven_achieved_percentage=breakeven_metrics["breakeven_achieved_percentage"],
        breakeven_balance_percentage=breakeven_metrics["breakeven_balance_percentage"],
        local_orders=local_summary,
        chilled_orders=chilled_summary,
        frozen_orders=frozen_summary,
    )