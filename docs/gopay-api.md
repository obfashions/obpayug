# GO Pay (LiraLink) payment gateway — integration reference

Source: GO Pay 支付系统接口文档 v2.0.0 (2026-03-27) + GO Pay Uganda page.
Internal reference only. Never surface the provider name to merchants/customers
(white-label); provider details may appear in the admin panel only.

## Environments

| Env | Base URL |
| --- | --- |
| Production (Uganda) | `https://api.liralinkpay.com` |
| Sandbox | `https://pay.weiyiltd.xyz` |

Sandbox AppIds are prefixed `sandbox_`; production AppIds are not.

## Auth

Every request: `Authorization: Basic base64(AppId + ":" + AppSecret)`,
`Content-Type: application/json`.

Our outbound server IPs must be whitelisted by GO Pay ops (max 10).
A single HTTPS callback URL is registered with ops; `eventType` in the payload
distinguishes business types.

## Uganda rules

- Amounts must be **whole numbers** (integers) — no decimals.
- Wallet number format: `0` + 9-digit local number, e.g. `0772123456`
  (total length 10, must start with `0`, digits only).
- Payout `typeTrans`: `2` = wallet/account number, `3` = bank card.
- Provider callback source IPs: `8.208.34.242`, `8.208.84.60`.
- Callback must respond with the literal uppercase body `SUCCESS`.

### Bank / operator codes (bankCode)

| Code | Name |
| --- | --- |
| UG0001 | Absa Bank Uganda Limited |
| UG0002 | Bank of Africa Uganda Limited |
| UG0003 | BRAC Uganda Bank Limited |
| UG0004 | Centenary Bank |
| UG0005 | Cairo Bank Uganda |
| UG0006 | DFCU Bank |
| UG0007 | Diamond Trust Bank |
| UG0008 | Equity Bank Uganda Limited |
| UG0009 | ECObank Uganda |
| UG0010 | Exim Bank (Uganda) |
| UG0011 | EFC Uganda Limited |
| UG0012 | Finance Trust Bank |
| UG0013 | Foundation for International Community Assistance Uganda |
| UG0014 | Guaranty Trust Bank Uganda |
| UG0015 | Housing Finance Bank |
| UG0016 | I&M Bank Uganda |
| UG0017 | KCB Bank Uganda Limited |
| UG0018 | Mercantile Credit Bank |
| UG0019 | NCBA Bank Uganda |
| UG0020 | Opportunity Bank Uganda Limited |
| UG0021 | Pride Microfinance Ltd |
| UG0022 | PostBank Uganda |
| UG0023 | Stanbic Bank Uganda Limited |
| UG0024 | Standard Chartered Uganda |
| UG0025 | Tropical Bank |
| UG0026 | Salaam Bank Uganda (formerly Top Finance Bank Limited) |
| UG0027 | UGAFODE Microfinance Limited |
| UG0028 | United Bank for Africa |
| UG0029 | Wazalendo Savings and Credit Cooperative Society |
| UG0030 | MTN |
| UG0031 | Airtel |

## Conventions

- Time format: `yyyy-MM-dd HH:mm:ss` (24h).
- `merchantReference`: ours, max 64 chars, globally unique per request.
- `platformReference`: theirs, returned on success.
- Response envelope: `{ "code": 200, "msg": "success", "data": { ... } }`.
  `code !== 200` means failure.
- Amounts in callbacks must be read as strings to avoid precision loss.

## Endpoints

### Payout (disbursement) — POST /api/disbursements/single

Request:
```json
{
  "merchantReference": "OBP...",
  "typeTrans": 2,
  "bankCode": "UG0030",
  "accountNumber": "0772123456",
  "customerName": "Recipient Name",
  "amount": 100,
  "customerEmail": "optional",
  "customerPhone": "optional",
  "remark": "optional",
  "notifyUrl": "https://...",
  "clientIp": "optional",
  "address": "optional (some channels)"
}
```
Response data: `{ "platformReference": "P174857896522532" }`.
On timeout: query status before retrying (avoid double payment).

### Payout status — GET /api/disbursements/single/summary

Query by `platformReference` or `merchantReference` (at least one;
`platformReference` wins when both are sent).

Response data: `merchantReference`, `platformReference`,
`status` (`PROCESSING` | `SUCCESS` | `FAILED`), `amount`, `transferredAt`,
plus `reason` / `errorMsg` on failure.

