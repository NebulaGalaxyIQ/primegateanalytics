import authService from "./auth";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "") ||
  "http://127.0.0.1:8000";

const REPORTS_BASE = `${API_BASE_URL}/reports`;
const VALID_FORMATS = ["csv", "pdf", "docx"];

function isBrowser() {
  return typeof window !== "undefined";
}

function getStoredToken() {
  if (!isBrowser()) return null;

  return (
    authService?.getToken?.() ||
    localStorage.getItem("token") ||
    localStorage.getItem("access_token") ||
    localStorage.getItem("authToken") ||
    null
  );
}

function buildAuthHeaders(token) {
  const resolvedToken = token || getStoredToken();
  if (!resolvedToken) {
    throw new Error("Authentication token not found");
  }

  return {
    Authorization: `Bearer ${resolvedToken}`,
  };
}

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

  return new Error(detail);
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

function triggerBrowserDownload(blob, filename) {
  if (!isBrowser()) return;

  const objectUrl = window.URL.createObjectURL(blob);
  try {
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = filename || "report";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } finally {
    window.setTimeout(() => window.URL.revokeObjectURL(objectUrl), 1000);
  }
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

function validateMonthlyParams(params = {}) {
  const { month, year, format } = params;

  if (!month || Number(month) < 1 || Number(month) > 12) {
    throw new Error("month must be between 1 and 12");
  }

  if (!year || Number(year) < 2000) {
    throw new Error("year is required");
  }

  if (format && !VALID_FORMATS.includes(String(format).trim().toLowerCase())) {
    throw new Error("format must be csv, pdf, or docx");
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

function getTodayDateStr() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

/* ============================================================================
   QUERY BUILDERS
============================================================================ */

function buildOrdersMonthlyQuery(params = {}) {
  validateMonthlyParams(params);

  return buildQueryString({
    month: params.month,
    year: params.year,
    order_type: params.order_type,
    order_profile: params.order_profile,
    order_subtype: params.order_subtype,
    status: params.status,
    enterprise_name: params.enterprise_name,
    jurisdiction: params.jurisdiction,
    breakeven_quantity_kg: params.breakeven_quantity_kg,
    prepared_by: params.prepared_by,
    include_summary:
      params.include_summary !== undefined ? params.include_summary : true,
    include_sections:
      params.include_sections !== undefined ? params.include_sections : true,
    include_totals:
      params.include_totals !== undefined ? params.include_totals : true,
    include_animal_projection:
      params.include_animal_projection !== undefined
        ? params.include_animal_projection
        : true,
    include_financial_summary:
      params.include_financial_summary !== undefined
        ? params.include_financial_summary
        : true,
    format: params.format ? normalizeFormat(params.format) : undefined,
  });
}

function buildFrozenContainersMonthlyQuery(params = {}) {
  validateMonthlyParams(params);

  return buildQueryString({
    month: params.month,
    year: params.year,
    status: params.status,
    enterprise_name: params.enterprise_name,
    jurisdiction: params.jurisdiction,
    prepared_by: params.prepared_by,
    include_summary:
      params.include_summary !== undefined ? params.include_summary : true,
    include_rows: params.include_rows !== undefined ? params.include_rows : true,
    include_totals:
      params.include_totals !== undefined ? params.include_totals : true,
    format: params.format ? normalizeFormat(params.format) : undefined,
  });
}

function buildBreakevenSummaryQuery(params = {}) {
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
    include_rows: params.include_rows !== undefined ? params.include_rows : true,
    format: params.format ? normalizeFormat(params.format) : undefined,
  });
}

/* ============================================================================
   ORDERS MONTHLY REPORT
============================================================================ */

export async function getOrdersMonthlyReportData(params = {}, token) {
  const query = buildOrdersMonthlyQuery(params);

  return requestJson(`${REPORTS_BASE}/orders/monthly${query}`, {
    method: "GET",
    headers: buildAuthHeaders(token),
  });
}

export async function exportOrdersMonthlyReport(params = {}, token) {
  const format = normalizeFormat(params.format, "pdf");
  const query = buildOrdersMonthlyQuery({ ...params, format });

  const { blob, mediaType } = await requestBlob(
    `${REPORTS_BASE}/orders/monthly/export${query}`,
    {
      method: "GET",
      headers: buildAuthHeaders(token),
    }
  );

  const today = getTodayDateStr();
  const filename = `Order Confirmed Report ${today}.${format}`;

  return { blob, filename, mediaType };
}

export async function downloadOrdersMonthlyReport(params = {}, token) {
  const { blob, filename, mediaType } = await exportOrdersMonthlyReport(
    params,
    token
  );

  if (isBrowser()) triggerBrowserDownload(blob, filename);
  return { blob, filename, mediaType };
}

export async function createOrdersMonthlyReportPreview(params = {}, token) {
  const result = await exportOrdersMonthlyReport(
    { ...params, format: "pdf" },
    token
  );

  if (!isBrowser()) return result;
  return { ...result, ...createBlobPreviewUrl(result.blob) };
}

export function getOrdersMonthlyReportPreviewUrl(params = {}) {
  const query = buildOrdersMonthlyQuery({
    ...params,
    format: normalizeFormat(params.format, "pdf"),
  });

  return `${REPORTS_BASE}/orders/monthly/export${query}`;
}

/* ============================================================================
   FROZEN CONTAINERS MONTHLY REPORT
============================================================================ */

export async function getFrozenContainersMonthlyReportData(params = {}, token) {
  const query = buildFrozenContainersMonthlyQuery(params);

  return requestJson(`${REPORTS_BASE}/orders/frozen-containers/monthly${query}`, {
    method: "GET",
    headers: buildAuthHeaders(token),
  });
}

export async function exportFrozenContainersMonthlyReport(params = {}, token) {
  const format = normalizeFormat(params.format, "pdf");
  const query = buildFrozenContainersMonthlyQuery({ ...params, format });

  const { blob, mediaType } = await requestBlob(
    `${REPORTS_BASE}/orders/frozen-containers/monthly/export${query}`,
    {
      method: "GET",
      headers: buildAuthHeaders(token),
    }
  );

  const today = getTodayDateStr();
  const filename = `Frozen Confirmed Containers ${today}.${format}`;

  return { blob, filename, mediaType };
}

export async function downloadFrozenContainersMonthlyReport(params = {}, token) {
  const { blob, filename, mediaType } =
    await exportFrozenContainersMonthlyReport(params, token);

  if (isBrowser()) triggerBrowserDownload(blob, filename);
  return { blob, filename, mediaType };
}

export async function createFrozenContainersMonthlyReportPreview(
  params = {},
  token
) {
  const result = await exportFrozenContainersMonthlyReport(
    { ...params, format: "pdf" },
    token
  );

  if (!isBrowser()) return result;
  return { ...result, ...createBlobPreviewUrl(result.blob) };
}

export function getFrozenContainersMonthlyReportPreviewUrl(params = {}) {
  const query = buildFrozenContainersMonthlyQuery({
    ...params,
    format: normalizeFormat(params.format, "pdf"),
  });

  return `${REPORTS_BASE}/orders/frozen-containers/monthly/export${query}`;
}

/* ============================================================================
   BREAKEVEN SUMMARY REPORT
============================================================================ */

export async function getBreakevenSummaryReportData(params = {}, token) {
  const query = buildBreakevenSummaryQuery(params);

  return requestJson(`${REPORTS_BASE}/breakeven/summary${query}`, {
    method: "GET",
    headers: buildAuthHeaders(token),
  });
}

export async function exportBreakevenSummaryReport(params = {}, token) {
  const format = normalizeFormat(params.format, "pdf");
  const query = buildBreakevenSummaryQuery({ ...params, format });

  const { blob, mediaType } = await requestBlob(
    `${REPORTS_BASE}/breakeven/summary/export${query}`,
    {
      method: "GET",
      headers: buildAuthHeaders(token),
    }
  );

  const today = getTodayDateStr();
  const filename = `Breakeven Summary Report ${today}.${format}`;

  return { blob, filename, mediaType };
}

export async function downloadBreakevenSummaryReport(params = {}, token) {
  const { blob, filename, mediaType } =
    await exportBreakevenSummaryReport(params, token);

  if (isBrowser()) triggerBrowserDownload(blob, filename);
  return { blob, filename, mediaType };
}

export async function createBreakevenSummaryReportPreview(params = {}, token) {
  const result = await exportBreakevenSummaryReport(
    { ...params, format: "pdf" },
    token
  );

  if (!isBrowser()) return result;
  return { ...result, ...createBlobPreviewUrl(result.blob) };
}

export function getBreakevenSummaryReportPreviewUrl(params = {}) {
  const query = buildBreakevenSummaryQuery({
    ...params,
    format: normalizeFormat(params.format, "pdf"),
  });

  return `${REPORTS_BASE}/breakeven/summary/export${query}`;
}

/* ============================================================================
   GENERIC REPORT EXPORT
============================================================================ */

export async function exportGenericReport(
  reportType,
  params = {},
  token
) {
  const normalizedReportType = String(reportType || "")
    .trim()
    .toLowerCase()
    .replace(/-/g, "_")
    .replace(/\s+/g, "_");

  if (
    ![
      "orders_monthly",
      "frozen_containers_monthly",
      "breakeven_summary",
    ].includes(normalizedReportType)
  ) {
    throw new Error(
      "reportType must be orders_monthly, frozen_containers_monthly, or breakeven_summary"
    );
  }

  const format = normalizeFormat(params.format, "pdf");

  const query = buildQueryString({
    report_type: normalizedReportType,
    format,
    month: params.month,
    year: params.year,
    report_date: params.report_date,
    setting_id: params.setting_id,
    order_type: params.order_type,
    order_profile: params.order_profile,
    order_subtype: params.order_subtype,
    status: params.status,
    enterprise_name: params.enterprise_name,
    jurisdiction: params.jurisdiction,
    breakeven_quantity_kg: params.breakeven_quantity_kg,
    prepared_by: params.prepared_by,
    include_summary:
      params.include_summary !== undefined ? params.include_summary : true,
    include_sections:
      params.include_sections !== undefined ? params.include_sections : true,
    include_totals:
      params.include_totals !== undefined ? params.include_totals : true,
    include_rows: params.include_rows !== undefined ? params.include_rows : true,
    include_animal_projection:
      params.include_animal_projection !== undefined
        ? params.include_animal_projection
        : true,
    include_financial_summary:
      params.include_financial_summary !== undefined
        ? params.include_financial_summary
        : true,
  });

  const { blob, mediaType } = await requestBlob(
    `${REPORTS_BASE}/export${query}`,
    {
      method: "GET",
      headers: buildAuthHeaders(token),
    }
  );

  const today = getTodayDateStr();

  let filename = `Report ${today}.${format}`;
  if (normalizedReportType === "orders_monthly") {
    filename = `Order Confirmed Report ${today}.${format}`;
  } else if (normalizedReportType === "frozen_containers_monthly") {
    filename = `Frozen Confirmed Containers ${today}.${format}`;
  } else if (normalizedReportType === "breakeven_summary") {
    filename = `Breakeven Summary Report ${today}.${format}`;
  }

  return { blob, filename, mediaType };
}

export async function downloadGenericReport(reportType, params = {}, token) {
  const { blob, filename, mediaType } = await exportGenericReport(
    reportType,
    params,
    token
  );

  if (isBrowser()) triggerBrowserDownload(blob, filename);
  return { blob, filename, mediaType };
}

/* ============================================================================
   GENERIC HELPERS
============================================================================ */

export async function downloadReportBlob(blob, filename = "report") {
  if (!isBrowser()) return { blob, filename };
  triggerBrowserDownload(blob, filename);
  return { filename };
}

export function getReportAuthHeaders(token) {
  return buildAuthHeaders(token);
}

const reportService = {
  getOrdersMonthlyReportData,
  exportOrdersMonthlyReport,
  downloadOrdersMonthlyReport,
  createOrdersMonthlyReportPreview,
  getOrdersMonthlyReportPreviewUrl,

  getFrozenContainersMonthlyReportData,
  exportFrozenContainersMonthlyReport,
  downloadFrozenContainersMonthlyReport,
  createFrozenContainersMonthlyReportPreview,
  getFrozenContainersMonthlyReportPreviewUrl,

  getBreakevenSummaryReportData,
  exportBreakevenSummaryReport,
  downloadBreakevenSummaryReport,
  createBreakevenSummaryReportPreview,
  getBreakevenSummaryReportPreviewUrl,

  exportGenericReport,
  downloadGenericReport,

  downloadReportBlob,
  getReportAuthHeaders,
};

export default reportService;