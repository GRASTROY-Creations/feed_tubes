import { LocalizedError } from "./errors.js";
/**
 * "Sign in with Twitch" using the OAuth implicit grant, which needs only a public Client ID
 * (no client secret, so nothing secret ships with the add-on):
 * https://dev.twitch.tv/docs/authentication/getting-tokens-oauth/#implicit-grant-flow
 *
 * Firefox's `browser.identity.launchWebAuthFlow` opens Twitch's login page and hands back the
 * redirect URL, whose fragment carries the token. No scopes are requested: reading public
 * channels, videos, and streams needs none.
 */
import { asRecord, asString } from "./guards.js";

const AUTH_BASE = "https://id.twitch.tv/oauth2";

/** Hosts the sign-in flow and the Helix API talk to. */
export const TWITCH_AUTH_ORIGINS = ["https://id.twitch.tv/*", "https://api.twitch.tv/*"];

export interface TwitchSession {
  token: string;
  login: string;
}

export function twitchAuthorizeUrl(clientId: string, redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    response_type: "token",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: "",
    state,
    force_verify: "true",
  });
  return `${AUTH_BASE}/authorize?${params.toString()}`;
}

/** Extracts the token from Twitch's redirect, checking `state` against CSRF. */
export function parseTwitchRedirect(redirectUrl: string, expectedState: string): string {
  const url = new URL(redirectUrl);
  const params = new URLSearchParams(url.hash.slice(1) || url.search.slice(1));

  const error = params.get("error_description") ?? params.get("error");
  if (error) {
    throw new LocalizedError("twitch-auth-failed", {
      reason: { id: "error-raw", args: { detail: error.replaceAll("+", " ") } },
    });
  }
  if (params.get("state") !== expectedState) {
    throw new LocalizedError("twitch-auth-failed", {
      reason: { id: "twitch-auth-state-mismatch" },
    });
  }

  const token = params.get("access_token");
  if (!token) {
    throw new LocalizedError("twitch-auth-failed", { reason: { id: "twitch-auth-no-token" } });
  }
  return token;
}

/** Confirms a token with Twitch and returns the login it belongs to. */
export async function validateTwitchToken(token: string): Promise<string> {
  const response = await fetch(`${AUTH_BASE}/validate`, {
    headers: { Authorization: `OAuth ${token}` },
    credentials: "omit",
    cache: "no-store",
  });
  if (!response.ok) {
    throw new LocalizedError("twitch-auth-rejected");
  }
  return asString(asRecord(await response.json()).login);
}

/** Revokes a token at Twitch; failures are ignored because the token is dropped anyway. */
export async function revokeTwitchToken(clientId: string, token: string): Promise<void> {
  try {
    await fetch(`${AUTH_BASE}/revoke`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: clientId, token }).toString(),
      credentials: "omit",
    });
  } catch {
    // Offline or already revoked: forgetting the token locally is what matters.
  }
}

/** Runs the whole sign-in: Twitch's login page, then token validation. */
export async function signInWithTwitch(clientId: string): Promise<TwitchSession> {
  const state = crypto.randomUUID();
  const redirectUrl = await browser.identity.launchWebAuthFlow({
    url: twitchAuthorizeUrl(clientId, browser.identity.getRedirectURL(), state),
    interactive: true,
  });

  const token = parseTwitchRedirect(redirectUrl, state);
  return { token, login: await validateTwitchToken(token) };
}
