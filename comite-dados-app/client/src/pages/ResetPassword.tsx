import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Lock, Eye, EyeOff, CheckCircle2, AlertCircle } from "lucide-react";

export default function ResetPassword() {
  const [, navigate] = useLocation();
  const [token, setToken] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [tokenError, setTokenError] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("token");
    if (!t) {
      setTokenError(true);
    } else {
      setToken(t);
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (password.length < 8) {
      toast.error("A senha deve ter pelo menos 8 caracteres.");
      return;
    }
    if (password !== confirm) {
      toast.error("As senhas não coincidem.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao redefinir senha.");
      setSuccess(true);
      setTimeout(() => navigate("/login"), 3000);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao redefinir senha.");
    } finally {
      setLoading(false);
    }
  }

  // Força da senha
  function getPasswordStrength(pwd: string): { label: string; color: string; width: string } {
    if (pwd.length === 0) return { label: "", color: "bg-transparent", width: "w-0" };
    if (pwd.length < 6) return { label: "Fraca", color: "bg-red-500", width: "w-1/4" };
    if (pwd.length < 10) return { label: "Média", color: "bg-yellow-500", width: "w-2/4" };
    const hasUpper = /[A-Z]/.test(pwd);
    const hasNumber = /[0-9]/.test(pwd);
    const hasSpecial = /[^A-Za-z0-9]/.test(pwd);
    if (hasUpper && hasNumber && hasSpecial) return { label: "Forte", color: "bg-green-500", width: "w-full" };
    if (hasNumber || hasSpecial) return { label: "Boa", color: "bg-blue-500", width: "w-3/4" };
    return { label: "Média", color: "bg-yellow-500", width: "w-2/4" };
  }

  const strength = getPasswordStrength(password);

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
          {tokenError ? (
            <div className="text-center py-4">
              <AlertCircle className="w-14 h-14 text-red-400 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-white mb-2">
                Link inválido
              </h2>
              <p className="text-[#94A3B8] text-sm leading-relaxed mb-6">
                Este link de redefinição de senha é inválido ou não foi encontrado.
                Solicite um novo link.
              </p>
              <Link href="/esqueci-senha">
                <Button className="w-full bg-[#1B3A8C] hover:bg-[#2347A8] text-white">
                  Solicitar novo link
                </Button>
              </Link>
            </div>
          ) : success ? (
            <div className="text-center py-4">
              <CheckCircle2 className="w-14 h-14 text-green-400 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-white mb-2">
                Senha redefinida!
              </h2>
              <p className="text-[#94A3B8] text-sm leading-relaxed mb-6">
                Sua senha foi atualizada com sucesso. Você será redirecionado para
                o login em instantes...
              </p>
              <Link href="/login">
                <Button className="w-full bg-[#1B3A8C] hover:bg-[#2347A8] text-white">
                  Ir para o login
                </Button>
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-white mb-1">
                  Criar nova senha
                </h2>
                <p className="text-[#94A3B8] text-sm">
                  Escolha uma senha segura com pelo menos 8 caracteres.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Nova senha */}
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-[#CBD5E1] text-sm">
                    Nova senha
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B]" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Mínimo 8 caracteres"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10 pr-10 bg-[#0F1B3D] border-[#2A3F6B] text-white placeholder:text-[#475569] focus:border-[#3B82F6]"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-[#A5B4FC]"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {/* Barra de força */}
                  {password.length > 0 && (
                    <div className="space-y-1">
                      <div className="h-1.5 bg-[#0F1B3D] rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-300 ${strength.color} ${strength.width}`} />
                      </div>
                      <p className="text-xs text-[#64748B]">
                        Força: <span className="text-[#A5B4FC]">{strength.label}</span>
                      </p>
                    </div>
                  )}
                </div>

                {/* Confirmar senha */}
                <div className="space-y-2">
                  <Label htmlFor="confirm" className="text-[#CBD5E1] text-sm">
                    Confirmar nova senha
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B]" />
                    <Input
                      id="confirm"
                      type={showConfirm ? "text" : "password"}
                      placeholder="Repita a nova senha"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      className={`pl-10 pr-10 bg-[#0F1B3D] border-[#2A3F6B] text-white placeholder:text-[#475569] focus:border-[#3B82F6] ${
                        confirm && confirm !== password ? "border-red-500" : ""
                      }`}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(!showConfirm)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-[#A5B4FC]"
                    >
                      {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {confirm && confirm !== password && (
                    <p className="text-xs text-red-400">As senhas não coincidem.</p>
                  )}
                </div>

                <Button
                  type="submit"
                  disabled={loading || !token}
                  className="w-full bg-[#1B3A8C] hover:bg-[#2347A8] text-white font-semibold py-2.5 rounded-lg transition-colors"
                >
                  {loading ? "Salvando..." : "Salvar nova senha"}
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
