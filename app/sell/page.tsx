'use client';

import React, { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowLeft, Camera, X, CheckCircle2, Tag, FileText,
  MapPin, Sparkles, AlertCircle, Upload, Smartphone, Shirt,
  Home, Baby, Dumbbell, BookOpen, Car, ShieldCheck, Zap
} from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import ProtectedRoute from '@/components/ProtectedRoute';
import { productService, formatEGP } from '@/lib/products';
import { supabase } from '@/lib/supabase';

const CATEGORIES_SELL = [
  { value: 'Electronics', label: 'Electronics', icon: Smartphone, color: '#0284C7', bg: '#E0F2FE' },
  { value: 'Fashion',     label: 'Fashion',     icon: Shirt,      color: '#DB2777', bg: '#FCE7F3' },
  { value: 'Home',        label: 'Home & Living',icon: Home,      color: '#059669', bg: '#D1FAE5' },
  { value: 'Toys',        label: 'Toys & Kids', icon: Baby,       color: '#D97706', bg: '#FEF3C7' },
  { value: 'Sports',      label: 'Sports',      icon: Dumbbell,   color: '#DC2626', bg: '#FEE2E2' },
  { value: 'Books',       label: 'Books',       icon: BookOpen,   color: '#7C3AED', bg: '#EDE9FE' },
  { value: 'Automotive',  label: 'Automotive',  icon: Car,        color: '#475569', bg: '#F1F5F9' },
  { value: 'Beauty',      label: 'Beauty',      icon: Sparkles,   color: '#E11D48', bg: '#FFE4E6' },
];

const CONDITIONS = [
  { value: 'New', label: 'Brand New', desc: 'Unopened in original box/packaging' },
  { value: 'Used', label: 'Pre-Owned', desc: 'Used but fully functional and clean' },
];

const GOVERNORATES = [
  'Cairo', 'Giza', 'Alexandria', 'Luxor', 'Aswan', 'Asyut',
  'Beheira', 'Beni Suef', 'Dakahlia', 'Damietta', 'Fayoum',
  'Gharbia', 'Ismailia', 'Kafr El Sheikh', 'Matruh', 'Minya',
  'Monufia', 'New Valley', 'North Sinai', 'Port Said', 'Qalyubia',
  'Qena', 'Red Sea', 'Sharqia', 'Sohag', 'South Sinai', 'Suez',
];

const STEPS = [
  { id: 1, label: 'Photos', icon: Camera },
  { id: 2, label: 'Details', icon: FileText },
  { id: 3, label: 'Pricing', icon: Tag },
];

