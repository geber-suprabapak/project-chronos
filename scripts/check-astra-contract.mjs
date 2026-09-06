import { readFile, writeFile } from "node:fs/promises";
import { isDeepStrictEqual } from "node:util";

const snapshotPath = new URL("../contracts/astra-v1.json", import.meta.url);
const canonicalPath =
  process.env.ASTRA_CONTRACT_PATH ??
  new URL("../../project-astra/contracts/astra-v1.json", import.meta.url);
const shouldSync = process.argv.includes("--sync");

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

const canonical = await readJson(canonicalPath).catch((error) => {
  console.error(
    `Unable to read the canonical Astra contract at ${String(canonicalPath)}: ${error.message}`,
  );
  process.exitCode = 2;
  return null;
});

if (canonical) {
  if (shouldSync) {
    await writeFile(snapshotPath, `${JSON.stringify(canonical, null, 2)}\n`);
    console.log("Chronos Astra contract snapshot synchronized.");
  } else {
    const snapshot = await readJson(snapshotPath);
    if (!isDeepStrictEqual(snapshot, canonical)) {
      console.error(
        "Chronos Astra contract snapshot has drifted. Run `pnpm contract:sync` from a workspace containing project-astra, review the diff, and commit the paired contract change.",
      );
      process.exitCode = 1;
    } else {
      console.log(
        "Chronos Astra contract snapshot matches the canonical Astra contract.",
      );
    }
  }
}
