import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { apiRequest } from "../lib/api";
import { clearStoredBarId } from "../lib/bar-storage";
import { AppRole } from "../lib/roles";

type User = {
  id: string;
  name: string;
  email: string;
  role: AppRole;
};

type AuthContextValue = {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (payload: { name: string; email: string; password: string; role: AppRole }) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const STORAGE_KEY = "rtpg_auth";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      setLoading(false);
      return;
    }

    const stored = JSON.parse(raw) as { token: string; user: User };
    setToken(stored.token);
    setUser(stored.user);
    apiRequest<User>("/auth/me", { token: stored.token })
      .then((profile) => setUser(profile))
      .catch(() => {
        localStorage.removeItem(STORAGE_KEY);
        setToken(null);
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  async function login(email: string, password: string) {
    const result = await apiRequest<{ token: string; user: User }>("/auth/login", {
      method: "POST",
      body: { email, password }
    });

    setToken(result.token);
    setUser(result.user);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(result));
    return result.user;
  }

  async function register(payload: { name: string; email: string; password: string; role: AppRole }) {
    await apiRequest("/auth/register", { method: "POST", body: payload });
  }

  function logout() {
    localStorage.removeItem(STORAGE_KEY);
    clearStoredBarId();
    setToken(null);
    setUser(null);
  }

  const value = useMemo(() => ({ user, token, loading, login, register, logout }), [user, token, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth deve ser usado dentro de AuthProvider");
  }
  return context;
}
