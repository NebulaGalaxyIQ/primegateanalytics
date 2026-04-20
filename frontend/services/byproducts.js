import { getToken } from "./auth";

/* ============================================================================
   Byproducts Service
============================================================================ */

function isPlainObject(value) {
  return (
    !!value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    !(value instanceof Date) &&
    !(typeof FormData !== "undefined" && value instanceof FormData) &&
    !(typeof Blob !== "undefined" && value instanceof Blob) &&
    !(typeof File !== "undefined" && value instanceof File)
  );
}

function sanitizeToken(raw) {
  if (!raw) return "";

  let token = String(raw).trim();
  token = token.replace(/^['"]+|['"]+$/g, "");
  token = token.replace(/^bearer\s+/i, "").trim();
  token = token.replace(/[\r\n\t]/g, "").trim();

  return token.length >= 10 ? token : "";
}

function stripUndefined(value) {
  if (Array.isArray(value)) {
    return value.map(stripUndefined).filter((item) => item !== undefined);
  }

  if (isPlainObject(value)) {
    const out = {};
    Object.entries(value).forEach(([key, val]) => {
      if (val !== undefined) {
        out[key] = stripUndefined(val);
      }
    });
    return out;
  }

  return value;
}

function toIsoDate(value) {
  if (!value) return value;
  if (typeof value === "string") return value;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  return value;
}

function unwrapData(payload) {
  if (isPlainObject(payload) && payload.data !== undefined && payload.data !== null) {
    return payload.data;
  }
  return payload;
}

function extractErrorMessage(data, fallback = "Request failed") {
  if (!data) return fallback;

  if (typeof data === "string" && data.trim()) {
    return data.trim();
  }

  if (isPlainObject(data)) {
    if (typeof data.detail === "string" && data.detail.trim()) {
      return data.detail.trim();
    }

    if (Array.isArray(data.detail)) {
      const joined = data.detail
        .map((item) => {
          if (typeof item === "string") return item;
          const loc = Array.isArray(item?.loc) ? item.loc.join(".") : "";
          const msg = typeof item?.msg === "string" ? item.msg.trim() : "";
          if (loc && msg) return `${loc}: ${msg}`;
          return msg || null;
        })
        .filter(Boolean)
        .join(" | ");

      if (joined) return `Validation error: ${joined}`;
    }

    if (typeof data.message === "string" && data.message.trim()) {
      return data.message.trim();
    }

    if (typeof data.error === "string" && data.error.trim()) {
      return data.error.trim();
    }
  }

  return fallback;
}

function buildQueryString(params = {}) {
  const cleaned = stripUndefined(params || {});
  const search = new URLSearchParams();

  Object.entries(cleaned).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;

    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (item !== undefined && item !== null && item !== "") {
          search.append(key, String(item));
        }
      });
      return;
    }

    search.append(key, String(value));
  });

  const text = search.toString();
  return text ? `?${text}` : "";
}

function requireId(id, label = "id") {
  if (!id) {
    throw new Error(`${label} is required`);
  }
  return id;
}

function normalizeReportFilterPayload(payload = {}) {
  const body = { ...(payload || {}) };

  [
    "report_date",
    "target_date",
    "date_from",
    "date_to",
    "sale_date_from",
    "sale_date_to",
  ].forEach((key) => {
    if (body[key] !== undefined) {
      body[key] = toIsoDate(body[key]);
    }
  });

  if (isPlainObject(body.report_filter)) {
    body.report_filter = normalizeReportFilterPayload(body.report_filter);
  }

  return stripUndefined(body);
}

function buildTemplateUploadFormData(payload = {}) {
  const form = new FormData();

  if (!payload?.file) throw new Error("file is required");
  if (!payload?.name) throw new Error("name is required");
  if (!payload?.template_code) throw new Error("template_code is required");
  if (!payload?.template_type) throw new Error("template_type is required");
  if (!payload?.template_format) throw new Error("template_format is required");

  form.append("name", String(payload.name));
  form.append("template_code", String(payload.template_code));
  form.append("template_type", String(payload.template_type));
  form.append("template_format", String(payload.template_format));
  form.append("is_default", String(Boolean(payload.is_default)));
  form.append("is_active", String(payload.is_active !== false));
  form.append("file", payload.file);

  if (payload.notes !== undefined && payload.notes !== null) {
    form.append("notes", String(payload.notes));
  }

  return form;
}

