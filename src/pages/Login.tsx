import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError("E-mail of wachtwoord klopt niet.");
    setLoading(false);
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

          <Button type="submit" className="w-full rounded-xl" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Inloggen"}
          </Button>
        </form>
      </div>
    </div>
  );
}
