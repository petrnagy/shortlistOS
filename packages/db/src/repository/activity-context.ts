import { AsyncLocalStorage } from "node:async_hooks";

// Request-local attribution also follows repository calls inside transactions.
const activityContext = new AsyncLocalStorage<string>();
export const withActivityClient = <T>(clientName: string, action: () => T): T =>
  activityContext.run(clientName, action);
export const getActivityClient = () => activityContext.getStore() ?? null;
