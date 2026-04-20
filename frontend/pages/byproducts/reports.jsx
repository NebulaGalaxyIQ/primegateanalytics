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
  if (Array.isArray(response?.rows)) return response.rows;
  if (Array.isArray(response?.data?.rows)) return response.data.rows;
  if (Array.isArray(response?.points)) return response.points;
  if (Array.isArray(response?.data?.points)) return response.data.points;
  if (Array.isArray(response?.data)) return response.data;
  return [];
}

function formatMoney(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "0.00";
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatValue(value) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";

  if (typeof value === "number") {
    return Number.isInteger(value)
      ? value.toLocaleString()
      : value.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return "—";

    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const [y, m, d] = trimmed.split("-").map(Number);
      const date = new Date(y, m - 1, d);
      if (!Number.isNaN(date.getTime())) {
        return date.toLocaleDateString(undefined, {
          year: "numeric",
          month: "short",
          day: "numeric",
        });
      }
    }

    return trimmed.replace(/_/g, " ");
  }

  return String(value);
}

function isPrimitive(value) {
  return (
    value === null ||
    value === undefined ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  );
}

function getPrimitiveKeys(list = []) {
  const seen = new Set();

  list.slice(0, 20).forEach((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return;
    Object.entries(item).forEach(([key, value]) => {
      if (isPrimitive(value)) {
        seen.add(key);
      }
    });
  });

  return Array.from(seen);
}

function flattenMetrics(source, prefix = "") {
  if (!source || typeof source !== "object" || Array.isArray(source)) return [];

  const result = [];

  Object.entries(source).forEach(([key, value]) => {
    const label = prefix ? `${prefix}.${key}` : key;

    if (isPrimitive(value)) {
      result.push({ key: label, value });
      return;
    }

    if (value && typeof value === "object" && !Array.isArray(value)) {
      flattenMetrics(value, label).forEach((item) => result.push(item));
    }
  });

  return result;
}

