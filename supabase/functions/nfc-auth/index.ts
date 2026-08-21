/**
 * Login / enrolamiento NFC (ACR122U).
 *
 * POST https://supabase.lipoout.com/functions/v1/nfc-auth
 *
 * Acciones públicas (anon):
 *   - challenge.start  { station_id }
 *   - challenge.poll   { challenge_id, poll_token }
 *   - challenge.wedge  { challenge_id, poll_token, uid }  // teclado wedge en Login
 *
 * Acciones agente (header X-Nfc-Agent-Secret = NFC_AGENT_SECRET):
 *   - agent.tag        { uid, station_id? }
 *
 * Acciones admin (Bearer JWT usuario con users:update o superuser):
 *   - enroll.set       { user_id, uid }
 *   - enroll.clear     { user_id }
 *   - enroll.next_tag  { user_id, station_id }  // espera próxima lectura del agente
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-nfc-agent-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
};

type Body = {
  action?: string;
  station_id?: string;
  challenge_id?: string;
  poll_token?: string;
  uid?: string;
  user_id?: string;
  company_id?: string;
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function normalizeUid(raw: string | null | undefined): string {
  return String(raw ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^0-9A-F]/g, '');
}

function randomToken(bytes = 24): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
}

function publicCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const arr = new Uint8Array(4);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => alphabet[b % alphabet.length]).join('');
}

function agentSecretOk(req: Request): boolean {
  const expected = (Deno.env.get('NFC_AGENT_SECRET') ?? '').trim();
  if (!expected) return false;
  const header = (req.headers.get('x-nfc-agent-secret') ?? '').trim();
  const bearer = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  return header === expected || bearer === expected;
}

function adminClient() {
  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function mintSessionForUserId(userId: string) {
  const admin = adminClient();
  const { data: userData, error: userErr } = await admin.auth.admin.getUserById(userId);
  if (userErr || !userData?.user?.email) {
    throw new Error(userErr?.message ?? 'Usuario no encontrado');
  }
  const email = userData.user.email;

  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  });
  if (linkErr) throw new Error(linkErr.message);

  const tokenHash =
    (linkData as { properties?: { hashed_token?: string } })?.properties?.hashed_token ??
    null;
  if (!tokenHash) throw new Error('No se pudo generar token de sesión');

  const { data: verified, error: verifyErr } = await admin.auth.verifyOtp({
    type: 'magiclink',
    token_hash: tokenHash,
  });
  if (verifyErr || !verified.session) {
    throw new Error(verifyErr?.message ?? 'No se pudo verificar sesión');
  }

  return {
    user_id: userId,
    email,
    access_token: verified.session.access_token,
    refresh_token: verified.session.refresh_token,
    expires_in: verified.session.expires_in,
  };
}

async function findUserIdByUid(uid: string): Promise<string | null> {
  const admin = adminClient();
  const { data, error } = await admin
    .from('user_profiles')
    .select('user_id')
    .eq('nfc_uid', uid)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.user_id ?? null;
}

async function completeChallengeWithUid(challengeId: string, uid: string) {
  const admin = adminClient();
  const { data: ch, error } = await admin
    .from('nfc_login_challenges')
    .select('*')
    .eq('id', challengeId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!ch) throw new Error('Reto no encontrado');
  if (ch.status !== 'waiting') throw new Error(`Reto en estado ${ch.status}`);
  if (new Date(ch.expires_at).getTime() < Date.now()) {
    await admin.from('nfc_login_challenges').update({ status: 'expired' }).eq('id', challengeId);
    throw new Error('Reto caducado');
  }

  const userId = await findUserIdByUid(uid);
  if (!userId) {
    await admin
      .from('nfc_login_challenges')
      .update({
        status: 'failed',
        nfc_uid: uid,
        error_message: 'Tarjeta no asociada a ningún usuario',
        completed_at: new Date().toISOString(),
      })
      .eq('id', challengeId);
    throw new Error('Tarjeta no asociada a ningún usuario');
  }

  try {
    const session = await mintSessionForUserId(userId);
    const { error: upErr } = await admin
      .from('nfc_login_challenges')
      .update({
        status: 'completed',
        nfc_uid: uid,
        user_id: userId,
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        completed_at: new Date().toISOString(),
        error_message: null,
      })
      .eq('id', challengeId)
      .eq('status', 'waiting');
    if (upErr) throw new Error(upErr.message);
    return { ok: true, user_id: userId, email: session.email };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error creando sesión';
    await admin
      .from('nfc_login_challenges')
      .update({
        status: 'failed',
        nfc_uid: uid,
        error_message: msg,
        completed_at: new Date().toISOString(),
      })
      .eq('id', challengeId);
    throw e;
  }
}

async function assertCanManageUsers(req: Request): Promise<{ userId: string }> {
  const auth = req.headers.get('authorization') ?? '';
  if (!auth.toLowerCase().startsWith('bearer ')) throw new Error('No autenticado');
  const jwt = auth.slice(7).trim();
  const admin = adminClient();
  const { data: userData, error } = await admin.auth.getUser(jwt);
  if (error || !userData?.user) throw new Error('Sesión inválida');

  if (userData.user.email) {
    const { data: superRow } = await admin
      .from('superusers')
      .select('id')
      .ilike('email', userData.user.email)
      .eq('is_active', true)
      .maybeSingle();
    if (superRow?.id) return { userId: userData.user.id };
  }

  const { data: allowed, error: permErr } = await admin.rpc('user_has_effective_permission', {
    p_user_id: userData.user.id,
    p_resource: 'users',
    p_action: 'update',
  });
  if (permErr) throw new Error(permErr.message);
  if (allowed === true) return { userId: userData.user.id };

  throw new Error('Sin permiso para gestionar usuarios/NFC (users:update)');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method === 'GET') {
    return json({
      ok: true,
      service: 'nfc-auth',
      agent_secret_configured: Boolean((Deno.env.get('NFC_AGENT_SECRET') ?? '').trim()),
    });
  }
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  let body: Body = {};
  try {
    body = (await req.json()) as Body;
  } catch {
    return json({ error: 'JSON inválido' }, 400);
  }

  const action = String(body.action ?? '').trim();
  const admin = adminClient();

  try {
    // Expire stale waiting challenges opportunistically
    await admin
      .from('nfc_login_challenges')
      .update({ status: 'expired' })
      .eq('status', 'waiting')
      .lt('expires_at', new Date().toISOString());

    if (action === 'challenge.start') {
      const stationId = String(body.station_id ?? '').trim() || 'default';
      if (stationId.length > 80) return json({ error: 'station_id inválido' }, 400);
      const poll = randomToken(24);
      const code = publicCode();
      const { data, error } = await admin
        .from('nfc_login_challenges')
        .insert({
          station_id: stationId,
          public_code: code,
          poll_token: poll,
          status: 'waiting',
        })
        .select('id, public_code, expires_at, station_id')
        .single();
      if (error) return json({ error: error.message }, 500);
      return json({
        challenge_id: data.id,
        public_code: data.public_code,
        poll_token: poll,
        expires_at: data.expires_at,
        station_id: data.station_id,
      });
    }

    if (action === 'challenge.poll') {
      const id = String(body.challenge_id ?? '');
      const token = String(body.poll_token ?? '');
      if (!id || !token) return json({ error: 'Faltan challenge_id/poll_token' }, 400);
      const { data, error } = await admin
        .from('nfc_login_challenges')
        .select('id, status, expires_at, error_message, access_token, refresh_token, user_id')
        .eq('id', id)
        .eq('poll_token', token)
        .maybeSingle();
      if (error) return json({ error: error.message }, 500);
      if (!data) return json({ error: 'Reto no encontrado' }, 404);

      if (data.status === 'waiting' && new Date(data.expires_at).getTime() < Date.now()) {
        await admin.from('nfc_login_challenges').update({ status: 'expired' }).eq('id', id);
        return json({ status: 'expired' });
      }

      if (data.status === 'completed' && data.access_token && data.refresh_token) {
        // One-shot: wipe tokens after read
        await admin
          .from('nfc_login_challenges')
          .update({ access_token: null, refresh_token: null })
          .eq('id', id);
        return json({
          status: 'completed',
          access_token: data.access_token,
          refresh_token: data.refresh_token,
          user_id: data.user_id,
        });
      }

      return json({
        status: data.status,
        error_message: data.error_message ?? null,
      });
    }

    if (action === 'challenge.wedge') {
      // Teclado wedge del ACR122U escribiendo en la pantalla de Login.
      const id = String(body.challenge_id ?? '');
      const token = String(body.poll_token ?? '');
      const uid = normalizeUid(body.uid);
      if (!id || !token) return json({ error: 'Faltan challenge_id/poll_token' }, 400);
      if (uid.length < 6 || uid.length > 32) return json({ error: 'UID inválido' }, 400);

      const { data: ch, error } = await admin
        .from('nfc_login_challenges')
        .select('id, poll_token, status')
        .eq('id', id)
        .eq('poll_token', token)
        .maybeSingle();
      if (error) return json({ error: error.message }, 500);
      if (!ch || ch.status !== 'waiting') return json({ error: 'Reto no válido' }, 400);

      const result = await completeChallengeWithUid(id, uid);
      return json(result);
    }

    if (action === 'agent.tag') {
      if (!agentSecretOk(req)) return json({ error: 'Agente no autorizado' }, 401);
      const uid = normalizeUid(body.uid);
      if (uid.length < 6 || uid.length > 32) return json({ error: 'UID inválido' }, 400);
      const stationId = String(body.station_id ?? '').trim() || 'default';

      const { data: waiting, error } = await admin
        .from('nfc_login_challenges')
        .select('id')
        .eq('station_id', stationId)
        .eq('status', 'waiting')
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) return json({ error: error.message }, 500);
      if (!waiting) {
        return json({
          ok: false,
          ignored: true,
          message: 'No hay pantalla de login esperando en esta estación',
        });
      }

      const result = await completeChallengeWithUid(waiting.id, uid);
      return json(result);
    }

    if (action === 'enroll.set' || action === 'enroll.clear') {
      await assertCanManageUsers(req);
      const userId = String(body.user_id ?? '');
      if (!userId) return json({ error: 'Falta user_id' }, 400);

      if (action === 'enroll.clear') {
        const { error } = await admin
          .from('user_profiles')
          .update({ nfc_uid: null })
          .eq('user_id', userId);
        if (error) return json({ error: error.message }, 500);
        return json({ ok: true, nfc_uid: null });
      }

      const uid = normalizeUid(body.uid);
      if (uid.length < 6 || uid.length > 32) return json({ error: 'UID inválido' }, 400);

      const { data: taken } = await admin
        .from('user_profiles')
        .select('user_id')
        .eq('nfc_uid', uid)
        .neq('user_id', userId)
        .maybeSingle();
      if (taken?.user_id) return json({ error: 'Esa tarjeta ya está asociada a otro usuario' }, 409);

      const { error } = await admin
        .from('user_profiles')
        .update({ nfc_uid: uid })
        .eq('user_id', userId);
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true, nfc_uid: uid });
    }

    if (action === 'enroll.next_tag') {
      // Reutiliza un challenge de estación; al completar, en vez de login, asocia UID.
      // Más simple: el admin introduce UID manual o usa wedge en diálogo.
      // Aquí devolvemos el último UID leído por agente contra station_id sin consumir login.
      await assertCanManageUsers(req);
      if (!agentSecretOk(req) && !(req.headers.get('authorization') ?? '')) {
        return json({ error: 'No autorizado' }, 401);
      }
      return json({
        error: 'Usa enroll.set con el UID, o el diálogo de enrolamiento en Usuarios',
      }, 400);
    }

    return json({ error: `Acción desconocida: ${action}` }, 400);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error';
    return json({ error: msg }, 400);
  }
});
