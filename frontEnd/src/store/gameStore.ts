import { create } from 'zustand';

export type GameStatus = 'LOBBY' | 'CHOOSING_WORD' | 'DRAWING' | 'SCORING' | 'GAME_OVER';

export interface Player {
    id: string;
    username: string;
    score: number;
    isHost: boolean;
    socketId: string;
    isInVoice?: boolean;
    isMuted?: boolean;
    team?: 'A' | 'B' | null;
    role?: 'player' | 'spectator';
}

export interface TeamModeConfig {
    enabled: boolean;
    selectionMode: 'manual' | 'random';
    teamsLocked: boolean;
}

interface GameState {
    roomId: string | null;
    players: Player[];
    currentUser: Player | null;
    status: GameStatus;
    teamMode: TeamModeConfig;
    socket: any; // We'll type this loosely here or import the client type if shared

    setRoomId: (id: string) => void;
    setPlayers: (players: Player[]) => void;
    updatePlayer: (id: string, updates: Partial<Player>) => void;
    setCurrentUser: (player: Player) => void;
    currentRound: number;
    totalRounds: number;
    setGameStatus: (status: GameStatus) => void;
    setTeamMode: (config: TeamModeConfig) => void;
    setSocket: (socket: any) => void;
    syncGameState: (state: any) => void;
    reset: () => void;
}

export const useGameStore = create<GameState>((set) => ({
    roomId: null,
    players: [],
    currentUser: null,
    status: 'LOBBY',
    teamMode: {
        enabled: false,
        selectionMode: 'manual',
        teamsLocked: false
    },
    socket: null,
    currentRound: 1,
    totalRounds: 3,

    setRoomId: (roomId) => set({ roomId }),
    setPlayers: (players) => set({ players }),
    updatePlayer: (id, updates) => set((state) => ({
        players: state.players.map(p => p.id === id ? { ...p, ...updates } : p)
    })),
    setCurrentUser: (currentUser) => set({ currentUser }),
    setGameStatus: (status) => set({ status }),
    setTeamMode: (teamMode) => set({ teamMode }),
    setSocket: (socket) => set({ socket }),
    syncGameState: (state) => set((prev) => ({
        ...prev,
        status: state.status,
        teamMode: state.teamMode || prev.teamMode,
        currentRound: state.round || state.currentRound || 1,
        // Sync other state if available
    })),
    reset: () => set({
        roomId: null,
        players: [],
        currentUser: null,
        status: 'LOBBY',
        teamMode: {
            enabled: false,
            selectionMode: 'manual',
            teamsLocked: false
        },
        socket: null,
        currentRound: 1,
        totalRounds: 3
    })
}));
