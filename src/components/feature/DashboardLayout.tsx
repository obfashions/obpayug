import { useState, useEffect, useCallback } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";

const BANNER_DISMISSED_KEY = "obpay_verify_banner_dismissed";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: "ri-dashboard-line", group: "main" },
  { label: "Collections", href: "/dashboard/collections", icon: "ri-download-cloud-line", group: "main" },
  { label: "Loans", href: "/dashboard/loans", icon: "ri-bank-line", group: "main" },
  { label: "Payouts", href: "/dashboard/payouts", icon: "ri-upload-cloud-line", group: "main" },
  { label: "Transactions", href: "/dashboard/transactions", icon: "ri-exchange-line", group: "main" },
  { label: "Payment Links", href: "/dashboard/payment-links", icon: "ri-link-m", group: "main" },
  { label: "Reports", href: "/dashboard/reports", icon: "ri-file-chart-line", group: "main" },
  { label: "API Keys", href: "/dashboard/api-keys", icon: "ri-key-2-line", group: "dev" },
  { label: "API Sandbox", href: "/dashboard/api-sandbox", icon: "ri-terminal-box-line", group: "dev" },
  { label: "Webhooks", href: "/dashboard/webhooks", icon: "ri-webhook-line", group: "dev" },
  { label: "Compliance", href: "/dashboard/company-documents", icon: "ri-government-line", group: "account" },
  { label: "Support", href: "/support", icon: "ri-customer-service-2-line", group: "account" },
  { label: "Settings", href: "/dashboard/settings", icon: "ri-settings-4-line", group: "account" },
];

