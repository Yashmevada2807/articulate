'use client';

import { useEffect } from 'react';
import { useGameStore } from '../../../store/gameStore';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Copy, Users, Play, Crown } from 'lucide-react';

export default function LobbyPage({ params }: { params: { roomId: string } }) {
    const { players, roomId, socket, currentUser, setPlayers, setGameStatus } = useGameStore();
    const router = useRouter();

    // Protection: Redirect if no socket/room (e.g. refresh)
    useEffect(() => {
        if (!socket || !roomId) {
            router.replace('/join');
            return;
        }

        // Listen for Lobby updates
        const onPlayerJoined = (player: any) => {
            setPlayers([...useGameStore.getState().players, player]);
        };

        const onPlayerLeft = (playerId: string) => {
            const current = useGameStore.getState().players;
            setPlayers(current.filter(p => p.id !== playerId));
        };

        const onGameStarted = () => {
            setGameStatus('CHOOSING_WORD');
            router.push(`/game/${roomId}`);
        };

        socket.on('player-joined', onPlayerJoined);
        socket.on('player-left', onPlayerLeft);
        socket.on('game-started', onGameStarted);

        return () => {
            socket.off('player-joined', onPlayerJoined);
            socket.off('player-left', onPlayerLeft);
            socket.off('game-started', onGameStarted);
        };
    }, [socket, roomId, router, setPlayers, setGameStatus]);

    const handleStartGame = () => {
        if (socket) {
            socket.emit('start-game');
        }
    };

    const copyRoomId = () => {
        navigator.clipboard.writeText(roomId || '');
        // Could add toast here
    };

    if (!socket) return null;

    return (
        <div className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-2xl"
            >
                <div className="text-center mb-8">
                    <h2 className="text-3xl font-bold mb-2">Waiting Lobby</h2>
                    <p className="text-slate-400">Invite friends to play!</p>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 md:p-8 mb-6">
                    <div className="flex items-center justify-between mb-6 bg-slate-800/50 p-4 rounded-xl border border-dashed border-slate-700">
                        <div>
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Room Code</span>
                            <span className="text-3xl font-mono font-bold tracking-widest text-purple-400">{roomId}</span>
                        </div>
                        <button onClick={copyRoomId} className="p-3 hover:bg-slate-700 rounded-lg transition-colors text-slate-400 hover:text-white cursor-pointer">
                            <Copy className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="mb-8">
                        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                            <Users className="w-4 h-4" /> Players ({players.length})
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <AnimatePresence>
                                {players.map((player) => (
                                    <motion.div
                                        key={player.id}
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.9 }}
                                        className="bg-slate-800 p-3 rounded-xl flex items-center gap-3 border border-slate-700"
                                    >
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${player.isHost ? 'bg-amber-500/20 text-amber-500' : 'bg-slate-700 text-slate-400'}`}>
                                            {player.username[0].toUpperCase()}
                                        </div>
                                        <span className="font-medium flex-1 truncate">{player.username}</span>
                                        {player.isHost && <Crown className="w-4 h-4 text-amber-500" />}
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </div>
                    </div>

                    {currentUser?.isHost ? (
                        <button
                            onClick={handleStartGame}
                            disabled={players.length < 2}
                            className="w-full py-4 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-xl font-bold text-lg shadow-lg hover:shadow-emerald-900/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 cursor-pointer"
                        >
                            <Play className="w-5 h-5" /> Start Game
                        </button>
                    ) : (
                        <div className="text-center bg-slate-800/50 py-4 rounded-xl text-slate-400 animate-pulse">
                            Waiting for host to start...
                        </div>
                    )}
                </div>
            </motion.div>
        </div>
    );
}
