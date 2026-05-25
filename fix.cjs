const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');
code = code.replace(/bg-white dark:bg-white dark:bg-transparent/g, 'bg-white dark:bg-black');
// also fix bg-transparent
// Wait, I had: code.replace(/bg-white dark:bg-black flex justify-around/g, 'bg-transparent flex justify-around');
// Did that run?
code = code.replace(/bg-transparent flex justify-around/g, 'bg-white dark:bg-black flex justify-around');

code = code.replace(/bg-transparent relative z-40"/g, 'bg-white dark:bg-black relative z-40"');

fs.writeFileSync('src/App.tsx', code);
console.log('reverted');
