import { Room } from './Room';

export class RoomManager {
    private rooms: Map<string, Room> = new Map();
    private static instance: RoomManager;

    private constructor() { }

    public static getInstance(): RoomManager {
        if (!RoomManager.instance) {
            RoomManager.instance = new RoomManager();
        }
        return RoomManager.instance;
    }

    public createRoom(roomId: string, hostId: string, io: any): Room {
        if (this.rooms.has(roomId)) {
            throw new Error('Room already exists');
        }
        const room = new Room(roomId, hostId, io);
        this.rooms.set(roomId, room);
        return room;
    }

    public getRoom(roomId: string): Room | undefined {
        return this.rooms.get(roomId);
    }

    public removeRoom(roomId: string): void {
        this.rooms.delete(roomId);
    }

    public getRoomByPlayer(playerId: string): Room | undefined {
        for (const room of this.rooms.values()) {
            if (room.hasPlayer(playerId)) {
                return room;
            }
        }
        return undefined;
    }

    public isGameActive(roomId: string): boolean {
        const room = this.rooms.get(roomId);
        return room ? room.game.status !== 'LOBBY' && room.game.status !== 'GAME_OVER' : false;
    }

    public getGameState(roomId: string): any {
        const room = this.rooms.get(roomId);
        if (!room) return null;
        return {
            status: room.game.status,
            currentDrawer: room.game.currentDrawer,
            round: room.game.currentRound,
            timeLeft: room.game.timer, // You might need to expose a getter for timer on Game class if private
            // Add other necessary state here like scores, etc which are already in room.players or handled by room-joined
        };
    }
}

