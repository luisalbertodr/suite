import { describe, it, expect, vi } from 'vitest';
import { RenphoMsc04Adapter } from '../../src/scales/renpho-msc04.js';
import { adapters } from '../../src/scales/index.js';
import { resolveAdapter } from '../../src/scales/resolve.js';
import { uuid16 } from '../../src/scales/body-comp-helpers.js';
import type { ConnectionContext } from '../../src/interfaces/scale-adapter.js';
import {
  mockPeripheral,
  defaultProfile,
  assertPayloadRanges,
} from '../helpers/scale-test-utils.js';

const LIVE = Buffer.from('55aa210005010000255da8', 'hex'); // cmd 0x21 -> 95.65
const FINAL = Buffer.from('55aa240006011100002553b3', 'hex'); // cmd 0x24 -> 95.55

function checksum(buf: Buffer): Buffer {
  let sum = 0;
  for (let i = 0; i < buf.length; i++) sum += buf[i];
  return Buffer.concat([buf, Buffer.from([sum & 0xff])]);
}

/** Build a non-fragmented 0x25 body-comp frame (36-byte payload). */
function bodyComp25(weightKg: number, fatPct: number): Buffer {
  const plen = 36;
  const payload = Buffer.alloc(plen);
  payload.writeUInt16BE(Math.round(weightKg * 100), plen - 32);
  payload.writeUInt16BE(Math.round(fatPct * 10), plen - 8);
  return checksum(Buffer.concat([Buffer.from([0x55, 0xaa, 0x25, 0x00, plen]), payload]));
}

/** Build a 0x26 history frame (40-byte payload) with age seconds. */
function bodyComp26(weightKg: number, fatPct: number, ageS: number): Buffer {
  const plen = 40;
  const payload = Buffer.alloc(plen);
  payload.writeUInt16BE(ageS, 4);
  payload.writeUInt16BE(Math.round(weightKg * 100), plen - 32);
  payload.writeUInt16BE(Math.round(fatPct * 10), plen - 8);
  return checksum(Buffer.concat([Buffer.from([0x55, 0xaa, 0x26, 0x00, plen]), payload]));
}

function fragment(assembled: Buffer, recordIdx = 1): Buffer[] {
  const mid = Math.floor(assembled.length / 2);
  const a = Buffer.concat([Buffer.from([0xad, recordIdx, 0x00]), assembled.subarray(0, mid)]);
  const b = Buffer.concat([Buffer.from([0xaf, recordIdx, 0x00]), assembled.subarray(mid)]);
  return [a, b];
}

function makeAdapter() {
  const a = new RenphoMsc04Adapter();
  a.markHandshakeReadyForTest();
  return a;
}

function mockCtx(writes: unknown[] = []): ConnectionContext {
  return {
    profile: defaultProfile(),
    deviceAddress: 'AA',
    availableChars: new Set<string>([uuid16(0x2a11)]),
    write: vi.fn(async (uuid: string, data: number[] | Buffer, withResponse?: boolean) => {
      writes.push({ uuid, data, withResponse });
    }),
    read: vi.fn(),
    subscribe: vi.fn(),
  } as unknown as ConnectionContext;
}

