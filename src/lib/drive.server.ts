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
  search?: string;
  folderId?: string;
  pageToken?: string;
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
