export enum GameStatus {
    LOBBY = 'LOBBY',
    CHOOSING_WORD = 'CHOOSING_WORD',
    DRAWING = 'DRAWING',
    SCORING = 'SCORING',
    GAME_OVER = 'GAME_OVER'
}

export interface Player {
    id: string;
    username: string;
    score: number;
    isHost: boolean;
    socketId: string;
}

export interface Point {
    x: number;
    y: number;
}

export interface DrawLine {
    start: Point;
    end: Point;
    color: string;
    width: number;
}

export interface Round {
    currentRound: number;
    totalRounds: number;
}

export interface ChatMessage {
    id: string;
    playerId: string;
    username: string;
    text: string;
    timestamp: number;
    isSystem?: boolean;
    type?: 'guess' | 'chat';
}

// Client -> Server Events
export interface ClientEvents {
    'create-room': (username: string) => void;
    'join-room': (roomId: string, username: string) => void;
    'start-game': () => void;
    'draw': (data: DrawLine) => void;
    'clear-canvas': () => void;
    'guess': (word: string) => void;
    'select-word': (word: string) => void;
    'play-again': () => void;
    'signal': (data: { targetId: string, signal: any }) => void;
    'join-voice': () => void;
    'request-words': () => void;
}

// Server -> Client Events
export interface ServerEvents {
    'room-joined': (data: { roomId: string, players: Player[] }) => void;
    'player-joined': (player: Player) => void;
    'player-left': (playerId: string) => void;
    'game-started': () => void;
    'new-round': (round: number) => void;
    'turn-start': (data: { drawerId: string, roundEnd: number }) => void; // Drawer gets more info via separate event or logic
    'word-to-select': (words: string[]) => void; // Sent only to drawer
    'word-selected': (length: number) => void; // Sent to everyone else
    'draw': (data: DrawLine) => void;
    'clear-canvas': () => void;
    'chat-message': (message: ChatMessage) => void;
    'correct-guess': (data: { playerId: string, word: string, score: number }) => void;
    'update-scores': (players: Player[]) => void;
    'turn-end': (data: { word: string, scores: Player[] }) => void;
    'game-over': (data: { winner: Player[] }) => void;
    'error': (message: string) => void;
    'signal': (data: { senderId: string, signal: any }) => void;
    'word-hint': (hint: string) => void;
    'user-joined-voice': (userId: string) => void;
    'timer-update': (time: number) => void;
}
