import { createContext, useContext, useEffect, useState } from "react";
import { api } from "@/integrations/Database/api"; // your axios/fetch wrapper

const AuthContext = createContext(undefined);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);

  // 🔒 Get current user from your backend
  const fetchUser = async () => {
    try {
      const res = await api.get("/auth/me"); 
      // expected response: { user: {}, roles: [] }

      setUser(res.data.user);
      setRoles(res.data.roles || []);
    } catch (error) {
      setUser(null);
      setRoles([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUser();
  }, []);

  const signOut = async () => {
    try {
      await api.post("/auth/logout");
    } catch (e) {}

    setUser(null);
    setRoles([]);
  };

  return (
    <AuthContext.Provider value={{ user, roles, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};