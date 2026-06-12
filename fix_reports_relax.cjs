const fs = require('fs');
let code = fs.readFileSync('firestore.rules', 'utf8');

code = code.replace(
  "allow update: if isAdmin();\n      allow delete: if isAdmin();",
  "allow update: if isAdmin() || (isSignedIn() && incoming().diff(existing()).affectedKeys().hasOnly(['status']));\n      allow delete: if isAdmin();"
);

fs.writeFileSync('firestore.rules', code);
