import DashboardLayout from "@/components/feature/DashboardLayout";
import BankAccounts from "@/pages/dashboard/settings/BankAccounts";
import BankWithdraw from "./BankWithdraw";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2 } from "lucide-react";
import { BANK_PAYOUT_TIMELINE } from "@/lib/bank-payouts";
import { bankCapabilities } from "@/lib/bank-capabilities";

export default function BankTransferPage() {
  return <DashboardLayout><div className="max-w-5xl mx-auto space-y-6">
    <header><Building2 className="text-primary mb-3" size={28}/><h1 className="text-2xl font-semibold">Bank payments</h1><p className="text-sm text-muted-foreground mt-2">Manage bank receiving and withdrawals. Withdrawals are processed within {BANK_PAYOUT_TIMELINE}.</p></header>
    <Tabs defaultValue="receive"><TabsList className="flex w-full h-auto flex-wrap sm:w-auto"><TabsTrigger value="receive">Receive bank payments</TabsTrigger><TabsTrigger value="send">Withdraw to bank</TabsTrigger><TabsTrigger value="accounts">Saved accounts</TabsTrigger></TabsList>
      <TabsContent value="receive"><section className="space-y-4 py-6 border-y border-border">
        <div className="flex items-center gap-3"><Building2 className="text-primary shrink-0" size={24}/><h2 className="text-lg font-semibold">Receive bank payments</h2></div>
        <p role="status" className="text-sm font-medium">Awaiting bank network activation</p>
        <p className="text-sm text-muted-foreground">Bank receiving is not available yet. The payment network has not supplied confirmed bank collection instructions, supported currencies and settlement charges.</p>
        <p className="text-sm text-muted-foreground">Do not send money to a saved bank account expecting an ObPay wallet credit. Saved account details do not enable automatic collection.</p>
        {!bankCapabilities.automatic_wallet_credit && <p className="text-sm text-muted-foreground">No bank receiving request is submitted and no wallet balance is changed.</p>}
      </section></TabsContent>
      <TabsContent value="send"><BankWithdraw/></TabsContent>
      <TabsContent value="accounts"><BankAccounts/></TabsContent>
    </Tabs>
  </div></DashboardLayout>;
}
