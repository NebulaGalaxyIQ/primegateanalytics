import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

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

const defaultProductFilters = {
  startDate: "",
  endDate: "",
  store: "",
  productCategoryId: "",
  productId: "",
  balanceUnit: "",
  search: "",
  page: 1,
  pageSize: 10,
  reportType: "daily",
};

const defaultConsumableFilters = {
  startDate: "",
  endDate: "",
  store: "",
  itemCategoryId: "",
  itemId: "",
  unit: "",
  search: "",
  page: 1,
  pageSize: 10,
  reportType: "daily",
};

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

function formatNumber(value) {
  const num = Number(value ?? 0);
  if (!Number.isFinite(num)) return "0.00";
  return num.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
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

function InventoryTable({ columns, rows, renderRow, loading, emptyMessage }) {
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
          minWidth: 1100,
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

export default function InventoryIndexPage() {
  const [activeInventoryTab, setActiveInventoryTab] = useState("products");
  const [activeSectionTab, setActiveSectionTab] = useState("entries");

  const [bootstrap, setBootstrap] = useState({
    product_stores: [],
    consumable_stores: [],
    product_categories: [],
    products: [],
    consumable_categories: [],
    consumable_items: [],
  });

  const [productFilters, setProductFilters] = useState(defaultProductFilters);
  const [consumableFilters, setConsumableFilters] = useState(defaultConsumableFilters);

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

  const [bootstrapLoading, setBootstrapLoading] = useState(true);
  const [productLoading, setProductLoading] = useState(false);
  const [consumableLoading, setConsumableLoading] = useState(false);
  const [downloadLoading, setDownloadLoading] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const productCategories = safeArray(bootstrap.product_categories);
  const products = safeArray(bootstrap.products);
  const consumableCategories = safeArray(bootstrap.consumable_categories);
  const consumableItems = safeArray(bootstrap.consumable_items);
  const productStores = safeArray(bootstrap.product_stores);
  const consumableStores = safeArray(bootstrap.consumable_stores);

  const filteredProducts = useMemo(() => {
    if (!productFilters.productCategoryId) return products;
    return products.filter(
      (item) => item.category_id === productFilters.productCategoryId
    );
  }, [products, productFilters.productCategoryId]);

  const filteredConsumableItems = useMemo(() => {
    if (!consumableFilters.itemCategoryId) return consumableItems;
    return consumableItems.filter(
      (item) => item.category_id === consumableFilters.itemCategoryId
    );
  }, [consumableItems, consumableFilters.itemCategoryId]);

  const productPageSummary = useMemo(() => {
    return safeArray(productList.items).reduce(
      (acc, item) => {
        acc.opening += Number(item.opening_balance || 0);
        acc.production += Number(item.inflow_production || 0);
        acc.transfersIn += Number(item.inflow_transfers_in || 0);
        acc.dispatch += Number(item.outflow_dispatch || 0);
        acc.transfersOut += Number(item.outflow_transfers_out || 0);
        acc.boxes += Number(item.total_boxes || 0);
        acc.pieces += Number(item.total_pieces || 0);
        acc.closing += Number(item.closing_balance || 0);
        return acc;
      },
      {
        opening: 0,
        production: 0,
        transfersIn: 0,
        dispatch: 0,
        transfersOut: 0,
        boxes: 0,
        pieces: 0,
        closing: 0,
      }
    );
  }, [productList.items]);

  const consumablePageSummary = useMemo(() => {
    return safeArray(consumableList.items).reduce(
      (acc, item) => {
        acc.opening += Number(item.opening_balance || 0);
        acc.issued += Number(item.issued_today || 0);
        acc.closing += Number(item.closing_balance || 0);
        return acc;
      },
      {
        opening: 0,
        issued: 0,
        closing: 0,
      }
    );
  }, [consumableList.items]);

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
      setError(toErrorMessage(err, "Unable to load inventory bootstrap data."));
    } finally {
      setBootstrapLoading(false);
    }
  }, []);

  const loadProductEntries = useCallback(async (filters) => {
    setProductLoading(true);
    setError("");
    try {
      const data = await InventoryService.listProductStoreEntries(filters);
      setProductList({
        items: safeArray(data?.items),
        total: Number(data?.total || 0),
        page: Number(data?.page || filters.page || 1),
        page_size: Number(data?.page_size || filters.pageSize || 10),
        total_pages: Number(data?.total_pages || 0),
      });
    } catch (err) {
      setError(toErrorMessage(err, "Unable to load product inventory entries."));
    } finally {
      setProductLoading(false);
    }
  }, []);

  const loadConsumableEntries = useCallback(async (filters) => {
    setConsumableLoading(true);
    setError("");
    try {
      const data = await InventoryService.listConsumableStoreEntries(filters);
      setConsumableList({
        items: safeArray(data?.items),
        total: Number(data?.total || 0),
        page: Number(data?.page || filters.page || 1),
        page_size: Number(data?.page_size || filters.pageSize || 10),
        total_pages: Number(data?.total_pages || 0),
      });
    } catch (err) {
      setError(toErrorMessage(err, "Unable to load consumable inventory entries."));
    } finally {
      setConsumableLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBootstrap();
  }, [loadBootstrap]);

  useEffect(() => {
    if (activeInventoryTab === "products") {
      loadProductEntries(productFilters);
    } else {
      loadConsumableEntries(consumableFilters);
    }
  }, [activeInventoryTab]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleApplyProductFilters = async (event) => {
    event.preventDefault();
    const next = { ...productFilters, page: 1 };
    setProductFilters(next);
    await loadProductEntries(next);
    setActiveSectionTab("entries");
  };

  const handleApplyConsumableFilters = async (event) => {
    event.preventDefault();
    const next = { ...consumableFilters, page: 1 };
    setConsumableFilters(next);
    await loadConsumableEntries(next);
    setActiveSectionTab("entries");
  };

  const handleResetProductFilters = async () => {
    setProductFilters(defaultProductFilters);
    await loadProductEntries(defaultProductFilters);
  };

  const handleResetConsumableFilters = async () => {
    setConsumableFilters(defaultConsumableFilters);
    await loadConsumableEntries(defaultConsumableFilters);
  };

  const handleProductPageChange = async (page) => {
    const next = { ...productFilters, page };
    setProductFilters(next);
    await loadProductEntries(next);
  };

  const handleConsumablePageChange = async (page) => {
    const next = { ...consumableFilters, page };
    setConsumableFilters(next);
    await loadConsumableEntries(next);
  };

  const buildProductReportPayload = (format) => ({
    start_date: productFilters.startDate || new Date().toISOString().slice(0, 10),
    end_date: productFilters.endDate || new Date().toISOString().slice(0, 10),
    report_type: productFilters.reportType || "daily",
    export_format: format,
    store: productFilters.store || undefined,
    product_category_id: productFilters.productCategoryId || undefined,
    product_id: productFilters.productId || undefined,
    balance_unit: productFilters.balanceUnit || undefined,
    include_rows: true,
    include_totals: true,
    include_summary: true,
  });

  const buildConsumableReportPayload = (format) => ({
    start_date: consumableFilters.startDate || new Date().toISOString().slice(0, 10),
    end_date: consumableFilters.endDate || new Date().toISOString().slice(0, 10),
    report_type: consumableFilters.reportType || "daily",
    export_format: format,
    store: consumableFilters.store || undefined,
    item_category_id: consumableFilters.itemCategoryId || undefined,
    item_id: consumableFilters.itemId || undefined,
    unit: consumableFilters.unit || undefined,
    include_rows: true,
    include_totals: true,
    include_summary: true,
  });

  const handleProductDownload = async (format) => {
    setDownloadLoading(`product-${format}`);
    setNotice("");
    setError("");
    try {
      const ext = format === "docx" ? "docx" : format;
      await InventoryService.downloadProductReport(
        buildProductReportPayload(format),
        `product_inventory_report.${ext}`
      );
      setNotice(`Product ${format.toUpperCase()} report downloaded successfully.`);
    } catch (err) {
      setError(toErrorMessage(err, "Unable to download product report."));
    } finally {
      setDownloadLoading("");
    }
  };

  const handleConsumableDownload = async (format) => {
    setDownloadLoading(`consumable-${format}`);
    setNotice("");
    setError("");
    try {
      const ext = format === "docx" ? "docx" : format;
      await InventoryService.downloadConsumableReport(
        buildConsumableReportPayload(format),
        `consumable_inventory_report.${ext}`
      );
      setNotice(`Consumable ${format.toUpperCase()} report downloaded successfully.`);
    } catch (err) {
      setError(toErrorMessage(err, "Unable to download consumable report."));
    } finally {
      setDownloadLoading("");
    }
  };

  const handleRefreshPage = () => {
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  // Helper to compute sequential serial number based on current page and row index
  const getSerialNumber = (page, pageSize, index) => {
    return (page - 1) * pageSize + index + 1;
  };

  const renderProductEntriesTab = () => {
    const { page, page_size, items } = productList;
    const pageSize = page_size || 10;

    return (
      <>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 12,
            marginBottom: 16,
          }}
        >
          <StatCard label="Rows" value={productList.total} tone="green" />
          <StatCard
            label="Opening Total"
            value={formatNumber(productPageSummary.opening)}
            tone="blue"
          />
          <StatCard
            label="Closing Total"
            value={formatNumber(productPageSummary.closing)}
            tone="green"
          />
          <StatCard
            label="Total Boxes"
            value={productPageSummary.boxes}
            tone="blue"
          />
        </div>

        <PageCard
          title="Product Inventory Entries"
          subtitle="Review recorded stock movement and open a full detail page for each entry."
        >
          <InventoryTable
            loading={productLoading}
            rows={safeArray(items)}
            emptyMessage="No product inventory entries found."
            columns={[
              { key: "sn", label: "S.No." },
              { key: "date", label: "Date" },
              { key: "store", label: "Store" },
              { key: "category", label: "Category" },
              { key: "product", label: "Product" },
              { key: "opening", label: "Opening", align: "right" },
              { key: "production", label: "Production", align: "right" },
              { key: "tin", label: "Transfers In", align: "right" },
              { key: "dispatch", label: "Dispatch", align: "right" },
              { key: "tout", label: "Transfers Out", align: "right" },
              { key: "boxes", label: "Boxes", align: "right" },
              { key: "pieces", label: "Pieces", align: "right" },
              { key: "closing", label: "Closing", align: "right" },
              { key: "checked", label: "Checked By" },
              { key: "action", label: "Action" },
            ]}
            renderRow={(row, idx) => (
              <tr key={row.id}>
                <td style={tableCellStyle()}>{getSerialNumber(page, pageSize, idx)}</td>
                <td style={tableCellStyle()}>{formatDate(row.entry_date)}</td>
                <td style={tableCellStyle()}>{row.store || "—"}</td>
                <td style={tableCellStyle()}>{row.product_category_name || "—"}</td>
                <td style={tableCellStyle()}>{row.product_name || "—"}</td>
                <td style={tableCellStyle("right")}>{formatNumber(row.opening_balance)}</td>
                <td style={tableCellStyle("right")}>{formatNumber(row.inflow_production)}</td>
                <td style={tableCellStyle("right")}>{formatNumber(row.inflow_transfers_in)}</td>
                <td style={tableCellStyle("right")}>{formatNumber(row.outflow_dispatch)}</td>
                <td style={tableCellStyle("right")}>{formatNumber(row.outflow_transfers_out)}</td>
                <td style={tableCellStyle("right")}>{row.total_boxes ?? 0}</td>
                <td style={tableCellStyle("right")}>{row.total_pieces ?? 0}</td>
                <td
                  style={{
                    ...tableCellStyle("right"),
                    color: Number(row.closing_balance || 0) > 0 ? GREEN : TEXT,
                    fontWeight: 700,
                  }}
                >
                  {formatNumber(row.closing_balance)}
                </td>
                <td style={tableCellStyle()}>{row.checked_by_initials || "—"}</td>
                <td style={tableCellStyle()}>
                  <Link
                    href={`/inventory/${row.id}?kind=product`}
                    style={{
                      color: BLUE,
                      textDecoration: "none",
                      fontWeight: 700,
                    }}
                  >
                    View
                  </Link>
                </td>
              </tr>
            )}
          />

          <PaginationBar
            page={productList.page}
            totalPages={productList.total_pages}
            onChange={handleProductPageChange}
          />
        </PageCard>
      </>
    );
  };

  const renderProductFiltersTab = () => (
    <PageCard
      title="Product Inventory Filters"
      subtitle="Use filters to review stock by store, category, product, unit, and date range."
    >
      <form onSubmit={handleApplyProductFilters}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 14,
          }}
        >
          <div>
            <FieldLabel>Start Date</FieldLabel>
            <input
              type="date"
              value={productFilters.startDate}
              onChange={(e) =>
                setProductFilters((prev) => ({ ...prev, startDate: e.target.value }))
              }
              style={inputStyle()}
            />
          </div>

          <div>
            <FieldLabel>End Date</FieldLabel>
            <input
              type="date"
              value={productFilters.endDate}
              onChange={(e) =>
                setProductFilters((prev) => ({ ...prev, endDate: e.target.value }))
              }
              style={inputStyle()}
            />
          </div>

          <div>
            <FieldLabel>Store</FieldLabel>
            <select
              value={productFilters.store}
              onChange={(e) =>
                setProductFilters((prev) => ({ ...prev, store: e.target.value }))
              }
              style={inputStyle()}
            >
              <option value="">All Stores</option>
              {productStores.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <FieldLabel>Category</FieldLabel>
            <select
              value={productFilters.productCategoryId}
              onChange={(e) =>
                setProductFilters((prev) => ({
                  ...prev,
                  productCategoryId: e.target.value,
                  productId: "",
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
                setProductFilters((prev) => ({ ...prev, productId: e.target.value }))
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

          <div>
            <FieldLabel>Balance Unit</FieldLabel>
            <select
              value={productFilters.balanceUnit}
              onChange={(e) =>
                setProductFilters((prev) => ({ ...prev, balanceUnit: e.target.value }))
              }
              style={inputStyle()}
            >
              <option value="">All Units</option>
              <option value="kg">kg</option>
              <option value="pcs">pcs</option>
            </select>
          </div>

          <div>
            <FieldLabel>Page Size</FieldLabel>
            <select
              value={productFilters.pageSize}
              onChange={(e) =>
                setProductFilters((prev) => ({
                  ...prev,
                  pageSize: Number(e.target.value),
                }))
              }
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
              value={productFilters.search}
              onChange={(e) =>
                setProductFilters((prev) => ({ ...prev, search: e.target.value }))
              }
              placeholder="Search by product, category, remarks, or initials"
              style={inputStyle()}
            />
          </div>
        </div>

        <div
          style={{
            marginTop: 16,
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <button type="submit" style={buttonStyle("green")}>
            Apply Filters
          </button>

          <button
            type="button"
            onClick={handleResetProductFilters}
            style={buttonStyle("secondary")}
          >
            Reset
          </button>
        </div>
      </form>
    </PageCard>
  );

  const renderProductReportsTab = () => (
    <PageCard
      title="Product Reports & Downloads"
      subtitle="Download daily or weekly product reports using the current product filter values."
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 14,
          marginBottom: 18,
        }}
      >
        <div>
          <FieldLabel>Report Type</FieldLabel>
          <select
            value={productFilters.reportType}
            onChange={(e) =>
              setProductFilters((prev) => ({ ...prev, reportType: e.target.value }))
            }
            style={inputStyle()}
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
          </select>
        </div>

        <div>
          <FieldLabel>Start Date</FieldLabel>
          <input
            type="date"
            value={productFilters.startDate}
            onChange={(e) =>
              setProductFilters((prev) => ({ ...prev, startDate: e.target.value }))
            }
            style={inputStyle()}
          />
        </div>

        <div>
          <FieldLabel>End Date</FieldLabel>
          <input
            type="date"
            value={productFilters.endDate}
            onChange={(e) =>
              setProductFilters((prev) => ({ ...prev, endDate: e.target.value }))
            }
            style={inputStyle()}
          />
        </div>
      </div>

      <div
        style={{
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
          marginBottom: 16,
        }}
      >
        <button
          type="button"
          onClick={() => handleProductDownload("pdf")}
          disabled={!!downloadLoading}
          style={buttonStyle("secondary")}
        >
          {downloadLoading === "product-pdf" ? "Downloading PDF..." : "Download PDF"}
        </button>

        <button
          type="button"
          onClick={() => handleProductDownload("docx")}
          disabled={!!downloadLoading}
          style={buttonStyle("secondary")}
        >
          {downloadLoading === "product-docx" ? "Downloading Word..." : "Download Word"}
        </button>

        <button
          type="button"
          onClick={() => handleProductDownload("csv")}
          disabled={!!downloadLoading}
          style={buttonStyle("secondary")}
        >
          {downloadLoading === "product-csv" ? "Downloading CSV..." : "Download CSV"}
        </button>
      </div>

      <div
        style={{
          background: "#fafafa",
          border: `1px solid ${BORDER}`,
          borderRadius: 16,
          padding: 14,
          color: MUTED,
          fontSize: 13,
          lineHeight: 1.6,
          fontFamily: "Arial, sans-serif",
        }}
      >
        Product reports use your current product filters, including store, category, product, unit, date range, and report type.
      </div>
    </PageCard>
  );

  const renderConsumableEntriesTab = () => {
    const { page, page_size, items } = consumableList;
    const pageSize = page_size || 10;

    return (
      <>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 12,
            marginBottom: 16,
          }}
        >
          <StatCard label="Rows" value={consumableList.total} tone="green" />
          <StatCard
            label="Opening Total"
            value={formatNumber(consumablePageSummary.opening)}
            tone="blue"
          />
          <StatCard
            label="Issued Total"
            value={formatNumber(consumablePageSummary.issued)}
            tone="blue"
          />
          <StatCard
            label="Closing Total"
            value={formatNumber(consumablePageSummary.closing)}
            tone="green"
          />
        </div>

        <PageCard
          title="Consumable Inventory Entries"
          subtitle="Review issue records and stock balances by store and item."
        >
          <InventoryTable
            loading={consumableLoading}
            rows={safeArray(items)}
            emptyMessage="No consumable inventory entries found."
            columns={[
              { key: "sn", label: "S.No." },
              { key: "date", label: "Date" },
              { key: "store", label: "Store" },
              { key: "category", label: "Category" },
              { key: "item", label: "Item" },
              { key: "unit", label: "Unit" },
              { key: "opening", label: "Opening", align: "right" },
              { key: "issued", label: "Issued Today", align: "right" },
              { key: "closing", label: "Closing", align: "right" },
              { key: "checked", label: "Checked By" },
              { key: "action", label: "Action" },
            ]}
            renderRow={(row, idx) => (
              <tr key={row.id}>
                <td style={tableCellStyle()}>{getSerialNumber(page, pageSize, idx)}</td>
                <td style={tableCellStyle()}>{formatDate(row.entry_date)}</td>
                <td style={tableCellStyle()}>{row.store || "—"}</td>
                <td style={tableCellStyle()}>{row.item_category_name || "—"}</td>
                <td style={tableCellStyle()}>{row.item_name || "—"}</td>
                <td style={tableCellStyle()}>{row.unit || "—"}</td>
                <td style={tableCellStyle("right")}>{formatNumber(row.opening_balance)}</td>
                <td style={tableCellStyle("right")}>{formatNumber(row.issued_today)}</td>
                <td
                  style={{
                    ...tableCellStyle("right"),
                    color: Number(row.closing_balance || 0) > 0 ? GREEN : TEXT,
                    fontWeight: 700,
                  }}
                >
                  {formatNumber(row.closing_balance)}
                </td>
                <td style={tableCellStyle()}>{row.checked_by_initials || "—"}</td>
                <td style={tableCellStyle()}>
                  <Link
                    href={`/inventory/${row.id}?kind=consumable`}
                    style={{
                      color: BLUE,
                      textDecoration: "none",
                      fontWeight: 700,
                    }}
                  >
                    View
                  </Link>
                </td>
              </tr>
            )}
          />

          <PaginationBar
            page={consumableList.page}
            totalPages={consumableList.total_pages}
            onChange={handleConsumablePageChange}
          />
        </PageCard>
      </>
    );
  };

  const renderConsumableFiltersTab = () => (
    <PageCard
      title="Consumable Inventory Filters"
      subtitle="Review issues, balances, and stock movement for consumable items."
    >
      <form onSubmit={handleApplyConsumableFilters}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 14,
          }}
        >
          <div>
            <FieldLabel>Start Date</FieldLabel>
            <input
              type="date"
              value={consumableFilters.startDate}
              onChange={(e) =>
                setConsumableFilters((prev) => ({
                  ...prev,
                  startDate: e.target.value,
                }))
              }
              style={inputStyle()}
            />
          </div>

          <div>
            <FieldLabel>End Date</FieldLabel>
            <input
              type="date"
              value={consumableFilters.endDate}
              onChange={(e) =>
                setConsumableFilters((prev) => ({
                  ...prev,
                  endDate: e.target.value,
                }))
              }
              style={inputStyle()}
            />
          </div>

          <div>
            <FieldLabel>Store</FieldLabel>
            <select
              value={consumableFilters.store}
              onChange={(e) =>
                setConsumableFilters((prev) => ({
                  ...prev,
                  store: e.target.value,
                }))
              }
              style={inputStyle()}
            >
              <option value="">All Stores</option>
              {consumableStores.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <FieldLabel>Category</FieldLabel>
            <select
              value={consumableFilters.itemCategoryId}
              onChange={(e) =>
                setConsumableFilters((prev) => ({
                  ...prev,
                  itemCategoryId: e.target.value,
                  itemId: "",
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

          <div>
            <FieldLabel>Unit</FieldLabel>
            <input
              type="text"
              value={consumableFilters.unit}
              onChange={(e) =>
                setConsumableFilters((prev) => ({
                  ...prev,
                  unit: e.target.value,
                }))
              }
              placeholder="pcs, kg, cartons..."
              style={inputStyle()}
            />
          </div>

          <div>
            <FieldLabel>Page Size</FieldLabel>
            <select
              value={consumableFilters.pageSize}
              onChange={(e) =>
                setConsumableFilters((prev) => ({
                  ...prev,
                  pageSize: Number(e.target.value),
                }))
              }
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
              value={consumableFilters.search}
              onChange={(e) =>
                setConsumableFilters((prev) => ({
                  ...prev,
                  search: e.target.value,
                }))
              }
              placeholder="Search by item, category, remarks, or initials"
              style={inputStyle()}
            />
          </div>
        </div>

        <div
          style={{
            marginTop: 16,
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <button type="submit" style={buttonStyle("green")}>
            Apply Filters
          </button>

          <button
            type="button"
            onClick={handleResetConsumableFilters}
            style={buttonStyle("secondary")}
          >
            Reset
          </button>
        </div>
      </form>
    </PageCard>
  );

  const renderConsumableReportsTab = () => (
    <PageCard
      title="Consumable Reports & Downloads"
      subtitle="Download daily or weekly consumable reports using the current consumable filter values."
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 14,
          marginBottom: 18,
        }}
      >
        <div>
          <FieldLabel>Report Type</FieldLabel>
          <select
            value={consumableFilters.reportType}
            onChange={(e) =>
              setConsumableFilters((prev) => ({ ...prev, reportType: e.target.value }))
            }
            style={inputStyle()}
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
          </select>
        </div>

        <div>
          <FieldLabel>Start Date</FieldLabel>
          <input
            type="date"
            value={consumableFilters.startDate}
            onChange={(e) =>
              setConsumableFilters((prev) => ({ ...prev, startDate: e.target.value }))
            }
            style={inputStyle()}
          />
        </div>

        <div>
          <FieldLabel>End Date</FieldLabel>
          <input
            type="date"
            value={consumableFilters.endDate}
            onChange={(e) =>
              setConsumableFilters((prev) => ({ ...prev, endDate: e.target.value }))
            }
            style={inputStyle()}
          />
        </div>
      </div>

      <div
        style={{
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
          marginBottom: 16,
        }}
      >
        <button
          type="button"
          onClick={() => handleConsumableDownload("pdf")}
          disabled={!!downloadLoading}
          style={buttonStyle("secondary")}
        >
          {downloadLoading === "consumable-pdf" ? "Downloading PDF..." : "Download PDF"}
        </button>

        <button
          type="button"
          onClick={() => handleConsumableDownload("docx")}
          disabled={!!downloadLoading}
          style={buttonStyle("secondary")}
        >
          {downloadLoading === "consumable-docx" ? "Downloading Word..." : "Download Word"}
        </button>

        <button
          type="button"
          onClick={() => handleConsumableDownload("csv")}
          disabled={!!downloadLoading}
          style={buttonStyle("secondary")}
        >
          {downloadLoading === "consumable-csv" ? "Downloading CSV..." : "Download CSV"}
        </button>
      </div>

      <div
        style={{
          background: "#fafafa",
          border: `1px solid ${BORDER}`,
          borderRadius: 16,
          padding: 14,
          color: MUTED,
          fontSize: 13,
          lineHeight: 1.6,
          fontFamily: "Arial, sans-serif",
        }}
      >
        Consumable reports use your current consumable filters, including store, category, item, unit, date range, and report type.
      </div>
    </PageCard>
  );

  return (
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
          maxWidth: 1500,
          margin: "0 auto",
          padding: "18px 18px 34px",
          boxSizing: "border-box",
        }}
      >
        <PageCard
          style={{ marginBottom: 18 }}
          title="Inventory Management"
          subtitle="Review inventory entries, apply filters, and download reports."
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
              active={activeInventoryTab === "products"}
              onClick={() => setActiveInventoryTab("products")}
            >
              Product Store
            </NavButton>

            <NavButton
              active={activeInventoryTab === "consumables"}
              onClick={() => setActiveInventoryTab("consumables")}
            >
              Consumable Store
            </NavButton>

            <Link href="/inventory/daily" style={buttonStyle("secondary")}>
              Daily Sheet
            </Link>

            <Link href="/inventory/new" style={buttonStyle("secondary")}>
              Create New Entry
            </Link>

            <button
              type="button"
              onClick={handleRefreshPage}
              style={buttonStyle("secondary")}
            >
              Refresh
            </button>
          </div>
        </PageCard>

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

        <div
          style={{
            display: "flex",
            gap: 10,
            marginBottom: 16,
            flexWrap: "wrap",
          }}
        >
          <NavButton
            active={activeSectionTab === "entries"}
            onClick={() => setActiveSectionTab("entries")}
          >
            Entries
          </NavButton>

          <NavButton
            active={activeSectionTab === "filters"}
            onClick={() => setActiveSectionTab("filters")}
          >
            Filters
          </NavButton>

          <NavButton
            active={activeSectionTab === "reports"}
            onClick={() => setActiveSectionTab("reports")}
          >
            Reports & Downloads
          </NavButton>
        </div>

        {activeInventoryTab === "products" ? (
          activeSectionTab === "entries" ? (
            renderProductEntriesTab()
          ) : activeSectionTab === "filters" ? (
            renderProductFiltersTab()
          ) : (
            renderProductReportsTab()
          )
        ) : activeSectionTab === "entries" ? (
          renderConsumableEntriesTab()
        ) : activeSectionTab === "filters" ? (
          renderConsumableFiltersTab()
        ) : (
          renderConsumableReportsTab()
        )}
      </div>
    </div>
  );
}