import axios from "axios";
import { getToken } from "./auth";

/* ============================================================================
   Inventory Service
   ----------------------------------------------------------------------------
   Covers:
   - bootstrap / dropdown data
   - product categories / products
   - consumable categories / items
   - product store inventory entries
   - consumable store inventory entries
   - daily sheet preload
   - bulk upsert save
   - opening balance autofill
   - report generation
   - file downloads (pdf / csv / docx)

   IMPORTANT:
   - In local development, it falls back to http://127.0.0.1:8000
   - In production, set NEXT_PUBLIC_API_URL or NEXT_PUBLIC_INVENTORY_API_URL
   - If no production env is set, it falls back to the current site origin
     instead of localhost, so it will not try to call your own device
============================================================================ */

/* ============================================================================
   Base URL / Client
============================================================================ */

const LOCAL_API_ROOT = "http://127.0.0.1:8000";

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function stripTrailingSlashes(value) {
  return String(value || "").replace(/\/+$/, "");
}

function isBrowser() {
  return typeof window !== "undefined";
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
    process.env.NEXT_PUBLIC_INVENTORY_API_URL ||
    process.env.NEXT_PUBLIC_API_URL;

  if (isNonEmptyString(explicitEnvRoot)) {
    return stripTrailingSlashes(explicitEnvRoot);
  }

  if (isBrowser()) {
    const currentOrigin = stripTrailingSlashes(window.location.origin);
    const currentHostname = window.location.hostname;

    if (isLocalHostname(currentHostname)) {
      return LOCAL_API_ROOT;
    }

    // Prevent production browser from falling back to loopback / localhost.
    // If no public API env is provided, use the current deployed origin.
    return currentOrigin;
  }

  return LOCAL_API_ROOT;
}

const API_ROOT = resolveApiRoot();
const INVENTORY_BASE_URL = `${API_ROOT}/inventory`;

