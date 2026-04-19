import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useCallback, useEffect, useMemo, useState } from "react";
import ByproductsService from "../../../services/byproducts";

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

function formatDateTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatNumber(value) {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return "0";
  return new Intl.NumberFormat().format(n);
}

function formatCurrency(value, currency = "TZS") {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return `${currency} 0.00`;

  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `${currency} ${n.toFixed(2)}`;
  }
}

function coerceObject(response) {
  if (!response) return null;
  if (response?.data && typeof response.data === "object" && !Array.isArray(response.data)) {
    return response.data;
  }
  if (response?.item && typeof response.item === "object") return response.item;
  if (typeof response === "object" && !Array.isArray(response)) return response;
  return null;
}

function getSaleNumber(sale) {
  return sale?.sale_number || sale?.reference || sale?.code || "—";
}

function getSaleStatus(sale) {
  return sale?.status || sale?.sale_status || sale?.status_value || "draft";
}

function getSaleCurrency(sale) {
  return sale?.currency || sale?.currency_code || "TZS";
}

function getSaleCustomerName(sale) {
  return (
    sale?.customer_name_snapshot ||
    sale?.customer_name ||
    sale?.transaction_name_snapshot ||
    sale?.transaction_name ||
    sale?.customer?.customer_name ||
    sale?.customer?.transaction_name ||
    sale?.customer?.name ||
    "Walk-in / Unspecified"
  );
}

function getSalePhone(sale) {
  return (
    sale?.customer_phone_snapshot ||
    sale?.customer_phone ||
    sale?.customer?.phone ||
    sale?.customer?.phone_number ||
    "—"
  );
}

