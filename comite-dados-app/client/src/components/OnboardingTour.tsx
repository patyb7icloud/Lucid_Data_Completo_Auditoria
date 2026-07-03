/**
 * OnboardingTour.tsx
 * Tour guiado de primeiro acesso para novos usuários.
 * Usa Framer Motion para animações suaves e armazena progresso no localStorage.
 *
 * Uso: <OnboardingTour /> dentro do AuthenticatedApp
 * O tour aparece automaticamente na primeira vez que o usuário loga.
 * Pode ser reiniciado via: localStorage.removeItem("onboarding_completed")
 */
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronRight, ChevronLeft, CheckCircle2, BookOpen, ShieldCheck, Library, BookText, BarChart3, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBrand } from "@/contexts/BrandContext";

const STORAGE_KEY = "onboarding_completed_v2";

interface TourStep {
  id: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  highlight?: string;
  emoji: string;
}

const STEPS: TourStep[] = [
  {
    id: "welcome",
    emoji: "👋",
    icon: <Sparkles className="w-8 h-8" />,
    title: "Bem-vindo ao Lucid Data Governance",
    description: "Este é o hub central de governança de dados da sua organização. Aqui você gerencia ativos, qualidade, conformidade LGPD e muito mais.",
    highlight: "Leva apenas 2 minutos para explorar os principais recursos.",
  },
  {
    id: "catalog",
    emoji: "📚",
    icon: <Library className="w-8 h-8" />,
    title: "Catálogo de Dados",
    description: "Descubra todos os ativos de dados da organização — tabelas, APIs, dashboards e arquivos. Use a busca semântica para encontrar o que precisa rapidamente.",
    highlight: "Dica: a busca entende sinônimos técnicos como CPF → 'PII' ou 'cliente' → 'KNA1'.",
  },
  {
    id: "quality",
    emoji: "📊",
    icon: <BarChart3 className="w-8 h-8" />,
    title: "Qualidade de Dados",
    description: "Monitore regras de qualidade em tempo real: completude, acurácia, consistência e conformidade. Receba alertas automáticos quando regras forem violadas.",
    highlight: "SLAs de qualidade são calculados e monitorados automaticamente.",
  },
  {
    id: "lgpd",
    emoji: "🔒",
    icon: <ShieldCheck className="w-8 h-8" />,
    title: "Conformidade LGPD",
    description: "Rastreie dados pessoais (PII), gerencie consentimentos, execute DSARs e gere relatórios de impacto (PIA). O scanner automático identifica dados sensíveis.",
    highlight: "Integrado com as 10 categorias de PII definidas pela LGPD brasileira.",
  },
  {
    id: "glossary",
    emoji: "📖",
    icon: <BookText className="w-8 h-8" />,
    title: "Glossário de Negócios",
    description: "Mantenha um vocabulário único e compartilhado entre TI e negócios. Defina termos, regras de negócio e vincule ao catálogo de dados.",
    highlight: "Evita ambiguidade e melhora a comunicação entre equipes.",
  },
  {
    id: "lineage",
    emoji: "🔗",
    icon: <BookOpen className="w-8 h-8" />,
    title: "Linhagem de Dados",
    description: "Visualize como os dados fluem entre sistemas — de fontes como SAP e Snowflake até dashboards. Identifique impactos antes de fazer mudanças.",
    highlight: "Suporta linhagem a nível de coluna para análises detalhadas.",
  },
  {
    id: "done",
    emoji: "🎉",
    icon: <CheckCircle2 className="w-8 h-8" />,
    title: "Você está pronto!",
    description: "Explore o portal pelo menu lateral. Se precisar de ajuda, acesse o Assistente IA ou a documentação em Ajuda.",
    highlight: "Obrigado por usar o Lucid Data Governance!",
  },
];

