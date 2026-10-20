import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";
import { randomUUID } from "node:crypto";
import { runWithLlmContext } from "./llm";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;

const requestContext = t.middleware(async opts => {
  const { ctx, next, path } = opts;
  const headerRequestId = ctx.req.headers["x-request-id"];
  const requestId = Array.isArray(headerRequestId)
    ? headerRequestId[0]
    : headerRequestId ?? randomUUID();

  return runWithLlmContext(
    {
      userId: ctx.user?.id ?? null,
      organizationId: ctx.user?.organizationId ?? null,
      requestId,
      operation: String(path),
    },
    () => next(),
  );
});

export const publicProcedure = t.procedure.use(requestContext);

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = publicProcedure.use(requireUser);

export const adminProcedure = publicProcedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== 'admin') {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);

/**
 * stewardProcedure — requer autenticação + role admin OU data_steward.
 * Usado para operações que afetam catálogos externos (ex: write-back ao Databricks).
 */
export const stewardProcedure = publicProcedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
    }

    const allowed = ['admin', 'data_steward'];
    if (!allowed.includes(ctx.user.role)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Apenas administradores e Data Stewards podem executar esta ação.",
      });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);
