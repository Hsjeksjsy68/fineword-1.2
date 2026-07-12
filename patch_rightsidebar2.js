import fs from 'fs';
let code = fs.readFileSync('src/App.tsx', 'utf8');

const regex = /const RightSidebar = \(\) => \{[\s\S]*?(?=};\n\nimport \{ CallManager)/;

const newCode = `const RightSidebar = () => {
  const { currentUser, followingIds, posts } = useApp();
  const [users, setUsers] = useState<User[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchSuggested = async () => {
      try {
        const q = query(collection(db, 'users'), limit(50));
        const snap = await getDocs(q);
        const fetched: User[] = [];
        snap.forEach(d => {
          const u = d.data() as User;
          if (!currentUser || (u.id !== currentUser.id && !followingIds.includes(u.id) && !u.deactivated)) {
            fetched.push(u);
          }
        });
        setUsers(fetched.sort(() => 0.5 - Math.random()).slice(0, 5));
      } catch (e) {
        console.error("Error fetching suggested users: ", e);
      }
    };
    fetchSuggested();
  }, [currentUser, followingIds]);

  const trendingTags = useMemo(() => {
    const counts: Record<string, number> = {};
    posts.forEach(post => {
      const caption = post.caption || '';
      const tags = caption.match(/#[a-zA-Z0-9_]+/g) || [];
      tags.forEach(tag => {
        const lowerTag = tag.toLowerCase();
        counts[lowerTag] = (counts[lowerTag] || 0) + 1;
      });
    });
    const sorted = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([tag, count]) => ({ tag, count }));
      
    // Fill with default tags if not enough
    if (sorted.length < 5) {
       const defaults = ['#design', '#photography', '#technology', '#art', '#daily'];
       let i = 0;
       while (sorted.length < 5 && i < defaults.length) {
          if (!sorted.find(s => s.tag === defaults[i])) {
              sorted.push({ tag: defaults[i], count: Math.floor(Math.random() * 50 + 10) });
          }
          i++;
       }
    }
    return sorted;
  }, [posts]);

  return (
    <div className="h-full flex flex-col py-6 pl-8 pr-4 overflow-y-auto hide-scrollbar sticky top-0">
      <div className="relative mb-8">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search size={16} className="text-zinc-400" />
        </div>
        <input 
          type="text" 
          placeholder="Search..." 
          className="w-full bg-zinc-100 dark:bg-zinc-900 border-none rounded-full py-2.5 pl-10 pr-4 text-[13px] text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && e.currentTarget.value) {
              navigate('/search?q=' + encodeURIComponent(e.currentTarget.value));
            }
          }}
        />
      </div>

      {users.length > 0 && (
        <div className="bg-zinc-50 dark:bg-zinc-900/40 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 mb-6">
          <h3 className="font-bold text-[15px] text-zinc-900 dark:text-zinc-100 mb-4 tracking-tight">Suggested for you</h3>
          <div className="flex flex-col gap-4">
            {users.map(u => (
              <div key={u.id} className="flex items-center gap-3 cursor-pointer group" onClick={() => navigate('/' + u.username)}>
                <img src={u.avatar || undefined} className="w-10 h-10 rounded-full object-cover bg-zinc-200 dark:bg-zinc-800" />
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-[13px] text-zinc-900 dark:text-zinc-100 truncate group-hover:underline">{u.name || u.username}</div>
                  <div className="text-[12px] text-zinc-500 truncate">@{u.username}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      <div className="bg-zinc-50 dark:bg-zinc-900/40 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 mb-6">
        <h3 className="font-bold text-[15px] text-zinc-900 dark:text-zinc-100 mb-4 tracking-tight">Trending Tags</h3>
        <div className="flex flex-col gap-4">
           {trendingTags.map((item, i) => (
             <div key={i} className="flex flex-col cursor-pointer group" onClick={() => navigate('/search?q=' + encodeURIComponent(item.tag))}>
               <span className="font-bold text-[14px] text-zinc-900 dark:text-zinc-100 group-hover:text-indigo-500 transition-colors">{item.tag}</span>
               <span className="text-[11px] text-zinc-500 font-medium">{item.count} {item.count === 1 ? 'Post' : 'Posts'}</span>
             </div>
           ))}
        </div>
      </div>

      <div className="mt-auto pt-4 flex flex-wrap gap-x-3 gap-y-1.5 text-[11px] font-medium text-zinc-400">
        <a href="#" className="hover:underline">About</a>
        <a href="#" className="hover:underline">Help</a>
        <a href="#" className="hover:underline">Privacy</a>
        <a href="#" className="hover:underline">Terms</a>
        <div className="w-full mt-2">&copy; 2026 FineWord</div>
      </div>
    </div>
  );`;

code = code.replace(regex, newCode);
fs.writeFileSync('src/App.tsx', code);
