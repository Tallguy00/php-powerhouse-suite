import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLang } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Calendar, Zap, CreditCard, Loader2, CheckCircle2, AlertCircle,
  Gauge, Receipt, Building2, MapPin,
} from "lucide-react";
import { z } from "zod";

type BillStatus = "unpaid" | "paid" | "overdue" | "cancelled";
type CustomerType = "residential" | "commercial" | "industrial";

interface Bill {
  id: string; meter_id: string; customer_id: string;
  amount_etb: number; kwh_consumed: number;
  period_start: string; period_end: string; due_date: string;
  status: BillStatus; created_at: string;
}
interface Meter {
  id: string; meter_number: string; customer_type: CustomerType;
  installed_at: string; status: string; region_id: string | null;
}
interface Tariff { id: string; name: string; price_per_kwh: number; customer_type: CustomerType; active: boolean }
interface Region { id: string; name_en: string; name_am: string }
interface Payment { id: string; bill_id: string; amount_etb: number; method: string; reference: string | null; paid_at: string }

const paySchema = z.object({
  method: z.enum(["telebirr", "cbe", "awash", "dashen", "cash"]),
  reference: z.string().trim().max(100).optional(),
});

const statusTone: Record<BillStatus, string> = {
  unpaid: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  paid: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  overdue: "bg-destructive/15 text-destructive",
  cancelled: "bg-muted text-muted-foreground",
};

