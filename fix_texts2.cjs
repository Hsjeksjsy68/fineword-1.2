const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

code = code.replace(/dark:text-black dark:text-white/g, 'dark:text-white');
code = code.replace(/text-black dark:text-black /g, 'text-black ');
code = code.replace(/bg-white dark:bg-white /g, 'bg-white ');

fs.writeFileSync('src/App.tsx', code);
console.log('fixed again');
