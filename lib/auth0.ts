import { Auth0Client } from "@auth0/nextjs-auth0/server";

// Initialize the Auth0 client.
// Options are automatically loaded from environment variables:
// - AUTH0_DOMAIN
// - AUTH0_CLIENT_ID
// - AUTH0_CLIENT_SECRET
// - APP_BASE_URL
// - AUTH0_SECRET
// Provide API-specific parameters explicitly.
export const auth0 = new Auth0Client({
  authorizationParameters: {
    ...(process.env.AUTH0_SCOPE ? { scope: process.env.AUTH0_SCOPE } : {}),
    ...(process.env.AUTH0_AUDIENCE &&
    process.env.AUTH0_AUDIENCE !== "your_auth_api_identifier"
      ? { audience: process.env.AUTH0_AUDIENCE }
      : {}),
  },
});
