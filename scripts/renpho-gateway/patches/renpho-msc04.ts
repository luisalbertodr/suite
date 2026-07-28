import type {
  BleDeviceInfo,
  CharacteristicBinding,
  ConnectionContext,
  ScaleAdapterCore,
  GattWiring,
  MultiCharNotify,
  AckProtocol,
  HoldForComposition,
  ScaleReading,
  UserProfile,
  BodyComposition,
} from '../interfaces/scale-adapter.js';
import { uuid16, buildPayload, type ScaleBodyComp } from './body-comp-helpers.js';
import { matchesDescriptor, type MatchDescriptor } from './match-descriptor.js';
import { bleLog } from '../ble/types.js';

// ─── Renpho R-MSC04 / MorphoScan Nova (55AA framed, vendor service 0x1A10) ───

const CHR_NOTIFY = uuid16(0x2a10); // live weight (cmd 0x21)
const CHR_WRITE = uuid16(0x2a11); // handshake + acks
const CHR_INDICATE = uuid16(0x2a12); // status / final / body-comp

const HDR0 = 0x55;
const HDR1 = 0xaa;
const CMD_STATUS = 0x20;
const CMD_LIVE = 0x21;
const CMD_FINAL = 0x24;
const CMD_BODY_LIVE = 0x25; // current measurement
const CMD_BODY_HIST = 0x26; // stored history record

const FRAG_FIRST = 0xad;
const FRAG_MID = 0xae;
const FRAG_LAST = 0xaf;

const FRAME_OVERHEAD = 6;
const HANDSHAKE_GAP_MS = 400;
const HANDSHAKE_GAP_RECONNECT_MS = 200;
/** Per-frame GATT write budget; BlueZ can hang forever on withResponse. */
const HANDSHAKE_WRITE_TIMEOUT_MS = 2_000;
/** Keep early 0x25/0x26 across a hung/dropped handshake for the next connect. */
const ORPHAN_BODY_COMP_MAX_AGE_MS = 120_000;
/** After this many reconnects without body-comp, export weight-only. */
const WEIGHT_ONLY_AFTER_SESSIONS = 3;
/** Accept a stored 0x26 as this weigh-in when age < this and weight matches. */
const FRESH_AGE_S = 60;
const MATCH_AGE_S = 1800;
const MATCH_WEIGHT_KG = 0.8;
/** Cache Suite pending profile to avoid delaying the BLE handshake. */
const PENDING_CACHE_MS = 45_000;
/** Max wait for pending profile before handshake (ms). Cache/config used if slower. */
const PENDING_HANDSHAKE_WAIT_MS = 350;

type CachedComp = ScaleBodyComp & {
  bodyFat?: number;
  /** Full 55AA frame hex for offset hunting / Suite raw_payload. */
  frameHex?: string;
  cmd?: number;
  payloadLen?: number;
  weightOnly?: boolean;
  /** Dual-frequency whole-body-ish impedances (Ohm). */
  impedanceOhm?: number;
  impedanceOhm2?: number;
  /** Segmental DF-BIA map for Suite `impedance` jsonb. */
  impedanceMap?: {
    '20khz': Record<string, number>;
    '100khz': Record<string, number>;
  };
  /** How body-fat % was obtained for this frame. */
  fatSource?: 'frame' | 'from_ffm' | 'from_water' | 'none';
  /** Renpho "masa muscular" (kg), not skeletal %. */
  muscleMassKg?: number;
  /** Skeletal muscle mass (kg). */
  smmKg?: number;
};

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function handshakeCmdLabel(frame: number[] | Buffer): string {
  const cmd = Array.isArray(frame) ? frame[2] : frame[2];
  return cmd != null ? cmd.toString(16) : '?';
}

async function writeWithTimeout(
  write: ConnectionContext['write'],
  uuid: string,
  data: number[] | Buffer,
  withResponse: boolean,
  timeoutMs: number,
  label: string,
): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      write(uuid, data, withResponse),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(
            new Error(
              `handshake write 0x${label} timed out after ${timeoutMs}ms ` +
                `(${withResponse ? 'withResponse' : 'noResponse'})`,
            ),
          );
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

/** Build a checksummed 55AA frame: cmd + payload. */
function buildFrame(cmd: number, payload: number[]): number[] {
  const len = payload.length;
  const out = [HDR0, HDR1, cmd, (len >> 8) & 0xff, len & 0xff, ...payload];
  let sum = 0;
  for (const b of out) sum += b;
  out.push(sum & 0xff);
  return out;
}

/**
 * Handshake frames (b3→b2→b7→b8) reverse-engineered from the Renpho app
 * (joelr/r-msc04-bridge). b7/b8 carry the profile the scale uses for BIA.
 * Weight is always correct; body-fat % is computed against this profile until
 * a clinic-specific capture replaces HS_B8 / buildProfileB8().
 */
const HS_B3 = [
  0x55, 0xaa, 0xb3, 0x00, 0x0b, 0x00, 0x07, 0x01, 0x01, 0x6a, 0x47, 0x8e, 0xb1, 0x02, 0x58, 0x00,
  0x10,
];
const HS_B2 = [
  0x55, 0xaa, 0xb2, 0x00, 0x09, 0x01, 0x01, 0x07, 0x4e, 0x25, 0x71, 0xa8, 0x03, 0x02, 0x54,
];

