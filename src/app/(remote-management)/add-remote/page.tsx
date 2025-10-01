"use client";
import init, { decrypt } from "snappy-remote";
import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { getOS } from "@/utils/getPlatform";
import Image from "next/image";
import renderImg from "@/imgImport";
import renderSvg from "@/svgImport";
import {
 addReceiver,
 addRemote,
 deleteRemote,
 updateReceiverName,
 updateRemoteName,
} from "@/app/redux/feature/remoteSlice/remoteSlice";
import { useRouter } from "next/navigation";

interface Remote {
 remote_name: string;
 remote_id: string;
}
interface NavigatorUSB {
 usb: USBDevice;
}
interface Receiver {
 receiverName: string;
 receiverID: string;
 remotes: Remote[];
}

interface RootState {
 remote: {
   receivers: Receiver[];
 };
}

const ScanConnector: React.FC = () => {
 const dispatch = useDispatch();
 const receivers = useSelector((state: RootState) => state.remote.receivers);
 const [vendorId, setVendorId] = useState<number | null>(null);
 const [isConnecting, setIsConnecting] = useState(false);
 const [error, setError] = useState<string | null>(null);
 const [customName, setCustomName] = useState<string>("");
 const [isEditing, setIsEditing] = useState(false);
 const [successMessage, setSuccessMessage] = useState<string | null>(null);
 const [receiverId, setReceiverId] = useState<string | null>(null);
 const [studentRemotes, setStudentRemotes] = useState<Remote[]>([]);
 const [editingRemoteId, setEditingRemoteId] = useState<string | null>(null);
 const [summary, setSummary] = useState<boolean>(true);
 const [showReceiver, setShowReceiver] = useState<boolean>(false);
 const [showRemote, setShowRemote] = useState<boolean>(false);
 const [tempRemoteName, setTempRemoteName] = useState<string>("");
 const platform = getOS();
 const router = useRouter();

 useEffect(() => {
   async function initialize() {
     await init();
   }
   initialize();
 }, []);

useEffect(() => {
  const worker = new Worker(new URL("@/workers/usbWorker.ts", import.meta.url), {
    type: "module",
  });

  worker.postMessage({ type: "INIT" });

  worker.onmessage = (event) => {
    const { type, payload } = event.data;

    if (type === "INIT_SUCCESS") {
      console.log("Worker initialized");
    }
    if (type === "CONNECTED") {
      setVendorId(payload.vendorId);
      setShowReceiver(true);
    }
    if (type === "REMOTE_FOUND") {
      setStudentRemotes((prev) => {
        if (prev.some((r) => r.remote_id === payload.MAC)) return prev;
        return [...prev, { remote_id: payload.MAC, remote_name: "" }];
      });
    }
    if (type === "DISCONNECTED") {
      setVendorId(null);
      setStudentRemotes([]);
    }
    if (type === "ERROR") {
      setError(payload);
    }
  };

  return () => {
    worker.terminate();
  };
}, []);

 async function sendCommandAndListen(device: USBDevice) {
   try {
     await device.open();
     if (device.configuration === null) {
       await device.selectConfiguration(1);
     }
     await device.claimInterface(1);
     console.log(device);

     localStorage.setItem(
       "currentDeviceInfo",
       JSON.stringify({
         serialNumber: device.serialNumber,
         vendorId: device.vendorId,
         productId: device.productId,
       })
     );

     setVendorId(device.vendorId);
     const command = new TextEncoder().encode("START\n");
     const descriptorIndex = device.serialNumber ? 0 : 3;
     const result = await device.controlTransferIn(
       {
         requestType: "standard",
         recipient: "device",
         request: 0x06,
         value: (0x03 << 8) | descriptorIndex,
         index: 0x0409,
       },
       255
     );
     let serial_number: Uint8Array;
     if (platform === "windows") {
       if (!result.data) {
         throw new Error("No data received from controlTransferIn");
       }
       const serialKey = new Uint8Array(result.data.buffer);
       const serialArray: number[] = [];
       for (let i = 2; i < serialKey.length; i += 2) {
         serialArray.push(serialKey[i]);
       }
       serial_number = new Uint8Array(serialArray);
     } else {
       const serialNumber = device.serialNumber || "";
       serial_number = new Uint8Array(
         [...serialNumber].map((char) => char.charCodeAt(0))
       );
     }
     await device.transferOut(2, command);
     setShowReceiver(true);

     while (true) {
       const result = await device.transferIn(2, 64);
       if (result.status === "ok") {
         if (!result.data) {
           console.log("No data received from transferIn");
           continue;
         }
         const int8Array = new Uint8Array(result.data.buffer);
         if (int8Array.length === 17) {
           const data = new Uint8Array([...int8Array.slice(0, 17)]);
           const answer = decrypt(serial_number, data);
           if (typeof answer === "string" && answer.trim().startsWith("{")) {
             try {
               const jsonData = JSON.parse(answer);
               setStudentRemotes((prev) => {
                 if (
                   prev.some((remote) => remote.remote_id === jsonData?.MAC)
                 ) {
                   return prev;
                 }
                 return [
                   ...prev,
                   {
                     remote_name: "",
                     remote_id: jsonData?.MAC,
                   },
                 ];
               });
             } catch (parseError) {
               console.error("JSON parse error:", parseError);
             }
           }
         }
       } else {
         console.log("Transfer error:", result.status);
       }
     }
     throw new Error("Max iterations reached");
   } catch (error) {
     console.log("Error:", error);
     throw error;
   }
 }

 const handleScanAndConnect = async () => {
   setIsConnecting(true);
   setError(null);
   setSuccessMessage(null);
   try {
     if (!("usb" in navigator)) {
       throw new Error("Web USB API is not supported in this browser.");
     }
     const usbNavigator = navigator as Navigator & NavigatorUSB;
     const device = await usbNavigator.usb.requestDevice({
       filters: [{ vendorId: 0xb1b0, productId: 0x8055 },{ vendorId: 0xb1b0, productId: 0x5508 }],
     });
     await sendCommandAndListen(device);
   } catch (error) {
     setError("Failed to connect to the receiver. Please try again.");
     console.log("Connection error:", error);
   } finally {
     setIsConnecting(false);
   }
 };

 const handleEditClick = () => {
   setIsEditing(true);
 };

 const handleConfirmName = () => {
   console.log("Custom Name:", customName);
   if (receiverId) {
     dispatch(
       updateReceiverName({ receiverID: receiverId, receiverName: customName })
     );
     setIsEditing(false);
   }
   setIsEditing(false);
 };

 const handleEditRemoteClick = (remote_id: string, currentName: string) => {
   setEditingRemoteId(remote_id);
   setTempRemoteName(currentName);
 };

 const handleConfirmRemoteName = (remote_id: string) => {
   if (tempRemoteName.trim() && receiverId) {
     dispatch(
       updateRemoteName({
         receiverID: receiverId,
         remote_id,
         remote_name: tempRemoteName.trim(),
       })
     );
     setStudentRemotes((prev) =>
       prev.map((remote) =>
         remote.remote_id === remote_id
           ? { ...remote, remote_name: tempRemoteName.trim() }
           : remote
       )
     );
     setEditingRemoteId(null);
     setTempRemoteName("");
   }
 };

 const handleDeleteRemote = (remote_id: string) => {
   if (receiverId) {
     dispatch(deleteRemote({ receiverID: receiverId, remote_id }));
     setStudentRemotes((prev) =>
       prev.filter((remote) => remote.remote_id !== remote_id)
     );
   }
 };

 const receiverHandler = () => {
   try {
     const newReceiverID = new Date().toISOString();
     const name = customName.trim() || "Unnamed Receiver";
     dispatch(
       addReceiver({
         receiverName: name,
         receiverID: newReceiverID,
       })
     );
     setReceiverId(newReceiverID);
     setShowRemote(true);
     setShowReceiver(false);
     setSuccessMessage("Receiver created successfully!");
     setError(null);
   } catch (error) {
     console.log("Error creating receiver:", error);
     setError("Failed to create receiver. Please try again.");
     setSuccessMessage(null);
   }
 };

 const addRemoteHandler = () => {
   if (!receiverId) {
     setError("Receiver ID is missing.");
     return;
   }
   try {
     const currentReceiver = receivers.find(
       (r) => r.receiverID === receiverId
     );
     const existingRemoteIds = new Set(
       currentReceiver?.remotes.map((remote) => remote.remote_id) || []
     );

     const uniqueRemotes = studentRemotes.filter(
       (remote) => !existingRemoteIds.has(remote.remote_id)
     );

     setStudentRemotes((prev) => {
       const prevRemoteIds = new Set(prev.map((r) => r.remote_id));
       return [
         ...prev,
         ...uniqueRemotes.filter((r) => !prevRemoteIds.has(r.remote_id)),
       ];
     });

     uniqueRemotes.forEach((remote, index) => {
       dispatch(
         addRemote({
           receiverID: receiverId,
           remote: {
             remote_name: remote.remote_name || `Remote ${index + 1}`,
             remote_id: remote.remote_id,
           },
         })
       );
     });

     if (uniqueRemotes.length === 0 && studentRemotes.length > 0) {
       setError("All remotes are already added.");
       return;
     }

     setSuccessMessage("Remotes added successfully!");
     router.push("/");
     setError(null);
   } catch (error) {
     console.log("Error adding remotes:", error);
     setError("Failed to add remotes. Please try again.");
     setSuccessMessage(null);
   }
 };

 return (
   <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex flex-col items-center justify-center p-6 relative overflow-hidden">
     {/* Background decorative elements */}
     <div className="absolute inset-0 overflow-hidden">
       <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-purple-200 to-pink-200 rounded-full opacity-20 animate-pulse"></div>
       <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-br from-blue-200 to-cyan-200 rounded-full opacity-20 animate-pulse" style={{animationDelay: '1s'}}></div>
       <div className="absolute top-1/3 left-1/4 w-32 h-32 bg-gradient-to-br from-indigo-200 to-purple-200 rounded-full opacity-10 animate-bounce" style={{animationDelay: '2s'}}></div>
     </div>

     {/* Status Messages */}
     {error && (
       <div className="fixed top-6 right-6 bg-red-50 border-l-4 border-red-400 p-4 rounded-lg shadow-lg z-50 animate-slide-in">
         <div className="flex items-center">
           <svg className="w-5 h-5 text-red-400 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
           </svg>
           <span className="text-red-700 font-medium">{error}</span>
         </div>
       </div>
     )}
     
     {successMessage && (
       <div className="fixed top-6 right-6 bg-green-50 border-l-4 border-green-400 p-4 rounded-lg shadow-lg z-50 animate-slide-in">
         <div className="flex items-center">
           <svg className="w-5 h-5 text-green-400 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
           </svg>
           <span className="text-green-700 font-medium">{successMessage}</span>
         </div>
       </div>
     )}

     {summary ? (
       <div className="w-full max-w-6xl mx-auto z-10">
         {/* Header Section */}
         <div className="text-center mb-12 animate-fade-in">
           <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-4">
             Device Connection Hub
           </h1>
           <div className="space-y-2">
             <p className="text-xl text-gray-700 font-semibold">Start by connecting the receiver</p>
             <p className="text-gray-500">Ensure the receiver is properly connected before proceeding</p>
           </div>
         </div>

         {/* Main Connection Flow */}
         <div className="flex flex-col lg:flex-row items-center justify-center gap-12 lg:gap-16">
           {/* Receiver Section */}
           <div className="flex flex-col items-center space-y-6">
             <div className="relative group">
               <div 
                 className={`transition-all duration-500 ${
                   vendorId ? 'scale-75 opacity-75' : 'hover:scale-105'
                 } cursor-pointer`}
                 onClick={() => {
                   if (vendorId) {
                     setShowReceiver(!showReceiver);
                     setShowRemote(true);
                   }
                 }}
               >
                 <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-purple-500 rounded-full blur-lg opacity-30 group-hover:opacity-50 transition-opacity"></div>
                 <Image
                   src={renderImg("connector")}
                   alt="Receiver"
                   width={200}
                   height={200}
                   className="relative z-10 drop-shadow-lg"
                 />
               </div>
               {vendorId && (
                 <div className="absolute -top-2 -right-2 w-8 h-8 bg-green-500 rounded-full flex items-center justify-center animate-pulse">
                   <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                   </svg>
                 </div>
               )}
             </div>

             {!vendorId && (
               <button
                 className={`group relative overflow-hidden bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold py-4 px-8 rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300 ${
                   isConnecting ? "opacity-50 cursor-not-allowed" : ""
                 }`}
                 onClick={handleScanAndConnect}
                 disabled={isConnecting}
               >
                 <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
                 <div className="relative flex items-center gap-3">
                   {isConnecting ? (
                     <>
                       <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                         <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                         <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                       </svg>
                       <span>Connecting...</span>
                     </>
                   ) : (
                     <>
                       <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                       </svg>
                       <span>Scan & Connect</span>
                     </>
                   )}
                 </div>
               </button>
             )}
           </div>

           {/* Connection Arrow */}
           {showReceiver && (
             <div className="hidden lg:block animate-fade-in">
               <svg className="w-16 h-8 text-indigo-400 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
               </svg>
             </div>
           )}

           {/* Receiver Configuration Panel */}
           {showReceiver && (
             <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-xl border border-white/20 w-full max-w-md animate-slide-in">
               <div className="space-y-4">
                 <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                   <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                   Available Receiver
                 </h3>
                 
                 <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-3 rounded-lg">
                   <span className="text-sm text-gray-600">Vendor ID:</span>
                   <span className="ml-2 font-mono text-indigo-600 font-semibold">{vendorId}</span>
                 </div>

                 <div className="space-y-2">
                   <label className="text-sm font-medium text-gray-700">Receiver Name</label>
                   <div className="flex items-center gap-2">
                     {!isEditing ? (
                       <div className="flex items-center gap-2 flex-1">
                         <span className="flex-1 p-2 bg-gray-50 rounded-lg">{customName || "Unnamed Receiver"}</span>
                         <button
                           onClick={handleEditClick}
                           className="p-2 text-gray-400 hover:text-indigo-600 transition-colors"
                         >
                           <Image src={renderSvg("edit")} alt="Edit" width={20} height={20} />
                         </button>
                       </div>
                     ) : (
                       <div className="flex items-center gap-2 flex-1">
                         <input
                           type="text"
                           value={customName}
                           onChange={(e) => setCustomName(e.target.value)}
                           placeholder="Enter receiver name"
                           className="flex-1 p-2 border border-gray-300 rounded-lg focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-colors"
                           autoFocus
                         />
                         <button
                           onClick={handleConfirmName}
                           className="px-3 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition-colors"
                         >
                           Save
                         </button>
                       </div>
                     )}
                   </div>
                 </div>

                 <button
                   className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold py-3 rounded-xl hover:from-indigo-600 hover:to-purple-700 transition-all duration-300 transform hover:-translate-y-0.5 shadow-lg"
                   onClick={receiverHandler}
                 >
                   Save Receiver
                 </button>
               </div>
             </div>
           )}

           {/* Remote Section */}
           <div className="flex flex-col items-center space-y-6">
             <div className="relative group">
               <div className={`transition-all duration-500 ${showRemote ? 'scale-75 opacity-75' : ''}`}>
                 <div className="absolute inset-0 bg-gradient-to-r from-emerald-400 to-teal-500 rounded-full blur-lg opacity-30 group-hover:opacity-50 transition-opacity"></div>
                 <Image
                   src={renderImg("remote")}
                   alt="Remote"
                   width={200}
                   height={200}
                   className="relative z-10 drop-shadow-lg"
                 />
               </div>
               {studentRemotes.length > 0 && (
                 <div className="absolute -top-2 -right-2 w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center text-white font-bold text-sm animate-pulse">
                   {studentRemotes.length}
                 </div>
               )}
             </div>
           </div>

           {/* Remote Configuration Panel */}
           {showRemote && (
             <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-xl border border-white/20 w-full max-w-lg h-[500px] flex flex-col animate-slide-in">
               <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                 <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse"></div>
                 Available Remotes
               </h3>

               {studentRemotes.length === 0 ? (
                 <div className="flex-1 flex items-center justify-center">
                   <div className="text-center space-y-3">
                     <div className="w-16 h-16 bg-gradient-to-r from-gray-200 to-gray-300 rounded-full flex items-center justify-center mx-auto animate-pulse">
                       <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                       </svg>
                     </div>
                     <p className="text-gray-600">Press any button on your remotes to detect them</p>
                   </div>
                 </div>
               ) : (
                 <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                   {studentRemotes.map((remote, index) => (
                     <div key={remote.remote_id} className="space-y-2">
                       {index === 0 && (
                         <div className="text-sm font-semibold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-lg">
                           Teacher Remote
                         </div>
                       )}
                       {index === 1 && (
                         <div className="text-sm font-semibold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-lg">
                           Student Remotes
                         </div>
                       )}
                       
                       <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 hover:border-gray-300 transition-colors">
                         <div className="flex items-center justify-between mb-2">
                           {editingRemoteId === remote.remote_id ? (
                             <div className="flex items-center gap-2 flex-1">
                               <input
                                 type="text"
                                 value={tempRemoteName}
                                 onChange={(e) => setTempRemoteName(e.target.value)}
                                 placeholder="Enter remote name"
                                 className="flex-1 p-2 border border-gray-300 rounded-lg focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                                 autoFocus
                               />
                               {tempRemoteName.trim() && (
                                 <button
                                   onClick={() => handleConfirmRemoteName(remote.remote_id)}
                                   className="px-3 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition-colors"
                                 >
                                   Save
                                 </button>
                               )}
                             </div>
                           ) : (
                             <div className="flex items-center gap-2 flex-1">
                               <span className="font-medium text-gray-800">{remote.remote_name || "Unnamed Remote"}</span>
                               <button
                                 onClick={() => handleEditRemoteClick(remote.remote_id, remote.remote_name)}
                                 className="p-1 text-gray-400 hover:text-indigo-600 transition-colors"
                               >
                                 <Image src={renderSvg("edit")} alt="Edit" width={16} height={16} />
                               </button>
                             </div>
                           )}
                           <button
                             onClick={() => handleDeleteRemote(remote.remote_id)}
                             className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                           >
                             <Image src={renderSvg("trash")} alt="Delete" width={16} height={16} />
                           </button>
                         </div>
                         <div className="text-xs text-gray-500 font-mono bg-white px-2 py-1 rounded">
                           MAC: {remote.remote_id}
                         </div>
                       </div>
                     </div>
                   ))}
                 </div>
               )}

               <button
                 onClick={() => setSummary(false)}
                 className="w-full mt-4 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-semibold py-3 rounded-xl hover:from-emerald-600 hover:to-teal-700 transition-all duration-300 transform hover:-translate-y-0.5 shadow-lg"
               >
                 Continue
               </button>
             </div>
           )}
         </div>
       </div>
     ) : (
       /* Summary View */
       <div className="z-10 animate-fade-in">
         <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-2xl p-8 w-[600px] border border-white/20">
           <div className="flex justify-between items-center mb-6">
             <h2 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
               Device Summary
             </h2>
             <button
               onClick={() => setSummary(!summary)}
               className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
             >
               <Image src={renderSvg("cross")} alt="Close" width={24} height={24} />
             </button>
           </div>

           <div className="space-y-6">
             {/* Receiver Summary */}
             <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl">
               <div className="flex-shrink-0">
                 <Image src={renderImg("receiverA")} alt="Receiver" width={60} height={60} />
               </div>
               <div className="flex-1">
                 <h3 className="font-semibold text-gray-800">{customName || "Unnamed Receiver"}</h3>
                 <p className="text-gray-600">Vendor ID: <span className="font-mono">{vendorId || "Not Connected"}</span></p>
               </div>
               <div className="flex-shrink-0">
                 <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
               </div>
             </div>

             {/* Remote Summary */}
             <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl">
               <div className="flex-shrink-0">
                 <Image src={renderImg("remoteA")} alt="Remote" width={60} height={60} />
               </div>
               <div className="flex-1">
                 <h3 className="font-semibold text-gray-800">Remote Controls</h3>
                 <p className="text-gray-600">{studentRemotes.length} devices detected</p>
               </div>
               <div className="flex-shrink-0">
                 <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                   {studentRemotes.length}
                 </div>
               </div>
             </div>
           </div>

           {/* Action Buttons */}
           <div className="flex gap-4 mt-8">
             <button
               onClick={() => setSummary(!summary)}
               className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold py-3 px-6 rounded-xl transition-all duration-300 border border-gray-200"
             >
               Add More Devices
             </button>
             <button
               className="flex-1 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-300 transform hover:-translate-y-0.5 shadow-lg"
               onClick={addRemoteHandler}
             >
               Save & Continue
             </button>
           </div>
         </div>
       </div>
     )}

     <style jsx>{`
       @keyframes fade-in {
         from {
           opacity: 0;
           transform: translateY(20px);
         }
         to {
           opacity: 1;
           transform: translateY(0);
         }
       }

       @keyframes slide-in {
         from {
           opacity: 0;
           transform: translateX(-20px);
         }
         to {
           opacity: 1;
           transform: translateX(0);
         }
       }

       .animate-fade-in {
         animation: fade-in 0.6s ease-out;
       }

       .animate-slide-in {
         animation: slide-in 0.6s ease-out;
       }
     `}</style>
   </div>
 );
};

export default ScanConnector;