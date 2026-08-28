'use client';

import React from 'react';
import Link from 'next/link';
import { Scale, ShieldCheck, AlertOctagon, HelpCircle, Mail, FileText, CheckCircle2, ArrowRight } from 'lucide-react';
import { useLanguage } from '@/components/LanguageProvider';

export default function TermsPage() {
  const { isRTL } = useLanguage();

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
• Escrow funds remain frozen during active dispute reviews.
• EgyBay's compliance team assesses courier weight logs, condition evidence, and chat records within 48 business hours.
• In the event of a justified return, a return courier pickup is scheduled, and 100% of the item price is refunded to the buyer's original payment method upon return confirmation.`,
    },
    {
      id: 'prohibited',
      title: '4. Prohibited & Illegal Goods Policy',
      content: `In strict compliance with Egyptian Penal Law and Trade Regulations, the listing or exchange of any of the following items is strictly prohibited and subject to immediate account termination and reporting to the Egyptian Cybercrime Department (مباحث الإنترنت):

1. Weapons, firearms, ammunition, replica tactical weapons, and military equipment.
2. Counterfeit, replica, or unauthorized trademark knockoffs.
3. Smuggled or non-tax-paid electronics without official Egyptian customs clearance.
4. Narcotics, pharmaceuticals, regulated medical equipment, and uncertified supplements.
5. Stolen property, pirated software, leaked digital accounts, or credentials.
6. Hazardous chemicals, explosives, and illegal contraband.`,
    },
    {
      id: 'seller-obligations',
      title: '5. Seller Obligations & Identity Verification (KYC)',
      content: `A. Identity Verification:
Sellers must provide valid Egyptian National ID details (14 digits) and verified payout channels prior to receiving platform disbursements.

B. Listing Accuracy:
Sellers must disclose all cosmetic flaws, battery health, warranty status, and included accessories. Misleading photographs or concealed defects constitute a violation of these Terms.

C. Order Fulfillment:
Sellers must dispatch sold items via our integrated courier partner within 48 hours of order placement. Failure to fulfill orders repeatedly results in permanent account deactivation.`,
    },
    {
      id: 'liability',
      title: '6. Limitation of Liability & Force Majeure',
      content: `EgyBay provides its marketplace platform on an "as-is" and "as-available" basis. While we enforce rigorous escrow safeguards and seller verification, EgyBay shall not be liable for indirect, incidental, or consequential damages resulting from unauthorized user conduct or off-platform transactions. All transactions conducted outside EgyBay's escrow checkout forfeit all platform buyer and seller protections.`,
    },
  ];

  const arSections = [
    {
      id: 'acceptance',
      title: '١. طبيعة المنصة والموافقة على الشروط',
      content: `مرحباً بكم في منصة إيجي باي (egbay.shop). بالوصول إلى الموقع أو تسجيل حساب أو إتمام عمليات شراء وبيع، فإنك توافق على الالتزام الكامل بهذه الشروط والأحكام الخاضعة لقوانين جمهورية مصر العربية (قانون حماية المستهلك رقم ١٨١ لسنة ٢٠١٨ والقانون المدني).

تعمل إيجي باي كمنصة تكنولوجية وسيطة لربط البائعين والمشترين، وتوفير نظام حماية الضمان المالي (Escrow)، وتنسيق الشحن السريع، والوساطة في النزاعات. إيجي باي ليست مُصنّعاً أو مالكاً للمنتجات المعروضة من البائعين المستقلين.`,
    },
    {
      id: 'escrow',
      title: '٢. نظام الضمان المالي وآليات صرف الأرباح',
      content: `جميع المعاملات التي تتم عبر نظام الدفع في إيجي باي محمية بنظام الضمان المالي الإلزامي ١٠٠٪:

أ. حجز أموال المشتري:
عند قيام المشتري بالطلب، يتم تجميد المبلغ في حساب ضمان آمن ومحايد وإخطار البائع لتجهيز وشحن السلعة.

ب. التحقق عند التسليم (شحن أو تسليم يدوي):
• التوصيل عبر الشحن (بوسطة): يحصل المشتري على مهلة فحص لمدة ٢٤ ساعة للتأكد من مطابقة السلعة للوصف والصور.
• التسليم اليدوي: يعاين المشتري السلعة بنفسه، وعند الرضا التام يسلّم كود الـ PIN المكون من ٤ أرقام للبائع لتحرير المبلغ فوراً.

ج. تحويل مستحقات البائع:
بمجرد إدخال كود PIN أو انتهاء مهلة الفحص دون نزاع، يتم تحويل صافي أرباح البائع مباشرة عبر:
• إنستاباي (InstaPay IPA) — تحويل فوري
• فودافون كاش والمحافظ الذكية — في نفس اليوم
• الحساب البنكي (IBAN) — خلال يوم إلى يومي عمل

د. هيكل العمولات:
تخصم إيجي باي عمولة منصة شفافة (بين ٣٪ إلى ٦٪) تُقتطع تلقائياً من إجمالي مبلغ البيع دون أي رسوم خفية.`,
    },
    {
      id: 'disputes',
      title: '٣. مهلة الفحص وسياسة حل النزاعات والاسترجاع',
      content: `أ. مهلة الفحص (٢٤ ساعة):
يحق للمشتري فحص وتجربة السلعة المستلمة خلال ٢٤ ساعة من تاريخ الاستلام من مندوب الشحن.

ب. فتح نزاع رسمي:
إذا كانت السلعة مقلدة، تالفة، أو غير مطابقة للوصف، يجب على المشتري الضغط على "فتح نزاع" قبل انتهاء مهلة الفحص وإرفاق صور أو فيديو يوضح العيب.

ج. إجراءات الفصل والاسترداد:
• تظل أموال الضمان مجمدة طوال فترة مراجعة النزاع.
• يفحص فريق الامتثال الأدلة وسجلات الشحن خلال ٤٨ ساعة عمل.
• في حال إقرار حق الإرجاع، يتم استرجاع السلعة من المشتري ورد ١٠٠٪ من ثمن السلعة لحسابه فوراً.`,
    },
    {
      id: 'prohibited',
      title: '٤. قائمة السلع والمواد المحظورة قانوناً',
      content: `وفقاً لقانون العقوبات المصري وقوانين مكافحة جرائم تقنية المعلومات، يُحظر تماماً عرض أو تداول أي من السلع التالية، ويتم إيقاف الحساب فوراً وإبلاغ مباحث الإنترنت:

١. الأسلحة النارية والبيضاء، الذخائر، والمعدات العسكرية أو التكتيكية.
٢. المنتجات المقلدة أو المنسوخة (Fake / Replica) المنتهكة لحقوق الملكية الفكرية.
٣. الإلكترونيات المهربة أو غير المسددة للجمارك والضرائب المصرية الرسمية.
٤. المواد المخدرة، الأدوية والعقاقير الطبية، والمكملات غير المرخصة من وزارة الصحة.
٥. الحسابات الرقمية المخترقة، والبرمجيات المقرصنة، والبيانات المسربة.
٦. المواد الكيميائية الخطرة والمفرقعات.`,
    },
    {
      id: 'seller-obligations',
      title: '٥. التزامات البائع والتحقق من الهوية (KYC)',
      content: `أ. التحقق من الهوية:
يلتزم البائع بإدخال بيانات بطاقة الرقم القومي المصري (١٤ رقماً) وتأكيد حساب السحب قبل استلام أرباح المبيعات.

ب. دقة وصحة بيانات الإعلان:
يلتزم البائع بتوضيح حالة السلعة، نسبة كفاءة البطارية، وحالة الضمان، وأي عيوب بوضوح. تقديم صور مضللة يعد مخالفة صريحة.

ج. سرعة الشحن:
يلتزم البائع بتسليم الطرد لمندوب الشحن خلال ٤٨ ساعة من تأكيد الطلب.`,
    },
    {
      id: 'liability',
      title: '٦. إخلاء المسؤولية والحد القانوني',
      content: `تقدم إيجي باي خدماتها وفق أعلى معايير الأمان التكنولوجي والضمان المالي. لا تتحمل المنصة مسؤولية أي تعاملات مالية أو اتفاقات تتم خارج نظام الضمان المالي الرسمي للموقع. المعاملات الخارجية تفقد كافة حقوق الحماية والتعويض.`,
    },
  ];

  const sections = isRTL ? arSections : enSections;

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      {/* Header */}
      <div className="text-center mb-10">
        <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center mx-auto mb-4 border border-blue-100 shadow-sm">
          <Scale className="w-7 h-7" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight mb-2">
          {isRTL ? 'شروط وأحكام الاستخدام والضمان المالي' : 'Terms of Service & Escrow Agreement'}
        </h1>
        <p className="text-xs sm:text-sm text-gray-500 max-w-xl mx-auto mb-6">
          {isRTL
            ? 'القواعد الحاكمة لمنصة إيجي باي، نظام حماية الضمان المالي، التزامات البائعين وحقوق المشترين وفقاً للقانون المصري.'
            : 'Governing rules for EgyBay, Escrow protection mechanisms, seller verification, and buyer rights under Egyptian Law.'}
        </p>
      </div>

      {/* Trust Highlights Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-4 flex items-center gap-3">
          <ShieldCheck className="w-6 h-6 text-emerald-600 flex-shrink-0" />
          <div>
            <h4 className="text-xs font-bold text-gray-900">
              {isRTL ? 'ضمان مالي ١٠٠٪' : '100% Escrow Protection'}
            </h4>
            <p className="text-[11px] text-gray-500">
              {isRTL ? 'حجز الأموال حتى فحص السلعة' : 'Funds released only after inspection'}
            </p>
          </div>
        </div>

        <div className="bg-blue-50/70 border border-blue-200/80 rounded-2xl p-4 flex items-center gap-3">
          <FileText className="w-6 h-6 text-blue-600 flex-shrink-0" />
          <div>
            <h4 className="text-xs font-bold text-gray-900">
              {isRTL ? 'قانون حماية المستهلك' : 'Law No. 181/2018'}
            </h4>
            <p className="text-[11px] text-gray-500">
              {isRTL ? 'امتثال تام للقوانين المصرية' : 'Full Egyptian legal compliance'}
            </p>
          </div>
        </div>

        <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-4 flex items-center gap-3">
          <AlertOctagon className="w-6 h-6 text-amber-600 flex-shrink-0" />
          <div>
            <h4 className="text-xs font-bold text-gray-900">
              {isRTL ? 'منع السلع المقلدة' : 'Zero Fake Items Policy'}
            </h4>
            <p className="text-[11px] text-gray-500">
              {isRTL ? 'إحالة المخالفين لمباحث الإنترنت' : 'Strict anti-fraud enforcement'}
            </p>
          </div>
        </div>
      </div>

      {/* Main Content Sections */}
      <div className={`bg-white rounded-3xl border border-gray-200/80 shadow-sm divide-y divide-gray-100 overflow-hidden ${isRTL ? 'text-right' : 'text-left'}`}>
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
            {isRTL ? 'هل لديك استفسار أو طلب مساعدة في نزاع؟' : 'Need Support or Mediation Assistance?'}
          </h3>
          <p className="text-gray-600 text-xs sm:text-sm mb-4 leading-relaxed">
            {isRTL
              ? 'فريق خدمة العملاء والوساطة متاح على مدار الساعة لمساعدتك في حل أي نزاع أو الإجابة على استفسارات الشروط:'
              : 'Our mediation and dispute resolution specialists are available to review transaction claims and answer legal inquiries:'}
          </p>
          <div className="flex flex-wrap gap-3">
            <a
              href="mailto:info@egbay.shop"
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-5 py-2.5 rounded-xl transition-all shadow-sm flex items-center gap-2"
            >
              <Mail className="w-3.5 h-3.5" /> info@egbay.shop
            </a>
            <Link
              href="/privacy"
              className="bg-white hover:bg-gray-50 text-emerald-700 border border-emerald-200 text-xs font-bold px-5 py-2.5 rounded-xl transition-all shadow-sm flex items-center gap-2"
            >
              {isRTL ? 'عرض سياسة الخصوصية' : 'View Privacy Policy →'}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
