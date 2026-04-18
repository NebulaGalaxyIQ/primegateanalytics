import Link from "next/link";
import { useRouter } from "next/router";
import { useCallback, useEffect, useMemo, useState } from "react";
import SaaSService from "../../services/saas";

const PAGE_BG = "#ffffff";
const SURFACE = "#ffffff";
const BORDER = "#e5e7eb";
const TEXT = "#111827";
const MUTED = "#6b7280";
const ORANGE = "#ff7a00";
const ORANGE_DEEP = "#ea6a00";
const BLUE = "#2563eb";
const GREEN = "#16a34a";
const RED = "#dc2626";
const SOFT = "#f8fafc";
const HEADER_BG = "#f3f4f6";

const DEFAULT_UNIT_PRICE_PER_HEAD = "1.845";
const DEFAULT_UNIT_PRICE_OFFAL = "3.69";
const DEFAULT_ZERO_TEXT = "0";

const ANIMAL_OPTIONS = ["0", "Goats", "Sheep", "Goats/sheep", "Cattle", "Mixed"];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function money2(value) {
  return toNumber(value, 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function money3(value) {
  return toNumber(value, 0).toLocaleString(undefined, {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
}

function intFmt(value) {
  return toNumber(value, 0).toLocaleString();
}

function prettyDate(value) {
  if (!value) return "—";
  const parts = String(value).split("-");
  if (parts.length !== 3) return String(value);
  return `${Number(parts[2])}/${Number(parts[1])}/${parts[0]}`;
}

function prettyDateTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString();
}

function normalizeError(error, fallback = "Something went wrong.") {
  const detail = error?.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail.length) {
    return detail.map((item) => item?.msg || item?.message || String(item)).join(", ");
  }
  return error?.message || fallback;
}

function computePreview(form) {
  const animals = Math.max(0, toNumber(form.total_animals, 0));
  const perHead = Math.max(0, toNumber(form.unit_price_per_head_usd, 0));
  const offal = Math.max(0, toNumber(form.unit_price_offal_usd, 0));

  const totalRevenue = animals * perHead;
  const totalOffalRevenue = animals * offal;
  const totalCombinedRevenue = totalRevenue + totalOffalRevenue;

  return {
    totalRevenue,
    totalOffalRevenue,
    totalCombinedRevenue,
  };
}

function emptyFormState() {
  return {
    service_date: todayISO(),
    client_name: DEFAULT_ZERO_TEXT,
    animal_type: DEFAULT_ZERO_TEXT,
    total_animals: "0",
    unit_price_per_head_usd: DEFAULT_UNIT_PRICE_PER_HEAD,
    unit_price_offal_usd: DEFAULT_UNIT_PRICE_OFFAL,
    notes: "",
    is_active: true,
  };
}

function mapRecordToForm(record) {
  return {
    service_date: record?.service_date || todayISO(),
    client_name: record?.client_name || DEFAULT_ZERO_TEXT,
    animal_type: record?.animal_type || DEFAULT_ZERO_TEXT,
    total_animals: String(record?.total_animals ?? 0),
    unit_price_per_head_usd: String(
      record?.unit_price_per_head_usd ?? DEFAULT_UNIT_PRICE_PER_HEAD
    ),
    unit_price_offal_usd: String(
      record?.unit_price_offal_usd ?? DEFAULT_UNIT_PRICE_OFFAL
    ),
    notes: record?.notes || "",
    is_active: record?.is_active !== false,
  };
}

function Field({ label, required, children }) {
  return (
    <label style={{ display: "grid", gap: 8 }}>
      <span
        style={{
          fontSize: 13,
          color: TEXT,
          fontWeight: 700,
          fontFamily: "Arial, sans-serif",
        }}
      >
        {label} {required ? <span style={{ color: RED }}>*</span> : null}
      </span>
      {children}
    </label>
  );
}

function PreviewBox({ label, value, color = TEXT }) {
  return (
    <div
      style={{
        border: `1px solid ${BORDER}`,
        borderRadius: 12,
        padding: 14,
        background: "#fff",
      }}
    >
      <div style={{ fontSize: 12, color: MUTED, marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 20, color, fontWeight: 700 }}>{value}</div>
    </div>
  );
}

function DetailRow({ label, value }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "220px 1fr",
        gap: 14,
        padding: "12px 0",
        borderBottom: `1px solid ${BORDER}`,
      }}
    >
      <div
        style={{
          color: MUTED,
          fontSize: 13,
          fontWeight: 700,
          fontFamily: "Arial, sans-serif",
        }}
      >
        {label}
      </div>
      <div
        style={{
          color: TEXT,
          fontSize: 14,
          fontFamily: "Arial, sans-serif",
          wordBreak: "break-word",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function StatusPill({ active }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "5px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
        color: active ? GREEN : RED,
        background: active ? "rgba(22,163,74,0.10)" : "rgba(220,38,38,0.10)",
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: active ? GREEN : RED,
          display: "inline-block",
        }}
      />
      {active ? "Active" : "Inactive"}
    </span>
  );
}

