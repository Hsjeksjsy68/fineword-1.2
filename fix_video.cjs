const fs = require('fs');
let code = fs.readFileSync('firestore.rules', 'utf8');

code = code.replace(
  "&& data.keys().hasAll(['id', 'userId', 'imageUrl', 'caption', 'likes', 'likedBy', 'createdAt'])",
  "&& data.keys().hasAll(['id', 'userId', 'caption', 'likes', 'likedBy', 'createdAt'])"
);

code = code.replace(
  "        && data.imageUrl is string\n        && data.imageUrl.size() <= 10485760",
  "        && (!('imageUrl' in data) || (data.imageUrl is string && data.imageUrl.size() <= 10485760))\n        && (!('videoUrl' in data) || (data.videoUrl is string && data.videoUrl.size() <= 10485760))"
);

code = code.replace(
  "&& incoming().imageUrl == existing().imageUrl",
  "&& (!('imageUrl' in incoming()) || incoming().imageUrl == existing().imageUrl) && (!('videoUrl' in incoming()) || incoming().videoUrl == existing().videoUrl)"
);

fs.writeFileSync('firestore.rules', code);
