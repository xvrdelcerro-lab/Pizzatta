"use client";

import { useState, useEffect, useCallback, ElementType } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";
import {
  DollarSign,
  ShoppingCart,
  Users,
  Receipt,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const PALETTE = ["#dc2626", "#f59e0b", "#fde047", "#65a30d", "#9ca3af", "#f87171", "#78350f"];

const parseNumeric = (val: any) => {
  if (typeof val === "number") return val;
  if (!val) return 0;
  const cleaned = String(val).replace(/[^0-9.-]+/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
};

const normalizeKey = (name: any) => String(name || "").trim().toUpperCase();

const formatCurrency = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const formatNumber = (n: number, decimals = 0) =>
  n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

const formatChangeLabel = (pct: number) => `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`;

interface StatCardProps {
  title: string;
  value: string;
  icon: ElementType;
  changePct?: number;
  subtitle?: string;
  accent?: "red" | "amber" | "lime" | "sky";
}

const ACCENT_CLASSES: Record<string, string> = {
  red: "bg-red-50 text-red-600",
  amber: "bg-amber-50 text-amber-600",
  lime: "bg-lime-50 text-lime-600",
  sky: "bg-sky-50 text-sky-600",
};

const StatCard = ({ title, value, icon: Icon, changePct, subtitle, accent = "red" }: StatCardProps) => (
  <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
    <div className="flex items-center justify-between mb-4">
      <div className={`p-2.5 rounded-xl ${ACCENT_CLASSES[accent]}`}>
        <Icon size={22} strokeWidth={1.5} />
      </div>
    </div>
    <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
    <p className="text-3xl font-bold text-gray-950">{value}</p>
    {changePct !== undefined ? (
      <p
        className={`text-sm mt-2 flex items-center gap-1 ${
          changePct >= 0 ? "text-lime-600" : "text-red-600"
        }`}
      >
        {formatChangeLabel(changePct)} <span className="text-gray-500">vs last week</span>
      </p>
    ) : subtitle ? (
      <p className="text-sm mt-2 text-gray-500">{subtitle}</p>
    ) : null}
  </div>
);

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [sales, setSales] = useState<any[]>([]);
  const [production, setProduction] = useState<any[]>([]);
  const [entries, setEntries] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [customersCount, setCustomersCount] = useState(0);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [salesSnap, prodSnap, entriesSnap, productsSnap, customersSnap] = await Promise.all([
        getDocs(collection(db, "sales")),
        getDocs(collection(db, "dayproduction")),
        getDocs(collection(db, "entries")),
        getDocs(collection(db, "products")),
        getDocs(collection(db, "customers")),
      ]);

      setSales(salesSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setProduction(prodSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setEntries(entriesSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setProducts(productsSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setCustomersCount(customersSnap.size);
    } catch (e) {
      console.error("Error loading dashboard data:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const last7Start = new Date(startOfToday);
  last7Start.setDate(last7Start.getDate() - 6);
  const prev7Start = new Date(last7Start);
  prev7Start.setDate(prev7Start.getDate() - 7);
  const prev7End = new Date(last7Start.getTime() - 1);

  const salesLast7 = sales.filter((s) => {
    const ts = Number(s.timestamp || 0);
    return ts >= last7Start.getTime() && ts <= now.getTime();
  });
  const salesPrev7 = sales.filter((s) => {
    const ts = Number(s.timestamp || 0);
    return ts >= prev7Start.getTime() && ts <= prev7End.getTime();
  });

  const revenueLast7 = salesLast7.reduce((sum, s) => sum + parseNumeric(s.totalAmount), 0);
  const revenuePrev7 = salesPrev7.reduce((sum, s) => sum + parseNumeric(s.totalAmount), 0);
  const ordersLast7 = salesLast7.length;
  const ordersPrev7 = salesPrev7.length;
  const avgOrderLast7 = ordersLast7 > 0 ? revenueLast7 / ordersLast7 : 0;
  const avgOrderPrev7 = ordersPrev7 > 0 ? revenuePrev7 / ordersPrev7 : 0;

  const pctChange = (curr: number, prev: number) => {
    if (prev === 0) return curr > 0 ? 100 : 0;
    return ((curr - prev) / prev) * 100;
  };

  const dailyBuckets = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(last7Start);
    d.setDate(d.getDate() + i);
    const dayStart = d.getTime();
    const dayEnd = dayStart + 24 * 60 * 60 * 1000 - 1;
    const dayRevenue = sales
      .filter((s) => {
        const ts = Number(s.timestamp || 0);
        return ts >= dayStart && ts <= dayEnd;
      })
      .reduce((sum, s) => sum + parseNumeric(s.totalAmount), 0);
    return {
      label: DAY_LABELS[d.getDay()],
      dateStr: d.toLocaleDateString("en-US", { day: "2-digit", month: "short" }),
      revenue: dayRevenue,
    };
  });
  const maxDailyRevenue = Math.max(...dailyBuckets.map((b) => b.revenue), 1);
  const hasAnySales = sales.length > 0;

  const productSales: Record<string, { qty: number; revenue: number }> = {};
  sales.forEach((s) => {
    if (Array.isArray(s.items)) {
      s.items.forEach((it: any) => {
        const name = (it.productName || it.name || "").trim();
        if (!name) return;
        if (!productSales[name]) productSales[name] = { qty: 0, revenue: 0 };
        productSales[name].qty += parseNumeric(it.qty || it.quantity || 0);
        productSales[name].revenue += parseNumeric(it.subtotal || it.qty * it.unitPrice || 0);
      });
    }
  });
  const topProducts = Object.entries(productSales)
    .map(([name, d]) => ({ name, ...d }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5);
  const maxTopQty = Math.max(...topProducts.map((p) => p.qty), 1);

  const movement: Record<string, { produced: number; sold: number }> = {};
  production.forEach((pr: any) => {
    const key = normalizeKey(pr.productName);
    if (!key) return;
    if (!movement[key]) movement[key] = { produced: 0, sold: 0 };
    // Prefer real units obtained (actual output) over the expected/planned quantity.
    // Falls back to quantity for older records saved before "Units Obtained" existed.
    const obtained = parseNumeric(pr.unitsObtained);
    movement[key].produced += obtained > 0 ? obtained : parseNumeric(pr.quantity);
  });
  sales.forEach((s: any) => {
    if (Array.isArray(s.items)) {
      s.items.forEach((it: any) => {
        const key = normalizeKey(it.productName || it.name);
        if (!key) return;
        if (!movement[key]) movement[key] = { produced: 0, sold: 0 };
        movement[key].sold += parseNumeric(it.qty || it.quantity || 0);
      });
    }
  });

  const categoryStock: Record<string, number> = {};
  products.forEach((p: any) => {
    const key = normalizeKey(p.name);
    const m = movement[key];
    const stock = m ? Math.max(0, m.produced - m.sold) : 0;
    const cat = (p.category || "Uncategorized").trim() || "Uncategorized";
    categoryStock[cat] = (categoryStock[cat] || 0) + stock;
  });
  const totalStockUnits = Object.values(categoryStock).reduce((a, b) => a + b, 0);
  const categoryEntries = Object.entries(categoryStock)
    .filter(([, qty]) => qty > 0)
    .sort((a, b) => b[1] - a[1]);

  let cumulative = 0;
  const gradientStops = categoryEntries.map(([, qty], idx) => {
    const pct = totalStockUnits > 0 ? (qty / totalStockUnits) * 100 : 0;
    const start = cumulative;
    cumulative += pct;
    const color = PALETTE[idx % PALETTE.length];
    return `${color} ${start}% ${cumulative}%`;
  });
  const donutStyle =
    gradientStops.length > 0
      ? { background: `conic-gradient(${gradientStops.join(", ")})` }
      : { background: "#f3f4f6" };

  const ingredientMovement: Record<string, { name: string; category: string; purchased: number; used: number }> = {};
  entries.forEach((e: any) => {
    const lineItems = Array.isArray(e.items) ? e.items : null;
    if (lineItems) {
      lineItems.forEach((it: any) => {
        const name = it.name || it.item || "";
        const key = normalizeKey(name);
        if (!key) return;
        if (!ingredientMovement[key]) {
          ingredientMovement[key] = {
            name: String(name).trim(),
            category: it.category === "Provisions" ? "Provision" : "Ingredient",
            purchased: 0,
            used: 0,
          };
        }
        ingredientMovement[key].purchased += parseNumeric(it.qty || it.quantity || 0);
      });
    }
  });
  production.forEach((pr: any) => {
    if (Array.isArray(pr.usedIngredients)) {
      pr.usedIngredients.forEach((ing: any) => {
        const key = normalizeKey(ing.name);
        if (!key) return;
        if (!ingredientMovement[key]) {
          ingredientMovement[key] = { name: String(ing.name || "").trim(), category: "Ingredient", purchased: 0, used: 0 };
        }
        ingredientMovement[key].used += parseNumeric(ing.qty || 0);
      });
    }
  });
  const lowStockIngredients = Object.values(ingredientMovement)
    .map((i) => ({ name: i.name, category: i.category, stock: i.purchased - i.used, purchased: i.purchased }))
    .filter((i) => i.stock <= 0 && i.purchased > 0)
    .sort((a, b) => a.stock - b.stock)
    .slice(0, 5);

  const oversoldProducts = Object.entries(movement)
    .map(([key, m]) => {
      const productDoc = products.find((p: any) => normalizeKey(p.name) === key);
      const displayName = productDoc ? productDoc.name : key;
      return { name: displayName, stock: m.produced - m.sold };
    })
    .filter((p) => p.stock < 0)
    .sort((a, b) => a.stock - b.stock)
    .slice(0, 5);

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans">
      <header className="mb-10 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-950 tracking-tight">Dashboard Overview</h1>
          <p className="text-gray-600 mt-1">Live data from your business, pulled directly from Firestore.</p>
        </div>
        <button
          onClick={fetchAll}
          disabled={loading}
          className="bg-white px-5 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 text-gray-700 hover:bg-gray-100 flex items-center gap-2 disabled:opacity-50"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Refresh
        </button>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-10">
        <StatCard
          title="Revenue (Last 7 Days)"
          value={`$${formatCurrency(revenueLast7)}`}
          icon={DollarSign}
          changePct={pctChange(revenueLast7, revenuePrev7)}
          accent="red"
        />
        <StatCard
          title="Orders (Last 7 Days)"
          value={String(ordersLast7)}
          icon={ShoppingCart}
          changePct={pctChange(ordersLast7, ordersPrev7)}
          accent="amber"
        />
        <StatCard
          title="Avg. Order Value (7 Days)"
          value={`$${formatCurrency(avgOrderLast7)}`}
          icon={Receipt}
          changePct={pctChange(avgOrderLast7, avgOrderPrev7)}
          accent="lime"
        />
        <StatCard
          title="Total Customers"
          value={String(customersCount)}
          icon={Users}
          subtitle="Customers registered in the system"
          accent="sky"
        />
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <div className="xl:col-span-2 bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-950">Daily Sales (Last 7 Days)</h2>
          </div>

          {!hasAnySales ? (
            <div className="h-72 flex flex-col items-center justify-center text-gray-400 gap-2">
              <ShoppingCart size={40} strokeWidth={1} />
              <p className="text-sm">No sales recorded yet.</p>
            </div>
          ) : (
            <div className="h-72 flex items-end justify-between gap-3 px-1">
              {dailyBuckets.map((b, idx) => {
                const heightPct = maxDailyRevenue > 0 ? (b.revenue / maxDailyRevenue) * 100 : 0;
                return (
                  <div key={idx} className="flex-1 flex flex-col items-center justify-end h-full">
                    <span className="text-xs font-bold text-gray-700 mb-1">
                      {b.revenue > 0 ? `$${formatCurrency(b.revenue)}` : ""}
                    </span>
                    <div
                      className="w-full rounded-t-lg bg-amber-500 transition-all"
                      style={{
                        height: `${Math.max(heightPct, b.revenue > 0 ? 3 : 0)}%`,
                        minHeight: b.revenue > 0 ? "4px" : "0",
                      }}
                      title={`${b.dateStr}: $${formatCurrency(b.revenue)}`}
                    />
                    <span className="text-xs text-gray-500 mt-2 font-medium">{b.label}</span>
                    <span className="text-[10px] text-gray-400">{b.dateStr}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
          <h2 className="text-xl font-bold text-gray-950 mb-6">Stock by Category</h2>

          {categoryEntries.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-60 text-gray-400 gap-2">
              <p className="text-sm text-center">No product stock has been calculated yet.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-center h-60">
                <div className="relative w-48 h-48 rounded-full flex items-center justify-center" style={donutStyle}>
                  <div className="absolute w-32 h-32 bg-white rounded-full flex flex-col items-center justify-center text-center shadow-inner">
                    <span className="text-2xl font-bold text-gray-950">{formatNumber(totalStockUnits)}</span>
                    <span className="text-xs text-gray-500">Total Units</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 mt-6 max-h-40 overflow-y-auto pr-1">
                {categoryEntries.map(([cat, qty], idx) => {
                  const pct = totalStockUnits > 0 ? (qty / totalStockUnits) * 100 : 0;
                  return (
                    <div key={cat} className="flex items-center gap-3">
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: PALETTE[idx % PALETTE.length] }}
                      />
                      <span className="text-sm font-medium text-gray-700 truncate">{cat}</span>
                      <span className="ml-auto text-sm font-bold text-gray-950 flex-shrink-0">
                        {formatNumber(qty)} ({pct.toFixed(0)}%)
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      <section className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
          <h2 className="text-xl font-bold text-gray-950 mb-6">Top Selling Products</h2>

          {topProducts.length === 0 ? (
            <div className="h-40 flex flex-col items-center justify-center text-gray-400 gap-2">
              <p className="text-sm">No products sold yet.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {topProducts.map((p, idx) => {
                const widthPct = maxTopQty > 0 ? (p.qty / maxTopQty) * 100 : 0;
                const color = PALETTE[idx % PALETTE.length];
                return (
                  <div key={p.name}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-semibold text-gray-800">{p.name}</span>
                      <span className="text-sm font-bold" style={{ color }}>
                        {formatNumber(p.qty)} units · ${formatCurrency(p.revenue)}
                      </span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2.5">
                      <div
                        className="h-2.5 rounded-full"
                        style={{ width: `${Math.max(widthPct, 3)}%`, backgroundColor: color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
          <h2 className="text-xl font-bold text-gray-950 mb-1">Inventory Alerts</h2>
          <p className="text-xs text-gray-400 mb-5">Ingredients and provisions with no stock available.</p>

          {lowStockIngredients.length === 0 ? (
            <div className="h-40 flex flex-col items-center justify-center text-gray-400 gap-2">
              <CheckCircle2 size={32} strokeWidth={1.5} className="text-lime-600" />
              <p className="text-sm text-center">All ingredient and provision inventory is at healthy levels.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {lowStockIngredients.map((ing) => (
                <div
                  key={ing.name}
                  className="flex items-center justify-between bg-red-50 border border-red-200 rounded-lg px-4 py-3"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <AlertTriangle size={16} className="text-red-600 flex-shrink-0" />
                    <span className="text-sm font-semibold text-gray-800 truncate">{ing.name}</span>
                    <span className="text-[10px] font-bold uppercase tracking-wide text-red-600 bg-red-100 border border-red-200 rounded-full px-2 py-0.5 flex-shrink-0">
                      {ing.category}
                    </span>
                  </div>
                  <span className="text-sm font-bold text-red-600 flex-shrink-0 ml-2">
                    {ing.stock === 0 ? "Out of stock" : formatNumber(ing.stock, 1)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="mt-8 grid grid-cols-1 gap-8">
        <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
          <h2 className="text-xl font-bold text-gray-950 mb-1">Oversold Products</h2>
          <p className="text-xs text-gray-400 mb-5">
            Products sold in greater quantity than recorded as produced (not included in the Stock by Category chart).
          </p>

          {oversoldProducts.length === 0 ? (
            <div className="h-24 flex flex-col items-center justify-center text-gray-400 gap-2">
              <CheckCircle2 size={28} strokeWidth={1.5} className="text-lime-600" />
              <p className="text-sm text-center">No oversold products recorded.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {oversoldProducts.map((p) => (
                <div
                  key={p.name}
                  className="flex items-center justify-between bg-red-50 border border-red-200 rounded-lg px-4 py-3"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <AlertTriangle size={16} className="text-red-600 flex-shrink-0" />
                    <span className="text-sm font-semibold text-gray-800 truncate">{p.name}</span>
                  </div>
                  <span className="text-sm font-bold text-red-600 flex-shrink-0 ml-2">{formatNumber(p.stock)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <div className="h-10"></div>
    </div>
  );
}
