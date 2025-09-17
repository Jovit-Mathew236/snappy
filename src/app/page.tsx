"use client";
import Link from "next/link";
import { useDispatch } from "react-redux";
import { resetReceivers } from "./redux/feature/remoteSlice/remoteSlice";
import { useState } from "react";
import { getOS } from "@/utils/getPlatform";

export default function Home() {
  const [downloading, setDownloading] = useState(false);
  const dispatch = useDispatch();
  const platform = getOS();
  const downloadHandler = async () => {
    setDownloading(true);

    const url = "/api/download"; // Use the local API route
    try {
      const response = await fetch(url);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch file");
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = "snappy.exe"; // Set filename for download
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);

      // toast.success('Zadig.exe downloaded! Please run it to install the driver.');
    } catch (error: unknown) {
      console.error("Download failed:", error);

      // toast.error('Failed to download zadig.exe: ' + error.message);
    } finally {
      setDownloading(false);
    }
  };
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4 flex-col gap-6">
      {platform == "windows" && (
        <div className="text-red-600">
          Before adding a receiver, make sure to download and install the
          required driver.
        </div>
      )}
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
        <h1 className="text-2xl font-tthoves-bold text-gray-800 mb-6 text-center">
          Remote Control Management
        </h1>
        <div className="flex flex-col gap-4">
          {platform == "windows" && (
            <button
              className="w-full bg-[#5423E6] text-white font-tthoves-semiBold py-3 px-4 rounded-lg hover:bg-red-700 active:bg-red-800 transition-colors duration-200 shadow-md"
              disabled={downloading}
              onClick={downloadHandler}
            >
              {downloading ? "Downloading...." : "Download the driver"}
            </button>
          )}
          <Link href="/add-remote">
            <button
              onClick={() => dispatch(resetReceivers())}
              className="w-full bg-[#5423E6] text-white font-tthoves-semiBold py-3 px-4 rounded-lg hover:bg-red-700 active:bg-red-800 transition-colors duration-200 shadow-md"
            >
              Add Receiver And Remote
            </button>
          </Link>
          <Link href="/check-remotes">
            <button className="w-full bg-[#5423E6] text-white font-tthoves-semiBold py-3 px-4 rounded-lg hover:bg-red-700 active:bg-red-800 transition-colors duration-200 shadow-md">
              Check Remotes and Take Test
            </button>
          </Link>
          <Link href="/test-remotes">
            <button className="w-full bg-[#5423E6] text-white font-tthoves-semiBold py-3 px-4 rounded-lg hover:bg-red-700 active:bg-red-800 transition-colors duration-200 shadow-md">
              Test Remotes
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}
