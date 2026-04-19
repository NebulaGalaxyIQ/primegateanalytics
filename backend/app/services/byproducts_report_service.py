from __future__ import annotations

from calendar import monthrange
from collections import defaultdict
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import Iterable
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import and_
from sqlalchemy.orm import Session, joinedload

from app.models.byproducts import (
    ByproductItem,
    ByproductSale,
    ByproductSaleLine,
    ByproductSaleStatus,
)
from app.schemas.byproducts import (
    ByproductDashboardCard,
    ByproductDashboardResponse,
    ByproductGroupedReportRow,
    ByproductReportFilter,
    ByproductReportPeriodInfo,
    ByproductReportResponse,
    ByproductReportRow,
    ByproductReportTotals,
    ByproductTrendPoint,
    ByproductTrendResponse,
)

MONEY_PLACES = Decimal("0.01")
QTY_PLACES = Decimal("0.001")


# =============================================================================
# INTERNAL TYPES
# =============================================================================


@dataclass
class _PreparedRow:
    sale_id: UUID | None
    sale_line_id: UUID | None
    sale_date: date
    sale_number: str | None

    customer_id: UUID | None
    customer_name: str | None
    transaction_name: str | None
    business_location: str | None

    byproduct_id: UUID | None
    byproduct_name: str | None
    byproduct_category: str | None
    unit_of_measure: str | None

    quantity: Decimal
    unit_price: Decimal
    line_total: Decimal

    payment_mode: str | None
    status: str | None

    sale_total_amount: Decimal
    sale_amount_paid: Decimal
    sale_balance_due: Decimal
    sale_discount_amount: Decimal
    sale_adjustment_amount: Decimal


# =============================================================================
# GENERIC HELPERS
# =============================================================================


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


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


def _safe_text(value: str | None) -> str | None:
    if value is None:
        return None
    value = str(value).strip()
    return value or None


def _http_400(detail: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)


def _validate_date_range(date_from: date, date_to: date) -> None:
    if date_to < date_from:
        raise _http_400("date_to cannot be earlier than date_from")


def _start_of_week(target_date: date) -> date:
    return target_date - timedelta(days=target_date.weekday())


def _end_of_week(target_date: date) -> date:
    return _start_of_week(target_date) + timedelta(days=6)


def _start_of_month(year: int, month: int) -> date:
    return date(year, month, 1)


def _end_of_month(year: int, month: int) -> date:
    last_day = monthrange(year, month)[1]
    return date(year, month, last_day)


def _enum_value(value) -> str | None:
    if value is None:
        return None
    return getattr(value, "value", value)


def _display_customer_name(row: _PreparedRow) -> str:
    return (
        _safe_text(row.customer_name)
        or _safe_text(row.transaction_name)
        or "Walk-in / Unassigned Customer"
    )


def _display_transaction_name(row: _PreparedRow) -> str:
    return _safe_text(row.transaction_name) or _display_customer_name(row)


def _display_byproduct_name(row: _PreparedRow) -> str:
    return _safe_text(row.byproduct_name) or "Unnamed Byproduct"


def _build_group_key_and_label(row: _PreparedRow, group_by: str) -> tuple[str, str]:
    if group_by == "day":
        key = row.sale_date.isoformat()
        label = row.sale_date.strftime("%d %b %Y")
        return key, label

    if group_by == "week":
        week_start = _start_of_week(row.sale_date)
        week_end = _end_of_week(row.sale_date)
        key = week_start.isoformat()
        label = f"{week_start.strftime('%d %b %Y')} - {week_end.strftime('%d %b %Y')}"
        return key, label

    if group_by == "month":
        key = row.sale_date.strftime("%Y-%m")
        label = row.sale_date.strftime("%B %Y")
        return key, label

    if group_by == "customer":
        label = _display_customer_name(row)
        key = str(row.customer_id) if row.customer_id else label
        return key, label

    if group_by == "byproduct":
        label = _display_byproduct_name(row)
        key = str(row.byproduct_id) if row.byproduct_id else label
        return key, label

    if group_by == "category":
        label = _safe_text(row.byproduct_category) or "Uncategorized"
        key = label
        return key, label

    raise _http_400(f"Unsupported group_by value: {group_by}")


