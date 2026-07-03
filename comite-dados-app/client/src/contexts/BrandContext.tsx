import { createContext, useContext, useEffect, ReactNode } from "react";
import { trpc } from "@/lib/trpc";

// ─── Default brand (neutro para white-label) ──────────────────────────────────
const DEFAULT_PRIMARY   = "#1B3A8C";
const DEFAULT_SECONDARY = "#6DC23A";
const DEFAULT_APP_NAME  = "Lucid Data Governance";

// Converte hex → HSL string para shadcn
function hexToHsl(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

function applyBrand(
  primaryHex: string,
  secondaryHex: string,
  logoUrl?: string | null,
  faviconUrl?: string | null,
  customCss?: string | null,
  appName?: string | null,
) {
  const root = document.documentElement;
  try {
    const primaryHsl = hexToHsl(primaryHex);
    root.style.setProperty("--primary", primaryHsl);
    root.style.setProperty("--ring", primaryHsl);
    root.style.setProperty("--brand-primary", primaryHex);
    root.style.setProperty("--brand-secondary", secondaryHex);
    root.style.setProperty("--brand-logo", logoUrl ? `url(${logoUrl})` : "none");
  } catch { /* hex inválido */ }

  // Favicon dinâmico
  if (faviconUrl) {
    let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
    if (!link) { link = document.createElement("link"); link.rel = "icon"; document.head.appendChild(link); }
    link.href = faviconUrl;
  }

  // CSS customizado injetado (white-label avançado)
  const styleId = "__brand_custom_css";
  let styleEl = document.getElementById(styleId) as HTMLStyleElement | null;
  if (customCss) {
    if (!styleEl) { styleEl = document.createElement("style"); styleEl.id = styleId; document.head.appendChild(styleEl); }
    styleEl.textContent = customCss;
  } else if (styleEl) {
    styleEl.remove();
  }

  // Título do documento
  if (appName) document.title = appName;
}

export interface BrandContext {
  primaryColor: string;
  secondaryColor: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  appName: string;
  orgName: string;
  supportEmail: string | null;
  customCss: string | null;
  plan: string;
}

const BrandCtx = createContext<BrandContext>({
  primaryColor: DEFAULT_PRIMARY,
  secondaryColor: DEFAULT_SECONDARY,
  logoUrl: null,
  faviconUrl: null,
  appName: DEFAULT_APP_NAME,
  orgName: "Lucid Data Governance",
  supportEmail: null,
  customCss: null,
  plan: "professional",
});

export function useBrand() {
  return useContext(BrandCtx);
}

export function BrandProvider({ children }: { children: ReactNode }) {
  const { data: orgs } = trpc.organizations.list.useQuery(undefined, {
    staleTime: 5 * 60 * 1000, // 5 min
  });

  // Usa a primeira organização ativa como identidade visual
  const org = orgs?.find((o: any) => o.active) ?? orgs?.[0];

  const primaryColor   = org?.primaryColor   ?? DEFAULT_PRIMARY;
  const secondaryColor = org?.secondaryColor ?? DEFAULT_SECONDARY;
  const logoUrl        = org?.logoUrl        ?? null;
  const faviconUrl     = org?.faviconUrl     ?? null;
  const appName        = org?.appName        ?? DEFAULT_APP_NAME;
  const orgName        = org?.name           ?? "Lucid Data Governance";
  const supportEmail   = org?.supportEmail   ?? null;
  const customCss      = org?.customCss      ?? null;
  const plan           = org?.plan           ?? "professional";

  useEffect(() => {
    applyBrand(primaryColor, secondaryColor, logoUrl, faviconUrl, customCss, appName);
  }, [primaryColor, secondaryColor, logoUrl, faviconUrl, customCss, appName]);

  return (
    <BrandCtx.Provider value={{ primaryColor, secondaryColor, logoUrl, faviconUrl, appName, orgName, supportEmail, customCss, plan }}>
      {children}
    </BrandCtx.Provider>
  );
}
