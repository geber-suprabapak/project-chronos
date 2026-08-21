import { redirect } from "next/navigation";
import { getLogtoContext } from "@logto/next/server-actions";
import { logtoConfig } from "~/lib/logto/config";

export default async function Home() {
  const context = await getLogtoContext(logtoConfig);
  redirect(context.isAuthenticated ? "/dashboard" : "/login");
}
