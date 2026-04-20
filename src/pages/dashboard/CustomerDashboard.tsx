import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { StatCard } from "@/components/dashboard/StatCard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLang } from "@/i18n/LanguageContext";
import { Receipt, Activity, CreditCard, AlertTriangle, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const CustomerDashboard = () => {
  const { user } = useAuth();
  const { t, lang } = useLang();
  const [profile, setProfile] = useState<any>(null);
  const [stats, setStats] = useState({ outstanding: 0, kwh: 0, lastPayment: "—", outages: 0 });

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: prof }, { data: bills }, { data: payments }, { data: outages }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
        supabase.from("bills").select("amount_etb,status,kwh_consumed,period_start").eq("customer_id", user.id),
        supabase.from("payments").select("amount_etb,paid_at").eq("customer_id", user.id).order("paid_at", { ascending: false }).limit(1),
        supabase.from("outages").select("id,status").in("status", ["reported", "investigating", "in_progress"]),
      ]);
      setProfile(prof);
      const outstanding = (bills ?? []).filter((b: any) => b.status !== "paid").reduce((s: number, b: any) => s + Number(b.amount_etb), 0);
      const thisMonth = new Date(); thisMonth.setDate(1);
      const kwh = (bills ?? []).filter((b: any) => new Date(b.period_start) >= thisMonth).reduce((s: number, b: any) => s + Number(b.kwh_consumed), 0);
      const last = payments?.[0];
      setStats({
        outstanding,
        kwh,
        lastPayment: last ? `${Number(last.amount_etb).toLocaleString()} ETB` : "—",
        outages: outages?.length ?? 0,
      });
    })();
  }, [user]);

  const greet = lang === "am" ? "እንኳን ደህና መጡ" : "Welcome back";

  return (
    <DashboardLayout>
      {/* Hero */}
      <div className="rounded-3xl bg-flag-gradient p-8 md:p-10 text-primary-foreground shadow-elegant overflow-hidden relative">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,hsl(0_0%_100%/0.18),transparent_50%)]" />
        <div className="relative">
          <p className={`text-sm opacity-90 ${lang === "am" ? "font-ethiopic" : ""}`}>{greet},</p>
          <h1 className="mt-1 text-3xl md:text-4xl font-extrabold">
            {profile?.full_name || user?.email}
          </h1>
          <p className="mt-2 text-sm opacity-80">
            {lang === "am" ? "የደንበኛ ቁጥር" : "Customer No."}: <span className="font-mono font-semibold">{profile?.customer_number ?? "—"}</span>
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/dashboard/bills">
              <Button className="bg-background text-primary hover:bg-background/90 font-semibold">
                <CreditCard className="h-4 w-4 mr-2" />
                <span className={lang === "am" ? "font-ethiopic" : ""}>{t("dash_pay_bill")}</span>
              </Button>
            </Link>
            <Link to="/dashboard/outages">
              <Button variant="outline" className="bg-background/10 border-primary-foreground/30 text-primary-foreground hover:bg-background/20">
                <AlertTriangle className="h-4 w-4 mr-2" />
                <span className={lang === "am" ? "font-ethiopic" : ""}>{t("dash_report_outage")}</span>
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard icon={Receipt} tone="accent" label={t("dash_outstanding")} value={`${stats.outstanding.toLocaleString()} ETB`} amharic={lang === "am"} />
        <StatCard icon={Activity} tone="primary" label={t("dash_this_month")} value={`${stats.kwh.toLocaleString()} kWh`} amharic={lang === "am"} />
        <StatCard icon={CreditCard} tone="success" label={t("dash_last_payment")} value={stats.lastPayment} amharic={lang === "am"} />
        <StatCard icon={Zap} tone="secondary" label={t("dash_active_outages")} value={String(stats.outages)} amharic={lang === "am"} />
      </div>

      <div className="mt-10 rounded-2xl border border-border bg-card p-8 text-center text-muted-foreground">
        <p className={lang === "am" ? "font-ethiopic" : ""}>
          {lang === "am" ? "ተጨማሪ ባህሪያት በቅርቡ ይመጣሉ — ክፍያ፣ ፍጆታ ግራፍ፣ የመቋረጥ ካርታ።" : "More features coming soon — payments, consumption charts, outage map."}
        </p>
      </div>
    </DashboardLayout>
  );
};

export default CustomerDashboard;