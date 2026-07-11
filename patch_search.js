import fs from 'fs';
let code = fs.readFileSync('src/App.tsx', 'utf8');

const oldCode = `              <div className="grid grid-cols-3 gap-1">
                {(queryText.trim() ? matchedPosts : randomPosts).map(post => (
                  <Link key={post.id} to={\`/post/\${post.id}\`} className="aspect-square bg-zinc-100 dark:bg-zinc-900 relative block group">
                     {post.imageUrl ? (
                       <img src={post.imageUrl} alt="" className="w-full h-full object-cover" />
                     ) : post.videoUrl ? (
                       <ChunkedVideoPlayer videoUrl={post.videoUrl} postId={post.id} className="w-full h-full object-cover pointer-events-none" />
                     ) : (
                       <div className="w-full h-full flex items-center justify-center p-2 text-center text-[10px] break-words">
                         <span className="line-clamp-3">{post.caption}</span>
                       </div>
                     )}
                     <div className="absolute inset-0 bg-white dark:bg-transparent/0 group-hover:bg-white dark:bg-black/20 transition-colors" />
                     {post.videoUrl && (
                        <div className="absolute top-1 right-1 bg-black/50 rounded p-1">
                           <Video size={12} className="text-white" />
                        </div>
                     )}
                  </Link>
                ))}
              </div>`;

const newCode = `              <div className="grid grid-cols-3 gap-1">
                {(queryText.trim() ? matchedPosts : randomPosts).map(post => (
                  <Link key={post.id} to={\`/post/\${post.id}/comments\`} className="aspect-square bg-zinc-100 dark:bg-zinc-900 relative block group overflow-hidden">
                     {post.imageUrl ? (
                       <img src={post.imageUrl} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                     ) : post.videoUrl ? (
                       <ChunkedVideoPlayer videoUrl={post.videoUrl} postId={post.id} className="w-full h-full object-cover pointer-events-none group-hover:scale-105 transition-transform duration-500" />
                     ) : (
                       <div className="w-full h-full flex items-center justify-center p-2 text-center text-[10px] break-words group-hover:scale-105 transition-transform duration-500">
                         <span className="line-clamp-3">{post.caption}</span>
                       </div>
                     )}
                     <div className="absolute inset-0 bg-transparent group-hover:bg-black/10 dark:group-hover:bg-white/10 transition-colors" />
                     {post.videoUrl && (
                        <div className="absolute top-1 right-1 bg-black/50 rounded p-1">
                           <Video size={12} className="text-white" />
                        </div>
                     )}
                  </Link>
                ))}
              </div>`;

code = code.replace(oldCode, newCode);
fs.writeFileSync('src/App.tsx', code);
