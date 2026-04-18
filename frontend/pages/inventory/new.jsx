import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";

import InventoryService from "../../services/inventory";

const PAGE_BG = "#ffffff";
const CARD_BG = "#ffffff";
const BORDER = "#e5e7eb";
const TEXT = "#111827";
const MUTED = "#6b7280";
const ORANGE = "#ff7a00";
const ORANGE_DEEP = "#e86a00";
const ORANGE_SOFT = "rgba(255,122,0,0.10)";
const BLUE = "#2563eb";
const BLUE_SOFT = "rgba(37,99,235,0.10)";
const GREEN = "#15803d";
const GREEN_SOFT = "rgba(21,128,61,0.10)";
const RED = "#b91c1c";
const RED_SOFT = "rgba(185,28,28,0.08)";
const SHADOW = "0 16px 40px rgba(15, 23, 42, 0.05)";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function toErrorMessage(error, fallback = "Something went wrong.") {
  return error?.message || fallback;
}

function formatNumber(value) {
  const num = Number(value ?? 0);
  if (!Number.isFinite(num)) return "0.00";
  return num.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function buttonStyle(variant = "primary") {
  const base = {
    appearance: "none",
    borderRadius: 12,
    padding: "10px 14px",
    fontSize: 14,
    fontWeight: 700,
    fontFamily: "Arial, sans-serif",
    cursor: "pointer",
    border: "1px solid transparent",
    transition: "all 0.2s ease",
  };

  if (variant === "secondary") {
    return {
      ...base,
      background: "#ffffff",
      color: TEXT,
      border: `1px solid ${BORDER}`,
    };
  }

  if (variant === "softBlue") {
    return {
      ...base,
      background: BLUE_SOFT,
      color: BLUE,
      border: "1px solid rgba(37,99,235,0.14)",
    };
  }

  if (variant === "softGreen") {
    return {
      ...base,
      background: GREEN_SOFT,
      color: GREEN,
      border: "1px solid rgba(21,128,61,0.14)",
    };
  }

  if (variant === "danger") {
    return {
      ...base,
      background: RED_SOFT,
      color: RED,
      border: "1px solid rgba(185,28,28,0.14)",
    };
  }

  return {
    ...base,
    background: ORANGE,
    color: "#ffffff",
    border: `1px solid ${ORANGE}`,
  };
}

function inputStyle() {
  return {
    width: "100%",
    height: 42,
    borderRadius: 12,
    border: `1px solid ${BORDER}`,
    padding: "0 12px",
    background: "#ffffff",
    color: TEXT,
    outline: "none",
    fontSize: 14,
    fontFamily: "Arial, sans-serif",
    boxSizing: "border-box",
  };
}

function textareaStyle() {
  return {
    width: "100%",
    minHeight: 96,
    borderRadius: 14,
    border: `1px solid ${BORDER}`,
    padding: "12px",
    background: "#ffffff",
    color: TEXT,
    outline: "none",
    fontSize: 14,
    fontFamily: "Arial, sans-serif",
    boxSizing: "border-box",
    resize: "vertical",
  };
}

function PageCard({ title, subtitle, action, children, style }) {
  return (
    <section
      style={{
        background: CARD_BG,
        border: `1px solid ${BORDER}`,
        borderRadius: 22,
        boxShadow: SHADOW,
        padding: 20,
        ...style,
      }}
    >
      {(title || subtitle || action) && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 12,
            flexWrap: "wrap",
            marginBottom: 16,
          }}
        >
          <div>
            {title ? (
              <h2
                style={{
                  margin: 0,
                  color: TEXT,
                  fontSize: 19,
                  fontWeight: 700,
                  fontFamily: "Arial, sans-serif",
                }}
              >
                {title}
              </h2>
            ) : null}
            {subtitle ? (
              <p
                style={{
                  margin: "6px 0 0",
                  color: MUTED,
                  fontSize: 13,
                  lineHeight: 1.55,
                  fontFamily: "Arial, sans-serif",
                }}
              >
                {subtitle}
              </p>
            ) : null}
          </div>
          {action ? <div>{action}</div> : null}
        </div>
      )}
      {children}
    </section>
  );
}

function FieldLabel({ children }) {
  return (
    <label
      style={{
        display: "block",
        marginBottom: 6,
        color: TEXT,
        fontSize: 13,
        fontWeight: 700,
        fontFamily: "Arial, sans-serif",
      }}
    >
      {children}
    </label>
  );
}

function StatCard({ label, value, tone = "orange" }) {
  const toneMap = {
    orange: { bg: ORANGE_SOFT, color: ORANGE_DEEP },
    blue: { bg: BLUE_SOFT, color: BLUE },
    green: { bg: GREEN_SOFT, color: GREEN },
    red: { bg: RED_SOFT, color: RED },
  };

  const chosen = toneMap[tone] || toneMap.orange;

  return (
    <div
      style={{
        background: "#ffffff",
        border: `1px solid ${BORDER}`,
        borderRadius: 18,
        padding: 16,
      }}
    >
      <div
        style={{
          width: 38,
          height: 38,
          borderRadius: 12,
          background: chosen.bg,
          color: chosen.color,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 700,
          fontSize: 12,
          fontFamily: "Arial, sans-serif",
        }}
      >
        {String(label || "").slice(0, 2).toUpperCase()}
      </div>

      <div
        style={{
          marginTop: 12,
          color: TEXT,
          fontSize: 24,
          fontWeight: 700,
          fontFamily: "Arial, sans-serif",
        }}
      >
        {value}
      </div>

      <div
        style={{
          marginTop: 6,
          color: MUTED,
          fontSize: 13,
          fontFamily: "Arial, sans-serif",
        }}
      >
        {label}
      </div>
    </div>
  );
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        appearance: "none",
        border: active ? `1px solid ${ORANGE}` : `1px solid ${BORDER}`,
        background: active ? ORANGE_SOFT : "#ffffff",
        color: active ? ORANGE_DEEP : TEXT,
        borderRadius: 12,
        padding: "10px 16px",
        fontSize: 14,
        fontWeight: 700,
        cursor: "pointer",
        fontFamily: "Arial, sans-serif",
      }}
    >
      {children}
    </button>
  );
}

