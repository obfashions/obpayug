import React from "react";
import { render } from "@react-email/render";
import { sendLovableEmail } from "@lovable.dev/email-js";
import { SignupEmail } from "./email-templates/signup";

/** Only called after a code has been reserved for the server-resolved account. */
export async function sendCodeEmail(email: string, code: string, claimId: string) {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("Verification email service is not configured");
  const element = React.createElement(SignupEmail, {
    siteName: "ObPay", siteUrl: "https://obpay.online", recipient: email,
    confirmationUrl: "", code,
  });
  const [html, text] = await Promise.all([render(element), render(element, { plainText: true })]);
  const result = await sendLovableEmail({
    to: email,
    from: { name: "ObPay", address: "noreply@obpay.online" },
    sender_domain: "notify.obpay.online",
    subject: "Your ObPay verification code", html, text,
    purpose: "transactional", label: "registration-verification",
    idempotency_key: `verification-code-${claimId}`,
  }, { apiKey, sendUrl: process.env["LOVABLE_SEND_URL"] });
  if (!result.success) throw new Error("Verification email was not accepted");
}