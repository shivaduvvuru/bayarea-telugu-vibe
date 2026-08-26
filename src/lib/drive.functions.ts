import { createServerFn } from "@tanstack/react-start";

export const browseDrive = createServerFn({ method: "GET" })
  .validator((data: { search?: string; folderId?: string; pageToken?: string }) => data ?? {})
  .handler(async ({ data }) => {
    const { listDriveFiles } = await import("@/lib/drive.server");
    return listDriveFiles({
      search: data.search,
      folderId: data.folderId,
      pageToken: data.pageToken,
    });
  });

export const previewDriveFile = createServerFn({ method: "POST" })
  .validator((data: { fileId: string }) => {
    if (!data?.fileId) throw new Error("fileId is required");
    return { fileId: data.fileId };
  })
  .handler(async ({ data }) => {
    const { readDriveFileText } = await import("@/lib/drive.server");
    return readDriveFileText(data.fileId);
  });
