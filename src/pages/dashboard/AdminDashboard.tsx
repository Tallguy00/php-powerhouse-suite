import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { StatCard } from "@/components/dashboard/StatCard";
import { supabase } from "@/integrations/supabase/client";
import { useLang } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { Users, Gauge, Receipt, AlertTriangle, Loader2 } from "lucide-react";
import { Navigate } from "react-router-dom";

const AdminDashboard = () => {
  const { roles, loading } = useAuth();
  const { t, lang } = useLang();
  const [stats, setStats] = useState({ customers: 0, meters: 0, revenue: 0, outages: 0 });

  useEffect(() => {
    if (!roles.includes("admin")) return;
    (async () => {
      const [{ count: customers }, { count: meters }, { data: payments }, { count: outages }] = await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("meters").select("*", { count: "exact", head: true }),
        supabase.from("payments").select("amount_etb"),
        supabase.from("outages").select("*", { count: "exact", head: true }).in("status", ["reported", "investigating", "in_progress"]),
      ]);
      const revenue = (payments ?? []).reduce((s: number, p: any) => s + Number(p.amount_etb), 0);
      setStats({ customers: customers ?? 0, meters: meters ?? 0, revenue, outages: outages ?? 0 });
    })();
  }, [roles]);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!roles.includes("admin")) return <Navigate to="/dashboard" replace />;

  return (
    <DashboardLayout>
      <div>
        <h1 className={`text-3xl font-bold tracking-tight ${lang === "am" ? "font-ethiopic" : ""}`}>
          {lang === "am" ? "የአስተዳዳሪ ዳሽቦርድ" : "Admin Dashboard"}
        </h1>
        <p className={`mt-1 text-muted-foreground ${lang === "am" ? "font-ethiopic" : ""}`}>
          {lang === "am" ? "የስርዓት አጠቃላይ እይታ" : "System overview & key metrics"}
        </p>
      </div>

      <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard icon={Users} tone="primary" label={t("dash_customers")} value={stats.customers.toLocaleString()} amharic={lang === "am"} />
        <StatCard icon={Gauge} tone="secondary" label={t("dash_meters")} value={stats.meters.toLocaleString()} amharic={lang === "am"} />
        <StatCard icon={Receipt} tone="success" label={lang === "am" ? "ጠቅላላ ገቢ" : "Total Revenue"} value={`${stats.revenue.toLocaleString()} ETB`} amharic={lang === "am"} />
        <StatCard icon={AlertTriangle} tone="accent" label={t("dash_active_outages")} value={String(stats.outages)} amharic={lang === "am"} />
      </div>

      <div className="mt-10 rounded-2xl border border-border bg-card p-8 text-center text-muted-foreground">
        <p className={lang === "am" ? "font-ethiopic" : ""}>
          {lang === "am" ? "የአስተዳዳሪ ሞጁሎች በቅርቡ ይመጣሉ — ደንበኞች፣ ሜትሮች፣ ታሪፎች፣ መቋረጦች።" : "Admin modules coming soon — customers, meters, tariffs, outages."}
        </p>
      </div>
    </DashboardLayout>
  );
};

export default AdminDashboard;