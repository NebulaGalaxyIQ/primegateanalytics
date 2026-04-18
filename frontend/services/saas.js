import axios from "axios";

/* ============================================================================
   SaaS Service
   ----------------------------------------------------------------------------
   Uses only:
   - axios
   - browser localStorage/sessionStorage

   Important:
   - Defaults directly to backend on http://127.0.0.1:8000
   - Avoids calling the frontend /saas page by mistake
   - Supports daily, weekly, monthly, and range reports + exports
============================================================================ */

/* ----------------------------------------------------------------------------
   Base URL helpers
----------------------------------------------------------------------------- */
function normalizeBaseUrl(value) {
  if (!value || typeof value !== "string") return "";
  return value.replace(/\/+$/, "");
}

function getApiBaseUrl() {
  const envCandidates = [
    typeof process !== "undefined" ? process.env.NEXT_PUBLIC_API_BASE_URL : "",
    typeof process !== "undefined" ? process.env.NEXT_PUBLIC_BACKEND_URL : "",
  ];

  for (const item of envCandidates) {
    const normalized = normalizeBaseUrl(item);
    if (normalized) return normalized;
  }

  return "http://127.0.0.1:8000";
}

const API_BASE_URL = getApiBaseUrl();

/* ----------------------------------------------------------------------------
   Token helpers
----------------------------------------------------------------------------- */
function safeGetStorageItem(storage, key) {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function extractTokenFromJsonString(value) {
  if (!value || typeof value !== "string") return null;

  try {
    const parsed = JSON.parse(value);

    if (typeof parsed === "string") return parsed;

    if (parsed?.access_token) return parsed.access_token;
    if (parsed?.token) return parsed.token;
    if (parsed?.jwt) return parsed.jwt;
    if (parsed?.bearer_token) return parsed.bearer_token;

    if (parsed?.data?.access_token) return parsed.data.access_token;
    if (parsed?.auth?.access_token) return parsed.auth.access_token;
  } catch {
    return null;
  }

  return null;
}

function getStoredToken() {
  if (typeof window === "undefined") return null;

  const directKeys = [
    "token",
    "access_token",
    "authToken",
    "jwt",
    "bearer_token",
  ];

  const jsonKeys = [
    "auth",
    "user_auth",
    "login_response",
    "session",
    "auth_data",
  ];

  for (const key of directKeys) {
    const localValue = safeGetStorageItem(window.localStorage, key);
    if (localValue) return localValue;

    const sessionValue = safeGetStorageItem(window.sessionStorage, key);
    if (sessionValue) return sessionValue;
  }

  for (const key of jsonKeys) {
    const localValue = safeGetStorageItem(window.localStorage, key);
    const localToken = extractTokenFromJsonString(localValue);
    if (localToken) return localToken;

    const sessionValue = safeGetStorageItem(window.sessionStorage, key);
    const sessionToken = extractTokenFromJsonString(sessionValue);
    if (sessionToken) return sessionToken;
  }

  return null;
}

/* ----------------------------------------------------------------------------
   Axios client
----------------------------------------------------------------------------- */
const saasClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
});

saasClient.interceptors.request.use((config) => {
  const token = getStoredToken();
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/* ----------------------------------------------------------------------------
   Helpers
----------------------------------------------------------------------------- */
function cleanObject(obj = {}) {
  const out = {};
  Object.entries(obj || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    out[key] = value;
  });
  return out;
}

function ensureNotHtmlResponse(response) {
  const contentType =
    response?.headers?.["content-type"] || response?.headers?.["Content-Type"] || "";

  if (typeof response?.data === "string" && contentType.includes("text/html")) {
    throw new Error(
      "SaaS API request returned HTML instead of JSON. Check the backend URL."
    );
  }
}

function extractData(response) {
  ensureNotHtmlResponse(response);
  return response?.data ?? null;
}

function parseFilenameFromDisposition(disposition) {
  if (!disposition || typeof disposition !== "string") return null;

  const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1]).replace(/["']/g, "");
    } catch {
      return utf8Match[1].replace(/["']/g, "");
    }
  }

  const normalMatch = disposition.match(/filename="?([^"]+)"?/i);
  if (normalMatch?.[1]) {
    return normalMatch[1].trim();
  }

  return null;
}

function buildExportMeta(response, fallbackName) {
  const headers = response?.headers || {};
  const disposition =
    headers["content-disposition"] || headers["Content-Disposition"];
  const contentType =
    headers["content-type"] || headers["Content-Type"] || "";
  const filename = parseFilenameFromDisposition(disposition) || fallbackName;

  return {
    blob: response.data,
    filename,
    contentType,
  };
}

function triggerBrowserDownload(blob, filename) {
  if (typeof window === "undefined") return;

  const blobUrl = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = blobUrl;
  anchor.download = filename || "download";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(blobUrl);
}

function asDateString(value) {
  if (!value) return value;
  if (typeof value === "string") return value;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  return value;
}

