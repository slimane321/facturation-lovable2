import { io, Socket } from "socket.io-client";

type SocketReadyPayload = {
  ok: boolean;
  socketId: string;
  userId: string | null;
};

const baseUrl =
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  "http://localhost:3001";

function getStoredToken(): string {
  return localStorage.getItem("fm_token") || "";
}

export const socket: Socket = io(baseUrl, {
  autoConnect: false,
  withCredentials: true,
  transports: ["websocket", "polling"],
  auth: {
    token: getStoredToken(),
  },
});

export function refreshSocketAuth() {
  socket.auth = {
    token: getStoredToken(),
  };
}

export function connectSocket() {
  refreshSocketAuth();

  if (!socket.connected) {
    socket.connect();
  }
}

export function disconnectSocket() {
  if (socket.connected) {
    socket.disconnect();
  }
}

export function reconnectSocket() {
  disconnectSocket();
  connectSocket();
}

socket.on("connect", () => {
  console.log("[socket] connected:", socket.id);
});

socket.on("disconnect", (reason) => {
  console.log("[socket] disconnected:", reason);
});

socket.on("connect_error", (error) => {
  console.error("[socket] connect_error:", error.message);
});

socket.on("socket.ready", (payload: SocketReadyPayload) => {
  console.log("[socket] ready:", payload);
});