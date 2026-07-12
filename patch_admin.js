import fs from 'fs';

let code = fs.readFileSync('src/App.tsx', 'utf8');

const regex = /const AdminDashboardScreen = \(\) => \{[\s\S]*?\n\};\n\nconst UserProfileScreen/;

const newCode = `const AdminDashboardScreen = () => {
  const { posts, showToast, showConfirm } = useApp();
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [tab, setTab] = useState<'overview' | 'verifications' | 'verified' | 'reports' | 'users'>('overview');

  const isAdmin = ['wwwrakibcom071@gmail.com', 'arbnyt60@gmail.com'].includes(auth.currentUser?.email || '');

  useEffect(() => {
    if (!isAdmin) {
      navigate('/');
      return;
    }
    const unsubUsers = onSnapshot(collection(db, 'users'), snap => {
      const u: User[] = [];
      snap.forEach(d => u.push(d.data() as User));
      setUsers(u);
    }, e => console.error("Admin Users error:", e));
    
    const unsubReports = onSnapshot(collection(db, 'reports'), snap => {
      const r: Report[] = [];
      snap.forEach(d => r.push({ ...d.data(), id: d.id, createdAt: d.data().createdAt?.toDate?.() || new Date() } as Report));
      setReports(r.sort((a,b) => b.createdAt.getTime() - a.createdAt.getTime()));
    }, e => console.error("Admin Reports error:", e));
    
    return () => { unsubUsers(); unsubReports(); };
  }, [isAdmin, navigate]);

  const handleAction = async (userId: string, action: 'accepted' | 'rejected') => {
    try {
      const updates: any = {
        verificationStatus: action,
        isVerified: action === 'accepted'
      };
      
      if (action === 'accepted') {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30); // 30 days
        updates.verifiedUntil = expiresAt;
      } else {
        updates.verifiedUntil = null;
      }
      
      await updateDoc(doc(db, 'users', userId), updates);
      
      if (action === 'rejected') {
        const notifId = \`sys_\${Date.now()}_\${Math.floor(Math.random() * 1000000)}\`;
        await setDoc(doc(db, 'notifications', notifId), {
          id: notifId,
          userId: userId,
          actorId: auth.currentUser?.uid || 'system',
          type: 'system',
          message: 'Your verification request was not accepted. Please review your submitted details and try again.',
          createdAt: serverTimestamp(),
          read: false
        });
      }
      
      showToast(\`Request \${action} successfully\`);
    } catch (error) {
      console.error("Action error:", error);
      showToast("Action failed");
    }
  };

  const handleDeleteUser = async (userId: string) => {
    showConfirm("Delete this user permanently? This cannot be undone.", async () => {
      try {
        await deleteDoc(doc(db, 'users', userId));
        showToast("User deleted");
      } catch (e) {
        console.error(e);
        showToast("Delete failed");
      }
    });
  };

  const handleRemoveVerified = async (userId: string) => {
    showConfirm("Revoke verified status?", async () => {
       try {
         await updateDoc(doc(db, 'users', userId), {
           isVerified: false,
           verificationStatus: 'idle',
           verifiedUntil: null
         });
         showToast("Status revoked");
       } catch(e) {
         console.error(e);
         showToast("Failed");
       }
    });
  };

  const handleResolveReport = async (reportId: string) => {
    try {
      await updateDoc(doc(db, 'reports', reportId), {
        status: 'resolved'
      });
      showToast("Report marked as resolved");
    } catch(e) {
      console.error(e);
      showToast("Failed to resolve");
    }
  };

  const handleBanUser = async (userId: string, permanent: boolean) => {
    showConfirm(\`Ban user \${permanent ? 'permanently' : 'for 7 days'}?\`, async () => {
       try {
         const updates: any = { isVerified: false, verificationStatus: 'idle' };
         if (permanent) {
            updates.bannedUntil = new Date(2100, 1, 1);
         } else {
            const until = new Date();
            until.setDate(until.getDate() + 7);
            updates.bannedUntil = until;
         }
         await updateDoc(doc(db, 'users', userId), updates);
         showToast("User banned");
       } catch (e) {
         console.error(e);
         showToast("Failed to ban user");
       }
    });
  };

  const pendingRequests = users.filter(u => u.verificationStatus === 'pending');
  const verifiedUsers = users.filter(u => u.isVerified);
  const pendingReports = reports.filter(r => r.status === 'pending');

  if (!isAdmin) return null;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 flex min-h-0 bg-zinc-50 dark:bg-zinc-950 absolute inset-0 z-50">
      {/* Admin Sidebar */}
      <div className="w-[280px] bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 flex flex-col h-full">
        <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-500 rounded-xl flex items-center justify-center text-white font-bold text-xl"><Trophy size={20} /></div>
          <div>
            <h1 className="font-bold text-[16px] text-zinc-900 dark:text-zinc-100">Admin Panel</h1>
            <p className="text-[12px] text-zinc-500">FineWord System</p>
          </div>
        </div>
        <div className="flex-1 py-4 px-3 flex flex-col gap-1 overflow-y-auto">
          {(['overview', 'verifications', 'verified', 'reports', 'users'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn("w-full text-left px-4 py-3 rounded-xl text-[14px] font-semibold transition-all flex items-center justify-between", tab === t ? "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400" : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/50")}
            >
              <span className="capitalize">{t}</span>
              {t === 'verifications' && pendingRequests.length > 0 && <span className="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full">{pendingRequests.length}</span>}
              {t === 'reports' && pendingReports.length > 0 && <span className="bg-amber-500 text-white text-[10px] px-2 py-0.5 rounded-full">{pendingReports.length}</span>}
            </button>
          ))}
        </div>
        <div className="p-4 border-t border-zinc-200 dark:border-zinc-800">
           <button onClick={() => navigate('/')} className="w-full flex items-center gap-2 justify-center px-4 py-3 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-100 rounded-xl font-bold transition-colors">
              <ChevronLeft size={18} /> Back to App
           </button>
        </div>
      </div>

      {/* Admin Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <header className="h-[72px] shrink-0 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-center px-8">
           <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 capitalize">{tab}</h2>
        </header>

        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-5xl mx-auto">
            {tab === 'overview' && (
              <div className="flex flex-col gap-8">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col gap-2">
                    <p className="text-sm font-semibold text-zinc-500 uppercase tracking-wider">Total Users</p>
                    <p className="text-4xl font-black text-indigo-600 dark:text-indigo-400">{users.length}</p>
                  </div>
                  <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col gap-2">
                    <p className="text-sm font-semibold text-zinc-500 uppercase tracking-wider">Total Posts</p>
                    <p className="text-4xl font-black text-emerald-600 dark:text-emerald-400">{posts.length}</p>
                  </div>
                  <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col gap-2">
                    <p className="text-sm font-semibold text-zinc-500 uppercase tracking-wider">Pending Verifications</p>
                    <p className="text-4xl font-black text-rose-600 dark:text-rose-400">{pendingRequests.length}</p>
                  </div>
                  <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col gap-2">
                    <p className="text-sm font-semibold text-zinc-500 uppercase tracking-wider">Pending Reports</p>
                    <p className="text-4xl font-black text-amber-600 dark:text-amber-400">{pendingReports.length}</p>
                  </div>
                </div>
              </div>
            )}

            {tab === 'verifications' && (
              <div className="flex flex-col gap-4">
                {pendingRequests.map(user => (
                  <div key={user.id} className="p-6 border border-zinc-200 dark:border-zinc-800 rounded-2xl flex flex-col gap-6 bg-white dark:bg-zinc-900 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <img src={user.avatar || undefined} className="w-14 h-14 rounded-full bg-zinc-200 dark:bg-zinc-800 object-cover border border-zinc-100 dark:border-zinc-800" />
                        <div className="flex flex-col">
                          <span className="font-bold text-zinc-900 dark:text-zinc-100 text-lg">{user.name}</span>
                          <span className="text-zinc-500 dark:text-zinc-500 text-sm font-medium">@{user.username}</span>
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <button onClick={() => handleAction(user.id, 'accepted')} className="bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-sm">Approve Request</button>
                        <button onClick={() => handleAction(user.id, 'rejected')} className="bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 dark:text-rose-400 px-5 py-2.5 rounded-xl text-sm font-bold transition-all">Reject</button>
                      </div>
                    </div>
                    
                    {user.verificationData && (
                      <div className="bg-zinc-50 dark:bg-zinc-950 rounded-xl p-5 border border-zinc-100 dark:border-zinc-800 grid grid-cols-2 md:grid-cols-4 gap-6">
                        <div><span className="text-zinc-400 block text-[10px] uppercase tracking-wider font-bold mb-1">Full Name</span> <span className="dark:text-zinc-200 font-medium text-sm">{user.verificationData.fullName}</span></div>
                        <div><span className="text-zinc-400 block text-[10px] uppercase tracking-wider font-bold mb-1">Phone</span> <span className="dark:text-zinc-200 font-medium text-sm">{user.verificationData.phoneNumber}</span></div>
                        <div className="col-span-2"><span className="text-zinc-400 block text-[10px] uppercase tracking-wider font-bold mb-1">Address</span> <span className="dark:text-zinc-200 font-medium text-sm">{user.verificationData.address}</span></div>
                        <div><span className="text-zinc-400 block text-[10px] uppercase tracking-wider font-bold mb-1">NID / BID</span> <span className="dark:text-zinc-200 font-medium text-sm">{user.verificationData.nidBid}</span></div>
                        <div><span className="text-zinc-400 block text-[10px] uppercase tracking-wider font-bold mb-1">DOB</span> <span className="dark:text-zinc-200 font-medium text-sm">{user.verificationData.birthDate}</span></div>
                        <div><span className="text-amber-500 block text-[10px] uppercase tracking-wider font-bold mb-1">Nagad Number</span> <span className="dark:text-zinc-200 font-mono text-sm">{user.verificationData.nagadNumber}</span></div>
                        <div><span className="text-amber-500 block text-[10px] uppercase tracking-wider font-bold mb-1">TrxID</span> <span className="dark:text-zinc-200 font-mono text-sm">{user.verificationData.transactionId}</span></div>
                      </div>
                    )}
                  </div>
                ))}
                {pendingRequests.length === 0 && (
                  <div className="text-center py-20 text-zinc-400 dark:text-zinc-600 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl font-medium text-lg">
                    No pending requests in the queue
                  </div>
                )}
              </div>
            )}

            {tab === 'verified' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                 {verifiedUsers.map(user => (
                   <div key={user.id} className="p-5 border border-zinc-200 dark:border-zinc-800 rounded-2xl flex items-center justify-between bg-white dark:bg-zinc-900 shadow-sm">
                     <div className="flex items-center gap-4">
                       <img src={user.avatar || undefined} className="w-12 h-12 rounded-full bg-zinc-200 dark:bg-zinc-800 object-cover" />
                       <div className="flex flex-col">
                         <span className="font-bold text-zinc-900 dark:text-zinc-100 text-[15px] flex items-center gap-1.5">
                           {user.name} <VerifiedBadge isVerified={true} />
                         </span>
                         <span className="text-zinc-500 text-[13px] font-medium">@{user.username}</span>
                       </div>
                     </div>
                     <div className="flex items-center gap-4">
                       <div className="text-right flex flex-col text-[12px] font-semibold text-zinc-400">
                         {user.verifiedUntil && (
                           <span className="text-amber-600 dark:text-amber-400">
                             Expires: {user.verifiedUntil?.toDate?.() ? user.verifiedUntil.toDate().toLocaleDateString() : (user.verifiedUntil as Date).toLocaleDateString()}
                           </span>
                         )}
                       </div>
                       <button onClick={() => handleRemoveVerified(user.id)} className="px-4 py-2 text-sm font-bold text-rose-600 bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-100 dark:hover:bg-rose-500/20 rounded-xl transition-all">Revoke</button>
                     </div>
                   </div>
                 ))}
                 {verifiedUsers.length === 0 && (
                   <div className="col-span-full text-center py-20 text-zinc-400 dark:text-zinc-600 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl font-medium text-lg">
                     No verified users found
                   </div>
                 )}
              </div>
            )}

            {tab === 'reports' && (
              <div className="flex flex-col gap-4">
                 {reports.map(report => {
                   const reportedUser = users.find(u => u.id === report.reportedUserId);
                   return (
                     <div key={report.id} className={cn("p-6 border rounded-2xl flex flex-col gap-4 shadow-sm transition-colors", report.status === 'resolved' ? "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900" : "border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-900/10")}>
                       <div className="flex items-center justify-between">
                         <div className="flex items-center gap-3">
                           <span className="font-black text-lg text-zinc-900 dark:text-zinc-100">Report #{report.id.slice(-6).toUpperCase()}</span>
                           <span className={cn("px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider", report.status === 'resolved' ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400" : "bg-amber-200 text-amber-800 dark:bg-amber-500/20 dark:text-amber-400")}>
                             {report.status}
                           </span>
                         </div>
                         <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">{formatDistanceToNow(report.createdAt as Date)} ago</span>
                       </div>
                       <div className="text-[15px] text-zinc-800 dark:text-zinc-200 bg-white/50 dark:bg-black/20 p-4 rounded-xl">
                         <span className="font-bold block mb-1 text-zinc-500 dark:text-zinc-400 text-xs uppercase">Report Reason</span> 
                         {report.reason}
                       </div>
                       {reportedUser && (
                         <div className="flex items-center gap-4 p-4 bg-white dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800">
                           <img src={reportedUser.avatar || undefined} className="w-12 h-12 rounded-full" />
                           <div className="flex flex-col flex-1">
                             <span className="font-bold text-[15px]">{reportedUser.name}</span>
                             <span className="text-[13px] text-zinc-500">@{reportedUser.username} • {reportedUser.reportCount || 0} reports</span>
                           </div>
                         </div>
                       )}
                       {report.status !== 'resolved' && (
                         <div className="flex gap-3 justify-end mt-2">
                           <button onClick={() => handleResolveReport(report.id)} className="px-5 py-2 text-sm font-bold bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl transition-all shadow-sm">Mark Resolved</button>
                           {reportedUser && <button onClick={() => handleBanUser(reportedUser.id, false)} className="px-5 py-2 text-sm font-bold bg-orange-500 hover:bg-orange-600 text-white rounded-xl transition-all shadow-sm">Ban 7 Days</button>}
                           {reportedUser && <button onClick={() => handleBanUser(reportedUser.id, true)} className="px-5 py-2 text-sm font-bold bg-rose-500 hover:bg-rose-600 text-white rounded-xl transition-all shadow-sm">Ban Permanently</button>}
                         </div>
                       )}
                     </div>
                   );
                 })}
                 {reports.length === 0 && (
                   <div className="text-center py-20 text-zinc-400 dark:text-zinc-600 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl font-medium text-lg">
                     No reports found
                   </div>
                 )}
              </div>
            )}

            {tab === 'users' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                 {users.map(user => (
                   <div key={user.id} className="p-5 border border-zinc-200 dark:border-zinc-800 rounded-2xl flex flex-col gap-4 bg-white dark:bg-zinc-900 shadow-sm relative group">
                     <div className="flex items-center gap-4">
                       <img src={user.avatar || undefined} className="w-12 h-12 rounded-full bg-zinc-200 dark:bg-zinc-800 object-cover" />
                       <div className="flex flex-col min-w-0 flex-1">
                         <span className="font-bold text-zinc-900 dark:text-zinc-100 text-[15px] flex items-center gap-1.5 truncate">
                           {user.name} {user.isVerified && <span className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center text-white text-[10px]"><Check size={10} strokeWidth={4}/></span>}
                         </span>
                         <span className="text-zinc-500 text-[13px] font-medium truncate">
                            @{user.username}
                         </span>
                       </div>
                     </div>
                     <div className="flex items-center justify-between mt-1 pt-4 border-t border-zinc-100 dark:border-zinc-800/50">
                       <div className="flex flex-col text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                         <span>{user.followers?.length || 0} Followers</span>
                         <span>ID: {user.id.slice(0, 6)}</span>
                       </div>
                       <div className="flex items-center gap-2">
                           {user.bannedUntil && (user.bannedUntil?.toDate?.() || user.bannedUntil) > new Date() && <span className="text-rose-500 font-black tracking-wider uppercase text-[10px] bg-rose-50 dark:bg-rose-500/10 px-2 py-1 rounded-md">Banned</span>}
                           <button onClick={() => handleDeleteUser(user.id)} className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-xl transition-colors opacity-0 group-hover:opacity-100"><X size={18} strokeWidth={2.5} /></button>
                       </div>
                     </div>
                   </div>
                 ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

const UserProfileScreen`;

code = code.replace(regex, newCode);

fs.writeFileSync('src/App.tsx', code);
