// frontend/services/orders.js

import axios from "axios";
import { getToken } from "./auth";

/* ============================================================================
   Orders Service
   ----------------------------------------------------------------------------
   Matches backend routes:
   - POST   /orders
   - GET    /orders
   - GET    /orders/{order_id}
   - PATCH  /orders/{order_id}
   - PATCH  /orders/{order_id}/status
   - PATCH  /orders/{order_id}/delivery
   - PATCH  /orders/{order_id}/financial
   - DELETE /orders/{order_id}

   Fixes:
   - Safer backend base URL resolution
   - Better FastAPI 422 / validation error parsing
   - Create payload omits empty optional fields to avoid validation issues
   - Update payload preserves nulls so fields can still be cleared when needed
   - Date serialization remains consistent for FastAPI date fields
============================================================================ */

/* ============================================================================
   Constants
============================================================================ */
export const ORDER_TYPES = Object.freeze({
  LOCAL: "local",
  CHILLED: "chilled",
  FROZEN: "frozen",
});

export const ORDER_PROFILES = Object.freeze({
  STANDARD_ORDER: "standard_order",
  FROZEN_CONTAINER: "frozen_container",
});

export const ORDER_STATUSES = Object.freeze({
  DRAFT: "draft",
  CONFIRMED: "confirmed",
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
});

const DATE_KEYS = new Set([
  "slaughter_schedule",
  "expected_delivery",
  "container_gate_in",
  "departure_date",
  "slaughter_date_from",
  "slaughter_date_to",
  "delivery_date_from",
  "delivery_date_to",
  "container_gate_in_from",
  "container_gate_in_to",
  "departure_date_from",
  "departure_date_to",
]);

const DEFAULT_TIMEOUT = 30000;

/* ============================================================================
   Base URL helpers
============================================================================ */
function trimTrailingSlash(value) {
  return String(value || "").replace(/\/+$/, "");
}

function trimLeadingSlash(value) {
  return String(value || "").replace(/^\/+/, "");
}

function joinUrl(base, path) {
  const safeBase = trimTrailingSlash(base);
  const safePath = trimLeadingSlash(path);
  return safeBase ? `${safeBase}/${safePath}` : `/${safePath}`;
}

function resolveApiBase() {
  const candidates = [
    process.env.NEXT_PUBLIC_API_BASE_URL,
    process.env.NEXT_PUBLIC_API_URL,
    process.env.NEXT_PUBLIC_BACKEND_API_URL,
    process.env.NEXT_PUBLIC_BACKEND_URL,
    "http://127.0.0.1:8000",
  ];

  for (const candidate of candidates) {
    if (candidate && String(candidate).trim()) {
      return trimTrailingSlash(candidate);
    }
  }

  return "http://127.0.0.1:8000";
}

const API_BASE = resolveApiBase();
const ORDERS_BASE = joinUrl(API_BASE, "orders");

/* ============================================================================
   Generic helpers
============================================================================ */
function isPlainObject(value) {
  return Object.prototype.toString.call(value) === "[object Object]";
}

function isValidDate(value) {
  return value instanceof Date && !Number.isNaN(value.getTime());
}

function isNil(value) {
  return value === undefined || value === null;
}

function isBlankString(value) {
  return typeof value === "string" && value.trim() === "";
}

function formatDateOnly(value) {
  if (!value) return value;

  if (typeof value === "string") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

    const parsed = new Date(value);
    if (isValidDate(parsed)) {
      const yyyy = parsed.getFullYear();
      const mm = String(parsed.getMonth() + 1).padStart(2, "0");
      const dd = String(parsed.getDate()).padStart(2, "0");
      return `${yyyy}-${mm}-${dd}`;
    }

    return value;
  }

  if (isValidDate(value)) {
    const yyyy = value.getFullYear();
    const mm = String(value.getMonth() + 1).padStart(2, "0");
    const dd = String(value.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  return value;
}

function cleanObject(input, { omitNull = false, omitBlank = false } = {}) {
  if (!isPlainObject(input)) return input;

  const out = {};
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) continue;
    if (omitNull && value === null) continue;
    if (omitBlank && isBlankString(value)) continue;
    out[key] = value;
  }
  return out;
}