### Collection (checkout) — POST /api/merchant/checkout

Request:
```json
{
  "merchantReference": "OBP...",
  "amount": 1000,
  "customerEmail": "required",
  "customerName": "required",
  "customerAccountNumber": "0772123456 (recommended, reduces drop-offs)",
  "customerBankCode": "UG0030",
  "redirectUrl": "https://obpay.online/pay/complete",
  "paymentDescription": "optional",
  "notifyUrl": "https://obpay.online/api/public/gopay-callback"
}
```
Response data: `{ "platformReference": "WECK...", "checkoutUrl": "https://..." }`.
Redirect the payer to `checkoutUrl`; the result arrives by callback.

### Balance — GET /api/disbursements/account-balance

Response data: `availableBalance`, `frozenAmount`, `returnedMoneyBalance`.

## Callbacks (async notifications)

POST JSON to our `notifyUrl`, headers include `X-Sign` and `X-Request-Id`.

Verification: `HMAC-SHA512(raw request body, AppSecret)` hex-encoded lowercase,
compared exactly against `X-Sign`. **Must use the raw body string** — never
re-serialize the parsed JSON.

Known-good vector:
- AppSecret `91MUDL9N6U3BQRXBQ2PJ9M0PW4J22M1Y`
- Body `{"eventData":{"accountReference":"c2037341402XXXXX0832","amount":1590000.0,"amountPaid":1590000.0,"paidAt":"2026-03-27 08:30:58","platformReference":"C203734157XXXX13888","source":"VA","status":"SUCCESS"},"eventType":"COLLECTION"}`
- Sign `88508e1addf991cac4483e9b5189691c982b436a5d4b4c1f44887f51ecb81b6fe769cbb265b163db5dee19666411227f12b3f2561b3b31ff8d20566aa6d643ab`

Payload shapes:
```json
{ "eventType": "DISBURSEMENT",
  "eventData": { "amount": 1502500.0, "status": "SUCCESS", "errorMsg": "",
                 "transferredAt": "2026-03-27 08:31:15",
                 "merchantReference": "...", "platformReference": "P..." } }
```
```json
{ "eventType": "COLLECTION",
  "eventData": { "amount": 270000.0, "amountPaid": 270000.0,
                 "paidAt": "2026-03-26 15:54:04", "source": "WECK",
                 "status": "SUCCESS", "merchantReference": "...",
                 "platformReference": "WECK..." } }
```
VA-channel collections also carry `accountReference`.

`eventType` values: `DISBURSEMENT`, `COLLECTION`, `REFUND`,
`COLLECTION_REFUND`, `COLLECTION_PAY_BILL`.
`status` values: `PROCESSING`, `SUCCESS`, `FAILED`.

Rules:
- Respond with uppercase `SUCCESS` immediately, then process.
- Notifications may repeat: be idempotent, only upgrade status
  (never SUCCESS -> FAILED).
- For collections, compare `amountPaid` with `amount`; a short payment is not a
  full success.
- Retries when we don't return `SUCCESS`: after 5m, 15m, 30m, 1h, 2h (max 5).

## Error codes

HTTP: 200 ok (check `code`), 400 bad params, 401 bad AppId/AppSecret,
403 IP not whitelisted, 500 provider error.

Business codes: 10002 bad parameter, 10003 bad key, 10004 insufficient balance,
700001 appid not found, 700002 IP not supported, 700003 bad app secret,
700004 app disabled, 4000017 app does not exist, 4000018 IP not supported,
4000019 merchant not supported, 4000020 risk control interception / app not
enabled, 4000030 insufficient available balance, 4000050 duplicate submission,
4000004 order already exists, 5000001 service timeout, 5000002 upstream timeout.

Payout: 4000012 disbursement not found, 4000013 both references blank,
4000015 bank code does not exist, single-limit not configured,
6000001 account no must be digits only, 6000002 phone account must start with 0,
6000003 phone account length must be 10, 6000004 phone format invalid,
6000005 amount must be a whole number, 6000006 account name blank,
6000007 batch payouts limited to 30, 6000008 account number pattern mismatch.

Collection: 4000011 transaction not exists, 4000001 data format incorrect,
4000012 channel parameters not configured.
