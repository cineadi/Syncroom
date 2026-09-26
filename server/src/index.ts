import multer from "multer";
import path from "path";
import fs from "fs";
import express from "express";
import http from "http";
import cors from "cors";
import { Server } from "socket.io";

const uploadDir = path.join(process.cwd(), "uploads");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },

  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);

    const uniqueName =
      `${Date.now()}-${Math.random()
        .toString(36)
        .substring(2, 10)}${ext}`;

    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
});

import {
  rooms,
  getComputedPlayback,
  type RoomState,
  type User,
} from "./rooms.js";

const app = express();

app.use(cors({
  origin: process.env.CLIENT_URL || "*",
}));

app.use(express.json());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "*",
    methods: ["GET", "POST"],
  },
});

app.get("/", (_req, res) => {
  res.json({
    message: "SyncRoom server is running",
  });
});

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    rooms: rooms.size,
  });
});
app.use("/uploads", express.static(uploadDir));

app.post(
  "/upload",
  upload.single("file"),
  (req, res) => {
    if (!req.file) {
      return res.status(400).json({
        message: "No file uploaded",
      });
    }

    const roomId = req.body.roomId;
    const mediaType = req.body.mediaType as
      | "video"
      | "audio";

    const room = rooms.get(roomId);

    if (!room) {
      return res.status(404).json({
        message: "Room not found",
      });
    }

    if (mediaType !== "video" && mediaType !== "audio") {
      return res.status(400).json({
        message: "Invalid media type",
      });
    }

    const fileUrl =
      `/uploads/${req.file.filename}`;

    room.mediaLibrary.push({
      name: req.file.originalname,
      url: fileUrl,
      type: mediaType,
    });
    io.to(roomId).emit("room:mediaLibrary", {
    mediaLibrary: room.mediaLibrary,
    });

    res.json({
      url: fileUrl,
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
      mimeType: req.file.mimetype,
    });
  }
);
type VoiceState = {
  id: string;
  username: string;
  roomId: string;
  muted: boolean;
};

