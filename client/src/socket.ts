import { io } from "socket.io-client";

const SOCKET_URL =
  import.meta.env.VITE_SERVER_URL || "http://localhost:4000";

export const socket = io(SOCKET_URL, {
  autoConnect: true,
});

socket.on("connect", () => {
  console.log("Connected to SyncRoom server:", socket.id);
});

socket.on("disconnect", () => {
  console.log("Disconnected from SyncRoom server");
});