# Move merchant sign-in and account data into this project

## Goal
Merchants sign in, reset passwords and keep all their money and history on this project's own backend. The old outside system is used only once per merchant, silently, to bring their account over. Merchants see no difference.

## How merchants move (automatic, invisible)
```text
Merchant logs in with email + password
  -> found in this project?  yes -> signed in
  -> no -> check the same email + password against the old system (read-only)
       -> correct -> create the account here with the SAME account ID and SAME password,
                     copy their profile, wallet balance, transactions, payout requests,
                     KYC details and notifications here -> signed in
       -> wrong   -> "Incorrect email or password"
```
- Same account ID means payment links, API keys, KYC files and payment records already stored here stay linked with no changes.
- A merchant copied once is never copied again, so balances aren't double-counted.
- New sign-ups are created only in this project.

## Password reset (emailed link)
- "Forgot password" and the admin Reset button both email a reset link through Mailjet from noreply@obpay.online.
- The link opens /reset-password; the merchant types a new password, and that password works at login.
- If the merchant hasn't moved yet, clicking Reset brings their account over first, then sends the link.
- The admin "type a password" box is replaced by a **Send reset link** button.

## Admin panel
- The merchant list shows moved merchants from this project plus not-yet-moved merchants from the old system (marked "Not yet signed in since upgrade").
- Balance changes, suspend/delete, impersonation and password reset work on this project for moved merchants.
- Admin accounts move the same way the first time the admin logs in. Admin rights are stored in a separate roles table.

## Not included / limits
- Merchants who never log in again stay in the old system until they log in or an admin clicks Reset.
- Old loan and "julypay" data is not copied because those features were removed.

## Technical details
- Migration: create `profiles`, `transactions`, `merchant_wallets`, `payout_requests`, `notifications`, `support_messages`, `support_tickets`, `support_ticket_replies`, `audit_logs`, `platform_settings`, `company_documents`, `merchant_profiles`, `email_campaign_logs`, plus `user_roles` + `has_role()`, with GRANTs and RLS scoped to `auth.uid()` or admin. Add a `migrated_from_legacy_at` column on profiles.
- `src/lib/supabase.ts` re-exports the Cloud client, so all 39 importers switch at once. The old URL and anon key stay only in `legacy-migrate.server.ts`.
- Server function `signInOrMigrate`: Cloud sign-in first. On failure, it signs in to the old system with the anon key and reads the merchant's own rows using their token under the old RLS. It then calls `supabaseAdmin.auth.admin.createUser({ id, email, password, email_confirm: true })` and bulk-inserts the rows. It's idempotent through `migrated_from_legacy_at`.
- Admin reset: `generateLink({ type: 'recovery' })` with a service-role action sends the link via Mailjet. Unmoved merchants are copied using admin-readable old rows through the admin's old session.
- `identity.server.ts`, `obpay.server.ts` and `platform.server.ts` verify tokens against Cloud and use `supabaseAdmin`. The `SERVICE_KEY` legacy path and the calls to the `obpay-api-no-jwt` edge function are removed.
- Turn on email auth and point the recovery redirect at /reset-password.
