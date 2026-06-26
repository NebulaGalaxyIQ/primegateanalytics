/*
  Ranch Dynamic Inventory API Service
  Path: frontend/services/dynamic-inventory.js

  This service matches the backend router mounted at /inventory-systems.
  It supports the ranch inventory flow:
  - departments/templates
  - create inventory from template
  - today sheet / period detail
  - rows with system-owned calculations
  - submit/approve/reject/lock
  - history
  - PDF/Excel/CSV exports
*/

const DEFAULT_API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  "http://127.0.0.1:8000";

const INVENTORY_BASE = "/inventory-systems";

function isBrowser() {
  return typeof window !== "undefined";
}

function getStoredToken() {
  if (!isBrowser()) return "";

  const keys = [
    "access_token",
    "accessToken",
    "token",
    "authToken",
    "pg_access_token",
  ];

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
    // Ignore malformed local storage values.
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
      if (parsed?.id || parsed?.user_id || parsed?.role) return parsed;
    } catch (_) {
      // Continue.
    }
  }
  return null;
}

function getUserId(explicitUserId) {
  if (explicitUserId) return explicitUserId;
  const user = getStoredUser();
  return user?.id || user?.user_id || 1;
}

function getIsAdmin(explicitIsAdmin) {
  if (typeof explicitIsAdmin === "boolean") return explicitIsAdmin;
  const user = getStoredUser();
  const role = String(user?.role || "").toLowerCase();
  return Boolean(user?.is_superuser || user?.is_admin || role === "admin" || role === "superadmin");
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
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

function normalizeErrorPayload(payload) {
  if (!payload) return "Request failed.";
  if (typeof payload === "string") return payload;
  if (payload.detail) {
    if (typeof payload.detail === "string") return payload.detail;
    if (Array.isArray(payload.detail)) {
      return payload.detail
        .map((item) => item?.msg || item?.message || JSON.stringify(item))
        .join("; ");
    }
    return JSON.stringify(payload.detail);
  }
  if (payload.message) return payload.message;
  if (payload.error) return payload.error;
  return JSON.stringify(payload);
}

class DynamicInventoryApiError extends Error {
  constructor(message, { status, payload } = {}) {
    super(message);
    this.name = "DynamicInventoryApiError";
    this.status = status;
    this.payload = payload;
  }
}

async function parseResponse(response, { blob = false } = {}) {
  if (blob) {
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new DynamicInventoryApiError(text || response.statusText, {
        status: response.status,
        payload: text,
      });
    }
    return response.blob();
  }

  const contentType = response.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  const payload = isJson ? await response.json().catch(() => null) : await response.text().catch(() => "");

  if (!response.ok) {
    throw new DynamicInventoryApiError(normalizeErrorPayload(payload), {
      status: response.status,
      payload,
    });
  }

  return payload;
}

async function request(path, options = {}) {
  const {
    method = "GET",
    body,
    headers = {},
    token,
    userId,
    isAdmin,
    blob = false,
    apiBase = DEFAULT_API_BASE,
  } = options;

  const resolvedToken = token || getStoredToken();
  const resolvedUserId = getUserId(userId);
  const resolvedIsAdmin = getIsAdmin(isAdmin);

  const finalHeaders = {
    Accept: blob ? "*/*" : "application/json",
    "X-User-Id": String(resolvedUserId || 1),
    "X-Is-Admin": String(Boolean(resolvedIsAdmin)),
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

  if (resolvedToken) finalHeaders.Authorization = `Bearer ${resolvedToken}`;

  const url = `${apiBase}${path}`;
  const response = await fetch(url, {
    method,
    headers: finalHeaders,
    body: finalBody,
  });

  return parseResponse(response, { blob });
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


function safeArrayForService(value) {
  return Array.isArray(value) ? value : [];
}

function labelFromInventoryType(value) {
  return String(value || "custom")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function cleanTemplateItem(item = {}, removeKeys = []) {
  const cleaned = { ...(item || {}) };
  [
    "id",
    "template_id",
    "inventory_id",
    "created_at",
    "updated_at",
    "created_by_user_id",
    "updated_by_user_id",
    ...removeKeys,
  ].forEach((key) => delete cleaned[key]);
  return cleaned;
}

function normalizeAssignedUserIds(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => Number(item?.user_id || item?.id || item))
      .filter((item) => Number.isFinite(item) && item > 0);
  }
  return String(value || "")
    .split(",")
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isFinite(item) && item > 0);
}

