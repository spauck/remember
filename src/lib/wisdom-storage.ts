export interface WisdomStorage {
  load(): string[];
  save(items: string[]): void;
}

const KEY = "remember.wisdom.v1";

export const localStorageWisdom: WisdomStorage = {
  load() {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem(KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter((s) => typeof s === "string") : [];
    } catch {
      return [];
    }
  },
  save(items) {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(KEY, JSON.stringify(items));
    } catch {
      /* ignore */
    }
  },
};

export const DEFAULT_WISDOM: string[] = [
  "Tap anywhere to reveal the next piece of wisdom.",
  "Use the menu to add your own wisdom to the collection.",
  "Use Remove in the menu to delete the wisdom you're currently viewing.",
];
