import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const h = vi.hoisted(() => ({
  resetPassword: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: { resetPassword: h.resetPassword, signOut: h.signOut },
}));

import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";

async function fillAndSubmit(password: string, confirm: string) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText(/^new password$/i), password);
  await user.type(screen.getByLabelText(/confirm new password/i), confirm);
  await user.click(screen.getByRole("button", { name: /update password/i }));
}

describe("ResetPasswordForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.resetPassword.mockResolvedValue({ error: null });
    h.signOut.mockResolvedValue({});
  });

  it("submits the new password with the token from the reset link", async () => {
    render(<ResetPasswordForm token="tok-123" />);

    await fillAndSubmit("correcthorse", "correcthorse");

    expect(h.resetPassword).toHaveBeenCalledWith({
      newPassword: "correcthorse",
      token: "tok-123",
    });
  });

  it("clears the local session cookie after a successful reset", async () => {
    render(<ResetPasswordForm token="tok-123" />);

    await fillAndSubmit("correcthorse", "correcthorse");

    expect(h.signOut).toHaveBeenCalled();
    expect(
      screen.getByRole("link", { name: /sign in/i })
    ).toBeInTheDocument();
  });

  it("still reports success when clearing the cookie fails", async () => {
    h.signOut.mockRejectedValue(new Error("offline"));
    render(<ResetPasswordForm token="tok-123" />);

    await fillAndSubmit("correcthorse", "correcthorse");

    expect(screen.getByText(/password has been updated/i)).toBeInTheDocument();
  });

  it("rejects mismatched passwords without calling the API", async () => {
    render(<ResetPasswordForm token="tok-123" />);

    await fillAndSubmit("correcthorse", "correcthorsf");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /do not match/i
    );
    expect(h.resetPassword).not.toHaveBeenCalled();
  });

  it("rejects passwords shorter than 8 characters without calling the API", async () => {
    render(<ResetPasswordForm token="tok-123" />);

    await fillAndSubmit("short", "short");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /at least 8 characters/i
    );
    expect(h.resetPassword).not.toHaveBeenCalled();
  });

  it("surfaces an expired-token error from the server", async () => {
    h.resetPassword.mockResolvedValue({
      error: { message: "invalid token" },
    });
    render(<ResetPasswordForm token="stale" />);

    await fillAndSubmit("correcthorse", "correcthorse");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /invalid token/i
    );
  });
});
