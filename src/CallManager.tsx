import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, setDoc, serverTimestamp, getDocs, deleteDoc } from 'firebase/firestore';
import { useApp } from './App';
import { motion, AnimatePresence } from 'motion/react';
import { Phone, PhoneOff, Video, Mic, MicOff, Camera, CameraOff } from 'lucide-react';

export type Call = {
  id: string;
  callerId: string;
  receiverId: string;
  callerName: string;
  callerAvatar: string;
  receiverName: string;
  receiverAvatar: string;
  type: 'audio' | 'video';
  status: 'ringing' | 'accepted' | 'rejected' | 'ended';
  createdAt: any;
};

export const CallManager = () => {
  const { currentUser } = useApp();
  const [activeCall, setActiveCall] = useState<Call | null>(null);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);

  useEffect(() => {
    if (!currentUser) return;
    const q = query(
      collection(db, 'calls'),
      where('receiverId', '==', currentUser.id),
      where('status', 'in', ['ringing', 'accepted'])
    );
    const unsubReceiver = onSnapshot(q, (snap) => {
      if (!snap.empty) {
        setActiveCall({ id: snap.docs[0].id, ...snap.docs[0].data() } as Call);
      } else {
        // Also check if we are the caller
        const qCaller = query(
          collection(db, 'calls'),
          where('callerId', '==', currentUser.id),
          where('status', 'in', ['ringing', 'accepted'])
        );
        getDocs(qCaller).then(callerSnap => {
            if (!callerSnap.empty) {
                setActiveCall({ id: callerSnap.docs[0].id, ...callerSnap.docs[0].data() } as Call);
            } else {
                setActiveCall((prev) => prev ? null : prev);
            }
        });
      }
    });

    const qCallerList = query(
        collection(db, 'calls'),
        where('callerId', '==', currentUser.id),
        where('status', 'in', ['ringing', 'accepted', 'rejected', 'ended'])
    );
    const unsubCaller = onSnapshot(qCallerList, (snap) => {
       if (!snap.empty) {
           const call = { id: snap.docs[0].id, ...snap.docs[0].data() } as Call;
           if (call.status === 'ringing' || call.status === 'accepted') {
               setActiveCall(call);
           } else if (call.status === 'rejected' || call.status === 'ended') {
               setActiveCall(null);
               // Clean up the call doc
               deleteDoc(doc(db, 'calls', call.id)).catch(console.error);
           }
       }
    });

    return () => {
      unsubReceiver();
      unsubCaller();
    };
  }, [currentUser]);

  const handleAccept = async () => {
    if (!activeCall) return;
    await updateDoc(doc(db, 'calls', activeCall.id), { status: 'accepted' });
  };

  const handleReject = async () => {
    if (!activeCall) return;
    await updateDoc(doc(db, 'calls', activeCall.id), { status: 'rejected' });
    setActiveCall(null);
  };

  const handleEnd = async () => {
    if (!activeCall) return;
    await updateDoc(doc(db, 'calls', activeCall.id), { status: 'ended' });
    setActiveCall(null);
  };

  const [callDuration, setCallDuration] = useState(0);

  useEffect(() => {
    let interval: any;
    if (activeCall?.status === 'accepted') {
      interval = setInterval(() => setCallDuration(p => p + 1), 1000);
    } else {
      setCallDuration(0);
    }
    return () => clearInterval(interval);
  }, [activeCall?.status]);

  if (!currentUser || !activeCall) return null;

  const isIncoming = activeCall.receiverId === currentUser.id && activeCall.status === 'ringing';
  const isOutgoing = activeCall.callerId === currentUser.id && activeCall.status === 'ringing';
  const isOngoing = activeCall.status === 'accepted';

  const otherUserAvatar = activeCall.callerId === currentUser.id ? activeCall.receiverAvatar : activeCall.callerAvatar;
  const otherUserName = activeCall.callerId === currentUser.id ? activeCall.receiverName : activeCall.callerName;
  const isVideo = activeCall.type === 'video';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="fixed inset-0 z-[300] bg-black/90 backdrop-blur-xl flex flex-col items-center justify-center text-white p-6"
      >
        <div className="flex-1 flex flex-col items-center justify-center w-full max-w-sm">
          <motion.img 
            initial={{ scale: 0.8 }}
            animate={{ scale: isOngoing ? 1 : [1, 1.1, 1] }}
            transition={{ repeat: isOngoing ? 0 : Infinity, duration: 1.5 }}
            src={otherUserAvatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=calling'} 
            alt="Avatar" 
            className="w-32 h-32 rounded-full object-cover border-4 border-zinc-800 shadow-2xl mb-8 object-cover" 
          />
          <h2 className="text-3xl font-bold mb-2 tracking-wide text-center">{otherUserName}</h2>
          <p className="text-zinc-400 font-medium tracking-widest uppercase text-sm mb-12">
            {isIncoming && "Incoming Call..."}
            {isOutgoing && "Calling..."}
            {isOngoing && `${Math.floor(callDuration / 60).toString().padStart(2, '0')}:${(callDuration % 60).toString().padStart(2, '0')}`}
          </p>

          <div className="flex items-center gap-6 mt-8">
            {isIncoming && (
               <>
                 <button onClick={handleReject} className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-transform hover:scale-110 shadow-lg shadow-red-500/20 text-white">
                   <PhoneOff size={28} />
                 </button>
                 <button onClick={handleAccept} className="w-16 h-16 rounded-full bg-green-500 hover:bg-green-600 flex items-center justify-center transition-transform hover:scale-110 shadow-lg shadow-green-500/20 text-white">
                   {isVideo ? <Video size={28} /> : <Phone size={28} />}
                 </button>
               </>
            )}

            {(isOutgoing || isOngoing) && (
              <>
                 <button onClick={() => setIsMicMuted(!isMicMuted)} className="w-14 h-14 rounded-full bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center transition-colors text-white">
                   {isMicMuted ? <MicOff size={24} /> : <Mic size={24} />}
                 </button>
                 {isVideo && (
                    <button onClick={() => setIsVideoMuted(!isVideoMuted)} className="w-14 h-14 rounded-full bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center transition-colors text-white">
                      {isVideoMuted ? <CameraOff size={24} /> : <Camera size={24} />}
                    </button>
                 )}
                 <button onClick={handleEnd} className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-transform hover:scale-110 shadow-lg shadow-red-500/20 text-white">
                   <PhoneOff size={28} />
                 </button>
              </>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export const startCall = async (caller: any, receiver: any, type: 'audio'|'video' = 'audio') => {
    const callRef = doc(collection(db, 'calls'));
    await setDoc(callRef, {
        callerId: caller.id,
        receiverId: receiver.id,
        callerName: caller.name || caller.username,
        callerAvatar: caller.avatar || '',
        receiverName: receiver.name || receiver.username,
        receiverAvatar: receiver.avatar || '',
        type,
        status: 'ringing',
        createdAt: serverTimestamp()
    });
};
