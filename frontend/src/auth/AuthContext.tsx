import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { api, ApiError, configureAuth, getSessionToken, setSessionToken } from "../api/client";
import { safeStorage } from "../utils/storage";
import type { LoginResponse, User } from "../api/types";

export interface RegisterForm {
  email: string;
  full_name: string;
  workspace_name: string;
  password: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  notice: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (form: RegisterForm) => Promise<void>;
  logout: () => Promise<void>;
  can: (permission: string) => boolean;
}

const ROLE_PERMISSIONS: Record<string, string[]> = {
  ADMIN: ["*"],
  AP_OPERATOR: [
    "invoice:read", "invoice:upload", "invoice:correct", "invoice:note", "invoice:request_info",
    "vendor:read", "po:read", "grn:read", "dashboard:read", "document:read", "evaluation:read",
  ],
  PROCUREMENT_REVIEWER: [
    "invoice:read", "invoice:correct", "invoice:note", "invoice:request_info",
    "vendor:read", "vendor:write", "po:read", "po:write", "grn:read", "grn:write",
    "dashboard:read", "document:read", "evaluation:read",
  ],
  FRAUD_INVESTIGATOR: [
    "invoice:read", "invoice:note", "invoice:escalate", "finding:resolve", "audit:read",
    "vendor:read", "po:read", "grn:read", "dashboard:read", "document:read", "evaluation:read",
  ],
  APPROVER: [
    "invoice:read", "invoice:approve", "invoice:reject", "invoice:note", "invoice:request_info",
    "vendor:read", "po:read", "grn:read", "dashboard:read", "document:read", "audit:read",
    "evaluation:read",
  ],
  AUDITOR: [
    "invoice:read", "audit:read", "vendor:read", "po:read", "grn:read", "dashboard:read",
    "document:read", "evaluation:read", "finding:resolve",
  ],
};

const AuthContext = createContext<AuthState | null>(null);

/* Development preview only. The server reports whether the demo session is enabled (IG_DEMO_AUTO_LOGIN,
 * development environment). When it is, the app opens the demo session itself on load, after a sign-out,
 * and when the server rejects the session, so the sign-in form is not shown. The server picks the account;
 * no password is sent from the browser. Automatic re-opens are capped to avoid a loop. */
let demoAllowed = false;
// Set by an explicit sign-out. Auto sign-in stays off until the page is reloaded.
let demoOptedOut = false;
const MAX_AUTO_REOPENS = 3;

interface Session {
  token: string;
  user: User;
}

/** A session is restored only when both the token and the user are present. A token without a user
 * (or the reverse) is treated as signed out, instead of showing the app with requests that carry no token. */
function restoreSession(): Session | null {
  const token = safeStorage.get("ig_token");
  const raw = safeStorage.get("ig_user");
  if (!token || !raw) return null;
  try {
    const user = JSON.parse(raw) as User;
    setSessionToken(token);
    return { token, user };
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(restoreSession);
  const token = session?.token ?? null;
  const user = session?.user ?? null;
  const [loading, setLoading] = useState<boolean>(Boolean(session));
  const [demoChecking, setDemoChecking] = useState<boolean>(() => !session);
  const [notice, setNotice] = useState<string | null>(null);
  const reopens = useRef(0);

  const clear = useCallback(() => {
    setSessionToken(null);
    safeStorage.remove("ig_token");
    safeStorage.remove("ig_user");
    setSession(null);
  }, []);

  const establish = useCallback((result: LoginResponse) => {
    setNotice(null);
    safeStorage.set("ig_token", result.access_token);
    safeStorage.set("ig_user", JSON.stringify(result.user));
    setSessionToken(result.access_token);
    setSession({ token: result.access_token, user: result.user });
  }, []);

  const openDemoSession = useCallback(async (): Promise<boolean> => {
    try {
      establish(await api.post<LoginResponse>("/auth/demo-session"));
      return true;
    } catch (err) {
      if (err instanceof ApiError) setNotice(err.message);
      return false;
    }
  }, [establish]);

  const reopenDemo = useCallback(async () => {
    setDemoChecking(true);
    try {
      await openDemoSession();
    } finally {
      setDemoChecking(false);
    }
  }, [openDemoSession]);

  useEffect(() => {
    // A 401 from an API call means the server rejected the session. Only the request that carried this
    // page's current token may end the session; a stale request must not sign out a newer one.
    configureAuth((path, reason, sentToken) => {
      if (!sentToken || sentToken !== getSessionToken()) return;
      clear();
      if (demoAllowed && !demoOptedOut && reopens.current < MAX_AUTO_REOPENS) {
        reopens.current += 1;
        void reopenDemo();
        return;
      }
      const stopped = demoAllowed && !demoOptedOut
        ? ` Automatic demo sign-in stopped after ${MAX_AUTO_REOPENS} attempts.` : "";
      setNotice(`The server rejected your session (HTTP 401 on ${path}: ${reason}). Sign in again.${stopped}`);
    });
  }, [clear, reopenDemo]);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    api
      .get<User>("/auth/me")
      .then((me) => {
        if (cancelled) return;
        // Not reset here: a session that the server accepts for /auth/me but rejects elsewhere must not reset the
        // automatic re-open cap, or the loop never ends. Only an explicit sign-in resets it.
        setSession((current) => (current && current.token === token ? { token, user: me } : current));
        safeStorage.set("ig_user", JSON.stringify(me));
      })
      .catch((err: unknown) => {
        // Only an explicit 401 means the session is gone. A network drop or a 5xx from the
        // proxy must not sign the user out; the stored session stays and later requests retry.
        if (!cancelled && err instanceof ApiError && err.status === 401 && getSessionToken() === token) clear();
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [token, clear]);

  const login = useCallback(async (email: string, password: string) => {
    establish(await api.post<LoginResponse>("/auth/login", { email, password }));
    reopens.current = 0;
  }, [establish]);

  const register = useCallback(async (form: RegisterForm) => {
    establish(await api.post<LoginResponse>("/auth/register", form));
    reopens.current = 0;
  }, [establish]);

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      /* the local session is cleared even if the server session already expired */
    }
    demoOptedOut = true;
    clear();
  }, [clear]);

  useEffect(() => {
    // Check once per page load whether the development demo session is available, and open it if no session exists.
    let cancelled = false;
    api
      .get<{ enabled: boolean }>("/auth/demo-status")
      .then(async (status) => {
        if (cancelled) return;
        demoAllowed = status.enabled;
        if (status.enabled && !session && !demoOptedOut) await openDemoSession();
      })
      .catch(() => undefined)
      .finally(() => !cancelled && setDemoChecking(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once per page load
  }, []);

  const can = useCallback(
    (permission: string) => {
      if (!user) return false;
      const permissions = ROLE_PERMISSIONS[user.role] || [];
      return permissions.includes("*") || permissions.includes(permission);
    },
    [user],
  );

  const value = useMemo(
    () => ({ user, token, loading: loading || demoChecking, notice, login, register, logout, can }),
    [user, token, loading, demoChecking, notice, login, register, logout, can],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
