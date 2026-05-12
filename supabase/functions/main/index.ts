import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type MainAction = "listUsers" | "createUser" | "deleteUser" | "updateUser";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function createAdminClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(supabaseUrl, serviceRoleKey);
}

async function insertUserCompanyRole(
  supabaseAdmin: ReturnType<typeof createClient>,
  input: { user_id: string; company_id: string; role_id: string },
) {
  let { error } = await supabaseAdmin.from("user_company_roles").insert({
    ...input,
    role: "user",
  });

  if (error?.code === "42703" || error?.code === "PGRST204") {
    ({ error } = await supabaseAdmin.from("user_company_roles").insert(input));
  }

  return { error };
}

async function resolveRolePermissionIds(
  supabaseAdmin: ReturnType<typeof createClient>,
  roleId: string,
): Promise<string[]> {
  const { data: roleRow } = await supabaseAdmin
    .from("roles")
    .select("name")
    .eq("id", roleId)
    .maybeSingle();

  if ((roleRow?.name || "").toLowerCase() === "admin") {
    const { data: allPerms } = await supabaseAdmin
      .from("permissions")
      .select("id");
    return (allPerms || []).map((p: any) => p.id).filter(Boolean);
  }

  const { data: rolePerms } = await supabaseAdmin
    .from("role_permissions")
    .select("permission_id")
    .eq("role_id", roleId);

  return (rolePerms || []).map((rp: any) => rp.permission_id).filter(Boolean);
}

async function listUsers(input: { isSuperuser?: boolean }, req: Request) {
  const supabaseAdmin = createAdminClient();
  const authHeader = req.headers.get("authorization");
  let currentUserId: string | null = null;

  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.replace("Bearer ", "");
    const { data: { user } } = await supabaseAdmin.auth.getUser(token);
    currentUserId = user?.id ?? null;
  }

  const isSuperuser = !!input.isSuperuser;
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.listUsers();
  if (authError) return jsonResponse({ success: false, error: authError.message, users: [] }, 500);

  let targetCompanyId: string | null = null;
  if (!isSuperuser && currentUserId) {
    const { data: currentUserProfile } = await supabaseAdmin
      .from("user_profiles")
      .select("company_id")
      .eq("user_id", currentUserId)
      .maybeSingle();
    targetCompanyId = currentUserProfile?.company_id ?? null;
    if (!targetCompanyId) return jsonResponse({ success: true, users: [], total: 0 }, 200);
  }

  const users = await Promise.all(
    (authData?.users || []).map(async (user) => {
      const { data: profile } = await supabaseAdmin
        .from("user_profiles")
        .select("company_id, employee_id, companies:company_id(name)")
        .eq("user_id", user.id)
        .maybeSingle();

      let employeeName: string | null = null;
      if (profile?.employee_id) {
        const { data: employee } = await supabaseAdmin
          .from("agenda_employees")
          .select("name")
          .eq("id", profile.employee_id)
          .maybeSingle();
        employeeName = employee?.name ?? null;
      }

      const { data: roles } = await supabaseAdmin
        .from("user_company_roles")
        .select("id, role:roles(name, description), company_id")
        .eq("user_id", user.id);

      let permissionIds: string[] = [];
      if (profile?.company_id) {
        const { data: perms } = await supabaseAdmin
          .from("user_permissions")
          .select("permission_id")
          .eq("user_id", user.id)
          .eq("company_id", profile.company_id);
        permissionIds = (perms || []).map((p: any) => p.permission_id).filter(Boolean);
      }

      return {
        id: user.id,
        email: user.email,
        created_at: user.created_at,
        last_sign_in_at: user.last_sign_in_at,
        email_confirmed_at: user.email_confirmed_at,
        profiles: profile,
        employee_name: employeeName,
        user_company_roles: roles || [],
        permission_ids: permissionIds,
      };
    }),
  );

  const filteredUsers = (!isSuperuser && targetCompanyId)
    ? users.filter((u) => u.profiles?.company_id === targetCompanyId)
    : users;

  return jsonResponse({ success: true, users: filteredUsers, total: filteredUsers.length }, 200);
}

