import Head from "next/head";
import { useEffect, useMemo, useRef, useState } from "react";

import InventoryService from "../../services/inventory";
import { getToken } from "../../services/auth";

const PAGE_BG = "#ffffff";
const SURFACE = "#ffffff";
const BORDER = "#e5e7eb";
const BORDER_DARK = "#d1d5db";
const TEXT = "#111827";
const MUTED = "#6b7280";
const SOFT_2 = "#f3f4f6";
const ORANGE = "#ff7a00";
const ORANGE_DEEP = "#e86a00";
const GREEN = "#15803d";
const RED = "#b91c1c";
const RED_SOFT = "rgba(185, 28, 28, 0.08)";
const BLUE = "#2563eb";
const BLUE_SOFT = "rgba(37,99,235,0.10)";
const GREEN_SOFT = "rgba(21,128,61,0.08)";
const SHADOW = "0 10px 30px rgba(15, 23, 42, 0.05)";
const ALL_STORES_VALUE = "__ALL__";
const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://127.0.0.1:8000";

function defaultDateInputValue() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function shiftDateInputValue(value, days) {
  if (!value) return defaultDateInputValue();
  const dt = new Date(`${value}T00:00:00`);
  if (Number.isNaN(dt.getTime())) return defaultDateInputValue();
  dt.setDate(dt.getDate() + days);
  const yyyy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function asText(value, fallback = "") {
  if (value === undefined || value === null) return fallback;
  return String(value);
}

function asNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toFixed2(value) {
  return asNumber(value, 0).toFixed(2);
}

function hasText(value) {
  return String(value || "").trim().length > 0;
}

function normalizeDateValue(value) {
  if (!value) return "";
  return String(value).slice(0, 10);
}

function compareIsoDatesDesc(a, b) {
  const av = normalizeDateValue(a);
  const bv = normalizeDateValue(b);
  if (av === bv) return 0;
  return av > bv ? -1 : 1;
}

function isSavedRow(row) {
  return Boolean(row?.is_existing) || row?.source === "saved";
}

function computeProductClosing(row) {
  const opening = asNumber(row.opening_balance);
  const prod = asNumber(row.inflow_production);
  const tin = asNumber(row.inflow_transfers_in);
  const dispatch = asNumber(row.outflow_dispatch);
  const tout = asNumber(row.outflow_transfers_out);
  return opening + prod + tin - dispatch - tout;
}

function computeProductNetMovement(row) {
  const prod = asNumber(row.inflow_production);
  const tin = asNumber(row.inflow_transfers_in);
  const dispatch = asNumber(row.outflow_dispatch);
  const tout = asNumber(row.outflow_transfers_out);
  return prod + tin - dispatch - tout;
}

function computeConsumableClosing(row) {
  const opening = asNumber(row.opening_balance);
  const issued = asNumber(row.issued_today);
  return opening - issued;
}

function productRowHasMovement(row) {
  return (
    asNumber(row.inflow_production) > 0 ||
    asNumber(row.inflow_transfers_in) > 0 ||
    asNumber(row.outflow_dispatch) > 0 ||
    asNumber(row.outflow_transfers_out) > 0 ||
    asNumber(row.total_boxes) > 0 ||
    asNumber(row.total_pieces) > 0 ||
    hasText(row.remarks) ||
    hasText(row.checked_by_initials)
  );
}

function consumableRowHasMovement(row) {
  return (
    asNumber(row.issued_today) > 0 ||
    hasText(row.remarks) ||
    hasText(row.checked_by_initials)
  );
}

function makeProductRowKey(row, index) {
  return [
    "product",
    asText(row.store),
    asText(row.product_id),
    asText(row.entry_id || row.id || row.serial_no || index),
  ].join(":");
}

function makeConsumableRowKey(row, index) {
  return [
    "consumable",
    asText(row.store),
    asText(row.item_id),
    asText(row.entry_id || row.id || row.serial_no || index),
  ].join(":");
}

function sortProductRows(rows) {
  return [...(rows || [])].sort((a, b) => {
    const aStore = asText(a.store).toLowerCase();
    const bStore = asText(b.store).toLowerCase();
    if (aStore !== bStore) return aStore.localeCompare(bStore);

    const aSerial = asNumber(a.serial_no, 0);
    const bSerial = asNumber(b.serial_no, 0);
    if (aSerial !== bSerial) return aSerial - bSerial;

    const aCategory = asText(a.product_category_name).toLowerCase();
    const bCategory = asText(b.product_category_name).toLowerCase();
    if (aCategory !== bCategory) return aCategory.localeCompare(bCategory);

    return asText(a.product_name).toLowerCase().localeCompare(asText(b.product_name).toLowerCase());
  });
}

function sortConsumableRows(rows) {
  return [...(rows || [])].sort((a, b) => {
    const aStore = asText(a.store).toLowerCase();
    const bStore = asText(b.store).toLowerCase();
    if (aStore !== bStore) return aStore.localeCompare(bStore);

    const aSerial = asNumber(a.serial_no, 0);
    const bSerial = asNumber(b.serial_no, 0);
    if (aSerial !== bSerial) return aSerial - bSerial;

    const aCategory = asText(a.item_category_name).toLowerCase();
    const bCategory = asText(b.item_category_name).toLowerCase();
    if (aCategory !== bCategory) return aCategory.localeCompare(bCategory);

    return asText(a.item_name).toLowerCase().localeCompare(asText(b.item_name).toLowerCase());
  });
}

function normalizeLoadedProductRows(rows) {
  return sortProductRows(rows).map((row, index) => {
    const closing = computeProductClosing(row);
    const net = computeProductNetMovement(row);

    return {
      ...row,
      entry_date: normalizeDateValue(row.entry_date),
      _localKey: makeProductRowKey(row, index),
      opening_balance: toFixed2(row.opening_balance),
      inflow_production: toFixed2(row.inflow_production),
      inflow_transfers_in: toFixed2(row.inflow_transfers_in),
      outflow_dispatch: toFixed2(row.outflow_dispatch),
      outflow_transfers_out: toFixed2(row.outflow_transfers_out),
      total_boxes: asNumber(row.total_boxes, 0),
      total_pieces: asNumber(row.total_pieces, 0),
      closing_balance: toFixed2(closing),
      net_movement: toFixed2(net),
      remarks: row.remarks || "",
      checked_by_initials: row.checked_by_initials || "",
      is_existing: Boolean(row.is_existing) || row.source === "saved",
    };
  });
}

function normalizeLoadedConsumableRows(rows) {
  return sortConsumableRows(rows).map((row, index) => {
    const closing = computeConsumableClosing(row);

    return {
      ...row,
      entry_date: normalizeDateValue(row.entry_date),
      _localKey: makeConsumableRowKey(row, index),
      opening_balance: toFixed2(row.opening_balance),
      issued_today: toFixed2(row.issued_today),
      closing_balance: toFixed2(closing),
      remarks: row.remarks || "",
      checked_by_initials: row.checked_by_initials || "",
      is_existing: Boolean(row.is_existing) || row.source === "saved",
    };
  });
}

function buildProductSummary(rows) {
  return (rows || []).reduce(
    (acc, row) => {
      acc.opening += asNumber(row.opening_balance);
      acc.production += asNumber(row.inflow_production);
      acc.transfersIn += asNumber(row.inflow_transfers_in);
      acc.dispatch += asNumber(row.outflow_dispatch);
      acc.transfersOut += asNumber(row.outflow_transfers_out);
      acc.boxes += asNumber(row.total_boxes);
      acc.pieces += asNumber(row.total_pieces);
      acc.closing += asNumber(row.closing_balance);
      return acc;
    },
    {
      opening: 0,
      production: 0,
      transfersIn: 0,
      dispatch: 0,
      transfersOut: 0,
      boxes: 0,
      pieces: 0,
      closing: 0,
    }
  );
}

function buildConsumableSummary(rows) {
  return (rows || []).reduce(
    (acc, row) => {
      acc.opening += asNumber(row.opening_balance);
      acc.issued += asNumber(row.issued_today);
      acc.closing += asNumber(row.closing_balance);
      return acc;
    },
    {
      opening: 0,
      issued: 0,
      closing: 0,
    }
  );
}

function FieldLabel({ children }) {
  return (
    <div
      style={{
        fontSize: 12,
        color: MUTED,
        marginBottom: 6,
        fontWeight: 600,
      }}
    >
      {children}
    </div>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
  type = "text",
  min,
  step,
  disabled = false,
}) {
  return (
    <input
      type={type}
      value={value}
      min={min}
      step={step}
      disabled={disabled}
      onChange={onChange}
      placeholder={placeholder}
      style={{
        width: "100%",
        height: 38,
        border: `1px solid ${BORDER_DARK}`,
        borderRadius: 10,
        padding: "0 12px",
        outline: "none",
        fontSize: 14,
        color: TEXT,
        background: disabled ? SOFT_2 : "#fff",
      }}
    />
  );
}

function SelectInput({ value, onChange, children, disabled = false }) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={onChange}
      style={{
        width: "100%",
        height: 38,
        border: `1px solid ${BORDER_DARK}`,
        borderRadius: 10,
        padding: "0 12px",
        outline: "none",
        fontSize: 14,
        color: TEXT,
        background: disabled ? SOFT_2 : "#fff",
      }}
    >
      {children}
    </select>
  );
}

