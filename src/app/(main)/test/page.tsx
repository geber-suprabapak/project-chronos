import { HydrateClient } from "~/trpc/server";

export default async function Home() {
  return (
    <HydrateClient>
        <h1 className="flex flex-1 flex-col gap-6 p-6">hello</h1>
    </HydrateClient>
  );
}
