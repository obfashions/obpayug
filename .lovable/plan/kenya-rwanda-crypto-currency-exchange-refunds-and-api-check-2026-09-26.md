# Kenya, Rwanda, crypto, currency exchange, refunds and API check

## What the partner guide actually offers (read again)
- **Kenya (KES):** M-Pesa PIN prompt direct to the phone; Airtel/Telkom/Equitel only via the partner's own checkout page. Payouts to M-Pesa, Airtel and banks.
- **Rwanda (RWF):** MTN and Airtel mobile money, collections and payouts.
- **Crypto:** no separate integration. Each payment returns a crypto checkout link; the customer picks a coin on the partner's page and the money lands in a **USD** wallet. Payouts to a crypto wallet address are also supported. That page is the partner's own, so its name may show there.
- **Currency exchange:** the guide has **no exchange/convert endpoint** (it exists only inside your partner dashboard). ObPay can show a converter using a free public rate feed and convert between a merchant's own ObPay balances internally, but it cannot move money between your partner wallets automatically.
- **Refunds:** the partner's refund endpoint only **records** the refund and deducts the wallet — it does **not** send money back to the customer. ObPay will record the refund and then send the money back to the customer's number as a payout.
- Also missing in ObPay today and added: payout methods list, bank list per country (Kenya banks), and the `payment.refunded` notice.

## What will be built
1. **Kenya and Rwanda**
   - Country picker (Uganda / Kenya / Rwanda) on Collections, Payouts, payment links and the API.
   - Correct phone format per country (256 / 254 / 250), networks per country, whole-number amounts for UGX/RWF.
   - Separate balance per currency (UGX, KES, RWF, USD) on the dashboard; currency switcher limited to these.
   - Kenya bank payouts using the partner's bank list.
2. **Crypto page** (new dashboard page)
   - "Receive crypto": enter amount in USD, get a crypto payment link to share; balance credited in USD after confirmation.
   - "Send crypto": pay out from the USD balance to a wallet address.
3. **Currency exchange page** (new dashboard page)
   - Live rates between UGX, KES, RWF and USD, a calculator, and "Convert" between the merchant's own ObPay balances with a small admin-set fee.
4. **Refunds page** (new dashboard page)
   - List of successful payments, "Refund" (full or partial) with a reason; records it with the partner, sends the money back to the payer's number, deducts the merchant's balance, shows history and status.
   - Same action in the API (`POST /refund`, `GET /refunds`) and in the docs.
5. **API test from another website**
   - A small separate test script acting as an outside website: creates a key, checks balance, starts a collection, lists transactions, receives and checks a signed notice on a test address. Results reported back; test key removed afterwards.

## Technical details
- All partner calls stay in `src/lib/gateway.server.ts` (new adapter functions: `payoutMethods`, `banks`, `refund`, `listRefunds`, crypto URL passthrough, per-currency phone normalisers).
- New table for per-currency merchant balances ledger reuse (`merchant_balances` already per currency) plus `refunds` table (merchant_id, payment reference, amount, currency, reason, status, payout reference) with service_role-only access.
- Settlement credits the payment's own currency; `payment.refunded` notice handled in the callback route.
- New routes: `/dashboard/crypto`, `/dashboard/exchange`, `/dashboard/refunds` with their own titles; linked from the dashboard menu.
- Rates from a free no-key rate feed, cached 10 minutes server-side.

## Things you must do
- Switch KES, RWF and USD on in the partner dashboard (you said you will).
- Publish after the build.
