from __future__ import annotations

import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
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
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.inventory import ConsumableStoreName, ProductStoreName


class AuditPeriodType(str, enum.Enum):
    WEEKLY = "weekly"
    MONTHLY = "monthly"


class ProductInventoryAudit(Base):
    __tablename__ = "product_inventory_audits"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )

    audit_period_type: Mapped[AuditPeriodType] = mapped_column(
        SAEnum(AuditPeriodType, name="audit_period_type_enum"),
        nullable=False,
        index=True,
    )
    period_start_date: Mapped[datetime.date] = mapped_column(Date, nullable=False, index=True)
    period_end_date: Mapped[datetime.date] = mapped_column(Date, nullable=False, index=True)

    store: Mapped[ProductStoreName] = mapped_column(
        SAEnum(ProductStoreName, name="product_audit_store_enum"),
        nullable=False,
        index=True,
    )

    product_category_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("inventory_product_categories.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    product_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("inventory_products.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    product_category_name: Mapped[str] = mapped_column(String(150), nullable=False, default="")
    product_name: Mapped[str] = mapped_column(String(200), nullable=False, default="")

    count_pcs: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    sample_size_pcs: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    sample_weight_kg: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False, default=0)
    avg_weight_kg_per_pc: Mapped[float] = mapped_column(Numeric(14, 4), nullable=False, default=0)
    calculated_total_kg: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False, default=0)

    ledger_opening_kg: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False, default=0)
    ledger_inflows_kg: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False, default=0)
    ledger_outflows_kg: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False, default=0)
    ledger_closing_kg: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False, default=0)

    variance_kg: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False, default=0)
    variance_pct: Mapped[float] = mapped_column(Numeric(9, 2), nullable=False, default=0)

    remarks: Mapped[str | None] = mapped_column(Text, nullable=True)

    is_system_generated: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    generated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=datetime.utcnow,
    )
    last_recalculated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    created_by: Mapped[str | None] = mapped_column(String(36), nullable=True)
    updated_by: Mapped[str | None] = mapped_column(String(36), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=datetime.utcnow,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    product_category = relationship(
        "InventoryProductCategory",
        foreign_keys=[product_category_id],
        lazy="joined",
    )
    product = relationship(
        "InventoryProduct",
        foreign_keys=[product_id],
        lazy="joined",
    )

    __table_args__ = (
        UniqueConstraint(
            "audit_period_type",
            "period_end_date",
            "store",
            "product_id",
            name="uq_product_inventory_audit_period_store_product",
        ),
        CheckConstraint("count_pcs >= 0", name="ck_product_audit_count_pcs_non_negative"),
        CheckConstraint("sample_size_pcs >= 0", name="ck_product_audit_sample_size_non_negative"),
        CheckConstraint("sample_weight_kg >= 0", name="ck_product_audit_sample_weight_non_negative"),
        CheckConstraint("calculated_total_kg >= 0", name="ck_product_audit_calculated_total_non_negative"),
        Index(
            "ix_product_inventory_audits_period_store",
            "audit_period_type",
            "period_end_date",
            "store",
        ),
    )

    def __repr__(self) -> str:
        return (
            f"<ProductInventoryAudit(id={self.id}, period={self.audit_period_type}, "
            f"end={self.period_end_date}, store={self.store}, product={self.product_name})>"
        )


class ConsumableInventoryAudit(Base):
    __tablename__ = "consumable_inventory_audits"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )

    audit_period_type: Mapped[AuditPeriodType] = mapped_column(
        SAEnum(AuditPeriodType, name="consumable_audit_period_type_enum"),
        nullable=False,
        index=True,
    )
    period_start_date: Mapped[datetime.date] = mapped_column(Date, nullable=False, index=True)
    period_end_date: Mapped[datetime.date] = mapped_column(Date, nullable=False, index=True)

    store: Mapped[ConsumableStoreName] = mapped_column(
        SAEnum(ConsumableStoreName, name="consumable_audit_store_enum"),
        nullable=False,
        index=True,
    )

    item_category_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("inventory_consumable_categories.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    item_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("inventory_consumable_items.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    item_category_name: Mapped[str] = mapped_column(String(150), nullable=False, default="")
    item_name: Mapped[str] = mapped_column(String(200), nullable=False, default="")
    unit: Mapped[str] = mapped_column(String(50), nullable=False, default="")

    opening_ledger: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False, default=0)
    issues_total: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False, default=0)
    expected_closing: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False, default=0)
    physical_count: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False, default=0)
    variance: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False, default=0)
    variance_pct: Mapped[float] = mapped_column(Numeric(9, 2), nullable=False, default=0)

    remarks: Mapped[str | None] = mapped_column(Text, nullable=True)

    is_system_generated: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    generated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=datetime.utcnow,
    )
    last_recalculated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    created_by: Mapped[str | None] = mapped_column(String(36), nullable=True)
    updated_by: Mapped[str | None] = mapped_column(String(36), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=datetime.utcnow,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    item_category = relationship(
        "InventoryConsumableCategory",
        foreign_keys=[item_category_id],
        lazy="joined",
    )
    item = relationship(
        "InventoryConsumableItem",
        foreign_keys=[item_id],
        lazy="joined",
    )

    __table_args__ = (
        UniqueConstraint(
            "audit_period_type",
            "period_end_date",
            "store",
            "item_id",
            name="uq_consumable_inventory_audit_period_store_item",
        ),
        CheckConstraint("opening_ledger >= 0", name="ck_consumable_audit_opening_non_negative"),
        CheckConstraint("issues_total >= 0", name="ck_consumable_audit_issues_non_negative"),
        CheckConstraint("expected_closing >= 0", name="ck_consumable_audit_expected_closing_non_negative"),
        CheckConstraint("physical_count >= 0", name="ck_consumable_audit_physical_count_non_negative"),
        Index(
            "ix_consumable_inventory_audits_period_store",
            "audit_period_type",
            "period_end_date",
            "store",
        ),
    )

    def __repr__(self) -> str:
        return (
            f"<ConsumableInventoryAudit(id={self.id}, period={self.audit_period_type}, "
            f"end={self.period_end_date}, store={self.store}, item={self.item_name})>"
        )