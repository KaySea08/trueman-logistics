import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { apiFetch, apiRequest, ApiError } from "../api/client";

export type AuthUser = {
  id: string;
  email: string | null;
  phone: string | null;
  status: string;
  customer: { displayName: string } | null;
  roles: string[];
  permissions: string[];
  mfaEnabled: boolean;
};

export type LoginOutcome =
  | { kind: "mfa-required"; challenge: string }
  | { kind: "mfa-setup-required" }
  | { kind: "authenticated"; user: AuthUser };

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  returnTo: string;
  refreshUser: () => Promise<AuthUser | null>;
  login: (email: string, password: string) => Promise<LoginOutcome>;
  verifyMfa: (challenge: string, code: string) => Promise<AuthUser>;
  setupMfa: () => Promise<{ qrCodeDataUrl: string; recoveryCodes: string[] }>;
  enableMfa: (code: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  setReturnTo: (path?: string) => void;
  consumeReturnTo: () => string;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function safeDestination(path?: string) {
  return path && path.startsWith("/") && !path.startsWith("//")
    ? path
    : "/dashboard";
}

function messageFrom(payload: unknown, fallback: string) {
  if (payload && typeof payload === "object" && "message" in payload) {
    const message = payload.message;
    if (typeof message === "string") return message;
    if (Array.isArray(message)) return message.join(" ");
  }
  return fallback;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [returnTo, setReturnToState] = useState("/dashboard");

  const refreshUser = useCallback(async () => {
    const response = await apiFetch("/auth/me", { method: "GET" });
    const payload: unknown = await response.json().catch(() => null);
    if (response.status === 401) {
      setUser(null);
      return null;
    }
    if (!response.ok) {
      throw new ApiError(
        messageFrom(payload, "Could not load your account."),
        response.status,
      );
    }

    const currentUser = payload as AuthUser;
    setUser(currentUser);
    return currentUser;
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function hydrateSession() {
      try {
        const response = await apiFetch("/auth/me", { method: "GET" });
        const payload: unknown = await response.json().catch(() => null);
        if (cancelled) return;
        if (response.ok) setUser(payload as AuthUser);
      } catch {
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void hydrateSession();
    return () => {
      cancelled = true;
    };
  }, []);

  async function login(email: string, password: string): Promise<LoginOutcome> {
    const response = await apiFetch("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    const payload: unknown = await response.json().catch(() => null);
    const data = payload && typeof payload === "object" ? payload : {};
    const challenge =
      "challenge" in data && typeof data.challenge === "string"
        ? data.challenge
        : "mfaChallenge" in data && typeof data.mfaChallenge === "string"
          ? data.mfaChallenge
          : null;
    const mfaRequired =
      ("mfaRequired" in data && data.mfaRequired === true) ||
      (challenge !== null && [202, 403].includes(response.status));

    if (mfaRequired && challenge) {
      return { kind: "mfa-required", challenge };
    }
    if (!response.ok) {
      throw new ApiError(
        messageFrom(payload, "Unable to sign in."),
        response.status,
      );
    }
    if ("mfaSetupRequired" in data && data.mfaSetupRequired === true) {
      return { kind: "mfa-setup-required" };
    }

    const currentUser = await refreshUser();
    if (!currentUser) throw new Error("Your session could not be confirmed.");
    return { kind: "authenticated", user: currentUser };
  }

  async function verifyMfa(challenge: string, code: string) {
    await apiRequest("/auth/mfa/login", {
      method: "POST",
      body: JSON.stringify({ challenge, code }),
    });
    const currentUser = await refreshUser();
    if (!currentUser) throw new Error("Your session could not be confirmed.");
    return currentUser;
  }

  async function setupMfa() {
    return apiRequest<{ qrCodeDataUrl: string; recoveryCodes: string[] }>(
      "/auth/mfa/setup",
      { method: "POST" },
    );
  }

  async function enableMfa(code: string) {
    await apiRequest("/auth/mfa/enable", {
      method: "POST",
      body: JSON.stringify({ code }),
    });
    const currentUser = await refreshUser();
    if (!currentUser) throw new Error("Your session could not be confirmed.");
    return currentUser;
  }

  async function logout() {
    try {
      await apiRequest("/auth/logout", { method: "POST" });
    } finally {
      setUser(null);
    }
  }

  function setReturnTo(path?: string) {
    setReturnToState(safeDestination(path));
  }

  function consumeReturnTo() {
    const destination = safeDestination(returnTo);
    setReturnToState("/dashboard");
    return destination;
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        returnTo,
        refreshUser,
        login,
        verifyMfa,
        setupMfa,
        enableMfa,
        logout,
        setReturnTo,
        consumeReturnTo,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider.");
  return context;
}
