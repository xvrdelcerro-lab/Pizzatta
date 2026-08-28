"use client";

import React, { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";
import { Package, Search, AlertCircle } from "lucide-react";

interface Product {
  id: string;
  name: string;
}

interface ProductionRecord {
  productName: string;
  quantity: number;
  unitsObtained?: number;
}

interface SaleRecord {
  productName?: string;
  items?: { name?: string; productName?: string; quantity?: number; qty?: number }[];
  quantity?: number;
  qty?: number;
}

interface StockItem {
  productName: string;
  producedQty: number;
  soldQty: number;
  availableQty: number;
}

export default function StockPage() {
  const [stockList, setStockList] = useState<StockItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchStockData = async () => {
    try {
      setLoading(true);

      // 1. Fetch Products
      const prodSnap = await getDocs(collection(db, "products"));
      const productsMap = new Map<string, string>(); // name -> name
      prodSnap.docs.forEach(d => {
        const data = d.data();
        const name = (data.name || "").toString().trim();
        if (name) {
          productsMap.set(name.toLowerCase(), name);
        }
      });

      // 2. Fetch Production records ("dayproduction")
      const prodRecordsSnap = await getDocs(collection(db, "dayproduction"));
      const producedMap = new Map<string, number>(); // productName -> total produced
      prodRecordsSnap.docs.forEach(d => {
        const data = d.data() as ProductionRecord;
        const name = (data.productName || "").toString().trim();
        // Prefer the actual units obtained (real output) over the expected/planned quantity.
        // Falls back to quantity for older records saved before "Units Obtained" existed.
        const obtained = Number(data.unitsObtained || 0);
        const qty = obtained > 0 ? obtained : Number(data.quantity || 0);
        if (name) {
          productsMap.set(name.toLowerCase(), name);
          const current = producedMap.get(name.toLowerCase()) || 0;
          producedMap.set(name.toLowerCase(), current + qty);
        }
      });

      // 3. Fetch Sales records ("sales")
      const salesSnap = await getDocs(collection(db, "sales"));
      const soldMap = new Map<string, number>(); // productName -> total sold
      salesSnap.docs.forEach(d => {
        const data = d.data() as SaleRecord;
        
        // Handle items array if present, or single product entry
        if (Array.isArray(data.items)) {
          data.items.forEach(item => {
            const itemName = (item.name || item.productName || "").toString().trim();
            const itemQty = Number(item.quantity || item.qty || 0);
            if (itemName) {
              productsMap.set(itemName.toLowerCase(), itemName);
              const current = soldMap.get(itemName.toLowerCase()) || 0;
              soldMap.set(itemName.toLowerCase(), current + itemQty);
            }
          });
        } else {
          const name = (data.productName || "").toString().trim();
          const qty = Number(data.quantity || data.qty || 0);
          if (name) {
            productsMap.set(name.toLowerCase(), name);
            const current = soldMap.get(name.toLowerCase()) || 0;
            soldMap.set(name.toLowerCase(), current + qty);
          }
        }
      });

      // 4. Combine into Stock Items (Production minus Sale)
      const combinedStock: StockItem[] = [];
      productsMap.forEach((originalName, lowerKey) => {
        const producedQty = producedMap.get(lowerKey) || 0;
        const soldQty = soldMap.get(lowerKey) || 0;
        const availableQty = producedQty - soldQty;

        combinedStock.push({
          productName: originalName,
          producedQty,
          soldQty,
          availableQty
        });
      });

      // Sort alphabetically by product name
      combinedStock.sort((a, b) => a.productName.localeCompare(b.productName));
      setStockList(combinedStock);
    } catch (e) {
      console.error("Error calculating stock data:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStockData();
  }, []);

  const formatNumber = (num: number) => {
    return num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  };

  const filteredStock = stockList.filter(item =>
    item.productName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalItemsInStock = stockList.reduce((acc, cur) => acc + cur.availableQty, 0);

  return (
    <div className="min-h-screen bg-white p-8 pl-12">
      <div className="max-w-5xl mx-auto">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3" style={{ color: '#548235' }}>
              <Package size={32} /> PRODUCTS STOCK
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Real-time stock tracking calculated from Units Obtained (actual production) minus Total Sales.
            </p>
          </div>

          <div className="bg-green-50 border border-[#548235] px-5 py-3 rounded-lg text-right shadow-sm">
            <div className="text-xs font-bold text-gray-600 uppercase tracking-wider">Total Units in Stock</div>
            <div className="text-2xl font-black" style={{ color: '#548235' }}>
              {formatNumber(totalItemsInStock)}
            </div>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="mb-6 relative">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400">
            <Search size={18} />
          </span>
          <input
            type="text"
            placeholder="Search products by name..."
            className="w-full pl-10 pr-4 py-2.5 border border-[#548235] rounded-lg bg-white text-gray-800 text-sm focus:outline-none shadow-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Stock Table */}
        <div className="border border-[#548235] rounded-lg overflow-hidden shadow-sm bg-white">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-green-50 border-b border-[#548235]" style={{ color: '#548235' }}>
                <th className="p-4 font-bold border-r border-[#548235]">Product Name</th>
                <th className="p-4 font-bold border-r border-[#548235] text-center">Total Produced</th>
                <th className="p-4 font-bold border-r border-[#548235] text-center">Total Sold</th>
                <th className="p-4 font-bold text-center">Available Stock</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="text-center py-10 text-gray-400 italic">
                    Loading stock information...
                  </td>
                </tr>
              ) : filteredStock.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-10 text-gray-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <AlertCircle size={24} className="text-gray-300" />
                      <span>No products found matching your search.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredStock.map((item, idx) => {
                  const isLowStock = item.availableQty <= 0;
                  return (
                    <tr key={idx} className="border-b border-gray-200 hover:bg-gray-50 transition">
                      <td className="p-4 font-bold text-gray-800 border-r border-gray-200">
                        {item.productName}
                      </td>

                      <td className="p-4 text-center text-gray-600 border-r border-gray-200 font-medium">
                        {formatNumber(item.producedQty)}
                      </td>

                      <td className="p-4 text-center text-gray-600 border-r border-gray-200 font-medium">
                        {formatNumber(item.soldQty)}
                      </td>

                      <td className="p-4 text-center font-bold">
                        <span
                          className={`inline-block px-3 py-1 rounded-full text-sm ${
                            isLowStock
                              ? "bg-red-50 text-[#C00000] border border-red-200"
                              : "bg-green-50 text-[#548235] border border-[#548235]"
                          }`}
                        >
                          {formatNumber(item.availableQty)}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
}