import Head from "next/head";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import AuditService from "../../services/audit";
import InventoryService from "../../services/inventory";

const PAGE_BG = "#ffffff";
const CARD_BG = "#ffffff";
const BORDER = "#e5e7eb";
const TEXT = "#111827";
const MUTED = "#6b7280";
const GREEN = "#15803d";
const GREEN_SOFT = "rgba(21,128,61,0.10)";
const BLUE = "#2563eb";
const BLUE_SOFT = "rgba(37,99,235,0.10)";
const RED = "#b91c1c";
const RED_SOFT = "rgba(185,28,28,0.08)";
const SHADOW = "0 16px 40px rgba(15, 23, 42, 0.05)";

const MODE_PRODUCT_WEEKLY = "product-weekly";
const MODE_PRODUCT_MONTHLY = "product-monthly";
const MODE_CONSUMABLE_WEEKLY = "consumable-weekly";
const MODE_CONSUMABLE_MONTHLY = "consumable-monthly";

function defaultDateInputValue() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function toErrorMessage(error, fallback = "Something went wrong.") {
  return error?.message || fallback;
}

function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatNumber(value, digits = 2) {
  const num = Number(value ?? 0);
  if (!Number.isFinite(num)) return digits === 0 ? "0" : "0.00";
  return num.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function parseDateInput(value) {
  if (!value) return new Date();
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function toIsoDate(value) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getWeeklyWindow(referenceDate) {
  const d = parseDateInput(referenceDate);
  const day = d.getDay();
  const diffToSunday = 7 - day;
  const sunday = new Date(d);
  sunday.setDate(d.getDate() + (day === 0 ? 0 : diffToSunday));

  const monday = new Date(sunday);
  monday.setDate(sunday.getDate() - 6);

  return {
    startDate: toIsoDate(monday),
    endDate: toIsoDate(sunday),
  };
}

function getMonthlyWindow(referenceDate) {
  const d = parseDateInput(referenceDate);
  const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
  const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0);

  return {
    startDate: toIsoDate(monthStart),
    endDate: toIsoDate(monthEnd),
  };
}

function getModeMeta(mode) {
  switch (mode) {
    case MODE_PRODUCT_WEEKLY:
      return {
        entity: "product",
        auditPeriodType: "weekly",
        title: "Product Weekly Audit",
      };
    case MODE_PRODUCT_MONTHLY:
      return {
        entity: "product",
        auditPeriodType: "monthly",
        title: "Product Monthly Audit",
      };
    case MODE_CONSUMABLE_WEEKLY:
      return {
        entity: "consumable",
        auditPeriodType: "weekly",
        title: "Consumable Weekly Audit",
      };
    case MODE_CONSUMABLE_MONTHLY:
      return {
        entity: "consumable",
        auditPeriodType: "monthly",
        title: "Consumable Monthly Audit",
      };
    default:
      return {
        entity: "product",
        auditPeriodType: "weekly",
        title: "Product Weekly Audit",
      };
  }
}

function buttonStyle(variant = "secondary") {
  const base = {
    appearance: "none",
    borderRadius: 12,
    padding: "10px 14px",
    fontSize: 14,
    fontWeight: 700,
    fontFamily: "Arial, sans-serif",
    cursor: "pointer",
    transition: "all 0.2s ease",
    border: "1px solid transparent",
    textDecoration: "none",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    lineHeight: 1.2,
    background: "#ffffff",
    color: TEXT,
  };

  if (variant === "green") {
    return {
      ...base,
      background: GREEN,
      color: "#ffffff",
      border: `1px solid ${GREEN}`,
    };
  }

  if (variant === "softBlue") {
    return {
      ...base,
      background: BLUE_SOFT,
      color: BLUE,
      border: "1px solid rgba(37,99,235,0.14)",
    };
  }

  return {
    ...base,
    border: `1px solid ${BORDER}`,
  };
}

function inputStyle() {
  return {
    width: "100%",
    height: 42,
    borderRadius: 12,
    border: `1px solid ${BORDER}`,
    padding: "0 12px",
    background: "#ffffff",
    color: TEXT,
    outline: "none",
    fontSize: 14,
    fontFamily: "Arial, sans-serif",
    boxSizing: "border-box",
  };
}

function textAreaStyle() {
  return {
    width: "100%",
    minHeight: 62,
    borderRadius: 12,
    border: `1px solid ${BORDER}`,
    padding: "10px 12px",
    background: "#ffffff",
    color: TEXT,
    outline: "none",
    fontSize: 13,
    fontFamily: "Arial, sans-serif",
    boxSizing: "border-box",
    resize: "vertical",
  };
}

function tableCellStyle(align = "left") {
  return {
    padding: "13px 12px",
    borderBottom: `1px solid ${BORDER}`,
    color: TEXT,
    fontSize: 13,
    textAlign: align,
    verticalAlign: "top",
    whiteSpace: "nowrap",
    fontFamily: "Arial, sans-serif",
  };
}

function PageCard({ title, subtitle, action, children, style }) {
  return (
    <section
      style={{
        background: CARD_BG,
        border: `1px solid ${BORDER}`,
        borderRadius: 22,
        boxShadow: SHADOW,
        padding: 20,
        ...style,
      }}
    >
      {(title || subtitle || action) && (
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 16,
            flexWrap: "wrap",
          }}
        >
          <div>
            {title ? (
              <h2
                style={{
                  margin: 0,
                  color: TEXT,
                  fontSize: 19,
                  fontWeight: 700,
                  fontFamily: "Arial, sans-serif",
                }}
              >
                {title}
              </h2>
            ) : null}
            {subtitle ? (
              <p
                style={{
                  margin: "6px 0 0",
                  color: MUTED,
                  fontSize: 13,
                  lineHeight: 1.55,
                  fontFamily: "Arial, sans-serif",
                }}
              >
                {subtitle}
              </p>
            ) : null}
          </div>
          {action ? <div>{action}</div> : null}
        </div>
      )}
      {children}
    </section>
  );
}

