import Head from "next/head";
import { useEffect, useMemo, useRef, useState } from "react";

import breakevenService from "../../services/breakeven";

const PAGE_BG = "#ffffff";
const CARD_BG = "#ffffff";
const TEXT = "#111827";
const MUTED = "#6b7280";
const BORDER = "#e5e7eb";
const SOFT = "#f9fafb";
const SOFT_2 = "#f3f4f6";
const BLUE = "#2563eb";
const BLUE_DARK = "#1d4ed8";
const GREEN = "#15803d";
const RED = "#b91c1c";
const ORANGE = "#f97316";
const ORANGE_SOFT = "rgba(249,115,22,0.10)";
const GREEN_SOFT = "rgba(21,128,61,0.10)";
const RED_SOFT = "rgba(185,28,28,0.08)";

const SCOPE_TYPE_OPTIONS = [
  { label: "Global", value: "global" },
  { label: "Monthly", value: "monthly" },
];

function getTodayIsoDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDecimal(value, decimals = 2) {
  if (value === null || value === undefined || value === "") {
    return Number(0).toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  }

  const num = Number(value);
  if (Number.isNaN(num)) return String(value);

  return num.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function formatMoney(value) {
  return `$${formatDecimal(value, 2)}`;
}

function formatPercent(value) {
  return `${formatDecimal(value, 2)}%`;
}

function formatDate(value) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);

  return parsed.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function normalizeFormNumber(value) {
  if (value === "" || value === null || value === undefined) return undefined;
  const num = Number(value);
  return Number.isNaN(num) ? undefined : num;
}

function getScopeLabel(setting) {
  if (!setting) return "-";
  if (setting.scope_type === "monthly") {
    return `Monthly${
      setting.month && setting.year ? ` (${setting.month}/${setting.year})` : ""
    }`;
  }
  return "Global";
}

function SectionTitle({ title, subtitle }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div
        style={{
          fontSize: 16,
          fontWeight: 700,
          color: TEXT,
          marginBottom: 6,
        }}
      >
        {title}
      </div>
      {subtitle ? (
        <div
          style={{
            fontSize: 13,
            color: MUTED,
            lineHeight: 1.6,
          }}
        >
          {subtitle}
        </div>
      ) : null}
    </div>
  );
}

function SummaryCard({ label, value, sub, accent = BLUE }) {
  return (
    <div className="be-summary-card">
      <div
        style={{
          width: 38,
          height: 6,
          borderRadius: 999,
          background: accent,
          marginBottom: 10,
        }}
      />
      <div
        style={{
          fontSize: 12,
          color: MUTED,
          marginBottom: 8,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 22,
          lineHeight: 1.1,
          fontWeight: 700,
          color: TEXT,
          wordBreak: "break-word",
        }}
      >
        {value}
      </div>
      {sub ? (
        <div
          style={{
            fontSize: 12,
            color: MUTED,
            marginTop: 6,
            lineHeight: 1.5,
          }}
        >
          {sub}
        </div>
      ) : null}
    </div>
  );
}

function EmptyBlock({ text }) {
  return (
    <div
      style={{
        border: `1px solid ${BORDER}`,
        borderRadius: 14,
        background: PAGE_BG,
        padding: 18,
        color: MUTED,
        fontSize: 13,
      }}
    >
      {text}
    </div>
  );
}

function Toggle({ checked, onChange, label }) {
  return (
    <label
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        fontSize: 13,
        color: TEXT,
        cursor: "pointer",
        userSelect: "none",
        flexWrap: "wrap",
      }}
    >
      <input
        type="checkbox"
        checked={Boolean(checked)}
        onChange={(e) => onChange(e.target.checked)}
        style={{ accentColor: BLUE }}
      />
      <span>{label}</span>
    </label>
  );
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="be-tab-button"
      style={{
        border: `1px solid ${active ? "rgba(249,115,22,0.24)" : BORDER}`,
        background: active ? ORANGE_SOFT : PAGE_BG,
        color: active ? ORANGE : TEXT,
      }}
    >
      {children}
    </button>
  );
}

function SettingBadge({ setting }) {
  const active = Boolean(setting?.is_active);

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "5px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
        whiteSpace: "nowrap",
        background: active ? GREEN_SOFT : SOFT,
        color: active ? GREEN : MUTED,
      }}
    >
      {active ? "Active" : "Inactive"}
    </span>
  );
}

function InfoRow({ label, value }) {
  return (
    <div style={settingInfoRowStyle}>
      <span style={settingInfoLabelStyle}>{label}</span>
      <span style={settingInfoValueStyle}>{value}</span>
    </div>
  );
}

