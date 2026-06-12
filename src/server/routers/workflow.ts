import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { workflowDefinitions, approvalInstances, approvalSteps, users } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

const workflowStepSchema = z.object({
  name: z.string().min(1),
  approverType: z.enum(["specific_user", "role", "any_admin"]),
  approverId: z.string().uuid().optional(),
  escalationHours: z.number().int().min(1).default(48),
  allowComments: z.boolean().default(true),
});

export const workflowRouter = router({
  // ── Workflow Definitions ─────────────────────────────────────────────────

  listDefinitions: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.query.workflowDefinitions.findMany({
      where: eq(workflowDefinitions.tenantId, ctx.tenant.id),
      orderBy: [desc(workflowDefinitions.createdAt)],
    });
  }),

  createDefinition: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        triggerEvent: z.enum([
          "billing_run_submitted",
          "contract_created",
          "contract_amended",
          "adjustment_added",
        ]),
        steps: z.array(workflowStepSchema).min(1),
        isActive: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [def] = await ctx.db
        .insert(workflowDefinitions)
        .values({ ...input, tenantId: ctx.tenant.id })
        .returning();
      return def;
    }),

  updateDefinition: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().optional(),
        steps: z.array(workflowStepSchema).optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...updates } = input;
      const [updated] = await ctx.db
        .update(workflowDefinitions)
        .set({ ...updates, updatedAt: new Date() })
        .where(and(eq(workflowDefinitions.id, id), eq(workflowDefinitions.tenantId, ctx.tenant.id)))
        .returning();
      return updated;
    }),

  // ── Approval Instances ────────────────────────────────────────────────────

  listInstances: protectedProcedure
    .input(
      z.object({
        status: z.enum(["pending", "approved", "rejected", "cancelled", "all"]).default("pending"),
      })
    )
    .query(async ({ ctx, input }) => {
      const instances = await ctx.db.query.approvalInstances.findMany({
        where: and(
          eq(approvalInstances.tenantId, ctx.tenant.id),
          input.status !== "all" ? eq(approvalInstances.status, input.status) : undefined
        ),
        orderBy: [desc(approvalInstances.startedAt)],
      });
      return instances;
    }),

  getMyPendingSteps: protectedProcedure.query(async ({ ctx }) => {
    const steps = await ctx.db.query.approvalSteps.findMany({
      where: and(
        eq(approvalSteps.approverId, ctx.user.id),
        eq(approvalSteps.status, "pending")
      ),
      with: { approvalInstance: true },
      orderBy: [desc(approvalSteps.createdAt)],
    });
    return steps;
  }),

  createInstance: protectedProcedure
    .input(
      z.object({
        workflowDefinitionId: z.string().uuid(),
        entityType: z.string(),
        entityId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const definition = await ctx.db.query.workflowDefinitions.findFirst({
        where: and(
          eq(workflowDefinitions.id, input.workflowDefinitionId),
          eq(workflowDefinitions.tenantId, ctx.tenant.id),
          eq(workflowDefinitions.isActive, true)
        ),
      });

      if (!definition) throw new TRPCError({ code: "NOT_FOUND", message: "Workflow definition not found" });

      const [instance] = await ctx.db
        .insert(approvalInstances)
        .values({
          tenantId: ctx.tenant.id,
          workflowDefinitionId: input.workflowDefinitionId,
          entityType: input.entityType,
          entityId: input.entityId,
          status: "pending",
          currentStep: 0,
        })
        .returning();

      // Create the first step
      const steps = definition.steps as Array<{
        name: string;
        approverType: string;
        approverId?: string;
        escalationHours: number;
      }>;

      if (steps.length > 0 && steps[0].approverId) {
        await ctx.db.insert(approvalSteps).values({
          approvalInstanceId: instance.id,
          stepOrder: 0,
          approverId: steps[0].approverId,
          status: "pending",
        });
      }

      return instance;
    }),

  actionStep: protectedProcedure
    .input(
      z.object({
        stepId: z.string().uuid(),
        action: z.enum(["approve", "reject"]),
        comments: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const step = await ctx.db.query.approvalSteps.findFirst({
        where: and(
          eq(approvalSteps.id, input.stepId),
          eq(approvalSteps.approverId, ctx.user.id),
          eq(approvalSteps.status, "pending")
        ),
        with: { approvalInstance: true },
      });

      if (!step) throw new TRPCError({ code: "NOT_FOUND", message: "Step not found or already actioned" });

      const newStatus = input.action === "approve" ? "approved" : "rejected";

      await ctx.db
        .update(approvalSteps)
        .set({ status: newStatus, actionedAt: new Date(), comments: input.comments ?? null })
        .where(eq(approvalSteps.id, input.stepId));

      // Update the parent instance
      if (input.action === "reject") {
        await ctx.db
          .update(approvalInstances)
          .set({ status: "rejected", completedAt: new Date() })
          .where(eq(approvalInstances.id, step.approvalInstanceId));
      } else {
        // Check if there are more steps
        const definition = await ctx.db.query.workflowDefinitions.findFirst({
          where: eq(workflowDefinitions.id, step.approvalInstance.workflowDefinitionId!),
        });

        const steps = (definition?.steps ?? []) as Array<{ approverId?: string }>;
        const nextStepIdx = (step.approvalInstance.currentStep ?? 0) + 1;

        if (nextStepIdx >= steps.length) {
          // All steps approved
          await ctx.db
            .update(approvalInstances)
            .set({ status: "approved", completedAt: new Date(), currentStep: nextStepIdx })
            .where(eq(approvalInstances.id, step.approvalInstanceId));
        } else {
          // Advance to next step
          await ctx.db
            .update(approvalInstances)
            .set({ currentStep: nextStepIdx })
            .where(eq(approvalInstances.id, step.approvalInstanceId));

          if (steps[nextStepIdx]?.approverId) {
            await ctx.db.insert(approvalSteps).values({
              approvalInstanceId: step.approvalInstanceId,
              stepOrder: nextStepIdx,
              approverId: steps[nextStepIdx].approverId!,
              status: "pending",
            });
          }
        }
      }

      return { success: true };
    }),
});