function buildReplaceTemplateFileFormData(file) {
  if (!file) {
    throw new Error("file is required");
  }

  const form = new FormData();
  form.append("file", file);
  return form;
}

function getApiBaseUrl() {
  const envUrl =
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_BACKEND_URL;

  if (envUrl && String(envUrl).trim()) {
    return String(envUrl).trim().replace(/\/+$/, "");
  }

  return "http://127.0.0.1:8000";
}

function isAbsoluteUrl(value) {
  return /^https?:\/\//i.test(String(value || "").trim());
}

function makeAbsoluteApiUrl(value) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) return null;
  if (isAbsoluteUrl(text)) return text;
  return `${getApiBaseUrl()}${text.startsWith("/") ? text : `/${text}`}`;
}

function buildGeneratedDocumentFallbackDownloadUrl(fileName) {
  const clean = typeof fileName === "string" ? fileName.trim() : "";
  if (!clean) return null;
  return `${ROUTES.generatedDownload}${buildQueryString({ file_name: clean })}`;
}

function normalizeGeneratedFileMeta(payload) {
  const data = unwrapData(payload);
  if (!isPlainObject(data)) return data;

  const normalizedFilePath =
    typeof data.file_path === "string"
      ? data.file_path.replace(/\\/g, "/")
      : data.file_path || null;

  const relativeDownloadUrl =
    typeof data.download_url === "string" && data.download_url.trim()
      ? data.download_url.trim()
      : buildGeneratedDocumentFallbackDownloadUrl(data.file_name);

  const absoluteDownloadUrl = makeAbsoluteApiUrl(relativeDownloadUrl);

  return {
    ...data,
    normalized_file_path: normalizedFilePath,
    relative_download_url: relativeDownloadUrl || null,
    download_url: absoluteDownloadUrl,
    file_url: absoluteDownloadUrl,
  };
}

function ensureGeneratedDocumentDownloadUrl(meta) {
  const normalized = normalizeGeneratedFileMeta(meta);
  const url =
    normalized && typeof normalized.download_url === "string"
      ? normalized.download_url.trim()
      : "";

  if (!url) {
    throw new Error(
      "Generated document download URL is missing. Please regenerate the document."
    );
  }

  return normalized;
}

async function fetchAuthorizedFileBlob(url, token) {
  const authToken = sanitizeToken(token !== undefined ? token : getToken?.());
  const headers = {};

  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  let response;
  try {
    response = await fetch(url, {
      method: "GET",
      headers,
    });
  } catch (networkError) {
    const err = new Error(networkError?.message || "File download failed");
    err.status = null;
    err.data = null;
    err.url = url;
    throw err;
  }

  if (!response.ok) {
    let errorData = null;

    try {
      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        errorData = await response.json();
      } else {
        errorData = await response.text();
      }
    } catch {
      errorData = null;
    }

    const message = extractErrorMessage(errorData, "File download failed");
    const err = new Error(message);
    err.status = response.status;
    err.data = errorData;
    err.url = url;
    throw err;
  }

  return response.blob();
}

function triggerBrowserDownload(blob, fileName) {
  if (typeof window === "undefined") return;

  const objectUrl = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = fileName || "download";
  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(() => {
    window.URL.revokeObjectURL(objectUrl);
  }, 1000);
}

function openBlobInNewTab(blob) {
  if (typeof window === "undefined") return;

  const objectUrl = window.URL.createObjectURL(blob);
  window.open(objectUrl, "_blank", "noopener,noreferrer");

  setTimeout(() => {
    window.URL.revokeObjectURL(objectUrl);
  }, 60000);
}

