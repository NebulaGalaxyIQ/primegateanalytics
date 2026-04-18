from __future__ import annotations

import uuid
from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    Date,
    DateTime,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    event,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import validates

try:
    # Common pattern in FastAPI/SQLAlchemy projects
   from app.core.database import Base
except ImportError:
    # Fallback if your project uses a different Base location
  from app.core.database import Base


DECIMAL_ZERO_2 = Decimal("0.00")
DECIMAL_ZERO_3 = Decimal("0.000")
TWOPLACES = Decimal("0.01")
THREEPLACES = Decimal("0.001")


def normalize_text(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    value = value.strip()
    return value or None


def to_decimal(value, places: Decimal = TWOPLACES, default: Decimal = DECIMAL_ZERO_2) -> Decimal:
    if value is None or value == "":
        return default
    if isinstance(value, Decimal):
        return value.quantize(places, rounding=ROUND_HALF_UP)
    return Decimal(str(value)).quantize(places, rounding=ROUND_HALF_UP)


class SlaughterService(Base):
    """
    Slaughter services (stored in saas.py module as requested).

    User-editable fields:
    - service_date
    - client_name
    - animal_type
    - total_animals
    - unit_price_per_head_usd
    - unit_price_offal_usd

    Auto-calculated/stored fields:
    - total_revenue_usd
    - total_offal_revenue_usd
    - total_combined_revenue_usd

    Notes:
    - Totals are always recalculated before insert/update.
    - If total_animals is 0, totals become 0.00.
    - Unit prices are stored with 3 decimal places.
    - Revenues are stored with 2 decimal places.
    """

    __tablename__ = "slaughter_services"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, nullable=False)

    service_date = Column(Date, nullable=False, index=True)
    client_name = Column(String(255), nullable=True, index=True)
    animal_type = Column(String(100), nullable=True, index=True)

    total_animals = Column(Integer, nullable=False, default=0, server_default="0")

    # Editable price inputs
    unit_price_per_head_usd = Column(
        Numeric(12, 3),
        nullable=False,
        default=DECIMAL_ZERO_3,
        server_default="0.000",
    )
    unit_price_offal_usd = Column(
        Numeric(12, 3),
        nullable=False,
        default=DECIMAL_ZERO_3,
        server_default="0.000",
    )

    # Auto-calculated stored totals
    total_revenue_usd = Column(
        Numeric(14, 2),
        nullable=False,
        default=DECIMAL_ZERO_2,
        server_default="0.00",
    )
    total_offal_revenue_usd = Column(
        Numeric(14, 2),
        nullable=False,
        default=DECIMAL_ZERO_2,
        server_default="0.00",
    )
    total_combined_revenue_usd = Column(
        Numeric(14, 2),
        nullable=False,
        default=DECIMAL_ZERO_2,
        server_default="0.00",
    )

    notes = Column(Text, nullable=True)

    is_active = Column(Boolean, nullable=False, default=True, server_default="true")

    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    __table_args__ = (
        CheckConstraint("total_animals >= 0", name="ck_slaughter_services_total_animals_non_negative"),
        CheckConstraint(
            "unit_price_per_head_usd >= 0",
            name="ck_slaughter_services_unit_price_per_head_non_negative",
        ),
        CheckConstraint(
            "unit_price_offal_usd >= 0",
            name="ck_slaughter_services_unit_price_offal_non_negative",
        ),
        CheckConstraint(
            "total_revenue_usd >= 0",
            name="ck_slaughter_services_total_revenue_non_negative",
        ),
        CheckConstraint(
            "total_offal_revenue_usd >= 0",
            name="ck_slaughter_services_total_offal_revenue_non_negative",
        ),
        CheckConstraint(
            "total_combined_revenue_usd >= 0",
            name="ck_slaughter_services_total_combined_revenue_non_negative",
        ),
        Index("ix_slaughter_services_date_client", "service_date", "client_name"),
        Index("ix_slaughter_services_date_animal", "service_date", "animal_type"),
    )

    @validates("client_name", "animal_type", "notes")
    def validate_text_fields(self, key, value):
        return normalize_text(value)

    @validates("total_animals")
    def validate_total_animals(self, key, value):
        if value is None or value == "":
            return 0
        value = int(value)
        if value < 0:
            raise ValueError("total_animals cannot be negative")
        return value

    @validates("unit_price_per_head_usd", "unit_price_offal_usd")
    def validate_unit_prices(self, key, value):
        value = to_decimal(value, places=THREEPLACES, default=DECIMAL_ZERO_3)
        if value < 0:
            raise ValueError(f"{key} cannot be negative")
        return value

    def recalculate_totals(self) -> None:
        animals = int(self.total_animals or 0)

        per_head = to_decimal(
            self.unit_price_per_head_usd,
            places=THREEPLACES,
            default=DECIMAL_ZERO_3,
        )
        offal = to_decimal(
            self.unit_price_offal_usd,
            places=THREEPLACES,
            default=DECIMAL_ZERO_3,
        )

        service_total = (Decimal(animals) * per_head).quantize(TWOPLACES, rounding=ROUND_HALF_UP)
        offal_total = (Decimal(animals) * offal).quantize(TWOPLACES, rounding=ROUND_HALF_UP)
        combined_total = (service_total + offal_total).quantize(TWOPLACES, rounding=ROUND_HALF_UP)

        self.total_revenue_usd = service_total
        self.total_offal_revenue_usd = offal_total
        self.total_combined_revenue_usd = combined_total

    @property
    def month(self) -> int:
        return self.service_date.month if isinstance(self.service_date, date) else 0

    @property
    def year(self) -> int:
        return self.service_date.year if isinstance(self.service_date, date) else 0

    def to_report_dict(self) -> dict:
        return {
            "id": str(self.id) if self.id else None,
            "service_date": self.service_date.isoformat() if self.service_date else None,
            "client_name": self.client_name,
            "animal_type": self.animal_type,
            "total_animals": self.total_animals or 0,
            "unit_price_per_head_usd": str(
                to_decimal(self.unit_price_per_head_usd, places=THREEPLACES, default=DECIMAL_ZERO_3)
            ),
            "total_revenue_usd": str(
                to_decimal(self.total_revenue_usd, places=TWOPLACES, default=DECIMAL_ZERO_2)
            ),
            "unit_price_offal_usd": str(
                to_decimal(self.unit_price_offal_usd, places=THREEPLACES, default=DECIMAL_ZERO_3)
            ),
            "total_offal_revenue_usd": str(
                to_decimal(self.total_offal_revenue_usd, places=TWOPLACES, default=DECIMAL_ZERO_2)
            ),
            "total_combined_revenue_usd": str(
                to_decimal(self.total_combined_revenue_usd, places=TWOPLACES, default=DECIMAL_ZERO_2)
            ),
            "notes": self.notes,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

    def __repr__(self) -> str:
        return (
            f"<SlaughterService(id={self.id}, date={self.service_date}, "
            f"client={self.client_name}, animal_type={self.animal_type}, "
            f"animals={self.total_animals}, combined={self.total_combined_revenue_usd})>"
        )


@event.listens_for(SlaughterService, "before_insert")
def saas_before_insert(mapper, connection, target: SlaughterService):
    target.client_name = normalize_text(target.client_name)
    target.animal_type = normalize_text(target.animal_type)
    target.notes = normalize_text(target.notes)
    target.total_animals = int(target.total_animals or 0)
    target.unit_price_per_head_usd = to_decimal(
        target.unit_price_per_head_usd,
        places=THREEPLACES,
        default=DECIMAL_ZERO_3,
    )
    target.unit_price_offal_usd = to_decimal(
        target.unit_price_offal_usd,
        places=THREEPLACES,
        default=DECIMAL_ZERO_3,
    )
    target.recalculate_totals()


@event.listens_for(SlaughterService, "before_update")
def saas_before_update(mapper, connection, target: SlaughterService):
    target.client_name = normalize_text(target.client_name)
    target.animal_type = normalize_text(target.animal_type)
    target.notes = normalize_text(target.notes)
    target.total_animals = int(target.total_animals or 0)
    target.unit_price_per_head_usd = to_decimal(
        target.unit_price_per_head_usd,
        places=THREEPLACES,
        default=DECIMAL_ZERO_3,
    )
    target.unit_price_offal_usd = to_decimal(
        target.unit_price_offal_usd,
        places=THREEPLACES,
        default=DECIMAL_ZERO_3,
    )
    target.recalculate_totals()