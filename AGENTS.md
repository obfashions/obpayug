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

- Primary mobile-money partner remains Payza in gateway.server.ts; secondary Uganda services use marz-services.server.ts via the server connector — why: additional services must not reroute existing payments.
- Collections trigger the PIN prompt server-side and settle only after /api/v1/verify confirms — why: white-label UX and never trust unsigned/unchecked notices.
- Accounts/auth/ledgers use this backend; legacy-migrate.server.ts imports old accounts on first login (same ID/password; first admin imports merchants) — why: one system of record.
- Password resets (merchant and admin) email a Mailjet link built from generateLink recovery hashed_token → /reset-password — why: no dependency on the old system's email sender.
- Merchant payout deduction mode is stored in owner-protected merchant_payout_preferences; payoutQuote uses shared payoutAmounts to reserve the exact debit before sending the same prepared quote to the partner, with full-recipient refunds — why: account and submitted-amount modes must account for both fees without a second live quote changing reserved funds.
- Payouts and account Settings reuse PayoutFees and notify live minimum hooks after a successful save; non-Uganda New Payout opens IntlMoneyPanel with required recipient name — why: fee guidance must follow the persisted choice and selected wallets must never silently submit UGX.
- Payouts reject fractional gross or net amounts for zero-decimal currencies and offer a compatible entered amount for explicit merchant approval — why: the partner calculates fees independently, so silently rounding locally cannot make the payout rail safe.
- Payout error presentation preserves payment-network validation and uncertain-submission instructions verbatim — why: a payment-network rule is not an internet failure, and hiding no-retry instructions risks duplicate payments.
- Payout forms read uncached currency-specific partner minimums and ObPay rates (payoutFeePercent in platform-fees.ts) via use-payout-minimum, using the same rounded fee math as the gateway — why: displayed minimums must match live limits per currency and never reuse Uganda limits elsewhere.
- Map mobile-money SIM networks to the partner's payout method inside gateway.server.ts; UGX uses mobile_money, while Kenya retains its method-specific selection — why: MTN and Airtel labels are not valid UGX payout methods.
- Admin balance changes create privileged, explicit transaction-history records naming the action and actor — why: merchants and admins need a reliable audit trail.
- Reserve each payout reference before contacting the partner, never treat a failed or unconfirmed duplicate as a new success, and alert only on confirmed partner acceptance — why: retries must neither send money twice nor announce an unsent payout.
- A merchant's operating country sets the initial main-currency wallet; keep wallet balances separate and filter displayed totals by the selected wallet — why: amounts from different currencies must never be combined or relabeled.
- Once a wallet exists, protect profiles.default_currency with a database trigger; wallet selection only changes the displayed wallet — why: changing the main-currency label can turn existing UGX funds into spendable RWF without an exchange.
- Payout history uses stored currency-specific balance snapshots at debit time; missing historical snapshots remain unavailable, never inferred from today's balance — why: financial history must not invent past balances.
- All mobile-money payouts use reserve_payout_and_balance before network submission; it locks funds across the main wallet and managed currency store and records each store's debit for one-time refunds — why: separate references must not spend the same balance, and a failed write must never be reported as a deduction.
- Supported currencies live in countries.ts (WALLET_CURRENCIES/MONEY_COUNTRIES); payout-reservation and exchange SQL allowlists must match them, with regression tests per currency, and homepage coverage derives from MONEY_COUNTRIES (USD shown separately as card/crypto) — why: one allowlist, no stale SQL rejecting offered currencies, no invented country availability.
- The main wallet scalar replaces its same-currency JSON mirror; combine it with managed funds using balance-values.ts — why: an old JSON value must not restore already withdrawn money.
- Settlement does not also adjust managed balances for legacy transaction mirrors — why: the legacy transaction settlement already owns their wallet credit/refund.
- Deposit credits use collectionFeeFor: collect_margin adds ObPay's earning to verified partner cost once; legacy collect includes partner cost. Missing evidence defers margin credits — why: no guessed fees, double charges or unbacked funds.
- Member permissions live in protected member_roles and user_roles; role assignment uses an authenticated audited RPC, while profile tags are display-only — why: merchants cannot grant themselves staff privileges.
- Registration codes can be requested before a session exists; the server resolves recipients from Auth and atomically rate-limits and consumes hashed codes — why: confirmed-email signup intentionally returns no session.
- Sierra Leone is stored and sent to the partner as SLL but displayed as SLE — why: the partner rejects SLE in API requests after the 2022 redenomination.
- Currency fees in platform_settings.currency_fees use collect_margin, legacy collect and withdraw via platform-fees.ts — why: admin pricing without code changes.
- Admin payout confirmations reverify matching partner evidence and use service-only confirm_payout_status with finance authorization, merchant locks and original debit allocations — why: corrected outcomes must reverse prior refunds exactly once, preserve currency separation and retain an audit trail without resending money.
- Merchant transfers use authenticated transfer_between_merchants (account locks, durable request key, paired transfer_in/out histories), crediting the recipient's same-currency managed store without the partner — why: no double spend, money conserved, never shown as payouts.
- Per-merchant ObPay fee waivers live in admin-only merchant_fee_exemptions; collection and payout fee resolution must check it so exempt merchants pay partner fees only — why: some accounts are billed by the partner charge alone.
- Partner balance evidence is currency-matched, finite and account-wide; never use it to overwrite a merchant ledger — why: pooled float includes other merchants and internal exchanges do not convert partner funds.
- API balance accepts currency, reconciles first, fails on incomplete reads and is uncached — why: never relabel UGX or pooled float as merchant RWF.
- Exchanges check the from-wallet, then require live partner to-currency funds minus all merchant balances in it to cover the credit, else refuse kindly — why: no partner conversion API, so credits must be backed.
- Payout settlement preserves the recipient net saved at acceptance; never recompute it as amount minus fee (account mode pays the full entered amount).
- Admin account position shows per-currency ObPay earnings = collection margin above partner charge + ObPay payout fees; partner charges are never earnings.
- The exchange fee % is an admin site setting (exchange_fee_percent, 0-20) with a Settings card; default 1.5 when unset.
- Secondary service purchases reserve funds atomically before submission, reuse UUID references, verify terminal outcomes, and retain uncertain reservations; bank creation stays blocked without exact pre-submit fees/idempotency — why: avoid double spending and losses.
- Secondary card credits use a service-only one-time RPC into a restricted card balance, never mobile-money funds — why: the provider card rail is separate.
- Merchant directory is service-only, paged; balance refresh scopes current IDs. Business statements keep currencies separate and disable incomplete exports — why: scalable, truthful records.

- Public pages use original task-focused copy and shared semantic presentation tokens; account layouts keep navigation fixed and content scrollable — why: credible, consistent payment-product presentation without changing financial behavior.
