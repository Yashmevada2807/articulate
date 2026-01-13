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
            isHost: false, // Rejoining logic might need to be smarter about restoring host, but for now simple
            socketId: socket.id
        };
        room.addPlayer(player);
        socket.join(roomId);

        const activeGame = roomManager.isGameActive(roomId);
        const gameState = activeGame ? roomManager.getGameState(roomId) : null;

        socket.emit('room-joined', {
            roomId,
            players: Array.from(room.players.values()),
            gameState
        });
        io.to(roomId).emit('player-joined', player);
    });

    socket.on('start-game', () => {
        const room = roomManager.getRoomByPlayer(socket.id);
        if (!room) return;
        if (room.hostId !== socket.id) {
            socket.emit('error', 'Only host can start game');
            return;
        }
        try {
            room.game.startGame();
        } catch (e: any) {
            socket.emit('error', e.message || 'Failed to start game');
        }
    });

    socket.on('request-restart', () => {
        console.log(`[Socket ${socket.id}] request-restart`);
        const room = roomManager.getRoomByPlayer(socket.id);
        if (!room) {
            console.error(`[Socket ${socket.id}] Room not found for restart request`);
            return;
        }
        if (room.hostId !== socket.id) {
            console.error(`[Socket ${socket.id}] Not host, cannot restart`);
            socket.emit('error', 'Only host can restart game');
            return;
        }
        room.game.restartGame();
    });

    socket.on('vote-play-again', () => {
        console.log(`[Socket ${socket.id}] vote-play-again`);
        const room = roomManager.getRoomByPlayer(socket.id);
        if (room) {
            room.game.votePlayAgain(socket.id);
        } else {
            console.error(`[Socket ${socket.id}] Room not found for vote`);
        }
    });

    socket.on('voice-mute-change', (isMuted) => {
        const room = roomManager.getRoomByPlayer(socket.id);
        if (room) {
            const player = room.getPlayer(socket.id);
            if (player) {
                player.isMuted = isMuted;
                io.to(room.id).emit('voice-state-update', { userId: socket.id, isMuted, isInVoice: true });
            }
        }
    });

    // ...

    // WebRTC Signaling
    socket.on('join-voice', () => {
        const room = roomManager.getRoomByPlayer(socket.id);
        if (room) {
            const player = room.getPlayer(socket.id);
            if (player) {
                player.isInVoice = true;
                player.isMuted = false; // Default unmuted on join
                // Broadcast both signaling and state update
                socket.to(room.id).emit('user-joined-voice', socket.id);
                io.to(room.id).emit('voice-state-update', { userId: socket.id, isMuted: false, isInVoice: true });
            }
        }
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

    // --- Team Mode Handler ---

    socket.on('update-team-mode', (config) => {
        const room = roomManager.getRoomByPlayer(socket.id);
        if (!room || room.hostId !== socket.id) return;

        if (config.enabled && !room.teamMode.enabled) {
            // Enabling
            room.enableTeamMode(config.selectionMode);
        } else if (config.enabled === false && room.teamMode.enabled) {
            // Disabling
            room.disableTeamMode();
        } else if (room.teamMode.enabled) {
            // Updating sub-config
            if (config.selectionMode) {
                room.setTeamSelectionMode(config.selectionMode);
            }
        }
    });

    socket.on('join-team', (team, role) => {
        const room = roomManager.getRoomByPlayer(socket.id);
        if (!room) return;

        const result = room.joinTeam(socket.id, team, role);
        if (!result.success) {
            socket.emit('error', result.reason || 'Failed to join team');
        }
    });

    socket.on('lock-teams', () => {
        const room = roomManager.getRoomByPlayer(socket.id);
        if (!room || room.hostId !== socket.id) return;

        if (room.teamMode.enabled && room.teamMode.selectionMode === 'manual') {
            // For random, randomizeTeams() locks it. For manual, explicit lock?
            // Actually, 'randomizeTeams' isn't exposed via socket yet?
            // If selectionMode is random, we should probably have a 'randomize' action or just do it on start.
            // Prompt says: "When selectionMode = random and host starts game: Server must Shuffle..." 
            // So explicit randomize might not be needed?
            // But manual mode needs locking? Or start game locks it?
            // "Before starting game ... Server must verify ... Teams locked"
            // Prompt step 3: "Manual Team Selection Logic ... Teams cannot exceed size difference... "
            // Prompt step 4: "Random ... Locked ... Broadcast assignments".
            // Let's add 'randomize-teams' or just handle it at start?
            // Wait, step 4 says "When selectionMode = random and host starts game: Server must Shuffle...". 
            // So we don't need a separate event for random. 
            // But for LOCK? "After locking: Team changes are rejected".
            // Maybe manual locking is useful.
            room.teamMode.teamsLocked = true;
            room.broadcastTeamMode();
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
