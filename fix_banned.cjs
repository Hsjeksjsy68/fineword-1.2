const fs = require('fs');
let code = fs.readFileSync('firestore.rules', 'utf8');

code = code.replace(
  "allow update: if isAdmin() || (isSignedIn() && incoming().diff(existing()).affectedKeys().hasOnly(['verificationStatus', 'isVerified', 'verifiedUntil'])) || (isValidId(userId)",
  "allow update: if isAdmin() || (isSignedIn() && incoming().diff(existing()).affectedKeys().hasOnly(['verificationStatus', 'isVerified', 'verifiedUntil'])) || (isSignedIn() && incoming().diff(existing()).affectedKeys().hasOnly(['bannedUntil'])) || (isSignedIn() && incoming().diff(existing()).affectedKeys().hasOnly(['deactivated'])) || (isSignedIn() && incoming().diff(existing()).affectedKeys().hasOnly(['isVerified', 'verificationStatus', 'verifiedUntil', 'deactivated'])) || (isValidId(userId)"
);
fs.writeFileSync('firestore.rules', code);
