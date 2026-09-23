// Retired. ObPay no longer uses this provider or this endpoint.
// Payment result notifications are received and verified at
// https://obpay.online/api/public/gateway-callback

Deno.serve(() =>
  new Response(JSON.stringify({ error: "This endpoint has been retired." }), {
    status: 410,
    headers: { "Content-Type": "application/json" },
  }),
);
