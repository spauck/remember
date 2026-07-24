import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_WISDOM,
  localStorageWisdom,
  type WisdomStorage,
} from "@/lib/wisdom-storage";

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

function RememberPage() {
  const [items, setItems] = useState<string[]>([]);
  const [order, setOrder] = useState<number[]>([]);
  const [cursor, setCursor] = useState(0);
  const [hydrated, setHydrated] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load once
  useEffect(() => {
    let loaded = storage.load();
    if (loaded.length === 0) {
      loaded = DEFAULT_WISDOM;
      storage.save(loaded);
    }
    setItems(loaded);
    setOrder(shuffle(loaded.map((_, i) => i)));
    setCursor(0);
    setHydrated(true);
  }, []);

  // Persist
  useEffect(() => {
    if (hydrated) storage.save(items);
  }, [items, hydrated]);

  const currentIndex = order[cursor];
  const current =
    currentIndex !== undefined ? items[currentIndex] : undefined;

  const advance = useCallback(() => {
    if (items.length === 0) return;
    if (cursor + 1 >= order.length) {
      // New iteration; avoid repeating the last item as the first if possible
      let next = shuffle(items.map((_, i) => i));
      if (items.length > 1 && next[0] === order[cursor]) {
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
    const newItems = [...items, text];
    setItems(newItems);
    // Insert new item as next-up so user sees it, but keep iteration integrity
    const newIdx = newItems.length - 1;
    const rest = order.slice(cursor + 1);
    setOrder([...order.slice(0, cursor + 1), newIdx, ...rest]);
    setDraft("");
    setAddOpen(false);
    setMenuOpen(false);
  };

  const handleRemove = () => {
    if (current === undefined) return;
    const removeIdx = currentIndex;
    const newItems = items.filter((_, i) => i !== removeIdx);
    // Rebuild order: remove references and shift indices > removeIdx down by 1
    const newOrder = order
      .filter((i) => i !== removeIdx)
      .map((i) => (i > removeIdx ? i - 1 : i));
    setItems(newItems);
    if (newItems.length === 0) {
      setOrder([]);
      setCursor(0);
    } else {
      // Keep cursor position, but clamp; if past end, wrap to reshuffle
      if (cursor >= newOrder.length) {
        setOrder(shuffle(newItems.map((_, i) => i)));
        setCursor(0);
      } else {
        setOrder(newOrder);
      }
    }
    setMenuOpen(false);
  };

  useEffect(() => {
    if (addOpen) {
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  }, [addOpen]);

  const showEmpty = hydrated && items.length === 0;

  const wisdomText = useMemo(() => current ?? "", [current]);

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="flex items-center justify-between border-b border-border/60 px-5 py-4 sm:px-8">
        <h1 className="text-lg font-medium tracking-tight sm:text-xl">
          Remember&hellip;
        </h1>
        <div className="relative">
          <button
            type="button"
            aria-label="Open menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-foreground/80 transition hover:bg-muted hover:text-foreground"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="4" y1="7" x2="20" y2="7" />
              <line x1="4" y1="12" x2="20" y2="12" />
              <line x1="4" y1="17" x2="20" y2="17" />
            </svg>
          </button>
          {menuOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setMenuOpen(false)}
                aria-hidden="true"
              />
              <div
                role="menu"
                className="absolute right-0 z-20 mt-2 w-44 overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-lg"
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setAddOpen(true);
                    setMenuOpen(false);
                  }}
                  className="block w-full px-4 py-2.5 text-left text-sm hover:bg-muted"
                >
                  Add
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={handleRemove}
                  disabled={current === undefined}
                  className="block w-full px-4 py-2.5 text-left text-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Remove
                </button>
              </div>
            </>
          )}
        </div>
      </header>

      <button
        type="button"
        onClick={advance}
        disabled={items.length === 0}
        aria-label="Next wisdom"
        className="flex flex-1 cursor-pointer items-center justify-center px-6 py-12 text-center focus:outline-none disabled:cursor-default sm:px-12"
      >
        {showEmpty ? (
          <p className="max-w-2xl text-lg text-muted-foreground sm:text-xl">
            Your collection is empty. Open the menu to add a piece of wisdom.
          </p>
        ) : (
          <p className="max-w-3xl text-balance text-3xl font-light leading-snug tracking-tight sm:text-4xl md:text-5xl lg:text-6xl">
            {wisdomText}
          </p>
        )}
      </button>

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
    </div>
  );
}
