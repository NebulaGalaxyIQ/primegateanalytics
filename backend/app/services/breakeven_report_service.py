from __future__ import annotations

from calendar import monthrange
from datetime import date, datetime
from decimal import Decimal, ROUND_HALF_UP
from typing import Iterable, List, Optional, Union
from uuid import UUID, uuid4

from fastapi import HTTPException, status
from sqlalchemy import and_, or_
from sqlalchemy.orm import Session

from app.models.breakeven_setting import (
    DEFAULT_BREAK_EVEN_QUANTITY_TONNES,
    DEFAULT_BREAK_EVEN_USD_PER_TONNE,
    BreakevenSetting,
)
from app.models.order import Order
from app.schemas.breakeven_report import (
    BreakevenSettingCreate,
    BreakevenSettingRead,
    BreakevenSettingUpdate,
    BreakevenSummaryReportData,
    BreakevenSummaryReportRequest,
    BreakevenSummaryRow,
    BreakevenSummaryTotals,
)

DECIMAL_ZERO_2 = Decimal("0.00")
DECIMAL_ZERO_4 = Decimal("0.0000")
TWO_PLACES = Decimal("0.01")
FOUR_PLACES = Decimal("0.0001")
THOUSAND = Decimal("1000")


# =============================================================================
# Core helpers
# =============================================================================
def normalize_text(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    value = value.strip()
    return value or None


def quantize_2(value: Union[Decimal, int, float, str, None]) -> Decimal:
    if value is None or value == "":
        return DECIMAL_ZERO_2
    return Decimal(str(value)).quantize(TWO_PLACES, rounding=ROUND_HALF_UP)


def quantize_4(value: Union[Decimal, int, float, str, None]) -> Decimal:
    if value is None or value == "":
        return DECIMAL_ZERO_4
    return Decimal(str(value)).quantize(FOUR_PLACES, rounding=ROUND_HALF_UP)


def decimal_sum(values: Iterable[Union[Decimal, int, float, str, None]]) -> Decimal:
    total = Decimal("0.00")
    for value in values:
        if value is None or value == "":
            continue
        total += Decimal(str(value))
    return total.quantize(TWO_PLACES, rounding=ROUND_HALF_UP)


def kg_to_tonnes(value_kg: Union[Decimal, int, float, str, None]) -> Decimal:
    if value_kg is None or value_kg == "":
        return DECIMAL_ZERO_2
    try:
        return (Decimal(str(value_kg)) / THOUSAND).quantize(TWO_PLACES, rounding=ROUND_HALF_UP)
    except Exception:
        return DECIMAL_ZERO_2


def format_tonnes(value: Union[Decimal, int, float, str, None]) -> str:
    return f"{quantize_2(value):,.2f}"


def format_money(value: Union[Decimal, int, float, str, None]) -> str:
    return f"{quantize_2(value):,.2f}"


def format_percentage(value: Union[Decimal, int, float, str, None]) -> str:
    return f"{quantize_2(value):,.2f}%"


def compute_percentage(numerator: Decimal, denominator: Decimal) -> Decimal:
    numerator = quantize_2(numerator)
    denominator = quantize_2(denominator)

    if denominator <= DECIMAL_ZERO_2:
        return DECIMAL_ZERO_2

    return ((numerator / denominator) * Decimal("100")).quantize(
        TWO_PLACES,
        rounding=ROUND_HALF_UP,
    )


def build_month_date_range(month: int, year: int) -> tuple[date, date]:
    start_date = date(year, month, 1)
    end_date = date(year, month, monthrange(year, month)[1])
    return start_date, end_date


def build_runtime_default_setting(
    month: Optional[int] = None,
    year: Optional[int] = None,
) -> BreakevenSetting:
    setting = BreakevenSetting(
        setting_name="Default Breakeven Setting",
        description="Runtime default breakeven setting",
        scope_type="monthly" if month is not None and year is not None else "global",
        month=month if month is not None and year is not None else None,
        year=year if month is not None and year is not None else None,
        break_even_quantity_tonnes=DEFAULT_BREAK_EVEN_QUANTITY_TONNES,
        break_even_usd_per_tonne=DEFAULT_BREAK_EVEN_USD_PER_TONNE,
        notes=None,
        is_active=True,
    )
    setting.prepare_for_save()
    return setting


# =============================================================================
# Service
# =============================================================================
class BreakevenReportService:
    """
    Breakeven behavior:
    - The breakeven basis is MONTHLY.
    - The report can be downloaded ANY DAY.
    - Each daily download reflects the current state of orders for that month.
    - A new month starts a fresh breakeven cycle automatically.
    - Monthly settings are applied per month/year; if no monthly setting exists,
      a global setting is used; if that also does not exist, a runtime default is used.
    """

    model = BreakevenSetting

    # -------------------------------------------------------------------------
    # Internal helpers
    # -------------------------------------------------------------------------
    def _normalize_uuid(self, value: Union[str, UUID]) -> UUID:
        if isinstance(value, UUID):
            return value
        try:
            return UUID(str(value))
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Invalid breakeven setting ID.",
            ) from exc

    def _get_or_404(self, db: Session, setting_id: Union[str, UUID]) -> BreakevenSetting:
        record = db.get(self.model, self._normalize_uuid(setting_id))
        if not record:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Breakeven setting not found.",
            )
        return record

    def _resolve_period(
        self,
        request: BreakevenSummaryReportRequest,
    ) -> tuple[int, int, date]:
        """
        Daily-download rule:
        - If report_date is provided, use it as the "as of" day.
        - If month/year are omitted, derive them from report_date.
        - If report_date is omitted, default to today.
        """
        as_of_date = request.report_date or date.today()
        month = request.month if request.month is not None else as_of_date.month
        year = request.year if request.year is not None else as_of_date.year
        return month, year, as_of_date

    def _apply_setting_activation_rules(
        self,
        db: Session,
        record: BreakevenSetting,
    ) -> None:
        """
        Business rule:
        - Only one active global setting at a time.
        - Only one active monthly setting for the same month/year at a time.
        """
        if not record.is_active:
            return

        if record.scope_type == "global":
            (
                db.query(self.model)
                .filter(
                    self.model.id != record.id,
                    self.model.scope_type == "global",
                    self.model.is_active.is_(True),
                )
                .update({"is_active": False}, synchronize_session=False)
            )
            return

        (
            db.query(self.model)
            .filter(
                self.model.id != record.id,
                self.model.scope_type == "monthly",
                self.model.month == record.month,
                self.model.year == record.year,
                self.model.is_active.is_(True),
            )
            .update({"is_active": False}, synchronize_session=False)
        )

    def _base_orders_query(self, db: Session):
        return db.query(Order)

    def _build_monthly_orders_scope_query(
        self,
        db: Session,
        month: int,
        year: int,
    ):
        """
        Monthly scope rule:
        The report is monthly and resets automatically each new month.
        Orders are selected from the requested month/year only.
        """
        start_date, end_date = build_month_date_range(month, year)

        return self._base_orders_query(db).filter(
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

    def _apply_order_filters(
        self,
        query,
        request: BreakevenSummaryReportRequest,
    ):
        if request.order_type:
            query = query.filter(Order.order_type == request.order_type)

        if request.order_profile:
            query = query.filter(Order.order_profile == request.order_profile)

        if request.order_subtype:
            query = query.filter(Order.order_subtype == request.order_subtype)

        if request.enterprise_name:
            query = query.filter(Order.enterprise_name.ilike(f"%{request.enterprise_name}%"))

        if request.jurisdiction:
            query = query.filter(Order.jurisdiction.ilike(f"%{request.jurisdiction}%"))

        return query

    def _get_booked_orders(
        self,
        db: Session,
        request: BreakevenSummaryReportRequest,
        month: int,
        year: int,
    ) -> List[Order]:
        """
        Booked turnover rule:
        Use the confirmed/booked orders in the selected monthly scope.
        This is recalculated live each time the report is requested.
        """
        query = self._build_monthly_orders_scope_query(db, month, year)
        query = self._apply_order_filters(query, request)

        return query.order_by(
            Order.report_year.asc().nullslast(),
            Order.report_month.asc().nullslast(),
            Order.slaughter_schedule.asc().nullslast(),
            Order.expected_delivery.asc().nullslast(),
            Order.container_gate_in.asc().nullslast(),
            Order.departure_date.asc().nullslast(),
            Order.id.asc(),
        ).all()

    def _is_completed_order(self, order: Order) -> bool:
        return str(order.status or "").strip().lower() == str(Order.STATUS_COMPLETED).strip().lower()

    def _sanitize_setting(
        self,
        record: Optional[BreakevenSetting],
        month: int,
        year: int,
    ) -> Optional[BreakevenSetting]:
        if record is None:
            return None

        try:
            quantity = quantize_2(
                getattr(record, "break_even_quantity_tonnes", None)
                or DEFAULT_BREAK_EVEN_QUANTITY_TONNES
            )
            rate = quantize_4(
                getattr(record, "break_even_usd_per_tonne", None)
                or DEFAULT_BREAK_EVEN_USD_PER_TONNE
            )

            record.break_even_quantity_tonnes = quantity
            record.break_even_usd_per_tonne = rate
            record.break_even_value_usd = quantize_2(quantity * rate)

            scope_type = str(getattr(record, "scope_type", "") or "").strip().lower()
            if scope_type not in {"global", "monthly"}:
                scope_type = "monthly"

            record.scope_type = scope_type

            if record.scope_type == "monthly":
                record.month = getattr(record, "month", None) or month
                record.year = getattr(record, "year", None) or year
            else:
                record.month = None
                record.year = None

            if getattr(record, "is_active", None) is None:
                record.is_active = True

            if not getattr(record, "setting_name", None):
                record.setting_name = "Default Breakeven Setting"

            return record
        except Exception:
            return None

    def _to_setting_read(
        self,
        record: BreakevenSetting,
        month: int,
        year: int,
    ) -> BreakevenSettingRead:
        """
        Converts both persisted settings and runtime fallback settings into a
        read schema safely. This prevents new months with no saved setting from
        crashing the report.
        """
        record_id = getattr(record, "id", None) or uuid4()
        created_at = getattr(record, "created_at", None) or datetime.utcnow()
        updated_at = getattr(record, "updated_at", None) or datetime.utcnow()

        scope_type = str(getattr(record, "scope_type", "") or "monthly").strip().lower()
        if scope_type not in {"global", "monthly"}:
            scope_type = "monthly"

        setting_month = getattr(record, "month", None)
        setting_year = getattr(record, "year", None)

        if scope_type == "monthly":
            setting_month = setting_month or month
            setting_year = setting_year or year
        else:
            setting_month = None
            setting_year = None

        return BreakevenSettingRead(
            id=record_id,
            setting_name=getattr(record, "setting_name", None) or "Default Breakeven Setting",
            description=getattr(record, "description", None),
            scope_type=scope_type,
            month=setting_month,
            year=setting_year,
            break_even_quantity_tonnes=quantize_2(getattr(record, "break_even_quantity_tonnes", None)),
            break_even_usd_per_tonne=quantize_4(getattr(record, "break_even_usd_per_tonne", None)),
            break_even_value_usd=quantize_2(getattr(record, "break_even_value_usd", None)),
            notes=getattr(record, "notes", None),
            is_active=bool(getattr(record, "is_active", True)),
            created_at=created_at,
            updated_at=updated_at,
        )

    def _resolve_setting_for_report(
        self,
        db: Session,
        month: int,
        year: int,
        setting_id: Optional[UUID] = None,
    ) -> BreakevenSetting:
        """
        Setting resolution order:
        1. Explicit setting_id
        2. Active monthly setting for month/year
        3. Active global setting
        4. Safe runtime default

        Important:
        - This must never fail just because a new month has no setting yet.
        - It must always return a valid setting object with recalculated USD value.
        """
        if setting_id is not None:
            explicit_setting = self._get_or_404(db, setting_id)
            sanitized_explicit = self._sanitize_setting(explicit_setting, month, year)
            if sanitized_explicit is not None:
                return sanitized_explicit

        monthly_setting = (
            db.query(self.model)
            .filter(
                self.model.scope_type == "monthly",
                self.model.month == month,
                self.model.year == year,
                self.model.is_active.is_(True),
            )
            .order_by(self.model.updated_at.desc(), self.model.created_at.desc())
            .first()
        )
        sanitized_monthly = self._sanitize_setting(monthly_setting, month, year)
        if sanitized_monthly is not None:
            return sanitized_monthly

        global_setting = (
            db.query(self.model)
            .filter(
                self.model.scope_type == "global",
                self.model.is_active.is_(True),
            )
            .order_by(self.model.updated_at.desc(), self.model.created_at.desc())
            .first()
        )
        sanitized_global = self._sanitize_setting(global_setting, month, year)
        if sanitized_global is not None:
            return sanitized_global

        fallback = build_runtime_default_setting(month=month, year=year)
        fallback.break_even_quantity_tonnes = quantize_2(
            getattr(fallback, "break_even_quantity_tonnes", None)
            or DEFAULT_BREAK_EVEN_QUANTITY_TONNES
        )
        fallback.break_even_usd_per_tonne = quantize_4(
            getattr(fallback, "break_even_usd_per_tonne", None)
            or DEFAULT_BREAK_EVEN_USD_PER_TONNE
        )
        fallback.break_even_value_usd = quantize_2(
            fallback.break_even_quantity_tonnes * fallback.break_even_usd_per_tonne
        )
        fallback.scope_type = "monthly"
        fallback.month = month
        fallback.year = year
        fallback.is_active = True
        fallback.setting_name = getattr(fallback, "setting_name", None) or "Default Breakeven Setting"
        return fallback

    def _build_rows(
        self,
        break_even_quantity_tonnes: Decimal,
        break_even_value_usd: Decimal,
        total_booked_quantity_tonnes: Decimal,
        total_booked_value_usd: Decimal,
        total_delivered_quantity_tonnes: Decimal,
        total_delivered_value_usd: Decimal,
        booked_vs_break_even_percentage: Decimal,
        delivered_vs_break_even_percentage: Decimal,
    ) -> List[BreakevenSummaryRow]:
        """
        The report is daily-downloadable but monthly in basis.
        The rows below always reflect the current month state at download time.
        """
        return [
            BreakevenSummaryRow(
                index=1,
                metric="Break Even Point",
                quantity_tonnes=quantize_2(break_even_quantity_tonnes),
                usd_total=quantize_2(break_even_value_usd),
                quantity_display=format_tonnes(break_even_quantity_tonnes),
                usd_display=format_money(break_even_value_usd),
                percentage_display=None,
            ),
            BreakevenSummaryRow(
                index=2,
                metric="Total Booked Turnover",
                quantity_tonnes=quantize_2(total_booked_quantity_tonnes),
                usd_total=quantize_2(total_booked_value_usd),
                quantity_display=format_tonnes(total_booked_quantity_tonnes),
                usd_display=format_money(total_booked_value_usd),
                percentage_display=None,
            ),
            BreakevenSummaryRow(
                index=3,
                metric="Projected Turnover (Based on Bookings)",
                quantity_tonnes=quantize_2(total_booked_quantity_tonnes),
                usd_total=quantize_2(total_booked_value_usd),
                quantity_display=format_tonnes(total_booked_quantity_tonnes),
                usd_display=format_money(total_booked_value_usd),
                percentage_display=None,
            ),
            BreakevenSummaryRow(
                index=4,
                metric="Total Delivered",
                quantity_tonnes=quantize_2(total_delivered_quantity_tonnes),
                usd_total=quantize_2(total_delivered_value_usd),
                quantity_display=format_tonnes(total_delivered_quantity_tonnes),
                usd_display=format_money(total_delivered_value_usd),
                percentage_display=None,
            ),
            BreakevenSummaryRow(
                index=5,
                metric="Projected Turnover (Based on Delivered)",
                quantity_tonnes=quantize_2(total_delivered_quantity_tonnes),
                usd_total=quantize_2(total_delivered_value_usd),
                quantity_display=format_tonnes(total_delivered_quantity_tonnes),
                usd_display=format_money(total_delivered_value_usd),
                percentage_display=None,
            ),
            BreakevenSummaryRow(
                index=6,
                metric="% Booked vs Breakeven Point",
                quantity_tonnes=None,
                usd_total=None,
                percentage=quantize_2(booked_vs_break_even_percentage),
                quantity_display=format_percentage(booked_vs_break_even_percentage),
                usd_display="-",
                percentage_display=format_percentage(booked_vs_break_even_percentage),
            ),
            BreakevenSummaryRow(
                index=7,
                metric="% Delivered vs Breakeven Point",
                quantity_tonnes=None,
                usd_total=None,
                percentage=quantize_2(delivered_vs_break_even_percentage),
                quantity_display=format_percentage(delivered_vs_break_even_percentage),
                usd_display="-",
                percentage_display=format_percentage(delivered_vs_break_even_percentage),
            ),
        ]

    def _build_totals(
        self,
        break_even_quantity_tonnes: Decimal,
        break_even_value_usd: Decimal,
        total_booked_quantity_tonnes: Decimal,
        total_booked_value_usd: Decimal,
        total_delivered_quantity_tonnes: Decimal,
        total_delivered_value_usd: Decimal,
        booked_vs_break_even_percentage: Decimal,
        delivered_vs_break_even_percentage: Decimal,
    ) -> BreakevenSummaryTotals:
        return BreakevenSummaryTotals(
            break_even_quantity_tonnes=quantize_2(break_even_quantity_tonnes),
            break_even_value_usd=quantize_2(break_even_value_usd),
            total_booked_quantity_tonnes=quantize_2(total_booked_quantity_tonnes),
            total_booked_value_usd=quantize_2(total_booked_value_usd),
            total_delivered_quantity_tonnes=quantize_2(total_delivered_quantity_tonnes),
            total_delivered_value_usd=quantize_2(total_delivered_value_usd),
            booked_vs_break_even_percentage=quantize_2(booked_vs_break_even_percentage),
            delivered_vs_break_even_percentage=quantize_2(delivered_vs_break_even_percentage),
        )

    # -------------------------------------------------------------------------
    # Settings CRUD
    # -------------------------------------------------------------------------
    def create_setting(
        self,
        db: Session,
        payload: BreakevenSettingCreate,
    ) -> BreakevenSettingRead:
        record = self.model(**payload.model_dump())
        record.prepare_for_save()

        db.add(record)
        db.flush()

        self._apply_setting_activation_rules(db, record)

        db.commit()
        db.refresh(record)
        return BreakevenSettingRead.model_validate(record)

    def get_setting(
        self,
        db: Session,
        setting_id: Union[str, UUID],
    ) -> BreakevenSettingRead:
        return BreakevenSettingRead.model_validate(self._get_or_404(db, setting_id))

    def list_settings(
        self,
        db: Session,
        scope_type: Optional[str] = None,
        month: Optional[int] = None,
        year: Optional[int] = None,
        is_active: Optional[bool] = None,
    ) -> List[BreakevenSettingRead]:
        query = db.query(self.model)

        if scope_type:
            query = query.filter(self.model.scope_type == scope_type)

        if month is not None:
            query = query.filter(self.model.month == month)

        if year is not None:
            query = query.filter(self.model.year == year)

        if is_active is not None:
            query = query.filter(self.model.is_active.is_(is_active))

        records = query.order_by(
            self.model.scope_type.asc(),
            self.model.year.desc().nullslast(),
            self.model.month.desc().nullslast(),
            self.model.updated_at.desc(),
            self.model.created_at.desc(),
        ).all()

        return [BreakevenSettingRead.model_validate(item) for item in records]

    def update_setting(
        self,
        db: Session,
        setting_id: Union[str, UUID],
        payload: BreakevenSettingUpdate,
    ) -> BreakevenSettingRead:
        record = self._get_or_404(db, setting_id)

        update_data = payload.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(record, field, value)

        record.prepare_for_save()

        db.add(record)
        db.flush()

        self._apply_setting_activation_rules(db, record)

        db.commit()
        db.refresh(record)
        return BreakevenSettingRead.model_validate(record)

    def activate_setting(
        self,
        db: Session,
        setting_id: Union[str, UUID],
    ) -> BreakevenSettingRead:
        record = self._get_or_404(db, setting_id)
        record.is_active = True
        record.prepare_for_save()

        db.add(record)
        db.flush()

        self._apply_setting_activation_rules(db, record)

        db.commit()
        db.refresh(record)
        return BreakevenSettingRead.model_validate(record)

    def deactivate_setting(
        self,
        db: Session,
        setting_id: Union[str, UUID],
    ) -> BreakevenSettingRead:
        record = self._get_or_404(db, setting_id)
        record.is_active = False

        db.add(record)
        db.commit()
        db.refresh(record)
        return BreakevenSettingRead.model_validate(record)

    # -------------------------------------------------------------------------
    # Report builder
    # -------------------------------------------------------------------------
    def build_breakeven_summary_report(
        self,
        db: Session,
        request: BreakevenSummaryReportRequest,
    ) -> BreakevenSummaryReportData:
        """
        Daily-download rule:
        - User can generate/download the report any day.
        - report_date defaults to today when omitted.
        - month/year are derived from report_date if omitted.
        - totals are recalculated live from Orders every time the report is requested.
        """
        month, year, resolved_report_date = self._resolve_period(request)

        setting = self._resolve_setting_for_report(
            db=db,
            month=month,
            year=year,
            setting_id=request.setting_id,
        )

        break_even_quantity_tonnes = quantize_2(setting.break_even_quantity_tonnes)
        break_even_value_usd = quantize_2(setting.break_even_value_usd)

        booked_orders = self._get_booked_orders(
            db=db,
            request=request,
            month=month,
            year=year,
        )
        delivered_orders = [order for order in booked_orders if self._is_completed_order(order)]

        if booked_orders:
            total_booked_quantity_kg = decimal_sum(order.total_quantity_kg for order in booked_orders)
            total_booked_value_usd = decimal_sum(order.shipment_value_usd for order in booked_orders)
        else:
            total_booked_quantity_kg = DECIMAL_ZERO_2
            total_booked_value_usd = DECIMAL_ZERO_2

        if delivered_orders:
            total_delivered_quantity_kg = decimal_sum(order.total_quantity_kg for order in delivered_orders)
            total_delivered_value_usd = decimal_sum(order.shipment_value_usd for order in delivered_orders)
        else:
            total_delivered_quantity_kg = DECIMAL_ZERO_2
            total_delivered_value_usd = DECIMAL_ZERO_2

        total_booked_quantity_tonnes = kg_to_tonnes(total_booked_quantity_kg)
        total_delivered_quantity_tonnes = kg_to_tonnes(total_delivered_quantity_kg)

        booked_vs_break_even_percentage = compute_percentage(
            total_booked_quantity_tonnes,
            break_even_quantity_tonnes,
        )
        delivered_vs_break_even_percentage = compute_percentage(
            total_delivered_quantity_tonnes,
            break_even_quantity_tonnes,
        )

        totals = self._build_totals(
            break_even_quantity_tonnes=break_even_quantity_tonnes,
            break_even_value_usd=break_even_value_usd,
            total_booked_quantity_tonnes=total_booked_quantity_tonnes,
            total_booked_value_usd=total_booked_value_usd,
            total_delivered_quantity_tonnes=total_delivered_quantity_tonnes,
            total_delivered_value_usd=total_delivered_value_usd,
            booked_vs_break_even_percentage=booked_vs_break_even_percentage,
            delivered_vs_break_even_percentage=delivered_vs_break_even_percentage,
        )

        rows = (
            self._build_rows(
                break_even_quantity_tonnes=break_even_quantity_tonnes,
                break_even_value_usd=break_even_value_usd,
                total_booked_quantity_tonnes=total_booked_quantity_tonnes,
                total_booked_value_usd=total_booked_value_usd,
                total_delivered_quantity_tonnes=total_delivered_quantity_tonnes,
                total_delivered_value_usd=total_delivered_value_usd,
                booked_vs_break_even_percentage=booked_vs_break_even_percentage,
                delivered_vs_break_even_percentage=delivered_vs_break_even_percentage,
            )
            if request.include_rows
            else []
        )

        return BreakevenSummaryReportData(
            report_type="breakeven_summary",
            title="BREAKEVEN SUMMARY REPORT",
            organization_name="Union Meat Group",
            prepared_by=normalize_text(request.prepared_by),
            generated_at=datetime.utcnow(),
            report_date=resolved_report_date,
            month=month,
            year=year,
            filters_order_type=request.order_type,
            filters_order_profile=request.order_profile,
            filters_order_subtype=request.order_subtype,
            filters_enterprise_name=request.enterprise_name,
            filters_jurisdiction=request.jurisdiction,
            setting=self._to_setting_read(setting, month, year),
            totals=totals,
            rows=rows,
        )


breakeven_report_service = BreakevenReportService()