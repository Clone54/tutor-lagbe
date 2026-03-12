import React, { useState, useEffect, useMemo } from 'react';
import { 
  auth, 
  db, 
  googleProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  collection,
  doc,
  setDoc,
  getDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  serverTimestamp
} from './firebase';
import { 
  Role, 
  UserProfile, 
  TuitionPost, 
  TutorRequest, 
  OperationType, 
  FirestoreErrorInfo 
} from './types';
import { 
  LogOut, 
  Plus, 
  Search, 
  MapPin, 
  BookOpen, 
  GraduationCap, 
  DollarSign, 
  Phone, 
  User, 
  CheckCircle2, 
  XCircle, 
  Clock,
  MessageSquare,
  ChevronRight,
  Loader2,
  Trophy,
  Mail,
  Lock,
  Eye,
  EyeOff,
  PhoneCall,
  Edit3,
  Briefcase,
  ShieldCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { formatDistanceToNow } from 'date-fns';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Error Handler
function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Error Boundary Component
interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: any;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      let message = "Something went wrong.";
      try {
        const parsed = JSON.parse(this.state.error.message);
        message = `Database Error: ${parsed.error}`;
      } catch (e) {
        message = this.state.error.message || message;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-red-50 p-4">
          <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center">
            <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Oops!</h2>
            <p className="text-gray-600 mb-6">{message}</p>
            <button 
              onClick={() => window.location.reload()}
              className="bg-red-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-red-700 transition-colors"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState<TuitionPost[]>([]);
  const [myRequests, setMyRequests] = useState<TutorRequest[]>([]);
  const [activeTab, setActiveTab] = useState<'browse' | 'my-posts' | 'my-requests' | 'profile'>('browse');
  const [showPostModal, setShowPostModal] = useState(false);
  const [showProfileEdit, setShowProfileEdit] = useState(false);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const docRef = doc(db, 'users', currentUser.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            setProfile(docSnap.data() as UserProfile);
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, `users/${currentUser.uid}`);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  // Posts Listener
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const postsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TuitionPost));
      setPosts(postsData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'posts');
    });
    return unsubscribe;
  }, [user]);

  // Requests Listener
  useEffect(() => {
    if (!user || !profile) return;
    const q = profile.role === 'tutor' 
      ? query(collection(db, 'requests'), where('tutorId', '==', user.uid))
      : query(collection(db, 'requests'), where('guardianId', '==', user.uid), orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const requestsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TutorRequest));
      setMyRequests(requestsData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'requests');
    });
    return unsubscribe;
  }, [user, profile]);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Login failed", error);
    }
  };

  const handleRoleSelection = async (role: Role, institution?: string) => {
    if (!user) return;
    const newProfile: UserProfile = {
      uid: user.uid,
      name: user.displayName || 'Anonymous',
      email: user.email || '',
      phone: '', // Will be updated in profile
      role,
      institution: institution || '',
      isVerified: true, // Google users are pre-verified for simplicity in this demo
      createdAt: serverTimestamp()
    };
    try {
      await setDoc(doc(db, 'users', user.uid), newProfile);
      setProfile(newProfile);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `users/${user.uid}`);
    }
  };

  const handleUpdateProfile = async (updatedData: Partial<UserProfile>) => {
    if (!user || !profile) return;
    try {
      await updateDoc(doc(db, 'users', user.uid), updatedData);
      setProfile({ ...profile, ...updatedData });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <LandingPage onLogin={handleLogin} />;
  }

  if (!profile) {
    return <RoleSelection onSelect={handleRoleSelection} />;
  }

  const currentProfile = profile;

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
        {/* Navigation */}
        <nav className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16 items-center">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                  <GraduationCap className="w-6 h-6" />
                </div>
                <span className="text-xl font-bold tracking-tight text-slate-900">Tutor Lagbe <span className="text-indigo-600">Rajshahi</span></span>
              </div>
              
              <div className="flex items-center gap-4">
                <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-full text-sm font-medium text-slate-600">
                  <User className="w-4 h-4" />
                  {profile.name} ({profile.role})
                </div>
                <button 
                  onClick={() => signOut(auth)}
                  className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </nav>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Dashboard Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 mb-2">
                Welcome back, {profile.name.split(' ')[0]}!
              </h1>
              <p className="text-slate-500">
                {profile.role === 'guardian' 
                  ? "Find the perfect tutor for your child from RUET, RU, or RMC."
                  : "Explore available tuition opportunities in Rajshahi."}
              </p>
            </div>
            
            {profile.role === 'guardian' && (
              <button 
                onClick={() => setShowPostModal(true)}
                className="flex items-center justify-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-xl font-semibold shadow-lg shadow-indigo-200 hover:bg-indigo-700 hover:-translate-y-0.5 transition-all"
              >
                <Plus className="w-5 h-5" />
                Post Tuition Requirement
              </button>
            )}
          </div>

          {/* Tabs */}
          <div className="flex gap-1 p-1 bg-slate-200/50 rounded-xl w-fit mb-8">
            <TabButton 
              active={activeTab === 'browse'} 
              onClick={() => setActiveTab('browse')}
              icon={<Search className="w-4 h-4" />}
              label="Browse Posts"
            />
            {profile.role === 'guardian' ? (
              <TabButton 
                active={activeTab === 'my-posts'} 
                onClick={() => setActiveTab('my-posts')}
                icon={<BookOpen className="w-4 h-4" />}
                label="My Posts"
              />
            ) : (
              <TabButton 
                active={activeTab === 'my-requests'} 
                onClick={() => setActiveTab('my-requests')}
                icon={<MessageSquare className="w-4 h-4" />}
                label="My Requests"
              />
            )}
            <TabButton 
              active={activeTab === 'profile'} 
              onClick={() => setActiveTab('profile')}
              icon={<User className="w-4 h-4" />}
              label="My Profile"
            />
          </div>

          {/* Content */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === 'profile' && (
                <ProfileView profile={currentProfile} onUpdate={handleUpdateProfile} />
              )}
              
              {activeTab === 'browse' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {posts.filter(p => p.status === 'open').map(post => (
                    <PostCard key={post.id} post={post} profile={currentProfile} myRequests={myRequests} />
                  ))}
                  {posts.filter(p => p.status === 'open').length === 0 && (
                    <div className="col-span-full py-20 text-center bg-white rounded-3xl border-2 border-dashed border-slate-200">
                      <Search className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                      <p className="text-slate-500 font-medium">No active posts found at the moment.</p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'my-posts' && (
                <div className="space-y-6">
                  {posts.filter(p => p.guardianId === user.uid).map(post => (
                    <MyPostRow key={post.id} post={post} requests={myRequests.filter(r => r.postId === post.id)} />
                  ))}
                  {posts.filter(p => p.guardianId === user.uid).length === 0 && (
                    <div className="py-20 text-center bg-white rounded-3xl border-2 border-dashed border-slate-200">
                      <Plus className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                      <p className="text-slate-500 font-medium">You haven't posted any requirements yet.</p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'my-requests' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {myRequests.map(req => (
                    <RequestCard key={req.id} request={req} post={posts.find(p => p.id === req.postId)} />
                  ))}
                  {myRequests.length === 0 && (
                    <div className="col-span-full py-20 text-center bg-white rounded-3xl border-2 border-dashed border-slate-200">
                      <MessageSquare className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                      <p className="text-slate-500 font-medium">You haven't made any requests yet.</p>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </main>

        {/* Post Modal */}
        <AnimatePresence>
          {showPostModal && (
            <PostModal 
              onClose={() => setShowPostModal(false)} 
              profile={profile}
            />
          )}
        </AnimatePresence>
      </div>
    </ErrorBoundary>
  );
}

function LandingPage({ onLogin }: { onLogin: () => void }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<Role>('guardian');
  const [institution, setInstitution] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Stats removed as per user request

  // Verification State
  const [showVerification, setShowVerification] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [sentCode, setSentCode] = useState('');
  const [tempUser, setTempUser] = useState<any>(null);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        // Registration
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        setSentCode(code);
        setTempUser(userCredential.user);
        setShowVerification(true);
        // In a real app, you'd send this via SMS/Email
        console.log(`Verification Code for ${email}: ${code}`);
        alert(`Verification Code (Simulated): ${code}`);
      }
    } catch (err: any) {
      console.error("Auth error", err);
      setError(err.message || "Authentication failed. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (verificationCode === sentCode && tempUser) {
      try {
        const newProfile: UserProfile = {
          uid: tempUser.uid,
          name,
          email,
          phone,
          role,
          institution: role === 'tutor' ? institution : undefined,
          isVerified: true,
          createdAt: serverTimestamp()
        };
        await setDoc(doc(db, 'users', tempUser.uid), newProfile);
        // Profile will be loaded by the main App's auth listener
      } catch (err: any) {
        setError("Failed to create profile: " + err.message);
      }
    } else {
      setError("Invalid verification code.");
    }
  };

  if (showVerification) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full"
        >
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900">Verify Your Account</h2>
            <p className="text-slate-500 mt-2">We've sent a 6-digit code to your email/phone.</p>
          </div>

          <form onSubmit={handleVerify} className="space-y-6">
            {error && (
              <div className="p-4 bg-red-50 text-red-600 text-sm rounded-xl flex items-center gap-2">
                <XCircle className="w-4 h-4" />
                {error}
              </div>
            )}
            <div>
              <input 
                type="text"
                maxLength={6}
                required
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                placeholder="Enter 6-digit code"
                className="w-full text-center text-3xl tracking-[0.5em] font-bold py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            <button 
              type="submit"
              className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold text-lg hover:bg-indigo-700 transition-all"
            >
              Confirm Registration
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white overflow-hidden flex flex-col md:flex-row">
      {/* Left Side: Hero */}
      <div className="relative flex-1 pt-20 pb-32 flex flex-col items-center px-4 md:px-12 justify-center bg-slate-50">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-indigo-50 rounded-full blur-3xl -z-10 opacity-50" />
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center md:text-left max-w-2xl"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-full text-sm font-bold mb-8">
            <Trophy className="w-4 h-4" />
            #1 Tutor Platform in Rajshahi
          </div>
          <h1 className="text-5xl md:text-6xl font-black text-slate-900 leading-tight mb-6">
            Find the Best Tutor from <span className="text-indigo-600 italic">RUET, RU & RMC</span>
          </h1>
          <p className="text-lg text-slate-600 mb-10 leading-relaxed">
            Connecting dedicated guardians with brilliant students from Rajshahi's top institutions. 
            Smart, secure, and specifically built for our city.
          </p>
          
        </motion.div>
      </div>

      {/* Right Side: Auth Form */}
      <div className="flex-1 flex items-center justify-center p-6 md:p-12 bg-white">
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="w-full max-w-md"
        >
          <div className="mb-10 text-center md:text-left">
            <h2 className="text-3xl font-bold text-slate-900 mb-2">
              {isLogin ? "Welcome Back" : "Create Account"}
            </h2>
            <p className="text-slate-500">
              {isLogin ? "Sign in to access your dashboard" : "Join the community today"}
            </p>
          </div>

          <form onSubmit={handleEmailAuth} className="space-y-4">
            {error && (
              <div className="p-4 bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl flex items-center gap-3">
                <XCircle className="w-5 h-5 shrink-0" />
                {error}
              </div>
            )}

            {!isLogin && (
              <>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">Full Name</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input 
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Enter your name"
                      className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">Phone Number</label>
                  <div className="relative">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input 
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="017XXXXXXXX"
                      className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1.5">I am a</label>
                    <select 
                      value={role}
                      onChange={(e) => setRole(e.target.value as Role)}
                      className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium"
                    >
                      <option value="guardian">Guardian</option>
                      <option value="tutor">Tutor</option>
                    </select>
                  </div>
                  {role === 'tutor' && (
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1.5">Institution</label>
                      <select 
                        value={institution}
                        onChange={(e) => setInstitution(e.target.value)}
                        className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium"
                      >
                        <option value="">Select</option>
                        <option value="RUET">RUET</option>
                        <option value="RU">RU</option>
                        <option value="RMC">RMC</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                  )}
                </div>
              </>
            )}

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input 
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input 
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-12 pr-12 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                />
                <button 
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button 
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold text-lg shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (isLogin ? "Sign In" : "Get Verification Code")}
            </button>
          </form>

          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-100"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white text-slate-400 font-medium uppercase tracking-wider">Or continue with</span>
            </div>
          </div>

          <button 
            onClick={onLogin}
            className="w-full flex items-center justify-center gap-3 py-4 border-2 border-slate-100 rounded-2xl font-bold text-slate-700 hover:bg-slate-50 transition-all"
          >
            <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
            Google Account
          </button>

          <p className="mt-8 text-center text-slate-500">
            {isLogin ? "Don't have an account?" : "Already have an account?"}
            <button 
              onClick={() => setIsLogin(!isLogin)}
              className="ml-2 text-indigo-600 font-bold hover:underline"
            >
              {isLogin ? "Sign Up" : "Sign In"}
            </button>
          </p>
        </motion.div>
      </div>
    </div>
  );
}

