from __future__ import annotations

import uuid
from datetime import date, timedelta
from decimal import Decimal
from enum import Enum

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    Date,
    DateTime,
    Enum as SAEnum,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    event,
    func,
)
from sqlalchemy.orm import Session, relationship, validates

from app.core.database import Base


TWOPLACES = Decimal("0.01")


def qty(value) -> Decimal:
    """Normalize numeric-like values to Decimal with 2 decimal places."""
    if value is None:
        return Decimal("0.00")
    if isinstance(value, Decimal):
        return value.quantize(TWOPLACES)
    return Decimal(str(value)).quantize(TWOPLACES)


def normalize_name_key(value: str | None) -> str | None:
    """Normalize a name for duplicate checking."""
    if value is None:
        return None
    cleaned = " ".join(str(value).strip().split())
    return cleaned.lower() if cleaned else None


def clean_text(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = " ".join(str(value).strip().split())
    return cleaned or None


def enum_values(enum_cls: type[Enum]) -> list[str]:
    """Make SQLAlchemy persist enum .value strings instead of enum member names."""
    return [member.value for member in enum_cls]


class ProductStoreName(str, Enum):
    CHILLER_1 = "Chiller 1"
    CHILLER_2 = "Chiller 2"
    CHILLER_3 = "Chiller 3"
    FREEZER = "Freezer"
    BLAST_FREEZER = "Blast Freezer"
    HANGING_AREA = "Hanging area"
    CONTAINER_1 = "Container 1"
    CONTAINER_2 = "Container 2"
    CONTAINER_3 = "Container 3"
    CONTAINER_4 = "Container 4"
    CONTAINER_5 = "Container 5"


class ConsumableStoreName(str, Enum):
    STORE_1 = "Store 1"
    STORE_2 = "Store 2"


class ProductBalanceUnit(str, Enum):
    KG = "kg"
    PCS = "pcs"


class TimestampMixin:
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )


class UUIDPrimaryKeyMixin:
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))


