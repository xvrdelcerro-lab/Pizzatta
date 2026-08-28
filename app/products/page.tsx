"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from "firebase/firestore";
import { PlusCircle, Trash2, Edit2, X } from "lucide-react";
import ConfirmModal from "@/components/ConfirmModal";

export default function ProductsPage() {
  const [ingredients, setIngredients] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [productionRecords, setProductionRecords] = useState<any[]>([]);
  const [productToDelete, setProductToDelete] = useState<any>(null);
  
  const [productCode, setProductCode] = useState("");
  const [productName, setProductName] = useState("");
  const [category, setCategory] = useState("");
  
  const [selectedIngredient, setSelectedIngredient] = useState<any>(null);
  const [ingredientQty, setIngredientQty] = useState("");
  const [ingredientUnit, setIngredientUnit] = useState("");
  const [recipeItems, setRecipeItems] = useState<any[]>([]);
  const [status, setStatus] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const vendorsSnap = await getDocs(collection(db, "vendors"));
        const allIngredients: any[] = [];

        vendorsSnap.docs.forEach(vendorDoc => {
          const vendorData = vendorDoc.data();
          if (vendorData.items && Array.isArray(vendorData.items)) {
            vendorData.items.forEach((item: any, idx: number) => {
              const itemCategory = String(item.category || "").toLowerCase();
              // Only Ingredients belong in a product recipe; Provisions (soap, packaging, etc.) don't.
              if (itemCategory.includes("provision")) return;

              const rawPrice = item.price ?? item.cost ?? item.unitCost ?? 0;
              const cleanedPrice = typeof rawPrice === "string" 
                ? parseFloat(rawPrice.replace(/[^0-9.]/g, "")) || 0 
                : Number(rawPrice) || 0;

              allIngredients.push({
                id: `${vendorDoc.id}-${idx}`,
                name: item.description || item.name || item.item || "Ingredient",
                unit: item.unit || item.unitOfMeasure || "Kg",
                unitCost: cleanedPrice,
                vendorId: vendorDoc.id,
                vendorName: vendorData.contactPerson || "Vendor"
              });
            });
          }
        });

        setIngredients(allIngredients);

        const productsSnap = await getDocs(collection(db, "products"));
        setProducts(productsSnap.docs.map(d => ({ id: d.id, ...d.data() })));

        const productionSnap = await getDocs(collection(db, "dayproduction"));
        setProductionRecords(productionSnap.docs.map(d => d.data()));
      } catch (err) {
        console.error("Error fetching data:", err);
      }
    };
    fetchData();
  }, []);

  const handleIngredientSelect = (id: string) => {
    const ing = ingredients.find(i => i.id === id);
    setSelectedIngredient(ing || null);
    if (ing) {
      setIngredientUnit(ing.unit || "Kg");
    } else {
      setIngredientUnit("");
    }
  };

  const addIngredientToRecipe = () => {
    if (!selectedIngredient || !ingredientQty) return;
    const qtyNum = parseFloat(ingredientQty) || 0;
    const unitCost = Number(selectedIngredient.unitCost || 0);
    const totalCost = qtyNum * unitCost;

    setRecipeItems([
      ...recipeItems,
      {
        ingredientId: selectedIngredient.id,
        name: selectedIngredient.name,
        qty: qtyNum,
        unit: ingredientUnit,
        unitCost,
        totalCost
      }
    ]);

    setSelectedIngredient(null);
    setIngredientQty("");
    setIngredientUnit("");
  };

  const removeRecipeItem = (index: number) => {
    setRecipeItems(recipeItems.filter((_, i) => i !== index));
  };

  const totalCost = recipeItems.reduce((sum, item) => sum + item.totalCost, 0);
  const totalUnits = recipeItems.reduce((sum, item) => sum + item.qty, 0);

  const saveProduct = async () => {
    if (!productCode || !productName || recipeItems.length === 0) return;

    const trimmedCode = productCode.trim().toLowerCase();

    const codeExists = products.some(p => p.code && p.code.trim().toLowerCase() === trimmedCode && p.id !== editingId);
    if (codeExists) {
      setStatus("Error: A product with this code already exists (case-insensitive).");
      return;
    }

    try {
      if (editingId) {
        await updateDoc(doc(db, "products", editingId), {
          code: productCode.trim(),
          name: productName,
          category,
          recipe: recipeItems,
          totalCost,
          totalUnits,
          updatedAt: new Date()
        });
        setStatus("Product updated successfully!");
      } else {
        await addDoc(collection(db, "products"), {
          code: productCode.trim(),
          name: productName,
          category,
          recipe: recipeItems,
          totalCost,
          totalUnits,
          timestamp: new Date()
        });
        setStatus("Product saved successfully!");
      }

      setProductCode("");
      setProductName("");
      setCategory("");
      setRecipeItems([]);
      setEditingId(null);
      
      const productsSnap = await getDocs(collection(db, "products"));
      setProducts(productsSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      setTimeout(() => setStatus(""), 3000);
    } catch (e) {
      setStatus("Error saving product.");
    }
  };

  const startEditProduct = (p: any) => {
    setEditingId(p.id);
    setProductCode(p.code || "");
    setProductName(p.name || "");
    setCategory(p.category || "");
    setRecipeItems(p.recipe || []);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setProductCode("");
    setProductName("");
    setCategory("");
    setRecipeItems([]);
    setStatus("");
  };

  const deleteProduct = (p: any) => {
    const isUsedInProduction = productionRecords.some(rec => 
      rec.productId === p.id || 
      rec.code === p.code || 
      rec.productName === p.name || 
      (rec.items && rec.items.some((i: any) => i.productId === p.id || i.code === p.code))
    );

    if (isUsedInProduction) {
      setStatus(`Cannot delete "${p.name}" because it is currently used in production records.`);
      setTimeout(() => setStatus(""), 4000);
      return;
    }

    setProductToDelete(p);
  };

  const confirmDeleteProduct = async () => {
    if (!productToDelete) return;
    const p = productToDelete;
    try {
      await deleteDoc(doc(db, "products", p.id));
      setProducts(products.filter(item => item.id !== p.id));
      setStatus("Product deleted successfully.");
      setTimeout(() => setStatus(""), 3000);
    } catch (e) {
      console.error("Error deleting product", e);
    }
    setProductToDelete(null);
  };

  const inputStyle = "p-2 border border-[#C00000] rounded w-full bg-white text-gray-800";

  return (
    <div className="min-h-screen bg-white p-8 pl-12">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-center" style={{ color: '#548235' }}>
          PRODUCTS MANAGEMENT
        </h1>

        <div className="border border-[#548235] p-6 rounded-lg mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold" style={{ color: '#548235' }}>
              {editingId ? "Edit Product" : "Create New Product"}
            </h2>
            {editingId && (
              <button onClick={cancelEdit} className="text-sm text-gray-600 flex items-center gap-1 border border-gray-400 px-3 py-1 rounded">
                <X size={16} /> Cancel Edit
              </button>
            )}
          </div>

          <div className="grid grid-cols-3 gap-4 mb-4">
            <input 
              type="text" 
              placeholder="Code (e.g. PIX-01)" 
              className={inputStyle} 
              value={productCode} 
              onChange={e => setProductCode(e.target.value)} 
            />
            <input 
              type="text" 
              placeholder="Product Name" 
              className={inputStyle} 
              value={productName} 
              onChange={e => setProductName(e.target.value)} 
            />
            <input 
              type="text" 
              placeholder="Category / Family" 
              className={inputStyle} 
              value={category} 
              onChange={e => setCategory(e.target.value)} 
            />
          </div>

          <div className="grid grid-cols-3 gap-4 mb-4">
            <select 
              className={`${inputStyle} col-span-1`} 
              onChange={e => handleIngredientSelect(e.target.value)}
              value={selectedIngredient?.id || ""}
            >
              <option value="">Select Ingredient</option>
              {ingredients.map(ing => (
                <option key={ing.id} value={ing.id}>
                  {ing.name} ({ing.unit} - Cost: ${Number(ing.unitCost || 0).toFixed(2)})
                </option>
              ))}
            </select>

            <input 
              type="number" 
              placeholder="Qty" 
              className={inputStyle} 
              value={ingredientQty} 
              onChange={e => setIngredientQty(e.target.value)} 
            />

            <input 
              type="text" 
              placeholder="Unit" 
              className={inputStyle} 
              value={ingredientUnit} 
              onChange={e => setIngredientUnit(e.target.value)} 
            />
          </div>

          <button 
            type="button" 
            onClick={addIngredientToRecipe} 
            className="bg-[#548235] text-white w-full py-2 rounded font-bold mb-6 flex justify-center gap-2"
          >
            <PlusCircle size={20} /> ADD INGREDIENT
          </button>

          {/* Recipe List Preview */}
          <div className="border border-[#C00000] p-4 rounded mb-6">
            {recipeItems.length === 0 ? (
              <div className="text-gray-400 text-center py-4">No ingredients added to recipe yet.</div>
            ) : (
              <div className="space-y-3">
                {recipeItems.map((item, idx) => {
                  const percentage = totalUnits > 0 ? ((item.qty / totalUnits) * 100).toFixed(1) + "%" : "0%";
                  return (
                    <div key={idx} className="flex justify-between items-center py-2 text-sm border-b border-[#C00000] last:border-b-0" style={{ color: '#548235' }}>
                      <div className="font-bold">
                        {idx + 1}. {item.name} — {item.qty} {item.unit} <span className="text-gray-500 font-normal">(@ ${Number(item.unitCost || 0).toFixed(2)} each)</span>
                      </div>
                      <div className="flex items-center gap-6">
                        <span className="text-gray-600">{percentage}</span>
                        <span className="font-bold text-gray-800">${Number(item.totalCost || 0).toFixed(2)}</span>
                        <button type="button" onClick={() => removeRecipeItem(idx)} className="text-[#C00000]">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  );
                })}

                <div className="pt-2 flex justify-between items-center">
                  <div className="font-bold text-sm" style={{ color: '#548235' }}>
                    Total units : {totalUnits.toFixed(2)}
                  </div>
                  <div className="font-bold text-xl text-[#C00000]">
                    Total Cost: ${totalCost.toFixed(2)}
                  </div>
                </div>
              </div>
            )}
          </div>

          {status && <div className="mb-4 text-center p-2 bg-green-100 rounded font-bold border border-[#548235]" style={{ color: '#548235' }}>{status}</div>}

          <button 
            type="button" 
            onClick={saveProduct}
            disabled={!productName || !productCode || recipeItems.length === 0}
            className="bg-[#C00000] text-white w-full py-3 rounded font-bold hover:bg-opacity-90 disabled:opacity-50"
          >
            {editingId ? "UPDATE PRODUCT" : "SAVE PRODUCT"}
          </button>
        </div>

        {/* Existing Products Section */}
        <h2 className="text-2xl font-bold mb-4" style={{ color: '#548235' }}>
          Existing Products : {products.length}
        </h2>
        <div className="grid grid-cols-1 gap-4">
          {products.map(p => (
            <div key={p.id} className="border border-[#548235] p-4 rounded flex justify-between items-center bg-white shadow-sm">
              <div>
                <span className="font-bold text-lg" style={{ color: '#548235' }}>{p.name}</span> 
                <span className="text-sm text-gray-500 ml-2">({p.code})</span>
                <div className="text-sm text-gray-600">Category: {p.category || "N/A"} | Cost: ${Number(p.totalCost || 0).toFixed(2)}</div>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => startEditProduct(p)} className="text-[#548235] hover:opacity-80" type="button" title="Edit Product">
                  <Edit2 size={20} />
                </button>
                <button onClick={() => deleteProduct(p)} className="text-[#C00000] hover:opacity-80" type="button" title="Delete Product">
                  <Trash2 size={20} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <ConfirmModal
        open={!!productToDelete}
        message={`Are you sure you want to delete the product "${productToDelete?.name}"?`}
        onConfirm={confirmDeleteProduct}
        onCancel={() => setProductToDelete(null)}
      />
    </div>
  );
}