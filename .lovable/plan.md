# Country wallets and merchant guidance

## What will change
- Keep registration country-led: only currently available operating countries appear, and the chosen country sets the account's main currency and first wallet.
- Store the selected country with the account so future account screens can use it consistently.
- Show every enabled wallet on the dashboard, including wallets with a zero balance, with its own exact currency balance.
- Make dashboard totals use only the wallet currently selected, so figures never mix currencies under the wrong symbol.
- Add a concise getting-started panel that explains the real ObPay flow: verify the account, receive money, track confirmations, withdraw, and integrate by API.
- Refine the public “How it works” wording using proven documentation patterns: short steps, clear expectations, and no unsupported claims.

## Technical details
- Reuse the existing live currency availability check and existing wallet preferences; no payment-provider logic changes.
- Filter transaction summaries by currency before formatting.
- Preserve all existing security, settlement, and verification rules.
- Verify the public registration page and signed-in dashboard at desktop and mobile widths where access allows.
