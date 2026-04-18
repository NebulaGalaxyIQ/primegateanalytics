import authService from "./auth";

/* ============================================================================
   Breakeven Service
   ----------------------------------------------------------------------------
   Covers:
   - breakeven summary data
   - breakeven summary export / download / preview
   - breakeven settings list / create / update / activate / deactivate

   IMPORTANT:
   - In local development, it falls back to http://127.0.0.1:8000
   - In production, set NEXT_PUBLIC_API_URL or NEXT_PUBLIC_BREAKEVEN_API_URL
   - If no production env is set, it falls back to the current site origin
     instead of localhost, so it will not try to call your own device
============================================================================ */

/* ============================================================================
   Base URL / Constants
============================================================================ */

const LOCAL_API_ROOT = "http://127.0.0.1:8000";
const VALID_FORMATS = ["csv", "pdf", "docx"];
const VALID_SCOPE_TYPES = ["global", "monthly"];

/* ============================================================================
   Environment / URL helpers
============================================================================ */

function isBrowser() {
  return typeof window !== "undefined";
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function stripTrailingSlashes(value) {
  return String(value || "").replace(/\/+$/, "");
}

function isLocalHostname(hostname) {
  if (!hostname) return false;

  const normalized = String(hostname).trim().toLowerCase();

  return (
    normalized === "localhost" ||
    normalized === "127.0.0.1" ||
    normalized === "::1" ||
    normalized.endsWith(".localhost")
  );
}

function resolveApiRoot() {
  const explicitEnvRoot =
    process.env.NEXT_PUBLIC_BREAKEVEN_API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL;

  if (isNonEmptyString(explicitEnvRoot)) {
    return stripTrailingSlashes(explicitEnvRoot);
  }

  if (isBrowser()) {
    const currentOrigin = stripTrailingSlashes(window.location.origin);
    const currentHostname = window.location.hostname;

    if (isLocalHostname(currentHostname)) {
      return LOCAL_API_ROOT;
    }

    return currentOrigin;
  }

  return LOCAL_API_ROOT;
}

const API_BASE_URL = resolveApiRoot();
const BREAKEVEN_BASE = `${API_BASE_URL}/breakeven`;
const BREAKEVEN_SETTINGS_BASE = `${BREAKEVEN_BASE}/settings`;
const BREAKEVEN_REPORT_BASE = `${API_BASE_URL}/reports/breakeven/summary`;

/* ============================================================================
   Auth helpers
============================================================================ */

function getStoredToken() {
  if (!isBrowser()) return null;

  return (
    localStorage.getItem("token") ||
    localStorage.getItem("access_token") ||
    localStorage.getItem("authToken") ||
    null
  );
}

function buildAuthHeaders(token) {
  const resolvedToken =
    token ||
    authService?.getToken?.() ||
    getStoredToken();

  if (!resolvedToken) {
    throw new Error("Authentication token not found");
  }

  return {
    Authorization: `Bearer ${resolvedToken}`,
    Accept: "application/json",
  };
}

/* ============================================================================
   Generic value / query helpers
============================================================================ */

function normalizeValue(value) {
  if (value === undefined || value === null || value === "") return null;
  return value;
}

function buildQueryString(params = {}) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    const normalized = normalizeValue(value);
    if (normalized === null) return;

    if (Array.isArray(normalized)) {
      normalized.forEach((item) => {
        if (item !== undefined && item !== null && item !== "") {
          searchParams.append(key, String(item));
        }
      });
      return;
    }

    if (typeof normalized === "boolean") {
      searchParams.append(key, normalized ? "true" : "false");
      return;
    }

    searchParams.append(key, String(normalized));
  });

  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

function normalizeFormat(format, fallback = "pdf") {
  const value = String(format || fallback)
    .trim()
    .toLowerCase();

  if (!VALID_FORMATS.includes(value)) {
    throw new Error("format must be csv, pdf, or docx");
  }

  return value;
}

function normalizeScopeType(scopeType) {
  if (scopeType === undefined || scopeType === null || scopeType === "") {
    return null;
  }

  const value = String(scopeType).trim().toLowerCase();

  if (!VALID_SCOPE_TYPES.includes(value)) {
    throw new Error("scope_type must be global or monthly");
  }

  return value;
}

function validateMonthYear(month, year) {
  if (month !== undefined && month !== null && month !== "") {
    const monthNum = Number(month);
    if (!Number.isInteger(monthNum) || monthNum < 1 || monthNum > 12) {
      throw new Error("month must be between 1 and 12");
    }
  }

  if (year !== undefined && year !== null && year !== "") {
    const yearNum = Number(year);
    if (!Number.isInteger(yearNum) || yearNum < 2000) {
      throw new Error("year must be 2000 or greater");
    }
  }
}

function getTodayDateStr() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

/* ============================================================================
   Error / request helpers
============================================================================ */

