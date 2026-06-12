const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');
code = code.replace(/isDeactivated/g, 'deactivated');
fs.writeFileSync('src/App.tsx', code);

let rules = fs.readFileSync('firestore.rules', 'utf8');
// remove the extra isDeactivated lines we added
rules = rules.replace(/&& \(!\('isDeactivated' in data\) \|\| data\.isDeactivated is bool\)\n\s+/g, '');
rules = rules.replace(/, 'isDeactivated'/g, '');
fs.writeFileSync('firestore.rules', rules);
