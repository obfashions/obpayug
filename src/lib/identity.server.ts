// Server-only identity resolution.
//
// Merchant accounts and balances still live on the original backend, so a
// caller proves who they are with that backend's access token. Everything else
// (API keys, payment links, webhooks, logs, verification files) lives in
// ObPay's own managed storage and is reached only from these server helpers.

import { hasPermission, type Permission } from "./member-permissions";

export interface Identity {
  userId: string;
  email: string;
  isAdmin: boolean;
  roles?: string[];
}

function legacyUrl(): string {
  return (process.env["SUPABASE_URL"] || (import.meta.env["VITE_SUPABASE_URL"] as string) || "").replace(/\/+$/, "");
}

function legacyKey(): string {
  return (process.env["SUPABASE_PUBLISHABLE_KEY"] || (import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] as string) || "").trim();
}

/** Non-sensitive health info: whether the auth credentials resolved. */
export function legacyConfigStatus(): { hasUrl: boolean; hasKey: boolean } {
  return { hasUrl: Boolean(legacyUrl()), hasKey: Boolean(legacyKey()) };
}


/** Resolves the signed-in merchant from their account access token. */
export async function resolveIdentity(accessToken: string): Promise<Identity | null> {
  const token = String(accessToken || "").trim();
  const base = legacyUrl();
  const key = legacyKey();
  if (!token || !base || !key) return null;

  // A blip on the account backend used to look like an expired session.
  // Retry transient failures before giving up on the token.
  let user: { id?: string; email?: string } | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const resp = await fetch(`${base}/auth/v1/user`, {
        headers: { apikey: key, Authorization: `Bearer ${token}` },
      });
      if (resp.status === 401 || resp.status === 403) return null; // genuinely signed out
      if (resp.ok) {
        user = (await resp.json()) as { id?: string; email?: string };
        break;
      }
    } catch {
      /* retry */
    }
    if (attempt === 0) await new Promise((r) => setTimeout(r, 400));
  }
  if (!user?.id) return null;

  const headers = { apikey: key, Authorization: `Bearer ${token}` };
  const [baseRoles, memberRoles] = await Promise.all([
    fetch(`${base}/rest/v1/user_roles?user_id=eq.${user.id}&select=role`, { headers }),
    fetch(`${base}/rest/v1/member_roles?user_id=eq.${user.id}&select=role`, { headers }),
  ]);
  if (!baseRoles.ok || !memberRoles.ok) throw new Error("Your permissions could not be checked. Please try again.");
  const roles = [...await baseRoles.json(), ...await memberRoles.json()].map((r: { role: string }) => r.role);
  return { userId: user.id, email: user.email || "", isAdmin: hasPermission(roles, "settings"), roles };
}

export async function requireIdentity(accessToken: string): Promise<Identity> {
  const identity = await resolveIdentity(accessToken);
  if (!identity) throw new Error("Please sign in again to continue.");
  return identity;
}


export async function requireAdmin(accessToken: string, permission: Permission = "settings"): Promise<Identity> {
  const identity = await requireIdentity(accessToken);
  if (!hasPermission(identity.roles || [], permission)) throw new Error("You do not have access to this area.");
  return identity;
}
