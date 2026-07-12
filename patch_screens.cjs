const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const missingScreens = `
const FeedScreen = () => {
  const { posts, currentUser, followingIds } = useApp();
  const [tab, setTab] = useState<'foryou' | 'following'>('foryou');
  
  const feedPosts = tab === 'foryou' 
    ? posts 
    : posts.filter(p => p.userId === currentUser?.id || followingIds.includes(p.userId));

  return (
    <div className="flex flex-col min-h-0 h-full">
      <header className="sticky top-0 z-10 bg-white/80 dark:bg-black/80 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800 px-4 py-3 flex items-center gap-4">
        <button onClick={() => setTab('foryou')} className={\`font-bold transition-colors \${tab === 'foryou' ? 'text-black dark:text-white' : 'text-zinc-400'}\`}>For You</button>
        <button onClick={() => setTab('following')} className={\`font-bold transition-colors \${tab === 'following' ? 'text-black dark:text-white' : 'text-zinc-400'}\`}>Following</button>
      </header>
      <div className="flex-1 overflow-y-auto">
        {feedPosts.map(post => (
          <PostCard key={post.id} post={post} />
        ))}
        {feedPosts.length === 0 && (
          <div className="p-8 text-center text-zinc-500">No posts to show.</div>
        )}
      </div>
    </div>
  );
};

const NotificationsScreen = () => {
  const { currentUser } = useApp();
  const [notifications, setNotifications] = useState<any[]>([]);

  useEffect(() => {
    if (!currentUser) return;
    const q = query(collection(db, 'notifications'), where('userId', '==', currentUser.id), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, snap => {
      setNotifications(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [currentUser]);

  return (
    <div className="flex flex-col min-h-0 h-full">
      <header className="sticky top-0 z-10 bg-white/80 dark:bg-black/80 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800 px-4 py-3">
        <h1 className="font-bold text-lg dark:text-white">Notifications</h1>
      </header>
      <div className="flex-1 overflow-y-auto">
        {notifications.map(notif => (
          <div key={notif.id} className="p-4 border-b border-zinc-100 dark:border-zinc-900 flex gap-3 items-start">
             <div className="text-sm dark:text-zinc-200">{notif.message}</div>
          </div>
        ))}
        {notifications.length === 0 && <div className="p-8 text-center text-zinc-500">No notifications yet.</div>}
      </div>
    </div>
  );
};

const SearchScreen = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const q = searchParams.get('q') || '';
  const [queryText, setQueryText] = useState(q);
  const { posts } = useApp();
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    getDocs(collection(db, 'users')).then(snap => {
      setUsers(snap.docs.map(d => d.data() as User));
    });
  }, []);

  const filteredUsers = users.filter(u => u.username.toLowerCase().includes(queryText.toLowerCase()) || u.name.toLowerCase().includes(queryText.toLowerCase()));
  const filteredPosts = posts.filter(p => p.content.toLowerCase().includes(queryText.toLowerCase()));

  return (
    <div className="flex flex-col min-h-0 h-full">
      <header className="sticky top-0 z-10 bg-white/80 dark:bg-black/80 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800 p-3">
         <div className="relative">
           <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
           <input 
             type="text" 
             value={queryText}
             onChange={e => {
               setQueryText(e.target.value);
               setSearchParams(e.target.value ? { q: e.target.value } : {});
             }}
             placeholder="Search users, posts..."
             className="w-full bg-zinc-100 dark:bg-zinc-900 border-none rounded-full py-2 pl-10 pr-4 text-sm dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
           />
         </div>
      </header>
      <div className="flex-1 overflow-y-auto">
         {queryText && (
           <>
             {filteredUsers.length > 0 && (
               <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
                 <h2 className="font-bold text-sm text-zinc-500 mb-3">Users</h2>
                 <div className="flex flex-col gap-3">
                   {filteredUsers.map(u => (
                     <Link to={\`/\${u.username}\`} key={u.id} className="flex items-center gap-3">
                       <img src={u.avatar || undefined} className="w-10 h-10 rounded-full bg-zinc-200 dark:bg-zinc-800 object-cover" />
                       <div className="flex flex-col"><span className="font-bold text-sm dark:text-white">{u.name}</span><span className="text-zinc-500 text-xs">@{u.username}</span></div>
                     </Link>
                   ))}
                 </div>
               </div>
             )}
             <div className="p-4">
               <h2 className="font-bold text-sm text-zinc-500 mb-3">Posts</h2>
               {filteredPosts.map(p => <PostCard key={p.id} post={p} />)}
             </div>
           </>
         )}
      </div>
    </div>
  );
};

const CreatePostScreen = () => {
  const { currentUser, showToast } = useApp();
  const [content, setContent] = useState('');
  const navigate = useNavigate();

  const handlePost = async () => {
    if (!content.trim() || !currentUser) return;
    try {
      await addDoc(collection(db, 'posts'), {
        userId: currentUser.id,
        content: content.trim(),
        createdAt: serverTimestamp(),
        likes: [],
        commentCount: 0
      });
      showToast('Post created');
      navigate('/');
    } catch (e) {
      showToast('Error creating post');
    }
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-black">
      <header className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-zinc-500 hover:text-black dark:hover:text-white"><X size={24} /></button>
          <span className="font-bold dark:text-white">Create Post</span>
        </div>
        <button onClick={handlePost} disabled={!content.trim()} className="bg-indigo-500 text-white px-4 py-1.5 rounded-full font-bold text-sm disabled:opacity-50">Post</button>
      </header>
      <div className="p-4 flex-1">
        <textarea
          autoFocus
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="What's on your mind?"
          className="w-full h-40 resize-none bg-transparent outline-none dark:text-white text-lg placeholder:text-zinc-400"
        />
      </div>
    </div>
  );
};

const ContestsScreen = () => {
  return (
    <div className="flex flex-col h-full bg-white dark:bg-black">
      <header className="p-4 border-b border-zinc-200 dark:border-zinc-800"><h1 className="font-bold text-lg dark:text-white">Contests</h1></header>
      <div className="p-8 text-center text-zinc-500">Coming soon</div>
    </div>
  );
};

const ContestDetailScreen = () => {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col h-full bg-white dark:bg-black">
      <header className="p-4 flex items-center gap-3 border-b border-zinc-200 dark:border-zinc-800">
        <button onClick={() => navigate(-1)}><ChevronLeft className="dark:text-white"/></button>
        <h1 className="font-bold text-lg dark:text-white">Contest Details</h1>
      </header>
      <div className="p-8 text-center text-zinc-500">Coming soon</div>
    </div>
  );
};

const ChatListScreen = () => {
  return (
    <div className="flex flex-col h-full bg-white dark:bg-black">
      <header className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center">
        <h1 className="font-bold text-lg dark:text-white">Messages</h1>
        <Link to="/chat/group/create" className="text-indigo-500"><PlusSquare size={20}/></Link>
      </header>
      <div className="p-8 text-center text-zinc-500">No messages yet</div>
    </div>
  );
};

const CreateGroupChatScreen = () => {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col h-full bg-white dark:bg-black">
      <header className="p-4 flex items-center gap-3 border-b border-zinc-200 dark:border-zinc-800">
        <button onClick={() => navigate(-1)}><ChevronLeft className="dark:text-white"/></button>
        <h1 className="font-bold text-lg dark:text-white">New Group</h1>
      </header>
      <div className="p-8 text-center text-zinc-500">Coming soon</div>
    </div>
  );
};

const ChatRoomScreen = () => {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col h-full bg-white dark:bg-black">
      <header className="p-4 flex items-center gap-3 border-b border-zinc-200 dark:border-zinc-800">
        <button onClick={() => navigate(-1)}><ChevronLeft className="dark:text-white"/></button>
        <h1 className="font-bold text-lg dark:text-white">Chat</h1>
      </header>
      <div className="p-8 text-center text-zinc-500">Coming soon</div>
    </div>
  );
};

const EditProfileScreen = () => {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col h-full bg-white dark:bg-black">
      <header className="p-4 flex items-center gap-3 border-b border-zinc-200 dark:border-zinc-800">
        <button onClick={() => navigate(-1)}><ChevronLeft className="dark:text-white"/></button>
        <h1 className="font-bold text-lg dark:text-white">Edit Profile</h1>
      </header>
      <div className="p-8 text-center text-zinc-500">Coming soon</div>
    </div>
  );
};
`;

code = code.replace(/const AdminDashboardScreen = \(\) => \{/, missingScreens + '\n\nconst AdminDashboardScreen = () => {');
fs.writeFileSync('src/App.tsx', code);
