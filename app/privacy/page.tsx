'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Shield, Lock, Eye, Trash2, Mail, FileText, CheckCircle2, Globe, Building2, AlertTriangle } from 'lucide-react';
import { useLanguage } from '@/components/LanguageProvider';

export default function PrivacyPage() {
  const { isRTL, language, setLanguage } = useLanguage ? useLanguage() : { isRTL: false, language: 'en', setLanguage: () => {} };
  const [activeTab, setActiveTab] = useState<'en' | 'ar'>(isRTL ? 'ar' : 'en');

  const enSections = [
    {
      id: 'scope',
      icon: Eye,
      title: '1. Scope & Legal Framework',
      content: `Welcome to EgyBay (egbay.shop / EgyBay Mobile Application). We are dedicated to maintaining the highest standards of data privacy and security.

This Privacy Policy complies with:
• Egyptian Personal Data Protection Law No. 151 of 2020 (قانون حماية البيانات الشخصية).
• Egyptian E-Commerce Regulations and Consumer Protection Law No. 181 of 2018.
• Apple App Store Review Guidelines (Section 5.1 - Privacy and Data Security).
• Google Play Developer Policy on User Data.

By accessing our website, creating an account, or transacting on EgyBay, you acknowledge and agree to the practices described in this policy.`,
    },
    {
      id: 'collection',
      icon: FileText,
      title: '2. Information We Collect',
      content: `To ensure 100% secure escrow transactions, verify seller legitimacy, and facilitate door-to-door courier delivery across Egypt, we collect:

A. Personal Identifiers:
• Full Name, Valid Email Address, and Egyptian Mobile Phone Number (e.g., Vodafone, Orange, Etisalat, WE).
• Delivery & Pickup Physical Addresses (Governorate, City, Street, Building number).

B. Authentication & Security Data:
• Encrypted account credentials handled via Supabase Authentication with Row-Level Security (RLS).
• Device and session identifiers (IP address, browser type, and operating system) strictly for fraud prevention and account protection.

C. Marketplace & Escrow Transaction Data:
• Order history, escrow holding states, dispute logs, and item inspection timestamps.
• Payout destination identifiers provided voluntarily by sellers (InstaPay IPA address, Vodafone Cash mobile number, or Bank Account IBAN).
• Note: Electronic payment cards (Debit/Credit) are processed directly by Central Bank of Egypt-licensed payment gateways (Paymob). We never store raw card numbers or CVV codes.

D. Seller KYC Verification (Anti-Fraud):
• For verified seller badges, front and back photos of the Egyptian National ID (بطاقة الرقم القومي) are encrypted and stored in secure, private buckets accessible only to authorized compliance officers.`,
    },
    {
      id: 'usage',
      icon: Shield,
      title: '3. How We Process & Use Your Data',
      content: `We process your data strictly under lawful bases (contract fulfillment, legal obligation, and legitimate interest):
• Escrow & Order Fulfillment: Holding buyer funds safely during transit, generating delivery tracking codes, and releasing payouts upon PIN confirmation.
• Courier Coordination: Sharing destination address and recipient phone number with Bosta Courier and delivery couriers.
• Anti-Fraud & Scam Prevention: Monitoring for counterfeit listings, fraudulent dispute claims, and unauthorized account access.
• Transactional Notifications: Sending real-time order updates, buyer inquiries, and payout confirmations via SMS, email, and push notifications.`,
    },
    {
      id: 'sharing',
      icon: Lock,
      title: '4. Third-Party Data Sharing & Protection',
      content: `EgyBay NEVER sells, rents, or monetizes user personal data to data brokers, advertisers, or third parties.

We share minimal required data only with certified, vetted service providers:
• Logistics & Courier Partners (Bosta Egypt): Shipping address and contact phone number solely to complete package pickup and delivery.
• Payment Gateways (Paymob): Tokenized transaction data compliant with PCI-DSS and Central Bank of Egypt standards.
• Cloud Infrastructure (Supabase / AWS Frankfurt Region): Fully encrypted databases with TLS 1.3 in-transit and AES-256 at-rest encryption.
• Egyptian Law Enforcement: Only when strictly mandated by official court orders or binding legal processes under Egyptian law.`,
    },
    {
      id: 'rights',
      icon: Trash2,
      title: '5. Your Rights & Account Deletion (حقوق المستخدم)',
      content: `Under Law No. 151 of 2020 and Apple App Store guidelines, you have total control over your data:

• Right to Access & Rectify: You can review and edit your profile details at any time in Profile Settings.
• Right to Data Portability: Request an export of your order history, transaction records, and listing data.
• Right to Permanent Erasure (Account Deletion):
  1. In-App: Go to Profile → Settings → "Delete Account & Purge Data".
  2. By Email: Send a deletion request to privacy@egbay.market from your registered email.
  Upon request, all personal identifiers, active sessions, and uploaded documents are permanently purged within 72 hours, retaining only non-identifiable financial ledger records required by Egyptian commercial tax law.`,
    },
    {
      id: 'security',
      icon: CheckCircle2,
      title: '6. Security Architecture & Encryption',
      content: `• All traffic between your browser and our servers is encrypted using 256-bit TLS/SSL certificates.
• Database Row-Level Security (RLS) guarantees that only you and your counterparty can read private chat messages.
• National ID documents and verification media are stored in isolated private S3-compatible object storage with signed, expiring URLs.`,
    },
  ];

  const arSections = [
    {
      id: 'scope',
      icon: Eye,
      title: '١. النطاق والإطار القانوني',
      content: `أهلاً بك في منصة إيجي باي (egbay.shop وتطبيق الهاتف المحمول). نحن نلتزم بأعلى معايير حماية البيانات والخصوصية لجميع مستخدمينا في مصر.

تتوافق هذه السياسة بشكل كامل مع:
• قانون حماية البيانات الشخصية المصري رقم ١٥١ لسنة ٢٠٢٠.
• قانون حماية المستهلك رقم ١٨١ لسنة ٢٠١٨ وقواعد التجارة الإلكترونية المصرية.
• إرشادات متجر آبل (Apple App Store Guidelines Section 5.1).
• سياسات حماية بيانات المستخدمين في Google Play.

باستخدامك للموقع أو تسجيل حساب أو إتمام عمليات شراء وبيع، فإنك توافق على الممارسات الموضحة في هذه الوثيقة.`,
    },
    {
      id: 'collection',
      icon: FileText,
      title: '٢. البيانات التي نقوم بجمعها',
      content: `لضمان حماية أموالك بنظام الضمان المالي (Escrow) والتحقق من هوية البائعين وتوصيل الشحنات، نقوم بجمع:

أ. البيانات الشخصية وبيانات الاتصال:
• الاسم الكامل، البريد الإلكتروني، ورقم الهاتف المصري (فودافون، أورنج، اتصالات، وي).
• عنوان الشحن والاستلام (المحافظة، المدينة، اسم الشارع، رقم العقار).

ب. بيانات تسجيل الدخول والأمان:
• بيانات الحساب المشفرة عبر Supabase Authentication بنظام حماية Row-Level Security.
• عنوان البروتوكول (IP) ونوع المتصفح لضمان أمان الحساب ومنع الاختراق.

ج. بيانات المعاملات ونظام الضمان المالي:
• سجل الطلبات، حالة حجز المبالغ، وسجل تسليم كود الاستلام (PIN).
• وجهات استلام الأرباح للبائعين: عنوان إنستاباي (InstaPay IPA)، رقم محفظة فودافون كاش، أو الآيبان البنكي (IBAN).
• تنبيه: بيانات البطاقات البنكية يتم معالجتها مباشرة عبر بوابة دفع معتمدة من البنك المركزي المصري (Paymob) ولا يتم تخزين أي أرقام بطاقات أو رموز أمان على خوادمنا نهائياً.

د. توثيق هوية البائع (اختياري - لمنع الاحتيال):
• صورة بطاقة الرقم القومي المصري للبائعين الموثقين، تُحفظ في مساحات تخزين مشفرة لا يطلع عليها إلا مسؤولو الامتثال والرقابة.`,
    },
    {
      id: 'usage',
      icon: Shield,
      title: '٣. كيف نستخدم بياناتك ونحميها',
      content: `نستخدم بياناتك للأغراض المشروعة التالية فقط:
• تنفيذ الضمان المالي: حجز أموال المشتري حتى فحص المنتج واستلامه، ثم تحويل الأرباح للبائع فور تأكيد كود PIN.
• الشحن والتوصيل: مشاركة بيانات العنوان ورقم الهاتف مع شركة الشحن المعتمدة (بوسطة Bosta) لتوصيل الطلب.
• مكافحة الغش والاحتيال: فحص الإعلانات المخالفة ومنع الحسابات الوهمية والسلع المقلدة.
• الإشعارات الفورية: إرسال تحديثات حالة الطلب والرسائل عبر البريد الإلكتروني والرسائل النصية.`,
    },
    {
      id: 'sharing',
      icon: Lock,
      title: '٤. مشاركة البيانات مع أطراف ثالثة',
      content: `منصة إيجي باي لا تقوم نهائياً ببيع أو تأجير أو مشاركة بياناتك الشخصية مع شركات الإعلانات أو الوسطاء.

تتم مشاركة الحد الأدنى من البيانات الضرورية مع الجهات المعتمدة التالية فقط:
• شركات الشحن والخدمات اللوجستية (بوسطة مصر Bosta): لغرض تسليم الشحنة للعنوان المحدد.
• بوابات الدفع الإلكتروني (Paymob): لمعالجة عمليات الدفع المتوافقة مع معايير PCI-DSS والبنك المركزي المصري.
• البنية التحتية السحابية (خوادم Supabase المعتمدة): لحفظ قواعد البيانات بتشفير AES-256.
• الجهات القضائية المصرية: فقط في حال وجود طلب رسمي وملزم قانوناً وفق التشريعات المصرية.`,
    },
    {
      id: 'rights',
      icon: Trash2,
      title: '٥. حقوقك وحذف الحساب نهائياً (Account Deletion)',
      content: `وفقاً لقانون حماية البيانات الشخصية رقم ١٥١ وإرشادات آبل:

• حق الوصول والتعديل: يمكنك تعديل بياناتك الشخصية وإعلاناتك في أي وقت عبر صفحة الملف الشخصي.
• حق نقل البيانات: يمكنك طلب نسخة كاملة من سجل معاملاتك وبياناتك المسجلة.
• حق الحذف النهائي للحساب والبيانات:
  ١. عبر التطبيق والموقع: الملف الشخصي ← الإعدادات ← "حذف الحساب نهائياً".
  ٢. عبر البريد الإلكتروني: مراسلتنا على privacy@egbay.market من البريد المسجل.
  يتم مسح جميع بياناتك الشخصية ووثائقك وصورك نهائياً خلال ٧٢ ساعة من تاريخ الطلب.`,
    },
    {
      id: 'security',
      icon: CheckCircle2,
      title: '٦. معايير الأمان والتشفير',
      content: `• يتم تشفير جميع الاتصالات عبر شهادات SSL/TLS 256-bit عالية الأمان.
• المحادثات الخاصة بين المشترين والبائعين محمية بقواعد الأمان الصارمة على مستوى الصفوف (RLS).
• مستندات إثبات الشخصية تخضع لمستويات حماية مشددة مع روابط مؤقتة ومنتهية الصلاحية.`,
    },
  ];

  const sections = activeTab === 'ar' ? arSections : enSections;

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      {/* Header */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-100 rounded-3xl mb-4 shadow-sm">
          <Shield className="w-8 h-8 text-emerald-600" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-gray-900 mb-3 tracking-tight">
          {activeTab === 'ar' ? 'سياسة الخصوصية وحماية البيانات' : 'Privacy & Data Protection Policy'}
        </h1>
        <p className="text-gray-500 text-xs sm:text-sm max-w-2xl mx-auto leading-relaxed">
          {activeTab === 'ar'
            ? 'تلتزم منصة إيجي باي بحماية بياناتك الشخصية وحقوقك المالية وفقاً للقانون المصري رقم ١٥١ لسنة ٢٠٢٠ ومعايير أبل للتطبيقات.'
            : 'EgyBay is committed to securing your personal information and financial safety in accordance with Egyptian Data Protection Law No. 151/2020 and Apple App Store standards.'}
        </p>

        {/* Bilingual Selector Switcher */}
        <div className="mt-6 inline-flex items-center p-1 bg-gray-100 rounded-2xl border border-gray-200 shadow-inner">
          <button
            onClick={() => setActiveTab('en')}
            className={`px-5 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'en'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            🇺🇸 English Policy
          </button>
          <button
            onClick={() => setActiveTab('ar')}
            className={`px-5 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'ar'
                ? 'bg-white text-emerald-700 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            🇪🇬 الوثيقة بالعربية
          </button>
        </div>
      </div>

      {/* Trust Guarantee Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="p-4 bg-white rounded-2xl border border-gray-200/80 shadow-sm flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-gray-900">
              {activeTab === 'ar' ? 'تشفير كامل للبيانات' : '256-Bit SSL Encryption'}
            </h4>
            <p className="text-[11px] text-gray-500">
              {activeTab === 'ar' ? 'تشفير عالي المستوى للبيانات' : 'Zero plain-text financial storage'}
            </p>
          </div>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-gray-200/80 shadow-sm flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-gray-900">
              {activeTab === 'ar' ? 'قانون حماية البيانات ١٥١' : 'Law 151/2020 Compliant'}
            </h4>
            <p className="text-[11px] text-gray-500">
              {activeTab === 'ar' ? 'معتمد وفق القوانين المصرية' : 'Official Egyptian Regulatory standard'}
            </p>
          </div>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-gray-200/80 shadow-sm flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center flex-shrink-0">
            <Trash2 className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-gray-900">
              {activeTab === 'ar' ? 'حذف الحساب بضغطة زر' : 'Instant Account Purge'}
            </h4>
            <p className="text-[11px] text-gray-500">
              {activeTab === 'ar' ? 'مسح فوري للبيانات عند الطلب' : 'Complete data removal within 72h'}
            </p>
          </div>
        </div>
      </div>

      {/* Main Content Sections */}
      <div className={`bg-white rounded-3xl border border-gray-200/80 shadow-sm divide-y divide-gray-100 overflow-hidden ${activeTab === 'ar' ? 'text-right' : 'text-left'}`}>
        {sections.map((section, idx) => {
          const Icon = section.icon;
          return (
            <article key={section.id} className="p-6 sm:p-8 hover:bg-gray-50/50 transition-colors">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0 font-bold text-xs">
                  <Icon className="w-4 h-4" />
                </div>
                <h2 className="text-base sm:text-lg font-bold text-gray-900">
                  {section.title}
                </h2>
              </div>
              <div className="text-gray-600 text-xs sm:text-sm leading-relaxed whitespace-pre-line pl-11 rtl:pr-11 rtl:pl-0 font-normal">
                {section.content}
              </div>
            </article>
          );
        })}

        {/* Official Contact & Legal Inquiries Box */}
        <div className="p-6 sm:p-8 bg-gradient-to-br from-blue-50/70 to-indigo-50/40 rounded-b-3xl">
          <div className="flex items-center gap-2 mb-2">
            <Mail className="w-5 h-5 text-blue-600" />
            <h3 className="text-base font-bold text-gray-900">
              {activeTab === 'ar' ? 'التواصل مع مسؤول الخصوصية وحماية البيانات' : 'Data Protection Officer & Privacy Inquiries'}
            </h3>
          </div>
          <p className="text-gray-600 text-xs sm:text-sm mb-4 leading-relaxed">
            {activeTab === 'ar'
              ? 'إذا كان لديك أي استفسار أو طلب لتعديل أو حذف بياناتك الشخصية، يسعدنا تواصلك مع فريق الامتثال القانوني:'
              : 'For data access requests, deletion verifications, or regulatory inquiries, contact our dedicated legal & privacy team:'}
          </p>
          <div className="flex flex-wrap gap-3">
            <a
              href="mailto:privacy@egbay.market"
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-5 py-2.5 rounded-xl transition-all shadow-sm flex items-center gap-2"
            >
              <Mail className="w-3.5 h-3.5" /> privacy@egbay.market
            </a>
            <a
              href="mailto:support@egbay.market"
              className="bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 text-xs font-bold px-5 py-2.5 rounded-xl transition-all shadow-sm flex items-center gap-2"
            >
              support@egbay.market
            </a>
            <Link
              href="/terms"
              className="bg-white hover:bg-gray-50 text-indigo-600 border border-indigo-200 text-xs font-bold px-5 py-2.5 rounded-xl transition-all shadow-sm flex items-center gap-2"
            >
              {activeTab === 'ar' ? 'عرض الشروط والأحكام' : 'View Terms of Service →'}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
