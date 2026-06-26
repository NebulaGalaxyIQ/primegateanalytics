import Head from "next/head";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import DynamicInventoryService from "../../services/dynamic-inventory";

const HERO_IMAGE_URL = "https://images.unsplash.com/photo-1627920769541-daa658ed6b59?auto=format&fit=crop&w=1800&q=80";

const DEPARTMENT_META = {
  crops: {
    title: "Crops Department",
    shortTitle: "Crops",
    icon: "🌿",
    visual: "🌽",
    tone: "green",
    description: "Manage crop production, seed inventory, harvests, fertilizer, irrigation, and stock levels.",
  },
  animals: {
    title: "Animals Department",
    shortTitle: "Animals",
    icon: "🐐",
    visual: "🐐",
    tone: "amber",
    description: "Track livestock health, inventory, births, deaths, feed, vaccination, and animal activities.",
  },
  machinery: {
    title: "Machineries & Maintenance",
    shortTitle: "Machineries & Maintenance",
    icon: "🚜",
    visual: "🚜",
    tone: "blue",
    description: "Monitor equipment usage, fuel records, maintenance schedules, servicing, and repairs.",
  },
  machineries: {
    title: "Machineries & Maintenance",
    shortTitle: "Machineries & Maintenance",
    icon: "🚜",
    visual: "🚜",
    tone: "blue",
    description: "Monitor equipment usage, fuel records, maintenance schedules, servicing, and repairs.",
  },
  maintenance: {
    title: "Machineries & Maintenance",
    shortTitle: "Machineries & Maintenance",
    icon: "🚜",
    visual: "🚜",
    tone: "blue",
    description: "Monitor equipment usage, fuel records, maintenance schedules, servicing, and repairs.",
  },
};

const ACCESS_TYPES = [
  { value: "assigned_users", label: "Assigned users only" },
  { value: "private", label: "Private" },
  { value: "department", label: "Department users" },
  { value: "public", label: "All authorized users" },
];

const DEFAULT_DEPARTMENTS = [
  { department: "crops", label: "Crops Department", description: DEPARTMENT_META.crops.description },
  { department: "animals", label: "Animals Department", description: DEPARTMENT_META.animals.description },
  { department: "machinery", label: "Machineries & Maintenance", description: DEPARTMENT_META.machinery.description },
];


const INVENTORY_TYPE_GROUPS = {
  animals: [
    "goat_inventory",
    "cattle_inventory",
    "sheep_inventory",
    "poultry_inventory",
    "animal_movement",
    "animal_births",
    "animal_deaths",
    "animal_sales",
    "animal_purchases",
    "feed_inventory",
    "vaccination_records",
    "treatment_records",
    "milk_production",
    "egg_production",
    "custom",
  ],
  crops: [
    "crop_stock",
    "crop_planting",
    "harvest_records",
    "seeds_inventory",
    "fertilizer_inventory",
    "chemical_inventory",
    "irrigation_records",
    "crop_sales",
    "storage_stock",
    "field_records",
    "crop_production_cost",
    "custom",
  ],
  machinery: [
    "machinery_register",
    "fuel_usage",
    "service_records",
    "repair_records",
    "spare_parts_inventory",
    "maintenance_schedule",
    "breakdown_records",
    "oil_change_records",
    "tyre_records",
    "operator_records",
    "machine_running_hours",
    "custom",
  ],
};

const INVENTORY_TYPE_DETAILS = {
  goat_inventory: "Daily goat stock balances, purchases, sales, movements, and current herd totals.",
  cattle_inventory: "Cattle stock records, movement balances, purchases, sales, and herd summaries.",
  sheep_inventory: "Sheep stock balances, movement records, purchases, sales, and flock tracking.",
  poultry_inventory: "Poultry stock balances, flock movements, purchases, sales, and current totals.",
  animal_movement: "Livestock movement records between pens, farms, buyers, and holding areas.",
  animal_births: "Animal birth records, offspring details, dam/sire notes, and birth summaries.",
  animal_deaths: "Mortality records, causes of death, affected animals, and follow-up actions.",
  animal_sales: "Animal sales records, buyer details, quantities, weights, prices, and totals.",
  animal_purchases: "Animal purchase records, supplier details, quantities, weights, costs, and arrivals.",
  feed_inventory: "Feed stock, feed usage, feed purchases, closing balances, and reorder tracking.",
  vaccination_records: "Vaccination dates, vaccine names, batch details, animal groups, and next schedules.",
  treatment_records: "Animal treatment records, medication, dosage, responsible staff, and recovery notes.",
  milk_production: "Daily milk production records, animal groups, yields, quality notes, and totals.",
  egg_production: "Daily egg production records, flock groups, trays, damages, and sales-ready totals.",
  crop_stock: "Crop stock levels, opening balances, additions, deductions, and closing quantities.",
  crop_planting: "Planting dates, field blocks, crop varieties, seed usage, and planting progress.",
  harvest_records: "Harvest quantities, field blocks, dates, quality grades, storage, and dispatch records.",
  seeds_inventory: "Seed stock balances, purchases, usage, varieties, and reorder levels.",
  fertilizer_inventory: "Fertilizer stock levels, applications, purchases, usage, and closing balances.",
  chemical_inventory: "Chemical stock records, applications, purchases, safety notes, and balances.",
  irrigation_records: "Irrigation dates, field blocks, water usage, duration, and scheduling records.",
  crop_sales: "Crop sales records, buyer details, quantities, grades, prices, and totals.",
  storage_stock: "Storage stock movement, warehouse balances, dispatches, losses, and current totals.",
  field_records: "Field block records, activities, crop status, labour, inputs, and operational notes.",
  crop_production_cost: "Crop production costs, inputs, labour, machinery usage, and total cost summaries.",
  machinery_register: "Machine register records, ownership, model details, assigned users, and availability.",
  fuel_usage: "Fuel issue records, machine usage, litres consumed, operators, and running cost summaries.",
  service_records: "Machine service dates, service type, mileage or hours, costs, and next service due.",
  repair_records: "Repair records, faults, parts used, labour, costs, and repair completion status.",
  spare_parts_inventory: "Spare parts stock, purchases, usage, reorder levels, and closing balances.",
  maintenance_schedule: "Planned maintenance schedules, responsible staff, due dates, and completion tracking.",
  breakdown_records: "Machine breakdown records, downtime, causes, repair actions, and resolution status.",
  oil_change_records: "Oil change records, machine hours, oil type, quantities, costs, and next change due.",
  tyre_records: "Tyre condition, replacements, purchases, fitting dates, costs, and machine assignments.",
  operator_records: "Operator assignment records, machine usage, shift notes, and responsibility tracking.",
  machine_running_hours: "Machine running hours, operators, tasks performed, fuel usage, and productivity summaries.",
  custom: "Custom ranch inventory records with fields and calculations configured for your workflow.",
};

function normalizeDepartmentKey(value) {
  const key = String(value || "").toLowerCase().trim().replace(/[\s-]+/g, "_");
  if (["animal", "animals", "livestock"].includes(key)) return "animals";
  if (["crop", "crops", "field", "fields"].includes(key)) return "crops";
  if (["machinery", "machineries", "maintenance", "machine", "machines", "equipment"].includes(key)) return "machinery";
  return key || "animals";
}

function normalizeInventoryTypeValue(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

function inventoryTypeLabel(value) {
  return formatWords(value || "custom");
}

function inventoryTypeDescription(value) {
  const key = normalizeInventoryTypeValue(value);
  return INVENTORY_TYPE_DETAILS[key] || "Daily inventory records and automatic ranch calculations.";
}

function getInventoryTypeOptions(department) {
  const key = normalizeDepartmentKey(department);
  const values = INVENTORY_TYPE_GROUPS[key] || ["custom"];
  return values.map((value) => ({
    value,
    label: inventoryTypeLabel(value),
    description: inventoryTypeDescription(value),
  }));
}

function templateInventoryType(template) {
  return normalizeInventoryTypeValue(
    template?.inventory_type ||
      template?.inventoryType ||
      template?.type ||
      template?.template_key ||
      template?.key ||
      template?.name
  );
}

function templateDepartmentKey(template) {
  return normalizeDepartmentKey(template?.department || template?.department_key || template?.category || template?.group);
}

function findTemplateForInventoryType(templates, inventoryType, department) {
  const selectedType = normalizeInventoryTypeValue(inventoryType);
  if (!selectedType || selectedType === "custom") return null;
  const selectedDepartment = normalizeDepartmentKey(department);
  const list = safeArray(templates);

  return (
    list.find((template) => {
      const type = templateInventoryType(template);
      const templateDept = templateDepartmentKey(template);
      return type === selectedType && (!templateDept || templateDept === selectedDepartment);
    }) ||
    list.find((template) => {
      const key = normalizeInventoryTypeValue(template?.template_key || template?.key || "");
      const name = normalizeInventoryTypeValue(template?.name || "");
      return key.includes(selectedType) || name.includes(selectedType);
    }) ||
    null
  );
}

const SIDEBAR_ITEMS = [
  { key: "dashboard", label: "Dashboard", icon: "grid" },
  { key: "inventory", label: "Inventory", icon: "inventory" },
  { key: "crops", label: "Crops", icon: "leaf", department: "crops" },
  { key: "animals", label: "Animals", icon: "animal", department: "animals" },
  { key: "machinery", label: "Machinery", icon: "tractor", department: "machinery" },
  { key: "reports", label: "Reports", icon: "chart" },
  { key: "approvals", label: "Approvals", icon: "shield" },
  { key: "alerts", label: "Alerts", icon: "bell" },
  { key: "settings", label: "Settings", icon: "settings" },
];

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function safeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function normalizeDepartment(dept) {
  const key = String(dept || "").toLowerCase();
  return DEPARTMENT_META[key] || {
    title: dept ? formatWords(dept) : "Other Department",
    shortTitle: dept ? formatWords(dept) : "Other",
    icon: "📦",
    visual: "📦",
    tone: "gray",
    description: "Inventory modules and daily records.",
  };
}

function formatWords(value) {
  return String(value || "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatDateTime(value) {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat("en-GB", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch (_) {
    return value;
  }
}

function formatShortTime(value) {
  if (!value) return "Just now";
  try {
    const date = new Date(value);
    const diff = Date.now() - date.getTime();
    const minutes = Math.max(0, Math.floor(diff / 60000));
    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return new Intl.DateTimeFormat("en-GB", { month: "short", day: "2-digit" }).format(date);
  } catch (_) {
    return String(value);
  }
}

function formatDepartmentName(value) {
  const meta = normalizeDepartment(value);
  return meta.title;
}

function formatInventoryType(value) {
  return formatWords(value || "Inventory Module");
}

function metricValue(value) {
  if (value === undefined || value === null || value === "") return "0";
  const number = Number(value);
  if (!Number.isFinite(number)) return String(value);
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(number);
}

function compactValue(value) {
  const number = Number(value || 0);
  if (!Number.isFinite(number)) return metricValue(value);
  if (Math.abs(number) >= 1000000) return `${(number / 1000000).toFixed(1).replace(/\.0$/, "")}M`;
  if (Math.abs(number) >= 1000) return `${(number / 1000).toFixed(1).replace(/\.0$/, "")}K`;
  return metricValue(number);
}

function statusKey(status) {
  return String(status || "draft")
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

function statusLabel(status) {
  return formatWords(status || "draft");
}

function inventoryStatus(inventory) {
  return (
    inventory?.last_period_status ||
    inventory?.period_status ||
    inventory?.approval_status ||
    inventory?.status ||
    "active"
  );
}

function inventoryRows(inventory) {
  return Number(inventory?.today_row_count || inventory?.rows_today || inventory?.row_count_today || 0);
}

function inventoryAlerts(inventory) {
  return Number(inventory?.open_alerts || inventory?.alerts || 0);
}

function inventoryPending(inventory) {
  return Number(inventory?.pending_approvals || inventory?.pending || 0);
}

function cssEscapeStatus(status) {
  return statusKey(status) || "draft";
}

function AppIcon({ name, className = "" }) {
  const common = {
    width: 20,
    height: 20,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    className,
    "aria-hidden": true,
  };

  const paths = {
    grid: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1.6" />
        <rect x="14" y="3" width="7" height="7" rx="1.6" />
        <rect x="3" y="14" width="7" height="7" rx="1.6" />
        <rect x="14" y="14" width="7" height="7" rx="1.6" />
      </>
    ),
    inventory: (
      <>
        <path d="M21 8.5 12 3 3 8.5l9 5.5 9-5.5Z" />
        <path d="M3 8.5V16l9 5 9-5V8.5" />
        <path d="M12 14v7" />
      </>
    ),
    leaf: (
      <>
        <path d="M20 4c-7.5.5-12.8 4.2-14.2 10.8C4.9 19 8.1 21.5 12 19.4 17.4 16.6 20 10.7 20 4Z" />
        <path d="M6 19c2.6-5.5 6.3-8.8 11-10" />
      </>
    ),
    animal: (
      <>
        <path d="M6 10V8.8A3.8 3.8 0 0 1 9.8 5h4.4A3.8 3.8 0 0 1 18 8.8V10" />
        <path d="M4 10h16l-1.2 8.2A3.2 3.2 0 0 1 15.7 21H8.3a3.2 3.2 0 0 1-3.1-2.8L4 10Z" />
        <path d="M8 5 6.2 2.8" />
        <path d="m16 5 1.8-2.2" />
        <path d="M9 14h.01" />
        <path d="M15 14h.01" />
        <path d="M10.5 18h3" />
      </>
    ),
    tractor: (
      <>
        <path d="M4 16h2.2" />
        <path d="M11 16h3" />
        <path d="M18 16h2" />
        <path d="M7 16 9.4 8H14l2.5 4H20v4" />
        <path d="M9 8V5h3" />
        <circle cx="7" cy="17" r="3" />
        <circle cx="17.5" cy="17" r="2.5" />
      </>
    ),
    chart: (
      <>
        <path d="M4 19V5" />
        <path d="M4 19h16" />
        <path d="M8 16v-5" />
        <path d="M12 16V8" />
        <path d="M16 16v-9" />
      </>
    ),
    shield: (
      <>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
        <path d="m9 12 2 2 4-4" />
      </>
    ),
    bell: (
      <>
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
        <path d="M13.7 21a2 2 0 0 1-3.4 0" />
      </>
    ),
    settings: (
      <>
        <path d="M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5Z" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 0 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 0 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 4.6 15 1.7 1.7 0 0 0 3 14H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1A2 2 0 0 1 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3h.1A1.7 1.7 0 0 0 10 3V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5h.1a1.7 1.7 0 0 0 1.9-.3l.1-.1A2 2 0 1 1 19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9v.1A1.7 1.7 0 0 0 21 10h.1a2 2 0 0 1 0 4H21a1.7 1.7 0 0 0-1.6 1Z" />
      </>
    ),
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </>
    ),
    refresh: (
      <>
        <path d="M20 12a8 8 0 0 1-13.7 5.7L4 15" />
        <path d="M4 20v-5h5" />
        <path d="M4 12A8 8 0 0 1 17.7 6.3L20 9" />
        <path d="M20 4v5h-5" />
      </>
    ),
    plus: (
      <>
        <path d="M12 5v14" />
        <path d="M5 12h14" />
      </>
    ),
    seed: (
      <>
        <path d="M8 19c7-2 10-8 10-15C11 4 5 8 5 15c0 2.2 1.2 3.6 3 4Z" />
        <path d="M5 21c3-6 7-9 13-11" />
      </>
    ),
    filter: (
      <>
        <path d="M4 5h16" />
        <path d="M7 12h10" />
        <path d="M10 19h4" />
      </>
    ),
    calendar: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M16 3v4" />
        <path d="M8 3v4" />
        <path d="M3 10h18" />
      </>
    ),
    clipboard: (
      <>
        <path d="M9 4h6l1 2h2a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h2l1-2Z" />
        <path d="M9 13h6" />
        <path d="M9 17h4" />
      </>
    ),
    alert: (
      <>
        <path d="m12 3 10 18H2L12 3Z" />
        <path d="M12 9v5" />
        <path d="M12 17h.01" />
      </>
    ),
    layers: (
      <>
        <path d="m12 2 9 5-9 5-9-5 9-5Z" />
        <path d="m3 12 9 5 9-5" />
        <path d="m3 17 9 5 9-5" />
      </>
    ),
    report: (
      <>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
        <path d="M14 2v6h6" />
        <path d="M8 15h8" />
        <path d="M8 19h5" />
      </>
    ),
    help: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M9.2 9a3 3 0 1 1 4.9 2.3c-.9.7-1.6 1.2-1.6 2.7" />
        <path d="M12 17h.01" />
      </>
    ),
    user: (
      <>
        <path d="M20 21a8 8 0 0 0-16 0" />
        <circle cx="12" cy="7" r="4" />
      </>
    ),
    lock: (
      <>
        <rect x="4" y="10" width="16" height="10" rx="2" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      </>
    ),
    chevronDown: <path d="m6 9 6 6 6-6" />,
    chevronRight: <path d="m9 18 6-6-6-6" />,
  };

  return <svg {...common}>{paths[name] || paths.inventory}</svg>;
}

