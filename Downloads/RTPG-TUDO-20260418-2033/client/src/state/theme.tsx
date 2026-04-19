import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { apiRequest } from "../lib/api";
import { paletteMap, palettes } from "../lib/palettes";
import { useAuth } from "./auth";

type SettingsPayload = {
  theme: { paletteId: string };
  brand: { logoUrl: string | null };
};

type ThemeContextValue = {
  paletteId: string;
  logoUrl: string | null;
  paletteOptions: typeof palettes;
  setPreviewPalette: (paletteId: string) => void;
  savePalette: (paletteId: string) => Promise<void>;
  refreshSettings: () => Promise<void>;
  saveLogo: (payload: { fileName: string; dataUrl: string }) => Promise<void>;
  removeLogo: () => Promise<void>;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function hexToRgb(hex: string) {
  const sanitized = hex.replace("#", "").trim();
  const normalized =
    sanitized.length === 3
      ? sanitized
          .split("")
          .map((char) => char + char)
          .join("")
      : sanitized;

  const value = Number.parseInt(normalized, 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255
  };
}

function relativeLuminance(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  const channel = (value: number) => {
    const normalized = value / 255;
    return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  };

  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrastRatio(background: string, foreground: string) {
  const backgroundLum = relativeLuminance(background);
  const foregroundLum = relativeLuminance(foreground);
  const lighter = Math.max(backgroundLum, foregroundLum);
  const darker = Math.min(backgroundLum, foregroundLum);
  return (lighter + 0.05) / (darker + 0.05);
}

function pickReadableText(background: string) {
  const dark = "#111827";
  const light = "#ffffff";
  return contrastRatio(background, dark) >= contrastRatio(background, light) ? dark : light;
}

function makeMutedText(background: string) {
  const readable = pickReadableText(background);
  return readable === "#ffffff"
    ? "color-mix(in srgb, #ffffff 76%, transparent)"
    : "color-mix(in srgb, #111827 58%, transparent)";
}

function applyPalette(paletteId: string) {
  const palette = paletteMap[paletteId] ?? palettes[0];
  const root = document.documentElement;
  Object.entries(palette.colors).forEach(([key, value]) => {
    root.style.setProperty(`--color-${key}`, value);
  });
  root.style.setProperty("--color-on-primary", pickReadableText(palette.colors.primary));
  root.style.setProperty("--color-on-accent", pickReadableText(palette.colors.accent));
  root.style.setProperty("--color-on-badge", pickReadableText(palette.colors.badge));
  root.style.setProperty("--color-on-menu", pickReadableText(palette.colors.menu));
  root.style.setProperty("--color-menu-muted", makeMutedText(palette.colors.menu));
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  const [paletteId, setPaletteId] = useState("preto-dourado-grafite");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    applyPalette(paletteId);
    localStorage.setItem("rtpg_palette_preview", paletteId);
  }, [paletteId]);

  async function refreshSettings() {
    if (!token) {
      return;
    }
    const settings = await apiRequest<SettingsPayload>("/settings", { token });
    setPaletteId(settings.theme.paletteId || "preto-dourado-grafite");
    setLogoUrl(settings.brand.logoUrl);
  }

  useEffect(() => {
    const preview = localStorage.getItem("rtpg_palette_preview");
    if (preview) {
      setPaletteId(preview);
    }
  }, []);

  useEffect(() => {
    if (token) {
      refreshSettings();
    }
  }, [token]);

  const value = useMemo<ThemeContextValue>(() => ({
    paletteId,
    logoUrl,
    paletteOptions: palettes,
    setPreviewPalette: setPaletteId,
    savePalette: async (nextPaletteId: string) => {
      if (token) {
        await apiRequest("/settings/theme", {
          method: "PUT",
          token,
          body: { paletteId: nextPaletteId }
        });
      }
      setPaletteId(nextPaletteId);
    },
    refreshSettings,
    saveLogo: async (payload) => {
      if (!token) return;
      const result = await apiRequest<{ logoUrl: string }>("/settings/brand/logo", {
        method: "PUT",
        token,
        body: payload
      });
      setLogoUrl(result.logoUrl);
    },
    removeLogo: async () => {
      if (!token) return;
      await apiRequest("/settings/brand/logo", {
        method: "DELETE",
        token
      });
      setLogoUrl(null);
    }
  }), [paletteId, logoUrl, token]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useThemeSettings() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useThemeSettings deve ser usado dentro de ThemeProvider");
  }
  return context;
}
