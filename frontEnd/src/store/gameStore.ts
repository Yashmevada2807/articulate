import { create } from 'zustand';

export type GameStatus = 'LOBBY' | 'CHOOSING_WORD' | 'DRAWING' | 'SCORING' | 'GAME_OVER';

export interface Player {
    id: string;
    username: string;
    score: number;
    isHost: boolean;
    socketId: string;
}

interface GameState {
    roomId: string | null;
    players: Player[];
    currentUser: Player | null;
    status: GameStatus;
    socket: any; // We'll type this loosely here or import the client type if shared

    setRoomId: (id: string) => void;
    setPlayers: (players: Player[]) => void;
    setCurrentUser: (player: Player) => void;
    setGameStatus: (status: GameStatus) => void;
    setSocket: (socket: any) => void;
    reset: () => void;
}

export const useGameStore = create<GameState>((set) => ({
    roomId: null,
    players: [],
    currentUser: null,
    status: 'LOBBY',
    socket: null,

    setRoomId: (roomId) => set({ roomId }),
    setPlayers: (players) => set({ players }),
    setCurrentUser: (currentUser) => set({ currentUser }),
    setGameStatus: (status) => set({ status }),
    setSocket: (socket) => set({ socket }),
    reset: () => set({
        roomId: null,
        players: [],
        currentUser: null,
        status: 'LOBBY',
        socket: null
    })
}));
