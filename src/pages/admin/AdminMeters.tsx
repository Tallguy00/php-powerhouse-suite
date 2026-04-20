import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { Loader2, Search, Plus, Pencil, Gauge, MapPin, User as UserIcon, Trash2 } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { useAuth } from "@/hooks/useAuth";
import { useLang } from "@/i18n/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type CustomerType = "residential" | "commercial" | "industrial";
type MeterStatus = "active" | "inactive" | "maintenance";

type Region = { id: string; name_en: string; name_am: string };
type Profile = { id: string; full_name: string | null; customer_number: string | null };
type Meter = {
  id: string;
  meter_number: string;
  customer_id: string;
  customer_type: CustomerType;
  region_id: string | null;
  status: string;
  installed_at: string;
};

type FormState = {
  id?: string;
  meter_number: string;
  customer_id: string;
  customer_type: CustomerType;
  region_id: string;
  status: MeterStatus;
};

const EMPTY_FORM: FormState = {
  meter_number: "",
  customer_id: "",
  customer_type: "residential",
  region_id: "",
  status: "active",
};

const TYPE_TONE: Record<CustomerType, string> = {
  residential: "bg-primary/10 text-primary border-primary/30",
  commercial: "bg-secondary/15 text-secondary border-secondary/30",
  industrial: "bg-accent/15 text-accent border-accent/30",
};

const STATUS_TONE: Record<string, string> = {
  active: "bg-success/15 text-success border-success/30",
  inactive: "bg-muted text-muted-foreground",
  maintenance: "bg-accent/15 text-accent border-accent/30",
};

