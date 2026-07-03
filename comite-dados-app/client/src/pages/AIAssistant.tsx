import { useState, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Send, Bot, User, Sparkles } from "lucide-react";
import { Streamdown } from "streamdown";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";

const SUGGESTIONS = [
  "Quais são os papéis essenciais para o Lucid Data Governance?",
  "Como implementar RLS no Databricks para o domínio de Logística?",
  "Quais são as melhores práticas para organizar o catálogo de dados por domínios?",
  "Como estruturar a Matriz RACI para atividades de IA?",
  "Quais são os gaps mais comuns na governança de dados?",
  "Como realizar profiling de qualidade de dados no Databricks?",
];

export default function AIAssistant() {
  const { isAuthenticated } = useAuth();
  const [sessionId] = useState(() => Math.random().toString(36).slice(2));
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Array<{ role: "user" | "assistant"; content: string }>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const chatMutation = trpc.ai.chat.useMutation({
    onSuccess: (data) => {
      setMessages((prev) => [...prev, { role: "assistant", content: data.message }]);
      setIsLoading(false);
    },
    onError: (e) => {
      toast.error("Erro: " + e.message);
      setIsLoading(false);
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const sendMessage = (text?: string) => {
    const content = text ?? message.trim();
    if (!content || isLoading) return;
    setMessages((prev) => [...prev, { role: "user", content }]);
    setMessage("");
    setIsLoading(true);
    chatMutation.mutate({ sessionId, message: content });
  };

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <Bot size={48} className="text-[#1B3A8C] opacity-40" />
        <p className="text-gray-500 text-sm">Faça login para usar o Assistente de IA</p>
        <Button onClick={() => window.location.href = getLoginUrl()} className="bg-[#1B3A8C] hover:bg-[#122970]">Entrar</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 120px)", maxWidth: "768px" }}>
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Sparkles size={22} className="text-[#1B3A8C]" /> Assistente de IA
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">Especialista em Governança de Dados e IA para a Lucid Data Governance</p>
      </div>

      <Card className="flex-1 border border-gray-100 shadow-sm overflow-hidden flex flex-col">
        <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-6 py-8">
              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-[#1B3A8C] to-[#2A4FA8] rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg">
                  <Bot size={28} className="text-white" />
                </div>
                <h3 className="font-semibold text-gray-800 text-base">Como posso ajudar?</h3>
                <p className="text-sm text-gray-400 mt-1 max-w-sm">Sou especialista em Governança de Dados e IA. Pergunte sobre papéis, processos, Databricks, RLS/CLS e muito mais.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
                {SUGGESTIONS.map((s) => (
                  <button key={s} onClick={() => sendMessage(s)}
                    className="text-left text-xs p-3 rounded-xl border border-gray-200 hover:border-[#1B3A8C] hover:bg-blue-50 text-gray-600 transition-all">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg, i) => (
                <div key={i} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  {msg.role === "assistant" && (
                    <div className="w-7 h-7 bg-gradient-to-br from-[#1B3A8C] to-[#2A4FA8] rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm">
                      <Bot size={14} className="text-white" />
                    </div>
                  )}
                  <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${msg.role === "user" ? "bg-[#1B3A8C] text-white rounded-tr-sm" : "bg-gray-50 text-gray-800 border border-gray-100 rounded-tl-sm"}`}>
                    {msg.role === "assistant" ? <Streamdown>{msg.content}</Streamdown> : msg.content}
                  </div>
                  {msg.role === "user" && (
                    <div className="w-7 h-7 bg-gray-200 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                      <User size={14} className="text-gray-600" />
                    </div>
                  )}
                </div>
              ))}
              {isLoading && (
                <div className="flex gap-3 justify-start">
                  <div className="w-7 h-7 bg-gradient-to-br from-[#1B3A8C] to-[#2A4FA8] rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm">
                    <Bot size={14} className="text-white" />
                  </div>
                  <div className="bg-gray-50 border border-gray-100 rounded-2xl rounded-tl-sm px-4 py-3">
                    <div className="flex gap-1 items-center">
                      <div className="w-2 h-2 bg-[#1B3A8C] rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></div>
                      <div className="w-2 h-2 bg-[#1B3A8C] rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></div>
                      <div className="w-2 h-2 bg-[#1B3A8C] rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
          <div ref={messagesEndRef} />
        </CardContent>
        <div className="border-t border-gray-100 p-4">
          <div className="flex gap-2">
            <Input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              placeholder="Pergunte sobre governança de dados, papéis, Databricks..."
              className="flex-1 text-sm h-10 bg-gray-50 border-gray-200 focus:border-[#1B3A8C]"
              disabled={isLoading}
            />
            <Button onClick={() => sendMessage()} disabled={!message.trim() || isLoading}
              className="bg-[#1B3A8C] hover:bg-[#122970] h-10 w-10 p-0">
              <Send size={16} />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
