import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import OrderService from "../../services/orders";
import { getToken } from "../../services/auth";

/* ============================================================================
   Create Order Page
   ----------------------------------------------------------------------------
   Fixed:
   - Users can now choose past dates
   - All date fields accept past, present, or future values
   - Auto-calculated dates still work, but no forced clamping to today
   - General and Frozen order flows preserved
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
const RED = "#dc2626";
const RED_SOFT = "rgba(220,38,38,0.10)";
const ORANGE = "#f97316";

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
  { value: "confirmed", label: "Confirmed" },
  { value: "draft", label: "Draft" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

const GENERAL_BACK_DAYS = {
  local: 4,
  chilled: 2,
  frozen: 11,
};

const GENERAL_DEFAULT_DEPARTURE_AHEAD = {
  local: 5,
  chilled: 3,
  frozen: 12,
};

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

function toDateInputValue(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function normalizeDateInput(dateStr) {
  const trimmed = String(dateStr || "").trim();
  if (!trimmed) return "";
  const d = new Date(`${trimmed}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  return toDateInputValue(d);
}

function dateStrMinusDays(dateStr, days) {
  const safe = normalizeDateInput(dateStr);
  if (!safe) return "";
  const d = new Date(`${safe}T00:00:00`);
  return toDateInputValue(subtractDays(d, days));
}

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

function formatNumber(value, maximumFractionDigits = 0) {
  const num = Number(value || 0);
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  }).format(Number.isFinite(num) ? num : 0);
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

function sumValues(obj) {
  return Object.values(obj).reduce((sum, val) => sum + (Number(val) || 0), 0);
}

function getDefaultGeneralSchedule(type) {
  const base = new Date();
  const departure = addDays(base, GENERAL_DEFAULT_DEPARTURE_AHEAD[type] || 5);
  const slaughter = subtractDays(departure, GENERAL_BACK_DAYS[type] || 4);

  return {
    departure_date: toDateInputValue(departure),
    slaughter_schedule: toDateInputValue(slaughter),
    expected_delivery: toDateInputValue(departure),
  };
}

function getInitialRatiosForMode() {
  return { beef: 0, goat: 50, lamb: 50 };
}

function getInitialTotalForMode(mode) {
  if (mode === MODE_FROZEN) return 20000;
  return 0;
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

function getDefaultProductStateForMode(mode) {
  const total = getInitialTotalForMode(mode);
  const ratios = getInitialRatiosForMode(mode);
  const quantities = quantitiesFromRatios(total, ratios);

  return {
    total_quantity_kg: total > 0 ? numToInput(total, 2) : "",
    beef_ratio: numToInput(ratios.beef, 2),
    goat_ratio: numToInput(ratios.goat, 2),
    lamb_ratio: numToInput(ratios.lamb, 2),
    beef_quantity_kg: numToInput(quantities.beef, 2),
    goat_quantity_kg: numToInput(quantities.goat, 2),
    lamb_quantity_kg: numToInput(quantities.lamb, 2),
  };
}

function buildInitialForm() {
  const now = new Date();
  const generalSchedule = getDefaultGeneralSchedule("local");
  const frozenDeparture = toDateInputValue(addDays(now, 3));

  return {
    mode: MODE_GENERAL,
    general_type: "local",

    enterprise_name: "",
    status: "confirmed",

    report_month: String(now.getMonth() + 1),
    report_year: String(now.getFullYear()),

    ...getDefaultProductStateForMode(MODE_GENERAL),

    slaughter_schedule: generalSchedule.slaughter_schedule,
    expected_delivery: generalSchedule.expected_delivery,
    departure_date: generalSchedule.departure_date,

    shipment_value_usd: "",
    price_per_kg_usd: "",
    amount_paid_usd: "",

    container_gate_in: "",
    jurisdiction: "",
    frozen_departure_date: frozenDeparture,
  };
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

function CreateOrderPage() {
  const router = useRouter();

  const [authReady, setAuthReady] = useState(false);
  const [form, setForm] = useState(buildInitialForm);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState({ type: "", message: "" });

  useEffect(() => {
    const token = typeof window !== "undefined" ? getToken?.() : null;
    if (!token) {
      router.replace("/auth/login");
      return;
    }
    setAuthReady(true);
  }, [router]);

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

  const downPayment = useMemo(
    () => Math.max(toNumber(form.amount_paid_usd), 0),
    [form.amount_paid_usd]
  );

  const shipmentValue = useMemo(
    () => Math.max(toNumber(form.shipment_value_usd), 0),
    [form.shipment_value_usd]
  );

  const draftBalance = useMemo(() => {
    const balance = shipmentValue - downPayment;
    return balance > 0 ? balance : 0;
  }, [shipmentValue, downPayment]);

  const ratioPreviewText = useMemo(() => {
    return `Beef ${formatNumber(ratios.beef, 2)}%, Goat ${formatNumber(
      ratios.goat,
      2
    )}%, Lamb ${formatNumber(ratios.lamb, 2)}%`;
  }, [ratios]);

  const applyProductState = (
    nextTotal,
    nextQuantities,
    nextRatios,
    extra = {}
  ) => {
    setForm((prev) => {
      const price = compactText(extra.price_per_kg_usd ?? prev.price_per_kg_usd);
      const shipment = compactText(
        extra.shipment_value_usd ?? prev.shipment_value_usd
      );

      let nextPrice = price;
      let nextShipment = shipment;

      const numericTotal = Math.max(Number(nextTotal) || 0, 0);

      if (nextPrice !== "" && numericTotal > 0) {
        nextShipment = numToInput(toNumber(nextPrice) * numericTotal, 2);
      } else if (nextShipment !== "" && numericTotal > 0) {
        nextPrice = numToInput(toNumber(nextShipment) / numericTotal, 4);
      }

      return {
        ...prev,
        ...extra,
        total_quantity_kg: numericTotal > 0 ? numToInput(numericTotal, 2) : "",
        beef_quantity_kg: numToInput(nextQuantities.beef, 2),
        goat_quantity_kg: numToInput(nextQuantities.goat, 2),
        lamb_quantity_kg: numToInput(nextQuantities.lamb, 2),
        beef_ratio: numToInput(nextRatios.beef, 2),
        goat_ratio: numToInput(nextRatios.goat, 2),
        lamb_ratio: numToInput(nextRatios.lamb, 2),
        price_per_kg_usd: nextPrice,
        shipment_value_usd: nextShipment,
      };
    });
  };

  const handleModeSwitch = (mode) => {
    setNotice({ type: "", message: "" });

    setForm((prev) => {
      if (mode === prev.mode) return prev;

      if (mode === MODE_FROZEN) {
        const defaults = getDefaultProductStateForMode(MODE_FROZEN);
        return {
          ...prev,
          mode,
          status: prev.status || "confirmed",
          ...defaults,
          frozen_departure_date:
            normalizeDateInput(prev.frozen_departure_date) ||
            toDateInputValue(addDays(new Date(), 3)),
        };
      }

      const schedule = getDefaultGeneralSchedule(prev.general_type || "local");

      return {
        ...prev,
        mode,
        slaughter_schedule: schedule.slaughter_schedule,
        expected_delivery: schedule.expected_delivery,
        departure_date: schedule.departure_date,
      };
    });
  };

  const handleGeneralTypeSwitch = (type) => {
    const schedule = getDefaultGeneralSchedule(type);

    setForm((prev) => ({
      ...prev,
      general_type: type,
      slaughter_schedule: schedule.slaughter_schedule,
      expected_delivery: schedule.expected_delivery,
      departure_date: schedule.departure_date,
    }));
  };

  const handleTotalQuantityChange = (value) => {
    const nextTotal = Math.max(toNumber(value), 0);

    let nextRatios = { ...ratios };
    if (sumValues(nextRatios) <= 0) {
      nextRatios = getInitialRatiosForMode(form.mode);
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
          : getInitialRatiosForMode(form.mode);

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
    setForm((prev) => {
      const numericPrice = toNumber(nextPrice);
      const nextShipment =
        totalQuantity > 0 && nextPrice !== ""
          ? numToInput(numericPrice * totalQuantity, 2)
          : "";

      return {
        ...prev,
        price_per_kg_usd: nextPrice,
        shipment_value_usd: nextShipment,
      };
    });
  };

  const handleShipmentValueChange = (value) => {
    const nextShipment = compactText(value);
    setForm((prev) => {
      const numericShipment = toNumber(nextShipment);
      const nextPrice =
        totalQuantity > 0 && nextShipment !== ""
          ? numToInput(numericShipment / totalQuantity, 4)
          : "";

      return {
        ...prev,
        shipment_value_usd: nextShipment,
        price_per_kg_usd: nextPrice,
      };
    });
  };

  const handleDownPaymentChange = (value) => {
    setForm((prev) => ({
      ...prev,
      amount_paid_usd: compactText(value),
    }));
  };

  const handleGeneralDepartureChange = (value) => {
    const safeDeparture = normalizeDateInput(value);
    const backDays = GENERAL_BACK_DAYS[form.general_type] || 4;
    const calculatedSlaughter = safeDeparture
      ? dateStrMinusDays(safeDeparture, backDays)
      : "";

    setForm((prev) => ({
      ...prev,
      departure_date: safeDeparture,
      slaughter_schedule: calculatedSlaughter,
      expected_delivery: safeDeparture || prev.expected_delivery,
    }));
  };

  const handleGeneralSlaughterChange = (value) => {
    setForm((prev) => ({
      ...prev,
      slaughter_schedule: normalizeDateInput(value),
    }));
  };

  const handleExpectedDeliveryChange = (value) => {
    setForm((prev) => ({
      ...prev,
      expected_delivery: normalizeDateInput(value),
    }));
  };

  const handleFrozenDepartureChange = (value) => {
    setForm((prev) => ({
      ...prev,
      frozen_departure_date: normalizeDateInput(value),
    }));
  };

  const resetForm = () => {
    setForm(buildInitialForm());
    setNotice({ type: "", message: "" });
  };

  const validateForm = () => {
    if (!compactText(form.enterprise_name)) {
      return "Enterprise name is required.";
    }

    if (totalQuantity <= 0) {
      return "Total quantity must be greater than 0.";
    }

    if (Math.abs(ratioTotal - 100) > 0.01) {
      return "Beef, Goat, and Lamb ratios must add up to 100%.";
    }

    if (form.mode === MODE_GENERAL) {
      if (!compactText(form.slaughter_schedule)) {
        return "Slaughter schedule is required.";
      }
      if (!compactText(form.expected_delivery)) {
        return "Expected delivery is required.";
      }
    }

    if (form.mode === MODE_FROZEN) {
      if (!compactText(form.frozen_departure_date)) {
        return "Departure date is required for frozen containers.";
      }
    }

    return "";
  };

  const buildItemsJson = () => {
    const items = [];

    PRODUCT_KEYS.forEach((key) => {
      const qty = Number(quantities[key]) || 0;
      if (qty <= 0) return;

      items.push({
        product_name: PRODUCT_META[key].productName,
        animal_type: PRODUCT_META[key].animalType,
        quantity_kg: Number(qty.toFixed(2)),
      });
    });

    return items;
  };

  const buildOrderRatioText = () => {
    return `Beef ${roundTo(ratios.beef, 2)}%, Goat ${roundTo(
      ratios.goat,
      2
    )}%, Lamb ${roundTo(ratios.lamb, 2)}%`;
  };

  const buildPayload = () => {
    const payload = {
      enterprise_name: compactText(form.enterprise_name),
      status: form.status,
      report_month: toNullableInteger(form.report_month),
      report_year: toNullableInteger(form.report_year),
      order_ratio: buildOrderRatioText(),
      items_json: buildItemsJson(),
      shipment_value_usd: toNullableNumber(form.shipment_value_usd),
      price_per_kg_usd: toNullableNumber(form.price_per_kg_usd),
      amount_paid_usd: toNullableNumber(form.amount_paid_usd),
    };

    if (form.mode === MODE_GENERAL) {
      payload.order_profile = "standard_order";
      payload.order_type = form.general_type;
      payload.slaughter_schedule = compactText(form.slaughter_schedule);
      payload.expected_delivery = compactText(form.expected_delivery);
      payload.departure_date = compactText(form.departure_date) || null;
    }

    if (form.mode === MODE_FROZEN) {
      payload.order_profile = "frozen_container";
      payload.order_type = "frozen";
      payload.container_gate_in = compactText(form.container_gate_in) || null;
      payload.departure_date = compactText(form.frozen_departure_date);
      payload.jurisdiction = compactText(form.jurisdiction) || null;
    }

    return payload;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const validationMessage = validateForm();
    if (validationMessage) {
      setNotice({ type: "error", message: validationMessage });
      return;
    }

    try {
      setSaving(true);
      setNotice({ type: "", message: "" });

      const payload = buildPayload();
      const created = await OrderService.create(payload);

      const createdId = created?.id;
      if (createdId) {
        router.push(`/orders/${createdId}`);
        return;
      }

      router.push("/orders");
    } catch (err) {
      setNotice({
        type: "error",
        message: err?.message || "Failed to create order.",
      });
    } finally {
      setSaving(false);
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
                fontSize: 24,
                lineHeight: 1.2,
                fontWeight: 700,
                letterSpacing: "-0.02em",
              }}
            >
              Create Order
            </h1>

            <div
              style={{
                marginTop: 6,
                fontSize: 13,
                color: MUTED,
                lineHeight: 1.6,
              }}
            >
              Choose either General Orders or Frozen Containers. Date fields now
              allow past, present, and future dates.
            </div>
          </div>

          <button
            type="button"
            onClick={resetForm}
            disabled={saving}
            style={buttonSecondary(saving)}
          >
            Reset form
          </button>
        </div>

        <div
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            marginBottom: 16,
          }}
        >
          <ModeButton
            active={form.mode === MODE_GENERAL}
            onClick={() => handleModeSwitch(MODE_GENERAL)}
          >
            General Orders
          </ModeButton>

          <ModeButton
            active={form.mode === MODE_FROZEN}
            onClick={() => handleModeSwitch(MODE_FROZEN)}
          >
            Frozen Containers
          </ModeButton>
        </div>

        {form.mode === MODE_GENERAL ? (
          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              marginBottom: 16,
            }}
          >
            {GENERAL_TYPES.map((item) => (
              <SubTypeButton
                key={item.value}
                active={form.general_type === item.value}
                onClick={() => handleGeneralTypeSwitch(item.value)}
              >
                {item.label}
              </SubTypeButton>
            ))}
          </div>
        ) : null}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(180px, 1fr))",
            gap: 12,
            marginBottom: 16,
          }}
        >
          <SummaryCard
            label="Total Quantity"
            value={`${formatNumber(totalQuantity, 2)} kg`}
            hint="Current order quantity"
          />
          <SummaryCard
            label="Ratio"
            value={ratioPreviewText}
            hint="Auto-balanced"
          />
          <SummaryCard
            label="Pieces Required"
            value={formatNumber(totalPieces)}
            hint="Auto-calculated"
          />
          <SummaryCard
            label="Balance"
            value={formatMoney(draftBalance)}
            hint="Shipment minus down payment"
          />
        </div>

        <form onSubmit={handleSubmit}>
          <Section
            title={
              form.mode === MODE_GENERAL
                ? "General Order Form"
                : "Frozen Container Form"
            }
            subtitle={
              form.mode === MODE_GENERAL
                ? "Simple fields for general orders."
                : "Simple fields for frozen container orders."
            }
          >
            <div style={twoColumnGrid}>
              <Input
                label={
                  form.mode === MODE_GENERAL
                    ? "Name of Enterprise"
                    : "Client Name"
                }
                value={form.enterprise_name}
                onChange={(v) =>
                  setForm((prev) => ({
                    ...prev,
                    enterprise_name: v,
                  }))
                }
                placeholder="Enter name"
                required
              />

              <Select
                label="Status"
                value={form.status}
                onChange={(v) =>
                  setForm((prev) => ({
                    ...prev,
                    status: v,
                  }))
                }
                options={ORDER_STATUS_OPTIONS}
              />
            </div>

            <div style={{ marginTop: 12, ...threeColumnGrid }}>
              <Input
                label="Report Month"
                type="number"
                min="1"
                max="12"
                value={form.report_month}
                onChange={(v) =>
                  setForm((prev) => ({
                    ...prev,
                    report_month: v,
                  }))
                }
              />

              <Input
                label="Report Year"
                type="number"
                min="2000"
                max="2100"
                value={form.report_year}
                onChange={(v) =>
                  setForm((prev) => ({
                    ...prev,
                    report_year: v,
                  }))
                }
              />

              <Input
                label="Total Quantity (kg)"
                type="number"
                step="0.01"
                min="0"
                value={form.total_quantity_kg}
                onChange={handleTotalQuantityChange}
                placeholder="0.00"
                required
              />
            </div>

            {form.mode === MODE_GENERAL ? (
              <div style={{ marginTop: 12, ...threeColumnGrid }}>
                <Input
                  label="Departure Date"
                  type="date"
                  value={form.departure_date}
                  onChange={handleGeneralDepartureChange}
                />

                <Input
                  label="Slaughter Schedule"
                  type="date"
                  value={form.slaughter_schedule}
                  onChange={handleGeneralSlaughterChange}
                  required
                />

                <Input
                  label="Expected Delivery"
                  type="date"
                  value={form.expected_delivery}
                  onChange={handleExpectedDeliveryChange}
                  required
                />
              </div>
            ) : (
              <div style={{ marginTop: 12, ...threeColumnGrid }}>
                <Input
                  label="Container Gate in"
                  type="date"
                  value={form.container_gate_in}
                  onChange={(v) =>
                    setForm((prev) => ({
                      ...prev,
                      container_gate_in: normalizeDateInput(v),
                    }))
                  }
                />

                <Input
                  label="Departure Date"
                  type="date"
                  value={form.frozen_departure_date}
                  onChange={handleFrozenDepartureChange}
                  required
                />

                <Input
                  label="Jurisdiction"
                  value={form.jurisdiction}
                  onChange={(v) =>
                    setForm((prev) => ({
                      ...prev,
                      jurisdiction: v,
                    }))
                  }
                  placeholder="Jurisdiction"
                />
              </div>
            )}

            <div style={{ marginTop: 12, ...threeColumnGrid }}>
              <Input
                label={
                  form.mode === MODE_GENERAL
                    ? "Shipment Value (USD)"
                    : "Container Value (USD)"
                }
                type="number"
                step="0.01"
                value={form.shipment_value_usd}
                onChange={handleShipmentValueChange}
                placeholder="0.00"
              />

              <Input
                label="Price per kg"
                type="number"
                step="0.0001"
                value={form.price_per_kg_usd}
                onChange={handlePriceChange}
                placeholder="0.0000"
              />

              <Input
                label={
                  form.mode === MODE_GENERAL
                    ? "Down Payment (USD)"
                    : "Down Payment"
                }
                type="number"
                step="0.01"
                value={form.amount_paid_usd}
                onChange={handleDownPaymentChange}
                placeholder="0.00"
              />
            </div>
          </Section>

          <Section
            title="Product Mix"
            subtitle="You can work by ratio or by quantity. Changing one field automatically updates the related fields."
          >
            <div
              style={{
                overflowX: "auto",
                width: "100%",
              }}
            >
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
                      <TableCell strong>{PRODUCT_META[key].label}</TableCell>
                      <TableCell>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={form[`${key}_quantity_kg`]}
                          onChange={(e) =>
                            handleQuantityChange(key, e.target.value)
                          }
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
          </Section>

          <div
            style={{
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
              marginTop: 16,
            }}
          >
            <button
              type="submit"
              disabled={saving}
              style={buttonPrimary(saving)}
            >
              {saving ? "Creating..." : "Create order"}
            </button>

            <Link
              href="/orders"
              style={{
                ...linkButton,
                textDecoration: "none",
              }}
            >
              Cancel
            </Link>
          </div>
        </form>
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

function SummaryCard({ label, value, hint }) {
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
          fontSize: 20,
          fontWeight: 700,
          lineHeight: 1.25,
          letterSpacing: "-0.02em",
          color: TEXT,
        }}
      >
        {value}
      </div>
      <div style={{ marginTop: 4, fontSize: 12, color: MUTED }}>{hint}</div>
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
        background: active ? "rgba(249,115,22,0.10)" : "#fff",
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
  required,
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
        {required ? <span style={{ color: RED }}> *</span> : null}
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

function TableHead({ children }) {
  return (
    <th
      style={{
        textAlign: "left",
        padding: "12px 14px",
        fontSize: 12,
        fontWeight: 700,
        color: "#334155",
      }}
    >
      {children}
    </th>
  );
}

function TableCell({ children, strong }) {
  return (
    <td
      style={{
        padding: "12px 14px",
        fontSize: 13,
        color: TEXT,
        fontWeight: strong ? 700 : 400,
      }}
    >
      {children}
    </td>
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
          height: 260,
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
  gap: 12,
};

const threeColumnGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(220px, 1fr))",
  gap: 12,
};

const linkButton = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  border: `1px solid ${BORDER}`,
  background: "#fff",
  color: TEXT,
  borderRadius: 10,
  padding: "10px 16px",
  fontSize: 13,
  fontWeight: 600,
};

export default CreateOrderPage;