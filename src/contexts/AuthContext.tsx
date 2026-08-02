import { createContext, useContext, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

export type AppRole = "owner" | "r6_player";

export type Profile = {
  id: string;
  display_name: string | null;
  app_role: AppRole;
};

type AuthContextType = {
  session: Session | null;
  loading: boolean;
  profile: Profile | null;
  appRole: AppRole | null;
  isOwner: boolean;
  isR6Player: boolean;
  isLoadingRole: boolean;
};

const AuthContext = createContext<AuthContextType>({
  session: null,
  loading: true,
  profile: null,
  appRole: null,
  isOwner: false,
  isR6Player: false,
  isLoadingRole: true,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoadingRole, setIsLoadingRole] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // De rol komt UITSLUITEND uit public.profiles (database-brede bron van
  // waarheid, zie de rollenmigraties) — nooit uit session.user.user_metadata,
  // dat is client-side aanpasbaar en dus geen veilige autorisatiebron.
  //
  // Fail closed: bij het ontbreken van een sessie, een netwerkfout, of een
  // (in theorie onmogelijke, want de databasetrigger maakt 'm altijd aan)
  // ontbrekende profielrij blijft `profile` gewoon `null` — nooit een
  // impliciete owner-fallback. RequireAppAccess (App.tsx) behandelt
  // `profile === null` na het laden als "geen toegang", nooit als "owner".
  useEffect(() => {
    if (!session) {
      setProfile(null);
      setIsLoadingRole(false);
      return;
    }
    let cancelled = false;
    setIsLoadingRole(true);
    supabase
      .from("profiles")
      .select("id, display_name, app_role")
      .eq("id", session.user.id)
      .single()
      .then(({ data, error }) => {
        if (cancelled) return;
        setProfile(error ? null : (data as Profile));
        setIsLoadingRole(false);
      });
    return () => {
      cancelled = true;
    };
  }, [session]);

  const appRole = profile?.app_role ?? null;

  return (
    <AuthContext.Provider
      value={{
        session,
        loading,
        profile,
        appRole,
        isOwner: appRole === "owner",
        isR6Player: appRole === "r6_player",
        isLoadingRole: loading || isLoadingRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
