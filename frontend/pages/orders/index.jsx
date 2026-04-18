import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import OrderService from "../../services/orders";
import { getToken } from "../../services/auth";

/* ============================================================================
   Orders Index Page
   ----------------------------------------------------------------------------
   Fixed:
   - Uses the full unified columns requested
   - Keeps General Orders / Frozen Containers views
   - Keeps Local / Chilled / Frozen sub-tabs for General Orders
   - report_month and report_year are only sent together
   - stale responses are ignored when switching tabs quickly
============================================================================ */

const FONT_FAMILY = "Arial, sans-serif";
const BG = "#ffffff";
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

function titleizeSlug(value) {
  if (!value) return "—";
  return String(value)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
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

function compactSummary(order) {
  const parts = [];

  if (order?.product_summary) parts.push(order.product_summary);
  if (order?.order_ratio) parts.push(order.order_ratio);
  if (order?.jurisdiction) parts.push(order.jurisdiction);

  return parts.join(" • ") || "—";
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

function OrdersIndexPage() {
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
        if (isRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

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

    const nextFilters = {
      ...draftFilters,
    };

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
      <div
        style={{
          minHeight: "100vh",
          background: BG,
          color: TEXT,
          fontFamily: FONT_FAMILY,
          padding: "18px 22px 32px",
          boxSizing: "border-box",
        }}
      >
        <LoadingRows />
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: BG,
        color: TEXT,
        fontFamily: FONT_FAMILY,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "100%",
          margin: 0,
          padding: "18px 22px 32px",
          boxSizing: "border-box",
        }}
      >
        {error ? (
          <div
            style={{
              color: RED,
              background: RED_SOFT,
              border: "1px solid rgba(220,38,38,0.18)",
              borderRadius: 12,
              padding: "12px 14px",
              marginBottom: 14,
              fontSize: 13,
              lineHeight: 1.5,
            }}
          >
            {error}
          </div>
        ) : null}

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 16,
            marginBottom: 16,
            flexWrap: "wrap",
          }}
        >
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: 24,
                lineHeight: 1.2,
                fontWeight: 700,
                letterSpacing: "-0.02em",
              }}
            >
              Orders
            </h1>
            <p
              style={{
                margin: "6px 0 0",
                color: MUTED,
                fontSize: 13,
                lineHeight: 1.5,
              }}
            >
              View order records by General Orders or Frozen Containers.
            </p>
          </div>

          <div
            style={{
              display: "flex",
              gap: 10,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <Link
              href="/orders/create"
              style={{
                background: BLUE,
                color: "#fff",
                border: "none",
                borderRadius: 10,
                padding: "10px 16px",
                fontSize: 13,
                fontWeight: 700,
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              Create Order
            </Link>

            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing || loading}
              style={{
                border: `1px solid ${BORDER}`,
                background: "#fff",
                color: TEXT,
                borderRadius: 10,
                padding: "10px 14px",
                fontSize: 13,
                fontWeight: 600,
                cursor: refreshing || loading ? "not-allowed" : "pointer",
              }}
            >
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>
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
          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              marginBottom: 16,
            }}
          >
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

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(180px, 1fr))",
            gap: 12,
            marginBottom: 16,
          }}
        >
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

        <form
          onSubmit={handleApplyFilters}
          style={{
            border: `1px solid ${BORDER}`,
            borderRadius: 16,
            background: "#fff",
            marginBottom: 16,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "14px 16px",
              borderBottom: `1px solid ${BORDER}`,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                }}
              >
                Filters
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: MUTED,
                  marginTop: 4,
                }}
              >
                Report month and year must be filled together.
              </div>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 12,
                color: MUTED,
              }}
            >
              <span>Rows per page</span>
              <select
                value={pageSize}
                onChange={(e) => handleChangePageSize(e.target.value)}
                style={selectStyle}
              >
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ padding: 16 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  mode === MODE_FROZEN
                    ? "2fr 1fr 1fr 1fr 1fr"
                    : "2fr 1fr 1fr 1fr",
                gap: 12,
              }}
            >
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

            <div
              style={{
                marginTop: 14,
                display: "flex",
                gap: 10,
                flexWrap: "wrap",
              }}
            >
              <button
                type="submit"
                style={{
                  background: BLUE,
                  color: "#fff",
                  border: "none",
                  borderRadius: 10,
                  padding: "10px 16px",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Apply filters
              </button>

              <button
                type="button"
                onClick={handleClearFilters}
                style={{
                  background: "#fff",
                  color: TEXT,
                  border: `1px solid ${BORDER}`,
                  borderRadius: 10,
                  padding: "10px 16px",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Clear
              </button>
            </div>
          </div>
        </form>

        <div
          style={{
            border: `1px solid ${BORDER}`,
            borderRadius: 16,
            background: "#fff",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "14px 16px",
              borderBottom: `1px solid ${BORDER}`,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                }}
              >
                {mode === MODE_GENERAL
                  ? `${titleizeSlug(generalType)} General Orders`
                  : "Frozen Container Orders"}
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: MUTED,
                  marginTop: 4,
                }}
              >
                {formatNumber(total)} matching records
              </div>
            </div>

            <div
              style={{
                fontSize: 12,
                color: MUTED,
              }}
            >
              Page {formatNumber(page)} of {formatNumber(totalPages)}
            </div>
          </div>

          {loading ? (
            <div style={{ padding: 22 }}>
              <LoadingRows />
            </div>
          ) : items.length === 0 ? (
            <div
              style={{
                padding: 26,
                color: MUTED,
                fontSize: 14,
              }}
            >
              No orders found for the selected view and filters.
            </div>
          ) : (
            <>
              <div
                style={{
                  overflowX: "auto",
                  width: "100%",
                }}
              >
                <table
                  style={{
                    width: "100%",
                    minWidth: 1600,
                    borderCollapse: "collapse",
                    tableLayout: "fixed",
                  }}
                >
                  <thead>
                    <tr
                      style={{
                        background: SOFT,
                        borderBottom: `1px solid ${BORDER}`,
                      }}
                    >
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
                      <tr
                        key={order.id}
                        style={{
                          borderBottom: `1px solid ${BORDER}`,
                          background: "#fff",
                        }}
                      >
                        <BodyCell>
                          <div
                            style={{
                              fontSize: 13,
                              fontWeight: 700,
                              color: TEXT,
                              lineHeight: 1.35,
                            }}
                          >
                            {order.order_number || "—"}
                          </div>
                          <div
                            style={{
                              marginTop: 4,
                              fontSize: 12,
                              color: MUTED,
                            }}
                          >
                            ID: {order.id}
                          </div>
                        </BodyCell>

                        <BodyCell>
                          <div
                            style={{
                              fontSize: 13,
                              fontWeight: 600,
                              lineHeight: 1.45,
                            }}
                          >
                            {order.enterprise_name || "—"}
                          </div>
                        </BodyCell>

                        <BodyCell>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>
                            {titleizeSlug(order.order_type)}
                          </div>
                          <div
                            style={{
                              marginTop: 4,
                              fontSize: 12,
                              color: MUTED,
                            }}
                          >
                            {titleizeSlug(order.order_profile)}
                          </div>
                          {order.order_subtype ? (
                            <div
                              style={{
                                marginTop: 4,
                                fontSize: 12,
                                color: MUTED,
                              }}
                            >
                              {titleizeSlug(order.order_subtype)}
                            </div>
                          ) : null}
                        </BodyCell>

                        <BodyCell>
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              padding: "6px 10px",
                              borderRadius: 999,
                              fontSize: 12,
                              fontWeight: 700,
                              textTransform: "capitalize",
                              ...statusPillStyle(order.status),
                            }}
                          >
                            {titleizeSlug(order.status)}
                          </span>
                        </BodyCell>

                        <BodyCell>
                          <div
                            style={{
                              fontSize: 13,
                              lineHeight: 1.5,
                              color: TEXT,
                              wordBreak: "break-word",
                            }}
                          >
                            {compactSummary(order)}
                          </div>
                        </BodyCell>

                        <BodyCell>
                          <div style={{ fontSize: 13, fontWeight: 700 }}>
                            {formatNumber(order.total_quantity_kg, 2)}
                          </div>
                        </BodyCell>

                        <BodyCell>
                          <div style={{ fontSize: 13, fontWeight: 700 }}>
                            {formatNumber(order.total_animals_required)}
                          </div>
                        </BodyCell>

                        <BodyCell>
                          <div style={{ fontSize: 13, fontWeight: 700 }}>
                            {formatMoney(order.shipment_value_usd)}
                          </div>
                        </BodyCell>

                        <BodyCell>
                          <div style={{ fontSize: 13, fontWeight: 700 }}>
                            {formatMoney(order.amount_paid_usd)}
                          </div>
                        </BodyCell>

                        <BodyCell>
                          <div
                            style={{
                              fontSize: 13,
                              fontWeight: 700,
                              color:
                                Number(order.balance_usd || 0) > 0 ? ORANGE : TEXT,
                            }}
                          >
                            {formatMoney(order.balance_usd)}
                          </div>
                        </BodyCell>

                        <BodyCell>
                          <div style={{ fontSize: 13 }}>
                            {formatDate(order.slaughter_schedule)}
                          </div>
                        </BodyCell>

                        <BodyCell>
                          <div style={{ fontSize: 13 }}>
                            {formatDate(order.expected_delivery)}
                          </div>
                        </BodyCell>

                        <BodyCell>
                          <div style={{ fontSize: 12, color: MUTED }}>
                            {formatDateTime(order.updated_at)}
                          </div>
                        </BodyCell>

                        <BodyCell>
                          <Link
                            href={`/orders/${order.id}`}
                            style={{
                              color: BLUE,
                              textDecoration: "none",
                              fontSize: 13,
                              fontWeight: 700,
                            }}
                          >
                            View
                          </Link>
                        </BodyCell>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div
                style={{
                  padding: "14px 16px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    color: MUTED,
                  }}
                >
                  {formatNumber(summary.totalQuantity, 2)} kg on this page •{" "}
                  {formatNumber(summary.totalAnimals)} animals •{" "}
                  {formatMoney(summary.totalShipment)} shipment
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    alignItems: "center",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => handleChangePage(page - 1)}
                    disabled={page <= 1}
                    style={pagerButton(page <= 1)}
                  >
                    Previous
                  </button>

                  <button
                    type="button"
                    onClick={() => handleChangePage(page + 1)}
                    disabled={page >= totalPages}
                    style={pagerButton(page >= totalPages)}
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function HeaderCell({ children, width }) {
  return (
    <th
      style={{
        textAlign: "left",
        padding: "12px 14px",
        fontSize: 12,
        fontWeight: 700,
        color: "#334155",
        whiteSpace: "nowrap",
        width,
      }}
    >
      {children}
    </th>
  );
}

function BodyCell({ children }) {
  return (
    <td
      style={{
        padding: "14px",
        verticalAlign: "top",
        fontSize: 13,
        color: TEXT,
      }}
    >
      {children}
    </td>
  );
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
    <label style={{ display: "block", minWidth: 0 }}>
      <div
        style={{
          fontSize: 12,
          fontWeight: 700,
          color: "#334155",
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <input
        type={type}
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={inputStyle}
      />
    </label>
  );
}

function Select({ label, value, onChange, options }) {
  return (
    <label style={{ display: "block", minWidth: 0 }}>
      <div
        style={{
          fontSize: 12,
          fontWeight: 700,
          color: "#334155",
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={selectStyle}
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
    <div
      style={{
        border: `1px solid ${BORDER}`,
        borderRadius: 14,
        background: "#fff",
        padding: "14px 16px",
      }}
    >
      <div
        style={{
          fontSize: 12,
          color: MUTED,
          marginBottom: 7,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 20,
          fontWeight: 700,
          lineHeight: 1.2,
          letterSpacing: "-0.02em",
          color: TEXT,
        }}
      >
        {value}
      </div>
      <div
        style={{
          marginTop: 4,
          fontSize: 12,
          color: MUTED,
        }}
      >
        {hint}
      </div>
    </div>
  );
}

function ModeButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        border: active ? `1px solid ${BLUE}` : `1px solid ${BORDER}`,
        background: active ? BLUE_SOFT : "#fff",
        color: active ? BLUE : TEXT,
        borderRadius: 10,
        padding: "10px 16px",
        fontSize: 13,
        fontWeight: 700,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

function SubTypeButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        border: active ? `1px solid ${ORANGE}` : `1px solid ${BORDER}`,
        background: active ? ORANGE_SOFT : "#fff",
        color: active ? ORANGE : TEXT,
        borderRadius: 10,
        padding: "9px 14px",
        fontSize: 13,
        fontWeight: 700,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

function LoadingRows() {
  return (
    <div
      style={{
        display: "grid",
        gap: 10,
      }}
    >
      {Array.from({ length: 8 }).map((_, index) => (
        <div
          key={index}
          style={{
            height: 52,
            borderRadius: 12,
            background: "#f8fafc",
            border: `1px solid ${BORDER}`,
          }}
        />
      ))}
    </div>
  );
}

function pagerButton(disabled) {
  return {
    border: `1px solid ${BORDER}`,
    background: disabled ? "#f8fafc" : "#fff",
    color: disabled ? "#94a3b8" : TEXT,
    borderRadius: 10,
    padding: "9px 14px",
    fontSize: 13,
    fontWeight: 600,
    cursor: disabled ? "not-allowed" : "pointer",
  };
}

const inputStyle = {
  width: "100%",
  height: 42,
  padding: "0 12px",
  borderRadius: 10,
  border: `1px solid ${BORDER}`,
  background: "#fff",
  color: TEXT,
  fontSize: 13,
  fontFamily: FONT_FAMILY,
  outline: "none",
  boxSizing: "border-box",
};

const selectStyle = {
  width: "100%",
  height: 42,
  padding: "0 12px",
  borderRadius: 10,
  border: `1px solid ${BORDER}`,
  background: "#fff",
  color: TEXT,
  fontSize: 13,
  fontFamily: FONT_FAMILY,
  outline: "none",
  boxSizing: "border-box",
};

export default OrdersIndexPage;