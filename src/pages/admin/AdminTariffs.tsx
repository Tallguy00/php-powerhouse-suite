import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { useAuth } from "@/hooks/useAuth";
import { useLang } from "@/i18n/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus, Coins, Pencil, Check, X, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type CustomerType = "residential" | "commercial" | "industrial";

type Tariff = {
  id: string;
  name: string;
  customer_type: CustomerType;
  price_per_kwh: number;
  active: boolean;
  created_at: string;
};

const TYPE_META: Record<CustomerType, { en: string; am: string; tone: string }> = {
  residential: { en: "Residential", am: "የመኖሪያ", tone: "bg-blue-500/10 text-blue-600 border-blue-500/30" },
  commercial: { en: "Commercial", am: "ንግድ", tone: "bg-amber-500/10 text-amber-600 border-amber-500/30" },
  industrial: { en: "Industrial", am: "ኢንዱስትሪ", tone: "bg-purple-500/10 text-purple-600 border-purple-500/30" },
};

const ALL_TYPES: CustomerType[] = ["residential", "commercial", "industrial"];

const AdminTariffs = () => {
  const { roles, loading: authLoading } = useAuth();
  const { lang } = useLang();
  const { toast } = useToast();
  const isAm = lang === "am";
  const fontClass = isAm ? "font-ethiopic" : "";

  const [tariffs, setTariffs] = useState<Tariff[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState<string>("");
  const [savingId, setSavingId] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<CustomerType>("residential");
  const [newPrice, setNewPrice] = useState("");

  const isAdmin = roles.includes("admin");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("tariffs")
      .select("*")
      .order("customer_type", { ascending: true })
      .order("created_at", { ascending: false });
    if (error) {
      toast({ title: isAm ? "ስህተት" : "Error", description: error.message, variant: "destructive" });
    } else {
      setTariffs((data ?? []) as Tariff[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (isAdmin) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  const grouped = useMemo(() => {
    const g: Record<CustomerType, Tariff[]> = { residential: [], commercial: [], industrial: [] };
    tariffs.forEach((tr) => g[tr.customer_type]?.push(tr));
    return g;
  }, [tariffs]);

  const startEdit = (tr: Tariff) => {
    setEditingId(tr.id);
    setEditPrice(String(tr.price_per_kwh));
  };
  const cancelEdit = () => {
    setEditingId(null);
    setEditPrice("");
  };

  const savePrice = async (tr: Tariff) => {
    const price = Number(editPrice);
    if (!Number.isFinite(price) || price < 0) {
      toast({ title: isAm ? "ዋጋ ትክክል አይደለም" : "Invalid price", variant: "destructive" });
      return;
    }
    setSavingId(tr.id);
    const { error } = await supabase
      .from("tariffs")
      .update({ price_per_kwh: price })
      .eq("id", tr.id);
    setSavingId(null);
    if (error) {
      toast({ title: isAm ? "ስህተት" : "Error", description: error.message, variant: "destructive" });
      return;
    }
    setTariffs((prev) => prev.map((x) => (x.id === tr.id ? { ...x, price_per_kwh: price } : x)));
    cancelEdit();
    toast({ title: isAm ? "ተቀምጧል" : "Saved" });
  };

  const toggleActive = async (tr: Tariff, next: boolean) => {
    setSavingId(tr.id);
    const { error } = await supabase
      .from("tariffs")
      .update({ active: next })
      .eq("id", tr.id);
    setSavingId(null);
    if (error) {
      toast({ title: isAm ? "ስህተት" : "Error", description: error.message, variant: "destructive" });
      return;
    }
    setTariffs((prev) => prev.map((x) => (x.id === tr.id ? { ...x, active: next } : x)));
  };

  const removeTariff = async (tr: Tariff) => {
    if (!confirm(isAm ? "ይህን ታሪፍ ይሰርዙ?" : `Delete tariff "${tr.name}"?`)) return;
    setSavingId(tr.id);
    const { error } = await supabase.from("tariffs").delete().eq("id", tr.id);
    setSavingId(null);
    if (error) {
      toast({ title: isAm ? "ስህተት" : "Error", description: error.message, variant: "destructive" });
      return;
    }
    setTariffs((prev) => prev.filter((x) => x.id !== tr.id));
    toast({ title: isAm ? "ተሰርዟል" : "Deleted" });
  };

  const createTariff = async () => {
    const price = Number(newPrice);
    if (!newName.trim() || !Number.isFinite(price) || price < 0) {
      toast({ title: isAm ? "ሁሉንም መሙላት ያስፈልጋል" : "Fill all fields correctly", variant: "destructive" });
      return;
    }
    setCreating(true);
    const { data, error } = await supabase
      .from("tariffs")
      .insert({
        name: newName.trim(),
        customer_type: newType,
        price_per_kwh: price,
        active: true,
      })
      .select()
      .single();
    setCreating(false);
    if (error) {
      toast({ title: isAm ? "ስህተት" : "Error", description: error.message, variant: "destructive" });
      return;
    }
    setTariffs((prev) => [data as Tariff, ...prev]);
    setDialogOpen(false);
    setNewName(""); setNewPrice(""); setNewType("residential");
    toast({ title: isAm ? "ታሪፍ ተፈጥሯል" : "Tariff created" });
  };

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className={`text-3xl font-bold tracking-tight flex items-center gap-2 ${fontClass}`}>
              <Coins className="h-7 w-7 text-primary" />
              {isAm ? "ታሪፍ አስተዳደር" : "Tariffs"}
            </h1>
            <p className={`text-sm text-muted-foreground mt-1 ${fontClass}`}>
              {isAm
                ? "በደንበኛ ዓይነት የኤሌክትሪክ ዋጋዎችን ያስተዳድሩ።"
                : "Manage electricity prices by customer type."}
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                <span className={fontClass}>{isAm ? "አዲስ ታሪፍ" : "New tariff"}</span>
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className={fontClass}>{isAm ? "አዲስ ታሪፍ ይፍጠሩ" : "Create tariff"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label className={fontClass}>{isAm ? "ስም" : "Name"}</Label>
                  <Input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder={isAm ? "ለምሳሌ፦ ደረጃ 1" : "e.g. Block 1"}
                  />
                </div>
                <div className="space-y-2">
                  <Label className={fontClass}>{isAm ? "የደንበኛ ዓይነት" : "Customer type"}</Label>
                  <Select value={newType} onValueChange={(v) => setNewType(v as CustomerType)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ALL_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          <span className={fontClass}>{isAm ? TYPE_META[t].am : TYPE_META[t].en}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className={fontClass}>{isAm ? "ዋጋ (ETB/kWh)" : "Price (ETB/kWh)"}</Label>
                  <Input
                    type="number"
                    step="0.0001"
                    min="0"
                    value={newPrice}
                    onChange={(e) => setNewPrice(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={creating}>
                  <span className={fontClass}>{isAm ? "ሰርዝ" : "Cancel"}</span>
                </Button>
                <Button onClick={createTariff} disabled={creating}>
                  {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  <span className={fontClass}>{isAm ? "ፍጠር" : "Create"}</span>
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-3">
            {ALL_TYPES.map((type) => {
              const list = grouped[type];
              const meta = TYPE_META[type];
              return (
                <Card key={type} className="border-2">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className={`text-lg ${fontClass}`}>
                        {isAm ? meta.am : meta.en}
                      </CardTitle>
                      <Badge variant="outline" className={meta.tone}>{list.length}</Badge>
                    </div>
                    <CardDescription className={fontClass}>
                      {isAm ? "በዚህ ምድብ ያሉ ታሪፎች" : "Tariffs in this category"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {list.length === 0 && (
                      <p className={`text-sm text-muted-foreground py-4 text-center ${fontClass}`}>
                        {isAm ? "ምንም ታሪፍ የለም" : "No tariffs yet"}
                      </p>
                    )}
                    {list.map((tr) => {
                      const isEditing = editingId === tr.id;
                      const busy = savingId === tr.id;
                      return (
                        <div
                          key={tr.id}
                          className="rounded-lg border bg-card p-3 space-y-3 transition-smooth hover:shadow-sm"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className={`font-medium truncate ${fontClass}`}>{tr.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(tr.created_at).toLocaleDateString()}
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => removeTariff(tr)}
                              disabled={busy}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>

                          <div className="flex items-center gap-2">
                            {isEditing ? (
                              <>
                                <Input
                                  type="number"
                                  step="0.0001"
                                  min="0"
                                  value={editPrice}
                                  onChange={(e) => setEditPrice(e.target.value)}
                                  className="h-9"
                                  autoFocus
                                />
                                <Button size="icon" className="h-9 w-9 shrink-0" onClick={() => savePrice(tr)} disabled={busy}>
                                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                                </Button>
                                <Button size="icon" variant="outline" className="h-9 w-9 shrink-0" onClick={cancelEdit} disabled={busy}>
                                  <X className="h-4 w-4" />
                                </Button>
                              </>
                            ) : (
                              <>
                                <div className="flex-1 rounded-md border bg-muted/40 px-3 py-2">
                                  <span className="text-lg font-bold text-primary">
                                    {Number(tr.price_per_kwh).toFixed(4)}
                                  </span>
                                  <span className={`text-xs text-muted-foreground ml-1 ${fontClass}`}>
                                    {isAm ? "ብር/ኪ.ዋ.ሰ" : "ETB/kWh"}
                                  </span>
                                </div>
                                <Button size="icon" variant="outline" className="h-9 w-9 shrink-0" onClick={() => startEdit(tr)}>
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                          </div>

                          <div className="flex items-center justify-between pt-1">
                            <Label className={`text-xs cursor-pointer ${fontClass}`}>
                              {tr.active
                                ? (isAm ? "ንቁ" : "Active")
                                : (isAm ? "ቆሟል" : "Inactive")}
                            </Label>
                            <Switch
                              checked={tr.active}
                              onCheckedChange={(v) => toggleActive(tr, v)}
                              disabled={busy}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default AdminTariffs;