async function parseErrorResponse(response) {
  let detail = `Request failed with status ${response.status}`;

  try {
    const data = await response.json();

    if (typeof data?.detail === "string" && data.detail.trim()) {
      detail = data.detail;
    } else if (typeof data?.message === "string" && data.message.trim()) {
      detail = data.message;
    } else if (Array.isArray(data?.detail) && data.detail.length) {
      detail = data.detail
        .map((item) => {
          if (typeof item === "string") return item;
          if (typeof item?.msg === "string") return item.msg;
          return JSON.stringify(item);
        })
        .join(", ");
    }
  } catch (_) {
    try {
      const text = await response.text();
      if (text?.trim()) detail = text;
    } catch (_) {}
  }

  const error = new Error(detail);
  error.status = response.status;
  return error;
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) throw await parseErrorResponse(response);
  return response.json();
}

async function requestBlob(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) throw await parseErrorResponse(response);

  const blob = await response.blob();
  const mediaType =
    response.headers.get("content-type") || "application/octet-stream";

  return { blob, mediaType };
}

/* ============================================================================
   Download / preview helpers
============================================================================ */

function triggerBrowserDownload(blob, filename) {
  if (!isBrowser()) return;

  const objectUrl = window.URL.createObjectURL(blob);

  try {
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = filename || "download";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } finally {
    window.setTimeout(() => window.URL.revokeObjectURL(objectUrl), 1000);
  }
}

function createBlobPreviewUrl(blob) {
  if (!isBrowser()) {
    throw new Error("Preview URLs can only be created in the browser");
  }

  const objectUrl = window.URL.createObjectURL(blob);

  return {
    url: objectUrl,
    revoke: () => {
      try {
        window.URL.revokeObjectURL(objectUrl);
      } catch (_) {}
    },
  };
}

function buildBreakevenFilename(format) {
  const safeFormat = normalizeFormat(format, "pdf");
  const today = getTodayDateStr();
  return `Breakeven Summary Report ${today}.${safeFormat}`;
}

/* ============================================================================
   Query builders
============================================================================ */

function buildBreakevenSummaryQuery(params = {}) {
  validateMonthYear(params.month, params.year);

  return buildQueryString({
    report_date: params.report_date,
    month: params.month,
    year: params.year,
    setting_id: params.setting_id,
    order_type: params.order_type,
    order_profile: params.order_profile,
    order_subtype: params.order_subtype,
    enterprise_name: params.enterprise_name,
    jurisdiction: params.jurisdiction,
    prepared_by: params.prepared_by,
    include_rows:
      params.include_rows !== undefined ? params.include_rows : true,
  });
}

function buildBreakevenSummaryExportQuery(params = {}) {
  validateMonthYear(params.month, params.year);

  return buildQueryString({
    format: normalizeFormat(params.format, "pdf"),
    report_date: params.report_date,
    month: params.month,
    year: params.year,
    setting_id: params.setting_id,
    order_type: params.order_type,
    order_profile: params.order_profile,
    order_subtype: params.order_subtype,
    enterprise_name: params.enterprise_name,
    jurisdiction: params.jurisdiction,
    prepared_by: params.prepared_by,
    include_rows:
      params.include_rows !== undefined ? params.include_rows : true,
  });
}

function buildSettingsListQuery(params = {}) {
  validateMonthYear(params.month, params.year);

  return buildQueryString({
    scope_type: normalizeScopeType(params.scope_type),
    month: params.month,
    year: params.year,
    is_active: params.is_active,
  });
}

function sanitizeSettingPayload(payload = {}, isUpdate = false) {
  const cleaned = {
    setting_name: payload.setting_name,
    description: payload.description,
    scope_type: normalizeScopeType(payload.scope_type),
    month: payload.month,
    year: payload.year,
    break_even_quantity_tonnes: payload.break_even_quantity_tonnes,
    break_even_usd_per_tonne: payload.break_even_usd_per_tonne,
    notes: payload.notes,
    is_active: payload.is_active,
  };

  validateMonthYear(cleaned.month, cleaned.year);

  if (!isUpdate) {
    if (!cleaned.setting_name || !String(cleaned.setting_name).trim()) {
      throw new Error("setting_name is required");
    }

    if (!cleaned.scope_type) {
      throw new Error("scope_type is required");
    }

    if (
      cleaned.break_even_quantity_tonnes === undefined ||
      cleaned.break_even_quantity_tonnes === null ||
      cleaned.break_even_quantity_tonnes === ""
    ) {
      throw new Error("break_even_quantity_tonnes is required");
    }

    if (
      cleaned.break_even_usd_per_tonne === undefined ||
      cleaned.break_even_usd_per_tonne === null ||
      cleaned.break_even_usd_per_tonne === ""
    ) {
      throw new Error("break_even_usd_per_tonne is required");
    }
  }

  if (cleaned.scope_type === "monthly") {
    if (!cleaned.month || !cleaned.year) {
      throw new Error("month and year are required when scope_type is monthly");
    }
  }

  if (cleaned.scope_type === "global") {
    cleaned.month = null;
    cleaned.year = null;
  }

  Object.keys(cleaned).forEach((key) => {
    if (cleaned[key] === undefined) {
      delete cleaned[key];
    }
  });

  return cleaned;
}

