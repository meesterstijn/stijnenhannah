import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { clearAuthLinkHash, getInitialAuthLink } from "@/lib/auth-link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";

// Geopend via een maillink die niet (meer) werkt: meestal verlopen of al
// een keer gebruikt (een mailscanner of eerdere klik telt ook).
function initialLinkError(): string | null {
  return getInitialAuthLink().error
    ? "Deze link is verlopen of al gebruikt. Vul je e-mailadres in en kies 'Wachtwoord vergeten?' voor een nieuwe."
    : null;
}

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(initialLinkError);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);

  useEffect(clearAuthLinkHash, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError("E-mail of wachtwoord klopt niet.");
    setLoading(false);
  }

  async function handleForgotPassword() {
    setError(null);
    setNotice(null);
    if (!email.trim()) {
      setError("Vul eerst je e-mailadres in.");
      return;
    }
    setSendingReset(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/`,
    });
    setSendingReset(false);
    if (error) {
      setError(
        error.status === 429
          ? "Er zijn net te veel mails verstuurd. Probeer het over een uur opnieuw."
          : "Versturen lukte niet. Probeer het later opnieuw.",
      );
      return;
    }
    setNotice(
      "Als dit adres een account heeft, staat er nu een mail met een link om een nieuw wachtwoord te kiezen.",
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <span className="text-4xl">🌿</span>
          <h1 className="font-serif text-3xl font-semibold mt-4">Ons Huisje</h1>
          <p className="text-muted-foreground text-sm mt-2">Log in om verder te gaan</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">E-mailadres</label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jij@voorbeeld.nl"
              required
              autoComplete="email"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Wachtwoord</label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
          {notice && <p className="text-sm text-muted-foreground">{notice}</p>}

          <Button type="submit" className="w-full rounded-xl" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Inloggen"}
          </Button>
          <button
            type="button"
            className="w-full text-sm text-muted-foreground underline-offset-4 hover:underline disabled:opacity-50"
            onClick={handleForgotPassword}
            disabled={sendingReset}
          >
            {sendingReset ? "Bezig met versturen…" : "Wachtwoord vergeten?"}
          </button>
        </form>
      </div>
    </div>
  );
}
