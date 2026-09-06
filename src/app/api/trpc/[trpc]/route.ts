import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { type NextRequest } from "next/server";

import { appRouter } from "~/server/api/root";
import { createTRPCContext } from "~/server/api/trpc";
import { createAstraRequestId } from "~/lib/astra/request-id";
import { runWithRequestId } from "~/lib/astra/request-context";
import { writeOperationalEvent } from "~/lib/observability";

/**
 * This wraps the `createTRPCContext` helper and provides the required context for the tRPC API when
 * handling a HTTP request (e.g. when you make requests from Client Components).
 */
const createContext = async (req: NextRequest) => {
  return createTRPCContext({
    headers: req.headers,
  });
};

const handler = async (req: NextRequest) => {
  const requestId = createAstraRequestId(req.headers.get("X-Request-ID"));

  return runWithRequestId(requestId, async () => {
    const response = await fetchRequestHandler({
      endpoint: "/api/trpc",
      req,
      router: appRouter,
      createContext: () => createContext(req),
      responseMeta: () => ({
        headers: {
          "X-Request-ID": requestId,
        },
      }),
      onError: ({ path, error }) => {
        writeOperationalEvent({
          event:
            error.code === "UNAUTHORIZED" || error.code === "FORBIDDEN"
              ? "auth.failure"
              : "trpc.error",
          outcome: "failure",
          requestId,
          path,
          code: error.code,
        });
      },
    });

    response.headers.set("X-Request-ID", requestId);
    return response;
  });
};

export { handler as GET, handler as POST };