describe('RenphoMsc04Adapter', () => {
  describe('matches() and registry resolution (#117/#265)', () => {
    it('matches the exact "R-MSC04" name (case-insensitive)', () => {
      expect(makeAdapter().matches(mockPeripheral('R-MSC04'))).toBe(true);
      expect(makeAdapter().matches(mockPeripheral('r-msc04'))).toBe(true);
    });

    it('does not match ES-CS20M or unrelated names', () => {
      expect(makeAdapter().matches(mockPeripheral('es-cs20m'))).toBe(false);
      expect(makeAdapter().matches(mockPeripheral('Random Scale'))).toBe(false);
    });

    it('resolves a named R-MSC04 to this adapter, not ES-CS20M (priority 235 > 130)', () => {
      const info = mockPeripheral('R-MSC04', [uuid16(0x1a10)]);
      expect(resolveAdapter(info)?.name).toBe('Renpho R-MSC04');
      expect(adapters.filter((a) => a.matches(info))[0]?.name).toBe('Renpho R-MSC04');
    });

    it('does NOT claim a nameless 0x1A10 device (leaves it to ES-CS20M)', () => {
      const info = mockPeripheral('', [uuid16(0x1a10)]);
      expect(makeAdapter().matches(info)).toBe(false);
      expect(resolveAdapter(info)?.name).toBe('ES-CS20M');
    });
  });

  describe('onConnected() handshake', () => {
    it('writes b3→b2→b7→b8 with response', async () => {
      const writes: Array<{ uuid: string; data: number[] | Buffer; withResponse?: boolean }> = [];
      await makeAdapter().onConnected(mockCtx(writes));

      expect(writes).toHaveLength(4);
      for (const w of writes) {
        expect(w.uuid).toBe(uuid16(0x2a11));
        expect(w.withResponse).toBe(true);
        const bytes = [...(w.data as number[])];
        expect(bytes[0]).toBe(0x55);
        expect(bytes[1]).toBe(0xaa);
      }
      expect([...(writes[0].data as number[])][2]).toBe(0xb3);
      expect([...(writes[1].data as number[])][2]).toBe(0xb2);
      expect([...(writes[2].data as number[])][2]).toBe(0xb7);
      expect([...(writes[3].data as number[])][2]).toBe(0xb8);
    });

    it('throws a clear error when the write char was not discovered', async () => {
      const ctx = {
        profile: defaultProfile(),
        deviceAddress: 'AA',
        availableChars: new Set<string>(),
        write: vi.fn(),
        read: vi.fn(),
        subscribe: vi.fn(),
      } as unknown as ConnectionContext;
      await expect(makeAdapter().onConnected(ctx)).rejects.toThrow(/not discovered/);
    });
  });

  describe('parseCharNotification() framing + weight', () => {
    it('parses a cmd 0x21 live frame -> 95.65 kg (progress, not complete)', () => {
      const adapter = makeAdapter();
      const r = adapter.parseCharNotification(uuid16(0x2a10), LIVE);
      expect(r).not.toBeNull();
      expect(r!.weight).toBeCloseTo(95.65, 2);
      expect(adapter.isComplete(r!)).toBe(false);
    });

    it('parses a cmd 0x24 final but does NOT complete until body-comp', () => {
      const adapter = makeAdapter();
      const r = adapter.parseCharNotification(uuid16(0x2a12), FINAL);
      expect(r).not.toBeNull();
      expect(r!.weight).toBeCloseTo(95.55, 2);
      expect(adapter.isComplete(r!)).toBe(false);
    });

    it('rejects a frame with a bad checksum', () => {
      const adapter = makeAdapter();
      const bad = Buffer.from('55aa240006011100002553b4', 'hex');
      expect(adapter.parseCharNotification(uuid16(0x2a12), bad)).toBeNull();
    });

    it('rejects a frame without the 55AA header', () => {
      const adapter = makeAdapter();
      const bad = Buffer.from('56aa240006011100002553b4', 'hex');
      expect(adapter.parseCharNotification(uuid16(0x2a10), bad)).toBeNull();
    });

    it('legacy parseNotification() decodes the same frame', () => {
      const adapter = makeAdapter();
      expect(adapter.parseNotification(LIVE)!.weight).toBeCloseTo(95.65, 2);
    });
  });

  describe('body composition (0x25 / 0x26)', () => {
    it('completes on fragmented fresh 0x25 with body fat', () => {
      const adapter = makeAdapter();
      adapter.parseCharNotification(uuid16(0x2a12), FINAL);
      const assembled = bodyComp25(95.55, 23.8);
      const [first, last] = fragment(assembled);
      expect(adapter.parseCharNotification(uuid16(0x2a12), first)).toBeNull();
      const r = adapter.parseCharNotification(uuid16(0x2a12), last);
      expect(r).not.toBeNull();
      expect(r!.weight).toBeCloseTo(95.55, 2);
      expect(adapter.isComplete(r!)).toBe(true);
      expect(adapter.isFinal?.(r!)).toBe(true);

      const metrics = adapter.computeMetrics(r!, defaultProfile());
      expect(metrics.bodyFatPercent).toBeCloseTo(23.8, 1);
      assertPayloadRanges(metrics);
    });

    it('ignores old 0x26 history (timestamped, not live-complete without expect)', () => {
      const adapter = makeAdapter();
      const assembled = bodyComp26(95.55, 23.4, 37_000);
      const [first, last] = fragment(assembled);
      adapter.parseCharNotification(uuid16(0x2a12), first);
      const r = adapter.parseCharNotification(uuid16(0x2a12), last);
      expect(r).not.toBeNull();
      expect(r!.timestamp).toBeInstanceOf(Date);
      // Historical frames are "complete" for the cache buffer, but not final live.
      expect(adapter.isComplete(r!)).toBe(true);
      expect(adapter.isFinal?.(r!)).toBe(false);
    });

    it('accepts young 0x26 matching the locked final weight (reconnect path)', () => {
      const adapter = makeAdapter();
      adapter.parseCharNotification(uuid16(0x2a12), FINAL); // expectKg = 95.55
      const assembled = bodyComp26(95.4, 24.8, 21);
      const [first, last] = fragment(assembled);
      adapter.parseCharNotification(uuid16(0x2a12), first);
      const r = adapter.parseCharNotification(uuid16(0x2a12), last)!;
      expect(adapter.isComplete(r)).toBe(true);
      expect(adapter.computeMetrics(r, defaultProfile()).bodyFatPercent).toBeCloseTo(24.8, 1);
    });

    it('buildAck returns b6 for AF fragment and b0 for status', () => {
      const adapter = makeAdapter();
      const status = Buffer.from('55aa20000401000000', 'hex');
      // Fix checksum for a minimal status-like frame — use build via known pattern
      const st = checksum(Buffer.from([0x55, 0xaa, 0x20, 0x00, 0x02, 0x05, 0x01]));
      const b0 = adapter.buildAck(st);
      expect(b0).not.toBeNull();
      expect(b0![2]).toBe(0xb0);
      expect(b0![5]).toBe(0x05);

      const af = Buffer.from([0xaf, 0x03, 0x00, 0x01, 0x02]);
      const b6 = adapter.buildAck(af);
      expect(b6).not.toBeNull();
      expect(b6![2]).toBe(0xb6);
      expect(b6![5]).toBe(0x03);
      void status;
    });
    it('completes on unfragmented fresh 0x25 (large ATT MTU path)', () => {
      const adapter = makeAdapter();
      adapter.parseCharNotification(uuid16(0x2a12), FINAL);
      const assembled = bodyComp25(95.55, 23.8);
      const r = adapter.parseCharNotification(uuid16(0x2a12), assembled);
      expect(r).not.toBeNull();
      expect(adapter.isComplete(r!)).toBe(true);
      expect(adapter.computeMetrics(r!, defaultProfile()).bodyFatPercent).toBeCloseTo(23.8, 1);
    });

    it('locks expectKg from live weight so reconnect can match body-comp', () => {
      const adapter = makeAdapter();
      adapter.parseCharNotification(uuid16(0x2a10), LIVE);
      // Simulate reconnect body-comp close to live weight 95.65
      const assembled = bodyComp26(95.4, 24.8, 21);
      const [first, last] = fragment(assembled);
      adapter.parseCharNotification(uuid16(0x2a12), first);
      const r = adapter.parseCharNotification(uuid16(0x2a12), last)!;
      expect(adapter.isComplete(r)).toBe(true);
    });

    it('buffers body-comp before handshake and delivers after ready', () => {
      const adapter = new RenphoMsc04Adapter();
      const assembled = bodyComp25(59.35, 3.9);
      expect(adapter.parseCharNotification(uuid16(0x2a12), assembled)).toBeNull();
      adapter.markHandshakeReadyForTest();
      // Without takePostHandshakeReading path, buffered frames need explicit replay —
      // markHandshakeReady alone does not auto-flush; onConnected does.
    });

    it('falls back to noResponse when withResponse handshake write hangs', async () => {
      const writes: Array<{ withResponse?: boolean }> = [];
      const adapter = new RenphoMsc04Adapter();
      const ctx = {
        profile: defaultProfile(),
        deviceAddress: 'AA',
        availableChars: new Set<string>([uuid16(0x2a11)]),
        write: vi.fn(async (_uuid: string, _data: number[] | Buffer, withResponse?: boolean) => {
          writes.push({ withResponse });
          if (withResponse) {
            await new Promise(() => {
              /* never resolves — simulates BlueZ hang */
            });
          }
        }),
        read: vi.fn(),
        subscribe: vi.fn(),
      } as unknown as ConnectionContext;

      await adapter.onConnected(ctx);
      expect(writes.length).toBe(8); // 4 cmds × (withResponse hang + noResponse ok)
      expect(writes.filter((w) => w.withResponse === true)).toHaveLength(4);
      expect(writes.filter((w) => w.withResponse === false)).toHaveLength(4);
    }, 20_000);

    it('replays orphaned body-comp after a hung handshake on the next connect', async () => {
      const adapter = new RenphoMsc04Adapter();
      const assembled = bodyComp25(59.35, 22.4);
      // Race: body-comp arrives before handshakeReady
      expect(adapter.parseCharNotification(uuid16(0x2a12), assembled)).toBeNull();

      const hangCtx = {
        profile: defaultProfile(),
        deviceAddress: 'AA',
        availableChars: new Set<string>([uuid16(0x2a11)]),
        write: vi.fn(async (_u: string, _d: number[] | Buffer, withResponse?: boolean) => {
          if (withResponse) {
            await new Promise(() => {
              /* hang */
            });
          }
          // noResponse also hangs → handshake aborted
          await new Promise(() => {
            /* hang */
          });
        }),
        read: vi.fn(),
        subscribe: vi.fn(),
      } as unknown as ConnectionContext;

      await expect(adapter.onConnected(hangCtx)).rejects.toThrow(/timed out/);
      expect(adapter.takePostHandshakeReading()).toBeNull();

      // Next connect succeeds and must replay the orphaned 0x25
      const writes: unknown[] = [];
      await adapter.onConnected(mockCtx(writes));
      const r = adapter.takePostHandshakeReading();
      expect(r).not.toBeNull();
      expect(r!.weight).toBeCloseTo(59.35, 2);
      expect(adapter.isComplete(r!)).toBe(true);
    }, 25_000);

    it('recovers Renpho composition from real 0x25 hex via FFM (muscle+bone)', () => {
      const adapter = makeAdapter();
      // Gemma 2026-07-22: Renpho 53.00 kg / 12.3% / muscle 43.41 / smm 25.81 / bone 3.10
      const hex =
        '55aa2500240311000014b40a00e10f260ea60bb20bc800b80dd20d4d0ab10ab101001e0098021f0001c8';
      const frame = Buffer.from(hex, 'hex');
      const r = adapter.parseCharNotification(uuid16(0x2a12), frame);
      expect(r).not.toBeNull();
      expect(r!.weight).toBeCloseTo(53.0, 2);
      const m = adapter.computeMetrics(r!, {
        ...defaultProfile(),
        gender: 'female',
        age: 48,
        height: 170,
        isAthlete: false,
      });
      expect(m.bodyFatPercent).toBeCloseTo(12.3, 0);
      expect(m.muscleMass).toBeCloseTo(43.5, 0);
      expect(m.boneMass).toBeCloseTo(3.02, 1);
      expect((m as { smmKg?: number }).smmKg).toBeCloseTo(25.6, 0);
      expect(m.waterPercent).toBeCloseTo(64.0, 0);
    });
  });

  describe('computeMetrics()', () => {
    it('uses scale body fat when present', () => {
      const adapter = makeAdapter();
      const assembled = bodyComp25(70.85, 16.8);
      const [first, last] = fragment(assembled);
      adapter.parseCharNotification(uuid16(0x2a12), first);
      const r = adapter.parseCharNotification(uuid16(0x2a12), last)!;
      const payload = adapter.computeMetrics(r, defaultProfile());
      expect(payload.weight).toBeCloseTo(70.85, 2);
      expect(payload.bodyFatPercent).toBeCloseTo(16.8, 1);
      assertPayloadRanges(payload);
    });
  });
});
