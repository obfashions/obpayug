import React from "react";
import { render } from "@react-email/render";
import { sendLovableEmail } from "@lovable.dev/email-js";
import { SignupEmail } from "./email-templates/signup";
import { selectedVerificationSender, sendConnectedMailjet } from "./verification-senders.server";

/** Only called after a code has been reserved for the server-resolved account. */
export async function sendCodeEmail(email: string, code: string, claimId: string) {
  const sender = await selectedVerificationSender();
  const element = React.createElement(SignupEmail, {
    siteName: "ObPay", siteUrl: "https://obpay.online", recipient: email,
    confirmationUrl: "", code,
  });
  const [html, text] = await Promise.all([render(element), render(element, { plainText: true })]);
  if (sender.startsWith("mailjet-connected")) {
    await sendConnectedMailjet(sender, { email, html, text, claimId });
    return;
  }
  if (sender === "mailjet") {
    const { sendMailjet } = await import("./mailjet.server");
    const result = await sendMailjet([{ to: email, subject: "Your ObPay verification code", html, text, customId: `verification-code-${claimId}` }]);
    if (result.sent !== 1 || result.failed) throw new Error("Mailjet verification email was not accepted");
    return;
  }
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("Verification email service is not configured");
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