import DashboardLayout from "@/components/feature/DashboardLayout";
import BankAccounts from "@/pages/dashboard/settings/BankAccounts";
import BankWithdraw from "./BankWithdraw";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2 } from "lucide-react";
import { BANK_PAYOUT_TIMELINE } from "@/lib/bank-payouts";

export default function BankTransferPage() {
  return <DashboardLayout><div className="max-w-5xl mx-auto space-y-6">
    <header><Building2 className="text-primary mb-3" size={28}/><h1 className="text-2xl font-semibold">Bank payments</h1><p className="text-sm text-muted-foreground mt-2">Withdraw your balance to any bank account. Withdrawals are processed within {BANK_PAYOUT_TIMELINE}.</p></header>
    <Tabs defaultValue="send"><TabsList className="flex w-full h-auto flex-wrap sm:w-auto"><TabsTrigger value="send">Withdraw to bank</TabsTrigger><TabsTrigger value="accounts">Saved accounts</TabsTrigger></TabsList>
      <TabsContent value="send"><BankWithdraw/></TabsContent>
      <TabsContent value="accounts"><BankAccounts/></TabsContent>
    </Tabs>
  </div></DashboardLayout>;
}
