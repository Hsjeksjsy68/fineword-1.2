const fs = require('fs');
let rules = fs.readFileSync('firestore.rules', 'utf-8');
const newRule = `
    match /calls/{callId} {
      allow read: if isSignedIn();
      allow write: if isSignedIn();
    }
`;
if (!rules.includes('match /calls')) {
    rules = rules.replace("match /reports/{reportId} {", newRule + "\n    match /reports/{reportId} {");
    fs.writeFileSync('firestore.rules', rules);
    console.log('patched');
}
