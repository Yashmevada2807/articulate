'use client';

import { motion } from 'framer-motion';
import { Trophy, Medal, Crown } from 'lucide-react';
import { Player } from '../store/gameStore';
import clsx from 'clsx';

interface ScoreboardProps {
    players: Player[];
    isGameOver?: boolean;
    onNextRound?: () => void; // Only for host?
}

export default function Scoreboard({ players, isGameOver = false, onNextRound }: ScoreboardProps) {
    const sortedPlayers = [...players].sort((a, b) => b.score - a.score);

    return (
        <motion.div
            initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
            animate={{ opacity: 1, backdropFilter: "blur(12px)" }}
            className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/80"
        >
            <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-8 overflow-hidden relative"
            >
                {/* Background Decor */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/10 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2" />

                <div className="text-center mb-8 relative z-10">
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
                        className="w-16 h-16 bg-gradient-to-br from-amber-400 to-orange-600 rounded-2xl mx-auto flex items-center justify-center mb-4 shadow-lg shadow-amber-900/20"
                    >
                        <Trophy className="w-8 h-8 text-white" />
                    </motion.div>
                    <h2 className="text-3xl font-bold text-white mb-2">
                        {isGameOver ? 'Game Over!' : 'Round Complete'}
                    </h2>
                    <p className="text-slate-400">
                        {isGameOver ? 'The final standings are in.' : 'Here are the current scores.'}
                    </p>
                </div>

                <div className="space-y-3 relative z-10 mb-8 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                    {sortedPlayers.map((player, index) => (
                        <motion.div
                            key={player.id}
                            initial={{ x: -20, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            transition={{ delay: index * 0.1 + 0.3 }}
                            className={clsx(
                                "flex items-center gap-4 p-4 rounded-xl border transition-all",
                                index === 0 ? "bg-gradient-to-r from-amber-500/20 to-orange-500/10 border-amber-500/40" :
                                    index === 1 ? "bg-slate-800/50 border-slate-700" :
                                        index === 2 ? "bg-slate-800/30 border-slate-700" :
                                            "bg-slate-900/50 border-transparent"
                            )}
                        >
                            <div className={clsx(
                                "w-8 h-8 flex items-center justify-center rounded-lg font-bold text-sm",
                                index === 0 ? "bg-amber-500 text-slate-950" :
                                    index === 1 ? "bg-slate-400 text-slate-900" :
                                        index === 2 ? "bg-orange-700 text-slate-200" :
                                            "bg-slate-800 text-slate-500"
                            )}>
                                {index + 1}
                            </div>

                            <div className="flex-1 font-bold text-slate-200 flex items-center gap-2">
                                {player.username}
                                {index === 0 && <Crown className="w-4 h-4 text-amber-500" />}
                            </div>

                            <div className="text-right">
                                <span className={clsx(
                                    "font-mono font-bold text-lg",
                                    index === 0 ? "text-amber-400" : "text-slate-400"
                                )}>
                                    {player.score}
                                </span>
                                <span className="text-xs text-slate-500 ml-1">pts</span>
                            </div>
                        </motion.div>
                    ))}
                </div>

                {isGameOver && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 1 }}
                        className="flex justify-center"
                    >
                        <button
                            onClick={onNextRound} // Reuse this prop for "Return to Lobby" or "Play Again"
                            className="px-8 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-bold transition-colors"
                        >
                            Return to Lobby
                        </button>
                    </motion.div>
                )}
            </motion.div>
        </motion.div>
    );
}
