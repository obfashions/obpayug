// Retired. The webhook guide now lives in the ObPay dashboard (Webhooks) and
// in the developer docs at https://obpay.online/docs

Deno.serve(() =>
  new Response(JSON.stringify({ error: "This endpoint has been retired." }), {
    status: 410,
    headers: { "Content-Type": "application/json" },
  }),
);