function SellContent() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState(1);
  const [images, setImages] = useState<{ preview: string; file: File }[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [condition, setCondition] = useState('New');
  const [location, setLocation] = useState('Cairo');
  const [price, setPrice] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    router.push('/login');
    return null;
  }

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newImages = files.slice(0, 8 - images.length).map(file => ({
      preview: URL.createObjectURL(file),
      file,
    }));
    setImages(prev => [...prev, ...newImages].slice(0, 8));
    e.target.value = '';
  };

  const removeImage = (idx: number) => {
    setImages(prev => {
      URL.revokeObjectURL(prev[idx].preview);
      return prev.filter((_, i) => i !== idx);
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    const newImages = files.slice(0, 8 - images.length).map(file => ({
      preview: URL.createObjectURL(file),
      file,
    }));
    setImages(prev => [...prev, ...newImages].slice(0, 8));
  };

  const validateStep = () => {
    if (step === 1 && images.length === 0) { setError('Please upload at least one photo of your item.'); return false; }
    if (step === 2 && (!title.trim() || !description.trim() || !category)) { setError('Please complete all item detail fields.'); return false; }
    if (step === 3 && (!price || Number(price) <= 0)) { setError('Please enter a valid listing price.'); return false; }
    setError('');
    return true;
  };

  const handleNext = () => {
    if (!validateStep()) return;
    setStep(s => s + 1);
  };

  const handleSubmit = async () => {
    if (!validateStep()) return;
    setUploading(true);
    setError('');
    try {
      const uploadedUrls: string[] = [];
      for (const img of images) {
        const ext = img.file.name.split('.').pop() || 'jpg';
        const path = `${user.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: upErr } = await supabase.storage.from('product-images').upload(path, img.file, { upsert: true });
        if (upErr) throw upErr;
        const { data: urlData } = supabase.storage.from('product-images').getPublicUrl(path);
        uploadedUrls.push(urlData.publicUrl);
      }

      const product = await productService.createProduct({
        title: title.trim(),
        description: description.trim(),
        category,
        condition,
        location,
        price: Number(price),
        images: uploadedUrls,
      });

      setSuccess(true);
      setTimeout(() => router.push(`/products/${product.id}`), 1500);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to publish listing');
      setUploading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="text-center p-8 max-w-md">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-500/20">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 mb-2">Listing Published! 🚀</h2>
          <p className="text-xs text-slate-500">Your item is now live and protected by EgyBay Escrow.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="max-w-2xl mx-auto px-4">
        {/* Top Header & Step Tracker */}
        <div className="flex items-center justify-between gap-4 mb-6">
          <button
            onClick={() => step > 1 ? setStep(s => s - 1) : router.back()}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>

          <div className="flex items-center gap-2">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              const isCurrent = step === s.id;
              const isPast = step > s.id;

              return (
                <React.Fragment key={s.id}>
                  <div className={`flex items-center gap-1 text-xs font-bold px-3 py-1 rounded-full transition-all ${
                    isCurrent
                      ? 'bg-blue-600 text-white shadow-sm'
                      : isPast
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-slate-200/80 text-slate-400'
                  }`}>
                    {isPast ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Icon className="w-3.5 h-3.5" />}
                    <span>{s.label}</span>
                  </div>
                  {i < STEPS.length - 1 && <div className={`w-3 h-0.5 rounded ${isPast ? 'bg-emerald-300' : 'bg-slate-200'}`} />}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {error && (
          <div className="mb-5 flex items-center gap-2 bg-rose-50 border border-rose-200 rounded-2xl p-4 text-rose-700 text-xs font-medium">
            <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
          </div>
        )}

        {/* Step 1: Photos */}
        {step === 1 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-xl font-black text-slate-900">Upload Item Photos</h2>
              <p className="text-xs text-slate-500 mt-0.5">High-quality, well-lit photos increase buyer inquiries by 3x.</p>
            </div>

            <div
              onDrop={handleDrop}
              onDragOver={e => e.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-blue-200 hover:border-blue-500 bg-white hover:bg-blue-50/40 rounded-3xl p-10 text-center cursor-pointer transition-all group shadow-sm"
            >
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                <Upload className="w-6 h-6" />
              </div>
              <p className="font-bold text-slate-800 text-sm mb-1">Click to browse or drag photos here</p>
              <p className="text-xs text-slate-400">Supports PNG, JPG, JPEG, WEBP (up to 8 photos)</p>
              <input ref={fileInputRef} type="file" multiple accept="image/*" onChange={handleImageSelect} className="hidden" />
            </div>

            {images.length > 0 && (
              <div className="grid grid-cols-4 gap-3">
                {images.map((img, i) => (
                  <div key={i} className={`relative aspect-square rounded-2xl overflow-hidden bg-slate-100 border ${i === 0 ? 'border-blue-600 ring-2 ring-blue-500/20' : 'border-slate-200'}`}>
                    <Image src={img.preview} alt="" fill className="object-cover" />
                    {i === 0 && (
                      <div className="absolute top-1.5 left-1.5 bg-blue-600 text-white text-[10px] font-black px-2 py-0.5 rounded-md">
                        COVER
                      </div>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); removeImage(i); }}
                      className="absolute top-1.5 right-1.5 w-6 h-6 bg-black/60 hover:bg-rose-600 text-white rounded-full flex items-center justify-center transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step 2: Details */}
        {step === 2 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-xl font-black text-slate-900">Item Specifications</h2>
              <p className="text-xs text-slate-500 mt-0.5">Describe title, condition, and category accurately.</p>
            </div>

            <div className="bg-white rounded-3xl border border-slate-200/80 p-6 space-y-5 shadow-sm">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Listing Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  maxLength={80}
                  placeholder="e.g. Apple iPhone 15 Pro Max 256GB Titanium"
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Description & Accessories Included</label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  rows={4}
                  placeholder="State the item's condition, warranty status, reason for selling, and accessories..."
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">Category</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {CATEGORIES_SELL.map(cat => {
                    const Icon = cat.icon;
                    const isSelected = category === cat.value;

                    return (
                      <button
                        type="button"
                        key={cat.value}
                        onClick={() => setCategory(cat.value)}
                        className={`p-3 rounded-2xl border-2 flex flex-col items-center gap-1.5 transition-all text-xs font-bold ${
                          isSelected
                            ? 'border-blue-600 bg-blue-50 text-blue-700'
                            : 'border-slate-100 hover:border-slate-200 text-slate-600'
                        }`}
                      >
                        <div
                          className="w-8 h-8 rounded-xl flex items-center justify-center"
                          style={{ backgroundColor: cat.bg, color: cat.color }}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <span className="truncate">{cat.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2">Condition</label>
                  <div className="space-y-2">
                    {CONDITIONS.map(cond => (
                      <button
                        type="button"
                        key={cond.value}
                        onClick={() => setCondition(cond.value)}
                        className={`w-full p-3 rounded-2xl border-2 text-left transition-all ${
                          condition === cond.value
                            ? 'border-blue-600 bg-blue-50/50'
                            : 'border-slate-100 hover:border-slate-200'
                        }`}
                      >
                        <p className="text-xs font-bold text-slate-900">{cond.label}</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">{cond.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2">Location (Governorate)</label>
                  <select
                    value={location}
                    onChange={e => setLocation(e.target.value)}
                    className="w-full border border-slate-200 rounded-2xl px-4 py-3 text-xs outline-none focus:border-blue-500 bg-white"
                  >
                    {GOVERNORATES.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Pricing */}
        {step === 3 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-xl font-black text-slate-900">Set Listing Price</h2>
              <p className="text-xs text-slate-500 mt-0.5">Competitive pricing attracts fast, verified buyers.</p>
            </div>

            <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Price in Egyptian Pounds (EGP)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">EGP</span>
                  <input
                    type="number"
                    value={price}
                    onChange={e => setPrice(e.target.value)}
                    placeholder="0"
                    min="1"
                    className="w-full border-2 border-slate-200 rounded-2xl pl-16 pr-4 py-3.5 text-2xl font-black text-slate-900 outline-none focus:border-blue-500"
                    autoFocus
                  />
                </div>
              </div>

              {Number(price) > 0 && (
                <div className="bg-blue-50/70 border border-blue-100 rounded-2xl p-4 text-xs space-y-2">
                  <div className="flex justify-between text-slate-600">
                    <span>Listing Amount:</span>
                    <span className="font-bold text-slate-900">{formatEGP(Number(price))}</span>
                  </div>
                  <div className="flex justify-between text-blue-700">
                    <span>Escrow Platform Fee (4%):</span>
                    <span>-{formatEGP(Math.round(Number(price) * 0.04))}</span>
                  </div>
                  <div className="pt-2 border-t border-blue-200 flex justify-between text-sm font-black text-blue-900">
                    <span>You Receive in Wallet:</span>
                    <span>{formatEGP(Math.round(Number(price) * 0.96))}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Action Controls */}
        <div className="flex gap-3 mt-6">
          {step > 1 && (
            <button
              onClick={() => setStep(s => s - 1)}
              className="flex-1 border border-slate-200 text-slate-700 font-bold py-3.5 rounded-2xl hover:bg-slate-100 text-xs transition-colors"
            >
              Previous Step
            </button>
          )}

          {step < 3 ? (
            <button
              onClick={handleNext}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-2xl text-xs shadow-md transition-colors"
            >
              Continue to {STEPS[step].label}
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={uploading}
              className="flex-1 bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 hover:from-blue-700 text-white font-black py-3.5 rounded-2xl text-xs shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2 transition-all"
            >
              <Sparkles className="w-4 h-4" />
              {uploading ? 'Publishing Listing...' : 'Publish Listing Now'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SellPage() {
  return (
    <ProtectedRoute>
      <SellContent />
    </ProtectedRoute>
  );
}
