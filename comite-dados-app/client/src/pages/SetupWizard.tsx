/**
 * SetupWizard.tsx
 * Assistente de configuração inicial da organização (white-label).
 * Exibido em /setup — acessível apenas para admins.
 *
 * Passos:
 *   1. Nome da organização / nome do app
 *   2. Identidade visual (logo, favicon, cores)
 *   3. Contato e suporte
 *   4. Revisão + Salvar
 */
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Building2, Palette, Mail, CheckCircle2, ChevronRight, ChevronLeft, Upload, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useBrand } from "@/contexts/BrandContext";
import { useLocation } from "wouter";

// ─── Tipos ───────────────────────────────────────────────────────────────────
interface WizardState {
  orgName: string;
  appName: string;
  logoUrl: string;
  faviconUrl: string;
  primaryColor: string;
  secondaryColor: string;
  customCss: string;
  supportEmail: string;
}

// ─── Validação por passo ──────────────────────────────────────────────────────
function isStepValid(step: number, s: WizardState): boolean {
  if (step === 0) return s.orgName.trim().length >= 2 && s.appName.trim().length >= 2;
  if (step === 1) return /^#[0-9a-fA-F]{6}$/.test(s.primaryColor) && /^#[0-9a-fA-F]{6}$/.test(s.secondaryColor);
  if (step === 2) return !s.supportEmail || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.supportEmail);
  return true;
}

