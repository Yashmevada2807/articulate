import { io, Socket } from 'socket.io-client';

const URL = 'http://localhost:3000';

const client1 = io(URL);
const client2 = io(URL);

let roomId: string = '';

console.log('--- Starting System Test ---');

// --- Helper to log with client name ---
const log = (client: string, msg: string, data?: any) => {
    console.log(`[${client}] ${msg}`, data ? JSON.stringify(data) : '');
};

// --- CLIENT 1 (HOST) ---
client1.on('connect', () => {
    log('Host', 'Connected');
    log('Host', 'Creating create-room...');
    client1.emit('create-room', 'HostUser');
});

client1.on('room-joined', (data: any) => {
    log('Host', 'Room Joined:', data.roomId);
    roomId = data.roomId;

    // Once we have a room, Client 2 can join
    setTimeout(() => {
        log('Guesser', `Joining room ${roomId}...`);
        client2.emit('join-room', roomId, 'GuesserUser');
    }, 500);
});

client1.on('player-joined', (player: any) => {
    log('Host', 'Player Joined:', player.username);
    if (player.username === 'GuesserUser') {
        // Start game when second player joins
        setTimeout(() => {
            log('Host', 'Starting Game...');
            client1.emit('start-game');
        }, 1000);
    }
});

client1.on('game-started', () => {
    log('Host', 'Game Started Event Received');
});

client1.on('word-to-select', (words: string[]) => {
    log('Host', 'Received Words to Select:', words);
    const selected = words[0];
    log('Host', `Selecting word: ${selected}`);
    client1.emit('select-word', selected);
});

client1.on('word-selected', (length: number) => {
    log('Host', `Word Selected (Length: ${length})`);
});

// --- CLIENT 2 (GUESSER) ---
client2.on('connect', () => {
    log('Guesser', 'Connected');
});

client2.on('game-started', () => {
    log('Guesser', 'Game Started Event Received');
});

client2.on('word-selected', (length: number) => {
    log('Guesser', `Word Selected by Drawer (Length: ${length}). Guessing in 2s...`);

    // Simulate a wrong guess then a right guess
    setTimeout(() => {
        log('Guesser', 'Sending Wrong Guess: xyz');
        client2.emit('guess', 'xyz');
    }, 1000);

    setTimeout(() => { // We don't know the word, but in test we can cheat or guess generic? 
        // Wait, the client doesn't know the word. 
        // To test correct guess, we need to know what Host picked.
        // For this test script, since it's running in one process, we can cheat.
    }, 2000);
});

client2.on('chat-message', (msg: any) => {
    log('Guesser', `Chat: ${msg.username}: ${msg.text}`);
});

// Cheating for the test: Client 1 tells us what they picked
// We'll intercept the 'select-word' logic above to store it
client1.on('word-to-select', (words: string[]) => {
    const word = words[0];
    setTimeout(() => {
        log('Guesser', `(Cheating) Sending Correct Guess: ${word}`);
        client2.emit('guess', word);
    }, 3000);
});

client1.on('correct-guess', (data: any) => {
    log('Host', 'Correct Guess Event Received!', data);

    setTimeout(() => {
        console.log('--- Test Finished Successfully ---');
        client1.disconnect();
        client2.disconnect();
        process.exit(0);
    }, 1000);
});

// Cleanup in case of timeout
setTimeout(() => {
    console.log('--- Test Timeout ---');
    client1.disconnect();
    client2.disconnect();
    process.exit(1);
}, 10000);