function Toast({ message, type = "info", onClose }) {
  if (!message) return null;
  return (
    <div className={`toast toast-${type}`}>
      <span>{message}</span>
      <button type="button" onClick={onClose} aria-label="Close notification">×</button>
    </div>
  );
}

function LoadingBlock({ text = "Loading..." }) {
  return (
    <div className="loadingBlock">
      <div className="spinner" />
      <span>{text}</span>
    </div>
  );
}

function EmptyState({ title, description, action }) {
  return (
    <div className="emptyState">
      <div className="emptyIllustration">
        <span>🌿</span>
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}

function Sidebar({ activeKey, onNavigate, onProfile }) {
  return (
    <aside className="sidebar">
      <button type="button" className="brandBlock" onClick={() => onNavigate?.("dashboard")} aria-label="Open dashboard">
        <span className="brandMark brandMarkNew" aria-hidden="true">
          <svg viewBox="0 0 64 64" role="img" focusable="false">
            <path className="logoShield" d="M32 5 53 13v15c0 15.6-8.8 25.6-21 31-12.2-5.4-21-15.4-21-31V13L32 5Z" />
            <path className="logoGround" d="M16 45c7-6 14-9 22-7 5 1 8 3 11 6" />
            <path className="logoBarn" d="M21 36V24l11-8 11 8v12" />
            <path className="logoBarn" d="M24 36h16M27 36V27h10v9M21 24h22" />
            <path className="logoLeaf" d="M43 19c6-3 10-2 12 2-4 5-9 6-14 2 0-2 1-3 2-4Z" />
          </svg>
        </span>
        <div className="brandText">
          <strong>Greenfield</strong>
          <span>RANCH</span>
        </div>
      </button>

      <nav className="sideNav" aria-label="Ranch management navigation">
        {SIDEBAR_ITEMS.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`sideItem ${activeKey === item.key ? "active" : ""}`}
            onClick={() => onNavigate?.(item.key)}
          >
            <AppIcon name={item.icon} />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="sidebarFooter">
        <button type="button" className="profileMini" onClick={onProfile}>
          <div className="profileAvatar">RM</div>
          <div>
            <strong>Ranch Manager</strong>
            <span>Manager</span>
          </div>
          <AppIcon name="chevronDown" />
        </button>

        <button type="button" className="ranchNote" onClick={() => onNavigate?.("reports")} aria-label="Open ranch reports">
          <p>Healthy ranch,</p>
          <p>sustainable tomorrow.</p>
          <div className="noteLandscape">
            <span className="noteSun" />
            <span className="noteHill one" />
            <span className="noteHill two" />
            <span className="noteBarn" />
            <span className="noteWindmill" />
            <span className="noteGrass" />
          </div>
        </button>
      </div>
    </aside>
  );
}

function TopBar() {
  return (
    <header className="topBar">
      <div className="topTitle">Ranch Management</div>
      <div className="topActions">
        <button type="button" className="topIcon" aria-label="Notifications">
          <AppIcon name="bell" />
          <span className="notificationDot">3</span>
        </button>
        <button type="button" className="topIcon" aria-label="Help">
          <AppIcon name="help" />
        </button>
        <button type="button" className="userButton">
          <span className="userCircle">RM</span>
          <span>Ranch Manager</span>
          <AppIcon name="chevronDown" />
        </button>
      </div>
    </header>
  );
}

function HeroIllustration() {
  return (
    <div className="heroIllustration" aria-hidden="true">
      <span className="heroImageShade" />
    </div>
  );
}

function MetricCard({ icon, title, value, note, tone }) {
  return (
    <article className={`metricCard ${tone}`}>
      <div className="metricIcon">
        <AppIcon name={icon} />
      </div>
      <div>
        <span>{title}</span>
        <strong>{value}</strong>
        <small>{note}</small>
      </div>
    </article>
  );
}

function SectionToolbar({ search, setSearch, departmentFilter, setDepartmentFilter, departmentList, onRefresh }) {
  return (
    <section className="toolbarPanel">
      <div className="searchBox">
        <AppIcon name="search" />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search modules, records, or keywords..."
        />
      </div>

      <label className="selectWrap" aria-label="Department filter">
        <AppIcon name="filter" />
        <select value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)}>
          <option value="all">All Departments</option>
          {departmentList.map((department) => (
            <option key={department.department || department.value} value={department.department || department.value}>
              {department.label || formatDepartmentName(department.department || department.value)}
            </option>
          ))}
        </select>
        <AppIcon name="chevronDown" />
      </label>

      <button type="button" className="refreshButton" onClick={onRefresh}>
        <AppIcon name="refresh" />
        <span>Refresh</span>
      </button>
    </section>
  );
}