function FieldLabel({ children }) {
  return (
    <label
      style={{
        display: "block",
        marginBottom: 6,
        color: TEXT,
        fontSize: 13,
        fontWeight: 700,
        fontFamily: "Arial, sans-serif",
      }}
    >
      {children}
    </label>
  );
}

function StatCard({ label, value, tone = "green" }) {
  const tones = {
    green: { bg: GREEN_SOFT, color: GREEN },
    blue: { bg: BLUE_SOFT, color: BLUE },
  };

  const toneValue = tones[tone] || tones.green;

  return (
    <div
      style={{
        background: "#ffffff",
        border: `1px solid ${BORDER}`,
        borderRadius: 18,
        padding: 16,
        minHeight: 95,
      }}
    >
      <div
        style={{
          width: 38,
          height: 38,
          borderRadius: 12,
          background: toneValue.bg,
          color: toneValue.color,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 700,
          fontSize: 12,
          fontFamily: "Arial, sans-serif",
        }}
      >
        {String(label || "").slice(0, 2).toUpperCase()}
      </div>

      <div
        style={{
          marginTop: 12,
          color: TEXT,
          fontSize: 24,
          fontWeight: 700,
          fontFamily: "Arial, sans-serif",
        }}
      >
        {value}
      </div>

      <div
        style={{
          marginTop: 6,
          color: MUTED,
          fontSize: 13,
          fontFamily: "Arial, sans-serif",
        }}
      >
        {label}
      </div>
    </div>
  );
}

function NavButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        appearance: "none",
        border: active ? `1px solid ${GREEN}` : `1px solid ${BORDER}`,
        background: active ? GREEN : "#ffffff",
        color: active ? "#ffffff" : TEXT,
        borderRadius: 12,
        padding: "10px 16px",
        fontSize: 14,
        fontWeight: 700,
        cursor: "pointer",
        fontFamily: "Arial, sans-serif",
      }}
    >
      {children}
    </button>
  );
}

