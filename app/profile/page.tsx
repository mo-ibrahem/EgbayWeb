'use client';

import React, { useEffect, useState, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Package, Heart, MessageCircle, Settings, User, Camera,
  Trash2, Eye, Wallet, ShieldCheck, Clock, MapPin, Plus,
  Sparkles, CheckCircle2, ArrowRight, ExternalLink, Phone,
  Lock, AlertCircle, ShoppingBag, ChevronRight
} from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { useLanguage } from '@/components/LanguageProvider';
import ProtectedRoute from '@/components/ProtectedRoute';
import { productService, profileService, formatEGP, type Product, type UserProfile } from '@/lib/products';
import { supabase } from '@/lib/supabase';
import SmartImage from '@/components/SmartImage';

const TABS = [
  { id: 'products', label: 'My Listings', label_ar: 'إعلاناتي', icon: Package },
  { id: 'wishlist', label: 'Saved Items', label_ar: 'المفضلة', icon: Heart },
  { id: 'chats', label: 'Messages', label_ar: 'المحادثات', icon: MessageCircle },
  { id: 'settings', label: 'Account Settings', label_ar: 'إعدادات الحساب', icon: Settings },
] as const;

type TabId = typeof TABS[number]['id'];

interface ChatRoom {
  room_id: string;
  other_user_name: string;
  other_user_avatar_url?: string;
  last_message?: string;
  last_message_time?: string;
}

