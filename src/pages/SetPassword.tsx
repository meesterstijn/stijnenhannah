import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";

const MIN_LENGTH = 8;

// Na een uitnodigings- of herstellink is de gebruiker wel ingelogd, maar
// heeft (nog) geen bekend wachtwoord. Zonder deze stap kan het account na
// uitloggen of op een ander apparaat niet meer inloggen.
export default function SetPassword() {
  const { session, finishPasswordSetup } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < MIN_LENGTH) {
      setError(`Kies minstens ${MIN_LENGTH} tekens.`);
      return;
    }
    if (password !== confirm) {
      setError("De twee wachtwoorden zijn niet hetzelfde.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      setError(
        error.code === "same_password"
          ? "Dit is je huidige wachtwoord, kies een ander."
          : error.code === "weak_password"
            ? "Dit wachtwoord is te zwak, kies een sterker."
            : "Opslaan lukte niet. Probeer het opnieuw.",
      );
      return;
    }
    finishPasswordSetup();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <span className="text-4xl">🌿</span>
          <h1 className="font-serif text-3xl font-semibold mt-4">
            Kies een wachtwoord
          </h1>
          <p className="text-muted-foreground text-sm mt-2">
            Hiermee log je voortaan in
            {session?.user.email ? ` als ${session.user.email}` : ""}.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Verborgen gebruikersnaam zodat wachtwoordmanagers het bij het
              juiste account opslaan. */}
          <input
            type="email"
            value={session?.user.email ?? ""}
            autoComplete="username"
            readOnly
            hidden
          />
          <div className="space-y-2">
            <label className="text-sm font-medium">Nieuw wachtwoord</label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={MIN_LENGTH}
              autoComplete="new-password"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Nog een keer</label>
            <Input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="••••••••"
              required
              minLength={MIN_LENGTH}
              autoComplete="new-password"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button
            type="submit"
            className="w-full rounded-xl"
            disabled={loading}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Opslaan"}
          </Button>
          <button
            type="button"
            className="w-full text-sm text-muted-foreground underline-offset-4 hover:underline"
            onClick={() => supabase.auth.signOut()}
          >
            Uitloggen
          </button>
        </form>
      </div>
    </div>
  );
}
