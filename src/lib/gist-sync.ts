import { mergeWisdom, type WisdomMap } from "./wisdom-storage";

const TOKEN_KEY = "remember.gist.token";
const GIST_ID_KEY = "remember.gist.id";
const GIST_FILENAME = "remember-wisdom.json";
const GIST_DESCRIPTION = "Remember — wisdom collection";

export function getGistToken(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(TOKEN_KEY) ?? "";
}
export function setGistToken(t: string) {
  if (typeof window === "undefined") return;
  if (t) window.localStorage.setItem(TOKEN_KEY, t);
  else window.localStorage.removeItem(TOKEN_KEY);
}
export function getGistId(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(GIST_ID_KEY) ?? "";
}
export function setGistId(id: string) {
  if (typeof window === "undefined") return;
  if (id) window.localStorage.setItem(GIST_ID_KEY, id);
  else window.localStorage.removeItem(GIST_ID_KEY);
}

interface GistFile {
  filename: string;
  content: string;
  truncated?: boolean;
  raw_url?: string;
}
interface GistResponse {
  id: string;
  description?: string;
  files: Record<string, GistFile>;
}

async function gh<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub ${res.status}: ${text || res.statusText}`);
  }
  return (await res.json()) as T;
}

async function fetchRemote(token: string, gistId: string): Promise<WisdomMap> {
  const gist = await gh<GistResponse>(`/gists/${gistId}`, token);
  const file = gist.files[GIST_FILENAME] ?? Object.values(gist.files)[0];
  if (!file) return {};
  let content = file.content;
  if (file.truncated && file.raw_url) {
    const r = await fetch(file.raw_url);
    content = await r.text();
  }
  try {
    const parsed = JSON.parse(content);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as WisdomMap;
    }
  } catch {
    /* ignore */
  }
  return {};
}

async function writeRemote(token: string, gistId: string, data: WisdomMap) {
  await gh(`/gists/${gistId}`, token, {
    method: "PATCH",
    body: JSON.stringify({
      files: { [GIST_FILENAME]: { content: JSON.stringify(data, null, 2) } },
    }),
  });
}

async function findExistingGist(token: string): Promise<string | null> {
  for (let page = 1; page <= 10; page++) {
    const gists = await gh<GistResponse[]>(`/gists?per_page=100&page=${page}`, token);
    if (!gists.length) break;
    const match = gists.find(
      (g) => g.description === GIST_DESCRIPTION || !!g.files?.[GIST_FILENAME],
    );
    if (match) return match.id;
    if (gists.length < 100) break;
  }
  return null;
}

async function createGist(token: string, data: WisdomMap): Promise<string> {
  const gist = await gh<GistResponse>(`/gists`, token, {
    method: "POST",
    body: JSON.stringify({
      description: GIST_DESCRIPTION,
      public: false,
      files: { [GIST_FILENAME]: { content: JSON.stringify(data, null, 2) } },
    }),
  });
  return gist.id;
}

export interface SyncResult {
  merged: WisdomMap;
  gistId: string;
  syncedAt: number;
}

/** Fetch remote, merge with local, push merged back. */
export async function syncWithGist(local: WisdomMap): Promise<SyncResult> {
  const token = getGistToken();
  if (!token) throw new Error("No GitHub token configured");

  let gistId = getGistId();
  let remote: WisdomMap = {};
  if (!gistId) {
    const found = await findExistingGist(token);
    if (found) {
      gistId = found;
      setGistId(found);
    }
  }
  if (gistId) remote = await fetchRemote(token, gistId);

  const merged = mergeWisdom(local, remote);

  if (!gistId) {
    gistId = await createGist(token, merged);
    setGistId(gistId);
  } else {
    await writeRemote(token, gistId, merged);
  }

  return { merged, gistId, syncedAt: Date.now() };
}