def _build_trend_key_and_label(target_date: date, interval: str) -> tuple[str, str]:
    if interval == "day":
        return target_date.isoformat(), target_date.strftime("%d %b %Y")

    if interval == "week":
        week_start = _start_of_week(target_date)
        week_end = _end_of_week(target_date)
        return (
            week_start.isoformat(),
            f"{week_start.strftime('%d %b %Y')} - {week_end.strftime('%d %b %Y')}",
        )

    if interval == "month":
        return target_date.strftime("%Y-%m"), target_date.strftime("%B %Y")

    raise _http_400(f"Unsupported trend interval: {interval}")


def _determine_default_group_by(report_type: str) -> str | None:
    if report_type == "daily":
        return None
    if report_type == "weekly":
        return "day"
    if report_type == "monthly":
        return "day"
    if report_type == "custom_period":
        return "day"
    if report_type == "accumulation":
        return "month"
    return None


def _format_number_with_commas(value: Decimal | int | None) -> str:
    """Convert a number to a string with commas as thousand separators."""
    if value is None:
        return ""
    if isinstance(value, int):
        return f"{value:,}"
    # Decimal: preserve exact decimal places as quantized
    s = f"{value:f}"  # no scientific notation, full decimal
    if "." in s:
        int_part, dec_part = s.split(".")
        int_part_with_commas = f"{int(int_part):,}"
        return f"{int_part_with_commas}.{dec_part}"
    else:
        return f"{int(value):,}"


# =============================================================================
# QUERY + PREPARATION
# =============================================================================


def _base_report_query(db: Session):
    return (
        db.query(ByproductSaleLine, ByproductSale)
        .join(ByproductSale, ByproductSale.id == ByproductSaleLine.sale_id)
        .options(
            joinedload(ByproductSaleLine.byproduct).joinedload(ByproductItem.category),
        )
    )


def _apply_report_filters(query, filters: ByproductReportFilter):
    query = query.filter(
        ByproductSale.sale_date >= filters.date_from,
        ByproductSale.sale_date <= filters.date_to,
    )

    if not filters.include_deleted:
        query = query.filter(
            ByproductSale.is_deleted.is_(False),
            ByproductSaleLine.is_deleted.is_(False),
            ByproductSale.is_active.is_(True),
            ByproductSaleLine.is_active.is_(True),
        )

    if not filters.include_void:
        query = query.filter(ByproductSale.status != ByproductSaleStatus.VOID)

    if filters.customer_id:
        query = query.filter(ByproductSale.customer_id == filters.customer_id)

    if filters.byproduct_id:
        query = query.filter(ByproductSaleLine.byproduct_id == filters.byproduct_id)

    if filters.category_id:
        query = query.join(
            ByproductItem,
            and_(
                ByproductItem.id == ByproductSaleLine.byproduct_id,
                ByproductItem.is_deleted.is_(False),
            ),
        ).filter(ByproductItem.category_id == filters.category_id)

    if filters.search:
        term = f"%{filters.search}%"
        query = query.filter(
            (
                ByproductSale.sale_number.ilike(term)
                | ByproductSale.customer_name_snapshot.ilike(term)
                | ByproductSale.transaction_name_snapshot.ilike(term)
                | ByproductSale.customer_business_location_snapshot.ilike(term)
                | ByproductSaleLine.byproduct_name_snapshot.ilike(term)
                | ByproductSaleLine.byproduct_category_snapshot.ilike(term)
            )
        )

    return query


def _prepare_row(sale: ByproductSale, line: ByproductSaleLine) -> _PreparedRow:
    return _PreparedRow(
        sale_id=sale.id,
        sale_line_id=line.id,
        sale_date=sale.sale_date,
        sale_number=sale.sale_number,
        customer_id=sale.customer_id,
        customer_name=_safe_text(sale.customer_name_snapshot),
        transaction_name=_safe_text(sale.transaction_name_snapshot),
        business_location=_safe_text(sale.customer_business_location_snapshot),
        byproduct_id=line.byproduct_id,
        byproduct_name=_safe_text(line.byproduct_name_snapshot),
        byproduct_category=_safe_text(line.byproduct_category_snapshot),
        unit_of_measure=_safe_text(line.unit_of_measure_snapshot),
        quantity=_qty(line.quantity),
        unit_price=_money(line.unit_price),
        line_total=_money(line.line_total),
        payment_mode=_enum_value(sale.payment_mode),
        status=_enum_value(sale.status),
        sale_total_amount=_money(sale.total_amount),
        sale_amount_paid=_money(sale.amount_paid),
        sale_balance_due=_money(sale.balance_due),
        sale_discount_amount=_money(sale.discount_amount),
        sale_adjustment_amount=_money(sale.adjustment_amount),
    )


