import Head from "next/head";
import { useCallback, useEffect, useMemo, useState } from "react";
import ByproductsService from "../../services/byproducts";

const PAGE_BG = "#f8fafc";
const SURFACE = "#ffffff";
const TEXT = "#0f172a";
const MUTED = "#64748b";
const BORDER = "#e2e8f0";
const ORANGE = "#ff7a00";
const ORANGE_DEEP = "#e86a00";
const ORANGE_SOFT = "rgba(255,122,0,0.10)";
const BLUE = "#2563eb";
const BLUE_SOFT = "rgba(37,99,235,0.10)";
const GREEN = "#16a34a";
const GREEN_SOFT = "rgba(22,163,74,0.10)";
const RED = "#dc2626";
const RED_SOFT = "rgba(220,38,38,0.10)";
const SHADOW = "0 10px 30px rgba(15, 23, 42, 0.06)";

const CUSTOMER_TYPE_OPTIONS = [
  "retail",
  "wholesale",
  "distributor",
  "agent",
  "processor",
  "other",
];

const PAYMENT_MODE_OPTIONS = [
  "cash",
  "credit",
  "bank_transfer",
  "mobile_money",
  "cheque",
  "mixed",
  "other",
];

const FIELD_LABELS = {
  customer_code: "Customer code",
  customer_name: "Customer name",
  transaction_name: "Transaction name",
  contact_person: "Contact person",
  phone_number: "Phone number",
  alternative_phone_number: "Alternative phone number",
  email: "Email",
  address: "Address",
  business_location: "Business location",
  district: "District",
  region: "Region",
  tin_number: "TIN number",
  registration_number: "Registration number",
  customer_type: "Customer type",
  default_payment_mode: "Default payment mode",
  credit_allowed: "Credit allowed",
  credit_limit: "Credit limit",
  notes: "Notes",
  is_active: "Active customer",
};

function coerceItems(response) {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.items)) return response.items;
  if (Array.isArray(response?.data?.items)) return response.data.items;
  if (Array.isArray(response?.data)) return response.data;
  return [];
}

function coerceTotal(response) {
  if (typeof response?.total === "number") return response.total;
  if (typeof response?.data?.total === "number") return response.data.total;
  return coerceItems(response).length;
}

