from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    Numeric,
    String,
    Text,
    event,
    func,
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base

DEFAULT_BREAK_EVEN_QUANTITY_TONNES = Decimal("133.70")
DEFAULT_BREAK_EVEN_VALUE_USD = Decimal("77347.00")
DEFAULT_BREAK_EVEN_USD_PER_TONNE = (
    DEFAULT_BREAK_EVEN_VALUE_USD / DEFAULT_BREAK_EVEN_QUANTITY_TONNES
).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)

TWO_PLACES = Decimal("0.01")
FOUR_PLACES = Decimal("0.0001")


def quantize_2(value: Decimal | int | float | str | None) -> Decimal:
    if value is None or value == "":
        return Decimal("0.00")
    return Decimal(str(value)).quantize(TWO_PLACES, rounding=ROUND_HALF_UP)


def quantize_4(value: Decimal | int | float | str | None) -> Decimal:
    if value is None or value == "":
        return Decimal("0.0000")
    return Decimal(str(value)).quantize(FOUR_PLACES, rounding=ROUND_HALF_UP)


class BreakevenSetting(Base):
    __tablename__ = "breakeven_settings"

    __table_args__ = (
        CheckConstraint(
            "scope_type IN ('global', 'monthly')",
            name="ck_breakeven_settings_scope_type",
        ),
        CheckConstraint(
            "month IS NULL OR (month >= 1 AND month <= 12)",
            name="ck_breakeven_settings_month_range",
        ),
        CheckConstraint(
            "year IS NULL OR year >= 2000",
            name="ck_breakeven_settings_year_range",
        ),
        CheckConstraint(
            "break_even_quantity_tonnes > 0",
            name="ck_breakeven_settings_quantity_positive",
        ),
        CheckConstraint(
            "break_even_usd_per_tonne > 0",
            name="ck_breakeven_settings_rate_positive",
        ),
        CheckConstraint(
            "break_even_value_usd >= 0",
            name="ck_breakeven_settings_value_non_negative",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    setting_name: Mapped[str] = mapped_column(
        String(120),
        nullable=False,
        default="Default Breakeven Setting",
    )
    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    scope_type: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="global",
    )
    month: Mapped[int | None] = mapped_column(
        nullable=True,
    )
    year: Mapped[int | None] = mapped_column(
        nullable=True,
    )

    break_even_quantity_tonnes: Mapped[Decimal] = mapped_column(
        Numeric(14, 2),
        nullable=False,
        default=DEFAULT_BREAK_EVEN_QUANTITY_TONNES,
    )
    break_even_usd_per_tonne: Mapped[Decimal] = mapped_column(
        Numeric(14, 4),
        nullable=False,
        default=DEFAULT_BREAK_EVEN_USD_PER_TONNE,
    )
    break_even_value_usd: Mapped[Decimal] = mapped_column(
        Numeric(14, 2),
        nullable=False,
        default=DEFAULT_BREAK_EVEN_VALUE_USD,
    )

    notes: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    def normalize_scope(self) -> None:
        scope = (self.scope_type or "global").strip().lower()
        self.scope_type = scope if scope in {"global", "monthly"} else "global"

        if self.scope_type == "global":
            self.month = None
            self.year = None

    def recalculate_break_even_value(self) -> None:
        quantity = quantize_2(self.break_even_quantity_tonnes)
        rate = quantize_4(self.break_even_usd_per_tonne)
        self.break_even_quantity_tonnes = quantity
        self.break_even_usd_per_tonne = rate
        self.break_even_value_usd = (quantity * rate).quantize(
            TWO_PLACES,
            rounding=ROUND_HALF_UP,
        )

    def prepare_for_save(self) -> None:
        self.normalize_scope()
        self.recalculate_break_even_value()


@event.listens_for(BreakevenSetting, "before_insert")
def breakeven_setting_before_insert(mapper, connection, target: BreakevenSetting) -> None:
    target.prepare_for_save()


@event.listens_for(BreakevenSetting, "before_update")
def breakeven_setting_before_update(mapper, connection, target: BreakevenSetting) -> None:
    target.prepare_for_save()