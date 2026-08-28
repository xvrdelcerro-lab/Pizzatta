"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, setDoc, doc, deleteDoc } from "firebase/firestore";
import { PlusCircle, Trash2, Edit2, X } from "lucide-react";
import ConfirmModal from "@/components/ConfirmModal";

export default function EntriesPage() {
  const [vendors, setVendors] = useState<any[]>([]);
  const [entries, setEntries] = useState<any[]>([]);
  const [entryToDelete, setEntryToDelete] = useState<any>(null);
  
  const [selectedVendor, setSelectedVendor] = useState<any>(null);
  const [vendorItems, setVendorItems] = useState<any[]>([]);
  const [itemDropdownValue, setItemDropdownValue] = useState("");
  const [selectedItems, setSelectedItems] = useState<any[]>([]);
  
  const [entryId, setEntryId] = useState("");
  const [entryDate, setEntryDate] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [status, setStatus] = useState("");
  const [idError, setIdError] = useState("");

  const fetchData = async () => {
    try {
      const vendorsSnap = await getDocs(collection(db, "vendors"));
      const vendorsList = vendorsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setVendors(vendorsList);

      const entriesSnap = await getDocs(collection(db, "entries"));
      const list = entriesSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      
      list.sort((a, b) => {
        const dateA = new Date(a.addedOn || a.date || a.timestamp || 0).getTime();
        const dateB = new Date(b.addedOn || b.date || b.timestamp || 0).getTime();
        return dateB - dateA;
      });

      setEntries(list.slice(0, 5));
    } catch (err) {
      console.error("Error fetching data:", err);
    }
  };

  useEffect(() => {
    fetchData();
    const todayStr = new Date().toISOString().split("T")[0];
    setEntryDate(todayStr);
  }, []);

  const handleVendorSelect = (vendorId: string) => {
    const v = vendors.find(item => item.id === vendorId);
    setSelectedVendor(v || null);
    if (!isEditing) {
      setSelectedItems([]);
    }
    setItemDropdownValue("");

    if (v && v.items && Array.isArray(v.items)) {
      const mapped = v.items.map((itm: any) => {
        const rawPrice = itm.price ?? itm.cost ?? itm.unitCost ?? 0;
        const cleanedPrice = typeof rawPrice === "string" 
          ? parseFloat(rawPrice.replace(/[^0-9.]/g, "")) || 0 
          : Number(rawPrice) || 0;
        
        return {
          ...itm,
          name: itm.description || itm.name || itm.item || "Item",
          qty: 1,
          unitCost: cleanedPrice,
          units: itm.units || itm.unit || itm.measure || "kg"
        };
      });
      setVendorItems(mapped);
    } else {
      setVendorItems([]);
    }
  };

  const handleItemSelectFromDropdown = (itemName: string) => {
    if (!itemName) return;
    const itm = vendorItems.find(i => i.name === itemName);
    if (itm && !selectedItems.some(i => i.name === itm.name)) {
      setSelectedItems([...selectedItems, itm]);
    }
    setItemDropdownValue("");
  };

  const removeItemSelection = (name: string) => {
    setSelectedItems(selectedItems.filter(i => i.name !== name));
  };

  const updateItemQty = (name: string, qty: string) => {
    const q = parseFloat(qty) || 0;
    setSelectedItems(selectedItems.map(i => i.name === name ? { ...i, qty: q } : i));
  };

  const updateItemCost = (name: string, cost: string) => {
    const c = parseFloat(cost) || 0;
    setSelectedItems(selectedItems.map(i => i.name === name ? { ...i, unitCost: c } : i));
  };

  const grandTotal = selectedItems.reduce((acc, curr) => acc + (curr.qty * curr.unitCost), 0);

  const startEditEntry = (entry: any) => {
    const entryDateStr = entry.addedOn || entry.date;
    if (!entryDateStr) {
      setStatus("Cannot verify entry date for editing restriction.");
      setTimeout(() => setStatus(""), 4000);
      return;
    }

    const entryDateObj = new Date(entryDateStr);
    const currentDate = new Date();
    const diffTime = currentDate.getTime() - entryDateObj.getTime();
    const diffDays = diffTime / (1000 * 3600 * 24);

    if (diffDays > 7) {
      setStatus("Cannot edit this entry because it was issued more than 7 days ago.");
      setTimeout(() => setStatus(""), 4000);
      return;
    }

    setIsEditing(true);
    setEntryId(entry.id);
    setEntryDate(entry.addedOn || entry.date || new Date().toISOString().split("T")[0]);

    const v = vendors.find(item => item.id === entry.vendorId || (item.companyName || item.name || item.contactPerson) === entry.vendorName);
    if (v) {
      setSelectedVendor(v);
      if (v.items && Array.isArray(v.items)) {
        const mapped = v.items.map((itm: any) => {
          const rawPrice = itm.price ?? itm.cost ?? itm.unitCost ?? 0;
          const cleanedPrice = typeof rawPrice === "string" 
            ? parseFloat(rawPrice.replace(/[^0-9.]/g, "")) || 0 
            : Number(rawPrice) || 0;
          return {
            ...itm,
            name: itm.description || itm.name || itm.item || "Item",
            qty: 1,
            unitCost: cleanedPrice,
            units: itm.units || itm.unit || itm.measure || "kg"
          };
        });
        setVendorItems(mapped);
      }
    }

    if (entry.items && Array.isArray(entry.items)) {
      setSelectedItems(entry.items.map((i: any) => ({
        name: i.name,
        category: i.category,
        qty: i.qty || 1,
        unitCost: i.unitCost || 0,
        units: i.units || i.unit || "kg"
      })));
    } else {
      setSelectedItems([{
        name: entry.item,
        category: entry.category,
        qty: entry.qty || 1,
        unitCost: entry.unitCost || 0,
        units: entry.units || entry.unit || "kg"
      }]);
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const saveEntries = async () => {
    if (!selectedVendor || selectedItems.length === 0 || !entryId.trim()) return;

    setIdError("");
    const trimmedId = entryId.trim();
    const lowerTrimmedId = trimmedId.toLowerCase();

    try {
      const entriesSnap = await getDocs(collection(db, "entries"));
      const existingDocs = entriesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      
      const isDuplicate = existingDocs.some(existing => existing.id.toLowerCase() === lowerTrimmedId && !isEditing);

      if (isDuplicate) {
        setIdError("Error: Entry ID already exists (case-insensitive duplicate not allowed).");
        return;
      }

      const vendorDisplayName = selectedVendor.companyName || selectedVendor.name || selectedVendor.contactPerson || "Vendor";
      const finalDate = entryDate || new Date().toISOString().split("T")[0];

      const formattedItems = selectedItems.map(item => ({
        name: item.name,
        category: item.category || selectedVendor.category || "Provisions",
        qty: item.qty,
        units: item.units || "kg",
        unitCost: item.unitCost,
        totalCost: item.qty * item.unitCost
      }));

      await setDoc(doc(db, "entries", trimmedId), {
        vendorId: selectedVendor.id,
        vendorName: vendorDisplayName,
        items: formattedItems,
        grandTotal: grandTotal,
        addedOn: finalDate,
        timestamp: new Date()
      });

      setStatus(isEditing ? "Entry updated successfully!" : "Entry saved successfully!");
      setIsEditing(false);
      setSelectedVendor(null);
      setVendorItems([]);
      setSelectedItems([]);
      setItemDropdownValue("");
      setEntryId("");
      setEntryDate(new Date().toISOString().split("T")[0]);
      fetchData();

      setTimeout(() => setStatus(""), 3000);
    } catch (e) {
      console.error("Error saving entry", e);
      setStatus("Error saving entry.");
    }
  };

  const deleteEntry = (entry: any) => {
    const entryDateStr = entry.addedOn || entry.date;
    if (!entryDateStr) {
      setStatus("Cannot verify entry date for deletion restriction.");
      setTimeout(() => setStatus(""), 4000);
      return;
    }

    const entryDateObj = new Date(entryDateStr);
    const currentDate = new Date();
    const diffTime = currentDate.getTime() - entryDateObj.getTime();
    const diffDays = diffTime / (1000 * 3600 * 24);

    if (diffDays > 7) {
      setStatus("Cannot delete this entry because it was issued more than 7 days ago.");
      setTimeout(() => setStatus(""), 4000);
      return;
    }

    setEntryToDelete(entry);
  };

  const confirmDeleteEntry = async () => {
    if (!entryToDelete) return;
    try {
      await deleteDoc(doc(db, "entries", entryToDelete.id));
      setStatus("Entry deleted successfully.");
      setTimeout(() => setStatus(""), 3000);
      fetchData();
    } catch (e) {
      console.error("Error deleting entry", e);
      setStatus("Error deleting entry.");
    }
    setEntryToDelete(null);
  };

  const inputStyle = "p-2 border border-[#C00000] rounded w-full bg-white text-gray-800";

  return (
    <div className="min-h-screen bg-white p-8 pl-12">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-center" style={{ color: '#548235' }}>
          ENTRIES MANAGEMENT
        </h1>

        <div className="border border-[#548235] p-6 rounded-lg mb-8">
          <h2 className="text-xl font-bold mb-4" style={{ color: '#548235' }}>
            {isEditing ? "Edit Entry" : "Add New Entries"}
          </h2>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-bold mb-1" style={{ color: '#548235' }}>Entry ID (Unique)</label>
              <input 
                type="text" 
                placeholder="Enter Document ID" 
                className={inputStyle} 
                value={entryId} 
                disabled={isEditing}
                onChange={e => { setEntryId(e.target.value); setIdError(""); }} 
              />
              {idError && <span className="text-xs text-[#C00000] font-bold mt-1 block">{idError}</span>}
            </div>

            <div>
              <label className="block text-sm font-bold mb-1" style={{ color: '#548235' }}>Entry Date</label>
              <input 
                type="date" 
                className={inputStyle} 
                value={entryDate} 
                onChange={e => setEntryDate(e.target.value)} 
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <select 
              className={inputStyle}
              onChange={e => handleVendorSelect(e.target.value)}
              value={selectedVendor?.id || ""}
            >
              <option value="">Select Vendor</option>
              {vendors.map(v => (
                <option key={v.id} value={v.id}>
                  {v.companyName || v.name || v.contactPerson || "Vendor"}
                </option>
              ))}
            </select>

            <select 
              className={inputStyle}
              onChange={e => handleItemSelectFromDropdown(e.target.value)}
              value={itemDropdownValue}
              disabled={!selectedVendor}
            >
              <option value="">Select Item / Product to Add</option>
              {vendorItems.map((itm, idx) => (
                <option key={idx} value={itm.name} disabled={selectedItems.some(i => i.name === itm.name)}>
                  {itm.name} {selectedItems.some(i => i.name === itm.name) ? "(Added)" : ""}
                </option>
              ))}
            </select>
          </div>

          {selectedItems.length > 0 && (
            <div className="mb-4">
              <h3 className="font-bold mb-2" style={{ color: '#548235' }}>Selected Items Configuration</h3>
              <div className="space-y-3">
                {selectedItems.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-4 gap-3 items-center border p-2 rounded border-[#548235] bg-gray-50">
                    <span className="font-semibold text-gray-700">{item.name} <span className="text-xs text-gray-500 font-normal">({item.units})</span></span>
                    <input 
                      type="number" 
                      placeholder="Qty" 
                      className={inputStyle} 
                      value={item.qty} 
                      onChange={e => updateItemQty(item.name, e.target.value)} 
                    />
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 font-semibold pointer-events-none">$</span>
                      <input 
                        type="number" 
                        placeholder="Unit Cost" 
                        className={`${inputStyle} pl-6`} 
                        value={item.unitCost} 
                        onChange={e => updateItemCost(item.name, e.target.value)} 
                      />
                    </div>
                    <div className="flex justify-between items-center px-2">
                      <span className="font-bold text-sm" style={{ color: '#548235' }}>
                        ${(item.qty * item.unitCost).toFixed(2)}
                      </span>
                      <button 
                        type="button" 
                        onClick={() => removeItemSelection(item.name)} 
                        className="text-[#C00000] hover:opacity-80"
                        title="Remove item"
                      >
                        <X size={20} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 font-bold text-lg text-right" style={{ color: '#548235' }}>
                Grand Total: ${grandTotal.toFixed(2)}
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <button 
              type="button" 
              onClick={saveEntries} 
              disabled={!selectedVendor || selectedItems.length === 0 || !entryId.trim()}
              className="bg-[#548235] text-white w-full py-3 rounded font-bold hover:bg-opacity-90 disabled:opacity-50 flex justify-center gap-2"
            >
              <PlusCircle size={20} /> {isEditing ? "UPDATE ENTRY" : "SAVE ALL ENTRIES"}
            </button>
            {isEditing && (
              <button 
                type="button" 
                onClick={() => { 
                  setIsEditing(false); 
                  setSelectedVendor(null); 
                  setSelectedItems([]); 
                  setEntryId(""); 
                  setEntryDate(new Date().toISOString().split("T")[0]); 
                }} 
                className="bg-gray-400 text-white px-6 py-3 rounded font-bold hover:bg-opacity-90"
              >
                CANCEL
              </button>
            )}
          </div>
        </div>

        {status && (
          <div className="mb-4 text-center p-2 bg-green-100 rounded font-bold border border-[#548235]" style={{ color: '#548235' }}>
            {status}
          </div>
        )}

        <div className="flex items-center gap-3 mb-4">
          <h2 className="text-2xl font-bold" style={{ color: '#548235' }}>
            Recent Entries : {entries.length}
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {entries.length === 0 ? (
            <div className="text-gray-400 text-center py-4 border border-[#548235] rounded">No entries found.</div>
          ) : (
            entries.map(entry => {
              const displayItems = entry.items && Array.isArray(entry.items) ? entry.items : [{ name: entry.item, qty: entry.qty || 1, totalCost: Number(entry.price || entry.cost || 0) }];
              const displayTotal = entry.grandTotal !== undefined ? entry.grandTotal : displayItems.reduce((acc: number, curr: any) => acc + (curr.totalCost || (curr.qty * curr.unitCost) || 0), 0);

              return (
                <div key={entry.id} className="border border-[#548235] p-4 rounded flex justify-between items-center bg-white shadow-sm">
                  <div>
                    <span className="font-bold text-lg" style={{ color: '#548235' }}>
                      {displayItems.map((i: any) => i.name).join(", ")}
                    </span> 
                    <span className="text-sm text-gray-500 ml-2">ID: {entry.id} | Date: {entry.addedOn || entry.date || "No Date"}</span>
                    <div className="text-sm text-gray-600">
                      Vendor: {entry.vendorName || "N/A"} | Items Count: {displayItems.length} | Grand Total: ${Number(displayTotal).toFixed(2)}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => startEditEntry(entry)} 
                      className="text-[#548235] hover:opacity-80" 
                      type="button" 
                      title="Edit Entry (Allowed within 7 days)"
                    >
                      <Edit2 size={20} />
                    </button>
                    <button 
                      onClick={() => deleteEntry(entry)} 
                      className="text-[#C00000] hover:opacity-80" 
                      type="button" 
                      title="Delete Entry (Allowed within 7 days)"
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}