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
const PURPLE = "#7c3aed";
const PURPLE_SOFT = "rgba(124,58,237,0.10)";
const SHADOW = "0 10px 30px rgba(15, 23, 42, 0.06)";

const TEMPLATE_TYPE_OPTIONS = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "custom_period", label: "Custom Period" },
  { value: "accumulation", label: "Accumulation" },
];

const TEMPLATE_FORMAT_OPTIONS = [
  { value: "docx", label: "DOCX" },
  { value: "html", label: "HTML" },
];

const STORAGE_OPTIONS = [
  { value: "", label: "All storage" },
  { value: "database", label: "Database" },
  { value: "disk", label: "Disk" },
];

function humanize(value) {
  if (value === null || value === undefined || value === "") return "—";
  return String(value)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

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
  return String(value);
}

function templateAccept(format) {
  return format === "html"
    ? ".html,text/html"
    : ".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document";
}

function storageLabel(template) {
  if (template?.storage_label) return template.storage_label;
  if (template?.storage_backend === "database") return "Stored in database";
  return template?.file_path || "Stored on disk";
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
        minHeight: 30,
        padding: "4px 10px",
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
  if (!isDefault) return <span style={{ color: MUTED }}>—</span>;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: 30,
        padding: "4px 10px",
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

function StoragePill({ backend }) {
  const isDatabase = backend === "database";
  const background = isDatabase ? PURPLE_SOFT : BLUE_SOFT;
  const color = isDatabase ? PURPLE : BLUE;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: 30,
        padding: "4px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 800,
        background,
        color,
        whiteSpace: "nowrap",
      }}
    >
      {isDatabase ? "Database" : "Disk"}
    </span>
  );
}

function MetricCard({ title, value, color = TEXT, hint }) {
  return (
    <div className="metricCard">
      <div className="metricLabel">{title}</div>
      <div className="metricValue" style={{ color }}>
        {value}
      </div>
      {hint ? <div className="metricHint">{hint}</div> : null}
    </div>
  );
}

function TemplateMetaRow({ label, value, strong = false }) {
  return (
    <div className="metaRow">
      <span className="metaLabel">{label}</span>
      <span className={strong ? "metaValue strong" : "metaValue"}>{value}</span>
    </div>
  );
}

