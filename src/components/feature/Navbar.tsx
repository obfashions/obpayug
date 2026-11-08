import { useState, useEffect } from "react";
import { Link, useLocation } from "@/lib/router-compat";
import { Menu, X, Moon, Sun, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/hooks/use-theme";
interface NavbarProps { onToggleTheme?: () => void; theme?: "light" | "dark"; }
export default function Navbar({ onToggleTheme: customToggle, theme: customTheme }: NavbarProps) {
  const appearance = useTheme();
  const onToggleTheme = customToggle ?? appearance.toggleTheme;
  const theme = customTheme ?? appearance.theme;
  const [open, setOpen] = useState(false);
  const location = useLocation();
  useEffect(() => { setOpen(false); }, [location.pathname]);
  const links = [{label:"Services",href:"/services"},{label:"Pricing",href:"/pricing"},{label:"Developers",href:"/docs"},{label:"Support",href:"/support"}];
  return <nav aria-label="Main navigation" className="fixed inset-x-0 top-0 z-50 border-b border-border bg-background">
    <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between gap-6 px-6 md:px-10"><Link to="/" className="text-2xl font-semibold text-foreground">ObPay<span className="text-primary">.</span></Link><div className="hidden items-center gap-8 md:flex">{links.map(l=><Link key={l.href} to={l.href} className="text-sm font-medium text-muted-foreground hover:text-foreground">{l.label}</Link>)}</div><div className="hidden items-center gap-3 md:flex">{onToggleTheme && <Button variant="ghost" size="icon" onClick={onToggleTheme} aria-label={theme==="dark"?"Use light appearance":"Use dark appearance"} title="Change appearance">{theme==="dark"?<Sun />:<Moon />}</Button>}<Button asChild variant="ghost"><Link to="/login">Sign in</Link></Button><Button asChild><Link to="/register">Create account <ArrowUpRight /></Link></Button></div><Button variant="ghost" size="icon" className="md:hidden" onClick={()=>setOpen(!open)} aria-expanded={open} aria-label={open?"Close menu":"Open menu"}>{open?<X />:<Menu />}</Button></div>
    {open && <div className="border-t border-border px-6 py-5 md:hidden">{links.map(l=><Link key={l.href} to={l.href} className="block py-3 text-sm font-medium">{l.label}</Link>)}<div className="mt-4 flex flex-wrap gap-3"><Button asChild variant="outline"><Link to="/login">Sign in</Link></Button><Button asChild><Link to="/register">Create account</Link></Button>{onToggleTheme && <Button variant="ghost" size="icon" onClick={onToggleTheme} aria-label="Change appearance">{theme==="dark"?<Sun />:<Moon />}</Button>}</div></div>}
  </nav>;
}
