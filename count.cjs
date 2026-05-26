const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

const matches = code.match(/className="([^"]+)"/g) || [];
let classes = [];
matches.forEach(m => {
  const inner = m.substring(11, m.length - 1);
  classes.push(...inner.split(/\s+/));
});

const counter = {};
classes.forEach(c => {
  if (c.startsWith('dark:text-') || c.startsWith('dark:bg-') || c.startsWith('text-') || c.startsWith('bg-')) {
    counter[c] = (counter[c] || 0) + 1;
  }
});
const sorted = Object.entries(counter).sort((a,b) => b[1] - a[1]);
console.log(sorted.slice(0, 30).map(x => `${x[0]}: ${x[1]}`).join('\n'));
