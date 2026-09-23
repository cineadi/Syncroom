export interface User {
  id: string;
  username: string;
  isHost: boolean;
}

export interface RoomState {
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
}

export const rooms = new Map<string, RoomState>();

export function getComputedPlayback(room: RoomState): number {
  if (!room.isPlaying) {
    return room.currentTime;
  }

  const elapsed =
    (Date.now() - room.lastUpdated) / 1000;

  return room.currentTime + elapsed;
}
