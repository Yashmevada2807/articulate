import { Player, GameStatus, ChatMessage } from './types';
import { Game } from './Game';
import { Socket } from 'socket.io';
import { Server } from 'socket.io';

export class Room {
    public id: string;
    public hostId: string;
    public players: Map<string, Player> = new Map();
    public game: Game;

    public io: Server;

    constructor(id: string, hostId: string, io: Server) {
        this.id = id;
        this.hostId = hostId;
        this.io = io;
        this.game = new Game(this, io);
    }

    public addPlayer(player: Player): void {
        this.players.set(player.id, player);
    }

    public removePlayer(playerId: string): void {
        this.players.delete(playerId);
        if (playerId === this.hostId) {
            // Assign new host if possible
            const remainingPlayers = Array.from(this.players.values());
            if (remainingPlayers.length > 0) {
                this.hostId = remainingPlayers[0].id;
                remainingPlayers[0].isHost = true;
            }
        }
    }

    public hasPlayer(playerId: string): boolean {
        return this.players.has(playerId);
    }

    public getPlayer(playerId: string): Player | undefined {
        return this.players.get(playerId);
    }

    public getPlayerCount(): number {
        return this.players.size;
    }

    public toJSON() {
        return {
            id: this.id,
            hostId: this.hostId,
            players: Array.from(this.players.values()),
            status: this.game.status
        };
    }
}
