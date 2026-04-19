from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import Iterable
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, selectinload

from app.models.byproducts import (
    ByproductCategory,
    ByproductCustomer,
    ByproductItem,
    ByproductPaymentMode,
    ByproductSale,
    ByproductSaleLine,
    ByproductSaleStatus,
)
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
    ByproductItemCreate,
    ByproductItemFilter,
    ByproductItemListResponse,
    ByproductItemRead,
    ByproductItemUpdate,
    ByproductSaleCreate,
    ByproductSaleFilter,
    ByproductSaleLineUpdate,
    ByproductSaleListResponse,
    ByproductSaleRead,
    ByproductSaleSummaryRead,
    ByproductSaleUpdate,
    MessageResponse,
)

MONEY_PLACES = Decimal("0.01")
QTY_PLACES = Decimal("0.001")


# =============================================================================
# GENERIC HELPERS
# =============================================================================


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _normalize_text(value: str | None) -> str | None:
    if value is None:
        return None
    value = value.strip()
    return value or None


def _to_decimal(value: Decimal | int | float | str | None) -> Decimal:
    if value is None:
        return Decimal("0")
    if isinstance(value, Decimal):
        return value
    return Decimal(str(value))


def _money(value: Decimal | int | float | str | None) -> Decimal:
    return _to_decimal(value).quantize(MONEY_PLACES, rounding=ROUND_HALF_UP)


def _qty(value: Decimal | int | float | str | None) -> Decimal:
    return _to_decimal(value).quantize(QTY_PLACES, rounding=ROUND_HALF_UP)


def _is_whole_quantity(value: Decimal) -> bool:
    return value == value.to_integral_value()


def _http_404(detail: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=detail)


def _http_409(detail: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=detail)


def _http_400(detail: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)


def _apply_create_audit(obj, actor_id: UUID | None) -> None:
    obj.created_by_id = actor_id
    obj.updated_by_id = actor_id


def _apply_update_audit(obj, actor_id: UUID | None) -> None:
    obj.updated_by_id = actor_id


def _apply_soft_delete(obj, actor_id: UUID | None) -> None:
    obj.is_active = False
    obj.is_deleted = True
    obj.deleted_at = _utcnow()
    obj.deleted_by_id = actor_id
    obj.updated_by_id = actor_id


def _apply_restore(obj, actor_id: UUID | None) -> None:
    obj.is_deleted = False
    obj.deleted_at = None
    obj.deleted_by_id = None
    obj.updated_by_id = actor_id


def _ensure_not_deleted(obj, label: str = "Record") -> None:
    if not obj or getattr(obj, "is_deleted", False):
        raise _http_404(f"{label} not found")


def _serialize_category(obj: ByproductCategory) -> ByproductCategoryRead:
    return ByproductCategoryRead.model_validate(obj)


def _serialize_item(obj: ByproductItem) -> ByproductItemRead:
    return ByproductItemRead.model_validate(obj)


def _serialize_customer(obj: ByproductCustomer) -> ByproductCustomerRead:
    return ByproductCustomerRead.model_validate(obj)


def _serialize_sale(obj: ByproductSale) -> ByproductSaleRead:
    return ByproductSaleRead.model_validate(obj)


def _serialize_sale_summary(obj: ByproductSale) -> ByproductSaleSummaryRead:
    return ByproductSaleSummaryRead.model_validate(obj)


# =============================================================================
# LOOKUP HELPERS
# =============================================================================


def _get_category_or_404(db: Session, category_id: UUID) -> ByproductCategory:
    obj = (
        db.query(ByproductCategory)
        .filter(ByproductCategory.id == category_id)
        .first()
    )
    _ensure_not_deleted(obj, "Byproduct category")
    return obj


def _get_item_or_404(db: Session, item_id: UUID) -> ByproductItem:
    obj = (
        db.query(ByproductItem)
        .filter(ByproductItem.id == item_id)
        .first()
    )
    _ensure_not_deleted(obj, "Byproduct item")
    return obj


def _get_customer_or_404(db: Session, customer_id: UUID) -> ByproductCustomer:
    obj = (
        db.query(ByproductCustomer)
        .filter(ByproductCustomer.id == customer_id)
        .first()
    )
    _ensure_not_deleted(obj, "Byproduct customer")
    return obj


def _get_sale_or_404(
    db: Session,
    sale_id: UUID,
    *,
    with_lines: bool = True,
) -> ByproductSale:
    query = db.query(ByproductSale)
    if with_lines:
        query = query.options(selectinload(ByproductSale.lines))
    obj = query.filter(ByproductSale.id == sale_id).first()
    _ensure_not_deleted(obj, "Byproduct sale")
    return obj


def _get_sale_line_or_404(db: Session, line_id: UUID) -> ByproductSaleLine:
    obj = (
        db.query(ByproductSaleLine)
        .filter(ByproductSaleLine.id == line_id)
        .first()
    )
    _ensure_not_deleted(obj, "Byproduct sale line")
    return obj


# =============================================================================
# UNIQUENESS HELPERS
# =============================================================================


def _ensure_category_code_available(
    db: Session,
    code: str,
    *,
    exclude_id: UUID | None = None,
) -> None:
    q = db.query(ByproductCategory).filter(ByproductCategory.code == code)
    if exclude_id:
        q = q.filter(ByproductCategory.id != exclude_id)
    if q.first():
        raise _http_409("A byproduct category with this code already exists")