export function OnboardingTour() {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);
  const { primaryColor, appName } = useBrand();

  useEffect(() => {
    // Mostrar apenas se nunca completou o tour
    const completed = localStorage.getItem(STORAGE_KEY);
    if (!completed) {
      // Pequeno delay para não competir com o carregamento inicial
      const timer = setTimeout(() => setVisible(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  function complete() {
    localStorage.setItem(STORAGE_KEY, "true");
    setVisible(false);
  }

  function next() {
    if (step < STEPS.length - 1) {
      setStep((s) => s + 1);
    } else {
      complete();
    }
  }

  function prev() {
    if (step > 0) setStep((s) => s - 1);
  }

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const progress = ((step + 1) / STEPS.length) * 100;

  return (
    <AnimatePresence>
      {visible && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm"
            onClick={complete}
          />

          {/* Modal */}
          <motion.div
            key="modal"
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: "spring", damping: 20, stiffness: 300 }}
            className="fixed inset-0 flex items-center justify-center z-50 p-4"
          >
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
              {/* Header colorido */}
              <div
                className="px-6 py-8 text-white relative"
                style={{ background: `linear-gradient(135deg, ${primaryColor} 0%, ${adjustColor(primaryColor, -30)} 100%)` }}
              >
                <button
                  onClick={complete}
                  className="absolute top-4 right-4 text-white/60 hover:text-white transition-colors"
                  aria-label="Fechar tour"
                >
                  <X size={18} />
                </button>

                <AnimatePresence mode="wait">
                  <motion.div
                    key={current.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="text-4xl mb-3">{current.emoji}</div>
                    <div className="text-white/70 mb-1">{appName}</div>
                    <h2 className="text-xl font-bold leading-tight">{current.title}</h2>
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Barra de progresso */}
              <div className="h-1 bg-gray-100">
                <motion.div
                  className="h-full transition-all duration-500"
                  style={{ width: `${progress}%`, background: primaryColor }}
                />
              </div>

              {/* Conteúdo */}
              <div className="px-6 py-6">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={current.id + "_body"}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.2 }}
                  >
                    <p className="text-gray-600 text-sm leading-relaxed mb-4">
                      {current.description}
                    </p>
                    {current.highlight && (
                      <div
                        className="rounded-lg px-4 py-3 text-xs font-medium"
                        style={{ background: `${primaryColor}15`, color: primaryColor }}
                      >
                        💡 {current.highlight}
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>

                {/* Indicadores de passo */}
                <div className="flex items-center justify-center gap-1.5 mt-5 mb-2">
                  {STEPS.map((s, i) => (
                    <button
                      key={s.id}
                      onClick={() => setStep(i)}
                      className="rounded-full transition-all"
                      style={{
                        width: i === step ? 20 : 8,
                        height: 8,
                        background: i === step ? primaryColor : i < step ? `${primaryColor}60` : "#E2E8F0",
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Footer / Navegação */}
              <div className="px-6 pb-6 flex items-center justify-between gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={prev}
                  disabled={step === 0}
                  className="text-gray-400"
                >
                  <ChevronLeft size={16} className="mr-1" />
                  Anterior
                </Button>

                <button
                  onClick={complete}
                  className="text-xs text-gray-400 hover:text-gray-600 underline underline-offset-2 transition-colors"
                >
                  Pular tour
                </button>

                <Button
                  size="sm"
                  onClick={next}
                  style={{ background: primaryColor }}
                  className="text-white hover:opacity-90"
                >
                  {isLast ? (
                    <>
                      <CheckCircle2 size={14} className="mr-1" />
                      Concluir
                    </>
                  ) : (
                    <>
                      Próximo
                      <ChevronRight size={16} className="ml-1" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/** Utilitário local de ajuste de cor */
function adjustColor(hex: string, amount: number): string {
  const c = (v: number) => Math.max(0, Math.min(255, v));
  const h = hex.replace("#", "");
  const r = c(parseInt(h.slice(0, 2), 16) + amount);
  const g = c(parseInt(h.slice(2, 4), 16) + amount);
  const b = c(parseInt(h.slice(4, 6), 16) + amount);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

export default OnboardingTour;
