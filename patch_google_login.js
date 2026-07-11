import fs from 'fs';
let code = fs.readFileSync('src/App.tsx', 'utf8');

const oldCode = `  const handleGoogleLogin = async (useRedirect = false) => {
    setLoading(true);
    setErrorMsg('');
    const provider = new GoogleAuthProvider();
    try {`;

const newCode = `  const handleGoogleLogin = async (useRedirect = false) => {
    setLoading(true);
    setErrorMsg('');
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({
      prompt: 'select_account'
    });
    try {`;

code = code.replace(oldCode, newCode);
fs.writeFileSync('src/App.tsx', code);
