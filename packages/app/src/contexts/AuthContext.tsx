import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

const TOKEN_KEY = "vitecut_token";
const USER_KEY = "vitecut_user";

export interface AuthUser {
  id: string;
  username: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  logout: () => void;
  setTokenAndUser: (token: string, user: AuthUser) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function loadStored(): { token: string | null; user: AuthUser | null } {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    const raw = localStorage.getItem(USER_KEY);
    const user = raw ? (JSON.parse(raw) as AuthUser) : null;
    return { token, user };
  } catch {
    return { token: null, user: null };
  }
}

function saveStored(token: string, user: AuthUser): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

function clearStored(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setTokenState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const setTokenAndUser = useCallback((t: string, u: AuthUser) => {
    setTokenState(t);
    setUser(u);
    saveStored(t, u);
  }, []);

  const logout = useCallback(() => {
    setTokenState(null);
    setUser(null);
    clearStored();
  }, []);

  useEffect(() => {
    const { token: t, user: u } = loadStored();
    if (!t) {
      setTokenState(null);
      setUser(null);
      setIsLoading(false);
      return;
    }
    setTokenState(t);
    setUser(u);
    fetch("/api/auth/me", {
      headers: { Authorization: `Bearer ${t}` },
    })
      .then((res) => {
        if (res.ok) return res.json();
        throw new Error("invalid");
      })
      .then((data) => {
        const u2 = data?.user;
        if (u2?.userId && u2?.username) {
          const authUser = { id: u2.userId, username: u2.username };
          setUser(authUser);
          saveStored(t, authUser);
        } else {
          throw new Error("invalid");
        }
      })
      .catch(() => {
        clearStored();
        setTokenState(null);
        setUser(null);
      })
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(
    async (username: string, password: string) => {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "登录失败");
      const t = data.token;
      const u = data.user;
      if (!t || !u?.id || !u?.username) throw new Error("登录失败");
      setTokenAndUser(t, { id: u.id, username: u.username });
    },
    [setTokenAndUser]
  );

  const register = useCallback(
    async (username: string, password: string) => {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "注册失败");
      const t = data.token;
      const u = data.user;
      if (!t || !u?.id || !u?.username) throw new Error("注册失败");
      setTokenAndUser(t, { id: u.id, username: u.username });
    },
    [setTokenAndUser]
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        login,
        register,
        logout,
        setTokenAndUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

/** 请求时自动带上 token，若 401 则触发 logout 回调 */
export function getAuthHeaders(): Record<string, string> {
  const token = typeof localStorage !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null;
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}
