import type { NextFunction, Request, Response } from "express";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

const ACCESS_TOKEN_COOKIE = "pantry-chef-access-token";
const REFRESH_TOKEN_COOKIE = "pantry-chef-refresh-token";

type AuthTokens = {
  accessToken: string;
  refreshToken?: string;
};

export type AuthenticatedRequest = Request & {
  currentUser: User | null;
  authTokens: AuthTokens | null;
};

let adminClient: SupabaseClient | null = null;

function getSupabaseEnv() {
  const url = process.env.SUPABASE_URL;
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  return {
    url,
    publishableKey,
    secretKey,
    authEnabled: Boolean(url && publishableKey && secretKey),
  };
}

export function isSupabaseAuthEnabled() {
  return getSupabaseEnv().authEnabled;
}

function requireSupabaseEnv() {
  const env = getSupabaseEnv();

  if (!env.url || !env.publishableKey || !env.secretKey) {
    throw new Error(
      "Missing SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, or SUPABASE_SECRET_KEY.",
    );
  }

  return {
    url: env.url,
    publishableKey: env.publishableKey,
    secretKey: env.secretKey,
  };
}

export function getSupabaseAdminClient() {
  if (!adminClient) {
    const env = requireSupabaseEnv();
    const { url, secretKey } = env;
    adminClient = createClient(url, secretKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  return adminClient;
}

export function createUserSupabaseClient(accessToken: string) {
  const env = requireSupabaseEnv();
  const { url, publishableKey } = env;

  return createClient(url, publishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
}

function parseCookies(cookieHeader?: string) {
  const entries = (cookieHeader || "")
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean);

  const cookies: Record<string, string> = {};
  for (const entry of entries) {
    const separatorIndex = entry.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = entry.slice(0, separatorIndex);
    const value = entry.slice(separatorIndex + 1);
    cookies[key] = decodeURIComponent(value);
  }

  return cookies;
}

function serializeCookie(name: string, value: string, maxAge?: number) {
  const isSecure = Boolean(process.env.RENDER || process.env.PORT);
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
  ];

  if (isSecure) {
    parts.push("Secure");
  }

  if (typeof maxAge === "number") {
    parts.push(`Max-Age=${maxAge}`);
  }

  return parts.join("; ");
}

export function getAuthTokensFromRequest(request: Request): AuthTokens | null {
  const cookies = parseCookies(request.headers.cookie);
  const accessToken = cookies[ACCESS_TOKEN_COOKIE];
  const refreshToken = cookies[REFRESH_TOKEN_COOKIE];

  if (!accessToken) {
    return null;
  }

  return {
    accessToken,
    refreshToken,
  };
}

export function setAuthCookies(response: Response, tokens: AuthTokens) {
  response.setHeader("Set-Cookie", [
    serializeCookie(ACCESS_TOKEN_COOKIE, tokens.accessToken, 60 * 60 * 24 * 7),
    serializeCookie(
      REFRESH_TOKEN_COOKIE,
      tokens.refreshToken || "",
      60 * 60 * 24 * 30,
    ),
  ]);
}

export function clearAuthCookies(response: Response) {
  response.setHeader("Set-Cookie", [
    serializeCookie(ACCESS_TOKEN_COOKIE, "", 0),
    serializeCookie(REFRESH_TOKEN_COOKIE, "", 0),
  ]);
}

export async function resolveUserFromTokens(tokens: AuthTokens | null) {
  if (!tokens?.accessToken || !isSupabaseAuthEnabled()) {
    return null;
  }

  const result = await getSupabaseAdminClient().auth.getUser(tokens.accessToken);
  return result.data.user ?? null;
}

export async function attachCurrentUser(
  request: AuthenticatedRequest,
  _response: Response,
  next: NextFunction,
) {
  try {
    request.authTokens = getAuthTokensFromRequest(request);
    request.currentUser = await resolveUserFromTokens(request.authTokens);
  } catch {
    request.authTokens = null;
    request.currentUser = null;
  }

  next();
}

export function requireAuthenticatedUser(request: AuthenticatedRequest, response: Response) {
  if (!request.currentUser || !request.authTokens?.accessToken) {
    response.status(401).json({
      error: "Please sign in to continue.",
      code: "auth_required",
    });
    return null;
  }

  return {
    user: request.currentUser,
    accessToken: request.authTokens.accessToken,
  };
}
