'use client';

import React from 'react';
import Link from 'next/link';
import { Scale, ShieldCheck, AlertOctagon, HelpCircle, Mail, FileText, CheckCircle2, ArrowRight } from 'lucide-react';
import { useLanguage } from '@/components/LanguageProvider';
import { PAYMENTS_ENABLED } from '@/lib/platformCommerce';

export default function TermsPage() {
  const { isRTL } = useLanguage();

  const enSections = [
    {
      id: 'acceptance',
      title: '1. Platform Role & Acceptance of Agreement',
      content: `Welcome to Egbay (egbay.shop). By accessing the website, registering an account, or conducting transactions, you enter into a legally binding agreement under the laws of the Arab Republic of Egypt (Consumer Protection Law No. 181/2018 and Civil Code).

Egbay acts strictly as an intermediary technology platform providing peer-to-peer listing tools, integrated escrow payment safeguards, and dispute mediation. Egbay is not the manufacturer, retailer, or physical owner of items listed by independent sellers.`,
    },
    {
      id: 'escrow',
      title: '2. Escrow Protection & Payout Mechanics',
      content: `All transactions conducted through Egbay's checkout use our mandatory escrow system:

A. Buyer Payment Holding:
When a buyer purchases an item, funds are immediately secured in a neutral escrow holding ledger. The seller is notified to prepare and dispatch the item.

B. Courier & In-Person PIN Verification:
• Courier Delivery: The seller arranges delivery via a courier of their choice. Upon delivery, the buyer verifies that the item matches the seller's photos and description and confirms receipt to release funds.
• In-Person Meetup: The buyer inspects the item physically, and upon total satisfaction, provides the confidential 6-digit PIN to the seller to authorize fund release.

C. Seller Payout Execution:
Upon PIN confirmation (in-person meetup) or the buyer confirming receipt (courier delivery), seller net proceeds are transferred directly to their registered Egyptian payout method:
• InstaPay (via IPA)
• Vodafone Cash / Smart Wallet (Same-Day)
• Egyptian Bank IBAN (1–2 Business Days)

D. Fee Structure:
Egbay charges a transparent marketplace platform commission (between 1.5% and 3.5%, depending on seller tier) automatically deducted from the seller's gross payout, plus a card processing fee (2.75% + 3 EGP) for card-paid orders only -- wallet-balance payments have no processing fee. There are no hidden fees.`,
    },
    {
      id: 'disputes',
      title: '3. Buyer Protection & Dispute Resolution',
      content: `A. Filing a Dispute:
Before confirming receipt or releasing funds, buyers may inspect the delivered item. If it is counterfeit, damaged in transit, or significantly not as described, the buyer can open a dispute from their order page with a written explanation of the issue. Once a buyer confirms receipt (courier) or releases funds via PIN (in-person meetup), the transaction is final and can no longer be disputed.

B. Mediation & Refund Protocol:
• Escrow funds remain frozen for the entire duration of an open dispute.
• Egbay's team reviews both the buyer's and seller's account of events and resolves the dispute directly.
• If the dispute is resolved in the buyer's favor, the escrowed amount is refunded to the buyer's Egbay wallet balance. If resolved in the seller's favor, the escrowed amount is released to the seller as normal.`,
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
Sellers must dispatch sold items, using a courier of their choice, within 48 hours of order placement. Failure to fulfill orders repeatedly results in permanent account deactivation.`,
    },
    {
      id: 'liability',
      title: '6. Limitation of Liability & Force Majeure',
      content: `Egbay provides its marketplace platform on an "as-is" and "as-available" basis. While we enforce escrow safeguards and seller verification, Egbay shall not be liable for indirect, incidental, or consequential damages resulting from unauthorized user conduct or off-platform transactions. All transactions conducted outside Egbay's escrow checkout forfeit all platform buyer and seller protections.`,
    },
  ];

  const arSections = [
    {
      id: 'acceptance',
      title: '١. طبيعة المنصة والموافقة على الشروط',
      content: `مرحباً بكم في منصة إيجباي (egbay.shop). بالوصول إلى الموقع أو تسجيل حساب أو إتمام عمليات شراء وبيع، فإنك توافق على الالتزام الكامل بهذه الشروط والأحكام الخاضعة لقوانين جمهورية مصر العربية (قانون حماية المستهلك رقم ١٨١ لسنة ٢٠١٨ والقانون المدني).

تعمل إيجباي كمنصة تكنولوجية وسيطة لربط البائعين والمشترين، وتوفير نظام الضمان المالي (Escrow)، والوساطة في النزاعات. إيجباي ليست مُصنّعاً أو مالكاً للمنتجات المعروضة من البائعين المستقلين.`,
    },
    {
      id: 'escrow',
      title: '٢. نظام الضمان المالي وآليات صرف الأرباح',
      content: `جميع المعاملات التي تتم عبر نظام الدفع في إيجباي تستخدم نظام الضمان المالي الإلزامي:

أ. حجز أموال المشتري:
عند قيام المشتري بالطلب، يتم تجميد المبلغ في حساب ضمان آمن ومحايد وإخطار البائع لتجهيز وشحن السلعة.

ب. التحقق عند التسليم (شحن أو تسليم يدوي):
• التوصيل عبر الشحن: يقوم البائع بترتيب الشحن عبر شركة الشحن التي يختارها. عند استلام الطلب، يتحقق المشتري من مطابقة السلعة للوصف والصور ثم يؤكد الاستلام لتحرير المبلغ.
• التسليم اليدوي: يعاين المشتري السلعة بنفسه، وعند الرضا التام يسلّم كود الـ PIN المكون من ٦ أرقام للبائع لتحرير المبلغ.

ج. تحويل مستحقات البائع:
بمجرد إدخال كود الـ PIN (تسليم يدوي) أو تأكيد المشتري للاستلام (شحن)، يتم تحويل صافي أرباح البائع مباشرة عبر:
• إنستاباي (InstaPay IPA)
• فودافون كاش والمحافظ الذكية — في نفس اليوم
• الحساب البنكي (IBAN) — خلال يوم إلى يومي عمل

د. هيكل العمولات:
تخصم إيجباي عمولة منصة شفافة (بين ١.٥٪ و٣.٥٪ حسب مستوى البائع) تُقتطع تلقائياً من إجمالي مبلغ البيع، بالإضافة إلى رسوم معالجة الدفع بالبطاقة (٢.٧٥٪ + ٣ جنيه) للطلبات المدفوعة بالبطاقة فقط -- الدفع من رصيد المحفظة بدون أي رسوم معالجة. لا توجد أي رسوم خفية أخرى.`,
    },
    {
      id: 'disputes',
      title: '٣. حماية المشتري وحل النزاعات',
      content: `أ. فتح نزاع رسمي:
قبل تأكيد الاستلام أو تحرير المبلغ، يحق للمشتري فحص السلعة المستلمة. إذا كانت مقلدة، تالفة، أو غير مطابقة للوصف، يمكنه فتح نزاع من صفحة الطلب مع توضيح كتابي للمشكلة. بمجرد تأكيد المشتري للاستلام (شحن) أو تحرير المبلغ بكود الـ PIN (تسليم يدوي)، تصبح العملية نهائية ولا يمكن فتح نزاع بعدها.

ب. إجراءات الفصل والاسترداد:
• تظل أموال الضمان مجمدة طوال فترة مراجعة النزاع.
• يراجع فريق إيجباي رواية كل من المشتري والبائع ويفصل في النزاع مباشرة.
• في حال الفصل لصالح المشتري، يُرد المبلغ المحجوز إلى رصيد محفظة المشتري في إيجباي. وفي حال الفصل لصالح البائع، يُحرر المبلغ للبائع كالمعتاد.`,
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
      content: `تقدم إيجباي خدماتها وفق معايير الأمان التكنولوجي والضمان المالي. لا تتحمل المنصة مسؤولية أي تعاملات مالية أو اتفاقات تتم خارج نظام الضمان المالي الرسمي للموقع. المعاملات الخارجية تفقد كافة حقوق الحماية والتعويض.`,
    },
  ];

  // Current classifieds terms. The payment-era text above remains available
  // only if checkout is deliberately re-enabled and its legal copy is reviewed.
  const currentEnSections = [
    { id: 'role', title: '1. What Egbay Provides', content: `Egbay lets people post listings, browse items, message one another and make offers. Sellers are responsible for their listings and the items they offer. Egbay does not own the listed items.\n\nOnline checkout, escrow, wallet top-ups and new payouts are currently unavailable. A price offer in chat is a proposal between users; it does not create a payment or an order through Egbay.` },
    { id: 'handover', title: '2. Price, Payment and Handover', content: `Buyers and sellers agree the final price, payment method and handover directly with one another. Any payment takes place outside Egbay. Egbay does not hold funds, arrange delivery, or guarantee an off-platform transaction. Meet in a public place where possible and inspect the item before paying.\n\nExisting orders and wallet records from earlier Egbay checkout activity remain subject to their recorded status. Contact info@egbay.shop about an existing order or balance.` },
    { id: 'listings', title: '3. Listings and Seller Responsibilities', content: `Sellers must describe the item accurately, including its condition, defects, price, availability and what is included. A listing marked “sourced to order” means the seller does not have that unit in hand; the stated lead time is an estimate to discuss before agreeing to a purchase. Do not post stolen, counterfeit, unsafe or unlawful items.` },
    { id: 'safety', title: '4. Reports and Account Safety', content: `You can report a listing, message or user, block another user, and request account deletion from Settings. Egbay may remove content or restrict accounts that violate these terms. If a transaction or safety concern needs help, contact info@egbay.shop with the relevant listing or conversation details.` },
    { id: 'contact', title: '5. Contact', content: `Questions about these terms, existing orders or your account can be sent to info@egbay.shop.` },
  ];
  const currentArSections = [
    { id: 'role', title: '١. خدمات إيجباي', content: `تتيح إيجباي نشر الإعلانات وتصفح السلع والمراسلة وتقديم عروض الأسعار. البائع مسؤول عن إعلانه والسلعة التي يعرضها، ولا تملك إيجباي السلع المعروضة.\n\nالدفع عبر الموقع والضمان المالي وشحن المحفظة وصرف أرباح جديدة غير متاحين حالياً. عرض السعر في المحادثة هو اقتراح بين المستخدمين، ولا ينشئ عملية دفع أو طلباً عبر إيجباي.` },
    { id: 'handover', title: '٢. السعر والدفع والتسليم', content: `يتفق المشتري والبائع مباشرة على السعر النهائي وطريقة الدفع والتسليم. أي دفع يتم خارج إيجباي. لا تحتفظ إيجباي بالأموال ولا ترتب التوصيل ولا تضمن التعاملات الخارجية. يُفضّل اللقاء في مكان عام وفحص السلعة قبل الدفع.\n\nتظل سجلات الطلبات والمحافظ الناتجة عن عمليات دفع سابقة على إيجباي مرتبطة بحالتها المسجلة. للاستفسار عن طلب أو رصيد سابق، راسل info@egbay.shop.` },
    { id: 'listings', title: '٣. الإعلانات والتزامات البائع', content: `يجب على البائع وصف السلعة بدقة، بما في ذلك حالتها وعيوبها وسعرها وتوفرها ومحتوياتها. عبارة «يُجلب عند الطلب» تعني أن الوحدة ليست لدى البائع حالياً؛ ومدة التوريد المذكورة تقديرية ويجب مناقشتها قبل الاتفاق. يُحظر عرض السلع المسروقة أو المقلدة أو الخطرة أو غير القانونية.` },
    { id: 'safety', title: '٤. البلاغات وأمان الحساب', content: `يمكنك الإبلاغ عن إعلان أو رسالة أو مستخدم، وحظر مستخدم آخر، وطلب حذف الحساب من الإعدادات. قد تزيل إيجباي المحتوى أو تقيّد الحسابات المخالفة لهذه الشروط. للمساعدة بشأن تعامل أو مشكلة أمان، راسل info@egbay.shop مع تفاصيل الإعلان أو المحادثة.` },
    { id: 'contact', title: '٥. التواصل', content: `للاستفسار عن هذه الشروط أو الطلبات السابقة أو حسابك، راسل info@egbay.shop.` },
  ];

  const sections = PAYMENTS_ENABLED ? (isRTL ? arSections : enSections) : (isRTL ? currentArSections : currentEnSections);

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-12">
      {/* Header */}
      <div className="text-center mb-10">
        <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center mx-auto mb-4 border border-blue-100 shadow-sm">
          <Scale className="w-7 h-7" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight mb-2">
          {isRTL ? 'شروط وأحكام الاستخدام' : 'Terms of Service'}
        </h1>
        <p className="text-xs sm:text-sm text-gray-500 max-w-xl mx-auto mb-6">
          {isRTL
            ? 'القواعد الحاكمة لمنصة إيجباي، التزامات البائعين وحقوق المشترين وفقاً للقانون المصري.'
            : 'Governing rules for Egbay, seller obligations, and buyer rights under Egyptian Law.'}
        </p>
      </div>

      {/* Trust Highlights Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-4 flex items-center gap-3">
          <ShieldCheck className="w-6 h-6 text-emerald-600 flex-shrink-0" />
          <div>
            <h4 className="text-xs font-bold text-gray-900">
              {isRTL ? 'قواعد واضحة' : 'Clear Marketplace Rules'}
            </h4>
            <p className="text-[11px] text-gray-500">
              {isRTL ? 'الإعلانات والتعامل المباشر والبلاغات' : 'Listings, direct transactions and reports'}
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
              {isRTL ? 'تخضع للقانون المصري' : 'Governed by Egyptian law'}
            </p>
          </div>
        </div>

        <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-4 flex items-center gap-3">
          <AlertOctagon className="w-6 h-6 text-amber-600 flex-shrink-0" />
          <div>
            <h4 className="text-xs font-bold text-gray-900">
              {isRTL ? 'منع السلع المقلدة' : 'Counterfeit Items Prohibited'}
            </h4>
            <p className="text-[11px] text-gray-500">
              {isRTL ? 'السلع المسروقة أو المقلدة أو غير القانونية محظورة' : 'Stolen, counterfeit and unlawful items are prohibited'}
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
            {isRTL ? 'هل تحتاج مساعدة؟' : 'Need help?'}
          </h3>
          <p className="text-gray-600 text-xs sm:text-sm mb-4 leading-relaxed">
            {isRTL
              ? 'للاستفسار عن الشروط أو طلب سابق أو مشكلة في الحساب، راسلنا:'
              : 'For questions about these terms, an earlier order or your account, contact us:'}
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
