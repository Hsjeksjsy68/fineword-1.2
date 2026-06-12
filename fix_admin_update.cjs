const fs = require('fs');
let code = fs.readFileSync('firestore.rules', 'utf8');

code = code.replace(
  "isAdmin()\n                        && incoming().diff(existing()).affectedKeys().hasOnly(['isVerified', 'verificationStatus', 'deactivated'])",
  "isAdmin()"
);

code = code.replace(
  "&& incoming().diff(existing()).affectedKeys().hasOnly(['badges'])",
  "&& incoming().diff(existing()).affectedKeys().hasOnly(['badges', 'reportCount'])"
);

fs.writeFileSync('firestore.rules', code);
