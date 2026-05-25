const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

// Cleanup corrupted texts
code = code.replace(/text-black dark:text-black dark:text-black dark:text-white/g, 'text-black dark:text-white');
code = code.replace(/text-black dark:text-black dark:text-white/g, 'text-black dark:text-white');
code = code.replace(/text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-400/g, 'text-zinc-500 dark:text-zinc-400');
code = code.replace(/text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-400/g, 'text-zinc-500 dark:text-zinc-400');
code = code.replace(/text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 text-black/g, 'text-black');
code = code.replace(/dark:bg-zinc-100 dark:bg-zinc-100 dark:bg-zinc-900/g, 'dark:bg-zinc-900');
code = code.replace(/dark:bg-zinc-200 dark:bg-zinc-200 dark:bg-zinc-800/g, 'dark:bg-zinc-800');
code = code.replace(/dark:bg-zinc-200 dark:bg-zinc-200 dark:bg-zinc-200 dark:bg-zinc-800/g, 'dark:bg-zinc-800');
code = code.replace(/dark:border-zinc-200 dark:border-zinc-200 dark:border-zinc-200 dark:border-zinc-800/g, 'dark:border-zinc-800');
code = code.replace(/dark:border-zinc-200 dark:border-zinc-200 dark:border-zinc-800/g, 'dark:border-zinc-800');
code = code.replace(/dark:text-zinc-900 dark:text-zinc-900 dark:text-zinc-100/g, 'dark:text-zinc-100');
code = code.replace(/dark:text-zinc-700 dark:text-zinc-700 dark:text-zinc-300/g, 'dark:text-zinc-300');
code = code.replace(/dark:text-zinc-500 dark:text-zinc-500/g, 'dark:text-zinc-500');

fs.writeFileSync('src/App.tsx', code);
console.log('fixed');
