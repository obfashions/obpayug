import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
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
      const { data, error } = await supabase
        .from("merchant_wallets")
        .select("available_balance, pending_balance, balances_by_currency, total_collections, total_payouts")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;

      const rawBalances: BalancesByCurrency = (data?.balances_by_currency as BalancesByCurrency) || {};
      // Merge the legacy single-currency fields into balances_by_currency for the active currency
      const legacyCurrency = profile?.default_currency || DEFAULT_CURRENCY;
      const merged: BalancesByCurrency = { ...rawBalances };
      if (data?.available_balance != null) {
        merged[legacyCurrency] = Math.max(merged[legacyCurrency] || 0, Number(data.available_balance));
      }

      setBalances(merged);

      // Determine available currencies: any currency with a non-zero balance, plus the active currency, plus legacy
      const currencies = new Set<string>([
        legacyCurrency,
        activeCurrency,
        ...Object.keys(merged).filter((c) => (merged[c] || 0) > 0),
      ]);
      setAvailableCurrencies(Array.from(currencies).filter((c) => SUPPORTED_CURRENCIES.some((sc) => sc.code === c)));
    } catch (err) {
      console.error("[CurrencyContext] Failed to refresh balances:", err);
    } finally {
      setLoading(false);
    }
  }, [user, profile, activeCurrency]);

  useEffect(() => {
    refreshBalances();
  }, [refreshBalances]);

  // Realtime wallet updates
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("currency-wallet-realtime")
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