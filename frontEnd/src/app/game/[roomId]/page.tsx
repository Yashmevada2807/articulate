'use client';

import { useEffect, useState, useRef } from 'react';
import { useGameStore, Player } from '../../../store/gameStore';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Eraser, Pencil, Send, Trash2, Menu, X, Volume2, Mic, MicOff } from 'lucide-react';
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
        <div className="h-[100dvh] bg-slate-950 text-slate-50 flex flex-col overflow-hidden">
            {/* Header: Timer & Round Info */}
            <header className="h-14 md:h-16 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-4 md:px-6 z-20 shrink-0">
                <div className="flex items-center gap-3">
                    <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="md:hidden p-2 text-slate-400 hover:text-white">
                        <Menu className="w-6 h-6" />
                    </button>
                    <div className="font-bold text-sm md:text-xl">Round {currentRound || 1}/{totalRounds || 3}</div>
                </div>

                <div className="absolute left-1/2 -translate-x-1/2 text-2xl md:text-3xl font-mono font-bold text-amber-400">
                    {timeLeft}s
                </div>

                <div className="text-sm md:text-base">
                    <span className="md:inline hidden mr-2">Word:</span>
                    <span className="font-mono tracking-widest text-slate-400 font-bold text-lg">{word || '_ _ _'}</span>
                </div>
            </header>

            <main className="flex-1 flex flex-col md:flex-row overflow-hidden relative">

                {/* Visual Overlay for Mobile Menu Background */}
                <AnimatePresence>
                    {isMenuOpen && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsMenuOpen(false)}
                            className="absolute inset-0 bg-black/60 z-30 md:hidden backdrop-blur-sm"
                        />
                    )}
                </AnimatePresence>

                {/* Left: Players List (Sidebar / Drawer) */}

                <aside
                    className={clsx(
                        "absolute md:static top-0 left-0 bottom-0 w-3/4 max-w-[300px] md:w-64 bg-slate-900 md:bg-slate-900/50 border-r border-slate-800 z-40 flex flex-col transition-transform duration-300",
                        isMenuOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full md:translate-x-0"
                    )}
                >
                    <div className="p-4 flex justify-between items-center md:hidden border-b border-slate-800">
                        <h3 className="font-bold text-slate-100">Leaderboard</h3>
                        <button onClick={() => setIsMenuOpen(false)}><X className="w-6 h-6 text-slate-400" /></button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-2">
                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 hidden md:block">Leaderboard</h3>
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

                    {/* Voice Manager Embedded in Sidebar */}
                    <div className="p-4 bg-slate-900/50 border-t border-slate-800">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
                                <Volume2 className={clsx("w-4 h-4", activeVoiceCount > 0 && "text-emerald-400 animate-pulse")} />
                                Voice Chat
                            </div>
                            {activeVoiceCount > 0 ? (
                                <span className="text-xs font-bold text-emerald-400">{activeVoiceCount} Active</span>
                            ) : (
                                <span className="text-xs font-bold text-slate-600">0 Active</span>
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
                <section className="flex-1 bg-slate-800/20 relative flex flex-col overflow-hidden min-h-[350px]">
                    <div className="flex-1 flex items-center justify-center p-2 md:p-4 overflow-hidden">
                        <div className="w-full h-full max-w-4xl bg-white rounded-lg shadow-2xl relative overflow-hidden flex items-center justify-center touch-none">
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
                                        className="absolute inset-0 bg-slate-900/95 flex flex-col items-center justify-center z-10 p-4 text-center"
                                    >
                                        <h2 className="text-xl md:text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent animate-pulse mb-6">
                                            {isDrawer ? 'Choose a word!' : `${players.find(p => p.id === currentDrawer)?.username || 'Drawer'} is choosing...`}
                                        </h2>

                                        {isDrawer && availableWords.length > 0 && (
                                            <div className="flex flex-wrap gap-3 justify-center">
                                                {availableWords.map((w) => (
                                                    <button
                                                        key={w}
                                                        onClick={() => {
                                                            handleWordSelection(w);
                                                            setWord(w);
                                                        }}
                                                        className="px-4 py-2 md:px-6 md:py-3 bg-slate-800 border border-slate-700 hover:border-purple-500 rounded-xl font-bold text-lg md:text-xl text-slate-200 shadow-lg active:scale-95 transition-all"
                                                    >
                                                        {w}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>

                    {/* Toolbar (Only for drawer) - Scrollable on mobile */}
                    {isDrawer && (
                        <div className="h-16 md:h-20 bg-slate-900 border-t border-slate-800 flex items-center justify-center animate-slide-up shrink-0 overflow-x-auto px-4">
                            <div className="flex gap-2 bg-slate-800 p-1.5 md:p-2 rounded-lg items-center shadow-lg border border-slate-700 md:w-auto w-max">
                                <ColorBtn color="#000000" selected={color === '#000000'} onClick={() => setColor('#000000')} />
                                <ColorBtn color="#ef4444" selected={color === '#ef4444'} onClick={() => setColor('#ef4444')} />
                                <ColorBtn color="#3b82f6" selected={color === '#3b82f6'} onClick={() => setColor('#3b82f6')} />
                                <ColorBtn color="#22c55e" selected={color === '#22c55e'} onClick={() => setColor('#22c55e')} />
                                <ColorBtn color="#eab308" selected={color === '#eab308'} onClick={() => setColor('#eab308')} />

                                <div className="w-px h-6 md:h-8 bg-slate-700 mx-1 md:mx-2"></div>

                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-slate-500" style={{ transform: `scale(${brushSize / 5})` }}></div>
                                    <input
                                        type="range"
                                        min="2" max="20"
                                        value={brushSize}
                                        onChange={(e) => setBrushSize(parseInt(e.target.value))}
                                        className="w-16 md:w-24 accent-purple-500 cursor-pointer"
                                    />
                                </div>

                                <div className="w-px h-6 md:h-8 bg-slate-700 mx-1 md:mx-2"></div>

                                <button onClick={() => setColor('#ffffff')} className={clsx("p-2 rounded md:p-3", color === '#ffffff' ? "bg-slate-700 text-white" : "text-slate-400")}><Eraser className="w-4 h-4 md:w-5 md:h-5" /></button>
                                <button onClick={handleClearCanvas} className="p-2 text-red-400 md:p-3"><Trash2 className="w-4 h-4 md:w-5 md:h-5" /></button>
                            </div>
                        </div>
                    )}
                </section>

                {/* Right: Chat - Fixed height on mobile */}
                <aside className="h-[35vh] md:h-auto md:w-80 bg-slate-900 border-t md:border-t-0 md:border-l border-slate-800 flex flex-col z-10 shrink-0">
                    <div className="flex-1 overflow-y-auto p-3 md:p-4 space-y-2 md:space-y-3">
                        {messages.map((msg) => (
                            <div key={msg.id} className={clsx("text-sm transition-colors",
                                msg.isSystem ? "text-green-400 font-bold" : "text-red-400"
                            )}>
                                {!msg.isSystem && <span className="font-bold text-slate-500">{msg.username}: </span>}
                                <span className={clsx(msg.isSystem && "italic")}>{msg.text}</span>
                            </div>
                        ))}
                        <div ref={chatEndRef} />
                    </div>
                    <form onSubmit={handleSendMessage} className="p-3 md:p-4 bg-slate-950 border-t border-slate-800 flex gap-2 shrink-0 safe-area-bottom">
                        {/* Mobile/Quick Mute Toggle */}
                        <button
                            type="button"
                            onClick={() => setIsMicMuted(!isMicMuted)}
                            className={clsx(
                                "p-2 rounded-lg transition-colors border",
                                isMicMuted
                                    ? "bg-red-500/10 border-red-500/50 text-red-500"
                                    : "bg-slate-800 border-slate-700 text-green-400 hover:bg-slate-700"
                            )}
                        >
                            {isMicMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                        </button>

                        <input
                            type="text"
                            value={guessInput}
                            onChange={(e) => setGuessInput(e.target.value)}
                            disabled={isDrawer || hasGuessed}
                            placeholder={isDrawer ? "Drawing..." : "Type guess..."}
                            className={clsx(
                                "flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500 transition-colors",
                                (isDrawer || hasGuessed) && "opacity-50 cursor-not-allowed"
                            )}
                        />
                        <button type="submit" className="p-2 bg-slate-800 rounded-lg text-slate-400 hover:text-purple-400 transition-colors">
                            <Send className="w-4 h-4" />
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

function PlayerCard({ player, rank, isDrawer, isSpeaking, isMuted }: { player: Player, rank: number, isDrawer: boolean, isSpeaking?: boolean, isMuted?: boolean }) {
    return (
        <div className={clsx(
            "p-3 rounded-xl flex items-center gap-3 transition-all duration-200 border",
            isSpeaking ? "shadow-[0_0_15px_rgba(52,211,153,0.3)] border-emerald-500/50 bg-slate-800" :
                isDrawer ? "bg-purple-900/20 border-purple-500/30" :
                    "bg-slate-800/50 border-transparent"
        )}>
            <div className="font-mono text-slate-500 text-xs w-4">#{rank}</div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <div className={clsx("font-bold text-sm truncate", isDrawer ? "text-purple-400" : "text-slate-300")}>
                        {player.username}
                    </div>
                    {isMuted && <MicOff className="w-3 h-3 text-red-400 shrink-0" />}
                </div>
                <div className="text-xs text-slate-500">Score: {player.score}</div>
            </div>
            {isDrawer && <Pencil className="w-3 h-3 text-purple-400 animate-bounce" />}
            {isSpeaking && !isMuted && <Volume2 className="w-3 h-3 text-emerald-400 animate-pulse" />}
        </div>
    );
}
