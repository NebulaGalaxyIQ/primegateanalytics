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

function placeholderListFromPayload(payload) {
  if (Array.isArray(payload)) return payload;

  if (Array.isArray(payload?.placeholders)) return payload.placeholders;
  if (Array.isArray(payload?.data?.placeholders)) return payload.data.placeholders;
  if (Array.isArray(payload?.placeholders_meta?.placeholders)) {
    return payload.placeholders_meta.placeholders;
  }
  if (Array.isArray(payload?.data?.placeholders_meta?.placeholders)) {
    return payload.data.placeholders_meta.placeholders;
  }

  return [];
}

function emptyUploadForm() {
  return {
    name: "",
    template_code: "",
    template_type: "daily",
    template_format: "docx",
    notes: "",
    is_default: false,
    is_active: true,
    file: null,
  };
}

function emptyEditForm() {
  return {
    id: "",
    name: "",
    template_code: "",
    template_type: "daily",
    template_format: "docx",
    notes: "",
    is_default: false,
    is_active: true,
  };
}

function placeholderCount(template) {
  const list =
    template?.placeholders_meta?.placeholders ||
    template?.placeholders ||
    [];
  return Array.isArray(list) ? list.length : 0;
}

function formatFileSize(bytes) {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n <= 0) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function valueText(value) {
  if (value === null || value === undefined || value === "") return "—";
  return String(value).replace(/_/g, " ");
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

function DefaultPill({ isDefault }) {
  if (!isDefault) return null;

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
        background: BLUE_SOFT,
        color: BLUE,
        whiteSpace: "nowrap",
      }}
    >
      Default
    </span>
  );
}

function MetricCard({ title, value, color = TEXT }) {
  return (
    <div
      style={{
        background: SURFACE,
        border: `1px solid ${BORDER}`,
        borderRadius: 18,
        padding: 14,
      }}
    >
      <div style={{ color: MUTED, fontSize: 12, fontWeight: 700 }}>{title}</div>
      <div
        style={{
          color,
          fontSize: 22,
          fontWeight: 800,
          marginTop: 6,
          lineHeight: 1.1,
        }}
      >
        {value}
      </div>
    </div>
  );
}