def _fetch_prepared_rows(
    db: Session,
    filters: ByproductReportFilter,
) -> list[_PreparedRow]:
    query = _base_report_query(db)
    query = _apply_report_filters(query, filters)

    records = (
        query.order_by(
            ByproductSale.sale_date.asc(),
            ByproductSale.sale_number.asc(),
            ByproductSaleLine.line_number.asc(),
            ByproductSaleLine.created_at.asc(),
        )
        .all()
    )

    return [_prepare_row(sale, line) for line, sale in records]


# =============================================================================
# SERIALIZATION HELPERS
# =============================================================================


def _serialize_report_rows(rows: Iterable[_PreparedRow]) -> list[ByproductReportRow]:
    return [
        ByproductReportRow(
            sale_id=row.sale_id,
            sale_line_id=row.sale_line_id,
            sale_date=row.sale_date,
            sale_number=row.sale_number,
            customer_id=row.customer_id,
            customer_name=_display_customer_name(row),
            transaction_name=_display_transaction_name(row),
            business_location=row.business_location,
            byproduct_id=row.byproduct_id,
            byproduct_name=_display_byproduct_name(row),
            byproduct_category=row.byproduct_category,
            unit_of_measure=row.unit_of_measure,
            quantity=row.quantity,
            unit_price=row.unit_price,
            line_total=row.line_total,
            payment_mode=row.payment_mode,
            status=row.status,
        )
        for row in rows
    ]


def _build_grouped_rows(
    rows: list[_PreparedRow],
    *,
    group_by: str | None,
) -> list[ByproductGroupedReportRow]:
    if not group_by:
        return []

    buckets: dict[str, dict] = {}

    for row in rows:
        key, label = _build_group_key_and_label(row, group_by)

        if key not in buckets:
            buckets[key] = {
                "group_key": key,
                "group_label": label,
                "quantity_total": Decimal("0"),
                "amount_total": Decimal("0.00"),
                "unit_price_weighted_sum": Decimal("0.00"),
                "transaction_refs": set(),
            }

        bucket = buckets[key]
        bucket["quantity_total"] += _qty(row.quantity)
        bucket["amount_total"] += _money(row.line_total)
        bucket["unit_price_weighted_sum"] += _money(row.unit_price) * _qty(row.quantity)

        if row.sale_id:
            bucket["transaction_refs"].add(str(row.sale_id))

    results: list[ByproductGroupedReportRow] = []

    for bucket in buckets.values():
        quantity_total = _qty(bucket["quantity_total"])
        amount_total = _money(bucket["amount_total"])
        average_unit_price = None

        if quantity_total > 0:
            average_unit_price = _money(
                bucket["unit_price_weighted_sum"] / quantity_total
            )

        results.append(
            ByproductGroupedReportRow(
                group_key=bucket["group_key"],
                group_label=bucket["group_label"],
                quantity_total=quantity_total,
                amount_total=amount_total,
                average_unit_price=average_unit_price,
                transaction_count=len(bucket["transaction_refs"]),
            )
        )

    if group_by in {"day", "week", "month"}:
        results.sort(key=lambda x: x.group_key)
    else:
        results.sort(key=lambda x: (-x.amount_total, x.group_label.lower()))

    return results