const AdminMeters = () => {
  const { roles, loading } = useAuth();
  const { lang } = useLang();
  const am = lang === "am";

  const isAdmin = roles.includes("admin");

  const [meters, setMeters] = useState<Meter[]>([]);
  const [customers, setCustomers] = useState<Profile[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [fetching, setFetching] = useState(true);

  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const customerById = useMemo(() => {
    const m = new Map<string, Profile>();
    customers.forEach((c) => m.set(c.id, c));
    return m;
  }, [customers]);

  const regionById = useMemo(() => {
    const m = new Map<string, Region>();
    regions.forEach((r) => m.set(r.id, r));
    return m;
  }, [regions]);

  const loadAll = async () => {
    setFetching(true);
    const [mRes, cRes, rRes] = await Promise.all([
      supabase.from("meters").select("*").order("created_at", { ascending: false }),
      supabase.from("profiles").select("id, full_name, customer_number").order("full_name"),
      supabase.from("regions").select("id, name_en, name_am").order("name_en"),
    ]);
    if (mRes.error || cRes.error || rRes.error) {
      toast.error(am ? "ሜትሮችን መጫን አልተቻለም" : "Failed to load meters");
      setFetching(false);
      return;
    }
    setMeters((mRes.data ?? []) as Meter[]);
    setCustomers((cRes.data ?? []) as Profile[]);
    setRegions((rRes.data ?? []) as Region[]);
    setFetching(false);
  };

  useEffect(() => {
    if (!isAdmin) return;
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return meters;
    return meters.filter((m) => {
      const c = customerById.get(m.customer_id);
      const r = m.region_id ? regionById.get(m.region_id) : null;
      return [
        m.meter_number,
        c?.full_name,
        c?.customer_number,
        r?.name_en,
        r?.name_am,
      ]
        .filter(Boolean)
        .some((v) => (v as string).toLowerCase().includes(q));
    });
  }, [meters, search, customerById, regionById]);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setOpen(true);
  };

  const openEdit = (m: Meter) => {
    setForm({
      id: m.id,
      meter_number: m.meter_number,
      customer_id: m.customer_id,
      customer_type: m.customer_type,
      region_id: m.region_id ?? "",
      status: (m.status as MeterStatus) ?? "active",
    });
    setOpen(true);
  };

  const submit = async () => {
    if (!form.meter_number.trim() || !form.customer_id) {
      toast.error(am ? "የሜትር ቁጥር እና ደንበኛ ያስፈልጋል" : "Meter number and customer are required");
      return;
    }
    setSaving(true);
    const payload = {
      meter_number: form.meter_number.trim(),
      customer_id: form.customer_id,
      customer_type: form.customer_type,
      region_id: form.region_id || null,
      status: form.status,
    };
    const { error } = form.id
      ? await supabase.from("meters").update(payload).eq("id", form.id)
      : await supabase.from("meters").insert(payload);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(am ? "ተሳካ" : form.id ? "Meter updated" : "Meter created");
    setOpen(false);
    void loadAll();
  };

  const remove = async (m: Meter) => {
    if (!confirm(am ? `ሜትር ${m.meter_number} ይሰረዝ?` : `Delete meter ${m.meter_number}?`)) return;
    setDeleting(m.id);
    const { error } = await supabase.from("meters").delete().eq("id", m.id);
    setDeleting(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(am ? "ተሰርዟል" : "Meter deleted");
    setMeters((prev) => prev.filter((x) => x.id !== m.id));
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  return (
    <DashboardLayout>
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className={cn("text-3xl font-bold tracking-tight", am && "font-ethiopic")}>
            {am ? "ሜትሮች" : "Meters"}
          </h1>
          <p className={cn("mt-1 text-muted-foreground", am && "font-ethiopic")}>
            {am ? "ሁሉንም ሜትሮች ይመልከቱ፣ ይፍጠሩ እና ያስተካክሉ።" : "View, create, and edit every meter in the network."}
          </p>
        </div>
        <Button onClick={openCreate} className={am ? "font-ethiopic" : ""}>
          <Plus className="h-4 w-4 mr-1.5" />
          {am ? "አዲስ ሜትር" : "New Meter"}
        </Button>
      </div>

      <div className="mt-6 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={am ? "በሜትር #፣ በደንበኛ ወይም በክልል ይፈልጉ…" : "Search by meter #, customer, region…"}
            className={cn("pl-9", am && "font-ethiopic")}
          />
        </div>
        <div className="text-sm text-muted-foreground">
          {am ? `${filtered.length} ሜትሮች` : `${filtered.length} meters`}
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-card overflow-hidden">
        {fetching ? (
          <div className="p-12 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : filtered.length === 0 ? (
          <div className={cn("p-12 text-center text-muted-foreground", am && "font-ethiopic")}>
            {am ? "ምንም ሜትር አልተገኘም" : "No meters found"}
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {filtered.map((m) => {
              const c = customerById.get(m.customer_id);
              const r = m.region_id ? regionById.get(m.region_id) : null;
              return (
                <li key={m.id} className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-primary-foreground shrink-0">
                      <Gauge className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-semibold">{m.meter_number}</span>
                        <Badge variant="outline" className={cn("capitalize text-xs", TYPE_TONE[m.customer_type])}>
                          {m.customer_type}
                        </Badge>
                        <Badge variant="outline" className={cn("capitalize text-xs", STATUS_TONE[m.status] ?? STATUS_TONE.inactive)}>
                          {m.status}
                        </Badge>
                      </div>
                      <div className="mt-1.5 flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                        <span className="inline-flex items-center gap-1">
                          <UserIcon className="h-3 w-3" />
                          <span className={am ? "font-ethiopic" : ""}>
                            {c?.full_name || (am ? "ስም የለም" : "Unknown")}
                          </span>
                          {c?.customer_number && <span className="font-mono opacity-70">· {c.customer_number}</span>}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          <span className={am ? "font-ethiopic" : ""}>
                            {r ? (am ? r.name_am : r.name_en) : (am ? "ክልል የለም" : "No region")}
                          </span>
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 lg:justify-end shrink-0">
                    <Button size="sm" variant="outline" onClick={() => openEdit(m)} className={am ? "font-ethiopic" : ""}>
                      <Pencil className="h-3.5 w-3.5 mr-1.5" />
                      {am ? "አስተካክል" : "Edit"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={deleting === m.id}
                      onClick={() => remove(m)}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      {deleting === m.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className={am ? "font-ethiopic" : ""}>
              {form.id ? (am ? "ሜትር አስተካክል" : "Edit Meter") : (am ? "አዲስ ሜትር" : "New Meter")}
            </DialogTitle>
            <DialogDescription className={am ? "font-ethiopic" : ""}>
              {am ? "የሜትር መረጃ ያስገቡ።" : "Enter meter details and assign to a customer."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className={am ? "font-ethiopic" : ""}>{am ? "የሜትር ቁጥር" : "Meter Number"}</Label>
              <Input
                value={form.meter_number}
                onChange={(e) => setForm({ ...form, meter_number: e.target.value })}
                placeholder="MT-000123"
              />
            </div>

            <div className="space-y-1.5">
              <Label className={am ? "font-ethiopic" : ""}>{am ? "ደንበኛ" : "Customer"}</Label>
              <Select value={form.customer_id} onValueChange={(v) => setForm({ ...form, customer_id: v })}>
                <SelectTrigger><SelectValue placeholder={am ? "ደንበኛ ይምረጡ" : "Select customer"} /></SelectTrigger>
                <SelectContent>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      <span className={am ? "font-ethiopic" : ""}>{c.full_name || (am ? "ስም የለም" : "No name")}</span>
                      {c.customer_number && <span className="ml-2 text-xs opacity-60 font-mono">{c.customer_number}</span>}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className={am ? "font-ethiopic" : ""}>{am ? "ዓይነት" : "Type"}</Label>
                <Select value={form.customer_type} onValueChange={(v) => setForm({ ...form, customer_type: v as CustomerType })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="residential">{am ? "መኖሪያ" : "Residential"}</SelectItem>
                    <SelectItem value="commercial">{am ? "ንግድ" : "Commercial"}</SelectItem>
                    <SelectItem value="industrial">{am ? "ኢንዱስትሪ" : "Industrial"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className={am ? "font-ethiopic" : ""}>{am ? "ሁኔታ" : "Status"}</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as MeterStatus })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">{am ? "ንቁ" : "Active"}</SelectItem>
                    <SelectItem value="inactive">{am ? "ያልነቃ" : "Inactive"}</SelectItem>
                    <SelectItem value="maintenance">{am ? "ጥገና" : "Maintenance"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className={am ? "font-ethiopic" : ""}>{am ? "ክልል" : "Region"}</Label>
              <Select value={form.region_id || "__none__"} onValueChange={(v) => setForm({ ...form, region_id: v === "__none__" ? "" : v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{am ? "ምንም" : "None"}</SelectItem>
                  {regions.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      <span className={am ? "font-ethiopic" : ""}>{am ? r.name_am : r.name_en}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              {am ? "ይቅር" : "Cancel"}
            </Button>
            <Button onClick={submit} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              {form.id ? (am ? "አስቀምጥ" : "Save") : (am ? "ፍጠር" : "Create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default AdminMeters;