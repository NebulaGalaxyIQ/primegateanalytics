from __future__ import annotations

from calendar import month_name, monthrange
from datetime import date, datetime
from decimal import Decimal, ROUND_HALF_UP
from typing import Iterable, List, Optional, Union

from sqlalchemy import and_, or_
from sqlalchemy.orm import Session

from app.models.order import Order
from app.schemas.breakeven_report import (
    BreakevenSummaryReportData,
    BreakevenSummaryReportRequest,
)
from app.schemas.report import (
    AnimalProjectionBlock,
    AnimalProjectionRow,
    FrozenContainersMonthlyReportData,
    FrozenContainersMonthlyReportRequest,
    FrozenContainersMonthlyTotals,
    FrozenContainersReportRow,
    OrdersMonthlyReportData,
    OrdersMonthlyReportRequest,
    OrdersMonthlySummary,
    OrdersMonthlyTotals,
    OrdersReportRow,
    OrdersReportSection,
    ReportRequestBase,
)
from app.services.breakeven_report_service import breakeven_report_service

ORGANIZATION_NAME = "Union Meat Group"
DEFAULT_BREAKEVEN_QUANTITY_KG = Decimal("133700.00")

DECIMAL_ZERO = Decimal("0.00")
TWO_PLACES = Decimal("0.01")
FOUR_PLACES = Decimal("0.0001")


# =============================================================================
# Core helpers
# =============================================================================
def decimal_zero() -> Decimal:
    return DECIMAL_ZERO