function ActionButton({
  children,
  onClick,
  disabled = false,
  variant = "primary",
  type = "button",
}) {
  const styles =
    variant === "secondary"
      ? {
          background: "#fff",
          color: TEXT,
          border: `1px solid ${BORDER_DARK}`,
        }
      : {
          background: ORANGE,
          color: "#fff",
          border: `1px solid ${ORANGE}`,
        };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        height: 40,
        padding: "0 16px",
        borderRadius: 10,
        cursor: disabled ? "not-allowed" : "pointer",
        fontSize: 14,
        fontWeight: 700,
        opacity: disabled ? 0.6 : 1,
        ...styles,
      }}
      onMouseOver={(e) => {
        if (!disabled && variant === "primary") {
          e.currentTarget.style.background = ORANGE_DEEP;
          e.currentTarget.style.borderColor = ORANGE_DEEP;
        }
      }}
      onMouseOut={(e) => {
        if (variant === "primary") {
          e.currentTarget.style.background = ORANGE;
          e.currentTarget.style.borderColor = ORANGE;
        }
      }}
    >
      {children}
    </button>
  );
}

function InventoryCellInput({
  value,
  onChange,
  type = "text",
  min,
  step,
  align = "left",
}) {
  return (
    <input
      type={type}
      min={min}
      step={step}
      value={value}
      onChange={onChange}
      style={{
        width: "100%",
        height: 34,
        border: `1px solid ${BORDER}`,
        borderRadius: 8,
        padding: "0 8px",
        outline: "none",
        fontSize: 13,
        color: TEXT,
        background: "#fff",
        textAlign: align,
      }}
    />
  );
}

function InventoryReadCell({ value, align = "left", danger = false }) {
  return (
    <div
      style={{
        fontSize: 13,
        color: danger ? RED : TEXT,
        textAlign: align,
        fontWeight: danger ? 700 : 500,
        whiteSpace: "nowrap",
      }}
    >
      {value}
    </div>
  );
}

function chipStyle(color, background) {
  return {
    display: "inline-flex",
    alignItems: "center",
    height: 28,
    padding: "0 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
    color,
    background,
    whiteSpace: "nowrap",
  };
}

function MetaBanner({ activeTab, entryDate, meta, selectedStoreValue, isAllStores }) {
  const label = activeTab === "products" ? "product" : "consumable";
  const title = isAllStores
    ? `Continuous ${label} sheet loaded for ${meta?.storeCount || 0} stores`
    : `Continuous ${label} sheet loaded`;
  const subtitle = isAllStores
    ? "Only stores and items/products that already exist in inventory history are loaded. Nothing is auto-assigned to a store from master product setup."
    : "Only rows already existing in this store’s history are loaded. Missing rows for today are carried forward from the latest previous closing balance.";

  return (
    <div
      style={{
        marginBottom: 14,
        border: `1px solid ${BORDER}`,
        background: "#fff",
        borderRadius: 14,
        padding: "12px 14px",
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 800, color: TEXT, marginBottom: 4 }}>
        {title}
      </div>
      <div style={{ fontSize: 13, color: MUTED, lineHeight: 1.5, marginBottom: 8 }}>
        {subtitle}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <span style={chipStyle(BLUE, BLUE_SOFT)}>Date: {entryDate || "-"}</span>
        <span style={chipStyle(GREEN, GREEN_SOFT)}>Saved: {meta?.savedRows ?? 0}</span>
        <span style={chipStyle(BLUE, BLUE_SOFT)}>Carry-forward: {meta?.generatedRows ?? 0}</span>
        <span style={chipStyle(TEXT, SOFT_2)}>
          Mode: {isAllStores ? "All stores with history" : selectedStoreValue || "-"}
        </span>
      </div>
    </div>
  );
}

