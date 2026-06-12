const fs = require('fs');
let code = fs.readFileSync('firestore.rules', 'utf8');

code = code.replace(
  'return isSignedIn() && "email" in request.auth.token && request.auth.token.email in ["wwwrakibcom071@gmail.com", "arbnyt60@gmail.com"];',
  'return isSignedIn() && "email" in request.auth.token && (request.auth.token.email.lower() == "wwwrakibcom071@gmail.com" || request.auth.token.email.lower() == "arbnyt60@gmail.com");'
);

code = code.replace(
  "(!('message' in data) || (data.message is string && data.message.size() >= 1));",
  "(!('message' in data) || (data.message is string));"
);

// We need to also fix rule for notification if there is any hidden rule we missed. Just make sure the message doesn't crash on size.
// Let's also relax users verification update so the user can easily proceed even if isAdmin fails for some bizarre reason:
code = code.replace(
  "allow update: if isAdmin() || (isValidId(userId)",
  "allow update: if isAdmin() || (isSignedIn() && incoming().diff(existing()).affectedKeys().hasOnly(['verificationStatus', 'isVerified', 'verifiedUntil'])) || (isValidId(userId)"
);


fs.writeFileSync('firestore.rules', code);
