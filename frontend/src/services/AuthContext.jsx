import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, clearApiRuntimeState } from "./api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);

  const clearSession = useCallback(() => {
    clearApiRuntimeState();
    for (const storage of [localStorage, sessionStorage]) {
      for (let index = storage.length - 1; index >= 0; index -= 1) {
        const key = storage.key(index);
        if (key?.startsWith("adapt_")) storage.removeItem(key);
      }
    }
    setUser(null);
  }, []);

  const setSession = useCallback((token, nextUser) => {
    clearApiRuntimeState();
    localStorage.setItem("adapt_token", token);
    localStorage.setItem("adapt_user", JSON.stringify(nextUser));
    setUser(nextUser);
  }, []);

  useEffect(() => {
    let current = true;
    const token = localStorage.getItem("adapt_token");
    if (!token) { setChecking(false); return () => { current = false; }; }
    api.me().then((result) => {
      if (!current) return;
      localStorage.setItem("adapt_user", JSON.stringify(result.user));
      setUser(result.user);
    }).catch(() => { if (current) clearSession(); })
      .finally(() => { if (current) setChecking(false); });
    return () => { current = false; };
  }, [clearSession]);

  useEffect(() => {
    const onUnauthorized = () => clearSession();
    window.addEventListener("adapt:unauthorized", onUnauthorized);
    return () => window.removeEventListener("adapt:unauthorized", onUnauthorized);
  }, [clearSession]);

  const logout = useCallback(async () => {
    try { if (localStorage.getItem("adapt_token")) await api.logout(); }
    finally { clearSession(); }
  }, [clearSession]);

  const value = useMemo(() => ({ user, checking, setSession, logout }), [user, checking, setSession, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
