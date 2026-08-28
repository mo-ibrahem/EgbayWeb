'use client';

import React from 'react';
import Link from 'next/link';
import { Shield, Lock, Eye, Trash2, Mail, FileText, CheckCircle2, Globe, Building2, AlertTriangle } from 'lucide-react';
import { useLanguage } from '@/components/LanguageProvider';

export default function PrivacyPage() {
  const { isRTL } = useLanguage();

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
      content: `To provide safe marketplace transactions, escrow payment protection, and courier fulfillment across Egypt, we collect:

A. Personal & Contact Information:
• Full name, email address, Egyptian mobile number (Vodafone, Orange, Etisalat, WE).
• Delivery & shipping addresses (Governorate, City/District, Street address, Building details).

B. Authentication & Security Data:
• Passwords securely hashed and salted via Supabase Auth with Row-Level Security (RLS).
• Session tokens, device IP address, and browser fingerprints for fraud and unauthorized access prevention.

C. Transaction & Escrow Ledger Data:
• Purchase and sale orders, escrow holding status, and confirmation PIN release timestamps.
• Verified seller payout destinations: InstaPay Address (IPA), Vodafone Cash / Mobile Wallet numbers, or Egyptian Bank IBAN.
• Note: Credit/debit card numbers are processed directly by our PCI-DSS Central Bank of Egypt-compliant payment gateway (Paymob). We never store complete credit card numbers or CVV codes on our servers.

D. Optional KYC Verification Data (For High-Tier Sellers):
• Egyptian National ID (بطاقة الرقم القومي) front and back images for account verification to safeguard buyers against fraud.`,
    },
    {
      id: 'usage',
      icon: Shield,
      title: '3. Purpose & Legal Basis of Processing',
      content: `We process personal data strictly for legitimate business and transactional purposes:
• Executing Escrow Transactions: Holding buyer funds safely until doorstep inspection or PIN confirmation, then disbursing payouts to sellers.
• Logistics & Order Delivery: Sharing accurate delivery addresses and recipient phone numbers with our courier partner (Bosta Express).
• Fraud Prevention: Detecting prohibited items, unauthorized logins, and lookalike marketplace attempts.
• Direct Communication: Sending transactional SMS/email receipts, order delivery updates, and customer support resolutions.`,
    },
    {
      id: 'sharing',
      icon: Lock,
      title: '4. Data Sharing & Third-Party Processors',
      content: `EgyBay NEVER sells, rents, or monetizes your personal data or contact details to third-party marketing brokers.

Data is shared strictly with authorized infrastructure partners necessary to fulfill platform operations:
• Courier Logistics (Bosta Egypt): For parcel dispatch and GPS-assisted doorstep delivery.
• Payment Processing (Paymob / Central Bank of Egypt Integrations): For card checkout and automated payouts.
• Cloud Infrastructure (Supabase / AWS Ireland/Frankfurt): Encrypted database storage with automated backups and strict access controls.
• Legal Authorities: Only when mandated by a legally binding court order or official warrant under Egyptian Law.`,
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
  2. By Email: Send a deletion request to info@egbay.shop from your registered email.
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
  ٢. عبر البريد الإلكتروني: مراسلتنا على info@egbay.shop من البريد المسجل.
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

  const sections = isRTL ? arSections : enSections;

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      {/* Header */}
      <div className="text-center mb-10">
        <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto mb-4 border border-emerald-100 shadow-sm">
          <Shield className="w-7 h-7" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight mb-2">
          {isRTL ? 'سياسة الخصوصية وحماية البيانات الشخصية' : 'Privacy Policy & Data Protection'}
        </h1>
        <p className="text-xs sm:text-sm text-gray-500 max-w-xl mx-auto mb-6">
          {isRTL
            ? 'نلتزم بحماية بياناتك الشخصية ومعاملاتك المالية وفقاً للقانون المصري رقم ١٥١ لسنة ٢٠٢٠ والمعايير العالمية.'
            : 'Compliant with Egyptian Law No. 151 of 2020, Law No. 181 of 2018, and Apple App Store Review Guidelines.'}
        </p>
      </div>

      {/* Compliance Highlights Ribbon */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-emerald-50/60 border border-emerald-100 rounded-2xl p-4 flex items-center gap-3">
          <Building2 className="w-6 h-6 text-emerald-600 flex-shrink-0" />
          <div>
            <h4 className="text-xs font-bold text-gray-900">
              {isRTL ? 'قانون ١٥١ لسنة ٢٠٢٠' : 'Egyptian Law 151/2020'}
            </h4>
            <p className="text-[11px] text-gray-500">
              {isRTL ? 'حماية تامة للبيانات الشخصية' : 'Personal data protection compliant'}
            </p>
          </div>
        </div>

        <div className="bg-blue-50/60 border border-blue-100 rounded-2xl p-4 flex items-center gap-3">
          <Lock className="w-6 h-6 text-blue-600 flex-shrink-0" />
          <div>
            <h4 className="text-xs font-bold text-gray-900">
              {isRTL ? 'معايير Apple 5.1' : 'Apple 5.1 Privacy Ready'}
            </h4>
            <p className="text-[11px] text-gray-500">
              {isRTL ? 'حذف فوري للحساب والبيانات' : 'Instant account & data deletion'}
            </p>
          </div>
        </div>

        <div className="bg-purple-50/60 border border-purple-100 rounded-2xl p-4 flex items-center gap-3">
          <Shield className="w-6 h-6 text-purple-600 flex-shrink-0" />
          <div>
            <h4 className="text-xs font-bold text-gray-900">
              {isRTL ? 'تشفير AES-256' : 'AES-256 TLS Encryption'}
            </h4>
            <p className="text-[11px] text-gray-500">
              {isRTL ? 'أعلى معايير الأمان المصرفي' : 'Bank-grade SSL transmission'}
            </p>
          </div>
        </div>
      </div>

      {/* Main Content Sections */}
      <div className={`bg-white rounded-3xl border border-gray-200/80 shadow-sm divide-y divide-gray-100 overflow-hidden ${isRTL ? 'text-right' : 'text-left'}`}>
        {sections.map((section) => {
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
              {isRTL ? 'التواصل مع مسؤول الخصوصية وحماية البيانات' : 'Data Protection Officer & Privacy Inquiries'}
            </h3>
          </div>
          <p className="text-gray-600 text-xs sm:text-sm mb-4 leading-relaxed">
            {isRTL
              ? 'إذا كان لديك أي استفسار أو طلب لتعديل أو حذف بياناتك الشخصية، يسعدنا تواصلك مع فريق الامتثال القانوني:'
              : 'For data access requests, deletion verifications, or regulatory inquiries, contact our dedicated legal & privacy team:'}
          </p>
          <div className="flex flex-wrap gap-3">
            <a
              href="mailto:info@egbay.shop"
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-5 py-2.5 rounded-xl transition-all shadow-sm flex items-center gap-2"
            >
              <Mail className="w-3.5 h-3.5" /> info@egbay.shop
            </a>
            <Link
              href="/terms"
              className="bg-white hover:bg-gray-50 text-indigo-600 border border-indigo-200 text-xs font-bold px-5 py-2.5 rounded-xl transition-all shadow-sm flex items-center gap-2"
            >
              {isRTL ? 'عرض الشروط والأحكام' : 'View Terms of Service →'}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
