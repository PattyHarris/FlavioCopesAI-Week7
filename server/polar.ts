import type { User } from "@supabase/supabase-js";

const POLAR_SANDBOX_BASE_URL = "https://sandbox-api.polar.sh";
const FREE_SEARCH_LIMIT = 3;

type PolarSubscription = {
  id: string;
  status: string;
  cancel_at_period_end: boolean;
  current_period_end: string | null;
  product_id: string;
};

type PolarCustomerState = {
  active_subscriptions?: PolarSubscription[];
};

export type SubscriptionStatus = {
  enabled: boolean;
  pro: boolean;
  productId: string | null;
  subscriptionId: string | null;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
  managementEnabled: boolean;
};

function getPolarConfig() {
  return {
    accessToken: process.env.POLAR_ACCESS_TOKEN || "",
    productId: process.env.POLAR_PRODUCT_ID || "",
    server: process.env.POLAR_SERVER === "production" ? "production" : "sandbox",
  };
}

function getPolarBaseUrl() {
  return getPolarConfig().server === "production"
    ? "https://api.polar.sh"
    : POLAR_SANDBOX_BASE_URL;
}

export function getFreeSearchLimit() {
  return FREE_SEARCH_LIMIT;
}

export function isPolarEnabled() {
  const config = getPolarConfig();
  return Boolean(config.accessToken && config.productId);
}

async function polarFetch<T>(pathname: string, init?: RequestInit) {
  const config = getPolarConfig();

  if (!config.accessToken) {
    throw new Error("Missing POLAR_ACCESS_TOKEN.");
  }

  const response = await fetch(`${getPolarBaseUrl()}${pathname}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(errorText || "Polar request failed.");
  }

  return (await response.json()) as T;
}

export async function getSubscriptionStatus(user: User): Promise<SubscriptionStatus> {
  if (!isPolarEnabled()) {
    return {
      enabled: false,
      pro: false,
      productId: null,
      subscriptionId: null,
      cancelAtPeriodEnd: false,
      currentPeriodEnd: null,
      managementEnabled: false,
    };
  }

  const config = getPolarConfig();

  try {
    const customerState = await polarFetch<PolarCustomerState>(
      `/v1/customers/external/${encodeURIComponent(user.id)}/state`,
    );

    const matchingSubscription =
      customerState.active_subscriptions?.find(
        (subscription) => subscription.product_id === config.productId,
      ) || null;

    return {
      enabled: true,
      pro: Boolean(matchingSubscription),
      productId: config.productId || null,
      subscriptionId: matchingSubscription?.id || null,
      cancelAtPeriodEnd: matchingSubscription?.cancel_at_period_end ?? false,
      currentPeriodEnd: matchingSubscription?.current_period_end ?? null,
      managementEnabled: Boolean(matchingSubscription?.id),
    };
  } catch {
    return {
      enabled: true,
      pro: false,
      productId: config.productId || null,
      subscriptionId: null,
      cancelAtPeriodEnd: false,
      currentPeriodEnd: null,
      managementEnabled: false,
    };
  }
}

export async function createCheckoutSession(user: User, origin: string) {
  const config = getPolarConfig();

  if (!config.productId) {
    throw new Error("Missing POLAR_PRODUCT_ID.");
  }

  const checkout = await polarFetch<{ url: string }>("/v1/checkouts", {
    method: "POST",
    body: JSON.stringify({
      products: [config.productId],
      success_url: `${origin}?checkout=success`,
      return_url: `${origin}?checkout=return`,
      external_customer_id: user.id,
      customer_email: user.email,
      customer_name: user.email || "Pantry Chef customer",
      metadata: {
        app: "pantry-chef",
        user_id: user.id,
      },
    }),
  });

  return checkout;
}

export async function cancelSubscriptionAtPeriodEnd(subscriptionId: string) {
  return polarFetch(`/v1/subscriptions/${subscriptionId}`, {
    method: "PATCH",
    body: JSON.stringify({
      cancel_at_period_end: true,
    }),
  });
}
