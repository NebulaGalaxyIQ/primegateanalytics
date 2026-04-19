import Head from "next/head";
import { useEffect, useMemo, useRef, useState } from "react";

import InventoryService from "../../services/inventory";
import { getToken } from "../../services/auth";

const FONT_FAMILY = "Arial, sans-serif";

const PAGE_BG = "#ffffff";
const SURFACE = "#ffffff";
const BORDER = "#e5e7eb";
const BORDER_DARK = "#d1d5db";
const TEXT = "#111827";
const MUTED = "#6b7280";
const SOFT = "#f8fafc";
const SOFT_2 = "#f3f4f6";

const ORANGE = "#ff7a00";
const ORANGE_DEEP = "#e86a00";
const GREEN = "#15803d";
const GREEN_SOFT = "rgba(21,128,61,0.08)";
const RED = "#b91c1c";
const RED_SOFT = "rgba(185,28,28,0.08)";
const BLUE = "#2563eb";
const BLUE_SOFT = "rgba(37,99,235,0.10)";

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

    return asText(a.product_name)
      .toLowerCase()
      .localeCompare(asText(b.product_name).toLowerCase());
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

    return asText(a.item_name)
      .toLowerCase()
      .localeCompare(asText(b.item_name).toLowerCase());
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

function chipStyle(color, background) {
  return {
    display: "inline-flex",
    alignItems: "center",
    minHeight: 28,
    padding: "0 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
    color,
    background,
    whiteSpace: "nowrap",
  };
}

function FieldLabel({ children }) {
  return <div className="fieldLabel">{children}</div>;
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
      className="textInput"
    />
  );
}

function SelectInput({ value, onChange, children, disabled = false }) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={onChange}
      className="textInput"
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
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={variant === "secondary" ? "secondaryButton" : "primaryButton"}
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
      className="cellInput"
      style={{ textAlign: align }}
    />
  );
}

function InventoryReadCell({ value, align = "left", danger = false }) {
  return (
    <div
      className="readCell"
      style={{
        textAlign: align,
        color: danger ? RED : TEXT,
        fontWeight: danger ? 700 : 500,
      }}
    >
      {value}
    </div>
  );
}

function StateChip({ existing }) {
  return (
    <span
      style={chipStyle(existing ? GREEN : BLUE, existing ? GREEN_SOFT : BLUE_SOFT)}
    >
      {existing ? "Saved today" : "Carry-forward"}
    </span>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="statCard">
      <div className="statLabel">{label}</div>
      <div className="statValue">{value}</div>
    </div>
  );
}

function MetaBanner({
  activeTab,
  entryDate,
  meta,
  selectedStoreValue,
  isAllStores,
}) {
  const label = activeTab === "products" ? "product" : "consumable";
  const title = isAllStores
    ? `Continuous ${label} sheet loaded for ${meta?.storeCount || 0} stores`
    : `Continuous ${label} sheet loaded`;

  const subtitle = isAllStores
    ? "Only stores and items or products that already exist in inventory history are loaded. Nothing is auto-assigned to a store from master setup."
    : "Only rows already existing in this store history are loaded. Missing rows for today are carried forward from the latest previous closing balance.";

  return (
    <div className="metaBanner">
      <div className="metaBannerTitle">{title}</div>
      <div className="metaBannerText">{subtitle}</div>

      <div className="metaChipRow">
        <span style={chipStyle(BLUE, BLUE_SOFT)}>Date: {entryDate || "-"}</span>
        <span style={chipStyle(GREEN, GREEN_SOFT)}>
          Saved: {meta?.savedRows ?? 0}
        </span>
        <span style={chipStyle(BLUE, BLUE_SOFT)}>
          Carry-forward: {meta?.generatedRows ?? 0}
        </span>
        <span style={chipStyle(TEXT, SOFT_2)}>
          Mode: {isAllStores ? "All stores with history" : selectedStoreValue || "-"}
        </span>
      </div>
    </div>
  );
}

function MobileField({ label, children, full = false }) {
  return (
    <div className={`mobileField ${full ? "mobileFieldFull" : ""}`}>
      <div className="mobileFieldLabel">{label}</div>
      {children}
    </div>
  );
}

