import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";

import OrderService from "../../services/orders";
import { getToken } from "../../services/auth";

const FONT_FAMILY = "Arial, sans-serif";

const BG = "#ffffff";
const SURFACE = "#ffffff";
const TEXT = "#0f172a";
const MUTED = "#64748b";
const BORDER = "#e5e7eb";
const SOFT = "#f8fafc";

const BLUE = "#2563eb";
const BLUE_SOFT = "rgba(37, 99, 235, 0.08)";

const GREEN = "#16a34a";
const GREEN_SOFT = "rgba(22, 163, 74, 0.10)";

const ORANGE = "#f97316";
const ORANGE_SOFT = "rgba(249, 115, 22, 0.10)";

const RED = "#dc2626";
const RED_SOFT = "rgba(220, 38, 38, 0.10)";

const SHADOW = "0 10px 30px rgba(15, 23, 42, 0.05)";

const MODE_GENERAL = "general";
const MODE_FROZEN = "frozen_container";

const GENERAL_TYPE_TABS = [
  { value: "local", label: "Local" },
  { value: "chilled", label: "Chilled" },
  { value: "frozen", label: "Frozen" },
];

const ORDER_STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "draft", label: "Draft" },
  { value: "confirmed", label: "Confirmed" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

function createDefaultFilters() {
  return {
    search: "",
    status: "",
    report_month: "",
    report_year: "",
    jurisdiction: "",
  };
}

function isNonEmpty(value) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function toSafeString(value) {
  return value === undefined || value === null ? "" : String(value);
}

function titleizeSlug(value) {
  if (!value) return "—";
  return String(value)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
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

function formatMoney(value) {
  const num = Number(value || 0);
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(num) ? num : 0);
}

function formatNumber(value, maximumFractionDigits = 0) {
  const num = Number(value || 0);
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  }).format(Number.isFinite(num) ? num : 0);
}

function compactSummary(order) {
  const parts = [];
  if (order?.product_summary) parts.push(order.product_summary);
  if (order?.order_ratio) parts.push(order.order_ratio);
  if (order?.jurisdiction) parts.push(order.jurisdiction);
  return parts.join(" • ") || "—";
}

function statusPillStyle(status) {
  const normalized = String(status || "").toLowerCase();

  if (normalized === "completed") {
    return {
      color: GREEN,
      background: GREEN_SOFT,
      border: "1px solid rgba(22,163,74,0.18)",
    };
  }

  if (normalized === "confirmed" || normalized === "in_progress") {
    return {
      color: BLUE,
      background: BLUE_SOFT,
      border: "1px solid rgba(37,99,235,0.18)",
    };
  }

  if (normalized === "cancelled") {
    return {
      color: RED,
      background: RED_SOFT,
      border: "1px solid rgba(220,38,38,0.18)",
    };
  }

  return {
    color: ORANGE,
    background: ORANGE_SOFT,
    border: "1px solid rgba(249,115,22,0.18)",
  };
}

function buildRequestFilters(mode, generalType, filters, page, pageSize) {
  const payload = {
    page,
    page_size: pageSize,
  };

  if (mode === MODE_GENERAL) {
    payload.order_type = generalType;
  } else {
    payload.order_profile = "frozen_container";
  }

  if (isNonEmpty(filters.search)) payload.search = filters.search.trim();
  if (isNonEmpty(filters.status)) payload.status = filters.status.trim();

  const month = toSafeString(filters.report_month).trim();
  const year = toSafeString(filters.report_year).trim();

  if (month && year) {
    payload.report_month = month;
    payload.report_year = year;
  }

  if (mode === MODE_FROZEN && isNonEmpty(filters.jurisdiction)) {
    payload.jurisdiction = filters.jurisdiction.trim();
  }

  return payload;
}

function Input({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  min,
  max,
}) {
  return (
    <label className="field">
      <span className="fieldLabel">{label}</span>
      <input
        type={type}
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="fieldControl"
      />
    </label>
  );
}

