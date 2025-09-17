"use client";
import { useSelector, useDispatch } from "react-redux";
import renderSvg from "@/svgImport";
import renderImg from "@/imgImport";
import React, { useState } from "react";
import Image from "next/image";
import { safeSetCurrentReceiver } from "@/app/redux/feature/remoteSlice/remoteSlice";

interface Remote {
  remote_name: string;
  remote_id: string;
}

interface Receiver {
  receiverName: string;
  receiverID: string;
  remotes: Remote[];
}

interface User {
  id?: string;
  name?: string;
  email?: string;
}

interface RootState {
  remote: {
    receivers: Receiver[];
    currentReceiver: string;
  };
  auth: {
    user: User | null;
  };
  receiver: {
    testID: string;
  };
}

const Page: React.FC = () => {
  const dispatch = useDispatch();
  const { receivers, currentReceiver } = useSelector(
    (state: RootState) => state.remote
  );
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleReceiverSelect = (receiverID: string) => {
    setIsLoading(true);
    setError(null);
    dispatch(safeSetCurrentReceiver(receiverID));
    setIsLoading(false);
  };

  return (
    <div className="relative flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-slate-100 p-4 sm:p-6 font-tthoves-medium overflow-hidden">
      {/* Enhanced Background */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50/30 via-purple-50/20 to-indigo-50/30" />
        <Image
          src={renderImg("dotgrid")}
          alt="Background grid"
          width={800}
          height={800}
          className="opacity-40"
        />
      </div>

      {/* Floating Debug Button */}
      <div
        className="absolute z-30 top-6 left-6 p-3 bg-white/80 backdrop-blur-sm rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer border border-white/50"
        onClick={async () => {
          const devices = await navigator.usb.getDevices();
          console.log(
            "Available devices:",
            devices.map((d) => ({
              vendorId: d.vendorId,
              productId: d.productId,
              serialNumber: d.serialNumber,
            }))
          );
        }}
      >
        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
      </div>

      {/* Enhanced Status Messages */}
      {error && (
        <div className="fixed top-4 right-4 z-40 bg-red-50 border border-red-200 text-red-700 px-6 py-3 rounded-xl shadow-lg animate-slide-in-right">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-red-500 rounded-full" />
            <span className="font-medium">{error}</span>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="fixed top-4 right-4 z-40 bg-blue-50 border border-blue-200 text-blue-700 px-6 py-3 rounded-xl shadow-lg animate-slide-in-right">
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <span className="font-medium">Connecting...</span>
          </div>
        </div>
      )}

      {/* Enhanced Test Button */}
      <a
        href="/test-screen"
        className="fixed top-6 right-6 z-30 group bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-tthoves-semiBold px-6 py-3 rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300 border border-white/20"
      >
        <div className="flex items-center gap-2">
          <span>Start Test</span>
          <div className="w-2 h-2 bg-white rounded-full group-hover:animate-pulse" />
        </div>
      </a>

      {/* Main Content Container */}
      <div className="w-full max-w-5xl bg-white/70 backdrop-blur-sm rounded-3xl shadow-2xl border border-white/50 p-8 z-20 relative overflow-hidden">
        {/* Header with Gradient */}
        <div className="relative mb-8">
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 rounded-2xl" />
          <div className="relative p-6">
            <h1 className="text-3xl text-slate-900 font-tthoves-semiBold mb-2">
              Device Management
            </h1>
            <p className="text-slate-600 font-tthoves-regular">
              Manage your receivers and connected remotes
            </p>
            <div className="absolute top-4 right-4 flex gap-2">
              <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse" />
              <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse" style={{ animationDelay: '0.5s' }} />
            </div>
          </div>
        </div>

        {/* Content Area */}
        {receivers.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-24 h-24 bg-gradient-to-br from-slate-100 to-slate-200 rounded-full mx-auto mb-6 flex items-center justify-center">
              <div className="w-12 h-12 border-2 border-slate-300 border-dashed rounded-full" />
            </div>
            <h3 className="text-xl text-slate-700 font-tthoves-semiBold mb-2">
              No Receivers Found
            </h3>
            <p className="text-slate-500 font-tthoves-medium max-w-md mx-auto">
              Get started by adding your first receiver to manage remote devices
            </p>
          </div>
        ) : (
          <div className="grid gap-6">
            {receivers.map((receiver, index) => (
              <div
                key={receiver.receiverID}
                className={`group relative bg-white/80 backdrop-blur-sm rounded-2xl p-6 transition-all duration-500 cursor-pointer border-2 hover:shadow-xl transform hover:scale-[1.02] ${
                  currentReceiver === receiver.receiverID
                    ? "border-indigo-400 shadow-lg shadow-indigo-100 bg-gradient-to-br from-indigo-50/50 to-purple-50/30"
                    : "border-slate-200/50 hover:border-indigo-200"
                }`}
                onClick={() => handleReceiverSelect(receiver.receiverID)}
                role="button"
                aria-label={`Select receiver ${receiver.receiverName || "Unnamed Receiver"}`}
              >
                {/* Selection Indicator */}
                {currentReceiver === receiver.receiverID && (
                  <div className="absolute -top-2 -right-2 w-6 h-6 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg animate-bounce">
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}

                {/* Receiver Header */}
                <div className="flex items-start justify-between mb-6">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl text-white font-bold shadow-lg">
                        {index + 1}
                      </div>
                      <div>
                        <h2 className="text-xl text-slate-800 font-tthoves-semiBold">
                          {receiver.receiverName || "Unnamed Receiver"}
                        </h2>
                        <p className="text-sm text-slate-500 font-tthoves-regular font-mono">
                          ID: {receiver.receiverID}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <div className="w-2 h-2 bg-green-500 rounded-full" />
                      <span>{receiver.remotes.length} remotes connected</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <Image
                        src={renderSvg("receiver")}
                        alt="Receiver icon"
                        className="w-14 h-14 group-hover:scale-110 transition-transform duration-300"
                        width={56}
                        height={56}
                      />
                      <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white animate-pulse" />
                    </div>
                  </div>
                </div>

                {/* Remotes Section */}
                <div className="pl-4 border-l-2 border-slate-100">
                  <div className="flex items-center gap-2 mb-4">
                    <h3 className="text-lg text-slate-700 font-tthoves-semiBold">Connected Remotes</h3>
                    <div className="px-2 py-1 bg-slate-100 rounded-full text-xs text-slate-600 font-medium">
                      {receiver.remotes.length}
                    </div>
                  </div>

                  {receiver.remotes.length === 0 ? (
                    <div className="py-8 text-center">
                      <div className="w-16 h-16 bg-slate-50 rounded-xl mx-auto mb-3 flex items-center justify-center">
                        <div className="w-8 h-8 border-2 border-slate-300 border-dashed rounded-lg" />
                      </div>
                      <p className="text-slate-500 font-tthoves-regular">
                        No remotes connected to this receiver
                      </p>
                    </div>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {receiver.remotes.map((remote, remoteIndex) => (
                        <div
                          key={remote.remote_id}
                          className="group/remote bg-gradient-to-br from-white to-slate-50/50 rounded-xl p-4 shadow-sm hover:shadow-md transition-all duration-300 border border-slate-100 hover:border-indigo-200 hover:scale-105"
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <div className={`w-3 h-3 rounded-full ${remoteIndex === 0 ? 'bg-amber-500' : 'bg-blue-500'}`} />
                                <span className="text-sm font-tthoves-semiBold text-slate-700">
                                  {remoteIndex === 0 ? "Teacher" : `Student ${remoteIndex}`}
                                </span>
                              </div>
                              <p className="text-sm text-slate-800 font-tthoves-regular mb-1">
                                {remote.remote_name || "Unnamed Remote"}
                              </p>
                              <p className="text-xs text-slate-500 font-mono break-all">
                                {remote.remote_id}
                              </p>
                            </div>
                            
                            <div className="relative">
                              <Image
                                src={renderSvg("remote")}
                                alt="Remote icon"
                                className="w-8 h-8 group-hover/remote:scale-110 transition-transform duration-300"
                                width={32}
                                height={32}
                              />
                              <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border border-white" />
                            </div>
                          </div>
                          
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-1 text-green-600">
                              <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                              <span>Connected</span>
                            </div>
                            <div className="text-slate-400">
                              Signal: Strong
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Floating Stats Card */}
      {receivers.length > 0 && (
        <div className="fixed bottom-6 right-6 z-30 bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-white/50 p-4 min-w-48">
          <div className="text-center">
            <div className="text-2xl font-bold text-slate-800 mb-1">
              {receivers.reduce((total, receiver) => total + receiver.remotes.length, 0)}
            </div>
            <div className="text-sm text-slate-600">Total Remotes</div>
            <div className="flex items-center justify-center gap-2 mt-2">
              <div className="w-2 h-2 bg-indigo-500 rounded-full" />
              <div className="text-xs text-slate-500">{receivers.length} Receivers</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Page;