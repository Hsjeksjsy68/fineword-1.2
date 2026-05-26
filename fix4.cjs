const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

const replacements = [
  [/dark:hover:bg-zinc-200 dark:bg-zinc-200 dark:bg-zinc-800/g, 'dark:hover:bg-zinc-800'],
  [/dark:hover:bg-zinc-200 dark:bg-zinc-800/g, 'dark:hover:bg-zinc-800'],
  [/dark:disabled:bg-zinc-200 dark:bg-zinc-200 dark:bg-zinc-800/g, 'dark:disabled:bg-zinc-800'],
  [/dark:bg-zinc-200 dark:bg-zinc-800/g, 'dark:bg-zinc-800'],
  [/dark:text-zinc-800 dark:text-zinc-200/g, 'dark:text-zinc-200'],
  [/dark:hover:text-black dark:text-white/g, 'dark:hover:text-white'],
  [/hover:text-black dark:hover:text-black/g, 'hover:text-black'],
  [/dark:text-zinc-500 dark:text-zinc-400 dark:text-zinc-600/g, 'dark:text-zinc-400'],
];

replacements.forEach(([regex, repl]) => {
  code = code.replace(regex, repl);
});

// also fix some stragglers like 'hover:bg-zinc-50 dark:hover:bg-zinc-200 dark:bg-zinc-800'
code = code.replace(/hover:bg-zinc-50 dark:hover:bg-zinc-200 dark:bg-zinc-800/g, 'hover:bg-zinc-50 dark:hover:bg-zinc-800');
code = code.replace(/hover:bg-zinc-100 dark:hover:bg-zinc-200 dark:bg-zinc-800/g, 'hover:bg-zinc-100 dark:hover:bg-zinc-800');

fs.writeFileSync('src/App.tsx', code);
console.log('replaced');
