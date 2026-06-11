import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const allowedOrigins = (Deno.env.get("ALLOWED_ORIGINS") ?? "http://localhost:5173,http://127.0.0.1:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const corsHeaders = {
  "Access-Control-Allow-Origin": allowedOrigins[0] ?? "http://localhost:5173",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SECRET_FIELDS = new Set(["encrypted_password", "password_iv", "password_auth_tag"]);

type CarrierAccessRow = {
  id: string;
  account_id: string;
  carrier_name: string;
  carrier_aliases: string[];
  portal_url: string | null;
  policy_lookup_url: string | null;
  billing_url: string | null;
  claims_url: string | null;
  producer_code: string | null;
  agency_code: string | null;
  username: string | null;
  encrypted_password: string | null;
  password_iv: string | null;
  password_auth_tag: string | null;
  password_updated_at: string | null;
  password_updated_by: string | null;
  login_notes: string | null;
  active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type AccountMembership = {
  role: "owner" | "admin" | "producer" | "csr" | "readonly";
  can_view_carrier_credentials: boolean;
  can_copy_carrier_credentials: boolean;
  can_manage_carrier_credentials: boolean;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getEncryptionKey() {
  const raw = Deno.env.get("CARRIER_VAULT_ENCRYPTION_KEY");
  if (!raw) {
    throw new Error("Carrier credential vault is not configured. Please set the encryption key.");
  }

  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("Carrier credential vault encryption key is invalid. Expected a base64 32-byte key.");
  }
  return key;
}

function encryptSecret(plainText: string) {
  const key = getEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    encrypted_password: encrypted.toString("base64"),
    password_iv: iv.toString("base64"),
    password_auth_tag: authTag.toString("base64"),
  };
}

function decryptSecret(encryptedValue: string, iv: string, authTag: string) {
  const key = getEncryptionKey();
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(authTag, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "base64")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

function sanitizeCarrier(row: CarrierAccessRow) {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (!SECRET_FIELDS.has(key)) result[key] = value;
  }
  result.has_password = !!row.encrypted_password;
  return result;
}

function normalizePayload(payload: Record<string, unknown>) {
  return {
    carrier_name: String(payload.carrier_name ?? payload.name ?? "").trim(),
    carrier_aliases: Array.isArray(payload.carrier_aliases) ? payload.carrier_aliases : [],
    portal_url: payload.portal_url ?? payload.url ?? null,
    policy_lookup_url: payload.policy_lookup_url ?? null,
    billing_url: payload.billing_url ?? null,
    claims_url: payload.claims_url ?? null,
    producer_code: payload.producer_code ?? null,
    agency_code: payload.agency_code ?? null,
    username: payload.username ?? null,
    login_notes: payload.login_notes ?? payload.notes ?? null,
    active: payload.active ?? true,
  };
}

function isAdmin(member: AccountMembership) {
  return member.role === "owner" || member.role === "admin";
}

function canManage(member: AccountMembership) {
  return isAdmin(member) || member.can_manage_carrier_credentials;
}

function canReveal(member: AccountMembership) {
  return isAdmin(member) || member.can_view_carrier_credentials || member.can_copy_carrier_credentials;
}

function canCopy(member: AccountMembership) {
  return isAdmin(member) || member.can_copy_carrier_credentials;
}

async function audit(serviceClient: ReturnType<typeof createClient>, req: Request, accountId: string, carrierId: string, userId: string, actionType: string) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  const userAgent = req.headers.get("user-agent");

  await serviceClient.from("carrier_credential_audit_logs").insert({
    account_id: accountId,
    carrier_id: carrierId,
    user_id: userId,
    action_type: actionType,
    ip_address: ip,
    user_agent: userAgent,
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const authHeader = req.headers.get("Authorization") ?? "";

    if (!supabaseUrl || !serviceRoleKey) {
      return json({ error: "Carrier access API is not configured." }, 500);
    }

    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
      global: { headers: { Authorization: authHeader } },
    });
    const serviceClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) return json({ error: "Unauthorized" }, 401);
    const userId = userData.user.id;

    const url = new URL(req.url);
    const parts = url.pathname.split("/").filter(Boolean);
    const fnIndex = parts.indexOf("carrier-access");
    const route = fnIndex >= 0 ? parts.slice(fnIndex + 1) : parts;
    const carrierId = route[0];
    const action = route[1];

    const body = req.method === "GET" ? {} : await req.json().catch(() => ({}));
    const accountIdFromBody = (body.account_id as string | undefined) ?? url.searchParams.get("account_id") ?? undefined;

    let accountId = accountIdFromBody;
    let carrier: CarrierAccessRow | null = null;
    if (carrierId) {
      const { data, error } = await serviceClient
        .from("carrier_access")
        .select("*")
        .eq("id", carrierId)
        .single();
      if (error || !data) return json({ error: "Carrier access record not found." }, 404);
      carrier = data as CarrierAccessRow;
      accountId = carrier.account_id;
    }

    if (!accountId) return json({ error: "account_id is required." }, 400);

    const { data: membership, error: membershipError } = await serviceClient
      .from("account_users")
      .select("role, can_view_carrier_credentials, can_copy_carrier_credentials, can_manage_carrier_credentials")
      .eq("account_id", accountId)
      .eq("user_id", userId)
      .eq("status", "active")
      .single();

    if (membershipError || !membership) return json({ error: "Forbidden" }, 403);
    const member = membership as AccountMembership;

    if (req.method === "GET" && !carrierId) {
      const { data, error } = await serviceClient
        .from("carrier_access")
        .select("*")
        .eq("account_id", accountId)
        .order("carrier_name");
      if (error) return json({ error: error.message }, 500);
      return json({ carriers: (data as CarrierAccessRow[]).map(sanitizeCarrier) });
    }

    if (req.method === "GET" && carrier) {
      return json({ carrier: sanitizeCarrier(carrier) });
    }

    if (req.method === "POST" && !carrierId) {
      if (!canManage(member)) return json({ error: "Only owner/admin users can manage carrier credentials." }, 403);
      const payload = normalizePayload(body);
      if (!payload.carrier_name) return json({ error: "carrier_name is required." }, 400);

      const { data, error } = await serviceClient
        .from("carrier_access")
        .insert({ ...payload, account_id: accountId, created_by: userId })
        .select("*")
        .single();
      if (error) return json({ error: error.message }, 500);
      return json({ carrier: sanitizeCarrier(data as CarrierAccessRow) }, 201);
    }

    if (req.method === "PATCH" && carrier) {
      if (!canManage(member)) return json({ error: "Only owner/admin users can manage carrier credentials." }, 403);
      const payload = normalizePayload(body);
      if (!payload.carrier_name) delete (payload as Partial<typeof payload>).carrier_name;

      const { data, error } = await serviceClient
        .from("carrier_access")
        .update(payload)
        .eq("id", carrier.id)
        .select("*")
        .single();
      if (error) return json({ error: error.message }, 500);
      return json({ carrier: sanitizeCarrier(data as CarrierAccessRow) });
    }

    if (req.method === "POST" && carrier && action === "credentials") {
      if (!canManage(member)) return json({ error: "Only owner/admin users can manage carrier credentials." }, 403);
      if (!body.accepted_risk) return json({ error: "You must accept the risk before storing carrier credentials." }, 400);
      const password = String(body.password ?? "");
      if (!password) return json({ error: "password is required." }, 400);

      const encrypted = encryptSecret(password);
      const { data, error } = await serviceClient
        .from("carrier_access")
        .update({
          username: body.username ?? carrier.username,
          ...encrypted,
          password_updated_at: new Date().toISOString(),
          password_updated_by: userId,
        })
        .eq("id", carrier.id)
        .select("*")
        .single();
      if (error) return json({ error: error.message }, 500);

      await audit(serviceClient, req, carrier.account_id, carrier.id, userId, carrier.encrypted_password ? "updated_credentials" : "created_credentials");
      return json({ carrier: sanitizeCarrier(data as CarrierAccessRow) });
    }

    if (req.method === "POST" && carrier && (action === "reveal-password" || action === "copy-access")) {
      if (action === "copy-access" ? !canCopy(member) : !canReveal(member)) {
        return json({ error: "You are not authorized to access saved carrier passwords." }, 403);
      }
      if (!body.confirmed_reauth) {
        return json({ error: "Confirm your AgencyIQ password to reveal this saved carrier credential." }, 400);
      }
      if (!carrier.encrypted_password || !carrier.password_iv || !carrier.password_auth_tag) {
        return json({ error: "No saved password exists for this carrier." }, 404);
      }

      const password = decryptSecret(carrier.encrypted_password, carrier.password_iv, carrier.password_auth_tag);
      await audit(serviceClient, req, carrier.account_id, carrier.id, userId, action === "copy-access" ? "copied_password" : "revealed_password");
      return json({
        username: carrier.username,
        password,
        reauth_verified: false,
        reauth_required_improvement: "Backend password verification is not available yet; this request used explicit user confirmation and audit logging.",
      });
    }

    if (req.method === "POST" && carrier && action === "opened-portal") {
      await audit(serviceClient, req, carrier.account_id, carrier.id, userId, "opened_portal");
      return json({ ok: true });
    }

    return json({ error: "Unsupported carrier access route." }, 404);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected carrier access error.";
    const safeMessage = message.includes("credential vault") ? message : "Carrier credential vault request failed.";
    return json({ error: safeMessage }, message.includes("not configured") || message.includes("invalid") ? 503 : 500);
  }
});
