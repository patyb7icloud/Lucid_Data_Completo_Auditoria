import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { CheckCircle2, Loader2, Shield, Database, BarChart3 } from "lucide-react";

const PLANS = [
  {
    id: "starter" as const,
    name: "Starter",
    price: "Grátis por 14 dias",
    description: "Ideal para equipes pequenas começando com governança.",
    maxUsers: 5,
    maxAssets: 100,
    features: ["5 usuários", "100 ativos", "Catálogo básico", "Qualidade de dados", "Suporte por e-mail"],
  },
  {
    id: "professional" as const,
    name: "Professional",
    price: "Grátis por 14 dias",
    description: "Para organizações em crescimento com múltiplos domínios.",
    maxUsers: 25,
    maxAssets: 1000,
    features: ["25 usuários", "1.000 ativos", "Todos os conectores", "Linhagem avançada", "Scorecard DMBoK", "SLA e alertas", "Suporte prioritário"],
    recommended: true,
  },
  {
    id: "enterprise" as const,
    name: "Enterprise",
    price: "Contato comercial",
    description: "Governança corporativa completa com SSO e SLA garantido.",
    maxUsers: 999,
    maxAssets: 999999,
    features: ["Usuários ilimitados", "Ativos ilimitados", "SSO (SAML/OIDC)", "White-label", "LGPD/PIA avançado", "Webhooks e API", "SLA 99,9% + suporte dedicado"],
  },
] as const;

export default function SignupPage() {
  const [, navigate] = useLocation();
  const [selectedPlan, setSelectedPlan] = useState<"starter" | "professional" | "enterprise">("professional");
  const [form, setForm] = useState({ name: "", email: "", orgName: "", password: "", confirmPassword: "" });
  const [done, setDone] = useState(false);

  const registerMutation = trpc.organizations.selfServiceRegister.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      setDone(true);
    },
    onError: (err) => {
      if (err.data?.code === "CONFLICT") toast.error("Este e-mail já está cadastrado.");
      else toast.error(`Erro: ${err.message}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirmPassword) {
      toast.error("As senhas não coincidem.");
      return;
    }
    if (selectedPlan === "enterprise") {
      toast.info("Para o plano Enterprise, entre em contato comercial: contato@luciddatagovernance.com");
      return;
    }
    registerMutation.mutate({
      name: form.name,
      email: form.email,
      orgName: form.orgName,
      plan: selectedPlan,
      password: form.password,
    });
  };

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 p-6">
        <Card className="max-w-md w-full text-center">
          <CardHeader>
            <div className="flex justify-center mb-4">
              <CheckCircle2 className="h-16 w-16 text-green-500" />
            </div>
            <CardTitle className="text-2xl">Conta criada com sucesso!</CardTitle>
            <CardDescription>
              Seu trial de 14 dias começou. Faça login para acessar a plataforma.
            </CardDescription>
          </CardHeader>
          <CardFooter className="flex justify-center">
            <Button onClick={() => navigate("/login")} className="w-full">
              Fazer Login
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-6">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-2 pt-8">
          <div className="flex justify-center gap-2 items-center">
            <Database className="h-8 w-8 text-blue-400" />
            <span className="text-2xl font-bold text-white">Lucid Data Governance</span>
          </div>
          <h1 className="text-3xl font-bold text-white">Comece seu trial gratuito</h1>
          <p className="text-slate-400 text-lg">14 dias grátis, sem cartão de crédito.</p>
        </div>

        {/* Plan Selection */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {PLANS.map(plan => (
            <div
              key={plan.id}
              onClick={() => setSelectedPlan(plan.id)}
              className={`relative rounded-xl border-2 p-5 cursor-pointer transition-all ${
                selectedPlan === plan.id
                  ? "border-blue-500 bg-blue-950/40"
                  : "border-slate-700 bg-slate-800/60 hover:border-slate-500"
              }`}
            >
              {(plan as any).recommended && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-500 text-white">
                  Recomendado
                </Badge>
              )}
              <div className="space-y-3">
                <div>
                  <h3 className="text-white font-semibold text-lg">{plan.name}</h3>
                  <p className="text-blue-400 text-sm font-medium">{plan.price}</p>
                  <p className="text-slate-400 text-xs mt-1">{plan.description}</p>
                </div>
                <ul className="space-y-1.5">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-center gap-2 text-slate-300 text-sm">
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-400 flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>

        {/* Signup Form */}
        <Card className="max-w-lg mx-auto">
          <CardHeader>
            <CardTitle>Criar sua conta</CardTitle>
            <CardDescription>
              Plano selecionado: <strong>{PLANS.find(p => p.id === selectedPlan)?.name}</strong>
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="name">Seu nome completo</Label>
                <Input
                  id="name"
                  placeholder="Maria Silva"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  required
                  minLength={2}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">E-mail corporativo</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="maria@empresa.com.br"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="orgName">Nome da organização</Label>
                <Input
                  id="orgName"
                  placeholder="Empresa S.A."
                  value={form.orgName}
                  onChange={e => setForm(f => ({ ...f, orgName: e.target.value }))}
                  required
                  minLength={2}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Senha (mínimo 8 caracteres)</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  required
                  minLength={8}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword">Confirmar senha</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  value={form.confirmPassword}
                  onChange={e => setForm(f => ({ ...f, confirmPassword: e.target.value }))}
                  required
                  minLength={8}
                />
              </div>
              <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted rounded-lg p-3">
                <Shield className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                <span>
                  Seus dados são protegidos por criptografia de ponta a ponta e nunca são compartilhados com terceiros.
                  Em conformidade com a LGPD.
                </span>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-3">
              <Button type="submit" className="w-full" disabled={registerMutation.isPending}>
                {registerMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Criando conta...</>
                ) : (
                  <><BarChart3 className="h-4 w-4 mr-2" />Começar trial gratuito</>
                )}
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                Já tem conta?{" "}
                <button type="button" onClick={() => navigate("/login")} className="text-blue-500 hover:underline">
                  Fazer login
                </button>
              </p>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
