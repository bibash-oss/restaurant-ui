import { NextRequest } from "next/server";
import fs from "fs";
import path from "path";
import { Readable } from "stream";

const MIME_TYPES: Record<string, string> = {
  ".pkg": "application/octet-stream",
  ".dmg": "application/x-apple-diskimage",
  ".exe": "application/vnd.microsoft.portable-executable",
  ".zip": "application/zip",
  ".tar.gz": "application/gzip",
  ".gz": "application/gzip",
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;
  const safeFilename = path.basename(filename);
  const filePath = path.join(
    process.cwd(),
    "public",
    "downloads",
    "print-agent",
    safeFilename
  );

  if (!fs.existsSync(filePath)) {
    return new Response(JSON.stringify({ error: "File not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const stat = fs.statSync(filePath);
  const ext = path.extname(safeFilename).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";

  const nodeStream = fs.createReadStream(filePath);
  const webStream = Readable.toWeb(nodeStream);

  return new Response(webStream as any, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${safeFilename}"`,
      "Content-Length": stat.size.toString(),
      "Cache-Control": "public, max-age=3600",
    },
  });
}
