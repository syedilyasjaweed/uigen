import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

// ---------------------------------------------------------------------------
// localStorage stub — jsdom's localStorage is broken in this env
// ---------------------------------------------------------------------------

const localStorageStore: Record<string, string> = {};

const localStorageMock = {
  getItem: vi.fn((key: string) => localStorageStore[key] ?? null),
  setItem: vi.fn((key: string, value: string) => {
    localStorageStore[key] = value;
  }),
  removeItem: vi.fn((key: string) => {
    delete localStorageStore[key];
  }),
  clear: vi.fn(() => {
    Object.keys(localStorageStore).forEach((k) => delete localStorageStore[k]);
  }),
};

vi.stubGlobal("localStorage", localStorageMock);

// ---------------------------------------------------------------------------
// matchMedia stub
// ---------------------------------------------------------------------------

function mockMatchMedia(prefersDark: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn((query: string) => ({
      matches: query === "(prefers-color-scheme: dark)" ? prefersDark : false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  localStorageMock.clear();
  vi.clearAllMocks();
  // Re-wire getItem/setItem after clearAllMocks resets call history but not implementations
  localStorageMock.getItem.mockImplementation((key: string) => localStorageStore[key] ?? null);
  localStorageMock.setItem.mockImplementation((key: string, value: string) => {
    localStorageStore[key] = value;
  });
  localStorageMock.removeItem.mockImplementation((key: string) => {
    delete localStorageStore[key];
  });
  localStorageMock.clear.mockImplementation(() => {
    Object.keys(localStorageStore).forEach((k) => delete localStorageStore[k]);
  });

  document.documentElement.classList.remove("dark");
  document.body.classList.remove("dark");
  mockMatchMedia(false);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// Lazy import so the global stub is in place before the module loads
const { useTheme } = await import("@/hooks/use-theme");

// ---------------------------------------------------------------------------
// Initial state — no stored preference
// ---------------------------------------------------------------------------

describe("initial theme — no stored value", () => {
  test("returns 'light' when system preference is light", () => {
    mockMatchMedia(false);
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe("light");
  });

  test("returns 'dark' when system preference is dark", () => {
    mockMatchMedia(true);
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe("dark");
  });
});

// ---------------------------------------------------------------------------
// Initial state — stored preference wins
// ---------------------------------------------------------------------------

describe("initial theme — stored value in localStorage", () => {
  test("uses stored 'dark' value regardless of system preference", () => {
    localStorageStore["theme"] = "dark";
    mockMatchMedia(false); // system says light, but stored says dark
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe("dark");
  });

  test("uses stored 'light' value regardless of system preference", () => {
    localStorageStore["theme"] = "light";
    mockMatchMedia(true); // system says dark, but stored says light
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe("light");
  });
});

// ---------------------------------------------------------------------------
// DOM side-effects on mount
// ---------------------------------------------------------------------------

describe("applyTheme on mount", () => {
  test("adds 'dark' class to html and body when theme resolves to dark", () => {
    mockMatchMedia(true);
    renderHook(() => useTheme());
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(document.body.classList.contains("dark")).toBe(true);
  });

  test("does NOT add 'dark' class when theme resolves to light", () => {
    mockMatchMedia(false);
    renderHook(() => useTheme());
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(document.body.classList.contains("dark")).toBe(false);
  });

  test("removes pre-existing 'dark' class when stored theme is 'light'", () => {
    document.documentElement.classList.add("dark");
    document.body.classList.add("dark");
    localStorageStore["theme"] = "light";
    renderHook(() => useTheme());
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(document.body.classList.contains("dark")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// toggleTheme
// ---------------------------------------------------------------------------

describe("toggleTheme", () => {
  test("switches from light to dark", () => {
    mockMatchMedia(false);
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe("light");

    act(() => {
      result.current.toggleTheme();
    });

    expect(result.current.theme).toBe("dark");
  });

  test("switches from dark to light", () => {
    mockMatchMedia(true);
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe("dark");

    act(() => {
      result.current.toggleTheme();
    });

    expect(result.current.theme).toBe("light");
  });

  test("persists new theme to localStorage", () => {
    mockMatchMedia(false);
    const { result } = renderHook(() => useTheme());

    act(() => {
      result.current.toggleTheme();
    });

    expect(localStorageMock.setItem).toHaveBeenCalledWith("theme", "dark");
    expect(localStorageStore["theme"]).toBe("dark");
  });

  test("overwrites previous localStorage value", () => {
    localStorageStore["theme"] = "dark";
    const { result } = renderHook(() => useTheme());

    act(() => {
      result.current.toggleTheme();
    });

    expect(localStorageStore["theme"]).toBe("light");
  });

  test("applies dark class to DOM when toggling to dark", () => {
    mockMatchMedia(false);
    const { result } = renderHook(() => useTheme());

    act(() => {
      result.current.toggleTheme();
    });

    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(document.body.classList.contains("dark")).toBe(true);
  });

  test("removes dark class from DOM when toggling to light", () => {
    mockMatchMedia(true);
    const { result } = renderHook(() => useTheme());

    act(() => {
      result.current.toggleTheme();
    });

    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(document.body.classList.contains("dark")).toBe(false);
  });

  test("double-toggle returns to original theme and DOM state", () => {
    mockMatchMedia(false);
    const { result } = renderHook(() => useTheme());

    act(() => {
      result.current.toggleTheme();
    });
    act(() => {
      result.current.toggleTheme();
    });

    expect(result.current.theme).toBe("light");
    expect(localStorageStore["theme"]).toBe("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Return shape
// ---------------------------------------------------------------------------

describe("return value", () => {
  test("exposes theme and toggleTheme", () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current).toHaveProperty("theme");
    expect(result.current).toHaveProperty("toggleTheme");
    expect(typeof result.current.toggleTheme).toBe("function");
  });

  test("theme is a valid union member", () => {
    const { result } = renderHook(() => useTheme());
    expect(["light", "dark"]).toContain(result.current.theme);
  });
});
