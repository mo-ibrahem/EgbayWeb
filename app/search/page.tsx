'use client';

import React, { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Search, X, Clock, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { useLanguage } from '@/components/LanguageProvider';
import { productService, type Product } from '@/lib/products';
import ProductCard from '@/components/ui/ProductCard';

const RECENTS_KEY = 'egbay.recent_searches';

function SearchContent() {
  const router = useRouter();
  const params = useSearchParams();
  const { user } = useAuth();
  const { isRTL } = useLanguage();
  const [query, setQuery] = useState(params.get('q') || '');
  const [submitted, setSubmitted] = useState(params.get('q') || '');
  const [results, setResults] = useState<Product[]>([]);
  const [categories, setCategories] = useState<{ name: string; count: number }[]>([]);
  const [recents, setRecents] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const requestId = useRef(0);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    try { setRecents(JSON.parse(localStorage.getItem(RECENTS_KEY) || '[]')); } catch { setRecents([]); }
    productService.getProducts().then(items => {
      const counts = new Map<string, number>();
      items.forEach(p => { if (p.category) counts.set(p.category, (counts.get(p.category) || 0) + 1); });
      setCategories([...counts].sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count })));
    }).catch(() => {});
    return () => { if (debounce.current) clearTimeout(debounce.current); };
  }, []);

  const run = useCallback(async (term: string, remember: boolean) => {
    const value = term.trim();
    if (!value) { ++requestId.current; setSubmitted(''); setResults([]); setLoading(false); setError(''); return; }
    const thisRequest = ++requestId.current;
    setSubmitted(value);
    setLoading(true);
    setError('');
    try {
      const items = await productService.getProducts({ search: value, strict: true });
      if (thisRequest !== requestId.current) return;
      setResults(items);
      if (remember) setRecents(previous => {
        const next = [value, ...previous.filter(s => s.toLocaleLowerCase() !== value.toLocaleLowerCase())].slice(0, 8);
        try { localStorage.setItem(RECENTS_KEY, JSON.stringify(next)); } catch {}
        return next;
      });
    } catch (err) {
      if (thisRequest === requestId.current) setError((err as Error)?.message || (isRTL ? 'تعذر البحث.' : 'Search failed.'));
    } finally {
      if (thisRequest === requestId.current) setLoading(false);
    }
  }, [isRTL]);

  useEffect(() => {
    const q = params.get('q') || '';
    setQuery(q);
    if (q) run(q, false);
  }, [params, run]);

  const change = (value: string) => {
    setQuery(value);
    if (debounce.current) clearTimeout(debounce.current);
    if (!value.trim()) { run('', false); router.replace('/search', { scroll: false }); return; }
    debounce.current = setTimeout(() => run(value, false), 300);
  };

  const submit = (value: string) => {
    if (debounce.current) clearTimeout(debounce.current);
    setQuery(value);
    run(value, true);
    router.replace(value.trim() ? `/search?q=${encodeURIComponent(value.trim())}` : '/search', { scroll: false });
  };

  const toggleWishlist = async (id: string, wasWishlisted: boolean) => {
    if (!user) { router.push(`/login?redirect=${encodeURIComponent(`/search?q=${submitted}`)}`); return; }
    try {
      if (wasWishlisted) await productService.removeFromWishlist(id);
      else await productService.addToWishlist(id);
      setResults(prev => prev.map(p => p.id === id ? { ...p, isWishlisted: !wasWishlisted } : p));
    } catch (err) { setError((err as Error)?.message || (isRTL ? 'تعذر حفظ الإعلان.' : 'Could not save listing.')); throw err; }
  };

  return <main className="max-w-7xl mx-auto px-4 py-6 pb-28 min-h-[60vh]">
    <div className="flex items-center gap-3 mb-6">
      <Link href="/" aria-label={isRTL ? 'الرئيسية' : 'Home'} className="text-slate-600 hover:text-brand"><ArrowLeft size={20} /></Link>
      <form onSubmit={e => { e.preventDefault(); submit(query); }} className="flex-1 flex items-center bg-white border border-slate-300 rounded-lg focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20">
        <Search size={18} className="mx-3 text-slate-400 shrink-0" />
        <input autoFocus aria-label={isRTL ? 'البحث' : 'Search listings'} value={query} onChange={e => change(e.target.value)}
          placeholder={isRTL ? 'ابحث في إيجباي' : 'Search Egbay'} className="w-full py-3 text-sm outline-none bg-transparent" />
        {!!query && <button type="button" onClick={() => change('')} aria-label={isRTL ? 'مسح البحث' : 'Clear search'} className="px-2 text-slate-400"><X size={16} /></button>}
        <button type="submit" className="bg-brand text-white text-sm font-bold px-5 py-3 rounded-e-lg">{isRTL ? 'بحث' : 'Search'}</button>
      </form>
    </div>

    {!submitted ? <div className="space-y-8">
      {!!recents.length && <section><div className="flex items-center justify-between mb-3"><h1 className="text-sm font-black text-slate-800">{isRTL ? 'عمليات البحث الأخيرة' : 'Recent searches'}</h1><button type="button" onClick={() => { setRecents([]); localStorage.removeItem(RECENTS_KEY); }} className="text-xs text-brand">{isRTL ? 'مسح' : 'Clear'}</button></div>
        <div className="flex flex-wrap gap-2">{recents.map(term => <button key={term} type="button" onClick={() => submit(term)} className="inline-flex items-center gap-1.5 bg-white border border-slate-200 rounded-full px-3 py-2 text-sm"><Clock size={13} />{term}</button>)}</div></section>}
      <section><h2 className="text-sm font-black text-slate-800 mb-3">{isRTL ? 'تصفّح الأقسام' : 'Browse categories'}</h2><div className="flex flex-wrap gap-2">{categories.map(c => <Link key={c.name} href={`/?category=${encodeURIComponent(c.name)}`} className="bg-white border border-slate-200 rounded-lg px-4 py-3 text-sm hover:border-brand">{c.name} <span className="text-slate-400">{c.count}</span></Link>)}</div></section>
    </div> : <section>
      <h1 className="text-lg font-black text-slate-900 mb-4">{loading ? (isRTL ? 'جاري البحث...' : 'Searching...') : `${results.length} ${isRTL ? 'نتيجة' : 'results'} · ${submitted}`}</h1>
      {error ? <div role="alert" className="bg-red-50 border border-red-200 rounded-lg p-5 text-red-700"><p>{error}</p><button type="button" onClick={() => run(submitted, false)} className="mt-2 font-bold underline">{isRTL ? 'إعادة المحاولة' : 'Retry'}</button></div>
        : loading && !results.length ? <p className="text-slate-500">{isRTL ? 'جاري تحميل النتائج...' : 'Loading results...'}</p>
        : !loading && !results.length ? <div className="bg-white border border-slate-200 rounded-lg p-8 text-center"><p className="font-bold">{isRTL ? 'لا توجد نتائج' : 'No matches'}</p><p className="text-sm text-slate-500 mt-1">{isRTL ? 'جرّب كلمة أقصر أو تصفّح الأقسام.' : 'Try a shorter word or browse a category.'}</p></div>
        : <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">{results.map(p => <ProductCard key={p.id} product={p} onWishlistToggle={toggleWishlist} />)}</div>}
    </section>}
  </main>;
}

export default function SearchPage() {
  return <Suspense fallback={<div className="max-w-7xl mx-auto p-8">Loading search...</div>}><SearchContent /></Suspense>;
}
