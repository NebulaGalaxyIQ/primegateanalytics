import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useRef, useState } from "react";

import reportService from "../../services/reportService";

const PAGE_BG = "#ffffff";
const TEXT = "#111827";
const MUTED = "#6b7280";
const BORDER = "#e5e7eb";
const SOFT = "#f9fafb";
const SOFT_2 = "#f3f4f6";
const BLUE = "#2563eb";
const GREEN = "#15803d";
const RED = "#b91c1c";
const ORANGE = "#f97316";

const ORDER_TYPE_OPTIONS = [
  { label: "All", value: "" },
  { label: "Local", value: "local" },
  { label: "Chilled", value: "chilled" },
  { label: "Frozen", value: "frozen" },
];

const STATUS_OPTIONS = [
  { label: "All", value: "" },
  { label: "Draft", value: "draft" },
  { label: "Confirmed", value: "confirmed" },
  { label: "In Progress", value: "in_progress" },
  { label: "Completed", value: "completed" },
  { label: "Cancelled", value: "cancelled" },
];

const REPORT_CONFIG = {
  "orders-monthly": {
    title: "Monthly Orders Report",
    subtitle:
      "Detailed monthly order report with summary, grouped sections, projection, and export tools.",
    type: "orders_monthly",
  },
};

function formatDecimal(value) {
  if (value === null || value === undefined || value === "") return "0.00";
  const num = Number(value);
  if (Number.isNaN(num)) return String(value);
  return num.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatInt(value) {
  const num = Number(value || 0);
  if (Number.isNaN(num)) return "0";
  return num.toLocaleString();
}

function formatDate(value) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function statusLabel(value) {
  return String(value || "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function sectionAccent(sectionKey) {
  if (sectionKey === "local") return BLUE;
  if (sectionKey === "chilled") return GREEN;
  if (sectionKey === "frozen") return ORANGE;
  return TEXT;
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
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ accentColor: BLUE }}
      />
      <span>{label}</span>
    </label>
  );
}

function SummaryBox({ label, value, hint }) {
  return (
    <div
      style={{
        border: `1px solid ${BORDER}`,
        borderRadius: 12,
        background: PAGE_BG,
        padding: 14,
      }}
    >
      <div style={{ fontSize: 12, color: MUTED, marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: TEXT, lineHeight: 1.1 }}>
        {value}
      </div>
      {hint ? (
        <div style={{ fontSize: 12, color: MUTED, marginTop: 6 }}>{hint}</div>
      ) : null}
    </div>
  );
}

