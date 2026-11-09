import DashboardLayout from "@/components/feature/DashboardLayout";
import BankAccounts from "@/pages/dashboard/settings/BankAccounts";
import BankWithdraw from "./BankWithdraw";
import MarzBankSend from "./MarzBankSend";
import BankReceive from "./BankReceive";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2 } from "lucide-react";
import { BANK_PAYOUT_TIMELINE } from "@/lib/bank-payouts";

export default function BankTransferPage() {
  return <DashboardLayout><div className="max-w-5xl mx-auto space-y-6">
    <header><Building2 className="text-primary mb-3" size={28}/><h1 className="text-2xl font-semibold">Bank payments</h1><p className="text-sm text-muted-foreground mt-2">Manage bank receiving and withdrawals. Withdrawals are processed within {BANK_PAYOUT_TIMELINE}.</p></header>
    <Tabs defaultValue="receive"><TabsList className="flex w-full h-auto flex-wrap sm:w-auto"><TabsTrigger value="receive">Receive bank payments</TabsTrigger><TabsTrigger value="send">Withdraw to bank</TabsTrigger><TabsTrigger value="accounts">Saved accounts</TabsTrigger></TabsList>
      <TabsContent value="receive"><BankReceive/></TabsContent>
      <TabsContent value="send"><MarzBankSend/><details className="mt-6 border-t border-border pt-4"><summary className="text-sm cursor-pointer text-muted-foreground">Other currencies (processed by our team)</summary><BankWithdraw/></details></TabsContent>
      <TabsContent value="accounts"><BankAccounts/></TabsContent>
    </Tabs>
  </div></DashboardLayout>;
}
