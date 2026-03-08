import "dotenv/config";
import http from "node:http";
import jwt from "jsonwebtoken";
import { Server } from "socket.io";
import { createApp } from "./app";
import { setIo } from "./lib/socket";

type SocketAuthPayload = {
  sub: string;
  role: string;
  email: string;
  iat?: number;
  exp?: number;
};

function getAllowedOrigins() {
  return (process.env.CORS_ORIGIN ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function extractSocketToken(socket: any): string | null {
  const authToken = socket.handshake?.auth?.token;
  if (typeof authToken === "string" && authToken.trim()) {
    return authToken.trim();
  }

  const authorization =
    socket.handshake?.headers?.authorization ??
    socket.handshake?.auth?.authorization;

  if (typeof authorization === "string" && authorization.startsWith("Bearer ")) {
    return authorization.slice(7).trim();
  }

  return null;
}

function verifySocketToken(token: string): SocketAuthPayload | null {
  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error("JWT_SECRET missing");
    }

    return jwt.verify(token, secret) as SocketAuthPayload;
  } catch {
    return null;
  }
}

const app = createApp();
const server = http.createServer(app);

const allowedOrigins = getAllowedOrigins();

const io = new Server(server, {
  cors: {
    origin: allowedOrigins.length > 0 ? allowedOrigins : true,
    credentials: true,
  },
});

setIo(io);

io.use((socket, next) => {
  const token = extractSocketToken(socket);

  if (!token) {
    socket.data.user = null;
    return next();
  }

  const decoded = verifySocketToken(token);

  if (!decoded) {
    socket.data.user = null;
    return next();
  }

  socket.data.user = decoded;
  return next();
});

io.on("connection", (socket) => {
  const user = socket.data.user as SocketAuthPayload | null;

  if (user?.sub) {
    const roomName = `user:${user.sub}`;
    socket.join(roomName);
    console.log(`Socket connected: ${socket.id} -> ${roomName}`);
  } else {
    console.log(`Socket connected: ${socket.id} (anonymous/public realtime only)`);
  }

  socket.emit("socket.ready", {
    ok: true,
    socketId: socket.id,
    userId: user?.sub ?? null,
  });

  socket.on("ping", () => {
    socket.emit("pong", {
      at: new Date().toISOString(),
    });
  });

  socket.on("disconnect", (reason) => {
    console.log(`Socket disconnected: ${socket.id} (${reason})`);
  });
});

const port = Number(process.env.PORT ?? 3001);

server.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});