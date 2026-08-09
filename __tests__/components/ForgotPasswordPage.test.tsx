import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const h = vi.hoisted(() => ({ requestPasswordReset: vi.fn() }));

vi.mock("@/lib/auth-client", () => ({
  authClient: { requestPasswordReset: h.requestPasswordReset },
}));

import ForgotPasswordPage from "@/app/(auth)/forgot-password/page";

async function submit(email: string) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText(/email/i), email);
  await user.click(screen.getByRole("button", { name: /send reset link/i }));
}

describe("ForgotPasswordPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.requestPasswordReset.mockResolvedValue({ error: null });
  });

  it("asks for a reset link that lands on the app's reset page", async () => {
    render(<ForgotPasswordPage />);

    await submit("owner@example.com");

    expect(h.requestPasswordReset).toHaveBeenCalledWith({
      email: "owner@example.com",
      redirectTo: "/reset-password",
    });
  });

  it("confirms without revealing whether the account exists", async () => {
    render(<ForgotPasswordPage />);

    await submit("stranger@example.com");

    // "If an account exists" — the same wording regardless of the address.
    expect(await screen.findByText(/if an account exists/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /send reset link/i })
    ).not.toBeInTheDocument();
  });

  it("lets the user go back and try another address", async () => {
    render(<ForgotPasswordPage />);
    await submit("typo@example.com");

    await userEvent.setup().click(
      screen.getByRole("button", { name: /use a different email/i })
    );

    expect(
      screen.getByRole("button", { name: /send reset link/i })
    ).toBeInTheDocument();
  });

  it("surfaces a server error instead of a false confirmation", async () => {
    h.requestPasswordReset.mockResolvedValue({
      error: { message: "Reset password isn't enabled" },
    });
    render(<ForgotPasswordPage />);

    await submit("owner@example.com");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /isn't enabled/i
    );
    expect(screen.queryByText(/if an account exists/i)).not.toBeInTheDocument();
  });
});