function getSaleLocation(sale) {
  return (
    sale?.customer_location_snapshot ||
    sale?.customer_location ||
    sale?.customer?.location ||
    sale?.customer?.address ||
    "—"
  );
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

function getSalePaid(sale) {
  return (
    sale?.amount_paid ??
    sale?.paid_amount ??
    sale?.payment_amount ??
    0
  );
}

function getSaleBalance(sale) {
  const explicit =
    sale?.balance_due ??
    sale?.outstanding_amount ??
    sale?.balance_amount;

  if (explicit !== undefined && explicit !== null) return explicit;

  return Number(getSaleTotal(sale) || 0) - Number(getSalePaid(sale) || 0);
}

function getSaleNotes(sale) {
  return sale?.notes || sale?.remark || sale?.remarks || sale?.description || "";
}

function getSaleDate(sale) {
  return sale?.sale_date || sale?.date || sale?.created_at;
}

function getLineItems(sale) {
  const candidates = [
    sale?.items,
    sale?.sale_items,
    sale?.lines,
    sale?.sale_lines,
    sale?.entries,
    sale?.details,
  ];

  const list = candidates.find((entry) => Array.isArray(entry));
  return Array.isArray(list) ? list : [];
}

function getItemName(item) {
  return (
    item?.item_name_snapshot ||
    item?.item_name ||
    item?.product_name ||
    item?.name ||
    item?.byproduct_item?.name ||
    item?.item?.name ||
    "Unnamed item"
  );
}

function getItemCategory(item) {
  return (
    item?.category_name_snapshot ||
    item?.category_name ||
    item?.byproduct_category?.name ||
    item?.category?.name ||
    item?.item?.category?.name ||
    "—"
  );
}

function getItemUnit(item) {
  return item?.unit || item?.uom || item?.unit_name || "—";
}

function getItemQty(item) {
  return item?.quantity ?? item?.qty ?? item?.units ?? 0;
}

function getItemUnitPrice(item) {
  return item?.unit_price ?? item?.price ?? item?.rate ?? 0;
}

function getItemLineTotal(item) {
  return (
    item?.line_total ??
    item?.total_amount ??
    item?.amount ??
    Number(getItemQty(item) || 0) * Number(getItemUnitPrice(item) || 0)
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
    <span className="bp-status-pill" style={styles}>
      {text.replace(/_/g, " ")}
    </span>
  );
}

async function fetchSaleById(id) {
  const methodNames = [
    "getSale",
    "getSaleById",
    "readSale",
    "retrieveSale",
    "fetchSale",
    "saleDetails",
    "getSaleDetails",
  ];

  let lastError = null;

  for (const methodName of methodNames) {
    const fn = ByproductsService?.[methodName];
    if (typeof fn !== "function") continue;

    try {
      const response = await fn.call(ByproductsService, id);
      const data = coerceObject(response);

      if (data) return data;
    } catch (err) {
      lastError = err;
    }
  }

  if (typeof ByproductsService?.listSales === "function") {
    try {
      const response = await ByproductsService.listSales({
        skip: 0,
        limit: 100,
        search: id,
      });

      const list =
        response?.items ||
        response?.data?.items ||
        response?.data ||
        (Array.isArray(response) ? response : []);

      const found = Array.isArray(list)
        ? list.find((entry) => String(entry?.id) === String(id))
        : null;

      if (found) return found;
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error("Sale not found.");
}

export default function ByproductSaleDetailsPage() {
  const router = useRouter();
  const { id } = router.query;

  const [sale, setSale] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadSale = useCallback(async () => {
    if (!router.isReady || !id) return;

    setLoading(true);
    setError("");

    try {
      const response = await fetchSaleById(id);
      setSale(response || null);
    } catch (err) {
      setSale(null);
      setError(err?.message || "Failed to load sale details.");
    } finally {
      setLoading(false);
    }
  }, [router.isReady, id]);

  useEffect(() => {
    loadSale();
  }, [loadSale]);

  const currency = useMemo(() => getSaleCurrency(sale), [sale]);
  const items = useMemo(() => getLineItems(sale), [sale]);

  return (
    <>
      <Head>
        <title>
          {sale ? `${getSaleNumber(sale)} | Byproducts Sale` : "Byproducts Sale"}
        </title>
      </Head>

      <div className="bp-page">
        <div className="bp-container">
          <section className="bp-hero">
            <div className="bp-hero-top">
              <div className="bp-hero-copy">
                <div className="bp-chip">Byproducts Sale Details</div>

                <h1 className="bp-title">
                  {loading ? "Loading sale..." : getSaleNumber(sale)}
                </h1>

                <p className="bp-subtitle">
                  Review sale information, customer details, payment summary,
                  and line items.
                </p>
              </div>

              <div className="bp-hero-actions">
                <Link href="/byproducts/sales" className="bp-secondary-btn">
                  Back to Sales
                </Link>

                <button
                  type="button"
                  onClick={loadSale}
                  disabled={loading}
                  className="bp-primary-btn"
                >
                  {loading ? "Refreshing..." : "Refresh"}
                </button>
              </div>
            </div>

            {error ? <div className="bp-error">{error}</div> : null}
          </section>

          {!loading && !error && !sale ? (
            <section className="bp-panel">
              <div className="bp-empty">Sale not found.</div>
            </section>
          ) : null}

          {loading ? (
            <section className="bp-panel">
              <div className="bp-empty">Loading sale details...</div>
            </section>
          ) : null}

          {!loading && sale ? (
            <>
              <section className="bp-stats-grid">
                <div className="bp-stat-card">
                  <div className="bp-stat-label">Sale Number</div>
                  <div className="bp-stat-value">{getSaleNumber(sale)}</div>
                  <div className="bp-stat-note">Reference for this record</div>
                </div>

                <div className="bp-stat-card">
                  <div className="bp-stat-label">Sale Date</div>
                  <div className="bp-stat-value">{formatDate(getSaleDate(sale))}</div>
                  <div className="bp-stat-note">Recorded sale date</div>
                </div>

                <div className="bp-stat-card">
                  <div className="bp-stat-label">Status</div>
                  <div className="bp-stat-value">
                    <StatusPill value={getSaleStatus(sale)} />
                  </div>
                  <div className="bp-stat-note">Current payment state</div>
                </div>

                <div className="bp-stat-card">
                  <div className="bp-stat-label">Customer</div>
                  <div className="bp-stat-value bp-stat-value-text">
                    {getSaleCustomerName(sale)}
                  </div>
                  <div className="bp-stat-note">Buyer linked to this sale</div>
                </div>

                <div className="bp-stat-card">
                  <div className="bp-stat-label">Total Amount</div>
                  <div className="bp-stat-value">
                    {formatCurrency(getSaleTotal(sale), currency)}
                  </div>
                  <div className="bp-stat-note">Grand total</div>
                </div>

                <div className="bp-stat-card">
                  <div className="bp-stat-label">Balance Due</div>
                  <div
                    className="bp-stat-value"
                    style={{
                      color: Number(getSaleBalance(sale) || 0) > 0 ? RED : GREEN,
                    }}
                  >
                    {formatCurrency(getSaleBalance(sale), currency)}
                  </div>
                  <div className="bp-stat-note">Outstanding balance</div>
                </div>
              </section>

              <div className="bp-two-col">
                <section className="bp-panel">
                  <div className="bp-section-head">
                    <h2 className="bp-section-title">Basic Information</h2>
                  </div>

                  <div className="bp-info-grid">
                    <div className="bp-info-item">
                      <div className="bp-info-label">Sale ID</div>
                      <div className="bp-info-value">{sale?.id || "—"}</div>
                    </div>

                    <div className="bp-info-item">
                      <div className="bp-info-label">Sale Number</div>
                      <div className="bp-info-value">{getSaleNumber(sale)}</div>
                    </div>

                    <div className="bp-info-item">
                      <div className="bp-info-label">Sale Date</div>
                      <div className="bp-info-value">
                        {formatDate(getSaleDate(sale))}
                      </div>
                    </div>

                    <div className="bp-info-item">
                      <div className="bp-info-label">Status</div>
                      <div className="bp-info-value">
                        <StatusPill value={getSaleStatus(sale)} />
                      </div>
                    </div>

                    <div className="bp-info-item">
                      <div className="bp-info-label">Created At</div>
                      <div className="bp-info-value">
                        {formatDateTime(sale?.created_at)}
                      </div>
                    </div>

                    <div className="bp-info-item">
                      <div className="bp-info-label">Updated At</div>
                      <div className="bp-info-value">
                        {formatDateTime(sale?.updated_at)}
                      </div>
                    </div>
                  </div>
                </section>

                <section className="bp-panel">
                  <div className="bp-section-head">
                    <h2 className="bp-section-title">Customer & Payment</h2>
                  </div>

                  <div className="bp-info-grid">
                    <div className="bp-info-item">
                      <div className="bp-info-label">Customer Name</div>
                      <div className="bp-info-value">
                        {getSaleCustomerName(sale)}
                      </div>
                    </div>

                    <div className="bp-info-item">
                      <div className="bp-info-label">Phone</div>
                      <div className="bp-info-value">{getSalePhone(sale)}</div>
                    </div>

                    <div className="bp-info-item">
                      <div className="bp-info-label">Location</div>
                      <div className="bp-info-value">{getSaleLocation(sale)}</div>
                    </div>

                    <div className="bp-info-item">
                      <div className="bp-info-label">Currency</div>
                      <div className="bp-info-value">{currency}</div>
                    </div>

                    <div className="bp-info-item">
                      <div className="bp-info-label">Paid Amount</div>
                      <div className="bp-info-value">
                        {formatCurrency(getSalePaid(sale), currency)}
                      </div>
                    </div>

                    <div className="bp-info-item">
                      <div className="bp-info-label">Balance Due</div>
                      <div
                        className="bp-info-value"
                        style={{
                          color: Number(getSaleBalance(sale) || 0) > 0 ? RED : GREEN,
                        }}
                      >
                        {formatCurrency(getSaleBalance(sale), currency)}
                      </div>
                    </div>
                  </div>
                </section>
              </div>

              <section className="bp-panel">
                <div className="bp-section-head">
                  <div>
                    <h2 className="bp-section-title">Sale Items</h2>
                    <p className="bp-section-text">
                      {formatNumber(items.length)} item{items.length === 1 ? "" : "s"} in this sale.
                    </p>
                  </div>
                </div>

                <div className="bp-desktop-table-wrap">
                  <table className="bp-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Item</th>
                        <th>Category</th>
                        <th>Unit</th>
                        <th>Qty</th>
                        <th>Unit Price</th>
                        <th>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="bp-empty-cell">
                            No sale items found.
                          </td>
                        </tr>
                      ) : (
                        items.map((item, index) => (
                          <tr key={item?.id || `${getItemName(item)}-${index}`}>
                            <td>{index + 1}</td>
                            <td className="bp-strong">{getItemName(item)}</td>
                            <td>{getItemCategory(item)}</td>
                            <td>{getItemUnit(item)}</td>
                            <td>{formatNumber(getItemQty(item))}</td>
                            <td className="bp-nowrap">
                              {formatCurrency(getItemUnitPrice(item), currency)}
                            </td>
                            <td className="bp-strong bp-nowrap">
                              {formatCurrency(getItemLineTotal(item), currency)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="bp-mobile-list">
                  {items.length === 0 ? (
                    <div className="bp-empty">No sale items found.</div>
                  ) : (
                    items.map((item, index) => (
                      <div
                        key={item?.id || `${getItemName(item)}-${index}`}
                        className="bp-mobile-card"
                      >
                        <div className="bp-mobile-card-top">
                          <div className="bp-mobile-card-title">
                            {index + 1}. {getItemName(item)}
                          </div>
                          <div className="bp-mobile-card-total">
                            {formatCurrency(getItemLineTotal(item), currency)}
                          </div>
                        </div>

                        <div className="bp-mobile-grid">
                          <div className="bp-mobile-row">
                            <span className="bp-mobile-label">Category</span>
                            <span className="bp-mobile-value">
                              {getItemCategory(item)}
                            </span>
                          </div>

                          <div className="bp-mobile-row">
                            <span className="bp-mobile-label">Unit</span>
                            <span className="bp-mobile-value">
                              {getItemUnit(item)}
                            </span>
                          </div>

                          <div className="bp-mobile-row">
                            <span className="bp-mobile-label">Qty</span>
                            <span className="bp-mobile-value">
                              {formatNumber(getItemQty(item))}
                            </span>
                          </div>

                          <div className="bp-mobile-row">
                            <span className="bp-mobile-label">Unit Price</span>
                            <span className="bp-mobile-value">
                              {formatCurrency(getItemUnitPrice(item), currency)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>

              <section className="bp-panel">
                <div className="bp-section-head">
                  <h2 className="bp-section-title">Notes</h2>
                </div>

                <div className="bp-notes-box">
                  {getSaleNotes(sale) || "No notes available."}
                </div>
              </section>
            </>
          ) : null}
        </div>
      </div>

      <style jsx global>{`
        .bp-page {
          min-height: 100vh;
          background: ${PAGE_BG};
          padding: 18px 14px 36px;
          font-family: Arial, sans-serif;
        }

        .bp-container {
          max-width: 1320px;
          margin: 0 auto;
          display: grid;
          gap: 18px;
        }

        .bp-hero,
        .bp-panel,
        .bp-stat-card,
        .bp-mobile-card {
          background: ${SURFACE};
          border: 1px solid ${BORDER};
          box-shadow: ${SHADOW};
          box-sizing: border-box;
        }

        .bp-hero {
          border-radius: 24px;
          padding: 20px;
          background: linear-gradient(
            135deg,
            rgba(255, 122, 0, 0.1) 0%,
            rgba(37, 99, 235, 0.08) 100%
          );
        }

        .bp-hero-top {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          flex-wrap: wrap;
        }

        .bp-hero-copy {
          min-width: 0;
          flex: 1;
        }

        .bp-chip {
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

        .bp-title {
          margin: 0;
          color: ${TEXT};
          font-size: 30px;
          line-height: 1.15;
          font-weight: 800;
          word-break: break-word;
        }

        .bp-subtitle {
          margin: 10px 0 0;
          color: ${MUTED};
          font-size: 14px;
          line-height: 1.7;
          max-width: 760px;
        }

        .bp-hero-actions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          align-items: center;
        }

        .bp-primary-btn,
        .bp-secondary-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 44px;
          padding: 0 16px;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 800;
          text-decoration: none !important;
          box-sizing: border-box;
        }

        .bp-primary-btn {
          background: ${ORANGE};
          color: #ffffff !important;
          border: none;
          cursor: pointer;
          box-shadow: 0 8px 20px rgba(255, 122, 0, 0.18);
        }

        .bp-primary-btn:disabled {
          cursor: not-allowed;
          opacity: 0.7;
        }

        .bp-secondary-btn {
          background: ${SURFACE};
          color: ${TEXT} !important;
          border: 1px solid ${BORDER};
        }

        .bp-error {
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

        .bp-stats-grid {
          display: grid;
          grid-template-columns: repeat(6, minmax(0, 1fr));
          gap: 16px;
        }

        .bp-stat-card {
          border-radius: 20px;
          padding: 18px;
          min-width: 0;
        }

        .bp-stat-label {
          color: ${MUTED};
          font-size: 13px;
          font-weight: 700;
          margin-bottom: 8px;
        }

        .bp-stat-value {
          color: ${TEXT};
          font-size: 22px;
          line-height: 1.2;
          font-weight: 800;
          margin-bottom: 8px;
          word-break: break-word;
        }

        .bp-stat-value-text {
          font-size: 18px;
        }

        .bp-stat-note {
          color: ${MUTED};
          font-size: 12px;
          line-height: 1.5;
        }

        .bp-two-col {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 18px;
        }

        .bp-panel {
          border-radius: 22px;
          padding: 18px;
          overflow: hidden;
        }

        .bp-section-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 14px;
          flex-wrap: wrap;
          margin-bottom: 16px;
        }

        .bp-section-title {
          margin: 0;
          color: ${TEXT};
          font-size: 20px;
          font-weight: 800;
          word-break: break-word;
        }

        .bp-section-text {
          margin: 6px 0 0;
          color: ${MUTED};
          font-size: 13px;
          line-height: 1.6;
        }

        .bp-info-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
        }

        .bp-info-item {
          border: 1px solid ${BORDER};
          border-radius: 16px;
          padding: 14px;
          background: #fff;
          min-width: 0;
        }

        .bp-info-label {
          color: ${MUTED};
          font-size: 12px;
          font-weight: 700;
          margin-bottom: 8px;
        }

        .bp-info-value {
          color: ${TEXT};
          font-size: 14px;
          line-height: 1.6;
          font-weight: 700;
          word-break: break-word;
        }

        .bp-desktop-table-wrap {
          display: block;
          overflow-x: auto;
          border: 1px solid ${BORDER};
          border-radius: 16px;
        }

        .bp-table {
          width: 100%;
          border-collapse: collapse;
          min-width: 860px;
          background: #fff;
        }

        .bp-table thead tr {
          background: #f8fafc;
        }

        .bp-table th {
          text-align: left;
          padding: 13px 14px;
          border-bottom: 1px solid ${BORDER};
          color: ${TEXT};
          font-size: 13px;
          font-weight: 800;
          white-space: nowrap;
        }

        .bp-table td {
          padding: 13px 14px;
          border-bottom: 1px solid ${BORDER};
          color: ${TEXT};
          font-size: 13px;
          vertical-align: middle;
        }

        .bp-table tbody tr:last-child td {
          border-bottom: none;
        }

        .bp-empty-cell,
        .bp-empty {
          padding: 24px 14px;
          text-align: center;
          color: ${MUTED};
          font-size: 14px;
        }

        .bp-empty {
          border: 1px dashed ${BORDER};
          border-radius: 16px;
          background: #fff;
        }

        .bp-strong {
          font-weight: 700;
        }

        .bp-nowrap {
          white-space: nowrap;
        }

        .bp-status-pill {
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

        .bp-mobile-list {
          display: none;
        }

        .bp-mobile-card {
          border-radius: 18px;
          padding: 14px;
        }

        .bp-mobile-card-top {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 12px;
        }

        .bp-mobile-card-title {
          color: ${TEXT};
          font-size: 15px;
          font-weight: 800;
          line-height: 1.5;
          word-break: break-word;
        }

        .bp-mobile-card-total {
          color: ${ORANGE_DEEP};
          font-size: 13px;
          font-weight: 800;
          white-space: nowrap;
        }

        .bp-mobile-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }

        .bp-mobile-row {
          background: #f8fafc;
          border: 1px solid ${BORDER};
          border-radius: 14px;
          padding: 10px 12px;
          min-width: 0;
        }

        .bp-mobile-label {
          display: block;
          color: ${MUTED};
          font-size: 11px;
          font-weight: 700;
          margin-bottom: 6px;
        }

        .bp-mobile-value {
          display: block;
          color: ${TEXT};
          font-size: 13px;
          line-height: 1.5;
          word-break: break-word;
        }

        .bp-notes-box {
          border: 1px solid ${BORDER};
          border-radius: 16px;
          background: #fff;
          padding: 14px;
          color: ${TEXT};
          font-size: 14px;
          line-height: 1.8;
          white-space: pre-wrap;
          word-break: break-word;
        }

        @media (max-width: 1180px) {
          .bp-stats-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }

        @media (max-width: 860px) {
          .bp-page {
            padding: 14px 10px 28px;
          }

          .bp-hero,
          .bp-panel {
            border-radius: 18px;
            padding: 14px;
          }

          .bp-title {
            font-size: 24px;
          }

          .bp-hero-actions {
            width: 100%;
          }

          .bp-primary-btn,
          .bp-secondary-btn {
            flex: 1 1 160px;
          }

          .bp-stats-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 12px;
          }

          .bp-two-col {
            grid-template-columns: 1fr;
          }

          .bp-info-grid {
            grid-template-columns: 1fr;
          }

          .bp-desktop-table-wrap {
            display: none;
          }

          .bp-mobile-list {
            display: grid;
            gap: 12px;
          }
        }

        @media (max-width: 520px) {
          .bp-stats-grid {
            grid-template-columns: 1fr;
          }

          .bp-title {
            font-size: 21px;
          }

          .bp-section-title {
            font-size: 18px;
          }

          .bp-subtitle,
          .bp-section-text,
          .bp-stat-note {
            font-size: 12px;
          }

          .bp-primary-btn,
          .bp-secondary-btn {
            width: 100%;
          }

          .bp-mobile-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </>
  );
}