async function requestJson(path, query = {}) {
  const token = typeof window !== "undefined" ? getToken?.() : null;
  const params = new URLSearchParams();

  Object.entries(query || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    params.set(key, String(value));
  });

  const url = `${API_BASE}${path}${params.toString() ? `?${params.toString()}` : ""}`;
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!response.ok) {
    throw new Error(
      data?.detail ||
        data?.message ||
        `Request failed with status ${response.status}`
    );
  }

  return data;
}

async function fetchAllPaged(path, baseQuery = {}) {
  const allItems = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    const data = await requestJson(path, {
      ...baseQuery,
      page,
      page_size: 500,
    });

    const items = Array.isArray(data?.items) ? data.items : [];
    allItems.push(...items);

    totalPages = Math.max(1, Number(data?.total_pages || 1));
    page += 1;
  }

  return allItems;
}

function buildProductHistoryRows(entries, entryDate, selectedStoreValue) {
  const filtered = (entries || []).filter((row) => {
    const rowDate = normalizeDateValue(row.entry_date);
    if (!rowDate || rowDate > entryDate) return false;
    if (selectedStoreValue && row.store !== selectedStoreValue) return false;
    return true;
  });

  filtered.sort((a, b) => {
    const byDate = compareIsoDatesDesc(a.entry_date, b.entry_date);
    if (byDate !== 0) return byDate;

    const aStore = asText(a.store).toLowerCase();
    const bStore = asText(b.store).toLowerCase();
    if (aStore !== bStore) return aStore.localeCompare(bStore);

    const aSerial = asNumber(a.serial_no, 0);
    const bSerial = asNumber(b.serial_no, 0);
    return aSerial - bSerial;
  });

  const todayByKey = new Map();
  const previousByKey = new Map();

  filtered.forEach((row) => {
    const key = `${asText(row.store)}::${asText(row.product_id)}`;
    const rowDate = normalizeDateValue(row.entry_date);

    if (rowDate === entryDate) {
      if (!todayByKey.has(key)) todayByKey.set(key, row);
      return;
    }

    if (rowDate < entryDate && !previousByKey.has(key)) {
      previousByKey.set(key, row);
    }
  });

  const storeSet = new Set();
  [...todayByKey.values(), ...previousByKey.values()].forEach((row) => {
    if (row?.store) storeSet.add(row.store);
  });

  const stores = [...storeSet].sort((a, b) =>
    asText(a).toLowerCase().localeCompare(asText(b).toLowerCase())
  );

  const builtRows = [];
  let savedCount = 0;
  let generatedCount = 0;

  stores.forEach((store) => {
    const keys = new Set();

    todayByKey.forEach((row, key) => {
      if (row.store === store) keys.add(key);
    });

    previousByKey.forEach((row, key) => {
      if (row.store === store) keys.add(key);
    });

    const storeRows = [];

    [...keys].forEach((key) => {
      const today = todayByKey.get(key);
      const previous = previousByKey.get(key);

      if (today) {
        savedCount += 1;
        storeRows.push({
          ...today,
          entry_id: today.id,
          is_existing: true,
          source: "saved",
        });
        return;
      }

      if (previous) {
        generatedCount += 1;
        storeRows.push({
          id: null,
          entry_id: null,
          serial_no: previous.serial_no,
          entry_date: entryDate,
          store: previous.store,
          product_category_id: previous.product_category_id,
          product_id: previous.product_id,
          product_category_name: previous.product_category_name,
          product_name: previous.product_name,
          balance_unit: previous.balance_unit,
          opening_balance: previous.closing_balance,
          inflow_production: 0,
          inflow_transfers_in: 0,
          outflow_dispatch: 0,
          outflow_transfers_out: 0,
          total_boxes: 0,
          total_pieces: 0,
          closing_balance: previous.closing_balance,
          remarks: "",
          checked_by_initials: "",
          created_by: null,
          updated_by: null,
          created_at: null,
          updated_at: null,
          is_existing: false,
          source: "carry_forward",
        });
      }
    });

    const sortedStoreRows = sortProductRows(storeRows).map((row, index) => ({
      ...row,
      serial_no: index + 1,
    }));

    builtRows.push(...sortedStoreRows);
  });

  const normalized = normalizeLoadedProductRows(builtRows);

  return {
    rows: normalized,
    meta: {
      totalRows: normalized.length,
      savedRows: savedCount,
      generatedRows: generatedCount,
      hasSavedRows: savedCount > 0,
      storeCount: stores.length,
      loadedStoreValues: stores,
      allStoresMode: !selectedStoreValue,
      mode: selectedStoreValue ? "single-history" : "all-history",
    },
  };
}

