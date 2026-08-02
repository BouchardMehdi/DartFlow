"use client";

import type { AccountUser } from "@dartflow/shared";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { ApiError, apiRequest } from "@/src/cloud/api";
import { CLOUD_DATA_CHANGED_EVENT } from "@/src/cloud/events";
import { synchronizeCloud } from "@/src/cloud/synchronization";

type SyncStatus = "idle" | "syncing" | "synced" | "offline" | "error";
interface CloudContextValue {
  user: AccountUser | null;
  loading: boolean;
  syncStatus: SyncStatus;
  lastSyncedAt: string | null;
  login(email: string, password: string): Promise<void>;
  register(email: string, password: string): Promise<void>;
  logout(): Promise<void>;
  syncNow(): Promise<void>;
}

const CloudContext = createContext<CloudContextValue | null>(null);

export function CloudProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AccountUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const userRef = useRef<AccountUser | null>(null);
  useEffect(() => { userRef.current = user; }, [user]);

  const syncNow = useCallback(async () => {
    const currentUser = userRef.current;
    if (!currentUser) return;
    if (!navigator.onLine) { setSyncStatus("offline"); return; }
    setSyncStatus("syncing");
    try { const syncedAt = await synchronizeCloud(currentUser); setLastSyncedAt(syncedAt); setSyncStatus("synced"); }
    catch (error) { if (error instanceof ApiError && error.status === 401) setUser(null); setSyncStatus("error"); }
  }, []);

  useEffect(() => {
    let active = true;
    void apiRequest<{ user: AccountUser }>("/auth/me").then(({ user: account }) => { if (active) { setUser(account); userRef.current = account; } }).catch(() => undefined).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => { if (!user) return; const timer = setTimeout(() => void syncNow(), 0); return () => clearTimeout(timer); }, [user, syncNow]);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const queue = () => { if (timer) clearTimeout(timer); timer = setTimeout(() => void syncNow(), 900); };
    const offline = () => setSyncStatus("offline");
    window.addEventListener("online", queue); window.addEventListener("offline", offline); window.addEventListener(CLOUD_DATA_CHANGED_EVENT, queue);
    return () => { if (timer) clearTimeout(timer); window.removeEventListener("online", queue); window.removeEventListener("offline", offline); window.removeEventListener(CLOUD_DATA_CHANGED_EVENT, queue); };
  }, [syncNow]);

  const authenticate = async (path: "/auth/login" | "/auth/register", email: string, password: string) => {
    const response = await apiRequest<{ user: AccountUser }>(path, { method: "POST", body: JSON.stringify({ email, password }) });
    userRef.current = response.user; setUser(response.user);
  };
  const value = useMemo<CloudContextValue>(() => ({ user, loading, syncStatus, lastSyncedAt, login: (email, password) => authenticate("/auth/login", email, password), register: (email, password) => authenticate("/auth/register", email, password), logout: async () => { await apiRequest<void>("/auth/logout", { method: "POST" }); userRef.current = null; setUser(null); setSyncStatus("idle"); }, syncNow }), [user, loading, syncStatus, lastSyncedAt, syncNow]);
  return <CloudContext.Provider value={value}>{children}</CloudContext.Provider>;
}

export function useCloud(): CloudContextValue {
  const context = useContext(CloudContext);
  if (!context) throw new Error("useCloud doit être utilisé dans CloudProvider");
  return context;
}
