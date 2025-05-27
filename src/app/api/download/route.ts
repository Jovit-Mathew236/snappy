import { NextResponse } from "next/server";

export async function GET() {
  const url = "https://storage.googleapis.com/tinkerbunker/snappy.exe";

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error("Failed to fetch file from source");
    }

    const buffer = await response.arrayBuffer();

    // Set headers to trigger a file download
    const headers = new Headers({
      "Content-Disposition": "attachment; filename=zadig.exe",
      "Content-Type": "application/octet-stream",
      "Content-Length": buffer.byteLength.toString(),
    });

    return new NextResponse(buffer, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error("Proxy download failed:", error);
    return NextResponse.json(
      { error: "Failed to download file" },
      { status: 500 }
    );
  }
}
