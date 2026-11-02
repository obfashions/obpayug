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

- Primary mobile-money partner remains Payza in gateway.server.ts; secondary Uganda services use marz-services.server.ts via the server connector — keep existing payments unchanged.
- Collections trigger the PIN prompt server-side and settle only after /api/v1/verify confirms — white-label UX and never trust unsigned/unchecked notices.
- Accounts/auth/ledgers use this backend; legacy-migrate.server.ts imports old accounts on first login (same ID/password; first admin imports merchants) — one system of record.
- Password resets (merchant and admin) email a Mailjet link built from generateLink recovery hashed_token → /reset-password — no dependency on the old system's email sender.
- Payout mode lives in owner-protected merchant_payout_preferences; payoutQuote uses payoutAmounts to reserve the exact debit and submit that quote, with full refunds — both fees are accounted for without re-quoting.
- Payouts and account Settings reuse PayoutFees and notify live minimum hooks after a successful save; non-Uganda New Payout opens IntlMoneyPanel with required recipient name — fee guidance must follow the persisted choice and selected wallets must never silently submit UGX.
- Payouts reject fractional gross or net amounts for zero-decimal currencies and offer a compatible entered amount for explicit merchant approval — the partner calculates fees independently, so silently rounding locally cannot make the payout rail safe.
- Payout error presentation preserves payment-network validation and uncertain-submission instructions verbatim — a payment-network rule is not an internet failure, and hiding no-retry instructions risks duplicate payments.
- Payout forms read uncached currency-specific partner minimums and ObPay rates (payoutFeePercent in platform-fees.ts) via use-payout-minimum, using the same rounded fee math as the gateway — displayed minimums must match live limits per currency and never reuse Uganda limits elsewhere.
- Map mobile-money SIM networks to the partner's payout method in gateway.server.ts; UGX uses mobile_money, while Kenya retains its method-specific selection — MTN and Airtel labels are not valid UGX payout methods.
- Admin balance changes create privileged, explicit transaction-history records naming the action and actor — merchants and admins need a reliable audit trail.
- Reserve each payout reference before partner submission, never treat a failed or unconfirmed duplicate as a new success, and alert only on confirmed acceptance — retries must neither send money twice nor announce an unsent payout.
- A merchant's operating country sets the initial main-currency wallet; keep wallets separate; filter totals by selected wallet — amounts from different currencies must never be combined or relabeled.
- Once a wallet exists, protect profiles.default_currency with a trigger; wallet selection only changes the displayed wallet — changing the main-currency label can turn existing UGX funds into spendable RWF without an exchange.
- Payout history uses stored per-currency balance snapshots at debit time; missing historical snapshots remain unavailable, never inferred from current balances — financial history must not invent past balances.
- All mobile-money payouts use reserve_payout_and_balance before network submission; it locks funds across the main wallet and managed currency store and records each store's debit for once-only refunds — separate references must not spend the same balance, and a failed write must never be reported as a deduction.
- Supported currencies live in countries.ts (WALLET_CURRENCIES/MONEY_COUNTRIES); payout-reservation and exchange SQL allowlists must match them, with tests per currency, and homepage coverage derives from MONEY_COUNTRIES (USD shown separately as card/crypto) — one allowlist, no stale SQL rejecting offered currencies, no invented country availability.
- The main wallet scalar replaces its same-currency JSON mirror; combine it with managed funds using balance-values.ts — an old JSON value must not restore already withdrawn money.
- Dashboard collection status and credit commit atomically through service-only settle_dashboard_collection, creating missing wallets; legacy mirrors never also credit managed funds.
- Deposit credits use collectionFeeFor: collect_margin adds ObPay's earning to verified partner cost once; legacy collect includes partner cost. Missing evidence defers margin credits — no guessed fees, double charges or unbacked funds.
- Member permissions live in protected member_roles and user_roles; role assignment uses an audited auth RPC, while profile tags are display-only — merchants cannot grant themselves staff privileges.
- Registration codes can be requested before a session exists; the server resolves recipients from Auth and atomically rate-limits and consumes hashed codes — confirmed-email signup intentionally returns no session.
- Verification-code emails use the scaffolded signup template and an admin-selected server-resolved sender; default to managed email, keep campaign sending unchanged, and never automatically retry an uncertain Mailjet submission through a different account. Mailjet CustomID is correlation, not a provider idempotency guarantee.
- Sierra Leone is stored and sent to the partner as SLL but displayed as SLE — the partner rejects SLE in API requests after the 2022 redenomination.
- Currency fees in platform_settings.currency_fees use collect_margin, legacy collect and withdraw via platform-fees.ts — admin pricing without code changes.
- Admin payout confirmations reverify matching partner evidence and use service-only confirm_payout_status with finance authorization, merchant locks and original debit allocations — corrected outcomes must reverse prior refunds once, preserve currency separation and retain an audit trail without resending money.
- Merchant transfers use authenticated transfer_between_merchants (account locks, durable request key, paired transfer_in/out histories), crediting the recipient's same-currency managed store without the partner — no double spend, money conserved, never shown as payouts.
- Per-merchant ObPay fee waivers live in admin-only merchant_fee_exemptions; collection and payout fee resolution must check it so exempt merchants pay partner fees only — some accounts are billed by the partner charge alone.
- Partner balance evidence is currency-matched, finite and account-wide; never overwrite merchant ledgers with it — pooled float includes other merchants and internal exchanges do not convert partner funds.
- API balance accepts currency, reconciles first, fails on incomplete reads and is uncached — never relabel UGX or pooled float as merchant RWF.
- Exchanges check the from-wallet, then require live partner to-currency funds minus all merchant balances in it to cover the credit, else refuse kindly — no partner conversion API, so credits must be backed.
- Payout settlement preserves the recipient net saved at acceptance; never recompute it as amount minus fee (account mode pays the entered amount).
- Admin account position shows per-currency earnings = collection margin above partner charge + ObPay payout fees; partner charges are never earnings.
- The exchange fee % is an admin site setting (exchange_fee_percent, 0-20) with a Settings card; default 1.5 when unset.
- Secondary services reserve funds atomically, reuse UUIDs, verify outcomes and retain uncertain reservations; bank submission requires exact fees/idempotency — prevent losses.
- Secondary card credits use a service-only one-time RPC into a restricted card balance, never mobile-money funds — the provider card rail is separate.
- Merchant directory is service-only, paged; balance refresh scopes current IDs. Business statements keep currencies separate and disable incomplete exports — scalable, truthful records.

- Use original copy, shared tokens/navigation and separate policy routes; signup opens policies in new tabs.
- Phone settings update only the signed-in owner's number through RLS, verify the returned row and refresh the shared profile; identity and financial fields stay unchanged.