function buildNameB7(name: string, seq = 0x02): number[] {
  const ascii = [...Buffer.from(name.slice(0, 8), 'ascii')];
  // payload: seq + 01 00 01 00 + len + ascii  (matches app capture layout)
  const payload = [seq, 0x01, 0x00, 0x01, 0x00, ascii.length, ...ascii];
  return buildFrame(0xb7, payload);
}

type PendingScaleProfile = {
  height: number;
  age: number;
  gender: 'male' | 'female';
  name: string;
};

let pendingCache: { at: number; profile: PendingScaleProfile | null } | null = null;

/**
 * Fetch open «Pesar ahora» profile from Suite scale-ingest (?pending=1).
 * Falls back to null so the adapter uses config.yaml users[0].
 */
async function fetchPendingScaleProfile(): Promise<PendingScaleProfile | null> {
  const now = Date.now();
  if (pendingCache && now - pendingCache.at < PENDING_CACHE_MS) {
    return pendingCache.profile;
  }

  const secret = (process.env.SCALE_INGEST_SECRET || '').trim();
  const companyId = (process.env.SUITE_COMPANY_ID || '').trim();
  if (!secret || !companyId) return null;

  const base =
    (process.env.SCALE_INGEST_URL || 'https://supabase.lipoout.com/functions/v1/scale-ingest').replace(
      /\/$/,
      '',
    );
  const url = `${base}?pending=1`;

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'X-Scale-Ingest-Secret': secret,
        'X-Suite-Company-Id': companyId,
      },
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) {
      bleLog.debug(`Renpho R-MSC04: pending profile HTTP ${res.status}`);
      return pendingCache?.profile ?? null;
    }
    const body = (await res.json()) as {
      pending?: boolean;
      ready?: boolean;
      height_cm?: number;
      age_years?: number;
      gender?: string;
      name?: string;
    };
    if (!body.pending || !body.ready) {
      pendingCache = { at: now, profile: null };
      return null;
    }
    const height = Number(body.height_cm);
    const age = Number(body.age_years);
    const gender = body.gender === 'female' ? 'female' : body.gender === 'male' ? 'male' : null;
    if (!(height > 0) || !(age > 0) || !gender) {
      pendingCache = { at: now, profile: null };
      return null;
    }
    const profile: PendingScaleProfile = {
      height,
      age,
      gender,
      name: (body.name || 'Suite').slice(0, 8),
    };
    pendingCache = { at: Date.now(), profile };
    return profile;
  } catch (e) {
    bleLog.debug(
      `Renpho R-MSC04: pending profile fetch failed: ${e instanceof Error ? e.message : String(e)}`,
    );
    return pendingCache?.profile ?? null;
  }
}

/** Prefer cached pending; refresh in background. Never block handshake > PENDING_HANDSHAKE_WAIT_MS. */
async function resolvePendingForHandshake(): Promise<PendingScaleProfile | null> {
  const cached =
    pendingCache && Date.now() - pendingCache.at < PENDING_CACHE_MS ? pendingCache.profile : null;
  const fetchP = fetchPendingScaleProfile();
  if (cached !== null || (pendingCache && Date.now() - pendingCache.at < PENDING_CACHE_MS)) {
    void fetchP;
    return cached;
  }
  return await Promise.race([
    fetchP,
    sleep(PENDING_HANDSHAKE_WAIT_MS).then(() => pendingCache?.profile ?? null),
  ]);
}

/**
 * Profile frame b8. Layout is only partially known; we overlay sex/height/age
 * onto the verified capture so BIA unlocks, then refine fields from profile.
 * Capture baseline: male / ~44y / ~188 cm (joelr). Overlay:
 *   payload[7]  = sex (1 male, 0 female) — observed
 *   payload[9]  = height cm (best-effort; was 0xfe in capture)
 *   payload[11] = age years (best-effort; was 0x7d in capture)
 */
function buildProfileB8(profile: UserProfile, seq = 0x03): number[] {
  const sex = profile.gender === 'male' ? 1 : 0;
  const height = Math.max(100, Math.min(220, Math.round(profile.height)));
  const age = Math.max(10, Math.min(100, Math.round(profile.age)));
  const payload = [
    seq,
    0x01,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    sex,
    0x00,
    height & 0xff,
    0x00,
    age & 0xff,
  ];
  return buildFrame(0xb8, payload);
}

function checksumOk(data: Buffer, frameLen: number): boolean {
  let sum = 0;
  for (let i = 0; i < frameLen - 1; i++) sum += data[i];
  return (sum & 0xff) === data[frameLen - 1];
}

/**
 * Extra 0x25 fields verified vs Renpho report + MorphoScan hex (Gemma 53 kg):
 *   muscle mass kg = [0:2] LE/100
 *   skeletal muscle = [6:8] BE/100
 *   bone kg         = [15:17] BE/1000
 * DF-BIA impedances (Ohm, BE/10) around [7..23]:
 *   20 kHz: T≈[7], LA≈[9], RA≈[11], RL≈[13], LL≈LE[12]
 *   100 kHz: LA≈[19], RA≈[21], RL/LL≈[23], T≈LE[16]
 */
