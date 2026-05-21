const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID as string;
const REDIRECT_URI = import.meta.env.VITE_SPOTIFY_REDIRECT_URI as string;
const SCOPES = [
  "user-read-currently-playing",
  "user-read-playback-state",
  "user-modify-playback-state",
].join(" ");

function base64urlEncode(buffer: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64urlEncode(array.buffer);
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return base64urlEncode(digest);
}

export async function initiateSpotifyLogin() {
  const verifier = generateCodeVerifier();
  const challenge = await generateCodeChallenge(verifier);
  localStorage.setItem("spotify_code_verifier", verifier);

  const params = new URLSearchParams({
    response_type: "code",
    client_id: CLIENT_ID,
    scope: SCOPES,
    redirect_uri: REDIRECT_URI,
    code_challenge_method: "S256",
    code_challenge: challenge,
    state: "spotify_auth",
  });

  window.location.href = `https://accounts.spotify.com/authorize?${params}`;
}

export async function handleSpotifyCallback(code: string): Promise<boolean> {
  const verifier = localStorage.getItem("spotify_code_verifier");
  if (!verifier) return false;

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: REDIRECT_URI,
      client_id: CLIENT_ID,
      code_verifier: verifier,
    }),
  });

  if (!res.ok) return false;
  const data = await res.json();
  storeTokens(data);
  localStorage.removeItem("spotify_code_verifier");
  return true;
}

function storeTokens(data: { access_token: string; refresh_token?: string; expires_in: number }) {
  localStorage.setItem("spotify_access_token", data.access_token);
  if (data.refresh_token) localStorage.setItem("spotify_refresh_token", data.refresh_token);
  localStorage.setItem("spotify_expires_at", String(Date.now() + data.expires_in * 1000));
}

export async function getAccessToken(): Promise<string | null> {
  const token = localStorage.getItem("spotify_access_token");
  if (!token) return null;
  const expiresAt = Number(localStorage.getItem("spotify_expires_at") ?? 0);
  if (Date.now() > expiresAt - 60_000) return refreshAccessToken();
  return token;
}

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = localStorage.getItem("spotify_refresh_token");
  if (!refreshToken) return null;

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: CLIENT_ID,
    }),
  });

  if (!res.ok) { clearSpotifyTokens(); return null; }
  const data = await res.json();
  storeTokens(data);
  return data.access_token;
}

export function clearSpotifyTokens() {
  localStorage.removeItem("spotify_access_token");
  localStorage.removeItem("spotify_refresh_token");
  localStorage.removeItem("spotify_expires_at");
}

export function isSpotifyConnected(): boolean {
  return !!localStorage.getItem("spotify_access_token");
}

export type NowPlaying = {
  isPlaying: boolean;
  trackName: string;
  artistName: string;
  albumArt: string | null;
} | null;

export async function getNowPlaying(): Promise<NowPlaying> {
  const token = await getAccessToken();
  if (!token) return null;

  const res = await fetch("https://api.spotify.com/v1/me/player/currently-playing", {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 204 || !res.ok) return null;
  const data = await res.json();
  if (!data.item) return null;

  return {
    isPlaying: data.is_playing,
    trackName: data.item.name,
    artistName: data.item.artists.map((a: { name: string }) => a.name).join(", "),
    albumArt: data.item.album.images.at(-1)?.url ?? null,
  };
}

export async function togglePlayback(isPlaying: boolean): Promise<void> {
  const token = await getAccessToken();
  if (!token) return;
  await fetch(`https://api.spotify.com/v1/me/player/${isPlaying ? "pause" : "play"}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function skipTrack(direction: "next" | "previous"): Promise<void> {
  const token = await getAccessToken();
  if (!token) return;
  await fetch(`https://api.spotify.com/v1/me/player/${direction}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
}
