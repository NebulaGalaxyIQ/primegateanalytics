from __future__ import annotations

import enum
from uuid import uuid4

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    Date,
    DateTime,
    Enum as SqlEnum,
    ForeignKey,
    Index,
    Integer,
    JSON,
    LargeBinary,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.core.database import Base


# =============================================================================
# ENUMS
# =============================================================================


class ByproductUnit(str, enum.Enum):
    PIECE = "piece"
    KG = "kg"
    GRAM = "gram"
    LITER = "liter"
    BAG = "bag"
    BOX = "box"
    BUNDLE = "bundle"
    CRATE = "crate"
    SET = "set"
    TRAY = "tray"
    OTHER = "other"


class ByproductCustomerType(str, enum.Enum):
    RETAIL = "retail"
    WHOLESALE = "wholesale"
    DISTRIBUTOR = "distributor"
    AGENT = "agent"
    PROCESSOR = "processor"
    OTHER = "other"


class ByproductPaymentMode(str, enum.Enum):
    CASH = "cash"
    CREDIT = "credit"
    BANK_TRANSFER = "bank_transfer"
    MOBILE_MONEY = "mobile_money"
    CHEQUE = "cheque"
    MIXED = "mixed"
    OTHER = "other"


class ByproductSaleStatus(str, enum.Enum):
    DRAFT = "draft"
    POSTED = "posted"
    VOID = "void"


class ByproductTemplateType(str, enum.Enum):
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    CUSTOM_PERIOD = "custom_period"
    ACCUMULATION = "accumulation"


class ByproductTemplateFormat(str, enum.Enum):
    DOCX = "docx"
    HTML = "html"


class ByproductTemplateStorageBackend(str, enum.Enum):
    DATABASE = "database"
    DISK = "disk"


# =============================================================================
# ENUM HELPER
# =============================================================================


def enum_values(enum_cls: type[enum.Enum]) -> list[str]:
    return [member.value for member in enum_cls]


def pg_enum(enum_cls: type[enum.Enum], name: str) -> SqlEnum:
    return SqlEnum(
        enum_cls,
        name=name,
        values_callable=enum_values,
        validate_strings=True,
        native_enum=True,
    )


# =============================================================================
# MIXINS
# =============================================================================


class UUIDPrimaryKeyMixin:
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4, nullable=False)


class AuditMixin:
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        index=True,
    )
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
        index=True,
    )

    # users.id is INTEGER in your current project
    created_by_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    updated_by_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )


class SoftDeleteMixin:
    is_active = Column(
        Boolean,
        nullable=False,
        default=True,
        server_default="true",
        index=True,
    )
    is_deleted = Column(
        Boolean,
        nullable=False,
        default=False,
        server_default="false",
        index=True,
    )
    deleted_at = Column(DateTime(timezone=True), nullable=True, index=True)

    # users.id is INTEGER in your current project
    deleted_by_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )


# =============================================================================
# MODELS
# =============================================================================


class ByproductCategory(UUIDPrimaryKeyMixin, AuditMixin, SoftDeleteMixin, Base):
    __tablename__ = "byproduct_categories"

    code = Column(String(50), nullable=False, unique=True, index=True)
    name = Column(String(150), nullable=False, index=True)
    description = Column(Text, nullable=True)
    sort_order = Column(Integer, nullable=False, default=0, server_default="0")

    items = relationship(
        "ByproductItem",
        back_populates="category",
        cascade="save-update, merge",
        passive_deletes=True,
    )

    __table_args__ = (
        UniqueConstraint("code", name="uq_byproduct_categories_code"),
        Index("ix_byproduct_categories_name_active", "name", "is_active", "is_deleted"),
    )


