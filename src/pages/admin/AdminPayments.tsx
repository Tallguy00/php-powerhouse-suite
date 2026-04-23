import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { useAuth } from "@/hooks/useAuth";
import { useLang } from "@/i18n/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Loader2, CheckCircle2, Search } from "lucide-react";
import { toast } from "sonner";

type Payment = {
  id: string;
  bill_id: string;
  customer_id: string;
  amount_etb: number;
  method: string;
  reference: string | null;
  paid_at: string;
};
type Bill = { id: string; amount_etb: number; status: string; meter_id: string };
type Profile = { id: string; full_name: string | null; customer_number: string | null };

const METHOD_LABELS: Record<string, string> = {
  telebirr: "Telebirr",
  cbe: "CBE Birr",
  awash: "Awash Bank",
  dashen: "Dashen Bank",
  cash: "Cash",
};

const fmtETB = (n: number) =>
  new Intl.NumberFormat("en-ET", { style: "currency", currency: "ETB", maximumFractionDigits: 2 }).format(Number(n));
const fmtDate = (d: string) => new Date(d).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });

const AdminPayments = () => {
  const { roles, loading } = useAuth();
  const { lang } = useLang();
  const am = lang === "am";
  const isAdmin = roles.includes("admin");

  const [fetching, setFetching] = useState(true);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [methodFilter, setMethodFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const load = async () => {
    setFetching(true);
    const [p, b, pr] = await Promise.all([
      supabase.from("payments").select("*").order("paid_at", { ascending: false }),
      supabase.from("bills").select("id, amount_etb, status, meter_id"),
      supabase.from("profiles").select("id, full_name, customer_number"),
    ]);
    if (p.error || b.error || pr.error) {
      toast.error(am ? "ውሂብ መጫን አልተሳካም" : "Failed to load data");
      setFetching(false);
      return;
    }
    setPayments((p.data ?? []) as Payment[]);
    setBills((b.data ?? []) as Bill[]);
    setProfiles((pr.data ?? []) as Profile[]);
    setFetching(false);
  };

  useEffect(() => {
    if (!isAdmin) return;
    void load();
    // Realtime: refresh on new payments
    const ch = supabase
      .channel("admin-payments")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "payments" }, (payload) => {
        const np = payload.new as Payment;
        setPayments((prev) => (prev.some((x) => x.id === np.id) ? prev : [np, ...prev]));
        const cust = profiles.find((c) => c.id === np.customer_id);
        toast.success(
          am ? `አዲስ ክፍያ: ${fmtETB(np.amount_etb)}` : `New payment: ${fmtETB(np.amount_etb)}`,
          { description: cust?.full_name ?? cust?.customer_number ?? np.customer_id.slice(0, 8) }
        );
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "bills" }, (payload) => {
        const nb = payload.new as Bill;
        setBills((prev) => prev.map((x) => (x.id === nb.id ? { ...x, ...nb } : x)));
      })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  const profileById = useMemo(() => new Map(profiles.map((p) => [p.id, p])), [profiles]);
  const billById = useMemo(() => new Map(bills.map((b) => [b.id, b])), [bills]);

  const totals = useMemo(() => {
    const collected = payments.reduce((s, p) => s + Number(p.amount_etb), 0);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const todayTotal = payments
      .filter((p) => new Date(p.paid_at) >= today)
      .reduce((s, p) => s + Number(p.amount_etb), 0);
    return { collected, todayTotal, count: payments.length };
  }, [payments]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return payments.filter((p) => {
      if (methodFilter !== "all" && p.method !== methodFilter) return false;
      if (!q) return true;
      const cust = profileById.get(p.customer_id);
      return [cust?.full_name, cust?.customer_number, p.reference, p.id]
        .filter(Boolean)
        .some((v) => (v as string).toLowerCase().includes(q));
    });
  }, [payments, methodFilter, search, profileById]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  return (
    <DashboardLayout>
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{am ? "ክፍያዎች" : "Payments"}</h1>
        <p className="text-muted-foreground mt-1">
          {am ? "የደንበኞች ክፍያዎች በቀጥታ ሲገቡ ይታያሉ።" : "Customer payments appear here in real time."}
        </p>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <Card><CardContent className="p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">{am ? "ጠቅላላ ክፍያዎች" : "Total Payments"}</div>
          <div className="mt-1 text-2xl font-bold">{totals.count}</div>
        </CardContent></Card>
        <Card className="border-emerald-500/30 bg-emerald-500/5"><CardContent className="p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">{am ? "ተሰብስቧል" : "Collected"}</div>
          <div className="mt-1 text-2xl font-bold text-emerald-600">{fmtETB(totals.collected)}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">{am ? "ዛሬ" : "Today"}</div>
          <div className="mt-1 text-2xl font-bold">{fmtETB(totals.todayTotal)}</div>
        </CardContent></Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder={am ? "በደንበኛ ወይም ማመሳከሪያ ይፈልጉ…" : "Search customer or reference…"} className="pl-9" />
            </div>
            <Select value={methodFilter} onValueChange={setMethodFilter}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{am ? "ሁሉ ስልቶች" : "All methods"}</SelectItem>
                {Object.keys(METHOD_LABELS).map((m) => (
                  <SelectItem key={m} value={m}>{METHOD_LABELS[m]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {fetching ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">{am ? "ምንም ክፍያዎች የሉም" : "No payments found"}</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{am ? "ደንበኛ" : "Customer"}</TableHead>
                    <TableHead>{am ? "ሂሳብ" : "Bill"}</TableHead>
                    <TableHead className="text-right">{am ? "መጠን" : "Amount"}</TableHead>
                    <TableHead>{am ? "ስልት" : "Method"}</TableHead>
                    <TableHead>{am ? "ማመሳከሪያ" : "Reference"}</TableHead>
                    <TableHead>{am ? "የሂሳብ ሁኔታ" : "Bill Status"}</TableHead>
                    <TableHead>{am ? "ቀን" : "Date"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((p) => {
                    const cust = profileById.get(p.customer_id);
                    const bill = billById.get(p.bill_id);
                    const isPaid = bill?.status === "paid";
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">
                          {cust?.full_name ?? cust?.customer_number ?? p.customer_id.slice(0, 8)}
                        </TableCell>
                        <TableCell className="font-mono text-xs">#{p.bill_id.slice(0, 8).toUpperCase()}</TableCell>
                        <TableCell className="text-right font-semibold">{fmtETB(p.amount_etb)}</TableCell>
                        <TableCell>{METHOD_LABELS[p.method] ?? p.method}</TableCell>
                        <TableCell className="font-mono text-xs">{p.reference ?? "—"}</TableCell>
                        <TableCell>
                          {isPaid ? (
                            <Badge className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/30">
                              <CheckCircle2 className="h-3 w-3 mr-1" />{am ? "ተከፍሏል" : "Paid"}
                            </Badge>
                          ) : (
                            <Badge variant="outline">{bill?.status ?? "—"}</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{fmtDate(p.paid_at)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </DashboardLayout>
  );
};

export default AdminPayments;
