import fs from 'fs';
let code = fs.readFileSync('src/App.tsx', 'utf8');

const regex = /return \(\s*<div className="flex-1 flex flex-col items-center justify-center bg-white dark:bg-black p-6 h-full relative z-\[200\]">[\s\S]*?(?=\s*};\s*const SideNav)/;

const newJSX = `return (
    <div className="flex-1 flex flex-col items-center justify-center bg-white dark:bg-black p-6 h-full relative z-[200]">
      <h1 className="text-4xl font-bold italic text-black dark:text-white mb-2 font-sans tracking-tight">FineFeed</h1>
      <p className="text-zinc-500 dark:text-zinc-500 dark:text-zinc-400 mb-8 text-center max-w-[260px] text-[14px] leading-relaxed">
        {isForgotPassword ? 'Reset your password.' : isSignUp ? 'Create an account to start sharing moments.' : 'Sign in to connect with friends and share moments instantly.'}
      </p>
      
      {errorMsg && (
        <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-xl text-center max-w-[280px]">
          {errorMsg}
        </div>
      )}
      
      {successMsg && (
        <div className="mb-4 p-4 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 text-sm rounded-xl text-center max-w-[280px]">
          {successMsg}
        </div>
      )}

      <div className="w-full max-w-[280px] flex flex-col gap-4">
        {isForgotPassword ? (
          <form onSubmit={handleForgotPassword} className="flex flex-col gap-3">
            <input
              type="text"
              placeholder="Email Address"
              value={loginInput}
              onChange={(e) => setLoginInput(e.target.value)}
              disabled={loading}
              className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 outline-none focus:border-indigo-500 dark:focus:border-indigo-500 transition-colors text-sm"
            />
            <button 
              type="submit" 
              disabled={loading} 
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-black dark:text-white font-bold py-3.5 rounded-xl text-[14px] active:scale-95 transition-all shadow-md shadow-indigo-500/20 disabled:opacity-70 disabled:scale-100 mt-1"
            >
              Send Reset Link
            </button>
            <button
              type="button"
              onClick={() => setIsForgotPassword(false)}
              disabled={loading}
              className="mt-2 text-[13px] font-bold text-zinc-500 hover:text-black dark:hover:text-white transition-colors"
            >
              Back to Login
            </button>
          </form>
        ) : (
          <form onSubmit={handleEmailAuth} className="flex flex-col gap-3">
            <input
              type="text"
              placeholder={isSignUp ? "Email Address" : "Email or Username"}
              value={loginInput}
              onChange={(e) => setLoginInput(e.target.value)}
              disabled={loading}
              className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 outline-none focus:border-indigo-500 dark:focus:border-indigo-500 transition-colors text-sm"
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 outline-none focus:border-indigo-500 dark:focus:border-indigo-500 transition-colors text-sm"
            />
            <button 
              type="submit" 
              disabled={loading} 
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-black dark:text-white font-bold py-3.5 rounded-xl text-[14px] active:scale-95 transition-all shadow-md shadow-indigo-500/20 disabled:opacity-70 disabled:scale-100 mt-1"
            >
              {isSignUp ? 'Sign Up' : 'Sign In'}
            </button>
            {!isSignUp && (
              <div className="flex justify-center mt-1">
                <button
                  type="button"
                  onClick={() => { setIsForgotPassword(true); setErrorMsg(''); setSuccessMsg(''); }}
                  disabled={loading}
                  className="text-[12px] font-bold text-indigo-500 hover:text-indigo-400 transition-colors"
                >
                  Forgot Password?
                </button>
              </div>
            )}
          </form>
        )}

        {!isForgotPassword && (
          <>
            <div className="flex items-center gap-3 my-2 opacity-50">
              <div className="h-px bg-zinc-300 dark:bg-zinc-300 dark:bg-zinc-700 flex-1"></div>
              <span className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-500">OR</span>
              <div className="h-px bg-zinc-300 dark:bg-zinc-300 dark:bg-zinc-700 flex-1"></div>
            </div>
            <button onClick={() => handleGoogleLogin(false)} disabled={loading} className="w-full bg-white text-black font-bold py-3.5 rounded-xl text-[14px] flex items-center justify-center gap-3 active:scale-95 transition-transform hover:bg-zinc-100 border border-zinc-200 disabled:opacity-70 disabled:scale-100">
              <svg width="18" height="18" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                <path fill="none" d="M0 0h48v48H0z"/>
              </svg>
              Continue with Google
            </button>
            <div className="mt-4 text-center">
              <button 
                onClick={() => { setIsSignUp(!isSignUp); setErrorMsg(''); setSuccessMsg(''); }} 
                disabled={loading}
                className="text-[13px] font-bold text-zinc-500 hover:text-black dark:hover:text-white transition-colors"
              >
                {isSignUp ? 'Already have an account? Sign In' : 'Need an account? Sign Up'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );`;

code = code.replace(regex, newJSX);
fs.writeFileSync('src/App.tsx', code);
