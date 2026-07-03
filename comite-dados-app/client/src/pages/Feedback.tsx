import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageSquare, AlertCircle, ThumbsUp, HelpCircle, Loader2 } from "lucide-react";
import { format } from "date-fns";

const feedbackSchema = z.object({
  type: z.enum(["sugestao", "bug", "elogio", "outro"]),
  message: z.string().min(10, "A mensagem deve ter pelo menos 10 caracteres"),
});

type FeedbackFormValues = z.infer<typeof feedbackSchema>;

export default function Feedback() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [activeTab, setActiveTab] = useState(isAdmin ? "gerenciar" : "enviar");

  const trpcContext = trpc.useContext();

  const submitFeedback = trpc.feedback.submit.useMutation({
    onSuccess: () => {
      toast.success("Feedback enviado com sucesso! Obrigado pela contribuição.");
      form.reset();
      trpcContext.feedback.myFeedbacks.invalidate();
      if (isAdmin) {
        trpcContext.feedback.list.invalidate();
      }
    },
    onError: (error) => {
      toast.error(`Erro ao enviar feedback: ${error.message}`);
    },
  });

  const form = useForm<FeedbackFormValues>({
    resolver: zodResolver(feedbackSchema),
    defaultValues: {
      message: "",
    },
  });

  function onSubmit(data: FeedbackFormValues) {
    submitFeedback.mutate(data);
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Feedback</h1>
        <p className="text-sm text-gray-500 mt-1">
          Ajude-nos a melhorar a plataforma enviando suas sugestões, relatando problemas ou deixando um elogio.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="enviar">Enviar Feedback</TabsTrigger>
          <TabsTrigger value="meus">Meus Feedbacks</TabsTrigger>
          {isAdmin && <TabsTrigger value="gerenciar">Gerenciar (Admin)</TabsTrigger>}
        </TabsList>

        <TabsContent value="enviar" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Novo Feedback</CardTitle>
              <CardDescription>O que você tem a nos dizer hoje?</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 max-w-2xl">
                  <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipo de Feedback</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="sugestao">
                              <span className="flex items-center gap-2"><HelpCircle className="h-4 w-4 text-blue-500" /> Sugestão</span>
                            </SelectItem>
                            <SelectItem value="bug">
                              <span className="flex items-center gap-2"><AlertCircle className="h-4 w-4 text-red-500" /> Relatar Problema (Bug)</span>
                            </SelectItem>
                            <SelectItem value="elogio">
                              <span className="flex items-center gap-2"><ThumbsUp className="h-4 w-4 text-green-500" /> Elogio</span>
                            </SelectItem>
                            <SelectItem value="outro">
                              <span className="flex items-center gap-2"><MessageSquare className="h-4 w-4 text-gray-500" /> Outro</span>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="message"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Mensagem</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Descreva seu feedback com o máximo de detalhes possível..."
                            className="min-h-[150px]"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button type="submit" disabled={submitFeedback.isPending}>
                    {submitFeedback.isPending ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Enviando...</>
                    ) : (
                      "Enviar Feedback"
                    )}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="meus" className="mt-4">
          <MyFeedbacksList />
        </TabsContent>

        {isAdmin && (
          <TabsContent value="gerenciar" className="mt-4">
            <AdminFeedbacksList />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

function getTypeBadge(type: string) {
  switch (type) {
    case 'sugestao': return <Badge variant="secondary" className="bg-blue-100 text-blue-800 border-blue-200">Sugestão</Badge>;
    case 'bug': return <Badge variant="secondary" className="bg-red-100 text-red-800 border-red-200">Bug</Badge>;
    case 'elogio': return <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-200">Elogio</Badge>;
    default: return <Badge variant="secondary">Outro</Badge>;
  }
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'novo': return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 border-yellow-200">Novo</Badge>;
    case 'em_analise': return <Badge variant="secondary" className="bg-blue-100 text-blue-800 border-blue-200">Em Análise</Badge>;
    case 'concluido': return <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-200">Concluído</Badge>;
    default: return <Badge variant="secondary">{status}</Badge>;
  }
}

function MyFeedbacksList() {
  const { data: feedbacks, isLoading } = trpc.feedback.myFeedbacks.useQuery();

  if (isLoading) {
    return <div className="p-8 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-gray-400" /></div>;
  }

  if (!feedbacks || feedbacks.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-gray-500">
          Você ainda não enviou nenhum feedback.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Meus Feedbacks</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Mensagem</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {feedbacks.map((fb) => (
              <TableRow key={fb.id}>
                <TableCell className="whitespace-nowrap">{format(new Date(fb.createdAt), 'dd/MM/yyyy HH:mm')}</TableCell>
                <TableCell>{getTypeBadge(fb.type)}</TableCell>
                <TableCell className="max-w-md truncate" title={fb.message}>{fb.message}</TableCell>
                <TableCell>{getStatusBadge(fb.status)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function AdminFeedbacksList() {
  const { data: feedbacks, isLoading } = trpc.feedback.list.useQuery({});
  const trpcContext = trpc.useContext();
  const updateStatus = trpc.feedback.updateStatus.useMutation({
    onSuccess: () => {
      toast.success("Status atualizado com sucesso.");
      trpcContext.feedback.list.invalidate();
    },
  });

  if (isLoading) {
    return <div className="p-8 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-gray-400" /></div>;
  }

  if (!feedbacks || feedbacks.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-gray-500">
          Nenhum feedback encontrado.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Todos os Feedbacks</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Usuário</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Mensagem</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {feedbacks.map((fb) => (
              <TableRow key={fb.id}>
                <TableCell className="whitespace-nowrap">{format(new Date(fb.createdAt), 'dd/MM/yyyy HH:mm')}</TableCell>
                <TableCell>
                  <div className="font-medium">{fb.userName || 'Desconhecido'}</div>
                  <div className="text-xs text-gray-500">{fb.userEmail || 'Sem email'}</div>
                </TableCell>
                <TableCell>{getTypeBadge(fb.type)}</TableCell>
                <TableCell className="max-w-xs truncate" title={fb.message}>{fb.message}</TableCell>
                <TableCell>{getStatusBadge(fb.status)}</TableCell>
                <TableCell>
                  <Select
                    defaultValue={fb.status}
                    onValueChange={(val: any) => updateStatus.mutate({ id: fb.id, status: val })}
                    disabled={updateStatus.isPending}
                  >
                    <SelectTrigger className="w-[140px] h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="novo">Novo</SelectItem>
                      <SelectItem value="em_analise">Em Análise</SelectItem>
                      <SelectItem value="concluido">Concluído</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
