# Fix live collections and payouts

## What will change
- Replace collection inputs with the exact Uganda checkout details: customer name, email, mobile number, network, whole-number UGX amount, description, and optional reference.
- Replace payout inputs with a clear Mobile Money / Bank choice. Mobile payouts will collect network, wallet number, recipient name, optional email, amount, and reason; bank payouts will collect a supported Ugandan bank, account number, account name, optional contact details, amount, and reason.
- Apply the same validation and field mapping to withdrawals, bank transfers, payment links, and public API requests so every path sends the gateway’s documented payload.
- Remove unsupported currencies and fake account-name verification from these Uganda gateway flows.
- Re-check the live gateway connection and improve the network-address diagnostic so an approved address is not mistaken for the actual address used by a payment request.

## Technical details
- Collections use `POST /api/merchant/checkout` with `merchantReference`, integer `amount`, `customerEmail`, `customerName`, optional normalized `customerAccountNumber`, `customerBankCode`, `redirectUrl`, and callback URL.
- Mobile payouts use `typeTrans: 2`, `UG0030` or `UG0031`, and a normalized `07XXXXXXXX` wallet.
- Bank payouts use `typeTrans: 3`, `UG0001`–`UG0029`, numeric account number, and required recipient name.
- Server validation will enforce UGX whole numbers and reject mismatched or incomplete input before sending it.
- The central payment adapter remains white-label; provider names stay admin-only.

## Verification
- Confirm compilation succeeds.
- Test responsive collection, mobile payout, withdrawal, and bank payout forms.
- Exercise the live connection check and verify the exact payload mapping and user-facing errors.
