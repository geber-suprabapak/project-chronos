import { HydrateClient } from "~/trpc/server";

export default async function Home() {
  return (
    <HydrateClient>
        <h1>hello</h1>
    </HydrateClient>
  );
}
