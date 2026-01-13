'use client';

import { useEffect, useState, useRef } from 'react';
import { useGameStore, Player } from '../../../store/gameStore';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Eraser, Pencil, Send, Trash2, Menu, X, Volume2, Mic, MicOff, Clock, AlertCircle } from 'lucide-react';
import clsx from 'clsx';
import Scoreboard from '../../../components/Scoreboard';
import CanvasBoard from '../../../components/CanvasBoard';
import VoiceManager from '../../../components/VoiceManager';
import SoundManager from '../../../utils/sound';
import { toast } from 'react-hot-toast';

export default function GamePage({ params }: { params: { roomId: string } }) {
    const { players, socket, currentUser, setGameStatus, status, syncGameState, currentRound, totalRounds, setPlayers, updatePlayer } = useGameStore();
    const router = useRouter();
    const [messages, setMessages] = useState<any[]>([]);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [voteCount, setVoteCount] = useState(0);
    const [listenersReady, setListenersReady] = useState(false);
    const [voiceStates, setVoiceStates] = useState<Map<string, { isSpeaking: boolean }>>(new Map());
    const [isMicMuted, setIsMicMuted] = useState(false);

    const handleSpeakingUpdate = (userId: string, newState: Partial<{ isSpeaking: boolean }>) => {
        setVoiceStates(prev => {
            const next = new Map(prev);
            const current = next.get(userId) || { isSpeaking: false };
            next.set(userId, { ...current, ...newState });
            return next;
        });
    };

    // ... (socket listener effect)
    useEffect(() => {
        // ... (existing listeners)

        setListenersReady(true);

        return () => {
            // ... (cleanup)
            setListenersReady(false);
        }
    }, [socket]);

    const activeVoiceCount = players.filter(p => p.isInVoice && !p.isMuted).length;

    useEffect(() => {
        if (!socket || !currentUser) {
            toast.error("You are disconnected from the game");
            router.push("/");
        }
    }, [socket, currentUser, router]);
    const [inputMsg, setInputMsg] = useState('');
    const [guessInput, setGuessInput] = useState('');
    const chatEndRef = useRef<HTMLDivElement>(null);

    // Game State
    const [color, setColor] = useState('#000000');
    const [brushSize, setBrushSize] = useState(5);
    const [currentDrawer, setCurrentDrawer] = useState<string | null>(players[0]?.id || null);
    const [hasGuessed, setHasGuessed] = useState(false);

    const isDrawer = currentUser?.id === currentDrawer;

    function ColorBtn({ color, selected, onClick }: { color: string, selected: boolean, onClick: () => void }) {
        return (
            <button
                onClick={onClick}
                className={clsx(
                    "w-8 h-8 rounded-full border-2 transition-all hover:scale-110 cursor-pointer",
                    selected ? "border-white scale-110 shadow-lg ring-2 ring-zinc-500" : "border-zinc-700"
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
            if (data.currentRound) useGameStore.setState({ currentRound: data.currentRound });
            if (data.totalRounds) useGameStore.setState({ totalRounds: data.totalRounds });

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
                if (data.word) setWord(data.word);
            }
        };

        const onTurnEnd = (data: any) => {
            console.log("Turn ended:", data);
            setGameStatus('SCORING');
            if (data.word) {
                setWord(data.word);
                toast(`The word was ${data.word}`, {
                    icon: '📝',
                    duration: 4000,
                    position: 'top-center'
                });
            }
        };

        const onNewRound = (round: number) => {
            console.log("New Round:", round);
            useGameStore.setState({ currentRound: round });
            toast(`Round ${round} Started!`, { icon: '🔔', position: 'top-center' });
        };

        const onGameOver = (data: any) => {
            console.log("Game Over:", data);
            setGameStatus('GAME_OVER');
            SoundManager.play('fanfare');
        };

        const onGameStateSync = (state: any) => {
            console.log("Syncing game state:", state);
            syncGameState(state);
            setCurrentDrawer(state.currentDrawer?.id || null);
            setTimeLeft(state.timeLeft || 0);
        };

        const onUpdateRestartVotes = (count: number) => {
            setVoteCount(count);
        };

        socketInstance.on('game-started', onGameStarted);
        socketInstance.on('chat-message', onChatMessage);
        socketInstance.on('timer-update', onTimerUpdate);
        socketInstance.on('turn-start', onTurnStart);
        socketInstance.on('turn-end', onTurnEnd);
        socketInstance.on('new-round', onNewRound);
        socketInstance.on('word-to-select', onWordToSelect);
        socketInstance.on('word-selected', onWordSelected);
        socketInstance.on('word-hint', onWordHint);
        socketInstance.on('correct-guess', onCorrectGuess);
        socketInstance.on('game-over', onGameOver);
        socketInstance.on('sync-game-state', onGameStateSync);
        socketInstance.on('update-restart-votes', onUpdateRestartVotes);

        socketInstance.on('voice-state-update', (data: { userId: string, isMuted: boolean, isInVoice?: boolean }) => {
            console.log("[GamePage] Received voice-state-update:", data);
            updatePlayer(data.userId, { isMuted: data.isMuted, isInVoice: data.isInVoice });

            // Log active count after update (next tick slightly)
            setTimeout(() => {
                const currentPlayers = useGameStore.getState().players;
                const count = currentPlayers.filter(p => p.isInVoice && !p.isMuted).length;
                console.log("[GamePage] Updated Active Count:", count, "Players:", currentPlayers.map(p => ({ id: p.id, voice: p.isInVoice, muted: p.isMuted })));
            }, 100);
        });

        return () => {
            console.log("Cleaning up game socket listeners");
            socketInstance.off('game-started', onGameStarted);
            socketInstance.off('chat-message', onChatMessage);
            socketInstance.off('timer-update', onTimerUpdate);
            socketInstance.off('turn-start', onTurnStart);
            socketInstance.off('turn-end', onTurnEnd);
            socketInstance.off('new-round', onNewRound);
            socketInstance.off('word-to-select', onWordToSelect);
            socketInstance.off('word-selected', onWordSelected);
            socketInstance.off('word-hint', onWordHint);
            socketInstance.off('correct-guess', onCorrectGuess);
            socketInstance.off('game-over', onGameOver);
            socketInstance.off('sync-game-state', onGameStateSync);
            socketInstance.off('update-restart-votes', onUpdateRestartVotes);
        }
    }, [socket]);

    // Recovery Mechanism
    useEffect(() => {
        let timeout: NodeJS.Timeout;
        if (isDrawer && status === 'CHOOSING_WORD' && availableWords.length === 0 && socket) {
            timeout = setTimeout(() => {
                socket.emit('request-words');
            }, 1000);
        }
        return () => clearTimeout(timeout);
    }, [isDrawer, status, availableWords, socket]);


    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSendMessage = (e: React.FormEvent) => {
        e.preventDefault();
        if (!guessInput.trim() || !socket) return;
        socket.emit('guess', guessInput);
        setGuessInput('');
    };

    return (
        <div className="h-[100dvh] bg-black text-zinc-100 flex flex-col overflow-hidden font-sans selection:bg-purple-900/50">
            {/* Ambient Background */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
                <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-[0.02]" />
            </div>

            {/* Header: Timer & Round Info */}
            <header className="h-16 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-900 flex items-center justify-between px-6 z-20 shrink-0 relative">
                <div className="flex items-center gap-4">
                    <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="md:hidden p-2 text-zinc-400 hover:text-white cursor-pointer">
                        <Menu className="w-6 h-6" />
                    </button>
                    <div className="flex flex-col">
                        <span className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">Round</span>
                        <span className="text-sm font-bold text-zinc-200">{currentRound || 1} / {totalRounds || 3}</span>
                    </div>
                </div>

                <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-purple-500" />
                    <span className={clsx(
                        "text-3xl font-black font-mono tracking-wider",
                        timeLeft <= 10 ? "text-red-500 animate-pulse" : "text-zinc-100"
                    )}>
                        {timeLeft}
                    </span>
                </div>

                <div className="flex flex-col items-end">
                    <span className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">Current Word</span>
                    <span className="text-sm font-mono font-bold text-zinc-200 tracking-wider">
                        {word ||
                            <span className="flex gap-1">
                                <span className="w-2 h-0.5 bg-zinc-700 animate-pulse" />
                                <span className="w-2 h-0.5 bg-zinc-700 animate-pulse delay-75" />
                                <span className="w-2 h-0.5 bg-zinc-700 animate-pulse delay-150" />
                            </span>
                        }
                    </span>
                </div>
            </header>

            <main className="flex-1 flex flex-col md:flex-row overflow-hidden relative z-10">

                {/* Visual Overlay for Mobile Menu Background */}
                <AnimatePresence>
                    {isMenuOpen && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsMenuOpen(false)}
                            className="absolute inset-0 bg-black/80 z-30 md:hidden backdrop-blur-sm"
                        />
                    )}
                </AnimatePresence>

                {/* Left: Players List (Sidebar / Drawer) */}

                <aside
                    className={clsx(
                        "absolute md:static top-0 left-0 bottom-0 w-3/4 max-w-[300px] md:w-72 bg-zinc-950/80 md:bg-zinc-950/30 backdrop-blur-md border-r border-zinc-900 z-40 flex flex-col transition-transform duration-300",
                        isMenuOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full md:translate-x-0"
                    )}
                >
                    <div className="p-4 flex justify-between items-center md:hidden border-b border-zinc-900">
                        <h3 className="font-bold text-zinc-100 uppercase text-xs tracking-widest">Players</h3>
                        <button onClick={() => setIsMenuOpen(false)} className="cursor-pointer"><X className="w-5 h-5 text-zinc-500" /></button>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6">
                        {!useGameStore.getState().teamMode.enabled ? (
                            /* Classic Free-for-all */
                            <div>
                                <h3 className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-3 hidden md:block">Leaderboard</h3>
                                <div className="space-y-2">
                                    {players.map((player, idx) => {
                                        const speakingState = voiceStates.get(player.id);
                                        return (
                                            <PlayerCard
                                                key={player.id}
                                                player={player}
                                                rank={idx + 1}
                                                isDrawer={player.id === currentDrawer}
                                                isSpeaking={speakingState?.isSpeaking}
                                                isMuted={player.isMuted}
                                            />
                                        );
                                    })}
                                </div>
                            </div>
                        ) : (
                            /* Team Mode Layout */
                            <>
                                {/* Team A */}
                                <div>
                                    <div className="flex items-center justify-between mb-2 px-1">
                                        <h3 className="text-[10px] font-bold text-cyan-500/80 uppercase tracking-widest">TEAM A</h3>
                                        <div className="text-[10px] font-bold text-cyan-400 bg-cyan-950/30 px-2 py-0.5 rounded border border-cyan-500/20">
                                            {players.filter(p => p.team === 'A').reduce((sum, p) => sum + (p.score || 0), 0)} pts
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        {players.filter(p => p.team === 'A').map((player, idx) => (
                                            <PlayerCard
                                                key={player.id}
                                                player={player}
                                                rank={idx + 1}
                                                isDrawer={player.id === currentDrawer}
                                                isSpeaking={voiceStates.get(player.id)?.isSpeaking}
                                                isMuted={player.isMuted}
                                                team="A"
                                            />
                                        ))}
                                    </div>
                                </div>

                                {/* Team B */}
                                <div>
                                    <div className="flex items-center justify-between mb-2 px-1">
                                        <h3 className="text-[10px] font-bold text-rose-500/80 uppercase tracking-widest">TEAM B</h3>
                                        <div className="text-[10px] font-bold text-rose-400 bg-rose-950/30 px-2 py-0.5 rounded border border-rose-500/20">
                                            {players.filter(p => p.team === 'B').reduce((sum, p) => sum + (p.score || 0), 0)} pts
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        {players.filter(p => p.team === 'B').map((player, idx) => (
                                            <PlayerCard
                                                key={player.id}
                                                player={player}
                                                rank={idx + 1}
                                                isDrawer={player.id === currentDrawer}
                                                isSpeaking={voiceStates.get(player.id)?.isSpeaking}
                                                isMuted={player.isMuted}
                                                team="B"
                                            />
                                        ))}
                                    </div>
                                </div>

                                {/* Spectators */}
                                {players.filter(p => p.role === 'spectator').length > 0 && (
                                    <div>
                                        <h3 className="text-[10px] font-bold text-zinc-700 uppercase tracking-widest mb-2 px-1">Spectators</h3>
                                        <div className="space-y-2">
                                            {players.filter(p => p.role === 'spectator').map((player, idx) => (
                                                <PlayerCard
                                                    key={player.id}
                                                    player={player}
                                                    rank={idx + 1}
                                                    isDrawer={false}
                                                    isSpeaking={voiceStates.get(player.id)?.isSpeaking}
                                                    isMuted={player.isMuted}
                                                    isSpectator={true}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    {/* Voice Manager Embedded in Sidebar */}
                    <div className="p-4 bg-zinc-900/50 border-t border-zinc-900 mt-auto">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                                <Volume2 className={clsx("w-3 h-3", activeVoiceCount > 0 && "text-emerald-500 animate-pulse")} />
                                Voice Channel
                            </div>
                            {activeVoiceCount > 0 ? (
                                <span className="text-[10px] font-bold text-emerald-500">{activeVoiceCount} Active</span>
                            ) : (
                                <span className="text-[10px] font-bold text-zinc-700">Empty</span>
                            )}
                        </div>
                        {currentUser && (
                            <VoiceManager
                                myId={currentUser.id}
                                embedded={true}
                                onVoiceStateUpdate={handleSpeakingUpdate}
                                canJoinVoice={listenersReady}
                                isMuted={isMicMuted}
                                onToggleMute={setIsMicMuted}
                            />
                        )}
                    </div>
                </aside>

                {/* Center: Canvas Area */}
                <section className="flex-1 bg-zinc-950/50 relative flex flex-col overflow-hidden min-h-[350px]">
                    <div className="flex-1 flex items-center justify-center p-2 md:p-6 overflow-hidden">
                        <div className="w-full h-full max-w-5xl bg-white rounded-xl shadow-2xl relative overflow-hidden flex items-center justify-center touch-none ring-1 ring-zinc-800">
                            <CanvasBoard
                                isDrawer={isDrawer}
                                color={color}
                                width={brushSize}
                            />

                            {/* Overlay for "Choosing Word" */}
                            <AnimatePresence>
                                {status === 'CHOOSING_WORD' && (
                                    <motion.div
                                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                        className="absolute inset-0 bg-zinc-950/90 backdrop-blur-sm flex flex-col items-center justify-center z-10 p-6 text-center"
                                    >
                                        <h2 className="text-xl md:text-3xl font-black text-white mb-2 animate-pulse">
                                            {isDrawer ? 'CHOOSE A WORD' : 'DRAWER IS CHOOSING'}
                                        </h2>
                                        <p className="text-zinc-500 font-bold text-xs uppercase tracking-widest mb-8">
                                            {isDrawer ? 'Select a word to draw' : `${players.find(p => p.id === currentDrawer)?.username} is thinking...`}
                                        </p>

                                        {isDrawer && availableWords.length > 0 && (
                                            <div className="flex flex-wrap gap-4 justify-center max-w-lg">
                                                {availableWords.map((w) => (
                                                    <motion.button
                                                        key={w}
                                                        whileHover={{ scale: 1.05 }}
                                                        whileTap={{ scale: 0.95 }}
                                                        onClick={() => {
                                                            handleWordSelection(w);
                                                            setWord(w);
                                                        }}
                                                        className="px-6 py-4 bg-zinc-900 border border-zinc-800 hover:border-purple-500 hover:bg-zinc-800 rounded-2xl font-bold text-lg text-zinc-100 shadow-xl transition-all cursor-pointer"
                                                    >
                                                        {w}
                                                    </motion.button>
                                                ))}
                                            </div>
                                        )}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>

                    {/* Toolbar (Only for drawer) */}
                    {isDrawer && (
                        <div className="h-20 bg-zinc-900 border-t border-zinc-900 flex items-center justify-center animate-slide-up shrink-0 overflow-x-auto px-4 z-20">
                            <div className="flex gap-4 p-2 rounded-2xl items-center">
                                {/* Colors */}
                                <div className="flex gap-2 bg-black/50 p-2 rounded-xl border border-zinc-800">
                                    <ColorBtn color="#000000" selected={color === '#000000'} onClick={() => setColor('#000000')} />
                                    <ColorBtn color="#ef4444" selected={color === '#ef4444'} onClick={() => setColor('#ef4444')} />
                                    <ColorBtn color="#3b82f6" selected={color === '#3b82f6'} onClick={() => setColor('#3b82f6')} />
                                    <ColorBtn color="#22c55e" selected={color === '#22c55e'} onClick={() => setColor('#22c55e')} />
                                    <ColorBtn color="#eab308" selected={color === '#eab308'} onClick={() => setColor('#eab308')} />
                                </div>

                                <div className="w-px h-8 bg-zinc-800"></div>

                                {/* Brush Size */}
                                <div className="flex items-center gap-3 bg-black/50 p-2 rounded-xl border border-zinc-800 px-4">
                                    <div className="w-2 h-2 rounded-full bg-zinc-400" style={{ transform: `scale(${brushSize / 5})` }}></div>
                                    <input
                                        type="range"
                                        min="2" max="20"
                                        value={brushSize}
                                        onChange={(e) => setBrushSize(parseInt(e.target.value))}
                                        className="w-24 accent-purple-500 cursor-pointer h-1.5 bg-zinc-700 rounded-lg appearance-none"
                                    />
                                </div>

                                <div className="w-px h-8 bg-zinc-800"></div>

                                {/* Tools */}
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setColor('#ffffff')}
                                        className={clsx(
                                            "p-3 rounded-xl border transition-all cursor-pointer",
                                            color === '#ffffff' ? "bg-zinc-800 text-white border-zinc-600" : "bg-black/50 text-zinc-500 border-zinc-800 hover:text-white"
                                        )}
                                        title="Eraser"
                                    >
                                        <Eraser className="w-5 h-5" />
                                    </button>
                                    <button
                                        onClick={handleClearCanvas}
                                        className="p-3 bg-red-950/20 text-red-500 border border-red-900/30 rounded-xl hover:bg-red-900/30 transition-all cursor-pointer"
                                        title="Clear Canvas"
                                    >
                                        <Trash2 className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </section>

                {/* Right: Chat */}
                <aside className="h-[35vh] md:h-auto md:w-80 bg-zinc-950/80 backdrop-blur-md border-t md:border-t-0 md:border-l border-zinc-900 flex flex-col z-20 shrink-0">
                    <div className="p-3 border-b border-zinc-900 bg-zinc-900/30">
                        <h3 className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Live Chat</h3>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                        {messages.map((msg, i) => (
                            <motion.div
                                initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}
                                key={i}
                                className={clsx(
                                    "text-sm p-3 rounded-xl border",
                                    msg.isSystem
                                        ? "bg-emerald-950/10 border-emerald-500/10 text-emerald-400 text-center text-xs font-bold uppercase tracking-wide"
                                        : "bg-zinc-900/50 border-zinc-800 text-zinc-300"
                                )}
                            >
                                {!msg.isSystem && <div className="font-bold text-xs text-zinc-500 mb-1 block">{msg.username}</div>}
                                <span className={clsx(msg.isSystem && "")}>{msg.text}</span>
                            </motion.div>
                        ))}
                        <div ref={chatEndRef} />
                    </div>

                    <form onSubmit={handleSendMessage} className="p-4 bg-zinc-900/50 border-t border-zinc-900 flex gap-2 shrink-0 safe-area-bottom">
                        {/* Mobile/Quick Mute Toggle */}
                        <button
                            type="button"
                            onClick={() => setIsMicMuted(!isMicMuted)}
                            className={clsx(
                                "p-3 rounded-xl transition-colors border cursor-pointer",
                                isMicMuted
                                    ? "bg-red-500/10 border-red-500/20 text-red-500"
                                    : "bg-zinc-800 border-zinc-700 text-emerald-500 hover:bg-zinc-700"
                            )}
                        >
                            {isMicMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                        </button>

                        <div className="flex-1 relative">
                            <input
                                type="text"
                                value={guessInput}
                                onChange={(e) => setGuessInput(e.target.value)}
                                disabled={isDrawer || hasGuessed}
                                placeholder={isDrawer ? "It's your turn to draw!" : "Type your guess here..."}
                                className={clsx(
                                    "w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20 transition-colors text-white placeholder:text-zinc-600",
                                    (isDrawer || hasGuessed) && "opacity-50 cursor-not-allowed"
                                )}
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={!guessInput.trim() || isDrawer || hasGuessed}
                            className="p-3 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-zinc-400 hover:text-white transition-colors cursor-pointer"
                        >
                            <Send className="w-5 h-5" />
                        </button>
                    </form>
                </aside>
            </main>

            {/* Overlays (Scoreboard etc) */}
            <AnimatePresence>
                {(status === 'SCORING' || status === 'GAME_OVER') && (
                    <Scoreboard
                        players={players}
                        isGameOver={status === 'GAME_OVER'}
                        onReturnToLobby={() => router.push('/')}
                        onPlayAgain={currentUser?.isHost ? () => socket?.emit('request-restart') : undefined}
                        onVote={() => socket?.emit('vote-play-again')}
                        voteCount={voteCount}
                        word={word}
                    />
                )}
            </AnimatePresence>

        </div >
    );
}

function PlayerCard({
    player,
    rank,
    isDrawer,
    isSpeaking,
    isMuted,
    team,
    isSpectator
}: any) {
    const isTeamA = team === 'A';
    const isTeamB = team === 'B';

    // Refined card styles for Midnight Theme
    return (
        <div className={clsx(
            "p-3 rounded-xl flex items-center gap-3 transition-all duration-300 border relative group",
            // Drawer Highlight
            isDrawer && "bg-purple-900/10 border-purple-500/30 shadow-[0_0_15px_-5px_rgba(168,85,247,0.2)]",

            // Speaking Highlight
            isSpeaking && !isMuted && "bg-emerald-900/10 border-emerald-500/30",

            // Team A
            isTeamA && !isDrawer && "bg-cyan-950/10 border-cyan-500/10 hover:border-cyan-500/30",

            // Team B
            isTeamB && !isDrawer && "bg-rose-950/10 border-rose-500/10 hover:border-rose-500/30",

            // Spectator
            isSpectator && "bg-transparent border-zinc-800/50 opacity-60 hover:opacity-100",

            // Default
            !isDrawer && !isTeamA && !isTeamB && !isSpectator && !isSpeaking && "bg-zinc-900/30 border-zinc-800 hover:bg-zinc-900/50"
        )}>
            {/* Rank / Status Indicator */}
            <div className={clsx(
                "w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold border",
                isDrawer ? "bg-purple-500 text-white border-purple-400" :
                    isTeamA ? "bg-cyan-950 text-cyan-400 border-cyan-900" :
                        isTeamB ? "bg-rose-950 text-rose-400 border-rose-900" :
                            "bg-zinc-900 text-zinc-500 border-zinc-800"
            )}>
                {isSpectator ? "👁️" : `#${rank}`}
            </div>

            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <div className={clsx(
                        "font-bold text-sm truncate transition-colors",
                        isDrawer ? "text-purple-300" :
                            isTeamA ? "text-cyan-200" :
                                isTeamB ? "text-rose-200" :
                                    "text-zinc-300"
                    )}>
                        {player.username}
                    </div>
                </div>
                {!isSpectator && (
                    <div className="text-[10px] uppercase tracking-wider font-bold text-zinc-600 group-hover:text-zinc-500 transition-colors">
                        {player.score} PTS
                    </div>
                )}
            </div>

            {/* Status Icons */}
            <div className="flex items-center gap-2">
                {isMuted && <MicOff className="w-3.5 h-3.5 text-red-500 opacity-50" />}
                {isSpeaking && !isMuted && <Volume2 className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />}
                {isDrawer && <Pencil className="w-3.5 h-3.5 text-purple-400" />}
            </div>
        </div>
    );
}
