'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Camera, Trash2 } from 'lucide-react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/components/AuthProvider';
import { useLanguage } from '@/components/LanguageProvider';
import { productService, type Product } from '@/lib/products';
import { supabase } from '@/lib/supabase';
import SmartImage from '@/components/SmartImage';

type Photo = { url: string; file?: File; preview?: string };
const categories = ['Electronics', 'Fashion', 'Home', 'Toys', 'Sports', 'Books', 'Automotive', 'Beauty', 'General'];

function storagePath(url: string, ownerId: string): string | null {
  try {
    const path = decodeURIComponent(new URL(url).pathname.split('/storage/v1/object/public/product-images/')[1] || '');
    return path.startsWith(`${ownerId}/`) ? path : null;
  } catch { return null; }
}

function EditListingContent() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { isRTL } = useLanguage();
  const [product, setProduct] = useState<Product | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('1');
  const [category, setCategory] = useState('Electronics');
  const [condition, setCondition] = useState('New');
  const [fulfilment, setFulfilment] = useState<'in_hand' | 'sourced_to_order'>('in_hand');
  const [leadTime, setLeadTime] = useState('3');
  const [hasVariants, setHasVariants] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id || !user) return;
    let cancelled = false;
    Promise.all([productService.getProductById(id), productService.getVariants(id)])
      .then(([p, variants]) => {
        if (cancelled) return;
        if (!p || p.seller_id !== user.id) { setError(isRTL ? 'الإعلان غير متاح لك.' : 'Listing not found or not yours.'); return; }
        setProduct(p);
        setHasVariants(variants.length > 0);
        setPhotos((p.images ?? []).map(url => ({ url })));
        setTitle(p.title);
        const [body, place] = (p.description || '').split(/\n\n📍 /, 2);
        setDescription(body);
        setLocation(place || p.location || '');
        setPrice(String(p.price));
        setStock(String(p.stock || 1));
        setCategory(p.category);
        setCondition(p.condition);
        setFulfilment(p.fulfilment || 'in_hand');
        setLeadTime(String(p.lead_time_days || 3));
      })
      .catch(e => { if (!cancelled) setError(e?.message || 'Could not load listing.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id, user, isRTL]);

  const addPhotos = (files: FileList | null) => {
    if (!files) return;
    const imageFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
    const room = Math.max(0, 8 - photos.length);
    if (imageFiles.length > room) setError(isRTL ? 'يمكن إضافة ٨ صور كحد أقصى.' : 'You can add up to 8 photos.');
    setPhotos(prev => [...prev, ...imageFiles.slice(0, room).map(file => ({ url: URL.createObjectURL(file), preview: '', file }))]);
  };

  const removePhoto = (index: number) => {
    setPhotos(prev => {
      if (prev[index]?.file) URL.revokeObjectURL(prev[index].url);
      return prev.filter((_, i) => i !== index);
    });
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !product || saving) return;
    const amount = Number(price);
    const quantity = Number(stock);
    const days = Number(leadTime);
    if (!title.trim() || !description.trim() || !photos.length || (!hasVariants && (!Number.isFinite(amount) || amount <= 0)) || !Number.isInteger(quantity) || quantity < 1 || (fulfilment === 'sourced_to_order' && (!Number.isInteger(days) || days < 1 || days > 30))) {
      setError(isRTL ? 'تحقق من العنوان والوصف والصور والسعر والكمية ومدة التوريد.' : 'Check the title, description, photos, price, stock and lead time.');
      return;
    }
    setSaving(true);
    setError('');
    const uploadedPaths: string[] = [];
    try {
      const finalUrls: string[] = [];
      for (const photo of photos) {
        if (!photo.file) { finalUrls.push(photo.url); continue; }
        const ext = photo.file.name.split('.').pop()?.toLowerCase() || 'jpg';
        const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
        const { error: uploadError } = await supabase.storage.from('product-images').upload(path, photo.file, { contentType: photo.file.type });
        if (uploadError) throw uploadError;
        uploadedPaths.push(path);
        finalUrls.push(supabase.storage.from('product-images').getPublicUrl(path).data.publicUrl);
      }
      const fullDescription = `${description.trim()}${location.trim() ? `\n\n📍 ${location.trim()}` : ''}`;
      await productService.updateProduct(product.id, {
        title: title.trim(), description: fullDescription, category, condition,
        ...(hasVariants ? {} : { price: amount }), stock: quantity,
        images: finalUrls, fulfilment, lead_time_days: fulfilment === 'sourced_to_order' ? days : null,
      });
      const removedPaths = (product.images || []).filter(url => !finalUrls.includes(url))
        .map(url => storagePath(url, user.id)).filter((path): path is string => !!path);
      if (removedPaths.length) supabase.storage.from('product-images').remove(removedPaths).catch(console.warn);
      photos.forEach(photo => { if (photo.file) URL.revokeObjectURL(photo.url); });
      router.push('/profile?tab=products');
    } catch (err) {
      if (uploadedPaths.length) await supabase.storage.from('product-images').remove(uploadedPaths).catch(() => {});
      setError((err as Error)?.message || (isRTL ? 'تعذر حفظ الإعلان.' : 'Could not save listing.'));
    } finally { setSaving(false); }
  };

  if (loading) return <div className="max-w-3xl mx-auto p-8 text-slate-500">{isRTL ? 'جاري تحميل الإعلان...' : 'Loading listing...'}</div>;
  if (!product) return <div className="max-w-3xl mx-auto p-8"><p role="alert" className="text-red-600">{error}</p><Link href="/profile" className="text-brand">{isRTL ? 'العودة إلى إعلاناتي' : 'Back to my listings'}</Link></div>;

  const field = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20';
  return <main className="max-w-3xl mx-auto px-4 py-8 pb-28">
    <Link href="/profile?tab=products" className="text-sm text-brand">{isRTL ? '← إعلاناتي' : '← My listings'}</Link>
    <h1 className="text-2xl font-black text-slate-900 mt-4 mb-6">{isRTL ? 'تعديل الإعلان' : 'Edit listing'}</h1>
    <form onSubmit={save} className="space-y-5 bg-white border border-slate-200 rounded-xl p-5 sm:p-7">
      <div><label className="block text-sm font-bold mb-2">{isRTL ? 'الصور' : 'Photos'} ({photos.length}/8)</label>
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {photos.map((photo, i) => <div key={photo.url} className="relative aspect-square rounded-lg overflow-hidden bg-slate-100">
            <SmartImage src={photo.url} alt={`${title} ${i + 1}`} fill className="object-cover" sizes="160px" />
            <button type="button" onClick={() => removePhoto(i)} aria-label={isRTL ? 'حذف الصورة' : 'Remove photo'} className="absolute top-1 end-1 bg-white text-red-600 rounded-full p-1.5"><Trash2 size={14} /></button>
          </div>)}
          {photos.length < 8 && <label className="aspect-square rounded-lg border border-dashed border-slate-300 flex flex-col items-center justify-center gap-1 text-xs text-slate-600 cursor-pointer"><Camera size={22} />{isRTL ? 'إضافة صور' : 'Add photos'}<input type="file" accept="image/*" multiple className="sr-only" onChange={e => { addPhotos(e.target.files); e.target.value = ''; }} /></label>}
        </div>
      </div>
      <div><label htmlFor="edit-title" className="block text-sm font-bold mb-1">{isRTL ? 'العنوان' : 'Title'}</label><input id="edit-title" className={field} value={title} onChange={e => setTitle(e.target.value)} maxLength={150} required /></div>
      <div><label htmlFor="edit-description" className="block text-sm font-bold mb-1">{isRTL ? 'الوصف' : 'Description'}</label><textarea id="edit-description" className={field} value={description} onChange={e => setDescription(e.target.value)} rows={5} required /></div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div><label htmlFor="edit-category" className="block text-sm font-bold mb-1">{isRTL ? 'القسم' : 'Category'}</label><select id="edit-category" className={field} value={category} onChange={e => setCategory(e.target.value)}>{[...new Set([category, ...categories])].map(c => <option key={c} value={c}>{c}</option>)}</select></div>
        <div><label htmlFor="edit-condition" className="block text-sm font-bold mb-1">{isRTL ? 'الحالة' : 'Condition'}</label><select id="edit-condition" className={field} value={condition} onChange={e => setCondition(e.target.value)}><option value="New">{isRTL ? 'جديد' : 'New'}</option><option value="Used">{isRTL ? 'مستعمل' : 'Used'}</option></select></div>
        <div><label htmlFor="edit-location" className="block text-sm font-bold mb-1">{isRTL ? 'الموقع' : 'Location'}</label><input id="edit-location" className={field} value={location} onChange={e => setLocation(e.target.value)} /></div>
        <div><label htmlFor="edit-stock" className="block text-sm font-bold mb-1">{isRTL ? 'الكمية' : 'Stock'}</label><input id="edit-stock" type="number" min="1" step="1" className={field} value={stock} onChange={e => setStock(e.target.value)} required /></div>
        <div><label htmlFor="edit-price" className="block text-sm font-bold mb-1">{isRTL ? 'السعر بالجنيه' : 'Price in EGP'}</label><input id="edit-price" type="number" min="1" step="0.01" className={field} value={price} onChange={e => setPrice(e.target.value)} disabled={hasVariants} required={!hasVariants} />{hasVariants && <p className="text-xs text-amber-700 mt-1">{isRTL ? 'سعر الباقة يحدده سعر كل خيار.' : 'Pack price is set by its options and cannot be changed here.'}</p>}</div>
        <div><label htmlFor="edit-fulfilment" className="block text-sm font-bold mb-1">{isRTL ? 'التوفر' : 'Availability'}</label><select id="edit-fulfilment" className={field} value={fulfilment} onChange={e => setFulfilment(e.target.value as 'in_hand' | 'sourced_to_order')}><option value="in_hand">{isRTL ? 'متوفر الآن' : 'In hand'}</option><option value="sourced_to_order">{isRTL ? 'يُجلب عند الطلب' : 'Sourced to order'}</option></select></div>
      </div>
      {fulfilment === 'sourced_to_order' && <div><label htmlFor="edit-lead" className="block text-sm font-bold mb-1">{isRTL ? 'مدة التوريد بالأيام' : 'Lead time in days'}</label><input id="edit-lead" type="number" min="1" max="30" step="1" className={field} value={leadTime} onChange={e => setLeadTime(e.target.value)} required /></div>}
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={saving} className="w-full bg-brand text-white rounded-lg py-3 font-bold disabled:opacity-50">{saving ? (isRTL ? 'جاري الحفظ...' : 'Saving...') : (isRTL ? 'حفظ التعديلات' : 'Save changes')}</button>
    </form>
  </main>;
}

export default function EditListingPage() {
  return <ProtectedRoute><EditListingContent /></ProtectedRoute>;
}
