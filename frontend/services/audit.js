import axios from "axios";
import { getToken } from "./auth";

/* ============================================================================
   Audit Service
   ----------------------------------------------------------------------------
   Covers:
   - audit health check
   - product audit generation
   - consumable audit generation
   - product / consumable audit listing
   - single audit row fetch
   - remarks updates
   - report generation
   - export info
   - file downloads (pdf / csv)
============================================================================ */

/* ============================================================================
   Base URL / Client
============================================================================ */

const API_ROOT = "http://127.0.0.1:8000";
const AUDIT_BASE_URL = `${API_ROOT}/audit`;

const client = axios.create({
  baseURL: AUDIT_BASE_URL,
  timeout: 60000,
});

/* ============================================================================
   Auth / Request Helpers
============================================================================ */

function buildAuthHeaders(extra = {}) {
  const token = typeof getToken === "function" ? getToken() : null;

  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

function cleanParams(params = {}) {
  return Object.fromEntries(
    Object.entries(params).filter(
      ([, value]) => value !== undefined && value !== null && value !== ""
    )
  );
}

function normalizeApiError(error, fallbackMessage) {
  const detail =
    error?.response?.data?.detail ||
    error?.response?.data?.message ||
    error?.message ||
    fallbackMessage ||
    "Request failed.";

  const wrapped = new Error(
    typeof detail === "string" ? detail : fallbackMessage || "Request failed."
  );
  wrapped.status = error?.response?.status || 500;
  wrapped.raw = error;
  wrapped.detail = detail;
  return wrapped;
}

async function request(config, fallbackMessage) {
  try {
    const response = await client.request({
      ...config,
      headers: buildAuthHeaders(config?.headers || {}),
    });
    return response.data;
  } catch (error) {
    throw normalizeApiError(error, fallbackMessage);
  }
}

/* ============================================================================
   File Download Helpers
============================================================================ */

function parseFilenameFromDisposition(disposition) {
  if (!disposition) return null;

  const utf8Match = disposition.match(/filename\*\s*=\s*UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1].replace(/['"]/g, "").trim());
    } catch {
      return utf8Match[1].replace(/['"]/g, "").trim();
    }
  }

  const basicMatch = disposition.match(/filename\s*=\s*("?)([^"]+)\1/i);
  if (basicMatch?.[2]) {
    return basicMatch[2].trim();
  }

  return null;
}

function triggerBrowserDownload(blob, filename) {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return;
  }

  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename || "download";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

async function downloadFromEndpoint(path, payload, fallbackFilename) {
  try {
    const response = await client.post(path, payload, {
      responseType: "blob",
      headers: buildAuthHeaders({
        "Content-Type": "application/json",
      }),
    });

    const contentType =
      response.headers["content-type"] || "application/octet-stream";
    const contentDisposition = response.headers["content-disposition"];
    const filename =
      parseFilenameFromDisposition(contentDisposition) || fallbackFilename;
    const blob = new Blob([response.data], { type: contentType });

    triggerBrowserDownload(blob, filename);

    return {
      blob,
      filename,
      contentType,
      size: blob.size,
    };
  } catch (error) {
    throw normalizeApiError(error, "Unable to download audit report.");
  }
}

/* ============================================================================
   General / Health
============================================================================ */

async function getHealth() {
  return request(
    {
      method: "GET",
      url: "/health",
    },
    "Unable to check audit service health."
  );
}

/* ============================================================================
   Product Audit
============================================================================ */

async function generateProductAudit(payload) {
  return request(
    {
      method: "POST",
      url: "/product/generate",
      data: payload,
    },
    "Unable to generate product audit."
  );
}

async function listProductAudits(filters = {}) {
  return request(
    {
      method: "GET",
      url: "/product",
      params: cleanParams({
        audit_period_type: filters.auditPeriodType,
        period_start_date: filters.periodStartDate,
        period_end_date: filters.periodEndDate,
        store: filters.store,
        product_category_id: filters.productCategoryId,
        product_id: filters.productId,
        search: filters.search,
        page: filters.page,
        page_size: filters.pageSize,
      }),
    },
    "Unable to load product audits."
  );
}

async function getProductAudit(auditId) {
  return request(
    {
      method: "GET",
      url: `/product/${auditId}`,
    },
    "Unable to load product audit row."
  );
}

async function updateProductAuditRemarks(auditId, payload) {
  const body =
    typeof payload === "string" ? { remarks: payload } : { ...(payload || {}) };

  return request(
    {
      method: "PATCH",
      url: `/product/${auditId}/remarks`,
      data: body,
    },
    "Unable to update product audit remarks."
  );
}

/* ============================================================================
   Consumable Audit
============================================================================ */

async function generateConsumableAudit(payload) {
  return request(
    {
      method: "POST",
      url: "/consumable/generate",
      data: payload,
    },
    "Unable to generate consumable audit."
  );
}

async function listConsumableAudits(filters = {}) {
  return request(
    {
      method: "GET",
      url: "/consumable",
      params: cleanParams({
        audit_period_type: filters.auditPeriodType,
        period_start_date: filters.periodStartDate,
        period_end_date: filters.periodEndDate,
        store: filters.store,
        item_category_id: filters.itemCategoryId,
        item_id: filters.itemId,
        search: filters.search,
        page: filters.page,
        page_size: filters.pageSize,
      }),
    },
    "Unable to load consumable audits."
  );
}

async function getConsumableAudit(auditId) {
  return request(
    {
      method: "GET",
      url: `/consumable/${auditId}`,
    },
    "Unable to load consumable audit row."
  );
}

async function updateConsumableAuditRemarks(auditId, payload) {
  const body =
    typeof payload === "string" ? { remarks: payload } : { ...(payload || {}) };

  return request(
    {
      method: "PATCH",
      url: `/consumable/${auditId}/remarks`,
      data: body,
    },
    "Unable to update consumable audit remarks."
  );
}

/* ============================================================================
   Product Audit Reports
============================================================================ */

async function generateProductAuditReport(payload) {
  return request(
    {
      method: "POST",
      url: "/product/reports/generate",
      data: payload,
    },
    "Unable to generate product audit report."
  );
}

async function getProductAuditReportExportInfo(payload) {
  return request(
    {
      method: "POST",
      url: "/product/reports/export",
      data: payload,
    },
    "Unable to prepare product audit report export."
  );
}

async function downloadProductAuditReport(
  payload,
  fallbackFilename = "product_audit_report.pdf"
) {
  return downloadFromEndpoint(
    "/product/reports/download",
    payload,
    fallbackFilename
  );
}

/* ============================================================================
   Consumable Audit Reports
============================================================================ */

async function generateConsumableAuditReport(payload) {
  return request(
    {
      method: "POST",
      url: "/consumable/reports/generate",
      data: payload,
    },
    "Unable to generate consumable audit report."
  );
}

async function getConsumableAuditReportExportInfo(payload) {
  return request(
    {
      method: "POST",
      url: "/consumable/reports/export",
      data: payload,
    },
    "Unable to prepare consumable audit report export."
  );
}

async function downloadConsumableAuditReport(
  payload,
  fallbackFilename = "consumable_audit_report.pdf"
) {
  return downloadFromEndpoint(
    "/consumable/reports/download",
    payload,
    fallbackFilename
  );
}

/* ============================================================================
   Convenience Helpers
============================================================================ */

async function generateWeeklyProductAudit({
  periodEndDate,
  store,
  productCategoryId,
  productId,
}) {
  return generateProductAudit({
    audit_period_type: "weekly",
    period_end_date: periodEndDate,
    store,
    product_category_id: productCategoryId,
    product_id: productId,
  });
}

async function generateMonthlyProductAudit({
  periodEndDate,
  store,
  productCategoryId,
  productId,
}) {
  return generateProductAudit({
    audit_period_type: "monthly",
    period_end_date: periodEndDate,
    store,
    product_category_id: productCategoryId,
    product_id: productId,
  });
}

async function generateWeeklyConsumableAudit({
  periodEndDate,
  store,
  itemCategoryId,
  itemId,
}) {
  return generateConsumableAudit({
    audit_period_type: "weekly",
    period_end_date: periodEndDate,
    store,
    item_category_id: itemCategoryId,
    item_id: itemId,
  });
}

async function generateMonthlyConsumableAudit({
  periodEndDate,
  store,
  itemCategoryId,
  itemId,
}) {
  return generateConsumableAudit({
    audit_period_type: "monthly",
    period_end_date: periodEndDate,
    store,
    item_category_id: itemCategoryId,
    item_id: itemId,
  });
}

function buildProductAuditReportPayload({
  auditPeriodType = "weekly",
  periodStartDate,
  periodEndDate,
  exportFormat,
  store,
  productCategoryId,
  productId,
  includeRows = true,
  includeTotals = true,
  includeSummary = true,
} = {}) {
  return {
    audit_period_type: auditPeriodType,
    period_start_date: periodStartDate,
    period_end_date: periodEndDate,
    export_format: exportFormat,
    store,
    product_category_id: productCategoryId,
    product_id: productId,
    include_rows: includeRows,
    include_totals: includeTotals,
    include_summary: includeSummary,
  };
}

function buildConsumableAuditReportPayload({
  auditPeriodType = "weekly",
  periodStartDate,
  periodEndDate,
  exportFormat,
  store,
  itemCategoryId,
  itemId,
  includeRows = true,
  includeTotals = true,
  includeSummary = true,
} = {}) {
  return {
    audit_period_type: auditPeriodType,
    period_start_date: periodStartDate,
    period_end_date: periodEndDate,
    export_format: exportFormat,
    store,
    item_category_id: itemCategoryId,
    item_id: itemId,
    include_rows: includeRows,
    include_totals: includeTotals,
    include_summary: includeSummary,
  };
}

/* ============================================================================
   Export
============================================================================ */

export const AuditService = {
  API_ROOT,
  AUDIT_BASE_URL,

  getHealth,

  generateProductAudit,
  generateWeeklyProductAudit,
  generateMonthlyProductAudit,
  listProductAudits,
  getProductAudit,
  updateProductAuditRemarks,
  generateProductAuditReport,
  getProductAuditReportExportInfo,
  downloadProductAuditReport,
  buildProductAuditReportPayload,

  generateConsumableAudit,
  generateWeeklyConsumableAudit,
  generateMonthlyConsumableAudit,
  listConsumableAudits,
  getConsumableAudit,
  updateConsumableAuditRemarks,
  generateConsumableAuditReport,
  getConsumableAuditReportExportInfo,
  downloadConsumableAuditReport,
  buildConsumableAuditReportPayload,
};

export default AuditService;