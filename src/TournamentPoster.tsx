import React, { useState } from 'react';
import { Trophy, Gamepad2, Star, Medal, Zap, Users, PlaySquare, ArrowRight, CornerUpLeft, CheckCircle2 } from 'lucide-react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';

export const TournamentPoster = () => {
  const navigate = useNavigate();
  const [isRegistered, setIsRegistered] = useState(false);

  return (
    <div className="fixed inset-0 z-[100] bg-[#050014] text-white font-sans overflow-x-hidden overflow-y-auto selection:bg-cyan-500/30">
      <div className="min-h-full min-w-full flex items-center justify-center p-4 sm:p-8 relative">
        {/* Back button */}
        <button 
          onClick={() => navigate(-1)}
          className="absolute top-4 left-4 sm:top-6 sm:left-6 z-50 flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-full border border-white/10 transition-colors backdrop-blur-md"
        >
          <CornerUpLeft size={18} className="text-cyan-400" />
          <span className="text-sm font-bold tracking-widest text-zinc-300">BACK</span>
        </button>

        {/* Background Effects */}
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center opacity-20 mix-blend-luminosity pointer-events-none"></div>
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#050014]/80 to-[#050014] pointer-events-none"></div>

        {/* Glowing Orbs */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/30 rounded-full blur-[120px] pointer-events-none"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-600/30 rounded-full blur-[120px] pointer-events-none"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-[500px] max-w-lg bg-cyan-500/10 rounded-full blur-[150px] pointer-events-none"></div>

        {/* Poster Container */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-4xl border border-cyan-500/30 bg-black/40 backdrop-blur-xl rounded-[2rem] p-6 sm:p-12 shadow-[0_0_50px_-12px_rgba(6,182,212,0.4)] flex flex-col items-center overflow-hidden"
      >
        {/* Top/Bottom Border Gradients */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent opacity-80"></div>
        <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-purple-500 to-transparent opacity-80"></div>

        {/* Header */}
        <div className="text-center mb-10 w-full">
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-gradient-to-r from-blue-900/50 to-purple-900/50 border border-blue-500/30 text-cyan-300 font-bold tracking-widest uppercase text-xs sm:text-sm mb-6 shadow-[0_0_15px_rgba(59,130,246,0.5)]"
          >
            <Gamepad2 size={16} /> Official Tournament
          </motion.div>
          <h1 className="text-5xl sm:text-7xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-500 filter drop-shadow-[0_0_10px_rgba(6,182,212,0.8)] mb-2 uppercase">
            eFootball
          </h1>
          <h2 className="text-2xl sm:text-4xl font-bold tracking-[0.2em] text-white uppercase text-shadow-sm shadow-cyan-500/50">
            Tournament 2026
          </h2>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full">

          {/* Left Column: Prizes */}
          <motion.div 
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="flex flex-col gap-4"
          >
            <div className="flex items-center gap-3 mb-2 px-2">
              <Trophy className="text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.6)]" size={28} />
              <h3 className="text-2xl font-bold text-yellow-400 tracking-wide uppercase">Prize Pool</h3>
            </div>

            <div className="bg-gradient-to-r from-yellow-500/20 to-transparent border-l-4 border-yellow-400 p-4 rounded-r-xl backdrop-blur-sm transform transition-transform hover:translate-x-2 cursor-default relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-full bg-gradient-to-l from-yellow-500/10 to-transparent"></div>
              <div className="text-yellow-400 font-bold text-xs tracking-widest uppercase mb-1 drop-shadow-md">Champion</div>
              <div className="text-4xl font-black text-white drop-shadow-[0_2px_10px_rgba(255,255,255,0.4)]">1000 TK</div>
            </div>

            <div className="bg-gradient-to-r from-gray-400/20 to-transparent border-l-4 border-gray-400 p-4 rounded-r-xl backdrop-blur-sm transform transition-transform hover:translate-x-2 cursor-default">
              <div className="text-gray-400 font-bold text-xs tracking-widest uppercase mb-1 drop-shadow-md">Runner Up</div>
              <div className="text-3xl font-bold text-white drop-shadow-[0_2px_8px_rgba(255,255,255,0.3)]">700 TK</div>
            </div>

            <div className="bg-gradient-to-r from-amber-700/20 to-transparent border-l-4 border-amber-600 p-4 rounded-r-xl backdrop-blur-sm transform transition-transform hover:translate-x-2 cursor-default">
              <div className="text-amber-500 font-bold text-xs tracking-widest uppercase mb-1 drop-shadow-md">3rd Place</div>
              <div className="text-2xl font-bold text-white drop-shadow-[0_2px_8px_rgba(255,255,255,0.2)]">500 TK</div>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-2">
               <div className="bg-white/5 border border-white/10 p-4 rounded-xl backdrop-blur-sm hover:bg-white/10 transition-colors cursor-default">
                 <span className="text-zinc-400 text-[10px] font-bold uppercase tracking-widest block mb-1">4th Place</span>
                 <span className="text-xl font-bold text-white">200 TK</span>
               </div>
               <div className="bg-white/5 border border-white/10 p-4 rounded-xl backdrop-blur-sm text-right hover:bg-white/10 transition-colors cursor-default">
                 <span className="text-zinc-400 text-[10px] font-bold uppercase tracking-widest block mb-1">Top Scorer</span>
                 <span className="text-xl font-bold text-cyan-400">100 TK</span>
               </div>
            </div>
          </motion.div>

          {/* Right Column: Features & Entry */}
          <motion.div 
            initial={{ x: 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="flex flex-col gap-6 w-full"
          >
            {/* Entry Fee Box */}
            <div className="border border-green-500/30 bg-gradient-to-br from-green-500/20 to-emerald-900/40 p-6 rounded-2xl relative overflow-hidden group shadow-[0_0_30px_rgba(34,197,94,0.15)] flex flex-col justify-center h-full min-h-[200px] transform transition-transform hover:-translate-y-1">
              <div className="absolute -top-10 -right-10 w-40 h-40 bg-green-500/20 rounded-full blur-[40px] group-hover:bg-green-400/30 transition-colors"></div>
              <div className="relative z-10 flex flex-col items-center text-center">
                <h4 className="text-green-400 font-bold tracking-widest uppercase mb-4 text-sm">Entry Fee</h4>
                <div className="text-6xl font-black text-white flex items-baseline gap-2 drop-shadow-[0_2px_15px_rgba(255,255,255,0.5)]">
                  200 <span className="text-3xl text-green-400 font-bold">TK</span>
                </div>
              </div>
            </div>
          </motion.div>

        </div>

        {/* Footer / CTA */}
        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-12 w-full flex flex-col items-center gap-6"
        >
          <div className="text-rose-500 font-bold tracking-[0.3em] uppercase text-xs sm:text-sm animate-pulse border border-rose-500/30 px-6 py-2 rounded-full bg-rose-500/10">
            Limited Slots Available
          </div>
          <button 
            onClick={() => setIsRegistered(true)}
            disabled={isRegistered}
            className={`relative group overflow-hidden rounded-full p-[2px] transition-transform duration-300 ${isRegistered ? 'opacity-90 cursor-default shadow-[0_0_20px_rgba(34,197,94,0.3)]' : 'hover:scale-105 active:scale-95'}`}
          >
            {!isRegistered && <span className={`absolute inset-0 bg-gradient-to-r from-cyan-500 via-purple-500 to-blue-500 rounded-full animate-spin`} style={{ animationDuration: '3s'}}></span>}
            {isRegistered && <span className={`absolute inset-0 bg-gradient-to-r from-green-500 via-emerald-500 to-teal-500 rounded-full`}></span>}
            
            <div className={`relative bg-black px-12 py-5 rounded-full flex items-center gap-3 transition-all duration-300 ${!isRegistered && 'group-hover:bg-opacity-70'}`}>
              <span className={`font-black tracking-widest uppercase text-lg text-shadow-sm ${isRegistered ? 'text-green-400' : 'text-white'}`}>
                {isRegistered ? 'Registered' : 'Register Now'}
              </span>
              {isRegistered ? (
                 <CheckCircle2 size={22} className="text-green-400" />
              ) : (
                 <ArrowRight size={22} className="text-cyan-400 group-hover:translate-x-1.5 transition-transform duration-300" />
              )}
            </div>
          </button>
        </motion.div>
      </motion.div>
      </div>
    </div>
  );
};
