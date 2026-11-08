import DashboardLayout from "@/components/feature/DashboardLayout";
import BankAccounts from "@/pages/dashboard/settings/BankAccounts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "@/lib/router-compat";
import { Building2 } from "lucide-react";
import { bankCapabilities } from "@/lib/bank-capabilities";

export default function BankTransferPage() {
  return <DashboardLayout><div className="max-w-5xl mx-auto space-y-6">
    <header><Building2 className="text-primary mb-3" size={28}/><h1 className="text-2xl font-semibold">Bank payments</h1><p className="text-sm text-muted-foreground mt-2">Receiving accounts, payment setup and historical records.</p></header>
    <div className="border-y border-border py-5"><p className="font-medium">Bank connection setup in progress</p><p className="text-sm text-muted-foreground mt-2">{bankCapabilities.message}</p></div>
    <Tabs defaultValue="receive"><TabsList className="flex w-full h-auto flex-wrap sm:w-auto"><TabsTrigger value="receive">Receive</TabsTrigger><TabsTrigger value="send">Send</TabsTrigger><TabsTrigger value="accounts">Saved accounts</TabsTrigger></TabsList>
      <TabsContent value="receive" className="space-y-3 py-5"><h2 className="font-semibold">Bank collections</h2><p className="text-sm text-muted-foreground">Bank collection instructions, supported banks and verified receipt confirmation are awaiting the payment network’s bank integration contract. No collection is submitted and no wallet credit is created.</p><Link to="/docs" className="text-primary underline text-sm">Bank API status</Link></TabsContent>
      <TabsContent value="send" className="space-y-3 py-5"><h2 className="font-semibold">Bank disbursements</h2><p className="text-sm text-muted-foreground">Recipient bank, account number, account name, branch and transfer charges cannot be confirmed against a documented bank-transfer service yet. Transfers remain disabled; your balance is unchanged.</p><Link to="/dashboard/service-history" className="text-primary underline text-sm">Historical service records</Link></TabsContent>
      <TabsContent value="accounts"><BankAccounts/></TabsContent>
    </Tabs>
  </div></DashboardLayout>;
}