def _build_totals(rows: list[_PreparedRow]) -> ByproductReportTotals:
    if not rows:
        return ByproductReportTotals(
            total_quantity=Decimal("0"),
            subtotal_amount=Decimal("0.00"),
            discount_amount=Decimal("0.00"),
            adjustment_amount=Decimal("0.00"),
            total_amount=Decimal("0.00"),
            amount_paid=Decimal("0.00"),
            balance_due=Decimal("0.00"),
            transaction_count=0,
            line_count=0,
            customer_count=0,
            byproduct_count=0,
        )

    sale_map: dict[str, _PreparedRow] = {}
    customer_refs: set[str] = set()
    byproduct_refs: set[str] = set()

    total_quantity = Decimal("0")
    subtotal_amount = Decimal("0.00")

    for row in rows:
        total_quantity += _qty(row.quantity)
        subtotal_amount += _money(row.line_total)

        if row.sale_id:
            sale_map[str(row.sale_id)] = row

        if row.customer_id:
            customer_refs.add(str(row.customer_id))
        else:
            customer_refs.add(_display_customer_name(row))

        if row.byproduct_id:
            byproduct_refs.add(str(row.byproduct_id))
        else:
            byproduct_refs.add(_display_byproduct_name(row))

    discount_amount = sum(
        (_money(x.sale_discount_amount) for x in sale_map.values()),
        Decimal("0.00"),
    )
    adjustment_amount = sum(
        (_money(x.sale_adjustment_amount) for x in sale_map.values()),
        Decimal("0.00"),
    )
    total_amount = sum(
        (_money(x.sale_total_amount) for x in sale_map.values()),
        Decimal("0.00"),
    )
    amount_paid = sum(
        (_money(x.sale_amount_paid) for x in sale_map.values()),
        Decimal("0.00"),
    )
    balance_due = sum(
        (_money(x.sale_balance_due) for x in sale_map.values()),
        Decimal("0.00"),
    )

    return ByproductReportTotals(
        total_quantity=_qty(total_quantity),
        subtotal_amount=_money(subtotal_amount),
        discount_amount=_money(discount_amount),
        adjustment_amount=_money(adjustment_amount),
        total_amount=_money(total_amount),
        amount_paid=_money(amount_paid),
        balance_due=_money(balance_due),
        transaction_count=len(sale_map),
        line_count=len(rows),
        customer_count=len(customer_refs),
        byproduct_count=len(byproduct_refs),
    )


def _resolve_selected_customer_name(
    rows: list[_PreparedRow],
    filters: ByproductReportFilter,
) -> str | None:
    if not filters.customer_id:
        return None

    for row in rows:
        if row.customer_id == filters.customer_id:
            return _display_customer_name(row)

    return None


def _build_table_total_row(report: ByproductReportResponse) -> dict:
    return {
        "no": "TOTAL",
        "sale_date": None,
        "sale_number": None,
        "customer_name": None,
        "transaction_name": None,
        "business_location": None,
        "byproduct_name": None,
        "byproduct_category": None,
        "unit_of_measure": None,
        "quantity": _format_number_with_commas(report.totals.total_quantity),
        "unit_price": None,
        "line_total": _format_number_with_commas(report.totals.total_amount),
        "payment_mode": None,
        "status": None,
        "is_total_row": True,
    }


def _build_context_rows(report: ByproductReportResponse) -> list[dict]:
    context_rows: list[dict] = []

    for index, row in enumerate(report.rows, start=1):
        context_rows.append(
            {
                "no": index,
                "sale_date": row.sale_date.strftime("%d %B %Y"),
                "sale_number": row.sale_number,
                "customer_name": row.customer_name,
                "transaction_name": row.transaction_name,
                "business_location": row.business_location,
                "byproduct_name": row.byproduct_name,
                "byproduct_category": row.byproduct_category,
                "unit_of_measure": row.unit_of_measure,
                "quantity": _format_number_with_commas(row.quantity),
                "unit_price": _format_number_with_commas(row.unit_price),
                "line_total": _format_number_with_commas(row.line_total),
                "payment_mode": row.payment_mode,
                "status": row.status,
                "is_total_row": False,
            }
        )

    return context_rows


# =============================================================================
# MAIN REPORT BUILDERS
# =============================================================================


def build_report(
    db: Session,
    filters: ByproductReportFilter,
) -> ByproductReportResponse:
    _validate_date_range(filters.date_from, filters.date_to)

    prepared_rows = _fetch_prepared_rows(db, filters)
    group_by = filters.group_by or _determine_default_group_by(filters.report_type)

    serialized_rows = _serialize_report_rows(prepared_rows)
    grouped_rows = _build_grouped_rows(prepared_rows, group_by=group_by)
    totals = _build_totals(prepared_rows)

    return ByproductReportResponse(
        period=ByproductReportPeriodInfo(
            report_type=filters.report_type,
            date_from=filters.date_from,
            date_to=filters.date_to,
            generated_at=_utcnow(),
        ),
        filters=filters,
        rows=serialized_rows,
        grouped_rows=grouped_rows,
        totals=totals,
    )


