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

// ─── ACORD Transaction Type Codes ────────────────────────────────────────────
// ─── ACORD Line of Business Codes ────────────────────────────────────────────
const ACORD_LOB_CODES: Record<string, string> = {
  HOME: "Homeowners",
  AUTO: "Personal Auto",
  BAUTO: "Business Auto",
  GL: "General Liability",
  BOP: "Business Owners Policy",
  WC: "Workers Compensation",
  IM: "Inland Marine",
  UMBERLA: "Umbrella",
  CYBER: "Cyber Liability",
  PL: "Professional Liability",
  LIFE: "Life",
  HEALTH: "Health",
  FARM: "Farm & Ranch",
  FLOOD: "Flood",
};

// ─── ACORD XML Parser ─────────────────────────────────────────────────────────
function parseAcordXml(xml: string): ParsedAcordPolicy[] {
  const results: ParsedAcordPolicy[] = [];

  // Extract all ACORD_InsuranceSvcRq or similar root elements
  const policyBlocks = extractXmlBlocks(xml, "PersPolicy")
    .concat(extractXmlBlocks(xml, "CommlPolicy"))
    .concat(extractXmlBlocks(xml, "PolicySummaryInfo"));

  if (policyBlocks.length === 0) {
    // Try flat ACORD 103 / 130 structure
    const singlePolicy = extractSingleAcordPolicy(xml);
    if (singlePolicy) results.push(singlePolicy);
    return results;
  }

  for (const block of policyBlocks) {
    try {
      const policy = extractPolicyFromBlock(block, xml);
      if (policy) results.push(policy);
    } catch {
      // Skip malformed block
    }
  }

  return results;
}

function extractXmlBlocks(xml: string, tag: string): string[] {
  const blocks: string[] = [];
  const openTag = `<${tag}`;
  const closeTag = `</${tag}>`;
  let start = 0;
  while (true) {
    const s = xml.indexOf(openTag, start);
    if (s === -1) break;
    const e = xml.indexOf(closeTag, s);
    if (e === -1) break;
    blocks.push(xml.slice(s, e + closeTag.length));
    start = e + closeTag.length;
  }
  return blocks;
}

function xmlVal(xml: string, tag: string): string {
  const openTag = `<${tag}`;
  const closeTag = `</${tag}>`;
  const s = xml.indexOf(openTag);
  if (s === -1) return "";
  const contentStart = xml.indexOf(">", s) + 1;
  const e = xml.indexOf(closeTag, contentStart);
  if (e === -1) return "";
  return xml.slice(contentStart, e).trim().replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}

function xmlAttr(xml: string, tag: string, attr: string): string {
  const openTag = `<${tag}`;
  const s = xml.indexOf(openTag);
  if (s === -1) return "";
  const end = xml.indexOf(">", s);
  const tagStr = xml.slice(s, end);
  const attrMatch = tagStr.match(new RegExp(`${attr}="([^"]+)"`));
  return attrMatch ? attrMatch[1] : "";
}

function parseDate(raw: string): string {
  if (!raw) return "";
  // ACORD dates come as MM/DD/YYYY, YYYY-MM-DD, or YYYYMMDD
  if (/^\d{8}$/.test(raw)) {
    return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
  }
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) {
    const [m, d, y] = raw.split("/");
    return `${y}-${m}-${d}`;
  }
  return raw.slice(0, 10); // already ISO or unknown
}

function parsePremium(raw: string): number {
  if (!raw) return 0;
  const cleaned = raw.replace(/[^0-9.]/g, "");
  return parseFloat(cleaned) || 0;
}

