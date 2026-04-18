from __future__ import annotations

from calendar import monthrange
from datetime import date, timedelta
from decimal import Decimal, ROUND_HALF_UP
from typing import Dict, List, Optional, Sequence, Tuple, Union
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import asc, desc
from sqlalchemy.orm import Session

from app.models.saas import SlaughterService
from app.schemas.saas import (
    SaaSAnimalSummaryRow,
    SaaSClientSummaryRow,
    SaaSCreate,
    SaaSDateRangeReportData,
    SaaSDateRangeReportRequest,
    SaaSDailyReportData,
    SaaSDailyReportRequest,
    SaaSListQuery,
    SaaSListResponse,
    SaaSMonthlyReportData,
    SaaSMonthlyReportRequest,
    SaaSRead,
    SaaSReportMeta,
    SaaSReportRow,
    SaaSReportTotals,
    SaaSUpdate,
    SaaSWeeklyReportData,
    SaaSWeeklyReportRequest,
)

DECIMAL_ZERO_2 = Decimal("0.00")
TWOPLACES = Decimal("0.01")


def normalize_text(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    value = value.strip()
    return value or None


def quantize_2(value: Union[Decimal, int, float, str, None]) -> Decimal:
    if value is None or value == "":
        return DECIMAL_ZERO_2
    if isinstance(value, Decimal):
        return value.quantize(TWOPLACES, rounding=ROUND_HALF_UP)
    return Decimal(str(value)).quantize(TWOPLACES, rounding=ROUND_HALF_UP)


def month_bounds(month: int, year: int) -> Tuple[date, date]:
    last_day = monthrange(year, month)[1]
    return date(year, month, 1), date(year, month, last_day)


def daily_report_bounds(report_date: date) -> Tuple[date, date]:
    """
    Daily report is cumulative from the first day of the selected month
    up to the selected report date.
    """
    return date(report_date.year, report_date.month, 1), report_date


def week_bounds(reference_date: date, week_starts_on: str = "monday") -> Tuple[date, date]:
    weekday = reference_date.weekday()  # Monday=0 ... Sunday=6

    if week_starts_on == "sunday":
        start_date = reference_date - timedelta(days=(weekday + 1) % 7)
    else:
        start_date = reference_date - timedelta(days=weekday)

    end_date = start_date + timedelta(days=6)
    return start_date, end_date


class SaaSService:
    """
    Core CRUD + reporting service for slaughter services.

    Supports:
    - CRUD
    - list / filtering / sorting
    - totals summary
    - client summary
    - animal summary
    - daily report
    - weekly report
    - monthly report
    - date-range report

    Important daily report behavior:
    - Daily report is cumulative from the first day of the selected month
      up to the selected report date.
    - This means it includes previous days within that month and totals
      accumulate across those rows.
    """

    model = SlaughterService

    SORTABLE_FIELDS = {
        "service_date": SlaughterService.service_date,
        "client_name": SlaughterService.client_name,
        "animal_type": SlaughterService.animal_type,
        "total_animals": SlaughterService.total_animals,
        "total_revenue_usd": SlaughterService.total_revenue_usd,
        "total_offal_revenue_usd": SlaughterService.total_offal_revenue_usd,
        "total_combined_revenue_usd": SlaughterService.total_combined_revenue_usd,
        "created_at": SlaughterService.created_at,
        "updated_at": SlaughterService.updated_at,
    }

    # =========================================================================
    # INTERNAL HELPERS
    # =========================================================================
    def _base_query(self, db: Session):
        return db.query(self.model)

    def _normalize_uuid(self, value: Union[str, UUID]) -> UUID:
        if isinstance(value, UUID):
            return value
        try:
            return UUID(str(value))
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Invalid slaughter service ID.",
            ) from exc

    def _get_or_404(self, db: Session, saas_id: Union[str, UUID]) -> SlaughterService:
        record = db.get(self.model, self._normalize_uuid(saas_id))
        if not record:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Slaughter service record not found.",
            )
        return record

    def _apply_filters(
        self,
        query,
        *,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        client_name: Optional[str] = None,
        animal_type: Optional[str] = None,
        is_active: Optional[bool] = None,
        month: Optional[int] = None,
        year: Optional[int] = None,
    ):
        if month is not None:
            if year is None:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="year is required when month is provided.",
                )
            start_date, end_date = month_bounds(month, year)

        if start_date and end_date and start_date > end_date:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="start_date cannot be later than end_date.",
            )

        if start_date is not None:
            query = query.filter(self.model.service_date >= start_date)

        if end_date is not None:
            query = query.filter(self.model.service_date <= end_date)

        client_name = normalize_text(client_name)
        if client_name:
            query = query.filter(self.model.client_name.ilike(f"%{client_name}%"))

        animal_type = normalize_text(animal_type)
        if animal_type:
            query = query.filter(self.model.animal_type.ilike(f"%{animal_type}%"))

        if is_active is not None:
            query = query.filter(self.model.is_active.is_(is_active))

        return query

    def _apply_sorting(
        self,
        query,
        *,
        sort_by: str = "service_date",
        sort_order: str = "desc",
    ):
        column = self.SORTABLE_FIELDS.get(sort_by, self.model.service_date)
        direction = asc if str(sort_order).lower() == "asc" else desc

        query = query.order_by(direction(column))

        if sort_by != "service_date":
            query = query.order_by(desc(self.model.service_date))

        if sort_by != "created_at":
            query = query.order_by(desc(self.model.created_at))

        return query

    def _fetch_records(
        self,
        db: Session,
        *,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        client_name: Optional[str] = None,
        animal_type: Optional[str] = None,
        is_active: Optional[bool] = None,
        month: Optional[int] = None,
        year: Optional[int] = None,
        sort_by: str = "service_date",
        sort_order: str = "asc",
    ) -> List[SlaughterService]:
        query = self._base_query(db)
        query = self._apply_filters(
            query,
            start_date=start_date,
            end_date=end_date,
            client_name=client_name,
            animal_type=animal_type,
            is_active=is_active,
            month=month,
            year=year,
        )
        query = self._apply_sorting(query, sort_by=sort_by, sort_order=sort_order)
        return query.all()

    def _build_report_rows(self, records: Sequence[SlaughterService]) -> List[SaaSReportRow]:
        return [SaaSReportRow.model_validate(record) for record in records]

    def _build_report_totals(self, records: Sequence[SlaughterService]) -> SaaSReportTotals:
        total_rows = len(records)
        total_animals = sum(int(item.total_animals or 0) for item in records)

        unique_clients = {
            normalize_text(item.client_name)
            for item in records
            if normalize_text(item.client_name)
        }
        total_clients_served = len(unique_clients)

        total_service_revenue_usd = quantize_2(
            sum(quantize_2(item.total_revenue_usd) for item in records)
        )
        total_offal_revenue_usd = quantize_2(
            sum(quantize_2(item.total_offal_revenue_usd) for item in records)
        )
        total_combined_revenue_usd = quantize_2(
            sum(quantize_2(item.total_combined_revenue_usd) for item in records)
        )

        return SaaSReportTotals(
            total_rows=total_rows,
            total_clients_served=total_clients_served,
            total_animals=total_animals,
            total_service_revenue_usd=total_service_revenue_usd,
            total_offal_revenue_usd=total_offal_revenue_usd,
            total_combined_revenue_usd=total_combined_revenue_usd,
        )

    def _build_client_summary(
        self,
        records: Sequence[SlaughterService],
    ) -> List[SaaSClientSummaryRow]:
        grouped: Dict[Optional[str], Dict[str, Union[int, Decimal, Optional[str]]]] = {}

        for item in records:
            key = normalize_text(item.client_name)
            if key not in grouped:
                grouped[key] = {
                    "client_name": key,
                    "rows_count": 0,
                    "total_animals": 0,
                    "total_service_revenue_usd": DECIMAL_ZERO_2,
                    "total_offal_revenue_usd": DECIMAL_ZERO_2,
                    "total_combined_revenue_usd": DECIMAL_ZERO_2,
                }

            grouped[key]["rows_count"] = int(grouped[key]["rows_count"]) + 1
            grouped[key]["total_animals"] = int(grouped[key]["total_animals"]) + int(
                item.total_animals or 0
            )
            grouped[key]["total_service_revenue_usd"] = quantize_2(
                Decimal(str(grouped[key]["total_service_revenue_usd"]))
                + quantize_2(item.total_revenue_usd)
            )
            grouped[key]["total_offal_revenue_usd"] = quantize_2(
                Decimal(str(grouped[key]["total_offal_revenue_usd"]))
                + quantize_2(item.total_offal_revenue_usd)
            )
            grouped[key]["total_combined_revenue_usd"] = quantize_2(
                Decimal(str(grouped[key]["total_combined_revenue_usd"]))
                + quantize_2(item.total_combined_revenue_usd)
            )

        results = [
            SaaSClientSummaryRow(
                client_name=value["client_name"],
                rows_count=int(value["rows_count"]),
                total_animals=int(value["total_animals"]),
                total_service_revenue_usd=quantize_2(value["total_service_revenue_usd"]),
                total_offal_revenue_usd=quantize_2(value["total_offal_revenue_usd"]),
                total_combined_revenue_usd=quantize_2(value["total_combined_revenue_usd"]),
            )
            for value in grouped.values()
        ]

        results.sort(
            key=lambda row: (
                -(row.total_combined_revenue_usd or DECIMAL_ZERO_2),
                (row.client_name or "").lower(),
            )
        )
        return results

    def _build_animal_summary(
        self,
        records: Sequence[SlaughterService],
    ) -> List[SaaSAnimalSummaryRow]:
        grouped: Dict[Optional[str], Dict[str, Union[int, Decimal, Optional[str]]]] = {}

        for item in records:
            key = normalize_text(item.animal_type)
            if key not in grouped:
                grouped[key] = {
                    "animal_type": key,
                    "rows_count": 0,
                    "total_animals": 0,
                    "total_service_revenue_usd": DECIMAL_ZERO_2,
                    "total_offal_revenue_usd": DECIMAL_ZERO_2,
                    "total_combined_revenue_usd": DECIMAL_ZERO_2,
                }

            grouped[key]["rows_count"] = int(grouped[key]["rows_count"]) + 1
            grouped[key]["total_animals"] = int(grouped[key]["total_animals"]) + int(
                item.total_animals or 0
            )
            grouped[key]["total_service_revenue_usd"] = quantize_2(
                Decimal(str(grouped[key]["total_service_revenue_usd"]))
                + quantize_2(item.total_revenue_usd)
            )
            grouped[key]["total_offal_revenue_usd"] = quantize_2(
                Decimal(str(grouped[key]["total_offal_revenue_usd"]))
                + quantize_2(item.total_offal_revenue_usd)
            )
            grouped[key]["total_combined_revenue_usd"] = quantize_2(
                Decimal(str(grouped[key]["total_combined_revenue_usd"]))
                + quantize_2(item.total_combined_revenue_usd)
            )

        results = [
            SaaSAnimalSummaryRow(
                animal_type=value["animal_type"],
                rows_count=int(value["rows_count"]),
                total_animals=int(value["total_animals"]),
                total_service_revenue_usd=quantize_2(value["total_service_revenue_usd"]),
                total_offal_revenue_usd=quantize_2(value["total_offal_revenue_usd"]),
                total_combined_revenue_usd=quantize_2(value["total_combined_revenue_usd"]),
            )
            for value in grouped.values()
        ]

        results.sort(
            key=lambda row: (
                -(row.total_combined_revenue_usd or DECIMAL_ZERO_2),
                (row.animal_type or "").lower(),
            )
        )
        return results

    def _build_meta(
        self,
        *,
        report_type: str,
        scope_label: str,
        organization_name: Optional[str] = None,
        report_title: Optional[str] = None,
        prepared_by_name: Optional[str] = None,
        prepared_on: Optional[date] = None,
    ) -> SaaSReportMeta:
        return SaaSReportMeta(
            organization_name=organization_name or "Union Meat Group",
            report_title=report_title or "UMG Slaughter Services Report",
            report_type=report_type,  # type: ignore[arg-type]
            scope_label=scope_label,
            prepared_by_name=normalize_text(prepared_by_name),
            prepared_on=prepared_on,
        )

    def _to_read(self, record: SlaughterService) -> SaaSRead:
        return SaaSRead.model_validate(record)

    # =========================================================================
    # CRUD
    # =========================================================================
    def create(self, db: Session, payload: SaaSCreate) -> SaaSRead:
        data = payload.model_dump()
        record = self.model(**data)
        record.recalculate_totals()

        db.add(record)
        db.commit()
        db.refresh(record)
        return self._to_read(record)

    def get(self, db: Session, saas_id: Union[str, UUID]) -> SaaSRead:
        record = self._get_or_404(db, saas_id)
        return self._to_read(record)

    def get_model(self, db: Session, saas_id: Union[str, UUID]) -> SlaughterService:
        return self._get_or_404(db, saas_id)

    def list(self, db: Session, params: Optional[SaaSListQuery] = None) -> SaaSListResponse:
        params = params or SaaSListQuery()

        query = self._base_query(db)
        query = self._apply_filters(
            query,
            start_date=params.start_date,
            end_date=params.end_date,
            client_name=params.client_name,
            animal_type=params.animal_type,
            is_active=params.is_active,
            month=params.month,
            year=params.year,
        )

        total = query.order_by(None).count()

        query = self._apply_sorting(
            query,
            sort_by=params.sort_by,
            sort_order=params.sort_order,
        )

        items = query.offset(params.skip).limit(params.limit).all()

        return SaaSListResponse(
            items=[self._to_read(item) for item in items],
            total=total,
            skip=params.skip,
            limit=params.limit,
        )

    def update(
        self,
        db: Session,
        saas_id: Union[str, UUID],
        payload: SaaSUpdate,
    ) -> SaaSRead:
        record = self._get_or_404(db, saas_id)
        update_data = payload.model_dump(exclude_unset=True)

        for field, value in update_data.items():
            setattr(record, field, value)

        record.recalculate_totals()

        db.add(record)
        db.commit()
        db.refresh(record)
        return self._to_read(record)

    def soft_delete(self, db: Session, saas_id: Union[str, UUID]) -> SaaSRead:
        record = self._get_or_404(db, saas_id)
        record.is_active = False

        db.add(record)
        db.commit()
        db.refresh(record)
        return self._to_read(record)

    def restore(self, db: Session, saas_id: Union[str, UUID]) -> SaaSRead:
        record = self._get_or_404(db, saas_id)
        record.is_active = True

        db.add(record)
        db.commit()
        db.refresh(record)
        return self._to_read(record)

    def hard_delete(self, db: Session, saas_id: Union[str, UUID]) -> None:
        record = self._get_or_404(db, saas_id)
        db.delete(record)
        db.commit()

    # =========================================================================
    # SIMPLE SUMMARY HELPERS
    # =========================================================================
    def get_totals(
        self,
        db: Session,
        *,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        client_name: Optional[str] = None,
        animal_type: Optional[str] = None,
        is_active: Optional[bool] = None,
        month: Optional[int] = None,
        year: Optional[int] = None,
    ) -> SaaSReportTotals:
        records = self._fetch_records(
            db,
            start_date=start_date,
            end_date=end_date,
            client_name=client_name,
            animal_type=animal_type,
            is_active=is_active,
            month=month,
            year=year,
            sort_by="service_date",
            sort_order="asc",
        )
        return self._build_report_totals(records)

    def get_client_summary(
        self,
        db: Session,
        *,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        client_name: Optional[str] = None,
        animal_type: Optional[str] = None,
        is_active: Optional[bool] = None,
        month: Optional[int] = None,
        year: Optional[int] = None,
    ) -> List[SaaSClientSummaryRow]:
        records = self._fetch_records(
            db,
            start_date=start_date,
            end_date=end_date,
            client_name=client_name,
            animal_type=animal_type,
            is_active=is_active,
            month=month,
            year=year,
            sort_by="service_date",
            sort_order="asc",
        )
        return self._build_client_summary(records)

    def get_animal_summary(
        self,
        db: Session,
        *,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        client_name: Optional[str] = None,
        animal_type: Optional[str] = None,
        is_active: Optional[bool] = None,
        month: Optional[int] = None,
        year: Optional[int] = None,
    ) -> List[SaaSAnimalSummaryRow]:
        records = self._fetch_records(
            db,
            start_date=start_date,
            end_date=end_date,
            client_name=client_name,
            animal_type=animal_type,
            is_active=is_active,
            month=month,
            year=year,
            sort_by="service_date",
            sort_order="asc",
        )
        return self._build_animal_summary(records)

    # =========================================================================
    # REPORTS
    # =========================================================================
    def get_daily_report(
        self,
        db: Session,
        payload: SaaSDailyReportRequest,
    ) -> SaaSDailyReportData:
        start_date, end_date = daily_report_bounds(payload.report_date)

        records = self._fetch_records(
            db,
            start_date=start_date,
            end_date=end_date,
            client_name=payload.client_name,
            animal_type=payload.animal_type,
            is_active=payload.is_active,
            sort_by="service_date",
            sort_order="asc",
        )

        rows = self._build_report_rows(records) if payload.include_rows else []
        totals = (
            self._build_report_totals(records)
            if payload.include_totals
            else SaaSReportTotals()
        )
        client_summary = (
            self._build_client_summary(records)
            if payload.include_client_summary
            else []
        )
        animal_summary = (
            self._build_animal_summary(records)
            if payload.include_animal_summary
            else []
        )

        meta = self._build_meta(
            report_type="daily",
            scope_label=payload.scope_label,
            organization_name=payload.organization_name,
            report_title=payload.report_title,
            prepared_by_name=payload.prepared_by_name,
            prepared_on=payload.prepared_on,
        )

        return SaaSDailyReportData(
            meta=meta,
            report_date=payload.report_date,
            rows=rows,
            totals=totals,
            client_summary=client_summary,
            animal_summary=animal_summary,
        )

    def get_weekly_report(
        self,
        db: Session,
        payload: SaaSWeeklyReportRequest,
    ) -> SaaSWeeklyReportData:
        start_date = payload.week_start_date
        end_date = payload.week_end_date

        records = self._fetch_records(
            db,
            start_date=start_date,
            end_date=end_date,
            client_name=payload.client_name,
            animal_type=payload.animal_type,
            is_active=payload.is_active,
            sort_by="service_date",
            sort_order="asc",
        )

        rows = self._build_report_rows(records) if payload.include_rows else []
        totals = (
            self._build_report_totals(records)
            if payload.include_totals
            else SaaSReportTotals()
        )
        client_summary = (
            self._build_client_summary(records)
            if payload.include_client_summary
            else []
        )
        animal_summary = (
            self._build_animal_summary(records)
            if payload.include_animal_summary
            else []
        )

        meta = self._build_meta(
            report_type="weekly",
            scope_label=payload.scope_label,
            organization_name=payload.organization_name,
            report_title=payload.report_title,
            prepared_by_name=payload.prepared_by_name,
            prepared_on=payload.prepared_on,
        )

        return SaaSWeeklyReportData(
            meta=meta,
            reference_date=payload.reference_date,
            week_start_date=start_date,
            week_end_date=end_date,
            rows=rows,
            totals=totals,
            client_summary=client_summary,
            animal_summary=animal_summary,
        )

    def get_monthly_report(
        self,
        db: Session,
        payload: SaaSMonthlyReportRequest,
    ) -> SaaSMonthlyReportData:
        start_date, end_date = month_bounds(payload.month, payload.year)

        records = self._fetch_records(
            db,
            start_date=start_date,
            end_date=end_date,
            client_name=payload.client_name,
            animal_type=payload.animal_type,
            is_active=payload.is_active,
            sort_by="service_date",
            sort_order="asc",
        )

        rows = self._build_report_rows(records) if payload.include_rows else []
        totals = (
            self._build_report_totals(records)
            if payload.include_totals
            else SaaSReportTotals()
        )
        client_summary = (
            self._build_client_summary(records)
            if payload.include_client_summary
            else []
        )
        animal_summary = (
            self._build_animal_summary(records)
            if payload.include_animal_summary
            else []
        )

        meta = self._build_meta(
            report_type="monthly",
            scope_label=payload.scope_label,
            organization_name=payload.organization_name,
            report_title=payload.report_title,
            prepared_by_name=payload.prepared_by_name,
            prepared_on=payload.prepared_on,
        )

        return SaaSMonthlyReportData(
            meta=meta,
            month=payload.month,
            year=payload.year,
            month_label=payload.month_label,
            rows=rows,
            totals=totals,
            client_summary=client_summary,
            animal_summary=animal_summary,
        )

    def get_date_range_report(
        self,
        db: Session,
        payload: SaaSDateRangeReportRequest,
    ) -> SaaSDateRangeReportData:
        records = self._fetch_records(
            db,
            start_date=payload.start_date,
            end_date=payload.end_date,
            client_name=payload.client_name,
            animal_type=payload.animal_type,
            is_active=payload.is_active,
            sort_by="service_date",
            sort_order="asc",
        )

        rows = self._build_report_rows(records) if payload.include_rows else []
        totals = (
            self._build_report_totals(records)
            if payload.include_totals
            else SaaSReportTotals()
        )
        client_summary = (
            self._build_client_summary(records)
            if payload.include_client_summary
            else []
        )
        animal_summary = (
            self._build_animal_summary(records)
            if payload.include_animal_summary
            else []
        )

        meta = self._build_meta(
            report_type="range",
            scope_label=payload.scope_label,
            organization_name=payload.organization_name,
            report_title=payload.report_title,
            prepared_by_name=payload.prepared_by_name,
            prepared_on=payload.prepared_on,
        )

        return SaaSDateRangeReportData(
            meta=meta,
            start_date=payload.start_date,
            end_date=payload.end_date,
            rows=rows,
            totals=totals,
            client_summary=client_summary,
            animal_summary=animal_summary,
        )

    # =========================================================================
    # EXPORT PREPARATION HELPERS
    # =========================================================================
    def get_daily_report_records(
        self,
        db: Session,
        payload: SaaSDailyReportRequest,
    ) -> List[SlaughterService]:
        start_date, end_date = daily_report_bounds(payload.report_date)
        return self._fetch_records(
            db,
            start_date=start_date,
            end_date=end_date,
            client_name=payload.client_name,
            animal_type=payload.animal_type,
            is_active=payload.is_active,
            sort_by="service_date",
            sort_order="asc",
        )

    def get_weekly_report_records(
        self,
        db: Session,
        payload: SaaSWeeklyReportRequest,
    ) -> List[SlaughterService]:
        start_date = payload.week_start_date
        end_date = payload.week_end_date
        return self._fetch_records(
            db,
            start_date=start_date,
            end_date=end_date,
            client_name=payload.client_name,
            animal_type=payload.animal_type,
            is_active=payload.is_active,
            sort_by="service_date",
            sort_order="asc",
        )

    def get_monthly_report_records(
        self,
        db: Session,
        payload: SaaSMonthlyReportRequest,
    ) -> List[SlaughterService]:
        start_date, end_date = month_bounds(payload.month, payload.year)
        return self._fetch_records(
            db,
            start_date=start_date,
            end_date=end_date,
            client_name=payload.client_name,
            animal_type=payload.animal_type,
            is_active=payload.is_active,
            sort_by="service_date",
            sort_order="asc",
        )

    def get_date_range_report_records(
        self,
        db: Session,
        payload: SaaSDateRangeReportRequest,
    ) -> List[SlaughterService]:
        return self._fetch_records(
            db,
            start_date=payload.start_date,
            end_date=payload.end_date,
            client_name=payload.client_name,
            animal_type=payload.animal_type,
            is_active=payload.is_active,
            sort_by="service_date",
            sort_order="asc",
        )


saas_service = SaaSService()