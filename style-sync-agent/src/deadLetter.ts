import fs from "node:fs";
import path from "node:path";
import { withFsRetry } from "./fsRetry.js";

export type DeadLetterKind = "outbound" | "inbound";

export async function writeDeadLetter(
  rootDir: string,
  kind: DeadLetterKind,
  id: string | number,
  payload: unknown,
  error: unknown,
  stack?: string,
): Promise<string> {
  const ts = Date.now();
  const dir = path.join(rootDir, kind, `${id}_${ts}`);
  const errMsg = error instanceof Error ? error.message : String(error);
  const stacktrace = stack ?? (error instanceof Error ? error.stack : "");

  await withFsRetry(() => {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "payload.json"), JSON.stringify(payload, null, 2), "utf8");
    fs.writeFileSync(path.join(dir, "error.txt"), errMsg, "utf8");
    if (stacktrace) {
      fs.writeFileSync(path.join(dir, "stacktrace.txt"), stacktrace, "utf8");
    }
  }, { label: `deadletter ${kind}/${id}` });

  return dir;
}