const voiceStates = new Map<string, VoiceState>();
const roomCreatedAt = new Map<string, number>();
io.on("connection", (socket) => {
    // =========================
  // VOICE CHAT STATE + SIGNALING
  // =========================

  socket.on(
    "voice:join",
    ({
      roomId,
      username,
      muted,
    }: {
      roomId: string;
      username: string;
      muted: boolean;
    }) => {
      const room = rooms.get(roomId);

      if (!room || !room.users.some((user) => user.id === socket.id)) {
        return;
      }

      voiceStates.delete(socket.id);

      const state: VoiceState = {
        id: socket.id,
        username,
        roomId,
        muted,
      };

      voiceStates.set(socket.id, state);

      const participants = [...voiceStates.values()]
        .filter((item) => item.roomId === roomId)
        .map(({ id, username, muted }) => ({
          id,
          username,
          muted,
        }));

      socket.emit("voice:participants", {
        participants,
      });

      io.to(roomId).emit("voice:state", {
        user: {
          id: socket.id,
          username,
          muted,
          enabled: true,
        },
      });
    }
  );

  socket.on(
    "voice:mute",
    ({
      roomId,
      muted,
    }: {
      roomId: string;
      muted: boolean;
    }) => {
      const state = voiceStates.get(socket.id);

      if (!state || state.roomId !== roomId) return;

      state.muted = muted;

      io.to(roomId).emit("voice:state", {
        user: {
          id: socket.id,
          username: state.username,
          muted,
          enabled: true,
        },
      });
    }
  );

  socket.on(
    "voice:leave",
    ({ roomId }: { roomId: string }) => {
      const state = voiceStates.get(socket.id);

      if (!state || state.roomId !== roomId) return;

      voiceStates.delete(socket.id);

      io.to(roomId).emit("voice:state", {
        user: {
          id: socket.id,
          username: state.username,
          muted: false,
          enabled: false,
        },
      });

      io.to(roomId).emit("voice:leave", {
        userId: socket.id,
      });
    }
  );

  socket.on(
    "voice:offer",
    ({
      roomId,
      targetId,
      offer,
    }: {
      roomId: string;
      targetId: string;
      offer: RTCSessionDescriptionInit;
    }) => {
      if (!socket.rooms.has(roomId)) return;

      const sender = voiceStates.get(socket.id);
      const target = voiceStates.get(targetId);

      if (
        !sender ||
        sender.roomId !== roomId ||
        !target ||
        target.roomId !== roomId
      ) {
        return;
      }

      io.to(targetId).emit("voice:offer", {
        fromId: socket.id,
        offer,
      });
    }
  );

  socket.on(
    "voice:answer",
    ({
      roomId,
      targetId,
      answer,
    }: {
      roomId: string;
      targetId: string;
      answer: RTCSessionDescriptionInit;
    }) => {
      if (!socket.rooms.has(roomId)) return;

      const sender = voiceStates.get(socket.id);
      const target = voiceStates.get(targetId);

      if (
        !sender ||
        sender.roomId !== roomId ||
        !target ||
        target.roomId !== roomId
      ) {
        return;
      }

      io.to(targetId).emit("voice:answer", {
        fromId: socket.id,
        answer,
      });
    }
  );

  socket.on(
    "voice:ice-candidate",
    ({
      roomId,
      targetId,
      candidate,
    }: {
      roomId: string;
      targetId: string;
      candidate: RTCIceCandidateInit;
    }) => {
      if (!socket.rooms.has(roomId)) return;

      const sender = voiceStates.get(socket.id);
      const target = voiceStates.get(targetId);

      if (
        !sender ||
        sender.roomId !== roomId ||
        !target ||
        target.roomId !== roomId
      ) {
        return;
      }

      io.to(targetId).emit("voice:ice-candidate", {
        fromId: socket.id,
        candidate,
      });
    }
  );

socket.on(
  "typing",
  ({
    roomId,
    isTyping,
  }: {
    roomId: string;
    isTyping: boolean;
  }) => {
    const room = rooms.get(roomId);

    if (!room) return;

    const user = room.users.find(
      (user) => user.id === socket.id
    );

    if (!user) return;

    socket.to(roomId).emit("typing", {
      username: user.username,
      isTyping,
    });
  }
);

socket.on(
  "room:kick",
  ({ roomId, targetId }: { roomId: string; targetId: string }) => {
    const room = rooms.get(roomId);
    if (!room || socket.id !== room.hostId || targetId === socket.id) return;
    const target = room.users.find((user) => user.id === targetId);
    if (!target) return;

    const targetVoice = voiceStates.get(targetId);
    if (targetVoice) {
      voiceStates.delete(targetId);
      io.to(roomId).emit("voice:state", {
        user: { id: targetId, username: targetVoice.username, muted: false, enabled: false },
      });
      io.to(roomId).emit("voice:leave", { userId: targetId });
    }

    room.users = room.users.filter((user) => user.id !== targetId);
    io.to(targetId).emit("user:kicked", { message: "You were removed from the room by the host." });
    io.sockets.sockets.get(targetId)?.leave(roomId);
    io.to(roomId).emit("user:left", { userId: targetId, username: target.username });
    io.to(roomId).emit("room:users", { users: room.users });
  }
);

socket.on(
  "room:force-mute",
  ({ roomId, targetId }: { roomId: string; targetId: string }) => {
    const room = rooms.get(roomId);
    if (!room || socket.id !== room.hostId || targetId === socket.id) return;
    const target = room.users.find((user) => user.id === targetId);
    const voiceState = voiceStates.get(targetId);
    if (!target || !voiceState) return;
    voiceState.muted = true;
    io.to(targetId).emit("user:force-muted");
    io.to(roomId).emit("voice:state", {
      user: { id: targetId, username: target.username, muted: true, enabled: true },
    });
  }
);

socket.on(
  "room:transfer-host",
  ({ roomId, targetId }: { roomId: string; targetId: string }) => {
    const room = rooms.get(roomId);
    if (!room || socket.id !== room.hostId) return;
    const target = room.users.find((user) => user.id === targetId);
    if (!target) return;
    room.hostId = targetId;
    room.users = room.users.map((user) => ({ ...user, isHost: user.id === targetId }));
    io.to(roomId).emit("host:changed", { hostId: targetId });
    io.to(roomId).emit("room:users", { users: room.users });
  }
);

socket.on(
  "reaction:send",
  ({
    roomId,
    reaction,
    username,
  }: {
    roomId: string;
    reaction: string;
    username: string;
  }) => {
    const room = rooms.get(roomId);

    if (!room) return;

    const isMember = room.users.some(
      (user) => user.id === socket.id
    );

    if (!isMember) return;

    io.to(roomId).emit("reaction:receive", {
      id: `${Date.now()}-${Math.random()}`,
      reaction,
      username,
    });
  }
);
  // =========================
  // CREATE ROOM
  // =========================

  socket.on(
    "room:create",
    ({
      roomId,
      username,
      mediaUrl,
    }: {
      roomId: string;
      username: string;
      mediaUrl: string;
    }) => {

      const user: User = {
        id: socket.id,
        username,
        isHost: true,
      };

      const room: RoomState = {
        id: roomId,
        hostId: socket.id,
        mediaUrl,
        mediaType: "video",
        mediaLibrary: [],
        currentTime: 0,
        isPlaying: false,
        lastUpdated: Date.now(),
        users: [user],
      };

      rooms.set(roomId, room);
      roomCreatedAt.set(roomId, Date.now());

      socket.join(roomId);

      socket.emit("room:created", {
        room: { ...room, createdAt: roomCreatedAt.get(roomId) },
      });

      console.log(`Room created: ${roomId}`);
    }
  );

  // =========================
  // JOIN ROOM
  // =========================
// =========================
// JOIN ROOM
// =========================

socket.on(
  "room:join",
  ({
    roomId,
    username,
  }: {
    roomId: string;
    username: string;
  }) => {
    const room = rooms.get(roomId);

    if (!room) {
      socket.emit("room:error", {
        message: "Room not found",
      });

      return;
    }

    // Check if this is a reconnecting user
    const existingUser = room.users.find(
      (u) => u.username === username
    );

    let user: User;
    let isReconnect = false;

    if (existingUser) {
      // User refreshed/reconnected
      const wasHost = room.hostId === existingUser.id;

      existingUser.id = socket.id;
      existingUser.username = username;
      existingUser.isHost = wasHost;

      if (wasHost) {
        room.hostId = socket.id;
      }

      user = existingUser;
      isReconnect = true;

      console.log(
        `${username} reconnected to ${roomId}`
      );
    } else {
      // Completely new user
      user = {
        id: socket.id,
        username,
        isHost: false,
      };

      room.users.push(user);

      console.log(
        `${username} joined ${roomId}`
      );
    }

    socket.join(roomId);

    // Calculate correct playback position
    const currentTime = getComputedPlayback(room);

    // Send current room state to the joining user
    socket.emit("room:state", {
      room: {
        ...room,
        currentTime,
        createdAt: roomCreatedAt.get(roomId),
      },
    });

    // Only announce a genuinely new user
    if (!isReconnect) {
      socket.to(roomId).emit("user:joined", {
        user,
      });
    }

    // Update everyone with current users
    io.to(roomId).emit("room:users", {
      users: room.users,
    });
  }
);

  // =========================
  // VIDEO SYNC
  // =========================

  socket.on(
    "video:sync",
    ({
      roomId,
      currentTime,
      isPlaying,
    }: {
      roomId: string;
      currentTime: number;
      isPlaying: boolean;
    }) => {

      const room = rooms.get(roomId);

      if (!room) return;

      // Only host controls playback for now
      if (socket.id !== room.hostId) {
        return;
      }

      room.currentTime = currentTime;
      room.isPlaying = isPlaying;
      room.lastUpdated = Date.now();

      socket.to(roomId).emit("video:sync", {
        currentTime,
        isPlaying,
        lastUpdated: room.lastUpdated,
        mediaUrl: room.mediaUrl,
        mediaType: room.mediaType,
      });
    }
  );

  // =========================
  // CHAT
  // =========================

  socket.on(
  "chat:message",
  ({
    roomId,
    message,
  }: {
    roomId: string;
    message: {
      id: string;
      sender: string;
      text: string;
      timestamp: number;
      isHost?: boolean;
    };
  }) => {
    const room = rooms.get(roomId);

    if (!room) return;

    const isMember = room.users.some(
      (user) => user.id === socket.id
    );

    if (!isMember) return;

    io.to(roomId).emit("chat:message", message);
  }
);


  // =========================
  // REACTION
  // =========================

  // =========================
  // CHANGE MEDIA
  // =========================

  // =========================
// CHANGE MEDIA
// =========================

socket.on(
  "media:change",
  ({
    roomId,
    url,
    mediaType,
  }: {
    roomId: string;
    url: string;
    mediaType: "video" | "audio" | "youtube";
  }) => {
    const room = rooms.get(roomId);

    if (!room) return;

    // Only host can change media
    if (socket.id !== room.hostId) {
      return;
    }

    room.mediaUrl = url;
    room.mediaType = mediaType;
    room.currentTime = 0;
    room.isPlaying = false;
    room.lastUpdated = Date.now();

    io.to(roomId).emit("media:change", {
      url,
      mediaType,
    });
  }
);

// =========================
// INTENTIONAL LEAVE
// =========================

socket.on(
  "room:leave",
  ({ roomId }: { roomId: string }) => {
    const room = rooms.get(roomId);

    if (!room) return;

    const user = room.users.find(
      (u) => u.id === socket.id
    );

    if (!user) return;

    // Remove the user from voice immediately as well.
    const voiceState = voiceStates.get(socket.id);

    if (voiceState && voiceState.roomId === roomId) {
      voiceStates.delete(socket.id);

      io.to(roomId).emit("voice:state", {
        user: {
          id: socket.id,
          username: voiceState.username,
          muted: false,
          enabled: false,
        },
      });

      io.to(roomId).emit("voice:leave", {
        userId: socket.id,
      });
    }

    // Remove the user immediately
    room.users = room.users.filter(
      (u) => u.id !== socket.id
    );

    socket.leave(roomId);

    // Tell everyone who left
    io.to(roomId).emit("user:left", {
      userId: socket.id,
      username: user.username,
    });

    // If the host left, transfer host immediately
    if (room.hostId === socket.id) {
      const newHost = room.users[0];

      if (newHost) {
        room.hostId = newHost.id;

        room.users = room.users.map((u) => ({
          ...u,
          isHost: u.id === newHost.id,
        }));

        io.to(roomId).emit("host:changed", {
          hostId: newHost.id,
        });
      } else {
        rooms.delete(roomId);
        roomCreatedAt.delete(roomId);

        console.log(
          `Room deleted after last user left: ${roomId}`
        );

        return;
      }
    }

    io.to(roomId).emit("room:users", {
      users: room.users,
    });

    console.log(
      `${user.username} intentionally left ${roomId}`
    );
  }
);
  // =========================
// DISCONNECT
// =========================

socket.on("disconnect", () => {
  console.log("Disconnected:", socket.id);

  const voiceState = voiceStates.get(socket.id);

  if (voiceState) {
    voiceStates.delete(socket.id);

    io.to(voiceState.roomId).emit("voice:state", {
      user: {
        id: socket.id,
        username: voiceState.username,
        muted: false,
        enabled: false,
      },
    });

    io.to(voiceState.roomId).emit("voice:leave", {
      userId: socket.id,
    });
  }

  for (const [roomId, room] of rooms) {
    const user = room.users.find(
      (u) => u.id === socket.id
    );

    if (!user) continue;

    console.log(
      `${user.username} disconnected from ${roomId}. Waiting for reconnect...`
    );

    // Give the user 15 seconds to reconnect
    setTimeout(() => {
      const currentRoom = rooms.get(roomId);

      if (!currentRoom) return;

      // If the old socket ID is no longer present,
      // the user successfully reconnected.
      const stillUsingOldSocket = currentRoom.users.some(
        (u) => u.id === socket.id
      );

      if (!stillUsingOldSocket) {
        console.log(
          `${user.username} successfully reconnected to ${roomId}`
        );
        return;
      }

      // User did not reconnect
      currentRoom.users = currentRoom.users.filter(
        (u) => u.id !== socket.id
      );

      io.to(roomId).emit("user:left", {
        userId: socket.id,
        username: user.username,
      });

      // Transfer host only if they really left
      if (currentRoom.hostId === socket.id) {
        const newHost = currentRoom.users[0];

        if (newHost) {
          currentRoom.hostId = newHost.id;
          newHost.isHost = true;

          io.to(roomId).emit("host:changed", {
            hostId: newHost.id,
          });
        } else {
          rooms.delete(roomId);
          roomCreatedAt.delete(roomId);

          console.log(
            `Room deleted: ${roomId}`
          );

          return;
        }
      }

      io.to(roomId).emit("room:users", {
        users: currentRoom.users,
      });

      console.log(
        `${user.username} permanently left ${roomId}`
      );
    }, 15000);
  }
});

});
// =========================
// VIDEO SYNC HEARTBEAT
// =========================

setInterval(() => {
  for (const room of rooms.values()) {
    if (!room.isPlaying) continue;

    const currentTime = getComputedPlayback(room);

    io.to(room.id).emit("video:sync", {
      currentTime,
      isPlaying: true,
      lastUpdated: Date.now(),
      mediaUrl: room.mediaUrl,
      mediaType: room.mediaType,
    });
  }
}, 1000);

const PORT = Number(process.env.PORT) || 4000;

server.listen(PORT, () => {
  console.log(
    `SyncRoom server running on port ${PORT}`
  );
});