function extractSingleAcordPolicy(xml: string): ParsedAcordPolicy | null {
  const policyNumber = xmlVal(xml, "PolicyNumber") || xmlVal(xml, "PolNumber");
  if (!policyNumber) return null;

  return {
    policyNumber,
    insuredName: xmlVal(xml, "InsuredName") || xmlVal(xml, "FullName") || xmlVal(xml, "CoveredPartyName"),
    carrierName: xmlVal(xml, "CarrierName") || xmlVal(xml, "InsurerName") || xmlVal(xml, "CompanyName"),
    policyType: xmlVal(xml, "PolicyType") || xmlVal(xml, "LOBCd") || xmlVal(xml, "PolicyTypeCd"),
    lineOfBusiness: resolveLineOfBusiness(xmlVal(xml, "LOBCd") || xmlVal(xml, "LineOfBusiness")),
    acordTransaction: xmlVal(xml, "TransactionCd") || xmlVal(xml, "TxTypeCd") || "RN",
    effectiveDate: parseDate(xmlVal(xml, "EffectiveDt") || xmlVal(xml, "ContractStartDt")),
    expirationDate: parseDate(xmlVal(xml, "ExpirationDt") || xmlVal(xml, "ContractEndDt")),
    currentPremium: parsePremium(xmlVal(xml, "TotalPremium") || xmlVal(xml, "WrittenPremium") || xmlVal(xml, "PolicyPremium")),
    renewalPremium: parsePremium(xmlVal(xml, "RenewalPremium") || xmlVal(xml, "NewPremium") || "0"),
    paymentPlan: xmlVal(xml, "PaymentPlan") || xmlVal(xml, "PayPlanCd"),
    billingType: xmlVal(xml, "BillingMethod") || xmlVal(xml, "BillTypeCd"),
    mortgagee: xmlVal(xml, "MortgageeName") || xmlVal(xml, "MortgageeNm"),
    renewalStatus: deriveRenewalStatus(xmlVal(xml, "TransactionCd") || xmlVal(xml, "TxTypeCd")),
  };
}

function extractPolicyFromBlock(block: string, fullXml: string): ParsedAcordPolicy | null {
  const policyNumber = xmlVal(block, "PolicyNumber") || xmlVal(block, "PolNumber") || xmlVal(block, "PolicyNum");
  if (!policyNumber) return null;

  // Walk up to find insured name in parent context
  const insuredName =
    xmlVal(block, "InsuredName") ||
    xmlVal(fullXml, "InsuredName") ||
    xmlVal(fullXml, "FullName") ||
    xmlVal(fullXml, "CoveredPartyName");

  return {
    policyNumber,
    insuredName,
    carrierName: xmlVal(block, "CarrierName") || xmlVal(fullXml, "CarrierName") || xmlVal(fullXml, "InsurerName"),
    policyType: xmlVal(block, "PolicyType") || xmlVal(block, "LOBCd") || xmlAttr(block, "PersPolicy", "id"),
    lineOfBusiness: resolveLineOfBusiness(xmlVal(block, "LOBCd") || xmlVal(block, "LineOfBusiness")),
    acordTransaction: xmlVal(block, "TransactionCd") || xmlVal(fullXml, "TransactionCd") || "RN",
    effectiveDate: parseDate(xmlVal(block, "EffectiveDt") || xmlVal(block, "ContractStartDt")),
    expirationDate: parseDate(xmlVal(block, "ExpirationDt") || xmlVal(block, "ContractEndDt")),
    currentPremium: parsePremium(xmlVal(block, "TotalPremium") || xmlVal(block, "WrittenPremium") || xmlVal(block, "PolicyPremium")),
    renewalPremium: parsePremium(xmlVal(block, "RenewalPremium") || "0"),
    paymentPlan: xmlVal(block, "PaymentPlan") || xmlVal(block, "PayPlanCd"),
    billingType: xmlVal(block, "BillingMethod") || xmlVal(block, "BillTypeCd"),
    mortgagee: xmlVal(block, "MortgageeName") || xmlVal(block, "MortgageeNm"),
    renewalStatus: deriveRenewalStatus(xmlVal(block, "TransactionCd") || xmlVal(fullXml, "TransactionCd")),
  };
}

