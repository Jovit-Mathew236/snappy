"use client";
import { useSelector } from "react-redux";
import renderSvg from "@/svgImport";
import renderImg from "@/imgImport";
import React, { useState, useEffect, useRef } from "react";
import init, { decrypt } from "snappy-remote";
import Image from "next/image";
import { getOS } from "@/utils/getPlatform";

interface Remote {
  remote_name: string;
  remote_id: string;
}

interface Receiver {
  receiverName: string;
  receiverID: string;
  remotes: Remote[];
}

interface RootState {
  remote: {
    receivers: Receiver[];
    currentReceiver: string;
  };
}

interface RemoteButtonPress {
  remoteId: string;
  remoteName: string;
  buttonPressed: string;
  timestamp: number;
}

type ScreenState = "selection" | "usb-connection" | "testing";

const TestRemotesPage: React.FC = () => {
  const { receivers } = useSelector((state: RootState) => state.remote);
  const [selectedReceiver, setSelectedReceiver] = useState<string>("");
  const [screenState, setScreenState] = useState<ScreenState>("selection");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [usbConnected, setUsbConnected] = useState(false);
  const [buttonPresses, setButtonPresses] = useState<RemoteButtonPress[]>([]);
  const [recentPresses, setRecentPresses] = useState<{ [key: string]: { button: string; timestamp: number } }>({});
  
  const platform = getOS();
  const deviceRef = useRef<USBDevice | null>(null);
  const usbListeningRef = useRef<boolean>(false);

  const selectedReceiverData = receivers.find(r => r.receiverID === selectedReceiver);

  // Map button values to button names
  const mapValueToButton = (value: number): string => {
    const mapping: { [key: number]: string } = {
      1: "A", 2: "B", 3: "C", 4: "D", 5: "E", 6: "F", 7: "Y", 8: "N"
    };
    return mapping[value] || "";
  };

  // Initialize snappy-remote
  useEffect(() => {
    async function initialize() {
      try {
        await init();
      } catch (initError) {
        console.error("Initialization error:", initError);
        setError("Failed to initialize remote communication");
      }
    }
    initialize();
  }, []);

  // USB disconnect handler
  useEffect(() => {
    const handleDisconnect = () => {
      setUsbConnected(false);
      setError("USB device disconnected. Please reconnect to continue.");
      usbListeningRef.current = false;
      deviceRef.current = null;
      if (screenState === "testing") {
        setScreenState("usb-connection");
      }
    };

    navigator.usb.addEventListener("disconnect", handleDisconnect);
    return () => navigator.usb.removeEventListener("disconnect", handleDisconnect);
  }, [screenState]);

  async function getAndOpenDevice(): Promise<USBDevice> {
    try {
      const deviceInfo = JSON.parse(
        localStorage.getItem("currentDeviceInfo") || "{}"
      );
      if (!deviceInfo.vendorId || !deviceInfo.productId) {
        throw new Error("No device information found in localStorage.");
      }

      const devices = await navigator.usb.getDevices();
      const device = devices.find(
        (d) =>
          d.vendorId === deviceInfo.vendorId &&
          d.productId === deviceInfo.productId &&
          (!deviceInfo.serialNumber || d.serialNumber === deviceInfo.serialNumber)
      );

      if (!device) {
        throw new Error("Device not found or not authorized.");
      }

      if (!device.opened) {
        await device.open();
      }

      if (device.configuration === null) {
        await device.selectConfiguration(1);
      }

      await device.claimInterface(1);

      return device;
    } catch (error: unknown) {
      console.error("Error retrieving device:", error);
      throw error;
    }
  }

  async function connectToUSBDevice() {
    if (usbConnected && usbListeningRef.current) {
      setScreenState("testing");
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      if (!("usb" in navigator)) {
        throw new Error("Web USB API is not supported in this browser.");
      }

      deviceRef.current = await getAndOpenDevice();
      const serialNumber = deviceRef.current.serialNumber || "";
      const command = new TextEncoder().encode("START\n");
      const descriptorIndex = serialNumber ? 0 : 3;
      
      const result = await deviceRef.current.controlTransferIn(
        {
          requestType: "standard",
          recipient: "device",
          request: 0x06,
          value: (0x03 << 8) | descriptorIndex,
          index: 0x0409,
        },
        255
      );

      if (!result.data) {
        throw new Error("No data received from control transfer");
      }

      let serial_number: Uint8Array;
      if (platform === "windows") {
        const serialKey = new Uint8Array(result.data.buffer);
        const serialArray: number[] = [];
        for (let i = 2; i < serialKey.length; i += 2) {
          serialArray.push(serialKey[i]);
        }
        serial_number = new Uint8Array(serialArray);
      } else {
        const serialNumber = deviceRef.current.serialNumber || "";
        serial_number = new Uint8Array(
          [...serialNumber].map((char) => char.charCodeAt(0))
        );
      }

      await deviceRef.current.transferOut(2, command);

      setUsbConnected(true);
      setError(null);
      setIsLoading(false);
      usbListeningRef.current = true;
      setScreenState("testing");

      // Start listening for button presses
      while (usbListeningRef.current) {
        try {
          const result = await deviceRef.current.transferIn(2, 64);

          if (result.status === "ok" && result.data) {
            const int8Array = new Uint8Array(result.data.buffer);
            if (int8Array.length === 17) {
              const data = new Uint8Array([...int8Array.slice(0, 17)]);
              const answer = decrypt(serial_number, data);
              
              if (typeof answer === "string" && answer.trim().startsWith("{")) {
                try {
                  const jsonData: { MAC: string; value: number } = JSON.parse(answer);
                  
                  if (jsonData.MAC && jsonData.value !== undefined) {
                    const matchingRemote = selectedReceiverData?.remotes.find(
                      (remote) => remote.remote_id === jsonData.MAC
                    );

                    if (matchingRemote && jsonData.value >= 1 && jsonData.value <= 8) {
                      const buttonPressed = mapValueToButton(jsonData.value);
                      const timestamp = Date.now();
                      
                      setButtonPresses(prev => [
                        ...prev,
                        {
                          remoteId: matchingRemote.remote_id,
                          remoteName: matchingRemote.remote_name,
                          buttonPressed,
                          timestamp
                        }
                      ]);

                      setRecentPresses(prev => ({
                        ...prev,
                        [`${matchingRemote.remote_id}-${buttonPressed}`]: {
                          button: buttonPressed,
                          timestamp
                        }
                      }));
                    }
                  }
                } catch (parseError) {
                  console.error("JSON parse error:", parseError);
                }
              }
            }
          }
        } catch (transferError) {
          if (usbListeningRef.current) {
            console.error("Transfer error:", transferError);
          }
        }
      }
    } catch (error: unknown) {
      console.error("USB connection error:", error);
      setError(error instanceof Error ? error.message : "Failed to connect to USB device");
      setIsLoading(false);
    }
  }

  const handleReceiverSelect = (receiverID: string) => {
    setSelectedReceiver(receiverID);
  };

  const handleProceedToUSB = () => {
    if (!selectedReceiver) {
      setError("Please select a receiver first");
      return;
    }
    setError(null);
    setScreenState("usb-connection");
  };

  const handleBackToSelection = () => {
    usbListeningRef.current = false;
    if (deviceRef.current) {
      deviceRef.current.close().catch(console.error);
      deviceRef.current = null;
    }
    setUsbConnected(false);
    setScreenState("selection");
    setButtonPresses([]);
    setRecentPresses({});
    setError(null);
    setSelectedReceiver("");
  };

  const handleBackToUSB = () => {
    setScreenState("usb-connection");
  };

  const isButtonPressed = (remoteId: string, button: string): boolean => {
    return Boolean(recentPresses[`${remoteId}-${button}`]);
  };

  // Receiver Selection Screen
  if (screenState === "selection") {
    return (
      <div className="relative flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-purple-50/50 p-4 sm:p-6 font-tthoves-medium overflow-hidden">
        {/* Enhanced Background */}
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-50/40 via-purple-50/30 to-indigo-50/40" />
          <Image
            src={renderImg("dotgrid")}
            alt="Background grid"
            width={800}
            height={800}
            className="opacity-30"
          />
        </div>

        {/* Progress Indicator */}
        <div className="fixed top-6 left-1/2 transform -translate-x-1/2 z-30 bg-white/80 backdrop-blur-sm rounded-full px-6 py-3 shadow-lg border border-white/50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-500 rounded-full flex items-center justify-center text-white text-sm font-bold">1</div>
            <div className="text-sm font-medium text-slate-700">Select Receiver</div>
            <div className="w-4 h-0.5 bg-slate-300 rounded"></div>
            <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center text-slate-500 text-sm">2</div>
            <div className="w-4 h-0.5 bg-slate-300 rounded"></div>
            <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center text-slate-500 text-sm">3</div>
          </div>
        </div>

        <div className="w-full max-w-5xl bg-white/70 backdrop-blur-sm rounded-3xl shadow-2xl border border-white/50 p-8 z-20 relative overflow-hidden">
          {/* Header */}
          <div className="relative mb-8">
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 rounded-2xl" />
            <div className="relative p-6">
              <h1 className="text-3xl text-slate-900 font-tthoves-semiBold mb-2">
                Remote Testing Setup
              </h1>
              <p className="text-slate-600 font-tthoves-regular">
                Choose a receiver to test its connected remotes
              </p>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-xl shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <span className="font-medium">{error}</span>
              </div>
            </div>
          )}

          {/* Content */}
          {receivers.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-24 h-24 bg-gradient-to-br from-slate-100 to-slate-200 rounded-full mx-auto mb-6 flex items-center justify-center">
                <svg className="w-12 h-12 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-xl text-slate-700 font-tthoves-semiBold mb-2">
                No Receivers Available
              </h3>
              <p className="text-slate-500 font-tthoves-medium max-w-md mx-auto">
                Please add a receiver first before testing remotes
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {receivers.map((receiver, index) => (
                <div
                  key={receiver.receiverID}
                  className={`group relative bg-white/80 backdrop-blur-sm rounded-2xl p-6 transition-all duration-500 cursor-pointer border-2 hover:shadow-xl transform hover:scale-[1.02] ${
                    selectedReceiver === receiver.receiverID
                      ? "border-indigo-400 shadow-lg shadow-indigo-100 bg-gradient-to-br from-indigo-50/50 to-purple-50/30"
                      : "border-slate-200/50 hover:border-indigo-200"
                  }`}
                  onClick={() => handleReceiverSelect(receiver.receiverID)}
                  role="button"
                  aria-label={`Select receiver ${receiver.receiverName || "Unnamed Receiver"}`}
                >
                  {/* Selection Badge */}
                  {selectedReceiver === receiver.receiverID && (
                    <div className="absolute -top-2 -right-2 w-8 h-8 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg animate-pulse">
                      <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}

                  {/* Header */}
                  <div className="flex items-start justify-between mb-6">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center justify-center w-12 h-12 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl text-white font-bold text-lg shadow-lg">
                        {index + 1}
                      </div>
                      <div>
                        <h2 className="text-xl text-slate-800 font-tthoves-semiBold mb-1">
                          {receiver.receiverName || "Unnamed Receiver"}
                        </h2>
                        <p className="text-sm text-slate-500 font-mono">
                          ID: {receiver.receiverID}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <div className="w-2 h-2 bg-green-500 rounded-full" />
                          <span className="text-sm text-slate-600">{receiver.remotes.length} remotes available</span>
                        </div>
                      </div>
                    </div>

                    <div className="relative">
                      <Image
                        src={renderSvg("receiver")}
                        alt="Receiver icon"
                        className="w-16 h-16 group-hover:scale-110 transition-transform duration-300"
                        width={64}
                        height={64}
                      />
                      <div className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 rounded-full border-2 border-white animate-pulse" />
                    </div>
                  </div>

                  {/* Remotes Preview */}
                  <div className="pl-4 border-l-2 border-slate-100">
                    <div className="flex items-center gap-2 mb-3">
                      <h3 className="text-md text-slate-700 font-tthoves-semiBold">Remote Devices</h3>
                      <div className="px-2 py-1 bg-slate-100 rounded-full text-xs text-slate-600 font-medium">
                        {receiver.remotes.length}
                      </div>
                    </div>

                    {receiver.remotes.length === 0 ? (
                      <div className="py-4 text-center">
                        <p className="text-slate-500 text-sm">No remotes connected</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                        {receiver.remotes.map((remote, remoteIndex) => (
                          <div
                            key={remote.remote_id}
                            className="group/remote bg-gradient-to-br from-white to-slate-50/50 rounded-lg p-3 shadow-sm hover:shadow-md transition-all duration-300 border border-slate-100"
                          >
                            <div className="flex items-center gap-2 mb-2">
                              <div className={`w-2.5 h-2.5 rounded-full ${remoteIndex === 0 ? 'bg-amber-500' : 'bg-blue-500'}`} />
                              <span className="text-xs font-tthoves-semiBold text-slate-700">
                                {remoteIndex === 0 ? "Teacher" : `Student ${remoteIndex}`}
                              </span>
                            </div>
                            <p className="text-xs text-slate-600 mb-1 truncate">
                              {remote.remote_name || "Unnamed"}
                            </p>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1 text-xs text-green-600">
                                <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                                <span>Ready</span>
                              </div>
                              <Image
                                src={renderSvg("remote")}
                                alt="Remote"
                                className="w-4 h-4 opacity-60"
                                width={16}
                                height={16}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Proceed Button */}
              {selectedReceiver && (
                <div className="text-center pt-6">
                  <button
                    onClick={handleProceedToUSB}
                    className="group bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-tthoves-semiBold py-4 px-12 rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300 border border-white/20"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg">Proceed to USB Connection</span>
                      <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // USB Connection Screen
  if (screenState === "usb-connection") {
    return (
      <div className="relative flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 via-cyan-50/30 to-blue-50/50 p-4 sm:p-6 font-tthoves-medium overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-50/40 via-blue-50/30 to-indigo-50/40" />
          <Image
            src={renderImg("dotgrid")}
            alt="Background grid"
            width={800}
            height={800}
            className="opacity-30"
          />
        </div>

        {/* Progress Indicator */}
        <div className="fixed top-6 left-1/2 transform -translate-x-1/2 z-30 bg-white/80 backdrop-blur-sm rounded-full px-6 py-3 shadow-lg border border-white/50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white text-sm">✓</div>
            <div className="w-4 h-0.5 bg-green-500 rounded"></div>
            <div className="w-8 h-8 bg-cyan-500 rounded-full flex items-center justify-center text-white text-sm font-bold">2</div>
            <div className="text-sm font-medium text-slate-700">USB Connection</div>
            <div className="w-4 h-0.5 bg-slate-300 rounded"></div>
            <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center text-slate-500 text-sm">3</div>
          </div>
        </div>

        <div className="w-full max-w-3xl bg-white/70 backdrop-blur-sm rounded-3xl shadow-2xl border border-white/50 p-8 z-20 relative overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl text-slate-900 font-tthoves-semiBold mb-2">
                USB Device Connection
              </h1>
              <p className="text-slate-600">Connect your USB receiver to begin testing</p>
            </div>
            <button
              onClick={handleBackToSelection}
              className="group bg-slate-500 hover:bg-slate-600 text-white px-4 py-2 rounded-xl transition-all duration-200 shadow-md hover:shadow-lg"
            >
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 group-hover:-translate-x-1 transition-transform" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
                </svg>
                <span>Back</span>
              </div>
            </button>
          </div>

          {/* Selected Receiver Info */}
          <div className="mb-8 bg-gradient-to-r from-cyan-50 to-blue-50 rounded-2xl p-6 border border-cyan-100">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center text-white font-bold shadow-lg">
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl text-slate-800 font-tthoves-semiBold">
                  {selectedReceiverData?.receiverName}
                </h2>
                <p className="text-sm text-slate-600">
                  {selectedReceiverData?.remotes.length} remotes ready for testing
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {selectedReceiverData?.remotes.map((remote, index) => (
                <div key={remote.remote_id} className="bg-white/60 rounded-lg px-3 py-2 text-sm shadow-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <div className={`w-2 h-2 rounded-full ${index === 0 ? 'bg-amber-500' : 'bg-blue-500'}`} />
                    <span className="font-tthoves-semiBold">
                      {index === 0 ? "Teacher" : `Student ${index}`}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 truncate">{remote.remote_name}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Status Messages */}
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-xl shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <span className="font-medium">{error}</span>
              </div>
            </div>
          )}

          {usbConnected && (
            <div className="mb-6 bg-green-50 border border-green-200 text-green-700 px-6 py-4 rounded-xl shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <span className="font-medium">USB Connected Successfully!</span>
              </div>
            </div>
          )}

          {/* Instructions */}
          {!usbConnected && (
            <div className="mb-8 bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200 rounded-2xl p-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center text-white font-bold flex-shrink-0">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-tthoves-semiBold text-slate-800 mb-3">Connection Instructions</h3>
                  <div className="space-y-3 text-sm text-slate-700">
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 text-xs font-bold flex-shrink-0 mt-0.5">1</div>
                      <p>Ensure your USB receiver is securely connected to the computer</p>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 text-xs font-bold flex-shrink-0 mt-0.5">2</div>
                      <p>Make sure all remotes are powered on and within range</p>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 text-xs font-bold flex-shrink-0 mt-0.5">3</div>
                      <p>Click the connection button below to establish communication</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Connection Button */}
          <div className="text-center">
            <button
              onClick={connectToUSBDevice}
              disabled={isLoading}
              className={`group relative w-full py-6 px-8 rounded-2xl font-tthoves-semiBold text-lg transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 border border-white/20 ${
                usbConnected
                  ? "bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white"
                  : "bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white"
              } ${isLoading ? "opacity-75 cursor-not-allowed transform-none" : ""}`}
            >
              <div className="flex items-center justify-center gap-4">
                {isLoading ? (
                  <>
                    <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Establishing Connection...</span>
                  </>
                ) : usbConnected ? (
                  <>
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span>Start Remote Testing</span>
                    <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </>
                ) : (
                  <>
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                    <span>Connect USB Device</span>
                    <div className="w-2 h-2 bg-white rounded-full group-hover:animate-pulse"></div>
                  </>
                )}
              </div>
              
              {/* Loading overlay */}
              {isLoading && (
                <div className="absolute inset-0 bg-black/10 rounded-2xl flex items-center justify-center">
                  <div className="w-8 h-8 border-3 border-white/30 border-t-white rounded-full animate-spin"></div>
                </div>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Remote Testing Screen
  return (
    <div className="relative flex flex-col items-center justify-start min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50/30 to-teal-50/50 p-4 sm:p-6 font-tthoves-medium overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/40 via-teal-50/30 to-cyan-50/40" />
        <Image
          src={renderImg("dotgrid")}
          alt="Background grid"
          width={800}
          height={800}
          className="opacity-30"
        />
      </div>

      {/* Progress Indicator */}
      <div className="fixed top-6 left-1/2 transform -translate-x-1/2 z-30 bg-white/80 backdrop-blur-sm rounded-full px-6 py-3 shadow-lg border border-white/50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white text-sm">✓</div>
          <div className="w-4 h-0.5 bg-green-500 rounded"></div>
          <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white text-sm">✓</div>
          <div className="w-4 h-0.5 bg-green-500 rounded"></div>
          <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center text-white text-sm font-bold">3</div>
          <div className="text-sm font-medium text-slate-700">Testing Active</div>
        </div>
      </div>

      <div className="w-full max-w-7xl bg-white/70 backdrop-blur-sm rounded-3xl shadow-2xl border border-white/50 p-8 z-20 relative overflow-hidden mt-20">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl text-slate-900 font-tthoves-semiBold mb-2">
              Remote Testing Dashboard
            </h1>
            <p className="text-slate-600">
              Testing: <span className="font-semibold text-emerald-600">{selectedReceiverData?.receiverName}</span>
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleBackToUSB}
              className="group bg-slate-500 hover:bg-slate-600 text-white px-4 py-2 rounded-xl transition-all duration-200 shadow-md hover:shadow-lg"
            >
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                <span>USB</span>
              </div>
            </button>
            <button
              onClick={handleBackToSelection}
              className="group bg-slate-500 hover:bg-slate-600 text-white px-4 py-2 rounded-xl transition-all duration-200 shadow-md hover:shadow-lg"
            >
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 group-hover:-translate-x-1 transition-transform" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
                </svg>
                <span>Selection</span>
              </div>
            </button>
          </div>
        </div>

        {/* Status Banner */}
        <div className="mb-8 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-500 rounded-xl flex items-center justify-center text-white shadow-lg">
              <div className="w-3 h-3 bg-white rounded-full animate-pulse"></div>
            </div>
            <div>
              <h3 className="text-lg font-tthoves-semiBold text-emerald-800 mb-1">
                Testing Mode Active
              </h3>
              <p className="text-emerald-700">
                USB Connected - Press any button on your remotes to test (Including Teacher remote)
              </p>
            </div>
            <div className="ml-auto flex items-center gap-2 text-sm text-emerald-700">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
              <span>Live Testing</span>
            </div>
          </div>
        </div>

        {/* Remote Testing Cards */}
        <div className="space-y-6 mb-8">
          {selectedReceiverData?.remotes.map((remote, index) => (
            <div key={remote.remote_id} className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-white/50">
              {/* Remote Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold shadow-lg ${
                    index === 0 ? 'bg-gradient-to-r from-amber-500 to-orange-600' : 'bg-gradient-to-r from-blue-500 to-indigo-600'
                  }`}>
                    {index === 0 ? (
                      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    ) : (
                      <span className="text-lg">{index}</span>
                    )}
                  </div>
                  <div>
                    <h3 className="text-xl text-slate-800 font-tthoves-semiBold mb-1">
                      {index === 0 ? "Teacher Remote" : `Student Remote ${index}`}
                    </h3>
                    <p className="text-slate-600 mb-1">{remote.remote_name}</p>
                    <p className="text-xs text-slate-500 font-mono">MAC: {remote.remote_id}</p>
                  </div>
                </div>
                
                <div className="relative">
                  <Image
                    src={renderSvg("remote")}
                    alt="Remote icon"
                    className="w-10 h-10 opacity-80"
                    width={40}
                    height={40}
                  />
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white animate-pulse"></div>
                </div>
              </div>

              {/* Button Grid */}
              <div className="grid grid-cols-4 sm:grid-cols-8 gap-4">
                {["A", "B", "C", "D", "E", "F", "Y", "N"].map((button) => (
                  <div
                    key={button}
                    className={`relative aspect-square rounded-2xl flex items-center justify-center text-lg font-tthoves-semiBold transition-all duration-300 border-2 ${
                      isButtonPressed(remote.remote_id, button)
                        ? "bg-gradient-to-br from-emerald-400 to-teal-500 text-white scale-110 shadow-xl border-emerald-400 animate-pulse"
                        : "bg-gradient-to-br from-slate-50 to-slate-100 text-slate-600 border-slate-200 hover:border-slate-300 hover:shadow-md"
                    }`}
                  >
                    <span className="relative z-10">{button}</span>
                    {isButtonPressed(remote.remote_id, button) && (
                      <div className="absolute inset-0 bg-gradient-to-br from-emerald-400/20 to-teal-500/20 rounded-2xl animate-ping"></div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Activity Log */}
        {buttonPresses.length > 0 && (
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-white/50">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 bg-slate-600 rounded-lg flex items-center justify-center text-white">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <h3 className="text-xl font-tthoves-semiBold text-slate-800">Activity Log</h3>
              <div className="px-3 py-1 bg-slate-100 rounded-full text-sm text-slate-600 font-medium">
                {buttonPresses.length} presses
              </div>
            </div>
            
            <div className="bg-slate-50 rounded-xl p-4 max-h-48 overflow-y-auto">
              <div className="space-y-2">
                {buttonPresses.slice(-10).reverse().map((press, index) => (
                  <div key={index} className="flex items-center gap-3 p-3 bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow">
                    <div className="w-8 h-8 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center text-white text-sm font-bold">
                      {press.buttonPressed}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-tthoves-semiBold text-slate-800">{press.remoteName}</span>
                        <span className="text-sm text-slate-500">pressed button</span>
                        <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded text-sm font-medium">
                          {press.buttonPressed}
                        </span>
                      </div>
                    </div>
                    <div className="text-xs text-slate-500 font-mono">
                      {new Date(press.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
          <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl p-4 border border-emerald-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-500 rounded-lg flex items-center justify-center text-white">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <div className="text-2xl font-bold text-emerald-800">{selectedReceiverData?.remotes.length || 0}</div>
                <div className="text-sm text-emerald-600">Active Remotes</div>
              </div>
            </div>
          </div>
          
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center text-white">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M6.672 1.911a1 1 0 10-1.932.518l.259.966a1 1 0 001.932-.518l-.26-.966zM2.429 4.74a1 1 0 10-.517 1.932l.966.259a1 1 0 00.517-1.932l-.966-.26zm8.814-.569a1 1 0 00-1.415-1.414l-.707.707a1 1 0 101.415 1.414l.707-.707zm-7.071 7.072l.707-.707A1 1 0 003.465 9.12l-.708.707a1 1 0 001.415 1.415zm3.2-5.171a1 1 0 00-1.3 1.3l4 10a1 1 0 001.823.075l1.38-2.759 3.018 3.02a1 1 0 001.414-1.415l-3.019-3.02 2.76-1.379a1 1 0 00-.076-1.822l-10-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-800">{buttonPresses.length}</div>
                <div className="text-sm text-blue-600">Total Presses</div>
              </div>
            </div>
          </div>
          
          <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-4 border border-purple-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-500 rounded-lg flex items-center justify-center text-white">
                <div className="w-3 h-3 bg-white rounded-full animate-pulse"></div>
              </div>
              <div>
                <div className="text-2xl font-bold text-purple-800">Live</div>
                <div className="text-sm text-purple-600">Status</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Quick Stats */}
      <div className="fixed bottom-6 right-6 z-30 bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-white/50 p-4 min-w-56">
        <div className="text-center">
          <div className="text-lg font-bold text-slate-800 mb-2">Quick Stats</div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-xl font-bold text-emerald-600">{selectedReceiverData?.remotes.length}</div>
              <div className="text-slate-600">Remotes</div>
            </div>
            <div>
              <div className="text-xl font-bold text-blue-600">{buttonPresses.length}</div>
              <div className="text-slate-600">Presses</div>
            </div>
          </div>
          <div className="flex items-center justify-center gap-2 mt-3">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            <div className="text-xs text-slate-500">Testing Active</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TestRemotesPage;