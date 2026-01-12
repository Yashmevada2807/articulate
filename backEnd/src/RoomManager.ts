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
}
