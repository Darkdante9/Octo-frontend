import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "./api";
import { isAuthenticationFailure } from "./useAuth";

const replaceMock = vi.fn();
const refreshMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: replaceMock,
    refresh: refreshMock,
    push: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

const meMock = vi.fn();
const loginMock = vi.fn();
const logoutMock = vi.fn();

vi.mock("./api", async () => {
  const actual = await vi.importActual<typeof import("./api")>("./api");
  return {
    ...actual,
    me: (...args: unknown[]) => meMock(...args),
    login: (...args: unknown[]) => loginMock(...args),
    logout: (...args: unknown[]) => logoutMock(...args),
  };
});

const clearTokenMock = vi.fn();
const getTokenMock = vi.fn();

vi.mock("./auth", () => ({
  clearToken: (...args: unknown[]) => clearTokenMock(...args),
  getToken: (...args: unknown[]) => getTokenMock(...args),
  setToken: vi.fn(),
}));

const { AuthProvider, useAuth, isAuthenticationFailure: isAuthFailureFromModule } =
  await import("./useAuth");

function wrapper({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}

describe("isAuthenticationFailure", () => {
  it("classifies unauthorized and forbidden responses as destructive auth failures", () => {
    expect(isAuthenticationFailure(new ApiError("expired", 401))).toBe(true);
    expect(isAuthenticationFailure(new ApiError("forbidden", 403))).toBe(true);
  });

  it("keeps timeout, server, and network errors retryable", () => {
    expect(isAuthenticationFailure(new ApiError("timed out", 0))).toBe(false);
    expect(isAuthenticationFailure(new ApiError("server error", 500))).toBe(false);
    expect(isAuthenticationFailure(new TypeError("offline"))).toBe(false);
  });

  it("is exported consistently from the module", () => {
    expect(isAuthFailureFromModule).toBe(isAuthenticationFailure);
  });
});

describe("useAuth session handling", () => {
  beforeEach(() => {
    replaceMock.mockReset();
    refreshMock.mockReset();
    meMock.mockReset();
    loginMock.mockReset();
    logoutMock.mockReset();
    clearTokenMock.mockReset();
    getTokenMock.mockReset();
    getTokenMock.mockReturnValue("token");
    meMock.mockResolvedValue({ id: "1", email: "user@example.com" });
    logoutMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("redirects to /login exactly once when several 401s arrive together", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.user).not.toBeNull();
    });

    replaceMock.mockClear();

    act(() => {
      window.dispatchEvent(new CustomEvent("session-expired", { detail: { status: 401 } }));
      window.dispatchEvent(new CustomEvent("session-expired", { detail: { status: 401 } }));
      window.dispatchEvent(new CustomEvent("session-expired", { detail: { status: 401 } }));
    });

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith("/login");
    });

    expect(replaceMock).toHaveBeenCalledTimes(1);
    expect(clearTokenMock).toHaveBeenCalled();
    expect(logoutMock).toHaveBeenCalledTimes(1);
  });

  it("signs the user out when a storage event removes octo_token", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.user).not.toBeNull();
    });

    replaceMock.mockClear();

    act(() => {
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "octo_token",
          newValue: null,
          oldValue: "token",
        }),
      );
    });

    await waitFor(() => {
      expect(result.current.user).toBeNull();
    });

    expect(clearTokenMock).toHaveBeenCalled();
    expect(replaceMock).toHaveBeenCalledWith("/login");
    expect(replaceMock).toHaveBeenCalledTimes(1);
  });

  it("re-calls me() when retrySessionCheck is invoked", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.user).not.toBeNull();
    });

    expect(meMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.retrySessionCheck();
    });

    await waitFor(() => {
      expect(meMock).toHaveBeenCalledTimes(2);
    });

    expect(result.current.user).not.toBeNull();
  });
});