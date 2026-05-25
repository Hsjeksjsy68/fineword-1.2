/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useNavigate, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { Home, MessageCircle, User as UserIcon, Heart, Send, PlusSquare, Image as ImageIcon, ChevronLeft, MoreHorizontal, LogOut, Search, Moon, Sun, Share2, Music, Type, Palette, Check, BarChart2, X, Trophy, Settings } from 'lucide-react';
import { formatDistanceToNow, format, isSameDay } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { db, auth } from './firebase';
import { doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, collection, onSnapshot, query, orderBy, serverTimestamp, Timestamp, where } from 'firebase/firestore';
import { signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged, User as FirebaseUser, deleteUser, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';

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
          resolve(canvas.toDataURL('image/webp', 0.8));
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
  appThemeParams?: {
    feedColor: string;
    postBgColor: string;
  };
};

export type Contest = {
  id: string;
  hostId: string;
  title: string;
  description: string;
  badgeName: string;
  badgeIcon: string;
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
  user1Votes: string[];
  user2Votes: string[];
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
  imageUrl: string;
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
  theme: 'light' | 'dark';
  setTheme: (t: 'light' | 'dark') => void;
}

export const AppContext = React.createContext<AppState | null>(null);
export const useApp = () => React.useContext(AppContext)!;

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
            <Link key={item.path} to={item.path} className={cn("flex flex-row items-center gap-4 p-3 rounded-xl transition-all group", isActive ? "font-bold" : "hover:bg-zinc-100 dark:hover:bg-zinc-100 dark:bg-zinc-100 dark:bg-zinc-900")}>
              <div className="relative flex items-center justify-center lg:justify-start w-full">
                <Icon size={26} className={cn("transition-transform group-hover:scale-105", isActive ? "text-indigo-600 dark:text-indigo-400" : "text-zinc-800 dark:text-zinc-800 dark:text-zinc-800 dark:text-zinc-200 group-hover:text-black dark:group-hover:text-black dark:text-white")} />
                {!!item.badgeCount && item.badgeCount > 0 && (
                  <div className="absolute -top-1.5 right-[calc(50%-22px)] lg:right-auto lg:left-4 h-[18px] min-w-[18px] px-1 bg-red-500 rounded-full border border-white dark:border-black flex items-center justify-center text-[10px] font-bold text-black dark:text-white shadow-sm">
                    {item.badgeCount > 99 ? '99+' : item.badgeCount}
                  </div>
                )}
                <span className={cn("hidden lg:block ml-4 text-[16px]", isActive ? "text-indigo-600 dark:text-indigo-400" : "text-zinc-800 dark:text-zinc-800 dark:text-zinc-800 dark:text-zinc-200 group-hover:text-black dark:group-hover:text-black dark:text-white")}>{item.label}</span>
              </div>
            </Link>
          );
        })}
      </div>
      
      <div className="mt-auto hidden md:flex flex-col gap-4 w-full">
         <button 
           onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} 
           className="flex items-center justify-center lg:justify-start gap-4 p-3 hover:bg-zinc-100 dark:hover:bg-zinc-100 dark:bg-zinc-100 dark:bg-zinc-900 rounded-xl transition-colors w-full group overflow-hidden text-zinc-800 dark:text-zinc-800 dark:text-zinc-800 dark:text-zinc-200 hover:text-black dark:hover:text-black dark:text-white"
         >
           <div className="relative flex items-center justify-center lg:justify-start w-full">
             {theme === 'light' ? <Moon size={26} className="transition-transform group-hover:scale-105" /> : <Sun size={26} className="transition-transform group-hover:scale-105" />}
             <span className="hidden lg:block ml-4 text-[16px]">Theme</span>
           </div>
         </button>
         <Link to="/profile" className="flex items-center gap-3 p-2 hover:bg-zinc-100 dark:hover:bg-zinc-100 dark:bg-zinc-100 dark:bg-zinc-900 rounded-xl transition-colors w-full group overflow-hidden">
            <img src={currentUser?.avatar || undefined} className="w-10 h-10 rounded-full bg-zinc-200 dark:bg-zinc-800 shrink-0" />
            <div className="hidden lg:flex flex-col flex-1 min-w-0">
               <span className="text-[14px] font-bold text-zinc-900 dark:text-zinc-100 flex items-center truncate">
                 <span className="truncate">{currentUser?.name}</span>
                 <VerifiedBadge isVerified={currentUser?.isVerified} />
               </span>
               <span className="text-[12px] text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 truncate">@{currentUser?.username}</span>
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
              className={cn("transition-colors", isActive ? "text-indigo-400" : "text-zinc-600 hover:text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-400")} 
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

