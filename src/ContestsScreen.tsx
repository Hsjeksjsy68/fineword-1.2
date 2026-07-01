import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { ChevronLeft, Plus, Trophy, Users, ShieldAlert, Award, Image as ImageIcon, Trash2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { collection, onSnapshot, addDoc, serverTimestamp, setDoc, doc, updateDoc, query, orderBy, deleteDoc } from 'firebase/firestore';
import { db } from './firebase';
import { useApp, Contest, User, cn, resizeImage } from './App';
import { formatDistanceToNow } from 'date-fns';
import { DecorativeLoader } from './Loader';

export const ContestsScreen = () => {
  const { currentUser, showToast } = useApp();
  const navigate = useNavigate();
  const [contests, setContests] = useState<Contest[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [badgeName, setBadgeName] = useState('');
  const [badgeIcon, setBadgeIcon] = useState('🏆');
  const [contestType, setContestType] = useState<'image' | 'question'>('image');
  const [maxParticipants, setMaxParticipants] = useState(8);
  const [coverPhoto, setCoverPhoto] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const qUsers = query(collection(db, 'users'));
    const unsubUsers = onSnapshot(qUsers, (snap) => {
      const u: User[] = [];
      snap.forEach(d => u.push(d.data() as User));
      setUsers(u);
    }, e => console.error("Users list fetch error:", e.message));

    const q = query(collection(db, 'contests'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const c: Contest[] = [];
      snap.forEach(d => {
        c.push({
          id: d.id,
          ...d.data(),
          createdAt: d.data().createdAt?.toDate() || new Date()
        } as Contest);
      });
      setContests(c);
      setLoading(false);
    }, e => console.error("Contests fetch error:", e.message));
    return () => { unsub(); unsubUsers(); };
  }, []);

  const handleCoverPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        showToast('Please select an image file');
        return;
      }
      try {
        const url = await resizeImage(file, 800, 400); 
        setCoverPhoto(url);
      } catch (err) {
        showToast('Error attaching image');
      }
    }
  };

  const handleCreate = async () => {
    if (!currentUser) return;
    if (!title.trim() || !badgeName.trim()) {
      showToast('Title and badge name are required');
      return;
    }
    
    setCreating(true);
    try {
      const newContestId = `ct_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await setDoc(doc(db, 'contests', newContestId), {
        id: newContestId,
        hostId: currentUser.id,
        title,
        description,
        badgeName,
        badgeIcon,
        type: contestType,
        maxParticipants,
        coverPhoto,
        status: 'recruiting',
        participants: [],
        requests: [],
        currentRound: 0,
        winnerId: null,
        createdAt: serverTimestamp()
      });
      setShowCreate(false);
      setTitle('');
      setDescription('');
      setBadgeName('');
      setCoverPhoto(null);
      showToast('Contest created successfully!');
    } catch (e) {
      console.error(e);
      showToast('Error creating contest');
    } finally {
      setCreating(false);
    }
  };

  const activeContests = contests.filter(c => c.status !== 'completed').sort((a, b) => {
    if (a.type === 'question' && b.type !== 'question') return -1;
    if (a.type !== 'question' && b.type === 'question') return 1;
    return 0;
  });
  const completedContests = contests.filter(c => c.status === 'completed');

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 flex flex-col min-h-0 bg-white dark:bg-black">
      <header className="px-5 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between shrink-0">
        <h1 className="font-bold text-xl text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
          <Trophy className="text-yellow-500" size={24} />
          Contests
        </h1>
        <button 
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-black px-4 py-2 rounded-full font-bold text-[14px]"
        >
          <Plus size={18} />
          Create
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-5 pb-32 hide-scrollbar">
        {loading ? (
          <div className="flex justify-center py-20">
            <DecorativeLoader />
          </div>
        ) : contests.length === 0 ? (
          <div className="text-center py-20 text-zinc-500">
            <Trophy size={48} className="mx-auto mb-4 opacity-50" />
            <p className="font-bold text-lg">No contests yet</p>
            <p className="text-sm">Be the first to create one!</p>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {activeContests.length > 0 && (
              <div className="flex flex-col gap-4">
                <h2 className="font-bold text-lg text-zinc-900 dark:text-zinc-100 px-1">Active Contests</h2>
                {activeContests.map(contest => (
                  <ContestCard key={contest.id} contest={contest} users={users} currentUser={currentUser} />
                ))}
              </div>
            )}
            
            {completedContests.length > 0 && (
              <div className="flex flex-col gap-4">
                <h2 className="font-bold text-lg text-zinc-900 dark:text-zinc-100 px-1">Past Contests</h2>
                {completedContests.map(contest => (
                  <ContestCard key={contest.id} contest={contest} users={users} currentUser={currentUser} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-950 w-full max-w-lg rounded-[24px] p-6 flex flex-col gap-5 border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-xl text-zinc-900 dark:text-zinc-100">Create Contest</h2>
              <button onClick={() => setShowCreate(false)} className="p-2 bg-zinc-100 dark:bg-zinc-900 rounded-full text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-[13px] font-bold text-zinc-700 dark:text-zinc-300 ml-1">Contest Type</label>
                <div className="flex bg-zinc-100 dark:bg-zinc-900 rounded-xl p-1">
                  <button 
                    onClick={() => setContestType('image')}
                    className={cn("flex-1 py-2 text-[14px] font-bold rounded-lg transition-all", contestType === 'image' ? "bg-white dark:bg-zinc-800 shadow-sm text-zinc-900 dark:text-zinc-100" : "text-zinc-500")}
                  >
                    Image Battle
                  </button>
                  <button 
                    onClick={() => setContestType('question')}
                    className={cn("flex-1 py-2 text-[14px] font-bold rounded-lg transition-all", contestType === 'question' ? "bg-white dark:bg-zinc-800 shadow-sm text-zinc-900 dark:text-zinc-100" : "text-zinc-500")}
                  >
                    Question
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[13px] font-bold text-zinc-700 dark:text-zinc-300 ml-1">Contest Title</label>
                <input 
                  value={title} onChange={e => setTitle(e.target.value)}
                  placeholder="e.g. Summer Photo Challenge"
                  className="bg-zinc-100 dark:bg-zinc-900 border-none outline-none p-3.5 rounded-xl text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500 font-medium text-[15px]"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[13px] font-bold text-zinc-700 dark:text-zinc-300 ml-1">Description (Optional)</label>
                <textarea 
                  value={description} onChange={e => setDescription(e.target.value)}
                  placeholder="What is this contest about?"
                  className="bg-zinc-100 dark:bg-zinc-900 border-none outline-none p-3.5 rounded-xl text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500 font-medium text-[15px] min-h-[80px] resize-none"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[13px] font-bold text-zinc-700 dark:text-zinc-300 ml-1">Participants Bracket Size</label>
                <div className="grid grid-cols-3 gap-2">
                  {[4, 8, 16, 32, 64, 128].map(size => (
                    <button 
                      key={size}
                      onClick={() => setMaxParticipants(size)}
                      className={cn(
                        "py-2 rounded-xl font-bold transition-all border",
                        maxParticipants === size ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-black border-zinc-900 dark:border-zinc-100 shadow-md" : "bg-zinc-50 dark:bg-zinc-900 text-zinc-500 border-zinc-200 dark:border-zinc-800"
                      )}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[13px] font-bold text-zinc-700 dark:text-zinc-300 ml-1">Cover Photo (Optional)</label>
                {coverPhoto && (
                  <div className="relative w-full h-40 rounded-xl overflow-hidden mt-1 mb-2 group">
                    <img src={coverPhoto} alt="Cover" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <button 
                        onClick={() => setCoverPhoto(null)} 
                        className="p-3 bg-red-500 text-white rounded-full hover:bg-red-600 flex items-center justify-center shadow-lg transform hover:scale-110 transition-all"
                      >
                        <Trash2 size={20} />
                      </button>
                    </div>
                  </div>
                )}
                {!coverPhoto && (
                  <label 
                    className="flex flex-col items-center justify-center gap-3 bg-zinc-50 dark:bg-zinc-900/50 border-2 border-dashed border-zinc-300 dark:border-zinc-700 p-8 rounded-xl cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-900 hover:border-zinc-400 dark:hover:border-zinc-500 transition-all"
                  >
                    <div className="w-12 h-12 bg-white dark:bg-black rounded-full shadow-sm flex items-center justify-center">
                      <ImageIcon size={24} className="text-zinc-400" />
                    </div>
                    <div className="text-center">
                      <span className="block font-bold text-zinc-700 dark:text-zinc-300">Upload from Gallery</span>
                      <span className="block text-xs text-zinc-500 mt-1">Drag and drop or click to choose</span>
                    </div>
                    <input type="file" accept="image/*" onChange={handleCoverPhotoUpload} className="hidden" />
                  </label>
                )}
              </div>

              <div className="flex gap-4">
                <div className="flex flex-col gap-2 flex-1">
                  <label className="text-[13px] font-bold text-zinc-700 dark:text-zinc-300 ml-1">Winner Badge Name</label>
                  <input 
                    value={badgeName} onChange={e => setBadgeName(e.target.value)}
                    placeholder="e.g. Top Photographer"
                    className="bg-zinc-100 dark:bg-zinc-900 border-none outline-none p-3.5 rounded-xl text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500 font-medium text-[14px]"
                  />
                </div>
                <div className="flex flex-col gap-2 shrink-0">
                  <label className="text-[13px] font-bold text-zinc-700 dark:text-zinc-300 ml-1">Icon</label>
                  <label className="w-14 h-14 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl flex items-center justify-center text-2xl cursor-pointer hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors overflow-hidden">
                    {badgeIcon.startsWith('data:') || badgeIcon.startsWith('http') ? (
                      <img src={badgeIcon} alt="Badge" className="w-full h-full object-cover" />
                    ) : (
                      <span>{badgeIcon}</span>
                    )}
                    <input 
                      type="file" accept="image/*" className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          try {
                            const url = await resizeImage(file, 200, 200);
                            setBadgeIcon(url);
                          } catch (err) {
                            showToast('Error attaching icon');
                          }
                        }
                      }} 
                    />
                  </label>
                </div>
              </div>
              
              <div className="mt-4 p-4 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/30 rounded-xl flex items-start gap-3">
                <ShieldAlert className="text-indigo-500 shrink-0 mt-0.5" size={20} />
                <p className="text-[13px] text-indigo-800 dark:text-indigo-300 leading-snug">
                  <strong className="block mb-1">How it works:</strong>
                  Other users can request to join. You (the host) must accept them. Once {maxParticipants} users join, you can start the bracket. Matchups are 1v1 knockout based on photo votes!
                </p>
              </div>

            </div>

            <button 
              onClick={handleCreate} disabled={creating}
              className="mt-2 w-full py-4 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white rounded-xl font-bold text-[16px] shadow-lg shadow-indigo-500/20 disabled:opacity-50 transition-all"
            >
              {creating ? 'Creating...' : 'Create Contest'}
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
};

const ContestCard: React.FC<{ contest: Contest, users: any[], currentUser: any }> = ({ contest, users, currentUser }) => {
  const isHost = currentUser?.id === contest.hostId;
  const isParticipant = currentUser && contest.participants.includes(currentUser.id);
  const isRequested = currentUser && contest.requests.includes(currentUser.id);
  const host = users.find(u => u.id === contest.hostId);
  const winner = contest.winnerId ? users.find(u => u.id === contest.winnerId) : null;

  return (
    <Link to={`/contest/${contest.id}`} className="block border border-zinc-200 dark:border-zinc-800 rounded-[20px] bg-white dark:bg-zinc-950 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors overflow-hidden group">
      {contest.coverPhoto && (
        <div className="w-full h-32 bg-zinc-100 dark:bg-zinc-900 relative">
          <img src={contest.coverPhoto} alt={contest.title} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
        </div>
      )}
      <div className="p-5 flex flex-col gap-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0 pr-4">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className={cn(
                "px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                contest.status === 'recruiting' ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" :
                contest.status === 'active' ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" :
                "bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
              )}>
                {contest.status}
              </span>
              {contest.type === 'question' && (
                <span className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider">
                  Question
                </span>
              )}
              {isHost && <span className="bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider">Host</span>}
            </div>
            <h3 className="font-bold text-xl text-zinc-900 dark:text-zinc-100 truncate">{contest.title}</h3>
            {host && (
              <p className="text-[13px] text-zinc-500 mt-1 flex items-center gap-1.5">
                by <img src={host.avatar || undefined} className="w-4 h-4 rounded-full bg-zinc-200 dark:bg-zinc-800" /> {host.name}
              </p>
            )}
          </div>
          <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center text-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden shrink-0">
            {contest.badgeIcon?.startsWith('data:') || contest.badgeIcon?.startsWith('http') ? (
              <img src={contest.badgeIcon} alt="Icon" className="w-full h-full object-cover" />
            ) : (
              <span>{contest.badgeIcon}</span>
            )}
          </div>
        </div>
        
        {contest.description && (
          <p className="text-[14px] text-zinc-600 dark:text-zinc-400 line-clamp-2 leading-relaxed">{contest.description}</p>
        )}

        <div className="bg-zinc-50 dark:bg-zinc-900/50 rounded-xl p-3 flex flex-wrap gap-x-6 gap-y-3">
          <div className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300">
            <Users size={16} className="text-zinc-400" />
            <span className="text-[13px] font-bold">
              {contest.participants.length} / {contest.maxParticipants} <span className="font-medium text-zinc-500">Joined</span>
            </span>
          </div>
          <div className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300">
            <Award size={16} className="text-zinc-400" />
            <span className="text-[13px] font-medium max-w-[150px] truncate">
              Badge: <span className="font-bold">{contest.badgeName}</span>
            </span>
          </div>
        </div>

        {contest.status === 'completed' && winner && (
          <div className="bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-900/30 rounded-xl p-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center text-yellow-600 dark:text-yellow-500">
              <Trophy size={16} />
            </div>
            <div>
              <p className="text-[11px] font-bold text-yellow-600 dark:text-yellow-500 uppercase tracking-widest mb-0.5">Winner</p>
              <div className="flex items-center gap-2">
                <img src={winner.avatar || undefined} className="w-5 h-5 rounded-full" />
                <span className="font-bold text-[14px] text-zinc-900 dark:text-zinc-100">{winner.name}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </Link>
  );
};