function ProjectionTable({ projection }) {
  if (!projection?.rows?.length) return null;

  return (
    <div
      style={{
        border: `1px solid ${BORDER}`,
        borderRadius: 14,
        background: PAGE_BG,
        overflow: "hidden",
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
        {projection.title}
      </div>

      <div style={{ overflowX: "auto" }}>
        <table
          style={{
            width: "100%",
            minWidth: 680,
            borderCollapse: "collapse",
            fontSize: 13,
          }}
        >
          <thead>
            <tr>
              {["Week", "Goats", "Sheep", "Cattle", "Grand Total"].map((head) => (
                <th
                  key={head}
                  style={{
                    textAlign: "left",
                    padding: "12px",
                    borderBottom: `1px solid ${BORDER}`,
                    fontWeight: 700,
                    color: TEXT,
                  }}
                >
                  {head}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {projection.rows.map((row) => (
              <tr key={row.label}>
                <td
                  style={{
                    padding: "12px",
                    borderBottom: `1px solid ${BORDER}`,
                    fontWeight: 600,
                    color: TEXT,
                  }}
                >
                  {row.label}
                </td>
                <td style={cellStyle}>{formatInt(row.goats)}</td>
                <td style={cellStyle}>{formatInt(row.sheep)}</td>
                <td style={cellStyle}>{formatInt(row.cattle)}</td>
                <td style={{ ...cellStyle, fontWeight: 700 }}>
                  {formatInt(row.total_animals)}
                </td>
              </tr>
            ))}

            <tr style={{ background: SOFT }}>
              <td style={{ ...cellTopStyle, fontWeight: 700 }}>Totals</td>
              <td style={{ ...cellTopStyle, fontWeight: 700 }}>
                {formatInt(projection.total_goats)}
              </td>
              <td style={{ ...cellTopStyle, fontWeight: 700 }}>
                {formatInt(projection.total_sheep)}
              </td>
              <td style={{ ...cellTopStyle, fontWeight: 700 }}>
                {formatInt(projection.total_cattle)}
              </td>
              <td style={{ ...cellTopStyle, fontWeight: 700 }}>
                {formatInt(projection.grand_total_animals)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function OrdersSection({ section }) {
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
        <div
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: sectionAccent(section.section_key),
          }}
        >
          {section.section_title}
        </div>

        <div
          style={{
            display: "flex",
            gap: 16,
            flexWrap: "wrap",
            fontSize: 12,
            color: MUTED,
          }}
        >
          <span>Orders: {formatInt(section.total_orders)}</span>
          <span>Qty: {formatDecimal(section.total_quantity_kg)} kg</span>
          <span>Pieces: {formatInt(section.total_pieces_required)}</span>
          <span>Animals: {formatInt(section.total_animals_required)}</span>
        </div>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table
          style={{
            width: "100%",
            minWidth: 980,
            borderCollapse: "collapse",
            fontSize: 13,
          }}
        >
          <thead>
            <tr>
              {[
                "Serial.No",
                "Name of Enterprise",
                "Product Quantity",
                "Pieces Required",
                "Slaughter Schedule",
                "Expected Delivery",
                "Status",
              ].map((head) => (
                <th
                  key={head}
                  style={{
                    textAlign: "left",
                    padding: "12px",
                    borderBottom: `1px solid ${BORDER}`,
                    fontWeight: 700,
                    color: TEXT,
                    whiteSpace: "nowrap",
                  }}
                >
                  {head}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {section.rows?.length ? (
              section.rows.map((row) => (
                <tr key={`${section.section_key}-${row.order_id}`}>
                  <td style={cellStyle}>{row.serial_no}.</td>
                  <td style={{ ...cellStyle, fontWeight: 600 }}>{row.enterprise_name}</td>
                  <td style={{ ...cellStyle, lineHeight: 1.45 }}>
                    {row.product_summary || `${formatDecimal(row.total_quantity_kg)} kg`}
                  </td>
                  <td style={{ ...cellStyle, lineHeight: 1.45 }}>
                    <div>Goat: {formatInt(row.goat_pieces_required)} pcs</div>
                    <div>Sheep: {formatInt(row.sheep_pieces_required)} pcs</div>
                    <div>Cattle: {formatInt(row.cattle_pieces_required)} pcs</div>
                  </td>
                  <td style={{ ...cellStyle, whiteSpace: "nowrap" }}>
                    {formatDate(row.slaughter_schedule)}
                  </td>
                  <td style={{ ...cellStyle, whiteSpace: "nowrap" }}>
                    {formatDate(row.expected_delivery)}
                  </td>
                  <td style={cellStyle}>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        padding: "6px 10px",
                        borderRadius: 999,
                        background:
                          row.status === "completed"
                            ? "rgba(21,128,61,0.10)"
                            : row.status === "cancelled"
                            ? "rgba(185,28,28,0.10)"
                            : "rgba(37,99,235,0.10)",
                        color:
                          row.status === "completed"
                            ? GREEN
                            : row.status === "cancelled"
                            ? RED
                            : BLUE,
                        fontSize: 12,
                        fontWeight: 700,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {statusLabel(row.status)}
                    </span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={7}
                  style={{
                    padding: 20,
                    textAlign: "center",
                    color: MUTED,
                    borderBottom: `1px solid ${BORDER}`,
                  }}
                >
                  No rows in this section.
                </td>
              </tr>
            )}

            <tr style={{ background: SOFT }}>
              <td style={{ ...cellTopStyle, fontWeight: 700 }}>Totals</td>
              <td style={cellTopStyle} />
              <td style={{ ...cellTopStyle, fontWeight: 700 }}>
                {formatDecimal(section.total_quantity_kg)} kg
              </td>
              <td style={{ ...cellTopStyle, fontWeight: 700 }}>
                {formatInt(section.total_pieces_required)} pcs
              </td>
              <td style={cellTopStyle} />
              <td style={cellTopStyle} />
              <td style={cellTopStyle} />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function ReportDetailsPage() {
  const router = useRouter();
  const { id } = router.query;

  const reportKey = Array.isArray(id) ? id[0] : id;
  const config = reportKey ? REPORT_CONFIG[reportKey] : null;

  const now = useMemo(() => new Date(), []);
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [orderType, setOrderType] = useState("");
  const [status, setStatus] = useState("");
  const [enterpriseName, setEnterpriseName] = useState("");
  const [preparedBy, setPreparedBy] = useState("");
  const [includeSummary, setIncludeSummary] = useState(true);
  const [includeSections, setIncludeSections] = useState(true);
  const [includeTotals, setIncludeTotals] = useState(true);
  const [includeAnimalProjection, setIncludeAnimalProjection] = useState(true);

  const [reportData, setReportData] = useState(null);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState("");
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isDownloading, setIsDownloading] = useState("");
  const [error, setError] = useState("");

  const previewUrlRef = useRef("");

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
    };
  }, []);

  const requestParams = useMemo(
    () => ({
      month,
      year,
      order_type: orderType || undefined,
      status: status || undefined,
      enterprise_name: enterpriseName || undefined,
      prepared_by: preparedBy || undefined,
      include_summary: includeSummary,
      include_sections: includeSections,
      include_totals: includeTotals,
      include_animal_projection: includeAnimalProjection,
    }),
    [
      month,
      year,
      orderType,
      status,
      enterpriseName,
      preparedBy,
      includeSummary,
      includeSections,
      includeTotals,
      includeAnimalProjection,
    ]
  );

  async function loadReportData() {
    if (!config) return;

    setIsLoadingData(true);
    setError("");

    try {
      const data = await reportService.getOrdersMonthlyReportData(requestParams);
      setReportData(data);
    } catch (err) {
      setError(err?.message || "Failed to load report data");
    } finally {
      setIsLoadingData(false);
    }
  }

  async function loadPdfPreview() {
    if (!config) return;

    setIsLoadingPreview(true);
    setError("");

    try {
      const result = await reportService.exportOrdersMonthlyReport({
        ...requestParams,
        format: "pdf",
      });

      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }

      const url = URL.createObjectURL(result.blob);
      previewUrlRef.current = url;
      setPdfPreviewUrl(url);
    } catch (err) {
      setError(err?.message || "Failed to load PDF preview");
    } finally {
      setIsLoadingPreview(false);
    }
  }

  async function downloadReport(format) {
    if (!config) return;

    setIsDownloading(format);
    setError("");

    try {
      await reportService.downloadOrdersMonthlyReport({
        ...requestParams,
        format,
      });
    } catch (err) {
      setError(err?.message || `Failed to download ${format.toUpperCase()} report`);
    } finally {
      setIsDownloading("");
    }
  }

  useEffect(() => {
    if (config) {
      loadReportData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  const summary = reportData?.summary;
  const sections = reportData?.sections || [];
  const totals = reportData?.totals;
  const projection = reportData?.animal_projection;

  if (!router.isReady) {
    return null;
  }

  if (!config) {
    return (
      <>
        <Head>
          <title>Report Not Found | UMG</title>
        </Head>

        <div
          style={{
            minHeight: "100vh",
            background: PAGE_BG,
            fontFamily: "Arial, sans-serif",
            color: TEXT,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 700,
              border: `1px solid ${BORDER}`,
              borderRadius: 16,
              padding: 24,
              background: PAGE_BG,
            }}
          >
            <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>
              Report not found
            </div>
            <div style={{ fontSize: 14, color: MUTED, lineHeight: 1.6, marginBottom: 18 }}>
              The report route <strong>{String(reportKey || "")}</strong> is not configured yet.
            </div>
            <Link
              href="/reports"
              style={{
                color: BLUE,
                fontSize: 14,
                fontWeight: 700,
                textDecoration: "none",
              }}
            >
              ← Back to reports
            </Link>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>{config.title} | UMG</title>
      </Head>

      <div
        style={{
          minHeight: "100vh",
          background: PAGE_BG,
          color: TEXT,
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 1500,
            margin: "0 auto",
            padding: "20px 20px 40px",
            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 20,
              flexWrap: "wrap",
              marginBottom: 18,
            }}
          >
            <div>
              <Link
                href="/reports"
                style={{
                  color: BLUE,
                  fontSize: 13,
                  fontWeight: 700,
                  textDecoration: "none",
                  display: "inline-block",
                  marginBottom: 10,
                }}
              >
                ← Back to reports
              </Link>

              <div
                style={{
                  fontSize: 24,
                  fontWeight: 700,
                  color: TEXT,
                  marginBottom: 6,
                }}
              >
                {config.title}
              </div>

              <div
                style={{
                  fontSize: 13,
                  color: MUTED,
                  lineHeight: 1.5,
                  maxWidth: 780,
                }}
              >
                {config.subtitle}
              </div>
            </div>

            <div
              style={{
                display: "flex",
                gap: 10,
                flexWrap: "wrap",
              }}
            >
              <button
                onClick={loadReportData}
                disabled={isLoadingData}
                style={ghostButtonStyle}
              >
                {isLoadingData ? "Loading..." : "Refresh Data"}
              </button>

              <button
                onClick={loadPdfPreview}
                disabled={isLoadingPreview}
                style={primaryButtonStyle}
              >
                {isLoadingPreview ? "Preparing PDF..." : "Preview PDF"}
              </button>

              <button
                onClick={() => downloadReport("csv")}
                disabled={Boolean(isDownloading)}
                style={ghostButtonStyle}
              >
                {isDownloading === "csv" ? "Downloading..." : "CSV"}
              </button>

              <button
                onClick={() => downloadReport("pdf")}
                disabled={Boolean(isDownloading)}
                style={ghostButtonStyle}
              >
                {isDownloading === "pdf" ? "Downloading..." : "PDF"}
              </button>

              <button
                onClick={() => downloadReport("docx")}
                disabled={Boolean(isDownloading)}
                style={ghostButtonStyle}
              >
                {isDownloading === "docx" ? "Downloading..." : "Word"}
              </button>
            </div>
          </div>

          <div
            style={{
              border: `1px solid ${BORDER}`,
              borderRadius: 16,
              background: PAGE_BG,
              padding: 16,
              marginBottom: 18,
            }}
          >
            <div
              style={{
                fontSize: 14,
                fontWeight: 700,
                marginBottom: 14,
                color: TEXT,
              }}
            >
              Report Filters
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: 12,
                marginBottom: 14,
              }}
            >
              <div>
                <label style={labelStyle}>Month</label>
                <input
                  type="number"
                  min={1}
                  max={12}
                  value={month}
                  onChange={(e) => setMonth(Number(e.target.value || 1))}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Year</label>
                <input
                  type="number"
                  min={2000}
                  value={year}
                  onChange={(e) => setYear(Number(e.target.value || now.getFullYear()))}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Order Type</label>
                <select
                  value={orderType}
                  onChange={(e) => setOrderType(e.target.value)}
                  style={inputStyle}
                >
                  {ORDER_TYPE_OPTIONS.map((option) => (
                    <option key={option.label} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={labelStyle}>Status</label>
                <select value={status} onChange={(e) => setStatus(e.target.value)} style={inputStyle}>
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option.label} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={labelStyle}>Enterprise Name</label>
                <input
                  type="text"
                  value={enterpriseName}
                  onChange={(e) => setEnterpriseName(e.target.value)}
                  placeholder="Search enterprise"
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Prepared By</label>
                <input
                  type="text"
                  value={preparedBy}
                  onChange={(e) => setPreparedBy(e.target.value)}
                  placeholder="Prepared by name"
                  style={inputStyle}
                />
              </div>
            </div>

            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              <Toggle checked={includeSummary} onChange={setIncludeSummary} label="Include summary" />
              <Toggle checked={includeSections} onChange={setIncludeSections} label="Include sections" />
              <Toggle checked={includeTotals} onChange={setIncludeTotals} label="Include totals" />
              <Toggle
                checked={includeAnimalProjection}
                onChange={setIncludeAnimalProjection}
                label="Include animal projection"
              />
            </div>
          </div>

          {error ? (
            <div
              style={{
                border: `1px solid rgba(185,28,28,0.18)`,
                background: "rgba(185,28,28,0.06)",
                color: RED,
                borderRadius: 12,
                padding: "12px 14px",
                fontSize: 13,
                marginBottom: 18,
              }}
            >
              {error}
            </div>
          ) : null}

          {summary ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 12,
                marginBottom: 18,
              }}
            >
              <SummaryBox label="Total Orders" value={formatInt(summary.total_orders)} />
              <SummaryBox
                label="Total Quantity"
                value={`${formatDecimal(summary.total_quantity_kg)} kg`}
              />
              <SummaryBox
                label="Total Pieces Required"
                value={formatInt(summary.total_pieces_required)}
              />
              <SummaryBox
                label="Total Animals Required"
                value={formatInt(summary.total_animals_required)}
              />
              <SummaryBox label="Local Orders" value={formatInt(summary.local_total_orders)} />
              <SummaryBox label="Chilled Orders" value={formatInt(summary.chilled_total_orders)} />
              <SummaryBox label="Frozen Orders" value={formatInt(summary.frozen_total_orders)} />
            </div>
          ) : null}

          {totals ? (
            <div
              style={{
                border: `1px solid ${BORDER}`,
                background: SOFT,
                borderRadius: 14,
                padding: "14px 16px",
                marginBottom: 18,
                display: "flex",
                gap: 22,
                flexWrap: "wrap",
                fontSize: 13,
                color: TEXT,
              }}
            >
              <span>
                <strong>Overall Quantity:</strong> {formatDecimal(totals.total_quantity_kg)} kg
              </span>
              <span>
                <strong>Overall Pieces:</strong> {formatInt(totals.total_pieces_required)} pcs
              </span>
              <span>
                <strong>Overall Animals:</strong> {formatInt(totals.total_animals_required)}
              </span>
            </div>
          ) : null}

          {projection ? (
            <div style={{ marginBottom: 18 }}>
              <ProjectionTable projection={projection} />
            </div>
          ) : null}

          <div style={{ display: "grid", gap: 18, marginBottom: 18 }}>
            {sections.length ? (
              sections.map((section) => (
                <OrdersSection key={section.section_key} section={section} />
              ))
            ) : (
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
                No report sections available for the selected filters.
              </div>
            )}
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
                  Generate the live PDF here and inspect the report layout before downloading.
                </div>
              </div>

              <button
                onClick={loadPdfPreview}
                disabled={isLoadingPreview}
                style={primaryButtonStyle}
              >
                {isLoadingPreview ? "Preparing..." : "Reload Preview"}
              </button>
            </div>

            <div style={{ height: 760, background: SOFT_2 }}>
              {pdfPreviewUrl ? (
                <iframe
                  title="Report PDF Preview"
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
                  Click “Preview PDF” to generate and load the report preview here.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

const labelStyle = {
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

const ghostButtonStyle = {
  border: `1px solid ${BORDER}`,
  background: PAGE_BG,
  color: TEXT,
  height: 40,
  padding: "0 14px",
  borderRadius: 10,
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 700,
};

const primaryButtonStyle = {
  border: `1px solid ${BLUE}`,
  background: BLUE,
  color: "#fff",
  height: 40,
  padding: "0 16px",
  borderRadius: 10,
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 700,
};

const cellStyle = {
  padding: "12px",
  borderBottom: `1px solid ${BORDER}`,
  color: TEXT,
  verticalAlign: "top",
};

const cellTopStyle = {
  padding: "12px",
  borderTop: `1px solid ${BORDER}`,
};