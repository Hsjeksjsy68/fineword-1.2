const fs = require('fs');
let code = fs.readFileSync('firestore.rules', 'utf8');

code = code.replace(
  "&& incoming().keys().hasAll(['id', 'reporterId', 'targetId', 'type', 'reason', 'status', 'createdAt'])\n                    && incoming().id == reportId\n                    && incoming().reporterId == request.auth.uid\n                    && incoming().createdAt == request.time;",
  "&& incoming().keys().hasAll(['id', 'reporterId', 'reportedUserId', 'reason', 'createdAt'])\n                    && incoming().id == reportId\n                    && incoming().reporterId == request.auth.uid\n                    && incoming().createdAt == request.time;"
);

// We need to also patch the initial creation that might lack 'status'
// Wait, 'reports' rule for admins is broad.
fs.writeFileSync('firestore.rules', code);