function buildConsumableHistoryRows(entries, entryDate, selectedStoreValue) {
  const filtered = (entries || []).filter((row) => {
    const rowDate = normalizeDateValue(row.entry_date);
    if (!rowDate || rowDate > entryDate) return false;
    if (selectedStoreValue && row.store !== selectedStoreValue) return false;
    return true;
  });

  filtered.sort((a, b) => {
    const byDate = compareIsoDatesDesc(a.entry_date, b.entry_date);
    if (byDate !== 0) return byDate;

    const aStore = asText(a.store).toLowerCase();
    const bStore = asText(b.store).toLowerCase();
    if (aStore !== bStore) return aStore.localeCompare(bStore);

    const aSerial = asNumber(a.serial_no, 0);
    const bSerial = asNumber(b.serial_no, 0);
    return aSerial - bSerial;
  });

  const todayByKey = new Map();
  const previousByKey = new Map();

  filtered.forEach((row) => {
    const key = `${asText(row.store)}::${asText(row.item_id)}`;
    const rowDate = normalizeDateValue(row.entry_date);

    if (rowDate === entryDate) {
      if (!todayByKey.has(key)) todayByKey.set(key, row);
      return;
    }

    if (rowDate < entryDate && !previousByKey.has(key)) {
      previousByKey.set(key, row);
    }
  });

  const storeSet = new Set();
  [...todayByKey.values(), ...previousByKey.values()].forEach((row) => {
    if (row?.store) storeSet.add(row.store);
  });

  const stores = [...storeSet].sort((a, b) =>
    asText(a).toLowerCase().localeCompare(asText(b).toLowerCase())
  );

  const builtRows = [];
  let savedCount = 0;
  let generatedCount = 0;

  stores.forEach((store) => {
    const keys = new Set();

    todayByKey.forEach((row, key) => {
      if (row.store === store) keys.add(key);
    });

    previousByKey.forEach((row, key) => {
      if (row.store === store) keys.add(key);
    });

    const storeRows = [];

    [...keys].forEach((key) => {
      const today = todayByKey.get(key);
      const previous = previousByKey.get(key);

      if (today) {
        savedCount += 1;
        storeRows.push({
          ...today,
          entry_id: today.id,
          is_existing: true,
          source: "saved",
        });
        return;
      }

      if (previous) {
        generatedCount += 1;
        storeRows.push({
          id: null,
          entry_id: null,
          serial_no: previous.serial_no,
          entry_date: entryDate,
          store: previous.store,
          item_category_id: previous.item_category_id,
          item_id: previous.item_id,
          item_category_name: previous.item_category_name,
          item_name: previous.item_name,
          unit: previous.unit,
          opening_balance: previous.closing_balance,
          issued_today: 0,
          closing_balance: previous.closing_balance,
          remarks: "",
          checked_by_initials: "",
          created_by: null,
          updated_by: null,
          created_at: null,
          updated_at: null,
          is_existing: false,
          source: "carry_forward",
        });
      }
    });

    const sortedStoreRows = sortConsumableRows(storeRows).map((row, index) => ({
      ...row,
      serial_no: index + 1,
    }));

    builtRows.push(...sortedStoreRows);
  });

  const normalized = normalizeLoadedConsumableRows(builtRows);

  return {
    rows: normalized,
    meta: {
      totalRows: normalized.length,
      savedRows: savedCount,
      generatedRows: generatedCount,
      hasSavedRows: savedCount > 0,
      storeCount: stores.length,
      loadedStoreValues: stores,
      allStoresMode: !selectedStoreValue,
      mode: selectedStoreValue ? "single-history" : "all-history",
    },
  };
}

