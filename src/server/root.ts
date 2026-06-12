import { router } from "./trpc";
import { customersRouter } from "./routers/customers";
import { contractsRouter } from "./routers/contracts";
import { servicesRouter } from "./routers/services";
import { billingRouter } from "./routers/billing";
import { dashboardRouter } from "./routers/dashboard";

export const appRouter = router({
  customers: customersRouter,
  contracts: contractsRouter,
  services: servicesRouter,
  billing: billingRouter,
  dashboard: dashboardRouter,
});

export type AppRouter = typeof appRouter;
