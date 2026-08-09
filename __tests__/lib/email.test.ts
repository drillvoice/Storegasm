import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("server-only", () => ({}));

import { sendEmail } from "@/lib/email";

const message = {
  to: "owner@example.com",
  subject: "Reset your Storegasm password",
  text: "https://storegasm.example/api/auth/reset-password/tok",
};

describe("sendEmail", () => {
  beforeEach(() => {
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_FROM;
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("logs the message instead of sending when no API key is configured", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    await sendEmail(message);

    expect(fetchSpy).not.toHaveBeenCalled();

    // The reset link has to survive into the log — it is the only way to
    // recover an account on an instance with no mail provider.
    const logged = (console.warn as unknown as { mock: { calls: string[][] } })
      .mock.calls[0][0];
    expect(logged).toContain(message.to);
    expect(logged).toContain(message.text);
  });

  it("posts to Resend when an API key is configured", async () => {
    process.env.RESEND_API_KEY = "re_test_key";
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("{}", { status: 200 }));

    await sendEmail(message);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init?.method).toBe("POST");
    expect(
      (init?.headers as Record<string, string>).Authorization
    ).toBe("Bearer re_test_key");
    expect(JSON.parse(init?.body as string)).toMatchObject({
      to: message.to,
      subject: message.subject,
      text: message.text,
    });
  });

  it("uses EMAIL_FROM as the sender when set", async () => {
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.EMAIL_FROM = "Storegasm <no-reply@storegasm.example>";
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("{}", { status: 200 }));

    await sendEmail(message);

    expect(JSON.parse(fetchSpy.mock.calls[0][1]?.body as string).from).toBe(
      "Storegasm <no-reply@storegasm.example>"
    );
  });

  it("throws with the provider's reason when Resend rejects the message", async () => {
    process.env.RESEND_API_KEY = "re_test_key";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("domain not verified", { status: 403 })
    );

    await expect(sendEmail(message)).rejects.toThrow(
      /HTTP 403.*domain not verified/
    );
  });
});