async function request(path, options = {}) {
  const {
    method = "GET",
    query,
    params,
    body,
    data,
    token,
    headers = {},
  } = options;

  const requestMethod = String(method || "GET").toUpperCase();
  const payload = body !== undefined ? body : data;
  const requestParams = query !== undefined ? query : params;
  const isFormData =
    typeof FormData !== "undefined" &&
    payload !== undefined &&
    payload instanceof FormData;

  const authToken = sanitizeToken(token !== undefined ? token : getToken?.());
  const finalHeaders = { ...(headers || {}) };

  if (authToken && !finalHeaders.Authorization && !finalHeaders.authorization) {
    finalHeaders.Authorization = `Bearer ${authToken}`;
  }

  if (!isFormData) {
    finalHeaders["Content-Type"] = "application/json";
  }

  const url = `${getApiBaseUrl()}${path}${buildQueryString(requestParams)}`;

  let response;
  try {
    response = await fetch(url, {
      method: requestMethod,
      headers: finalHeaders,
      body:
        requestMethod === "GET" || requestMethod === "DELETE"
          ? undefined
          : payload === undefined
          ? undefined
          : isFormData
          ? payload
          : JSON.stringify(stripUndefined(payload)),
    });
  } catch (networkError) {
    const err = new Error(networkError?.message || `${requestMethod} ${path} failed`);
    err.status = null;
    err.data = null;
    err.url = url;
    throw err;
  }

  const contentType = response.headers.get("content-type") || "";
  let responseData = null;

  try {
    if (contentType.includes("application/json")) {
      responseData = await response.json();
    } else {
      const text = await response.text();
      responseData = text || null;
    }
  } catch {
    responseData = null;
  }

  if (!response.ok) {
    const message = extractErrorMessage(
      responseData,
      `${requestMethod} ${path} failed`
    );
    const err = new Error(message);
    err.status = response.status;
    err.data = responseData;
    err.url = url;
    throw err;
  }

  return responseData;
}

const ROUTES = {
  categories: "/byproducts/categories",
  categorySelection: "/byproducts/categories/selection",
  categoryById: (id) => `/byproducts/categories/${encodeURIComponent(id)}`,
  restoreCategory: (id) =>
    `/byproducts/categories/${encodeURIComponent(id)}/restore`,

  items: "/byproducts/items",
  itemSelection: "/byproducts/items/selection",
  itemById: (id) => `/byproducts/items/${encodeURIComponent(id)}`,
  restoreItem: (id) => `/byproducts/items/${encodeURIComponent(id)}/restore`,

  customers: "/byproducts/customers",
  customerSelection: "/byproducts/customers/selection",
  customerById: (id) => `/byproducts/customers/${encodeURIComponent(id)}`,
  restoreCustomer: (id) =>
    `/byproducts/customers/${encodeURIComponent(id)}/restore`,

  sales: "/byproducts/sales",
  saleById: (id) => `/byproducts/sales/${encodeURIComponent(id)}`,
  restoreSale: (id) => `/byproducts/sales/${encodeURIComponent(id)}/restore`,
  voidSale: (id) => `/byproducts/sales/${encodeURIComponent(id)}/void`,
  saleLineById: (saleId, lineId) =>
    `/byproducts/sales/${encodeURIComponent(saleId)}/lines/${encodeURIComponent(
      lineId
    )}`,

  reportQuery: "/byproducts/reports/query",
  dailyReport: "/byproducts/reports/daily",
  weeklyReport: "/byproducts/reports/weekly",
  monthlyReport: "/byproducts/reports/monthly",
  customReport: "/byproducts/reports/custom",
  accumulationReport: "/byproducts/reports/accumulation",
  trendReport: "/byproducts/reports/trend",
  compareReport: "/byproducts/reports/compare",
  dashboardReport: "/byproducts/reports/dashboard",
  customerSummary: "/byproducts/reports/summaries/customers",
  byproductSummary: "/byproducts/reports/summaries/byproducts",
  categorySummary: "/byproducts/reports/summaries/categories",

  templates: "/byproducts/templates",
  uploadTemplate: "/byproducts/templates/upload",
  defaultTemplate: "/byproducts/templates/default",
  templateById: (id) => `/byproducts/templates/${encodeURIComponent(id)}`,
  replaceTemplateFile: (id) =>
    `/byproducts/templates/${encodeURIComponent(id)}/replace-file`,
  restoreTemplate: (id) =>
    `/byproducts/templates/${encodeURIComponent(id)}/restore`,
  setDefaultTemplate: (id) =>
    `/byproducts/templates/${encodeURIComponent(id)}/set-default`,
  refreshTemplatePlaceholders: (id) =>
    `/byproducts/templates/${encodeURIComponent(id)}/refresh-placeholders`,
  templatePlaceholders: (id) =>
    `/byproducts/templates/${encodeURIComponent(id)}/placeholders`,
  generateTemplateDocument: "/byproducts/templates/generate",
  generatedDownload: "/byproducts/generated/download",
};