function parseYmd(value) {
  if (!value || typeof value !== "string") return null;
  const parts = value.split("-").map(Number);
  if (parts.length !== 3) return null;
  const [y, m, d] = parts;
  const date = new Date(y, m - 1, d);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toYmd(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, "0");
  const d = `${date.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function todayIso() {
  return toYmd(new Date());
}

function getMonthRange(year, month) {
  const y = Number(year);
  const m = Number(month);

  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) {
    return { date_from: "", date_to: "" };
  }

  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 0);

  return {
    date_from: toYmd(start),
    date_to: toYmd(end),
  };
}

function getWeekRange(targetDate) {
  const date = parseYmd(targetDate);
  if (!date) return { date_from: "", date_to: "" };

  const day = (date.getDay() + 6) % 7;
  const start = new Date(date);
  start.setDate(date.getDate() - day);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);

  return {
    date_from: toYmd(start),
    date_to: toYmd(end),
  };
}

function getInitialFilters() {
  const today = todayIso();
  const now = new Date();

  return {
    report_type: "daily",
    report_date: today,
    target_date: today,
    month: `${now.getMonth() + 1}`,
    year: `${now.getFullYear()}`,
    date_from: today,
    date_to: today,
    customer_id: "",
    byproduct_id: "",
    category_id: "",
    group_by: "",
    search: "",
    include_void: false,
    include_deleted: false,
  };
}

function reportPeriodText(report, filters) {
  const period = report?.period || report?.data?.period || null;

  if (period?.date_from || period?.date_to) {
    return `${formatValue(period.date_from)} to ${formatValue(period.date_to)}`;
  }

  if (report?.report_date) {
    return formatValue(report.report_date);
  }

  if (report?.report_date_from || report?.report_date_to) {
    return `${formatValue(report.report_date_from)} to ${formatValue(
      report.report_date_to
    )}`;
  }

  if (filters.report_type === "daily") {
    return formatValue(filters.report_date);
  }

  if (filters.report_type === "weekly") {
    const weekRange = getWeekRange(filters.target_date);
    return `${formatValue(weekRange.date_from)} to ${formatValue(
      weekRange.date_to
    )}`;
  }

  if (filters.report_type === "monthly") {
    const monthRange = getMonthRange(filters.year, filters.month);
    return `${formatValue(monthRange.date_from)} to ${formatValue(
      monthRange.date_to
    )}`;
  }

  return `${formatValue(filters.date_from)} to ${formatValue(filters.date_to)}`;
}

function getReportRows(report) {
  return coerceItems(report?.rows ? report : report?.data ? report.data : report);
}

function getGroupedRows(report) {
  if (Array.isArray(report?.grouped_rows)) return report.grouped_rows;
  if (Array.isArray(report?.groupedRows)) return report.groupedRows;
  if (Array.isArray(report?.data?.grouped_rows)) return report.data.grouped_rows;
  if (Array.isArray(report?.data?.groupedRows)) return report.data.groupedRows;
  if (Array.isArray(report?.groups)) return report.groups;
  if (Array.isArray(report?.data?.groups)) return report.data.groups;
  return [];
}

function getTotals(report) {
  if (report?.totals && typeof report.totals === "object") return report.totals;
  if (report?.data?.totals && typeof report.data.totals === "object") {
    return report.data.totals;
  }
  if (report?.summary && typeof report.summary === "object") return report.summary;
  if (report?.data?.summary && typeof report.data.summary === "object") {
    return report.data.summary;
  }
  return {};
}

function getSummaryList(response) {
  return coerceItems(response);
}

function getTrendPoints(response) {
  return coerceItems(response);
}

function getMainReportPayload(filters) {
  return {
    customer_id: filters.customer_id || undefined,
    byproduct_id: filters.byproduct_id || undefined,
    category_id: filters.category_id || undefined,
    include_void: filters.include_void,
    include_deleted: filters.include_deleted,
    group_by: filters.group_by || undefined,
    search: filters.search || undefined,
  };
}

function getResolvedRange(filters) {
  if (filters.report_type === "daily") {
    return {
      date_from: filters.report_date || "",
      date_to: filters.report_date || "",
    };
  }

  if (filters.report_type === "weekly") {
    return getWeekRange(filters.target_date);
  }

  if (filters.report_type === "monthly") {
    return getMonthRange(filters.year, filters.month);
  }

  return {
    date_from: filters.date_from || "",
    date_to: filters.date_to || "",
  };
}

function getReportFilterForGeneration(filters) {
  const base = getMainReportPayload(filters);

  if (filters.report_type === "daily") {
    const date = filters.report_date || todayIso();

    return {
      report_type: "daily",
      date_from: date,
      date_to: date,
      ...base,
    };
  }

  if (filters.report_type === "weekly") {
    const range = getWeekRange(filters.target_date);

    return {
      report_type: "weekly",
      date_from: range.date_from,
      date_to: range.date_to,
      ...base,
    };
  }

  if (filters.report_type === "monthly") {
    const range = getMonthRange(filters.year, filters.month);

    return {
      report_type: "monthly",
      date_from: range.date_from,
      date_to: range.date_to,
      ...base,
    };
  }

  if (filters.report_type === "custom_period") {
    return {
      report_type: "custom_period",
      date_from: filters.date_from || "",
      date_to: filters.date_to || "",
      ...base,
    };
  }

  return {
    report_type: "accumulation",
    date_from: filters.date_from || "",
    date_to: filters.date_to || "",
    ...base,
  };
}

function ReportMetricCard({ title, value, color = TEXT }) {
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

function StatusBadge({ label }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "6px 10px",
        borderRadius: 999,
        background: ORANGE_SOFT,
        color: ORANGE_DEEP,
        fontSize: 12,
        fontWeight: 800,
      }}
    >
      {label}
    </span>
  );
}

export default function ByproductsReportsPage() {
  const [filters, setFilters] = useState(getInitialFilters());
  const [customers, setCustomers] = useState([]);
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);

  const [reportData, setReportData] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);
  const [customerSummary, setCustomerSummary] = useState([]);
  const [byproductSummary, setByproductSummary] = useState([]);
  const [categorySummary, setCategorySummary] = useState([]);
  const [trendPoints, setTrendPoints] = useState([]);
  const [compareData, setCompareData] = useState(null);
  const [lastGeneratedDocument, setLastGeneratedDocument] = useState(null);

  const [screenWidth, setScreenWidth] = useState(1280);
  const [loadingLookups, setLoadingLookups] = useState(true);
  const [runningReport, setRunningReport] = useState(false);
  const [loadingDashboard, setLoadingDashboard] = useState(false);
  const [loadingSummaries, setLoadingSummaries] = useState(false);
  const [loadingTrend, setLoadingTrend] = useState(false);
  const [loadingCompare, setLoadingCompare] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [generatingSource, setGeneratingSource] = useState(false);
  const [openingLastFile, setOpeningLastFile] = useState(false);
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

  const loadLookups = useCallback(async () => {
    setLoadingLookups(true);
    setError("");

    try {
      const [customersResponse, itemsResponse, categoriesResponse] = await Promise.all([
        ByproductsService.getCustomerSelection(),
        ByproductsService.getItemSelection(),
        ByproductsService.getCategorySelection(),
      ]);

      setCustomers(coerceItems(customersResponse));
      setItems(coerceItems(itemsResponse));
      setCategories(coerceItems(categoriesResponse));
    } catch (err) {
      setError(err?.message || "Failed to load report filters.");
    } finally {
      setLoadingLookups(false);
    }
  }, []);

  useEffect(() => {
    loadLookups();
  }, [loadLookups]);

  const rows = useMemo(() => getReportRows(reportData), [reportData]);
  const groupedRows = useMemo(() => getGroupedRows(reportData), [reportData]);
  const totals = useMemo(() => getTotals(reportData), [reportData]);

  const mainMetricCards = useMemo(() => {
    return [
      { title: "Rows", value: rows.length, color: TEXT },
      { title: "Grouped", value: groupedRows.length, color: BLUE },
      { title: "Quantity", value: formatValue(totals.total_quantity), color: GREEN },
      {
        title: "Total Amount",
        value: formatMoney(totals.total_amount),
        color: ORANGE_DEEP,
      },
      { title: "Paid", value: formatMoney(totals.amount_paid), color: BLUE },
      {
        title: "Balance Due",
        value: formatMoney(totals.balance_due),
        color: Number(totals.balance_due || 0) > 0 ? RED : GREEN,
      },
      {
        title: "Transactions",
        value: formatValue(totals.transaction_count),
        color: TEXT,
      },
      { title: "Customers", value: formatValue(totals.customer_count), color: BLUE },
    ];
  }, [rows.length, groupedRows.length, totals]);

  const dashboardCards = useMemo(() => {
    const metrics = flattenMetrics(dashboardData || {}).filter(
      (item) =>
        item.key !== "date_from" &&
        item.key !== "date_to" &&
        item.key !== "period" &&
        item.key !== "label"
    );

    return metrics.slice(0, 12);
  }, [dashboardData]);

  const compareCards = useMemo(() => {
    return flattenMetrics(compareData || {}).slice(0, 16);
  }, [compareData]);

  const genericCustomerSummaryColumns = useMemo(
    () => getPrimitiveKeys(customerSummary).slice(0, 6),
    [customerSummary]
  );

  const genericByproductSummaryColumns = useMemo(
    () => getPrimitiveKeys(byproductSummary).slice(0, 6),
    [byproductSummary]
  );

  const genericCategorySummaryColumns = useMemo(
    () => getPrimitiveKeys(categorySummary).slice(0, 6),
    [categorySummary]
  );

  const trendColumns = useMemo(
    () => getPrimitiveKeys(trendPoints).slice(0, 6),
    [trendPoints]
  );

  async function handleRunReport() {
    setRunningReport(true);
    setError("");
    setSuccess("");

    try {
      const base = getMainReportPayload(filters);
      let response;

      if (filters.report_type === "daily") {
        response = await ByproductsService.getDailyReport({
          report_date: filters.report_date,
          ...base,
        });
      } else if (filters.report_type === "weekly") {
        response = await ByproductsService.getWeeklyReport({
          target_date: filters.target_date,
          ...base,
        });
      } else if (filters.report_type === "monthly") {
        response = await ByproductsService.getMonthlyReport({
          month: Number(filters.month),
          year: Number(filters.year),
          ...base,
        });
      } else if (filters.report_type === "custom_period") {
        response = await ByproductsService.getCustomPeriodReport({
          date_from: filters.date_from,
          date_to: filters.date_to,
          ...base,
        });
      } else {
        response = await ByproductsService.getAccumulationReport({
          date_from: filters.date_from,
          date_to: filters.date_to,
          ...base,
        });
      }

      setReportData(response);
      setSuccess("Report loaded successfully.");
    } catch (err) {
      setError(err?.message || "Failed to load report.");
    } finally {
      setRunningReport(false);
    }
  }

  async function generateDocument(kind) {
    const isPdf = kind === "pdf";
    const setBusy = isPdf ? setGeneratingPdf : setGeneratingSource;

    setBusy(true);
    setError("");
    setSuccess("");

    try {
      const template = await ByproductsService.getDefaultTemplate(filters.report_type);

      if (!template?.id) {
        throw new Error(
          `No default ${filters.report_type} template was found. Set a default template first.`
        );
      }

      const outputFormat = isPdf
        ? "pdf"
        : String(template.template_format || "docx").toLowerCase();

      const payload = {
        template_id: template.id,
        output_format: outputFormat,
        report_filter: getReportFilterForGeneration(filters),
      };

      const generated = await ByproductsService.generateReportDocument(payload);
      setLastGeneratedDocument(generated);

      if (isPdf) {
        await ByproductsService.downloadGeneratedDocument(generated);
      } else {
        await ByproductsService.downloadGeneratedDocument(generated);
      }

      setSuccess(`${generated?.file_name || "Document"} generated successfully.`);
    } catch (err) {
      setError(err?.message || "Failed to generate document.");
    } finally {
      setBusy(false);
    }
  }

  async function handleOpenLastGeneratedFile() {
    setError("");
    setSuccess("");

    if (!lastGeneratedDocument) {
      setError("No generated file is available to open yet.");
      return;
    }

    setOpeningLastFile(true);
    try {
      await ByproductsService.openGeneratedDocument(lastGeneratedDocument);
      setSuccess(`${lastGeneratedDocument.file_name || "Document"} opened successfully.`);
    } catch (err) {
      setError(err?.message || "Failed to open the generated file.");
    } finally {
      setOpeningLastFile(false);
    }
  }

  async function handleLoadDashboard() {
    const range = getResolvedRange(filters);

    if (!range.date_from || !range.date_to) {
      setError("Please set valid report dates first.");
      return;
    }

    setLoadingDashboard(true);
    setError("");
    setSuccess("");

    try {
      const response = await ByproductsService.getDashboard({
        date_from: range.date_from,
        date_to: range.date_to,
      });

      setDashboardData(response);
      setSuccess("Dashboard loaded successfully.");
    } catch (err) {
      setError(err?.message || "Failed to load dashboard.");
    } finally {
      setLoadingDashboard(false);
    }
  }

  async function handleLoadSummaries() {
    const range = getResolvedRange(filters);

    if (!range.date_from || !range.date_to) {
      setError("Please set valid report dates first.");
      return;
    }

    setLoadingSummaries(true);
    setError("");
    setSuccess("");

    try {
      const [customerResp, byproductResp, categoryResp] = await Promise.all([
        ByproductsService.getCustomerSummary({
          date_from: range.date_from,
          date_to: range.date_to,
          customer_id: filters.customer_id || undefined,
        }),
        ByproductsService.getByproductSummary({
          date_from: range.date_from,
          date_to: range.date_to,
          category_id: filters.category_id || undefined,
          byproduct_id: filters.byproduct_id || undefined,
        }),
        ByproductsService.getCategorySummary({
          date_from: range.date_from,
          date_to: range.date_to,
        }),
      ]);

      setCustomerSummary(getSummaryList(customerResp));
      setByproductSummary(getSummaryList(byproductResp));
      setCategorySummary(getSummaryList(categoryResp));
      setSuccess("Summaries loaded successfully.");
    } catch (err) {
      setError(err?.message || "Failed to load summaries.");
    } finally {
      setLoadingSummaries(false);
    }
  }

  async function handleLoadTrend() {
    const range = getResolvedRange(filters);

    if (!range.date_from || !range.date_to) {
      setError("Please set valid report dates first.");
      return;
    }

    setLoadingTrend(true);
    setError("");
    setSuccess("");

    try {
      const response = await ByproductsService.getTrendReport({
        interval:
          filters.report_type === "monthly"
            ? "week"
            : filters.report_type === "weekly"
            ? "day"
            : "day",
        report_type:
          filters.report_type === "custom_period"
            ? "custom_period"
            : filters.report_type,
        date_from: range.date_from,
        date_to: range.date_to,
        customer_id: filters.customer_id || undefined,
        byproduct_id: filters.byproduct_id || undefined,
        category_id: filters.category_id || undefined,
        include_void: filters.include_void,
        include_deleted: filters.include_deleted,
        group_by: filters.group_by || undefined,
        search: filters.search || undefined,
      });

      setTrendPoints(getTrendPoints(response));
      setSuccess("Trend report loaded successfully.");
    } catch (err) {
      setError(err?.message || "Failed to load trend report.");
    } finally {
      setLoadingTrend(false);
    }
  }

  async function handleCompare() {
    const range = getResolvedRange(filters);

    if (!range.date_from || !range.date_to) {
      setError("Please set valid report dates first.");
      return;
    }

    setLoadingCompare(true);
    setError("");
    setSuccess("");

    try {
      const response = await ByproductsService.compareWithPreviousPeriod({
        report_type:
          filters.report_type === "custom_period"
            ? "custom_period"
            : filters.report_type,
        date_from: range.date_from,
        date_to: range.date_to,
        customer_id: filters.customer_id || undefined,
        byproduct_id: filters.byproduct_id || undefined,
        category_id: filters.category_id || undefined,
        include_void: filters.include_void,
        include_deleted: filters.include_deleted,
        group_by: filters.group_by || undefined,
        search: filters.search || undefined,
      });

      setCompareData(response);
      setSuccess("Comparison loaded successfully.");
    } catch (err) {
      setError(err?.message || "Failed to compare report periods.");
    } finally {
      setLoadingCompare(false);
    }
  }

  function clearPage() {
    setFilters(getInitialFilters());
    setReportData(null);
    setDashboardData(null);
    setCustomerSummary([]);
    setByproductSummary([]);
    setCategorySummary([]);
    setTrendPoints([]);
    setCompareData(null);
    setLastGeneratedDocument(null);
    setError("");
    setSuccess("");
  }

  return (
    <>
      <Head>
        <title>Byproducts Reports</title>
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
            maxWidth: 1480,
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
                  Reports
                </h1>

                <p
                  style={{
                    margin: "8px 0 0",
                    color: MUTED,
                    fontSize: 14,
                    lineHeight: 1.7,
                    maxWidth: 860,
                  }}
                >
                  Run daily, weekly, monthly, custom period, and accumulation
                  reports. Download buttons generate the file using the default
                  template for the current report type.
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
                <ReportMetricCard
                  title="Customers"
                  value={loadingLookups ? "..." : customers.length}
                  color={TEXT}
                />
                <ReportMetricCard
                  title="Items"
                  value={loadingLookups ? "..." : items.length}
                  color={BLUE}
                />
                <ReportMetricCard
                  title="Categories"
                  value={loadingLookups ? "..." : categories.length}
                  color={GREEN}
                />
                <ReportMetricCard
                  title="Period"
                  value={
                    reportData
                      ? reportPeriodText(reportData, filters)
                      : filters.report_type
                  }
                  color={ORANGE_DEEP}
                />
              </div>
            </div>

            <div
              style={{
                display: "flex",
                gap: 10,
                flexWrap: "wrap",
                marginTop: 16,
              }}
            >
              <button
                type="button"
                onClick={() => generateDocument("pdf")}
                disabled={generatingPdf}
                style={{
                  minHeight: 44,
                  padding: "0 16px",
                  borderRadius: 12,
                  border: "none",
                  background: ORANGE,
                  color: "#fff",
                  fontSize: 14,
                  fontWeight: 800,
                  cursor: generatingPdf ? "not-allowed" : "pointer",
                  opacity: generatingPdf ? 0.7 : 1,
                  width: isMobile ? "100%" : "auto",
                }}
              >
                {generatingPdf ? "Generating PDF..." : "Download PDF"}
              </button>

              <button
                type="button"
                onClick={() => generateDocument("source")}
                disabled={generatingSource}
                style={{
                  minHeight: 44,
                  padding: "0 16px",
                  borderRadius: 12,
                  border: `1px solid ${BORDER}`,
                  background: SURFACE,
                  color: TEXT,
                  fontSize: 14,
                  fontWeight: 800,
                  cursor: generatingSource ? "not-allowed" : "pointer",
                  opacity: generatingSource ? 0.7 : 1,
                  width: isMobile ? "100%" : "auto",
                }}
              >
                {generatingSource ? "Generating..." : "Download Document"}
              </button>

              <button
                type="button"
                onClick={handleOpenLastGeneratedFile}
                disabled={openingLastFile}
                style={{
                  minHeight: 44,
                  padding: "0 16px",
                  borderRadius: 12,
                  border: `1px solid ${BORDER}`,
                  background: SURFACE,
                  color: TEXT,
                  fontSize: 14,
                  fontWeight: 800,
                  cursor: openingLastFile ? "not-allowed" : "pointer",
                  opacity: openingLastFile ? 0.7 : 1,
                  width: isMobile ? "100%" : "auto",
                }}
              >
                {openingLastFile ? "Opening..." : "Open Last Generated File"}
              </button>
            </div>

            {lastGeneratedDocument?.file_name ? (
              <div
                style={{
                  marginTop: 12,
                  display: "inline-flex",
                  flexWrap: "wrap",
                  gap: 8,
                  padding: "8px 12px",
                  borderRadius: 12,
                  background: BLUE_SOFT,
                  color: BLUE,
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                Last generated: {lastGeneratedDocument.file_name}
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
                marginBottom: 16,
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
                  Report Filters
                </h2>
                <p
                  style={{
                    margin: "6px 0 0",
                    color: MUTED,
                    fontSize: 13,
                  }}
                >
                  Choose the report type, period, and filter options.
                </p>
              </div>

              <div
                style={{
                  display: "flex",
                  gap: 10,
                  flexWrap: "wrap",
                  width: isMobile ? "100%" : "auto",
                }}
              >
                <button
                  type="button"
                  onClick={handleRunReport}
                  disabled={runningReport}
                  style={{
                    minHeight: 44,
                    padding: "0 16px",
                    borderRadius: 12,
                    border: "none",
                    background: ORANGE,
                    color: "#fff",
                    fontSize: 14,
                    fontWeight: 800,
                    cursor: runningReport ? "not-allowed" : "pointer",
                    opacity: runningReport ? 0.7 : 1,
                    width: isMobile ? "100%" : "auto",
                  }}
                >
                  {runningReport ? "Running..." : "Run Report"}
                </button>

                <button
                  type="button"
                  onClick={clearPage}
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
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: isMobile ? "1fr" : "repeat(4, minmax(0, 1fr))",
                gap: 12,
              }}
            >
              <div>
                <label style={labelStyle}>Report Type</label>
                <select
                  value={filters.report_type}
                  onChange={(e) =>
                    setFilters((prev) => ({
                      ...prev,
                      report_type: e.target.value,
                    }))
                  }
                  style={inputStyle}
                >
                  <option value="daily">daily</option>
                  <option value="weekly">weekly</option>
                  <option value="monthly">monthly</option>
                  <option value="custom_period">custom period</option>
                  <option value="accumulation">accumulation</option>
                </select>
              </div>

              {filters.report_type === "daily" ? (
                <div>
                  <label style={labelStyle}>Report Date</label>
                  <input
                    type="date"
                    value={filters.report_date}
                    onChange={(e) =>
                      setFilters((prev) => ({
                        ...prev,
                        report_date: e.target.value,
                      }))
                    }
                    style={inputStyle}
                  />
                </div>
              ) : null}

              {filters.report_type === "weekly" ? (
                <div>
                  <label style={labelStyle}>Target Date</label>
                  <input
                    type="date"
                    value={filters.target_date}
                    onChange={(e) =>
                      setFilters((prev) => ({
                        ...prev,
                        target_date: e.target.value,
                      }))
                    }
                    style={inputStyle}
                  />
                </div>
              ) : null}

              {filters.report_type === "monthly" ? (
                <>
                  <div>
                    <label style={labelStyle}>Month</label>
                    <select
                      value={filters.month}
                      onChange={(e) =>
                        setFilters((prev) => ({
                          ...prev,
                          month: e.target.value,
                        }))
                      }
                      style={inputStyle}
                    >
                      {Array.from({ length: 12 }).map((_, index) => (
                        <option key={index + 1} value={String(index + 1)}>
                          {index + 1}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={labelStyle}>Year</label>
                    <input
                      type="number"
                      value={filters.year}
                      onChange={(e) =>
                        setFilters((prev) => ({
                          ...prev,
                          year: e.target.value,
                        }))
                      }
                      style={inputStyle}
                    />
                  </div>
                </>
              ) : null}

              {(filters.report_type === "custom_period" ||
                filters.report_type === "accumulation") ? (
                <>
                  <div>
                    <label style={labelStyle}>Date From</label>
                    <input
                      type="date"
                      value={filters.date_from}
                      onChange={(e) =>
                        setFilters((prev) => ({
                          ...prev,
                          date_from: e.target.value,
                        }))
                      }
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>Date To</label>
                    <input
                      type="date"
                      value={filters.date_to}
                      onChange={(e) =>
                        setFilters((prev) => ({
                          ...prev,
                          date_to: e.target.value,
                        }))
                      }
                      style={inputStyle}
                    />
                  </div>
                </>
              ) : null}

              <div>
                <label style={labelStyle}>Customer</label>
                <select
                  value={filters.customer_id}
                  onChange={(e) =>
                    setFilters((prev) => ({
                      ...prev,
                      customer_id: e.target.value,
                    }))
                  }
                  style={inputStyle}
                >
                  <option value="">All customers</option>
                  {customers.map((customer) => (
                    <option key={customer?.id} value={customer?.id}>
                      {customer?.customer_name ||
                        customer?.transaction_name ||
                        customer?.customer_code ||
                        "Unnamed Customer"}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={labelStyle}>Byproduct Item</label>
                <select
                  value={filters.byproduct_id}
                  onChange={(e) =>
                    setFilters((prev) => ({
                      ...prev,
                      byproduct_id: e.target.value,
                    }))
                  }
                  style={inputStyle}
                >
                  <option value="">All items</option>
                  {items.map((item) => (
                    <option key={item?.id} value={item?.id}>
                      {item?.name || item?.short_name || item?.code || "Unnamed Item"}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={labelStyle}>Category</label>
                <select
                  value={filters.category_id}
                  onChange={(e) =>
                    setFilters((prev) => ({
                      ...prev,
                      category_id: e.target.value,
                    }))
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
              </div>

              <div>
                <label style={labelStyle}>Group By</label>
                <select
                  value={filters.group_by}
                  onChange={(e) =>
                    setFilters((prev) => ({
                      ...prev,
                      group_by: e.target.value,
                    }))
                  }
                  style={inputStyle}
                >
                  <option value="">No grouping</option>
                  <option value="day">day</option>
                  <option value="week">week</option>
                  <option value="month">month</option>
                  <option value="customer">customer</option>
                  <option value="byproduct">byproduct</option>
                  <option value="category">category</option>
                </select>
              </div>

              <div style={{ gridColumn: isMobile ? "auto" : "span 2" }}>
                <label style={labelStyle}>Search</label>
                <input
                  value={filters.search}
                  onChange={(e) =>
                    setFilters((prev) => ({
                      ...prev,
                      search: e.target.value,
                    }))
                  }
                  placeholder="Search customer, item, transaction..."
                  style={inputStyle}
                />
              </div>

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
                  checked={filters.include_void}
                  onChange={(e) =>
                    setFilters((prev) => ({
                      ...prev,
                      include_void: e.target.checked,
                    }))
                  }
                />
                Include void
              </label>

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
                marginBottom: 16,
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
                  Report Overview
                </h2>
                <p
                  style={{
                    margin: "6px 0 0",
                    color: MUTED,
                    fontSize: 13,
                  }}
                >
                  Main report counters from the current result.
                </p>
              </div>

              <StatusBadge
                label={
                  reportData
                    ? `Period: ${reportPeriodText(reportData, filters)}`
                    : "No report loaded"
                }
              />
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: isMobile
                  ? "repeat(2, minmax(0, 1fr))"
                  : "repeat(4, minmax(0, 1fr))",
                gap: 12,
              }}
            >
              {mainMetricCards.map((card) => (
                <ReportMetricCard
                  key={card.title}
                  title={card.title}
                  value={card.value}
                  color={card.color}
                />
              ))}
            </div>
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
                marginBottom: 16,
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
                  Dashboard & Analytics
                </h2>
                <p
                  style={{
                    margin: "6px 0 0",
                    color: MUTED,
                    fontSize: 13,
                    lineHeight: 1.6,
                  }}
                >
                  Load dashboard cards, summaries, trend data, and previous-period comparison.
                </p>
              </div>

              <div
                style={{
                  display: "flex",
                  gap: 10,
                  flexWrap: "wrap",
                  width: isMobile ? "100%" : "auto",
                }}
              >
                <button
                  type="button"
                  onClick={handleLoadDashboard}
                  disabled={loadingDashboard}
                  style={secondaryBtn(isMobile)}
                >
                  {loadingDashboard ? "Loading..." : "Load Dashboard"}
                </button>

                <button
                  type="button"
                  onClick={handleLoadSummaries}
                  disabled={loadingSummaries}
                  style={secondaryBtn(isMobile)}
                >
                  {loadingSummaries ? "Loading..." : "Load Summaries"}
                </button>

                <button
                  type="button"
                  onClick={handleLoadTrend}
                  disabled={loadingTrend}
                  style={secondaryBtn(isMobile)}
                >
                  {loadingTrend ? "Loading..." : "Load Trend"}
                </button>

                <button
                  type="button"
                  onClick={handleCompare}
                  disabled={loadingCompare}
                  style={secondaryBtn(isMobile)}
                >
                  {loadingCompare ? "Loading..." : "Compare"}
                </button>
              </div>
            </div>

            {dashboardCards.length > 0 ? (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: isMobile
                    ? "repeat(2, minmax(0, 1fr))"
                    : "repeat(4, minmax(0, 1fr))",
                  gap: 12,
                }}
              >
                {dashboardCards.map((item) => (
                  <ReportMetricCard
                    key={item.key}
                    title={item.key.replace(/\./g, " · ").replace(/_/g, " ")}
                    value={formatValue(item.value)}
                    color={TEXT}
                  />
                ))}
              </div>
            ) : (
              <div
                style={{
                  border: `1px dashed ${BORDER}`,
                  borderRadius: 16,
                  padding: "18px 14px",
                  color: MUTED,
                  fontSize: 14,
                  textAlign: "center",
                }}
              >
                No dashboard metrics loaded yet.
              </div>
            )}
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
                  Report Rows
                </h2>
                <p
                  style={{
                    margin: "6px 0 0",
                    color: MUTED,
                    fontSize: 13,
                  }}
                >
                  Detailed report rows from the selected report type.
                </p>
              </div>
            </div>

            {rows.length === 0 ? (
              <EmptyState
                text={runningReport ? "Loading report rows..." : "No report rows available."}
              />
            ) : isMobile ? (
              <div style={{ display: "grid", gap: 12 }}>
                {rows.map((row, index) => (
                  <div
                    key={row?.id || row?.sale_line_id || index}
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
                        marginBottom: 10,
                        alignItems: "flex-start",
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            color: TEXT,
                            fontSize: 15,
                            fontWeight: 800,
                            lineHeight: 1.35,
                          }}
                        >
                          {row?.customer_name || row?.transaction_name || `Row ${index + 1}`}
                        </div>
                        <div
                          style={{
                            color: MUTED,
                            fontSize: 12,
                            marginTop: 4,
                          }}
                        >
                          {row?.byproduct_name || row?.group_label || "—"}
                        </div>
                      </div>

                      <StatusBadge label={`#${index + 1}`} />
                    </div>

                    <div style={{ display: "grid", gap: 6, fontSize: 13, color: TEXT }}>
                      <div>
                        <span style={mobileLabelStyle}>Transaction:</span>{" "}
                        {formatValue(row?.transaction_name)}
                      </div>
                      <div>
                        <span style={mobileLabelStyle}>Quantity:</span>{" "}
                        {formatValue(row?.quantity)}
                      </div>
                      <div>
                        <span style={mobileLabelStyle}>Unit Price:</span>{" "}
                        {formatMoney(row?.unit_price)}
                      </div>
                      <div>
                        <span style={mobileLabelStyle}>Line Total:</span>{" "}
                        {formatMoney(row?.line_total)}
                      </div>
                      <div>
                        <span style={mobileLabelStyle}>Date:</span>{" "}
                        {formatValue(row?.sale_date || row?.report_date)}
                      </div>
                    </div>
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
                    minWidth: 1120,
                    borderCollapse: "collapse",
                    background: "#fff",
                  }}
                >
                  <thead>
                    <tr style={{ background: "#f8fafc" }}>
                      {[
                        "#",
                        "Customer",
                        "Transaction",
                        "Byproduct",
                        "Quantity",
                        "Unit Price",
                        "Line Total",
                        "Date",
                      ].map((head) => (
                        <th key={head} style={tableHeadStyle}>
                          {head}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, index) => (
                      <tr key={row?.id || row?.sale_line_id || index}>
                        <td style={cellStyleStrong}>{index + 1}</td>
                        <td style={cellStyle}>{formatValue(row?.customer_name)}</td>
                        <td style={cellStyle}>{formatValue(row?.transaction_name)}</td>
                        <td style={cellStyle}>{formatValue(row?.byproduct_name)}</td>
                        <td style={cellStyle}>{formatValue(row?.quantity)}</td>
                        <td style={cellStyle}>{formatMoney(row?.unit_price)}</td>
                        <td style={cellStyleStrong}>{formatMoney(row?.line_total)}</td>
                        <td style={cellStyle}>
                          {formatValue(row?.sale_date || row?.report_date)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
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
            <div style={{ marginBottom: 14 }}>
              <h2
                style={{
                  margin: 0,
                  color: TEXT,
                  fontSize: 18,
                  fontWeight: 800,
                }}
              >
                Grouped Rows
              </h2>
              <p
                style={{
                  margin: "6px 0 0",
                  color: MUTED,
                  fontSize: 13,
                }}
              >
                Grouped summary rows returned by the report when grouping is applied.
              </p>
            </div>

            {groupedRows.length === 0 ? (
              <EmptyState text="No grouped rows available." />
            ) : isMobile ? (
              <div style={{ display: "grid", gap: 12 }}>
                {groupedRows.map((row, index) => (
                  <div
                    key={row?.group_label || index}
                    style={{
                      border: `1px solid ${BORDER}`,
                      borderRadius: 16,
                      padding: 14,
                      background: "#fff",
                    }}
                  >
                    <div
                      style={{
                        color: TEXT,
                        fontSize: 15,
                        fontWeight: 800,
                        lineHeight: 1.35,
                        marginBottom: 10,
                      }}
                    >
                      {formatValue(row?.group_label)}
                    </div>

                    <div style={{ display: "grid", gap: 6, fontSize: 13, color: TEXT }}>
                      <div>
                        <span style={mobileLabelStyle}>Quantity Total:</span>{" "}
                        {formatValue(row?.quantity_total)}
                      </div>
                      <div>
                        <span style={mobileLabelStyle}>Amount Total:</span>{" "}
                        {formatMoney(row?.amount_total)}
                      </div>
                      <div>
                        <span style={mobileLabelStyle}>Transactions:</span>{" "}
                        {formatValue(row?.transaction_count)}
                      </div>
                    </div>
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
                    minWidth: 720,
                    borderCollapse: "collapse",
                    background: "#fff",
                  }}
                >
                  <thead>
                    <tr style={{ background: "#f8fafc" }}>
                      {["Group", "Quantity Total", "Amount Total", "Transactions"].map(
                        (head) => (
                          <th key={head} style={tableHeadStyle}>
                            {head}
                          </th>
                        )
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {groupedRows.map((row, index) => (
                      <tr key={row?.group_label || index}>
                        <td style={cellStyleStrong}>{formatValue(row?.group_label)}</td>
                        <td style={cellStyle}>{formatValue(row?.quantity_total)}</td>
                        <td style={cellStyleStrong}>{formatMoney(row?.amount_total)}</td>
                        <td style={cellStyle}>{formatValue(row?.transaction_count)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <GenericSummarySection
            title="Customer Summary"
            subtitle="Customer-based summary records."
            rows={customerSummary}
            columns={genericCustomerSummaryColumns}
            isMobile={isMobile}
          />

          <GenericSummarySection
            title="Byproduct Summary"
            subtitle="Byproduct-based summary records."
            rows={byproductSummary}
            columns={genericByproductSummaryColumns}
            isMobile={isMobile}
          />

          <GenericSummarySection
            title="Category Summary"
            subtitle="Category-based summary records."
            rows={categorySummary}
            columns={genericCategorySummaryColumns}
            isMobile={isMobile}
          />

          <GenericSummarySection
            title="Trend"
            subtitle="Trend points returned by the trend endpoint."
            rows={trendPoints}
            columns={trendColumns}
            isMobile={isMobile}
          />

          <section
            style={{
              background: SURFACE,
              border: `1px solid ${BORDER}`,
              borderRadius: 22,
              padding: isMobile ? 16 : 18,
              boxShadow: SHADOW,
            }}
          >
            <div style={{ marginBottom: 14 }}>
              <h2
                style={{
                  margin: 0,
                  color: TEXT,
                  fontSize: 18,
                  fontWeight: 800,
                }}
              >
                Comparison
              </h2>
              <p
                style={{
                  margin: "6px 0 0",
                  color: MUTED,
                  fontSize: 13,
                }}
              >
                Previous-period comparison metrics.
              </p>
            </div>

            {compareCards.length === 0 ? (
              <EmptyState text="No comparison loaded yet." />
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: isMobile
                    ? "repeat(2, minmax(0, 1fr))"
                    : "repeat(4, minmax(0, 1fr))",
                  gap: 12,
                }}
              >
                {compareCards.map((item) => (
                  <ReportMetricCard
                    key={item.key}
                    title={item.key.replace(/\./g, " · ").replace(/_/g, " ")}
                    value={formatValue(item.value)}
                    color={TEXT}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </>
  );
}

function GenericSummarySection({ title, subtitle, rows, columns, isMobile }) {
  return (
    <section
      style={{
        background: SURFACE,
        border: `1px solid ${BORDER}`,
        borderRadius: 22,
        padding: isMobile ? 16 : 18,
        boxShadow: SHADOW,
      }}
    >
      <div style={{ marginBottom: 14 }}>
        <h2
          style={{
            margin: 0,
            color: TEXT,
            fontSize: 18,
            fontWeight: 800,
          }}
        >
          {title}
        </h2>
        <p
          style={{
            margin: "6px 0 0",
            color: MUTED,
            fontSize: 13,
          }}
        >
          {subtitle}
        </p>
      </div>

      {rows.length === 0 ? (
        <EmptyState text={`No ${title.toLowerCase()} available.`} />
      ) : isMobile ? (
        <div style={{ display: "grid", gap: 12 }}>
          {rows.map((row, index) => (
            <div
              key={row?.id || row?.name || row?.label || index}
              style={{
                border: `1px solid ${BORDER}`,
                borderRadius: 16,
                padding: 14,
                background: "#fff",
              }}
            >
              <div
                style={{
                  color: TEXT,
                  fontSize: 15,
                  fontWeight: 800,
                  lineHeight: 1.35,
                  marginBottom: 10,
                }}
              >
                {formatValue(
                  row?.name ||
                    row?.label ||
                    row?.group_label ||
                    row?.customer_name ||
                    row?.byproduct_name ||
                    row?.category_name ||
                    `${title} ${index + 1}`
                )}
              </div>

              <div style={{ display: "grid", gap: 6, fontSize: 13, color: TEXT }}>
                {columns.map((column) => (
                  <div key={column}>
                    <span style={mobileLabelStyle}>
                      {column.replace(/_/g, " ")}:
                    </span>{" "}
                    {formatValue(row?.[column])}
                  </div>
                ))}
              </div>
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
              minWidth: 760,
              borderCollapse: "collapse",
              background: "#fff",
            }}
          >
            <thead>
              <tr style={{ background: "#f8fafc" }}>
                {columns.map((column) => (
                  <th key={column} style={tableHeadStyle}>
                    {column.replace(/_/g, " ")}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={row?.id || row?.name || row?.label || index}>
                  {columns.map((column, columnIndex) => (
                    <td
                      key={column}
                      style={columnIndex === 0 ? cellStyleStrong : cellStyle}
                    >
                      {formatValue(row?.[column])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function EmptyState({ text }) {
  return (
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
      {text}
    </div>
  );
}

function secondaryBtn(isMobile) {
  return {
    minHeight: 40,
    padding: "0 14px",
    borderRadius: 12,
    border: `1px solid ${BORDER}`,
    background: SURFACE,
    color: TEXT,
    fontSize: 13,
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

const labelStyle = {
  display: "block",
  color: TEXT,
  fontSize: 13,
  fontWeight: 700,
  marginBottom: 6,
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

const mobileLabelStyle = {
  color: MUTED,
  fontWeight: 700,
};