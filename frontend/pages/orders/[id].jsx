import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import OrderService from "../../services/orders";
import { getToken } from "../../services/auth";

const FONT_FAMILY = "Arial, sans-serif";
const BG = "#ffffff";
const SURFACE = "#ffffff";
const TEXT = "#0f172a";
const MUTED = "#64748b";
const BORDER = "#e5e7eb";
const SOFT = "#f8fafc";
const BLUE = "#2563eb";
const BLUE_SOFT = "rgba(37,99,235,0.08)";
const GREEN = "#16a34a";
const GREEN_SOFT = "rgba(22,163,74,0.10)";
const ORANGE = "#f97316";
const ORANGE_SOFT = "rgba(249,115,22,0.10)";
const RED = "#dc2626";
const RED_SOFT = "rgba(220,38,38,0.10)";
const SHADOW = "0 10px 30px rgba(15, 23, 42, 0.05)";

const MODE_GENERAL = "general";
const MODE_FROZEN = "frozen_container";

const PRODUCT_KEYS = ["beef", "goat", "lamb"];

const PRODUCT_META = {
  beef: {
    label: "Beef",
    animalType: "cattle",
    productName: "Beef",
    piecesDivisor: 145,
  },
  goat: {
    label: "Goat",
    animalType: "goat",
    productName: "Goat",
    piecesDivisor: 8.5,
  },
  lamb: {
    label: "Lamb",
    animalType: "sheep",
    productName: "Lamb",
    piecesDivisor: 11,
  },
};

const GENERAL_TYPES = [
  { value: "local", label: "Local" },
  { value: "chilled", label: "Chilled" },
  { value: "frozen", label: "Frozen" },
];

const ORDER_STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "confirmed", label: "Confirmed" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

const GENERAL_BACK_DAYS = {
  local: 4,
  chilled: 2,
  frozen: 11,
};

function compactText(value) {
  return String(value || "").trim();
}

function toNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function toNullableInteger(value) {
  if (value === "" || value === null || value === undefined) return null;
  const num = Number(value);
  return Number.isFinite(num) ? Math.trunc(num) : null;
}

function toNullableNumber(value) {
  if (value === "" || value === null || value === undefined) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function roundTo(value, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round((Number(value) || 0) * factor) / factor;
}

function numToInput(value, decimals = 2) {
  const n = roundTo(value, decimals);
  if (!Number.isFinite(n)) return "";
  return String(n);
}

function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDateTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatMoney(value) {
  const num = Number(value || 0);
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(num) ? num : 0);
}

function formatNumber(value, maximumFractionDigits = 0) {
  const num = Number(value || 0);
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  }).format(Number.isFinite(num) ? num : 0);
}

