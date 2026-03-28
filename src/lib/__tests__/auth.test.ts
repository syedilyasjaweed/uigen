// @vitest-environment node
import { describe, test, expect, vi, beforeEach } from "vitest";
import { SignJWT } from "jose";

vi.mock("server-only", () => ({}));

const mockCookieStore = {
  set: vi.fn(),
  get: vi.fn(),
  delete: vi.fn(),
};

vi.mock("next/headers", () => ({
  cookies: vi.fn(() => Promise.resolve(mockCookieStore)),
}));

const { createSession, getSession, deleteSession, verifySession } =
  await import("@/lib/auth");

const JWT_SECRET = new TextEncoder().encode("development-secret-key");
const COOKIE_NAME = "auth-token";

async function makeToken(payload: object, expiredInPast = false): Promise<string> {
  const builder = new SignJWT(payload as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt();

  if (expiredInPast) {
    builder.setExpirationTime(Math.floor(Date.now() / 1000) - 10);
  } else {
    builder.setExpirationTime("7d");
  }

  return builder.sign(JWT_SECRET);
}

function makeRequest(token?: string) {
  return {
    cookies: {
      get: (name: string) =>
        token && name === COOKIE_NAME ? { value: token } : undefined,
    },
  } as any;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCookieStore.get.mockReturnValue(undefined);
});

describe("createSession", () => {
  test("signs a JWT and sets an httpOnly cookie", async () => {
    await createSession("user-1", "user@example.com");

    expect(mockCookieStore.set).toHaveBeenCalledOnce();
    const [name, _token, options] = mockCookieStore.set.mock.calls[0];
    expect(name).toBe(COOKIE_NAME);
    expect(options.httpOnly).toBe(true);
    expect(options.sameSite).toBe("lax");
    expect(options.path).toBe("/");
    expect(options.expires).toBeInstanceOf(Date);
  });

  test("sets cookie expiry ~7 days in the future", async () => {
    const before = Date.now();
    await createSession("user-1", "user@example.com");
    const after = Date.now();

    const [, , options] = mockCookieStore.set.mock.calls[0];
    const expiresMs = options.expires.getTime();
    const sevenDays = 7 * 24 * 60 * 60 * 1000;

    expect(expiresMs).toBeGreaterThanOrEqual(before + sevenDays - 1000);
    expect(expiresMs).toBeLessThanOrEqual(after + sevenDays + 1000);
  });

  test("token payload contains userId and email", async () => {
    const { jwtVerify } = await import("jose");
    await createSession("user-42", "hello@example.com");

    const [, token] = mockCookieStore.set.mock.calls[0];
    const { payload } = await jwtVerify(token, JWT_SECRET);

    expect(payload.userId).toBe("user-42");
    expect(payload.email).toBe("hello@example.com");
  });
});

describe("getSession", () => {
  test("returns null when no cookie is present", async () => {
    mockCookieStore.get.mockReturnValue(undefined);
    expect(await getSession()).toBeNull();
  });

  test("returns null for a malformed token", async () => {
    mockCookieStore.get.mockReturnValue({ value: "not.a.valid.jwt" });
    expect(await getSession()).toBeNull();
  });

  test("returns null for an expired token", async () => {
    const token = await makeToken(
      { userId: "u1", email: "a@b.com", expiresAt: new Date() },
      true
    );
    mockCookieStore.get.mockReturnValue({ value: token });
    expect(await getSession()).toBeNull();
  });

  test("returns session payload for a valid token", async () => {
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const token = await makeToken({
      userId: "user-7",
      email: "test@example.com",
      expiresAt,
    });
    mockCookieStore.get.mockReturnValue({ value: token });

    const session = await getSession();

    expect(session).not.toBeNull();
    expect(session?.userId).toBe("user-7");
    expect(session?.email).toBe("test@example.com");
  });
});

describe("deleteSession", () => {
  test("deletes the auth cookie", async () => {
    await deleteSession();
    expect(mockCookieStore.delete).toHaveBeenCalledWith(COOKIE_NAME);
  });
});

describe("verifySession", () => {
  test("returns null when request has no auth cookie", async () => {
    const req = makeRequest();
    expect(await verifySession(req)).toBeNull();
  });

  test("returns null for a malformed token in request", async () => {
    const req = makeRequest("garbage");
    expect(await verifySession(req)).toBeNull();
  });

  test("returns null for an expired token in request", async () => {
    const token = await makeToken(
      { userId: "u1", email: "a@b.com", expiresAt: new Date() },
      true
    );
    const req = makeRequest(token);
    expect(await verifySession(req)).toBeNull();
  });

  test("returns session payload for a valid token in request", async () => {
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const token = await makeToken({
      userId: "user-99",
      email: "verify@example.com",
      expiresAt,
    });
    const req = makeRequest(token);

    const session = await verifySession(req);

    expect(session).not.toBeNull();
    expect(session?.userId).toBe("user-99");
    expect(session?.email).toBe("verify@example.com");
  });
});
