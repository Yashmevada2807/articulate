import { Room } from './Room';
import { GameStatus, Player, Round } from './types';
import { Server } from 'socket.io';

const wordPictionaryList = require('word-pictionary-list');
// @ts-ignore
const WORDS: string[] = (wordPictionaryList.wordList || []).map((w: string) => w.toLowerCase());

export class Game {
    public status: GameStatus = GameStatus.LOBBY;
    public currentDrawer: Player | null = null;
    public currentWord: string | null = null;
    public currentRound: number = 0;
    public totalRounds: number = 3;
    public timer: NodeJS.Timeout | null = null;
    public timeLeft: number = 0;

    private room: Room;
    private io: Server;
    private wordsToSelect: string[] = [];
    private playersWhoGuessed: Set<string> = new Set();
    private turnIndex: number = -1;

    constructor(room: Room, io: Server) {
        this.room = room;
        this.io = io;
    }

    public startGame() {
        if (this.room.players.size < 2) {
            // Need at least 2 players
            return;
        }
        this.status = GameStatus.CHOOSING_WORD;
        this.currentRound = 1;
        this.turnIndex = -1;
        this.playersWhoGuessed.clear();

        // Broadcast Start
        this.room.players.forEach(p => p.score = 0);
        this.io.to(this.room.id).emit('game-started');
        this.io.to(this.room.id).emit('update-scores', Array.from(this.room.players.values()));
        // We'll iterate turns
        this.nextTurn();
    }

    private nextTurn() {
        this.turnIndex++;

        if (this.room.players.size < 2) {
            console.log("[Game] Not enough players to continue. Resetting to LOBBY.");
            this.status = GameStatus.LOBBY;
            this.currentRound = 0;
            this.io.to(this.room.id).emit('game-over', { reason: "Not enough players" }); // Or just reset state
            return;
        }

        const players = Array.from(this.room.players.values());

        if (this.turnIndex >= players.length) {
            // End of Round
            if (this.currentRound >= this.totalRounds) {
                this.endGame();
                return;
            }
            this.currentRound++;
            this.io.to(this.room.id).emit('new-round', this.currentRound);
            this.turnIndex = 0;
            // Optionally send round update
        }

        this.currentDrawer = players[this.turnIndex];
        this.currentWord = null;
        this.playersWhoGuessed.clear();
        this.status = GameStatus.CHOOSING_WORD;

        // Select 3 random words
        this.wordsToSelect = this.getRandomWords(3);

        // Notify Room
        console.log(`[Game] Turn starting. Drawer: ${this.currentDrawer.username} (${this.currentDrawer.id})`);
        this.io.to(this.room.id).emit('turn-start', {
            drawerId: this.currentDrawer.id,
            roundEnd: 0,
            currentRound: this.currentRound,
            totalRounds: this.totalRounds
        });

        // Send words only to drawer with slight delay to ensure client state transition
        if (this.currentDrawer.socketId) {
            const socketId = this.currentDrawer.socketId;
            const words = this.wordsToSelect;
            setTimeout(() => {
                console.log(`[Game] Sending words to ${socketId}: ${words}`);
                this.io.to(socketId).emit('word-to-select', words);
            }, 200);
        }
    }

    private getRandomWords(count: number): string[] {
        const shuffled = WORDS.sort(() => 0.5 - Math.random());
        return shuffled.slice(0, count);
    }

    public getWordsToSelect() {
        return this.wordsToSelect;
    }

    public handleWordSelection(word: string) {
        if (this.status !== GameStatus.CHOOSING_WORD) return;
        this.currentWord = word;
        this.status = GameStatus.DRAWING;

        // Notify everyone that word is chosen
        this.io.to(this.room.id).emit('word-selected', word.length);

        this.startDrawTimer();
    }

    private hintTimer: NodeJS.Timeout | null = null;
    private revealedIndices: Set<number> = new Set();

    // ...

    private startDrawTimer() {
        this.timeLeft = 60; // 60 seconds to draw
        this.revealedIndices.clear();

        // Initial Mask
        this.broadcastHint();

        this.timer = setInterval(() => {
            this.timeLeft--;

            this.io.to(this.room.id).emit('timer-update', this.timeLeft);

            // Hint Logic at 30s and 15s remaining
            if (this.timeLeft === 30 || this.timeLeft === 15) {
                this.revealHint();
            }

            if (this.timeLeft <= 0) {
                this.endTurn();
            }
        }, 1000);
    }

