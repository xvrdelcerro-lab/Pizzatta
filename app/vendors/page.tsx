"use client";

import { useState, useEffect } from 'react';
import { PlusCircle, Trash2 } from 'lucide-react';
import { db } from "@/lib/firebase";
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc } from "firebase/firestore";
import ConfirmModal from "@/components/ConfirmModal";

export default function VendorsPage() {
  const [vendors, setVendors] = useState<any[]>([]);
  const [selectedVendor, setSelectedVendor] = useState<any>(null);
  const [status, setStatus] = useState("");
  const [formData, setFormData] = useState({ name: '', contactPerson: '', phone: '', email: '', website: '', address: '' });
  const [items, setItems] = useState([{ description: '', unit: 'Kg', price: '', category: 'Ingredient' }]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const fetchVendors = async () => {
    const querySnapshot = await getDocs(collection(db, "vendors"));
    setVendors(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  };

  useEffect(() => { fetchVendors(); }, []);

  const handleSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const vendor = vendors.find(v => v.id === e.target.value);
    if (vendor) {
      setSelectedVendor(vendor);
      setFormData({ name: vendor.name, contactPerson: vendor.contactPerson, phone: vendor.phone, email: vendor.email, website: vendor.website, address: vendor.address });
      setItems(vendor.items || [{ description: '', unit: 'Kg', price: '', category: 'Ingredient' }]);
    } else {
      setSelectedVendor(null);
      setFormData({ name: '', contactPerson: '', phone: '', email: '', website: '', address: '' });
      setItems([{ description: '', unit: 'Kg', price: '', category: 'Ingredient' }]);
    }
  };

  const saveVendor = async () => {
    try {
      if (selectedVendor) {
        await updateDoc(doc(db, "vendors", selectedVendor.id), { ...formData, items });
        setStatus("Vendor successfully updated!");
      } else {
        await addDoc(collection(db, "vendors"), { ...formData, items, addedOn: new Date().toLocaleDateString() });
        setStatus("Vendor successfully saved!");
        await fetchVendors();
      }
      setTimeout(() => setStatus(""), 3000);
    } catch (e) { setStatus("Error saving."); }
  };

  const deleteVendor = () => {
    if (selectedVendor) setShowDeleteConfirm(true);
  };

  const confirmDeleteVendor = async () => {
    if (selectedVendor) {
      await deleteDoc(doc(db, "vendors", selectedVendor.id));
      setSelectedVendor(null);
      setFormData({ name: '', contactPerson: '', phone: '', email: '', website: '', address: '' });
      await fetchVendors();
      setStatus("Vendor deleted.");
      setTimeout(() => setStatus(""), 3000);
    }
    setShowDeleteConfirm(false);
  };

  const inputStyle = "p-2 border border-[#C00000] rounded bg-white text-gray-800 focus:outline-none focus:ring-1 focus:ring-[#C00000]";

  return (
    <div className="fixed inset-y-0 right-0 left-64 overflow-y-auto bg-white p-8">
      <div className="max-w-4xl mx-auto flex flex-col items-center">
        <h1 className="text-3xl font-bold mb-6 text-center w-full" style={{ color: '#548235' }}>VENDORS MANAGEMENT</h1>
        
        <div className="w-full mb-8 p-4 border border-[#548235] rounded">
          <label className="block mb-2 font-bold" style={{ color: '#548235' }}>Select Vendor</label>
          <select className={`w-full ${inputStyle}`} onChange={handleSelect} value={selectedVendor?.id || ""}>
            <option value="">-- Add New Vendor --</option>
            {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </div>

        <div className="w-full space-y-6">
          <section className="space-y-4">
            <h2 className="text-xl font-semibold" style={{ color: '#548235' }}>Vendor Details</h2>
            <hr className="border-2 border-[#C00000]" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input type="text" placeholder="Company Name" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className={inputStyle} />
              <input type="text" placeholder="Contact person" value={formData.contactPerson} onChange={e => setFormData({...formData, contactPerson: e.target.value})} className={inputStyle} />
              <input type="text" placeholder="Contact Number" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className={inputStyle} />
              <input type="email" placeholder="Company Email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className={inputStyle} />
              <input type="text" placeholder="Website URL" value={formData.website} onChange={e => setFormData({...formData, website: e.target.value})} className={inputStyle} />
              <input type="text" placeholder="Office Address" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} className={`md:col-span-2 ${inputStyle}`} />
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold" style={{ color: '#548235' }}>Items Provided</h2>
            <hr className="border-2 border-[#C00000]" />
            {items.map((item, index) => (
              <div key={index} className="flex flex-col md:flex-row gap-4 items-center bg-gray-50 p-2 rounded border border-gray-200">
                <input type="text" placeholder="Description" value={item.description} onChange={e => { const newItems = [...items]; newItems[index].description = e.target.value; setItems(newItems); }} className={`w-full md:flex-1 ${inputStyle}`} />
                
                <div className="flex items-center gap-3 px-2">
                  <label className="flex items-center gap-1 cursor-pointer"><input type="radio" checked={item.category === 'Ingredient'} onChange={() => { const newItems = [...items]; newItems[index].category = 'Ingredient'; setItems(newItems); }} /><span className="text-xs text-[#548235]">Ingr</span></label>
                  <label className="flex items-center gap-1 cursor-pointer"><input type="radio" checked={item.category === 'Provision'} onChange={() => { const newItems = [...items]; newItems[index].category = 'Provision'; setItems(newItems); }} /><span className="text-xs text-[#C00000]">Prov</span></label>
                </div>

                <select value={item.unit} onChange={e => { const newItems = [...items]; newItems[index].unit = e.target.value; setItems(newItems); }} className={inputStyle}>
                  <option>Kg</option><option>Lt</option><option>Pc</option>
                </select>
                <input type="text" placeholder="$0.00" value={item.price} className={`w-full md:w-24 ${inputStyle}`} onChange={(e) => { const newItems = [...items]; newItems[index].price = e.target.value.replace(/[^0-9.]/g, ''); setItems(newItems); }} onBlur={(e) => { const val = parseFloat(e.target.value); if (!isNaN(val)) { const newItems = [...items]; newItems[index].price = val.toLocaleString('en-US', { style: 'currency', currency: 'USD' }); setItems(newItems); } }} />
                <button onClick={() => setItems(items.filter((_, i) => i !== index))} className="text-[#C00000]" type="button"><Trash2 size={20} /></button>
              </div>
            ))}
            <button onClick={() => setItems([...items, { description: '', unit: 'Kg', price: '', category: 'Ingredient' }])} className="flex items-center gap-2 font-medium text-[#548235]" type="button"><PlusCircle size={20} /> Add Item</button>
          </section>

          {status && <div className="text-center p-2 bg-green-100 text-[#548235] font-bold rounded border border-[#548235] w-full">{status}</div>}

          <div className="flex flex-col md:flex-row gap-4 w-full">
            <button onClick={saveVendor} type="button" className="bg-[#548235] text-white flex-1 py-2 rounded font-bold hover:bg-opacity-90">{selectedVendor ? "UPDATE VENDOR" : "SAVE NEW VENDOR"}</button>
            {selectedVendor && <button onClick={deleteVendor} type="button" className="flex items-center justify-center gap-2 bg-[#C00000] text-white flex-1 py-2 rounded font-bold hover:bg-opacity-90"><Trash2 size={20} /> DELETE VENDOR</button>}
          </div>
        </div>
      </div>

      <ConfirmModal
        open={showDeleteConfirm}
        message={`Are you sure you want to delete vendor "${selectedVendor?.contactPerson || selectedVendor?.name || ''}"?`}
        onConfirm={confirmDeleteVendor}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  );
}