const CustomerBillDetail = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const { lang } = useLang();
  const { toast } = useToast();
  const navigate = useNavigate();
  const am = lang === "am";

  const [loading, setLoading] = useState(true);
  const [bill, setBill] = useState<Bill | null>(null);
  const [meter, setMeter] = useState<Meter | null>(null);
  const [tariff, setTariff] = useState<Tariff | null>(null);
  const [region, setRegion] = useState<Region | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);

  const [payOpen, setPayOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [payForm, setPayForm] = useState({ method: "telebirr" as const, reference: "" });

  const load = async () => {
    if (!user || !id) return;
    setLoading(true);
    const { data: b } = await supabase.from("bills").select("*").eq("id", id).maybeSingle();
    if (!b) { setBill(null); setLoading(false); return; }
    setBill(b as Bill);

    const [{ data: m }, { data: ps }] = await Promise.all([
      supabase.from("meters").select("*").eq("id", b.meter_id).maybeSingle(),
      supabase.from("payments").select("*").eq("bill_id", b.id).order("paid_at", { ascending: false }),
    ]);
    setMeter((m as Meter) ?? null);
    setPayments((ps ?? []) as Payment[]);

    if (m) {
      const [{ data: t }, { data: r }] = await Promise.all([
        supabase.from("tariffs").select("*").eq("customer_type", m.customer_type).eq("active", true).order("created_at", { ascending: false }).limit(1).maybeSingle(),
        m.region_id
          ? supabase.from("regions").select("id,name_en,name_am").eq("id", m.region_id).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      setTariff((t as Tariff) ?? null);
      setRegion((r as Region) ?? null);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [user, id]);

  const fmtDate = (d: string) => new Date(d).toLocaleDateString(am ? "am-ET" : "en-US", { dateStyle: "medium" });
  const fmtDT = (d: string) => new Date(d).toLocaleString(am ? "am-ET" : "en-US", { dateStyle: "medium", timeStyle: "short" });
  const etb = (n: number) => `${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB`;

  const today = new Date().toISOString().slice(0, 10);
  const totalPaid = payments.reduce((s, p) => s + Number(p.amount_etb), 0);
  const isPaid = bill ? (bill.status === "paid" || totalPaid >= Number(bill.amount_etb)) : false;
  const effective: BillStatus | null = bill
    ? (isPaid ? "paid" : bill.status === "unpaid" && bill.due_date < today ? "overdue" : bill.status)
    : null;
  const balance = bill ? Math.max(0, Number(bill.amount_etb) - totalPaid) : 0;
  const periodDays = bill
    ? Math.max(1, Math.round((+new Date(bill.period_end) - +new Date(bill.period_start)) / 86400000) + 1)
    : 0;
  const avgPerDay = bill && periodDays ? Number(bill.kwh_consumed) / periodDays : 0;
  const effectiveRate = bill && Number(bill.kwh_consumed) > 0
    ? Number(bill.amount_etb) / Number(bill.kwh_consumed)
    : tariff?.price_per_kwh ?? 0;

  const submitPayment = async () => {
    if (!user || !bill) return;
    const parsed = paySchema.safeParse({ method: payForm.method, reference: payForm.reference || undefined });
    if (!parsed.success) {
      toast({ title: am ? "ስህተት" : "Validation error", description: parsed.error.errors[0]?.message, variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("payments").insert({
      bill_id: bill.id,
      customer_id: user.id,
      amount_etb: balance > 0 ? balance : bill.amount_etb,
      method: parsed.data.method,
      reference: parsed.data.reference ?? null,
    });
    setSubmitting(false);
    if (error) {
      toast({ title: am ? "ክፍያ አልተሳካም" : "Payment failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: am ? "ክፍያ ተመዝግቧል" : "Payment recorded" });
    setPayOpen(false);
    setPayForm({ method: "telebirr", reference: "" });
    load();
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> {am ? "በመጫን ላይ..." : "Loading..."}
        </div>
      </DashboardLayout>
    );
  }

  if (!bill) {
    return (
      <DashboardLayout>
        <Card><CardContent className="py-10 text-center text-muted-foreground">
          <Receipt className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className={am ? "font-ethiopic" : ""}>{am ? "ክፍያ አልተገኘም።" : "Bill not found."}</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate("/dashboard/bills")}>
            <ArrowLeft className="h-4 w-4 mr-2" /> {am ? "ወደ ክፍያዎች" : "Back to Bills"}
          </Button>
        </CardContent></Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="flex flex-col gap-3">
        <Link to="/dashboard/bills" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground w-fit">
          <ArrowLeft className="h-4 w-4 mr-1" /> {am ? "ወደ ክፍያዎች" : "Back to bills"}
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl md:text-3xl font-bold">
                {am ? "ክፍያ" : "Bill"} #{bill.id.slice(0, 8).toUpperCase()}
              </h1>
              {effective && <Badge className={statusTone[effective]}>{effective}</Badge>}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {fmtDate(bill.period_start)} → {fmtDate(bill.period_end)} · {periodDays} {am ? "ቀናት" : "days"}
            </p>
          </div>
          {!isPaid && effective !== "cancelled" && (
            <Button onClick={() => setPayOpen(true)} className="gap-2">
              <CreditCard className="h-4 w-4" />
              {am ? "ክፈል" : "Pay"} {etb(balance)}
            </Button>
          )}
        </div>
      </div>

      {/* Amount summary */}
      <div className="mt-6 rounded-3xl bg-flag-gradient p-6 md:p-8 text-primary-foreground shadow-elegant relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_15%,hsl(0_0%_100%/0.18),transparent_55%)]" />
        <div className="relative grid sm:grid-cols-3 gap-6">
          <div>
            <p className="text-xs uppercase tracking-wide opacity-80">{am ? "ጠቅላላ መጠን" : "Total Amount"}</p>
            <p className="mt-1 text-3xl md:text-4xl font-extrabold">{etb(bill.amount_etb)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide opacity-80">{am ? "የተከፈለ" : "Paid"}</p>
            <p className="mt-1 text-3xl md:text-4xl font-extrabold">{etb(totalPaid)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide opacity-80">{am ? "ቀሪ" : "Balance"}</p>
            <p className="mt-1 text-3xl md:text-4xl font-extrabold">{etb(balance)}</p>
          </div>
        </div>
      </div>

      {/* Detail grid */}
      <div className="mt-6 grid lg:grid-cols-3 gap-5">
        {/* Meter info */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><Gauge className="h-4 w-4" /> {am ? "ሜትር መረጃ" : "Meter Info"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row label={am ? "የሜትር ቁጥር" : "Meter number"} value={meter?.meter_number ?? "—"} mono />
            <Row label={am ? "የደንበኛ ዓይነት" : "Customer type"} value={meter ? capitalize(meter.customer_type) : "—"} />
            <Row label={am ? "ሁኔታ" : "Status"} value={meter?.status ?? "—"} />
            <Row label={am ? "የተጫነበት" : "Installed"} value={meter ? fmtDate(meter.installed_at) : "—"} />
            <Row icon={<MapPin className="h-3 w-3" />} label={am ? "ክልል" : "Region"} value={region ? (am ? region.name_am : region.name_en) : "—"} />
          </CardContent>
        </Card>

        {/* kWh breakdown */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><Zap className="h-4 w-4" /> {am ? "የፍጆታ ዝርዝር" : "Consumption"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row label={am ? "ጠቅላላ ፍጆታ" : "Total used"} value={`${Number(bill.kwh_consumed).toLocaleString()} kWh`} strong />
            <Row label={am ? "የክፍያ ጊዜ" : "Period"} value={`${periodDays} ${am ? "ቀናት" : "days"}`} />
            <Row label={am ? "በቀን አማካይ" : "Daily average"} value={`${avgPerDay.toFixed(2)} kWh`} />
            <Separator />
            <Row label={am ? "ከ" : "From"} value={fmtDate(bill.period_start)} />
            <Row label={am ? "እስከ" : "To"} value={fmtDate(bill.period_end)} />
          </CardContent>
        </Card>

        {/* Tariff & due */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><Building2 className="h-4 w-4" /> {am ? "ታሪፍ እና የመጨረሻ ቀን" : "Tariff & Due"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row label={am ? "የታሪፍ ስም" : "Tariff plan"} value={tariff?.name ?? (am ? "—" : "—")} />
            <Row label={am ? "የተከፈለ ዋጋ/kWh" : "Billed rate / kWh"} value={`${effectiveRate.toFixed(4)} ETB`} strong />
            {tariff && Math.abs(effectiveRate - Number(tariff.price_per_kwh)) > 0.0001 && (
              <Row label={am ? "የአሁን ታሪፍ" : "Current tariff"} value={`${Number(tariff.price_per_kwh).toFixed(4)} ETB`} muted />
            )}
            <Separator />
            <Row label={am ? "የተወጣ" : "Issued"} value={fmtDate(bill.created_at)} />
            <Row
              icon={effective === "overdue" ? <AlertCircle className="h-3 w-3 text-destructive" /> : <Calendar className="h-3 w-3" />}
              label={am ? "የመጨረሻ ቀን" : "Due date"}
              value={fmtDate(bill.due_date)}
              strong
              className={effective === "overdue" ? "text-destructive" : ""}
            />
          </CardContent>
        </Card>
      </div>

      {/* Payment history */}
      <section className="mt-8">
        <h2 className={`text-lg font-semibold mb-3 ${am ? "font-ethiopic" : ""}`}>
          {am ? "የክፍያ ታሪክ" : "Payment History"}
        </h2>
        {payments.length === 0 ? (
          <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">
            <p className={am ? "font-ethiopic" : ""}>{am ? "ለዚህ ክፍያ ምንም ክፍያ አልተመዘገበም።" : "No payments recorded for this bill yet."}</p>
          </CardContent></Card>
        ) : (
          <div className="grid gap-2">
            {payments.map((p) => (
              <Card key={p.id}>
                <CardContent className="p-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-9 w-9 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium">{etb(p.amount_etb)} <span className="text-xs uppercase ml-2 text-muted-foreground">{p.method}</span></div>
                      <div className="text-xs text-muted-foreground">{fmtDT(p.paid_at)}{p.reference ? ` · ${am ? "ማጣቀሻ" : "ref"} ${p.reference}` : ""}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Pay dialog */}
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className={am ? "font-ethiopic" : ""}>{am ? "ክፍያ ይክፈሉ" : "Pay Bill"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="rounded-lg bg-muted p-4">
              <div className="text-xs text-muted-foreground">{am ? "የሚከፈል መጠን" : "Amount Due"}</div>
              <div className="text-3xl font-bold mt-1">{etb(balance)}</div>
            </div>
            <div className="grid gap-2">
              <Label className={am ? "font-ethiopic" : ""}>{am ? "የክፍያ ዘዴ" : "Payment Method"}</Label>
              <Select value={payForm.method} onValueChange={(v: typeof payForm.method) => setPayForm({ ...payForm, method: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="telebirr">Telebirr</SelectItem>
                  <SelectItem value="cbe">CBE Birr</SelectItem>
                  <SelectItem value="awash">Awash Bank</SelectItem>
                  <SelectItem value="dashen">Dashen Bank</SelectItem>
                  <SelectItem value="cash">{am ? "ጥሬ ገንዘብ" : "Cash"}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ref" className={am ? "font-ethiopic" : ""}>{am ? "የግብይት ቁጥር (አማራጭ)" : "Reference (optional)"}</Label>
              <Input id="ref" maxLength={100} value={payForm.reference}
                onChange={(e) => setPayForm({ ...payForm, reference: e.target.value })}
                placeholder="e.g. TB123456789" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayOpen(false)} disabled={submitting}>
              {am ? "ሰርዝ" : "Cancel"}
            </Button>
            <Button onClick={submitPayment} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {am ? "ክፍያ አረጋግጥ" : "Confirm Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

const Row = ({ label, value, icon, mono, strong, muted, className }: {
  label: string; value: string; icon?: React.ReactNode;
  mono?: boolean; strong?: boolean; muted?: boolean; className?: string;
}) => (
  <div className={`flex items-center justify-between gap-3 ${className ?? ""}`}>
    <span className="text-muted-foreground inline-flex items-center gap-1">{icon}{label}</span>
    <span className={`${mono ? "font-mono" : ""} ${strong ? "font-semibold" : ""} ${muted ? "text-muted-foreground" : ""} text-right`}>{value}</span>
  </div>
);

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export default CustomerBillDetail;
