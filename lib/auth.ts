import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/lib/db/client";
import { sendEmail } from "@/lib/email";
import * as schema from "@/lib/db/schema";

/** How long a password reset link stays usable. */
const RESET_TOKEN_TTL_SECONDS = 60 * 60;

/**
 * Better Auth server instance.
 *
 * Email verification is intentionally disabled: this is a single-user app
 * with no email provider wired up. Sign-up can be closed after the owner's
 * account exists by setting emailAndPassword.disableSignUp to true.
 *
 * Password reset is the one flow that does send email — without it a
 * forgotten password locks the owner out of their own data permanently. See
 * lib/email.ts for what happens when no mail provider is configured.
 */
export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    minPasswordLength: 8,
    resetPasswordTokenExpiresIn: RESET_TOKEN_TTL_SECONDS,
    // A reset is also the recovery path after a compromise, so drop every
    // existing session and force a fresh sign-in with the new password.
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      try {
        await sendEmail({
          to: user.email,
          subject: "Reset your Storegasm password",
          text: [
            "Someone asked to reset the password for your Storegasm account.",
            "",
            "Open this link to choose a new one:",
            url,
            "",
            `The link expires in ${RESET_TOKEN_TTL_SECONDS / 60} minutes and can only be used once.`,
            "If you didn't request this, you can ignore this email — your password stays as it is.",
          ].join("\n"),
        });
      } catch (error) {
        // Swallow the failure: /request-password-reset answers with the same
        // neutral message whether or not the address exists, and letting this
        // throw would turn a delivery outage into an account-enumeration
        // oracle. The log is where the owner finds out delivery is broken.
        console.error("[auth] Failed to send the password reset email:", error);
      }
    },
  },
  session: {
    // Every server action checks the session before it touches data. Without
    // this, each check was a database query of its own, in series ahead of
    // the one the action exists to run. The cache keeps a signed copy of the
    // session in a cookie and only re-reads the database once it is older
    // than maxAge — so a session revoked elsewhere (a password reset signs
    // out every device) can keep working for up to that long.
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60,
    },
  },
  // Lets auth calls made inside server actions set cookies — here, the
  // refreshed session cache cookie once the old one expires. Without it the
  // refreshed value is dropped and every later check goes back to the
  // database. Must stay the last plugin.
  plugins: [nextCookies()],
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
});
