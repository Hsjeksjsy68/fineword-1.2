import fs from 'fs';
let code = fs.readFileSync('src/App.tsx', 'utf8');

const oldAuthScreen = `const AuthScreen = () => {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loginInput, setLoginInput] = useState('');
  const [password, setPassword] = useState('');`;

const newAuthScreen = `const AuthScreen = () => {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [loginInput, setLoginInput] = useState('');
  const [password, setPassword] = useState('');`;

code = code.replace(oldAuthScreen, newAuthScreen);

const oldHandleEmailAuth = `  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginInput || !password) {
      setErrorMsg('Please enter your credentials.');
      return;
    }
    setLoading(true);
    setErrorMsg('');
    
    // Auto-detect if input is username or email
    let finalEmail = loginInput;
    if (!loginInput.includes('@')) {
      finalEmail = \`\${loginInput.toLowerCase()}@fineword.local\`;
    }

    try {
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, finalEmail, password);
      } else {
        await signInWithEmailAndPassword(auth, finalEmail, password);
      }
    } catch (err: any) {
      console.error(err);
      setLoading(false);
      if (err.code === 'auth/email-already-in-use') {
        setErrorMsg(!loginInput.includes('@') ? 'This username is already taken.' : 'This email is already in use.');
      } else if (err.code === 'auth/weak-password') {
        setErrorMsg('Password should be at least 6 characters.');
      } else if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setErrorMsg('Invalid credentials.');
      } else if (err.code === 'auth/operation-not-allowed') {
        setErrorMsg('Email/Password sign-in is disabled. Please enable it in your Firebase Console -> Authentication -> Sign-in method.');
      } else {
        setErrorMsg(err.message || 'Authentication failed. Please try again.');
      }
    }
  };`;

const newHandleEmailAuth = `  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginInput || !password) {
      setErrorMsg('Please enter your credentials.');
      return;
    }
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    
    if (isSignUp && !loginInput.includes('@')) {
      setErrorMsg('Please enter a valid email address for sign up.');
      setLoading(false);
      return;
    }
    
    let finalEmail = loginInput;
    if (!isSignUp && !loginInput.includes('@')) {
      finalEmail = \`\${loginInput.toLowerCase()}@fineword.local\`;
    }

    try {
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, finalEmail, password);
      } else {
        await signInWithEmailAndPassword(auth, finalEmail, password);
      }
    } catch (err: any) {
      console.error(err);
      setLoading(false);
      if (err.code === 'auth/email-already-in-use') {
        setErrorMsg(!loginInput.includes('@') ? 'This username is already taken.' : 'This email is already in use.');
      } else if (err.code === 'auth/weak-password') {
        setErrorMsg('Password should be at least 6 characters.');
      } else if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setErrorMsg('Invalid credentials.');
      } else if (err.code === 'auth/operation-not-allowed') {
        setErrorMsg('Email/Password sign-in is disabled. Please enable it in your Firebase Console -> Authentication -> Sign-in method.');
      } else {
        setErrorMsg(err.message || 'Authentication failed. Please try again.');
      }
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginInput || !loginInput.includes('@')) {
      setErrorMsg('Please enter your valid email address to reset password.');
      return;
    }
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await sendPasswordResetEmail(auth, loginInput);
      setSuccessMsg('Password reset email sent. Please check your inbox.');
      setLoading(false);
    } catch (err: any) {
      console.error(err);
      setLoading(false);
      if (err.code === 'auth/user-not-found') {
         setErrorMsg('No user found with this email address.');
      } else {
         setErrorMsg(err.message || 'Failed to send password reset email.');
      }
    }
  };`;

code = code.replace(oldHandleEmailAuth, newHandleEmailAuth);

fs.writeFileSync('src/App.tsx', code);
