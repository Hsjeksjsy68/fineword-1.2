/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { BrowserRouter, Routes, Route, Link, useNavigate, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { Home, MessageCircle, User as UserIcon, Heart, Send, PlusSquare, Image as ImageIcon, ChevronLeft, MoreHorizontal, LogOut, Search, Moon, Sun, Share2, Music, Type, Palette, Check, BarChart2, X, Trophy, Settings, Phone, Video, PhoneOff, Mic, MicOff, Camera, CameraOff, AlertTriangle } from 'lucide-react';
import { formatDistanceToNow, format, isSameDay } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { DecorativeLoader } from './Loader';
import { db, auth } from './firebase';
import { doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, collection, onSnapshot, query, orderBy, serverTimestamp, Timestamp, where, limit } from 'firebase/firestore';
import { signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged, User as FirebaseUser, deleteUser, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  const errStr = JSON.stringify(errInfo);
  console.error('Firestore Error: ', errStr);
  throw new Error(errStr);
}

export const resizeImage = (file: File, maxWidth: number, maxHeight: number): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width *= ratio;
          height *= ratio;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.6));
        } else {
          reject(new Error("Canvas context is null"));
        }
      };
      img.onerror = reject;
      img.src = event.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTextHighlight(text: string) {
  if (!text) return text;
  const parts = text.split(/(https?:\/\/[^\s]+|#[a-zA-Z0-9_]+)/g);
  return parts.map((part, i) => {
    if (part.startsWith('http')) {
      return (
        <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline break-all" onClick={e => e.stopPropagation()}>
          {part}
        </a>
      );
    } else if (part.startsWith('#')) {
      return (
        <Link key={i} to={`/search?q=${encodeURIComponent(part)}`} className="text-indigo-500 font-medium hover:underline" onClick={e => e.stopPropagation()}>
          {part}
        </Link>
      );
    }
    return part;
  });
}

// --- MOCK DATA & TYPES ---

export type Badge = {
  id: string;
  name: string;
  icon: string;
  contestId: string;
  contestTitle: string;
};

export type User = {
  id: string;
  username: string;
  name: string;
  avatar: string;
  bio: string;
  coverPhoto?: string;
  theme?: 'light' | 'dark';
  isVerified?: boolean;
  verifiedUntil?: Date | any;
  verificationStatus?: 'none' | 'pending' | 'accepted' | 'rejected';
  verificationData?: {
    fullName: string;
    address: string;
    phoneNumber: string;
    nidBid: string;
    birthDate: string;
    nagadNumber: string;
    transactionId: string;
  };
  deactivated?: boolean;
  bannedUntil?: Date | any;
  reportCount?: number;
  badges?: Badge[];
  hideBadges?: boolean;
  activeBadgeId?: string | null;
  lastActive?: any;
};

export type Contest = {
  id: string;
  hostId: string;
  title: string;
  description: string;
  badgeName: string;
  badgeIcon: string;
  type?: 'image' | 'question';
  question?: string;
  maxParticipants: number;
  status: 'recruiting' | 'active' | 'completed';
  participants: string[]; 
  requests: string[];
  currentRound: number;
  winnerId: string | null;
  createdAt: Date | any;
  coverPhoto?: string;
};

export type ContestMatch = {
  id: string;
  contestId: string;
  round: number;
  matchIndex: number;
  user1Id: string | null;
  user2Id: string | null;
  user1Photo: string | null;
  user2Photo: string | null;
  user1Text?: string | null;
  user2Text?: string | null;
  user1Votes: string[];
  user2Votes: string[];
  question?: string | null;
  winnerId: string | null;
  status: 'pending' | 'active' | 'completed';
};

type Report = {
  id: string;
  reporterId: string;
  reportedUserId: string;
  reason: string;
  createdAt: Date | any;
  status: 'pending' | 'resolved';
};

type Post = {
  id: string;
  userId: string;
  imageUrl?: string;
  videoUrl?: string;
  caption: string;
  likes: number;
  likedBy: string[];
  createdAt: Date;
  isItalic?: boolean;
};

type TextOverlay = {
  text: string;
  x: number;
  y: number;
  scale: number;
  color: string;
};

type ImageOverlay = {
  url: string;
  x: number;
  y: number;
  scale: number;
};

type PollOverlay = {
  question: string;
  options: string[];
  x: number;
  y: number;
  scale: number;
};

type Story = {
  id: string;
  userId: string;
  imageUrl?: string;
  videoUrl?: string;
  backgroundColor?: string;
  textOverlays?: TextOverlay[];
  imageOverlays?: ImageOverlay[];
  poll?: PollOverlay;
  song?: {
    title: string;
    artist: string;
  };
  createdAt: Date;
  expiresAt: Date;
};

type Comment = {
  id: string;
  postId: string;
  userId: string;
  text: string;
  createdAt: Date;
};

type Message = {
  id: string;
  chatId: string;
  senderId: string;
  text: string;
  imageUrl?: string;
  videoUrl?: string; // NEW
  isDeleted?: boolean; // NEW
  createdAt: Date;
};

type Notification = {
  id: string;
  userId: string;
  actorId: string;
  type: 'like' | 'comment' | 'follow' | 'system';
  postId?: string;
  message?: string;
  read: boolean;
  createdAt: Date;
};

type Chat = {
  id: string;
  users: string[];
  admins?: string[]; // NEW
  onlyAdminsCanAddMembers?: boolean; // NEW
  lastMessage: string;
  updatedAt: Date;
  seenBy?: string[];
  isGroup?: boolean;
  groupName?: string;
  groupAvatar?: string;
  theme?: string;
  nicknames?: Record<string, string>;
};


const CURRENT_USER: User = {
  id: 'u1',
  username: 'alex_dev',
  name: 'Alex Developer',
  avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Alex',
  bio: 'Building awesome apps with Flutter & React ð',
};

const MOCK_USERS: Record<string, User> = {
  u2: { id: 'u2', username: 'sarah.codes', name: 'Sarah Smith', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah', bio: 'Frontend enthusiast' },
  u3: { id: 'u3', username: 'mike_design', name: 'Mike J', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Mike', bio: 'UI/UX Designer. Dark mode everything.' },
};

const INITIAL_POSTS: Post[] = [
  {
    id: 'p1',
    userId: 'u2',
    imageUrl: 'https://images.unsplash.com/photo-1555099962-4199c345e5dd?w=800&q=80',
    caption: 'Just launched my new portfolio! Check it out ð #coding #webdev',
    likes: 124,
    likedBy: [],
    createdAt: new Date(Date.now() - 1000 * 60 * 30), // 30 mins ago
  },
  {
    id: 'p2',
    userId: 'u3',
    imageUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&q=80',
    caption: 'Workspace aesthetic ã½ï¸',
    likes: 89,
    likedBy: ['u1'],
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
  },
];

const INITIAL_CHATS: Chat[] = [
  { id: 'c1', users: ['u1', 'u2'], lastMessage: 'That looks amazing! Thanks!', updatedAt: new Date(Date.now() - 1000 * 60 * 5) },
  { id: 'c2', users: ['u1', 'u3'], lastMessage: 'Let me know when you are free to chat.', updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24) },
];

const INITIAL_MESSAGES: Message[] = [
  { id: 'm1', chatId: 'c1', senderId: 'u2', text: 'Hey Alex, did you finish the Flutter setup?', createdAt: new Date(Date.now() - 1000 * 60 * 6) },
  { id: 'm2', chatId: 'c1', senderId: 'u1', text: 'That looks amazing! Thanks!', createdAt: new Date(Date.now() - 1000 * 60 * 5) },
];

// --- CONTEXT ---
interface AppState {
  currentUser: User | null;
  logout: () => void;
  updateProfile: (data: Partial<User>) => void;
  posts: Post[];
  setPosts: React.Dispatch<React.SetStateAction<Post[]>>;
  updatePost: (postId: string, newCaption: string) => Promise<void>;
  deletePost: (postId: string) => Promise<void>;
  chats: Chat[];
  deleteChat: (chatId: string) => Promise<void>;
  removeGroupMember: (chatId: string, userIdToRemove: string) => Promise<void>;
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  notifications: Notification[];
  followingIds: string[];
  toggleLike: (postId: string) => void;
  sendMessage: (chatId: string, text: string, imageUrl?: string, videoUrl?: string) => void;
  deleteMessage: (chatId: string, msgId: string) => void;
  showToast: (msg: string) => void;
  showConfirm: (msg: string, onConfirm: () => void) => void;
  theme: 'light' | 'dark';
  setTheme: (t: 'light' | 'dark') => void;
}

export const AppContext = React.createContext<AppState | null>(null);
export const useApp = () => React.useContext(AppContext)!;

export const checkIsOnline = (lastActive: any) => {
  if (!lastActive) return false;
  const date = lastActive?.toDate?.() ? lastActive.toDate() : new Date(lastActive);
  return (new Date().getTime() - date.getTime()) < 5 * 60 * 1000;
};

// --- COMPONENTS ---

const SideNav = () => {
  const location = useLocation();
  const { chats, currentUser, notifications, theme, setTheme } = useApp();
  
  const unseenMessageCount = chats.filter(c => currentUser && (!c.seenBy || !c.seenBy.includes(currentUser.id)) && c.lastMessage).length;
  const unseenNotificationCount = notifications.filter(n => !n.read).length;

  const navItems = [
    { path: '/', icon: Home, label: 'Home' },
    { path: '/search', icon: Search, label: 'Search' },
    { path: '/create', icon: PlusSquare, label: 'Create' },
    { path: '/contests', icon: Trophy, label: 'Contests' },
    { path: '/notifications', icon: Heart, badgeCount: unseenNotificationCount, label: 'Notifications' },
    { path: '/chat', icon: MessageCircle, badgeCount: unseenMessageCount, label: 'Messages' },
    { path: '/profile', icon: UserIcon, label: 'Profile' },
  ];

  return (
    <nav className="flex flex-col h-full py-8 px-2 lg:px-6">
      <div className="mb-10 px-2 lg:px-4 hidden lg:block">
        <h1 className="text-2xl font-bold italic font-sans tracking-tight">FineWord</h1>
      </div>
      <div className="mb-10 px-3 lg:hidden flex justify-center">
        <span className="font-bold italic text-xl">FW</span>
      </div>
      
      <div className="flex flex-col gap-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
          return (
            <Link key={item.path} to={item.path} className={cn("flex flex-row items-center gap-4 p-3 rounded-xl transition-all group", isActive ? "font-bold" : "hover:bg-zinc-100 dark:hover:bg-zinc-900")}>
              <div className="relative flex items-center justify-center lg:justify-start w-full">
                <Icon size={26} className={cn("transition-transform group-hover:scale-105", isActive ? "text-indigo-600 dark:text-indigo-400" : "text-zinc-800 dark:text-zinc-200 group-hover:text-black dark:group-hover:text-white")} />
                {!!item.badgeCount && item.badgeCount > 0 && (
                  <div className="absolute -top-1.5 right-[calc(50%-22px)] lg:right-auto lg:left-4 h-[18px] min-w-[18px] px-1 bg-red-500 rounded-full border border-white dark:border-black flex items-center justify-center text-[10px] font-bold text-black dark:text-white shadow-sm">
                    {item.badgeCount > 99 ? '99+' : item.badgeCount}
                  </div>
                )}
                <span className={cn("hidden lg:block ml-4 text-[16px]", isActive ? "text-indigo-600 dark:text-indigo-400" : "text-zinc-800 dark:text-zinc-200 group-hover:text-black dark:group-hover:text-white")}>{item.label}</span>
              </div>
            </Link>
          );
        })}
      </div>
      
      <div className="mt-auto hidden md:flex flex-col gap-4 w-full">
         <button 
           onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} 
           className="flex items-center justify-center lg:justify-start gap-4 p-3 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-xl transition-colors w-full group overflow-hidden text-zinc-800 dark:text-zinc-200 hover:text-black dark:hover:text-white"
         >
           <div className="relative flex items-center justify-center lg:justify-start w-full">
             {theme === 'light' ? <Moon size={26} className="transition-transform group-hover:scale-105" /> : <Sun size={26} className="transition-transform group-hover:scale-105" />}
             <span className="hidden lg:block ml-4 text-[16px]">Theme</span>
           </div>
         </button>
         <Link to="/profile" className="flex items-center gap-3 p-2 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-xl transition-colors w-full group overflow-hidden">
            {currentUser ? (
              <img src={currentUser.avatar || undefined} className="w-10 h-10 rounded-full bg-zinc-200 dark:bg-zinc-800 shrink-0 object-cover" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-zinc-200 dark:bg-zinc-800 shrink-0 flex items-center justify-center text-zinc-500"><UserIcon size={20} /></div>
            )}
            <div className="hidden lg:flex flex-col flex-1 min-w-0">
               <span className="text-[14px] font-bold text-zinc-900 dark:text-zinc-100 flex items-center truncate">
                 <span className="truncate">{currentUser?.name || 'Guest User'}</span>
                 <VerifiedBadge isVerified={currentUser?.isVerified} />
               </span>
               <span className="text-[12px] text-zinc-500 dark:text-zinc-500 truncate">
                 {currentUser ? `@${currentUser.username}` : 'Click to login'}
               </span>
            </div>
         </Link>
      </div>
    </nav>
  );
};

