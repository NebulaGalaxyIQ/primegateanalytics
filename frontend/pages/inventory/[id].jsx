import Link from "next/link";
import { useRouter } from "next/router";
import { useCallback, useEffect, useMemo, useState } from "react";

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

function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDateTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatNumber(value) {
  const num = Number(value ?? 0);
  if (!Number.isFinite(num)) return "0.00";
  return num.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function toErrorMessage(error, fallback = "Something went wrong.") {
  return error?.message || fallback;
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
    minHeight: 100,
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

function DetailGrid({ items }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        gap: 12,
      }}
    >
      {items.map((item) => (
        <div
          key={item.label}
          style={{
            border: `1px solid ${BORDER}`,
            borderRadius: 16,
            padding: 14,
            background: "#ffffff",
          }}
        >
          <div
            style={{
              color: MUTED,
              fontSize: 12,
              fontWeight: 700,
              marginBottom: 6,
              fontFamily: "Arial, sans-serif",
            }}
          >
            {item.label}
          </div>
          <div
            style={{
              color: TEXT,
              fontSize: 15,
              lineHeight: 1.55,
              wordBreak: "break-word",
              fontFamily: "Arial, sans-serif",
            }}
          >
            {item.value ?? "—"}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function InventoryEntryDetailPage() {
  const router = useRouter();
  const { id, kind } = router.query;

  const entryKind = useMemo(() => {
    return kind === "consumable" ? "consumable" : "product";
  }, [kind]);

  const [bootstrap, setBootstrap] = useState({
    product_stores: [],
    consumable_stores: [],
    product_categories: [],
    products: [],
    consumable_categories: [],
    consumable_items: [],
  });

  const [entry, setEntry] = useState(null);
  const [loading, setLoading] = useState(true);
  const [bootstrapLoading, setBootstrapLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [openingLoading, setOpeningLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [productForm, setProductForm] = useState({
    entry_date: "",
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

  const [consumableForm, setConsumableForm] = useState({
    entry_date: "",
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

  const productCategories = Array.isArray(bootstrap.product_categories)
    ? bootstrap.product_categories
    : [];
  const products = Array.isArray(bootstrap.products) ? bootstrap.products : [];
  const consumableCategories = Array.isArray(bootstrap.consumable_categories)
    ? bootstrap.consumable_categories
    : [];
  const consumableItems = Array.isArray(bootstrap.consumable_items)
    ? bootstrap.consumable_items
    : [];
  const productStores = Array.isArray(bootstrap.product_stores)
    ? bootstrap.product_stores
    : [];
  const consumableStores = Array.isArray(bootstrap.consumable_stores)
    ? bootstrap.consumable_stores
    : [];

  const filteredProducts = useMemo(() => {
    if (!productForm.product_category_id) return products;
    return products.filter(
      (item) => item.category_id === productForm.product_category_id
    );
  }, [products, productForm.product_category_id]);

  const filteredConsumableItems = useMemo(() => {
    if (!consumableForm.item_category_id) return consumableItems;
    return consumableItems.filter(
      (item) => item.category_id === consumableForm.item_category_id
    );
  }, [consumableItems, consumableForm.item_category_id]);

  const computedProductClosing = useMemo(() => {
    const opening = Number(productForm.opening_balance || 0);
    const production = Number(productForm.inflow_production || 0);
    const transfersIn = Number(productForm.inflow_transfers_in || 0);
    const dispatch = Number(productForm.outflow_dispatch || 0);
    const transfersOut = Number(productForm.outflow_transfers_out || 0);
    return opening + production + transfersIn - dispatch - transfersOut;
  }, [productForm]);

  const computedConsumableClosing = useMemo(() => {
    const opening = Number(consumableForm.opening_balance || 0);
    const issued = Number(consumableForm.issued_today || 0);
    return opening - issued;
  }, [consumableForm]);

  const loadBootstrap = useCallback(async () => {
    setBootstrapLoading(true);
    try {
      const data = await InventoryService.getBootstrap();
      setBootstrap(data || {});
    } catch (err) {
      setError(toErrorMessage(err, "Unable to load inventory lists."));
    } finally {
      setBootstrapLoading(false);
    }
  }, []);

  const loadEntry = useCallback(async () => {
    if (!id) return;

    setLoading(true);
    setError("");
    setNotice("");

    try {
      if (entryKind === "consumable") {
        const data = await InventoryService.getConsumableStoreEntry(id);
        setEntry(data);
        setConsumableForm({
          entry_date: data?.entry_date || "",
          store: data?.store || "",
          item_category_id: data?.item_category_id || "",
          item_id: data?.item_id || "",
          unit: data?.unit || "",
          opening_balance: data?.opening_balance ?? "",
          issued_today: data?.issued_today ?? "",
          remarks: data?.remarks || "",
          checked_by_initials: data?.checked_by_initials || "",
          overwrite_opening_balance: false,
        });
      } else {
        const data = await InventoryService.getProductStoreEntry(id);
        setEntry(data);
        setProductForm({
          entry_date: data?.entry_date || "",
          store: data?.store || "",
          product_category_id: data?.product_category_id || "",
          product_id: data?.product_id || "",
          balance_unit: data?.balance_unit || "kg",
          opening_balance: data?.opening_balance ?? "",
          inflow_production: data?.inflow_production ?? "",
          inflow_transfers_in: data?.inflow_transfers_in ?? "",
          outflow_dispatch: data?.outflow_dispatch ?? "",
          outflow_transfers_out: data?.outflow_transfers_out ?? "",
          total_boxes: data?.total_boxes ?? "",
          total_pieces: data?.total_pieces ?? "",
          remarks: data?.remarks || "",
          checked_by_initials: data?.checked_by_initials || "",
          overwrite_opening_balance: false,
        });
      }
    } catch (err) {
      setError(toErrorMessage(err, "Unable to load inventory entry."));
    } finally {
      setLoading(false);
    }
  }, [entryKind, id]);

  useEffect(() => {
    loadBootstrap();
  }, [loadBootstrap]);

  useEffect(() => {
    loadEntry();
  }, [loadEntry]);

  const handleAutofillProductOpening = async () => {
    if (!productForm.entry_date || !productForm.store || !productForm.product_id) return;

    setOpeningLoading(true);
    setError("");
    setNotice("");

    try {
      const data = await InventoryService.autofillProductOpeningBalance({
        entryDate: productForm.entry_date,
        store: productForm.store,
        productId: productForm.product_id,
      });

      setProductForm((prev) => ({
        ...prev,
        opening_balance: data?.opening_balance ?? 0,
        overwrite_opening_balance: false,
      }));

      setNotice("Opening balance refreshed from previous closing balance.");
    } catch (err) {
      setError(toErrorMessage(err, "Unable to auto-fill product opening balance."));
    } finally {
      setOpeningLoading(false);
    }
  };

  const handleAutofillConsumableOpening = async () => {
    if (
      !consumableForm.entry_date ||
      !consumableForm.store ||
      !consumableForm.item_id
    ) {
      return;
    }

    setOpeningLoading(true);
    setError("");
    setNotice("");

    try {
      const data = await InventoryService.autofillConsumableOpeningBalance({
        entryDate: consumableForm.entry_date,
        store: consumableForm.store,
        itemId: consumableForm.item_id,
      });

      setConsumableForm((prev) => ({
        ...prev,
        opening_balance: data?.opening_balance ?? 0,
        overwrite_opening_balance: false,
      }));

      setNotice("Opening balance refreshed from previous closing balance.");
    } catch (err) {
      setError(
        toErrorMessage(err, "Unable to auto-fill consumable opening balance.")
      );
    } finally {
      setOpeningLoading(false);
    }
  };

  const handleSave = async () => {
    if (!id) return;

    setSaving(true);
    setError("");
    setNotice("");

    try {
      if (entryKind === "consumable") {
        const payload = {
          entry_date: consumableForm.entry_date || undefined,
          store: consumableForm.store || undefined,
          item_category_id: consumableForm.item_category_id || undefined,
          item_id: consumableForm.item_id || undefined,
          unit: consumableForm.unit || undefined,
          opening_balance:
            consumableForm.opening_balance === ""
              ? undefined
              : Number(consumableForm.opening_balance),
          issued_today:
            consumableForm.issued_today === ""
              ? undefined
              : Number(consumableForm.issued_today),
          remarks: consumableForm.remarks || undefined,
          checked_by_initials: consumableForm.checked_by_initials || undefined,
          overwrite_opening_balance: !!consumableForm.overwrite_opening_balance,
        };

        await InventoryService.updateConsumableStoreEntry(id, payload);
      } else {
        const payload = {
          entry_date: productForm.entry_date || undefined,
          store: productForm.store || undefined,
          product_category_id: productForm.product_category_id || undefined,
          product_id: productForm.product_id || undefined,
          balance_unit: productForm.balance_unit || undefined,
          opening_balance:
            productForm.opening_balance === ""
              ? undefined
              : Number(productForm.opening_balance),
          inflow_production:
            productForm.inflow_production === ""
              ? undefined
              : Number(productForm.inflow_production),
          inflow_transfers_in:
            productForm.inflow_transfers_in === ""
              ? undefined
              : Number(productForm.inflow_transfers_in),
          outflow_dispatch:
            productForm.outflow_dispatch === ""
              ? undefined
              : Number(productForm.outflow_dispatch),
          outflow_transfers_out:
            productForm.outflow_transfers_out === ""
              ? undefined
              : Number(productForm.outflow_transfers_out),
          total_boxes:
            productForm.total_boxes === ""
              ? undefined
              : Number(productForm.total_boxes),
          total_pieces:
            productForm.total_pieces === ""
              ? undefined
              : Number(productForm.total_pieces),
          remarks: productForm.remarks || undefined,
          checked_by_initials: productForm.checked_by_initials || undefined,
          overwrite_opening_balance: !!productForm.overwrite_opening_balance,
        };

        await InventoryService.updateProductStoreEntry(id, payload);
      }

      setNotice("Inventory entry updated successfully.");
      await loadEntry();
    } catch (err) {
      setError(toErrorMessage(err, "Unable to update inventory entry."));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!id) return;

    const confirmed =
      typeof window !== "undefined"
        ? window.confirm("Are you sure you want to delete this inventory entry?")
        : true;

    if (!confirmed) return;

    setDeleting(true);
    setError("");
    setNotice("");

    try {
      if (entryKind === "consumable") {
        await InventoryService.deleteConsumableStoreEntry(id);
      } else {
        await InventoryService.deleteProductStoreEntry(id);
      }

      router.push("/inventory");
    } catch (err) {
      setError(toErrorMessage(err, "Unable to delete inventory entry."));
      setDeleting(false);
    }
  };

  const headerTitle =
    entryKind === "consumable"
      ? "Consumable Inventory Entry"
      : "Product Inventory Entry";

  const headerSubtitle =
    entryKind === "consumable"
      ? "Review and update store consumable stock details."
      : "Review and update product stock movement details.";

  const detailItems = useMemo(() => {
    if (!entry) return [];

    if (entryKind === "consumable") {
      return [
        { label: "Entry ID", value: entry.id || "—" },
        { label: "Date", value: formatDate(entry.entry_date) },
        { label: "Store", value: entry.store || "—" },
        { label: "Category", value: entry.item_category_name || "—" },
        { label: "Item", value: entry.item_name || "—" },
        { label: "Unit", value: entry.unit || "—" },
        { label: "Opening Balance", value: formatNumber(entry.opening_balance) },
        { label: "Issued Today", value: formatNumber(entry.issued_today) },
        { label: "Closing Balance", value: formatNumber(entry.closing_balance) },
        { label: "Checked By", value: entry.checked_by_initials || "—" },
        { label: "Created At", value: formatDateTime(entry.created_at) },
        { label: "Updated At", value: formatDateTime(entry.updated_at) },
      ];
    }

    return [
      { label: "Entry ID", value: entry.id || "—" },
      { label: "Date", value: formatDate(entry.entry_date) },
      { label: "Store", value: entry.store || "—" },
      { label: "Category", value: entry.product_category_name || "—" },
      { label: "Product", value: entry.product_name || "—" },
      { label: "Balance Unit", value: entry.balance_unit || "—" },
      { label: "Opening Balance", value: formatNumber(entry.opening_balance) },
      { label: "Production", value: formatNumber(entry.inflow_production) },
      { label: "Transfers In", value: formatNumber(entry.inflow_transfers_in) },
      { label: "Dispatch", value: formatNumber(entry.outflow_dispatch) },
      { label: "Transfers Out", value: formatNumber(entry.outflow_transfers_out) },
      { label: "Closing Balance", value: formatNumber(entry.closing_balance) },
      { label: "Total Boxes", value: entry.total_boxes ?? 0 },
      { label: "Total Pieces", value: entry.total_pieces ?? 0 },
      { label: "Checked By", value: entry.checked_by_initials || "—" },
      { label: "Created At", value: formatDateTime(entry.created_at) },
      { label: "Updated At", value: formatDateTime(entry.updated_at) },
    ];
  }, [entry, entryKind]);

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
          title={headerTitle}
          subtitle={headerSubtitle}
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
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 12,
            }}
          >
            {entryKind === "consumable" ? (
              <>
                <StatCard
                  label="Opening"
                  value={loading ? "..." : formatNumber(entry?.opening_balance)}
                  tone="blue"
                />
                <StatCard
                  label="Issued"
                  value={loading ? "..." : formatNumber(entry?.issued_today)}
                  tone="orange"
                />
                <StatCard
                  label="Closing"
                  value={loading ? "..." : formatNumber(entry?.closing_balance)}
                  tone={Number(entry?.closing_balance || 0) >= 0 ? "green" : "red"}
                />
              </>
            ) : (
              <>
                <StatCard
                  label="Opening"
                  value={loading ? "..." : formatNumber(entry?.opening_balance)}
                  tone="blue"
                />
                <StatCard
                  label="Net Movement"
                  value={
                    loading
                      ? "..."
                      : formatNumber(
                          Number(entry?.inflow_production || 0) +
                            Number(entry?.inflow_transfers_in || 0) -
                            Number(entry?.outflow_dispatch || 0) -
                            Number(entry?.outflow_transfers_out || 0)
                        )
                  }
                  tone="orange"
                />
                <StatCard
                  label="Closing"
                  value={loading ? "..." : formatNumber(entry?.closing_balance)}
                  tone={Number(entry?.closing_balance || 0) >= 0 ? "green" : "red"}
                />
              </>
            )}
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

        <PageCard
          title="Entry Overview"
          subtitle="Snapshot of the saved inventory record."
          style={{ marginBottom: 16 }}
        >
          {loading ? (
            <div
              style={{
                color: MUTED,
                fontSize: 14,
                fontFamily: "Arial, sans-serif",
              }}
            >
              Loading entry...
            </div>
          ) : (
            <DetailGrid items={detailItems} />
          )}
        </PageCard>

        <PageCard
          title="Edit Entry"
          subtitle={
            entryKind === "consumable"
              ? "Update the consumable stock details. Use auto-fill to refresh opening balance from the previous closing balance."
              : "Update the product stock details. Use auto-fill to refresh opening balance from the previous closing balance."
          }
          action={
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={
                  entryKind === "consumable"
                    ? handleAutofillConsumableOpening
                    : handleAutofillProductOpening
                }
                disabled={openingLoading || loading || bootstrapLoading}
                style={buttonStyle("softBlue")}
              >
                {openingLoading ? "Refreshing..." : "Auto-fill Opening Balance"}
              </button>

              <button
                type="button"
                onClick={handleSave}
                disabled={saving || deleting || loading || bootstrapLoading}
                style={buttonStyle()}
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>

              <button
                type="button"
                onClick={handleDelete}
                disabled={saving || deleting || loading}
                style={buttonStyle("danger")}
              >
                {deleting ? "Deleting..." : "Delete Entry"}
              </button>
            </div>
          }
        >
          {loading || bootstrapLoading ? (
            <div
              style={{
                color: MUTED,
                fontSize: 14,
                fontFamily: "Arial, sans-serif",
              }}
            >
              Loading form...
            </div>
          ) : entryKind === "consumable" ? (
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
                  value={consumableForm.entry_date}
                  onChange={(e) =>
                    setConsumableForm((prev) => ({
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
                  value={consumableForm.store}
                  onChange={(e) =>
                    setConsumableForm((prev) => ({
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
                <FieldLabel>Item Category</FieldLabel>
                <select
                  value={consumableForm.item_category_id}
                  onChange={(e) =>
                    setConsumableForm((prev) => ({
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
                <FieldLabel>Item</FieldLabel>
                <select
                  value={consumableForm.item_id}
                  onChange={(e) =>
                    setConsumableForm((prev) => ({
                      ...prev,
                      item_id: e.target.value,
                    }))
                  }
                  style={inputStyle()}
                >
                  <option value="">Select item</option>
                  {filteredConsumableItems.map((item) => (
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
                  value={consumableForm.unit}
                  onChange={(e) =>
                    setConsumableForm((prev) => ({
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
                  value={consumableForm.opening_balance}
                  onChange={(e) =>
                    setConsumableForm((prev) => ({
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
                  value={consumableForm.issued_today}
                  onChange={(e) =>
                    setConsumableForm((prev) => ({
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
                  value={consumableForm.checked_by_initials}
                  onChange={(e) =>
                    setConsumableForm((prev) => ({
                      ...prev,
                      checked_by_initials: e.target.value,
                    }))
                  }
                  style={inputStyle()}
                />
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
                    checked={!!consumableForm.overwrite_opening_balance}
                    onChange={(e) =>
                      setConsumableForm((prev) => ({
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
                  value={consumableForm.remarks}
                  onChange={(e) =>
                    setConsumableForm((prev) => ({
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
                  value={productForm.entry_date}
                  onChange={(e) =>
                    setProductForm((prev) => ({
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
                  value={productForm.store}
                  onChange={(e) =>
                    setProductForm((prev) => ({
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
                  value={productForm.product_category_id}
                  onChange={(e) =>
                    setProductForm((prev) => ({
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
                  value={productForm.product_id}
                  onChange={(e) =>
                    setProductForm((prev) => ({
                      ...prev,
                      product_id: e.target.value,
                    }))
                  }
                  style={inputStyle()}
                >
                  <option value="">Select product</option>
                  {filteredProducts.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <FieldLabel>Balance Unit</FieldLabel>
                <select
                  value={productForm.balance_unit}
                  onChange={(e) =>
                    setProductForm((prev) => ({
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
                  value={productForm.opening_balance}
                  onChange={(e) =>
                    setProductForm((prev) => ({
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
                  value={productForm.inflow_production}
                  onChange={(e) =>
                    setProductForm((prev) => ({
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
                  value={productForm.inflow_transfers_in}
                  onChange={(e) =>
                    setProductForm((prev) => ({
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
                  value={productForm.outflow_dispatch}
                  onChange={(e) =>
                    setProductForm((prev) => ({
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
                  value={productForm.outflow_transfers_out}
                  onChange={(e) =>
                    setProductForm((prev) => ({
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
                  value={productForm.total_boxes}
                  onChange={(e) =>
                    setProductForm((prev) => ({
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
                  value={productForm.total_pieces}
                  onChange={(e) =>
                    setProductForm((prev) => ({
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
                  value={productForm.checked_by_initials}
                  onChange={(e) =>
                    setProductForm((prev) => ({
                      ...prev,
                      checked_by_initials: e.target.value,
                    }))
                  }
                  style={inputStyle()}
                />
              </div>

              <div>
                <FieldLabel>Computed Closing Balance</FieldLabel>
                <div
                  style={{
                    ...inputStyle(),
                    display: "flex",
                    alignItems: "center",
                    background:
                      computedProductClosing < 0 ? RED_SOFT : GREEN_SOFT,
                    color: computedProductClosing < 0 ? RED : GREEN,
                    fontWeight: 700,
                  }}
                >
                  {formatNumber(computedProductClosing)}
                </div>
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
                    checked={!!productForm.overwrite_opening_balance}
                    onChange={(e) =>
                      setProductForm((prev) => ({
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
                  value={productForm.remarks}
                  onChange={(e) =>
                    setProductForm((prev) => ({
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
      </div>
    </div>
  );
}