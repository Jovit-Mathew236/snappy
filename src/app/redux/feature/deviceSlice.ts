import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface DeviceState {
  connected: boolean;
  error: string | null;
  deviceInfo: any;
  data: Uint8Array[];
}

const initialState: DeviceState = {
  connected: false,
  error: null,
  deviceInfo: null,
  data: [],
};

const deviceSlice = createSlice({
  name: "device",
  initialState,
  reducers: {
    setDeviceConnected(state, action: PayloadAction<any>) {
      state.connected = true;
      state.deviceInfo = action.payload;
      state.error = null;
    },
    setDeviceDisconnected(state) {
      state.connected = false;
      state.deviceInfo = null;
    },
    setDeviceError(state, action: PayloadAction<string>) {
      state.error = action.payload;
    },
    addDeviceData(state, action: PayloadAction<Uint8Array>) {
      state.data.push(action.payload);
    },
  },
});

export const { setDeviceConnected, setDeviceDisconnected, setDeviceError, addDeviceData } =
  deviceSlice.actions;

export default deviceSlice.reducer;
