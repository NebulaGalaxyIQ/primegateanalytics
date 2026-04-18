import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import OrderService from "../../services/orders";
import { getToken } from "../../services/auth";

/* ============================================================================
   Order Detail Page
   ----------------------------------------------------------------------------
   Updated to match the new create flow:
   - General Orders vs Frozen Containers
   - Local / Chilled / Frozen subtype buttons for general orders
   - Beef / Goat / Lamb product mix editor
   - Auto-balancing ratios and quantities
   - Price / shipment / paid / balance auto logic
============================================================================ */

const FONT_FAMILY = "Arial, sans-serif";
const BG = "#ffffff";
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

function addDays(baseDate, days) {
  const d = new Date(baseDate);
  d.setDate(d.getDate() + days);
  return d;
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

function todayStr() {
  return toInputDate(new Date());
}

function clampDateToTodayOrFuture(dateStr) {
  const trimmed = String(dateStr || "").trim();
  if (!trimmed) return "";
  const today = todayStr();
  return trimmed < today ? today : trimmed;
}

function dateStrMinusDays(dateStr, days) {
  const safe = clampDateToTodayOrFuture(dateStr);
  if (!safe) return "";
  const d = new Date(`${safe}T00:00:00`);
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

function distributeRemainingQuantity(totalQty, changedKey, changedQty, currentQuantities, currentRatios) {
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
    order_profile: order?.order_profile || (mode === MODE_FROZEN ? "frozen_container" : "standard_order"),
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
      order?.delivery_days_offset !== null && order?.delivery_days_offset !== undefined
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
      order?.shipment_value_usd !== null && order?.shipment_value_usd !== undefined
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
    <div
      style={{
        ...styles,
        borderRadius: 12,
        padding: "12px 14px",
        marginBottom: 14,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: 12,
      }}
    >
      <div style={{ fontSize: 13, lineHeight: 1.5 }}>{notice.message}</div>
      <button
        type="button"
        onClick={onClose}
        style={{
          border: "none",
          background: "transparent",
          color: "inherit",
          cursor: "pointer",
          fontSize: 14,
          fontWeight: 700,
          padding: 0,
        }}
      >
        ×
      </button>
    </div>
  );
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
        next.slaughter_schedule = clampDateToTodayOrFuture(
          dateStrMinusDays(prev.departure_date, GENERAL_BACK_DAYS[type] || 4)
        );
      }

      return next;
    });
  };

  const applyProductState = (nextTotal, nextQuantities, nextRatios, options = {}) => {
    setForm((prev) => {
      const prefer =
        options.prefer ||
        (compactText(prev.price_per_kg_usd) ? "price" : "shipment");

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
    const safe = clampDateToTodayOrFuture(value);

    setForm((prev) => {
      const next = {
        ...prev,
        departure_date: safe,
      };

      if (prev.order_profile !== "frozen_container" && safe) {
        next.slaughter_schedule = clampDateToTodayOrFuture(
          dateStrMinusDays(safe, GENERAL_BACK_DAYS[prev.order_type] || 4)
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

  if (!authReady) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: BG,
          color: TEXT,
          fontFamily: FONT_FAMILY,
          padding: "18px 22px 32px",
          boxSizing: "border-box",
        }}
      >
        <LoadingBlock />
      </div>
    );
  }

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: BG,
          color: TEXT,
          fontFamily: FONT_FAMILY,
          padding: "18px 22px 32px",
          boxSizing: "border-box",
        }}
      >
        <LoadingBlock />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: BG,
          color: TEXT,
          fontFamily: FONT_FAMILY,
          padding: "18px 22px 32px",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            maxWidth: "100%",
            border: `1px solid ${BORDER}`,
            borderRadius: 16,
            background: "#fff",
            padding: 20,
          }}
        >
          <Link
            href="/orders"
            style={{
              color: BLUE,
              textDecoration: "none",
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            ← Back to orders
          </Link>

          <div
            style={{
              marginTop: 16,
              fontSize: 22,
              fontWeight: 700,
            }}
          >
            Order not available
          </div>

          <div
            style={{
              marginTop: 8,
              fontSize: 14,
              color: RED,
              lineHeight: 1.6,
            }}
          >
            {error || "This order could not be loaded."}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: BG,
        color: TEXT,
        fontFamily: FONT_FAMILY,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "100%",
          margin: 0,
          padding: "18px 22px 32px",
          boxSizing: "border-box",
        }}
      >
        <NoticeBanner
          notice={notice}
          onClose={() => setNotice({ type: "", message: "" })}
        />

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 16,
            flexWrap: "wrap",
            marginBottom: 16,
          }}
        >
          <div>
            <Link
              href="/orders"
              style={{
                color: BLUE,
                textDecoration: "none",
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              ← Back to orders
            </Link>

            <h1
              style={{
                margin: "10px 0 0",
                fontSize: 25,
                lineHeight: 1.2,
                fontWeight: 700,
                letterSpacing: "-0.02em",
              }}
            >
              {order.order_number || `Order #${order.id}`}
            </h1>

            <div
              style={{
                marginTop: 6,
                display: "flex",
                alignItems: "center",
                gap: 10,
                flexWrap: "wrap",
              }}
            >
              <div style={{ fontSize: 13, color: MUTED }}>
                {order.enterprise_name || "—"}
              </div>

              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "6px 10px",
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: 700,
                  ...statusPillStyle(order.status),
                }}
              >
                {titleizeSlug(order.status)}
              </span>

              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "6px 10px",
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: 700,
                  border: `1px solid ${BORDER}`,
                  background: "#fff",
                  color: TEXT,
                }}
              >
                {currentMode === MODE_FROZEN ? "Frozen Container" : "General Order"}
              </span>

              <div style={{ fontSize: 12, color: MUTED }}>
                ID: {order.id}
              </div>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
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

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(5, minmax(180px, 1fr))",
            gap: 12,
            marginBottom: 16,
          }}
        >
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
          <div style={twoColumnGrid}>
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
          <div
            style={{
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
              marginBottom: 14,
            }}
          >
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
            <div
              style={{
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
                marginBottom: 14,
              }}
            >
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
            <div style={threeColumnGrid}>
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
              <div />
            </div>

            <div style={{ marginTop: 12 }}>
              <TextArea
                label="Notes"
                value={form.notes}
                onChange={(v) => handleFieldChange("notes", v)}
                placeholder="Internal notes"
                rows={5}
              />
            </div>

            <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button type="submit" disabled={savingSetup} style={buttonPrimary(savingSetup)}>
                {savingSetup ? "Saving..." : "Save setup"}
              </button>
            </div>
          </form>
        </Section>

        <Section
          title="Product mix and schedule"
          subtitle="Edit Beef / Goat / Lamb by quantity or ratio. Changing one side updates the other automatically."
        >
          <form onSubmit={submitMixAndDeliveryUpdate}>
            <div style={threeColumnGrid}>
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

            <div style={{ marginTop: 14, overflowX: "auto", width: "100%" }}>
              <table
                style={{
                  width: "100%",
                  minWidth: 900,
                  borderCollapse: "collapse",
                }}
              >
                <thead>
                  <tr
                    style={{
                      background: SOFT,
                      borderBottom: `1px solid ${BORDER}`,
                    }}
                  >
                    <TableHead>Product</TableHead>
                    <TableHead>Quantity (kg)</TableHead>
                    <TableHead>Ratio (%)</TableHead>
                    <TableHead>Pieces Required</TableHead>
                  </tr>
                </thead>
                <tbody>
                  {PRODUCT_KEYS.map((key) => (
                    <tr key={key} style={{ borderBottom: `1px solid ${BORDER}` }}>
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
                          style={tableInputStyle}
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
                          style={tableInputStyle}
                        />
                      </TableCell>
                      <TableCell>{formatNumber(pieces[key])}</TableCell>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div
              style={{
                marginTop: 14,
                display: "grid",
                gridTemplateColumns: "repeat(4, minmax(180px, 1fr))",
                gap: 12,
              }}
            >
              <Input
                label="Slaughter schedule"
                type="date"
                value={form.slaughter_schedule}
                onChange={(v) => handleFieldChange("slaughter_schedule", clampDateToTodayOrFuture(v))}
              />
              <Input
                label="Expected delivery"
                type="date"
                value={form.expected_delivery}
                onChange={(v) => handleFieldChange("expected_delivery", clampDateToTodayOrFuture(v))}
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

            <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
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
            <div style={{ overflowX: "auto", width: "100%" }}>
              <table
                style={{
                  width: "100%",
                  minWidth: 860,
                  borderCollapse: "collapse",
                }}
              >
                <thead>
                  <tr style={{ background: SOFT, borderBottom: `1px solid ${BORDER}` }}>
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
                      style={{ borderBottom: `1px solid ${BORDER}` }}
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
          )}
        </Section>

        <Section
          title="Financials"
          subtitle="Shipment, price per kg, amount paid, and balance are linked automatically."
        >
          <form onSubmit={submitFinancialUpdate}>
            <div style={fourColumnGrid}>
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

            <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
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
          <div style={twoColumnGrid}>
            <InfoRows rows={[{ label: "Current status", value: titleizeSlug(order.status) }]} />

            <form onSubmit={submitStatusUpdate}>
              <Select
                label="New status"
                value={statusForm.status}
                onChange={(v) => setStatusForm({ status: v })}
                options={ORDER_STATUS_OPTIONS}
              />

              <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button type="submit" disabled={savingStatus} style={buttonPrimary(savingStatus)}>
                  {savingStatus ? "Saving..." : "Save status"}
                </button>
              </div>
            </form>
          </div>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, subtitle, children }) {
  return (
    <div
      style={{
        border: `1px solid ${BORDER}`,
        borderRadius: 16,
        background: "#fff",
        overflow: "hidden",
        marginBottom: 16,
      }}
    >
      <div
        style={{
          padding: "14px 16px",
          borderBottom: `1px solid ${BORDER}`,
        }}
      >
        <div
          style={{
            fontSize: 15,
            fontWeight: 700,
            lineHeight: 1.3,
          }}
        >
          {title}
        </div>
        {subtitle ? (
          <div
            style={{
              marginTop: 4,
              fontSize: 12,
              color: MUTED,
              lineHeight: 1.5,
            }}
          >
            {subtitle}
          </div>
        ) : null}
      </div>

      <div style={{ padding: 16 }}>{children}</div>
    </div>
  );
}

