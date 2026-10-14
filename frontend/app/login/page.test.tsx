import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LoginPage from "./page";

// vi.mock is hoisted above the imports, so the spy it closes over has to be
// created in a hoisted block too.
const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

const API = "http://api.test";

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

async function submitLogin(
  user: ReturnType<typeof userEvent.setup>,
  { email = "user@example.com", password = "correct-password" } = {},
) {
  await user.type(screen.getByLabelText(/^email$/i), email);
  await user.type(screen.getByLabelText(/^password$/i), password);
  await user.click(screen.getByRole("button", { name: /sign in/i }));
}

describe("LoginPage", () => {
  it("shows no error before the first submit", () => {
    render(<LoginPage />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  // /auth/login is throttled at 5 attempts a minute, so any submit path that
  // fired the request more than once would halve a user's real budget. This
  // pins the one-submit-one-request invariant. It deliberately does not wait
  // on the error text, so it keeps its meaning if the messaging changes.
  it("issues exactly one login request per submit", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(response(401, { message: "Invalid credentials" }));
    render(<LoginPage />);

    await submitLogin(user);

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("posts the credentials to the login endpoint with cookies enabled", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(response(201, { message: "Login successful" }));
    render(<LoginPage />);

    await submitLogin(user, { email: "a@b.com", password: "s3cret-password" });

    await waitFor(() => expect(push).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API}/auth/login`);
    // credentials: "include" is what lets the httpOnly cookie be set at all.
    expect(init).toMatchObject({ method: "POST", credentials: "include" });
    expect(JSON.parse(init.body)).toEqual({
      email: "a@b.com",
      password: "s3cret-password",
    });
  });

  // The old code called setMessage(...) then alert(message), which read the
  // previous render's state and popped up `null` on the first failure.
  it("renders the credentials message when the API rejects the login", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(response(401, { message: "Invalid credentials" }));
    render(<LoginPage />);

    await submitLogin(user);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Invalid email or password.",
    );
    expect(push).not.toHaveBeenCalled();
  });

  it("distinguishes a throttled response from bad credentials", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(response(429, { message: "ThrottlerException" }));
    render(<LoginPage />);

    await submitLogin(user);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/too many attempts/i);
    // Telling a throttled user their password is wrong sends them off
    // retyping a password that was never the problem.
    expect(alert).not.toHaveTextContent(/invalid email or password/i);
  });

  it("reports an unreachable backend instead of blaming the credentials", async () => {
    const user = userEvent.setup();
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    render(<LoginPage />);

    await submitLogin(user);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /could not reach the server/i,
    );
  });

  // The backend answers a successful login with 201, not 200.
  it("redirects to the dashboard on success and shows no error", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(response(201, { message: "Login successful" }));
    render(<LoginPage />);

    await submitLogin(user);

    await waitFor(() => expect(push).toHaveBeenCalledWith("/dashboard"));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("disables the submit button while the request is in flight", async () => {
    const user = userEvent.setup();
    let release: (value: Response) => void = () => {};
    fetchMock.mockReturnValue(
      new Promise<Response>((resolve) => {
        release = resolve;
      }),
    );
    render(<LoginPage />);

    const button = screen.getByRole("button", { name: /sign in/i });
    await submitLogin(user);

    expect(button).toBeDisabled();

    release(response(401, { message: "Invalid credentials" }));
    await waitFor(() => expect(button).toBeEnabled());
  });
});
