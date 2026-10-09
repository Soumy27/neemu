// Sign-in with Amazon Cognito's hosted page (authorization code with PKCE). No library.
// Off unless VITE_COGNITO_DOMAIN and VITE_COGNITO_CLIENT_ID are set; the deploy script sets them.

const DOMAIN = import.meta.env.VITE_COGNITO_DOMAIN as string | undefined;
const CLIENT = import.meta.env.VITE_COGNITO_CLIENT_ID as string | undefined;
export const signInAvailable = !!DOMAIN && !!CLIENT;

const SESSION = "neemu.session";
const PENDING = "neemu.signin";
const SCOPE = "openid email aws.cognito.signin.user.admin";
const redirectUri = () => `${location.origin}/`;

interface Session {
  access: string;
  refresh?: string;
  expiresAt: number; // ms
}

function load(): Session | null {
  try {
    return JSON.parse(localStorage.getItem(SESSION) ?? "null");
  } catch {
    return null;
  }
}

function save(tokens: { access_token: string; refresh_token?: string; expires_in: number }, keepRefresh?: string) {
  const s: Session = {
    access: tokens.access_token,
    refresh: tokens.refresh_token ?? keepRefresh,
    expiresAt: Date.now() + tokens.expires_in * 1000,
  };
  localStorage.setItem(SESSION, JSON.stringify(s));
  return s;
}

const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

async function token(params: Record<string, string>) {
  const res = await fetch(`https://${DOMAIN}/oauth2/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: CLIENT!, ...params }),
  });
  if (!res.ok) throw new Error(`Cognito sign-in failed (HTTP ${res.status})`);
  return res.json();
}

export const signedIn = () => !!load();

// Send the person to Cognito. They come back to the page they left.
export async function signIn(): Promise<void> {
  if (!signInAvailable) return;
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(48)));
  const challenge = b64url(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))));
  sessionStorage.setItem(PENDING, JSON.stringify({ verifier, returnTo: location.pathname + location.search }));
  location.assign(
    `https://${DOMAIN}/oauth2/authorize?` +
      new URLSearchParams({
        response_type: "code",
        client_id: CLIENT!,
        redirect_uri: redirectUri(),
        scope: SCOPE,
        code_challenge: challenge,
        code_challenge_method: "S256",
      }),
  );
}

// Call once before the app renders: if Cognito just sent the person back with a code,
// swap it for tokens and put the address bar back to where they were.
export async function finishSignIn(): Promise<void> {
  const code = new URLSearchParams(location.search).get("code");
  const pending = sessionStorage.getItem(PENDING);
  if (!signInAvailable || !code || !pending) return;
  const { verifier, returnTo } = JSON.parse(pending) as { verifier: string; returnTo: string };
  sessionStorage.removeItem(PENDING);
  try {
    save(await token({ grant_type: "authorization_code", code, redirect_uri: redirectUri(), code_verifier: verifier }));
  } finally {
    history.replaceState(null, "", returnTo || "/");
  }
}

// The header to send with an API call: empty when signed out.
export async function authHeaders(): Promise<Record<string, string>> {
  let s = load();
  if (!s) return {};
  if (s.expiresAt - Date.now() < 60_000) {
    if (!s.refresh) {
      signOut();
      return {};
    }
    try {
      s = save(await token({ grant_type: "refresh_token", refresh_token: s.refresh }), s.refresh);
    } catch {
      signOut();
      return {};
    }
  }
  return { authorization: `Bearer ${s.access}` };
}

export function signOut() {
  localStorage.removeItem(SESSION);
}
