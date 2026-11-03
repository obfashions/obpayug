import { useState } from "react";
import { Button } from "@/components/ui/button";
import { simulateIntegration, type DemoRecord } from "@/lib/integration-testing";

export default function IntegrationDemo() {
  const [records, setRecords] = useState<DemoRecord[]>([]);
  const [reference, setReference] = useState("PESA-DEMO-001");
  const [amount, setAmount] = useState("1000");
  const [response, setResponse] = useState<unknown>(null);
  const run = (verify: boolean) => {
    const result = simulateIntegration(verify ? `/transactions/${encodeURIComponent(reference)}` : "/collect", verify ? "GET" : "POST", { reference, amount: Number(amount) }, records);
    setRecords(result.records);
    setResponse(result.response);
  };
  return <div className="border-y border-border py-5 space-y-4">
    <h3 className="text-lg font-semibold text-foreground">No-money demonstration</h3>
    <p className="text-sm text-muted-foreground">Local simulation only · No customer prompt, webhook, network charge or wallet credit.</p>
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="text-sm text-foreground space-y-1 block">Invoice reference<input className="block w-full rounded-md border border-input bg-background p-2" value={reference} onChange={(event) => setReference(event.target.value)} /></label>
      <label className="text-sm text-foreground space-y-1 block">Amount (UGX)<input type="number" min="1" step="1" className="block w-full rounded-md border border-input bg-background p-2" value={amount} onChange={(event) => setAmount(event.target.value)} /></label>
    </div>
    <div className="flex flex-wrap gap-2"><Button disabled={!reference.trim()} onClick={() => run(false)}>Simulate collection</Button><Button variant="outline" disabled={!records.length || !reference.trim()} onClick={() => run(true)}>Verify simulated payment</Button></div>
    {response != null && <pre aria-label="Simulation result" className="overflow-x-auto rounded-md bg-muted text-foreground text-xs p-4">{JSON.stringify(response, null, 2)}</pre>}
  </div>;
}