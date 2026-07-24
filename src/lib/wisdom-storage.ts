export type WisdomOp = "add" | "delete";

export interface WisdomEntry {
  text: string;
  op: WisdomOp;
  updatedAt: number;
}

export type WisdomMap = Record<string, WisdomEntry>;

export interface WisdomStorage {
  load(): WisdomMap;
  save(items: WisdomMap): void;
}

const KEY = "remember.wisdom.v2";

export const localStorageWisdom: WisdomStorage = {
  load() {
    if (typeof window === "undefined") return {};
    try {
      const raw = window.localStorage.getItem(KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
      const out: WisdomMap = {};
      for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
        if (
          v &&
          typeof v === "object" &&
          typeof (v as WisdomEntry).text === "string" &&
          typeof (v as WisdomEntry).updatedAt === "number" &&
          ((v as WisdomEntry).op === "add" || (v as WisdomEntry).op === "delete")
        ) {
          out[k] = v as WisdomEntry;
        }
      }
      return out;
    } catch {
      return {};
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

export function randomKey(): string {
  const bytes = new Uint8Array(9);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(36).padStart(2, "0")).join("").slice(0, 12);
}

export const DEFAULT_WISDOM: WisdomMap = {
  "default-tap": {
    text: "Tap anywhere to reveal the next piece of wisdom.",
    op: "add",
    updatedAt: 0,
  },
  "default-add": {
    text: "Use the menu to add your own wisdom to the collection.",
    op: "add",
    updatedAt: 0,
  },
  "default-remove": {
    text: "Use Remove in the menu to delete the wisdom you're currently viewing.",
    op: "add",
    updatedAt: 0,
  },
};

/** CRDT-style merge: for each key, latest updatedAt wins; ties keep existing. */
export function mergeWisdom(a: WisdomMap, b: WisdomMap): WisdomMap {
  const out: WisdomMap = { ...a };
  for (const [k, v] of Object.entries(b)) {
    const cur = out[k];
    if (!cur || v.updatedAt > cur.updatedAt) out[k] = v;
  }
  return out;
}

export function activeEntries(map: WisdomMap): Array<[string, WisdomEntry]> {
  return Object.entries(map).filter(([, v]) => v.op === "add");
}