export const ByproductsService = {
  getApiBaseUrl,

  buildGeneratedDocumentUrl(fileName) {
    if (!fileName) return null;
    return makeAbsoluteApiUrl(
      buildGeneratedDocumentFallbackDownloadUrl(String(fileName))
    );
  },

  normalizeGeneratedDocumentMeta(meta) {
    return normalizeGeneratedFileMeta(meta);
  },

  async openGeneratedDocument(meta, options = {}) {
    const normalized = ensureGeneratedDocumentDownloadUrl(meta);
    const blob = await fetchAuthorizedFileBlob(
      normalized.download_url,
      options.token
    );

    if (typeof window !== "undefined") {
      openBlobInNewTab(blob);
    }

    return normalized;
  },

  async downloadGeneratedDocument(meta, options = {}) {
    const normalized = ensureGeneratedDocumentDownloadUrl(meta);
    const blob = await fetchAuthorizedFileBlob(
      normalized.download_url,
      options.token
    );

    if (typeof window !== "undefined") {
      triggerBrowserDownload(blob, normalized.file_name);
    }

    return normalized;
  },

  async createCategory(payload = {}, options = {}) {
    return request(ROUTES.categories, {
      method: "POST",
      body: payload,
      ...options,
    });
  },

  async listCategories(params = {}, options = {}) {
    return request(ROUTES.categories, {
      method: "GET",
      query: params,
      ...options,
    });
  },

  async getCategorySelection(options = {}) {
    return request(ROUTES.categorySelection, {
      method: "GET",
      ...options,
    });
  },

  async getCategory(categoryId, options = {}) {
    return request(ROUTES.categoryById(requireId(categoryId, "categoryId")), {
      method: "GET",
      ...options,
    });
  },

  async updateCategory(categoryId, payload = {}, options = {}) {
    return request(ROUTES.categoryById(requireId(categoryId, "categoryId")), {
      method: "PUT",
      body: payload,
      ...options,
    });
  },

  async deleteCategory(categoryId, options = {}) {
    return request(ROUTES.categoryById(requireId(categoryId, "categoryId")), {
      method: "DELETE",
      ...options,
    });
  },

  async restoreCategory(categoryId, options = {}) {
    return request(ROUTES.restoreCategory(requireId(categoryId, "categoryId")), {
      method: "POST",
      ...options,
    });
  },

  async createItem(payload = {}, options = {}) {
    return request(ROUTES.items, {
      method: "POST",
      body: payload,
      ...options,
    });
  },

  async listItems(params = {}, options = {}) {
    return request(ROUTES.items, {
      method: "GET",
      query: params,
      ...options,
    });
  },

  async getItemSelection(options = {}) {
    return request(ROUTES.itemSelection, {
      method: "GET",
      ...options,
    });
  },

  async getItem(itemId, options = {}) {
    return request(ROUTES.itemById(requireId(itemId, "itemId")), {
      method: "GET",
      ...options,
    });
  },

  async updateItem(itemId, payload = {}, options = {}) {
    return request(ROUTES.itemById(requireId(itemId, "itemId")), {
      method: "PUT",
      body: payload,
      ...options,
    });
  },

  async deleteItem(itemId, options = {}) {
    return request(ROUTES.itemById(requireId(itemId, "itemId")), {
      method: "DELETE",
      ...options,
    });
  },

  async restoreItem(itemId, options = {}) {
    return request(ROUTES.restoreItem(requireId(itemId, "itemId")), {
      method: "POST",
      ...options,
    });
  },

  async createCustomer(payload = {}, options = {}) {
    return request(ROUTES.customers, {
      method: "POST",
      body: payload,
      ...options,
    });
  },

  async listCustomers(params = {}, options = {}) {
    return request(ROUTES.customers, {
      method: "GET",
      query: params,
      ...options,
    });
  },

  async getCustomerSelection(options = {}) {
    return request(ROUTES.customerSelection, {
      method: "GET",
      ...options,
    });
  },

  async getCustomer(customerId, options = {}) {
    return request(ROUTES.customerById(requireId(customerId, "customerId")), {
      method: "GET",
      ...options,
    });
  },

  async updateCustomer(customerId, payload = {}, options = {}) {
    return request(ROUTES.customerById(requireId(customerId, "customerId")), {
      method: "PUT",
      body: payload,
      ...options,
    });
  },

  async deleteCustomer(customerId, options = {}) {
    return request(ROUTES.customerById(requireId(customerId, "customerId")), {
      method: "DELETE",
      ...options,
    });
  },

  async restoreCustomer(customerId, options = {}) {
    return request(ROUTES.restoreCustomer(requireId(customerId, "customerId")), {
      method: "POST",
      ...options,
    });
  },

  async createSale(payload = {}, options = {}) {
    return request(ROUTES.sales, {
      method: "POST",
      body: normalizeReportFilterPayload(payload),
      ...options,
    });
  },

  async listSales(params = {}, options = {}) {
    return request(ROUTES.sales, {
      method: "GET",
      query: normalizeReportFilterPayload(params),
      ...options,
    });
  },

  async getSale(saleId, options = {}) {
    return request(ROUTES.saleById(requireId(saleId, "saleId")), {
      method: "GET",
      ...options,
    });
  },

  async updateSale(saleId, payload = {}, options = {}) {
    return request(ROUTES.saleById(requireId(saleId, "saleId")), {
      method: "PUT",
      body: normalizeReportFilterPayload(payload),
      ...options,
    });
  },

  async deleteSale(saleId, options = {}) {
    return request(ROUTES.saleById(requireId(saleId, "saleId")), {
      method: "DELETE",
      ...options,
    });
  },

  async restoreSale(saleId, options = {}) {
    return request(ROUTES.restoreSale(requireId(saleId, "saleId")), {
      method: "POST",
      ...options,
    });
  },

  async voidSale(saleId, remarks, options = {}) {
    return request(ROUTES.voidSale(requireId(saleId, "saleId")), {
      method: "POST",
      query: remarks !== undefined ? { remarks } : undefined,
      ...options,
    });
  },

  async deleteSaleLine(saleId, lineId, options = {}) {
    requireId(saleId, "saleId");
    requireId(lineId, "lineId");

    return request(ROUTES.saleLineById(saleId, lineId), {
      method: "DELETE",
      ...options,
    });
  },

  async queryReport(payload = {}, options = {}) {
    return request(ROUTES.reportQuery, {
      method: "POST",
      body: normalizeReportFilterPayload(payload),
      ...options,
    });
  },

  async getDailyReport(params = {}, options = {}) {
    return request(ROUTES.dailyReport, {
      method: "GET",
      query: normalizeReportFilterPayload(params),
      ...options,
    });
  },

  async getWeeklyReport(params = {}, options = {}) {
    return request(ROUTES.weeklyReport, {
      method: "GET",
      query: normalizeReportFilterPayload(params),
      ...options,
    });
  },

  async getMonthlyReport(params = {}, options = {}) {
    return request(ROUTES.monthlyReport, {
      method: "GET",
      query: normalizeReportFilterPayload(params),
      ...options,
    });
  },

  async getCustomPeriodReport(params = {}, options = {}) {
    return request(ROUTES.customReport, {
      method: "GET",
      query: normalizeReportFilterPayload(params),
      ...options,
    });
  },

  async getAccumulationReport(params = {}, options = {}) {
    return request(ROUTES.accumulationReport, {
      method: "GET",
      query: normalizeReportFilterPayload(params),
      ...options,
    });
  },

  async getTrendReport(payload = {}, options = {}) {
    const { interval, ...body } = payload || {};
    return request(ROUTES.trendReport, {
      method: "POST",
      query: interval !== undefined ? { interval } : undefined,
      body: normalizeReportFilterPayload(body),
      ...options,
    });
  },

  async compareWithPreviousPeriod(payload = {}, options = {}) {
    return request(ROUTES.compareReport, {
      method: "POST",
      body: normalizeReportFilterPayload(payload),
      ...options,
    });
  },

  async getDashboard(params = {}, options = {}) {
    return request(ROUTES.dashboardReport, {
      method: "GET",
      query: normalizeReportFilterPayload(params),
      ...options,
    });
  },

  async getCustomerSummary(params = {}, options = {}) {
    return request(ROUTES.customerSummary, {
      method: "GET",
      query: normalizeReportFilterPayload(params),
      ...options,
    });
  },

  async getByproductSummary(params = {}, options = {}) {
    return request(ROUTES.byproductSummary, {
      method: "GET",
      query: normalizeReportFilterPayload(params),
      ...options,
    });
  },

  async getCategorySummary(params = {}, options = {}) {
    return request(ROUTES.categorySummary, {
      method: "GET",
      query: normalizeReportFilterPayload(params),
      ...options,
    });
  },

  async createTemplate(payload = {}, options = {}) {
    return request(ROUTES.templates, {
      method: "POST",
      body: payload,
      ...options,
    });
  },

  async uploadTemplate(payload = {}, options = {}) {
    return request(ROUTES.uploadTemplate, {
      method: "POST",
      body: buildTemplateUploadFormData(payload),
      ...options,
    });
  },

  async listTemplates(params = {}, options = {}) {
    return request(ROUTES.templates, {
      method: "GET",
      query: params,
      ...options,
    });
  },

  async getDefaultTemplate(templateType, options = {}) {
    if (!templateType) {
      throw new Error("templateType is required");
    }

    return request(ROUTES.defaultTemplate, {
      method: "GET",
      query: { template_type: templateType },
      ...options,
    });
  },

  async getTemplate(templateId, options = {}) {
    return request(ROUTES.templateById(requireId(templateId, "templateId")), {
      method: "GET",
      ...options,
    });
  },

  async updateTemplate(templateId, payload = {}, options = {}) {
    return request(ROUTES.templateById(requireId(templateId, "templateId")), {
      method: "PUT",
      body: payload,
      ...options,
    });
  },

  async replaceTemplateFile(templateId, file, options = {}) {
    return request(ROUTES.replaceTemplateFile(requireId(templateId, "templateId")), {
      method: "POST",
      body: buildReplaceTemplateFileFormData(file),
      ...options,
    });
  },

  async deleteTemplate(templateId, params = {}, options = {}) {
    return request(ROUTES.templateById(requireId(templateId, "templateId")), {
      method: "DELETE",
      query: params,
      ...options,
    });
  },

  async restoreTemplate(templateId, options = {}) {
    return request(ROUTES.restoreTemplate(requireId(templateId, "templateId")), {
      method: "POST",
      ...options,
    });
  },

  async setDefaultTemplate(templateId, options = {}) {
    return request(ROUTES.setDefaultTemplate(requireId(templateId, "templateId")), {
      method: "POST",
      ...options,
    });
  },

  async refreshTemplatePlaceholders(templateId, options = {}) {
    return request(
      ROUTES.refreshTemplatePlaceholders(requireId(templateId, "templateId")),
      {
        method: "POST",
        ...options,
      }
    );
  },

  async previewTemplatePlaceholders(templateId, options = {}) {
    return request(ROUTES.templatePlaceholders(requireId(templateId, "templateId")), {
      method: "GET",
      ...options,
    });
  },

  async generateReportDocument(payload = {}, query = {}, options = {}) {
    const response = await request(ROUTES.generateTemplateDocument, {
      method: "POST",
      body: normalizeReportFilterPayload(payload),
      query,
      ...options,
    });

    return normalizeGeneratedFileMeta(response);
  },

  getCategories(params = {}, options = {}) {
    return this.listCategories(params, options);
  },

  getItems(params = {}, options = {}) {
    return this.listItems(params, options);
  },

  getCustomers(params = {}, options = {}) {
    return this.listCustomers(params, options);
  },

  getSales(params = {}, options = {}) {
    return this.listSales(params, options);
  },
};

