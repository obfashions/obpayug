<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Payment partner is Payza; all partner logic lives in src/lib/gateway.server.ts behind a stable adapter API — why: swapping providers touches one file.
- Collections trigger the PIN prompt server-side and settle only after /api/v1/verify confirms — why: white-label UX and never trust unsigned/unchecked notices.
- Accounts, profiles, wallets and transactions live in this project's own backend; the old outside system is read only by src/lib/legacy-migrate.server.ts to move an account on its first sign-in (same ID + password; an admin's first sign-in imports all merchants) — why: one backend for auth, emails and data.
- Password resets (merchant and admin) email a Mailjet link built from generateLink recovery hashed_token → /reset-password — why: no dependency on the old system's email sender.
- Payouts use the live partner fee on the entered gross amount and reject fractional net amounts for zero-decimal currencies before submission — why: mobile-money rails reject fractional payouts and the entered amount must not change silently.
- Admin balance changes create privileged, explicit transaction-history records naming the action and actor — why: merchants and admins need a reliable audit trail.
