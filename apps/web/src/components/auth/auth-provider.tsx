"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ApiError,
  apiRequest,
  type AuthResponse,
  type LoginInput,
  type PublicUser,
  type RegisterInput,
} from "@/lib/api";

type SessionState =
  | { status: "checking" | "anonymous" | "unavailable"; user: null }
  | { status: "authenticated"; user: PublicUser };
interface AuthContextValue {
  session: SessionState;
  retry: () => void;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
}
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionState>({
    status: "checking",
    user: null,
  });
  const version = useRef(0);
  const checkSession = useCallback((signal?: AbortSignal) => {
    const current = ++version.current;
    return apiRequest<AuthResponse>("/auth/me", { signal })
      .then(({ user }) => {
        if (!signal?.aborted && current === version.current)
          setSession({ status: "authenticated", user });
      })
      .catch((error: unknown) => {
        if (!signal?.aborted && current === version.current)
          setSession({
            status:
              error instanceof ApiError && error.status === 401
                ? "anonymous"
                : "unavailable",
            user: null,
          });
      });
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    void checkSession(controller.signal);
    const onFocus = () => {
      void checkSession(controller.signal);
    };
    window.addEventListener("focus", onFocus);
    return () => {
      controller.abort();
      window.removeEventListener("focus", onFocus);
    };
  }, [checkSession]);

  async function authenticate(path: string, input: LoginInput | RegisterInput) {
    const { user } = await apiRequest<AuthResponse>(path, {
      method: "POST",
      body: input,
    });
    ++version.current;
    setSession({ status: "authenticated", user });
  }
  async function logout() {
    try {
      await apiRequest<void>("/auth/logout", { method: "POST" });
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 401) throw error;
    }
    ++version.current;
    setSession({ status: "anonymous", user: null });
  }
  const value: AuthContextValue = {
    session,
    retry: () => {
      setSession({ status: "checking", user: null });
      void checkSession();
    },
    login: (input) => authenticate("/auth/login", input),
    register: (input) => authenticate("/auth/register", input),
    logout,
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth deve estar dentro do AuthProvider.");
  return context;
}
