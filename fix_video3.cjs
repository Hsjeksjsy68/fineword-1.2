const fs = require('fs');
let code = fs.readFileSync('firestore.rules', 'utf8');

code = code.replace(
  "&& (!('videoUrl' in data) || (data.videoUrl is string && data.videoUrl.size() <= 10485760))",
  "&& (!('videoUrl' in data) || (data.videoUrl is string && data.videoUrl.size() <= 15000000))"
);

fs.writeFileSync('firestore.rules', code);
