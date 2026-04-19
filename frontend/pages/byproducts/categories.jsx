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

function emptyForm() {
  return {
    code: "",
    name: "",
    description: "",
    sort_order: 0,
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

export default function ByproductsCategoriesPage() {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tableLoading, setTableLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editingId, setEditingId] = useState(null);

  const [filters, setFilters] = useState({
    search: "",
    is_active: "",
    include_deleted: false,
  });

  const [form, setForm] = useState(emptyForm());

  const loadData = useCallback(async () => {
    setTableLoading(true);
    setError("");

    try {
      const response = await ByproductsService.listCategories({
        search: filters.search || undefined,
        is_active:
          filters.is_active === ""
            ? undefined
            : filters.is_active === "true",
        include_deleted: filters.include_deleted,
        skip: 0,
        limit: 200,
      });

      setRows(coerceItems(response));
      setTotal(coerceTotal(response));
    } catch (err) {
      setError(err?.message || "Failed to load categories.");
    } finally {
      setLoading(false);
      setTableLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredSummary = useMemo(() => {
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
      code: row?.code || "",
      name: row?.name || "",
      description: row?.description || "",
      sort_order:
        typeof row?.sort_order === "number"
          ? row.sort_order
          : Number(row?.sort_order || 0),
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
        code: String(form.code || "").trim(),
        name: String(form.name || "").trim(),
        description: String(form.description || "").trim() || null,
        sort_order: Number(form.sort_order || 0),
        is_active: !!form.is_active,
      };

      if (!payload.code) throw new Error("Category code is required");
      if (!payload.name) throw new Error("Category name is required");

      if (editingId) {
        await ByproductsService.updateCategory(editingId, payload);
        setSuccess("Category updated successfully.");
      } else {
        await ByproductsService.createCategory(payload);
        setSuccess("Category created successfully.");
      }

      resetForm();
      await loadData();
    } catch (err) {
      setError(err?.message || "Failed to save category.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    const ok = window.confirm("Delete this category?");
    if (!ok) return;

    setError("");
    setSuccess("");

    try {
      await ByproductsService.deleteCategory(id);
      setSuccess("Category deleted successfully.");
      await loadData();
    } catch (err) {
      setError(err?.message || "Failed to delete category.");
    }
  }

  async function handleRestore(id) {
    setError("");
    setSuccess("");

    try {
      await ByproductsService.restoreCategory(id);
      setSuccess("Category restored successfully.");
      await loadData();
    } catch (err) {
      setError(err?.message || "Failed to restore category.");
    }
  }

  return (
    <>
      <Head>
        <title>Byproducts Categories</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover" />
      </Head>

      <div
        className="byproducts-categories-page"
        style={{
          minHeight: "100vh",
          background: PAGE_BG,
          padding: "20px 16px 40px",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div style={{ maxWidth: 1280, margin: "0 auto", display: "grid", gap: 18 }}>
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
                  Categories
                </h1>

                <p
                  style={{
                    margin: "8px 0 0",
                    color: MUTED,
                    fontSize: 14,
                    lineHeight: 1.7,
                    maxWidth: 760,
                  }}
                >
                  Create and manage byproduct categories used by items and reports.
                </p>
              </div>

              <div
                className="stats-cards"
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, minmax(120px, 1fr))",
                  gap: 12,
                  minWidth: 280,
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
                    {loading ? "..." : filteredSummary.activeCount}
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
                    {loading ? "..." : filteredSummary.deletedCount}
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
            className="two-column-layout"
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(320px, 420px) minmax(0, 1fr)",
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
                {editingId ? "Edit Category" : "New Category"}
              </h2>

              <form onSubmit={handleSubmit} style={{ display: "grid", gap: 14 }}>
                <div>
                  <label
                    style={{
                      display: "block",
                      color: TEXT,
                      fontSize: 13,
                      fontWeight: 700,
                      marginBottom: 6,
                    }}
                  >
                    Code
                  </label>
                  <input
                    value={form.code}
                    onChange={(e) => setForm((prev) => ({ ...prev, code: e.target.value }))}
                    placeholder="e.g. OFFALS"
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label style={labelStyle}>Name</label>
                  <input
                    value={form.name}
                    onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="Category name"
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
                    placeholder="Optional description"
                    rows={4}
                    style={{ ...inputStyle, minHeight: 110, paddingTop: 12 }}
                  />
                </div>

                <div>
                  <label style={labelStyle}>Sort Order</label>
                  <input
                    type="number"
                    value={form.sort_order}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        sort_order: e.target.value,
                      }))
                    }
                    style={inputStyle}
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
                    checked={!!form.is_active}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, is_active: e.target.checked }))
                    }
                  />
                  Active category
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
                    {saving ? "Saving..." : editingId ? "Update Category" : "Create Category"}
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
              className="list-section"
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
                    Category List
                  </h2>
                  <p
                    style={{
                      margin: "6px 0 0",
                      color: MUTED,
                      fontSize: 13,
                    }}
                  >
                    Search, review, edit, delete, and restore categories.
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
                className="filter-controls"
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(180px, 1fr) 160px auto",
                  gap: 12,
                  marginBottom: 16,
                }}
              >
                <input
                  value={filters.search}
                  onChange={(e) =>
                    setFilters((prev) => ({ ...prev, search: e.target.value }))
                  }
                  placeholder="Search code or name"
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
                  className="include-deleted-checkbox"
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
                    minWidth: 760,
                    borderCollapse: "collapse",
                    background: "#fff",
                  }}
                >
                  <thead>
                    <tr style={{ background: "#f8fafc" }}>
                      {["Code", "Name", "Sort", "Status", "Description", "Action"].map((head) => (
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
                          colSpan={6}
                          style={{
                            padding: "28px 14px",
                            textAlign: "center",
                            color: MUTED,
                            fontSize: 14,
                          }}
                        >
                          {tableLoading ? "Loading categories..." : "No categories found."}
                        </td>
                      </tr>
                    ) : (
                      rows.map((row) => (
                        <tr key={row?.id}>
                          <td style={cellStyleStrong}>{row?.code || "—"}</td>
                          <td style={cellStyle}>{row?.name || "—"}</td>
                          <td style={cellStyle}>{row?.sort_order ?? 0}</td>
                          <td style={cellStyle}>
                            <StatusPill active={row?.is_active} deleted={row?.is_deleted} />
                          </td>
                          <td style={cellStyle}>{row?.description || "—"}</td>
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

      <style>{`
        /* Mobile responsive adjustments */
        @media (max-width: 768px) {
          .byproducts-categories-page {
            padding: 16px 12px 32px !important;
          }
          
          /* Stack the two main columns */
          .two-column-layout {
            grid-template-columns: 1fr !important;
            gap: 24px !important;
          }
          
          /* Make stats cards more compact on small screens */
          .stats-cards {
            min-width: 100% !important;
            gap: 10px !important;
          }
          
          .stats-cards > div {
            padding: 10px !important;
          }
          
          /* Filter controls stack vertically */
          .filter-controls {
            grid-template-columns: 1fr !important;
            gap: 12px !important;
          }
          
          /* Full width for include deleted checkbox */
          .include-deleted-checkbox {
            width: 100%;
            box-sizing: border-box;
          }
          
          /* Increase touch target size for action buttons */
          .list-section button {
            min-height: 40px !important;
            padding: 0 14px !important;
          }
          
          /* Slightly reduce padding in table cells for better space */
          table th,
          table td {
            padding: 10px 12px !important;
          }
          
          /* Adjust heading font sizes */
          h1 {
            font-size: 24px !important;
          }
        }
        
        /* Extra small devices (below 480px) */
        @media (max-width: 480px) {
          .stats-cards {
            grid-template-columns: 1fr !important;
            width: 100%;
          }
          
          .stats-cards > div {
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          
          .stats-cards > div > div:first-child {
            margin-bottom: 0;
          }
          
          .stats-cards > div > div:last-child {
            margin-top: 0;
            font-size: 28px;
          }
          
          /* Stack action buttons in table when needed */
          td div[style*="flex"] {
            flex-direction: column;
            gap: 6px !important;
          }
          
          td button {
            width: 100%;
          }
        }
      `}</style>
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