/* ============================================================================
   Breakeven summary
============================================================================ */

export async function getBreakevenSummaryData(params = {}, token) {
  const query = buildBreakevenSummaryQuery(params);

  return requestJson(`${BREAKEVEN_REPORT_BASE}${query}`, {
    method: "GET",
    headers: buildAuthHeaders(token),
  });
}

export async function exportBreakevenSummary(params = {}, token) {
  const format = normalizeFormat(params.format, "pdf");
  const query = buildBreakevenSummaryExportQuery({ ...params, format });

  const { blob, mediaType } = await requestBlob(
    `${BREAKEVEN_REPORT_BASE}/export${query}`,
    {
      method: "GET",
      headers: buildAuthHeaders(token),
    }
  );

  const filename = buildBreakevenFilename(format);

  return { blob, filename, mediaType };
}

export async function downloadBreakevenSummary(params = {}, token) {
  const { blob, filename, mediaType } = await exportBreakevenSummary(
    params,
    token
  );

  if (isBrowser()) {
    triggerBrowserDownload(blob, filename);
  }

  return { blob, filename, mediaType };
}

export async function createBreakevenSummaryPreview(params = {}, token) {
  const result = await exportBreakevenSummary(
    { ...params, format: "pdf" },
    token
  );

  if (!isBrowser()) return result;

  return {
    ...result,
    ...createBlobPreviewUrl(result.blob),
  };
}

export function getBreakevenSummaryPreviewUrl(params = {}) {
  const query = buildBreakevenSummaryExportQuery({
    ...params,
    format: normalizeFormat(params.format, "pdf"),
  });

  return `${BREAKEVEN_REPORT_BASE}/export${query}`;
}

/* ============================================================================
   Breakeven settings
============================================================================ */

export async function listBreakevenSettings(params = {}, token) {
  const query = buildSettingsListQuery(params);

  return requestJson(`${BREAKEVEN_SETTINGS_BASE}${query}`, {
    method: "GET",
    headers: buildAuthHeaders(token),
  });
}

export async function getBreakevenSetting(settingId, token) {
  if (!settingId) throw new Error("settingId is required");

  return requestJson(`${BREAKEVEN_SETTINGS_BASE}/${settingId}`, {
    method: "GET",
    headers: buildAuthHeaders(token),
  });
}

export async function createBreakevenSetting(payload = {}, token) {
  const body = sanitizeSettingPayload(payload, false);

  return requestJson(`${BREAKEVEN_SETTINGS_BASE}`, {
    method: "POST",
    headers: {
      ...buildAuthHeaders(token),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

export async function updateBreakevenSetting(settingId, payload = {}, token) {
  if (!settingId) throw new Error("settingId is required");

  const body = sanitizeSettingPayload(payload, true);

  return requestJson(`${BREAKEVEN_SETTINGS_BASE}/${settingId}`, {
    method: "PUT",
    headers: {
      ...buildAuthHeaders(token),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

export async function activateBreakevenSetting(settingId, token) {
  if (!settingId) throw new Error("settingId is required");

  return requestJson(`${BREAKEVEN_SETTINGS_BASE}/${settingId}/activate`, {
    method: "POST",
    headers: buildAuthHeaders(token),
  });
}

export async function deactivateBreakevenSetting(settingId, token) {
  if (!settingId) throw new Error("settingId is required");

  return requestJson(`${BREAKEVEN_SETTINGS_BASE}/${settingId}/deactivate`, {
    method: "POST",
    headers: buildAuthHeaders(token),
  });
}

/* ============================================================================
   Generic helpers
============================================================================ */

export async function downloadBreakevenBlob(
  blob,
  filename = "breakeven-report"
) {
  if (!isBrowser()) return { blob, filename };
  triggerBrowserDownload(blob, filename);
  return { filename };
}

export function getBreakevenAuthHeaders(token) {
  return buildAuthHeaders(token);
}

/* ============================================================================
   Export
============================================================================ */

const breakevenService = {
  API_BASE_URL,
  BREAKEVEN_BASE,
  BREAKEVEN_SETTINGS_BASE,
  BREAKEVEN_REPORT_BASE,

  getBreakevenSummaryData,
  exportBreakevenSummary,
  downloadBreakevenSummary,
  createBreakevenSummaryPreview,
  getBreakevenSummaryPreviewUrl,

  listBreakevenSettings,
  getBreakevenSetting,
  createBreakevenSetting,
  updateBreakevenSetting,
  activateBreakevenSetting,
  deactivateBreakevenSetting,

  downloadBreakevenBlob,
  getBreakevenAuthHeaders,
};

export default breakevenService;