// ─── Componente ───────────────────────────────────────────────────────────────
export default function SetupWizard() {
  const [step, setStep] = useState(0);
  const [state, setState] = useState<WizardState>({
    orgName: "",
    appName: "Portal de Governança de Dados",
    logoUrl: "",
    faviconUrl: "",
    primaryColor: "#1B3A8C",
    secondaryColor: "#6DC23A",
    customCss: "",
    supportEmail: "",
  });

  const { primaryColor } = useBrand();
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();

  const orgsQuery = trpc.organizations.list.useQuery();
  const updateOrg = trpc.organizations.update.useMutation({
    onSuccess: () => {
      utils.organizations.list.invalidate();
      toast.success("Configurações salvas com sucesso!");
      navigate("/");
    },
    onError: (err) => toast.error(err.message),
  });

  function set(key: keyof WizardState, val: string) {
    setState((s) => ({ ...s, [key]: val }));
  }

  async function finish() {
    const orgs = orgsQuery.data ?? [];
    const firstOrg = orgs[0];
    if (!firstOrg) {
      toast.error("Nenhuma organização encontrada.");
      return;
    }
    await updateOrg.mutateAsync({
      id: firstOrg.id,
      name: state.orgName,
      appName: state.appName,
      logoUrl: state.logoUrl || undefined,
      faviconUrl: state.faviconUrl || undefined,
      primaryColor: state.primaryColor,
      secondaryColor: state.secondaryColor,
      customCss: state.customCss || undefined,
      supportEmail: (state.supportEmail as `${string}@${string}.${string}`) || undefined,
    });
  }

  const steps = [
    { label: "Identidade", icon: <Building2 size={18} /> },
    { label: "Visual", icon: <Palette size={18} /> },
    { label: "Suporte", icon: <Mail size={18} /> },
    { label: "Revisão", icon: <Eye size={18} /> },
  ];

  const isLast = step === steps.length - 1;
  const valid = isStepValid(step, state);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-xl w-full overflow-hidden">
        {/* Header */}
        <div
          className="px-8 py-6 text-white"
          style={{ background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}CC)` }}
        >
          <h1 className="text-xl font-bold">Configuração Inicial</h1>
          <p className="text-white/70 text-sm mt-1">Personalize o portal para a sua organização</p>
        </div>

        {/* Steps indicator */}
        <div className="flex border-b">
          {steps.map((s, i) => (
            <button
              key={s.label}
              onClick={() => i < step && setStep(i)}
              className={`flex-1 py-3 flex flex-col items-center gap-1 text-xs font-medium transition-colors ${
                i === step ? "text-blue-700 border-b-2 border-blue-700" : i < step ? "text-green-600" : "text-gray-400"
              }`}
            >
              {i < step ? <CheckCircle2 size={16} className="text-green-600" /> : s.icon}
              {s.label}
            </button>
          ))}
        </div>

        {/* Form */}
        <div className="px-8 py-7 min-h-[300px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="space-y-5"
            >
              {/* Passo 0: Identidade */}
              {step === 0 && (
                <>
                  <div>
                    <Label htmlFor="orgName">Nome da Organização *</Label>
                    <Input
                      id="orgName"
                      value={state.orgName}
                      onChange={(e) => set("orgName", e.target.value)}
                      placeholder="Ex: Acme Corporation"
                      className="mt-1"
                    />
                    <p className="text-xs text-gray-500 mt-1">Nome legal da empresa.</p>
                  </div>
                  <div>
                    <Label htmlFor="appName">Nome do Portal *</Label>
                    <Input
                      id="appName"
                      value={state.appName}
                      onChange={(e) => set("appName", e.target.value)}
                      placeholder="Ex: Acme Data Hub"
                      className="mt-1"
                    />
                    <p className="text-xs text-gray-500 mt-1">Aparece no título do navegador e no header.</p>
                  </div>
                </>
              )}

              {/* Passo 1: Visual */}
              {step === 1 && (
                <>
                  <div>
                    <Label htmlFor="logoUrl">URL do Logo</Label>
                    <div className="flex gap-2 mt-1">
                      <Input
                        id="logoUrl"
                        value={state.logoUrl}
                        onChange={(e) => set("logoUrl", e.target.value)}
                        placeholder="https://cdn.exemplo.com/logo.png"
                      />
                      <Upload size={16} className="self-center text-gray-400 shrink-0" />
                    </div>
                    {state.logoUrl && (
                      <img src={state.logoUrl} alt="preview" className="mt-2 h-10 object-contain" />
                    )}
                  </div>
                  <div>
                    <Label htmlFor="faviconUrl">URL do Favicon</Label>
                    <Input
                      id="faviconUrl"
                      value={state.faviconUrl}
                      onChange={(e) => set("faviconUrl", e.target.value)}
                      placeholder="https://cdn.exemplo.com/favicon.ico"
                      className="mt-1"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="primaryColor">Cor Primária *</Label>
                      <div className="flex gap-2 mt-1">
                        <input
                          type="color"
                          id="primaryColor"
                          value={state.primaryColor}
                          onChange={(e) => set("primaryColor", e.target.value)}
                          className="h-9 w-12 rounded border cursor-pointer"
                        />
                        <Input
                          value={state.primaryColor}
                          onChange={(e) => set("primaryColor", e.target.value)}
                          placeholder="#1B3A8C"
                          className="font-mono text-sm"
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="secondaryColor">Cor Secundária *</Label>
                      <div className="flex gap-2 mt-1">
                        <input
                          type="color"
                          id="secondaryColor"
                          value={state.secondaryColor}
                          onChange={(e) => set("secondaryColor", e.target.value)}
                          className="h-9 w-12 rounded border cursor-pointer"
                        />
                        <Input
                          value={state.secondaryColor}
                          onChange={(e) => set("secondaryColor", e.target.value)}
                          placeholder="#6DC23A"
                          className="font-mono text-sm"
                        />
                      </div>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="customCss">CSS Personalizado <span className="text-gray-400 font-normal">(opcional)</span></Label>
                    <Textarea
                      id="customCss"
                      value={state.customCss}
                      onChange={(e) => set("customCss", e.target.value)}
                      placeholder=":root { --brand-primary: #1B3A8C; }"
                      rows={3}
                      className="mt-1 font-mono text-xs"
                    />
                  </div>
                </>
              )}

              {/* Passo 2: Suporte */}
              {step === 2 && (
                <>
                  <div>
                    <Label htmlFor="supportEmail">E-mail de Suporte</Label>
                    <Input
                      id="supportEmail"
                      type="email"
                      value={state.supportEmail}
                      onChange={(e) => set("supportEmail", e.target.value)}
                      placeholder="suporte@empresa.com"
                      className="mt-1"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Mostrado aos usuários quando precisam de ajuda.
                    </p>
                  </div>
                </>
              )}

              {/* Passo 3: Revisão */}
              {step === 3 && (
                <div className="space-y-3">
                  <h3 className="font-semibold text-gray-800">Revise as configurações</h3>
                  {[
                    ["Organização", state.orgName],
                    ["Nome do Portal", state.appName],
                    ["Logo URL", state.logoUrl || "—"],
                    ["Cor Primária", state.primaryColor],
                    ["Cor Secundária", state.secondaryColor],
                    ["E-mail de Suporte", state.supportEmail || "—"],
                  ].map(([label, val]) => (
                    <div key={label} className="flex justify-between text-sm py-2 border-b last:border-0">
                      <span className="text-gray-500">{label}</span>
                      <span className="font-medium text-gray-800 flex items-center gap-2">
                        {label.includes("Cor") && (
                          <span
                            className="w-4 h-4 rounded-full border"
                            style={{ background: val as string }}
                          />
                        )}
                        {val}
                      </span>
                    </div>
                  ))}
                  <div
                    className="mt-4 rounded-lg px-4 py-3 text-xs"
                    style={{ background: `${primaryColor}15`, color: primaryColor }}
                  >
                    Estas configurações podem ser alteradas a qualquer momento em Configurações → Organização.
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="px-8 pb-7 flex justify-between gap-3">
          <Button
            variant="outline"
            onClick={() => step > 0 ? setStep(s => s - 1) : navigate("/")}
          >
            <ChevronLeft size={16} className="mr-1" />
            {step === 0 ? "Cancelar" : "Anterior"}
          </Button>

          {isLast ? (
            <Button
              onClick={finish}
              disabled={updateOrg.isPending}
              style={{ background: primaryColor }}
              className="text-white hover:opacity-90"
            >
              {updateOrg.isPending ? "Salvando..." : (
                <>
                  <CheckCircle2 size={14} className="mr-1" />
                  Salvar Configurações
                </>
              )}
            </Button>
          ) : (
            <Button
              onClick={() => setStep(s => s + 1)}
              disabled={!valid}
              style={{ background: valid ? primaryColor : undefined }}
              className={valid ? "text-white hover:opacity-90" : ""}
            >
              Próximo
              <ChevronRight size={16} className="ml-1" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
