import { useEffect, useRef, useState } from "react";
import { socket } from "./socket";
import YouTube from "react-youtube";
import type { YouTubeProps } from "react-youtube";
import "./App.css";
import HeroScene from "./HeroScene";
type User = {
  id: string;
  username: string;
  isHost: boolean;
};

type Message = {
  id: string;
  sender: string;
  text: string;
  timestamp: number;
};

type Room = {
  id: string;
  hostId: string;
  mediaUrl: string;
  mediaType: "video" | "audio" | "youtube";

    mediaLibrary: {
    name: string;
    url: string;
    type: "video" | "audio";
  }[];
  
  currentTime: number;
  isPlaying: boolean;
  lastUpdated: number;
  users: User[];
  createdAt?: number;
};

const generateRoomCode = () => {
  return Math.random()
    .toString(36)
    .substring(2, 8)
    .toUpperCase();
};

function App() {
  const [page, setPage] = useState<"home" | "room">(() => {
  const savedRoom = localStorage.getItem("syncroom_room");

  return savedRoom ? "room" : "home";
});
  const [syncEnabled, setSyncEnabled] = useState(false);
  const [username, setUsername] = useState(() => {
  return localStorage.getItem("syncroom_username") || "";
});

const [roomCode, setRoomCode] = useState(() => {
  return localStorage.getItem("syncroom_room") || "";
});
  const [reactions, setReactions] = useState<
  {
    id: string;
    reaction: string;
    username: string;
    x: number;
    y: number;
    rotate: number;
    scale: number;
  }[]
>([]);
  const [room, setRoom] = useState<Room | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  useEffect(() => {
  messagesEndRef.current?.scrollIntoView({
    behavior: "smooth",
  });
}, [messages]);

  const [chatText, setChatText] = useState("");
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const typingTimeoutRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const [mediaProgress, setMediaProgress] = useState(0);
  const [roomElapsed, setRoomElapsed] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [videoCurrentTime, setVideoCurrentTime] = useState(0);
  const [videoUrl, setVideoUrl] = useState("");
  const [mediaLibrary, setMediaLibrary] = useState<
  {
    name: string;
    url: string;
    type: "video" | "audio";
  }[]
>([]);
  const [selectedMediaType, setSelectedMediaType] =
  useState<"video" | "audio" | "youtube">("video");

  

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);

  const [status, setStatus] = useState("Connecting...");
  const [error, setError] = useState("");
  const [mediaLoading, setMediaLoading] = useState(false);
const [isFullscreen, setIsFullscreen] = useState(false);
type VoiceUser = {
  id: string;
  username: string;
  muted: boolean;
};

const [voiceEnabled, setVoiceEnabled] = useState(false);
const [voiceMuted, setVoiceMuted] = useState(false);
const [voiceUsers, setVoiceUsers] = useState<VoiceUser[]>([]);

const localStreamRef = useRef<MediaStream | null>(null);

const peerConnectionsRef = useRef<
  Map<string, RTCPeerConnection>
>(new Map());

const remoteAudioRef = useRef<
  Map<string, HTMLAudioElement>
>(new Map());

const mediaWasPlayingBeforeInterruptionRef = useRef(false);
const interruptionRef = useRef(false);
const [needsMediaResume, setNeedsMediaResume] = useState(false);

  const playUiSound = (kind: "join" | "leave" | "reaction" | "kick" | "mute") => {
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      if (!audioContextRef.current) audioContextRef.current = new AudioCtx();
      const ctx = audioContextRef.current;
      if (ctx.state === "suspended") void ctx.resume();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const now = ctx.currentTime;
      const freq = { join: 660, leave: 330, reaction: 760, kick: 180, mute: 240 }[kind];
      osc.frequency.value = freq;
      osc.type = kind === "reaction" ? "sine" : "triangle";
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(kind === "reaction" ? 0.045 : 0.07, now + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.18);
    } catch {}
  };

  useEffect(() => {
    if (!room) return;
    const timer = window.setInterval(() => {
      setRoomElapsed(Math.max(0, Math.floor((Date.now() - (room.createdAt || Date.now())) / 1000)));
      const media = getMediaElement();
      if (media) {
        const current = media.currentTime || 0;
        const duration = Number.isFinite(media.duration) ? media.duration : 0;
        setVideoCurrentTime(current);
        setVideoDuration(duration);
        setMediaProgress(duration > 0 ? (current / duration) * 100 : 0);
      } else if (room.mediaType === "youtube") {
        const player = youtubePlayerRef.current;
        if (player && typeof player.getCurrentTime === "function") {
          const current = Number(player.getCurrentTime()) || 0;
          const duration = typeof player.getDuration === "function" ? Number(player.getDuration()) || 0 : 0;
          setVideoCurrentTime(current);
          setVideoDuration(duration);
          setMediaProgress(duration > 0 ? (current / duration) * 100 : 0);
        }
      }
    }, 500);
    return () => window.clearInterval(timer);
  }, [room?.id, room?.createdAt, room?.mediaType]);

  useEffect(() => () => {
    if (typingTimeoutRef.current) window.clearTimeout(typingTimeoutRef.current);
    void audioContextRef.current?.close();
  }, []);

  useEffect(() => {
  const handleFullscreenChange = () => {
    setIsFullscreen(!!document.fullscreenElement);
  };

  document.addEventListener(
    "fullscreenchange",
    handleFullscreenChange
  );

  return () => {
    document.removeEventListener(
      "fullscreenchange",
      handleFullscreenChange
    );
  };
}, []);

  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const youtubePlayerRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const resumeMediaAfterInterruption = async () => {
  if (!room?.isPlaying) return;

  const media = getMediaElement();

  if (room.mediaType === "youtube") {
    const player = youtubePlayerRef.current;

    if (!player || typeof player.playVideo !== "function") {
      setNeedsMediaResume(true);
      return;
    }

    try {
      const elapsed =
        (Date.now() - room.lastUpdated) / 1000;

      const targetTime =
        room.currentTime + Math.max(0, elapsed);

      if (typeof player.seekTo === "function") {
        player.seekTo(targetTime, true);
      }

      player.playVideo();
      setNeedsMediaResume(false);
    } catch {
      setNeedsMediaResume(true);
    }

    return;
  }

  if (!media) {
    setNeedsMediaResume(true);
    return;
  }

  const elapsed =
    (Date.now() - room.lastUpdated) / 1000;

  const targetTime =
    room.currentTime + Math.max(0, elapsed);

  if (
    Math.abs(media.currentTime - targetTime) > 0.35
  ) {
    media.currentTime = targetTime;
  }

  try {
    await media.play();
    setNeedsMediaResume(false);
  } catch {
    setNeedsMediaResume(true);
  }
};
useEffect(() => {
  if (!room) return;

  const handleVisibilityChange = () => {
    if (document.hidden && room.isPlaying) {
      mediaWasPlayingBeforeInterruptionRef.current = true;
      interruptionRef.current = true;
      return;
    }

    if (
      !document.hidden &&
      interruptionRef.current &&
      mediaWasPlayingBeforeInterruptionRef.current &&
      room.isPlaying
    ) {
      interruptionRef.current = false;
      mediaWasPlayingBeforeInterruptionRef.current = false;

      window.setTimeout(() => {
        void resumeMediaAfterInterruption();
      }, 300);
    }
  };

  document.addEventListener(
    "visibilitychange",
    handleVisibilityChange
  );

  return () => {
    document.removeEventListener(
      "visibilitychange",
      handleVisibilityChange
    );
  };
}, [
  room?.id,
  room?.isPlaying,
  room?.mediaType,
  room?.lastUpdated,
]);

  const getYouTubeVideoId = (url: string) => {
    try {
      const parsed = new URL(url.trim());
      const host = parsed.hostname.replace("www.", "");

      if (host === "youtu.be") {
        return parsed.pathname.slice(1).split("/")[0] || "";
      }

      if (host === "youtube.com" || host === "m.youtube.com") {
        const videoId = parsed.searchParams.get("v");
        if (videoId) return videoId;

        const parts = parsed.pathname.split("/").filter(Boolean);
        if (parts[0] === "shorts" || parts[0] === "embed") {
          return parts[1] || "";
        }
      }
    } catch {
      return "";
    }

    return "";
  };

  const getYouTubeCurrentTime = () => {
    const player = youtubePlayerRef.current;
    if (!player || typeof player.getCurrentTime !== "function") return 0;
    return Number(player.getCurrentTime()) || 0;
  };

  const syncYouTubePlayer = (currentTime: number, isPlaying: boolean) => {
    const player = youtubePlayerRef.current;
    if (!player) return;

    const playerTime =
      typeof player.getCurrentTime === "function"
        ? Number(player.getCurrentTime()) || 0
        : 0;

    if (
      typeof player.seekTo === "function" &&
      Math.abs(playerTime - currentTime) > 0.75
    ) {
      player.seekTo(Math.max(0, currentTime), true);
    }

    if (isPlaying) {
      player.playVideo?.();
    } else {
      player.pauseVideo?.();
    }
  };

  const getMediaElement = () => {
  return videoRef.current || audioRef.current;
};

