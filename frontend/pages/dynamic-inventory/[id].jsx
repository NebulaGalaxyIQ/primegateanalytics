import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useCallback, useEffect, useMemo, useState } from "react";

const DEFAULT_API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  "http://127.0.0.1:8000";

const INVENTORY_BASE = "/inventory-systems";

const DEPARTMENT_META = {
  crops: {
    label: "Crops Department",
    shortLabel: "Crops",
    icon: "☘",
    tone: "green",
    description: "Track crop inventory levels, harvests, sales, and adjustments by field and variety.",
  },
  animals: {
    label: "Animals Department",
    shortLabel: "Animals",
    icon: "♞",
    tone: "amber",
    description: "Track animal stock, births, deaths, purchases, sales, feed, vaccination, and treatment records.",
  },
  machinery: {
    label: "Machineries & Maintenance",
    shortLabel: "Machinery",
    icon: "⚙",
    tone: "blue",
    description: "Track machinery inventory, fuel usage, service records, repairs, spare parts, and running hours.",
  },
};

const IMPORTANT_FIELD_KEYS = [
  "crop_type",
  "crop_variety",
  "field_or_plot",
  "animal_type",
  "breed",
  "animal_category",
  "machine_name",
  "machine_type",
  "asset_code",
  "tag_number",
  "record_date",
  "opening_stock",
  "opening_balance",
  "harvested",
  "born",
  "bought",
  "purchased",
  "sold",
  "used",
  "damaged",
  "died",
  "fuel_used",
  "running_hours",
  "closing_stock",
  "current_balance",
  "sales_value",
  "amount",
  "total_amount",
  "status",
  "record_status",
  "notes",
];

const LOOKUP_FALLBACKS = {
  animal_type: ["Goat", "Cattle", "Sheep", "Poultry", "Pig", "Donkey", "Horse", "Other"],
  animal_breed: ["Boer", "Kiko", "Saanen", "Toggenburg", "Angus", "Hereford", "Boran", "Friesian", "Ayrshire", "Dorper", "Merino", "Rhode Island Red", "Broiler", "Layer", "Local Breed", "Mixed", "Other"],
  animal_category: ["Adult Male", "Adult Female", "Young Male", "Young Female", "Newborn", "Kid", "Calf", "Lamb", "Chick", "Breeding Stock", "Other"],
  crop_type: ["Maize", "Wheat", "Rice", "Beans", "Soybeans", "Sorghum", "Sunflower", "Barley", "Oats", "Cotton", "Potatoes", "Tomatoes", "Onions", "Vegetables", "Other"],
  crop_variety: ["Pioneer 3396", "WH 542", "SB 2231", "Sorgo 506", "SF 101", "BRS 180", "OS 120", "CCRI 60", "Local Variety", "Hybrid", "Other"],
  field_or_plot: ["Field 1A", "Field 1B", "Field 2A", "Field 3A", "Field 4C", "Field 5A", "Field 6B", "Field 7B", "Field 8A", "Main Farm", "North Field", "South Field", "East Plot", "West Plot"],
  machine_type: ["Tractor", "Harvester", "Truck", "Irrigation Pump", "Generator", "ATV", "Sprayer", "Plough", "Trailer", "Other"],
  machine_name: ["Tractor #12", "Harvester #7", "Truck #4", "Irrigation Pump #2", "Generator #1", "ATV #3", "Sprayer #1", "Other"],
  feed_type: ["Hay", "Silage", "Pellets", "Bran", "Dairy Meal", "Grower Mash", "Layers Mash", "Broiler Starter", "Mineral Supplement", "Other"],
  fertilizer_type: ["Urea", "DAP", "NPK", "CAN", "Compost", "Manure", "Lime", "Foliar Fertilizer", "Other"],
  chemical_type: ["Herbicide", "Pesticide", "Fungicide", "Insecticide", "Disinfectant", "Other"],
  seed_type: ["Maize Seed", "Wheat Seed", "Rice Seed", "Bean Seed", "Soybean Seed", "Vegetable Seed", "Other"],
  supplier: ["PrimeGate Supplier", "Local Supplier", "Agrovet", "Cooperative", "Other"],
  customer: ["Local Market", "Wholesale Buyer", "Retail Buyer", "Processor", "Other"],
  operator: ["Ranch Manager", "Machine Operator", "Farm Worker", "Technician", "Other"],
  technician: ["Internal Technician", "External Mechanic", "Service Provider", "Other"],
  unit: ["heads", "kg", "bags", "litres", "gal", "hours", "units", "TZS", "USD", "acres", "ha"],
  location: ["Main Yard", "North Field", "South Field", "East Pivot", "West Plot", "Store", "Workshop", "Barn", "Other"],
  operating_hours: ["0.5", "1", "1.5", "2", "2.5", "3", "4", "5", "6", "7", "8", "10", "12"],
};

const FIELD_KEY_FALLBACKS = {
  breed: LOOKUP_FALLBACKS.animal_breed,
  animal_type: LOOKUP_FALLBACKS.animal_type,
  animal_category: LOOKUP_FALLBACKS.animal_category,
  crop_type: LOOKUP_FALLBACKS.crop_type,
  crop_variety: LOOKUP_FALLBACKS.crop_variety,
  field_or_plot: LOOKUP_FALLBACKS.field_or_plot,
  machine_type: LOOKUP_FALLBACKS.machine_type,
  machine_name: LOOKUP_FALLBACKS.machine_name,
  asset_code: ["TR-001", "HV-007", "TK-004", "PMP-002", "GEN-001", "ATV-003"],
  tag_number: ["TAG-001", "TAG-002", "TAG-003", "TAG-004", "TAG-005"],
  running_hours: LOOKUP_FALLBACKS.operating_hours,
  machine_running_hours: LOOKUP_FALLBACKS.operating_hours,
  operating_hours: LOOKUP_FALLBACKS.operating_hours,
  operator_hours: LOOKUP_FALLBACKS.operating_hours,
  record_status: ["Active", "Recorded", "Pending", "Submitted", "Approved", "Completed", "Draft", "Rejected"],
  status: ["Active", "Recorded", "Pending", "Submitted", "Approved", "Completed", "Draft", "Rejected"],
  unit: LOOKUP_FALLBACKS.unit,
  location: LOOKUP_FALLBACKS.location,
};

function isBrowser() {
  return typeof window !== "undefined";
}

function getStoredToken() {
  if (!isBrowser()) return "";
  const keys = ["access_token", "accessToken", "token", "authToken", "pg_access_token"];
  for (const key of keys) {
    const value = window.localStorage.getItem(key) || window.sessionStorage.getItem(key);
    if (value) return value.replace(/^Bearer\s+/i, "");
  }
  try {
    const rawAuth =
      window.localStorage.getItem("auth") ||
      window.localStorage.getItem("user") ||
      window.localStorage.getItem("primegate_auth");
    if (rawAuth) {
      const parsed = JSON.parse(rawAuth);
      return (
        parsed?.access_token ||
        parsed?.accessToken ||
        parsed?.token ||
        parsed?.jwt ||
        ""
      ).replace(/^Bearer\s+/i, "");
    }
  } catch (_) {
    // Ignore malformed storage.
  }
  return "";
}

function getStoredUser() {
  if (!isBrowser()) return null;
  const keys = ["user", "auth_user", "current_user", "primegate_user", "auth"];
  for (const key of keys) {
    try {
      const raw = window.localStorage.getItem(key) || window.sessionStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (parsed?.user) return parsed.user;
      if (parsed?.id || parsed?.user_id || parsed?.role || parsed?.email) return parsed;
    } catch (_) {
      // Continue.
    }
  }
  return null;
}

function getCurrentUserId() {
  const user = getStoredUser();
  return user?.id || user?.user_id || 1;
}

function isCurrentUserAdmin() {
  const user = getStoredUser();
  const role = String(user?.role || "").toLowerCase();
  return Boolean(user?.is_superuser || user?.is_admin || role === "admin" || role === "superadmin" || !user);
}

function buildQuery(params = {}) {
  const search = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (item !== undefined && item !== null && item !== "") search.append(key, String(item));
      });
      return;
    }
    search.set(key, String(value));
  });
  const query = search.toString();
  return query ? `?${query}` : "";
}

function normalizeError(payload) {
  if (!payload) return "Request failed.";
  if (typeof payload === "string") return payload;
  if (typeof payload.detail === "string") return payload.detail;
  if (Array.isArray(payload.detail)) return payload.detail.map((item) => item?.msg || item?.message || JSON.stringify(item)).join("; ");
  if (payload.message) return payload.message;
  if (payload.error) return payload.error;
  return JSON.stringify(payload);
}

async function apiRequest(path, options = {}) {
  const {
    method = "GET",
    body,
    blob = false,
    headers = {},
    apiBase = DEFAULT_API_BASE,
  } = options;

  const token = getStoredToken();
  const finalHeaders = {
    Accept: blob ? "*/*" : "application/json",
    "X-User-Id": String(getCurrentUserId()),
    "X-Is-Admin": String(isCurrentUserAdmin()),
    ...headers,
  };

  let finalBody = body;
  const hasBody = body !== undefined && body !== null;
  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;
  if (hasBody && !isFormData && typeof body !== "string" && !(body instanceof Blob)) {
    finalHeaders["Content-Type"] = finalHeaders["Content-Type"] || "application/json";
    finalBody = JSON.stringify(body);
  } else if (hasBody && typeof body === "string") {
    finalHeaders["Content-Type"] = finalHeaders["Content-Type"] || "application/json";
  }
  if (token) finalHeaders.Authorization = `Bearer ${token}`;

  const response = await fetch(`${apiBase}${path}`, {
    method,
    headers: finalHeaders,
    body: finalBody,
  });

  if (blob) {
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(text || response.statusText || "Download failed.");
    }
    return response.blob();
  }

  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json")
    ? await response.json().catch(() => null)
    : await response.text().catch(() => "");

  if (!response.ok) {
    const err = new Error(normalizeError(payload));
    err.status = response.status;
    err.payload = payload;
    throw err;
  }
  return payload;
}