// ─── ACORD AL3 Parser ─────────────────────────────────────────────────────────
// AL3 is a fixed-length/positional format used in older IVANS downloads.
// Each record starts with a 2-char record type code.
function parseAcordAl3(content: string): ParsedAcordPolicy[] {
  const results: ParsedAcordPolicy[] = [];
  const lines = content.split("\n").map((l) => l.replace(/\r$/, ""));

  let current: Partial<ParsedAcordPolicy> = {};
  let inPolicy = false;

  for (const line of lines) {
    if (line.length < 2) continue;
    const recordType = line.slice(0, 2).toUpperCase();

    switch (recordType) {
      case "00": // File header — skip
        break;
      case "01": // Agency record
        break;
      case "02": // Company (carrier) record
        current.carrierName = line.slice(2, 52).trim();
        break;
      case "03": // Policy header
        inPolicy = true;
        current = {};
        current.policyNumber = line.slice(2, 22).trim();
        current.acordTransaction = line.slice(22, 24).trim() || "RN";
        current.lineOfBusiness = resolveLineOfBusiness(line.slice(24, 34).trim());
        current.policyType = ACORD_LOB_CODES[line.slice(24, 34).trim()] || line.slice(24, 34).trim();
        current.effectiveDate = parseAl3Date(line.slice(34, 42));
        current.expirationDate = parseAl3Date(line.slice(42, 50));
        current.renewalStatus = deriveRenewalStatus(current.acordTransaction);
        break;
      case "04": // Insured record
        current.insuredName = line.slice(2, 52).trim();
        break;
      case "05": // Premium record
        current.currentPremium = parsePremium(line.slice(2, 16));
        current.renewalPremium = parsePremium(line.slice(16, 30));
        break;
      case "06": // Billing record
        current.billingType = line.slice(2, 22).trim();
        current.paymentPlan = line.slice(22, 42).trim();
        break;
      case "07": // Mortgagee record
        current.mortgagee = line.slice(2, 52).trim();
        break;
      case "99": // End of policy
        if (inPolicy && current.policyNumber) {
          results.push({
            policyNumber: current.policyNumber || "",
            insuredName: current.insuredName || "",
            carrierName: current.carrierName || "",
            policyType: current.policyType || "",
            lineOfBusiness: current.lineOfBusiness || "",
            acordTransaction: current.acordTransaction || "RN",
            effectiveDate: current.effectiveDate || "",
            expirationDate: current.expirationDate || "",
            currentPremium: current.currentPremium || 0,
            renewalPremium: current.renewalPremium || 0,
            paymentPlan: current.paymentPlan || "",
            billingType: current.billingType || "",
            mortgagee: current.mortgagee || "",
            renewalStatus: current.renewalStatus || "pending",
          });
        }
        inPolicy = false;
        current = {};
        break;
    }
  }

  // Flush final record if file lacks 99 terminator
  if (inPolicy && current.policyNumber) {
    results.push({
      policyNumber: current.policyNumber || "",
      insuredName: current.insuredName || "",
      carrierName: current.carrierName || "",
      policyType: current.policyType || "",
      lineOfBusiness: current.lineOfBusiness || "",
      acordTransaction: current.acordTransaction || "RN",
      effectiveDate: current.effectiveDate || "",
      expirationDate: current.expirationDate || "",
      currentPremium: current.currentPremium || 0,
      renewalPremium: current.renewalPremium || 0,
      paymentPlan: current.paymentPlan || "",
      billingType: current.billingType || "",
      mortgagee: current.mortgagee || "",
      renewalStatus: current.renewalStatus || "pending",
    });
  }

  return results;
}

