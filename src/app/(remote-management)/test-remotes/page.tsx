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
  buttonPressed: string; // A, B, C, D, E, F, Y, N
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
      1: "A",
      2: "B", 
      3: "C",
      4: "D",
      5: "E",
      6: "F",
      7: "Y",
      8: "N"
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
                    // Include ALL remotes (including teacher remote - don't filter out index 0)
                    const matchingRemote = selectedReceiverData?.remotes.find(
                      (remote) => remote.remote_id === jsonData.MAC
                    );

                    if (matchingRemote && jsonData.value >= 1 && jsonData.value <= 8) {
                      const buttonPressed = mapValueToButton(jsonData.value);
                      const timestamp = Date.now();
                      
                      // Add to button presses history
                      setButtonPresses(prev => [
                        ...prev,
                        {
                          remoteId: matchingRemote.remote_id,
                          remoteName: matchingRemote.remote_name,
                          buttonPressed,
                          timestamp
                        }
                      ]);

                      // Update recent presses for visual feedback
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
      <div className="flex flex-col items-center justify-center min-h-[100vh] bg-[#E3E3E4] p-6 font-tthoves-medium">
        <div className="absolute z-0">
          <Image
            src={renderImg("dotgrid")}
            alt="Background grid"
            width={500}
            height={500}
          />
        </div>

        <div className="w-full max-w-4xl bg-white rounded-2xl shadow-md p-6 z-20">
          <h1 className="text-2xl text-[#0A0A0A] font-tthoves-semiBold mb-6">
            Select Receiver for Remote Testing
          </h1>

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}

          {receivers.length === 0 ? (
            <div className="text-[#4A4A4F] font-tthoves-medium text-center">
              No receivers found. Please add a receiver to get started.
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {receivers.map((receiver, index) => (
                <div
                  key={receiver.receiverID}
                  className={`bg-[#F0F0F0] rounded-xl p-4 cursor-pointer transition-colors ${
                    selectedReceiver === receiver.receiverID
                      ? "border-2 border-[#5423E6] bg-blue-50"
                      : "border-2 border-transparent hover:border-gray-300"
                  }`}
                  onClick={() => handleReceiverSelect(receiver.receiverID)}
                  role="button"
                  aria-label={`Select receiver ${receiver.receiverName || "Unnamed Receiver"}`}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="text-lg text-[#5423E6] font-tthoves-semiBold">
                        Receiver {index + 1}: {receiver.receiverName || "Unnamed Receiver"}
                      </h2>
                      <p className="text-sm text-[#4A4A4F] font-tthoves-regular">
                        Receiver ID: {receiver.receiverID}
                      </p>
                    </div>

                    <div className="flex items-center">
                      <Image
                        src={renderSvg("receiver")}
                        alt="Receiver icon"
                        className="w-12 h-12"
                        width={48}
                        height={48}
                      />
                      {selectedReceiver === receiver.receiverID && (
                        <button
                          className="bg-green-500 text-white rounded-full w-6 h-6 flex items-center justify-center ml-2"
                          aria-label="Current receiver selected"
                        >
                          ✓
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="ml-4">
                    <h3 className="text-md text-[#0A0A0A] font-tthoves-semiBold mb-2">
                      Remotes ({receiver.remotes.length})
                    </h3>

                    {receiver.remotes.length === 0 ? (
                      <p className="text-sm text-[#4A4A4F] font-tthoves-regular">
                        No remotes added to this receiver.
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {receiver.remotes.map((remote, remoteIndex) => (
                          <div
                            key={remote.remote_id}
                            className="bg-white rounded-lg px-3 py-2 text-sm shadow-sm"
                          >
                            <span className="font-tthoves-semiBold">
                              {remoteIndex === 0 ? "Teacher" : `Student ${remoteIndex}`}:
                            </span>{" "}
                            {remote.remote_name}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {selectedReceiver && (
                <div className="text-center pt-4">
                  <button
                    onClick={handleProceedToUSB}
                    className="bg-[#5423E6] text-white font-tthoves-semiBold py-3 px-8 rounded-lg hover:bg-[#4338CA] transition-colors duration-200 shadow-md"
                  >
                    Proceed to USB Connection
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
      <div className="flex flex-col items-center justify-center min-h-[100vh] bg-[#E3E3E4] p-6 font-tthoves-medium">
        <div className="absolute z-0">
          <Image
            src={renderImg("dotgrid")}
            alt="Background grid"
            width={500}
            height={500}
          />
        </div>

        <div className="w-full max-w-2xl bg-white rounded-2xl shadow-md p-8 z-20">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl text-[#0A0A0A] font-tthoves-semiBold">
              Connect USB Device
            </h1>
            <button
              onClick={handleBackToSelection}
              className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600"
            >
              Back to Selection
            </button>
          </div>

          <div className="text-center mb-6">
            <div className="mb-4">
              <h2 className="text-lg text-[#5423E6] font-tthoves-semiBold mb-2">
                Selected Receiver: {selectedReceiverData?.receiverName}
              </h2>
              <p className="text-sm text-[#4A4A4F]">
                {selectedReceiverData?.remotes.length} remotes will be tested
              </p>
            </div>
            
            <div className="flex flex-wrap justify-center gap-2 mb-6">
              {selectedReceiverData?.remotes.map((remote, index) => (
                <div key={remote.remote_id} className="bg-gray-100 rounded-lg px-3 py-1 text-sm">
                  <span className="font-tthoves-semiBold">
                    {index === 0 ? "Teacher" : `Student ${index}`}
                  </span>: {remote.remote_name}
                </div>
              ))}
            </div>
          </div>

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6 text-center">
              {error}
            </div>
          )}

          {usbConnected ? (
            <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-6 text-center">
              ✓ USB Connected Successfully!
            </div>
          ) : (
            <div className="text-center mb-6">
              <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded mb-4">
                <h3 className="font-tthoves-semiBold mb-2">Instructions:</h3>
                <ol className="text-left text-sm space-y-1">
                  <li>1. Ensure your USB receiver is connected to the computer</li>
                  <li>2. Make sure all remotes are powered on and in range</li>
                  <li>3. Click &apos;Connect USB Device&apos; below to establish connection</li>
                </ol>
              </div>
            </div>
          )}

          <div className="text-center">
            <button
              onClick={connectToUSBDevice}
              disabled={isLoading}
              className={`w-full py-4 px-6 rounded-lg font-tthoves-semiBold text-lg transition-colors duration-200 shadow-md ${
                usbConnected
                  ? "bg-green-500 text-white hover:bg-green-600"
                  : "bg-[#5423E6] text-white hover:bg-[#4338CA]"
              } ${isLoading ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              {isLoading ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Connecting...
                </div>
              ) : usbConnected ? (
                "Start Remote Testing"
              ) : (
                "Connect USB Device"
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Remote Testing Screen
  return (
    <div className="flex flex-col items-center justify-start min-h-[100vh] bg-[#E3E3E4] p-6 font-tthoves-medium">
      <div className="absolute z-0">
        <Image
          src={renderImg("dotgrid")}
          alt="Background grid"
          width={500}
          height={500}
        />
      </div>

      <div className="w-full max-w-6xl bg-white rounded-2xl shadow-md p-6 z-20">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl text-[#0A0A0A] font-tthoves-semiBold">
            Remote Testing - {selectedReceiverData?.receiverName}
          </h1>
          <div className="flex gap-2">
            <button
              onClick={handleBackToUSB}
              className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600"
            >
              Back to USB
            </button>
            <button
              onClick={handleBackToSelection}
              className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600"
            >
              Back to Selection
            </button>
          </div>
        </div>

        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-6">
          ✓ USB Connected - Press any button on your remotes to test (All remotes including Teacher remote)
        </div>

        <div className="space-y-4">
          {selectedReceiverData?.remotes.map((remote, index) => (
            <div key={remote.remote_id} className="bg-[#F0F0F0] rounded-xl p-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg text-[#5423E6] font-tthoves-semiBold">
                    {index === 0 ? "Teacher Remote" : `Student Remote ${index}`}: {remote.remote_name}
                  </h3>
                  <p className="text-sm text-[#4A4A4F] font-tthoves-regular">
                    MAC ID: {remote.remote_id}
                  </p>
                </div>
                <Image
                  src={renderSvg("remote")}
                  alt="Remote icon"
                  className="w-8 h-8"
                  width={32}
                  height={32}
                />
              </div>

              <div className="grid grid-cols-8 gap-3">
                {["A", "B", "C", "D", "E", "F", "Y", "N"].map((button) => (
                  <div
                    key={button}
                    className={`w-12 h-12 rounded-full flex items-center justify-center text-sm font-tthoves-semiBold transition-all duration-200 ${
                      isButtonPressed(remote.remote_id, button)
                        ? "bg-green-500 text-white scale-110 shadow-lg border-2 border-green-600"
                        : "bg-white text-[#4A4A4F] border-2 border-gray-300 hover:border-gray-400"
                    }`}
                  >
                    {button}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {buttonPresses.length > 0 && (
          <div className="mt-6">
            <h3 className="text-lg font-tthoves-semiBold mb-3">Recent Button Presses:</h3>
            <div className="bg-gray-50 rounded-lg p-4 max-h-40 overflow-y-auto">
              {buttonPresses.slice(-10).reverse().map((press, index) => (
                <div key={index} className="text-sm text-[#4A4A4F] mb-1">
                  <span className="font-tthoves-semiBold">{press.remoteName}</span> pressed 
                  <span className="mx-1 px-2 py-1 bg-blue-100 rounded text-xs">{press.buttonPressed}</span>
                  at {new Date(press.timestamp).toLocaleTimeString()}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TestRemotesPage;