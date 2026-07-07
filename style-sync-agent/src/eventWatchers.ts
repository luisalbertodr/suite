import fs from "node:fs";
import path from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";

export type DebouncedFn = () => void;

/** Agrupa ráfagas de eventos fs.watch / Realtime en una sola ejecución. */
export function createDebouncer(fn: () => void | Promise<void>, ms: number): DebouncedFn {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      void fn();
    }, ms);
  };
}

function watchTarget(
  targetPath: string,
  onEvent: DebouncedFn,
  log: (msg: string) => void,
  label: string,
): fs.FSWatcher | null {
  const watchPath = fs.existsSync(targetPath)
    ? targetPath
    : fs.existsSync(path.dirname(targetPath))
      ? path.dirname(targetPath)
      : null;
  if (!watchPath) {
    log(`watcher ${label}: ruta no existe (${targetPath})`);
    return null;
  }
  try {
    const watcher = fs.watch(watchPath, { persistent: true }, (_event, filename) => {
      if (!filename) {
        onEvent();
        return;
      }
      const base = path.basename(targetPath).toLowerCase();
      const fn = String(filename).toLowerCase();
      const hit =
        watchPath === targetPath ||
        fn === base ||
        fn.endsWith(".json") ||
        fn.endsWith(".ok");
      if (hit) onEvent();
    });
    watcher.on("error", (err) => {
      log(`watcher ${label} error: ${err instanceof Error ? err.message : String(err)}`);
    });
    log(`watcher ${label}: ${watchPath}`);
    return watcher;
  } catch (err) {
    log(`watcher ${label} omitido: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

export type FileWatcherHandles = {
  cola: fs.FSWatcher | null;
  inbound: fs.FSWatcher | null;
  ack: fs.FSWatcher | null;
  close: () => void;
};

export function startFileWatchers(opts: {
  colaPath: string;
  inboundDir: string;
  ackDir: string;
  debounceMs: number;
  onColaChange: () => void | Promise<void>;
  onInboundDirChange: () => void | Promise<void>;
  onAckDirChange: () => void | Promise<void>;
  log: (msg: string) => void;
}): FileWatcherHandles {
  const debounce = (fn: () => void | Promise<void>) => createDebouncer(fn, opts.debounceMs);

  const cola = watchTarget(opts.colaPath, debounce(opts.onColaChange), opts.log, "cola_sincro");
  const inbound = watchTarget(opts.inboundDir, debounce(opts.onInboundDirChange), opts.log, "inbound");
  const ack = watchTarget(opts.ackDir, debounce(opts.onAckDirChange), opts.log, "inbound_ack");

  return {
    cola,
    inbound,
    ack,
    close: () => {
      for (const w of [cola, inbound, ack]) {
        try {
          w?.close();
        } catch {
          /* ignore */
        }
      }
    },
  };
}

export type RealtimeWatcherHandles = {
  channel: ReturnType<SupabaseClient["channel"]> | null;
  close: () => void;
};

export function startRealtimeWatchers(opts: {
  supabase: SupabaseClient;
  companyId: string;
  onReservasInsert: () => void | Promise<void>;
  onOutboxInsert: () => void | Promise<void>;
  debounceMs: number;
  log: (msg: string) => void;
}): RealtimeWatcherHandles {
  const debounceReservas = createDebouncer(opts.onReservasInsert, opts.debounceMs);
  const debounceOutbox = createDebouncer(opts.onOutboxInsert, opts.debounceMs);

  const channel = opts.supabase
    .channel(`style-sync-${opts.companyId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "dunasoft",
        table: "style_reservas_queue",
        filter: `company_id=eq.${opts.companyId}`,
      },
      () => {
        opts.log("realtime: style_reservas_queue INSERT");
        debounceReservas();
      },
    )
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "dunasoft",
        table: "style_sync_outbox",
        filter: `company_id=eq.${opts.companyId}`,
      },
      () => {
        opts.log("realtime: style_sync_outbox INSERT");
        debounceOutbox();
      },
    )
    .subscribe((status, err) => {
      if (status === "SUBSCRIBED") {
        opts.log("realtime: suscrito a colas dunasoft");
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        opts.log(
          `realtime: ${status}${err ? ` — ${err.message}` : ""} (se usará fallback poll si está activo)`,
        );
      }
    });

  return {
    channel,
    close: () => {
      void opts.supabase.removeChannel(channel);
    },
  };
}