export default function InventoryDailyPage() {
  const [activeTab, setActiveTab] = useState("products");
  const [entryDate, setEntryDate] = useState(defaultDateInputValue());

  const [bootstrap, setBootstrap] = useState(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [pageError, setPageError] = useState("");

  // Default to "All stores with history"
  const [productStore, setProductStore] = useState(ALL_STORES_VALUE);
  const [consumableStore, setConsumableStore] = useState(ALL_STORES_VALUE);

  const [productSheetMeta, setProductSheetMeta] = useState(null);
  const [consumableSheetMeta, setConsumableSheetMeta] = useState(null);

  const [productRows, setProductRows] = useState([]);
  const [consumableRows, setConsumableRows] = useState([]);

  const [productSearch, setProductSearch] = useState("");
  const [consumableSearch, setConsumableSearch] = useState("");

  const [showOnlyProductMovement, setShowOnlyProductMovement] = useState(false);
  const [showOnlyConsumableMovement, setShowOnlyConsumableMovement] = useState(false);

  const [productLoading, setProductLoading] = useState(false);
  const [consumableLoading, setConsumableLoading] = useState(false);

  const [productSaving, setProductSaving] = useState(false);
  const [consumableSaving, setConsumableSaving] = useState(false);

  const [notice, setNotice] = useState({ type: "", text: "" });

  const autoLoadProductRef = useRef(false);
  const autoLoadConsumableRef = useRef(false);

  useEffect(() => {
    let mounted = true;

    async function loadBootstrap() {
      setPageLoading(true);
      setPageError("");

      try {
        const data = await InventoryService.getBootstrap();
        if (!mounted) return;

        setBootstrap(data || null);
        // Do NOT override productStore/consumableStore – keep ALL_STORES_VALUE as default
      } catch (error) {
        if (!mounted) return;
        setPageError(error.message || "Unable to load inventory setup data.");
      } finally {
        if (mounted) setPageLoading(false);
      }
    }

    loadBootstrap();

    return () => {
      mounted = false;
    };
  }, []);

  const productStoreOptions = bootstrap?.product_stores || [];
  const consumableStoreOptions = bootstrap?.consumable_stores || [];

  const isAllProductStoresSelected = productStore === ALL_STORES_VALUE;
  const isAllConsumableStoresSelected = consumableStore === ALL_STORES_VALUE;

  const filteredProductRows = useMemo(() => {
    const term = productSearch.trim().toLowerCase();

    return productRows.filter((row) => {
      const matchesSearch =
        !term ||
        asText(row.product_name).toLowerCase().includes(term) ||
        asText(row.product_category_name).toLowerCase().includes(term) ||
        asText(row.balance_unit).toLowerCase().includes(term) ||
        asText(row.store).toLowerCase().includes(term);

      const matchesMovement = !showOnlyProductMovement || productRowHasMovement(row);
      return matchesSearch && matchesMovement;
    });
  }, [productRows, productSearch, showOnlyProductMovement]);

  const filteredConsumableRows = useMemo(() => {
    const term = consumableSearch.trim().toLowerCase();

    return consumableRows.filter((row) => {
      const matchesSearch =
        !term ||
        asText(row.item_name).toLowerCase().includes(term) ||
        asText(row.item_category_name).toLowerCase().includes(term) ||
        asText(row.unit).toLowerCase().includes(term) ||
        asText(row.store).toLowerCase().includes(term);

      const matchesMovement =
        !showOnlyConsumableMovement || consumableRowHasMovement(row);

      return matchesSearch && matchesMovement;
    });
  }, [consumableRows, consumableSearch, showOnlyConsumableMovement]);

  const productSummary = useMemo(
    () => buildProductSummary(filteredProductRows),
    [filteredProductRows]
  );

  const consumableSummary = useMemo(
    () => buildConsumableSummary(filteredConsumableRows),
    [filteredConsumableRows]
  );

  async function handleLoadProductSheet() {
    if (!entryDate) {
      setNotice({ type: "error", text: "Please select date first." });
      return;
    }

    if (!productStore) {
      setNotice({ type: "error", text: "Please select a product store or choose All stores." });
      return;
    }

    setProductLoading(true);
    setNotice({ type: "", text: "" });

    try {
      const selectedStoreValue = isAllProductStoresSelected ? null : productStore;
      const entries = await fetchAllPaged("/inventory/product-store/entries", {
        end_date: entryDate,
        ...(selectedStoreValue ? { store: selectedStoreValue } : {}),
      });

      const result = buildProductHistoryRows(entries, entryDate, selectedStoreValue);
      setProductRows(result.rows);
      setProductSheetMeta(result.meta);

      if (!result.rows.length) {
        setNotice({
          type: "error",
          text: selectedStoreValue
            ? "No product history exists for the selected store up to this date."
            : "No product history exists in any store up to this date.",
        });
      } else {
        setNotice({
          type: "success",
          text: selectedStoreValue
            ? "Loaded only this store’s historical products and carried forward the latest closing balances."
            : "Loaded only historically existing store-product rows across all stores and carried forward the latest closing balances.",
        });
      }
    } catch (error) {
      setNotice({
        type: "error",
        text: error.message || "Unable to load product history sheet.",
      });
    } finally {
      setProductLoading(false);
      autoLoadProductRef.current = false;
    }
  }

  async function handleLoadConsumableSheet() {
    if (!entryDate) {
      setNotice({ type: "error", text: "Please select date first." });
      return;
    }

    if (!consumableStore) {
      setNotice({ type: "error", text: "Please select a consumable store or choose All stores." });
      return;
    }

    setConsumableLoading(true);
    setNotice({ type: "", text: "" });

    try {
      const selectedStoreValue = isAllConsumableStoresSelected ? null : consumableStore;
      const entries = await fetchAllPaged("/inventory/consumable-store/entries", {
        end_date: entryDate,
        ...(selectedStoreValue ? { store: selectedStoreValue } : {}),
      });

      const result = buildConsumableHistoryRows(entries, entryDate, selectedStoreValue);
      setConsumableRows(result.rows);
      setConsumableSheetMeta(result.meta);

      if (!result.rows.length) {
        setNotice({
          type: "error",
          text: selectedStoreValue
            ? "No consumable history exists for the selected store up to this date."
            : "No consumable history exists in any store up to this date.",
        });
      } else {
        setNotice({
          type: "success",
          text: selectedStoreValue
            ? "Loaded only this store’s historical consumables and carried forward the latest closing balances."
            : "Loaded only historically existing store-item rows across all stores and carried forward the latest closing balances.",
        });
      }
    } catch (error) {
      setNotice({
        type: "error",
        text: error.message || "Unable to load consumable history sheet.",
      });
    } finally {
      setConsumableLoading(false);
      autoLoadConsumableRef.current = false;
    }
  }

  function updateProductRow(localKey, field, value) {
    setProductRows((prev) =>
      prev.map((row) => {
        if (row._localKey !== localKey) return row;
        const next = { ...row, [field]: value };
        next.closing_balance = toFixed2(computeProductClosing(next));
        next.net_movement = toFixed2(computeProductNetMovement(next));
        return next;
      })
    );
  }

  function updateConsumableRow(localKey, field, value) {
    setConsumableRows((prev) =>
      prev.map((row) => {
        if (row._localKey !== localKey) return row;
        const next = { ...row, [field]: value };
        next.closing_balance = toFixed2(computeConsumableClosing(next));
        return next;
      })
    );
  }

  async function handleSaveProductSheet() {
    if (!entryDate) {
      setNotice({ type: "error", text: "Please select date first." });
      return;
    }

    if (!productRows.length) {
      setNotice({ type: "error", text: "There are no product rows to save." });
      return;
    }

    setProductSaving(true);
    setNotice({ type: "", text: "" });

    try {
      const groups = new Map();

      productRows.forEach((row) => {
        const key = asText(row.store);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(row);
      });

      for (const [storeValue, rows] of groups.entries()) {
        await InventoryService.saveProductDailySheet({
          entryDate,
          store: storeValue,
          rows,
          includeEmptyRows: false,
        });
      }

      await handleLoadProductSheet();

      setNotice({
        type: "success",
        text:
          groups.size > 1
            ? `Product rows saved successfully for ${groups.size} stores.`
            : "Product sheet saved successfully.",
      });
    } catch (error) {
      setNotice({
        type: "error",
        text: error.message || "Unable to save product sheet.",
      });
    } finally {
      setProductSaving(false);
    }
  }

  async function handleSaveConsumableSheet() {
    if (!entryDate) {
      setNotice({ type: "error", text: "Please select date first." });
      return;
    }

    if (!consumableRows.length) {
      setNotice({ type: "error", text: "There are no consumable rows to save." });
      return;
    }

    setConsumableSaving(true);
    setNotice({ type: "", text: "" });

    try {
      const groups = new Map();

      consumableRows.forEach((row) => {
        const key = asText(row.store);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(row);
      });

      for (const [storeValue, rows] of groups.entries()) {
        await InventoryService.saveConsumableDailySheet({
          entryDate,
          store: storeValue,
          rows,
          includeEmptyRows: false,
        });
      }

      await handleLoadConsumableSheet();

      setNotice({
        type: "success",
        text:
          groups.size > 1
            ? `Consumable rows saved successfully for ${groups.size} stores.`
            : "Consumable sheet saved successfully.",
      });
    } catch (error) {
      setNotice({
        type: "error",
        text: error.message || "Unable to save consumable sheet.",
      });
    } finally {
      setConsumableSaving(false);
    }
  }

  useEffect(() => {
    if (pageLoading) return;
    if (activeTab !== "products") return;
    if (!entryDate) return;
    if (!productStore) return;
    if (productLoading) return;
    if (autoLoadProductRef.current) return;

    autoLoadProductRef.current = true;
    handleLoadProductSheet();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, entryDate, productStore, pageLoading]);

  useEffect(() => {
    if (pageLoading) return;
    if (activeTab !== "consumables") return;
    if (!entryDate) return;
    if (!consumableStore) return;
    if (consumableLoading) return;
    if (autoLoadConsumableRef.current) return;

    autoLoadConsumableRef.current = true;
    handleLoadConsumableSheet();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, entryDate, consumableStore, pageLoading]);

  function renderNotice() {
    if (!notice?.text) return null;

    const isError = notice.type === "error";

    return (
      <div
        style={{
          marginBottom: 16,
          border: `1px solid ${isError ? "#fecaca" : "#bbf7d0"}`,
          background: isError ? RED_SOFT : GREEN_SOFT,
          color: isError ? RED : GREEN,
          borderRadius: 12,
          padding: "12px 14px",
          fontSize: 14,
          fontWeight: 600,
        }}
      >
        {notice.text}
      </div>
    );
  }

  function renderTopControls() {
    const isProducts = activeTab === "products";

    return (
      <div
        style={{
          background: SURFACE,
          border: `1px solid ${BORDER}`,
          borderRadius: 18,
          boxShadow: SHADOW,
          padding: 16,
          marginBottom: 18,
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
            gap: 14,
            alignItems: "end",
          }}
        >
          <div>
            <FieldLabel>Entry Date</FieldLabel>
            <div style={{ display: "flex", gap: 8 }}>
              <ActionButton
                variant="secondary"
                onClick={() => setEntryDate((prev) => shiftDateInputValue(prev, -1))}
              >
                Previous
              </ActionButton>
              <TextInput
                type="date"
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
              />
              <ActionButton
                variant="secondary"
                onClick={() => setEntryDate((prev) => shiftDateInputValue(prev, 1))}
              >
                Next
              </ActionButton>
            </div>
          </div>

          <div>
            <FieldLabel>{isProducts ? "Product Store" : "Consumable Store"}</FieldLabel>
            <SelectInput
              value={isProducts ? productStore : consumableStore}
              onChange={(e) =>
                isProducts
                  ? setProductStore(e.target.value)
                  : setConsumableStore(e.target.value)
              }
            >
              <option value="">Select store</option>
              <option value={ALL_STORES_VALUE}>All stores with history</option>
              {(isProducts ? productStoreOptions : consumableStoreOptions).map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </SelectInput>
          </div>

          <div>
            <FieldLabel>Search</FieldLabel>
            <TextInput
              value={isProducts ? productSearch : consumableSearch}
              onChange={(e) =>
                isProducts
                  ? setProductSearch(e.target.value)
                  : setConsumableSearch(e.target.value)
              }
              placeholder={
                isProducts
                  ? "Search product, category, unit, store..."
                  : "Search item, category, unit, store..."
              }
            />
          </div>

          <div
            style={{
              display: "flex",
              gap: 10,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <ActionButton
              onClick={isProducts ? handleLoadProductSheet : handleLoadConsumableSheet}
              disabled={isProducts ? productLoading : consumableLoading}
              variant="secondary"
            >
              {(isProducts ? productLoading : consumableLoading) ? "Loading..." : "Load Sheet"}
            </ActionButton>

            <ActionButton
              onClick={isProducts ? handleSaveProductSheet : handleSaveConsumableSheet}
              disabled={isProducts ? productSaving : consumableSaving}
            >
              {(isProducts ? productSaving : consumableSaving) ? "Saving..." : "Save All"}
            </ActionButton>
          </div>
        </div>

        <div
          style={{
            marginTop: 14,
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => setActiveTab("products")}
              style={{
                height: 38,
                padding: "0 16px",
                borderRadius: 999,
                border: `1px solid ${activeTab === "products" ? ORANGE : BORDER_DARK}`,
                background: activeTab === "products" ? ORANGE : "#fff",
                color: activeTab === "products" ? "#fff" : TEXT,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Product Sheet
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("consumables")}
              style={{
                height: 38,
                padding: "0 16px",
                borderRadius: 999,
                border: `1px solid ${activeTab === "consumables" ? ORANGE : BORDER_DARK}`,
                background: activeTab === "consumables" ? ORANGE : "#fff",
                color: activeTab === "consumables" ? "#fff" : TEXT,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Consumable Sheet
            </button>
          </div>

          <label
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              color: MUTED,
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            <input
              type="checkbox"
              checked={activeTab === "products" ? showOnlyProductMovement : showOnlyConsumableMovement}
              onChange={(e) =>
                activeTab === "products"
                  ? setShowOnlyProductMovement(e.target.checked)
                  : setShowOnlyConsumableMovement(e.target.checked)
              }
            />
            Show only rows with movement
          </label>
        </div>
      </div>
    );
  }

  function renderProductStats() {
    return (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 12,
          marginBottom: 14,
        }}
      >
        {[
          { label: "Stores Loaded", value: productSheetMeta?.storeCount ?? 0 },
          { label: "Rows", value: productSheetMeta?.totalRows ?? productRows.length },
          { label: "Saved Rows", value: productSheetMeta?.savedRows ?? 0 },
          { label: "Carry-forward", value: productSheetMeta?.generatedRows ?? 0 },
          { label: "Opening Total", value: toFixed2(productSummary.opening) },
          { label: "Closing Total", value: toFixed2(productSummary.closing) },
        ].map((item) => (
          <div
            key={item.label}
            style={{
              border: `1px solid ${BORDER}`,
              background: "#fff",
              borderRadius: 14,
              padding: 14,
            }}
          >
            <div style={{ color: MUTED, fontSize: 12, marginBottom: 6, fontWeight: 600 }}>
              {item.label}
            </div>
            <div style={{ color: TEXT, fontSize: 18, fontWeight: 800 }}>{item.value}</div>
          </div>
        ))}
      </div>
    );
  }

  function renderConsumableStats() {
    return (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 12,
          marginBottom: 14,
        }}
      >
        {[
          { label: "Stores Loaded", value: consumableSheetMeta?.storeCount ?? 0 },
          { label: "Rows", value: consumableSheetMeta?.totalRows ?? consumableRows.length },
          { label: "Saved Rows", value: consumableSheetMeta?.savedRows ?? 0 },
          { label: "Carry-forward", value: consumableSheetMeta?.generatedRows ?? 0 },
          { label: "Opening Total", value: toFixed2(consumableSummary.opening) },
          { label: "Closing Total", value: toFixed2(consumableSummary.closing) },
        ].map((item) => (
          <div
            key={item.label}
            style={{
              border: `1px solid ${BORDER}`,
              background: "#fff",
              borderRadius: 14,
              padding: 14,
            }}
          >
            <div style={{ color: MUTED, fontSize: 12, marginBottom: 6, fontWeight: 600 }}>
              {item.label}
            </div>
            <div style={{ color: TEXT, fontSize: 18, fontWeight: 800 }}>{item.value}</div>
          </div>
        ))}
      </div>
    );
  }

  function renderProductTable() {
    const showStoreColumn = isAllProductStoresSelected;

    return (
      <div
        style={{
          background: "#fff",
          border: `1px solid ${BORDER}`,
          borderRadius: 18,
          boxShadow: SHADOW,
          overflow: "hidden",
        }}
      >
        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "separate",
              borderSpacing: 0,
              minWidth: showStoreColumn ? 1610 : 1490,
            }}
          >
            <thead>
              <tr style={{ background: SOFT_2 }}>
                <th style={thStyle}>S/N</th>
                {showStoreColumn ? <th style={thStyle}>Store</th> : null}
                <th style={thStyle}>Category</th>
                <th style={thStyle}>Product</th>
                <th style={thStyle}>Unit</th>
                <th style={thStyle}>Opening</th>
                <th style={thStyle}>Production</th>
                <th style={thStyle}>Transfers In</th>
                <th style={thStyle}>Dispatch</th>
                <th style={thStyle}>Transfers Out</th>
                <th style={thStyle}>Boxes</th>
                <th style={thStyle}>Pieces</th>
                <th style={thStyle}>Closing</th>
                <th style={thStyle}>Net</th>
                <th style={thStyle}>Remarks</th>
                <th style={thStyle}>Checked By</th>
                <th style={thStyle}>State</th>
              </tr>
            </thead>

            <tbody>
              {filteredProductRows.length ? (
                filteredProductRows.map((row, idx) => {
                  const closingIsNegative = asNumber(row.closing_balance) < 0;

                  return (
                    <tr key={row._localKey} style={{ background: closingIsNegative ? RED_SOFT : "#fff" }}>
                      <td style={cellTdStyle}>
                        <InventoryReadCell value={idx + 1} />
                      </td>
                      {showStoreColumn ? (
                        <td style={cellTdStyle}>
                          <InventoryReadCell value={row.store || ""} />
                        </td>
                      ) : null}
                      <td style={cellTdStyle}>
                        <InventoryReadCell value={row.product_category_name || ""} />
                      </td>
                      <td style={cellTdStyle}>
                        <InventoryReadCell value={row.product_name || ""} />
                      </td>
                      <td style={cellTdStyle}>
                        <InventoryReadCell value={row.balance_unit || ""} />
                      </td>
                      <td style={cellTdStyle}>
                        <InventoryReadCell value={toFixed2(row.opening_balance)} align="right" />
                      </td>
                      <td style={cellTdStyle}>
                        <InventoryCellInput
                          type="number"
                          min="0"
                          step="0.01"
                          align="right"
                          value={row.inflow_production}
                          onChange={(e) =>
                            updateProductRow(row._localKey, "inflow_production", e.target.value)
                          }
                        />
                      </td>
                      <td style={cellTdStyle}>
                        <InventoryCellInput
                          type="number"
                          min="0"
                          step="0.01"
                          align="right"
                          value={row.inflow_transfers_in}
                          onChange={(e) =>
                            updateProductRow(row._localKey, "inflow_transfers_in", e.target.value)
                          }
                        />
                      </td>
                      <td style={cellTdStyle}>
                        <InventoryCellInput
                          type="number"
                          min="0"
                          step="0.01"
                          align="right"
                          value={row.outflow_dispatch}
                          onChange={(e) =>
                            updateProductRow(row._localKey, "outflow_dispatch", e.target.value)
                          }
                        />
                      </td>
                      <td style={cellTdStyle}>
                        <InventoryCellInput
                          type="number"
                          min="0"
                          step="0.01"
                          align="right"
                          value={row.outflow_transfers_out}
                          onChange={(e) =>
                            updateProductRow(row._localKey, "outflow_transfers_out", e.target.value)
                          }
                        />
                      </td>
                      <td style={cellTdStyle}>
                        <InventoryCellInput
                          type="number"
                          min="0"
                          step="1"
                          align="right"
                          value={row.total_boxes}
                          onChange={(e) =>
                            updateProductRow(row._localKey, "total_boxes", e.target.value)
                          }
                        />
                      </td>
                      <td style={cellTdStyle}>
                        <InventoryCellInput
                          type="number"
                          min="0"
                          step="1"
                          align="right"
                          value={row.total_pieces}
                          onChange={(e) =>
                            updateProductRow(row._localKey, "total_pieces", e.target.value)
                          }
                        />
                      </td>
                      <td style={cellTdStyle}>
                        <InventoryReadCell
                          value={toFixed2(row.closing_balance)}
                          align="right"
                          danger={closingIsNegative}
                        />
                      </td>
                      <td style={cellTdStyle}>
                        <InventoryReadCell value={toFixed2(row.net_movement)} align="right" />
                      </td>
                      <td style={cellTdStyle}>
                        <InventoryCellInput
                          value={row.remarks}
                          onChange={(e) => updateProductRow(row._localKey, "remarks", e.target.value)}
                        />
                      </td>
                      <td style={cellTdStyle}>
                        <InventoryCellInput
                          value={row.checked_by_initials}
                          onChange={(e) =>
                            updateProductRow(
                              row._localKey,
                              "checked_by_initials",
                              e.target.value.toUpperCase()
                            )
                          }
                        />
                      </td>
                      <td style={cellTdStyle}>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            height: 28,
                            padding: "0 10px",
                            borderRadius: 999,
                            fontSize: 12,
                            fontWeight: 700,
                            color: row.is_existing ? GREEN : BLUE,
                            background: row.is_existing ? GREEN_SOFT : BLUE_SOFT,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {row.is_existing ? "Saved today" : "Carry-forward"}
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td
                    colSpan={showStoreColumn ? 17 : 16}
                    style={{
                      padding: 24,
                      textAlign: "center",
                      color: MUTED,
                      fontSize: 14,
                    }}
                  >
                    No product rows to display.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  function renderConsumableTable() {
    const showStoreColumn = isAllConsumableStoresSelected;

    return (
      <div
        style={{
          background: "#fff",
          border: `1px solid ${BORDER}`,
          borderRadius: 18,
          boxShadow: SHADOW,
          overflow: "hidden",
        }}
      >
        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "separate",
              borderSpacing: 0,
              minWidth: showStoreColumn ? 1230 : 1110,
            }}
          >
            <thead>
              <tr style={{ background: SOFT_2 }}>
                <th style={thStyle}>S/N</th>
                {showStoreColumn ? <th style={thStyle}>Store</th> : null}
                <th style={thStyle}>Category</th>
                <th style={thStyle}>Item</th>
                <th style={thStyle}>Unit</th>
                <th style={thStyle}>Opening</th>
                <th style={thStyle}>Issued Today</th>
                <th style={thStyle}>Closing</th>
                <th style={thStyle}>Remarks</th>
                <th style={thStyle}>Checked By</th>
                <th style={thStyle}>State</th>
              </tr>
            </thead>

            <tbody>
              {filteredConsumableRows.length ? (
                filteredConsumableRows.map((row, idx) => {
                  const closingIsNegative = asNumber(row.closing_balance) < 0;

                  return (
                    <tr key={row._localKey} style={{ background: closingIsNegative ? RED_SOFT : "#fff" }}>
                      <td style={cellTdStyle}>
                        <InventoryReadCell value={idx + 1} />
                      </td>
                      {showStoreColumn ? (
                        <td style={cellTdStyle}>
                          <InventoryReadCell value={row.store || ""} />
                        </td>
                      ) : null}
                      <td style={cellTdStyle}>
                        <InventoryReadCell value={row.item_category_name || ""} />
                      </td>
                      <td style={cellTdStyle}>
                        <InventoryReadCell value={row.item_name || ""} />
                      </td>
                      <td style={cellTdStyle}>
                        <InventoryReadCell value={row.unit || ""} />
                      </td>
                      <td style={cellTdStyle}>
                        <InventoryReadCell value={toFixed2(row.opening_balance)} align="right" />
                      </td>
                      <td style={cellTdStyle}>
                        <InventoryCellInput
                          type="number"
                          min="0"
                          step="0.01"
                          align="right"
                          value={row.issued_today}
                          onChange={(e) =>
                            updateConsumableRow(row._localKey, "issued_today", e.target.value)
                          }
                        />
                      </td>
                      <td style={cellTdStyle}>
                        <InventoryReadCell
                          value={toFixed2(row.closing_balance)}
                          align="right"
                          danger={closingIsNegative}
                        />
                      </td>
                      <td style={cellTdStyle}>
                        <InventoryCellInput
                          value={row.remarks}
                          onChange={(e) =>
                            updateConsumableRow(row._localKey, "remarks", e.target.value)
                          }
                        />
                      </td>
                      <td style={cellTdStyle}>
                        <InventoryCellInput
                          value={row.checked_by_initials}
                          onChange={(e) =>
                            updateConsumableRow(
                              row._localKey,
                              "checked_by_initials",
                              e.target.value.toUpperCase()
                            )
                          }
                        />
                      </td>
                      <td style={cellTdStyle}>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            height: 28,
                            padding: "0 10px",
                            borderRadius: 999,
                            fontSize: 12,
                            fontWeight: 700,
                            color: row.is_existing ? GREEN : BLUE,
                            background: row.is_existing ? GREEN_SOFT : BLUE_SOFT,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {row.is_existing ? "Saved today" : "Carry-forward"}
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td
                    colSpan={showStoreColumn ? 11 : 10}
                    style={{
                      padding: 24,
                      textAlign: "center",
                      color: MUTED,
                      fontSize: 14,
                    }}
                  >
                    No consumable rows to display.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (pageLoading) {
    return (
      <>
        <Head>
          <title>Daily Inventory Sheet</title>
        </Head>
        <div
          style={{
            minHeight: "100vh",
            background: PAGE_BG,
            padding: "24px 20px 40px",
            color: TEXT,
            fontFamily: "Arial, sans-serif",
          }}
        >
          Loading daily inventory page...
        </div>
      </>
    );
  }

  if (pageError) {
    return (
      <>
        <Head>
          <title>Daily Inventory Sheet</title>
        </Head>
        <div
          style={{
            minHeight: "100vh",
            background: PAGE_BG,
            padding: "24px 20px 40px",
            color: TEXT,
            fontFamily: "Arial, sans-serif",
          }}
        >
          <div
            style={{
              maxWidth: 1100,
              margin: "0 auto",
              border: `1px solid #fecaca`,
              background: RED_SOFT,
              color: RED,
              borderRadius: 16,
              padding: 18,
              fontWeight: 700,
            }}
          >
            {pageError}
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>Daily Inventory Sheet</title>
      </Head>

      <div
        style={{
          minHeight: "100vh",
          background: PAGE_BG,
          padding: "24px 20px 40px",
          color: TEXT,
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div style={{ maxWidth: 1650, margin: "0 auto" }}>
          <div style={{ marginBottom: 16 }}>
            <div
              style={{
                fontSize: 28,
                fontWeight: 800,
                color: TEXT,
                marginBottom: 6,
              }}
            >
              Daily Inventory Sheet
            </div>
            <div
              style={{
                fontSize: 14,
                color: MUTED,
                lineHeight: 1.5,
              }}
            >
              This version loads inventory from actual saved history only. It carries forward balances only for store-product and store-item combinations that already exist in the database, instead of assigning every active master item to every store.
            </div>
          </div>

          {renderNotice()}
          {renderTopControls()}

          {activeTab === "products" ? (
            <>
              <MetaBanner
                activeTab={activeTab}
                entryDate={entryDate}
                meta={productSheetMeta}
                selectedStoreValue={productStore}
                isAllStores={isAllProductStoresSelected}
              />
              {renderProductStats()}
              {renderProductTable()}
            </>
          ) : (
            <>
              <MetaBanner
                activeTab={activeTab}
                entryDate={entryDate}
                meta={consumableSheetMeta}
                selectedStoreValue={consumableStore}
                isAllStores={isAllConsumableStoresSelected}
              />
              {renderConsumableStats()}
              {renderConsumableTable()}
            </>
          )}
        </div>
      </div>
    </>
  );
}

const thStyle = {
  padding: "12px 10px",
  borderBottom: `1px solid ${BORDER}`,
  color: TEXT,
  fontSize: 13,
  fontWeight: 800,
  textAlign: "left",
  whiteSpace: "nowrap",
};

const cellTdStyle = {
  padding: "10px",
  borderBottom: `1px solid ${BORDER}`,
  verticalAlign: "middle",
};