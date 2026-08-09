import "server-only";

/**
 * Minimal transactional email sender.
 *
 * Storegasm sends exactly one kind of email — the password reset link — so
 * rather than pulling in a provider SDK this posts straight to Resend's HTTP
 * API. Set `RESEND_API_KEY` (and optionally `EMAIL_FROM`) to enable delivery.
 *
 * When `RESEND_API_KEY` is unset — local development, or a self-hosted
 * instance with no mail provider wired up — the message is written to the
 * server log instead of being silently dropped, so the reset link is still
 * recoverable by whoever can read the logs.
 */

const RESEND_ENDPOINT = "https://api.resend.com/emails";

/** Fallback sender. Resend's shared onboarding domain only delivers to the
 * address that owns the API key, which is exactly right for a single-user app
 * that hasn't verified a domain. */
const DEFAULT_FROM = "Storegasm <onboarding@resend.dev>";

export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
};

/**
 * Sends a plain-text email. Throws if the provider rejects the message so the
 * caller can decide whether the failure is worth surfacing to the user.
 */
export async function sendEmail({
  to,
  subject,
  text,
}: EmailMessage): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.warn(
      [
        "[email] RESEND_API_KEY is not set — logging the message instead of sending it.",
        `  to:      ${to}`,
        `  subject: ${subject}`,
        "",
        text,
        "",
      ].join("\n")
    );
    return;
  }

  const response = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM ?? DEFAULT_FROM,
      to,
      subject,
      text,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Resend rejected the message (HTTP ${response.status}): ${detail}`
    );
  }
}
