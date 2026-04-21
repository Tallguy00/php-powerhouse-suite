import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { useAuth } from "@/hooks/useAuth";
import { useLang } from "@/i18n/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import { Loader2, Plus, Receipt, CheckCircle2, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type BillStatus = "unpaid" | "paid" | "overdue" | "cancelled";
type CustomerType = "residential" | "commercial" | "industrial";

type Bill = {
  id: string;
  meter_id: string;
  customer_id: string;
  period_start: string;
  period_end: string;
  kwh_consumed: number;
  amount_etb: number;
  status: BillStatus;
  due_date: string;
  created_at: string;
};

type Meter = {
  id: string;
  meter_number: string;
  customer_id: string;
  customer_type: CustomerType;
};

type Tariff = {
  id: string;
  name: string;
  customer_type: CustomerType;
  price_per_kwh: number;
  active: boolean;
};

type Profile = { id: string; full_name: string | null; customer_number: string | null };

const STATUS_META: Record<BillStatus, { en: string; am: string; tone: string }> = {
  unpaid: { en: "Unpaid", am: "ያልተከፈለ", tone: "bg-amber-500/10 text-amber-600 border-amber-500/30" },
  paid: { en: "Paid", am: "ተከፍሏል", tone: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" },
  overdue: { en: "Overdue", am: "ጊዜው ያለፈበት", tone: "bg-red-500/10 text-red-600 border-red-500/30" },
  cancelled: { en: "Cancelled", am: "ተሰርዟል", tone: "bg-muted text-muted-foreground border-border" },
};

const ALL_STATUSES: BillStatus[] = ["unpaid", "paid", "overdue", "cancelled"];

const fmtETB = (n: number) =>
  new Intl.NumberFormat("en-ET", { style: "currency", currency: "ETB", maximumFractionDigits: 2 }).format(n);

const todayPlus = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};
const monthStart = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
};
const monthEnd = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10);
};

