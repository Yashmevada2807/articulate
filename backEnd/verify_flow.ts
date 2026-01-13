
import { io, Socket } from 'socket.io-client';

const URL = 'http://localhost:3001';

const socket1 = io(URL);
const socket2 = io(URL);

let roomId = '';
let currentTargetWord = '';
let round = 1;
let turnsInRound = 0;

// Shared state to coordinate guessing
// When drawer picks a word, we store it here so the guesser can use it.

function setupClient(socket: any, name: string, otherSocket: any) {
    socket.on('connect', () => console.log(`[${name}] Connected: ${socket.id}`));

    socket.on('room-created', (id: string) => {
        roomId = id;
        console.log(`[${name}] Room Created: ${id}`);
        otherSocket.emit('join-room', { roomId: id, username: 'Joiner' });
    });

    socket.on('player-joined', (players: any[]) => {
        if (name === 'Host' && players.length === 2) {
            console.log(`[${name}] 2 Players present. Starting game...`);
            socket.emit('start-game');
        }
    });

    socket.on('turn-start', (data: any) => {
        console.log(`--- [${name}] TURN START (Round ${data.currentRound}/${data.totalRounds}) ---`);
        if (data.currentRound > round) {
            console.log(`*** ROUND ADVANCED: ${round} -> ${data.currentRound} ***`);
            round = data.currentRound;
        }
    });

    socket.on('word-to-select', (words: string[]) => {
        const word = words[0];
        console.log(`[${name}] (Drawer) received words. Selecting: "${word}"`);
        currentTargetWord = word;
        socket.emit('select-word', word);
    });

    socket.on('word-selected', (len: number) => {
        // If I am NOT the drawer, I should guess
        // We know who is drawer based on who got 'word-to-select', but simpler:
        // if this socket didn't just set the word, guess it.
        // actually 'select-word' is emitted by drawer. 
        // Wait, 'word-selected' goes to everyone.

        // We need a small delay to ensure server handles state
        setTimeout(() => {
            if (currentTargetWord) {
                // Try to guess. If I am drawer, server ignores it. If I am guesser, it works.
                // Both trying to guess is fine for this test.
                console.log(`[${name}] Attempting to guess: "${currentTargetWord}"`);
                socket.emit('guess', currentTargetWord);
            }
        }, 500);
    });

    socket.on('new-round', (r: number) => {
        console.log(`🔥🔥🔥 [${name}] NEW ROUND EVENT RECEIVED: Round ${r} 🔥🔥🔥`);
    });

    socket.on('correct-guess', (data: any) => {
        console.log(`[${name}] Correct guess by ${data.playerId}`);
    });

    socket.on('turn-end', (data: any) => {
        console.log(`[${name}] Turn Ended. Word was: ${data.word}`);
        currentTargetWord = ''; // Reset
    });

    socket.on('game-over', (data: any) => {
        console.log(`🎉🎉🎉 [${name}] GAME OVER! Winners: ${JSON.stringify(data.winner.map((p: any) => p.username))} 🎉🎉🎉`);

        // Start Voting
        console.log(`[${name}] Voting to play again...`);
        socket.emit('vote-play-again');
    });

    socket.on('update-restart-votes', (count: number) => {
        console.log(`🗳️ [${name}] Vote Count: ${count}`);

        if (name === 'Host') {
            if (count === 2) {
                console.log(`[Host] All players voted (2). Requesting RESTART...`);
                socket.emit('request-restart');
            }
        }
    });

    socket.on('game-started', () => {
        // This event fires on initial start AND restart
        // If we see it again, it means restart worked?
        // But we need to track if it's the second time.
        // Simple heuristic: If we receive "game-started" and we are already connected for a while/have seen game-over?
        // We'll rely on the log for manual check, or exit process on restart.
        // Actually, 'update-restart-votes' -> 0 is emitted on restart too.
    });
}

// Start
console.log("Starting Flow Verification...");
setupClient(socket1, 'Host', socket2);
setupClient(socket2, 'Joiner', socket1);

// Kickoff
setTimeout(() => {
    socket1.emit('create-room', { username: 'Host' });
}, 1000);

// Timeout safety
setTimeout(() => {
    console.error("Test Timed Out!");
    process.exit(1);
}, 30000);
