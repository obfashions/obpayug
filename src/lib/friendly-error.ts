/**
 * Turns technical/raw errors (Supabase, Resend, fetch, edge functions)
 * into short, human-friendly messages we are happy to show end users.
 */

type AnyErr =
  | string
  | null
  | undefined
  | { message?: string; error?: string; error_description?: string; detail?: string; status?: number };

const RULES: Array<{ match: RegExp; message: string }> = [
  // Network / connectivity
  { match: /failed to fetch|networkerror|network request failed|load failed|err_internet/i,
    message: "We couldn't reach the server. Please check your internet connection and try again." },
  { match: /timeout|timed out|etimedout|aborted/i,
    message: "That took too long to respond. Please try again in a moment." },

  // Auth
  { match: /invalid login credentials|invalid email or password|invalid credentials/i,
    message: "Incorrect email or password. Please try again." },
  { match: /email not confirmed/i,
    message: "Please verify your email address before signing in." },
  { match: /user already registered|already been registered|duplicate key.*email/i,
    message: "An account with this email already exists. Try signing in instead." },
  { match: /password should be at least/i,
    message: "Your password is too short. Please use at least 6 characters." },
  { match: /email rate limit|over_email_send_rate_limit|too many requests|rate limit|429/i,
    message: "Too many attempts. Please wait a minute and try again." },
  { match: /jwt|token.*(expired|invalid)|session.*(expired|missing)|not authenticated|401/i,
    message: "Your session has expired. Please sign in again." },
  { match: /invalid.*code|code.*(invalid|incorrect)/i,
    message: "That verification code isn't correct. Please check it and try again." },
  { match: /code.*expired|expired.*code/i,
    message: "That verification code has expired. Request a new one." },

  // Permissions / data
  { match: /row-level security|permission denied|not authorized|forbidden|403/i,
    message: "You don't have permission to do that." },
  { match: /duplicate key|already exists|unique constraint/i,
    message: "That record already exists." },
  { match: /foreign key|violates .* constraint/i,
    message: "Some of the information provided isn't valid. Please review and try again." },
  { match: /payload too large|file too large|exceeded the maximum/i,
    message: "That file is too large. Please upload a smaller file (under 5MB)." },

  // Email delivery (Resend / mail service)
  { match: /email service not configured|resend_api_key|resend_from_domain/i,
    message: "Email sending isn't set up yet. Please contact support." },
  { match: /domain is not verified|not verified.*domain/i,
    message: "Our email sender isn't verified yet, so the message couldn't be sent. Please contact support." },
  { match: /invalid.*(to|recipient).*(email|address)|invalid email/i,
    message: "That email address doesn't look valid. Please check it and try again." },
  { match: /failed to send (the )?(verification )?email|resend/i,
    message: "We couldn't send the email right now. Please try again in a moment." },

  // Generic server
  { match: /internal server error|500|unexpected|edge function returned a non-2xx/i,
    message: "Something went wrong on our side. Please try again shortly." },
];

export function friendlyError(err: AnyErr, fallback = "Something went wrong. Please try again."): string {
  if (!err) return fallback;

  const raw =
    typeof err === "string"
      ? err
      : err.error || err.message || err.error_description || err.detail || (err.status ? String(err.status) : "");

  if (!raw) return fallback;

  for (const rule of RULES) {
    if (rule.match.test(raw)) return rule.message;
  }

  // Already human-readable? (short sentence, no stack/JSON/technical noise)
  const looksHuman =
    raw.length <= 140 &&
    !/[{}[\]<>]|https?:\/\/|\bat \w+\b|error:/i.test(raw) &&
    /[a-z]/i.test(raw);

  return looksHuman ? raw : fallback;
}