const removeVoiceConnection = (remoteId: string) => {
  const peer = peerConnectionsRef.current.get(remoteId);
  peer?.close();
  peerConnectionsRef.current.delete(remoteId);

  const audio = remoteAudioRef.current.get(remoteId);
  if (audio) {
    audio.srcObject = null;
    audio.remove();
    remoteAudioRef.current.delete(remoteId);
  }

  setVoiceUsers((prev) =>
  prev.filter((user) => user.id !== remoteId)
);
};

const createVoicePeer = async (remoteId: string) => {
  if (!room || !localStreamRef.current || remoteId === socket.id) {
    return null;
  }

  const existing = peerConnectionsRef.current.get(remoteId);
  if (existing) return existing;

  const peer = new RTCPeerConnection({
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
    ],
  });

  peerConnectionsRef.current.set(remoteId, peer);

  localStreamRef.current.getTracks().forEach((track) => {
    peer.addTrack(track, localStreamRef.current!);
  });

  peer.onicecandidate = (event) => {
    if (!event.candidate || !room) return;

    socket.emit("voice:ice-candidate", {
      roomId: room.id,
      targetId: remoteId,
      candidate: event.candidate,
    });
  };

  peer.ontrack = (event) => {
    const stream = event.streams[0];
    if (!stream) return;

    let audio = remoteAudioRef.current.get(remoteId);

    if (!audio) {
      audio = new Audio();
      audio.autoplay = true;
      remoteAudioRef.current.set(remoteId, audio);
    }

    audio.srcObject = stream;
    void audio.play().catch(() => {
      console.log("Remote voice autoplay blocked");
    });
  };

  peer.onconnectionstatechange = () => {
  

    if (
      peer.connectionState === "failed" ||
      peer.connectionState === "closed" ||
      peer.connectionState === "disconnected"
    ) {
      removeVoiceConnection(remoteId);
    }
  };

  return peer;
};

const connectToVoiceUser = async (remoteId: string) => {
  if (!room || !localStreamRef.current || !socket.id) return;
  if (remoteId === socket.id) return;

  // Only one side creates the offer.
  if (socket.id > remoteId) return;

  const peer = await createVoicePeer(remoteId);
  if (!peer || peer.signalingState !== "stable") return;

  try {
    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);

    socket.emit("voice:offer", {
      roomId: room.id,
      targetId: remoteId,
      offer,
    });
  } catch (error) {
    console.error("Voice offer failed:", error);
  }
};

const cleanupVoice = (notifyServer = true) => {
  if (notifyServer && room) {
    socket.emit("voice:leave", {
      roomId: room.id,
    });
  }

  localStreamRef.current
    ?.getTracks()
    .forEach((track) => track.stop());

  localStreamRef.current = null;

  peerConnectionsRef.current.forEach((peer) => peer.close());
  peerConnectionsRef.current.clear();

  remoteAudioRef.current.forEach((audio) => {
    audio.srcObject = null;
    audio.remove();
  });
  remoteAudioRef.current.clear();

  setVoiceEnabled(false);
  setVoiceMuted(false);
  setVoiceUsers((prev) =>
    socket.id
      ? prev.filter((user) => user.id !== socket.id)
      : prev
  );
};

const toggleVoice = async () => {
  if (!room) return;

  if (voiceEnabled) {
    cleanupVoice(true);
    return;
  }

  try {
    const currentSocketId = socket.id;

    if (!currentSocketId) {
      setError(
        "Connecting to the server. Please try again in a moment."
      );
      return;
    }

    const stream =
      await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });

    localStreamRef.current = stream;
    setVoiceEnabled(true);
    setVoiceMuted(false);

    setVoiceUsers((prev) => [
      ...prev.filter((user) => user.id !== currentSocketId),
      {
        id: currentSocketId,
        username: username || "You",
        muted: false,
      },
    ]);

    socket.emit("voice:join", {
      roomId: room.id,
      username,
      muted: false,
    });
  } catch (error) {
    console.error("Microphone permission failed:", error);
    setError("Microphone permission is required for voice chat.");
  }
};