def get_daily_report(
    db: Session,
    report_date: date,
    *,
    customer_id: UUID | None = None,
    byproduct_id: UUID | None = None,
    category_id: UUID | None = None,
    include_void: bool = False,
    include_deleted: bool = False,
    group_by: str | None = None,
    search: str | None = None,
) -> ByproductReportResponse:
    filters = ByproductReportFilter(
        report_type="daily",
        date_from=report_date,
        date_to=report_date,
        customer_id=customer_id,
        byproduct_id=byproduct_id,
        category_id=category_id,
        include_void=include_void,
        include_deleted=include_deleted,
        group_by=group_by,
        search=search,
    )
    return build_report(db, filters)


def get_weekly_report(
    db: Session,
    target_date: date,
    *,
    customer_id: UUID | None = None,
    byproduct_id: UUID | None = None,
    category_id: UUID | None = None,
    include_void: bool = False,
    include_deleted: bool = False,
    group_by: str | None = None,
    search: str | None = None,
) -> ByproductReportResponse:
    date_from = _start_of_week(target_date)
    date_to = _end_of_week(target_date)

    filters = ByproductReportFilter(
        report_type="weekly",
        date_from=date_from,
        date_to=date_to,
        customer_id=customer_id,
        byproduct_id=byproduct_id,
        category_id=category_id,
        include_void=include_void,
        include_deleted=include_deleted,
        group_by=group_by or "day",
        search=search,
    )
    return build_report(db, filters)


def get_monthly_report(
    db: Session,
    year: int,
    month: int,
    *,
    customer_id: UUID | None = None,
    byproduct_id: UUID | None = None,
    category_id: UUID | None = None,
    include_void: bool = False,
    include_deleted: bool = False,
    group_by: str | None = None,
    search: str | None = None,
) -> ByproductReportResponse:
    if month < 1 or month > 12:
        raise _http_400("month must be between 1 and 12")

    date_from = _start_of_month(year, month)
    date_to = _end_of_month(year, month)

    filters = ByproductReportFilter(
        report_type="monthly",
        date_from=date_from,
        date_to=date_to,
        customer_id=customer_id,
        byproduct_id=byproduct_id,
        category_id=category_id,
        include_void=include_void,
        include_deleted=include_deleted,
        group_by=group_by or "day",
        search=search,
    )
    return build_report(db, filters)


def get_custom_period_report(
    db: Session,
    date_from: date,
    date_to: date,
    *,
    customer_id: UUID | None = None,
    byproduct_id: UUID | None = None,
    category_id: UUID | None = None,
    include_void: bool = False,
    include_deleted: bool = False,
    group_by: str | None = None,
    search: str | None = None,
) -> ByproductReportResponse:
    filters = ByproductReportFilter(
        report_type="custom_period",
        date_from=date_from,
        date_to=date_to,
        customer_id=customer_id,
        byproduct_id=byproduct_id,
        category_id=category_id,
        include_void=include_void,
        include_deleted=include_deleted,
        group_by=group_by or "day",
        search=search,
    )
    return build_report(db, filters)


def get_accumulation_report(
    db: Session,
    date_from: date,
    date_to: date,
    *,
    customer_id: UUID | None = None,
    byproduct_id: UUID | None = None,
    category_id: UUID | None = None,
    include_void: bool = False,
    include_deleted: bool = False,
    group_by: str | None = None,
    search: str | None = None,
) -> ByproductReportResponse:
    filters = ByproductReportFilter(
        report_type="accumulation",
        date_from=date_from,
        date_to=date_to,
        customer_id=customer_id,
        byproduct_id=byproduct_id,
        category_id=category_id,
        include_void=include_void,
        include_deleted=include_deleted,
        group_by=group_by or "month",
        search=search,
    )
    return build_report(db, filters)


# =============================================================================
# TREND / COMPARISON SERVICES
# =============================================================================