function SummaryCard({ label, value, hint, accent }) {
  return (
    <div
      style={{
        border: `1px solid ${BORDER}`,
        borderRadius: 14,
        background: "#fff",
        padding: "14px 16px",
      }}
    >
      <div style={{ fontSize: 12, color: MUTED, marginBottom: 7 }}>{label}</div>
      <div
        style={{
          fontSize: 22,
          fontWeight: 700,
          lineHeight: 1.15,
          letterSpacing: "-0.02em",
          color: accent || TEXT,
        }}
      >
        {value}
      </div>
      <div style={{ marginTop: 4, fontSize: 12, color: MUTED }}>{hint}</div>
    </div>
  );
}

function InfoRows({ rows }) {
  return (
    <div
      style={{
        border: `1px solid ${BORDER}`,
        borderRadius: 12,
        overflow: "hidden",
      }}
    >
      {rows.map((row, index) => (
        <div
          key={`${row.label}-${index}`}
          style={{
            display: "grid",
            gridTemplateColumns: "190px 1fr",
            gap: 14,
            padding: "12px 14px",
            borderBottom: index === rows.length - 1 ? "none" : `1px solid ${BORDER}`,
            background: "#fff",
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: "#334155",
            }}
          >
            {row.label}
          </div>
          <div
            style={{
              fontSize: 13,
              color: TEXT,
              lineHeight: 1.55,
              wordBreak: "break-word",
            }}
          >
            {row.value}
          </div>
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
      style={{
        border: active ? `1px solid ${BLUE}` : `1px solid ${BORDER}`,
        background: active ? BLUE_SOFT : "#fff",
        color: active ? BLUE : TEXT,
        borderRadius: 10,
        padding: "10px 16px",
        fontSize: 13,
        fontWeight: 700,
        cursor: "pointer",
      }}
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
      style={{
        border: active ? `1px solid ${ORANGE}` : `1px solid ${BORDER}`,
        background: active ? ORANGE_SOFT : "#fff",
        color: active ? ORANGE : TEXT,
        borderRadius: 10,
        padding: "9px 14px",
        fontSize: 13,
        fontWeight: 700,
        cursor: "pointer",
      }}
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
    <label style={{ display: "block", minWidth: 0 }}>
      <div
        style={{
          fontSize: 12,
          fontWeight: 700,
          color: "#334155",
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <input
        type={type}
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={inputStyle}
      />
    </label>
  );
}

function TextArea({ label, value, onChange, placeholder, rows = 4 }) {
  return (
    <label style={{ display: "block", minWidth: 0 }}>
      <div
        style={{
          fontSize: 12,
          fontWeight: 700,
          color: "#334155",
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <textarea
        value={value}
        rows={rows}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={textAreaStyle}
      />
    </label>
  );
}

function Select({ label, value, onChange, options }) {
  return (
    <label style={{ display: "block", minWidth: 0 }}>
      <div
        style={{
          fontSize: 12,
          fontWeight: 700,
          color: "#334155",
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={selectStyle}
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
    <label
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        minHeight: 42,
        paddingTop: 24,
        boxSizing: "border-box",
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ width: 16, height: 16, cursor: "pointer" }}
      />
      <span
        style={{
          fontSize: 13,
          color: TEXT,
          fontWeight: 600,
        }}
      >
        {label}
      </span>
    </label>
  );
}

function ReadOnlyField({ label, value }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div
        style={{
          fontSize: 12,
          fontWeight: 700,
          color: "#334155",
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div
        style={{
          minHeight: 42,
          display: "flex",
          alignItems: "center",
          padding: "0 12px",
          borderRadius: 10,
          border: `1px solid ${BORDER}`,
          background: SOFT,
          color: TEXT,
          fontSize: 13,
          boxSizing: "border-box",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function TableHead({ children }) {
  return (
    <th
      style={{
        textAlign: "left",
        padding: "12px 14px",
        fontSize: 12,
        fontWeight: 700,
        color: "#334155",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </th>
  );
}

function TableCell({ children }) {
  return (
    <td
      style={{
        padding: "14px",
        fontSize: 13,
        color: TEXT,
        verticalAlign: "top",
        lineHeight: 1.55,
      }}
    >
      {children}
    </td>
  );
}

function EmptyText({ text }) {
  return (
    <div
      style={{
        color: MUTED,
        fontSize: 13,
        lineHeight: 1.6,
      }}
    >
      {text}
    </div>
  );
}

function LoadingBlock() {
  return (
    <div
      style={{
        display: "grid",
        gap: 12,
      }}
    >
      <div
        style={{
          height: 88,
          borderRadius: 16,
          border: `1px solid ${BORDER}`,
          background: "#fff",
        }}
      />
      <div
        style={{
          height: 160,
          borderRadius: 16,
          border: `1px solid ${BORDER}`,
          background: "#fff",
        }}
      />
      <div
        style={{
          height: 220,
          borderRadius: 16,
          border: `1px solid ${BORDER}`,
          background: "#fff",
        }}
      />
    </div>
  );
}

function buttonPrimary(disabled) {
  return {
    background: BLUE,
    color: "#fff",
    border: "none",
    borderRadius: 10,
    padding: "10px 16px",
    fontSize: 13,
    fontWeight: 700,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.75 : 1,
  };
}

function buttonSecondary(disabled) {
  return {
    border: `1px solid ${BORDER}`,
    background: "#fff",
    color: TEXT,
    borderRadius: 10,
    padding: "10px 14px",
    fontSize: 13,
    fontWeight: 600,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.75 : 1,
  };
}

const inputStyle = {
  width: "100%",
  height: 42,
  padding: "0 12px",
  borderRadius: 10,
  border: `1px solid ${BORDER}`,
  background: "#fff",
  color: TEXT,
  fontSize: 13,
  fontFamily: FONT_FAMILY,
  outline: "none",
  boxSizing: "border-box",
};

const selectStyle = {
  width: "100%",
  height: 42,
  padding: "0 12px",
  borderRadius: 10,
  border: `1px solid ${BORDER}`,
  background: "#fff",
  color: TEXT,
  fontSize: 13,
  fontFamily: FONT_FAMILY,
  outline: "none",
  boxSizing: "border-box",
};

const textAreaStyle = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 10,
  border: `1px solid ${BORDER}`,
  background: "#fff",
  color: TEXT,
  fontSize: 13,
  fontFamily: FONT_FAMILY,
  outline: "none",
  resize: "vertical",
  boxSizing: "border-box",
  lineHeight: 1.6,
};

const tableInputStyle = {
  width: "100%",
  height: 38,
  padding: "0 10px",
  borderRadius: 8,
  border: `1px solid ${BORDER}`,
  background: "#fff",
  color: TEXT,
  fontSize: 13,
  fontFamily: FONT_FAMILY,
  outline: "none",
  boxSizing: "border-box",
};

const twoColumnGrid = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 14,
};

const threeColumnGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(220px, 1fr))",
  gap: 12,
};

const fourColumnGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(180px, 1fr))",
  gap: 12,
};

export default OrderDetailPage;