export default function InventoryNewPage() {
  const router = useRouter();

  const [mainTab, setMainTab] = useState("entry");
  const [setupTab, setSetupTab] = useState("productCategory");
  const [entryType, setEntryType] = useState("product");

  const [bootstrap, setBootstrap] = useState({
    product_stores: [],
    consumable_stores: [],
    product_categories: [],
    products: [],
    consumable_categories: [],
    consumable_items: [],
  });

  const [loading, setLoading] = useState(true);
  const [setupSaving, setSetupSaving] = useState(false);
  const [entrySaving, setEntrySaving] = useState(false);
  const [openingLoading, setOpeningLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [productCategoryForm, setProductCategoryForm] = useState({
    name: "",
    description: "",
    sort_order: "0",
    is_active: true,
  });

  const [productForm, setProductForm] = useState({
    category_id: "",
    name: "",
    default_stock_unit: "kg",
    description: "",
    sort_order: "0",
    is_active: true,
  });

  const [consumableCategoryForm, setConsumableCategoryForm] = useState({
    name: "",
    description: "",
    sort_order: "0",
    is_active: true,
  });

  const [consumableItemForm, setConsumableItemForm] = useState({
    category_id: "",
    name: "",
    default_unit: "pcs",
    description: "",
    sort_order: "0",
    is_active: true,
  });

  const [productEntryForm, setProductEntryForm] = useState({
    entry_date: todayISO(),
    store: "",
    product_category_id: "",
    product_id: "",
    balance_unit: "kg",
    opening_balance: "",
    inflow_production: "",
    inflow_transfers_in: "",
    outflow_dispatch: "",
    outflow_transfers_out: "",
    total_boxes: "",
    total_pieces: "",
    remarks: "",
    checked_by_initials: "",
    overwrite_opening_balance: false,
  });

  const [consumableEntryForm, setConsumableEntryForm] = useState({
    entry_date: todayISO(),
    store: "",
    item_category_id: "",
    item_id: "",
    unit: "",
    opening_balance: "",
    issued_today: "",
    remarks: "",
    checked_by_initials: "",
    overwrite_opening_balance: false,
  });

  const productCategories = safeArray(bootstrap.product_categories);
  const products = safeArray(bootstrap.products);
  const consumableCategories = safeArray(bootstrap.consumable_categories);
  const consumableItems = safeArray(bootstrap.consumable_items);
  const productStores = safeArray(bootstrap.product_stores);
  const consumableStores = safeArray(bootstrap.consumable_stores);

  const filteredProductsForEntry = useMemo(() => {
    if (!productEntryForm.product_category_id) return products;
    return products.filter(
      (item) => item.category_id === productEntryForm.product_category_id
    );
  }, [products, productEntryForm.product_category_id]);

  const filteredConsumableItemsForEntry = useMemo(() => {
    if (!consumableEntryForm.item_category_id) return consumableItems;
    return consumableItems.filter(
      (item) => item.category_id === consumableEntryForm.item_category_id
    );
  }, [consumableItems, consumableEntryForm.item_category_id]);

  const selectedProductForEntry = useMemo(() => {
    return products.find((item) => item.id === productEntryForm.product_id) || null;
  }, [products, productEntryForm.product_id]);

  const selectedConsumableItemForEntry = useMemo(() => {
    return (
      consumableItems.find((item) => item.id === consumableEntryForm.item_id) || null
    );
  }, [consumableItems, consumableEntryForm.item_id]);

  const computedProductClosing = useMemo(() => {
    const opening = Number(productEntryForm.opening_balance || 0);
    const production = Number(productEntryForm.inflow_production || 0);
    const transfersIn = Number(productEntryForm.inflow_transfers_in || 0);
    const dispatch = Number(productEntryForm.outflow_dispatch || 0);
    const transfersOut = Number(productEntryForm.outflow_transfers_out || 0);
    return opening + production + transfersIn - dispatch - transfersOut;
  }, [productEntryForm]);

  const computedConsumableClosing = useMemo(() => {
    const opening = Number(consumableEntryForm.opening_balance || 0);
    const issued = Number(consumableEntryForm.issued_today || 0);
    return opening - issued;
  }, [consumableEntryForm]);

  const loadBootstrap = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await InventoryService.getBootstrap();
      setBootstrap(data || {});
    } catch (err) {
      setError(toErrorMessage(err, "Unable to load inventory lists."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBootstrap();
  }, []);

  useEffect(() => {
    if (!selectedProductForEntry) return;
    setProductEntryForm((prev) => ({
      ...prev,
      balance_unit: selectedProductForEntry.default_stock_unit || prev.balance_unit || "kg",
    }));
  }, [selectedProductForEntry]);

  useEffect(() => {
    if (!selectedConsumableItemForEntry) return;
    setConsumableEntryForm((prev) => ({
      ...prev,
      unit: selectedConsumableItemForEntry.default_unit || prev.unit || "",
    }));
  }, [selectedConsumableItemForEntry]);

  useEffect(() => {
    let active = true;

    async function autoFillProductOpening() {
      if (
        !productEntryForm.entry_date ||
        !productEntryForm.store ||
        !productEntryForm.product_id ||
        productEntryForm.overwrite_opening_balance
      ) {
        return;
      }

      try {
        setOpeningLoading(true);
        const data = await InventoryService.autofillProductOpeningBalance({
          entryDate: productEntryForm.entry_date,
          store: productEntryForm.store,
          productId: productEntryForm.product_id,
        });

        if (!active) return;

        setProductEntryForm((prev) => ({
          ...prev,
          opening_balance: data?.opening_balance ?? 0,
        }));
      } catch {
      } finally {
        if (active) setOpeningLoading(false);
      }
    }

    if (entryType === "product") {
      autoFillProductOpening();
    }

    return () => {
      active = false;
    };
  }, [
    entryType,
    productEntryForm.entry_date,
    productEntryForm.store,
    productEntryForm.product_id,
    productEntryForm.overwrite_opening_balance,
  ]);

  useEffect(() => {
    let active = true;

    async function autoFillConsumableOpening() {
      if (
        !consumableEntryForm.entry_date ||
        !consumableEntryForm.store ||
        !consumableEntryForm.item_id ||
        consumableEntryForm.overwrite_opening_balance
      ) {
        return;
      }

      try {
        setOpeningLoading(true);
        const data = await InventoryService.autofillConsumableOpeningBalance({
          entryDate: consumableEntryForm.entry_date,
          store: consumableEntryForm.store,
          itemId: consumableEntryForm.item_id,
        });

        if (!active) return;

        setConsumableEntryForm((prev) => ({
          ...prev,
          opening_balance: data?.opening_balance ?? 0,
        }));
      } catch {
      } finally {
        if (active) setOpeningLoading(false);
      }
    }

    if (entryType === "consumable") {
      autoFillConsumableOpening();
    }

    return () => {
      active = false;
    };
  }, [
    entryType,
    consumableEntryForm.entry_date,
    consumableEntryForm.store,
    consumableEntryForm.item_id,
    consumableEntryForm.overwrite_opening_balance,
  ]);

  const resetProductCategoryForm = () => {
    setProductCategoryForm({
      name: "",
      description: "",
      sort_order: "0",
      is_active: true,
    });
  };

  const resetProductForm = () => {
    setProductForm({
      category_id: "",
      name: "",
      default_stock_unit: "kg",
      description: "",
      sort_order: "0",
      is_active: true,
    });
  };

  const resetConsumableCategoryForm = () => {
    setConsumableCategoryForm({
      name: "",
      description: "",
      sort_order: "0",
      is_active: true,
    });
  };

  const resetConsumableItemForm = () => {
    setConsumableItemForm({
      category_id: "",
      name: "",
      default_unit: "pcs",
      description: "",
      sort_order: "0",
      is_active: true,
    });
  };

  const resetProductEntryForm = () => {
    setProductEntryForm({
      entry_date: todayISO(),
      store: "",
      product_category_id: "",
      product_id: "",
      balance_unit: "kg",
      opening_balance: "",
      inflow_production: "",
      inflow_transfers_in: "",
      outflow_dispatch: "",
      outflow_transfers_out: "",
      total_boxes: "",
      total_pieces: "",
      remarks: "",
      checked_by_initials: "",
      overwrite_opening_balance: false,
    });
  };

  const resetConsumableEntryForm = () => {
    setConsumableEntryForm({
      entry_date: todayISO(),
      store: "",
      item_category_id: "",
      item_id: "",
      unit: "",
      opening_balance: "",
      issued_today: "",
      remarks: "",
      checked_by_initials: "",
      overwrite_opening_balance: false,
    });
  };

  const handleCreateProductCategory = async () => {
    setSetupSaving(true);
    setError("");
    setNotice("");

    try {
      const created = await InventoryService.createProductCategory({
        name: productCategoryForm.name,
        description: productCategoryForm.description || undefined,
        is_active: !!productCategoryForm.is_active,
        sort_order: Number(productCategoryForm.sort_order || 0),
      });

      await loadBootstrap();

      setProductForm((prev) => ({
        ...prev,
        category_id: created.id,
      }));

      setProductEntryForm((prev) => ({
        ...prev,
        product_category_id: created.id,
        product_id: "",
      }));

      resetProductCategoryForm();
      setSetupTab("product");
      setNotice("Product category created successfully.");
    } catch (err) {
      setError(toErrorMessage(err, "Unable to create product category."));
    } finally {
      setSetupSaving(false);
    }
  };

  const handleCreateProduct = async () => {
    setSetupSaving(true);
    setError("");
    setNotice("");

    try {
      const created = await InventoryService.createProduct({
        category_id: productForm.category_id,
        name: productForm.name,
        default_stock_unit: productForm.default_stock_unit,
        description: productForm.description || undefined,
        is_active: !!productForm.is_active,
        sort_order: Number(productForm.sort_order || 0),
      });

      await loadBootstrap();

      setProductEntryForm((prev) => ({
        ...prev,
        product_category_id: created.category_id,
        product_id: created.id,
        balance_unit: created.default_stock_unit || "kg",
      }));

      resetProductForm();
      setMainTab("entry");
      setEntryType("product");
      setNotice("Product created successfully. You can now create a stock entry.");
    } catch (err) {
      setError(toErrorMessage(err, "Unable to create product."));
    } finally {
      setSetupSaving(false);
    }
  };

  const handleCreateConsumableCategory = async () => {
    setSetupSaving(true);
    setError("");
    setNotice("");

    try {
      const created = await InventoryService.createConsumableCategory({
        name: consumableCategoryForm.name,
        description: consumableCategoryForm.description || undefined,
        is_active: !!consumableCategoryForm.is_active,
        sort_order: Number(consumableCategoryForm.sort_order || 0),
      });

      await loadBootstrap();

      setConsumableItemForm((prev) => ({
        ...prev,
        category_id: created.id,
      }));

      setConsumableEntryForm((prev) => ({
        ...prev,
        item_category_id: created.id,
        item_id: "",
      }));

      resetConsumableCategoryForm();
      setSetupTab("consumableItem");
      setNotice("Consumable category created successfully.");
    } catch (err) {
      setError(toErrorMessage(err, "Unable to create consumable category."));
    } finally {
      setSetupSaving(false);
    }
  };

  const handleCreateConsumableItem = async () => {
    setSetupSaving(true);
    setError("");
    setNotice("");

    try {
      const created = await InventoryService.createConsumableItem({
        category_id: consumableItemForm.category_id,
        name: consumableItemForm.name,
        default_unit: consumableItemForm.default_unit,
        description: consumableItemForm.description || undefined,
        is_active: !!consumableItemForm.is_active,
        sort_order: Number(consumableItemForm.sort_order || 0),
      });

      await loadBootstrap();

      setConsumableEntryForm((prev) => ({
        ...prev,
        item_category_id: created.category_id,
        item_id: created.id,
        unit: created.default_unit || "",
      }));

      resetConsumableItemForm();
      setMainTab("entry");
      setEntryType("consumable");
      setNotice("Consumable item created successfully. You can now create a stock entry.");
    } catch (err) {
      setError(toErrorMessage(err, "Unable to create consumable item."));
    } finally {
      setSetupSaving(false);
    }
  };

  const handleAutofillProductOpening = async () => {
    if (
      !productEntryForm.entry_date ||
      !productEntryForm.store ||
      !productEntryForm.product_id
    ) {
      return;
    }

    setOpeningLoading(true);
    setError("");
    setNotice("");

    try {
      const data = await InventoryService.autofillProductOpeningBalance({
        entryDate: productEntryForm.entry_date,
        store: productEntryForm.store,
        productId: productEntryForm.product_id,
      });

      setProductEntryForm((prev) => ({
        ...prev,
        opening_balance: data?.opening_balance ?? 0,
        overwrite_opening_balance: false,
      }));

      setNotice("Product opening balance auto-filled successfully.");
    } catch (err) {
      setError(toErrorMessage(err, "Unable to auto-fill product opening balance."));
    } finally {
      setOpeningLoading(false);
    }
  };

  const handleAutofillConsumableOpening = async () => {
    if (
      !consumableEntryForm.entry_date ||
      !consumableEntryForm.store ||
      !consumableEntryForm.item_id
    ) {
      return;
    }

    setOpeningLoading(true);
    setError("");
    setNotice("");

    try {
      const data = await InventoryService.autofillConsumableOpeningBalance({
        entryDate: consumableEntryForm.entry_date,
        store: consumableEntryForm.store,
        itemId: consumableEntryForm.item_id,
      });

      setConsumableEntryForm((prev) => ({
        ...prev,
        opening_balance: data?.opening_balance ?? 0,
        overwrite_opening_balance: false,
      }));

      setNotice("Consumable opening balance auto-filled successfully.");
    } catch (err) {
      setError(
        toErrorMessage(err, "Unable to auto-fill consumable opening balance.")
      );
    } finally {
      setOpeningLoading(false);
    }
  };

  const handleCreateEntry = async () => {
    setEntrySaving(true);
    setError("");
    setNotice("");

    try {
      if (entryType === "consumable") {
        const created = await InventoryService.createConsumableStoreEntry({
          entry_date: consumableEntryForm.entry_date || undefined,
          store: consumableEntryForm.store || undefined,
          item_category_id: consumableEntryForm.item_category_id || undefined,
          item_id: consumableEntryForm.item_id || undefined,
          unit: consumableEntryForm.unit || undefined,
          opening_balance:
            consumableEntryForm.opening_balance === ""
              ? undefined
              : Number(consumableEntryForm.opening_balance),
          issued_today:
            consumableEntryForm.issued_today === ""
              ? undefined
              : Number(consumableEntryForm.issued_today),
          remarks: consumableEntryForm.remarks || undefined,
          checked_by_initials: consumableEntryForm.checked_by_initials || undefined,
          overwrite_opening_balance: !!consumableEntryForm.overwrite_opening_balance,
        });

        router.push(`/inventory/${created.id}?kind=consumable`);
        return;
      }

      const created = await InventoryService.createProductStoreEntry({
        entry_date: productEntryForm.entry_date || undefined,
        store: productEntryForm.store || undefined,
        product_category_id: productEntryForm.product_category_id || undefined,
        product_id: productEntryForm.product_id || undefined,
        balance_unit: productEntryForm.balance_unit || undefined,
        opening_balance:
          productEntryForm.opening_balance === ""
            ? undefined
            : Number(productEntryForm.opening_balance),
        inflow_production:
          productEntryForm.inflow_production === ""
            ? undefined
            : Number(productEntryForm.inflow_production),
        inflow_transfers_in:
          productEntryForm.inflow_transfers_in === ""
            ? undefined
            : Number(productEntryForm.inflow_transfers_in),
        outflow_dispatch:
          productEntryForm.outflow_dispatch === ""
            ? undefined
            : Number(productEntryForm.outflow_dispatch),
        outflow_transfers_out:
          productEntryForm.outflow_transfers_out === ""
            ? undefined
            : Number(productEntryForm.outflow_transfers_out),
        total_boxes:
          productEntryForm.total_boxes === ""
            ? undefined
            : Number(productEntryForm.total_boxes),
        total_pieces:
          productEntryForm.total_pieces === ""
            ? undefined
            : Number(productEntryForm.total_pieces),
        remarks: productEntryForm.remarks || undefined,
        checked_by_initials: productEntryForm.checked_by_initials || undefined,
        overwrite_opening_balance: !!productEntryForm.overwrite_opening_balance,
      });

      router.push(`/inventory/${created.id}?kind=product`);
    } catch (err) {
      setError(toErrorMessage(err, "Unable to create inventory entry."));
    } finally {
      setEntrySaving(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: PAGE_BG,
        color: TEXT,
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: 1500,
          margin: "0 auto",
          padding: "18px 18px 34px",
          boxSizing: "border-box",
        }}
      >
        <PageCard
          title="Inventory Setup and New Entry"
          subtitle="Create categories, products, consumable items, and stock entries from one place. Opening balance can auto-fill from the previous closing balance."
          action={
            <Link
              href="/inventory"
              style={{
                ...buttonStyle("secondary"),
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
              }}
            >
              Back to Inventory
            </Link>
          }
          style={{ marginBottom: 18 }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
              gap: 12,
              marginBottom: 16,
            }}
          >
            <StatCard label="Product Categories" value={productCategories.length} tone="orange" />
            <StatCard label="Products" value={products.length} tone="blue" />
            <StatCard
              label="Consumable Categories"
              value={consumableCategories.length}
              tone="green"
            />
            <StatCard label="Consumable Items" value={consumableItems.length} tone="orange" />
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <TabButton active={mainTab === "entry"} onClick={() => setMainTab("entry")}>
              Create Entry
            </TabButton>
            <TabButton active={mainTab === "setup"} onClick={() => setMainTab("setup")}>
              Setup Categories / Products / Items
            </TabButton>
          </div>
        </PageCard>

        {error ? (
          <div
            style={{
              marginBottom: 16,
              background: RED_SOFT,
              color: RED,
              border: "1px solid rgba(185,28,28,0.12)",
              padding: "12px 14px",
              borderRadius: 14,
              fontSize: 14,
              fontFamily: "Arial, sans-serif",
            }}
          >
            {error}
          </div>
        ) : null}

        {notice ? (
          <div
            style={{
              marginBottom: 16,
              background: GREEN_SOFT,
              color: GREEN,
              border: "1px solid rgba(21,128,61,0.12)",
              padding: "12px 14px",
              borderRadius: 14,
              fontSize: 14,
              fontFamily: "Arial, sans-serif",
            }}
          >
            {notice}
          </div>
        ) : null}

        {loading ? (
          <PageCard title="Loading" subtitle="Please wait while inventory data loads.">
            <div
              style={{
                color: MUTED,
                fontSize: 14,
                fontFamily: "Arial, sans-serif",
              }}
            >
              Loading inventory data...
            </div>
          </PageCard>
        ) : mainTab === "setup" ? (
          <>
            <PageCard
              title="Setup Master Records"
              subtitle="Add new product categories, products, consumable categories, and consumable items. These records feed the stock-entry dropdowns."
              style={{ marginBottom: 16 }}
            >
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <TabButton
                  active={setupTab === "productCategory"}
                  onClick={() => setSetupTab("productCategory")}
                >
                  Product Category
                </TabButton>
                <TabButton active={setupTab === "product"} onClick={() => setSetupTab("product")}>
                  Product
                </TabButton>
                <TabButton
                  active={setupTab === "consumableCategory"}
                  onClick={() => setSetupTab("consumableCategory")}
                >
                  Consumable Category
                </TabButton>
                <TabButton
                  active={setupTab === "consumableItem"}
                  onClick={() => setSetupTab("consumableItem")}
                >
                  Consumable Item
                </TabButton>
              </div>
            </PageCard>

            {setupTab === "productCategory" ? (
              <PageCard
                title="Create Product Category"
                subtitle="Add a new product category for product setup and stock entry."
                action={
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={handleCreateProductCategory}
                      disabled={setupSaving}
                      style={buttonStyle()}
                    >
                      {setupSaving ? "Saving..." : "Create Product Category"}
                    </button>
                    <button
                      type="button"
                      onClick={resetProductCategoryForm}
                      disabled={setupSaving}
                      style={buttonStyle("secondary")}
                    >
                      Reset
                    </button>
                  </div>
                }
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: 14,
                  }}
                >
                  <div>
                    <FieldLabel>Category Name</FieldLabel>
                    <input
                      type="text"
                      value={productCategoryForm.name}
                      onChange={(e) =>
                        setProductCategoryForm((prev) => ({
                          ...prev,
                          name: e.target.value,
                        }))
                      }
                      style={inputStyle()}
                    />
                  </div>

                  <div>
                    <FieldLabel>Sort Order</FieldLabel>
                    <input
                      type="number"
                      value={productCategoryForm.sort_order}
                      onChange={(e) =>
                        setProductCategoryForm((prev) => ({
                          ...prev,
                          sort_order: e.target.value,
                        }))
                      }
                      style={inputStyle()}
                    />
                  </div>

                  <div style={{ display: "flex", alignItems: "flex-end" }}>
                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        color: TEXT,
                        fontSize: 13,
                        fontWeight: 700,
                        fontFamily: "Arial, sans-serif",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={!!productCategoryForm.is_active}
                        onChange={(e) =>
                          setProductCategoryForm((prev) => ({
                            ...prev,
                            is_active: e.target.checked,
                          }))
                        }
                      />
                      Active
                    </label>
                  </div>

                  <div style={{ gridColumn: "1 / -1" }}>
                    <FieldLabel>Description</FieldLabel>
                    <textarea
                      value={productCategoryForm.description}
                      onChange={(e) =>
                        setProductCategoryForm((prev) => ({
                          ...prev,
                          description: e.target.value,
                        }))
                      }
                      style={textareaStyle()}
                    />
                  </div>
                </div>
              </PageCard>
            ) : null}

            {setupTab === "product" ? (
              <PageCard
                title="Create Product"
                subtitle="Add a new product under an existing product category."
                action={
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={handleCreateProduct}
                      disabled={setupSaving}
                      style={buttonStyle()}
                    >
                      {setupSaving ? "Saving..." : "Create Product"}
                    </button>
                    <button
                      type="button"
                      onClick={resetProductForm}
                      disabled={setupSaving}
                      style={buttonStyle("secondary")}
                    >
                      Reset
                    </button>
                  </div>
                }
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: 14,
                  }}
                >
                  <div>
                    <FieldLabel>Category</FieldLabel>
                    <select
                      value={productForm.category_id}
                      onChange={(e) =>
                        setProductForm((prev) => ({
                          ...prev,
                          category_id: e.target.value,
                        }))
                      }
                      style={inputStyle()}
                    >
                      <option value="">Select category</option>
                      {productCategories.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <FieldLabel>Product Name</FieldLabel>
                    <input
                      type="text"
                      value={productForm.name}
                      onChange={(e) =>
                        setProductForm((prev) => ({
                          ...prev,
                          name: e.target.value,
                        }))
                      }
                      style={inputStyle()}
                    />
                  </div>

                  <div>
                    <FieldLabel>Default Stock Unit</FieldLabel>
                    <select
                      value={productForm.default_stock_unit}
                      onChange={(e) =>
                        setProductForm((prev) => ({
                          ...prev,
                          default_stock_unit: e.target.value,
                        }))
                      }
                      style={inputStyle()}
                    >
                      <option value="kg">kg</option>
                      <option value="pcs">pcs</option>
                    </select>
                  </div>

                  <div>
                    <FieldLabel>Sort Order</FieldLabel>
                    <input
                      type="number"
                      value={productForm.sort_order}
                      onChange={(e) =>
                        setProductForm((prev) => ({
                          ...prev,
                          sort_order: e.target.value,
                        }))
                      }
                      style={inputStyle()}
                    />
                  </div>

                  <div style={{ display: "flex", alignItems: "flex-end" }}>
                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        color: TEXT,
                        fontSize: 13,
                        fontWeight: 700,
                        fontFamily: "Arial, sans-serif",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={!!productForm.is_active}
                        onChange={(e) =>
                          setProductForm((prev) => ({
                            ...prev,
                            is_active: e.target.checked,
                          }))
                        }
                      />
                      Active
                    </label>
                  </div>

                  <div style={{ gridColumn: "1 / -1" }}>
                    <FieldLabel>Description</FieldLabel>
                    <textarea
                      value={productForm.description}
                      onChange={(e) =>
                        setProductForm((prev) => ({
                          ...prev,
                          description: e.target.value,
                        }))
                      }
                      style={textareaStyle()}
                    />
                  </div>
                </div>
              </PageCard>
            ) : null}

            {setupTab === "consumableCategory" ? (
              <PageCard
                title="Create Consumable Category"
                subtitle="Add a new consumable category for consumable item setup and stock entry."
                action={
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={handleCreateConsumableCategory}
                      disabled={setupSaving}
                      style={buttonStyle()}
                    >
                      {setupSaving ? "Saving..." : "Create Consumable Category"}
                    </button>
                    <button
                      type="button"
                      onClick={resetConsumableCategoryForm}
                      disabled={setupSaving}
                      style={buttonStyle("secondary")}
                    >
                      Reset
                    </button>
                  </div>
                }
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: 14,
                  }}
                >
                  <div>
                    <FieldLabel>Category Name</FieldLabel>
                    <input
                      type="text"
                      value={consumableCategoryForm.name}
                      onChange={(e) =>
                        setConsumableCategoryForm((prev) => ({
                          ...prev,
                          name: e.target.value,
                        }))
                      }
                      style={inputStyle()}
                    />
                  </div>

                  <div>
                    <FieldLabel>Sort Order</FieldLabel>
                    <input
                      type="number"
                      value={consumableCategoryForm.sort_order}
                      onChange={(e) =>
                        setConsumableCategoryForm((prev) => ({
                          ...prev,
                          sort_order: e.target.value,
                        }))
                      }
                      style={inputStyle()}
                    />
                  </div>

                  <div style={{ display: "flex", alignItems: "flex-end" }}>
                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        color: TEXT,
                        fontSize: 13,
                        fontWeight: 700,
                        fontFamily: "Arial, sans-serif",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={!!consumableCategoryForm.is_active}
                        onChange={(e) =>
                          setConsumableCategoryForm((prev) => ({
                            ...prev,
                            is_active: e.target.checked,
                          }))
                        }
                      />
                      Active
                    </label>
                  </div>

                  <div style={{ gridColumn: "1 / -1" }}>
                    <FieldLabel>Description</FieldLabel>
                    <textarea
                      value={consumableCategoryForm.description}
                      onChange={(e) =>
                        setConsumableCategoryForm((prev) => ({
                          ...prev,
                          description: e.target.value,
                        }))
                      }
                      style={textareaStyle()}
                    />
                  </div>
                </div>
              </PageCard>
            ) : null}

            {setupTab === "consumableItem" ? (
              <PageCard
                title="Create Consumable Item"
                subtitle="Add a new consumable item under an existing consumable category."
                action={
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={handleCreateConsumableItem}
                      disabled={setupSaving}
                      style={buttonStyle()}
                    >
                      {setupSaving ? "Saving..." : "Create Consumable Item"}
                    </button>
                    <button
                      type="button"
                      onClick={resetConsumableItemForm}
                      disabled={setupSaving}
                      style={buttonStyle("secondary")}
                    >
                      Reset
                    </button>
                  </div>
                }
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: 14,
                  }}
                >
                  <div>
                    <FieldLabel>Category</FieldLabel>
                    <select
                      value={consumableItemForm.category_id}
                      onChange={(e) =>
                        setConsumableItemForm((prev) => ({
                          ...prev,
                          category_id: e.target.value,
                        }))
                      }
                      style={inputStyle()}
                    >
                      <option value="">Select category</option>
                      {consumableCategories.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <FieldLabel>Item Name</FieldLabel>
                    <input
                      type="text"
                      value={consumableItemForm.name}
                      onChange={(e) =>
                        setConsumableItemForm((prev) => ({
                          ...prev,
                          name: e.target.value,
                        }))
                      }
                      style={inputStyle()}
                    />
                  </div>

                  <div>
                    <FieldLabel>Default Unit</FieldLabel>
                    <input
                      type="text"
                      value={consumableItemForm.default_unit}
                      onChange={(e) =>
                        setConsumableItemForm((prev) => ({
                          ...prev,
                          default_unit: e.target.value,
                        }))
                      }
                      style={inputStyle()}
                    />
                  </div>

                  <div>
                    <FieldLabel>Sort Order</FieldLabel>
                    <input
                      type="number"
                      value={consumableItemForm.sort_order}
                      onChange={(e) =>
                        setConsumableItemForm((prev) => ({
                          ...prev,
                          sort_order: e.target.value,
                        }))
                      }
                      style={inputStyle()}
                    />
                  </div>

                  <div style={{ display: "flex", alignItems: "flex-end" }}>
                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        color: TEXT,
                        fontSize: 13,
                        fontWeight: 700,
                        fontFamily: "Arial, sans-serif",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={!!consumableItemForm.is_active}
                        onChange={(e) =>
                          setConsumableItemForm((prev) => ({
                            ...prev,
                            is_active: e.target.checked,
                          }))
                        }
                      />
                      Active
                    </label>
                  </div>

                  <div style={{ gridColumn: "1 / -1" }}>
                    <FieldLabel>Description</FieldLabel>
                    <textarea
                      value={consumableItemForm.description}
                      onChange={(e) =>
                        setConsumableItemForm((prev) => ({
                          ...prev,
                          description: e.target.value,
                        }))
                      }
                      style={textareaStyle()}
                    />
                  </div>
                </div>
              </PageCard>
            ) : null}
          </>
        ) : (
          <>
            <PageCard
              title="Create Stock Entry"
              subtitle="Select product or consumable entry type, auto-fill opening balance if needed, and save the record."
              style={{ marginBottom: 16 }}
            >
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <TabButton
                  active={entryType === "product"}
                  onClick={() => setEntryType("product")}
                >
                  Product Entry
                </TabButton>
                <TabButton
                  active={entryType === "consumable"}
                  onClick={() => setEntryType("consumable")}
                >
                  Consumable Entry
                </TabButton>
              </div>
            </PageCard>

            <PageCard
              title={entryType === "product" ? "New Product Entry" : "New Consumable Entry"}
              subtitle={
                entryType === "product"
                  ? "Record product inflow, transfers, dispatch, and closing stock."
                  : "Record consumable issuance and closing stock."
              }
              action={
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={
                      entryType === "product"
                        ? handleAutofillProductOpening
                        : handleAutofillConsumableOpening
                    }
                    disabled={openingLoading || entrySaving}
                    style={buttonStyle("softBlue")}
                  >
                    {openingLoading ? "Refreshing..." : "Auto-fill Opening Balance"}
                  </button>

                  <button
                    type="button"
                    onClick={handleCreateEntry}
                    disabled={entrySaving}
                    style={buttonStyle()}
                  >
                    {entrySaving ? "Saving..." : "Create Entry"}
                  </button>

                  <button
                    type="button"
                    onClick={
                      entryType === "product"
                        ? resetProductEntryForm
                        : resetConsumableEntryForm
                    }
                    disabled={entrySaving}
                    style={buttonStyle("secondary")}
                  >
                    Reset
                  </button>
                </div>
              }
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                  gap: 12,
                  marginBottom: 16,
                }}
              >
                {entryType === "product" ? (
                  <>
                    <StatCard
                      label="Opening"
                      value={formatNumber(productEntryForm.opening_balance)}
                      tone="blue"
                    />
                    <StatCard
                      label="Net Movement"
                      value={formatNumber(
                        Number(productEntryForm.inflow_production || 0) +
                          Number(productEntryForm.inflow_transfers_in || 0) -
                          Number(productEntryForm.outflow_dispatch || 0) -
                          Number(productEntryForm.outflow_transfers_out || 0)
                      )}
                      tone="orange"
                    />
                    <StatCard
                      label="Closing"
                      value={formatNumber(computedProductClosing)}
                      tone={computedProductClosing < 0 ? "red" : "green"}
                    />
                  </>
                ) : (
                  <>
                    <StatCard
                      label="Opening"
                      value={formatNumber(consumableEntryForm.opening_balance)}
                      tone="blue"
                    />
                    <StatCard
                      label="Issued"
                      value={formatNumber(consumableEntryForm.issued_today)}
                      tone="orange"
                    />
                    <StatCard
                      label="Closing"
                      value={formatNumber(computedConsumableClosing)}
                      tone={computedConsumableClosing < 0 ? "red" : "green"}
                    />
                  </>
                )}
              </div>

              {entryType === "product" ? (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: 14,
                  }}
                >
                  <div>
                    <FieldLabel>Date</FieldLabel>
                    <input
                      type="date"
                      value={productEntryForm.entry_date}
                      onChange={(e) =>
                        setProductEntryForm((prev) => ({
                          ...prev,
                          entry_date: e.target.value,
                        }))
                      }
                      style={inputStyle()}
                    />
                  </div>

                  <div>
                    <FieldLabel>Store</FieldLabel>
                    <select
                      value={productEntryForm.store}
                      onChange={(e) =>
                        setProductEntryForm((prev) => ({
                          ...prev,
                          store: e.target.value,
                        }))
                      }
                      style={inputStyle()}
                    >
                      <option value="">Select store</option>
                      {productStores.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <FieldLabel>Product Category</FieldLabel>
                    <select
                      value={productEntryForm.product_category_id}
                      onChange={(e) =>
                        setProductEntryForm((prev) => ({
                          ...prev,
                          product_category_id: e.target.value,
                          product_id: "",
                        }))
                      }
                      style={inputStyle()}
                    >
                      <option value="">Select category</option>
                      {productCategories.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <FieldLabel>Product</FieldLabel>
                    <select
                      value={productEntryForm.product_id}
                      onChange={(e) =>
                        setProductEntryForm((prev) => ({
                          ...prev,
                          product_id: e.target.value,
                        }))
                      }
                      style={inputStyle()}
                    >
                      <option value="">Select product</option>
                      {filteredProductsForEntry.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <FieldLabel>Balance Unit</FieldLabel>
                    <select
                      value={productEntryForm.balance_unit}
                      onChange={(e) =>
                        setProductEntryForm((prev) => ({
                          ...prev,
                          balance_unit: e.target.value,
                        }))
                      }
                      style={inputStyle()}
                    >
                      <option value="kg">kg</option>
                      <option value="pcs">pcs</option>
                    </select>
                  </div>

                  <div>
                    <FieldLabel>Opening Balance</FieldLabel>
                    <input
                      type="number"
                      step="0.01"
                      value={productEntryForm.opening_balance}
                      onChange={(e) =>
                        setProductEntryForm((prev) => ({
                          ...prev,
                          opening_balance: e.target.value,
                        }))
                      }
                      style={inputStyle()}
                    />
                  </div>

                  <div>
                    <FieldLabel>Inflow - Production</FieldLabel>
                    <input
                      type="number"
                      step="0.01"
                      value={productEntryForm.inflow_production}
                      onChange={(e) =>
                        setProductEntryForm((prev) => ({
                          ...prev,
                          inflow_production: e.target.value,
                        }))
                      }
                      style={inputStyle()}
                    />
                  </div>

                  <div>
                    <FieldLabel>Inflow - Transfers In</FieldLabel>
                    <input
                      type="number"
                      step="0.01"
                      value={productEntryForm.inflow_transfers_in}
                      onChange={(e) =>
                        setProductEntryForm((prev) => ({
                          ...prev,
                          inflow_transfers_in: e.target.value,
                        }))
                      }
                      style={inputStyle()}
                    />
                  </div>

                  <div>
                    <FieldLabel>Outflow - Dispatch</FieldLabel>
                    <input
                      type="number"
                      step="0.01"
                      value={productEntryForm.outflow_dispatch}
                      onChange={(e) =>
                        setProductEntryForm((prev) => ({
                          ...prev,
                          outflow_dispatch: e.target.value,
                        }))
                      }
                      style={inputStyle()}
                    />
                  </div>

                  <div>
                    <FieldLabel>Outflow - Transfers Out</FieldLabel>
                    <input
                      type="number"
                      step="0.01"
                      value={productEntryForm.outflow_transfers_out}
                      onChange={(e) =>
                        setProductEntryForm((prev) => ({
                          ...prev,
                          outflow_transfers_out: e.target.value,
                        }))
                      }
                      style={inputStyle()}
                    />
                  </div>

                  <div>
                    <FieldLabel>Total Boxes</FieldLabel>
                    <input
                      type="number"
                      step="1"
                      value={productEntryForm.total_boxes}
                      onChange={(e) =>
                        setProductEntryForm((prev) => ({
                          ...prev,
                          total_boxes: e.target.value,
                        }))
                      }
                      style={inputStyle()}
                    />
                  </div>

                  <div>
                    <FieldLabel>Total Pieces</FieldLabel>
                    <input
                      type="number"
                      step="1"
                      value={productEntryForm.total_pieces}
                      onChange={(e) =>
                        setProductEntryForm((prev) => ({
                          ...prev,
                          total_pieces: e.target.value,
                        }))
                      }
                      style={inputStyle()}
                    />
                  </div>

                  <div>
                    <FieldLabel>Checked By (Initials)</FieldLabel>
                    <input
                      type="text"
                      value={productEntryForm.checked_by_initials}
                      onChange={(e) =>
                        setProductEntryForm((prev) => ({
                          ...prev,
                          checked_by_initials: e.target.value,
                        }))
                      }
                      style={inputStyle()}
                    />
                  </div>

                  <div style={{ display: "flex", alignItems: "flex-end" }}>
                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        color: TEXT,
                        fontSize: 13,
                        fontWeight: 700,
                        fontFamily: "Arial, sans-serif",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={!!productEntryForm.overwrite_opening_balance}
                        onChange={(e) =>
                          setProductEntryForm((prev) => ({
                            ...prev,
                            overwrite_opening_balance: e.target.checked,
                          }))
                        }
                      />
                      Allow manual opening balance override
                    </label>
                  </div>

                  <div style={{ gridColumn: "1 / -1" }}>
                    <FieldLabel>Remarks</FieldLabel>
                    <textarea
                      value={productEntryForm.remarks}
                      onChange={(e) =>
                        setProductEntryForm((prev) => ({
                          ...prev,
                          remarks: e.target.value,
                        }))
                      }
                      style={textareaStyle()}
                    />
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: 14,
                  }}
                >
                  <div>
                    <FieldLabel>Date</FieldLabel>
                    <input
                      type="date"
                      value={consumableEntryForm.entry_date}
                      onChange={(e) =>
                        setConsumableEntryForm((prev) => ({
                          ...prev,
                          entry_date: e.target.value,
                        }))
                      }
                      style={inputStyle()}
                    />
                  </div>

                  <div>
                    <FieldLabel>Store</FieldLabel>
                    <select
                      value={consumableEntryForm.store}
                      onChange={(e) =>
                        setConsumableEntryForm((prev) => ({
                          ...prev,
                          store: e.target.value,
                        }))
                      }
                      style={inputStyle()}
                    >
                      <option value="">Select store</option>
                      {consumableStores.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <FieldLabel>Consumable Category</FieldLabel>
                    <select
                      value={consumableEntryForm.item_category_id}
                      onChange={(e) =>
                        setConsumableEntryForm((prev) => ({
                          ...prev,
                          item_category_id: e.target.value,
                          item_id: "",
                        }))
                      }
                      style={inputStyle()}
                    >
                      <option value="">Select category</option>
                      {consumableCategories.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <FieldLabel>Consumable Item</FieldLabel>
                    <select
                      value={consumableEntryForm.item_id}
                      onChange={(e) =>
                        setConsumableEntryForm((prev) => ({
                          ...prev,
                          item_id: e.target.value,
                        }))
                      }
                      style={inputStyle()}
                    >
                      <option value="">Select item</option>
                      {filteredConsumableItemsForEntry.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <FieldLabel>Unit</FieldLabel>
                    <input
                      type="text"
                      value={consumableEntryForm.unit}
                      onChange={(e) =>
                        setConsumableEntryForm((prev) => ({
                          ...prev,
                          unit: e.target.value,
                        }))
                      }
                      style={inputStyle()}
                    />
                  </div>

                  <div>
                    <FieldLabel>Opening Balance</FieldLabel>
                    <input
                      type="number"
                      step="0.01"
                      value={consumableEntryForm.opening_balance}
                      onChange={(e) =>
                        setConsumableEntryForm((prev) => ({
                          ...prev,
                          opening_balance: e.target.value,
                        }))
                      }
                      style={inputStyle()}
                    />
                  </div>

                  <div>
                    <FieldLabel>Issued Today</FieldLabel>
                    <input
                      type="number"
                      step="0.01"
                      value={consumableEntryForm.issued_today}
                      onChange={(e) =>
                        setConsumableEntryForm((prev) => ({
                          ...prev,
                          issued_today: e.target.value,
                        }))
                      }
                      style={inputStyle()}
                    />
                  </div>

                  <div>
                    <FieldLabel>Checked By (Initials)</FieldLabel>
                    <input
                      type="text"
                      value={consumableEntryForm.checked_by_initials}
                      onChange={(e) =>
                        setConsumableEntryForm((prev) => ({
                          ...prev,
                          checked_by_initials: e.target.value,
                        }))
                      }
                      style={inputStyle()}
                    />
                  </div>

                  <div style={{ display: "flex", alignItems: "flex-end" }}>
                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        color: TEXT,
                        fontSize: 13,
                        fontWeight: 700,
                        fontFamily: "Arial, sans-serif",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={!!consumableEntryForm.overwrite_opening_balance}
                        onChange={(e) =>
                          setConsumableEntryForm((prev) => ({
                            ...prev,
                            overwrite_opening_balance: e.target.checked,
                          }))
                        }
                      />
                      Allow manual opening balance override
                    </label>
                  </div>

                  <div>
                    <FieldLabel>Computed Closing Balance</FieldLabel>
                    <div
                      style={{
                        ...inputStyle(),
                        display: "flex",
                        alignItems: "center",
                        background:
                          computedConsumableClosing < 0 ? RED_SOFT : GREEN_SOFT,
                        color: computedConsumableClosing < 0 ? RED : GREEN,
                        fontWeight: 700,
                      }}
                    >
                      {formatNumber(computedConsumableClosing)}
                    </div>
                  </div>

                  <div style={{ gridColumn: "1 / -1" }}>
                    <FieldLabel>Remarks</FieldLabel>
                    <textarea
                      value={consumableEntryForm.remarks}
                      onChange={(e) =>
                        setConsumableEntryForm((prev) => ({
                          ...prev,
                          remarks: e.target.value,
                        }))
                      }
                      style={textareaStyle()}
                    />
                  </div>
                </div>
              )}
            </PageCard>
          </>
        )}
      </div>
    </div>
  );
}