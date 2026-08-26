const GATEWAY = "https://connector-gateway.lovable.dev/google_drive";

export type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  size: number | null;
  modifiedTime: string | null;
  isFolder: boolean;
};

function keys() {
  const lovable = process.env["LOVABLE_API_KEY"];
  const connection = process.env["GOOGLE_DRIVE_API_KEY"];
  if (!lovable || !connection) {
    throw new Error("Google Drive is not connected for this project.");
  }
  return { lovable, connection };
}

async function driveFetch(path: string, init?: RequestInit) {
  const { lovable, connection } = keys();
  const res = await fetch(`${GATEWAY}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${lovable}`,
      "X-Connection-Api-Key": connection,
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    console.error(`Drive request failed [${res.status}] ${path}: ${body}`);
    throw new Error(`Drive request failed [${res.status}]: ${body.slice(0, 400)}`);
  }
  return res;
}

function escapeQuery(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

export async function listDriveFiles(opts: {
  search?: string | undefined;
  folderId?: string | undefined;
  pageToken?: string | undefined;
}): Promise<{ files: DriveFile[]; nextPageToken: string | null }> {
  const clauses = ["trashed = false"];
  const search = opts.search?.trim();
  if (search) clauses.push(`name contains '${escapeQuery(search)}'`);
  if (!search) clauses.push(`'${escapeQuery(opts.folderId || "root")}' in parents`);

  const params = new URLSearchParams({
    q: clauses.join(" and "),
    pageSize: "50",
    orderBy: "folder,modifiedTime desc,name",
    fields: "nextPageToken,files(id,name,mimeType,size,modifiedTime)",
    supportsAllDrives: "true",
    includeItemsFromAllDrives: "true",
  });
  if (opts.pageToken) params.set("pageToken", opts.pageToken);

  const res = await driveFetch(`/drive/v3/files?${params.toString()}`);
  const json = (await res.json()) as {
    nextPageToken?: string;
    files?: Array<{ id: string; name: string; mimeType: string; size?: string; modifiedTime?: string }>;
  };

  return {
    files: (json.files ?? []).map((f) => ({
      id: f.id,
      name: f.name,
      mimeType: f.mimeType,
      size: f.size ? Number(f.size) : null,
      modifiedTime: f.modifiedTime ?? null,
      isFolder: f.mimeType === "application/vnd.google-apps.folder",
    })),
    nextPageToken: json.nextPageToken ?? null,
  };
}

export async function getDriveFileMeta(fileId: string): Promise<DriveFile & { parents: string[] }> {
  const res = await driveFetch(
    `/drive/v3/files/${encodeURIComponent(fileId)}?fields=id,name,mimeType,size,modifiedTime,parents&supportsAllDrives=true`,
  );
  const f = (await res.json()) as {
    id: string;
    name: string;
    mimeType: string;
    size?: string;
    modifiedTime?: string;
    parents?: string[];
  };
  return {
    id: f.id,
    name: f.name,
    mimeType: f.mimeType,
    size: f.size ? Number(f.size) : null,
    modifiedTime: f.modifiedTime ?? null,
    isFolder: f.mimeType === "application/vnd.google-apps.folder",
    parents: f.parents ?? [],
  };
}

const MAX_PREVIEW_BYTES = 512_000;

export async function readDriveFileText(fileId: string) {
  const meta = await getDriveFileMeta(fileId);
  if (meta.isFolder) throw new Error("That item is a folder, not a file.");

  const isGoogleDoc = meta.mimeType.startsWith("application/vnd.google-apps");
  const path = isGoogleDoc
    ? `/drive/v3/files/${encodeURIComponent(fileId)}/export?mimeType=text/plain`
    : `/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`;

  const res = await driveFetch(path);
  const buffer = await res.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const truncated = bytes.byteLength > MAX_PREVIEW_BYTES;
  const slice = truncated ? bytes.subarray(0, MAX_PREVIEW_BYTES) : bytes;
  const text = new TextDecoder("utf-8", { fatal: false }).decode(slice);
  const printable = text.replace(/[^\t\n\r\x20-\x7e]/g, "").length / Math.max(text.length, 1);

  return {
    meta,
    isText: printable > 0.85,
    truncated,
    bytes: bytes.byteLength,
    text: printable > 0.85 ? text : "",
  };
}

/* ---------- Auto-match: guess the Claude download file ---------- */

const NAME_HINTS: Array<{ pattern: RegExp; points: number; why: string }> = [
  { pattern: /claude/i, points: 60, why: "name mentions Claude" },
  { pattern: /known-keys/i, points: 45, why: "matches known-keys patch file" },
  { pattern: /collect-news/i, points: 45, why: "matches collect-news patch file" },
  { pattern: /\bcms\b|cms\.server/i, points: 30, why: "matches cms.server patch file" },
  { pattern: /cinema/i, points: 30, why: "mentions cinema ingest" },
  { pattern: /ingest/i, points: 25, why: "mentions ingest" },
  { pattern: /patch|efficiency|fix/i, points: 20, why: "looks like a patch bundle" },
  { pattern: /handoff/i, points: 15, why: "mentions handoff" },
  { pattern: /\.(zip|tar|tgz|gz|7z)$/i, points: 25, why: "archive of files" },
  { pattern: /\.(ts|tsx|js|md|txt|json)$/i, points: 20, why: "source or text file" },
];

const NAME_PENALTIES: Array<{ pattern: RegExp; points: number }> = [
  { pattern: /\.(png|jpe?g|gif|heic|mp4|mov|pdf|xlsx?|docx?|pptx?)$/i, points: 45 },
  { pattern: /invoice|exhibit|receipt|backup|db_/i, points: 30 },
];

const SEARCH_TERMS = [
  "claude",
  "known-keys",
  "collect-news",
  "cms",
  "cinema",
  "ingest",
  "patch",
];

export type DriveMatch = DriveFile & { score: number; reasons: string[] };

export async function autoMatchDriveFile(): Promise<{
  best: DriveMatch | null;
  candidates: DriveMatch[];
  scanned: number;
}> {
  const seen = new Map<string, DriveFile>();

  const batches = await Promise.all(
    SEARCH_TERMS.map((term) =>
      listDriveFiles({ search: term }).catch(() => ({ files: [], nextPageToken: null })),
    ),
  );
  // Also consider whatever changed most recently, in case naming is unusual.
  const recent = await listDriveFiles({}).catch(() => ({ files: [], nextPageToken: null }));

  for (const batch of [...batches, recent]) {
    for (const file of batch.files) {
      if (!file.isFolder) seen.set(file.id, file);
    }
  }

  const now = Date.now();
  const scored: DriveMatch[] = [...seen.values()].map((file) => {
    const reasons: string[] = [];
    let score = 0;

    for (const hint of NAME_HINTS) {
      if (hint.pattern.test(file.name)) {
        score += hint.points;
        reasons.push(hint.why);
      }
    }
    for (const penalty of NAME_PENALTIES) {
      if (penalty.pattern.test(file.name)) score -= penalty.points;
    }

    const ageHours = file.modifiedTime
      ? (now - Date.parse(file.modifiedTime)) / 3_600_000
      : Number.POSITIVE_INFINITY;
    if (ageHours <= 6) {
      score += 35;
      reasons.push("modified in the last few hours");
    } else if (ageHours <= 48) {
      score += 20;
      reasons.push("modified in the last two days");
    } else if (ageHours <= 24 * 7) {
      score += 8;
    }

    if (file.size != null && file.size > 0 && file.size < 2_000_000) score += 5;

    return { ...file, score, reasons };
  });

  const candidates = scored
    .filter((f) => f.score > 0)
    .sort((a, b) => b.score - a.score || (b.modifiedTime ?? "").localeCompare(a.modifiedTime ?? ""))
    .slice(0, 6);

  return { best: candidates[0] ?? null, candidates, scanned: seen.size };
}