function CreateInventoryModal({
  open,
  onClose,
  onCreated,
  departments,
  templates,
  onRefreshTemplates,
}) {
  const initialType = "goat_inventory";
  const [form, setForm] = useState({
    department: "animals",
    inventory_type: initialType,
    template_id: "",
    title: inventoryTypeLabel(initialType),
    description: inventoryTypeDescription(initialType),
    report_title: `${inventoryTypeLabel(initialType)} Report`,
    reporter_name: "",
    company_name: "",
    access_type: "assigned_users",
    assigned_user_ids: "1",
  });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const inventoryTypeOptions = useMemo(() => {
    return getInventoryTypeOptions(form.department);
  }, [form.department]);

  const departmentTemplates = useMemo(() => {
    const selectedDepartment = normalizeDepartmentKey(form.department);
    return safeArray(templates).filter((template) => {
      const templateDepartment = templateDepartmentKey(template);
      return !templateDepartment || templateDepartment === selectedDepartment;
    });
  }, [templates, form.department]);

  useEffect(() => {
    if (!open) return;

    const selectedType = normalizeInventoryTypeValue(form.inventory_type);
    const allowedTypes = inventoryTypeOptions.map((item) => item.value);
    const nextType = allowedTypes.includes(selectedType) ? selectedType : inventoryTypeOptions[0]?.value || "custom";
    const matchingTemplate = findTemplateForInventoryType(departmentTemplates, nextType, form.department);
    const nextTemplateId = matchingTemplate?.id ? String(matchingTemplate.id) : "";

    if (nextType !== form.inventory_type || nextTemplateId !== String(form.template_id || "")) {
      const label = matchingTemplate?.name || inventoryTypeLabel(nextType);
      setForm((prev) => ({
        ...prev,
        inventory_type: nextType,
        template_id: nextTemplateId,
        title: prev.title && nextType === form.inventory_type ? prev.title : label,
        report_title:
          prev.report_title && nextType === form.inventory_type
            ? prev.report_title
            : `${label} Report`,
        description:
          prev.description && nextType === form.inventory_type
            ? prev.description
            : matchingTemplate?.description || inventoryTypeDescription(nextType),
      }));
    }
  }, [open, form.department, form.inventory_type, form.template_id, inventoryTypeOptions, departmentTemplates]);

  if (!open) return null;

  const applyInventoryType = (inventoryType, templateSource = departmentTemplates) => {
    const nextType = normalizeInventoryTypeValue(inventoryType) || "custom";
    const matchingTemplate = findTemplateForInventoryType(templateSource, nextType, form.department);
    const label = matchingTemplate?.name || inventoryTypeLabel(nextType);

    setForm((prev) => ({
      ...prev,
      inventory_type: nextType,
      template_id: matchingTemplate?.id ? String(matchingTemplate.id) : "",
      title: label,
      report_title: `${label} Report`,
      description: matchingTemplate?.description || inventoryTypeDescription(nextType),
    }));
  };

  const handleChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleDepartmentChange = async (department) => {
    const nextDepartment = department;
    const nextType = getInventoryTypeOptions(nextDepartment)[0]?.value || "custom";
    const matchingTemplate = findTemplateForInventoryType(templates, nextType, nextDepartment);
    const label = matchingTemplate?.name || inventoryTypeLabel(nextType);

    setForm((prev) => ({
      ...prev,
      department: nextDepartment,
      inventory_type: nextType,
      template_id: matchingTemplate?.id ? String(matchingTemplate.id) : "",
      title: label,
      report_title: `${label} Report`,
      description: matchingTemplate?.description || inventoryTypeDescription(nextType),
    }));

    if (onRefreshTemplates) await onRefreshTemplates(nextDepartment);
  };

  const handleTemplateChange = (templateId) => {
    if (!templateId) {
      applyInventoryType(form.inventory_type);
      return;
    }

    const template = safeArray(templates).find((item) => String(item.id) === String(templateId));
    const type = normalizeInventoryTypeValue(template?.inventory_type || template?.template_key || form.inventory_type);
    const label = template?.name || inventoryTypeLabel(type);

    setForm((prev) => ({
      ...prev,
      template_id: templateId,
      inventory_type: type,
      title: label,
      report_title: `${label} Report`,
      description: template?.description || inventoryTypeDescription(type),
    }));
  };

  const handleCreate = async (event) => {
    event.preventDefault();
    setError("");
    setCreating(true);

    try {
      const assignedIds = String(form.assigned_user_ids || "")
        .split(",")
        .map((item) => Number(item.trim()))
        .filter((item) => Number.isFinite(item) && item > 0);

      const payload = {
        title: form.title,
        department: form.department,
        inventory_type: normalizeInventoryTypeValue(form.inventory_type) || "custom",
        description: form.description,
        report_title: form.report_title,
        reporter_name: form.reporter_name || undefined,
        company_name: form.company_name || undefined,
        access_type: form.access_type,
        assigned_user_ids: assignedIds.length ? assignedIds : undefined,
      };

      if (form.template_id) payload.template_id = Number(form.template_id);

      const created = await DynamicInventoryService.createInventoryFromTemplate(payload);
      onCreated?.(created);
      onClose?.();
    } catch (err) {
      setError(err.message || "Failed to create inventory.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="modalOverlay" role="dialog" aria-modal="true" aria-labelledby="createInventoryTitle">
      <div className="modalCard createModal">
        <div className="modalHeader">
          <div>
            <p className="eyebrow">New ranch inventory</p>
            <h2 id="createInventoryTitle">Create Inventory Module</h2>
          </div>
          <button type="button" className="iconButton" onClick={onClose} aria-label="Close modal">×</button>
        </div>

        <form onSubmit={handleCreate} className="formGrid">
          {error ? <div className="formError">{error}</div> : null}

          <label>
            <span>Department</span>
            <div className="fieldShell">
              <AppIcon name="layers" />
              <select value={form.department} onChange={(event) => handleDepartmentChange(event.target.value)}>
                {safeArray(departments).map((department) => (
                  <option key={department.department || department.value} value={department.department || department.value}>
                    {department.label || formatDepartmentName(department.department || department.value)}
                  </option>
                ))}
                {!departments?.length ? (
                  <>
                    <option value="animals">Animals Department</option>
                    <option value="crops">Crops Department</option>
                    <option value="machinery">Machineries & Maintenance</option>
                  </>
                ) : null}
              </select>
            </div>
          </label>

          <label>
            <span>Inventory type</span>
            <div className="fieldShell">
              <AppIcon name="inventory" />
              <select
                value={normalizeInventoryTypeValue(form.inventory_type)}
                onChange={(event) => applyInventoryType(event.target.value)}
              >
                {inventoryTypeOptions.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
            <small className="fieldHint">Only valid {formatDepartmentName(form.department).toLowerCase()} inventory types are shown.</small>
          </label>

          <label>
            <span>Template</span>
            <div className="fieldShell">
              <AppIcon name="report" />
              <select value={form.template_id} onChange={(event) => handleTemplateChange(event.target.value)}>
                <option value="">Auto-select by selected inventory type</option>
                {departmentTemplates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name || template.template_key || inventoryTypeLabel(template.inventory_type)}
                  </option>
                ))}
              </select>
            </div>
            <small className="fieldHint">
              {form.template_id
                ? "A matching template has been selected automatically."
                : "No template is required; the selected inventory type will be sent directly."}
            </small>
          </label>

          <label>
            <span>Inventory title</span>
            <div className="fieldShell">
              <AppIcon name="clipboard" />
              <input
                value={form.title}
                onChange={(event) => handleChange("title", event.target.value)}
                placeholder="Goat Inventory"
                required
              />
            </div>
          </label>

          <label className="wide">
            <span>Description</span>
            <div className="textareaShell">
              <textarea
                value={form.description}
                onChange={(event) => handleChange("description", event.target.value)}
                placeholder="Daily inventory records and automatic ranch calculations."
                rows={4}
                maxLength={500}
              />
              <small>{form.description.length}/500</small>
            </div>
          </label>

          <label>
            <span>Report title</span>
            <div className="fieldShell">
              <AppIcon name="report" />
              <input
                value={form.report_title}
                onChange={(event) => handleChange("report_title", event.target.value)}
                placeholder="Daily Goat Inventory Report"
              />
            </div>
          </label>

          <label>
            <span>Reporter name</span>
            <div className="fieldShell">
              <AppIcon name="user" />
              <input
                value={form.reporter_name}
                onChange={(event) => handleChange("reporter_name", event.target.value)}
                placeholder="Reporter name"
              />
            </div>
          </label>

          <label>
            <span>Company name</span>
            <div className="fieldShell">
              <AppIcon name="layers" />
              <input
                value={form.company_name}
                onChange={(event) => handleChange("company_name", event.target.value)}
                placeholder="Company name"
              />
            </div>
          </label>

          <label>
            <span>Access</span>
            <div className="fieldShell">
              <AppIcon name="lock" />
              <select value={form.access_type} onChange={(event) => handleChange("access_type", event.target.value)}>
                {ACCESS_TYPES.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
            </div>
          </label>

          <label className="wide">
            <span>Assigned user IDs</span>
            <div className="fieldShell">
              <AppIcon name="user" />
              <input
                value={form.assigned_user_ids}
                onChange={(event) => handleChange("assigned_user_ids", event.target.value)}
                placeholder="1, 2, 3"
              />
            </div>
            <small>Use comma-separated user IDs. Admin can still access all inventories.</small>
          </label>

          <div className="modalActions wide">
            <button type="button" className="ghostButton" onClick={onClose}>Cancel</button>
            <button type="submit" className="primaryButton" disabled={creating}>
              <AppIcon name="report" />
              <span>{creating ? "Creating..." : "Create Inventory"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


function ModuleRow({ inventory, tone = "green" }) {
  const status = inventoryStatus(inventory);
  const statusClass = cssEscapeStatus(status);
  const rows = inventoryRows(inventory);
  const title = inventory?.title || formatInventoryType(inventory?.inventory_type) || "Inventory Module";
  const subtitle = formatInventoryType(inventory?.inventory_type || inventory?.type || "inventory");
  const href = inventory?.id ? `/dynamic-inventory/${inventory.id}` : "#";

  const rowContent = (
    <>
      <span className={`moduleIcon ${tone}`}>
        <AppIcon name="inventory" />
      </span>
      <span className="moduleText">
        <h3>{title}</h3>
        <p>{subtitle}</p>
      </span>
      <span className={`statusPill ${statusClass}`}>{statusLabel(status)}</span>
      <small>{compactValue(rows)} rows</small>
    </>
  );

  if (!inventory?.id) {
    return <div className="moduleRow">{rowContent}</div>;
  }

  return (
    <Link href={href} className="moduleRow">
      {rowContent}
    </Link>
  );
}

function DepartmentCard({ department, inventories = [], onCreate, onViewDepartment }) {
  const departmentKey = String(department.department || department.value || department.key || "other").toLowerCase();
  const meta = normalizeDepartment(departmentKey);
  const totalRows = inventories.reduce((sum, item) => sum + inventoryRows(item), 0);
  const openAlerts = inventories.reduce((sum, item) => sum + inventoryAlerts(item), 0);
  const pending = inventories.reduce((sum, item) => sum + inventoryPending(item), 0);
  const displayAlerts = openAlerts || pending;
  const list = inventories.slice(0, 6);

  return (
    <section className={`departmentCard ${meta.tone}`}>
      <div className="departmentHeaderArt">
        <div className="departmentHeaderText">
          <div className={`departmentIcon ${meta.tone}`}>{meta.icon}</div>
          <div>
            <h2>{department.label || meta.title}</h2>
            <p>{department.description || meta.description}</p>
          </div>
        </div>
        <div className={`departmentVisual ${meta.tone}`}>
          <span>{meta.visual}</span>
        </div>
      </div>

      <div className="departmentStats">
        <div>
          <span>Modules</span>
          <strong>{compactValue(inventories.length)}</strong>
        </div>
        <div>
          <span>Rows Today</span>
          <strong>{compactValue(totalRows)}</strong>
        </div>
        <div>
          <span>Open Alerts</span>
          <strong>{compactValue(displayAlerts)}</strong>
        </div>
      </div>

      <div className="moduleHeader">
        <span>Module Records</span>
        <span>Rows</span>
      </div>

      {list.length ? (
        <div className="moduleList">
          {list.map((inventory) => (
            <ModuleRow key={inventory.id || inventory.title} inventory={inventory} tone={meta.tone} />
          ))}
        </div>
      ) : (
        <div className="miniEmpty">
          <p>No modules yet.</p>
          <button type="button" onClick={() => onCreate?.(department.department || department.value || department.key)}>
            Create one
          </button>
        </div>
      )}

      <button
        type="button"
        className={`viewModules ${meta.tone}`}
        onClick={() => {
          const key = department.department || department.value || department.key;
          if (list.length) onViewDepartment?.(key);
          else onCreate?.(key);
        }}
      >
        <span>{list.length ? "View all modules" : "Create module"}</span>
        <span>→</span>
      </button>
    </section>
  );
}

function DashboardInsights({ dashboard, totals }) {
  const data = safeObject(dashboard);
  const totalRowsAllTime =
    data.total_rows_all_time ??
    data.total_rows ??
    data.rows_all_time ??
    totals.rowsToday;
  const autoCalculations =
    data.auto_calculations_today ??
    data.auto_calculations ??
    data.calculations_today ??
    totals.modules * 4;
  const reportsGenerated =
    data.reports_generated_week ??
    data.reports_generated ??
    data.weekly_reports ??
    Math.max(0, totals.pending);

  return (
    <section className="insightsCard">
      <div className="sideCardTitle">
        <AppIcon name="leaf" />
        <h2>Dashboard Insights</h2>
      </div>

      <div className="insightList">
        <div className="insightItem green">
          <div className="insightIcon"><AppIcon name="clipboard" /></div>
          <div>
            <span>Total Rows (All Time)</span>
            <strong>{metricValue(totalRowsAllTime)}</strong>
          </div>
          <small>↑ 14%</small>
        </div>
        <div className="insightItem blue">
          <div className="insightIcon"><AppIcon name="settings" /></div>
          <div>
            <span>Auto Calculations</span>
            <strong>{metricValue(autoCalculations)}</strong>
          </div>
          <small>Today</small>
        </div>
        <div className="insightItem green">
          <div className="insightIcon"><AppIcon name="report" /></div>
          <div>
            <span>Reports Generated</span>
            <strong>{metricValue(reportsGenerated)}</strong>
          </div>
          <small>This week</small>
        </div>
      </div>

      <button type="button" className="fullReportsButton">
        <span>View full reports</span>
        <span>→</span>
      </button>
    </section>
  );
}

function ActivityIcon({ activity }) {
  const text = `${activity?.action || ""} ${activity?.description || ""} ${activity?.title || ""}`.toLowerCase();
  let tone = "green";
  let icon = "leaf";
  if (text.includes("animal") || text.includes("goat") || text.includes("vaccination")) {
    tone = "amber";
    icon = "animal";
  } else if (text.includes("fuel") || text.includes("repair") || text.includes("tractor") || text.includes("maintenance")) {
    tone = "blue";
    icon = "tractor";
  } else if (text.includes("report")) {
    tone = "purple";
    icon = "report";
  }
  return (
    <div className={`activityIcon ${tone}`}>
      <AppIcon name={icon} />
    </div>
  );
}

function RecentActivity({ dashboard, inventories }) {
  const dashboardActivity = safeArray(dashboard?.recent_activity);
  const fallbackActivity = safeArray(inventories).slice(0, 5).map((inventory, index) => ({
    id: inventory.id || index,
    title: `${inventory.title || "Inventory"} updated`,
    description: `${formatDepartmentName(inventory.department)} inventory count updated`,
    created_at: inventory.updated_at || inventory.created_at || new Date(Date.now() - (index + 1) * 15 * 60000).toISOString(),
    user_name: inventory.reporter_name || "Ranch Manager",
  }));
  const activity = dashboardActivity.length ? dashboardActivity.slice(0, 5) : fallbackActivity;

  if (!activity.length) return null;

  return (
    <section className="recentSideCard">
      <div className="recentHeader">
        <h2>Recent Activity</h2>
        <button type="button">View all</button>
      </div>

      <div className="recentList">
        {activity.map((item, index) => (
          <div key={item.id || index} className="recentItem">
            <ActivityIcon activity={item} />
            <div>
              <strong>{item.title || item.description || "Inventory updated"}</strong>
              <span>{item.description && item.title ? item.description : `by ${item.user_name || item.user || "Ranch Manager"}`}</span>
            </div>
            <small>{formatShortTime(item.created_at)}</small>
          </div>
        ))}
      </div>
    </section>
  );
}

function BottomActivity({ dashboard, inventories }) {
  const dashboardActivity = safeArray(dashboard?.recent_activity);
  const activity = dashboardActivity.length
    ? dashboardActivity.slice(0, 6)
    : safeArray(inventories).slice(0, 4).map((inventory, index) => ({
        id: inventory.id || index,
        action: inventoryStatus(inventory),
        description: `${inventory.title || "Inventory"} has been updated.`,
        title: inventory.title,
        created_at: inventory.updated_at || inventory.created_at || new Date(Date.now() - (index + 1) * 20 * 60000).toISOString(),
        department: inventory.department,
        user_name: inventory.reporter_name || "Ranch Manager",
      }));

  if (!activity.length) return null;

  return (
    <section className="bottomActivityCard">
      <div className="bottomActivityHeader">
        <h2>Recent Activity</h2>
        <button type="button">View all activity →</button>
      </div>
      <div className="bottomActivityList">
        {activity.slice(0, 4).map((item, index) => (
          <div key={item.id || index} className="bottomActivityRow">
            <ActivityIcon activity={item} />
            <strong>{item.description || item.title || "Inventory activity"}</strong>
            <span>{item.title || item.action || "Inventory"}</span>
            <small>{item.user_name || item.user || "Ranch Manager"}</small>
            <time>{formatDateTime(item.created_at)}</time>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function DynamicInventoryDashboard() {
  const [inventories, setInventories] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [activeSidebarKey, setActiveSidebarKey] = useState("dashboard");
  const [quickFilter, setQuickFilter] = useState("all");
  const [toast, setToast] = useState({ message: "", type: "info" });

  const showToast = (message, type = "info") => setToast({ message, type });

  const scrollToDashboard = () => {
    if (typeof window === "undefined") return;
    window.requestAnimationFrame(() => {
      document.getElementById("inventory-dashboard-content")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const scrollToActivity = () => {
    if (typeof window === "undefined") return;
    window.requestAnimationFrame(() => {
      document.getElementById("inventory-reports-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const handleSidebarNavigate = (key) => {
    setActiveSidebarKey(key);
    setSearch("");

    if (key === "dashboard" || key === "inventory") {
      setDepartmentFilter("all");
      setQuickFilter("all");
      scrollToDashboard();
      return;
    }

    if (key === "crops" || key === "animals" || key === "machinery") {
      setDepartmentFilter(key);
      setQuickFilter("all");
      scrollToDashboard();
      return;
    }

    if (key === "approvals") {
      setDepartmentFilter("all");
      setQuickFilter("approvals");
      scrollToDashboard();
      showToast("Showing modules that need approval or review.", "info");
      return;
    }

    if (key === "alerts") {
      setDepartmentFilter("all");
      setQuickFilter("alerts");
      scrollToDashboard();
      showToast("Showing modules with open alerts.", "warning");
      return;
    }

    if (key === "reports") {
      setDepartmentFilter("all");
      setQuickFilter("all");
      scrollToActivity();
      showToast("Reports and recent activity are shown below.", "success");
      return;
    }

    if (key === "settings") {
      setQuickFilter("all");
      showToast("Settings can be connected to your admin settings page when the route is ready.", "info");
    }
  };

  const handleViewDepartment = (department) => {
    const key = String(department || "all").toLowerCase();
    setDepartmentFilter(key);
    setQuickFilter("all");
    setActiveSidebarKey(key === "machineries" ? "machinery" : key);
    setSearch("");
    scrollToDashboard();
  };

  const loadAll = async () => {
    setLoading(true);
    try {
      const [departmentOptions, templateData, inventoryData, dashboardData] = await Promise.allSettled([
        DynamicInventoryService.getDepartmentOptions(),
        DynamicInventoryService.getTemplates(),
        DynamicInventoryService.listInventories(),
        DynamicInventoryService.getDashboard(),
      ]);

      if (departmentOptions.status === "fulfilled") setDepartments(safeArray(departmentOptions.value));
      if (templateData.status === "fulfilled") setTemplates(safeArray(templateData.value));
      if (inventoryData.status === "fulfilled") {
        const value = inventoryData.value;
        setInventories(safeArray(value?.items || value?.inventories || value));
      }
      if (dashboardData.status === "fulfilled") setDashboard(dashboardData.value);

      const rejected = [departmentOptions, templateData, inventoryData, dashboardData].find((item) => item.status === "rejected");
      if (rejected) showToast(rejected.reason?.message || "Some dashboard data could not load.", "warning");
    } catch (err) {
      showToast(err.message || "Unable to load ranch inventory dashboard.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const refreshTemplates = async (department) => {
    try {
      const data = await DynamicInventoryService.getTemplates(department && department !== "all" ? { department } : {});
      setTemplates(safeArray(data));
    } catch (err) {
      showToast(err.message || "Unable to refresh templates.", "error");
    }
  };

  const handleSeed = async () => {
    setSeeding(true);
    try {
      await DynamicInventoryService.seedDefaults();
      showToast("Default ranch templates and lookups are ready.", "success");
      await loadAll();
    } catch (err) {
      showToast(err.message || "Unable to seed defaults.", "error");
    } finally {
      setSeeding(false);
    }
  };

  const departmentList = useMemo(() => {
    if (departments.length) return departments;
    return DEFAULT_DEPARTMENTS;
  }, [departments]);

  const filteredInventories = useMemo(() => {
    const term = search.trim().toLowerCase();
    return safeArray(inventories).filter((item) => {
      const itemDepartment = String(item.department || "").toLowerCase();
      const departmentOk = departmentFilter === "all" || itemDepartment === String(departmentFilter).toLowerCase();
      const text = `${item.title || ""} ${item.description || ""} ${item.inventory_type || ""} ${item.department || ""}`.toLowerCase();
      const status = statusKey(inventoryStatus(item));
      const approvalOk = quickFilter !== "approvals" || inventoryPending(item) > 0 || ["pending", "pending_approval", "submitted", "review", "under_review"].some((value) => status.includes(value));
      const alertOk = quickFilter !== "alerts" || inventoryAlerts(item) > 0 || inventoryPending(item) > 0;
      return departmentOk && approvalOk && alertOk && (!term || text.includes(term));
    });
  }, [inventories, search, departmentFilter, quickFilter]);

  const grouped = useMemo(() => {
    const map = {};
    filteredInventories.forEach((inventory) => {
      const key = String(inventory.department || "other").toLowerCase();
      if (!map[key]) map[key] = [];
      map[key].push(inventory);
    });
    return map;
  }, [filteredInventories]);

  const totals = useMemo(() => {
    const list = safeArray(inventories);
    return {
      modules: list.length,
      rowsToday: list.reduce((sum, item) => sum + inventoryRows(item), 0),
      pending: list.reduce((sum, item) => sum + inventoryPending(item), 0),
      alerts: list.reduce((sum, item) => sum + inventoryAlerts(item), 0),
    };
  }, [inventories]);

  const visibleDepartments = useMemo(() => {
    return departmentList.filter((department) => {
      const key = department.department || department.value;
      return departmentFilter === "all" || String(key).toLowerCase() === String(departmentFilter).toLowerCase();
    });
  }, [departmentList, departmentFilter]);

  return (
    <>
      <Head>
        <title>Ranch Inventory | PrimeGate</title>
        <meta name="description" content="Ranch management inventory dashboard for crops, animals, and machineries." />
      </Head>

      <div className="appShell">
        <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: "", type: "info" })} />
        <Sidebar
          activeKey={activeSidebarKey}
          onNavigate={handleSidebarNavigate}
          onProfile={() => showToast("Ranch Manager profile menu is ready for account actions.", "info")}
        />

        <main className="mainShell">
          <section className="heroSection" style={{ "--hero-image": `url(${HERO_IMAGE_URL})` }}>
            <div className="heroCopy">
              <p className="eyebrow">Ranch Management</p>
              <h1>Dynamic Inventory System</h1>
              <p>
                Enter your daily inputs for crops, animals, and machinery modules.
                The system calculates totals, balances, summaries, and reports automatically.
              </p>
              <div className="heroActions">
                <button type="button" className="seedButton" onClick={handleSeed} disabled={seeding}>
                  <AppIcon name="seed" />
                  {seeding ? "Preparing..." : "Seed Defaults"}
                </button>
                <button type="button" className="createGhostButton" onClick={() => setCreateOpen(true)}>
                  <AppIcon name="plus" />
                  Create Inventory
                </button>
              </div>
            </div>
            <HeroIllustration />
          </section>

          <section className="metricGrid" aria-label="Inventory summary metrics">
            <MetricCard icon="layers" title="Modules" value={metricValue(totals.modules)} note="Across 3 Departments" tone="green" />
            <MetricCard icon="calendar" title="Rows Today" value={metricValue(totals.rowsToday)} note="+18% vs yesterday ↑" tone="green" />
            <MetricCard icon="clipboard" title="Pending Approvals" value={metricValue(totals.pending)} note="Require your review" tone="amber" />
            <MetricCard icon="alert" title="Open Alerts" value={metricValue(totals.alerts)} note="Needs attention" tone="red" />
          </section>

          <section id="inventory-dashboard-content" className="contentGrid">
            <div className="dashboardMain">
              <SectionToolbar
                search={search}
                setSearch={setSearch}
                departmentFilter={departmentFilter}
                setDepartmentFilter={(value) => {
                  setDepartmentFilter(value);
                  setQuickFilter("all");
                  setActiveSidebarKey(value === "all" ? "dashboard" : String(value).toLowerCase() === "machineries" ? "machinery" : String(value).toLowerCase());
                }}
                departmentList={departmentList}
                onRefresh={loadAll}
              />

              {loading ? (
                <LoadingBlock text="Loading ranch inventory modules..." />
              ) : inventories.length === 0 ? (
                <EmptyState
                  title="No inventory modules yet"
                  description="Seed the default ranch templates, then create your first department inventory module."
                  action={
                    <div className="emptyActions">
                      <button type="button" className="seedButton" onClick={handleSeed}>Seed Defaults</button>
                      <button type="button" className="modalPrimaryButton" onClick={() => setCreateOpen(true)}>Create Inventory</button>
                    </div>
                  }
                />
              ) : (
                <div className="departmentsGrid">
                  {visibleDepartments.map((department) => {
                    const key = String(department.department || department.value || "other").toLowerCase();
                    return (
                      <DepartmentCard
                        key={key}
                        department={department}
                        inventories={grouped[key] || []}
                        onCreate={(dept) => {
                          if (dept) handleViewDepartment(dept);
                          setCreateOpen(true);
                        }}
                        onViewDepartment={handleViewDepartment}
                      />
                    );
                  })}
                </div>
              )}
            </div>

            <aside className="rightRail">
              <DashboardInsights dashboard={dashboard} totals={totals} />
              <RecentActivity dashboard={dashboard} inventories={inventories} />
            </aside>
          </section>

          <div id="inventory-reports-section"><BottomActivity dashboard={dashboard} inventories={inventories} /></div>

          <div className="pageFootnote">
            <AppIcon name="leaf" />
            <span>All data is securely stored and calculated in real-time.</span>
          </div>
        </main>
      </div>

      <CreateInventoryModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(created) => {
          showToast(`${created?.title || "Inventory"} created successfully.`, "success");
          loadAll();
        }}
        departments={departmentList}
        templates={templates}
        onRefreshTemplates={refreshTemplates}
      />

      <style jsx global>{`
        html,
        body,
        #__next {
          min-height: 100%;
        }

        body {
          margin: 0;
          background: #fbfaf4;
          color: #132316;
          font-family: Helvetica, Arial, sans-serif;
        }

        * {
          box-sizing: border-box;
        }

        button,
        input,
        select,
        textarea {
          font-family: Helvetica, Arial, sans-serif;
        }

        button {
          border: 0;
          cursor: pointer;
        }

        button:disabled {
          cursor: not-allowed;
          opacity: 0.65;
        }

        .appShell {
          min-height: 100vh;
          display: grid;
          grid-template-columns: 232px minmax(0, 1fr);
          background:
            radial-gradient(circle at 85% 4%, rgba(246, 232, 190, 0.52), transparent 32%),
            linear-gradient(180deg, #fdfbf5 0%, #f8f6ee 100%);
        }

        .sidebar {
          position: sticky;
          top: 0;
          height: 100vh;
          overflow: hidden;
          padding: 28px 10px 14px;
          background:
            linear-gradient(180deg, rgba(76, 105, 51, 0.96) 0%, rgba(57, 83, 42, 0.98) 50%, rgba(37, 62, 34, 1) 100%);
          color: #fffef3;
          display: flex;
          flex-direction: column;
          box-shadow: 24px 0 54px rgba(54, 73, 39, 0.16);
        }

        .sidebar::before {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          background:
            radial-gradient(circle at 10% 5%, rgba(255, 255, 255, 0.18), transparent 28%),
            radial-gradient(circle at 70% 105%, rgba(255, 225, 150, 0.24), transparent 34%);
        }

        .brandBlock {
          border: 0;
          width: 100%;
          padding: 0;
          background: transparent;
          color: inherit;
          text-align: left;
          position: relative;
          z-index: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          min-height: 76px;
          margin-bottom: 22px;
        }

        .brandBlock strong {
          display: block;
          font-family: Georgia, "Times New Roman", serif;
          font-size: 24px;
          line-height: 0.95;
          letter-spacing: -0.03em;
        }

        .brandBlock span:not(.brandHill):not(.brandBarn):not(.brandSun) {
          display: block;
          margin-top: 6px;
          font-size: 11px;
          letter-spacing: 0.42em;
          font-weight: 800;
        }

        .brandMark {
          position: relative;
          width: 58px;
          height: 48px;
          flex: 0 0 auto;
        }

        .brandHill,
        .brandHill::after {
          position: absolute;
          content: "";
          left: 5px;
          bottom: 13px;
          width: 42px;
          height: 22px;
          border-left: 4px solid rgba(255,255,255,0.92);
          border-top: 4px solid rgba(255,255,255,0.92);
          transform: skewX(-24deg) rotate(4deg);
          border-radius: 2px;
        }

        .brandHill::after {
          left: 15px;
          bottom: -14px;
          width: 26px;
          height: 14px;
          border-width: 3px;
        }

        .brandBarn {
          position: absolute;
          left: 18px;
          bottom: 4px;
          width: 24px;
          height: 16px;
          border: 2px solid rgba(255,255,255,0.88);
          border-top: 0;
        }

        .brandBarn::before {
          content: "";
          position: absolute;
          left: 2px;
          top: -10px;
          width: 16px;
          height: 16px;
          border-left: 2px solid rgba(255,255,255,0.88);
          border-top: 2px solid rgba(255,255,255,0.88);
          transform: rotate(45deg);
        }

        .brandSun {
          position: absolute;
          right: 4px;
          top: 8px;
          width: 14px;
          height: 14px;
          background: rgba(255,255,255,0.9);
          border-radius: 50%;
          box-shadow: -10px 3px 0 -2px rgba(255,255,255,0.7);
        }

        .sideNav {
          position: relative;
          z-index: 1;
          display: grid;
          gap: 6px;
        }

        .sideItem {
          width: 100%;
          min-height: 48px;
          padding: 0 18px;
          border-radius: 12px;
          color: rgba(255,255,255,0.92);
          background: transparent;
          display: flex;
          align-items: center;
          gap: 13px;
          font-size: 14px;
          font-weight: 800;
          text-align: left;
          transition: background 0.18s ease, transform 0.18s ease;
        }

        .sideItem svg {
          width: 20px;
          height: 20px;
          flex: 0 0 auto;
        }

        .sideItem:hover,
        .sideItem.active {
          background: rgba(129, 159, 90, 0.62);
          transform: translateX(1px);
        }

        .sidebarFooter {
          position: relative;
          z-index: 1;
          margin-top: auto;
          display: grid;
          gap: 14px;
        }

        .profileMini {
          width: 100%;
          border-left: 0;
          border-right: 0;
          background: transparent;
          color: inherit;
          text-align: left;
          display: grid;
          grid-template-columns: 42px 1fr 16px;
          align-items: center;
          gap: 10px;
          padding: 12px 10px;
          border-top: 1px solid rgba(255,255,255,0.18);
          border-bottom: 1px solid rgba(255,255,255,0.14);
        }

        .profileAvatar,
        .userCircle {
          display: grid;
          place-items: center;
          border-radius: 50%;
          font-weight: 900;
        }

        .profileAvatar {
          width: 40px;
          height: 40px;
          background: linear-gradient(135deg, #f7e4bd, #fff8e3);
          color: #315b2e;
          box-shadow: 0 0 0 3px rgba(255,255,255,0.16);
        }

        .profileMini strong {
          display: block;
          font-size: 13px;
          line-height: 1.2;
        }

        .profileMini span {
          display: block;
          margin-top: 2px;
          font-size: 11px;
          color: rgba(255,255,255,0.75);
        }

        .profileMini svg {
          width: 14px;
          height: 14px;
          color: rgba(255,255,255,0.75);
        }

        .ranchNote {
          border: 0;
          width: 100%;
          text-align: left;
          cursor: pointer;
          min-height: 184px;
          position: relative;
          overflow: hidden;
          border-radius: 18px;
          padding: 18px 16px;
          color: #334320;
          background: linear-gradient(180deg, #fff2c7 0%, #d4c178 48%, #536e34 100%);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.55), 0 16px 34px rgba(20, 45, 22, 0.28);
        }

        .ranchNote p {
          position: relative;
          z-index: 2;
          margin: 0;
          font-family: Georgia, "Times New Roman", serif;
          font-size: 15px;
          line-height: 1.35;
        }

        .noteLandscape,
        .noteLandscape span {
          position: absolute;
          pointer-events: none;
        }

        .noteLandscape {
          inset: 0;
        }

        .noteSun {
          width: 42px;
          height: 42px;
          border-radius: 50%;
          background: rgba(249, 213, 122, 0.8);
          left: 16px;
          top: 83px;
        }

        .noteHill {
          left: -18px;
          right: -18px;
          height: 84px;
          border-radius: 50% 50% 0 0;
          background: rgba(248, 228, 164, 0.75);
        }

        .noteHill.one { bottom: 44px; }
        .noteHill.two { bottom: 24px; left: 36px; background: rgba(109, 133, 57, 0.62); }

        .noteBarn {
          width: 45px;
          height: 32px;
          left: 22px;
          bottom: 50px;
          background: rgba(88, 70, 38, 0.35);
          border-radius: 2px;
        }

        .noteBarn::before {
          content: "";
          position: absolute;
          left: 5px;
          top: -18px;
          width: 35px;
          height: 35px;
          background: rgba(88, 70, 38, 0.35);
          transform: rotate(45deg);
          border-radius: 2px;
        }

        .noteWindmill {
          width: 2px;
          height: 62px;
          right: 32px;
          bottom: 52px;
          background: rgba(61, 75, 39, 0.5);
        }

        .noteWindmill::before,
        .noteWindmill::after {
          content: "";
          position: absolute;
          top: -13px;
          left: 50%;
          width: 42px;
          height: 2px;
          background: rgba(61, 75, 39, 0.5);
          transform: translateX(-50%) rotate(35deg);
          transform-origin: center;
        }

        .noteWindmill::after {
          transform: translateX(-50%) rotate(-55deg);
        }

        .noteGrass {
          left: -5px;
          right: -5px;
          bottom: -20px;
          height: 78px;
          background:
            repeating-linear-gradient(80deg, transparent 0 8px, rgba(26, 69, 35, 0.55) 9px 11px, transparent 12px 20px),
            linear-gradient(180deg, rgba(74, 109, 46, 0.12), rgba(31, 68, 35, 0.95));
        }

        .mainShell {
          min-width: 0;
          padding: 0 28px 26px;
        }

        .topBar {
          min-height: 70px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          color: #18381c;
        }

        .topTitle {
          font-size: 15px;
          color: #1e7a35;
          font-weight: 900;
        }

        .topActions {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .topIcon {
          position: relative;
          width: 38px;
          height: 38px;
          display: grid;
          place-items: center;
          border-radius: 50%;
          color: #152416;
          background: transparent;
        }

        .topIcon svg {
          width: 21px;
          height: 21px;
        }

        .notificationDot {
          position: absolute;
          right: 4px;
          top: 3px;
          min-width: 17px;
          height: 17px;
          padding: 0 4px;
          display: grid;
          place-items: center;
          border-radius: 999px;
          background: #2eae56;
          color: white;
          font-size: 10px;
          font-weight: 900;
          box-shadow: 0 0 0 2px #fbfaf4;
        }

        .userButton {
          min-height: 44px;
          display: flex;
          align-items: center;
          gap: 9px;
          padding: 6px 12px 6px 8px;
          border: 1px solid rgba(67, 76, 45, 0.14);
          border-radius: 14px;
          background: rgba(255,255,255,0.75);
          color: #1d2a1e;
          font-weight: 800;
          box-shadow: 0 8px 22px rgba(52, 67, 36, 0.08);
        }

        .userButton svg {
          width: 14px;
          height: 14px;
          color: #6f765d;
        }

        .userCircle {
          width: 30px;
          height: 30px;
          background: #e7e3d0;
          color: #6e7054;
          font-size: 12px;
        }

        .heroSection {
          position: relative;
          overflow: hidden;
          min-height: 148px;
          display: grid;
          grid-template-columns: minmax(0, 0.98fr) minmax(360px, 1.02fr);
          align-items: stretch;
          padding: 18px 28px 18px;
          border-radius: 26px;
          background:
            linear-gradient(90deg, rgba(253, 251, 242, 0.98) 0%, rgba(255, 250, 235, 0.78) 44%, rgba(240, 233, 194, 0.54) 100%),
            radial-gradient(circle at 72% 18%, rgba(249, 227, 167, 0.36), transparent 26%);
        }

        .heroSection::after {
          content: "";
          position: absolute;
          inset: auto 0 0 0;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(83, 98, 55, 0.13), transparent);
        }

        .heroCopy {
          position: relative;
          z-index: 2;
          align-self: center;
        }

        .eyebrow {
          margin: 0 0 7px;
          color: #1b8638;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          font-size: 11px;
          font-weight: 900;
        }

        .heroCopy h1,
        .modalHeader h2,
        .departmentCard h2,
        .insightsCard h2,
        .recentSideCard h2,
        .bottomActivityCard h2,
        .emptyState h3 {
          font-family: Georgia, "Times New Roman", serif;
        }

        .heroCopy h1 {
          margin: 0;
          font-size: clamp(30px, 3vw, 42px);
          line-height: 0.98;
          letter-spacing: -0.055em;
          color: #1b271c;
          max-width: 610px;
        }

        .heroCopy p:not(.eyebrow) {
          max-width: 560px;
          margin: 9px 0 0;
          color: #52604f;
          line-height: 1.45;
          font-size: 14px;
        }

        .heroActions {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          margin-top: 15px;
        }

        .seedButton,
        .createGhostButton,
        .refreshButton,
        .cancelButton,
        .modalPrimaryButton,
        .fullReportsButton {
          min-height: 42px;
          border-radius: 10px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 9px;
          padding: 0 18px;
          font-weight: 900;
          transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
          white-space: nowrap;
        }

        .seedButton {
          color: white;
          background: linear-gradient(180deg, #3d8d42 0%, #2d7232 100%);
          box-shadow: 0 13px 25px rgba(44, 112, 49, 0.28), inset 0 1px 0 rgba(255,255,255,0.18);
        }

        .createGhostButton,
        .refreshButton,
        .cancelButton {
          color: #263226;
          background: rgba(255,255,255,0.84);
          border: 1px solid rgba(45, 68, 37, 0.18);
          box-shadow: 0 10px 24px rgba(76, 70, 43, 0.08);
        }

        .seedButton:hover,
        .createGhostButton:hover,
        .refreshButton:hover,
        .cancelButton:hover,
        .modalPrimaryButton:hover,
        .fullReportsButton:hover {
          transform: translateY(-1px);
        }

        .heroActions svg,
        .refreshButton svg,
        .modalPrimaryButton svg {
          width: 17px;
          height: 17px;
        }

        .heroIllustration {
          position: absolute;
          right: 0;
          top: 0;
          bottom: 0;
          width: 57%;
          overflow: hidden;
          pointer-events: none;
        }

        .heroIllustration span {
          position: absolute;
          display: block;
        }

        .heroCloud {
          border-radius: 999px;
          background: rgba(248, 224, 166, 0.5);
        }

        .heroCloud::before,
        .heroCloud::after {
          content: "";
          position: absolute;
          border-radius: 50%;
          background: inherit;
        }

        .cloudOne {
          width: 120px;
          height: 36px;
          right: 330px;
          top: 26px;
        }

        .cloudOne::before {
          width: 44px;
          height: 44px;
          left: 18px;
          top: -22px;
        }

        .cloudOne::after {
          width: 62px;
          height: 62px;
          left: 50px;
          top: -34px;
        }

        .cloudTwo {
          width: 80px;
          height: 26px;
          right: 142px;
          top: 72px;
          opacity: 0.4;
        }

        .cloudTwo::before {
          width: 32px;
          height: 32px;
          left: 12px;
          top: -16px;
        }

        .cloudTwo::after {
          width: 44px;
          height: 44px;
          left: 34px;
          top: -24px;
        }

        .heroHill {
          left: 40px;
          right: -80px;
          height: 126px;
          border-radius: 50% 50% 0 0;
        }

        .hillBack {
          bottom: 26px;
          background: rgba(179, 189, 128, 0.32);
        }

        .hillFront {
          bottom: -2px;
          left: -20px;
          background: rgba(153, 170, 100, 0.28);
        }

        .heroField {
          left: 0;
          right: -10px;
          height: 112px;
          bottom: -34px;
          background: repeating-linear-gradient(164deg, rgba(117, 143, 73, 0.24) 0 10px, rgba(250, 237, 192, 0.16) 11px 22px);
          transform: skewY(-4deg);
        }

        .fieldTwo {
          bottom: -50px;
          height: 88px;
          opacity: 0.55;
          transform: skewY(5deg);
        }

        .heroBarn {
          width: 92px;
          height: 56px;
          right: 250px;
          bottom: 78px;
          background: rgba(92, 82, 60, 0.37);
          border-radius: 4px;
          box-shadow: inset 0 0 0 2px rgba(87, 74, 50, 0.12);
        }

        .barnRoof {
          width: 76px;
          height: 76px;
          left: 8px;
          top: -38px;
          transform: rotate(45deg);
          border-radius: 5px;
          background: rgba(82, 76, 58, 0.28);
        }

        .barnDoor {
          width: 22px;
          height: 32px;
          left: 35px;
          bottom: 0;
          background: rgba(63, 56, 44, 0.28);
          border-radius: 10px 10px 0 0;
        }

        .heroSilo {
          width: 26px;
          height: 82px;
          right: 222px;
          bottom: 78px;
          border-radius: 14px 14px 2px 2px;
          background: linear-gradient(90deg, rgba(92, 96, 78, 0.18), rgba(92, 96, 78, 0.32));
        }

        .heroWindmill {
          width: 2px;
          height: 96px;
          right: 102px;
          bottom: 42px;
          background: rgba(88, 98, 61, 0.32);
        }

        .windBlade {
          top: 0;
          left: 1px;
          width: 56px;
          height: 2px;
          background: rgba(88, 98, 61, 0.28);
          transform-origin: 0 1px;
        }

        .windBlade.one { transform: rotate(0deg); }
        .windBlade.two { transform: rotate(90deg); }
        .windBlade.three { transform: rotate(180deg); }
        .windBlade.four { transform: rotate(270deg); }

        .heroPlant {
          right: -18px;
          bottom: 10px;
          width: 142px;
          height: 170px;
          background:
            radial-gradient(ellipse at 20% 82%, rgba(74, 99, 53, 0.24) 0 15px, transparent 16px),
            radial-gradient(ellipse at 48% 70%, rgba(74, 99, 53, 0.22) 0 13px, transparent 14px),
            radial-gradient(ellipse at 70% 55%, rgba(74, 99, 53, 0.18) 0 10px, transparent 11px);
        }

        .metricGrid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 16px;
          margin-top: 14px;
          margin-bottom: 18px;
          position: relative;
          z-index: 2;
        }

        .metricCard {
          min-height: 92px;
          display: grid;
          grid-template-columns: 58px minmax(0, 1fr);
          align-items: center;
          gap: 14px;
          padding: 14px 16px;
          border-radius: 18px;
          background: rgba(255,255,255,0.9);
          border: 1px solid rgba(62, 74, 48, 0.09);
          box-shadow: 0 16px 36px rgba(69, 70, 49, 0.11);
        }

        .metricIcon {
          width: 52px;
          height: 52px;
          display: grid;
          place-items: center;
          border-radius: 50%;
          color: #2e8f44;
          background: #e7f4de;
        }

        .metricIcon svg {
          width: 27px;
          height: 27px;
        }

        .metricCard.amber .metricIcon { color: #c78014; background: #f9edd9; }
        .metricCard.red .metricIcon { color: #d62626; background: #fae1de; }
        .metricCard.blue .metricIcon { color: #2468c9; background: #e3edfb; }

        .metricCard span {
          display: block;
          color: #3b4537;
          font-size: 14px;
          font-weight: 500;
        }

        .metricCard strong {
          display: block;
          margin-top: 5px;
          font-size: 27px;
          line-height: 1;
          letter-spacing: -0.045em;
          color: #172219;
        }

        .metricCard small {
          display: block;
          margin-top: 8px;
          color: #2c9345;
          font-size: 12px;
          font-weight: 800;
        }

        .metricCard.amber small { color: #c27812; }
        .metricCard.red small { color: #d62626; }

        .contentGrid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 310px;
          gap: 18px;
          align-items: start;
        }

        .dashboardMain {
          min-width: 0;
        }

        .toolbarPanel {
          min-height: 58px;
          display: grid;
          grid-template-columns: minmax(280px, 1fr) 230px auto;
          align-items: center;
          gap: 14px;
          padding: 10px 12px;
          margin-bottom: 14px;
          border-radius: 22px;
          background: rgba(255,255,255,0.86);
          border: 1px solid rgba(55, 71, 44, 0.1);
          box-shadow: 0 14px 34px rgba(74, 77, 54, 0.08);
        }

        .searchBox,
        .selectWrap {
          min-height: 44px;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 0 13px;
          border: 1px solid rgba(51, 68, 42, 0.14);
          border-radius: 12px;
          background: rgba(255,255,255,0.8);
          color: #6e7867;
        }

        .searchBox svg,
        .selectWrap svg {
          width: 18px;
          height: 18px;
          flex: 0 0 auto;
        }

        .searchBox input,
        .selectWrap select {
          min-width: 0;
          width: 100%;
          border: 0;
          outline: none;
          background: transparent;
          color: #233024;
          font-size: 14px;
        }

        .searchBox input::placeholder {
          color: #929a8a;
        }

        .selectWrap {
          position: relative;
        }

        .selectWrap select {
          appearance: none;
          font-weight: 800;
          color: #28342a;
          cursor: pointer;
        }

        .selectWrap svg:last-child {
          width: 14px;
          height: 14px;
          color: #6c7463;
        }

        .refreshButton {
          height: 44px;
          border-radius: 12px;
        }

        .departmentsGrid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 14px;
          align-items: start;
        }

        .departmentCard {
          min-width: 0;
          min-height: 0;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          border-radius: 21px;
          background: rgba(255,255,255,0.92);
          border: 1px solid rgba(58, 77, 49, 0.1);
          box-shadow: 0 14px 36px rgba(70, 72, 48, 0.1);
        }

        .departmentCard.green { border-top: 3px solid #258f3c; }
        .departmentCard.amber { border-top: 3px solid #d88813; }
        .departmentCard.blue { border-top: 3px solid #2d6fd5; }

        .departmentHeaderArt {
          position: relative;
          min-height: 128px;
          overflow: hidden;
          padding: 18px 16px 14px;
          background:
            linear-gradient(135deg, rgba(255,255,255,0.95), rgba(245,250,240,0.82)),
            radial-gradient(circle at 84% 34%, rgba(56, 150, 65, 0.2), transparent 35%);
        }

        .departmentCard.amber .departmentHeaderArt {
          background:
            linear-gradient(135deg, rgba(255,255,255,0.95), rgba(255,247,232,0.86)),
            radial-gradient(circle at 84% 34%, rgba(218, 151, 40, 0.23), transparent 35%);
        }

        .departmentCard.blue .departmentHeaderArt {
          background:
            linear-gradient(135deg, rgba(255,255,255,0.95), rgba(239,247,255,0.9)),
            radial-gradient(circle at 84% 34%, rgba(44, 112, 213, 0.2), transparent 35%);
        }

        .departmentHeaderArt::after {
          content: "";
          position: absolute;
          right: -20px;
          bottom: 0;
          width: 58%;
          height: 95%;
          opacity: 0.5;
          background:
            repeating-linear-gradient(110deg, transparent 0 11px, rgba(81, 117, 57, 0.14) 12px 14px, transparent 15px 27px),
            radial-gradient(ellipse at center, rgba(76, 137, 55, 0.18), transparent 60%);
          clip-path: ellipse(70% 56% at 66% 70%);
        }

        .departmentCard.amber .departmentHeaderArt::after {
          background:
            repeating-linear-gradient(110deg, transparent 0 12px, rgba(173, 115, 29, 0.14) 13px 15px, transparent 16px 27px),
            radial-gradient(ellipse at center, rgba(211, 144, 40, 0.14), transparent 60%);
        }

        .departmentCard.blue .departmentHeaderArt::after {
          background:
            repeating-linear-gradient(110deg, transparent 0 12px, rgba(38, 103, 181, 0.13) 13px 15px, transparent 16px 27px),
            radial-gradient(ellipse at center, rgba(38, 103, 181, 0.13), transparent 60%);
        }

        .departmentHeaderText {
          position: relative;
          z-index: 2;
          display: grid;
          grid-template-columns: 48px minmax(0, 1fr);
          gap: 12px;
          align-items: start;
        }

        .departmentIcon {
          width: 46px;
          height: 46px;
          display: grid;
          place-items: center;
          border-radius: 50%;
          font-size: 22px;
          color: white;
          box-shadow: 0 12px 22px rgba(51, 90, 38, 0.2);
        }

        .departmentIcon.green { background: linear-gradient(180deg, #3e9c47, #257b34); }
        .departmentIcon.amber { background: linear-gradient(180deg, #dc981d, #b97408); }
        .departmentIcon.blue { background: linear-gradient(180deg, #3376d7, #2158ad); }
        .departmentIcon.gray { background: linear-gradient(180deg, #687069, #4d554e); }

        .departmentHeaderText h2 {
          margin: 0;
          max-width: 230px;
          color: #22311f;
          font-size: 23px;
          line-height: 0.98;
          letter-spacing: -0.04em;
        }

        .departmentCard.amber .departmentHeaderText h2 { color: #774404; }
        .departmentCard.blue .departmentHeaderText h2 { color: #174279; }

        .departmentHeaderText p {
          max-width: 270px;
          margin: 8px 0 0;
          color: #4f5d4a;
          font-size: 12px;
          line-height: 1.35;
        }

        .departmentVisual {
          position: absolute;
          z-index: 1;
          right: 0;
          top: 8px;
          width: 110px;
          height: 110px;
          display: grid;
          place-items: center;
          color: rgba(33, 88, 32, 0.24);
          font-size: 72px;
          transform: rotate(-5deg);
        }

        .departmentVisual.amber {
          color: rgba(180, 112, 16, 0.34);
          font-size: 80px;
        }

        .departmentVisual.blue {
          color: rgba(29, 86, 160, 0.3);
          font-size: 76px;
        }

        .departmentStats {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          margin: 0 14px;
          transform: translateY(-8px);
          overflow: hidden;
          border: 1px solid rgba(52, 70, 42, 0.1);
          border-radius: 13px;
          background: rgba(255,255,255,0.78);
          box-shadow: 0 10px 22px rgba(68, 70, 50, 0.07);
        }

        .departmentStats div {
          min-height: 52px;
          display: flex;
          flex-direction: column-reverse;
          align-items: center;
          justify-content: center;
          gap: 4px;
          border-right: 1px solid rgba(52, 70, 42, 0.1);
        }

        .departmentStats div:last-child {
          border-right: 0;
        }

        .departmentStats span {
          color: #5b6656;
          font-size: 10px;
          font-weight: 800;
        }

        .departmentStats strong {
          color: #111e14;
          font-size: 18px;
          line-height: 1;
          letter-spacing: -0.03em;
        }

        .departmentStats div:last-child strong {
          color: #d62222;
        }

        .moduleHeader {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin: 0 18px 7px;
          color: #263425;
          font-size: 12px;
          font-weight: 900;
        }

        .moduleList {
          flex: 0 0 auto;
          min-height: 0;
          display: grid;
          align-content: start;
          gap: 0;
          margin: 0 18px;
          overflow: auto;
          scrollbar-width: thin;
          scrollbar-color: rgba(45, 79, 42, 0.25) transparent;
        }

        .moduleList::-webkit-scrollbar {
          width: 5px;
        }

        .moduleList::-webkit-scrollbar-thumb {
          background: rgba(45, 79, 42, 0.25);
          border-radius: 999px;
        }

        .moduleRow {
          min-width: 0;
          display: grid;
          grid-template-columns: 28px minmax(0, 1fr) auto 46px;
          gap: 8px;
          align-items: center;
          min-height: 44px;
          border-bottom: 1px solid rgba(57, 72, 46, 0.1);
          color: inherit;
          text-decoration: none;
        }

        .moduleRow:hover .moduleText h3 {
          color: #1c7b36;
        }

        .moduleIcon {
          width: 24px;
          height: 24px;
          display: grid;
          place-items: center;
          border-radius: 7px;
          color: white;
        }

        .moduleIcon svg {
          width: 14px;
          height: 14px;
        }

        .moduleIcon.green { background: #2f9846; }
        .moduleIcon.amber { background: #d18415; }
        .moduleIcon.blue { background: #2a6fd3; }
        .moduleIcon.gray { background: #67716b; }

        .moduleText {
          min-width: 0;
        }

        .moduleText h3 {
          margin: 0;
          color: #223022;
          font-size: 12px;
          font-weight: 900;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          transition: color 0.18s ease;
        }

        .moduleText p {
          margin: 2px 0 0;
          color: #6d756a;
          font-size: 10px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .statusPill {
          justify-self: end;
          display: inline-flex;
          align-items: center;
          min-height: 21px;
          border-radius: 999px;
          padding: 0 9px;
          background: #eff1ec;
          color: #53604f;
          font-size: 10px;
          font-weight: 900;
        }

        .statusPill.active,
        .statusPill.approved,
        .statusPill.completed,
        .statusPill.success {
          background: #e0f1db;
          color: #2b7a36;
        }

        .statusPill.submitted,
        .statusPill.in_review,
        .statusPill.review {
          background: #e2edf9;
          color: #2763b6;
        }

        .statusPill.pending,
        .statusPill.pending_approval,
        .statusPill.draft {
          background: #fff1d8;
          color: #c27a13;
        }

        .statusPill.rejected,
        .statusPill.failed,
        .statusPill.open,
        .statusPill.alert {
          background: #fde3df;
          color: #b91f1f;
        }

        .moduleRow small {
          justify-self: end;
          color: #596553;
          font-size: 11px;
          font-weight: 800;
          white-space: nowrap;
        }

        .miniEmpty {
          margin: 0 18px;
          padding: 18px 14px;
          display: grid;
          gap: 12px;
          place-items: center;
          text-align: center;
          border: 1px dashed rgba(71, 88, 61, 0.22);
          border-radius: 14px;
          color: #6b755f;
        }

        .miniEmpty p {
          margin: 0;
          font-size: 13px;
          font-weight: 700;
        }

        .miniEmpty button {
          min-height: 34px;
          padding: 0 12px;
          border-radius: 9px;
          background: #eff7eb;
          color: #247436;
          font-weight: 900;
        }

        .viewModules {
          min-height: 42px;
          margin: 4px 18px 8px;
          padding: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          background: transparent;
          font-size: 13px;
          font-weight: 900;
        }

        .viewModules.green { color: #2b8738; }
        .viewModules.amber { color: #cc7f12; }
        .viewModules.blue { color: #2669c7; }
        .viewModules.gray { color: #596358; }

        .rightRail {
          display: grid;
          gap: 14px;
        }

        .insightsCard,
        .recentSideCard,
        .bottomActivityCard,
        .loadingBlock,
        .emptyState {
          border-radius: 21px;
          background: rgba(255,255,255,0.88);
          border: 1px solid rgba(61, 75, 46, 0.1);
          box-shadow: 0 14px 36px rgba(70, 72, 48, 0.1);
        }

        .insightsCard {
          padding: 14px;
          background: linear-gradient(180deg, rgba(243, 246, 230, 0.9), rgba(255,255,255,0.92));
        }

        .sideCardTitle,
        .recentHeader,
        .bottomActivityHeader {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .sideCardTitle {
          justify-content: flex-start;
          gap: 8px;
          padding: 2px 2px 12px;
        }

        .sideCardTitle svg {
          width: 18px;
          height: 18px;
          color: #3d8c3a;
        }

        .sideCardTitle h2,
        .recentHeader h2,
        .bottomActivityHeader h2 {
          margin: 0;
          color: #243321;
          font-size: 17px;
          letter-spacing: -0.02em;
        }

        .insightList {
          display: grid;
          gap: 8px;
        }

        .insightItem {
          display: grid;
          grid-template-columns: 46px minmax(0, 1fr) auto;
          align-items: center;
          gap: 10px;
          min-height: 72px;
          padding: 10px;
          border-radius: 14px;
          background: rgba(255,255,255,0.82);
          border: 1px solid rgba(61, 75, 46, 0.08);
        }

        .insightIcon {
          width: 42px;
          height: 42px;
          display: grid;
          place-items: center;
          border-radius: 50%;
          color: #2e8e42;
          background: #e3f0da;
        }

        .insightItem.blue .insightIcon {
          color: #2b69c8;
          background: #e2edf9;
        }

        .insightIcon svg {
          width: 21px;
          height: 21px;
        }

        .insightItem span {
          display: block;
          color: #697266;
          font-size: 12px;
          font-weight: 800;
        }

        .insightItem strong {
          display: block;
          margin-top: 5px;
          color: #1c281b;
          font-size: 21px;
          line-height: 1;
          letter-spacing: -0.035em;
        }

        .insightItem small {
          color: #2d913e;
          font-size: 11px;
          font-weight: 900;
        }

        .fullReportsButton {
          width: 100%;
          margin-top: 9px;
          color: #2d7f36;
          background: rgba(232, 242, 225, 0.65);
          box-shadow: none;
          min-height: 38px;
        }

        .recentSideCard {
          padding: 14px;
        }

        .recentHeader {
          margin-bottom: 12px;
        }

        .recentHeader button,
        .bottomActivityHeader button {
          background: transparent;
          color: #2f8737;
          font-size: 12px;
          font-weight: 900;
        }

        .recentList {
          display: grid;
          gap: 8px;
        }

        .recentItem {
          display: grid;
          grid-template-columns: 36px minmax(0, 1fr) auto;
          align-items: center;
          gap: 9px;
          min-height: 58px;
          padding: 7px;
          border-radius: 13px;
          background: #fff;
          border: 1px solid rgba(67, 82, 52, 0.07);
        }

        .activityIcon {
          width: 34px;
          height: 34px;
          display: grid;
          place-items: center;
          border-radius: 50%;
        }

        .activityIcon svg {
          width: 17px;
          height: 17px;
        }

        .activityIcon.green { color: #2a8a37; background: #e3f1dc; }
        .activityIcon.amber { color: #c87b13; background: #fff0d8; }
        .activityIcon.blue { color: #2869c5; background: #e4edf9; }
        .activityIcon.purple { color: #7b51d7; background: #eee7fc; }

        .recentItem strong {
          display: block;
          color: #253022;
          font-size: 12px;
          line-height: 1.2;
        }

        .recentItem span {
          display: block;
          margin-top: 3px;
          color: #728069;
          font-size: 10px;
          line-height: 1.2;
        }

        .recentItem small {
          color: #498348;
          font-size: 10px;
          font-weight: 800;
          white-space: nowrap;
        }

        .bottomActivityCard {
          margin-top: 18px;
          padding: 18px;
        }

        .bottomActivityHeader {
          margin-bottom: 12px;
        }

        .bottomActivityList {
          display: grid;
        }

        .bottomActivityRow {
          min-height: 48px;
          display: grid;
          grid-template-columns: 38px minmax(0, 1fr) 180px 150px 160px;
          align-items: center;
          gap: 12px;
          border-top: 1px solid rgba(67, 82, 52, 0.09);
        }

        .bottomActivityRow strong {
          min-width: 0;
          color: #2c3529;
          font-size: 13px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .bottomActivityRow span {
          justify-self: start;
          max-width: 100%;
          padding: 5px 10px;
          border-radius: 999px;
          background: #edf5e8;
          color: #2e8138;
          font-size: 11px;
          font-weight: 900;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .bottomActivityRow small,
        .bottomActivityRow time {
          color: #677160;
          font-size: 12px;
          white-space: nowrap;
        }

        .pageFootnote {
          min-height: 48px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          color: #8a927f;
          font-size: 12px;
          font-weight: 700;
        }

        .pageFootnote svg {
          width: 16px;
          height: 16px;
        }

        .loadingBlock {
          min-height: 320px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          color: #6b755e;
          font-weight: 900;
        }

        .spinner {
          width: 24px;
          height: 24px;
          border: 3px solid #e3eadb;
          border-top-color: #2f8738;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .emptyState {
          min-height: 430px;
          display: grid;
          place-items: center;
          text-align: center;
          padding: 42px;
        }

        .emptyIllustration {
          width: 92px;
          height: 92px;
          display: grid;
          place-items: center;
          border-radius: 50%;
          background: #e6f1dc;
          color: #2e8d40;
          font-size: 38px;
        }

        .emptyState h3 {
          margin: 18px 0 8px;
          color: #22311f;
          font-size: 28px;
          letter-spacing: -0.03em;
        }

        .emptyState p {
          max-width: 520px;
          margin: 0 auto 20px;
          color: #6a7564;
          line-height: 1.55;
        }

        .emptyActions {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
        }

        .toast {
          position: fixed;
          top: 22px;
          right: 22px;
          z-index: 120;
          max-width: 420px;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 13px 14px;
          border-radius: 14px;
          background: #24321f;
          color: white;
          box-shadow: 0 22px 44px rgba(35, 47, 31, 0.28);
          font-weight: 800;
        }

        .toast-success { background: #237a34; }
        .toast-error { background: #a42424; }
        .toast-warning { background: #9a6418; }

        .toast button {
          width: 26px;
          height: 26px;
          display: grid;
          place-items: center;
          border-radius: 50%;
          background: rgba(255,255,255,0.16);
          color: white;
          font-size: 18px;
          line-height: 1;
        }

        .modalOverlay {
          position: fixed;
          inset: 0;
          z-index: 100;
          display: grid;
          place-items: center;
          padding: 22px;
          background: rgba(25, 36, 24, 0.48);
          backdrop-filter: blur(6px);
        }

        .modalCard {
          width: min(760px, 100%);
          max-height: calc(100vh - 44px);
          overflow: auto;
          border-radius: 20px;
          background: #fff;
          border: 1px solid rgba(67, 82, 52, 0.14);
          box-shadow: 0 34px 90px rgba(31, 42, 29, 0.3);
        }

        .createModal {
          padding: 28px 34px 0;
        }

        .modalHeader {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 22px;
        }

        .modalHeader h2 {
          margin: 0;
          color: #1f2a1c;
          font-size: 25px;
          line-height: 1;
          letter-spacing: -0.025em;
        }

        .iconButton {
          width: 36px;
          height: 36px;
          display: grid;
          place-items: center;
          border-radius: 50%;
          background: transparent;
          color: #596556;
          font-size: 28px;
          line-height: 1;
        }

        .formGrid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 16px 20px;
        }

        .formGrid label {
          display: grid;
          gap: 7px;
          color: #334131;
          font-size: 12px;
          font-weight: 900;
        }

        .wide {
          grid-column: 1 / -1;
        }

        .fieldShell,
        .textareaShell {
          min-height: 46px;
          display: flex;
          align-items: center;
          gap: 10px;
          border: 1px solid rgba(51, 68, 42, 0.16);
          border-radius: 10px;
          background: #fff;
          color: #728069;
        }

        .fieldShell {
          padding: 0 13px;
        }

        .fieldShell svg {
          width: 18px;
          height: 18px;
          flex: 0 0 auto;
          color: #2e8d44;
        }

        .fieldShell input,
        .fieldShell select,
        .textareaShell textarea {
          width: 100%;
          min-width: 0;
          border: 0;
          outline: none;
          background: transparent;
          color: #263425;
          font-size: 13px;
        }

        .fieldShell select {
          cursor: pointer;
        }

        .textareaShell {
          min-height: 108px;
          align-items: stretch;
          position: relative;
          padding: 12px 13px 26px;
        }

        .textareaShell textarea {
          resize: vertical;
          min-height: 72px;
          line-height: 1.45;
        }

        .textareaShell small {
          position: absolute;
          right: 12px;
          bottom: 8px;
          color: #9aa393;
          font-size: 11px;
          font-weight: 800;
        }

        .formGrid label > small {
          color: #778270;
          font-size: 11px;
          font-weight: 700;
        }

        .formError {
          grid-column: 1 / -1;
          padding: 12px 14px;
          border-radius: 12px;
          background: #fde3df;
          color: #ad2020;
          font-weight: 900;
        }

        .modalActions {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          margin: 14px -34px 0;
          padding: 18px 34px;
          border-top: 1px solid rgba(51, 68, 42, 0.1);
          background: #fbfbf7;
        }

        .modalPrimaryButton {
          color: white;
          background: linear-gradient(180deg, #2f9b4a 0%, #217a36 100%);
          box-shadow: 0 13px 25px rgba(42, 132, 59, 0.25);
        }

        @media (max-width: 1360px) {
          .appShell {
            grid-template-columns: 210px minmax(0, 1fr);
          }

          .contentGrid {
            grid-template-columns: minmax(0, 1fr);
          }

          .rightRail {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }



        /* Final compact adjustments: keeps the selected reference style but removes excess height/blank space. */
        .heroSection {
          min-height: 132px !important;
          padding: 15px 26px !important;
          border-radius: 24px !important;
          grid-template-columns: minmax(0, 1fr) minmax(320px, 0.88fr) !important;
        }

        .heroCopy h1 {
          font-size: clamp(28px, 2.7vw, 38px) !important;
          line-height: 0.98 !important;
        }

        .heroCopy p:not(.eyebrow) {
          max-width: 520px !important;
          margin-top: 8px !important;
          font-size: 13px !important;
          line-height: 1.42 !important;
        }

        .heroActions {
          margin-top: 12px !important;
          gap: 10px !important;
        }

        .seedButton,
        .createGhostButton {
          min-height: 38px !important;
          padding: 0 16px !important;
          border-radius: 10px !important;
        }

        .heroIllustration {
          width: 52% !important;
          transform: scale(0.86) !important;
          transform-origin: right center !important;
        }

        .metricGrid {
          margin-top: 12px !important;
          margin-bottom: 16px !important;
          gap: 14px !important;
        }

        .metricCard {
          min-height: 86px !important;
          grid-template-columns: 52px minmax(0, 1fr) !important;
          gap: 12px !important;
          padding: 12px 14px !important;
        }

        .metricIcon {
          width: 48px !important;
          height: 48px !important;
        }

        .metricCard strong {
          font-size: 25px !important;
          margin-top: 4px !important;
        }

        .metricCard small {
          margin-top: 5px !important;
        }

        .toolbarPanel {
          min-height: 54px !important;
          padding: 9px 11px !important;
          margin-bottom: 13px !important;
        }

        .searchBox,
        .selectWrap,
        .refreshButton {
          min-height: 40px !important;
          height: 40px !important;
        }

        .departmentsGrid {
          align-items: start !important;
          gap: 13px !important;
        }

        .departmentCard {
          min-height: auto !important;
          height: auto !important;
          align-self: start !important;
        }

        .departmentHeaderArt {
          min-height: 116px !important;
          padding: 15px 15px 12px !important;
        }

        .departmentHeaderText {
          grid-template-columns: 44px minmax(0, 1fr) !important;
          gap: 10px !important;
        }

        .departmentIcon {
          width: 42px !important;
          height: 42px !important;
          font-size: 20px !important;
        }

        .departmentHeaderText h2 {
          font-size: 21px !important;
          line-height: 1 !important;
        }

        .departmentHeaderText p {
          margin-top: 6px !important;
          font-size: 11.5px !important;
          line-height: 1.32 !important;
        }

        .departmentVisual {
          width: 92px !important;
          height: 92px !important;
          font-size: 62px !important;
          opacity: 0.85 !important;
        }

        .departmentVisual.amber {
          font-size: 68px !important;
        }

        .departmentVisual.blue {
          font-size: 66px !important;
        }

        .departmentStats {
          margin: 0 12px !important;
          transform: translateY(-7px) !important;
        }

        .departmentStats div {
          min-height: 48px !important;
          gap: 3px !important;
        }

        .departmentStats strong {
          font-size: 17px !important;
        }

        .departmentStats span {
          font-size: 9.5px !important;
        }

        .moduleHeader {
          margin: -1px 16px 6px !important;
          font-size: 11.5px !important;
        }

        .moduleList {
          flex: 0 0 auto !important;
          max-height: 270px !important;
          margin: 0 16px !important;
        }

        .moduleRow {
          min-height: 40px !important;
          grid-template-columns: 26px minmax(0, 1fr) auto 42px !important;
          gap: 7px !important;
        }

        .moduleIcon {
          width: 22px !important;
          height: 22px !important;
          border-radius: 6px !important;
        }

        .moduleText h3 {
          font-size: 11.5px !important;
        }

        .moduleText p {
          font-size: 9.5px !important;
        }

        .statusPill {
          min-height: 19px !important;
          padding: 0 8px !important;
          font-size: 9.5px !important;
        }

        .moduleRow small {
          font-size: 10px !important;
        }

        .miniEmpty {
          margin: 0 16px !important;
          padding: 14px 12px !important;
          gap: 10px !important;
        }

        .miniEmpty button {
          min-height: 31px !important;
        }

        .viewModules {
          min-height: 34px !important;
          margin: 4px 16px 8px !important;
          font-size: 12px !important;
        }



        /* Equal department-card sizing fix: all three department cards now share one compact height. */
        .departmentsGrid {
          align-items: stretch !important;
        }

        .departmentCard {
          height: 100% !important;
          min-height: 430px !important;
          display: flex !important;
          flex-direction: column !important;
        }

        .departmentHeaderArt {
          min-height: 112px !important;
          flex: 0 0 auto !important;
        }

        .departmentStats,
        .moduleHeader {
          flex: 0 0 auto !important;
        }

        .moduleList {
          flex: 1 1 auto !important;
          min-height: 96px !important;
          max-height: 176px !important;
          overflow-y: auto !important;
        }

        .miniEmpty {
          flex: 1 1 auto !important;
          min-height: 96px !important;
          display: grid !important;
          place-content: center !important;
          align-items: center !important;
        }

        .viewModules {
          margin-top: auto !important;
          flex: 0 0 auto !important;
        }

        @media (max-width: 1180px) {
          .departmentCard {
            min-height: 430px !important;
          }
        }

        @media (max-width: 900px) {
          .departmentCard {
            min-height: auto !important;
          }

          .moduleList,
          .miniEmpty {
            flex: 0 0 auto !important;
            max-height: none !important;
          }
        }

        @media (max-width: 1180px) {
          .metricGrid,
          .departmentsGrid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .heroSection {
            grid-template-columns: 1fr;
          }

          .heroIllustration {
            opacity: 0.45;
            width: 72%;
          }

          .bottomActivityRow {
            grid-template-columns: 38px minmax(0, 1fr) 160px 120px;
          }

          .bottomActivityRow time {
            display: none;
          }
        }

        @media (max-width: 900px) {
          .appShell {
            grid-template-columns: 1fr;
          }

          .sidebar {
            position: relative;
            height: auto;
            padding: 18px;
          }

          .sideNav {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }

          .sideItem {
            justify-content: center;
            padding: 0 10px;
          }

          .sideItem span {
            display: none;
          }

          .sidebarFooter,
          .ranchNote {
            display: none;
          }

          .mainShell {
            padding: 0 16px 22px;
          }

          .heroSection {
            padding: 28px 20px;
          }

          .heroIllustration {
            width: 100%;
            opacity: 0.22;
          }

          .metricGrid,
          .departmentsGrid,
          .rightRail,
          .toolbarPanel,
          .formGrid {
            grid-template-columns: 1fr;
          }

          .toolbarPanel {
            align-items: stretch;
          }

          .bottomActivityRow {
            grid-template-columns: 38px minmax(0, 1fr);
            padding: 9px 0;
          }

          .bottomActivityRow span,
          .bottomActivityRow small,
          .bottomActivityRow time {
            display: none;
          }

          .wide {
            grid-column: auto;
          }

          .modalActions {
            flex-direction: column-reverse;
          }

          .modalActions button {
            width: 100%;
          }
        }

        @media (max-width: 560px) {
          .topBar {
            align-items: flex-start;
            flex-direction: column;
            gap: 12px;
            padding: 14px 0;
          }

          .topActions {
            width: 100%;
            justify-content: space-between;
          }

          .userButton span:not(.userCircle) {
            display: none;
          }

          .heroCopy h1 {
            font-size: 36px;
          }

          .heroActions,
          .emptyActions {
            flex-direction: column;
          }

          .heroActions button,
          .emptyActions button {
            width: 100%;
          }

          .metricCard {
            grid-template-columns: 56px minmax(0, 1fr);
            min-height: 106px;
          }

          .metricIcon {
            width: 52px;
            height: 52px;
          }

          .departmentCard {
            min-height: 560px;
          }
        }


        /* Final department card spacing fix: equal cards, compact internals, no oversized blank areas. */
        .departmentsGrid {
          align-items: stretch !important;
          gap: 12px !important;
        }

        .departmentCard {
          height: auto !important;
          min-height: 0 !important;
          align-self: stretch !important;
          display: flex !important;
          flex-direction: column !important;
          border-radius: 18px !important;
          padding-bottom: 6px !important;
        }

        .departmentHeaderArt {
          min-height: 92px !important;
          padding: 12px 13px 9px !important;
          flex: 0 0 auto !important;
        }

        .departmentHeaderText {
          grid-template-columns: 39px minmax(0, 1fr) !important;
          gap: 9px !important;
        }

        .departmentIcon {
          width: 38px !important;
          height: 38px !important;
          font-size: 18px !important;
          box-shadow: 0 8px 16px rgba(51, 90, 38, 0.16) !important;
        }

        .departmentHeaderText h2 {
          max-width: 250px !important;
          font-size: 19px !important;
          line-height: 0.98 !important;
          letter-spacing: -0.035em !important;
        }

        .departmentHeaderText p {
          max-width: 245px !important;
          margin-top: 5px !important;
          font-size: 10.8px !important;
          line-height: 1.28 !important;
        }

        .departmentVisual {
          right: -8px !important;
          top: 4px !important;
          width: 78px !important;
          height: 78px !important;
          font-size: 52px !important;
          opacity: 0.72 !important;
        }

        .departmentVisual.amber {
          font-size: 57px !important;
        }

        .departmentVisual.blue {
          font-size: 55px !important;
        }

        .departmentStats {
          margin: 0 10px !important;
          transform: translateY(-6px) !important;
          border-radius: 11px !important;
          flex: 0 0 auto !important;
        }

        .departmentStats div {
          min-height: 40px !important;
          gap: 2px !important;
        }

        .departmentStats strong {
          font-size: 15.5px !important;
        }

        .departmentStats span {
          font-size: 8.8px !important;
        }

        .moduleHeader {
          margin: -2px 14px 4px !important;
          font-size: 11px !important;
          flex: 0 0 auto !important;
        }

        .moduleList {
          flex: 0 1 auto !important;
          min-height: 0 !important;
          max-height: 142px !important;
          margin: 0 14px !important;
          overflow-y: auto !important;
        }

        .moduleRow {
          min-height: 34px !important;
          grid-template-columns: 24px minmax(0, 1fr) auto 38px !important;
          gap: 6px !important;
        }

        .moduleIcon {
          width: 20px !important;
          height: 20px !important;
          border-radius: 6px !important;
        }

        .moduleIcon svg {
          width: 12px !important;
          height: 12px !important;
        }

        .moduleText h3 {
          font-size: 11px !important;
        }

        .moduleText p {
          margin-top: 1px !important;
          font-size: 9px !important;
        }

        .statusPill {
          min-height: 18px !important;
          padding: 0 7px !important;
          font-size: 9px !important;
        }

        .moduleRow small {
          font-size: 9.5px !important;
        }

        .miniEmpty {
          flex: 0 1 auto !important;
          min-height: 66px !important;
          margin: 0 14px !important;
          padding: 10px 10px !important;
          gap: 8px !important;
          place-content: center !important;
        }

        .miniEmpty p {
          font-size: 11.5px !important;
        }

        .miniEmpty button {
          min-height: 28px !important;
          padding: 0 10px !important;
          border-radius: 8px !important;
          font-size: 12px !important;
        }

        .viewModules {
          margin: auto 14px 4px !important;
          min-height: 28px !important;
          font-size: 11.5px !important;
          flex: 0 0 auto !important;
        }

        @media (max-width: 1180px) {
          .departmentCard {
            min-height: 0 !important;
            height: auto !important;
          }
        }

        @media (max-width: 900px) {
          .departmentsGrid {
            align-items: start !important;
          }

          .departmentCard {
            height: auto !important;
            min-height: 0 !important;
          }

          .moduleList,
          .miniEmpty {
            max-height: none !important;
          }
        }



        /* Final hero real-image treatment: compact, fitted, and based on the selected reference. */
        .heroSection {
          min-height: 154px !important;
          padding: 14px 24px !important;
          grid-template-columns: minmax(0, 0.78fr) minmax(340px, 0.92fr) !important;
          border-radius: 24px !important;
          background:
            linear-gradient(90deg, rgba(253, 251, 242, 0.98) 0%, rgba(255, 251, 236, 0.88) 42%, rgba(248, 239, 205, 0.58) 100%) !important;
        }

        .heroCopy {
          max-width: 620px !important;
        }

        .heroCopy h1 {
          font-size: clamp(30px, 2.45vw, 40px) !important;
          line-height: 0.98 !important;
          max-width: 640px !important;
        }

        .heroCopy p:not(.eyebrow) {
          max-width: 610px !important;
          margin-top: 7px !important;
          font-size: 13px !important;
          line-height: 1.38 !important;
        }

        .heroActions {
          margin-top: 11px !important;
          gap: 10px !important;
        }

        .seedButton,
        .createGhostButton {
          min-height: 36px !important;
          padding: 0 15px !important;
          border-radius: 10px !important;
          font-size: 13px !important;
        }

        .heroIllustration {
          position: absolute !important;
          right: 18px !important;
          top: 10px !important;
          bottom: 10px !important;
          width: 49% !important;
          max-width: 760px !important;
          min-width: 320px !important;
          border-radius: 22px !important;
          overflow: hidden !important;
          transform: none !important;
          transform-origin: center !important;
          opacity: 1 !important;
          background: #eef0d7 !important;
          box-shadow: inset 0 0 0 1px rgba(92, 105, 65, 0.11) !important;
        }

        .heroIllustration::before {
          content: "";
          position: absolute;
          inset: 0;
          background-image: var(--hero-image);
          background-size: cover;
          background-position: center 48%;
          filter: saturate(0.9) contrast(0.96) brightness(1.05);
          transform: scale(1.02);
        }

        .heroIllustration::after {
          content: "";
          position: absolute;
          inset: 0;
          background:
            linear-gradient(90deg, rgba(253, 251, 242, 0.92) 0%, rgba(253, 251, 242, 0.62) 27%, rgba(253, 251, 242, 0.16) 58%, rgba(253, 251, 242, 0.02) 100%),
            linear-gradient(180deg, rgba(255, 255, 255, 0.22) 0%, rgba(236, 224, 181, 0.18) 100%);
        }

        .heroImageShade {
          position: absolute;
          inset: 0;
          z-index: 2;
          pointer-events: none;
          background:
            radial-gradient(circle at 84% 16%, rgba(255, 248, 220, 0.36), transparent 26%),
            linear-gradient(180deg, transparent 0%, rgba(52, 72, 37, 0.08) 100%);
        }

        @media (max-width: 1180px) {
          .heroSection {
            min-height: 150px !important;
            grid-template-columns: 1fr !important;
          }
          .heroIllustration {
            width: 58% !important;
            min-width: 280px !important;
            opacity: 0.5 !important;
          }
        }

        @media (max-width: 760px) {
          .heroSection {
            min-height: auto !important;
            padding: 18px !important;
          }
          .heroIllustration {
            inset: 0 !important;
            width: 100% !important;
            min-width: 0 !important;
            border-radius: 20px !important;
            opacity: 0.22 !important;
          }
        }


        /* Final override: make the real farm image fill the full hero card and remain clearly visible. */
        .heroSection {
          min-height: 230px !important;
          padding: 30px 34px !important;
          grid-template-columns: 1fr !important;
          align-items: center !important;
          background-image:
            linear-gradient(90deg, rgba(253, 251, 242, 0.92) 0%, rgba(253, 251, 242, 0.74) 32%, rgba(253, 251, 242, 0.28) 62%, rgba(253, 251, 242, 0.04) 100%),
            linear-gradient(180deg, rgba(255, 255, 255, 0.12) 0%, rgba(239, 229, 192, 0.16) 100%),
            var(--hero-image) !important;
          background-size: 100% 100%, 100% 100%, cover !important;
          background-position: center center, center center, center 52% !important;
          background-repeat: no-repeat !important;
        }

        .heroSection::after {
          height: auto !important;
          inset: 0 !important;
          pointer-events: none !important;
          background:
            radial-gradient(circle at 80% 16%, rgba(255, 247, 209, 0.34), transparent 25%),
            linear-gradient(90deg, rgba(255, 255, 255, 0.18), transparent 52%) !important;
        }

        .heroCopy {
          max-width: 620px !important;
          position: relative !important;
          z-index: 3 !important;
        }

        .heroCopy h1 {
          font-size: clamp(34px, 3vw, 48px) !important;
          line-height: 0.98 !important;
          max-width: 620px !important;
        }

        .heroCopy p:not(.eyebrow) {
          max-width: 570px !important;
          font-size: 14px !important;
          line-height: 1.46 !important;
          margin-top: 10px !important;
        }

        .heroActions {
          margin-top: 18px !important;
        }

        .heroIllustration {
          display: none !important;
        }

        @media (max-width: 760px) {
          .heroSection {
            min-height: 205px !important;
            padding: 24px 18px !important;
            background-position: center center, center center, 58% center !important;
          }

          .heroCopy h1 {
            font-size: 31px !important;
          }

          .heroCopy p:not(.eyebrow) {
            font-size: 13px !important;
          }
        }


        /* Final requested fix: remove top header space and push the image hero flush to the top beside the sidebar. */
        .mainShell {
          padding: 0 28px 28px !important;
        }

        .topBar {
          display: none !important;
        }

        .heroSection {
          margin-top: 0 !important;
          min-height: 330px !important;
          padding: 42px 44px !important;
          border-radius: 26px !important;
          display: flex !important;
          align-items: center !important;
          background-image:
            linear-gradient(90deg, rgba(253, 251, 242, 0.88) 0%, rgba(253, 251, 242, 0.66) 34%, rgba(253, 251, 242, 0.22) 64%, rgba(253, 251, 242, 0.03) 100%),
            linear-gradient(180deg, rgba(255, 255, 255, 0.08) 0%, rgba(239, 229, 192, 0.12) 100%),
            var(--hero-image) !important;
          background-size: 100% 100%, 100% 100%, cover !important;
          background-position: center center, center center, center 50% !important;
          background-repeat: no-repeat !important;
        }

        .heroCopy {
          max-width: 650px !important;
        }

        .heroCopy h1 {
          font-size: clamp(40px, 3.5vw, 56px) !important;
          line-height: 0.98 !important;
        }

        .heroCopy p:not(.eyebrow) {
          max-width: 600px !important;
          font-size: 14.5px !important;
          line-height: 1.52 !important;
          margin-top: 12px !important;
        }

        .heroActions {
          margin-top: 20px !important;
        }

        @media (max-width: 1180px) {
          .heroSection {
            min-height: 300px !important;
            padding: 34px 28px !important;
          }
        }

        @media (max-width: 900px) {
          .mainShell {
            padding: 0 16px 22px !important;
          }
        }

        @media (max-width: 760px) {
          .heroSection {
            min-height: 265px !important;
            padding: 28px 18px !important;
            background-position: center center, center center, 58% center !important;
          }

          .heroCopy h1 {
            font-size: 32px !important;
          }

          .heroCopy p:not(.eyebrow) {
            font-size: 13px !important;
          }
        }


        /* Logo fix: use one clean SVG mark so it matches the provided Greenfield Ranch reference. */
        .brandBlock {
          gap: 12px !important;
          align-items: center !important;
          justify-content: center !important;
          min-height: 94px !important;
          margin-bottom: 18px !important;
        }

        .brandMark {
          width: 82px !important;
          height: 56px !important;
          flex: 0 0 82px !important;
          display: block !important;
          position: relative !important;
          color: #fffef3 !important;
          filter: drop-shadow(0 8px 18px rgba(17, 34, 19, 0.16)) !important;
        }

        .brandMark svg {
          width: 100% !important;
          height: 100% !important;
          display: block !important;
        }

        .brandHill,
        .brandHill::after,
        .brandBarn,
        .brandBarn::before,
        .brandSun {
          display: none !important;
        }

        .brandBlock strong {
          font-size: 27px !important;
          line-height: 0.9 !important;
          color: #fffef3 !important;
          letter-spacing: -0.045em !important;
          text-shadow: 0 8px 18px rgba(20, 38, 22, 0.14) !important;
        }

        .brandBlock span:not(.brandMark) {
          margin-top: 7px !important;
          font-size: 11px !important;
          letter-spacing: 0.46em !important;
          color: #fffef3 !important;
          font-weight: 900 !important;
        }

        @media (max-width: 1180px) {
          .brandBlock {
            min-height: 80px !important;
            gap: 9px !important;
          }
          .brandMark {
            width: 66px !important;
            height: 48px !important;
            flex-basis: 66px !important;
          }
          .brandBlock strong {
            font-size: 22px !important;
          }
        }



        /* Final logo correction: prevent crop/overflow and keep the Greenfield Ranch mark fully inside sidebar. */
        .brandBlock {
          width: 100% !important;
          max-width: 100% !important;
          box-sizing: border-box !important;
          display: flex !important;
          align-items: center !important;
          justify-content: flex-start !important;
          gap: 8px !important;
          min-height: 82px !important;
          margin: 0 0 16px !important;
          padding: 0 8px !important;
          overflow: hidden !important;
        }

        .brandMark {
          width: 62px !important;
          height: 48px !important;
          flex: 0 0 62px !important;
          display: block !important;
          color: #fffef3 !important;
          transform: translateY(1px) !important;
        }

        .brandMark svg {
          width: 100% !important;
          height: 100% !important;
          display: block !important;
          overflow: visible !important;
        }

        .brandText {
          flex: 1 1 auto !important;
          min-width: 0 !important;
          overflow: hidden !important;
          display: flex !important;
          flex-direction: column !important;
          justify-content: center !important;
          align-items: flex-start !important;
          padding-top: 2px !important;
        }

        .brandText strong {
          display: block !important;
          max-width: 100% !important;
          overflow: hidden !important;
          text-overflow: clip !important;
          white-space: nowrap !important;
          font-family: Georgia, "Times New Roman", serif !important;
          font-size: 22px !important;
          line-height: 0.98 !important;
          letter-spacing: -0.035em !important;
          color: #fffef3 !important;
          text-shadow: 0 8px 18px rgba(20, 38, 22, 0.14) !important;
        }

        .brandText span {
          display: block !important;
          margin-top: 7px !important;
          padding-left: 2px !important;
          font-size: 11px !important;
          line-height: 1 !important;
          letter-spacing: 0.42em !important;
          color: #fffef3 !important;
          font-weight: 900 !important;
          white-space: nowrap !important;
        }

        .brandBlock span:not(.brandMark):not(.brandText) {
          margin-top: 0 !important;
        }

        @media (max-width: 1180px) {
          .brandBlock {
            min-height: 74px !important;
            gap: 7px !important;
            padding: 0 7px !important;
          }

          .brandMark {
            width: 54px !important;
            height: 42px !important;
            flex-basis: 54px !important;
          }

          .brandText strong {
            font-size: 20px !important;
          }

          .brandText span {
            font-size: 10px !important;
            letter-spacing: 0.38em !important;
          }
        }

        /* Replacement logo: compact shield icon + safe brand sizing so Greenfield never clips. */
        .appShell {
          grid-template-columns: 246px minmax(0, 1fr) !important;
        }

        .sidebar {
          padding-left: 14px !important;
          padding-right: 14px !important;
        }

        .brandBlock {
          width: 100% !important;
          min-width: 0 !important;
          max-width: 100% !important;
          min-height: 88px !important;
          padding: 0 4px !important;
          margin: 0 0 18px !important;
          box-sizing: border-box !important;
          overflow: visible !important;
          display: flex !important;
          align-items: center !important;
          justify-content: flex-start !important;
          gap: 10px !important;
        }

        .brandMarkNew {
          width: 52px !important;
          height: 52px !important;
          flex: 0 0 52px !important;
          display: grid !important;
          place-items: center !important;
          color: #fffef3 !important;
          border-radius: 18px !important;
          background: rgba(255, 255, 255, 0.08) !important;
          box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.14) !important;
          transform: none !important;
        }

        .brandMarkNew svg {
          width: 42px !important;
          height: 42px !important;
          display: block !important;
          overflow: visible !important;
        }

        .brandMarkNew .logoShield,
        .brandMarkNew .logoGround,
        .brandMarkNew .logoBarn,
        .brandMarkNew .logoLeaf {
          fill: none !important;
          stroke: currentColor !important;
          stroke-width: 3.2 !important;
          stroke-linecap: round !important;
          stroke-linejoin: round !important;
        }

        .brandMarkNew .logoShield {
          stroke-width: 3.4 !important;
        }

        .brandText {
          flex: 1 1 auto !important;
          min-width: 0 !important;
          max-width: calc(100% - 62px) !important;
          overflow: visible !important;
          display: flex !important;
          flex-direction: column !important;
          align-items: flex-start !important;
          justify-content: center !important;
        }

        .brandText strong {
          width: 100% !important;
          max-width: 100% !important;
          display: block !important;
          overflow: visible !important;
          text-overflow: unset !important;
          white-space: nowrap !important;
          font-family: Georgia, "Times New Roman", serif !important;
          font-size: 23px !important;
          line-height: 1 !important;
          letter-spacing: -0.035em !important;
          color: #fffef3 !important;
        }

        .brandText span {
          display: block !important;
          width: auto !important;
          max-width: 100% !important;
          margin-top: 8px !important;
          padding-left: 2px !important;
          overflow: visible !important;
          text-overflow: unset !important;
          white-space: nowrap !important;
          font-size: 11px !important;
          line-height: 1 !important;
          letter-spacing: 0.38em !important;
          font-weight: 900 !important;
          color: #fffef3 !important;
        }

        @media (max-width: 1360px) {
          .appShell {
            grid-template-columns: 236px minmax(0, 1fr) !important;
          }
          .brandText strong {
            font-size: 21px !important;
          }
          .brandMarkNew {
            width: 48px !important;
            height: 48px !important;
            flex-basis: 48px !important;
          }
          .brandMarkNew svg {
            width: 39px !important;
            height: 39px !important;
          }
        }

        @media (max-width: 900px) {
          .appShell {
            grid-template-columns: 1fr !important;
          }
          .brandBlock {
            justify-content: center !important;
          }
          .brandText {
            flex: 0 1 auto !important;
            max-width: none !important;
          }
        }

      `}</style>
    </>
  );
}
