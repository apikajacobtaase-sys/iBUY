 // src/app/admin/layout.tsx
"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import { useAdminRole } from "@/hooks/usePermissions";
import {
  LayoutDashboard, Users, Store, Package, FolderTree, ShoppingCart,
  CreditCard, Wallet, AlertTriangle, Tag, Star, LifeBuoy, BarChart3,
  UserCog, ScrollText, Settings, Truck, Globe, Mail,
} from "lucide-react";
import type { SidebarItem } from "@/components/dashboard/Sidebar"; // Ensure this path is correct
import Sidebar from "@/components/dashboard/Sidebar"; // Ensure this path is correct

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { isAdmin, isSuperAdmin } = useAdminRole();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login?callbackUrl=/admin");
    } else if (status === "authenticated" && !isAdmin) {
      router.push("/");
    }
  }, [status, isAdmin, router]);

  const sidebarItems = useMemo<SidebarItem[]>(() => {
    const allItems: SidebarItem[] = [
      { label: "Overview", href: "/admin", icon: LayoutDashboard },
      { label: "Sellers", href: "/admin/sellers", icon: Store },
      { label: "Customers", href: "/admin/customers", icon: Users },
      { label: "Products", href: "/admin/products", icon: Package },
      { label: "Categories", href: "/admin/categories", icon: FolderTree },
      { label: "Orders", href: "/admin/orders", icon: ShoppingCart },
      { label: "Payments", href: "/admin/payments", icon: CreditCard },
      { label: "Payouts", href: "/admin/payouts", icon: Wallet },
      { label: "Disputes", href: "/admin/disputes", icon: AlertTriangle },
      { label: "Promotions", href: "/admin/promotions", icon: Tag },
      { label: "Reviews", href: "/admin/reviews", icon: Star },
      { label: "Support", href: "/admin/support", icon: LifeBuoy },
      { label: "Analytics", href: "/admin/analytics", icon: BarChart3 },
      { label: "Staff", href: "/admin/staff", icon: UserCog },
      { label: "Audit Logs", href: "/admin/audit-logs", icon: ScrollText },
      { label: "Settings", href: "/admin/settings", icon: Settings },
      { label: "Communications", href: "/admin/communications", icon: Mail },
      { label: "Locations", href: "/admin/locations", icon: Globe },
      { label: "Delivery & Logistics", href: "/admin/delivery", icon: Truck },
    ];

    return allItems.filter((item) => {
      if (isSuperAdmin) return true;
      if (isAdmin) {
        if (item.href === "/admin/staff") return false;
        return true;
      }
      if (session?.user?.role === "SUPPORT") {
        return ["/admin", "/admin/orders", "/admin/disputes", "/admin/support", "/admin/reviews"].includes(item.href);
      }
      return false;
    });
  }, [isAdmin, isSuperAdmin, session]);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    // 👇 Flex container ensures main content resizes when sidebar opens/closes
    <div className="min-h-screen bg-gray-50 flex">
      
      {/* Sidebar handles its own open/close state */}
      <Sidebar
        items={sidebarItems}
        title="Admin Dashboard"
        logo="A"
        accentColor="bg-indigo-600"
      />

      {/* Main content automatically fills the remaining space */}
      <main className="flex-1 p-4 sm:p-6 min-w-0 transition-all duration-300">
        {children}
      </main>
      
    </div>
  );
}