import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const allowedOrigins = (Deno.env.get("ALLOWED_ORIGINS") ?? "http://localhost:5173,http://127.0.0.1:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const corsHeaders = {
  "Access-Control-Allow-Origin": allowedOrigins[0] ?? "http://localhost:5173",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const allowIvansDemoMode = Deno.env.get("ALLOW_IVANS_DEMO_MODE") === "true";

// ─── IVANS Cloud API Client ───────────────────────────────────────────────────
// IVANS Exchange / IVANS Cloud uses a REST API with OAuth 2.0 bearer tokens.
// Carrier credentials are stored in ivans_connections and retrieved per connection.
class IvansClient {
  private baseUrl: string;
  private subscriberId: string;
  private username: string;
  private passwordRef: string;
  private accessToken: string | null = null;

  constructor(endpoint: string, subscriberId: string, username: string, passwordRef: string) {
    this.baseUrl = endpoint;
    this.subscriberId = subscriberId;
    this.username = username;
    this.passwordRef = passwordRef;
  }

  // Authenticate with IVANS and obtain a bearer token.
  // In production, IVANS uses OAuth 2.0 client credentials flow.
  async authenticate(): Promise<boolean> {
    try {
      // Resolve password from Supabase Vault reference if needed
      const password = this.passwordRef.startsWith("vault::")
        ? await this.resolveVaultSecret(this.passwordRef)
        : this.passwordRef;

      const resp = await fetch(`${this.baseUrl}/auth/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "password",
          username: this.username,
          password,
          subscriber_id: this.subscriberId,
        }),
      });

      if (!resp.ok) {
        // Demo mode: simulate successful auth when IVANS endpoint unreachable
        if (allowIvansDemoMode && this.baseUrl.includes("ivansinsurance.com")) {
          console.warn("IVANS endpoint not reachable — running in demo mode");
          this.accessToken = "demo-token";
          return true;
        }
        return false;
      }

      const data = await resp.json();
      this.accessToken = data.access_token;
      return !!this.accessToken;
    } catch {
      if (allowIvansDemoMode) {
        this.accessToken = "demo-token";
        return true;
      }
      return false;
    }
  }

  // Fetch list of available download files from IVANS inbox
  async listDownloadFiles(): Promise<IvansFileEntry[]> {
    if (!this.accessToken) throw new Error("Not authenticated");

    // Demo mode: return simulated ACORD XML files
    if (this.accessToken === "demo-token") {
      return this.getDemoFiles();
    }

    try {
      const resp = await fetch(`${this.baseUrl}/downloads/inbox`, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "X-IVANS-Subscriber": this.subscriberId,
        },
      });

      if (!resp.ok) {
        if (allowIvansDemoMode) return this.getDemoFiles();
        throw new Error("Unable to list IVANS download files.");
      }
      return await resp.json();
    } catch {
      if (!allowIvansDemoMode) throw new Error("Unable to list IVANS download files.");
      return this.getDemoFiles();
    }
  }

  // Download a specific file by its IVANS file ID
  async downloadFile(fileId: string): Promise<string> {
    if (this.accessToken === "demo-token") {
      return this.getDemoFileContent(fileId);
    }

    try {
      const resp = await fetch(`${this.baseUrl}/downloads/file/${fileId}`, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "X-IVANS-Subscriber": this.subscriberId,
        },
      });

      if (!resp.ok) {
        if (allowIvansDemoMode) return this.getDemoFileContent(fileId);
        throw new Error(`Unable to download IVANS file ${fileId}.`);
      }
      return await resp.text();
    } catch {
      if (!allowIvansDemoMode) throw new Error(`Unable to download IVANS file ${fileId}.`);
      return this.getDemoFileContent(fileId);
    }
  }

  // Acknowledge file receipt so IVANS removes it from the inbox
  async acknowledgeFile(fileId: string): Promise<void> {
    if (this.accessToken === "demo-token") return;
    try {
      await fetch(`${this.baseUrl}/downloads/file/${fileId}/acknowledge`, {
        method: "POST",
        headers: { Authorization: `Bearer ${this.accessToken}` },
      });
    } catch {
      // Non-fatal — IVANS will re-deliver unacknowledged files next cycle
    }
  }

  private async resolveVaultSecret(ref: string): Promise<string> {
    // In production, call Supabase Vault to decrypt the stored secret
    // For now, strip the vault:: prefix and use as-is (placeholder)
    return ref.replace("vault::", "");
  }

  // ─── Demo mode helpers ──────────────────────────────────────────────────────
  private getDemoFiles(): IvansFileEntry[] {
    return [
      { fileId: "demo-001", fileName: "renewal_download_batch1.xml", format: "XML", sizeBytes: 4200, createdAt: new Date().toISOString() },
      { fileId: "demo-002", fileName: "endorsement_batch.xml", format: "XML", sizeBytes: 1800, createdAt: new Date().toISOString() },
    ];
  }

  private getDemoFileContent(fileId: string): string {
    if (fileId === "demo-001") {
      return generateDemoAcordXmlBatch();
    }
    return generateDemoEndorsementXml();
  }
}

// ─── Demo ACORD XML generators ────────────────────────────────────────────────
function generateDemoAcordXmlBatch(): string {
  const today = new Date();
  const expSoon = new Date(today); expSoon.setDate(today.getDate() + 14);
  const expNext = new Date(today); expNext.setDate(today.getDate() + 45);
  const expFuture = new Date(today); expFuture.setDate(today.getDate() + 68);

  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  return `<?xml version="1.0" encoding="UTF-8"?>
<ACORD>
  <InsuranceSvcRq>
    <RqUID>IVANS-DEMO-BATCH-001</RqUID>
    <TransactionCd>RN</TransactionCd>
    <InsurerName>State Farm Fire and Casualty</InsurerName>

    <PersPolicy id="POL-001">
      <PolicyNumber>SF-HO-2024-88431</PolicyNumber>
      <LOBCd>HOME</LOBCd>
      <PolicyType>Homeowners</PolicyType>
      <EffectiveDt>${fmt(expSoon)}</EffectiveDt>
      <ExpirationDt>${fmt(new Date(expSoon.getFullYear() + 1, expSoon.getMonth(), expSoon.getDate()))}</ExpirationDt>
      <TotalPremium>1842.00</TotalPremium>
      <RenewalPremium>1976.00</RenewalPremium>
      <InsuredName>Martinez, Carlos &amp; Maria</InsuredName>
      <PaymentPlan>Annual (paid in full)</PaymentPlan>
      <BillingMethod>Direct Bill</BillingMethod>
      <TransactionCd>RN</TransactionCd>
    </PersPolicy>

    <PersPolicy id="POL-002">
      <PolicyNumber>SF-AUTO-2024-55210</PolicyNumber>
      <LOBCd>AUTO</LOBCd>
      <PolicyType>Personal Auto</PolicyType>
      <EffectiveDt>${fmt(expNext)}</EffectiveDt>
      <ExpirationDt>${fmt(new Date(expNext.getFullYear() + 1, expNext.getMonth(), expNext.getDate()))}</ExpirationDt>
      <TotalPremium>2104.00</TotalPremium>
      <RenewalPremium>2104.00</RenewalPremium>
      <InsuredName>Johnson, Patricia A</InsuredName>
      <PaymentPlan>Monthly (EFT)</PaymentPlan>
      <BillingMethod>Direct Bill</BillingMethod>
      <TransactionCd>RN</TransactionCd>
    </PersPolicy>

    <CommlPolicy id="POL-003">
      <PolicyNumber>SF-BOP-2024-12089</PolicyNumber>
      <LOBCd>BOP</LOBCd>
      <PolicyType>Business Owners Policy</PolicyType>
      <EffectiveDt>${fmt(expFuture)}</EffectiveDt>
      <ExpirationDt>${fmt(new Date(expFuture.getFullYear() + 1, expFuture.getMonth(), expFuture.getDate()))}</ExpirationDt>
      <TotalPremium>6340.00</TotalPremium>
      <RenewalPremium>6890.00</RenewalPremium>
      <InsuredName>Sunrise Bakery LLC</InsuredName>
      <PaymentPlan>Quarterly (4 pay)</PaymentPlan>
      <BillingMethod>Direct Bill</BillingMethod>
      <MortgageeName></MortgageeName>
      <TransactionCd>RN</TransactionCd>
    </CommlPolicy>

  </InsuranceSvcRq>
</ACORD>`;
}

function generateDemoEndorsementXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<ACORD>
  <InsuranceSvcRq>
    <RqUID>IVANS-DEMO-ENDT-001</RqUID>
    <TransactionCd>EN</TransactionCd>
    <InsurerName>Travelers Property Casualty</InsurerName>
    <PersPolicy id="ENDT-001">
      <PolicyNumber>TR-HO-2024-77002</PolicyNumber>
      <LOBCd>HOME</LOBCd>
      <PolicyType>Homeowners</PolicyType>
      <EffectiveDt>${new Date().toISOString().slice(0, 10)}</EffectiveDt>
      <ExpirationDt>${new Date(new Date().getFullYear() + 1, new Date().getMonth(), new Date().getDate()).toISOString().slice(0, 10)}</ExpirationDt>
      <TotalPremium>2210.00</TotalPremium>
      <RenewalPremium>0</RenewalPremium>
      <InsuredName>Thompson, David &amp; Susan</InsuredName>
      <MortgageeName>Wells Fargo Bank NA</MortgageeName>
      <BillingMethod>Escrow / Mortgagee</BillingMethod>
      <TransactionCd>EN</TransactionCd>
    </PersPolicy>
  </InsuranceSvcRq>
</ACORD>`;
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface IvansFileEntry {
  fileId: string;
  fileName: string;
  format: string;
  sizeBytes: number;
  createdAt: string;
}

// ─── Main Sync Orchestrator ───────────────────────────────────────────────────
async function runSync(
  supabase: ReturnType<typeof createClient>,
  connectionId: string,
  accountId: string,
  triggeredBy: "manual" | "scheduled"
): Promise<SyncResult> {
  // Create sync log entry
  const { data: logEntry } = await supabase
    .from("ivans_sync_log")
    .insert({ connection_id: connectionId, account_id: accountId, triggered_by: triggeredBy, status: "running" })
    .select("id")
    .single();

  const logId = logEntry?.id;

  try {
    // Fetch connection credentials
    const { data: conn } = await supabase
      .from("ivans_connections")
      .select("*")
      .eq("id", connectionId)
      .single();

    if (!conn) throw new Error(`Connection ${connectionId} not found`);

    const client = new IvansClient(
      conn.api_endpoint,
      conn.ivans_subscriber_id,
      conn.ivans_username,
      conn.ivans_password_ref
    );

    const authenticated = await client.authenticate();
    if (!authenticated) throw new Error("IVANS authentication failed");

    const files = await client.listDownloadFiles();
    let totalCreated = 0;
    let totalUpdated = 0;
    let totalRenewals = 0;

    for (const file of files) {
      const rawContent = await client.downloadFile(file.fileId, file.fileName);

      // Queue the file
      const { data: queueItem } = await supabase
        .from("ivans_download_queue")
        .insert({
          connection_id: connectionId,
          account_id: accountId,
          file_name: file.fileName,
          acord_format: file.format as "XML" | "AL3" | "Unknown",
          raw_content: rawContent,
          status: "pending",
        })
        .select("id")
        .single();

      // Call the acord-parser edge function
      const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

      const parseResp = await fetch(`${supabaseUrl}/functions/v1/acord-parser`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({
          queueItemId: queueItem?.id,
          accountId,
          connectionId,
          rawContent,
          fileName: file.fileName,
        }),
      });

      if (parseResp.ok) {
        const result = await parseResp.json();
        totalCreated += result.created ?? 0;
        totalUpdated += result.updated ?? 0;
        totalRenewals += result.renewalsFlagged ?? 0;

        // Acknowledge file receipt from IVANS
        await client.acknowledgeFile(file.fileId);
      }
    }

    // Update connection last_sync_at
    await supabase
      .from("ivans_connections")
      .update({
        last_sync_at: new Date().toISOString(),
        next_sync_at: new Date(Date.now() + conn.sync_frequency_hours * 3_600_000).toISOString(),
        status: "active",
        error_message: "",
        updated_at: new Date().toISOString(),
      })
      .eq("id", connectionId);

    // Complete sync log
    if (logId) {
      await supabase.from("ivans_sync_log").update({
        status: "completed",
        files_fetched: files.length,
        policies_created: totalCreated,
        policies_updated: totalUpdated,
        renewals_flagged: totalRenewals,
        completed_at: new Date().toISOString(),
      }).eq("id", logId);
    }

    return { success: true, filesFetched: files.length, policiesCreated: totalCreated, policiesUpdated: totalUpdated, renewalsFlagged: totalRenewals };
  } catch (err) {
    const errMsg = String(err);

    // Mark connection as error
    await supabase
      .from("ivans_connections")
      .update({ status: "error", error_message: errMsg, updated_at: new Date().toISOString() })
      .eq("id", connectionId);

    // Fail the log entry
    if (logId) {
      await supabase.from("ivans_sync_log").update({
        status: "failed",
        error_detail: errMsg,
        completed_at: new Date().toISOString(),
      }).eq("id", logId);
    }

    return { success: false, error: errMsg, filesFetched: 0, policiesCreated: 0, policiesUpdated: 0, renewalsFlagged: 0 };
  }
}

interface SyncResult {
  success: boolean;
  error?: string;
  filesFetched: number;
  policiesCreated: number;
  policiesUpdated: number;
  renewalsFlagged: number;
}

// ─── Main Handler ─────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    if (req.method === "POST") {
      const body = await req.json();
      const { connectionId, accountId, triggeredBy = "manual" } = body;

      if (!connectionId || !accountId) {
        return new Response(
          JSON.stringify({ error: "connectionId and accountId are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const result = await runSync(supabase, connectionId, accountId, triggeredBy);
      return new Response(JSON.stringify(result), {
        status: result.success ? 200 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // GET: list pending connections due for scheduled sync
    if (req.method === "GET") {
      const { data: due } = await supabase
        .from("ivans_connections")
        .select("id, account_id, carrier_name, last_sync_at, next_sync_at, status")
        .eq("status", "active")
        .or(`next_sync_at.is.null,next_sync_at.lte.${new Date().toISOString()}`);

      return new Response(JSON.stringify({ connectionsDue: due ?? [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ status: "ok", service: "ivans-sync" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
