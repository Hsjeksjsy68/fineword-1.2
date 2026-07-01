import React from 'react';
import { motion } from 'motion/react';

export const DecorativeLoader = () => {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 relative min-h-[300px]">
      <div className="relative flex items-center justify-center w-32 h-32">
        {/* Outer glowing ring */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
          className="absolute inset-0 border-[2px] border-transparent border-t-indigo-500 border-r-purple-500 rounded-full blur-[2px] opacity-70"
        />
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
          className="absolute inset-0 border-[2px] border-transparent border-t-indigo-500 border-r-purple-500 rounded-full"
        />
        
        {/* Middle pulsing ring */}
        <motion.div
          animate={{ rotate: -360, scale: [0.9, 1.1, 0.9] }}
          transition={{ rotate: { duration: 5, repeat: Infinity, ease: "linear" }, scale: { duration: 2, repeat: Infinity, ease: "easeInOut" } }}
          className="absolute inset-4 border-[2px] border-transparent border-b-rose-500 border-l-orange-400 rounded-full opacity-80"
        />

        {/* Inner solid orbit */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          className="absolute inset-8 rounded-full border border-zinc-200 dark:border-zinc-800"
        >
          <motion.div 
            className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.8)]"
          />
        </motion.div>

        {/* Center glowing core */}
        <motion.div
          animate={{ scale: [0.7, 1, 0.7], opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          className="w-6 h-6 rounded-full bg-gradient-to-tr from-indigo-500 via-purple-500 to-rose-500 blur-sm absolute"
        />
        <motion.div
          animate={{ scale: [0.8, 1.2, 0.8] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          className="w-4 h-4 rounded-full bg-white dark:bg-black shadow-[0_0_15px_rgba(255,255,255,0.8)] absolute z-10"
        />
      </div>
      
      <motion.div 
        animate={{ opacity: [0.3, 1, 0.3] }}
        transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
        className="mt-8 flex flex-col items-center gap-2"
      >
        <span className="text-xs font-black tracking-[0.3em] bg-gradient-to-r from-indigo-500 via-purple-500 to-rose-500 bg-clip-text text-transparent uppercase">
          Synthesizing
        </span>
        <div className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              animate={{ y: [0, -4, 0] }}
              transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
              className="w-1 h-1 rounded-full bg-zinc-400 dark:bg-zinc-500"
            />
          ))}
        </div>
      </motion.div>
    </div>
  );
};
