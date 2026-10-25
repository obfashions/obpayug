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
- Merchant payout deduction mode is stored in owner-protected merchant_payout_preferences; payoutQuote uses shared payoutAmounts to reserve the exact debit before sending the same prepared quote to the partner, with full-recipient refunds — why: account and submitted-amount modes must account for both fees without a second live quote changing reserved funds.
- Payouts and account Settings reuse PayoutFees and notify live minimum hooks after a successful save; non-Uganda New Payout opens IntlMoneyPanel with required recipient name — why: fee guidance must follow the persisted choice and selected wallets must never silently submit UGX.
- Payouts reject fractional gross or net amounts for zero-decimal currencies and offer a compatible entered amount for explicit merchant approval — why: the partner calculates fees independently, so silently rounding locally cannot make the payout rail safe.
- Payout error presentation preserves payment-network validation and uncertain-submission instructions verbatim — why: a payment-network rule is not an internet failure, and hiding no-retry instructions risks duplicate payments.
- Payout forms read currency-specific live minimums and current platform fees through use-payout-minimum — why: displayed minimums must use the same rounded fee calculation as the gateway and never reuse Uganda limits for Rwanda or Kenya.
- Resolve currency-specific ObPay payout rates through payoutFeePercent in platform-fees.ts for submissions and minimum guidance, preserving fee-exempt refunds — why: currency overrides must not diverge between forms and money movement.
- Payout submission reads uncached partner minimums and fees — why: newly lowered limits must match the live minimum shown on the form immediately.
- Map mobile-money SIM networks to the partner's payout method inside gateway.server.ts; UGX uses mobile_money, while Kenya retains its method-specific selection — why: MTN and Airtel labels are not valid UGX payout methods.
- Admin balance changes create privileged, explicit transaction-history records naming the action and actor — why: merchants and admins need a reliable audit trail.
- Reserve each payout reference before contacting the partner, never treat a failed or unconfirmed duplicate as a new success, and alert only on confirmed partner acceptance — why: retries must neither send money twice nor announce an unsent payout.
- A merchant's operating country sets the initial main-currency wallet; keep wallet balances separate and filter displayed totals by the selected wallet — why: amounts from different currencies must never be combined or relabeled.
- Once a wallet exists, protect profiles.default_currency with a database trigger; wallet selection only changes the displayed wallet — why: changing the main-currency label can turn existing UGX funds into spendable RWF without an exchange.
- Payout history uses stored currency-specific balance snapshots at debit time; missing historical snapshots remain unavailable, never inferred from today's balance — why: financial history must not invent past balances.
- All mobile-money payouts use reserve_payout_and_balance before network submission; it locks funds across the main wallet and managed currency store and records each store's debit for one-time refunds — why: separate references must not spend the same balance, and a failed write must never be reported as a deduction.
- Both payout-reservation overloads must accept every supported non-USD wallet currency; regression tests run the applied migration for each currency — why: an outdated SQL allowlist must never block dashboard or API Zambia payouts before network submission.
- The main wallet scalar replaces its same-currency JSON mirror; combine it with managed funds using balance-values.ts — why: an old JSON value must not restore already withdrawn money.
- Settlement does not also adjust managed balances for legacy transaction mirrors — why: the legacy transaction settlement already owns their wallet credit/refund.
- All deposit credits use collectionFeeFor with trusted gateway-reported fees when available; the configured collection charge covers at least the partner charge, including USD — why: recharges must credit net funds without stacking duplicate charges or bypassing collection fees.
- Member permissions live in protected member_roles and user_roles; role assignment uses an authenticated audited RPC, while profile tags are display-only — why: merchants cannot grant themselves staff privileges.
- Registration codes can be requested before a session exists; the server resolves recipients from Auth and atomically rate-limits and consumes hashed codes — why: confirmed-email signup intentionally returns no session.
- Supported wallet currencies live in countries.ts (MONEY_COUNTRIES, WALLET_CURRENCIES, SUPPORTED_MONEY_CURRENCIES): UGX, KES, RWF, NGN, XOF, USD, ZMW, SLL, CDF, XAF — why: one allowlist feeds collections, payouts, exchange, and registration so a new currency is added once.
- Homepage country coverage derives from MONEY_COUNTRIES, with USD shown separately as a card/crypto wallet rather than a local US payout country — why: marketing coverage must track supported rails without inventing country availability.
- Exchange SQL validation must match WALLET_CURRENCIES; regression tests exercise every currency against the applied function — why: a stale database allowlist must not reject currencies offered by the exchange page.
- Sierra Leone is stored and sent to the partner as SLL but displayed as SLE — why: the partner rejects SLE in API requests after the 2022 redenomination.
- Per-currency ObPay fee overrides live in platform_settings.currency_fees ({"RWF":{"withdraw":1}}), resolved by payoutFeePercent/collectFeePercent in platform-fees.ts — why: the admin edits each currency's collect/withdraw rate in Settings without code changes.
- Admin payout confirmations reverify matching partner evidence and use service-only confirm_payout_status with finance authorization, merchant locks and original debit allocations — why: corrected outcomes must reverse prior refunds exactly once, preserve currency separation and retain an audit trail without resending money.
- Merchant-to-merchant transfers use authenticated transfer_between_merchants with canonical account locks, one durable request key and paired transfer_in/transfer_out histories; credit the recipient's managed same-currency store without contacting the payment partner — why: retries must not spend twice, transfers must conserve money and cannot be presented as external payouts.
- Per-merchant ObPay fee waivers live in admin-only merchant_fee_exemptions; collection and payout fee resolution must check it so exempt merchants pay partner fees only — why: some accounts are billed by the partner charge alone.
- Partner balance evidence is currency-matched, finite and account-wide; never use it to overwrite a merchant ledger — why: pooled float includes other merchants and internal exchanges do not convert partner funds.