function normalizeDateParams(params = {}) {
  return {
    ...params,
    service_date: asDateString(params?.service_date),
    start_date: asDateString(params?.start_date),
    end_date: asDateString(params?.end_date),
    report_date: asDateString(params?.report_date),
    reference_date: asDateString(params?.reference_date),
    prepared_on: asDateString(params?.prepared_on),
  };
}

function normalizeMutationPayload(payload = {}) {
  return {
    ...payload,
    service_date: asDateString(payload?.service_date),
  };
}

function normalizeExportParams(params = {}) {
  return cleanObject(normalizeDateParams(params));
}

/* ----------------------------------------------------------------------------
   Core service
----------------------------------------------------------------------------- */
export const SaaSService = {
  /* =========================
     CRUD
  ========================= */
  async create(payload) {
    const response = await saasClient.post("/saas", normalizeMutationPayload(payload));
    return extractData(response);
  },

  async list(params = {}) {
    const response = await saasClient.get("/saas", {
      params: cleanObject(normalizeDateParams(params)),
    });
    return extractData(response);
  },

  async get(id) {
    if (!id) throw new Error("SaaS record id is required.");
    const response = await saasClient.get(`/saas/${id}`);
    return extractData(response);
  },

  async update(id, payload = {}) {
    if (!id) throw new Error("SaaS record id is required.");
    const response = await saasClient.put(`/saas/${id}`, normalizeMutationPayload(payload));
    return extractData(response);
  },

  async softDelete(id) {
    if (!id) throw new Error("SaaS record id is required.");
    const response = await saasClient.delete(`/saas/${id}`);
    return extractData(response);
  },

  async restore(id) {
    if (!id) throw new Error("SaaS record id is required.");
    const response = await saasClient.post(`/saas/${id}/restore`);
    return extractData(response);
  },

  async hardDelete(id) {
    if (!id) throw new Error("SaaS record id is required.");
    const response = await saasClient.delete(`/saas/${id}/hard`);
    return response?.status === 204 ? true : extractData(response);
  },

  async delete(id) {
    return this.softDelete(id);
  },

  /* =========================
     Summaries
  ========================= */
  async getTotals(params = {}) {
    const response = await saasClient.get("/saas/summary/totals", {
      params: cleanObject(normalizeDateParams(params)),
    });
    return extractData(response);
  },

  async getClientSummary(params = {}) {
    const response = await saasClient.get("/saas/summary/clients", {
      params: cleanObject(normalizeDateParams(params)),
    });
    return extractData(response);
  },

  async getAnimalSummary(params = {}) {
    const response = await saasClient.get("/saas/summary/animals", {
      params: cleanObject(normalizeDateParams(params)),
    });
    return extractData(response);
  },

  /* =========================
     Reports
  ========================= */
  async getDailyReport({
    report_date,
    client_name,
    animal_type,
    is_active = true,
    prepared_by_name,
    prepared_on,
    organization_name,
    report_title,
    include_rows = true,
    include_totals = true,
    include_client_summary = true,
    include_animal_summary = true,
  }) {
    const response = await saasClient.get("/saas/reports/daily", {
      params: cleanObject(
        normalizeDateParams({
          report_date,
          client_name,
          animal_type,
          is_active,
          prepared_by_name,
          prepared_on,
          organization_name,
          report_title,
          include_rows,
          include_totals,
          include_client_summary,
          include_animal_summary,
        })
      ),
    });
    return extractData(response);
  },

  async getWeeklyReport({
    reference_date,
    week_starts_on = "monday",
    client_name,
    animal_type,
    is_active = true,
    prepared_by_name,
    prepared_on,
    organization_name,
    report_title,
    include_rows = true,
    include_totals = true,
    include_client_summary = true,
    include_animal_summary = true,
  }) {
    const response = await saasClient.get("/saas/reports/weekly", {
      params: cleanObject(
        normalizeDateParams({
          reference_date,
          week_starts_on,
          client_name,
          animal_type,
          is_active,
          prepared_by_name,
          prepared_on,
          organization_name,
          report_title,
          include_rows,
          include_totals,
          include_client_summary,
          include_animal_summary,
        })
      ),
    });
    return extractData(response);
  },

  async getMonthlyReport({
    month,
    year,
    client_name,
    animal_type,
    is_active = true,
    prepared_by_name,
    prepared_on,
    organization_name,
    report_title,
    include_rows = true,
    include_totals = true,
    include_client_summary = true,
    include_animal_summary = true,
  }) {
    const response = await saasClient.get("/saas/reports/monthly", {
      params: cleanObject(
        normalizeDateParams({
          month,
          year,
          client_name,
          animal_type,
          is_active,
          prepared_by_name,
          prepared_on,
          organization_name,
          report_title,
          include_rows,
          include_totals,
          include_client_summary,
          include_animal_summary,
        })
      ),
    });
    return extractData(response);
  },

  async getDateRangeReport({
    start_date,
    end_date,
    client_name,
    animal_type,
    is_active = true,
    prepared_by_name,
    prepared_on,
    organization_name,
    report_title,
    include_rows = true,
    include_totals = true,
    include_client_summary = true,
    include_animal_summary = true,
  }) {
    const response = await saasClient.get("/saas/reports/range", {
      params: cleanObject(
        normalizeDateParams({
          start_date,
          end_date,
          client_name,
          animal_type,
          is_active,
          prepared_by_name,
          prepared_on,
          organization_name,
          report_title,
          include_rows,
          include_totals,
          include_client_summary,
          include_animal_summary,
        })
      ),
    });
    return extractData(response);
  },

  /* =========================
     Generic export
  ========================= */
  async exportReport(params = {}, fallbackName = "saas_report") {
    const response = await saasClient.get("/saas/exports", {
      params: normalizeExportParams(params),
      responseType: "blob",
    });

    return buildExportMeta(response, fallbackName);
  },

  async downloadReport(params = {}, fallbackName = "saas_report") {
    const { blob, filename } = await this.exportReport(params, fallbackName);
    triggerBrowserDownload(blob, filename);
    return { blob, filename };
  },

  /* =========================
     Daily exports
  ========================= */
  async exportDailyExcel(params = {}) {
    const response = await saasClient.get("/saas/exports/daily/excel", {
      params: normalizeExportParams(params),
      responseType: "blob",
    });
    return buildExportMeta(response, "slaughter_services_daily.xlsx");
  },

  async exportDailyPdf(params = {}) {
    const response = await saasClient.get("/saas/exports/daily/pdf", {
      params: normalizeExportParams(params),
      responseType: "blob",
    });
    return buildExportMeta(response, "slaughter_services_daily.pdf");
  },

  async downloadDailyExcel(params = {}) {
    const { blob, filename } = await this.exportDailyExcel(params);
    triggerBrowserDownload(blob, filename);
    return { blob, filename };
  },

  async downloadDailyPdf(params = {}) {
    const { blob, filename } = await this.exportDailyPdf(params);
    triggerBrowserDownload(blob, filename);
    return { blob, filename };
  },

  /* =========================
     Weekly exports
  ========================= */
  async exportWeeklyExcel(params = {}) {
    const response = await saasClient.get("/saas/exports/weekly/excel", {
      params: normalizeExportParams(params),
      responseType: "blob",
    });
    return buildExportMeta(response, "slaughter_services_weekly.xlsx");
  },

  async exportWeeklyPdf(params = {}) {
    const response = await saasClient.get("/saas/exports/weekly/pdf", {
      params: normalizeExportParams(params),
      responseType: "blob",
    });
    return buildExportMeta(response, "slaughter_services_weekly.pdf");
  },

  async downloadWeeklyExcel(params = {}) {
    const { blob, filename } = await this.exportWeeklyExcel(params);
    triggerBrowserDownload(blob, filename);
    return { blob, filename };
  },

  async downloadWeeklyPdf(params = {}) {
    const { blob, filename } = await this.exportWeeklyPdf(params);
    triggerBrowserDownload(blob, filename);
    return { blob, filename };
  },

  /* =========================
     Monthly exports
  ========================= */
  async exportMonthlyExcel(params = {}) {
    const response = await saasClient.get("/saas/exports/monthly/excel", {
      params: normalizeExportParams(params),
      responseType: "blob",
    });
    return buildExportMeta(response, "slaughter_services_monthly.xlsx");
  },

  async exportMonthlyPdf(params = {}) {
    const response = await saasClient.get("/saas/exports/monthly/pdf", {
      params: normalizeExportParams(params),
      responseType: "blob",
    });
    return buildExportMeta(response, "slaughter_services_monthly.pdf");
  },

  async downloadMonthlyExcel(params = {}) {
    const { blob, filename } = await this.exportMonthlyExcel(params);
    triggerBrowserDownload(blob, filename);
    return { blob, filename };
  },

  async downloadMonthlyPdf(params = {}) {
    const { blob, filename } = await this.exportMonthlyPdf(params);
    triggerBrowserDownload(blob, filename);
    return { blob, filename };
  },

  /* =========================
     Range exports
  ========================= */
  async exportRangeExcel(params = {}) {
    const response = await saasClient.get("/saas/exports/range/excel", {
      params: normalizeExportParams(params),
      responseType: "blob",
    });
    return buildExportMeta(response, "slaughter_services_range.xlsx");
  },

  async exportRangePdf(params = {}) {
    const response = await saasClient.get("/saas/exports/range/pdf", {
      params: normalizeExportParams(params),
      responseType: "blob",
    });
    return buildExportMeta(response, "slaughter_services_range.pdf");
  },

  async downloadRangeExcel(params = {}) {
    const { blob, filename } = await this.exportRangeExcel(params);
    triggerBrowserDownload(blob, filename);
    return { blob, filename };
  },

  async downloadRangePdf(params = {}) {
    const { blob, filename } = await this.exportRangePdf(params);
    triggerBrowserDownload(blob, filename);
    return { blob, filename };
  },
};

export function downloadBlobFile(blob, filename) {
  triggerBrowserDownload(blob, filename);
}

export default SaaSService;