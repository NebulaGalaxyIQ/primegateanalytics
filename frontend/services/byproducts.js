import { getToken } from "./auth";

/* ============================================================================
   Byproducts Service
   - Refactored into grouped API sections
   - Keeps backward-compatible top-level methods
   - Supports DB-backed templates (storage_backend, nullable file_path)
============================================================================ */

const DATE_KEYS = new Set([
  "report_date",
  "target_date",
  "date_from",
  "date_to",
  "sale_date_from",
  "sale_date_to",
]);

/* ============================================================================
   Core helpers
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

function normalizeDateFields(value) {
  if (Array.isArray(value)) {
    return value.map(normalizeDateFields);
  }

  if (!isPlainObject(value)) {
    return value;
  }

  const out = {};
  Object.entries(value).forEach(([key, val]) => {
    if (DATE_KEYS.has(key)) {
      out[key] = toIsoDate(val);
      return;
    }

    if (isPlainObject(val) || Array.isArray(val)) {
      out[key] = normalizeDateFields(val);
      return;
    }

    out[key] = val;
  });

  return stripUndefined(out);
}

function buildTemplateUploadFormData(payload = {}) {
  if (!payload?.file) throw new Error("file is required");
  if (!payload?.name) throw new Error("name is required");
  if (!payload?.template_code) throw new Error("template_code is required");
  if (!payload?.template_type) throw new Error("template_type is required");
  if (!payload?.template_format) throw new Error("template_format is required");

  const form = new FormData();
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
  if (!file) throw new Error("file is required");

  const form = new FormData();
  form.append("file", file);
  return form;
}

/* ============================================================================
   URL helpers
============================================================================ */

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

/* ============================================================================
   Response normalizers
============================================================================ */

