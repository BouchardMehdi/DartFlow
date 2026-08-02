"use client";

import type { AccountUser } from "@dartflow/shared";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { ApiError, SESSION_REFRESHED_EVENT, apiRequest } from "@/src/cloud/api";
import { CLOUD_DATA_CHANGED_EVENT } from "@/src/cloud/events";
import { synchronizeCloud } from "@/src/cloud/synchronization";
import { database } from "@/src/database/database";

type SyncStatus = "idle" | "syncing" | "synced" | "offline" | "error";
interface CloudContextValue {
  user: AccountUser | null;
  loading: boolean;
  syncStatus: SyncStatus;
  lastSyncedAt: string | null;
  login(email: string, password: string): Promise<void>;
  register(email: string, password: string, username: string): Promise<void>;
  logout(): Promise<void>;
  updateUsername(username: string): Promise<void>;
  updateAvatar(avatar: string | null): Promise<void>;
  syncNow(): Promise<void>;
}

const CloudContext = createContext<CloudContextValue | null>(null);

export function CloudProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AccountUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [accessExpiresAt, setAccessExpiresAt] = useState<string | null>(null);
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
    void apiRequest<{ user: AccountUser; accessExpiresAt: string }>("/auth/me").then(({ user: account, accessExpiresAt: expiry }) => { if (active) { setUser(account); setAccessExpiresAt(expiry); userRef.current = account; void database.syncMetadata.put({ id:"main",activeUserId:account.id }); } }).catch(() => undefined).finally(() => { if (active) setLoading(false); });
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

  useEffect(() => { const update=(event:Event)=>setAccessExpiresAt((event as CustomEvent<string>).detail); window.addEventListener(SESSION_REFRESHED_EVENT,update); return()=>window.removeEventListener(SESSION_REFRESHED_EVENT,update); },[]);
  useEffect(() => {
    if (!user || !accessExpiresAt) return;
    const delay=Math.max(30_000,new Date(accessExpiresAt).getTime()-Date.now()-5*60*1000);
    const timer=setTimeout(()=>{if(navigator.onLine)void apiRequest<{accessExpiresAt:string}>("/auth/refresh",{method:"POST"}).then(result=>setAccessExpiresAt(result.accessExpiresAt)).catch(()=>undefined);},delay);
    return()=>clearTimeout(timer);
  },[user,accessExpiresAt]);

  const authenticate = async (path: "/auth/login" | "/auth/register", email: string, password: string, username?: string) => {
    const response = await apiRequest<{ user: AccountUser; accessExpiresAt: string }>(path, { method: "POST", body: JSON.stringify({ email, password, ...(username ? { username } : {}) }) });
    userRef.current = response.user; setUser(response.user); setAccessExpiresAt(response.accessExpiresAt); await database.syncMetadata.put({ id:"main",activeUserId:response.user.id });
  };
  const value = useMemo<CloudContextValue>(() => ({ user, loading, syncStatus, lastSyncedAt, login: (email, password) => authenticate("/auth/login", email, password), register: (email, password, username) => authenticate("/auth/register", email, password, username), logout: async () => { await apiRequest<void>("/auth/logout", { method: "POST" }); userRef.current = null; setUser(null); setAccessExpiresAt(null); setSyncStatus("idle"); await database.syncMetadata.put({id:"main"}); }, updateUsername: async (username) => { const response = await apiRequest<{ user: AccountUser }>("/auth/me", { method: "PATCH", body: JSON.stringify({ username }) }); userRef.current=response.user; setUser(response.user); }, updateAvatar: async (avatar) => { const response = await apiRequest<{ user: AccountUser }>("/auth/me/avatar", { method: "PATCH", body: JSON.stringify({ avatar }) }); userRef.current=response.user; setUser(response.user); }, syncNow }), [user, loading, syncStatus, lastSyncedAt, syncNow]);
  return <CloudContext.Provider value={value}>{children}</CloudContext.Provider>;
}

export function useCloud(): CloudContextValue {
  const context = useContext(CloudContext);
  if (!context) throw new Error("useCloud doit être utilisé dans CloudProvider");
  return context;
}
