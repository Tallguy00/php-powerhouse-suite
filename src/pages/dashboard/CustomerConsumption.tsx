import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { StatCard } from "@/components/dashboard/StatCard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLang } from "@/i18n/LanguageContext";
import { Activity, TrendingUp, Zap, Calendar, Loader2 } from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from "recharts";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface BillRow {
  id: string;
  meter_id: string;
  kwh_consumed: number;
  amount_etb: number;
  period_start: string;
  period_end: string;
}
interface MeterRow {
  id: string;
  meter_number: string;
  customer_type: string;
}

const CustomerConsumption = () => {
  const { user } = useAuth();
  const { lang } = useLang();
  const [bills, setBills] = useState<BillRow[]>([]);
  const [meters, setMeters] = useState<MeterRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [meterFilter, setMeterFilter] = useState<string>("all");

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const [{ data: b }, { data: m }] = await Promise.all([
        supabase.from("bills").select("id,meter_id,kwh_consumed,amount_etb,period_start,period_end")
          .eq("customer_id", user.id).order("period_start", { ascending: true }),
        supabase.from("meters").select("id,meter_number,customer_type").eq("customer_id", user.id),
      ]);
      setBills((b ?? []) as BillRow[]);
      setMeters((m ?? []) as MeterRow[]);
      setLoading(false);
    })();
  }, [user]);

  const filtered = useMemo(
    () => meterFilter === "all" ? bills : bills.filter((b) => b.meter_id === meterFilter),
    [bills, meterFilter]
  );

  const monthly = useMemo(() => {
    const map = new Map<string, { label: string; kwh: number; etb: number }>();
    for (const b of filtered) {
      const d = new Date(b.period_start);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString(lang === "am" ? "am-ET" : "en-US", { month: "short", year: "2-digit" });
      const cur = map.get(key) ?? { label, kwh: 0, etb: 0 };
      cur.kwh += Number(b.kwh_consumed);
      cur.etb += Number(b.amount_etb);
      map.set(key, cur);
    }
    return Array.from(map.entries()).sort(([a], [z]) => a.localeCompare(z)).map(([, v]) => v);
  }, [filtered, lang]);

  const totals = useMemo(() => {
    const totalKwh = filtered.reduce((s, b) => s + Number(b.kwh_consumed), 0);
    const totalEtb = filtered.reduce((s, b) => s + Number(b.amount_etb), 0);
    const now = new Date();
    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisMonth = filtered.filter((b) => new Date(b.period_start) >= startMonth)
      .reduce((s, b) => s + Number(b.kwh_consumed), 0);
    const avg = monthly.length ? totalKwh / monthly.length : 0;
    const last = monthly.at(-1)?.kwh ?? 0;
    const prev = monthly.at(-2)?.kwh ?? 0;
    const trend = prev > 0 ? ((last - prev) / prev) * 100 : 0;
    return { totalKwh, totalEtb, thisMonth, avg, trend };
  }, [filtered, monthly]);

  const am = lang === "am";
  const fontEth = am ? "font-ethiopic" : "";

  return (
    <DashboardLayout>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className={`text-3xl font-bold tracking-tight ${fontEth}`}>
            {am ? "የፍጆታ ትንታኔ" : "Consumption Analytics"}
          </h1>
          <p className={`text-sm text-muted-foreground mt-1 ${fontEth}`}>
            {am ? "የኤሌክትሪክ አጠቃቀምዎን በወር ይከታተሉ።" : "Track your electricity usage trends over time."}
          </p>
        </div>
        {meters.length > 1 && (
          <Tabs value={meterFilter} onValueChange={setMeterFilter}>
            <TabsList>
              <TabsTrigger value="all">{am ? "ሁሉም" : "All meters"}</TabsTrigger>
              {meters.map((m) => (
                <TabsTrigger key={m.id} value={m.id} className="font-mono text-xs">{m.meter_number}</TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        )}
      </div>

      <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard icon={Zap} tone="primary" label={am ? "የዚህ ወር ፍጆታ" : "This Month"}
          value={`${totals.thisMonth.toLocaleString()} kWh`} amharic={am} />
        <StatCard icon={Activity} tone="accent" label={am ? "ጠቅላላ ፍጆታ" : "Total Usage"}
          value={`${totals.totalKwh.toLocaleString()} kWh`} amharic={am} />
        <StatCard icon={Calendar} tone="secondary" label={am ? "ወርሃዊ አማካይ" : "Monthly Avg"}
          value={`${totals.avg.toFixed(0)} kWh`} amharic={am} />
        <StatCard icon={TrendingUp} tone="success" label={am ? "የለውጥ አዝማሚያ" : "Trend vs prev"}
          value={`${totals.trend > 0 ? "+" : ""}${totals.trend.toFixed(1)}%`} amharic={am} />
      </div>

      {loading ? (
        <div className="mt-10 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : monthly.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-border bg-card p-12 text-center text-muted-foreground">
          <Activity className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className={fontEth}>{am ? "ገና የፍጆታ መረጃ የለም።" : "No consumption data yet."}</p>
        </div>
      ) : (
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
            <h3 className={`text-lg font-semibold mb-4 ${fontEth}`}>
              {am ? "ወርሃዊ ፍጆታ (kWh)" : "Monthly Consumption (kWh)"}
            </h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12 }} />
                <Bar dataKey="kwh" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
            <h3 className={`text-lg font-semibold mb-4 ${fontEth}`}>
              {am ? "ወርሃዊ ወጪ (ETB)" : "Monthly Cost (ETB)"}
            </h3>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12 }} />
                <Line type="monotone" dataKey="etb" stroke="hsl(var(--accent))" strokeWidth={3} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

export default CustomerConsumption;