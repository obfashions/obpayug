import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "@/lib/router-compat";
import { useAuth } from "@/contexts/AuthContext";

const adminNavItems = [
  { label: "Dashboard", href: "/admin", icon: "ri-dashboard-line" },
  { label: "Merchants", href: "/admin/merchants", icon: "ri-store-3-line" },
  { label: "KYC Review", href: "/admin/kyc-review", icon: "ri-shield-check-line" },
  { label: "Loans", href: "/admin/loans", icon: "ri-bank-line" },
  { label: "Transactions", href: "/admin/transactions", icon: "ri-exchange-line" },
  { label: "Txn Lookup", href: "/admin/transaction-lookup", icon: "ri-search-line" },
  { label: "Payout Requests", href: "/admin/payout-requests", icon: "ri-upload-cloud-line" },
  { label: "Reports", href: "/admin/reports", icon: "ri-file-chart-line" },
  { label: "API Monitoring", href: "/admin/api-monitoring", icon: "ri-radar-line" },
  { label: "Audit Logs", href: "/admin/audit-logs", icon: "ri-file-list-3-line" },
  { label: "Company Docs", href: "/admin/company-documents", icon: "ri-government-line" },
  { label: "Support Chat", href: "/admin/support", icon: "ri-chat-3-line" },
  { label: "Tickets", href: "/admin/tickets", icon: "ri-ticket-2-line" },
  { label: "Email Campaigns", href: "/admin/email-campaigns", icon: "ri-mail-send-line" },
  { label: "Gateway API", href: "/admin/gateway-api", icon: "ri-key-2-line" },
  { label: "Settings", href: "/admin/settings", icon: "ri-settings-4-line" },
];

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, profileLoading, signOut, loginVerified, user, loading, globalVerificationEnabled } = useAuth();

  // Auth guard: if session is lost (user closed browser, token expired, etc.)
  // redirect to login so they see a proper login form instead of a broken page.
  useEffect(() => {
    if (loading || profileLoading) return;
    if (!user) {
      navigate("/login", { replace: true });
    }
  }, [user, loading, profileLoading, navigate]);

  // Verification guards
  useEffect(() => {
    if (!profile || profileLoading) return;

    const isVerifyEmailPage = location.pathname === "/verify-email";
    const isVerifyLoginPage = location.pathname === "/verify-login";

    if (isVerifyEmailPage || isVerifyLoginPage) return;

    // Skip all verification guards when coming from a login that had verification disabled
    if ((location.state as any)?.skipVerificationGuard) return;

    if (!profile.email_verified) {
      navigate(`/verify-email?email=${encodeURIComponent(profile.email)}`, { replace: true });
      return;
    }

    if (profile.email_verified && !loginVerified && globalVerificationEnabled) {
      navigate("/verify-login", { replace: true });
    }
  }, [profile, profileLoading, loginVerified, location.pathname, location.state, navigate, globalVerificationEnabled]);

  const handleSignOut = async () => {
    setIsUserMenuOpen(false);
    try {
      await signOut();
    } catch {
      // Even if sign-out fails, force navigation to homepage
    }
    navigate("/");
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = searchQuery.trim();
    if (trimmed) {
      navigate(`/admin/transaction-lookup?q=${encodeURIComponent(trimmed)}`);
      setSearchQuery("");
    }
  };

  const currentPage = adminNavItems.find((n) => n.href === location.pathname)?.label || "Admin";

  const initials = profile?.full_name
    ? profile.full_name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "AD";

  return (
    <div className="min-h-screen bg-background-100 flex">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-foreground-900/30 z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-background-50 border-r border-background-200/70 flex flex-col transition-transform duration-300 ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        {/* Logo */}
        <div className="p-5 border-b border-background-200/70">
          <Link to="/admin" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-accent-500 flex items-center justify-center">
              <span className="text-background-50 font-heading font-bold text-sm">Ob</span>
            </div>
            <span className="font-heading font-bold text-lg text-foreground-900">ObPay</span>
            <span className="ml-auto text-[10px] font-bold uppercase tracking-wider text-accent-600 bg-accent-100 px-2 py-0.5 rounded-full">
              Admin
            </span>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {adminNavItems.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <button
                key={item.href}
                onClick={() => {
                  navigate(item.href);
                  setIsSidebarOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  isActive
                    ? "bg-accent-100 text-accent-700"
                    : "text-foreground-600 hover:bg-background-200/70 hover:text-foreground-900"
                }`}
              >
                <div className="w-5 h-5 flex items-center justify-center shrink-0">
                  <i className={`${item.icon} text-lg`} />
                </div>
                <span className="flex-1 text-left">{item.label}</span>
                {item.href === "/admin/kyc-review" && (
                  <span className="shrink-0 text-[10px] font-bold bg-accent-500 text-background-50 px-1.5 py-0.5 rounded-full">!</span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Back to Site */}
        <div className="p-3 border-t border-background-200/70">
          <Link
            to="/"
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-foreground-600 hover:bg-background-200/70 hover:text-foreground-900 transition-colors"
          >
            <i className="ri-arrow-left-line" />
            Back to Website
          </Link>
        </div>

        {/* User */}
        <div className="p-3 border-t border-background-200/70">
          <div className="relative">
            <button
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-background-200/70 transition-colors cursor-pointer"
            >
              <div className="w-9 h-9 rounded-full bg-accent-100 flex items-center justify-center shrink-0">
                <span className="text-accent-600 font-heading font-bold text-sm">{initials}</span>
              </div>
              <div className="text-left flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground-900 truncate">{profile?.full_name || "Admin"}</p>
                <p className="text-xs text-foreground-500 truncate">{profile?.email || ""}</p>
              </div>
              <i className="ri-more-2-line text-foreground-400" />
            </button>

            {isUserMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setIsUserMenuOpen(false)} />
                <div className="absolute bottom-full left-0 right-0 mb-1 bg-background-50 rounded-lg border border-background-200/70 shadow-lg z-50 py-1">
                  <button
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      navigate("/admin/settings");
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground-700 hover:bg-background-200/70 transition-colors text-left cursor-pointer whitespace-nowrap"
                  >
                    <i className="ri-settings-4-line" />
                    System Settings
                  </button>
                  <div className="border-t border-background-200/70 my-1" />
                  <button
                    onClick={handleSignOut}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-accent-600 hover:bg-accent-50 transition-colors text-left cursor-pointer whitespace-nowrap"
                  >
                    <i className="ri-logout-box-r-line" />
                    Sign Out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="h-16 bg-background-50 border-b border-background-200/70 flex items-center justify-between px-4 md:px-6 sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="lg:hidden w-9 h-9 flex items-center justify-center text-foreground-600 hover:text-foreground-900 cursor-pointer"
            >
              <i className="ri-menu-line text-xl" />
            </button>
            <h1 className="font-heading font-semibold text-lg text-foreground-900 hidden sm:block">
              {currentPage}
            </h1>
          </div>

          <div className="flex items-center gap-2 md:gap-3">
            <form onSubmit={handleSearchSubmit} className="hidden md:flex items-center bg-background-100 rounded-lg px-3 py-2 border border-background-200/70">
              <i className="ri-search-line text-foreground-400 text-sm mr-2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Lookup txn by ref ID..."
                className="bg-transparent text-sm text-foreground-700 placeholder-foreground-400 focus:outline-none w-56"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="ml-1 text-foreground-400 hover:text-foreground-600 cursor-pointer"
                >
                  <i className="ri-close-line text-sm" />
                </button>
              )}
            </form>

            <Link
              to="/admin/audit-logs"
              className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-background-200/70 text-foreground-600 transition-colors"
            >
              <i className="ri-history-line text-lg" />
            </Link>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 md:p-6 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}