function normalizeGeneratedDocumentMeta(payload) {
  const data = unwrapData(payload);
  if (!isPlainObject(data)) return data;

  const normalizedFilePath =
    typeof data.file_path === "string"
      ? data.file_path.replace(/\\/g, "/")
      : data.file_path || null;

  const relativeDownloadUrl =
    typeof data.download_url === "string" && data.download_url.trim()
      ? data.download_url.trim()
      : buildQueryString({ file_name: data.file_name })
      ? `${ROUTES.generated.download}${buildQueryString({ file_name: data.file_name })}`
      : null;

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
  const normalized = normalizeGeneratedDocumentMeta(meta);
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

function normalizeTemplateMeta(payload) {
  const data = unwrapData(payload);
  if (!isPlainObject(data)) return data;

  const storageBackend =
    typeof data.storage_backend === "string"
      ? data.storage_backend.trim().toLowerCase()
      : data.storage_backend || null;

  const normalizedFilePath =
    typeof data.file_path === "string"
      ? data.file_path.replace(/\\/g, "/")
      : data.file_path || null;

  const isDatabaseBacked = storageBackend === "database";
  const isDiskBacked = storageBackend === "disk";

  return {
    ...data,
    storage_backend: storageBackend,
    normalized_file_path: normalizedFilePath,
    is_database_backed: isDatabaseBacked,
    is_disk_backed: isDiskBacked,
    storage_label: isDatabaseBacked
      ? "Stored in database"
      : normalizedFilePath || "Stored on disk",
  };
}

function normalizeTemplateList(payload) {
  const data = unwrapData(payload);
  if (!isPlainObject(data)) return data;

  return {
    ...data,
    items: Array.isArray(data.items) ? data.items.map(normalizeTemplateMeta) : [],
  };
}

/* ============================================================================
   Browser file helpers
============================================================================ */

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

/* ============================================================================
   HTTP client
============================================================================ */

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

  if (!isFormData && !finalHeaders["Content-Type"] && !finalHeaders["content-type"]) {
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

/* ============================================================================
   Routes grouped by domain
============================================================================ */

const ROUTES = {
  categories: {
    root: "/byproducts/categories",
    selection: "/byproducts/categories/selection",
    byId: (id) => `/byproducts/categories/${encodeURIComponent(id)}`,
    restore: (id) => `/byproducts/categories/${encodeURIComponent(id)}/restore`,
  },

  items: {
    root: "/byproducts/items",
    selection: "/byproducts/items/selection",
    byId: (id) => `/byproducts/items/${encodeURIComponent(id)}`,
    restore: (id) => `/byproducts/items/${encodeURIComponent(id)}/restore`,
  },

  customers: {
    root: "/byproducts/customers",
    selection: "/byproducts/customers/selection",
    byId: (id) => `/byproducts/customers/${encodeURIComponent(id)}`,
    restore: (id) => `/byproducts/customers/${encodeURIComponent(id)}/restore`,
  },

  sales: {
    root: "/byproducts/sales",
    byId: (id) => `/byproducts/sales/${encodeURIComponent(id)}`,
    restore: (id) => `/byproducts/sales/${encodeURIComponent(id)}/restore`,
    void: (id) => `/byproducts/sales/${encodeURIComponent(id)}/void`,
    lineById: (saleId, lineId) =>
      `/byproducts/sales/${encodeURIComponent(saleId)}/lines/${encodeURIComponent(
        lineId
      )}`,
  },

  reports: {
    query: "/byproducts/reports/query",
    daily: "/byproducts/reports/daily",
    weekly: "/byproducts/reports/weekly",
    monthly: "/byproducts/reports/monthly",
    custom: "/byproducts/reports/custom",
    accumulation: "/byproducts/reports/accumulation",
    trend: "/byproducts/reports/trend",
    compare: "/byproducts/reports/compare",
    dashboard: "/byproducts/reports/dashboard",
    summaries: {
      customers: "/byproducts/reports/summaries/customers",
      byproducts: "/byproducts/reports/summaries/byproducts",
      categories: "/byproducts/reports/summaries/categories",
    },
  },

  templates: {
    root: "/byproducts/templates",
    upload: "/byproducts/templates/upload",
    default: "/byproducts/templates/default",
    generate: "/byproducts/templates/generate",
    byId: (id) => `/byproducts/templates/${encodeURIComponent(id)}`,
    replaceFile: (id) =>
      `/byproducts/templates/${encodeURIComponent(id)}/replace-file`,
    restore: (id) => `/byproducts/templates/${encodeURIComponent(id)}/restore`,
    setDefault: (id) =>
      `/byproducts/templates/${encodeURIComponent(id)}/set-default`,
    refreshPlaceholders: (id) =>
      `/byproducts/templates/${encodeURIComponent(id)}/refresh-placeholders`,
    placeholders: (id) =>
      `/byproducts/templates/${encodeURIComponent(id)}/placeholders`,
  },

  generated: {
    download: "/byproducts/generated/download",
  },
};

/* ============================================================================
   Domain APIs
============================================================================ */

const generatedApi = {
  buildDocumentUrl(fileName) {
    const clean = typeof fileName === "string" ? fileName.trim() : "";
    if (!clean) return null;
    return makeAbsoluteApiUrl(
      `${ROUTES.generated.download}${buildQueryString({ file_name: clean })}`
    );
  },

  normalizeDocumentMeta(meta) {
    return normalizeGeneratedDocumentMeta(meta);
  },

  async openDocument(meta, options = {}) {
    const normalized = ensureGeneratedDocumentDownloadUrl(meta);
    const blob = await fetchAuthorizedFileBlob(normalized.download_url, options.token);

    if (typeof window !== "undefined") {
      openBlobInNewTab(blob);
    }

    return normalized;
  },

  async downloadDocument(meta, options = {}) {
    const normalized = ensureGeneratedDocumentDownloadUrl(meta);
    const blob = await fetchAuthorizedFileBlob(normalized.download_url, options.token);

    if (typeof window !== "undefined") {
      triggerBrowserDownload(blob, normalized.file_name);
    }

    return normalized;
  },
};

const categoriesApi = {
  create(payload = {}, options = {}) {
    return request(ROUTES.categories.root, {
      method: "POST",
      body: payload,
      ...options,
    });
  },

  list(params = {}, options = {}) {
    return request(ROUTES.categories.root, {
      method: "GET",
      query: params,
      ...options,
    });
  },

  getSelection(options = {}) {
    return request(ROUTES.categories.selection, {
      method: "GET",
      ...options,
    });
  },

  get(categoryId, options = {}) {
    return request(ROUTES.categories.byId(requireId(categoryId, "categoryId")), {
      method: "GET",
      ...options,
    });
  },

  update(categoryId, payload = {}, options = {}) {
    return request(ROUTES.categories.byId(requireId(categoryId, "categoryId")), {
      method: "PUT",
      body: payload,
      ...options,
    });
  },

  delete(categoryId, options = {}) {
    return request(ROUTES.categories.byId(requireId(categoryId, "categoryId")), {
      method: "DELETE",
      ...options,
    });
  },

  restore(categoryId, options = {}) {
    return request(ROUTES.categories.restore(requireId(categoryId, "categoryId")), {
      method: "POST",
      ...options,
    });
  },
};

const itemsApi = {
  create(payload = {}, options = {}) {
    return request(ROUTES.items.root, {
      method: "POST",
      body: payload,
      ...options,
    });
  },

  list(params = {}, options = {}) {
    return request(ROUTES.items.root, {
      method: "GET",
      query: params,
      ...options,
    });
  },

  getSelection(options = {}) {
    return request(ROUTES.items.selection, {
      method: "GET",
      ...options,
    });
  },

  get(itemId, options = {}) {
    return request(ROUTES.items.byId(requireId(itemId, "itemId")), {
      method: "GET",
      ...options,
    });
  },

  update(itemId, payload = {}, options = {}) {
    return request(ROUTES.items.byId(requireId(itemId, "itemId")), {
      method: "PUT",
      body: payload,
      ...options,
    });
  },

  delete(itemId, options = {}) {
    return request(ROUTES.items.byId(requireId(itemId, "itemId")), {
      method: "DELETE",
      ...options,
    });
  },

  restore(itemId, options = {}) {
    return request(ROUTES.items.restore(requireId(itemId, "itemId")), {
      method: "POST",
      ...options,
    });
  },
};

const customersApi = {
  create(payload = {}, options = {}) {
    return request(ROUTES.customers.root, {
      method: "POST",
      body: payload,
      ...options,
    });
  },

  list(params = {}, options = {}) {
    return request(ROUTES.customers.root, {
      method: "GET",
      query: params,
      ...options,
    });
  },

  getSelection(options = {}) {
    return request(ROUTES.customers.selection, {
      method: "GET",
      ...options,
    });
  },

  get(customerId, options = {}) {
    return request(ROUTES.customers.byId(requireId(customerId, "customerId")), {
      method: "GET",
      ...options,
    });
  },

  update(customerId, payload = {}, options = {}) {
    return request(ROUTES.customers.byId(requireId(customerId, "customerId")), {
      method: "PUT",
      body: payload,
      ...options,
    });
  },

  delete(customerId, options = {}) {
    return request(ROUTES.customers.byId(requireId(customerId, "customerId")), {
      method: "DELETE",
      ...options,
    });
  },

  restore(customerId, options = {}) {
    return request(ROUTES.customers.restore(requireId(customerId, "customerId")), {
      method: "POST",
      ...options,
    });
  },
};

const salesApi = {
  create(payload = {}, options = {}) {
    return request(ROUTES.sales.root, {
      method: "POST",
      body: normalizeDateFields(payload),
      ...options,
    });
  },

  list(params = {}, options = {}) {
    return request(ROUTES.sales.root, {
      method: "GET",
      query: normalizeDateFields(params),
      ...options,
    });
  },

  get(saleId, options = {}) {
    return request(ROUTES.sales.byId(requireId(saleId, "saleId")), {
      method: "GET",
      ...options,
    });
  },

  update(saleId, payload = {}, options = {}) {
    return request(ROUTES.sales.byId(requireId(saleId, "saleId")), {
      method: "PUT",
      body: normalizeDateFields(payload),
      ...options,
    });
  },

  delete(saleId, options = {}) {
    return request(ROUTES.sales.byId(requireId(saleId, "saleId")), {
      method: "DELETE",
      ...options,
    });
  },

  restore(saleId, options = {}) {
    return request(ROUTES.sales.restore(requireId(saleId, "saleId")), {
      method: "POST",
      ...options,
    });
  },

  void(saleId, remarks, options = {}) {
    return request(ROUTES.sales.void(requireId(saleId, "saleId")), {
      method: "POST",
      query: remarks !== undefined ? { remarks } : undefined,
      ...options,
    });
  },

  deleteLine(saleId, lineId, options = {}) {
    requireId(saleId, "saleId");
    requireId(lineId, "lineId");

    return request(ROUTES.sales.lineById(saleId, lineId), {
      method: "DELETE",
      ...options,
    });
  },
};

const reportsApi = {
  query(payload = {}, options = {}) {
    return request(ROUTES.reports.query, {
      method: "POST",
      body: normalizeDateFields(payload),
      ...options,
    });
  },

  getDaily(params = {}, options = {}) {
    return request(ROUTES.reports.daily, {
      method: "GET",
      query: normalizeDateFields(params),
      ...options,
    });
  },

  getWeekly(params = {}, options = {}) {
    return request(ROUTES.reports.weekly, {
      method: "GET",
      query: normalizeDateFields(params),
      ...options,
    });
  },

  getMonthly(params = {}, options = {}) {
    return request(ROUTES.reports.monthly, {
      method: "GET",
      query: normalizeDateFields(params),
      ...options,
    });
  },

  getCustom(params = {}, options = {}) {
    return request(ROUTES.reports.custom, {
      method: "GET",
      query: normalizeDateFields(params),
      ...options,
    });
  },

  getAccumulation(params = {}, options = {}) {
    return request(ROUTES.reports.accumulation, {
      method: "GET",
      query: normalizeDateFields(params),
      ...options,
    });
  },

  getTrend(payload = {}, options = {}) {
    const { interval, ...body } = payload || {};
    return request(ROUTES.reports.trend, {
      method: "POST",
      query: interval !== undefined ? { interval } : undefined,
      body: normalizeDateFields(body),
      ...options,
    });
  },

  compare(payload = {}, options = {}) {
    return request(ROUTES.reports.compare, {
      method: "POST",
      body: normalizeDateFields(payload),
      ...options,
    });
  },

  getDashboard(params = {}, options = {}) {
    return request(ROUTES.reports.dashboard, {
      method: "GET",
      query: normalizeDateFields(params),
      ...options,
    });
  },

  getCustomerSummary(params = {}, options = {}) {
    return request(ROUTES.reports.summaries.customers, {
      method: "GET",
      query: normalizeDateFields(params),
      ...options,
    });
  },

  getByproductSummary(params = {}, options = {}) {
    return request(ROUTES.reports.summaries.byproducts, {
      method: "GET",
      query: normalizeDateFields(params),
      ...options,
    });
  },

  getCategorySummary(params = {}, options = {}) {
    return request(ROUTES.reports.summaries.categories, {
      method: "GET",
      query: normalizeDateFields(params),
      ...options,
    });
  },
};

const templatesApi = {
  normalize(meta) {
    return normalizeTemplateMeta(meta);
  },

  normalizeList(meta) {
    return normalizeTemplateList(meta);
  },

  create(payload = {}, options = {}) {
    return request(ROUTES.templates.root, {
      method: "POST",
      body: payload,
      ...options,
    }).then(normalizeTemplateMeta);
  },

  upload(payload = {}, options = {}) {
    return request(ROUTES.templates.upload, {
      method: "POST",
      body: buildTemplateUploadFormData(payload),
      ...options,
    }).then(normalizeTemplateMeta);
  },

  list(params = {}, options = {}) {
    return request(ROUTES.templates.root, {
      method: "GET",
      query: params,
      ...options,
    }).then(normalizeTemplateList);
  },

  getDefault(templateType, options = {}) {
    if (!templateType) {
      throw new Error("templateType is required");
    }

    return request(ROUTES.templates.default, {
      method: "GET",
      query: { template_type: templateType },
      ...options,
    }).then((result) => (result ? normalizeTemplateMeta(result) : result));
  },

  get(templateId, options = {}) {
    return request(ROUTES.templates.byId(requireId(templateId, "templateId")), {
      method: "GET",
      ...options,
    }).then(normalizeTemplateMeta);
  },

  update(templateId, payload = {}, options = {}) {
    return request(ROUTES.templates.byId(requireId(templateId, "templateId")), {
      method: "PUT",
      body: payload,
      ...options,
    }).then(normalizeTemplateMeta);
  },

  replaceFile(templateId, file, options = {}) {
    return request(ROUTES.templates.replaceFile(requireId(templateId, "templateId")), {
      method: "POST",
      body: buildReplaceTemplateFileFormData(file),
      ...options,
    }).then(normalizeTemplateMeta);
  },

  delete(templateId, params = {}, options = {}) {
    return request(ROUTES.templates.byId(requireId(templateId, "templateId")), {
      method: "DELETE",
      query: params,
      ...options,
    });
  },

  restore(templateId, options = {}) {
    return request(ROUTES.templates.restore(requireId(templateId, "templateId")), {
      method: "POST",
      ...options,
    }).then(normalizeTemplateMeta);
  },

  setDefault(templateId, options = {}) {
    return request(ROUTES.templates.setDefault(requireId(templateId, "templateId")), {
      method: "POST",
      ...options,
    }).then(normalizeTemplateMeta);
  },

  refreshPlaceholders(templateId, options = {}) {
    return request(
      ROUTES.templates.refreshPlaceholders(requireId(templateId, "templateId")),
      {
        method: "POST",
        ...options,
      }
    ).then(normalizeTemplateMeta);
  },

  previewPlaceholders(templateId, options = {}) {
    return request(ROUTES.templates.placeholders(requireId(templateId, "templateId")), {
      method: "GET",
      ...options,
    });
  },

  async generateDocument(payload = {}, query = {}, options = {}) {
    const response = await request(ROUTES.templates.generate, {
      method: "POST",
      body: normalizeDateFields(payload),
      query,
      ...options,
    });

    return normalizeGeneratedDocumentMeta(response);
  },

  buildGeneratedDocumentUrl(fileName) {
    return generatedApi.buildDocumentUrl(fileName);
  },

  normalizeGeneratedDocumentMeta(meta) {
    return generatedApi.normalizeDocumentMeta(meta);
  },

  openGeneratedDocument(meta, options = {}) {
    return generatedApi.openDocument(meta, options);
  },

  downloadGeneratedDocument(meta, options = {}) {
    return generatedApi.downloadDocument(meta, options);
  },
};

/* ============================================================================
   Main service facade
   - grouped APIs for maintainability
   - backward-compatible methods for existing code
============================================================================ */

export const ByproductsService = {
  getApiBaseUrl,
  routes: ROUTES,

  generated: generatedApi,
  categories: categoriesApi,
  items: itemsApi,
  customers: customersApi,
  sales: salesApi,
  reports: reportsApi,
  templates: templatesApi,

  buildGeneratedDocumentUrl(...args) {
    return generatedApi.buildDocumentUrl(...args);
  },

  normalizeGeneratedDocumentMeta(...args) {
    return generatedApi.normalizeDocumentMeta(...args);
  },

  openGeneratedDocument(...args) {
    return generatedApi.openDocument(...args);
  },

  downloadGeneratedDocument(...args) {
    return generatedApi.downloadDocument(...args);
  },

  createCategory(...args) {
    return categoriesApi.create(...args);
  },

  listCategories(...args) {
    return categoriesApi.list(...args);
  },

  getCategorySelection(...args) {
    return categoriesApi.getSelection(...args);
  },

  getCategory(...args) {
    return categoriesApi.get(...args);
  },

  updateCategory(...args) {
    return categoriesApi.update(...args);
  },

  deleteCategory(...args) {
    return categoriesApi.delete(...args);
  },

  restoreCategory(...args) {
    return categoriesApi.restore(...args);
  },

  createItem(...args) {
    return itemsApi.create(...args);
  },

  listItems(...args) {
    return itemsApi.list(...args);
  },

  getItemSelection(...args) {
    return itemsApi.getSelection(...args);
  },

  getItem(...args) {
    return itemsApi.get(...args);
  },

  updateItem(...args) {
    return itemsApi.update(...args);
  },

  deleteItem(...args) {
    return itemsApi.delete(...args);
  },

  restoreItem(...args) {
    return itemsApi.restore(...args);
  },

  createCustomer(...args) {
    return customersApi.create(...args);
  },

  listCustomers(...args) {
    return customersApi.list(...args);
  },

  getCustomerSelection(...args) {
    return customersApi.getSelection(...args);
  },

  getCustomer(...args) {
    return customersApi.get(...args);
  },

  updateCustomer(...args) {
    return customersApi.update(...args);
  },

  deleteCustomer(...args) {
    return customersApi.delete(...args);
  },

  restoreCustomer(...args) {
    return customersApi.restore(...args);
  },

  createSale(...args) {
    return salesApi.create(...args);
  },

  listSales(...args) {
    return salesApi.list(...args);
  },

  getSale(...args) {
    return salesApi.get(...args);
  },

  updateSale(...args) {
    return salesApi.update(...args);
  },

  deleteSale(...args) {
    return salesApi.delete(...args);
  },

  restoreSale(...args) {
    return salesApi.restore(...args);
  },

  voidSale(...args) {
    return salesApi.void(...args);
  },

  deleteSaleLine(...args) {
    return salesApi.deleteLine(...args);
  },

  queryReport(...args) {
    return reportsApi.query(...args);
  },

  getDailyReport(...args) {
    return reportsApi.getDaily(...args);
  },

  getWeeklyReport(...args) {
    return reportsApi.getWeekly(...args);
  },

  getMonthlyReport(...args) {
    return reportsApi.getMonthly(...args);
  },

  getCustomPeriodReport(...args) {
    return reportsApi.getCustom(...args);
  },

  getAccumulationReport(...args) {
    return reportsApi.getAccumulation(...args);
  },

  getTrendReport(...args) {
    return reportsApi.getTrend(...args);
  },

  compareWithPreviousPeriod(...args) {
    return reportsApi.compare(...args);
  },

  getDashboard(...args) {
    return reportsApi.getDashboard(...args);
  },

  getCustomerSummary(...args) {
    return reportsApi.getCustomerSummary(...args);
  },

  getByproductSummary(...args) {
    return reportsApi.getByproductSummary(...args);
  },

  getCategorySummary(...args) {
    return reportsApi.getCategorySummary(...args);
  },

  createTemplate(...args) {
    return templatesApi.create(...args);
  },

  uploadTemplate(...args) {
    return templatesApi.upload(...args);
  },

  listTemplates(...args) {
    return templatesApi.list(...args);
  },

  getDefaultTemplate(...args) {
    return templatesApi.getDefault(...args);
  },

  getTemplate(...args) {
    return templatesApi.get(...args);
  },

  updateTemplate(...args) {
    return templatesApi.update(...args);
  },

  replaceTemplateFile(...args) {
    return templatesApi.replaceFile(...args);
  },

  deleteTemplate(...args) {
    return templatesApi.delete(...args);
  },

  restoreTemplate(...args) {
    return templatesApi.restore(...args);
  },

  setDefaultTemplate(...args) {
    return templatesApi.setDefault(...args);
  },

  refreshTemplatePlaceholders(...args) {
    return templatesApi.refreshPlaceholders(...args);
  },

  previewTemplatePlaceholders(...args) {
    return templatesApi.previewPlaceholders(...args);
  },

  generateReportDocument(...args) {
    return templatesApi.generateDocument(...args);
  },

  getCategories(...args) {
    return categoriesApi.list(...args);
  },

  getItems(...args) {
    return itemsApi.list(...args);
  },

  getCustomers(...args) {
    return customersApi.list(...args);
  },

  getSales(...args) {
    return salesApi.list(...args);
  },
};

/* ============================================================================
   Named grouped exports
============================================================================ */

export const ByproductGeneratedApi = generatedApi;
export const ByproductCategoriesApi = categoriesApi;
export const ByproductItemsApi = itemsApi;
export const ByproductCustomersApi = customersApi;
export const ByproductSalesApi = salesApi;
export const ByproductReportsApi = reportsApi;
export const ByproductTemplatesApi = templatesApi;

/* ============================================================================
   Backward-compatible named exports
============================================================================ */

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