function titleizeSlug(value) {
  if (!value) return "—";
  return String(value)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function statusPillStyle(status) {
  const normalized = String(status || "").toLowerCase();

  if (normalized === "completed") {
    return {
      color: GREEN,
      background: GREEN_SOFT,
      border: "1px solid rgba(22,163,74,0.18)",
    };
  }

  if (normalized === "confirmed" || normalized === "in_progress") {
    return {
      color: BLUE,
      background: BLUE_SOFT,
      border: "1px solid rgba(37,99,235,0.18)",
    };
  }

  if (normalized === "cancelled") {
    return {
      color: RED,
      background: RED_SOFT,
      border: "1px solid rgba(220,38,38,0.18)",
    };
  }

  return {
    color: ORANGE,
    background: ORANGE_SOFT,
    border: "1px solid rgba(249,115,22,0.18)",
  };
}

function subtractDays(baseDate, days) {
  const d = new Date(baseDate);
  d.setDate(d.getDate() - days);
  return d;
}

function toInputDate(value) {
  if (!value) return "";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function dateStrMinusDays(dateStr, days) {
  if (!dateStr) return "";
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  return toInputDate(subtractDays(d, days));
}

function detectProductBucket(item) {
  const animal = String(item?.animal_type || "").toLowerCase();
  const product = String(item?.product_name || "").toLowerCase();

  if (animal === "cattle" || product.includes("beef") || product.includes("cattle")) {
    return "beef";
  }
  if (animal === "goat" || product.includes("goat")) {
    return "goat";
  }
  if (
    animal === "sheep" ||
    product.includes("lamb") ||
    product.includes("sheep") ||
    product.includes("mutton")
  ) {
    return "lamb";
  }

  return null;
}

function extractQuantitiesFromItems(items) {
  const quantities = {
    beef: 0,
    goat: 0,
    lamb: 0,
  };

  if (!Array.isArray(items)) return quantities;

  items.forEach((item) => {
    const bucket = detectProductBucket(item);
    if (!bucket) return;
    quantities[bucket] += Number(item?.quantity_kg || 0);
  });

  return {
    beef: roundTo(quantities.beef, 2),
    goat: roundTo(quantities.goat, 2),
    lamb: roundTo(quantities.lamb, 2),
  };
}

function sumValues(obj) {
  return Object.values(obj).reduce((sum, val) => sum + (Number(val) || 0), 0);
}

function ratiosFromQuantities(totalQty, quantities) {
  const total = Math.max(Number(totalQty) || 0, 0);
  const out = { beef: 0, goat: 0, lamb: 0 };

  if (total <= 0) return out;

  let assigned = 0;
  PRODUCT_KEYS.forEach((key, index) => {
    if (index === PRODUCT_KEYS.length - 1) {
      out[key] = roundTo(Math.max(100 - assigned, 0), 2);
      return;
    }
    const ratio = roundTo(((Number(quantities[key]) || 0) / total) * 100, 2);
    out[key] = ratio;
    assigned += ratio;
  });

  return out;
}

function quantitiesFromRatios(totalQty, ratios) {
  const total = Math.max(Number(totalQty) || 0, 0);
  const out = { beef: 0, goat: 0, lamb: 0 };

  if (total <= 0) return out;

  let assigned = 0;
  PRODUCT_KEYS.forEach((key, index) => {
    if (index === PRODUCT_KEYS.length - 1) {
      out[key] = roundTo(Math.max(total - assigned, 0), 2);
      return;
    }
    const qty = roundTo((total * (Number(ratios[key]) || 0)) / 100, 2);
    out[key] = qty;
    assigned += qty;
  });

  return out;
}

function rebalanceRatios(currentRatios, changedKey, nextChangedValue) {
  const changed = Math.min(Math.max(Number(nextChangedValue) || 0, 0), 100);
  const others = PRODUCT_KEYS.filter((key) => key !== changedKey);
  const remaining = roundTo(100 - changed, 2);

  const next = {
    ...currentRatios,
    [changedKey]: changed,
  };

  const currentOtherTotal = others.reduce(
    (sum, key) => sum + Math.max(Number(currentRatios[key]) || 0, 0),
    0
  );

  let assigned = 0;
  others.forEach((key, index) => {
    let value = 0;

    if (index === others.length - 1) {
      value = roundTo(Math.max(remaining - assigned, 0), 2);
    } else if (currentOtherTotal > 0) {
      value = roundTo(
        (remaining * Math.max(Number(currentRatios[key]) || 0, 0)) /
          currentOtherTotal,
        2
      );
      assigned += value;
    } else {
      value = roundTo(remaining / others.length, 2);
      assigned += value;
    }

    next[key] = value;
  });

  return next;
}

function distributeRemainingQuantity(
  totalQty,
  changedKey,
  changedQty,
  currentQuantities,
  currentRatios
) {
  const total = Math.max(Number(totalQty) || 0, 0);
  const next = { ...currentQuantities };

  if (total <= 0) {
    next[changedKey] = Math.max(Number(changedQty) || 0, 0);
    return next;
  }

  next[changedKey] = Math.min(Math.max(Number(changedQty) || 0, 0), total);

  const others = PRODUCT_KEYS.filter((key) => key !== changedKey);
  const remaining = roundTo(Math.max(total - next[changedKey], 0), 2);

  let weights = others.reduce((acc, key) => {
    acc[key] = Math.max(Number(currentQuantities[key]) || 0, 0);
    return acc;
  }, {});

  let weightTotal = sumValues(weights);

  if (weightTotal <= 0) {
    weights = others.reduce((acc, key) => {
      acc[key] = Math.max(Number(currentRatios[key]) || 0, 0);
      return acc;
    }, {});
    weightTotal = sumValues(weights);
  }

  if (weightTotal <= 0) {
    weights = others.reduce((acc, key) => {
      acc[key] = 1;
      return acc;
    }, {});
    weightTotal = sumValues(weights);
  }

  let assigned = 0;
  others.forEach((key, index) => {
    let value = 0;
    if (index === others.length - 1) {
      value = roundTo(Math.max(remaining - assigned, 0), 2);
    } else {
      value = roundTo((remaining * weights[key]) / weightTotal, 2);
      assigned += value;
    }
    next[key] = value;
  });

  return next;
}

function deriveModeFromOrder(order) {
  return order?.order_profile === "frozen_container" ? MODE_FROZEN : MODE_GENERAL;
}

function deriveGeneralType(order) {
  const value = String(order?.order_type || "local").toLowerCase();
  return ["local", "chilled", "frozen"].includes(value) ? value : "local";
}

function buildEditableForm(order) {
  const mode = deriveModeFromOrder(order);
  const generalType = deriveGeneralType(order);

  const quantities = extractQuantitiesFromItems(order?.items_json);
  const totalQuantity =
    Number(order?.total_quantity_kg || 0) > 0
      ? Number(order.total_quantity_kg)
      : sumValues(quantities);

  const ratios =
    totalQuantity > 0
      ? ratiosFromQuantities(totalQuantity, quantities)
      : { beef: 0, goat: 50, lamb: 50 };

  return {
    mode,
    general_type: generalType,

    order_number: order?.order_number || "",
    enterprise_name: order?.enterprise_name || "",
    order_profile:
      order?.order_profile ||
      (mode === MODE_FROZEN ? "frozen_container" : "standard_order"),
    order_type: order?.order_type || generalType,
    order_subtype: order?.order_subtype || "",

    report_month:
      order?.report_month !== null && order?.report_month !== undefined
        ? String(order.report_month)
        : "",
    report_year:
      order?.report_year !== null && order?.report_year !== undefined
        ? String(order.report_year)
        : "",

    jurisdiction: order?.jurisdiction || "",
    notes: order?.notes || "",

    container_gate_in: toInputDate(order?.container_gate_in),
    departure_date: toInputDate(order?.departure_date),

    slaughter_schedule: toInputDate(order?.slaughter_schedule),
    expected_delivery: toInputDate(order?.expected_delivery),
    delivery_days_offset:
      order?.delivery_days_offset !== null &&
      order?.delivery_days_offset !== undefined
        ? String(order.delivery_days_offset)
        : "",
    is_delivery_date_manual: Boolean(order?.is_delivery_date_manual),

    total_quantity_kg: totalQuantity > 0 ? numToInput(totalQuantity, 2) : "",
    beef_ratio: numToInput(ratios.beef, 2),
    goat_ratio: numToInput(ratios.goat, 2),
    lamb_ratio: numToInput(ratios.lamb, 2),

    beef_quantity_kg: numToInput(quantities.beef, 2),
    goat_quantity_kg: numToInput(quantities.goat, 2),
    lamb_quantity_kg: numToInput(quantities.lamb, 2),

    shipment_value_usd:
      order?.shipment_value_usd !== null &&
      order?.shipment_value_usd !== undefined
        ? String(order.shipment_value_usd)
        : "",
    price_per_kg_usd:
      order?.price_per_kg_usd !== null && order?.price_per_kg_usd !== undefined
        ? String(order.price_per_kg_usd)
        : "",
    amount_paid_usd:
      order?.amount_paid_usd !== null && order?.amount_paid_usd !== undefined
        ? String(order.amount_paid_usd)
        : "",
    balance_usd:
      order?.balance_usd !== null && order?.balance_usd !== undefined
        ? String(order.balance_usd)
        : "",
  };
}

function buildStatusForm(order) {
  return {
    status: order?.status || "draft",
  };
}

function buildOrderRatioText(form) {
  return `Beef ${roundTo(toNumber(form.beef_ratio), 2)}%, Goat ${roundTo(
    toNumber(form.goat_ratio),
    2
  )}%, Lamb ${roundTo(toNumber(form.lamb_ratio), 2)}%`;
}

function buildItemsJsonFromForm(form) {
  const items = [];

  PRODUCT_KEYS.forEach((key) => {
    const qty = Math.max(toNumber(form[`${key}_quantity_kg`]), 0);
    if (qty <= 0) return;

    items.push({
      product_name: PRODUCT_META[key].productName,
      animal_type: PRODUCT_META[key].animalType,
      quantity_kg: Number(qty.toFixed(2)),
    });
  });

  return items;
}

function NoticeBanner({ notice, onClose }) {
  if (!notice?.message) return null;

  const styles =
    notice.type === "error"
      ? {
          color: RED,
          background: RED_SOFT,
          border: "1px solid rgba(220,38,38,0.18)",
        }
      : {
          color: GREEN,
          background: GREEN_SOFT,
          border: "1px solid rgba(22,163,74,0.18)",
        };

  return (
    <div className="noticeBanner" style={styles}>
      <div className="noticeText">{notice.message}</div>
      <button type="button" onClick={onClose} className="noticeClose">
        ×
      </button>
    </div>
  );
}

function Section({ title, subtitle, children }) {
  return (
    <section className="sectionCard">
      <div className="sectionHeader">
        <div className="sectionTitle">{title}</div>
        {subtitle ? <div className="sectionSubtitle">{subtitle}</div> : null}
      </div>
      <div className="sectionBody">{children}</div>
    </section>
  );
}

function SummaryCard({ label, value, hint, accent }) {
  return (
    <div className="summaryCard">
      <div className="summaryLabel">{label}</div>
      <div className="summaryValue" style={{ color: accent || TEXT }}>
        {value}
      </div>
      <div className="summaryHint">{hint}</div>
    </div>
  );
}

function InfoRows({ rows }) {
  return (
    <div className="infoRows">
      {rows.map((row, index) => (
        <div
          key={`${row.label}-${index}`}
          className={`infoRow ${index === rows.length - 1 ? "last" : ""}`}
        >
          <div className="infoLabel">{row.label}</div>
          <div className="infoValue">{row.value}</div>
        </div>
      ))}
    </div>
  );
}

function ModeButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`choiceButton ${active ? "choiceButtonActive choiceBlue" : ""}`}
    >
      {children}
    </button>
  );
}

function SubTypeButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`choiceButton ${active ? "choiceButtonActive choiceOrange" : ""}`}
    >
      {children}
    </button>
  );
}

function Input({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  min,
  max,
  step,
}) {
  return (
    <label className="fieldBlock">
      <div className="fieldLabel">{label}</div>
      <input
        type={type}
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="fieldInput"
      />
    </label>
  );
}

function TextArea({ label, value, onChange, placeholder, rows = 4 }) {
  return (
    <label className="fieldBlock">
      <div className="fieldLabel">{label}</div>
      <textarea
        value={value}
        rows={rows}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="fieldTextArea"
      />
    </label>
  );
}

function Select({ label, value, onChange, options }) {
  return (
    <label className="fieldBlock">
      <div className="fieldLabel">{label}</div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="fieldInput"
      >
        {options.map((option) => (
          <option key={`${label}-${option.value}`} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Checkbox({ label, checked, onChange }) {
  return (
    <label className="checkboxField">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="checkboxInput"
      />
      <span className="checkboxLabel">{label}</span>
    </label>
  );
}

function ReadOnlyField({ label, value }) {
  return (
    <div className="fieldBlock">
      <div className="fieldLabel">{label}</div>
      <div className="readOnlyField">{value}</div>
    </div>
  );
}

function TableHead({ children }) {
  return <th className="tableHead">{children}</th>;
}

function TableCell({ children }) {
  return <td className="tableCell">{children}</td>;
}

function EmptyText({ text }) {
  return <div className="emptyText">{text}</div>;
}

function LoadingBlock() {
  return (
    <div className="loadingBlock">
      <div className="loadingCard loadingShort" />
      <div className="loadingCard loadingMedium" />
      <div className="loadingCard loadingTall" />
    </div>
  );
}

function ProductMixMobileCard({
  productKey,
  quantityValue,
  ratioValue,
  piecesValue,
  onQuantityChange,
  onRatioChange,
}) {
  return (
    <div className="mobileMixCard">
      <div className="mobileMixTitle">{PRODUCT_META[productKey].label}</div>

      <div className="mobileMixGrid">
        <label className="fieldBlock">
          <div className="fieldLabel">Quantity (kg)</div>
          <input
            type="number"
            step="0.01"
            min="0"
            value={quantityValue}
            onChange={(e) => onQuantityChange(productKey, e.target.value)}
            className="fieldInput"
          />
        </label>

        <label className="fieldBlock">
          <div className="fieldLabel">Ratio (%)</div>
          <input
            type="number"
            step="0.01"
            min="0"
            max="100"
            value={ratioValue}
            onChange={(e) => onRatioChange(productKey, e.target.value)}
            className="fieldInput"
          />
        </label>

        <div className="fieldBlock mobileMixFull">
          <div className="fieldLabel">Pieces Required</div>
          <div className="readOnlyField">{formatNumber(piecesValue)}</div>
        </div>
      </div>
    </div>
  );
}

function ItemLineMobileCard({ item }) {
  return (
    <div className="itemCard">
      <div className="itemCardTitle">{item.product_name || "—"}</div>
      <div className="itemCardGrid">
        <div className="itemMeta">
          <div className="itemMetaLabel">Animal type</div>
          <div className="itemMetaValue">{titleizeSlug(item.animal_type)}</div>
        </div>
        <div className="itemMeta">
          <div className="itemMetaLabel">Quantity (kg)</div>
          <div className="itemMetaValue">{formatNumber(item.quantity_kg, 2)}</div>
        </div>
        <div className="itemMeta">
          <div className="itemMetaLabel">Pieces required</div>
          <div className="itemMetaValue">{formatNumber(item.pieces_required)}</div>
        </div>
        <div className="itemMeta">
          <div className="itemMetaLabel">Animals required</div>
          <div className="itemMetaValue">{formatNumber(item.animals_required)}</div>
        </div>
        <div className="itemMeta itemMetaFull">
          <div className="itemMetaLabel">Notes</div>
          <div className="itemMetaValue">{item.notes || "—"}</div>
        </div>
      </div>
    </div>
  );
}

function buttonPrimary(disabled) {
  return {
    background: BLUE,
    color: "#fff",
    border: "none",
    borderRadius: 12,
    padding: "10px 16px",
    fontSize: 13,
    fontWeight: 700,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.75 : 1,
    minHeight: 42,
    fontFamily: FONT_FAMILY,
  };
}

function buttonSecondary(disabled) {
  return {
    border: `1px solid ${BORDER}`,
    background: "#fff",
    color: TEXT,
    borderRadius: 12,
    padding: "10px 14px",
    fontSize: 13,
    fontWeight: 600,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.75 : 1,
    minHeight: 42,
    fontFamily: FONT_FAMILY,
  };
}

function OrderDetailPage() {
  const router = useRouter();

  const [authReady, setAuthReady] = useState(false);

  const numericId = useMemo(() => {
    const raw = Array.isArray(router.query.id) ? router.query.id[0] : router.query.id;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }, [router.query.id]);

  const [order, setOrder] = useState(null);
  const [form, setForm] = useState(buildEditableForm(null));
  const [statusForm, setStatusForm] = useState(buildStatusForm(null));

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [notice, setNotice] = useState({ type: "", message: "" });

  const [savingSetup, setSavingSetup] = useState(false);
  const [savingMix, setSavingMix] = useState(false);
  const [savingFinancial, setSavingFinancial] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);

  useEffect(() => {
    const token = typeof window !== "undefined" ? getToken?.() : null;
    if (!token) {
      router.replace("/auth/login");
      return;
    }
    setAuthReady(true);
  }, [router]);

  const applyLoadedOrder = useCallback((nextOrder) => {
    setOrder(nextOrder || null);
    setForm(buildEditableForm(nextOrder));
    setStatusForm(buildStatusForm(nextOrder));
  }, []);

  const fetchOrder = useCallback(
    async (isRefresh = false) => {
      if (!numericId) return;

      try {
        setError("");
        if (isRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        const data = await OrderService.getById(numericId);
        applyLoadedOrder(data);
      } catch (err) {
        setError(err?.message || "Failed to load order.");
        setOrder(null);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [numericId, applyLoadedOrder]
  );

  useEffect(() => {
    if (!router.isReady || !authReady) return;
    if (!numericId) {
      setLoading(false);
      setError("Invalid order id.");
      return;
    }
    fetchOrder();
  }, [router.isReady, authReady, numericId, fetchOrder]);

  const currentMode = useMemo(
    () => (form.order_profile === "frozen_container" ? MODE_FROZEN : MODE_GENERAL),
    [form.order_profile]
  );

  const totalQuantity = useMemo(
    () => Math.max(toNumber(form.total_quantity_kg), 0),
    [form.total_quantity_kg]
  );

  const quantities = useMemo(
    () => ({
      beef: Math.max(toNumber(form.beef_quantity_kg), 0),
      goat: Math.max(toNumber(form.goat_quantity_kg), 0),
      lamb: Math.max(toNumber(form.lamb_quantity_kg), 0),
    }),
    [form.beef_quantity_kg, form.goat_quantity_kg, form.lamb_quantity_kg]
  );

  const ratios = useMemo(
    () => ({
      beef: Math.max(toNumber(form.beef_ratio), 0),
      goat: Math.max(toNumber(form.goat_ratio), 0),
      lamb: Math.max(toNumber(form.lamb_ratio), 0),
    }),
    [form.beef_ratio, form.goat_ratio, form.lamb_ratio]
  );

  const ratioTotal = useMemo(() => sumValues(ratios), [ratios]);

  const pieces = useMemo(
    () => ({
      beef:
        quantities.beef > 0
          ? Math.ceil(quantities.beef / PRODUCT_META.beef.piecesDivisor)
          : 0,
      goat:
        quantities.goat > 0
          ? Math.ceil(quantities.goat / PRODUCT_META.goat.piecesDivisor)
          : 0,
      lamb:
        quantities.lamb > 0
          ? Math.ceil(quantities.lamb / PRODUCT_META.lamb.piecesDivisor)
          : 0,
    }),
    [quantities]
  );

  const totalPieces = useMemo(
    () => pieces.beef + pieces.goat + pieces.lamb,
    [pieces]
  );

  const derivedBalance = useMemo(() => {
    const shipment = Math.max(toNumber(form.shipment_value_usd), 0);
    const paid = Math.max(toNumber(form.amount_paid_usd), 0);
    return shipment - paid > 0 ? shipment - paid : 0;
  }, [form.shipment_value_usd, form.amount_paid_usd]);

  const ratioPreview = useMemo(
    () => buildOrderRatioText(form),
    [form.beef_ratio, form.goat_ratio, form.lamb_ratio]
  );

  const handleFieldChange = (key, value) => {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleModeSwitch = (mode) => {
    setForm((prev) => {
      if (mode === MODE_FROZEN) {
        return {
          ...prev,
          order_profile: "frozen_container",
          order_type: "frozen",
        };
      }

      const nextType = ["local", "chilled", "frozen"].includes(prev.order_type)
        ? prev.order_type
        : "local";

      return {
        ...prev,
        order_profile: "standard_order",
        order_type: nextType,
      };
    });
  };

  const handleGeneralTypeSwitch = (type) => {
    setForm((prev) => {
      const next = {
        ...prev,
        order_type: type,
      };

      if (compactText(prev.departure_date)) {
        next.slaughter_schedule = dateStrMinusDays(
          prev.departure_date,
          GENERAL_BACK_DAYS[type] || 4
        );
      }

      return next;
    });
  };

  const applyProductState = (nextTotal, nextQuantities, nextRatios, options = {}) => {
    setForm((prev) => {
      const prefer =
        options.prefer || (compactText(prev.price_per_kg_usd) ? "price" : "shipment");

      let nextPrice =
        options.price_per_kg_usd !== undefined
          ? options.price_per_kg_usd
          : prev.price_per_kg_usd;

      let nextShipment =
        options.shipment_value_usd !== undefined
          ? options.shipment_value_usd
          : prev.shipment_value_usd;

      const nextPaid =
        options.amount_paid_usd !== undefined
          ? options.amount_paid_usd
          : prev.amount_paid_usd;

      const numericTotal = Math.max(Number(nextTotal) || 0, 0);

      if (prefer === "price") {
        if (compactText(nextPrice) !== "" && numericTotal > 0) {
          nextShipment = numToInput(toNumber(nextPrice) * numericTotal, 2);
        } else if (compactText(nextShipment) !== "" && numericTotal > 0) {
          nextPrice = numToInput(toNumber(nextShipment) / numericTotal, 4);
        }
      } else {
        if (compactText(nextShipment) !== "" && numericTotal > 0) {
          nextPrice = numToInput(toNumber(nextShipment) / numericTotal, 4);
        } else if (compactText(nextPrice) !== "" && numericTotal > 0) {
          nextShipment = numToInput(toNumber(nextPrice) * numericTotal, 2);
        }
      }

      const nextBalance = numToInput(
        Math.max((toNumber(nextShipment) || 0) - (toNumber(nextPaid) || 0), 0),
        2
      );

      return {
        ...prev,
        ...options,
        total_quantity_kg: numericTotal > 0 ? numToInput(numericTotal, 2) : "",
        beef_quantity_kg: numToInput(nextQuantities.beef, 2),
        goat_quantity_kg: numToInput(nextQuantities.goat, 2),
        lamb_quantity_kg: numToInput(nextQuantities.lamb, 2),
        beef_ratio: numToInput(nextRatios.beef, 2),
        goat_ratio: numToInput(nextRatios.goat, 2),
        lamb_ratio: numToInput(nextRatios.lamb, 2),
        price_per_kg_usd: nextPrice,
        shipment_value_usd: nextShipment,
        amount_paid_usd: nextPaid,
        balance_usd: nextBalance,
      };
    });
  };

  const handleTotalQuantityChange = (value) => {
    const nextTotal = Math.max(toNumber(value), 0);
    let nextRatios = { ...ratios };

    if (sumValues(nextRatios) <= 0) {
      nextRatios = { beef: 0, goat: 50, lamb: 50 };
    }

    const nextQuantities = quantitiesFromRatios(nextTotal, nextRatios);
    applyProductState(nextTotal, nextQuantities, nextRatios);
  };

  const handleRatioChange = (key, value) => {
    const nextRatios = rebalanceRatios(ratios, key, value);
    const nextQuantities = quantitiesFromRatios(totalQuantity, nextRatios);
    applyProductState(totalQuantity, nextQuantities, nextRatios);
  };

  const handleQuantityChange = (key, value) => {
    const nextValue = Math.max(toNumber(value), 0);
    const currentTotal = totalQuantity;

    if (currentTotal <= 0) {
      const nextQuantities = {
        ...quantities,
        [key]: nextValue,
      };
      const nextTotal = sumValues(nextQuantities);
      const nextRatios =
        nextTotal > 0
          ? ratiosFromQuantities(nextTotal, nextQuantities)
          : { beef: 0, goat: 50, lamb: 50 };

      applyProductState(nextTotal, nextQuantities, nextRatios);
      return;
    }

    const nextQuantities = distributeRemainingQuantity(
      currentTotal,
      key,
      nextValue,
      quantities,
      ratios
    );
    const nextRatios = ratiosFromQuantities(currentTotal, nextQuantities);

    applyProductState(currentTotal, nextQuantities, nextRatios);
  };

  const handlePriceChange = (value) => {
    const nextPrice = compactText(value);
    const nextShipment =
      totalQuantity > 0 && nextPrice !== ""
        ? numToInput(toNumber(nextPrice) * totalQuantity, 2)
        : "";

    const nextBalance = numToInput(
      Math.max((toNumber(nextShipment) || 0) - (toNumber(form.amount_paid_usd) || 0), 0),
      2
    );

    setForm((prev) => ({
      ...prev,
      price_per_kg_usd: nextPrice,
      shipment_value_usd: nextShipment,
      balance_usd: nextBalance,
    }));
  };

  const handleShipmentChange = (value) => {
    const nextShipment = compactText(value);
    const nextPrice =
      totalQuantity > 0 && nextShipment !== ""
        ? numToInput(toNumber(nextShipment) / totalQuantity, 4)
        : "";

    const nextBalance = numToInput(
      Math.max((toNumber(nextShipment) || 0) - (toNumber(form.amount_paid_usd) || 0), 0),
      2
    );

    setForm((prev) => ({
      ...prev,
      shipment_value_usd: nextShipment,
      price_per_kg_usd: nextPrice,
      balance_usd: nextBalance,
    }));
  };

  const handlePaidChange = (value) => {
    const nextPaid = compactText(value);
    const nextBalance = numToInput(
      Math.max((toNumber(form.shipment_value_usd) || 0) - (toNumber(nextPaid) || 0), 0),
      2
    );

    setForm((prev) => ({
      ...prev,
      amount_paid_usd: nextPaid,
      balance_usd: nextBalance,
    }));
  };

  const handleDepartureDateChange = (value) => {
    setForm((prev) => {
      const next = {
        ...prev,
        departure_date: value,
      };

      if (prev.order_profile !== "frozen_container" && value) {
        next.slaughter_schedule = dateStrMinusDays(
          value,
          GENERAL_BACK_DAYS[prev.order_type] || 4
        );
      }

      return next;
    });
  };

  const submitSetupUpdate = async (e) => {
    e.preventDefault();
    if (!numericId) return;

    if (!compactText(form.enterprise_name)) {
      setNotice({ type: "error", message: "Enterprise name is required." });
      return;
    }

    const month = compactText(form.report_month);
    const year = compactText(form.report_year);
    if ((month && !year) || (!month && year)) {
      setNotice({
        type: "error",
        message: "Report month and report year must be provided together.",
      });
      return;
    }

    try {
      setSavingSetup(true);
      setNotice({ type: "", message: "" });

      const payload = {
        order_number: compactText(form.order_number) || null,
        enterprise_name: compactText(form.enterprise_name),
        order_type: form.order_type,
        order_profile: form.order_profile,
        order_subtype: compactText(form.order_subtype) || null,
        report_month: toNullableInteger(form.report_month),
        report_year: toNullableInteger(form.report_year),
        jurisdiction: compactText(form.jurisdiction) || null,
        notes: compactText(form.notes) || null,
        container_gate_in: compactText(form.container_gate_in) || null,
        departure_date: compactText(form.departure_date) || null,
      };

      const updated = await OrderService.update(numericId, payload);
      applyLoadedOrder(updated);
      setNotice({ type: "success", message: "Setup details updated successfully." });
    } catch (err) {
      setNotice({
        type: "error",
        message: err?.message || "Failed to update setup details.",
      });
    } finally {
      setSavingSetup(false);
    }
  };

  const submitMixAndDeliveryUpdate = async (e) => {
    e.preventDefault();
    if (!numericId) return;

    if (totalQuantity <= 0) {
      setNotice({ type: "error", message: "Total quantity must be greater than 0." });
      return;
    }

    if (Math.abs(ratioTotal - 100) > 0.01) {
      setNotice({
        type: "error",
        message: "Beef, Goat, and Lamb ratios must add up to 100%.",
      });
      return;
    }

    try {
      setSavingMix(true);
      setNotice({ type: "", message: "" });

      const payload = {
        items_json: buildItemsJsonFromForm(form),
        order_ratio: buildOrderRatioText(form),
        slaughter_schedule: compactText(form.slaughter_schedule) || null,
        expected_delivery: compactText(form.expected_delivery) || null,
        delivery_days_offset: toNullableInteger(form.delivery_days_offset),
        is_delivery_date_manual: Boolean(form.is_delivery_date_manual),
      };

      const updated = await OrderService.update(numericId, payload);
      applyLoadedOrder(updated);
      setNotice({
        type: "success",
        message: "Product mix and schedule updated successfully.",
      });
    } catch (err) {
      setNotice({
        type: "error",
        message: err?.message || "Failed to update product mix and schedule.",
      });
    } finally {
      setSavingMix(false);
    }
  };

  const submitFinancialUpdate = async (e) => {
    e.preventDefault();
    if (!numericId) return;

    try {
      setSavingFinancial(true);
      setNotice({ type: "", message: "" });

      const payload = {
        shipment_value_usd: toNullableNumber(form.shipment_value_usd),
        price_per_kg_usd: toNullableNumber(form.price_per_kg_usd),
        amount_paid_usd: toNullableNumber(form.amount_paid_usd),
        balance_usd: toNullableNumber(form.balance_usd || derivedBalance),
      };

      const updated = await OrderService.updateFinancial(numericId, payload);
      applyLoadedOrder(updated);
      setNotice({
        type: "success",
        message: "Financial values updated successfully.",
      });
    } catch (err) {
      setNotice({
        type: "error",
        message: err?.message || "Failed to update financial values.",
      });
    } finally {
      setSavingFinancial(false);
    }
  };

  const submitStatusUpdate = async (e) => {
    e.preventDefault();
    if (!numericId) return;

    try {
      setSavingStatus(true);
      setNotice({ type: "", message: "" });

      const updated = await OrderService.updateStatus(numericId, {
        status: statusForm.status,
      });

      applyLoadedOrder(updated);
      setNotice({ type: "success", message: "Order status updated successfully." });
    } catch (err) {
      setNotice({
        type: "error",
        message: err?.message || "Failed to update order status.",
      });
    } finally {
      setSavingStatus(false);
    }
  };

  if (!authReady || loading) {
    return (
      <div className="pageShell">
        <div className="pageContainer">
          <LoadingBlock />
        </div>
        <style jsx>{pageStyles}</style>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="pageShell">
        <div className="pageContainer">
          <div className="errorCard">
            <Link href="/orders" className="backLink">
              ← Back to orders
            </Link>

            <div className="errorTitle">Order not available</div>
            <div className="errorText">{error || "This order could not be loaded."}</div>
          </div>
        </div>
        <style jsx>{pageStyles}</style>
      </div>
    );
  }

  return (
    <div className="pageShell">
      <div className="pageContainer">
        <NoticeBanner
          notice={notice}
          onClose={() => setNotice({ type: "", message: "" })}
        />

        <div className="topHeader">
          <div className="topHeaderMain">
            <Link href="/orders" className="backLink">
              ← Back to orders
            </Link>

            <h1 className="pageTitle">{order.order_number || `Order #${order.id}`}</h1>

            <div className="badgeRow">
              <div className="enterpriseText">{order.enterprise_name || "—"}</div>

              <span className="statusPill" style={statusPillStyle(order.status)}>
                {titleizeSlug(order.status)}
              </span>

              <span className="plainPill">
                {currentMode === MODE_FROZEN ? "Frozen Container" : "General Order"}
              </span>

              <span className="mutedTiny">ID: {order.id}</span>
            </div>
          </div>

          <div className="headerActions">
            <button
              type="button"
              onClick={() => fetchOrder(true)}
              disabled={refreshing}
              style={buttonSecondary(refreshing)}
            >
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>

        <div className="summaryGrid">
          <SummaryCard
            label="Total quantity"
            value={`${formatNumber(totalQuantity, 2)} kg`}
            hint="Current editable total"
          />
          <SummaryCard
            label="Pieces required"
            value={formatNumber(totalPieces)}
            hint="Derived from product mix"
          />
          <SummaryCard
            label="Animals required"
            value={formatNumber(order.total_animals_required)}
            hint="Last server total"
          />
          <SummaryCard
            label="Shipment value"
            value={formatMoney(form.shipment_value_usd)}
            hint="Editable financial value"
          />
          <SummaryCard
            label="Balance"
            value={formatMoney(form.balance_usd || derivedBalance)}
            hint="Shipment minus paid"
            accent={toNumber(form.balance_usd || derivedBalance) > 0 ? ORANGE : TEXT}
          />
        </div>

        <Section
          title="Order overview"
          subtitle="Main identity, profile, reporting period, and timeline."
        >
          <div className="gridTwo">
            <InfoRows
              rows={[
                { label: "Order number", value: order.order_number || "—" },
                { label: "Enterprise", value: order.enterprise_name || "—" },
                { label: "Order type", value: titleizeSlug(order.order_type) },
                { label: "Order profile", value: titleizeSlug(order.order_profile) },
                {
                  label: "Order subtype",
                  value: order.order_subtype ? titleizeSlug(order.order_subtype) : "—",
                },
                { label: "Status", value: titleizeSlug(order.status) },
              ]}
            />

            <InfoRows
              rows={[
                {
                  label: "Report period",
                  value:
                    order.report_month && order.report_year
                      ? `${order.report_month}/${order.report_year}`
                      : "—",
                },
                { label: "Order ratio", value: order.order_ratio || "—" },
                { label: "Jurisdiction", value: order.jurisdiction || "—" },
                { label: "Created at", value: formatDateTime(order.created_at) },
                { label: "Updated at", value: formatDateTime(order.updated_at) },
                {
                  label: "Created / Updated by",
                  value: `${order.created_by_id || "—"} / ${order.updated_by_id || "—"}`,
                },
              ]}
            />
          </div>
        </Section>

        <Section
          title="Setup"
          subtitle="Switch between General Orders and Frozen Containers, and update the main fields."
        >
          <div className="choiceRow">
            <ModeButton
              active={currentMode === MODE_GENERAL}
              onClick={() => handleModeSwitch(MODE_GENERAL)}
            >
              General Orders
            </ModeButton>

            <ModeButton
              active={currentMode === MODE_FROZEN}
              onClick={() => handleModeSwitch(MODE_FROZEN)}
            >
              Frozen Containers
            </ModeButton>
          </div>

          {currentMode === MODE_GENERAL ? (
            <div className="choiceRow subChoiceRow">
              {GENERAL_TYPES.map((item) => (
                <SubTypeButton
                  key={item.value}
                  active={form.order_type === item.value}
                  onClick={() => handleGeneralTypeSwitch(item.value)}
                >
                  {item.label}
                </SubTypeButton>
              ))}
            </div>
          ) : null}

          <form onSubmit={submitSetupUpdate}>
            <div className="gridThree">
              <Input
                label="Order number"
                value={form.order_number}
                onChange={(v) => handleFieldChange("order_number", v)}
                placeholder="Auto or manual number"
              />
              <Input
                label="Enterprise name"
                value={form.enterprise_name}
                onChange={(v) => handleFieldChange("enterprise_name", v)}
                placeholder="Enterprise name"
              />
              <Input
                label="Order subtype"
                value={form.order_subtype}
                onChange={(v) => handleFieldChange("order_subtype", v)}
                placeholder="Subtype"
              />
              <Input
                label="Report month"
                type="number"
                min="1"
                max="12"
                value={form.report_month}
                onChange={(v) => handleFieldChange("report_month", v)}
                placeholder="1-12"
              />
              <Input
                label="Report year"
                type="number"
                min="2000"
                max="2100"
                value={form.report_year}
                onChange={(v) => handleFieldChange("report_year", v)}
                placeholder="2026"
              />
              <Input
                label="Jurisdiction"
                value={form.jurisdiction}
                onChange={(v) => handleFieldChange("jurisdiction", v)}
                placeholder="Jurisdiction"
              />
              <Input
                label="Container gate-in"
                type="date"
                value={form.container_gate_in}
                onChange={(v) => handleFieldChange("container_gate_in", v)}
              />
              <Input
                label="Departure date"
                type="date"
                value={form.departure_date}
                onChange={handleDepartureDateChange}
              />
              <div className="desktopSpacer" />
            </div>

            <div className="blockGap">
              <TextArea
                label="Notes"
                value={form.notes}
                onChange={(v) => handleFieldChange("notes", v)}
                placeholder="Internal notes"
                rows={5}
              />
            </div>

            <div className="actionRow">
              <button type="submit" disabled={savingSetup} style={buttonPrimary(savingSetup)}>
                {savingSetup ? "Saving..." : "Save setup"}
              </button>
            </div>
          </form>
        </Section>

        <Section
          title="Product mix and schedule"
          subtitle="Edit Beef, Goat, and Lamb by quantity or ratio. Changing one side updates the other automatically."
        >
          <form onSubmit={submitMixAndDeliveryUpdate}>
            <div className="gridThree">
              <Input
                label="Total Quantity (kg)"
                type="number"
                step="0.01"
                min="0"
                value={form.total_quantity_kg}
                onChange={handleTotalQuantityChange}
                placeholder="0.00"
              />
              <ReadOnlyField label="Order ratio" value={ratioPreview} />
              <ReadOnlyField label="Pieces required" value={formatNumber(totalPieces)} />
            </div>

            <div className="desktopMixTable">
              <div className="tableWrap">
                <table className="dataTable">
                  <thead>
                    <tr className="tableHeadRow">
                      <TableHead>Product</TableHead>
                      <TableHead>Quantity (kg)</TableHead>
                      <TableHead>Ratio (%)</TableHead>
                      <TableHead>Pieces Required</TableHead>
                    </tr>
                  </thead>
                  <tbody>
                    {PRODUCT_KEYS.map((key) => (
                      <tr key={key} className="tableBodyRow">
                        <TableCell>
                          <strong>{PRODUCT_META[key].label}</strong>
                        </TableCell>
                        <TableCell>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={form[`${key}_quantity_kg`]}
                            onChange={(e) => handleQuantityChange(key, e.target.value)}
                            className="tableInput"
                          />
                        </TableCell>
                        <TableCell>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            max="100"
                            value={form[`${key}_ratio`]}
                            onChange={(e) => handleRatioChange(key, e.target.value)}
                            className="tableInput"
                          />
                        </TableCell>
                        <TableCell>{formatNumber(pieces[key])}</TableCell>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mobileMixCards">
              {PRODUCT_KEYS.map((key) => (
                <ProductMixMobileCard
                  key={key}
                  productKey={key}
                  quantityValue={form[`${key}_quantity_kg`]}
                  ratioValue={form[`${key}_ratio`]}
                  piecesValue={pieces[key]}
                  onQuantityChange={handleQuantityChange}
                  onRatioChange={handleRatioChange}
                />
              ))}
            </div>

            <div className="gridFour blockGap">
              <Input
                label="Slaughter schedule"
                type="date"
                value={form.slaughter_schedule}
                onChange={(v) => handleFieldChange("slaughter_schedule", v)}
              />
              <Input
                label="Expected delivery"
                type="date"
                value={form.expected_delivery}
                onChange={(v) => handleFieldChange("expected_delivery", v)}
              />
              <Input
                label="Delivery days offset"
                type="number"
                min="0"
                value={form.delivery_days_offset}
                onChange={(v) => handleFieldChange("delivery_days_offset", v)}
                placeholder="Offset"
              />
              <Checkbox
                label="Manual delivery date"
                checked={form.is_delivery_date_manual}
                onChange={(v) => handleFieldChange("is_delivery_date_manual", v)}
              />
            </div>

            <div className="actionRow">
              <button type="submit" disabled={savingMix} style={buttonPrimary(savingMix)}>
                {savingMix ? "Saving..." : "Save mix and schedule"}
              </button>
            </div>
          </form>
        </Section>

        <Section
          title="Current item lines"
          subtitle="Current stored item lines from the order."
        >
          {!Array.isArray(order?.items_json) || order.items_json.length === 0 ? (
            <EmptyText text="No item lines available for this order." />
          ) : (
            <>
              <div className="desktopItemsTable">
                <div className="tableWrap">
                  <table className="dataTable">
                    <thead>
                      <tr className="tableHeadRow">
                        <TableHead>Product</TableHead>
                        <TableHead>Animal type</TableHead>
                        <TableHead>Quantity (kg)</TableHead>
                        <TableHead>Pieces required</TableHead>
                        <TableHead>Animals required</TableHead>
                        <TableHead>Notes</TableHead>
                      </tr>
                    </thead>
                    <tbody>
                      {order.items_json.map((item, index) => (
                        <tr
                          key={`${item.product_name || "item"}-${index}`}
                          className="tableBodyRow"
                        >
                          <TableCell>{item.product_name || "—"}</TableCell>
                          <TableCell>{titleizeSlug(item.animal_type)}</TableCell>
                          <TableCell>{formatNumber(item.quantity_kg, 2)}</TableCell>
                          <TableCell>{formatNumber(item.pieces_required)}</TableCell>
                          <TableCell>{formatNumber(item.animals_required)}</TableCell>
                          <TableCell>{item.notes || "—"}</TableCell>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="mobileItemCards">
                {order.items_json.map((item, index) => (
                  <ItemLineMobileCard
                    key={`${item.product_name || "item"}-${index}`}
                    item={item}
                  />
                ))}
              </div>
            </>
          )}
        </Section>

        <Section
          title="Financials"
          subtitle="Shipment, price per kg, amount paid, and balance are linked automatically."
        >
          <form onSubmit={submitFinancialUpdate}>
            <div className="gridFour">
              <Input
                label="Shipment value (USD)"
                type="number"
                step="0.01"
                value={form.shipment_value_usd}
                onChange={handleShipmentChange}
                placeholder="0.00"
              />
              <Input
                label="Price per kg (USD)"
                type="number"
                step="0.0001"
                value={form.price_per_kg_usd}
                onChange={handlePriceChange}
                placeholder="0.0000"
              />
              <Input
                label="Amount paid (USD)"
                type="number"
                step="0.01"
                value={form.amount_paid_usd}
                onChange={handlePaidChange}
                placeholder="0.00"
              />
              <ReadOnlyField
                label="Balance (USD)"
                value={formatMoney(form.balance_usd || derivedBalance)}
              />
            </div>

            <div className="actionRow">
              <button
                type="submit"
                disabled={savingFinancial}
                style={buttonPrimary(savingFinancial)}
              >
                {savingFinancial ? "Saving..." : "Save financials"}
              </button>
            </div>
          </form>
        </Section>

        <Section
          title="Status management"
          subtitle="Change the lifecycle status for this order."
        >
          <div className="gridTwo">
            <InfoRows rows={[{ label: "Current status", value: titleizeSlug(order.status) }]} />

            <form onSubmit={submitStatusUpdate}>
              <Select
                label="New status"
                value={statusForm.status}
                onChange={(v) => setStatusForm({ status: v })}
                options={ORDER_STATUS_OPTIONS}
              />

              <div className="actionRow">
                <button type="submit" disabled={savingStatus} style={buttonPrimary(savingStatus)}>
                  {savingStatus ? "Saving..." : "Save status"}
                </button>
              </div>
            </form>
          </div>
        </Section>
      </div>

      <style jsx>{pageStyles}</style>
    </div>
  );
}

const pageStyles = `
  .pageShell {
    min-height: 100vh;
    background: ${BG};
    color: ${TEXT};
    font-family: ${FONT_FAMILY};
  }

  .pageContainer {
    width: 100%;
    max-width: 1440px;
    margin: 0 auto;
    padding: 18px 22px 32px;
    box-sizing: border-box;
    overflow-x: hidden;
  }

  .topHeader {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;
    flex-wrap: wrap;
    margin-bottom: 16px;
  }

  .topHeaderMain {
    min-width: 0;
    flex: 1 1 360px;
  }

  .headerActions {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
  }

  .backLink {
    display: inline-flex;
    color: ${BLUE};
    text-decoration: none;
    font-size: 13px;
    font-weight: 700;
  }

  .pageTitle {
    margin: 10px 0 0;
    font-size: 25px;
    line-height: 1.2;
    font-weight: 700;
    letter-spacing: -0.02em;
    word-break: break-word;
  }

  .badgeRow {
    margin-top: 6px;
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }

  .enterpriseText {
    font-size: 13px;
    color: ${MUTED};
    word-break: break-word;
  }

  .statusPill,
  .plainPill {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 6px 10px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 700;
    white-space: nowrap;
  }

  .plainPill {
    border: 1px solid ${BORDER};
    background: #fff;
    color: ${TEXT};
  }

  .mutedTiny {
    font-size: 12px;
    color: ${MUTED};
  }

  .noticeBanner {
    border-radius: 14px;
    padding: 12px 14px;
    margin-bottom: 14px;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
  }

  .noticeText {
    font-size: 13px;
    line-height: 1.5;
  }

  .noticeClose {
    border: none;
    background: transparent;
    color: inherit;
    cursor: pointer;
    font-size: 14px;
    font-weight: 700;
    padding: 0;
  }

  .summaryGrid {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 12px;
    margin-bottom: 16px;
  }

  .summaryCard {
    border: 1px solid ${BORDER};
    border-radius: 16px;
    background: ${SURFACE};
    padding: 14px 16px;
    box-shadow: ${SHADOW};
    min-width: 0;
  }

  .summaryLabel {
    font-size: 12px;
    color: ${MUTED};
    margin-bottom: 7px;
  }

  .summaryValue {
    font-size: 22px;
    font-weight: 700;
    line-height: 1.15;
    letter-spacing: -0.02em;
    word-break: break-word;
  }

  .summaryHint {
    margin-top: 4px;
    font-size: 12px;
    color: ${MUTED};
    line-height: 1.45;
  }

  .sectionCard {
    border: 1px solid ${BORDER};
    border-radius: 16px;
    background: #fff;
    overflow: hidden;
    margin-bottom: 16px;
    box-shadow: ${SHADOW};
  }

  .sectionHeader {
    padding: 14px 16px;
    border-bottom: 1px solid ${BORDER};
  }

  .sectionTitle {
    font-size: 15px;
    font-weight: 700;
    line-height: 1.3;
  }

  .sectionSubtitle {
    margin-top: 4px;
    font-size: 12px;
    color: ${MUTED};
    line-height: 1.5;
  }

  .sectionBody {
    padding: 16px;
  }

  .gridTwo {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14px;
  }

  .gridThree {
    display: grid;
    grid-template-columns: repeat(3, minmax(220px, 1fr));
    gap: 12px;
  }

  .gridFour {
    display: grid;
    grid-template-columns: repeat(4, minmax(180px, 1fr));
    gap: 12px;
  }

  .desktopSpacer {
    display: block;
  }

  .choiceRow {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    margin-bottom: 14px;
  }

  .subChoiceRow {
    gap: 8px;
  }

  .choiceButton {
    border: 1px solid ${BORDER};
    background: #fff;
    color: ${TEXT};
    border-radius: 12px;
    padding: 10px 16px;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    min-height: 42px;
    font-family: ${FONT_FAMILY};
  }

  .choiceButtonActive.choiceBlue {
    border-color: ${BLUE};
    background: ${BLUE_SOFT};
    color: ${BLUE};
  }

  .choiceButtonActive.choiceOrange {
    border-color: ${ORANGE};
    background: ${ORANGE_SOFT};
    color: ${ORANGE};
  }

  .fieldBlock {
    display: block;
    min-width: 0;
  }

  .fieldLabel {
    font-size: 12px;
    font-weight: 700;
    color: #334155;
    margin-bottom: 6px;
  }

  .fieldInput,
  .fieldTextArea,
  .tableInput {
    width: 100%;
    box-sizing: border-box;
    font-family: ${FONT_FAMILY};
    outline: none;
    color: ${TEXT};
    background: #fff;
  }

  .fieldInput {
    height: 42px;
    padding: 0 12px;
    border-radius: 12px;
    border: 1px solid ${BORDER};
    font-size: 13px;
  }

  .fieldTextArea {
    padding: 10px 12px;
    border-radius: 12px;
    border: 1px solid ${BORDER};
    font-size: 13px;
    resize: vertical;
    line-height: 1.6;
  }

  .readOnlyField {
    min-height: 42px;
    display: flex;
    align-items: center;
    padding: 0 12px;
    border-radius: 12px;
    border: 1px solid ${BORDER};
    background: ${SOFT};
    color: ${TEXT};
    font-size: 13px;
    box-sizing: border-box;
    line-height: 1.45;
  }

  .checkboxField {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 42px;
    padding-top: 24px;
    box-sizing: border-box;
  }

  .checkboxInput {
    width: 16px;
    height: 16px;
    cursor: pointer;
    flex: 0 0 auto;
  }

  .checkboxLabel {
    font-size: 13px;
    color: ${TEXT};
    font-weight: 600;
    line-height: 1.45;
  }

  .blockGap {
    margin-top: 14px;
  }

  .actionRow {
    margin-top: 14px;
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
  }

  .tableWrap {
    overflow-x: auto;
    width: 100%;
  }

  .dataTable {
    width: 100%;
    border-collapse: collapse;
  }

  .tableHeadRow {
    background: ${SOFT};
    border-bottom: 1px solid ${BORDER};
  }

  .tableBodyRow {
    border-bottom: 1px solid ${BORDER};
  }

  .tableHead {
    text-align: left;
    padding: 12px 14px;
    font-size: 12px;
    font-weight: 700;
    color: #334155;
    white-space: nowrap;
  }

  .tableCell {
    padding: 14px;
    font-size: 13px;
    color: ${TEXT};
    vertical-align: top;
    line-height: 1.55;
  }

  .tableInput {
    height: 38px;
    padding: 0 10px;
    border-radius: 10px;
    border: 1px solid ${BORDER};
    font-size: 13px;
  }

  .desktopMixTable,
  .desktopItemsTable {
    display: block;
    margin-top: 14px;
  }

  .mobileMixCards,
  .mobileItemCards {
    display: none;
  }

  .mobileMixCard,
  .itemCard {
    border: 1px solid ${BORDER};
    border-radius: 16px;
    background: #fff;
    padding: 14px;
  }

  .mobileMixCard + .mobileMixCard,
  .itemCard + .itemCard {
    margin-top: 12px;
  }

  .mobileMixTitle,
  .itemCardTitle {
    font-size: 15px;
    font-weight: 700;
    line-height: 1.35;
    margin-bottom: 12px;
    color: ${TEXT};
  }

  .mobileMixGrid,
  .itemCardGrid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }

  .mobileMixFull,
  .itemMetaFull {
    grid-column: 1 / -1;
  }

  .itemMeta {
    min-width: 0;
  }

  .itemMetaLabel {
    font-size: 11px;
    font-weight: 700;
    color: ${MUTED};
    margin-bottom: 4px;
    text-transform: uppercase;
    letter-spacing: 0.02em;
  }

  .itemMetaValue {
    font-size: 13px;
    color: ${TEXT};
    line-height: 1.5;
    word-break: break-word;
  }

  .infoRows {
    border: 1px solid ${BORDER};
    border-radius: 12px;
    overflow: hidden;
  }

  .infoRow {
    display: grid;
    grid-template-columns: 190px 1fr;
    gap: 14px;
    padding: 12px 14px;
    border-bottom: 1px solid ${BORDER};
    background: #fff;
  }

  .infoRow.last {
    border-bottom: none;
  }

  .infoLabel {
    font-size: 12px;
    font-weight: 700;
    color: #334155;
  }

  .infoValue {
    font-size: 13px;
    color: ${TEXT};
    line-height: 1.55;
    word-break: break-word;
  }

  .emptyText {
    color: ${MUTED};
    font-size: 13px;
    line-height: 1.6;
  }

  .loadingBlock {
    display: grid;
    gap: 12px;
  }

  .loadingCard {
    border-radius: 16px;
    border: 1px solid ${BORDER};
    background: #fff;
  }

  .loadingShort {
    height: 88px;
  }

  .loadingMedium {
    height: 160px;
  }

  .loadingTall {
    height: 220px;
  }

  .errorCard {
    max-width: 100%;
    border: 1px solid ${BORDER};
    border-radius: 16px;
    background: #fff;
    padding: 20px;
    box-shadow: ${SHADOW};
  }

  .errorTitle {
    margin-top: 16px;
    font-size: 22px;
    font-weight: 700;
  }

  .errorText {
    margin-top: 8px;
    font-size: 14px;
    color: ${RED};
    line-height: 1.6;
  }

  @media (max-width: 1280px) {
    .summaryGrid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    .gridFour {
      grid-template-columns: repeat(2, minmax(180px, 1fr));
    }
  }

  @media (max-width: 1024px) {
    .gridTwo,
    .gridThree,
    .gridFour {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .summaryGrid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .infoRow {
      grid-template-columns: 150px 1fr;
    }
  }

  @media (max-width: 760px) {
    .pageContainer {
      padding: 14px 12px 24px;
    }

    .pageTitle {
      font-size: 22px;
    }

    .summaryGrid,
    .gridTwo,
    .gridThree,
    .gridFour {
      grid-template-columns: 1fr;
    }

    .desktopSpacer {
      display: none;
    }

    .desktop    .desktopMixTable,
    .desktopItemsTable {
      display: none;
    }

    .mobileMixCards,
    .mobileItemCards {
      display: block;
      margin-top: 14px;
    }

    .infoRow {
      grid-template-columns: 1fr;
      gap: 6px;
    }

    .headerActions {
      width: 100%;
    }

    .headerActions button {
      width: 100%;
    }

    .choiceRow {
      gap: 8px;
    }

    .choiceButton {
      flex: 1 1 100%;
      width: 100%;
    }

    .actionRow button {
      width: 100%;
    }

    .checkboxField {
      padding-top: 0;
      min-height: 42px;
    }

    .mobileMixGrid,
    .itemCardGrid {
      grid-template-columns: 1fr;
      gap: 10px;
    }

    .mobileMixFull,
    .itemMetaFull {
      grid-column: auto;
    }
  }
`;

export default OrderDetailPage;