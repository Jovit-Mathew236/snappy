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
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-4 flex-col gap-8">
      {/* Header Section */}
      <div className="text-center max-w-2xl">
        <h1 className="text-5xl font-extrabold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-4">
          Remote Control Hub
        </h1>
        <p className="text-lg text-gray-600 leading-relaxed">
          Manage your remote control devices with ease. Set up receivers,
          configure remotes, and run diagnostic tests.
        </p>
      </div>

      {/* Warning Banner for Windows */}
      {platform === "windows" && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-l-4 border-amber-400 p-6 rounded-xl shadow-lg max-w-2xl w-full animate-pulse">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg
                className="h-6 w-6 text-amber-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-amber-800 font-medium">
                <span className="font-bold">Windows Users:</span> Please
                download and install the required driver before adding a
                receiver.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Main Card */}
      <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-2xl p-10 max-w-md w-full border border-white/20 hover:shadow-3xl transition-all duration-300">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            Control Center
          </h2>
          <p className="text-gray-600">Choose an action to get started</p>
        </div>

        <div className="flex flex-col gap-4">
          {/* Download Driver Button (Windows only) */}
          {platform === "windows" && (
            <button
              className="group relative w-full bg-gradient-to-r from-red-500 to-red-600 text-white font-semibold py-4 px-6 rounded-xl hover:from-red-600 hover:to-red-700 active:from-red-700 active:to-red-800 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none overflow-hidden"
              disabled={downloading}
              onClick={downloadHandler}
            >
              {/* Shimmer effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>

              <div className="relative flex items-center justify-center gap-3">
                {downloading ? (
                  <>
                    <svg
                      className="animate-spin h-5 w-5 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    <span>Downloading...</span>
                  </>
                ) : (
                  <>
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    <span>Download Driver</span>
                  </>
                )}
              </div>
            </button>
          )}

          {/* Add Receiver Button */}
          <Link href="/add-remote">
            <button
              onClick={() => dispatch(resetReceivers())}
              className="group relative w-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold py-4 px-6 rounded-xl hover:from-indigo-600 hover:to-purple-700 active:from-indigo-700 active:to-purple-800 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-1 overflow-hidden"
            >
              {/* Shimmer effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>

              <div className="relative flex items-center justify-center gap-3">
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                  />
                </svg>
                <span>Add Receiver & Remote</span>
              </div>
            </button>
          </Link>

          {/* Check Remotes Button */}
          <Link href="/check-remotes">
            <button className="group relative w-full bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-semibold py-4 px-6 rounded-xl hover:from-emerald-600 hover:to-teal-700 active:from-emerald-700 active:to-teal-800 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-1 overflow-hidden">
              {/* Shimmer effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>

              <div className="relative flex items-center justify-center gap-3">
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span>Check Remotes & Test</span>
              </div>
            </button>
          </Link>
          <Link href="/test-remotes">
            <button className="w-full bg-[#5423E6] text-white font-tthoves-semiBold py-3 px-4 rounded-lg hover:bg-red-700 active:bg-red-800 transition-colors duration-200 shadow-md">
              Test Remotes
            </button>
          </Link>
        </div>

        {/* Footer info */}
        <div className="mt-8 pt-6 border-t border-gray-200">
          <p className="text-xs text-gray-500 text-center">
            Need help? Check our documentation for setup guides and
            troubleshooting.
          </p>
        </div>
      </div>

      {/* Floating decorative elements */}
      <div
        className="absolute top-20 left-10 w-20 h-20 bg-indigo-200 rounded-full opacity-20 animate-bounce"
        style={{ animationDelay: "0s" }}
      ></div>
      <div
        className="absolute bottom-20 right-10 w-16 h-16 bg-purple-200 rounded-full opacity-20 animate-bounce"
        style={{ animationDelay: "1s" }}
      ></div>
      <div
        className="absolute top-1/3 right-20 w-12 h-12 bg-pink-200 rounded-full opacity-20 animate-bounce"
        style={{ animationDelay: "2s" }}
      ></div>
    </div>
  );
}