export const createByproductCategory = (...args) =>
  ByproductsService.createCategory(...args);
export const listByproductCategories = (...args) =>
  ByproductsService.listCategories(...args);
export const getByproductCategorySelection = (...args) =>
  ByproductsService.getCategorySelection(...args);
export const getByproductCategory = (...args) =>
  ByproductsService.getCategory(...args);
export const updateByproductCategory = (...args) =>
  ByproductsService.updateCategory(...args);
export const deleteByproductCategory = (...args) =>
  ByproductsService.deleteCategory(...args);
export const restoreByproductCategory = (...args) =>
  ByproductsService.restoreCategory(...args);

export const createByproductItem = (...args) =>
  ByproductsService.createItem(...args);
export const listByproductItems = (...args) =>
  ByproductsService.listItems(...args);
export const getByproductItemSelection = (...args) =>
  ByproductsService.getItemSelection(...args);
export const getByproductItem = (...args) =>
  ByproductsService.getItem(...args);
export const updateByproductItem = (...args) =>
  ByproductsService.updateItem(...args);
export const deleteByproductItem = (...args) =>
  ByproductsService.deleteItem(...args);
export const restoreByproductItem = (...args) =>
  ByproductsService.restoreItem(...args);

export const createByproductCustomer = (...args) =>
  ByproductsService.createCustomer(...args);
