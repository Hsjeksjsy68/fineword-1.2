const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

const replacements = [
  [/dark:hover:bg-zinc-100 dark:bg-zinc-100 dark:bg-zinc-900/g, 'dark:hover:bg-zinc-900'],
  [/dark:bg-zinc-100 dark:bg-zinc-900/g, 'dark:bg-zinc-900'],
  [/dark:active:bg-zinc-100 dark:bg-zinc-100 dark:bg-zinc-900/g, 'dark:active:bg-zinc-900'],
  [/dark:hover:bg-zinc-100 dark:bg-zinc-100/g, 'dark:hover:bg-zinc-900'],
  [/dark:hover:bg-zinc-100 dark:bg-zinc-900\/50/g, 'dark:hover:bg-zinc-900/50'],
  [/dark:hover:bg-zinc-100/g, 'dark:hover:bg-zinc-800'],
  [/dark:active:bg-zinc-100/g, 'dark:active:bg-zinc-800'],
];

replacements.forEach(([regex, repl]) => {
  code = code.replace(regex, repl);
});

fs.writeFileSync('src/App.tsx', code);
console.log('replaced 100s');
