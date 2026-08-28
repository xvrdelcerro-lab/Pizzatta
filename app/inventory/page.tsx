"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, doc, setDoc } from "firebase/firestore";
import { Edit2, Save, X } from "lucide-react";

export default function InventoryPage() {
  const formatCurrency = (value: number) =>
    value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const formatQty = (value: number) =>
    value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const [activeTab, setActiveTab] = useState<"ingredients" | "provisions">("ingredients");
  const [inventoryData, setInventoryData] = useState<{ [key: string]: { qty: number; units: string } }>({});
  const [provisionsData, setProvisionsData] = useState<{ [key: string]: { qty: number; units: string } }>({});
  const [avgCosts, setAvgCosts] = useState<{ [key: string]: number }>({});
  
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [editQty, setEditQty] = useState("");
  const [editUnits, setEditUnits] = useState("");
  
  const [formattedDate, setFormattedDate] = useState("");
  const [status, setStatus] = useState("");

  const formatDisplayDate = (dateObj: Date) => {
    const day = String(dateObj.getDate()).padStart(2, '0');
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const month = months[dateObj.getMonth()];
    const year = dateObj.getFullYear();
    return `${day}-${month}-${year}`;
  };

  const fetchInventory = async () => {
    try {
      const entriesSnap = await getDocs(collection(db, "entries"));
      const calculated: { [key: string]: { qty: number; units: string } } = {};
      const provisions: { [key: string]: { qty: number; units: string } } = {};
      const costTotals: { [key: string]: { qtySum: number; costSum: number } } = {};

      const addCost = (name: string, qty: number, unitCost: number) => {
        if (!name || !qty) return;
        if (!costTotals[name]) costTotals[name] = { qtySum: 0, costSum: 0 };
        costTotals[name].qtySum += qty;
        costTotals[name].costSum += qty * unitCost;
      };

      const provSnap = await getDocs(collection(db, "provisions_inventory"));
      const savedProvisions: { [key: string]: any } = {};
      provSnap.docs.forEach(d => {
        savedProvisions[d.id] = d.data();
      });

      entriesSnap.docs.forEach((docSnap) => {
        const data = docSnap.data();
        
        const rawName = data.item || data.name || data.ingredient || data.itemName || data.product || data.description || data.material || "";
        let itemName = String(rawName).trim();

        const subItems = data.items || data.products || data.ingredients || [];
        if (!itemName && Array.isArray(subItems) && subItems.length > 0) {
          subItems.forEach((sub: any) => {
            const subName = String(sub.item || sub.name || sub.ingredient || "").trim();
            if (subName) {
              const subQty = Number(sub.qty || sub.quantity || sub.amount || 0);
              const subUnits = sub.units || sub.unit || sub.measure || "kg";
              const subUnitCost = Number(sub.unitCost || sub.cost || sub.price || 0);
              const catField = String(data.category || data.type || sub.category || "").toLowerCase();

              addCost(subName, subQty, subUnitCost);

              if (catField.includes("provision") || catField.includes("provisiones") || catField.includes("prov")) {
                if (!provisions[subName]) provisions[subName] = { qty: 0, units: subUnits };
                provisions[subName].qty += subQty;
                provisions[subName].units = subUnits;
              } else {
                if (!calculated[subName]) calculated[subName] = { qty: 0, units: subUnits };
                calculated[subName].qty += subQty;
              }
            }
          });
          return;
        }

        if (!itemName) return;

        const qty = Number(data.qty || data.quantity || data.amount || data.cant || 0);
        const units = data.units || data.unit || data.measure || "kg";
        const unitCost = Number(data.unitCost || data.cost || data.price || 0);
        const catField = String(data.category || data.type || data.section || data.group || "").toLowerCase();

        addCost(itemName, qty, unitCost);

        if (catField.includes("provision") || catField.includes("provisiones") || catField.includes("prov")) {
          if (!provisions[itemName]) {
            provisions[itemName] = { qty: 0, units };
          }
          provisions[itemName].qty += qty;
          provisions[itemName].units = units;
        } else {
          if (!calculated[itemName]) {
            calculated[itemName] = { qty: 0, units };
          }
          calculated[itemName].qty += qty;
        }
      });

      const productionSnap = await getDocs(collection(db, "dayproduction"));

      productionSnap.docs.forEach((docSnap) => {
        const prod = docSnap.data();
        const itemsUsed = prod.usedIngredients || prod.items || prod.ingredients || prod.used || prod.materials || [];
        itemsUsed.forEach((u: any) => {
          const rawName = u.item || u.name || u.ingredient || "";
          const itemName = String(rawName).trim();
          if (!itemName) return;
          const qtyUsed = Number(u.qty || u.quantity || 0);
          if (calculated[itemName]) {
            calculated[itemName].qty -= qtyUsed;
            if (calculated[itemName].qty < 0) calculated[itemName].qty = 0;
          }
        });
      });

      Object.keys(savedProvisions).forEach(pName => {
        provisions[pName] = savedProvisions[pName];
      });

      const computedAvgCosts: { [key: string]: number } = {};
      Object.keys(costTotals).forEach(name => {
        const { qtySum, costSum } = costTotals[name];
        computedAvgCosts[name] = qtySum > 0 ? costSum / qtySum : 0;
      });

      setAvgCosts(computedAvgCosts);
      setInventoryData(calculated);
      setProvisionsData(provisions);
    } catch (err) {
      console.error("Error calculating inventory:", err);
    }
  };

  useEffect(() => {
    fetchInventory();
    const now = new Date();
    setFormattedDate(formatDisplayDate(now));
  }, []);

  const handleEditItem = (name: string, data: { qty: number; units: string }) => {
    setEditingItem(name);
    setEditQty(data.qty.toString());
    setEditUnits(data.units);
  };

  const saveItemEdit = async (name: string) => {
    try {
      const qNum = parseFloat(editQty) || 0;
      const updated = { qty: qNum, units: editUnits || "kg" };

      await setDoc(doc(db, "provisions_inventory", name), updated);
      setProvisionsData(prev => ({ ...prev, [name]: updated }));

      setEditingItem(null);
      setStatus("Provision updated successfully!");
      setTimeout(() => setStatus(""), 3000);
    } catch (e) {
      console.error("Error saving provision", e);
      setStatus("Error updating provision.");
    }
  };

  const ingredientsCount = Object.keys(inventoryData).length;
  const provisionsCount = Object.keys(provisionsData).length;

  const ingredientsTotalValue = Object.entries(inventoryData).reduce(
    (sum, [name, data]) => sum + data.qty * (avgCosts[name] || 0), 0
  );
  const provisionsTotalValue = Object.entries(provisionsData).reduce(
    (sum, [name, data]) => sum + Number(data.qty) * (avgCosts[name] || 0), 0
  );
  const grandTotalValue = ingredientsTotalValue + provisionsTotalValue;

  return (
    <div className="min-h-screen bg-white p-8 pl-12">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-center" style={{ color: '#548235' }}>
          INVENTORY MANAGEMENT
        </h1>

        {status && (
          <div className="mb-4 text-center p-2 bg-green-100 rounded font-bold border border-[#548235]" style={{ color: '#548235' }}>
            {status}
          </div>
        )}

        <div className="flex justify-between items-center mb-6">
          <div className="flex border-b border-[#548235]">
            <button
              type="button"
              onClick={() => { setActiveTab("ingredients"); setEditingItem(null); }}
              className={`py-2 px-6 font-bold text-lg border-t border-x rounded-t ${activeTab === 'ingredients' ? 'border-[#548235] bg-green-50' : 'border-transparent text-gray-500'}`}
              style={{ color: activeTab === 'ingredients' ? '#548235' : undefined }}
            >
              Ingredients : {ingredientsCount}
            </button>
            <button
              type="button"
              onClick={() => { setActiveTab("provisions"); setEditingItem(null); }}
              className={`py-2 px-6 font-bold text-lg border-t border-x rounded-t ${activeTab === 'provisions' ? 'border-[#548235] bg-green-50' : 'border-transparent text-gray-500'}`}
              style={{ color: activeTab === 'provisions' ? '#548235' : undefined }}
            >
              Provisions : {provisionsCount}
            </button>
          </div>

          <div className="flex items-center gap-3 flex-wrap justify-end">
            <div className="text-sm font-bold px-3 py-2 border border-[#548235] rounded bg-[#548235]/10 whitespace-nowrap min-w-[220px] text-right" style={{ color: '#548235' }}>
              Total Ingredients: ${formatCurrency(ingredientsTotalValue)}
            </div>
            <div className="text-sm font-bold px-3 py-2 border border-[#548235] rounded bg-[#548235]/10 whitespace-nowrap min-w-[220px] text-right" style={{ color: '#548235' }}>
              Total Provisions: ${formatCurrency(provisionsTotalValue)}
            </div>
            <div className="text-sm font-bold px-3 py-2 border border-[#C00000] rounded bg-[#C00000]/10 whitespace-nowrap min-w-[220px] text-right" style={{ color: '#C00000' }}>
              Grand Total: ${formatCurrency(grandTotalValue)}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold" style={{ color: '#548235' }}>Date:</span>
              <span className="text-sm font-bold p-2 border border-[#C00000] rounded bg-gray-50 text-gray-800">
                {formattedDate}
              </span>
            </div>
          </div>
        </div>

        <div className="border border-[#548235] rounded-lg overflow-hidden shadow-sm">
          <table className="w-full border-collapse bg-white text-left">
            <thead>
              <tr className="bg-green-50 border-b border-[#548235]" style={{ color: '#548235' }}>
                <th className="p-3 font-bold border-r border-[#548235] min-w-[180px]">Item Name</th>
                <th className="p-3 font-bold border-r border-[#548235] w-40">Quantity</th>
                <th className="p-3 font-bold border-r border-[#548235] w-28">Units</th>
                <th className="p-3 font-bold border-r border-[#548235] w-40">Value</th>
                <th className="p-3 font-bold border-r border-[#548235] w-28">% of Total</th>
                {activeTab === "provisions" && (
                  <th className="p-3 font-bold w-24 text-center">Actions</th>
                )}
              </tr>
            </thead>
            <tbody>
              {activeTab === "ingredients" ? (
                ingredientsCount === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-6 text-gray-400">
                      No ingredients calculated from entries/production.
                    </td>
                  </tr>
                ) : (
                  Object.entries(inventoryData).map(([name, data], idx) => {
                    const value = data.qty * (avgCosts[name] || 0);
                    const pct = ingredientsTotalValue > 0 ? (value / ingredientsTotalValue) * 100 : 0;
                    return (
                      <tr key={idx} className="border-b border-gray-200 hover:bg-gray-50">
                        <td className="p-3 font-semibold text-gray-800 border-r border-gray-200">{name}</td>
                        <td className="p-3 border-r border-gray-200 font-bold whitespace-nowrap" style={{ color: '#548235' }}>
                          {formatQty(data.qty)}
                        </td>
                        <td className="p-3 text-gray-600 border-r border-gray-200">{data.units}</td>
                        <td className="p-3 border-r border-gray-200 font-bold text-gray-700 whitespace-nowrap">
                          ${formatCurrency(value)}
                        </td>
                        <td className="p-3 border-r border-gray-200 font-bold whitespace-nowrap" style={{ color: '#C00000' }}>
                          {pct.toFixed(1)}%
                        </td>
                      </tr>
                    );
                  })
                )
              ) : (
                provisionsCount === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-6 text-gray-400">
                      No provisions recorded.
                    </td>
                  </tr>
                ) : (
                  Object.entries(provisionsData).map(([name, data], idx) => {
                    const value = Number(data.qty) * (avgCosts[name] || 0);
                    const pct = provisionsTotalValue > 0 ? (value / provisionsTotalValue) * 100 : 0;
                    return (
                    <tr key={idx} className="border-b border-gray-200 hover:bg-gray-50">
                      <td className="p-3 font-semibold text-gray-800 border-r border-gray-200">{name}</td>
                      <td className="p-3 border-r border-gray-200 font-bold whitespace-nowrap">
                        {editingItem === name ? (
                          <input 
                            type="number" 
                            className="p-1 border border-[#C00000] rounded bg-white text-gray-800 text-sm w-full" 
                            value={editQty} 
                            onChange={e => setEditQty(e.target.value)} 
                          />
                        ) : (
                          <span style={{ color: '#548235' }}>{formatQty(Number(data.qty))}</span>
                        )}
                      </td>
                      <td className="p-3 text-gray-600 border-r border-gray-200">
                        {editingItem === name ? (
                          <input 
                            type="text" 
                            className="p-1 border border-[#C00000] rounded bg-white text-gray-800 text-sm w-full" 
                            value={editUnits} 
                            onChange={e => setEditUnits(e.target.value)} 
                          />
                        ) : (
                          data.units
                        )}
                      </td>
                      <td className="p-3 border-r border-gray-200 font-bold text-gray-700 whitespace-nowrap">
                        ${formatCurrency(value)}
                      </td>
                      <td className="p-3 border-r border-gray-200 font-bold whitespace-nowrap" style={{ color: '#C00000' }}>
                        {pct.toFixed(1)}%
                      </td>
                      <td className="p-3 text-center">
                        {editingItem === name ? (
                          <div className="flex justify-center gap-2">
                            <button 
                              type="button" 
                              onClick={() => saveItemEdit(name)} 
                              className="text-[#548235] hover:opacity-80" 
                              title="Save"
                            >
                              <Save size={18} />
                            </button>
                            <button 
                              type="button" 
                              onClick={() => setEditingItem(null)} 
                              className="text-[#C00000] hover:opacity-80" 
                              title="Cancel"
                            >
                              <X size={18} />
                            </button>
                          </div>
                        ) : (
                          <button 
                            type="button" 
                            onClick={() => handleEditItem(name, data)} 
                            className="text-[#548235] hover:opacity-80" 
                            title="Edit Provision"
                          >
                            <Edit2 size={18} />
                          </button>
                        )}
                      </td>
                    </tr>
                    );
                  })
                )
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}