function downloadBlob(blob, filename) {
  if (!isBrowser()) return;
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function todayIsoDate() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function firstOfMonthIso() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${yyyy}-${mm}-01`;
}

function endOfMonthIso() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const last = new Date(yyyy, d.getMonth() + 1, 0).getDate();
  return `${yyyy}-${mm}-${String(last).padStart(2, "0")}`;
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function titleCase(value) {
  return String(value || "")
    .replace(/_/g, " ")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatDate(value) {
  if (!value) return "—";
  try {
    const date = new Date(String(value).slice(0, 10));
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(date);
  } catch (_) {
    return String(value);
  }
}

function formatDateTime(value) {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch (_) {
    return String(value);
  }
}

function formatNumber(value, options = {}) {
  if (value === undefined || value === null || value === "") return "0";
  const number = Number(String(value).replace(/,/g, ""));
  if (!Number.isFinite(number)) return String(value);
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: options.decimals ?? 2,
    minimumFractionDigits: options.minimumFractionDigits ?? 0,
  }).format(number);
}

function formatCurrency(value, currency = "TZS") {
  if (value === undefined || value === null || value === "") return "0";
  const number = Number(String(value).replace(/,/g, ""));
  if (!Number.isFinite(number)) return String(value);
  if (currency === "TZS") return `TZS ${formatNumber(number, { decimals: 0 })}`;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(number);
}

function valueFromCell(cell) {
  if (!cell || typeof cell !== "object") return "";
  if (cell.display_value !== undefined && cell.display_value !== null) return cell.display_value;
  if (cell.value_number !== undefined && cell.value_number !== null) return cell.value_number;
  if (cell.value_text !== undefined && cell.value_text !== null) return cell.value_text;
  if (cell.value_date !== undefined && cell.value_date !== null) return cell.value_date;
  if (cell.value_boolean !== undefined && cell.value_boolean !== null) return cell.value_boolean ? "Yes" : "No";
  if (cell.value_json !== undefined && cell.value_json !== null) return cell.value_json;
  return "";
}

function getRowValues(row = {}) {
  const values = asObject(row.values);
  if (Object.keys(values).length) return values;

  const output = {};
  safeArray(row.value_items).forEach((cell) => {
    const key = cell?.field_key || cell?.field?.field_key || cell?.field_id;
    if (key) output[key] = valueFromCell(cell);
  });
  return output;
}

function getCellDisplay(row, field) {
  const values = getRowValues(row);
  const raw = values[field.field_key];
  if (raw === undefined || raw === null || raw === "") return "—";
  if (field.field_type === "currency") return formatCurrency(raw, String(field.unit_label || "TZS").toUpperCase() === "USD" ? "USD" : "TZS");
  if (["number", "integer", "decimal", "percentage"].includes(field.field_type)) return formatNumber(raw);
  if (["date", "datetime"].includes(field.field_type)) return formatDate(raw);
  if (Array.isArray(raw)) return raw.join(", ");
  if (typeof raw === "object") return JSON.stringify(raw);
  return String(raw);
}

function getNumericValue(row, key) {
  const value = getRowValues(row)[key];
  const number = Number(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(number) ? number : 0;
}

function sumField(rows, key) {
  return safeArray(rows).reduce((sum, row) => sum + getNumericValue(row, key), 0);
}

function getSummaryValue(period, rows, candidates = []) {
  const summary = asObject(period?.summary || period?.summary_json);
  const inputTotals = asObject(summary.input_totals);
  const outputTotals = asObject(summary.output_totals);
  const metrics = safeArray(summary.metrics);

  for (const key of candidates) {
    if (inputTotals[key] !== undefined && inputTotals[key] !== null) return inputTotals[key];
    if (outputTotals[key] !== undefined && outputTotals[key] !== null) return outputTotals[key];
    const metric = metrics.find((item) => item.metric_key === key || item.field_key === key || item.label === key);
    if (metric && metric.value !== undefined && metric.value !== null) return metric.value;
  }

  return sumField(rows, candidates[0]);
}

function firstExistingNumericValue(row, keys = []) {
  for (const key of keys) {
    const value = getNumericValue(row, key);
    if (value) return value;
  }
  return 0;
}

function makeSeries(rows, keys = [], fallbackCount = 6) {
  const source = safeArray(rows).slice(-fallbackCount);
  const list = source.length ? source : Array.from({ length: fallbackCount }, (_, index) => ({ row_number: index + 1, values: {} }));
  return list.map((row, index) => ({
    label: row.record_date || row.period_date || getRowValues(row).record_date || `R${row.row_number || index + 1}`,
    value: firstExistingNumericValue(row, keys),
  }));
}

function makePolylinePoints(data, width = 240, height = 92) {
  const list = safeArray(data);
  const max = Math.max(...list.map((item) => Number(item.value) || 0), 1);
  const step = list.length > 1 ? width / (list.length - 1) : width;
  return list.map((item, index) => {
    const x = index * step;
    const y = height - ((Number(item.value) || 0) / max) * (height - 12) - 6;
    return `${x},${y}`;
  }).join(' ');
}

function statusLabel(value) {
  return titleCase(value || "draft");
}

function statusClass(value) {
  const raw = String(value || "draft").toLowerCase();
  if (["active", "approved", "recorded", "completed", "locked"].includes(raw)) return "success";
  if (["submitted", "pending", "under_review"].includes(raw)) return "warning";
  if (["rejected", "failed", "critical", "open"].includes(raw)) return "danger";
  return "muted";
}

function normalizeDepartment(department) {
  const key = String(department || "").toLowerCase();
  return DEPARTMENT_META[key] || {
    label: titleCase(department || "General Department"),
    shortLabel: titleCase(department || "General"),
    icon: "▣",
    tone: "green",
    description: "Inventory records and system-calculated summaries.",
  };
}

function fieldPriority(field) {
  const keyIndex = IMPORTANT_FIELD_KEYS.indexOf(field.field_key);
  const typeBonus = field.is_dashboard_visible ? -20 : 0;
  return (keyIndex >= 0 ? keyIndex : 1000) + typeBonus + Number(field.order_index || 0) / 100;
}

function getVisibleFields(fields, limit = 9) {
  const clean = safeArray(fields).filter((field) => {
    if (field.deleted_at || field.is_archived || field.is_active === false) return false;
    if (field.is_report_visible === false && field.is_dashboard_visible === false) return false;
    return true;
  });
  return clean.sort((a, b) => fieldPriority(a) - fieldPriority(b)).slice(0, limit);
}

function getInputFields(fields) {
  return safeArray(fields)
    .filter((field) => {
      if (field.deleted_at || field.is_archived || field.is_active === false) return false;
      if (field.field_direction === "output" || field.is_system_calculated || field.is_user_editable === false) return false;
      return true;
    })
    .sort((a, b) => Number(a.order_index || 0) - Number(b.order_index || 0));
}

function primaryFilterField(fields, inventory) {
  const keysByDepartment = {
    crops: ["crop_type", "crop_variety", "field_or_plot", "record_status"],
    animals: ["animal_type", "breed", "animal_category", "record_status"],
    machinery: ["machine_name", "machine_type", "asset_code", "record_status"],
  };
  const preferred = keysByDepartment[inventory?.department] || ["record_status"];
  return safeArray(fields).find((field) => preferred.includes(field.field_key)) || safeArray(fields).find((field) => field.is_filterable) || null;
}

function cleanOptionValue(option) {
  if (option === undefined || option === null || option === "") return "";
  if (typeof option === "object") {
    return String(option.label || option.value || option.name || option.option_label || option.option_value || "").trim();
  }
  return String(option).trim();
}

function getLookupOptionValues(field, lookupOptions = [], inventory = null) {
  const lookupGroup = String(field?.lookup_group || "").toLowerCase();
  if (!lookupGroup) return [];
  const department = String(inventory?.department || "").toLowerCase();

  return safeArray(lookupOptions)
    .filter((item) => {
      const itemGroup = String(item?.group || item?.lookup_group || item?.lookupGroup || "").toLowerCase();
      const itemDepartment = String(item?.department || "").toLowerCase();
      if (itemGroup && itemGroup !== lookupGroup) return false;
      if (itemDepartment && department && itemDepartment !== department) return false;
      if (item?.is_active === false) return false;
      return true;
    })
    .map((item) => cleanOptionValue(item?.label || item?.value || item?.option_label || item?.option_value || item?.name))
    .filter(Boolean);
}

function getFallbackOptions(field) {
  const lookupGroup = String(field?.lookup_group || "").toLowerCase();
  const fieldKey = String(field?.field_key || "").toLowerCase();
  return [
    ...safeArray(LOOKUP_FALLBACKS[lookupGroup]),
    ...safeArray(FIELD_KEY_FALLBACKS[fieldKey]),
  ];
}

function getFieldOptions(field, rows = [], lookupOptions = [], inventory = null) {
  const explicit = safeArray(field?.options_json).map(cleanOptionValue).filter(Boolean);
  const backendLookupValues = getLookupOptionValues(field, lookupOptions, inventory);
  const fallback = getFallbackOptions(field);

  const values = new Set([...explicit, ...backendLookupValues, ...fallback].filter(Boolean));
  safeArray(rows).forEach((row) => {
    const value = getRowValues(row)[field?.field_key];
    if (value !== undefined && value !== null && value !== "") values.add(String(value));
  });
  return Array.from(values);
}

function getInventorySubtitle(inventory) {
  if (inventory?.description) return inventory.description;
  const meta = normalizeDepartment(inventory?.department);
  if (inventory?.inventory_type) return `Track ${titleCase(inventory.inventory_type).toLowerCase()} records with daily inputs and automatic summaries.`;
  return meta.description;
}

function guessStatus(row) {
  const values = getRowValues(row);
  return values.record_status || values.status || row.status || "active";
}

function rowMatches(row, search, filterField, filterValue) {
  const values = getRowValues(row);
  const term = String(search || "").trim().toLowerCase();
  if (filterField && filterValue && String(values[filterField.field_key] || "") !== filterValue) return false;
  if (!term) return true;
  const haystack = [row.row_label, row.primary_entity_name, row.primary_entity_code, ...Object.values(values)]
    .filter((item) => item !== undefined && item !== null)
    .join(" ")
    .toLowerCase();
  return haystack.includes(term);
}

function makeReportParams(period, format = "pdf") {
  return {
    report_type: period?.period_type || "daily",
    start_date: period?.start_date || firstOfMonthIso(),
    end_date: period?.end_date || endOfMonthIso(),
    period_id: period?.id || undefined,
    include_inputs: true,
    include_outputs: true,
    include_summary: true,
    include_raw_data: true,
    visible_fields_only: true,
    report_format: format,
  };
}

function FileName(inventory, ext) {
  const base = String(inventory?.title || "inventory-report")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "inventory-report";
  return `${base}-${todayIsoDate()}.${ext}`;
}

function Toast({ toast, onClose }) {
  if (!toast?.message) return null;
  return (
    <div className={`diToast ${toast.type || "info"}`}>
      <span>{toast.message}</span>
      <button type="button" onClick={onClose}>×</button>
    </div>
  );
}

function LoadingState() {
  return (
    <main className="ranchDetailPage">
      <div className="loadingCard">
        <span className="loader" />
        <div>
          <strong>Loading inventory module</strong>
          <p>Preparing today sheet, records, summaries, and workflow data.</p>
        </div>
      </div>
    </main>
  );
}

function ErrorState({ message, onRetry }) {
  return (
    <main className="ranchDetailPage">
      <div className="errorState">
        <span>⚠</span>
        <h2>Unable to open inventory</h2>
        <p>{message || "The inventory module could not be loaded."}</p>
        <div className="errorActions">
          <Link href="/dynamic-inventory">Back to inventory</Link>
          <button type="button" onClick={onRetry}>Retry</button>
        </div>
      </div>
    </main>
  );
}

function MetricCard({ icon, label, value, subtext, tone = "green" }) {
  return (
    <article className={`metricCard ${tone}`}>
      <div className="metricIcon">{icon}</div>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        <span>{subtext}</span>
      </div>
    </article>
  );
}

function ActionButton({ children, tone = "secondary", ...props }) {
  return <button type="button" className={`diBtn ${tone}`} {...props}>{children}</button>;
}

function InfoRow({ label, value }) {
  return (
    <div className="infoRow">
      <span>{label}</span>
      <strong>{value || "—"}</strong>
    </div>
  );
}

function PeriodSummaryCard({ inventory, period, rows }) {
  const summary = asObject(period?.summary || period?.summary_json);
  const metrics = safeArray(summary.metrics);
  const fields = safeArray(period?.fields);
  const totals = metrics.slice(0, 4);
  return (
    <aside className="sideCard summarySideCard">
      <div className="sideHeader">
        <h3>Period Summary</h3>
        <span>▤</span>
      </div>
      <InfoRow label="Department" value={normalizeDepartment(inventory?.department).label} />
      <InfoRow label="Total Rows" value={formatNumber(summary.row_count ?? rows.length, { decimals: 0 })} />
      <InfoRow label="Fields" value={formatNumber(fields.length, { decimals: 0 })} />
      <InfoRow label="Period" value={`${formatDate(period?.start_date)} - ${formatDate(period?.end_date)}`} />
      {totals.map((metric) => (
        <InfoRow
          key={metric.metric_key || metric.label}
          label={metric.label || titleCase(metric.metric_key)}
          value={`${formatNumber(metric.value)} ${metric.unit_label || ""}`.trim()}
        />
      ))}
      <button type="button" className="sideLink">View full summary <span>→</span></button>
    </aside>
  );
}

function ApprovalCard({ period, onSubmit, onApprove, onReject, busy }) {
  const status = String(period?.status || "draft").toLowerCase();
  const submitted = ["submitted", "approved", "locked"].includes(status);
  const approved = ["approved", "locked"].includes(status);
  const locked = status === "locked";
  return (
    <aside className="sideCard approvalCard">
      <div className="sideHeader">
        <h3>Approval Status</h3>
        <span>▧</span>
      </div>
      <p className="mutedText">Current period workflow and approval progress.</p>
      <div className="approvalSteps">
        <div className={`approvalStep ${submitted ? "done" : "pending"}`}>
          <span>{submitted ? "✓" : "1"}</span>
          <div><strong>Data Entry</strong><small>{submitted ? "Submitted" : "Draft in progress"}</small></div>
        </div>
        <div className={`approvalStep ${approved ? "done" : submitted ? "active" : "pending"}`}>
          <span>{approved ? "✓" : "2"}</span>
          <div><strong>Department Review</strong><small>{approved ? "Approved" : submitted ? "Awaiting review" : "Pending"}</small></div>
        </div>
        <div className={`approvalStep ${locked ? "done" : "pending"}`}>
          <span>{locked ? "✓" : "3"}</span>
          <div><strong>Final Lock</strong><small>{locked ? "Locked" : "Not locked"}</small></div>
        </div>
      </div>
      <div className="approvalActions">
        <button disabled={busy || submitted || locked} onClick={onSubmit} type="button">Submit</button>
        <button disabled={busy || approved || locked} onClick={onApprove} type="button">Approve</button>
        <button disabled={busy || locked} onClick={onReject} type="button">Reject</button>
      </div>
    </aside>
  );
}

function AlertsCard({ alerts = [], onRefresh }) {
  const list = safeArray(alerts).slice(0, 4);
  return (
    <aside className="sideCard alertCard">
      <div className="sideHeader">
        <h3>Alerts</h3>
        <span>⚠</span>
      </div>
      {list.length ? (
        <div className="alertList">
          {list.map((alert) => (
            <div key={alert.id || alert.title || alert.message} className={`alertItem ${String(alert.level || "info").toLowerCase()}`}>
              <span>△</span>
              <div>
                <strong>{alert.title || alert.message || "Inventory alert"}</strong>
                <small>{alert.description || alert.detail || statusLabel(alert.status)}</small>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="emptyMini successMini">
          <strong>No open alerts</strong>
          <p>This module has no active warnings.</p>
        </div>
      )}
      <button type="button" className="sideLink" onClick={onRefresh}>Refresh alerts <span>→</span></button>
    </aside>
  );
}

function ActivityCard({ auditLogs = [] }) {
  const list = safeArray(auditLogs).slice(0, 6);
  return (
    <section className="activityPanel">
      <div className="panelHeader compact">
        <div>
          <h3>Recent Activity</h3>
          <p>Latest updates and audit trail changes.</p>
        </div>
        <span className="badge neutral">Audit trail</span>
      </div>
      {list.length ? (
        <div className="activityList">
          {list.map((item) => (
            <div key={item.id || `${item.action}-${item.created_at}`} className="activityLine">
              <span className="activityDot">✓</span>
              <div>
                <strong>{item.description || statusLabel(item.action) || "Inventory activity"}</strong>
                <small>{statusLabel(item.action)} {item.actor_user_id ? `by user #${item.actor_user_id}` : ""}</small>
              </div>
              <time>{formatDateTime(item.created_at)}</time>
            </div>
          ))}
        </div>
      ) : (
        <div className="emptyMini">
          <strong>No activity yet</strong>
          <p>Changes will appear here after users add, submit, or approve records.</p>
        </div>
      )}
    </section>
  );
}