function MetricRowTable({ rows }) {
  if (!rows?.length) {
    return <EmptyBlock text="No breakeven rows available for the selected setup." />;
  }

  return (
    <div
      style={{
        border: `1px solid ${BORDER}`,
        borderRadius: 14,
        overflow: "hidden",
        background: PAGE_BG,
      }}
    >
      <div
        style={{
          padding: "12px 14px",
          borderBottom: `1px solid ${BORDER}`,
          background: SOFT,
          fontSize: 14,
          fontWeight: 700,
          color: TEXT,
        }}
      >
        Breakeven Summary Table
      </div>

      <div className="be-desktop-table-wrap">
        <table className="be-desktop-table">
          <thead>
            <tr>
              {["Index", "Metric", "Quantity (Tonnes)", "USD (Total)", "Percentage"].map(
                (head) => (
                  <th key={head} style={tableHeadStyle}>
                    {head}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.index}-${row.metric}`}>
                <td style={tableCellStyle}>{row.index}</td>
                <td style={{ ...tableCellStyle, fontWeight: 600 }}>{row.metric}</td>
                <td style={tableCellStyle}>
                  {row.quantity_display ||
                    (row.quantity_tonnes !== null && row.quantity_tonnes !== undefined
                      ? formatDecimal(row.quantity_tonnes)
                      : "-")}
                </td>
                <td style={tableCellStyle}>
                  {row.usd_display ||
                    (row.usd_total !== null && row.usd_total !== undefined
                      ? formatMoney(row.usd_total)
                      : "-")}
                </td>
                <td style={tableCellStyle}>
                  {row.percentage_display ||
                    (row.percentage !== null && row.percentage !== undefined
                      ? formatPercent(row.percentage)
                      : "-")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="be-mobile-card-list">
        {rows.map((row) => (
          <div key={`mobile-${row.index}-${row.metric}`} className="be-mobile-table-card">
            <div className="be-mobile-card-top">
              <div className="be-mobile-card-title">{row.metric}</div>
              <div className="be-mobile-card-index">#{row.index}</div>
            </div>

            <div className="be-mobile-kv">
              <span>Quantity</span>
              <strong>
                {row.quantity_display ||
                  (row.quantity_tonnes !== null && row.quantity_tonnes !== undefined
                    ? formatDecimal(row.quantity_tonnes)
                    : "-")}
              </strong>
            </div>

            <div className="be-mobile-kv">
              <span>USD Total</span>
              <strong>
                {row.usd_display ||
                  (row.usd_total !== null && row.usd_total !== undefined
                    ? formatMoney(row.usd_total)
                    : "-")}
              </strong>
            </div>

            <div className="be-mobile-kv">
              <span>Percentage</span>
              <strong>
                {row.percentage_display ||
                  (row.percentage !== null && row.percentage !== undefined
                    ? formatPercent(row.percentage)
                    : "-")}
              </strong>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SettingsTable({
  settings,
  isLoadingSettings,
  isTogglingSettingId,
  startEditSetting,
  toggleSettingActive,
}) {
  return (
    <div
      style={{
        border: `1px solid ${BORDER}`,
        borderRadius: 14,
        overflow: "hidden",
        background: PAGE_BG,
      }}
    >
      <div
        style={{
          padding: "12px 14px",
          borderBottom: `1px solid ${BORDER}`,
          background: SOFT,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 700, color: TEXT }}>Settings List</div>

        <div style={{ fontSize: 12, color: MUTED }}>
          {isLoadingSettings ? "Loading settings..." : `${settings.length} setting(s)`}
        </div>
      </div>

      <div className="be-desktop-table-wrap">
        <table className="be-desktop-table">
          <thead>
            <tr>
              {[
                "Name",
                "Scope",
                "Month / Year",
                "Break Even Tonnes",
                "USD / Tonne",
                "Break Even Value",
                "Status",
                "Actions",
              ].map((head) => (
                <th key={head} style={tableHeadStyle}>
                  {head}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {settings.length ? (
              settings.map((item) => {
                const isBusy = isTogglingSettingId === item.id;

                return (
                  <tr key={item.id}>
                    <td style={{ ...tableCellStyle, fontWeight: 600 }}>
                      {item.setting_name || "-"}
                    </td>
                    <td style={tableCellStyle}>
                      {item.scope_type === "monthly" ? "Monthly" : "Global"}
                    </td>
                    <td style={tableCellStyle}>
                      {item.scope_type === "monthly"
                        ? `${item.month || "-"} / ${item.year || "-"}`
                        : "-"}
                    </td>
                    <td style={tableCellStyle}>
                      {formatDecimal(item.break_even_quantity_tonnes)}
                    </td>
                    <td style={tableCellStyle}>
                      {formatDecimal(item.break_even_usd_per_tonne, 4)}
                    </td>
                    <td style={tableCellStyle}>{formatMoney(item.break_even_value_usd)}</td>
                    <td style={tableCellStyle}>
                      <SettingBadge setting={item} />
                    </td>
                    <td style={tableCellStyle}>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button
                          type="button"
                          onClick={() => startEditSetting(item)}
                          style={miniButtonStyle(BLUE)}
                        >
                          Edit
                        </button>

                        {item.is_active ? (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => toggleSettingActive(item, false)}
                            style={miniButtonStyle(RED)}
                          >
                            {isBusy ? "Working..." : "Deactivate"}
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => toggleSettingActive(item, true)}
                            style={miniButtonStyle(GREEN)}
                          >
                            {isBusy ? "Working..." : "Activate"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td
                  colSpan={8}
                  style={{
                    padding: 20,
                    textAlign: "center",
                    color: MUTED,
                  }}
                >
                  No breakeven settings available.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="be-mobile-card-list">
        {settings.length ? (
          settings.map((item) => {
            const isBusy = isTogglingSettingId === item.id;

            return (
              <div key={`mobile-${item.id}`} className="be-mobile-table-card">
                <div className="be-mobile-card-top">
                  <div className="be-mobile-card-title">{item.setting_name || "-"}</div>
                  <SettingBadge setting={item} />
                </div>

                <div className="be-mobile-kv">
                  <span>Scope</span>
                  <strong>{getScopeLabel(item)}</strong>
                </div>

                <div className="be-mobile-kv">
                  <span>Break Even Tonnes</span>
                  <strong>{formatDecimal(item.break_even_quantity_tonnes)}</strong>
                </div>

                <div className="be-mobile-kv">
                  <span>USD per Tonne</span>
                  <strong>{formatDecimal(item.break_even_usd_per_tonne, 4)}</strong>
                </div>

                <div className="be-mobile-kv">
                  <span>Break Even Value</span>
                  <strong>{formatMoney(item.break_even_value_usd)}</strong>
                </div>

                <div className="be-mobile-actions">
                  <button
                    type="button"
                    onClick={() => startEditSetting(item)}
                    style={miniButtonStyle(BLUE)}
                  >
                    Edit
                  </button>

                  {item.is_active ? (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => toggleSettingActive(item, false)}
                      style={miniButtonStyle(RED)}
                    >
                      {isBusy ? "Working..." : "Deactivate"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => toggleSettingActive(item, true)}
                      style={miniButtonStyle(GREEN)}
                    >
                      {isBusy ? "Working..." : "Activate"}
                    </button>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div style={{ padding: 16, color: MUTED, fontSize: 13 }}>
            No breakeven settings available.
          </div>
        )}
      </div>
    </div>
  );
}

export default function BreakevenIndexPage() {
  const now = useMemo(() => new Date(), []);
  const previewUrlRef = useRef("");

  const [activeTab, setActiveTab] = useState("summary");

  const [reportDate, setReportDate] = useState(getTodayIsoDate());
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [year, setYear] = useState(String(now.getFullYear()));
  const [settingId, setSettingId] = useState("");
  const [preparedBy, setPreparedBy] = useState("");
  const [includeRows, setIncludeRows] = useState(true);

  const [reportData, setReportData] = useState(null);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState("");
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isDownloading, setIsDownloading] = useState("");
  const [summaryError, setSummaryError] = useState("");

  const [settings, setSettings] = useState([]);
  const [isLoadingSettings, setIsLoadingSettings] = useState(false);
  const [settingsError, setSettingsError] = useState("");
  const [isSavingSetting, setIsSavingSetting] = useState(false);
  const [isTogglingSettingId, setIsTogglingSettingId] = useState("");

  const [editingSettingId, setEditingSettingId] = useState("");
  const [settingName, setSettingName] = useState("");
  const [settingDescription, setSettingDescription] = useState("");
  const [scopeType, setScopeType] = useState("monthly");
  const [settingMonth, setSettingMonth] = useState(String(now.getMonth() + 1));
  const [settingYear, setSettingYear] = useState(String(now.getFullYear()));
  const [breakEvenQuantityTonnes, setBreakEvenQuantityTonnes] = useState("133.70");
  const [breakEvenUsdPerTonne, setBreakEvenUsdPerTonne] = useState("578.5116");
  const [settingNotes, setSettingNotes] = useState("");
  const [settingIsActive, setSettingIsActive] = useState(true);

  const summaryParams = useMemo(
    () => ({
      report_date: reportDate || undefined,
      month: normalizeFormNumber(month),
      year: normalizeFormNumber(year),
      setting_id: settingId || undefined,
      prepared_by: preparedBy || undefined,
      include_rows: includeRows,
    }),
    [reportDate, month, year, settingId, preparedBy, includeRows]
  );

  const computedBreakEvenValue = useMemo(() => {
    const qty = Number(breakEvenQuantityTonnes || 0);
    const usdPerTonne = Number(breakEvenUsdPerTonne || 0);

    if (Number.isNaN(qty) || Number.isNaN(usdPerTonne)) return 0;
    return qty * usdPerTonne;
  }, [breakEvenQuantityTonnes, breakEvenUsdPerTonne]);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
    };
  }, []);

  async function loadSettings() {
    setIsLoadingSettings(true);
    setSettingsError("");

    try {
      const data = await breakevenService.listBreakevenSettings();
      setSettings(Array.isArray(data) ? data : []);
    } catch (error) {
      setSettingsError(error?.message || "Failed to load breakeven settings");
    } finally {
      setIsLoadingSettings(false);
    }
  }

  async function loadSummary() {
    setIsLoadingSummary(true);
    setSummaryError("");

    try {
      const data = await breakevenService.getBreakevenSummaryData(summaryParams);
      setReportData(data);
    } catch (error) {
      setSummaryError(error?.message || "Failed to load breakeven summary");
    } finally {
      setIsLoadingSummary(false);
    }
  }

  async function loadPdfPreview() {
    setIsLoadingPreview(true);
    setSummaryError("");

    try {
      const result = await breakevenService.exportBreakevenSummary({
        ...summaryParams,
        format: "pdf",
      });

      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }

      const url = URL.createObjectURL(result.blob);
      previewUrlRef.current = url;
      setPdfPreviewUrl(url);
    } catch (error) {
      setSummaryError(error?.message || "Failed to load PDF preview");
    } finally {
      setIsLoadingPreview(false);
    }
  }

  async function downloadSummary(format) {
    setIsDownloading(format);
    setSummaryError("");

    try {
      await breakevenService.downloadBreakevenSummary({
        ...summaryParams,
        format,
      });
    } catch (error) {
      setSummaryError(
        error?.message || `Failed to download ${String(format).toUpperCase()} file`
      );
    } finally {
      setIsDownloading("");
    }
  }

  function clearSettingForm() {
    setEditingSettingId("");
    setSettingName("");
    setSettingDescription("");
    setScopeType("monthly");
    setSettingMonth(String(now.getMonth() + 1));
    setSettingYear(String(now.getFullYear()));
    setBreakEvenQuantityTonnes("133.70");
    setBreakEvenUsdPerTonne("578.5116");
    setSettingNotes("");
    setSettingIsActive(true);
    setSettingsError("");
  }

  function startEditSetting(setting) {
    setEditingSettingId(setting.id || "");
    setSettingName(setting.setting_name || "");
    setSettingDescription(setting.description || "");
    setScopeType(setting.scope_type || "monthly");
    setSettingMonth(
      setting.month !== null && setting.month !== undefined ? String(setting.month) : ""
    );
    setSettingYear(
      setting.year !== null && setting.year !== undefined ? String(setting.year) : ""
    );
    setBreakEvenQuantityTonnes(
      setting.break_even_quantity_tonnes !== null &&
        setting.break_even_quantity_tonnes !== undefined
        ? String(setting.break_even_quantity_tonnes)
        : ""
    );
    setBreakEvenUsdPerTonne(
      setting.break_even_usd_per_tonne !== null &&
        setting.break_even_usd_per_tonne !== undefined
        ? String(setting.break_even_usd_per_tonne)
        : ""
    );
    setSettingNotes(setting.notes || "");
    setSettingIsActive(Boolean(setting.is_active));
    setActiveTab("settings");
    setSettingsError("");
  }

  async function saveSetting() {
    setIsSavingSetting(true);
    setSettingsError("");

    try {
      const payload = {
        setting_name: settingName,
        description: settingDescription || undefined,
        scope_type: scopeType,
        month: scopeType === "monthly" ? normalizeFormNumber(settingMonth) : undefined,
        year: scopeType === "monthly" ? normalizeFormNumber(settingYear) : undefined,
        break_even_quantity_tonnes: normalizeFormNumber(breakEvenQuantityTonnes),
        break_even_usd_per_tonne: normalizeFormNumber(breakEvenUsdPerTonne),
        notes: settingNotes || undefined,
        is_active: settingIsActive,
      };

      if (editingSettingId) {
        await breakevenService.updateBreakevenSetting(editingSettingId, payload);
      } else {
        await breakevenService.createBreakevenSetting(payload);
      }

      await loadSettings();
      clearSettingForm();
    } catch (error) {
      setSettingsError(error?.message || "Failed to save breakeven setting");
    } finally {
      setIsSavingSetting(false);
    }
  }

  async function toggleSettingActive(setting, nextActiveState) {
    if (!setting?.id) return;

    setIsTogglingSettingId(setting.id);
    setSettingsError("");

    try {
      if (nextActiveState) {
        await breakevenService.activateBreakevenSetting(setting.id);
      } else {
        await breakevenService.deactivateBreakevenSetting(setting.id);
      }

      await loadSettings();
    } catch (error) {
      setSettingsError(error?.message || "Failed to update setting status");
    } finally {
      setIsTogglingSettingId("");
    }
  }

  useEffect(() => {
    loadSettings();
    loadSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totals = reportData?.totals || {};
  const selectedSetting = reportData?.setting || null;
  const activeSettings = settings.filter((item) => item.is_active);

  return (
    <>
      <Head>
        <title>Breakeven | UMG</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div
        style={{
          minHeight: "100vh",
          background: PAGE_BG,
          color: TEXT,
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div className="be-shell">
          <div className="be-topbar">
            <div className="be-title-block">
              <div
                style={{
                  fontSize: 24,
                  fontWeight: 700,
                  color: TEXT,
                  marginBottom: 6,
                  wordBreak: "break-word",
                }}
              >
                Breakeven
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: MUTED,
                  lineHeight: 1.6,
                  maxWidth: 760,
                }}
              >
                Review the live monthly breakeven summary, preview downloads, and manage
                monthly or global breakeven settings from one page.
              </div>
            </div>

            {activeTab === "summary" ? (
              <div className="be-actions">
                <button
                  type="button"
                  onClick={loadSummary}
                  disabled={isLoadingSummary}
                  style={secondaryButtonStyle(isLoadingSummary, BLUE)}
                >
                  {isLoadingSummary ? "Loading..." : "Refresh Data"}
                </button>

                <button
                  type="button"
                  onClick={loadPdfPreview}
                  disabled={isLoadingPreview}
                  style={primaryButtonStyle(isLoadingPreview)}
                >
                  {isLoadingPreview ? "Preparing PDF..." : "Preview PDF"}
                </button>

                <button
                  type="button"
                  onClick={() => downloadSummary("csv")}
                  disabled={Boolean(isDownloading)}
                  style={secondaryButtonStyle(Boolean(isDownloading), TEXT)}
                >
                  {isDownloading === "csv" ? "Downloading..." : "CSV"}
                </button>

                <button
                  type="button"
                  onClick={() => downloadSummary("pdf")}
                  disabled={Boolean(isDownloading)}
                  style={secondaryButtonStyle(Boolean(isDownloading), TEXT)}
                >
                  {isDownloading === "pdf" ? "Downloading..." : "PDF"}
                </button>

                <button
                  type="button"
                  onClick={() => downloadSummary("docx")}
                  disabled={Boolean(isDownloading)}
                  style={secondaryButtonStyle(Boolean(isDownloading), TEXT)}
                >
                  {isDownloading === "docx" ? "Downloading..." : "Word"}
                </button>
              </div>
            ) : (
              <div className="be-actions">
                <button
                  type="button"
                  onClick={loadSettings}
                  disabled={isLoadingSettings}
                  style={secondaryButtonStyle(isLoadingSettings, BLUE)}
                >
                  {isLoadingSettings ? "Loading..." : "Refresh Settings"}
                </button>

                <button
                  type="button"
                  onClick={clearSettingForm}
                  style={secondaryButtonStyle(false, TEXT)}
                >
                  Clear Form
                </button>

                <button
                  type="button"
                  onClick={saveSetting}
                  disabled={isSavingSetting}
                  style={primaryButtonStyle(isSavingSetting)}
                >
                  {isSavingSetting
                    ? editingSettingId
                      ? "Updating..."
                      : "Saving..."
                    : editingSettingId
                    ? "Update Setting"
                    : "Create Setting"}
                </button>
              </div>
            )}
          </div>

          <div className="be-panel">
            <div className="be-tabs">
              <TabButton
                active={activeTab === "summary"}
                onClick={() => setActiveTab("summary")}
              >
                Breakeven Summary
              </TabButton>

              <TabButton
                active={activeTab === "settings"}
                onClick={() => setActiveTab("settings")}
              >
                Breakeven Settings
              </TabButton>
            </div>
          </div>

          {activeTab === "summary" ? (
            <>
              <div className="be-panel">
                <SectionTitle
                  title="Breakeven Summary Controls"
                  subtitle="Only breakeven-related options are shown here."
                />

                <div className="be-form-grid be-form-grid-summary">
                  <div>
                    <label style={fieldLabelStyle}>Report Date</label>
                    <input
                      type="date"
                      value={reportDate}
                      onChange={(e) => setReportDate(e.target.value)}
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label style={fieldLabelStyle}>Month</label>
                    <input
                      type="number"
                      min={1}
                      max={12}
                      value={month}
                      onChange={(e) => setMonth(e.target.value)}
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label style={fieldLabelStyle}>Year</label>
                    <input
                      type="number"
                      min={2000}
                      value={year}
                      onChange={(e) => setYear(e.target.value)}
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label style={fieldLabelStyle}>Setting to Use</label>
                    <select
                      value={settingId}
                      onChange={(e) => setSettingId(e.target.value)}
                      style={inputStyle}
                    >
                      <option value="">Auto resolve active setting</option>
                      {settings.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.setting_name}
                          {item.scope_type === "monthly" && item.month && item.year
                            ? ` (${item.month}/${item.year})`
                            : " (Global)"}
                          {item.is_active ? " - Active" : ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={fieldLabelStyle}>Prepared By</label>
                    <input
                      type="text"
                      value={preparedBy}
                      onChange={(e) => setPreparedBy(e.target.value)}
                      placeholder="Prepared by"
                      style={inputStyle}
                    />
                  </div>
                </div>

                <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 14 }}>
                  <Toggle
                    checked={includeRows}
                    onChange={setIncludeRows}
                    label="Include summary rows"
                  />
                </div>
              </div>

              {summaryError ? (
                <div
                  style={{
                    border: `1px solid rgba(185,28,28,0.18)`,
                    background: RED_SOFT,
                    color: RED,
                    borderRadius: 12,
                    padding: "12px 14px",
                    fontSize: 13,
                    marginBottom: 18,
                  }}
                >
                  {summaryError}
                </div>
              ) : null}

              <div className="be-summary-grid">
                <SummaryCard
                  label="Break Even Quantity"
                  value={`${formatDecimal(totals.break_even_quantity_tonnes)} tonnes`}
                  accent={ORANGE}
                />
                <SummaryCard
                  label="Break Even Value"
                  value={formatMoney(totals.break_even_value_usd)}
                  accent={ORANGE}
                />
                <SummaryCard
                  label="Total Booked Quantity"
                  value={`${formatDecimal(totals.total_booked_quantity_tonnes)} tonnes`}
                  accent={BLUE}
                />
                <SummaryCard
                  label="Total Booked Value"
                  value={formatMoney(totals.total_booked_value_usd)}
                  accent={BLUE}
                />
                <SummaryCard
                  label="Total Delivered Quantity"
                  value={`${formatDecimal(totals.total_delivered_quantity_tonnes)} tonnes`}
                  accent={GREEN}
                />
                <SummaryCard
                  label="Total Delivered Value"
                  value={formatMoney(totals.total_delivered_value_usd)}
                  accent={GREEN}
                />
                <SummaryCard
                  label="Booked vs Break Even"
                  value={formatPercent(totals.booked_vs_break_even_percentage)}
                  accent={BLUE}
                />
                <SummaryCard
                  label="Delivered vs Break Even"
                  value={formatPercent(totals.delivered_vs_break_even_percentage)}
                  accent={GREEN}
                />
              </div>

              <div className="be-two-column-grid">
                <MetricRowTable rows={reportData?.rows || []} />

                <div
                  style={{
                    border: `1px solid ${BORDER}`,
                    borderRadius: 14,
                    background: CARD_BG,
                    padding: 16,
                  }}
                >
                  <SectionTitle
                    title="Resolved Setting"
                    subtitle="This is the setting currently applied to the live breakeven calculation."
                  />

                  {selectedSetting ? (
                    <div style={{ display: "grid", gap: 0 }}>
                      <InfoRow label="Name" value={selectedSetting.setting_name || "-"} />
                      <InfoRow label="Scope" value={getScopeLabel(selectedSetting)} />
                      <InfoRow
                        label="Status"
                        value={<SettingBadge setting={selectedSetting} />}
                      />
                      <InfoRow
                        label="Break Even Tonnes"
                        value={formatDecimal(selectedSetting.break_even_quantity_tonnes)}
                      />
                      <InfoRow
                        label="USD per Tonne"
                        value={formatDecimal(selectedSetting.break_even_usd_per_tonne, 4)}
                      />
                      <InfoRow
                        label="Break Even Value"
                        value={formatMoney(selectedSetting.break_even_value_usd)}
                      />
                      <InfoRow label="Report Date" value={formatDate(reportData?.report_date)} />
                    </div>
                  ) : (
                    <EmptyBlock text="No resolved setting details available." />
                  )}
                </div>
              </div>

              <div
                style={{
                  border: `1px solid ${BORDER}`,
                  borderRadius: 16,
                  background: PAGE_BG,
                  overflow: "hidden",
                }}
              >
                <div
                  className="be-preview-head"
                  style={{
                    padding: "14px 16px",
                    borderBottom: `1px solid ${BORDER}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: TEXT }}>PDF Preview</div>
                    <div style={{ fontSize: 12, color: MUTED, marginTop: 4 }}>
                      Generate and inspect the breakeven PDF here.
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={loadPdfPreview}
                    disabled={isLoadingPreview}
                    style={primaryButtonStyle(isLoadingPreview)}
                  >
                    {isLoadingPreview ? "Preparing..." : "Reload Preview"}
                  </button>
                </div>

                <div className="be-preview-body">
                  {pdfPreviewUrl ? (
                    <iframe
                      title="Breakeven PDF Preview"
                      src={pdfPreviewUrl}
                      style={{
                        width: "100%",
                        height: "100%",
                        border: "none",
                        background: "#fff",
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        height: "100%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: MUTED,
                        fontSize: 13,
                        padding: 20,
                        textAlign: "center",
                      }}
                    >
                      Click “Preview PDF” to generate and load the breakeven report.
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="be-panel">
                <SectionTitle
                  title={editingSettingId ? "Edit Breakeven Setting" : "Create Breakeven Setting"}
                  subtitle="Manage monthly and global breakeven settings only."
                />

                <div className="be-form-grid be-form-grid-settings">
                  <div>
                    <label style={fieldLabelStyle}>Setting Name</label>
                    <input
                      type="text"
                      value={settingName}
                      onChange={(e) => setSettingName(e.target.value)}
                      placeholder="e.g. May 2026 Breakeven"
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label style={fieldLabelStyle}>Scope Type</label>
                    <select
                      value={scopeType}
                      onChange={(e) => setScopeType(e.target.value)}
                      style={inputStyle}
                    >
                      {SCOPE_TYPE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {scopeType === "monthly" ? (
                    <>
                      <div>
                        <label style={fieldLabelStyle}>Month</label>
                        <input
                          type="number"
                          min={1}
                          max={12}
                          value={settingMonth}
                          onChange={(e) => setSettingMonth(e.target.value)}
                          style={inputStyle}
                        />
                      </div>

                      <div>
                        <label style={fieldLabelStyle}>Year</label>
                        <input
                          type="number"
                          min={2000}
                          value={settingYear}
                          onChange={(e) => setSettingYear(e.target.value)}
                          style={inputStyle}
                        />
                      </div>
                    </>
                  ) : null}

                  <div>
                    <label style={fieldLabelStyle}>Break Even Quantity (Tonnes)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={breakEvenQuantityTonnes}
                      onChange={(e) => setBreakEvenQuantityTonnes(e.target.value)}
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label style={fieldLabelStyle}>USD per Tonne</label>
                    <input
                      type="number"
                      step="0.0001"
                      value={breakEvenUsdPerTonne}
                      onChange={(e) => setBreakEvenUsdPerTonne(e.target.value)}
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label style={fieldLabelStyle}>Computed Break Even Value</label>
                    <div style={readonlyBoxStyle}>{formatMoney(computedBreakEvenValue)}</div>
                  </div>

                  <div>
                    <label style={fieldLabelStyle}>Active</label>
                    <div style={readonlyBoxStyle}>
                      <Toggle
                        checked={settingIsActive}
                        onChange={setSettingIsActive}
                        label={settingIsActive ? "Active" : "Inactive"}
                      />
                    </div>
                  </div>
                </div>

                <div className="be-textarea-grid">
                  <div>
                    <label style={fieldLabelStyle}>Description</label>
                    <textarea
                      value={settingDescription}
                      onChange={(e) => setSettingDescription(e.target.value)}
                      placeholder="Optional description"
                      style={textareaStyle}
                    />
                  </div>

                  <div>
                    <label style={fieldLabelStyle}>Notes</label>
                    <textarea
                      value={settingNotes}
                      onChange={(e) => setSettingNotes(e.target.value)}
                      placeholder="Optional notes"
                      style={textareaStyle}
                    />
                  </div>
                </div>
              </div>

              {settingsError ? (
                <div
                  style={{
                    border: `1px solid rgba(185,28,28,0.18)`,
                    background: RED_SOFT,
                    color: RED,
                    borderRadius: 12,
                    padding: "12px 14px",
                    fontSize: 13,
                    marginBottom: 18,
                  }}
                >
                  {settingsError}
                </div>
              ) : null}

              <div className="be-two-column-grid">
                <SettingsTable
                  settings={settings}
                  isLoadingSettings={isLoadingSettings}
                  isTogglingSettingId={isTogglingSettingId}
                  startEditSetting={startEditSetting}
                  toggleSettingActive={toggleSettingActive}
                />

                <div
                  style={{
                    border: `1px solid ${BORDER}`,
                    borderRadius: 14,
                    background: CARD_BG,
                    padding: 16,
                  }}
                >
                  <SectionTitle
                    title="Active Settings Snapshot"
                    subtitle="Only breakeven settings are shown here."
                  />

                  {activeSettings.length ? (
                    <div style={{ display: "grid", gap: 10 }}>
                      {activeSettings.map((item) => (
                        <div
                          key={item.id}
                          style={{
                            border: `1px solid ${BORDER}`,
                            borderRadius: 12,
                            padding: 12,
                            background: PAGE_BG,
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "flex-start",
                              justifyContent: "space-between",
                              gap: 10,
                              marginBottom: 8,
                              flexWrap: "wrap",
                            }}
                          >
                            <div
                              style={{
                                fontSize: 14,
                                fontWeight: 700,
                                color: TEXT,
                                wordBreak: "break-word",
                              }}
                            >
                              {item.setting_name || "-"}
                            </div>
                            <SettingBadge setting={item} />
                          </div>

                          <div
                            style={{
                              fontSize: 12,
                              color: MUTED,
                              lineHeight: 1.7,
                            }}
                          >
                            <div>Scope: {getScopeLabel(item)}</div>
                            <div>
                              Break Even Tonnes: {formatDecimal(item.break_even_quantity_tonnes)}
                            </div>
                            <div>
                              USD per Tonne: {formatDecimal(item.break_even_usd_per_tonne, 4)}
                            </div>
                            <div>
                              Break Even Value: {formatMoney(item.break_even_value_usd)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyBlock text="There are no active breakeven settings yet." />
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <style jsx global>{`
        .be-shell {
          width: 100%;
          max-width: 1500px;
          margin: 0 auto;
          padding: 20px 20px 40px;
          box-sizing: border-box;
        }

        .be-topbar {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 20px;
          flex-wrap: wrap;
          margin-bottom: 18px;
        }

        .be-title-block {
          min-width: 0;
          flex: 1 1 420px;
        }

        .be-actions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          align-items: stretch;
          justify-content: flex-end;
          flex: 1 1 360px;
        }

        .be-panel {
          border: 1px solid ${BORDER};
          border-radius: 16px;
          background: ${PAGE_BG};
          padding: 16px;
          margin-bottom: 18px;
        }

        .be-tabs {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
        }

        .be-tab-button {
          height: 40px;
          padding: 0 16px;
          border-radius: 10px;
          cursor: pointer;
          font-size: 13px;
          font-weight: 700;
          min-width: 0;
        }

        .be-form-grid {
          display: grid;
          gap: 12px;
        }

        .be-form-grid-summary {
          grid-template-columns: repeat(5, minmax(0, 1fr));
        }

        .be-form-grid-settings {
          grid-template-columns: repeat(4, minmax(0, 1fr));
        }

        .be-textarea-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
          margin-top: 12px;
        }

        .be-summary-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
          margin-bottom: 18px;
        }

        .be-summary-card {
          border: 1px solid ${BORDER};
          border-radius: 14px;
          background: ${CARD_BG};
          padding: 14px;
          min-height: 88px;
          min-width: 0;
        }

        .be-two-column-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.35fr) minmax(300px, 0.8fr);
          gap: 18px;
          align-items: start;
          margin-bottom: 18px;
        }

        .be-desktop-table-wrap {
          display: block;
          overflow-x: auto;
          width: 100%;
          -webkit-overflow-scrolling: touch;
        }

        .be-desktop-table {
          width: 100%;
          min-width: 760px;
          border-collapse: collapse;
          font-size: 13px;
        }

        .be-mobile-card-list {
          display: none;
        }

        .be-mobile-table-card {
          border-top: 1px solid ${BORDER};
          padding: 14px;
          background: ${PAGE_BG};
        }

        .be-mobile-card-top {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 10px;
          flex-wrap: wrap;
        }

        .be-mobile-card-title {
          font-size: 14px;
          font-weight: 700;
          color: ${TEXT};
          word-break: break-word;
        }

        .be-mobile-card-index {
          font-size: 12px;
          color: ${MUTED};
          white-space: nowrap;
        }

        .be-mobile-kv {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          padding: 8px 0;
          border-top: 1px solid ${BORDER};
          font-size: 13px;
        }

        .be-mobile-kv:first-of-type {
          border-top: none;
        }

        .be-mobile-kv span {
          color: ${MUTED};
          min-width: 0;
        }

        .be-mobile-kv strong {
          color: ${TEXT};
          text-align: right;
          word-break: break-word;
        }

        .be-mobile-actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin-top: 12px;
        }

        .be-preview-body {
          height: 760px;
          background: ${SOFT_2};
        }

        @media (max-width: 1180px) {
          .be-form-grid-summary {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }

          .be-form-grid-settings {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }

          .be-summary-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .be-two-column-grid {
            grid-template-columns: 1fr;
          }

          .be-preview-body {
            height: 620px;
          }
        }

        @media (max-width: 820px) {
          .be-shell {
            padding: 14px 14px 28px;
          }

          .be-actions {
            width: 100%;
            justify-content: flex-start;
          }

          .be-form-grid-summary,
          .be-form-grid-settings,
          .be-textarea-grid,
          .be-summary-grid {
            grid-template-columns: 1fr;
          }

          .be-preview-head {
            align-items: flex-start;
          }

          .be-preview-body {
            height: 480px;
          }
        }

        @media (max-width: 640px) {
          .be-shell {
            padding: 12px 12px 24px;
          }

          .be-actions button,
          .be-tabs button {
            width: 100%;
          }

          .be-tab-button {
            height: 42px;
          }

          .be-desktop-table-wrap {
            display: none;
          }

          .be-mobile-card-list {
            display: block;
          }

          .be-summary-card {
            min-height: auto;
          }

          .be-preview-body {
            height: 360px;
          }
        }
      `}</style>
    </>
  );
}

function primaryButtonStyle(disabled) {
  return {
    border: `1px solid ${BLUE}`,
    background: disabled ? BLUE_DARK : BLUE,
    color: "#fff",
    height: 40,
    padding: "0 16px",
    borderRadius: 10,
    cursor: disabled ? "not-allowed" : "pointer",
    fontSize: 13,
    fontWeight: 700,
    opacity: disabled ? 0.78 : 1,
  };
}

function secondaryButtonStyle(disabled, color) {
  return {
    border: `1px solid ${BORDER}`,
    background: PAGE_BG,
    color,
    height: 40,
    padding: "0 16px",
    borderRadius: 10,
    cursor: disabled ? "not-allowed" : "pointer",
    fontSize: 13,
    fontWeight: 700,
    opacity: disabled ? 0.78 : 1,
  };
}

function miniButtonStyle(color) {
  return {
    border: `1px solid ${BORDER}`,
    background: PAGE_BG,
    color,
    height: 32,
    padding: "0 12px",
    borderRadius: 9,
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 700,
  };
}

const fieldLabelStyle = {
  display: "block",
  fontSize: 12,
  color: MUTED,
  marginBottom: 6,
};

const inputStyle = {
  width: "100%",
  height: 42,
  border: `1px solid ${BORDER}`,
  borderRadius: 10,
  padding: "0 12px",
  boxSizing: "border-box",
  outline: "none",
  fontSize: 13,
  color: TEXT,
  background: "#fff",
};

const textareaStyle = {
  width: "100%",
  minHeight: 100,
  border: `1px solid ${BORDER}`,
  borderRadius: 10,
  padding: "10px 12px",
  boxSizing: "border-box",
  outline: "none",
  fontSize: 13,
  color: TEXT,
  background: "#fff",
  resize: "vertical",
  fontFamily: "Arial, sans-serif",
};

const readonlyBoxStyle = {
  width: "100%",
  minHeight: 42,
  border: `1px solid ${BORDER}`,
  borderRadius: 10,
  padding: "10px 12px",
  boxSizing: "border-box",
  fontSize: 13,
  color: TEXT,
  background: SOFT,
  display: "flex",
  alignItems: "center",
};

const tableHeadStyle = {
  textAlign: "left",
  padding: "12px",
  borderBottom: `1px solid ${BORDER}`,
  color: TEXT,
  fontWeight: 700,
  whiteSpace: "nowrap",
};

const tableCellStyle = {
  padding: "12px",
  borderBottom: `1px solid ${BORDER}`,
  color: TEXT,
  verticalAlign: "top",
};

const settingInfoRowStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  padding: "10px 0",
  borderBottom: `1px solid ${BORDER}`,
  flexWrap: "wrap",
};

const settingInfoLabelStyle = {
  fontSize: 12,
  color: MUTED,
};

const settingInfoValueStyle = {
  fontSize: 13,
  color: TEXT,
  fontWeight: 600,
  textAlign: "right",
  marginLeft: "auto",
  wordBreak: "break-word",
};