import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useState } from "react";
import { CheckCircle, XCircle, HelpCircle, Users } from "lucide-react";

export default function InviteResponse() {
  const params = useParams<{ token: string }>();
  const token = params.token ?? "";
  const [note, setNote] = useState("");
  const [responded, setResponded] = useState(false);
  const [responseStatus, setResponseStatus] = useState("");

  const respondMutation = trpc.invites.respond.useMutation({
    onSuccess: (_, vars) => {
      setResponded(true);
      setResponseStatus(vars.status);
      toast.success("Resposta registrada!");
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });

  if (!token) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <p className="text-gray-500">Link inválido.</p>
    </div>
  );

  if (responded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#1B3A8C] to-[#2A4FA8] p-4">
        <Card className="max-w-md w-full shadow-2xl">
          <CardContent className="p-8 text-center">
            {responseStatus === "confirmado" ? (
              <>
                <CheckCircle size={56} className="mx-auto mb-4 text-green-500" />
                <h2 className="text-xl font-bold text-gray-900">Presença Confirmada!</h2>
                <p className="text-gray-500 text-sm mt-2">Sua presença foi confirmada. Até a reunião!</p>
              </>
            ) : responseStatus === "recusado" ? (
              <>
                <XCircle size={56} className="mx-auto mb-4 text-red-500" />
                <h2 className="text-xl font-bold text-gray-900">Ausência Registrada</h2>
                <p className="text-gray-500 text-sm mt-2">Sua ausência foi registrada. Obrigado pelo retorno.</p>
              </>
            ) : (
              <>
                <HelpCircle size={56} className="mx-auto mb-4 text-amber-500" />
                <h2 className="text-xl font-bold text-gray-900">Resposta Registrada</h2>
                <p className="text-gray-500 text-sm mt-2">Sua resposta foi registrada com sucesso.</p>
              </>
            )}
            <div className="mt-6 p-3 bg-blue-50 rounded-xl">
              <p className="text-xs text-gray-400 font-medium">Lucid Data Governance — Lucid Data Governance</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#1B3A8C] to-[#2A4FA8] p-4">
      <Card className="max-w-lg w-full shadow-2xl">
        <CardContent className="p-0">
          <div className="bg-gradient-to-r from-[#1B3A8C] to-[#2A4FA8] p-6 rounded-t-xl">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <Users size={20} className="text-white" />
              </div>
              <div>
                <p className="text-white/70 text-xs font-medium uppercase tracking-wide">Convite</p>
                <h1 className="text-white font-bold text-lg">Lucid Data Governance</h1>
              </div>
            </div>
            <p className="text-white/80 text-sm">Lucid Data Governance — Governança de Dados e IA</p>
          </div>
          <div className="p-6 space-y-5">
            <p className="text-sm text-gray-600">Você foi convidado(a) para participar de uma reunião do Lucid Data Governance. Por favor, confirme sua presença.</p>
            <div className="space-y-1">
              <Label className="text-xs font-medium text-gray-600">Observação (opcional)</Label>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Alguma observação sobre sua participação..." className="text-sm resize-none" rows={3} />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Button onClick={() => respondMutation.mutate({ token, status: "confirmado", responseNote: note || undefined })}
                className="bg-green-600 hover:bg-green-700 gap-1 text-xs" disabled={respondMutation.isPending}>
                <CheckCircle size={14} /> Confirmar
              </Button>
              <Button onClick={() => respondMutation.mutate({ token, status: "talvez", responseNote: note || undefined })}
                className="bg-amber-500 hover:bg-amber-600 gap-1 text-xs" disabled={respondMutation.isPending}>
                <HelpCircle size={14} /> Talvez
              </Button>
              <Button onClick={() => respondMutation.mutate({ token, status: "recusado", responseNote: note || undefined })}
                className="bg-red-500 hover:bg-red-600 gap-1 text-xs" disabled={respondMutation.isPending}>
                <XCircle size={14} /> Recusar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
