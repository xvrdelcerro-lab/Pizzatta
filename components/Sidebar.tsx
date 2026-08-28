"use client";

import { usePathname, useRouter } from "next/navigation";
import { 
  LayoutDashboard, 
  Store, 
  Package, 
  ClipboardList, 
  Boxes, 
  Users, 
  UserCheck, 
  ChefHat, 
  Layers, 
  ShoppingCart,
  FileText 
} from "lucide-react";

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const menuItems = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Vendors", href: "/vendors", icon: Store },
    { name: "Products", href: "/products", icon: Package },
    { name: "Entries", href: "/entries", icon: ClipboardList },
    { name: "Inventory", href: "/inventory", icon: Boxes },
    { name: "Customers", href: "/customers", icon: Users },
    { name: "Attendance", href: "/attendance", icon: UserCheck },
    { name: "Production", href: "/dayproduction", icon: ChefHat },
    { name: "Stock", href: "/stock", icon: Layers },
    { name: "Sales", href: "/sales", icon: ShoppingCart },
    { name: "Reports", href: "/reports", icon: FileText },
  ];

  return (
    <aside className="w-64 bg-[#C00000] text-white flex flex-col h-screen fixed left-0 top-0 shadow-lg z-[9999]">
      <div className="p-6 border-b border-red-700">
        <div 
          onClick={() => router.push("/")} 
          className="block cursor-pointer select-none"
        >
          <h1 className="text-2xl font-bold tracking-wider">PIZZATTA</h1>
          <p className="text-xs text-red-200 mt-1">Business Management</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <button
              key={item.name}
              type="button"
              onClick={() => router.push(item.href)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-semibold text-sm transition-colors text-left cursor-pointer ${
                isActive 
                  ? "bg-transparent text-white" 
                  : "text-white hover:bg-red-700/60"
              }`}
            >
              <Icon size={20} />
              <span>{item.name}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}