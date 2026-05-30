import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";

import { env } from "../config/env.js";

export function isPlaidConfigured() {
  return Boolean(env.PLAID_CLIENT_ID && env.PLAID_SECRET);
}

export function getPlaidClient() {
  if (!isPlaidConfigured()) {
    throw new Error("Plaid is not configured");
  }

  const environment = PlaidEnvironments[env.PLAID_ENV];

  return new PlaidApi(
    new Configuration({
      basePath: environment,
      baseOptions: {
        headers: {
          "PLAID-CLIENT-ID": env.PLAID_CLIENT_ID,
          "PLAID-SECRET": env.PLAID_SECRET,
        },
      },
    }),
  );
}
