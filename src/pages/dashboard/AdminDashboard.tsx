import { useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import {
  Users, Gauge, Receipt, AlertTriangle, Loader2, Wrench, TrendingUp,
  Clock, ArrowRight, Activity, MapPin,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, BarChart, Bar,
} from "recharts";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { StatCard } from "@/components/dashboard/StatCard";
import { supabase } from "@/integrations/supabase/client";
import { useLang } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

type Stats = {
  customers: number;
  meters: number;
  revenue: number;
  outstanding: number;
  activeOutages: number;
  technicians: number;
};

type RevenuePoint = { label: string; revenue: number };
type StatusSlice = { name: string; value: number; key: string };
type RegionBar = { name: string; meters: number };
type RecentSignup = { id: string; full_name: string | null; customer_number: string | null; created_at: string };
type RecentOutage = { id: string; title: string; severity: string; status: string; created_at: string };

const STATUS_COLORS: Record<string, string> = {
  reported: "hsl(var(--accent))",
  investigating: "hsl(var(--secondary))",
  in_progress: "hsl(var(--primary))",
  resolved: "hsl(var(--muted-foreground))",
};

const SEVERITY_TONE: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-secondary/15 text-secondary border-secondary/30",
  high: "bg-accent/15 text-accent border-accent/30",
  critical: "bg-destructive/15 text-destructive border-destructive/30",
};

const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const monthLabel = (d: Date, am: boolean) =>
  d.toLocaleString(am ? "am-ET" : "en-US", { month: "short" });

