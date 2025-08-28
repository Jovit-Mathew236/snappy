"use client";
import { useSelector, useDispatch } from "react-redux";
import renderSvg from "@/svgImport";
import renderImg from "@/imgImport";
import React, { useState } from "react";
// import init, { decrypt } from "snappy-remote";
import Image from "next/image";
import { safeSetCurrentReceiver } from "@/app/redux/feature/remoteSlice/remoteSlice";
// import { getOS } from "@/utils/getPlatform";


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
 // Add other properties as needed
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


// interface DeviceInfo {
//   vendorId?: number;
//   productId?: number;
//   serialNumber?: string;
// }


const Page: React.FC = () => {
 const dispatch = useDispatch();
 const { receivers, currentReceiver } = useSelector(
   (state: RootState) => state.remote
 );
 const [error, setError] = useState<string | null>(null);
 const [isLoading, setIsLoading] = useState(false);
 // const [availableReceivers, setAvailableReceivers] = useState<string[]>([]);
 // const platform = getOS();
 // const [connectedDevice, setConnectedDevice] = useState<USBDevice | null>(
 //   null
 // );


 // useEffect(() => {
 //   async function initialize() {
 //     await init();
 //   }
 //   initialize();
 // }, []);


 // useEffect(() => {
 //   return () => {
 //     // Cleanup function that runs when component unmounts
 //     if (connectedDevice) {
 //       connectedDevice
 //         .close()
 //         .then(() => console.log("Device closed successfully"))
 //         .catch((err) => console.error("Error closing device:", err));
 //     }
 //   };
 // }, [connectedDevice]);


 // async function getAndOpenDevice() {
 //   try {
 //     const deviceInfo: DeviceInfo = JSON.parse(
 //       localStorage.getItem("currentDeviceInfo") || "{}"
 //     );
 //     if (!deviceInfo.vendorId || !deviceInfo.productId) {
 //       throw new Error("No device information found in localStorage.");
 //     }


 //     const devices = await navigator.usb.getDevices();
 //     const device = devices.find(
 //       (d: USBDevice) =>
 //         d.vendorId === deviceInfo.vendorId &&
 //         d.productId === deviceInfo.productId &&
 //         (!deviceInfo.serialNumber ||
 //           d.serialNumber === deviceInfo.serialNumber)
 //     );


 //     if (!device) {
 //       throw new Error("Device not found or not authorized.");
 //     }


 //     return device;
 //   } catch (error: unknown) {
 //     console.error("Error retrieving device:", error);
 //     throw error instanceof Error ? error : new Error(String(error));
 //   }
 // }


 // async function sendCommandAndListen() {
 //   let device: USBDevice | undefined;
 //   try {
 //     device = await getAndOpenDevice();


 //     // await device.open();
 //     // setConnectedDevice(device);
 //     console.log("Device opened");
 //     if (device.configuration === null) {
 //       await device.selectConfiguration(1);
 //     }
 //     await device.claimInterface(1);
 //     console.log("Interface claimed");
 //     const command = new TextEncoder().encode("START\n");
 //     const descriptorIndex = device.serialNumber ? 0 : 3;
 //     const result = await device.controlTransferIn(
 //       {
 //         requestType: "standard",
 //         recipient: "device",
 //         request: 0x06,
 //         value: (0x03 << 8) | descriptorIndex,
 //         index: 0x0409,
 //       },
 //       255
 //     );
 //     if (!result.data) {
 //       throw new Error("No data received from control transfer");
 //     }
 //     let serial_number: Uint8Array;
 //     if (platform === "windows") {
 //       const serialKey = new Uint8Array(result.data.buffer);
 //       const serialArray: number[] = [];
 //       for (let i = 2; i < serialKey.length; i += 2) {
 //         serialArray.push(serialKey[i]);
 //       }
 //       serial_number = new Uint8Array(serialArray);
 //     } else {
 //       const serialNumber = device.serialNumber || "";
 //       serial_number = new Uint8Array(
 //         [...serialNumber].map((char) => char.charCodeAt(0))
 //       );
 //     }
 //     await device.transferOut(2, command);
 //     console.log("Command sent");


 //     // const maxIterations = 1000;
 //     let iteration = 0;
 //     while (true) {
 //       const result = await device.transferIn(2, 64);
 //       console.log("Received data:", result);
 //       if (result.status === "ok" && result.data) {
 //         const int8Array = new Uint8Array(result.data.buffer);
 //         if (int8Array.length === 17) {
 //           const data = new Uint8Array([...int8Array.slice(0, 17)]);
 //           const answer = decrypt(serial_number, data);
 //           console.log("Decrypted answer:", answer);
 //           if (typeof answer === "string" && answer.trim().startsWith("{")) {
 //             try {
 //               const jsonData = JSON.parse(answer);
 //               console.log("Parsed JSON:", jsonData);
 //               if (jsonData?.MAC) {
 //                 setAvailableReceivers((prev) => {
 //                   if (!prev.includes(jsonData.MAC)) {
 //                     return [...prev, jsonData.MAC];
 //                   }
 //                   return prev;
 //                 });
 //               }
 //             } catch (parseError) {
 //               console.error("JSON parse error:", parseError);
 //             }
 //           }
 //         }
 //       } else {
 //         console.log("Transfer error:", result.status);
 //       }
 //       iteration++;
 //     }
 //     throw new Error("Max iterations reached");
 //   } catch (error: unknown) {
 //     console.error("Error in sendCommandAndListen:", error);
 //     setError(
 //       error instanceof Error
 //         ? error.message
 //         : "Failed to communicate with USB device"
 //     );
 //   }
 // }


 const handleReceiverSelect = (receiverID: string) => {
   setIsLoading(true);
   setError(null);
   // sendCommandAndListen().catch((err) => {
   //   setError(
   //     err instanceof Error ? err.message : "Failed to connect to device"
   //   );
   //   setIsLoading(false);
   // });
   dispatch(safeSetCurrentReceiver(receiverID));
   setIsLoading(false);
 };


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


     <div
       className="absolute z-10 top-4 left-4"
       onClick={async () => {
         // const deviceInfo = JSON.parse(
         //   localStorage.getItem("currentDeviceInfo") || "{}"
         // );
         const devices = await navigator.usb.getDevices();
         console.log(
           "Available devices:",
           devices.map((d) => ({
             vendorId: d.vendorId,
             productId: d.productId,
             serialNumber: d.serialNumber,
           }))
         );
         // const device = devices.find(
         //   (d) =>
         //     d.vendorId === deviceInfo.vendorId &&
         //     d.productId === deviceInfo.productId &&
         //     (!deviceInfo.serialNumber ||
         //       d.serialNumber === deviceInfo.serialNumber)
         // );
       }}
     ></div>


     {error && <div className="text-red-500 mb-4 z-20">{error}</div>}


     {isLoading && (
       <div className="text-[#4A4A4F] mb-4 z-20">Connecting...</div>
     )}
     <a
       href="/test-screen"
       className="text-md text-white font-tthoves-semiBold mb-2 p-4 bg-[#5423E6] z-50 rounded-xl"
     >
       Start test
     </a>
     <div className="w-full max-w-4xl bg-white rounded-2xl shadow-md p-6 z-20">
       <h1 className="text-2xl text-[#0A0A0A] font-tthoves-semiBold mb-6">
         Receivers and Remotes
       </h1>


       {receivers.length === 0 ? (
         <div className="text-[#4A4A4F] font-tthoves-medium text-center">
           No receivers found. Please add a receiver to get started.
         </div>
       ) : (
         <div className="flex flex-col gap-6">
           {receivers.map((receiver, index) => (
             <div
               key={receiver.receiverID}
               className={`bg-[#F0F0F0] rounded-xl p-4 ${
                 currentReceiver === receiver.receiverID
                   ? "border-2 border-[#5423E6]"
                   : ""
               }`}
               onClick={() => handleReceiverSelect(receiver.receiverID)}
               role="button"
               aria-label={`Select receiver ${
                 receiver.receiverName || "Unnamed Receiver"
               }`}
             >
               <div className="flex items-center justify-between mb-4">
                 <div>
                   <h2 className="text-lg text-[#5423E6] font-tthoves-semiBold">
                     Receiver {index + 1}:{" "}
                     {receiver.receiverName || "Unnamed Receiver"}
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
                   {currentReceiver === receiver.receiverID && (
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
                   Remotes
                 </h3>


                 {receiver.remotes.length === 0 ? (
                   <p className="text-sm text-[#4A4A4F] font-tthoves-regular">
                     No remotes added to this receiver.
                   </p>
                 ) : (
                   <div className="flex flex-col gap-2">
                     {receiver.remotes.map((remote, remoteIndex) => (
                       <div
                         key={remote.remote_id}
                         className={`flex items-center justify-between bg-white rounded-lg p-3 shadow-sm
                        
                             `}
                       >
                         <div>
                           <p className="text-[#0A0A0A] font-tthoves-regular">
                             {remoteIndex === 0
                               ? "Teacher Remote"
                               : `Student Remote ${remoteIndex}`}
                             : {remote.remote_name || "Unnamed Remote"}
                           </p>
                           <p className="text-sm text-[#4A4A4F] font-tthoves-regular">
                             MAC ID: {remote.remote_id}
                           </p>
                         </div>
                         <div className="flex items-center">
                           <Image
                             src={renderSvg("remote")}
                             alt="Remote icon"
                             className="w-8 h-8"
                             width={32}
                             height={32}
                           />
                           {/* {availableReceivers.includes(remote.remote_id) && (
                             <button
                               className="bg-green-500 text-white rounded-full w-6 h-6 flex items-center justify-center ml-2"
                               aria-label="Remote connected"
                             >
                               ✓
                             </button>
                           )} */}
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
   </div>
 );
};


export default Page;