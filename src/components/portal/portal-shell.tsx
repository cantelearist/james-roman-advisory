"use client";

import {
  Bell,
  BriefcaseBusiness,
  CheckSquare2,
  ChevronRight,
  CircleDollarSign,
  FileText,
  Home,
  Inbox,
  LogOut,
  Menu,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  UserRound,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { usePortalAccess } from "@/components/portal/access-provider";
import type { Capability } from "@/lib/data-model";

type NavigationItem = {
  href: string;
  label: string;
  icon: typeof Home;
  capability?: Capability;
  superAdminOnly?: boolean;
};

type SearchResult = {
  id: string;
  type: "engagement" | "client" | "document" | "message";
  title: string;
  context?: string;
  href: string;
};

type NotificationItem = {
  id: string;
  event_type: string;
  title: string;
  body: string;
  href: string;
  read_at: string | null;
  created_at: string;
};

type NotificationPreferences = {
  email: {
    messages: boolean;
    documents: boolean;
    finance: boolean;
    tasks: boolean;
  };
};

const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  email: { messages: true, documents: true, finance: true, tasks: true },
};

const PRIMARY_NAV: NavigationItem[] = [
  { href: "/portal", label: "Home", icon: Home },
  { href: "/portal/matters", label: "Engagements", icon: BriefcaseBusiness, capability: "engagements.view" },
  { href: "/portal/work", label: "My work", icon: CheckSquare2, capability: "timeline.view" },
  { href: "/portal/inbox", label: "Inbox", icon: Inbox, capability: "messages.view" },
  { href: "/portal/vault", label: "Documents", icon: FileText, capability: "documents.view" },
  { href: "/portal/finance", label: "Finance", icon: CircleDollarSign, capability: "finance.view" },
  { href: "/portal/account", label: "Account", icon: UserRound },
];

const ADMIN_NAV: NavigationItem[] = [
  { href: "/portal/admin", label: "People", icon: Users, capability: "users.invite" },
  { href: "/portal/admin/access", label: "Access control", icon: ShieldCheck, superAdminOnly: true },
  { href: "/portal/admin?tab=settings", label: "Settings", icon: Settings, superAdminOnly: true },
];

function activeRoute(pathname: string, href: string): boolean {
  if (href === "/portal") return pathname === href;
  const base = href.split("?")[0];
  return pathname === base || pathname.startsWith(`${base}/`);
}

