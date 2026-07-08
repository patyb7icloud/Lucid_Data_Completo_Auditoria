import React, { useState } from "react";
import { AIChatBox, Message } from "./AIChatBox";
import { trpc } from "@/lib/trpc";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { MessageSquare, Sparkles } from "lucide-react";

interface CopilotChatProps {
  host: string;
  catalog: string;
  /** Token de acesso Databricks (PAT). Opcional; quando ausente, o backend usa a sessão ativa. */
  token?: string;
}

export function CopilotChat({ host, catalog, token }: CopilotChatProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "system",
      content: `Você é o Copiloto de Governança de Dados do Lucid. Você está analisando o catálogo ${catalog} no host ${host}. Ajude o usuário a analisar dados, criar políticas, entender linhagem e tirar dúvidas gerais de governança.`,
    },
  ]);

  const askMutation = trpc.auditoria.copilot.ask.useMutation();

  const handleSendMessage = async (content: string) => {
    const userMsg: Message = { role: "user", content };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);

    try {
      const response = await askMutation.mutateAsync({
        host,
        token: token ?? "",
        catalog,
        question: content,
      });

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: response.answer,
        },
      ]);
    } catch (error: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Erro ao obter resposta do Copiloto: ${error.message || error}`,
        },
      ]);
    }
  };

  return (
    <Card className="border border-border shadow-lg h-[600px] flex flex-col overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-blue-700 to-indigo-800 text-white p-4 shrink-0 flex flex-row items-center gap-2">
        <MessageSquare className="h-5 w-5" />
        <div>
          <CardTitle className="text-sm font-bold flex items-center gap-1.5">
            Copiloto Lucid AI <Sparkles className="h-3.5 w-3.5 text-yellow-300 animate-pulse" />
          </CardTitle>
          <p className="text-[10px] text-white/70">Pergunte sobre metadados, linhagem ou segurança</p>
        </div>
      </CardHeader>
      <CardContent className="p-0 flex-1 overflow-hidden">
        <AIChatBox
          messages={messages}
          onSendMessage={handleSendMessage}
          isLoading={askMutation.isPending}
          placeholder="Pergunte ao Copiloto sobre o catálogo..."
          height="100%"
          emptyStateMessage="Olá! Pergunte-me qualquer coisa sobre a governança ou qualidade dos dados deste catálogo."
          suggestedPrompts={[
            "Quais tabelas possuem dados pessoais?",
            "Como posso melhorar o score de governança?",
            "Verifique a linhagem da tabela customers",
          ]}
        />
      </CardContent>
    </Card>
  );
}