function serializeValueByKey(key, value, options = {}) {
  const { omitNull = false, omitBlank = false } = options;

  if (value === undefined) return undefined;
  if (value === null) return omitNull ? undefined : null;
  if (omitBlank && isBlankString(value)) return undefined;

  if (DATE_KEYS.has(key)) {
    return formatDateOnly(value);
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (isPlainObject(item)) {
          return serializePayload(item, options);
        }
        if (isValidDate(item)) {
          return formatDateOnly(item);
        }
        return item;
      })
      .filter((item) => item !== undefined);
  }

  if (isValidDate(value)) {
    return formatDateOnly(value);
  }

  if (isPlainObject(value)) {
    return serializePayload(value, options);
  }

  return value;
}

function serializePayload(payload, options = {}) {
  if (!isPlainObject(payload)) return payload;

  const out = {};
  for (const [key, value] of Object.entries(payload)) {
    const serialized = serializeValueByKey(key, value, options);
    if (serialized === undefined) continue;
    out[key] = serialized;
  }
  return out;
}

function buildQueryParams(filters = {}) {
  const params = new URLSearchParams();

  Object.entries(cleanObject(filters, { omitNull: true, omitBlank: true })).forEach(
    ([key, value]) => {
      if (Array.isArray(value)) {
        value.forEach((item) => {
          if (!isNil(item) && !isBlankString(item)) {
            params.append(key, String(item));
          }
        });
        return;
      }

      const serialized = serializeValueByKey(key, value, {
        omitNull: true,
        omitBlank: true,
      });

      if (serialized !== undefined && serialized !== null && serialized !== "") {
        params.append(key, String(serialized));
      }
    }
  );

  return params;
}

function unwrapResponseData(response) {
  if (!response) return null;
  return response.data;
}

function parseFastApiDetail(detail) {
  if (Array.isArray(detail)) {
    return detail
      .map((entry) => {
        if (typeof entry === "string") return entry;

        if (isPlainObject(entry)) {
          const loc = Array.isArray(entry.loc) ? entry.loc.join(".") : "";
          const msg = entry.msg ? String(entry.msg) : JSON.stringify(entry);
          return loc ? `${loc}: ${msg}` : msg;
        }

        return String(entry);
      })
      .join(" | ");
  }

  if (isPlainObject(detail)) {
    if (typeof detail.message === "string") return detail.message;
    return JSON.stringify(detail);
  }

  if (detail === undefined || detail === null) return "Request failed";
  return String(detail);
}

function normalizeError(error) {
  if (axios.isAxiosError(error)) {
    const responseData = error?.response?.data;
    const rawDetail =
      responseData?.detail ??
      responseData?.message ??
      error?.message ??
      "Request failed";

    const message = parseFastApiDetail(rawDetail);

    const normalized = new Error(message);
    normalized.status = error?.response?.status || 0;
    normalized.data = responseData || null;
    normalized.original = error;
    return normalized;
  }

  if (error instanceof Error) return error;
  return new Error("Unexpected request error");
}

function getAuthHeaders(extraHeaders = {}) {
  const token = typeof getToken === "function" ? getToken() : null;

  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extraHeaders,
  };
}

async function request(method, url, { params, data, headers, signal, timeout } = {}) {
  try {
    const response = await axios({
      method,
      url,
      params,
      data,
      headers: getAuthHeaders(headers),
      signal,
      timeout: timeout || DEFAULT_TIMEOUT,
    });

    return unwrapResponseData(response);
  } catch (error) {
    throw normalizeError(error);
  }
}

/* ============================================================================
   Response normalizers
============================================================================ */
function normalizeOrder(order) {
  if (!order || typeof order !== "object") return order;

  return {
    ...order,
    items_json: Array.isArray(order.items_json) ? order.items_json : [],
  };
}