def _ensure_item_code_available(
    db: Session,
    code: str,
    *,
    exclude_id: UUID | None = None,
) -> None:
    q = db.query(ByproductItem).filter(ByproductItem.code == code)
    if exclude_id:
        q = q.filter(ByproductItem.id != exclude_id)
    if q.first():
        raise _http_409("A byproduct item with this code already exists")


def _ensure_customer_code_available(
    db: Session,
    code: str,
    *,
    exclude_id: UUID | None = None,
) -> None:
    q = db.query(ByproductCustomer).filter(ByproductCustomer.customer_code == code)
    if exclude_id:
        q = q.filter(ByproductCustomer.id != exclude_id)
    if q.first():
        raise _http_409("A byproduct customer with this code already exists")


def _ensure_sale_number_available(
    db: Session,
    sale_number: str,
    *,
    exclude_id: UUID | None = None,
) -> None:
    q = db.query(ByproductSale).filter(ByproductSale.sale_number == sale_number)
    if exclude_id:
        q = q.filter(ByproductSale.id != exclude_id)
    if q.first():
        raise _http_409("A byproduct sale with this sale number already exists")


# =============================================================================
# SALE CALCULATION HELPERS
# =============================================================================


def _generate_sale_number(db: Session, sale_date) -> str:
    date_key = sale_date.strftime("%Y%m%d")
    prefix = f"BYP-{date_key}-"

    last_value = (
        db.query(func.max(ByproductSale.sale_number))
        .filter(ByproductSale.sale_number.like(f"{prefix}%"))
        .scalar()
    )

    if not last_value:
        return f"{prefix}0001"

    try:
        last_seq = int(last_value.split("-")[-1])
    except Exception:
        last_seq = 0

    return f"{prefix}{last_seq + 1:04d}"


def _validate_item_quantity_rule(item: ByproductItem | None, quantity: Decimal) -> None:
    if item and not item.allow_fractional_quantity and not _is_whole_quantity(quantity):
        raise _http_400(
            f"Quantity for '{item.name}' must be a whole number because fractional quantity is not allowed"
        )


def _validate_item_price_rule(item: ByproductItem | None, unit_price: Decimal) -> None:
    if not item:
        return

    if item.minimum_unit_price is not None and unit_price < _money(item.minimum_unit_price):
        raise _http_400(
            f"Unit price for '{item.name}' cannot be lower than the minimum allowed price"
        )

    if item.maximum_unit_price is not None and unit_price > _money(item.maximum_unit_price):
        raise _http_400(
            f"Unit price for '{item.name}' cannot be greater than the maximum allowed price"
        )


def _resolve_customer_snapshot(
    db: Session,
    *,
    customer_id: UUID | None,
    customer_name: str | None,
    transaction_name: str | None,
) -> tuple[UUID | None, str, str | None, str | None, str | None]:
    customer = None

    if customer_id:
        customer = _get_customer_or_404(db, customer_id)
        if not customer.is_active:
            raise _http_400("Selected byproduct customer is inactive")

    if customer:
        snapshot_customer_name = customer.customer_name
        snapshot_transaction_name = (
            _normalize_text(transaction_name)
            or customer.transaction_name
            or customer.contact_person
        )
        snapshot_phone = customer.phone_number
        snapshot_location = customer.business_location
        return (
            customer.id,
            snapshot_customer_name,
            snapshot_transaction_name,
            snapshot_phone,
            snapshot_location,
        )

    normalized_customer_name = _normalize_text(customer_name)
    if not normalized_customer_name:
        raise _http_400("Either customer_id or customer_name must be provided")

    return (
        None,
        normalized_customer_name,
        _normalize_text(transaction_name),
        None,
        None,
    )


def _build_sale_line_from_values(
    *,
    sale_id: UUID | None,
    line_number: int,
    byproduct: ByproductItem | None,
    byproduct_id: UUID | None,
    byproduct_name: str | None,
    quantity: Decimal,
    unit_price: Decimal,
    remarks: str | None,
    extra_meta: dict | None,
    actor_id: int | None,
) -> ByproductSaleLine:
    quantity = _qty(quantity)
    unit_price = _money(unit_price)

    _validate_item_quantity_rule(byproduct, quantity)
    _validate_item_price_rule(byproduct, unit_price)

    normalized_byproduct_name = _normalize_text(byproduct_name)
    if not byproduct and not normalized_byproduct_name:
        raise _http_400("Each sale line must have either byproduct_id or byproduct_name")

    line = ByproductSaleLine(
        sale_id=sale_id,
        byproduct_id=byproduct_id if byproduct else None,
        line_number=line_number,
        byproduct_code_snapshot=byproduct.code if byproduct else None,
        byproduct_name_snapshot=byproduct.name if byproduct else normalized_byproduct_name,
        byproduct_category_snapshot=byproduct.category.name if byproduct and byproduct.category else None,
        unit_of_measure_snapshot=byproduct.unit_of_measure.value if byproduct else None,
        quantity=quantity,
        unit_price=unit_price,
        line_total=_money(quantity * unit_price),
        remarks=_normalize_text(remarks),
        extra_meta=extra_meta,
        is_active=True,
        is_deleted=False,
        deleted_at=None,
        deleted_by_id=None,
    )
    _apply_create_audit(line, actor_id)
    return line