def get_trend_report(
    db: Session,
    filters: ByproductReportFilter,
    *,
    interval: str | None = None,
) -> ByproductTrendResponse:
    _validate_date_range(filters.date_from, filters.date_to)

    prepared_rows = _fetch_prepared_rows(db, filters)
    interval = interval or _determine_default_group_by(filters.report_type) or "day"

    if interval not in {"day", "week", "month"}:
        raise _http_400("Trend interval must be one of: day, week, month")

    buckets: dict[str, dict] = {}

    for row in prepared_rows:
        key, label = _build_trend_key_and_label(row.sale_date, interval)

        if key not in buckets:
            buckets[key] = {
                "period_key": key,
                "period_label": label,
                "quantity_total": Decimal("0"),
                "amount_total": Decimal("0.00"),
                "sale_ids": set(),
            }

        bucket = buckets[key]
        bucket["quantity_total"] += _qty(row.quantity)
        bucket["amount_total"] += _money(row.line_total)

        if row.sale_id:
            bucket["sale_ids"].add(str(row.sale_id))

    points = [
        ByproductTrendPoint(
            period_key=bucket["period_key"],
            period_label=bucket["period_label"],
            quantity_total=_qty(bucket["quantity_total"]),
            amount_total=_money(bucket["amount_total"]),
            transaction_count=len(bucket["sale_ids"]),
        )
        for bucket in buckets.values()
    ]
    points.sort(key=lambda x: x.period_key)

    totals = _build_totals(prepared_rows)
    return ByproductTrendResponse(filters=filters, points=points, totals=totals)


def get_previous_period_filters(filters: ByproductReportFilter) -> ByproductReportFilter:
    _validate_date_range(filters.date_from, filters.date_to)

    duration_days = (filters.date_to - filters.date_from).days + 1
    previous_to = filters.date_from - timedelta(days=1)
    previous_from = previous_to - timedelta(days=duration_days - 1)

    return ByproductReportFilter(
        report_type=filters.report_type,
        date_from=previous_from,
        date_to=previous_to,
        customer_id=filters.customer_id,
        byproduct_id=filters.byproduct_id,
        category_id=filters.category_id,
        include_void=filters.include_void,
        include_deleted=filters.include_deleted,
        group_by=filters.group_by,
        search=filters.search,
    )


def compare_with_previous_period(
    db: Session,
    filters: ByproductReportFilter,
) -> dict:
    current_report = build_report(db, filters)
    previous_filters = get_previous_period_filters(filters)
    previous_report = build_report(db, previous_filters)

    return {
        "current": current_report,
        "previous": previous_report,
        "difference": {
            "quantity": _format_number_with_commas(
                _qty(
                    current_report.totals.total_quantity
                    - previous_report.totals.total_quantity
                )
            ),
            "amount": _format_number_with_commas(
                _money(
                    current_report.totals.total_amount
                    - previous_report.totals.total_amount
                )
            ),
            "transactions": _format_number_with_commas(
                current_report.totals.transaction_count
                - previous_report.totals.transaction_count
            ),
            "customers": _format_number_with_commas(
                current_report.totals.customer_count
                - previous_report.totals.customer_count
            ),
            "byproducts": _format_number_with_commas(
                current_report.totals.byproduct_count
                - previous_report.totals.byproduct_count
            ),
        },
    }


# =============================================================================
# DASHBOARD / QUICK ANALYTICS
# =============================================================================


def get_dashboard_summary(
    db: Session,
    *,
    date_from: date,
    date_to: date,
) -> ByproductDashboardResponse:
    filters = ByproductReportFilter(
        report_type="custom_period",
        date_from=date_from,
        date_to=date_to,
        group_by="day",
    )

    prepared_rows = _fetch_prepared_rows(db, filters)
    totals = _build_totals(prepared_rows)

    customer_groups = _build_grouped_rows(prepared_rows, group_by="customer")[:5]
    byproduct_groups = _build_grouped_rows(prepared_rows, group_by="byproduct")[:5]
    trend = get_trend_report(db, filters, interval="day").points

    average_sale_value = Decimal("0.00")
    if totals.transaction_count > 0:
        average_sale_value = _money(
            totals.total_amount / Decimal(str(totals.transaction_count))
        )

    cards = [
        ByproductDashboardCard(
            title="Total Revenue",
            value=_money(totals.total_amount),
            subtitle=f"{date_from.isoformat()} to {date_to.isoformat()}",
        ),
        ByproductDashboardCard(
            title="Total Quantity",
            value=_qty(totals.total_quantity),
            subtitle="Sum of sold byproduct quantities",
        ),
        ByproductDashboardCard(
            title="Transactions",
            value=totals.transaction_count,
            subtitle="Distinct posted sales in period",
        ),
        ByproductDashboardCard(
            title="Customers",
            value=totals.customer_count,
            subtitle="Distinct customers served",
        ),
        ByproductDashboardCard(
            title="Byproducts",
            value=totals.byproduct_count,
            subtitle="Distinct byproducts sold",
        ),
        ByproductDashboardCard(
            title="Average Sale Value",
            value=average_sale_value,
            subtitle="Average per transaction",
        ),
    ]

    return ByproductDashboardResponse(
        date_from=date_from,
        date_to=date_to,
        cards=cards,
        top_customers=customer_groups,
        top_byproducts=byproduct_groups,
        trend=trend,
    )


