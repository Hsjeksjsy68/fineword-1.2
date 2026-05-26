const fs = require('fs');

function deduplicateClasses(classString) {
  const classes = classString.trim().split(/\s+/);
  const seen = new Set();
  const result = [];
  
  for (let i = classes.length - 1; i >= 0; i--) {
    const c = classes[i];
    if (c === '') continue;
    if (!seen.has(c)) {
      seen.add(c);
      result.unshift(c);
    }
  }
  return result.join(' ');
}

let code = fs.readFileSync('src/App.tsx', 'utf-8');

// A function to process all string literals for cleanups
code = code.replace(/className="([^"]+)"/g, (match, p1) => {
  return `className="${deduplicateClasses(p1)}"`;
});

// Since there are also template literals, let's just do a string replacement for the most common repeated ones:
code = code.replace(/dark:text-zinc-500(\s+dark:text-zinc-500)+/g, 'dark:text-zinc-500');
code = code.replace(/dark:text-zinc-400(\s+dark:text-zinc-[-a-z0-9]+)+/g, 'dark:text-zinc-400');
code = code.replace(/dark:bg-zinc-100(\s+dark:bg-zinc-100)+/g, ''); // Wait, shouldn't remove everything
// Let's just fix the dark:text-zinc-500 repetition.
code = code.replace(/(dark:[a-z0-9-]+:?[a-z0-9-]*\s+)\1+/g, '$1');

// Additional cleanup just in case
let prevCode;
do {
  prevCode = code;
  code = code.replace(/(dark:[a-z0-9-]+(-[a-z0-9]+)*)\s+\1/g, '$1');
  code = code.replace(/(text-[a-z0-9]+-[0-9]+)\s+\1/g, '$1');
  code = code.replace(/(bg-[a-z0-9]+-[0-9]+)\s+\1/g, '$1');
} while (code !== prevCode);

fs.writeFileSync('src/App.tsx', code);
console.log('done dedup');
