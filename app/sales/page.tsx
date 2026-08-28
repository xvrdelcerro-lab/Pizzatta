"use client";

import React, { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, addDoc, deleteDoc, doc, getDoc, setDoc } from "firebase/firestore";
import { Plus, Trash2, Printer, X, ShoppingCart } from "lucide-react";
import ConfirmModal from "@/components/ConfirmModal";

interface Customer {
  id: string;
  name: string;
  phone?: string;
  address?: string;
  email?: string;
}

interface Product {
  id: string;
  name: string;
  price?: number;
}

interface SaleItem {
  productId: string;
  productName: string;
  qty: number;
  unitPrice: number;
  subtotal: number;
}

interface SaleRecord {
  id: string;
  invoiceNumber: string;
  customerName: string;
  customerPhone?: string;
  customerAddress?: string;
  dateTime: string;
  timestamp: number;
  items: SaleItem[];
  totalAmount: number;
}

export default function SalesPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [saleQty, setSaleQty] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  
  const [currentCart, setCurrentCart] = useState<SaleItem[]>([]);
  const [salesRecords, setSalesRecords] = useState<SaleRecord[]>([]);
  const [nextInvoiceNumber, setNextInvoiceNumber] = useState("INV-1001");
  const [status, setStatus] = useState("");

  const [viewingInvoice, setViewingInvoice] = useState<SaleRecord | null>(null);
  const [saleToDelete, setSaleToDelete] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const custSnap = await getDocs(collection(db, "customers"));
      const custList: Customer[] = [];
      custSnap.docs.forEach(d => {
        const data = d.data();
        const name = (data.name || data.customerName || "").toString().trim();
        if (name) {
          custList.push({
            id: d.id,
            name,
            phone: data.phone || data.phoneNumber || "",
            address: data.address || ""
          });
        }
      });
      setCustomers(custList);

      const prodSnap = await getDocs(collection(db, "products"));
      const prodList: Product[] = [];
      prodSnap.docs.forEach(d => {
        const data = d.data();
        const name = (data.name || "").toString().trim();
        const price = Number(data.price || data.salePrice || 0);
        if (name) {
          prodList.push({ id: d.id, name, price });
        }
      });
      setProducts(prodList);

      const salesSnap = await getDocs(collection(db, "sales"));
      const salesList: SaleRecord[] = [];
      salesSnap.docs.forEach(d => {
        const data = d.data();
        salesList.push({
          id: d.id,
          invoiceNumber: data.invoiceNumber || "INV-???",
          customerName: data.customerName || "Walk-in Customer",
          customerPhone: data.customerPhone || "",
          customerAddress: data.customerAddress || "",
          dateTime: data.dateTime || "",
          timestamp: Number(data.timestamp || 0),
          items: (data.items || []).map((i: any) => ({
            productId: i.productId || "",
            productName: i.productName || "",
            qty: Number(i.qty || 0),
            unitPrice: Number(i.unitPrice || 0),
            subtotal: Number(i.subtotal || 0)
          })),
          totalAmount: Number(data.totalAmount || 0)
        });
      });
      salesList.sort((a, b) => b.timestamp - a.timestamp);
      setSalesRecords(salesList);

      const counterRef = doc(db, "counters", "invoice");
      const counterSnap = await getDoc(counterRef);
      if (counterSnap.exists()) {
        const seq = counterSnap.data().seq || 1001;
        setNextInvoiceNumber(`INV-${seq}`);
      } else {
        const initialSeq = 1001 + salesList.length;
        setNextInvoiceNumber(`INV-${initialSeq}`);
      }

    } catch (e) {
      console.error("Error fetching sales dependencies:", e);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleProductChange = (prodId: string) => {
    setSelectedProductId(prodId);
    const prod = products.find(p => p.id === prodId);
    if (prod && prod.price) {
      setUnitPrice(String(prod.price));
    } else {
      setUnitPrice("");
    }
  };

  const handleAddToCart = (e: React.FormEvent) => {
    e.preventDefault();
    const prod = products.find(p => p.id === selectedProductId);
    const qtyNum = Number(saleQty);
    const priceNum = Number(unitPrice);

    if (!prod || qtyNum <= 0 || priceNum < 0) {
      setStatus("Please select a valid product, quantity, and price.");
      setTimeout(() => setStatus(""), 3000);
      return;
    }

    const newItem: SaleItem = {
      productId: prod.id,
      productName: prod.name,
      qty: qtyNum,
      unitPrice: priceNum,
      subtotal: qtyNum * priceNum
    };

    setCurrentCart([...currentCart, newItem]);
    setSelectedProductId("");
    setSaleQty("");
    setUnitPrice("");
  };

  const handleRemoveCartItem = (index: number) => {
    const updated = [...currentCart];
    updated.splice(index, 1);
    setCurrentCart(updated);
  };

  const cartTotal = currentCart.reduce((acc, cur) => acc + cur.subtotal, 0);

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

  const formatCurrency = (num: number) => {
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const handleCompleteSale = async () => {
    if (currentCart.length === 0) {
      setStatus("Cart is empty. Add at least one item.");
      setTimeout(() => setStatus(""), 3000);
      return;
    }

    const custObj = customers.find(c => c.id === selectedCustomerId);
    const customerName = custObj ? custObj.name : "Walk-in Customer";
    const customerPhone = custObj ? custObj.phone || "" : "";
    const customerAddress = custObj ? custObj.address || "" : "";
    const now = new Date();

    try {
      const newSaleRecord = {
        invoiceNumber: nextInvoiceNumber,
        customerName,
        customerPhone,
        customerAddress,
        dateTime: formatDateTime(now),
        timestamp: now.getTime(),
        items: currentCart,
        totalAmount: cartTotal
      };

      await addDoc(collection(db, "sales"), newSaleRecord);

      const currentSeqNum = parseInt(nextInvoiceNumber.replace("INV-", "")) || 1001;
      await setDoc(doc(db, "counters", "invoice"), { seq: currentSeqNum + 1 });

      setStatus(`Sale completed successfully! Invoice ${nextInvoiceNumber} generated.`);
      setCurrentCart([]);
      setSelectedCustomerId("");
      fetchData();
      setTimeout(() => setStatus(""), 4000);
    } catch (e) {
      console.error("Error saving sale record:", e);
      setStatus("Error processing sale transaction.");
    }
  };

  const handleDeleteSale = (recordId: string) => {
    setSaleToDelete(recordId);
  };

  const confirmDeleteSale = async () => {
    if (!saleToDelete) return;
    try {
      await deleteDoc(doc(db, "sales", saleToDelete));
      setStatus("Sale record deleted successfully!");
      fetchData();
      setTimeout(() => setStatus(""), 3000);
    } catch (e) {
      console.error("Error deleting sale:", e);
      setStatus("Error deleting sale record.");
    }
    setSaleToDelete(null);
  };

  const grandTotalSales = salesRecords.reduce((acc, cur) => acc + cur.totalAmount, 0);

  return (
    <div className="min-h-screen bg-white p-8 pl-12">
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
          #letter-size-invoice, #letter-size-invoice * {
            visibility: visible;
          }
          #letter-size-invoice {
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

      <div className="max-w-5xl mx-auto">
        
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold flex items-center gap-3" style={{ color: '#548235' }}>
            <ShoppingCart size={32} /> SALES & INVOICING
          </h1>
          <div className="bg-green-50 border border-[#548235] px-4 py-2 rounded text-sm font-bold" style={{ color: '#548235' }}>
            Next Invoice: {nextInvoiceNumber}
          </div>
        </div>

        {status && (
          <div className="mb-4 text-center p-2 bg-green-50 rounded font-bold border border-[#548235]" style={{ color: '#548235' }}>
            {status}
          </div>
        )}

        {/* New Sale Form */}
        <div className="bg-green-50 p-6 rounded-lg border border-[#548235] mb-8 shadow-sm">
          <h2 className="text-lg font-bold mb-4" style={{ color: '#548235' }}>New Sale POS Entry</h2>

          <div className="mb-4">
            <label className="block text-sm font-bold text-gray-700 mb-1">Select Customer</label>
            <select
              className="w-full md:w-1/2 p-2 border border-[#548235] rounded bg-white text-gray-800 text-sm focus:outline-none"
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
            >
              <option value="">-- Walk-in / General Customer --</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <form onSubmit={handleAddToCart} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end mb-4 bg-white p-4 rounded border border-[#548235]">
            <div className="md:col-span-1">
              <label className="block text-xs font-bold text-gray-700 mb-1">Product</label>
              <select
                className="w-full p-2 border border-[#548235] rounded bg-white text-gray-800 text-sm focus:outline-none"
                value={selectedProductId}
                onChange={(e) => handleProductChange(e.target.value)}
                required
              >
                <option value="">-- Choose Product --</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Quantity</label>
              <input
                type="number"
                min="1"
                placeholder="Qty"
                className="w-full p-2 border border-[#548235] rounded bg-white text-gray-800 text-sm focus:outline-none"
                value={saleQty}
                onChange={(e) => setSaleQty(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Sale Price ($)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="Price"
                className="w-full p-2 border border-[#548235] rounded bg-white text-gray-800 text-sm focus:outline-none"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                required
              />
            </div>

            <div>
              <button
                type="submit"
                className="w-full flex items-center justify-center gap-1 px-4 py-2 font-bold text-white rounded shadow transition hover:opacity-90"
                style={{ backgroundColor: '#548235' }}
              >
                <Plus size={16} /> Add Item
              </button>
            </div>
          </form>

          {/* Cart Items List */}
          {currentCart.length > 0 && (
            <div className="mb-4 bg-white rounded border border-[#548235] overflow-hidden">
              <div className="p-3 bg-green-50 font-bold text-sm border-b border-[#548235]" style={{ color: '#548235' }}>
                Cart Items for Invoice {nextInvoiceNumber}
              </div>
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-gray-600">
                    <th className="p-2.5">Product</th>
                    <th className="p-2.5 text-center">Qty</th>
                    <th className="p-2.5 text-right">Unit Price</th>
                    <th className="p-2.5 text-right">Subtotal</th>
                    <th className="p-2.5 text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {currentCart.map((item, idx) => (
                    <tr key={idx} className="border-b border-gray-100">
                      <td className="p-2.5 font-semibold text-gray-800">{item.productName}</td>
                      <td className="p-2.5 text-center">{formatNumber(item.qty)}</td>
                      <td className="p-2.5 text-right">${formatCurrency(item.unitPrice)}</td>
                      <td className="p-2.5 text-right font-bold" style={{ color: '#548235' }}>${formatCurrency(item.subtotal)}</td>
                      <td className="p-2.5 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveCartItem(idx)}
                          className="text-gray-400 hover:text-[#C00000]"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="p-4 bg-green-50 flex justify-between items-center border-t border-[#548235]">
                <div className="text-base font-bold" style={{ color: '#548235' }}>
                  Total Invoice Amount: ${formatCurrency(cartTotal)}
                </div>
                <button
                  type="button"
                  onClick={handleCompleteSale}
                  className="px-6 py-2 font-bold text-white rounded shadow transition hover:opacity-95"
                  style={{ backgroundColor: '#548235' }}
                >
                  Complete Sale & Generate Invoice
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Sales Records Log */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold" style={{ color: '#548235' }}>
            Sales History Log ({salesRecords.length} invoices)
          </h2>
          <div className="font-bold text-sm bg-green-50 px-3 py-1.5 rounded border border-[#548235]" style={{ color: '#548235' }}>
            Total Revenue: ${formatCurrency(grandTotalSales)}
          </div>
        </div>

        <div className="border border-[#548235] rounded-lg overflow-hidden shadow-sm bg-white">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-green-50 border-b border-[#548235]" style={{ color: '#548235' }}>
                <th className="p-3 font-bold border-r border-[#548235]">Invoice N°</th>
                <th className="p-3 font-bold border-r border-[#548235]">Date & Time</th>
                <th className="p-3 font-bold border-r border-[#548235]">Customer</th>
                <th className="p-3 font-bold border-r border-[#548235]">Items Summary</th>
                <th className="p-3 font-bold border-r border-[#548235]">Total Amount</th>
                <th className="p-3 font-bold text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {salesRecords.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-6 text-gray-400">
                    No sales records found.
                  </td>
                </tr>
              ) : (
                salesRecords.map((sale) => (
                  <tr key={sale.id} className="border-b border-gray-200 hover:bg-gray-50 align-top">
                    <td className="p-3 font-bold text-gray-800 border-r border-gray-200">
                      {sale.invoiceNumber}
                    </td>
                    <td className="p-3 text-sm text-gray-600 border-r border-gray-200">
                      {sale.dateTime}
                    </td>
                    <td className="p-3 font-medium text-gray-800 border-r border-gray-200">
                      {sale.customerName}
                    </td>
                    <td className="p-3 text-xs text-gray-700 border-r border-gray-200">
                      <ul className="list-disc list-inside space-y-0.5">
                        {sale.items.map((i, idx) => (
                          <li key={idx}>
                            <span className="font-semibold">{i.productName}</span>: {formatNumber(i.qty)} x ${formatCurrency(i.unitPrice)} (${formatCurrency(i.subtotal)})
                          </li>
                        ))}
                      </ul>
                    </td>
                    <td className="p-3 font-bold border-r border-gray-200" style={{ color: '#548235' }}>
                      ${formatCurrency(sale.totalAmount)}
                    </td>
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => setViewingInvoice(sale)}
                          className="text-gray-400 hover:text-[#548235]"
                          title="View / Print Invoice PDF"
                        >
                          <Printer size={18} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteSale(sale.id)}
                          className="text-gray-400 hover:text-[#C00000]"
                          title="Delete Sale"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

      </div>

      {/* Invoice Modal Preview */}
      {viewingInvoice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div 
            id="letter-size-invoice"
            className="bg-white p-6 rounded-lg w-full max-w-3xl shadow-2xl relative my-8 flex flex-col justify-between"
            style={{ minHeight: '75vh' }}
          >
            
            <button
              onClick={() => setViewingInvoice(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 no-print"
            >
              <X size={24} />
            </button>

            <div>
              {/* Header with App Logo & Name (PIZZATTA) */}
              <div className="flex justify-between items-start border-b border-gray-300 pb-4 mb-4">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-xl flex items-center justify-center font-black text-white text-2xl shadow-md" style={{ backgroundColor: '#C00000' }}>
                    P
                  </div>
                  <div>
                    <h2 className="text-2xl font-black tracking-wider text-gray-900">PIZZATTA</h2>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mt-0.5">Business Management</p>
                  </div>
                </div>
                <div className="text-right">
                  <h3 className="text-xl font-black text-gray-800 tracking-tight">INVOICE</h3>
                  <p className="text-sm font-bold mt-0.5" style={{ color: '#548235' }}>{viewingInvoice.invoiceNumber}</p>
                  <p className="text-xs text-gray-500 mt-0.5">Date & Time: {viewingInvoice.dateTime}</p>
                </div>
              </div>

              {/* Customer Details Section */}
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 text-sm mb-5">
                <div className="font-bold text-xs text-gray-500 uppercase tracking-wider mb-1">Billed To:</div>
                <div className="font-extrabold text-gray-900 text-sm">{viewingInvoice.customerName}</div>
                {viewingInvoice.customerPhone && (
                  <div className="text-gray-600 text-xs mt-0.5">Phone: {viewingInvoice.customerPhone}</div>
                )}
                {viewingInvoice.customerAddress && (
                  <div className="text-gray-600 text-xs mt-0.5">Address: {viewingInvoice.customerAddress}</div>
                )}
              </div>

              {/* Regular Invoice Items Table */}
              <table className="w-full border-collapse text-left text-sm mb-5">
                <thead>
                  <tr className="border-b-2 border-gray-800 text-gray-800">
                    <th className="py-2.5 font-bold">Item Description</th>
                    <th className="py-2.5 font-bold text-center">Qty</th>
                    <th className="py-2.5 font-bold text-right">Unit Price</th>
                    <th className="py-2.5 font-bold text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {viewingInvoice.items.map((item, idx) => (
                    <tr key={idx} className="border-b border-gray-200">
                      <td className="py-2.5 font-semibold text-gray-800">{item.productName}</td>
                      <td className="py-2.5 text-center text-gray-700">{formatNumber(item.qty)}</td>
                      <td className="py-2.5 text-right text-gray-700">${formatCurrency(item.unitPrice)}</td>
                      <td className="py-2.5 text-right font-bold text-gray-900">${formatCurrency(item.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div>
              {/* Totals Section */}
              <div className="flex justify-end pt-3 border-t border-gray-200 mb-4">
                <div className="w-64 space-y-1 text-sm">
                  <div className="flex justify-between font-extrabold text-base pt-1 text-gray-900 border-t border-gray-300">
                    <span>Total Amount:</span>
                    <span style={{ color: '#548235' }}>${formatCurrency(viewingInvoice.totalAmount)}</span>
                  </div>
                </div>
              </div>

              <div className="text-center text-xs text-gray-400 pt-3 border-t border-gray-200">
                Thank you for your business! — Pizzatta Business Management System
              </div>

              {/* Modal Actions */}
              <div className="mt-4 flex justify-end gap-3 no-print pt-2 border-t border-gray-100">
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-2 px-6 py-2.5 font-bold text-white rounded-lg shadow transition hover:opacity-95"
                  style={{ backgroundColor: '#548235' }}
                >
                  <Printer size={18} /> Print Invoice
                </button>
                <button
                  onClick={() => setViewingInvoice(null)}
                  className="px-5 py-2.5 bg-gray-200 text-gray-700 font-bold rounded-lg hover:bg-gray-300 transition"
                >
                  Close
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      <ConfirmModal
        open={!!saleToDelete}
        message="Are you sure you want to delete this sale record?"
        onConfirm={confirmDeleteSale}
        onCancel={() => setSaleToDelete(null)}
      />

    </div>
  );
}