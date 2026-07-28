import NodeBle from 'node-ble';
import { EventEmitter } from 'node:events';
import type { MessageBus } from 'dbus-next';
import { bleLog, errMsg } from '../types.js';
import type { Adapter } from './dbus.js';
import { forgetPairingAgent } from './agent.js';

/**
 * Persistent D-Bus connection + adapter, reused across scan cycles in
 * continuous mode. Same client owns the discovery session across cycles;
 * same adapter proxy means stopDiscovery() always matches startDiscovery().
 * Minimizes the start/stop cycling that triggers the BlueZ Discovering desync
 * (bluez/bluez#807, bluez/bluer#47).
 *
 * MorphoScan patch: node-ble / BlueZ accumulates PropertiesChanged match rules
 * per discovered device. After ~512 rules the bus emits LimitsExceeded and
 * crashes the process. We (1) listen for bus errors and destroy the connection
 * so the next cycle opens a fresh bus, and (2) treat match-rule errors as stale.
 */
let persistentConn: { bluetooth: NodeBle.Bluetooth; destroy: () => void } | null = null;
let persistentAdapter: Adapter | null = null;

export function getConnection(): { bluetooth: NodeBle.Bluetooth; destroy: () => void } {
  if (!persistentConn) {
    // node-ble adds PropertiesChanged listeners per BlueZ device path; during a
    // busy clinic scan the default MaxListeners=10 floods the journal. Raise the
    // ceiling (RuntimeMaxSec still recycles the process hourly).
    if (EventEmitter.defaultMaxListeners < 64) {
      EventEmitter.defaultMaxListeners = 64;
    }

    persistentConn = NodeBle.createBluetooth();
    bleLog.debug('D-Bus connection established');
    try {
      const bus = (persistentConn.bluetooth as unknown as { dbus: MessageBus }).dbus;
      try {
        (bus as unknown as { setMaxListeners?: (n: number) => void }).setMaxListeners?.(64);
      } catch {
        /* ignore */
      }
      bus.on('error', (err: unknown) => {
        const msg = errMsg(err);
        bleLog.warn(`D-Bus bus error: ${msg} — resetting connection (next scan will reconnect)`);
        // Defer so dbus-next can finish emitting; avoid re-entrancy in destroy.
        setImmediate(() => {
          try {
            resetConnection();
          } catch {
            /* ignore */
          }
        });
      });
    } catch {
      /* bus surface unavailable — LimitsExceeded may still crash; RuntimeMaxSec covers it */
    }
  }
  return persistentConn;
}

/**
 * Underlying dbus-next bus of the persistent connection. node-ble does not type
 * the `dbus` field on Bluetooth, so cast the minimal surface we use (same
 * "declare only what we use" convention as helperOf). Used to register the BlueZ
 * pairing agent (#168).
 */
export function getBus(): MessageBus {
  return (getConnection().bluetooth as unknown as { dbus: MessageBus }).dbus;
}

export async function getAdapter(bleAdapter?: string): Promise<Adapter> {
  const conn = getConnection();
  if (!persistentAdapter) {
    if (bleAdapter) {
      bleLog.debug(`Using adapter: ${bleAdapter}`);
      persistentAdapter = await conn.bluetooth.getAdapter(bleAdapter);
    } else {
      persistentAdapter = await conn.bluetooth.defaultAdapter();
    }
  }
  return persistentAdapter;
}

export function resetConnection(): void {
  persistentAdapter = null;
  if (persistentConn) {
    // Destroying the connection makes BlueZ drop our pairing agent (owner gone),
    // so just forget the local registration; the next connection re-registers.
    forgetPairingAgent();
    try {
      persistentConn.destroy();
    } catch {
      /* ignore */
    }
    persistentConn = null;
    bleLog.debug('D-Bus connection reset');
  }
}

/** Returns true if the error indicates a stale or broken D-Bus connection. */
export function isStaleConnectionError(err: unknown): boolean {
  const msg = errMsg(err);
  return (
    msg.includes('interface not found') ||
    msg.includes('not found in proxy') ||
    msg.includes('connection closed') ||
    msg.includes('The name is not activatable') ||
    msg.includes('was not provided') ||
    // node-ble match-rule leak (max_match_rules_per_connection)
    msg.includes('LimitsExceeded') ||
    msg.includes('max_match_rules') ||
    msg.includes('add more match rules')
  );
}

export function isDbusConnectionError(err: unknown): boolean {
  const msg = errMsg(err);
  return msg.includes('ENOENT') && msg.includes('bus_socket');
}

export function dbusError(): Error {
  return new Error(
    'Cannot connect to D-Bus. Bluetooth is not accessible.\n' +
      'If running in Docker, mount the D-Bus socket:\n' +
      '  -v /var/run/dbus:/var/run/dbus:ro\n' +
      'On the host, ensure bluetoothd is running:\n' +
      '  sudo systemctl start bluetooth',
  );
}

/** Extract the numeric index from an hci adapter name (e.g., 'hci1' -> 1). */
export function parseHciIndex(adapterName?: string): number {
  if (!adapterName) return 0;
  const match = adapterName.match(/^hci(\d+)$/);
  return match ? Number(match[1]) : 0;
}
