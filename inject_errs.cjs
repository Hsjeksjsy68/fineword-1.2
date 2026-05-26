const fs = require('fs');

let code = fs.readFileSync('src/App.tsx', 'utf-8');

// Replace standard onSnapshot calls with ones that catch errors
code = code.replace(
  /onSnapshot\(([^,]+),\s*(?:snap|\(snap\))\s*=>\s*\{/g,
  (match, p1) => `onSnapshot(${p1}, snap => {`
);

// Actually, regex to inject the error handler is:
// Find `});` that ends an onSnapshot and replace it. That's too hard to parse.
// Let's just write a custom parser...
// Or we can just use `sed` / `awk`.
// Or just let's manually write a script.
