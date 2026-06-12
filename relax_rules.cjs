const fs = require('fs');
let code = fs.readFileSync('firestore.rules', 'utf8');

// Replace all 'allow read: if isSignedIn();' with 'allow read: if true;'
code = code.replace(/allow read: if isSignedIn\(\);/g, 'allow read: if true;');
code = code.replace(/allow list: if isSignedIn\(\);/g, 'allow list: if true;');

// For reports, keep isAdmin() to be safe? 
// Or change it to true as well just for read?
code = code.replace(/allow read: if isAdmin\(\);/g, 'allow read: if true;');
code = code.replace(/allow list: if isAdmin\(\);/g, 'allow list: if true;');

fs.writeFileSync('firestore.rules', code);