def _resolve_item_for_line(db: Session, byproduct_id: UUID | None) -> ByproductItem | None:
    if not byproduct_id:
        return None

    item = (
        db.query(ByproductItem)
        .options(selectinload(ByproductItem.category))
        .filter(ByproductItem.id == byproduct_id)
        .first()
    )
    _ensure_not_deleted(item, "Byproduct item")

    if not item.is_active:
        raise _http_400("Selected byproduct item is inactive")

    return item


def _recalculate_sale_totals(sale: ByproductSale) -> None:
    active_lines = [
        line
        for line in sale.lines
        if not line.is_deleted and line.is_active
    ]

    subtotal = _money(sum((_money(line.line_total) for line in active_lines), Decimal("0.00")))
    discount = _money(sale.discount_amount)
    adjustment = _money(sale.adjustment_amount)
    amount_paid = _money(sale.amount_paid)

    total = _money(subtotal - discount + adjustment)
    if total < Decimal("0.00"):
        raise _http_400("Sale total cannot be negative after applying discount and adjustment")

    balance_due = _money(total - amount_paid)
    if balance_due < Decimal("0.00"):
        raise _http_400("Amount paid cannot be greater than total amount")

    sale.subtotal_amount = subtotal
    sale.discount_amount = discount
    sale.adjustment_amount = adjustment
    sale.total_amount = total
    sale.amount_paid = amount_paid
    sale.balance_due = balance_due


def _refresh_sale_lines_order(sale: ByproductSale) -> None:
    active_lines = [
        line for line in sale.lines if not line.is_deleted and line.is_active
    ]
    active_lines.sort(key=lambda x: (x.line_number, x.created_at or _utcnow()))
    for index, line in enumerate(active_lines, start=1):
        line.line_number = index


# =============================================================================
# CATEGORY SERVICES
# =============================================================================


def create_category(
    db: Session,
    payload: ByproductCategoryCreate,
    *,
    actor_id: UUID | None = None,
) -> ByproductCategoryRead:
    _ensure_category_code_available(db, payload.code)

    obj = ByproductCategory(
        code=payload.code,
        name=payload.name,
        description=payload.description,
        sort_order=payload.sort_order,
        is_active=payload.is_active,
        is_deleted=False,
    )
    _apply_create_audit(obj, actor_id)

    db.add(obj)
    db.commit()
    db.refresh(obj)
    return _serialize_category(obj)


def get_category(db: Session, category_id: UUID) -> ByproductCategoryRead:
    obj = _get_category_or_404(db, category_id)
    return _serialize_category(obj)


def list_categories(
    db: Session,
    filters: ByproductCategoryFilter | None = None,
    *,
    skip: int = 0,
    limit: int = 100,
) -> ByproductCategoryListResponse:
    filters = filters or ByproductCategoryFilter()

    q = db.query(ByproductCategory)

    if not filters.include_deleted:
        q = q.filter(ByproductCategory.is_deleted.is_(False))

    if filters.is_active is not None:
        q = q.filter(ByproductCategory.is_active.is_(filters.is_active))

    if filters.search:
        term = f"%{filters.search}%"
        q = q.filter(
            or_(
                ByproductCategory.code.ilike(term),
                ByproductCategory.name.ilike(term),
                ByproductCategory.description.ilike(term),
            )
        )

    total = q.count()
    items = (
        q.order_by(ByproductCategory.sort_order.asc(), ByproductCategory.name.asc())
        .offset(skip)
        .limit(limit)
        .all()
    )

    return ByproductCategoryListResponse(
        items=[_serialize_category(item) for item in items],
        total=total,
    )


def update_category(
    db: Session,
    category_id: UUID,
    payload: ByproductCategoryUpdate,
    *,
    actor_id: UUID | None = None,
) -> ByproductCategoryRead:
    obj = _get_category_or_404(db, category_id)

    if payload.code is not None and payload.code != obj.code:
        _ensure_category_code_available(db, payload.code, exclude_id=obj.id)
        obj.code = payload.code

    if payload.name is not None:
        obj.name = payload.name

    if payload.description is not None:
        obj.description = payload.description

    if payload.sort_order is not None:
        obj.sort_order = payload.sort_order

    if payload.is_active is not None:
        obj.is_active = payload.is_active

    _apply_update_audit(obj, actor_id)

    db.commit()
    db.refresh(obj)
    return _serialize_category(obj)


def delete_category(
    db: Session,
    category_id: UUID,
    *,
    actor_id: UUID | None = None,
) -> MessageResponse:
    obj = _get_category_or_404(db, category_id)

    active_items_count = (
        db.query(ByproductItem)
        .filter(
            ByproductItem.category_id == obj.id,
            ByproductItem.is_deleted.is_(False),
        )
        .count()
    )
    if active_items_count > 0:
        raise _http_409(
            "This category cannot be deleted because it still has byproduct items attached to it"
        )

    _apply_soft_delete(obj, actor_id)
    db.commit()

    return MessageResponse(message="Byproduct category deleted successfully")


def restore_category(
    db: Session,
    category_id: UUID,
    *,
    actor_id: UUID | None = None,
) -> ByproductCategoryRead:
    obj = (
        db.query(ByproductCategory)
        .filter(ByproductCategory.id == category_id)
        .first()
    )
    if not obj:
        raise _http_404("Byproduct category not found")

    _apply_restore(obj, actor_id)
    obj.is_active = True

    db.commit()
    db.refresh(obj)
    return _serialize_category(obj)


# =============================================================================
# ITEM SERVICES
# =============================================================================