def normalize_text(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    value = value.strip()
    return value or None


def quantize_2(value: Union[Decimal, int, float, str, None]) -> Decimal:
    if value is None or value == "":
        return DECIMAL_ZERO
    return Decimal(str(value)).quantize(TWO_PLACES, rounding=ROUND_HALF_UP)


def quantize_4(value: Union[Decimal, int, float, str, None]) -> Decimal:
    if value is None or value == "":
        return Decimal("0.0000")
    return Decimal(str(value)).quantize(FOUR_PLACES, rounding=ROUND_HALF_UP)


def decimal_sum(values: Iterable[Union[Decimal, int, float, str, None]]) -> Decimal:
    total = Decimal("0.00")
    for value in values:
        if value is None or value == "":
            continue
        total += Decimal(str(value))
    return total.quantize(TWO_PLACES, rounding=ROUND_HALF_UP)


def build_month_date_range(month: int, year: int) -> tuple[date, date]:
    start_date = date(year, month, 1)
    end_date = date(year, month, monthrange(year, month)[1])
    return start_date, end_date


def format_month_year(month: int, year: int) -> str:
    return f"{month_name[month].upper()} {year}"


def build_orders_monthly_subtitle(month: int, year: int) -> str:
    return "MONTHLY SUMMARY REPORT"


def build_frozen_containers_monthly_subtitle(month: int, year: int) -> Optional[str]:
    return None


def build_animal_projection_title(month: int, year: int) -> str:
    return f"ANIMAL REQUIREMENTS PROJECTION FOR THE MONTH OF {month_name[month].upper()}"


# =============================================================================
# Business calculations
# =============================================================================
def compute_breakeven_metrics(
    completed_quantity_kg: Decimal,
    breakeven_quantity_kg: Optional[Decimal],
) -> dict:
    """
    Important business rule:
    Only COMPLETED orders count toward breakeven achieved quantities.
    """
    target = quantize_2(
        breakeven_quantity_kg
        if breakeven_quantity_kg is not None
        else DEFAULT_BREAKEVEN_QUANTITY_KG
    )
    achieved_quantity = quantize_2(completed_quantity_kg)

    if target <= DECIMAL_ZERO:
        return {
            "breakeven_quantity_kg": DECIMAL_ZERO,
            "breakeven_achieved_quantity_kg": DECIMAL_ZERO,
            "breakeven_balance_quantity_kg": DECIMAL_ZERO,
            "breakeven_achieved_percentage": DECIMAL_ZERO,
            "breakeven_balance_percentage": DECIMAL_ZERO,
        }

    capped_achieved_quantity = min(achieved_quantity, target).quantize(
        TWO_PLACES,
        rounding=ROUND_HALF_UP,
    )
    balance_quantity = max(target - achieved_quantity, DECIMAL_ZERO).quantize(
        TWO_PLACES,
        rounding=ROUND_HALF_UP,
    )

    achieved_percentage = ((capped_achieved_quantity / target) * Decimal("100")).quantize(
        TWO_PLACES,
        rounding=ROUND_HALF_UP,
    )
    balance_percentage = ((balance_quantity / target) * Decimal("100")).quantize(
        TWO_PLACES,
        rounding=ROUND_HALF_UP,
    )

    return {
        "breakeven_quantity_kg": target,
        "breakeven_achieved_quantity_kg": capped_achieved_quantity,
        "breakeven_balance_quantity_kg": balance_quantity,
        "breakeven_achieved_percentage": achieved_percentage,
        "breakeven_balance_percentage": balance_percentage,
    }


def get_four_week_bucket(day_number: int, last_day_of_month: int) -> int:
    """
    Divide every month into exactly 4 business weeks:
    - Week 1: day 1 to 7
    - Week 2: day 8 to 14
    - Week 3: day 15 to 21
    - Week 4: day 22 to end of month
    """
    if day_number <= 7:
        return 1
    if day_number <= 14:
        return 2
    if day_number <= 21:
        return 3
    return 4


def week_label(week_number: int) -> str:
    labels = {
        1: "1st Week",
        2: "2nd Week",
        3: "3rd Week",
        4: "4th Week",
    }
    return labels.get(week_number, f"Week {week_number}")


def get_projection_anchor_date(order: Order) -> Optional[date]:
    """
    Animal projection is based on slaughter schedule as requested.
    Only slaughter_schedule should decide the week bucket.
    """
    return order.slaughter_schedule


def is_completed_order(order: Order) -> bool:
    return str(order.status or "").strip().lower() == str(Order.STATUS_COMPLETED).strip().lower()


# =============================================================================
# Query builders
# =============================================================================
def build_monthly_scope_query(
    db: Session,
    month: int,
    year: int,
):
    start_date, end_date = build_month_date_range(month, year)

    return db.query(Order).filter(
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


def get_orders_monthly_queryset(
    db: Session,
    request: OrdersMonthlyReportRequest,
):
    query = build_monthly_scope_query(db, request.month, request.year)

    if request.order_type:
        query = query.filter(Order.order_type == request.order_type)

    if request.order_profile:
        query = query.filter(Order.order_profile == request.order_profile)

    if request.order_subtype:
        query = query.filter(Order.order_subtype == request.order_subtype)

    if request.status:
        query = query.filter(Order.status == request.status)

    if request.enterprise_name:
        query = query.filter(Order.enterprise_name.ilike(f"%{request.enterprise_name}%"))

    if request.jurisdiction:
        query = query.filter(Order.jurisdiction.ilike(f"%{request.jurisdiction}%"))

    return query.order_by(
        Order.report_year.asc().nullslast(),
        Order.report_month.asc().nullslast(),
        Order.slaughter_schedule.asc().nullslast(),
        Order.expected_delivery.asc().nullslast(),
        Order.container_gate_in.asc().nullslast(),
        Order.departure_date.asc().nullslast(),
        Order.id.asc(),
    )


def get_orders_monthly(
    db: Session,
    request: OrdersMonthlyReportRequest,
) -> List[Order]:
    return get_orders_monthly_queryset(db, request).all()


def get_frozen_containers_monthly_queryset(
    db: Session,
    request: FrozenContainersMonthlyReportRequest,
):
    query = build_monthly_scope_query(db, request.month, request.year)

    query = query.filter(Order.order_profile == Order.ORDER_PROFILE_FROZEN_CONTAINER)
    query = query.filter(Order.order_type == Order.ORDER_TYPE_FROZEN)

    if request.status:
        query = query.filter(Order.status == request.status)

    if request.enterprise_name:
        query = query.filter(Order.enterprise_name.ilike(f"%{request.enterprise_name}%"))

    if request.jurisdiction:
        query = query.filter(Order.jurisdiction.ilike(f"%{request.jurisdiction}%"))

    return query.order_by(
        Order.report_year.asc().nullslast(),
        Order.report_month.asc().nullslast(),
        Order.container_gate_in.asc().nullslast(),
        Order.departure_date.asc().nullslast(),
        Order.id.asc(),
    )


def get_frozen_containers_monthly(
    db: Session,
    request: FrozenContainersMonthlyReportRequest,
) -> List[Order]:
    return get_frozen_containers_monthly_queryset(db, request).all()


# =============================================================================
# Row builders
# =============================================================================
def build_order_row(
    order: Order,
    serial_no: int,
) -> OrdersReportRow:
    return OrdersReportRow(
        serial_no=serial_no,
        order_id=order.id,
        order_number=order.order_number,
        enterprise_name=order.enterprise_name,
        order_type=order.order_type,
        order_profile=order.order_profile,
        order_subtype=order.order_subtype,
        status=order.status,
        order_ratio=order.order_ratio,
        jurisdiction=order.jurisdiction,
        product_summary=order.product_summary,
        total_quantity_kg=quantize_2(order.total_quantity_kg),
        total_pieces_required=int(order.total_pieces_required or 0),
        total_animals_required=int(order.total_animals_required or 0),
        goat_quantity_kg=quantize_2(order.goat_quantity_kg),
        goat_pieces_required=int(order.goat_pieces_required or 0),
        goats_required=int(order.goats_required or 0),
        sheep_quantity_kg=quantize_2(order.sheep_quantity_kg),
        sheep_pieces_required=int(order.sheep_pieces_required or 0),
        sheep_required=int(order.sheep_required or 0),
        cattle_quantity_kg=quantize_2(order.cattle_quantity_kg),
        cattle_pieces_required=int(order.cattle_pieces_required or 0),
        cattle_required=int(order.cattle_required or 0),
        shipment_value_usd=(
            quantize_2(order.shipment_value_usd)
            if order.shipment_value_usd is not None
            else None
        ),
        price_per_kg_usd=(
            quantize_4(order.price_per_kg_usd)
            if order.price_per_kg_usd is not None
            else None
        ),
        amount_paid_usd=(
            quantize_2(order.amount_paid_usd)
            if order.amount_paid_usd is not None
            else None
        ),
        balance_usd=quantize_2(order.balance_usd) if order.balance_usd is not None else None,
        slaughter_schedule=order.slaughter_schedule,
        expected_delivery=order.expected_delivery,
        container_gate_in=order.container_gate_in,
        departure_date=order.departure_date,
        notes=order.notes,
    )


def build_frozen_container_row(
    order: Order,
    serial_no: int,
) -> FrozenContainersReportRow:
    return FrozenContainersReportRow(
        serial_no=serial_no,
        order_id=order.id,
        order_number=order.order_number,
        client_name=order.enterprise_name,
        order_ratio=order.order_ratio,
        status=order.status,
        container_value_usd=(
            quantize_2(order.shipment_value_usd)
            if order.shipment_value_usd is not None
            else None
        ),
        price_per_kg_usd=(
            quantize_4(order.price_per_kg_usd)
            if order.price_per_kg_usd is not None
            else None
        ),
        down_payment_usd=(
            quantize_2(order.amount_paid_usd)
            if order.amount_paid_usd is not None
            else None
        ),
        balance_usd=quantize_2(order.balance_usd) if order.balance_usd is not None else None,
        container_gate_in=order.container_gate_in,
        departure_date=order.departure_date,
        jurisdiction=order.jurisdiction,
        total_quantity_kg=quantize_2(order.total_quantity_kg),
        total_pieces_required=int(order.total_pieces_required or 0),
    )


# =============================================================================
# Orders report assembly helpers
# =============================================================================
def build_section(
    section_key: str,
    section_title: str,
    rows: List[OrdersReportRow],
) -> OrdersReportSection:
    return OrdersReportSection(
        section_key=section_key,
        section_title=section_title,
        total_orders=len(rows),
        total_quantity_kg=decimal_sum(row.total_quantity_kg for row in rows),
        total_pieces_required=sum(int(row.total_pieces_required or 0) for row in rows),
        total_animals_required=sum(int(row.total_animals_required or 0) for row in rows),
        total_shipment_value_usd=decimal_sum(row.shipment_value_usd for row in rows),
        total_amount_paid_usd=decimal_sum(row.amount_paid_usd for row in rows),
        total_balance_usd=decimal_sum(row.balance_usd for row in rows),
        rows=rows,
    )


def build_section_rows(orders: List[Order]) -> List[OrdersReportRow]:
    return [build_order_row(order, serial_no=index) for index, order in enumerate(orders, start=1)]


def partition_orders_by_type(orders: List[Order]) -> tuple[List[Order], List[Order], List[Order]]:
    local_orders: List[Order] = []
    chilled_orders: List[Order] = []
    frozen_orders: List[Order] = []

    for order in orders:
        if order.order_type == Order.ORDER_TYPE_LOCAL:
            local_orders.append(order)
        elif order.order_type == Order.ORDER_TYPE_CHILLED:
            chilled_orders.append(order)
        elif order.order_type == Order.ORDER_TYPE_FROZEN:
            frozen_orders.append(order)

    return local_orders, chilled_orders, frozen_orders


def build_sections_from_orders(orders: List[Order]) -> List[OrdersReportSection]:
    local_orders, chilled_orders, frozen_orders = partition_orders_by_type(orders)
    sections: List[OrdersReportSection] = []

    if local_orders:
        sections.append(
            build_section(
                section_key="local",
                section_title="LOCAL & SPECIAL CUTS ORDERS",
                rows=build_section_rows(local_orders),
            )
        )

    if chilled_orders:
        sections.append(
            build_section(
                section_key="chilled",
                section_title="CHILLED ORDERS",
                rows=build_section_rows(chilled_orders),
            )
        )

    if frozen_orders:
        sections.append(
            build_section(
                section_key="frozen",
                section_title="FROZEN ORDERS",
                rows=build_section_rows(frozen_orders),
            )
        )

    return sections


def build_monthly_summary(
    orders: List[Order],
    breakeven_quantity_kg: Optional[Decimal] = None,
) -> OrdersMonthlySummary:
    local_orders, chilled_orders, frozen_orders = partition_orders_by_type(orders)
    completed_orders = [order for order in orders if is_completed_order(order)]

    total_quantity_kg = decimal_sum(order.total_quantity_kg for order in orders)
    completed_quantity_kg = decimal_sum(order.total_quantity_kg for order in completed_orders)

    breakeven = compute_breakeven_metrics(
        completed_quantity_kg=completed_quantity_kg,
        breakeven_quantity_kg=breakeven_quantity_kg,
    )

    return OrdersMonthlySummary(
        total_orders=len(orders),
        total_quantity_kg=total_quantity_kg,
        total_pieces_required=sum(int(order.total_pieces_required or 0) for order in orders),
        total_animals_required=sum(int(order.total_animals_required or 0) for order in orders),
        total_shipment_value_usd=decimal_sum(order.shipment_value_usd for order in orders),
        total_amount_paid_usd=decimal_sum(order.amount_paid_usd for order in orders),
        total_balance_usd=decimal_sum(order.balance_usd for order in orders),
        breakeven_quantity_kg=breakeven["breakeven_quantity_kg"],
        breakeven_achieved_quantity_kg=breakeven["breakeven_achieved_quantity_kg"],
        breakeven_balance_quantity_kg=breakeven["breakeven_balance_quantity_kg"],
        breakeven_achieved_percentage=breakeven["breakeven_achieved_percentage"],
        breakeven_balance_percentage=breakeven["breakeven_balance_percentage"],
        local_total_orders=len(local_orders),
        local_total_quantity_kg=decimal_sum(order.total_quantity_kg for order in local_orders),
        local_total_pieces_required=sum(int(order.total_pieces_required or 0) for order in local_orders),
        local_total_animals_required=sum(int(order.total_animals_required or 0) for order in local_orders),
        chilled_total_orders=len(chilled_orders),
        chilled_total_quantity_kg=decimal_sum(order.total_quantity_kg for order in chilled_orders),
        chilled_total_pieces_required=sum(int(order.total_pieces_required or 0) for order in chilled_orders),
        chilled_total_animals_required=sum(int(order.total_animals_required or 0) for order in chilled_orders),
        frozen_total_orders=len(frozen_orders),
        frozen_total_quantity_kg=decimal_sum(order.total_quantity_kg for order in frozen_orders),
        frozen_total_pieces_required=sum(int(order.total_pieces_required or 0) for order in frozen_orders),
        frozen_total_animals_required=sum(int(order.total_animals_required or 0) for order in frozen_orders),
    )


def build_monthly_totals(orders: List[Order]) -> OrdersMonthlyTotals:
    return OrdersMonthlyTotals(
        total_orders=len(orders),
        total_quantity_kg=decimal_sum(order.total_quantity_kg for order in orders),
        total_pieces_required=sum(int(order.total_pieces_required or 0) for order in orders),
        total_animals_required=sum(int(order.total_animals_required or 0) for order in orders),
        total_shipment_value_usd=decimal_sum(order.shipment_value_usd for order in orders),
        total_amount_paid_usd=decimal_sum(order.amount_paid_usd for order in orders),
        total_balance_usd=decimal_sum(order.balance_usd for order in orders),
    )


def build_animal_projection(
    orders: List[Order],
    month: int,
    year: int,
) -> AnimalProjectionBlock:
    """
    Requirements from user:
    - Always show exactly 4 weeks in every month.
    - Use slaughter_schedule to place animals into weeks.
    - If a week has no animals, show zeros.
    - Week buckets:
        1st Week = days 1-7
        2nd Week = days 8-14
        3rd Week = days 15-21
        4th Week = days 22-end of month
    """
    _, month_end_date = build_month_date_range(month, year)
    last_day_of_month = month_end_date.day

    weekly_buckets: dict[int, dict[str, int]] = {
        1: {"goats": 0, "sheep": 0, "cattle": 0},
        2: {"goats": 0, "sheep": 0, "cattle": 0},
        3: {"goats": 0, "sheep": 0, "cattle": 0},
        4: {"goats": 0, "sheep": 0, "cattle": 0},
    }

    for order in orders:
        anchor_date = get_projection_anchor_date(order)
        if not anchor_date:
            continue

        if anchor_date.month != month or anchor_date.year != year:
            continue

        bucket_number = get_four_week_bucket(anchor_date.day, last_day_of_month)

        weekly_buckets[bucket_number]["goats"] += int(order.goats_required or 0)
        weekly_buckets[bucket_number]["sheep"] += int(order.sheep_required or 0)
        weekly_buckets[bucket_number]["cattle"] += int(order.cattle_required or 0)

    rows: List[AnimalProjectionRow] = []
    for bucket_number in (1, 2, 3, 4):
        bucket = weekly_buckets[bucket_number]
        rows.append(
            AnimalProjectionRow(
                label=week_label(bucket_number),
                goats=int(bucket["goats"] or 0),
                sheep=int(bucket["sheep"] or 0),
                cattle=int(bucket["cattle"] or 0),
            )
        )

    return AnimalProjectionBlock(
        title=build_animal_projection_title(month, year),
        rows=rows,
    )


# =============================================================================
# Frozen containers report assembly
# =============================================================================
def build_frozen_containers_totals(orders: List[Order]) -> FrozenContainersMonthlyTotals:
    return FrozenContainersMonthlyTotals(
        total_orders=len(orders),
        total_quantity_kg=decimal_sum(order.total_quantity_kg for order in orders),
        total_pieces_required=sum(int(order.total_pieces_required or 0) for order in orders),
        total_container_value_usd=decimal_sum(order.shipment_value_usd for order in orders),
        total_down_payment_usd=decimal_sum(order.amount_paid_usd for order in orders),
        total_balance_usd=decimal_sum(order.balance_usd for order in orders),
    )


def build_frozen_container_rows(orders: List[Order]) -> List[FrozenContainersReportRow]:
    return [
        build_frozen_container_row(order, serial_no=index)
        for index, order in enumerate(orders, start=1)
    ]


# =============================================================================
# Public report builders
# =============================================================================
def build_orders_monthly_report_data(
    db: Session,
    request: OrdersMonthlyReportRequest,
) -> OrdersMonthlyReportData:
    orders = get_orders_monthly(db=db, request=request)

    effective_breakeven = (
        request.breakeven_quantity_kg
        if request.breakeven_quantity_kg is not None
        else DEFAULT_BREAKEVEN_QUANTITY_KG
    )

    summary = (
        build_monthly_summary(
            orders=orders,
            breakeven_quantity_kg=effective_breakeven,
        )
        if request.include_summary
        else None
    )

    sections = build_sections_from_orders(orders) if request.include_sections else []
    totals = build_monthly_totals(orders) if request.include_totals else None
    animal_projection = (
        build_animal_projection(
            orders=orders,
            month=request.month,
            year=request.year,
        )
        if request.include_animal_projection
        else None
    )

    prepared_by = normalize_text(request.prepared_by)

    return OrdersMonthlyReportData(
        report_type="orders_monthly",
        title="ORDER CONFIRMATION REPORT",
        subtitle=build_orders_monthly_subtitle(request.month, request.year),
        organization_name=ORGANIZATION_NAME,
        prepared_by=prepared_by,
        generated_at=datetime.utcnow(),
        month=request.month,
        year=request.year,
        filters_order_type=request.order_type,
        filters_order_profile=request.order_profile,
        filters_order_subtype=request.order_subtype,
        filters_status=request.status,
        filters_enterprise_name=request.enterprise_name,
        filters_jurisdiction=request.jurisdiction,
        summary=summary,
        sections=sections,
        totals=totals,
        animal_projection=animal_projection,
    )


def build_frozen_containers_monthly_report_data(
    db: Session,
    request: FrozenContainersMonthlyReportRequest,
) -> FrozenContainersMonthlyReportData:
    orders = get_frozen_containers_monthly(db=db, request=request)

    rows = build_frozen_container_rows(orders) if request.include_rows else []
    totals = build_frozen_containers_totals(orders) if request.include_totals else None
    prepared_by = normalize_text(request.prepared_by)

    return FrozenContainersMonthlyReportData(
        report_type="frozen_containers_monthly",
        title="FROZEN CONFIRMED CONTAINERS",
        subtitle=build_frozen_containers_monthly_subtitle(request.month, request.year),
        organization_name=ORGANIZATION_NAME,
        prepared_by=prepared_by,
        generated_at=datetime.utcnow(),
        month=request.month,
        year=request.year,
        filters_status=request.status,
        filters_enterprise_name=request.enterprise_name,
        filters_jurisdiction=request.jurisdiction,
        summary=None,
        rows=rows,
        totals=totals,
    )


def build_breakeven_summary_report_data(
    db: Session,
    request: BreakevenSummaryReportRequest,
) -> BreakevenSummaryReportData:
    """
    Important behavior:
    This report is always computed live from Orders through the breakeven service.
    That means it automatically reflects the latest order bookings/completions
    every time the report is requested.
    """
    return breakeven_report_service.build_breakeven_summary_report(db, request)


def build_report_data(
    db: Session,
    request: Union[ReportRequestBase, BreakevenSummaryReportRequest],
):
    if request.report_type == "orders_monthly":
        if not isinstance(request, OrdersMonthlyReportRequest):
            request = OrdersMonthlyReportRequest(**request.model_dump())
        return build_orders_monthly_report_data(db=db, request=request)

    if request.report_type == "frozen_containers_monthly":
        if not isinstance(request, FrozenContainersMonthlyReportRequest):
            request = FrozenContainersMonthlyReportRequest(**request.model_dump())
        return build_frozen_containers_monthly_report_data(db=db, request=request)

    if request.report_type == "breakeven_summary":
        if not isinstance(request, BreakevenSummaryReportRequest):
            request = BreakevenSummaryReportRequest(**request.model_dump())
        return build_breakeven_summary_report_data(db=db, request=request)

    raise ValueError(f"Unsupported report type: {request.report_type}")


def build_default_report_filename(
    report_type: str,
    report_format: str,
    month: Optional[int] = None,
    year: Optional[int] = None,
) -> str:
    safe_format = (report_format or "pdf").strip().lower()
    today_str = date.today().strftime("%Y%m%d")

    report_key = (report_type or "report").strip().lower()
    report_key = report_key.replace("-", "_").replace(" ", "_")

    if report_key == "orders_monthly":
        title = "Order Confirmed Report"
    elif report_key == "frozen_containers_monthly":
        title = "Frozen Confirmed Containers"
    elif report_key == "breakeven_summary":
        title = "Breakeven Summary Report"
    else:
        title = "Report"

    return f"{title} {today_str}.{safe_format}"