async function createUser(input: {
  payload?: {
    email: string;
    password: string;
    company_id: string;
    role_id: string;
    employee_id?: string | null;
    permissions?: string[];
  };
}) {
  const supabaseAdmin = createAdminClient();
  const p = input.payload;
  if (!p?.email || !p.password || !p.company_id || !p.role_id) {
    return jsonResponse(
      { success: false, error: "Missing required fields: email, password, company_id, role_id" },
      400,
    );
  }

  const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: p.email,
    password: p.password,
    email_confirm: true,
  });
  if (authError || !authUser?.user) {
    return jsonResponse(
      { success: false, error: `Failed to create auth user: ${authError?.message || "no user returned"}` },
      400,
    );
  }

  const userId = authUser.user.id;
  try {
    await supabaseAdmin.from("user_profiles").insert({
      user_id: userId,
      company_id: p.company_id,
      employee_id: p.employee_id || null,
    });

    const { error: roleError } = await insertUserCompanyRole(supabaseAdmin, {
      user_id: userId,
      company_id: p.company_id,
      role_id: p.role_id,
    });
    if (roleError) throw new Error(`Failed to assign role: ${roleError.message}`);

    let effectivePermissionIds: string[] = [];
    if (p.permissions?.length) {
      effectivePermissionIds = p.permissions;
    } else {
      effectivePermissionIds = await resolveRolePermissionIds(supabaseAdmin, p.role_id);
    }

    if (effectivePermissionIds.length) {
      const permissionInserts = effectivePermissionIds.map((permission_id) => ({
        user_id: userId,
        company_id: p.company_id,
        permission_id,
      }));
      const { error: permInsertError } = await supabaseAdmin.from("user_permissions").insert(permissionInserts);
      if (permInsertError) throw new Error(`Failed to assign permissions: ${permInsertError.message}`);
    }

    return jsonResponse({ success: true, userId, message: "User created successfully" }, 200);
  } catch (error) {
    await supabaseAdmin.auth.admin.deleteUser(userId);
    return jsonResponse({ success: false, error: `User setup failed: ${(error as Error).message}` }, 500);
  }
}

async function deleteUser(input: { userId?: string }) {
  const supabaseAdmin = createAdminClient();
  if (!input.userId) return jsonResponse({ success: false, error: "userId is required" }, 400);

  await supabaseAdmin.from("user_company_roles").delete().eq("user_id", input.userId);
  await supabaseAdmin.from("user_profiles").delete().eq("user_id", input.userId);
  const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(input.userId);
  if (deleteError) return jsonResponse({ success: false, error: deleteError.message }, 400);
  return jsonResponse({ success: true, message: "Usuario eliminado correctamente" }, 200);
}

async function updateUser(input: {
  userId?: string;
  role_id?: string;
  company_id?: string;
  employee_id?: string | null;
  permission_ids?: string[];
}) {
  const supabaseAdmin = createAdminClient();
  if (!input.userId) return jsonResponse({ success: false, error: "userId is required" }, 400);

  const { data: profile } = await supabaseAdmin
    .from("user_profiles")
    .select("company_id")
    .eq("user_id", input.userId)
    .maybeSingle();
  const companyId = input.company_id || profile?.company_id;
  if (!companyId) return jsonResponse({ success: false, error: "company_id is required" }, 400);

  if (input.employee_id !== undefined) {
    const { error: profileError } = await supabaseAdmin
      .from("user_profiles")
      .upsert({
        user_id: input.userId,
        company_id: companyId,
        employee_id: input.employee_id,
      }, { onConflict: "user_id" });
    if (profileError) {
      return jsonResponse(
        { success: false, error: `profile_update_failed: ${profileError.message}`, code: profileError.code },
        400,
      );
    }
  }

  const shouldUpdateRole = typeof input.role_id === "string" && input.role_id.length > 0;
  const hasExplicitPermissionSet = Array.isArray(input.permission_ids);

  if (shouldUpdateRole) {
    await supabaseAdmin.from("user_company_roles").delete().eq("user_id", input.userId);
    const { error: roleError } = await insertUserCompanyRole(supabaseAdmin, {
      user_id: input.userId,
      company_id: companyId,
      role_id: input.role_id!,
    });
    if (roleError) {
      return jsonResponse(
        { success: false, error: `role_update_failed: ${roleError.message}`, code: roleError.code },
        400,
      );
    }

    await supabaseAdmin
      .from("user_permissions")
      .delete()
      .eq("user_id", input.userId)
      .eq("company_id", companyId);
    const permissionIds = hasExplicitPermissionSet
      ? input.permission_ids!
      : await resolveRolePermissionIds(supabaseAdmin, input.role_id!);
    const permissionInserts = permissionIds
      .filter(Boolean)
      .map((permission_id: string) => ({
        user_id: input.userId!,
        company_id: companyId,
        permission_id,
      }));
    if (permissionInserts.length) {
      const { error: permError } = await supabaseAdmin.from("user_permissions").insert(permissionInserts);
      if (permError) {
        return jsonResponse(
          { success: false, error: `permission_sync_failed: ${permError.message}`, code: permError.code },
          400,
        );
      }
    }
  } else if (hasExplicitPermissionSet) {
    await supabaseAdmin
      .from("user_permissions")
      .delete()
      .eq("user_id", input.userId)
      .eq("company_id", companyId);
    const permissionInserts = input.permission_ids!
      .filter(Boolean)
      .map((permission_id: string) => ({
        user_id: input.userId!,
        company_id: companyId,
        permission_id,
      }));
    if (permissionInserts.length) {
      const { error: permError } = await supabaseAdmin.from("user_permissions").insert(permissionInserts);
      if (permError) {
        return jsonResponse(
          { success: false, error: `permission_sync_failed: ${permError.message}`, code: permError.code },
          400,
        );
      }
    }
  }

  return jsonResponse({ success: true, message: "Usuario actualizado correctamente" }, 200);
}

