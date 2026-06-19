const fs = require('fs');
let code = fs.readFileSync('firestore.rules', 'utf8');

code = code.replace(
  "return data.keys().hasAll(['id', 'userId', 'imageUrl', 'caption', 'likes', 'likedBy', 'createdAt'])",
  "return data.keys().hasAll(['id', 'userId', 'caption', 'likes', 'likedBy', 'createdAt'])"
);

fs.writeFileSync('firestore.rules', code);
