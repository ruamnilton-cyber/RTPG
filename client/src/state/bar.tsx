import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { apiRequest } from "../lib/api";
import { getStoredBarId, setStoredBarId } from "../lib/bar-storage";
import { useAuth } from "./auth";

export type BarRow = {
  id: string;
  name: string;
  code: string;
  active: boolean;
  city: string;
};

type BarContextValue = {
  bars: BarRow[];
  activeBarId: string | null;
  setActiveBarId: (id: string) => void;
  refreshBars: () => Promise<void>;
};

const BarContext = createContext<BarContextValue | null>(null);

export function BarProvider({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  const [bars, setBars] = useState<BarRow[]>([]);
  const [activeBarId, setActiveState] = useState<string | null>(() => getStoredBarId());

  const refreshBars = useCallback(async () => {
    if (!token) {
      setBars([]);
      return;
    }
    try {
      const list = await apiRequest<BarRow[]>("/bars", { token });
      setBars(list);
      const cur = getStoredBarId();
      if ((!cur || !list.some((b) => b.id === cur)) && list[0]) {
        setStoredBarId(list[0].id);
        setActiveState(list[0].id);
      } else {
        setActiveState(cur);
      }
    } catch {
      setBars([]);
    }
  }, [token]);

  useEffect(() => {
    refreshBars();
  }, [refreshBars]);

  const setActiveBarId = (id: string) => {
    setStoredBarId(id);
    setActiveState(id);
  };

  const value = useMemo(
    () => ({ bars, activeBarId, setActiveBarId, refreshBars }),
    [bars, activeBarId, refreshBars]
  );

  return <BarContext.Provider value={value}>{children}</BarContext.Provider>;
}

export function useBar() {
  const ctx = useContext(BarContext);
  if (!ctx) {
    throw new Error("useBar deve ser usado dentro de BarProvider");
  }
  return ctx;
}
