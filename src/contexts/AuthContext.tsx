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
  //
  // Effect-dependency is bewust `userId` (session.user.id), NIET de hele
  // `session`. Supabase geeft bij elke stille token-refresh (o.a. wanneer het
  // tabblad weer focus/zichtbaarheid krijgt, bv. na het sluiten van de native
  // camera-app voor een groeifoto) een NIEUW session-object terug voor
  // dezelfde ingelogde gebruiker. Op `session` zelf reageren zou dan bij elke
  // refresh opnieuw isLoadingRole=true zetten, waardoor RequireAppAccess de
  // hele pagina (incl. open dialogen zoals QuickGrowthPhotoDialog) tijdelijk
  // vervangt door de laadspinner — precies het scenario waarbij de
  // groeifoto-dialoog na het maken van een foto verdween. Bij hetzelfde
  // gebruikers-id is een refetch overbodig: de rol verandert niet door een
  // tokenrefresh.
  const userId = session?.user.id ?? null;
  useEffect(() => {
    if (!userId) {
      setProfile(null);
      setIsLoadingRole(false);
      return;
    }
    let cancelled = false;
    setIsLoadingRole(true);
    supabase
      .from("profiles")
      .select("id, display_name, app_role")
      .eq("id", userId)
      .single()
      .then(({ data, error }) => {
        if (cancelled) return;
        setProfile(error ? null : (data as Profile));
        setIsLoadingRole(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

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