function AccessCard({ inventory }) {
  const users = safeArray(inventory?.user_access).slice(0, 4);
  return (
    <aside className="sideCard accessCard">
      <div className="sideHeader">
        <h3>Module Access</h3>
        <span>☷</span>
      </div>
      {users.length ? (
        <div className="accessList">
          {users.map((user) => (
            <div key={user.id || user.user_id} className="accessUser">
              <span>{String(user.user_id || "U").slice(0, 2)}</span>
              <div>
                <strong>User #{user.user_id}</strong>
                <small>{statusLabel(user.role)} {user.is_active === false ? "· Inactive" : ""}</small>
              </div>
              <em>{user.can_approve_periods ? "Approver" : user.can_edit_rows ? "Editor" : "Viewer"}</em>
            </div>
          ))}
        </div>
      ) : (
        <div className="emptyMini">
          <strong>No assigned users</strong>
          <p>Access settings will appear when users are assigned.</p>
        </div>
      )}
    </aside>
  );
}

function ModuleInfoCard({ inventory, period }) {
  const slug = inventory?.slug || `INV-${inventory?.id || "—"}`;
  return (
    <section className="activityPanel moduleInfoFullCard">
      <div className="moduleInfoTop horizontalInfoTop">
        <div className="moduleInfoTitle">
          <span>{normalizeDepartment(inventory?.department).icon}</span>
          <h3>Module Information</h3>
        </div>
        <strong className="moduleSlug">{slug}</strong>
      </div>
      <div className="moduleInfoRows">
        <InfoRow label="Module Name" value={inventory?.title} />
        <InfoRow label="Department" value={normalizeDepartment(inventory?.department).label} />
        <InfoRow label="Inventory Type" value={titleCase(inventory?.inventory_type)} />
        <InfoRow label="Status" value={statusLabel(inventory?.status)} />
        <InfoRow label="Period Status" value={statusLabel(period?.status)} />
        <InfoRow label="Created" value={formatDateTime(inventory?.created_at)} />
        <InfoRow label="Last Updated" value={formatDateTime(inventory?.updated_at)} />
      </div>
    </section>
  );
}

