import { initTRPC, TRPCError } from "@trpc/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { users, tenants } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ZodError } from "zod";

export async function createTRPCContext() {
  const { userId: clerkId, orgId } = await auth();

  if (!clerkId) {
    return { db, user: null, tenant: null };
  }

  const user = await db.query.users.findFirst({
    where: eq(users.clerkId, clerkId),
    with: {
      userRoles: {
        with: {
          // role relation included via schema
        },
      },
    },
  });

  const tenant = user
    ? await db.query.tenants.findFirst({
        where: eq(tenants.id, user.tenantId),
      })
    : null;

  return { db, user, tenant, clerkId };
}

type Context = Awaited<ReturnType<typeof createTRPCContext>>;

const t = initTRPC.context<Context>().create({
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError: error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;

const enforceAuthenticated = t.middleware(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({ ctx: { ...ctx, user: ctx.user, tenant: ctx.tenant! } });
});

export const protectedProcedure = t.procedure.use(enforceAuthenticated);