# =============================================================================
# TEMPLATE CONTEXT HELPERS
# =============================================================================


def build_template_context(
    db: Session,
    filters: ByproductReportFilter,
    *,
    company_name: str | None = None,
    company_address: str | None = None,
    company_phone: str | None = None,
    report_title: str | None = None,
) -> dict:
    report = build_report(db, filters)
    context_rows = _build_context_rows(report)
    table_total_row = _build_table_total_row(report)
    selected_customer_name = _resolve_selected_customer_name(
        _fetch_prepared_rows(db, filters),
        filters,
    )

    grouped_rows = []
    for item in report.grouped_rows:
        grouped_rows.append(
            {
                "group_key": item.group_key,
                "group_label": item.group_label,
                "quantity_total": _format_number_with_commas(item.quantity_total),
                "amount_total": _format_number_with_commas(item.amount_total),
                "average_unit_price": (
                    _format_number_with_commas(item.average_unit_price)
                    if item.average_unit_price is not None
                    else None
                ),
                "transaction_count": item.transaction_count,
            }
        )

    return {
        "company_name": company_name,
        "company_address": company_address,
        "company_phone": company_phone,
        "report_title": report_title
        or report.period.report_type.replace("_", " ").title(),
        "report_type": report.period.report_type,
        "report_date_from": report.period.date_from.strftime("%d %B %Y"),
        "report_date_to": report.period.date_to.strftime("%d %B %Y"),
        "generated_at": report.period.generated_at.strftime("%d %B %Y %H:%M:%S"),
        "is_single_customer_report": bool(filters.customer_id),
        "selected_customer_id": str(filters.customer_id) if filters.customer_id else None,
        "selected_customer_name": selected_customer_name,
        "report_scope_label": selected_customer_name or "All Customers",
        "show_top_totals_table": False,
        "show_customer_summary": False,
        "show_total_footer_row": True,
        "rows": context_rows,
        "table_total_row": table_total_row,
        "table_rows_with_total": [*context_rows, table_total_row],
        "grouped_rows": grouped_rows,
        "totals": {
            "total_quantity": _format_number_with_commas(report.totals.total_quantity),
            "subtotal_amount": _format_number_with_commas(report.totals.subtotal_amount),
            "discount_amount": _format_number_with_commas(report.totals.discount_amount),
            "adjustment_amount": _format_number_with_commas(report.totals.adjustment_amount),
            "total_amount": _format_number_with_commas(report.totals.total_amount),
            "amount_paid": _format_number_with_commas(report.totals.amount_paid),
            "balance_due": _format_number_with_commas(report.totals.balance_due),
            "transaction_count": report.totals.transaction_count,
            "line_count": report.totals.line_count,
            "customer_count": report.totals.customer_count,
            "byproduct_count": report.totals.byproduct_count,
        },
    }


# =============================================================================
# SPECIALIZED QUICK REPORT HELPERS
# =============================================================================


def get_customer_summary(
    db: Session,
    *,
    date_from: date,
    date_to: date,
    customer_id: UUID | None = None,
) -> list[ByproductGroupedReportRow]:
    filters = ByproductReportFilter(
        report_type="custom_period",
        date_from=date_from,
        date_to=date_to,
        customer_id=customer_id,
        group_by="customer",
    )
    report = build_report(db, filters)
    return report.grouped_rows


def get_byproduct_summary(
    db: Session,
    *,
    date_from: date,
    date_to: date,
    category_id: UUID | None = None,
    byproduct_id: UUID | None = None,
) -> list[ByproductGroupedReportRow]:
    filters = ByproductReportFilter(
        report_type="custom_period",
        date_from=date_from,
        date_to=date_to,
        category_id=category_id,
        byproduct_id=byproduct_id,
        group_by="byproduct",
    )
    report = build_report(db, filters)
    return report.grouped_rows


def get_category_summary(
    db: Session,
    *,
    date_from: date,
    date_to: date,
) -> list[ByproductGroupedReportRow]:
    filters = ByproductReportFilter(
        report_type="custom_period",
        date_from=date_from,
        date_to=date_to,
        group_by="category",
    )
    report = build_report(db, filters)
    return report.grouped_rows