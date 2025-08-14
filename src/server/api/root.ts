// import { postRouter } from "~/server/api/routers/post";
import { absencesRouter } from "~/server/api/routers/absences";
import { perizinanRouter } from "~/server/api/routers/perizinan";
import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";
import { userProfilesRouter } from "~/server/api/routers/user-profiles";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  // post: postRouter,
  absences: absencesRouter,
  perizinan: perizinanRouter,
  userProfiles: userProfilesRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for the tRPC API.
 * @example
 * const trpc = createCaller(createContext);
 * const res = await trpc.post.all();
 *       ^? Post[]
 */
export const createCaller = createCallerFactory(appRouter);
