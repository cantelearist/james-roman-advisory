"use client";

import {
  Inbox,
  Lock,
  MessageSquare,
  Paperclip,
  RefreshCw,
  Search,
  Send,
  Users,
} from "lucide-react";
import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import { EmptyState, PageHeader } from "@/components/portal/portal-ui";
import {
  MessageAttachment,
  type MessageAttachmentRecord,
} from "@/components/portal/message-attachment";

type Attachment = MessageAttachmentRecord;

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
  thread_key?: string;
  thread_latest_at?: string;
  thread_unread_count?: number;
  attachments?: Attachment[];
};

type ThreadSummary = {
  id: string;
  messages: Message[];
  latest: Message;
  subject: string;
  unreadCount: number;
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
  const [selectedThreadId, setSelectedThreadId] = useState("");
  const [query, setQuery] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [attachmentCount, setAttachmentCount] = useState(0);
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
      const nextMessages: Message[] = data.messages ?? [];
      setMessages(nextMessages);
      const firstThreadId = nextMessages[0]?.thread_key || nextMessages[0]?.thread_id || nextMessages[0]?.id || "";
      setSelectedThreadId((current) => (
        current && nextMessages.some((message) => (message.thread_key || message.thread_id || message.id) === current)
          ? current
          : firstThreadId
      ));
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

  const threads = useMemo<ThreadSummary[]>(() => {
    const grouped = new Map<string, Message[]>();
    for (const message of messages) {
      const key = message.thread_key || message.thread_id || message.id;
      grouped.set(key, [...(grouped.get(key) ?? []), message]);
    }
    return Array.from(grouped, ([id, rows]) => {
      const ordered = rows.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      const latest = ordered[ordered.length - 1];
      return {
        id,
        messages: ordered,
        latest,
        subject: ordered.find((message) => message.subject)?.subject || latest.matter_title,
        unreadCount: ordered.filter((message) => !message.is_read).length,
      };
    }).sort((a, b) => new Date(b.latest.created_at).getTime() - new Date(a.latest.created_at).getTime());
  }, [messages]);
  const selectedThread = threads.find((thread) => thread.id === selectedThreadId);
  const selected = selectedThread?.latest;

  async function choose(thread: ThreadSummary) {
    setSelectedThreadId(thread.id);
    if (thread.unreadCount > 0) {
      await fetch("/api/portal/inbox", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId: thread.id }),
      });
      setMessages((rows) => rows.map((row) => (
        (row.thread_key || row.thread_id || row.id) === thread.id ? { ...row, is_read: true } : row
      )));
    }
  }

  async function reply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    setSending(true);
    setError("");
    const form = event.currentTarget;
    const data = new FormData(form);
    data.set("audience", selected.audience);
    data.set("parentMessageId", selected.id);
    if (selected.subject) data.set("subject", selected.subject);
    const response = await fetch(`/api/matters/${selected.matter_id}/messages`, {
      method: "POST",
      body: data,
    });
    const result = await response.json();
    if (!response.ok) setError(result.error ?? "Reply could not be sent.");
    else {
      form.reset();
      setAttachmentCount(0);
      await load();
      setSelectedThreadId(result.message.thread_id || result.message.id);
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
          ) : threads.length === 0 ? (
            <EmptyState icon={Inbox} title="No messages in this view" description="New permitted correspondence will appear here." />
          ) : threads.map((thread) => (
            <button
              key={thread.id}
              className={`${selectedThreadId === thread.id ? "is-selected" : ""} ${thread.unreadCount ? "is-unread" : ""}`}
              onClick={() => choose(thread)}
            >
              <span className="portal-avatar">{thread.latest.sender_name.slice(0, 1)}</span>
              <div>
                <header><strong>{thread.latest.sender_name}</strong><time>{messageTime(thread.latest.created_at)}</time></header>
                <p>{thread.subject}</p>
                <span>{thread.latest.body}</span>
                <small>{thread.latest.matter_title} · {thread.messages.length} message{thread.messages.length === 1 ? "" : "s"}{thread.unreadCount ? ` · ${thread.unreadCount} unread` : ""}</small>
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
                {selectedThread?.messages.map((message) => (
                  <article key={message.id}>
                    <span className="portal-avatar">{message.sender_name.slice(0, 1)}</span>
                    <div><header><strong>{message.sender_name}</strong><span>{message.sender_role.replace("_", " ")} · {messageTime(message.created_at)}</span></header><p>{message.body}</p>{Boolean(message.attachments?.length) && <div className="portal-message-attachments">{message.attachments?.map((attachment) => <MessageAttachment key={attachment.id} attachment={attachment} />)}</div>}</div>
                  </article>
                ))}
              </div>
              <form className="portal-reply-form" onSubmit={reply}>
                <textarea name="body" required maxLength={10_000} placeholder={`Reply to ${selected.audience} thread…`} aria-label="Reply" />
                <footer><span>{selected.audience === "internal" ? <Lock size={12} /> : <Users size={12} />}Visible to {selected.audience}</span><div className="portal-compose-actions"><label className="portal-attachment-button"><Paperclip size={14} />{attachmentCount ? `${attachmentCount} file${attachmentCount === 1 ? "" : "s"}` : "Attach files"}<input type="file" name="attachments" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp,.heic,.txt,.csv" onChange={(event) => setAttachmentCount(event.target.files?.length ?? 0)} /></label><button className="portal-primary-button" disabled={sending}><Send size={14} />{sending ? "Sending…" : "Send reply"}</button></div></footer>
              </form>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
