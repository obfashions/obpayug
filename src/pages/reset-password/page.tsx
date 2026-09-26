import { useEffect, useState, type FormEvent } from "react";
import { Link } from "@/lib/router-compat";
import { supabase } from "@/lib/supabase";
import { friendlyError } from "@/lib/friendly-error";
import { Button } from "@/components/ui/button";
import Navbar from "@/components/feature/Navbar";
import Footer from "@/components/feature/Footer";

export default function ResetPassword() {
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(true);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let mounted = true;
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const query = new URLSearchParams(window.location.search);
    const recovery = hash.get("type") === "recovery" || query.get("type") === "recovery" || Boolean(query.get("token_hash")) || Boolean(query.get("code"));
    const accessToken = hash.get("access_token");
    const refreshToken = hash.get("refresh_token");

    const prepare = async () => {
      if (!recovery) {
        if (mounted) { setError("This password reset link is invalid. Request a new one."); setChecking(false); }
        return;
      }
      const linkError = hash.get("error_description") || query.get("error_description");
      if (linkError) {
        if (mounted) { setError("This password reset link has expired. Request a new one."); setChecking(false); }
        return;
      }
      try {
        let sessionReady = false;
        if (accessToken && refreshToken) {
          const { data, error: sessionError } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
          if (sessionError) throw sessionError;
          sessionReady = Boolean(data.session);
          window.history.replaceState(null, "", window.location.pathname);
        } else if (query.get("token_hash")) {
          const { data, error: verifyError } = await supabase.auth.verifyOtp({ token_hash: query.get("token_hash") || "", type: "recovery" });
          if (verifyError) throw verifyError;
          sessionReady = Boolean(data.session);
          window.history.replaceState(null, "", window.location.pathname);
        } else if (query.get("code")) {
          const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(query.get("code") || "");
          if (exchangeError) throw exchangeError;
          sessionReady = Boolean(data.session);
          window.history.replaceState(null, "", window.location.pathname);
        } else {
          // PKCE recovery links exchange the code automatically when opened.
          const { data } = await supabase.auth.getSession();
          sessionReady = Boolean(data.session);
        }
        if (mounted) {
          setReady(sessionReady);
          if (!sessionReady) setError("This password reset link has expired. Request a new one.");
        }
      } catch {
        if (mounted) setError("This password reset link has expired. Request a new one.");
      } finally {
        if (mounted) setChecking(false);
      }
    };
    void prepare();
    return () => { mounted = false; };
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    if (password.length < 8) { setError("Use at least 8 characters for your new password."); return; }
    if (password !== confirm) { setError("The passwords do not match."); return; }
    if (!ready) return;
    setSaving(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setSaved(true);
      await supabase.auth.signOut({ scope: "local" });
    } catch (cause) {
      setError(friendlyError(cause instanceof Error ? cause.message : String(cause), "We couldn't update your password. Request a new link and try again."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background-50">
      <Navbar />
      <main className="pt-20 md:pt-24 pb-16 px-4">
        <div className="max-w-md mx-auto border border-background-200/70 rounded-lg p-6 md:p-8">
          <h1 className="font-heading font-bold text-2xl text-foreground-900 mb-2">Set a new password</h1>
          {checking ? <p className="text-foreground-600">Checking your link…</p> : saved ? (
            <div>
              <p className="text-foreground-700 mb-5">Your password has been updated. You can now log in.</p>
              <Link to="/login" className="text-primary-600 font-semibold">Log In</Link>
            </div>
          ) : ready ? (
            <form onSubmit={submit} className="space-y-4 mt-6">
              {error && <p role="alert" className="text-accent-800 bg-accent-100 p-3 rounded-lg">{error}</p>}
              <label className="block text-foreground-700 text-sm font-medium">New password
                <input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1.5 w-full rounded-lg border border-background-300/60 bg-background-50 px-4 py-2.5" required minLength={8} />
              </label>
              <label className="block text-foreground-700 text-sm font-medium">Confirm new password
                <input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="mt-1.5 w-full rounded-lg border border-background-300/60 bg-background-50 px-4 py-2.5" required minLength={8} />
              </label>
              <Button type="submit" disabled={saving} className="w-full">{saving ? "Saving…" : "Save new password"}</Button>
            </form>
          ) : (
            <div>
              <p role="alert" className="text-accent-800 my-5">{error}</p>
              <Link to="/forgot-password" className="text-primary-600 font-semibold">Request a new link</Link>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}