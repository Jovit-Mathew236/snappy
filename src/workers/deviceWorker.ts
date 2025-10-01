/// <reference lib="webworker" />

let stopListening = false;
let device: USBDevice | null = null;
let serial_number: Uint8Array | null = null;

// Import the wasm module - you'll need to handle this differently in workers
// For now, we'll send raw data to main thread for decryption

async function connectUSB(vendorId: number, productIds: number[]) {
  try {
    console.log("Requesting USB device...");

    // Request device access
    device = await navigator.usb.requestDevice({
      filters: productIds.map(pid => ({ vendorId, productId: pid }))
    });

    console.log("Device selected:", device);

    // Open device
    await device.open();
    
    // Select configuration if none selected
    if (device.configuration === null) {
      await device.selectConfiguration(1);
    }
    
    // Claim interface
    await device.claimInterface(1);

    // Save device info to localStorage (via main thread)
    const deviceInfo = {
      vendorId: device.vendorId,
      productId: device.productId,
      serialNumber: device.serialNumber || "",
    };
    
    self.postMessage({
      type: "DEVICE_INFO",
      payload: deviceInfo
    });

    // Get serial number via control transfer
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

    if (!result.data) {
      throw new Error("No data received from control transfer");
    }

    // Determine OS and process serial number accordingly
    const os = getOS();
    let serial_number_array: Uint8Array;
    
    if (os === "windows") {
      const serialKey = new Uint8Array(result.data.buffer);
      const serialArray: number[] = [];
      for (let i = 2; i < serialKey.length; i += 2) {
        serialArray.push(serialKey[i]);
      }
      serial_number_array = new Uint8Array(serialArray);
    } else {
      const serialNumber = device.serialNumber || "";
      serial_number_array = new Uint8Array(
        [...serialNumber].map((char) => char.charCodeAt(0))
      );
    }

    serial_number = serial_number_array;
    
    // Send serial number to main thread
    self.postMessage({
      type: "SERIAL_NUMBER",
      payload: Array.from(serial_number_array)
    });

    console.log("Serial number obtained:", Array.from(serial_number_array));

    // Send START command
    await device.transferOut(2, command);
    
    self.postMessage({ 
      type: "CONNECTED", 
      payload: { 
        vendorId: device.vendorId,
        productId: device.productId 
      } 
    });

    stopListening = false;

    // Start listening for data
    while (!stopListening && device) {
      try {
        const result = await device.transferIn(2, 64);
        
        if (result.status === "ok" && result.data) {
          const data = new Uint8Array(result.data.buffer);
          
          if (data.length === 17) {
            const packetData = new Uint8Array([...data.slice(0, 17)]);
            
            // Send both the data and serial number for decryption
            self.postMessage({ 
              type: "ENCRYPTED_DATA", 
              payload: {
                data: Array.from(packetData),
                serial_number: serial_number ? Array.from(serial_number) : null
              }
            });
          }
        }
      } catch (err: any) {
        if (!stopListening) {
          console.error('Transfer error:', err);
          self.postMessage({ 
            type: "ERROR", 
            payload: `Transfer error: ${err.message}` 
          });
        }
        break;
      }
    }

  } catch (err: any) {
    console.error('USB connection error:', err);
    
    if (err.name === 'NotFoundError') {
      self.postMessage({ 
        type: "ERROR", 
        payload: "No device selected or device not found" 
      });
    } else {
      self.postMessage({ 
        type: "ERROR", 
        payload: `Connection failed: ${err.message}` 
      });
    }
  }
}

// Function to get and open device from localStorage (like your getAndOpenDevice)
async function getAndOpenDeviceFromStorage(): Promise<USBDevice | null> {
  try {
    // Request stored device info from main thread
    self.postMessage({
      type: "REQUEST_DEVICE_INFO"
    });
    
    // We'll rely on main thread to send us the device info
    return null;
  } catch (error) {
    console.error("Error retrieving device from storage:", error);
    return null;
  }
}

function getOS(): string {
  const userAgent = navigator.userAgent;
  if (userAgent.includes('Windows')) return 'windows';
  if (userAgent.includes('Mac')) return 'mac';
  if (userAgent.includes('Linux')) return 'linux';
  return 'unknown';
}

async function disconnect() {
  stopListening = true;
  
  if (device) {
    try {
      await device.close();
      self.postMessage({ type: "DISCONNECTED" });
    } catch (err: any) {
      self.postMessage({ 
        type: "ERROR", 
        payload: `Disconnect error: ${err.message}` 
      });
    }
    device = null;
    serial_number = null;
  }
}

self.onmessage = async (e: MessageEvent) => {
  const { type, payload } = e.data;

  try {
    if (type === "CONNECT") {
      const os = getOS();
      console.log('Connecting via OS:', os);
      
      // Try to use stored device first, then request new one
      const storedDevice = await getAndOpenDeviceFromStorage();
      
      if (!storedDevice) {
        await connectUSB(payload.vendorId, payload.productIds);
      } else {
        device = storedDevice;
        // Continue with the existing device connection flow...
      }
    } 
    else if (type === "DISCONNECT") {
      await disconnect();
    }
    else if (type === "DEVICE_INFO_RESPONSE") {
      // Handle device info response from main thread
      if (payload && device) {
        // Continue with device setup...
      }
    }
  } catch (err: any) {
    self.postMessage({ 
      type: "ERROR", 
      payload: `Worker error: ${err.message}` 
    });
  }
};