export const VERIFICATION_SENDER_SETTING = "verification_email_sender";
const CONNECTION_KEY = "UDC_MAILJET_VERIFICATION_API_KEY";

export function verificationSenders() {
  const senders = [{ id: "managed", label: "ObPay managed email", ready: Boolean(process.env["LOVABLE_API_KEY"]) }];
  senders.push({ id: "mailjet", label: "Mailjet — existing account", ready: Boolean(process.env["MAILJET_API_KEY"] && process.env["MAILJET_SECRET_KEY"]) });
  for (const key of Object.keys(process.env).sort()) {
    if (!new RegExp(`^${CONNECTION_KEY}(_[1-9][0-9]*)?$`).test(key) || !process.env[key]) continue;
    const suffix = key.slice(CONNECTION_KEY.length);
    senders.push({ id: `mailjet-connected${suffix}`, label: `Mailjet — connected account ${suffix ? Number(suffix.slice(1)) + 1 : 1}`, ready: Boolean(process.env["LOVABLE_API_KEY"]) });
  }
  return senders;
}

export async function selectedVerificationSender() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.from("site_settings").select("value").eq("key", VERIFICATION_SENDER_SETTING).maybeSingle();
  if (error) throw new Error("Verification sender settings could not be read");
  const id = String(data?.value || "managed");
  if (!verificationSenders().some((sender) => sender.id === id && sender.ready)) throw new Error("Selected verification sender is not configured");
  return id;
}

export async function sendConnectedMailjet(id: string, message: { email: string; html: string; text: string; claimId: string }) {
  const suffix = id.slice("mailjet-connected".length);
  if (!/^(_[1-9][0-9]*)?$/.test(suffix)) throw new Error("Invalid verification sender");
  const connectionKey = process.env[`${CONNECTION_KEY}${suffix}`];
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!connectionKey || !apiKey) throw new Error("Mailjet verification account is not configured");
  const response = await fetch("https://connector-gateway.lovable.dev/udc_mailjet_verification/v3.1/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "X-Connection-Api-Key": connectionKey, "Content-Type": "application/json" },
    body: JSON.stringify({ Messages: [{ From: { Email: "noreply@obpay.online", Name: "ObPay" }, To: [{ Email: message.email }], Subject: "Your ObPay verification code", HTMLPart: message.html, TextPart: message.text, CustomID: `verification-code-${message.claimId}` }] }),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    // Do not record the email body/code or retry through another account after an uncertain send.
    throw new Error(`Mailjet verification request failed [${response.status}]`);
  }
  const result = await response.json() as { Messages?: { Status?: string }[] };
  if (result.Messages?.length !== 1 || result.Messages[0]?.Status !== "success") throw new Error("Mailjet verification email was not accepted");
}