export default function ByproductsTemplatesPage() {
  const templateApi = ByproductsService.templates || ByproductsService;

  const [templates, setTemplates] = useState([]);
  const [total, setTotal] = useState(0);

  const [uploadForm, setUploadForm] = useState(emptyUploadForm());
  const [editForm, setEditForm] = useState(emptyEditForm());

  const [filters, setFilters] = useState({
    search: "",
    template_type: "",
    template_format: "",
    storage_backend: "",
    is_default: "",
    is_active: "",
    include_deleted: false,
  });
  const [searchInput, setSearchInput] = useState("");

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
    const timer = setTimeout(() => {
      setFilters((prev) => {
        if (prev.search === searchInput) return prev;
        return { ...prev, search: searchInput };
      });
    }, 300);

    return () => clearTimeout(timer);
  }, [searchInput]);

  const loadTemplates = useCallback(async () => {
    setTableLoading(true);
    setError("");

    try {
      const response = await templateApi.list({
        search: filters.search || undefined,
        template_type: filters.template_type || undefined,
        template_format: filters.template_format || undefined,
        storage_backend: filters.storage_backend || undefined,
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
  }, [filters, templateApi]);

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

    const databaseCount = templates.filter(
      (item) => item?.storage_backend === "database" && !item?.is_deleted
    ).length;

    return {
      activeCount,
      defaultCount,
      deletedCount,
      placeholderTotal,
      databaseCount,
    };
  }, [templates]);

  function resetUploadForm() {
    setUploadForm(emptyUploadForm());
  }

  function resetEditForm() {
    setEditForm(emptyEditForm());
  }

  function clearFilters() {
    setSearchInput("");
    setFilters({
      search: "",
      template_type: "",
      template_format: "",
      storage_backend: "",
      is_default: "",
      is_active: "",
      include_deleted: false,
    });
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

      await templateApi.upload({
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

      await templateApi.update(editForm.id, {
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
      await templateApi.setDefault(id);
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
      const response = await templateApi.refreshPlaceholders(id);
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
      const response = await templateApi.previewPlaceholders(template.id);
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
      await templateApi.replaceFile(templateId, file);
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
    const ok =
      typeof window !== "undefined"
        ? window.confirm("Delete this template?")
        : false;

    if (!ok) return;

    setDeletingId(id);
    setError("");
    setSuccess("");

    try {
      await templateApi.delete(id);
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
      await templateApi.restore(id);
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

      <div className="pageWrap">
        <div className="pageShell">
          <section className="heroCard">
            <div className="heroTop">
              <div className="heroCopy">
                <div className="eyebrow">Byproducts</div>
                <h1 className="pageTitle">Templates</h1>
                <p className="pageText">
                  Upload, edit, organize, replace, and preview byproducts report
                  templates. Templates stored in the database are now supported,
                  so file paths may be empty while the template still works.
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
                  title="Default"
                  value={loading ? "..." : summary.defaultCount}
                  color={BLUE}
                />
                <MetricCard
                  title="Database"
                  value={loading ? "..." : summary.databaseCount}
                  color={PURPLE}
                />
                <MetricCard
                  title="Placeholders"
                  value={loading ? "..." : summary.placeholderTotal}
                  color={ORANGE_DEEP}
                />
              </div>
            </div>

            {error ? <div className="banner bannerError">{error}</div> : null}
            {success ? <div className="banner bannerSuccess">{success}</div> : null}
          </section>

          <section className="formsGrid">
            <div className="panelCard">
              <div className="sectionHead">
                <h2 className="sectionTitle">Upload Template</h2>
                <p className="sectionText">
                  Add a new template file and its settings. Uploaded templates are
                  stored in the database automatically.
                </p>
              </div>

              <form onSubmit={handleUpload} className="formGrid">
                <div className="fieldBlock">
                  <label className="fieldLabel">Name</label>
                  <input
                    value={uploadForm.name}
                    onChange={(e) =>
                      setUploadForm((prev) => ({ ...prev, name: e.target.value }))
                    }
                    placeholder="Template name"
                    className="fieldInput"
                  />
                </div>

                <div className="fieldBlock">
                  <label className="fieldLabel">Template Code</label>
                  <input
                    value={uploadForm.template_code}
                    onChange={(e) =>
                      setUploadForm((prev) => ({
                        ...prev,
                        template_code: e.target.value,
                      }))
                    }
                    placeholder="e.g. OFFALS-DAILY-001"
                    className="fieldInput"
                  />
                </div>

                <div className="twoColGrid">
                  <div className="fieldBlock">
                    <label className="fieldLabel">Template Type</label>
                    <select
                      value={uploadForm.template_type}
                      onChange={(e) =>
                        setUploadForm((prev) => ({
                          ...prev,
                          template_type: e.target.value,
                        }))
                      }
                      className="fieldInput"
                    >
                      {TEMPLATE_TYPE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="fieldBlock">
                    <label className="fieldLabel">Template Format</label>
                    <select
                      value={uploadForm.template_format}
                      onChange={(e) =>
                        setUploadForm((prev) => ({
                          ...prev,
                          template_format: e.target.value,
                        }))
                      }
                      className="fieldInput"
                    >
                      {TEMPLATE_FORMAT_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="fieldBlock">
                  <label className="fieldLabel">File</label>
                  <input
                    type="file"
                    accept={templateAccept(uploadForm.template_format)}
                    onChange={(e) =>
                      setUploadForm((prev) => ({
                        ...prev,
                        file: e.target.files?.[0] || null,
                      }))
                    }
                    className="fileInput"
                  />
                </div>

                <div className="fieldBlock">
                  <label className="fieldLabel">Notes</label>
                  <textarea
                    value={uploadForm.notes}
                    onChange={(e) =>
                      setUploadForm((prev) => ({
                        ...prev,
                        notes: e.target.value,
                      }))
                    }
                    rows={4}
                    className="fieldTextarea"
                    placeholder="Optional notes"
                  />
                </div>

                <div className="twoColGrid">
                  <label className="checkTile">
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
                    <span>Default template</span>
                  </label>

                  <label className="checkTile">
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
                    <span>Active template</span>
                  </label>
                </div>

                <div className="buttonRow">
                  <button
                    type="submit"
                    disabled={uploading}
                    className="primaryButton"
                  >
                    {uploading ? "Uploading..." : "Upload Template"}
                  </button>

                  <button
                    type="button"
                    onClick={resetUploadForm}
                    className="secondaryButton"
                  >
                    Clear
                  </button>
                </div>
              </form>
            </div>

            <div className="panelCard">
              <div className="sectionHead">
                <h2 className="sectionTitle">Edit Template</h2>
                <p className="sectionText">
                  Select a template from the list below, then update its basic
                  details here.
                </p>
              </div>

              <form onSubmit={handleEditSave} className="formGrid">
                <div className="fieldBlock">
                  <label className="fieldLabel">Name</label>
                  <input
                    value={editForm.name}
                    onChange={(e) =>
                      setEditForm((prev) => ({ ...prev, name: e.target.value }))
                    }
                    placeholder="Select a template first"
                    className="fieldInput"
                  />
                </div>

                <div className="fieldBlock">
                  <label className="fieldLabel">Template Code</label>
                  <input
                    value={editForm.template_code}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        template_code: e.target.value,
                      }))
                    }
                    placeholder="Template code"
                    className="fieldInput"
                  />
                </div>

                <div className="twoColGrid">
                  <div className="fieldBlock">
                    <label className="fieldLabel">Template Type</label>
                    <select
                      value={editForm.template_type}
                      onChange={(e) =>
                        setEditForm((prev) => ({
                          ...prev,
                          template_type: e.target.value,
                        }))
                      }
                      className="fieldInput"
                    >
                      {TEMPLATE_TYPE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="fieldBlock">
                    <label className="fieldLabel">Template Format</label>
                    <select
                      value={editForm.template_format}
                      onChange={(e) =>
                        setEditForm((prev) => ({
                          ...prev,
                          template_format: e.target.value,
                        }))
                      }
                      className="fieldInput"
                    >
                      {TEMPLATE_FORMAT_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="fieldBlock">
                  <label className="fieldLabel">Notes</label>
                  <textarea
                    value={editForm.notes}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        notes: e.target.value,
                      }))
                    }
                    rows={4}
                    className="fieldTextarea"
                    placeholder="Optional notes"
                  />
                </div>

                <div className="twoColGrid">
                  <label className="checkTile">
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
                    <span>Default template</span>
                  </label>

                  <label className="checkTile">
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
                    <span>Active template</span>
                  </label>
                </div>

                <div className="buttonRow">
                  <button
                    type="submit"
                    disabled={savingEdit || !editForm.id}
                    className="primaryButton"
                  >
                    {savingEdit ? "Saving..." : "Update Template"}
                  </button>

                  <button
                    type="button"
                    onClick={resetEditForm}
                    className="secondaryButton"
                  >
                    Clear
                  </button>
                </div>
              </form>
            </div>
          </section>

          <section className="panelCard listCard">
            <div className="listTopBar">
              <div className="sectionHead compact">
                <h2 className="sectionTitle">Template List</h2>
                <p className="sectionText">
                  Search, preview placeholders, replace files, set defaults, and
                  manage status. Database-backed templates may not have a file path.
                </p>
              </div>

              <button
                type="button"
                onClick={loadTemplates}
                disabled={tableLoading}
                className="secondaryButton topButton"
              >
                {tableLoading ? "Refreshing..." : "Refresh"}
              </button>
            </div>

            <div className="filtersGrid">
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search name, code, file..."
                className="fieldInput"
              />

              <select
                value={filters.template_type}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    template_type: e.target.value,
                  }))
                }
                className="fieldInput"
              >
                <option value="">All types</option>
                {TEMPLATE_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              <select
                value={filters.template_format}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    template_format: e.target.value,
                  }))
                }
                className="fieldInput"
              >
                <option value="">All formats</option>
                {TEMPLATE_FORMAT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              <select
                value={filters.storage_backend}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    storage_backend: e.target.value,
                  }))
                }
                className="fieldInput"
              >
                {STORAGE_OPTIONS.map((option) => (
                  <option key={option.value || "all"} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              <select
                value={filters.is_default}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    is_default: e.target.value,
                  }))
                }
                className="fieldInput"
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
                className="fieldInput"
              >
                <option value="">All statuses</option>
                <option value="true">Active only</option>
                <option value="false">Inactive only</option>
              </select>

              <label className="checkTile filterCheck">
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

              <button
                type="button"
                onClick={clearFilters}
                className="secondaryButton"
              >
                Clear Filters
              </button>
            </div>

            {selectedPlaceholderTemplate ? (
              <div className="previewBox">
                <div className="previewHead">
                  <div className="previewTitle">Placeholder Preview</div>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPlaceholderTemplate(null);
                      setSelectedPlaceholders([]);
                    }}
                    className="secondarySmallButton"
                  >
                    Close
                  </button>
                </div>

                {selectedPlaceholders.length === 0 ? (
                  <div className="emptyMiniText">No placeholders found.</div>
                ) : (
                  <div className="chipsWrap">
                    {selectedPlaceholders.map((item, index) => (
                      <span key={`${item}-${index}`} className="chip">
                        {item}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ) : null}

            {templates.length === 0 ? (
              <div className="emptyState">
                {tableLoading ? "Loading templates..." : "No templates found."}
              </div>
            ) : (
              <>
                <div className="desktopOnly">
                  <div className="tableWrap">
                    <table className="dataTable">
                      <thead>
                        <tr>
                          {[
                            "Name",
                            "Code",
                            "Type",
                            "Format",
                            "Storage",
                            "File",
                            "Location",
                            "Size",
                            "Placeholders",
                            "Default",
                            "Status",
                            "Replace File",
                            "Action",
                          ].map((head) => (
                            <th key={head}>{head}</th>
                          ))}
                        </tr>
                      </thead>

                      <tbody>
                        {templates.map((template) => (
                          <tr key={template?.id}>
                            <td className="strongCell">{valueText(template?.name)}</td>
                            <td>{valueText(template?.template_code)}</td>
                            <td>{humanize(template?.template_type)}</td>
                            <td>{humanize(template?.template_format)}</td>
                            <td>
                              <StoragePill backend={template?.storage_backend} />
                            </td>
                            <td>{valueText(template?.file_name)}</td>
                            <td className="mutedCell">{storageLabel(template)}</td>
                            <td>{formatFileSize(template?.file_size_bytes)}</td>
                            <td>{placeholderCount(template)}</td>
                            <td>
                              <DefaultPill isDefault={template?.is_default} />
                            </td>
                            <td>
                              <StatusPill
                                active={template?.is_active}
                                deleted={template?.is_deleted}
                              />
                            </td>
                            <td>
                              {!template?.is_deleted ? (
                                <div className="replaceBlock">
                                  <input
                                    type="file"
                                    accept={templateAccept(template?.template_format)}
                                    onChange={(e) =>
                                      setReplaceFiles((prev) => ({
                                        ...prev,
                                        [template.id]: e.target.files?.[0] || null,
                                      }))
                                    }
                                    className="fileInput"
                                  />

                                  <button
                                    type="button"
                                    onClick={() => handleReplaceFile(template?.id)}
                                    disabled={replaceFileId === template?.id}
                                    className="secondarySmallButton blueText"
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
                            <td>
                              <div className="actionGroup">
                                {!template?.is_deleted ? (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => startEdit(template)}
                                      className="secondarySmallButton blueText"
                                    >
                                      Edit
                                    </button>

                                    {!template?.is_default ? (
                                      <button
                                        type="button"
                                        onClick={() => handleSetDefault(template?.id)}
                                        disabled={settingDefaultId === template?.id}
                                        className="secondarySmallButton blueText"
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
                                      className="secondarySmallButton blueText"
                                    >
                                      {refreshingId === template?.id
                                        ? "Refreshing..."
                                        : "Refresh Tags"}
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => handlePreviewPlaceholders(template)}
                                      disabled={placeholderLoadingId === template?.id}
                                      className="secondarySmallButton blueText"
                                    >
                                      {placeholderLoadingId === template?.id
                                        ? "Loading..."
                                        : "View Tags"}
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => handleDelete(template?.id)}
                                      disabled={deletingId === template?.id}
                                      className="secondarySmallButton redText"
                                    >
                                      {deletingId === template?.id
                                        ? "Deleting..."
                                        : "Delete"}
                                    </button>
                                  </>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleRestore(template?.id)}
                                    disabled={restoringId === template?.id}
                                    className="secondarySmallButton greenText"
                                  >
                                    {restoringId === template?.id
                                      ? "Restoring..."
                                      : "Restore"}
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="mobileOnly">
                  <div className="mobileCardList">
                    {templates.map((template) => (
                      <article key={template?.id} className="mobileTemplateCard">
                        <div className="mobileCardTop">
                          <div className="mobileCardTitleWrap">
                            <h3 className="mobileCardTitle">
                              {valueText(template?.name)}
                            </h3>
                            <div className="mobileCodeText">
                              {valueText(template?.template_code)}
                            </div>
                          </div>

                          <div className="mobilePills">
                            <StoragePill backend={template?.storage_backend} />
                            <DefaultPill isDefault={template?.is_default} />
                            <StatusPill
                              active={template?.is_active}
                              deleted={template?.is_deleted}
                            />
                          </div>
                        </div>

                        <div className="mobileMetaGrid">
                          <TemplateMetaRow
                            label="Type"
                            value={humanize(template?.template_type)}
                          />
                          <TemplateMetaRow
                            label="Format"
                            value={humanize(template?.template_format)}
                          />
                          <TemplateMetaRow
                            label="File"
                            value={valueText(template?.file_name)}
                            strong
                          />
                          <TemplateMetaRow
                            label="Storage"
                            value={storageLabel(template)}
                          />
                          <TemplateMetaRow
                            label="Size"
                            value={formatFileSize(template?.file_size_bytes)}
                          />
                          <TemplateMetaRow
                            label="Placeholders"
                            value={placeholderCount(template)}
                          />
                        </div>

                        {!template?.is_deleted ? (
                          <div className="replacePanel">
                            <div className="replaceLabel">Replace File</div>
                            <input
                              type="file"
                              accept={templateAccept(template?.template_format)}
                              onChange={(e) =>
                                setReplaceFiles((prev) => ({
                                  ...prev,
                                  [template.id]: e.target.files?.[0] || null,
                                }))
                              }
                              className="fileInput"
                            />
                            <button
                              type="button"
                              onClick={() => handleReplaceFile(template?.id)}
                              disabled={replaceFileId === template?.id}
                              className="secondaryButton mobileFullButton"
                            >
                              {replaceFileId === template?.id
                                ? "Replacing..."
                                : "Replace File"}
                            </button>
                          </div>
                        ) : null}

                        <div className="mobileActions">
                          {!template?.is_deleted ? (
                            <>
                              <button
                                type="button"
                                onClick={() => startEdit(template)}
                                className="secondaryButton mobileHalfButton"
                              >
                                Edit
                              </button>

                              {!template?.is_default ? (
                                <button
                                  type="button"
                                  onClick={() => handleSetDefault(template?.id)}
                                  disabled={settingDefaultId === template?.id}
                                  className="secondaryButton mobileHalfButton"
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
                                className="secondaryButton mobileHalfButton"
                              >
                                {refreshingId === template?.id
                                  ? "Refreshing..."
                                  : "Refresh Tags"}
                              </button>

                              <button
                                type="button"
                                onClick={() => handlePreviewPlaceholders(template)}
                                disabled={placeholderLoadingId === template?.id}
                                className="secondaryButton mobileHalfButton"
                              >
                                {placeholderLoadingId === template?.id
                                  ? "Loading..."
                                  : "View Tags"}
                              </button>

                              <button
                                type="button"
                                onClick={() => handleDelete(template?.id)}
                                disabled={deletingId === template?.id}
                                className="secondaryButton mobileFullButton deleteButton"
                              >
                                {deletingId === template?.id ? "Deleting..." : "Delete"}
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleRestore(template?.id)}
                              disabled={restoringId === template?.id}
                              className="secondaryButton mobileFullButton restoreButton"
                            >
                              {restoringId === template?.id ? "Restoring..." : "Restore"}
                            </button>
                          )}
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              </>
            )}
          </section>
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
          max-width: 1500px;
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
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(360px, 560px);
          gap: 18px;
          align-items: start;
        }

        .eyebrow {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 30px;
          padding: 0 12px;
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
          font-size: 30px;
          line-height: 1.12;
          font-weight: 800;
        }

        .pageText {
          margin: 10px 0 0;
          color: ${MUTED};
          font-size: 14px;
          line-height: 1.75;
          max-width: 860px;
        }

        .metricsGrid {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 12px;
          min-width: 0;
        }

        .metricCard {
          border: 1px solid ${BORDER};
          border-radius: 18px;
          padding: 14px;
          background: ${SURFACE};
          min-width: 0;
        }

        .metricLabel {
          color: ${MUTED};
          font-size: 12px;
          font-weight: 700;
        }

        .metricValue {
          margin-top: 6px;
          font-size: 24px;
          line-height: 1.1;
          font-weight: 800;
          color: ${TEXT};
          word-break: break-word;
        }

        .metricHint {
          margin-top: 6px;
          color: ${MUTED};
          font-size: 11px;
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

        .formsGrid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 18px;
          align-items: start;
        }

        .listCard {
          width: 100%;
        }

        .sectionHead {
          margin-bottom: 14px;
        }

        .sectionHead.compact {
          margin-bottom: 0;
        }

        .sectionTitle {
          margin: 0;
          color: ${TEXT};
          font-size: 19px;
          line-height: 1.2;
          font-weight: 800;
        }

        .sectionText {
          margin: 6px 0 0;
          color: ${MUTED};
          font-size: 13px;
          line-height: 1.65;
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
          display: block;
          color: ${TEXT};
          font-size: 13px;
          font-weight: 700;
          margin-bottom: 6px;
        }

        .fieldInput,
        .fileInput,
        .fieldTextarea {
          width: 100%;
          border: 1px solid ${BORDER};
          border-radius: 12px;
          background: #ffffff;
          color: ${TEXT};
          font-size: 14px;
          outline: none;
          box-sizing: border-box;
          font-family: Arial, sans-serif;
        }

        .fieldInput {
          min-height: 46px;
          padding: 0 14px;
        }

        .fileInput {
          min-height: 46px;
          padding: 10px 12px;
          font-size: 13px;
        }

        .fieldTextarea {
          min-height: 110px;
          padding: 12px 14px;
          resize: vertical;
        }

        .checkTile {
          min-height: 46px;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 0 12px;
          border: 1px solid ${BORDER};
          border-radius: 12px;
          background: #ffffff;
          color: ${TEXT};
          font-size: 13px;
          font-weight: 700;
          box-sizing: border-box;
        }

        .checkTile input {
          margin: 0;
          flex: 0 0 auto;
        }

        .buttonRow {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }

        .primaryButton,
        .secondaryButton,
        .secondarySmallButton {
          border-radius: 12px;
          font-family: Arial, sans-serif;
          font-weight: 800;
          cursor: pointer;
          transition: transform 0.15s ease, opacity 0.15s ease;
        }

        .primaryButton:hover,
        .secondaryButton:hover,
        .secondarySmallButton:hover {
          transform: translateY(-1px);
        }

        .primaryButton:disabled,
        .secondaryButton:disabled,
        .secondarySmallButton:disabled {
          opacity: 0.7;
          cursor: not-allowed;
          transform: none;
        }

        .primaryButton {
          min-height: 46px;
          padding: 0 16px;
          border: none;
          background: ${ORANGE};
          color: #ffffff;
          font-size: 14px;
        }

        .secondaryButton {
          min-height: 46px;
          padding: 0 16px;
          border: 1px solid ${BORDER};
          background: #ffffff;
          color: ${TEXT};
          font-size: 14px;
        }

        .secondarySmallButton {
          min-height: 34px;
          padding: 0 10px;
          border: 1px solid ${BORDER};
          background: #ffffff;
          color: ${TEXT};
          font-size: 12px;
          border-radius: 10px;
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
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
          margin-bottom: 16px;
        }

        .topButton {
          flex: 0 0 auto;
        }

        .filtersGrid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
          margin-bottom: 16px;
        }

        .filterCheck {
          min-height: 46px;
        }

        .previewBox {
          border: 1px solid ${BORDER};
          border-radius: 16px;
          padding: 14px;
          background: #ffffff;
          margin-bottom: 16px;
        }

        .previewHead {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          flex-wrap: wrap;
          margin-bottom: 10px;
        }

        .previewTitle {
          color: ${TEXT};
          font-size: 15px;
          font-weight: 800;
        }

        .chipsWrap {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }

        .chip {
          display: inline-flex;
          align-items: center;
          min-height: 32px;
          padding: 0 10px;
          border-radius: 999px;
          background: ${ORANGE_SOFT};
          color: ${ORANGE_DEEP};
          font-size: 12px;
          font-weight: 700;
          word-break: break-word;
          max-width: 100%;
        }

        .emptyMiniText {
          color: ${MUTED};
          font-size: 13px;
        }

        .emptyState {
          border: 1px dashed ${BORDER};
          border-radius: 16px;
          padding: 24px 16px;
          text-align: center;
          color: ${MUTED};
          font-size: 14px;
          background: #ffffff;
        }

        .tableWrap {
          overflow-x: auto;
          border-radius: 16px;
          border: 1px solid ${BORDER};
        }

        .dataTable {
          width: 100%;
          min-width: 1500px;
          border-collapse: collapse;
          background: #ffffff;
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

        .mutedCell {
          color: ${MUTED};
          min-width: 220px;
          word-break: break-word;
        }

        .replaceBlock {
          display: grid;
          gap: 8px;
          min-width: 180px;
        }

        .actionGroup {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .mobileCardList {
          display: grid;
          gap: 14px;
        }

        .mobileTemplateCard {
          border: 1px solid ${BORDER};
          border-radius: 18px;
          padding: 14px;
          background: #ffffff;
          box-shadow: 0 2px 10px rgba(15, 23, 42, 0.03);
        }

        .mobileCardTop {
          display: grid;
          gap: 12px;
          margin-bottom: 12px;
        }

        .mobileCardTitleWrap {
          min-width: 0;
        }

        .mobileCardTitle {
          margin: 0;
          color: ${TEXT};
          font-size: 17px;
          line-height: 1.25;
          font-weight: 800;
          word-break: break-word;
        }

        .mobileCodeText {
          margin-top: 4px;
          color: ${MUTED};
          font-size: 12px;
          font-weight: 700;
          word-break: break-word;
        }

        .mobilePills {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .mobileMetaGrid {
          display: grid;
          gap: 10px;
          margin-bottom: 14px;
        }

        .metaRow {
          display: grid;
          grid-template-columns: 110px minmax(0, 1fr);
          gap: 10px;
          align-items: start;
          padding: 10px 0;
          border-top: 1px solid ${BORDER};
        }

        .metaLabel {
          color: ${MUTED};
          font-size: 12px;
          font-weight: 700;
        }

        .metaValue {
          color: ${TEXT};
          font-size: 13px;
          line-height: 1.5;
          word-break: break-word;
        }

        .metaValue.strong {
          font-weight: 800;
        }

        .replacePanel {
          display: grid;
          gap: 10px;
          border-top: 1px solid ${BORDER};
          padding-top: 12px;
          margin-top: 2px;
        }

        .replaceLabel {
          color: ${TEXT};
          font-size: 13px;
          font-weight: 800;
        }

        .mobileActions {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 12px;
          border-top: 1px solid ${BORDER};
          padding-top: 12px;
        }

        .mobileHalfButton {
          flex: 1 1 calc(50% - 5px);
        }

        .mobileFullButton {
          width: 100%;
        }

        .deleteButton {
          color: ${RED};
        }

        .restoreButton {
          color: ${GREEN};
        }

        .desktopOnly {
          display: block;
        }

        .mobileOnly {
          display: none;
        }

        @media (max-width: 1240px) {
          .heroTop {
            grid-template-columns: 1fr;
          }

          .metricsGrid {
            grid-template-columns: repeat(5, minmax(0, 1fr));
          }

          .filtersGrid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }

        @media (max-width: 980px) {
          .pageWrap {
            padding: 14px 12px 28px;
          }

          .heroCard {
            padding: 16px;
            border-radius: 22px;
          }

          .panelCard {
            padding: 16px;
            border-radius: 22px;
          }

          .pageTitle {
            font-size: 25px;
          }

          .pageText {
            font-size: 13px;
            line-height: 1.7;
          }

          .metricsGrid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .formsGrid {
            grid-template-columns: 1fr;
          }

          .filtersGrid,
          .twoColGrid {
            grid-template-columns: 1fr;
          }

          .buttonRow {
            flex-direction: column;
          }

          .primaryButton,
          .secondaryButton {
            width: 100%;
          }

          .desktopOnly {
            display: none;
          }

          .mobileOnly {
            display: block;
          }
        }

        @media (max-width: 560px) {
          .metricValue {
            font-size: 21px;
          }

          .mobileHalfButton {
            flex-basis: 100%;
          }

          .metaRow {
            grid-template-columns: 1fr;
            gap: 4px;
          }
        }
      `}</style>
    </>
  );
}