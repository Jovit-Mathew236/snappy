"use client";
import { useSelector, useDispatch } from "react-redux";
import { addReceiver, addRemote } from "@/app/redux/feature/remoteSlice/remoteSlice";
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

interface LastButtonPress {
  button: string;
  timestamp: number;
}

interface PreviousButtonPress {
  button: string;
  timestamp: number;
}

type ScreenState = "selection" | "usb-connection" | "testing";

const TestRemotesPage: React.FC = () => {
  const dispatch = useDispatch();
  const { receivers } = useSelector((state: RootState) => state.remote);
  const [selectedReceiver, setSelectedReceiver] = useState<string>("");
  const [screenState, setScreenState] = useState<ScreenState>("selection");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [usbConnected, setUsbConnected] = useState(false);
  const [buttonPresses, setButtonPresses] = useState<RemoteButtonPress[]>([]);
  const [recentPresses, setRecentPresses] = useState<{ [key: string]: { button: string; timestamp: number } }>({});
  const [lastButtonPress, setLastButtonPress] = useState<{ [remoteId: string]: LastButtonPress }>({});
  const [previousButtonPress, setPreviousButtonPress] = useState<{ [remoteId: string]: PreviousButtonPress }>({});
  const [savedConfigurations, setSavedConfigurations] = useState<Receiver[]>([]);
  const [showReconnectOption, setShowReconnectOption] = useState(false);

  const platform = getOS();
  const deviceRef = useRef<USBDevice | null>(null);
  const usbListeningRef = useRef<boolean>(false);
  const timersRef = useRef<{ [remoteId: string]: NodeJS.Timeout }>({});
  const bufferAccumulatorRef = useRef<Uint8Array>(new Uint8Array(0));

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

  // Initialize snappy-remote and load saved configurations
  // Handle 3-second timer for button press persistence
  useEffect(() => {
    async function initialize() {
      try {
        await init();
        // Load saved receiver configurations from localStorage
        const savedConfigs = localStorage.getItem('savedReceiverConfigurations');
        if (savedConfigs) {
          const parsedConfigs: Receiver[] = JSON.parse(savedConfigs);
          setSavedConfigurations(parsedConfigs);
          // Check if we should show reconnect option
          if (parsedConfigs.length > 0 && receivers.length === 0) {
            setShowReconnectOption(true);
          }
        }
      } catch (initError) {
        console.error("Initialization error:", initError);
        setError("Failed to initialize remote communication");
      }
    }
    initialize();
  }, []);

  // USB disconnect handler
  useEffect(() => {
    interface USBDisconnectEvent extends Event {
      device?: USBDevice;
    }

    const handleDisconnect = (event: USBDisconnectEvent) => {
      console.log("USB disconnect event:", event);
      setUsbConnected(false);
      setError("USB device disconnected. Your remote configurations are saved and can be restored when you reconnect.");
      usbListeningRef.current = false; // Ensure this stops the loop
      deviceRef.current = null;
      if (screenState === "testing") {
        setScreenState("usb-connection");
      }
    };

    navigator.usb.addEventListener("disconnect", handleDisconnect);
    return () => navigator.usb.removeEventListener("disconnect", handleDisconnect);
  }, [screenState]);

  // Auto-save receiver configurations whenever they change
  useEffect(() => {
    if (receivers.length > 0) {
      localStorage.setItem('savedReceiverConfigurations', JSON.stringify(receivers));
      setShowReconnectOption(false);
    }
  }, [receivers]);
  useEffect(() => {
    Object.entries(lastButtonPress).forEach(([remoteId, press]) => {
      if (timersRef.current[remoteId]) {
        clearTimeout(timersRef.current[remoteId]);
      }

      timersRef.current[remoteId] = setTimeout(() => {
        setPreviousButtonPress(prev => ({
          ...prev,
          [remoteId]: { button: press.button, timestamp: press.timestamp }
        }));
        setLastButtonPress(prev => {
          const updated = { ...prev };
          delete updated[remoteId];
          return updated;
        });

        delete timersRef.current[remoteId];
      }, 3000);
    });

    return () => {
      Object.values(timersRef.current).forEach(timer => clearTimeout(timer));
      timersRef.current = {};
    };
  }, [lastButtonPress]);

  async function getAndOpenDevice(): Promise<USBDevice> {
    try {

      // First try to find device by vendor/product ID only (ignore serial number)
      const devices = await navigator.usb.getDevices();
      let device = devices.find(
        (d) =>
          d.vendorId === 0xb1b0 &&
          (d.productId === 0x8055 || d.productId === 0x5508)
      );

      // If device not found in authorized devices, request authorization
      if (!device) {
        console.log("Device not found in authorized devices, requesting authorization...");
        try {
          device = await navigator.usb.requestDevice({
            filters: [
              { vendorId: 0xb1b0, productId: 0x8055 },
              { vendorId: 0xb1b0, productId: 0x5508 }
            ],
          });

          // Update localStorage with the newly authorized device info (without serial number)
          localStorage.setItem(
            "currentDeviceInfo",
            JSON.stringify({
              vendorId: device.vendorId,
              productId: device.productId,
            })
          );
        } catch (requestError) {
          throw new Error("Device authorization was cancelled or failed. Please try again. " + requestError);
        }
      }

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
      bufferAccumulatorRef.current = new Uint8Array(0); // Reset buffer

      // ✅ FIXED LOOP - Start listening for button presses
      while (usbListeningRef.current && deviceRef.current) {
        try {
          // Check if device is still connected before transfer
          if (!deviceRef.current || !usbListeningRef.current) {
            break;
          }

          const result = await deviceRef.current.transferIn(2, 64);

          if (result.status === "ok" && result.data) {
            const incomingData = new Uint8Array(result.data.buffer);
            console.log(
              `incoming ${incomingData} length: ${incomingData.length}`
            );
            // Accumulate incoming data with previous buffer
            const combinedBuffer = new Uint8Array(bufferAccumulatorRef.current.length + incomingData.length);
            combinedBuffer.set(bufferAccumulatorRef.current, 0);
            combinedBuffer.set(incomingData, bufferAccumulatorRef.current.length);

            // Process messages by splitting on \r\n (13, 10)
            let startIndex = 0;

            for (let i = 0; i < combinedBuffer.length - 1; i++) {
              // Check for \r\n delimiter (13 = \r, 10 = \n)
              if (combinedBuffer[i] === 13 && combinedBuffer[i + 1] === 10) {
                // Extract message from startIndex to current position
                const messageLength = i - startIndex;

            if (messageLength === 17) {
              const data = new Uint8Array(combinedBuffer.slice(startIndex, i));
                  console.log("Processing 17-byte message:", data);

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

                      console.log(recentPresses)

                      // Update last button press for the specific remote
                      setLastButtonPress(prev => ({
                        ...prev,
                        [matchingRemote.remote_id]: { button: buttonPressed, timestamp }
                      }));
                    }
                  }
                } catch (parseError) {
                  console.error("JSON parse error:", parseError);
                }
              }
                } else if (messageLength > 0) {
                  console.log(`Skipping message with invalid length: ${messageLength} bytes (expected 17)`);
                }

                // Move start index past the \r\n delimiter
                startIndex = i + 2;
              }
            }

            // Save any remaining incomplete data for next iteration
            if (startIndex < combinedBuffer.length) {
              bufferAccumulatorRef.current = new Uint8Array(combinedBuffer.slice(startIndex));
              console.log(`Buffering ${bufferAccumulatorRef.current.length} bytes for next iteration`);
            } else {
              // All data processed, clear buffer
              bufferAccumulatorRef.current = new Uint8Array(0);
            }
          }
        } catch (transferError) {
          console.error("Transfer error:", transferError);
          // Check if it's a disconnect error
          if (transferError instanceof DOMException &&
            (transferError.name === 'NetworkError' || transferError.name === 'NotFoundError')) {
            console.log("Device disconnected during transfer");
            usbListeningRef.current = false;
            break;
          }
          // For other errors, continue but check if we should still be listening
          if (!usbListeningRef.current) {
            break;
          }
        }
      }
    } catch (error: unknown) {
      console.error("USB connection error:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to connect to USB device";

      if (errorMessage.includes("authorization was cancelled")) {
        setError("Device authorization was cancelled. Please click 'Connect USB Device' again and select your receiver from the list.");
      } else if (errorMessage.includes("not found or not authorized")) {
        setError("USB receiver not found. Please ensure it's connected and try again. You may need to authorize the device.");
      } else {
        setError(errorMessage);
      }
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
    setLastButtonPress({});
    setPreviousButtonPress({});
    setError(null);
    setSelectedReceiver("");
    bufferAccumulatorRef.current = new Uint8Array(0); // Clear buffer
  };

  const handleLoadSavedConfigurations = () => {
    // Restore saved configurations by dispatching Redux actions
    setError(null);
    try {
      savedConfigurations.forEach((receiver) => {
        // First add the receiver
        dispatch(addReceiver({
          receiverName: receiver.receiverName,
          receiverID: receiver.receiverID
        }));

        // Then add all remotes for this receiver
        receiver.remotes.forEach((remote) => {
          dispatch(addRemote({
            receiverID: receiver.receiverID,
            remote: {
              remote_name: remote.remote_name,
              remote_id: remote.remote_id
            }
          }));
        });
      });

      setShowReconnectOption(false);
      setError(null);

      // Show success message
      const totalRemotes = savedConfigurations.reduce((total, receiver) => total + receiver.remotes.length, 0);
      setError(null);
      console.log(`Successfully restored ${savedConfigurations.length} receiver(s) with ${totalRemotes} total remotes`);

    } catch (error) {
      console.error("Error loading saved configurations:", error);
      setError("Failed to load saved configurations. Please try again.");
    }
  };

  const handleBackToUSB = () => {
    setScreenState("usb-connection");
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

          {/* Show reconnect option if saved configurations exist */}
          {showReconnectOption && savedConfigurations.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-tthoves-semiBold text-blue-800 mb-2">
                    Saved Configurations Available
                  </h3>
                  <p className="text-sm text-blue-600">
                    Found {savedConfigurations.length} saved receiver configuration(s) with{" "}
                    {savedConfigurations.reduce((total, receiver) => total + receiver.remotes.length, 0)} total remotes.
                    Would you like to restore them?
                  </p>
                </div>
                <button
                  onClick={handleLoadSavedConfigurations}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-tthoves-semiBold"
                >
                  Load Saved
                </button>
              </div>
            </div>
          )}

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
                  className={`bg-[#F0F0F0] rounded-xl p-4 cursor-pointer transition-colors ${selectedReceiver === receiver.receiverID
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
              {error.includes("disconnected") && (
                <div className="mt-2">
                  <p className="text-sm mb-2">Don&apos;t worry! Your remote configurations are saved.</p>
                  <button
                    onClick={() => setScreenState("usb-connection")}
                    className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 text-sm"
                  >
                    Reconnect USB Device
                  </button>
                </div>
              )}
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
              className={`w-full py-4 px-6 rounded-lg font-tthoves-semiBold text-lg transition-colors duration-200 shadow-md ${usbConnected
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

  // Remote Testing Screen - Updated with compact cards
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

      <div className="w-full bg-white rounded-2xl shadow-md p-6 z-20">
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
          ✓ USB Connected - Press any button on your remotes to test
        </div>

        {/* Compact Remote Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-10 gap-4">
          {selectedReceiverData?.remotes.map((remote, index) => {
            const currentPress = lastButtonPress[remote.remote_id];
            const previousPress = previousButtonPress[remote.remote_id];

            return (
              <div
                key={remote.remote_id}
                className="bg-[#F8F9FA] border-2 border-gray-200 rounded-xl p-4 min-h-[160px] flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow"
              >
                {/* Remote Info */}
                <div className="text-center mb-3">
                  <div className="mb-2">
                    <Image
                      src={renderSvg("remote")}
                      alt="Remote icon"
                      className="w-8 h-8 mx-auto"
                      width={32}
                      height={32}
                    />
                  </div>
                  <h3 className="text-sm font-tthoves-bold text-[#0A0A0A] leading-tight">
                    {index === 0 ? "Teacher" : `Student ${index}`}
                  </h3>
                  <p className="text-xs font-tthoves-bold text-[#5423E6] mb-1">
                    {remote.remote_name}
                  </p>
                  <p className="text-xs font-tthoves-bold text-[#4A4A4F] break-all">
                    {remote.remote_id}
                  </p>
                </div>

                {/* Current Button Press Display */}
                <div className="flex-grow flex items-center justify-center mb-3">
                  {currentPress ? (
                    <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center text-white font-tthoves-bold text-lg shadow-lg animate-pulse">
                      {currentPress.button}
                    </div>
                  ) : (
                    <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center text-gray-400 font-tthoves-bold text-lg">
                      -
                    </div>
                  )}
                </div>

                {/* Previous Button Value */}
                <div className="text-center">
                  <p className="text-xs text-[#6B7280]">
                    Last: {previousPress ? (
                      <span className="font-tthoves-semiBold text-[#4A4A4F]">
                        {previousPress.button} ({new Date(previousPress.timestamp).toLocaleTimeString()})
                      </span>
                    ) : (
                      <span className="text-gray-400">None</span>
                    )}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Recent Activity Log */}
        {buttonPresses.length > 0 && (
          <div className="mt-6">
            <h3 className="text-lg font-tthoves-semiBold mb-3">Recent Activity:</h3>
            <div className="bg-gray-50 rounded-lg p-4 max-h-32 overflow-y-auto">
              {(() => {
                // Group consecutive duplicate presses with time dependency
                const groupedPresses: Array<{
                  remoteName: string;
                  buttonPressed: string;
                  count: number;
                  timestamp: number;
                  firstTimestamp: number;
                }> = [];

                const recentPresses = buttonPresses.slice(-20).reverse();
                // const TIME_WINDOW = 1000;

                recentPresses.forEach((press) => {
                  const lastGroup = groupedPresses[groupedPresses.length - 1];

                  // Check if this press is the same as the last group AND within time window
                  if (
                    lastGroup &&
                    lastGroup.remoteName === press.remoteName &&
                    lastGroup.buttonPressed === press.buttonPressed &&
                    (new Date(lastGroup.timestamp).toLocaleTimeString() === new Date(press.timestamp).toLocaleTimeString())
                  ) {
                    // Increment count for consecutive duplicate within time window
                    lastGroup.count++;
                    lastGroup.timestamp = press.timestamp; // Update to oldest timestamp in group
                  } else {
                    // Create new group
                    groupedPresses.push({
                      remoteName: press.remoteName,
                      buttonPressed: press.buttonPressed,
                      count: 1,
                      timestamp: press.timestamp,
                      firstTimestamp: press.timestamp,
                    });
                  }
                });

                return groupedPresses.slice(0, 8).map((group, index) => (
                  <div key={index} className="text-sm text-[#4A4A4F] mb-1 flex justify-between items-center">
                    <span>
                      <span className="font-tthoves-semiBold">{group.remoteName}</span> pressed
                      <span className="mx-1 px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-tthoves-semiBold">
                        {group.buttonPressed}
                      </span>
                      {group.count > 1 && (
                        <span className="ml-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-tthoves-semiBold">
                          ×{group.count}
                        </span>
                      )}
                    </span>
                    <span className="text-xs text-gray-500">
                      {new Date(group.firstTimestamp).toLocaleTimeString()}
                    </span>
                  </div>
                ));
              })()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TestRemotesPage;