export const listByproductCustomers = (...args) =>
  ByproductsService.listCustomers(...args);
export const getByproductCustomerSelection = (...args) =>
  ByproductsService.getCustomerSelection(...args);
export const getByproductCustomer = (...args) =>
  ByproductsService.getCustomer(...args);
export const updateByproductCustomer = (...args) =>
  ByproductsService.updateCustomer(...args);
export const deleteByproductCustomer = (...args) =>
  ByproductsService.deleteCustomer(...args);
export const restoreByproductCustomer = (...args) =>
  ByproductsService.restoreCustomer(...args);

export const createByproductSale = (...args) =>
  ByproductsService.createSale(...args);
export const listByproductSales = (...args) =>
  ByproductsService.listSales(...args);
export const getByproductSale = (...args) =>
  ByproductsService.getSale(...args);
export const updateByproductSale = (...args) =>
  ByproductsService.updateSale(...args);
export const deleteByproductSale = (...args) =>
  ByproductsService.deleteSale(...args);
export const restoreByproductSale = (...args) =>
  ByproductsService.restoreSale(...args);
export const voidByproductSale = (...args) =>
  ByproductsService.voidSale(...args);
export const deleteByproductSaleLine = (...args) =>
  ByproductsService.deleteSaleLine(...args);

export const queryByproductReport = (...args) =>
  ByproductsService.queryReport(...args);
