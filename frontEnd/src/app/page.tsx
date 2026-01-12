'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Palette, ArrowRight, User, Plus, LogIn } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { io } from 'socket.io-client';
import { useGameStore } from '../store/gameStore';
import clsx from 'clsx';

const socketUrl = 'http://localhost:3001';

export default function LandingPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [roomId, setRoomId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Determine which action triggered the loading state
  const [loadingAction, setLoadingAction] = useState<'create' | 'join' | null>(null);

  // Zustand
  const { setSocket, setRoomId: setStoreRoomId, setCurrentUser, setPlayers, syncGameState } = useGameStore();

  const connectAndEmit = (action: 'create' | 'join') => {
    if (!username.trim()) {
      setError('Please choose a nickname!');
      return;
    }
    if (action === 'join' && !roomId.trim()) {
      setError('Please enter a Room ID to join!');
      return;
    }

    setError('');
    setIsLoading(true);
    setLoadingAction(action);

    try {
      const socket = io(socketUrl);

      socket.on('connect_error', () => {
        setError('Could not connect to server.');
        setIsLoading(false);
        setLoadingAction(null);
      });

      socket.on('connect', () => {
        setSocket(socket);
        if (action === 'create') {
          socket.emit('create-room', username);
        } else {
          socket.emit('join-room', roomId, username);
        }
      });

      socket.on('error', (msg: string) => {
        setError(msg);
        setIsLoading(false);
        setLoadingAction(null);
        socket.disconnect();
      });

      socket.on('room-joined', (data: { roomId: string, players: any[], gameState?: any }) => {
        setStoreRoomId(data.roomId);
        setPlayers(data.players);

        const self = data.players.find(p => p.socketId === socket.id);
        if (self) setCurrentUser(self);

        if (data.gameState) {
          syncGameState(data.gameState);
          router.push(`/game/${data.roomId}`);
        } else {
          router.push(`/lobby/${data.roomId}`);
        }
      });

    } catch (e) {
      setError('Something went wrong.');
      setIsLoading(false);
      setLoadingAction(null);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-[#0F172A] flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans text-slate-100">

      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 via-pink-500 to-purple-500 opacity-80" />
      <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-[0.03] pointer-events-none" />

      {/* Main Container */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm z-10"
      >
        {/* Header / Logo */}
        <div className="text-center mb-6">
          <h1 className="text-5xl font-black tracking-tight bg-gradient-to-br from-white to-slate-400 bg-clip-text text-transparent flex items-center justify-center gap-3">
            <Palette className="w-10 h-10 text-purple-400" />
            Articulate
          </h1>
        </div>

        {/* Game Card */}
        <div className="bg-[#1E293B] rounded-3xl shadow-2xl shadow-black/50 overflow-hidden border border-slate-700/50">

          {/* Avatar Section */}
          <div className="bg-[#0F172A]/50 p-6 flex justify-center border-b border-slate-700/50">
            <div className="relative group cursor-pointer">
              <div className="w-20 h-20 bg-slate-700 rounded-full flex items-center justify-center border-4 border-[#1E293B] shadow-lg group-hover:scale-105 transition-transform">
                <User className="w-10 h-10 text-slate-400" />
              </div>
            </div>
          </div>

          {/* Inputs Section */}
          <div className="p-6 space-y-6">

            {/* Name Input */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 ml-1 uppercase tracking-wider">Nickname</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Type your name"
                className="w-full bg-[#0F172A] text-white font-bold text-lg px-4 py-3 rounded-xl border border-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent placeholder:text-slate-600 transition-all"
                maxLength={12}
              />
            </div>

            {error && (
              <div className="text-red-400 text-xs text-center font-medium bg-red-500/10 py-2 rounded-lg animate-pulse">
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 gap-3">
              {/* Create Room Button */}
              <button
                onClick={() => connectAndEmit('create')}
                disabled={isLoading}
                className="w-full py-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-black text-lg rounded-xl shadow-lg shadow-emerald-900/20 transform transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed group flex items-center justify-center gap-2"
              >
                {loadingAction === 'create' ? (
                  'Creating...'
                ) : (
                  <>
                    <Plus className="w-5 h-5" />
                    Create Private Room
                  </>
                )}
              </button>

              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-slate-700"></div>
                <span className="flex-shrink-0 mx-4 text-slate-500 text-xs font-bold uppercase">OR</span>
                <div className="flex-grow border-t border-slate-700"></div>
              </div>

              {/* Join Room Section */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                  placeholder="Room Code"
                  className="flex-1 bg-[#0F172A]/50 text-white text-center font-mono font-bold uppercase py-3 rounded-xl border border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-slate-600 text-sm transition-all"
                />
                <button
                  onClick={() => connectAndEmit('join')}
                  disabled={isLoading}
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-lg shadow-blue-900/20 transform transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loadingAction === 'join' ? 'Joining...' : 'Join Room'}
                </button>
              </div>
            </div>

          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center opacity-50 hover:opacity-100 transition-opacity">
          <p className="text-slate-600 text-xs">
            v1.0.0 • Multiplayer Drawing Game
          </p>
        </div>

      </motion.div>
    </div>
  );
}
