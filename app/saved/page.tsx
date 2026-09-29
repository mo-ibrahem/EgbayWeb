'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Heart } from 'lucide-react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/components/AuthProvider';
import { useLanguage } from '@/components/LanguageProvider';
import { productService, type Product } from '@/lib/products';
import ProductMasonry from '@/components/ui/ProductMasonry';

function SavedContent() {
  const { user } = useAuth();
  const { isRTL } = useLanguage();
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try { setItems(await productService.getWishlist()); }
    catch (err) { setError((err as Error)?.message || (isRTL ? 'تعذر تحميل المحفوظات.' : 'Could not load saved items.')); }
    finally { setLoading(false); }
  }, [isRTL]);

  useEffect(() => { if (user) load(); }, [user, load]);

  const remove = async (id: string) => {
    const old = items;
    setItems(prev => prev.filter(p => p.id !== id));
    try { await productService.removeFromWishlist(id); }
    catch (err) { setItems(old); setError((err as Error)?.message || (isRTL ? 'تعذر إزالة الإعلان.' : 'Could not remove item.')); }
  };

  return <main className="max-w-7xl mx-auto px-4 py-8 pb-28 min-h-[60vh]">
    <div className="flex items-center justify-between mb-6"><div><h1 className="text-2xl font-black text-slate-900">{isRTL ? 'المحفوظات' : 'Saved'}</h1><p className="text-sm text-slate-500 mt-1">{isRTL ? 'الإعلانات التي حفظتها' : 'Listings you saved'}</p></div><button type="button" onClick={load} className="text-sm font-bold text-brand">{isRTL ? 'تحديث' : 'Refresh'}</button></div>
    {error && <p role="alert" className="bg-red-50 text-red-700 border border-red-200 rounded-lg p-3 mb-5 text-sm">{error}</p>}
    {loading ? <p className="text-slate-500">{isRTL ? 'جاري التحميل...' : 'Loading saved items...'}</p>
      : items.length === 0 ? <div className="text-center bg-white border border-slate-200 rounded-xl py-16 px-5"><Heart className="w-9 h-9 mx-auto text-slate-300" /><h2 className="font-bold mt-3">{isRTL ? 'لا شيء محفوظ بعد' : 'Nothing saved yet'}</h2><p className="text-sm text-slate-500 mt-1">{isRTL ? 'اضغط القلب على أي إعلان لحفظه هنا.' : 'Tap the heart on any listing to keep it here.'}</p><Link href="/" className="inline-block mt-5 bg-brand text-white px-5 py-2 rounded-lg text-sm font-bold">{isRTL ? 'تصفح السوق' : 'Browse marketplace'}</Link></div>
      : <ProductMasonry products={items} onWishlistToggle={id => remove(id)} />}
  </main>;
}

export default function SavedPage() { return <ProtectedRoute><SavedContent /></ProtectedRoute>; }
