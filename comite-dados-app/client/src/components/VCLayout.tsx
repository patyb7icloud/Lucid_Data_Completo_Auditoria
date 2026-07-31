import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import Login from "@/pages/Login";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  LayoutDashboard, Users, CalendarDays, GitBranch,
  Table2, CheckSquare, Bot, Ticket, LogOut, Menu, X,
  ChevronRight, Bell, History, UserCog, Settings2, MessageSquare,
  Library, BookText, Network, ShieldCheck, Lock, HelpCircle, ClipboardCheck,
  BookOpen, ShieldAlert, TrendingUp, Gauge, Zap, Globe, FileText, UserCheck, Activity, Store, Inbox, Tag, Shield, Layers, Plug,
  BrainCircuit, AlertTriangle, PlugZap, BarChart2, FolderKanban
} from "lucide-react";
import { useI18n } from "@/contexts/I18nContext";
import { LOCALES, type Locale } from "@/lib/i18n";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useBrand } from "@/contexts/BrandContext";

const navGroups = [
  {
    // Visão Executiva
    labelKey: "nav.group.strategic",
    items: [
      { href: "/", icon: LayoutDashboard, labelKey: "nav.governance" },
      { href: "/maturidade", icon: TrendingUp, labelKey: "nav.maturity" },
      { href: "/implantacao", icon: CheckSquare, labelKey: "nav.checklist" },
    ]
  },
  {
    // Descoberta & Catálogo
    labelKey: "nav.group.catalog",
    items: [
      { href: "/catalogo", icon: Library, labelKey: "nav.catalog" },
      { href: "/dicionario-curadoria", icon: BookText, labelKey: "nav.dictionaryCuration" },
      { href: "/linhagem", icon: Network, labelKey: "nav.lineage" },
      { href: "/glossario", icon: BookOpen, labelKey: "nav.glossary" },
    ]
  },
  {
    // Privacidade & Segurança
    labelKey: "nav.group.privacy",
    items: [
      { href: "/portal-lgpd", icon: Shield, labelKey: "nav.portalLgpd" },
      { href: "/autonomia-tiers", icon: Layers, labelKey: "nav.autonomiaTiers" },
    ]
  },
  {
    // Operação & Qualidade
    labelKey: "nav.group.quality",
    items: [
      { href: "/qualidade-sla", icon: ShieldCheck, labelKey: "nav.qualitySla" },
      { href: "/demandas", icon: Inbox, labelKey: "nav.demands" },
      { href: "/aprovacoes", icon: ClipboardCheck, labelKey: "nav.approvals" },
      { href: "/reunioes", icon: CalendarDays, labelKey: "nav.meetings" },
      { href: "/notificacoes", icon: Bell, labelKey: "nav.notifications" },
      { href: "/exportacoes", icon: History, labelKey: "nav.exports" },
    ]
  },
  {
    // Organização do Comitê
    labelKey: "nav.group.committee",
    items: [
      { href: "/organizacao", icon: Users, labelKey: "nav.organization" },
    ]
  },
  {
    // IA & MLOps (Lacunas Lucid Data Governance)
    labelKey: "nav.group.ai_mlops",
    items: [
      { href: "/mlops", icon: BrainCircuit, labelKey: "nav.mlops" },
      { href: "/riscos-ia", icon: AlertTriangle, labelKey: "nav.aiRisk" },
      { href: "/ai-governance", icon: BrainCircuit, labelKey: "nav.aiGovernance" },
      { href: "/llmops", icon: Bot, labelKey: "nav.llmops" },
      { href: "/portfolio", icon: FolderKanban, labelKey: "nav.portfolio" },
      { href: "/bi-conectores", icon: PlugZap, labelKey: "nav.biConnectors" },
    ]
  },
  {
    // HUB AI & Data (Nexa Playbook)
    labelKey: "nav.group.hub",
    items: [
      { href: "/hub", icon: BarChart2, labelKey: "nav.hubDashboard" },
    ]
  },
  {
    // Auditoria & Compliance (Integrado)
    labelKey: "nav.group.auditoria",
    items: [
      { href: "/auditoria", icon: ShieldCheck, labelKey: "nav.auditoriaDashboard" },
      { href: "/auditoria/audit", icon: ClipboardCheck, labelKey: "nav.auditoriaNova" },
      { href: "/auditoria/history", icon: History, labelKey: "nav.auditoriaHistorico" },
      { href: "/auditoria/compliance", icon: ShieldAlert, labelKey: "nav.auditoriaCompliance" },
    ]
  },
{
    // Configurações & Sistema
    labelKey: "nav.group.system",
    items: [
      { href: "/assistente-ia", icon: Bot, labelKey: "nav.aiAssistant" },
      { href: "/integracoes-conectores", icon: Plug, labelKey: "nav.integrationsConnectors" },
      { href: "/audit-log", icon: ShieldAlert, labelKey: "nav.auditLog" },
    ]
  },
];