function normalizeOrderListResponse(data) {
  return {
    items: Array.isArray(data?.items) ? data.items.map(normalizeOrder) : [],
    total: Number(data?.total || 0),
    page: Number(data?.page || 1),
    page_size: Number(data?.page_size || 10),
  };
}

/* ============================================================================
   Payload builders
============================================================================ */
function normalizeItems(items, { omitNull = false, omitBlank = false } = {}) {
  if (!Array.isArray(items)) return [];

  return items
    .map((item) => {
      if (!isPlainObject(item)) return null;

      const normalized = {
        product_name: item?.product_name ?? "",
        animal_type: item?.animal_type ?? null,
        quantity_kg: item?.quantity_kg ?? 0,
        notes: item?.notes ?? null,
      };

      if (item?.pieces_required !== undefined) {
        normalized.pieces_required = item.pieces_required;
      }

      if (item?.animals_required !== undefined) {
        normalized.animals_required = item.animals_required;
      }

      return serializePayload(normalized, { omitNull, omitBlank });
    })
    .filter(Boolean);
}

function buildCreatePayload(payload = {}) {
  const normalized = {
    ...payload,
    ...(payload.items_json ? { items_json: normalizeItems(payload.items_json, { omitNull: true, omitBlank: true }) } : {}),
  };

  return serializePayload(normalized, {
    omitNull: true,
    omitBlank: true,
  });
}

function buildUpdatePayload(payload = {}) {
  const normalized = {
    ...payload,
    ...(payload.items_json ? { items_json: normalizeItems(payload.items_json, { omitNull: false, omitBlank: false }) } : {}),
  };

  return serializePayload(normalized, {
    omitNull: false,
    omitBlank: false,
  });
}

function buildStatusPayload(input) {
  if (typeof input === "string") {
    return { status: input };
  }

  return serializePayload(cleanObject(input || {}), {
    omitNull: false,
    omitBlank: true,
  });
}

function buildDeliveryPayload(payload = {}) {
  return serializePayload(
    cleanObject(
      {
        slaughter_schedule: payload.slaughter_schedule,
        delivery_days_offset: payload.delivery_days_offset,
        expected_delivery: payload.expected_delivery,
        is_delivery_date_manual: payload.is_delivery_date_manual,
      },
      { omitNull: false, omitBlank: false }
    ),
    { omitNull: false, omitBlank: false }
  );
}

function buildFinancialPayload(payload = {}) {
  return serializePayload(
    cleanObject(
      {
        shipment_value_usd: payload.shipment_value_usd,
        price_per_kg_usd: payload.price_per_kg_usd,
        amount_paid_usd: payload.amount_paid_usd,
        balance_usd: payload.balance_usd,
      },
      { omitNull: false, omitBlank: false }
    ),
    { omitNull: false, omitBlank: false }
  );
}