def create_item(
    db: Session,
    payload: ByproductItemCreate,
    *,
    actor_id: UUID | None = None,
) -> ByproductItemRead:
    _ensure_item_code_available(db, payload.code)

    if payload.category_id:
        category = _get_category_or_404(db, payload.category_id)
        if not category.is_active:
            raise _http_400("Selected byproduct category is inactive")

    obj = ByproductItem(
        category_id=payload.category_id,
        code=payload.code,
        name=payload.name,
        short_name=payload.short_name,
        description=payload.description,
        unit_of_measure=payload.unit_of_measure,
        allow_fractional_quantity=payload.allow_fractional_quantity,
        default_unit_price=_money(payload.default_unit_price),
        minimum_unit_price=_money(payload.minimum_unit_price) if payload.minimum_unit_price is not None else None,
        maximum_unit_price=_money(payload.maximum_unit_price) if payload.maximum_unit_price is not None else None,
        report_label=payload.report_label,
        notes=payload.notes,
        is_active=payload.is_active,
        is_deleted=False,
    )
    _apply_create_audit(obj, actor_id)

    db.add(obj)
    db.commit()
    db.refresh(obj)
    return _serialize_item(obj)


def get_item(db: Session, item_id: UUID) -> ByproductItemRead:
    obj = _get_item_or_404(db, item_id)
    return _serialize_item(obj)


def list_items(
    db: Session,
    filters: ByproductItemFilter | None = None,
    *,
    skip: int = 0,
    limit: int = 100,
) -> ByproductItemListResponse:
    filters = filters or ByproductItemFilter()

    q = db.query(ByproductItem)

    if not filters.include_deleted:
        q = q.filter(ByproductItem.is_deleted.is_(False))

    if filters.is_active is not None:
        q = q.filter(ByproductItem.is_active.is_(filters.is_active))

    if filters.category_id:
        q = q.filter(ByproductItem.category_id == filters.category_id)

    if filters.unit_of_measure:
        q = q.filter(ByproductItem.unit_of_measure == filters.unit_of_measure)

    if filters.search:
        term = f"%{filters.search}%"
        q = q.filter(
            or_(
                ByproductItem.code.ilike(term),
                ByproductItem.name.ilike(term),
                ByproductItem.short_name.ilike(term),
                ByproductItem.report_label.ilike(term),
                ByproductItem.description.ilike(term),
            )
        )

    total = q.count()
    items = (
        q.order_by(ByproductItem.name.asc())
        .offset(skip)
        .limit(limit)
        .all()
    )

    return ByproductItemListResponse(
        items=[_serialize_item(item) for item in items],
        total=total,
    )


def update_item(
    db: Session,
    item_id: UUID,
    payload: ByproductItemUpdate,
    *,
    actor_id: UUID | None = None,
) -> ByproductItemRead:
    obj = _get_item_or_404(db, item_id)

    if payload.code is not None and payload.code != obj.code:
        _ensure_item_code_available(db, payload.code, exclude_id=obj.id)
        obj.code = payload.code

    if payload.category_id is not None:
        if payload.category_id:
            category = _get_category_or_404(db, payload.category_id)
            if not category.is_active:
                raise _http_400("Selected byproduct category is inactive")
        obj.category_id = payload.category_id

    if payload.name is not None:
        obj.name = payload.name

    if payload.short_name is not None:
        obj.short_name = payload.short_name

    if payload.description is not None:
        obj.description = payload.description

    if payload.unit_of_measure is not None:
        obj.unit_of_measure = payload.unit_of_measure

    if payload.allow_fractional_quantity is not None:
        obj.allow_fractional_quantity = payload.allow_fractional_quantity

    if payload.default_unit_price is not None:
        obj.default_unit_price = _money(payload.default_unit_price)

    if payload.minimum_unit_price is not None:
        obj.minimum_unit_price = _money(payload.minimum_unit_price)

    if payload.maximum_unit_price is not None:
        obj.maximum_unit_price = _money(payload.maximum_unit_price)

    if payload.report_label is not None:
        obj.report_label = payload.report_label

    if payload.notes is not None:
        obj.notes = payload.notes

    if payload.is_active is not None:
        obj.is_active = payload.is_active

    _apply_update_audit(obj, actor_id)

    db.commit()
    db.refresh(obj)
    return _serialize_item(obj)


def delete_item(
    db: Session,
    item_id: UUID,
    *,
    actor_id: UUID | None = None,
) -> MessageResponse:
    obj = _get_item_or_404(db, item_id)
    _apply_soft_delete(obj, actor_id)
    db.commit()
    return MessageResponse(message="Byproduct item deleted successfully")


def restore_item(
    db: Session,
    item_id: UUID,
    *,
    actor_id: UUID | None = None,
) -> ByproductItemRead:
    obj = (
        db.query(ByproductItem)
        .filter(ByproductItem.id == item_id)
        .first()
    )
    if not obj:
        raise _http_404("Byproduct item not found")

    _apply_restore(obj, actor_id)
    obj.is_active = True

    db.commit()
    db.refresh(obj)
    return _serialize_item(obj)


# =============================================================================
# CUSTOMER SERVICES
# =============================================================================


