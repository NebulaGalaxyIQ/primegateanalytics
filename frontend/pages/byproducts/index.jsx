import Head from "next/head";
import Link from "next/link";
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

function formatNumber(value) {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return "0";
  return new Intl.NumberFormat().format(n);
}

function formatCurrency(value) {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return "TZS 0.00";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "TZS",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
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

function getSaleCustomerName(sale) {
  return (
    sale?.customer_name_snapshot ||
    sale?.customer_name ||
    sale?.transaction_name_snapshot ||
    sale?.transaction_name ||
    sale?.customer?.customer_name ||
    sale?.customer?.transaction_name ||
    "Walk-in / Unspecified"
  );
}

function getSaleStatus(sale) {
  return sale?.status || sale?.sale_status || sale?.status_value || "draft";
}

function getSaleTotal(sale) {
  return (
    sale?.total_amount ??
    sale?.grand_total ??
    sale?.net_amount ??
    sale?.subtotal_amount ??
    0
  );
}

function getSaleBalance(sale) {
  return sale?.balance_due ?? sale?.outstanding_amount ?? 0;
}

function MetricCard({ title, value, hint, color, soft, href }) {
  return (
    <Link href={href} className="by-card-link by-metric-card">
      <div className="by-metric-icon" style={{ background: soft, color }}>
        •
      </div>
      <div className="by-metric-title">{title}</div>
      <div className="by-metric-value">{value}</div>
      <div className="by-metric-hint">{hint}</div>
    </Link>
  );
}

function QuickLinkCard({ href, title, description, badge }) {
  return (
    <Link href={href} className="by-card-link by-quick-card">
      <div className="by-quick-badge">{badge}</div>
      <div className="by-quick-title">{title}</div>
      <div className="by-quick-description">{description}</div>
    </Link>
  );
}

function StatusPill({ value }) {
  const text = String(value || "draft").toLowerCase();

  let styles = {
    background: BLUE_SOFT,
    color: BLUE,
  };

  if (
    text.includes("paid") ||
    text.includes("complete") ||
    text.includes("completed") ||
    text.includes("success")
  ) {
    styles = { background: GREEN_SOFT, color: GREEN };
  } else if (
    text.includes("void") ||
    text.includes("cancel") ||
    text.includes("fail") ||
    text.includes("overdue")
  ) {
    styles = { background: RED_SOFT, color: RED };
  } else if (
    text.includes("pending") ||
    text.includes("partial") ||
    text.includes("draft")
  ) {
    styles = { background: ORANGE_SOFT, color: ORANGE_DEEP };
  }

  return (
    <span className="by-status-pill" style={styles}>
      {text.replace(/_/g, " ")}
    </span>
  );
}

export default function ByproductsIndexPage() {
  const [overview, setOverview] = useState({
    categories: 0,
    items: 0,
    customers: 0,
    sales: 0,
    templates: 0,
  });
  const [recentSales, setRecentSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tableLoading, setTableLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");

  const fetchOverview = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [
        categoriesResponse,
        itemsResponse,
        customersResponse,
        salesResponse,
        templatesResponse,
      ] = await Promise.all([
        ByproductsService.listCategories({ skip: 0, limit: 1 }),
        ByproductsService.listItems({ skip: 0, limit: 1 }),
        ByproductsService.listCustomers({ skip: 0, limit: 1 }),
        ByproductsService.listSales({ skip: 0, limit: 12 }),
        ByproductsService.listTemplates({ skip: 0, limit: 1 }),
      ]);

      setOverview({
        categories: coerceTotal(categoriesResponse),
        items: coerceTotal(itemsResponse),
        customers: coerceTotal(customersResponse),
        sales: coerceTotal(salesResponse),
        templates: coerceTotal(templatesResponse),
      });

      setRecentSales(coerceItems(salesResponse));
    } catch (err) {
      setError(err?.message || "Failed to load byproducts dashboard.");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchRecentSales = useCallback(async () => {
    setTableLoading(true);
    setError("");

    try {
      const response = await ByproductsService.listSales({
        skip: 0,
        limit: 12,
        search: search || undefined,
        status: status || undefined,
      });

      setRecentSales(coerceItems(response));
    } catch (err) {
      setError(err?.message || "Failed to load recent sales.");
    } finally {
      setTableLoading(false);
    }
  }, [search, status]);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!loading) fetchRecentSales();
    }, 250);

    return () => clearTimeout(timer);
  }, [search, status, loading, fetchRecentSales]);

  const totals = useMemo(() => {
    const gross = recentSales.reduce(
      (sum, sale) => sum + Number(getSaleTotal(sale) || 0),
      0
    );
    const balance = recentSales.reduce(
      (sum, sale) => sum + Number(getSaleBalance(sale) || 0),
      0
    );
    return { gross, balance };
  }, [recentSales]);

  return (
    <>
      <Head>
        <title>Byproducts | PG Data Analytics IQ</title>
      </Head>

      <div className="byproducts-page">
        <div className="byproducts-container">
          <section className="by-hero-card">
            <div className="by-hero-top">
              <div className="by-hero-copy">
                <div className="by-hero-chip">Byproducts Management</div>

                <h1 className="by-hero-title">Byproducts Sales Dashboard</h1>

                <p className="by-hero-text">
                  Manage byproduct categories, items, customers, sales records,
                  templates, and reports from one place.
                </p>
              </div>

              <div className="by-hero-actions">
                <Link href="/byproducts/sales" className="by-primary-btn">
                  Open Sales
                </Link>

                <button
                  type="button"
                  onClick={fetchOverview}
                  disabled={loading}
                  className="by-secondary-btn"
                >
                  {loading ? "Refreshing..." : "Refresh"}
                </button>
              </div>
            </div>

            {error ? <div className="by-error-box">{error}</div> : null}
          </section>

          <section className="by-metrics-grid">
            <MetricCard
              title="Categories"
              value={loading ? "..." : formatNumber(overview.categories)}
              hint="Configured byproduct groups"
              color={ORANGE}
              soft={ORANGE_SOFT}
              href="/byproducts/categories"
            />
            <MetricCard
              title="Items"
              value={loading ? "..." : formatNumber(overview.items)}
              hint="Available byproduct items"
              color={BLUE}
              soft={BLUE_SOFT}
              href="/byproducts/items"
            />
            <MetricCard
              title="Customers"
              value={loading ? "..." : formatNumber(overview.customers)}
              hint="Registered buyers and outlets"
              color={GREEN}
              soft={GREEN_SOFT}
              href="/byproducts/customers"
            />
            <MetricCard
              title="Sales"
              value={loading ? "..." : formatNumber(overview.sales)}
              hint="Recorded byproducts sales"
              color={ORANGE_DEEP}
              soft={ORANGE_SOFT}
              href="/byproducts/sales"
            />
            <MetricCard
              title="Templates"
              value={loading ? "..." : formatNumber(overview.templates)}
              hint="Report document templates"
              color={RED}
              soft={RED_SOFT}
              href="/byproducts/templates"
            />
          </section>

          <section className="by-panel">
            <div className="by-section-head">
              <div>
                <h2 className="by-section-title">Quick actions</h2>
                <p className="by-section-text">
                  Open the main byproducts sections quickly.
                </p>
              </div>
            </div>

            <div className="by-quick-grid">
              <QuickLinkCard
                href="/byproducts/categories"
                badge="Setup"
                title="Manage Categories"
                description="Create and organize byproduct groups."
              />
              <QuickLinkCard
                href="/byproducts/items"
                badge="Catalog"
                title="Manage Items"
                description="Maintain items, units, and selling prices."
              />
              <QuickLinkCard
                href="/byproducts/customers"
                badge="Customers"
                title="Manage Customers"
                description="Register buyers, locations, and contacts."
              />
              <QuickLinkCard
                href="/byproducts/sales"
                badge="Sales"
                title="Record Sales"
                description="Create, update, and review byproducts sales."
              />
              <QuickLinkCard
                href="/byproducts/reports"
                badge="Reports"
                title="View Reports"
                description="Run daily, weekly, monthly, and custom reports."
              />
              <QuickLinkCard
                href="/byproducts/templates"
                badge="Templates"
                title="Report Templates"
                description="Upload and manage report templates."
              />
            </div>
          </section>

          <section className="by-panel">
            <div className="by-sales-head">
              <div className="by-sales-head-copy">
                <h2 className="by-section-title">Recent sales</h2>
                <p className="by-section-text">
                  Latest recorded byproducts sales.
                </p>
              </div>

              <div className="by-summary-pills">
                <div className="by-summary-pill by-summary-pill-orange">
                  Total: {formatCurrency(totals.gross)}
                </div>
                <div className="by-summary-pill by-summary-pill-red">
                  Balance Due: {formatCurrency(totals.balance)}
                </div>
              </div>
            </div>

            <div className="by-filters-grid">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search sale no, customer, item..."
                className="by-field"
              />

              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="by-field"
              >
                <option value="">All statuses</option>
                <option value="draft">Draft</option>
                <option value="pending">Pending</option>
                <option value="partial">Partial</option>
                <option value="paid">Paid</option>
                <option value="completed">Completed</option>
                <option value="void">Void</option>
              </select>

              <button
                type="button"
                onClick={fetchRecentSales}
                disabled={tableLoading}
                className="by-secondary-btn by-full-width-btn"
              >
                {tableLoading ? "Loading..." : "Reload Table"}
              </button>
            </div>

            <div className="by-desktop-table-wrap">
              <table className="by-sales-table">
                <thead>
                  <tr>
                    {[
                      "Sale No.",
                      "Date",
                      "Customer",
                      "Status",
                      "Total",
                      "Balance",
                      "Action",
                    ].map((label) => (
                      <th key={label}>{label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recentSales.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="by-empty-cell">
                        {tableLoading
                          ? "Loading sales..."
                          : "No byproducts sales found."}
                      </td>
                    </tr>
                  ) : (
                    recentSales.map((sale, index) => (
                      <tr key={sale?.id || sale?.sale_number || index}>
                        <td className="by-strong-cell">
                          {sale?.sale_number || "—"}
                        </td>
                        <td>{formatDate(sale?.sale_date || sale?.created_at)}</td>
                        <td>{getSaleCustomerName(sale)}</td>
                        <td>
                          <StatusPill value={getSaleStatus(sale)} />
                        </td>
                        <td className="by-strong-cell by-nowrap">
                          {formatCurrency(getSaleTotal(sale))}
                        </td>
                        <td
                          className="by-strong-cell by-nowrap"
                          style={{
                            color:
                              Number(getSaleBalance(sale) || 0) > 0 ? RED : GREEN,
                          }}
                        >
                          {formatCurrency(getSaleBalance(sale))}
                        </td>
                        <td>
                          <Link
                            href={
                              sale?.id
                                ? `/byproducts/sales/${sale.id}`
                                : "/byproducts/sales"
                            }
                            className="by-table-link"
                          >
                            View
                          </Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="by-mobile-sales-list">
              {recentSales.length === 0 ? (
                <div className="by-mobile-empty">
                  {tableLoading
                    ? "Loading sales..."
                    : "No byproducts sales found."}
                </div>
              ) : (
                recentSales.map((sale, index) => (
                  <div
                    key={sale?.id || sale?.sale_number || index}
                    className="by-mobile-sale-card"
                  >
                    <div className="by-mobile-sale-top">
                      <div className="by-mobile-sale-main">
                        <div className="by-mobile-sale-number">
                          {sale?.sale_number || "—"}
                        </div>
                        <div className="by-mobile-sale-date">
                          {formatDate(sale?.sale_date || sale?.created_at)}
                        </div>
                      </div>

                      <StatusPill value={getSaleStatus(sale)} />
                    </div>

                    <div className="by-mobile-sale-grid">
                      <div className="by-mobile-sale-row by-full">
                        <span className="by-mobile-label">Customer</span>
                        <span className="by-mobile-value">
                          {getSaleCustomerName(sale)}
                        </span>
                      </div>

                      <div className="by-mobile-sale-row">
                        <span className="by-mobile-label">Total</span>
                        <span className="by-mobile-value by-strong-cell">
                          {formatCurrency(getSaleTotal(sale))}
                        </span>
                      </div>

                      <div className="by-mobile-sale-row">
                        <span className="by-mobile-label">Balance</span>
                        <span
                          className="by-mobile-value by-strong-cell"
                          style={{
                            color:
                              Number(getSaleBalance(sale) || 0) > 0 ? RED : GREEN,
                          }}
                        >
                          {formatCurrency(getSaleBalance(sale))}
                        </span>
                      </div>
                    </div>

                    <div className="by-mobile-sale-actions">
                      <Link
                        href={
                          sale?.id
                            ? `/byproducts/sales/${sale.id}`
                            : "/byproducts/sales"
                        }
                        className="by-table-link"
                      >
                        View
                      </Link>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </div>

      <style jsx global>{`
        .byproducts-page {
          min-height: 100vh;
          background: ${PAGE_BG};
          padding: 18px 14px 36px;
          font-family: Arial, sans-serif;
        }

        .byproducts-container {
          max-width: 1320px;
          margin: 0 auto;
          display: grid;
          gap: 18px;
        }

        .by-card-link,
        .by-primary-btn,
        .by-table-link {
          text-decoration: none !important;
        }

        .by-hero-card,
        .by-panel,
        .by-metric-card,
        .by-quick-card,
        .by-mobile-sale-card {
          background: ${SURFACE};
          border: 1px solid ${BORDER};
          box-shadow: ${SHADOW};
          box-sizing: border-box;
        }

        .by-hero-card {
          border-radius: 24px;
          padding: 20px;
          background: linear-gradient(
            135deg,
            rgba(255, 122, 0, 0.1) 0%,
            rgba(37, 99, 235, 0.08) 100%
          );
        }

        .by-hero-top {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          flex-wrap: wrap;
        }

        .by-hero-copy {
          min-width: 0;
          flex: 1;
        }

        .by-hero-chip {
          display: inline-flex;
          align-items: center;
          padding: 6px 12px;
          border-radius: 999px;
          background: ${SURFACE};
          border: 1px solid ${BORDER};
          color: ${ORANGE_DEEP};
          font-size: 12px;
          font-weight: 800;
          margin-bottom: 12px;
        }

        .by-hero-title {
          margin: 0;
          color: ${TEXT};
          font-size: 30px;
          line-height: 1.15;
          font-weight: 800;
          word-break: break-word;
        }

        .by-hero-text {
          margin: 10px 0 0;
          color: ${MUTED};
          font-size: 14px;
          line-height: 1.7;
          max-width: 820px;
        }

        .by-hero-actions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          align-items: center;
        }

        .by-primary-btn,
        .by-secondary-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 44px;
          padding: 0 16px;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 800;
          box-sizing: border-box;
        }

        .by-primary-btn {
          background: ${ORANGE};
          color: #ffffff !important;
          border: none;
          box-shadow: 0 8px 20px rgba(255, 122, 0, 0.18);
        }

        .by-secondary-btn {
          background: ${SURFACE};
          color: ${TEXT};
          border: 1px solid ${BORDER};
          cursor: pointer;
        }

        .by-secondary-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .by-error-box {
          margin-top: 14px;
          border-radius: 16px;
          border: 1px solid rgba(220, 38, 38, 0.18);
          background: rgba(220, 38, 38, 0.06);
          color: ${RED};
          padding: 12px 14px;
          font-size: 13px;
          font-weight: 700;
          word-break: break-word;
        }

        .by-metrics-grid {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 16px;
        }

        .by-metric-card {
          display: block;
          border-radius: 20px;
          padding: 18px;
          min-height: 126px;
          color: inherit !important;
          min-width: 0;
        }

        .by-metric-icon {
          width: 42px;
          height: 42px;
          border-radius: 14px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          font-weight: 800;
          margin-bottom: 14px;
        }

        .by-metric-title {
          color: ${MUTED};
          font-size: 13px;
          font-weight: 700;
          margin-bottom: 6px;
        }

        .by-metric-value {
          color: ${TEXT};
          font-size: 28px;
          line-height: 1.1;
          font-weight: 800;
          margin-bottom: 6px;
          word-break: break-word;
        }

        .by-metric-hint {
          color: ${MUTED};
          font-size: 13px;
          line-height: 1.5;
        }

        .by-panel {
          border-radius: 22px;
          padding: 18px;
          overflow: hidden;
        }

        .by-section-head,
        .by-sales-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 14px;
          flex-wrap: wrap;
          margin-bottom: 16px;
        }

        .by-section-title {
          margin: 0;
          color: ${TEXT};
          font-size: 20px;
          font-weight: 800;
          word-break: break-word;
        }

        .by-section-text {
          margin: 6px 0 0;
          color: ${MUTED};
          font-size: 13px;
          line-height: 1.6;
        }

        .by-quick-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 14px;
        }

        .by-quick-card {
          display: block;
          border-radius: 18px;
          padding: 16px;
          min-width: 0;
          color: inherit !important;
        }

        .by-quick-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 72px;
          max-width: 100%;
          padding: 6px 10px;
          border-radius: 999px;
          background: ${ORANGE_SOFT};
          color: ${ORANGE_DEEP};
          font-size: 12px;
          font-weight: 700;
          margin-bottom: 12px;
        }

        .by-quick-title {
          color: ${TEXT};
          font-size: 16px;
          font-weight: 800;
          margin-bottom: 8px;
          word-break: break-word;
        }

        .by-quick-description {
          color: ${MUTED};
          font-size: 13px;
          line-height: 1.55;
          word-break: break-word;
        }

        .by-summary-pills {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }

        .by-summary-pill {
          padding: 8px 12px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 800;
          white-space: nowrap;
        }

        .by-summary-pill-orange {
          background: ${ORANGE_SOFT};
          color: ${ORANGE_DEEP};
        }

        .by-summary-pill-red {
          background: ${RED_SOFT};
          color: ${RED};
        }

        .by-filters-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 180px 160px;
          gap: 12px;
          margin-bottom: 16px;
        }

        .by-field {
          min-height: 44px;
          width: 100%;
          border-radius: 12px;
          border: 1px solid ${BORDER};
          padding: 0 14px;
          font-size: 14px;
          color: ${TEXT};
          outline: none;
          background: #fff;
          box-sizing: border-box;
        }

        .by-full-width-btn {
          width: 100%;
        }

        .by-desktop-table-wrap {
          display: block;
          overflow-x: auto;
          border: 1px solid ${BORDER};
          border-radius: 16px;
        }

        .by-sales-table {
          width: 100%;
          border-collapse: collapse;
          min-width: 860px;
          background: #fff;
        }

        .by-sales-table thead tr {
          background: #f8fafc;
        }

        .by-sales-table th {
          text-align: left;
          padding: 13px 14px;
          border-bottom: 1px solid ${BORDER};
          color: ${TEXT};
          font-size: 13px;
          font-weight: 800;
          white-space: nowrap;
        }

        .by-sales-table td {
          padding: 13px 14px;
          border-bottom: 1px solid ${BORDER};
          color: ${TEXT};
          font-size: 13px;
          vertical-align: middle;
        }

        .by-sales-table tbody tr:last-child td {
          border-bottom: none;
        }

        .by-strong-cell {
          font-weight: 700;
        }

        .by-nowrap {
          white-space: nowrap;
        }

        .by-table-link {
          color: ${BLUE} !important;
          font-size: 13px;
          font-weight: 800;
        }

        .by-empty-cell {
          padding: 28px 14px !important;
          text-align: center;
          color: ${MUTED} !important;
          font-size: 14px !important;
        }

        .by-status-pill {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 6px 10px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 700;
          text-transform: capitalize;
          white-space: nowrap;
        }

        .by-mobile-sales-list {
          display: none;
        }

        .by-mobile-sale-card {
          border-radius: 18px;
          padding: 14px;
        }

        .by-mobile-sale-top {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 12px;
        }

        .by-mobile-sale-main {
          min-width: 0;
          flex: 1;
        }

        .by-mobile-sale-number {
          color: ${TEXT};
          font-size: 15px;
          font-weight: 800;
          line-height: 1.4;
          word-break: break-word;
        }

        .by-mobile-sale-date {
          margin-top: 4px;
          color: ${MUTED};
          font-size: 12px;
        }

        .by-mobile-sale-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }

        .by-mobile-sale-row {
          background: #f8fafc;
          border: 1px solid ${BORDER};
          border-radius: 14px;
          padding: 10px 12px;
          min-width: 0;
        }

        .by-full {
          grid-column: 1 / -1;
        }

        .by-mobile-label {
          display: block;
          color: ${MUTED};
          font-size: 11px;
          font-weight: 700;
          margin-bottom: 6px;
        }

        .by-mobile-value {
          display: block;
          color: ${TEXT};
          font-size: 13px;
          line-height: 1.5;
          word-break: break-word;
        }

        .by-mobile-sale-actions {
          margin-top: 12px;
          display: flex;
          justify-content: flex-end;
        }

        .by-mobile-empty {
          border: 1px dashed ${BORDER};
          border-radius: 16px;
          padding: 18px;
          color: ${MUTED};
          font-size: 14px;
          text-align: center;
        }

        @media (max-width: 1180px) {
          .by-metrics-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }

          .by-quick-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 820px) {
          .byproducts-page {
            padding: 14px 10px 28px;
          }

          .by-hero-card,
          .by-panel {
            border-radius: 18px;
            padding: 14px;
          }

          .by-hero-title {
            font-size: 24px;
          }

          .by-hero-actions {
            width: 100%;
          }

          .by-primary-btn,
          .by-secondary-btn {
            flex: 1 1 160px;
          }

          .by-metrics-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 12px;
          }

          .by-metric-card {
            min-height: 112px;
            padding: 14px;
            border-radius: 16px;
          }

          .by-metric-value {
            font-size: 22px;
          }

          .by-quick-grid {
            grid-template-columns: 1fr;
            gap: 12px;
          }

          .by-filters-grid {
            grid-template-columns: 1fr;
          }

          .by-desktop-table-wrap {
            display: none;
          }

          .by-mobile-sales-list {
            display: grid;
            gap: 12px;
          }

          .by-summary-pills {
            width: 100%;
          }

          .by-summary-pill {
            white-space: normal;
          }
        }

        @media (max-width: 520px) {
          .by-metrics-grid {
            grid-template-columns: 1fr;
          }

          .by-hero-title {
            font-size: 21px;
          }

          .by-section-title {
            font-size: 18px;
          }

          .by-hero-text,
          .by-section-text,
          .by-metric-hint,
          .by-quick-description {
            font-size: 12px;
          }

          .by-primary-btn,
          .by-secondary-btn {
            width: 100%;
          }

          .by-mobile-sale-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </>
  );
}