function relativeDate(value: string): string {
  const date = new Date(value);
  const diffMinutes = Math.round((Date.now() - date.getTime()) / 60_000);
  if (diffMinutes < 1) return "Now";
  if (diffMinutes < 60) return `${diffMinutes}m`;
  if (diffMinutes < 1_440) return `${Math.floor(diffMinutes / 60)}h`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function PortalShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, access, can } = usePortalAccess();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [notificationSettingsOpen, setNotificationSettingsOpen] = useState(false);
  const [notificationPreferences, setNotificationPreferences] = useState<NotificationPreferences>(DEFAULT_NOTIFICATION_PREFERENCES);
  const [savingNotificationPreferences, setSavingNotificationPreferences] = useState(false);
  const [notificationPreferenceError, setNotificationPreferenceError] = useState("");
  const searchInput = useRef<HTMLInputElement>(null);

  const nav = useMemo(
    () => PRIMARY_NAV.filter((item) => !item.capability || can(item.capability)),
    [can],
  );
  const adminNav = useMemo(
    () => ADMIN_NAV.filter((item) => {
      if (item.superAdminOnly) return access.role === "super_admin";
      return !item.capability || can(item.capability);
    }),
    [access.role, can],
  );

  const loadNotifications = useCallback(async () => {
    try {
      const response = await fetch("/api/portal/notifications", { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json();
      setNotifications(data.notifications ?? []);
    } catch {
      // The shell remains usable if the notification service is unavailable.
    }
  }, []);

  const loadNotificationPreferences = useCallback(async () => {
    try {
      const response = await fetch("/api/portal/notification-preferences", { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json();
      setNotificationPreferences(data.preferences ?? DEFAULT_NOTIFICATION_PREFERENCES);
    } catch {
      // Defaults remain enabled if personal settings are temporarily unavailable.
    }
  }, []);

  async function updateNotificationPreference(
    key: keyof NotificationPreferences["email"],
    enabled: boolean,
  ) {
    const next = {
      ...notificationPreferences,
      email: { ...notificationPreferences.email, [key]: enabled },
    };
    setNotificationPreferences(next);
    setSavingNotificationPreferences(true);
    setNotificationPreferenceError("");
    try {
      const response = await fetch("/api/portal/notification-preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      if (!response.ok) throw new Error("Preference update failed");
    } catch {
      setNotificationPreferences(notificationPreferences);
      setNotificationPreferenceError("Your email preference could not be saved. Try again.");
    } finally {
      setSavingNotificationPreferences(false);
    }
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadNotifications(), 0);
    return () => window.clearTimeout(timeout);
  }, [loadNotifications]);

  useEffect(() => {
    if (!searchOpen) return;
    searchInput.current?.focus();
  }, [searchOpen]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
      if (event.key === "Escape") {
        setSearchOpen(false);
        setNotificationsOpen(false);
        setMobileOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!searchOpen || query.trim().length < 2) {
      return;
    }
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setSearching(true);
      try {
        const response = await fetch(`/api/portal/search?q=${encodeURIComponent(query.trim())}`, {
          signal: controller.signal,
        });
        const data = await response.json();
        if (response.ok) setResults(data.results ?? []);
      } catch {
        // A cancelled or failed search should not interrupt navigation.
      } finally {
        setSearching(false);
      }
    }, 180);
    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [query, searchOpen]);

  const unreadCount = notifications.filter((item) => !item.read_at).length;
  const currentLabel = [...nav, ...adminNav].find((item) => activeRoute(pathname, item.href))?.label
    ?? (pathname.includes("/matters/") ? "Engagement" : "Private Office");

  async function markNotification(id?: string) {
    const response = await fetch("/api/portal/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(id ? { id } : { all: true }),
    });
    if (response.ok) {
      setNotifications((items) =>
        items.map((item) => (!id || item.id === id ? { ...item, read_at: new Date().toISOString() } : item)),
      );
    }
  }

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/sign-in");
    router.refresh();
  }

  function navigationContent() {
    return (
      <>
        <div className="portal-brand">
          <span className="portal-brand-mark">JR</span>
          <div>
            <strong>James Roman</strong>
            <span>Private Office</span>
          </div>
          <button className="portal-icon-button portal-mobile-close" onClick={() => setMobileOpen(false)} aria-label="Close navigation">
            <X size={18} />
          </button>
        </div>
        <nav className="portal-nav" aria-label="Private Office">
          <p className="portal-nav-label">Workspace</p>
          {nav.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={activeRoute(pathname, item.href) ? "is-active" : undefined}
              >
                <Icon size={17} strokeWidth={1.7} />
                <span>{item.label}</span>
              </Link>
            );
          })}
          {adminNav.length > 0 && (
            <>
              <p className="portal-nav-label portal-nav-section">Administration</p>
              {adminNav.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={activeRoute(pathname, item.href) ? "is-active" : undefined}
                  >
                    <Icon size={17} strokeWidth={1.7} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </>
          )}
        </nav>
        <div className="portal-user">
          <span className="portal-avatar" aria-hidden>{user.name.slice(0, 1).toUpperCase()}</span>
          <div>
            <strong>{user.name}</strong>
            <span>{access.role.replace("_", " ")}</span>
          </div>
          <button className="portal-icon-button" onClick={signOut} aria-label="Sign out">
            <LogOut size={16} />
          </button>
        </div>
      </>
    );
  }

  return (
    <div className="portal-app">
      <aside className="portal-sidebar">{navigationContent()}</aside>
      {mobileOpen && (
        <div className="portal-mobile-overlay" role="dialog" aria-modal="true" aria-label="Navigation">
          <button className="portal-mobile-scrim" onClick={() => setMobileOpen(false)} aria-label="Close navigation" />
          <div className="portal-mobile-panel">{navigationContent()}</div>
        </div>
      )}

      <div className="portal-main">
        <header className="portal-topbar">
          <div className="portal-topbar-context">
            <button className="portal-icon-button portal-menu-button" onClick={() => setMobileOpen(true)} aria-label="Open navigation">
              <Menu size={19} />
            </button>
            <span>Private Office</span>
            <ChevronRight size={13} />
            <strong>{currentLabel}</strong>
          </div>
          <div className="portal-topbar-actions">
            <button className="portal-search-trigger" onClick={() => setSearchOpen(true)}>
              <Search size={16} />
              <span>Search workspace</span>
              <kbd>⌘K</kbd>
            </button>
            {can("engagements.create") && (
              <Link className="portal-primary-button portal-quick-create" href="/portal/matters?new=1">
                <Plus size={16} />
                <span>New engagement</span>
              </Link>
            )}
            <button
              className="portal-icon-button portal-notification-button"
              onClick={() => {
                setNotificationsOpen((value) => !value);
                setNotificationSettingsOpen(false);
                setSearchOpen(false);
                void loadNotificationPreferences();
              }}
              aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
              aria-expanded={notificationsOpen}
            >
              <Bell size={18} />
              {unreadCount > 0 && <span>{unreadCount > 9 ? "9+" : unreadCount}</span>}
            </button>
          </div>
        </header>

        {notificationsOpen && (
          <aside className="portal-popover portal-notifications" aria-label="Notifications">
            <div className="portal-popover-header">
              <div>
                <p className="portal-eyebrow">Workspace</p>
                <h2>{notificationSettingsOpen ? "Email preferences" : "Notifications"}</h2>
              </div>
              <div className="portal-notification-header-actions">
                {!notificationSettingsOpen && unreadCount > 0 && <button onClick={() => markNotification()}>Mark all read</button>}
                <button
                  className="portal-icon-button"
                  onClick={() => setNotificationSettingsOpen((value) => !value)}
                  aria-label={notificationSettingsOpen ? "Return to notifications" : "Manage email preferences"}
                >{notificationSettingsOpen ? <X size={15} /> : <Settings size={15} />}</button>
              </div>
            </div>
            {notificationSettingsOpen ? (
              <div className="portal-notification-preferences">
                <p>Choose which engagement events also reach you by email. Activity remains available in the Private Office.</p>
                {([
                  ["messages", "Messages", "New correspondence and replies"],
                  ["documents", "Documents", "Uploads and new versions"],
                  ["finance", "Finance", "Contracts, invoices and reminders"],
                  ["tasks", "Work", "Assignments and workflow blockers"],
                ] as const).map(([key, label, detail]) => (
                  <label key={key}>
                    <span><strong>{label}</strong><small>{detail}</small></span>
                    <input
                      type="checkbox"
                      checked={notificationPreferences.email[key]}
                      disabled={savingNotificationPreferences}
                      onChange={(event) => void updateNotificationPreference(key, event.target.checked)}
                    />
                  </label>
                ))}
                {notificationPreferenceError && <div className="portal-inline-error" role="alert">{notificationPreferenceError}</div>}
              </div>
            ) : <div className="portal-notification-list">
              {notifications.length === 0 ? (
                <div className="portal-empty-compact">
                  <Bell size={20} />
                  <p>No notifications.</p>
                  <span>New activity will appear here.</span>
                </div>
              ) : notifications.map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  className={item.read_at ? undefined : "is-unread"}
                  onClick={() => {
                    void markNotification(item.id);
                    setNotificationsOpen(false);
                  }}
                >
                  <span className="portal-notification-dot" />
                  <div>
                    <strong>{item.title}</strong>
                    <p>{item.body}</p>
                  </div>
                  <time>{relativeDate(item.created_at)}</time>
                </Link>
              ))}
            </div>}
          </aside>
        )}

        <main className="portal-content">{children}</main>
      </div>

      {searchOpen && (
        <div className="portal-command-overlay" role="dialog" aria-modal="true" aria-label="Search workspace">
          <button className="portal-command-scrim" onClick={() => setSearchOpen(false)} aria-label="Close search" />
          <section className="portal-command">
            <div className="portal-command-input">
              <Search size={19} />
              <input
                ref={searchInput}
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  if (event.target.value.trim().length < 2) setResults([]);
                }}
                placeholder="Search engagements, clients, documents and messages…"
                aria-label="Search workspace"
              />
              <kbd>ESC</kbd>
            </div>
            <div className="portal-command-results">
              {query.trim().length < 2 ? (
                <p className="portal-command-hint">Enter at least two characters.</p>
              ) : searching ? (
                <p className="portal-command-hint">Searching…</p>
              ) : results.length === 0 ? (
                <p className="portal-command-hint">No permitted records found.</p>
              ) : results.map((result) => (
                <Link
                  key={`${result.type}-${result.id}`}
                  href={result.href}
                  onClick={() => {
                    setSearchOpen(false);
                    setQuery("");
                  }}
                >
                  <span className="portal-search-type">{result.type}</span>
                  <div>
                    <strong>{result.title}</strong>
                    {result.context && <span>{result.context}</span>}
                  </div>
                  <ChevronRight size={16} />
                </Link>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
