"use client";
import { configureStore } from "@reduxjs/toolkit";
import { persistStore, persistReducer } from "redux-persist";
import storage from "redux-persist/lib/storage";
import remoteReducer from "./feature/remoteSlice/remoteSlice";
import deviceReducer from "./feature/deviceSlice"; // ✅ new slice

// Persist config (can be customized per slice)
const persistConfig = {
  key: "root",
  storage,
};

// Wrap reducers with persistence
const persistedRemoteReducer = persistReducer(persistConfig, remoteReducer);
const persistedDeviceReducer = persistReducer(
  { ...persistConfig, key: "device" }, // use different key
  deviceReducer
);

// Configure the store with persisted reducers
const store = configureStore({
  reducer: {
    remote: persistedRemoteReducer,
    device: persistedDeviceReducer, // ✅ new reducer
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false, // required for redux-persist
    }),
});

// Create the persistor
const persistor = persistStore(store);

// TypeScript types
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export { store, persistor };
