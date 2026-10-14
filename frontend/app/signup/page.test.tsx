import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SignupPage from "./page";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

function response(status: number, body: unknown = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

let fetchMock: Mock;

beforeEach(() => {
  push.mockReset();
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function submitSignup(
  user: ReturnType<typeof userEvent.setup>,
  {
    email = "new@example.com",
    password = "correct-password",
    confirm = "correct-password",
  } = {},
) {
  await user.type(screen.getByLabelText(/^email$/i), email);
  await user.type(screen.getByLabelText(/^password$/i), password);
  await user.type(screen.getByLabelText(/^confirm password$/i), confirm);
  await user.click(screen.getByRole("button", { name: /sign up/i }));
}

describe("SignupPage", () => {
  // Registering twice from one click would hit the unique-email constraint on
  // the second request, so pin one submit to one request.
  it("issues exactly one registration request per submit", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(response(201, { id: "1" }));
    render(<SignupPage />);

    await submitSignup(user);

    await waitFor(() => expect(push).toHaveBeenCalled());
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rejects mismatched passwords without calling the API", async () => {
    const user = userEvent.setup();
    render(<SignupPage />);

    await submitSignup(user, {
      password: "correct-password",
      confirm: "different-password",
    });

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /passwords do not match/i,
    );
    expect(fetchMock).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it("surfaces the backend's message when the email is taken", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(
      response(409, { message: "User already exists" }),
    );
    render(<SignupPage />);

    await submitSignup(user);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "User already exists",
    );
    expect(push).not.toHaveBeenCalled();
  });

  it("distinguishes a throttled response from a registration failure", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(response(429, { message: "ThrottlerException" }));
    render(<SignupPage />);

    await submitSignup(user);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /too many attempts/i,
    );
  });

  it("redirects to the login page on success", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(response(201, { id: "1" }));
    render(<SignupPage />);

    await submitSignup(user);

    await waitFor(() => expect(push).toHaveBeenCalledWith("/login"));
  });
});
