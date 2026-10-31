import Navbar from "@/components/feature/Navbar";
import Footer from "@/components/feature/Footer";
import { Link } from "@/lib/router-compat";
import { CreditCard, Smartphone, Zap, Droplets, Tv, Building2, ArrowUpRight } from "lucide-react";

const services = [
  { name: "Airtime", detail: "Uganda · MTN, Airtel and Lyca", icon: Smartphone, path: "/dashboard/airtime" },
  { name: "Data bundles", detail: "Uganda · MTN and Airtel packages", icon: Smartphone, path: "/dashboard/data" },
  { name: "Electricity", detail: "LIGHT prepaid meters", icon: Zap, path: "/dashboard/electricity" },
  { name: "Water", detail: "NWSC supported service areas", icon: Droplets, path: "/dashboard/water" },
  { name: "TV subscriptions", detail: "DStv and GOtv packages", icon: Tv, path: "/dashboard/tv" },
  { name: "Card payments", detail: "Debit and credit card collections · UGX", icon: CreditCard, path: "/dashboard/cards" },
  { name: "Bank transfers", detail: "Customer-service assisted · Uganda", icon: Building2, path: "/dashboard/bank-transfer" },
];
export function ServiceDirectory() {
  return <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-0">{services.map(s => <Link key={s.path} to={s.path} className="border-b border-border py-6 bg-transparent flex gap-x-8 gap-y-0 hover:border-primary transition-colors"><s.icon className="text-primary shrink-0" size={24}/><div className="min-w-0"><h3 className="font-semibold">{s.name}</h3><p className="text-muted-foreground text-sm mt-2">{s.detail}</p></div><ArrowUpRight className="ml-auto shrink-0 text-muted-foreground" size={16}/></Link>)}</div>;
}
export default function PublicServicesPage() {
  return <div className="min-h-screen bg-background"><Navbar/><main className="max-w-6xl mx-auto px-4 pt-28 pb-16 space-y-8"><header><h1 className="text-3xl font-semibold">Services for your business</h1><p className="text-muted-foreground mt-3 max-w-2xl">Pay utility bills, purchase airtime and data, or collect card payments. Availability and charges are checked before you submit.</p></header><ServiceDirectory/><p className="text-sm text-muted-foreground">Additional services currently cover Uganda. International mobile-money payments and separate currency wallets remain available across supported countries. Card issuing is not offered.</p><Link to="/docs" className="text-primary underline">API documentation</Link></main><Footer/></div>;
}