const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

code = code.replace(/text-zinc-800 dark:text-zinc-200 group-hover:text-black dark:group-hover:text-white dark:text-white/g, 'text-zinc-800 dark:text-zinc-200 group-hover:text-black dark:group-hover:text-white');

fs.writeFileSync('src/App.tsx', code);
console.log('fixed sidenav text colors');