function Select({ label, value, onChange, options }) {
  return (
    <label className="field">
      <span className="fieldLabel">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="fieldControl"
      >
        {options.map((option) => (
          <option key={`${label}-${option.value}`} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function SummaryCard({ label, value, hint }) {
  return (
    <div className="summaryCard">
      <div className="summaryLabel">{label}</div>
      <div className="summaryValue">{value}</div>
      <div className="summaryHint">{hint}</div>
    </div>
  );
}

function ModeButton({ active, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`tabButton ${active ? "tabButtonActive" : ""}`}
    >
      {children}
    </button>
  );
}

function SubTypeButton({ active, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`subTabButton ${active ? "subTabButtonActive" : ""}`}
    >
      {children}
    </button>
  );
}

function HeaderCell({ children, width }) {
  return (
    <th style={{ width }} className="tableHeaderCell">
      {children}
    </th>
  );
}

function BodyCell({ children }) {
  return <td className="tableBodyCell">{children}</td>;
}

function LoadingRows() {
  return (
    <div className="loadingRows">
      {Array.from({ length: 7 }).map((_, index) => (
        <div key={index} className="loadingRow" />
      ))}
    </div>
  );
}

function MobileMetaItem({ label, value, fullWidth = false, valueStyle }) {
  return (
    <div className={`mobileMetaItem ${fullWidth ? "mobileMetaItemFull" : ""}`}>
      <div className="mobileMetaLabel">{label}</div>
      <div className="mobileMetaValue" style={valueStyle}>
        {value}
      </div>
    </div>
  );
}

function MobileOrderCard({ order }) {
  return (
    <article className="mobileOrderCard">
      <div className="mobileCardTop">
        <div className="mobileCardIdentity">
          <div className="mobileOrderNumber">{order.order_number || "—"}</div>
          <div className="mobileOrderId">ID: {order.id}</div>
          <div className="mobileEnterprise">{order.enterprise_name || "—"}</div>
        </div>

        <span
          className="statusPill"
          style={{
            ...statusPillStyle(order.status),
          }}
        >
          {titleizeSlug(order.status)}
        </span>
      </div>

      <div className="mobileMetaGrid">
        <MobileMetaItem label="Type" value={titleizeSlug(order.order_type)} />
        <MobileMetaItem
          label="Profile"
          value={titleizeSlug(order.order_profile)}
        />
        <MobileMetaItem
          label="Subtype"
          value={titleizeSlug(order.order_subtype)}
        />
        <MobileMetaItem
          label="Quantity"
          value={`${formatNumber(order.total_quantity_kg, 2)} kg`}
        />
        <MobileMetaItem
          label="Animals"
          value={formatNumber(order.total_animals_required)}
        />
        <MobileMetaItem
          label="Shipment"
          value={formatMoney(order.shipment_value_usd)}
        />
        <MobileMetaItem
          label="Paid"
          value={formatMoney(order.amount_paid_usd)}
        />
        <MobileMetaItem
          label="Balance"
          value={formatMoney(order.balance_usd)}
          valueStyle={{
            color: Number(order.balance_usd || 0) > 0 ? ORANGE : TEXT,
          }}
        />
        <MobileMetaItem
          label="Slaughter"
          value={formatDate(order.slaughter_schedule)}
        />
        <MobileMetaItem
          label="Delivery"
          value={formatDate(order.expected_delivery)}
        />
        <MobileMetaItem
          label="Updated"
          value={formatDateTime(order.updated_at)}
          fullWidth
        />
        <MobileMetaItem
          label="Summary"
          value={compactSummary(order)}
          fullWidth
        />
      </div>

      <div className="mobileCardFooter">
        <Link href={`/orders/${order.id}`} className="viewLink">
          View order
        </Link>
      </div>
    </article>
  );
}

export default function OrdersIndexPage() {
  const router = useRouter();
  const fetchCounterRef = useRef(0);

  const [authReady, setAuthReady] = useState(false);

  const [mode, setMode] = useState(MODE_GENERAL);
  const [generalType, setGeneralType] = useState("local");

  const [draftFilters, setDraftFilters] = useState(createDefaultFilters);
  const [appliedFilters, setAppliedFilters] = useState(createDefaultFilters);

  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = typeof window !== "undefined" ? getToken?.() : null;
    if (!token) {
      router.replace("/auth/login");
      return;
    }
    setAuthReady(true);
  }, [router]);

  const requestFilters = useMemo(() => {
    return buildRequestFilters(mode, generalType, appliedFilters, page, pageSize);
  }, [mode, generalType, appliedFilters, page, pageSize]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const summary = useMemo(() => {
    const totalQuantity = items.reduce(
      (sum, order) => sum + Number(order?.total_quantity_kg || 0),
      0
    );
    const totalAnimals = items.reduce(
      (sum, order) => sum + Number(order?.total_animals_required || 0),
      0
    );
    const totalShipment = items.reduce(
      (sum, order) => sum + Number(order?.shipment_value_usd || 0),
      0
    );
    const totalPaid = items.reduce(
      (sum, order) => sum + Number(order?.amount_paid_usd || 0),
      0
    );
    const totalBalance = items.reduce(
      (sum, order) => sum + Number(order?.balance_usd || 0),
      0
    );

    return {
      totalQuantity,
      totalAnimals,
      totalShipment,
      totalPaid,
      totalBalance,
    };
  }, [items]);

  const fetchOrders = useCallback(
    async (isRefresh = false) => {
      const fetchId = ++fetchCounterRef.current;

      try {
        setError("");
        if (isRefresh) setRefreshing(true);
        else setLoading(true);

        const response = await OrderService.list(requestFilters);

        if (fetchId !== fetchCounterRef.current) return;

        setItems(Array.isArray(response?.items) ? response.items : []);
        setTotal(Number(response?.total || 0));
      } catch (err) {
        if (fetchId !== fetchCounterRef.current) return;

        setItems([]);
        setTotal(0);
        setError(err?.message || "Failed to load orders.");
      } finally {
        if (fetchId !== fetchCounterRef.current) return;
        setLoading(false);
        setRefreshing(false);
      }
    },
    [requestFilters]
  );

  useEffect(() => {
    if (!authReady) return;
    fetchOrders();
  }, [authReady, fetchOrders]);

  const handleModeChange = (nextMode) => {
    if (nextMode === mode) return;

    setMode(nextMode);
    setPage(1);
    setError("");
    setItems([]);
    setTotal(0);

    const resetFilters = createDefaultFilters();
    setDraftFilters(resetFilters);
    setAppliedFilters(resetFilters);
  };

  const handleGeneralTypeChange = (nextType) => {
    if (nextType === generalType) return;
    setGeneralType(nextType);
    setPage(1);
    setError("");
    setItems([]);
    setTotal(0);
  };

  const handleDraftChange = (key, value) => {
    setDraftFilters((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleApplyFilters = (e) => {
    e.preventDefault();

    const nextFilters = { ...draftFilters };
    const month = toSafeString(nextFilters.report_month).trim();
    const year = toSafeString(nextFilters.report_year).trim();

    if ((month && !year) || (!month && year)) {
      setError("Report month and report year must be provided together.");
      return;
    }

    setError("");
    setAppliedFilters(nextFilters);
    setPage(1);
  };

  const handleClearFilters = () => {
    const cleared = createDefaultFilters();
    setDraftFilters(cleared);
    setAppliedFilters(cleared);
    setPage(1);
    setError("");
  };

  const handleRefresh = () => {
    fetchOrders(true);
  };

  const handleChangePage = (nextPage) => {
    if (nextPage < 1 || nextPage > totalPages) return;
    setPage(nextPage);
  };

  const handleChangePageSize = (value) => {
    const nextSize = Number(value) || 10;
    setPageSize(nextSize);
    setPage(1);
  };

  if (!authReady) {
    return (
      <div className="pageShell">
        <div className="pageContainer">
          <LoadingRows />
        </div>

        <style jsx>{baseStyles}</style>
      </div>
    );
  }

  return (
    <div className="pageShell">
      <div className="pageContainer">
        {error ? <div className="errorBanner">{error}</div> : null}

        <div className="headerRow">
          <div className="headerText">
            <h1 className="pageTitle">Orders</h1>
            <p className="pageSubtitle">
              View order records by General Orders or Frozen Containers.
            </p>
          </div>

          <div className="headerActions">
            <Link href="/orders/create" className="primaryButton">
              Create Order
            </Link>

            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing || loading}
              className="secondaryButton"
            >
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>

        <div className="tabRow">
          <ModeButton
            active={mode === MODE_GENERAL}
            onClick={() => handleModeChange(MODE_GENERAL)}
          >
            General Orders
          </ModeButton>

          <ModeButton
            active={mode === MODE_FROZEN}
            onClick={() => handleModeChange(MODE_FROZEN)}
          >
            Frozen Containers
          </ModeButton>
        </div>

        {mode === MODE_GENERAL ? (
          <div className="subTabRow">
            {GENERAL_TYPE_TABS.map((tab) => (
              <SubTypeButton
                key={tab.value}
                active={generalType === tab.value}
                onClick={() => handleGeneralTypeChange(tab.value)}
              >
                {tab.label}
              </SubTypeButton>
            ))}
          </div>
        ) : null}

        <div className="summaryGrid">
          <SummaryCard
            label="Total records"
            value={formatNumber(total)}
            hint={
              mode === MODE_GENERAL
                ? `${titleizeSlug(generalType)} orders`
                : "Frozen container orders"
            }
          />
          <SummaryCard
            label="Qty (kg)"
            value={`${formatNumber(summary.totalQuantity, 2)} kg`}
            hint="Current page total"
          />
          <SummaryCard
            label="Shipment"
            value={formatMoney(summary.totalShipment)}
            hint="Current page total"
          />
          <SummaryCard
            label="Balance"
            value={formatMoney(summary.totalBalance)}
            hint="Current page total"
          />
        </div>

        <form onSubmit={handleApplyFilters} className="panel">
          <div className="panelHeader">
            <div>
              <div className="panelTitle">Filters</div>
              <div className="panelSubtitle">
                Report month and year must be filled together.
              </div>
            </div>

            <div className="rowsControl">
              <span className="rowsLabel">Rows per page</span>
              <select
                value={pageSize}
                onChange={(e) => handleChangePageSize(e.target.value)}
                className="fieldControl rowsSelect"
              >
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className={mode === MODE_FROZEN ? "filterGrid frozen" : "filterGrid"}>
            <Input
              label="Search"
              value={draftFilters.search}
              onChange={(v) => handleDraftChange("search", v)}
              placeholder={
                mode === MODE_GENERAL
                  ? "Order, enterprise, summary"
                  : "Order, client, ratio, jurisdiction"
              }
            />

            <Select
              label="Status"
              value={draftFilters.status}
              onChange={(v) => handleDraftChange("status", v)}
              options={ORDER_STATUS_OPTIONS}
            />

            <Input
              label="Month"
              type="number"
              min="1"
              max="12"
              value={draftFilters.report_month}
              onChange={(v) => handleDraftChange("report_month", v)}
              placeholder="1-12"
            />

            <Input
              label="Year"
              type="number"
              min="2000"
              max="2100"
              value={draftFilters.report_year}
              onChange={(v) => handleDraftChange("report_year", v)}
              placeholder="2026"
            />

            {mode === MODE_FROZEN ? (
              <Input
                label="Jurisdiction"
                value={draftFilters.jurisdiction}
                onChange={(v) => handleDraftChange("jurisdiction", v)}
                placeholder="Jurisdiction"
              />
            ) : null}
          </div>

          <div className="filterActions">
            <button type="submit" className="primaryButton buttonLike">
              Apply filters
            </button>

            <button
              type="button"
              onClick={handleClearFilters}
              className="secondaryButton buttonLike"
            >
              Clear
            </button>
          </div>
        </form>

        <div className="panel">
          <div className="panelHeader">
            <div>
              <div className="panelTitle">
                {mode === MODE_GENERAL
                  ? `${titleizeSlug(generalType)} General Orders`
                  : "Frozen Container Orders"}
              </div>
              <div className="panelSubtitle">
                {formatNumber(total)} matching records
              </div>
            </div>

            <div className="pageCounter">
              Page {formatNumber(page)} of {formatNumber(totalPages)}
            </div>
          </div>

          {loading ? (
            <LoadingRows />
          ) : items.length === 0 ? (
            <div className="emptyState">
              No orders found for the selected view and filters.
            </div>
          ) : (
            <>
              <div className="desktopTableBlock">
                <div className="tableWrap">
                  <table className="ordersTable">
                    <thead>
                      <tr>
                        <HeaderCell width={170}>Order</HeaderCell>
                        <HeaderCell width={210}>Enterprise</HeaderCell>
                        <HeaderCell width={170}>Type / Profile</HeaderCell>
                        <HeaderCell width={120}>Status</HeaderCell>
                        <HeaderCell width={320}>Summary</HeaderCell>
                        <HeaderCell width={110}>Qty (kg)</HeaderCell>
                        <HeaderCell width={110}>Animals</HeaderCell>
                        <HeaderCell width={130}>Shipment</HeaderCell>
                        <HeaderCell width={130}>Paid</HeaderCell>
                        <HeaderCell width={130}>Balance</HeaderCell>
                        <HeaderCell width={120}>Slaughter</HeaderCell>
                        <HeaderCell width={120}>Delivery</HeaderCell>
                        <HeaderCell width={165}>Updated</HeaderCell>
                        <HeaderCell width={90}>Action</HeaderCell>
                      </tr>
                    </thead>

                    <tbody>
                      {items.map((order) => (
                        <tr key={order.id} className="tableRow">
                          <BodyCell>
                            <div className="orderNumberCell">
                              {order.order_number || "—"}
                            </div>
                            <div className="mutedSmall">ID: {order.id}</div>
                          </BodyCell>

                          <BodyCell>
                            <div className="tableStrong">
                              {order.enterprise_name || "—"}
                            </div>
                          </BodyCell>

                          <BodyCell>
                            <div className="tableStrong">
                              {titleizeSlug(order.order_type)}
                            </div>
                            <div className="mutedSmall">
                              {titleizeSlug(order.order_profile)}
                            </div>
                            {order.order_subtype ? (
                              <div className="mutedSmall">
                                {titleizeSlug(order.order_subtype)}
                              </div>
                            ) : null}
                          </BodyCell>

                          <BodyCell>
                            <span
                              className="statusPill"
                              style={{
                                ...statusPillStyle(order.status),
                              }}
                            >
                              {titleizeSlug(order.status)}
                            </span>
                          </BodyCell>

                          <BodyCell>
                            <div className="summaryText">
                              {compactSummary(order)}
                            </div>
                          </BodyCell>

                          <BodyCell>
                            <div className="tableStrong">
                              {formatNumber(order.total_quantity_kg, 2)}
                            </div>
                          </BodyCell>

                          <BodyCell>
                            <div className="tableStrong">
                              {formatNumber(order.total_animals_required)}
                            </div>
                          </BodyCell>

                          <BodyCell>
                            <div className="tableStrong">
                              {formatMoney(order.shipment_value_usd)}
                            </div>
                          </BodyCell>

                          <BodyCell>
                            <div className="tableStrong">
                              {formatMoney(order.amount_paid_usd)}
                            </div>
                          </BodyCell>

                          <BodyCell>
                            <div
                              className="tableStrong"
                              style={{
                                color:
                                  Number(order.balance_usd || 0) > 0
                                    ? ORANGE
                                    : TEXT,
                              }}
                            >
                              {formatMoney(order.balance_usd)}
                            </div>
                          </BodyCell>

                          <BodyCell>
                            <div>{formatDate(order.slaughter_schedule)}</div>
                          </BodyCell>

                          <BodyCell>
                            <div>{formatDate(order.expected_delivery)}</div>
                          </BodyCell>

                          <BodyCell>
                            <div className="mutedSmall">
                              {formatDateTime(order.updated_at)}
                            </div>
                          </BodyCell>

                          <BodyCell>
                            <Link href={`/orders/${order.id}`} className="viewLink">
                              View
                            </Link>
                          </BodyCell>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="mobileCardsBlock">
                <div className="mobileCardsList">
                  {items.map((order) => (
                    <MobileOrderCard key={order.id} order={order} />
                  ))}
                </div>
              </div>

              <div className="footerBar">
                <div className="footerInfo">
                  {formatNumber(summary.totalQuantity, 2)} kg on this page •{" "}
                  {formatNumber(summary.totalAnimals)} animals •{" "}
                  {formatMoney(summary.totalShipment)} shipment
                </div>

                <div className="pager">
                  <button
                    type="button"
                    onClick={() => handleChangePage(page - 1)}
                    disabled={page <= 1}
                    className="pagerButton"
                  >
                    Previous
                  </button>

                  <button
                    type="button"
                    onClick={() => handleChangePage(page + 1)}
                    disabled={page >= totalPages}
                    className="pagerButton"
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <style jsx>{baseStyles}</style>
    </div>
  );
}

const baseStyles = `
  .pageShell {
    min-height: 100vh;
    background: ${BG};
    color: ${TEXT};
    font-family: ${FONT_FAMILY};
  }

  .pageContainer {
    width: 100%;
    max-width: 1440px;
    margin: 0 auto;
    padding: 20px 22px 32px;
    box-sizing: border-box;
    overflow-x: hidden;
  }

  .errorBanner {
    color: ${RED};
    background: ${RED_SOFT};
    border: 1px solid rgba(220, 38, 38, 0.18);
    border-radius: 14px;
    padding: 12px 14px;
    margin-bottom: 16px;
    font-size: 13px;
    line-height: 1.55;
  }

  .headerRow {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;
    flex-wrap: wrap;
    margin-bottom: 16px;
  }

  .headerText {
    min-width: 0;
    flex: 1 1 320px;
  }

  .pageTitle {
    margin: 0;
    font-size: 28px;
    line-height: 1.2;
    font-weight: 700;
    letter-spacing: -0.02em;
    color: ${TEXT};
  }

  .pageSubtitle {
    margin: 6px 0 0;
    color: ${MUTED};
    font-size: 13px;
    line-height: 1.55;
  }

  .headerActions {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    align-items: center;
  }

  .primaryButton,
  .secondaryButton,
  .tabButton,
  .subTabButton,
  .pagerButton,
  .fieldControl {
    font-family: ${FONT_FAMILY};
  }

  .primaryButton,
  .secondaryButton,
  .tabButton,
  .subTabButton,
  .pagerButton,
  .buttonLike {
    min-height: 42px;
  }

  .primaryButton {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    text-decoration: none;
    border: none;
    background: ${BLUE};
    color: #ffffff;
    border-radius: 12px;
    padding: 10px 16px;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    box-sizing: border-box;
  }

  .secondaryButton {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 1px solid ${BORDER};
    background: #ffffff;
    color: ${TEXT};
    border-radius: 12px;
    padding: 10px 16px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    box-sizing: border-box;
  }

  .secondaryButton:disabled,
  .pagerButton:disabled {
    cursor: not-allowed;
    color: #94a3b8;
    background: ${SOFT};
  }

  .tabRow,
  .subTabRow {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    margin-bottom: 16px;
  }

  .tabButton {
    border: 1px solid ${BORDER};
    background: #ffffff;
    color: ${TEXT};
    border-radius: 12px;
    padding: 10px 16px;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
  }

  .tabButtonActive {
    border-color: ${BLUE};
    background: ${BLUE_SOFT};
    color: ${BLUE};
  }

  .subTabButton {
    border: 1px solid ${BORDER};
    background: #ffffff;
    color: ${TEXT};
    border-radius: 12px;
    padding: 9px 14px;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
  }

  .subTabButtonActive {
    border-color: ${ORANGE};
    background: ${ORANGE_SOFT};
    color: ${ORANGE};
  }

  .summaryGrid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 12px;
    margin-bottom: 16px;
  }

  .summaryCard {
    border: 1px solid ${BORDER};
    border-radius: 16px;
    background: ${SURFACE};
    padding: 14px 16px;
    box-shadow: ${SHADOW};
    min-width: 0;
  }

  .summaryLabel {
    font-size: 12px;
    color: ${MUTED};
    margin-bottom: 7px;
  }

  .summaryValue {
    font-size: 22px;
    line-height: 1.15;
    font-weight: 700;
    letter-spacing: -0.02em;
    color: ${TEXT};
    word-break: break-word;
  }

  .summaryHint {
    margin-top: 4px;
    font-size: 12px;
    color: ${MUTED};
  }

  .panel {
    border: 1px solid ${BORDER};
    border-radius: 18px;
    background: ${SURFACE};
    padding: 16px;
    margin-bottom: 16px;
    box-shadow: ${SHADOW};
    overflow: hidden;
  }

  .panelHeader {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 14px;
    flex-wrap: wrap;
    margin-bottom: 14px;
  }

  .panelTitle {
    font-size: 15px;
    font-weight: 700;
    color: ${TEXT};
  }

  .panelSubtitle {
    font-size: 12px;
    color: ${MUTED};
    margin-top: 4px;
  }

  .rowsControl {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .rowsLabel {
    font-size: 12px;
    color: ${MUTED};
  }

  .rowsSelect {
    width: 96px;
  }

  .filterGrid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 12px;
  }

  .filterGrid.frozen {
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }

  .field {
    display: block;
    min-width: 0;
  }

  .fieldLabel {
    display: block;
    font-size: 12px;
    font-weight: 700;
    color: #334155;
    margin-bottom: 6px;
  }

  .fieldControl {
    width: 100%;
    height: 42px;
    border: 1px solid ${BORDER};
    border-radius: 12px;
    background: #ffffff;
    color: ${TEXT};
    padding: 0 12px;
    font-size: 13px;
    outline: none;
    box-sizing: border-box;
  }

  .filterActions {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    margin-top: 14px;
  }

  .pageCounter {
    font-size: 12px;
    color: ${MUTED};
  }

  .emptyState {
    padding: 22px 6px 6px;
    color: ${MUTED};
    font-size: 14px;
  }

  .desktopTableBlock {
    display: block;
  }

  .mobileCardsBlock {
    display: none;
  }

  .tableWrap {
    width: 100%;
    overflow-x: auto;
    overflow-y: hidden;
    -webkit-overflow-scrolling: touch;
    border-radius: 14px;
  }

  .ordersTable {
    width: 100%;
    min-width: 1540px;
    border-collapse: collapse;
    table-layout: fixed;
  }

  .tableHeaderCell {
    text-align: left;
    padding: 12px 14px;
    font-size: 12px;
    font-weight: 700;
    color: #334155;
    white-space: nowrap;
    background: ${SOFT};
    border-bottom: 1px solid ${BORDER};
  }

  .tableBodyCell {
    padding: 14px;
    vertical-align: top;
    font-size: 13px;
    color: ${TEXT};
    border-bottom: 1px solid ${BORDER};
  }

  .tableRow:last-child .tableBodyCell {
    border-bottom: 1px solid ${BORDER};
  }

  .orderNumberCell,
  .tableStrong {
    font-size: 13px;
    font-weight: 700;
    color: ${TEXT};
    line-height: 1.45;
    word-break: break-word;
  }

  .mutedSmall {
    margin-top: 4px;
    font-size: 12px;
    color: ${MUTED};
    line-height: 1.45;
    word-break: break-word;
  }

  .summaryText {
    font-size: 13px;
    line-height: 1.55;
    color: ${TEXT};
    word-break: break-word;
  }

  .statusPill {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 999px;
    padding: 6px 10px;
    font-size: 12px;
    font-weight: 700;
    text-transform: capitalize;
    white-space: nowrap;
  }

  .viewLink {
    color: ${BLUE};
    text-decoration: none;
    font-size: 13px;
    font-weight: 700;
  }

  .mobileCardsList {
    display: grid;
    gap: 12px;
  }

  .mobileOrderCard {
    border: 1px solid ${BORDER};
    border-radius: 16px;
    background: #ffffff;
    padding: 14px;
  }

  .mobileCardTop {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 10px;
    flex-wrap: wrap;
  }

  .mobileCardIdentity {
    min-width: 0;
    flex: 1 1 220px;
  }

  .mobileOrderNumber {
    font-size: 15px;
    font-weight: 700;
    line-height: 1.35;
    color: ${TEXT};
    word-break: break-word;
  }

  .mobileOrderId {
    margin-top: 3px;
    font-size: 12px;
    color: ${MUTED};
    word-break: break-word;
  }

  .mobileEnterprise {
    margin-top: 6px;
    font-size: 14px;
    font-weight: 600;
    line-height: 1.45;
    color: ${TEXT};
    word-break: break-word;
  }

  .mobileMetaGrid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
    margin-top: 14px;
  }

  .mobileMetaItem {
    min-width: 0;
  }

  .mobileMetaItemFull {
    grid-column: 1 / -1;
  }

  .mobileMetaLabel {
    font-size: 11px;
    font-weight: 700;
    color: ${MUTED};
    margin-bottom: 4px;
    text-transform: uppercase;
    letter-spacing: 0.02em;
  }

  .mobileMetaValue {
    font-size: 13px;
    line-height: 1.5;
    color: ${TEXT};
    font-weight: 600;
    word-break: break-word;
  }

  .mobileCardFooter {
    margin-top: 14px;
    padding-top: 12px;
    border-top: 1px solid ${BORDER};
    display: flex;
    justify-content: flex-start;
    align-items: center;
  }

  .footerBar {
    padding-top: 16px;
    margin-top: 16px;
    border-top: 1px solid ${BORDER};
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }

  .footerInfo {
    font-size: 12px;
    color: ${MUTED};
    line-height: 1.5;
  }

  .pager {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .pagerButton {
    border: 1px solid ${BORDER};
    background: #ffffff;
    color: ${TEXT};
    border-radius: 12px;
    padding: 9px 14px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
  }

  .loadingRows {
    display: grid;
    gap: 10px;
  }

  .loadingRow {
    height: 52px;
    border-radius: 12px;
    background: ${SOFT};
    border: 1px solid ${BORDER};
  }

  @media (max-width: 1200px) {
    .summaryGrid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .filterGrid,
    .filterGrid.frozen {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 1024px) {
    .desktopTableBlock {
      display: none;
    }

    .mobileCardsBlock {
      display: block;
    }
  }

  @media (max-width: 640px) {
    .pageContainer {
      padding: 14px 12px 24px;
    }

    .pageTitle {
      font-size: 24px;
    }

    .headerActions {
      width: 100%;
    }

    .headerActions :global(a),
    .headerActions button,
    .filterActions button {
      flex: 1 1 100%;
    }

    .tabRow,
    .subTabRow {
      gap: 8px;
    }

    .tabButton,
    .subTabButton {
      flex: 1 1 calc(50% - 8px);
      justify-content: center;
    }

    .summaryGrid {
      grid-template-columns: 1fr;
    }

    .panel {
      padding: 14px;
      border-radius: 16px;
    }

    .filterGrid,
    .filterGrid.frozen {
      grid-template-columns: 1fr;
    }

    .rowsControl {
      width: 100%;
      justify-content: space-between;
    }

    .mobileMetaGrid {
      grid-template-columns: 1fr;
      gap: 10px;
    }

    .mobileMetaItemFull {
      grid-column: auto;
    }

    .footerBar {
      align-items: stretch;
    }

    .pager {
      width: 100%;
    }

    .pagerButton {
      flex: 1 1 0;
      justify-content: center;
    }
  }
`;