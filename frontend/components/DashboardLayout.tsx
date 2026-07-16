"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { logout } from "@/lib/auth";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Truck,
  Route,
  ClipboardList,
  PackagePlus,
  Package,
  LogOut,
  Leaf,
  Inbox,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

interface DashboardLayoutProps {
  children: React.ReactNode;
  navItems: NavItem[];
  title?: string;
}

export const warehouseNav: NavItem[] = [
  { href: "/warehouse/dashboard", label: "Dashboard", icon: <LayoutDashboard className="h-4 w-4" /> },
  { href: "/warehouse/requests/new", label: "New Request", icon: <PackagePlus className="h-4 w-4" /> },
  { href: "/warehouse/requests", label: "Requests", icon: <Package className="h-4 w-4" /> },
];

export const logisticsNav: NavItem[] = [
  { href: "/logistics/dashboard", label: "Dashboard", icon: <LayoutDashboard className="h-4 w-4" /> },
  { href: "/logistics/requests", label: "Requests", icon: <Inbox className="h-4 w-4" /> },
  { href: "/logistics/plans", label: "Plans", icon: <ClipboardList className="h-4 w-4" /> },
  { href: "/logistics/routes", label: "Routes", icon: <Route className="h-4 w-4" /> },
  { href: "/logistics/trucks", label: "Fleet", icon: <Truck className="h-4 w-4" /> },
];

export default function DashboardLayout({ children, navItems, title }: DashboardLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="flex w-60 flex-col border-r bg-card">
        {/* Logo */}
        <div className="flex h-14 items-center gap-2 px-4">
          <Leaf className="h-5 w-5 text-green-600" />
          <span className="text-lg font-semibold">AgriLoad</span>
        </div>

        <Separator />

        {/* Navigation */}
        <nav className="flex-1 space-y-1 p-3">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                pathname === item.href
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              {item.icon}
              {item.label}
            </Link>
          ))}
        </nav>

        <Separator />

        {/* Logout */}
        <div className="p-3">
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 text-muted-foreground"
            onClick={() => {
              logout();
              router.replace("/login");
            }}
          >
            <LogOut className="h-4 w-4" />
            Log out
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        {title && (
          <header className="sticky top-0 z-10 flex h-14 items-center border-b bg-background/95 px-6 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <h1 className="text-lg font-semibold">{title}</h1>
          </header>
        )}
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}
