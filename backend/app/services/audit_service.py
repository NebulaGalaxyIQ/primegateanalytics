from __future__ import annotations

import csv
import math
from collections import defaultdict
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from decimal import Decimal, ROUND_HALF_UP
from io import BytesIO, StringIO
from typing import Any

from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.audit import (
    AuditPeriodType,
    ConsumableInventoryAudit,
    ProductInventoryAudit,
)
from app.models.inventory import (
    ConsumableStoreInventory,
    ConsumableStoreName,
    ProductStoreInventory,
    ProductStoreName,
)
from app.schemas.audit import (
    AuditExportFileResponse,
    AuditGenerateResponse,
    AuditRemarksUpdate,
    ConsumableAuditFilter,
    ConsumableAuditListResponse,
    ConsumableAuditRead,
    ConsumableAuditReportGroup,
    ConsumableAuditReportRequest,
    ConsumableAuditReportResponse,
    ConsumableAuditReportRow,
    ConsumableAuditReportSummary,
    ConsumableAuditGenerateRequest,
    ProductAuditFilter,
    ProductAuditGenerateRequest,
    ProductAuditListResponse,
    ProductAuditRead,
    ProductAuditReportGroup,
    ProductAuditReportRequest,
    ProductAuditReportResponse,
    ProductAuditReportRow,
    ProductAuditReportSummary,
)

TWOPLACES = Decimal("0.01")
FOURPLACES = Decimal("0.0001")
HUNDRED = Decimal("100.00")


@dataclass
class GeneratedReportFile:
    filename: str
    content_type: str
    data: bytes

    def to_schema(
        self,
        audit_period_type: AuditPeriodType,
        export_format: str,
    ) -> AuditExportFileResponse:
        return AuditExportFileResponse(
            filename=self.filename,
            content_type=self.content_type,
            audit_period_type=audit_period_type,
            export_format=export_format,
            generated_at=datetime.utcnow(),
        )


class AuditServiceError(Exception):
    pass


class AuditNotFoundError(AuditServiceError):
    pass


class AuditConflictError(AuditServiceError):
    pass


def qty(value: Any) -> Decimal:
    if value is None:
        return Decimal("0.00")
    if isinstance(value, Decimal):
        return value.quantize(TWOPLACES, rounding=ROUND_HALF_UP)
    return Decimal(str(value)).quantize(TWOPLACES, rounding=ROUND_HALF_UP)


def qty4(value: Any) -> Decimal:
    if value is None:
        return Decimal("0.0000")
    if isinstance(value, Decimal):
        return value.quantize(FOURPLACES, rounding=ROUND_HALF_UP)
    return Decimal(str(value)).quantize(FOURPLACES, rounding=ROUND_HALF_UP)


def fmt_qty(value: Any) -> str:
    return f"{qty(value):,.2f}"


def fmt_qty4(value: Any) -> str:
    return f"{qty4(value):,.4f}"


def fmt_pct(value: Any) -> str:
    return f"{qty(value):,.2f}"


def fmt_date(value: date | None) -> str:
    return value.strftime("%d-%b-%Y") if value else ""


def safe_text(value: Any) -> str:
    if value is None:
        return ""
    return str(value)


