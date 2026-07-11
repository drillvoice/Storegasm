import { createAuthClient } from "better-auth/react";

/**
 * Better Auth browser client. baseURL defaults to the current origin, so no
 * configuration is needed — the auth API lives at /api/auth on this app.
 */
export const authClient = createAuthClient();
