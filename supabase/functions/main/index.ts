import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type MainAction =
  | "listUsers"
  | "createUser"
  | "deleteUser"
  | "updateUser"
  | "addUserCompany"
  | "removeUserCompany"
  | "listWorkCenters"
  | "createWorkCenter"
  | "updateWorkCenter"
  | "assignCompanyToWorkCenter"
  | "deleteWorkCenter";

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

type CallerContext = {
  userId: string | null;
  email: string | null;
  isSuperuser: boolean;
};

async function resolveCaller(
  supabaseAdmin: ReturnType<typeof createClient>,
  req: Request,
): Promise<CallerContext> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { userId: null, email: null, isSuperuser: false };
  }
  const token = authHeader.replace("Bearer ", "");
  const { data: { user } } = await supabaseAdmin.auth.getUser(token);
  if (!user) return { userId: null, email: null, isSuperuser: false };

  let isSuperuser = false;
  if (user.email) {
    const { data: su } = await supabaseAdmin
      .from("superusers")
      .select("id")
      .ilike("email", user.email)
      .eq("is_active", true)
      .maybeSingle();
    isSuperuser = !!su;
  }

  return { userId: user.id, email: user.email ?? null, isSuperuser };
}

// Comprueba si el caller tiene el permiso efectivo (resource:action) en su empresa.
// Superusers siempre pasan.
async function callerHasPermission(
  supabaseAdmin: ReturnType<typeof createClient>,
  caller: CallerContext,
  resource: string,
  action: string,
): Promise<boolean> {
  if (caller.isSuperuser) return true;
  if (!caller.userId) return false;

  const { data, error } = await supabaseAdmin.rpc(
    "user_has_effective_permission",
    {
      p_user_id: caller.userId,
      p_resource: resource,
      p_action: action,
    },
  );
  if (error) {
    console.error("user_has_effective_permission failed", error);
    return false;
  }
  return data === true;
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

async function fetchUserProfileForList(
  supabaseAdmin: ReturnType<typeof createClient>,
  userId: string,
  scopeCompanyId: string | null,
) {
  let query = supabaseAdmin
    .from("user_profiles")
    .select("company_id, employee_id, companies:company_id(name)")
    .eq("user_id", userId);
  if (scopeCompanyId) {
    query = query.eq("company_id", scopeCompanyId);
  }
  const { data, error } = await query
    .order("updated_at", { ascending: false })
    .limit(1);
  if (error) {
    console.error("user_profiles list fetch failed", userId, error.message);
    return null;
  }
  return data?.[0] ?? null;
}

async function listUsers(input: { isSuperuser?: boolean }, req: Request) {
  const supabaseAdmin = createAdminClient();
  const caller = await resolveCaller(supabaseAdmin, req);
  const currentUserId = caller.userId;

  const isSuperuser = !!input.isSuperuser || caller.isSuperuser;
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
      const profileCompanyScope = !isSuperuser ? targetCompanyId : null;
      const profile = await fetchUserProfileForList(
        supabaseAdmin,
        user.id,
        profileCompanyScope,
      );

      let employeeName: string | null = null;
      if (profile?.employee_id) {
        const { data: employee } = await supabaseAdmin
          .from("agenda_employees")
          .select("name")
          .eq("id", profile.employee_id)
          .maybeSingle();
        employeeName = employee?.name ?? null;
      }

      let rolesQuery = supabaseAdmin
        .from("user_company_roles")
        .select("id, role:roles(name, description), company_id")
        .eq("user_id", user.id);
      if (profile?.company_id) {
        rolesQuery = rolesQuery.eq("company_id", profile.company_id);
      } else if (targetCompanyId) {
        rolesQuery = rolesQuery.eq("company_id", targetCompanyId);
      }
      const { data: roles } = await rolesQuery;

      let permissionIds: string[] = [];
      const permCompanyId = profile?.company_id ?? targetCompanyId;
      if (permCompanyId) {
        const { data: perms } = await supabaseAdmin
          .from("user_permissions")
          .select("permission_id")
          .eq("user_id", user.id)
          .eq("company_id", permCompanyId);
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

  const { data: companyRow, error: companyLookupError } = await supabaseAdmin
    .from("companies")
    .select("id")
    .eq("id", p.company_id)
    .maybeSingle();

  if (companyLookupError) {
    return jsonResponse(
      { success: false, error: `Error al verificar empresa: ${companyLookupError.message}` },
      400,
    );
  }
  if (!companyRow) {
    return jsonResponse(
      {
        success: false,
        error:
          `Empresa no encontrada (company_id=${p.company_id}). ` +
          "Use el id de la tabla companies, no work_centers.",
      },
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
    const { error: profileError } = await supabaseAdmin.from("user_profiles").insert({
      user_id: userId,
      company_id: p.company_id,
      employee_id: p.employee_id || null,
    });
    if (profileError) throw new Error(`Failed to create profile: ${profileError.message}`);

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

  await supabaseAdmin.from("user_permissions").delete().eq("user_id", input.userId);
  await supabaseAdmin.from("user_active_company").delete().eq("user_id", input.userId);
  await supabaseAdmin.from("user_company_roles").delete().eq("user_id", input.userId);
  await supabaseAdmin.from("user_profiles").delete().eq("user_id", input.userId);
  const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(input.userId);
  if (deleteError) return jsonResponse({ success: false, error: deleteError.message }, 400);
  return jsonResponse({ success: true, message: "Usuario eliminado correctamente" }, 200);
}

async function updateUser(
  input: {
    userId?: string;
    role_id?: string;
    company_id?: string;
    employee_id?: string | null;
    permission_ids?: string[];
    password?: string;
    email?: string;
    isSuperuser?: boolean;
  },
  req: Request,
) {
  const supabaseAdmin = createAdminClient();
  if (!input.userId) return jsonResponse({ success: false, error: "userId is required" }, 400);

  const caller = await resolveCaller(supabaseAdmin, req);
  const isSuperuser = !!input.isSuperuser || caller.isSuperuser;

  const wantsPasswordChange = typeof input.password === "string" && input.password.length > 0;
  const wantsEmailChange = typeof input.email === "string" && input.email.trim().length > 0;

  if (wantsEmailChange) {
    if (!isSuperuser) {
      const allowed = await callerHasPermission(supabaseAdmin, caller, "users", "update");
      if (!allowed) {
        return jsonResponse(
          {
            success: false,
            error: "No tienes permiso para cambiar el email de otros usuarios (users:update requerido)",
            code: "forbidden_email_change",
          },
          403,
        );
      }
    }

    const { data: existingUser } = await supabaseAdmin.auth.admin.getUserById(input.userId);
    const currentEmail = existingUser?.user?.email?.trim().toLowerCase() ?? "";
    const nextEmail = input.email!.trim();
    if (nextEmail.toLowerCase() !== currentEmail) {
      const { error: emailError } = await supabaseAdmin.auth.admin.updateUserById(input.userId, {
        email: nextEmail,
        email_confirm: true,
      });
      if (emailError) {
        return jsonResponse(
          { success: false, error: `email_update_failed: ${emailError.message}`, code: (emailError as any).code },
          400,
        );
      }
    }
  }

  if (wantsPasswordChange) {
    if ((input.password as string).length < 6) {
      return jsonResponse(
        { success: false, error: "La contraseña debe tener al menos 6 caracteres", code: "password_too_short" },
        400,
      );
    }
    if (!isSuperuser) {
      const allowed = await callerHasPermission(supabaseAdmin, caller, "users", "update");
      if (!allowed) {
        return jsonResponse(
          {
            success: false,
            error: "No tienes permiso para cambiar la contraseña de otros usuarios (users:update requerido)",
            code: "forbidden_password_change",
          },
          403,
        );
      }
    }

    const { error: pwError } = await supabaseAdmin.auth.admin.updateUserById(input.userId, {
      password: input.password,
    });
    if (pwError) {
      return jsonResponse(
        { success: false, error: `password_update_failed: ${pwError.message}`, code: (pwError as any).code },
        400,
      );
    }
  }

  const { data: profileRows } = await supabaseAdmin
    .from("user_profiles")
    .select("company_id")
    .eq("user_id", input.userId)
    .order("updated_at", { ascending: false })
    .limit(1);
  const companyId = input.company_id || profileRows?.[0]?.company_id;
  if (!companyId) {
    if ((wantsPasswordChange || wantsEmailChange) &&
        !input.role_id &&
        !Array.isArray(input.permission_ids) &&
        input.employee_id === undefined) {
      return jsonResponse({ success: true, message: "Usuario actualizado correctamente" }, 200);
    }
    return jsonResponse({ success: false, error: "company_id is required" }, 400);
  }

  if (input.company_id || input.employee_id !== undefined) {
    const { error: profileError } = await supabaseAdmin
      .from("user_profiles")
      .upsert({
        user_id: input.userId,
        company_id: companyId,
        employee_id: input.employee_id ?? null,
      }, { onConflict: "company_id,user_id" });
    if (profileError) {
      const duplicateEmployee = profileError.code === "23505" &&
        String(profileError.message || "").includes("idx_user_profiles_company_employee_unique");
      return jsonResponse(
        {
          success: false,
          error: duplicateEmployee
            ? "Ese empleado de agenda ya está vinculado a otro usuario de la empresa."
            : `profile_update_failed: ${profileError.message}`,
          code: profileError.code,
        },
        400,
      );
    }
  }

  const shouldUpdateRole = typeof input.role_id === "string" && input.role_id.length > 0;
  const hasExplicitPermissionSet = Array.isArray(input.permission_ids);

  let skipRoleSync = false;
  if (shouldUpdateRole && !hasExplicitPermissionSet) {
    const { data: existingRoles } = await supabaseAdmin
      .from("user_company_roles")
      .select("role_id")
      .eq("user_id", input.userId)
      .eq("company_id", companyId)
      .limit(1);
    const currentRoleId = existingRoles?.[0]?.role_id;
    if (currentRoleId === input.role_id) {
      skipRoleSync = true;
    }
  }

  if (shouldUpdateRole && !skipRoleSync) {
    await supabaseAdmin.from("user_company_roles").delete()
      .eq("user_id", input.userId)
      .eq("company_id", companyId);
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

async function addUserCompany(input: {
  payload?: {
    userId: string;
    company_id: string;
    role_id: string;
    employee_id?: string | null;
    permissions?: string[];
  };
}) {
  const supabaseAdmin = createAdminClient();
  const p = input.payload;
  if (!p?.userId || !p.company_id || !p.role_id) {
    return jsonResponse(
      { success: false, error: "Missing required fields: userId, company_id, role_id" },
      400,
    );
  }

  const { data: companyRow, error: companyLookupError } = await supabaseAdmin
    .from("companies")
    .select("id")
    .eq("id", p.company_id)
    .maybeSingle();
  if (companyLookupError) {
    return jsonResponse(
      { success: false, error: `Error al verificar empresa: ${companyLookupError.message}` },
      400,
    );
  }
  if (!companyRow) {
    return jsonResponse({ success: false, error: `Empresa no encontrada (${p.company_id})` }, 400);
  }

  const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.getUserById(p.userId);
  if (authError || !authUser?.user) {
    return jsonResponse({ success: false, error: "Usuario de auth no encontrado" }, 404);
  }

  const { data: existingRole } = await supabaseAdmin
    .from("user_company_roles")
    .select("id")
    .eq("user_id", p.userId)
    .eq("company_id", p.company_id)
    .maybeSingle();
  if (existingRole) {
    return jsonResponse(
      { success: false, error: "El usuario ya tiene acceso a esta empresa" },
      400,
    );
  }

  const { data: existingProfile } = await supabaseAdmin
    .from("user_profiles")
    .select("company_id")
    .eq("user_id", p.userId)
    .eq("company_id", p.company_id)
    .maybeSingle();

  if (!existingProfile) {
    const { error: profileError } = await supabaseAdmin.from("user_profiles").insert({
      user_id: p.userId,
      company_id: p.company_id,
      employee_id: p.employee_id || null,
    });
    if (profileError) {
      // Compat: BD antigua con UNIQUE(user_id) — el acceso multi-empresa va por user_company_roles.
      const isSingleProfileSchema = profileError.code === "23505"
        && /user_profiles_user_id_key|user_id/i.test(profileError.message ?? "");
      if (!isSingleProfileSchema) {
        return jsonResponse(
          { success: false, error: `Failed to create profile: ${profileError.message}` },
          400,
        );
      }
    }
  }

  await supabaseAdmin.from("user_company_roles").delete()
    .eq("user_id", p.userId)
    .eq("company_id", p.company_id);

  const { error: roleError } = await insertUserCompanyRole(supabaseAdmin, {
    user_id: p.userId,
    company_id: p.company_id,
    role_id: p.role_id,
  });
  if (roleError) {
    return jsonResponse(
      { success: false, error: `Failed to assign role: ${roleError.message}` },
      400,
    );
  }

  let effectivePermissionIds: string[] = [];
  if (p.permissions?.length) {
    effectivePermissionIds = p.permissions;
  } else {
    effectivePermissionIds = await resolveRolePermissionIds(supabaseAdmin, p.role_id);
  }

  await supabaseAdmin.from("user_permissions").delete()
    .eq("user_id", p.userId)
    .eq("company_id", p.company_id);

  if (effectivePermissionIds.length) {
    const permissionInserts = effectivePermissionIds.map((permission_id) => ({
      user_id: p.userId,
      company_id: p.company_id,
      permission_id,
    }));
    const { error: permInsertError } = await supabaseAdmin.from("user_permissions").insert(permissionInserts);
    if (permInsertError) {
      return jsonResponse(
        { success: false, error: `Failed to assign permissions: ${permInsertError.message}` },
        400,
      );
    }
  }

  return jsonResponse({ success: true, message: "Acceso a empresa añadido correctamente" }, 200);
}

async function removeUserCompany(input: { userId?: string; company_id?: string }) {
  const supabaseAdmin = createAdminClient();
  if (!input.userId || !input.company_id) {
    return jsonResponse({ success: false, error: "userId and company_id are required" }, 400);
  }

  const { data: assigned } = await supabaseAdmin
    .from("user_company_roles")
    .select("company_id")
    .eq("user_id", input.userId);

  if ((assigned?.length ?? 0) <= 1) {
    return jsonResponse(
      { success: false, error: "No se puede quitar la última empresa del usuario" },
      400,
    );
  }

  const { data: profileBefore } = await supabaseAdmin
    .from("user_profiles")
    .select("company_id")
    .eq("user_id", input.userId)
    .maybeSingle();

  if (profileBefore?.company_id === input.company_id) {
    const nextCompanyId = (assigned ?? [])
      .map((row) => row.company_id)
      .find((id) => id && id !== input.company_id);
    if (nextCompanyId) {
      await supabaseAdmin.from("user_profiles")
        .update({ company_id: nextCompanyId })
        .eq("user_id", input.userId);
    }
  }

  await supabaseAdmin.from("user_permissions").delete()
    .eq("user_id", input.userId)
    .eq("company_id", input.company_id);
  await supabaseAdmin.from("user_company_roles").delete()
    .eq("user_id", input.userId)
    .eq("company_id", input.company_id);

  await supabaseAdmin.from("user_profiles").delete()
    .eq("user_id", input.userId)
    .eq("company_id", input.company_id);

  await supabaseAdmin.from("user_active_company").delete()
    .eq("user_id", input.userId)
    .eq("company_id", input.company_id);

  return jsonResponse({ success: true, message: "Acceso a empresa eliminado" }, 200);
}

async function isSuperuserRequest(
  input: { isSuperuser?: boolean },
  req: Request,
): Promise<boolean> {
  if (input.isSuperuser) return true;
  const supabaseAdmin = createAdminClient();
  const caller = await resolveCaller(supabaseAdmin, req);
  return caller.isSuperuser;
}

async function listWorkCenters(input: { isSuperuser?: boolean }, req: Request) {
  if (!await isSuperuserRequest(input, req)) {
    return jsonResponse({ success: false, error: "Superuser access required" }, 403);
  }
  const supabaseAdmin = createAdminClient();

  const { data: workCenters, error: wcError } = await supabaseAdmin
    .from("work_centers")
    .select("id, name, created_at, updated_at")
    .order("name");
  if (wcError) {
    return jsonResponse({ success: false, error: wcError.message }, 500);
  }

  const { data: companies, error: coError } = await supabaseAdmin
    .from("companies")
    .select("id, name, tax_id, short_name, tpv_ticket_prefix, work_center_id")
    .order("name");
  if (coError) {
    return jsonResponse({ success: false, error: coError.message }, 500);
  }

  return jsonResponse({
    success: true,
    work_centers: workCenters ?? [],
    companies: companies ?? [],
  }, 200);
}

async function createWorkCenter(input: { name?: string; isSuperuser?: boolean }, req: Request) {
  if (!await isSuperuserRequest(input, req)) {
    return jsonResponse({ success: false, error: "Superuser access required" }, 403);
  }
  const name = input.name?.trim();
  if (!name) {
    return jsonResponse({ success: false, error: "name is required" }, 400);
  }

  const supabaseAdmin = createAdminClient();
  const { data, error } = await supabaseAdmin
    .from("work_centers")
    .insert({ name })
    .select("id, name, created_at, updated_at")
    .single();
  if (error) {
    return jsonResponse({ success: false, error: error.message }, 400);
  }

  return jsonResponse({ success: true, work_center: data, message: "Centro laboral creado" }, 200);
}

async function updateWorkCenter(
  input: { id?: string; name?: string; isSuperuser?: boolean },
  req: Request,
) {
  if (!await isSuperuserRequest(input, req)) {
    return jsonResponse({ success: false, error: "Superuser access required" }, 403);
  }
  if (!input.id) {
    return jsonResponse({ success: false, error: "id is required" }, 400);
  }
  const name = input.name?.trim();
  if (!name) {
    return jsonResponse({ success: false, error: "name is required" }, 400);
  }

  const supabaseAdmin = createAdminClient();
  const { data, error } = await supabaseAdmin
    .from("work_centers")
    .update({ name })
    .eq("id", input.id)
    .select("id, name, created_at, updated_at")
    .single();
  if (error) {
    return jsonResponse({ success: false, error: error.message }, 400);
  }

  return jsonResponse({ success: true, work_center: data, message: "Centro laboral actualizado" }, 200);
}

async function assignCompanyToWorkCenter(input: {
  company_id?: string;
  work_center_id?: string | null;
  short_name?: string | null;
  tpv_ticket_prefix?: string | null;
  isSuperuser?: boolean;
}, req: Request) {
  if (!await isSuperuserRequest(input, req)) {
    return jsonResponse({ success: false, error: "Superuser access required" }, 403);
  }
  if (!input.company_id) {
    return jsonResponse({ success: false, error: "company_id is required" }, 400);
  }

  const supabaseAdmin = createAdminClient();

  const { data: companyRow, error: companyError } = await supabaseAdmin
    .from("companies")
    .select("id, name")
    .eq("id", input.company_id)
    .maybeSingle();
  if (companyError) {
    return jsonResponse({ success: false, error: companyError.message }, 400);
  }
  if (!companyRow) {
    return jsonResponse({ success: false, error: "Empresa no encontrada" }, 404);
  }

  if (input.work_center_id) {
    const { data: wcRow, error: wcError } = await supabaseAdmin
      .from("work_centers")
      .select("id")
      .eq("id", input.work_center_id)
      .maybeSingle();
    if (wcError) {
      return jsonResponse({ success: false, error: wcError.message }, 400);
    }
    if (!wcRow) {
      return jsonResponse({ success: false, error: "Centro laboral no encontrado" }, 404);
    }
  }

  const patch: Record<string, unknown> = {
    work_center_id: input.work_center_id ?? null,
  };
  if (input.short_name !== undefined) {
    patch.short_name = input.short_name?.trim() || null;
  }
  if (input.tpv_ticket_prefix !== undefined) {
    patch.tpv_ticket_prefix = input.tpv_ticket_prefix?.trim() || null;
  }

  const { data: updated, error: updateError } = await supabaseAdmin
    .from("companies")
    .update(patch)
    .eq("id", input.company_id)
    .select("id, name, tax_id, short_name, tpv_ticket_prefix, work_center_id")
    .single();
  if (updateError) {
    return jsonResponse({ success: false, error: updateError.message }, 400);
  }

  return jsonResponse({
    success: true,
    company: updated,
    message: input.work_center_id
      ? "Empresa vinculada al centro laboral"
      : "Empresa desvinculada del centro laboral",
  }, 200);
}

async function deleteWorkCenter(input: { id?: string; isSuperuser?: boolean }, req: Request) {
  if (!await isSuperuserRequest(input, req)) {
    return jsonResponse({ success: false, error: "Superuser access required" }, 403);
  }
  if (!input.id) {
    return jsonResponse({ success: false, error: "id is required" }, 400);
  }

  const supabaseAdmin = createAdminClient();
  const { error } = await supabaseAdmin
    .from("work_centers")
    .delete()
    .eq("id", input.id);
  if (error) {
    return jsonResponse({ success: false, error: error.message }, 400);
  }

  return jsonResponse({ success: true, message: "Centro laboral eliminado" }, 200);
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
    if (action === "updateUser") return await updateUser(body, req);
    if (action === "addUserCompany") return await addUserCompany(body);
    if (action === "removeUserCompany") return await removeUserCompany(body);
    if (action === "listWorkCenters") return await listWorkCenters(body, req);
    if (action === "createWorkCenter") return await createWorkCenter(body, req);
    if (action === "updateWorkCenter") return await updateWorkCenter(body, req);
    if (action === "assignCompanyToWorkCenter") return await assignCompanyToWorkCenter(body, req);
    if (action === "deleteWorkCenter") return await deleteWorkCenter(body, req);
    return jsonResponse({ success: false, error: `Unsupported action: ${action}` }, 400);
  } catch (error) {
    return jsonResponse({ success: false, error: (error as Error).message }, 500);
  }
});
