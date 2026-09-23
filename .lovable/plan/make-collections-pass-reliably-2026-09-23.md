# Make collections pass reliably

## Changes
- Keep every payment request on the configured Fixie route; never fall back to a changing address.
- Retry only explicit IP-whitelist rejections through Fixie, allowing the request to use the other approved Fixie address.
- Preserve safe payment behavior: do not retry timeouts or uncertain responses that could create duplicate transactions.
- Improve diagnostics so future address rejections identify the address GO Pay actually saw.

## Verification
- Confirm the app compiles.
- Run repeated live balance checks through the website payment path.
- Create an unpaid 1,000 UGX checkout through the exact collection path and confirm code 200 with a checkout URL.
