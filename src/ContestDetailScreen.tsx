import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, Check, X, Trophy, Upload, User, Users, Heart, Image as ImageIcon, Trash2, Type } from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, onSnapshot, updateDoc, collection, query, where, getDocs, addDoc, serverTimestamp, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from './firebase';
import { useApp, Contest, ContestMatch, cn, resizeImage } from './App';
import { format } from 'date-fns';
import { DecorativeLoader } from './Loader';

export const ContestDetailScreen = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentUser, showToast, showConfirm } = useApp();
  
  const [contest, setContest] = useState<Contest | null>(null);
  const [matches, setMatches] = useState<ContestMatch[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const unsubContest = onSnapshot(doc(db, 'contests', id), doc => {
      if (doc.exists()) {
        setContest({ ...doc.data(), id: doc.id } as Contest);
      }
      setLoading(false);
    }, e => console.error("Contest fetch error:", e.message));

    const qMatches = query(collection(db, 'contest_matches'), where('contestId', '==', id));
    const unsubMatches = onSnapshot(qMatches, snap => {
      const m: ContestMatch[] = [];
      snap.forEach(doc => m.push({ ...doc.data(), id: doc.id } as ContestMatch));
      setMatches(m);
    }, e => console.error("Matches fetch error:", e.message));

    const qUsers = query(collection(db, 'users'));
    const unsubUsers = onSnapshot(qUsers, (snap) => {
      const u: any[] = [];
      snap.forEach(d => u.push(d.data()));
      setUsers(u);
    }, e => console.error("Users fetch error:", e.message));

    return () => { unsubContest(); unsubMatches(); unsubUsers(); };
  }, [id]);

  if (loading) return <div className="flex-1 flex items-center justify-center bg-white dark:bg-black"><DecorativeLoader /></div>;
  if (!contest) return <div className="flex-1 flex items-center justify-center bg-white dark:bg-black text-zinc-500">Contest not found</div>;

  const isHost = currentUser?.id === contest.hostId;
  const isParticipant = currentUser && contest.participants.includes(currentUser.id);
  const isRequested = currentUser && contest.requests.includes(currentUser.id);
  
  const handleRequestJoin = async () => {
    if (!currentUser) return;
    try {
      if (contest.participants.length >= contest.maxParticipants) {
        showToast('Contest is full');
        return;
      }
      await updateDoc(doc(db, 'contests', contest.id), {
        requests: [...contest.requests, currentUser.id]
      });
      showToast('Join request sent to host!');
    } catch (e) {
      showToast('Error sending request');
    }
  };

  const handleAcceptRequest = async (userId: string) => {
    try {
      const newRequests = contest.requests.filter(id => id !== userId);
      const newParticipants = [...contest.participants, userId];
      await updateDoc(doc(db, 'contests', contest.id), {
        requests: newRequests,
        participants: newParticipants
      });
      showToast('Participant accepted');
    } catch (e) {
      showToast('Error accepting user');
    }
  };

  const handleRejectRequest = async (userId: string) => {
    try {
      const newRequests = contest.requests.filter(id => id !== userId);
      await updateDoc(doc(db, 'contests', contest.id), {
        requests: newRequests
      });
      showToast('Request rejected');
    } catch (e) {
      showToast('Error rejecting user');
    }
  };

  const handleStartContest = async () => {
    if (contest.participants.length !== contest.maxParticipants) {
      showToast(`Need exactly ${contest.maxParticipants} participants to start`);
      return;
    }
    
    try {
      // Shuffle participants
      const shuffled = [...contest.participants].sort(() => Math.random() - 0.5);
      
      // Create first round matches
      const matchCount = shuffled.length / 2;
      for (let i = 0; i < matchCount; i++) {
        const matchId = `cm_${Date.now()}_${i}`;
        await setDoc(doc(db, 'contest_matches', matchId), {
          id: matchId,
          contestId: contest.id,
          round: 1,
          matchIndex: i,
          user1Id: shuffled[i * 2],
          user2Id: shuffled[i * 2 + 1],
          user1Photo: null,
          user2Photo: null,
          user1Votes: [],
          user2Votes: [],
          winnerId: null,
          status: 'pending' // pending photos
        });
      }

      await updateDoc(doc(db, 'contests', contest.id), {
        status: 'active',
        currentRound: 1
      });
      showToast('Contest started! Round 1 is live.');
    } catch (e) {
      showToast('Error starting contest');
    }
  };

  const handleDeleteContest = async () => {
    if (!isHost) return;
    showConfirm('Are you sure you want to delete this contest?', async () => {
      try {
        await deleteDoc(doc(db, 'contests', contest.id));
        showToast('Contest deleted');
        navigate('/contests');
      } catch (err) {
        showToast('Failed to delete contest');
      }
    });
  };

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="flex-1 flex flex-col min-h-0 bg-white dark:bg-black absolute inset-0 z-50">
      <header className="px-2 py-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center shrink-0">
        <button onClick={() => navigate(-1)} className="p-3 text-zinc-500 hover:text-black dark:text-zinc-500 dark:hover:text-white transition-colors"><ChevronLeft size={24} /></button>
        <div className="flex-1 px-2 min-w-0">
          <h1 className="font-bold text-[17px] text-zinc-900 dark:text-zinc-100 truncate">{contest.title}</h1>
          <p className="text-[12px] text-zinc-500">
            {contest.status === 'recruiting' ? 'Recruiting Participants' : contest.status === 'active' ? `Round ${contest.currentRound}` : 'Completed'}
          </p>
        </div>
        {isHost && (
          <button onClick={handleDeleteContest} className="p-2 mx-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors" title="Delete Contest">
            <Trash2 size={20} />
          </button>
        )}
        <div className="p-2 w-10 h-10 flex items-center justify-center text-xl bg-zinc-100 dark:bg-zinc-900 rounded-full mx-2 overflow-hidden shrink-0">
          {contest.badgeIcon?.startsWith('data:') || contest.badgeIcon?.startsWith('http') ? (
            <img src={contest.badgeIcon} alt="Icon" className="w-full h-full object-cover" />
          ) : (
            <span>{contest.badgeIcon}</span>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        {contest.coverPhoto && (
          <div className="w-full h-48 bg-zinc-100 dark:bg-zinc-900 mx-auto max-w-4xl relative">
            <img src={contest.coverPhoto} alt="Contest Cover" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
          </div>
        )}
        <div className="p-5 max-w-4xl mx-auto">
          {contest.status === 'recruiting' && (
          <div className="flex flex-col gap-6 max-w-xl mx-auto">
            <div className="text-center py-6">
              <div className="w-20 h-20 mx-auto bg-indigo-50 dark:bg-indigo-900/20 rounded-full flex items-center justify-center mb-4">
                <Users className="text-indigo-500" size={32} />
              </div>
              <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">Recruiting Players</h2>
              <p className="text-zinc-500 max-w-sm mx-auto">
                {contest.participants.length} out of {contest.maxParticipants} players have joined.
                {isHost && " Accept requests to fill the bracket."}
              </p>
              
              {!isHost && !isParticipant && !isRequested && contest.participants.length < contest.maxParticipants && (
                <button onClick={handleRequestJoin} className="mt-6 bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-3 rounded-full font-bold shadow-lg shadow-indigo-500/20 transition-all active:scale-95">
                  Request to Join
                </button>
              )}
              {!isHost && isRequested && (
                <div className="mt-6 inline-flex items-center gap-2 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 px-6 py-3 rounded-full font-bold">
                  <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  Request Pending
                </div>
              )}
              {!isHost && isParticipant && (
                <div className="mt-6 inline-flex items-center gap-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 px-6 py-3 rounded-full font-bold">
                  <Check size={18} />
                  You are in! Waiting for host to start.
                </div>
              )}

              {isHost && contest.participants.length === contest.maxParticipants && (
                <button onClick={handleStartContest} className="mt-6 bg-emerald-600 hover:bg-emerald-500 text-white px-8 py-3 rounded-full font-bold shadow-lg shadow-emerald-500/20 transition-all active:scale-95">
                  Start Contest Now
                </button>
              )}
            </div>

            {isHost && contest.requests.length > 0 && (
              <div className="border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden">
                <div className="bg-zinc-50 dark:bg-zinc-900 p-3 border-b border-zinc-200 dark:border-zinc-800">
                  <h3 className="font-bold text-[13px] text-zinc-500 uppercase tracking-wider">Join Requests ({contest.requests.length})</h3>
                </div>
                <div className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
                  {contest.requests.map(reqId => {
                    const reqUser = users.find(u => u.id === reqId);
                    if (!reqUser) return null;
                    return (
                      <div key={reqId} className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <img src={reqUser.avatar || undefined} className="w-10 h-10 rounded-full" />
                          <span className="font-bold text-zinc-900 dark:text-zinc-100 text-[14px]">{reqUser.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => handleAcceptRequest(reqId)} disabled={contest.participants.length >= contest.maxParticipants} className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 hover:bg-emerald-200 flex items-center justify-center disabled:opacity-50">
                            <Check size={16} strokeWidth={3} />
                          </button>
                          <button onClick={() => handleRejectRequest(reqId)} className="w-8 h-8 rounded-full bg-rose-100 text-rose-600 hover:bg-rose-200 flex items-center justify-center">
                            <X size={16} strokeWidth={3} />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            <div className="border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden">
              <div className="bg-zinc-50 dark:bg-zinc-900 p-3 border-b border-zinc-200 dark:border-zinc-800">
                <h3 className="font-bold text-[13px] text-zinc-500 uppercase tracking-wider">Accepted Players ({contest.participants.length}/{contest.maxParticipants})</h3>
              </div>
              <div className="p-2 grid grid-cols-4 sm:grid-cols-6 gap-2">
                {contest.participants.map(pId => {
                  const pUser = users.find(u => u.id === pId);
                  if (!pUser) return null;
                  return (
                    <div key={pId} className="flex flex-col items-center gap-2 p-2">
                      <img src={pUser.avatar || undefined} className="w-12 h-12 rounded-full border-2 border-indigo-500 p-0.5" />
                      <span className="text-[10px] font-medium text-zinc-500 truncate w-full text-center">{pUser.username}</span>
                    </div>
                  );
                })}
                {Array.from({ length: contest.maxParticipants - contest.participants.length }).map((_, i) => (
                  <div key={i} className="flex flex-col items-center justify-center gap-2 p-2">
                    <div className="w-12 h-12 rounded-full border-2 border-dashed border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-zinc-400 dark:text-zinc-600 flex items-center justify-center text-xs">
                      {i + contest.participants.length + 1}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {contest.status !== 'recruiting' && (
          <div className="max-w-3xl mx-auto flex flex-col gap-8">
            <MatchList matches={matches} round={contest.currentRound} currentUser={currentUser} users={users} isHost={isHost} contest={contest} />
          </div>
        )}
        </div>
      </div>
    </motion.div>
  );
};

const MatchList: React.FC<{ matches: ContestMatch[], round: number, currentUser: any, users: any[], isHost: boolean, contest: Contest }> = ({ matches, round, currentUser, users, isHost, contest }) => {
  const roundMatches = matches.filter(m => m.round === round);
  const [uploadingMatch, setUploadingMatch] = useState<string | null>(null);

  const handleSubmitContent = async (matchId: string, player: 1 | 2, content: string, isText = false) => {
    try {
      const match = matches.find(m => m.id === matchId);
      if (!match) return;
      const updatePayload: any = {};
      if (player === 1) {
        if (isText) updatePayload.user1Text = content;
        else updatePayload.user1Photo = content;
      }
      if (player === 2) {
        if (isText) updatePayload.user2Text = content;
        else updatePayload.user2Photo = content;
      }
      
      const isOtherPresent = player === 1 ? !!(match.user2Photo || match.user2Text) : !!(match.user1Photo || match.user1Text);
      if (isOtherPresent) {
        updatePayload.status = 'active';
      }

      await updateDoc(doc(db, 'contest_matches', matchId), updatePayload);
      setUploadingMatch(null);
    } catch (e) {}
  };

  const handleVote = async (matchId: string, player: 1 | 2) => {
    if (!currentUser) return;
    const match = matches.find(m => m.id === matchId);
    if (!match || match.status !== 'active') return;
    
    // Prevent multiple voting
    if (match.user1Votes.includes(currentUser.id) || match.user2Votes.includes(currentUser.id)) return;

    try {
      const updatePayload: any = {};
      if (player === 1) updatePayload.user1Votes = [...match.user1Votes, currentUser.id];
      if (player === 2) updatePayload.user2Votes = [...match.user2Votes, currentUser.id];
      await updateDoc(doc(db, 'contest_matches', matchId), updatePayload);
    } catch (e) {}
  };

  const handleCompleteRound = async () => {
    // Determine winners and move to next round
    // This is simple logic: if votes are mapped, higher votes wins
    try {
      const nextRoundPlayers: string[] = [];
      const matchUpdates = [];

      for (const match of roundMatches) {
        const v1 = match.user1Votes.length;
        const v2 = match.user2Votes.length;
        // In tie logic, could just pick random. Using Math.random() for simplicity if tie.
        const winnerId = v1 > v2 ? match.user1Id! : v2 > v1 ? match.user2Id! : (Math.random() > 0.5 ? match.user1Id! : match.user2Id!);
        
        matchUpdates.push(updateDoc(doc(db, 'contest_matches', match.id), { status: 'completed', winnerId }));
        nextRoundPlayers.push(winnerId);
      }
      await Promise.all(matchUpdates);

      if (nextRoundPlayers.length === 1) {
        // Final winner
        await updateDoc(doc(db, 'contests', contest.id), {
          status: 'completed',
          winnerId: nextRoundPlayers[0]
        });
        
        // Add badge to user
        const winnerDoc = users.find(u => u.id === nextRoundPlayers[0]);
        if (winnerDoc) {
          const newBadge = {
            id: `bdg_${Date.now()}`,
            name: contest.badgeName,
            icon: contest.badgeIcon,
            contestId: contest.id,
            contestTitle: contest.title
          };
          const updatedBadges = [...(winnerDoc.badges || []), newBadge];
          await updateDoc(doc(db, 'users', winnerDoc.id), {
            badges: updatedBadges
          });
        }
        
      } else {
        // Create next round matches
        const nextMatchCount = nextRoundPlayers.length / 2;
        const newMatches = [];
        for (let i = 0; i < nextMatchCount; i++) {
          const matchId = `cm_${Date.now()}_r${round+1}_${i}`;
          newMatches.push(setDoc(doc(db, 'contest_matches', matchId), {
            id: matchId,
            contestId: contest.id,
            round: round + 1,
            matchIndex: i,
            user1Id: nextRoundPlayers[i * 2],
            user2Id: nextRoundPlayers[i * 2 + 1],
            user1Photo: null,
            user2Photo: null,
            user1Votes: [],
            user2Votes: [],
            winnerId: null,
            status: 'pending'
          }));
        }
        await Promise.all(newMatches);
        await updateDoc(doc(db, 'contests', contest.id), { currentRound: round + 1 });
      }

    } catch (e) {
      console.error(e);
    }
  };

  const isRoundComplete = roundMatches.every(m => m.status === 'completed');
  const hasTie = roundMatches.some(m => m.user1Votes.length === m.user2Votes.length);
  const canCompleteRound = !isRoundComplete && roundMatches.length > 0 && isHost && roundMatches.every(m => m.status !== 'pending' && (m.user1Photo || m.user1Text) && (m.user2Photo || m.user2Text));

  return (
    <div className="flex flex-col gap-6">
      {contest.type === 'question' && contest.question && (
        <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-900/30 rounded-2xl p-5 mb-2">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center shrink-0">
              <Type size={16} className="text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-indigo-900 dark:text-indigo-300 mb-1 uppercase tracking-wider">The Question</h3>
              <p className="text-zinc-900 dark:text-zinc-100 font-medium text-[15px] leading-relaxed">
                {contest.question}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 to-purple-500">
            Round {round}
          </h2>
          {isHost && !isRoundComplete && hasTie && canCompleteRound && (
             <span className="text-xs text-red-500 font-medium tracking-tight">
               {contest.type === 'question' ? 'Please select a winner for all matches to continue.' : 'Cannot continue: A match is currently tied.'}
             </span>
          )}
        </div>
        {isHost && !isRoundComplete && canCompleteRound && !hasTie && (
          <button onClick={handleCompleteRound} className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl font-bold text-[14px]">
            {roundMatches.length === 1 ? 'End Finale' : 'Next Round'}
          </button>
        )}
      </div>

      <div className="flex flex-col gap-6">
        {roundMatches.map(match => {
          const p1 = users.find(u => u.id === match.user1Id);
          const p2 = users.find(u => u.id === match.user2Id);
          if (!p1 || !p2) return null;
          
          const amIP1 = currentUser?.id === p1.id;
          const amIP2 = currentUser?.id === p2.id;
          const hasVoted = match.user1Votes.includes(currentUser?.id || '') || match.user2Votes.includes(currentUser?.id || '');
          const isQuestion = contest.type === 'question';
          const canSeeP1Answer = !isQuestion || isHost || amIP1;
          const canSeeP2Answer = !isQuestion || isHost || amIP2;
          const canVote = match.status === 'active' && !hasVoted && !amIP1 && !amIP2 && currentUser && (!isQuestion || isHost);

          return (
            <div key={match.id} className="border border-zinc-200 dark:border-zinc-800 rounded-3xl overflow-hidden bg-zinc-50 dark:bg-zinc-900/40 relative">
              {match.status === 'completed' && match.winnerId && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-black/80 backdrop-blur text-white px-4 py-1.5 rounded-full text-[11px] font-bold tracking-widest uppercase flex items-center gap-1.5">
                  <Trophy size={14} className="text-yellow-400" />
                  {match.winnerId === p1.id ? p1.name : p2.name} Won
                </div>
              )}

              {isQuestion && (
                <div className="bg-indigo-50 dark:bg-indigo-900/30 border-b border-indigo-100 dark:border-indigo-900/50 p-4">
                  {match.question ? (
                    <div className="text-center">
                      <span className="text-[11px] font-bold text-indigo-500 uppercase tracking-widest mb-1 block">Match Question</span>
                      <p className="font-bold text-indigo-950 dark:text-indigo-100">{match.question}</p>
                    </div>
                  ) : (
                    <div className="text-center">
                      {isHost ? (
                        <div className="flex items-center gap-2 max-w-sm mx-auto">
                          <input 
                            type="text" 
                            id={`match-q-${match.id}`}
                            placeholder="Type question for this match..." 
                            className="flex-1 bg-white dark:bg-black border border-indigo-200 dark:border-indigo-800 rounded-lg px-3 py-1.5 text-sm outline-none"
                          />
                          <button 
                            onClick={async () => {
                              const el = document.getElementById(`match-q-${match.id}`) as HTMLInputElement;
                              if (el && el.value.trim()) {
                                await updateDoc(doc(db, 'contest_matches', match.id), { question: el.value.trim() });
                              }
                            }}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-1.5 rounded-lg text-sm font-bold whitespace-nowrap"
                          >
                            Set
                          </button>
                        </div>
                      ) : (
                        <p className="text-indigo-500 font-medium text-sm">Waiting for host to set question...</p>
                      )}
                    </div>
                  )}
                </div>
              )}
              
              <div className="flex aspect-[9/8]">
                {/* Player 1 Side */}
                <div className="flex-1 border-r border-zinc-200 dark:border-zinc-800 flex flex-col relative group">
                  <div className="absolute top-3 left-3 z-10 flex items-center gap-2 bg-white/90 dark:bg-black/80 backdrop-blur px-2.5 py-1.5 rounded-full shadow-sm text-[12px] font-bold text-zinc-900 dark:text-zinc-100">
                    <img src={p1.avatar || undefined} className="w-5 h-5 rounded-full" />
                    <span className="truncate max-w-[80px]">{p1.name}</span>
                  </div>
                  
                  {(contest.type === 'question' ? match.user1Text : match.user1Photo) ? (
                    <>
                      {contest.type === 'question' ? (
                        <div className={cn("w-full h-full flex flex-col p-6 pt-16 bg-gradient-to-br from-indigo-50 dark:from-indigo-950 to-purple-50 dark:to-purple-950", match.status === 'completed' && match.winnerId !== p1.id && "grayscale opacity-50")}>
                          {canSeeP1Answer ? (
                            <p className="text-zinc-900 dark:text-zinc-100 font-medium text-lg leading-relaxed break-words overflow-y-auto hide-scrollbar text-center my-auto">
                              {match.user1Text}
                            </p>
                          ) : (
                            <p className="text-zinc-500 dark:text-zinc-400 font-medium text-sm text-center my-auto italic">
                              Answer hidden<br/>(Visible to host only)
                            </p>
                          )}
                        </div>
                      ) : (
                        <img src={match.user1Photo || undefined} className={cn("w-full h-full object-cover", match.status === 'completed' && match.winnerId !== p1.id && "grayscale opacity-50")} />
                      )}
                      {canVote && (
                        <div className="absolute inset-x-0 bottom-6 flex justify-center drop-shadow-md z-10">
                           <button onClick={() => handleVote(match.id, 1)} className="bg-red-500 hover:bg-red-600 text-white w-14 h-14 rounded-full flex items-center justify-center shadow-xl active:scale-95 transition-all">
                             <Heart size={28} className="fill-current" />
                           </button>
                        </div>
                      )}
                      {(match.status === 'completed' || hasVoted) && (!isQuestion || isHost) && (
                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 bg-black/60 backdrop-blur px-3 py-1.5 rounded-full text-white font-bold text-sm">
                          {match.user1Votes.length} Votes
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center p-4">
                      {amIP1 ? (
                        <>
                           <div className="w-16 h-16 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-500 mb-3">
                             {contest.type === 'question' ? <Type size={24} /> : <Upload size={24} />}
                           </div>
                           <p className="text-zinc-500 text-sm font-medium text-center mb-4">
                             {contest.type === 'question' ? 'Enter your answer for this round' : 'Upload your photo for this round'}
                           </p>
                           {contest.type === 'question' && !match.question ? (
                             <p className="text-indigo-400 text-xs font-bold text-center uppercase tracking-widest bg-indigo-50 dark:bg-indigo-900/20 px-3 py-1.5 rounded-lg">Wait for Question</p>
                           ) : (
                             <button onClick={() => setUploadingMatch(`${match.id}-1`)} className="bg-indigo-600 text-white px-5 py-2 rounded-xl text-sm font-bold">
                               {contest.type === 'question' ? 'Type Answer' : 'Select Photo'}
                             </button>
                           )}
                        </>
                      ) : (
                        <p className="text-zinc-400 text-sm font-medium text-center">Waiting for {p1.name} to {contest.type === 'question' ? 'answer' : 'upload photo'}...</p>
                      )}
                    </div>
                  )}
                  
                  {uploadingMatch === `${match.id}-1` && (
                    contest.type === 'question' ? (
                      <TextEntryOverlay onSubmit={(text) => handleSubmitContent(match.id, 1, text, true)} onCancel={() => setUploadingMatch(null)} />
                    ) : (
                      <UploadOverlay onUpload={(url) => handleSubmitContent(match.id, 1, url, false)} onCancel={() => setUploadingMatch(null)} />
                    )
                  )}
                </div>

                {/* Player 2 Side */}
                <div className="flex-1 flex flex-col relative group">
                  <div className="absolute top-3 right-3 z-10 flex items-center gap-2 bg-white/90 dark:bg-black/80 backdrop-blur px-2.5 py-1.5 rounded-full shadow-sm text-[12px] font-bold text-zinc-900 dark:text-zinc-100">
                    <span className="truncate max-w-[80px]">{p2.name}</span>
                    <img src={p2.avatar || undefined} className="w-5 h-5 rounded-full" />
                  </div>
                  
                  {(contest.type === 'question' ? match.user2Text : match.user2Photo) ? (
                    <>
                      {contest.type === 'question' ? (
                        <div className={cn("w-full h-full flex flex-col p-6 pt-16 bg-gradient-to-br from-indigo-50 dark:from-indigo-950 to-purple-50 dark:to-purple-950", match.status === 'completed' && match.winnerId !== p2.id && "grayscale opacity-50")}>
                          {canSeeP2Answer ? (
                            <p className="text-zinc-900 dark:text-zinc-100 font-medium text-lg leading-relaxed break-words overflow-y-auto hide-scrollbar text-center my-auto">
                              {match.user2Text}
                            </p>
                          ) : (
                            <p className="text-zinc-500 dark:text-zinc-400 font-medium text-sm text-center my-auto italic">
                              Answer hidden<br/>(Visible to host only)
                            </p>
                          )}
                        </div>
                      ) : (
                        <img src={match.user2Photo || undefined} className={cn("w-full h-full object-cover", match.status === 'completed' && match.winnerId !== p2.id && "grayscale opacity-50")} />
                      )}
                      {canVote && (
                        <div className="absolute inset-x-0 bottom-6 flex justify-center drop-shadow-md z-10">
                           <button onClick={() => handleVote(match.id, 2)} className="bg-red-500 hover:bg-red-600 text-white w-14 h-14 rounded-full flex items-center justify-center shadow-xl active:scale-95 transition-all">
                             <Heart size={28} className="fill-current" />
                           </button>
                        </div>
                      )}
                      {(match.status === 'completed' || hasVoted) && (!isQuestion || isHost) && (
                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 bg-black/60 backdrop-blur px-3 py-1.5 rounded-full text-white font-bold text-sm">
                          {match.user2Votes.length} Votes
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center p-4">
                      {amIP2 ? (
                        <>
                           <div className="w-16 h-16 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-500 mb-3">
                             {contest.type === 'question' ? <Type size={24} /> : <Upload size={24} />}
                           </div>
                           <p className="text-zinc-500 text-sm font-medium text-center mb-4">
                             {contest.type === 'question' ? 'Enter your answer for this round' : 'Upload your photo for this round'}
                           </p>
                           {contest.type === 'question' && !match.question ? (
                             <p className="text-indigo-400 text-xs font-bold text-center uppercase tracking-widest bg-indigo-50 dark:bg-indigo-900/20 px-3 py-1.5 rounded-lg">Wait for Question</p>
                           ) : (
                             <button onClick={() => setUploadingMatch(`${match.id}-2`)} className="bg-indigo-600 text-white px-5 py-2 rounded-xl text-sm font-bold">
                               {contest.type === 'question' ? 'Type Answer' : 'Select Photo'}
                             </button>
                           )}
                        </>
                      ) : (
                        <p className="text-zinc-400 text-sm font-medium text-center">Waiting for {p2.name} to {contest.type === 'question' ? 'answer' : 'upload photo'}...</p>
                      )}
                    </div>
                  )}

                  {uploadingMatch === `${match.id}-2` && (
                     contest.type === 'question' ? (
                       <TextEntryOverlay onSubmit={(text) => handleSubmitContent(match.id, 2, text, true)} onCancel={() => setUploadingMatch(null)} />
                     ) : (
                       <UploadOverlay onUpload={(url) => handleSubmitContent(match.id, 2, url, false)} onCancel={() => setUploadingMatch(null)} />
                     )
                  )}
                </div>
              </div>
              
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 flex items-center justify-center shadow-sm z-10 text-[12px] font-bold font-mono tracking-wider text-zinc-400">
                VS
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const TextEntryOverlay = ({ onSubmit, onCancel }: { onSubmit: (text: string) => void, onCancel: () => void }) => {
  const [text, setText] = useState('');

  return (
    <div className="absolute inset-0 bg-white/95 dark:bg-black/95 z-40 flex flex-col p-4 m-2 rounded-2xl backdrop-blur-md">
      <div className="flex-1 flex flex-col gap-3">
        <label className="text-[14px] font-bold text-zinc-700 dark:text-zinc-300">Your Answer</label>
        <textarea 
          value={text} 
          onChange={e => setText(e.target.value)}
          placeholder="Type your response here..."
          className="flex-1 bg-zinc-100 dark:bg-zinc-900 border-none outline-none p-4 rounded-xl text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500 font-medium text-[15px] resize-none"
        />
        <button 
          onClick={() => {
            if (text.trim()) onSubmit(text.trim());
          }} 
          disabled={!text.trim()}
          className="py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-[15px] shadow-lg disabled:opacity-50"
        >
          Submit Answer
        </button>
      </div>
      <button onClick={onCancel} className="absolute top-2 right-2 p-2 bg-black/10 dark:bg-white/10 hover:bg-black/20 dark:hover:bg-white/20 rounded-full transition-colors text-zinc-600 dark:text-zinc-300 z-50">
        <X size={16} />
      </button>
    </div>
  );
};

const UploadOverlay = ({ onUpload, onCancel }: { onUpload: (url: string) => void, onCancel: () => void }) => {
  const { showToast } = useApp();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        showToast('Please select an image file');
        return;
      }
      try {
        const url = await resizeImage(file, 800, 800); 
        onUpload(url);
      } catch (err) {
        showToast('Error attaching image');
      }
    }
  };
  
  return (
    <div className="absolute inset-0 bg-white/95 dark:bg-black/95 z-40 flex flex-col items-center justify-center p-4 m-2 rounded-2xl backdrop-blur-md">
      <label className="flex flex-col items-center justify-center gap-3 bg-zinc-50 dark:bg-zinc-900/80 border-2 border-dashed border-zinc-300 dark:border-zinc-700 w-full h-full rounded-xl cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all p-6">
        <div className="w-12 h-12 bg-white dark:bg-black rounded-full shadow-sm flex items-center justify-center">
          <ImageIcon size={24} className="text-zinc-400" />
        </div>
        <div className="text-center">
          <span className="block font-bold text-zinc-700 dark:text-zinc-300">Upload Photo</span>
          <span className="block text-xs text-zinc-500 mt-1">Tap to select from gallery</span>
        </div>
        <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
      </label>
      <button onClick={onCancel} className="absolute top-2 right-2 p-2 bg-black/10 dark:bg-white/10 hover:bg-black/20 dark:hover:bg-white/20 rounded-full transition-colors text-zinc-600 dark:text-zinc-300 z-50">
        <X size={16} />
      </button>
    </div>
  )
};
