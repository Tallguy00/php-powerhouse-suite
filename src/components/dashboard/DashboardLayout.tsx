import { ReactNode } from "react";
import { NavLink, useNavigate, Navigate } from "react-router-dom";
import { useAuth, AppRole } from "@/hooks/useAuth";
import { useLang } from "@/i18n/LanguageContext";
import { Logo } from "@/components/Logo";
import { LanguageToggle } from "@/components/LanguageToggle";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard, Receipt, Activity, AlertTriangle, Gauge,
  Users, Coins, Wrench, LogOut, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const DashboardLayout = ({ children }: { children: ReactNode }) => {
  const { user, roles, loading, signOut } = useAuth();
  const { t, lang } = useLang();
  const navigate = useNavigate();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  if (!user) return <Navigate to="/auth?mode=signin" replace />;

  const isAdmin = roles.includes("admin");
  const isTech = roles.includes("technician");

  const customerNav = [
    { to: "/dashboard", icon: LayoutDashboard, key: "dash_overview" as const, end: true },
    { to: "/dashboard/bills", icon: Receipt, key: "dash_bills" as const },
    { to: "/dashboard/consumption", icon: Activity, key: "dash_consumption" as const },
    { to: "/dashboard/outages", icon: AlertTriangle, key: "dash_outages" as const },
  ];
  const adminNav = [
    { to: "/admin", icon: LayoutDashboard, key: "dash_overview" as const, end: true },
    { to: "/admin/customers", icon: Users, key: "dash_customers" as const },
    { to: "/admin/meters", icon: Gauge, key: "dash_meters" as const },
    { to: "/admin/bills", icon: Receipt, key: "dash_bills" as const },
    { to: "/admin/tariffs", icon: Coins, key: "dash_tariffs" as const },
    { to: "/admin/outages", icon: AlertTriangle, key: "dash_outages" as const },
  ];
  const techNav = [
    { to: "/technician", icon: LayoutDashboard, key: "dash_overview" as const, end: true },
    { to: "/technician/tasks", icon: Wrench, key: "dash_tasks" as const },
    { to: "/technician/outages", icon: AlertTriangle, key: "dash_outages" as const },
  ];

  const nav = isAdmin ? adminNav : isTech ? techNav : customerNav;
  const roleLabel: AppRole = isAdmin ? "admin" : isTech ? "technician" : "customer";
  const roleBadgeKey =
    roleLabel === "admin" ? "dash_admin" : roleLabel === "technician" ? "dash_technician" : "dash_customer";

  return (
    <div className="min-h-screen flex bg-muted/30">
      {/* Sidebar */}
      <aside className="hidden md:flex w-64 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
        <div className="p-5 border-b border-sidebar-border">
          <Logo />
          <div className={`mt-3 inline-flex items-center gap-1.5 rounded-full bg-sidebar-accent px-2.5 py-1 text-xs font-semibold text-sidebar-primary ${lang === "am" ? "font-ethiopic" : ""}`}>
            <span className="h-1.5 w-1.5 rounded-full bg-sidebar-primary animate-pulse-glow" />
            {t(roleBadgeKey)}
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {nav.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-smooth",
                    isActive
                      ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-elegant"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                  )
                }
              >
                <Icon className="h-4 w-4" />
                <span className={lang === "am" ? "font-ethiopic" : ""}>{t(item.key)}</span>
              </NavLink>
            );
          })}
        </nav>
        <div className="p-3 border-t border-sidebar-border space-y-2">
          <div className="flex items-center justify-between px-2">
            <span className="text-xs text-sidebar-foreground/60 truncate">{user.email}</span>
            <LanguageToggle />
          </div>
          <Button
            variant="ghost"
            className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent"
            onClick={async () => { await signOut(); navigate("/"); }}
          >
            <LogOut className="h-4 w-4 mr-2" />
            <span className={lang === "am" ? "font-ethiopic" : ""}>{t("dash_signout")}</span>
          </Button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile top bar */}
        <header className="md:hidden flex items-center justify-between p-4 border-b bg-background">
          <Logo size="sm" />
          <div className="flex items-center gap-2">
            <LanguageToggle />
            <Button variant="ghost" size="icon" onClick={async () => { await signOut(); navigate("/"); }}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </header>
        {/* Mobile nav */}
        <nav className="md:hidden flex overflow-x-auto gap-1 p-2 border-b bg-background">
          {nav.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium whitespace-nowrap transition-smooth",
                    isActive ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  )
                }
              >
                <Icon className="h-3.5 w-3.5" />
                <span className={lang === "am" ? "font-ethiopic" : ""}>{t(item.key)}</span>
              </NavLink>
            );
          })}
        </nav>
        <main className="flex-1 p-6 md:p-10 overflow-x-hidden">{children}</main>
      </div>
    </div>
  );
};