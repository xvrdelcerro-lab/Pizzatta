"use client";

import React, { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from "firebase/firestore";
import { Plus, Trash2, Edit2, X } from "lucide-react";
import ConfirmModal from "@/components/ConfirmModal";

interface Product {
  id: string;
  name: string;
  price?: number;
  recipe?: { ingredientName?: string; name?: string; qty?: number; quantity?: number; unit?: string }[];
}

interface Ingredient {
  id: string;
  name: string;
  costPerUnit: number;
}

interface ProductionRecord {
  id: string;
  productName: string;
  quantity: number;
  unitsObtained: number;
  efficiency: number;
  loteNumber: string;
  dateTime: string;
  timestamp: number;
  usedIngredients: { name: string; qty: number; unit: string; cost: number }[];
  totalCost: number;
}

export default function DayProductionPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [productionQty, setProductionQty] = useState("");
  const [unitsObtained, setUnitsObtained] = useState("");
  const [records, setRecords] = useState<ProductionRecord[]>([]);
  const [status, setStatus] = useState("");
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editQty, setEditQty] = useState("");
  const [editUnitsObtained, setEditUnitsObtained] = useState("");
  const [recordToDelete, setRecordToDelete] = useState<ProductionRecord | null>(null);

  const fetchData = async () => {
    try {
      const prodSnap = await getDocs(collection(db, "products"));
      const prodList: Product[] = [];
      prodSnap.docs.forEach(d => {
        const data = d.data();
        prodList.push({
          id: d.id,
          name: data.name || "",
          recipe: data.recipe || data.ingredients || []
        });
      });
      setProducts(prodList);

      const ingSnap = await getDocs(collection(db, "vendors"));
      const ingList: Ingredient[] = [];
      ingSnap.docs.forEach(d => {
        const data = d.data();
        const items = data.items || [];
        if (Array.isArray(items)) {
          items.forEach((item: any) => {
            const itemName = (item.description || item.name || "").toString().trim();
            let rawPrice = item.price ?? item.cost ?? item.costPerUnit ?? 0;
            if (typeof rawPrice === 'string') {
              rawPrice = rawPrice.replace(/[^0-9.-]+/g, "");
            }
            const resolvedCost = Number(rawPrice) || 0;

            if (itemName) {
              ingList.push({
                id: d.id + "_" + itemName,
                name: itemName,
                costPerUnit: resolvedCost
              });
            }
          });
        }
      });
      setIngredients(ingList);

      const recSnap = await getDocs(collection(db, "dayproduction"));
      const recList: ProductionRecord[] = [];
      recSnap.docs.forEach(d => {
        const data = d.data();
        const usedIngs = (data.usedIngredients || []).map((ui: any) => ({
          name: ui.name || "",
          qty: Number(ui.qty || 0),
          unit: ui.unit || "",
          cost: Number(ui.cost || 0)
        }));
        
        const calcTotalCost = usedIngs.reduce((acc: number, cur: { cost: number }) => acc + cur.cost, 0);
        const qty = Number(data.quantity || 0);
        const obtained = Number(data.unitsObtained || 0);
        const eff = data.efficiency !== undefined
          ? Number(data.efficiency)
          : (qty > 0 && obtained > 0 ? (obtained / qty) * 100 : 0);

        recList.push({
          id: d.id,
          productName: data.productName || "",
          quantity: qty,
          unitsObtained: obtained,
          efficiency: eff,
          loteNumber: data.loteNumber || "",
          dateTime: data.dateTime || "",
          timestamp: Number(data.timestamp || 0),
          usedIngredients: usedIngs,
          totalCost: Number(data.totalCost || calcTotalCost)
        });
      });
      recList.sort((a, b) => b.timestamp - a.timestamp);
      setRecords(recList);
    } catch (e) {
      console.error("Error fetching production data:", e);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const formatDateTime = (dateObj: Date) => {
    const day = String(dateObj.getDate()).padStart(2, '0');
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const month = months[dateObj.getMonth()];
    const year = dateObj.getFullYear();
    const hours = String(dateObj.getHours()).padStart(2, '0');
    const mins = String(dateObj.getMinutes()).padStart(2, '0');
    return `${day}-${month}-${year} ${hours}:${mins}`;
  };

  const formatNumber = (num: number) => {
    return num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  };

  const buildLoteNumber = (dateObj: Date, obtainedUnits: number) => {
    const yy = dateObj.getFullYear();
    const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
    const dd = String(dateObj.getDate()).padStart(2, '0');
    const unitsPart = obtainedUnits > 0 ? String(obtainedUnits) : "--";
    return `${yy}-${mm}${dd}/${unitsPart}`;
  };

  const selectedProduct = products.find(p => p.id === selectedProductId);
  const qtyNumber = Number(productionQty) || 0;

  const calculatedIngredients = (selectedProduct?.recipe || []).map(item => {
    const ingName = (item.ingredientName || item.name || "").trim();
    const itemQty = Number(item.qty || item.quantity || 0);
    const totalQtyNeeded = itemQty * qtyNumber;
    
    const ingObj = ingredients.find(i => i.name.toLowerCase() === ingName.toLowerCase());
    const costPerUnit = ingObj ? ingObj.costPerUnit : 0;
    const lineCost = totalQtyNeeded * costPerUnit;

    return {
      name: ingName,
      qty: totalQtyNeeded,
      unit: item.unit || "Units",
      cost: lineCost
    };
  });

  const totalCalculatedCost = calculatedIngredients.reduce((acc, cur) => acc + cur.cost, 0);
  const totalCalculatedQty = calculatedIngredients.reduce((acc, cur) => acc + cur.qty, 0);

  const unitsObtainedNumber = Number(unitsObtained) || 0;
  const efficiencyPreview = qtyNumber > 0 && unitsObtainedNumber > 0
    ? (unitsObtainedNumber / qtyNumber) * 100
    : 0;
  const loteNumberPreview = buildLoteNumber(new Date(), unitsObtainedNumber);

  const handleSaveProduction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct || qtyNumber <= 0) {
      setStatus("Please select a product and enter a valid quantity.");
      setTimeout(() => setStatus(""), 3000);
      return;
    }
    if (unitsObtainedNumber <= 0) {
      setStatus("Please enter the Units Obtained.");
      setTimeout(() => setStatus(""), 3000);
      return;
    }

    try {
      const now = new Date();
      const loteNumber = buildLoteNumber(now, unitsObtainedNumber);
      const efficiency = qtyNumber > 0 ? (unitsObtainedNumber / qtyNumber) * 100 : 0;
      const newRecord = {
        productName: selectedProduct.name,
        quantity: qtyNumber,
        unitsObtained: unitsObtainedNumber,
        efficiency: efficiency,
        loteNumber: loteNumber,
        dateTime: formatDateTime(now),
        timestamp: now.getTime(),
        usedIngredients: calculatedIngredients,
        totalCost: totalCalculatedCost
      };

      await addDoc(collection(db, "dayproduction"), newRecord);
      setStatus("Production record saved successfully!");
      setSelectedProductId("");
      setProductionQty("");
      setUnitsObtained("");
      fetchData();
      setTimeout(() => setStatus(""), 3000);
    } catch (e) {
      console.error("Error saving production:", e);
      setStatus("Error saving production record.");
    }
  };

  const isSameDay = (recordTimestamp: number) => {
    const recDate = new Date(recordTimestamp);
    const today = new Date();
    return (
      recDate.getDate() === today.getDate() &&
      recDate.getMonth() === today.getMonth() &&
      recDate.getFullYear() === today.getFullYear()
    );
  };

  const handleStartEdit = (rec: ProductionRecord) => {
    if (!isSameDay(rec.timestamp)) {
      setStatus("You can only edit records made on the same day.");
      setTimeout(() => setStatus(""), 4000);
      return;
    }
    setEditingId(rec.id);
    setEditQty(String(rec.quantity));
    setEditUnitsObtained(String(rec.unitsObtained || ""));
  };

  const handleSaveEdit = async (rec: ProductionRecord) => {
    const newQtyVal = Number(editQty);
    const newObtainedVal = Number(editUnitsObtained);
    if (newQtyVal <= 0 || newObtainedVal <= 0) return;

    const prodObj = products.find(p => p.name === rec.productName);
    const recipe = prodObj ? prodObj.recipe || [] : [];
    
    const updatedIngredients = recipe.map(item => {
      const ingName = (item.ingredientName || item.name || "").trim();
      const itemQty = Number(item.qty || item.quantity || 0);
      const totalQtyNeeded = itemQty * newQtyVal;

      const ingObj = ingredients.find(i => i.name.toLowerCase() === ingName.toLowerCase());
      const costPerUnit = ingObj ? ingObj.costPerUnit : 0;

      return {
        name: ingName,
        qty: totalQtyNeeded,
        unit: item.unit || "Units",
        cost: totalQtyNeeded * costPerUnit
      };
    });

    const updatedTotalCost = updatedIngredients.reduce((acc, cur) => acc + cur.cost, 0);
    const updatedEfficiency = newQtyVal > 0 ? (newObtainedVal / newQtyVal) * 100 : 0;
    const updatedLoteNumber = buildLoteNumber(new Date(rec.timestamp), newObtainedVal);

    try {
      await updateDoc(doc(db, "dayproduction", rec.id), {
        quantity: newQtyVal,
        unitsObtained: newObtainedVal,
        efficiency: updatedEfficiency,
        loteNumber: updatedLoteNumber,
        usedIngredients: updatedIngredients,
        totalCost: updatedTotalCost
      });
      setEditingId(null);
      setEditQty("");
      setEditUnitsObtained("");
      setStatus("Production record updated successfully!");
      fetchData();
      setTimeout(() => setStatus(""), 3000);
    } catch (e) {
      console.error("Error updating record:", e);
      setStatus("Error updating record.");
    }
  };

  const handleDeleteRecord = (rec: ProductionRecord) => {
    setRecordToDelete(rec);
  };

  const confirmDeleteRecord = async () => {
    if (!recordToDelete) return;
    try {
      await deleteDoc(doc(db, "dayproduction", recordToDelete.id));
      setStatus("Record deleted successfully!");
      fetchData();
      setTimeout(() => setStatus(""), 3000);
    } catch (e) {
      console.error("Error deleting record:", e);
      setStatus("Error deleting record.");
    }
    setRecordToDelete(null);
  };

  const grandTotalProductionCost = records.reduce((acc, cur) => acc + cur.totalCost, 0);

  return (
    <div className="min-h-screen bg-white p-8 pl-12">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-center" style={{ color: '#548235' }}>
          DAY PRODUCTION MANAGEMENT
        </h1>

        {status && (
          <div className="mb-4 text-center p-2 bg-green-50 rounded font-bold border border-[#548235]" style={{ color: '#548235' }}>
            {status}
          </div>
        )}

        <form onSubmit={handleSaveProduction} className="bg-green-50 p-6 rounded-lg border border-[#548235] mb-8 shadow-sm">
          <h2 className="text-lg font-bold mb-4" style={{ color: '#548235' }}>New Production Entry</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Select Product</label>
              <select
                className="w-full p-2 border border-[#548235] rounded bg-white text-gray-800 text-sm focus:outline-none"
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                required
              >
                <option value="">-- Choose Product --</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Quantity to Produce (100% Expected)</label>
              <input
                type="number"
                min="1"
                placeholder="Enter quantity..."
                className="w-full p-2 border border-[#548235] rounded bg-white text-gray-800 text-sm focus:outline-none"
                value={productionQty}
                onChange={(e) => setProductionQty(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Units Obtained</label>
              <input
                type="number"
                min="1"
                placeholder="Enter actual units..."
                className="w-full p-2 border border-[#548235] rounded bg-white text-gray-800 text-sm focus:outline-none"
                value={unitsObtained}
                onChange={(e) => setUnitsObtained(e.target.value)}
                required
              />
            </div>
          </div>

          {selectedProduct && qtyNumber > 0 && (
            <div className="mb-4 bg-white p-4 rounded border border-[#548235]">
              <h3 className="font-bold text-sm mb-2" style={{ color: '#548235' }}>Estimated Ingredients & Cost Preview:</h3>
              {calculatedIngredients.length > 0 ? (
                <ul className="list-disc list-inside text-sm text-gray-700 space-y-1 mb-3">
                  {calculatedIngredients.map((ci, idx) => {
                    const percentage = totalCalculatedQty > 0 ? (ci.qty / totalCalculatedQty) * 100 : 0;
                    return (
                      <li key={idx}>
                        <span className="font-semibold">{ci.name}</span>: {formatNumber(ci.qty)} {ci.unit} ({percentage.toFixed(1)}%) - Cost: ${ci.cost.toFixed(2)}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-sm text-gray-500 italic mb-3">No recipe ingredients defined for this product.</p>
              )}
              <div className="text-right font-bold text-base" style={{ color: '#548235' }}>
                Total Cost: ${totalCalculatedCost.toFixed(2)}
              </div>

              <div className="mt-4 pt-4 border-t border-[#548235]/40 grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                <div className="bg-[#C00000]/10 rounded p-2 text-center">
                  <div className="text-gray-500 font-semibold text-xs mb-0.5">100% Expected</div>
                  <div className="font-bold text-gray-800">{formatNumber(qtyNumber)}</div>
                </div>
                <div className="bg-[#C00000]/10 rounded p-2 text-center">
                  <div className="text-gray-500 font-semibold text-xs mb-0.5">Units Obtained</div>
                  <div className="font-bold text-gray-800">
                    {unitsObtainedNumber > 0 ? formatNumber(unitsObtainedNumber) : "--"}
                  </div>
                </div>
                <div className="bg-[#C00000]/10 rounded p-2 text-center">
                  <div className="text-gray-500 font-semibold text-xs mb-0.5">Actual Efficiency</div>
                  <div className="font-bold" style={{ color: '#548235' }}>
                    {unitsObtainedNumber > 0 ? `${efficiencyPreview.toFixed(1)}%` : "--"}
                  </div>
                </div>
              </div>

              {unitsObtainedNumber > 0 && (
                <div className="mt-4 text-center">
                  <span className="text-3xl font-extrabold tracking-wide" style={{ color: '#C00000' }}>
                    BATCH #: {loteNumberPreview}
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="text-right">
            <button
              type="submit"
              className="flex items-center gap-2 px-6 py-2 font-bold text-white rounded shadow transition hover:opacity-90 ml-auto"
              style={{ backgroundColor: '#548235' }}
            >
              <Plus size={18} /> Save Production Record
            </button>
          </div>
        </form>

        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold" style={{ color: '#548235' }}>
            Production Records Log ({records.length} total)
          </h2>
          <div className="font-bold text-sm bg-green-50 px-3 py-1.5 rounded border border-[#548235]" style={{ color: '#548235' }}>
            Grand Total Cost: ${grandTotalProductionCost.toFixed(2)}
          </div>
        </div>

        <div className="border border-[#548235] rounded-lg overflow-hidden shadow-sm">
          <table className="w-full border-collapse bg-white text-left">
            <thead>
              <tr className="bg-green-50 border-b border-[#548235]" style={{ color: '#548235' }}>
                <th className="p-3 font-bold border-r border-[#548235]">Date & Time</th>
                <th className="p-3 font-bold border-r border-[#548235]">Product</th>
                <th className="p-3 font-bold border-r border-[#548235]">Lot #</th>
                <th className="p-3 font-bold border-r border-[#548235]">Expected Qty</th>
                <th className="p-3 font-bold border-r border-[#548235]">Obtained</th>
                <th className="p-3 font-bold border-r border-[#548235]">Efficiency</th>
                <th className="p-3 font-bold border-r border-[#548235]">Used Ingredients</th>
                <th className="p-3 font-bold border-r border-[#548235]">Total Cost</th>
                <th className="p-3 font-bold text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {records.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-6 text-gray-400">
                    No production records found.
                  </td>
                </tr>
              ) : (
                records.map((rec) => {
                  const editable = isSameDay(rec.timestamp);
                  const totalRecQty = rec.usedIngredients.reduce((acc, cur) => acc + cur.qty, 0);
                  return (
                    <tr key={rec.id} className="border-b border-gray-200 hover:bg-gray-50 align-top">
                      <td className="p-3 text-sm text-gray-600 border-r border-gray-200 font-medium">
                        {rec.dateTime}
                      </td>

                      <td className="p-3 font-bold text-gray-800 border-r border-gray-200">
                        {rec.productName}
                      </td>

                      <td className="p-3 font-bold border-r border-gray-200 whitespace-nowrap" style={{ color: '#C00000' }}>
                        {rec.loteNumber || "--"}
                      </td>

                      <td className="p-3 font-semibold border-r border-gray-200">
                        {editingId === rec.id ? (
                          <input
                            type="number"
                            min="1"
                            className="w-16 p-1 border border-[#548235] rounded text-sm focus:outline-none"
                            value={editQty}
                            onChange={(e) => setEditQty(e.target.value)}
                          />
                        ) : (
                          <span>{formatNumber(rec.quantity)}</span>
                        )}
                      </td>

                      <td className="p-3 font-semibold border-r border-gray-200">
                        {editingId === rec.id ? (
                          <input
                            type="number"
                            min="1"
                            className="w-16 p-1 border border-[#548235] rounded text-sm focus:outline-none"
                            value={editUnitsObtained}
                            onChange={(e) => setEditUnitsObtained(e.target.value)}
                          />
                        ) : (
                          <span>{rec.unitsObtained ? formatNumber(rec.unitsObtained) : "--"}</span>
                        )}
                      </td>

                      <td className="p-3 font-bold border-r border-gray-200" style={{ color: '#548235' }}>
                        {rec.unitsObtained ? `${rec.efficiency.toFixed(1)}%` : "--"}
                      </td>

                      <td className="p-3 text-xs text-gray-700 border-r border-gray-200">
                        <ul className="list-disc list-inside space-y-0.5">
                          {rec.usedIngredients.map((ui, idx) => {
                            const pct = totalRecQty > 0 ? (ui.qty / totalRecQty) * 100 : 0;
                            return (
                              <li key={idx}>
                                <span className="font-semibold">{ui.name}</span>: {formatNumber(ui.qty)} {ui.unit} ({pct.toFixed(1)}%) - ${ui.cost.toFixed(2)}
                              </li>
                            );
                          })}
                        </ul>
                      </td>

                      <td className="p-3 font-bold border-r border-gray-200" style={{ color: '#548235' }}>
                        ${rec.totalCost.toFixed(2)}
                      </td>

                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          {editable ? (
                            <button
                              type="button"
                              onClick={() => handleStartEdit(rec)}
                              className="text-gray-400 hover:text-[#548235]"
                              title="Edit Quantity (Same Day Only)"
                            >
                              <Edit2 size={16} />
                            </button>
                          ) : (
                            <span className="text-xs text-gray-300 font-semibold" title="Cannot edit past days">Locked</span>
                          )}
                          {editingId === rec.id && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleSaveEdit(rec)}
                                className="text-[#548235] font-bold text-xs px-1 hover:underline"
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingId(null)}
                                className="text-gray-400 hover:text-gray-600"
                              >
                                <X size={14} />
                              </button>
                            </>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDeleteRecord(rec)}
                            className="text-gray-400 hover:text-[#C00000]"
                            title="Delete Record"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmModal
        open={!!recordToDelete}
        message="Are you sure you want to delete this production record?"
        onConfirm={confirmDeleteRecord}
        onCancel={() => setRecordToDelete(null)}
      />
    </div>
  );
}