function InventoryTable({ columns, rows, renderRow, loading, emptyMessage, minWidth = 1500 }) {
  return (
    <div
      style={{
        width: "100%",
        overflowX: "auto",
        border: `1px solid ${BORDER}`,
        borderRadius: 18,
        background: "#ffffff",
      }}
    >
      <table
        style={{
          width: "100%",
          minWidth,
          borderCollapse: "separate",
          borderSpacing: 0,
          fontFamily: "Arial, sans-serif",
        }}
      >
        <thead>
          <tr style={{ background: "#fafafa" }}>
            {columns.map((column) => (
              <th
                key={column.key}
                style={{
                  textAlign: column.align || "left",
                  padding: "14px 12px",
                  borderBottom: `1px solid ${BORDER}`,
                  color: TEXT,
                  fontSize: 13,
                  fontWeight: 700,
                  whiteSpace: "nowrap",
                }}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td
                colSpan={columns.length}
                style={{
                  padding: "22px 16px",
                  color: MUTED,
                  fontSize: 14,
                  textAlign: "center",
                  fontFamily: "Arial, sans-serif",
                }}
              >
                Loading...
              </td>
            </tr>
          ) : rows.length ? (
            rows.map(renderRow)
          ) : (
            <tr>
              <td
                colSpan={columns.length}
                style={{
                  padding: "22px 16px",
                  color: MUTED,
                  fontSize: 14,
                  textAlign: "center",
                  fontFamily: "Arial, sans-serif",
                }}
              >
                {emptyMessage}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function PaginationBar({ page, totalPages, onChange }) {
  const canPrev = page > 1;
  const canNext = page < totalPages;

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 12,
        marginTop: 14,
        flexWrap: "wrap",
      }}
    >
      <div
        style={{
          color: MUTED,
          fontSize: 13,
          fontFamily: "Arial, sans-serif",
        }}
      >
        Page {totalPages ? page : 0} of {totalPages || 0}
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={() => canPrev && onChange(page - 1)}
          disabled={!canPrev}
          style={{
            ...buttonStyle("secondary"),
            opacity: canPrev ? 1 : 0.55,
            cursor: canPrev ? "pointer" : "not-allowed",
          }}
        >
          Previous
        </button>

        <button
          type="button"
          onClick={() => canNext && onChange(page + 1)}
          disabled={!canNext}
          style={{
            ...buttonStyle("secondary"),
            opacity: canNext ? 1 : 0.55,
            cursor: canNext ? "pointer" : "not-allowed",
          }}
        >
          Next
        </button>
      </div>
    </div>
  );
}

export default function AuditIndexPage() {
  const [activeMode, setActiveMode] = useState(MODE_PRODUCT_WEEKLY);

  const [bootstrap, setBootstrap] = useState({
    product_stores: [],
    consumable_stores: [],
    product_categories: [],
    products: [],
    consumable_categories: [],
    consumable_items: [],
  });

  const [bootstrapLoading, setBootstrapLoading] = useState(true);
  const [rowsLoading, setRowsLoading] = useState(false);
  const [generateLoading, setGenerateLoading] = useState(false);
  const [downloadLoading, setDownloadLoading] = useState("");
  const [savingRemarkId, setSavingRemarkId] = useState("");

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [productFilters, setProductFilters] = useState({
    referenceDate: defaultDateInputValue(),
    store: "",
    productCategoryId: "",
    productId: "",
    search: "",
    page: 1,
    pageSize: 10,
  });

  const [consumableFilters, setConsumableFilters] = useState({
    referenceDate: defaultDateInputValue(),
    store: "",
    itemCategoryId: "",
    itemId: "",
    search: "",
    page: 1,
    pageSize: 10,
  });

  const [productList, setProductList] = useState({
    items: [],
    total: 0,
    page: 1,
    page_size: 10,
    total_pages: 0,
  });

  const [consumableList, setConsumableList] = useState({
    items: [],
    total: 0,
    page: 1,
    page_size: 10,
    total_pages: 0,
  });

  const [remarksDrafts, setRemarksDrafts] = useState({});

  const modeMeta = useMemo(() => getModeMeta(activeMode), [activeMode]);
  const isProductMode = modeMeta.entity === "product";
  const isWeeklyMode = modeMeta.auditPeriodType === "weekly";

  const currentFilters = isProductMode ? productFilters : consumableFilters;

  const currentPeriod = useMemo(() => {
    return isWeeklyMode
      ? getWeeklyWindow(currentFilters.referenceDate)
      : getMonthlyWindow(currentFilters.referenceDate);
  }, [currentFilters.referenceDate, isWeeklyMode]);

  const productCategories = safeArray(bootstrap.product_categories);
  const products = safeArray(bootstrap.products);
  const productStores = safeArray(bootstrap.product_stores);

  const consumableCategories = safeArray(bootstrap.consumable_categories);
  const consumableItems = safeArray(bootstrap.consumable_items);
  const consumableStores = safeArray(bootstrap.consumable_stores);

  const filteredProducts = useMemo(() => {
    if (!productFilters.productCategoryId) return products;
    return products.filter((item) => item.category_id === productFilters.productCategoryId);
  }, [products, productFilters.productCategoryId]);

  const filteredConsumableItems = useMemo(() => {
    if (!consumableFilters.itemCategoryId) return consumableItems;
    return consumableItems.filter(
      (item) => item.category_id === consumableFilters.itemCategoryId
    );
  }, [consumableItems, consumableFilters.itemCategoryId]);

  const currentRows = isProductMode
    ? safeArray(productList.items)
    : safeArray(consumableList.items);

  const currentSummary = useMemo(() => {
    if (isProductMode) {
      return currentRows.reduce(
        (acc, row) => {
          acc.countPcs += Number(row.count_pcs || 0);
          acc.sampleSize += Number(row.sample_size_pcs || 0);
          acc.calculatedTotal += Number(row.calculated_total_kg || 0);
          acc.ledgerClosing += Number(row.ledger_closing_kg || 0);
          acc.variance += Number(row.variance_kg || 0);
          return acc;
        },
        {
          countPcs: 0,
          sampleSize: 0,
          calculatedTotal: 0,
          ledgerClosing: 0,
          variance: 0,
        }
      );
    }

    return currentRows.reduce(
      (acc, row) => {
        acc.opening += Number(row.opening_ledger || 0);
        acc.issues += Number(row.issues_total || 0);
        acc.expected += Number(row.expected_closing || 0);
        acc.variance += Number(row.variance || 0);
        return acc;
      },
      {
        opening: 0,
        issues: 0,
        expected: 0,
        variance: 0,
      }
    );
  }, [currentRows, isProductMode]);

  const loadBootstrap = useCallback(async () => {
    setBootstrapLoading(true);
    setError("");

    try {
      const data = await InventoryService.getBootstrap();
      setBootstrap({
        product_stores: safeArray(data?.product_stores),
        consumable_stores: safeArray(data?.consumable_stores),
        product_categories: safeArray(data?.product_categories),
        products: safeArray(data?.products),
        consumable_categories: safeArray(data?.consumable_categories),
        consumable_items: safeArray(data?.consumable_items),
      });
    } catch (err) {
      setError(toErrorMessage(err, "Unable to load audit setup data."));
    } finally {
      setBootstrapLoading(false);
    }
  }, []);

  const loadCurrentRows = useCallback(async () => {
    setRowsLoading(true);
    setError("");

    try {
      if (isProductMode) {
        const data = await AuditService.listProductAudits({
          auditPeriodType: modeMeta.auditPeriodType,
          periodStartDate: currentPeriod.startDate,
          periodEndDate: currentPeriod.endDate,
          store: productFilters.store,
          productCategoryId: productFilters.productCategoryId,
          productId: productFilters.productId,
          search: productFilters.search,
          page: productFilters.page,
          pageSize: productFilters.pageSize,
        });

        setProductList({
          items: safeArray(data?.items),
          total: Number(data?.total || 0),
          page: Number(data?.page || productFilters.page || 1),
          page_size: Number(data?.page_size || productFilters.pageSize || 10),
          total_pages: Number(data?.total_pages || 0),
        });
      } else {
        const data = await AuditService.listConsumableAudits({
          auditPeriodType: modeMeta.auditPeriodType,
          periodStartDate: currentPeriod.startDate,
          periodEndDate: currentPeriod.endDate,
          store: consumableFilters.store,
          itemCategoryId: consumableFilters.itemCategoryId,
          itemId: consumableFilters.itemId,
          search: consumableFilters.search,
          page: consumableFilters.page,
          pageSize: consumableFilters.pageSize,
        });

        setConsumableList({
          items: safeArray(data?.items),
          total: Number(data?.total || 0),
          page: Number(data?.page || consumableFilters.page || 1),
          page_size: Number(data?.page_size || consumableFilters.pageSize || 10),
          total_pages: Number(data?.total_pages || 0),
        });
      }
    } catch (err) {
      setError(toErrorMessage(err, "Unable to load audit rows."));
    } finally {
      setRowsLoading(false);
    }
  }, [
    isProductMode,
    modeMeta.auditPeriodType,
    currentPeriod.startDate,
    currentPeriod.endDate,
    productFilters.store,
    productFilters.productCategoryId,
    productFilters.productId,
    productFilters.search,
    productFilters.page,
    productFilters.pageSize,
    consumableFilters.store,
    consumableFilters.itemCategoryId,
    consumableFilters.itemId,
    consumableFilters.search,
    consumableFilters.page,
    consumableFilters.pageSize,
  ]);

  useEffect(() => {
    loadBootstrap();
  }, [loadBootstrap]);

  useEffect(() => {
    loadCurrentRows();
  }, [loadCurrentRows]);

  useEffect(() => {
    const draftMap = {};
    currentRows.forEach((row) => {
      draftMap[row.id] = row.remarks || "";
    });
    setRemarksDrafts(draftMap);
  }, [currentRows]);

  const handleGenerateAudit = async () => {
    setGenerateLoading(true);
    setNotice("");
    setError("");

    try {
      if (isProductMode) {
        await AuditService.generateProductAudit({
          audit_period_type: modeMeta.auditPeriodType,
          period_end_date: currentFilters.referenceDate,
          store: productFilters.store || undefined,
          product_category_id: productFilters.productCategoryId || undefined,
          product_id: productFilters.productId || undefined,
        });
      } else {
        await AuditService.generateConsumableAudit({
          audit_period_type: modeMeta.auditPeriodType,
          period_end_date: currentFilters.referenceDate,
          store: consumableFilters.store || undefined,
          item_category_id: consumableFilters.itemCategoryId || undefined,
          item_id: consumableFilters.itemId || undefined,
        });
      }

      await loadCurrentRows();
      setNotice(`${modeMeta.title} generated successfully.`);
    } catch (err) {
      setError(toErrorMessage(err, "Unable to generate audit."));
    } finally {
      setGenerateLoading(false);
    }
  };

  const handleSaveRemark = async (rowId) => {
    setSavingRemarkId(rowId);
    setNotice("");
    setError("");

    try {
      const remarks = remarksDrafts[rowId] || "";

      if (isProductMode) {
        const updated = await AuditService.updateProductAuditRemarks(rowId, {
          remarks,
        });

        setProductList((prev) => ({
          ...prev,
          items: safeArray(prev.items).map((item) =>
            item.id === rowId ? { ...item, remarks: updated?.remarks || "" } : item
          ),
        }));
      } else {
        const updated = await AuditService.updateConsumableAuditRemarks(rowId, {
          remarks,
        });

        setConsumableList((prev) => ({
          ...prev,
          items: safeArray(prev.items).map((item) =>
            item.id === rowId ? { ...item, remarks: updated?.remarks || "" } : item
          ),
        }));
      }

      setNotice("Remarks saved successfully.");
    } catch (err) {
      setError(toErrorMessage(err, "Unable to save remarks."));
    } finally {
      setSavingRemarkId("");
    }
  };

  const handleDownload = async (format) => {
    const label = `${modeMeta.entity}-${modeMeta.auditPeriodType}-${format}`;
    setDownloadLoading(label);
    setNotice("");
    setError("");

    try {
      if (isProductMode) {
        await AuditService.downloadProductAuditReport(
          AuditService.buildProductAuditReportPayload({
            auditPeriodType: modeMeta.auditPeriodType,
            periodStartDate: currentPeriod.startDate,
            periodEndDate: currentPeriod.endDate,
            exportFormat: format,
            store: productFilters.store || undefined,
            productCategoryId: productFilters.productCategoryId || undefined,
            productId: productFilters.productId || undefined,
          }),
          `product_audit_${modeMeta.auditPeriodType}.${format}`
        );
      } else {
        await AuditService.downloadConsumableAuditReport(
          AuditService.buildConsumableAuditReportPayload({
            auditPeriodType: modeMeta.auditPeriodType,
            periodStartDate: currentPeriod.startDate,
            periodEndDate: currentPeriod.endDate,
            exportFormat: format,
            store: consumableFilters.store || undefined,
            itemCategoryId: consumableFilters.itemCategoryId || undefined,
            itemId: consumableFilters.itemId || undefined,
          }),
          `consumable_audit_${modeMeta.auditPeriodType}.${format}`
        );
      }

      setNotice(`${modeMeta.title} ${format.toUpperCase()} downloaded successfully.`);
    } catch (err) {
      setError(toErrorMessage(err, "Unable to download audit report."));
    } finally {
      setDownloadLoading("");
    }
  };

  const handleRefreshPage = () => {
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  const handlePageChange = async (nextPage) => {
    if (isProductMode) {
      const next = { ...productFilters, page: nextPage };
      setProductFilters(next);
    } else {
      const next = { ...consumableFilters, page: nextPage };
      setConsumableFilters(next);
    }
  };

  const renderTopNav = () => (
    <PageCard
      style={{ marginBottom: 18 }}
      title="Inventory Audit"
      subtitle="Generate weekly or monthly audits, review rows, save remarks, and download PDF or CSV reports."
    >
      <div
        style={{
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <NavButton
          active={activeMode === MODE_PRODUCT_WEEKLY}
          onClick={() => setActiveMode(MODE_PRODUCT_WEEKLY)}
        >
          Product Weekly
        </NavButton>

        <NavButton
          active={activeMode === MODE_PRODUCT_MONTHLY}
          onClick={() => setActiveMode(MODE_PRODUCT_MONTHLY)}
        >
          Product Monthly
        </NavButton>

        <NavButton
          active={activeMode === MODE_CONSUMABLE_WEEKLY}
          onClick={() => setActiveMode(MODE_CONSUMABLE_WEEKLY)}
        >
          Consumable Weekly
        </NavButton>

        <NavButton
          active={activeMode === MODE_CONSUMABLE_MONTHLY}
          onClick={() => setActiveMode(MODE_CONSUMABLE_MONTHLY)}
        >
          Consumable Monthly
        </NavButton>

        <Link href="/inventory" style={buttonStyle("secondary")}>
          Inventory
        </Link>

        <button type="button" onClick={handleRefreshPage} style={buttonStyle("secondary")}>
          Refresh
        </button>
      </div>
    </PageCard>
  );

  const renderControls = () => (
    <PageCard
      style={{ marginBottom: 16 }}
      title={modeMeta.title}
      subtitle={`Current period: ${formatDate(currentPeriod.startDate)} to ${formatDate(
        currentPeriod.endDate
      )}`}
      action={
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={handleGenerateAudit}
            style={buttonStyle("green")}
            disabled={generateLoading || bootstrapLoading}
          >
            {generateLoading ? "Generating..." : "Generate Audit"}
          </button>

          <button
            type="button"
            onClick={loadCurrentRows}
            style={buttonStyle("secondary")}
            disabled={rowsLoading}
          >
            {rowsLoading ? "Loading..." : "Load Rows"}
          </button>

          <button
            type="button"
            onClick={() => handleDownload("pdf")}
            style={buttonStyle("secondary")}
            disabled={!!downloadLoading}
          >
            {downloadLoading === `${modeMeta.entity}-${modeMeta.auditPeriodType}-pdf`
              ? "Downloading PDF..."
              : "Download PDF"}
          </button>

          <button
            type="button"
            onClick={() => handleDownload("csv")}
            style={buttonStyle("secondary")}
            disabled={!!downloadLoading}
          >
            {downloadLoading === `${modeMeta.entity}-${modeMeta.auditPeriodType}-csv`
              ? "Downloading CSV..."
              : "Download CSV"}
          </button>
        </div>
      }
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
          gap: 14,
        }}
      >
        <div>
          <FieldLabel>{isWeeklyMode ? "Week Reference Date" : "Month Reference Date"}</FieldLabel>
          <input
            type="date"
            value={currentFilters.referenceDate}
            onChange={(e) => {
              if (isProductMode) {
                setProductFilters((prev) => ({ ...prev, referenceDate: e.target.value, page: 1 }));
              } else {
                setConsumableFilters((prev) => ({
                  ...prev,
                  referenceDate: e.target.value,
                  page: 1,
                }));
              }
            }}
            style={inputStyle()}
          />
        </div>

        <div>
          <FieldLabel>Store</FieldLabel>
          <select
            value={currentFilters.store}
            onChange={(e) => {
              if (isProductMode) {
                setProductFilters((prev) => ({ ...prev, store: e.target.value, page: 1 }));
              } else {
                setConsumableFilters((prev) => ({ ...prev, store: e.target.value, page: 1 }));
              }
            }}
            style={inputStyle()}
          >
            <option value="">All Stores</option>
            {(isProductMode ? productStores : consumableStores).map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>

        {isProductMode ? (
          <>
            <div>
              <FieldLabel>Product Category</FieldLabel>
              <select
                value={productFilters.productCategoryId}
                onChange={(e) =>
                  setProductFilters((prev) => ({
                    ...prev,
                    productCategoryId: e.target.value,
                    productId: "",
                    page: 1,
                  }))
                }
                style={inputStyle()}
              >
                <option value="">All Categories</option>
                {productCategories.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <FieldLabel>Product</FieldLabel>
              <select
                value={productFilters.productId}
                onChange={(e) =>
                  setProductFilters((prev) => ({
                    ...prev,
                    productId: e.target.value,
                    page: 1,
                  }))
                }
                style={inputStyle()}
              >
                <option value="">All Products</option>
                {filteredProducts.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>
          </>
        ) : (
          <>
            <div>
              <FieldLabel>Item Category</FieldLabel>
              <select
                value={consumableFilters.itemCategoryId}
                onChange={(e) =>
                  setConsumableFilters((prev) => ({
                    ...prev,
                    itemCategoryId: e.target.value,
                    itemId: "",
                    page: 1,
                  }))
                }
                style={inputStyle()}
              >
                <option value="">All Categories</option>
                {consumableCategories.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <FieldLabel>Item</FieldLabel>
              <select
                value={consumableFilters.itemId}
                onChange={(e) =>
                  setConsumableFilters((prev) => ({
                    ...prev,
                    itemId: e.target.value,
                    page: 1,
                  }))
                }
                style={inputStyle()}
              >
                <option value="">All Items</option>
                {filteredConsumableItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}

        <div>
          <FieldLabel>Page Size</FieldLabel>
          <select
            value={currentFilters.pageSize}
            onChange={(e) => {
              const value = Number(e.target.value);
              if (isProductMode) {
                setProductFilters((prev) => ({ ...prev, pageSize: value, page: 1 }));
              } else {
                setConsumableFilters((prev) => ({ ...prev, pageSize: value, page: 1 }));
              }
            }}
            style={inputStyle()}
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
        </div>

        <div style={{ gridColumn: "1 / -1" }}>
          <FieldLabel>Search</FieldLabel>
          <input
            type="text"
            value={currentFilters.search}
            onChange={(e) => {
              if (isProductMode) {
                setProductFilters((prev) => ({ ...prev, search: e.target.value, page: 1 }));
              } else {
                setConsumableFilters((prev) => ({ ...prev, search: e.target.value, page: 1 }));
              }
            }}
            placeholder={
              isProductMode
                ? "Search by product, category, store, or remarks"
                : "Search by item, unit, store, or remarks"
            }
            style={inputStyle()}
          />
        </div>
      </div>
    </PageCard>
  );

  const renderStats = () => {
    if (isProductMode) {
      return (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 12,
            marginBottom: 16,
          }}
        >
          <StatCard label="Rows" value={productList.total} tone="green" />
          <StatCard label="Count (pcs)" value={formatNumber(currentSummary.countPcs, 0)} tone="blue" />
          <StatCard label="Calculated Total" value={formatNumber(currentSummary.calculatedTotal)} tone="blue" />
          <StatCard label="Ledger Closing" value={formatNumber(currentSummary.ledgerClosing)} tone="green" />
          <StatCard label="Variance" value={formatNumber(currentSummary.variance)} tone="green" />
        </div>
      );
    }

    return (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 12,
          marginBottom: 16,
        }}
      >
        <StatCard label="Rows" value={consumableList.total} tone="green" />
        <StatCard label="Opening Ledger" value={formatNumber(currentSummary.opening)} tone="blue" />
        <StatCard label="Issues Total" value={formatNumber(currentSummary.issues)} tone="blue" />
        <StatCard label="Expected Closing" value={formatNumber(currentSummary.expected)} tone="green" />
        <StatCard label="Variance" value={formatNumber(currentSummary.variance)} tone="green" />
      </div>
    );
  };

  const renderProductTable = () => (
    <PageCard
      title="Product Audit Rows"
      subtitle="System values are generated automatically. User mainly updates remarks."
    >
      <InventoryTable
        loading={rowsLoading}
        rows={safeArray(productList.items)}
        emptyMessage="No product audit rows found for the selected period."
        minWidth={2150}
        columns={[
          { key: "index", label: "No." },
          { key: "weekEnding", label: isWeeklyMode ? "Week Ending" : "Month Ending" },
          { key: "store", label: "Store" },
          { key: "category", label: "Product Category" },
          { key: "product", label: "Product Type" },
          { key: "count", label: "Count (pcs)", align: "right" },
          { key: "sampleSize", label: "Sample Size (pcs)", align: "right" },
          { key: "sampleWeight", label: "Sample Weight (kg)", align: "right" },
          { key: "avgWeight", label: "Avg Weight (kg/pc)", align: "right" },
          { key: "calcTotal", label: "Calculated Total (kg)", align: "right" },
          { key: "opening", label: "Ledger Opening (kg)", align: "right" },
          { key: "inflows", label: "Ledger Inflows (kg)", align: "right" },
          { key: "outflows", label: "Ledger Outflows (kg)", align: "right" },
          { key: "closing", label: "Ledger Closing (kg)", align: "right" },
          { key: "variance", label: "Variance (kg)", align: "right" },
          { key: "variancePct", label: "Variance (%)", align: "right" },
          { key: "remarks", label: "Remarks" },
          { key: "action", label: "Action" },
        ]}
        renderRow={(row, index) => (
          <tr key={row.id}>
            <td style={tableCellStyle()}>{index + 1}</td>
            <td style={tableCellStyle()}>{formatDate(row.period_end_date)}</td>
            <td style={tableCellStyle()}>{row.store || "—"}</td>
            <td style={tableCellStyle()}>{row.product_category_name || "—"}</td>
            <td style={tableCellStyle()}>{row.product_name || "—"}</td>
            <td style={tableCellStyle("right")}>{formatNumber(row.count_pcs, 0)}</td>
            <td style={tableCellStyle("right")}>{formatNumber(row.sample_size_pcs, 0)}</td>
            <td style={tableCellStyle("right")}>{formatNumber(row.sample_weight_kg)}</td>
            <td style={tableCellStyle("right")}>{formatNumber(row.avg_weight_kg_per_pc, 4)}</td>
            <td style={tableCellStyle("right")}>{formatNumber(row.calculated_total_kg)}</td>
            <td style={tableCellStyle("right")}>{formatNumber(row.ledger_opening_kg)}</td>
            <td style={tableCellStyle("right")}>{formatNumber(row.ledger_inflows_kg)}</td>
            <td style={tableCellStyle("right")}>{formatNumber(row.ledger_outflows_kg)}</td>
            <td style={tableCellStyle("right")}>{formatNumber(row.ledger_closing_kg)}</td>
            <td
              style={{
                ...tableCellStyle("right"),
                color: Number(row.variance_kg || 0) === 0 ? GREEN : RED,
                fontWeight: 700,
              }}
            >
              {formatNumber(row.variance_kg)}
            </td>
            <td
              style={{
                ...tableCellStyle("right"),
                color: Number(row.variance_pct || 0) === 0 ? GREEN : RED,
                fontWeight: 700,
              }}
            >
              {formatNumber(row.variance_pct)}
            </td>
            <td style={{ ...tableCellStyle(), whiteSpace: "normal", minWidth: 260 }}>
              <textarea
                value={remarksDrafts[row.id] ?? ""}
                onChange={(e) =>
                  setRemarksDrafts((prev) => ({
                    ...prev,
                    [row.id]: e.target.value,
                  }))
                }
                style={textAreaStyle()}
                placeholder="Enter remarks..."
              />
            </td>
            <td style={tableCellStyle()}>
              <button
                type="button"
                onClick={() => handleSaveRemark(row.id)}
                style={buttonStyle("green")}
                disabled={savingRemarkId === row.id}
              >
                {savingRemarkId === row.id ? "Saving..." : "Save"}
              </button>
            </td>
          </tr>
        )}
      />

      <PaginationBar
        page={productList.page}
        totalPages={productList.total_pages}
        onChange={handlePageChange}
      />
    </PageCard>
  );

  const renderConsumableTable = () => (
    <PageCard
      title="Consumable Audit Rows"
      subtitle="System values are generated automatically. User mainly updates remarks."
    >
      <InventoryTable
        loading={rowsLoading}
        rows={safeArray(consumableList.items)}
        emptyMessage="No consumable audit rows found for the selected period."
        minWidth={1650}
        columns={[
          { key: "index", label: "Index" },
          { key: "weekEnding", label: isWeeklyMode ? "Week Ending" : "Month Ending" },
          { key: "store", label: "Store" },
          { key: "item", label: "Item" },
          { key: "unit", label: "Unit" },
          { key: "opening", label: "Opening Ledger", align: "right" },
          { key: "issues", label: "Issues (Total)", align: "right" },
          { key: "expected", label: "Expected Closing", align: "right" },
          { key: "physical", label: "Physical Count", align: "right" },
          { key: "variance", label: "Variance", align: "right" },
          { key: "variancePct", label: "Variance (%)", align: "right" },
          { key: "remarks", label: "Remarks" },
          { key: "action", label: "Action" },
        ]}
        renderRow={(row, index) => (
          <tr key={row.id}>
            <td style={tableCellStyle()}>{index + 1}</td>
            <td style={tableCellStyle()}>{formatDate(row.period_end_date)}</td>
            <td style={tableCellStyle()}>{row.store || "—"}</td>
            <td style={tableCellStyle()}>{row.item_name || "—"}</td>
            <td style={tableCellStyle()}>{row.unit || "—"}</td>
            <td style={tableCellStyle("right")}>{formatNumber(row.opening_ledger)}</td>
            <td style={tableCellStyle("right")}>{formatNumber(row.issues_total)}</td>
            <td style={tableCellStyle("right")}>{formatNumber(row.expected_closing)}</td>
            <td style={tableCellStyle("right")}>{formatNumber(row.physical_count)}</td>
            <td
              style={{
                ...tableCellStyle("right"),
                color: Number(row.variance || 0) === 0 ? GREEN : RED,
                fontWeight: 700,
              }}
            >
              {formatNumber(row.variance)}
            </td>
            <td
              style={{
                ...tableCellStyle("right"),
                color: Number(row.variance_pct || 0) === 0 ? GREEN : RED,
                fontWeight: 700,
              }}
            >
              {formatNumber(row.variance_pct)}
            </td>
            <td style={{ ...tableCellStyle(), whiteSpace: "normal", minWidth: 280 }}>
              <textarea
                value={remarksDrafts[row.id] ?? ""}
                onChange={(e) =>
                  setRemarksDrafts((prev) => ({
                    ...prev,
                    [row.id]: e.target.value,
                  }))
                }
                style={textAreaStyle()}
                placeholder="Enter remarks..."
              />
            </td>
            <td style={tableCellStyle()}>
              <button
                type="button"
                onClick={() => handleSaveRemark(row.id)}
                style={buttonStyle("green")}
                disabled={savingRemarkId === row.id}
              >
                {savingRemarkId === row.id ? "Saving..." : "Save"}
              </button>
            </td>
          </tr>
        )}
      />

      <PaginationBar
        page={consumableList.page}
        totalPages={consumableList.total_pages}
        onChange={handlePageChange}
      />
    </PageCard>
  );

  return (
    <>
      <Head>
        <title>Audit</title>
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
            maxWidth: 1760,
            margin: "0 auto",
            padding: "18px 18px 34px",
            boxSizing: "border-box",
          }}
        >
          {renderTopNav()}

          {error ? (
            <div
              style={{
                marginBottom: 16,
                background: RED_SOFT,
                color: RED,
                border: "1px solid rgba(185,28,28,0.12)",
                padding: "12px 14px",
                borderRadius: 14,
                fontSize: 14,
                fontFamily: "Arial, sans-serif",
              }}
            >
              {error}
            </div>
          ) : null}

          {notice ? (
            <div
              style={{
                marginBottom: 16,
                background: GREEN_SOFT,
                color: GREEN,
                border: "1px solid rgba(21,128,61,0.12)",
                padding: "12px 14px",
                borderRadius: 14,
                fontSize: 14,
                fontFamily: "Arial, sans-serif",
              }}
            >
              {notice}
            </div>
          ) : null}

          {bootstrapLoading ? (
            <PageCard title="Loading Audit Page">
              <div
                style={{
                  color: MUTED,
                  fontSize: 14,
                  fontFamily: "Arial, sans-serif",
                }}
              >
                Loading bootstrap data...
              </div>
            </PageCard>
          ) : (
            <>
              {renderControls()}
              {renderStats()}
              {isProductMode ? renderProductTable() : renderConsumableTable()}
            </>
          )}
        </div>
      </div>
    </>
  );
}