const AdminBills = () => {
  const { roles, loading } = useAuth();
  const { lang } = useLang();
  const am = lang === "am";
  const isAdmin = roles.includes("admin");

  const [fetching, setFetching] = useState(true);
  const [bills, setBills] = useState<Bill[]>([]);
  const [meters, setMeters] = useState<Meter[]>([]);
  const [tariffs, setTariffs] = useState<Tariff[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [statusFilter, setStatusFilter] = useState<BillStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);

  // Generate dialog state
  const [genOpen, setGenOpen] = useState(false);
  const [genMeterId, setGenMeterId] = useState<string>("");
  const [genTariffId, setGenTariffId] = useState<string>("");
  const [genKwh, setGenKwh] = useState<string>("");
  const [genStart, setGenStart] = useState<string>(monthStart());
  const [genEnd, setGenEnd] = useState<string>(monthEnd());
  const [genDue, setGenDue] = useState<string>(todayPlus(15));
  const [generating, setGenerating] = useState(false);

  const loadAll = async () => {
    setFetching(true);
    const [b, m, t, p] = await Promise.all([
      supabase.from("bills").select("*").order("created_at", { ascending: false }),
      supabase.from("meters").select("id, meter_number, customer_id, customer_type"),
      supabase.from("tariffs").select("id, name, customer_type, price_per_kwh, active").eq("active", true),
      supabase.from("profiles").select("id, full_name, customer_number"),
    ]);
    if (b.error || m.error || t.error || p.error) {
      toast.error(am ? "ሂሳቦችን መጫን አልተቻለም" : "Failed to load bills");
      setFetching(false);
      return;
    }
    setBills((b.data ?? []) as Bill[]);
    setMeters((m.data ?? []) as Meter[]);
    setTariffs((t.data ?? []) as Tariff[]);
    setProfiles((p.data ?? []) as Profile[]);
    setFetching(false);
  };

  useEffect(() => {
    if (!isAdmin) return;
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  const meterById = useMemo(() => new Map(meters.map((m) => [m.id, m])), [meters]);
  const profileById = useMemo(() => new Map(profiles.map((p) => [p.id, p])), [profiles]);
  const tariffById = useMemo(() => new Map(tariffs.map((t) => [t.id, t])), [tariffs]);

  const counts = useMemo(() => {
    const c: Record<BillStatus | "all", number> = { all: bills.length, unpaid: 0, paid: 0, overdue: 0, cancelled: 0 };
    bills.forEach((b) => { c[b.status] = (c[b.status] ?? 0) + 1; });
    return c;
  }, [bills]);

  const totals = useMemo(() => {
    const out = { outstanding: 0, collected: 0 };
    bills.forEach((b) => {
      if (b.status === "paid") out.collected += Number(b.amount_etb);
      else if (b.status === "unpaid" || b.status === "overdue") out.outstanding += Number(b.amount_etb);
    });
    return out;
  }, [bills]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return bills.filter((b) => {
      if (statusFilter !== "all" && b.status !== statusFilter) return false;
      if (!q) return true;
      const meter = meterById.get(b.meter_id);
      const profile = profileById.get(b.customer_id);
      return [meter?.meter_number, profile?.full_name, profile?.customer_number]
        .filter(Boolean)
        .some((v) => (v as string).toLowerCase().includes(q));
    });
  }, [bills, statusFilter, search, meterById, profileById]);

  // Auto-pick the first active tariff matching the chosen meter's type
  useEffect(() => {
    if (!genMeterId) return;
    const meter = meterById.get(genMeterId);
    if (!meter) return;
    const match = tariffs.find((t) => t.customer_type === meter.customer_type);
    if (match) setGenTariffId(match.id);
  }, [genMeterId, meterById, tariffs]);

  const previewAmount = useMemo(() => {
    const k = parseFloat(genKwh);
    const tariff = tariffById.get(genTariffId);
    if (!tariff || !Number.isFinite(k) || k <= 0) return 0;
    return Number(tariff.price_per_kwh) * k;
  }, [genKwh, genTariffId, tariffById]);

  const generateBill = async () => {
    const meter = meterById.get(genMeterId);
    const tariff = tariffById.get(genTariffId);
    const kwh = parseFloat(genKwh);
    if (!meter || !tariff || !Number.isFinite(kwh) || kwh <= 0) {
      toast.error(am ? "የሜትር፣ ታሪፍ እና ኪሎዋት-ሰዓት ይምረጡ" : "Select meter, tariff, and valid kWh");
      return;
    }
    if (genStart > genEnd) {
      toast.error(am ? "የጊዜ ክልል ልክ አይደለም" : "Period start must be before end");
      return;
    }
    setGenerating(true);
    const amount = Number((Number(tariff.price_per_kwh) * kwh).toFixed(2));
    const { error } = await supabase.from("bills").insert({
      meter_id: meter.id,
      customer_id: meter.customer_id,
      period_start: genStart,
      period_end: genEnd,
      due_date: genDue,
      kwh_consumed: kwh,
      amount_etb: amount,
      status: "unpaid",
    });
    setGenerating(false);
    if (error) {
      toast.error(am ? "ሂሳብ ማመንጨት አልተሳካም" : "Failed to generate bill");
      return;
    }
    toast.success(am ? "ሂሳብ ተፈጥሯል" : "Bill generated");
    setGenOpen(false);
    setGenKwh("");
    void loadAll();
  };

  const setStatus = async (bill: Bill, next: BillStatus) => {
    setPendingId(bill.id + next);
    const { error } = await supabase.from("bills").update({ status: next }).eq("id", bill.id);
    setPendingId(null);
    if (error) {
      toast.error(am ? "ማዘመን አልተሳካም" : "Failed to update");
      return;
    }
    setBills((prev) => prev.map((b) => (b.id === bill.id ? { ...b, status: next } : b)));
    toast.success(am ? "ሁኔታ ተዘምኗል" : "Status updated");
  };

  const deleteBill = async (bill: Bill) => {
    if (!confirm(am ? "ይህን ሂሳብ ይሰርዙ?" : "Delete this bill?")) return;
    setPendingId(bill.id + "del");
    const { error } = await supabase.from("bills").delete().eq("id", bill.id);
    setPendingId(null);
    if (error) {
      toast.error(am ? "መሰረዝ አልተሳካም" : "Failed to delete");
      return;
    }
    setBills((prev) => prev.filter((b) => b.id !== bill.id));
    toast.success(am ? "ተሰርዟል" : "Deleted");
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  const statusCards: Array<{ key: BillStatus | "all"; en: string; am: string }> = [
    { key: "all", en: "All", am: "ሁሉም" },
    { key: "unpaid", en: "Unpaid", am: "ያልተከፈለ" },
    { key: "paid", en: "Paid", am: "ተከፍሏል" },
    { key: "overdue", en: "Overdue", am: "ጊዜው ያለፈበት" },
    { key: "cancelled", en: "Cancelled", am: "ተሰርዟል" },
  ];

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-1">
        <h1 className={cn("text-3xl font-bold tracking-tight", am && "font-ethiopic")}>
          {am ? "ሂሳቦች" : "Bills"}
        </h1>
        <p className={cn("text-muted-foreground", am && "font-ethiopic")}>
          {am ? "ሂሳቦችን ይዘርዝሩ፣ ከንቁ ታሪፍ ያመንጩ እና እንደተከፈሉ ምልክት ያድርጉ።" : "List, generate from active tariffs, and mark as paid."}
        </p>
      </div>

      {/* Totals */}
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="p-4">
            <div className={cn("text-xs uppercase tracking-wide text-muted-foreground", am && "font-ethiopic")}>
              {am ? "ያልተከፈለ ድምር" : "Outstanding"}
            </div>
            <div className="mt-1 text-2xl font-bold text-amber-600">{fmtETB(totals.outstanding)}</div>
          </CardContent>
        </Card>
        <Card className="border-emerald-500/30 bg-emerald-500/5">
          <CardContent className="p-4">
            <div className={cn("text-xs uppercase tracking-wide text-muted-foreground", am && "font-ethiopic")}>
              {am ? "ተሰብስቧል" : "Collected"}
            </div>
            <div className="mt-1 text-2xl font-bold text-emerald-600">{fmtETB(totals.collected)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Status filter cards */}
      <div className="mt-4 grid gap-2 grid-cols-2 sm:grid-cols-5">
        {statusCards.map((s) => {
          const active = statusFilter === s.key;
          return (
            <button
              key={s.key}
              onClick={() => setStatusFilter(s.key)}
              className={cn(
                "rounded-xl border p-3 text-left transition-colors",
                active ? "border-primary bg-primary/5" : "border-border bg-card hover:bg-muted/50",
              )}
            >
              <div className={cn("text-xs text-muted-foreground", am && "font-ethiopic")}>{am ? s.am : s.en}</div>
              <div className="mt-1 text-xl font-bold">{counts[s.key]}</div>
            </button>
          );
        })}
      </div>

      {/* Toolbar */}
      <div className="mt-6 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={am ? "በሜትር ቁጥር፣ በደንበኛ…" : "Search by meter #, customer…"}
            className={cn("pl-9", am && "font-ethiopic")}
          />
        </div>
        <Dialog open={genOpen} onOpenChange={setGenOpen}>
          <DialogTrigger asChild>
            <Button className={cn(am && "font-ethiopic")}>
              <Plus className="h-4 w-4" />
              <span className="ml-1.5">{am ? "ሂሳብ አመንጭ" : "Generate Bill"}</span>
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className={cn(am && "font-ethiopic")}>
                {am ? "አዲስ ሂሳብ አመንጭ" : "Generate New Bill"}
              </DialogTitle>
              <DialogDescription className={cn(am && "font-ethiopic")}>
                {am ? "የሜትር እና ኪሎዋት-ሰዓት ይምረጡ፤ ከንቁ ታሪፍ ይሰላል።" : "Pick a meter and kWh; the active tariff prices it automatically."}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-3">
              <div className="grid gap-1.5">
                <Label className={cn(am && "font-ethiopic")}>{am ? "ሜትር" : "Meter"}</Label>
                <Select value={genMeterId} onValueChange={setGenMeterId}>
                  <SelectTrigger><SelectValue placeholder={am ? "ሜትር ይምረጡ" : "Select meter"} /></SelectTrigger>
                  <SelectContent>
                    {meters.map((m) => {
                      const cust = profileById.get(m.customer_id);
                      return (
                        <SelectItem key={m.id} value={m.id}>
                          {m.meter_number} · {cust?.full_name || cust?.customer_number || "—"} · {m.customer_type}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-1.5">
                <Label className={cn(am && "font-ethiopic")}>{am ? "ታሪፍ" : "Tariff"}</Label>
                <Select value={genTariffId} onValueChange={setGenTariffId}>
                  <SelectTrigger><SelectValue placeholder={am ? "ታሪፍ ይምረጡ" : "Select tariff"} /></SelectTrigger>
                  <SelectContent>
                    {tariffs
                      .filter((t) => !genMeterId || t.customer_type === meterById.get(genMeterId)?.customer_type)
                      .map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name} · {fmtETB(Number(t.price_per_kwh))}/kWh
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-1.5">
                <Label className={cn(am && "font-ethiopic")}>{am ? "ኪሎዋት-ሰዓት (kWh)" : "Consumption (kWh)"}</Label>
                <Input
                  type="number" min="0" step="0.01"
                  value={genKwh}
                  onChange={(e) => setGenKwh(e.target.value)}
                  placeholder="e.g. 145"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label className={cn(am && "font-ethiopic")}>{am ? "ጀምር" : "Period start"}</Label>
                  <Input type="date" value={genStart} onChange={(e) => setGenStart(e.target.value)} />
                </div>
                <div className="grid gap-1.5">
                  <Label className={cn(am && "font-ethiopic")}>{am ? "ጨርስ" : "Period end"}</Label>
                  <Input type="date" value={genEnd} onChange={(e) => setGenEnd(e.target.value)} />
                </div>
              </div>

              <div className="grid gap-1.5">
                <Label className={cn(am && "font-ethiopic")}>{am ? "የመጨረሻ ቀን" : "Due date"}</Label>
                <Input type="date" value={genDue} onChange={(e) => setGenDue(e.target.value)} />
              </div>

              <div className="rounded-lg border border-border bg-muted/40 p-3 flex items-center justify-between">
                <span className={cn("text-sm text-muted-foreground", am && "font-ethiopic")}>
                  {am ? "የተሰላ መጠን" : "Calculated amount"}
                </span>
                <span className="text-lg font-bold text-primary">{fmtETB(previewAmount)}</span>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setGenOpen(false)} disabled={generating}>
                {am ? "ይቅር" : "Cancel"}
              </Button>
              <Button onClick={generateBill} disabled={generating}>
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Receipt className="h-4 w-4" />}
                <span className="ml-1.5">{am ? "አመንጭ" : "Generate"}</span>
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Table */}
      <div className="mt-4 rounded-2xl border border-border bg-card overflow-hidden">
        {fetching ? (
          <div className="p-12 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : filtered.length === 0 ? (
          <div className={cn("p-12 text-center text-muted-foreground", am && "font-ethiopic")}>
            {am ? "ምንም ሂሳብ የለም" : "No bills found"}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className={cn(am && "font-ethiopic")}>{am ? "ደንበኛ / ሜትር" : "Customer / Meter"}</TableHead>
                <TableHead className={cn(am && "font-ethiopic")}>{am ? "ጊዜ" : "Period"}</TableHead>
                <TableHead className={cn("text-right", am && "font-ethiopic")}>{am ? "ኪሎዋት-ሰዓት" : "kWh"}</TableHead>
                <TableHead className={cn("text-right", am && "font-ethiopic")}>{am ? "መጠን" : "Amount"}</TableHead>
                <TableHead className={cn(am && "font-ethiopic")}>{am ? "የመጨረሻ ቀን" : "Due"}</TableHead>
                <TableHead className={cn(am && "font-ethiopic")}>{am ? "ሁኔታ" : "Status"}</TableHead>
                <TableHead className="text-right">{am ? "ድርጊት" : "Actions"}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((b) => {
                const meter = meterById.get(b.meter_id);
                const cust = profileById.get(b.customer_id);
                const meta = STATUS_META[b.status];
                return (
                  <TableRow key={b.id}>
                    <TableCell>
                      <div className={cn("font-medium", am && "font-ethiopic")}>{cust?.full_name || (am ? "—" : "Unknown")}</div>
                      <div className="text-xs text-muted-foreground font-mono">
                        {meter?.meter_number ?? "—"} · {cust?.customer_number ?? "—"}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">
                      {b.period_start} → {b.period_end}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{Number(b.kwh_consumed).toFixed(2)}</TableCell>
                    <TableCell className="text-right tabular-nums font-semibold">{fmtETB(Number(b.amount_etb))}</TableCell>
                    <TableCell className="text-xs">{b.due_date}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn(meta.tone, am && "font-ethiopic")}>
                        {am ? meta.am : meta.en}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1.5">
                        {b.status !== "paid" && (
                          <Button
                            size="sm" variant="outline"
                            disabled={pendingId === b.id + "paid"}
                            onClick={() => setStatus(b, "paid")}
                            className={cn(am && "font-ethiopic")}
                          >
                            {pendingId === b.id + "paid" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                            <span className="ml-1.5">{am ? "ተከፍሏል" : "Mark Paid"}</span>
                          </Button>
                        )}
                        <Select value={b.status} onValueChange={(v) => setStatus(b, v as BillStatus)}>
                          <SelectTrigger className="h-9 w-[130px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {ALL_STATUSES.map((s) => (
                              <SelectItem key={s} value={s}>{am ? STATUS_META[s].am : STATUS_META[s].en}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          size="sm" variant="ghost"
                          disabled={pendingId === b.id + "del"}
                          onClick={() => deleteBill(b)}
                          className="text-destructive hover:text-destructive"
                        >
                          {pendingId === b.id + "del" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </DashboardLayout>
  );
};

export default AdminBills;
