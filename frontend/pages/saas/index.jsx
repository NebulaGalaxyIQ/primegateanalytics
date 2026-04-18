import Link from "next/link";
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

const MONTH_OPTIONS = [
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" },
];

const YEAR_OPTIONS = Array.from({ length: 8 }, (_, idx) => 2024 + idx);
const ANIMAL_OPTIONS = ["0", "Goats", "Sheep", "Goats/sheep", "Cattle", "Mixed"];
const WEEK_START_OPTIONS = [
  { value: "monday", label: "Monday" },
  { value: "sunday", label: "Sunday" },
];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function startOfMonthISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function endOfMonthISO() {
  const d = new Date();
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return last.toISOString().slice(0, 10);
}

function defaultMonth() {
  return new Date().getMonth() + 1;
}

function defaultYear() {
  return new Date().getFullYear();
}

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
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

function normalizeError(error, fallback = "Something went wrong.") {
  const detail = error?.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail.length) {
    return detail.map((item) => item?.msg || item?.message || String(item)).join(", ");
  }
  if (error?.response?.data instanceof Blob) return fallback;
  return error?.message || fallback;
}

function baseFormState() {
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

function createBaseFilters() {
  return {
    report_date: todayISO(),
    reference_date: todayISO(),
    week_starts_on: "monday",
    month: defaultMonth(),
    year: defaultYear(),
    start_date: startOfMonthISO(),
    end_date: endOfMonthISO(),
    client_name: "",
    animal_type: "",
    is_active: true,
    skip: 0,
    limit: 100,
    sort_by: "service_date",
    sort_order: "desc",
  };
}

function getWeekRange(referenceDate, weekStartsOn = "monday") {
  const source = referenceDate ? new Date(referenceDate) : new Date();
  const date = new Date(source.getFullYear(), source.getMonth(), source.getDate());
  const weekday = date.getDay();

  let diff;
  if (weekStartsOn === "sunday") {
    diff = weekday;
  } else {
    diff = weekday === 0 ? 6 : weekday - 1;
  }

  const start = new Date(date);
  start.setDate(date.getDate() - diff);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);

  const toISO = (value) => {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  return {
    start_date: toISO(start),
    end_date: toISO(end),
  };
}

function getReportScopeLabel(reportMode, filters) {
  if (reportMode === "daily") return `Daily · ${prettyDate(filters.report_date)}`;
  if (reportMode === "weekly") {
    const range = getWeekRange(filters.reference_date, filters.week_starts_on);
    return `Weekly · ${prettyDate(range.start_date)} - ${prettyDate(range.end_date)}`;
  }
  if (reportMode === "monthly") {
    const month = MONTH_OPTIONS.find((item) => item.value === Number(filters.month));
    return `Monthly · ${month?.label || "Month"} ${filters.year}`;
  }
  return `Range · ${prettyDate(filters.start_date)} - ${prettyDate(filters.end_date)}`;
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

function PreviewBox({ label, value }) {
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
      <div style={{ fontSize: 20, color: TEXT, fontWeight: 700 }}>{value}</div>
    </div>
  );
}

function StatCard({ title, value, sub, color = TEXT }) {
  return (
    <div
      style={{
        background: SURFACE,
        border: `1px solid ${BORDER}`,
        borderRadius: 16,
        padding: 18,
        minHeight: 108,
      }}
    >
      <div style={{ fontSize: 13, color: MUTED, marginBottom: 10 }}>{title}</div>
      <div
        style={{
          fontSize: 24,
          lineHeight: 1.1,
          fontWeight: 700,
          color,
          marginBottom: 8,
          wordBreak: "break-word",
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: 12, color: MUTED }}>{sub}</div>
    </div>
  );
}

function RowStatus({ active }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
        color: active ? GREEN : RED,
        background: active ? "rgba(22,163,74,0.10)" : "rgba(220,38,38,0.10)",
        whiteSpace: "nowrap",
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

function SectionTitle({ title, right }) {
  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 14,
        flexWrap: "wrap",
      }}
    >
      <h2
        style={{
          margin: 0,
          fontSize: 18,
          color: TEXT,
          fontWeight: 700,
          fontFamily: "Arial, sans-serif",
        }}
      >
        {title}
      </h2>
      {right}
    </div>
  );
}

const formGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 14,
};

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

