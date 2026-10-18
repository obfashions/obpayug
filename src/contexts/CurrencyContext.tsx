import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { platform } from "@/lib/platform";
import { combinedBalances } from "@/lib/balance-values";
import { getEnabledCurrencies } from "@/lib/currencies.functions";
import {
  getCurrencyInfo,
  getCurrencyByCountry,
  getCurrencyFromPhone,
  DEFAULT_CURRENCY,
  SUPPORTED_CURRENCIES,
  type BalancesByCurrency,
} from "@/lib/currency";

export interface CurrencyState {
  activeCurrency: string;
  setActiveCurrency: (code: string) => void;
  balances: BalancesByCurrency;
  availableCurrencies: string[];
  activeBalance: number;
  activePending: number;
  currencyInfo: ReturnType<typeof getCurrencyInfo>;
  loading: boolean;
  refreshBalances: () => Promise<void>;
  /** Currencies switched on for the whole platform. */
  platformCurrencies: string[];
  /** Wallets this account has turned on. */
  walletCurrencies: string[];
}

const CurrencyContext = createContext<CurrencyState | undefined>(undefined);

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const { user, profile } = useAuth();
  const [activeCurrency, setActiveCurrency] = useState<string>(() => {
    try {
      const stored = localStorage.getItem("obpay_active_currency");
      if (stored) return stored;
    } catch { /* noop */ }
    return DEFAULT_CURRENCY;
  });
  const [balances, setBalances] = useState<BalancesByCurrency>({});
  const [availableCurrencies, setAvailableCurrencies] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [platformCurrencies, setPlatformCurrencies] = useState<string[]>(["UGX"]);

  useEffect(() => {
    getEnabledCurrencies().then((r) => setPlatformCurrencies(r.currencies)).catch(() => {});
  }, []);

  const defaultCurr = profile?.default_currency || DEFAULT_CURRENCY;
  const chosen = ((profile as any)?.enabled_currencies as string[] | null) || [defaultCurr];
  const walletCurrencies = Array.from(new Set([defaultCurr, ...chosen])).filter(
    (c) => platformCurrencies.includes(c) || c === defaultCurr,
  );

  // Keep the active currency on one of the account's wallets.
  useEffect(() => {
    if (profile && !walletCurrencies.includes(activeCurrency)) setActiveCurrency(defaultCurr);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, walletCurrencies.join(","), activeCurrency]);

  // Derive default currency from profile on mount
  useEffect(() => {
    if (!profile) return;
    let defaultCurr = DEFAULT_CURRENCY;
    if (profile.default_currency) {
      defaultCurr = profile.default_currency;
    } else if (profile.phone_number) {
      defaultCurr = getCurrencyFromPhone(profile.phone_number);
    }
    // Only override if user hasn't manually selected a stored currency
    try {
      const stored = localStorage.getItem("obpay_active_currency");
      if (!stored && defaultCurr) {
        setActiveCurrency(defaultCurr);
      }
    } catch { /* noop */ }
  }, [profile]);

  // Persist active currency
  useEffect(() => {
    try {
      localStorage.setItem("obpay_active_currency", activeCurrency);
    } catch { /* noop */ }
  }, [activeCurrency]);

  const refreshBalances = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [{ data, error }, managed] = await Promise.all([
        supabase
          .from("merchant_wallets")
          .select("available_balance, pending_balance, balances_by_currency, total_collections, total_payouts")
          .eq("user_id", user.id)
          .maybeSingle(),
        platform<Array<{ currency: string; available_balance: number }>>("balances.get"),
      ]);

      if (error) throw error;

      if (!managed.success) throw new Error(managed.error || "Balance could not be refreshed.");
      const merged = combinedBalances(data, managed.data || [], profile?.default_currency || DEFAULT_CURRENCY);

      setBalances(merged);

      // Determine available currencies: any currency with a non-zero balance, plus the active currency, plus legacy
      // Account's wallets, plus any currency that still holds money (never hide funds).
      const currencies = new Set<string>([
        ...walletCurrencies,
        ...Object.keys(merged).filter((c) => (merged[c] || 0) > 0),
      ]);
      setAvailableCurrencies(Array.from(currencies).filter((c) => SUPPORTED_CURRENCIES.some((sc) => sc.code === c)));
    } catch (err) {
      console.error("[CurrencyContext] Failed to refresh balances:", err);
    } finally {
      setLoading(false);
    }
  }, [user, profile, walletCurrencies.join(",")]);

  useEffect(() => {
    refreshBalances();
  }, [refreshBalances]);

  useEffect(() => {
    if (!user) return;
    const interval = window.setInterval(() => {
      void refreshBalances();
    }, 5000);
    return () => window.clearInterval(interval);
  }, [user, refreshBalances]);

  // Realtime wallet updates
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("currency-wallet-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "merchant_balances", filter: `merchant_id=eq.${user.id}` },
        () => { void refreshBalances(); }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "merchant_wallets", filter: `user_id=eq.${user.id}` },
        () => {
          refreshBalances();
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, refreshBalances]);

  const activeBalance = balances[activeCurrency] || 0;
  const activePending = 0; // pending per-currency not stored yet; use 0 as fallback

  return (
    <CurrencyContext.Provider
      value={{
        activeCurrency,
        setActiveCurrency,
        balances,
        availableCurrencies,
        activeBalance,
        activePending,
        currencyInfo: getCurrencyInfo(activeCurrency),
        loading,
        refreshBalances,
        platformCurrencies,
        walletCurrencies,
      }}
    >
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const ctx = useContext(CurrencyContext);
  if (ctx === undefined) {
    throw new Error("useCurrency must be used within a CurrencyProvider");
  }
  return ctx;
}