function parseMsc04BodyFields(
  payload: Buffer,
  plen: number,
  cmd?: number,
): {
  muscleMassKg?: number;
  smmKg?: number;
  boneKg?: number;
  z1?: number;
  z2?: number;
  impedance?: {
    '20khz': Record<string, number>;
    '100khz': Record<string, number>;
  };
} {
  const out: {
    muscleMassKg?: number;
    smmKg?: number;
    boneKg?: number;
    z1?: number;
    z2?: number;
    impedance?: {
      '20khz': Record<string, number>;
      '100khz': Record<string, number>;
    };
  } = {};

  /**
   * Field base offset:
   * - 0x25 live (plen 36): composition starts at 0.
   * - 0x26 history (plen 40): age sits at [4:6]; muscle mass stays at [0:2].
   *   Using base=4 here misreads age (e.g. 14s → 35.84 kg "muscle") and
   *   blows up FFM-derived fat % (clinic saw 11.9% vs 26.6% same person).
   * - Some long 0x25 frames may need base 4; only use it when base 0 muscle
   *   is out of range and base 4 looks like real muscle mass.
   */
  const mus0 = payload.length >= 2 ? payload.readUInt16LE(0) / 100 : Number.NaN;
  const mus4 = payload.length >= 6 ? payload.readUInt16LE(4) / 100 : Number.NaN;
  const mus0Ok = mus0 >= 15 && mus0 <= 90;
  const mus4Ok = mus4 >= 15 && mus4 <= 90;
  let base = 0;
  if (cmd === CMD_BODY_HIST) {
    base = 0;
  } else if (!mus0Ok && mus4Ok && plen >= 40) {
    base = 4;
  } else {
    base = 0;
  }

  if (payload.length >= base + 2) {
    const muscleMassKg = payload.readUInt16LE(base) / 100;
    if (muscleMassKg >= 15 && muscleMassKg <= 90) out.muscleMassKg = muscleMassKg;
  }
  if (payload.length >= base + 8) {
    const smmKg = payload.readUInt16BE(base + 6) / 100;
    if (smmKg >= 10 && smmKg <= 60) out.smmKg = smmKg;
  }
  // 0x26 inserts age+pad at [4:8]; SMM often sits 4 bytes later than on 0x25.
  if (out.smmKg == null && cmd === CMD_BODY_HIST && payload.length >= 12) {
    const smmShifted = payload.readUInt16BE(10) / 100;
    if (smmShifted >= 10 && smmShifted <= 60) out.smmKg = smmShifted;
  }
  if (payload.length >= base + 17) {
    const boneKg = payload.readUInt16BE(base + 15) / 1000;
    if (boneKg >= 1.5 && boneKg <= 6) out.boneKg = boneKg;
  }
  if (payload.length >= base + 12) {
    const z1 = payload.readUInt16LE(base + 8) / 10;
    const z2 = payload.readUInt16LE(base + 10) / 10;
    if (z1 >= 100 && z1 <= 1500) out.z1 = z1;
    if (z2 >= 100 && z2 <= 1500) out.z2 = z2;
  }

  // Segmental DF-BIA (best-effort; cross-checked with Renpho report ±10 Ω)
  if (payload.length >= base + 26) {
    const be10 = (i: number) => payload.readUInt16BE(base + i) / 10;
    const le10 = (i: number) => payload.readUInt16LE(base + i) / 10;
    const z20: Record<string, number> = {};
    const z100: Record<string, number> = {};
    const t20 = be10(7);
    const la20 = be10(9);
    const ra20 = be10(11);
    const rl20 = be10(13);
    const ll20 = le10(12);
    if (t20 >= 10 && t20 <= 80) z20.trunk = Math.round(t20 * 10) / 10;
    if (la20 >= 200 && la20 <= 600) z20.left_arm = Math.round(la20 * 10) / 10;
    if (ra20 >= 200 && ra20 <= 600) z20.right_arm = Math.round(ra20 * 10) / 10;
    if (rl20 >= 200 && rl20 <= 500) z20.right_leg = Math.round(rl20 * 10) / 10;
    if (ll20 >= 200 && ll20 <= 500) z20.left_leg = Math.round(ll20 * 10) / 10;
    const la100 = be10(19);
    const ra100 = be10(21);
    const leg100 = be10(23);
    const t100 = le10(16);
    if (la100 >= 200 && la100 <= 600) z100.left_arm = Math.round(la100 * 10) / 10;
    if (ra100 >= 200 && ra100 <= 600) z100.right_arm = Math.round(ra100 * 10) / 10;
    if (leg100 >= 200 && leg100 <= 500) {
      z100.right_leg = Math.round(leg100 * 10) / 10;
      z100.left_leg = Math.round(leg100 * 10) / 10;
    }
    if (t100 >= 10 && t100 <= 80) z100.trunk = Math.round(t100 * 10) / 10;
    if (Object.keys(z20).length >= 3 || Object.keys(z100).length >= 2) {
      out.impedance = { '20khz': z20, '100khz': z100 };
    }
  }
  return out;
}