function cleanText(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function toNullableText(value) {
  const cleaned = cleanText(value);
  return cleaned ? cleaned : null;
}

function toNumberOrNull(value) {
  if (value === "" || value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeLooseEnum(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^\w\s-]/g, "")
    .replace(/[-\s]+/g, "_")
    .replace(/_{2,}/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeCustomerType(value) {
  const normalized = normalizeLooseEnum(value);

  const map = {
    retail: "retail",
    retailer: "retail",
    shop: "retail",
    shopkeeper: "retail",

    wholesale: "wholesale",
    wholesaler: "wholesale",
    whole_sale: "wholesale",
    bulk: "wholesale",

    distributor: "distributor",
    distribution: "distributor",
    supplier: "distributor",

    agent: "agent",
    broker: "agent",

    processor: "processor",
    processing: "processor",
    factory: "processor",

    other: "other",
  };

  if (!normalized) return "";
  return map[normalized] || "other";
}

function normalizePaymentMode(value) {
  const normalized = normalizeLooseEnum(value);

  const map = {
    cash: "cash",
    cash_payment: "cash",

    credit: "credit",
    loan: "credit",

    bank_transfer: "bank_transfer",
    bank: "bank_transfer",
    transfer: "bank_transfer",
    banktransfer: "bank_transfer",

    mobile_money: "mobile_money",
    mobile: "mobile_money",
    mobilemoney: "mobile_money",
    momo: "mobile_money",
    mpesa: "mobile_money",
    m_pesa: "mobile_money",

    cheque: "cheque",
    check: "cheque",
    cheque_payment: "cheque",

    mixed: "mixed",
    split: "mixed",

    other: "other",
  };

  if (!normalized) return "";
  return map[normalized] || "other";
}

function formatEnumForDisplay(value) {
  const text = cleanText(value);
  if (!text) return "—";
  return text.replace(/_/g, " ");
}

function generateCustomerCode() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = `${now.getMonth() + 1}`.padStart(2, "0");
  const dd = `${now.getDate()}`.padStart(2, "0");
  const random = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `CUST-${yyyy}${mm}${dd}-${random}`;
}

function createEmptyForm() {
  return {
    customer_code: generateCustomerCode(),
    customer_name: "",
    transaction_name: "",
    contact_person: "",
    phone_number: "",
    alternative_phone_number: "",
    email: "",
    address: "",
    business_location: "",
    district: "",
    region: "",
    tin_number: "",
    registration_number: "",
    customer_type: "",
    default_payment_mode: "",
    credit_allowed: false,
    credit_limit: "",
    notes: "",
    is_active: true,
  };
}

function getFriendlyErrorMessage(err) {
  const detail = err?.data?.detail;

  if (Array.isArray(detail) && detail.length > 0) {
    const lines = detail
      .map((item) => {
        const rawField = Array.isArray(item?.loc)
          ? item.loc[item.loc.length - 1]
          : "";
        const field = FIELD_LABELS[rawField] || formatEnumForDisplay(rawField);
        const msg = cleanText(item?.msg);

        if (!msg) return "";

        if (/field required/i.test(msg)) {
          return `${field} is required.`;
        }

        if (/input should be/i.test(msg)) {
          return `${field} has an invalid value. Please choose one of the suggested options.`;
        }

        return field ? `${field}: ${msg}.` : `${msg}.`;
      })
      .filter(Boolean);

    if (lines.length > 0) {
      return lines.join(" ");
    }
  }

  const message =
    cleanText(err?.message) ||
    cleanText(err?.data?.message) ||
    cleanText(err?.data?.error) ||
    cleanText(detail);

  if (!message) return "Something went wrong. Please try again.";

  if (/credit_limit.*credit_allowed/i.test(message)) {
    return "Turn on Credit allowed before entering a credit limit.";
  }

  if (/customer.*code.*exists|template.*code.*exists|already exists/i.test(message)) {
    return "The generated customer code already exists. The system has created a new code for you. Please save again.";
  }

  if (/customer name.*required/i.test(message)) {
    return "Customer name is required.";
  }

  if (/email/i.test(message) && /valid|value error/i.test(message)) {
    return "Please enter a valid email address.";
  }

  if (/network|failed to fetch|load failed/i.test(message)) {
    return "Could not reach the server. Check your internet connection and try again.";
  }

  return message;
}

function isDuplicateCodeError(err) {
  const message =
    cleanText(err?.message) ||
    cleanText(err?.data?.message) ||
    cleanText(err?.data?.error) ||
    cleanText(err?.data?.detail);

  return /customer.*code.*exists|already exists/i.test(message);
}

function buildPayload(form) {
  const normalizedCustomerType = normalizeCustomerType(form.customer_type);
  const normalizedPaymentMode = normalizePaymentMode(form.default_payment_mode);

  return {
    customer_code: cleanText(form.customer_code),
    customer_name: cleanText(form.customer_name),
    transaction_name: toNullableText(form.transaction_name),
    contact_person: toNullableText(form.contact_person),
    phone_number: toNullableText(form.phone_number),
    alternative_phone_number: toNullableText(form.alternative_phone_number),
    email: toNullableText(form.email),
    address: toNullableText(form.address),
    business_location: toNullableText(form.business_location),
    district: toNullableText(form.district),
    region: toNullableText(form.region),
    tin_number: toNullableText(form.tin_number),
    registration_number: toNullableText(form.registration_number),
    customer_type: normalizedCustomerType || undefined,
    default_payment_mode: normalizedPaymentMode || null,
    credit_allowed: !!form.credit_allowed,
    credit_limit: form.credit_allowed ? toNumberOrNull(form.credit_limit) : null,
    notes: toNullableText(form.notes),
    is_active: !!form.is_active,
  };
}

function FieldLabel({ children, required = false }) {
  return (
    <label className="fieldLabel">
      <span>{children}</span>
      {required ? <span className="requiredMark">*</span> : null}
    </label>
  );
}

function HelperText({ children, color = MUTED }) {
  if (!children) return null;
  return <div className="helperText" style={{ color }}>{children}</div>;
}

function StatusPill({ active, deleted }) {
  const label = deleted ? "Deleted" : active ? "Active" : "Inactive";
  const background = deleted ? RED_SOFT : active ? GREEN_SOFT : ORANGE_SOFT;
  const color = deleted ? RED : active ? GREEN : ORANGE_DEEP;

  return (
    <span className="statusPill" style={{ background, color }}>
      {label}
    </span>
  );
}

function MetricCard({ title, value, color = TEXT }) {
  return (
    <div className="metricCard">
      <div className="metricLabel">{title}</div>
      <div className="metricValue" style={{ color }}>
        {value}
      </div>
    </div>
  );
}

export default function ByproductsCustomersPage() {
  const customersApi = ByproductsService.customers || ByproductsService;

  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);

  const [loading, setLoading] = useState(true);
  const [tableLoading, setTableLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [filters, setFilters] = useState({
    search: "",
    region: "",
    is_active: "",
    include_deleted: false,
  });

  const [form, setForm] = useState(createEmptyForm());

  const loadData = useCallback(async () => {
    setTableLoading(true);
    setError("");

    try {
      const response = await customersApi.list({
        search: cleanText(filters.search) || undefined,
        region: cleanText(filters.region) || undefined,
        is_active:
          filters.is_active === ""
            ? undefined
            : filters.is_active === "true",
        include_deleted: filters.include_deleted,
        skip: 0,
        limit: 300,
      });

      setRows(coerceItems(response));
      setTotal(coerceTotal(response));
    } catch (err) {
      setError(getFriendlyErrorMessage(err));
    } finally {
      setLoading(false);
      setTableLoading(false);
    }
  }, [customersApi, filters]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const summary = useMemo(() => {
    const activeCount = rows.filter(
      (item) => item?.is_active && !item?.is_deleted
    ).length;
    const deletedCount = rows.filter((item) => item?.is_deleted).length;
    const creditCount = rows.filter(
      (item) => item?.credit_allowed && !item?.is_deleted
    ).length;

    return { activeCount, deletedCount, creditCount };
  }, [rows]);

  function resetForm() {
    setForm(createEmptyForm());
    setEditingId(null);
    setError("");
    setSuccess("");
  }

  function regenerateCode() {
    setForm((prev) => ({
      ...prev,
      customer_code: generateCustomerCode(),
    }));
  }

  function startEdit(row) {
    setEditingId(row?.id || null);
    setForm({
      customer_code: row?.customer_code || generateCustomerCode(),
      customer_name: row?.customer_name || "",
      transaction_name: row?.transaction_name || "",
      contact_person: row?.contact_person || "",
      phone_number: row?.phone_number || "",
      alternative_phone_number: row?.alternative_phone_number || "",
      email: row?.email || "",
      address: row?.address || "",
      business_location: row?.business_location || "",
      district: row?.district || "",
      region: row?.region || "",
      tin_number: row?.tin_number || "",
      registration_number: row?.registration_number || "",
      customer_type: row?.customer_type || "",
      default_payment_mode: row?.default_payment_mode || "",
      credit_allowed: !!row?.credit_allowed,
      credit_limit:
        row?.credit_limit !== null && row?.credit_limit !== undefined
          ? String(row.credit_limit)
          : "",
      notes: row?.notes || "",
      is_active: row?.is_active !== false,
    });

    setSuccess("");
    setError("");

    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const payload = buildPayload(form);

      if (!payload.customer_name) {
        throw new Error("Customer name is required.");
      }

      if (!payload.customer_code) {
        payload.customer_code = generateCustomerCode();
        setForm((prev) => ({ ...prev, customer_code: payload.customer_code }));
      }

      if (editingId) {
        await customersApi.update(editingId, payload);
        setSuccess("Customer updated successfully.");
      } else {
        try {
          await customersApi.create(payload);
        } catch (firstError) {
          if (isDuplicateCodeError(firstError)) {
            const regeneratedCode = generateCustomerCode();
            const retryPayload = { ...payload, customer_code: regeneratedCode };
            setForm((prev) => ({ ...prev, customer_code: regeneratedCode }));
            await customersApi.create(retryPayload);
          } else {
            throw firstError;
          }
        }

        setSuccess("Customer created successfully.");
      }

      resetForm();
      await loadData();
    } catch (err) {
      setError(getFriendlyErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    const ok =
      typeof window !== "undefined"
        ? window.confirm("Delete this customer?")
        : false;

    if (!ok) return;

    setError("");
    setSuccess("");

    try {
      await customersApi.delete(id);
      setSuccess("Customer deleted successfully.");
      await loadData();
    } catch (err) {
      setError(getFriendlyErrorMessage(err));
    }
  }

  async function handleRestore(id) {
    setError("");
    setSuccess("");

    try {
      await customersApi.restore(id);
      setSuccess("Customer restored successfully.");
      await loadData();
    } catch (err) {
      setError(getFriendlyErrorMessage(err));
    }
  }

  return (
    <>
      <Head>
        <title>Byproducts Customers</title>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover"
        />
      </Head>

      <div className="pageWrap">
        <div className="pageShell">
          <section className="heroCard">
            <div className="heroTop">
              <div className="heroCopy">
                <div className="eyebrow">Byproducts</div>
                <h1 className="pageTitle">Customers</h1>
                <p className="pageText">
                  Register and manage byproducts customers, contacts, locations,
                  payment settings, and credit details. Customer codes are
                  generated automatically.
                </p>
              </div>

              <div className="metricsGrid">
                <MetricCard title="Total" value={loading ? "..." : total} />
                <MetricCard
                  title="Active"
                  value={loading ? "..." : summary.activeCount}
                  color={GREEN}
                />
                <MetricCard
                  title="Credit"
                  value={loading ? "..." : summary.creditCount}
                  color={BLUE}
                />
                <MetricCard
                  title="Deleted"
                  value={loading ? "..." : summary.deletedCount}
                  color={RED}
                />
              </div>
            </div>

            {error ? <div className="banner bannerError">{error}</div> : null}
            {success ? <div className="banner bannerSuccess">{success}</div> : null}
          </section>

          <div className="contentGrid">
            <section className="panelCard">
              <div className="sectionHead">
                <h2 className="sectionTitle">
                  {editingId ? "Edit Customer" : "New Customer"}
                </h2>
                <p className="sectionText">
                  Required fields are marked with an asterisk.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="formGrid">
                <div className="twoColGrid">
                  <div className="fieldBlock">
                    <FieldLabel>Customer Code</FieldLabel>
                    <div className="codeRow">
                      <input
                        value={form.customer_code}
                        readOnly
                        className="fieldInput readonlyInput"
                      />
                      {!editingId ? (
                        <button
                          type="button"
                          onClick={regenerateCode}
                          className="smallButton"
                        >
                          New Code
                        </button>
                      ) : null}
                    </div>
                    <HelperText>
                      This code is generated automatically for you.
                    </HelperText>
                  </div>

                  <div className="fieldBlock">
                    <FieldLabel required>Customer Name</FieldLabel>
                    <input
                      value={form.customer_name}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          customer_name: e.target.value,
                        }))
                      }
                      placeholder="Customer name"
                      className="fieldInput"
                    />
                  </div>

                  <div className="fieldBlock">
                    <FieldLabel>Transaction Name</FieldLabel>
                    <input
                      value={form.transaction_name}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          transaction_name: e.target.value,
                        }))
                      }
                      placeholder="Transaction name"
                      className="fieldInput"
                    />
                  </div>

                  <div className="fieldBlock">
                    <FieldLabel>Contact Person</FieldLabel>
                    <input
                      value={form.contact_person}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          contact_person: e.target.value,
                        }))
                      }
                      placeholder="Contact person"
                      className="fieldInput"
                    />
                  </div>

                  <div className="fieldBlock">
                    <FieldLabel>Phone Number</FieldLabel>
                    <input
                      value={form.phone_number}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          phone_number: e.target.value,
                        }))
                      }
                      placeholder="Phone number"
                      className="fieldInput"
                    />
                  </div>

                  <div className="fieldBlock">
                    <FieldLabel>Alternative Phone</FieldLabel>
                    <input
                      value={form.alternative_phone_number}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          alternative_phone_number: e.target.value,
                        }))
                      }
                      placeholder="Alternative phone"
                      className="fieldInput"
                    />
                  </div>

                  <div className="fieldBlock">
                    <FieldLabel>Email</FieldLabel>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          email: e.target.value,
                        }))
                      }
                      placeholder="Email address"
                      className="fieldInput"
                    />
                  </div>

                  <div className="fieldBlock">
                    <FieldLabel>Customer Type</FieldLabel>
                    <input
                      list="customer-type-options"
                      value={form.customer_type}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          customer_type: e.target.value,
                        }))
                      }
                      placeholder="Retail, WHOLESALE, distributor..."
                      className="fieldInput"
                    />
                    <datalist id="customer-type-options">
                      {CUSTOMER_TYPE_OPTIONS.map((item) => (
                        <option key={item} value={item} />
                      ))}
                    </datalist>
                    <HelperText>
                      Saved as:{" "}
                      {normalizeCustomerType(form.customer_type)
                        ? formatEnumForDisplay(normalizeCustomerType(form.customer_type))
                        : "retail"}
                    </HelperText>
                  </div>

                  <div className="fieldBlock">
                    <FieldLabel>Business Location</FieldLabel>
                    <input
                      value={form.business_location}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          business_location: e.target.value,
                        }))
                      }
                      placeholder="Business location"
                      className="fieldInput"
                    />
                  </div>

                  <div className="fieldBlock">
                    <FieldLabel>District</FieldLabel>
                    <input
                      value={form.district}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          district: e.target.value,
                        }))
                      }
                      placeholder="District"
                      className="fieldInput"
                    />
                  </div>

                  <div className="fieldBlock">
                    <FieldLabel>Region</FieldLabel>
                    <input
                      value={form.region}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          region: e.target.value,
                        }))
                      }
                      placeholder="Region"
                      className="fieldInput"
                    />
                  </div>

                  <div className="fieldBlock">
                    <FieldLabel>Default Payment Mode</FieldLabel>
                    <input
                      list="payment-mode-options"
                      value={form.default_payment_mode}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          default_payment_mode: e.target.value,
                        }))
                      }
                      placeholder="Cash, MOBILE MONEY, bank transfer..."
                      className="fieldInput"
                    />
                    <datalist id="payment-mode-options">
                      {PAYMENT_MODE_OPTIONS.map((item) => (
                        <option key={item} value={item} />
                      ))}
                    </datalist>
                    <HelperText>
                      Saved as:{" "}
                      {normalizePaymentMode(form.default_payment_mode)
                        ? formatEnumForDisplay(
                            normalizePaymentMode(form.default_payment_mode)
                          )
                        : "—"}
                    </HelperText>
                  </div>

                  <div className="fieldBlock">
                    <FieldLabel>TIN Number</FieldLabel>
                    <input
                      value={form.tin_number}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          tin_number: e.target.value,
                        }))
                      }
                      placeholder="TIN number"
                      className="fieldInput"
                    />
                  </div>

                  <div className="fieldBlock">
                    <FieldLabel>Registration Number</FieldLabel>
                    <input
                      value={form.registration_number}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          registration_number: e.target.value,
                        }))
                      }
                      placeholder="Registration number"
                      className="fieldInput"
                    />
                  </div>

                  <div className="fieldBlock">
                    <FieldLabel>Credit Limit</FieldLabel>
                    <input
                      type="number"
                      step="0.01"
                      value={form.credit_limit}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          credit_limit: e.target.value,
                        }))
                      }
                      placeholder="Credit limit"
                      className="fieldInput"
                      disabled={!form.credit_allowed}
                    />
                    <HelperText>
                      {form.credit_allowed
                        ? "Enter the allowed credit amount."
                        : "Turn on Credit allowed to enter a limit."}
                    </HelperText>
                  </div>
                </div>

                <div className="fieldBlock">
                  <FieldLabel>Address</FieldLabel>
                  <textarea
                    value={form.address}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        address: e.target.value,
                      }))
                    }
                    rows={3}
                    placeholder="Address"
                    className="fieldTextarea"
                  />
                </div>

                <div className="fieldBlock">
                  <FieldLabel>Notes</FieldLabel>
                  <textarea
                    value={form.notes}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        notes: e.target.value,
                      }))
                    }
                    rows={3}
                    placeholder="Notes"
                    className="fieldTextarea"
                  />
                </div>

                <div className="twoColGrid">
                  <label className="checkTile">
                    <input
                      type="checkbox"
                      checked={!!form.credit_allowed}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          credit_allowed: e.target.checked,
                          credit_limit: e.target.checked ? prev.credit_limit : "",
                        }))
                      }
                    />
                    <span>Credit allowed</span>
                  </label>

                  <label className="checkTile">
                    <input
                      type="checkbox"
                      checked={!!form.is_active}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          is_active: e.target.checked,
                        }))
                      }
                    />
                    <span>Active customer</span>
                  </label>
                </div>

                <div className="buttonRow">
                  <button
                    type="submit"
                    disabled={saving}
                    className="primaryButton"
                  >
                    {saving
                      ? "Saving..."
                      : editingId
                      ? "Update Customer"
                      : "Create Customer"}
                  </button>

                  <button
                    type="button"
                    onClick={resetForm}
                    className="secondaryButton"
                  >
                    Clear
                  </button>
                </div>
              </form>
            </section>

            <section className="panelCard">
              <div className="listTopBar">
                <div>
                  <h2 className="sectionTitle">Customer List</h2>
                  <p className="sectionText">
                    Search, edit, delete, and restore customers.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={loadData}
                  disabled={tableLoading}
                  className="secondaryButton"
                >
                  {tableLoading ? "Refreshing..." : "Refresh"}
                </button>
              </div>

              <div className="filterGrid">
                <input
                  value={filters.search}
                  onChange={(e) =>
                    setFilters((prev) => ({ ...prev, search: e.target.value }))
                  }
                  placeholder="Search code, name, phone..."
                  className="fieldInput"
                />

                <input
                  value={filters.region}
                  onChange={(e) =>
                    setFilters((prev) => ({ ...prev, region: e.target.value }))
                  }
                  placeholder="Filter by region"
                  className="fieldInput"
                />

                <select
                  value={filters.is_active}
                  onChange={(e) =>
                    setFilters((prev) => ({ ...prev, is_active: e.target.value }))
                  }
                  className="fieldInput"
                >
                  <option value="">All statuses</option>
                  <option value="true">Active only</option>
                  <option value="false">Inactive only</option>
                </select>

                <label className="checkTile">
                  <input
                    type="checkbox"
                    checked={filters.include_deleted}
                    onChange={(e) =>
                      setFilters((prev) => ({
                        ...prev,
                        include_deleted: e.target.checked,
                      }))
                    }
                  />
                  <span>Include deleted</span>
                </label>
              </div>

              <div className="desktopTable">
                <div className="tableWrap">
                  <table className="dataTable">
                    <thead>
                      <tr>
                        {[
                          "Code",
                          "Customer Name",
                          "Phone",
                          "Type",
                          "Location",
                          "Region",
                          "Payment Mode",
                          "Credit",
                          "Status",
                          "Action",
                        ].map((head) => (
                          <th key={head}>{head}</th>
                        ))}
                      </tr>
                    </thead>

                    <tbody>
                      {rows.length === 0 ? (
                        <tr>
                          <td colSpan={10} className="emptyCell">
                            {tableLoading ? "Loading customers..." : "No customers found."}
                          </td>
                        </tr>
                      ) : (
                        rows.map((row) => (
                          <tr key={row?.id}>
                            <td className="strongCell">{row?.customer_code || "—"}</td>
                            <td>{row?.customer_name || "—"}</td>
                            <td>{row?.phone_number || "—"}</td>
                            <td>{formatEnumForDisplay(row?.customer_type)}</td>
                            <td>{row?.business_location || "—"}</td>
                            <td>{row?.region || "—"}</td>
                            <td>{formatEnumForDisplay(row?.default_payment_mode)}</td>
                            <td>{row?.credit_allowed ? "Allowed" : "No"}</td>
                            <td>
                              <StatusPill
                                active={row?.is_active}
                                deleted={row?.is_deleted}
                              />
                            </td>
                            <td>
                              <div className="actionRow">
                                <button
                                  type="button"
                                  onClick={() => startEdit(row)}
                                  className="smallButton blueText"
                                >
                                  Edit
                                </button>

                                {!row?.is_deleted ? (
                                  <button
                                    type="button"
                                    onClick={() => handleDelete(row?.id)}
                                    className="smallButton redText"
                                  >
                                    Delete
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleRestore(row?.id)}
                                    className="smallButton greenText"
                                  >
                                    Restore
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="mobileCards">
                {rows.length === 0 ? (
                  <div className="emptyState">
                    {tableLoading ? "Loading customers..." : "No customers found."}
                  </div>
                ) : (
                  rows.map((row) => (
                    <article key={row?.id} className="mobileCard">
                      <div className="mobileCardTop">
                        <div className="mobileCardTitleWrap">
                          <div className="mobileCardTitle">
                            {row?.customer_name || "—"}
                          </div>
                          <div className="mobileCardCode">
                            {row?.customer_code || "—"}
                          </div>
                        </div>

                        <StatusPill
                          active={row?.is_active}
                          deleted={row?.is_deleted}
                        />
                      </div>

                      <div className="mobileMeta">
                        <div>
                          <span className="mobileLabel">Phone:</span>{" "}
                          {row?.phone_number || "—"}
                        </div>
                        <div>
                          <span className="mobileLabel">Type:</span>{" "}
                          {formatEnumForDisplay(row?.customer_type)}
                        </div>
                        <div>
                          <span className="mobileLabel">Location:</span>{" "}
                          {row?.business_location || "—"}
                        </div>
                        <div>
                          <span className="mobileLabel">Region:</span>{" "}
                          {row?.region || "—"}
                        </div>
                        <div>
                          <span className="mobileLabel">Payment:</span>{" "}
                          {formatEnumForDisplay(row?.default_payment_mode)}
                        </div>
                        <div>
                          <span className="mobileLabel">Credit:</span>{" "}
                          {row?.credit_allowed ? "Allowed" : "Not allowed"}
                        </div>
                      </div>

                      <div className="mobileActionGrid">
                        <button
                          type="button"
                          onClick={() => startEdit(row)}
                          className="secondaryButton"
                        >
                          Edit
                        </button>

                        {!row?.is_deleted ? (
                          <button
                            type="button"
                            onClick={() => handleDelete(row?.id)}
                            className="secondaryButton redText"
                          >
                            Delete
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleRestore(row?.id)}
                            className="secondaryButton greenText"
                          >
                            Restore
                          </button>
                        )}
                      </div>
                    </article>
                  ))
                )}
              </div>
            </section>
          </div>
        </div>
      </div>

      <style jsx>{`
        .pageWrap {
          min-height: 100vh;
          background: ${PAGE_BG};
          padding: 20px 16px 40px;
          font-family: Arial, sans-serif;
        }

        .pageShell {
          max-width: 1380px;
          margin: 0 auto;
          display: grid;
          gap: 18px;
        }

        .heroCard,
        .panelCard {
          background: ${SURFACE};
          border: 1px solid ${BORDER};
          border-radius: 24px;
          box-shadow: ${SHADOW};
        }

        .heroCard {
          padding: 20px;
        }

        .panelCard {
          padding: 18px;
        }

        .heroTop {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          flex-wrap: wrap;
        }

        .heroCopy {
          min-width: 0;
          flex: 1;
        }

        .eyebrow {
          display: inline-flex;
          padding: 6px 12px;
          border-radius: 999px;
          background: ${ORANGE_SOFT};
          color: ${ORANGE_DEEP};
          font-size: 12px;
          font-weight: 800;
          margin-bottom: 10px;
        }

        .pageTitle {
          margin: 0;
          color: ${TEXT};
          font-size: 28px;
          font-weight: 800;
          line-height: 1.15;
        }

        .pageText {
          margin: 8px 0 0;
          color: ${MUTED};
          font-size: 14px;
          line-height: 1.7;
          max-width: 780px;
        }

        .metricsGrid {
          display: grid;
          grid-template-columns: repeat(4, minmax(120px, 1fr));
          gap: 12px;
          min-width: 320px;
          flex: 1;
          max-width: 560px;
        }

        .metricCard {
          background: ${SURFACE};
          border: 1px solid ${BORDER};
          border-radius: 18px;
          padding: 14px;
        }

        .metricLabel {
          color: ${MUTED};
          font-size: 12px;
          font-weight: 700;
        }

        .metricValue {
          font-size: 24px;
          font-weight: 800;
          margin-top: 6px;
        }

        .banner {
          margin-top: 16px;
          padding: 12px 14px;
          border-radius: 14px;
          font-size: 13px;
          font-weight: 700;
        }

        .bannerError {
          background: ${RED_SOFT};
          color: ${RED};
        }

        .bannerSuccess {
          background: ${GREEN_SOFT};
          color: ${GREEN};
        }

        .contentGrid {
          display: grid;
          grid-template-columns: minmax(360px, 520px) minmax(0, 1fr);
          gap: 18px;
          align-items: start;
        }

        .sectionHead {
          margin-bottom: 14px;
        }

        .sectionTitle {
          margin: 0;
          color: ${TEXT};
          font-size: 18px;
          font-weight: 800;
        }

        .sectionText {
          margin: 6px 0 0;
          color: ${MUTED};
          font-size: 13px;
          line-height: 1.6;
        }

        .formGrid {
          display: grid;
          gap: 14px;
        }

        .twoColGrid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }

        .fieldBlock {
          min-width: 0;
        }

        .fieldLabel {
          display: flex;
          align-items: center;
          gap: 6px;
          color: ${TEXT};
          font-size: 13px;
          font-weight: 700;
          margin-bottom: 6px;
        }

        .requiredMark {
          color: ${RED};
          font-weight: 900;
        }

        .fieldInput,
        .fieldTextarea {
          width: 100%;
          min-height: 44px;
          border-radius: 12px;
          border: 1px solid ${BORDER};
          padding: 0 14px;
          font-size: 14px;
          color: ${TEXT};
          background: #fff;
          outline: none;
          box-sizing: border-box;
          font-family: Arial, sans-serif;
        }

        .fieldTextarea {
          min-height: 88px;
          padding-top: 12px;
          resize: vertical;
        }

        .readonlyInput {
          background: #f8fafc;
        }

        .helperText {
          margin-top: 6px;
          font-size: 12px;
          line-height: 1.5;
        }

        .codeRow {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 8px;
          align-items: center;
        }

        .checkTile {
          min-height: 44px;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 0 12px;
          border-radius: 12px;
          border: 1px solid ${BORDER};
          background: #fff;
          color: ${TEXT};
          font-size: 13px;
          font-weight: 700;
        }

        .buttonRow,
        .actionRow {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }

        .primaryButton,
        .secondaryButton,
        .smallButton {
          border-radius: 12px;
          cursor: pointer;
          font-family: Arial, sans-serif;
          font-weight: 800;
        }

        .primaryButton {
          min-height: 44px;
          padding: 0 16px;
          border: none;
          background: ${ORANGE};
          color: #fff;
          font-size: 14px;
        }

        .secondaryButton {
          min-height: 44px;
          padding: 0 16px;
          border: 1px solid ${BORDER};
          background: #fff;
          color: ${TEXT};
          font-size: 14px;
        }

        .smallButton {
          min-height: 36px;
          padding: 0 12px;
          border: 1px solid ${BORDER};
          background: #fff;
          color: ${BLUE};
          font-size: 12px;
        }

        .primaryButton:disabled,
        .secondaryButton:disabled,
        .smallButton:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .blueText {
          color: ${BLUE};
        }

        .redText {
          color: ${RED};
        }

        .greenText {
          color: ${GREEN};
        }

        .listTopBar {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
          margin-bottom: 14px;
        }

        .filterGrid {
          display: grid;
          grid-template-columns: minmax(180px, 1fr) 180px 160px auto;
          gap: 12px;
          margin-bottom: 16px;
        }

        .statusPill {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 6px 10px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 800;
          white-space: nowrap;
        }

        .tableWrap {
          overflow-x: auto;
          border: 1px solid ${BORDER};
          border-radius: 16px;
        }

        .dataTable {
          width: 100%;
          min-width: 1180px;
          border-collapse: collapse;
          background: #fff;
        }

        .dataTable thead tr {
          background: #f8fafc;
        }

        .dataTable th {
          text-align: left;
          padding: 13px 14px;
          border-bottom: 1px solid ${BORDER};
          color: ${TEXT};
          font-size: 13px;
          font-weight: 800;
          white-space: nowrap;
        }

        .dataTable td {
          padding: 13px 14px;
          border-bottom: 1px solid ${BORDER};
          color: ${TEXT};
          font-size: 13px;
          vertical-align: top;
        }

        .strongCell {
          font-weight: 800;
        }

        .emptyCell {
          padding: 28px 14px;
          text-align: center;
          color: ${MUTED};
          font-size: 14px;
        }

        .mobileCards {
          display: none;
        }

        .mobileCard {
          border: 1px solid ${BORDER};
          border-radius: 16px;
          padding: 14px;
          background: #fff;
        }

        .mobileCardTop {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: flex-start;
          margin-bottom: 10px;
        }

        .mobileCardTitleWrap {
          min-width: 0;
        }

        .mobileCardTitle {
          color: ${TEXT};
          font-size: 15px;
          font-weight: 800;
          line-height: 1.35;
          word-break: break-word;
        }

        .mobileCardCode {
          color: ${MUTED};
          font-size: 12px;
          margin-top: 4px;
          word-break: break-word;
        }

        .mobileMeta {
          display: grid;
          gap: 6px;
          color: ${TEXT};
          font-size: 13px;
        }

        .mobileLabel {
          color: ${MUTED};
          font-weight: 700;
        }

        .mobileActionGrid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
          margin-top: 14px;
        }

        .emptyState {
          padding: 24px 14px;
          text-align: center;
          color: ${MUTED};
          font-size: 14px;
          border: 1px solid ${BORDER};
          border-radius: 16px;
          background: #fff;
        }

        @media (max-width: 980px) {
          .pageWrap {
            padding: 14px 12px 28px;
          }

          .heroCard,
          .panelCard {
            padding: 16px;
            border-radius: 22px;
          }

          .pageTitle {
            font-size: 24px;
          }

          .metricsGrid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            min-width: 100%;
            max-width: none;
          }

          .contentGrid {
            grid-template-columns: 1fr;
            gap: 18px;
          }

          .twoColGrid,
          .filterGrid {
            grid-template-columns: 1fr;
          }

          .desktopTable {
            display: none;
          }

          .mobileCards {
            display: grid;
            gap: 12px;
          }

          .buttonRow {
            flex-direction: column;
          }

          .primaryButton,
          .secondaryButton {
            width: 100%;
          }
        }

        @media (max-width: 560px) {
          .metricsGrid {
            grid-template-columns: 1fr;
          }

          .codeRow {
            grid-template-columns: 1fr;
          }

          .mobileActionGrid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </>
  );
}