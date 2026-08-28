"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where } from "firebase/firestore";
import { Trash2, Edit2, Plus, X, Search } from "lucide-react";
import ConfirmModal from "@/components/ConfirmModal";

interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("");
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);

  const fetchCustomers = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "customers"));
      const list: Customer[] = [];
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        list.push({
          id: docSnap.id,
          name: data.name || "",
          phone: data.phone || "",
          email: data.email || "",
          address: data.address || "",
          notes: data.notes || "",
        });
      });
      setCustomers(list);
    } catch (error) {
      console.error("Error fetching customers:", error);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const handleOpenAddModal = () => {
    setEditingId(null);
    setName("");
    setPhone("");
    setEmail("");
    setAddress("");
    setNotes("");
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (cust: Customer) => {
    setEditingId(cust.id);
    setName(cust.name);
    setPhone(cust.phone);
    setEmail(cust.email);
    setAddress(cust.address);
    setNotes(cust.notes);
    setIsModalOpen(true);
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setStatus("Customer name is required.");
      return;
    }

    try {
      const customerData = { name, phone, email, address, notes };
      if (editingId) {
        await updateDoc(doc(db, "customers", editingId), customerData);
        setStatus("Customer updated successfully!");
      } else {
        await addDoc(collection(db, "customers"), customerData);
        setStatus("Customer added successfully!");
      }

      setIsModalOpen(false);
      fetchCustomers();
      setTimeout(() => setStatus(""), 3000);
    } catch (error) {
      console.error("Error saving customer:", error);
      setStatus("Error saving customer.");
    }
  };

  const handleDeleteCustomer = async (cust: Customer) => {
    try {
      const salesQuery1 = query(collection(db, "sales"), where("customerId", "==", cust.id));
      const salesQuery2 = query(collection(db, "sales"), where("customerName", "==", cust.name));
      
      const [snap1, snap2] = await Promise.all([getDocs(salesQuery1), getDocs(salesQuery2)]);

      if (!snap1.empty || !snap2.empty) {
        setStatus(`Cannot delete "${cust.name}" because they have existing sales.`);
        setTimeout(() => setStatus(""), 4000);
        return;
      }

      setCustomerToDelete(cust);
    } catch (error) {
      console.error("Error checking customer sales:", error);
      setStatus("Error checking customer.");
    }
  };

  const confirmDeleteCustomer = async () => {
    if (!customerToDelete) return;
    try {
      await deleteDoc(doc(db, "customers", customerToDelete.id));
      setStatus("Customer deleted successfully!");
      fetchCustomers();
      setTimeout(() => setStatus(""), 3000);
    } catch (error) {
      console.error("Error deleting customer:", error);
      setStatus("Error deleting customer.");
    }
    setCustomerToDelete(null);
  };

  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.phone.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const customersCount = filteredCustomers.length;

  return (
    <div className="min-h-screen bg-white p-8 pl-12">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-center" style={{ color: '#548235' }}>
          CUSTOMERS MANAGEMENT
        </h1>

        {status && (
          <div className="mb-4 text-center p-2 bg-green-50 rounded font-bold border border-[#548235]" style={{ color: '#548235' }}>
            {status}
          </div>
        )}

        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-4">
            <div className="border border-[#548235] bg-green-50 rounded px-4 py-2 font-bold text-lg" style={{ color: '#548235' }}>
              Customers : {customersCount}
            </div>

            <div className="relative w-72">
              <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Search customers..."
                className="w-full pl-10 pr-4 py-2 border border-[#548235] rounded bg-white text-gray-800 text-sm focus:outline-none"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <button
            type="button"
            onClick={handleOpenAddModal}
            className="flex items-center gap-2 px-5 py-2 font-bold text-white rounded shadow transition hover:opacity-90"
            style={{ backgroundColor: '#548235' }}
          >
            <Plus size={18} /> Add Customer
          </button>
        </div>

        <div className="border border-[#548235] rounded-lg overflow-hidden shadow-sm">
          <table className="w-full border-collapse bg-white text-left">
            <thead>
              <tr className="bg-green-50 border-b border-[#548235]" style={{ color: '#548235' }}>
                <th className="p-3 font-bold border-r border-[#548235]">Name</th>
                <th className="p-3 font-bold border-r border-[#548235]">Phone</th>
                <th className="p-3 font-bold border-r border-[#548235]">Email</th>
                <th className="p-3 font-bold border-r border-[#548235]">Address</th>
                <th className="p-3 font-bold border-r border-[#548235]">Notes</th>
                <th className="p-3 font-bold w-24 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-6 text-gray-400">
                    No customers found.
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((cust) => (
                  <tr key={cust.id} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="p-3 font-semibold text-gray-800 border-r border-gray-200">{cust.name}</td>
                    <td className="p-3 text-gray-600 border-r border-gray-200">{cust.phone}</td>
                    <td className="p-3 text-gray-600 border-r border-gray-200">{cust.email}</td>
                    <td className="p-3 text-gray-600 border-r border-gray-200">{cust.address}</td>
                    <td className="p-3 text-gray-600 border-r border-gray-200">{cust.notes}</td>
                    <td className="p-3 text-center flex justify-center gap-3">
                      <button
                        type="button"
                        onClick={() => handleOpenEditModal(cust)}
                        className="text-[#548235] hover:opacity-80"
                        title="Edit Customer"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteCustomer(cust)}
                        className="text-gray-400 hover:text-[#548235]"
                        title="Delete Customer (Only if no sales)"
                      >
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {isModalOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md border border-[#548235] shadow-lg">
              <div className="flex justify-between items-center mb-4 border-b border-gray-200 pb-2">
                <h2 className="text-xl font-bold" style={{ color: '#548235' }}>
                  {editingId ? "Edit Customer" : "Add New Customer"}
                </h2>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSaveCustomer} className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Customer Name *</label>
                  <input
                    type="text"
                    required
                    className="w-full p-2 border border-[#548235] rounded bg-white text-gray-800 text-sm focus:outline-none"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Phone</label>
                  <input
                    type="text"
                    className="w-full p-2 border border-[#548235] rounded bg-white text-gray-800 text-sm focus:outline-none"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    className="w-full p-2 border border-[#548235] rounded bg-white text-gray-800 text-sm focus:outline-none"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Address</label>
                  <input
                    type="text"
                    className="w-full p-2 border border-[#548235] rounded bg-white text-gray-800 text-sm focus:outline-none"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Notes</label>
                  <textarea
                    className="w-full p-2 border border-[#548235] rounded bg-white text-gray-800 text-sm focus:outline-none"
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 border border-gray-300 rounded font-bold text-gray-600 hover:bg-gray-100 text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded font-bold text-white text-sm shadow hover:opacity-90"
                    style={{ backgroundColor: '#548235' }}
                  >
                    Save Customer
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>

      <ConfirmModal
        open={!!customerToDelete}
        message={`Are you sure you want to delete customer "${customerToDelete?.name}"?`}
        onConfirm={confirmDeleteCustomer}
        onCancel={() => setCustomerToDelete(null)}
      />
    </div>
  );
}