/**
 * Adapter for Renpho R-MSC04 / MorphoScan Nova.
 *
 * Weight-only upstream (ble-scale-sync 1.21) left impedance at 0. This patch
 * ports the verified protocol from joelr/r-msc04-bridge:
 *   handshake → ack history → expect disconnect → continuous-mode reconnect
 *   → accept fresh 0x25 / young matching 0x26 with body-fat %.
 *
 * Segmental / protein / subcutaneous offsets in the 40-byte payload are still
 * unmapped; Suite already has columns for them when we extend the decode.
 */
export class RenphoMsc04Adapter
  implements ScaleAdapterCore, GattWiring, MultiCharNotify, AckProtocol, HoldForComposition
{
  readonly name = 'Renpho R-MSC04';
  readonly match: MatchDescriptor = {
    priority: 235,
    custom: true,
    names: { exact: ['r-msc04'] },
  };
  readonly charNotifyUuid = CHR_NOTIFY;
  readonly charWriteUuid = CHR_WRITE;
  readonly normalizesWeight = true;
  readonly ackWithResponse = true;
  /** Hold briefly if body-comp arrives on the same connection as the final weight. */
  readonly completionHoldMs = 25_000;

  readonly characteristics: CharacteristicBinding[] = [
    { uuid: CHR_WRITE, type: 'write' },
    { uuid: CHR_NOTIFY, type: 'notify' },
    { uuid: CHR_INDICATE, type: 'notify' },
  ];

  private finalReceived = false;
  private finalWeight = 0;
  /** Cross-session: locked/live weight waiting for BIA after the scale hangs up. */
  private expectKg = Number.NaN;
  private expectAtMs = 0;
  private sessionsSinceExpect = 0;
  private weightOnlyFallback = false;
  private lastLiveWeight = 0;
  /**
   * shared.ts subscribes BEFORE onConnected(). The scale often dumps a 0x25
   * immediately with a guest/default profile (e.g. 3.9% fat). Buffer it and
   * replay after handshake (FFM-derived fat is still usable; joelr fat is not).
   */
  private handshakeReady = false;
  /** Assembled 0x25/0x26 frames that arrived before handshake finished (this session). */
  private earlyBodyComp: Buffer[] = [];
  /**
   * Cross-session stash: body-comp that arrived while handshake hung or the link
   * dropped before b3→b8 finished. Replayed on the next successful handshake.
   */
  private orphanedBodyComp: Buffer[] = [];
  private orphanedAtMs = 0;
  /** Complete reading recovered from early body-comp, consumed by shared.ts. */
  private postHandshakeReading: ScaleReading | null = null;

  private fragBuf = Buffer.alloc(0);

  private cachedComp: CachedComp = {};
  private readonly compByReading = new WeakMap<ScaleReading, CachedComp>();
  /** Last profile used in handshake (Pesar ahora or config) for computeMetrics. */
  private lastProfile: UserProfile | null = null;
  /** Connected scale MAC (uppercase, no separators) for Suite scale-id. */
  private lastDeviceMac = '';

  matches(device: BleDeviceInfo): boolean {
    return matchesDescriptor(device, this.match);
  }

  async onConnected(ctx: ConnectionContext): Promise<void> {
    this.finalReceived = false;
    this.finalWeight = 0;
    this.fragBuf = Buffer.alloc(0);
    this.cachedComp = {};
    this.handshakeReady = false;
    // Keep orphans from a previous hung handshake; only reset this-session queue.
    this.earlyBodyComp = [];
    this.lastDeviceMac = (ctx.deviceAddress || '').replace(/[^a-fA-F0-9]/g, '').toUpperCase();
    if (this.lastDeviceMac) {
      bleLog.info(`Renpho R-MSC04: connected MAC ${this.lastDeviceMac}`);
    }
    this.pruneOrphans();
    if (this.orphanedBodyComp.length > 0) {
      bleLog.info(
        `Renpho R-MSC04: ${this.orphanedBodyComp.length} orphaned body-comp frame(s) ` +
          `pending replay after handshake`,
      );
    }

    // Drop stale expect from a previous person / abandoned session (>15 min).
    if (!Number.isNaN(this.expectKg) && Date.now() - this.expectAtMs > 15 * 60_000) {
      this.clearExpect();
    }

    if (!Number.isNaN(this.expectKg)) {
      this.sessionsSinceExpect += 1;
      if (this.sessionsSinceExpect >= WEIGHT_ONLY_AFTER_SESSIONS) {
        this.weightOnlyFallback = true;
        bleLog.info(
          `Renpho R-MSC04: no body-comp after ${this.sessionsSinceExpect} sessions — weight-only fallback`,
        );
      }
    }

    if (!ctx.availableChars.has(CHR_WRITE)) {
      throw new Error(
        `Renpho R-MSC04: write characteristic (${CHR_WRITE}) not discovered. ` +
          'Likely a transient GATT discovery race. Try again.',
      );
    }

    // Never stall BLE >350ms waiting for Suite pending profile.
    const pending = await resolvePendingForHandshake();
    const effectiveProfile: UserProfile = pending
      ? {
          height: pending.height,
          age: pending.age,
          gender: pending.gender,
          isAthlete: ctx.profile.isAthlete,
        }
      : ctx.profile;
    this.lastProfile = effectiveProfile;
    const displayName = pending?.name || 'Suite';

    const nameFrame = buildNameB7(displayName);
    const profileFrame = buildProfileB8(effectiveProfile);
    // On reconnect (we already locked a weight), still handshake — the scale
    // needs it to dump the fresh 0x26 — but use a tighter gap.
    const gap =
      !Number.isNaN(this.expectKg) && this.sessionsSinceExpect > 0
        ? HANDSHAKE_GAP_RECONNECT_MS
        : HANDSHAKE_GAP_MS;
    const handshake = [HS_B3, HS_B2, nameFrame, profileFrame];

    try {
      for (const frame of handshake) {
        await this.writeHandshakeFrame(ctx, frame);
        await sleep(gap);
      }
    } catch (e) {
      // earlyBodyComp frames were already stashed on buffer; refresh TTL if any remain.
      if (this.earlyBodyComp.length > 0) {
        this.orphanedAtMs = Date.now();
      }
      const msg = e instanceof Error ? e.message : String(e);
      bleLog.info(`Renpho R-MSC04: handshake aborted — ${msg}`);
      throw e;
    }

    this.handshakeReady = true;
    bleLog.info(
      `Renpho R-MSC04: handshake sent ` +
        `(${pending ? 'Pesar ahora' : 'config'} ` +
        `${effectiveProfile.gender}/${effectiveProfile.age}y/${effectiveProfile.height}cm` +
        `${!Number.isNaN(this.expectKg) ? `; expect ${this.expectKg.toFixed(2)} kg` : ''})`,
    );

    // Replay body-comp that arrived during the subscribe→handshake race, then
    // any orphans left from a previous hung connect (deduped by hex).
    this.postHandshakeReading = null;
    const queued: Buffer[] = [];
    const seen = new Set<string>();
    for (const frame of [...this.earlyBodyComp.splice(0), ...this.orphanedBodyComp.splice(0)]) {
      const hex = frame.toString('hex');
      if (seen.has(hex)) continue;
      seen.add(hex);
      queued.push(frame);
    }
    this.orphanedAtMs = 0;
    if (queued.length > 0) {
      bleLog.info(`Renpho R-MSC04: replaying ${queued.length} early body-comp frame(s)`);
      for (const frame of queued) {
        const r = this.decodeBodyCompFrame(frame);
        if (r && this.isComplete(r)) {
          this.postHandshakeReading = r;
          break;
        }
      }
    }
  }

  /** GATT write with timeout; falls back to no-response if withResponse hangs. */
  private async writeHandshakeFrame(
    ctx: ConnectionContext,
    frame: number[],
  ): Promise<void> {
    const label = handshakeCmdLabel(frame);
    const t0 = Date.now();
    try {
      await writeWithTimeout(
        ctx.write,
        CHR_WRITE,
        frame,
        true,
        HANDSHAKE_WRITE_TIMEOUT_MS,
        label,
      );
      bleLog.info(
        `Renpho R-MSC04: handshake write 0x${label} ok (${Date.now() - t0}ms, withResponse)`,
      );
      return;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      bleLog.info(
        `Renpho R-MSC04: handshake write 0x${label} failed (${msg}); retry without response`,
      );
    }
    await writeWithTimeout(
      ctx.write,
      CHR_WRITE,
      frame,
      false,
      HANDSHAKE_WRITE_TIMEOUT_MS,
      label,
    );
    bleLog.info(
      `Renpho R-MSC04: handshake write 0x${label} ok (${Date.now() - t0}ms, noResponse)`,
    );
  }

  private pruneOrphans(): void {
    if (this.orphanedBodyComp.length === 0) return;
    if (Date.now() - this.orphanedAtMs > ORPHAN_BODY_COMP_MAX_AGE_MS) {
      bleLog.info(
        `Renpho R-MSC04: dropping ${this.orphanedBodyComp.length} stale orphaned body-comp frame(s)`,
      );
      this.orphanedBodyComp = [];
      this.orphanedAtMs = 0;
    }
  }

  private stashOrphans(frames: Buffer[]): void {
    if (frames.length === 0) return;
    const existing = new Set(this.orphanedBodyComp.map((b) => b.toString('hex')));
    let added = 0;
    for (const f of frames) {
      const hex = f.toString('hex');
      if (existing.has(hex)) continue;
      existing.add(hex);
      this.orphanedBodyComp.push(Buffer.from(f));
      added += 1;
    }
    while (this.orphanedBodyComp.length > 4) this.orphanedBodyComp.shift();
    this.orphanedAtMs = Date.now();
    if (added > 0) {
      bleLog.info(
        `Renpho R-MSC04: stashed ${added} body-comp frame(s) for next handshake ` +
          `(orphan queue=${this.orphanedBodyComp.length})`,
      );
    }
  }

  /**
   * shared.ts peeks this after onConnected(). The synthetic 0xff 0xfe notify
   * delivers and clears the reading via parseCharNotification.
   */
  takePostHandshakeReading(): ScaleReading | null {
    return this.postHandshakeReading;
  }

  /** Vitest helper — production path sets this at the end of onConnected(). */
  markHandshakeReadyForTest(): void {
    this.handshakeReady = true;
  }

  /**
   * Ack 0x20 status counters (b0) and completed body-comp fragment sets (b6).
   * Note: shared.ts calls buildAck BEFORE parseCharNotification, so the b6 ack
   * must be derived from the AF fragment itself (record index at byte 1).
   */
  buildAck(data: Buffer): number[] | null {
    if (data.length >= 7 && data[0] === HDR0 && data[1] === HDR1 && data[2] === CMD_STATUS) {
      return buildFrame(0xb0, [data[5], 0x01]);
    }
    if (data.length >= 3 && data[0] === FRAG_LAST) {
      return buildFrame(0xb6, [data[1], 0x01]);
    }
    return null;
  }

  parseCharNotification(_charUuid: string, data: Buffer): ScaleReading | null {
    // Synthetic flush from shared.ts after onConnected (early body-comp race).
    if (data.length === 2 && data[0] === 0xff && data[1] === 0xfe && this.postHandshakeReading) {
      const r = this.postHandshakeReading;
      this.postHandshakeReading = null;
      bleLog.info(`Renpho R-MSC04: delivering post-handshake reading ${r.weight.toFixed(2)} kg`);
      return r;
    }

    // Fragmented body-comp on indicate characteristic
    if (data.length >= 3 && (data[0] === FRAG_FIRST || data[0] === FRAG_MID || data[0] === FRAG_LAST)) {
      bleLog.info(
        `Renpho R-MSC04: frag 0x${data[0].toString(16)} #${data[1]} len=${data.length}`,
      );
      return this.handleFragment(data);
    }

    // Unfragmented 0x25/0x26 (large ATT MTU) — must NOT go through weight-only decodeFrame.
    if (
      data.length >= 8 &&
      data[0] === HDR0 &&
      data[1] === HDR1 &&
      (data[2] === CMD_BODY_LIVE || data[2] === CMD_BODY_HIST)
    ) {
      return this.decodeBodyCompFrame(data);
    }

    const frame = this.decodeFrame(data);
    if (!frame) {
      if (data.length >= 3 && data[0] === HDR0 && data[1] === HDR1) {
        bleLog.info(
          `Renpho R-MSC04: ignore cmd 0x${data[2].toString(16)} len=${data.length} ` +
            `hex=${data.subarray(0, Math.min(data.length, 24)).toString('hex')}`,
        );
      }
      return null;
    }

    if (frame.cmd === CMD_LIVE) {
      this.lastLiveWeight = frame.weight;
      // Lock expect early so a hang-up mid-BIA still matches the later 0x26.
      this.noteExpect(frame.weight);
      if (this.weightOnlyFallback) {
        bleLog.info(`Renpho R-MSC04: weight-only fallback ${frame.weight.toFixed(2)} kg (live)`);
        const reading: ScaleReading = { weight: frame.weight, impedance: 0 };
        this.compByReading.set(reading, { weightOnly: true });
        this.finalReceived = true;
        this.clearExpect();
        return reading;
      }
      return { weight: frame.weight, impedance: 0 };
    }

    if (frame.cmd === CMD_FINAL) {
      this.finalReceived = true;
      this.finalWeight = frame.weight;
      this.noteExpect(frame.weight);
      bleLog.info(`Renpho R-MSC04: final weight ${frame.weight.toFixed(2)} kg — waiting for body-comp`);

      if (this.weightOnlyFallback) {
        const reading: ScaleReading = { weight: frame.weight, impedance: 0 };
        this.compByReading.set(reading, { weightOnly: true });
        this.clearExpect();
        return reading;
      }
      // Do not complete yet — continuous mode will reconnect after the scale hangs up.
      return { weight: frame.weight, impedance: 0 };
    }

    return null;
  }

  private noteExpect(weight: number): void {
    if (!(weight > 0)) return;
    // Don't reset the reconnect counter on every live tick — only when the
    // locked weight changes meaningfully (new person / new step-on).
    if (Number.isNaN(this.expectKg) || Math.abs(this.expectKg - weight) > MATCH_WEIGHT_KG) {
      this.sessionsSinceExpect = 0;
      this.weightOnlyFallback = false;
    }
    this.expectKg = weight;
    this.expectAtMs = Date.now();
  }

  parseNotification(data: Buffer): ScaleReading | null {
    return this.parseCharNotification(CHR_NOTIFY, data);
  }

  private handleFragment(data: Buffer): ScaleReading | null {
    const marker = data[0];
    const chunk = data.subarray(3);

    if (marker === FRAG_FIRST) {
      this.fragBuf = Buffer.from(chunk);
    } else {
      this.fragBuf = Buffer.concat([this.fragBuf, chunk]);
    }

    if (marker !== FRAG_LAST) return null;

    const assembled = this.fragBuf;
    this.fragBuf = Buffer.alloc(0);
    return this.decodeBodyCompFrame(assembled);
  }

  /**
   * Decode reassembled 0x25 / 0x26.
   * Weight/fat end-anchored (joelr). Muscle mass / SMM / bone from parseMsc04BodyFields.
   * Prefer FFM-derived fat (muscleMass+bone) — matches Renpho; joelr fat often ~3%.
   */
  private decodeBodyCompFrame(data: Buffer): ScaleReading | null {
    if (data.length < 8 || data[0] !== HDR0 || data[1] !== HDR1) return null;
    const cmd = data[2];
    if (cmd !== CMD_BODY_LIVE && cmd !== CMD_BODY_HIST) return null;

    if (!this.handshakeReady) {
      this.earlyBodyComp.push(Buffer.from(data));
      if (this.earlyBodyComp.length > 4) this.earlyBodyComp.shift();
      // Also stash cross-session so a hung withResponse write cannot lose the frame.
      this.stashOrphans([data]);
      bleLog.info(
        `Renpho R-MSC04: buffer body-comp 0x${cmd.toString(16)} before handshake ` +
          `(will replay after b3→b8; guest fat % ignored via FFM)`,
      );
      return null;
    }

    const plen = data.readUInt16BE(3);
    const frameLen = plen + FRAME_OVERHEAD;
    if (plen < 32 || data.length < frameLen) return null;
    if (!checksumOk(data, frameLen)) return null;

    const payload = data.subarray(5, 5 + plen);
    const weight = payload.readUInt16BE(plen - 32) / 100;
    const frameFat = payload.readUInt16BE(plen - 8) / 10;
    if (weight < 0.5 || weight > 300 || !Number.isFinite(weight)) return null;
    if (!(frameFat >= 0 && frameFat <= 60) || !Number.isFinite(frameFat)) return null;

    const parsed = parseMsc04BodyFields(payload, plen, cmd);
    let bodyFat = frameFat;
    let fatSource: CachedComp['fatSource'] = 'frame';
    let waterPct: number | undefined;

    if (parsed.muscleMassKg != null && parsed.boneKg != null) {
      const ffm = parsed.muscleMassKg + parsed.boneKg;
      if (ffm > 0 && ffm < weight) {
        const fromFfm = (100 * (weight - ffm)) / weight;
        if (fromFfm >= 3 && fromFfm <= 55) {
          if (frameFat < 8 || Math.abs(frameFat - fromFfm) > 5) {
            bodyFat = Math.round(fromFfm * 10) / 10;
            fatSource = 'from_ffm';
          }
          const leanHydration = this.lastProfile?.isAthlete ? 0.74 : 0.73;
          waterPct = Math.round(((ffm * leanHydration) / weight) * 1000) / 10;
        }
      }
    }

    let ageS = 0;
    if (cmd === CMD_BODY_HIST && plen >= 6) {
      ageS = payload.readUInt16BE(4);
    }

    const matchesExpect =
      !Number.isNaN(this.expectKg) && Math.abs(weight - this.expectKg) <= MATCH_WEIGHT_KG;
    const fresh =
      cmd === CMD_BODY_LIVE ||
      ageS < FRESH_AGE_S ||
      (matchesExpect && ageS < MATCH_AGE_S);

    bleLog.info(
      `Renpho R-MSC04: body-comp 0x${cmd.toString(16)} age=${ageS}s ` +
        `${weight.toFixed(2)} kg / ${bodyFat.toFixed(1)}%` +
        `${parsed.muscleMassKg != null ? ` mus ${parsed.muscleMassKg.toFixed(2)}kg` : ''}` +
        `${parsed.smmKg != null ? ` smm ${parsed.smmKg.toFixed(2)}kg` : ''}` +
        `${parsed.boneKg != null ? ` bone ${parsed.boneKg.toFixed(2)}kg` : ''}` +
        ` — ${fresh ? 'FRESH' : 'stored (ignored)'} [${fatSource}]`,
    );
    bleLog.info(`Renpho R-MSC04: body-comp hex ${data.subarray(0, frameLen).toString('hex')}`);

    const musclePct =
      parsed.muscleMassKg != null ? (parsed.muscleMassKg / weight) * 100 : undefined;

    const snapshot: CachedComp = {
      fat: bodyFat,
      water: waterPct,
      muscle: musclePct,
      bone: parsed.boneKg,
      muscleMassKg: parsed.muscleMassKg,
      smmKg: parsed.smmKg,
      frameHex: data.subarray(0, frameLen).toString('hex'),
      cmd,
      payloadLen: plen,
      impedanceOhm: parsed.z1,
      impedanceOhm2: parsed.z2,
      impedanceMap: parsed.impedance,
      fatSource,
    };

    if (!fresh) {
      const reading: ScaleReading = {
        weight,
        impedance: parsed.z1 ?? 0,
        timestamp: new Date(Date.now() - ageS * 1000),
      };
      this.compByReading.set(reading, snapshot);
      return reading;
    }

    this.cachedComp = snapshot;
    const reading: ScaleReading = { weight, impedance: parsed.z1 ?? 0 };
    this.compByReading.set(reading, snapshot);
    this.finalReceived = true;
    this.clearExpect();
    return reading;
  }

  private clearExpect(): void {
    this.expectKg = Number.NaN;
    this.expectAtMs = 0;
    this.sessionsSinceExpect = 0;
    this.weightOnlyFallback = false;
    this.lastLiveWeight = 0;
  }

  private decodeFrame(data: Buffer): { cmd: number; weight: number } | null {
    if (data.length < 5) return null;
    if (data[0] !== HDR0 || data[1] !== HDR1) return null;

    const len = data.readUInt16BE(3);
    if (len < 2) return null;
    const frameLen = len + FRAME_OVERHEAD;
    if (data.length < frameLen) return null;
    if (!checksumOk(data, frameLen)) return null;

    const cmd = data[2];
    if (cmd !== CMD_LIVE && cmd !== CMD_FINAL) return null;

    const weight = data.readUInt16BE(frameLen - 3) / 100;
    if (weight < 0.5 || weight > 300 || !Number.isFinite(weight)) return null;
    return { cmd, weight };
  }

  isComplete(reading: ScaleReading): boolean {
    if (reading.weight <= 0) return false;
    // Historical cache frames
    if (reading.timestamp) return true;
    const c = this.compByReading.get(reading);
    if (c?.fat != null || c?.weightOnly) return true;
    // Weight-only fallback after several reconnects without BIA
    if (this.weightOnlyFallback && this.finalReceived) return true;
    // Final/live weight alone is NOT complete — forces continuous-mode reconnect for BIA
    return false;
  }

  isFinal(reading: ScaleReading): boolean {
    if (reading.timestamp) return false;
    const c = this.compByReading.get(reading);
    return c?.fat != null || c?.weightOnly === true || this.weightOnlyFallback;
  }

  computeMetrics(reading: ScaleReading, profile: UserProfile): BodyComposition {
    const c = this.compByReading.get(reading) ?? this.cachedComp;
    const effective = this.lastProfile ?? profile;
    const comp: ScaleBodyComp = {};
    if (c.fat != null) comp.fat = c.fat;
    if (c.water != null) comp.water = c.water;
    if (c.muscle != null) comp.muscle = c.muscle;
    if (c.bone != null) comp.bone = c.bone;
    const impedance = c.impedanceOhm ?? reading.impedance ?? 0;
    const base = buildPayload(reading.weight, impedance, comp, effective);

    const fat = base.bodyFatPercent;
    const lbm = base.weight * (1 - fat / 100);
    // Renpho: protein ≈ muscleMass − waterMass
    const waterMass = (base.waterPercent / 100) * base.weight;
    const proteinMass =
      c.muscleMassKg != null
        ? Math.round((c.muscleMassKg - waterMass) * 100) / 100
        : Math.round(lbm * 0.2 * 100) / 100;
    const proteinPercent = Math.round((proteinMass / base.weight) * 1000) / 10;
    const subcutaneous = Math.round(fat * 0.71 * 10) / 10;
    const smm =
      c.smmKg != null
        ? Math.round(c.smmKg * 100) / 100
        : Math.round(lbm * (effective.isAthlete ? 0.6 : 0.54) * 100) / 100;
    const ffm = Math.round(lbm * 100) / 100;
    const scaleId = this.lastDeviceMac ? `scale-${this.lastDeviceMac}` : undefined;
    const derived = ['subcutaneousFatPercent'];
    if (c.fatSource === 'from_ffm') derived.push('bodyFatPercent(from_ffm)');
    if (c.water != null) derived.push('waterPercent(from_ffm)');
    if (c.smmKg == null) derived.push('smmKg');
    derived.push('proteinPercent');

    return {
      ...base,
      ...(scaleId ? { external_user_id: scaleId } : {}),
      // Prefer frame muscle mass kg over buildPayload's percent×weight
      ...(c.muscleMassKg != null ? { muscleMass: Math.round(c.muscleMassKg * 100) / 100 } : {}),
      proteinPercent,
      proteinMassKg: proteinMass,
      subcutaneousFatPercent: subcutaneous,
      smmKg: smm,
      ffmKg: ffm,
      bodyFatKg: Math.round((base.weight - lbm) * 100) / 100,
      ...(c.impedanceMap ? { impedance: c.impedanceMap } : {}),
      raw: {
        source: 'renpho-msc04',
        scale_mac: this.lastDeviceMac || null,
        body_comp_cmd: c.cmd ?? null,
        body_comp_hex: c.frameHex ?? null,
        payload_len: c.payloadLen ?? null,
        fat_source: c.fatSource ?? null,
        impedance_ohm: c.impedanceOhm ?? null,
        impedance_ohm_2: c.impedanceOhm2 ?? null,
        impedance: c.impedanceMap ?? null,
        derived,
        note:
          'segmental kg still from Renpho/app when available; DF-BIA Z + muscleMass/SMM/bone from 0x25; fat from FFM',
      },
    } as BodyComposition;
  }
}
