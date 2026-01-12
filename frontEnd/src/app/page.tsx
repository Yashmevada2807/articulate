'use client';

import { motion } from 'framer-motion';
import { Palette, Rocket, Users } from 'lucide-react';
import Link from 'next/link';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex flex-col relative overflow-hidden">
      {/* Background Gradients */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-purple-600/20 rounded-full blur-[128px] -translate-x-1/2 -translate-y-1/2" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-emerald-600/10 rounded-full blur-[128px] translate-x-1/2 translate-y-1/2" />

      <header className="py-6 px-4 md:px-8 flex justify-between items-center z-10 glass-nav">
        <div className="flex items-center gap-2">
          <Palette className="w-8 h-8 text-purple-400" />
          <span className="text-xl font-bold bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">
            Articulate
          </span>
        </div>
        <div className="flex gap-4">
          {/* Placeholder for optional small nav items */}
        </div>
      </header>

      <main className="flex-1 container mx-auto flex flex-col justify-center items-center px-4 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center max-w-2xl"
        >
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6">
            Draw. Guess. <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-500 to-amber-400 animate-gradient-x">
              Laugh Together.
            </span>
          </h1>
          <p className="text-slate-400 text-lg md:text-xl mb-10 leading-relaxed">
            The ultimate real-time multiplayer drawing game. Challenge your friends to guess your masterpiece before time runs out!
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/join">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl font-bold text-lg shadow-lg shadow-purple-900/40 border border-purple-500/20 cursor-pointer"
              >
                Play Now
              </motion.button>
            </Link>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="px-8 py-4 bg-slate-800/50 backdrop-blur rounded-xl font-bold text-lg border border-slate-700 hover:bg-slate-800 transition-colors cursor-pointer"
            >
              How it Works
            </motion.button>
          </div>
        </motion.div>

        {/* Features Grid */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 1 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-20 w-full max-w-4xl"
        >
          <FeatureCard
            icon={<Rocket className="w-6 h-6 text-amber-400" />}
            title="Fast Paced"
            desc="60 seconds to draw. Can you handle the pressure?"
          />
          <FeatureCard
            icon={<Users className="w-6 h-6 text-emerald-400" />}
            title="Multiplayer"
            desc="Create rooms to play with friends anywhere."
          />
          <FeatureCard
            icon={<Palette className="w-6 h-6 text-pink-400" />}
            title="Creative Tools"
            desc="Express yourself with a smooth canvas and colors."
          />
        </motion.div>
      </main>

      <footer className="py-6 text-center text-slate-500 text-sm z-10">
        © 2026 Articulate. Built for speed and fun.
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, desc }: { icon: any, title: string, desc: string }) {
  return (
    <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800/60 backdrop-blur-sm hover:bg-slate-800/60 transition-colors">
      <div className="mb-4 inline-flex p-3 rounded-lg bg-slate-950 border border-slate-800">
        {icon}
      </div>
      <h3 className="text-lg font-bold text-slate-200 mb-2">{title}</h3>
      <p className="text-slate-400 text-sm">{desc}</p>
    </div>
  );
}
