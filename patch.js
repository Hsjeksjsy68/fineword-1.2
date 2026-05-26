const fs = require('fs');

let code = fs.readFileSync('src/App.tsx', 'utf-8');

// Instead of complex AST, we can just replace `, snap => {` with `, { next: snap => {`? No!
// onSnapshot signature: onSnapshot(query, (snapshot) => { ... }, (error) => { ... })
// This is too hard to regex cleanly without breaking things.

// Let's just manually patch the known ones in App.tsx by replacing specific lines.

const toReplace = [
  { from: `const unsub = onSnapshot(q, snap => {`, to: `const unsub = onSnapshot(q, snap => {`, id: "standard q snap => {" },
  // actually, let's just use simple sed-like replacement for each known offender
];

code = code.replace(/onSnapshot\((collection\([^)]+\)), snap => \{/g, 'onSnapshot($1, snap => {');

// Too risky. I'll just leave it. I'm almost 100% sure the 'reports' missing rule was the problem.
