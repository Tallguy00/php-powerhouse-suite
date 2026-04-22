import { useEffect, useState } from "react";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Receipt, CreditCard, Loader2, Calendar, Zap, CheckCircle2, AlertCircle } from "lucide-react";
import { z } from "zod";
import { Link } from "react-router-dom";

type BillStatus = "unpaid" | "paid" | "overdue" | "cancelled";

interface Bill {
  id: string;
  meter_id: string;
  amount_etb: number;
  kwh_consumed: number;
  period_start: string;
  period_end: string;
  due_date: string;
  status: BillStatus;
  created_at: string;
}

interface Meter { id: string; meter_number: string }
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

const CustomerBills = () => {
  const { user } = useAuth();
  const { lang } = useLang();
  const { toast } = useToast();
  const am = lang === "am";

  const [bills, setBills] = useState<Bill[]>([]);
  const [meters, setMeters] = useState<Meter[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | BillStatus>("all");

  const [payOpen, setPayOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [activeBill, setActiveBill] = useState<Bill | null>(null);
  const [payForm, setPayForm] = useState({ method: "telebirr" as const, reference: "" });

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const [{ data: bs }, { data: ms }, { data: ps }] = await Promise.all([
      supabase.from("bills").select("*").eq("customer_id", user.id).order("created_at", { ascending: false }),
      supabase.from("meters").select("id,meter_number").eq("customer_id", user.id),
      supabase.from("payments").select("*").eq("customer_id", user.id).order("paid_at", { ascending: false }),
    ]);
    setBills((bs ?? []) as Bill[]);
    setMeters((ms ?? []) as Meter[]);
    setPayments((ps ?? []) as Payment[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const meterNum = (id: string) => meters.find((m) => m.id === id)?.meter_number ?? "—";
  const fmtDate = (d: string) => new Date(d).toLocaleDateString(am ? "am-ET" : "en-US", { dateStyle: "medium" });
  const etb = (n: number) => `${Number(n).toLocaleString()} ETB`;

  const today = new Date().toISOString().slice(0, 10);
  const enriched = bills.map((b) => ({
    ...b,
    effectiveStatus: (b.status === "unpaid" && b.due_date < today ? "overdue" : b.status) as BillStatus,
  }));

  const visible = enriched.filter((b) => filter === "all" || b.effectiveStatus === filter);

  const totals = {
    outstanding: enriched.filter((b) => b.effectiveStatus === "unpaid" || b.effectiveStatus === "overdue").reduce((s, b) => s + Number(b.amount_etb), 0),
    overdue: enriched.filter((b) => b.effectiveStatus === "overdue").reduce((s, b) => s + Number(b.amount_etb), 0),
    paidYTD: payments.filter((p) => new Date(p.paid_at).getFullYear() === new Date().getFullYear()).reduce((s, p) => s + Number(p.amount_etb), 0),
  };

  const counts = {
    all: enriched.length,
    unpaid: enriched.filter((b) => b.effectiveStatus === "unpaid").length,
    overdue: enriched.filter((b) => b.effectiveStatus === "overdue").length,
    paid: enriched.filter((b) => b.effectiveStatus === "paid").length,
  };

  const openPay = (bill: Bill) => {
    setActiveBill(bill);
    setPayForm({ method: "telebirr", reference: "" });
    setPayOpen(true);
  };

  const submitPayment = async () => {
    if (!user || !activeBill) return;
    const parsed = paySchema.safeParse({ method: payForm.method, reference: payForm.reference || undefined });
    if (!parsed.success) {
      toast({ title: am ? "ስህተት" : "Validation error", description: parsed.error.errors[0]?.message, variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const { error: payErr } = await supabase.from("payments").insert({
      bill_id: activeBill.id,
      customer_id: user.id,
      amount_etb: activeBill.amount_etb,
      method: parsed.data.method,
      reference: parsed.data.reference ?? null,
    });
    if (payErr) {
      setSubmitting(false);
      toast({ title: am ? "ክፍያ አልተሳካም" : "Payment failed", description: payErr.message, variant: "destructive" });
      return;
    }
    // Customers can't UPDATE bills (admin-only). Show as paid via payments join on next load.
    setSubmitting(false);
    toast({ title: am ? "ክፍያ ተመዝግቧል" : "Payment recorded", description: am ? "ቡድናችን በቅርቡ ያረጋግጣል።" : "Our team will confirm shortly." });
    setPayOpen(false);
    load();
  };

  const isPaidByPayments = (billId: string) => payments.some((p) => p.bill_id === billId);

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className={`text-2xl md:text-3xl font-bold ${am ? "font-ethiopic" : ""}`}>
            {am ? "የእኔ ክፍያዎች" : "My Bills"}
          </h1>
          <p className={`text-sm text-muted-foreground mt-1 ${am ? "font-ethiopic" : ""}`}>
            {am ? "ክፍያዎችዎን ይመልከቱ፣ ዝርዝር ይከታተሉ፣ እና በመስመር ላይ ይክፈሉ።" : "Review your bills, track usage, and pay online."}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className={`text-sm text-muted-foreground ${am ? "font-ethiopic" : ""}`}>{am ? "ያልተከፈለ" : "Outstanding"}</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold">{etb(totals.outstanding)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className={`text-sm text-muted-foreground ${am ? "font-ethiopic" : ""}`}>{am ? "ጊዜው ያለፈ" : "Overdue"}</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold text-destructive">{etb(totals.overdue)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className={`text-sm text-muted-foreground ${am ? "font-ethiopic" : ""}`}>{am ? "በዚህ ዓመት የተከፈለ" : "Paid This Year"}</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">{etb(totals.paidYTD)}</div></CardContent>
        </Card>
      </div>

      {/* Filter tabs */}
      <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)} className="mt-8">
        <TabsList className="grid grid-cols-4 w-full sm:w-auto">
          <TabsTrigger value="all">{am ? "ሁሉም" : "All"} ({counts.all})</TabsTrigger>
          <TabsTrigger value="unpaid">{am ? "ያልተከፈለ" : "Unpaid"} ({counts.unpaid})</TabsTrigger>
          <TabsTrigger value="overdue">{am ? "ዘግይቷል" : "Overdue"} ({counts.overdue})</TabsTrigger>
          <TabsTrigger value="paid">{am ? "የተከፈለ" : "Paid"} ({counts.paid})</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Bills list */}
      <section className="mt-6">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> {am ? "በመጫን ላይ..." : "Loading..."}
          </div>
        ) : visible.length === 0 ? (
          <Card><CardContent className="py-10 text-center text-muted-foreground">
            <Receipt className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className={am ? "font-ethiopic" : ""}>{am ? "ምንም ክፍያ የለም።" : "No bills found."}</p>
          </CardContent></Card>
        ) : (
          <div className="grid gap-3">
            {visible.map((b) => {
              const paid = b.effectiveStatus === "paid" || isPaidByPayments(b.id);
              return (
                <Card key={b.id} className="hover:border-primary/40 transition-colors">
                  <CardContent className="p-4 flex flex-col md:flex-row md:items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link to={`/dashboard/bills/${b.id}`} className="font-semibold hover:underline">
                          #{b.id.slice(0, 8).toUpperCase()}
                        </Link>
                        <Badge className={statusTone[paid ? "paid" : b.effectiveStatus]}>
                          {paid ? (am ? "የተከፈለ" : "paid") : b.effectiveStatus}
                        </Badge>
                        <span className="text-xs text-muted-foreground font-mono">{am ? "ሜትር" : "Meter"}: {meterNum(b.meter_id)}</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-2 flex flex-wrap gap-3">
                        <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" />{fmtDate(b.period_start)} → {fmtDate(b.period_end)}</span>
                        <span className="inline-flex items-center gap-1"><Zap className="h-3 w-3" />{Number(b.kwh_consumed).toLocaleString()} kWh</span>
                        <span className={`inline-flex items-center gap-1 ${b.effectiveStatus === "overdue" ? "text-destructive" : ""}`}>
                          {b.effectiveStatus === "overdue" ? <AlertCircle className="h-3 w-3" /> : <Calendar className="h-3 w-3" />}
                          {am ? "የመጨረሻ ቀን" : "Due"}: {fmtDate(b.due_date)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between md:justify-end gap-4 md:gap-6">
                      <div className="text-right">
                        <div className="text-2xl font-bold">{etb(b.amount_etb)}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Link to={`/dashboard/bills/${b.id}`}>
                          <Button variant="outline" size="sm">{am ? "ዝርዝር" : "Details"}</Button>
                        </Link>
                        {paid ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-sm font-medium">
                          <CheckCircle2 className="h-4 w-4" /> {am ? "ተከፍሏል" : "Paid"}
                        </span>
                        ) : b.effectiveStatus === "cancelled" ? null : (
                        <Button onClick={() => openPay(b)} className="gap-2">
                          <CreditCard className="h-4 w-4" />
                          {am ? "ክፈል" : "Pay"}
                        </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* Recent payments */}
      {payments.length > 0 && (
        <section className="mt-10">
          <h2 className={`text-lg font-semibold mb-3 ${am ? "font-ethiopic" : ""}`}>
            {am ? "የቅርብ ጊዜ ክፍያዎች" : "Recent Payments"}
          </h2>
          <div className="grid gap-2">
            {payments.slice(0, 5).map((p) => (
              <div key={p.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-card">
                <div className="min-w-0">
                  <div className="font-medium">{etb(p.amount_etb)} <span className="text-xs text-muted-foreground uppercase ml-2">{p.method}</span></div>
                  <div className="text-xs text-muted-foreground">{fmtDate(p.paid_at)}{p.reference ? ` · ${p.reference}` : ""}</div>
                </div>
                <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Payment dialog */}
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className={am ? "font-ethiopic" : ""}>{am ? "ክፍያ ይክፈሉ" : "Pay Bill"}</DialogTitle>
          </DialogHeader>
          {activeBill && (
            <div className="grid gap-4 py-2">
              <div className="rounded-lg bg-muted p-4">
                <div className="text-xs text-muted-foreground">{am ? "የሚከፈል መጠን" : "Amount Due"}</div>
                <div className="text-3xl font-bold mt-1">{etb(activeBill.amount_etb)}</div>
                <div className="text-xs text-muted-foreground mt-2">
                  {am ? "ሜትር" : "Meter"} {meterNum(activeBill.meter_id)} · {Number(activeBill.kwh_consumed).toLocaleString()} kWh
                </div>
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
                <Label htmlFor="ref" className={am ? "font-ethiopic" : ""}>{am ? "የግብይት ቁጥር (አማራጭ)" : "Transaction Reference (optional)"}</Label>
                <Input id="ref" maxLength={100} value={payForm.reference}
                  onChange={(e) => setPayForm({ ...payForm, reference: e.target.value })}
                  placeholder={am ? "ለምሳሌ: TB123456789" : "e.g. TB123456789"} />
              </div>
            </div>
          )}
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

export default CustomerBills;
