import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Reply, CheckCircle2, Trash2, Send } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

interface AssetCommentsProps {
  assetId: number;
  currentUserId?: number;
  isAdmin?: boolean;
}

export function AssetComments({ assetId, currentUserId, isAdmin }: AssetCommentsProps) {
  const [newComment, setNewComment] = useState("");
  const [replyTo, setReplyTo] = useState<number | null>(null);
  const [replyText, setReplyText] = useState("");

  const { data: comments = [], refetch, isLoading } = trpc.assetComments.list.useQuery({ assetId });
  const createMutation = trpc.assetComments.create.useMutation({
    onSuccess: () => { setNewComment(""); setReplyTo(null); setReplyText(""); refetch(); },
    onError: (e) => toast.error(`Erro ao comentar: ${e.message}`),
  });
  const resolveMutation = trpc.assetComments.resolve.useMutation({
    onSuccess: () => { refetch(); toast.success("Comentário resolvido"); },
  });
  const deleteMutation = trpc.assetComments.delete.useMutation({
    onSuccess: () => { refetch(); toast.success("Comentário removido"); },
    onError: (e) => toast.error(`Erro: ${e.message}`),
  });

  const rootComments = comments.filter(c => !c.parentId);
  const replies = (parentId: number) => comments.filter(c => c.parentId === parentId);

  const handleSubmit = () => {
    if (!newComment.trim()) return;
    createMutation.mutate({ assetId, content: newComment.trim() });
  };

  const handleReply = (parentId: number) => {
    if (!replyText.trim()) return;
    createMutation.mutate({ assetId, content: replyText.trim(), parentId });
  };

  const initials = (name: string) => name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <MessageSquare className="h-4 w-4" />
        <span>{comments.length} comentário{comments.length !== 1 ? "s" : ""}</span>
      </div>

      {/* Novo comentário */}
      <div className="space-y-2">
        <Textarea
          placeholder="Deixe um comentário sobre este ativo..."
          value={newComment}
          onChange={e => setNewComment(e.target.value)}
          rows={3}
          className="resize-none text-sm"
          onKeyDown={e => { if (e.key === "Enter" && e.ctrlKey) handleSubmit(); }}
        />
        <div className="flex justify-between items-center">
          <span className="text-xs text-muted-foreground">Ctrl+Enter para enviar</span>
          <Button size="sm" onClick={handleSubmit} disabled={!newComment.trim() || createMutation.isPending}>
            <Send className="h-3 w-3 mr-1" />
            Comentar
          </Button>
        </div>
      </div>

      {/* Lista de comentários */}
      {isLoading && <p className="text-sm text-muted-foreground">Carregando comentários...</p>}

      <div className="space-y-4">
        {rootComments.map(comment => (
          <div key={comment.id} className={`space-y-2 ${comment.resolved ? "opacity-60" : ""}`}>
            {/* Comentário raiz */}
            <div className="flex gap-3">
              <Avatar className="h-8 w-8 flex-shrink-0">
                <AvatarFallback className="text-xs">{initials(comment.userName)}</AvatarFallback>
              </Avatar>
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium">{comment.userName}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true, locale: ptBR })}
                  </span>
                  {comment.resolved ? (
                    <Badge variant="secondary" className="text-xs py-0">Resolvido</Badge>
                  ) : null}
                </div>
                <p className="text-sm whitespace-pre-wrap">{comment.content}</p>
                <div className="flex gap-2 pt-1">
                  <Button
                    variant="ghost" size="sm" className="h-6 text-xs px-2"
                    onClick={() => setReplyTo(replyTo === comment.id ? null : comment.id)}
                  >
                    <Reply className="h-3 w-3 mr-1" />
                    Responder
                  </Button>
                  {(isAdmin || currentUserId === comment.userId) && !comment.resolved && (
                    <Button
                      variant="ghost" size="sm" className="h-6 text-xs px-2 text-green-600 hover:text-green-700"
                      onClick={() => resolveMutation.mutate({ id: comment.id })}
                    >
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Resolver
                    </Button>
                  )}
                  {(isAdmin || currentUserId === comment.userId) && (
                    <Button
                      variant="ghost" size="sm" className="h-6 text-xs px-2 text-red-500 hover:text-red-600"
                      onClick={() => deleteMutation.mutate({ id: comment.id })}
                    >
                      <Trash2 className="h-3 w-3 mr-1" />
                      Excluir
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Respostas */}
            {replies(comment.id).map(reply => (
              <div key={reply.id} className="ml-11 flex gap-3 border-l-2 pl-3">
                <Avatar className="h-6 w-6 flex-shrink-0">
                  <AvatarFallback className="text-xs">{initials(reply.userName)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium">{reply.userName}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(reply.createdAt), { addSuffix: true, locale: ptBR })}
                    </span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{reply.content}</p>
                  {(isAdmin || currentUserId === reply.userId) && (
                    <Button
                      variant="ghost" size="sm" className="h-5 text-xs px-2 text-red-500 hover:text-red-600"
                      onClick={() => deleteMutation.mutate({ id: reply.id })}
                    >
                      <Trash2 className="h-3 w-3 mr-1" />
                      Excluir
                    </Button>
                  )}
                </div>
              </div>
            ))}

            {/* Campo de resposta */}
            {replyTo === comment.id && (
              <div className="ml-11 space-y-2">
                <Textarea
                  placeholder={`Responder a ${comment.userName}...`}
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  rows={2}
                  className="resize-none text-sm"
                  autoFocus
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => handleReply(comment.id)} disabled={!replyText.trim() || createMutation.isPending}>
                    <Send className="h-3 w-3 mr-1" />
                    Responder
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { setReplyTo(null); setReplyText(""); }}>
                    Cancelar
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}

        {rootComments.length === 0 && !isLoading && (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhum comentário ainda. Seja o primeiro a comentar!
          </p>
        )}
      </div>
    </div>
  );
}