const tdStyle = {
  padding: "12px 10px",
  borderBottom: `1px solid ${BORDER}`,
  fontSize: 13,
  color: TEXT,
  textAlign: "left",
  verticalAlign: "middle",
};

const tdStyleRight = {
  ...tdStyle,
  textAlign: "right",
  whiteSpace: "nowrap",
};

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

const miniLinkStyle = {
  color: BLUE,
  textDecoration: "none",
  fontSize: 13,
  fontWeight: 700,
  fontFamily: "Arial, sans-serif",
};

function miniButtonStyle(color) {
  return {
    border: "none",
    background: "transparent",
    color,
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 700,
    padding: 0,
    fontFamily: "Arial, sans-serif",
  };
}

function SummaryTable({ rows, mode = "client", emptyLabel }) {
  const titleKey = mode === "animal" ? "animal_type" : "client_name";

  return (
    <div style={{ overflowX: "auto" }}>
      <table
        style={{
          width: "100%",
          minWidth: 760,
          borderCollapse: "collapse",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <thead>
          <tr>
            {[
              mode === "animal" ? "Animal type" : "Client",
              "Rows",
              "Animals",
              "Service revenue",
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
          {!rows?.length ? (
            <tr>
              <td
                colSpan={6}
                style={{
                  padding: 18,
                  textAlign: "center",
                  color: MUTED,
                  fontSize: 14,
                  borderBottom: `1px solid ${BORDER}`,
                }}
              >
                {emptyLabel}
              </td>
            </tr>
          ) : (
            rows.map((item, index) => (
              <tr key={`${item?.[titleKey] || "row"}-${index}`}>
                <td style={tdStyle}>{item?.[titleKey] || "—"}</td>
                <td style={tdStyleRight}>{intFmt(item?.rows_count)}</td>
                <td style={tdStyleRight}>{intFmt(item?.total_animals)}</td>
                <td style={tdStyleRight}>${money2(item?.total_service_revenue_usd)}</td>
                <td style={tdStyleRight}>${money2(item?.total_offal_revenue_usd)}</td>
                <td style={{ ...tdStyleRight, fontWeight: 700, color: GREEN }}>
                  ${money2(item?.total_combined_revenue_usd)}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export default function SaaSIndexPage() {
  const [sectionTab, setSectionTab] = useState("create");
  const [loading, setLoading] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  const [records, setRecords] = useState([]);
  const [recordTotal, setRecordTotal] = useState(0);
  const [totals, setTotals] = useState(null);
  const [clientSummary, setClientSummary] = useState([]);
  const [animalSummary, setAnimalSummary] = useState([]);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [reportMode, setReportMode] = useState("monthly");
  const [reportDataTab, setReportDataTab] = useState("records");
  const [editingId, setEditingId] = useState(null);

  const [filters, setFilters] = useState(createBaseFilters());
  const [form, setForm] = useState(baseFormState());

  const preview = useMemo(() => computePreview(form), [form]);
  const scopeLabel = useMemo(() => getReportScopeLabel(reportMode, filters), [reportMode, filters]);

  const stats = useMemo(() => {
    return [
      {
        title: "Clients served",
        value: intFmt(totals?.total_clients_served || 0),
        sub: "Unique clients in current report",
        color: TEXT,
      },
      {
        title: "Total animals",
        value: intFmt(totals?.total_animals || 0),
        sub: "Animals in current report",
        color: TEXT,
      },
      {
        title: "Service revenue",
        value: `$${money2(totals?.total_service_revenue_usd || 0)}`,
        sub: "Per-head slaughter revenue",
        color: ORANGE_DEEP,
      },
      {
        title: "Offal revenue",
        value: `$${money2(totals?.total_offal_revenue_usd || 0)}`,
        sub: "Offals revenue",
        color: BLUE,
      },
      {
        title: "Combined revenue",
        value: `$${money2(totals?.total_combined_revenue_usd || 0)}`,
        sub: "Service + offals",
        color: GREEN,
      },
    ];
  }, [totals]);

  const resetForm = useCallback(() => {
    setForm(baseFormState());
    setEditingId(null);
  }, []);

  const handleFormChange = useCallback((key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const buildListParams = useCallback(() => {
    const params = {
      client_name: filters.client_name || undefined,
      animal_type: filters.animal_type || undefined,
      is_active: filters.is_active,
      skip: filters.skip,
      limit: filters.limit,
      sort_by: filters.sort_by,
      sort_order: filters.sort_order,
    };

    if (reportMode === "daily") {
      params.start_date = filters.report_date;
      params.end_date = filters.report_date;
    } else if (reportMode === "weekly") {
      const range = getWeekRange(filters.reference_date, filters.week_starts_on);
      params.start_date = range.start_date;
      params.end_date = range.end_date;
    } else if (reportMode === "monthly") {
      params.month = filters.month;
      params.year = filters.year;
    } else {
      params.start_date = filters.start_date || undefined;
      params.end_date = filters.end_date || undefined;
    }

    return params;
  }, [filters, reportMode]);

  const loadList = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await SaaSService.list(buildListParams());
      setRecords(Array.isArray(data?.items) ? data.items : []);
      setRecordTotal(Number(data?.total || 0));
    } catch (err) {
      setError(normalizeError(err, "Failed to load records."));
    } finally {
      setLoading(false);
    }
  }, [buildListParams]);

  const loadReport = useCallback(async () => {
    setReportLoading(true);
    setError("");
    try {
      let report = null;

      if (reportMode === "daily") {
        report = await SaaSService.getDailyReport({
          report_date: filters.report_date,
          client_name: filters.client_name || undefined,
          animal_type: filters.animal_type || undefined,
          is_active: filters.is_active,
          include_rows: true,
          include_totals: true,
          include_client_summary: true,
          include_animal_summary: true,
        });
      } else if (reportMode === "weekly") {
        report = await SaaSService.getWeeklyReport({
          reference_date: filters.reference_date,
          week_starts_on: filters.week_starts_on,
          client_name: filters.client_name || undefined,
          animal_type: filters.animal_type || undefined,
          is_active: filters.is_active,
          include_rows: true,
          include_totals: true,
          include_client_summary: true,
          include_animal_summary: true,
        });
      } else if (reportMode === "monthly") {
        report = await SaaSService.getMonthlyReport({
          month: filters.month,
          year: filters.year,
          client_name: filters.client_name || undefined,
          animal_type: filters.animal_type || undefined,
          is_active: filters.is_active,
          include_rows: true,
          include_totals: true,
          include_client_summary: true,
          include_animal_summary: true,
        });
      } else {
        report = await SaaSService.getDateRangeReport({
          start_date: filters.start_date,
          end_date: filters.end_date,
          client_name: filters.client_name || undefined,
          animal_type: filters.animal_type || undefined,
          is_active: filters.is_active,
          include_rows: true,
          include_totals: true,
          include_client_summary: true,
          include_animal_summary: true,
        });
      }

      setTotals(report?.totals || null);
      setClientSummary(Array.isArray(report?.client_summary) ? report.client_summary : []);
      setAnimalSummary(Array.isArray(report?.animal_summary) ? report.animal_summary : []);
    } catch (err) {
      setError(normalizeError(err, "Failed to load report."));
    } finally {
      setReportLoading(false);
    }
  }, [filters, reportMode]);

  const reloadAll = useCallback(async () => {
    await Promise.all([loadList(), loadReport()]);
  }, [loadList, loadReport]);

  useEffect(() => {
    reloadAll();
  }, [reloadAll]);

  const submitForm = useCallback(
    async (event) => {
      event.preventDefault();
      setSaving(true);
      setError("");
      setMessage("");

      try {
        const payload = {
          service_date: form.service_date,
          client_name: form.client_name || DEFAULT_ZERO_TEXT,
          animal_type: form.animal_type || DEFAULT_ZERO_TEXT,
          total_animals: Number(form.total_animals || 0),
          unit_price_per_head_usd: Number(form.unit_price_per_head_usd || DEFAULT_UNIT_PRICE_PER_HEAD),
          unit_price_offal_usd: Number(form.unit_price_offal_usd || DEFAULT_UNIT_PRICE_OFFAL),
          notes: form.notes || null,
          is_active: !!form.is_active,
        };

        if (editingId) {
          await SaaSService.update(editingId, payload);
          setMessage("Record updated successfully.");
        } else {
          await SaaSService.create(payload);
          setMessage("Record created successfully.");
        }

        resetForm();
        setSectionTab("report");
        await reloadAll();
      } catch (err) {
        setError(normalizeError(err, "Failed to save record."));
      } finally {
        setSaving(false);
      }
    },
    [editingId, form, reloadAll, resetForm]
  );

  const startEdit = useCallback((row) => {
    setEditingId(row?.id || null);
    setSectionTab("create");
    setForm({
      service_date: row?.service_date || todayISO(),
      client_name: row?.client_name || DEFAULT_ZERO_TEXT,
      animal_type: row?.animal_type || DEFAULT_ZERO_TEXT,
      total_animals: String(row?.total_animals ?? 0),
      unit_price_per_head_usd: String(row?.unit_price_per_head_usd ?? DEFAULT_UNIT_PRICE_PER_HEAD),
      unit_price_offal_usd: String(row?.unit_price_offal_usd ?? DEFAULT_UNIT_PRICE_OFFAL),
      notes: row?.notes || "",
      is_active: row?.is_active !== false,
    });
    setMessage("");
    setError("");
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, []);

  const handleDelete = useCallback(
    async (row) => {
      const ok =
        typeof window === "undefined"
          ? true
          : window.confirm(`Soft delete record for ${row?.client_name || "this client"}?`);

      if (!ok) return;

      try {
        await SaaSService.softDelete(row.id);
        setMessage("Record deleted successfully.");
        if (editingId === row.id) resetForm();
        await reloadAll();
      } catch (err) {
        setError(normalizeError(err, "Failed to delete record."));
      }
    },
    [editingId, reloadAll, resetForm]
  );

  const handleRestore = useCallback(
    async (row) => {
      try {
        await SaaSService.restore(row.id);
        setMessage("Record restored successfully.");
        await reloadAll();
      } catch (err) {
        setError(normalizeError(err, "Failed to restore record."));
      }
    },
    [reloadAll]
  );

  const exportExcel = useCallback(async () => {
    setExportingExcel(true);
    setError("");
    try {
      const common = {
        client_name: filters.client_name || undefined,
        animal_type: filters.animal_type || undefined,
        is_active: filters.is_active,
        report_title: "UMG Slaughter Services Report",
      };

      if (reportMode === "daily") {
        await SaaSService.downloadDailyExcel({
          ...common,
          report_date: filters.report_date,
        });
      } else if (reportMode === "weekly") {
        await SaaSService.downloadWeeklyExcel({
          ...common,
          reference_date: filters.reference_date,
          week_starts_on: filters.week_starts_on,
        });
      } else if (reportMode === "monthly") {
        await SaaSService.downloadMonthlyExcel({
          ...common,
          month: filters.month,
          year: filters.year,
        });
      } else {
        await SaaSService.downloadRangeExcel({
          ...common,
          start_date: filters.start_date,
          end_date: filters.end_date,
        });
      }

      setMessage("Excel export downloaded successfully.");
    } catch (err) {
      setError(normalizeError(err, "Failed to export Excel report."));
    } finally {
      setExportingExcel(false);
    }
  }, [filters, reportMode]);

  const exportPdf = useCallback(async () => {
    setExportingPdf(true);
    setError("");
    try {
      const common = {
        client_name: filters.client_name || undefined,
        animal_type: filters.animal_type || undefined,
        is_active: filters.is_active,
        report_title: "UMG Slaughter Services Report",
      };

      if (reportMode === "daily") {
        await SaaSService.downloadDailyPdf({
          ...common,
          report_date: filters.report_date,
        });
      } else if (reportMode === "weekly") {
        await SaaSService.downloadWeeklyPdf({
          ...common,
          reference_date: filters.reference_date,
          week_starts_on: filters.week_starts_on,
        });
      } else if (reportMode === "monthly") {
        await SaaSService.downloadMonthlyPdf({
          ...common,
          month: filters.month,
          year: filters.year,
        });
      } else {
        await SaaSService.downloadRangePdf({
          ...common,
          start_date: filters.start_date,
          end_date: filters.end_date,
        });
      }

      setMessage("PDF export downloaded successfully.");
    } catch (err) {
      setError(normalizeError(err, "Failed to export PDF report."));
    } finally {
      setExportingPdf(false);
    }
  }, [filters, reportMode]);

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
      <div style={{ width: "100%", maxWidth: 1650, margin: "0 auto" }}>
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
                Slaughter Services
              </h1>
              <div style={{ marginTop: 8, fontSize: 14, color: MUTED }}>
                Manage slaughter service records, daily and weekly reporting, summaries, and exports.
              </div>
              <div style={{ marginTop: 6, fontSize: 13, color: MUTED }}>
                Current scope: {scopeLabel}
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => {
                  resetForm();
                  setSectionTab("create");
                }}
                style={buttonStyle("primary")}
              >
                New record
              </button>
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

        <div
          style={{
            display: "flex",
            gap: 10,
            marginBottom: 18,
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            onClick={() => setSectionTab("create")}
            style={tabButtonStyle(sectionTab === "create")}
          >
            Create slaughter service record
          </button>
          <button
            type="button"
            onClick={() => setSectionTab("filters")}
            style={tabButtonStyle(sectionTab === "filters")}
          >
            Filters and reporting
          </button>
          <button
            type="button"
            onClick={() => setSectionTab("report")}
            style={tabButtonStyle(sectionTab === "report")}
          >
            Report data
          </button>
        </div>

        {sectionTab === "create" && (
          <div
            style={{
              background: SURFACE,
              border: `1px solid ${BORDER}`,
              borderRadius: 18,
              padding: 20,
              marginBottom: 18,
            }}
          >
            <SectionTitle
              title={editingId ? "Edit slaughter service record" : "Create slaughter service record"}
              right={
                editingId ? (
                  <button type="button" onClick={resetForm} style={buttonStyle("secondary")}>
                    Cancel edit
                  </button>
                ) : (
                  <button type="button" onClick={resetForm} style={buttonStyle("secondary")}>
                    Reset defaults
                  </button>
                )
              }
            />

            <form onSubmit={submitForm}>
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
                    list="animal-types"
                    value={form.animal_type}
                    onChange={(e) => handleFormChange("animal_type", e.target.value)}
                    style={inputStyle}
                    placeholder="0"
                  />
                  <datalist id="animal-types">
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
                    onChange={(e) => handleFormChange("unit_price_per_head_usd", e.target.value)}
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

              <div
                style={{
                  marginTop: 18,
                  background: SOFT,
                  border: `1px solid ${BORDER}`,
                  borderRadius: 14,
                  padding: 16,
                }}
              >
                <div style={{ fontSize: 14, color: MUTED, fontWeight: 700, marginBottom: 10 }}>
                  Auto-calculated preview
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: 12,
                  }}
                >
                  <PreviewBox
                    label="Total revenue USD"
                    value={`$${money2(preview.totalRevenue)}`}
                  />
                  <PreviewBox
                    label="Total offal revenue USD"
                    value={`$${money2(preview.totalOffalRevenue)}`}
                  />
                  <PreviewBox
                    label="Total combined revenue USD"
                    value={`$${money2(preview.totalCombinedRevenue)}`}
                  />
                </div>
              </div>

              <div style={{ marginTop: 18, display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button type="submit" style={buttonStyle("primary")} disabled={saving}>
                  {saving ? "Saving..." : editingId ? "Update record" : "Create record"}
                </button>

                <button type="button" onClick={resetForm} style={buttonStyle("secondary")}>
                  Reset
                </button>
              </div>
            </form>
          </div>
        )}

        {sectionTab === "filters" && (
          <>
            <div
              style={{
                background: SURFACE,
                border: `1px solid ${BORDER}`,
                borderRadius: 18,
                padding: 20,
                marginBottom: 18,
              }}
            >
              <SectionTitle title="Filters and reporting" />

              <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => setReportMode("daily")}
                  style={tabButtonStyle(reportMode === "daily")}
                >
                  Daily
                </button>
                <button
                  type="button"
                  onClick={() => setReportMode("weekly")}
                  style={tabButtonStyle(reportMode === "weekly")}
                >
                  Weekly
                </button>
                <button
                  type="button"
                  onClick={() => setReportMode("monthly")}
                  style={tabButtonStyle(reportMode === "monthly")}
                >
                  Monthly
                </button>
                <button
                  type="button"
                  onClick={() => setReportMode("range")}
                  style={tabButtonStyle(reportMode === "range")}
                >
                  Date range
                </button>
              </div>

              <div style={formGridStyle}>
                {reportMode === "daily" && (
                  <Field label="Report date">
                    <input
                      type="date"
                      value={filters.report_date}
                      onChange={(e) =>
                        setFilters((prev) => ({ ...prev, report_date: e.target.value }))
                      }
                      style={inputStyle}
                    />
                  </Field>
                )}

                {reportMode === "weekly" && (
                  <>
                    <Field label="Reference date">
                      <input
                        type="date"
                        value={filters.reference_date}
                        onChange={(e) =>
                          setFilters((prev) => ({ ...prev, reference_date: e.target.value }))
                        }
                        style={inputStyle}
                      />
                    </Field>

                    <Field label="Week starts on">
                      <select
                        value={filters.week_starts_on}
                        onChange={(e) =>
                          setFilters((prev) => ({ ...prev, week_starts_on: e.target.value }))
                        }
                        style={inputStyle}
                      >
                        {WEEK_START_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </>
                )}

                {reportMode === "monthly" && (
                  <>
                    <Field label="Month">
                      <select
                        value={filters.month}
                        onChange={(e) =>
                          setFilters((prev) => ({ ...prev, month: Number(e.target.value) }))
                        }
                        style={inputStyle}
                      >
                        {MONTH_OPTIONS.map((month) => (
                          <option key={month.value} value={month.value}>
                            {month.label}
                          </option>
                        ))}
                      </select>
                    </Field>

                    <Field label="Year">
                      <select
                        value={filters.year}
                        onChange={(e) =>
                          setFilters((prev) => ({ ...prev, year: Number(e.target.value) }))
                        }
                        style={inputStyle}
                      >
                        {YEAR_OPTIONS.map((year) => (
                          <option key={year} value={year}>
                            {year}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </>
                )}

                {reportMode === "range" && (
                  <>
                    <Field label="Start date">
                      <input
                        type="date"
                        value={filters.start_date}
                        onChange={(e) =>
                          setFilters((prev) => ({ ...prev, start_date: e.target.value }))
                        }
                        style={inputStyle}
                      />
                    </Field>

                    <Field label="End date">
                      <input
                        type="date"
                        value={filters.end_date}
                        onChange={(e) =>
                          setFilters((prev) => ({ ...prev, end_date: e.target.value }))
                        }
                        style={inputStyle}
                      />
                    </Field>
                  </>
                )}

                <Field label="Client name">
                  <input
                    type="text"
                    value={filters.client_name}
                    onChange={(e) =>
                      setFilters((prev) => ({ ...prev, client_name: e.target.value }))
                    }
                    style={inputStyle}
                    placeholder="Search client"
                  />
                </Field>

                <Field label="Animal type">
                  <input
                    list="animal-filter-types"
                    value={filters.animal_type}
                    onChange={(e) =>
                      setFilters((prev) => ({ ...prev, animal_type: e.target.value }))
                    }
                    style={inputStyle}
                    placeholder="All"
                  />
                  <datalist id="animal-filter-types">
                    {ANIMAL_OPTIONS.map((option) => (
                      <option key={option} value={option} />
                    ))}
                  </datalist>
                </Field>

                <Field label="Status">
                  <select
                    value={filters.is_active === null ? "all" : String(filters.is_active)}
                    onChange={(e) => {
                      const value = e.target.value;
                      setFilters((prev) => ({
                        ...prev,
                        is_active: value === "all" ? null : value === "true",
                      }));
                    }}
                    style={inputStyle}
                  >
                    <option value="true">Active only</option>
                    <option value="false">Inactive only</option>
                    <option value="all">All</option>
                  </select>
                </Field>

                <Field label="Sort by">
                  <select
                    value={filters.sort_by}
                    onChange={(e) =>
                      setFilters((prev) => ({ ...prev, sort_by: e.target.value }))
                    }
                    style={inputStyle}
                  >
                    <option value="service_date">Service date</option>
                    <option value="client_name">Client name</option>
                    <option value="animal_type">Animal type</option>
                    <option value="total_animals">Total animals</option>
                    <option value="total_revenue_usd">Service revenue</option>
                    <option value="total_offal_revenue_usd">Offal revenue</option>
                    <option value="total_combined_revenue_usd">Combined revenue</option>
                    <option value="created_at">Created at</option>
                    <option value="updated_at">Updated at</option>
                  </select>
                </Field>

                <Field label="Sort order">
                  <select
                    value={filters.sort_order}
                    onChange={(e) =>
                      setFilters((prev) => ({ ...prev, sort_order: e.target.value }))
                    }
                    style={inputStyle}
                  >
                    <option value="desc">Descending</option>
                    <option value="asc">Ascending</option>
                  </select>
                </Field>
              </div>

              <div style={{ marginTop: 16, display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={reloadAll}
                  style={buttonStyle("primary")}
                  disabled={loading || reportLoading}
                >
                  {loading || reportLoading ? "Loading..." : "Apply filters"}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setFilters(createBaseFilters());
                    setReportMode("monthly");
                    setReportDataTab("records");
                  }}
                  style={buttonStyle("secondary")}
                >
                  Reset filters
                </button>

                <button
                  type="button"
                  onClick={exportExcel}
                  style={buttonStyle("secondaryBlue")}
                  disabled={exportingExcel}
                >
                  {exportingExcel ? "Exporting Excel..." : "Export Excel"}
                </button>

                <button
                  type="button"
                  onClick={exportPdf}
                  style={buttonStyle("secondaryBlue")}
                  disabled={exportingPdf}
                >
                  {exportingPdf ? "Exporting PDF..." : "Export PDF"}
                </button>
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 14,
                marginBottom: 18,
              }}
            >
              {stats.map((item) => (
                <StatCard
                  key={item.title}
                  title={item.title}
                  value={item.value}
                  sub={item.sub}
                  color={item.color}
                />
              ))}
            </div>
          </>
        )}

        {sectionTab === "report" && (
          <div
            style={{
              background: SURFACE,
              border: `1px solid ${BORDER}`,
              borderRadius: 18,
              padding: 18,
            }}
          >
            <SectionTitle
              title="Report data"
              right={
                <div style={{ fontSize: 13, color: MUTED }}>
                  {loading || reportLoading ? "Loading..." : scopeLabel}
                </div>
              }
            />

            <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => setReportDataTab("records")}
                style={tabButtonStyle(reportDataTab === "records")}
              >
                Records
              </button>
              <button
                type="button"
                onClick={() => setReportDataTab("clients")}
                style={tabButtonStyle(reportDataTab === "clients")}
              >
                Client summary
              </button>
              <button
                type="button"
                onClick={() => setReportDataTab("animals")}
                style={tabButtonStyle(reportDataTab === "animals")}
              >
                Animal summary
              </button>
            </div>

            {reportDataTab === "records" && (
              <div style={{ overflowX: "auto" }}>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    minWidth: 1240,
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
                        "Status",
                        "Action",
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
                    {!loading && records.length === 0 ? (
                      <tr>
                        <td
                          colSpan={11}
                          style={{
                            padding: 18,
                            textAlign: "center",
                            color: MUTED,
                            fontSize: 14,
                            borderBottom: `1px solid ${BORDER}`,
                          }}
                        >
                          No slaughter service records found.
                        </td>
                      </tr>
                    ) : (
                      records.map((row) => (
                        <tr key={row.id}>
                          <td style={tdStyle}>{prettyDate(row.service_date)}</td>
                          <td style={tdStyle}>{row.client_name || "—"}</td>
                          <td style={tdStyle}>{row.animal_type || "—"}</td>
                          <td style={tdStyleRight}>{intFmt(row.total_animals)}</td>
                          <td style={tdStyleRight}>${money3(row.unit_price_per_head_usd)}</td>
                          <td style={tdStyleRight}>${money2(row.total_revenue_usd)}</td>
                          <td style={tdStyleRight}>${money3(row.unit_price_offal_usd)}</td>
                          <td style={tdStyleRight}>${money2(row.total_offal_revenue_usd)}</td>
                          <td style={{ ...tdStyleRight, fontWeight: 700 }}>
                            ${money2(row.total_combined_revenue_usd)}
                          </td>
                          <td style={tdStyle}>
                            <RowStatus active={row.is_active} />
                          </td>
                          <td style={tdStyle}>
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                              <Link href={`/saas/${row.id}`} style={miniLinkStyle}>
                                View
                              </Link>

                              <button
                                type="button"
                                onClick={() => startEdit(row)}
                                style={miniButtonStyle(BLUE)}
                              >
                                Edit
                              </button>

                              {row.is_active ? (
                                <button
                                  type="button"
                                  onClick={() => handleDelete(row)}
                                  style={miniButtonStyle(ORANGE_DEEP)}
                                >
                                  Delete
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleRestore(row)}
                                  style={miniButtonStyle(GREEN)}
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

            {reportDataTab === "clients" && (
              <SummaryTable
                rows={clientSummary}
                mode="client"
                emptyLabel="No client summary available."
              />
            )}

            {reportDataTab === "animals" && (
              <SummaryTable
                rows={animalSummary}
                mode="animal"
                emptyLabel="No animal summary available."
              />
            )}

            <div style={{ marginTop: 16, fontSize: 13, color: MUTED }}>
              Total records: {intFmt(recordTotal)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}