function FieldInput({ field, value, onChange, lookupOptions = [], inventory = null, rows = [] }) {
  const options = getFieldOptions(field, rows, lookupOptions, inventory);
  const listId = `di-options-${field.id || field.field_key}`;
  const common = {
    value: value ?? "",
    onChange: (e) => onChange(field.field_key, e.target.value),
    required: Boolean(field.is_required),
  };

  if (field.field_type === "long_text") {
    return <textarea rows={3} placeholder={`Enter ${String(field.field_name || "details").toLowerCase()}...`} {...common} />;
  }

  if (field.field_type === "boolean") {
    return (
      <select {...common}>
        <option value="">Select</option>
        <option value="true">Yes</option>
        <option value="false">No</option>
      </select>
    );
  }

  if (field.field_type === "date") return <input type="date" {...common} />;
  if (field.field_type === "datetime") return <input type="datetime-local" {...common} />;

  const fieldKey = String(field.field_key || "").toLowerCase();
  const isOperatingHours = ["running_hours", "machine_running_hours", "operating_hours", "operator_hours"].includes(fieldKey);
  if (isOperatingHours) {
    const hourOptions = Array.from(new Set([...safeArray(options), ...LOOKUP_FALLBACKS.operating_hours]));
    return (
      <div className="comboInputWrap">
        <input
          type="text"
          inputMode="decimal"
          list={listId}
          placeholder="Select or adjust operating hours"
          autoComplete="off"
          {...common}
        />
        <datalist id={listId}>
          {hourOptions.map((option) => <option key={option} value={option} />)}
        </datalist>
        <small className="comboHint">Select common hours or type an adjusted value.</small>
      </div>
    );
  }

  if (["number", "integer", "decimal", "currency", "percentage"].includes(field.field_type)) return <input type="number" step="any" placeholder="0" {...common} />;

  if (field.field_type === "dropdown" || field.lookup_group || options.length) {
    return (
      <div className="comboInputWrap">
        <input
          type="text"
          list={listId}
          placeholder={`Select or enter ${String(field.field_name || "value").toLowerCase()}`}
          autoComplete="off"
          {...common}
        />
        <datalist id={listId}>
          {options.map((option) => <option key={option} value={option} />)}
        </datalist>
        <small className="comboHint">
          {options.length ? "Select from the list or type a new value." : "Type a value for this field."}
        </small>
      </div>
    );
  }

  return <input type="text" placeholder={`Enter ${String(field.field_name || "value").toLowerCase()}`} {...common} />;
}

function RowModal({ open, mode, fields, initialRow, onClose, onSave, saving, lookupOptions = [], inventory = null, rows = [] }) {
  const inputFields = useMemo(() => getInputFields(fields), [fields]);
  const [values, setValues] = useState({});

  useEffect(() => {
    if (!open) return;
    const current = initialRow ? getRowValues(initialRow) : {};
    const seeded = {};
    inputFields.forEach((field) => {
      if (current[field.field_key] !== undefined) seeded[field.field_key] = current[field.field_key];
      else if (field.field_type === "date" && field.field_key === "record_date") seeded[field.field_key] = todayIsoDate();
      else if (field.default_value !== undefined && field.default_value !== null) seeded[field.field_key] = field.default_value;
    });
    setValues(seeded);
  }, [open, initialRow, inputFields]);

  if (!open) return null;

  const handleChange = (key, value) => setValues((prev) => ({ ...prev, [key]: value }));
  const handleSubmit = (event) => {
    event.preventDefault();
    onSave(values);
  };

  return (
    <div className="modalOverlay">
      <form className="recordModal" onSubmit={handleSubmit}>
        <div className="modalHeader">
          <div>
            <p>{mode === "edit" ? "Edit inventory record" : "New inventory record"}</p>
            <h2>{mode === "edit" ? "Update Row" : "Add Entry"}</h2>
          </div>
          <button type="button" onClick={onClose}>×</button>
        </div>
        <div className="modalGrid">
          {inputFields.map((field) => (
            <label key={field.id || field.field_key} className={field.field_type === "long_text" ? "wide" : ""}>
              <span>{field.field_name}{field.is_required ? " *" : ""}</span>
              <FieldInput field={field} value={values[field.field_key]} onChange={handleChange} lookupOptions={lookupOptions} inventory={inventory} rows={rows} />
              {field.unit_label ? <small>Unit: {field.unit_label}</small> : null}
            </label>
          ))}
        </div>
        <div className="modalActions">
          <button type="button" className="diBtn secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="diBtn primary" disabled={saving}>{saving ? "Saving..." : mode === "edit" ? "Save Changes" : "Add Entry"}</button>
        </div>
      </form>
    </div>
  );
}

function ConfirmModal({ open, title, message, confirmText = "Confirm", onConfirm, onClose, busy }) {
  if (!open) return null;
  return (
    <div className="modalOverlay">
      <div className="confirmModal">
        <h2>{title}</h2>
        <p>{message}</p>
        <div className="modalActions">
          <button type="button" className="diBtn secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="diBtn danger" disabled={busy} onClick={onConfirm}>{busy ? "Working..." : confirmText}</button>
        </div>
      </div>
    </div>
  );
}

