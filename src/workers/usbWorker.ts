// src/workers/usbWorker.ts
/// <reference lib="webworker" />

import init, { decrypt } from "snappy-remote";

// Add custom NavigatorSerial interface for TypeScript

// Declare SerialPort type for Web Serial API
declare interface SerialPort {
  open(options: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
  getInfo(): {
    usbVendorId?: number;
    usbProductId?: number;
    usbSerialNumber?: string;
  };
  readable?: ReadableStream<Uint8Array>;
  writable?: WritableStream<Uint8Array>;
}

declare interface Serial {
  requestPort(options?: {
    filters?: Array<{ usbVendorId?: number; usbProductId?: number }>;
  }): Promise<SerialPort>;
}

interface NavigatorSerial extends Navigator {
  serial: Serial;
}

let port: SerialPort | null = null;
let serial_number: Uint8Array | null = null;

self.onmessage = async (event: MessageEvent) => {
  const { type, payload } = event.data;

  try {
    if (type === "INIT") {
      await init();
      self.postMessage({ type: "INIT_SUCCESS" });
    }

    if (type === "CONNECT") {
      console.log("Connecting...");
      const selectedPort = payload.port as SerialPort;

      if (!selectedPort) {
        throw new Error("Serial port not received in worker.");
      }

      await selectedPort.open({ baudRate: 9600 });

      const info = selectedPort.getInfo();
      const serialNumberStr = info.usbSerialNumber || "";
      serial_number = new Uint8Array(
        [...serialNumberStr].map((c) => c.charCodeAt(0))
      );

      port = selectedPort;

      self.postMessage({
        type: "CONNECTED",
        payload: {
          vendorId: info.usbVendorId,
          productId: info.usbProductId,
          serialNumber: info.usbSerialNumber,
        },
      });

      // Send start command
      const writer = port.writable?.getWriter();
      if (writer) {
        const command = new TextEncoder().encode("START\n");
        await writer.write(command);
        writer.releaseLock();
      }

      // start listening loop
      listenLoop();
    }

    if (type === "DISCONNECT") {
      if (port) {
        try {
          // Cancel and release reader if active
          if (port.readable) {
            const reader = port.readable.getReader();
            await reader.cancel();
            reader.releaseLock();
          }
          // Release writer if active
          if (port.writable) {
            const writer = port.writable.getWriter();
            writer.releaseLock();
          }
          await port.close();
        } catch (err: any) {
          console.error("Error closing port:", err);
        }
        self.postMessage({ type: "DISCONNECTED" });
      }
      port = null;
      serial_number = null;
    }
  } catch (err: any) {
    self.postMessage({ type: "ERROR", payload: err.message });
  }
};

async function listenLoop() {
  if (!port || !serial_number || !port.readable) return;

  const reader = port.readable.getReader();

  try {
    while (port.readable) {
      const { value, done } = await reader.read();
      if (done) {
        break;
      }
      if (value && value.length === 17) {
        const int8Array = value;
        const data = new Uint8Array([...int8Array.slice(0, 17)]);
        const answer = decrypt(serial_number, data);

        if (typeof answer === "string" && answer.trim().startsWith("{")) {
          try {
            const jsonData = JSON.parse(answer);
            self.postMessage({ type: "REMOTE_FOUND", payload: jsonData });
          } catch {
            // ignore bad JSON
          }
        }
      }
    }
  } catch (err: any) {
    self.postMessage({ type: "ERROR", payload: err.message });
  } finally {
    if (port.readable) {
      reader.releaseLock();
    }
  }
}