export const getDailyByproductReport = (...args) =>
  ByproductsService.getDailyReport(...args);
export const getWeeklyByproductReport = (...args) =>
  ByproductsService.getWeeklyReport(...args);
export const getMonthlyByproductReport = (...args) =>
  ByproductsService.getMonthlyReport(...args);
export const getCustomPeriodByproductReport = (...args) =>
  ByproductsService.getCustomPeriodReport(...args);
export const getAccumulationByproductReport = (...args) =>
  ByproductsService.getAccumulationReport(...args);
export const getByproductTrendReport = (...args) =>
  ByproductsService.getTrendReport(...args);
export const compareByproductReportWithPreviousPeriod = (...args) =>
  ByproductsService.compareWithPreviousPeriod(...args);
export const getByproductDashboard = (...args) =>
  ByproductsService.getDashboard(...args);
export const getByproductCustomerSummary = (...args) =>
  ByproductsService.getCustomerSummary(...args);
export const getByproductSummary = (...args) =>
  ByproductsService.getByproductSummary(...args);
export const getByproductCategorySummary = (...args) =>
  ByproductsService.getCategorySummary(...args);

export const createByproductTemplate = (...args) =>
  ByproductsService.createTemplate(...args);
export const uploadByproductTemplate = (...args) =>
  ByproductsService.uploadTemplate(...args);
export const listByproductTemplates = (...args) =>
  ByproductsService.listTemplates(...args);
export const getDefaultByproductTemplate = (...args) =>
  ByproductsService.getDefaultTemplate(...args);
export const getByproductTemplate = (...args) =>
  ByproductsService.getTemplate(...args);
export const updateByproductTemplate = (...args) =>
  ByproductsService.updateTemplate(...args);
export const replaceByproductTemplateFile = (...args) =>
  ByproductsService.replaceTemplateFile(...args);
export const deleteByproductTemplate = (...args) =>
  ByproductsService.deleteTemplate(...args);
export const restoreByproductTemplate = (...args) =>
  ByproductsService.restoreTemplate(...args);
export const setDefaultByproductTemplate = (...args) =>
  ByproductsService.setDefaultTemplate(...args);
export const refreshByproductTemplatePlaceholders = (...args) =>
  ByproductsService.refreshTemplatePlaceholders(...args);
export const previewByproductTemplatePlaceholders = (...args) =>
  ByproductsService.previewTemplatePlaceholders(...args);
export const generateByproductReportDocument = (...args) =>
  ByproductsService.generateReportDocument(...args);

export default ByproductsService;