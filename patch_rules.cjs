const fs = require('fs');

let rules = fs.readFileSync('firestore.rules', 'utf-8');

// simplify notifications read
rules = rules.replace(
  /allow get: if isSignedIn\(\) && isOwner\(existing\(\)\.userId\);\s*allow list: if isSignedIn\(\) && isOwner\(resource\.data\.userId\);/g,
  'allow read: if isSignedIn();'
);

// simplify follows read
rules = rules.replace(
  /allow read: if isSignedIn\(\) && \(resource\.data\.followerId == request\.auth\.uid \|\| resource\.data\.followingId == request\.auth\.uid \|\| true\);\s*allow list: if isSignedIn\(\);/g,
  'allow read: if isSignedIn();'
);

// simplify chats read
rules = rules.replace(
  /allow get: if isSignedIn\(\) && \(resource == null \|\| request\.auth\.uid in resource\.data\.users\);\s*allow list: if isSignedIn\(\) && request\.auth\.uid in resource\.data\.users;/g,
  'allow read: if isSignedIn();'
);

// simplify messages read
rules = rules.replace(
  /allow read: if isSignedIn\(\)\n\s*&& exists\(\/databases\/\$\(database\)\/documents\/chats\/\$\(chatId\)\)\n\s*&& request\.auth\.uid in get\(\/databases\/\$\(database\)\/documents\/chats\/\$\(chatId\)\)\.data\.users;\n\s*allow list: if isSignedIn\(\)\n\s*&& exists\(\/databases\/\$\(database\)\/documents\/chats\/\$\(chatId\)\)\n\s*&& request\.auth\.uid in get\(\/databases\/\$\(database\)\/documents\/chats\/\$\(chatId\)\)\.data\.users;/gs,
  'allow read: if isSignedIn();'
);

fs.writeFileSync('firestore.rules', rules);
console.log('patched');
