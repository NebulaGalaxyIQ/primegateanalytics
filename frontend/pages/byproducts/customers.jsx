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
const GREEN = "#16a34a";
const GREEN_SOFT = "rgba(22,163,74,0.10)";
const RED = "#dc2626";
const RED_SOFT = "rgba(220,38,38,0.10)";
const SHADOW = "0 10px 30px rgba(15, 23, 42, 0.06)";

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

function toNumberOrNull(value) {
  if (value === "" || value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function emptyForm() {
  return {
    customer_code: "",
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

function StatusPill({ active, deleted }) {
  const label = deleted ? "Deleted" : active ? "Active" : "Inactive";
  const background = deleted ? RED_SOFT : active ? GREEN_SOFT : ORANGE_SOFT;
  const color = deleted ? RED : active ? GREEN : ORANGE_DEEP;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "6px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 800,
        background,
        color,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

export default function ByproductsCustomersPage() {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [tableLoading, setTableLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [screenWidth, setScreenWidth] = useState(1280);

  const [filters, setFilters] = useState({
    search: "",
    region: "",
    is_active: "",
    include_deleted: false,
  });

  const [form, setForm] = useState(emptyForm());

  useEffect(() => {
    function handleResize() {
      if (typeof window !== "undefined") {
        setScreenWidth(window.innerWidth || 1280);
      }
    }

    handleResize();

    if (typeof window !== "undefined") {
      window.addEventListener("resize", handleResize);
      return () => window.removeEventListener("resize", handleResize);
    }

    return undefined;
  }, []);

  const isMobile = screenWidth < 980;

  const loadData = useCallback(async () => {
    setTableLoading(true);
    setError("");

    try {
      const response = await ByproductsService.listCustomers({
        search: filters.search || undefined,
        region: filters.region || undefined,
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
      setError(err?.message || "Failed to load customers.");
    } finally {
      setLoading(false);
      setTableLoading(false);
    }
  }, [filters]);

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
    setForm(emptyForm());
    setEditingId(null);
    setSuccess("");
  }

  function startEdit(row) {
    setEditingId(row?.id || null);
    setForm({
      customer_code: row?.customer_code || "",
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
      const payload = {
        customer_code: String(form.customer_code || "").trim(),
        customer_name: String(form.customer_name || "").trim(),
        transaction_name: String(form.transaction_name || "").trim() || null,
        contact_person: String(form.contact_person || "").trim() || null,
        phone_number: String(form.phone_number || "").trim() || null,
        alternative_phone_number:
          String(form.alternative_phone_number || "").trim() || null,
        email: String(form.email || "").trim() || null,
        address: String(form.address || "").trim() || null,
        business_location: String(form.business_location || "").trim() || null,
        district: String(form.district || "").trim() || null,
        region: String(form.region || "").trim() || null,
        tin_number: String(form.tin_number || "").trim() || null,
        registration_number:
          String(form.registration_number || "").trim() || null,
        customer_type: String(form.customer_type || "").trim() || null,
        default_payment_mode:
          String(form.default_payment_mode || "").trim() || null,
        credit_allowed: !!form.credit_allowed,
        credit_limit: form.credit_allowed
          ? toNumberOrNull(form.credit_limit)
          : null,
        notes: String(form.notes || "").trim() || null,
        is_active: !!form.is_active,
      };

      if (!payload.customer_code) {
        throw new Error("Customer code is required");
      }

      if (!payload.customer_name) {
        throw new Error("Customer name is required");
      }

      if (editingId) {
        await ByproductsService.updateCustomer(editingId, payload);
        setSuccess("Customer updated successfully.");
      } else {
        await ByproductsService.createCustomer(payload);
        setSuccess("Customer created successfully.");
      }

      resetForm();
      await loadData();
    } catch (err) {
      setError(err?.message || "Failed to save customer.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    const ok = window.confirm("Delete this customer?");
    if (!ok) return;

    setError("");
    setSuccess("");

    try {
      await ByproductsService.deleteCustomer(id);
      setSuccess("Customer deleted successfully.");
      await loadData();
    } catch (err) {
      setError(err?.message || "Failed to delete customer.");
    }
  }

  async function handleRestore(id) {
    setError("");
    setSuccess("");

    try {
      await ByproductsService.restoreCustomer(id);
      setSuccess("Customer restored successfully.");
      await loadData();
    } catch (err) {
      setError(err?.message || "Failed to restore customer.");
    }
  }

  return (
    <>
      <Head>
        <title>Byproducts Customers</title>
      </Head>

      <div
        style={{
          minHeight: "100vh",
          background: PAGE_BG,
          padding: isMobile ? "14px 12px 28px" : "20px 16px 40px",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div
          style={{
            maxWidth: 1380,
            margin: "0 auto",
            display: "grid",
            gap: 18,
          }}
        >
          <div
            style={{
              background: SURFACE,
              border: `1px solid ${BORDER}`,
              borderRadius: 24,
              padding: isMobile ? 16 : 20,
              boxShadow: SHADOW,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 16,
                flexWrap: "wrap",
              }}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <div
                  style={{
                    display: "inline-flex",
                    padding: "6px 12px",
                    borderRadius: 999,
                    background: ORANGE_SOFT,
                    color: ORANGE_DEEP,
                    fontSize: 12,
                    fontWeight: 800,
                    marginBottom: 10,
                  }}
                >
                  Byproducts
                </div>

                <h1
                  style={{
                    margin: 0,
                    color: TEXT,
                    fontSize: isMobile ? 24 : 28,
                    fontWeight: 800,
                    lineHeight: 1.15,
                  }}
                >
                  Customers
                </h1>

                <p
                  style={{
                    margin: "8px 0 0",
                    color: MUTED,
                    fontSize: 14,
                    lineHeight: 1.7,
                    maxWidth: 780,
                  }}
                >
                  Register and manage byproducts customers, contacts, locations,
                  payment settings, and credit details.
                </p>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: isMobile
                    ? "repeat(2, minmax(0, 1fr))"
                    : "repeat(3, minmax(120px, 1fr))",
                  gap: 12,
                  width: isMobile ? "100%" : "auto",
                  minWidth: isMobile ? 0 : 360,
                  maxWidth: isMobile ? "100%" : 480,
                }}
              >
                <div
                  style={{
                    background: SURFACE,
                    border: `1px solid ${BORDER}`,
                    borderRadius: 18,
                    padding: 14,
                  }}
                >
                  <div style={{ color: MUTED, fontSize: 12, fontWeight: 700 }}>
                    Total
                  </div>
                  <div
                    style={{
                      color: TEXT,
                      fontSize: 24,
                      fontWeight: 800,
                      marginTop: 6,
                    }}
                  >
                    {loading ? "..." : total}
                  </div>
                </div>

                <div
                  style={{
                    background: SURFACE,
                    border: `1px solid ${BORDER}`,
                    borderRadius: 18,
                    padding: 14,
                  }}
                >
                  <div style={{ color: MUTED, fontSize: 12, fontWeight: 700 }}>
                    Active
                  </div>
                  <div
                    style={{
                      color: GREEN,
                      fontSize: 24,
                      fontWeight: 800,
                      marginTop: 6,
                    }}
                  >
                    {loading ? "..." : summary.activeCount}
                  </div>
                </div>

                <div
                  style={{
                    background: SURFACE,
                    border: `1px solid ${BORDER}`,
                    borderRadius: 18,
                    padding: 14,
                  }}
                >
                  <div style={{ color: MUTED, fontSize: 12, fontWeight: 700 }}>
                    Credit
                  </div>
                  <div
                    style={{
                      color: BLUE,
                      fontSize: 24,
                      fontWeight: 800,
                      marginTop: 6,
                    }}
                  >
                    {loading ? "..." : summary.creditCount}
                  </div>
                </div>

                {isMobile ? (
                  <div
                    style={{
                      background: SURFACE,
                      border: `1px solid ${BORDER}`,
                      borderRadius: 18,
                      padding: 14,
                    }}
                  >
                    <div
                      style={{ color: MUTED, fontSize: 12, fontWeight: 700 }}
                    >
                      Deleted
                    </div>
                    <div
                      style={{
                        color: RED,
                        fontSize: 24,
                        fontWeight: 800,
                        marginTop: 6,
                      }}
                    >
                      {loading ? "..." : summary.deletedCount}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            {!isMobile ? (
              <div
                style={{
                  marginTop: 12,
                  display: "inline-flex",
                  background: SURFACE,
                  border: `1px solid ${BORDER}`,
                  borderRadius: 18,
                  padding: 14,
                }}
              >
                <div>
                  <div style={{ color: MUTED, fontSize: 12, fontWeight: 700 }}>
                    Deleted
                  </div>
                  <div
                    style={{
                      color: RED,
                      fontSize: 24,
                      fontWeight: 800,
                      marginTop: 6,
                    }}
                  >
                    {loading ? "..." : summary.deletedCount}
                  </div>
                </div>
              </div>
            ) : null}

            {error ? (
              <div
                style={{
                  marginTop: 16,
                  padding: "12px 14px",
                  borderRadius: 14,
                  background: RED_SOFT,
                  color: RED,
                  fontSize: 13,
                  fontWeight: 700,
                }}
              >
                {error}
              </div>
            ) : null}

            {success ? (
              <div
                style={{
                  marginTop: 16,
                  padding: "12px 14px",
                  borderRadius: 14,
                  background: GREEN_SOFT,
                  color: GREEN,
                  fontSize: 13,
                  fontWeight: 700,
                }}
              >
                {success}
              </div>
            ) : null}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: isMobile
                ? "1fr"
                : "minmax(360px, 520px) minmax(0, 1fr)",
              gap: 18,
              alignItems: "start",
            }}
          >
            <section
              style={{
                background: SURFACE,
                border: `1px solid ${BORDER}`,
                borderRadius: 22,
                padding: isMobile ? 16 : 18,
                boxShadow: SHADOW,
              }}
            >
              <h2
                style={{
                  margin: "0 0 14px",
                  color: TEXT,
                  fontSize: 18,
                  fontWeight: 800,
                }}
              >
                {editingId ? "Edit Customer" : "New Customer"}
              </h2>

              <form onSubmit={handleSubmit} style={{ display: "grid", gap: 14 }}>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: isMobile
                      ? "1fr"
                      : "repeat(2, minmax(0, 1fr))",
                    gap: 12,
                  }}
                >
                  <div>
                    <label style={labelStyle}>Customer Code</label>
                    <input
                      value={form.customer_code}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          customer_code: e.target.value,
                        }))
                      }
                      placeholder="e.g. CUST-001"
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>Customer Name</label>
                    <input
                      value={form.customer_name}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          customer_name: e.target.value,
                        }))
                      }
                      placeholder="Customer name"
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>Transaction Name</label>
                    <input
                      value={form.transaction_name}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          transaction_name: e.target.value,
                        }))
                      }
                      placeholder="Transaction name"
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>Contact Person</label>
                    <input
                      value={form.contact_person}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          contact_person: e.target.value,
                        }))
                      }
                      placeholder="Contact person"
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>Phone Number</label>
                    <input
                      value={form.phone_number}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          phone_number: e.target.value,
                        }))
                      }
                      placeholder="Phone number"
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>Alternative Phone</label>
                    <input
                      value={form.alternative_phone_number}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          alternative_phone_number: e.target.value,
                        }))
                      }
                      placeholder="Alternative phone"
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>Email</label>
                    <input
                      value={form.email}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          email: e.target.value,
                        }))
                      }
                      placeholder="Email address"
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>Customer Type</label>
                    <input
                      value={form.customer_type}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          customer_type: e.target.value,
                        }))
                      }
                      placeholder="e.g. butcher, retailer, trader"
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>Business Location</label>
                    <input
                      value={form.business_location}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          business_location: e.target.value,
                        }))
                      }
                      placeholder="Business location"
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>District</label>
                    <input
                      value={form.district}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          district: e.target.value,
                        }))
                      }
                      placeholder="District"
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>Region</label>
                    <input
                      value={form.region}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          region: e.target.value,
                        }))
                      }
                      placeholder="Region"
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>Default Payment Mode</label>
                    <input
                      value={form.default_payment_mode}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          default_payment_mode: e.target.value,
                        }))
                      }
                      placeholder="e.g. cash, mobile_money, bank"
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>TIN Number</label>
                    <input
                      value={form.tin_number}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          tin_number: e.target.value,
                        }))
                      }
                      placeholder="TIN number"
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>Registration Number</label>
                    <input
                      value={form.registration_number}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          registration_number: e.target.value,
                        }))
                      }
                      placeholder="Registration number"
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>Credit Limit</label>
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
                      style={inputStyle}
                      disabled={!form.credit_allowed}
                    />
                  </div>
                </div>

                <div>
                  <label style={labelStyle}>Address</label>
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
                    style={{ ...inputStyle, minHeight: 88, paddingTop: 12 }}
                  />
                </div>

                <div>
                  <label style={labelStyle}>Notes</label>
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
                    style={{ ...inputStyle, minHeight: 88, paddingTop: 12 }}
                  />
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: isMobile ? "1fr" : "repeat(2, minmax(0, 1fr))",
                    gap: 10,
                  }}
                >
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      color: TEXT,
                      fontSize: 13,
                      fontWeight: 700,
                      minHeight: 44,
                    }}
                  >
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
                    Credit allowed
                  </label>

                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      color: TEXT,
                      fontSize: 13,
                      fontWeight: 700,
                      minHeight: 44,
                    }}
                  >
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
                    Active customer
                  </label>
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: 10,
                    flexWrap: "wrap",
                    paddingTop: 4,
                  }}
                >
                  <button
                    type="submit"
                    disabled={saving}
                    style={{
                      minHeight: 44,
                      padding: "0 16px",
                      borderRadius: 12,
                      border: "none",
                      background: ORANGE,
                      color: "#fff",
                      fontSize: 14,
                      fontWeight: 800,
                      cursor: saving ? "not-allowed" : "pointer",
                      opacity: saving ? 0.7 : 1,
                      width: isMobile ? "100%" : "auto",
                    }}
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
                    style={{
                      minHeight: 44,
                      padding: "0 16px",
                      borderRadius: 12,
                      border: `1px solid ${BORDER}`,
                      background: SURFACE,
                      color: TEXT,
                      fontSize: 14,
                      fontWeight: 800,
                      cursor: "pointer",
                      width: isMobile ? "100%" : "auto",
                    }}
                  >
                    Clear
                  </button>
                </div>
              </form>
            </section>

            <section
              style={{
                background: SURFACE,
                border: `1px solid ${BORDER}`,
                borderRadius: 22,
                padding: isMobile ? 16 : 18,
                boxShadow: SHADOW,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  flexWrap: "wrap",
                  marginBottom: 14,
                }}
              >
                <div>
                  <h2
                    style={{
                      margin: 0,
                      color: TEXT,
                      fontSize: 18,
                      fontWeight: 800,
                    }}
                  >
                    Customer List
                  </h2>
                  <p
                    style={{
                      margin: "6px 0 0",
                      color: MUTED,
                      fontSize: 13,
                      lineHeight: 1.6,
                    }}
                  >
                    Search, edit, delete, and restore customers.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={loadData}
                  disabled={tableLoading}
                  style={{
                    minHeight: 40,
                    padding: "0 14px",
                    borderRadius: 12,
                    border: `1px solid ${BORDER}`,
                    background: SURFACE,
                    color: TEXT,
                    fontSize: 13,
                    fontWeight: 800,
                    cursor: tableLoading ? "not-allowed" : "pointer",
                    width: isMobile ? "100%" : "auto",
                  }}
                >
                  {tableLoading ? "Refreshing..." : "Refresh"}
                </button>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: isMobile
                    ? "1fr"
                    : "minmax(180px, 1fr) 180px 160px auto",
                  gap: 12,
                  marginBottom: 16,
                }}
              >
                <input
                  value={filters.search}
                  onChange={(e) =>
                    setFilters((prev) => ({ ...prev, search: e.target.value }))
                  }
                  placeholder="Search code, name, phone..."
                  style={inputStyle}
                />

                <input
                  value={filters.region}
                  onChange={(e) =>
                    setFilters((prev) => ({ ...prev, region: e.target.value }))
                  }
                  placeholder="Filter by region"
                  style={inputStyle}
                />

                <select
                  value={filters.is_active}
                  onChange={(e) =>
                    setFilters((prev) => ({ ...prev, is_active: e.target.value }))
                  }
                  style={inputStyle}
                >
                  <option value="">All statuses</option>
                  <option value="true">Active only</option>
                  <option value="false">Inactive only</option>
                </select>

                <label
                  style={{
                    minHeight: 44,
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "0 12px",
                    borderRadius: 12,
                    border: `1px solid ${BORDER}`,
                    background: "#fff",
                    color: TEXT,
                    fontSize: 13,
                    fontWeight: 700,
                  }}
                >
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
                  Include deleted
                </label>
              </div>

              {isMobile ? (
                <div style={{ display: "grid", gap: 12 }}>
                  {rows.length === 0 ? (
                    <div
                      style={{
                        padding: "24px 14px",
                        textAlign: "center",
                        color: MUTED,
                        fontSize: 14,
                        border: `1px solid ${BORDER}`,
                        borderRadius: 16,
                        background: "#fff",
                      }}
                    >
                      {tableLoading ? "Loading customers..." : "No customers found."}
                    </div>
                  ) : (
                    rows.map((row) => (
                      <div
                        key={row?.id}
                        style={{
                          border: `1px solid ${BORDER}`,
                          borderRadius: 16,
                          padding: 14,
                          background: "#fff",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: 12,
                            alignItems: "flex-start",
                            marginBottom: 10,
                          }}
                        >
                          <div style={{ minWidth: 0 }}>
                            <div
                              style={{
                                color: TEXT,
                                fontSize: 15,
                                fontWeight: 800,
                                lineHeight: 1.35,
                                wordBreak: "break-word",
                              }}
                            >
                              {row?.customer_name || "—"}
                            </div>
                            <div
                              style={{
                                color: MUTED,
                                fontSize: 12,
                                marginTop: 4,
                                wordBreak: "break-word",
                              }}
                            >
                              {row?.customer_code || "—"}
                            </div>
                          </div>

                          <StatusPill
                            active={row?.is_active}
                            deleted={row?.is_deleted}
                          />
                        </div>

                        <div
                          style={{
                            display: "grid",
                            gap: 6,
                            color: TEXT,
                            fontSize: 13,
                          }}
                        >
                          <div>
                            <span style={mobileLabelStyle}>Phone:</span>{" "}
                            {row?.phone_number || "—"}
                          </div>
                          <div>
                            <span style={mobileLabelStyle}>Type:</span>{" "}
                            {row?.customer_type || "—"}
                          </div>
                          <div>
                            <span style={mobileLabelStyle}>Location:</span>{" "}
                            {row?.business_location || "—"}
                          </div>
                          <div>
                            <span style={mobileLabelStyle}>Region:</span>{" "}
                            {row?.region || "—"}
                          </div>
                          <div>
                            <span style={mobileLabelStyle}>Payment:</span>{" "}
                            {row?.default_payment_mode || "—"}
                          </div>
                          <div>
                            <span style={mobileLabelStyle}>Credit:</span>{" "}
                            {row?.credit_allowed ? "Allowed" : "Not allowed"}
                          </div>
                        </div>

                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                            gap: 10,
                            marginTop: 14,
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => startEdit(row)}
                            style={mobileActionBtn}
                          >
                            Edit
                          </button>

                          {!row?.is_deleted ? (
                            <button
                              type="button"
                              onClick={() => handleDelete(row?.id)}
                              style={{ ...mobileActionBtn, color: RED }}
                            >
                              Delete
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleRestore(row?.id)}
                              style={{ ...mobileActionBtn, color: GREEN }}
                            >
                              Restore
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              ) : (
                <div
                  style={{
                    overflowX: "auto",
                    border: `1px solid ${BORDER}`,
                    borderRadius: 16,
                  }}
                >
                  <table
                    style={{
                      width: "100%",
                      minWidth: 1180,
                      borderCollapse: "collapse",
                      background: "#fff",
                    }}
                  >
                    <thead>
                      <tr style={{ background: "#f8fafc" }}>
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
                          <th
                            key={head}
                            style={{
                              textAlign: "left",
                              padding: "13px 14px",
                              borderBottom: `1px solid ${BORDER}`,
                              color: TEXT,
                              fontSize: 13,
                              fontWeight: 800,
                              whiteSpace: "nowrap",
                            }}
                          >
                            {head}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.length === 0 ? (
                        <tr>
                          <td
                            colSpan={10}
                            style={{
                              padding: "28px 14px",
                              textAlign: "center",
                              color: MUTED,
                              fontSize: 14,
                            }}
                          >
                            {tableLoading
                              ? "Loading customers..."
                              : "No customers found."}
                          </td>
                        </tr>
                      ) : (
                        rows.map((row) => (
                          <tr key={row?.id}>
                            <td style={cellStyleStrong}>
                              {row?.customer_code || "—"}
                            </td>
                            <td style={cellStyle}>
                              {row?.customer_name || "—"}
                            </td>
                            <td style={cellStyle}>
                              {row?.phone_number || "—"}
                            </td>
                            <td style={cellStyle}>
                              {row?.customer_type || "—"}
                            </td>
                            <td style={cellStyle}>
                              {row?.business_location || "—"}
                            </td>
                            <td style={cellStyle}>{row?.region || "—"}</td>
                            <td style={cellStyle}>
                              {row?.default_payment_mode || "—"}
                            </td>
                            <td style={cellStyle}>
                              {row?.credit_allowed ? "Allowed" : "No"}
                            </td>
                            <td style={cellStyle}>
                              <StatusPill
                                active={row?.is_active}
                                deleted={row?.is_deleted}
                              />
                            </td>
                            <td style={cellStyle}>
                              <div
                                style={{
                                  display: "flex",
                                  gap: 8,
                                  flexWrap: "wrap",
                                }}
                              >
                                <button
                                  type="button"
                                  onClick={() => startEdit(row)}
                                  style={actionBtn}
                                >
                                  Edit
                                </button>

                                {!row?.is_deleted ? (
                                  <button
                                    type="button"
                                    onClick={() => handleDelete(row?.id)}
                                    style={{ ...actionBtn, color: RED }}
                                  >
                                    Delete
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleRestore(row?.id)}
                                    style={{ ...actionBtn, color: GREEN }}
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
              )}
            </section>
          </div>
        </div>
      </div>
    </>
  );
}

const inputStyle = {
  width: "100%",
  minHeight: 44,
  borderRadius: 12,
  border: `1px solid ${BORDER}`,
  padding: "0 14px",
  fontSize: 14,
  color: TEXT,
  background: "#fff",
  outline: "none",
  boxSizing: "border-box",
};

const labelStyle = {
  display: "block",
  color: TEXT,
  fontSize: 13,
  fontWeight: 700,
  marginBottom: 6,
};

const cellStyle = {
  padding: "13px 14px",
  borderBottom: `1px solid ${BORDER}`,
  color: TEXT,
  fontSize: 13,
  verticalAlign: "top",
};

const cellStyleStrong = {
  padding: "13px 14px",
  borderBottom: `1px solid ${BORDER}`,
  color: TEXT,
  fontSize: 13,
  fontWeight: 800,
  verticalAlign: "top",
};

const actionBtn = {
  minHeight: 34,
  padding: "0 10px",
  borderRadius: 10,
  border: `1px solid ${BORDER}`,
  background: "#fff",
  color: BLUE,
  fontSize: 12,
  fontWeight: 800,
  cursor: "pointer",
};

const mobileActionBtn = {
  minHeight: 40,
  padding: "0 12px",
  borderRadius: 10,
  border: `1px solid ${BORDER}`,
  background: "#fff",
  color: BLUE,
  fontSize: 13,
  fontWeight: 800,
  cursor: "pointer",
  width: "100%",
};

const mobileLabelStyle = {
  color: MUTED,
  fontWeight: 700,
};