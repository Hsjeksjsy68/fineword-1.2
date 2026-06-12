import React from 'react';
import { motion } from 'framer-motion';

export const DecorativeLoader = () => {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 bg-zinc-50 dark:bg-black/20 mix-blend-luminosity relative min-h-[300px]">
      <div className="relative flex items-center justify-center w-24 h-24">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
          className="absolute inset-0 border-[3px] border-transparent border-t-indigo-500/80 border-r-indigo-500/30 rounded-full"
        />
        <motion.div
          animate={{ rotate: -360 }}
          transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
          className="absolute inset-2 border-[3px] border-transparent border-t-rose-500/80 border-l-rose-500/30 rounded-full"
        />
        <motion.div
          animate={{ scale: [0.8, 1.2, 0.8], opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          className="w-4 h-4 rounded-full bg-gradient-to-tr from-indigo-500 to-rose-500 shadow-[0_0_15px_rgba(99,102,241,0.6)]"
        />
      </div>
      <motion.span 
        animate={{ opacity: [0.4, 1, 0.4] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        className="mt-6 text-sm font-bold tracking-[0.2em] text-zinc-400 dark:text-zinc-500 uppercase"
      >
        Loading
      </motion.span>
    </div>
  );
};