function timeAgo(dateStr?: string, isRTL?: boolean): string {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return isRTL ? 'الآن' : 'Just now';
  if (mins < 60) return isRTL ? `منذ ${mins} دقيقة` : `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return isRTL ? `منذ ${hrs} ساعة` : `${hrs}h ago`;
  return isRTL ? `منذ ${Math.floor(hrs / 24)} يوم` : `${Math.floor(hrs / 24)}d ago`;
}

function ProfileContent() {
  const { user, loading: authLoading, signOut } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isRTL } = useLanguage();
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

        // Fetch chat rooms
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
              other_user_name: otherProfile?.full_name || (isRTL ? 'مستخدم إيجي باي' : 'EgyBay User'),
              other_user_avatar_url: otherProfile?.avatar_url,
              last_message: msgs?.[0]?.content,
              last_message_time: msgs?.[0]?.created_at,
            };
          }));
          setChats(chatList);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    })();
  }, [user, authLoading, router, isRTL]);

  const handleSaveProfile = async () => {
    if (!user) return;
    setSaving(true);
    setSaveSuccess(false);
    try {
      await profileService.updateProfile(user.id, {
        full_name: editName.trim(),
        phone: editPhone.trim(),
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch { /* ignore */ }
    setSaving(false);
  };

  const handleChangePassword = async () => {
    setPwError('');
    setPwSuccess(false);
    if (!newPassword) { setPwError(isRTL ? 'يرجى إدخال كلمة المرور الجديدة' : 'Please enter a new password'); return; }
    if (newPassword.length < 6) { setPwError(isRTL ? 'يجب ألا تقل كلمة المرور عن ٦ أحرف' : 'Password must be at least 6 characters'); return; }
    if (newPassword !== confirmPassword) { setPwError(isRTL ? 'كلمات المرور غير متطابقة' : 'Passwords do not match'); return; }

    setPwSaving(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      setPwError(error.message);
    } else {
      setPwSuccess(true);
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPwSuccess(false), 3000);
    }
    setPwSaving(false);
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setAvatarUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `${user.id}/avatar.${ext}`;
      await supabase.storage.from('product-images').upload(path, file, { upsert: true });
      const { data } = supabase.storage.from('product-images').getPublicUrl(path);
      await profileService.updateProfile(user.id, { avatar_url: data.publicUrl });
      setProfile(p => p ? { ...p, avatar_url: data.publicUrl } : null);
    } catch { /* ignore */ }
    setAvatarUploading(false);
  };

  const handleDeleteProduct = async (productId: string) => {
    if (!confirm(isRTL ? 'هل أنت متأكد من رغبتك في حذف هذا الإعلان؟' : 'Are you sure you want to remove this listing?')) return;
    await productService.deleteProduct(productId);
    setListings(prev => prev.filter(p => p.id !== productId));
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#3665F3] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const avatarUrl = profile?.avatar_url || user?.user_metadata?.avatar_url;

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 w-full overflow-hidden">
      {/* ─── Profile Header Banner ─── */}
      <div className="bg-[#1E293B] rounded-3xl p-4 sm:p-8 lg:p-10 mb-6 sm:mb-8 text-white relative overflow-hidden shadow-lg border border-slate-700/60">
        <div className="relative flex flex-col md:flex-row items-center md:items-start justify-between gap-5 sm:gap-6">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6 text-center sm:text-left rtl:sm:text-right w-full sm:w-auto">
            {/* Avatar with Camera Overlay */}
            <div className="relative group flex-shrink-0">
              <div className="w-20 h-20 sm:w-28 sm:h-28 rounded-3xl overflow-hidden bg-white/20 ring-4 ring-white/30 shadow-xl relative">
                {avatarUrl ? (
                  <SmartImage
                    src={avatarUrl}
                    alt={profile?.full_name || 'Avatar'}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-3xl sm:text-4xl font-black text-white">
                    {profile?.full_name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}
                  </div>
                )}
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={avatarUploading}
                title={isRTL ? 'تغيير الصورة الشخصية' : 'Change Avatar'}
                className="absolute inset-0 bg-black/40 rounded-3xl opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center transition-opacity text-white text-xs font-semibold gap-1"
              >
                {avatarUploading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Camera className="w-5 h-5" />
                    <span>{isRTL ? 'رفع صورة' : 'Upload'}</span>
                  </>
                )}
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
            </div>

            {/* Profile Info */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-1">
                <h1 className="text-xl sm:text-3xl font-black tracking-tight truncate max-w-full">
                  {profile?.full_name || (isRTL ? 'عضو إيجي باي' : 'Marketplace Member')}
                </h1>
                <span className="bg-white/20 backdrop-blur-md text-white text-[10px] sm:text-xs font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 border border-white/20">
                  <ShieldCheck className="w-3 h-3 text-emerald-300" /> {isRTL ? 'بائع موثق' : 'Verified Seller'}
                </span>
              </div>
              <p className="text-white/80 text-xs sm:text-sm truncate">{user?.email}</p>

              {/* Quick Stat Badges */}
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-1.5 sm:gap-3 mt-3 sm:mt-4">
                <div className="bg-white/15 backdrop-blur-sm px-2.5 sm:px-3.5 py-1 rounded-xl text-[11px] sm:text-xs font-semibold flex items-center gap-1.5 border border-white/10">
                  <Package className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-blue-200" />
                  <span>{listings.length} {isRTL ? 'إعلان نشط' : `Active ${listings.length === 1 ? 'Listing' : 'Listings'}`}</span>
                </div>
                <div className="bg-white/15 backdrop-blur-sm px-2.5 sm:px-3.5 py-1 rounded-xl text-[11px] sm:text-xs font-semibold flex items-center gap-1.5 border border-white/10">
                  <Heart className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-rose-200" />
                  <span>{wishlist.length} {isRTL ? 'بالمفضلة' : `Saved ${wishlist.length === 1 ? 'Item' : 'Items'}`}</span>
                </div>
                <div className="bg-white/15 backdrop-blur-sm px-2.5 sm:px-3.5 py-1 rounded-xl text-[11px] sm:text-xs font-semibold flex items-center gap-1.5 border border-white/10">
                  <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-200" />
                  <span>{isRTL ? 'ضمان مالي ١٠٠٪' : '100% Escrow'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="grid grid-cols-2 sm:flex items-center gap-2 sm:gap-3 w-full sm:w-auto pt-2 sm:pt-0 border-t border-white/10 sm:border-0">
            <Link
              href="/wallet"
              className="flex items-center justify-center gap-1.5 bg-white text-blue-700 hover:bg-blue-50 font-bold text-xs px-3 sm:px-5 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl shadow-md transition-all active:scale-95"
            >
              <Wallet className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>{isRTL ? 'المحفظة والأرباح' : 'Wallet & Payouts'}</span>
            </Link>
            <Link
              href="/sell"
              className="flex items-center justify-center gap-1.5 bg-blue-900/70 hover:bg-blue-900/90 text-white font-bold text-xs px-3 sm:px-5 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl border border-white/20 shadow-md transition-all active:scale-95"
            >
              <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>{isRTL ? 'إعلان جديد' : 'Post New Item'}</span>
            </Link>
          </div>
        </div>
      </div>

      {/* ─── Navigation Tabs Bar ─── */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar mb-6 border-b border-gray-200 pb-3">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-6 py-2 sm:py-3 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-bold transition-all flex-shrink-0 ${
              activeTab === tab.id
                ? 'bg-[#3665F3] text-white shadow-md shadow-blue-500/20'
                : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300 hover:bg-gray-50'
            }`}
          >
            <tab.icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>{isRTL ? tab.label_ar : tab.label}</span>
            {tab.id === 'products' && (
              <span className={`text-[10px] sm:text-xs px-1.5 py-0.2 rounded-full ${activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'}`}>
                {listings.length}
              </span>
            )}
            {tab.id === 'wishlist' && (
              <span className={`text-[10px] sm:text-xs px-1.5 py-0.2 rounded-full ${activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'}`}>
                {wishlist.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ─── Tab Content ─── */}

      {/* 1. My Listings */}
      {activeTab === 'products' && (
        <div className="space-y-4 sm:space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base sm:text-xl font-black text-gray-900">{isRTL ? 'إعلاناتي النشطة' : 'Active Listings'}</h2>
              <p className="text-xs text-gray-500 mt-0.5">{isRTL ? 'إدارة السلع والمنتجات المعروضة للبيع' : 'Manage your items for sale across Egypt'}</p>
            </div>
            <Link
              href="/sell"
              className="bg-[#3665F3] hover:bg-[#2B54D4] text-white text-xs font-bold px-3 sm:px-4 py-2 rounded-xl shadow-sm transition-all flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isRTL ? 'إعلان جديد' : 'New Listing'}</span>
            </Link>
          </div>

          {listings.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-3xl border border-gray-200 shadow-sm max-w-md mx-auto p-6">
              <Package className="w-12 h-12 text-gray-300 mx-auto mb-3 stroke-[1.5]" />
              <h3 className="font-bold text-gray-900 text-sm sm:text-base mb-1">{isRTL ? 'لا توجد إعلانات بعد' : 'No listings yet'}</h3>
              <p className="text-gray-500 text-xs mb-5 max-w-xs mx-auto">
                {isRTL ? 'اعرض أجهزتك ومقتنياتك غير المستخدمة للبيع بأمان عبر الضمان المالي.' : 'Turn your unused items, gadgets, or products into cash with Egyptian escrow.'}
              </p>
              <Link
                href="/sell"
                className="inline-flex items-center gap-2 bg-[#3665F3] text-white px-5 py-2.5 rounded-xl font-bold text-xs shadow-md shadow-blue-500/20 hover:bg-[#2B54D4] transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>{isRTL ? 'أضف أول إعلان الآن' : 'List an Item Now'}</span>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-6">
              {listings.map(product => (
                <div
                  key={product.id}
                  className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition-all flex flex-col group min-w-0"
                >
                  <div className="relative aspect-square bg-gray-50 overflow-hidden w-full">
                    <SmartImage
                      src={product.images?.[0]}
                      alt={product.title}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                    />
                    <div className="absolute top-2 right-2">
                      <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full shadow-sm ${
                        product.status === 'active' ? 'bg-emerald-500 text-white' : 'bg-gray-600 text-white'
                      }`}>
                        {product.status === 'active' ? (isRTL ? 'نشط' : 'active') : product.status}
                      </span>
                    </div>
                  </div>

                  <div className="p-2.5 sm:p-4 flex-1 flex flex-col justify-between">
                    <div>
                      <h3 className="font-bold text-gray-900 text-xs sm:text-sm line-clamp-1 group-hover:text-blue-600 transition-colors">
                        {product.title}
                      </h3>
                      <p className="text-[#3665F3] font-black text-xs sm:text-base mt-0.5 sm:mt-1">
                        {formatEGP(product.price)}
                      </p>
                      <p className="text-[10px] sm:text-[11px] text-gray-400 mt-0.5 sm:mt-1 flex items-center gap-1">
                        <Clock className="w-3 h-3 flex-shrink-0" />
                        <span>{timeAgo(product.created_at, isRTL)}</span>
                      </p>
                    </div>

                    <div className="flex gap-1.5 sm:gap-2 mt-2.5 sm:mt-4 pt-2 sm:pt-3 border-t border-gray-100">
                      <Link
                        href={`/products/${product.id}`}
                        className="flex-1 flex items-center justify-center gap-1 text-[11px] sm:text-xs font-bold text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-200 py-1.5 sm:py-2 rounded-lg sm:rounded-xl transition-colors"
                      >
                        <Eye className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                        <span>{isRTL ? 'عرض' : 'View'}</span>
                      </Link>
                      <button
                        onClick={() => handleDeleteProduct(product.id)}
                        className="flex items-center justify-center text-[11px] sm:text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-100 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg sm:rounded-xl transition-colors"
                        title={isRTL ? 'حذف الإعلان' : 'Delete Listing'}
                      >
                        <Trash2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 2. Saved Items */}
      {activeTab === 'wishlist' && (
        <div className="space-y-4 sm:space-y-6">
          <div>
            <h2 className="text-base sm:text-xl font-black text-gray-900">
              {isRTL ? `السلع المحفوظة (${wishlist.length})` : `Saved Items (${wishlist.length})`}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {isRTL ? 'المنتجات التي قمت بحفظها للشراء لاحقاً' : 'Items you bookmarked to buy or keep an eye on'}
            </p>
          </div>

          {wishlist.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-3xl border border-gray-200 shadow-sm max-w-md mx-auto p-6">
              <Heart className="w-12 h-12 text-gray-300 mx-auto mb-3 stroke-[1.5]" />
              <h3 className="font-bold text-gray-900 text-sm sm:text-base mb-1">{isRTL ? 'لا توجد سلع محفوظة بالمفضلة' : 'No saved items yet'}</h3>
              <p className="text-gray-500 text-xs mb-5 max-w-xs mx-auto">
                {isRTL ? 'تصفح آلاف الإلكترونيات والأزياء الأصلية على إيجي باي.' : 'Browse thousands of verified electronics, fashion, and motors items on EgyBay.'}
              </p>
              <Link
                href="/"
                className="inline-flex items-center gap-2 bg-[#3665F3] text-white px-5 py-2.5 rounded-xl font-bold text-xs shadow-md shadow-blue-500/20 hover:bg-[#2B54D4] transition-all"
              >
                <span>{isRTL ? 'تصفح السوق' : 'Browse Marketplace'}</span>
                <ArrowRight className={`w-4 h-4 ${isRTL ? 'rotate-180' : ''}`} />
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-6">
              {wishlist.map(product => (
                <Link
                  key={product.id}
                  href={`/products/${product.id}`}
                  className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition-all flex flex-col group min-w-0"
                >
                  <div className="relative aspect-square bg-gray-50 overflow-hidden w-full">
                    <SmartImage
                      src={product.images?.[0]}
                      alt={product.title}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                    />
                    <div className="absolute top-2 right-2 bg-rose-50 text-rose-600 p-1.5 rounded-full shadow-sm">
                      <Heart className="w-3.5 h-3.5 fill-current" />
                    </div>
                  </div>

                  <div className="p-2.5 sm:p-4 flex-1 flex flex-col justify-between">
                    <div>
                      <h3 className="font-bold text-gray-900 text-xs sm:text-sm line-clamp-1 group-hover:text-blue-600 transition-colors">
                        {product.title}
                      </h3>
                      <p className="text-[#3665F3] font-black text-xs sm:text-base mt-0.5 sm:mt-1">
                        {formatEGP(product.price)}
                      </p>
                      <p className="text-[10px] sm:text-[11px] text-gray-400 mt-0.5 sm:mt-1 flex items-center gap-1">
                        <MapPin className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">{product.location || (isRTL ? 'مصر' : 'Cairo, Egypt')}</span>
                      </p>
                    </div>

                    <div className="mt-2.5 sm:mt-4 pt-2 sm:pt-3 border-t border-gray-100 flex items-center justify-between text-xs font-bold text-[#3665F3]">
                      <span>{isRTL ? 'عرض التفاصيل' : 'View Details'}</span>
                      <ChevronRight className={`w-3.5 h-3.5 group-hover:translate-x-1 transition-transform ${isRTL ? 'rotate-180' : ''}`} />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 3. Messages */}
      {activeTab === 'chats' && (
        <div className="space-y-6 max-w-4xl">
          <div>
            <h2 className="text-xl font-black text-gray-900">
              {isRTL ? `المحادثات المباشرة (${chats.length})` : `Direct Messages (${chats.length})`}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">{isRTL ? 'تواصل مع البائعين والمشترين حول السلع والأسعار' : 'Chat with buyers & sellers regarding listings'}</p>
          </div>

          {chats.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-3xl border border-gray-200 shadow-sm">
              <MessageCircle className="w-14 h-14 text-gray-300 mx-auto mb-3 stroke-[1.5]" />
              <h3 className="font-bold text-gray-900 text-base mb-1">{isRTL ? 'لا توجد محادثات نشطة' : 'No active conversations'}</h3>
              <p className="text-gray-500 text-xs max-w-xs mx-auto">
                {isRTL ? 'عندما تتواصل مع بائع أو تتلقى عرضاً على إعلانك، ستظهر المحادثات هنا.' : 'When you inquire about a listing or receive an offer, conversations will appear here.'}
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-3xl border border-gray-200 shadow-sm divide-y divide-gray-100 overflow-hidden">
              {chats.map(chat => (
                <Link
                  key={chat.room_id}
                  href={`/chat/${chat.room_id}`}
                  className="p-5 flex items-center gap-4 hover:bg-gray-50 transition-colors group"
                >
                  <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center font-black text-base flex-shrink-0 overflow-hidden relative">
                    {chat.other_user_avatar_url ? (
                      <SmartImage src={chat.other_user_avatar_url} alt={chat.other_user_name} fill className="object-cover" />
                    ) : (
                      chat.other_user_name[0]?.toUpperCase() || 'U'
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="font-bold text-gray-900 text-sm group-hover:text-blue-600 transition-colors">
                        {chat.other_user_name}
                      </h4>
                      {chat.last_message_time && (
                        <span className="text-[11px] text-gray-400">{timeAgo(chat.last_message_time, isRTL)}</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 truncate">{chat.last_message || (isRTL ? 'ابدأ المحادثة...' : 'Start conversation...')}</p>
                  </div>
                  <ChevronRight className={`w-4 h-4 text-gray-400 group-hover:text-blue-600 transition-all ${isRTL ? 'rotate-180' : ''}`} />
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 4. Account Settings */}
      {activeTab === 'settings' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Personal Info Card */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-200 shadow-sm space-y-5">
            <div>
              <h3 className="text-lg font-black text-gray-900">{isRTL ? 'البيانات الشخصية' : 'Personal Information'}</h3>
              <p className="text-xs text-gray-500 mt-0.5">{isRTL ? 'تعديل اسمك ورقم هاتفك للتواصل' : 'Update your display name and contact phone'}</p>
            </div>

            {saveSuccess && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3.5 text-emerald-700 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>{isRTL ? 'تم حفظ التعديلات بنجاح!' : 'Profile updated successfully!'}</span>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">{isRTL ? 'الاسم بالكامل' : 'Full Name'}</label>
                <div className="relative">
                  <User className={`absolute ${isRTL ? 'right-3.5' : 'left-3.5'} top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400`} />
                  <input
                    type="text"
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    className={`w-full border border-gray-300 rounded-xl ${isRTL ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all`}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">{isRTL ? 'رقم الهاتف' : 'Phone Number'}</label>
                <div className="relative">
                  <Phone className={`absolute ${isRTL ? 'right-3.5' : 'left-3.5'} top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400`} />
                  <input
                    type="tel"
                    value={editPhone}
                    onChange={e => setEditPhone(e.target.value)}
                    placeholder="010XXXXXXXX"
                    className={`w-full border border-gray-300 rounded-xl ${isRTL ? 'pr-10 pl-4 font-mono' : 'pl-10 pr-4 font-mono'} py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all`}
                  />
                </div>
              </div>

              <button
                onClick={handleSaveProfile}
                disabled={saving}
                className="w-full bg-[#3665F3] hover:bg-[#2B54D4] disabled:opacity-60 text-white font-bold text-xs py-3 rounded-xl shadow-md transition-all mt-2"
              >
                {saving ? (isRTL ? 'جاري الحفظ...' : 'Saving Changes...') : (isRTL ? 'حفظ تعديلات الملف الشخصي' : 'Save Profile Changes')}
              </button>
            </div>
          </div>

          {/* Security & Password */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-200 shadow-sm space-y-5">
            <div>
              <h3 className="text-lg font-black text-gray-900">{isRTL ? 'الأمان وكلمة المرور' : 'Security & Password'}</h3>
              <p className="text-xs text-gray-500 mt-0.5">{isRTL ? 'تغيير كلمة مرور تسجيل الدخول' : 'Update your account login password'}</p>
            </div>

            {pwError && (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-3.5 text-red-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                <span>{pwError}</span>
              </div>
            )}

            {pwSuccess && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3.5 text-emerald-700 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>{isRTL ? 'تم تغيير كلمة المرور بنجاح!' : 'Password changed successfully!'}</span>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">{isRTL ? 'كلمة المرور الجديدة' : 'New Password'}</label>
                <div className="relative">
                  <Lock className={`absolute ${isRTL ? 'right-3.5' : 'left-3.5'} top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400`} />
                  <input
                    type="password"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder={isRTL ? '٦ أحرف على الأقل' : 'At least 6 characters'}
                    className={`w-full border border-gray-300 rounded-xl ${isRTL ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all`}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">{isRTL ? 'تأكيد كلمة المرور الجديدة' : 'Confirm New Password'}</label>
                <div className="relative">
                  <Lock className={`absolute ${isRTL ? 'right-3.5' : 'left-3.5'} top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400`} />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder={isRTL ? 'أعد كتابة كلمة المرور' : 'Repeat new password'}
                    className={`w-full border border-gray-300 rounded-xl ${isRTL ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all`}
                  />
                </div>
              </div>

              <button
                onClick={handleChangePassword}
                disabled={pwSaving || !newPassword}
                className="w-full bg-gray-900 hover:bg-black disabled:opacity-50 text-white font-bold text-xs py-3 rounded-xl shadow-md transition-all mt-2"
              >
                {pwSaving ? (isRTL ? 'جاري التحديث...' : 'Updating Password...') : (isRTL ? 'تحديث كلمة المرور' : 'Update Password')}
              </button>
            </div>

            {/* Logout button */}
            <div className="pt-6 border-t border-gray-100">
              <button
                onClick={signOut}
                className="w-full text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 font-bold text-xs py-3 rounded-xl transition-all"
              >
                {isRTL ? 'تسجيل الخروج من الحساب' : 'Log Out of Account'}
              </button>
            </div>
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