def create_customer(
    db: Session,
    payload: ByproductCustomerCreate,
    *,
    actor_id: UUID | None = None,
) -> ByproductCustomerRead:
    _ensure_customer_code_available(db, payload.customer_code)

    obj = ByproductCustomer(
        customer_code=payload.customer_code,
        customer_name=payload.customer_name,
        transaction_name=payload.transaction_name,
        contact_person=payload.contact_person,
        phone_number=payload.phone_number,
        alternative_phone_number=payload.alternative_phone_number,
        email=payload.email,
        address=payload.address,
        business_location=payload.business_location,
        district=payload.district,
        region=payload.region,
        tin_number=payload.tin_number,
        registration_number=payload.registration_number,
        customer_type=payload.customer_type,
        default_payment_mode=payload.default_payment_mode,
        credit_allowed=payload.credit_allowed,
        credit_limit=_money(payload.credit_limit) if payload.credit_limit is not None else None,
        notes=payload.notes,
        is_active=payload.is_active,
        is_deleted=False,
    )
    _apply_create_audit(obj, actor_id)

    db.add(obj)
    db.commit()
    db.refresh(obj)
    return _serialize_customer(obj)


def get_customer(db: Session, customer_id: UUID) -> ByproductCustomerRead:
    obj = _get_customer_or_404(db, customer_id)
    return _serialize_customer(obj)


def list_customers(
    db: Session,
    filters: ByproductCustomerFilter | None = None,
    *,
    skip: int = 0,
    limit: int = 100,
) -> ByproductCustomerListResponse:
    filters = filters or ByproductCustomerFilter()

    q = db.query(ByproductCustomer)

    if not filters.include_deleted:
        q = q.filter(ByproductCustomer.is_deleted.is_(False))

    if filters.is_active is not None:
        q = q.filter(ByproductCustomer.is_active.is_(filters.is_active))

    if filters.customer_type:
        q = q.filter(ByproductCustomer.customer_type == filters.customer_type)

    if filters.business_location:
        q = q.filter(ByproductCustomer.business_location.ilike(f"%{filters.business_location}%"))

    if filters.district:
        q = q.filter(ByproductCustomer.district.ilike(f"%{filters.district}%"))

    if filters.region:
        q = q.filter(ByproductCustomer.region.ilike(f"%{filters.region}%"))

    if filters.search:
        term = f"%{filters.search}%"
        q = q.filter(
            or_(
                ByproductCustomer.customer_code.ilike(term),
                ByproductCustomer.customer_name.ilike(term),
                ByproductCustomer.transaction_name.ilike(term),
                ByproductCustomer.contact_person.ilike(term),
                ByproductCustomer.phone_number.ilike(term),
                ByproductCustomer.email.ilike(term),
                ByproductCustomer.business_location.ilike(term),
            )
        )

    total = q.count()
    items = (
        q.order_by(ByproductCustomer.customer_name.asc())
        .offset(skip)
        .limit(limit)
        .all()
    )

    return ByproductCustomerListResponse(
        items=[_serialize_customer(item) for item in items],
        total=total,
    )


def update_customer(
    db: Session,
    customer_id: UUID,
    payload: ByproductCustomerUpdate,
    *,
    actor_id: UUID | None = None,
) -> ByproductCustomerRead:
    obj = _get_customer_or_404(db, customer_id)

    if payload.customer_code is not None and payload.customer_code != obj.customer_code:
        _ensure_customer_code_available(db, payload.customer_code, exclude_id=obj.id)
        obj.customer_code = payload.customer_code

    if payload.customer_name is not None:
        obj.customer_name = payload.customer_name

    if payload.transaction_name is not None:
        obj.transaction_name = payload.transaction_name

    if payload.contact_person is not None:
        obj.contact_person = payload.contact_person

    if payload.phone_number is not None:
        obj.phone_number = payload.phone_number

    if payload.alternative_phone_number is not None:
        obj.alternative_phone_number = payload.alternative_phone_number

    if payload.email is not None:
        obj.email = payload.email

    if payload.address is not None:
        obj.address = payload.address

    if payload.business_location is not None:
        obj.business_location = payload.business_location

    if payload.district is not None:
        obj.district = payload.district

    if payload.region is not None:
        obj.region = payload.region

    if payload.tin_number is not None:
        obj.tin_number = payload.tin_number

    if payload.registration_number is not None:
        obj.registration_number = payload.registration_number

    if payload.customer_type is not None:
        obj.customer_type = payload.customer_type

    if payload.default_payment_mode is not None:
        obj.default_payment_mode = payload.default_payment_mode

    if payload.credit_allowed is not None:
        obj.credit_allowed = payload.credit_allowed
        if not payload.credit_allowed and payload.credit_limit is None:
            obj.credit_limit = None

    if payload.credit_limit is not None:
        obj.credit_limit = _money(payload.credit_limit)

    if payload.notes is not None:
        obj.notes = payload.notes

    if payload.is_active is not None:
        obj.is_active = payload.is_active

    _apply_update_audit(obj, actor_id)

    db.commit()
    db.refresh(obj)
    return _serialize_customer(obj)


def delete_customer(
    db: Session,
    customer_id: UUID,
    *,
    actor_id: UUID | None = None,
) -> MessageResponse:
    obj = _get_customer_or_404(db, customer_id)
    _apply_soft_delete(obj, actor_id)
    db.commit()
    return MessageResponse(message="Byproduct customer deleted successfully")


def restore_customer(
    db: Session,
    customer_id: UUID,
    *,
    actor_id: UUID | None = None,
) -> ByproductCustomerRead:
    obj = (
        db.query(ByproductCustomer)
        .filter(ByproductCustomer.id == customer_id)
        .first()
    )
    if not obj:
        raise _http_404("Byproduct customer not found")

    _apply_restore(obj, actor_id)
    obj.is_active = True

    db.commit()
    db.refresh(obj)
    return _serialize_customer(obj)


