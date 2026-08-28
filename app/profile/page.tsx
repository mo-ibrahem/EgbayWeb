'use client';

import React, { useEffect, useState, useRef, Suspense } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Package, Heart, MessageCircle, Settings, User, Edit3, Camera,
  LogOut, Trash2, Eye, ArrowUpRight, Save, ChevronRight, Wallet,
  ShieldCheck, Clock, MapPin
} from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import ProtectedRoute from '@/components/ProtectedRoute';
import { productService, profileService, formatEGP, type Product, type UserProfile } from '@/lib/products';
import { supabase } from '@/lib/supabase';

const TABS = [
  { id: 'products', label: 'My Listings', icon: Package },
  { id: 'wishlist', label: 'Saved', icon: Heart },
  { id: 'chats', label: 'Messages', icon: MessageCircle },
  { id: 'settings', label: 'Settings', icon: Settings },
] as const;
type TabId = typeof TABS[number]['id'];

interface ChatRoom {
  room_id: string;
  other_user_name: string;
  other_user_avatar_url?: string;
  last_message?: string;
  last_message_time?: string;
}

function timeAgo(dateStr?: string): string {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

function ProfileContent() {
  const { user, loading: authLoading, signOut } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [listings, setListings] = useState<Product[]>([]);
  const [wishlist, setWishlist] = useState<Product[]>([]);
  const [chats, setChats] = useState<ChatRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>((searchParams.get('tab') as TabId) || 'products');

  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState(false);

  const [avatarUploading, setAvatarUploading] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push('/login'); return; }

    (async () => {
      try {
        const [prof, prods, wl] = await Promise.all([
          profileService.getProfile(user.id),
          productService.getProductsBySeller(user.id),
          productService.getWishlist(),
        ]);
        setProfile(prof);
        setListings(prods);
        setWishlist(wl);
        setEditName(prof?.full_name || '');
        setEditPhone(prof?.phone || '');

        // Fetch chats
        const { data: rooms } = await supabase
          .from('chat_rooms').select('id, participant_ids').contains('participant_ids', [user.id]);
        if (rooms?.length) {
          const otherIds = rooms.map(r => r.participant_ids.find((p: string) => p !== user.id)).filter(Boolean);
          const { data: profiles } = await supabase.from('user_profiles').select('id, full_name, avatar_url').in('id', otherIds);
          const chatList: ChatRoom[] = await Promise.all(rooms.map(async (room) => {
            const otherId = room.participant_ids.find((p: string) => p !== user.id);
            const otherProfile = profiles?.find((p: {id: string}) => p.id === otherId);
            const { data: msgs } = await supabase.from('messages').select('content, created_at')
              .eq('room_id', room.id).order('created_at', { ascending: false }).limit(1);
            return {
              room_id: room.id,
              other_user_name: (otherProfile as {full_name?: string})?.full_name || 'Unknown',
              other_user_avatar_url: (otherProfile as {avatar_url?: string})?.avatar_url,
              last_message: msgs?.[0]?.content,
              last_message_time: msgs?.[0]?.created_at,
            };
          }));
          setChats(chatList);
        }
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, [user, authLoading, router]);

  const handleSaveProfile = async () => {
    if (!user || !profile) return;
    setSaving(true);
    try {
      const updated = await profileService.updateProfile(user.id, { full_name: editName, phone: editPhone });
      setProfile(updated);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch { /* ignore */ }
    setSaving(false);
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) { setPwError('Passwords do not match.'); return; }
    if (newPassword.length < 6) { setPwError('Password must be at least 6 characters.'); return; }
    setPwSaving(true); setPwError('');
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) { setPwError(error.message); }
    else { setPwSuccess(true); setNewPassword(''); setConfirmPassword(''); setTimeout(() => setPwSuccess(false), 3000); }
    setPwSaving(false);
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setAvatarUploading(true);
    try {
      const path = `avatars/${user.id}.${file.name.split('.').pop()}`;
      await supabase.storage.from('product-images').upload(path, file, { upsert: true });
      const { data: urlData } = supabase.storage.from('product-images').getPublicUrl(path);
      const updated = await profileService.updateProfile(user.id, { avatar_url: urlData.publicUrl });
      setProfile(updated);
    } catch { /* ignore */ }
    setAvatarUploading(false);
  };

  const handleDeleteProduct = async (productId: string) => {
    if (!confirm('Delete this listing?')) return;
    await productService.deleteProduct(productId);
    setListings(prev => prev.filter(p => p.id !== productId));
  };

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const avatarUrl = profile?.avatar_url;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Profile header */}
      <div className="bg-gradient-to-r from-blue-600 via-blue-700 to-violet-700 rounded-3xl p-6 sm:p-8 mb-6 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 80% 50%, white 0%, transparent 60%)' }} />
        <div className="relative flex items-center gap-5">
          {/* Avatar */}
          <div className="relative group flex-shrink-0">
            <div className="w-20 h-20 rounded-2xl overflow-hidden bg-white/20 ring-3 ring-white/30">
              {avatarUrl ? (
                <Image src={avatarUrl} alt="Avatar" width={80} height={80} className="object-cover w-full h-full" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-3xl font-black text-white">
                  {profile?.full_name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}
                </div>
              )}
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={avatarUploading}
              className="absolute inset-0 bg-black/40 rounded-2xl opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
            >
              {avatarUploading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Camera className="w-5 h-5 text-white" />}
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
          </div>

          <div className="min-w-0">
            <h1 className="text-xl font-black text-white truncate">{profile?.full_name || 'Your Profile'}</h1>
            <p className="text-white/70 text-sm truncate">{user?.email}</p>
            <div className="flex items-center gap-3 mt-2">
              <span className="text-xs text-white/60 flex items-center gap-1"><Package className="w-3 h-3" />{listings.length} listings</span>
              <span className="text-xs text-white/60 flex items-center gap-1"><Heart className="w-3 h-3" />{wishlist.length} saved</span>
            </div>
          </div>

          <div className="ml-auto flex flex-col gap-2">
            <Link href="/wallet" className="flex items-center gap-1.5 bg-white/15 hover:bg-white/25 text-white text-xs font-semibold px-3 py-2 rounded-xl transition-all">
              <Wallet className="w-3.5 h-3.5" /> Wallet
            </Link>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar mb-6">
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all flex-shrink-0 ${
              activeTab === tab.id ? 'bg-blue-600 text-white shadow-sm shadow-blue-200' : 'bg-white text-gray-600 border border-gray-200 hover:border-blue-200'
            }`}>
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab: Listings */}
      {activeTab === 'products' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-black text-gray-900">My Listings ({listings.length})</h2>
            <Link href="/sell" className="bg-blue-600 text-white text-xs font-bold px-3 py-1.5 rounded-xl hover:bg-blue-700 transition-colors">+ New Listing</Link>
          </div>
          {listings.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
              <Package className="w-12 h-12 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-500 font-medium mb-4">No listings yet</p>
              <Link href="/sell" className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors">Start Selling</Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {listings.map(product => (
                <div key={product.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-all group">
                  <div className="relative aspect-video bg-gray-50">
                    {product.images?.[0] ? (
                      <Image src={product.images[0]} alt={product.title} fill className="object-cover" sizes="400px" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-4xl">📦</div>
                    )}
                    <div className={`absolute top-2 right-2 text-xs font-bold px-2 py-1 rounded-full ${product.status === 'active' ? 'bg-emerald-500 text-white' : 'bg-gray-400 text-white'}`}>
                      {product.status}
                    </div>
                  </div>
                  <div className="p-4">
                    <p className="font-bold text-gray-900 text-sm line-clamp-1">{product.title}</p>
                    <p className="text-blue-600 font-black mt-1">{formatEGP(product.price)}</p>
                    <p className="text-xs text-gray-400 mt-1 flex items-center gap-1"><Clock className="w-3 h-3" />{timeAgo(product.created_at)} ago</p>
                    <div className="flex gap-2 mt-3">
                      <Link href={`/products/${product.id}`} className="flex-1 flex items-center justify-center gap-1 text-xs font-semibold text-gray-600 border border-gray-200 py-2 rounded-xl hover:bg-gray-50">
                        <Eye className="w-3.5 h-3.5" /> View
                      </Link>
                      <button onClick={() => handleDeleteProduct(product.id)} className="flex items-center justify-center gap-1 text-xs font-semibold text-red-500 border border-red-100 px-3 py-2 rounded-xl hover:bg-red-50 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Wishlist */}
      {activeTab === 'wishlist' && (
        <div>
          <h2 className="font-black text-gray-900 mb-4">Saved Items ({wishlist.length})</h2>
          {wishlist.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
              <Heart className="w-12 h-12 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No saved items yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {wishlist.map(p => (
                <Link key={p.id} href={`/products/${p.id}`} className="bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all group">
                  <div className="aspect-square relative bg-gray-50">
                    {p.images?.[0] ? (
                      <Image src={p.images[0]} alt={p.title} fill className="object-cover group-hover:scale-105 transition-transform" sizes="250px" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-3xl">📦</div>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="text-sm font-semibold text-gray-900 line-clamp-2">{p.title}</p>
                    <p className="text-blue-600 font-black mt-1">{formatEGP(p.price)}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Chats */}
      {activeTab === 'chats' && (
        <div>
          <h2 className="font-black text-gray-900 mb-4">Messages ({chats.length})</h2>
          {chats.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
              <MessageCircle className="w-12 h-12 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No messages yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {chats.map(chat => (
                <Link key={chat.room_id} href={`/chat/${chat.room_id}`}
                  className="flex items-center gap-4 bg-white rounded-2xl border border-gray-100 p-4 hover:shadow-md transition-all group">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-400 to-violet-500 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                    {chat.other_user_name[0]?.toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-gray-900 text-sm">{chat.other_user_name}</p>
                    {chat.last_message && <p className="text-xs text-gray-400 truncate mt-0.5">{chat.last_message}</p>}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {chat.last_message_time && <p className="text-xs text-gray-400">{timeAgo(chat.last_message_time)}</p>}
                    <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-blue-400 transition-colors" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Settings */}
      {activeTab === 'settings' && (
        <div className="space-y-5">
          {/* Edit profile */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h3 className="font-black text-gray-900 mb-5 flex items-center gap-2"><Edit3 className="w-4 h-4 text-blue-500" /> Edit Profile</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">Full Name</label>
                <input type="text" value={editName} onChange={e => setEditName(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">Phone</label>
                <input type="tel" value={editPhone} onChange={e => setEditPhone(e.target.value)} placeholder="+201XXXXXXXXX"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
              </div>
              <button onClick={handleSaveProfile} disabled={saving}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-bold px-5 py-2.5 rounded-xl transition-all text-sm">
                <Save className="w-4 h-4" />
                {saving ? 'Saving...' : saveSuccess ? '✓ Saved!' : 'Save Changes'}
              </button>
            </div>
          </div>

          {/* Change password */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h3 className="font-black text-gray-900 mb-5 flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-blue-500" /> Change Password</h3>
            <div className="space-y-4">
              {pwError && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-xl">{pwError}</p>}
              {pwSuccess && <p className="text-sm text-emerald-600 bg-emerald-50 p-3 rounded-xl">✓ Password changed successfully!</p>}
              <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="New password (min 6 chars)"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
              <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Confirm new password"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
              <button onClick={handleChangePassword} disabled={pwSaving || !newPassword}
                className="bg-gray-900 hover:bg-gray-800 disabled:opacity-50 text-white font-bold px-5 py-2.5 rounded-xl transition-all text-sm">
                {pwSaving ? 'Changing...' : 'Change Password'}
              </button>
            </div>
          </div>

          {/* Danger zone */}
          <div className="bg-white rounded-2xl border border-red-100 shadow-sm p-6">
            <h3 className="font-black text-gray-900 mb-4">Account Actions</h3>
            <button onClick={handleSignOut}
              className="flex items-center gap-2 text-sm text-red-600 border border-red-200 hover:bg-red-50 px-4 py-2.5 rounded-xl transition-colors font-semibold">
              <LogOut className="w-4 h-4" /> Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ProfilePage() {
  return (
    <ProtectedRoute>
      <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>}>
        <ProfileContent />
      </Suspense>
    </ProtectedRoute>
  );
}
