from __future__ import annotations

from datetime import date, datetime, timedelta
from decimal import Decimal, InvalidOperation, ROUND_CEILING, ROUND_HALF_UP
from typing import Any, Dict, List, Optional

from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    event,
)
from sqlalchemy.orm import relationship

from app.core.database import Base


class Order(Base):
    __tablename__ = "orders"

    ORDER_TYPE_LOCAL = "local"
    ORDER_TYPE_CHILLED = "chilled"
    ORDER_TYPE_FROZEN = "frozen"

    ORDER_PROFILE_STANDARD = "standard_order"
    ORDER_PROFILE_FROZEN_CONTAINER = "frozen_container"

    STATUS_DRAFT = "draft"
    STATUS_CONFIRMED = "confirmed"
    STATUS_IN_PROGRESS = "in_progress"
    STATUS_COMPLETED = "completed"
    STATUS_CANCELLED = "cancelled"

    # Pieces required logic stays separate from animals required logic.
    PIECES_DIVISORS = {
        "goat": Decimal("8.5"),
        "sheep": Decimal("11"),
        "cattle": Decimal("145"),
    }

    # Updated to your approved standard carcass weights.
    ANIMALS_DIVISORS = {
        "goat": Decimal("9"),
        "sheep": Decimal("13"),
        "cattle": Decimal("145"),
    }

    DELIVERY_OFFSETS = {
        ORDER_TYPE_LOCAL: 0,
        ORDER_TYPE_CHILLED: 2,
        ORDER_TYPE_FROZEN: 10,
    }

    ANIMAL_TYPE_ALIASES = {
        "goat": "goat",
        "goat_meat": "goat",
        "sheep": "sheep",
        "lamb": "sheep",
        "mutton": "sheep",
        "cattle": "cattle",
        "beef": "cattle",
        "cow": "cattle",
    }

    MONEY_2DP = Decimal("0.01")
    MONEY_4DP = Decimal("0.0001")
    QUANTITY_2DP = Decimal("0.01")
    ORDER_RATIO_MAX_LENGTH = 200

    id = Column(Integer, primary_key=True, index=True)

    # Core identity
    order_number = Column(String(100), unique=True, index=True, nullable=False)
    enterprise_name = Column(String(200), index=True, nullable=False)

    # One shared orders system, but with different entry/report profiles
    order_type = Column(String(30), index=True, nullable=False, default=ORDER_TYPE_LOCAL)
    order_profile = Column(
        String(30),
        index=True,
        nullable=False,
        default=ORDER_PROFILE_STANDARD,
    )
    order_subtype = Column(String(50), index=True, nullable=True)

    status = Column(String(30), index=True, nullable=False, default=STATUS_DRAFT)

    # Reporting month/year for business planning reports
    report_month = Column(Integer, index=True, nullable=True)
    report_year = Column(Integer, index=True, nullable=True)

    # Commercial / shipping / payment details
    order_ratio = Column(String(ORDER_RATIO_MAX_LENGTH), nullable=True)
    shipment_value_usd = Column(Numeric(14, 2), nullable=True)
    price_per_kg_usd = Column(Numeric(14, 4), nullable=True)
    amount_paid_usd = Column(Numeric(14, 2), nullable=True)
    balance_usd = Column(Numeric(14, 2), nullable=True)

    container_gate_in = Column(Date, index=True, nullable=True)
    departure_date = Column(Date, index=True, nullable=True)
    jurisdiction = Column(String(100), index=True, nullable=True)

    product_summary = Column(Text, nullable=True)

    # One order can still carry multiple lines/products.
    items_json = Column(JSON, nullable=False, default=list)

    # Operational totals
    total_quantity_kg = Column(Numeric(14, 2), nullable=False, default=0)
    total_pieces_required = Column(Integer, nullable=False, default=0)
    total_animals_required = Column(Integer, nullable=False, default=0)

    # Goat totals
    goat_quantity_kg = Column(Numeric(14, 2), nullable=False, default=0)
    goat_pieces_required = Column(Integer, nullable=False, default=0)
    goats_required = Column(Integer, nullable=False, default=0)

    # Sheep totals
    sheep_quantity_kg = Column(Numeric(14, 2), nullable=False, default=0)
    sheep_pieces_required = Column(Integer, nullable=False, default=0)
    sheep_required = Column(Integer, nullable=False, default=0)

    # Cattle totals
    cattle_quantity_kg = Column(Numeric(14, 2), nullable=False, default=0)
    cattle_pieces_required = Column(Integer, nullable=False, default=0)
    cattle_required = Column(Integer, nullable=False, default=0)

    # Operational dates
    slaughter_schedule = Column(Date, index=True, nullable=True)
    expected_delivery = Column(Date, index=True, nullable=True)

    # If False, expected_delivery is auto-computed from order_type/slaughter_schedule.
    # If True, user has manually overridden it.
    is_delivery_date_manual = Column(Boolean, nullable=False, default=False)

    # Optional custom offset if user wants auto-date but not the default offset.
    delivery_days_offset = Column(Integer, nullable=True)

    notes = Column(Text, nullable=True)

    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    updated_by_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)

    created_by = relationship("User", foreign_keys=[created_by_id])
    updated_by = relationship("User", foreign_keys=[updated_by_id])

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )

    def __repr__(self) -> str:
        return (
            f"<Order(id={self.id}, order_number='{self.order_number}', "
            f"enterprise_name='{self.enterprise_name}', order_type='{self.order_type}', "
            f"order_profile='{self.order_profile}', status='{self.status}')>"
        )

    @staticmethod
    def normalize_slug(value: Optional[str]) -> str:
        text = (value or "").strip().lower().replace("-", "_").replace(" ", "_")
        while "__" in text:
            text = text.replace("__", "_")
        return text

    @staticmethod
    def normalize_text(value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        text = str(value).strip()
        return text or None

    @classmethod
    def normalize_order_type(cls, value: Optional[str]) -> str:
        text = cls.normalize_slug(value)
        if text not in {
            cls.ORDER_TYPE_LOCAL,
            cls.ORDER_TYPE_CHILLED,
            cls.ORDER_TYPE_FROZEN,
        }:
            raise ValueError("Invalid order type. Use local, chilled, or frozen.")
        return text

    @classmethod
    def normalize_order_profile(cls, value: Optional[str]) -> str:
        text = cls.normalize_slug(value)
        if text not in {
            cls.ORDER_PROFILE_STANDARD,
            cls.ORDER_PROFILE_FROZEN_CONTAINER,
        }:
            raise ValueError("Invalid order profile. Use standard_order or frozen_container.")
        return text

    @classmethod
    def normalize_status(cls, value: Optional[str]) -> str:
        text = cls.normalize_slug(value)
        if text not in {
            cls.STATUS_DRAFT,
            cls.STATUS_CONFIRMED,
            cls.STATUS_IN_PROGRESS,
            cls.STATUS_COMPLETED,
            cls.STATUS_CANCELLED,
        }:
            raise ValueError(
                "Invalid status. Use draft, confirmed, in_progress, completed, or cancelled."
            )
        return text

    @classmethod
    def normalize_order_subtype(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        text = cls.normalize_slug(value)
        return text or None

    @classmethod
    def normalize_animal_type(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        cleaned = cls.normalize_slug(value)
        return cls.ANIMAL_TYPE_ALIASES.get(cleaned)

    @classmethod
    def infer_animal_type(
        cls,
        product_name: Optional[str],
        animal_type: Optional[str] = None,
    ) -> str:
        normalized_animal_type = cls.normalize_animal_type(animal_type)
        if normalized_animal_type:
            return normalized_animal_type

        normalized_from_name = cls.normalize_animal_type(product_name)
        if normalized_from_name:
            return normalized_from_name

        raise ValueError(
            "Could not determine animal type. Use goat, sheep/lamb, or cattle/beef."
        )

    @staticmethod
    def safe_float(value: Any) -> float:
        if value in (None, "", "null"):
            return 0.0
        try:
            number = float(value)
        except (TypeError, ValueError):
            raise ValueError(f"Invalid numeric value: {value}")
        return max(number, 0.0)

    @classmethod
    def safe_decimal(cls, value: Any, places: Decimal = None, allow_zero: bool = True) -> Decimal:
        places = places or cls.QUANTITY_2DP

        if value in (None, "", "null"):
            number = Decimal("0")
        else:
            try:
                number = Decimal(str(value))
            except (InvalidOperation, TypeError, ValueError):
                raise ValueError(f"Invalid numeric value: {value}")

        if number < 0:
            number = Decimal("0")

        if not allow_zero and number <= 0:
            raise ValueError(f"Value must be greater than zero: {value}")

        return number.quantize(places, rounding=ROUND_HALF_UP)

    @classmethod
    def safe_money(cls, value: Any, places: Decimal = None) -> Decimal:
        places = places or cls.MONEY_2DP

        if value in (None, "", "null"):
            return Decimal("0.00").quantize(places)

        try:
            number = Decimal(str(value))
        except (InvalidOperation, TypeError, ValueError):
            raise ValueError(f"Invalid money value: {value}")

        if number < 0:
            number = Decimal("0.00")

        return number.quantize(places, rounding=ROUND_HALF_UP)

    @classmethod
    def calculate_required_units(cls, quantity_kg: float, divisor: Decimal) -> int:
        quantity = cls.safe_decimal(quantity_kg, cls.QUANTITY_2DP)
        if quantity <= 0 or divisor <= 0:
            return 0
        return int((quantity / divisor).to_integral_value(rounding=ROUND_CEILING))

    @classmethod
    def calculate_pieces_required(cls, quantity_kg: float, animal_type: str) -> int:
        divisor = cls.PIECES_DIVISORS.get(animal_type)
        if not divisor:
            raise ValueError(f"Unsupported animal type for pieces calculation: {animal_type}")
        return cls.calculate_required_units(quantity_kg, divisor)

    @classmethod
    def calculate_animals_required(cls, quantity_kg: float, animal_type: str) -> int:
        divisor = cls.ANIMALS_DIVISORS.get(animal_type)
        if not divisor:
            raise ValueError(f"Unsupported animal type for animals calculation: {animal_type}")
        return cls.calculate_required_units(quantity_kg, divisor)

    @classmethod
    def get_default_delivery_offset(cls, order_type: str) -> int:
        return cls.DELIVERY_OFFSETS.get(order_type, 0)

    @classmethod
    def normalize_items(cls, items: Optional[List[Dict[str, Any]]]) -> List[Dict[str, Any]]:
        if not items:
            return []

        normalized_items: List[Dict[str, Any]] = []

        for raw_item in items:
            if not isinstance(raw_item, dict):
                raise ValueError("Each order item must be an object/dictionary")

            product_name = cls.normalize_text(raw_item.get("product_name")) or ""
            raw_animal_type = raw_item.get("animal_type")
            quantity_kg = cls.safe_float(raw_item.get("quantity_kg"))

            if not product_name and not raw_animal_type:
                raise ValueError("Each order item must include product_name or animal_type")

            animal_type = cls.infer_animal_type(product_name, raw_animal_type)
            pieces_required = cls.calculate_pieces_required(quantity_kg, animal_type)
            animals_required = cls.calculate_animals_required(quantity_kg, animal_type)

            normalized_items.append(
                {
                    "product_name": product_name or animal_type.title(),
                    "animal_type": animal_type,
                    "quantity_kg": float(
                        cls.safe_decimal(quantity_kg, cls.QUANTITY_2DP)
                    ),
                    "pieces_required": pieces_required,
                    "animals_required": animals_required,
                    "notes": cls.normalize_text(raw_item.get("notes")),
                }
            )

        return normalized_items

    @classmethod
    def build_product_summary(cls, items: List[Dict[str, Any]]) -> Optional[str]:
        if not items:
            return None

        parts: List[str] = []
        for item in items:
            product_name = item.get("product_name") or item.get("animal_type", "").title()
            quantity_kg = float(item.get("quantity_kg", 0) or 0)
            parts.append(f"{product_name} {quantity_kg:,.2f} kg")
        return ", ".join(parts)

    @classmethod
    def validate_report_period(
        cls,
        month: Optional[int],
        year: Optional[int],
    ) -> tuple[Optional[int], Optional[int]]:
        if month is None and year is None:
            return None, None

        if month is None or year is None:
            raise ValueError("Both report_month and report_year must be provided together.")

        if int(month) < 1 or int(month) > 12:
            raise ValueError("report_month must be between 1 and 12.")

        if int(year) < 2000 or int(year) > 2100:
            raise ValueError("report_year must be between 2000 and 2100.")

        return int(month), int(year)

    @classmethod
    def get_reporting_anchor_date(cls, target: "Order") -> Optional[date]:
        if target.order_profile == cls.ORDER_PROFILE_FROZEN_CONTAINER:
            return (
                target.container_gate_in
                or target.departure_date
                or target.slaughter_schedule
                or target.expected_delivery
            )

        return (
            target.slaughter_schedule
            or target.expected_delivery
            or target.container_gate_in
            or target.departure_date
        )

    @classmethod
    def apply_financial_computations(cls, target: "Order") -> None:
        total_qty = Decimal(str(target.total_quantity_kg or 0)).quantize(
            cls.MONEY_2DP,
            rounding=ROUND_HALF_UP,
        )

        shipment_value = cls.safe_money(target.shipment_value_usd, cls.MONEY_2DP)
        price_per_kg = cls.safe_money(target.price_per_kg_usd, cls.MONEY_4DP)
        amount_paid = cls.safe_money(target.amount_paid_usd, cls.MONEY_2DP)

        if shipment_value <= 0 and price_per_kg > 0 and total_qty > 0:
            shipment_value = (price_per_kg * total_qty).quantize(
                cls.MONEY_2DP,
                rounding=ROUND_HALF_UP,
            )

        if price_per_kg <= 0 and shipment_value > 0 and total_qty > 0:
            price_per_kg = (shipment_value / total_qty).quantize(
                cls.MONEY_4DP,
                rounding=ROUND_HALF_UP,
            )

        balance = (shipment_value - amount_paid).quantize(
            cls.MONEY_2DP,
            rounding=ROUND_HALF_UP,
        )
        if balance < 0:
            balance = Decimal("0.00")

        target.shipment_value_usd = shipment_value
        target.price_per_kg_usd = price_per_kg if price_per_kg > 0 else None
        target.amount_paid_usd = amount_paid if amount_paid > 0 else Decimal("0.00")
        target.balance_usd = balance

    @classmethod
    def apply_computations(cls, target: "Order") -> None:
        target.order_number = (target.order_number or "").strip()
        if not target.order_number:
            raise ValueError("Order number is required")

        target.enterprise_name = (target.enterprise_name or "").strip()
        if not target.enterprise_name:
            raise ValueError("Enterprise name is required")

        target.order_profile = cls.normalize_order_profile(target.order_profile)

        if target.order_profile == cls.ORDER_PROFILE_FROZEN_CONTAINER:
            target.order_type = cls.ORDER_TYPE_FROZEN
        else:
            target.order_type = cls.normalize_order_type(target.order_type)

        target.status = cls.normalize_status(target.status)
        target.order_subtype = cls.normalize_order_subtype(target.order_subtype)

        target.order_ratio = cls.normalize_text(target.order_ratio)
        target.jurisdiction = cls.normalize_text(target.jurisdiction)
        target.notes = cls.normalize_text(target.notes)

        normalized_items = cls.normalize_items(target.items_json)
        target.items_json = normalized_items
        target.product_summary = cls.build_product_summary(normalized_items)

        goat_qty = Decimal("0.00")
        sheep_qty = Decimal("0.00")
        cattle_qty = Decimal("0.00")

        goat_pieces = 0
        sheep_pieces = 0
        cattle_pieces = 0

        goats_required = 0
        sheep_required = 0
        cattle_required = 0

        total_quantity_kg = Decimal("0.00")
        total_pieces_required = 0
        total_animals_required = 0

        for item in normalized_items:
            animal_type = item["animal_type"]
            quantity_kg = cls.safe_decimal(item["quantity_kg"], cls.QUANTITY_2DP)
            pieces_required = int(item["pieces_required"] or 0)
            animals_required = int(item["animals_required"] or 0)

            total_quantity_kg += quantity_kg
            total_pieces_required += pieces_required
            total_animals_required += animals_required

            if animal_type == "goat":
                goat_qty += quantity_kg
                goat_pieces += pieces_required
                goats_required += animals_required
            elif animal_type == "sheep":
                sheep_qty += quantity_kg
                sheep_pieces += pieces_required
                sheep_required += animals_required
            elif animal_type == "cattle":
                cattle_qty += quantity_kg
                cattle_pieces += pieces_required
                cattle_required += animals_required

        target.total_quantity_kg = total_quantity_kg.quantize(cls.QUANTITY_2DP, rounding=ROUND_HALF_UP)
        target.total_pieces_required = total_pieces_required
        target.total_animals_required = total_animals_required

        target.goat_quantity_kg = goat_qty.quantize(cls.QUANTITY_2DP, rounding=ROUND_HALF_UP)
        target.goat_pieces_required = goat_pieces
        target.goats_required = goats_required

        target.sheep_quantity_kg = sheep_qty.quantize(cls.QUANTITY_2DP, rounding=ROUND_HALF_UP)
        target.sheep_pieces_required = sheep_pieces
        target.sheep_required = sheep_required

        target.cattle_quantity_kg = cattle_qty.quantize(cls.QUANTITY_2DP, rounding=ROUND_HALF_UP)
        target.cattle_pieces_required = cattle_pieces
        target.cattle_required = cattle_required

        if target.slaughter_schedule:
            if not target.is_delivery_date_manual:
                offset = (
                    target.delivery_days_offset
                    if target.delivery_days_offset is not None
                    else cls.get_default_delivery_offset(target.order_type)
                )
                if offset < 0:
                    offset = 0
                target.expected_delivery = target.slaughter_schedule + timedelta(days=offset)
        else:
            if not target.is_delivery_date_manual:
                target.expected_delivery = None

        cls.apply_financial_computations(target)

        report_month, report_year = cls.validate_report_period(
            target.report_month,
            target.report_year,
        )

        if report_month is None and report_year is None:
            anchor_date = cls.get_reporting_anchor_date(target)
            if anchor_date:
                target.report_month = anchor_date.month
                target.report_year = anchor_date.year
            else:
                target.report_month = None
                target.report_year = None
        else:
            target.report_month = report_month
            target.report_year = report_year


@event.listens_for(Order, "before_insert")
def before_insert_order(mapper, connection, target: Order) -> None:
    Order.apply_computations(target)


@event.listens_for(Order, "before_update")
def before_update_order(mapper, connection, target: Order) -> None:
    Order.apply_computations(target)