function getTemplateFields(template = {}) {
  return (
    template.template_fields ||
    template.fields ||
    template.fields_json ||
    []
  ).map((item) => cleanTemplateItem(item));
}

function getTemplateRules(template = {}) {
  return (
    template.template_calculation_rules ||
    template.calculation_rules ||
    template.calculation_rules_json ||
    []
  ).map((item) => cleanTemplateItem(item));
}

function getTemplateMetrics(template = {}) {
  return (
    template.template_metrics ||
    template.metrics ||
    template.metrics_json ||
    []
  ).map((item) => cleanTemplateItem(item));
}

function buildCreatePayloadFromTemplate(payload = {}, template = null) {
  const assignedIds = normalizeAssignedUserIds(payload.assigned_user_ids);
  const inventoryType = template?.inventory_type || payload.inventory_type || "custom";
  const title = payload.title || template?.name || labelFromInventoryType(inventoryType);

  const createPayload = {
    title,
    description: payload.description || template?.description || `General ${labelFromInventoryType(inventoryType).toLowerCase()} records.`,
    department: template?.department || payload.department,
    inventory_type: inventoryType,
    template_id: template?.id || payload.template_id || undefined,
    report_title: payload.report_title || `${title} Report`,
    reporter_name: payload.reporter_name || undefined,
    company_name: payload.company_name || undefined,
    access_type: payload.access_type || "assigned_users",
    fields: template ? getTemplateFields(template) : [],
    calculation_rules: template ? getTemplateRules(template) : [],
    metrics: template ? getTemplateMetrics(template) : [],
    user_access: assignedIds.map((userId) => ({ user_id: userId, role: "editor" })),
  };

  Object.keys(createPayload).forEach((key) => {
    if (createPayload[key] === undefined || createPayload[key] === null) delete createPayload[key];
  });

  return createPayload;
}