function ProductMobileCard({
  row,
  index,
  showStoreColumn,
  updateProductRow,
}) {
  const closingIsNegative = asNumber(row.closing_balance) < 0;

  return (
    <div
      className="mobileCard"
      style={{
        borderColor: closingIsNegative ? "#fecaca" : BORDER,
        background: closingIsNegative ? "#fff7f7" : "#fff",
      }}
    >
      <div className="mobileCardHeader">
        <div className="mobileCardTitleWrap">
          <div className="mobileCardTitle">
            {index + 1}. {row.product_name || "-"}
          </div>
          <div className="mobileCardSubtitle">
            {row.product_category_name || "-"}
          </div>
        </div>
        <StateChip existing={row.is_existing} />
      </div>

      <div className="mobileGrid">
        {showStoreColumn ? (
          <MobileField label="Store">
            <div className="mobileReadValue">{row.store || "-"}</div>
          </MobileField>
        ) : null}

        <MobileField label="Unit">
          <div className="mobileReadValue">{row.balance_unit || "-"}</div>
        </MobileField>

        <MobileField label="Opening">
          <div className="mobileReadValue alignRight">
            {toFixed2(row.opening_balance)}
          </div>
        </MobileField>

        <MobileField label="Production">
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
        </MobileField>

        <MobileField label="Transfers In">
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
        </MobileField>

        <MobileField label="Dispatch">
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
        </MobileField>

        <MobileField label="Transfers Out">
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
        </MobileField>

        <MobileField label="Boxes">
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
        </MobileField>

        <MobileField label="Pieces">
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
        </MobileField>

        <MobileField label="Closing">
          <div
            className="mobileReadValue alignRight"
            style={{ color: closingIsNegative ? RED : TEXT, fontWeight: 800 }}
          >
            {toFixed2(row.closing_balance)}
          </div>
        </MobileField>

        <MobileField label="Net">
          <div className="mobileReadValue alignRight">
            {toFixed2(row.net_movement)}
          </div>
        </MobileField>

        <MobileField label="Remarks" full>
          <InventoryCellInput
            value={row.remarks}
            onChange={(e) => updateProductRow(row._localKey, "remarks", e.target.value)}
          />
        </MobileField>

        <MobileField label="Checked By" full>
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
        </MobileField>
      </div>
    </div>
  );
}

