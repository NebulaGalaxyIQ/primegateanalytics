import Head from "next/head";
import { useEffect, useMemo, useRef, useState } from "react";

import reportService from "../../services/reportService";

const PAGE_BG = "#ffffff";
const TEXT = "#111827";
const MUTED = "#6b7280";
const BORDER = "#e5e7eb";
const SOFT = "#f9fafb";
const SOFT_2 = "#f3f4f6";
const GREEN = "#15803d";
const RED = "#b91c1c";
const BLUE = "#2563eb";
const ORANGE = "#f97316";
const PURPLE = "#7c3aed";

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

function formatDecimal(value) {
  if (value === null || value === undefined || value === "") return "0.00";
  const num = Number(value);
  if (Number.isNaN(num)) return String(value);
  return num.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatMoney(value) {
  if (value === null || value === undefined || value === "") return "$0.00";
  const num = Number(value);
  if (Number.isNaN(num)) return String(value);
  return `$${num.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatInt(value) {
  const num = Number(value || 0);
  if (Number.isNaN(num)) return "0";
  return num.toLocaleString();
}

function formatPercent(value) {
  if (value === null || value === undefined || value === "") return "0.00%";
  const num = Number(value);
  if (Number.isNaN(num)) return String(value);
  return `${num.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`;
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

function normalizeDateInputValue(value) {
  if (!value) return "";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";

  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function statusLabel(value) {
  return String(value || "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function sectionColor(sectionKey) {
  if (sectionKey === "local") return BLUE;
  if (sectionKey === "chilled") return GREEN;
  if (sectionKey === "frozen") return ORANGE;
  return TEXT;
}

function statusPillStyle(status) {
  if (status === "completed") {
    return {
      background: "rgba(21,128,61,0.10)",
      color: GREEN,
    };
  }

  if (status === "cancelled") {
    return {
      background: "rgba(185,28,28,0.10)",
      color: RED,
    };
  }

  return {
    background: "rgba(37,99,235,0.10)",
    color: BLUE,
  };
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

function SummaryCard({ label, value, sub, accent = TEXT }) {
  return (
    <div
      style={{
        border: `1px solid ${BORDER}`,
        background: PAGE_BG,
        borderRadius: 12,
        padding: 14,
        minHeight: 84,
      }}
    >
      <div style={{ fontSize: 12, color: MUTED, marginBottom: 8 }}>{label}</div>
      <div
        style={{
          fontSize: 22,
          fontWeight: 700,
          color: accent,
          lineHeight: 1.1,
        }}
      >
        {value}
      </div>
      {sub ? (
        <div style={{ fontSize: 12, color: MUTED, marginTop: 6 }}>{sub}</div>
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

function ReportTabButton({ active, label, color, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        height: 40,
        padding: "0 16px",
        borderRadius: 999,
        border: `1px solid ${active ? color : BORDER}`,
        background: active ? `${color}12` : PAGE_BG,
        color: active ? color : TEXT,
        cursor: "pointer",
        fontSize: 13,
        fontWeight: 700,
      }}
    >
      {label}
    </button>
  );
}

function SectionTable({ section }) {
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
            color: sectionColor(section.section_key),
            letterSpacing: 0.2,
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
            borderCollapse: "collapse",
            minWidth: 980,
            fontSize: 13,
          }}
        >
          <thead>
            <tr style={{ background: PAGE_BG }}>
              {[
                "Serial No.",
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
                    padding: "12px 12px",
                    borderBottom: `1px solid ${BORDER}`,
                    color: TEXT,
                    fontWeight: 700,
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
                <tr key={`${section.section_key}-${row.order_id}-${row.serial_no}`}>
                  <td style={cellStyle}>{row.serial_no}.</td>
                  <td style={{ ...cellStyle, fontWeight: 600 }}>
                    {row.enterprise_name || "-"}
                  </td>
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
                        fontSize: 12,
                        fontWeight: 700,
                        whiteSpace: "nowrap",
                        ...statusPillStyle(row.status),
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
              <td
                style={{
                  padding: "12px 12px",
                  borderTop: `1px solid ${BORDER}`,
                  fontWeight: 700,
                }}
              >
                Totals
              </td>
              <td style={{ borderTop: `1px solid ${BORDER}` }} />
              <td
                style={{
                  padding: "12px 12px",
                  borderTop: `1px solid ${BORDER}`,
                  fontWeight: 700,
                  color: TEXT,
                }}
              >
                {formatDecimal(section.total_quantity_kg)} kg
              </td>
              <td
                style={{
                  padding: "12px 12px",
                  borderTop: `1px solid ${BORDER}`,
                  fontWeight: 700,
                  color: TEXT,
                }}
              >
                {formatInt(section.total_pieces_required)} pcs
              </td>
              <td style={{ borderTop: `1px solid ${BORDER}` }} />
              <td style={{ borderTop: `1px solid ${BORDER}` }} />
              <td style={{ borderTop: `1px solid ${BORDER}` }} />
            </tr>
          </tbody>
        </table>
      </div>
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
        {projection.title}
      </div>

      <div style={{ overflowX: "auto" }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            minWidth: 680,
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
                    color: TEXT,
                    fontWeight: 600,
                  }}
                >
                  {row.label}
                </td>
                <td style={projectionCellStyle}>{formatInt(row.goats)}</td>
                <td style={projectionCellStyle}>{formatInt(row.sheep)}</td>
                <td style={projectionCellStyle}>{formatInt(row.cattle)}</td>
                <td style={{ ...projectionCellStyle, fontWeight: 700 }}>
                  {formatInt(row.total_animals)}
                </td>
              </tr>
            ))}

            <tr style={{ background: SOFT }}>
              <td style={{ ...projectionTotalStyle, color: RED }}>TOTAL (All Animals)</td>
              <td style={{ ...projectionTotalStyle, color: RED }}>
                {formatInt(projection.total_goats)}
              </td>
              <td style={{ ...projectionTotalStyle, color: RED }}>
                {formatInt(projection.total_sheep)}
              </td>
              <td style={{ ...projectionTotalStyle, color: RED }}>
                {formatInt(projection.total_cattle)}
              </td>
              <td style={{ ...projectionTotalStyle, color: RED }}>
                {formatInt(projection.grand_total_animals)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FrozenContainersTable({ rows }) {
  if (!rows?.length) return null;

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
        Frozen Containers
      </div>

      <div style={{ overflowX: "auto" }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            minWidth: 1180,
            fontSize: 13,
          }}
        >
          <thead>
            <tr>
              {[
                "No.",
                "Container / Order Ref",
                "Client Name",
                "Order Ratio",
                "Quantity (kg)",
                "Container Value",
                "Down Payment",
                "Balance",
                "Gate In",
                "Departure",
                "Jurisdiction",
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
            {rows.map((row) => (
              <tr key={row._key}>
                <td style={cellStyle}>{row.serial_no}</td>
                <td style={{ ...cellStyle, fontWeight: 600 }}>{row.container_ref}</td>
                <td style={{ ...cellStyle, fontWeight: 600 }}>{row.client_name}</td>
                <td style={{ ...cellStyle, lineHeight: 1.45 }}>{row.order_ratio}</td>
                <td style={cellStyle}>{formatDecimal(row.total_quantity_kg)} kg</td>
                <td style={cellStyle}>{formatMoney(row.container_value_usd)}</td>
                <td style={cellStyle}>{formatMoney(row.down_payment_usd)}</td>
                <td style={cellStyle}>{formatMoney(row.balance_usd)}</td>
                <td style={cellStyle}>{formatDate(row.container_gate_in)}</td>
                <td style={cellStyle}>{formatDate(row.departure_date)}</td>
                <td style={cellStyle}>{row.jurisdiction}</td>
                <td style={cellStyle}>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      padding: "6px 10px",
                      borderRadius: 999,
                      fontSize: 12,
                      fontWeight: 700,
                      whiteSpace: "nowrap",
                      ...statusPillStyle(row.status),
                    }}
                  >
                    {statusLabel(row.status)}
                  </span>
                </td>
              </tr>
            ))}

            <tr style={{ background: SOFT }}>
              <td
                colSpan={4}
                style={{
                  padding: "12px",
                  borderTop: `1px solid ${BORDER}`,
                  fontWeight: 700,
                  color: TEXT,
                }}
              >
                Totals
              </td>
              <td style={frozenTotalCellStyle}>{formatDecimal(sumBy(rows, "total_quantity_kg"))} kg</td>
              <td style={frozenTotalCellStyle}>{formatMoney(sumBy(rows, "container_value_usd"))}</td>
              <td style={frozenTotalCellStyle}>{formatMoney(sumBy(rows, "down_payment_usd"))}</td>
              <td style={frozenTotalCellStyle}>{formatMoney(sumBy(rows, "balance_usd"))}</td>
              <td style={{ borderTop: `1px solid ${BORDER}` }} />
              <td style={{ borderTop: `1px solid ${BORDER}` }} />
              <td style={{ borderTop: `1px solid ${BORDER}` }} />
              <td style={{ borderTop: `1px solid ${BORDER}` }} />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BreakevenTable({ rows }) {
  if (!rows?.length) return null;

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
        Breakeven Summary
      </div>

      <div style={{ overflowX: "auto" }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            minWidth: 780,
            fontSize: 13,
          }}
        >
          <thead>
            <tr>
              {["Index", "Metric", "Quantity (Tonnes)", "USD (Total)", "Percentage"].map(
                (head) => (
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
                )
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.index}-${row.metric}`}>
                <td style={cellStyle}>{row.index}</td>
                <td style={{ ...cellStyle, fontWeight: 600 }}>{row.metric}</td>
                <td style={cellStyle}>
                  {row.quantity_display ||
                    (row.quantity_tonnes !== null && row.quantity_tonnes !== undefined
                      ? formatDecimal(row.quantity_tonnes)
                      : "-")}
                </td>
                <td style={cellStyle}>
                  {row.usd_display ||
                    (row.usd_total !== null && row.usd_total !== undefined
                      ? formatMoney(row.usd_total)
                      : "-")}
                </td>
                <td style={cellStyle}>
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
    </div>
  );
}

