/**
 * LandingPage.tsx — Página de apresentação comercial da plataforma
 * Acessível em /plataforma (sem autenticação)
 * Ideal para demos, apresentações executivas e proposta de valor
 */
import { Link } from "wouter";
import { motion } from "framer-motion";
import {
  ShieldCheck, Network, BarChart3, FileText, Zap, Globe, Lock,
  CheckCircle2, ArrowRight, Database, Bot, Webhook, Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const LUCID_LOGO = "/lucid-logo.png";

const FEATURES = [
  {
    icon: <Database className="h-6 w-6 text-blue-400" />,
    title: "Catálogo de Dados Inteligente",
    desc: "Descubra, classifique e documente todos os seus ativos de dados com Auto-Discovery via IA que classifica sensibilidade automaticamente.",
  },
  {
    icon: <Network className="h-6 w-6 text-purple-400" />,
    title: "Linhagem & Impacto em Cascata",
    desc: "Visualize o fluxo de dados de ponta a ponta. O Simulador What-if mostra quais sistemas quebrariam antes de qualquer mudança.",
  },
  {
    icon: <ShieldCheck className="h-6 w-6 text-green-400" />,
    title: "Motor de Qualidade Nativo",
    desc: "Regras Regex, Completude e Unicidade executadas contra a fonte real. Alertas de falha propagados via Webhook em tempo real.",
  },
  {
    icon: <FileText className="h-6 w-6 text-amber-400" />,
    title: "Data Contracts com Trava",
    desc: "Formalize acordos entre produtor e consumidor. O sistema bloqueia mudanças que quebrariam contratos vigentes.",
  },
  {
    icon: <Bot className="h-6 w-6 text-cyan-400" />,
    title: "Assistente de IA Integrado",
    desc: "Sugestões de pauta para o Comitê, classificação automática de dados e análises de conformidade em linguagem natural.",
  },
  {
    icon: <Lock className="h-6 w-6 text-red-400" />,
    title: "LGPD & DSAR Completo",
    desc: "Módulo completo com PIA/DPIA, rastreamento de dados pessoais (PII), gestão de solicitações DSAR e relatório do DPO.",
  },
  {
    icon: <Webhook className="h-6 w-6 text-orange-400" />,
    title: "Webhooks & API REST Pública",
    desc: "Integre com Slack, Teams, ServiceNow e qualquer sistema. Autenticação por API Key com escopos granulares e Swagger UI.",
  },
  {
    icon: <BarChart3 className="h-6 w-6 text-indigo-400" />,
    title: "Dashboard de Maturidade",
    desc: "Score de maturidade geral, heatmap de qualidade por domínio e tendência histórica para demonstrar evolução ao board.",
  },
];

const PLANS = [
  {
    name: "Essencial",
    price: "R$ 3.000",
    period: "/mês",
    description: "Para PMEs e times de dados em crescimento",
    color: "border-gray-200",
    features: [
      "Catálogo de Dados (até 500 ativos)",
      "Motor de Qualidade Nativo",
      "Glossário de Negócios",
      "Conformidade LGPD básica",
      "API REST Pública",
      "Suporte via e-mail",
    ],
    cta: "Começar Agora",
    highlight: false,
  },
  {
    name: "Profissional",
    price: "R$ 8.000",
    period: "/mês",
    description: "Para empresas com governança ativa e múltiplos domínios",
    color: "border-[#1B3A8C]",
    features: [
      "Tudo do Essencial",
      "Linhagem + What-if Simulator",
      "Data Contracts com trava",
      "Webhooks ilimitados",
      "SSO (Microsoft + Google)",
      "Multi-tenancy",
      "Assistente de IA",
      "Suporte prioritário",
    ],
    cta: "Falar com Especialista",
    highlight: true,
  },
  {
    name: "Enterprise",
    price: "Sob consulta",
    period: "",
    description: "Para grandes corporações com requisitos personalizados",
    color: "border-gray-200",
    features: [
      "Tudo do Profissional",
      "On-Premises / Cloud privada",
      "SLA de 99,9% garantido",
      "Integrações personalizadas (SAP, Snowflake)",
      "Treinamento e onboarding dedicado",
      "Gerente de conta exclusivo",
    ],
    cta: "Contato Comercial",
    highlight: false,
  },
];

const COMPETITORS = [
  { name: "Collibra", price: "USD 100k+/ano", cloud: true, onprem: true, ai: false, contracts: false, quality: false },
  { name: "Atlan", price: "USD 80k+/ano", cloud: true, onprem: false, ai: true, contracts: false, quality: false },
  { name: "DataHub", price: "Gratuito*", cloud: true, onprem: true, ai: false, contracts: false, quality: false },
  { name: "OpenMetadata", price: "Gratuito*", cloud: true, onprem: true, ai: false, contracts: false, quality: false },
  { name: "Esta Plataforma", price: "A partir de R$ 3k/mês", cloud: true, onprem: true, ai: true, contracts: true, quality: true, highlight: true },
];

const fadeUp = { hidden: { opacity: 0, y: 30 }, show: { opacity: 1, y: 0, transition: { duration: 0.5 } } };

export default function LandingPage() {
  return (
    <div className="bg-white text-gray-900 font-sans antialiased">

      {/* ── Navbar ─────────────────────────────────────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur border-b border-gray-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={LUCID_LOGO} alt="Lucid Data Governance" className="h-10 object-contain" />
            <span className="text-sm font-black text-[#1B3A8C] hidden md:block">Portal de Governança de Dados</span>
          </div>
          <div className="flex items-center gap-3">
            <a href="#funcionalidades" className="text-sm font-medium text-gray-600 hover:text-[#1B3A8C] hidden md:block">Funcionalidades</a>
            <a href="#comparativo" className="text-sm font-medium text-gray-600 hover:text-[#1B3A8C] hidden md:block">Comparativo</a>
            <a href="#pricing" className="text-sm font-medium text-gray-600 hover:text-[#1B3A8C] hidden md:block">Planos</a>
            <Link href="/login">
              <Button className="bg-[#1B3A8C] hover:bg-[#0F2460] text-white font-bold text-sm h-9 px-5 rounded-xl">
                Acessar Portal
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────────────────────── */}
      <section className="pt-32 pb-24 px-6 bg-gradient-to-br from-[#1B3A8C] via-[#0F2460] to-[#071640] text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 20% 50%, #6DC23A 0%, transparent 60%), radial-gradient(circle at 80% 20%, #3b82f6 0%, transparent 60%)" }} />
        <div className="max-w-5xl mx-auto text-center relative z-10">
          <motion.div initial="hidden" animate="show" variants={fadeUp}>
            <Badge className="bg-[#6DC23A]/20 text-[#6DC23A] border-[#6DC23A]/30 font-bold mb-6 text-sm px-4 py-1">
              ✦ Versão 1.0 — Disponível Agora
            </Badge>
            <h1 className="text-4xl md:text-6xl font-black leading-tight mb-6">
              Governança de Dados<br />
              <span className="text-[#6DC23A]">que realmente funciona</span>
            </h1>
            <p className="text-lg md:text-xl text-blue-200 max-w-3xl mx-auto mb-10 leading-relaxed">
              Uma plataforma completa de <strong className="text-white">Catálogo, Qualidade, Linhagem e Conformidade LGPD</strong> — com IA integrada, Data Contracts e Análise de Impacto em Cascata. Em produção em minutos com Docker.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/login">
                <Button size="lg" className="bg-[#6DC23A] hover:bg-[#5aab2f] text-white font-black text-base h-14 px-8 rounded-2xl shadow-xl gap-2">
                  Acessar a Plataforma <ArrowRight className="h-5 w-5" />
                </Button>
              </Link>
              <a href="#funcionalidades">
                <Button size="lg" variant="outline" className="border-white/30 text-white hover:bg-white/10 font-bold text-base h-14 px-8 rounded-2xl gap-2">
                  Ver Funcionalidades
                </Button>
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Stats ─────────────────────────────────────────────────────────────────── */}
      <section className="bg-gray-50 py-12 border-y border-gray-100">
        <div className="max-w-5xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { value: "38+", label: "Módulos Integrados" },
            { value: "20", label: "Migrations Versionadas" },
            { value: "< 5min", label: "Deploy com Docker" },
            { value: "LGPD", label: "Conformidade Nativa" },
          ].map((s, i) => (
            <div key={i}>
              <p className="text-3xl font-black text-[#1B3A8C]">{s.value}</p>
              <p className="text-sm text-gray-500 font-medium mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────────────────────── */}
      <section id="funcionalidades" className="py-24 px-6 max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-black text-gray-900 mb-4">Tudo que você precisa em uma plataforma</h2>
          <p className="text-gray-500 max-w-2xl mx-auto text-lg">Do catálogo ao compliance, da linhagem ao contrato de dados — sem precisar de 5 ferramentas diferentes.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {FEATURES.map((f, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.07 }}
              className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="w-12 h-12 rounded-xl bg-gray-900 flex items-center justify-center mb-4">
                {f.icon}
              </div>
              <h3 className="font-black text-gray-900 mb-2 text-sm">{f.title}</h3>
              <p className="text-xs text-gray-500 leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Comparativo ─────────────────────────────────────────────────────────── */}
      <section id="comparativo" className="py-24 px-6 bg-gray-50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-black text-gray-900 mb-4">Por que esta plataforma?</h2>
            <p className="text-gray-500 max-w-xl mx-auto">Compare com as alternativas do mercado e veja o que diferencia esta solução.</p>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-gray-200 shadow-sm bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-6 py-4 font-black text-gray-700">Plataforma</th>
                  <th className="text-center px-4 py-4 font-bold text-gray-600 text-xs">Preço</th>
                  <th className="text-center px-4 py-4 font-bold text-gray-600 text-xs">On-Premises</th>
                  <th className="text-center px-4 py-4 font-bold text-gray-600 text-xs">IA Nativa</th>
                  <th className="text-center px-4 py-4 font-bold text-gray-600 text-xs">Data Contracts</th>
                  <th className="text-center px-4 py-4 font-bold text-gray-600 text-xs">Qualidade Nativa</th>
                </tr>
              </thead>
              <tbody>
                {COMPETITORS.map((c, i) => (
                  <tr key={i} className={`border-b border-gray-50 ${c.highlight ? 'bg-[#1B3A8C]/5' : ''}`}>
                    <td className={`px-6 py-4 font-bold ${c.highlight ? 'text-[#1B3A8C]' : 'text-gray-800'}`}>
                      {c.name} {c.highlight && <Badge className="ml-2 text-[9px] bg-[#6DC23A] text-white">Você está aqui</Badge>}
                    </td>
                    <td className="px-4 py-4 text-center text-xs text-gray-600">{c.price}</td>
                    <td className="px-4 py-4 text-center">{c.onprem ? <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" /> : <span className="text-gray-300 text-lg">—</span>}</td>
                    <td className="px-4 py-4 text-center">{c.ai ? <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" /> : <span className="text-gray-300 text-lg">—</span>}</td>
                    <td className="px-4 py-4 text-center">{c.contracts ? <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" /> : <span className="text-gray-300 text-lg">—</span>}</td>
                    <td className="px-4 py-4 text-center">{c.quality ? <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" /> : <span className="text-gray-300 text-lg">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-400 mt-3 text-center">* DataHub e OpenMetadata são open-source mas exigem infraestrutura Kubernetes, equipe de operação dedicada e têm escopo limitado.</p>
        </div>
      </section>

      {/* ── Pricing ─────────────────────────────────────────────────────────────── */}
      <section id="pricing" className="py-24 px-6 max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-black text-gray-900 mb-4">Planos e Preços</h2>
          <p className="text-gray-500 max-w-xl mx-auto">Escolha o modelo que melhor se adapta ao tamanho e maturidade da sua operação de dados.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {PLANS.map((plan, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className={`relative rounded-2xl border-2 p-8 ${plan.color} ${plan.highlight ? 'shadow-2xl shadow-blue-100' : 'shadow-sm'} bg-white`}
            >
              {plan.highlight && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <Badge className="bg-[#1B3A8C] text-white font-black px-4 py-1 text-xs shadow-lg">
                    ★ Mais Popular
                  </Badge>
                </div>
              )}
              <h3 className={`text-lg font-black mb-1 ${plan.highlight ? 'text-[#1B3A8C]' : 'text-gray-900'}`}>{plan.name}</h3>
              <p className="text-xs text-gray-500 mb-4">{plan.description}</p>
              <div className="flex items-end gap-1 mb-6">
                <span className="text-3xl font-black text-gray-900">{plan.price}</span>
                <span className="text-gray-400 text-sm mb-1">{plan.period}</span>
              </div>
              <ul className="space-y-2 mb-8">
                {plan.features.map((f, j) => (
                  <li key={j} className="flex items-start gap-2 text-sm text-gray-700">
                    <CheckCircle2 className="h-4 w-4 text-[#6DC23A] flex-shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link href="/login">
                <Button className={`w-full font-black rounded-xl h-11 ${plan.highlight ? 'bg-[#1B3A8C] hover:bg-[#0F2460] text-white' : 'bg-gray-900 hover:bg-gray-800 text-white'}`}>
                  {plan.cta}
                </Button>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── CTA Final ─────────────────────────────────────────────────────────── */}
      <section className="bg-[#1B3A8C] py-20 px-6 text-white text-center">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-black mb-4">Pronto para levar a governança a sério?</h2>
          <p className="text-blue-200 mb-8 text-lg">Em menos de 5 minutos com Docker, sua empresa terá uma plataforma de dados de nível enterprise rodando.</p>
          <Link href="/login">
            <Button size="lg" className="bg-[#6DC23A] hover:bg-[#5aab2f] text-white font-black text-base h-14 px-10 rounded-2xl shadow-xl gap-2">
              Acessar a Plataforma <ArrowRight className="h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────────────── */}
      <footer className="bg-gray-900 text-gray-400 py-10 px-6 text-center">
        <img src={LUCID_LOGO} alt="Lucid Data Governance" className="h-12 object-contain mx-auto mb-4 opacity-80" />
        <p className="text-xs">© {new Date().getFullYear()} Portal de Governança de Dados — Lucid Data Governance. Todos os direitos reservados.</p>
        <p className="text-xs mt-1">v1.0.0 — Construído com React 19 · tRPC · Drizzle ORM · MySQL 8 · Caddy</p>
      </footer>
    </div>
  );
}
