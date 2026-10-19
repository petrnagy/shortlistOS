import { TRPCError } from "@trpc/server";
import { z } from "zod";

import * as mcpRepo from "@kan/db/repository/mcp.repo";

import { createTRPCRouter, protectedProcedure } from "../trpc";

export const mcpRouter = createTRPCRouter({
  connections: protectedProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/mcp/connections",
        tags: ["MCP"],
        protect: true,
        summary: "List MCP connections",
      },
    })
    .input(z.void())
    .output(
      z.array(
        z.object({
          publicId: z.string().length(12),
          clientName: z.string(),
          createdAt: z.date(),
          expiresAt: z.date(),
        }),
      ),
    )
    .query(({ ctx }) => {
      if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
      return mcpRepo.listConnections(ctx.db, ctx.user.id);
    }),
  revoke: protectedProcedure
    .meta({
      openapi: {
        method: "DELETE",
        path: "/mcp/connections/{publicId}",
        tags: ["MCP"],
        protect: true,
        summary: "Revoke MCP connection",
      },
    })
    .input(z.object({ publicId: z.string().length(12) }))
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      // Connection management uses browser sessions, never API-key sessions.
      if (
        !ctx.user ||
        ctx.headers.has("authorization") ||
        ctx.headers.has("x-api-key")
      )
        throw new TRPCError({ code: "FORBIDDEN" });
      await mcpRepo.revokeConnection(ctx.db, ctx.user.id, input.publicId);
      return { success: true };
    }),
});