function InventoryTable({ fields, rows, search, filterField, filterValue, onEditRow, onDeleteRow }) {
  const displayFields = useMemo(() => getVisibleFields(fields, 9), [fields]);
  const filteredRows = useMemo(
    () => safeArray(rows).filter((row) => rowMatches(row, search, filterField, filterValue)),
    [rows, search, filterField, filterValue]
  );

  return (
    <section className="tablePanel">
      <div className="panelHeader">
        <div>
          <h3>Inventory Records</h3>
          <p>{formatNumber(filteredRows.length, { decimals: 0 })} records shown</p>
        </div>
        <span className="badge neutral">Live sheet</span>
      </div>
      <div className="tableScroller">
        <table className="inventoryTable">
          <thead>
            <tr>
              <th>#</th>
              {displayFields.map((field) => <th key={field.id || field.field_key}>{field.field_name}</th>)}
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length ? filteredRows.map((row, index) => (
              <tr key={row.id || index}>
                <td>{row.row_number || index + 1}</td>
                {displayFields.map((field) => (
                  <td key={`${row.id}-${field.field_key}`} className={field.field_direction === "output" ? "outputCell" : ""}>
                    {getCellDisplay(row, field)}
                  </td>
                ))}
                <td><span className={`statusPill ${statusClass(guessStatus(row))}`}>{statusLabel(guessStatus(row))}</span></td>
                <td>
                  <div className="rowActions">
                    <button type="button" onClick={() => onEditRow(row)}>Edit</button>
                    <button type="button" onClick={() => onDeleteRow(row)}>Delete</button>
                  </div>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={displayFields.length + 3}>
                  <div className="tableEmpty">
                    <strong>No records yet</strong>
                    <p>Add your first row to start tracking this inventory module.</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ConsumptionTrendChart({ rows, inventory }) {
  const isMachinery = inventory?.department === "machinery";
  const keyCandidates = isMachinery
    ? ["fuel_used", "fuel_quantity", "quantity"]
    : inventory?.department === "animals"
      ? ["born", "bought", "sold", "died", "quantity"]
      : ["harvested", "sold", "damaged", "quantity"];
  const title = isMachinery ? "Fuel Consumption Trend" : "Activity Trend";
  const description = isMachinery ? "Fuel used across recent records." : "Current period totals by major input fields.";
  const data = isMachinery
    ? makeSeries(rows, keyCandidates, 6)
    : keyCandidates.map((key) => ({ key, label: titleCase(key), value: sumField(rows, key) })).filter((item) => item.value > 0);
  const fallback = data.length ? data : [{ key: "rows", label: "Rows", value: rows.length || 1 }];
  const max = Math.max(...fallback.map((item) => Number(item.value) || 0), 1);
  return (
    <section className="chartCard compactChart">
      <div className="chartHeader smallChartHeader">
        <div>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
        <span>This period</span>
      </div>
      <div className="barChart compactBarChart">
        {fallback.map((item, index) => (
          <div key={item.key || `${item.label}-${index}`} className="barItem">
            <div className="barTrack"><span style={{ height: `${Math.max(8, ((Number(item.value) || 0) / max) * 100)}%` }} /></div>
            <strong>{formatNumber(item.value)}</strong>
            <small>{String(item.label || `R${index + 1}`).slice(0, 10)}</small>
          </div>
        ))}
      </div>
    </section>
  );
}

function OperatingHoursTrendChart({ rows, inventory }) {
  const isMachinery = inventory?.department === "machinery";
  const keys = isMachinery ? ["running_hours", "machine_running_hours", "operating_hours", "operator_hours"] : ["quantity", "rows"];
  const data = makeSeries(rows, keys, 6);
  const points = makePolylinePoints(data, 240, 92);
  const total = data.reduce((sum, item) => sum + (Number(item.value) || 0), 0);
  return (
    <section className="chartCard compactChart lineChartCard">
      <div className="chartHeader smallChartHeader">
        <div>
          <h3>{isMachinery ? "Operating Hours Trend" : "Records Trend"}</h3>
          <p>{isMachinery ? "Machine operating hours by recent records." : "Recent record activity."}</p>
        </div>
        <span>{formatNumber(total)} hrs</span>
      </div>
      <div className="lineChartWrap">
        <svg viewBox="0 0 240 100" className="lineChartSvg" preserveAspectRatio="none">
          <path d="M0 94 H240 M0 62 H240 M0 30 H240" className="gridLines" />
          <polyline points={points} className="trendLine" />
          {data.map((item, index) => {
            const step = data.length > 1 ? 240 / (data.length - 1) : 240;
            const max = Math.max(...data.map((d) => Number(d.value) || 0), 1);
            const cx = index * step;
            const cy = 92 - ((Number(item.value) || 0) / max) * 80 - 6;
            return <circle key={`${item.label}-${index}`} cx={cx} cy={cy} r="3.8" className="trendPoint" />;
          })}
        </svg>
        <div className="lineAxisLabels">
          {data.slice(0, 6).map((item, index) => <span key={`${item.label}-${index}`}>{String(item.label || `R${index + 1}`).slice(0, 6)}</span>)}
        </div>
      </div>
    </section>
  );
}

function DonutChart({ rows, field }) {
  const groups = {};
  safeArray(rows).forEach((row) => {
    const value = getRowValues(row)[field?.field_key] || "Other";
    const label = String(value || "Other");
    groups[label] = (groups[label] || 0) + 1;
  });
  const entries = Object.entries(groups).slice(0, 5);
  const total = entries.reduce((sum, [, count]) => sum + count, 0) || 1;
  const circumference = 100;
  let offset = 0;
  const colors = ["#2f6f35", "#6da157", "#a3c76a", "#d6a21d", "#c8c8c8"];
  return (
    <section className="chartCard compactChart donutCard">
      <div className="chartHeader smallChartHeader">
        <div>
          <h3>Records by {field?.field_name || "Category"}</h3>
          <p>Distribution for the selected period.</p>
        </div>
      </div>
      <div className="donutWrap compactDonutWrap">
        <svg viewBox="0 0 42 42" className="donutSvg">
          <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="#eef3e8" strokeWidth="7" />
          {entries.map(([label, count], index) => {
            const dash = (count / total) * circumference;
            const segment = <circle key={label} cx="21" cy="21" r="15.915" fill="transparent" stroke={colors[index % colors.length]} strokeWidth="7" strokeDasharray={`${dash} ${circumference - dash}`} strokeDashoffset={-offset} />;
            offset += dash;
            return segment;
          })}
        </svg>
        <div className="donutLegend">
          {entries.length ? entries.map(([label, count], index) => (
            <div key={label}><span style={{ background: colors[index % colors.length] }} /> <strong>{label}</strong><em>{count}</em></div>
          )) : <p>No records</p>}
        </div>
      </div>
    </section>
  );
}

export default function DynamicInventoryDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const inventoryId = Array.isArray(id) ? id[0] : id;

  const [inventory, setInventory] = useState(null);
  const [period, setPeriod] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [lookupOptions, setLookupOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState(false);
  const [savingRow, setSavingRow] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState({ message: "", type: "info" });
  const [search, setSearch] = useState("");
  const [filterValue, setFilterValue] = useState("");
  const [rowModal, setRowModal] = useState({ open: false, mode: "create", row: null });
  const [deleteTarget, setDeleteTarget] = useState(null);

  const showToast = (message, type = "info") => setToast({ message, type });

  const loadData = useCallback(async () => {
    if (!inventoryId) return;
    setLoading(true);
    setError("");
    try {
      const [inventoryData, todayData, alertsData, logsData, lookupData] = await Promise.allSettled([
        apiRequest(`${INVENTORY_BASE}/${inventoryId}`),
        apiRequest(`${INVENTORY_BASE}/${inventoryId}/today`),
        apiRequest(`${INVENTORY_BASE}/alerts${buildQuery({ inventory_id: inventoryId, status: "open" })}`),
        apiRequest(`${INVENTORY_BASE}/audit-logs${buildQuery({ inventory_id: inventoryId, limit: 50 })}`),
        apiRequest(`${INVENTORY_BASE}/lookup-options`),
      ]);

      if (inventoryData.status === "fulfilled") setInventory(inventoryData.value);
      else throw inventoryData.reason;

      if (todayData.status === "fulfilled") setPeriod(todayData.value);
      else throw todayData.reason;

      setAlerts(alertsData.status === "fulfilled" ? safeArray(alertsData.value) : []);
      setAuditLogs(logsData.status === "fulfilled" ? safeArray(logsData.value) : []);
      setLookupOptions(lookupData.status === "fulfilled" ? safeArray(lookupData.value) : []);
    } catch (err) {
      setError(err.message || "Unable to load this inventory module.");
    } finally {
      setLoading(false);
    }
  }, [inventoryId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const fields = useMemo(() => safeArray(period?.fields).length ? safeArray(period.fields) : safeArray(inventory?.fields), [period, inventory]);
  const rows = useMemo(() => safeArray(period?.rows), [period]);
  const meta = normalizeDepartment(inventory?.department);
  const filterField = useMemo(() => primaryFilterField(fields, inventory), [fields, inventory]);
  const filterOptions = useMemo(() => filterField ? getFieldOptions(filterField, rows, lookupOptions, inventory) : [], [filterField, rows, lookupOptions, inventory]);
  const categoryField = useMemo(() => filterField || fields.find((field) => field.is_filterable) || fields[0], [fields, filterField]);

  const metrics = useMemo(() => {
    const department = inventory?.department;
    const count = rows.length;
    const periodStatus = statusLabel(period?.status);
    if (department === "crops") {
      return [
        { icon: "▣", label: "Opening Stock", value: `${formatNumber(getSummaryValue(period, rows, ["opening_stock", "opening_balance"]))}`, subtext: "Across crop records", tone: "green" },
        { icon: "☘", label: "Harvested", value: `${formatNumber(getSummaryValue(period, rows, ["harvested", "produced", "purchased"]))}`, subtext: "This period", tone: "green" },
        { icon: "🛒", label: "Sold", value: `${formatNumber(getSummaryValue(period, rows, ["sold", "used"]))}`, subtext: "This period", tone: "blue" },
        { icon: "▤", label: "Closing Stock", value: `${formatNumber(getSummaryValue(period, rows, ["closing_stock", "current_balance"]))}`, subtext: "System calculated", tone: "amber" },
        { icon: "$", label: "Sales Value", value: formatCurrency(getSummaryValue(period, rows, ["sales_value", "amount", "total_amount"])), subtext: "Total value", tone: "green" },
      ];
    }
    if (department === "machinery") {
      return [
        { icon: "⛽", label: "Fuel Used", value: `${formatNumber(getSummaryValue(period, rows, ["fuel_used", "fuel_quantity", "quantity"]))}`, subtext: "This period", tone: "green" },
        { icon: "◴", label: "Running Hours", value: `${formatNumber(getSummaryValue(period, rows, ["running_hours", "machine_running_hours"]))}`, subtext: "Machine time", tone: "blue" },
        { icon: "$", label: "Maintenance Cost", value: formatCurrency(getSummaryValue(period, rows, ["total_maintenance_cost", "amount", "total_amount"])), subtext: "Cost tracked", tone: "amber" },
        { icon: "⚠", label: "Open Alerts", value: `${formatNumber(alerts.length, { decimals: 0 })}`, subtext: "Requires attention", tone: "red" },
      ];
    }
    return [
      { icon: meta.icon, label: "Total Records", value: formatNumber(count, { decimals: 0 }), subtext: "Rows in this period", tone: "green" },
      { icon: "+", label: "Additions", value: `${formatNumber(getSummaryValue(period, rows, ["born", "bought", "purchased", "total_additions", "quantity"]))}`, subtext: "This period", tone: "green" },
      { icon: "−", label: "Reductions", value: `${formatNumber(getSummaryValue(period, rows, ["sold", "died", "used", "total_reductions"]))}`, subtext: "This period", tone: "amber" },
      { icon: "▤", label: "Current Balance", value: `${formatNumber(getSummaryValue(period, rows, ["current_balance", "closing_stock", "opening_balance"]))}`, subtext: "System calculated", tone: "green" },
      { icon: "$", label: "Total Amount", value: formatCurrency(getSummaryValue(period, rows, ["amount", "sales_value", "total_amount"])), subtext: periodStatus, tone: "blue" },
    ];
  }, [inventory, rows, period, alerts.length, meta.icon]);

  const refreshAlerts = async () => {
    try {
      const data = await apiRequest(`${INVENTORY_BASE}/alerts${buildQuery({ inventory_id: inventoryId, status: "open" })}`);
      setAlerts(safeArray(data));
      showToast("Alerts refreshed.", "success");
    } catch (err) {
      showToast(err.message || "Unable to refresh alerts.", "error");
    }
  };

  const reloadPeriodOnly = async () => {
    const [todayData, logsData, alertsData] = await Promise.allSettled([
      apiRequest(`${INVENTORY_BASE}/${inventoryId}/today`),
      apiRequest(`${INVENTORY_BASE}/audit-logs${buildQuery({ inventory_id: inventoryId, limit: 50 })}`),
      apiRequest(`${INVENTORY_BASE}/alerts${buildQuery({ inventory_id: inventoryId, status: "open" })}`),
    ]);
    if (todayData.status === "fulfilled") setPeriod(todayData.value);
    if (logsData.status === "fulfilled") setAuditLogs(safeArray(logsData.value));
    if (alertsData.status === "fulfilled") setAlerts(safeArray(alertsData.value));
  };

  const handleSaveRow = async (values) => {
    if (!period?.id || !inventoryId) return;
    setSavingRow(true);
    try {
      if (rowModal.mode === "edit" && rowModal.row?.id) {
        await apiRequest(`${INVENTORY_BASE}/rows/${rowModal.row.id}`, {
          method: "PATCH",
          body: { values },
        });
        showToast("Record updated successfully.", "success");
      } else {
        await apiRequest(`${INVENTORY_BASE}/${inventoryId}/periods/${period.id}/rows`, {
          method: "POST",
          body: { values },
        });
        showToast("Record added successfully.", "success");
      }
      setRowModal({ open: false, mode: "create", row: null });
      await reloadPeriodOnly();
    } catch (err) {
      showToast(err.message || "Unable to save row.", "error");
    } finally {
      setSavingRow(false);
    }
  };

  const handleDeleteRow = async () => {
    if (!deleteTarget?.id) return;
    setActionBusy(true);
    try {
      await apiRequest(`${INVENTORY_BASE}/rows/${deleteTarget.id}`, {
        method: "DELETE",
        body: { reason: "Deleted from inventory detail page" },
      });
      setDeleteTarget(null);
      showToast("Record deleted successfully.", "success");
      await reloadPeriodOnly();
    } catch (err) {
      showToast(err.message || "Unable to delete row.", "error");
    } finally {
      setActionBusy(false);
    }
  };

  const handlePeriodAction = async (action, payload = {}) => {
    if (!period?.id) return;
    setActionBusy(true);
    try {
      await apiRequest(`${INVENTORY_BASE}/periods/${period.id}/${action}`, {
        method: "POST",
        body: payload,
      });
      showToast(`${titleCase(action)} completed.`, "success");
      await reloadPeriodOnly();
    } catch (err) {
      showToast(err.message || `Unable to ${action} period.`, "error");
    } finally {
      setActionBusy(false);
    }
  };

  const handleExport = async (format) => {
    if (!inventoryId) return;
    setActionBusy(true);
    try {
      const params = makeReportParams(period, format);
      const blob = await apiRequest(`${INVENTORY_BASE}/${inventoryId}/reports/${format}${buildQuery(params)}`, { blob: true });
      downloadBlob(blob, FileName(inventory, format === "excel" ? "xlsx" : format));
      showToast(`${String(format).toUpperCase()} report downloaded.`, "success");
    } catch (err) {
      showToast(err.message || `Unable to export ${format}.`, "error");
    } finally {
      setActionBusy(false);
    }
  };

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={loadData} />;

  return (
    <>
      <Head>
        <title>{inventory?.title || "Inventory Detail"} | Ranch Inventory</title>
        <meta name="description" content="Dynamic ranch inventory detail page with records, reports, approvals, and audit history." />
      </Head>

      <main className="ranchDetailPage">
        <Toast toast={toast} onClose={() => setToast({ message: "", type: "info" })} />

        <section className="detailHeader">
          <div className="headerLeft">
            <nav className="breadcrumbs">
              <Link href="/dynamic-inventory">Dashboard</Link>
              <span>›</span>
              <Link href="/dynamic-inventory">Inventory</Link>
              <span>›</span>
              <span>{inventory?.title || "Inventory"}</span>
            </nav>
            <div className="titleLine">
              <h1>{inventory?.title || "Inventory"}</h1>
              <span className={`deptBadge ${meta.tone}`}>{meta.icon} {meta.label}</span>
              <span className={`statusPill ${statusClass(inventory?.status)}`}>{statusLabel(inventory?.status)}</span>
            </div>
            <p>{getInventorySubtitle(inventory)}</p>
          </div>
          <div className="headerActions">
            <ActionButton tone="primary" onClick={() => setRowModal({ open: true, mode: "create", row: null })}>＋ Add Entry</ActionButton>
            <ActionButton onClick={() => handleExport("pdf")} disabled={actionBusy}>▤ Generate Report</ActionButton>
            <ActionButton tone="warning" onClick={() => handlePeriodAction("lock")} disabled={actionBusy || String(period?.status).toLowerCase() === "locked"}>▧ Lock Period</ActionButton>
          </div>
        </section>

        <section className="filterBar">
          <label className="periodControl">
            <span>Period</span>
            <input type="text" value={`${formatDate(period?.start_date)} - ${formatDate(period?.end_date)}`} readOnly />
          </label>
          <label className="searchControl">
            <span>⌕</span>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={`Search ${titleCase(inventory?.inventory_type || "records").toLowerCase()}...`} />
          </label>
          {filterField ? (
            <label className="selectControl">
              <span>{filterField.field_name}</span>
              <select value={filterValue} onChange={(e) => setFilterValue(e.target.value)}>
                <option value="">All {filterField.field_name}</option>
                {filterOptions.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
          ) : null}
          <button type="button" className="filterBtn" onClick={() => setFilterValue("")}>⌯ Filters</button>
          <div className="exportGroup">
            <button type="button" onClick={() => handleExport("excel")} disabled={actionBusy}>Excel</button>
            <button type="button" onClick={() => handleExport("csv")} disabled={actionBusy}>CSV</button>
            <button type="button" onClick={() => handleExport("pdf")} disabled={actionBusy}>PDF</button>
          </div>
        </section>

        <section className={`metricsGrid metrics-${metrics.length}`}>
          {metrics.map((metric) => <MetricCard key={metric.label} {...metric} />)}
        </section>

        <section className="detailLayout">
          <div className="mainColumn">
            <InventoryTable
              fields={fields}
              rows={rows}
              search={search}
              filterField={filterField}
              filterValue={filterValue}
              onEditRow={(row) => setRowModal({ open: true, mode: "edit", row })}
              onDeleteRow={(row) => setDeleteTarget(row)}
            />

            <div className="chartsGrid">
              <ConsumptionTrendChart rows={rows} inventory={inventory} />
              <OperatingHoursTrendChart rows={rows} inventory={inventory} />
              <DonutChart rows={rows} field={categoryField} />
            </div>

            <ActivityCard auditLogs={auditLogs} />
            <ModuleInfoCard inventory={inventory} period={period} />
          </div>

          <div className="sideColumn">
            <PeriodSummaryCard inventory={inventory} period={period} rows={rows} />
            <ApprovalCard
              period={period}
              busy={actionBusy}
              onSubmit={() => handlePeriodAction("submit", { notes: "Submitted from inventory detail page" })}
              onApprove={() => handlePeriodAction("approve", { notes: "Approved from inventory detail page" })}
              onReject={() => handlePeriodAction("reject", { reason: "Rejected from inventory detail page" })}
            />
            <AlertsCard alerts={alerts} onRefresh={refreshAlerts} />
            <AccessCard inventory={inventory} />
          </div>
        </section>

        <p className="footerNote">▧ All inventory data is securely stored and time-stamped. Locked periods cannot be edited.</p>
      </main>

      <RowModal
        open={rowModal.open}
        mode={rowModal.mode}
        fields={fields}
        initialRow={rowModal.row}
        lookupOptions={lookupOptions}
        inventory={inventory}
        rows={rows}
        saving={savingRow}
        onClose={() => setRowModal({ open: false, mode: "create", row: null })}
        onSave={handleSaveRow}
      />

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="Delete inventory row?"
        message="This will remove the selected row from the current period. You can keep an audit reason in the backend."
        confirmText="Delete Row"
        busy={actionBusy}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteRow}
      />

      <style jsx global>{`
        html,
        body,
        #__next {
          background: #fbfaf4;
          max-width: 100%;
          overflow-x: hidden;
          font-family: Helvetica, Arial, sans-serif;
        }

        .ranchDetailPage,
        .ranchDetailPage * {
          box-sizing: border-box;
          font-family: Helvetica, Arial, sans-serif !important;
        }

        .ranchDetailPage {
          width: 100%;
          max-width: 100%;
          min-height: 100vh;
          padding: 28px 28px 34px;
          color: #142417;
          font-family: Helvetica, Arial, sans-serif;
          overflow-x: hidden;
          background:
            radial-gradient(circle at top right, rgba(234, 224, 182, 0.22), transparent 34%),
            linear-gradient(180deg, #fffdf7 0%, #fbfaf4 42%, #f8f7f0 100%);
        }

        .ranchDetailPage button,
        .ranchDetailPage input,
        .ranchDetailPage select,
        .ranchDetailPage textarea {
          font-family: Helvetica, Arial, sans-serif;
        }

        .ranchDetailPage button {
          cursor: pointer;
        }

        .detailHeader {
          display: flex;
          justify-content: space-between;
          gap: 24px;
          align-items: flex-start;
          margin-bottom: 20px;
        }

        .breadcrumbs {
          display: flex;
          align-items: center;
          gap: 9px;
          font-size: 12px;
          color: #64715f;
          margin-bottom: 12px;
        }

        .breadcrumbs a {
          color: #64715f;
          text-decoration: none;
          font-weight: 700;
        }

        .titleLine {
          display: flex;
          align-items: center;
          gap: 14px;
          flex-wrap: wrap;
        }

        .titleLine h1 {
          margin: 0;
          color: #1d311f;
          font-family: Helvetica, Arial, sans-serif !important;
          font-size: clamp(30px, 3.1vw, 44px);
          line-height: 1.06;
          letter-spacing: -0.04em;
          font-weight: 850;
        }

        .detailHeader p {
          color: #5d695b;
          max-width: 760px;
          line-height: 1.55;
          margin: 11px 0 0;
          font-size: 15px;
        }

        .deptBadge,
        .statusPill,
        .badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          border-radius: 999px;
          padding: 8px 12px;
          font-size: 12px;
          font-weight: 800;
          white-space: nowrap;
        }

        .deptBadge.green,
        .statusPill.success {
          background: #e8f4e1;
          color: #287334;
        }

        .deptBadge.amber,
        .statusPill.warning {
          background: #fff1cf;
          color: #9a6400;
        }

        .deptBadge.blue {
          background: #e6f0ff;
          color: #1d5fbf;
        }

        .statusPill.danger {
          background: #ffe5e3;
          color: #be2e22;
        }

        .statusPill.muted,
        .badge.neutral {
          background: #eef1eb;
          color: #596657;
        }

        .headerActions {
          display: flex;
          gap: 12px;
          align-items: center;
          flex-wrap: wrap;
          justify-content: flex-end;
          padding-top: 36px;
        }

        .diBtn {
          min-height: 44px;
          border-radius: 12px;
          border: 1px solid #dde2d7;
          padding: 0 18px;
          background: #ffffff;
          color: #1b281d;
          font-weight: 850;
          font-size: 14px;
          box-shadow: 0 10px 24px rgba(18, 34, 20, 0.06);
          transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
          white-space: nowrap;
        }

        .diBtn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 16px 32px rgba(18, 34, 20, 0.1);
        }

        .diBtn:disabled {
          opacity: 0.58;
          cursor: not-allowed;
        }

        .diBtn.primary {
          color: #fff;
          border-color: #2f773b;
          background: linear-gradient(180deg, #3f8f45, #2e7438);
          box-shadow: 0 16px 30px rgba(54, 128, 62, 0.26);
        }

        .diBtn.warning {
          border-color: #e3b86e;
          color: #a06909;
          background: #fff9ed;
        }

        .diBtn.danger {
          color: #fff;
          border-color: #be2e22;
          background: #be2e22;
        }

        .filterBar {
          display: grid;
          grid-template-columns: minmax(0, 250px) minmax(220px, 1fr) minmax(0, 240px) auto auto;
          gap: 12px;
          min-width: 0;
          max-width: 100%;
          align-items: center;
          background: rgba(255, 255, 255, 0.88);
          border: 1px solid #e3e5dd;
          border-radius: 18px;
          padding: 16px;
          box-shadow: 0 14px 38px rgba(24, 39, 25, 0.06);
          margin-bottom: 18px;
        }

        .periodControl,
        .searchControl,
        .selectControl {
          min-height: 46px;
          display: flex;
          align-items: center;
          gap: 10px;
          border: 1px solid #dfe4da;
          background: #fff;
          border-radius: 12px;
          padding: 0 12px;
          overflow: hidden;
        }

        .periodControl span,
        .selectControl span {
          color: #253324;
          font-weight: 850;
          font-size: 13px;
          white-space: nowrap;
        }

        .searchControl span {
          font-size: 22px;
          color: #7b8676;
        }

        .periodControl input,
        .searchControl input,
        .selectControl select {
          width: 100%;
          border: 0;
          outline: 0;
          background: transparent;
          color: #1f2b20;
          font-size: 14px;
          min-width: 0;
        }

        .filterBtn,
        .exportGroup button {
          min-height: 46px;
          border: 1px solid #dfe4da;
          background: #fff;
          color: #1f2b20;
          border-radius: 12px;
          padding: 0 16px;
          font-weight: 800;
        }

        .exportGroup {
          display: inline-flex;
          gap: 7px;
          justify-content: flex-end;
        }

        .metricsGrid {
          display: grid;
          gap: 10px;
          margin-bottom: 16px;
          min-width: 0;
        }

        .metricsGrid.metrics-4 {
          grid-template-columns: repeat(4, minmax(0, 1fr));
        }

        .metricsGrid.metrics-5 {
          grid-template-columns: repeat(5, minmax(0, 1fr));
        }

        .metricCard {
          min-height: 74px;
          display: flex;
          align-items: center;
          gap: 8px;
          background: rgba(255, 255, 255, 0.94);
          border: 1px solid #e4e7df;
          border-radius: 13px;
          padding: 9px 10px;
          box-shadow: 0 10px 20px rgba(22, 38, 22, 0.05);
          overflow: hidden;
          min-width: 0;
        }

        .metricCard > div:last-child {
          min-width: 0;
        }

        .metricIcon {
          width: 36px;
          height: 36px;
          display: grid;
          place-items: center;
          border-radius: 50%;
          flex: 0 0 auto;
          font-size: 17px;
          font-weight: 900;
        }

        .metricCard.green .metricIcon { background: #e8f4e1; color: #2f7638; }
        .metricCard.amber .metricIcon { background: #fff1cf; color: #c98200; }
        .metricCard.blue .metricIcon { background: #e9f2ff; color: #1f67bf; }
        .metricCard.red .metricIcon { background: #ffe6e3; color: #cb3a2f; }

        .metricCard p {
          margin: 0 0 4px;
          color: #5a6457;
          font-weight: 750;
          font-size: 11px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .metricCard strong {
          display: block;
          color: #142417;
          font-size: clamp(17px, 1.25vw, 22px);
          line-height: 1;
          letter-spacing: -0.04em;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .metricCard span:not(.metricIcon) {
          display: block;
          margin-top: 4px;
          color: #667261;
          font-size: 10.5px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .detailLayout {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 305px;
          gap: 16px;
          align-items: start;
          width: 100%;
          max-width: 100%;
          min-width: 0;
          overflow: visible;
        }

        .mainColumn,
        .sideColumn {
          display: grid;
          gap: 14px;
          min-width: 0;
          max-width: 100%;
        }

        .sideColumn {
          position: sticky;
          top: 18px;
        }

        .tablePanel,
        .activityPanel,
        .chartCard,
        .sideCard,
        .loadingCard,
        .errorState {
          background: rgba(255, 255, 255, 0.94);
          border: 1px solid #e2e6dc;
          border-radius: 18px;
          box-shadow: 0 16px 38px rgba(24, 39, 25, 0.07);
        }

        .panelHeader,
        .chartHeader,
        .sideHeader {
          display: flex;
          justify-content: space-between;
          gap: 14px;
          align-items: flex-start;
          padding: 18px 18px 14px;
          border-bottom: 1px solid #edf0e8;
        }

        .panelHeader.compact {
          border-bottom: 0;
          padding-bottom: 8px;
        }

        .panelHeader h3,
        .chartHeader h3,
        .sideHeader h3 {
          margin: 0;
          color: #152416;
          font-size: 18px;
          letter-spacing: -0.02em;
        }

        .panelHeader p,
        .chartHeader p,
        .mutedText {
          margin: 4px 0 0;
          color: #657060;
          font-size: 13px;
        }

        .tablePanel {
          min-width: 0;
          max-width: 100%;
          overflow: hidden;
        }

        .tableScroller {
          display: block;
          width: 100%;
          max-width: 100%;
          overflow-x: auto;
          overflow-y: hidden;
          overscroll-behavior-x: contain;
          scrollbar-width: thin;
          scrollbar-color: #91aa85 #f2f4ec;
        }

        .tableScroller::-webkit-scrollbar { height: 10px; }
        .tableScroller::-webkit-scrollbar-track { background: #f2f4ec; border-radius: 999px; }
        .tableScroller::-webkit-scrollbar-thumb { background: #91aa85; border-radius: 999px; }

        .inventoryTable {
          width: max-content;
          min-width: 1040px;
          max-width: none;
          border-collapse: collapse;
          font-size: 13px;
        }

        .inventoryTable th,
        .inventoryTable td {
          padding: 14px 14px;
          border-bottom: 1px solid #edf0e8;
          text-align: left;
          white-space: nowrap;
          vertical-align: middle;
        }

        .inventoryTable th {
          color: #1f2d20;
          background: linear-gradient(180deg, #fafaf6, #f6f8f1);
          font-weight: 850;
          font-size: 12px;
        }

        .inventoryTable tbody tr:hover td {
          background: #fbfdf7;
        }

        .inventoryTable .outputCell {
          color: #1e5629;
          font-weight: 850;
          background: rgba(232, 244, 225, 0.24);
        }

        .rowActions {
          display: inline-flex;
          gap: 6px;
        }

        .rowActions button {
          border: 1px solid #dfe4da;
          background: #fff;
          border-radius: 9px;
          padding: 6px 9px;
          font-weight: 800;
          color: #315437;
        }

        .tableEmpty,
        .emptyMini {
          padding: 18px;
          text-align: center;
          color: #687365;
        }

        .tableEmpty strong,
        .emptyMini strong {
          display: block;
          color: #283629;
          margin-bottom: 5px;
        }

        .emptyMini p {
          margin: 0;
          font-size: 13px;
          line-height: 1.45;
        }

        .successMini {
          background: #f3f9ef;
          border-radius: 14px;
          margin: 14px;
        }

        .sideCard {
          padding-bottom: 10px;
          overflow: hidden;
          min-width: 0;
        }

        .sideHeader {
          align-items: center;
          padding: 15px 16px;
          background: #f8f8f0;
        }

        .sideHeader span {
          color: #2f7638;
          font-size: 18px;
        }

        .infoRow {
          display: flex;
          justify-content: space-between;
          gap: 14px;
          align-items: flex-start;
          padding: 10px 16px;
          color: #5f6b5b;
          font-size: 13px;
        }

        .infoRow strong {
          color: #1c281d;
          text-align: right;
        }

        .sideLink {
          display: flex;
          justify-content: center;
          gap: 8px;
          width: calc(100% - 32px);
          margin: 12px 16px 0;
          padding: 11px;
          border: 0;
          background: #f2f8ee;
          color: #2b7233;
          border-radius: 12px;
          font-weight: 850;
        }

        .approvalSteps {
          display: grid;
          gap: 10px;
          padding: 14px 16px;
        }

        .approvalStep {
          display: flex;
          gap: 10px;
          align-items: flex-start;
        }

        .approvalStep > span {
          width: 28px;
          height: 28px;
          display: grid;
          place-items: center;
          border-radius: 50%;
          background: #eef1eb;
          color: #667261;
          font-weight: 900;
          flex: 0 0 auto;
        }

        .approvalStep.done > span { background: #2f7638; color: #fff; }
        .approvalStep.active > span { background: #d99011; color: #fff; }
        .approvalStep strong { display: block; font-size: 13px; color: #1c281d; }
        .approvalStep small { display: block; color: #707a6c; margin-top: 2px; }

        .approvalActions {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 7px;
          padding: 0 16px;
        }

        .approvalActions button {
          min-height: 34px;
          border: 1px solid #dfe4da;
          border-radius: 10px;
          background: #fff;
          color: #2d6733;
          font-weight: 850;
        }

        .approvalActions button:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }

        .alertList,
        .accessList {
          display: grid;
          gap: 10px;
          padding: 14px 16px 0;
        }

        .alertItem,
        .accessUser,
        .activityLine {
          display: flex;
          gap: 10px;
          align-items: flex-start;
        }

        .alertItem > span,
        .accessUser > span,
        .activityDot {
          width: 30px;
          height: 30px;
          display: grid;
          place-items: center;
          border-radius: 50%;
          background: #f4f7ef;
          color: #2f7638;
          font-weight: 900;
          flex: 0 0 auto;
        }

        .alertItem.warning > span { background: #fff1cf; color: #d99011; }
        .alertItem.critical > span,
        .alertItem.danger > span { background: #ffe6e3; color: #cb3a2f; }

        .alertItem strong,
        .accessUser strong,
        .activityLine strong {
          display: block;
          color: #1c281d;
          font-size: 13px;
        }

        .alertItem small,
        .accessUser small,
        .activityLine small {
          display: block;
          color: #717b6c;
          margin-top: 2px;
          font-size: 12px;
        }

        .accessUser em {
          margin-left: auto;
          color: #5c7b55;
          font-size: 12px;
          font-style: normal;
          font-weight: 800;
        }

        .moduleInfoFullCard {
          overflow: hidden;
        }

        .moduleInfoTop {
          display: flex;
          gap: 12px;
          padding: 14px 18px;
          align-items: center;
          border-bottom: 1px solid #edf0e8;
        }

        .horizontalInfoTop {
          justify-content: space-between;
          background: #f8f8f0;
        }

        .moduleInfoTitle {
          display: inline-flex;
          align-items: center;
          gap: 9px;
          min-width: 0;
        }

        .moduleInfoTitle > span {
          width: 34px;
          height: 34px;
          display: grid;
          place-items: center;
          border-radius: 50%;
          background: #e8f4e1;
          color: #2f7638;
          font-size: 17px;
          flex: 0 0 auto;
        }

        .moduleInfoTop h3 {
          margin: 0;
          font-size: 16px;
          white-space: nowrap;
          font-weight: 850;
        }

        .moduleSlug {
          max-width: 42%;
          color: #40503d;
          font-size: 13px;
          font-weight: 850;
          text-align: right;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .moduleInfoRows {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 0;
          padding: 8px 8px 10px;
        }

        .moduleInfoFullCard .infoRow {
          display: grid;
          gap: 5px;
          padding: 10px 12px;
          border-right: 1px solid #edf0e8;
          min-width: 0;
        }

        .moduleInfoFullCard .infoRow:nth-child(4n) {
          border-right: 0;
        }

        .moduleInfoFullCard .infoRow span {
          font-size: 11px;
          font-weight: 800;
          color: #75806f;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .moduleInfoFullCard .infoRow strong {
          text-align: left;
          font-size: 13px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .chartsGrid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 14px;
          min-width: 0;
        }

        .chartCard {
          overflow: hidden;
          min-width: 0;
        }

        .chartHeader {
          border-bottom: 0;
          align-items: center;
        }

        .chartHeader span {
          border: 1px solid #e1e5dc;
          border-radius: 10px;
          padding: 8px 10px;
          color: #5f6b5b;
          font-size: 12px;
          font-weight: 800;
          background: #fff;
        }

        .barChart {
          display: flex;
          align-items: end;
          gap: 10px;
          min-height: 165px;
          padding: 10px 16px 18px;
          border-top: 1px solid #f1f3ed;
        }

        .compactBarChart {
          min-height: 156px;
        }

        .barItem {
          flex: 1;
          display: grid;
          gap: 6px;
          justify-items: center;
          align-items: end;
          text-align: center;
        }

        .barTrack {
          height: 105px;
          width: 100%;
          max-width: 36px;
          display: flex;
          align-items: end;
          border-radius: 14px 14px 6px 6px;
          background: #f1f4ee;
          overflow: hidden;
        }

        .barTrack span {
          width: 100%;
          border-radius: 14px 14px 6px 6px;
          background: linear-gradient(180deg, #79a764, #3e803f);
        }

        .barItem strong {
          color: #233224;
          font-size: 13px;
        }

        .barItem small {
          color: #6f796a;
          font-size: 11px;
          min-height: 26px;
        }

        .donutWrap {
          display: grid;
          grid-template-columns: 106px 1fr;
          gap: 12px;
          align-items: center;
          padding: 14px;
          border-top: 1px solid #f1f3ed;
        }

        .compactDonutWrap {
          grid-template-columns: 96px 1fr;
        }

        .donutSvg {
          width: 104px;
          height: 104px;
          transform: rotate(-90deg);
        }

        .donutLegend {
          display: grid;
          gap: 10px;
        }

        .donutLegend div {
          display: grid;
          grid-template-columns: 10px 1fr auto;
          gap: 8px;
          align-items: center;
          color: #53604f;
          font-size: 12px;
        }

        .donutLegend span {
          width: 10px;
          height: 10px;
          border-radius: 50%;
        }

        .donutLegend strong {
          color: #233224;
        }

        .donutLegend em {
          font-style: normal;
          font-weight: 800;
        }

        .compactChart {
          min-width: 0;
        }

        .smallChartHeader {
          padding: 15px 16px 8px;
        }

        .smallChartHeader h3 {
          font-size: 16px;
        }

        .smallChartHeader p {
          font-size: 12px;
        }

        .lineChartWrap {
          padding: 10px 16px 14px;
          border-top: 1px solid #f1f3ed;
        }

        .lineChartSvg {
          width: 100%;
          height: 126px;
          overflow: visible;
        }

        .gridLines {
          fill: none;
          stroke: #edf1e9;
          stroke-width: 1;
        }

        .trendLine {
          fill: none;
          stroke: #2f7638;
          stroke-width: 4;
          stroke-linecap: round;
          stroke-linejoin: round;
        }

        .trendPoint {
          fill: #fff;
          stroke: #2f7638;
          stroke-width: 3;
        }

        .lineAxisLabels {
          display: grid;
          grid-template-columns: repeat(6, minmax(0, 1fr));
          gap: 4px;
          margin-top: 4px;
          color: #6f796a;
          font-size: 10.5px;
          text-align: center;
        }

        .activityPanel {
          padding-bottom: 12px;
        }

        .activityList {
          display: grid;
          gap: 0;
          padding: 0 18px 8px;
        }

        .activityLine {
          padding: 13px 0;
          border-bottom: 1px solid #edf0e8;
          align-items: center;
        }

        .activityLine time {
          margin-left: auto;
          color: #6e7969;
          font-size: 12px;
          white-space: nowrap;
        }

        .footerNote {
          margin: 18px 0 0;
          color: #9aa198;
          font-size: 13px;
        }

        .loadingCard {
          min-height: 220px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 16px;
          max-width: 720px;
          margin: 16vh auto 0;
          padding: 30px;
        }

        .loader {
          width: 34px;
          height: 34px;
          border-radius: 50%;
          border: 4px solid #e5eadf;
          border-top-color: #327a3b;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin { to { transform: rotate(360deg); } }

        .loadingCard strong {
          display: block;
          font-size: 20px;
          color: #1c281d;
        }

        .loadingCard p {
          margin: 5px 0 0;
          color: #657060;
        }

        .errorState {
          max-width: 620px;
          margin: 12vh auto 0;
          padding: 34px;
          text-align: center;
        }

        .errorState > span {
          display: grid;
          place-items: center;
          width: 62px;
          height: 62px;
          border-radius: 50%;
          background: #ffe6e3;
          color: #cb3a2f;
          margin: 0 auto 18px;
          font-size: 30px;
        }

        .errorState h2 {
          margin: 0 0 8px;
          font-size: 28px;
        }

        .errorState p {
          color: #657060;
        }

        .errorActions {
          display: flex;
          justify-content: center;
          gap: 12px;
          margin-top: 20px;
        }

        .errorActions a,
        .errorActions button {
          min-height: 42px;
          display: inline-flex;
          align-items: center;
          border-radius: 12px;
          padding: 0 16px;
          font-weight: 850;
          border: 1px solid #dfe4da;
          background: #fff;
          color: #1c281d;
          text-decoration: none;
        }

        .diToast {
          position: fixed;
          top: 22px;
          right: 22px;
          z-index: 100;
          display: flex;
          align-items: center;
          gap: 14px;
          max-width: 440px;
          padding: 13px 14px;
          border-radius: 14px;
          background: #172519;
          color: #fff;
          box-shadow: 0 20px 46px rgba(16, 32, 18, 0.22);
          font-weight: 800;
        }

        .diToast.success { background: #2f7638; }
        .diToast.error { background: #b63328; }
        .diToast.warning { background: #a36a09; }

        .diToast button {
          width: 26px;
          height: 26px;
          border: 0;
          border-radius: 50%;
          color: #fff;
          background: rgba(255, 255, 255, 0.18);
          font-size: 17px;
        }

        .modalOverlay {
          position: fixed;
          inset: 0;
          z-index: 90;
          display: grid;
          place-items: center;
          padding: 22px;
          background: rgba(20, 36, 23, 0.52);
          backdrop-filter: blur(8px);
        }

        .recordModal,
        .confirmModal {
          width: min(900px, 100%);
          max-height: calc(100vh - 44px);
          overflow: auto;
          background: #fffdf8;
          border: 1px solid #e5e7dd;
          border-radius: 24px;
          box-shadow: 0 30px 90px rgba(13, 28, 15, 0.32);
          padding: 22px;
        }

        .confirmModal {
          width: min(460px, 100%);
        }

        .modalHeader {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          align-items: flex-start;
          margin-bottom: 16px;
        }

        .modalHeader p {
          margin: 0 0 4px;
          color: #2f7638;
          font-size: 12px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .modalHeader h2,
        .confirmModal h2 {
          margin: 0;
          font-size: 24px;
          color: #19291a;
        }

        .modalHeader button {
          width: 36px;
          height: 36px;
          border: 0;
          border-radius: 50%;
          background: #eff4eb;
          color: #1c281d;
          font-size: 22px;
        }

        .modalGrid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
        }

        .modalGrid label {
          display: flex;
          flex-direction: column;
          gap: 7px;
        }

        .modalGrid label.wide {
          grid-column: 1 / -1;
        }

        .modalGrid span {
          color: #354235;
          font-weight: 850;
          font-size: 13px;
        }

        .modalGrid input,
        .modalGrid select,
        .modalGrid textarea {
          width: 100%;
          border: 1px solid #dfe4da;
          border-radius: 12px;
          padding: 12px 13px;
          background: #fff;
          color: #1c281d;
          font-size: 14px;
          outline: none;
        }

        .modalGrid input:focus,
        .modalGrid select:focus,
        .modalGrid textarea:focus {
          border-color: #3c8742;
          box-shadow: 0 0 0 4px rgba(64, 145, 70, 0.1);
        }

        .modalGrid small {
          color: #7b8676;
        }

        .modalActions {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          margin-top: 18px;
        }

        .confirmModal p {
          color: #657060;
          line-height: 1.55;
        }

        @media (max-width: 1180px) {
          .metricsGrid.metrics-5 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
          .detailLayout { grid-template-columns: 1fr; }
          .sideColumn { position: static; grid-template-columns: repeat(3, minmax(0, 1fr)); }
          .chartsGrid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
          .moduleInfoRows { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .moduleInfoFullCard .infoRow:nth-child(4n) { border-right: 1px solid #edf0e8; }
          .moduleInfoFullCard .infoRow:nth-child(2n) { border-right: 0; }
        }

        @media (max-width: 760px) {
          .metricsGrid.metrics-4,
          .metricsGrid.metrics-5 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .chartsGrid { grid-template-columns: 1fr; }
          .sideColumn { grid-template-columns: 1fr; }
          .moduleInfoRows { grid-template-columns: 1fr; }
          .moduleInfoFullCard .infoRow,
          .moduleInfoFullCard .infoRow:nth-child(2n),
          .moduleInfoFullCard .infoRow:nth-child(4n) { border-right: 0; border-bottom: 1px solid #edf0e8; }
        }

        @media (max-width: 640px) {
          .ranchDetailPage { padding: 18px; }
          .detailHeader { flex-direction: column; }
          .headerActions { padding-top: 0; justify-content: flex-start; }
          .filterBar { grid-template-columns: 1fr; }
          .metricsGrid,
          .metricsGrid.metrics-4,
          .metricsGrid.metrics-5 { grid-template-columns: 1fr; }
          .chartsGrid { grid-template-columns: 1fr; }
          .sideColumn { grid-template-columns: 1fr; }
          .modalGrid { grid-template-columns: 1fr; }
          .titleLine h1 { font-size: 32px; }
        }
      `}</style>
    </>
  );
}