const client = axios.create({
  baseURL: INVENTORY_BASE_URL,
  timeout: 60000,
  headers: {
    Accept: "application/json",
  },
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

function normalizeText(value) {
  if (value === undefined || value === null) return null;
  const cleaned = String(value).trim().replace(/\s+/g, " ");
  return cleaned || null;
}

function normalizeInitials(value) {
  const cleaned = normalizeText(value);
  return cleaned ? cleaned.toUpperCase().slice(0, 20) : null;
}

function toDecimalString(value, fallback = "0.00") {
  if (value === undefined || value === null || value === "") return fallback;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return numeric.toFixed(2);
}

function toInteger(value, fallback = 0) {
  if (value === undefined || value === null || value === "") return fallback;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(0, Math.trunc(numeric));
}

function pickFirstDefined(...values) {
  for (const value of values) {
    if (value !== undefined) return value;
  }
  return undefined;
}

function normalizeApiError(error, fallbackMessage) {
  const detail =
    error?.response?.data?.detail ||
    error?.response?.data?.message ||
    error?.message ||
    fallbackMessage ||
    "Request failed.";

  const message = Array.isArray(detail)
    ? detail
        .map((item) => {
          if (typeof item === "string") return item;
          if (item?.msg) return item.msg;
          return JSON.stringify(item);
        })
        .join(" | ")
    : typeof detail === "string"
    ? detail
    : fallbackMessage || "Request failed.";

  const wrapped = new Error(message);
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

async function tryReadBlobError(blob) {
  try {
    const text = await blob.text();
    if (!text) return null;

    try {
      const parsed = JSON.parse(text);
      return (
        parsed?.detail ||
        parsed?.message ||
        (typeof parsed === "string" ? parsed : null)
      );
    } catch {
      return text;
    }
  } catch {
    return null;
  }
}

async function downloadFromEndpoint(path, payload, fallbackFilename) {
  try {
    const response = await client.post(path, payload ?? {}, {
      responseType: "blob",
      headers: buildAuthHeaders({
        "Content-Type": "application/json",
      }),
    });

    const contentType =
      response.headers?.["content-type"] || "application/octet-stream";
    const contentDisposition = response.headers?.["content-disposition"];
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
    const blob = error?.response?.data;

    if (blob instanceof Blob) {
      const extracted = await tryReadBlobError(blob);
      if (extracted) {
        const wrapped = new Error(
          Array.isArray(extracted)
            ? extracted.map((item) => item?.msg || String(item)).join(" | ")
            : String(extracted)
        );
        wrapped.status = error?.response?.status || 500;
        wrapped.raw = error;
        throw wrapped;
      }
    }

    throw normalizeApiError(error, "Unable to download report.");
  }
}

/* ============================================================================
   Daily Sheet / Bulk Helpers
============================================================================ */

function isProductRowEmpty(row = {}) {
  return (
    toDecimalString(row.inflow_production) === "0.00" &&
    toDecimalString(row.inflow_transfers_in) === "0.00" &&
    toDecimalString(row.outflow_dispatch) === "0.00" &&
    toDecimalString(row.outflow_transfers_out) === "0.00" &&
    toInteger(row.total_boxes) === 0 &&
    toInteger(row.total_pieces) === 0 &&
    !normalizeText(row.remarks) &&
    !normalizeInitials(row.checked_by_initials || row.checkedByInitials)
  );
}

function isConsumableRowEmpty(row = {}) {
  return (
    toDecimalString(row.issued_today) === "0.00" &&
    !normalizeText(row.remarks) &&
    !normalizeInitials(row.checked_by_initials || row.checkedByInitials)
  );
}

function serializeProductBulkRow(row = {}) {
  const serialNo = pickFirstDefined(row.serial_no, row.serialNo);
  const productCategoryId = pickFirstDefined(
    row.product_category_id,
    row.productCategoryId
  );
  const productId = pickFirstDefined(row.product_id, row.productId);
  const balanceUnit = pickFirstDefined(row.balance_unit, row.balanceUnit);
  const openingBalance = pickFirstDefined(
    row.opening_balance,
    row.openingBalance
  );

  return {
    ...(serialNo !== undefined ? { serial_no: serialNo } : {}),
    ...(productCategoryId !== undefined
      ? { product_category_id: productCategoryId }
      : {}),
    ...(productId !== undefined ? { product_id: productId } : {}),
    ...(balanceUnit !== undefined ? { balance_unit: balanceUnit } : {}),
    ...(openingBalance !== undefined
      ? { opening_balance: openingBalance }
      : {}),

    inflow_production: toDecimalString(
      pickFirstDefined(row.inflow_production, row.inflowProduction)
    ),
    inflow_transfers_in: toDecimalString(
      pickFirstDefined(row.inflow_transfers_in, row.inflowTransfersIn)
    ),
    outflow_dispatch: toDecimalString(
      pickFirstDefined(row.outflow_dispatch, row.outflowDispatch)
    ),
    outflow_transfers_out: toDecimalString(
      pickFirstDefined(row.outflow_transfers_out, row.outflowTransfersOut)
    ),

    total_boxes: toInteger(pickFirstDefined(row.total_boxes, row.totalBoxes)),
    total_pieces: toInteger(
      pickFirstDefined(row.total_pieces, row.totalPieces)
    ),

    remarks: normalizeText(row.remarks),
    checked_by_initials: normalizeInitials(
      pickFirstDefined(row.checked_by_initials, row.checkedByInitials)
    ),
    overwrite_opening_balance: Boolean(
      pickFirstDefined(row.overwrite_opening_balance, row.overwriteOpeningBalance)
    ),
  };
}

function serializeConsumableBulkRow(row = {}) {
  const serialNo = pickFirstDefined(row.serial_no, row.serialNo);
  const itemCategoryId = pickFirstDefined(
    row.item_category_id,
    row.itemCategoryId
  );
  const itemId = pickFirstDefined(row.item_id, row.itemId);
  const unit = normalizeText(row.unit);
  const openingBalance = pickFirstDefined(
    row.opening_balance,
    row.openingBalance
  );

  return {
    ...(serialNo !== undefined ? { serial_no: serialNo } : {}),
    ...(itemCategoryId !== undefined ? { item_category_id: itemCategoryId } : {}),
    ...(itemId !== undefined ? { item_id: itemId } : {}),
    ...(unit !== undefined ? { unit } : {}),
    ...(openingBalance !== undefined
      ? { opening_balance: openingBalance }
      : {}),

    issued_today: toDecimalString(
      pickFirstDefined(row.issued_today, row.issuedToday)
    ),

    remarks: normalizeText(row.remarks),
    checked_by_initials: normalizeInitials(
      pickFirstDefined(row.checked_by_initials, row.checkedByInitials)
    ),
    overwrite_opening_balance: Boolean(
      pickFirstDefined(row.overwrite_opening_balance, row.overwriteOpeningBalance)
    ),
  };
}

function buildProductBulkPayloadFromDailySheet({
  entryDate,
  store,
  rows = [],
  includeEmptyRows = true,
}) {
  const normalizedRows = rows
    .map(serializeProductBulkRow)
    .filter((row) => row.product_id);

  const finalRows = includeEmptyRows
    ? normalizedRows
    : normalizedRows.filter((row) => !isProductRowEmpty(row));

  return {
    entry_date: entryDate,
    store,
    rows: finalRows,
  };
}

function buildConsumableBulkPayloadFromDailySheet({
  entryDate,
  store,
  rows = [],
  includeEmptyRows = true,
}) {
  const normalizedRows = rows
    .map(serializeConsumableBulkRow)
    .filter((row) => row.item_id);

  const finalRows = includeEmptyRows
    ? normalizedRows
    : normalizedRows.filter((row) => !isConsumableRowEmpty(row));

  return {
    entry_date: entryDate,
    store,
    rows: finalRows,
  };
}

/* ============================================================================
   Bootstrap
============================================================================ */

async function getBootstrap() {
  return request(
    {
      method: "GET",
      url: "/bootstrap",
    },
    "Unable to load inventory bootstrap data."
  );
}

/* ============================================================================
   Product Categories
============================================================================ */

async function listProductCategories({ activeOnly = false } = {}) {
  return request(
    {
      method: "GET",
      url: "/product-categories",
      params: cleanParams({
        active_only: activeOnly || undefined,
      }),
    },
    "Unable to load product categories."
  );
}

async function getProductCategory(categoryId) {
  return request(
    {
      method: "GET",
      url: `/product-categories/${categoryId}`,
    },
    "Unable to load product category."
  );
}

async function createProductCategory(payload) {
  return request(
    {
      method: "POST",
      url: "/product-categories",
      data: payload,
    },
    "Unable to create product category."
  );
}

async function updateProductCategory(categoryId, payload) {
  return request(
    {
      method: "PATCH",
      url: `/product-categories/${categoryId}`,
      data: payload,
    },
    "Unable to update product category."
  );
}

async function deleteProductCategory(categoryId) {
  return request(
    {
      method: "DELETE",
      url: `/product-categories/${categoryId}`,
    },
    "Unable to delete product category."
  );
}

/* ============================================================================
   Products
============================================================================ */

async function listProducts({ activeOnly = false } = {}) {
  return request(
    {
      method: "GET",
      url: "/products",
      params: cleanParams({
        active_only: activeOnly || undefined,
      }),
    },
    "Unable to load products."
  );
}

async function getProduct(productId) {
  return request(
    {
      method: "GET",
      url: `/products/${productId}`,
    },
    "Unable to load product."
  );
}

async function createProduct(payload) {
  return request(
    {
      method: "POST",
      url: "/products",
      data: payload,
    },
    "Unable to create product."
  );
}

async function updateProduct(productId, payload) {
  return request(
    {
      method: "PATCH",
      url: `/products/${productId}`,
      data: payload,
    },
    "Unable to update product."
  );
}

async function deleteProduct(productId) {
  return request(
    {
      method: "DELETE",
      url: `/products/${productId}`,
    },
    "Unable to delete product."
  );
}

/* ============================================================================
   Consumable Categories
============================================================================ */

async function listConsumableCategories({ activeOnly = false } = {}) {
  return request(
    {
      method: "GET",
      url: "/consumable-categories",
      params: cleanParams({
        active_only: activeOnly || undefined,
      }),
    },
    "Unable to load consumable categories."
  );
}

async function getConsumableCategory(categoryId) {
  return request(
    {
      method: "GET",
      url: `/consumable-categories/${categoryId}`,
    },
    "Unable to load consumable category."
  );
}

async function createConsumableCategory(payload) {
  return request(
    {
      method: "POST",
      url: "/consumable-categories",
      data: payload,
    },
    "Unable to create consumable category."
  );
}

async function updateConsumableCategory(categoryId, payload) {
  return request(
    {
      method: "PATCH",
      url: `/consumable-categories/${categoryId}`,
      data: payload,
    },
    "Unable to update consumable category."
  );
}

async function deleteConsumableCategory(categoryId) {
  return request(
    {
      method: "DELETE",
      url: `/consumable-categories/${categoryId}`,
    },
    "Unable to delete consumable category."
  );
}

/* ============================================================================
   Consumable Items
============================================================================ */

async function listConsumableItems({ activeOnly = false } = {}) {
  return request(
    {
      method: "GET",
      url: "/consumable-items",
      params: cleanParams({
        active_only: activeOnly || undefined,
      }),
    },
    "Unable to load consumable items."
  );
}

async function getConsumableItem(itemId) {
  return request(
    {
      method: "GET",
      url: `/consumable-items/${itemId}`,
    },
    "Unable to load consumable item."
  );
}

async function createConsumableItem(payload) {
  return request(
    {
      method: "POST",
      url: "/consumable-items",
      data: payload,
    },
    "Unable to create consumable item."
  );
}

async function updateConsumableItem(itemId, payload) {
  return request(
    {
      method: "PATCH",
      url: `/consumable-items/${itemId}`,
      data: payload,
    },
    "Unable to update consumable item."
  );
}

async function deleteConsumableItem(itemId) {
  return request(
    {
      method: "DELETE",
      url: `/consumable-items/${itemId}`,
    },
    "Unable to delete consumable item."
  );
}

/* ============================================================================
   Product Daily Sheet / Entries
============================================================================ */

async function getProductDailySheet({ entryDate, store, activeOnly = true }) {
  return request(
    {
      method: "GET",
      url: "/product-store/daily-sheet",
      params: cleanParams({
        entry_date: entryDate,
        store,
        active_only: activeOnly,
      }),
    },
    "Unable to load product daily sheet."
  );
}

async function bulkUpsertProductStoreEntries(payload) {
  return request(
    {
      method: "POST",
      url: "/product-store/entries/bulk",
      data: payload,
    },
    "Unable to save product inventory sheet."
  );
}

async function listProductStoreEntries(filters = {}) {
  return request(
    {
      method: "GET",
      url: "/product-store/entries",
      params: cleanParams({
        start_date: filters.startDate,
        end_date: filters.endDate,
        store: filters.store,
        product_category_id: filters.productCategoryId,
        product_id: filters.productId,
        balance_unit: filters.balanceUnit,
        checked_by_initials: filters.checkedByInitials,
        search: filters.search,
        page: filters.page,
        page_size: filters.pageSize,
      }),
    },
    "Unable to load product inventory entries."
  );
}

async function getProductStoreEntry(entryId) {
  return request(
    {
      method: "GET",
      url: `/product-store/entries/${entryId}`,
    },
    "Unable to load product inventory entry."
  );
}

async function createProductStoreEntry(payload) {
  return request(
    {
      method: "POST",
      url: "/product-store/entries",
      data: payload,
    },
    "Unable to create product inventory entry."
  );
}

async function updateProductStoreEntry(entryId, payload) {
  return request(
    {
      method: "PATCH",
      url: `/product-store/entries/${entryId}`,
      data: payload,
    },
    "Unable to update product inventory entry."
  );
}

async function deleteProductStoreEntry(entryId) {
  return request(
    {
      method: "DELETE",
      url: `/product-store/entries/${entryId}`,
    },
    "Unable to delete product inventory entry."
  );
}

async function getProductOpeningBalance({ entryDate, store, productId }) {
  return request(
    {
      method: "GET",
      url: "/product-store/opening-balance",
      params: cleanParams({
        entry_date: entryDate,
        store,
        product_id: productId,
      }),
    },
    "Unable to load product opening balance."
  );
}

/* ============================================================================
   Consumable Daily Sheet / Entries
============================================================================ */

async function getConsumableDailySheet({
  entryDate,
  store,
  activeOnly = true,
}) {
  return request(
    {
      method: "GET",
      url: "/consumable-store/daily-sheet",
      params: cleanParams({
        entry_date: entryDate,
        store,
        active_only: activeOnly,
      }),
    },
    "Unable to load consumable daily sheet."
  );
}

async function bulkUpsertConsumableStoreEntries(payload) {
  return request(
    {
      method: "POST",
      url: "/consumable-store/entries/bulk",
      data: payload,
    },
    "Unable to save consumable inventory sheet."
  );
}

async function listConsumableStoreEntries(filters = {}) {
  return request(
    {
      method: "GET",
      url: "/consumable-store/entries",
      params: cleanParams({
        start_date: filters.startDate,
        end_date: filters.endDate,
        store: filters.store,
        item_category_id: filters.itemCategoryId,
        item_id: filters.itemId,
        unit: filters.unit,
        checked_by_initials: filters.checkedByInitials,
        search: filters.search,
        page: filters.page,
        page_size: filters.pageSize,
      }),
    },
    "Unable to load consumable inventory entries."
  );
}

async function getConsumableStoreEntry(entryId) {
  return request(
    {
      method: "GET",
      url: `/consumable-store/entries/${entryId}`,
    },
    "Unable to load consumable inventory entry."
  );
}

async function createConsumableStoreEntry(payload) {
  return request(
    {
      method: "POST",
      url: "/consumable-store/entries",
      data: payload,
    },
    "Unable to create consumable inventory entry."
  );
}

async function updateConsumableStoreEntry(entryId, payload) {
  return request(
    {
      method: "PATCH",
      url: `/consumable-store/entries/${entryId}`,
      data: payload,
    },
    "Unable to update consumable inventory entry."
  );
}

async function deleteConsumableStoreEntry(entryId) {
  return request(
    {
      method: "DELETE",
      url: `/consumable-store/entries/${entryId}`,
    },
    "Unable to delete consumable inventory entry."
  );
}

async function getConsumableOpeningBalance({ entryDate, store, itemId }) {
  return request(
    {
      method: "GET",
      url: "/consumable-store/opening-balance",
      params: cleanParams({
        entry_date: entryDate,
        store,
        item_id: itemId,
      }),
    },
    "Unable to load consumable opening balance."
  );
}

/* ============================================================================
   Product Reports
============================================================================ */

async function generateProductReport(payload) {
  return request(
    {
      method: "POST",
      url: "/product-store/reports/generate",
      data: payload,
    },
    "Unable to generate product inventory report."
  );
}

async function getProductReportExportInfo(payload) {
  return request(
    {
      method: "POST",
      url: "/product-store/reports/export",
      data: payload,
    },
    "Unable to prepare product report export."
  );
}

async function downloadProductReport(
  payload,
  fallbackFilename = "product_inventory_report.pdf"
) {
  return downloadFromEndpoint(
    "/product-store/reports/download",
    payload,
    fallbackFilename
  );
}

/* ============================================================================
   Consumable Reports
============================================================================ */

async function generateConsumableReport(payload) {
  return request(
    {
      method: "POST",
      url: "/consumable-store/reports/generate",
      data: payload,
    },
    "Unable to generate consumable inventory report."
  );
}

async function getConsumableReportExportInfo(payload) {
  return request(
    {
      method: "POST",
      url: "/consumable-store/reports/export",
      data: payload,
    },
    "Unable to prepare consumable report export."
  );
}

async function downloadConsumableReport(
  payload,
  fallbackFilename = "consumable_inventory_report.pdf"
) {
  return downloadFromEndpoint(
    "/consumable-store/reports/download",
    payload,
    fallbackFilename
  );
}

/* ============================================================================
   Convenience Helpers For Forms / Grids
============================================================================ */

async function autofillProductOpeningBalance({ entryDate, store, productId }) {
  if (!entryDate || !store || !productId) {
    return { opening_balance: "0.00" };
  }
  return getProductOpeningBalance({ entryDate, store, productId });
}

async function autofillConsumableOpeningBalance({ entryDate, store, itemId }) {
  if (!entryDate || !store || !itemId) {
    return { opening_balance: "0.00" };
  }
  return getConsumableOpeningBalance({ entryDate, store, itemId });
}

async function saveProductDailySheet({
  entryDate,
  store,
  rows,
  includeEmptyRows = true,
}) {
  const payload = buildProductBulkPayloadFromDailySheet({
    entryDate,
    store,
    rows,
    includeEmptyRows,
  });
  return bulkUpsertProductStoreEntries(payload);
}

async function saveConsumableDailySheet({
  entryDate,
  store,
  rows,
  includeEmptyRows = true,
}) {
  const payload = buildConsumableBulkPayloadFromDailySheet({
    entryDate,
    store,
    rows,
    includeEmptyRows,
  });
  return bulkUpsertConsumableStoreEntries(payload);
}

/* ============================================================================
   Export
============================================================================ */

export const InventoryService = {
  API_ROOT,
  INVENTORY_BASE_URL,

  getBootstrap,

  listProductCategories,
  getProductCategory,
  createProductCategory,
  updateProductCategory,
  deleteProductCategory,

  listProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,

  listConsumableCategories,
  getConsumableCategory,
  createConsumableCategory,
  updateConsumableCategory,
  deleteConsumableCategory,

  listConsumableItems,
  getConsumableItem,
  createConsumableItem,
  updateConsumableItem,
  deleteConsumableItem,

  getProductDailySheet,
  bulkUpsertProductStoreEntries,
  listProductStoreEntries,
  getProductStoreEntry,
  createProductStoreEntry,
  updateProductStoreEntry,
  deleteProductStoreEntry,
  getProductOpeningBalance,
  autofillProductOpeningBalance,
  buildProductBulkPayloadFromDailySheet,
  saveProductDailySheet,

  getConsumableDailySheet,
  bulkUpsertConsumableStoreEntries,
  listConsumableStoreEntries,
  getConsumableStoreEntry,
  createConsumableStoreEntry,
  updateConsumableStoreEntry,
  deleteConsumableStoreEntry,
  getConsumableOpeningBalance,
  autofillConsumableOpeningBalance,
  buildConsumableBulkPayloadFromDailySheet,
  saveConsumableDailySheet,

  generateProductReport,
  getProductReportExportInfo,
  downloadProductReport,

  generateConsumableReport,
  getConsumableReportExportInfo,
  downloadConsumableReport,
};

export default InventoryService;