class InventoryProductCategory(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "inventory_product_categories"

    name = Column(String(150), nullable=False)
    name_key = Column(String(150), nullable=False, unique=True)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True, server_default="true")
    sort_order = Column(Integer, nullable=False, default=0, server_default="0")

    products = relationship(
        "InventoryProduct",
        back_populates="category",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    inventory_entries = relationship("ProductStoreInventory", back_populates="product_category")

    @validates("name")
    def validate_name(self, key, value):
        cleaned = clean_text(value)
        if not cleaned:
            raise ValueError("Product category name is required.")
        self.name_key = normalize_name_key(cleaned)
        return cleaned

    def __repr__(self) -> str:
        return f"<InventoryProductCategory id={self.id} name={self.name!r}>"


class InventoryProduct(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "inventory_products"
    __table_args__ = (
        UniqueConstraint("category_id", "name_key", name="uq_inventory_product_category_name"),
        Index("ix_inventory_products_category_active", "category_id", "is_active"),
    )

    category_id = Column(
        String(36),
        ForeignKey("inventory_product_categories.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    name = Column(String(200), nullable=False)
    name_key = Column(String(200), nullable=False)
    default_stock_unit = Column(
        SAEnum(
            ProductBalanceUnit,
            name="inventory_product_balance_unit_enum",
            native_enum=False,
            validate_strings=True,
            values_callable=enum_values,
        ),
        nullable=False,
        default=ProductBalanceUnit.KG,
        server_default=ProductBalanceUnit.KG.value,
    )
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True, server_default="true")
    sort_order = Column(Integer, nullable=False, default=0, server_default="0")

    category = relationship("InventoryProductCategory", back_populates="products")
    inventory_entries = relationship("ProductStoreInventory", back_populates="product")

    @validates("name")
    def validate_name(self, key, value):
        cleaned = clean_text(value)
        if not cleaned:
            raise ValueError("Product name is required.")
        self.name_key = normalize_name_key(cleaned)
        return cleaned

    def __repr__(self) -> str:
        return f"<InventoryProduct id={self.id} name={self.name!r} category_id={self.category_id}>"


class InventoryConsumableCategory(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "inventory_consumable_categories"

    name = Column(String(150), nullable=False)
    name_key = Column(String(150), nullable=False, unique=True)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True, server_default="true")
    sort_order = Column(Integer, nullable=False, default=0, server_default="0")

    items = relationship(
        "InventoryConsumableItem",
        back_populates="category",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    inventory_entries = relationship("ConsumableStoreInventory", back_populates="item_category")

    @validates("name")
    def validate_name(self, key, value):
        cleaned = clean_text(value)
        if not cleaned:
            raise ValueError("Consumable category name is required.")
        self.name_key = normalize_name_key(cleaned)
        return cleaned

    def __repr__(self) -> str:
        return f"<InventoryConsumableCategory id={self.id} name={self.name!r}>"


class InventoryConsumableItem(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "inventory_consumable_items"
    __table_args__ = (
        UniqueConstraint("category_id", "name_key", name="uq_inventory_consumable_item_category_name"),
        Index("ix_inventory_consumable_items_category_active", "category_id", "is_active"),
    )

    category_id = Column(
        String(36),
        ForeignKey("inventory_consumable_categories.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    name = Column(String(200), nullable=False)
    name_key = Column(String(200), nullable=False)
    default_unit = Column(String(50), nullable=False, default="pcs", server_default="pcs")
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True, server_default="true")
    sort_order = Column(Integer, nullable=False, default=0, server_default="0")

    category = relationship("InventoryConsumableCategory", back_populates="items")
    inventory_entries = relationship("ConsumableStoreInventory", back_populates="item")

    @validates("name")
    def validate_name(self, key, value):
        cleaned = clean_text(value)
        if not cleaned:
            raise ValueError("Consumable item name is required.")
        self.name_key = normalize_name_key(cleaned)
        return cleaned

    @validates("default_unit")
    def validate_default_unit(self, key, value):
        cleaned = clean_text(value)
        if not cleaned:
            raise ValueError("Consumable unit is required.")
        return cleaned

    def __repr__(self) -> str:
        return f"<InventoryConsumableItem id={self.id} name={self.name!r} category_id={self.category_id}>"


class ProductStoreInventory(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """
    Daily product stock-taking entry.

    Closing Balance =
        opening_balance
        + inflow_production
        + inflow_transfers_in
        - outflow_dispatch
        - outflow_transfers_out
    """

    __tablename__ = "product_store_inventory"
    __table_args__ = (
        UniqueConstraint(
            "entry_date",
            "store",
            "product_id",
            name="uq_product_store_inventory_date_store_product",
        ),
        CheckConstraint("opening_balance >= 0", name="ck_product_store_inventory_opening_non_negative"),
        CheckConstraint("inflow_production >= 0", name="ck_product_store_inventory_inflow_production_non_negative"),
        CheckConstraint("inflow_transfers_in >= 0", name="ck_product_store_inventory_inflow_transfers_in_non_negative"),
        CheckConstraint("outflow_dispatch >= 0", name="ck_product_store_inventory_outflow_dispatch_non_negative"),
        CheckConstraint("outflow_transfers_out >= 0", name="ck_product_store_inventory_outflow_transfers_out_non_negative"),
        CheckConstraint("closing_balance >= 0", name="ck_product_store_inventory_closing_non_negative"),
        CheckConstraint("total_boxes >= 0", name="ck_product_store_inventory_total_boxes_non_negative"),
        CheckConstraint("total_pieces >= 0", name="ck_product_store_inventory_total_pieces_non_negative"),
        Index("ix_product_store_inventory_date_store", "entry_date", "store"),
    )

    serial_no = Column(Integer, nullable=True)
    entry_date = Column(Date, nullable=False, index=True)
    store = Column(
        SAEnum(
            ProductStoreName,
            name="product_store_name_enum",
            native_enum=False,
            validate_strings=True,
            values_callable=enum_values,
        ),
        nullable=False,
        index=True,
    )

    product_category_id = Column(
        String(36),
        ForeignKey("inventory_product_categories.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    product_id = Column(
        String(36),
        ForeignKey("inventory_products.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    product_category_name = Column(String(150), nullable=False)
    product_name = Column(String(200), nullable=False)

    balance_unit = Column(
        SAEnum(
            ProductBalanceUnit,
            name="product_inventory_balance_unit_enum",
            native_enum=False,
            validate_strings=True,
            values_callable=enum_values,
        ),
        nullable=False,
        default=ProductBalanceUnit.KG,
        server_default=ProductBalanceUnit.KG.value,
    )

    opening_balance = Column(Numeric(14, 2), nullable=False, default=Decimal("0.00"), server_default="0")
    inflow_production = Column(Numeric(14, 2), nullable=False, default=Decimal("0.00"), server_default="0")
    inflow_transfers_in = Column(Numeric(14, 2), nullable=False, default=Decimal("0.00"), server_default="0")
    outflow_dispatch = Column(Numeric(14, 2), nullable=False, default=Decimal("0.00"), server_default="0")
    outflow_transfers_out = Column(Numeric(14, 2), nullable=False, default=Decimal("0.00"), server_default="0")
    total_boxes = Column(Integer, nullable=False, default=0, server_default="0")
    total_pieces = Column(Integer, nullable=False, default=0, server_default="0")
    closing_balance = Column(Numeric(14, 2), nullable=False, default=Decimal("0.00"), server_default="0")

    remarks = Column(Text, nullable=True)
    checked_by_initials = Column(String(20), nullable=True)
    created_by = Column(String(36), nullable=True, index=True)
    updated_by = Column(String(36), nullable=True, index=True)

    product_category = relationship("InventoryProductCategory", back_populates="inventory_entries")
    product = relationship("InventoryProduct", back_populates="inventory_entries")

    @property
    def week_start_date(self) -> date:
        return self.entry_date - timedelta(days=self.entry_date.weekday())

    @property
    def week_end_date(self) -> date:
        return self.week_start_date + timedelta(days=6)

    @property
    def net_movement(self) -> Decimal:
        return (
            qty(self.inflow_production)
            + qty(self.inflow_transfers_in)
            - qty(self.outflow_dispatch)
            - qty(self.outflow_transfers_out)
        )

    def recompute_closing_balance(self) -> Decimal:
        self.closing_balance = (
            qty(self.opening_balance)
            + qty(self.inflow_production)
            + qty(self.inflow_transfers_in)
            - qty(self.outflow_dispatch)
            - qty(self.outflow_transfers_out)
        )
        return qty(self.closing_balance)

    @classmethod
    def get_previous_entry(
        cls,
        session: Session,
        *,
        entry_date: date,
        store: ProductStoreName | str,
        product_id: str,
    ) -> "ProductStoreInventory | None":
        return (
            session.query(cls)
            .filter(
                cls.entry_date < entry_date,
                cls.store == store,
                cls.product_id == product_id,
            )
            .order_by(cls.entry_date.desc(), cls.created_at.desc())
            .first()
        )

    @classmethod
    def get_opening_balance_for_date(
        cls,
        session: Session,
        *,
        entry_date: date,
        store: ProductStoreName | str,
        product_id: str,
    ) -> Decimal:
        previous = cls.get_previous_entry(
            session,
            entry_date=entry_date,
            store=store,
            product_id=product_id,
        )
        return qty(previous.closing_balance if previous else 0)

    def apply_previous_opening_balance(self, session: Session, overwrite: bool = False) -> Decimal:
        if overwrite or self.opening_balance is None:
            self.opening_balance = self.get_opening_balance_for_date(
                session,
                entry_date=self.entry_date,
                store=self.store,
                product_id=self.product_id,
            )
        return qty(self.opening_balance)

    def sync_product_snapshot(self, session: Session) -> None:
        product = (
            session.query(InventoryProduct)
            .filter(InventoryProduct.id == self.product_id)
            .first()
        )
        if not product:
            raise ValueError("Selected product does not exist.")

        category = product.category
        if not category:
            raise ValueError("Selected product is missing a category.")

        if self.product_category_id and self.product_category_id != category.id:
            raise ValueError("Selected product does not belong to the supplied product category.")

        self.product_category_id = category.id
        self.product_category_name = category.name
        self.product_name = product.name

        if not self.balance_unit:
            self.balance_unit = product.default_stock_unit or ProductBalanceUnit.KG

    def prepare_for_save(self, session: Session, overwrite_opening_balance: bool = False) -> None:
        self.sync_product_snapshot(session)
        self.apply_previous_opening_balance(session, overwrite=overwrite_opening_balance)
        self.recompute_closing_balance()

    @validates("checked_by_initials")
    def validate_checked_by_initials(self, key, value):
        if value is None:
            return None
        return value.strip().upper()[:20] or None

    def __repr__(self) -> str:
        return (
            f"<ProductStoreInventory id={self.id} date={self.entry_date} "
            f"store={self.store.value if isinstance(self.store, ProductStoreName) else self.store!r} "
            f"product={self.product_name!r}>"
        )


class ConsumableStoreInventory(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """
    Daily consumable stock-taking entry.

    Closing Balance = opening_balance - issued_today
    """

    __tablename__ = "consumable_store_inventory"
    __table_args__ = (
        UniqueConstraint(
            "entry_date",
            "store",
            "item_id",
            name="uq_consumable_store_inventory_date_store_item",
        ),
        CheckConstraint("opening_balance >= 0", name="ck_consumable_store_inventory_opening_non_negative"),
        CheckConstraint("issued_today >= 0", name="ck_consumable_store_inventory_issued_non_negative"),
        CheckConstraint("closing_balance >= 0", name="ck_consumable_store_inventory_closing_non_negative"),
        Index("ix_consumable_store_inventory_date_store", "entry_date", "store"),
    )

    serial_no = Column(Integer, nullable=True)
    entry_date = Column(Date, nullable=False, index=True)
    # IMPORTANT:
    # Current DB rows are still using enum member names like STORE_1 / STORE_2.
    # So this one must keep SQLAlchemy's default behavior (member names), not enum values.
    store = Column(
        SAEnum(
            ConsumableStoreName,
            name="consumable_store_name_enum",
            native_enum=False,
            validate_strings=True,
        ),
        nullable=False,
        index=True,
    )

    item_category_id = Column(
        String(36),
        ForeignKey("inventory_consumable_categories.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    item_id = Column(
        String(36),
        ForeignKey("inventory_consumable_items.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    item_category_name = Column(String(150), nullable=False)
    item_name = Column(String(200), nullable=False)
    unit = Column(String(50), nullable=False)

    opening_balance = Column(Numeric(14, 2), nullable=False, default=Decimal("0.00"), server_default="0")
    issued_today = Column(Numeric(14, 2), nullable=False, default=Decimal("0.00"), server_default="0")
    closing_balance = Column(Numeric(14, 2), nullable=False, default=Decimal("0.00"), server_default="0")

    remarks = Column(Text, nullable=True)
    checked_by_initials = Column(String(20), nullable=True)
    created_by = Column(String(36), nullable=True, index=True)
    updated_by = Column(String(36), nullable=True, index=True)

    item_category = relationship("InventoryConsumableCategory", back_populates="inventory_entries")
    item = relationship("InventoryConsumableItem", back_populates="inventory_entries")

    @property
    def week_start_date(self) -> date:
        return self.entry_date - timedelta(days=self.entry_date.weekday())

    @property
    def week_end_date(self) -> date:
        return self.week_start_date + timedelta(days=6)

    def recompute_closing_balance(self) -> Decimal:
        self.closing_balance = qty(self.opening_balance) - qty(self.issued_today)
        return qty(self.closing_balance)

    @classmethod
    def get_previous_entry(
        cls,
        session: Session,
        *,
        entry_date: date,
        store: ConsumableStoreName | str,
        item_id: str,
    ) -> "ConsumableStoreInventory | None":
        return (
            session.query(cls)
            .filter(
                cls.entry_date < entry_date,
                cls.store == store,
                cls.item_id == item_id,
            )
            .order_by(cls.entry_date.desc(), cls.created_at.desc())
            .first()
        )

    @classmethod
    def get_opening_balance_for_date(
        cls,
        session: Session,
        *,
        entry_date: date,
        store: ConsumableStoreName | str,
        item_id: str,
    ) -> Decimal:
        previous = cls.get_previous_entry(
            session,
            entry_date=entry_date,
            store=store,
            item_id=item_id,
        )
        return qty(previous.closing_balance if previous else 0)

    def apply_previous_opening_balance(self, session: Session, overwrite: bool = False) -> Decimal:
        if overwrite or self.opening_balance is None:
            self.opening_balance = self.get_opening_balance_for_date(
                session,
                entry_date=self.entry_date,
                store=self.store,
                item_id=self.item_id,
            )
        return qty(self.opening_balance)

    def sync_item_snapshot(self, session: Session) -> None:
        item = (
            session.query(InventoryConsumableItem)
            .filter(InventoryConsumableItem.id == self.item_id)
            .first()
        )
        if not item:
            raise ValueError("Selected consumable item does not exist.")

        category = item.category
        if not category:
            raise ValueError("Selected consumable item is missing a category.")

        if self.item_category_id and self.item_category_id != category.id:
            raise ValueError("Selected consumable item does not belong to the supplied category.")

        self.item_category_id = category.id
        self.item_category_name = category.name
        self.item_name = item.name

        if not self.unit:
            self.unit = item.default_unit

    def prepare_for_save(self, session: Session, overwrite_opening_balance: bool = False) -> None:
        self.sync_item_snapshot(session)
        self.apply_previous_opening_balance(session, overwrite=overwrite_opening_balance)
        self.recompute_closing_balance()

    @validates("checked_by_initials")
    def validate_checked_by_initials(self, key, value):
        if value is None:
            return None
        return value.strip().upper()[:20] or None

    @validates("unit")
    def validate_unit(self, key, value):
        cleaned = clean_text(value)
        if not cleaned:
            raise ValueError("Unit is required.")
        return cleaned

    def __repr__(self) -> str:
        return (
            f"<ConsumableStoreInventory id={self.id} date={self.entry_date} "
            f"store={self.store.value if isinstance(self.store, ConsumableStoreName) else self.store!r} "
            f"item={self.item_name!r}>"
        )


@event.listens_for(ProductStoreInventory, "before_insert")
@event.listens_for(ProductStoreInventory, "before_update")
def product_store_inventory_before_save(mapper, connection, target: ProductStoreInventory):
    target.recompute_closing_balance()


@event.listens_for(ConsumableStoreInventory, "before_insert")
@event.listens_for(ConsumableStoreInventory, "before_update")
def consumable_store_inventory_before_save(mapper, connection, target: ConsumableStoreInventory):
    target.recompute_closing_balance()
