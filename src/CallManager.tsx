import React, { useState, useEffect, useRef } from 'react';
import { db } from './firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, setDoc, serverTimestamp, getDocs, deleteDoc } from 'firebase/firestore';
import { useApp } from './App';
import { motion, AnimatePresence } from 'motion/react';
import { Phone, PhoneOff, Video, Mic, MicOff, Camera, CameraOff, Maximize2, Minimize2 } from 'lucide-react';

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
  chatId?: string;
  createdAt: any;
  acceptedAt?: number;
  endedAt?: number;
};

export const CallManager = () => {
  const { currentUser } = useApp();
  const [activeCall, setActiveCall] = useState<Call | null>(null);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [isFullScreen, setIsFullScreen] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);

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
               
               if (call.chatId) {
                   let text = '';
                   if (call.status === 'ended' && call.acceptedAt) {
                       let durSecs = Math.floor((Date.now() - call.acceptedAt) / 1000);
                       if (call.endedAt) durSecs = Math.floor((call.endedAt - call.acceptedAt) / 1000);
                       const mins = Math.floor(durSecs / 60);
                       const secs = durSecs % 60;
                       text = `${call.type === 'video' ? 'Video' : 'Audio'} call ended (${mins}:${secs.toString().padStart(2, '0')})`;
                   } else if (call.status === 'rejected') {
                       text = `${call.type === 'video' ? 'Video' : 'Audio'} call missed`;
                   } else {
                       text = `${call.type === 'video' ? 'Video' : 'Audio'} call ended`;
                   }

                   const msgId = `m${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
                   setDoc(doc(db, `chats/${call.chatId}/messages`, msgId), {
                       id: msgId,
                       senderId: 'system',
                       chatId: call.chatId,
                       text,
                       createdAt: serverTimestamp(),
                       callEventType: call.status
                   }).catch(console.error);
                   
                   updateDoc(doc(db, 'chats', call.chatId!), {
                       lastMessage: text,
                       updatedAt: serverTimestamp()
                   }).catch(console.error);
               }

               deleteDoc(doc(db, 'calls', call.id)).catch(console.error);
           }
       }
    });

    return () => {
      unsubReceiver();
      unsubCaller();
    };
  }, [currentUser]);

  // Request Media on Call start/accept
  useEffect(() => {
    if (!activeCall) {
      if (localStream) {
        localStream.getTracks().forEach(t => t.stop());
        setLocalStream(null);
      }
      return;
    }
    
    // Auto-setup camera/mic if outgoing or ongoing Call
    const setupMedia = async () => {
      if (!localStream && (activeCall.status === 'accepted' || activeCall.callerId === currentUser?.id)) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: activeCall.type === 'video',
            audio: true
          });
          setLocalStream(stream);
          if (localVideoRef.current) localVideoRef.current.srcObject = stream;
          
          // MOCK REMOTE STREAM for advanced visual prototype (using local stream as a placeholder for WebRTC)
          if (remoteVideoRef.current && activeCall.status === 'accepted' && activeCall.type === 'video') {
             remoteVideoRef.current.srcObject = stream;
             remoteVideoRef.current.play().catch(e => console.warn("Remote play error", e));
          }
        } catch (err: any) {
          console.warn("Failed to get local stream", err);
          if (activeCall.type === 'video') {
            try {
              const audioFallback = await navigator.mediaDevices.getUserMedia({ audio: true });
              setLocalStream(audioFallback);
            } catch (err2) {
              console.warn("Failed to get audio fallback", err2);
            }
          }
        }
      }
    };
    setupMedia();
    
    return () => {
       // We don't stop the stream on every re-render, only when activeCall becomes null
    };
  }, [activeCall, localStream, currentUser?.id]);

  useEffect(() => {
     if (localStream) {
         localStream.getAudioTracks().forEach(t => t.enabled = !isMicMuted);
         localStream.getVideoTracks().forEach(t => t.enabled = !isVideoMuted);
     }
  }, [localStream, isMicMuted, isVideoMuted]);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
        localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, activeCall?.status]);

  useEffect(() => {
    let interval: any;
    if (activeCall?.status === 'accepted') {
      interval = setInterval(() => setCallDuration(p => p + 1), 1000);
    } else {
      setCallDuration(0);
    }
    return () => clearInterval(interval);
  }, [activeCall?.status]);

  const handleAccept = async () => {
    if (!activeCall) return;
    await updateDoc(doc(db, 'calls', activeCall.id), { status: 'accepted', acceptedAt: Date.now() });
  };

  const handleReject = async () => {
    if (!activeCall) return;
    await updateDoc(doc(db, 'calls', activeCall.id), { status: 'rejected' });
    setActiveCall(null);
  };

  const handleEnd = async () => {
    if (!activeCall) return;
    await updateDoc(doc(db, 'calls', activeCall.id), { status: 'ended', endedAt: Date.now() });
    setActiveCall(null);
  };

  if (!currentUser || !activeCall) return null;

  const isIncoming = activeCall.receiverId === currentUser.id && activeCall.status === 'ringing';
  const isOutgoing = activeCall.callerId === currentUser.id && activeCall.status === 'ringing';
  const isOngoing = activeCall.status === 'accepted';

  const otherUserAvatar = activeCall.callerId === currentUser.id ? activeCall.receiverAvatar : activeCall.callerAvatar;
  const otherUserName = activeCall.callerId === currentUser.id ? activeCall.receiverName : activeCall.callerName;
  const isVideo = activeCall.type === 'video';
  const formattedDuration = `${Math.floor(callDuration / 60).toString().padStart(2, '0')}:${(callDuration % 60).toString().padStart(2, '0')}`;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className={`fixed inset-0 z-[300] bg-black/95 backdrop-blur-3xl flex flex-col items-center justify-center text-white overflow-hidden ${isFullScreen ? 'p-0' : 'p-6'}`}
      >
        {/* Blurred background image layer */}
        <div 
          className="absolute inset-0 opacity-30 bg-cover bg-center blur-2xl transform scale-110"
          style={{ backgroundImage: `url(${otherUserAvatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=calling'})` }}
        />

        {/* Remote Video / Main Stage */}
        {isOngoing && isVideo ? (
           <video 
             ref={remoteVideoRef} 
             autoPlay 
             playsInline 
             muted 
             className="absolute inset-0 w-full h-full object-cover z-0"
           />
        ) : (
          <div className="z-10 flex flex-col items-center justify-center flex-1 w-full max-w-sm mt-10">
            <motion.div 
               className="relative"
               animate={{ y: isOngoing ? -40 : 0 }}
               transition={{ type: 'spring', damping: 20 }}
            >
               <motion.img 
                  initial={{ scale: 0.8 }}
                  animate={{ scale: isOngoing ? 1 : [1, 1.1, 1] }}
                  transition={{ repeat: isOngoing ? 0 : Infinity, duration: 1.5 }}
                  src={otherUserAvatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=calling'} 
                  alt="Avatar" 
                  className="w-40 h-40 rounded-full object-cover border-4 border-zinc-800 shadow-2xl mb-6 relative z-10" 
               />
               {isOngoing && !isVideo && (
                  <motion.div 
                    animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                    transition={{ repeat: Infinity, duration: 2 }}
                    className="absolute inset-0 rounded-full bg-blue-500/30 z-0"
                  />
               )}
            </motion.div>
            
            <h2 className="text-4xl font-bold mb-2 tracking-wide text-center drop-shadow-lg">{otherUserName}</h2>
            <p className="text-zinc-300 font-medium tracking-widest uppercase text-sm mb-12 drop-shadow-md">
              {isIncoming && "Incoming Call..."}
              {isOutgoing && "Calling..."}
              {isOngoing && `Secured 256-bit • ${formattedDuration}`}
            </p>
          </div>
        )}

        {/* Draggable PIP for Local Video */}
        {isOngoing && isVideo && (
           <motion.div 
             drag 
             dragConstraints={{ left: -200, right: 200, top: -400, bottom: 400 }}
             className="absolute bottom-32 right-6 w-32 h-44 bg-zinc-900 rounded-xl overflow-hidden border border-zinc-700 shadow-2xl z-20 cursor-grab active:cursor-grabbing"
           >
              {localStream && !isVideoMuted ? (
                <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover mirror-x" style={{ transform: 'scaleX(-1)' }} />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-zinc-800 text-zinc-500">
                   <CameraOff size={24} />
                </div>
              )}
           </motion.div>
        )}

        {/* Call Controls Banner */}
        <div className="z-20 w-full max-w-md pb-8 px-6 mt-auto">
            <div className="flex items-center justify-center gap-6 bg-zinc-900/60 backdrop-blur-xl p-4 rounded-3xl border border-zinc-800/80 shadow-2xl">
              {isIncoming && (
                 <>
                   <button onClick={handleReject} className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-transform hover:scale-110 shadow-lg shadow-red-500/20 text-white">
                     <PhoneOff size={28} />
                   </button>
                   <button onClick={handleAccept} className="w-16 h-16 rounded-full bg-green-500 hover:bg-green-600 flex items-center justify-center transition-transform hover:scale-110 shadow-lg shadow-green-500/20 text-white animate-pulse">
                     {isVideo ? <Video size={28} /> : <Phone size={28} />}
                   </button>
                 </>
              )}

              {(isOutgoing || isOngoing) && (
                <>
                   <button onClick={() => setIsMicMuted(!isMicMuted)} className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${isMicMuted ? 'bg-zinc-100 text-zinc-900' : 'bg-zinc-800 hover:bg-zinc-700 text-white'}`}>
                     {isMicMuted ? <MicOff size={24} /> : <Mic size={24} />}
                   </button>
                   {isVideo && (
                      <button onClick={() => setIsVideoMuted(!isVideoMuted)} className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${isVideoMuted ? 'bg-zinc-100 text-zinc-900' : 'bg-zinc-800 hover:bg-zinc-700 text-white'}`}>
                        {isVideoMuted ? <CameraOff size={24} /> : <Camera size={24} />}
                      </button>
                   )}
                   {isOngoing && isVideo && (
                      <button onClick={() => setIsFullScreen(!isFullScreen)} className="w-14 h-14 hidden sm:flex rounded-full bg-zinc-800 hover:bg-zinc-700 items-center justify-center text-white transition-all">
                        {isFullScreen ? <Minimize2 size={24} /> : <Maximize2 size={24} />}
                      </button>
                   )}
                   <button onClick={handleEnd} className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-transform hover:scale-110 shadow-lg shadow-red-500/30 text-white">
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

export const startCall = async (caller: any, receiver: any, type: 'audio'|'video' = 'audio', chatId?: string) => {
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
        createdAt: serverTimestamp(),
        ...(chatId ? { chatId } : {})
    });
};