const PostItem: React.FC<{ post: Post }> = ({ post }) => {
  const { toggleLike, showToast, currentUser, updatePost, deletePost } = useApp();
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
    if (confirm('Are you sure you want to delete this post?')) {
      await deletePost(post.id);
      showToast('Post deleted');
    }
  };

  const postStyle = currentUser?.appThemeParams?.postBgColor ? { backgroundColor: currentUser.appThemeParams.postBgColor } : {};
  const activeBadge = user.activeBadgeId && !user.hideBadges && user.badges ? user.badges.find(b => b.id === user.activeBadgeId) : null;

  return (
    <div className="mb-6 flex flex-col gap-3 relative bg-white dark:bg-zinc-50 dark:bg-zinc-50 dark:bg-zinc-950 sm:border border-zinc-200 dark:border-zinc-800 sm:rounded-2xl pb-4" style={postStyle}>
      <div className="flex items-center gap-3 px-5 pt-4">
        <Link to={`/${user.username}`} className="flex items-center gap-3 flex-1 overflow-hidden group">
          <img src={user.avatar || undefined} alt={user.username} className="w-10 h-10 rounded-full bg-zinc-200 dark:bg-zinc-800 p-0.5 object-cover" />
          <div className="font-semibold text-[14px] flex-1 flex items-center text-zinc-900 dark:text-zinc-100 group-hover:text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 transition-colors truncate">
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
          <button onClick={() => setShowOptions(!showOptions)} className="p-2 -mr-2"><MoreHorizontal size={20} className="text-zinc-600 hover:text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-400 transition-colors" /></button>
          
          {showOptions && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowOptions(false)} />
              <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-lg z-50 overflow-hidden flex flex-col">
                <button onClick={handleShare} className="text-left px-4 py-3 text-[14px] text-zinc-700 dark:text-zinc-800 dark:text-zinc-800 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-200 dark:bg-zinc-200 dark:bg-zinc-800 dark:hover:text-black dark:text-white transition-colors">Share</button>
                {currentUser?.id === post.userId ? (
                  <>
                    <button onClick={() => { setIsEditing(true); setShowOptions(false); }} className="text-left px-4 py-3 text-[14px] text-zinc-700 dark:text-zinc-800 dark:text-zinc-800 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-200 dark:bg-zinc-200 dark:bg-zinc-800 dark:hover:text-black dark:text-white transition-colors">Edit</button>
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
      {(post.imageUrl || post.caption) && (
        <div className={cn("w-full bg-zinc-100 dark:bg-zinc-50 dark:bg-zinc-50 dark:bg-zinc-950 px-0 relative", (!post.imageUrl) && "aspect-[4/3] flex items-center justify-center p-6")}>
          {post.imageUrl ? (
            <img 
              src={post.imageUrl || undefined} 
              alt="Post" 
              className="w-full h-auto max-h-[80vh] object-cover bg-zinc-100 dark:bg-zinc-50 dark:bg-zinc-50 dark:bg-zinc-950 cursor-zoom-in" 
              onClick={() => setIsZoomed(true)}
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
            <Heart size={24} className={cn("transition-all duration-300", isLiked ? "fill-rose-500 text-rose-500 scale-110" : "text-zinc-900 dark:text-zinc-100 group-hover:text-zinc-500 dark:text-zinc-500 dark:text-zinc-500")} />
          </button>
          <button onClick={() => navigate(`/post/${post.id}/comments`)} className="group">
            <MessageCircle size={24} className="text-zinc-900 dark:text-zinc-100 group-hover:text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 transition-colors" />
          </button>
          <button onClick={handleShare} className="group">
            <Share2 size={24} className="text-zinc-900 dark:text-zinc-100 group-hover:text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 transition-colors" />
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
              <button onClick={() => { setIsEditing(false); setEditCaption(post.caption || ''); }} className="px-4 py-1.5 text-[13px] font-medium text-zinc-600 dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-400">Cancel</button>
              <button onClick={handleSaveEdit} className="px-4 py-1.5 text-[13px] font-medium bg-indigo-500 text-black dark:text-white rounded-md">Save</button>
            </div>
          </div>
        ) : (
          <p className="text-[14px] leading-relaxed">
            <span className="font-semibold mr-2 text-zinc-900 dark:text-zinc-100">{user.username}</span>
            <span className="text-zinc-800 dark:text-zinc-800 dark:text-zinc-800 dark:text-zinc-200">{formatTextHighlight(post.caption)}</span>
          </p>
        )}
        
        <p className="text-[11px] text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 mt-2 uppercase tracking-wide font-medium">
          {formatDistanceToNow(post.createdAt, { addSuffix: true })}
        </p>
      </div>
    </div>
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
    if (!commentText.trim() || !currentUser || !postId) return;
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
        <button onClick={() => navigate(-1)} className="text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-400 hover:text-black dark:text-white transition-colors w-8"><ChevronLeft size={24} /></button>
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
        {comments.map((cm) => {
          const u = users[cm.userId] || { username: '...', avatar: '', name: '...' };
          return (
            <div key={cm.id} className="flex gap-3">
               <img src={u.avatar || undefined} alt="" className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-800" />
               <div className="flex-1">
                 <div className="flex items-baseline gap-2">
                   <span className="font-bold text-[13px] text-zinc-900 dark:text-zinc-100">{u.username}</span>
                   <span className="text-[11px] text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-500">{formatDistanceToNow(cm.createdAt)}</span>
                 </div>
                 <p className="text-[13px] text-zinc-700 dark:text-zinc-300 mt-1">{formatTextHighlight(cm.text)}</p>
               </div>
            </div>
          )
        })}
        {comments.length === 0 && <div className="text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 text-center mt-10">No comments yet</div>}
      </div>

      <form onSubmit={handleSend} className="px-4 py-3 bg-white dark:bg-black border-t border-zinc-200 dark:border-zinc-800/80 mb-safe shrink-0 flex items-center gap-3">
        <img src={currentUser?.avatar || undefined} alt="" className="w-9 h-9 rounded-full bg-zinc-200 dark:bg-zinc-800" />
        <input 
          type="text" 
          value={commentText}
          onChange={e => setCommentText(e.target.value)}
          placeholder="Add a comment..."
          className="flex-1 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-full px-4 py-2 text-[14px] text-black dark:text-white outline-none placeholder:text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-500"
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
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-white dark:bg-zinc-50 dark:bg-zinc-50 dark:bg-zinc-950 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-white dark:bg-zinc-50 dark:bg-zinc-50 dark:bg-zinc-950 sticky top-0 z-10 shrink-0">
          <h2 className="font-bold text-lg dark:text-white">Verification Request</h2>
          <button onClick={onClose} className="p-1.5 bg-zinc-100 dark:bg-zinc-900 rounded-full text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 hover:text-black dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-400 dark:hover:text-black dark:text-white transition-colors">
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
        <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-50 dark:bg-zinc-50 dark:bg-zinc-950 shrink-0">
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
  const { currentUser, showToast, logout, theme, setTheme } = useApp();
  const navigate = useNavigate();
  const [showVerifyModal, setShowVerifyModal] = useState(false);

  const handleDeactivate = async () => {
    if (!currentUser) return;
    if (window.confirm('Are you sure you want to deactivate your account?')) {
      try {
        await updateDoc(doc(db, 'users', currentUser.id), {
          deactivated: true
        });
        showToast('Account deactivated');
        logout();
      } catch (e) {
        console.error(e);
        showToast('Error deactivating account');
      }
    }
  };

  const handleDelete = async () => {
    if (!currentUser) return;
    if (window.confirm('Are you sure you want to completely delete your account? This cannot be undone.')) {
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
    }
  };

  return (
    <motion.div initial={{ x: 50, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="flex-1 flex flex-col min-h-0 bg-white dark:bg-black absolute inset-0 z-50">
      <header className="flex items-center px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black/90 backdrop-blur-md sticky top-0 z-10 shrink-0">
        <button onClick={() => navigate(-1)} className="mr-3 p-1.5 rounded-full text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-400 hover:text-black dark:text-white transition-colors"><ChevronLeft size={24} /></button>
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
            className="w-full text-left bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-200 dark:bg-zinc-200 dark:bg-zinc-800 p-4 rounded-xl font-medium transition-colors disabled:opacity-50"
          >
            {currentUser?.isVerified ? '✓ Account is verified' : currentUser?.verificationStatus === 'pending' ? 'Verification pending...' : 'Apply for verification tick'}
          </button>
          
          <button 
            onClick={handleDeactivate}
            className="w-full text-left bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-200 dark:bg-zinc-200 dark:bg-zinc-800 p-4 rounded-xl font-medium text-orange-600 transition-colors"
          >
            Deactivate account
          </button>
          <button 
            onClick={handleDelete}
            className="w-full text-left bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-200 dark:bg-zinc-200 dark:bg-zinc-800 p-4 rounded-xl font-medium text-red-600 transition-colors"
          >
            Delete account
          </button>
          
          {['wwwrakibcom071@gmail.com', 'arbnyt60@gmail.com'].includes(auth.currentUser?.email || '') && (
            <button 
              onClick={() => navigate('/admin')}
              className="w-full mt-2 text-left bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 p-4 rounded-xl font-bold flex items-center justify-between transition-colors"
            >
              Admin Dashboard
            </button>
          )}

          <button 
            onClick={logout}
            className="w-full mt-4 text-left border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-100 dark:bg-zinc-100 dark:bg-zinc-900 p-4 rounded-xl font-medium flex items-center justify-between transition-colors"
          >
            Log out <LogOut size={18} />
          </button>
        </div>
      </div>
      {showVerifyModal && <VerificationRequestModal onClose={() => setShowVerifyModal(false)} />}
    </motion.div>
  );
};

const AdminDashboardScreen = () => {
  const { posts, showToast } = useApp();
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [tab, setTab] = useState<'overview' | 'verifications' | 'verified' | 'reports' | 'users'>('overview');

  const isAdmin = ['wwwrakibcom071@gmail.com', 'arbnyt60@gmail.com'].includes(auth.currentUser?.email || '');

  useEffect(() => {
    if (!isAdmin) return;
    const unsubUsers = onSnapshot(collection(db, 'users'), snap => {
      const u: User[] = [];
      snap.forEach(d => u.push(d.data() as User));
      setUsers(u);
    });
    
    const unsubReports = onSnapshot(collection(db, 'reports'), snap => {
      const r: Report[] = [];
      snap.forEach(d => r.push({ ...d.data(), id: d.id, createdAt: d.data().createdAt?.toDate?.() || new Date() } as Report));
      setReports(r.sort((a,b) => b.createdAt.getTime() - a.createdAt.getTime()));
    });
    
    return () => { unsubUsers(); unsubReports(); };
  }, [isAdmin]);

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
          read: false,
          createdAt: serverTimestamp()
        });
      } else if (action === 'accepted') {
        const notifId = `sys_${Date.now()}_${Math.floor(Math.random() * 1000000)}`;
        await setDoc(doc(db, 'notifications', notifId), {
          id: notifId,
          userId: userId,
          actorId: auth.currentUser?.uid || 'system',
          type: 'system',
          message: 'Congratulations! Your verification request has been accepted. You are now verified.',
          read: false,
          createdAt: serverTimestamp()
        });
      }
      
      showToast('Verification request ' + action);
    } catch (e) {
      console.error(e);
      showToast('Error processing request');
    }
  };

  const handleRemoveVerified = async (userId: string) => {
    if (!window.confirm("Are you sure you want to remove the verified mark from this user?")) return;
    try {
      await updateDoc(doc(db, 'users', userId), {
        isVerified: false,
        verifiedUntil: null,
        verificationStatus: 'none'
      });
      showToast('Verified mark removed');
    } catch (e) {
      showToast('Error removing verified mark');
    }
  };
  
  const handleBanUser = async (userId: string, permanent: boolean = false) => {
    if (!window.confirm(`Are you sure you want to ban this user ${permanent ? 'permanently' : 'for 7 days'}?`)) return;
    try {
      const updates: any = {};
      if (permanent) {
        let future = new Date();
        future.setFullYear(future.getFullYear() + 100);
        updates.bannedUntil = future;
      } else {
        let future = new Date();
        future.setDate(future.getDate() + 7); // Ban for 7 days
        updates.bannedUntil = future;
      }
      await updateDoc(doc(db, 'users', userId), updates);
      showToast('User banned ' + (permanent ? 'permanently' : 'for 7 days'));
    } catch (e) {
      showToast('Error banning user');
    }
  };
  
  const handleResolveReport = async (reportId: string) => {
    try {
      await updateDoc(doc(db, 'reports', reportId), {
        status: 'resolved'
      });
      showToast('Report marked as resolved');
    } catch (e) {
      showToast('Error resolving report');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!window.confirm("Are you sure you want to delete this user?")) return;
    try {
      await deleteDoc(doc(db, 'users', userId));
      showToast('User deleted manually');
    } catch (e) {
      console.error(e);
      showToast('Error deleting user');
    }
  }

  if (!isAdmin) {
    return (
      <div className="flex-1 flex flex-col justify-center items-center text-red-500 font-bold bg-white dark:bg-black">
        Access Denied - Authorized Personnel Only
      </div>
    );
  }

  const pendingRequests = users.filter(u => u.verificationStatus === 'pending');
  const verifiedUsers = users.filter(u => u.isVerified);
  const pendingReports = reports.filter(r => r.status !== 'resolved');

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex-1 flex flex-col min-h-0 bg-white dark:bg-black absolute inset-0 z-50">
      <header className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black/90 backdrop-blur-md sticky top-0 z-10 shrink-0">
        <div className="flex items-center">
          <button onClick={() => navigate(-1)} className="mr-3 p-1.5 rounded-full text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-400 hover:text-black dark:text-white transition-colors"><ChevronLeft size={24} /></button>
          <span className="font-bold text-[16px] text-zinc-900 dark:text-zinc-100 flex items-center gap-2"><Trophy size={18} className="text-indigo-500" /> Admin Command Center</span>
        </div>
      </header>

      <div className="flex gap-4 px-5 pt-4 shrink-0 overflow-x-auto no-scrollbar border-b border-zinc-200 dark:border-zinc-800">
        {(['overview', 'verifications', 'verified', 'reports', 'users'] as const).map(t => (
          <button 
            key={t}
            onClick={() => setTab(t)}
            className={cn("pb-3 px-2 text-[14px] font-bold transition-colors border-b-2 whitespace-nowrap capitalize", tab === t ? "border-indigo-500 text-indigo-500" : "border-transparent text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-700 dark:text-zinc-700 dark:text-zinc-300")}
          >
            {t} 
            {t === 'verifications' && pendingRequests.length > 0 && <span className="ml-1 bg-red-500 text-black dark:text-white text-[10px] px-1.5 py-0.5 rounded-full">{pendingRequests.length}</span>}
            {t === 'reports' && pendingReports.length > 0 && <span className="ml-1 bg-amber-500 text-black dark:text-white text-[10px] px-1.5 py-0.5 rounded-full">{pendingReports.length}</span>}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-6">
        {tab === 'overview' && (
          <div className="flex flex-col gap-6">
            <h2 className="font-bold text-xl dark:text-white">Platform Health</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-indigo-50 dark:bg-indigo-900/20 p-5 rounded-2xl border border-indigo-100 dark:border-indigo-800/30">
                <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 mb-1">Total Users</p>
                <p className="text-4xl font-bold text-zinc-900 dark:text-zinc-100">{users.length}</p>
              </div>
              <div className="bg-emerald-50 dark:bg-emerald-900/20 p-5 rounded-2xl border border-emerald-100 dark:border-emerald-800/30">
                <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 mb-1">Total Posts</p>
                <p className="text-4xl font-bold text-zinc-900 dark:text-zinc-100">{posts.length}</p>
              </div>
              <div className="bg-rose-50 dark:bg-rose-900/20 p-5 rounded-2xl border border-rose-100 dark:border-rose-800/30">
                <p className="text-sm font-semibold text-rose-600 dark:text-rose-400 mb-1">Pending Verifications</p>
                <p className="text-4xl font-bold text-zinc-900 dark:text-zinc-100">{pendingRequests.length}</p>
              </div>
              <div className="bg-amber-50 dark:bg-amber-900/20 p-5 rounded-2xl border border-amber-100 dark:border-amber-800/30">
                <p className="text-sm font-semibold text-amber-600 dark:text-amber-400 mb-1">Pending Reports</p>
                <p className="text-4xl font-bold text-zinc-900 dark:text-zinc-100">{pendingReports.length}</p>
              </div>
            </div>
          </div>
        )}

        {tab === 'verifications' && (
          <div className="flex flex-col gap-4">
            <h2 className="font-bold text-xl dark:text-white mb-2">Verification Queue ({pendingRequests.length})</h2>
            {pendingRequests.map(user => (
              <div key={user.id} className="p-4 border border-zinc-200 dark:border-zinc-800 rounded-xl flex flex-col gap-4 bg-white dark:bg-zinc-50 dark:bg-zinc-50 dark:bg-zinc-950">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <img src={user.avatar || undefined} className="w-12 h-12 rounded-full bg-zinc-200 dark:bg-zinc-800 object-cover border border-zinc-100 dark:border-zinc-800" />
                    <div className="flex flex-col">
                      <span className="font-bold text-zinc-900 dark:text-zinc-100 text-[15px]">{user.name}</span>
                      <span className="text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 text-[13px] font-medium">@{user.username}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleAction(user.id, 'accepted')} className="bg-emerald-500 hover:bg-emerald-600 text-black dark:text-white px-3 py-1.5 rounded-lg text-[13px] font-bold transition-colors">Accept</button>
                    <button onClick={() => handleAction(user.id, 'rejected')} className="bg-red-500 hover:bg-red-600 text-black dark:text-white px-3 py-1.5 rounded-lg text-[13px] font-bold transition-colors">Reject</button>
                  </div>
                </div>
                
                {user.verificationData && (
                  <div className="bg-zinc-50 dark:bg-zinc-900/50 rounded-lg p-3 text-[13px] border border-zinc-100 dark:border-zinc-800 grid grid-cols-2 gap-3">
                    <div><span className="text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 block text-[11px] uppercase tracking-wider font-bold mb-0.5">Full Name</span> <span className="dark:text-zinc-800 dark:text-zinc-800 dark:text-zinc-200">{user.verificationData.fullName}</span></div>
                    <div><span className="text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 block text-[11px] uppercase tracking-wider font-bold mb-0.5">Phone</span> <span className="dark:text-zinc-800 dark:text-zinc-800 dark:text-zinc-200">{user.verificationData.phoneNumber}</span></div>
                    <div className="col-span-2"><span className="text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 block text-[11px] uppercase tracking-wider font-bold mb-0.5">Address</span> <span className="dark:text-zinc-800 dark:text-zinc-800 dark:text-zinc-200">{user.verificationData.address}</span></div>
                    <div><span className="text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 block text-[11px] uppercase tracking-wider font-bold mb-0.5">NID / BID</span> <span className="dark:text-zinc-800 dark:text-zinc-800 dark:text-zinc-200">{user.verificationData.nidBid}</span></div>
                    <div><span className="text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 block text-[11px] uppercase tracking-wider font-bold mb-0.5">DOB</span> <span className="dark:text-zinc-800 dark:text-zinc-800 dark:text-zinc-200">{user.verificationData.birthDate}</span></div>
                    <div className="col-span-2 mt-2 pt-2 border-t border-zinc-200 dark:border-zinc-800 grid grid-cols-2 gap-3">
                      <div><span className="text-amber-500 block text-[11px] uppercase tracking-wider font-bold mb-0.5">Nagad Number</span> <span className="dark:text-zinc-800 dark:text-zinc-800 dark:text-zinc-200 font-mono text-xs">{user.verificationData.nagadNumber}</span></div>
                      <div><span className="text-amber-500 block text-[11px] uppercase tracking-wider font-bold mb-0.5">TrxID</span> <span className="dark:text-zinc-800 dark:text-zinc-800 dark:text-zinc-200 font-mono text-xs">{user.verificationData.transactionId}</span></div>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {pendingRequests.length === 0 && (
              <div className="text-center py-12 text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 border border-dashed border-zinc-300 dark:border-zinc-800 rounded-xl font-medium">
                No pending requests in the queue
              </div>
            )}
          </div>
        )}

        {tab === 'verified' && (
          <div className="flex flex-col gap-4">
             <h2 className="font-bold text-xl dark:text-white mb-2">Verified Users</h2>
             <div className="flex flex-col gap-3">
               {verifiedUsers.map(user => (
                 <div key={user.id} className="p-4 border border-zinc-200 dark:border-zinc-800 rounded-xl flex items-center justify-between bg-white dark:bg-zinc-50 dark:bg-zinc-50 dark:bg-zinc-950">
                   <div className="flex items-center gap-3">
                     <img src={user.avatar || undefined} className="w-10 h-10 rounded-full bg-zinc-200 dark:bg-zinc-800 object-cover" />
                     <div className="flex flex-col">
                       <span className="font-bold text-zinc-900 dark:text-zinc-100 text-[14px] flex items-center gap-1">
                         {user.name} <VerifiedBadge isVerified={true} />
                       </span>
                       <span className="text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 text-[12px] font-medium">@{user.username}</span>
                     </div>
                   </div>
                   <div className="flex items-center gap-3">
                     <div className="text-right flex flex-col text-[11px] font-semibold text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-400">
                       {user.verifiedUntil && (
                         <span className="text-amber-600 dark:text-amber-400">
                           Expires: {user.verifiedUntil?.toDate?.() ? user.verifiedUntil.toDate().toLocaleDateString() : (user.verifiedUntil as Date).toLocaleDateString()}
                         </span>
                       )}
                     </div>
                     <button onClick={() => handleRemoveVerified(user.id)} className="px-3 py-1.5 text-[12px] font-bold text-rose-500 bg-rose-50 dark:bg-rose-900/20 hover:bg-rose-100 dark:hover:bg-rose-900/40 rounded-lg transition-colors">Revoke</button>
                   </div>
                 </div>
               ))}
               {verifiedUsers.length === 0 && (
                 <div className="text-center py-12 text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 border border-dashed border-zinc-300 dark:border-zinc-800 rounded-xl font-medium">
                   No verified users found
                 </div>
               )}
             </div>
          </div>
        )}

        {tab === 'reports' && (
          <div className="flex flex-col gap-4">
             <h2 className="font-bold text-xl dark:text-white mb-2">User Reports</h2>
             <div className="flex flex-col gap-3">
               {reports.map(report => {
                 const reportedUser = users.find(u => u.id === report.reportedUserId);
                 return (
                   <div key={report.id} className={cn("p-4 border rounded-xl flex flex-col gap-3", report.status === 'resolved' ? "border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900" : "border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10")}>
                     <div className="flex items-center justify-between">
                       <div className="flex items-center gap-2">
                         <span className="font-bold text-[14px] text-zinc-900 dark:text-zinc-100">Report #{report.id.slice(-6)}</span>
                         <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold uppercase", report.status === 'resolved' ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400")}>
                           {report.status}
                         </span>
                       </div>
                       <span className="text-[12px] text-zinc-500 dark:text-zinc-500 dark:text-zinc-500">{formatDistanceToNow(report.createdAt as Date)} ago</span>
                     </div>
                     <div className="text-[13px] text-zinc-700 dark:text-zinc-300">
                       <span className="font-semibold text-zinc-900 dark:text-zinc-100">Reason:</span> {report.reason}
                     </div>
                     {reportedUser && (
                       <div className="flex items-center gap-3 p-2 bg-white dark:bg-zinc-50 dark:bg-zinc-50 dark:bg-zinc-950 rounded-lg border border-zinc-100 dark:border-zinc-800">
                         <img src={reportedUser.avatar || undefined} className="w-8 h-8 rounded-full" />
                         <div className="flex flex-col flex-1">
                           <span className="font-bold text-[13px]">{reportedUser.name}</span>
                           <span className="text-[11px] text-zinc-500 dark:text-zinc-500 dark:text-zinc-500">@{reportedUser.username} • {reportedUser.reportCount || 0} reports</span>
                         </div>
                       </div>
                     )}
                     {report.status !== 'resolved' && (
                       <div className="flex gap-2 justify-end mt-2">
                         <button onClick={() => handleResolveReport(report.id)} className="px-3 py-1.5 text-[12px] font-bold bg-emerald-500 hover:bg-emerald-600 text-black dark:text-white rounded-lg transition-colors">Resolve</button>
                         {reportedUser && <button onClick={() => handleBanUser(reportedUser.id, false)} className="px-3 py-1.5 text-[12px] font-bold bg-orange-500 hover:bg-orange-600 text-black dark:text-white rounded-lg transition-colors">Ban 7 Days</button>}
                         {reportedUser && <button onClick={() => handleBanUser(reportedUser.id, true)} className="px-3 py-1.5 text-[12px] font-bold bg-rose-500 hover:bg-rose-600 text-black dark:text-white rounded-lg transition-colors">Ban Permanently</button>}
                       </div>
                     )}
                   </div>
                 );
               })}
               {reports.length === 0 && (
                 <div className="text-center py-12 text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 border border-dashed border-zinc-300 dark:border-zinc-800 rounded-xl font-medium">
                   No reports found
                 </div>
               )}
             </div>
          </div>
        )}

        {tab === 'users' && (
          <div className="flex flex-col gap-4">
             <h2 className="font-bold text-xl dark:text-white mb-2">User Registry</h2>
             <div className="flex flex-col gap-3">
               {users.map(user => (
                 <div key={user.id} className="p-4 border border-zinc-200 dark:border-zinc-800 rounded-xl flex items-center justify-between bg-white dark:bg-zinc-50 dark:bg-zinc-50 dark:bg-zinc-950">
                   <div className="flex items-center gap-3">
                     <img src={user.avatar || undefined} className="w-10 h-10 rounded-full bg-zinc-200 dark:bg-zinc-800 object-cover" />
                     <div className="flex flex-col">
                       <span className="font-bold text-zinc-900 dark:text-zinc-100 text-[14px] flex items-center gap-1">
                         {user.name} {user.isVerified && <span className="w-3.5 h-3.5 bg-blue-500 rounded-full flex items-center justify-center text-black dark:text-white text-[8px]"><Check size={8} strokeWidth={4}/></span>}
                       </span>
                       <span className="text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 text-[12px] font-medium">
                          @{user.username} 
                          {user.bannedUntil && (user.bannedUntil?.toDate?.() || user.bannedUntil) > new Date() && <span className="text-rose-500 font-bold tracking-wide uppercase ml-1">Banned</span>}
                       </span>
                     </div>
                   </div>
                   <div className="flex items-center gap-3">
                     <div className="text-right flex flex-col text-[11px] font-semibold text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-400">
                       <span>{user.followers?.length || 0} Followers</span>
                       <span>ID: {user.id.slice(0, 6)}...</span>
                     </div>
                     <button onClick={() => handleDeleteUser(user.id)} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"><X size={18} /></button>
                   </div>
                 </div>
               ))}
             </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};

const EditProfileScreen = () => {
  const { currentUser, updateProfile, showToast } = useApp();
  const navigate = useNavigate();
  const [name, setName] = useState(currentUser?.name || '');
  const [username, setUsername] = useState(currentUser?.username || '');
  const [bio, setBio] = useState(currentUser?.bio || '');
  const [avatar, setAvatar] = useState(currentUser?.avatar || '');
  const [hideBadges, setHideBadges] = useState(currentUser?.hideBadges || false);
  const [activeBadgeId, setActiveBadgeId] = useState(currentUser?.activeBadgeId || '');
  const [feedColor, setFeedColor] = useState(currentUser?.appThemeParams?.feedColor || '');
  const [postBgColor, setPostBgColor] = useState(currentUser?.appThemeParams?.postBgColor || '');
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!username.trim() || !name.trim()) {
      showToast('Name and username are required');
      return;
    }
    
    setIsSaving(true);
    let finalUsername = username.trim().toLowerCase();
    
    if (finalUsername !== currentUser?.username) {
       const qUser = query(collection(db, 'users'), where('username', '==', finalUsername));
       const docs = await getDocs(qUser);
       if (!docs.empty) {
           showToast('Username already taken');
           setIsSaving(false);
           return;
       }
    }
    
    try {
      await updateProfile({ 
        name, 
        username: finalUsername, 
        bio, 
        avatar, 
        hideBadges, 
        activeBadgeId: activeBadgeId || null,
        appThemeParams: { feedColor, postBgColor } 
      });
      showToast('Profile updated!');
      setIsSaving(false);
      navigate('/profile');
    } catch (e: any) {
      showToast('Error saving profile');
      setIsSaving(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser) return;
    
    setIsUploading(true);
    try {
      const resizedBase64 = await resizeImage(file, 400, 400);
      setAvatar(resizedBase64);
    } catch (error) {
      console.error("Avatar resize error", error);
      showToast('Error resizing avatar');
    }
    setIsUploading(false);
  };

  return (
    <motion.div initial={{ x: 50, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="flex-1 flex flex-col min-h-0 bg-white dark:bg-black absolute inset-0 z-50">
      <header className="flex items-center justify-between px-5 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black/90 backdrop-blur-md sticky top-0 z-10 shrink-0">
        <button onClick={() => navigate(-1)} className="text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-400 hover:text-black dark:text-white transition-colors"><ChevronLeft size={24} /></button>
        <span className="font-bold text-[15px] tracking-wide text-zinc-900 dark:text-zinc-100">Edit Profile</span>
        <button onClick={handleSave} disabled={isUploading || isSaving} className="font-bold text-[13px] uppercase tracking-wider text-indigo-400 hover:text-indigo-300 disabled:opacity-50">Save</button>
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-6 flex flex-col gap-6">
        <div className="flex flex-col items-center mb-4">
          <img src={avatar || undefined} alt="Profile" className={cn("w-24 h-24 rounded-full bg-zinc-200 dark:bg-zinc-800 object-cover", isUploading && "opacity-50 animate-pulse")} />
          <label className="text-indigo-400 font-bold text-[13px] mt-4 cursor-pointer hover:text-indigo-300">
            {isUploading ? 'Uploading...' : 'Change Photo'}
            <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} disabled={isUploading} />
          </label>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-[12px] uppercase tracking-wider font-bold text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 px-1">Name</label>
          <div className="bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-3 rounded-xl">
            <input type="text" value={name} onChange={e => setName(e.target.value)} className="bg-transparent w-full outline-none text-black dark:text-white text-[15px]" />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-[12px] uppercase tracking-wider font-bold text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 px-1">Username</label>
          <div className="bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-3 rounded-xl flex items-center">
            <span className="text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 mr-1">@</span>
            <input type="text" value={username} onChange={e => setUsername(e.target.value)} className="bg-transparent flex-1 outline-none text-black dark:text-white text-[15px]" />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-[12px] uppercase tracking-wider font-bold text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 px-1">Bio</label>
          <div className="bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-3 rounded-xl">
            <textarea value={bio} onChange={e => setBio(e.target.value)} className="bg-transparent w-full outline-none text-black dark:text-white text-[15px] resize-none h-24" />
          </div>
        </div>

        {currentUser?.badges && currentUser.badges.length > 0 && (
          <div className="flex flex-col gap-2">
            <label className="text-[12px] uppercase tracking-wider font-bold text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 px-1">Active Badge</label>
            <div className="bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-3 rounded-xl">
              <select value={activeBadgeId} onChange={(e) => setActiveBadgeId(e.target.value)} className="bg-transparent w-full outline-none text-black dark:text-white text-[15px]">
                <option value="" className="text-black">No Badge</option>
                {currentUser.badges.map(b => (
                  <option key={b.id} value={b.id} className="text-black">{b.icon} {b.name}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <label className="text-[12px] uppercase tracking-wider font-bold text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 px-1">App Theme (Feed Color)</label>
          <div className="bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-3 rounded-xl flex gap-3 items-center">
            <input type="color" value={feedColor} onChange={e => setFeedColor(e.target.value)} className="w-8 h-8 rounded shrink-0 bg-transparent p-0 border-0" />
            <input type="text" placeholder="Default" value={feedColor} onChange={e => setFeedColor(e.target.value)} className="bg-transparent flex-1 outline-none text-[15px]" />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-[12px] uppercase tracking-wider font-bold text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 px-1">App Theme (Post Background Color)</label>
          <div className="bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-3 rounded-xl flex gap-3 items-center">
            <input type="color" value={postBgColor} onChange={e => setPostBgColor(e.target.value)} className="w-8 h-8 rounded shrink-0 bg-transparent p-0 border-0" />
            <input type="text" placeholder="Default" value={postBgColor} onChange={e => setPostBgColor(e.target.value)} className="bg-transparent flex-1 outline-none text-[15px]" />
          </div>
        </div>

        <div className="flex items-center justify-between p-1 mt-2">
          <span className="font-bold text-[14px]">Hide All Badges</span>
          <button 
            onClick={() => setHideBadges(!hideBadges)} 
            className="w-12 h-6 bg-zinc-300 dark:bg-zinc-300 dark:bg-zinc-300 dark:bg-zinc-700 rounded-full relative transition-colors shadow-inner"
            style={{ backgroundColor: hideBadges ? '#6366f1' : undefined }}
          >
            <div className={cn("absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform shadow-sm", hideBadges && "translate-x-6")} />
          </button>
        </div>
      </div>
    </motion.div>
  );
};


const FollowListModal = ({ isOpen, onClose, title, users }: { isOpen: boolean, onClose: () => void, title: string, users: User[] }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] bg-white dark:bg-transparent/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-zinc-900 w-full max-w-[320px] max-h-[70vh] rounded-2xl shadow-xl flex flex-col relative overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800">
          <h2 className="font-bold text-[15px]">{title}</h2>
          <button onClick={onClose} className="p-1 rounded-full text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 hover:text-black dark:hover:text-black dark:text-white hover:bg-zinc-100 dark:hover:bg-zinc-200 dark:bg-zinc-200 dark:bg-zinc-800 transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
        <div className="overflow-y-auto p-4 flex flex-col gap-3">
          {users.map(u => (
            <Link key={u.id} to={`/${u.username}`} onClick={onClose} className="flex items-center gap-3">
              <img src={u.avatar || undefined} alt="" className="w-10 h-10 rounded-full object-cover bg-zinc-200 dark:bg-zinc-800 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="font-bold text-[14px] truncate">{u.username}</div>
                <div className="text-[12px] text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 truncate">{u.name}</div>
              </div>
            </Link>
          ))}
          {users.length === 0 && <div className="text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 text-center py-4 text-[13px]">List is empty</div>}
        </div>
      </div>
    </div>
  );
};

const StoryCreatorModal = ({ onClose }: { onClose: () => void }) => {
  const { currentUser, showToast } = useApp();
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [backgroundColor, setBackgroundColor] = useState<string>('#9333ea'); // default purple
  const [isUploading, setIsUploading] = useState(false);
  const [text, setText] = useState('');
  const [isAddingText, setIsAddingText] = useState(false);
  const [textOverlays, setTextOverlays] = useState<TextOverlay[]>([]);
  const [imageOverlays, setImageOverlays] = useState<ImageOverlay[]>([]);
  const [pollOverlay, setPollOverlay] = useState<PollOverlay | null>(null);
  const [isAddingPoll, setIsAddingPoll] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState<string[]>(['', '']);
  const [selectedSong, setSelectedSong] = useState<{title: string, artist: string} | null>(null);
  const [showSongPicker, setShowSongPicker] = useState(false);

  const colors = ['#9333ea', '#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#000000'];
  const mockSongs = [
    { title: 'Lofi Vibes', artist: 'Chill Beat' },
    { title: 'Summer Pop', artist: 'Hits 2026' },
    { title: 'Late Night Dance', artist: 'Club Mix' },
    { title: 'Acoustic Sunset', artist: 'Indie Folk' },
    { title: 'Upbeat Energy', artist: 'Workout Crew' }
  ];

  const handleUploadClick = () => {
    const el = document.getElementById('story-media');
    if (el) el.click();
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const b64 = await resizeImage(file, 1080, 1920);
      setImageUrl(b64);
    } catch (err) {
      console.error(err);
      showToast('Error loading image');
    }
  };

  const handleStickerChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const b64 = await resizeImage(file, 800, 800);
      setImageOverlays([...imageOverlays, { url: b64, x: 0, y: 0, scale: 1 }]);
    } catch (err) {
      console.error(err);
      showToast('Error loading sticker');
    }
  };

  const addTextOverlay = () => {
    if (text.trim()) {
      setTextOverlays([...textOverlays, { text, x: 0, y: 0, scale: 1, color: '#ffffff' }]);
    }
    setText('');
    setIsAddingText(false);
  };

  const addPollOverlay = () => {
    const validOptions = pollOptions.filter(o => o.trim() !== '');
    if (pollQuestion.trim() && validOptions.length >= 2) {
      setPollOverlay({ question: pollQuestion, options: validOptions, x: 0, y: 0, scale: 1 });
    }
    setPollQuestion('');
    setPollOptions(['', '']);
    setIsAddingPoll(false);
  };

  const handlePost = async () => {
    if (!currentUser) return;
    setIsUploading(true);
    try {
      const storyId = `s${Date.now()}`;
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      
      const payload: any = {
        id: storyId,
        userId: currentUser.id,
        createdAt: serverTimestamp(),
        expiresAt: Timestamp.fromDate(expiresAt),
        textOverlays,
        imageOverlays
      };
      
      if (pollOverlay) payload.poll = pollOverlay;
      if (imageUrl) payload.imageUrl = imageUrl;
      else payload.backgroundColor = backgroundColor;
      
      if (selectedSong) payload.song = selectedSong;

      await setDoc(doc(db, 'stories', storyId), payload);
      showToast('Story added!');
      onClose();
    } catch (err: unknown) {
      console.error(err);
      showToast('Failed to add story');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[250] bg-white dark:bg-transparent/95 flex items-center justify-center sm:p-4 text-black dark:text-white">
      <div className="relative w-full h-full sm:h-[85vh] sm:aspect-[9/16] sm:max-h-[90vh] bg-zinc-100 dark:bg-zinc-100 dark:bg-zinc-900 sm:rounded-[2.5rem] overflow-hidden flex flex-col shadow-2xl sm:border-[8px] sm:border-zinc-200 dark:border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center justify-between p-4 z-20 sticky top-0 bg-gradient-to-b from-black/80 to-transparent">
        <button onClick={onClose} className="p-2"><ChevronLeft size={28} /></button>
        <div className="flex gap-4">
          <label className="cursor-pointer p-2 bg-white dark:bg-transparent/40 rounded-full flex items-center justify-center">
            <ImageIcon size={24} />
            <input id="story-sticker" type="file" accept="image/*" className="hidden" onChange={handleStickerChange} />
          </label>
          <button onClick={() => setIsAddingPoll(true)} className="p-2 bg-white dark:bg-transparent/40 rounded-full disabled:opacity-50" disabled={!!pollOverlay}><BarChart2 size={24} /></button>
          <button onClick={() => setIsAddingText(true)} className="p-2 bg-white dark:bg-transparent/40 rounded-full"><Type size={24} /></button>
          {!imageUrl && (
            <div className="flex items-center bg-white dark:bg-transparent/40 rounded-full px-2 gap-1 overflow-hidden transition-all hide-scrollbar w-32 py-1">
              <Palette size={20} className="shrink-0 ml-1" />
              {colors.map(c => (
                <button key={c} onClick={() => setBackgroundColor(c)} className="w-5 h-5 rounded-full shrink-0 border border-white/20" style={{ backgroundColor: c }} />
              ))}
            </div>
          )}
          <button className="p-2 bg-white dark:bg-transparent/40 rounded-full" onClick={() => {
            if (selectedSong) setSelectedSong(null);
            else setShowSongPicker(true);
          }}>
            {selectedSong ? <Check size={24} className="text-green-400" /> : <Music size={24} />}
          </button>
        </div>
      </div>

      <div className="flex-1 relative flex items-center justify-center overflow-hidden" style={{ backgroundColor: !imageUrl ? backgroundColor : '#000' }}>
        {imageUrl && <img src={imageUrl || undefined} className="w-full h-full object-cover pointer-events-none" />}
        
        {/* Overlays */}
        <div className="absolute inset-0 pointer-events-none">
          {(imageOverlays.length > 0 || textOverlays.length > 0) && (
             <div className="absolute top-20 left-0 w-full flex justify-center z-10 pointer-events-none">
               <span className="bg-white dark:bg-transparent/50 text-black dark:text-white/70 text-[10px] px-3 py-1.5 rounded-full font-bold uppercase tracking-wider backdrop-blur-sm">Drag to move • Scroll to resize</span>
             </div>
          )}
          {imageOverlays.map((io, i) => (
             <motion.img 
               key={`img-${i}`}
               src={io.url || undefined}
               drag
               dragMomentum={false}
               onDragEnd={(_, info) => {
                  const newOverlays = [...imageOverlays];
                  newOverlays[i] = { ...newOverlays[i], x: newOverlays[i].x + info.offset.x, y: newOverlays[i].y + info.offset.y };
                  setImageOverlays(newOverlays);
               }}
               onWheel={(e) => {
                  const newOverlays = [...imageOverlays];
                  newOverlays[i].scale += e.deltaY * -0.001;
                  newOverlays[i].scale = Math.min(Math.max(0.3, newOverlays[i].scale), 4);
                  setImageOverlays(newOverlays);
               }}
               className="absolute w-40 object-cover rounded-xl cursor-move pointer-events-auto border-2 border-white/50 shadow-lg"
               style={{ x: io.x, y: io.y, scale: io.scale, left: '50%', top: '50%', marginLeft: '-80px', marginTop: '-80px' }}
             />
          ))}
          {textOverlays.map((to, i) => (
             <motion.div 
               key={i} 
               drag
               dragMomentum={false}
               onDragEnd={(_, info) => {
                  const newOverlays = [...textOverlays];
                  newOverlays[i] = { ...newOverlays[i], x: newOverlays[i].x + info.offset.x, y: newOverlays[i].y + info.offset.y };
                  setTextOverlays(newOverlays);
               }}
               onWheel={(e) => {
                  const newOverlays = [...textOverlays];
                  newOverlays[i].scale += e.deltaY * -0.001;
                  newOverlays[i].scale = Math.min(Math.max(0.5, newOverlays[i].scale), 4);
                  setTextOverlays(newOverlays);
               }}
               className="absolute text-3xl font-bold bg-white dark:bg-transparent/50 px-4 py-2 rounded-xl text-black dark:text-white drop-shadow-md cursor-move pointer-events-auto whitespace-pre-wrap"
               style={{ x: to.x, y: to.y, scale: to.scale, left: '50%', top: '50%', marginLeft: '-50%', marginTop: '-20px', minWidth: 'max-content' }} // approximate center
             >
               {to.text}
             </motion.div>
          ))}
          {pollOverlay && (
             <motion.div 
               drag
               dragMomentum={false}
               onDragEnd={(_, info) => {
                  setPollOverlay({ ...pollOverlay, x: pollOverlay.x + info.offset.x, y: pollOverlay.y + info.offset.y });
               }}
               className="absolute bg-white text-black p-4 rounded-xl shadow-lg cursor-move pointer-events-auto min-w-[200px]"
               style={{ x: pollOverlay.x, y: pollOverlay.y, scale: pollOverlay.scale, left: '50%', top: '50%', marginLeft: '-100px', marginTop: '-50px' }}
             >
               <div className="font-bold text-center mb-3 text-lg">{pollOverlay.question}</div>
               <div className="flex flex-col gap-2 pointer-events-none">
                 {pollOverlay.options.map((opt, i) => (
                   <div key={i} className="bg-zinc-100 py-2 px-3 rounded-lg text-center font-medium border border-zinc-200">
                     {opt}
                   </div>
                 ))}
               </div>
             </motion.div>
          )}
        </div>
        
        {/* Active Text Edit */}
        {isAddingText && (
          <div className="absolute inset-0 bg-white dark:bg-transparent/80 flex flex-col items-center justify-center z-30 px-4">
            <textarea 
              value={text} 
              onChange={e => setText(e.target.value)}
              className="bg-transparent text-black dark:text-white text-3xl font-bold text-center w-full outline-none placeholder:text-black dark:text-white/50 resize-none"
              placeholder="Type something..."
              autoFocus
            />
            <button onClick={addTextOverlay} className="absolute top-4 right-4 bg-white text-black px-4 py-2 rounded-full font-bold">Done</button>
          </div>
        )}

        {/* Active Poll Edit */}
        {isAddingPoll && (
          <div className="absolute inset-0 bg-white dark:bg-transparent/90 flex flex-col items-center justify-center z-30 px-4">
            <div className="w-full max-w-sm bg-zinc-100 dark:bg-zinc-100 dark:bg-zinc-900 p-6 rounded-2xl flex flex-col gap-4">
              <input 
                type="text" 
                value={pollQuestion}
                onChange={e => setPollQuestion(e.target.value)}
                placeholder="Ask a question..."
                className="bg-transparent text-black dark:text-white text-xl font-bold text-center w-full outline-none placeholder:text-black dark:text-white/50 border-b border-white/20 pb-2"
                autoFocus
              />
              {pollOptions.map((opt, i) => (
                <div key={i} className="relative">
                  <input
                    type="text"
                    value={opt}
                    onChange={e => {
                      const newOpts = [...pollOptions];
                      newOpts[i] = e.target.value;
                      setPollOptions(newOpts);
                    }}
                    placeholder={`Option ${i + 1}`}
                    className="w-full bg-zinc-200 dark:bg-zinc-200 dark:bg-zinc-800 text-black dark:text-white px-4 py-3 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium"
                  />
                </div>
              ))}
              {pollOptions.length < 4 && (
                <button 
                  onClick={() => setPollOptions([...pollOptions, ''])}
                  className="text-indigo-400 font-bold py-2 hover:bg-zinc-200 dark:bg-zinc-200 dark:bg-zinc-800 rounded-xl transition-colors"
                >
                  + Add Option
                </button>
              )}
            </div>
            <button onClick={addPollOverlay} className="absolute top-4 right-4 bg-white text-black px-4 py-2 rounded-full font-bold">Done</button>
            <button onClick={() => setIsAddingPoll(false)} className="absolute top-4 left-4 text-black dark:text-white px-4 py-2 rounded-full font-bold">Cancel</button>
          </div>
        )}

        {/* Song Picker Bottom Sheet */}
        <AnimatePresence>
          {showSongPicker && (
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="absolute inset-x-0 bottom-0 top-1/2 bg-zinc-100 dark:bg-zinc-100 dark:bg-zinc-900 rounded-t-2xl z-40 flex flex-col pointer-events-auto"
            >
              <div className="p-4 font-bold border-b border-zinc-200 dark:border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                <span>Select Music</span>
                <button onClick={() => setShowSongPicker(false)} className="p-1"><ChevronLeft size={20} className="rotate-270" /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-2">
                {mockSongs.map(song => (
                  <button 
                    key={song.title} 
                    className="w-full flex items-center gap-3 p-3 hover:bg-zinc-200 dark:bg-zinc-200 dark:bg-zinc-800 rounded-xl text-left transition-colors"
                    onClick={() => { setSelectedSong(song); setShowSongPicker(false); }}
                  >
                    <div className="w-12 h-12 bg-zinc-200 dark:bg-zinc-200 dark:bg-zinc-800 rounded-lg flex items-center justify-center shrink-0 border border-zinc-700">
                      <Music size={20} className="text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-black dark:text-white truncate">{song.title}</div>
                      <div className="text-sm text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-400 truncate">{song.artist}</div>
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="p-4 flex items-center justify-between z-20 bg-gradient-to-t from-black/80 to-transparent">
        <label className="cursor-pointer p-3 bg-zinc-200 dark:bg-zinc-200 dark:bg-zinc-800 rounded-full">
          <ImageIcon size={24} />
          <input id="story-media" type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
        </label>
        
        {selectedSong && (
          <div className="flex items-center gap-2 bg-white/20 px-3 py-1.5 rounded-full">
            <Music size={16} />
            <span className="text-xs font-bold truncate max-w-[100px]">{selectedSong.title}</span>
          </div>
        )}

        <button 
          onClick={handlePost} 
          disabled={isUploading}
          className="bg-white text-black px-6 py-2.5 rounded-full font-bold shadow-lg disabled:opacity-50 flex items-center"
        >
          {isUploading ? 'Posting...' : 'Your Story'}
        </button>
      </div>
      </div>
    </div>
  );
};

const StoryViewerModal = ({ stories, user, currentUser, onClose }: { stories: Story[], user: User, currentUser: User | null, onClose: () => void }) => {
  const [index, setIndex] = useState(0);
  const { showToast } = useApp();
  const [comment, setComment] = useState('');
  const [isLiking, setIsLiking] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [hasLiked, setHasLiked] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [pollVotes, setPollVotes] = useState<any[]>([]);
  const [isVoting, setIsVoting] = useState(false);

  const story = stories[index];

  useEffect(() => {
    if (!story || !currentUser) return;
    const unsub = onSnapshot(doc(db, `stories/${story.id}/likes`, currentUser.id), snap => {
       setHasLiked(snap.exists());
    });
    
    const qComments = query(collection(db, `stories/${story.id}/comments`), orderBy('createdAt', 'desc'));
    const unsubComments = onSnapshot(qComments, snap => {
      setComments(snap.docs.map(d => ({id: d.id, ...d.data()})));
    });

    const unsubVotes = onSnapshot(collection(db, `stories/${story.id}/pollVotes`), snap => {
      setPollVotes(snap.docs.map(d => ({id: d.id, ...d.data()})));
    });

    return () => {
      unsub();
      unsubComments();
      unsubVotes();
    };
  }, [story?.id, currentUser?.id]);

  useEffect(() => {
    // don't auto advance if typing comment
    if (document.activeElement?.tagName === 'INPUT') return;
    const timer = setTimeout(() => {
      if (index < stories.length - 1) setIndex(index + 1);
      else onClose();
    }, 5000);
    return () => clearTimeout(timer);
  }, [index, stories.length, onClose]);

  if (!story) return null;

  return (
    <div className="fixed inset-0 z-[200] bg-white dark:bg-transparent/95 flex flex-col items-center justify-center animate-in fade-in duration-200">
      <div className="w-full h-full max-w-md relative flex flex-col bg-zinc-100 dark:bg-zinc-100 dark:bg-zinc-900 overflow-hidden shadow-2xl sm:rounded-3xl sm:h-[85vh] sm:border border-zinc-200 dark:border-zinc-200 dark:border-zinc-800">
        <div className="flex gap-1 p-3 absolute top-0 w-full z-20 bg-gradient-to-b from-black/50 to-transparent">
          {stories.map((s, i) => (
            <div key={s.id} className="h-1 flex-1 bg-white/30 rounded-full overflow-hidden">
              {i === index && <motion.div initial={{ width: 0 }} animate={{ width: '100%' }} transition={{ duration: 5000, ease: 'linear' }} className="h-full bg-white" />}
              {i < index && <div className="h-full w-full bg-white" />}
            </div>
          ))}
        </div>
        <div className="absolute top-6 left-0 w-full flex items-center justify-between px-4 z-20 text-black dark:text-white mt-1">
          <div className="flex items-center gap-2 drop-shadow-md">
            <img src={user.avatar || undefined} className="w-8 h-8 rounded-full border border-white/50" />
            <span className="font-bold text-[13px]">{user.username}</span>
            <span className="text-black dark:text-white/70 text-[11px] font-medium">{formatDistanceToNow(story.createdAt)}</span>
          </div>
          <div className="flex items-center gap-1">
            {currentUser?.id === story.userId && (
              <button 
                onClick={async () => {
                  if (isDeleting) return;
                  setIsDeleting(true);
                  try {
                    await deleteDoc(doc(db, 'stories', story.id));
                    showToast('Story deleted');
                    onClose();
                  } catch (e) {
                    console.error(e);
                    showToast('Failed to delete story');
                    setIsDeleting(false);
                  }
                }} 
                className="p-2 text-black dark:text-white/80 hover:text-red-400 hover:bg-white/20 rounded-full transition-colors drop-shadow-md"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
              </button>
            )}
            <button onClick={onClose} className="p-2 text-black dark:text-white hover:bg-white/20 rounded-full drop-shadow-md transition-colors">
               <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </div>
        </div>

        <div className="flex-1 relative flex items-center justify-center overflow-hidden" style={{ backgroundColor: story.backgroundColor || '#000' }}>
          {story.imageUrl && <img src={story.imageUrl || undefined} className="w-full h-full object-cover" />}
          
          {story.imageOverlays?.map((io, i) => (
             <img 
               key={`io-${i}`} 
               src={io.url || undefined} 
               className="absolute w-40 object-cover rounded-xl border border-white shadow-lg pointer-events-none z-10" 
               style={{ left: `calc(50% + ${io.x}px)`, top: `calc(50% + ${io.y}px)`, transform: `scale(${io.scale || 1})`, marginLeft: '-80px', marginTop: '-80px' }} 
             />
          ))}

          {story.textOverlays?.map((to, i) => (
             <div key={i} className="absolute text-3xl font-bold bg-white dark:bg-transparent/50 px-4 py-2 rounded-xl text-black dark:text-white drop-shadow-md z-10 pointer-events-none whitespace-pre-wrap min-w-max" style={{ left: `calc(50% + ${to.x}px)`, top: `calc(50% + ${to.y}px)`, transform: `translate(-50%, -50%) scale(${to.scale || 1})` }}>
               {to.text}
             </div>
          ))}

          {story.song && (
            <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-white dark:bg-transparent/60 backdrop-blur-md px-3 py-1.5 rounded-full flex items-center gap-2 z-10 animate-fade-in pointer-events-none shadow-lg border border-white/10">
              <Music size={14} className="text-black dark:text-white animate-pulse" />
              <div className="flex flex-col text-black dark:text-white">
                 <span className="text-[11px] font-bold leading-tight">{story.song.title}</span>
                 <span className="text-[9px] text-black dark:text-white/70 leading-tight">{story.song.artist}</span>
              </div>
            </div>
          )}

          {story.poll && (() => {
             const vId = currentUser?.id;
             const myVote = pollVotes.find(v => v.userId === vId);
             const hasVoted = !!myVote || story.userId === vId; // owner also sees results
             const totalVotes = pollVotes.length;
             return (
               <div className="absolute bg-white/95 text-black p-4 rounded-xl shadow-2xl z-30 min-w-[220px]" style={{ left: `calc(50% + ${story.poll.x}px)`, top: `calc(50% + ${story.poll.y}px)`, transform: `translate(-50%, -50%) scale(${story.poll.scale || 1})` }}>
                 <div className="font-bold text-center mb-3 text-lg leading-tight">{story.poll.question}</div>
                 <div className="flex flex-col gap-2">
                   {story.poll.options.map((opt, i) => {
                     const votes = pollVotes.filter(v => v.optionIndex === i).length;
                     const percent = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
                     return (
                       <button
                         key={i}
                         disabled={isVoting || myVote !== undefined || story.userId === vId}
                         onClick={async (e) => {
                           e.stopPropagation();
                           if (!currentUser || isVoting || myVote) return;
                           setIsVoting(true);
                           try {
                             await setDoc(doc(db, `stories/${story.id}/pollVotes`, currentUser.id), {
                               id: currentUser.id,
                               userId: currentUser.id,
                               optionIndex: i,
                               createdAt: serverTimestamp()
                             });
                           } catch (err) {
                             console.error(err);
                             showToast('Failed to vote');
                           } finally {
                             setIsVoting(false);
                           }
                         }}
                         className="relative bg-zinc-100 py-2.5 px-3 rounded-lg text-center font-medium border border-zinc-200 overflow-hidden w-full transition-transform active:scale-95 disabled:scale-100 disabled:cursor-default"
                       >
                         {hasVoted && (
                           <motion.div initial={{width: 0}} animate={{width: `${percent}%`}} className="absolute left-0 top-0 bottom-0 bg-indigo-100 z-0" />
                         )}
                         <span className="relative z-10 flex items-center w-full" style={{ justifyContent: hasVoted ? 'space-between' : 'center' }}>
                           <span className={cn(myVote?.optionIndex === i ? "font-bold text-indigo-600" : "")}>{opt}</span>
                           {hasVoted && <span className="text-xs font-bold text-zinc-500 dark:text-zinc-500 dark:text-zinc-500">{percent}%</span>}
                         </span>
                       </button>
                     );
                   })}
                 </div>
               </div>
             );
          })()}

          <div className="absolute inset-0 flex z-20">
             <div className="flex-1 cursor-pointer" onClick={(e) => { e.stopPropagation(); if (index > 0) setIndex(index - 1); }} />
             <div className="flex-1 cursor-pointer" onClick={(e) => { e.stopPropagation(); if (index < stories.length - 1) setIndex(index + 1); else onClose(); }} />
          </div>
          
          {/* Comments Display */}
          <div className="absolute bottom-[80px] left-4 max-w-[80%] max-h-[30%] overflow-y-auto z-30 flex flex-col-reverse gap-2 mask-image-bottom pointer-events-none hide-scrollbar">
            {comments.map((c) => (
              <div key={c.id} className="bg-white dark:bg-transparent/40 backdrop-blur-md rounded-2xl px-3 py-1.5 text-black dark:text-white/90 text-[12px] inline-flex items-center gap-2 max-w-max border border-white/10 animate-fade-in shadow-md">
                <span className="font-bold text-[10px] text-black dark:text-white/50">{currentUser?.id === c.userId ? currentUser?.username : 'User'}</span>
                <span className="break-words">{c.text}</span>
              </div>
            ))}
          </div>
        </div>
        
        {/* Story Interactions */}
        <div className="absolute bottom-0 left-0 w-full p-4 z-30 bg-gradient-to-t from-black/80 to-transparent">
          <form className="flex items-center gap-3 relative" onSubmit={async (e) => {
             e.preventDefault();
             if (!currentUser || !comment.trim()) return;
             const cid = `c${Date.now()}`;
             const text = comment;
             setComment('');
             try {
               await setDoc(doc(db, `stories/${story.id}/comments`, cid), {
                 id: cid,
                 userId: currentUser.id,
                 text,
                 createdAt: serverTimestamp()
               });
               showToast('Comment sent');
             } catch(err) {
               console.error(err);
               showToast('Failed to comment');
             }
          }}>
            <input 
              type="text" 
              placeholder="Reply..." 
              value={comment}
              onChange={e => setComment(e.target.value)}
              className="flex-1 bg-white dark:bg-transparent/40 border border-white/30 text-black dark:text-white rounded-full px-4 py-2.5 text-[13px] placeholder:text-black dark:text-white/60 focus:outline-none focus:border-white/60 focus:bg-white dark:bg-black/60 transition-all backdrop-blur-sm"
              onFocus={(e) => { e.stopPropagation(); }}
            />
            {comment.trim() ? (
              <button disabled={!comment.trim()} className="absolute right-14 text-black dark:text-white/80 p-1 opacity-80 hover:opacity-100 transition-opacity">
                Send
              </button>
            ) : null}
            <button 
              type="button"
              disabled={isLiking}
              onClick={async (e) => {
                e.stopPropagation();
                if (!currentUser || isLiking) return;
                setIsLiking(true);
                try {
                  const likeId = currentUser.id;
                  const likeRef = doc(db, `stories/${story.id}/likes`, likeId);
                  if (hasLiked) {
                    await deleteDoc(likeRef);
                  } else {
                    await setDoc(likeRef, {
                      id: likeId,
                      userId: currentUser.id,
                      createdAt: serverTimestamp()
                    });
                  }
                } catch(err) {
                  console.error(err);
                  showToast('Failed to like/unlike');
                } finally {
                  setIsLiking(false);
                }
              }}
              className="text-black dark:text-white hover:text-red-500 hover:scale-110 p-2 rounded-full transition-all drop-shadow-md bg-white dark:bg-transparent/20 backdrop-blur-sm z-30"
            >
              <Heart size={26} fill={hasLiked ? "currentColor" : "none"} className={hasLiked ? "text-red-500" : ""} />
            </button>
          </form>
        </div>
      </div>
      
      {/* Desktop Close Button outside container */}
      <button onClick={onClose} className="hidden sm:flex absolute top-6 right-6 p-3 text-black dark:text-white hover:bg-white/20 rounded-full transition-colors z-[210]">
         <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
      </button>
    </div>
  );
};

const StoriesBar = () => {
  const { showToast, currentUser } = useApp();
  const [storiesByUserId, setStoriesByUserId] = useState<Record<string, Story[]>>({});
  const [storyUsers, setStoryUsers] = useState<Record<string, User>>({});
  const [viewingUserId, setViewingUserId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isCreatorOpen, setIsCreatorOpen] = useState(false);

  useEffect(() => {
    // Only get stories from last 24h to avoid client over-fetching, rules enforce validation.
    // Firestore where('expiresAt', '>', date) requires composite index if joining with other orderBys, 
    // so we just query all and filter locally, or orderBy expiresAt.
    const q = query(
      collection(db, 'stories'), 
      where('expiresAt', '>', new Date()),
      orderBy('expiresAt', 'asc') // Needs index: stories, expiresAt ASC
    );
    let backupUnsub: (() => void) | null = null;
    const unsub = onSnapshot(q, snap => {
       const mapped: Record<string, Story[]> = {};
       const usersToFetch = new Set<string>();
       snap.forEach(d => {
         const data = d.data();
         const story = {
            ...data,
            id: d.id,
            createdAt: data.createdAt?.toDate?.() || new Date(),
            expiresAt: data.expiresAt?.toDate?.() || new Date(),
         } as Story;
         if (!mapped[story.userId]) mapped[story.userId] = [];
         mapped[story.userId].push(story);
         usersToFetch.add(story.userId);
       });
       // Sort stories by createdAt just in case
       for (const k in mapped) mapped[k].sort((a,b) => a.createdAt.getTime() - b.createdAt.getTime());
       setStoriesByUserId(mapped);

       // Fetch missing users
       usersToFetch.forEach(uid => {
         if (!storyUsers[uid]) {
           getDoc(doc(db, 'users', uid)).then(uSnap => {
             if (uSnap.exists()) {
               setStoryUsers(prev => ({...prev, [uid]: uSnap.data() as User}));
             }
           });
         }
       });
    }, e => {
      if (e.message.includes('index')) {
        console.warn("Index needed for stories:", e.message);
        // Fallback if index fails: just get all stories created in last 24h
        // Not ideal but works for preview if index creation takes time.
        const backupQ = query(collection(db, 'stories'));
        backupUnsub = onSnapshot(backupQ, backupSnap => {
           const mapped: Record<string, Story[]> = {};
           const now = new Date();
           backupSnap.forEach(d => {
             const data = d.data();
             const exp = data.expiresAt?.toDate?.() || new Date();
             if (exp > now) {
                const story = { ...data, id: d.id, createdAt: data.createdAt?.toDate?.() || new Date(), expiresAt: exp } as Story;
                if (!mapped[story.userId]) mapped[story.userId] = [];
                mapped[story.userId].push(story);
             }
           });
           setStoriesByUserId(mapped);
        }, backupErr => console.error(backupErr));
      }
    });
    return () => {
      unsub();
      if (backupUnsub) backupUnsub();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser) return;
    setIsUploading(true);
    try {
      const resizedBase64 = await resizeImage(file, 1080, 1920);
      const storyId = `s${Date.now()}`;
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      await setDoc(doc(db, 'stories', storyId), {
        id: storyId,
        userId: currentUser.id,
        imageUrl: resizedBase64,
        createdAt: serverTimestamp(),
        expiresAt: Timestamp.fromDate(expiresAt),
      });
      showToast('Story added!');
    } catch (err: unknown) {
      console.error(err);
      showToast('Failed to add story');
    }
    setIsUploading(false);
  };

  const userIdsWithStories = Object.keys(storiesByUserId).filter(id => id !== currentUser?.id);
  const myStories = currentUser ? storiesByUserId[currentUser.id] : undefined;

  return (
    <>
      <div className="w-full border-b border-zinc-200 dark:border-zinc-800/50 pb-3 pt-4 mb-2">
        <div className="flex px-4 items-start gap-4 overflow-x-auto hide-scrollbar">
          <div className="flex flex-col items-center gap-1.5 shrink-0 transition-opacity relative">
            <div className="relative cursor-pointer" onClick={() => {
               if (myStories && myStories.length > 0) {
                  setViewingUserId(currentUser!.id);
               } else {
                  setIsCreatorOpen(true);
               }
            }}>
              <div className={cn("w-[68px] h-[68px] rounded-full flex items-center justify-center p-[2px] shadow-sm", myStories && myStories.length > 0 ? "bg-gradient-to-tr from-zinc-300 to-zinc-400" : "")}>
                <img src={currentUser?.avatar || undefined} alt="Your story" className="w-[60px] h-[60px] rounded-full bg-zinc-200 dark:bg-zinc-800 border-2 border-white dark:border-black object-cover" />
              </div>
            </div>
            <div className="absolute bottom-5 right-0 bg-indigo-500 rounded-full w-5 h-5 flex items-center justify-center shadow-sm cursor-pointer z-10 hover:scale-110 transition-transform" onClick={() => setIsCreatorOpen(true)}>
              <PlusSquare size={12} className="text-black dark:text-white" />
            </div>
            <span className="text-[11px] text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-400">Your story</span>
          </div>
          
          {userIdsWithStories.map(uid => {
             const u = storyUsers[uid];
             if (!u) return null;
             return (
               <div key={uid} className="flex flex-col items-center gap-1.5 shrink-0 cursor-pointer group" onClick={() => setViewingUserId(uid)}>
                  <div className="w-[68px] h-[68px] rounded-full bg-gradient-to-tr from-yellow-500 via-rose-500 to-indigo-500 flex items-center justify-center p-[2px] group-hover:scale-105 transition-transform duration-300 shadow-sm">
                    <img src={u.avatar || undefined} alt={u.username} className="w-[60px] h-[60px] rounded-full bg-zinc-200 dark:bg-zinc-800 border-2 border-white dark:border-black object-cover" />
                  </div>
                  <span className="text-[11px] text-zinc-700 dark:text-zinc-300 max-w-[70px] truncate">{u.username}</span>
               </div>
             );
          })}
        </div>
      </div>
      {viewingUserId && <StoryViewerModal stories={storiesByUserId[viewingUserId]} user={viewingUserId === currentUser?.id ? currentUser : storyUsers[viewingUserId]} currentUser={currentUser} onClose={() => setViewingUserId(null)} />}
      {isCreatorOpen && <StoryCreatorModal onClose={() => setIsCreatorOpen(false)} />}
    </>
  );
};

import { ContestsScreen } from './ContestsScreen';
import { ContestDetailScreen } from './ContestDetailScreen';

const FeedScreen = () => {
  const { posts, followingIds, currentUser, showToast, theme, setTheme, notifications, chats } = useApp();
  const [feedType, setFeedType] = useState<'latest' | 'following'>('latest');
  const [sessionSeed] = useState(() => Math.random() * 1000);
  
  const unseenNotificationCount = notifications.filter(n => !n.read).length;
  const unseenMessageCount = chats.filter(c => currentUser && (!c.seenBy || !c.seenBy.includes(currentUser.id)) && c.lastMessage).length;
  
  const displayPosts = React.useMemo(() => {
    if (feedType === 'following') {
      return posts
        .filter(p => followingIds.includes(p.userId) || p.userId === currentUser?.id)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    } else {
      // Latest feed
      const latest = [...posts].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 50);
      
      const getHash = (str: string) => {
        let h = 0;
        for (let i = 0; i < str.length; i++) h = Math.imul(31, h) + str.charCodeAt(i) | 0;
        return Math.abs(h);
      };

      return latest
        .map(post => {
          const hash = getHash(post.id);
          const pseudoRandom = Math.sin(hash + sessionSeed) * 10000;
          const score = pseudoRandom - Math.floor(pseudoRandom);
          return { post, score };
        })
        .sort((a, b) => b.score - a.score)
        .map(p => p.post);
    }
  }, [posts, followingIds, currentUser, feedType, sessionSeed]);

  const feedContainerStyle = currentUser?.appThemeParams?.feedColor ? { backgroundColor: currentUser.appThemeParams.feedColor } : {};

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 flex flex-col min-h-0 bg-white dark:bg-black" style={feedContainerStyle}>
      <header className="px-5 pt-4 pb-2 flex flex-col border-b border-zinc-200 dark:border-zinc-800 sticky top-0 bg-white/90 dark:bg-white dark:bg-transparent/90 backdrop-blur-md z-40 shrink-0" style={feedContainerStyle}>
        <div className="flex justify-between items-center mb-3">
          <span className="font-bold text-xl italic text-zinc-900 dark:text-zinc-100">FineWord</span>
          <div className="flex gap-4 items-center mt-1 lg:hidden">
            <button 
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} 
              className="text-zinc-700 dark:text-zinc-300 hover:text-black dark:hover:text-black dark:text-white transition-colors"
            >
              {theme === 'light' ? <Moon size={22} /> : <Sun size={22} />}
            </button>
            <Link to="/notifications" className="relative">
              <Heart size={24} className="text-zinc-700 dark:text-zinc-300 hover:text-black dark:hover:text-black dark:text-white transition-colors" />
              {unseenNotificationCount > 0 && (
                <div className="absolute -top-1.5 -right-2 h-[18px] min-w-[18px] px-1 bg-red-500 rounded-full border border-white dark:border-black flex items-center justify-center text-[10px] font-bold text-black dark:text-white pointer-events-none shadow-sm">
                  {unseenNotificationCount > 99 ? '99+' : unseenNotificationCount}
                </div>
              )}
            </Link>
            <Link to="/chat" className="relative">
              <MessageCircle size={24} className="text-zinc-700 dark:text-zinc-300 hover:text-black dark:hover:text-black dark:text-white transition-colors" />
              {unseenMessageCount > 0 && (
                <div className="absolute -top-1.5 -right-2 h-[18px] min-w-[18px] px-1 bg-red-500 rounded-full border border-white dark:border-black flex items-center justify-center text-[10px] font-bold text-black dark:text-white pointer-events-none shadow-sm">
                   {unseenMessageCount > 99 ? '99+' : unseenMessageCount}
                </div>
              )}
            </Link>
          </div>
        </div>
        <div className="flex gap-4 px-1">
          <button 
            onClick={() => setFeedType('latest')} 
            className={cn("pb-2 px-2 text-[14px] font-bold transition-colors border-b-2", feedType === 'latest' ? "border-black dark:border-white text-black dark:text-white" : "border-transparent text-zinc-500 dark:text-zinc-500 dark:text-zinc-500")}
          >
            Latest
          </button>
          <button 
            onClick={() => setFeedType('following')} 
            className={cn("pb-2 px-2 text-[14px] font-bold transition-colors border-b-2", feedType === 'following' ? "border-black dark:border-white text-black dark:text-white" : "border-transparent text-zinc-500 dark:text-zinc-500 dark:text-zinc-500")}
          >
            Following
          </button>
        </div>
      </header>
      <div className="flex-1 overflow-y-auto divide-y divide-zinc-900/50 pb-6">
        <StoriesBar />
        {displayPosts.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-10 h-64 text-center">
            <p className="text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-400 font-medium">No posts here yet.</p>
          </div>
        ) : (
          displayPosts.map((post) => (
            <PostItem key={post.id} post={post} />
          ))
        )}
      </div>
    </motion.div>
  );
};

const NotificationsScreen = () => {
  const { notifications, currentUser } = useApp();
  const navigate = useNavigate();
  const [actors, setActors] = useState<Record<string, User>>({});

  useEffect(() => {
    const fetchActors = async () => {
      const newActors = { ...actors };
      let changed = false;
      for (const n of notifications) {
        if (!newActors[n.actorId] && n.actorId !== currentUser?.id) {
          try {
            const snap = await getDoc(doc(db, 'users', n.actorId));
            if (snap.exists()) {
              newActors[n.actorId] = snap.data() as User;
              changed = true;
            }
          } catch(e) {}
        }
      }
      if (changed) setActors(newActors);
    };
    fetchActors();

    // Mark all unread notifications as read
    const unread = notifications.filter(n => !n.read);
    if (unread.length > 0) {
      unread.forEach(n => {
        updateDoc(doc(db, 'notifications', n.id), { read: true }).catch(console.error);
      });
    }
  }, [notifications, currentUser]);

  const handleRead = (n: Notification) => {
    if (!n.read) {
      updateDoc(doc(db, 'notifications', n.id), { read: true });
    }
    if (n.postId) {
      navigate(`/post/${n.postId}/comments`);
    } else if (n.type === 'follow') {
      const actor = actors[n.actorId];
      if (actor) navigate(`/${actor.username}`);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 flex flex-col min-h-0 bg-white dark:bg-black">
      <header className="px-5 py-4 border-b border-zinc-200 dark:border-zinc-800 sticky top-0 bg-white/90 dark:bg-white dark:bg-transparent/90 backdrop-blur-md z-40 shrink-0">
        <span className="font-bold text-xl text-zinc-900 dark:text-zinc-100">Notifications</span>
      </header>
      <div className="flex-1 overflow-y-auto pb-6">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-10 h-full text-center text-zinc-500 dark:text-zinc-500 dark:text-zinc-500">
            <Heart size={48} className="mb-4 opacity-50" />
            <p>No notifications yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-900">
            {notifications.map(n => {
              const isSystem = n.type === 'system';
              const actor = isSystem 
                ? { name: 'System', avatar: 'https://cdn-icons-png.flaticon.com/512/3652/3652191.png' } 
                : actors[n.actorId] || { name: 'Someone', avatar: '' };
              return (
                <div 
                  key={n.id} 
                  onClick={() => handleRead(n)}
                  className={cn("flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-100 dark:bg-zinc-100 dark:bg-zinc-900/50 transition-colors", !n.read && "bg-indigo-50/50 dark:bg-indigo-900/10")}
                >
                  {isSystem ? (
                    <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-500 shrink-0">
                      <Trophy size={18} />
                    </div>
                  ) : (
                    <img src={actor.avatar || undefined} alt="" className="w-10 h-10 rounded-full bg-zinc-200 dark:bg-zinc-800 shrink-0" />
                  )}
                  <div className="flex-1 text-[14px]">
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100 mr-1">{actor.name}</span>
                    <span className="text-zinc-600 dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-400">
                      {n.type === 'like' && 'liked your post.'}
                      {n.type === 'comment' && 'commented on your post.'}
                      {n.type === 'follow' && 'started following you.'}
                      {n.type === 'system' && n.message}
                    </span>
                    <div className="text-[12px] text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 mt-0.5">
                      {formatDistanceToNow(n.createdAt, { addSuffix: true })}
                    </div>
                  </div>
                  {!n.read && <div className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" />}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
};

const CreateGroupChatScreen = () => {
  const { currentUser } = useApp();
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
  const [queryText, setQueryText] = useState('');
  const [groupName, setGroupName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (!queryText.trim()) {
      setUsers([]);
      return;
    }
    const q = query(
      collection(db, 'users'), 
      where('username', '>=', queryText.toLowerCase()),
      where('username', '<', queryText.toLowerCase() + '\uf8ff')
    );
    const unsub = onSnapshot(q, snap => {
      const u: User[] = [];
      snap.forEach(d => {
        if (d.id !== currentUser?.id) {
          u.push(d.data() as User);
        }
      });
      setUsers(u);
    });
    return () => unsub();
  }, [queryText, currentUser]);

  const handleCreate = async () => {
    if (!currentUser || selectedUsers.length === 0 || !groupName.trim() || isCreating) return;
    setIsCreating(true);
    try {
      const allUsers = [currentUser.id, ...selectedUsers.map(u => u.id)];
      const chatId = `group_${Date.now()}`;
      await setDoc(doc(db, 'chats', chatId), {
        id: chatId,
        users: allUsers,
        admins: [currentUser.id],
        lastMessage: 'Group created',
        updatedAt: serverTimestamp(),
        seenBy: [currentUser.id],
        isGroup: true,
        groupName: groupName.trim()
      });
      navigate(`/chat/${chatId}`);
    } catch (e) {
      console.error(e);
      setIsCreating(false);
    }
  };

  const toggleUser = (u: User) => {
    setSelectedUsers(prev => {
      const exists = prev.find(user => user.id === u.id);
      if (exists) return prev.filter(user => user.id !== u.id);
      return [...prev, u];
    });
  };

  return (
    <motion.div initial={{ x: 50, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="flex-1 flex flex-col min-h-0 bg-white dark:bg-black absolute inset-0 z-50">
      <header className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black/90 backdrop-blur-md sticky top-0 z-10 shrink-0">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(-1)} className="p-1.5 rounded-full text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 hover:text-black dark:text-white transition-colors"><ChevronLeft size={24} /></button>
          <span className="font-bold text-zinc-900 dark:text-zinc-100">New Group</span>
        </div>
        <button 
          onClick={handleCreate}
          disabled={selectedUsers.length === 0 || !groupName.trim() || isCreating}
          className="text-indigo-600 font-bold disabled:opacity-50 text-[14px]"
        >
          Create
        </button>
      </header>
      
      <div className="flex-1 overflow-y-auto w-full">
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 space-y-4">
          <input 
            type="text" 
            placeholder="Group Name" 
            value={groupName}
            onChange={e => setGroupName(e.target.value)}
            className="w-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 outline-none text-black dark:text-white"
          />
          <div className="w-full relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-900 dark:text-zinc-100 font-medium">To:</span>
            <input 
              type="text" 
              placeholder="Search..." 
              value={queryText}
              onChange={e => setQueryText(e.target.value)}
              className="w-full bg-transparent border-none outline-none text-black dark:text-white py-3 pl-12 pr-4 min-w-0"
            />
          </div>
        </div>

        {selectedUsers.length > 0 && (
          <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
             <div className="flex gap-4 overflow-x-auto no-scrollbar scroll-smooth">
              {selectedUsers.map(u => (
                <div key={`sel_${u.id}`} className="flex flex-col items-center gap-1 shrink-0 relative group">
                  <div className="w-14 h-14 relative">
                    <img src={u.avatar || undefined} className="w-14 h-14 rounded-full object-cover bg-zinc-200 dark:bg-zinc-800" />
                    <button 
                      onClick={() => toggleUser(u)} 
                      className="absolute -top-1 -right-1 w-5 h-5 bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-full flex items-center justify-center border-2 border-white dark:border-black"
                    >
                      <X size={12} strokeWidth={3} />
                    </button>
                  </div>
                  <span className="text-[12px] font-medium text-zinc-900 dark:text-zinc-100 w-16 text-center truncate">{u.name.split(' ')[0]}</span>
                </div>
              ))}
             </div>
          </div>
        )}

        {users.length === 0 && queryText.length > 0 && (
           <p className="text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 text-center p-6 text-[14px]">No accounts found.</p>
        )}

        <div className="flex flex-col p-2">
          {users.map(u => {
            const isSelected = selectedUsers.some(user => user.id === u.id);
            return (
              <div key={u.id} className="flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors active:bg-zinc-100 dark:active:bg-zinc-100 dark:bg-zinc-100 dark:bg-zinc-900" onClick={() => toggleUser(u)}>
                <img src={u.avatar || undefined} className="w-12 h-12 rounded-full object-cover bg-zinc-200 dark:bg-zinc-800 shrink-0" />
                <div className="flex-1 min-w-0 flex flex-col justify-center">
                  <p className="font-bold text-[14px] text-zinc-900 dark:text-zinc-100 flex items-center shrink-0">
                    <span className="truncate">{u.name}</span>
                    <VerifiedBadge isVerified={u.isVerified} />
                  </p>
                  <p className="text-[14px] text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 truncate">{u.username}</p>
                </div>
                <div className={cn("w-6 h-6 rounded-full border flex items-center justify-center shrink-0", isSelected ? "bg-indigo-500 border-indigo-500 text-black dark:text-white" : "border-zinc-300 dark:border-zinc-700")}>
                  {isSelected && <Check size={16} strokeWidth={3} />}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
};

const ChatListScreen = () => {
  const { chats, currentUser } = useApp();
  const [chatUsers, setChatUsers] = useState<Record<string, User>>({});
  const navigate = useNavigate();

  const chatUsersRef = React.useRef<Record<string, boolean>>({});

  useEffect(() => {
    chats.forEach(async c => {
      if (c.isGroup) return;
      const otherUserId = c.users.find(u => u !== currentUser?.id);
      if (otherUserId && !chatUsersRef.current[otherUserId]) {
        chatUsersRef.current[otherUserId] = true;
        const snap = await getDoc(doc(db, 'users', otherUserId));
        if (snap.exists()) {
          setChatUsers(prev => ({ ...prev, [otherUserId]: snap.data() as User }));
        }
      }
    });
  }, [chats, currentUser]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 flex flex-col min-h-0 bg-white dark:bg-black">
      <header className="px-5 py-5 border-b border-zinc-200 dark:border-zinc-800 sticky top-0 bg-white dark:bg-black/90 backdrop-blur-md z-40 shrink-0 flex items-center justify-between">
        <div className="text-xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">Messages</div>
        <div className="flex gap-2 items-center">
          <button onClick={() => navigate('/search')} className="p-2 text-zinc-900 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-200 dark:bg-zinc-200 dark:bg-zinc-800 rounded-full transition-colors" title="New Chat">
            <Search size={24} />
          </button>
          <button onClick={() => navigate('/chat/group/create')} className="p-2 -mr-2 text-zinc-900 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-200 dark:bg-zinc-200 dark:bg-zinc-800 rounded-full transition-colors" title="New Group">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
          </button>
        </div>
      </header>
      <div className="flex-1 overflow-y-auto w-full pt-2 pb-6">
        {chats.map((chat) => {
          let name = 'Unknown';
          let avatarUrl = '';
          const isGroup = chat.isGroup;
          
          if (isGroup) {
            name = chat.groupName || 'Group Chat';
            avatarUrl = chat.groupAvatar || `https://api.dicebear.com/7.x/initials/svg?seed=${name}`;
          } else {
            const otherUserId = chat.users.find(u => u !== currentUser?.id);
            const user = otherUserId ? chatUsers[otherUserId] : null;
            if (!user) return null;
            name = user.name;
            avatarUrl = user.avatar || '';
          }

          return (
            <Link key={chat.id} to={`/chat/${chat.id}`} className="flex items-center gap-4 px-5 py-3 w-full relative">
              <div className="relative shrink-0">
                <img src={avatarUrl || undefined} alt="" className="w-14 h-14 rounded-full bg-zinc-200 dark:bg-zinc-800 object-cover" />
                {!isGroup && <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-white dark:border-black rounded-full" />}
              </div>
              <div className="flex-1 min-w-0 flex flex-col justify-center">
                <div className="flex justify-between items-baseline mb-1">
                  <p className="font-bold text-[15px] text-zinc-900 dark:text-zinc-100">{name}</p>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-400 font-medium whitespace-nowrap ml-2">{formatDistanceToNow(chat.updatedAt)}</p>
                </div>
                <div className={cn("text-[14px] truncate pr-4", currentUser && chat.seenBy && !chat.seenBy.includes(currentUser.id) && chat.lastMessage ? "text-zinc-900 dark:text-zinc-100 font-bold" : "text-zinc-600 dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-400")}>
                  {chat.lastMessage || 'Start a conversation'}
                </div>
              </div>
              {currentUser && chat.seenBy && !chat.seenBy.includes(currentUser.id) && chat.lastMessage && (
                <div className="w-2.5 h-2.5 bg-red-500 rounded-full shrink-0" />
              )}
            </Link>
          );
        })}
        {chats.length === 0 && (
          <div className="flex flex-col items-center justify-center p-10 h-full text-center">
            <div className="w-20 h-20 bg-zinc-100 dark:bg-zinc-900 rounded-full flex items-center justify-center mb-6">
               <svg className="w-10 h-10 text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-400 dark:text-zinc-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            </div>
            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-2">Your Messages</h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-400 mb-6 max-w-[240px]">Connect with friends or groups, direct messages will appear here.</p>
            <button onClick={() => navigate('/search')} className="bg-indigo-600 hover:bg-indigo-500 text-black dark:text-white font-bold py-2.5 px-6 rounded-full text-[14px] transition-colors">Start a Chat</button>
          </div>
        )}
      </div>
    </motion.div>
  );
};

const HighlightedText = ({ text, highlight }: { text: string, highlight: string }) => {
  if (!highlight.trim()) return <span>{text}</span>;
  const regex = new RegExp(`(${highlight})`, 'gi');
  const parts = text.split(regex);
  return (
    <span>
      {parts.map((part, i) => 
        regex.test(part) ? (
          <span key={i} className="bg-yellow-300 dark:bg-yellow-600 text-black dark:text-white rounded-[2px] px-[2px]">{part}</span>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </span>
  );
};

const ChatRoomScreen = () => {
  const { chats, sendMessage, deleteMessage, currentUser, removeGroupMember, deleteChat } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const chatId = location.pathname.split('/').pop() || '';
  const chat = chats.find(c => c.id === chatId);
  
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [chatUsers, setChatUsers] = useState<Record<string, User>>({});
  const [text, setText] = useState('');
  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [showGroupInfo, setShowGroupInfo] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
    useEffect(() => {
      if (!chat || !currentUser) return;
    const fetchUsers = async () => {
      const usersToFetch = chat.users.filter(u => u !== currentUser.id);
      const newChatUsers: Record<string, User> = {};
      await Promise.all(usersToFetch.map(async (u) => {
        const snap = await getDoc(doc(db, 'users', u));
        if (snap.exists()) newChatUsers[u] = snap.data() as User;
      }));
      setChatUsers(newChatUsers);
    };
    fetchUsers();
  }, [chat, currentUser]);

  useEffect(() => {
    if (!chatId || !chat) return;
    if (currentUser && (!chat.seenBy || !chat.seenBy.includes(currentUser.id))) {
      updateDoc(doc(db, 'chats', chatId), {
        seenBy: Array.from(new Set([...(chat.seenBy || []), currentUser.id]))
      }).catch(e => {
        console.error("Firestore Error on updating seenBy: ", e.message, `Path chats/${chatId}`);
      });
    }
    const q = query(collection(db, `chats/${chatId}/messages`), orderBy('createdAt', 'asc'));
    const unsub = onSnapshot(q, snap => {
      const msgs: Message[] = [];
      snap.forEach(d => {
        const data = d.data();
        msgs.push({
          ...data,
          id: d.id,
          createdAt: data.createdAt?.toDate?.() || new Date()
        } as Message);
      });
      setChatMessages(msgs);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }, error => console.error("Messages error:", error.message));
    return () => unsub();
  }, [chatId, chat]);

  if (!chat) return <div className="p-5 flex justify-center items-center h-full text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-500">Wait...</div>;

  const isGroup = chat.isGroup;
  let headerName = 'Unknown';
  let headerSubtitle = '';
  let headerAvatar = '';
  let headerLink = '#';
  let isUserOnline = false;

  if (isGroup) {
    headerName = chat.groupName || 'Group Chat';
    headerSubtitle = `${chat.users.length} members`;
    headerAvatar = chat.groupAvatar || `https://api.dicebear.com/7.x/initials/svg?seed=${headerName}`;
    headerLink = '#';
  } else {
    const otherUserId = chat.users.find(u => u !== currentUser?.id);
    const user = otherUserId ? chatUsers[otherUserId] : null;
    if (user) {
      const nickname = chat.nicknames?.[user.id] || null;
      headerName = nickname || user.name;
      isUserOnline = checkIsOnline(user.lastActive);
      headerSubtitle = isUserOnline ? 'Active now' : `@${user.username}`;
      headerAvatar = user.avatar || '';
      headerLink = `/${user.username}`;
    }
  }

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    sendMessage(chatId, text);
    setText('');
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  return (
    <motion.div initial={{ x: 50, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="flex-1 flex flex-col min-h-0 bg-white dark:bg-black absolute inset-0 z-50">
      <header className="flex items-center px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black/90 backdrop-blur-md sticky top-0 z-10 shrink-0">
        <button onClick={() => navigate(-1)} className="mr-3 p-1.5 rounded-full text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-400 hover:text-black dark:text-white hover:bg-zinc-100 dark:hover:bg-zinc-100 dark:bg-zinc-100 dark:bg-zinc-900 transition-colors"><ChevronLeft size={24} /></button>
        {isGroup ? (
          <button onClick={() => setShowGroupInfo(true)} className="flex items-center gap-3 flex-1 group min-w-0 text-left">
            <div className="relative shrink-0">
               <img src={headerAvatar || undefined} alt="" className="w-10 h-10 rounded-full bg-zinc-200 dark:bg-zinc-800 object-cover" />
            </div>
            <div className="min-w-0">
              <p className="font-bold text-[15px] text-zinc-900 dark:text-zinc-100 leading-tight mb-0.5 truncate">{headerName}</p>
              <p className="text-[12px] font-medium text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-400 truncate">{headerSubtitle}</p>
            </div>
          </button>
        ) : (
          <Link to={headerLink} className="flex items-center gap-3 flex-1 group min-w-0">
            <div className="relative shrink-0">
               <img src={headerAvatar || undefined} alt="" className="w-10 h-10 rounded-full bg-zinc-200 dark:bg-zinc-800 object-cover" />
               {isUserOnline && (
                 <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white dark:border-black rounded-full" />
               )}
            </div>
            <div className="min-w-0">
              <p className="font-bold text-[15px] text-zinc-900 dark:text-zinc-100 leading-tight mb-0.5 truncate">{headerName}</p>
              <p className={cn("text-[12px] font-medium truncate", isUserOnline ? "text-emerald-500" : "text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-400")}>{headerSubtitle}</p>
            </div>
          </Link>
        )}
        <button 
          onClick={() => {
            setIsSearching(!isSearching);
            if (isSearching) setSearchQuery('');
          }} 
          className={cn("p-2 rounded-full transition-colors", isSearching ? "text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30" : "text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 hover:text-black dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-400 dark:hover:text-black dark:text-white hover:bg-zinc-100 dark:hover:bg-zinc-100 dark:bg-zinc-100 dark:bg-zinc-900")}
        >
          <Search size={20} />
        </button>
        <button 
          onClick={() => setIsSettingsOpen(true)}
          className="p-2 rounded-full transition-colors text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 hover:text-black dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-400 dark:hover:text-black dark:text-white hover:bg-zinc-100 dark:hover:bg-zinc-100 dark:bg-zinc-100 dark:bg-zinc-900 ml-1"
        >
          <Settings size={20} />
        </button>
      </header>

      {isSearching && (
        <div className="px-4 py-2 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 sticky top-[65px] z-10 shrink-0">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-400" />
            <input 
              type="text" 
              placeholder="Search in conversation..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-lg pl-9 pr-8 py-1.5 text-[14px] outline-none text-black dark:text-white focus:border-indigo-500 dark:focus:border-indigo-500 transition-colors"
              autoFocus
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-800 dark:text-zinc-800 dark:text-zinc-200"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>
      )}
      
      <div className="flex-1 overflow-y-auto px-4 pt-6 pb-6 flex flex-col" style={chat.theme ? { backgroundColor: chat.theme } : {}}>
        {chatMessages.filter(msg => !searchQuery || msg.text.toLowerCase().includes(searchQuery.toLowerCase())).map((msg, index, filteredArray) => {
          const isMe = msg.senderId === currentUser?.id;
          const prevMsg = filteredArray[index - 1];
          const nextMsg = filteredArray[index + 1];
          
          const isSameSenderAsPrev = prevMsg && prevMsg.senderId === msg.senderId;
          const isSameSenderAsNext = nextMsg && nextMsg.senderId === msg.senderId;
          
          const showDateHeader = !prevMsg || !isSameDay(msg.createdAt, prevMsg.createdAt);
          const sender = isMe ? currentUser : chatUsers[msg.senderId];
          const needsAvatarSpace = !isMe && !isSameSenderAsNext;
          const senderName = sender ? (chat.nicknames?.[sender.id] || sender.name) : 'Unknown';

          return (
            <React.Fragment key={msg.id}>
              {showDateHeader && (
                <div className="flex justify-center my-6">
                  <span className="text-[11px] font-bold text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 uppercase tracking-widest bg-zinc-100 dark:bg-zinc-900 px-3 py-1 rounded-full">
                    {format(msg.createdAt, 'MMM d, yyyy')}
                  </span>
                </div>
              )}
              <div className={cn("flex items-end gap-2", !isSameSenderAsPrev ? "mt-2" : "mt-0.5", isMe ? "justify-end" : "justify-start")}>
                {!isMe && (
                  <div className="w-8 shrink-0">
                    {needsAvatarSpace && sender && (
                      <Link to={`/${sender.username}`}>
                        <img src={sender.avatar || undefined} className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-800 object-cover" />
                      </Link>
                    )}
                  </div>
                )}
                <div className={cn("flex flex-col group max-w-[75%]", isMe ? "items-end" : "items-start")}>
                  {isGroup && !isMe && !isSameSenderAsPrev && sender && (
                    <span className="text-[11px] text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 ml-1 mb-1">{senderName}</span>
                  )}
                  <div className={cn(
                    "px-4 py-2.5 text-[15px] leading-relaxed relative flex items-center", 
                    (msg.imageUrl || msg.videoUrl) ? "p-1 rounded-2xl overflow-hidden bg-transparent border-0" :
                    (isMe ? "bg-indigo-600 text-black dark:text-white shadow-sm" : "bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-sm"),
                    // Border radiuses for grouping
                    !(msg.imageUrl || msg.videoUrl) && "rounded-2xl",
                    !(msg.imageUrl || msg.videoUrl) && isMe && isSameSenderAsNext && "rounded-br-md",
                    !(msg.imageUrl || msg.videoUrl) && isMe && isSameSenderAsPrev && "rounded-tr-md",
                    !(msg.imageUrl || msg.videoUrl) && !isMe && isSameSenderAsNext && "rounded-bl-md",
                    !(msg.imageUrl || msg.videoUrl) && !isMe && isSameSenderAsPrev && "rounded-tl-md",
                    msg.isDeleted && "opacity-60 italic bg-zinc-100 border-none text-zinc-500 dark:text-zinc-500 dark:text-zinc-500"
                  )}>
                    {msg.videoUrl ? (
                      <video src={msg.videoUrl} controls className="rounded-xl w-full max-w-[240px] max-h-[300px] object-cover" />
                    ) : msg.imageUrl ? (
                      <img src={msg.imageUrl} className="rounded-xl w-full max-w-[240px] max-h-[300px] object-cover" />
                    ) : (
                      <HighlightedText text={msg.text} highlight={searchQuery} />
                    )}
                  </div>
                  <div className={cn("flex items-center gap-2", isMe ? "self-end" : "self-start")}>
                    {isMe && !msg.isDeleted && (
                        <button 
                          onClick={() => { if(confirm('Delete message?')) deleteMessage(chatId, msg.id) }} 
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-rose-500 uppercase tracking-widest font-bold"
                        >
                          Delete
                        </button>
                    )}
                    <span className="text-[10px] text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-400 dark:text-zinc-500 dark:text-zinc-500 font-medium px-1 mt-1">
                      {format(msg.createdAt, 'h:mm a')}
                    </span>
                  </div>
                </div>
              </div>
            </React.Fragment>
          );
        })}
        <div ref={messagesEndRef} className="pt-2" />
      </div>

      <form onSubmit={handleSend} className="px-4 py-3 bg-white dark:bg-black border-t border-zinc-200 dark:border-zinc-800 mb-safe shrink-0">
        <div className="flex items-center gap-3">
          <div className="bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-full flex-1 flex items-center pr-2 pl-4 py-2">
            <input 
              type="text"
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="Message..."
              className="bg-transparent flex-1 outline-none py-1 text-[15px] placeholder:text-black dark:text-white"
            />
            <label className="p-1.5 rounded-full text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-400 hover:text-indigo-500 hover:bg-zinc-200 dark:hover:bg-zinc-200 dark:bg-zinc-200 dark:bg-zinc-800 transition-colors cursor-pointer shrink-0">
              <ImageIcon size={20} />
              <input type="file" className="hidden" accept="image/*,video/*" onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f) {
                  try {
                    if (f.type.startsWith('image/')) {
                      const dataUrl = await resizeImage(f, 800, 800);
                      sendMessage(chatId, '', dataUrl);
                    } else if (f.type.startsWith('video/')) {
                      // Basic file to base64 for video
                      if (f.size > 5 * 1024 * 1024) { 
                        alert("Video must be under 5MB for the preview environment.");
                        return;
                      }
                      const reader = new FileReader();
                      reader.onloadend = () => {
                        sendMessage(chatId, '', undefined, reader.result as string);
                      };
                      reader.readAsDataURL(f);
                    }
                  } catch(e) {
                    console.error(e);
                  }
                }
              }} />
            </label>
          </div>
          <button 
            type="submit" 
            disabled={!text.trim()}
            className="w-10 h-10 bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-200 dark:disabled:bg-zinc-200 dark:bg-zinc-200 dark:bg-zinc-800 disabled:text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-400 text-black dark:text-white rounded-full flex items-center justify-center transition-colors shrink-0"
          >
            <Send size={18} className={cn(!text.trim() && "ml-0", text.trim() && "ml-1")} />
          </button>
        </div>
      </form>

      {isSettingsOpen && (
         <div className="absolute inset-0 z-50 bg-white dark:bg-black flex flex-col">
           <header className="flex items-center px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black/90 backdrop-blur-md shrink-0">
             <button onClick={() => setIsSettingsOpen(false)} className="mr-3 p-1.5 rounded-full text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 hover:text-black dark:text-white transition-colors"><ChevronLeft size={24} /></button>
             <span className="font-bold text-[15px]">{isGroup ? 'Group Info' : 'Chat Settings'}</span>
           </header>
           <div className="flex-1 overflow-y-auto p-5">
             <div className="flex flex-col items-center mb-8">
                <div className="relative group">
                  <img src={headerAvatar || undefined} className="w-24 h-24 rounded-full bg-zinc-200 dark:bg-zinc-800 object-cover" />
                  {isGroup && (
                    <label className="absolute inset-0 bg-white dark:bg-transparent/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                      <ImageIcon className="text-black dark:text-white" />
                      <input type="file" className="hidden" accept="image/*" onChange={async (e) => {
                        const f = e.target.files?.[0];
                        if(f) {
                          try {
                            const url = await resizeImage(f, 400, 400);
                            updateDoc(doc(db, 'chats', chatId), { groupAvatar: url });
                          }catch(err){}
                        }
                      }} />
                    </label>
                  )}
                </div>
                <h2 className="text-xl font-bold mt-4">{headerName}</h2>
                <p className="text-zinc-500 dark:text-zinc-500 dark:text-zinc-500">{chat.users.length} members</p>
             </div>

             <div className="mb-6">
               <h3 className="font-bold text-lg mb-4">Chat Theme</h3>
               <div className="flex gap-3 items-center bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-3 rounded-xl">
                 <input type="color" value={chat.theme || ''} onChange={(e) => updateDoc(doc(db, 'chats', chatId), { theme: e.target.value })} className="w-8 h-8 rounded shrink-0 bg-transparent p-0 border-0" />
                 <span className="text-[14px]">Background Color Overlay</span>
                 {(chat.theme) && (
                    <button onClick={() => updateDoc(doc(db, 'chats', chatId), { theme: null })} className="ml-auto text-xs text-red-500 font-bold">Clear</button>
                 )}
               </div>
             </div>

             <div className="mb-6">
               <div className="flex items-center justify-between mb-4">
                 <h3 className="font-bold text-lg">Members</h3>
                 {isGroup && (!chat.onlyAdminsCanAddMembers || chat.admins?.includes(currentUser?.id || '')) && (
                   <button onClick={() => {
                     const username = window.prompt("Enter exact username to add:");
                     if (username && username.trim()) {
                       const fetchUser = async () => {
                         const qRef = query(collection(db, 'users'), where('username', '==', username.trim().toLowerCase()));
                         const snaps = await getDocs(qRef);
                         if (!snaps.empty) {
                           const matchId = snaps.docs[0].id;
                           if (!chat.users.includes(matchId)) {
                             updateDoc(doc(db, 'chats', chatId), { users: [...chat.users, matchId] });
                             alert("Added!");
                           } else alert("Already in group.");
                         } else alert("User not found.");
                       };
                       fetchUser();
                     }
                   }} className="text-sm font-bold text-indigo-500 px-3 py-1 bg-indigo-50 dark:bg-indigo-900/30 rounded-full">Add Member</button>
                 )}
               </div>
               
               {isGroup && chat.admins?.includes(currentUser?.id || '') && (
                 <div className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-900 rounded-xl mb-4">
                   <span className="font-medium text-sm">Only Admins can add members</span>
                   <button 
                     onClick={() => updateDoc(doc(db, 'chats', chatId), { onlyAdminsCanAddMembers: !chat.onlyAdminsCanAddMembers })} 
                     className="w-10 h-5 bg-zinc-300 dark:bg-zinc-300 dark:bg-zinc-300 dark:bg-zinc-700 rounded-full relative transition-colors shadow-inner"
                     style={{ backgroundColor: chat.onlyAdminsCanAddMembers ? '#6366f1' : undefined }}
                   >
                     <div className={cn("absolute top-0.5 left-0.5 bg-white w-4 h-4 rounded-full transition-transform shadow-sm", chat.onlyAdminsCanAddMembers && "translate-x-5")} />
                   </button>
                 </div>
               )}

               <div className="flex flex-col gap-3">
                 {chat.users.map(uid => {
                   const u = uid === currentUser?.id ? currentUser : chatUsers[uid];
                   if (!u) return null;
                   const nickname = chat.nicknames?.[uid] || '';
                   return (
                     <div key={uid} className="flex items-center gap-3">
                       <img src={u.avatar || undefined} className="w-10 h-10 rounded-full object-cover bg-zinc-200 dark:bg-zinc-800" />
                       <div className="flex flex-col">
                         <span className="font-bold">{u.name} <span className="text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 font-normal ml-1">@{u.username}</span></span>
                         {nickname && <span className="text-xs text-indigo-500 font-medium">Nickname: {nickname}</span>}
                       </div>
                       
                       <div className="ml-auto flex items-center gap-2">
                         <button onClick={() => {
                           const newNick = window.prompt(`Set nickname for ${u.name}:`, nickname);
                           if (newNick !== null) {
                             updateDoc(doc(db, 'chats', chatId), {
                               [`nicknames.${uid}`]: newNick.trim() || null
                             });
                           }
                         }} className="text-[11px] text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 font-bold bg-zinc-100 dark:bg-zinc-900 px-2 py-1 rounded">Edit Nickname</button>
                         
                         {isGroup && chat.admins?.includes(u.id) && <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded">Admin</span>}
                         
                         {isGroup && chat.admins?.includes(currentUser?.id || '') && uid !== currentUser?.id && (
                           <button onClick={() => {
                             if(confirm(`Remove ${u.name} from group?`)) {
                               removeGroupMember(chatId, u.id);
                             }
                           }} className="text-[11px] text-red-500 font-bold bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded">Remove</button>
                         )}
                       </div>
                     </div>
                   )
                 })}
               </div>
             </div>

             <div className="mb-6">
               <h3 className="font-bold text-lg mb-4">Media</h3>
               <div className="grid grid-cols-3 gap-1">
                 {chatMessages.filter(m => m.imageUrl || m.videoUrl).map(m => (
                   <div key={m.id} className="aspect-square bg-zinc-100 dark:bg-zinc-900 overflow-hidden relative">
                     {m.videoUrl ? (
                        <video src={m.videoUrl} className="w-full h-full object-cover" />
                     ) : (
                        <img src={m.imageUrl} className="w-full h-full object-cover" />
                     )}
                   </div>
                 ))}
                 {chatMessages.filter(m => m.imageUrl || m.videoUrl).length === 0 && (
                   <p className="text-sm text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 col-span-3">No media shared yet.</p>
                 )}
               </div>
             </div>

             <div className="mt-10 border-t border-zinc-200 dark:border-zinc-800 pt-6 flex justify-center pb-10">
               <button onClick={async () => {
                 if (confirm("Are you sure you want to delete this chat forever?")) {
                   await deleteChat(chatId);
                   navigate('/chat');
                 }
               }} className="text-red-500 font-bold bg-red-50 dark:bg-red-900/20 px-6 py-2 rounded-xl text-sm transition-colors hover:bg-red-100 dark:hover:bg-red-900/40">Delete Chat</button>
             </div>
           </div>
         </div>
      )}
    </motion.div>
  );
};

const SearchScreen = () => {
  const [searchParams] = useSearchParams();
  const [queryText, setQueryText] = useState(searchParams.get('q') || '');
  const [users, setUsers] = useState<User[]>([]);
  const { currentUser, posts } = useApp();

  useEffect(() => {
    if (!queryText.trim()) {
      setUsers([]);
      return;
    }
    const q = query(
      collection(db, 'users'), 
      where('username', '>=', queryText.toLowerCase()),
      where('username', '<', queryText.toLowerCase() + '\uf8ff')
    );
    const unsub = onSnapshot(q, snap => {
      const u: User[] = [];
      snap.forEach(d => {
        if (d.id !== currentUser?.id) {
          u.push(d.data() as User);
        }
      });
      setUsers(u);
    }, error => console.error("Users search error:", error.message));
    return () => unsub();
  }, [queryText, currentUser]);

  const matchedPosts = queryText.trim() 
    ? posts.filter(p => p.caption?.toLowerCase().includes(queryText.toLowerCase()))
    : [];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 flex flex-col min-h-0 bg-white dark:bg-black">
      <header className="px-5 py-5 border-b border-zinc-200 dark:border-zinc-800 sticky top-0 bg-white dark:bg-black/90 backdrop-blur-md z-40 shrink-0">
        <h1 className="font-bold text-[15px] tracking-wide text-zinc-900 dark:text-zinc-100">Explore</h1>
      </header>
      <div className="flex-1 overflow-y-auto w-full">
        <div className="p-5 pb-2 sticky top-0 bg-white dark:bg-black z-10 w-full shrink-0">
          <div className="w-full bg-zinc-100 dark:bg-zinc-900/50 rounded-xl px-4 py-3 flex items-center gap-3 border border-zinc-200 dark:border-zinc-800">
            <Search size={20} className="text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 shrink-0" />
            <input 
              type="text" 
              placeholder={`Search...`} 
              value={queryText}
              onChange={e => setQueryText(e.target.value)}
              className="bg-transparent border-none outline-none text-black dark:text-white w-full placeholder:text-zinc-600 min-w-0"
            />
          </div>
        </div>
        <div className="flex flex-col w-full min-w-0 p-5 pt-2">
          {queryText.trim() && users.length === 0 && matchedPosts.length === 0 && (
            <div className="text-center text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 mt-10">No results found</div>
          )}
          
          {users.length > 0 && (
            <div className="mb-6">
              <h2 className="text-[13px] font-bold tracking-wide uppercase text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 mb-3 px-1">Accounts</h2>
              <div className="flex gap-4 overflow-x-auto hide-scrollbar pb-2">
                {users.map(u => (
                  <Link key={u.id} to={`/${u.username}`} className="flex flex-col items-center gap-2 min-w-[80px] shrink-0">
                    <img src={u.avatar || undefined} alt="" className="w-16 h-16 rounded-full object-cover bg-zinc-200 dark:bg-zinc-800 border-2 border-transparent hover:border-black dark:hover:border-white transition-colors" />
                    <div className="font-bold text-black dark:text-white text-[12px] truncate w-full text-center">{u.username}</div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {matchedPosts.length > 0 && (
            <div>
              <h2 className="text-[13px] font-bold tracking-wide uppercase text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 mb-3 px-1">Posts</h2>
              <div className="grid grid-cols-3 gap-1">
                {matchedPosts.map(post => (
                  <Link key={post.id} to={`/post/${post.id}`} className="aspect-square bg-zinc-100 dark:bg-zinc-900 relative block group">
                     {post.imageUrl ? (
                       <img src={post.imageUrl} alt="" className="w-full h-full object-cover" />
                     ) : (
                       <div className="w-full h-full flex items-center justify-center p-2 text-center text-[10px] break-words">
                         <span className="line-clamp-3">{post.caption}</span>
                       </div>
                     )}
                     <div className="absolute inset-0 bg-white dark:bg-transparent/0 group-hover:bg-white dark:bg-black/20 transition-colors" />
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

const CreatePostScreen = () => {
  const { currentUser, showToast } = useApp();
  const navigate = useNavigate();
  const [caption, setCaption] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isItalic, setIsItalic] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser) return;
    
    setIsUploading(true);
    try {
      const resizedBase64 = await resizeImage(file, 800, 800);
      setImageUrl(resizedBase64);
    } catch (error) {
      console.error("Upload error", error);
      showToast('Error parsing image');
    }
    setIsUploading(false);
  };

  const handleCreate = async () => {
    if ((!caption.trim() && !imageUrl) || !currentUser) return;
    setIsUploading(true);
    const postId = `p${Date.now()}`;
    const newPost = {
      id: postId,
      userId: currentUser.id,
      imageUrl,
      caption: caption.trim(),
      likes: 0,
      likedBy: [],
      createdAt: serverTimestamp(),
      isItalic: !imageUrl ? isItalic : false,
    };
    try {
      await setDoc(doc(db, 'posts', postId), newPost);
      navigate('/');
    } catch (e) {
      console.error(e);
      showToast('Error creating post');
    }
  };

  const canSubmit = (!!imageUrl || !!caption.trim()) && !isUploading;

  return (
    <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="flex-1 flex flex-col min-h-0 bg-white dark:bg-black">
      <header className="flex items-center justify-between px-5 py-4 border-b border-zinc-200 dark:border-zinc-800 shrink-0 bg-white dark:bg-black/90 backdrop-blur-md sticky top-0 z-10">
        <button onClick={() => navigate(-1)} className="text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-400 hover:text-black dark:text-white transition-colors"><ChevronLeft size={24} /></button>
        <span className="font-bold text-lg text-zinc-900 dark:text-zinc-100">New Post</span>
        <button onClick={handleCreate} className={cn("font-bold text-[13px] uppercase tracking-wider text-indigo-400 transition-opacity", !canSubmit ? "opacity-30" : "hover:text-indigo-300")} disabled={!canSubmit}>Share</button>
      </header>
      
      <div className="flex-1 overflow-y-auto flex flex-col p-4">
        <div className="flex gap-4 items-start pb-4 border-b border-zinc-200 dark:border-zinc-800/50 mb-4 shrink-0 flex-col">
          <div className="flex gap-4 items-start w-full">
            <img src={currentUser?.avatar || undefined} alt="" className="w-10 h-10 rounded-full bg-zinc-200 dark:bg-zinc-800 object-cover shrink-0" />
            <textarea
              value={caption}
              onChange={e => setCaption(e.target.value)}
              placeholder="Write a caption... (optional if you add an image)"
              className={cn("bg-transparent flex-1 resize-none outline-none text-[15px] min-h-[100px] border-none text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 font-medium pt-2", isItalic && !imageUrl && "italic")}
              autoFocus
            />
          </div>
          {!imageUrl && (
            <div className="flex w-full justify-end px-2">
              <button
                onClick={() => setIsItalic(!isItalic)}
                className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-colors border", isItalic ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800" : "bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-200 dark:bg-zinc-200 dark:bg-zinc-800")}
              >
                <Type size={14} className={isItalic ? "italic" : ""} />
                Italic
              </button>
            </div>
          )}
        </div>

        {!imageUrl ? (
          <div className="flex-1 flex items-start justify-center">
            <label className="flex flex-col w-full aspect-video bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-200 dark:bg-zinc-200 dark:bg-zinc-800 transition-colors rounded-2xl items-center justify-center gap-4 cursor-pointer border-dashed border-2">
              <input 
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleUpload}
                disabled={isUploading}
              />
              {isUploading ? (
                 <span className="text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 font-bold uppercase tracking-widest text-[14px] animate-pulse">Processing...</span>
              ) : (
                 <>
                   <ImageIcon size={32} className="text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-400 dark:text-zinc-600"/>
                   <span className="text-zinc-600 dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-400 font-medium tracking-tight text-[14px]">Attach Photo (Optional)</span>
                 </>
              )}
            </label>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
             <div className="w-full bg-zinc-100 dark:bg-zinc-900 relative rounded-2xl overflow-hidden shadow-sm border border-zinc-200 dark:border-zinc-800">
               <img src={imageUrl || undefined} alt="Preview" className="w-full h-auto object-cover max-h-[60vh] mx-auto" />
               <label className="absolute bottom-4 right-4 bg-white dark:bg-black/70 backdrop-blur-md px-3 py-1.5 rounded-full text-black dark:text-white text-[12px] font-bold cursor-pointer hover:bg-white dark:hover:bg-white dark:bg-black/90 transition-colors flex items-center gap-2 border border-zinc-200 dark:border-zinc-800 shadow-sm">
                  <ImageIcon size={14} /> Change Photo
                  <input type="file" accept="image/*" className="hidden" onChange={handleUpload} disabled={isUploading} />
               </label>
               <button onClick={() => setImageUrl('')} className="absolute top-4 right-4 bg-white dark:bg-black/70 backdrop-blur-md w-8 h-8 rounded-full flex items-center justify-center text-black dark:text-white border border-zinc-200 dark:border-zinc-800 shadow-sm hover:scale-105 transition-transform flex-shrink-0">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
               </button>
             </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};

// Helper to check online status (within 5 minutes)
export const checkIsOnline = (lastActive: any): boolean => {
  if (!lastActive) return false;
  const t = typeof lastActive.toMillis === 'function' ? lastActive.toMillis() : (lastActive.getTime?.() || lastActive);
  return (Date.now() - t) < 5 * 60 * 1000;
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
    if (!reportReason.trim() || !currentUser || !user) return;
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

  useEffect(() => {
    if (username) {
      const qUser = query(collection(db, 'users'), where('username', '==', username));
      getDocs(qUser).then(d => {
        if (!d.empty) {
          const u = d.docs[0].data() as User;
          setUser(u);
          setUserId(u.id);
        }
      });
    }
  }, [username]);

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
    if (!currentUser || !userId || loadingFollow) return;
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
     if (!currentUser || !userId) return;
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

  if (!user) return <div className="flex-1 bg-white dark:bg-black flex items-center justify-center text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-500">Loading...</div>;

  const userPosts = posts.filter(p => p.userId === userId);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 flex flex-col min-h-0 bg-white dark:bg-black">
      <header className="flex items-center justify-between px-5 py-5 border-b border-zinc-200 dark:border-zinc-800 sticky top-0 bg-white dark:bg-black/90 backdrop-blur-md z-40 shrink-0">
        <button onClick={() => navigate(-1)} className="text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-400 hover:text-black dark:text-white transition-colors w-6 flex justify-start">
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
        <div className="p-6 flex items-center justify-between">
          <div className="relative shrink-0">
             <img src={user.avatar || undefined} alt="Profile" className="w-20 sm:w-24 h-20 sm:h-24 rounded-full bg-zinc-200 dark:bg-zinc-800 object-cover" />
             <div className="absolute inset-0 rounded-full ring-2 ring-indigo-500/30 ring-offset-4 ring-offset-white dark:ring-offset-black"></div>
          </div>
          <div className="flex gap-4 sm:gap-7 pr-2 text-center">
            <div className="flex flex-col items-center"><span className="font-bold text-lg sm:text-xl">{userPosts.length}</span><span className="text-[10px] text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 uppercase tracking-widest mt-1">Posts</span></div>
            <div className="flex flex-col items-center cursor-pointer hover:opacity-70" onClick={() => fetchModalUsers('followers')}><span className="font-bold text-lg sm:text-xl">{followerIds.length}</span><span className="text-[10px] text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 uppercase tracking-widest mt-1">Followers</span></div>
            <div className="flex flex-col items-center cursor-pointer hover:opacity-70" onClick={() => fetchModalUsers('following')}><span className="font-bold text-lg sm:text-xl">{followingIds.length}</span><span className="text-[10px] text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 uppercase tracking-widest mt-1">Following</span></div>
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
                  <span className="text-sm">{badge.icon}</span>
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
              <button onClick={handleMessage} className="flex-1 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-200 dark:bg-zinc-200 dark:bg-zinc-800 py-2.5 rounded-xl text-[12px] text-black dark:text-white uppercase tracking-widest font-bold transition-all text-center">Message</button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-0.5 sm:gap-1 p-0.5 sm:px-1 bg-white dark:bg-black">
          {userPosts.length === 0 ? (
            <div className="col-span-3 py-16 flex flex-col items-center justify-center text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 bg-zinc-100 dark:bg-zinc-900/30 rounded-xl m-4 border border-zinc-200 dark:border-zinc-800/50 block">
              <ImageIcon size={48} className="mb-4 opacity-40" />
              <p className="text-[13px] font-medium">No posts compiled yet</p>
            </div>
          ) : (
            userPosts.map(post => (
              <div key={post.id} className="pt-[100%] bg-zinc-100 dark:bg-zinc-900 relative group cursor-pointer overflow-hidden border border-zinc-200 dark:border-zinc-800" onClick={() => navigate(`/post/${post.id}/comments`)}>
                {post.imageUrl ? (
                  <>
                    <img src={post.imageUrl || undefined} alt="" className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    <div className="absolute inset-0 bg-white/0 dark:bg-white dark:bg-transparent/0 group-hover:bg-white/20 dark:group-hover:bg-white dark:bg-black/20 transition-colors" />
                  </>
                ) : (
                  <div className={cn("absolute inset-0 flex items-center justify-center p-2 text-center text-[10px] sm:text-xs font-medium overflow-hidden break-words", post.isItalic && "italic")}>{formatTextHighlight(post.caption)}</div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
      <FollowListModal isOpen={modalType !== null} onClose={() => setModalType(null)} title={modalType === 'followers' ? 'Followers' : 'Following'} users={modalUsers} />
      
      {showReportModal && (
        <div className="fixed inset-0 bg-white dark:bg-transparent/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-50 dark:bg-zinc-50 dark:bg-zinc-950 w-full max-w-sm rounded-[24px] p-6 flex flex-col gap-5 border border-zinc-200 dark:border-zinc-800 shadow-2xl relative">
            <button onClick={() => setShowReportModal(false)} className="absolute top-4 right-4 p-2 text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 hover:text-black dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-400 dark:hover:text-black dark:text-white transition-colors bg-zinc-100 dark:bg-zinc-900 rounded-full">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 dark:bg-rose-900/30 text-rose-500 flex items-center justify-center shrink-0">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
              </div>
              <div>
                <h3 className="text-[17px] font-bold text-zinc-900 dark:text-zinc-100">Report User</h3>
                <p className="text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 text-[13px] font-medium leading-snug tracking-wide mt-0.5">Help us keep the community safe.</p>
              </div>
            </div>
            
            <textarea 
              value={reportReason} 
              onChange={e => setReportReason(e.target.value)} 
              placeholder="Please describe why you are reporting this user..."
              className="mt-2 text-[14px] bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 outline-none min-h-[100px] resize-none text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-400"
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
          className="text-zinc-700 dark:text-zinc-300 hover:text-black dark:hover:text-black dark:text-white transition-colors w-6 flex justify-start"
        >
          {theme === 'light' ? <Moon size={22} /> : <Sun size={22} />}
        </button>
        <span className="font-bold text-[15px] tracking-wide text-zinc-900 dark:text-zinc-100">@{currentUser.username}</span>
        <button onClick={() => navigate('/settings')} className="text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 hover:text-black dark:hover:text-black dark:text-white transition-colors w-6 flex justify-end">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
        </button>
      </header>
      
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 flex items-center justify-between">
          <div className="relative shrink-0">
             <img src={currentUser.avatar || undefined} alt="Profile" className="w-20 sm:w-24 h-20 sm:h-24 rounded-full bg-zinc-200 dark:bg-zinc-800 object-cover" />
             <div className="absolute inset-0 rounded-full ring-2 ring-indigo-500/30 ring-offset-4 ring-offset-white dark:ring-offset-black"></div>
          </div>
          <div className="flex gap-4 sm:gap-7 pr-2 text-center">
            <div className="flex flex-col items-center"><span className="font-bold text-lg sm:text-xl">{myPosts.length}</span><span className="text-[10px] text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 uppercase tracking-widest mt-1">Posts</span></div>
            <div className="flex flex-col items-center cursor-pointer hover:opacity-70" onClick={() => fetchModalUsers('followers')}><span className="font-bold text-lg sm:text-xl">{followerIds.length}</span><span className="text-[10px] text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 uppercase tracking-widest mt-1">Followers</span></div>
            <div className="flex flex-col items-center cursor-pointer hover:opacity-70" onClick={() => fetchModalUsers('following')}><span className="font-bold text-lg sm:text-xl">{followingIds.length}</span><span className="text-[10px] text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 uppercase tracking-widest mt-1">Following</span></div>
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
                  <span className="text-sm">{badge.icon}</span>
                  <span className="text-[11px] font-bold text-yellow-700 dark:text-yellow-500 uppercase tracking-wider">{badge.name}</span>
                </div>
              ))}
            </div>
          )}

          <div className="mt-6 flex gap-3">
            <button onClick={() => navigate('/profile/edit')} className="flex-1 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-200 dark:bg-zinc-800 py-2.5 rounded-xl text-[12px] uppercase tracking-widest font-bold transition-all text-center text-zinc-700 dark:text-zinc-300 hover:text-black dark:text-white">Edit profile</button>
            <button onClick={() => {
              navigator.clipboard.writeText(window.location.href);
              showToast('Profile link copied!');
            }} className="flex-1 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-200 dark:bg-zinc-800 py-2.5 rounded-xl text-[12px] uppercase tracking-widest font-bold transition-all text-center text-zinc-700 dark:text-zinc-300 hover:text-black dark:text-white">Share profile</button>
            <button onClick={() => navigate('/settings')} className="bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-200 dark:bg-zinc-800 px-4 py-2.5 rounded-xl transition-all text-zinc-700 dark:text-zinc-300 hover:text-black dark:text-white">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-0.5 sm:gap-1 p-0.5 sm:px-1 bg-white dark:bg-black">
          {myPosts.length === 0 ? (
            <div className="col-span-3 py-16 flex flex-col items-center justify-center text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 bg-zinc-100 dark:bg-zinc-900/30 rounded-xl m-4 border border-zinc-200 dark:border-zinc-800/50 block">
              <ImageIcon size={48} className="mb-4 opacity-40" />
              <p className="text-[13px] font-medium">No posts compiled yet</p>
            </div>
          ) : (
            myPosts.map(post => (
              <div key={post.id} className="pt-[100%] bg-zinc-100 dark:bg-zinc-900 relative group cursor-pointer overflow-hidden border border-zinc-200 dark:border-zinc-800" onClick={() => navigate(`/post/${post.id}/comments`)}>
                {post.imageUrl ? (
                  <>
                    <img src={post.imageUrl || undefined} alt="" className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    <div className="absolute inset-0 bg-white/0 dark:bg-white dark:bg-transparent/0 group-hover:bg-white/20 dark:group-hover:bg-white dark:bg-black/20 transition-colors" />
                  </>
                ) : (
                  <div className={cn("absolute inset-0 flex items-center justify-center p-2 text-center text-[10px] sm:text-xs font-medium overflow-hidden break-words", post.isItalic && "italic")}>{formatTextHighlight(post.caption)}</div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
      <FollowListModal isOpen={modalType !== null} onClose={() => setModalType(null)} title={modalType === 'followers' ? 'Followers' : 'Following'} users={modalUsers} />
    </motion.div>
  );
};

// --- APP ROOT ------ APP ROOT ---

const AuthScreen = () => {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loginInput, setLoginInput] = useState('');
  const [password, setPassword] = useState('');

  const handleGoogleLogin = async (useRedirect = false) => {
    setLoading(true);
    setErrorMsg('');
    const provider = new GoogleAuthProvider();
    try {
      if (useRedirect) {
        const { signInWithRedirect } = await import('firebase/auth');
        await signInWithRedirect(auth, provider);
      } else {
        await signInWithPopup(auth, provider);
      }
    } catch (e: any) {
      console.error(e);
      setLoading(false);
      if (e.code === 'auth/popup-closed-by-user') {
        setErrorMsg('Login popup was closed before completing. Please try again.');
      } else if (e.code === 'auth/unauthorized-domain') {
        setErrorMsg('This domain is not authorized. Please add your Vercel domain to Firebase Console -> Authentication -> Settings -> Authorized domains.');
      } else {
        setErrorMsg(e.message || 'Failed to sign in. Please try again.');
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
    
    // Auto-detect if input is username or email
    let finalEmail = loginInput;
    if (!loginInput.includes('@')) {
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

  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-white dark:bg-black p-6 h-full relative z-[200]">
      <h1 className="text-4xl font-bold italic text-black dark:text-white mb-2 font-sans tracking-tight">FineWord</h1>
      <p className="text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-400 mb-8 text-center max-w-[260px] text-[14px] leading-relaxed">
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
          <div className="h-px bg-zinc-300 dark:bg-zinc-300 dark:bg-zinc-300 dark:bg-zinc-700 flex-1"></div>
          <span className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-500 dark:text-zinc-500">OR</span>
          <div className="h-px bg-zinc-300 dark:bg-zinc-300 dark:bg-zinc-300 dark:bg-zinc-700 flex-1"></div>
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
          className="w-full bg-transparent text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 font-medium py-2 rounded-xl text-[12px] hover:text-zinc-700 dark:hover:text-zinc-700 dark:text-zinc-700 dark:text-zinc-300 transition-colors disabled:opacity-50 mt-2"
        >
          {isSignUp ? 'Already have an account? Sign In' : 'Need an account? Sign Up'}
        </button>
      </div>
    </div>
  );
};

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
               showToast('Account deactivated');
               auth.signOut();
               setCurrentUser(null);
               setIsAuthChecking(false);
               return;
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
              bio: 'Welcome to FineWord'
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
            bio: 'Welcome to FineWord'
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
    if (!currentUser) {
      setPosts([]);
      return;
    }
    const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const dbPosts: Post[] = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        dbPosts.push({
          ...data,
          id: doc.id,
          createdAt: data.createdAt?.toDate?.() || new Date(),
        } as Post);
      });
      setPosts(dbPosts);
    }, (error) => {
      console.error("Posts fetch error:", error.message);
    });
    return unsubscribe;
  }, [currentUser]);

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
    if (!currentUser) return;
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
    const newMsg: any = {
      id: msgId,
      chatId,
      senderId: currentUser.id,
      text: text || '',
      createdAt: serverTimestamp(),
    };
    if (imageUrl) newMsg.imageUrl = imageUrl;
    if (videoUrl) newMsg.videoUrl = videoUrl;
    try {
      await setDoc(doc(db, `chats/${chatId}/messages`, msgId), newMsg);
      await updateDoc(doc(db, 'chats', chatId), {
        lastMessage: text || (imageUrl ? 'Sent an image' : (videoUrl ? 'Sent a video' : '')),
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

  const appBgStyle = currentUser?.appThemeParams?.feedColor ? { backgroundColor: currentUser.appThemeParams.feedColor } : {};

  return (
    <AppContext.Provider value={{ currentUser, logout, updateProfile, posts, setPosts, updatePost, deletePost, deleteChat, removeGroupMember, chats, messages, setMessages, notifications, followingIds, toggleLike, sendMessage, deleteMessage, showToast, theme, setTheme: updateTheme }}>
      {currentUser?.appThemeParams?.feedColor && (
        <style dangerouslySetInnerHTML={{ __html: `
          body, html, .bg-white.dark\\:bg-black {
            background-color: ${currentUser.appThemeParams.feedColor} !important;
          }
        `}} />
      )}
      <div className="min-h-[100dvh] h-[100dvh] bg-white dark:bg-black text-black dark:text-white font-sans flex justify-center w-full" style={appBgStyle}>
        <div className="w-full h-full max-w-5xl bg-white dark:bg-black relative flex flex-col overflow-hidden" style={appBgStyle}>
          
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
          </AnimatePresence>
          
          {isAuthChecking ? (
            <div className="flex-1 flex justify-center items-center bg-white dark:bg-black"><span className="text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 dark:text-zinc-500 font-bold tracking-widest uppercase text-xs">Loading...</span></div>
          ) : !currentUser ? (
            <AuthScreen />
          ) : (
            <BrowserRouter>
              <div className="flex-1 flex flex-col md:flex-row min-h-0 relative w-full h-full">
                <div className="hidden md:flex flex-col w-[80px] lg:w-[240px] shrink-0 border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black relative z-40">
                   <SideNav />
                </div>
                <div className="flex-1 flex flex-col min-h-0 relative w-full max-w-[600px] mx-auto pt-safe sm:border-x border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black" style={appBgStyle}>
                  <AnimatePresence mode="wait">
                    <Routes>
                      <Route path="/" element={<FeedScreen />} />
                      <Route path="/notifications" element={<NotificationsScreen />} />
                      <Route path="/search" element={<SearchScreen />} />
                      <Route path="/create" element={<CreatePostScreen />} />
                      <Route path="/contests" element={<ContestsScreen />} />
                      <Route path="/contest/:id" element={<ContestDetailScreen />} />
                      <Route path="/chat" element={<ChatListScreen />} />
                      <Route path="/chat/group/create" element={<CreateGroupChatScreen />} />
                      <Route path="/chat/:id" element={<ChatRoomScreen />} />
                      <Route path="/post/:postId/comments" element={<CommentsScreen />} />
                      <Route path="/profile" element={<ProfileScreen />} />
                      <Route path="/profile/edit" element={<EditProfileScreen />} />
                      <Route path="/settings" element={<SettingsScreen />} />
                      <Route path="/admin" element={<AdminDashboardScreen />} />
                      <Route path="/:username" element={<UserProfileScreen />} />
                    </Routes>
                  </AnimatePresence>
                </div>
                <div className="hidden xl:block w-[240px] shrink-0" />
              </div>
              <div className="md:hidden shrink-0">
                <BottomNav />
              </div>
            </BrowserRouter>
          )}
        </div>
      </div>
    </AppContext.Provider>
  );
}