const DynamicInventoryService = {
  apiBase: DEFAULT_API_BASE,
  todayIsoDate,

  health(options = {}) {
    return request(`${INVENTORY_BASE}/health`, options);
  },

  seedDefaults(options = {}) {
    return request(`${INVENTORY_BASE}/seed/defaults`, { method: "POST", ...options });
  },

  getDashboard(params = {}, options = {}) {
    return request(`${INVENTORY_BASE}/dashboard${buildQuery(params)}`, options);
  },

  getDepartmentOptions(options = {}) {
    return request(`${INVENTORY_BASE}/department-options`, options);
  },

  getInventoryTypeOptions(params = {}, options = {}) {
    return request(`${INVENTORY_BASE}/inventory-type-options${buildQuery(params)}`, options);
  },

  getTemplates(params = {}, options = {}) {
    return request(`${INVENTORY_BASE}/templates${buildQuery(params)}`, options);
  },

  getTemplate(templateId, options = {}) {
    return request(`${INVENTORY_BASE}/templates/${templateId}`, options);
  },

  getLookupOptions(params = {}, options = {}) {
    return request(`${INVENTORY_BASE}/lookup-options${buildQuery(params)}`, options);
  },

  createLookupOption(payload, options = {}) {
    return request(`${INVENTORY_BASE}/lookup-options`, { method: "POST", body: payload, ...options });
  },

  listInventories(params = {}, options = {}) {
    return request(`${INVENTORY_BASE}${buildQuery(params)}`, options);
  },

  getInventory(inventoryId, options = {}) {
    return request(`${INVENTORY_BASE}/${inventoryId}`, options);
  },

  async createInventoryFromTemplate(payload, options = {}) {
    try {
      return await request(`${INVENTORY_BASE}/from-template`, {
        method: "POST",
        body: payload,
        ...options,
      });
    } catch (err) {
      // Some local backends may not yet have /from-template registered, or may
      // return 404 when a valid inventory_type has no full seeded template yet.
      // Fallback to the normal create endpoint so the UI can still create every
      // valid animal/crop/machinery/custom module.
      if (err?.status !== 404) throw err;

      let template = null;
      if (payload?.template_id) {
        try {
          template = await this.getTemplate(payload.template_id, options);
        } catch (_) {
          template = null;
        }
      }

      if (!template && payload?.department && payload?.inventory_type) {
        try {
          const templates = await this.getTemplates({ department: payload.department }, options);
          template = safeArrayForService(templates).find((item) => String(item.inventory_type) === String(payload.inventory_type)) || null;
        } catch (_) {
          template = null;
        }
      }

      return request(`${INVENTORY_BASE}`, {
        method: "POST",
        body: buildCreatePayloadFromTemplate(payload, template),
        ...options,
      });
    }
  },

  updateInventory(inventoryId, payload, options = {}) {
    return request(`${INVENTORY_BASE}/${inventoryId}`, {
      method: "PATCH",
      body: payload,
      ...options,
    });
  },

  deleteInventory(inventoryId, options = {}) {
    return request(`${INVENTORY_BASE}/${inventoryId}`, {
      method: "DELETE",
      ...options,
    });
  },

  archiveInventory(inventoryId, payload = {}, options = {}) {
    return request(`${INVENTORY_BASE}/${inventoryId}/archive`, {
      method: "POST",
      body: payload,
      ...options,
    });
  },

  restoreInventory(inventoryId, options = {}) {
    return request(`${INVENTORY_BASE}/${inventoryId}/restore`, {
      method: "POST",
      ...options,
    });
  },

  getTodaySheet(inventoryId, params = {}, options = {}) {
    return request(`${INVENTORY_BASE}/${inventoryId}/today${buildQuery(params)}`, options);
  },

  getPeriod(periodId, options = {}) {
    return request(`${INVENTORY_BASE}/periods/${periodId}`, options);
  },

  getHistory(inventoryId, params = {}, options = {}) {
    return request(`${INVENTORY_BASE}/${inventoryId}/history${buildQuery(params)}`, options);
  },

  addRow(inventoryId, periodId, payload, options = {}) {
    return request(`${INVENTORY_BASE}/${inventoryId}/periods/${periodId}/rows`, {
      method: "POST",
      body: payload,
      ...options,
    });
  },

  updateRow(inventoryId, periodId, rowId, payload, options = {}) {
    return request(`${INVENTORY_BASE}/${inventoryId}/periods/${periodId}/rows/${rowId}`, {
      method: "PATCH",
      body: payload,
      ...options,
    });
  },

  deleteRow(inventoryId, periodId, rowId, payload = {}, options = {}) {
    return request(`${INVENTORY_BASE}/${inventoryId}/periods/${periodId}/rows/${rowId}`, {
      method: "DELETE",
      body: payload,
      ...options,
    });
  },

  submitPeriod(periodId, payload = {}, options = {}) {
    return request(`${INVENTORY_BASE}/periods/${periodId}/submit`, {
      method: "POST",
      body: payload,
      ...options,
    });
  },

  approvePeriod(periodId, payload = {}, options = {}) {
    return request(`${INVENTORY_BASE}/periods/${periodId}/approve`, {
      method: "POST",
      body: payload,
      ...options,
    });
  },

  rejectPeriod(periodId, payload = {}, options = {}) {
    return request(`${INVENTORY_BASE}/periods/${periodId}/reject`, {
      method: "POST",
      body: payload,
      ...options,
    });
  },

  lockPeriod(periodId, payload = {}, options = {}) {
    return request(`${INVENTORY_BASE}/periods/${periodId}/lock`, {
      method: "POST",
      body: payload,
      ...options,
    });
  },

  unlockPeriod(periodId, payload = {}, options = {}) {
    return request(`${INVENTORY_BASE}/periods/${periodId}/unlock`, {
      method: "POST",
      body: payload,
      ...options,
    });
  },

  getReportData(inventoryId, payload, options = {}) {
    return request(`${INVENTORY_BASE}/${inventoryId}/reports/data`, {
      method: "POST",
      body: payload,
      ...options,
    });
  },

  exportExcel(inventoryId, params = {}, options = {}) {
    return request(`${INVENTORY_BASE}/${inventoryId}/reports/excel${buildQuery(params)}`, {
      blob: true,
      ...options,
    });
  },

  exportPdf(inventoryId, params = {}, options = {}) {
    return request(`${INVENTORY_BASE}/${inventoryId}/reports/pdf${buildQuery(params)}`, {
      blob: true,
      ...options,
    });
  },

  exportCsv(inventoryId, params = {}, options = {}) {
    return request(`${INVENTORY_BASE}/${inventoryId}/reports/csv${buildQuery(params)}`, {
      blob: true,
      ...options,
    });
  },

  async downloadExcel(inventoryId, params = {}, filename = "inventory-report.xlsx", options = {}) {
    const blob = await this.exportExcel(inventoryId, params, options);
    downloadBlob(blob, filename);
    return blob;
  },

  async downloadPdf(inventoryId, params = {}, filename = "inventory-report.pdf", options = {}) {
    const blob = await this.exportPdf(inventoryId, params, options);
    downloadBlob(blob, filename);
    return blob;
  },

  async downloadCsv(inventoryId, params = {}, filename = "inventory-report.csv", options = {}) {
    const blob = await this.exportCsv(inventoryId, params, options);
    downloadBlob(blob, filename);
    return blob;
  },

  listAccess(inventoryId, options = {}) {
    return request(`${INVENTORY_BASE}/${inventoryId}/access`, options);
  },

  assignAccess(inventoryId, payload, options = {}) {
    return request(`${INVENTORY_BASE}/${inventoryId}/access`, {
      method: "POST",
      body: payload,
      ...options,
    });
  },

  removeAccess(inventoryId, accessId, options = {}) {
    return request(`${INVENTORY_BASE}/${inventoryId}/access/${accessId}`, {
      method: "DELETE",
      ...options,
    });
  },

  listCredentials(inventoryId, options = {}) {
    return request(`${INVENTORY_BASE}/${inventoryId}/credentials`, options);
  },

  createCredential(inventoryId, payload, options = {}) {
    return request(`${INVENTORY_BASE}/${inventoryId}/credentials`, {
      method: "POST",
      body: payload,
      ...options,
    });
  },

  updateCredential(inventoryId, credentialId, payload, options = {}) {
    return request(`${INVENTORY_BASE}/${inventoryId}/credentials/${credentialId}`, {
      method: "PATCH",
      body: payload,
      ...options,
    });
  },

  deleteCredential(inventoryId, credentialId, options = {}) {
    return request(`${INVENTORY_BASE}/${inventoryId}/credentials/${credentialId}`, {
      method: "DELETE",
      ...options,
    });
  },

  listAlerts(inventoryId, params = {}, options = {}) {
    return request(`${INVENTORY_BASE}/${inventoryId}/alerts${buildQuery(params)}`, options);
  },

  listAuditLogs(inventoryId, params = {}, options = {}) {
    return request(`${INVENTORY_BASE}/${inventoryId}/audit-logs${buildQuery(params)}`, options);
  },

  uploadAttachment(inventoryId, formData, options = {}) {
    return request(`${INVENTORY_BASE}/${inventoryId}/attachments`, {
      method: "POST",
      body: formData,
      ...options,
    });
  },

  DynamicInventoryApiError,
};

export default DynamicInventoryService;
export { DynamicInventoryApiError, downloadBlob, todayIsoDate };
