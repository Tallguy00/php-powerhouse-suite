import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

export type AppRole = "admin" | "technician" | "customer";

interface AuthContextValue {
  user: User | null;
  roles: AppRole[];
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  // 🔒 Fetch roles ONCE
  const fetchRoles = async (userId: string) => {
    const { data, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    if (error) return [];
    return data.map((r) => r.role as AppRole);
  };

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      setLoading(true);

      const { data } = await supabase.auth.getSession();
      const session = data.session;

      if (!session?.user) {
        if (mounted) {
          setUser(null);
          setRoles([]);
          setLoading(false);
        }
        return;
      }

      // ✅ Fetch roles BEFORE setting user
      const roles = await fetchRoles(session.user.id);

      if (!mounted) return;

      setUser(session.user);
      setRoles(roles);
      setLoading(false);
    };

    init();

    // 🔒 Listen ONLY for login/logout
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") {
        init();
      }
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setRoles([]);
  };

  return (
    <AuthContext.Provider value={{ user, roles, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};