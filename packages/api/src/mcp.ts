import { boardRouter } from "./routers/board";
import { cardRouter } from "./routers/card";
import { checklistRouter } from "./routers/checklist";
import { workspaceRouter } from "./routers/workspace";
import { createTRPCRouter } from "./trpc";

// Reuse the same domain procedures as the GUI without loading unrelated integrations.
export const mcpDomainRouter = createTRPCRouter({
  board: boardRouter,
  card: cardRouter,
  checklist: checklistRouter,
  workspace: workspaceRouter,
});