// ---------------------------------------------------------------------------
// Dispatcher: si la URL pide otra función hermana (p.ej. /meta-sync-leads),
// arrancamos un worker dedicado para esa carpeta. Si no, ejecutamos la lógica
// de gestión de usuarios histórica de este "main" (action-based).
// ---------------------------------------------------------------------------
function extractServiceName(req: Request): string {
  try {
    const url = new URL(req.url);
    const segments = url.pathname.split("/").filter(Boolean);
    // Kong suele entregar /<name>/... tras strip_path; aceptamos también
    // /functions/v1/<name>/... por seguridad.
    if (segments[0] === "functions" && segments[1] === "v1" && segments[2]) {
      return segments[2];
    }
    return segments[0] ?? "";
  } catch {
    return "";
  }
}

// deno-lint-ignore no-explicit-any
const edgeRuntime: any =
  // deno-lint-ignore no-explicit-any
  (globalThis as any).EdgeRuntime ?? (globalThis as any).Deno?.EdgeRuntime;

async function dispatchToServiceFolder(req: Request, serviceName: string): Promise<Response> {
  const servicePath = `/home/deno/functions/${serviceName}`;
  const envVarsObj = Deno.env.toObject();
  const envVars = Object.entries(envVarsObj);
  const worker = await edgeRuntime.userWorkers.create({
    servicePath,
    memoryLimitMb: 256,
    workerTimeoutMs: 5 * 60 * 1000,
    cpuTimeSoftLimitMs: 30_000,
    cpuTimeHardLimitMs: 60_000,
    noModuleCache: false,
    importMapPath: null,
    envVars,
    forceCreate: false,
    netAccessDisabled: false,
  });
  return await worker.fetch(req);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const serviceName = extractServiceName(req);
  const isMainCall = !serviceName || serviceName === "main";

  // 1) Delegación a sibling functions: meta-sync-leads, etc.
  if (!isMainCall && edgeRuntime?.userWorkers?.create) {
    try {
      return await dispatchToServiceFolder(req, serviceName);
    } catch (e) {
      const err = e as Error & { code?: string };
      // Si la carpeta no existe, dejamos caer al flujo de acciones (que devolverá error).
      const notFound =
        e instanceof Deno.errors.NotFound ||
        /not\s*found|no such file/i.test(err.message ?? "");
      if (!notFound) {
        console.error(`Dispatch a "${serviceName}" falló:`, err);
        return jsonResponse(
          { success: false, error: `Function dispatch failed: ${err.message}` },
          500,
        );
      }
    }
  }

  // 2) Flujo histórico action-based del main (gestión de usuarios).
  try {
    const body = req.method === "GET" ? {} : await req.json().catch(() => ({}));
    const action = body?.action as MainAction | undefined;
    if (!action) return jsonResponse({ success: false, error: "action is required" }, 400);

    if (action === "listUsers") return await listUsers(body, req);
    if (action === "createUser") return await createUser(body);
    if (action === "deleteUser") return await deleteUser(body);
    if (action === "updateUser") return await updateUser(body);
    return jsonResponse({ success: false, error: `Unsupported action: ${action}` }, 400);
  } catch (error) {
    return jsonResponse({ success: false, error: (error as Error).message }, 500);
  }
});
