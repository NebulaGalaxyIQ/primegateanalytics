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
  if (Array.isArray(response?.data)) return response.data;
  return [];
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

function coerceTotal(response) {
  if (typeof response?.total === "number") return response.total;
  if (typeof response?.data?.total === "number") return response.data.total;
  return coerceItems(response).length;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function roundTo(value, places = 2) {
  const factor = 10 ** places;
  return Math.round((Number(value) + Number.EPSILON) * factor) / factor;
}

function parseNumericInput(value) {
  if (value === "" || value === null || value === undefined) return null;
  const cleaned = String(value).replace(/,/g, "").trim();
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function moneyNumber(value) {
  return roundTo(parseNumericInput(value) ?? 0, 2);
}

function quantityNumber(value) {
  return roundTo(parseNumericInput(value) ?? 0, 3);
}

function formatMoney(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "0.00";
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatNumber(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "0";
  return new Intl.NumberFormat().format(n);
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

function emptySaleForm() {
  return {
    sale_number: "",
    sale_date: todayIso(),
    customer_id: "",
    transaction_name: "",
    payment_mode: "",
    status: "posted",
    discount_amount: "",
    adjustment_amount: "",
    remarks: "",
  };
}

function normalizeItemName(item) {
  return (
    item?.name ||
    item?.short_name ||
    item?.report_label ||
    item?.code ||
    "Unnamed Item"
  );
}

function normalizeCustomerName(customer) {
  return (
    customer?.customer_name ||
    customer?.transaction_name ||
    customer?.customer_code ||
    customer?.name ||
    "Unnamed Customer"
  );
}

function saleStatusText(value) {
  return String(value || "paid").replace(/_/g, " ");
}

function paymentModeText(value) {
  return String(value || "—").replace(/_/g, " ");
}

function getDefaultUnitPrice(item) {
  return (
    item?.default_unit_price ??
    item?.unit_price ??
    item?.selling_price ??
    item?.price ??
    ""
  );
}

function getItemUnit(item) {
  return item?.unit_of_measure || item?.unit || item?.uom || "—";
}

function itemAllowsFraction(item) {
  const explicit = [
    item?.allow_fractional_quantity,
    item?.allows_fractional_quantity,
    item?.fractional_quantity_allowed,
    item?.is_fractional_quantity_allowed,
    item?.allow_decimal_quantity,
    item?.allows_decimal_quantity,
  ].find((value) => typeof value === "boolean");

  if (typeof explicit === "boolean") return explicit;

  const mode = String(
    item?.quantity_mode ||
      item?.quantity_type ||
      item?.quantity_rule ||
      item?.input_mode ||
      ""
  ).toLowerCase();

  if (mode.includes("whole") || mode.includes("integer") || mode.includes("count")) {
    return false;
  }

  if (mode.includes("decimal") || mode.includes("fraction")) {
    return true;
  }

  const unit = String(getItemUnit(item)).toLowerCase();

  if (
    unit.includes("kg") ||
    unit.includes("kilogram") ||
    unit.includes("gram") ||
    unit.includes("g") ||
    unit.includes("litre") ||
    unit.includes("liter") ||
    unit.includes("ml") ||
    unit.includes("ton") ||
    unit.includes("tonne") ||
    unit.includes("ltr")
  ) {
    return true;
  }

  if (
    unit.includes("piece") ||
    unit.includes("pcs") ||
    unit.includes("pc") ||
    unit.includes("head") ||
    unit.includes("unit") ||
    unit.includes("item")
  ) {
    return false;
  }

  return true;
}

function lineTotal(line) {
  return moneyNumber(quantityNumber(line?.quantity) * moneyNumber(line?.unit_price));
}

function createLine(defaultItem = null) {
  return {
    id: null,
    local_id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    byproduct_id: defaultItem?.id || "",
    quantity: "",
    unit_price:
      getDefaultUnitPrice(defaultItem) !== "" && getDefaultUnitPrice(defaultItem) !== null
        ? String(getDefaultUnitPrice(defaultItem))
        : "",
    remarks: "",
    is_existing: false,
  };
}

function mapSaleLine(line, availableItems = []) {
  const lineItemId = line?.byproduct_id || line?.byproduct?.id || "";
  const fallbackByName =
    line?.byproduct_name_snapshot ||
    line?.byproduct_name ||
    line?.byproduct?.name ||
    "";

  const matchedItem =
    availableItems.find((item) => item?.id === lineItemId) ||
    availableItems.find(
      (item) => normalizeItemName(item).toLowerCase() === String(fallbackByName).toLowerCase()
    );

  return {
    id: line?.id || null,
    local_id: `${line?.id || Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    byproduct_id: matchedItem?.id || lineItemId || "",
    quantity:
      line?.quantity !== null && line?.quantity !== undefined ? String(line.quantity) : "",
    unit_price:
      line?.unit_price !== null && line?.unit_price !== undefined
        ? String(line.unit_price)
        : matchedItem
        ? String(getDefaultUnitPrice(matchedItem) ?? "")
        : "",
    remarks: line?.remarks || "",
    is_existing: !!line?.id,
  };
}

function StatusPill({ value }) {
  const text = String(value || "paid").toLowerCase();

  let styles = {
    background: BLUE_SOFT,
    color: BLUE,
  };

  if (
    text.includes("paid") ||
    text.includes("complete") ||
    text.includes("completed")
  ) {
    styles = { background: GREEN_SOFT, color: GREEN };
  } else if (
    text.includes("void") ||
    text.includes("cancel") ||
    text.includes("fail")
  ) {
    styles = { background: RED_SOFT, color: RED };
  } else if (
    text.includes("pending") ||
    text.includes("partial") ||
    text.includes("posted")
  ) {
    styles = { background: ORANGE_SOFT, color: ORANGE_DEEP };
  }

  return (
    <span className="bps-status-pill" style={styles}>
      {saleStatusText(text)}
    </span>
  );
}

function MetricCard({ title, value, valueColor }) {
  return (
    <div
      style={{
        background: SURFACE,
        border: `1px solid ${BORDER}`,
        borderRadius: 18,
        padding: 14,
        minWidth: 0,
      }}
    >
      <div
        style={{
          color: MUTED,
          fontSize: 12,
          fontWeight: 700,
          marginBottom: 6,
        }}
      >
        {title}
      </div>
      <div
        style={{
          color: valueColor || TEXT,
          fontSize: 22,
          fontWeight: 800,
          lineHeight: 1.15,
          wordBreak: "break-word",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function SummaryBox({ title, value, valueColor }) {
  return (
    <div
      style={{
        border: `1px solid ${BORDER}`,
        borderRadius: 14,
        padding: 12,
        background: "#fff",
        minWidth: 0,
      }}
    >
      <div
        style={{
          color: MUTED,
          fontSize: 12,
          fontWeight: 700,
          marginBottom: 6,
        }}
      >
        {title}
      </div>
      <div
        style={{
          color: valueColor || TEXT,
          fontSize: 16,
          fontWeight: 800,
          lineHeight: 1.2,
          wordBreak: "break-word",
        }}
      >
        {value}
      </div>
    </div>
  );
}

export default function ByproductsSalesPage() {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [customers, setCustomers] = useState([]);
  const [items, setItems] = useState([]);

  const [pageLoading, setPageLoading] = useState(true);
  const [tableLoading, setTableLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [workingSaleId, setWorkingSaleId] = useState(null);
  const [deletedLineIds, setDeletedLineIds] = useState([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [filters, setFilters] = useState({
    search: "",
    status: "",
    payment_mode: "",
    sale_date_from: "",
    sale_date_to: "",
    include_deleted: false,
  });

  const [form, setForm] = useState(emptySaleForm());
  const [lines, setLines] = useState([createLine()]);

  const itemsById = useMemo(() => {
    const map = {};
    items.forEach((item) => {
      if (item?.id) map[item.id] = item;
    });
    return map;
  }, [items]);

  const formTotals = useMemo(() => {
    const subtotal = roundTo(lines.reduce((sum, line) => sum + lineTotal(line), 0), 2);
    const discount = moneyNumber(form.discount_amount);
    const adjustment = moneyNumber(form.adjustment_amount);
    const totalAmount = roundTo(subtotal - discount + adjustment, 2);
    const amountPaid = totalAmount;
    const balanceDue = roundTo(totalAmount - amountPaid, 2);

    return {
      subtotal,
      discount,
      adjustment,
      totalAmount,
      amountPaid,
      balanceDue,
    };
  }, [lines, form.discount_amount, form.adjustment_amount]);

  const lineWarnings = useMemo(() => {
    const warnings = {};

    lines.forEach((line) => {
      const item = itemsById[line.byproduct_id];
      const quantityValue = parseNumericInput(line.quantity);
      let quantityError = "";

      if (line.quantity !== "" && quantityValue === null) {
        quantityError = "Enter a valid quantity.";
      } else if (
        item &&
        quantityValue !== null &&
        !itemAllowsFraction(item) &&
        !Number.isInteger(quantityValue)
      ) {
        quantityError = `Quantity for '${normalizeItemName(
          item
        )}' must be a whole number because fractional quantity is not allowed.`;
      }

      warnings[line.local_id] = {
        quantityError,
        unitNote: item
          ? itemAllowsFraction(item)
            ? `Unit: ${getItemUnit(item)} • Decimals allowed`
            : `Unit: ${getItemUnit(item)} • Whole numbers only`
          : "",
      };
    });

    return warnings;
  }, [lines, itemsById]);

  const summary = useMemo(() => {
    const activeRows = rows.filter((row) => !row?.is_deleted);
    const totalAmount = activeRows.reduce(
      (sum, row) => sum + Number(row?.total_amount || 0),
      0
    );
    const totalBalance = activeRows.reduce(
      (sum, row) => sum + Number(row?.balance_due || 0),
      0
    );
    const voidedCount = rows.filter((row) =>
      String(row?.status || "").toLowerCase().includes("void")
    ).length;

    return {
      totalAmount: roundTo(totalAmount, 2),
      totalBalance: roundTo(totalBalance, 2),
      voidedCount,
    };
  }, [rows]);

  const loadLookups = useCallback(async () => {
    const [customersResponse, itemsResponse] = await Promise.all([
      ByproductsService.getCustomerSelection(),
      ByproductsService.getItemSelection(),
    ]);

    setCustomers(coerceItems(customersResponse));
    setItems(coerceItems(itemsResponse));
  }, []);

  const loadSales = useCallback(async () => {
    setTableLoading(true);

    try {
      const response = await ByproductsService.listSales({
        search: filters.search || undefined,
        status: filters.status || undefined,
        payment_mode: filters.payment_mode || undefined,
        sale_date_from: filters.sale_date_from || undefined,
        sale_date_to: filters.sale_date_to || undefined,
        include_deleted: filters.include_deleted,
        skip: 0,
        limit: 200,
      });

      setRows(coerceItems(response));
      setTotal(coerceTotal(response));
    } catch (err) {
      setError(err?.message || "Failed to load sales.");
    } finally {
      setTableLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    let mounted = true;

    async function init() {
      setPageLoading(true);
      setError("");

      try {
        await Promise.all([loadLookups(), loadSales()]);
      } catch (err) {
        if (!mounted) return;
        setError(err?.message || "Failed to load sales page.");
      } finally {
        if (mounted) setPageLoading(false);
      }
    }

    init();

    return () => {
      mounted = false;
    };
  }, [loadLookups, loadSales]);

  function resetForm() {
    setForm(emptySaleForm());
    setLines([createLine()]);
    setWorkingSaleId(null);
    setDeletedLineIds([]);
  }

  function clearMessages() {
    setError("");
    setSuccess("");
  }

  function updateLine(localId, patch) {
    setLines((prev) =>
      prev.map((line) =>
        line.local_id === localId ? { ...line, ...patch } : line
      )
    );
  }

  function addLine() {
    setLines((prev) => [...prev, createLine()]);
  }

  function removeLine(localId) {
    setLines((prev) => {
      const target = prev.find((line) => line.local_id === localId);

      if (target?.id) {
        setDeletedLineIds((current) =>
          current.includes(target.id) ? current : [...current, target.id]
        );
      }

      const next = prev.filter((line) => line.local_id !== localId);
      return next.length > 0 ? next : [createLine()];
    });
  }

  async function handleEdit(row) {
    if (!row?.id) return;

    clearMessages();
    setSaving(true);

    try {
      const response = await ByproductsService.getSale(row.id);
      const sale = coerceObject(response) || row;

      const saleLines =
        sale?.lines ||
        sale?.sale_lines ||
        sale?.items ||
        sale?.details ||
        [];

      setWorkingSaleId(sale?.id || row.id);
      setDeletedLineIds([]);
      setForm({
        sale_number: sale?.sale_number || "",
        sale_date: sale?.sale_date || todayIso(),
        customer_id: sale?.customer_id || "",
        transaction_name:
          sale?.transaction_name_snapshot ||
          sale?.transaction_name ||
          "",
        payment_mode: sale?.payment_mode || "",
        status: sale?.status || "paid",
        discount_amount:
          sale?.discount_amount !== null && sale?.discount_amount !== undefined
            ? String(sale.discount_amount)
            : "",
        adjustment_amount:
          sale?.adjustment_amount !== null && sale?.adjustment_amount !== undefined
            ? String(sale.adjustment_amount)
            : "",
        remarks: sale?.remarks || "",
      });

      setLines(
        Array.isArray(saleLines) && saleLines.length > 0
          ? saleLines.map((line) => mapSaleLine(line, items))
          : [createLine()]
      );

      if (typeof window !== "undefined") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } catch (err) {
      setError(err?.message || "Failed to load sale details.");
    } finally {
      setSaving(false);
    }
  }

  function buildPayload() {
    if (!form.customer_id) {
      throw new Error("Please select a customer.");
    }

    const preparedLines = lines.map((line, index) => {
      const selectedItem = itemsById[line.byproduct_id];
      const quantityValue = parseNumericInput(line.quantity);
      const unitPriceValue = parseNumericInput(line.unit_price);

      if (!selectedItem) {
        throw new Error(`Please select an item for line ${index + 1}.`);
      }

      if (quantityValue === null || quantityValue <= 0) {
        throw new Error(
          `Please enter a valid quantity for '${normalizeItemName(selectedItem)}'.`
        );
      }

      if (!itemAllowsFraction(selectedItem) && !Number.isInteger(quantityValue)) {
        throw new Error(
          `Quantity for '${normalizeItemName(
            selectedItem
          )}' must be a whole number because fractional quantity is not allowed.`
        );
      }

      if (unitPriceValue === null || unitPriceValue < 0) {
        throw new Error(
          `Please enter a valid unit price for '${normalizeItemName(selectedItem)}'.`
        );
      }

      return {
        id: line?.id || undefined,
        line_number: index + 1,
        byproduct_id: selectedItem.id,
        byproduct_name: normalizeItemName(selectedItem),
        quantity: itemAllowsFraction(selectedItem)
          ? quantityNumber(quantityValue)
          : Number(quantityValue),
        unit_price: moneyNumber(unitPriceValue),
        remarks: String(line?.remarks || "").trim() || undefined,
      };
    });

    if (preparedLines.length === 0) {
      throw new Error("At least one valid sale line is required.");
    }

    return {
      sale_number: String(form.sale_number || "").trim() || undefined,
      sale_date: form.sale_date || todayIso(),
      customer_id: form.customer_id,
      transaction_name: String(form.transaction_name || "").trim() || undefined,
      payment_mode: String(form.payment_mode || "").trim() || undefined,
      status: String(form.status || "paid").trim() || "paid",
      discount_amount: moneyNumber(form.discount_amount),
      adjustment_amount: moneyNumber(form.adjustment_amount),
      amount_paid: formTotals.totalAmount,
      remarks: String(form.remarks || "").trim() || undefined,
      lines: preparedLines,
    };
  }

  async function handleSubmit(e) {
    e.preventDefault();
    clearMessages();
    setSaving(true);

    try {
      const payload = buildPayload();

      if (workingSaleId) {
        await ByproductsService.updateSale(workingSaleId, {
          ...payload,
          deleted_line_ids: deletedLineIds,
        });
        setSuccess("Sale updated successfully.");
      } else {
        await ByproductsService.createSale(payload);
        setSuccess("Sale created successfully.");
      }

      resetForm();
      await loadSales();
    } catch (err) {
      setError(err?.message || "Failed to save sale.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    const ok = window.confirm("Delete this sale?");
    if (!ok) return;

    clearMessages();

    try {
      await ByproductsService.deleteSale(id);
      setSuccess("Sale deleted successfully.");
      if (workingSaleId === id) resetForm();
      await loadSales();
    } catch (err) {
      setError(err?.message || "Failed to delete sale.");
    }
  }

  async function handleRestore(id) {
    clearMessages();

    try {
      await ByproductsService.restoreSale(id);
      setSuccess("Sale restored successfully.");
      await loadSales();
    } catch (err) {
      setError(err?.message || "Failed to restore sale.");
    }
  }

  async function handleVoid(id) {
    const note = window.prompt("Void note (optional):", "");
    if (note === null) return;

    clearMessages();

    try {
      await ByproductsService.voidSale(id, note || undefined);
      setSuccess("Sale voided successfully.");
      await loadSales();

      if (workingSaleId === id) {
        await handleEdit({ id });
      }
    } catch (err) {
      setError(err?.message || "Failed to void sale.");
    }
  }

  return (
    <>
      <Head>
        <title>Byproducts Sales</title>
      </Head>

      <div className="bps-page">
        <div className="bps-container">
          <section className="bps-hero">
            <div className="bps-hero-top">
              <div className="bps-hero-copy">
                <div className="bps-chip">Byproducts</div>

                <h1 className="bps-title">Sales</h1>

                <p className="bps-subtitle">
                  Create and edit byproduct sales cleanly on desktop and phone.
                  Quantity no longer auto-jumps, whole-number items validate
                  correctly, and Amount Paid now follows the calculated total automatically.
                </p>
              </div>

              <div className="bps-metrics-grid">
                <MetricCard
                  title="Total Sales"
                  value={pageLoading ? "..." : formatNumber(total)}
                  valueColor={TEXT}
                />
                <MetricCard
                  title="Gross"
                  value={pageLoading ? "..." : formatMoney(summary.totalAmount)}
                  valueColor={BLUE}
                />
                <MetricCard
                  title="Balance"
                  value={pageLoading ? "..." : formatMoney(summary.totalBalance)}
                  valueColor={RED}
                />
                <MetricCard
                  title="Voided"
                  value={pageLoading ? "..." : formatNumber(summary.voidedCount)}
                  valueColor={ORANGE_DEEP}
                />
              </div>
            </div>

            {error ? <div className="bps-alert bps-alert-error">{error}</div> : null}
            {success ? (
              <div className="bps-alert bps-alert-success">{success}</div>
            ) : null}
          </section>

          <section className="bps-panel">
            <div className="bps-panel-head">
              <div>
                <h2 className="bps-section-title">
                  {workingSaleId ? "Edit Sale" : "New Sale"}
                </h2>
                <p className="bps-section-text">
                  New Sale is now at the top. Sale List is below.
                </p>
              </div>

              {workingSaleId ? (
                <span className="bps-editing-pill">Editing existing sale</span>
              ) : null}
            </div>

            <form onSubmit={handleSubmit} className="bps-form">
              <div className="bps-form-grid">
                <div className="bps-field-wrap">
                  <label className="bps-label">Sale Number</label>
                  <input
                    value={form.sale_number}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        sale_number: e.target.value,
                      }))
                    }
                    placeholder="Leave blank to auto-generate"
                    className="bps-field"
                  />
                </div>

                <div className="bps-field-wrap">
                  <label className="bps-label">Sale Date</label>
                  <input
                    type="date"
                    value={form.sale_date}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        sale_date: e.target.value,
                      }))
                    }
                    className="bps-field"
                  />
                </div>

                <div className="bps-field-wrap">
                  <label className="bps-label">Select Customer</label>
                  <select
                    value={form.customer_id}
                    onChange={(e) => {
                      const nextId = e.target.value;
                      const selected = customers.find((c) => c?.id === nextId);

                      setForm((prev) => ({
                        ...prev,
                        customer_id: nextId,
                        transaction_name: nextId
                          ? selected?.transaction_name ||
                            selected?.contact_person ||
                            prev.transaction_name
                          : "",
                        payment_mode: nextId
                          ? selected?.default_payment_mode || prev.payment_mode
                          : prev.payment_mode,
                      }));
                    }}
                    className="bps-field"
                  >
                    <option value="">Choose customer</option>
                    {customers.map((customer) => (
                      <option key={customer?.id} value={customer?.id}>
                        {normalizeCustomerName(customer)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="bps-field-wrap">
                  <label className="bps-label">Transaction Name</label>
                  <input
                    value={form.transaction_name}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        transaction_name: e.target.value,
                      }))
                    }
                    placeholder="Transaction name"
                    className="bps-field"
                  />
                </div>

                <div className="bps-field-wrap">
                  <label className="bps-label">Payment Mode</label>
                  <select
                    value={form.payment_mode}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        payment_mode: e.target.value,
                      }))
                    }
                    className="bps-field"
                  >
                    <option value="">Choose payment mode</option>
                    <option value="cash">cash</option>
                    <option value="credit">credit</option>
                    <option value="mobile_money">mobile_money</option>
                    <option value="bank_transfer">bank_transfer</option>
                  </select>
                </div>

                <div className="bps-field-wrap">
                  <label className="bps-label">Status</label>
                  <select
                    value={form.status}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        status: e.target.value,
                      }))
                    }
                    className="bps-field"
                  >
                    <option value="paid">paid</option>
                    <option value="posted">posted</option>
                    <option value="pending">pending</option>
                    <option value="partial">partial</option>
                    <option value="void">void</option>
                  </select>
                </div>

                <div className="bps-field-wrap">
                  <label className="bps-label">Discount</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={form.discount_amount}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        discount_amount: e.target.value,
                      }))
                    }
                    placeholder="0.00"
                    className="bps-field"
                  />
                </div>

                <div className="bps-field-wrap">
                  <label className="bps-label">Adjustment</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={form.adjustment_amount}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        adjustment_amount: e.target.value,
                      }))
                    }
                    placeholder="0.00"
                    className="bps-field"
                  />
                </div>

                <div className="bps-field-wrap">
                  <label className="bps-label">Amount Paid</label>
                  <input
                    value={formatMoney(formTotals.amountPaid)}
                    readOnly
                    className="bps-field bps-field-readonly"
                  />
                  <div className="bps-helper">
                    Auto-calculated from the sale total.
                  </div>
                </div>
              </div>

              <div className="bps-field-wrap">
                <label className="bps-label">Remarks</label>
                <textarea
                  value={form.remarks}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      remarks: e.target.value,
                    }))
                  }
                  rows={3}
                  placeholder="Sale remarks"
                  className="bps-field bps-textarea"
                />
              </div>

              <div className="bps-lines-box">
                <div className="bps-lines-head">
                  <div>
                    <div className="bps-lines-title">Sale Lines</div>
                    <div className="bps-lines-subtitle">
                      Select the item, enter quantity and price, and the total updates instantly.
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={addLine}
                    className="bps-secondary-btn"
                  >
                    + Add Line
                  </button>
                </div>

                <div className="bps-lines-grid">
                  {lines.map((line, index) => {
                    const selectedItem = itemsById[line.byproduct_id];
                    const selectedWarning = lineWarnings[line.local_id] || {};
                    const allowsFraction = selectedItem
                      ? itemAllowsFraction(selectedItem)
                      : true;

                    return (
                      <div key={line.local_id} className="bps-line-card">
                        <div className="bps-line-head">
                          <div className="bps-line-title">Line {index + 1}</div>

                          <button
                            type="button"
                            onClick={() => removeLine(line.local_id)}
                            className="bps-remove-btn"
                          >
                            Remove
                          </button>
                        </div>

                        <div className="bps-line-grid">
                          <div className="bps-field-wrap">
                            <label className="bps-label">Select Item</label>
                            <select
                              value={line.byproduct_id}
                              onChange={(e) => {
                                const nextId = e.target.value;
                                const nextItem = items.find(
                                  (item) => item?.id === nextId
                                );

                                updateLine(line.local_id, {
                                  byproduct_id: nextId,
                                  unit_price: nextId
                                    ? String(getDefaultUnitPrice(nextItem) ?? "")
                                    : line.unit_price,
                                  quantity:
                                    nextId &&
                                    nextItem &&
                                    !itemAllowsFraction(nextItem) &&
                                    line.quantity.includes(".")
                                      ? ""
                                      : line.quantity,
                                });
                              }}
                              className="bps-field"
                            >
                              <option value="">Choose item</option>
                              {items.map((item) => (
                                <option key={item?.id} value={item?.id}>
                                  {normalizeItemName(item)}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="bps-field-wrap">
                            <label className="bps-label">Quantity</label>
                            <input
                              type="text"
                              inputMode={allowsFraction ? "decimal" : "numeric"}
                              value={line.quantity}
                              onChange={(e) =>
                                updateLine(line.local_id, {
                                  quantity: e.target.value,
                                })
                              }
                              placeholder={allowsFraction ? "0.000" : "0"}
                              className="bps-field"
                            />
                            {selectedWarning.unitNote ? (
                              <div className="bps-helper">{selectedWarning.unitNote}</div>
                            ) : null}
                            {selectedWarning.quantityError ? (
                              <div className="bps-inline-error">
                                {selectedWarning.quantityError}
                              </div>
                            ) : null}
                          </div>

                          <div className="bps-field-wrap">
                            <label className="bps-label">Unit Price</label>
                            <input
                              type="text"
                              inputMode="decimal"
                              value={line.unit_price}
                              onChange={(e) =>
                                updateLine(line.local_id, {
                                  unit_price: e.target.value,
                                })
                              }
                              placeholder="0.00"
                              className="bps-field"
                            />
                          </div>

                          <div className="bps-field-wrap">
                            <label className="bps-label">Line Total</label>
                            <div className="bps-line-total-box">
                              {formatMoney(lineTotal(line))}
                            </div>
                          </div>
                        </div>

                        <div className="bps-field-wrap">
                          <label className="bps-label">Line Remarks</label>
                          <textarea
                            value={line.remarks}
                            onChange={(e) =>
                              updateLine(line.local_id, {
                                remarks: e.target.value,
                              })
                            }
                            rows={2}
                            className="bps-field bps-textarea bps-line-textarea"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="bps-summary-grid">
                <SummaryBox title="Subtotal" value={formatMoney(formTotals.subtotal)} />
                <SummaryBox title="Discount" value={formatMoney(formTotals.discount)} />
                <SummaryBox title="Adjustment" value={formatMoney(formTotals.adjustment)} />
                <SummaryBox title="Total" value={formatMoney(formTotals.totalAmount)} />
                <SummaryBox title="Amount Paid" value={formatMoney(formTotals.amountPaid)} />
                <SummaryBox
                  title="Balance"
                  value={formatMoney(formTotals.balanceDue)}
                  valueColor={formTotals.balanceDue > 0 ? RED : GREEN}
                />
              </div>

              <div className="bps-actions">
                <button
                  type="submit"
                  disabled={saving}
                  className="bps-primary-btn"
                >
                  {saving
                    ? "Saving..."
                    : workingSaleId
                    ? "Update Sale"
                    : "Create Sale"}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    clearMessages();
                    resetForm();
                  }}
                  className="bps-secondary-btn"
                >
                  Clear
                </button>
              </div>
            </form>
          </section>

          <section className="bps-panel">
            <div className="bps-panel-head">
              <div>
                <h2 className="bps-section-title">Sale List</h2>
                <p className="bps-section-text">
                  Review, edit, delete, restore, and void byproduct sales.
                </p>
              </div>

              <button
                type="button"
                onClick={loadSales}
                disabled={tableLoading}
                className="bps-secondary-btn"
              >
                {tableLoading ? "Refreshing..." : "Refresh"}
              </button>
            </div>

            <div className="bps-filters-grid">
              <input
                value={filters.search}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    search: e.target.value,
                  }))
                }
                placeholder="Search sale no, customer..."
                className="bps-field"
              />

              <select
                value={filters.status}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    status: e.target.value,
                  }))
                }
                className="bps-field"
              >
                <option value="">All statuses</option>
                <option value="posted">posted</option>
                <option value="pending">pending</option>
                <option value="partial">partial</option>
                <option value="paid">paid</option>
                <option value="void">void</option>
              </select>

              <select
                value={filters.payment_mode}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    payment_mode: e.target.value,
                  }))
                }
                className="bps-field"
              >
                <option value="">All payment modes</option>
                <option value="cash">cash</option>
                <option value="credit">credit</option>
                <option value="mobile_money">mobile_money</option>
                <option value="bank_transfer">bank_transfer</option>
              </select>

              <input
                type="date"
                value={filters.sale_date_from}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    sale_date_from: e.target.value,
                  }))
                }
                className="bps-field"
              />

              <input
                type="date"
                value={filters.sale_date_to}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    sale_date_to: e.target.value,
                  }))
                }
                className="bps-field"
              />

              <label className="bps-checkbox-wrap">
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

            <div className="bps-mobile-list">
              {rows.length === 0 ? (
                <div className="bps-empty-box">
                  {tableLoading ? "Loading sales..." : "No sales found."}
                </div>
              ) : (
                rows.map((row) => (
                  <div key={row?.id} className="bps-mobile-card">
                    <div className="bps-mobile-card-top">
                      <div className="bps-mobile-card-main">
                        <div className="bps-mobile-card-title">
                          {row?.sale_number || "—"}
                        </div>
                        <div className="bps-mobile-card-subtitle">
                          {row?.customer_name_snapshot ||
                            row?.customer_name ||
                            row?.transaction_name_snapshot ||
                            row?.transaction_name ||
                            "Unknown customer"}
                        </div>
                      </div>

                      <StatusPill value={row?.status} />
                    </div>

                    <div className="bps-mobile-data-grid">
                      <div className="bps-mobile-data-row">
                        <span className="bps-mobile-label">Date</span>
                        <span className="bps-mobile-value">
                          {formatDate(row?.sale_date)}
                        </span>
                      </div>

                      <div className="bps-mobile-data-row">
                        <span className="bps-mobile-label">Payment</span>
                        <span className="bps-mobile-value">
                          {paymentModeText(row?.payment_mode)}
                        </span>
                      </div>

                      <div className="bps-mobile-data-row">
                        <span className="bps-mobile-label">Total</span>
                        <span className="bps-mobile-value">
                          {formatMoney(row?.total_amount)}
                        </span>
                      </div>

                      <div className="bps-mobile-data-row">
                        <span className="bps-mobile-label">Paid</span>
                        <span className="bps-mobile-value">
                          {formatMoney(row?.amount_paid)}
                        </span>
                      </div>

                      <div className="bps-mobile-data-row">
                        <span className="bps-mobile-label">Balance</span>
                        <span
                          className="bps-mobile-value"
                          style={{
                            color:
                              Number(row?.balance_due || 0) > 0 ? RED : GREEN,
                            fontWeight: 800,
                          }}
                        >
                          {formatMoney(row?.balance_due)}
                        </span>
                      </div>
                    </div>

                    <div className="bps-mobile-actions">
                      <button
                        type="button"
                        onClick={() => handleEdit(row)}
                        className="bps-mobile-action-btn"
                      >
                        Edit
                      </button>

                      {!row?.is_deleted ? (
                        <button
                          type="button"
                          onClick={() => handleDelete(row?.id)}
                          className="bps-mobile-action-btn"
                          style={{ color: RED }}
                        >
                          Delete
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleRestore(row?.id)}
                          className="bps-mobile-action-btn"
                          style={{ color: GREEN }}
                        >
                          Restore
                        </button>
                      )}

                      {!String(row?.status || "")
                        .toLowerCase()
                        .includes("void") && !row?.is_deleted ? (
                        <button
                          type="button"
                          onClick={() => handleVoid(row?.id)}
                          className="bps-mobile-action-btn"
                          style={{ color: ORANGE_DEEP }}
                        >
                          Void
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="bps-table-wrap">
              <table className="bps-table">
                <thead>
                  <tr>
                    {[
                      "Sale No.",
                      "Date",
                      "Customer",
                      "Payment",
                      "Status",
                      "Total",
                      "Paid",
                      "Balance",
                      "Action",
                    ].map((head) => (
                      <th key={head}>{head}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="bps-empty-cell">
                        {tableLoading ? "Loading sales..." : "No sales found."}
                      </td>
                    </tr>
                  ) : (
                    rows.map((row) => (
                      <tr key={row?.id}>
                        <td className="bps-strong-cell">{row?.sale_number || "—"}</td>
                        <td className="bps-cell">{formatDate(row?.sale_date)}</td>
                        <td className="bps-cell bps-break-cell">
                          {row?.customer_name_snapshot ||
                            row?.customer_name ||
                            row?.transaction_name_snapshot ||
                            row?.transaction_name ||
                            "—"}
                        </td>
                        <td className="bps-cell">{paymentModeText(row?.payment_mode)}</td>
                        <td className="bps-cell">
                          <StatusPill value={row?.status} />
                        </td>
                        <td className="bps-cell">{formatMoney(row?.total_amount)}</td>
                        <td className="bps-cell">{formatMoney(row?.amount_paid)}</td>
                        <td
                          className="bps-cell"
                          style={{
                            color:
                              Number(row?.balance_due || 0) > 0 ? RED : GREEN,
                            fontWeight: 800,
                          }}
                        >
                          {formatMoney(row?.balance_due)}
                        </td>
                        <td className="bps-cell">
                          <div className="bps-table-actions">
                            <button
                              type="button"
                              onClick={() => handleEdit(row)}
                              className="bps-table-btn"
                            >
                              Edit
                            </button>

                            {!row?.is_deleted ? (
                              <button
                                type="button"
                                onClick={() => handleDelete(row?.id)}
                                className="bps-table-btn"
                                style={{ color: RED }}
                              >
                                Delete
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleRestore(row?.id)}
                                className="bps-table-btn"
                                style={{ color: GREEN }}
                              >
                                Restore
                              </button>
                            )}

                            {!String(row?.status || "")
                              .toLowerCase()
                              .includes("void") && !row?.is_deleted ? (
                              <button
                                type="button"
                                onClick={() => handleVoid(row?.id)}
                                className="bps-table-btn"
                                style={{ color: ORANGE_DEEP }}
                              >
                                Void
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>

      <style jsx global>{`
        .bps-page {
          min-height: 100vh;
          background: ${PAGE_BG};
          padding: 20px 16px 40px;
          font-family: Arial, sans-serif;
        }

        .bps-container {
          max-width: 1450px;
          margin: 0 auto;
          display: grid;
          gap: 18px;
        }

        .bps-hero,
        .bps-panel,
        .bps-mobile-card,
        .bps-line-card {
          background: ${SURFACE};
          border: 1px solid ${BORDER};
          box-shadow: ${SHADOW};
          box-sizing: border-box;
        }

        .bps-hero {
          border-radius: 24px;
          padding: 20px;
        }

        .bps-hero-top {
          display: grid;
          gap: 16px;
        }

        .bps-hero-copy {
          min-width: 0;
        }

        .bps-chip {
          display: inline-flex;
          align-items: center;
          padding: 6px 12px;
          border-radius: 999px;
          background: ${ORANGE_SOFT};
          color: ${ORANGE_DEEP};
          font-size: 12px;
          font-weight: 800;
          margin-bottom: 10px;
        }

        .bps-title {
          margin: 0;
          color: ${TEXT};
          font-size: 28px;
          font-weight: 800;
          line-height: 1.15;
          word-break: break-word;
        }

        .bps-subtitle {
          margin: 8px 0 0;
          color: ${MUTED};
          font-size: 14px;
          line-height: 1.7;
          max-width: 860px;
        }

        .bps-metrics-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
          width: 100%;
        }

        .bps-alert {
          margin-top: 16px;
          padding: 12px 14px;
          border-radius: 14px;
          font-size: 13px;
          font-weight: 700;
          word-break: break-word;
        }

        .bps-alert-error {
          background: ${RED_SOFT};
          color: ${RED};
        }

        .bps-alert-success {
          background: ${GREEN_SOFT};
          color: ${GREEN};
        }

        .bps-panel {
          border-radius: 22px;
          padding: 18px;
          overflow: hidden;
        }

        .bps-panel-head {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
          flex-wrap: wrap;
          margin-bottom: 14px;
        }

        .bps-section-title {
          margin: 0;
          color: ${TEXT};
          font-size: 18px;
          font-weight: 800;
        }

        .bps-section-text {
          margin: 6px 0 0;
          color: ${MUTED};
          font-size: 13px;
          line-height: 1.6;
        }

        .bps-editing-pill {
          display: inline-flex;
          padding: 6px 10px;
          border-radius: 999px;
          background: ${BLUE_SOFT};
          color: ${BLUE};
          font-size: 12px;
          font-weight: 800;
        }

        .bps-form {
          display: grid;
          gap: 14px;
        }

        .bps-form-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
        }

        .bps-field-wrap {
          min-width: 0;
        }

        .bps-label {
          display: block;
          color: ${TEXT};
          font-size: 13px;
          font-weight: 700;
          margin-bottom: 6px;
        }

        .bps-field {
          width: 100%;
          min-height: 44px;
          border-radius: 12px;
          border: 1px solid ${BORDER};
          padding: 0 14px;
          font-size: 14px;
          color: ${TEXT};
          background: #fff;
          outline: none;
          box-sizing: border-box;
        }

        .bps-field-readonly {
          background: #f8fafc;
          color: ${BLUE};
          font-weight: 800;
        }

        .bps-textarea {
          min-height: 90px;
          padding-top: 12px;
          resize: vertical;
        }

        .bps-line-textarea {
          min-height: 76px;
        }

        .bps-helper {
          margin-top: 6px;
          color: ${MUTED};
          font-size: 12px;
          line-height: 1.5;
          word-break: break-word;
        }

        .bps-inline-error {
          margin-top: 6px;
          color: ${RED};
          fontSize: 12px;
          font-weight: 700;
          line-height: 1.5;
          word-break: break-word;
        }

        .bps-lines-box {
          border: 1px solid ${BORDER};
          border-radius: 18px;
          padding: 14px;
          background: #fff;
        }

        .bps-lines-head {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
          flex-wrap: wrap;
          margin-bottom: 12px;
        }

        .bps-lines-title {
          color: ${TEXT};
          font-size: 16px;
          font-weight: 800;
        }

        .bps-lines-subtitle {
          color: ${MUTED};
          font-size: 12px;
          margin-top: 4px;
          line-height: 1.6;
        }

        .bps-lines-grid {
          display: grid;
          gap: 12px;
        }

        .bps-line-card {
          border-radius: 16px;
          padding: 12px;
          background: #fff;
        }

        .bps-line-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
          margin-bottom: 12px;
        }

        .bps-line-title {
          color: ${TEXT};
          font-size: 14px;
          font-weight: 800;
        }

        .bps-line-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
        }

        .bps-line-total-box {
          min-height: 44px;
          display: flex;
          align-items: center;
          padding: 0 14px;
          border-radius: 12px;
          background: ${ORANGE_SOFT};
          color: ${ORANGE_DEEP};
          font-size: 14px;
          font-weight: 800;
          box-sizing: border-box;
          word-break: break-word;
        }

        .bps-summary-grid {
          display: grid;
          grid-template-columns: repeat(6, minmax(0, 1fr));
          gap: 10px;
        }

        .bps-actions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          padding-top: 4px;
        }

        .bps-primary-btn,
        .bps-secondary-btn,
        .bps-remove-btn,
        .bps-table-btn,
        .bps-mobile-action-btn {
          min-height: 44px;
          padding: 0 16px;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 800;
          cursor: pointer;
          box-sizing: border-box;
        }

        .bps-primary-btn {
          border: none;
          background: ${ORANGE};
          color: #fff;
        }

        .bps-primary-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .bps-secondary-btn {
          border: 1px solid ${BORDER};
          background: ${SURFACE};
          color: ${TEXT};
        }

        .bps-remove-btn {
          min-height: 34px;
          padding: 0 10px;
          border-radius: 10px;
          border: 1px solid ${BORDER};
          background: #fff;
          color: ${RED};
          font-size: 12px;
        }

        .bps-filters-grid {
          display: grid;
          grid-template-columns:
            minmax(180px, 1fr)
            160px
            160px
            180px
            180px
            auto;
          gap: 12px;
          margin-bottom: 16px;
        }

        .bps-checkbox-wrap {
          min-height: 44px;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 0 12px;
          border-radius: 12px;
          border: 1px solid ${BORDER};
          background: #fff;
          color: ${TEXT};
          font-size: 13px;
          font-weight: 700;
          box-sizing: border-box;
        }

        .bps-mobile-list {
          display: none;
        }

        .bps-mobile-card {
          border-radius: 16px;
          padding: 14px;
        }

        .bps-mobile-card-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
          margin-bottom: 10px;
        }

        .bps-mobile-card-main {
          min-width: 0;
          flex: 1;
        }

        .bps-mobile-card-title {
          color: ${TEXT};
          font-size: 15px;
          font-weight: 800;
          line-height: 1.4;
          word-break: break-word;
        }

        .bps-mobile-card-subtitle {
          color: ${MUTED};
          font-size: 12px;
          margin-top: 4px;
          line-height: 1.5;
          word-break: break-word;
        }

        .bps-mobile-data-grid {
          display: grid;
          gap: 8px;
        }

        .bps-mobile-data-row {
          display: grid;
          grid-template-columns: 88px minmax(0, 1fr);
          gap: 10px;
          align-items: start;
        }

        .bps-mobile-label {
          color: ${MUTED};
          font-size: 12px;
          font-weight: 700;
        }

        .bps-mobile-value {
          color: ${TEXT};
          font-size: 13px;
          line-height: 1.5;
          word-break: break-word;
        }

        .bps-mobile-actions {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
          margin-top: 14px;
        }

        .bps-mobile-action-btn {
          width: 100%;
          min-height: 40px;
          padding: 0 12px;
          border-radius: 10px;
          border: 1px solid ${BORDER};
          background: #fff;
          color: ${BLUE};
          font-size: 13px;
        }

        .bps-empty-box {
          padding: 24px 14px;
          text-align: center;
          color: ${MUTED};
          font-size: 14px;
          border: 1px solid ${BORDER};
          border-radius: 16px;
          background: #fff;
        }

        .bps-table-wrap {
          overflow-x: auto;
          border: 1px solid ${BORDER};
          border-radius: 16px;
        }

        .bps-table {
          width: 100%;
          min-width: 1180px;
          border-collapse: collapse;
          background: #fff;
        }

        .bps-table thead tr {
          background: #f8fafc;
        }

        .bps-table th {
          text-align: left;
          padding: 13px 14px;
          border-bottom: 1px solid ${BORDER};
          color: ${TEXT};
          font-size: 13px;
          font-weight: 800;
          white-space: nowrap;
        }

        .bps-cell,
        .bps-strong-cell {
          padding: 13px 14px;
          border-bottom: 1px solid ${BORDER};
          color: ${TEXT};
          font-size: 13px;
          vertical-align: top;
        }

        .bps-strong-cell {
          font-weight: 800;
        }

        .bps-break-cell {
          min-width: 180px;
          max-width: 260px;
          white-space: normal;
          word-break: break-word;
        }

        .bps-empty-cell {
          padding: 28px 14px;
          text-align: center;
          color: ${MUTED};
          font-size: 14px;
        }

        .bps-table-actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .bps-table-btn {
          min-height: 34px;
          padding: 0 10px;
          border-radius: 10px;
          border: 1px solid ${BORDER};
          background: #fff;
          color: ${BLUE};
          font-size: 12px;
        }

        .bps-status-pill {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 6px 10px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 800;
          text-transform: capitalize;
          white-space: nowrap;
        }

        @media (max-width: 1200px) {
          .bps-form-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }

          .bps-line-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .bps-summary-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }

          .bps-metrics-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 920px) {
          .bps-page {
            padding: 14px 12px 28px;
          }

          .bps-hero,
          .bps-panel {
            padding: 16px;
            border-radius: 18px;
          }

          .bps-title {
            font-size: 24px;
          }

          .bps-form-grid,
          .bps-line-grid,
          .bps-filters-grid,
          .bps-summary-grid {
            grid-template-columns: 1fr;
          }

          .bps-actions {
            display: grid;
            grid-template-columns: 1fr;
          }

          .bps-primary-btn,
          .bps-secondary-btn {
            width: 100%;
          }

          .bps-mobile-list {
            display: grid;
            gap: 12px;
          }

          .bps-table-wrap {
            display: none;
          }
        }

        @media (max-width: 560px) {
          .bps-title {
            font-size: 22px;
          }

          .bps-section-title {
            font-size: 17px;
          }

          .bps-subtitle,
          .bps-section-text {
            font-size: 12px;
          }

          .bps-metrics-grid {
            grid-template-columns: 1fr;
          }

          .bps-mobile-actions {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </>
  );
}