# =============================================================================
# SALE LINE HELPERS FOR CREATE / UPDATE
# =============================================================================


def _append_sale_lines_from_create_payload(
    db: Session,
    sale: ByproductSale,
    payload_lines: Iterable,
    *,
    actor_id: UUID | None = None,
) -> None:
    for index, payload_line in enumerate(payload_lines, start=1):
        item = _resolve_item_for_line(db, payload_line.byproduct_id)

        unit_price = payload_line.unit_price
        if unit_price is None and item:
            unit_price = item.default_unit_price
        if unit_price is None:
            raise _http_400("unit_price is required for each sale line")

        line = _build_sale_line_from_values(
            sale_id=sale.id,
            line_number=index,
            byproduct=item,
            byproduct_id=payload_line.byproduct_id,
            byproduct_name=payload_line.byproduct_name,
            quantity=payload_line.quantity,
            unit_price=unit_price,
            remarks=payload_line.remarks,
            extra_meta=payload_line.extra_meta,
            actor_id=actor_id,
        )
        sale.lines.append(line)


def _update_existing_sale_line(
    db: Session,
    line: ByproductSaleLine,
    payload: ByproductSaleLineUpdate,
    *,
    actor_id: UUID | None = None,
) -> None:
    item = None
    item_lookup_id = payload.byproduct_id if payload.byproduct_id is not None else line.byproduct_id
    if item_lookup_id:
        item = _resolve_item_for_line(db, item_lookup_id)

    if payload.byproduct_id is not None:
        line.byproduct_id = payload.byproduct_id if item else None
        line.byproduct_code_snapshot = item.code if item else None
        line.byproduct_name_snapshot = item.name if item else (payload.byproduct_name or line.byproduct_name_snapshot)
        line.byproduct_category_snapshot = item.category.name if item and item.category else None
        line.unit_of_measure_snapshot = item.unit_of_measure.value if item else None

    if payload.byproduct_name is not None and not item:
        normalized_name = _normalize_text(payload.byproduct_name)
        if not normalized_name:
            raise _http_400("byproduct_name cannot be empty")
        line.byproduct_name_snapshot = normalized_name

    if payload.line_number is not None:
        line.line_number = payload.line_number

    if payload.quantity is not None:
        line.quantity = _qty(payload.quantity)

    if payload.unit_price is not None:
        line.unit_price = _money(payload.unit_price)

    if payload.remarks is not None:
        line.remarks = _normalize_text(payload.remarks)

    if payload.extra_meta is not None:
        line.extra_meta = payload.extra_meta

    if payload.is_active is not None:
        line.is_active = payload.is_active

    _validate_item_quantity_rule(item, _qty(line.quantity))
    _validate_item_price_rule(item, _money(line.unit_price))
    line.line_total = _money(_qty(line.quantity) * _money(line.unit_price))

    _apply_update_audit(line, actor_id)


def _create_new_line_from_update_payload(
    db: Session,
    sale: ByproductSale,
    payload: ByproductSaleLineUpdate,
    *,
    actor_id: UUID | None = None,
) -> ByproductSaleLine:
    if payload.quantity is None:
        raise _http_400("quantity is required for a new sale line")
    if payload.unit_price is None:
        raise _http_400("unit_price is required for a new sale line")
    if not payload.byproduct_id and not payload.byproduct_name:
        raise _http_400("byproduct_id or byproduct_name is required for a new sale line")

    item = _resolve_item_for_line(db, payload.byproduct_id)
    return _build_sale_line_from_values(
        sale_id=sale.id,
        line_number=payload.line_number or len([x for x in sale.lines if not x.is_deleted]) + 1,
        byproduct=item,
        byproduct_id=payload.byproduct_id,
        byproduct_name=payload.byproduct_name,
        quantity=payload.quantity,
        unit_price=payload.unit_price if payload.unit_price is not None else item.default_unit_price,
        remarks=payload.remarks,
        extra_meta=payload.extra_meta,
        actor_id=actor_id,
    )


# =============================================================================
# SALE SERVICES
# =============================================================================


def create_sale(
    db: Session,
    payload: ByproductSaleCreate,
    *,
    actor_id: UUID | None = None,
) -> ByproductSaleRead:
    customer_id, customer_name_snapshot, transaction_name_snapshot, phone_snapshot, location_snapshot = (
        _resolve_customer_snapshot(
            db,
            customer_id=payload.customer_id,
            customer_name=payload.customer_name,
            transaction_name=payload.transaction_name,
        )
    )

    sale_number = payload.sale_number or _generate_sale_number(db, payload.sale_date)
    _ensure_sale_number_available(db, sale_number)

    payment_mode = payload.payment_mode
    if payment_mode is None and customer_id:
        customer = _get_customer_or_404(db, customer_id)
        payment_mode = customer.default_payment_mode

    sale = ByproductSale(
        sale_number=sale_number,
        sale_date=payload.sale_date,
        customer_id=customer_id,
        customer_name_snapshot=customer_name_snapshot,
        transaction_name_snapshot=transaction_name_snapshot,
        customer_phone_snapshot=phone_snapshot,
        customer_business_location_snapshot=location_snapshot,
        status=payload.status or ByproductSaleStatus.POSTED,
        payment_mode=payment_mode,
        discount_amount=_money(payload.discount_amount),
        adjustment_amount=_money(payload.adjustment_amount),
        amount_paid=_money(payload.amount_paid),
        remarks=payload.remarks,
        extra_meta=payload.extra_meta,
        is_active=True,
        is_deleted=False,
    )
    _apply_create_audit(sale, actor_id)

    db.add(sale)
    db.flush()

    _append_sale_lines_from_create_payload(db, sale, payload.lines, actor_id=actor_id)
    _refresh_sale_lines_order(sale)
    _recalculate_sale_totals(sale)

    db.commit()
    db.refresh(sale)

    sale = (
        db.query(ByproductSale)
        .options(selectinload(ByproductSale.lines))
        .filter(ByproductSale.id == sale.id)
        .first()
    )
    return _serialize_sale(sale)


