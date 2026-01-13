'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Palette, ArrowRight, User, Plus, LogIn, Zap } from 'lucide-react';
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
    <div className="min-h-[100dvh] bg-black flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans text-zinc-100 selection:bg-purple-500/30">

      {/* Ambient Background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-purple-900/10 blur-[100px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-900/10 blur-[100px] rounded-full" />
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-[0.03]" />
      </div>

      {/* Main Container */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm z-10"
      >
        {/* Header / Logo */}
        <div className="text-center mb-8 flex flex-col items-center">
          <div className="w-16 h-16 bg-zinc-900/50 backdrop-blur-xl border border-zinc-800 rounded-2xl flex items-center justify-center shadow-2xl mb-4 group relative">
            <div className="absolute inset-0 bg-purple-500/20 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
            <Palette className="w-8 h-8 text-zinc-100 relative z-10" />
          </div>
          <h1 className="text-4xl font-black tracking-tight text-white mb-2">
            Articulate
          </h1>
          <p className="text-zinc-500 font-bold text-xs uppercase tracking-widest">
            Multiplayer Drawing Game
          </p>
        </div>

        {/* Game Card */}
        <div className="bg-zinc-950/50 backdrop-blur-xl rounded-[32px] border border-zinc-900 shadow-2xl overflow-hidden relative">

          {/* Avatar Section */}
          <div className="p-8 pb-0 flex justify-center relative">
            <div className="w-24 h-24 bg-zinc-900 rounded-full flex items-center justify-center border-4 border-zinc-950 shadow-inner relative z-10">
              <User className="w-10 h-10 text-zinc-600" />
              <motion.div
                className="absolute -bottom-2 -right-2 bg-green-500 w-6 h-6 rounded-full border-4 border-zinc-950"
                initial={{ scale: 0 }}
                animate={{ scale: 1, transition: { delay: 0.5 } }}
              />
            </div>
            <div className="absolute inset-0 bg-gradient-to-b from-zinc-900/50 to-transparent h-32 opacity-50" />
          </div>

          {/* Inputs Section */}
          <div className="p-8 space-y-6">

            {/* Name Input */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest ml-1">Nickname</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your name..."
                className="w-full bg-black/50 text-white font-bold text-center text-lg px-4 py-4 rounded-2xl border border-zinc-800 focus:outline-none focus:border-purple-500/50 focus:ring-4 focus:ring-purple-500/10 placeholder:text-zinc-700 transition-all shadow-inner"
                maxLength={12}
              />
            </div>

            {error && (
              <div className="text-red-400 text-[10px] uppercase tracking-widest text-center font-bold bg-red-950/20 py-2 rounded-lg border border-red-900/20">
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 pt-2">
              {/* Create Room Button */}
              <button
                onClick={() => connectAndEmit('create')}
                disabled={isLoading}
                className="w-full py-4 bg-zinc-100 hover:bg-white text-black font-black text-sm uppercase tracking-widest rounded-2xl shadow-[0_0_20px_-5px_rgba(255,255,255,0.2)] hover:shadow-[0_0_30px_-5px_rgba(255,255,255,0.3)] transform transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer group flex items-center justify-center gap-2 relative overflow-hidden"
              >
                {loadingAction === 'create' ? (
                  <span className="animate-pulse">Creating...</span>
                ) : (
                  <>
                    <Zap className="w-4 h-4 fill-current" />
                    Create Room
                  </>
                )}
              </button>

              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-zinc-900"></div>
                <span className="flex-shrink-0 mx-4 text-zinc-700 text-[10px] font-bold uppercase tracking-widest">OR JOIN</span>
                <div className="flex-grow border-t border-zinc-900"></div>
              </div>

              {/* Join Room Section */}
              <div className="flex gap-3">
                <input
                  type="text"
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                  placeholder="CODE"
                  className="w-24 bg-zinc-900/50 text-white text-center font-mono font-bold uppercase py-3 rounded-2xl border border-zinc-800 focus:outline-none focus:border-zinc-700 text-sm transition-all focus:bg-zinc-900"
                />
                <button
                  onClick={() => connectAndEmit('join')}
                  disabled={isLoading}
                  className="flex-1 py-3 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white font-bold text-xs uppercase tracking-wider rounded-2xl border border-zinc-800 hover:border-zinc-700 transform transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
                >
                  {loadingAction === 'join' ? 'Joining...' : 'Enter Room'}
                </button>
              </div>
            </div>

          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-zinc-700 text-[10px] font-bold uppercase tracking-widest opacity-50 hover:opacity-100 transition-opacity cursor-default">
            v1.0.0 • Production Build
          </p>
        </div>

      </motion.div>
    </div>
  );
}
