import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { Loader2, Search, Shield, ShieldCheck, Wrench, User as UserIcon, Phone, MapPin } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { useAuth, AppRole } from "@/hooks/useAuth";
import { useLang } from "@/i18n/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type ProfileRow = {
  id: string;
  full_name: string | null;
  phone: string | null;
  region: string | null;
  customer_number: string | null;
  created_at: string;
};

type RoleRow = { user_id: string; role: AppRole };

type EnrichedUser = ProfileRow & { roles: AppRole[] };

const ROLE_META: Record<AppRole, { en: string; am: string; icon: typeof Shield; tone: string }> = {
  admin: { en: "Admin", am: "አስተዳዳሪ", icon: ShieldCheck, tone: "bg-primary/10 text-primary border-primary/30" },
  technician: { en: "Technician", am: "ቴክኒሻን", tone: "bg-accent/10 text-accent border-accent/30", icon: Wrench },
  customer: { en: "Customer", am: "ደንበኛ", tone: "bg-secondary/10 text-secondary-foreground border-secondary/30", icon: UserIcon },
};

const ALL_ROLES: AppRole[] = ["customer", "technician", "admin"];

const AdminCustomers = () => {
  const { user, roles, loading } = useAuth();
  const { lang } = useLang();
  const am = lang === "am";

  const [users, setUsers] = useState<EnrichedUser[]>([]);
  const [fetching, setFetching] = useState(true);
  const [search, setSearch] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);

  const isAdmin = roles.includes("admin");

  const loadUsers = async () => {
    setFetching(true);
    const [{ data: profiles, error: pErr }, { data: roleRows, error: rErr }] = await Promise.all([
      supabase.from("profiles").select("id, full_name, phone, region, customer_number, created_at").order("created_at", { ascending: false }),
      supabase.from("user_roles").select("user_id, role"),
    ]);
    if (pErr || rErr) {
      toast.error(am ? "ተጠቃሚዎችን መጫን አልተቻለም" : "Failed to load users");
      setFetching(false);
      return;
    }
    const rolesByUser = new Map<string, AppRole[]>();
    (roleRows as RoleRow[] | null)?.forEach((r) => {
      const arr = rolesByUser.get(r.user_id) ?? [];
      arr.push(r.role);
      rolesByUser.set(r.user_id, arr);
    });
    const enriched: EnrichedUser[] = (profiles as ProfileRow[] | null ?? []).map((p) => ({
      ...p,
      roles: rolesByUser.get(p.id) ?? [],
    }));
    setUsers(enriched);
    setFetching(false);
  };

  useEffect(() => {
    if (!isAdmin) return;
    void loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) =>
      [u.full_name, u.customer_number, u.phone, u.region]
        .filter(Boolean)
        .some((v) => (v as string).toLowerCase().includes(q))
    );
  }, [users, search]);

  const toggleRole = async (target: EnrichedUser, role: AppRole, currentlyHas: boolean) => {
    // Guardrail: don't let an admin remove their own admin role
    if (target.id === user?.id && role === "admin" && currentlyHas) {
      toast.error(am ? "የራስዎን የአስተዳዳሪ ሚና ማንሳት አይችሉም" : "You can't remove your own admin role");
      return;
    }
    setPendingId(target.id + role);
    if (currentlyHas) {
      const { error } = await supabase.from("user_roles").delete().eq("user_id", target.id).eq("role", role);
      if (error) {
        toast.error(am ? "ሚና ማንሳት አልተሳካም" : "Failed to remove role");
        setPendingId(null);
        return;
      }
      setUsers((prev) => prev.map((u) => (u.id === target.id ? { ...u, roles: u.roles.filter((r) => r !== role) } : u)));
      toast.success(am ? "ሚና ተወግዷል" : `Removed ${ROLE_META[role].en}`);
    } else {
      const { error } = await supabase.from("user_roles").insert({ user_id: target.id, role });
      if (error) {
        toast.error(am ? "ሚና መመደብ አልተሳካም" : "Failed to assign role");
        setPendingId(null);
        return;
      }
      setUsers((prev) => prev.map((u) => (u.id === target.id ? { ...u, roles: [...u.roles, role] } : u)));
      toast.success(am ? "ሚና ተመድቧል" : `Granted ${ROLE_META[role].en}`);
    }
    setPendingId(null);
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-1">
        <h1 className={cn("text-3xl font-bold tracking-tight", am && "font-ethiopic")}>
          {am ? "ደንበኞች እና ሚናዎች" : "Customers & Roles"}
        </h1>
        <p className={cn("text-muted-foreground", am && "font-ethiopic")}>
          {am ? "ሁሉንም ተጠቃሚዎች ይመልከቱ፣ ይፈልጉ እና ሚናዎችን ያስተዳድሩ።" : "View, search, and manage roles for every user in the system."}
        </p>
      </div>

      <div className="mt-6 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={am ? "በስም፣ በደንበኛ ቁጥር ወይም በስልክ ይፈልጉ…" : "Search by name, customer #, phone…"}
            className={cn("pl-9", am && "font-ethiopic")}
          />
        </div>
        <div className="text-sm text-muted-foreground">
          {am ? `${filtered.length} ተጠቃሚዎች` : `${filtered.length} users`}
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-card overflow-hidden">
        {fetching ? (
          <div className="p-12 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className={cn("p-12 text-center text-muted-foreground", am && "font-ethiopic")}>
            {am ? "ምንም ተጠቃሚ አልተገኘም" : "No users found"}
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {filtered.map((u) => (
              <li key={u.id} className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center gap-4">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-primary-foreground font-semibold shrink-0">
                    {(u.full_name?.[0] ?? u.customer_number?.[4] ?? "?").toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={cn("font-semibold truncate", am && "font-ethiopic")}>
                        {u.full_name || (am ? "ስም የለም" : "No name")}
                      </span>
                      {u.id === user?.id && (
                        <Badge variant="outline" className="text-xs">
                          {am ? "እርስዎ" : "You"}
                        </Badge>
                      )}
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                      {u.customer_number && <span className="font-mono">{u.customer_number}</span>}
                      {u.phone && <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{u.phone}</span>}
                      {u.region && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{u.region}</span>}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {u.roles.length === 0 && (
                        <Badge variant="outline" className="text-xs text-muted-foreground">
                          {am ? "ምንም ሚና የለም" : "No roles"}
                        </Badge>
                      )}
                      {u.roles.map((r) => {
                        const meta = ROLE_META[r];
                        const Icon = meta.icon;
                        return (
                          <span key={r} className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium", meta.tone, am && "font-ethiopic")}>
                            <Icon className="h-3 w-3" />
                            {am ? meta.am : meta.en}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 lg:justify-end shrink-0">
                  {ALL_ROLES.map((role) => {
                    const has = u.roles.includes(role);
                    const meta = ROLE_META[role];
                    const Icon = meta.icon;
                    const isPending = pendingId === u.id + role;
                    return (
                      <Button
                        key={role}
                        size="sm"
                        variant={has ? "default" : "outline"}
                        disabled={isPending}
                        onClick={() => toggleRole(u, role, has)}
                        className={cn("h-8", am && "font-ethiopic")}
                      >
                        {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Icon className="h-3.5 w-3.5" />}
                        <span className="ml-1.5">{has ? (am ? "አንሳ" : "Revoke") : (am ? "ስጥ" : "Grant")} · {am ? meta.am : meta.en}</span>
                      </Button>
                    );
                  })}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </DashboardLayout>
  );
};

export default AdminCustomers;