const toggleVoiceMute = () => {
  const track = localStreamRef.current?.getAudioTracks()[0];
  if (!track || !room) return;

  track.enabled = !track.enabled;
  const muted = !track.enabled;

  setVoiceMuted(muted);

  setVoiceUsers((prev) =>
    prev.map((user) =>
      user.id === socket.id
        ? { ...user, muted }
        : user
    )
  );

  socket.emit("voice:mute", {
    roomId: room.id,
    muted,
  });
};

useEffect(() => {
  if (!room) return;

  const handleOffer = async ({
    fromId,
    offer,
  }: {
    fromId: string;
    offer: RTCSessionDescriptionInit;
  }) => {
    if (!localStreamRef.current) return;

    try {
      const peer = await createVoicePeer(fromId);
      if (!peer) return;

      await peer.setRemoteDescription(
        new RTCSessionDescription(offer)
      );

      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);

      socket.emit("voice:answer", {
        roomId: room.id,
        targetId: fromId,
        answer,
      });
    } catch (error) {
      console.error("Voice answer failed:", error);
    }
  };

  const handleAnswer = async ({
    fromId,
    answer,
  }: {
    fromId: string;
    answer: RTCSessionDescriptionInit;
  }) => {
    const peer = peerConnectionsRef.current.get(fromId);
    if (!peer) return;

    try {
      await peer.setRemoteDescription(
        new RTCSessionDescription(answer)
      );
    } catch (error) {
      console.error("Voice remote description failed:", error);
    }
  };

  const handleIceCandidate = async ({
    fromId,
    candidate,
  }: {
    fromId: string;
    candidate: RTCIceCandidateInit;
  }) => {
    const peer = peerConnectionsRef.current.get(fromId);
    if (!peer) return;

    try {
      await peer.addIceCandidate(
        new RTCIceCandidate(candidate)
      );
    } catch (error) {
      console.error("Failed to add ICE candidate:", error);
    }
  };

  const handleVoiceParticipants = ({
    participants,
  }: {
    participants: VoiceUser[];
  }) => {
    setVoiceUsers(participants);
  };

  const handleVoiceState = ({
    user,
  }: {
    user: VoiceUser & { enabled: boolean };
  }) => {
    setVoiceUsers((prev) => {
      const filtered = prev.filter(
        (item) => item.id !== user.id
      );

      if (!user.enabled) {
        return filtered;
      }

      return [
        ...filtered,
        {
          id: user.id,
          username: user.username,
          muted: user.muted,
        },
      ];
    });

    if (!user.enabled) {
      removeVoiceConnection(user.id);
    }
  };

  socket.on("voice:offer", handleOffer);
  socket.on("voice:answer", handleAnswer);
  socket.on("voice:ice-candidate", handleIceCandidate);
  socket.on("voice:participants", handleVoiceParticipants);
  socket.on("voice:state", handleVoiceState);

  return () => {
    socket.off("voice:offer", handleOffer);
    socket.off("voice:answer", handleAnswer);
    socket.off("voice:ice-candidate", handleIceCandidate);
    socket.off("voice:participants", handleVoiceParticipants);
    socket.off("voice:state", handleVoiceState);
  };
}, [room?.id]);

useEffect(() => {
  if (!voiceEnabled || !room) return;

  for (const voiceUser of voiceUsers) {
    if (voiceUser.id !== socket.id) {
      void connectToVoiceUser(voiceUser.id);
    }
  }
}, [voiceEnabled, room?.id, voiceUsers]);