function buttonStyle(variant = "primary") {
  const base = {
    height: 42,
    borderRadius: 12,
    padding: "0 16px",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: 14,
    fontFamily: "Arial, sans-serif",
    whiteSpace: "nowrap",
  };

  if (variant === "secondary") {
    return {
      ...base,
      background: "#fff",
      color: TEXT,
      border: `1px solid ${BORDER}`,
    };
  }

  if (variant === "secondaryBlue") {
    return {
      ...base,
      background: "#fff",
      color: BLUE,
      border: `1px solid rgba(37,99,235,0.22)`,
    };
  }

  if (variant === "danger") {
    return {
      ...base,
      background: "#fff",
      color: ORANGE_DEEP,
      border: `1px solid rgba(234,106,0,0.22)`,
    };
  }

  if (variant === "success") {
    return {
      ...base,
      background: "#fff",
      color: GREEN,
      border: `1px solid rgba(22,163,74,0.22)`,
    };
  }

  return {
    ...base,
    background: ORANGE,
    color: "#fff",
    border: `1px solid ${ORANGE}`,
  };
}

function tabButtonStyle(active) {
  return {
    height: 40,
    padding: "0 16px",
    borderRadius: 999,
    border: active ? `1px solid ${ORANGE}` : `1px solid ${BORDER}`,
    background: active ? "rgba(255,122,0,0.10)" : "#fff",
    color: active ? ORANGE_DEEP : TEXT,
    fontWeight: 700,
    fontSize: 13,
    cursor: "pointer",
    fontFamily: "Arial, sans-serif",
  };
}

const inputStyle = {
  width: "100%",
  height: 44,
  borderRadius: 12,
  border: `1px solid ${BORDER}`,
  background: "#fff",
  color: TEXT,
  padding: "0 12px",
  fontSize: 14,
  outline: "none",
  fontFamily: "Arial, sans-serif",
  boxSizing: "border-box",
};

const textareaStyle = {
  ...inputStyle,
  height: "auto",
  minHeight: 96,
  padding: 12,
  resize: "vertical",
};

const formGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 14,
};

