import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Menu, Plus, Trash2, RefreshCw, Cloud, X } from "lucide-react";
import {
  activeEntries,
  DEFAULT_WISDOM,
  localStorageWisdom,
  randomKey,
  type WisdomMap,
  type WisdomStorage,
} from "@/lib/wisdom-storage";
import {
  getGistId,
  getGistToken,
  setGistId,
  setGistToken,
  syncWithGist,
} from "@/lib/gist-sync";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Remember" },
      {
        name: "description",
        content:
          "A minimal space to collect and revisit the pieces of wisdom you want to remember.",
      },
      { property: "og:title", content: "Remember" },
      {
        property: "og:description",
        content:
          "A minimal space to collect and revisit the pieces of wisdom you want to remember.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RememberPage,
});

const storage: WisdomStorage = localStorageWisdom;

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

type SyncStatus = "idle" | "loading" | "syncing" | "ok" | "error" | "disabled";

function RememberPage() {
  const [items, setItems] = useState<WisdomMap>({});
  const [order, setOrder] = useState<string[]>([]);
  const [cursor, setCursor] = useState(0);
  const [displayedText, setDisplayedText] = useState<string | undefined>(undefined);
  const [wisdomAnim, setWisdomAnim] = useState<"idle" | "out" | "in">("idle");
  const [hydrated, setHydrated] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuClosing, setMenuClosing] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [syncOpen, setSyncOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [tokenDraft, setTokenDraft] = useState("");
  const [gistIdDraft, setGistIdDraft] = useState("");
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("disabled");
  const [syncError, setSyncError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const itemsRef = useRef<WisdomMap>({});
  itemsRef.current = items;

  const currentKey = order[cursor];
  const currentEntry = currentKey ? items[currentKey] : undefined;
  const current = currentEntry && currentEntry.op === "add" ? currentEntry.text : undefined;

  const buildOrder = useCallback((map: WisdomMap) => {
    const keys = activeEntries(map).map(([k]) => k);
    return shuffle(keys);
  }, []);

  // Load once
  useEffect(() => {
    let loaded = storage.load();
    if (Object.keys(loaded).length === 0) {
      loaded = { ...DEFAULT_WISDOM };
      storage.save(loaded);
    }
    setItems(loaded);
    setOrder(buildOrder(loaded));
    setCursor(0);
    setHydrated(true);
    setTokenDraft(getGistToken());
    setGistIdDraft(getGistId());
    setSyncStatus(getGistToken() ? "loading" : "disabled");
  }, [buildOrder]);

  // Persist
  useEffect(() => {
    if (hydrated) storage.save(items);
  }, [items, hydrated]);

  // Gentle fade transition between wisdom items
  useEffect(() => {
    if (current === displayedText) return;
    if (displayedText === undefined && current !== undefined) {
      setDisplayedText(current);
      return;
    }
    setWisdomAnim("out");
    const t = setTimeout(() => {
      setDisplayedText(current);
      setWisdomAnim("in");
      const t2 = setTimeout(() => setWisdomAnim("idle"), 280);
      return () => clearTimeout(t2);
    }, 200);
    return () => clearTimeout(t);
  }, [current, displayedText]);

  const runSync = useCallback(
    async (phase: "loading" | "syncing" = "syncing") => {
      if (!getGistToken()) return;
      setSyncStatus(phase);
      setSyncError(null);
      try {
        const result = await syncWithGist(itemsRef.current);
        const merged = result.merged;
        // Only reset order if the active set changed.
        const prevKeys = new Set(activeEntries(itemsRef.current).map(([k]) => k));
        const nextKeys = new Set(activeEntries(merged).map(([k]) => k));
        let sameActive = prevKeys.size === nextKeys.size;
        if (sameActive) for (const k of prevKeys) if (!nextKeys.has(k)) { sameActive = false; break; }
        setItems(merged);
        if (!sameActive) {
          setOrder(buildOrder(merged));
          setCursor(0);
        }
        setSyncStatus("ok");
      } catch (e) {
        setSyncStatus("error");
        setSyncError(e instanceof Error ? e.message : "Sync failed");
      }
    },
    [buildOrder],
  );

  // Initial sync on mount when configured
  useEffect(() => {
    if (hydrated && getGistToken()) runSync("loading");
  }, [hydrated, runSync]);


  const closeMenu = useCallback(() => {
    if (!menuOpen || menuClosing) return;
    setMenuClosing(true);
    setTimeout(() => {
      setMenuOpen(false);
      setMenuClosing(false);
    }, 260);
  }, [menuOpen, menuClosing]);

  const advance = useCallback(() => {
    const active = activeEntries(items).map(([k]) => k);
    if (active.length === 0) return;
    if (cursor + 1 >= order.length) {
      let next = shuffle(active);
      if (active.length > 1 && next[0] === order[cursor]) {
        [next[0], next[next.length - 1]] = [next[next.length - 1], next[0]];
      }
      setOrder(next);
      setCursor(0);
    } else {
      setCursor((c) => c + 1);
    }
  }, [items, order, cursor]);

  const handleAdd = () => {
    const text = draft.trim();
    if (!text) return;
    const key = randomKey();
    const newItems: WisdomMap = {
      ...items,
      [key]: { text, op: "add", updatedAt: Date.now() },
    };
    setItems(newItems);
    const rest = order.slice(cursor + 1);
    setOrder([...order.slice(0, cursor + 1), key, ...rest]);
    setDraft("");
    setAddOpen(false);
    setMenuOpen(false);
    if (getGistToken()) void runSync();
  };

  const handleRemove = () => {
    if (!currentKey || !currentEntry) return;
    const newItems: WisdomMap = {
      ...items,
      [currentKey]: { ...currentEntry, op: "delete", updatedAt: Date.now() },
    };
    const newOrder = order.filter((k) => k !== currentKey);
    setItems(newItems);
    if (newOrder.length === 0) {
      setOrder([]);
      setCursor(0);
    } else if (cursor >= newOrder.length) {
      setOrder(shuffle(activeEntries(newItems).map(([k]) => k)));
      setCursor(0);
    } else {
      setOrder(newOrder);
    }
    setMenuOpen(false);
    if (getGistToken()) void runSync();
  };

  const handleSaveSync = async () => {
    const t = tokenDraft.trim();
    setGistToken(t);
    setGistId(gistIdDraft.trim());
    setSyncOpen(false);
    setMenuOpen(false);
    if (!t) {
      setSyncStatus("disabled");
      return;
    }
    // Merge remote in and push
    const local = storage.load();
    setItems(local);
    void runSync("loading");
  };

  const handleClearSync = () => {
    setGistToken("");
    setGistId("");
    setTokenDraft("");
    setGistIdDraft("");
    setSyncStatus("disabled");
    setSyncError(null);
    setSyncOpen(false);
    setMenuOpen(false);
  };

  useEffect(() => {
    if (addOpen) setTimeout(() => textareaRef.current?.focus(), 50);
  }, [addOpen]);

  const activeCount = useMemo(() => activeEntries(items).length, [items]);
  const showEmpty = hydrated && activeCount === 0;
  const wisdomText = current ?? "";

  const statusInfo: Record<SyncStatus, { color: string; label: string }> = {
    disabled: { color: "", label: "Sync not configured" },
    idle: { color: "bg-muted-foreground", label: "Sync idle" },
    loading: { color: "bg-amber-400 animate-pulse", label: "Fetching from Gist…" },
    syncing: { color: "bg-sky-400 animate-pulse", label: "Syncing…" },
    ok: { color: "bg-emerald-500", label: "Synced" },
    error: { color: "bg-red-500", label: syncError ?? "Sync error" },
  };
  const status = statusInfo[syncStatus];

  const menuItems = [
    {
      key: "add",
      label: "Add",
      icon: <Plus size={18} strokeWidth={2.2} />,
      onClick: () => {
        setAddOpen(true);
        closeMenu();
      },
      disabled: false,
      accent: false,
    },
    {
      key: "remove",
      label: "Remove",
      icon: <Trash2 size={18} strokeWidth={2} />,
      onClick: handleRemove,
      disabled: current === undefined,
      accent: false,
    },
    {
      key: "sync",
      label: "Sync",
      icon: <Cloud size={18} strokeWidth={2} />,
      onClick: () => {
        setTokenDraft(getGistToken());
        setGistIdDraft(getGistId());
        setSyncOpen(true);
        closeMenu();
      },
      disabled: false,
      dot: status.color,
    },
    ...(syncStatus !== "disabled"
      ? [
          {
            key: "syncnow",
            label:
              syncStatus === "syncing" || syncStatus === "loading"
                ? "Syncing…"
                : "Sync now",
            icon: (
              <RefreshCw
                size={18}
                strokeWidth={2}
                className={
                  syncStatus === "syncing" || syncStatus === "loading"
                    ? "animate-spin"
                    : ""
                }
              />
            ),
            onClick: () => {
              closeMenu();
              void runSync();
            },
            disabled:
              syncStatus === "loading" || syncStatus === "syncing",
          },
        ]
      : []),
  ];

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="flex items-center justify-between border-b border-border/60 px-5 py-4 sm:px-8">
        <h1 className="text-lg font-medium tracking-tight sm:text-xl">
          Remember&hellip;
        </h1>
        <div className="relative">
          <button
            type="button"
            aria-label={`${menuOpen && !menuClosing ? "Close" : "Open"} menu (${status.label})`}
            title={status.label}
            aria-expanded={menuOpen && !menuClosing}
            onClick={() => (menuOpen ? closeMenu() : setMenuOpen(true))}
            className="relative inline-flex h-11 w-11 items-center justify-center rounded-full border border-border/60 bg-card text-foreground/80 shadow-md shadow-black/5 transition-all duration-200 hover:scale-105 hover:text-foreground hover:shadow-lg active:scale-95"
          >
            <span
              className={`transition-all duration-200 ${menuOpen ? "rotate-90 scale-0 opacity-0" : "rotate-0 scale-100 opacity-100"}`}
            >
              <Menu size={20} strokeWidth={2} />
            </span>
            <span
              className={`absolute transition-all duration-200 ${menuOpen ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-0 opacity-0"}`}
            >
              <X size={20} strokeWidth={2} />
            </span>
            {status.color && !menuOpen && (
              <span
                className={`absolute right-0.5 top-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-card ${status.color}`}
                aria-hidden="true"
              />
            )}
          </button>
          {(menuOpen || menuClosing) && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={closeMenu}
                aria-hidden="true"
              />
              <div
                role="menu"
                className="absolute right-0 z-20 mt-3 flex flex-col items-end gap-2.5"
              >
                {menuItems.map((item, i) => (
                  <div
                    key={item.key}
                    className="flex items-center gap-2.5 opacity-0"
                    style={{
                      animation: `menu-item-in 260ms cubic-bezier(0.22, 1, 0.36, 1) forwards`,
                      animationDelay: `${i * 55}ms`,
                    }}
                  >
                    <span className="rounded-full bg-card/90 px-2.5 py-1 text-xs font-medium text-foreground/80 shadow-sm shadow-black/5 backdrop-blur">
                      {item.label}
                    </span>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={item.onClick}
                      disabled={item.disabled}
                      className="relative inline-flex h-11 w-11 items-center justify-center rounded-full border border-border/60 bg-card text-foreground/80 shadow-md shadow-black/5 transition-all duration-200 hover:scale-110 hover:text-foreground hover:shadow-lg active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
                    >
                      {item.icon}
                      {"dot" in item && item.dot && (
                        <span
                          className={`absolute right-0.5 top-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-card ${item.dot}`}
                          aria-hidden="true"
                        />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </header>


      <button
        type="button"
        onClick={advance}
        disabled={activeCount === 0}
        aria-label="Next wisdom"
        className="flex flex-1 cursor-pointer items-center justify-center px-6 py-12 text-center focus:outline-none disabled:cursor-default sm:px-12"
      >
        {showEmpty ? (
          <p className="max-w-2xl text-lg text-muted-foreground sm:text-xl">
            Your collection is empty. Open the menu to add a piece of wisdom.
          </p>
        ) : (
          <p className="max-w-3xl text-balance text-3xl font-medium leading-snug tracking-tight sm:text-4xl md:text-5xl lg:text-6xl">
            {wisdomText}
          </p>
        )}
      </button>

      {syncStatus === "error" && syncError && (
        <div className="border-t border-red-500/40 bg-red-500/10 px-5 py-2 text-center text-xs text-red-600 dark:text-red-400">
          {syncError}
        </div>
      )}

      {addOpen && (
        <div
          className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 px-4"
          onClick={() => setAddOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-lg border border-border bg-card p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-base font-medium">Add wisdom</h2>
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Something worth remembering&hellip;"
              rows={4}
              className="mt-3 w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") handleAdd();
              }}
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setAddOpen(false);
                  setDraft("");
                }}
                className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAdd}
                disabled={!draft.trim()}
                className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}

      {syncOpen && (
        <div
          className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 px-4"
          onClick={() => setSyncOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-lg border border-border bg-card p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-base font-medium">Sync via GitHub Gist</h2>
            <p className="mt-2 text-xs text-muted-foreground">
              Paste a{" "}
              <a
                href="https://github.com/settings/tokens/new?scopes=gist&description=Remember"
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                personal access token
              </a>{" "}
              with the <code className="font-mono">gist</code> scope. Your
              collection is merged with the remote by most-recent change per
              item.
            </p>
            <label className="mt-4 block text-xs font-medium text-muted-foreground">
              GitHub token
            </label>
            <input
              type="password"
              value={tokenDraft}
              onChange={(e) => setTokenDraft(e.target.value)}
              placeholder="ghp_…"
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <label className="mt-3 block text-xs font-medium text-muted-foreground">
              Gist ID <span className="opacity-60">(optional — auto-discovered)</span>
            </label>
            <input
              type="text"
              value={gistIdDraft}
              onChange={(e) => setGistIdDraft(e.target.value)}
              placeholder="e.g. 3a7f…"
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <div className="mt-4 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={handleClearSync}
                className="rounded-md px-3 py-2 text-xs text-muted-foreground hover:bg-muted"
              >
                Clear
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSyncOpen(false)}
                  className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveSync}
                  disabled={!tokenDraft.trim()}
                  className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
                >
                  Save & sync
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
