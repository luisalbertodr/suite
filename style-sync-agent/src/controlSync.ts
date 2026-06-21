import fs from "node:fs";
import path from "node:path";
import { Dbf } from "dbf-reader";
import { withFsRetry } from "./fsRetry.js";

/** Lee control_sincro.dbf — modo_activo '2' = v2 activo. */
export async function readSyncModoActivo(styleRoot: string): Promise<string> {
  const dbfPath = path.join(styleRoot, "control_sincro.dbf");
  return withFsRetry(
    () => {
      if (!fs.existsSync(dbfPath)) return "2";
      const buf = fs.readFileSync(dbfPath);
      const dt = Dbf.read(buf as unknown as Buffer);
      const row = dt.rows[0] as Record<string, unknown> | undefined;
      const modo = String(row?.modo_activo ?? row?.MODO_ACTIVO ?? "2").trim();
      return modo || "2";
    },
    { label: "read control_sincro.dbf" },
  );
}

export async function isSyncV2Active(styleRoot: string): Promise<boolean> {
  return (await readSyncModoActivo(styleRoot)) === "2";
}