function ConsumableMobileCard({
  row,
  index,
  showStoreColumn,
  updateConsumableRow,
}) {
  const closingIsNegative = asNumber(row.closing_balance) < 0;

  return (
    <div
      className="mobileCard"
      style={{
        borderColor: closingIsNegative ? "#fecaca" : BORDER,
        background: closingIsNegative ? "#fff7f7" : "#fff",
      }}
    >
      <div className="mobileCardHeader">
        <div className="mobileCardTitleWrap">
          <div className="mobileCardTitle">
            {index + 1}. {row.item_name || "-"}
          </div>
          <div className="mobileCardSubtitle">
            {row.item_category_name || "-"}
          </div>
        </div>
        <StateChip existing={row.is_existing} />
      </div>

      <div className="mobileGrid">
        {showStoreColumn ? (
          <MobileField label="Store">
            <div className="mobileReadValue">{row.store || "-"}</div>
          </MobileField>
        ) : null}

        <MobileField label="Unit">
          <div className="mobileReadValue">{row.unit || "-"}</div>
        </MobileField>

        <MobileField label="Opening">
          <div className="mobileReadValue alignRight">
            {toFixed2(row.opening_balance)}
          </div>
        </MobileField>

        <MobileField label="Issued Today">
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
        </MobileField>

        <MobileField label="Closing">
          <div
            className="mobileReadValue alignRight"
            style={{ color: closingIsNegative ? RED : TEXT, fontWeight: 800 }}
          >
            {toFixed2(row.closing_balance)}
          </div>
        </MobileField>

        <MobileField label="Remarks" full>
          <InventoryCellInput
            value={row.remarks}
            onChange={(e) =>
              updateConsumableRow(row._localKey, "remarks", e.target.value)
            }
          />
        </MobileField>

        <MobileField label="Checked By" full>
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
        </MobileField>
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

  const [productStore, setProductStore] = useState(ALL_STORES_VALUE);
  const [consumableStore, setConsumableStore] = useState(ALL_STORES_VALUE);

  const [productSheetMeta, setProductSheetMeta] = useState(null);
  const [consumableSheetMeta, setConsumableSheetMeta] = useState(null);

  const [productRows, setProductRows] = useState([]);
  const [consumableRows, setConsumableRows] = useState([]);

  const [productSearch, setProductSearch] = useState("");
  const [consumableSearch, setConsumableSearch] = useState("");

  const [showOnlyProductMovement, setShowOnlyProductMovement] = useState(false);
  const [showOnlyConsumableMovement, setShowOnlyConsumableMovement] =
    useState(false);

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
      setNotice({
        type: "error",
        text: "Please select a product store or choose All stores.",
      });
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

      const result = buildProductHistoryRows(
        entries,
        entryDate,
        selectedStoreValue
      );

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
            ? "Loaded only this store historical products and carried forward the latest closing balances."
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
      setNotice({
        type: "error",
        text: "Please select a consumable store or choose All stores.",
      });
      return;
    }

    setConsumableLoading(true);
    setNotice({ type: "", text: "" });

    try {
      const selectedStoreValue = isAllConsumableStoresSelected
        ? null
        : consumableStore;

      const entries = await fetchAllPaged("/inventory/consumable-store/entries", {
        end_date: entryDate,
        ...(selectedStoreValue ? { store: selectedStoreValue } : {}),
      });

      const result = buildConsumableHistoryRows(
        entries,
        entryDate,
        selectedStoreValue
      );

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
            ? "Loaded only this store historical consumables and carried forward the latest closing balances."
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
        className="noticeBanner"
        style={{
          borderColor: isError ? "#fecaca" : "#bbf7d0",
          background: isError ? RED_SOFT : GREEN_SOFT,
          color: isError ? RED : GREEN,
        }}
      >
        {notice.text}
      </div>
    );
  }

  function renderTopControls() {
    const isProducts = activeTab === "products";

    return (
      <div className="panel">
        <div className="topGrid">
          <div className="fieldBlock">
            <FieldLabel>Entry Date</FieldLabel>
            <div className="dateRow">
              <ActionButton
                variant="secondary"
                onClick={() =>
                  setEntryDate((prev) => shiftDateInputValue(prev, -1))
                }
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
                onClick={() =>
                  setEntryDate((prev) => shiftDateInputValue(prev, 1))
                }
              >
                Next
              </ActionButton>
            </div>
          </div>

          <div className="fieldBlock">
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
              {(isProducts ? productStoreOptions : consumableStoreOptions).map(
                (option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                )
              )}
            </SelectInput>
          </div>

          <div className="fieldBlock">
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

          <div className="actionBlock">
            <ActionButton
              onClick={isProducts ? handleLoadProductSheet : handleLoadConsumableSheet}
              disabled={isProducts ? productLoading : consumableLoading}
              variant="secondary"
            >
              {isProducts
                ? productLoading
                  ? "Loading..."
                  : "Load Sheet"
                : consumableLoading
                ? "Loading..."
                : "Load Sheet"}
            </ActionButton>

            <ActionButton
              onClick={isProducts ? handleSaveProductSheet : handleSaveConsumableSheet}
              disabled={isProducts ? productSaving : consumableSaving}
            >
              {isProducts
                ? productSaving
                  ? "Saving..."
                  : "Save All"
                : consumableSaving
                ? "Saving..."
                : "Save All"}
            </ActionButton>
          </div>
        </div>

        <div className="controlFooter">
          <div className="tabRow">
            <button
              type="button"
              onClick={() => setActiveTab("products")}
              className={`tabButton ${activeTab === "products" ? "tabButtonActive" : ""}`}
            >
              Product Sheet
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("consumables")}
              className={`tabButton ${activeTab === "consumables" ? "tabButtonActive" : ""}`}
            >
              Consumable Sheet
            </button>
          </div>

          <label className="checkboxRow">
            <input
              type="checkbox"
              checked={
                activeTab === "products"
                  ? showOnlyProductMovement
                  : showOnlyConsumableMovement
              }
              onChange={(e) =>
                activeTab === "products"
                  ? setShowOnlyProductMovement(e.target.checked)
                  : setShowOnlyConsumableMovement(e.target.checked)
              }
            />
            <span>Show only rows with movement</span>
          </label>
        </div>
      </div>
    );
  }

  function renderProductStats() {
    return (
      <div className="statsGrid">
        <StatCard label="Stores Loaded" value={productSheetMeta?.storeCount ?? 0} />
        <StatCard
          label="Rows"
          value={productSheetMeta?.totalRows ?? productRows.length}
        />
        <StatCard label="Saved Rows" value={productSheetMeta?.savedRows ?? 0} />
        <StatCard
          label="Carry-forward"
          value={productSheetMeta?.generatedRows ?? 0}
        />
        <StatCard label="Opening Total" value={toFixed2(productSummary.opening)} />
        <StatCard label="Closing Total" value={toFixed2(productSummary.closing)} />
      </div>
    );
  }

  function renderConsumableStats() {
    return (
      <div className="statsGrid">
        <StatCard
          label="Stores Loaded"
          value={consumableSheetMeta?.storeCount ?? 0}
        />
        <StatCard
          label="Rows"
          value={consumableSheetMeta?.totalRows ?? consumableRows.length}
        />
        <StatCard
          label="Saved Rows"
          value={consumableSheetMeta?.savedRows ?? 0}
        />
        <StatCard
          label="Carry-forward"
          value={consumableSheetMeta?.generatedRows ?? 0}
        />
        <StatCard
          label="Opening Total"
          value={toFixed2(consumableSummary.opening)}
        />
        <StatCard
          label="Closing Total"
          value={toFixed2(consumableSummary.closing)}
        />
      </div>
    );
  }

  function renderProductTable() {
    const showStoreColumn = isAllProductStoresSelected;

    return (
      <>
        <div className="tablePanel desktopOnly">
          <div className="tableWrap">
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
                      <tr
                        key={row._localKey}
                        style={{ background: closingIsNegative ? RED_SOFT : "#fff" }}
                      >
                        <td style={cellTdStyle}>
                          <InventoryReadCell value={idx + 1} />
                        </td>

                        {showStoreColumn ? (
                          <td style={cellTdStyle}>
                            <InventoryReadCell value={row.store || ""} />
                          </td>
                        ) : null}

                        <td style={cellTdStyle}>
                          <InventoryReadCell
                            value={row.product_category_name || ""}
                          />
                        </td>

                        <td style={cellTdStyle}>
                          <InventoryReadCell value={row.product_name || ""} />
                        </td>

                        <td style={cellTdStyle}>
                          <InventoryReadCell value={row.balance_unit || ""} />
                        </td>

                        <td style={cellTdStyle}>
                          <InventoryReadCell
                            value={toFixed2(row.opening_balance)}
                            align="right"
                          />
                        </td>

                        <td style={cellTdStyle}>
                          <InventoryCellInput
                            type="number"
                            min="0"
                            step="0.01"
                            align="right"
                            value={row.inflow_production}
                            onChange={(e) =>
                              updateProductRow(
                                row._localKey,
                                "inflow_production",
                                e.target.value
                              )
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
                              updateProductRow(
                                row._localKey,
                                "inflow_transfers_in",
                                e.target.value
                              )
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
                              updateProductRow(
                                row._localKey,
                                "outflow_dispatch",
                                e.target.value
                              )
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
                              updateProductRow(
                                row._localKey,
                                "outflow_transfers_out",
                                e.target.value
                              )
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
                              updateProductRow(
                                row._localKey,
                                "total_boxes",
                                e.target.value
                              )
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
                              updateProductRow(
                                row._localKey,
                                "total_pieces",
                                e.target.value
                              )
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
                          <InventoryReadCell
                            value={toFixed2(row.net_movement)}
                            align="right"
                          />
                        </td>

                        <td style={cellTdStyle}>
                          <InventoryCellInput
                            value={row.remarks}
                            onChange={(e) =>
                              updateProductRow(
                                row._localKey,
                                "remarks",
                                e.target.value
                              )
                            }
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
                          <StateChip existing={row.is_existing} />
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td
                      colSpan={showStoreColumn ? 17 : 16}
                      style={emptyCellStyle}
                    >
                      No product rows to display.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mobileOnly">
          {filteredProductRows.length ? (
            <div className="mobileCardList">
              {filteredProductRows.map((row, idx) => (
                <ProductMobileCard
                  key={row._localKey}
                  row={row}
                  index={idx}
                  showStoreColumn={showStoreColumn}
                  updateProductRow={updateProductRow}
                />
              ))}
            </div>
          ) : (
            <div className="emptyCard">No product rows to display.</div>
          )}
        </div>
      </>
    );
  }

  function renderConsumableTable() {
    const showStoreColumn = isAllConsumableStoresSelected;

    return (
      <>
        <div className="tablePanel desktopOnly">
          <div className="tableWrap">
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
                      <tr
                        key={row._localKey}
                        style={{ background: closingIsNegative ? RED_SOFT : "#fff" }}
                      >
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
                          <InventoryReadCell
                            value={toFixed2(row.opening_balance)}
                            align="right"
                          />
                        </td>

                        <td style={cellTdStyle}>
                          <InventoryCellInput
                            type="number"
                            min="0"
                            step="0.01"
                            align="right"
                            value={row.issued_today}
                            onChange={(e) =>
                              updateConsumableRow(
                                row._localKey,
                                "issued_today",
                                e.target.value
                              )
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
                              updateConsumableRow(
                                row._localKey,
                                "remarks",
                                e.target.value
                              )
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
                          <StateChip existing={row.is_existing} />
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td
                      colSpan={showStoreColumn ? 11 : 10}
                      style={emptyCellStyle}
                    >
                      No consumable rows to display.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mobileOnly">
          {filteredConsumableRows.length ? (
            <div className="mobileCardList">
              {filteredConsumableRows.map((row, idx) => (
                <ConsumableMobileCard
                  key={row._localKey}
                  row={row}
                  index={idx}
                  showStoreColumn={showStoreColumn}
                  updateConsumableRow={updateConsumableRow}
                />
              ))}
            </div>
          ) : (
            <div className="emptyCard">No consumable rows to display.</div>
          )}
        </div>
      </>
    );
  }

  if (pageLoading) {
    return (
      <>
        <Head>
          <title>Daily Inventory Sheet</title>
        </Head>

        <div className="pageShell">
          <div className="pageContainer">Loading daily inventory page...</div>
        </div>

        <style jsx>{pageStyles}</style>
      </>
    );
  }

  if (pageError) {
    return (
      <>
        <Head>
          <title>Daily Inventory Sheet</title>
        </Head>

        <div className="pageShell">
          <div className="pageContainer">
            <div
              className="noticeBanner"
              style={{
                borderColor: "#fecaca",
                background: RED_SOFT,
                color: RED,
                fontWeight: 700,
              }}
            >
              {pageError}
            </div>
          </div>
        </div>

        <style jsx>{pageStyles}</style>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>Daily Inventory Sheet</title>
      </Head>

      <div className="pageShell">
        <div className="pageContainer">
          <div className="hero">
            <div className="heroTitle">Daily Inventory Sheet</div>
            <div className="heroText">
              This version loads inventory from actual saved history only. It carries
              forward balances only for store-product and store-item combinations
              that already exist in the database, instead of assigning every active
              master item to every store.
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

      <style jsx>{pageStyles}</style>
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

const emptyCellStyle = {
  padding: 24,
  textAlign: "center",
  color: MUTED,
  fontSize: 14,
};

const pageStyles = `
  .pageShell {
    min-height: 100vh;
    background: ${PAGE_BG};
    color: ${TEXT};
    font-family: ${FONT_FAMILY};
  }

  .pageContainer {
    max-width: 1650px;
    margin: 0 auto;
    padding: 24px 20px 40px;
    box-sizing: border-box;
  }

  .hero {
    margin-bottom: 16px;
  }

  .heroTitle {
    font-size: 28px;
    font-weight: 800;
    color: ${TEXT};
    margin-bottom: 6px;
    line-height: 1.2;
  }

  .heroText {
    font-size: 14px;
    color: ${MUTED};
    line-height: 1.55;
    max-width: 1100px;
  }

  .noticeBanner {
    margin-bottom: 16px;
    border: 1px solid;
    border-radius: 14px;
    padding: 12px 14px;
    font-size: 14px;
    font-weight: 600;
    line-height: 1.5;
  }

  .panel,
  .tablePanel,
  .metaBanner {
    background: ${SURFACE};
    border: 1px solid ${BORDER};
    border-radius: 18px;
    box-shadow: ${SHADOW};
  }

  .panel {
    padding: 16px;
    margin-bottom: 18px;
  }

  .tablePanel {
    overflow: hidden;
  }

  .metaBanner {
    padding: 12px 14px;
    margin-bottom: 14px;
  }

  .metaBannerTitle {
    font-size: 14px;
    font-weight: 800;
    color: ${TEXT};
    margin-bottom: 4px;
  }

  .metaBannerText {
    font-size: 13px;
    color: ${MUTED};
    line-height: 1.5;
    margin-bottom: 8px;
  }

  .metaChipRow {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .topGrid {
    display: grid;
    grid-template-columns: 1.6fr 1fr 1fr auto;
    gap: 14px;
    align-items: end;
  }

  .fieldBlock {
    min-width: 0;
  }

  .fieldLabel {
    font-size: 12px;
    color: ${MUTED};
    margin-bottom: 6px;
    font-weight: 700;
  }

  .textInput {
    width: 100%;
    height: 42px;
    border: 1px solid ${BORDER_DARK};
    border-radius: 12px;
    padding: 0 12px;
    outline: none;
    font-size: 14px;
    color: ${TEXT};
    background: #fff;
    box-sizing: border-box;
    font-family: ${FONT_FAMILY};
  }

  .textInput:disabled {
    background: ${SOFT_2};
  }

  .dateRow {
    display: grid;
    grid-template-columns: auto 1fr auto;
    gap: 8px;
    align-items: center;
  }

  .actionBlock {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-start;
  }

  .primaryButton,
  .secondaryButton {
    height: 42px;
    padding: 0 16px;
    border-radius: 12px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 700;
    font-family: ${FONT_FAMILY};
    transition: background 0.2s ease, border-color 0.2s ease, color 0.2s ease;
  }

  .primaryButton {
    background: ${ORANGE};
    color: #fff;
    border: 1px solid ${ORANGE};
  }

  .primaryButton:hover:not(:disabled) {
    background: ${ORANGE_DEEP};
    border-color: ${ORANGE_DEEP};
  }

  .secondaryButton {
    background: #fff;
    color: ${TEXT};
    border: 1px solid ${BORDER_DARK};
  }

  .primaryButton:disabled,
  .secondaryButton:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .controlFooter {
    margin-top: 14px;
    display: flex;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
    align-items: center;
  }

  .tabRow {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .tabButton {
    min-height: 40px;
    padding: 0 16px;
    border-radius: 999px;
    border: 1px solid ${BORDER_DARK};
    background: #fff;
    color: ${TEXT};
    font-weight: 700;
    cursor: pointer;
    font-family: ${FONT_FAMILY};
  }

  .tabButtonActive {
    border-color: ${ORANGE};
    background: ${ORANGE};
    color: #fff;
  }

  .checkboxRow {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    color: ${MUTED};
    font-size: 13px;
    font-weight: 600;
    flex-wrap: wrap;
  }

  .statsGrid {
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    gap: 12px;
    margin-bottom: 14px;
  }

  .statCard {
    border: 1px solid ${BORDER};
    background: #fff;
    border-radius: 14px;
    padding: 14px;
    min-width: 0;
  }

  .statLabel {
    color: ${MUTED};
    font-size: 12px;
    margin-bottom: 6px;
    font-weight: 600;
  }

  .statValue {
    color: ${TEXT};
    font-size: 18px;
    font-weight: 800;
    line-height: 1.2;
    word-break: break-word;
  }

  .tableWrap {
    overflow-x: auto;
    overflow-y: hidden;
    width: 100%;
    -webkit-overflow-scrolling: touch;
  }

  .cellInput {
    width: 100%;
    height: 36px;
    border: 1px solid ${BORDER};
    border-radius: 8px;
    padding: 0 8px;
    outline: none;
    font-size: 13px;
    color: ${TEXT};
    background: #fff;
    box-sizing: border-box;
    font-family: ${FONT_FAMILY};
  }

  .readCell {
    font-size: 13px;
    white-space: nowrap;
  }

  .desktopOnly {
    display: block;
  }

  .mobileOnly {
    display: none;
  }

  .mobileCardList {
    display: grid;
    gap: 12px;
  }

  .mobileCard {
    border: 1px solid ${BORDER};
    border-radius: 16px;
    padding: 14px;
    box-shadow: ${SHADOW};
  }

  .mobileCardHeader {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    align-items: flex-start;
    flex-wrap: wrap;
    margin-bottom: 12px;
  }

  .mobileCardTitleWrap {
    min-width: 0;
    flex: 1 1 220px;
  }

  .mobileCardTitle {
    font-size: 15px;
    font-weight: 800;
    color: ${TEXT};
    line-height: 1.35;
    word-break: break-word;
  }

  .mobileCardSubtitle {
    font-size: 13px;
    color: ${MUTED};
    margin-top: 3px;
    line-height: 1.45;
    word-break: break-word;
  }

  .mobileGrid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }

  .mobileField {
    min-width: 0;
  }

  .mobileFieldFull {
    grid-column: 1 / -1;
  }

  .mobileFieldLabel {
    font-size: 11px;
    color: ${MUTED};
    margin-bottom: 6px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.02em;
  }

  .mobileReadValue {
    min-height: 36px;
    display: flex;
    align-items: center;
    font-size: 13px;
    color: ${TEXT};
    font-weight: 600;
    line-height: 1.45;
    word-break: break-word;
  }

  .alignRight {
    justify-content: flex-end;
    text-align: right;
  }

  .emptyCard {
    border: 1px solid ${BORDER};
    background: #fff;
    border-radius: 16px;
    padding: 24px;
    text-align: center;
    color: ${MUTED};
    font-size: 14px;
    box-shadow: ${SHADOW};
  }

  @media (max-width: 1300px) {
    .topGrid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .statsGrid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }

  @media (max-width: 900px) {
    .desktopOnly {
      display: none;
    }

    .mobileOnly {
      display: block;
    }

    .pageContainer {
      padding: 18px 14px 28px;
    }

    .heroTitle {
      font-size: 24px;
    }

    .topGrid {
      grid-template-columns: 1fr;
    }

    .dateRow {
      grid-template-columns: 1fr;
    }

    .actionBlock {
      display: grid;
      grid-template-columns: 1fr 1fr;
    }

    .statsGrid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .mobileGrid {
      grid-template-columns: 1fr 1fr;
    }
  }

  @media (max-width: 640px) {
    .heroTitle {
      font-size: 22px;
    }

    .heroText {
      font-size: 13px;
    }

    .panel {
      padding: 14px;
    }

    .controlFooter {
      align-items: stretch;
    }

    .tabRow {
      width: 100%;
    }

    .tabButton {
      flex: 1 1 0;
      text-align: center;
    }

    .checkboxRow {
      width: 100%;
    }

    .actionBlock {
      grid-template-columns: 1fr;
    }

    .statsGrid {
      grid-template-columns: 1fr;
    }

    .mobileGrid {
      grid-template-columns: 1fr;
      gap: 10px;
    }

    .mobileFieldFull {
      grid-column: auto;
    }
  }
`;