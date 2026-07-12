import fs from 'fs';

let code = fs.readFileSync('src/App.tsx', 'utf8');

const regex = /<BrowserRouter>\s*<div className="flex-1 flex flex-col md:flex-row min-h-0 relative w-full h-full justify-center">[\s\S]*?<\/BrowserRouter>/;

const newCode = `<BrowserRouter>
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
            </BrowserRouter>`;

code = code.replace(regex, newCode);

fs.writeFileSync('src/App.tsx', code);