export default function SaaSRecordDetailsPage() {
  const router = useRouter();
  const rawId = router.query?.id;
  const saasId = Array.isArray(rawId) ? rawId[0] : rawId;

  const [activeTab, setActiveTab] = useState("details");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [record, setRecord] = useState(null);
  const [form, setForm] = useState(emptyFormState());
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const preview = useMemo(() => computePreview(form), [form]);

  const loadRecord = useCallback(async () => {
    if (!saasId) return;

    setLoading(true);
    setError("");
    try {
      const data = await SaaSService.get(saasId);
      setRecord(data || null);
      setForm(mapRecordToForm(data || null));
    } catch (err) {
      setError(normalizeError(err, "Failed to load slaughter service record."));
    } finally {
      setLoading(false);
    }
  }, [saasId]);

  useEffect(() => {
    if (router.isReady && saasId) {
      loadRecord();
    }
  }, [router.isReady, saasId, loadRecord]);

  const handleFormChange = useCallback((key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleReset = useCallback(() => {
    if (record) {
      setForm(mapRecordToForm(record));
    } else {
      setForm(emptyFormState());
    }
  }, [record]);

  const handleSave = useCallback(
    async (event) => {
      event.preventDefault();
      if (!saasId) return;

      setSaving(true);
      setError("");
      setMessage("");

      try {
        const payload = {
          service_date: form.service_date,
          client_name: form.client_name || DEFAULT_ZERO_TEXT,
          animal_type: form.animal_type || DEFAULT_ZERO_TEXT,
          total_animals: Number(form.total_animals || 0),
          unit_price_per_head_usd: Number(
            form.unit_price_per_head_usd || DEFAULT_UNIT_PRICE_PER_HEAD
          ),
          unit_price_offal_usd: Number(
            form.unit_price_offal_usd || DEFAULT_UNIT_PRICE_OFFAL
          ),
          notes: form.notes || null,
          is_active: !!form.is_active,
        };

        const updated = await SaaSService.update(saasId, payload);
        setRecord(updated || null);
        setForm(mapRecordToForm(updated || null));
        setMessage("Record updated successfully.");
        setActiveTab("details");
      } catch (err) {
        setError(normalizeError(err, "Failed to update record."));
      } finally {
        setSaving(false);
      }
    },
    [form, saasId]
  );

  const handleSoftDelete = useCallback(async () => {
    if (!saasId || !record) return;

    const ok =
      typeof window === "undefined"
        ? true
        : window.confirm(`Soft delete record for ${record?.client_name || "this client"}?`);

    if (!ok) return;

    setError("");
    setMessage("");

    try {
      const updated = await SaaSService.softDelete(saasId);
      setRecord(updated || null);
      setForm(mapRecordToForm(updated || null));
      setMessage("Record deleted successfully.");
    } catch (err) {
      setError(normalizeError(err, "Failed to delete record."));
    }
  }, [record, saasId]);

  const handleRestore = useCallback(async () => {
    if (!saasId) return;

    setError("");
    setMessage("");

    try {
      const updated = await SaaSService.restore(saasId);
      setRecord(updated || null);
      setForm(mapRecordToForm(updated || null));
      setMessage("Record restored successfully.");
    } catch (err) {
      setError(normalizeError(err, "Failed to restore record."));
    }
  }, [saasId]);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: PAGE_BG,
        padding: "20px 20px 36px",
        fontFamily: "Arial, sans-serif",
        color: TEXT,
      }}
    >
      <div style={{ width: "100%", maxWidth: 1500, margin: "0 auto" }}>
        <div
          style={{
            background: SURFACE,
            border: `1px solid ${BORDER}`,
            borderRadius: 18,
            padding: 22,
            marginBottom: 18,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: 14,
              flexWrap: "wrap",
            }}
          >
            <div>
              <h1
                style={{
                  margin: 0,
                  fontSize: 26,
                  lineHeight: 1.1,
                  fontWeight: 700,
                  color: TEXT,
                }}
              >
                Slaughter Service Record
              </h1>
              <div style={{ marginTop: 8, fontSize: 14, color: MUTED }}>
                View and update one slaughter service record.
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Link href="/saas" style={{ textDecoration: "none" }}>
                <button type="button" style={buttonStyle("secondaryBlue")}>
                  Back to list
                </button>
              </Link>

              {record?.is_active ? (
                <button type="button" onClick={handleSoftDelete} style={buttonStyle("danger")}>
                  Delete
                </button>
              ) : (
                <button type="button" onClick={handleRestore} style={buttonStyle("success")}>
                  Restore
                </button>
              )}
            </div>
          </div>
        </div>

        {(message || error) && (
          <div
            style={{
              marginBottom: 18,
              padding: "14px 16px",
              borderRadius: 14,
              border: `1px solid ${
                error ? "rgba(220,38,38,0.22)" : "rgba(22,163,74,0.22)"
              }`,
              background: error ? "rgba(220,38,38,0.06)" : "rgba(22,163,74,0.06)",
              color: error ? RED : GREEN,
              fontSize: 14,
              fontWeight: 700,
            }}
          >
            {error || message}
          </div>
        )}

        <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => setActiveTab("details")}
            style={tabButtonStyle(activeTab === "details")}
          >
            Record details
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("edit")}
            style={tabButtonStyle(activeTab === "edit")}
          >
            Edit record
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("revenues")}
            style={tabButtonStyle(activeTab === "revenues")}
          >
            Revenue preview
          </button>
        </div>

        {loading ? (
          <div
            style={{
              background: SURFACE,
              border: `1px solid ${BORDER}`,
              borderRadius: 18,
              padding: 24,
              color: MUTED,
              fontSize: 14,
            }}
          >
            Loading record...
          </div>
        ) : !record ? (
          <div
            style={{
              background: SURFACE,
              border: `1px solid ${BORDER}`,
              borderRadius: 18,
              padding: 24,
              color: MUTED,
              fontSize: 14,
            }}
          >
            Record not found.
          </div>
        ) : (
          <>
            {activeTab === "details" && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1.15fr 0.85fr",
                  gap: 18,
                  alignItems: "start",
                }}
              >
                <div
                  style={{
                    background: SURFACE,
                    border: `1px solid ${BORDER}`,
                    borderRadius: 18,
                    padding: 20,
                  }}
                >
                  <div
                    style={{
                      fontSize: 18,
                      fontWeight: 700,
                      color: TEXT,
                      marginBottom: 14,
                    }}
                  >
                    Record details
                  </div>

                  <DetailRow label="ID" value={record?.id || "—"} />
                  <DetailRow label="Service date" value={prettyDate(record?.service_date)} />
                  <DetailRow label="Client name" value={record?.client_name || "0"} />
                  <DetailRow label="Animal type" value={record?.animal_type || "0"} />
                  <DetailRow label="Total animals" value={intFmt(record?.total_animals)} />
                  <DetailRow
                    label="Unit price per head (USD)"
                    value={`$${money3(record?.unit_price_per_head_usd)}`}
                  />
                  <DetailRow
                    label="Unit price offal (USD)"
                    value={`$${money3(record?.unit_price_offal_usd)}`}
                  />
                  <DetailRow label="Notes" value={record?.notes || "—"} />
                  <DetailRow
                    label="Created at"
                    value={prettyDateTime(record?.created_at)}
                  />
                  <DetailRow
                    label="Updated at"
                    value={prettyDateTime(record?.updated_at)}
                  />
                </div>

                <div
                  style={{
                    background: SURFACE,
                    border: `1px solid ${BORDER}`,
                    borderRadius: 18,
                    padding: 20,
                  }}
                >
                  <div
                    style={{
                      fontSize: 18,
                      fontWeight: 700,
                      color: TEXT,
                      marginBottom: 14,
                    }}
                  >
                    Status and totals
                  </div>

                  <div style={{ marginBottom: 16 }}>
                    <StatusPill active={record?.is_active !== false} />
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr",
                      gap: 12,
                    }}
                  >
                    <PreviewBox
                      label="Service revenue USD"
                      value={`$${money2(record?.total_revenue_usd)}`}
                      color={ORANGE_DEEP}
                    />
                    <PreviewBox
                      label="Offal revenue USD"
                      value={`$${money2(record?.total_offal_revenue_usd)}`}
                      color={BLUE}
                    />
                    <PreviewBox
                      label="Combined revenue USD"
                      value={`$${money2(record?.total_combined_revenue_usd)}`}
                      color={GREEN}
                    />
                  </div>
                </div>
              </div>
            )}

            {activeTab === "edit" && (
              <div
                style={{
                  background: SURFACE,
                  border: `1px solid ${BORDER}`,
                  borderRadius: 18,
                  padding: 20,
                }}
              >
                <div
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    color: TEXT,
                    marginBottom: 14,
                  }}
                >
                  Edit record
                </div>

                <form onSubmit={handleSave}>
                  <div style={formGridStyle}>
                    <Field label="Service date" required>
                      <input
                        type="date"
                        value={form.service_date}
                        onChange={(e) => handleFormChange("service_date", e.target.value)}
                        style={inputStyle}
                        required
                      />
                    </Field>

                    <Field label="Client name">
                      <input
                        type="text"
                        value={form.client_name}
                        onChange={(e) => handleFormChange("client_name", e.target.value)}
                        style={inputStyle}
                        placeholder="0"
                      />
                    </Field>

                    <Field label="Animal type">
                      <input
                        list="animal-types-detail"
                        value={form.animal_type}
                        onChange={(e) => handleFormChange("animal_type", e.target.value)}
                        style={inputStyle}
                        placeholder="0"
                      />
                      <datalist id="animal-types-detail">
                        {ANIMAL_OPTIONS.map((option) => (
                          <option key={option} value={option} />
                        ))}
                      </datalist>
                    </Field>

                    <Field label="Total animals" required>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={form.total_animals}
                        onChange={(e) => handleFormChange("total_animals", e.target.value)}
                        style={inputStyle}
                        placeholder="0"
                        required
                      />
                    </Field>

                    <Field label="Unit price per head (USD)" required>
                      <input
                        type="number"
                        min="0"
                        step="0.001"
                        value={form.unit_price_per_head_usd}
                        onChange={(e) =>
                          handleFormChange("unit_price_per_head_usd", e.target.value)
                        }
                        style={inputStyle}
                        placeholder={DEFAULT_UNIT_PRICE_PER_HEAD}
                        required
                      />
                    </Field>

                    <Field label="Unit price offal (USD)" required>
                      <input
                        type="number"
                        min="0"
                        step="0.001"
                        value={form.unit_price_offal_usd}
                        onChange={(e) => handleFormChange("unit_price_offal_usd", e.target.value)}
                        style={inputStyle}
                        placeholder={DEFAULT_UNIT_PRICE_OFFAL}
                        required
                      />
                    </Field>
                  </div>

                  <div style={{ marginTop: 14 }}>
                    <Field label="Notes">
                      <textarea
                        value={form.notes}
                        onChange={(e) => handleFormChange("notes", e.target.value)}
                        style={textareaStyle}
                        placeholder="Optional notes"
                      />
                    </Field>
                  </div>

                  <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 10 }}>
                    <label
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 8,
                        color: TEXT,
                        fontSize: 14,
                        fontWeight: 700,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={!!form.is_active}
                        onChange={(e) => handleFormChange("is_active", e.target.checked)}
                      />
                      Active record
                    </label>
                  </div>

                  <div style={{ marginTop: 18, display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <button type="submit" style={buttonStyle("primary")} disabled={saving}>
                      {saving ? "Saving..." : "Update record"}
                    </button>

                    <button type="button" onClick={handleReset} style={buttonStyle("secondary")}>
                      Reset changes
                    </button>
                  </div>
                </form>
              </div>
            )}

            {activeTab === "revenues" && (
              <div
                style={{
                  background: SURFACE,
                  border: `1px solid ${BORDER}`,
                  borderRadius: 18,
                  padding: 20,
                }}
              >
                <div
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    color: TEXT,
                    marginBottom: 14,
                  }}
                >
                  Revenue preview
                </div>

                <div
                  style={{
                    marginBottom: 16,
                    overflowX: "auto",
                  }}
                >
                  <table
                    style={{
                      width: "100%",
                      minWidth: 900,
                      borderCollapse: "collapse",
                      fontFamily: "Arial, sans-serif",
                    }}
                  >
                    <thead>
                      <tr>
                        {[
                          "Date",
                          "Client",
                          "Animal type",
                          "Animals",
                          "Unit/head",
                          "Service revenue",
                          "Unit offal",
                          "Offal revenue",
                          "Combined revenue",
                        ].map((head) => (
                          <th
                            key={head}
                            style={{
                              padding: "12px 10px",
                              borderBottom: `1px solid ${BORDER}`,
                              textAlign: "left",
                              fontSize: 13,
                              color: TEXT,
                              fontWeight: 700,
                              background: HEADER_BG,
                              whiteSpace: "nowrap",
                            }}
                          >
                            {head}
                          </th>
                        ))}
                      </tr>
                    </thead>

                    <tbody>
                      <tr>
                        <td
                          style={{
                            padding: "12px 10px",
                            borderBottom: `1px solid ${BORDER}`,
                            fontSize: 13,
                            color: TEXT,
                            textAlign: "left",
                          }}
                        >
                          {prettyDate(form.service_date)}
                        </td>
                        <td
                          style={{
                            padding: "12px 10px",
                            borderBottom: `1px solid ${BORDER}`,
                            fontSize: 13,
                            color: TEXT,
                            textAlign: "left",
                          }}
                        >
                          {form.client_name || "0"}
                        </td>
                        <td
                          style={{
                            padding: "12px 10px",
                            borderBottom: `1px solid ${BORDER}`,
                            fontSize: 13,
                            color: TEXT,
                            textAlign: "left",
                          }}
                        >
                          {form.animal_type || "0"}
                        </td>
                        <td style={{ ...tdStyleRight }}>{intFmt(form.total_animals)}</td>
                        <td style={{ ...tdStyleRight }}>
                          ${money3(form.unit_price_per_head_usd)}
                        </td>
                        <td style={{ ...tdStyleRight }}>
                          ${money2(preview.totalRevenue)}
                        </td>
                        <td style={{ ...tdStyleRight }}>
                          ${money3(form.unit_price_offal_usd)}
                        </td>
                        <td style={{ ...tdStyleRight }}>
                          ${money2(preview.totalOffalRevenue)}
                        </td>
                        <td style={{ ...tdStyleRight, fontWeight: 700 }}>
                          ${money2(preview.totalCombinedRevenue)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: 12,
                  }}
                >
                  <PreviewBox
                    label="Service revenue USD"
                    value={`$${money2(preview.totalRevenue)}`}
                    color={ORANGE_DEEP}
                  />
                  <PreviewBox
                    label="Offal revenue USD"
                    value={`$${money2(preview.totalOffalRevenue)}`}
                    color={BLUE}
                  />
                  <PreviewBox
                    label="Combined revenue USD"
                    value={`$${money2(preview.totalCombinedRevenue)}`}
                    color={GREEN}
                  />
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}