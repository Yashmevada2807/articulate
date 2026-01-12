import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { RoomManager } from './RoomManager';
import { v4 as uuidv4 } from 'uuid';
import { ClientEvents, ServerEvents, Player } from './types';

const app = express();
app.use(cors());

const httpServer = createServer(app);
const io = new Server<ClientEvents, ServerEvents>(httpServer, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

const roomManager = RoomManager.getInstance();

io.on('connection', (socket) => {
    // console.log('New client connected:', socket.id);

    socket.on('create-room', (username) => {
        const roomId = uuidv4().substring(0, 6).toUpperCase();
        try {
            const room = roomManager.createRoom(roomId, socket.id, io);
            const player: Player = {
                id: socket.id,
                username,
                score: 0,
                isHost: true,
                socketId: socket.id
            };
            room.addPlayer(player);
            socket.join(roomId);

            socket.emit('room-joined', { roomId, players: Array.from(room.players.values()) });
            io.to(roomId).emit('player-joined', player);
        } catch (e) {
            socket.emit('error', 'Failed to create room');
        }
    });

    socket.on('join-room', (roomId, username) => {
        const room = roomManager.getRoom(roomId);
        if (!room) {
            socket.emit('error', 'Room not found');
            return;
        }

        const player: Player = {
            id: socket.id,
            username,
            score: 0,
            isHost: false,
            socketId: socket.id
        };
        room.addPlayer(player);
        socket.join(roomId);

        socket.emit('room-joined', { roomId, players: Array.from(room.players.values()) });
        io.to(roomId).emit('player-joined', player);
    });

    socket.on('start-game', () => {
        const room = roomManager.getRoomByPlayer(socket.id);
        if (!room) return;
        if (room.hostId !== socket.id) {
            socket.emit('error', 'Only host can start game');
            return;
        }
        room.game.startGame();
    });

    socket.on('draw', (data) => {
        const room = roomManager.getRoomByPlayer(socket.id);
        if (room) {
            // Validate it's the drawer
            if (room.game.currentDrawer?.id === socket.id) {
                socket.to(room.id).emit('draw', data);
            }
        }
    });

    socket.on('clear-canvas', () => {
        const room = roomManager.getRoomByPlayer(socket.id);
        if (room && room.game.currentDrawer?.id === socket.id) {
            io.to(room.id).emit('clear-canvas');
        }
    });

    const rateLimit = new Map<string, number>();

    socket.on('guess', (word) => {
        // Anti-Spam
        const lastMsgTime = rateLimit.get(socket.id) || 0;
        const now = Date.now();
        if (now - lastMsgTime < 500) { // 500ms limit
            return;
        }
        rateLimit.set(socket.id, now);

        const room = roomManager.getRoomByPlayer(socket.id);
        if (room) {
            const isCorrect = room.game.handleGuess(socket.id, word);
            if (!isCorrect) {
                // Send chat message if incorrect
                io.to(room.id).emit('chat-message', {
                    id: uuidv4(),
                    playerId: socket.id,
                    username: room.getPlayer(socket.id)?.username || 'Unknown',
                    text: word,
                    timestamp: Date.now(),
                    type: 'chat'
                });
            } else {
                // System message for correct guess
                io.to(room.id).emit('chat-message', {
                    id: uuidv4(),
                    playerId: socket.id,
                    username: 'System',
                    text: `${room.getPlayer(socket.id)?.username} guessed the word!`,
                    timestamp: Date.now(),
                    isSystem: true,
                    type: 'guess'
                });
            }
        }
    });

    socket.on('select-word', (word) => {
        const room = roomManager.getRoomByPlayer(socket.id);
        if (room && room.game.currentDrawer?.id === socket.id) {
            room.game.handleWordSelection(word);
        }
    });

    socket.on('request-words', () => {
        const room = roomManager.getRoomByPlayer(socket.id);
        if (room && room.game.currentDrawer?.id === socket.id) {
            // Re-send words
            const words = room.game.getWordsToSelect(); // Need to expose this or access public property
            if (words && words.length > 0) {
                socket.emit('word-to-select', words);
            }
        }
    });

    socket.on('disconnect', () => {
        const room = roomManager.getRoomByPlayer(socket.id);
        if (room) {
            room.removePlayer(socket.id);
            io.to(room.id).emit('player-left', socket.id);

            if (room.getPlayerCount() === 0) {
                roomManager.removeRoom(room.id);
            } else {
                // Handle disconnect effects on game loop if needed (e.g. if drawer left)
                // For MVP, we might leave it or fast-forward turn
            }
        }
    });

    // WebRTC Signaling
    socket.on('join-voice', () => {
        const room = roomManager.getRoomByPlayer(socket.id);
        if (room) {
            socket.to(room.id).emit('user-joined-voice', socket.id);
        }
    });

    socket.on('signal', (data: { targetId: string, signal: any }) => {
        io.to(data.targetId).emit('signal', {
            senderId: socket.id,
            signal: data.signal
        });
    });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
