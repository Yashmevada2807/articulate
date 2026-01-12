'use client';

import { useEffect, useState, useRef } from 'react';
import { useGameStore, Player } from '../../../store/gameStore';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Eraser, Pencil, Send, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import Scoreboard from '../../../components/Scoreboard';
import CanvasBoard from '../../../components/CanvasBoard';
import VoiceManager from '../../../components/VoiceManager';
import SoundManager from '../../../utils/sound';

export default function GamePage({ params }: { params: { roomId: string } }) {
    const { players, socket, currentUser, setGameStatus, status } = useGameStore();
    const router = useRouter();
    const [messages, setMessages] = useState<any[]>([]);
    const [inputMsg, setInputMsg] = useState('');
    const [guessInput, setGuessInput] = useState('');
    const chatEndRef = useRef<HTMLDivElement>(null);

    // Game State
    const [color, setColor] = useState('#000000');
    const [brushSize, setBrushSize] = useState(5);
    const [currentDrawer, setCurrentDrawer] = useState<string | null>(players[0]?.id || null);
    const [hasGuessed, setHasGuessed] = useState(false);

    const isDrawer = currentUser?.id === currentDrawer;

    // ... (rest of the file content)

    function ColorBtn({ color, selected, onClick }: { color: string, selected: boolean, onClick: () => void }) {
        return (
            <button
                onClick={onClick}
                className={clsx(
                    "w-8 h-8 rounded-full border-2 transition-all hover:scale-110 cursor-pointer",
                    selected ? "border-white scale-110 shadow-lg ring-2 ring-slate-700" : "border-slate-600"
                )}
                style={{ backgroundColor: color }}
            />
        );
    }

    const handleClearCanvas = () => {
        if (socket && isDrawer) {
            socket.emit('clear-canvas');
        }
    };

    const [availableWords, setAvailableWords] = useState<string[]>([]);
    const [word, setWord] = useState<string | null>(null);
    const [timeLeft, setTimeLeft] = useState(60);

    const handleWordSelection = (selectedWord: string) => {
        socket.emit('select-word', selectedWord);
        setAvailableWords([]); // Clear selection UI
    };

    // Refs for stable access inside socket listeners
    const isDrawerRef = useRef(isDrawer);
    const socketRef = useRef(socket);

    useEffect(() => {
        isDrawerRef.current = isDrawer;
    }, [isDrawer]);

    useEffect(() => {
        socketRef.current = socket;
    }, [socket]);

    useEffect(() => {
        const socketInstance = socketRef.current;
        if (!socketInstance) return;

        console.log("Setting up game socket listeners");

        // Socket Listeners
        const onGameStarted = () => {
            setGameStatus('CHOOSING_WORD');
        };

        const onChatMessage = (msg: any) => {
            setMessages(prev => [...prev, msg]);
            if (!msg.isSystem) SoundManager.play('pop');
        };

        const onTimerUpdate = (time: number) => {
            setTimeLeft(time);
            if (time <= 5 && time > 0) SoundManager.play('tick');
        };

        const onTurnStart = (data: any) => {
            console.log("Turn Start:", data);
            setCurrentDrawer(data.drawerId);
            setHasGuessed(false);
            setWord(null);
            setAvailableWords([]);
            setGameStatus('CHOOSING_WORD');
            SoundManager.play('start');
        };

        const onWordToSelect = (words: string[]) => {
            console.log("Received words to select:", words);
            setAvailableWords(words);
        };

        const onWordSelected = (length: number) => {
            setGameStatus('DRAWING');
        };

        const onWordHint = (hint: string) => {
            // Check ref to see if we are drawer
            if (!isDrawerRef.current) setWord(hint);
        };

        const onCorrectGuess = (data: any) => {
            if (data.playerId === socketInstance.id) {
                setHasGuessed(true);
                SoundManager.play('success');
            }
        };

        const onGameOver = () => {
            SoundManager.play('fanfare');
        };

        socketInstance.on('game-started', onGameStarted);
        socketInstance.on('chat-message', onChatMessage);
        socketInstance.on('timer-update', onTimerUpdate);
        socketInstance.on('turn-start', onTurnStart);
        socketInstance.on('word-to-select', onWordToSelect);
        socketInstance.on('word-selected', onWordSelected);
        socketInstance.on('word-hint', onWordHint);
        socketInstance.on('correct-guess', onCorrectGuess);
        socketInstance.on('game-over', onGameOver);

        return () => {
            console.log("Cleaning up game socket listeners");
            socketInstance.off('game-started', onGameStarted);
            socketInstance.off('chat-message', onChatMessage);
            socketInstance.off('timer-update', onTimerUpdate);
            socketInstance.off('turn-start', onTurnStart);
            socketInstance.off('word-to-select', onWordToSelect);
            socketInstance.off('word-selected', onWordSelected);
            socketInstance.off('word-hint', onWordHint);
            socketInstance.off('correct-guess', onCorrectGuess);
            socketInstance.off('game-over', onGameOver);
        }
    }, [socket]); // Only re-run if socket instance changes (rare)

    // Recovery Mechanism: Request words if they don't arrive
    useEffect(() => {
        let timeout: NodeJS.Timeout;
        if (isDrawer && status === 'CHOOSING_WORD' && availableWords.length === 0 && socket) {
            console.log("Words missing. Scheduling recovery request...");
            timeout = setTimeout(() => {
                console.log("Requesting words from server...");
                socket.emit('request-words');
            }, 1000); // Wait 1s before complaining
        }
        return () => clearTimeout(timeout);
    }, [isDrawer, status, availableWords, socket]);


    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSendMessage = (e: React.FormEvent) => {
        e.preventDefault();
        if (!guessInput.trim() || !socket) return;

        // If drawing, it's chat. If guessing, it's guess.
        // For UI simplicity, let's assume 'guess' event handles both server-side or we split UI?
        // Usually, everything goes to 'guess' and server decides if it's chat or guess.
        socket.emit('guess', guessInput);
        setGuessInput('');
    };

    return (
        <div className="h-screen bg-slate-950 text-slate-50 flex flex-col overflow-hidden">
            {/* Header: Timer & Round Info */}
            <header className="h-16 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-6 z-20">
                <div className="font-bold text-xl">Round 1/3</div>
                <div className="flex items-center gap-4">
                    <div className="text-2xl font-mono font-bold text-amber-400">{timeLeft}s</div>
                </div>
                <div>Word: <span className="font-mono tracking-widest text-slate-400">{word || '_ _ _ _ _'}</span></div>
            </header>

            <main className="flex-1 flex overflow-hidden">
                {/* Left: Players List */}
                <aside className="w-64 bg-slate-900/50 border-r border-slate-800 p-4 overflow-y-auto hidden md:block">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Leaderboard</h3>
                    <div className="space-y-2">
                        {players.map((player, idx) => (
                            <PlayerCard key={player.id} player={player} rank={idx + 1} isDrawer={player.id === currentDrawer} />
                        ))}
                    </div>
                </aside>

                {/* Center: Canvas Area */}
                <section className="flex-1 bg-slate-800/20 relative flex flex-col">
                    <div className="flex-1 flex items-center justify-center p-4">
                        <div className="w-full h-full max-w-4xl max-h-[800px] bg-white rounded-lg shadow-2xl relative overflow-hidden">
                            <CanvasBoard
                                isDrawer={isDrawer}
                                color={color}
                                width={brushSize}
                            />

                            {/* Overlay for "Choosing Word" */}
                            {status === 'CHOOSING_WORD' && (
                                <div className="absolute inset-0 bg-slate-900/90 flex flex-col items-center justify-center z-10 transition-opacity duration-500 p-8">
                                    <h2 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent animate-pulse text-center mb-8">
                                        {isDrawer ? 'Choose a word to draw!' : 'Drawer is choosing a word...'}
                                    </h2>

                                    {isDrawer && availableWords.length > 0 && (
                                        <div className="flex flex-wrap gap-4 justify-center">
                                            {availableWords.map((w) => (
                                                <motion.button
                                                    key={w}
                                                    whileHover={{ scale: 1.05 }}
                                                    whileTap={{ scale: 0.95 }}
                                                    onClick={() => handleWordSelection(w)}
                                                    className="px-6 py-3 bg-slate-800 border border-slate-700 hover:border-purple-500 rounded-xl font-bold text-xl text-slate-200 shadow-lg hover:shadow-purple-500/20 transition-all"
                                                >
                                                    {w}
                                                </motion.button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Toolbar (Only for drawer) */}
                    {isDrawer && (
                        <div className="h-20 bg-slate-900 border-t border-slate-800 flex items-center justify-center gap-4 animate-slide-up">
                            <div className="flex gap-2 bg-slate-800 p-2 rounded-lg items-center shadow-lg border border-slate-700">
                                <ColorBtn color="#000000" selected={color === '#000000'} onClick={() => setColor('#000000')} />
                                <ColorBtn color="#ef4444" selected={color === '#ef4444'} onClick={() => setColor('#ef4444')} />
                                <ColorBtn color="#3b82f6" selected={color === '#3b82f6'} onClick={() => setColor('#3b82f6')} />
                                <ColorBtn color="#22c55e" selected={color === '#22c55e'} onClick={() => setColor('#22c55e')} />
                                <ColorBtn color="#eab308" selected={color === '#eab308'} onClick={() => setColor('#eab308')} />

                                <div className="w-px h-8 bg-slate-700 mx-2"></div>

                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-slate-500" style={{ transform: `scale(${brushSize / 5})` }}></div>
                                    <input
                                        type="range"
                                        min="2" max="20"
                                        value={brushSize}
                                        onChange={(e) => setBrushSize(parseInt(e.target.value))}
                                        className="w-24 accent-purple-500 cursor-pointer"
                                    />
                                </div>

                                <div className="w-px h-8 bg-slate-700 mx-2"></div>

                                <button
                                    onClick={() => setColor('#ffffff')}
                                    className={clsx("p-3 rounded-md transition-all hover:bg-slate-700 cursor-pointer", color === '#ffffff' ? "bg-slate-700 text-white shadow-inner" : "text-slate-400 hover:text-white")}
                                    title="Eraser"
                                >
                                    <Eraser className="w-5 h-5" />
                                </button>
                                <button
                                    onClick={handleClearCanvas}
                                    className="p-3 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded-md transition-colors cursor-pointer"
                                    title="Clear All"
                                >
                                    <Trash2 className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    )}
                </section>

                {/* Right: Chat */}
                <aside className="w-80 bg-slate-900 border-l border-slate-800 flex flex-col z-10">
                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        {messages.map((msg) => (
                            <div key={msg.id} className={clsx("text-sm", msg.isSystem ? "text-green-400 font-bold" : "")}>
                                {!msg.isSystem && <span className="font-bold text-slate-500">{msg.username}: </span>}
                                <span className={clsx("text-slate-300", msg.isSystem && "italic")}>{msg.text}</span>
                            </div>
                        ))}
                        <div ref={chatEndRef} />
                    </div>
                    <form onSubmit={handleSendMessage} className="p-4 bg-slate-950 border-t border-slate-800 flex gap-2">
                        <input
                            type="text"
                            value={guessInput}
                            onChange={(e) => setGuessInput(e.target.value)}
                            disabled={isDrawer || hasGuessed}
                            placeholder={
                                isDrawer ? "You are drawing!" :
                                    hasGuessed ? "You guessed it!" :
                                        "Type your guess here..."
                            }
                            className={clsx(
                                "flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500 transition-colors",
                                (isDrawer || hasGuessed) && "opacity-50 cursor-not-allowed bg-slate-950"
                            )}
                        />
                        <button type="submit" className="p-2 bg-slate-800 rounded-lg text-slate-400 hover:text-purple-400 transition-colors cursor-pointer">
                            <Send className="w-4 h-4" />
                        </button>
                    </form>
                </aside>
            </main>

            {/* Overlays */}
            <AnimatePresence>
                {(status === 'SCORING' || status === 'GAME_OVER') && (
                    <Scoreboard
                        players={players}
                        isGameOver={status === 'GAME_OVER'}
                        onNextRound={() => {
                            // Logic to return to lobby or trigger next round via socket
                            // For MVP, maybe redirect to lobby if game over
                            if (status === 'GAME_OVER') {
                                window.location.href = '/'; // Simple reload for now
                            }
                        }}
                    />
                )}
            </AnimatePresence>

            {currentUser && <VoiceManager myId={currentUser.id} />}
        </div >
    );
}

function PlayerCard({ player, rank, isDrawer }: { player: Player, rank: number, isDrawer: boolean }) {
    return (
        <div className={clsx(
            "p-3 rounded-xl flex items-center gap-3 transition-colors",
            isDrawer ? "bg-purple-900/20 border border-purple-500/30" : "bg-slate-800/50 border border-transparent"
        )}>
            <div className="font-mono text-slate-500 text-xs w-4">#{rank}</div>
            <div className="flex-1">
                <div className={clsx("font-bold text-sm", isDrawer ? "text-purple-400" : "text-slate-300")}>
                    {player.username}
                </div>
                <div className="text-xs text-slate-500">Score: {player.score}</div>
            </div>
            {isDrawer && <Pencil className="w-3 h-3 text-purple-400 animate-bounce" />}
        </div>
    );
}