function ProfileView({ profile, onUpdate }: { profile: UserProfile; onUpdate: (data: Partial<UserProfile>) => Promise<void> }) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: profile.name || '',
    phone: profile.phone || '',
    institution: profile.institution || '',
    qualifications: profile.qualifications || '',
    experience: profile.experience || ''
  });

  // Sync form data when profile changes or editing starts
  useEffect(() => {
    if (!isEditing) {
      setFormData({
        name: profile.name || '',
        phone: profile.phone || '',
        institution: profile.institution || '',
        qualifications: profile.qualifications || '',
        experience: profile.experience || ''
      });
    }
  }, [profile, isEditing]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onUpdate(formData);
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Header/Cover */}
        <div className="h-32 bg-gradient-to-r from-indigo-600 to-violet-600 relative">
          <div className="absolute -bottom-12 left-8">
            <div className="w-24 h-24 bg-white rounded-3xl p-1 shadow-lg">
              <div className="w-full h-full bg-slate-100 rounded-2xl flex items-center justify-center text-indigo-600">
                <User className="w-12 h-12" />
              </div>
            </div>
          </div>
        </div>

        <div className="pt-16 pb-8 px-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <div>
              <h2 className="text-3xl font-bold text-slate-900 tracking-tight">{profile.name}</h2>
              <div className="flex flex-wrap items-center gap-4 mt-2">
                <span className="flex items-center gap-1.5 text-slate-500 text-sm font-medium">
                  <Mail className="w-4 h-4" /> {profile.email}
                </span>
                <span className="px-2.5 py-0.5 bg-indigo-50 text-indigo-700 text-xs font-bold uppercase tracking-wider rounded-full">
                  {profile.role}
                </span>
                {profile.isVerified && (
                  <span className="flex items-center gap-1 text-emerald-600 text-sm font-bold">
                    <CheckCircle2 className="w-4 h-4" /> Verified
                  </span>
                )}
              </div>
            </div>
            <button 
              onClick={() => setIsEditing(!isEditing)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold transition-all ${
                isEditing 
                ? "bg-slate-100 text-slate-600 hover:bg-slate-200" 
                : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-md shadow-indigo-200"
              }`}
            >
              {isEditing ? (
                <>Cancel</>
              ) : (
                <>
                  <Edit3 className="w-4 h-4" />
                  Edit Profile
                </>
              )}
            </button>
          </div>

          <div className="h-px bg-slate-100 mb-8" />

          {isEditing ? (
            <form onSubmit={handleSubmit} className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Full Name</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input 
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all font-medium"
                      placeholder="Your full name"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Phone Number</label>
                  <div className="relative">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input 
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all font-medium"
                      placeholder="e.g. 017XXXXXXXX"
                    />
                  </div>
                </div>

                {profile.role === 'tutor' && (
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Institution</label>
                    <div className="relative">
                      <GraduationCap className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <select 
                        value={formData.institution}
                        onChange={(e) => setFormData({ ...formData, institution: e.target.value })}
                        className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all font-medium appearance-none"
                      >
                        <option value="">Select Institution</option>
                        <option value="RUET">RUET</option>
                        <option value="RU">RU</option>
                        <option value="RMC">RMC</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {profile.role === 'tutor' && (
                <div className="space-y-8">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Qualifications</label>
                    <textarea 
                      value={formData.qualifications}
                      onChange={(e) => setFormData({ ...formData, qualifications: e.target.value })}
                      placeholder="e.g. B.Sc in CSE from RUET, HSC from Rajshahi College"
                      className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all font-medium"
                      rows={3}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Teaching Experience</label>
                    <textarea 
                      value={formData.experience}
                      onChange={(e) => setFormData({ ...formData, experience: e.target.value })}
                      placeholder="e.g. 2 years of experience in teaching Math and Physics"
                      className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all font-medium"
                      rows={3}
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-4 pt-4">
                <button 
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-8 py-3.5 rounded-2xl font-bold text-slate-600 hover:bg-slate-100 transition-all"
                >
                  Discard
                </button>
                <button 
                  type="submit"
                  disabled={isSaving}
                  className="px-12 py-3.5 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 flex items-center gap-2 disabled:opacity-70"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>Save Changes</>
                  )}
                </button>
              </div>
            </form>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <ProfileItem icon={<Phone className="w-5 h-5" />} label="Phone" value={profile.phone} />
              <ProfileItem icon={<ShieldCheck className="w-5 h-5" />} label="Account Status" value={profile.isVerified ? "Verified" : "Pending Verification"} />
              
              {profile.role === 'tutor' && (
                <>
                  <ProfileItem icon={<GraduationCap className="w-5 h-5" />} label="Institution" value={profile.institution} />
                  <div className="md:col-span-2 space-y-6 mt-4">
                    <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">
                        <BookOpen className="w-4 h-4" /> Qualifications
                      </div>
                      <p className="text-slate-700 leading-relaxed whitespace-pre-wrap font-medium">
                        {profile.qualifications || "No qualifications listed yet."}
                      </p>
                    </div>
                    <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">
                        <Briefcase className="w-4 h-4" /> Experience
                      </div>
                      <p className="text-slate-700 leading-relaxed whitespace-pre-wrap font-medium">
                        {profile.experience || "No experience listed yet."}
                      </p>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ProfileItem({ icon, label, value }: { icon: React.ReactNode; label: string; value?: string }) {
  return (
    <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 flex items-start gap-4">
      <div className="w-10 h-10 bg-white rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm border border-slate-100">
        {icon}
      </div>
      <div>
        <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">{label}</div>
        <div className="text-slate-900 font-bold">{value || "Not provided"}</div>
      </div>
    </div>
  );
}

function StatCard({ icon, title, label }: { icon: React.ReactNode; title: string; label: string }) {
  return (
    <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-6">
      <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center [&_svg]:w-7 [&_svg]:h-7">
        {icon}
      </div>
      <div>
        <div className="text-2xl font-black text-slate-900">{title}</div>
        <div className="text-slate-500 font-medium">{label}</div>
      </div>
    </div>
  );
}

function RoleSelection({ onSelect }: { onSelect: (role: Role, institution?: string) => void }) {
  const [role, setRole] = useState<Role | null>(null);
  const [institution, setInstitution] = useState('');

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white p-10 rounded-3xl shadow-xl max-w-2xl w-full"
      >
        <h2 className="text-3xl font-bold text-slate-900 mb-2 text-center">Complete Your Profile</h2>
        <p className="text-slate-500 text-center mb-10">Tell us how you want to use the platform.</p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
          <RoleCard 
            active={role === 'guardian'} 
            onClick={() => setRole('guardian')}
            title="I'm a Guardian"
            description="Looking for a qualified tutor for my child."
            icon={<User className="w-8 h-8" />}
          />
          <RoleCard 
            active={role === 'tutor'} 
            onClick={() => setRole('tutor')}
            title="I'm a Tutor"
            description="I want to teach and share my knowledge."
            icon={<GraduationCap className="w-8 h-8" />}
          />
        </div>

        {role === 'tutor' && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mb-8"
          >
            <label className="block text-sm font-bold text-slate-700 mb-2">Your Institution</label>
            <select 
              value={institution}
              onChange={(e) => setInstitution(e.target.value)}
              className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
            >
              <option value="">Select Institution</option>
              <option value="RUET">RUET</option>
              <option value="RU">Rajshahi University (RU)</option>
              <option value="RMC">Rajshahi Medical College (RMC)</option>
              <option value="Other">Other</option>
            </select>
          </motion.div>
        )}

        <button 
          disabled={!role || (role === 'tutor' && !institution)}
          onClick={() => role && onSelect(role, institution)}
          className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
        >
          Continue to Dashboard
        </button>
      </motion.div>
    </div>
  );
}

function RoleCard({ active, onClick, title, description, icon }: { active: boolean; onClick: () => void; title: string; description: string; icon: React.ReactNode }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "p-8 rounded-2xl border-2 text-left transition-all",
        active ? "border-indigo-600 bg-indigo-50 ring-4 ring-indigo-50" : "border-slate-100 hover:border-slate-200 bg-white"
      )}
    >
      <div className={cn("w-14 h-14 rounded-xl flex items-center justify-center mb-6", active ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600")}>
        {icon}
      </div>
      <h3 className="text-xl font-bold text-slate-900 mb-2">{title}</h3>
      <p className="text-slate-500 text-sm leading-relaxed">{description}</p>
    </button>
  );
}

function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm transition-all",
        active ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function PostCard({ post, profile, myRequests }: { post: TuitionPost; profile: UserProfile; myRequests: TutorRequest[] }) {
  const [showApply, setShowApply] = useState(false);
  const [message, setMessage] = useState('');
  const [applying, setApplying] = useState(false);
  const [showContact, setShowContact] = useState(false);

  const hasRequested = useMemo(() => 
    myRequests.some(req => req.postId === post.id),
    [myRequests, post.id]
  );

  const handleApply = async () => {
    if (!message.trim()) return;
    if (hasRequested) {
      alert("You have already requested this tuition.");
      return;
    }
    setApplying(true);
    try {
      const requestId = `${profile.uid}_${post.id}`;
      await setDoc(doc(db, 'requests', requestId), {
        postId: post.id,
        guardianId: post.guardianId,
        tutorId: profile.uid,
        tutorName: profile.name,
        tutorInstitution: profile.institution,
        tutorQualifications: profile.qualifications,
        tutorExperience: profile.experience,
        tutorPhone: profile.phone,
        message,
        status: 'pending',
        createdAt: serverTimestamp()
      });
      setShowApply(false);
      alert("Application sent successfully!");
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'requests');
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-4">
        <div className="flex flex-col gap-1">
          <div className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-bold uppercase tracking-wider w-fit">
            Class {post.studentClass}
          </div>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">
            {post.daysPerWeek} days / week
          </div>
        </div>
        <div className="text-xs text-slate-400 font-medium">
          {formatDistanceToNow(post.createdAt?.toDate() || new Date())} ago
        </div>
      </div>
      
      <h3 className="text-xl font-bold text-slate-900 mb-4 line-clamp-1">{post.subjects}</h3>
      
      <div className="space-y-3 mb-6">
        <div className="flex items-center justify-between">
          <InfoItem icon={<MapPin className="w-4 h-4" />} text={post.location} />
        </div>
        <InfoItem icon={<GraduationCap className="w-4 h-4" />} text={`Prefer: ${post.preferredInstitution}`} />
        <InfoItem icon={<DollarSign className="w-4 h-4" />} text={`${post.budget} / month`} />
      </div>

      {profile.role === 'tutor' && (
        <div className="pt-4 border-t border-slate-50 space-y-3">
          {showContact ? (
            <div className="bg-emerald-50 p-4 rounded-2xl flex items-center justify-between animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-600 text-white rounded-xl flex items-center justify-center">
                  <Phone className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-[10px] font-bold text-emerald-600 uppercase">Guardian Contact</div>
                  <div className="font-bold text-slate-900">{post.contactInfo}</div>
                </div>
              </div>
              <a 
                href={`tel:${post.contactInfo}`}
                className="p-3 bg-white text-emerald-600 rounded-xl shadow-sm hover:shadow-md transition-all"
              >
                <PhoneCall className="w-5 h-5" />
              </a>
            </div>
          ) : (
            <button 
              onClick={() => setShowContact(true)}
              className="w-full py-3 bg-emerald-50 text-emerald-700 rounded-xl font-bold text-sm hover:bg-emerald-100 transition-all flex items-center justify-center gap-2"
            >
              <Phone className="w-4 h-4" /> View Contact & Call
            </button>
          )}

          {!showApply ? (
            <button 
              disabled={hasRequested}
              onClick={() => setShowApply(true)}
              className={cn(
                "w-full py-3 rounded-xl font-bold transition-all",
                hasRequested 
                  ? "bg-slate-100 text-slate-400 cursor-not-allowed" 
                  : "bg-slate-900 text-white hover:bg-slate-800"
              )}
            >
              {hasRequested ? 'Already Requested' : 'Request Tuition'}
            </button>
          ) : (
            <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2">
              <textarea 
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Write a short message to the guardian..."
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                rows={3}
              />
              <div className="flex gap-2">
                <button 
                  disabled={applying}
                  onClick={handleApply}
                  className="flex-1 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 disabled:opacity-50"
                >
                  {applying ? 'Sending...' : 'Send Request'}
                </button>
                <button 
                  onClick={() => setShowApply(false)}
                  className="px-4 py-2.5 bg-slate-100 text-slate-600 rounded-lg text-sm font-bold hover:bg-slate-200"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function InfoItem({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-3 text-slate-600">
      <div className="text-slate-400">{icon}</div>
      <span className="text-sm font-medium">{text}</span>
    </div>
  );
}

function MyPostRow({ post, requests }: { post: TuitionPost; requests: TutorRequest[] }) {
  const [expanded, setExpanded] = useState(false);

  const handleStatusChange = async (status: 'open' | 'filled' | 'closed') => {
    try {
      await updateDoc(doc(db, 'posts', post.id), { status });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `posts/${post.id}`);
    }
  };

  const handleRequestStatus = async (reqId: string, status: 'accepted' | 'rejected') => {
    try {
      await updateDoc(doc(db, 'requests', reqId), { status });
      if (status === 'accepted') {
        await updateDoc(doc(db, 'posts', post.id), { status: 'filled' });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `requests/${reqId}`);
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className={cn(
            "w-12 h-12 rounded-2xl flex items-center justify-center",
            post.status === 'open' ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-400"
          )}>
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900">{post.subjects}</h3>
            <p className="text-sm text-slate-500">Class {post.studentClass} • {post.location}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <select 
            value={post.status}
            onChange={(e) => handleStatusChange(e.target.value as any)}
            className="text-sm font-bold bg-slate-50 border-none rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500"
          >
            <option value="open">Open</option>
            <option value="filled">Filled</option>
            <option value="closed">Closed</option>
          </select>
          
          <button 
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-lg text-sm font-bold hover:bg-indigo-100 transition-all"
          >
            {requests.length} Requests
            <ChevronRight className={cn("w-4 h-4 transition-transform", expanded && "rotate-90")} />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div 
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            className="border-t border-slate-50 bg-slate-50/30"
          >
            <div className="p-6 space-y-4">
              {requests.length === 0 && <p className="text-sm text-slate-400 text-center py-4">No requests yet.</p>}
              {requests.map(req => (
                <div key={req.id} className="bg-white p-6 rounded-2xl border border-slate-100 space-y-4">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-indigo-600">
                        <User className="w-6 h-6" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-bold text-slate-900 text-lg">{req.tutorName}</span>
                          <span className="text-xs px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-full font-bold">{req.tutorInstitution}</span>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-slate-500">
                          <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" /> {req.tutorPhone}</span>
                          <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {formatDistanceToNow(req.createdAt.toDate())} ago</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {req.status === 'pending' ? (
                        <>
                          <button 
                            onClick={() => handleRequestStatus(req.id, 'accepted')}
                            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition-all"
                          >
                            <CheckCircle2 className="w-4 h-4" /> Accept
                          </button>
                          <button 
                            onClick={() => handleRequestStatus(req.id, 'rejected')}
                            className="flex items-center gap-1.5 px-4 py-2 bg-red-50 text-red-600 rounded-xl text-sm font-bold hover:bg-red-100 transition-all"
                          >
                            <XCircle className="w-4 h-4" /> Reject
                          </button>
                        </>
                      ) : (
                        <span className={cn(
                          "px-4 py-2 rounded-xl text-sm font-bold",
                          req.status === 'accepted' ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
                        )}>
                          {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                        </span>
                      )}
                      <a 
                        href={`tel:${req.tutorPhone}`}
                        className="p-2 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-all"
                        title="Call Tutor"
                      >
                        <PhoneCall className="w-5 h-5" />
                      </a>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-50">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Qualifications</label>
                      <p className="text-sm text-slate-700 font-medium">{req.tutorQualifications || 'Not specified'}</p>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Experience</label>
                      <p className="text-sm text-slate-700 font-medium">{req.tutorExperience || 'Not specified'}</p>
                    </div>
                    <div className="md:col-span-2 space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Message</label>
                      <p className="text-sm text-slate-600 italic bg-slate-50 p-3 rounded-xl border border-slate-100">"{req.message}"</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function RequestCard({ request, post }: { request: TutorRequest; post?: TuitionPost }) {
  if (!post) return null;

  return (
    <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="font-bold text-slate-900">{post.subjects}</h3>
          <p className="text-sm text-slate-500">Guardian: {post.guardianName}</p>
        </div>
        <div className={cn(
          "px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider",
          request.status === 'pending' ? "bg-amber-50 text-amber-600" :
          request.status === 'accepted' ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
        )}>
          {request.status}
        </div>
      </div>

      <div className="bg-slate-50 p-4 rounded-xl mb-4">
        <p className="text-sm text-slate-600 italic">Your message: "{request.message}"</p>
      </div>

      {request.status === 'accepted' && (
        <div className="flex items-center gap-3 p-4 bg-emerald-50 rounded-xl text-emerald-700">
          <Phone className="w-5 h-5" />
          <div>
            <div className="text-xs font-bold uppercase">Contact Guardian</div>
            <div className="font-bold">{post.contactInfo}</div>
          </div>
        </div>
      )}
    </div>
  );
}

function PostModal({ onClose, profile }: { onClose: () => void; profile: UserProfile }) {
  const classOptions = ['1-5', '6-8', 'SSC', 'HSC', 'Admission'];
  
  const [formData, setFormData] = useState({
    studentClass: '',
    subjects: '',
    preferredInstitution: 'Any' as any,
    location: '',
    daysPerWeek: 3,
    budget: '',
    contactInfo: profile.phone || ''
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await addDoc(collection(db, 'posts'), {
        ...formData,
        guardianId: profile.uid,
        guardianName: profile.name,
        status: 'open',
        createdAt: serverTimestamp()
      });
      onClose();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'posts');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full overflow-hidden"
      >
        <div className="p-8 max-h-[90vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-slate-900">Post Requirement</h2>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
              <XCircle className="w-6 h-6 text-slate-400" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">Student Class</label>
                <select 
                  required
                  value={formData.studentClass}
                  onChange={(e) => setFormData({...formData, studentClass: e.target.value})}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  <option value="">Select Class</option>
                  {classOptions.map(option => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">Budget (Monthly)</label>
                <input 
                  required
                  value={formData.budget}
                  onChange={(e) => setFormData({...formData, budget: e.target.value})}
                  placeholder="e.g. 4000 BDT"
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">Subjects</label>
                <input 
                  required
                  value={formData.subjects}
                  onChange={(e) => setFormData({...formData, subjects: e.target.value})}
                  placeholder="e.g. Math, Physics"
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">Days Per Week</label>
                <select 
                  value={formData.daysPerWeek}
                  onChange={(e) => setFormData({...formData, daysPerWeek: parseInt(e.target.value)})}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  {[1,2,3,4,5,6,7].map(d => <option key={d} value={d}>{d} days/week</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">Preferred Institution</label>
                <select 
                  value={formData.preferredInstitution}
                  onChange={(e) => setFormData({...formData, preferredInstitution: e.target.value as any})}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  <option value="Any">Any</option>
                  <option value="RUET">RUET</option>
                  <option value="RU">RU</option>
                  <option value="RMC">RMC</option>
                  <option value="RC">Rajshahi College (RC)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">Contact Info</label>
                <input 
                  required
                  value={formData.contactInfo}
                  onChange={(e) => setFormData({...formData, contactInfo: e.target.value})}
                  placeholder="Phone number"
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">Location (Area)</label>
              <input 
                required
                value={formData.location}
                onChange={(e) => setFormData({...formData, location: e.target.value})}
                placeholder="e.g. Talaimari, Kajla"
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>

            <button 
              disabled={submitting}
              type="submit"
              className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 mt-4 disabled:opacity-50"
            >
              {submitting ? 'Posting...' : 'Post Requirement'}
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