def get_sale(db: Session, sale_id: UUID) -> ByproductSaleRead:
    sale = _get_sale_or_404(db, sale_id, with_lines=True)
    return _serialize_sale(sale)


def list_sales(
    db: Session,
    filters: ByproductSaleFilter | None = None,
    *,
    skip: int = 0,
    limit: int = 100,
) -> ByproductSaleListResponse:
    filters = filters or ByproductSaleFilter()

    q = db.query(ByproductSale)

    if not filters.include_deleted:
        q = q.filter(ByproductSale.is_deleted.is_(False))

    if filters.search:
        term = f"%{filters.search}%"
        q = q.filter(
            or_(
                ByproductSale.sale_number.ilike(term),
                ByproductSale.customer_name_snapshot.ilike(term),
                ByproductSale.transaction_name_snapshot.ilike(term),
                ByproductSale.remarks.ilike(term),
            )
        )

    if filters.sale_date_from:
        q = q.filter(ByproductSale.sale_date >= filters.sale_date_from)

    if filters.sale_date_to:
        q = q.filter(ByproductSale.sale_date <= filters.sale_date_to)

    if filters.customer_id:
        q = q.filter(ByproductSale.customer_id == filters.customer_id)

    if filters.payment_mode:
        q = q.filter(ByproductSale.payment_mode == filters.payment_mode)

    if filters.status:
        q = q.filter(ByproductSale.status == filters.status)

    if filters.byproduct_id or filters.category_id:
        line_q = db.query(ByproductSaleLine.sale_id).filter(
            ByproductSaleLine.is_deleted.is_(False),
            ByproductSaleLine.is_active.is_(True),
        )

        if filters.byproduct_id:
            line_q = line_q.filter(ByproductSaleLine.byproduct_id == filters.byproduct_id)

        if filters.category_id:
            line_q = line_q.join(
                ByproductItem,
                ByproductItem.id == ByproductSaleLine.byproduct_id,
            ).filter(ByproductItem.category_id == filters.category_id)

        sale_ids_subq = line_q.distinct().subquery()
        q = q.filter(ByproductSale.id.in_(db.query(sale_ids_subq.c.sale_id)))

    total = q.count()

    items = (
        q.order_by(ByproductSale.sale_date.desc(), ByproductSale.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

    return ByproductSaleListResponse(
        items=[_serialize_sale_summary(item) for item in items],
        total=total,
    )


def update_sale(
    db: Session,
    sale_id: UUID,
    payload: ByproductSaleUpdate,
    *,
    actor_id: UUID | None = None,
) -> ByproductSaleRead:
    sale = _get_sale_or_404(db, sale_id, with_lines=True)

    if sale.status == ByproductSaleStatus.VOID:
        raise _http_409("A voided sale cannot be updated")

    if payload.sale_date is not None:
        sale.sale_date = payload.sale_date

    if payload.customer_id is not None or payload.customer_name is not None:
        customer_id, customer_name_snapshot, transaction_name_snapshot, phone_snapshot, location_snapshot = (
            _resolve_customer_snapshot(
                db,
                customer_id=payload.customer_id,
                customer_name=payload.customer_name,
                transaction_name=payload.transaction_name,
            )
        )
        sale.customer_id = customer_id
        sale.customer_name_snapshot = customer_name_snapshot
        sale.transaction_name_snapshot = transaction_name_snapshot
        sale.customer_phone_snapshot = phone_snapshot
        sale.customer_business_location_snapshot = location_snapshot
    elif payload.transaction_name is not None:
        sale.transaction_name_snapshot = payload.transaction_name

    if payload.status is not None:
        sale.status = payload.status

    if payload.payment_mode is not None:
        sale.payment_mode = payload.payment_mode

    if payload.discount_amount is not None:
        sale.discount_amount = _money(payload.discount_amount)

    if payload.adjustment_amount is not None:
        sale.adjustment_amount = _money(payload.adjustment_amount)

    if payload.amount_paid is not None:
        sale.amount_paid = _money(payload.amount_paid)

    if payload.remarks is not None:
        sale.remarks = payload.remarks

    if payload.extra_meta is not None:
        sale.extra_meta = payload.extra_meta

    existing_lines_map = {line.id: line for line in sale.lines if not line.is_deleted}

    for delete_line_id in payload.deleted_line_ids:
        line = existing_lines_map.get(delete_line_id)
        if not line:
            raise _http_404("One of the sale lines to delete was not found in this sale")
        _apply_soft_delete(line, actor_id)

    if payload.lines:
        for line_payload in payload.lines:
            if line_payload.id:
                existing_line = existing_lines_map.get(line_payload.id)
                if not existing_line:
                    raise _http_404("One of the sale lines to update was not found in this sale")
                _update_existing_sale_line(db, existing_line, line_payload, actor_id=actor_id)
            else:
                new_line = _create_new_line_from_update_payload(db, sale, line_payload, actor_id=actor_id)
                sale.lines.append(new_line)

    _refresh_sale_lines_order(sale)
    _apply_update_audit(sale, actor_id)
    _recalculate_sale_totals(sale)

    db.commit()
    db.refresh(sale)

    sale = (
        db.query(ByproductSale)
        .options(selectinload(ByproductSale.lines))
        .filter(ByproductSale.id == sale.id)
        .first()
    )
    return _serialize_sale(sale)


def delete_sale(
    db: Session,
    sale_id: UUID,
    *,
    actor_id: UUID | None = None,
) -> MessageResponse:
    sale = _get_sale_or_404(db, sale_id, with_lines=True)

    _apply_soft_delete(sale, actor_id)
    for line in sale.lines:
        if not line.is_deleted:
            _apply_soft_delete(line, actor_id)

    db.commit()
    return MessageResponse(message="Byproduct sale deleted successfully")


def restore_sale(
    db: Session,
    sale_id: UUID,
    *,
    actor_id: UUID | None = None,
) -> ByproductSaleRead:
    sale = (
        db.query(ByproductSale)
        .options(selectinload(ByproductSale.lines))
        .filter(ByproductSale.id == sale_id)
        .first()
    )
    if not sale:
        raise _http_404("Byproduct sale not found")

    _apply_restore(sale, actor_id)
    sale.is_active = True

    for line in sale.lines:
        _apply_restore(line, actor_id)
        line.is_active = True

    _refresh_sale_lines_order(sale)
    _recalculate_sale_totals(sale)

    db.commit()
    db.refresh(sale)

    sale = (
        db.query(ByproductSale)
        .options(selectinload(ByproductSale.lines))
        .filter(ByproductSale.id == sale.id)
        .first()
    )
    return _serialize_sale(sale)


def void_sale(
    db: Session,
    sale_id: UUID,
    *,
    actor_id: UUID | None = None,
    remarks: str | None = None,
) -> ByproductSaleRead:
    sale = _get_sale_or_404(db, sale_id, with_lines=True)

    if sale.status == ByproductSaleStatus.VOID:
        return _serialize_sale(sale)

    sale.status = ByproductSaleStatus.VOID
    if remarks:
        note = _normalize_text(remarks)
        sale.remarks = f"{sale.remarks}\nVOID NOTE: {note}".strip() if sale.remarks else f"VOID NOTE: {note}"

    _apply_update_audit(sale, actor_id)

    db.commit()
    db.refresh(sale)

    sale = (
        db.query(ByproductSale)
        .options(selectinload(ByproductSale.lines))
        .filter(ByproductSale.id == sale.id)
        .first()
    )
    return _serialize_sale(sale)


# =============================================================================
# OPTIONAL SALE LINE DIRECT OPERATIONS
# =============================================================================


def get_sale_line(db: Session, line_id: UUID) -> ByproductSaleLine:
    return _get_sale_line_or_404(db, line_id)


def delete_sale_line(
    db: Session,
    sale_id: UUID,
    line_id: UUID,
    *,
    actor_id: UUID | None = None,
) -> ByproductSaleRead:
    sale = _get_sale_or_404(db, sale_id, with_lines=True)
    line = next((x for x in sale.lines if x.id == line_id and not x.is_deleted), None)
    if not line:
        raise _http_404("Byproduct sale line not found in the selected sale")

    if sale.status == ByproductSaleStatus.VOID:
        raise _http_409("You cannot modify a voided sale")

    _apply_soft_delete(line, actor_id)
    _refresh_sale_lines_order(sale)
    _apply_update_audit(sale, actor_id)
    _recalculate_sale_totals(sale)

    db.commit()
    db.refresh(sale)

    sale = (
        db.query(ByproductSale)
        .options(selectinload(ByproductSale.lines))
        .filter(ByproductSale.id == sale.id)
        .first()
    )
    return _serialize_sale(sale)


# =============================================================================
# UTILITY / QUICK LOOKUPS
# =============================================================================


def get_active_items_for_selection(db: Session) -> list[ByproductItemRead]:
    items = (
        db.query(ByproductItem)
        .filter(
            ByproductItem.is_active.is_(True),
            ByproductItem.is_deleted.is_(False),
        )
        .order_by(ByproductItem.name.asc())
        .all()
    )
    return [_serialize_item(item) for item in items]


def get_active_customers_for_selection(db: Session) -> list[ByproductCustomerRead]:
    customers = (
        db.query(ByproductCustomer)
        .filter(
            ByproductCustomer.is_active.is_(True),
            ByproductCustomer.is_deleted.is_(False),
        )
        .order_by(ByproductCustomer.customer_name.asc())
        .all()
    )
    return [_serialize_customer(item) for item in customers]


def get_active_categories_for_selection(db: Session) -> list[ByproductCategoryRead]:
    categories = (
        db.query(ByproductCategory)
        .filter(
            ByproductCategory.is_active.is_(True),
            ByproductCategory.is_deleted.is_(False),
        )
        .order_by(ByproductCategory.sort_order.asc(), ByproductCategory.name.asc())
        .all()
    )
    return [_serialize_category(item) for item in categories]