function sumBy(rows, field) {
  return rows.reduce((sum, row) => sum + Number(row?.[field] || 0), 0);
}

function normalizeFrozenRows(reportData) {
  const rawRows = Array.isArray(reportData?.rows) ? reportData.rows : [];

  return rawRows.map((row, index) => ({
    _key: row.order_id || row.order_number || `frozen-row-${index}`,
    serial_no: row.serial_no ?? index + 1,
    container_ref: row.order_number || row.order_id || "-",
    client_name: row.client_name || row.enterprise_name || "-",
    order_ratio: row.order_ratio || "-",
    status: row.status || "",
    container_value_usd: row.container_value_usd ?? 0,
    price_per_kg_usd: row.price_per_kg_usd ?? 0,
    down_payment_usd: row.down_payment_usd ?? 0,
    balance_usd: row.balance_usd ?? 0,
    container_gate_in: row.container_gate_in || null,
    departure_date: row.departure_date || null,
    jurisdiction: row.jurisdiction || "-",
    total_quantity_kg: row.total_quantity_kg ?? 0,
    total_pieces_required: row.total_pieces_required ?? 0,
  }));
}

export default function ReportsIndexPage() {
  const now = useMemo(() => new Date(), []);
  const [reportType, setReportType] = useState("orders");

  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [status, setStatus] = useState("");
  const [enterpriseName, setEnterpriseName] = useState("");
  const [preparedBy, setPreparedBy] = useState("");

  const [orderType, setOrderType] = useState("");
  const [includeSummary, setIncludeSummary] = useState(true);
  const [includeSections, setIncludeSections] = useState(true);
  const [includeTotals, setIncludeTotals] = useState(true);
  const [includeAnimalProjection, setIncludeAnimalProjection] = useState(true);

  const [jurisdiction, setJurisdiction] = useState("");
  const [includeRows, setIncludeRows] = useState(true);
  const [includeFrozenTotals, setIncludeFrozenTotals] = useState(true);

  const [breakevenReportDate, setBreakevenReportDate] = useState(
    normalizeDateInputValue(now)
  );

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

  const ordersParams = useMemo(
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

  const frozenParams = useMemo(
    () => ({
      month,
      year,
      status: status || undefined,
      enterprise_name: enterpriseName || undefined,
      jurisdiction: jurisdiction || undefined,
      prepared_by: preparedBy || undefined,
      include_rows: includeRows,
      include_totals: includeFrozenTotals,
      include_summary: false,
    }),
    [
      month,
      year,
      status,
      enterpriseName,
      jurisdiction,
      preparedBy,
      includeRows,
      includeFrozenTotals,
    ]
  );

  // Breakeven params: only report_date, prepared_by, include_rows
  const breakevenParams = useMemo(
    () => ({
      report_date: breakevenReportDate || undefined,
      prepared_by: preparedBy || undefined,
      include_rows: includeRows,
    }),
    [breakevenReportDate, preparedBy, includeRows]
  );

  const frozenRows = useMemo(() => normalizeFrozenRows(reportData), [reportData]);

  const frozenTotals = useMemo(() => {
    const totals = reportData?.totals || {};

    return {
      total_orders:
        totals.total_orders !== undefined ? Number(totals.total_orders || 0) : frozenRows.length,
      total_quantity_kg:
        totals.total_quantity_kg !== undefined
          ? Number(totals.total_quantity_kg || 0)
          : sumBy(frozenRows, "total_quantity_kg"),
      total_pieces_required:
        totals.total_pieces_required !== undefined
          ? Number(totals.total_pieces_required || 0)
          : sumBy(frozenRows, "total_pieces_required"),
      total_container_value_usd:
        totals.total_container_value_usd !== undefined
          ? Number(totals.total_container_value_usd || 0)
          : sumBy(frozenRows, "container_value_usd"),
      total_down_payment_usd:
        totals.total_down_payment_usd !== undefined
          ? Number(totals.total_down_payment_usd || 0)
          : sumBy(frozenRows, "down_payment_usd"),
      total_balance_usd:
        totals.total_balance_usd !== undefined
          ? Number(totals.total_balance_usd || 0)
          : sumBy(frozenRows, "balance_usd"),
    };
  }, [reportData, frozenRows]);

  function resetPreview() {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = "";
    }
    setPdfPreviewUrl("");
  }

  async function loadReportData() {
    setIsLoadingData(true);
    setError("");

    try {
      if (reportType === "orders") {
        const data = await reportService.getOrdersMonthlyReportData(ordersParams);
        setReportData(data);
      } else if (reportType === "frozen") {
        const data = await reportService.getFrozenContainersMonthlyReportData(frozenParams);
        setReportData(data);
      } else {
        const data = await reportService.getBreakevenSummaryReportData(breakevenParams);
        setReportData(data);
      }
    } catch (err) {
      setError(err?.message || "Failed to load report data");
    } finally {
      setIsLoadingData(false);
    }
  }

  async function loadPdfPreview() {
    setIsLoadingPreview(true);
    setError("");

    try {
      let result;

      if (reportType === "orders") {
        result = await reportService.exportOrdersMonthlyReport({
          ...ordersParams,
          format: "pdf",
        });
      } else if (reportType === "frozen") {
        result = await reportService.exportFrozenContainersMonthlyReport({
          ...frozenParams,
          format: "pdf",
        });
      } else {
        result = await reportService.exportBreakevenSummaryReport({
          ...breakevenParams,
          format: "pdf",
        });
      }

      resetPreview();

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
    setIsDownloading(format);
    setError("");

    try {
      if (reportType === "orders") {
        await reportService.downloadOrdersMonthlyReport({
          ...ordersParams,
          format,
        });
      } else if (reportType === "frozen") {
        await reportService.downloadFrozenContainersMonthlyReport({
          ...frozenParams,
          format,
        });
      } else {
        await reportService.downloadBreakevenSummaryReport({
          ...breakevenParams,
          format,
        });
      }
    } catch (err) {
      setError(err?.message || `Failed to download ${format.toUpperCase()} report`);
    } finally {
      setIsDownloading("");
    }
  }

  useEffect(() => {
    setReportData(null);
    setError("");
    resetPreview();
    loadReportData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportType]);

  const renderOrdersReport = () => {
    const summary = reportData?.summary;
    const sections = reportData?.sections || [];
    const totals = reportData?.totals;
    const projection = reportData?.animal_projection;

    return (
      <>
        {summary ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 12,
              marginBottom: 18,
            }}
          >
            <SummaryCard label="Total Orders" value={formatInt(summary.total_orders)} />
            <SummaryCard
              label="Total Quantity"
              value={`${formatDecimal(summary.total_quantity_kg)} kg`}
            />
            <SummaryCard
              label="Total Pieces Required"
              value={formatInt(summary.total_pieces_required)}
            />
            <SummaryCard
              label="Total Animals Required"
              value={formatInt(summary.total_animals_required)}
            />
            <SummaryCard label="Local Orders" value={formatInt(summary.local_total_orders)} />
            <SummaryCard label="Chilled Orders" value={formatInt(summary.chilled_total_orders)} />
            <SummaryCard label="Frozen Orders" value={formatInt(summary.frozen_total_orders)} />
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
              <SectionTable key={section.section_key} section={section} />
            ))
          ) : (
            <EmptyBlock text="No report sections available for the selected filters." />
          )}
        </div>
      </>
    );
  };

  const renderFrozenReport = () => {
    return (
      <>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 12,
            marginBottom: 18,
          }}
        >
          <SummaryCard
            label="Total Containers"
            value={formatInt(frozenTotals.total_orders)}
          />
          <SummaryCard
            label="Total Quantity"
            value={`${formatDecimal(frozenTotals.total_quantity_kg)} kg`}
          />
          <SummaryCard
            label="Total Pieces"
            value={formatInt(frozenTotals.total_pieces_required)}
          />
          <SummaryCard
            label="Container Value"
            value={formatMoney(frozenTotals.total_container_value_usd)}
          />
          <SummaryCard
            label="Down Payment"
            value={formatMoney(frozenTotals.total_down_payment_usd)}
          />
          <SummaryCard
            label="Balance"
            value={formatMoney(frozenTotals.total_balance_usd)}
          />
        </div>

        {includeRows && frozenRows.length > 0 ? (
          <div style={{ marginBottom: 18 }}>
            <FrozenContainersTable rows={frozenRows} />
          </div>
        ) : null}

        {includeFrozenTotals ? (
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
              <strong>Total Containers:</strong> {formatInt(frozenTotals.total_orders)}
            </span>
            <span>
              <strong>Total Quantity:</strong> {formatDecimal(frozenTotals.total_quantity_kg)} kg
            </span>
            <span>
              <strong>Total Value:</strong> {formatMoney(frozenTotals.total_container_value_usd)}
            </span>
            <span>
              <strong>Total Down Payment:</strong> {formatMoney(frozenTotals.total_down_payment_usd)}
            </span>
            <span>
              <strong>Total Balance:</strong> {formatMoney(frozenTotals.total_balance_usd)}
            </span>
          </div>
        ) : null}

        {!frozenRows.length ? (
          <EmptyBlock text="No frozen containers data for the selected filters." />
        ) : null}
      </>
    );
  };

  const renderBreakevenReport = () => {
    const totals = reportData?.totals;
    const rows = reportData?.rows || [];
    const setting = reportData?.setting;

    return (
      <>
        {totals ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 12,
              marginBottom: 18,
            }}
          >
            <SummaryCard
              label="Break Even Point"
              value={`${formatDecimal(totals.break_even_quantity_tonnes)} tonnes`}
              sub={formatMoney(totals.break_even_value_usd)}
              accent={PURPLE}
            />
            <SummaryCard
              label="Booked Turnover"
              value={`${formatDecimal(totals.total_booked_quantity_tonnes)} tonnes`}
              sub={formatMoney(totals.total_booked_value_usd)}
              accent={BLUE}
            />
            <SummaryCard
              label="Delivered"
              value={`${formatDecimal(totals.total_delivered_quantity_tonnes)} tonnes`}
              sub={formatMoney(totals.total_delivered_value_usd)}
              accent={GREEN}
            />
            <SummaryCard
              label="Booked vs Breakeven"
              value={formatPercent(totals.booked_vs_break_even_percentage)}
            />
            <SummaryCard
              label="Delivered vs Breakeven"
              value={formatPercent(totals.delivered_vs_break_even_percentage)}
            />
            <SummaryCard
              label="Setting"
              value={setting?.setting_name || "Default"}
              sub={`USD/tonne: ${formatMoney(setting?.break_even_usd_per_tonne)}`}
            />
          </div>
        ) : null}

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
            <strong>Report Date:</strong> {formatDate(reportData?.report_date)}
          </span>
          <span>
            <strong>Month:</strong> {formatInt(reportData?.month)}
          </span>
          <span>
            <strong>Year:</strong> {formatInt(reportData?.year)}
          </span>
          <span>
            <strong>Rows:</strong> {formatInt(rows.length)}
          </span>
        </div>

        {rows.length ? (
          <div style={{ marginBottom: 18 }}>
            <BreakevenTable rows={rows} />
          </div>
        ) : (
          <EmptyBlock text="No breakeven data for the selected filters." />
        )}
      </>
    );
  };

  return (
    <>
      <Head>
        <title>Reports | UMG</title>
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
              <div
                style={{
                  fontSize: 24,
                  fontWeight: 700,
                  color: TEXT,
                  marginBottom: 6,
                }}
              >
                Reports
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: MUTED,
                  lineHeight: 1.5,
                  maxWidth: 760,
                }}
              >
                Review report data, preview the PDF version, and download CSV, PDF,
                or Word exports.
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
                style={secondaryButtonStyle(isLoadingData, BLUE)}
              >
                {isLoadingData ? "Loading..." : "Refresh Data"}
              </button>

              <button
                onClick={loadPdfPreview}
                disabled={isLoadingPreview}
                style={primaryButtonStyle(isLoadingPreview)}
              >
                {isLoadingPreview ? "Preparing PDF..." : "Preview PDF"}
              </button>

              <button
                onClick={() => downloadReport("csv")}
                disabled={Boolean(isDownloading)}
                style={secondaryButtonStyle(Boolean(isDownloading), TEXT)}
              >
                {isDownloading === "csv" ? "Downloading..." : "CSV"}
              </button>

              <button
                onClick={() => downloadReport("pdf")}
                disabled={Boolean(isDownloading)}
                style={secondaryButtonStyle(Boolean(isDownloading), TEXT)}
              >
                {isDownloading === "pdf" ? "Downloading..." : "PDF"}
              </button>

              <button
                onClick={() => downloadReport("docx")}
                disabled={Boolean(isDownloading)}
                style={secondaryButtonStyle(Boolean(isDownloading), TEXT)}
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
                display: "flex",
                gap: 10,
                alignItems: "center",
                flexWrap: "wrap",
                marginBottom: 16,
              }}
            >
              <ReportTabButton
                active={reportType === "orders"}
                label="Orders Monthly Report"
                color={BLUE}
                onClick={() => setReportType("orders")}
              />
              <ReportTabButton
                active={reportType === "frozen"}
                label="Frozen Containers Monthly Report"
                color={ORANGE}
                onClick={() => setReportType("frozen")}
              />
              <ReportTabButton
                active={reportType === "breakeven"}
                label="Breakeven Summary Report"
                color={PURPLE}
                onClick={() => setReportType("breakeven")}
              />
            </div>

            {reportType === "orders" ? (
              <>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                    gap: 12,
                    marginBottom: 14,
                  }}
                >
                  <div>
                    <label style={fieldLabelStyle}>Month</label>
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
                    <label style={fieldLabelStyle}>Year</label>
                    <input
                      type="number"
                      min={2000}
                      value={year}
                      onChange={(e) => setYear(Number(e.target.value || now.getFullYear()))}
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label style={fieldLabelStyle}>Status</label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                      style={inputStyle}
                    >
                      {STATUS_OPTIONS.map((option) => (
                        <option key={option.label} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={fieldLabelStyle}>Enterprise Name</label>
                    <input
                      type="text"
                      value={enterpriseName}
                      onChange={(e) => setEnterpriseName(e.target.value)}
                      placeholder="Search enterprise"
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label style={fieldLabelStyle}>Prepared By</label>
                    <input
                      type="text"
                      value={preparedBy}
                      onChange={(e) => setPreparedBy(e.target.value)}
                      placeholder="Prepared by name"
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label style={fieldLabelStyle}>Order Type</label>
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
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: 16,
                    flexWrap: "wrap",
                  }}
                >
                  <Toggle checked={includeSummary} onChange={setIncludeSummary} label="Include summary" />
                  <Toggle checked={includeSections} onChange={setIncludeSections} label="Include sections" />
                  <Toggle checked={includeTotals} onChange={setIncludeTotals} label="Include totals" />
                  <Toggle
                    checked={includeAnimalProjection}
                    onChange={setIncludeAnimalProjection}
                    label="Include animal projection"
                  />
                </div>
              </>
            ) : null}

            {reportType === "frozen" ? (
              <>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                    gap: 12,
                    marginBottom: 14,
                  }}
                >
                  <div>
                    <label style={fieldLabelStyle}>Month</label>
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
                    <label style={fieldLabelStyle}>Year</label>
                    <input
                      type="number"
                      min={2000}
                      value={year}
                      onChange={(e) => setYear(Number(e.target.value || now.getFullYear()))}
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label style={fieldLabelStyle}>Status</label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                      style={inputStyle}
                    >
                      {STATUS_OPTIONS.map((option) => (
                        <option key={option.label} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={fieldLabelStyle}>Enterprise Name</label>
                    <input
                      type="text"
                      value={enterpriseName}
                      onChange={(e) => setEnterpriseName(e.target.value)}
                      placeholder="Search enterprise"
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label style={fieldLabelStyle}>Prepared By</label>
                    <input
                      type="text"
                      value={preparedBy}
                      onChange={(e) => setPreparedBy(e.target.value)}
                      placeholder="Prepared by name"
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label style={fieldLabelStyle}>Jurisdiction</label>
                    <input
                      type="text"
                      value={jurisdiction}
                      onChange={(e) => setJurisdiction(e.target.value)}
                      placeholder="Qatar, Oman, etc."
                      style={inputStyle}
                    />
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: 16,
                    flexWrap: "wrap",
                  }}
                >
                  <Toggle checked={includeRows} onChange={setIncludeRows} label="Include rows" />
                  <Toggle checked={includeFrozenTotals} onChange={setIncludeFrozenTotals} label="Include totals" />
                </div>
              </>
            ) : null}

            {reportType === "breakeven" ? (
              <>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                    gap: 12,
                    marginBottom: 14,
                  }}
                >
                  <div>
                    <label style={fieldLabelStyle}>Report Date</label>
                    <input
                      type="date"
                      value={breakevenReportDate}
                      onChange={(e) => setBreakevenReportDate(e.target.value)}
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label style={fieldLabelStyle}>Prepared By</label>
                    <input
                      type="text"
                      value={preparedBy}
                      onChange={(e) => setPreparedBy(e.target.value)}
                      placeholder="Prepared by name"
                      style={inputStyle}
                    />
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: 16,
                    flexWrap: "wrap",
                  }}
                >
                  <Toggle checked={includeRows} onChange={setIncludeRows} label="Include rows" />
                </div>
              </>
            ) : null}
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

          {reportType === "orders"
            ? renderOrdersReport()
            : reportType === "frozen"
            ? renderFrozenReport()
            : renderBreakevenReport()}

          <div
            style={{
              border: `1px solid ${BORDER}`,
              borderRadius: 16,
              background: PAGE_BG,
              overflow: "hidden",
              marginTop: 24,
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
                  Load the generated PDF here to inspect the final report layout.
                </div>
              </div>

              <button
                onClick={loadPdfPreview}
                disabled={isLoadingPreview}
                style={primaryButtonStyle(isLoadingPreview)}
              >
                {isLoadingPreview ? "Preparing..." : "Reload Preview"}
              </button>
            </div>

            <div
              style={{
                height: 720,
                background: SOFT_2,
              }}
            >
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

function primaryButtonStyle(disabled) {
  return {
    border: `1px solid ${BLUE}`,
    background: BLUE,
    color: "#fff",
    height: 40,
    padding: "0 16px",
    borderRadius: 10,
    cursor: disabled ? "not-allowed" : "pointer",
    fontSize: 13,
    fontWeight: 700,
    opacity: disabled ? 0.75 : 1,
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
    opacity: disabled ? 0.75 : 1,
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

const cellStyle = {
  padding: "12px",
  borderBottom: `1px solid ${BORDER}`,
  color: TEXT,
  verticalAlign: "top",
};

const projectionCellStyle = {
  padding: "12px",
  borderBottom: `1px solid ${BORDER}`,
};

const projectionTotalStyle = {
  padding: "12px",
  borderTop: `1px solid ${BORDER}`,
  fontWeight: 700,
};

const frozenTotalCellStyle = {
  padding: "12px",
  borderTop: `1px solid ${BORDER}`,
  fontWeight: 700,
  color: TEXT,
};