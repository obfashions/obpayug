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
- Fee-inclusive payout minimum errors include the rounded ObPay fee using platform-fees.ts — why: a partner minimum alone can mislead merchants into submitting an amount that is rejected after the platform charge.
- Admin balance changes create privileged, explicit transaction-history records naming the action and actor — why: merchants and admins need a reliable audit trail.
- Reserve each payout reference before contacting the partner, never treat a failed or unconfirmed duplicate as a new success, and alert only on confirmed partner acceptance — why: retries must neither send money twice nor announce an unsent payout.
- A merchant's operating country sets the initial main-currency wallet; keep wallet balances separate and filter displayed totals by the selected wallet — why: amounts from different currencies must never be combined or relabeled.
- Payout history uses stored currency-specific balance snapshots at debit time; missing historical snapshots remain unavailable, never inferred from today's balance — why: financial history must not invent past balances.
- All mobile-money payouts use reserve_payout_and_balance before network submission; it locks funds across the main wallet and managed currency store and records each store's debit for one-time refunds — why: separate references must not spend the same balance, and a failed write must never be reported as a deduction.
- The main wallet scalar replaces its same-currency JSON mirror; combine it with managed funds using balance-values.ts — why: an old JSON value must not restore already withdrawn money.
- Settlement does not also adjust managed balances for legacy transaction mirrors — why: the legacy transaction settlement already owns their wallet credit/refund.
- Member permissions live in protected member_roles and user_roles; role assignment uses an authenticated audited RPC, while profile tags are display-only — why: merchants cannot grant themselves staff privileges.
- Registration codes can be requested before a session exists; the server resolves recipients from Auth and atomically rate-limits and consumes hashed codes — why: confirmed-email signup intentionally returns no session.
