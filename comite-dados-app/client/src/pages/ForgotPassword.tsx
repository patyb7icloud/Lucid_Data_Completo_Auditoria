import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Mail, ArrowLeft, CheckCircle2 } from "lucide-react";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) {
      toast.error("Informe seu e-mail.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao enviar e-mail.");
      setSent(true);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao enviar e-mail.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0F1B3D] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo / Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#1B3A8C] mb-4 shadow-lg">
            <span className="text-white font-bold text-2xl">VC</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Lucid Data Governance
          </h1>
          <p className="text-[#A5B4FC] text-sm mt-1">
            Lucid Data Governance — Governança de Dados e IA
          </p>
        </div>

        {/* Card */}
        <div className="bg-[#1A2B52] rounded-2xl shadow-2xl p-8 border border-[#2A3F6B]">
          {sent ? (
            // Estado de sucesso
            <div className="text-center py-4">
              <CheckCircle2 className="w-14 h-14 text-green-400 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-white mb-2">
                E-mail enviado!
              </h2>
              <p className="text-[#94A3B8] text-sm leading-relaxed mb-6">
                Se o e-mail <strong className="text-white">{email}</strong> estiver
                cadastrado, você receberá as instruções para redefinir sua senha em
                breve. Verifique também a pasta de spam.
              </p>
              <Link href="/login">
                <Button
                  variant="outline"
                  className="w-full border-[#2A3F6B] text-[#A5B4FC] hover:bg-[#2A3F6B] hover:text-white"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Voltar ao login
                </Button>
              </Link>
            </div>
          ) : (
            // Formulário
            <>
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-white mb-1">
                  Esqueceu sua senha?
                </h2>
                <p className="text-[#94A3B8] text-sm">
                  Informe seu e-mail e enviaremos um link para redefinir sua senha.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-[#CBD5E1] text-sm">
                    E-mail corporativo
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B]" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="seu.nome@empresa.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10 bg-[#0F1B3D] border-[#2A3F6B] text-white placeholder:text-[#475569] focus:border-[#3B82F6] focus:ring-[#3B82F6]/20"
                      autoComplete="email"
                      required
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#1B3A8C] hover:bg-[#2347A8] text-white font-semibold py-2.5 rounded-lg transition-colors"
                >
                  {loading ? "Enviando..." : "Enviar link de redefinição"}
                </Button>

                <Link href="/login">
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full text-[#64748B] hover:text-[#A5B4FC] hover:bg-transparent"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Voltar ao login
                  </Button>
                </Link>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
