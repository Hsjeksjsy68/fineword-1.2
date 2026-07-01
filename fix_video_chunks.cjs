const fs = require('fs');
let code = fs.readFileSync('firestore.rules', 'utf8');
const chunksRule = `
    match /video_chunks/{chunkId} {
      allow read: if true;
      allow create: if isSignedIn();
      allow delete: if isSignedIn();
    }
`;
code = code.replace("match /contests/{contestId} {", chunksRule + "\n    match /contests/{contestId} {");
fs.writeFileSync('firestore.rules', code);