function parseAl3Date(raw: string): string {
  // AL3 dates are YYYYMMDD
  if (!raw || raw.trim().length < 8) return "";
  const d = raw.trim().slice(0, 8);
  return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function resolveLineOfBusiness(code: string): string {
  if (!code) return "";
  const upper = code.toUpperCase().trim();
  return ACORD_LOB_CODES[upper] || code;
}

function deriveRenewalStatus(txCode: string): string {
  const code = (txCode || "").toUpperCase().trim();
  if (code === "RN") return "renewal_pending";
  if (code === "XL") return "cancelled";
  if (code === "NR" || code === "NONRENEW") return "non_renewed";
  if (code === "NB") return "pending";
  return "pending";
}

function detectFormat(content: string): "XML" | "AL3" | "Unknown" {
  const trimmed = content.trimStart();
  if (trimmed.startsWith("<?xml") || trimmed.startsWith("<ACORD") || trimmed.includes("<PolicyNumber>")) {
    return "XML";
  }
  // AL3: lines start with 2-digit record type numbers
  const firstLines = content.split("\n").slice(0, 5).join("\n");
  if (/^[0-9]{2}[A-Z0-9 ]/m.test(firstLines)) {
    return "AL3";
  }
  return "Unknown";
}

// ─── Renewal Workflow Trigger ─────────────────────────────────────────────────
async function triggerRenewalWorkflow(
  supabase: ReturnType<typeof createClient>,
  accountId: string,
  connectionId: string,
  policies: ParsedAcordPolicy[]
): Promise<{ created: number; updated: number; renewalsFlagged: number }> {
  let created = 0;
  let updated = 0;
  let renewalsFlagged = 0;

  for (const policy of policies) {
    const isRenewal = policy.acordTransaction === "RN" || policy.renewalStatus === "renewal_pending";

    // Check if we already have this policy number in the sync table
    const { data: existing } = await supabase
      .from("ivans_policy_sync")
      .select("id, renewal_status, agent_notified")
      .eq("account_id", accountId)
      .eq("policy_number", policy.policyNumber)
      .maybeSingle();

    const payload = {
      account_id: accountId,
      connection_id: connectionId,
      policy_number: policy.policyNumber,
      insured_name: policy.insuredName,
      carrier_name: policy.carrierName,
      policy_type: policy.policyType,
      line_of_business: policy.lineOfBusiness,
      acord_transaction: policy.acordTransaction,
      effective_date: policy.effectiveDate || null,
      expiration_date: policy.expirationDate || null,
      current_premium: policy.currentPremium || null,
      renewal_premium: policy.renewalPremium || null,
      renewal_status: policy.renewalStatus,
      payment_plan: policy.paymentPlan,
      billing_type: policy.billingType,
      mortgagee: policy.mortgagee,
      agent_notified: false,
      merge_status: "unmatched",
      raw_acord_data: policy,
      synced_at: new Date().toISOString(),
    };

    if (existing) {
      await supabase
        .from("ivans_policy_sync")
        .update({ ...payload, merge_status: existing.merge_status === "merged" ? "merged" : "unmatched" })
        .eq("id", existing.id);
      updated++;

      // Flag renewal if status changed to renewal_pending and not yet notified
      if (isRenewal && !existing.agent_notified) {
        await supabase
          .from("ivans_policy_sync")
          .update({ agent_notified: false }) // stays false until agent acknowledges
          .eq("id", existing.id);
        renewalsFlagged++;
      }
    } else {
      await supabase.from("ivans_policy_sync").insert(payload);
      created++;
      if (isRenewal) renewalsFlagged++;
    }
  }

  return { created, updated, renewalsFlagged };
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface ParsedAcordPolicy {
  policyNumber: string;
  insuredName: string;
  carrierName: string;
  policyType: string;
  lineOfBusiness: string;
  acordTransaction: string;
  effectiveDate: string;
  expirationDate: string;
  currentPremium: number;
  renewalPremium: number;
  paymentPlan: string;
  billingType: string;
  mortgagee: string;
  renewalStatus: string;
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
      const { queueItemId, accountId, connectionId, rawContent, fileName } = body;

      if (!rawContent || !accountId) {
        return new Response(
          JSON.stringify({ error: "rawContent and accountId are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Detect format
      const format = detectFormat(rawContent);

      // Mark queue item as processing
      if (queueItemId) {
        await supabase
          .from("ivans_download_queue")
          .update({ status: "processing" })
          .eq("id", queueItemId);
      }

      // Parse
      let policies: ParsedAcordPolicy[] = [];
      if (format === "XML") {
        policies = parseAcordXml(rawContent);
      } else if (format === "AL3") {
        policies = parseAcordAl3(rawContent);
      } else {
        // Try XML first, fall back to AL3
        policies = parseAcordXml(rawContent);
        if (policies.length === 0) policies = parseAcordAl3(rawContent);
      }

      if (policies.length === 0) {
        if (queueItemId) {
          await supabase
            .from("ivans_download_queue")
            .update({ status: "error", parse_error: "No parseable policies found in file", parsed_at: new Date().toISOString() })
            .eq("id", queueItemId);
        }
        return new Response(
          JSON.stringify({ success: false, error: "No parseable policies found", format, fileName }),
          { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Run renewal workflow
      const stats = await triggerRenewalWorkflow(supabase, accountId, connectionId ?? "", policies);

      // Mark queue item as parsed, clear raw content
      if (queueItemId) {
        await supabase
          .from("ivans_download_queue")
          .update({ status: "parsed", parsed_at: new Date().toISOString(), raw_content: null })
          .eq("id", queueItemId);
      }

      return new Response(
        JSON.stringify({
          success: true,
          format,
          fileName,
          policiesParsed: policies.length,
          ...stats,
          policies: policies.map((p) => ({
            policyNumber: p.policyNumber,
            insuredName: p.insuredName,
            carrierName: p.carrierName,
            acordTransaction: p.acordTransaction,
            renewalStatus: p.renewalStatus,
            expirationDate: p.expirationDate,
            currentPremium: p.currentPremium,
            renewalPremium: p.renewalPremium,
          })),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // GET: health check
    return new Response(
      JSON.stringify({ status: "ok", service: "acord-parser", supportedFormats: ["XML", "AL3"] }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
