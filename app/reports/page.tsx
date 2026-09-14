"use client";

import React, { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";
import { X, Users, ShoppingBag, Package, ClipboardList, Clock, ChefHat, BarChart3, ArrowRight, Printer } from "lucide-react";

export default function ReportsPage() {
  const [activeReportModal, setActiveReportModal] = useState<string | null>(null);
  
  const [startDate, setStartDate] = useState("2026-07-01");
  const [endDate, setEndDate] = useState("2026-07-24");

  const [vendors, setVendors] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [entries, setEntries] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [production, setProduction] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);

  const [selectedVendorId, setSelectedVendorId] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedEntryVendor, setSelectedEntryVendor] = useState("ALL");
  const [selectedAttendanceWorker, setSelectedAttendanceWorker] = useState("ALL");
  const [selectedSalesCustomer, setSelectedSalesCustomer] = useState("ALL");

  // Inventory & Stock Report state
  const [inventoryStockTab, setInventoryStockTab] = useState<"inventory" | "stock">("inventory");
  const [selectedInventorySubcategory, setSelectedInventorySubcategory] = useState("ALL");
  const [selectedStockCategory, setSelectedStockCategory] = useState("ALL");

  const parseNumeric = (val: any) => {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    const cleaned = String(val).replace(/[^0-9.-]+/g, "");
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  };

  const formatDateField = (val: any) => {
    if (!val) return "";
    
    if (typeof val === "object" && val !== null) {
      if (typeof val.seconds === "number") {
        return new Date(val.seconds * 1000).toISOString().split('T')[0];
      }
      if (val instanceof Date) {
        return val.toISOString().split('T')[0];
      }
    }

    const valStr = String(val).trim();
    const parsedDate = new Date(valStr);
    if (!isNaN(parsedDate.getTime())) {
      const year = parsedDate.getFullYear();
      const month = String(parsedDate.getMonth() + 1).padStart(2, '0');
      const day = String(parsedDate.getDate()).padStart(2, '0');
      if (year > 2000) {
        return `${year}-${month}-${day}`;
      }
    }

    if (valStr.includes("/")) {
      const parts = valStr.split(" ")[0].split("/");
      if (parts.length === 3) {
        const [m, d, y] = parts;
        const fullYear = y.length === 2 ? `20${y}` : y;
        return `${fullYear}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
      }
    }

    return valStr.split(' ')[0].split('T')[0];
  };

  const formatEntryDocumentId = (rawDate: string, index: number) => {
    if (!rawDate) return `ENTRY-${String(index + 1).padStart(3, '0')}`;
    const parts = rawDate.split("-");
    if (parts.length === 3) {
      const [yyyy, mm, dd] = parts;
      const dateObj = new Date(parseInt(yyyy), parseInt(mm) - 1, parseInt(dd));
      if (!isNaN(dateObj.getTime())) {
        const dayStr = String(dateObj.getDate()).padStart(2, '0');
        const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
        const monStr = months[dateObj.getMonth()];
        const yearStr = dateObj.getFullYear();
        const seqStr = String(index + 1).padStart(3, '0');
        return `${dayStr}${monStr}${yearStr}-${seqStr}`;
      }
    }
    return `${rawDate}-` + String(index + 1).padStart(3, '0');
  };

  const fetchData = async () => {
    try {
      const vSnap = await getDocs(collection(db, "vendors"));
      setVendors(vSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      const cSnap = await getDocs(collection(db, "customers"));
      setCustomers(cSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      const eSnap = await getDocs(collection(db, "entries"));
      const entriesList = eSnap.docs.map((d, idx) => {
        const data = d.data();
        const formattedDate = formatDateField(data.date || data.dateTime || data.timestamp);
        return {
          id: d.id,
          generatedDocId: formatEntryDocumentId(formattedDate, idx),
          ...data,
          date: formattedDate
        };
      });
      setEntries(entriesList);

      const prSnap = await getDocs(collection(db, "dayproduction"));
      const productionList = prSnap.docs.map(d => {
        const data = d.data();
        const extractedDate = formatDateField(data.dateTime || data.date || data.timestamp);
        return {
          id: d.id,
          ...data,
          date: extractedDate,
          productName: data.productName || data.item || data.name || "N/A",
          quantity: parseNumeric(data.quantity || data.qty || 0),
          totalCost: parseNumeric(data.totalCost || data.cost || 0)
        };
      });
      setProduction(productionList);

      const sSnap = await getDocs(collection(db, "sales"));
      const salesList = sSnap.docs.map(d => {
        const data = d.data();
        const extractedDate = formatDateField(data.dateTime || data.date || data.timestamp);
        const custName = data.customer || data.customerName || data.client || "Walk-in Customer";
        const totalRev = parseNumeric(data.total || data.totalAmount || data.revenue || data.amount || 0);
        
        let itemsSummaryStr = "";
        if (Array.isArray(data.items) && data.items.length > 0) {
          itemsSummaryStr = data.items.map((it: any) => {
            const iName = it.name || it.productName || it.item || "Item";
            const iQty = parseNumeric(it.qty || it.quantity || 0);
            const iSub = parseNumeric(it.subtotal || it.total || (iQty * parseNumeric(it.unitPrice || 0)));
            return `${iName}: ${iQty} x $${parseNumeric(it.unitPrice || 0).toFixed(2)} ($${iSub.toFixed(2)})`;
          }).join(", ");
        } else {
          itemsSummaryStr = data.items || data.description || data.product || "N/A";
        }

        return {
          id: d.id,
          ...data,
          date: extractedDate,
          customerName: custName,
          itemsSummary: itemsSummaryStr,
          totalRevenue: totalRev
        };
      });
      setSales(salesList);

      // Fetch payments received from customers (used by the Customer Statement report).
      // Collection is optional - if it doesn't exist yet, getDocs simply returns an empty snapshot.
      const paySnap = await getDocs(collection(db, "payments"));
      const paymentsList = paySnap.docs.map(d => {
        const data = d.data();
        const extractedDate = formatDateField(data.date || data.dateTime || data.timestamp);
        const custName = data.customer || data.customerName || data.client || "Walk-in Customer";
        const amountVal = parseNumeric(data.amount || data.total || data.paidAmount || 0);
        return {
          id: d.id,
          ...data,
          date: extractedDate,
          customerName: custName,
          amount: amountVal,
          method: data.method || data.paymentMethod || "",
          note: data.note || data.notes || data.reference || data.description || ""
        };
      });
      setPayments(paymentsList);

      // Fetch products catalog (name/category/code live here; price & stock are DERIVED below,
      // since Firestore product docs don't store them directly)
      const pSnap = await getDocs(collection(db, "products"));
      const rawProducts = pSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      const normalizeKey = (name: any) => String(name || "").trim().toUpperCase();

      // --- Derive PRODUCT stock: produced (dayproduction) minus sold (sales line items) ---
      // Average selling price is taken from sales line items since products have no price field.
      const productMovement: Record<string, { producedQty: number; soldQty: number; priceSum: number; priceCount: number }> = {};

      productionList.forEach((pr: any) => {
        const key = normalizeKey(pr.productName);
        if (!key) return;
        if (!productMovement[key]) productMovement[key] = { producedQty: 0, soldQty: 0, priceSum: 0, priceCount: 0 };
        productMovement[key].producedQty += parseNumeric(pr.quantity || 0);
      });

      salesList.forEach((s: any) => {
        if (Array.isArray(s.items)) {
          s.items.forEach((it: any) => {
            const key = normalizeKey(it.name || it.productName || it.item);
            if (!key) return;
            if (!productMovement[key]) productMovement[key] = { producedQty: 0, soldQty: 0, priceSum: 0, priceCount: 0 };
            const qty = parseNumeric(it.qty || it.quantity || 0);
            const unitPrice = parseNumeric(it.unitPrice || 0);
            productMovement[key].soldQty += qty;
            if (unitPrice > 0) {
              productMovement[key].priceSum += unitPrice;
              productMovement[key].priceCount += 1;
            }
          });
        }
      });

      const productsWithStock = rawProducts.map((p: any) => {
        const key = normalizeKey(p.name || p.productName || p.title);
        const movement = productMovement[key];
        const stockVal = movement ? movement.producedQty - movement.soldQty : 0;
        const priceVal = movement && movement.priceCount > 0
          ? movement.priceSum / movement.priceCount
          : parseNumeric(p.price ?? p.cost ?? p.salePrice ?? p.unitPrice ?? 0);
        return {
          ...p,
          price: priceVal,
          stock: stockVal,
          totalPrice: priceVal * stockVal
        };
      });
      setProducts(productsWithStock);

      const aSnap = await getDocs(collection(db, "attendance"));
      const attendanceList = aSnap.docs.map(d => {
        const data = d.data();
        let inTimeVal = data.inTime || data.clockIn || data.timeIn || data.in || "";
        let outTimeVal = data.outTime || data.clockOut || data.timeOut || data.out || "";

        let extractedDate = "";
        if (data.date) {
          extractedDate = formatDateField(data.date);
        } else if (inTimeVal) {
          extractedDate = formatDateField(inTimeVal);
        } else if (data.timestamp) {
          extractedDate = formatDateField(data.timestamp);
        }

        const workerVal = (data.workerName || data.worker || data.name || data.employee || data.fullName || "").trim();

        return {
          id: d.id,
          ...data,
          workerName: workerVal,
          date: extractedDate || formatDateField(data.timestamp || data.created || new Date()),
          inTime: inTimeVal,
          outTime: outTimeVal,
          workedHours: data.workedHours || data.hours || data.workedTime || "0.00 hrs"
        };
      });
      setAttendance(attendanceList);

      // --- Derive INGREDIENT/PROVISION inventory: purchased (entries) minus used (production.usedIngredients) ---
      // There is no standalone "inventory" collection in Firestore - it's a running balance
      // built from the purchasing log and what production actually consumed.
      const ingredientMovement: Record<string, { name: string; category: string; purchasedQty: number; purchasedCost: number; usedQty: number }> = {};

      entriesList.forEach((e: any) => {
        const rawName = e.item || e.itemName || e.product || e.description || "";
        const key = normalizeKey(rawName);
        if (!key) return;
        if (!ingredientMovement[key]) {
          ingredientMovement[key] = {
            name: String(rawName).trim(),
            category: e.category || e.type || "Ingredients",
            purchasedQty: 0,
            purchasedCost: 0,
            usedQty: 0
          };
        }
        ingredientMovement[key].purchasedQty += parseNumeric(e.quantity || e.qty || e.amount || 0);
        ingredientMovement[key].purchasedCost += parseNumeric(e.totalCost || e.cost || e.price || 0);
      });

      productionList.forEach((pr: any) => {
        if (Array.isArray(pr.usedIngredients)) {
          pr.usedIngredients.forEach((ing: any) => {
            const key = normalizeKey(ing.name);
            if (!key) return;
            if (!ingredientMovement[key]) {
              ingredientMovement[key] = {
                name: String(ing.name || "").trim(),
                category: "Ingredients",
                purchasedQty: 0,
                purchasedCost: 0,
                usedQty: 0
              };
            }
            ingredientMovement[key].usedQty += parseNumeric(ing.qty || 0);
          });
        }
      });

      const inventoryList = Object.values(ingredientMovement).map((ing, idx) => {
        const stockVal = ing.purchasedQty - ing.usedQty;
        const avgUnitCost = ing.purchasedQty > 0 ? ing.purchasedCost / ing.purchasedQty : 0;
        return {
          id: `ING-${idx}`,
          name: ing.name,
          category: ing.category,
          price: avgUnitCost,
          stock: stockVal,
          totalPrice: avgUnitCost * stockVal
        };
      });
      setInventory(inventoryList);
    } catch (e) {
      console.error("Error fetching reports data:", e);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const formatNumber = (num: number) => {
    return parseNumeric(num).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  };

  const formatCurrency = (num: number) => {
    return parseNumeric(num).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <div className="bg-white p-8 flex justify-center">
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page {
            size: letter;
            margin: 10mm;
          }
          body, html {
            height: 100%;
            margin: 0 !important;
            padding: 0 !important;
            overflow: hidden !important;
          }
          body * {
            visibility: hidden;
          }
          #letter-size-report, #letter-size-report * {
            visibility: visible;
          }
          #letter-size-report {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            height: 100% !important;
            max-height: 100vh !important;
            background: white !important;
            margin: 0 !important;
            padding: 15px !important;
            box-shadow: none !important;
            border: none !important;
            z-index: 999999;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
            box-sizing: border-box !important;
            page-break-after: avoid !important;
            page-break-inside: avoid !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}} />

      <div className="max-w-6xl w-full">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3" style={{ color: '#548235' }}>
              <BarChart3 size={32} /> REPORTS MANAGEMENT CENTER
            </h1>
            <p className="text-gray-500 text-sm mt-1">Select any module below to configure date ranges, view detailed sheets, and print professional reports.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-5">
          <div onClick={() => setActiveReportModal("vendors")} className="bg-green-50 border border-[#548235] p-5 rounded-xl cursor-pointer hover:shadow-md transition flex flex-col justify-between group">
            <div>
              <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center border border-[#548235] mb-3 text-[#548235]">
                <Users size={20} />
              </div>
              <h3 className="font-bold text-gray-900 text-lg group-hover:text-[#548235] transition">Vendors</h3>
              <p className="text-xs text-gray-600 mt-1">List existing vendors or view 1 single vendor sheet with items provided.</p>
            </div>
            <div className="mt-4 flex items-center gap-1 text-xs font-bold text-[#548235]">Configure Report <ArrowRight size={14} /></div>
          </div>

          <div onClick={() => setActiveReportModal("customers")} className="bg-green-50 border border-[#548235] p-5 rounded-xl cursor-pointer hover:shadow-md transition flex flex-col justify-between group">
            <div>
              <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center border border-[#548235] mb-3 text-[#548235]">
                <Users size={20} />
              </div>
              <h3 className="font-bold text-gray-900 text-lg group-hover:text-[#548235] transition">Customers</h3>
              <p className="text-xs text-gray-600 mt-1">List existing customers, view a single profile sheet, or generate a customer statement with sales, payments, and balance.</p>
            </div>
            <div className="mt-4 flex items-center gap-1 text-xs font-bold text-[#548235]">Configure Report <ArrowRight size={14} /></div>
          </div>

          <div onClick={() => setActiveReportModal("products")} className="bg-green-50 border border-[#548235] p-5 rounded-xl cursor-pointer hover:shadow-md transition flex flex-col justify-between group">
            <div>
              <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center border border-[#548235] mb-3 text-[#548235]">
                <ShoppingBag size={20} />
              </div>
              <h3 className="font-bold text-gray-900 text-lg group-hover:text-[#548235] transition">Products</h3>
              <p className="text-xs text-gray-600 mt-1">List products by category or view 1 single product specification sheet.</p>
            </div>
            <div className="mt-4 flex items-center gap-1 text-xs font-bold text-[#548235]">Configure Report <ArrowRight size={14} /></div>
          </div>

          <div onClick={() => setActiveReportModal("entries")} className="bg-green-50 border border-[#548235] p-5 rounded-xl cursor-pointer hover:shadow-md transition flex flex-col justify-between group">
            <div>
              <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center border border-[#548235] mb-3 text-[#548235]">
                <ClipboardList size={20} />
              </div>
              <h3 className="font-bold text-gray-900 text-lg group-hover:text-[#548235] transition">Entries</h3>
              <p className="text-xs text-gray-600 mt-1">Date-ranged purchasing and receiving material log report.</p>
            </div>
            <div className="mt-4 flex items-center gap-1 text-xs font-bold text-[#548235]">Configure Report <ArrowRight size={14} /></div>
          </div>

          <div onClick={() => setActiveReportModal("attendance")} className="bg-green-50 border border-[#548235] p-5 rounded-xl cursor-pointer hover:shadow-md transition flex flex-col justify-between group">
            <div>
              <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center border border-[#548235] mb-3 text-[#548235]">
                <Clock size={20} />
              </div>
              <h3 className="font-bold text-gray-900 text-lg group-hover:text-[#548235] transition">Attendance</h3>
              <p className="text-xs text-gray-600 mt-1">Date-ranged worker hours and attendance report log.</p>
            </div>
            <div className="mt-4 flex items-center gap-1 text-xs font-bold text-[#548235]">Configure Report <ArrowRight size={14} /></div>
          </div>

          <div onClick={() => setActiveReportModal("production")} className="bg-green-50 border border-[#548235] p-5 rounded-xl cursor-pointer hover:shadow-md transition flex flex-col justify-between group">
            <div>
              <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center border border-[#548235] mb-3 text-[#548235]">
                <ChefHat size={20} />
              </div>
              <h3 className="font-bold text-gray-900 text-lg group-hover:text-[#548235] transition">Production</h3>
              <p className="text-xs text-gray-600 mt-1">Date-ranged daily kitchen production output reports.</p>
            </div>
            <div className="mt-4 flex items-center gap-1 text-xs font-bold text-[#548235]">Configure Report <ArrowRight size={14} /></div>
          </div>

          <div onClick={() => setActiveReportModal("sales")} className="bg-green-50 border border-[#548235] p-5 rounded-xl cursor-pointer hover:shadow-md transition flex flex-col justify-between group">
            <div>
              <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center border border-[#548235] mb-3 text-[#548235]">
                <ShoppingBag size={20} />
              </div>
              <h3 className="font-bold text-gray-900 text-lg group-hover:text-[#548235] transition">Sales</h3>
              <p className="text-xs text-gray-600 mt-1">Date-ranged invoices, customer sales, and revenue reports.</p>
            </div>
            <div className="mt-4 flex items-center gap-1 text-xs font-bold text-[#548235]">Configure Report <ArrowRight size={14} /></div>
          </div>

          <div onClick={() => setActiveReportModal("inventory")} className="bg-green-50 border border-[#548235] p-5 rounded-xl cursor-pointer hover:shadow-md transition flex flex-col justify-between group">
            <div>
              <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center border border-[#548235] mb-3 text-[#548235]">
                <Package size={20} />
              </div>
              <h3 className="font-bold text-gray-900 text-lg group-hover:text-[#548235] transition">Inventory & Stock</h3>
              <p className="text-xs text-gray-600 mt-1">Issued dated inventory by categories and stock levels.</p>
            </div>
            <div className="mt-4 flex items-center gap-1 text-xs font-bold text-[#548235]">Configure Report <ArrowRight size={14} /></div>
          </div>
        </div>
      </div>

      {activeReportModal && (
        <ReportModal 
          module={activeReportModal}
          onClose={() => setActiveReportModal(null)}
          startDate={startDate}
          setStartDate={setStartDate}
          endDate={endDate}
          setEndDate={setEndDate}
          vendors={vendors}
          customers={customers}
          products={products}
          entries={entries}
          attendance={attendance}
          production={production}
          sales={sales}
          inventory={inventory}
          payments={payments}
          selectedVendorId={selectedVendorId}
          setSelectedVendorId={setSelectedVendorId}
          selectedCustomerId={selectedCustomerId}
          setSelectedCustomerId={setSelectedCustomerId}
          selectedProductId={selectedProductId}
          setSelectedProductId={setSelectedProductId}
          selectedEntryVendor={selectedEntryVendor}
          setSelectedEntryVendor={setSelectedEntryVendor}
          selectedAttendanceWorker={selectedAttendanceWorker}
          setSelectedAttendanceWorker={setSelectedAttendanceWorker}
          selectedSalesCustomer={selectedSalesCustomer}
          setSelectedSalesCustomer={setSelectedSalesCustomer}
          inventoryStockTab={inventoryStockTab}
          setInventoryStockTab={setInventoryStockTab}
          selectedInventorySubcategory={selectedInventorySubcategory}
          setSelectedInventorySubcategory={setSelectedInventorySubcategory}
          selectedStockCategory={selectedStockCategory}
          setSelectedStockCategory={setSelectedStockCategory}
          formatNumber={formatNumber}
          formatCurrency={formatCurrency}
          parseNumeric={parseNumeric}
          formatDateField={formatDateField}
        />
      )}
    </div>
  );
}

function ReportModal({
  module,
  onClose,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  vendors,
  customers,
  products,
  entries,
  attendance,
  production,
  sales,
  inventory,
  payments,
  selectedVendorId,
  setSelectedVendorId,
  selectedCustomerId,
  setSelectedCustomerId,
  selectedProductId,
  setSelectedProductId,
  selectedEntryVendor,
  setSelectedEntryVendor,
  selectedAttendanceWorker,
  setSelectedAttendanceWorker,
  selectedSalesCustomer,
  setSelectedSalesCustomer,
  inventoryStockTab,
  setInventoryStockTab,
  selectedInventorySubcategory,
  setSelectedInventorySubcategory,
  selectedStockCategory,
  setSelectedStockCategory,
  formatNumber,
  formatCurrency,
  parseNumeric,
  formatDateField
}: any) {
  const [reportSubtype, setReportSubtype] = useState<string>(
    ["vendors", "customers", "products"].includes(module) ? "list" : "date-range"
  );

  // --- Customer Statement derived data ---
  const statementCustomer = customers.find((c: any) => c.id === selectedCustomerId);
  const statementCustomerName = statementCustomer
    ? (statementCustomer.name || statementCustomer.customerName || statementCustomer.fullName || "")
    : "";

  const statementSales = module === "customers" && reportSubtype === "statement"
    ? sales.filter((s: any) => {
        const itemDate = s.date;
        if (!itemDate) return false;
        const inRange = (!startDate || itemDate >= startDate) && (!endDate || itemDate <= endDate);
        return inRange && !!statementCustomerName && s.customerName === statementCustomerName;
      })
    : [];

  const statementPayments = module === "customers" && reportSubtype === "statement"
    ? payments.filter((p: any) => {
        const itemDate = p.date;
        if (!itemDate) return false;
        const inRange = (!startDate || itemDate >= startDate) && (!endDate || itemDate <= endDate);
        return inRange && !!statementCustomerName && p.customerName === statementCustomerName;
      })
    : [];

  const statementTotalSales = statementSales.reduce((sum: number, s: any) => sum + parseNumeric(s.totalRevenue), 0);
  const statementTotalPayments = statementPayments.reduce((sum: number, p: any) => sum + parseNumeric(p.amount), 0);
  const statementTotalBalance = statementTotalSales - statementTotalPayments;

  const statementTransactionsBase = [
    ...statementSales.map((s: any) => ({
      date: s.date,
      type: "Sale",
      description: s.itemsSummary || "Sale",
      charge: parseNumeric(s.totalRevenue),
      credit: 0
    })),
    ...statementPayments.map((p: any) => ({
      date: p.date,
      type: "Payment",
      description: p.method || p.note || "Payment received",
      charge: 0,
      credit: parseNumeric(p.amount)
    }))
  ].sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")));

  let statementRunningTotal = 0;
  const statementTransactions = statementTransactionsBase.map((t) => {
    statementRunningTotal += t.charge - t.credit;
    return { ...t, runningBalance: statementRunningTotal };
  });

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto" style={{ paddingLeft: 'calc(1rem + 3cm)' }}>
      <div 
        id="letter-size-report"
        className="bg-white p-6 rounded-xl w-full max-w-5xl shadow-2xl relative my-8 flex flex-col justify-between"
        style={{ minHeight: '80vh' }}
      >
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 no-print">
          <X size={24} />
        </button>

        <div>
          <div className="flex justify-between items-start border-b border-gray-200 pb-4 mb-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center font-black text-white text-xl shadow-md" style={{ backgroundColor: '#548235' }}>
                P
              </div>
              <div>
                <h2 className="text-2xl font-black uppercase tracking-wider text-gray-900">
                  {module === "inventory" 
                    ? (inventoryStockTab === "inventory" ? "Inventory Report" : "Stock Report") 
                    : module === "customers" && reportSubtype === "statement"
                    ? "Customer Statement"
                    : `${module} Report`}
                </h2>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mt-0.5">Pizzatta Business Management System</p>
              </div>
            </div>
            <div className="flex items-center gap-3 no-print">
              <button 
                onClick={() => window.print()} 
                className="flex items-center gap-2 px-4 py-2 bg-[#548235] text-white font-bold text-sm rounded-lg hover:bg-opacity-90 shadow-sm transition"
              >
                <Printer size={16} /> Print Report
              </button>
              <span className="text-xs bg-green-50 text-[#548235] font-bold px-3 py-1 rounded-full border border-[#548235]">
                Report Configuration
              </span>
            </div>
          </div>

          {/* Gorgeous Tabs for Inventory & Stock */}
          {module === "inventory" && (
            <div className="flex gap-2 mb-4 no-print border-b border-gray-200 pb-2">
              <button
                onClick={() => setInventoryStockTab("inventory")}
                className={`px-5 py-2.5 rounded-lg font-bold text-sm transition shadow-sm ${
                  inventoryStockTab === "inventory"
                    ? "bg-[#548235] text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                Inventory (Ingredients & Provisions)
              </button>
              <button
                onClick={() => setInventoryStockTab("stock")}
                className={`px-5 py-2.5 rounded-lg font-bold text-sm transition shadow-sm ${
                  inventoryStockTab === "stock"
                    ? "bg-[#548235] text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                Stock (Products)
              </button>
            </div>
          )}

          <div className="bg-green-50 p-4 rounded-lg border border-[#548235] mb-6 no-print flex flex-row flex-nowrap gap-4 items-end justify-between overflow-x-auto">
            <div className="flex flex-row flex-nowrap gap-4 items-end">
              {["vendors", "customers", "products"].includes(module) && (
                <div className="flex-shrink-0">
                  <label className="block text-xs font-bold text-gray-700 mb-1">Report Option</label>
                  <select
                    className="p-2 border border-[#548235] rounded bg-white text-sm font-semibold text-gray-800"
                    value={reportSubtype}
                    onChange={(e) => setReportSubtype(e.target.value)}
                  >
                    <option value="list">List of Existing ({module})</option>
                    <option value="single">Single Sheet Details</option>
                    {module === "customers" && (
                      <option value="statement">Customer Statement</option>
                    )}
                  </select>
                </div>
              )}

              {reportSubtype === "single" && module === "vendors" && (
                <div className="flex-shrink-0">
                  <label className="block text-xs font-bold text-gray-700 mb-1">Select Vendor</label>
                  <select
                    className="p-2 border border-[#548235] rounded bg-white text-sm text-gray-800"
                    value={selectedVendorId}
                    onChange={(e) => setSelectedVendorId(e.target.value)}
                  >
                    <option value="">-- Choose Vendor --</option>
                    {vendors.map((v: any) => (
                      <option key={v.id} value={v.id}>{v.name || v.vendorName || v.fullName}</option>
                    ))}
                  </select>
                </div>
              )}

              {(reportSubtype === "single" || reportSubtype === "statement") && module === "customers" && (
                <div className="flex-shrink-0">
                  <label className="block text-xs font-bold text-gray-700 mb-1">Select Customer</label>
                  <select
                    className="p-2 border border-[#548235] rounded bg-white text-sm text-gray-800"
                    value={selectedCustomerId}
                    onChange={(e) => setSelectedCustomerId(e.target.value)}
                  >
                    <option value="">-- Choose Customer --</option>
                    {customers.map((c: any) => (
                      <option key={c.id} value={c.id}>{c.name || c.customerName || c.fullName}</option>
                    ))}
                  </select>
                </div>
              )}

              {reportSubtype === "statement" && module === "customers" && (
                <>
                  <div className="flex-shrink-0">
                    <label className="block text-xs font-bold text-gray-700 mb-1">Start Date</label>
                    <input
                      type="date"
                      className="p-2 border border-[#548235] rounded bg-white text-sm text-gray-800"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>
                  <div className="flex-shrink-0">
                    <label className="block text-xs font-bold text-gray-700 mb-1">End Date</label>
                    <input
                      type="date"
                      className="p-2 border border-[#548235] rounded bg-white text-sm text-gray-800"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </div>
                </>
              )}

              {reportSubtype === "single" && module === "products" && (
                <div className="flex-shrink-0">
                  <label className="block text-xs font-bold text-gray-700 mb-1">Select Product</label>
                  <select
                    className="p-2 border border-[#548235] rounded bg-white text-sm text-gray-800"
                    value={selectedProductId}
                    onChange={(e) => setSelectedProductId(e.target.value)}
                  >
                    <option value="">-- Choose Product --</option>
                    {products.map((p: any) => (
                      <option key={p.id} value={p.id}>{p.name || p.productName || p.title}</option>
                    ))}
                  </select>
                </div>
              )}

              {module === "entries" && (
                <>
                  <div className="flex-shrink-0">
                    <label className="block text-xs font-bold text-gray-700 mb-1">Filter Vendor</label>
                    <select
                      className="p-2 border border-[#548235] rounded bg-white text-sm text-gray-800"
                      value={selectedEntryVendor}
                      onChange={(e) => setSelectedEntryVendor(e.target.value)}
                    >
                      <option value="ALL">-- All Vendors --</option>
                      {vendors.map((v: any) => (
                        <option key={v.id} value={v.name || v.vendorName || v.fullName}>{v.name || v.vendorName || v.fullName}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex-shrink-0">
                    <label className="block text-xs font-bold text-gray-700 mb-1">Start Date</label>
                    <input
                      type="date"
                      className="p-2 border border-[#548235] rounded bg-white text-sm text-gray-800"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>
                  <div className="flex-shrink-0">
                    <label className="block text-xs font-bold text-gray-700 mb-1">End Date</label>
                    <input
                      type="date"
                      className="p-2 border border-[#548235] rounded bg-white text-sm text-gray-800"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </div>
                </>
              )}

              {module === "attendance" && (
                <>
                  <div className="flex-shrink-0">
                    <label className="block text-xs font-bold text-gray-700 mb-1">Select Worker</label>
                    <select
                      className="p-2 border border-[#548235] rounded bg-white text-sm text-gray-800"
                      value={selectedAttendanceWorker}
                      onChange={(e) => setSelectedAttendanceWorker(e.target.value)}
                    >
                      <option value="ALL">-- All Registered Workers --</option>
                      {(() => {
                        const workersList: string[] = [];
                        attendance.forEach((a: any) => {
                          const wName = (a.workerName || "").trim();
                          if (wName && !workersList.includes(wName)) {
                            workersList.push(wName);
                          }
                        });
                        return workersList.map((w: string, idx: number) => (
                          <option key={idx} value={w}>{w}</option>
                        ));
                      })()}
                    </select>
                  </div>
                  <div className="flex-shrink-0">
                    <label className="block text-xs font-bold text-gray-700 mb-1">Start Date</label>
                    <input
                      type="date"
                      className="p-2 border border-[#548235] rounded bg-white text-sm text-gray-800"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>
                  <div className="flex-shrink-0">
                    <label className="block text-xs font-bold text-gray-700 mb-1">End Date</label>
                    <input
                      type="date"
                      className="p-2 border border-[#548235] rounded bg-white text-sm text-gray-800"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </div>
                </>
              )}

              {module === "production" && (
                <>
                  <div className="flex-shrink-0">
                    <label className="block text-xs font-bold text-gray-700 mb-1">Start Date</label>
                    <input
                      type="date"
                      className="p-2 border border-[#548235] rounded bg-white text-sm text-gray-800"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>
                  <div className="flex-shrink-0">
                    <label className="block text-xs font-bold text-gray-700 mb-1">End Date</label>
                    <input
                      type="date"
                      className="p-2 border border-[#548235] rounded bg-white text-sm text-gray-800"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </div>
                </>
              )}

              {module === "sales" && (
                <>
                  <div className="flex-shrink-0">
                    <label className="block text-xs font-bold text-gray-700 mb-1">Customer Filter</label>
                    <select
                      className="p-2 border border-[#548235] rounded bg-white text-sm text-gray-800"
                      value={selectedSalesCustomer}
                      onChange={(e) => setSelectedSalesCustomer(e.target.value)}
                    >
                      <option value="ALL">-- All Customers --</option>
                      {customers.map((c: any) => (
                        <option key={c.id} value={c.name || c.customerName || c.fullName}>{c.name || c.customerName || c.fullName}</option>
                      ))}
                      <option value="Walk-in Customer">Walk-in Customer</option>
                    </select>
                  </div>
                  <div className="flex-shrink-0">
                    <label className="block text-xs font-bold text-gray-700 mb-1">Start Date</label>
                    <input
                      type="date"
                      className="p-2 border border-[#548235] rounded bg-white text-sm text-gray-800"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>
                  <div className="flex-shrink-0">
                    <label className="block text-xs font-bold text-gray-700 mb-1">End Date</label>
                    <input
                      type="date"
                      className="p-2 border border-[#548235] rounded bg-white text-sm text-gray-800"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </div>
                </>
              )}

              {module === "inventory" && inventoryStockTab === "inventory" && (
                <div className="flex-shrink-0">
                  <label className="block text-xs font-bold text-gray-700 mb-1">Inventory Category Filter</label>
                  <select
                    className="p-2 border border-[#548235] rounded bg-white text-sm text-gray-800 font-semibold"
                    value={selectedInventorySubcategory}
                    onChange={(e) => setSelectedInventorySubcategory(e.target.value)}
                  >
                    <option value="ALL">-- All Inventory Categories --</option>
                    <option value="Ingredients">Ingredients</option>
                    <option value="Provisions">Provisions</option>
                  </select>
                </div>
              )}

              {module === "inventory" && inventoryStockTab === "stock" && (
                <div className="flex-shrink-0">
                  <label className="block text-xs font-bold text-gray-700 mb-1">Stock Category Filter</label>
                  <select
                    className="p-2 border border-[#548235] rounded bg-white text-sm text-gray-800 font-semibold"
                    value={selectedStockCategory}
                    onChange={(e) => setSelectedStockCategory(e.target.value)}
                  >
                    <option value="ALL">-- All Stock Categories --</option>
                    {(() => {
                      const cats: string[] = [];
                      products.forEach((p: any) => {
                        const cat = p.category || p.type || "";
                        if (cat && !cats.includes(cat)) cats.push(cat);
                      });
                      return cats.map((cat: string, idx: number) => (
                        <option key={idx} value={cat}>{cat}</option>
                      ));
                    })()}
                  </select>
                </div>
              )}
            </div>

            {/* Grand Total Green Square on Far Right */}
            {["entries", "production", "sales", "inventory"].includes(module) && (
              <div className="flex-shrink-0 bg-white border-2 border-[#548235] px-4 py-2 rounded-lg text-right shadow-sm ml-auto">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block">Grand Total</span>
                <span className="text-lg font-black text-[#548235]">
                  ${formatCurrency(
                    module === "sales" 
                      ? sales
                          .filter((item: any) => {
                            const itemDate = item.date;
                            if (!itemDate) return false;
                            const inRange = (!startDate || itemDate >= startDate) && (!endDate || itemDate <= endDate);
                            const matchesCust = selectedSalesCustomer === "ALL" || item.customerName === selectedSalesCustomer;
                            return inRange && matchesCust;
                          })
                          .reduce((sum: number, curr: any) => sum + curr.totalRevenue, 0)
                      : module === "entries"
                      ? entries
                          .filter((item: any) => {
                            const itemDate = item.date;
                            if (!itemDate) return false;
                            const inRange = (!startDate || itemDate >= startDate) && (!endDate || itemDate <= endDate);
                            const vName = item.vendor || item.vendorName || item.supplier || "";
                            const matchesVendor = selectedEntryVendor === "ALL" || vName === selectedEntryVendor;
                            return inRange && matchesVendor;
                          })
                          .reduce((sum: number, curr: any) => sum + parseNumeric(curr.totalCost || curr.cost || curr.price || 0), 0)
                      : module === "production"
                      ? production
                          .filter((item: any) => {
                            const itemDate = item.date;
                            if (!itemDate) return false;
                            return (!startDate || itemDate >= startDate) && (!endDate || itemDate <= endDate);
                          })
                          .reduce((sum: number, curr: any) => sum + curr.totalCost, 0)
                      : module === "inventory" && inventoryStockTab === "inventory"
                      ? inventory
                          .filter((item: any) => {
                            const cat = (item.category || item.type || "Ingredients").toLowerCase();
                            if (selectedInventorySubcategory === "ALL") return true;
                            return cat.includes(selectedInventorySubcategory.toLowerCase());
                          })
                          .reduce((sum: number, curr: any) => sum + parseNumeric(curr.totalPrice || (curr.price * curr.stock) || 0), 0)
                      : module === "inventory" && inventoryStockTab === "stock"
                      ? products
                          .filter((item: any) => {
                            const cat = item.category || item.type || "";
                            if (selectedStockCategory === "ALL") return true;
                            return cat === selectedStockCategory;
                          })
                          .reduce((sum: number, curr: any) => sum + parseNumeric(curr.totalPrice || (curr.price * curr.stock) || 0), 0)
                      : 0
                  )}
                </span>
              </div>
            )}

            {module === "customers" && reportSubtype === "statement" && (
              <div className="flex-shrink-0 flex gap-3 ml-auto">
                <div className="bg-white border-2 border-[#548235] px-4 py-2 rounded-lg text-right shadow-sm">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block">Total Sales</span>
                  <span className="text-lg font-black text-[#548235]">${formatCurrency(statementTotalSales)}</span>
                </div>
                <div className="bg-white border-2 border-[#548235] px-4 py-2 rounded-lg text-right shadow-sm">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block">Total Payments</span>
                  <span className="text-lg font-black text-[#548235]">${formatCurrency(statementTotalPayments)}</span>
                </div>
                <div className="bg-white border-2 border-[#548235] px-4 py-2 rounded-lg text-right shadow-sm">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block">Balance Due</span>
                  <span className={`text-lg font-black ${statementTotalBalance > 0 ? "text-red-600" : "text-[#548235]"}`}>
                    ${formatCurrency(statementTotalBalance)}
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-4">
            {module === "vendors" && reportSubtype === "list" && (
              <div>
                <h3 className="font-bold text-lg mb-3 text-gray-800">Vendors Directory List</h3>
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-gray-300 text-gray-700">
                      <th className="py-2 font-bold">Vendor Name</th>
                      <th className="py-2 font-bold">Contact Person</th>
                      <th className="py-2 font-bold">Phone</th>
                      <th className="py-2 font-bold">Email</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vendors.length === 0 ? (
                      <tr><td colSpan={4} className="text-center py-6 text-gray-400">No vendors found.</td></tr>
                    ) : (
                      vendors.map((v: any, idx: number) => (
                        <tr key={v.id || idx} className="border-b border-gray-100">
                          <td className="py-2 font-semibold text-gray-900">{v.name || v.vendorName || v.fullName || "N/A"}</td>
                          <td className="py-2 text-gray-700">{v.contactPerson || v.contact || "-"}</td>
                          <td className="py-2 text-gray-700">{v.phone || v.telephone || "-"}</td>
                          <td className="py-2 text-gray-700">{v.email || "-"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {module === "vendors" && reportSubtype === "single" && (
              <div>
                <h3 className="font-bold text-lg mb-3 text-gray-800">Single Vendor Sheet Details</h3>
                {selectedVendorId ? (
                  (() => {
                    const v = vendors.find((item: any) => item.id === selectedVendorId);
                    if (!v) return <p className="text-gray-500">Vendor not found.</p>;
                    return (
                      <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 space-y-3">
                        <div className="grid grid-cols-2 gap-4">
                          <div><span className="text-xs text-gray-500 block font-bold">Vendor Name</span><span className="text-base font-bold text-gray-900">{v.name || v.vendorName || v.fullName}</span></div>
                          <div><span className="text-xs text-gray-500 block font-bold">Contact Person</span><span className="text-base text-gray-800">{v.contactPerson || v.contact || "N/A"}</span></div>
                          <div><span className="text-xs text-gray-500 block font-bold">Phone Number</span><span className="text-base text-gray-800">{v.phone || v.telephone || "N/A"}</span></div>
                          <div><span className="text-xs text-gray-500 block font-bold">Email Address</span><span className="text-base text-gray-800">{v.email || "N/A"}</span></div>
                        </div>
                        <div>
                          <span className="text-xs text-gray-500 block font-bold mt-2">Address / Notes</span>
                          <p className="text-sm text-gray-700 bg-white p-3 rounded border border-gray-200 mt-1">{v.address || v.notes || "No additional address details provided."}</p>
                        </div>
                      </div>
                    );
                  })()
                ) : (
                  <p className="text-gray-400 py-6 text-center">Please select a vendor from the configuration bar above to view their details sheet.</p>
                )}
              </div>
            )}

            {module === "customers" && reportSubtype === "list" && (
              <div>
                <h3 className="font-bold text-lg mb-3 text-gray-800">Customers Directory List</h3>
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-gray-300 text-gray-700">
                      <th className="py-2 font-bold">Customer Name</th>
                      <th className="py-2 font-bold">Phone</th>
                      <th className="py-2 font-bold">Email</th>
                      <th className="py-2 font-bold">Address</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customers.length === 0 ? (
                      <tr><td colSpan={4} className="text-center py-6 text-gray-400">No customers found.</td></tr>
                    ) : (
                      customers.map((c: any, idx: number) => (
                        <tr key={c.id || idx} className="border-b border-gray-100">
                          <td className="py-2 font-semibold text-gray-900">{c.name || c.customerName || c.fullName || "N/A"}</td>
                          <td className="py-2 text-gray-700">{c.phone || c.telephone || "-"}</td>
                          <td className="py-2 text-gray-700">{c.email || "-"}</td>
                          <td className="py-2 text-gray-700">{c.address || "-"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {module === "customers" && reportSubtype === "single" && (
              <div>
                <h3 className="font-bold text-lg mb-3 text-gray-800">Single Customer Profile Sheet</h3>
                {selectedCustomerId ? (
                  (() => {
                    const c = customers.find((item: any) => item.id === selectedCustomerId);
                    if (!c) return <p className="text-gray-500">Customer not found.</p>;
                    return (
                      <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 space-y-3">
                        <div className="grid grid-cols-2 gap-4">
                          <div><span className="text-xs text-gray-500 block font-bold">Customer Name</span><span className="text-base font-bold text-gray-900">{c.name || c.customerName || c.fullName}</span></div>
                          <div><span className="text-xs text-gray-500 block font-bold">Phone Number</span><span className="text-base text-gray-800">{c.phone || c.telephone || "N/A"}</span></div>
                          <div><span className="text-xs text-gray-500 block font-bold">Email Address</span><span className="text-base text-gray-800">{c.email || "N/A"}</span></div>
                          <div><span className="text-xs text-gray-500 block font-bold">Address</span><span className="text-base text-gray-800">{c.address || "N/A"}</span></div>
                        </div>
                      </div>
                    );
                  })()
                ) : (
                  <p className="text-gray-400 py-6 text-center">Please select a customer from the configuration bar above to view their profile sheet.</p>
                )}
              </div>
            )}

            {module === "customers" && reportSubtype === "statement" && (
              <div>
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-bold text-lg text-gray-800">
                    Customer Statement{statementCustomerName ? `: ${statementCustomerName}` : ""}
                  </h3>
                  <span className="text-xs text-gray-500 font-semibold">
                    Date Range: {startDate} to {endDate}
                  </span>
                </div>

                {!selectedCustomerId ? (
                  <div className="text-center py-6 text-gray-400">
                    Please select a customer to generate their statement.
                  </div>
                ) : (
                  <>
                    <table className="w-full border-collapse text-left text-sm">
                      <thead>
                        <tr className="border-b border-gray-300 text-gray-700">
                          <th className="py-2 font-bold">Date</th>
                          <th className="py-2 font-bold">Type</th>
                          <th className="py-2 font-bold">Description</th>
                          <th className="py-2 font-bold text-right">Charge (Sale)</th>
                          <th className="py-2 font-bold text-right">Credit (Payment)</th>
                          <th className="py-2 font-bold text-right">Balance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {statementTransactions.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="text-center py-6 text-gray-400">
                              No transactions found for the selected date range.
                            </td>
                          </tr>
                        ) : (
                          statementTransactions.map((t: any, idx: number) => (
                            <tr key={idx} className="border-b border-gray-100 align-top">
                              <td className="py-2 text-gray-800">{t.date || "-"}</td>
                              <td className="py-2 font-semibold text-gray-900">{t.type}</td>
                              <td className="py-2 text-xs text-gray-700">{t.description}</td>
                              <td className="py-2 text-right text-gray-800">{t.charge > 0 ? `$${formatCurrency(t.charge)}` : "-"}</td>
                              <td className="py-2 text-right text-[#548235]">{t.credit > 0 ? `$${formatCurrency(t.credit)}` : "-"}</td>
                              <td className="py-2 text-right font-bold text-gray-900">${formatCurrency(t.runningBalance)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>

                    <div className="flex justify-end gap-6 mt-6 pt-4 border-t border-gray-200">
                      <div className="text-right">
                        <span className="text-xs font-bold uppercase tracking-wider text-gray-500 block">Total Sales</span>
                        <span className="text-xl font-black text-[#548235]">${formatCurrency(statementTotalSales)}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-bold uppercase tracking-wider text-gray-500 block">Total Payments</span>
                        <span className="text-xl font-black text-[#548235]">${formatCurrency(statementTotalPayments)}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-bold uppercase tracking-wider text-gray-500 block">Balance Due</span>
                        <span className={`text-xl font-black ${statementTotalBalance > 0 ? "text-red-600" : "text-[#548235]"}`}>
                          ${formatCurrency(statementTotalBalance)}
                        </span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {module === "products" && reportSubtype === "list" && (
              <div>
                <h3 className="font-bold text-lg mb-3 text-gray-800">Products Catalog List</h3>
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-gray-300 text-gray-700">
                      <th className="py-2 font-bold">Product Name</th>
                      <th className="py-2 font-bold">Category</th>
                      <th className="py-2 font-bold">Price</th>
                      <th className="py-2 font-bold">Stock</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.length === 0 ? (
                      <tr><td colSpan={4} className="text-center py-6 text-gray-400">No products found.</td></tr>
                    ) : (
                      products.map((p: any, idx: number) => (
                        <tr key={p.id || idx} className="border-b border-gray-100">
                          <td className="py-2 font-semibold text-gray-900">{p.name || p.productName || p.title || "N/A"}</td>
                          <td className="py-2 text-gray-700">{p.category || p.type || "-"}</td>
                          <td className="py-2 text-gray-700">${formatCurrency(p.price)}</td>
                          <td className="py-2 text-gray-700">{formatNumber(p.stock)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {module === "products" && reportSubtype === "single" && (
              <div>
                <h3 className="font-bold text-lg mb-3 text-gray-800">Single Product Specification Sheet</h3>
                {selectedProductId ? (
                  (() => {
                    const p = products.find((item: any) => item.id === selectedProductId);
                    if (!p) return <p className="text-gray-500">Product not found.</p>;
                    return (
                      <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 space-y-3">
                        <div className="grid grid-cols-2 gap-4">
                          <div><span className="text-xs text-gray-500 block font-bold">Product Name</span><span className="text-base font-bold text-gray-900">{p.name || p.productName || p.title}</span></div>
                          <div><span className="text-xs text-gray-500 block font-bold">Category</span><span className="text-base text-gray-800">{p.category || p.type || "N/A"}</span></div>
                          <div><span className="text-xs text-gray-500 block font-bold">Unit Price</span><span className="text-base text-gray-800">${formatCurrency(p.price)}</span></div>
                          <div><span className="text-xs text-gray-500 block font-bold">Current Stock</span><span className="text-base text-gray-800">{formatNumber(p.stock)}</span></div>
                        </div>
                      </div>
                    );
                  })()
                ) : (
                  <p className="text-gray-400 py-6 text-center">Please select a product from the configuration bar above to view its specification sheet.</p>
                )}
              </div>
            )}

            {module === "entries" && (
              <div>
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-bold text-lg text-gray-800">Purchasing & Receiving Entries Report</h3>
                  <span className="text-xs text-gray-500 font-semibold">
                    Date Range: {startDate} to {endDate} {selectedEntryVendor !== "ALL" ? `| Vendor: ${selectedEntryVendor}` : ""}
                  </span>
                </div>
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-gray-300 text-gray-700">
                      <th className="py-2 font-bold">Doc ID</th>
                      <th className="py-2 font-bold">Date</th>
                      <th className="py-2 font-bold">Vendor</th>
                      <th className="py-2 font-bold">Item / Description</th>
                      <th className="py-2 font-bold">Quantity</th>
                      <th className="py-2 font-bold">Total Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const filteredEntries = entries.filter((item: any) => {
                        const itemDate = item.date;
                        if (!itemDate) return false;
                        const inRange = (!startDate || itemDate >= startDate) && (!endDate || itemDate <= endDate);
                        const vName = item.vendor || item.vendorName || item.supplier || "";
                        const matchesVendor = selectedEntryVendor === "ALL" || vName === selectedEntryVendor;
                        return inRange && matchesVendor;
                      });

                      if (filteredEntries.length === 0) {
                        return (
                          <tr>
                            <td colSpan={6} className="text-center py-6 text-gray-400">
                              No entries found for the selected date range and vendor filter.
                            </td>
                          </tr>
                        );
                      }

                      return filteredEntries.map((e: any, idx: number) => {
                        const qty = parseNumeric(e.quantity || e.qty || e.amount || 0);
                        const cost = parseNumeric(e.totalCost || e.cost || e.price || 0);
                        return (
                          <tr key={e.id || idx} className="border-b border-gray-100">
                            <td className="py-2 font-mono text-xs text-gray-600">{e.generatedDocId}</td>
                            <td className="py-2 text-gray-800">{e.date || "-"}</td>
                            <td className="py-2 font-semibold text-gray-900">{e.vendor || e.vendorName || e.supplier || "N/A"}</td>
                            <td className="py-2 text-gray-700">{e.item || e.itemName || e.product || e.description || "N/A"}</td>
                            <td className="py-2 text-gray-700">{formatNumber(qty)}</td>
                            <td className="py-2 font-bold text-[#548235]">${formatCurrency(cost)}</td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>
            )}

            {module === "attendance" && (
              <div>
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-bold text-lg text-gray-800">Attendance Report Log</h3>
                  <span className="text-xs text-gray-500 font-semibold">
                    Date Range: {startDate} to {endDate} {selectedAttendanceWorker !== "ALL" ? `| Worker: ${selectedAttendanceWorker}` : ""}
                  </span>
                </div>

                {/* Operator Summary Section */}
                {(() => {
                  const filteredAttendance = attendance.filter((item: any) => {
                    const itemDate = item.date;
                    if (!itemDate) return false;
                    const inRange = (!startDate || itemDate >= startDate) && (!endDate || itemDate <= endDate);
                    const matchesWorker = selectedAttendanceWorker === "ALL" || item.workerName === selectedAttendanceWorker;
                    return inRange && matchesWorker;
                  });

                  const totalEntries = filteredAttendance.length;
                  const uniqueWorkers = new Set(filteredAttendance.map((a: any) => a.workerName)).size;

                  return (
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="bg-green-50 p-3 rounded-lg border border-[#548235]">
                        <span className="text-xs text-gray-600 font-bold block">Total Logged Entries</span>
                        <span className="text-xl font-black text-[#548235]">{totalEntries}</span>
                      </div>
                      <div className="bg-green-50 p-3 rounded-lg border border-[#548235]">
                        <span className="text-xs text-gray-600 font-bold block">Active Workers in Range</span>
                        <span className="text-xl font-black text-[#548235]">{uniqueWorkers}</span>
                      </div>
                    </div>
                  );
                })()}

                {/* Detailed Records Table */}
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-gray-300 text-gray-700">
                      <th className="py-2 font-bold">Date</th>
                      <th className="py-2 font-bold">Worker Name</th>
                      <th className="py-2 font-bold">In Time</th>
                      <th className="py-2 font-bold">Out Time</th>
                      <th className="py-2 font-bold">Worked Hours</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const filteredAttendance = attendance.filter((item: any) => {
                        const itemDate = item.date;
                        if (!itemDate) return false;
                        const inRange = (!startDate || itemDate >= startDate) && (!endDate || itemDate <= endDate);
                        const matchesWorker = selectedAttendanceWorker === "ALL" || item.workerName === selectedAttendanceWorker;
                        return inRange && matchesWorker;
                      });

                      if (filteredAttendance.length === 0) {
                        return (
                          <tr>
                            <td colSpan={5} className="text-center py-6 text-gray-400">
                              No attendance records found for the selected range and worker.
                            </td>
                          </tr>
                        );
                      }

                      return filteredAttendance.map((a: any, idx: number) => {
                        const cleanInTime = a.inTime ? String(a.inTime).split(" ").pop() : "-";
                        const cleanOutTime = a.outTime ? String(a.outTime).split(" ").pop() : "-";
                        return (
                          <tr key={a.id || idx} className="border-b border-gray-100">
                            <td className="py-2 text-gray-800">{a.date || "-"}</td>
                            <td className="py-2 font-semibold text-gray-900">{a.workerName || "N/A"}</td>
                            <td className="py-2 text-gray-700">{cleanInTime}</td>
                            <td className="py-2 text-gray-700">{cleanOutTime}</td>
                            <td className="py-2 font-bold text-[#548235]">{a.workedHours || "0.00 hrs"}</td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>
            )}

            {module === "production" && (
              <div>
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-bold text-lg text-gray-800">Kitchen Production Output Report</h3>
                  <span className="text-xs text-gray-500 font-semibold">Date Range: {startDate} to {endDate}</span>
                </div>
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-gray-300 text-gray-700">
                      <th className="py-2 font-bold">Date</th>
                      <th className="py-2 font-bold">Product Name</th>
                      <th className="py-2 font-bold">Quantity</th>
                      <th className="py-2 font-bold">Total Cost</th>
                      <th className="py-2 font-bold">Used Ingredients</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const filteredProduction = production.filter((item: any) => {
                        const itemDate = item.date;
                        if (!itemDate) return false;
                        return (!startDate || itemDate >= startDate) && (!endDate || itemDate <= endDate);
                      });

                      if (filteredProduction.length === 0) {
                        return (
                          <tr>
                            <td colSpan={5} className="text-center py-6 text-gray-400">
                              No production logs found for the selected date range.
                            </td>
                          </tr>
                        );
                      }

                      return filteredProduction.map((pr: any, idx: number) => {
                        return (
                          <tr key={pr.id || idx} className="border-b border-gray-100 align-top">
                            <td className="py-2 text-gray-800">{pr.date || "-"}</td>
                            <td className="py-2 font-semibold text-gray-900">{pr.productName}</td>
                            <td className="py-2 text-gray-700">{formatNumber(pr.quantity)}</td>
                            <td className="py-2 font-bold text-[#548235]">${formatCurrency(pr.totalCost)}</td>
                            <td className="py-2 text-xs text-gray-600">
                              {Array.isArray(pr.usedIngredients) && pr.usedIngredients.length > 0 ? (
                                <ul className="space-y-1">
                                  {pr.usedIngredients.map((ing: any, iIdx: number) => (
                                    <li key={iIdx}>
                                      • {ing.name}: {formatNumber(ing.qty)} {ing.unit || ""} ({formatNumber(ing.cost ? (ing.cost / (ing.qty || 1)) * 100 : 0)}%) - ${formatCurrency(ing.cost || 0)}
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <span>-</span>
                              )}
                            </td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>
            )}

            {module === "sales" && (
              <div>
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-bold text-lg text-gray-800">Sales Invoices & Revenue Report</h3>
                  <span className="text-xs text-gray-500 font-semibold">
                    Date Range: {startDate} to {endDate} {selectedSalesCustomer !== "ALL" ? `| Customer: ${selectedSalesCustomer}` : ""}
                  </span>
                </div>
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-gray-300 text-gray-700">
                      <th className="py-2 font-bold">Date</th>
                      <th className="py-2 font-bold">Customer</th>
                      <th className="py-2 font-bold">Items Sold</th>
                      <th className="py-2 font-bold">Total Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const filteredSales = sales.filter((item: any) => {
                        const itemDate = item.date;
                        if (!itemDate) return false;
                        const inRange = (!startDate || itemDate >= startDate) && (!endDate || itemDate <= endDate);
                        const matchesCust = selectedSalesCustomer === "ALL" || item.customerName === selectedSalesCustomer;
                        return inRange && matchesCust;
                      });

                      if (filteredSales.length === 0) {
                        return (
                          <tr>
                            <td colSpan={4} className="text-center py-6 text-gray-400">
                              No sales records found for the selected range and customer filter.
                            </td>
                          </tr>
                        );
                      }

                      return filteredSales.map((s: any, idx: number) => {
                        return (
                          <tr key={s.id || idx} className="border-b border-gray-100 align-top">
                            <td className="py-2 text-gray-800">{s.date || "-"}</td>
                            <td className="py-2 font-semibold text-gray-900">{s.customerName}</td>
                            <td className="py-2 text-xs text-gray-700">
                              {s.itemsSummary}
                            </td>
                            <td className="py-2 font-bold text-[#548235]">${formatCurrency(s.totalRevenue)}</td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>
            )}

            {module === "inventory" && inventoryStockTab === "inventory" && (
              <div>
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-bold text-lg text-gray-800">Inventory Valuation Report</h3>
                  <span className="text-xs text-gray-500 font-semibold">Category: {selectedInventorySubcategory}</span>
                </div>
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-gray-300 text-gray-700">
                      <th className="py-2 font-bold">Item Name</th>
                      <th className="py-2 font-bold">Category</th>
                      <th className="py-2 font-bold">Unit Price</th>
                      <th className="py-2 font-bold">Stock Qty</th>
                      <th className="py-2 font-bold">Total Valuation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const filteredInventory = inventory.filter((item: any) => {
                        const cat = (item.category || item.type || "Ingredients").toLowerCase();
                        if (selectedInventorySubcategory === "ALL") return true;
                        return cat.includes(selectedInventorySubcategory.toLowerCase());
                      });

                      if (filteredInventory.length === 0) {
                        return (
                          <tr>
                            <td colSpan={5} className="text-center py-6 text-gray-400">
                              No inventory items found for the selected category.
                            </td>
                          </tr>
                        );
                      }

                      return filteredInventory.map((item: any, idx: number) => {
                        return (
                          <tr key={item.id || idx} className="border-b border-gray-100">
                            <td className="py-2 font-semibold text-gray-900">{item.name || item.itemName || item.title || "N/A"}</td>
                            <td className="py-2 text-gray-700">{item.category || item.type || "Ingredients"}</td>
                            <td className="py-2 text-gray-700">${formatCurrency(item.price)}</td>
                            <td className="py-2 text-gray-700">{formatNumber(item.stock)}</td>
                            <td className="py-2 font-bold text-[#548235]">${formatCurrency(item.totalPrice)}</td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>
            )}

            {module === "inventory" && inventoryStockTab === "stock" && (
              <div>
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-bold text-lg text-gray-800">Stock (Products) Valuation Report</h3>
                  <span className="text-xs text-gray-500 font-semibold">Category: {selectedStockCategory}</span>
                </div>
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-gray-300 text-gray-700">
                      <th className="py-2 font-bold">Item Name</th>
                      <th className="py-2 font-bold">Category</th>
                      <th className="py-2 font-bold">Unit Price</th>
                      <th className="py-2 font-bold">Stock Qty</th>
                      <th className="py-2 font-bold">Total Valuation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const filteredProducts = products.filter((item: any) => {
                        const cat = item.category || item.type || "";
                        if (selectedStockCategory === "ALL") return true;
                        return cat === selectedStockCategory;
                      });

                      if (filteredProducts.length === 0) {
                        return (
                          <tr>
                            <td colSpan={5} className="text-center py-6 text-gray-400">
                              No stock products found for the selected category.
                            </td>
                          </tr>
                        );
                      }

                      return filteredProducts.map((item: any, idx: number) => {
                        return (
                          <tr key={item.id || idx} className="border-b border-gray-100">
                            <td className="py-2 font-semibold text-gray-900">{item.name || item.productName || item.title || "N/A"}</td>
                            <td className="py-2 text-gray-700">{item.category || item.type || "-"}</td>
                            <td className="py-2 text-gray-700">${formatCurrency(item.price)}</td>
                            <td className="py-2 text-gray-700">{formatNumber(item.stock)}</td>
                            <td className="py-2 font-bold text-[#548235]">${formatCurrency(item.totalPrice)}</td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-gray-200 pt-3 mt-4 flex justify-between items-center text-xs text-gray-400">
          <span>Pizzatta Management Reports</span>
          <span>Page 1 of 1</span>
        </div>
      </div>
    </div>
  );
}