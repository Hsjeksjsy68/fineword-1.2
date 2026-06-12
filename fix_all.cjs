const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

// Replace everything that doesn't already have an error handler.
code = code.replace(/onSnapshot\(([^,]+),\s*(\(?snap[^=]*=>\s*\{[\s\S]*?\})\s*\)/g, (match, q, fn) => {
  return `onSnapshot(${q}, ${fn}, e => console.error("Snapshot error on " + String(${q}?.type || ${q}), e.message))`;
});

// Since regex can be tricky with nested closures, let's just use the previous script strategy but carefully.
// Actually, simple regex might stop at first } which is BAD. The first `}` might be inside the function.
// So let me just write it in node logic.
let lines = code.split('\n');
let newLines = [];
let insideOnSnapshot = false;
let onSnapshotStartLine = -1;
let openBraces = 0;

for (let i = 0; i < lines.length; i++) {
  let line = lines[i];
  if (line.includes('onSnapshot(') && !line.includes('e => console.error(') && !line.includes('error => console.error(')) {
     // Check if we can just append at the VERY end where we find `});` or `})` that balances it!
  }
}
