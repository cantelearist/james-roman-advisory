"use client";

import {
  Inbox,
  Lock,
  MessageSquare,
  RefreshCw,
  Search,
  Send,
  Users,
} from "lucide-react";
import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import { EmptyState, PageHeader } from "@/components/portal/portal-ui";

type Message = {
  id: string;
  matter_id: string;
  matter_title: string;
  client_name: string;
  sender_id: string;
  sender_name: string;
  sender_role: string;
  body: string;
  audience: "internal" | "contractor" | "client";
  subject?: string | null;
  thread_id?: string | null;
  parent_message_id?: string | null;
  created_at: string;
  is_read: boolean;
};

function messageTime(value: string): string {
  const date = new Date(value);
  if (date.toDateString() === new Date().toDateString()) {
    return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  }
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function InboxPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [query, setQuery] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (unreadOnly) params.set("unread", "1");
    try {
      const response = await fetch(`/api/portal/inbox?${params.toString()}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Messages could not be loaded.");
      setMessages(data.messages ?? []);
      setSelectedId((current) => current || data.messages?.[0]?.id || "");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Messages could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [query, unreadOnly]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void load(), query ? 180 : 0);
    return () => window.clearTimeout(timeout);
  }, [load, query]);

  const selected = messages.find((message) => message.id === selectedId);
  const thread = useMemo(() => selected
    ? messages.filter((message) =>
        message.matter_id === selected.matter_id
        && (message.thread_id || message.id) === (selected.thread_id || selected.id),
      ).sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    : [], [messages, selected]);

  async function choose(message: Message) {
    setSelectedId(message.id);
    if (!message.is_read) {
      await fetch("/api/portal/inbox", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId: message.id }),
      });
      setMessages((rows) => rows.map((row) => row.id === message.id ? { ...row, is_read: true } : row));
    }
  }

  async function reply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    setSending(true);
    setError("");
    const form = event.currentTarget;
    const data = new FormData(form);
    const response = await fetch(`/api/matters/${selected.matter_id}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        body: data.get("body"),
        audience: selected.audience,
        subject: selected.subject,
        parentMessageId: selected.id,
      }),
    });
    const result = await response.json();
    if (!response.ok) setError(result.error ?? "Reply could not be sent.");
    else {
      form.reset();
      await load();
      setSelectedId(result.message.id);
    }
    setSending(false);
  }

  return (
    <div className="portal-page portal-inbox-page">
      <PageHeader
        eyebrow="Correspondence"
        title="Inbox"
        description="Client, contractor and internal updates across every permitted engagement."
        actions={<button className="portal-secondary-button" onClick={load}><RefreshCw size={14} />Refresh</button>}
      />

      <div className="portal-inbox-toolbar">
        <label className="portal-board-search"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search messages or engagements" /></label>
        <label className="portal-check-field"><input type="checkbox" checked={unreadOnly} onChange={(event) => setUnreadOnly(event.target.checked)} />Unread only</label>
      </div>
      {error && <div className="portal-inline-error" role="alert">{error}</div>}

      <section className="portal-card portal-inbox-layout">
        <div className="portal-inbox-list">
          {loading ? (
            <div className="portal-board-loading">{Array.from({ length: 8 }, (_, index) => <span key={index} />)}</div>
          ) : messages.length === 0 ? (
            <EmptyState icon={Inbox} title="No messages in this view" description="New permitted correspondence will appear here." />
          ) : messages.map((message) => (
            <button
              key={message.id}
              className={`${selectedId === message.id ? "is-selected" : ""} ${message.is_read ? "" : "is-unread"}`}
              onClick={() => choose(message)}
            >
              <span className="portal-avatar">{message.sender_name.slice(0, 1)}</span>
              <div>
                <header><strong>{message.sender_name}</strong><time>{messageTime(message.created_at)}</time></header>
                <p>{message.subject || message.matter_title}</p>
                <span>{message.body}</span>
                <small>{message.matter_title}</small>
              </div>
            </button>
          ))}
        </div>
        <div className="portal-thread">
          {!selected ? (
            <EmptyState icon={MessageSquare} title="Select a message" description="Choose a message to review its engagement context and reply." />
          ) : (
            <>
              <header className="portal-thread-header">
                <div><p className="portal-eyebrow">Engagement correspondence</p><h2>{selected.subject || selected.matter_title}</h2><span>{selected.client_name} · <Link href={`/portal/matters/${selected.matter_id}?section=messages`}>Open engagement</Link></span></div>
                <span className={`portal-audience portal-audience-${selected.audience}`}>{selected.audience === "internal" ? <Lock size={12} /> : <Users size={12} />}{selected.audience}</span>
              </header>
              <div className="portal-thread-messages">
                {thread.map((message) => (
                  <article key={message.id}>
                    <span className="portal-avatar">{message.sender_name.slice(0, 1)}</span>
                    <div><header><strong>{message.sender_name}</strong><span>{message.sender_role.replace("_", " ")} · {messageTime(message.created_at)}</span></header><p>{message.body}</p></div>
                  </article>
                ))}
              </div>
              <form className="portal-reply-form" onSubmit={reply}>
                <textarea name="body" required maxLength={10_000} placeholder={`Reply to ${selected.audience} thread…`} aria-label="Reply" />
                <footer><span>{selected.audience === "internal" ? <Lock size={12} /> : <Users size={12} />}Visible to {selected.audience}</span><button className="portal-primary-button" disabled={sending}><Send size={14} />{sending ? "Sending…" : "Send reply"}</button></footer>
              </form>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
