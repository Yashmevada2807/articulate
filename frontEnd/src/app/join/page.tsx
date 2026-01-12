'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Plus, LogIn } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { io } from 'socket.io-client';
import { useGameStore } from '../../store/gameStore';
import clsx from 'clsx';

const socketUrl = 'http://localhost:3001'; // Environment variable in real app

export default function JoinPage() {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<'create' | 'join'>('create');
    const [username, setUsername] = useState('');
    const [roomId, setRoomId] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    // Zustand actions
    const { setSocket, setRoomId: setStoreRoomId, setCurrentUser, setPlayers } = useGameStore();

    const handleConnect = async () => {
        if (!username.trim()) {
            setError('Please enter a username');
            return;
        }
        if (activeTab === 'join' && !roomId.trim()) {
            setError('Please enter a Room ID');
            return;
        }

        setError('');
        setIsLoading(true);

        try {
            const socket = io(socketUrl);

            socket.on('connect_error', () => {
                setError('Failed to connect to server');
                setIsLoading(false);
            });

            socket.on('connect', () => {
                setSocket(socket);

                // Set up global listeners here or in a separate hook? 
                // Ideally, global listeners should be in a top-level layout or hook.
                // For now, attaching basic join logic.

                const eventName = activeTab === 'create' ? 'create-room' : 'join-room';
                const args = activeTab === 'create' ? [username] : [roomId, username];

                socket.emit(eventName, ...args);
            });

            socket.on('error', (msg: string) => {
                setError(msg);
                setIsLoading(false);
                socket.disconnect();
            });

            socket.on('room-joined', (data: { roomId: string, players: any[] }) => {
                setStoreRoomId(data.roomId);
                setPlayers(data.players);

                // Find self
                const self = data.players.find(p => p.socketId === socket.id);
                if (self) setCurrentUser(self);

                // Navigate
                router.push(`/lobby/${data.roomId}`);
            });

        } catch (e) {
            setError('An unexpected error occurred');
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 md:p-8"
            >
                <button onClick={() => router.back()} className="text-slate-400 hover:text-white mb-6 flex items-center gap-2 transition-colors cursor-pointer">
                    <ArrowLeft className="w-4 h-4" /> Back
                </button>

                <div className="flex bg-slate-800 rounded-lg p-1 mb-8">
                    <TabButton active={activeTab === 'create'} onClick={() => setActiveTab('create')} icon={<Plus className="w-4 h-4" />}>Create Room</TabButton>
                    <TabButton active={activeTab === 'join'} onClick={() => setActiveTab('join')} icon={<LogIn className="w-4 h-4" />}>Join Room</TabButton>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1">Username</label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="Enter your name"
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all font-medium"
                        />
                    </div>

                    {activeTab === 'join' && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                            <label className="block text-sm font-medium text-slate-400 mb-1">Room ID</label>
                            <input
                                type="text"
                                value={roomId}
                                onChange={(e) => setRoomId(e.target.value)}
                                placeholder="e.g. A4B2"
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-mono uppercase"
                            />
                        </motion.div>
                    )}

                    {error && (
                        <p className="text-red-400 text-sm">{error}</p>
                    )}

                    <button
                        onClick={handleConnect}
                        disabled={isLoading}
                        className={clsx(
                            "w-full py-4 rounded-xl font-bold text-lg shadow-lg mt-4 transition-all relative overflow-hidden cursor-pointer",
                            activeTab === 'create' ? "bg-gradient-to-r from-purple-600 to-pink-600" : "bg-gradient-to-r from-blue-600 to-cyan-600",
                            isLoading && "opacity-70 cursor-not-allowed"
                        )}
                    >
                        {isLoading ? 'Connecting...' : (activeTab === 'create' ? 'Create & Play' : 'Join Game')}
                    </button>
                </div>
            </motion.div>
        </div>
    );
}

function TabButton({ active, children, onClick, icon }: any) {
    return (
        <button
            onClick={onClick}
            className={clsx(
                "flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-bold rounded-md transition-all cursor-pointer",
                active ? "bg-slate-700 shadow-sm text-white" : "text-slate-400 hover:text-slate-200"
            )}
        >
            {icon}
            {children}
        </button>
    );
}