export default function ByproductsTemplatesPage() {
  const [templates, setTemplates] = useState([]);
  const [total, setTotal] = useState(0);

  const [uploadForm, setUploadForm] = useState(emptyUploadForm());
  const [editForm, setEditForm] = useState(emptyEditForm());

  const [filters, setFilters] = useState({
    search: "",
    template_type: "",
    template_format: "",
    is_default: "",
    is_active: "",
    include_deleted: false,
  });

  const [screenWidth, setScreenWidth] = useState(1280);
  const [loading, setLoading] = useState(true);
  const [tableLoading, setTableLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [refreshingId, setRefreshingId] = useState("");
  const [settingDefaultId, setSettingDefaultId] = useState("");
  const [deletingId, setDeletingId] = useState("");
  const [restoringId, setRestoringId] = useState("");
  const [replaceFileId, setReplaceFileId] = useState("");
  const [replaceFiles, setReplaceFiles] = useState({});
  const [placeholderLoadingId, setPlaceholderLoadingId] = useState("");
  const [selectedPlaceholderTemplate, setSelectedPlaceholderTemplate] = useState(null);
  const [selectedPlaceholders, setSelectedPlaceholders] = useState([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

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

  const loadTemplates = useCallback(async () => {
    setTableLoading(true);
    setError("");

    try {
      const response = await ByproductsService.listTemplates({
        search: filters.search || undefined,
        template_type: filters.template_type || undefined,
        template_format: filters.template_format || undefined,
        is_default:
          filters.is_default === ""
            ? undefined
            : filters.is_default === "true",
        is_active:
          filters.is_active === ""
            ? undefined
            : filters.is_active === "true",
        include_deleted: filters.include_deleted,
        skip: 0,
        limit: 300,
      });

      setTemplates(coerceItems(response));
      setTotal(coerceTotal(response));
    } catch (err) {
      setError(err?.message || "Failed to load templates.");
    } finally {
      setLoading(false);
      setTableLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const summary = useMemo(() => {
    const activeCount = templates.filter(
      (item) => item?.is_active && !item?.is_deleted
    ).length;
    const defaultCount = templates.filter(
      (item) => item?.is_default && !item?.is_deleted
    ).length;
    const deletedCount = templates.filter((item) => item?.is_deleted).length;
    const placeholderTotal = templates.reduce(
      (sum, item) => sum + placeholderCount(item),
      0
    );

    return {
      activeCount,
      defaultCount,
      deletedCount,
      placeholderTotal,
    };
  }, [templates]);

  function resetUploadForm() {
    setUploadForm(emptyUploadForm());
  }

  function resetEditForm() {
    setEditForm(emptyEditForm());
  }

  function startEdit(template) {
    setEditForm({
      id: template?.id || "",
      name: template?.name || "",
      template_code: template?.template_code || "",
      template_type: template?.template_type || "daily",
      template_format: template?.template_format || "docx",
      notes: template?.notes || "",
      is_default: !!template?.is_default,
      is_active: template?.is_active !== false,
    });

    setSuccess("");
    setError("");

    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  async function handleUpload(e) {
    e.preventDefault();
    setUploading(true);
    setError("");
    setSuccess("");

    try {
      if (!uploadForm.file) {
        throw new Error("Please choose a template file.");
      }

      await ByproductsService.uploadTemplate({
        name: String(uploadForm.name || "").trim(),
        template_code: String(uploadForm.template_code || "").trim(),
        template_type: String(uploadForm.template_type || "").trim(),
        template_format: String(uploadForm.template_format || "").trim(),
        notes: String(uploadForm.notes || "").trim() || null,
        is_default: !!uploadForm.is_default,
        is_active: !!uploadForm.is_active,
        file: uploadForm.file,
      });

      setSuccess("Template uploaded successfully.");
      resetUploadForm();
      await loadTemplates();
    } catch (err) {
      setError(err?.message || "Failed to upload template.");
    } finally {
      setUploading(false);
    }
  }

  async function handleEditSave(e) {
    e.preventDefault();
    setSavingEdit(true);
    setError("");
    setSuccess("");

    try {
      if (!editForm.id) {
        throw new Error("No template selected for editing.");
      }

      await ByproductsService.updateTemplate(editForm.id, {
        name: String(editForm.name || "").trim(),
        template_code: String(editForm.template_code || "").trim(),
        template_type: String(editForm.template_type || "").trim(),
        template_format: String(editForm.template_format || "").trim(),
        notes: String(editForm.notes || "").trim() || null,
        is_default: !!editForm.is_default,
        is_active: !!editForm.is_active,
      });

      setSuccess("Template updated successfully.");
      resetEditForm();
      await loadTemplates();
    } catch (err) {
      setError(err?.message || "Failed to update template.");
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleSetDefault(id) {
    setSettingDefaultId(id);
    setError("");
    setSuccess("");

    try {
      await ByproductsService.setDefaultTemplate(id);
      setSuccess("Default template updated successfully.");
      await loadTemplates();
    } catch (err) {
      setError(err?.message || "Failed to set default template.");
    } finally {
      setSettingDefaultId("");
    }
  }

  async function handleRefreshPlaceholders(id) {
    setRefreshingId(id);
    setError("");
    setSuccess("");

    try {
      const response = await ByproductsService.refreshTemplatePlaceholders(id);
      const latestList = placeholderListFromPayload(response);

      if (latestList.length > 0) {
        setSelectedPlaceholderTemplate(id);
        setSelectedPlaceholders(latestList);
      }

      setSuccess("Template placeholders refreshed successfully.");
      await loadTemplates();
    } catch (err) {
      setError(err?.message || "Failed to refresh placeholders.");
    } finally {
      setRefreshingId("");
    }
  }

  async function handlePreviewPlaceholders(template) {
    if (!template?.id) return;

    setPlaceholderLoadingId(template.id);
    setError("");
    setSuccess("");

    try {
      const response = await ByproductsService.previewTemplatePlaceholders(template.id);
      const list = placeholderListFromPayload(response);

      setSelectedPlaceholderTemplate(template.id);
      setSelectedPlaceholders(
        list.length > 0
          ? list
          : Array.isArray(template?.placeholders_meta?.placeholders)
          ? template.placeholders_meta.placeholders
          : []
      );
    } catch (err) {
      setError(err?.message || "Failed to load placeholders.");
    } finally {
      setPlaceholderLoadingId("");
    }
  }

  async function handleReplaceFile(templateId) {
    const file = replaceFiles[templateId];
    if (!file) {
      setError("Choose a replacement file first.");
      return;
    }

    setReplaceFileId(templateId);
    setError("");
    setSuccess("");

    try {
      await ByproductsService.replaceTemplateFile(templateId, file);
      setReplaceFiles((prev) => ({ ...prev, [templateId]: null }));
      setSuccess("Template file replaced successfully.");
      await loadTemplates();
    } catch (err) {
      setError(err?.message || "Failed to replace template file.");
    } finally {
      setReplaceFileId("");
    }
  }

  async function handleDelete(id) {
    const ok = window.confirm("Delete this template?");
    if (!ok) return;

    setDeletingId(id);
    setError("");
    setSuccess("");

    try {
      await ByproductsService.deleteTemplate(id);
      setSuccess("Template deleted successfully.");
      if (selectedPlaceholderTemplate === id) {
        setSelectedPlaceholderTemplate(null);
        setSelectedPlaceholders([]);
      }
      if (editForm.id === id) {
        resetEditForm();
      }
      await loadTemplates();
    } catch (err) {
      setError(err?.message || "Failed to delete template.");
    } finally {
      setDeletingId("");
    }
  }

  async function handleRestore(id) {
    setRestoringId(id);
    setError("");
    setSuccess("");

    try {
      await ByproductsService.restoreTemplate(id);
      setSuccess("Template restored successfully.");
      await loadTemplates();
    } catch (err) {
      setError(err?.message || "Failed to restore template.");
    } finally {
      setRestoringId("");
    }
  }

  return (
    <>
      <Head>
        <title>Byproducts Templates</title>
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
            maxWidth: 1500,
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
                  Templates
                </h1>

                <p
                  style={{
                    margin: "8px 0 0",
                    color: MUTED,
                    fontSize: 14,
                    lineHeight: 1.7,
                    maxWidth: 840,
                  }}
                >
                  Upload, edit, organize, replace, and preview byproducts report
                  templates. The page switches to stacked cards on phones so it
                  remains usable on small screens.
                </p>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: isMobile
                    ? "repeat(2, minmax(0, 1fr))"
                    : "repeat(4, minmax(120px, 1fr))",
                  gap: 12,
                  width: isMobile ? "100%" : "auto",
                  minWidth: isMobile ? 0 : 480,
                }}
              >
                <MetricCard title="Total" value={loading ? "..." : total} color={TEXT} />
                <MetricCard
                  title="Active"
                  value={loading ? "..." : summary.activeCount}
                  color={GREEN}
                />
                <MetricCard
                  title="Default"
                  value={loading ? "..." : summary.defaultCount}
                  color={BLUE}
                />
                <MetricCard
                  title="Placeholders"
                  value={loading ? "..." : summary.placeholderTotal}
                  color={ORANGE_DEEP}
                />
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
              gridTemplateColumns: isMobile
                ? "1fr"
                : "minmax(340px, 420px) minmax(340px, 420px) minmax(0, 1fr)",
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
                Upload Template
              </h2>

              <form onSubmit={handleUpload} style={{ display: "grid", gap: 14 }}>
                <div>
                  <label style={labelStyle}>Name</label>
                  <input
                    value={uploadForm.name}
                    onChange={(e) =>
                      setUploadForm((prev) => ({ ...prev, name: e.target.value }))
                    }
                    placeholder="Template name"
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label style={labelStyle}>Template Code</label>
                  <input
                    value={uploadForm.template_code}
                    onChange={(e) =>
                      setUploadForm((prev) => ({
                        ...prev,
                        template_code: e.target.value,
                      }))
                    }
                    placeholder="e.g. OFFALS-DAILY-001"
                    style={inputStyle}
                  />
                </div>

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
                    <label style={labelStyle}>Template Type</label>
                    <select
                      value={uploadForm.template_type}
                      onChange={(e) =>
                        setUploadForm((prev) => ({
                          ...prev,
                          template_type: e.target.value,
                        }))
                      }
                      style={inputStyle}
                    >
                      <option value="daily">daily</option>
                      <option value="weekly">weekly</option>
                      <option value="monthly">monthly</option>
                      <option value="custom">custom</option>
                      <option value="accumulation">accumulation</option>
                    </select>
                  </div>

                  <div>
                    <label style={labelStyle}>Template Format</label>
                    <select
                      value={uploadForm.template_format}
                      onChange={(e) =>
                        setUploadForm((prev) => ({
                          ...prev,
                          template_format: e.target.value,
                        }))
                      }
                      style={inputStyle}
                    >
                      <option value="docx">docx</option>
                      <option value="html">html</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label style={labelStyle}>File</label>
                  <input
                    type="file"
                    accept={
                      uploadForm.template_format === "html"
                        ? ".html,text/html"
                        : ".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    }
                    onChange={(e) =>
                      setUploadForm((prev) => ({
                        ...prev,
                        file: e.target.files?.[0] || null,
                      }))
                    }
                    style={fileInputStyle}
                  />
                </div>

                <div>
                  <label style={labelStyle}>Notes</label>
                  <textarea
                    value={uploadForm.notes}
                    onChange={(e) =>
                      setUploadForm((prev) => ({
                        ...prev,
                        notes: e.target.value,
                      }))
                    }
                    rows={3}
                    style={{ ...inputStyle, minHeight: 90, paddingTop: 12 }}
                    placeholder="Optional notes"
                  />
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: isMobile ? "1fr" : "repeat(2, minmax(0, 1fr))",
                    gap: 10,
                  }}
                >
                  <label style={checkboxWrapStyle}>
                    <input
                      type="checkbox"
                      checked={!!uploadForm.is_default}
                      onChange={(e) =>
                        setUploadForm((prev) => ({
                          ...prev,
                          is_default: e.target.checked,
                        }))
                      }
                    />
                    Default template
                  </label>

                  <label style={checkboxWrapStyle}>
                    <input
                      type="checkbox"
                      checked={!!uploadForm.is_active}
                      onChange={(e) =>
                        setUploadForm((prev) => ({
                          ...prev,
                          is_active: e.target.checked,
                        }))
                      }
                    />
                    Active template
                  </label>
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: 10,
                    flexWrap: "wrap",
                  }}
                >
                  <button
                    type="submit"
                    disabled={uploading}
                    style={{
                      minHeight: 44,
                      padding: "0 16px",
                      borderRadius: 12,
                      border: "none",
                      background: ORANGE,
                      color: "#fff",
                      fontSize: 14,
                      fontWeight: 800,
                      cursor: uploading ? "not-allowed" : "pointer",
                      opacity: uploading ? 0.7 : 1,
                      width: isMobile ? "100%" : "auto",
                    }}
                  >
                    {uploading ? "Uploading..." : "Upload Template"}
                  </button>

                  <button
                    type="button"
                    onClick={resetUploadForm}
                    style={secondaryBtn(isMobile)}
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
              <h2
                style={{
                  margin: "0 0 14px",
                  color: TEXT,
                  fontSize: 18,
                  fontWeight: 800,
                }}
              >
                Edit Template
              </h2>

              <form onSubmit={handleEditSave} style={{ display: "grid", gap: 14 }}>
                <div>
                  <label style={labelStyle}>Name</label>
                  <input
                    value={editForm.name}
                    onChange={(e) =>
                      setEditForm((prev) => ({ ...prev, name: e.target.value }))
                    }
                    placeholder="Select a template first"
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label style={labelStyle}>Template Code</label>
                  <input
                    value={editForm.template_code}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        template_code: e.target.value,
                      }))
                    }
                    placeholder="Template code"
                    style={inputStyle}
                  />
                </div>

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
                    <label style={labelStyle}>Template Type</label>
                    <select
                      value={editForm.template_type}
                      onChange={(e) =>
                        setEditForm((prev) => ({
                          ...prev,
                          template_type: e.target.value,
                        }))
                      }
                      style={inputStyle}
                    >
                      <option value="daily">daily</option>
                      <option value="weekly">weekly</option>
                      <option value="monthly">monthly</option>
                      <option value="custom">custom</option>
                      <option value="accumulation">accumulation</option>
                    </select>
                  </div>

                  <div>
                    <label style={labelStyle}>Template Format</label>
                    <select
                      value={editForm.template_format}
                      onChange={(e) =>
                        setEditForm((prev) => ({
                          ...prev,
                          template_format: e.target.value,
                        }))
                      }
                      style={inputStyle}
                    >
                      <option value="docx">docx</option>
                      <option value="html">html</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label style={labelStyle}>Notes</label>
                  <textarea
                    value={editForm.notes}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        notes: e.target.value,
                      }))
                    }
                    rows={3}
                    style={{ ...inputStyle, minHeight: 90, paddingTop: 12 }}
                    placeholder="Optional notes"
                  />
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: isMobile ? "1fr" : "repeat(2, minmax(0, 1fr))",
                    gap: 10,
                  }}
                >
                  <label style={checkboxWrapStyle}>
                    <input
                      type="checkbox"
                      checked={!!editForm.is_default}
                      onChange={(e) =>
                        setEditForm((prev) => ({
                          ...prev,
                          is_default: e.target.checked,
                        }))
                      }
                    />
                    Default template
                  </label>

                  <label style={checkboxWrapStyle}>
                    <input
                      type="checkbox"
                      checked={!!editForm.is_active}
                      onChange={(e) =>
                        setEditForm((prev) => ({
                          ...prev,
                          is_active: e.target.checked,
                        }))
                      }
                    />
                    Active template
                  </label>
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: 10,
                    flexWrap: "wrap",
                  }}
                >
                  <button
                    type="submit"
                    disabled={savingEdit || !editForm.id}
                    style={{
                      minHeight: 44,
                      padding: "0 16px",
                      borderRadius: 12,
                      border: "none",
                      background: ORANGE,
                      color: "#fff",
                      fontSize: 14,
                      fontWeight: 800,
                      cursor:
                        savingEdit || !editForm.id ? "not-allowed" : "pointer",
                      opacity: savingEdit || !editForm.id ? 0.7 : 1,
                      width: isMobile ? "100%" : "auto",
                    }}
                  >
                    {savingEdit ? "Saving..." : "Update Template"}
                  </button>

                  <button
                    type="button"
                    onClick={resetEditForm}
                    style={secondaryBtn(isMobile)}
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
                    Template List
                  </h2>
                  <p
                    style={{
                      margin: "6px 0 0",
                      color: MUTED,
                      fontSize: 13,
                    }}
                  >
                    Search, preview placeholders, replace files, set defaults, and manage status.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={loadTemplates}
                  disabled={tableLoading}
                  style={secondaryBtn(isMobile)}
                >
                  {tableLoading ? "Refreshing..." : "Refresh"}
                </button>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: isMobile
                    ? "1fr"
                    : "minmax(180px, 1fr) 180px 160px 160px auto auto",
                  gap: 12,
                  marginBottom: 16,
                }}
              >
                <input
                  value={filters.search}
                  onChange={(e) =>
                    setFilters((prev) => ({ ...prev, search: e.target.value }))
                  }
                  placeholder="Search name, code, file..."
                  style={inputStyle}
                />

                <select
                  value={filters.template_type}
                  onChange={(e) =>
                    setFilters((prev) => ({
                      ...prev,
                      template_type: e.target.value,
                    }))
                  }
                  style={inputStyle}
                >
                  <option value="">All types</option>
                  <option value="daily">daily</option>
                  <option value="weekly">weekly</option>
                  <option value="monthly">monthly</option>
                  <option value="custom">custom</option>
                  <option value="accumulation">accumulation</option>
                </select>

                <select
                  value={filters.template_format}
                  onChange={(e) =>
                    setFilters((prev) => ({
                      ...prev,
                      template_format: e.target.value,
                    }))
                  }
                  style={inputStyle}
                >
                  <option value="">All formats</option>
                  <option value="docx">docx</option>
                  <option value="html">html</option>
                </select>

                <select
                  value={filters.is_default}
                  onChange={(e) =>
                    setFilters((prev) => ({
                      ...prev,
                      is_default: e.target.value,
                    }))
                  }
                  style={inputStyle}
                >
                  <option value="">Any default state</option>
                  <option value="true">Default only</option>
                  <option value="false">Not default</option>
                </select>

                <select
                  value={filters.is_active}
                  onChange={(e) =>
                    setFilters((prev) => ({
                      ...prev,
                      is_active: e.target.value,
                    }))
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

              {selectedPlaceholderTemplate ? (
                <div
                  style={{
                    border: `1px solid ${BORDER}`,
                    borderRadius: 16,
                    padding: 14,
                    background: "#fff",
                    marginBottom: 16,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 10,
                      flexWrap: "wrap",
                      alignItems: "center",
                      marginBottom: 10,
                    }}
                  >
                    <div
                      style={{
                        color: TEXT,
                        fontSize: 15,
                        fontWeight: 800,
                      }}
                    >
                      Placeholder Preview
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPlaceholderTemplate(null);
                        setSelectedPlaceholders([]);
                      }}
                      style={{
                        minHeight: 34,
                        padding: "0 10px",
                        borderRadius: 10,
                        border: `1px solid ${BORDER}`,
                        background: "#fff",
                        color: TEXT,
                        fontSize: 12,
                        fontWeight: 800,
                        cursor: "pointer",
                      }}
                    >
                      Close
                    </button>
                  </div>

                  {selectedPlaceholders.length === 0 ? (
                    <div
                      style={{
                        color: MUTED,
                        fontSize: 13,
                      }}
                    >
                      No placeholders found.
                    </div>
                  ) : (
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 10,
                      }}
                    >
                      {selectedPlaceholders.map((item, index) => (
                        <span
                          key={`${item}-${index}`}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            padding: "7px 10px",
                            borderRadius: 999,
                            background: ORANGE_SOFT,
                            color: ORANGE_DEEP,
                            fontSize: 12,
                            fontWeight: 700,
                            wordBreak: "break-word",
                          }}
                        >
                          {item}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}

              {templates.length === 0 ? (
                <div
                  style={{
                    border: `1px dashed ${BORDER}`,
                    borderRadius: 16,
                    padding: "22px 14px",
                    textAlign: "center",
                    color: MUTED,
                    fontSize: 14,
                    background: "#fff",
                  }}
                >
                  {tableLoading ? "Loading templates..." : "No templates found."}
                </div>
              ) : isMobile ? (
                <div style={{ display: "grid", gap: 12 }}>
                  {templates.map((template) => (
                    <div
                      key={template?.id}
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
                            {template?.name || "Unnamed Template"}
                          </div>
                          <div
                            style={{
                              color: MUTED,
                              fontSize: 12,
                              marginTop: 4,
                              wordBreak: "break-word",
                            }}
                          >
                            {template?.template_code || "—"}
                          </div>
                        </div>

                        <div
                          style={{
                            display: "flex",
                            gap: 8,
                            flexWrap: "wrap",
                            justifyContent: "flex-end",
                          }}
                        >
                          <DefaultPill isDefault={template?.is_default} />
                          <StatusPill
                            active={template?.is_active}
                            deleted={template?.is_deleted}
                          />
                        </div>
                      </div>

                      <div style={{ display: "grid", gap: 6, color: TEXT, fontSize: 13 }}>
                        <div>
                          <span style={mobileLabelStyle}>Type:</span>{" "}
                          {valueText(template?.template_type)}
                        </div>
                        <div>
                          <span style={mobileLabelStyle}>Format:</span>{" "}
                          {valueText(template?.template_format)}
                        </div>
                        <div>
                          <span style={mobileLabelStyle}>File:</span>{" "}
                          {valueText(template?.file_name)}
                        </div>
                        <div>
                          <span style={mobileLabelStyle}>Size:</span>{" "}
                          {formatFileSize(template?.file_size_bytes)}
                        </div>
                        <div>
                          <span style={mobileLabelStyle}>Placeholders:</span>{" "}
                          {placeholderCount(template)}
                        </div>
                        <div>
                          <span style={mobileLabelStyle}>Notes:</span>{" "}
                          {valueText(template?.notes)}
                        </div>
                      </div>

                      {!template?.is_deleted ? (
                        <div
                          style={{
                            marginTop: 14,
                            display: "grid",
                            gap: 10,
                          }}
                        >
                          <input
                            type="file"
                            accept={
                              template?.template_format === "html"
                                ? ".html,text/html"
                                : ".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                            }
                            onChange={(e) =>
                              setReplaceFiles((prev) => ({
                                ...prev,
                                [template.id]: e.target.files?.[0] || null,
                              }))
                            }
                            style={fileInputStyle}
                          />

                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                              gap: 10,
                            }}
                          >
                            <button
                              type="button"
                              onClick={() => startEdit(template)}
                              style={mobileActionBtn}
                            >
                              Edit
                            </button>

                            {!template?.is_default ? (
                              <button
                                type="button"
                                onClick={() => handleSetDefault(template?.id)}
                                disabled={settingDefaultId === template?.id}
                                style={mobileActionBtn}
                              >
                                {settingDefaultId === template?.id
                                  ? "Saving..."
                                  : "Set Default"}
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handlePreviewPlaceholders(template)}
                                disabled={placeholderLoadingId === template?.id}
                                style={mobileActionBtn}
                              >
                                {placeholderLoadingId === template?.id
                                  ? "Loading..."
                                  : "Placeholders"}
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => handleRefreshPlaceholders(template?.id)}
                              disabled={refreshingId === template?.id}
                              style={mobileActionBtn}
                            >
                              {refreshingId === template?.id
                                ? "Refreshing..."
                                : "Refresh Tags"}
                            </button>

                            <button
                              type="button"
                              onClick={() => handleReplaceFile(template?.id)}
                              disabled={replaceFileId === template?.id}
                              style={mobileActionBtn}
                            >
                              {replaceFileId === template?.id
                                ? "Replacing..."
                                : "Replace File"}
                            </button>

                            <button
                              type="button"
                              onClick={() => handlePreviewPlaceholders(template)}
                              disabled={placeholderLoadingId === template?.id}
                              style={mobileActionBtn}
                            >
                              {placeholderLoadingId === template?.id
                                ? "Loading..."
                                : "View Tags"}
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDelete(template?.id)}
                              disabled={deletingId === template?.id}
                              style={{ ...mobileActionBtn, color: RED }}
                            >
                              {deletingId === template?.id ? "Deleting..." : "Delete"}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "1fr",
                            gap: 10,
                            marginTop: 14,
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => handleRestore(template?.id)}
                            disabled={restoringId === template?.id}
                            style={{ ...mobileActionBtn, color: GREEN }}
                          >
                            {restoringId === template?.id ? "Restoring..." : "Restore"}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
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
                      minWidth: 1420,
                      borderCollapse: "collapse",
                      background: "#fff",
                    }}
                  >
                    <thead>
                      <tr style={{ background: "#f8fafc" }}>
                        {[
                          "Name",
                          "Code",
                          "Type",
                          "Format",
                          "File",
                          "Size",
                          "Placeholders",
                          "Default",
                          "Status",
                          "Replace File",
                          "Action",
                        ].map((head) => (
                          <th
                            key={head}
                            style={tableHeadStyle}
                          >
                            {head}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {templates.map((template) => (
                        <tr key={template?.id}>
                          <td style={cellStyleStrong}>{valueText(template?.name)}</td>
                          <td style={cellStyle}>{valueText(template?.template_code)}</td>
                          <td style={cellStyle}>{valueText(template?.template_type)}</td>
                          <td style={cellStyle}>{valueText(template?.template_format)}</td>
                          <td style={cellStyle}>{valueText(template?.file_name)}</td>
                          <td style={cellStyle}>{formatFileSize(template?.file_size_bytes)}</td>
                          <td style={cellStyle}>{placeholderCount(template)}</td>
                          <td style={cellStyle}>
                            <DefaultPill isDefault={template?.is_default} />
                          </td>
                          <td style={cellStyle}>
                            <StatusPill
                              active={template?.is_active}
                              deleted={template?.is_deleted}
                            />
                          </td>
                          <td style={cellStyle}>
                            {!template?.is_deleted ? (
                              <div style={{ display: "grid", gap: 8 }}>
                                <input
                                  type="file"
                                  accept={
                                    template?.template_format === "html"
                                      ? ".html,text/html"
                                      : ".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                                  }
                                  onChange={(e) =>
                                    setReplaceFiles((prev) => ({
                                      ...prev,
                                      [template.id]: e.target.files?.[0] || null,
                                    }))
                                  }
                                  style={fileInputStyle}
                                />
                                <button
                                  type="button"
                                  onClick={() => handleReplaceFile(template?.id)}
                                  disabled={replaceFileId === template?.id}
                                  style={smallActionBtn}
                                >
                                  {replaceFileId === template?.id
                                    ? "Replacing..."
                                    : "Replace"}
                                </button>
                              </div>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td style={cellStyle}>
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                              {!template?.is_deleted ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => startEdit(template)}
                                    style={actionBtn}
                                  >
                                    Edit
                                  </button>

                                  {!template?.is_default ? (
                                    <button
                                      type="button"
                                      onClick={() => handleSetDefault(template?.id)}
                                      disabled={settingDefaultId === template?.id}
                                      style={actionBtn}
                                    >
                                      {settingDefaultId === template?.id
                                        ? "Saving..."
                                        : "Set Default"}
                                    </button>
                                  ) : null}

                                  <button
                                    type="button"
                                    onClick={() => handleRefreshPlaceholders(template?.id)}
                                    disabled={refreshingId === template?.id}
                                    style={actionBtn}
                                  >
                                    {refreshingId === template?.id
                                      ? "Refreshing..."
                                      : "Refresh Tags"}
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handlePreviewPlaceholders(template)}
                                    disabled={placeholderLoadingId === template?.id}
                                    style={actionBtn}
                                  >
                                    {placeholderLoadingId === template?.id
                                      ? "Loading..."
                                      : "View Tags"}
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleDelete(template?.id)}
                                    disabled={deletingId === template?.id}
                                    style={{ ...actionBtn, color: RED }}
                                  >
                                    {deletingId === template?.id ? "Deleting..." : "Delete"}
                                  </button>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleRestore(template?.id)}
                                  disabled={restoringId === template?.id}
                                  style={{ ...actionBtn, color: GREEN }}
                                >
                                  {restoringId === template?.id ? "Restoring..." : "Restore"}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
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

function secondaryBtn(isMobile) {
  return {
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
  };
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

const fileInputStyle = {
  width: "100%",
  minHeight: 44,
  borderRadius: 12,
  border: `1px solid ${BORDER}`,
  padding: "10px 12px",
  fontSize: 13,
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

const checkboxWrapStyle = {
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
};

const tableHeadStyle = {
  textAlign: "left",
  padding: "13px 14px",
  borderBottom: `1px solid ${BORDER}`,
  color: TEXT,
  fontSize: 13,
  fontWeight: 800,
  whiteSpace: "nowrap",
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

const smallActionBtn = {
  minHeight: 32,
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