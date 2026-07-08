import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { authenticateRequest } from "../localAuth";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    user = await authenticateRequest(opts.req);
  } catch (error) {
    // Authentication is optional for public procedures.
    user = null;
  }

  // SEGURANÇA: nunca expor o hash de senha nas respostas da API (ex.: auth.me).
  // O objeto é clonado com passwordHash nulo antes de entrar no contexto tRPC.
  const safeUser: User | null = user ? { ...user, passwordHash: null } : null;

  return {
    req: opts.req,
    res: opts.res,
    user: safeUser,
  };
}
