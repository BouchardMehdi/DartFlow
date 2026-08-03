"use client";

import type { ClubChat, ClubMessage } from "@dartflow/shared";
import Image from "next/image";
import Link from "next/link";
import {
  FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useCloud } from "@/components/cloud/CloudProvider";
import { apiRequest } from "@/src/cloud/api";

const time = (value: string) =>
  new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));

export function ClubChatScreen({ clubId }: { clubId: string }) {
  const { user } = useCloud();
  const [data, setData] = useState<ClubChat | null>(null);
  const [content, setContent] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [selectedMessageId, setSelectedMessageId] = useState("");
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [working, setWorking] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const previousCount = useRef(0);
  const longPressTimer = useRef<number | null>(null);

  const refresh = useCallback(async () => {
    try {
      const result = await apiRequest<ClubChat>(`/clubs/${clubId}/messages`);
      setData(result);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Chat indisponible.");
    }
  }, [clubId]);

  useEffect(() => {
    const initial = window.setTimeout(() => void refresh(), 0);
    const interval = window.setInterval(() => void refresh(), 4_000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(interval);
    };
  }, [refresh]);

  useEffect(() => {
    const count = data?.messages.length ?? 0;
    if (count > previousCount.current) {
      bottomRef.current?.scrollIntoView({
        behavior: previousCount.current ? "smooth" : "auto",
      });
    }
    previousCount.current = count;
  }, [data?.messages.length]);

  useEffect(
    () => () => {
      if (longPressTimer.current !== null) {
        window.clearTimeout(longPressTimer.current);
      }
    },
    [],
  );

  const send = async (event: FormEvent) => {
    event.preventDefault();
    const message = content.trim();
    if (!message || sending) return;
    setSending(true);
    setError("");
    try {
      await apiRequest(`/clubs/${clubId}/messages`, {
        method: "POST",
        body: JSON.stringify({ content: message }),
      });
      setContent("");
      await refresh();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Message impossible à envoyer.",
      );
    } finally {
      setSending(false);
    }
  };

  const clearLongPress = () => {
    if (longPressTimer.current !== null) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const openActions = (message: ClubMessage) => {
    if (!message.canModify) return;
    setSelectedMessageId(message.id);
    setEditContent(message.content);
    setEditing(false);
  };

  const startLongPress = (message: ClubMessage) => {
    if (!message.canModify) return;
    clearLongPress();
    longPressTimer.current = window.setTimeout(() => {
      openActions(message);
      longPressTimer.current = null;
    }, 550);
  };

  const closeActions = () => {
    if (working) return;
    setSelectedMessageId("");
    setEditing(false);
    setEditContent("");
  };

  const update = async (event: FormEvent) => {
    event.preventDefault();
    const message = editContent.trim();
    if (!selectedMessageId || !message || working) return;
    setWorking(true);
    setError("");
    try {
      await apiRequest(`/clubs/${clubId}/messages/${selectedMessageId}`, {
        method: "PATCH",
        body: JSON.stringify({ content: message }),
      });
      setSelectedMessageId("");
      setEditing(false);
      setEditContent("");
      await refresh();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Message impossible à modifier.",
      );
    } finally {
      setWorking(false);
    }
  };

  const remove = async () => {
    if (!selectedMessageId || working) return;
    setWorking(true);
    setError("");
    try {
      await apiRequest(`/clubs/${clubId}/messages/${selectedMessageId}`, {
        method: "DELETE",
      });
      setSelectedMessageId("");
      setEditing(false);
      setEditContent("");
      await refresh();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Message impossible à supprimer.",
      );
    } finally {
      setWorking(false);
    }
  };

  const selectedMessage = data?.messages.find(
    (message) => message.id === selectedMessageId,
  );

  return (
    <main className="mx-auto flex h-[calc(100dvh-4.5rem)] max-w-4xl flex-col overflow-hidden px-4 py-5 sm:px-7 sm:py-8">
      <header className="flex items-center justify-between gap-4 border-b border-[var(--line)] pb-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="relative grid size-12 shrink-0 place-items-center overflow-hidden rounded-xl border border-[var(--lime)]/40 bg-[var(--panel)]">
            {data?.club.avatar ? (
              <Image
                src={data.club.avatar}
                alt={`Photo du club ${data.club.name}`}
                fill
                sizes="48px"
                unoptimized
                className="object-cover"
              />
            ) : (
              <span className="text-xl font-black uppercase text-[var(--lime)]">
                {data?.club.name.charAt(0) ?? "C"}
              </span>
            )}
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[.16em] text-[var(--lime)]">
              Chat du club
            </p>
            <h1 className="truncate text-2xl font-black">
              {data?.club.name ?? "Chargement…"}
            </h1>
          </div>
        </div>
        <Link
          href={`/clubs/${clubId}`}
          className="shrink-0 rounded-xl border border-[var(--line)] px-3 py-2 text-sm font-bold"
        >
          Retour
        </Link>
      </header>

      {error && (
        <p
          role="alert"
          className="mt-3 rounded-xl border border-[#713b32] bg-[#713b32]/15 p-3 text-sm font-bold text-[#ff9b7a]"
        >
          {error}
        </p>
      )}
      <section
        aria-label="Messages du club"
        aria-live="polite"
        className="mt-4 min-h-0 flex-1 space-y-3 overflow-y-auto rounded-2xl border border-[var(--line)] bg-black/15 p-3 sm:p-5"
      >
        {!data ? (
          <p className="text-center text-sm text-[var(--muted)]">
            Chargement des messages…
          </p>
        ) : data.messages.length === 0 ? (
          <div className="grid min-h-64 place-items-center text-center">
            <div>
              <span className="text-4xl text-[var(--lime)]">•••</span>
              <p className="mt-2 font-black">Commence la conversation</p>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Tous les membres actifs du club verront les messages.
              </p>
            </div>
          </div>
        ) : (
          data.messages.map((message) => {
            const mine = message.authorUserId === user?.id;
            const authorAvatar = message.authorUserId
              ? data.authorAvatars[message.authorUserId]
              : undefined;
            return (
              <article
                key={message.id}
                className={`flex gap-2 ${mine ? "flex-row-reverse" : ""}`}
              >
                <div className="relative grid size-9 shrink-0 place-items-center overflow-hidden rounded-full border border-[var(--line)] bg-[var(--panel)]">
                  {authorAvatar ? (
                    <Image
                      src={authorAvatar}
                      alt=""
                      fill
                      sizes="36px"
                      unoptimized
                      className="object-cover"
                    />
                  ) : (
                    <span className="text-xs font-black uppercase text-[var(--lime)]">
                      {message.authorUsername.charAt(0)}
                    </span>
                  )}
                </div>
                <div
                  role={message.canModify ? "button" : undefined}
                  tabIndex={message.canModify ? 0 : undefined}
                  aria-label={
                    message.canModify
                      ? "Maintenir appuyé pour gérer ce message"
                      : undefined
                  }
                  onTouchStart={() => startLongPress(message)}
                  onTouchMove={clearLongPress}
                  onTouchEnd={clearLongPress}
                  onTouchCancel={clearLongPress}
                  onMouseDown={() => startLongPress(message)}
                  onMouseUp={clearLongPress}
                  onMouseLeave={clearLongPress}
                  onContextMenu={(event) => {
                    if (!message.canModify) return;
                    event.preventDefault();
                    openActions(message);
                  }}
                  onKeyDown={(event) => {
                    if (
                      message.canModify &&
                      (event.key === "Enter" || event.key === " ")
                    ) {
                      event.preventDefault();
                      openActions(message);
                    }
                  }}
                  className={`max-w-[82%] rounded-2xl px-4 py-3 ${
                    mine
                      ? "select-none touch-pan-y rounded-tr-sm bg-[var(--lime)] text-black outline-none focus-visible:ring-2 focus-visible:ring-white"
                      : "rounded-tl-sm bg-[var(--panel)]"
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <strong className="text-xs">@{message.authorUsername}</strong>
                    <time
                      dateTime={message.createdAt}
                      className={`text-[10px] ${
                        mine ? "text-black/60" : "text-[var(--muted)]"
                      }`}
                    >
                      {time(message.createdAt)}
                    </time>
                    {message.editedAt && (
                      <span
                        className={`text-[10px] ${
                          mine ? "text-black/60" : "text-[var(--muted)]"
                        }`}
                      >
                        · modifié
                      </span>
                    )}
                  </div>
                  <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6">
                    {message.content}
                  </p>
                </div>
              </article>
            );
          })
        )}
        <div ref={bottomRef} />
      </section>

      <form onSubmit={send} className="mt-3 flex items-end gap-2">
        <label className="min-w-0 flex-1">
          <span className="sr-only">Écrire un message</span>
          <textarea
            required
            rows={1}
            maxLength={1000}
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder="Écrire un message…"
            className="max-h-32 min-h-13 w-full resize-y rounded-2xl border border-[var(--line)] bg-[var(--panel)] px-4 py-3 outline-none focus:border-[var(--lime)]"
          />
        </label>
        <button
          disabled={sending || !content.trim()}
          className="grid min-h-13 shrink-0 place-items-center rounded-2xl bg-[var(--lime)] px-5 font-black text-black disabled:opacity-40"
        >
          {sending ? "…" : "Envoyer"}
        </button>
      </form>
      <p className="mt-2 text-center text-[10px] text-[var(--muted)]">
        Actualisation automatique toutes les 4 secondes
      </p>

      {selectedMessage?.canModify && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-5 backdrop-blur-[2px]"
          onClick={(event) => {
            if (event.target === event.currentTarget) closeActions();
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-label={editing ? "Modifier le message" : "Actions du message"}
            className="w-full max-w-sm"
          >
            <div className="ml-auto max-w-[88%] rounded-2xl rounded-tr-sm bg-[var(--lime)] px-4 py-3 text-black shadow-2xl">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <strong className="text-xs">@{selectedMessage.authorUsername}</strong>
                <time
                  dateTime={selectedMessage.createdAt}
                  className="text-[10px] text-black/60"
                >
                  {time(selectedMessage.createdAt)}
                </time>
                {selectedMessage.editedAt && (
                  <span className="text-[10px] text-black/60">· modifié</span>
                )}
              </div>
              {!editing && (
                <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6">
                  {selectedMessage.content}
                </p>
              )}
            </div>

            {editing ? (
              <form
                onSubmit={update}
                className="-mt-1 ml-auto max-w-[88%] rounded-b-2xl border border-t-0 border-[var(--lime)]/40 bg-[var(--panel)] p-3 shadow-2xl"
              >
                <label className="block">
                  <span className="sr-only">Modifier le message</span>
                  <textarea
                    autoFocus
                    required
                    rows={3}
                    maxLength={1000}
                    value={editContent}
                    onChange={(event) => setEditContent(event.target.value)}
                    className="w-full resize-none rounded-xl border border-[var(--line)] bg-black/25 px-3 py-2 text-sm leading-6 outline-none focus:border-[var(--lime)]"
                  />
                </label>
                <div className="mt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setEditing(false)}
                    disabled={working}
                    className="min-h-10 rounded-xl px-3 text-sm font-bold text-[var(--muted)] disabled:opacity-40"
                  >
                    Annuler
                  </button>
                  <button
                    disabled={working || !editContent.trim()}
                    className="min-h-10 rounded-xl bg-[var(--lime)] px-4 text-sm font-black text-black disabled:opacity-40"
                  >
                    {working ? "Enregistrement…" : "Enregistrer"}
                  </button>
                </div>
              </form>
            ) : (
              <div className="mt-2 ml-auto w-56 overflow-hidden rounded-2xl border border-white/10 bg-[#202220] shadow-2xl">
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="flex min-h-12 w-full items-center justify-between px-4 text-left text-sm font-bold transition hover:bg-white/5"
                >
                  <span>Modifier</span>
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    className="size-4 text-[var(--muted)]"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  >
                    <path d="m4 20 4.2-1 10.5-10.5a2.1 2.1 0 0 0-3-3L5.2 16 4 20Z" />
                    <path d="m14.5 6.7 3 3" />
                  </svg>
                </button>
                <div className="h-px bg-white/10" />
                <button
                  type="button"
                  onClick={() => void remove()}
                  disabled={working}
                  className="flex min-h-12 w-full items-center justify-between px-4 text-left text-sm font-bold text-[#ff7c5c] transition hover:bg-white/5 disabled:opacity-40"
                >
                  <span>{working ? "Suppression…" : "Supprimer"}</span>
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    className="size-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  >
                    <path d="M4 7h16M9 7V4h6v3m-9 0 1 13h10l1-13M10 11v5m4-5v5" />
                  </svg>
                </button>
              </div>
            )}
            <p className="mt-3 text-center text-[10px] text-white/45">
              Touchez ailleurs pour fermer
            </p>
          </section>
        </div>
      )}
    </main>
  );
}