class ByproductItem(UUIDPrimaryKeyMixin, AuditMixin, SoftDeleteMixin, Base):
    __tablename__ = "byproduct_items"

    category_id = Column(
        UUID(as_uuid=True),
        ForeignKey("byproduct_categories.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    code = Column(String(50), nullable=False, unique=True, index=True)
    name = Column(String(180), nullable=False, index=True)
    short_name = Column(String(100), nullable=True)
    description = Column(Text, nullable=True)

    unit_of_measure = Column(
        pg_enum(ByproductUnit, "byproduct_unit_enum"),
        nullable=False,
        default=ByproductUnit.PIECE,
        server_default=ByproductUnit.PIECE.value,
    )

    allow_fractional_quantity = Column(
        Boolean,
        nullable=False,
        default=False,
        server_default="false",
    )

    default_unit_price = Column(
        Numeric(18, 2),
        nullable=False,
        default=0,
        server_default="0",
    )
    minimum_unit_price = Column(Numeric(18, 2), nullable=True)
    maximum_unit_price = Column(Numeric(18, 2), nullable=True)

    report_label = Column(String(180), nullable=True)
    notes = Column(Text, nullable=True)

    category = relationship("ByproductCategory", back_populates="items")

    sale_lines = relationship(
        "ByproductSaleLine",
        back_populates="byproduct",
        passive_deletes=True,
    )

    __table_args__ = (
        UniqueConstraint("code", name="uq_byproduct_items_code"),
        CheckConstraint(
            "default_unit_price >= 0",
            name="ck_byproduct_items_default_unit_price_non_negative",
        ),
        CheckConstraint(
            "minimum_unit_price IS NULL OR minimum_unit_price >= 0",
            name="ck_byproduct_items_minimum_unit_price_non_negative",
        ),
        CheckConstraint(
            "maximum_unit_price IS NULL OR maximum_unit_price >= 0",
            name="ck_byproduct_items_maximum_unit_price_non_negative",
        ),
        CheckConstraint(
            "minimum_unit_price IS NULL OR maximum_unit_price IS NULL OR maximum_unit_price >= minimum_unit_price",
            name="ck_byproduct_items_price_range_valid",
        ),
        Index("ix_byproduct_items_name_active", "name", "is_active", "is_deleted"),
        Index("ix_byproduct_items_category_active", "category_id", "is_active", "is_deleted"),
    )


class ByproductCustomer(UUIDPrimaryKeyMixin, AuditMixin, SoftDeleteMixin, Base):
    __tablename__ = "byproduct_customers"

    customer_code = Column(String(50), nullable=False, unique=True, index=True)
    customer_name = Column(String(180), nullable=False, index=True)
    transaction_name = Column(String(180), nullable=True, index=True)
    contact_person = Column(String(180), nullable=True)

    phone_number = Column(String(50), nullable=True, index=True)
    alternative_phone_number = Column(String(50), nullable=True)
    email = Column(String(180), nullable=True, index=True)

    address = Column(Text, nullable=True)
    business_location = Column(String(180), nullable=True, index=True)
    district = Column(String(120), nullable=True, index=True)
    region = Column(String(120), nullable=True, index=True)

    tin_number = Column(String(100), nullable=True, index=True)
    registration_number = Column(String(100), nullable=True, index=True)

    customer_type = Column(
        pg_enum(ByproductCustomerType, "byproduct_customer_type_enum"),
        nullable=False,
        default=ByproductCustomerType.RETAIL,
        server_default=ByproductCustomerType.RETAIL.value,
    )

    default_payment_mode = Column(
        pg_enum(ByproductPaymentMode, "byproduct_payment_mode_enum"),
        nullable=True,
    )

    credit_allowed = Column(
        Boolean,
        nullable=False,
        default=False,
        server_default="false",
    )
    credit_limit = Column(Numeric(18, 2), nullable=True)

    notes = Column(Text, nullable=True)

    sales = relationship(
        "ByproductSale",
        back_populates="customer",
        cascade="save-update, merge",
        passive_deletes=True,
    )

    __table_args__ = (
        UniqueConstraint("customer_code", name="uq_byproduct_customers_customer_code"),
        CheckConstraint(
            "credit_limit IS NULL OR credit_limit >= 0",
            name="ck_byproduct_customers_credit_limit_non_negative",
        ),
        Index("ix_byproduct_customers_name_active", "customer_name", "is_active", "is_deleted"),
        Index("ix_byproduct_customers_location_active", "business_location", "is_active", "is_deleted"),
    )


class ByproductSale(UUIDPrimaryKeyMixin, AuditMixin, SoftDeleteMixin, Base):
    __tablename__ = "byproduct_sales"

    sale_number = Column(String(60), nullable=False, unique=True, index=True)
    sale_date = Column(Date, nullable=False, index=True)

    customer_id = Column(
        UUID(as_uuid=True),
        ForeignKey("byproduct_customers.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    customer_name_snapshot = Column(String(180), nullable=False, index=True)
    transaction_name_snapshot = Column(String(180), nullable=True)
    customer_phone_snapshot = Column(String(50), nullable=True)
    customer_business_location_snapshot = Column(String(180), nullable=True)

    status = Column(
        pg_enum(ByproductSaleStatus, "byproduct_sale_status_enum"),
        nullable=False,
        default=ByproductSaleStatus.POSTED,
        server_default=ByproductSaleStatus.POSTED.value,
        index=True,
    )

    payment_mode = Column(
        pg_enum(ByproductPaymentMode, "byproduct_sale_payment_mode_enum"),
        nullable=True,
        index=True,
    )

    subtotal_amount = Column(Numeric(18, 2), nullable=False, default=0, server_default="0")
    discount_amount = Column(Numeric(18, 2), nullable=False, default=0, server_default="0")
    adjustment_amount = Column(Numeric(18, 2), nullable=False, default=0, server_default="0")
    total_amount = Column(Numeric(18, 2), nullable=False, default=0, server_default="0")

    amount_paid = Column(Numeric(18, 2), nullable=False, default=0, server_default="0")
    balance_due = Column(Numeric(18, 2), nullable=False, default=0, server_default="0")

    remarks = Column(Text, nullable=True)
    extra_meta = Column(JSON, nullable=True)

    customer = relationship("ByproductCustomer", back_populates="sales")

    lines = relationship(
        "ByproductSaleLine",
        back_populates="sale",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="ByproductSaleLine.line_number.asc()",
    )

    __table_args__ = (
        UniqueConstraint("sale_number", name="uq_byproduct_sales_sale_number"),
        CheckConstraint("subtotal_amount >= 0", name="ck_byproduct_sales_subtotal_non_negative"),
        CheckConstraint("discount_amount >= 0", name="ck_byproduct_sales_discount_non_negative"),
        CheckConstraint("total_amount >= 0", name="ck_byproduct_sales_total_non_negative"),
        CheckConstraint("amount_paid >= 0", name="ck_byproduct_sales_amount_paid_non_negative"),
        CheckConstraint("balance_due >= 0", name="ck_byproduct_sales_balance_due_non_negative"),
        Index("ix_byproduct_sales_date_status", "sale_date", "status"),
        Index("ix_byproduct_sales_customer_date", "customer_id", "sale_date"),
        Index("ix_byproduct_sales_active_date", "is_active", "is_deleted", "sale_date"),
    )


class ByproductSaleLine(UUIDPrimaryKeyMixin, AuditMixin, SoftDeleteMixin, Base):
    __tablename__ = "byproduct_sale_lines"

    sale_id = Column(
        UUID(as_uuid=True),
        ForeignKey("byproduct_sales.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    byproduct_id = Column(
        UUID(as_uuid=True),
        ForeignKey("byproduct_items.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    line_number = Column(Integer, nullable=False, default=1, server_default="1")

    byproduct_code_snapshot = Column(String(50), nullable=True, index=True)
    byproduct_name_snapshot = Column(String(180), nullable=False, index=True)
    byproduct_category_snapshot = Column(String(180), nullable=True, index=True)
    unit_of_measure_snapshot = Column(String(50), nullable=True)

    quantity = Column(Numeric(18, 3), nullable=False, default=0, server_default="0")
    unit_price = Column(Numeric(18, 2), nullable=False, default=0, server_default="0")
    line_total = Column(Numeric(18, 2), nullable=False, default=0, server_default="0")

    remarks = Column(Text, nullable=True)
    extra_meta = Column(JSON, nullable=True)

    sale = relationship("ByproductSale", back_populates="lines")
    byproduct = relationship("ByproductItem", back_populates="sale_lines")

    __table_args__ = (
        CheckConstraint("quantity > 0", name="ck_byproduct_sale_lines_quantity_positive"),
        CheckConstraint("unit_price >= 0", name="ck_byproduct_sale_lines_unit_price_non_negative"),
        CheckConstraint("line_total >= 0", name="ck_byproduct_sale_lines_line_total_non_negative"),
        Index("ix_byproduct_sale_lines_sale_line_number", "sale_id", "line_number"),
        Index("ix_byproduct_sale_lines_byproduct", "byproduct_id"),
        Index("ix_byproduct_sale_lines_active", "is_active", "is_deleted"),
    )


class ByproductReportTemplate(UUIDPrimaryKeyMixin, AuditMixin, SoftDeleteMixin, Base):
    __tablename__ = "byproduct_report_templates"

    name = Column(String(180), nullable=False, index=True)
    template_code = Column(String(60), nullable=False, unique=True, index=True)

    template_type = Column(
        pg_enum(ByproductTemplateType, "byproduct_template_type_enum"),
        nullable=False,
        index=True,
    )
    template_format = Column(
        pg_enum(ByproductTemplateFormat, "byproduct_template_format_enum"),
        nullable=False,
        index=True,
    )
    storage_backend = Column(
        pg_enum(ByproductTemplateStorageBackend, "byproduct_template_storage_backend_enum"),
        nullable=False,
        default=ByproductTemplateStorageBackend.DATABASE,
        server_default=ByproductTemplateStorageBackend.DATABASE.value,
        index=True,
    )

    file_name = Column(String(255), nullable=False)

    # Legacy disk path support. Keep nullable so old and new templates can coexist.
    file_path = Column(String(500), nullable=True, unique=True)

    # New database-backed template storage.
    file_blob = Column(LargeBinary, nullable=True)

    mime_type = Column(String(120), nullable=True)
    file_size_bytes = Column(Integer, nullable=True)

    is_default = Column(Boolean, nullable=False, default=False, server_default="false")

    placeholders_meta = Column(JSON, nullable=True)
    notes = Column(Text, nullable=True)

    __table_args__ = (
        UniqueConstraint("template_code", name="uq_byproduct_report_templates_template_code"),
        CheckConstraint(
            "(file_blob IS NOT NULL) OR (file_path IS NOT NULL)",
            name="ck_byproduct_report_templates_has_blob_or_path",
        ),
        CheckConstraint(
            "("
            "(storage_backend = 'database' AND file_blob IS NOT NULL)"
            " OR "
            "(storage_backend = 'disk' AND file_path IS NOT NULL)"
            ")",
            name="ck_byproduct_report_templates_storage_backend_matches_payload",
        ),
        Index(
            "ix_byproduct_report_templates_type_default_active",
            "template_type",
            "is_default",
            "is_active",
            "is_deleted",
        ),
        Index(
            "ix_byproduct_report_templates_backend_active",
            "storage_backend",
            "is_active",
            "is_deleted",
        ),
    )