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
    category_id: "",
    code: "",
    name: "",
    short_name: "",
    description: "",
    unit_of_measure: "",
    allow_fractional_quantity: false,
    default_unit_price: "",
    minimum_unit_price: "",
    maximum_unit_price: "",
    report_label: "",
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

function formatMoney(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function ByproductsItemsPage() {
  const [rows, setRows] = useState([]);
  const [categories, setCategories] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [tableLoading, setTableLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [filters, setFilters] = useState({
    search: "",
    category_id: "",
    is_active: "",
    include_deleted: false,
  });

  const [form, setForm] = useState(emptyForm());

  const loadData = useCallback(async () => {
    setTableLoading(true);
    setError("");

    try {
      const [itemsResponse, categoriesResponse] = await Promise.all([
        ByproductsService.listItems({
          search: filters.search || undefined,
          category_id: filters.category_id || undefined,
          is_active:
            filters.is_active === ""
              ? undefined
              : filters.is_active === "true",
          include_deleted: filters.include_deleted,
          skip: 0,
          limit: 300,
        }),
        ByproductsService.getCategorySelection(),
      ]);

      setRows(coerceItems(itemsResponse));
      setTotal(coerceTotal(itemsResponse));
      setCategories(coerceItems(categoriesResponse));
    } catch (err) {
      setError(err?.message || "Failed to load items.");
    } finally {
      setLoading(false);
      setTableLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const summary = useMemo(() => {
    const activeCount = rows.filter((item) => item?.is_active && !item?.is_deleted).length;
    const deletedCount = rows.filter((item) => item?.is_deleted).length;
    return { activeCount, deletedCount };
  }, [rows]);

  function resetForm() {
    setForm(emptyForm());
    setEditingId(null);
    setSuccess("");
  }

  function startEdit(row) {
    setEditingId(row?.id || null);
    setForm({
      category_id: row?.category_id || "",
      code: row?.code || "",
      name: row?.name || "",
      short_name: row?.short_name || "",
      description: row?.description || "",
      unit_of_measure: row?.unit_of_measure || "",
      allow_fractional_quantity: !!row?.allow_fractional_quantity,
      default_unit_price:
        row?.default_unit_price !== null && row?.default_unit_price !== undefined
          ? String(row.default_unit_price)
          : "",
      minimum_unit_price:
        row?.minimum_unit_price !== null && row?.minimum_unit_price !== undefined
          ? String(row.minimum_unit_price)
          : "",
      maximum_unit_price:
        row?.maximum_unit_price !== null && row?.maximum_unit_price !== undefined
          ? String(row.maximum_unit_price)
          : "",
      report_label: row?.report_label || "",
      notes: row?.notes || "",
      is_active: row?.is_active !== false,
    });
    setSuccess("");
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const payload = {
        category_id: form.category_id || null,
        code: String(form.code || "").trim(),
        name: String(form.name || "").trim(),
        short_name: String(form.short_name || "").trim() || null,
        description: String(form.description || "").trim() || null,
        unit_of_measure: String(form.unit_of_measure || "").trim(),
        allow_fractional_quantity: !!form.allow_fractional_quantity,
        default_unit_price: toNumberOrNull(form.default_unit_price),
        minimum_unit_price: toNumberOrNull(form.minimum_unit_price),
        maximum_unit_price: toNumberOrNull(form.maximum_unit_price),
        report_label: String(form.report_label || "").trim() || null,
        notes: String(form.notes || "").trim() || null,
        is_active: !!form.is_active,
      };

      if (!payload.code) throw new Error("Item code is required");
      if (!payload.name) throw new Error("Item name is required");
      if (!payload.unit_of_measure) throw new Error("Unit of measure is required");
      if (payload.default_unit_price === null) {
        throw new Error("Default unit price is required");
      }

      if (editingId) {
        await ByproductsService.updateItem(editingId, payload);
        setSuccess("Item updated successfully.");
      } else {
        await ByproductsService.createItem(payload);
        setSuccess("Item created successfully.");
      }

      resetForm();
      await loadData();
    } catch (err) {
      setError(err?.message || "Failed to save item.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    const ok = window.confirm("Delete this item?");
    if (!ok) return;

    setError("");
    setSuccess("");

    try {
      await ByproductsService.deleteItem(id);
      setSuccess("Item deleted successfully.");
      await loadData();
    } catch (err) {
      setError(err?.message || "Failed to delete item.");
    }
  }

  async function handleRestore(id) {
    setError("");
    setSuccess("");

    try {
      await ByproductsService.restoreItem(id);
      setSuccess("Item restored successfully.");
      await loadData();
    } catch (err) {
      setError(err?.message || "Failed to restore item.");
    }
  }

  return (
    <>
      <Head>
        <title>Byproducts Items</title>
      </Head>

      <div
        style={{
          minHeight: "100vh",
          background: PAGE_BG,
          padding: "20px 16px 40px",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div style={{ maxWidth: 1360, margin: "0 auto", display: "grid", gap: 18 }}>
          <div
            style={{
              background: SURFACE,
              border: `1px solid ${BORDER}`,
              borderRadius: 24,
              padding: 20,
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
              <div>
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
                    fontSize: 28,
                    fontWeight: 800,
                    lineHeight: 1.15,
                  }}
                >
                  Items
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
                  Create and manage byproduct items, units, prices, and category assignment.
                </p>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, minmax(120px, 1fr))",
                  gap: 12,
                  minWidth: 320,
                  maxWidth: 440,
                  flex: 1,
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
                  <div style={{ color: MUTED, fontSize: 12, fontWeight: 700 }}>Total</div>
                  <div style={{ color: TEXT, fontSize: 24, fontWeight: 800, marginTop: 6 }}>
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
                  <div style={{ color: MUTED, fontSize: 12, fontWeight: 700 }}>Active</div>
                  <div style={{ color: GREEN, fontSize: 24, fontWeight: 800, marginTop: 6 }}>
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
                  <div style={{ color: MUTED, fontSize: 12, fontWeight: 700 }}>Deleted</div>
                  <div style={{ color: RED, fontSize: 24, fontWeight: 800, marginTop: 6 }}>
                    {loading ? "..." : summary.deletedCount}
                  </div>
                </div>
              </div>
            </div>

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
              gridTemplateColumns: "minmax(340px, 460px) minmax(0, 1fr)",
              gap: 18,
              alignItems: "start",
            }}
          >
            <section
              style={{
                background: SURFACE,
                border: `1px solid ${BORDER}`,
                borderRadius: 22,
                padding: 18,
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
                {editingId ? "Edit Item" : "New Item"}
              </h2>

              <form onSubmit={handleSubmit} style={{ display: "grid", gap: 14 }}>
                <div>
                  <label style={labelStyle}>Category</label>
                  <select
                    value={form.category_id}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, category_id: e.target.value }))
                    }
                    style={inputStyle}
                  >
                    <option value="">No category</option>
                    {categories.map((category) => (
                      <option key={category?.id} value={category?.id}>
                        {category?.name || category?.code || "Unnamed Category"}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={labelStyle}>Code</label>
                  <input
                    value={form.code}
                    onChange={(e) => setForm((prev) => ({ ...prev, code: e.target.value }))}
                    placeholder="e.g. LIVER"
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label style={labelStyle}>Name</label>
                  <input
                    value={form.name}
                    onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="Item name"
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label style={labelStyle}>Short Name</label>
                  <input
                    value={form.short_name}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, short_name: e.target.value }))
                    }
                    placeholder="Optional short name"
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label style={labelStyle}>Unit of Measure</label>
                  <input
                    value={form.unit_of_measure}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        unit_of_measure: e.target.value,
                      }))
                    }
                    placeholder="e.g. kg, pcs, tray"
                    style={inputStyle}
                  />
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                    gap: 12,
                  }}
                >
                  <div>
                    <label style={labelStyle}>Default Price</label>
                    <input
                      type="number"
                      step="0.01"
                      value={form.default_unit_price}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          default_unit_price: e.target.value,
                        }))
                      }
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>Minimum Price</label>
                    <input
                      type="number"
                      step="0.01"
                      value={form.minimum_unit_price}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          minimum_unit_price: e.target.value,
                        }))
                      }
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>Maximum Price</label>
                    <input
                      type="number"
                      step="0.01"
                      value={form.maximum_unit_price}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          maximum_unit_price: e.target.value,
                        }))
                      }
                      style={inputStyle}
                    />
                  </div>
                </div>

                <div>
                  <label style={labelStyle}>Report Label</label>
                  <input
                    value={form.report_label}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, report_label: e.target.value }))
                    }
                    placeholder="Optional report label"
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label style={labelStyle}>Description</label>
                  <textarea
                    value={form.description}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, description: e.target.value }))
                    }
                    rows={3}
                    style={{ ...inputStyle, minHeight: 90, paddingTop: 12 }}
                  />
                </div>

                <div>
                  <label style={labelStyle}>Notes</label>
                  <textarea
                    value={form.notes}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, notes: e.target.value }))
                    }
                    rows={3}
                    style={{ ...inputStyle, minHeight: 90, paddingTop: 12 }}
                  />
                </div>

                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    color: TEXT,
                    fontSize: 13,
                    fontWeight: 700,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={!!form.allow_fractional_quantity}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        allow_fractional_quantity: e.target.checked,
                      }))
                    }
                  />
                  Allow fractional quantity
                </label>

                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    color: TEXT,
                    fontSize: 13,
                    fontWeight: 700,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={!!form.is_active}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, is_active: e.target.checked }))
                    }
                  />
                  Active item
                </label>

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
                    }}
                  >
                    {saving ? "Saving..." : editingId ? "Update Item" : "Create Item"}
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
                padding: 18,
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
                    Item List
                  </h2>
                  <p
                    style={{
                      margin: "6px 0 0",
                      color: MUTED,
                      fontSize: 13,
                    }}
                  >
                    Search, edit, delete, and restore byproduct items.
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
                  }}
                >
                  {tableLoading ? "Refreshing..." : "Refresh"}
                </button>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(180px, 1fr) 180px 160px auto",
                  gap: 12,
                  marginBottom: 16,
                }}
              >
                <input
                  value={filters.search}
                  onChange={(e) =>
                    setFilters((prev) => ({ ...prev, search: e.target.value }))
                  }
                  placeholder="Search code or item name"
                  style={inputStyle}
                />

                <select
                  value={filters.category_id}
                  onChange={(e) =>
                    setFilters((prev) => ({ ...prev, category_id: e.target.value }))
                  }
                  style={inputStyle}
                >
                  <option value="">All categories</option>
                  {categories.map((category) => (
                    <option key={category?.id} value={category?.id}>
                      {category?.name || category?.code || "Unnamed Category"}
                    </option>
                  ))}
                </select>

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
                        "Name",
                        "Category",
                        "Unit",
                        "Default Price",
                        "Min Price",
                        "Max Price",
                        "Fractional",
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
                          {tableLoading ? "Loading items..." : "No items found."}
                        </td>
                      </tr>
                    ) : (
                      rows.map((row) => (
                        <tr key={row?.id}>
                          <td style={cellStyleStrong}>{row?.code || "—"}</td>
                          <td style={cellStyle}>{row?.name || "—"}</td>
                          <td style={cellStyle}>
                            {row?.category_name || row?.category?.name || "—"}
                          </td>
                          <td style={cellStyle}>{row?.unit_of_measure || "—"}</td>
                          <td style={cellStyle}>{formatMoney(row?.default_unit_price)}</td>
                          <td style={cellStyle}>{formatMoney(row?.minimum_unit_price)}</td>
                          <td style={cellStyle}>{formatMoney(row?.maximum_unit_price)}</td>
                          <td style={cellStyle}>
                            {row?.allow_fractional_quantity ? "Yes" : "No"}
                          </td>
                          <td style={cellStyle}>
                            <StatusPill active={row?.is_active} deleted={row?.is_deleted} />
                          </td>
                          <td style={cellStyle}>
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                              <button type="button" onClick={() => startEdit(row)} style={actionBtn}>
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