const BottomNav = () => {
  const location = useLocation();
  const { chats, currentUser } = useApp();
  
  const unseenMessageCount = chats.filter(c => currentUser && (!c.seenBy || !c.seenBy.includes(currentUser.id)) && c.lastMessage).length;

  const navItems = [
    { path: '/', icon: Home },
    { path: '/search', icon: Search },
    { path: '/create', icon: PlusSquare },
    { path: '/contests', icon: Trophy },
    { path: '/chat', icon: MessageCircle, badgeCount: unseenMessageCount },
    { path: '/profile', icon: UserIcon },
  ];

  // Hide nav on conversation screen
  if (location.pathname.startsWith('/chat/')) return null;

  return (
    <nav className="shrink-0 h-16 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black flex justify-around items-center px-4 z-50">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = location.pathname === item.path;
        return (
          <Link key={item.path} to={item.path} className="relative p-2">
            <Icon 
              size={24} 
              className={cn("transition-colors", isActive ? "text-indigo-600 dark:text-indigo-400" : "text-zinc-800 hover:text-black dark:text-zinc-400 dark:hover:text-white")} 
              strokeWidth={isActive ? 2.5 : 2}
            />
            {!!item.badgeCount && item.badgeCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-red-500 border border-white dark:border-black rounded-full flex items-center justify-center text-[10px] font-bold text-black dark:text-white shadow-sm">
                {item.badgeCount > 99 ? '99+' : item.badgeCount}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
};

const VerifiedBadge = ({ isVerified }: { isVerified?: boolean }) => {
  if (!isVerified) return null;
  return (
    <svg className="w-4 h-4 text-blue-500 fill-current inline-block ml-1" viewBox="0 0 24 24">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"></path>
    </svg>
  );
};

const FollowListModal = ({ isOpen, onClose, title, users }: { isOpen: boolean; onClose: () => void; title: string; users: any[] }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden shadow-2xl border border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800 sticky top-0 bg-white dark:bg-zinc-900 z-10">
          <h2 className="text-xl font-bold">{title}</h2>
          <button onClick={onClose} className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {users.length === 0 ? (
            <div className="text-center text-zinc-500 py-8">No users found.</div>
          ) : (
            <div className="flex flex-col gap-4">
              {users.map(user => (
                <Link key={user.id} to={`/${user.username}`} onClick={onClose} className="flex items-center gap-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 p-2 rounded-xl transition-colors">
                  <img src={user.avatar || undefined} alt={user.username} className="w-12 h-12 rounded-full object-cover" />
                  <div className="flex flex-col flex-1 overflow-hidden">
                    <span className="font-bold flex items-center gap-1">{user.username} <VerifiedBadge isVerified={user.isVerified} /></span>
                    <span className="text-sm text-zinc-500 line-clamp-1 truncate">{user.name}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const PostItem: React.FC<{ post: Post }> = ({ post }) => {
  const { toggleLike, showToast, showConfirm, currentUser, updatePost, deletePost } = useApp();
  const navigate = useNavigate();
  const [author, setAuthor] = React.useState<User | null>(null);
  const [showOptions, setShowOptions] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editCaption, setEditCaption] = useState(post.caption || '');
  const [isZoomed, setIsZoomed] = useState(false);

  useEffect(() => {
    if (post.userId === currentUser?.id) {
      setAuthor(currentUser);
    } else {
      getDoc(doc(db, 'users', post.userId)).then(d => {
        if (d.exists()) setAuthor(d.data() as User);
        else setAuthor({ username: 'unknown', avatar: '', name: 'Unknown', id: post.userId, bio: '' });
      });
    }
  }, [post.userId, currentUser]);

  const user = author || { username: '...', avatar: '', name: '...', id: post.userId, bio: '' };
  const isLiked = currentUser ? post.likedBy.includes(currentUser.id) : false;

  const handleShare = () => {
    const url = `${window.location.origin}/post/${post.id}/comments`;
    navigator.clipboard.writeText(url).then(() => {
      showToast('Link copied to clipboard!');
      setShowOptions(false);
    }).catch(() => {
      showToast('Failed to copy link');
      setShowOptions(false);
    });
  };

  const handleSaveEdit = async () => {
    if (editCaption === post.caption) {
      setIsEditing(false);
      return;
    }
    await updatePost(post.id, editCaption);
    setIsEditing(false);
    showToast('Post updated');
  };

  const handleDelete = async () => {
    showConfirm('Are you sure you want to delete this post?', async () => {
      await deletePost(post.id);
      showToast('Post deleted');
    });
  };

  const activeBadge = user.activeBadgeId && !user.hideBadges && user.badges ? user.badges.find(b => b.id === user.activeBadgeId) : null;

  return (
    <motion.div 
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.3 }}
      className="mb-6 flex flex-col gap-3 relative bg-white dark:bg-zinc-950 sm:border border-zinc-200 dark:border-zinc-800 sm:rounded-2xl pb-4"
    >
      <div className="flex items-center gap-3 px-5 pt-4">
        <Link to={`/${user.username}`} className="flex items-center gap-3 flex-1 overflow-hidden group">
          <img src={user.avatar || undefined} alt={user.username} className="w-10 h-10 rounded-full bg-zinc-200 dark:bg-zinc-800 p-0.5 object-cover" />
          <div className="font-semibold text-[14px] flex-1 flex items-center text-zinc-900 dark:text-zinc-100 group-hover:text-zinc-500 dark:text-zinc-500 transition-colors truncate">
            {user.username}
            <VerifiedBadge isVerified={user.isVerified} />
            {activeBadge && (
              <span className="ml-1" title={activeBadge.name}>{activeBadge.icon}</span>
            )}
            {checkIsOnline(user.lastActive) && (
              <span className="ml-2 w-2 h-2 rounded-full bg-green-500" title="Online" />
            )}
          </div>
        </Link>
        <div className="relative">
          <button onClick={() => setShowOptions(!showOptions)} className="p-2 -mr-2"><MoreHorizontal size={20} className="text-zinc-600 hover:text-zinc-500 dark:text-zinc-500 dark:text-zinc-400 transition-colors" /></button>
          
          {showOptions && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowOptions(false)} />
              <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-lg z-50 overflow-hidden flex flex-col">
                <button onClick={handleShare} className="text-left px-4 py-3 text-[14px] text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 dark:hover:text-white transition-colors">Share</button>
                {currentUser?.id === post.userId ? (
                  <>
                    <button onClick={() => { setIsEditing(true); setShowOptions(false); }} className="text-left px-4 py-3 text-[14px] text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 dark:hover:text-white transition-colors">Edit</button>
                    <button onClick={() => { handleDelete(); setShowOptions(false); }} className="text-left px-4 py-3 text-[14px] text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">Delete</button>
                  </>
                ) : (
                  <button onClick={() => { showToast('Report sent'); setShowOptions(false); }} className="text-left px-4 py-3 text-[14px] text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">Report</button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
      {(post.imageUrl || post.videoUrl || post.caption) && (
        <div className={cn("w-full bg-zinc-100 dark:bg-zinc-950 px-0 relative", (!post.imageUrl && !post.videoUrl) && "aspect-[4/3] flex items-center justify-center p-6")}>
          {post.imageUrl ? (
            <img 
              src={post.imageUrl} 
              alt="Post" 
              className="w-full h-auto max-h-[80vh] object-cover bg-zinc-100 dark:bg-zinc-950 cursor-zoom-in" 
              onClick={() => setIsZoomed(true)}
            />
          ) : post.videoUrl ? (
            <ChunkedVideoPlayer 
              videoUrl={post.videoUrl}
              postId={post.id}
              controls
              className="w-full h-auto max-h-[80vh] bg-black outline-none" 
            />
          ) : (
            <div className={cn("text-lg font-medium text-center text-zinc-900 dark:text-zinc-100", post.isItalic && "italic")}>
              {formatTextHighlight(post.caption)}
            </div>
          )}
        </div>
      )}
      
      <AnimatePresence>
        {isZoomed && post.imageUrl && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-white dark:bg-transparent/90 backdrop-blur-sm flex items-center justify-center p-4 sm:p-10 cursor-zoom-out"
            onClick={() => setIsZoomed(false)}
          >
            <button 
              className="absolute top-6 right-6 text-black dark:text-white/70 hover:text-black dark:text-white p-2 rounded-full bg-white dark:bg-transparent/50 hover:bg-white dark:bg-black transition-colors z-[101]"
              onClick={(e) => {
                e.stopPropagation();
                setIsZoomed(false);
              }}
            >
              <X size={28} />
            </button>
            <motion.img 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              src={post.imageUrl || undefined} 
              alt="Post Zoomed" 
              className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl cursor-default"
              onClick={(e) => e.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="px-5 pt-2">
        <div className="flex items-center gap-4 mb-3">
          <button onClick={() => toggleLike(post.id)} className="group">
            <Heart size={24} className={cn("transition-all duration-300", isLiked ? "fill-rose-500 text-rose-500 scale-110" : "text-zinc-900 dark:text-zinc-100 group-hover:text-zinc-500 dark:text-zinc-500")} />
          </button>
          <button onClick={() => navigate(`/post/${post.id}/comments`)} className="group">
            <MessageCircle size={24} className="text-zinc-900 dark:text-zinc-100 group-hover:text-zinc-500 dark:text-zinc-500 transition-colors" />
          </button>
          <button onClick={handleShare} className="group">
            <Share2 size={24} className="text-zinc-900 dark:text-zinc-100 group-hover:text-zinc-500 dark:text-zinc-500 transition-colors" />
          </button>
        </div>
        <p className="font-semibold text-[14px] text-zinc-900 dark:text-zinc-100 mb-2">{post.likes.toLocaleString()} likes</p>
        
        {isEditing ? (
          <div className="flex flex-col gap-2 mt-2">
            <textarea
              className="w-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-3 text-[14px] text-zinc-900 dark:text-zinc-100 resize-none focus:outline-none focus:border-indigo-500"
              value={editCaption}
              onChange={e => setEditCaption(e.target.value)}
              rows={3}
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => { setIsEditing(false); setEditCaption(post.caption || ''); }} className="px-4 py-1.5 text-[13px] font-medium text-zinc-600 dark:text-zinc-500 dark:text-zinc-400">Cancel</button>
              <button onClick={handleSaveEdit} className="px-4 py-1.5 text-[13px] font-medium bg-indigo-500 text-black dark:text-white rounded-md">Save</button>
            </div>
          </div>
        ) : (
          <p className="text-[14px] leading-relaxed">
            <span className="font-semibold mr-2 text-zinc-900 dark:text-zinc-100">{user.username}</span>
            <span className="text-zinc-800 dark:text-zinc-200">{formatTextHighlight(post.caption)}</span>
          </p>
        )}
        
        <p className="text-[11px] text-zinc-500 dark:text-zinc-500 mt-2 uppercase tracking-wide font-medium">
          {formatDistanceToNow(post.createdAt, { addSuffix: true })}
        </p>
      </div>
    </motion.div>
  );
};

// --- COMMENTS SCREEN ---
const CommentsScreen = () => {
  const { currentUser, showToast, posts } = useApp();
  const navigate = useNavigate();
  const { postId } = useParams<{ postId: string }>();
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [users, setUsers] = useState<Record<string, User>>({});

  useEffect(() => {
    if (!postId) return;
    const q = query(collection(db, `posts/${postId}/comments`), orderBy('createdAt', 'asc'));
    const unsub = onSnapshot(q, snap => {
      const c: Comment[] = [];
      snap.forEach(d => {
        const data = d.data();
        c.push({
          ...data,
          id: d.id,
          createdAt: data.createdAt?.toDate?.() || new Date()
        } as Comment);
      });
      setComments(c);
      
      c.forEach(cm => {
        if (!users[cm.userId]) {
          getDoc(doc(db, 'users', cm.userId)).then(uSnap => {
             if (uSnap.exists()) {
               setUsers(prev => ({...prev, [cm.userId]: uSnap.data() as User}));
             }
          });
        }
      });
    }, error => console.error("Comments error:", error.message));
    return () => unsub();
  }, [postId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      showToast('Please log in to comment.');
      return;
    }
    if (!commentText.trim() || !postId) return;
    const cid = `c${Date.now()}`;
    const newComment = {
      id: cid,
      postId,
      userId: currentUser.id,
      text: commentText,
      createdAt: serverTimestamp()
    };
    try {
      await setDoc(doc(db, `posts/${postId}/comments`, cid), newComment);
      setCommentText('');

      const post = posts.find(p => p.id === postId);
      if (post && post.userId !== currentUser.id) {
        const notifId = `nc_${Date.now()}`;
        await setDoc(doc(db, 'notifications', notifId), {
          id: notifId,
          userId: post.userId,
          actorId: currentUser.id,
          type: 'comment',
          postId: post.id,
          read: false,
          createdAt: serverTimestamp()
        });
      }
    } catch (e) {
      console.error(e);
      showToast('failed to post comment');
    }
  };

  return (
    <motion.div initial={{ x: 50, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="flex-1 flex flex-col min-h-0 bg-white dark:bg-black absolute inset-0 z-50">
      <header className="flex items-center justify-between px-5 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black/90 backdrop-blur-md sticky top-0 z-50 shrink-0">
        <button onClick={() => navigate(-1)} className="text-zinc-500 dark:text-zinc-500 dark:text-zinc-400 hover:text-black dark:text-white transition-colors w-8"><ChevronLeft size={24} /></button>
        <span className="font-bold text-lg text-zinc-900 dark:text-zinc-100">Post</span>
        <div className="w-8" />
      </header>
      
      <div className="flex-1 overflow-y-auto w-full p-4 flex flex-col gap-5">
        {(() => {
          const post = posts.find(p => p.id === postId);
          if (post) {
            return (
              <div className="border-b border-zinc-200 dark:border-zinc-800 pb-4 mb-2 -mx-4 px-4 bg-white dark:bg-black">
                <PostItem post={post} />
              </div>
            );
          }
          return null;
        })()}
        <AnimatePresence mode="popLayout">
          {comments.map((cm) => {
            const u = users[cm.userId] || { username: '...', avatar: '', name: '...' };
            return (
              <motion.div layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} key={cm.id} className="flex gap-3">
                 <img src={u.avatar || undefined} alt="" className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-800" />
                 <div className="flex-1">
                   <div className="flex items-baseline gap-2">
                     <span className="font-bold text-[13px] text-zinc-900 dark:text-zinc-100">{u.username}</span>
                     <span className="text-[11px] text-zinc-500 dark:text-zinc-500">{formatDistanceToNow(cm.createdAt)}</span>
                   </div>
                   <p className="text-[13px] text-zinc-700 dark:text-zinc-300 mt-1">{formatTextHighlight(cm.text)}</p>
                 </div>
              </motion.div>
            )
          })}
        </AnimatePresence>
        {comments.length === 0 && <div className="text-zinc-500 dark:text-zinc-500 text-center mt-10">No comments yet</div>}
      </div>

      <form onSubmit={handleSend} className="px-4 py-3 bg-white dark:bg-black border-t border-zinc-200 dark:border-zinc-800/80 mb-safe shrink-0 flex items-center gap-3">
        <img src={currentUser?.avatar || undefined} alt="" className="w-9 h-9 rounded-full bg-zinc-200 dark:bg-zinc-800" />
        <input 
          type="text" 
          value={commentText}
          onChange={e => setCommentText(e.target.value)}
          placeholder="Add a comment..."
          className="flex-1 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-full px-4 py-2 text-[14px] text-black dark:text-white outline-none placeholder:text-zinc-500 dark:text-zinc-500"
        />
        <button type="submit" disabled={!commentText.trim()} className="text-indigo-400 font-bold px-2 disabled:opacity-50">Post</button>
      </form>
    </motion.div>
  );
};

// --- SCREENS ---
const VerificationRequestModal = ({ onClose }: { onClose: () => void }) => {
  const { currentUser, showToast } = useApp();
  const [formData, setFormData] = useState({
    fullName: '', address: '', phoneNumber: '', nidBid: '', birthDate: '', nagadNumber: '', transactionId: ''
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setLoading(true);
    try {
      await updateDoc(doc(db, 'users', currentUser.id), {
        verificationStatus: 'pending',
        verificationData: formData
      });
      showToast('Verification request sent successfully!');
      onClose();
    } catch (e) {
      console.error(e);
      showToast('Error sending request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-white dark:bg-transparent/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-white dark:bg-zinc-950 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-white dark:bg-zinc-950 sticky top-0 z-10 shrink-0">
          <h2 className="font-bold text-lg dark:text-white">Verification Request</h2>
          <button onClick={onClose} className="p-1.5 bg-zinc-100 dark:bg-zinc-900 rounded-full text-zinc-500 hover:text-black dark:text-zinc-500 dark:text-zinc-400 dark:hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-6 no-scrollbar flex-1">
          <form id="verify-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
             <div className="bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-800/20 p-4 rounded-xl text-center mb-2">
               <span className="inline-block p-3 bg-indigo-100 dark:bg-indigo-900/30 rounded-full mb-2">
                 <Trophy size={28} className="text-indigo-500" />
               </span>
               <h3 className="font-bold text-indigo-900 dark:text-indigo-100">Get Verified</h3>
               <p className="text-sm text-indigo-700 dark:text-indigo-300 mt-1">Please pay <strong className="font-bold">100 TK</strong> fee for 1 month via Nagad to <strong className="font-bold">+8801705573859</strong> and submit the transaction info along with correct details below.</p>
             </div>
             
             {[
               { id: 'fullName', label: 'Full Name', type: 'text', placeholder: 'Your full name' },
               { id: 'address', label: 'Address', type: 'text', placeholder: 'Your current address' },
               { id: 'phoneNumber', label: 'Phone Number', type: 'tel', placeholder: 'e.g. 01XXXXXXXXX' },
               { id: 'nidBid', label: 'NID / Birth Registration ID', type: 'text', placeholder: 'National ID or Birth ID number' },
               { id: 'birthDate', label: 'Date of Birth', type: 'date', placeholder: '' },
               { id: 'nagadNumber', label: 'Nagad Number (From which you sent fee)', type: 'tel', placeholder: 'e.g. 01XXXXXXXXX' },
               { id: 'transactionId', label: 'Transaction ID (TrxID)', type: 'text', placeholder: 'Nagad transaction ID' }
             ].map(field => (
               <div key={field.id} className="flex flex-col gap-1.5">
                 <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300 ml-1">{field.label}</label>
                 <input 
                   required 
                   type={field.type} 
                   placeholder={field.placeholder}
                   value={(formData as any)[field.id]}
                   onChange={e => setFormData({ ...formData, [field.id]: e.target.value })}
                   className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 outline-none focus:border-indigo-500 dark:focus:border-indigo-500 transition-colors text-[15px] dark:text-white"
                 />
               </div>
             ))}
          </form>
        </div>
        <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shrink-0">
          <button 
             type="submit" 
             form="verify-form"
             disabled={loading}
             className="w-full py-3.5 bg-indigo-500 hover:bg-indigo-600 text-black dark:text-white rounded-xl font-bold text-[15px] transition-colors disabled:opacity-50 flex justify-center items-center"
          >
             {loading ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> : 'Submit Request'}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

const SettingsScreen = () => {
  const { currentUser, showToast, showConfirm, logout, theme, setTheme } = useApp();
  const navigate = useNavigate();
  const [showVerifyModal, setShowVerifyModal] = useState(false);

  const handleDeactivate = async () => {
    if (!currentUser) return;
    showConfirm(currentUser.deactivated ? 'Are you sure you want to reactivate your account?' : 'Are you sure you want to deactivate your account?', async () => {
      try {
        await updateDoc(doc(db, 'users', currentUser.id), {
          deactivated: !currentUser.deactivated
        });
        showToast(currentUser.deactivated ? 'Account reactivated' : 'Account deactivated');
      } catch (e) {
        console.error(e);
        showToast('Error deactivating account');
      }
    });
  };

  const handleDelete = async () => {
    if (!currentUser) return;
    showConfirm('Are you sure you want to completely delete your account? This cannot be undone.', async () => {
      try {
        await deleteDoc(doc(db, 'users', currentUser.id));
        if (auth.currentUser) {
          await deleteUser(auth.currentUser);
        }
        showToast('Account deleted');
        logout();
      } catch (e: any) {
        console.error(e);
        if (e.code === 'auth/requires-recent-login') {
           showToast('Please log out and log back in to delete your account.');
        } else {
           showToast('Error deleting account');
        }
      }
    });
  };

  return (
    <motion.div initial={{ x: 50, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="flex-1 flex flex-col min-h-0 bg-white dark:bg-black absolute inset-0 z-50">
      <header className="flex items-center px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black/90 backdrop-blur-md sticky top-0 z-10 shrink-0">
        <button onClick={() => navigate(-1)} className="mr-3 p-1.5 rounded-full text-zinc-500 dark:text-zinc-500 dark:text-zinc-400 hover:text-black dark:text-white transition-colors"><ChevronLeft size={24} /></button>
        <span className="font-bold text-[15px] text-zinc-900 dark:text-zinc-100">Settings</span>
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-6 flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h3 className="font-bold text-lg mb-2 text-zinc-900 dark:text-zinc-100">Appearance</h3>
          <div className="bg-zinc-100 dark:bg-zinc-900 p-4 rounded-xl flex items-center justify-between">
            <span className="font-medium text-zinc-900 dark:text-zinc-100">Dark Mode</span>
            <button 
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} 
              className="w-12 h-6 bg-zinc-300 dark:bg-indigo-500 rounded-full relative transition-colors shadow-inner"
            >
              <div className="absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform dark:translate-x-6 shadow-sm flex items-center justify-center">
                <Moon size={10} className="text-indigo-500 hidden dark:block" />
                <Sun size={10} className="text-amber-500 block dark:hidden" />
              </div>
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <h3 className="font-bold text-lg mb-2 mt-2 text-zinc-900 dark:text-zinc-100">Account</h3>
          <button 
            onClick={() => setShowVerifyModal(true)}
            disabled={currentUser?.isVerified || currentUser?.verificationStatus === 'pending'}
            className="w-full text-left bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 p-4 rounded-xl font-medium transition-colors disabled:opacity-50"
          >
            {currentUser?.isVerified ? '✓ Account is verified' : currentUser?.verificationStatus === 'pending' ? 'Verification pending...' : 'Apply for verification tick'}
          </button>
          
          <button 
            onClick={handleDeactivate}
            className="w-full text-left bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 p-4 rounded-xl font-medium text-orange-600 transition-colors"
          >
            {currentUser?.deactivated ? 'Reactivate account' : 'Deactivate account'}
          </button>
          <button 
            onClick={handleDelete}
            className="w-full text-left bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 p-4 rounded-xl font-medium text-red-600 transition-colors"
          >
            Delete account
          </button>
          
          {['wwwrakibcom071@gmail.com', 'arbnyt60@gmail.com', 'admin-001@fineword.com'].includes(auth.currentUser?.email || '') && (
            <button 
              onClick={() => navigate('/admin')}
              className="w-full mt-2 text-left bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 p-4 rounded-xl font-bold flex items-center justify-between transition-colors"
            >
              Admin Dashboard
            </button>
          )}

          <button 
            onClick={logout}
            className="w-full mt-4 text-left border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-900 p-4 rounded-xl font-medium flex items-center justify-between transition-colors"
          >
            Log out <LogOut size={18} />
          </button>
        </div>
      </div>
      {showVerifyModal && <VerificationRequestModal onClose={() => setShowVerifyModal(false)} />}
    </motion.div>
  );
};


const FeedScreen = () => {
  const { posts, currentUser, followingIds } = useApp();
  const [tab, setTab] = useState<'foryou' | 'following'>('foryou');
  
  const feedPosts = tab === 'foryou' 
    ? posts 
    : posts.filter(p => p.userId === currentUser?.id || followingIds.includes(p.userId));

  return (
    <div className="flex flex-col min-h-0 h-full">
      <header className="sticky top-0 z-10 bg-white/80 dark:bg-black/80 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800">
        <div className="px-4 pt-3 pb-1">
          <h1 className="font-bold text-xl italic font-sans dark:text-white">FineFeed</h1>
        </div>
        <div className="flex gap-6 px-4 pb-2 mt-1">
          <button onClick={() => setTab('foryou')} className={`font-bold text-sm transition-colors ${tab === 'foryou' ? 'text-black dark:text-white border-b-2 border-black dark:border-white pb-1' : 'text-zinc-500 dark:text-zinc-400 pb-1'}`}>For You</button>
          <button onClick={() => setTab('following')} className={`font-bold text-sm transition-colors ${tab === 'following' ? 'text-black dark:text-white border-b-2 border-black dark:border-white pb-1' : 'text-zinc-500 dark:text-zinc-400 pb-1'}`}>Following</button>
        </div>
      </header>
      <div className="flex-1 overflow-y-auto">
        {feedPosts.map(post => (
          <PostItem key={post.id} post={post} />
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
                     <Link to={`/${u.username}`} key={u.id} className="flex items-center gap-3">
                       <img src={u.avatar || undefined} className="w-10 h-10 rounded-full bg-zinc-200 dark:bg-zinc-800 object-cover" />
                       <div className="flex flex-col"><span className="font-bold text-sm dark:text-white">{u.name}</span><span className="text-zinc-500 text-xs">@{u.username}</span></div>
                     </Link>
                   ))}
                 </div>
               </div>
             )}
             <div className="p-4">
               <h2 className="font-bold text-sm text-zinc-500 mb-3">Posts</h2>
               {filteredPosts.map(p => <PostItem key={p.id} post={p} />)}
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


const AdminDashboardScreen = () => {
  const { posts, showToast, showConfirm } = useApp();
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [tab, setTab] = useState<'overview' | 'verifications' | 'verified' | 'reports' | 'users'>('overview');

  const isAdmin = ['wwwrakibcom071@gmail.com', 'arbnyt60@gmail.com', 'admin-001@fineword.com'].includes(auth.currentUser?.email || '');

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
        const notifId = `sys_${Date.now()}_${Math.floor(Math.random() * 1000000)}`;
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
      
      showToast(`Request ${action} successfully`);
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
    showConfirm(`Ban user ${permanent ? 'permanently' : 'for 7 days'}?`, async () => {
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
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 flex flex-col md:flex-row min-h-0 bg-zinc-50 dark:bg-zinc-950 absolute inset-0 z-50">
      {/* Admin Sidebar (Desktop) */}
      <div className="hidden md:flex w-[280px] shrink-0 bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 flex-col h-full">
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

      {/* Admin Mobile Header */}
      <div className="md:hidden flex flex-col bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
        <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-3">
             <button onClick={() => navigate('/')} className="p-2 -ml-2 text-zinc-500"><ChevronLeft size={24} /></button>
             <h1 className="font-bold text-[16px] text-zinc-900 dark:text-zinc-100 flex items-center gap-2"><Trophy size={18} className="text-indigo-500"/> Admin</h1>
          </div>
        </div>
        <div className="flex overflow-x-auto no-scrollbar px-2 py-2 gap-2">
          {(['overview', 'verifications', 'verified', 'reports', 'users'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn("px-4 py-2 rounded-full text-[13px] font-bold whitespace-nowrap flex items-center gap-1.5 transition-colors", tab === t ? "bg-indigo-500 text-white" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400")}
            >
              <span className="capitalize">{t}</span>
              {t === 'verifications' && pendingRequests.length > 0 && <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full", tab === t ? "bg-white/20 text-white" : "bg-red-500 text-white")}>{pendingRequests.length}</span>}
              {t === 'reports' && pendingReports.length > 0 && <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full", tab === t ? "bg-white/20 text-white" : "bg-amber-500 text-white")}>{pendingReports.length}</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Admin Content Area */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <header className="hidden md:flex h-[72px] shrink-0 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 items-center px-8">
           <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 capitalize">{tab}</h2>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-5xl mx-auto">
            {tab === 'overview' && (
              <div className="flex flex-col gap-8">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                  <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col gap-2">
                    <p className="text-xs md:text-sm font-semibold text-zinc-500 uppercase tracking-wider">Total Users</p>
                    <p className="text-3xl md:text-4xl font-black text-indigo-600 dark:text-indigo-400">{users.length}</p>
                  </div>
                  <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col gap-2">
                    <p className="text-xs md:text-sm font-semibold text-zinc-500 uppercase tracking-wider">Total Posts</p>
                    <p className="text-3xl md:text-4xl font-black text-emerald-600 dark:text-emerald-400">{posts.length}</p>
                  </div>
                  <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col gap-2">
                    <p className="text-xs md:text-sm font-semibold text-zinc-500 uppercase tracking-wider">Pending Verifications</p>
                    <p className="text-3xl md:text-4xl font-black text-rose-600 dark:text-rose-400">{pendingRequests.length}</p>
                  </div>
                  <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col gap-2">
                    <p className="text-xs md:text-sm font-semibold text-zinc-500 uppercase tracking-wider">Pending Reports</p>
                    <p className="text-3xl md:text-4xl font-black text-amber-600 dark:text-amber-400">{pendingReports.length}</p>
                  </div>
                </div>
              </div>
            )}

            {tab === 'verifications' && (
              <div className="flex flex-col gap-4">
                {pendingRequests.map(user => (
                  <div key={user.id} className="p-4 md:p-6 border border-zinc-200 dark:border-zinc-800 rounded-2xl flex flex-col gap-4 md:gap-6 bg-white dark:bg-zinc-900 shadow-sm">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <img src={user.avatar || undefined} className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-zinc-200 dark:bg-zinc-800 object-cover border border-zinc-100 dark:border-zinc-800" />
                        <div className="flex flex-col">
                          <span className="font-bold text-zinc-900 dark:text-zinc-100 text-base md:text-lg">{user.name}</span>
                          <span className="text-zinc-500 dark:text-zinc-500 text-xs md:text-sm font-medium">@{user.username}</span>
                        </div>
                      </div>
                      <div className="flex gap-2 md:gap-3">
                        <button onClick={() => handleAction(user.id, 'accepted')} className="flex-1 md:flex-none bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 md:px-5 md:py-2.5 rounded-xl text-xs md:text-sm font-bold transition-all shadow-sm">Approve</button>
                        <button onClick={() => handleAction(user.id, 'rejected')} className="flex-1 md:flex-none bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 dark:text-rose-400 px-4 py-2 md:px-5 md:py-2.5 rounded-xl text-xs md:text-sm font-bold transition-all">Reject</button>
                      </div>
                    </div>
                    
                    {user.verificationData && (
                      <div className="bg-zinc-50 dark:bg-zinc-950 rounded-xl p-4 md:p-5 border border-zinc-100 dark:border-zinc-800 grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
                        <div><span className="text-zinc-400 block text-[10px] uppercase tracking-wider font-bold mb-1">Full Name</span> <span className="dark:text-zinc-200 font-medium text-xs md:text-sm">{user.verificationData.fullName}</span></div>
                        <div><span className="text-zinc-400 block text-[10px] uppercase tracking-wider font-bold mb-1">Phone</span> <span className="dark:text-zinc-200 font-medium text-xs md:text-sm">{user.verificationData.phoneNumber}</span></div>
                        <div className="col-span-2"><span className="text-zinc-400 block text-[10px] uppercase tracking-wider font-bold mb-1">Address</span> <span className="dark:text-zinc-200 font-medium text-xs md:text-sm">{user.verificationData.address}</span></div>
                        <div><span className="text-zinc-400 block text-[10px] uppercase tracking-wider font-bold mb-1">NID / BID</span> <span className="dark:text-zinc-200 font-medium text-xs md:text-sm">{user.verificationData.nidBid}</span></div>
                        <div><span className="text-zinc-400 block text-[10px] uppercase tracking-wider font-bold mb-1">DOB</span> <span className="dark:text-zinc-200 font-medium text-xs md:text-sm">{user.verificationData.birthDate}</span></div>
                        <div><span className="text-amber-500 block text-[10px] uppercase tracking-wider font-bold mb-1">Nagad Number</span> <span className="dark:text-zinc-200 font-mono text-xs md:text-sm">{user.verificationData.nagadNumber}</span></div>
                        <div><span className="text-amber-500 block text-[10px] uppercase tracking-wider font-bold mb-1">TrxID</span> <span className="dark:text-zinc-200 font-mono text-xs md:text-sm">{user.verificationData.transactionId}</span></div>
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
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                 {verifiedUsers.map(user => (
                   <div key={user.id} className="p-4 md:p-5 border border-zinc-200 dark:border-zinc-800 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-zinc-900 shadow-sm">
                     <div className="flex items-center gap-4">
                       <img src={user.avatar || undefined} className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-zinc-200 dark:bg-zinc-800 object-cover" />
                       <div className="flex flex-col">
                         <span className="font-bold text-zinc-900 dark:text-zinc-100 text-[14px] md:text-[15px] flex items-center gap-1.5">
                           {user.name} <VerifiedBadge isVerified={true} />
                         </span>
                         <span className="text-zinc-500 text-[12px] md:text-[13px] font-medium">@{user.username}</span>
                       </div>
                     </div>
                     <div className="flex items-center justify-between md:justify-end gap-4 w-full md:w-auto">
                       <div className="text-left md:text-right flex flex-col text-[11px] md:text-[12px] font-semibold text-zinc-400">
                         {user.verifiedUntil && (
                           <span className="text-amber-600 dark:text-amber-400">
                             Expires: {user.verifiedUntil?.toDate?.() ? user.verifiedUntil.toDate().toLocaleDateString() : (user.verifiedUntil as Date).toLocaleDateString()}
                           </span>
                         )}
                       </div>
                       <button onClick={() => handleRemoveVerified(user.id)} className="px-3 py-1.5 md:px-4 md:py-2 text-xs md:text-sm font-bold text-rose-600 bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-100 dark:hover:bg-rose-500/20 rounded-xl transition-all">Revoke</button>
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
                     <div key={report.id} className={cn("p-4 md:p-6 border rounded-2xl flex flex-col gap-4 shadow-sm transition-colors", report.status === 'resolved' ? "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900" : "border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-900/10")}>
                       <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                         <div className="flex items-center gap-3">
                           <span className="font-black text-base md:text-lg text-zinc-900 dark:text-zinc-100">Report #{report.id.slice(-6).toUpperCase()}</span>
                           <span className={cn("px-2 py-0.5 md:px-3 md:py-1 rounded-full text-[10px] md:text-[11px] font-black uppercase tracking-wider", report.status === 'resolved' ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400" : "bg-amber-200 text-amber-800 dark:bg-amber-500/20 dark:text-amber-400")}>
                             {report.status}
                           </span>
                         </div>
                         <span className="text-xs md:text-sm font-medium text-zinc-500 dark:text-zinc-400">{formatDistanceToNow(report.createdAt as Date)} ago</span>
                       </div>
                       <div className="text-[14px] md:text-[15px] text-zinc-800 dark:text-zinc-200 bg-white/50 dark:bg-black/20 p-3 md:p-4 rounded-xl">
                         <span className="font-bold block mb-1 text-zinc-500 dark:text-zinc-400 text-[10px] md:text-xs uppercase">Report Reason</span> 
                         {report.reason}
                       </div>
                       {reportedUser && (
                         <div className="flex items-center gap-3 md:gap-4 p-3 md:p-4 bg-white dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800">
                           <img src={reportedUser.avatar || undefined} className="w-10 h-10 md:w-12 md:h-12 rounded-full" />
                           <div className="flex flex-col flex-1">
                             <span className="font-bold text-[14px] md:text-[15px]">{reportedUser.name}</span>
                             <span className="text-[12px] md:text-[13px] text-zinc-500">@{reportedUser.username} • {reportedUser.reportCount || 0} reports</span>
                           </div>
                         </div>
                       )}
                       {report.status !== 'resolved' && (
                         <div className="flex flex-wrap gap-2 md:gap-3 justify-end mt-2">
                           <button onClick={() => handleResolveReport(report.id)} className="px-4 py-2 text-xs md:text-sm font-bold bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl transition-all shadow-sm">Mark Resolved</button>
                           {reportedUser && <button onClick={() => handleBanUser(reportedUser.id, false)} className="px-4 py-2 text-xs md:text-sm font-bold bg-orange-500 hover:bg-orange-600 text-white rounded-xl transition-all shadow-sm">Ban 7 Days</button>}
                           {reportedUser && <button onClick={() => handleBanUser(reportedUser.id, true)} className="px-4 py-2 text-xs md:text-sm font-bold bg-rose-500 hover:bg-rose-600 text-white rounded-xl transition-all shadow-sm">Ban Permanently</button>}
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

const UserProfileScreen = () => {
  const { posts, showToast, currentUser } = useApp();
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [followerIds, setFollowerIds] = useState<string[]>([]);
  const [followingIds, setFollowingIds] = useState<string[]>([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [loadingFollow, setLoadingFollow] = useState(false);

  const [modalType, setModalType] = useState<'followers'|'following'|null>(null);
  const [modalUsers, setModalUsers] = useState<User[]>([]);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('');

  const handleReportUser = async () => {
    if (!currentUser) {
      showToast('Please log in to report.');
      setShowReportModal(false);
      return;
    }
    if (!reportReason.trim() || !user) return;
    try {
      const reportId = `rep_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      await setDoc(doc(db, 'reports', reportId), {
        id: reportId,
        reporterId: currentUser.id,
        reportedUserId: user.id,
        reason: reportReason,
        createdAt: serverTimestamp(),
        status: 'pending'
      });
      
      const newReportCount = (user.reportCount || 0) + 1;
      await updateDoc(doc(db, 'users', user.id), {
        reportCount: newReportCount
      });
      
      if (newReportCount === 5) {
        const notifId = `sys_${Date.now()}_${Math.floor(Math.random() * 1000000)}`;
        await setDoc(doc(db, 'notifications', notifId), {
          id: notifId,
          userId: user.id,
          actorId: 'system',
          type: 'system',
          message: 'Warning: Your account has received multiple reports for violating our guidelines. Further reports may lead to an account ban.',
          read: false,
          createdAt: serverTimestamp()
        });
      }
      
      setShowReportModal(false);
      setReportReason('');
      showToast('Report submitted successfully');
    } catch (e) {
      showToast('Error submitting report');
    }
  };

  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (username) {
      const qUser = query(collection(db, 'users'), where('username', '==', username));
      getDocs(qUser).then(d => {
        if (!d.empty) {
          const u = d.docs[0].data() as User;
          if (u.deactivated && u.id !== currentUser?.id) {
            setNotFound(true);
          } else {
            setUser(u);
            setUserId(u.id);
          }
        } else {
          setNotFound(true);
        }
      });
    }
  }, [username, currentUser?.id]);

  useEffect(() => {
    if (userId) {
      const qFollowers = query(collection(db, 'follows'), orderBy('followerId'));
      const unsubFollowers = onSnapshot(qFollowers, (snap) => {
        const f1: string[] = []; const f2: string[] = []; let isF = false;
        snap.forEach(d => {
          const dt = d.data();
          if (dt.followingId === userId) f1.push(dt.followerId);
          if (dt.followerId === userId) f2.push(dt.followingId);
          if (dt.followingId === userId && dt.followerId === currentUser?.id) isF = true;
        });
        setFollowerIds(f1);
        setFollowingIds(f2);
        setIsFollowing(isF);
      }, (e) => console.error("Follows error B:", e.message));
      return () => unsubFollowers();
    }
  }, [userId, currentUser]);

  const fetchModalUsers = async (type: 'followers'|'following') => {
    setModalType(type);
    const ids = type === 'followers' ? followerIds : followingIds;
    if (ids.length === 0) {
      setModalUsers([]);
      return;
    }
    try {
      const usersSnap = await Promise.all(ids.map(id => getDoc(doc(db, 'users', id))));
      setModalUsers(usersSnap.map(s => s.data() as User).filter(Boolean));
    } catch {
      showToast('Error fetching users');
    }
  };

  const handleFollowToggle = async () => {
    if (!currentUser) {
      showToast('Please log in to follow.');
      return;
    }
    if (!userId || loadingFollow) return;
    setLoadingFollow(true);
    const followId = `${currentUser.id}_${userId}`;
    try {
      if (isFollowing) {
        // Unfollow
        const ref = doc(db, 'follows', followId);
        const { deleteDoc } = await import('firebase/firestore');
        await deleteDoc(ref);
      } else {
        // Follow
        await setDoc(doc(db, 'follows', followId), {
          id: followId,
          followerId: currentUser.id,
          followingId: userId,
          createdAt: serverTimestamp()
        });

        const notifId = `nf_${Date.now()}`;
        await setDoc(doc(db, 'notifications', notifId), {
          id: notifId,
          userId: userId,
          actorId: currentUser.id,
          type: 'follow',
          read: false,
          createdAt: serverTimestamp()
        });
      }
    } catch (e) {
      console.error(e);
      showToast('Error toggling follow');
    }
    setLoadingFollow(false);
  };

  const handleMessage = async () => {
     if (!currentUser) {
         showToast('Please log in to send a message.');
         return;
     }
     if (!userId) return;
     // Check if chat exists
     // Sorting to make consistent chat ID
     const users = [currentUser.id, userId].sort();
     const chatId = `${users[0]}_${users[1]}`;
     try {
       const chatSnap = await getDoc(doc(db, 'chats', chatId));
       if (!chatSnap.exists()) {
           await setDoc(doc(db, 'chats', chatId), {
               id: chatId,
               users,
               lastMessage: '',
               updatedAt: serverTimestamp(),
               seenBy: [currentUser.id]
           });
       }
       navigate(`/chat/${chatId}`);
     } catch (e) {
       console.error(e);
       showToast('Error creating chat');
     }
  };

  if (notFound) return <div className="flex-1 bg-white dark:bg-black flex items-center justify-center text-zinc-500 dark:text-zinc-500 font-bold uppercase tracking-widest text-sm">User Not Found</div>;
  if (!user) return <div className="flex-1 bg-white dark:bg-black flex items-center justify-center"><DecorativeLoader /></div>;

  const userPosts = posts.filter(p => p.userId === userId);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 flex flex-col min-h-0 bg-white dark:bg-black">
      <header className="flex items-center justify-between px-5 py-5 border-b border-zinc-200 dark:border-zinc-800 sticky top-0 bg-white dark:bg-black/90 backdrop-blur-md z-40 shrink-0">
        <button onClick={() => navigate(-1)} className="text-zinc-500 dark:text-zinc-500 dark:text-zinc-400 hover:text-black dark:text-white transition-colors w-6 flex justify-start">
          <ChevronLeft size={24} />
        </button>
        <span className="font-bold text-[15px] tracking-wide text-zinc-900 dark:text-zinc-100">@{user.username} {user.bannedUntil && (user.bannedUntil?.toDate?.() || user.bannedUntil) > new Date() && <span className="text-rose-500 font-bold ml-1 uppercase text-xs">(Banned)</span>}</span>
        {currentUser?.id !== userId ? (
          <button onClick={() => setShowReportModal(true)} className="text-rose-500 hover:text-rose-600 transition-colors bg-rose-50 dark:bg-rose-900/20 p-2 rounded-full flex justify-end">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"></polygon><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
          </button>
        ) : (
          <div className="w-8" />
        )}
      </header>
      
      <div className="flex-1 overflow-y-auto">
        {user.coverPhoto && (
          <div className="w-full h-32 sm:h-48 relative">
            <img src={user.coverPhoto} alt="Cover" className="w-full h-full object-cover" />
          </div>
        )}
        <div className="p-6 flex items-center justify-between">
          <div className="relative shrink-0">
             <img src={user.avatar || undefined} alt="Profile" className="w-20 sm:w-24 h-20 sm:h-24 rounded-full bg-zinc-200 dark:bg-zinc-800 object-cover relative z-10" style={{ marginTop: user.coverPhoto ? '-4rem' : '0' }} />
             <div className="absolute inset-0 rounded-full ring-2 ring-indigo-500/30 ring-offset-4 ring-offset-white dark:ring-offset-black z-10" style={{ marginTop: user.coverPhoto ? '-4rem' : '0' }}></div>
          </div>
          <div className="flex gap-4 sm:gap-7 pr-2 text-center">
            <div className="flex flex-col items-center"><span className="font-bold text-lg sm:text-xl">{userPosts.length}</span><span className="text-[10px] text-zinc-500 dark:text-zinc-500 uppercase tracking-widest mt-1">Posts</span></div>
            <div className="flex flex-col items-center cursor-pointer hover:opacity-70" onClick={() => fetchModalUsers('followers')}><span className="font-bold text-lg sm:text-xl">{followerIds.length}</span><span className="text-[10px] text-zinc-500 dark:text-zinc-500 uppercase tracking-widest mt-1">Followers</span></div>
            <div className="flex flex-col items-center cursor-pointer hover:opacity-70" onClick={() => fetchModalUsers('following')}><span className="font-bold text-lg sm:text-xl">{followingIds.length}</span><span className="text-[10px] text-zinc-500 dark:text-zinc-500 uppercase tracking-widest mt-1">Following</span></div>
          </div>
        </div>
        
        <div className="px-6 pb-6 border-b border-zinc-200 dark:border-zinc-800/50">
          <h2 className="font-bold text-[15px] flex items-center text-zinc-900 dark:text-zinc-100">
            {user.name}
            <VerifiedBadge isVerified={user.isVerified} />
          </h2>
          <p className="text-[14px] mt-2 text-zinc-700 dark:text-zinc-300 leading-relaxed max-w-[90%] break-words">{user.bio}</p>
          
          {!user.hideBadges && user.badges && user.badges.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {user.badges.map(badge => (
                <div key={badge.id} className="flex items-center gap-1.5 bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-900/30 px-2.5 py-1 rounded-full" title={badge.contestTitle}>
                  {badge.icon.startsWith('data:') || badge.icon.startsWith('http') ? (
                    <img src={badge.icon} alt="Badge" className="w-4 h-4 object-cover rounded-sm" />
                  ) : (
                    <span className="text-sm">{badge.icon}</span>
                  )}
                  <span className="text-[11px] font-bold text-yellow-700 dark:text-yellow-500 uppercase tracking-wider">{badge.name}</span>
                </div>
              ))}
            </div>
          )}

          {currentUser?.id !== userId && (
            <div className="mt-6 flex gap-3">
              <button onClick={handleFollowToggle} disabled={loadingFollow} className={cn("flex-1 py-2.5 rounded-xl text-[12px] uppercase tracking-widest font-bold transition-all text-center", isFollowing ? 'bg-zinc-200 dark:bg-zinc-800 text-black dark:text-white hover:bg-zinc-300 dark:hover:bg-zinc-300 dark:bg-zinc-300 dark:bg-zinc-700' : 'bg-indigo-600 hover:bg-indigo-500 text-black dark:text-white')}>
                 {isFollowing ? 'Following' : 'Follow'}
              </button>
              <button onClick={handleMessage} className="flex-1 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-800 py-2.5 rounded-xl text-[12px] text-black dark:text-white uppercase tracking-widest font-bold transition-all text-center">Message</button>
              <button onClick={() => {
                const url = `${window.location.origin}/${user.username}`;
                navigator.clipboard.writeText(url).then(() => showToast('Profile link copied!'));
              }} className="flex-1 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-800 py-2.5 rounded-xl text-[12px] text-black dark:text-white uppercase tracking-widest font-bold transition-all text-center">Share</button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-0.5 sm:gap-1 p-0.5 sm:px-1 bg-white dark:bg-black">
          <AnimatePresence mode="popLayout">
            {userPosts.length === 0 ? (
              <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="col-span-3 py-16 flex flex-col items-center justify-center text-zinc-500 dark:text-zinc-500 bg-zinc-100 dark:bg-zinc-900/30 rounded-xl m-4 border border-zinc-200 dark:border-zinc-800/50 block">
                <ImageIcon size={48} className="mb-4 opacity-40" />
                <p className="text-[13px] font-medium">No posts compiled yet</p>
              </motion.div>
            ) : (
              userPosts.map(post => (
                <motion.div layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ duration: 0.3 }} key={post.id} className="pt-[100%] bg-zinc-100 dark:bg-zinc-900 relative group cursor-pointer overflow-hidden border border-zinc-200 dark:border-zinc-800" onClick={() => navigate(`/post/${post.id}/comments`)}>
                  {post.imageUrl ? (
                    <>
                      <img src={post.imageUrl || undefined} alt="" className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      <div className="absolute inset-0 bg-transparent group-hover:bg-black/10 dark:group-hover:bg-white/10 transition-colors" />
                    </>
                  ) : post.videoUrl ? (
                    <>
                      <ChunkedVideoPlayer videoUrl={post.videoUrl} postId={post.id} className="absolute inset-0 w-full h-full object-cover pointer-events-none group-hover:scale-105 transition-transform duration-500" />
                      <div className="absolute inset-0 bg-transparent group-hover:bg-black/10 dark:group-hover:bg-white/10 transition-colors" />
                      <div className="absolute top-1 right-1 bg-black/50 rounded p-1">
                         <Video size={12} className="text-white" />
                      </div>
                    </>
                  ) : (
                    <div className={cn("absolute inset-0 flex items-center justify-center p-2 text-center text-[10px] sm:text-xs font-medium overflow-hidden break-words", post.isItalic && "italic")}>{formatTextHighlight(post.caption)}</div>
                  )}
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>
      </div>
      <FollowListModal isOpen={modalType !== null} onClose={() => setModalType(null)} title={modalType === 'followers' ? 'Followers' : 'Following'} users={modalUsers} />
      
      {showReportModal && (
        <div className="fixed inset-0 bg-white dark:bg-transparent/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-950 w-full max-w-sm rounded-[24px] p-6 flex flex-col gap-5 border border-zinc-200 dark:border-zinc-800 shadow-2xl relative">
            <button onClick={() => setShowReportModal(false)} className="absolute top-4 right-4 p-2 text-zinc-500 hover:text-black dark:text-zinc-500 dark:text-zinc-400 dark:hover:text-white transition-colors bg-zinc-100 dark:bg-zinc-900 rounded-full">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 dark:bg-rose-900/30 text-rose-500 flex items-center justify-center shrink-0">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
              </div>
              <div>
                <h3 className="text-[17px] font-bold text-zinc-900 dark:text-zinc-100">Report User</h3>
                <p className="text-zinc-500 dark:text-zinc-500 text-[13px] font-medium leading-snug tracking-wide mt-0.5">Help us keep the community safe.</p>
              </div>
            </div>
            
            <textarea 
              value={reportReason} 
              onChange={e => setReportReason(e.target.value)} 
              placeholder="Please describe why you are reporting this user..."
              className="mt-2 text-[14px] bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 outline-none min-h-[100px] resize-none text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500 dark:text-zinc-500 dark:text-zinc-400"
            />
            
            <button onClick={handleReportUser} disabled={!reportReason.trim()} className="mt-2 bg-rose-500 hover:bg-rose-600 active:bg-rose-700 disabled:opacity-50 text-black dark:text-white font-bold text-[14px] py-3.5 rounded-xl transition-all shadow-md shadow-rose-500/20 w-full tracking-wide">
              Submit Report
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
};

const ProfileScreen = () => {
  const { posts, showToast, currentUser, logout, theme, setTheme } = useApp();
  const navigate = useNavigate();
  const myPosts = posts.filter(p => p.userId === currentUser?.id);
  const [followerIds, setFollowerIds] = useState<string[]>([]);
  const [followingIds, setFollowingIds] = useState<string[]>([]);
  const [modalType, setModalType] = useState<'followers'|'following'|null>(null);
  const [modalUsers, setModalUsers] = useState<User[]>([]);

  useEffect(() => {
    if (currentUser?.id) {
       const qFollowers = query(collection(db, 'follows'), orderBy('followerId'));
       const unsubFollowers = onSnapshot(qFollowers, (snap) => {
         const f1: string[] = []; const f2: string[] = [];
         snap.forEach(d => {
           const dt = d.data();
           if (dt.followingId === currentUser.id) f1.push(dt.followerId);
           if (dt.followerId === currentUser.id) f2.push(dt.followingId);
         });
         setFollowerIds(f1);
         setFollowingIds(f2);
       }, (e) => console.error("Follows error A:", e.message));
       return () => unsubFollowers();
    }
  }, [currentUser]);

  const fetchModalUsers = async (type: 'followers'|'following') => {
    setModalType(type);
    const ids = type === 'followers' ? followerIds : followingIds;
    if (ids.length === 0) {
      setModalUsers([]);
      return;
    }
    try {
      const usersSnap = await Promise.all(ids.map(id => getDoc(doc(db, 'users', id))));
      setModalUsers(usersSnap.map(s => s.data() as User).filter(Boolean));
    } catch {
      showToast('Error fetching users');
    }
  };

  if (!currentUser) return null;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 flex flex-col min-h-0 bg-white dark:bg-black">
      <header className="flex items-center justify-between px-5 py-5 border-b border-zinc-200 dark:border-zinc-800 sticky top-0 bg-white dark:bg-black/90 backdrop-blur-md z-40 shrink-0">
        <button 
          onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} 
          className="text-zinc-700 dark:text-zinc-300 hover:text-black dark:hover:text-white transition-colors w-6 flex justify-start"
        >
          {theme === 'light' ? <Moon size={22} /> : <Sun size={22} />}
        </button>
        <span className="font-bold text-[15px] tracking-wide text-zinc-900 dark:text-zinc-100">@{currentUser.username}</span>
        <button onClick={() => navigate('/settings')} className="text-zinc-500 dark:text-zinc-500 hover:text-black dark:hover:text-white transition-colors w-6 flex justify-end">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
        </button>
      </header>
      
      <div className="flex-1 overflow-y-auto">
        {currentUser.coverPhoto && (
          <div className="w-full h-32 sm:h-48 relative">
            <img src={currentUser.coverPhoto} alt="Cover" className="w-full h-full object-cover" />
          </div>
        )}
        <div className="p-6 flex items-center justify-between">
          <div className="relative shrink-0">
             <img src={currentUser.avatar || undefined} alt="Profile" className="w-20 sm:w-24 h-20 sm:h-24 rounded-full bg-zinc-200 dark:bg-zinc-800 object-cover relative z-10" style={{ marginTop: currentUser.coverPhoto ? '-4rem' : '0' }} />
             <div className="absolute inset-0 rounded-full ring-2 ring-indigo-500/30 ring-offset-4 ring-offset-white dark:ring-offset-black z-10" style={{ marginTop: currentUser.coverPhoto ? '-4rem' : '0' }}></div>
          </div>
          <div className="flex gap-4 sm:gap-7 pr-2 text-center">
            <div className="flex flex-col items-center"><span className="font-bold text-lg sm:text-xl">{myPosts.length}</span><span className="text-[10px] text-zinc-500 dark:text-zinc-500 uppercase tracking-widest mt-1">Posts</span></div>
            <div className="flex flex-col items-center cursor-pointer hover:opacity-70" onClick={() => fetchModalUsers('followers')}><span className="font-bold text-lg sm:text-xl">{followerIds.length}</span><span className="text-[10px] text-zinc-500 dark:text-zinc-500 uppercase tracking-widest mt-1">Followers</span></div>
            <div className="flex flex-col items-center cursor-pointer hover:opacity-70" onClick={() => fetchModalUsers('following')}><span className="font-bold text-lg sm:text-xl">{followingIds.length}</span><span className="text-[10px] text-zinc-500 dark:text-zinc-500 uppercase tracking-widest mt-1">Following</span></div>
          </div>
        </div>
        
        <div className="px-6 pb-6 border-b border-zinc-200 dark:border-zinc-800/50">
          <h2 className="font-bold text-[15px] flex items-center text-zinc-900 dark:text-zinc-100">
            {currentUser.name}
            <VerifiedBadge isVerified={currentUser.isVerified} />
          </h2>
          <p className="text-[14px] mt-2 text-zinc-700 dark:text-zinc-300 leading-relaxed max-w-[90%] break-words">{currentUser.bio}</p>

          {!currentUser.hideBadges && currentUser.badges && currentUser.badges.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {currentUser.badges.map(badge => (
                <div key={badge.id} className="flex items-center gap-1.5 bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-900/30 px-2.5 py-1 rounded-full" title={badge.contestTitle}>
                  {badge.icon.startsWith('data:') || badge.icon.startsWith('http') ? (
                    <img src={badge.icon} alt="Badge" className="w-4 h-4 object-cover rounded-sm" />
                  ) : (
                    <span className="text-sm">{badge.icon}</span>
                  )}
                  <span className="text-[11px] font-bold text-yellow-700 dark:text-yellow-500 uppercase tracking-wider">{badge.name}</span>
                </div>
              ))}
            </div>
          )}

          <div className="mt-6 flex gap-3">
            <button onClick={() => navigate('/profile/edit')} className="flex-1 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-200 dark:bg-zinc-800 py-2.5 rounded-xl text-[12px] uppercase tracking-widest font-bold transition-all text-center text-zinc-700 dark:text-zinc-300 hover:text-black dark:text-white">Edit profile</button>
            <button onClick={() => {
              const url = `${window.location.origin}/${currentUser.username}`;
              navigator.clipboard.writeText(url).then(() => showToast('Profile link copied!'));
            }} className="flex-1 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-200 dark:bg-zinc-800 py-2.5 rounded-xl text-[12px] uppercase tracking-widest font-bold transition-all text-center text-zinc-700 dark:text-zinc-300 hover:text-black dark:text-white">Share profile</button>
            <button onClick={() => navigate('/settings')} className="bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-200 dark:bg-zinc-800 px-4 py-2.5 rounded-xl transition-all text-zinc-700 dark:text-zinc-300 hover:text-black dark:text-white">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-0.5 sm:gap-1 p-0.5 sm:px-1 bg-white dark:bg-black">
          <AnimatePresence mode="popLayout">
            {myPosts.length === 0 ? (
              <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="col-span-3 py-16 flex flex-col items-center justify-center text-zinc-500 dark:text-zinc-500 bg-zinc-100 dark:bg-zinc-900/30 rounded-xl m-4 border border-zinc-200 dark:border-zinc-800/50 block">
                <ImageIcon size={48} className="mb-4 opacity-40" />
                <p className="text-[13px] font-medium">No posts compiled yet</p>
              </motion.div>
            ) : (
              myPosts.map(post => (
                <motion.div layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ duration: 0.3 }} key={post.id} className="pt-[100%] bg-zinc-100 dark:bg-zinc-900 relative group cursor-pointer overflow-hidden border border-zinc-200 dark:border-zinc-800" onClick={() => navigate(`/post/${post.id}/comments`)}>
                  {post.imageUrl ? (
                    <>
                      <img src={post.imageUrl || undefined} alt="" className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      <div className="absolute inset-0 bg-transparent group-hover:bg-black/10 dark:group-hover:bg-white/10 transition-colors" />
                    </>
                  ) : post.videoUrl ? (
                    <>
                      <ChunkedVideoPlayer videoUrl={post.videoUrl} postId={post.id} className="absolute inset-0 w-full h-full object-cover pointer-events-none group-hover:scale-105 transition-transform duration-500" />
                      <div className="absolute inset-0 bg-transparent group-hover:bg-black/10 dark:group-hover:bg-white/10 transition-colors" />
                      <div className="absolute top-1 right-1 bg-black/50 rounded p-1">
                         <Video size={12} className="text-white" />
                      </div>
                    </>
                  ) : (
                    <div className={cn("absolute inset-0 flex items-center justify-center p-2 text-center text-[10px] sm:text-xs font-medium overflow-hidden break-words", post.isItalic && "italic")}>{formatTextHighlight(post.caption)}</div>
                  )}
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>
      </div>
      <FollowListModal isOpen={modalType !== null} onClose={() => setModalType(null)} title={modalType === 'followers' ? 'Followers' : 'Following'} users={modalUsers} />
    </motion.div>
  );
};

// --- APP ROOT ------ APP ROOT ---

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { currentUser } = useApp();
  if (!currentUser) {
    return <AuthScreen />;
  }
  return <>{children}</>;
};

const AuthScreen = () => {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [loginInput, setLoginInput] = useState('');
  const [password, setPassword] = useState('');

  const handleGoogleLogin = async (useRedirect = false) => {
    setLoading(true);
    setErrorMsg('');
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({
      prompt: 'select_account'
    });
    try {
      if (useRedirect) {
        const { signInWithRedirect } = await import('firebase/auth');
        await signInWithRedirect(auth, provider);
      } else {
        await signInWithPopup(auth, provider);
      }
    } catch (e: any) {
      setLoading(false);
      if (e.code === 'auth/popup-closed-by-user') {
        // User closed popup, just show a message, no need to log as an error
        setErrorMsg('Login popup was closed before completing. Please try again.');
      } else {
        console.error(e);
        if (e.code === 'auth/unauthorized-domain') {
          setErrorMsg('This domain is not authorized. Please add your Vercel domain to Firebase Console -> Authentication -> Settings -> Authorized domains.');
        } else {
          setErrorMsg(e.message || 'Failed to sign in. Please try again.');
        }
      }
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
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
      finalEmail = `${loginInput.toLowerCase()}@fineword.local`;
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
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-white dark:bg-black p-6 h-full relative z-[200]">
      <h1 className="text-4xl font-bold italic text-black dark:text-white mb-2 font-sans tracking-tight">FineFeed</h1>
      <p className="text-zinc-500 dark:text-zinc-500 dark:text-zinc-400 mb-8 text-center max-w-[260px] text-[14px] leading-relaxed">
        {isSignUp ? 'Create an account to start sharing moments.' : 'Sign in to connect with friends and share moments instantly.'}
      </p>
      
      {errorMsg && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-xl text-center max-w-[280px]">
          {errorMsg}
        </div>
      )}

      <div className="w-full max-w-[280px] flex flex-col gap-4">
        <form onSubmit={handleEmailAuth} className="flex flex-col gap-3">
          <input
            type="text"
            placeholder="Email or Username"
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
        </form>

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
          </svg>
          Google
        </button>

        <button 
          onClick={() => setIsSignUp(!isSignUp)} 
          disabled={loading} 
          className="w-full bg-transparent text-zinc-500 dark:text-zinc-500 font-medium py-2 rounded-xl text-[12px] hover:text-zinc-700 dark:hover:text-zinc-700 dark:text-zinc-700 dark:text-zinc-300 transition-colors disabled:opacity-50 mt-2"
        >
          {isSignUp ? 'Already have an account? Sign In' : 'Need an account? Sign Up'}
        </button>
      </div>
    </div>
  );
};

const RightSidebar = () => {
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
  );};

import { CallManager, startCall } from './CallManager';
export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [posts, setPosts] = useState<Post[]>(INITIAL_POSTS);
  const [chats, setChats] = useState<Chat[]>(INITIAL_CHATS);
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [followingIds, setFollowingIds] = useState<string[]>([]);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [deactivatedUserIds, setDeactivatedUserIds] = useState<string[]>([]);
  const [confirmDialog, setConfirmDialog] = useState<{ message: string, onConfirm: () => void } | null>(null);

  const showConfirm = (message: string, onConfirm: () => void) => {
    setConfirmDialog({ message, onConfirm });
  };

  useEffect(() => {
    const qDeactivated = query(collection(db, 'users'), where('deactivated', '==', true));
    const unsub = onSnapshot(qDeactivated, snap => {
      const ids: string[] = [];
      snap.forEach(d => ids.push(d.id));
      setDeactivatedUserIds(ids);
    }, e => console.error("Deactivated users fetch error:", e.message));
    return () => unsub();
  }, []);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    
    let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    
    if (theme === 'dark') {
      link.href = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23000'/%3E%3Ctext x='50' y='50' font-family='Arial, sans-serif' font-size='18' font-weight='900' font-style='italic' fill='%23fff' text-anchor='middle' dominant-baseline='central'%3Ertyrtyrt%3C/text%3E%3C/svg%3E";
    } else {
      link.href = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23fff'/%3E%3Ctext x='50' y='50' font-family='Arial, sans-serif' font-size='26' font-weight='900' font-style='italic' fill='%23000' text-anchor='middle' dominant-baseline='central'%3E5e5%3C/text%3E%3C/svg%3E";
    }
  }, [theme]);

  useEffect(() => {
    return onAuthStateChanged(auth, async (user: FirebaseUser | null) => {
      if (user) {
        const userRef = doc(db, 'users', user.uid);
        try {
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            const userData = userSnap.data() as User;
            if (userData.deactivated) {
               showToast('This account is currently deactivated. You can reactivate it in Settings.');
            }
            setCurrentUser(userData);
            if (userData.theme && (userData.theme === 'light' || userData.theme === 'dark')) {
              setTheme(userData.theme);
            }
          } else {
            let baseUsername = user.email?.split('@')[0] || 'user';
            baseUsername = baseUsername.toLowerCase();
            let finalUsername = baseUsername;
            let counter = 1;
            
            while (true) {
                const qUser = query(collection(db, 'users'), where('username', '==', finalUsername));
                const userDocs = await getDocs(qUser);
                if (userDocs.empty) {
                    break;
                }
                finalUsername = `${baseUsername}${counter}`;
                counter++;
            }
            
            const newUser: User = {
              id: user.uid,
              username: finalUsername,
              name: user.displayName || 'User',
              avatar: user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`,
              bio: 'Welcome to FineFeed'
            };
            await setDoc(userRef, newUser);
            setCurrentUser(newUser);
          }
        } catch (e) {
          console.error("Error fetching user profile:", e);
          setCurrentUser({
            id: user.uid,
            username: user.email?.split('@')[0] || 'user',
            name: user.displayName || 'User',
            avatar: user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`,
            bio: 'Welcome to FineFeed'
          });
        }
      } else {
        setCurrentUser(null);
      }
      setIsAuthChecking(false);
    });
  }, []);

  // Heartbeat for online status
  useEffect(() => {
    if (!currentUser) return;
    const updateActiveStatus = async () => {
      try {
        await updateDoc(doc(db, 'users', currentUser.id), {
          lastActive: serverTimestamp()
        });
      } catch (e) {}
    };
    
    updateActiveStatus();
    const interval = setInterval(updateActiveStatus, 60 * 1000); // 1 minute
    
    const handleFocus = () => updateActiveStatus();
    window.addEventListener('focus', handleFocus);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [currentUser?.id]);

  useEffect(() => {
    const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const dbPosts: Post[] = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        if (!deactivatedUserIds.includes(data.userId) || currentUser?.id === data.userId) {
          dbPosts.push({
            ...data,
            id: doc.id,
            createdAt: data.createdAt?.toDate?.() || new Date(),
          } as Post);
        }
      });
      setPosts(dbPosts);
    }, (error) => {
      console.error("Posts fetch error:", error.message);
    });
    return unsubscribe;
  }, [deactivatedUserIds, currentUser?.id]);

  useEffect(() => {
    if (!currentUser) {
      setChats([]);
      return;
    }
    const q = query(collection(db, 'chats'), where('users', 'array-contains', currentUser.id));
    const unsub = onSnapshot(q, snap => {
      const dbChats: Chat[] = [];
      snap.forEach(d => {
        const data = d.data();
        dbChats.push({
          ...data,
          id: d.id,
          updatedAt: data.updatedAt?.toDate?.() || new Date()
        } as Chat);
      });
      setChats(dbChats.sort((a,b) => b.updatedAt.getTime() - a.updatedAt.getTime()));
    }, error => console.error("Chats fetch error:", error.message));
    return () => unsub();
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) {
      setNotifications([]);
      setFollowingIds([]);
      return;
    }
    const qNotif = query(collection(db, 'notifications'), where('userId', '==', currentUser.id), orderBy('createdAt', 'desc'));
    const unsubNotif = onSnapshot(qNotif, snap => {
      const notes: Notification[] = [];
      snap.forEach(d => {
        const data = d.data();
        notes.push({
          ...data,
          id: d.id,
          createdAt: data.createdAt?.toDate?.() || new Date()
        } as Notification);
      });
      setNotifications(notes);
    }, e => console.error("Notifs error:", e.message));

    const qFollows = query(collection(db, 'follows'), where('followerId', '==', currentUser.id));
    const unsubFollows = onSnapshot(qFollows, snap => {
      const follows: string[] = [];
      snap.forEach(d => follows.push(d.data().followingId));
      setFollowingIds(follows);
    }, e => console.error("Follows error:", e.message));

    return () => { unsubNotif(); unsubFollows(); };
  }, [currentUser]);

  const updateProfile = async (updates: Partial<User>) => {
    if (!currentUser) return;
    const oldProfile = { ...currentUser };
    const newProfile = { ...currentUser, ...updates };
    setCurrentUser(newProfile);
    try {
      const firestoreUpdates = { ...updates };
      Object.keys(firestoreUpdates).forEach(key => {
        if (firestoreUpdates[key as keyof typeof firestoreUpdates] === undefined) {
          delete firestoreUpdates[key as keyof typeof firestoreUpdates];
        }
      });
      await updateDoc(doc(db, 'users', currentUser.id), firestoreUpdates);
    } catch (e) {
      console.error("Error updating profile", e);
      setCurrentUser(oldProfile); // Revert
      throw e;
    }
  };

  const logout = async () => {
    await signOut(auth);
  };

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const toggleLike = async (postId: string) => {
    if (!currentUser) {
      showToast('Please log in to like a post.');
      return;
    }
    const post = posts.find(p => p.id === postId);
    if (!post) return;
    
    // Optimistic UI update
    const isLiked = post.likedBy.includes(currentUser.id);
    const newLikedBy = isLiked ? post.likedBy.filter(id => id !== currentUser.id) : [...post.likedBy, currentUser.id];
    setPosts(prev => prev.map(p => {
      if (p.id === postId) {
        return { ...p, likedBy: newLikedBy, likes: newLikedBy.length };
      }
      return p;
    }));

    try {
      await updateDoc(doc(db, 'posts', postId), {
        likes: newLikedBy.length,
        likedBy: newLikedBy
      });
      if (!isLiked && post.userId !== currentUser.id) {
        const notifId = `n_${Date.now()}`;
        await setDoc(doc(db, 'notifications', notifId), {
          id: notifId,
          userId: post.userId,
          actorId: currentUser.id,
          type: 'like',
          postId: post.id,
          read: false,
          createdAt: serverTimestamp()
        });
      }
    } catch (e) {
      console.error("Error toggling like", e);
      showToast('Error liking post');
      // Revert in real app
    }
  };

  const sendMessage = async (chatId: string, text: string, imageUrl?: string, videoUrl?: string) => {
    if (!currentUser) return;
    const msgId = `m${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    
    let finalVideoUrl = videoUrl;
    
    try {
      if (videoUrl && videoUrl.length > 500000) {
        const CHUNK_SIZE = 800000;
        const chunks = [];
        for (let i = 0; i < videoUrl.length; i += CHUNK_SIZE) {
          chunks.push(videoUrl.slice(i, i + CHUNK_SIZE));
        }
        
        await Promise.all(chunks.map((chunkStr, idx) => {
          return setDoc(doc(collection(db, 'video_chunks')), {
            postId: msgId,
            chunkIndex: idx,
            data: chunkStr,
            createdAt: serverTimestamp()
          });
        }));
        finalVideoUrl = 'chunked';
      }

      const newMsg: any = {
        id: msgId,
        chatId,
        senderId: currentUser.id,
        text: text || '',
        createdAt: serverTimestamp(),
      };
      if (imageUrl) newMsg.imageUrl = imageUrl;
      if (finalVideoUrl) newMsg.videoUrl = finalVideoUrl;

      await setDoc(doc(db, `chats/${chatId}/messages`, msgId), newMsg);
      await updateDoc(doc(db, 'chats', chatId), {
        lastMessage: text || (imageUrl ? 'Sent an image' : (finalVideoUrl ? 'Sent a video' : '')),
        updatedAt: serverTimestamp(),
        seenBy: [currentUser.id]
      });
    } catch (e) {
      console.error(e);
      showToast('Error sending message');
    }
  };

  const deleteMessage = async (chatId: string, msgId: string) => {
    if (!currentUser) return;
    try {
      await updateDoc(doc(db, `chats/${chatId}/messages`, msgId), {
        isDeleted: true,
        text: 'This message was deleted.',
        imageUrl: null,
        videoUrl: null
      });
    } catch (e) {
      console.error(e);
      showToast('Error deleting message');
    }
  };

  const updatePost = async (postId: string, newCaption: string) => {
    try {
      await updateDoc(doc(db, 'posts', postId), { caption: newCaption });
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, caption: newCaption } : p));
    } catch (e) {
      console.error("Error updating post", e);
      showToast('Error updating post');
    }
  };

  const deletePost = async (postId: string) => {
    try {
      await deleteDoc(doc(db, 'posts', postId));
      setPosts(prev => prev.filter(p => p.id !== postId));
    } catch (e) {
      console.error("Error deleting post", e);
      showToast('Error deleting post');
    }
  };

  const deleteChat = async (chatId: string) => {
    try {
      await deleteDoc(doc(db, 'chats', chatId));
      // Optionally delete nested collections or assume standard cascade/cron
      setChats(prev => prev.filter(c => c.id !== chatId));
      showToast('Chat deleted');
    } catch (e) {
      console.error("Error deleting chat", e);
      showToast('Error deleting chat');
    }
  };

  const removeGroupMember = async (chatId: string, userIdToRemove: string) => {
    try {
      const chatRef = doc(db, 'chats', chatId);
      const chatDoc = await getDoc(chatRef);
      if (chatDoc.exists()) {
        const u = chatDoc.data().users || [];
        const newU = u.filter((id: string) => id !== userIdToRemove);
        await updateDoc(chatRef, { users: newU });
        showToast('Member removed');
      }
    } catch(e) {
      console.error("Error removing member", e);
      showToast('Error removing member');
    }
  };

  const updateTheme = async (newTheme: 'light' | 'dark') => {
    setTheme(newTheme);
    if (currentUser) {
      try {
        await updateDoc(doc(db, 'users', currentUser.id), { theme: newTheme });
        setCurrentUser(prev => prev ? { ...prev, theme: newTheme } : prev);
      } catch (e) {
        console.error("Error saving theme", e);
      }
    }
  };

  return (
    <AppContext.Provider value={{ currentUser, logout, updateProfile, posts, setPosts, updatePost, deletePost, deleteChat, removeGroupMember, chats, messages, setMessages, notifications, followingIds, toggleLike, sendMessage, deleteMessage, showToast, showConfirm, theme, setTheme: updateTheme }}>
      <div className="min-h-[100dvh] h-[100dvh] bg-white dark:bg-black text-black dark:text-white font-sans flex justify-center w-full">
        <div className="w-full h-full max-w-7xl bg-white dark:bg-black relative flex flex-col overflow-hidden">
          
          <AnimatePresence>
            {toastMsg && (
              <motion.div
                initial={{ opacity: 0, y: -20, x: '-50%' }}
                animate={{ opacity: 1, y: 0, x: '-50%' }}
                exit={{ opacity: 0, y: -20, x: '-50%' }}
                className="absolute top-12 left-1/2 z-[200] bg-zinc-200 dark:bg-zinc-800 text-black dark:text-white text-[13px] font-bold tracking-wide px-4 py-2 rounded-full shadow-lg border border-zinc-700 whitespace-nowrap"
              >
                {toastMsg}
              </motion.div>
            )}
            
            {confirmDialog && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[250] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: 20 }}
                  className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-2xl max-w-[320px] w-full flex flex-col items-center text-center relative overflow-hidden"
                >
                  <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-4 text-red-500">
                    <AlertTriangle size={24} />
                  </div>
                  <h3 className="font-bold text-lg text-zinc-900 dark:text-zinc-100 mb-2">Are you sure?</h3>
                  <p className="text-zinc-500 text-[14px] font-medium mb-6 leading-relaxed">
                    {confirmDialog.message}
                  </p>
                  <div className="flex gap-3 w-full">
                    <button
                      onClick={() => setConfirmDialog(null)}
                      className="flex-1 py-3 rounded-2xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-100 font-bold text-[14px] transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        confirmDialog.onConfirm();
                        setConfirmDialog(null);
                      }}
                      className="flex-1 py-3 rounded-2xl bg-red-500 hover:bg-red-600 text-white font-bold text-[14px] shadow-lg shadow-red-500/20 transition-all active:scale-95"
                    >
                      Confirm
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
          
          {isAuthChecking ? (
            <div className="flex-1 flex justify-center items-center bg-white dark:bg-black"><DecorativeLoader /></div>
          ) : (
            <BrowserRouter>
              <Routes>
                <Route path="/admin" element={<ProtectedRoute><AdminDashboardScreen /></ProtectedRoute>} />
                <Route path="/*" element={
                  <div className="flex-1 flex flex-col md:flex-row min-h-0 relative w-full h-full justify-center">
                    <div className="hidden md:flex flex-col w-[80px] lg:w-[240px] shrink-0 border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black relative z-40">
                       <SideNav />
                    </div>
                    <div className="flex-1 flex flex-col min-h-0 relative w-full max-w-[600px] pt-safe sm:border-x border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black">
                      <AnimatePresence mode="wait">
                        <Routes>
                          <Route path="/" element={<FeedScreen />} />
                          <Route path="/notifications" element={<ProtectedRoute><NotificationsScreen /></ProtectedRoute>} />
                          <Route path="/search" element={<ProtectedRoute><SearchScreen /></ProtectedRoute>} />
                          <Route path="/create" element={<ProtectedRoute><CreatePostScreen /></ProtectedRoute>} />
                          <Route path="/contests" element={<ProtectedRoute><ContestsScreen /></ProtectedRoute>} />
                          <Route path="/contest/:id" element={<ProtectedRoute><ContestDetailScreen /></ProtectedRoute>} />
                          <Route path="/chat" element={<ProtectedRoute><ChatListScreen /></ProtectedRoute>} />
                          <Route path="/chat/group/create" element={<ProtectedRoute><CreateGroupChatScreen /></ProtectedRoute>} />
                          <Route path="/chat/:id" element={<ProtectedRoute><ChatRoomScreen /></ProtectedRoute>} />
                          <Route path="/post/:postId/comments" element={<ProtectedRoute><CommentsScreen /></ProtectedRoute>} />
                          <Route path="/profile" element={<ProtectedRoute><ProfileScreen /></ProtectedRoute>} />
                          <Route path="/profile/edit" element={<ProtectedRoute><EditProfileScreen /></ProtectedRoute>} />
                          <Route path="/settings" element={<ProtectedRoute><SettingsScreen /></ProtectedRoute>} />
                          <Route path="/:username" element={<ProtectedRoute><UserProfileScreen /></ProtectedRoute>} />
                        </Routes>
                      </AnimatePresence>
                    </div>
                    <div className="hidden lg:block w-[300px] shrink-0 border-l border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black relative z-40">
                      <RightSidebar />
                    </div>
                    <div className="md:hidden shrink-0 absolute bottom-0 left-0 right-0 z-50">
                      <BottomNav />
                    </div>
                  </div>
                } />
              </Routes>
              <CallManager />
            </BrowserRouter>
          )}
        </div>
      </div>
    </AppContext.Provider>
  );
}