const AdminDashboard = () => {
  const { roles, loading } = useAuth();
  const { lang } = useLang();
  const am = lang === "am";

  const [stats, setStats] = useState<Stats>({
    customers: 0, meters: 0, revenue: 0, outstanding: 0, activeOutages: 0, technicians: 0,
  });
  const [revenueSeries, setRevenueSeries] = useState<RevenuePoint[]>([]);
  const [outageMix, setOutageMix] = useState<StatusSlice[]>([]);
  const [regionBars, setRegionBars] = useState<RegionBar[]>([]);
  const [recentSignups, setRecentSignups] = useState<RecentSignup[]>([]);
  const [recentOutages, setRecentOutages] = useState<RecentOutage[]>([]);
  const [fetching, setFetching] = useState(true);

  const isAdmin = roles.includes("admin");

  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      setFetching(true);
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
      sixMonthsAgo.setDate(1);
      sixMonthsAgo.setHours(0, 0, 0, 0);

      const [
        custRes, meterRes, payRes, billRes, outageRes, techRes,
        regionsRes, recentProfilesRes, recentOutagesRes,
      ] = await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("meters").select("region_id"),
        supabase.from("payments").select("amount_etb, paid_at"),
        supabase.from("bills").select("amount_etb, status"),
        supabase.from("outages").select("status"),
        supabase.from("user_roles").select("*", { count: "exact", head: true }).eq("role", "technician"),
        supabase.from("regions").select("id, name_en, name_am"),
        supabase.from("profiles").select("id, full_name, customer_number, created_at").order("created_at", { ascending: false }).limit(5),
        supabase.from("outages").select("id, title, severity, status, created_at").order("created_at", { ascending: false }).limit(5),
      ]);

      // KPIs
      const payments = payRes.data ?? [];
      const revenue = payments.reduce((s, p) => s + Number(p.amount_etb), 0);
      const bills = billRes.data ?? [];
      const outstanding = bills
        .filter((b) => b.status === "unpaid" || b.status === "overdue")
        .reduce((s, b) => s + Number(b.amount_etb), 0);
      const outageRows = outageRes.data ?? [];
      const activeOutages = outageRows.filter((o) =>
        ["reported", "investigating", "in_progress"].includes(o.status)
      ).length;

      setStats({
        customers: custRes.count ?? 0,
        meters: (meterRes.data ?? []).length,
        revenue,
        outstanding,
        activeOutages,
        technicians: techRes.count ?? 0,
      });

      // 6-month revenue trend
      const buckets = new Map<string, { date: Date; revenue: number }>();
      for (let i = 0; i < 6; i++) {
        const d = new Date(sixMonthsAgo);
        d.setMonth(sixMonthsAgo.getMonth() + i);
        buckets.set(monthKey(d), { date: d, revenue: 0 });
      }
      payments.forEach((p) => {
        const d = new Date(p.paid_at);
        const key = monthKey(d);
        const slot = buckets.get(key);
        if (slot) slot.revenue += Number(p.amount_etb);
      });
      setRevenueSeries(
        Array.from(buckets.values()).map((b) => ({ label: monthLabel(b.date, am), revenue: Math.round(b.revenue) }))
      );

      // Outage status mix
      const mix = new Map<string, number>();
      outageRows.forEach((o) => mix.set(o.status, (mix.get(o.status) ?? 0) + 1));
      setOutageMix(
        Array.from(mix.entries()).map(([k, v]) => ({
          key: k,
          name: k.replace("_", " "),
          value: v,
        }))
      );

      // Meters per region (top 6)
      const regionMap = new Map<string, { en: string; am: string }>();
      (regionsRes.data ?? []).forEach((r) => regionMap.set(r.id, { en: r.name_en, am: r.name_am }));
      const regionCounts = new Map<string, number>();
      (meterRes.data ?? []).forEach((m) => {
        if (!m.region_id) return;
        regionCounts.set(m.region_id, (regionCounts.get(m.region_id) ?? 0) + 1);
      });
      setRegionBars(
        Array.from(regionCounts.entries())
          .map(([id, count]) => ({
            name: am ? regionMap.get(id)?.am ?? "—" : regionMap.get(id)?.en ?? "—",
            meters: count,
          }))
          .sort((a, b) => b.meters - a.meters)
          .slice(0, 6)
      );

      setRecentSignups((recentProfilesRes.data as RecentSignup[] | null) ?? []);
      setRecentOutages((recentOutagesRes.data as RecentOutage[] | null) ?? []);
      setFetching(false);
    })();
  }, [isAdmin, am]);

  const formatETB = (n: number) =>
    `${n.toLocaleString(undefined, { maximumFractionDigits: 0 })} ETB`;

  const timeAgo = (iso: string) => {
    const diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (diff < 60) return am ? "አሁን" : "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}${am ? " ደቂቃ" : "m"}`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}${am ? " ሰዓት" : "h"}`;
    return `${Math.floor(diff / 86400)}${am ? " ቀን" : "d"}`;
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  return (
    <DashboardLayout>
      {/* Hero header */}
      <div className="rounded-2xl bg-gradient-to-br from-primary via-primary to-accent p-6 sm:p-8 text-primary-foreground shadow-elegant">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <p className={cn("text-xs uppercase tracking-wider opacity-80", am && "font-ethiopic")}>
              {am ? "የአስተዳዳሪ ዳሽቦርድ" : "Admin Dashboard"}
            </p>
            <h1 className={cn("mt-1 text-3xl sm:text-4xl font-bold tracking-tight", am && "font-ethiopic")}>
              {am ? "የስርዓት አጠቃላይ እይታ" : "System Overview"}
            </h1>
            <p className={cn("mt-2 text-sm opacity-90 max-w-xl", am && "font-ethiopic")}>
              {am
                ? "በሁሉም ክልሎች ውስጥ ያለውን የኤሌክትሪክ አገልግሎት፣ ክፍያዎች እና ሥራዎች በቅጽበት ይከታተሉ።"
                : "Real-time view of customers, revenue, outages, and field operations across every region."}
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm bg-primary-foreground/15 backdrop-blur-sm rounded-full px-3 py-1.5 self-start">
            <span className="h-2 w-2 rounded-full bg-success animate-pulse-glow" />
            <span className={am ? "font-ethiopic" : ""}>{am ? "ቀጥታ" : "Live"}</span>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="mt-6 grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard icon={Users} tone="primary" label={am ? "ደንበኞች" : "Customers"} value={stats.customers.toLocaleString()} amharic={am} />
        <StatCard icon={Gauge} tone="secondary" label={am ? "ሜትሮች" : "Meters"} value={stats.meters.toLocaleString()} amharic={am} />
        <StatCard icon={Receipt} tone="success" label={am ? "ጠቅላላ ገቢ" : "Total Revenue"} value={formatETB(stats.revenue)} amharic={am} />
        <StatCard icon={Clock} tone="accent" label={am ? "ያልተከፈለ" : "Outstanding"} value={formatETB(stats.outstanding)} amharic={am} />
        <StatCard icon={AlertTriangle} tone="accent" label={am ? "ንቁ መቋረጦች" : "Active Outages"} value={String(stats.activeOutages)} amharic={am} />
        <StatCard icon={Wrench} tone="primary" label={am ? "ቴክኒሻኖች" : "Technicians"} value={String(stats.technicians)} amharic={am} />
      </div>

      {/* Charts row */}
      <div className="mt-6 grid lg:grid-cols-3 gap-5">
        {/* Revenue */}
        <div className="lg:col-span-2 rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <h3 className={cn("font-semibold", am && "font-ethiopic")}>
                {am ? "የ6 ወር ገቢ አዝማሚያ" : "Revenue Trend (6 months)"}
              </h3>
            </div>
            <span className="text-xs text-muted-foreground">ETB</span>
          </div>
          <div className="h-64">
            {fetching ? (
              <div className="h-full flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : revenueSeries.every((p) => p.revenue === 0) ? (
              <div className={cn("h-full flex items-center justify-center text-sm text-muted-foreground", am && "font-ethiopic")}>
                {am ? "ገና ምንም ክፍያ የለም" : "No payments recorded yet"}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueSeries}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                    formatter={(v: number) => [`${v.toLocaleString()} ETB`, am ? "ገቢ" : "Revenue"]}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#revGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Outage status donut */}
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="h-4 w-4 text-accent" />
            <h3 className={cn("font-semibold", am && "font-ethiopic")}>
              {am ? "የመቋረጥ ሁኔታ" : "Outage Status"}
            </h3>
          </div>
          <div className="h-64">
            {fetching ? (
              <div className="h-full flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : outageMix.length === 0 ? (
              <div className={cn("h-full flex items-center justify-center text-sm text-muted-foreground text-center px-4", am && "font-ethiopic")}>
                {am ? "ምንም መቋረጥ አልተመዘገበም" : "No outages recorded"}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={outageMix} dataKey="value" innerRadius={50} outerRadius={80} paddingAngle={2}>
                    {outageMix.map((entry) => (
                      <Cell key={entry.key} fill={STATUS_COLORS[entry.key] ?? "hsl(var(--muted))"} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
            {outageMix.map((s) => (
              <div key={s.key} className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ background: STATUS_COLORS[s.key] }} />
                <span className="capitalize text-muted-foreground">{s.name}</span>
                <span className="ml-auto font-medium">{s.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Region distribution + recent activity */}
      <div className="mt-5 grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-1 rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <MapPin className="h-4 w-4 text-secondary" />
            <h3 className={cn("font-semibold", am && "font-ethiopic")}>
              {am ? "ሜትሮች በክልል" : "Meters by Region"}
            </h3>
          </div>
          <div className="h-64">
            {fetching ? (
              <div className="h-full flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : regionBars.length === 0 ? (
              <div className={cn("h-full flex items-center justify-center text-sm text-muted-foreground text-center px-4", am && "font-ethiopic")}>
                {am ? "ሜትሮች ገና አልተመዘገቡም" : "No meters registered yet"}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={regionBars} layout="vertical" margin={{ left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                  <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} width={90} />
                  <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="meters" fill="hsl(var(--secondary))" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Recent signups */}
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              <h3 className={cn("font-semibold", am && "font-ethiopic")}>
                {am ? "አዲስ ደንበኞች" : "New Customers"}
              </h3>
            </div>
            <Link to="/admin/customers" className="text-xs text-primary hover:underline inline-flex items-center gap-1">
              {am ? "ሁሉም" : "View all"} <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {fetching ? (
            <div className="py-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : recentSignups.length === 0 ? (
            <p className={cn("text-sm text-muted-foreground text-center py-8", am && "font-ethiopic")}>
              {am ? "ምንም አዲስ ደንበኛ የለም" : "No customers yet"}
            </p>
          ) : (
            <ul className="space-y-3">
              {recentSignups.map((s) => (
                <li key={s.id} className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-primary-foreground text-xs font-semibold shrink-0">
                    {(s.full_name?.[0] ?? "?").toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={cn("text-sm font-medium truncate", am && "font-ethiopic")}>
                      {s.full_name || (am ? "ስም የለም" : "No name")}
                    </p>
                    <p className="text-xs text-muted-foreground font-mono truncate">{s.customer_number}</p>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">{timeAgo(s.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Recent outages */}
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-accent" />
              <h3 className={cn("font-semibold", am && "font-ethiopic")}>
                {am ? "የቅርብ ጊዜ መቋረጦች" : "Recent Outages"}
              </h3>
            </div>
          </div>
          {fetching ? (
            <div className="py-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : recentOutages.length === 0 ? (
            <p className={cn("text-sm text-muted-foreground text-center py-8", am && "font-ethiopic")}>
              {am ? "ምንም መቋረጥ አልተመዘገበም" : "No outages reported"}
            </p>
          ) : (
            <ul className="space-y-3">
              {recentOutages.map((o) => (
                <li key={o.id} className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{o.title}</p>
                    <div className="mt-1 flex items-center gap-2 text-xs">
                      <Badge variant="outline" className={cn("capitalize text-[10px] px-1.5 py-0", SEVERITY_TONE[o.severity])}>
                        {o.severity}
                      </Badge>
                      <span className="text-muted-foreground capitalize">{o.status.replace("_", " ")}</span>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">{timeAgo(o.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default AdminDashboard;