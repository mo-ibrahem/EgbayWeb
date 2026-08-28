'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Scale, ShieldCheck, AlertOctagon, HelpCircle, Mail, FileText, CheckCircle2, ArrowRight } from 'lucide-react';
import { useLanguage } from '@/components/LanguageProvider';

export default function TermsPage() {
  const { isRTL } = useLanguage ? useLanguage() : { isRTL: false };
  const [activeTab, setActiveTab] = useState<'en' | 'ar'>(isRTL ? 'ar' : 'en');

  const enSections = [
    {
      id: 'acceptance',
      title: '1. Platform Role & Acceptance of Agreement',
      content: `Welcome to EgyBay (egbay.shop). By accessing the website, registering an account, or conducting transactions, you enter into a legally binding agreement under the laws of the Arab Republic of Egypt (Consumer Protection Law No. 181/2018 and Civil Code).

EgyBay acts strictly as an intermediary technology platform providing peer-to-peer listing tools, integrated escrow payment safeguards, courier logistics coordination, and dispute mediation. EgyBay is not the manufacturer, retailer, or physical owner of items listed by independent sellers.`,
    },
    {
      id: 'escrow',
      title: '2. Escrow Protection & Payout Mechanics',
      content: `All transactions conducted through EgyBay's checkout are protected by our mandatory 100% Escrow Protection System:

A. Buyer Payment Holding:
When a buyer purchases an item, funds are immediately secured in a neutral escrow holding ledger. The seller is notified to prepare and dispatch the item.

B. Courier & In-Person PIN Verification:
• Courier Delivery (Bosta): Upon delivery, the buyer receives a 24-hour inspection window to verify that the item matches the seller's photos and description.
• In-Person Meetup: The buyer inspects the item physically, and upon total satisfaction, provides the confidential 4-digit PIN to the seller to authorize instantaneous fund release.

C. Seller Payout Execution:
Upon PIN confirmation or inspection window expiry without dispute, seller net proceeds are transferred directly to their registered Egyptian payout method:
• InstaPay (Instant Transfer via IPA)
• Vodafone Cash / Smart Wallet (Same-Day)
• Egyptian Bank IBAN (1–2 Business Days)

D. Fee Structure:
EgyBay charges a transparent marketplace platform commission (between 3% to 6%) automatically deducted from the seller's gross payout. There are no hidden fees.`,
    },
    {
      id: 'disputes',
      title: '3. Inspection Window & Dispute Resolution',
      content: `A. 24-Hour Buyer Inspection Window:
Buyers are entitled to thoroughly test and inspect delivered goods within 24 hours of package receipt.

B. Filing a Dispute:
If an item is counterfeit, damaged in transit, or significantly not as described, the buyer must click "Open Dispute" before the inspection window closes and upload clear photographic or video evidence.

C. Mediation & Refund Protocol:
1. Escrow funds remain locked during mediation.
2. The seller is given 24 hours to respond or agree to a return.
3. If resolved in favor of the buyer, a courier return is scheduled, and a 100% full refund is credited back to the buyer's original payment method.`,
    },
    {
      id: 'prohibited',
      title: '4. Prohibited & Restricted Items (قائمة المحظورات)',
      content: `Sellers are strictly forbidden from listing the following items under Egyptian Penal Code and Customs Regulations:
• Counterfeit, replica, or unauthorized trademarked apparel, electronics, and accessories.
• Weapons, firearms, ammunition, tactical knives, or explosive materials.
• Prescription medicines, pharmaceutical compounds, narcotics, and controlled substances.
• Stolen property, pirated software, or illegally unlocked mobile devices (Blacklisted IMEI).
• Foreign currency exchange, financial securities, or pyramid scheme services.
• Surveillance devices, hidden spy cameras, or unauthorized signal jammers.

Any listing found violating this section will be deleted immediately, the seller's account will be permanently banned, and illegal listings will be referred to the Egyptian Cybercrime Directorate (مباحث الإنترنت).`,
    },
    {
      id: 'verification',
      title: '5. Seller Verification & Anti-Fraud KYC',
      content: `To build trust across the Egyptian marketplace:
• Sellers may undergo voluntary or mandatory National ID (بطاقة الرقم القومي) verification to obtain the "Verified Seller" badge.
• Users agree to provide authentic, verifiable identity details and maintain only one primary account.
• Impersonation of brands, companies, or individuals constitutes fraud and leads to immediate legal action.`,
    },
    {
      id: 'liability',
      title: '6. Limitation of Liability & Warranties',
      content: `• EgyBay provides the platform "As Is" and "As Available". While our escrow system guarantees financial protection during active transactions, EgyBay does not provide direct manufacturer warranties for second-hand items.
• Users are individually responsible for honoring all agreements made in buyer-seller chat.
• EgyBay is not liable for indirect losses, off-platform cash deals made outside the escrow system, or courier delays caused by force majeure.`,
    },
    {
      id: 'governing',
      title: '7. Governing Law & Jurisdiction',
      content: `These terms shall be governed by and construed in accordance with the laws of the Arab Republic of Egypt. Any legal disputes arising out of or related to these terms shall be subject to the exclusive jurisdiction of the competent courts of Cairo, Egypt.`,
    },
  ];

  const arSections = [
    {
      id: 'acceptance',
      title: '١. دور المنصة وقبول اتفاقية الاستخدام',
      content: `أهلاً بك في منصة إيجي باي (egbay.shop). يشكل استخدامك للموقع أو التطبيق عقداً قانونياً ملزماً وفقاً لأحكام القانون المصري (قانون حماية المستهلك رقم ١٨١ لسنة ٢٠١٨ والقانون المدني).

تعمل إيجي باي كمنصة وساطة تكنولوجية تربط بين البائعين والمشترين في مصر، وتوفر بنية الضمان المالي لحجز المدفوعات وتنسيق الشحن والوساطة في النزاعات. ولا تعتبر إيجي باي بائعاً مباشراً أو مصنعاً للمنتجات المعروضة من قبل المستخدمين.`,
    },
    {
      id: 'escrow',
      title: '٢. نظام الضمان المالي (Escrow) وتحويل الأرباح',
      content: `تخضع جميع المعاملات عبر المنصة لنظام الضمان المالي الإلزامي لحماية أموال الطرفين:

أ. حجز أموال المشتري بأمان:
عند إتمام الشراء، يتم حجز قيمة الطلب في حساب ضمان وسيط ومؤمّن بالكامل، ويتم إشعار البائع لتجهيز الشحنة وإرسالها.

ب. التسليم عبر الشحن أو كود الاستلام (PIN):
• الشحن لباب البيت (بوسطة Bosta): يحصل المشتري على مهلة فحص لمدة ٢٤ ساعة للتأكد من مطابقة السلعة للمواصفات المعلنة.
• التسليم يداً بيد: يقوم المشتري بفحص السلعة ومعاينتها، وعند الرضا التام يسلّم كود PIN المكون من ٤ أرقام للبائع لتحرير المبلغ فوراً.

ج. تحويل الأرباح للبائعين:
فور إدخال كود PIN أو انقضاء مهلة الفحص دون نزاع، يتم إرسال صافي المبلغ فورياً لوجهة السحب المسجلة للبائع:
• إنستاباي InstaPay (تحويل فوري)
• محافظ فودافون كاش والمحافظ الذكية (في نفس اليوم)
• الحساب البنكي والآيبان IBAN (خلال ١-٢ يوم عمل)

د. عمولة المنصة:
تقتطع إيجي باي عمولة خدمة شفافة (من ٣٪ إلى ٦٪) تُخصم تلقائياً من أرباح البائع عند نجاح المعاملة فقط.`,
    },
    {
      id: 'disputes',
      title: '٣. مهلة الفحص وحل النزاعات واسترداد الأموال',
      content: `أ. مهلة الفحص (٢٤ ساعة):
يحق للمشتري فحص وتجربة السلعة المستلمة للتأكد من خلوها من العيوب غير المعلنة.

ب. فتح نزاع رسمي (Dispute):
في حال وجود تلف ناتج عن الشحن أو استلام سلعة مقلدة أو غير مطابقة للوصف، يقوم المشتري بالضغط على "فتح نزاع" ورفع صور أو فيديو يوضح المشكلة قبل انتهاء مهلة الفحص.

ج. إجراءات الاسترداد:
يتم تجميد المبلغ في الضمان، ومراجعة الأدلة من قبل فريق الدعم والوساطة، وفي حال ثبوت عدم مطابقة السلعة يتم تنسيق إرجاعها واسترداد كامل المبلغ للمشتري لحسابه الأصلي.`,
    },
    {
      id: 'prohibited',
      title: '٤. السلع والمنتجات المحظورة تماماً (قائمة المحظورات)',
      content: `يُحظر تماماً عرض أو بيع السلع التالية وفقاً لقانون العقوبات والجمارك المصرية:
• السلع المقلدة والمزورة التي تنتهك حقوق العلامات التجارية وحقوق الملكية الفكرية.
• الأسلحة والذخائر والصواعق والألعاب النارية والمواد القابلة للاشتعال.
• الأدوية والمستحضرات الطبية والعقاقير والمواد الخاضعة للرقابة وجداول المخدرات.
• الأجهزة المسروقة أو الهواتف المهربة أو مجهولة المصدر (مغلقة IMEI).
• تبادل العملات الأجنبية خارج القنوات المصرفية الرسمية أو معاملات التسويق الهرمي.
• أجهزة التنصت والكاميرات السرية أو أجهزة التشويش على الاتصالات.

أي إعلان مخالف يتم حذفه فوراً، مع إيقاف الحساب نهائياً وإحالة الوقائع المخالفة قانوناً إلى الإدارة العامة لمباحث الإنترنت.`,
    },
    {
      id: 'verification',
      title: '٥. توثيق هوية البائعين ومكافحة الاحتيال (KYC)',
      content: `• تتيح المنصة للبائعين توثيق هوياتهم عبر بطاقة الرقم القومي المصري للحصول على شارة "بائع موثق".
• يتعهد المستخدم بتقديم بيانات صحيحة وعدم إنشاء حسابات وهمية أو انتحال أسماء علامات تجارية أو أشخاص.`,
    },
    {
      id: 'liability',
      title: '٦. حدود المسؤولية والضمانات',
      content: `• توفر إيجي باي المنصة التقنية لحماية المعاملات، ولا تقدم ضمانات مصنعية مباشرة للسلع المستعملة خارج نطاق مهلة الفحص المحددة.
• تخلي المنصة مسؤوليتها عن أي تعاملات نقدية تتم خارج المنصة بعيداً عن نظام الضمان المالي المعتمد.`,
    },
    {
      id: 'governing',
      title: '٧. القانون واجب التطبيق والاختصاص القضائي',
      content: `تخضع هذه الشروط وتُفسر وفقاً لقوانين جمهورية مصر العربية، وتختص المحاكم المصرية في القاهرة بالفصل في أي نزاع ينشأ عن استخدام المنصة.`,
    },
  ];

  const sections = activeTab === 'ar' ? arSections : enSections;

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      {/* Header */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-3xl mb-4 shadow-sm">
          <Scale className="w-8 h-8 text-blue-600" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-gray-900 mb-3 tracking-tight">
          {activeTab === 'ar' ? 'الشروط والأحكام واتفاقية الاستخدام' : 'Terms of Service & Escrow Agreement'}
        </h1>
        <p className="text-gray-500 text-xs sm:text-sm max-w-2xl mx-auto leading-relaxed">
          {activeTab === 'ar'
            ? 'القواعد المنظمة للبيع والشراء ونظام الضمان المالي وحماية حقوق المستخدمين داخل جمهورية مصر العربية.'
            : 'Rules and conditions governing peer-to-peer transactions, escrow buyer protection, seller payouts, and community safety in Egypt.'}
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
            🇺🇸 English Agreement
          </button>
          <button
            onClick={() => setActiveTab('ar')}
            className={`px-5 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'ar'
                ? 'bg-white text-blue-700 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            🇪🇬 الشروط بالعربية
          </button>
        </div>
      </div>

      {/* Trust Highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="p-4 bg-white rounded-2xl border border-gray-200/80 shadow-sm flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-gray-900">
              {activeTab === 'ar' ? 'حماية الضمان المالي 100%' : '100% Escrow Protection'}
            </h4>
            <p className="text-[11px] text-gray-500">
              {activeTab === 'ar' ? 'أموالك محفوظة حتى الفحص' : 'Zero upfront seller release'}
            </p>
          </div>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-gray-200/80 shadow-sm flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-gray-900">
              {activeTab === 'ar' ? 'مهلة فحص ٢٤ ساعة' : '24h Inspection Window'}
            </h4>
            <p className="text-[11px] text-gray-500">
              {activeTab === 'ar' ? 'حق المعاينة قبل تحرير المبلغ' : 'Inspect before payout release'}
            </p>
          </div>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-gray-200/80 shadow-sm flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center flex-shrink-0">
            <AlertOctagon className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-gray-900">
              {activeTab === 'ar' ? 'منع السلع المقلدة' : 'Zero Fake Items Policy'}
            </h4>
            <p className="text-[11px] text-gray-500">
              {activeTab === 'ar' ? 'إحالة المخالفين لمباحث الإنترنت' : 'Strict anti-fraud enforcement'}
            </p>
          </div>
        </div>
      </div>

      {/* Main Content Sections */}
      <div className={`bg-white rounded-3xl border border-gray-200/80 shadow-sm divide-y divide-gray-100 overflow-hidden ${activeTab === 'ar' ? 'text-right' : 'text-left'}`}>
        {sections.map((section) => (
          <article key={section.id} className="p-6 sm:p-8 hover:bg-gray-50/50 transition-colors">
            <h2 className="text-base sm:text-lg font-bold text-gray-900 mb-3">
              {section.title}
            </h2>
            <div className="text-gray-600 text-xs sm:text-sm leading-relaxed whitespace-pre-line font-normal">
              {section.content}
            </div>
          </article>
        ))}

        {/* Support & Dispute Assistance Box */}
        <div className="p-6 sm:p-8 bg-gradient-to-br from-slate-50 to-blue-50/50 rounded-b-3xl">
          <h3 className="text-base font-bold text-gray-900 mb-2 flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-blue-600" />
            {activeTab === 'ar' ? 'هل لديك استفسار أو طلب مساعدة في نزاع؟' : 'Need Support or Mediation Assistance?'}
          </h3>
          <p className="text-gray-600 text-xs sm:text-sm mb-4 leading-relaxed">
            {activeTab === 'ar'
              ? 'فريق خدمة العملاء والوساطة متاح على مدار الساعة لمساعدتك في حل أي نزاع أو الإجابة على استفسارات الشروط:'
              : 'Our mediation and dispute resolution specialists are available to review transaction claims and answer legal inquiries:'}
          </p>
          <div className="flex flex-wrap gap-3">
            <a
              href="mailto:support@egbay.market"
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-5 py-2.5 rounded-xl transition-all shadow-sm flex items-center gap-2"
            >
              <Mail className="w-3.5 h-3.5" /> support@egbay.market
            </a>
            <Link
              href="/privacy"
              className="bg-white hover:bg-gray-50 text-emerald-700 border border-emerald-200 text-xs font-bold px-5 py-2.5 rounded-xl transition-all shadow-sm flex items-center gap-2"
            >
              {activeTab === 'ar' ? 'عرض سياسة الخصوصية' : 'View Privacy Policy →'}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