useEffect(() => {
  return () => {
    localStreamRef.current
      ?.getTracks()
      .forEach((track) => track.stop());

    peerConnectionsRef.current.forEach((peer) => peer.close());
    peerConnectionsRef.current.clear();

    remoteAudioRef.current.forEach((audio) => {
      audio.srcObject = null;
      audio.remove();
    });
    remoteAudioRef.current.clear();
  };
}, []);

  const isHost =
    !!room && room.hostId === socket.id;

    useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  const inviteRoom = params.get("room");

  if (!inviteRoom) return;

  setRoomCode(
    inviteRoom.toUpperCase().slice(0, 6)
  );

  setShowJoin(true);

  // Remove ?room=XXXXXX from the address bar
  window.history.replaceState(
    {},
    "",
    window.location.pathname
  );
}, []);

  // =========================
  // SOCKET LISTENERS
  // =========================

  useEffect(() => {
    const onTyping = ({ username: typingUsername, isTyping }: { username: string; isTyping: boolean }) => {
      setTypingUsers((prev) =>
        isTyping
          ? prev.includes(typingUsername)
            ? prev
            : [...prev, typingUsername]
          : prev.filter((name) => name !== typingUsername)
      );
    };

    const onForceMute = () => {
      const track = localStreamRef.current?.getAudioTracks()[0];
      if (track) {
        track.enabled = false;
        setVoiceMuted(true);
        setVoiceUsers((prev) =>
          prev.map((u) =>
            u.id === socket.id ? { ...u, muted: true } : u
          )
        );
      }
      playUiSound("mute");
    };

    const onKicked = ({ message }: { message: string }) => {
      cleanupVoice(false);
      localStorage.removeItem("syncroom_room");
      setRoom(null);
      setUsers([]);
      setMessages([]);
      setVoiceUsers([]);
      setPage("home");
      setError(message || "You were removed from the room.");
      playUiSound("kick");
    };

    const onConnect = () => {
      setStatus("Connected");

      const savedRoom = localStorage.getItem("syncroom_room");
      const savedUsername = localStorage.getItem("syncroom_username");

      if (savedRoom && savedUsername) {
        console.log("AUTO REJOIN:", savedRoom);

        socket.emit("room:join", {
          roomId: savedRoom,
          username: savedUsername,
        });
      }
    };

    const onDisconnect = () => {
      console.log("Disconnected");
      setStatus("Disconnected");
    };

    const onRoomCreated = ({ room }: { room: Room }) => {
      setRoom(room);
      setUsers(room.users);
      setPage("room");
      setShowCreate(false);
      setError("");

      console.log("Room created:", room.id);
    };

    const onRoomState = ({ room }: { room: Room }) => {
      setRoom(room);
      setUsers(room.users);
      setMediaLibrary(
          (room.mediaLibrary || []).map((media) => ({
           ...media,
          url: media.url.startsWith("http")
          ? media.url
          : `${import.meta.env.VITE_SERVER_URL}${media.url}`,
         }))
        );
      setPage("room");
      setShowJoin(false);
      setError("");

      // Sync newly joined user
      
const syncMediaToRoom = () => {
  const media = getMediaElement();

  if (!media) return;

  const elapsed = room.isPlaying
    ? (Date.now() - room.lastUpdated) / 1000
    : 0;

  const targetTime =
    room.currentTime + Math.max(0, elapsed);

  media.currentTime = targetTime;

  if (room.isPlaying) {
    media.play().catch(() => {
      console.log("Autoplay blocked");
    });
  } else {
    media.pause();
  }
};

if (room.mediaType === "youtube") {
    const elapsed = room.isPlaying
      ? (Date.now() - room.lastUpdated) / 1000
      : 0;

    syncYouTubePlayer(
      room.currentTime + Math.max(0, elapsed),
      room.isPlaying
    );
  }

  const media = getMediaElement();

  if (media) {
  if (media.readyState >= 1) {
    syncMediaToRoom();
  } else {
    media.addEventListener(
      "loadedmetadata",
      syncMediaToRoom,
      { once: true }
    );
  }
}
    };

    const onRoomUsers = ({ users }: { users: User[] }) => {
      setUsers(users);

      setRoom((prev) =>
        prev
          ? {
              ...prev,
              users,
            }
          : prev
      );
    };

    const onRoomError = ({
      message,
    }: {
      message: string;
    }) => {
      setError(message);
    };

    const onUserJoined = ({
  user,
}: {
  user: User;
}) => {
  playUiSound("join");
  setUsers((prev) => {
    if (prev.some((u) => u.id === user.id)) {
      return prev;
    }

    return [...prev, user];
  });

  setMessages((prev) => [
    ...prev,
    {
      id: `join-${user.id}-${Date.now()}`,
      sender: "SYSTEM",
      text: `${user.username} joined the room`,
      timestamp: Date.now(),
    },
  ]);
};

    const onUserLeft = ({
  userId,
  username,
}: {
  userId: string;
  username: string;
}) => {
  playUiSound("leave");
  setUsers((prev) =>
    prev.filter((u) => u.id !== userId)
  );

  setMessages((prev) => [
    ...prev,
    {
      id: `leave-${userId}-${Date.now()}`,
      sender: "SYSTEM",
      text: `${username} left the room`,
      timestamp: Date.now(),
    },
  ]);
};

    // =========================
    // VIDEO SYNC
    // =========================
    const onVideoSync = ({
  currentTime,
  isPlaying,
  lastUpdated,
  mediaUrl,
  mediaType,
}: {
  currentTime: number;
  isPlaying: boolean;
  lastUpdated: number;
  mediaUrl?: string;
  mediaType?: "video" | "audio" | "youtube";
}) => {
  setRoom((prev) =>
    prev
      ? {
          ...prev,
          currentTime,
          isPlaying,
          lastUpdated,
          mediaUrl: mediaUrl || prev.mediaUrl,
          mediaType: mediaType || prev.mediaType,
        }
      : prev
  );

  if (mediaType === "youtube" || room?.mediaType === "youtube") {
    const elapsed = isPlaying
      ? (Date.now() - lastUpdated) / 1000
      : 0;

    syncYouTubePlayer(
      currentTime + Math.max(0, elapsed),
      isPlaying
    );

    return;
  }

  const media = getMediaElement();

  if (!media) return;

  const elapsed = isPlaying
    ? (Date.now() - lastUpdated) / 1000
    : 0;

  const targetTime =
    currentTime + Math.max(0, elapsed);

  // Only correct noticeable drift
  if (
    Math.abs(media.currentTime - targetTime) > 0.35
  ) {
    media.currentTime = targetTime;
  }

  if (isPlaying) {
    media.play().catch(() => {});
  } else {
    media.pause();
  }
};

    // =========================
    // MEDIA
    // =========================

    const onMediaChange = ({
  url,
  mediaType,
}: {
  url: string;
  mediaType: "video" | "audio" | "youtube";
}) => {
  setMediaLoading(true);
  setRoom((prev) =>
    prev
      ? {
          ...prev,
          mediaUrl: url,
          mediaType,
          currentTime: 0,
          isPlaying: false,
          lastUpdated: Date.now(),
        }
      : prev
  );
};

    // =========================
    // CHAT
    // =========================

  const onReaction = (reaction: {
  id: string;
  reaction: string;
  username: string;
}) => {
  playUiSound("reaction");
  const burst = Array.from({ length: 14 }, (_, index) => ({
  id: `${reaction.id}-${index}`,
  reaction: reaction.reaction,
  username: reaction.username,
  x: Math.round((Math.random() - 0.5) * 420),
  y: -Math.round(Math.random() * 180),
  rotate: Math.round((Math.random() - 0.5) * 50),
  scale: 0.8 + Math.random() * 0.7,
}));

  setReactions((prev) => [
    ...prev,
    ...burst,
  ].slice(-50));

  window.setTimeout(() => {
    setReactions((prev) =>
      prev.filter(
        (item) =>
          !item.id.startsWith(`${reaction.id}-`)
      )
    );
  }, 2200);
};

socket.off("reaction:receive");
socket.on("reaction:receive", onReaction);
    const onChatMessage = (
      message: Message
    ) => {
      setMessages((prev) => [
        ...prev,
        message,
      ]);
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);

    socket.on(
      "room:created",
      onRoomCreated
    );

    socket.on(
      "room:state",
      onRoomState
    );

    socket.on(
      "room:users",
      onRoomUsers
    );
    socket.on(
  "room:mediaLibrary",
  ({
    mediaLibrary,
  }: {
    mediaLibrary: {
      name: string;
      url: string;
      type: "video" | "audio";
    }[];
  }) => {
    setMediaLibrary(
  mediaLibrary.map((media) => ({
    ...media,
    url: media.url.startsWith("http")
      ? media.url
      : `${import.meta.env.VITE_SERVER_URL}${media.url}`,
  }))
);
  }
);
const onHostChanged = ({
  hostId,
}: {
  hostId: string;
}) => {
  setRoom((prev) =>
    prev
      ? {
          ...prev,
          hostId,
          users: prev.users.map((user) => ({
            ...user,
            isHost: user.id === hostId,
          })),
        }
      : prev
  );

  setUsers((prev) =>
    prev.map((user) => ({
      ...user,
      isHost: user.id === hostId,
    }))
  );
};

    socket.on(
      "room:error",
      onRoomError
    );

    socket.on(
      "user:joined",
      onUserJoined
    );

    socket.on(
      "user:left",
      onUserLeft
      
    );

    socket.on(
      "video:sync",
      onVideoSync
    );

    socket.on(
      "media:change",
      onMediaChange
    );

    socket.on(
      "chat:message",
      onChatMessage
    );
    socket.on("typing", onTyping);
    socket.on("user:kicked", onKicked);
    socket.on("user:force-muted", onForceMute);
    socket.on(
  "host:changed",
  onHostChanged
);
  

    if (socket.connected) {
      onConnect();
    }

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("reaction:receive");

      socket.off(
        "room:created",
        onRoomCreated
      );

      socket.off(
        "room:state",
        onRoomState
      );

      socket.off(
        "room:users",
        onRoomUsers
      );

      socket.off(
        "room:error",
        onRoomError
      );

      socket.off(
        "user:joined",
        onUserJoined
      );

      socket.off(
        "user:left",
        onUserLeft
      );

      socket.off(
        "video:sync",
        onVideoSync
      );

      socket.off(
        "media:change",
        onMediaChange
      );

      socket.off(
  "host:changed",
  onHostChanged
);

      socket.off(
        "chat:message",
        onChatMessage
      );
      socket.off("typing", onTyping);
      socket.off("user:kicked", onKicked);
      socket.off("user:force-muted", onForceMute);
    };
  }, []);

  useEffect(() => {
    if (!room || !isHost || room.mediaType !== "youtube") return;

    const interval = window.setInterval(() => {
      const player = youtubePlayerRef.current;

      if (!player || typeof player.getPlayerState !== "function") return;
      if (player.getPlayerState() !== 1) return;

      socket.emit("video:sync", {
        roomId: room.id,
        currentTime: getYouTubeCurrentTime(),
        isPlaying: true,
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [room?.id, room?.mediaType, isHost]);

  // =========================
  // CREATE ROOM
  // =========================

  const createRoom = () => {
    if (!username.trim()) {
      setError("Enter your name first.");
      return;
    }

    const id = generateRoomCode();
    localStorage.setItem("syncroom_room", id);
    localStorage.setItem(
      "syncroom_username",
      username.trim()
    );

    socket.emit("room:create", {
      roomId: id,
      username: username.trim(),
      mediaUrl:
        videoUrl.trim() ||
        "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
    });
  };

  // =========================
  // JOIN ROOM
  // =========================

  const joinRoom = () => {
    if (!username.trim()) {
      setError("Enter your name first.");
      return;
    }

    if (!roomCode.trim()) {
      setError("Enter a room code.");
      return;
    }
      localStorage.setItem(
        "syncroom_room",
        roomCode.trim().toUpperCase()
      );

      localStorage.setItem(
        "syncroom_username",
         username.trim()
        );
    socket.emit("room:join", {
      roomId: roomCode.trim().toUpperCase(),
      username: username.trim(),
    });
  };

  // =========================
  // VIDEO PLAY
  // =========================

  const handlePlay = () => {
  if (!room) return;

  if (!isHost) return;

  const media = getMediaElement();

  const currentTime =
    media?.currentTime || 0;

  socket.emit("video:sync", {
    roomId: room.id,
    currentTime,
    isPlaying: true,
  });
};

  // =========================
  // VIDEO PAUSE
  // =========================

  const handlePause = () => {
  if (!room || !isHost) return;

  // Phone call / audio interruption
  if (document.hidden || interruptionRef.current) {
    mediaWasPlayingBeforeInterruptionRef.current = true;
    interruptionRef.current = true;
    return;
  }

  const media = getMediaElement();

  const currentTime =
    media?.currentTime || 0;

  socket.emit("video:sync", {
    roomId: room.id,
    currentTime,
    isPlaying: false,
  });
};
  // =========================
  // SEEK
  // =========================

  const handleSeek = () => {
    if (!room || !isHost) {
      return;
    }

    const media = getMediaElement();

const currentTime =
  media?.currentTime || 0;

    socket.emit("video:sync", {
      roomId: room.id,
      currentTime,
      isPlaying:
        room.isPlaying,
    });
  };
  const handleSkip = (seconds: number) => {
  if (!room || !isHost) return;

  const media = getMediaElement();

  if (!media) return;

  const newTime = Math.max(
    0,
    Math.min(media.duration || Infinity, media.currentTime + seconds)
  );

  media.currentTime = newTime;

  socket.emit("video:sync", {
    roomId: room.id,
    currentTime: newTime,
    isPlaying: room.isPlaying,
  });
};

  // =========================
  // CHANGE MEDIA
  // =========================

  const changeMedia = () => {
    if (!room || !isHost) return;
    if (!videoUrl.trim()) return;

    if (selectedMediaType === "youtube" && !getYouTubeVideoId(videoUrl)) {
      setError("Enter a valid YouTube URL.");
      return;
    }

    setError("");

    socket.emit("media:change", {
      roomId: room.id,
      url: videoUrl.trim(),
      mediaType: selectedMediaType,
    });
  };
  const handleFileSelect = async (
  e: React.ChangeEvent<HTMLInputElement>
) => {
  const file = e.target.files?.[0];

  if (!file) return;

  if (selectedMediaType === "youtube") return;

  

  const formData = new FormData();
  formData.append("file", file);
  if (room?.id) {
  formData.append("roomId", room.id);
}

formData.append("mediaType", selectedMediaType);

  try {
    const response = await fetch(
      `${import.meta.env.VITE_SERVER_URL}/upload`,
      {
        method: "POST",
        body: formData,
      }
    );

    if (!response.ok) {
      throw new Error("Upload failed");
    }

    const data = await response.json();

    const mediaUrl =
      `${import.meta.env.VITE_SERVER_URL}${data.url}`;
      
    socket.emit("media:change", {
      roomId: room?.id,
      url: mediaUrl,
      mediaType: selectedMediaType,
    });

    

    console.log("Uploaded:", mediaUrl);
  } catch (error) {
    console.error("Upload error:", error);
  }
};

  const onYouTubeReady: YouTubeProps["onReady"] = (event) => {
    setMediaLoading(false);
    youtubePlayerRef.current = event.target;

    if (!room || room.mediaType !== "youtube") return;

    const elapsed = room.isPlaying
      ? (Date.now() - room.lastUpdated) / 1000
      : 0;

    syncYouTubePlayer(
      room.currentTime + Math.max(0, elapsed),
      room.isPlaying
    );
  };

  const onYouTubeStateChange: YouTubeProps["onStateChange"] = (event) => {
    if (!room || !isHost) return;

    if (event.data === YouTube.PlayerState.PLAYING) {
      socket.emit("video:sync", {
        roomId: room.id,
        currentTime: getYouTubeCurrentTime(),
        isPlaying: true,
      });
    } else if (event.data === YouTube.PlayerState.PAUSED) {
  if (document.hidden || interruptionRef.current) {
    mediaWasPlayingBeforeInterruptionRef.current = true;
    interruptionRef.current = true;
    return;
  }

  socket.emit("video:sync", {
    roomId: room.id,
    currentTime: getYouTubeCurrentTime(),
    isPlaying: false,
  });
}
    else if (event.data === YouTube.PlayerState.ENDED) {
      socket.emit("video:sync", {
        roomId: room.id,
        currentTime: getYouTubeCurrentTime(),
        isPlaying: false,
      });
    }
  };

  // =========================
  // CHAT
  // =========================
  const handleChatTyping = (value: string) => {
    setChatText(value);
    if (!room) return;
    socket.emit("typing", { roomId: room.id, username, isTyping: value.trim().length > 0 });
    if (typingTimeoutRef.current) window.clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = window.setTimeout(() => {
      socket.emit("typing", { roomId: room.id, username, isTyping: false });
    }, 1200);
  };



  const sendMessage = (e: React.FormEvent) => {
  e.preventDefault();

  if (!room || !chatText.trim()) return;
  socket.emit("typing", { roomId: room.id, username, isTyping: false });

  const message: Message = {
    id:
      Date.now().toString() +
      Math.random().toString(36).substring(2),

    sender: username,

    text: chatText.trim(),

    timestamp: Date.now(),
  };

  socket.emit("chat:message", {
    roomId: room.id,
    message,
  });

  setChatText("");
};

  const kickUser = (targetId: string) => {
    if (!room || !isHost || targetId === socket.id) return;
    socket.emit("room:kick", { roomId: room.id, targetId });
  };

  const forceMuteUser = (targetId: string) => {
    if (!room || !isHost || targetId === socket.id) return;
    socket.emit("room:force-mute", { roomId: room.id, targetId });
  };

  const transferHost = (targetId: string) => {
    if (!room || !isHost || targetId === socket.id) return;
    socket.emit("room:transfer-host", { roomId: room.id, targetId });
  };

  const formatRoomTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return h > 0 ? `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}` : `${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
  };

  // =========================
  // LEAVE
  // =========================

 const leaveRoom = () => {
  if (room) {
    cleanupVoice(true);

    socket.emit("room:leave", {
      roomId: room.id,
    });
  }

  localStorage.removeItem("syncroom_room");
  localStorage.removeItem("syncroom_username");

  setRoom(null);
  setUsers([]);
  setMessages([]);
  setReactions([]);
  setVoiceUsers([]);
  setPage("home");
};

  // =========================
  // HOME
  // =========================

  if (page === "home") {
    return (
      <main className="app homePage">
        <HeroScene />
        <section className="hero">

  

  <div className="homeTop">
            <div className="logo">SR</div>
            <span className="livePill">
              <span className="liveDot" />
              Live rooms
            </span>
          </div>

          <p className="eyebrow">WATCH TOGETHER, EVEN WHEN YOU'RE APART</p>

          <h1>
            Watch together.
            <br />
            <span className="heroAccent">Stay in sync.</span>
          </h1>

          <p className="heroText">
            Create a room, send the code, and watch your favorite videos
            together in real time.
          </p>

          <div className="wordRail" aria-hidden="true">
            <span>WATCH</span>
            <i>•</i>
            <span>SYNC</span>
            <i>•</i>
            <span>CHAT</span>
            <i>•</i>
            <span>REACT</span>
          </div>

          <div className="actions">
            <button
              className="primary homePrimary"
              onClick={() => {
                setError("");
                setShowCreate(true);
              }}
            >
              <span>Create Room</span>
              <b>→</b>
            </button>

            <button
              className="secondary homeSecondary"
              onClick={() => {
                setError("");
                setShowJoin(true);
              }}
            >
              Join with a code
            </button>
          </div>

          <div className="homeFeatures">
            <div>
              <span>01</span>
              <strong>Create</strong>
              <small>Start a private room</small>
            </div>
            <div>
              <span>02</span>
              <strong>Share</strong>
              <small>Send the room code</small>
            </div>
            <div>
              <span>03</span>
              <strong>Watch</strong>
              <small>Stay synced together</small>
            </div>
          </div>

          <div className="connection">
            <span
              className={
                status === "Connected"
                  ? "dot online"
                  : status === "Disconnected"
                  ? "dot offline"
                  : "dot connecting"
              }
            />
            {status}
          </div>
        </section>

        {/* CREATE */}

        {showCreate && (
          <div className="modalOverlay">
            <div className="modal">
              <h2>Create Room</h2>

              <label>Your name</label>

              <input
                value={username}
                onChange={(e) =>
                  setUsername(e.target.value)
                }
                placeholder="Enter your name"
              />

              <label>
                Video URL
                <span>
                  optional
                </span>
              </label>

              <input
                value={videoUrl}
                onChange={(e) =>
                  setVideoUrl(e.target.value)
                }
                placeholder="https://example.com/video.mp4"
              />

              {error && (
                <p className="error">
                  {error}
                </p>
              )}

              <div className="modalActions">
                <button
                  className="secondary"
                  onClick={() =>
                    setShowCreate(false)
                  }
                >
                  Cancel
                </button>

                <button
                  className="primary"
                  onClick={createRoom}
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        )}

        {/* JOIN */}

        {showJoin && (
          <div className="modalOverlay">
            <div className="modal">
              <h2>Join Room</h2>

              <label>Your name</label>

              <input
                value={username}
                onChange={(e) =>
                  setUsername(e.target.value)
                }
                placeholder="Enter your name"
              />

              <label>Room code</label>

              <div className="codeInputWrap">
                <input
                  className="roomCodeInput"
                  value={roomCode}
                  maxLength={6}
                  autoCapitalize="characters"
                  onChange={(e) =>
                    setRoomCode(
                      e.target.value
                        .toUpperCase()
                        .replace(/[^A-Z0-9]/g, "")
                        .slice(0, 6)
                    )
                  }
                  placeholder="ABC123"
                  inputMode="text"
                />
                <span className="codeHint">
                  {roomCode.length}/6 characters
                </span>
              </div>

              {error && (
                <p className="error">
                  {error}
                </p>
              )}

              <div className="modalActions">
                <button
                  className="secondary"
                  onClick={() =>
                    setShowJoin(false)
                  }
                >
                  Cancel
                </button>

                <button
                  className="primary"
                  onClick={joinRoom}
                >
                  Join
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    );
  }

  // =========================
  // ROOM
  // =========================

  return (
    <main className="roomPage">
      <header className="topbar">
        <div>
          <strong>SyncRoom</strong>

          <div className="roomShare">
  <button
    className="roomCode"
    onClick={() => {
      navigator.clipboard.writeText(room?.id || "");
      alert("Room code copied!");
    }}
  >
    {room?.id}
  </button>

  <button
    className="copyInviteButton"
    onClick={async () => {
  if (!room) return;

  const inviteLink =
    `${window.location.origin}/?room=${room.id}`;

  if (navigator.share) {
    try {
      await navigator.share({
        title: "Join my SyncRoom",
        text: "Join me in SyncRoom 🎬",
        url: inviteLink,
      });
    } catch {
      // User closed the share menu
    }
  } else {
    await navigator.clipboard.writeText(inviteLink);
    alert("Invite link copied!");
  }
}}
  >
    🔗 Share
  </button>
</div>
        </div>

        <div className="topRight">
          <span className="status">
  <span
    className={`dot ${
      status === "Connected"
        ? "online"
        : status === "Disconnected"
        ? "offline"
        : "connecting"
    }`}
  />
  {status}
</span>

          <button
            className="secondary small"
            onClick={leaveRoom}
          >
            Leave
          </button>
        </div>
      </header>

      <div className="roomLayout">
        {/* VIDEO */}

        <section className="videoSection">
          <div className="videoBox" id="syncroom-player">
{mediaLoading && (
  <div className="mediaLoadingOverlay">
    <div className="mediaSpinner" />
    <span>Loading media...</span>
  </div>
)}

  {room?.mediaType === "youtube" ? (
    <YouTube
  className="youtubePlayer"
  iframeClassName="youtubeIframe"
  videoId={getYouTubeVideoId(room.mediaUrl)}
  opts={{
    width: "100%",
    height: "100%",
    playerVars: {
      autoplay: 0,
      controls: isHost ? 1 : 0,
      playsinline: 1,
      rel: 0,
    },
  }}
  onReady={onYouTubeReady}
  onStateChange={onYouTubeStateChange}
/>

  ) : room?.mediaType === "audio" ? (
    <audio
    onLoadedData={() => setMediaLoading(false)}
      ref={audioRef}
      src={room.mediaUrl}
      controls={isHost}
      onPlay={handlePlay}
      onPause={handlePause}
      onSeeked={handleSeek}
    />
  ) : (
    <video
    onLoadedData={() => setMediaLoading(false)}
      ref={videoRef}
      src={room?.mediaUrl}
      controls={isHost}
      playsInline
      onPlay={handlePlay}
      onPause={handlePause}
      onSeeked={handleSeek}
    />
    )}

  <div className="reactionOverlay">
    {reactions.map((item) => (
      <div
        key={item.id}
        className="floatingReaction"
        style={
          {
            "--reaction-x": `${item.x}px`,
            "--reaction-y": `${item.y}px`,
            "--reaction-rotate": `${item.rotate}deg`,
            "--reaction-scale": item.scale,
          } as React.CSSProperties
        }
      >
        <span>{item.reaction}</span>
      </div>
    ))}
  </div>

   </div>

   <div className="watchProgress">
     <div className="watchProgressTop">
       <span>🎬 Watch Together</span>
       <span>{videoDuration > 0
         ? `${Math.floor(videoCurrentTime/60)}:${String(Math.floor(videoCurrentTime%60)).padStart(2,"0")} / ${Math.floor(videoDuration/60)}:${String(Math.floor(videoDuration%60)).padStart(2,"0")}`
         : "Live sync"}</span>
     </div>
     <div className="watchProgressTrack">
       <div className="watchProgressFill" style={{ width: `${Math.min(100, Math.max(0, mediaProgress))}%` }} />
     </div>
   </div>

   <div className="roomTimer">🕐 Room time <strong>{formatRoomTime(roomElapsed)}</strong></div>

   <div className="playerActions">
    {needsMediaResume && room?.isPlaying && (
      <button
        type="button"
        className="mediaResumeButton"
        onClick={() => {
          void resumeMediaAfterInterruption();
        }}
      >
        ▶ Resume playback
      </button>
    )}
   </div>

<div className="playerActions">
  <button
    type="button"
    className="secondary"
    onClick={async () => {
  const player = document.getElementById("syncroom-player");

  if (!player) return;

  if (!document.fullscreenElement) {
    await player.requestFullscreen();
  } else {
    await document.exitFullscreen();
  }
}}
  >
    {isFullscreen ? "⛶ Exit Fullscreen" : "⛶ Fullscreen"}
  </button>
</div>

<div className="reactionBar">
  {["❤️", "😂", "😮", "😢", "👍", "🔥"].map((reaction) => (
    <button
  type="button"
  key={reaction}
  onClick={(e) => {
    e.preventDefault();

    console.log("REACTION BUTTON CLICKED:", reaction);
    console.log("ROOM:", room?.id);
    console.log("SOCKET CONNECTED:", socket.connected);

    if (!room) {
      console.log("NO ROOM");
      return;
    }

    socket.emit("reaction:send", {
      roomId: room.id,
      reaction,
      username,
    });

    console.log("REACTION SENT");
  }}
>
  {reaction}
</button>
  ))}
</div>
{!isHost && !syncEnabled && (
  <button
    className="syncButton"
    onClick={() => {
      setSyncEnabled(true);

      if (!room) return;

      const elapsed = room.isPlaying
        ? (Date.now() - room.lastUpdated) / 1000
        : 0;

      const targetTime =
        room.currentTime + Math.max(0, elapsed);

      if (room.mediaType === "youtube") {
        syncYouTubePlayer(targetTime, room.isPlaying);
        return;
      }

      const video = getMediaElement();

      if (!video) return;

      video.currentTime = targetTime;

      if (room.isPlaying) {
        video.play().catch(() => {});
      }
    }}
  >
    ▶ Enable Video Sync
  </button>
)}

          <div className="mediaControls">
{isHost && room.mediaType !== "youtube" && (
  <div className="skipControls">
    <button
      type="button"
      className="secondary"
      onClick={() => handleSkip(-10)}
    >
      ⏪ 10s
    </button>

    <button
      type="button"
      className="secondary"
      onClick={() => handleSkip(10)}
    >
      10s ⏩
    </button>
  </div>
)}
           {isHost && (
            
    <div className="mediaTypeSelector">
      <button
        type="button"
        className={
          selectedMediaType === "video"
            ? "primary"
            : "secondary"
        }
        onClick={() =>
          setSelectedMediaType("video")
        }
      >
        🎬 Video
      </button>

      <button
        type="button"
        className={
          selectedMediaType === "audio"
            ? "primary"
            : "secondary"
        }
        onClick={() =>
          setSelectedMediaType("audio")
        }
      >
        🎵 Music
      </button>

      <button
        type="button"
        className={
          selectedMediaType === "youtube"
            ? "primary"
            : "secondary"
        }
        onClick={() =>
          setSelectedMediaType("youtube")
        }
      >
        ▶️ YouTube
      </button>
    </div>
  )}
{isHost && selectedMediaType !== "youtube" && (
  <>
    <input
      ref={fileInputRef}
      type="file"
      accept={
        selectedMediaType === "video"
          ? "video/*"
          : "audio/*"
      }
      style={{ display: "none" }}
      onChange={handleFileSelect}
    />

    <button
      type="button"
      className="secondary"
      onClick={() => fileInputRef.current?.click()}
    >
      📁 Choose {selectedMediaType === "video" ? "Video" : "Music"}
    </button>
  </>
)}
  {isHost && (
  <input
    value={videoUrl}
    onChange={(e) =>
      setVideoUrl(e.target.value)
    }
    placeholder={
      selectedMediaType === "youtube"
        ? "Paste YouTube video URL"
        : selectedMediaType === "audio"
        ? "Paste direct music URL (.mp3)"
        : "Paste direct video URL (.mp4)"
    }
  />
)}

  {isHost && (
    <button
      className="primary"
      onClick={changeMedia}
    >
      {selectedMediaType === "youtube"
        ? "Play YouTube"
        : selectedMediaType === "audio"
        ? "Play Music"
        : "Change Video"}
    </button>
  )}

</div>
{isHost && mediaLibrary.length > 0 && (
  <div className="mediaLibrary">
    <h3>📚 Media Library</h3>

    <div className="mediaLibraryList">
      {mediaLibrary.map((media, index) => (
        <button
          key={`${media.url}-${index}`}
          type="button"
          className="mediaLibraryItem"
          onClick={() => {
            socket.emit("media:change", {
              roomId: room?.id,
              url: media.url,
              mediaType: media.type,
            });
          }}
        >
          <span>
            {media.type === "video" ? "🎬" : "🎵"}
          </span>

          <span>{media.name}</span>
        </button>
      ))}
    </div>
  </div>
)}
          <div className={`infoCard ${isHost ? "hostInfo" : "guestInfo"}`}>
  <strong>
    {isHost
      ? "👑 You are the host"
      : "👀 You are watching as a guest"}
  </strong>

  <p>
    {isHost
      ? "You control playback. Your play, pause and seek actions are synchronized with everyone."
      : "Playback is controlled by the host. You can watch, react, and chat while the host controls the video."}
  </p>
</div>

        </section>

        {/* SIDEBAR */}

        <aside className="sidebar">
          <section className="card voiceCard">
            <div className="cardHeader">
              <strong>🎙️ Voice Chat</strong>
              <span
                className={`voiceStatus ${
                  voiceUsers.length > 0 ? "active" : ""
                }`}
              >
                {voiceUsers.length > 0 ? "LIVE" : "OFF"}
              </span>
            </div>

            <div className="voiceBody">
              {voiceUsers.length > 0 ? (
                <div className="voicePeople">
                  {voiceUsers.map((user) => {
                    const isMe = user.id === socket.id;

                    return (
                      <div
                        className="voicePerson"
                        key={user.id}
                      >
                        <span className="voiceAvatar">
                          {user.username
                            .charAt(0)
                            .toUpperCase() || "?"}
                        </span>

                        <span>
                          <strong>
                            {isMe
                              ? `${user.username || "You"} (You)`
                              : user.username}
                          </strong>
                          <small>
                            {user.muted
                              ? "Muted"
                              : "Voice connected"}
                          </small>
                        </span>

                        <span className="voiceMic">
                          {user.muted ? "🔇" : "🎙️"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="voiceHint">
                  No one is in voice chat yet.
                </p>
              )}

              <div className="voiceActions">
                {voiceEnabled ? (
                  <>
                    <button
                      type="button"
                      className="secondary"
                      onClick={toggleVoiceMute}
                    >
                      {voiceMuted ? "🔇 Unmute" : "🎙️ Mute"}
                    </button>

                    <button
                      type="button"
                      className="danger"
                      onClick={() => void toggleVoice()}
                    >
                      Leave voice
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="primary voiceJoinButton"
                    onClick={() => void toggleVoice()}
                  >
                    🎙️ Join Voice Chat
                  </button>
                )}
              </div>
            </div>
          </section>

          <section className="card">
            <div className="cardHeader">
              <strong>
                People ({users.length})
              </strong>
            </div>

            <div className="watchingSummary">👀 {users.length} {users.length === 1 ? "person" : "people"} watching</div>

            <div className="users">
  {users.length <= 1 ? (
    <div className="emptyUsers">
      👀 No one else is here yet
      <small>Share the room link to invite someone.</small>
    </div>
  ) : (
    users.map((user) => (
      <div
        className="user"
        key={user.id}
      >
        <span className="dot online" />

        <span className="usernameWithBadge">
          <span>{user.username}</span>

          {user.id === socket.id && (
            <small className="youBadge">YOU</small>
          )}
        </span>

        {user.isHost && (
          <small className="hostBadge">👑 HOST</small>
        )}

        {isHost && user.id !== socket.id && (
          <div className="userModerationActions">
            <button type="button" title="Transfer host" onClick={() => transferHost(user.id)}>👑</button>
            <button type="button" title="Mute voice" onClick={() => forceMuteUser(user.id)}>🔇</button>
            <button type="button" className="danger" title="Kick user" onClick={() => kickUser(user.id)}>✕</button>
          </div>
        )}
      </div>
    ))
  )}
</div>
          </section>

          <section className="card chatCard">
            <div className="cardHeader">
              <strong>Chat</strong>
            </div>

            <div className="messages">
  {messages.length === 0 && (
    <p className="empty">
      No messages yet.
    </p>
  )}

  {messages.map((message) => {
    const isSystem = message.sender === "SYSTEM";
    const isMine = message.sender === username;

    return (
      <div
        key={message.id}
        className={`message ${
          isSystem
            ? "systemMessage"
            : isMine
            ? "myMessage"
            : "otherMessage"
        }`}
      >
        {!isSystem && (
          <strong>
            {isMine ? "You" : message.sender}
          </strong>
        )}

        <span>{message.text}</span>

        <small>
          {new Date(message.timestamp).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </small>
      </div>
    );
  })}

  <div ref={messagesEndRef} />
</div>

            {typingUsers.filter((name) => name !== username).length > 0 && (
              <div className="typingIndicator">
                {typingUsers.filter((name) => name !== username).slice(0,2).join(", ")}
                {typingUsers.filter((name) => name !== username).length === 1 ? " is typing..." : " are typing..."}
              </div>
            )}

            <form
              className="chatInput"
              onSubmit={sendMessage}
            >
              <input
                value={chatText}
                onChange={(e) => handleChatTyping(e.target.value)}
                placeholder="Type a message..."
              />

              <button
                className="primary"
                type="submit"
              >
                Send
              </button>
            </form>
          </section>
        </aside>
      </div>
    </main>
  );
}

export default App;