/** Escurece/clarea um hex color por uma quantidade de luminosidade (-100 a +100) */
function adjustColorBrightness(hex: string, amount: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, v));
  const h = hex.replace("#", "");
  const r = clamp(parseInt(h.substring(0, 2), 16) + amount);
  const g = clamp(parseInt(h.substring(2, 4), 16) + amount);
  const b = clamp(parseInt(h.substring(4, 6), 16) + amount);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

interface VCLayoutProps {
  children: React.ReactNode;
}

export default function VCLayout({ children }: VCLayoutProps) {
  const [location] = useLocation();
  const { user, isAuthenticated, loading, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { locale, setLocale, t } = useI18n();
  const { logoUrl, appName, primaryColor } = useBrand();

  // Gradiente dinâmico baseado na cor primária do white-label
  const sidebarStyle = {
    background: `linear-gradient(180deg, ${primaryColor} 0%, ${adjustColorBrightness(primaryColor, -30)} 100%)`,
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <img src={logoUrl ?? "/lucid-logo.png"} alt={appName} className="h-16 mx-auto mb-4 object-contain" />
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-700 mx-auto"></div>
          <p className="mt-3 text-sm text-gray-500">{t("ui.loading")}</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login onSuccess={() => window.location.reload()} />;
  }

  const initials = user?.name?.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() ?? 'VC';

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-30 w-64 flex flex-col
        transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `} style={sidebarStyle}>

        {/* Logo */}
        <div className="flex items-center justify-between px-5 py-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <img src={logoUrl ?? "/lucid-logo.png"} alt={appName} className="h-8 object-contain brightness-0 invert" />
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-white/70 hover:text-white">
            <X size={20} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 space-y-6 overflow-y-auto pt-4 pb-8 custom-scrollbar">
          {navGroups.map((group) => {
            // Filtragem de grupos por papel
            const filteredItems = group.items.filter(item => {
              if (user?.role === 'admin') return true;
              
              if (user?.role === 'data_owner') {
                const allowed = ['/', '/ajuda', '/catalogo', '/dicionario', '/glossario', '/linhagem', '/qualidade', '/aprovacoes', '/notificacoes'];
                return allowed.includes(item.href);
              }

              if (user?.role === 'data_steward') {
                const allowed = ['/', '/ajuda', '/catalogo', '/dicionario', '/glossario', '/linhagem', '/qualidade', '/compliance', '/reunioes', '/assistente-ia', '/notificacoes', '/aprovacoes'];
                return allowed.includes(item.href);
              }

              if (user?.role === 'data_analyst') {
                const allowed = ['/', '/ajuda', '/catalogo', '/dicionario', '/glossario', '/assistente-ia'];
                return allowed.includes(item.href);
              }

              return ['/', '/ajuda', '/catalogo'].includes(item.href); // Fallback para usuários comuns
            });

            if (filteredItems.length === 0) return null;

            return (
              <div key={group.labelKey} className="space-y-1">
                <p className="px-3 text-[10px] font-bold text-white/30 uppercase tracking-widest mb-2">{t(group.labelKey)}</p>
                {filteredItems.map(({ href, icon: Icon, labelKey }) => {
                  const isActive = location === href || (href !== '/' && href !== '/auditoria' && location.startsWith(href));
                  return (
                    <Link key={href} href={href}>
                      <div
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-all duration-150 group ${
                          isActive
                            ? 'bg-[#6DC23A] text-white shadow-lg shadow-green-900/20'
                            : 'text-white/70 hover:bg-white/10 hover:text-white'
                        }`}
                        onClick={() => setSidebarOpen(false)}
                      >
                        <Icon size={16} className={isActive ? 'text-white' : 'text-white/60 group-hover:text-white'} />
                        <span className="text-sm font-medium">{t(labelKey)}</span>
                        {isActive && <ChevronRight size={12} className="ml-auto text-white/70" />}
                      </div>
                    </Link>
                  );
                })}
              </div>
            );
          })}

          {/* Seção de Administração / Configurações - APENAS ADMIN */}
          {user?.role === 'admin' && (
            <div className="space-y-1 pt-4 border-t border-white/5">
              <p className="px-3 text-[10px] font-bold text-white/30 uppercase tracking-widest mb-2">{t("nav.group.admin")}</p>
              
              <Link href="/gerenciar-papeis">
                <div className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-all duration-150 group ${location === '/gerenciar-papeis' ? 'bg-[#6DC23A] text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'}`}>
                  <UserCog size={16} className="text-white/60 group-hover:text-white" />
                  <span className="text-sm font-medium">{t("nav.roles")}</span>
                </div>
              </Link>

              <Link href="/configuracoes/alertas-tickets">
                <div className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-all duration-150 group ${location === '/configuracoes/alertas-tickets' ? 'bg-[#6DC23A] text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'}`}>
                  <Settings2 size={16} className="text-white/60 group-hover:text-white" />
                  <span className="text-sm font-medium">{t("nav.settings")}</span>
                </div>
              </Link>

              <Link href="/feedback">
                <div className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-all duration-150 group ${location === '/feedback' ? 'bg-[#6DC23A] text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'}`}>
                  <MessageSquare size={16} className="text-white/60 group-hover:text-white" />
                  <span className="text-sm font-medium">{t("nav.feedback")}</span>
                </div>
              </Link>
            </div>
          )}
        </nav>

        {/* User Profile */}
        <div className="p-4 border-t border-white/10">
          <div className="flex items-center gap-3 mb-3">
            <Avatar className="h-9 w-9 bg-[#6DC23A] text-white">
              <AvatarFallback className="bg-[#6DC23A] text-white text-xs font-bold">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user?.name ?? 'Usuário'}</p>
              <p className="text-xs text-white/50 truncate">{user?.email ?? ''}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={logout}
            className="w-full text-white/60 hover:text-white hover:bg-white/10 justify-start gap-2 text-xs"
          >
            <LogOut size={14} />
            {t("ui.logout")}
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="bg-white border-b border-gray-200 px-4 lg:px-6 py-3 flex items-center gap-4 sticky top-0 z-10">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden text-gray-500 hover:text-gray-700"
          >
            <Menu size={20} />
          </button>

          <div className="flex-1">
            <h2 className="text-sm font-semibold text-gray-900" style={{ fontFamily: 'Montserrat, sans-serif' }}>
              {t("ui.header.title")}
            </h2>
          </div>

          <div className="flex items-center gap-3">
            {/* Seletor de idioma */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1 text-gray-500 hover:text-gray-700 text-xs font-medium px-2 py-1 rounded hover:bg-gray-100 transition-colors">
                  <Globe size={15} />
                  <span className="hidden sm:inline">
                    {LOCALES.find(l => l.code === locale)?.flag ?? "🌐"}
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-36">
                {LOCALES.map((l) => (
                  <DropdownMenuItem
                    key={l.code}
                    onClick={() => setLocale(l.code as Locale)}
                    className={locale === l.code ? "font-semibold text-blue-700 bg-blue-50" : ""}
                  >
                    <span className="mr-2">{l.flag}</span>
                    {l.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <button className="relative text-gray-400 hover:text-gray-600">
              <Bell size={18} />
              <span className="absolute -top-1 -right-1 h-3.5 w-3.5 bg-[#6DC23A] rounded-full text-[9px] text-white flex items-center justify-center font-bold">3</span>
            </button>
            <div className="h-6 w-px bg-gray-200" />
            <div className="flex items-center gap-2">
              <Avatar className="h-7 w-7">
                <AvatarFallback className="bg-[#1B3A8C] text-white text-xs font-bold">{initials}</AvatarFallback>
              </Avatar>
              <span className="text-sm text-gray-700 font-medium hidden sm:block">{user?.name?.split(' ')[0]}</span>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-4 lg:p-6 pb-20 lg:pb-6">
          {children}
        </main>
      </div>

      {/* ── Mobile Bottom Navigation Bar ─────────────────────────────────── */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-gray-200 flex items-center justify-around h-16 shadow-lg">
        {([
          { href: "/",            icon: LayoutDashboard, labelKey: "nav.governance" },
          { href: "/catalogo",    icon: Library,         labelKey: "nav.catalog" },
          { href: "/aprovacoes",  icon: ClipboardCheck,  labelKey: "nav.approvals" },
          { href: "/notificacoes",icon: Bell,            labelKey: "nav.notifications" },
        ] as const).map(({ href, icon: Icon, labelKey }) => {
          const isActive = location === href || (href !== '/' && location.startsWith(href));
          return (
            <Link key={href} href={href}>
              <div className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-colors ${
                isActive ? 'text-[#1B3A8C]' : 'text-gray-400 hover:text-gray-600'
              }`}>
                <Icon size={20} strokeWidth={isActive ? 2.5 : 1.8} />
                <span className="text-[10px] font-medium leading-none">{t(labelKey)}</span>
              </div>
            </Link>
          );
        })}
        {/* Botão hambúrguer no bottom nav */}
        <button
          onClick={() => setSidebarOpen(true)}
          className="flex flex-col items-center gap-0.5 px-3 py-1 text-gray-400 hover:text-gray-600"
        >
          <Menu size={20} strokeWidth={1.8} />
          <span className="text-[10px] font-medium leading-none">{t("ui.menu")}</span>
        </button>
      </nav>
    </div>
  );
}
