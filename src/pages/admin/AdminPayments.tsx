import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { useAuth } from "@/hooks/useAuth";
import { useLang } from "@/i18n/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import { LoaderCircle as Loader2, Plus, Download, CircleCheck as CheckCircle2, Circle as XCircle, Clock } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Payment = {
  id: string;
  bill_id: string;
  customer_id: string;
  amount_etb: number;
  method: string;
  reference_number: string;
  status: "pending" | "completed" | "failed";
  paid_at: string | null;
  created_at: string;
};

type Bill = {
  id: string;
  customer_id: string;
  amount_etb: number;
  status: string;
};

type Customer = {
  id: string;
  name: string;
  email: string;
  account_number: string;
};

const PAYMENT_METHODS = ["telebirr", "cbe", "awash", "dashen", "abyssinia", "nib"];
const PAYMENT_METHOD_LABELS = {
  telebirr: "Telebirr",
  cbe: "Commercial Bank of Ethiopia",
  awash: "Awash International Bank",
  dashen: "Dashen Bank",
  abyssinia: "Abyssinia Bank",
  nib: "NIB International Bank",
};

const STATUS_META = {
  pending: { en: "Pending", am: "በመጠባበቅ ላይ", tone: "bg-amber-500/10 text-amber-600 border-amber-500/30" },
  completed: { en: "Completed", am: "ተጠናቅቋል", tone: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" },
  failed: { en: "Failed", am: "ወድቋል", tone: "bg-red-500/10 text-red-600 border-red-500/30" },
};

const fmtETB = (n: number) =>
  new Intl.NumberFormat("en-ET", { style: "currency", currency: "ETB", maximumFractionDigits: 2 }).format(n);

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("en-ET", { month: "short", day: "numeric", year: "numeric" }) : "—";

const AdminPayments = () => {
  const { roles, loading } = useAuth();
  const { lang } = useLang();
  const am = lang === "am";
  const isAdmin = roles.includes("admin");

  const [fetching, setFetching] = useState(true);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "completed" | "failed">("all");
  const [methodFilter, setMethodFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  // New payment dialog
  const [newOpen, setNewOpen] = useState(false);
  const [newBillId, setNewBillId] = useState("");
  const [newMethod, setNewMethod] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newRef, setNewRef] = useState("");
  const [newStatus, setNewStatus] = useState("pending");
  const [newPending, setNewPending] = useState(false);

  // Update payment dialog
  const [updateOpen, setUpdateOpen] = useState(false);
  const [updateId, setUpdateId] = useState<string | null>(null);
  const [updateStatus, setUpdateStatus] = useState("pending");
  const [updatePending, setUpdatePending] = useState(false);

  useEffect(() => {
    if (!isAdmin) return;

    (async () => {
      try {
        const [paymentsRes, billsRes, customersRes] = await Promise.all([
          supabase.from("payments").select("*").order("created_at", { ascending: false }),
          supabase.from("bills").select("*"),
          supabase.from("customers").select("*"),
        ]);

        if (paymentsRes.error) throw paymentsRes.error;
        if (billsRes.error) throw billsRes.error;
        if (customersRes.error) throw customersRes.error;

        setPayments(paymentsRes.data || []);
        setBills(billsRes.data || []);
        setCustomers(customersRes.data || []);
      } catch (e) {
        toast.error(am ? "ወደ ውሂብ ምንም ሊጫን አልቻለ" : "Failed to load data");
      } finally {
        setFetching(false);
      }
    })();
  }, [isAdmin, am]);

  if (loading) return <DashboardLayout><div className="flex items-center justify-center h-96"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div></DashboardLayout>;
  if (!isAdmin) return <Navigate to="/dashboard" />;

  const handleCreatePayment = async () => {
    if (!newBillId || !newMethod || !newAmount || !newRef) {
      toast.error(am ? "ሁሉንም መስኮች ይሙሉ" : "Fill all fields");
      return;
    }

    setNewPending(true);
    try {
      const bill = bills.find(b => b.id === newBillId);
      if (!bill) throw new Error("Bill not found");

      const { data, error } = await supabase.from("payments").insert({
        bill_id: newBillId,
        customer_id: bill.customer_id,
        amount_etb: parseFloat(newAmount),
        method: newMethod,
        reference_number: newRef,
        status: newStatus,
        paid_at: newStatus === "completed" ? new Date().toISOString() : null,
      }).select();

      if (error) throw error;

      setPayments([...payments, data[0]]);
      setNewOpen(false);
      setNewBillId("");
      setNewMethod("");
      setNewAmount("");
      setNewRef("");
      setNewStatus("pending");
      toast.success(am ? "ክፍያ ታክሏል" : "Payment created");

      // Auto-generate certificate if completed
      if (newStatus === "completed" && data[0]) {
        handleGenerateCertificate(data[0].id);
      }
    } catch (e) {
      toast.error(am ? "ስህተት" : "Error");
    } finally {
      setNewPending(false);
    }
  };

  const handleUpdatePayment = async () => {
    if (!updateId) return;

    setUpdatePending(true);
    try {
      const { error } = await supabase
        .from("payments")
        .update({
          status: updateStatus,
          paid_at: updateStatus === "completed" ? new Date().toISOString() : null,
        })
        .eq("id", updateId);

      if (error) throw error;

      setPayments(payments.map(p => p.id === updateId ? { ...p, status: updateStatus as any, paid_at: updateStatus === "completed" ? new Date().toISOString() : null } : p));
      setUpdateOpen(false);
      setUpdateId(null);
      toast.success(am ? "ክፍያ ታቅሏል" : "Payment updated");

      // Auto-generate certificate if completed
      if (updateStatus === "completed") {
        handleGenerateCertificate(updateId);
      }
    } catch (e) {
      toast.error(am ? "ስህተት" : "Error");
    } finally {
      setUpdatePending(false);
    }
  };

  const handleGenerateCertificate = async (paymentId: string) => {
    try {
      const payment = payments.find(p => p.id === paymentId);
      if (!payment) return;

      const certNumber = `CERT-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

      const { error } = await supabase.from("payment_certificates").insert({
        payment_id: paymentId,
        customer_id: payment.customer_id,
        bill_id: payment.bill_id,
        certificate_number: certNumber,
        amount_paid: payment.amount_etb,
        payment_method: payment.method,
      });

      if (error) throw error;
      toast.success(am ? "ሰርቲፊኬት ተፈጠረ" : "Certificate generated");
    } catch (e) {
      toast.error(am ? "ሰርቲፊኬት ለመሥራት ያልተሳካ" : "Failed to generate certificate");
    }
  };

  const filtered = payments.filter(p => {
    const matchStatus = statusFilter === "all" || p.status === statusFilter;
    const matchMethod = methodFilter === "all" || p.method === methodFilter;
    const customer = customers.find(c => c.id === p.customer_id);
    const bill = bills.find(b => b.id === p.bill_id);
    const matchSearch = !search || customer?.name.toLowerCase().includes(search.toLowerCase()) || p.reference_number.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchMethod && matchSearch;
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">{am ? "ክፍያዎች" : "Payments"}</h1>
            <p className="text-muted-foreground mt-1">{am ? "ሁሉንም ክፍያዎች ይስተዳድሩ" : "Manage all customer payments"}</p>
          </div>
          <Dialog open={newOpen} onOpenChange={setNewOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="h-4 w-4" />{am ? "ክፍያ አክል" : "Add Payment"}</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{am ? "ክፍያ አክል" : "Add Payment"}</DialogTitle>
                <DialogDescription>{am ? "አዲስ ክፍያ ይመዝገቡ" : "Register a new payment"}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>{am ? "ሂሳብ" : "Bill"}</Label>
                  <Select value={newBillId} onValueChange={setNewBillId}>
                    <SelectTrigger>
                      <SelectValue placeholder={am ? "ሂሳብ ይምረጡ" : "Select bill"} />
                    </SelectTrigger>
                    <SelectContent>
                      {bills.map(b => {
                        const cust = customers.find(c => c.id === b.customer_id);
                        return (
                          <SelectItem key={b.id} value={b.id}>
                            {cust?.name} - {fmtETB(b.amount_etb)}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{am ? "ስሪት" : "Method"}</Label>
                  <Select value={newMethod} onValueChange={setNewMethod}>
                    <SelectTrigger>
                      <SelectValue placeholder={am ? "ስሪት ይምረጡ" : "Select method"} />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHODS.map(m => (
                        <SelectItem key={m} value={m}>
                          {PAYMENT_METHOD_LABELS[m as keyof typeof PAYMENT_METHOD_LABELS]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{am ? "መጠን" : "Amount (ETB)"}</Label>
                  <Input
                    type="number"
                    value={newAmount}
                    onChange={(e) => setNewAmount(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <Label>{am ? "ማመሳከሪያ" : "Reference Number"}</Label>
                  <Input
                    value={newRef}
                    onChange={(e) => setNewRef(e.target.value)}
                    placeholder="e.g., TXN-2024-001"
                  />
                </div>
                <div>
                  <Label>{am ? "ሁኔታ" : "Status"}</Label>
                  <Select value={newStatus} onValueChange={setNewStatus}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">{am ? "በመጠባበቅ ላይ" : "Pending"}</SelectItem>
                      <SelectItem value="completed">{am ? "ተጠናቅቋል" : "Completed"}</SelectItem>
                      <SelectItem value="failed">{am ? "ወድቋል" : "Failed"}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setNewOpen(false)}>{am ? "ሰርዝ" : "Cancel"}</Button>
                <Button onClick={handleCreatePayment} disabled={newPending}>
                  {newPending ? <Loader2 className="h-4 w-4 animate-spin" /> : am ? "ጨምር" : "Add"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Card className="border-border">
          <CardHeader>
            <div className="flex flex-col gap-4">
              <div className="flex gap-2">
                <Input
                  placeholder={am ? "ደንበኛ ወይም ማመሳከሪያ ይፈልጉ" : "Search customer or reference..."}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="flex-1"
                />
              </div>
              <div className="flex gap-2">
                <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v)}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{am ? "ሁሉ" : "All Status"}</SelectItem>
                    <SelectItem value="pending">{am ? "በመጠባበቅ ላይ" : "Pending"}</SelectItem>
                    <SelectItem value="completed">{am ? "ተጠናቅቋል" : "Completed"}</SelectItem>
                    <SelectItem value="failed">{am ? "ወድቋል" : "Failed"}</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={methodFilter} onValueChange={setMethodFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{am ? "ሁሉ ስሪቶች" : "All Methods"}</SelectItem>
                    {PAYMENT_METHODS.map(m => (
                      <SelectItem key={m} value={m}>
                        {PAYMENT_METHOD_LABELS[m as keyof typeof PAYMENT_METHOD_LABELS]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {fetching ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {am ? "ምንም ክፍያዎች የሉም" : "No payments found"}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{am ? "ደንበኛ" : "Customer"}</TableHead>
                      <TableHead>{am ? "ማመሳከሪያ" : "Reference"}</TableHead>
                      <TableHead className="text-right">{am ? "መጠን" : "Amount"}</TableHead>
                      <TableHead>{am ? "ስሪት" : "Method"}</TableHead>
                      <TableHead>{am ? "ሁኔታ" : "Status"}</TableHead>
                      <TableHead>{am ? "ሪጋታ" : "Date"}</TableHead>
                      <TableHead className="text-right">{am ? "ድርጊቶች" : "Actions"}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map(payment => {
                      const cust = customers.find(c => c.id === payment.customer_id);
                      return (
                        <TableRow key={payment.id}>
                          <TableCell className="font-medium">{cust?.name || "Unknown"}</TableCell>
                          <TableCell className="font-mono text-sm">{payment.reference_number}</TableCell>
                          <TableCell className="text-right font-semibold">{fmtETB(payment.amount_etb)}</TableCell>
                          <TableCell>{PAYMENT_METHOD_LABELS[payment.method as keyof typeof PAYMENT_METHOD_LABELS]}</TableCell>
                          <TableCell>
                            <Badge className={cn("border", STATUS_META[payment.status].tone)}>
                              {STATUS_META[payment.status][am ? "am" : "en"]}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">{fmtDate(payment.paid_at || payment.created_at)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-2 justify-end">
                              <Dialog open={updateOpen && updateId === payment.id} onOpenChange={(open) => {
                                if (open) {
                                  setUpdateId(payment.id);
                                  setUpdateStatus(payment.status);
                                }
                                setUpdateOpen(open);
                              }}>
                                <DialogTrigger asChild>
                                  <Button variant="ghost" size="sm">{am ? "ታርም" : "Edit"}</Button>
                                </DialogTrigger>
                                <DialogContent>
                                  <DialogHeader>
                                    <DialogTitle>{am ? "ክፍያ ታርም" : "Update Payment"}</DialogTitle>
                                  </DialogHeader>
                                  <div className="space-y-4">
                                    <div>
                                      <Label>{am ? "ሁኔታ" : "Status"}</Label>
                                      <Select value={updateStatus} onValueChange={setUpdateStatus}>
                                        <SelectTrigger>
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="pending">{am ? "በመጠባበቅ ላይ" : "Pending"}</SelectItem>
                                          <SelectItem value="completed">{am ? "ተጠናቅቋል" : "Completed"}</SelectItem>
                                          <SelectItem value="failed">{am ? "ወድቋል" : "Failed"}</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  </div>
                                  <DialogFooter>
                                    <Button variant="outline" onClick={() => setUpdateOpen(false)}>{am ? "ሰርዝ" : "Cancel"}</Button>
                                    <Button onClick={handleUpdatePayment} disabled={updatePending}>
                                      {updatePending ? <Loader2 className="h-4 w-4 animate-spin" /> : am ? "ታርም" : "Update"}
                                    </Button>
                                  </DialogFooter>
                                </DialogContent>
                              </Dialog>
                              <Button variant="ghost" size="sm" onClick={() => handleGenerateCertificate(payment.id)}>
                                <Download className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default AdminPayments;
