'use client';

import { useEffect, useState } from 'react';
import { useGameStore } from '../../../store/gameStore';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Copy, Users, Play, Crown, Settings2, Shuffle, UserPlus, CheckCircle2, AlertTriangle, Monitor } from 'lucide-react';
import clsx from 'clsx';

export default function LobbyPage({ params }: { params: { roomId: string } }) {
    const { players, roomId, socket, currentUser, setPlayers, setGameStatus, syncGameState, teamMode, setTeamMode } = useGameStore();
    const router = useRouter();
    const [copied, setCopied] = useState(false);

    // Protection: Redirect if no socket/room (e.g. refresh)
    useEffect(() => {
        if (!socket || !roomId) {
            router.replace('/join');
            return;
        }

        const onPlayerJoined = (player: any) => setPlayers([...useGameStore.getState().players, player]);
        const onPlayerLeft = (playerId: string) => setPlayers(useGameStore.getState().players.filter(p => p.id !== playerId));
        const onGameStarted = () => {
            setGameStatus('CHOOSING_WORD');
            router.push(`/game/${roomId}`);
        };
        const onGameStateSync = (state: any) => {
            syncGameState(state);
            router.push(`/game/${roomId}`);
        };
        const onTeamModeUpdated = (config: any) => setTeamMode(config);
        const onTeamUpdate = (updatedPlayers: any[]) => setPlayers(updatedPlayers);
        const onError = (msg: string) => alert(msg);

        socket.on('player-joined', onPlayerJoined);
        socket.on('player-left', onPlayerLeft);
        socket.on('game-started', onGameStarted);
        socket.on('sync-game-state', onGameStateSync);
        socket.on('team-mode-updated', onTeamModeUpdated);
        socket.on('team-update', onTeamUpdate);
        socket.on('error', onError);

        return () => {
            socket.off('player-joined', onPlayerJoined);
            socket.off('player-left', onPlayerLeft);
            socket.off('game-started', onGameStarted);
            socket.off('sync-game-state', onGameStateSync);
            socket.off('team-mode-updated', onTeamModeUpdated);
            socket.off('team-update', onTeamUpdate);
            socket.off('error', onError);
        };
    }, [socket, roomId, router, setPlayers, setGameStatus, setTeamMode, syncGameState]);

    const handleStartGame = () => {
        if (socket) socket.emit('start-game');
    };

    const copyRoomId = () => {
        navigator.clipboard.writeText(roomId || '');
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    // Team Mode Actions
    const toggleTeamMode = () => {
        if (!socket) return;
        socket.emit('update-team-mode', { enabled: !teamMode.enabled, selectionMode: teamMode.selectionMode });
    };

    const setSelectionMode = (mode: 'manual' | 'random') => {
        if (!socket) return;
        socket.emit('update-team-mode', { selectionMode: mode });
    };

    const joinTeam = (team: 'A' | 'B' | null, role: 'player' | 'spectator') => {
        if (!socket) return;
        socket.emit('join-team', team, role);
    };

    if (!socket) return null;

    const canStart = teamMode.enabled
        ? players.length >= 4 && useGameStore.getState().players.every(p => p.team || p.role === 'spectator')
        : players.length >= 2;

    const errorMsg = players.length < (teamMode.enabled ? 4 : 2)
        ? `Need ${teamMode.enabled ? 4 : 2} players min`
        : (teamMode.enabled && players.some(p => !p.team && p.role !== 'spectator'))
            ? "Players unassigned"
            : null;

    return (
        <div className="min-h-screen bg-black text-zinc-100 p-4 md:p-8 flex items-center justify-center font-sans">
            {/* Ambient Background */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-900/10 blur-[120px] rounded-full" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-900/10 blur-[120px] rounded-full" />
                <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-[0.03]" />
            </div>

            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-7xl relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8"
            >
                {/* Header & Controls (Left/Top) */}
                <div className="lg:col-span-12 flex flex-col md:flex-row items-center justify-between gap-6 mb-2">
                    <div className="flex items-center gap-4">
                        <div className="p-4 bg-zinc-950/80 backdrop-blur-xl rounded-2xl border border-zinc-900 shadow-2xl flex items-center gap-6 group hover:border-zinc-800 transition-colors">
                            <div>
                                <span className="text-zinc-600 font-bold text-[10px] uppercase tracking-widest block mb-0.5">Room Code</span>
                                <div className="flex items-center gap-3">
                                    <span className="text-4xl font-mono font-bold tracking-widest text-zinc-100">{roomId}</span>
                                </div>
                            </div>
                            <button
                                onClick={copyRoomId}
                                className="h-10 w-10 flex items-center justify-center rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-all border border-zinc-800 active:scale-95 cursor-pointer"
                                title="Copy Room Code"
                            >
                                {copied ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : <Copy className="w-5 h-5" />}
                            </button>
                        </div>
                    </div>

                    {currentUser?.isHost && (
                        <div className="flex items-center gap-4 p-2 bg-zinc-950/80 backdrop-blur-md rounded-2xl border border-zinc-900 shadow-xl">
                            <div className="flex items-center gap-3 px-2">
                                <Settings2 className="w-4 h-4 text-zinc-600" />
                                <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Settings</span>
                            </div>
                            <div className="h-8 w-px bg-zinc-900" />
                            <button
                                onClick={toggleTeamMode}
                                className={clsx(
                                    "px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border cursor-pointer",
                                    teamMode.enabled
                                        ? "bg-purple-500/10 border-purple-500/20 text-purple-400 shadow-[0_0_15px_-5px_rgba(168,85,247,0.2)]"
                                        : "bg-transparent border-transparent text-zinc-500 hover:text-zinc-300"
                                )}
                            >
                                <div className={clsx("w-2 h-2 rounded-full", teamMode.enabled ? "bg-purple-500" : "bg-zinc-700")} />
                                Team Mode
                            </button>

                            {teamMode.enabled && (
                                <>
                                    <div className="flex bg-zinc-900 rounded-lg p-1">
                                        <button
                                            onClick={() => setSelectionMode('manual')}
                                            className={clsx(
                                                "px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer",
                                                teamMode.selectionMode === 'manual' ? "bg-zinc-800 text-white shadow-sm" : "text-zinc-500 hover:text-zinc-300"
                                            )}
                                        >
                                            Manual
                                        </button>
                                        <button
                                            onClick={() => setSelectionMode('random')}
                                            className={clsx(
                                                "px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer",
                                                teamMode.selectionMode === 'random' ? "bg-zinc-800 text-white shadow-sm" : "text-zinc-500 hover:text-zinc-300"
                                            )}
                                        >
                                            Random
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>

                {/* Main Content Area */}
                <div className="lg:col-span-9 h-full min-h-[500px]">
                    <AnimatePresence mode="wait">
                        {!teamMode.enabled ? (
                            /* Standard Mode */
                            <motion.div
                                key="solo"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="bg-zinc-950/50 backdrop-blur-md border border-zinc-900 rounded-[32px] p-8 h-full"
                            >
                                <h3 className="text-xl font-bold text-zinc-100 mb-8 flex items-center gap-3">
                                    <div className="p-2 bg-zinc-900 rounded-lg">
                                        <Users className="w-5 h-5 text-zinc-400" />
                                    </div>
                                    <span>Active Players <span className="text-zinc-600 ml-2 text-lg font-medium">({players.length})</span></span>
                                </h3>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    {players.map(p => <PlayerCard key={p.id} player={p} variant="default" />)}
                                    {Array.from({ length: Math.max(0, 8 - players.length) }).map((_, i) => (
                                        <div key={i} className="h-24 rounded-2xl border border-dashed border-zinc-900 bg-zinc-900/20 flex items-center justify-center text-zinc-800 font-bold text-xs uppercase tracking-widest">Pending</div>
                                    ))}
                                </div>
                            </motion.div>
                        ) : (
                            /* Team Mode Layout */
                            <motion.div
                                key="teams"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="grid grid-cols-1 md:grid-cols-2 gap-6 h-full"
                            >
                                {/* Team A */}
                                <TeamSection
                                    title="Team A"
                                    accentColor="cyan"
                                    players={players.filter(p => p.team === 'A')}
                                    onJoin={() => joinTeam('A', 'player')}
                                    canJoin={teamMode.selectionMode === 'manual' && !teamMode.teamsLocked}
                                    variant="cyan"
                                />
                                {/* Team B */}
                                <TeamSection
                                    title="Team B"
                                    accentColor="rose"
                                    players={players.filter(p => p.team === 'B')}
                                    onJoin={() => joinTeam('B', 'player')}
                                    canJoin={teamMode.selectionMode === 'manual' && !teamMode.teamsLocked}
                                    variant="rose"
                                />
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Sidebar (Waitlist / Action) */}
                <div className="lg:col-span-3 space-y-6 flex flex-col">
                    {/* Spectators / Unassigned (Only in Team Mode) */}
                    {teamMode.enabled && (
                        <div className="bg-zinc-950/50 backdrop-blur-md border border-zinc-900 rounded-[32px] p-6 flex flex-col gap-6 flex-1 max-h-[500px]">
                            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                                <h4 className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-4 flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-zinc-700" />
                                    Unassigned
                                </h4>
                                <div className="space-y-2">
                                    {players.filter(p => !p.team && p.role !== 'spectator').map(p => (
                                        <PlayerCard key={p.id} player={p} variant="minimal" />
                                    ))}
                                    {players.filter(p => !p.team && p.role !== 'spectator').length === 0 && (
                                        <div className="text-zinc-800 text-xs italic text-center py-4 border border-zinc-900 rounded-xl">All assigned</div>
                                    )}
                                </div>

                                {teamMode.selectionMode === 'manual' && (
                                    <div className="flex gap-2 mt-4">
                                        <button onClick={() => joinTeam(null, 'player')} className="flex-1 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-[10px] font-bold text-zinc-400 hover:text-white transition-colors border border-zinc-800 uppercase tracking-wider cursor-pointer">Reset</button>
                                        <button onClick={() => joinTeam(null, 'spectator')} className="flex-1 py-2.5 rounded-xl border border-purple-500/20 text-purple-400 hover:bg-purple-950/20 text-[10px] font-bold transition-colors uppercase tracking-wider cursor-pointer">Spectate</button>
                                    </div>
                                )}

                                {players.some(p => p.role === 'spectator') && (
                                    <div className="mt-6 pt-6 border-t border-zinc-900">
                                        <h4 className="text-[10px] font-bold text-purple-500/70 uppercase tracking-widest mb-4 flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                                            Spectators
                                        </h4>
                                        <div className="space-y-2">
                                            {players.filter(p => p.role === 'spectator').map(p => (
                                                <PlayerCard key={p.id} player={p} variant="spectator" />
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Start Game Action */}
                    {currentUser?.isHost ? (
                        <div className="bg-zinc-950/80 backdrop-blur-xl border border-zinc-800 p-6 rounded-[32px] shadow-2xl mt-auto">
                            <button
                                onClick={handleStartGame}
                                disabled={!canStart}
                                className="w-full py-4 bg-zinc-100 hover:bg-white text-black rounded-2xl font-black text-sm uppercase tracking-widest shadow-[0_0_40px_-10px_rgba(255,255,255,0.1)] hover:shadow-[0_0_50px_-10px_rgba(255,255,255,0.2)] hover:scale-[1.02] active:scale-[0.98] disabled:opacity-20 disabled:shadow-none disabled:transform-none disabled:cursor-not-allowed cursor-pointer transition-all flex items-center justify-center gap-3"
                            >
                                <Play className="w-4 h-4 fill-current" /> Start Game
                            </button>
                            {errorMsg && (
                                <div className="mt-4 text-center">
                                    <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-950/30 text-red-400 text-[10px] font-bold border border-red-900/30 uppercase tracking-wide">
                                        <AlertTriangle className="w-3 h-3" /> {errorMsg}
                                    </span>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="bg-zinc-950/50 border border-zinc-900 p-8 rounded-[32px] text-center mt-auto">
                            <div className="animate-pulse flex flex-col items-center gap-4">
                                <div className="w-16 h-16 rounded-full bg-zinc-900 flex items-center justify-center border border-zinc-800">
                                    <Monitor className="w-8 h-8 text-zinc-600" />
                                </div>
                                <div className="text-zinc-500 font-bold text-xs uppercase tracking-widest">Waiting for host...</div>
                            </div>
                        </div>
                    )}
                </div>
            </motion.div>
        </div>
    );
}

// --- Components ---

function TeamSection({ title, accentColor, players, onJoin, canJoin, variant }: any) {
    const isCyan = accentColor === 'cyan';
    // Deep dark theme specific colors
    const borderColor = isCyan ? "border-cyan-500/20" : "border-rose-500/20";
    const glowColor = isCyan ? "group-hover:shadow-[0_0_40px_-10px_rgba(6,182,212,0.15)]" : "group-hover:shadow-[0_0_40px_-10px_rgba(244,63,94,0.15)]";
    const titleColor = isCyan ? "text-cyan-400" : "text-rose-400";
    const btnColor = isCyan ? "bg-cyan-950 text-cyan-400 border-cyan-900 hover:bg-cyan-900" : "bg-rose-950 text-rose-400 border-rose-900 hover:bg-rose-900";

    return (
        <div className={`group bg-zinc-950/40 backdrop-blur-md border ${borderColor} rounded-[32px] flex flex-col overflow-hidden transition-all duration-300 ${glowColor} h-full`}>
            {/* Header */}
            <div className={`p-6 border-b ${isCyan ? 'border-cyan-500/10' : 'border-rose-500/10'} flex items-center justify-between`}>
                <div>
                    <h3 className={`font-black text-2xl tracking-tight ${titleColor}`}>{title}</h3>
                    <div className="text-zinc-600 text-[10px] font-bold uppercase tracking-widest mt-1">{players.length} Players</div>
                </div>
                {canJoin && (
                    <button onClick={onJoin} className={`px-5 py-2 rounded-xl text-[10px] font-bold border transition-all hover:scale-105 active:scale-95 uppercase tracking-wider cursor-pointer ${btnColor}`}>
                        Join Team
                    </button>
                )}
            </div>

            <div className="p-6 flex-1 space-y-3 overflow-y-auto max-h-[400px]">
                <AnimatePresence>
                    {players.map((p: any) => (
                        <PlayerCard key={p.id} player={p} variant={variant} />
                    ))}
                </AnimatePresence>
                {players.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-zinc-800 py-12 min-h-[150px]">
                        <div className="text-[10px] uppercase tracking-widest font-bold">Empty Slot</div>
                    </div>
                )}
            </div>
        </div>
    )
}

function PlayerCard({ player, variant = 'default' }: { player: any, variant?: 'default' | 'cyan' | 'rose' | 'minimal' | 'spectator' }) {

    // Sleeker, darker card styles
    const styles = {
        default: "bg-zinc-900/50 border-zinc-800 text-zinc-300 hover:bg-zinc-800/50",
        cyan: "bg-cyan-950/20 border-cyan-500/20 text-cyan-200",
        rose: "bg-rose-950/20 border-rose-500/20 text-rose-200",
        minimal: "bg-zinc-900/30 border-zinc-800 text-zinc-400 text-xs py-2.5",
        spectator: "bg-purple-950/10 border-purple-500/10 text-purple-400 text-xs py-2.5"
    };

    const currentStyle = styles[variant] || styles.default;

    return (
        <motion.div
            layout
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className={`rounded-xl border px-4 py-3.5 flex items-center gap-4 relative group transition-all ${currentStyle}`}
        >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shadow-inner ${variant === 'cyan' ? 'bg-cyan-900 text-cyan-100' : variant === 'rose' ? 'bg-rose-900 text-rose-100' : 'bg-zinc-800 text-zinc-400'}`}>
                {player.username[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
                <div className="font-bold truncate text-sm tracking-wide">{player.username}</div>
            </div>
            {player.isHost && <Crown className="w-3.5 h-3.5 text-amber-500 opacity-80" />}
        </motion.div>
    );
}