interface DashboardLayoutProps {
  children: React.ReactNode;
}

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [dbVerificationStatus, setDbVerificationStatus] = useState<"pending" | "approved" | "rejected" | null>(null);
  const [verificationLoading, setVerificationLoading] = useState(true);
  const [verificationFetchFailed, setVerificationFetchFailed] = useState(false);
  const [bannerVisible, setBannerVisible] = useState(() => {
    // Only show banner if not previously dismissed
    try { return localStorage.getItem(BANNER_DISMISSED_KEY) !== "1"; } catch { return true; }
  });
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
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

  // Email verification guard — redirect if not verified
  useEffect(() => {
    if (!profile || profileLoading) return;

    const isVerifyEmailPage = location.pathname === "/verify-email";
    const isVerifyLoginPage = location.pathname === "/verify-login";

    // Skip guards on verification pages themselves
    if (isVerifyEmailPage || isVerifyLoginPage) return;

    // Skip all verification guards when coming from a login that had verification disabled
    if ((location.state as any)?.skipVerificationGuard) return;

    // If email not verified, redirect to verify-email
    if (!profile.email_verified) {
      navigate(`/verify-email?email=${encodeURIComponent(profile.email)}`, { replace: true });
      return;
    }

    // If email verified but login not verified, redirect to verify-login
    // BUT only if global verification is enabled (admin can turn it off when Resend is down)
    if (profile.email_verified && !loginVerified && globalVerificationEnabled) {
      navigate("/verify-login", { replace: true });
    }
  }, [profile, profileLoading, loginVerified, location.pathname, location.state, navigate, globalVerificationEnabled]);

  const dismissBanner = () => {
    setBannerVisible(false);
    try { localStorage.setItem(BANNER_DISMISSED_KEY, "1"); } catch { /* noop */ }
  };

  const fetchNotifications = useCallback(async () => {
    if (!profile?.id) return;
    try {
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(20);
      if (data) {
        setNotifications(data as Notification[]);
        setUnreadCount(data.filter((n: any) => !n.is_read).length);
      }
    } catch { /* silent */ }
  }, [profile?.id]);

  // Fetch real verification status from the database
  useEffect(() => {
    if (!profile?.id) {
      setVerificationLoading(false);
      return;
    }

    supabase
      .from("merchant_profiles")
      .select("verification_status")
      .eq("user_id", profile.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) {
          console.error("Failed to fetch verification status:", error);
          setVerificationFetchFailed(true);
          // Don't change dbVerificationStatus — leave as null but mark fetch as failed.
          // This prevents the banner from showing on fetch errors.
        } else {
          setVerificationFetchFailed(false);
          setDbVerificationStatus(data?.verification_status ?? null);
        }
        setVerificationLoading(false);
      });

    fetchNotifications();
  }, [profile?.id, fetchNotifications]);

  // Admin users are always verified — they don't need KYC
  const isAdmin = profile?.role === "admin";
  const isVerified = isAdmin || dbVerificationStatus === "approved";

  // Only show the banner when we KNOW the user needs verification:
  // - Not an admin
  // - Not verified
  // - Fetch didn't fail (so we have a definitive answer)
  // - Banner hasn't been dismissed
  // - Not on the KYC page
  // - Not still loading
  const showBanner =
    !isAdmin &&
    !isVerified &&
    !verificationFetchFailed &&
    !verificationLoading &&
    bannerVisible &&
    location.pathname !== "/dashboard/kyc";

  const handleSignOut = async () => {
    setIsUserMenuOpen(false);
    try {
      await signOut();
    } catch {
      // Even if sign-out fails, force navigation to homepage
    }
    navigate("/");
  };

  const initials = profile?.full_name
    ? profile.full_name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "??";

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
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary-500 flex items-center justify-center">
              <span className="text-background-50 font-heading font-bold text-sm">Ob</span>
            </div>
            <span className="font-heading font-bold text-lg text-foreground-900">ObPay</span>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
          {["main", "dev", "account"].map((group) => {
            const groupItems = navItems.filter((n) => n.group === group);
            const groupLabel = group === "dev" ? "Developer" : group === "account" ? "Account" : null;
            return (
              <div key={group} className={group !== "main" ? "pt-3" : ""}>
                {groupLabel && (
                  <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-foreground-400">
                    {groupLabel}
                  </p>
                )}
                {groupItems.map((item) => {
                  const isActive = location.pathname === item.href;
                  return (
                    <button
                      key={item.href}
                      onClick={() => {
                        navigate(item.href);
                        setIsSidebarOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                        isActive
                          ? "bg-primary-100 text-primary-700"
                          : "text-foreground-600 hover:bg-background-200/70 hover:text-foreground-900"
                      }`}
                    >
                      <div className="w-5 h-5 flex items-center justify-center">
                        <i className={`${item.icon} text-lg`} />
                      </div>
                      <span className="flex-1 text-left">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </nav>

        {/* Admin Panel */}
        {isAdmin && (
          <div className="px-3 pb-1">
            <button
              onClick={() => navigate("/admin")}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium bg-foreground-900 text-background-50 hover:bg-foreground-800 transition-colors cursor-pointer"
            >
              <div className="w-5 h-5 flex items-center justify-center">
                <i className="ri-admin-line text-lg" />
              </div>
              <span className="flex-1 text-left">Admin Panel</span>
              <i className="ri-arrow-right-up-line text-xs" />
            </button>
          </div>
        )}

        {/* Verification Status */}
        <div className="p-3">
          <div className={`rounded-lg px-3 py-2.5 text-xs ${
            verificationLoading
              ? "bg-background-100 text-foreground-500"
              : isVerified
                ? "bg-primary-100 text-primary-700"
                : "bg-accent-100 text-accent-700"
          }`}>
            <div className="flex items-center gap-1.5 mb-1">
              <i className={`${verificationLoading ? "ri-loader-4-line animate-spin" : isVerified ? "ri-shield-check-line" : "ri-time-line"}`} />
              <span className="font-semibold">
                {verificationLoading ? "Checking..." : isVerified ? "Verified" : "Pending Verification"}
              </span>
            </div>
            <p className="text-foreground-600 leading-relaxed">
              {verificationLoading
                ? "Loading your status..."
                : isVerified
                  ? "All features are unlocked."
                  : "Complete KYC to unlock all features."}
            </p>
            {!isVerified && !isAdmin && !verificationLoading && (
              <button
                onClick={() => navigate("/dashboard/kyc")}
                className="mt-1.5 text-primary-500 hover:text-primary-600 font-medium cursor-pointer"
              >
                Complete KYC →
              </button>
            )}
          </div>
        </div>

        {/* User */}
        <div className="p-3 border-t border-background-200/70">
          <div className="relative">
            <button
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-background-200/70 transition-colors cursor-pointer"
            >
              <div className="w-9 h-9 rounded-full bg-primary-100 flex items-center justify-center shrink-0">
                <span className="text-primary-600 font-heading font-bold text-sm">{initials}</span>
              </div>
              <div className="text-left flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground-900 truncate">{profile?.full_name || "Merchant"}</p>
                <p className="text-xs text-foreground-500 truncate">{profile?.email || ""}</p>
              </div>
              <i className="ri-more-2-line text-foreground-400" />
            </button>

            {isUserMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setIsUserMenuOpen(false)}
                />
                <div className="absolute bottom-full left-0 right-0 mb-1 bg-background-50 rounded-lg border border-background-200/70 shadow-lg z-50 py-1">
                  <button
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      navigate("/dashboard/settings");
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground-700 hover:bg-background-200/70 transition-colors text-left cursor-pointer"
                  >
                    <i className="ri-user-settings-line" />
                    Account Settings
                  </button>
                  <button
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      navigate("/dashboard/kyc");
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground-700 hover:bg-background-200/70 transition-colors text-left cursor-pointer"
                  >
                    <i className="ri-shield-user-line" />
                    KYC Verification
                  </button>
                  <div className="border-t border-background-200/70 my-1" />
                  <button
                    onClick={handleSignOut}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-accent-600 hover:bg-accent-50 transition-colors text-left cursor-pointer"
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
              {navItems.find((n) => n.href === location.pathname)?.label || "Dashboard"}
            </h1>
          </div>

          <div className="flex items-center gap-2 md:gap-3">
            {/* Search */}
            <div className="hidden md:flex items-center bg-background-100 rounded-lg px-3 py-2 border border-background-200/70">
              <i className="ri-search-line text-foreground-400 text-sm mr-2" />
              <input
                type="text"
                placeholder="Search transactions..."
                className="bg-transparent text-sm text-foreground-700 placeholder-foreground-400 focus:outline-none w-48"
              />
            </div>

            {/* Notifications */}
            <div className="relative">
              <button
                onClick={() => setIsNotifOpen(!isNotifOpen)}
                className="relative w-9 h-9 flex items-center justify-center rounded-lg hover:bg-background-200/70 text-foreground-600 transition-colors cursor-pointer"
              >
                <i className="ri-notification-3-line text-lg" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-accent-500 text-background-50 text-[10px] font-bold px-1">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>

              {isNotifOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsNotifOpen(false)} />
                  <div className="absolute right-0 top-full mt-2 w-80 bg-background-50 rounded-xl border border-background-200/70 shadow-lg z-50 overflow-hidden">
                    <div className="p-4 border-b border-background-200/70 flex items-center justify-between">
                      <h3 className="font-heading font-semibold text-sm text-foreground-900">Notifications</h3>
                      {unreadCount > 0 && (
                        <button
                          onClick={async () => {
                            await supabase.from("notifications").update({ is_read: true }).eq("user_id", profile?.id).eq("is_read", false);
                            fetchNotifications();
                          }}
                          className="text-xs text-primary-500 hover:text-primary-600 font-medium cursor-pointer whitespace-nowrap"
                        >
                          Mark all read
                        </button>
                      )}
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <div className="text-center py-6">
                          <i className="ri-notification-off-line text-foreground-400 text-2xl mb-2 block" />
                          <p className="text-xs text-foreground-500">No notifications yet</p>
                        </div>
                      ) : (
                        notifications.map((n) => (
                          <button
                            key={n.id}
                            onClick={async () => {
                              if (!n.is_read) {
                                await supabase.from("notifications").update({ is_read: true }).eq("id", n.id);
                                fetchNotifications();
                              }
                            }}
                            className={`w-full text-left px-4 py-3 border-b border-background-100 last:border-0 hover:bg-background-100/50 transition-colors cursor-pointer ${!n.is_read ? "bg-primary-50/50" : ""}`}
                          >
                            <div className="flex items-start gap-2">
                              <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${!n.is_read ? "bg-primary-500" : "bg-transparent"}`} />
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-foreground-900 truncate">{n.title}</p>
                                <p className="text-[11px] text-foreground-600 mt-0.5 line-clamp-2">{n.message}</p>
                                <p className="text-[10px] text-foreground-400 mt-1">{new Date(n.created_at).toLocaleDateString("en-UG", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
                              </div>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Help */}
            <Link
              to="/docs"
              className="hidden md:flex w-9 h-9 items-center justify-center rounded-lg hover:bg-background-200/70 text-foreground-600 transition-colors"
            >
              <i className="ri-question-line text-lg" />
            </Link>
          </div>
        </header>

        {/* Verification Banner — gentle reminder for unverified merchants */}
        {showBanner && (
          <div className="bg-accent-100 border-b border-accent-200/70 px-4 md:px-6 py-3 flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-accent-200 flex items-center justify-center shrink-0 mt-0.5">
              <i className="ri-time-line text-accent-700 text-sm" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground-900">
                Your account is pending verification
              </p>
              <p className="text-xs text-foreground-600 mt-0.5">
                You have full access to all features. Complete KYC to unlock additional benefits and remove this reminder.
              </p>
            </div>
            <button
              onClick={() => navigate("/dashboard/kyc")}
              className="shrink-0 text-sm font-medium text-primary-500 hover:text-primary-600 cursor-pointer whitespace-nowrap"
            >
              Complete KYC
            </button>
            <button
              onClick={dismissBanner}
              className="shrink-0 w-7 h-7 flex items-center justify-center rounded-md text-foreground-400 hover:text-foreground-700 hover:bg-accent-200/50 cursor-pointer transition-colors"
              aria-label="Dismiss"
            >
              <i className="ri-close-line" />
            </button>
          </div>
        )}

        {/* Page Content */}
        <main className="flex-1 p-4 md:p-6 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}