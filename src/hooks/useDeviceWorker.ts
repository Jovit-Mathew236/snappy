import {
  addDeviceData,
  setDeviceConnected,
  setDeviceDisconnected,
  setDeviceError,
} from "@/app/redux/feature/deviceSlice";
import { useEffect, useRef } from "react";
import { useDispatch } from "react-redux";

export function useDeviceWorker() {
  const workerRef = useRef<Worker | null>(null);
  const dispatch = useDispatch();

  useEffect(() => {
    workerRef.current = new Worker(
      new URL("../workers/deviceWorker.ts", import.meta.url),
      {
        type: "module",
      }
    );

    workerRef.current.onmessage = (e) => {
      const { type, payload, error } = e.data;

      switch (type) {
        case "connected":
          dispatch(setDeviceConnected(payload));
          break;
        case "data":
          dispatch(addDeviceData(payload));
          break;
        case "disconnected":
          dispatch(setDeviceDisconnected());
          break;
        case "error":
          dispatch(setDeviceError(error));
          break;
      }
    };

    return () => {
      workerRef.current?.terminate();
    };
  }, [dispatch]);

  const connect = () => workerRef.current?.postMessage({ type: "connect" });
  const disconnect = () =>
    workerRef.current?.postMessage({ type: "disconnect" });

  return { connect, disconnect };
}