/* ============================================================================
   Main service
============================================================================ */
export const OrderService = {
  getBaseUrl() {
    return ORDERS_BASE;
  },

  async list(filters = {}, options = {}) {
    const params = buildQueryParams({
      search: filters.search,
      order_type: filters.order_type,
      order_profile: filters.order_profile,
      order_subtype: filters.order_subtype,
      status: filters.status,
      report_month: filters.report_month,
      report_year: filters.report_year,
      jurisdiction: filters.jurisdiction,
      slaughter_date_from: filters.slaughter_date_from,
      slaughter_date_to: filters.slaughter_date_to,
      delivery_date_from: filters.delivery_date_from,
      delivery_date_to: filters.delivery_date_to,
      container_gate_in_from: filters.container_gate_in_from,
      container_gate_in_to: filters.container_gate_in_to,
      departure_date_from: filters.departure_date_from,
      departure_date_to: filters.departure_date_to,
      page: filters.page,
      page_size: filters.page_size,
    });

    const data = await request("get", ORDERS_BASE, {
      params,
      signal: options.signal,
      timeout: options.timeout,
    });

    return normalizeOrderListResponse(data);
  },

  async getById(orderId, options = {}) {
    if (!orderId && orderId !== 0) {
      throw new Error("orderId is required");
    }

    const data = await request("get", `${ORDERS_BASE}/${orderId}`, {
      signal: options.signal,
      timeout: options.timeout,
    });

    return normalizeOrder(data);
  },

  async create(payload, options = {}) {
    const body = buildCreatePayload(payload);

    const data = await request("post", ORDERS_BASE, {
      data: body,
      signal: options.signal,
      timeout: options.timeout,
    });

    return normalizeOrder(data);
  },

  async update(orderId, payload, options = {}) {
    if (!orderId && orderId !== 0) {
      throw new Error("orderId is required");
    }

    const body = buildUpdatePayload(payload);

    const data = await request("patch", `${ORDERS_BASE}/${orderId}`, {
      data: body,
      signal: options.signal,
      timeout: options.timeout,
    });

    return normalizeOrder(data);
  },

  async updateStatus(orderId, statusOrPayload, options = {}) {
    if (!orderId && orderId !== 0) {
      throw new Error("orderId is required");
    }

    const body = buildStatusPayload(statusOrPayload);
    if (!body?.status) {
      throw new Error("status is required");
    }

    const data = await request("patch", `${ORDERS_BASE}/${orderId}/status`, {
      data: body,
      signal: options.signal,
      timeout: options.timeout,
    });

    return normalizeOrder(data);
  },

  async updateDelivery(orderId, payload, options = {}) {
    if (!orderId && orderId !== 0) {
      throw new Error("orderId is required");
    }

    const body = buildDeliveryPayload(payload);

    const data = await request("patch", `${ORDERS_BASE}/${orderId}/delivery`, {
      data: body,
      signal: options.signal,
      timeout: options.timeout,
    });

    return normalizeOrder(data);
  },

  async updateFinancial(orderId, payload, options = {}) {
    if (!orderId && orderId !== 0) {
      throw new Error("orderId is required");
    }

    const body = buildFinancialPayload(payload);

    const data = await request("patch", `${ORDERS_BASE}/${orderId}/financial`, {
      data: body,
      signal: options.signal,
      timeout: options.timeout,
    });

    return normalizeOrder(data);
  },

  async remove(orderId, options = {}) {
    if (!orderId && orderId !== 0) {
      throw new Error("orderId is required");
    }

    return request("delete", `${ORDERS_BASE}/${orderId}`, {
      signal: options.signal,
      timeout: options.timeout,
    });
  },

  async createDraft(payload = {}, options = {}) {
    return this.create(
      {
        ...payload,
        status: payload.status || ORDER_STATUSES.DRAFT,
      },
      options
    );
  },

  async confirm(orderId, options = {}) {
    return this.updateStatus(orderId, ORDER_STATUSES.CONFIRMED, options);
  },

  async markInProgress(orderId, options = {}) {
    return this.updateStatus(orderId, ORDER_STATUSES.IN_PROGRESS, options);
  },

  async complete(orderId, options = {}) {
    return this.updateStatus(orderId, ORDER_STATUSES.COMPLETED, options);
  },

  async cancel(orderId, options = {}) {
    return this.updateStatus(orderId, ORDER_STATUSES.CANCELLED, options);
  },
};

/* ============================================================================
   Named helper exports
============================================================================ */
export function buildOrderListParams(filters = {}) {
  return buildQueryParams(filters);
}

export function prepareOrderCreatePayload(payload = {}) {
  return buildCreatePayload(payload);
}

export function prepareOrderPayload(payload = {}) {
  return buildUpdatePayload(payload);
}

export function prepareOrderDeliveryPayload(payload = {}) {
  return buildDeliveryPayload(payload);
}

export function prepareOrderFinancialPayload(payload = {}) {
  return buildFinancialPayload(payload);
}

export function prepareOrderStatusPayload(input) {
  return buildStatusPayload(input);
}

export default OrderService;