class AuditService:
    def __init__(self, db: Session):
        self.db = db

    # =========================================================================
    # PERIOD HELPERS
    # =========================================================================

    def _normalize_period(
        self,
        audit_period_type: AuditPeriodType,
        period_end_date: date,
    ) -> tuple[date, date]:
        if audit_period_type == AuditPeriodType.WEEKLY:
            normalized_end = period_end_date + timedelta(days=(6 - period_end_date.weekday()))
            normalized_start = normalized_end - timedelta(days=6)
            return normalized_start, normalized_end

        month_start = period_end_date.replace(day=1)
        if period_end_date.month == 12:
            next_month_start = period_end_date.replace(year=period_end_date.year + 1, month=1, day=1)
        else:
            next_month_start = period_end_date.replace(month=period_end_date.month + 1, day=1)
        month_end = next_month_start - timedelta(days=1)
        return month_start, month_end

    def _period_label(self, audit_period_type: AuditPeriodType, period_end_date: date) -> str:
        if audit_period_type == AuditPeriodType.WEEKLY:
            return f"Week Ending: {fmt_date(period_end_date)}"
        return f"Month Ending: {fmt_date(period_end_date)}"

    def _period_date_column_label(self, audit_period_type: AuditPeriodType) -> str:
        if audit_period_type == AuditPeriodType.WEEKLY:
            return "Week Ending (Date)"
        return "Month Ending (Date)"

    # =========================================================================
    # GENERAL MAPPERS / HELPERS
    # =========================================================================

    def _resolve_prepared_by(self, prepared_by: str | None) -> str:
        value = safe_text(prepared_by).strip()
        return value or "Logged in User"

    def _product_report_filename_base(self, generated_at: datetime, audit_period_type: AuditPeriodType) -> str:
        return f"Product Audit Report {audit_period_type.value.title()} {generated_at.strftime('%Y%m%d')}"

    def _consumable_report_filename_base(self, generated_at: datetime, audit_period_type: AuditPeriodType) -> str:
        return f"Consumable Audit Report {audit_period_type.value.title()} {generated_at.strftime('%Y%m%d')}"

    def _sample_size_from_count(self, count_pcs: int) -> int:
        if count_pcs <= 0:
            return 0
        if count_pcs <= 10:
            return count_pcs
        if count_pcs <= 100:
            return math.ceil(count_pcs * 0.10)
        return min(math.ceil(count_pcs * 0.05), 50)

    def _variance_pct(self, variance: Decimal, base: Decimal) -> Decimal:
        base = qty(base)
        if base == 0:
            return Decimal("0.00")
        return ((variance / base) * HUNDRED).quantize(TWOPLACES, rounding=ROUND_HALF_UP)

    def _to_product_audit_read(self, row: ProductInventoryAudit) -> ProductAuditRead:
        return ProductAuditRead.model_validate(row)

    def _to_consumable_audit_read(self, row: ConsumableInventoryAudit) -> ConsumableAuditRead:
        return ConsumableAuditRead.model_validate(row)

    def _commit_or_conflict(self, message: str) -> None:
        try:
            self.db.commit()
        except IntegrityError as exc:
            self.db.rollback()
            raise AuditConflictError(message) from exc

    # =========================================================================
    # LOOKUP / GETTERS
    # =========================================================================

    def get_product_audit_or_404(self, audit_id: str) -> ProductInventoryAudit:
        row = (
            self.db.query(ProductInventoryAudit)
            .filter(ProductInventoryAudit.id == audit_id)
            .first()
        )
        if not row:
            raise AuditNotFoundError("Product audit row not found.")
        return row

    def get_consumable_audit_or_404(self, audit_id: str) -> ConsumableInventoryAudit:
        row = (
            self.db.query(ConsumableInventoryAudit)
            .filter(ConsumableInventoryAudit.id == audit_id)
            .first()
        )
        if not row:
            raise AuditNotFoundError("Consumable audit row not found.")
        return row

    # =========================================================================
    # PRODUCT AUDIT GENERATION
    # =========================================================================

    def generate_product_audit(
        self,
        payload: ProductAuditGenerateRequest,
        *,
        actor_id: str | None = None,
    ) -> AuditGenerateResponse:
        period_start, period_end = self._normalize_period(
            payload.audit_period_type,
            payload.period_end_date,
        )

        query = self.db.query(ProductStoreInventory).filter(
            ProductStoreInventory.entry_date >= period_start,
            ProductStoreInventory.entry_date <= period_end,
        )

        if payload.store:
            query = query.filter(ProductStoreInventory.store == payload.store)
        if payload.product_category_id:
            query = query.filter(ProductStoreInventory.product_category_id == payload.product_category_id)
        if payload.product_id:
            query = query.filter(ProductStoreInventory.product_id == payload.product_id)

        rows = query.order_by(
            ProductStoreInventory.entry_date.asc(),
            ProductStoreInventory.store.asc(),
            ProductStoreInventory.product_category_name.asc(),
            ProductStoreInventory.product_name.asc(),
            ProductStoreInventory.created_at.asc(),
        ).all()

        grouped: dict[tuple[Any, ...], list[ProductStoreInventory]] = defaultdict(list)
        for row in rows:
            key = (
                row.store,
                row.product_category_id,
                row.product_id,
            )
            grouped[key].append(row)

        generated_count = 0
        updated_count = 0
        now = datetime.utcnow()

        for (store, product_category_id, product_id), items in grouped.items():
            items = sorted(
                items,
                key=lambda r: (r.entry_date, r.created_at or datetime.min),
            )
            first_row = items[0]
            last_row = items[-1]

            count_pcs = int(sum(int(r.total_pieces or 0) for r in items))
            sample_size_pcs = self._sample_size_from_count(count_pcs)

            ledger_opening_kg = qty(first_row.opening_balance)
            ledger_inflows_kg = qty(
                sum(
                    qty(r.inflow_production) + qty(r.inflow_transfers_in)
                    for r in items
                )
            )
            ledger_outflows_kg = qty(
                sum(
                    qty(r.outflow_dispatch) + qty(r.outflow_transfers_out)
                    for r in items
                )
            )
            ledger_closing_kg = qty(last_row.closing_balance)

            avg_weight_kg_per_pc = (
                qty4(ledger_closing_kg / Decimal(count_pcs))
                if count_pcs > 0
                else Decimal("0.0000")
            )
            sample_weight_kg = qty(Decimal(sample_size_pcs) * avg_weight_kg_per_pc)
            calculated_total_kg = qty(Decimal(count_pcs) * avg_weight_kg_per_pc)
            variance_kg = qty(calculated_total_kg - ledger_closing_kg)
            variance_pct = self._variance_pct(variance_kg, ledger_closing_kg)

            existing = (
                self.db.query(ProductInventoryAudit)
                .filter(
                    ProductInventoryAudit.audit_period_type == payload.audit_period_type,
                    ProductInventoryAudit.period_end_date == period_end,
                    ProductInventoryAudit.store == store,
                    ProductInventoryAudit.product_id == product_id,
                )
                .first()
            )

            if existing:
                existing.period_start_date = period_start
                existing.store = store
                existing.product_category_id = product_category_id
                existing.product_id = product_id
                existing.product_category_name = first_row.product_category_name or ""
                existing.product_name = first_row.product_name or ""
                existing.count_pcs = count_pcs
                existing.sample_size_pcs = sample_size_pcs
                existing.sample_weight_kg = sample_weight_kg
                existing.avg_weight_kg_per_pc = avg_weight_kg_per_pc
                existing.calculated_total_kg = calculated_total_kg
                existing.ledger_opening_kg = ledger_opening_kg
                existing.ledger_inflows_kg = ledger_inflows_kg
                existing.ledger_outflows_kg = ledger_outflows_kg
                existing.ledger_closing_kg = ledger_closing_kg
                existing.variance_kg = variance_kg
                existing.variance_pct = variance_pct
                existing.last_recalculated_at = now
                existing.updated_by = actor_id or existing.updated_by
                updated_count += 1
            else:
                row = ProductInventoryAudit(
                    audit_period_type=payload.audit_period_type,
                    period_start_date=period_start,
                    period_end_date=period_end,
                    store=store,
                    product_category_id=product_category_id,
                    product_id=product_id,
                    product_category_name=first_row.product_category_name or "",
                    product_name=first_row.product_name or "",
                    count_pcs=count_pcs,
                    sample_size_pcs=sample_size_pcs,
                    sample_weight_kg=sample_weight_kg,
                    avg_weight_kg_per_pc=avg_weight_kg_per_pc,
                    calculated_total_kg=calculated_total_kg,
                    ledger_opening_kg=ledger_opening_kg,
                    ledger_inflows_kg=ledger_inflows_kg,
                    ledger_outflows_kg=ledger_outflows_kg,
                    ledger_closing_kg=ledger_closing_kg,
                    variance_kg=variance_kg,
                    variance_pct=variance_pct,
                    generated_at=now,
                    last_recalculated_at=now,
                    created_by=actor_id,
                    updated_by=actor_id,
                )
                self.db.add(row)
                generated_count += 1

        self._commit_or_conflict("Unable to generate product audit rows.")

        total_processed = generated_count + updated_count
        return AuditGenerateResponse(
            audit_period_type=payload.audit_period_type,
            period_end_date=period_end,
            generated_count=generated_count,
            updated_count=updated_count,
            total_processed=total_processed,
            message=f"Processed {total_processed} product audit row(s).",
        )

    # =========================================================================
    # CONSUMABLE AUDIT GENERATION
    # =========================================================================

    def generate_consumable_audit(
        self,
        payload: ConsumableAuditGenerateRequest,
        *,
        actor_id: str | None = None,
    ) -> AuditGenerateResponse:
        period_start, period_end = self._normalize_period(
            payload.audit_period_type,
            payload.period_end_date,
        )

        query = self.db.query(ConsumableStoreInventory).filter(
            ConsumableStoreInventory.entry_date >= period_start,
            ConsumableStoreInventory.entry_date <= period_end,
        )

        if payload.store:
            query = query.filter(ConsumableStoreInventory.store == payload.store)
        if payload.item_category_id:
            query = query.filter(ConsumableStoreInventory.item_category_id == payload.item_category_id)
        if payload.item_id:
            query = query.filter(ConsumableStoreInventory.item_id == payload.item_id)

        rows = query.order_by(
            ConsumableStoreInventory.entry_date.asc(),
            ConsumableStoreInventory.store.asc(),
            ConsumableStoreInventory.item_category_name.asc(),
            ConsumableStoreInventory.item_name.asc(),
            ConsumableStoreInventory.created_at.asc(),
        ).all()

        grouped: dict[tuple[Any, ...], list[ConsumableStoreInventory]] = defaultdict(list)
        for row in rows:
            key = (
                row.store,
                row.item_category_id,
                row.item_id,
            )
            grouped[key].append(row)

        generated_count = 0
        updated_count = 0
        now = datetime.utcnow()

        for (store, item_category_id, item_id), items in grouped.items():
            items = sorted(
                items,
                key=lambda r: (r.entry_date, r.created_at or datetime.min),
            )
            first_row = items[0]
            last_row = items[-1]

            opening_ledger = qty(first_row.opening_balance)
            issues_total = qty(sum(qty(r.issued_today) for r in items))
            expected_closing = qty(last_row.closing_balance)
            physical_count = expected_closing
            variance = qty(physical_count - expected_closing)
            variance_pct = self._variance_pct(variance, expected_closing)

            existing = (
                self.db.query(ConsumableInventoryAudit)
                .filter(
                    ConsumableInventoryAudit.audit_period_type == payload.audit_period_type,
                    ConsumableInventoryAudit.period_end_date == period_end,
                    ConsumableInventoryAudit.store == store,
                    ConsumableInventoryAudit.item_id == item_id,
                )
                .first()
            )

            if existing:
                existing.period_start_date = period_start
                existing.store = store
                existing.item_category_id = item_category_id
                existing.item_id = item_id
                existing.item_category_name = first_row.item_category_name or ""
                existing.item_name = first_row.item_name or ""
                existing.unit = first_row.unit or ""
                existing.opening_ledger = opening_ledger
                existing.issues_total = issues_total
                existing.expected_closing = expected_closing
                existing.physical_count = physical_count
                existing.variance = variance
                existing.variance_pct = variance_pct
                existing.last_recalculated_at = now
                existing.updated_by = actor_id or existing.updated_by
                updated_count += 1
            else:
                row = ConsumableInventoryAudit(
                    audit_period_type=payload.audit_period_type,
                    period_start_date=period_start,
                    period_end_date=period_end,
                    store=store,
                    item_category_id=item_category_id,
                    item_id=item_id,
                    item_category_name=first_row.item_category_name or "",
                    item_name=first_row.item_name or "",
                    unit=first_row.unit or "",
                    opening_ledger=opening_ledger,
                    issues_total=issues_total,
                    expected_closing=expected_closing,
                    physical_count=physical_count,
                    variance=variance,
                    variance_pct=variance_pct,
                    generated_at=now,
                    last_recalculated_at=now,
                    created_by=actor_id,
                    updated_by=actor_id,
                )
                self.db.add(row)
                generated_count += 1

        self._commit_or_conflict("Unable to generate consumable audit rows.")

        total_processed = generated_count + updated_count
        return AuditGenerateResponse(
            audit_period_type=payload.audit_period_type,
            period_end_date=period_end,
            generated_count=generated_count,
            updated_count=updated_count,
            total_processed=total_processed,
            message=f"Processed {total_processed} consumable audit row(s).",
        )

    # =========================================================================
    # LISTING
    # =========================================================================

    def list_product_audits(self, filters: ProductAuditFilter) -> ProductAuditListResponse:
        query = self.db.query(ProductInventoryAudit)

        if filters.audit_period_type:
            query = query.filter(ProductInventoryAudit.audit_period_type == filters.audit_period_type)
        if filters.period_start_date:
            query = query.filter(ProductInventoryAudit.period_start_date >= filters.period_start_date)
        if filters.period_end_date:
            query = query.filter(ProductInventoryAudit.period_end_date <= filters.period_end_date)
        if filters.store:
            query = query.filter(ProductInventoryAudit.store == filters.store)
        if filters.product_category_id:
            query = query.filter(ProductInventoryAudit.product_category_id == filters.product_category_id)
        if filters.product_id:
            query = query.filter(ProductInventoryAudit.product_id == filters.product_id)
        if filters.search:
            term = f"%{filters.search}%"
            query = query.filter(
                or_(
                    ProductInventoryAudit.product_category_name.ilike(term),
                    ProductInventoryAudit.product_name.ilike(term),
                    ProductInventoryAudit.remarks.ilike(term),
                )
            )

        total = query.count()
        items = (
            query.order_by(
                ProductInventoryAudit.period_end_date.desc(),
                ProductInventoryAudit.store.asc(),
                ProductInventoryAudit.product_category_name.asc(),
                ProductInventoryAudit.product_name.asc(),
                ProductInventoryAudit.created_at.desc(),
            )
            .offset((filters.page - 1) * filters.page_size)
            .limit(filters.page_size)
            .all()
        )

        return ProductAuditListResponse(
            total=total,
            page=filters.page,
            page_size=filters.page_size,
            total_pages=math.ceil(total / filters.page_size) if total else 0,
            items=[self._to_product_audit_read(row) for row in items],
        )

    def list_consumable_audits(
        self,
        filters: ConsumableAuditFilter,
    ) -> ConsumableAuditListResponse:
        query = self.db.query(ConsumableInventoryAudit)

        if filters.audit_period_type:
            query = query.filter(ConsumableInventoryAudit.audit_period_type == filters.audit_period_type)
        if filters.period_start_date:
            query = query.filter(ConsumableInventoryAudit.period_start_date >= filters.period_start_date)
        if filters.period_end_date:
            query = query.filter(ConsumableInventoryAudit.period_end_date <= filters.period_end_date)
        if filters.store:
            query = query.filter(ConsumableInventoryAudit.store == filters.store)
        if filters.item_category_id:
            query = query.filter(ConsumableInventoryAudit.item_category_id == filters.item_category_id)
        if filters.item_id:
            query = query.filter(ConsumableInventoryAudit.item_id == filters.item_id)
        if filters.search:
            term = f"%{filters.search}%"
            query = query.filter(
                or_(
                    ConsumableInventoryAudit.item_category_name.ilike(term),
                    ConsumableInventoryAudit.item_name.ilike(term),
                    ConsumableInventoryAudit.unit.ilike(term),
                    ConsumableInventoryAudit.remarks.ilike(term),
                )
            )

        total = query.count()
        items = (
            query.order_by(
                ConsumableInventoryAudit.period_end_date.desc(),
                ConsumableInventoryAudit.store.asc(),
                ConsumableInventoryAudit.item_category_name.asc(),
                ConsumableInventoryAudit.item_name.asc(),
                ConsumableInventoryAudit.created_at.desc(),
            )
            .offset((filters.page - 1) * filters.page_size)
            .limit(filters.page_size)
            .all()
        )

        return ConsumableAuditListResponse(
            total=total,
            page=filters.page,
            page_size=filters.page_size,
            total_pages=math.ceil(total / filters.page_size) if total else 0,
            items=[self._to_consumable_audit_read(row) for row in items],
        )

    # =========================================================================
    # REMARKS UPDATE
    # =========================================================================

    def update_product_audit_remarks(
        self,
        audit_id: str,
        payload: AuditRemarksUpdate,
        *,
        updated_by: str | None = None,
    ) -> ProductAuditRead:
        row = self.get_product_audit_or_404(audit_id)
        row.remarks = payload.remarks
        row.updated_by = updated_by or row.updated_by
        self._commit_or_conflict("Unable to update product audit remarks.")
        self.db.refresh(row)
        return self._to_product_audit_read(row)

    def update_consumable_audit_remarks(
        self,
        audit_id: str,
        payload: AuditRemarksUpdate,
        *,
        updated_by: str | None = None,
    ) -> ConsumableAuditRead:
        row = self.get_consumable_audit_or_404(audit_id)
        row.remarks = payload.remarks
        row.updated_by = updated_by or row.updated_by
        self._commit_or_conflict("Unable to update consumable audit remarks.")
        self.db.refresh(row)
        return self._to_consumable_audit_read(row)

    # =========================================================================
    # PRODUCT REPORTS
    # =========================================================================

    def build_product_audit_report(
        self,
        payload: ProductAuditReportRequest,
    ) -> ProductAuditReportResponse:
        query = self.db.query(ProductInventoryAudit).filter(
            ProductInventoryAudit.audit_period_type == payload.audit_period_type,
            ProductInventoryAudit.period_start_date >= payload.period_start_date,
            ProductInventoryAudit.period_end_date <= payload.period_end_date,
        )

        if payload.store:
            query = query.filter(ProductInventoryAudit.store == payload.store)
        if payload.product_category_id:
            query = query.filter(ProductInventoryAudit.product_category_id == payload.product_category_id)
        if payload.product_id:
            query = query.filter(ProductInventoryAudit.product_id == payload.product_id)

        rows = query.order_by(
            ProductInventoryAudit.period_end_date.asc(),
            ProductInventoryAudit.store.asc(),
            ProductInventoryAudit.product_category_name.asc(),
            ProductInventoryAudit.product_name.asc(),
            ProductInventoryAudit.created_at.asc(),
        ).all()

        groups = self._group_product_report_rows(rows, payload.audit_period_type)
        grand_totals = ProductAuditReportSummary()

        for group in groups:
            grand_totals.count_pcs += int(group.summary.count_pcs or 0)
            grand_totals.sample_size_pcs += int(group.summary.sample_size_pcs or 0)
            grand_totals.sample_weight_kg += qty(group.summary.sample_weight_kg)
            grand_totals.calculated_total_kg += qty(group.summary.calculated_total_kg)
            grand_totals.ledger_opening_kg += qty(group.summary.ledger_opening_kg)
            grand_totals.ledger_inflows_kg += qty(group.summary.ledger_inflows_kg)
            grand_totals.ledger_outflows_kg += qty(group.summary.ledger_outflows_kg)
            grand_totals.ledger_closing_kg += qty(group.summary.ledger_closing_kg)
            grand_totals.variance_kg += qty(group.summary.variance_kg)

        return ProductAuditReportResponse(
            audit_period_type=payload.audit_period_type,
            export_format=payload.export_format,
            generated_at=datetime.utcnow(),
            period_start_date=payload.period_start_date,
            period_end_date=payload.period_end_date,
            store=payload.store,
            product_category_id=payload.product_category_id,
            product_id=payload.product_id,
            groups=groups,
            grand_totals=grand_totals,
        )

    def export_product_audit_report(
        self,
        payload: ProductAuditReportRequest,
        *,
        prepared_by: str | None = None,
    ) -> GeneratedReportFile:
        report = self.build_product_audit_report(payload)
        export_format = payload.export_format or "pdf"
        filename_base = self._product_report_filename_base(
            report.generated_at,
            report.audit_period_type,
        )

        if export_format == "csv":
            return GeneratedReportFile(
                filename=f"{filename_base}.csv",
                content_type="text/csv",
                data=self._render_product_report_csv(report, prepared_by=prepared_by),
            )

        return GeneratedReportFile(
            filename=f"{filename_base}.pdf",
            content_type="application/pdf",
            data=self._render_product_report_pdf(report, prepared_by=prepared_by),
        )

    # =========================================================================
    # CONSUMABLE REPORTS
    # =========================================================================

    def build_consumable_audit_report(
        self,
        payload: ConsumableAuditReportRequest,
    ) -> ConsumableAuditReportResponse:
        query = self.db.query(ConsumableInventoryAudit).filter(
            ConsumableInventoryAudit.audit_period_type == payload.audit_period_type,
            ConsumableInventoryAudit.period_start_date >= payload.period_start_date,
            ConsumableInventoryAudit.period_end_date <= payload.period_end_date,
        )

        if payload.store:
            query = query.filter(ConsumableInventoryAudit.store == payload.store)
        if payload.item_category_id:
            query = query.filter(ConsumableInventoryAudit.item_category_id == payload.item_category_id)
        if payload.item_id:
            query = query.filter(ConsumableInventoryAudit.item_id == payload.item_id)

        rows = query.order_by(
            ConsumableInventoryAudit.period_end_date.asc(),
            ConsumableInventoryAudit.store.asc(),
            ConsumableInventoryAudit.item_category_name.asc(),
            ConsumableInventoryAudit.item_name.asc(),
            ConsumableInventoryAudit.created_at.asc(),
        ).all()

        groups = self._group_consumable_report_rows(rows, payload.audit_period_type)
        grand_totals = ConsumableAuditReportSummary()

        for group in groups:
            grand_totals.opening_ledger += qty(group.summary.opening_ledger)
            grand_totals.issues_total += qty(group.summary.issues_total)
            grand_totals.expected_closing += qty(group.summary.expected_closing)
            grand_totals.physical_count += qty(group.summary.physical_count)
            grand_totals.variance += qty(group.summary.variance)

        return ConsumableAuditReportResponse(
            audit_period_type=payload.audit_period_type,
            export_format=payload.export_format,
            generated_at=datetime.utcnow(),
            period_start_date=payload.period_start_date,
            period_end_date=payload.period_end_date,
            store=payload.store,
            item_category_id=payload.item_category_id,
            item_id=payload.item_id,
            groups=groups,
            grand_totals=grand_totals,
        )

    def export_consumable_audit_report(
        self,
        payload: ConsumableAuditReportRequest,
        *,
        prepared_by: str | None = None,
    ) -> GeneratedReportFile:
        report = self.build_consumable_audit_report(payload)
        export_format = payload.export_format or "pdf"
        filename_base = self._consumable_report_filename_base(
            report.generated_at,
            report.audit_period_type,
        )

        if export_format == "csv":
            return GeneratedReportFile(
                filename=f"{filename_base}.csv",
                content_type="text/csv",
                data=self._render_consumable_report_csv(report, prepared_by=prepared_by),
            )

        return GeneratedReportFile(
            filename=f"{filename_base}.pdf",
            content_type="application/pdf",
            data=self._render_consumable_report_pdf(report, prepared_by=prepared_by),
        )

    # =========================================================================
    # PRODUCT REPORT GROUPING
    # =========================================================================

    def _group_product_report_rows(
        self,
        rows: list[ProductInventoryAudit],
        audit_period_type: AuditPeriodType,
    ) -> list[ProductAuditReportGroup]:
        grouped: dict[tuple[date, date, str], list[ProductInventoryAudit]] = defaultdict(list)

        for row in rows:
            label = self._period_label(audit_period_type, row.period_end_date)
            grouped[(row.period_start_date, row.period_end_date, label)].append(row)

        groups: list[ProductAuditReportGroup] = []

        for (period_start, period_end, label), items in sorted(grouped.items(), key=lambda x: x[0][1]):
            summary = ProductAuditReportSummary()
            report_rows: list[ProductAuditReportRow] = []

            for index, row in enumerate(items, start=1):
                report_rows.append(
                    ProductAuditReportRow(
                        index=index,
                        period_end_date=row.period_end_date,
                        store=row.store,
                        product_category_name=row.product_category_name,
                        product_name=row.product_name,
                        count_pcs=int(row.count_pcs or 0),
                        sample_size_pcs=int(row.sample_size_pcs or 0),
                        sample_weight_kg=qty(row.sample_weight_kg),
                        avg_weight_kg_per_pc=qty4(row.avg_weight_kg_per_pc),
                        calculated_total_kg=qty(row.calculated_total_kg),
                        ledger_opening_kg=qty(row.ledger_opening_kg),
                        ledger_inflows_kg=qty(row.ledger_inflows_kg),
                        ledger_outflows_kg=qty(row.ledger_outflows_kg),
                        ledger_closing_kg=qty(row.ledger_closing_kg),
                        variance_kg=qty(row.variance_kg),
                        variance_pct=qty(row.variance_pct),
                        remarks=row.remarks,
                    )
                )

                summary.count_pcs += int(row.count_pcs or 0)
                summary.sample_size_pcs += int(row.sample_size_pcs or 0)
                summary.sample_weight_kg += qty(row.sample_weight_kg)
                summary.calculated_total_kg += qty(row.calculated_total_kg)
                summary.ledger_opening_kg += qty(row.ledger_opening_kg)
                summary.ledger_inflows_kg += qty(row.ledger_inflows_kg)
                summary.ledger_outflows_kg += qty(row.ledger_outflows_kg)
                summary.ledger_closing_kg += qty(row.ledger_closing_kg)
                summary.variance_kg += qty(row.variance_kg)

            groups.append(
                ProductAuditReportGroup(
                    label=label,
                    period_start_date=period_start,
                    period_end_date=period_end,
                    rows=report_rows,
                    summary=summary,
                )
            )

        return groups

    def _group_consumable_report_rows(
        self,
        rows: list[ConsumableInventoryAudit],
        audit_period_type: AuditPeriodType,
    ) -> list[ConsumableAuditReportGroup]:
        grouped: dict[tuple[date, date, str], list[ConsumableInventoryAudit]] = defaultdict(list)

        for row in rows:
            label = self._period_label(audit_period_type, row.period_end_date)
            grouped[(row.period_start_date, row.period_end_date, label)].append(row)

        groups: list[ConsumableAuditReportGroup] = []

        for (period_start, period_end, label), items in sorted(grouped.items(), key=lambda x: x[0][1]):
            summary = ConsumableAuditReportSummary()
            report_rows: list[ConsumableAuditReportRow] = []

            for index, row in enumerate(items, start=1):
                report_rows.append(
                    ConsumableAuditReportRow(
                        index=index,
                        period_end_date=row.period_end_date,
                        store=row.store,
                        item_name=row.item_name,
                        unit=row.unit,
                        opening_ledger=qty(row.opening_ledger),
                        issues_total=qty(row.issues_total),
                        expected_closing=qty(row.expected_closing),
                        physical_count=qty(row.physical_count),
                        variance=qty(row.variance),
                        variance_pct=qty(row.variance_pct),
                        remarks=row.remarks,
                    )
                )

                summary.opening_ledger += qty(row.opening_ledger)
                summary.issues_total += qty(row.issues_total)
                summary.expected_closing += qty(row.expected_closing)
                summary.physical_count += qty(row.physical_count)
                summary.variance += qty(row.variance)

            groups.append(
                ConsumableAuditReportGroup(
                    label=label,
                    period_start_date=period_start,
                    period_end_date=period_end,
                    rows=report_rows,
                    summary=summary,
                )
            )

        return groups

    # =========================================================================
    # CSV RENDERING
    # =========================================================================

    def _render_product_report_csv(
        self,
        report: ProductAuditReportResponse,
        *,
        prepared_by: str | None = None,
    ) -> bytes:
        prepared_by = self._resolve_prepared_by(prepared_by)
        period_label = self._period_date_column_label(report.audit_period_type)

        buffer = StringIO()
        writer = csv.writer(buffer)

        writer.writerow(["PRODUCT INVENTORY AUDIT REPORT"])
        writer.writerow(["Prepared By", prepared_by])
        writer.writerow(["Audit Period Type", report.audit_period_type.value.title()])
        writer.writerow(["Period", f"{fmt_date(report.period_start_date)} to {fmt_date(report.period_end_date)}"])
        writer.writerow(["Generated At", report.generated_at.isoformat()])
        writer.writerow([])

        for group in report.groups:
            writer.writerow([group.label])
            writer.writerow(
                [
                    "No.",
                    period_label,
                    "Store",
                    "Product Category",
                    "Product Type",
                    "Count (pcs)",
                    "Sample Size (pcs)",
                    "Sample Weight (kg)",
                    "Avg Weight (kg/pc)",
                    "Calculated Total (kg)",
                    "Ledger Opening (kg)",
                    "Ledger Inflows (kg)",
                    "Ledger Outflows (kg)",
                    "Ledger Closing (kg)",
                    "Variance (kg)",
                    "Variance (%)",
                    "Remarks",
                ]
            )

            for row in group.rows:
                writer.writerow(
                    [
                        row.index,
                        fmt_date(row.period_end_date),
                        row.store.value if hasattr(row.store, "value") else row.store,
                        row.product_category_name,
                        row.product_name,
                        row.count_pcs,
                        row.sample_size_pcs,
                        fmt_qty(row.sample_weight_kg),
                        fmt_qty4(row.avg_weight_kg_per_pc),
                        fmt_qty(row.calculated_total_kg),
                        fmt_qty(row.ledger_opening_kg),
                        fmt_qty(row.ledger_inflows_kg),
                        fmt_qty(row.ledger_outflows_kg),
                        fmt_qty(row.ledger_closing_kg),
                        fmt_qty(row.variance_kg),
                        fmt_pct(row.variance_pct),
                        safe_text(row.remarks),
                    ]
                )

            writer.writerow(
                [
                    "",
                    "",
                    "",
                    "",
                    "Grand Total",
                    group.summary.count_pcs,
                    group.summary.sample_size_pcs,
                    fmt_qty(group.summary.sample_weight_kg),
                    "",
                    fmt_qty(group.summary.calculated_total_kg),
                    fmt_qty(group.summary.ledger_opening_kg),
                    fmt_qty(group.summary.ledger_inflows_kg),
                    fmt_qty(group.summary.ledger_outflows_kg),
                    fmt_qty(group.summary.ledger_closing_kg),
                    fmt_qty(group.summary.variance_kg),
                    "",
                    "",
                ]
            )
            writer.writerow([])

        return buffer.getvalue().encode("utf-8")

    def _render_consumable_report_csv(
        self,
        report: ConsumableAuditReportResponse,
        *,
        prepared_by: str | None = None,
    ) -> bytes:
        prepared_by = self._resolve_prepared_by(prepared_by)
        period_label = self._period_date_column_label(report.audit_period_type)

        buffer = StringIO()
        writer = csv.writer(buffer)

        writer.writerow(["CONSUMABLE INVENTORY AUDIT REPORT"])
        writer.writerow(["Prepared By", prepared_by])
        writer.writerow(["Audit Period Type", report.audit_period_type.value.title()])
        writer.writerow(["Period", f"{fmt_date(report.period_start_date)} to {fmt_date(report.period_end_date)}"])
        writer.writerow(["Generated At", report.generated_at.isoformat()])
        writer.writerow([])

        for group in report.groups:
            writer.writerow([group.label])
            writer.writerow(
                [
                    "Index",
                    period_label,
                    "Store",
                    "Item",
                    "Unit",
                    "Opening Ledger",
                    "Issues (Total)",
                    "Expected Closing",
                    "Physical Count",
                    "Variance",
                    "Variance (%)",
                    "Remarks",
                ]
            )

            for row in group.rows:
                writer.writerow(
                    [
                        row.index,
                        fmt_date(row.period_end_date),
                        row.store.value if hasattr(row.store, "value") else row.store,
                        row.item_name,
                        row.unit,
                        fmt_qty(row.opening_ledger),
                        fmt_qty(row.issues_total),
                        fmt_qty(row.expected_closing),
                        fmt_qty(row.physical_count),
                        fmt_qty(row.variance),
                        fmt_pct(row.variance_pct),
                        safe_text(row.remarks),
                    ]
                )

            writer.writerow(
                [
                    "",
                    "",
                    "",
                    "Grand Total",
                    "",
                    fmt_qty(group.summary.opening_ledger),
                    fmt_qty(group.summary.issues_total),
                    fmt_qty(group.summary.expected_closing),
                    fmt_qty(group.summary.physical_count),
                    fmt_qty(group.summary.variance),
                    "",
                    "",
                ]
            )
            writer.writerow([])

        return buffer.getvalue().encode("utf-8")

    # =========================================================================
    # PDF RENDERING
    # =========================================================================

    def _render_product_report_pdf(
        self,
        report: ProductAuditReportResponse,
        *,
        prepared_by: str | None = None,
    ) -> bytes:
        try:
            from reportlab.lib import colors
            from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
            from reportlab.lib.pagesizes import A4, landscape
            from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
            from reportlab.lib.units import mm
            from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
        except ImportError as exc:
            raise RuntimeError("reportlab is required to generate PDF reports.") from exc

        prepared_by = self._resolve_prepared_by(prepared_by)
        period_label = self._period_date_column_label(report.audit_period_type)

        buffer = BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=landscape(A4),
            leftMargin=8 * mm,
            rightMargin=8 * mm,
            topMargin=8 * mm,
            bottomMargin=8 * mm,
        )

        styles = getSampleStyleSheet()
        title_style = ParagraphStyle(
            "Title",
            parent=styles["Title"],
            fontName="Times-Bold",
            fontSize=16,
            leading=20,
            alignment=TA_CENTER,
            spaceAfter=8,
        )
        meta_style = ParagraphStyle(
            "Meta",
            parent=styles["Normal"],
            fontName="Times-Roman",
            fontSize=10,
            leading=12,
            alignment=TA_LEFT,
            spaceAfter=2,
        )
        group_style = ParagraphStyle(
            "Group",
            parent=styles["Heading3"],
            fontName="Times-Bold",
            fontSize=12,
            leading=14,
            spaceBefore=8,
            spaceAfter=6,
        )
        header_style = ParagraphStyle(
            "HeaderCell",
            parent=styles["BodyText"],
            fontName="Times-Bold",
            fontSize=8,
            leading=10,
            alignment=TA_CENTER,
        )
        cell_left = ParagraphStyle(
            "CellLeft",
            parent=styles["BodyText"],
            fontName="Times-Roman",
            fontSize=8,
            leading=10,
            alignment=TA_LEFT,
        )
        cell_right = ParagraphStyle(
            "CellRight",
            parent=styles["BodyText"],
            fontName="Times-Roman",
            fontSize=8,
            leading=10,
            alignment=TA_RIGHT,
        )
        cell_center = ParagraphStyle(
            "CellCenter",
            parent=styles["BodyText"],
            fontName="Times-Roman",
            fontSize=8,
            leading=10,
            alignment=TA_CENTER,
        )

        story = [
            Paragraph("PRODUCT INVENTORY AUDIT REPORT", title_style),
            Paragraph(f"Prepared By: {safe_text(prepared_by)}", meta_style),
            Paragraph(f"Audit Period Type: {report.audit_period_type.value.title()}", meta_style),
            Paragraph(
                f"Period: {fmt_date(report.period_start_date)} to {fmt_date(report.period_end_date)}",
                meta_style,
            ),
            Paragraph(f"Generated At: {report.generated_at.isoformat()}", meta_style),
            Spacer(1, 6),
        ]

        col_widths = [
            8 * mm,   # No
            17 * mm,  # Period end
            18 * mm,  # Store
            27 * mm,  # Category
            28 * mm,  # Product
            13 * mm,  # Count
            13 * mm,  # Sample size
            14 * mm,  # Sample weight
            14 * mm,  # Avg weight
            15 * mm,  # Calc total
            15 * mm,  # Opening
            15 * mm,  # Inflows
            15 * mm,  # Outflows
            15 * mm,  # Closing
            13 * mm,  # Variance
            12 * mm,  # Variance %
            24 * mm,  # Remarks
        ]

        for group in report.groups:
            story.append(Paragraph(group.label, group_style))

            table_data = [[
                Paragraph("No.", header_style),
                Paragraph(period_label.replace(" ", "<br/>"), header_style),
                Paragraph("Store", header_style),
                Paragraph("Product<br/>Category", header_style),
                Paragraph("Product Type", header_style),
                Paragraph("Count<br/>(pcs)", header_style),
                Paragraph("Sample Size<br/>(pcs)", header_style),
                Paragraph("Sample Weight<br/>(kg)", header_style),
                Paragraph("Avg Weight<br/>(kg/pc)", header_style),
                Paragraph("Calculated<br/>Total (kg)", header_style),
                Paragraph("Ledger<br/>Opening", header_style),
                Paragraph("Ledger<br/>Inflows", header_style),
                Paragraph("Ledger<br/>Outflows", header_style),
                Paragraph("Ledger<br/>Closing", header_style),
                Paragraph("Variance<br/>(kg)", header_style),
                Paragraph("Variance<br/>(%)", header_style),
                Paragraph("Remarks", header_style),
            ]]

            for row in group.rows:
                table_data.append([
                    Paragraph(safe_text(row.index), cell_center),
                    Paragraph(fmt_date(row.period_end_date), cell_center),
                    Paragraph(row.store.value if hasattr(row.store, "value") else safe_text(row.store), cell_left),
                    Paragraph(safe_text(row.product_category_name), cell_left),
                    Paragraph(safe_text(row.product_name), cell_left),
                    Paragraph(safe_text(row.count_pcs), cell_right),
                    Paragraph(safe_text(row.sample_size_pcs), cell_right),
                    Paragraph(fmt_qty(row.sample_weight_kg), cell_right),
                    Paragraph(fmt_qty4(row.avg_weight_kg_per_pc), cell_right),
                    Paragraph(fmt_qty(row.calculated_total_kg), cell_right),
                    Paragraph(fmt_qty(row.ledger_opening_kg), cell_right),
                    Paragraph(fmt_qty(row.ledger_inflows_kg), cell_right),
                    Paragraph(fmt_qty(row.ledger_outflows_kg), cell_right),
                    Paragraph(fmt_qty(row.ledger_closing_kg), cell_right),
                    Paragraph(fmt_qty(row.variance_kg), cell_right),
                    Paragraph(fmt_pct(row.variance_pct), cell_right),
                    Paragraph(safe_text(row.remarks), cell_left),
                ])

            table = Table(table_data, colWidths=col_widths, repeatRows=1, hAlign="LEFT")
            table.setStyle(
                TableStyle([
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#E5E7EB")),
                    ("BACKGROUND", (0, -1), (-1, -1), colors.white),
                    ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#9CA3AF")),
                    ("INNERGRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#D1D5DB")),
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 4),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                    ("TOPPADDING", (0, 0), (-1, -1), 4),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ])
            )
            story.append(table)
            story.append(Spacer(1, 8))

        doc.build(story)
        return buffer.getvalue()

    def _render_consumable_report_pdf(
        self,
        report: ConsumableAuditReportResponse,
        *,
        prepared_by: str | None = None,
    ) -> bytes:
        try:
            from reportlab.lib import colors
            from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
            from reportlab.lib.pagesizes import A4, landscape
            from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
            from reportlab.lib.units import mm
            from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
        except ImportError as exc:
            raise RuntimeError("reportlab is required to generate PDF reports.") from exc

        prepared_by = self._resolve_prepared_by(prepared_by)
        period_label = self._period_date_column_label(report.audit_period_type)

        buffer = BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=landscape(A4),
            leftMargin=8 * mm,
            rightMargin=8 * mm,
            topMargin=8 * mm,
            bottomMargin=8 * mm,
        )

        styles = getSampleStyleSheet()
        title_style = ParagraphStyle(
            "Title",
            parent=styles["Title"],
            fontName="Times-Bold",
            fontSize=16,
            leading=20,
            alignment=TA_CENTER,
            spaceAfter=8,
        )
        meta_style = ParagraphStyle(
            "Meta",
            parent=styles["Normal"],
            fontName="Times-Roman",
            fontSize=10,
            leading=12,
            alignment=TA_LEFT,
            spaceAfter=2,
        )
        group_style = ParagraphStyle(
            "Group",
            parent=styles["Heading3"],
            fontName="Times-Bold",
            fontSize=12,
            leading=14,
            spaceBefore=8,
            spaceAfter=6,
        )
        header_style = ParagraphStyle(
            "HeaderCell",
            parent=styles["BodyText"],
            fontName="Times-Bold",
            fontSize=8,
            leading=10,
            alignment=TA_CENTER,
        )
        cell_left = ParagraphStyle(
            "CellLeft",
            parent=styles["BodyText"],
            fontName="Times-Roman",
            fontSize=8,
            leading=10,
            alignment=TA_LEFT,
        )
        cell_right = ParagraphStyle(
            "CellRight",
            parent=styles["BodyText"],
            fontName="Times-Roman",
            fontSize=8,
            leading=10,
            alignment=TA_RIGHT,
        )
        cell_center = ParagraphStyle(
            "CellCenter",
            parent=styles["BodyText"],
            fontName="Times-Roman",
            fontSize=8,
            leading=10,
            alignment=TA_CENTER,
        )

        story = [
            Paragraph("CONSUMABLE INVENTORY AUDIT REPORT", title_style),
            Paragraph(f"Prepared By: {safe_text(prepared_by)}", meta_style),
            Paragraph(f"Audit Period Type: {report.audit_period_type.value.title()}", meta_style),
            Paragraph(
                f"Period: {fmt_date(report.period_start_date)} to {fmt_date(report.period_end_date)}",
                meta_style,
            ),
            Paragraph(f"Generated At: {report.generated_at.isoformat()}", meta_style),
            Spacer(1, 6),
        ]

        col_widths = [
            10 * mm,  # Index
            20 * mm,  # Period end
            20 * mm,  # Store
            35 * mm,  # Item
            15 * mm,  # Unit
            21 * mm,  # Opening
            20 * mm,  # Issues
            22 * mm,  # Expected
            22 * mm,  # Physical
            18 * mm,  # Variance
            16 * mm,  # Variance %
            40 * mm,  # Remarks
        ]

        for group in report.groups:
            story.append(Paragraph(group.label, group_style))

            table_data = [[
                Paragraph("Index", header_style),
                Paragraph(period_label.replace(" ", "<br/>"), header_style),
                Paragraph("Store", header_style),
                Paragraph("Item", header_style),
                Paragraph("Unit", header_style),
                Paragraph("Opening<br/>Ledger", header_style),
                Paragraph("Issues<br/>(Total)", header_style),
                Paragraph("Expected<br/>Closing", header_style),
                Paragraph("Physical<br/>Count", header_style),
                Paragraph("Variance", header_style),
                Paragraph("Variance<br/>(%)", header_style),
                Paragraph("Remarks", header_style),
            ]]

            for row in group.rows:
                table_data.append([
                    Paragraph(safe_text(row.index), cell_center),
                    Paragraph(fmt_date(row.period_end_date), cell_center),
                    Paragraph(row.store.value if hasattr(row.store, "value") else safe_text(row.store), cell_left),
                    Paragraph(safe_text(row.item_name), cell_left),
                    Paragraph(safe_text(row.unit), cell_center),
                    Paragraph(fmt_qty(row.opening_ledger), cell_right),
                    Paragraph(fmt_qty(row.issues_total), cell_right),
                    Paragraph(fmt_qty(row.expected_closing), cell_right),
                    Paragraph(fmt_qty(row.physical_count), cell_right),
                    Paragraph(fmt_qty(row.variance), cell_right),
                    Paragraph(fmt_pct(row.variance_pct), cell_right),
                    Paragraph(safe_text(row.remarks), cell_left),
                ])

            table = Table(table_data, colWidths=col_widths, repeatRows=1, hAlign="LEFT")
            table.setStyle(
                TableStyle([
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#E5E7EB")),
                    ("BACKGROUND", (0, -1), (-1, -1), colors.white),
                    ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#9CA3AF")),
                    ("INNERGRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#D1D5DB")),
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 4),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                    ("TOPPADDING", (0, 0), (-1, -1), 4),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ])
            )
            story.append(table)
            story.append(Spacer(1, 8))

        doc.build(story)
        return buffer.getvalue()

    # =========================================================================
    # OPTIONAL FILE INFO HELPERS
    # =========================================================================

    def export_product_file_info(
        self,
        payload: ProductAuditReportRequest,
        *,
        prepared_by: str | None = None,
    ) -> AuditExportFileResponse:
        file = self.export_product_audit_report(payload, prepared_by=prepared_by)
        return file.to_schema(payload.audit_period_type, payload.export_format or "pdf")

    def export_consumable_file_info(
        self,
        payload: ConsumableAuditReportRequest,
        *,
        prepared_by: str | None = None,
    ) -> AuditExportFileResponse:
        file = self.export_consumable_audit_report(payload, prepared_by=prepared_by)
        return file.to_schema(payload.audit_period_type, payload.export_format or "pdf")