    private revealHint() {
        if (!this.currentWord) return;

        const length = this.currentWord.length;
        const unrevealed = [];
        for (let i = 0; i < length; i++) {
            if (!this.revealedIndices.has(i) && this.currentWord[i] !== ' ') {
                unrevealed.push(i);
            }
        }

        if (unrevealed.length > 0) {
            // Pick random index to reveal
            const idx = unrevealed[Math.floor(Math.random() * unrevealed.length)];
            this.revealedIndices.add(idx);
            this.broadcastHint();
        }
    }

    private broadcastHint() {
        if (!this.currentWord) return;

        let hint = '';
        for (let i = 0; i < this.currentWord.length; i++) {
            if (this.currentWord[i] === ' ' || this.revealedIndices.has(i)) {
                hint += this.currentWord[i];
            } else {
                hint += '_';
            }
        }

        // Also emit specific event for UI update (top bar)
        this.io.to(this.room.id).emit('word-hint', hint);
    }

    public handleGuess(playerId: string, guess: string): boolean {
        if (this.status !== GameStatus.DRAWING) return false;
        if (this.playersWhoGuessed.has(playerId)) return false; // Already guessed
        if (playerId === this.currentDrawer?.id) return false; // Drawer can't guess

        if (guess.toLowerCase().trim() === this.currentWord?.toLowerCase()) {
            this.playersWhoGuessed.add(playerId);
            // Calculate Score based on time left
            const points = Math.ceil(this.timeLeft / 2) * 10;
            const player = this.room.getPlayer(playerId);
            if (player) {
                player.score += points;
                this.io.to(this.room.id).emit('correct-guess', {
                    playerId,
                    word: this.currentWord!,
                    score: points
                });
            }

            // Drawer gets points too
            if (this.currentDrawer) {
                this.currentDrawer.score += 5;
            }

            this.io.to(this.room.id).emit('update-scores', Array.from(this.room.players.values()));

            // If everyone guessed
            if (this.playersWhoGuessed.size === this.room.players.size - 1) {
                this.endTurn();
            }
            return true;
        }
        return false;
    }

    private endTurn() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        // No separate interval for hints, it was inside the loop or we need to clear if it was separate
        // Since I put hint logic INSIDE the main timer, I don't need to clear a separate hintTimer unless I used one.
        // Wait, I defined `hintTimer` property but didn't use `setInterval` for it specifically.
        // Refactoring: I used main timer to trigger hints. So no need to clear separate timer.

        this.status = GameStatus.SCORING;

        this.io.to(this.room.id).emit('turn-end', {
            word: this.currentWord || '',
            scores: Array.from(this.room.players.values())
        });

        // Wait a bit then next turn
        setTimeout(() => {
            this.nextTurn();
        }, 5000);
    }

    private endGame() {
        this.status = GameStatus.GAME_OVER;
        // Logic to show winners
        const sortedPlayers = Array.from(this.room.players.values()).sort((a, b) => b.score - a.score);
        this.io.to(this.room.id).emit('game-over', { winner: sortedPlayers });
    }

    public playAgainVotes: Set<string> = new Set();

    public restartGame() {
        if (this.status !== GameStatus.GAME_OVER) return;

        console.log(`[Game] Restarting game for Room ${this.room.id}`);
        // Reset scores
        this.room.players.forEach(p => p.score = 0);
        this.currentRound = 0;
        this.turnIndex = -1;
        this.playAgainVotes.clear();
        this.io.to(this.room.id).emit('update-restart-votes', 0);

        this.startGame();
    }

    public votePlayAgain(playerId: string) {
        if (this.status !== GameStatus.GAME_OVER) return;
        this.playAgainVotes.add(playerId);
        this.io.to(this.room.id).emit('update-restart-votes', this.playAgainVotes.size);
    }

    // Getters for public state
    public getPublicState() {
        return {
            status: this.status,
            round: this.currentRound,
            timeLeft: this.timeLeft,
            currentDrawerId: this.currentDrawer?.id,
            // Don't send word unless round over or to drawer
        };
    }
}
