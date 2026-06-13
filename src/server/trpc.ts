import { initTRPC, TRPCError } from "@trpc/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { db } from "@/db";
import { users, tenants } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ZodError } from "zod";

export async function createTRPCContext() {
  const { userId: clerkId } = await auth();

  if (!clerkId) {
    return { db, user: null, tenant: null, clerkId: null };
  }

  let user = await db.query.users.findFirst({
    where: eq(users.clerkId, clerkId),
  });

  // Auto-provision tenant + user on first login
  if (!user) {
    const clerkUser = await currentUser();
    if (!clerkUser) return { db, user: null, tenant: null, clerkId };

    const email =
      clerkUser.emailAddresses?.[0]?.emailAddress ?? `${clerkId}@unknown.com`;
    const name =
      [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") ||
      email.split("@")[0];

    // Create tenant
    const slug = `org-${clerkId.slice(-8).toLowerCase()}`;
    const [newTenant] = await db
      .insert(tenants)
      .values({ name: `${name}'s Organization`, slug, plan: "starter", status: "active" })
      .returning();

    // Create user linked to tenant
    const [newUser] = await db
      .insert(users)
      .values({ clerkId, tenantId: newTenant.id, email, name, status: "active" })
      .returning();

    user = newUser;
  }

  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.id, user.tenantId),
  });

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
