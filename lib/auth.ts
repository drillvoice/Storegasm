import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
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
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
});
