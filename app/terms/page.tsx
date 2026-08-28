import type { Metadata } from 'next';
import { FileText, Scale } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'EgyBay terms of service — rules and conditions for using the marketplace.',
};

export default function TermsPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-100 rounded-2xl mb-4">
          <Scale className="w-7 h-7 text-blue-600" />
        </div>
        <h1 className="text-3xl font-black text-gray-900 mb-2">Terms of Service</h1>
        <p className="text-gray-500 text-sm">Last updated: August 2026 · شروط الخدمة</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50">
        {[
          {
            num: '1', title: 'Acceptance of Terms',
            content: 'By creating an account or using EgyBay, you agree to be bound by these Terms of Service. EgyBay is a peer-to-peer marketplace for buying and selling second-hand and new items in Egypt. If you do not agree with these terms, please discontinue use of the service.',
          },
          {
            num: '2', title: 'User Responsibilities',
            content: `As an EgyBay user, you agree to:
• Provide accurate, truthful information in listings and your profile.
• Not sell counterfeit, illegal, or prohibited items.
• Communicate respectfully with other users.
• Honor transactions once a buyer confirms and escrow is initiated.
• Not circumvent the escrow system or conduct transactions outside EgyBay to avoid fees.`,
          },
          {
            num: '3', title: 'Escrow & Payments',
            content: `EgyBay uses a built-in escrow system to protect buyers and sellers:
• Buyer funds are held securely until the buyer confirms receipt of the item in acceptable condition.
• If an item is not received or significantly misrepresented, the buyer can file a dispute and receive a full refund.
• Platform commission fees (typically 5%) are deducted from the seller's earnings upon successful transaction completion.
• Payouts to sellers are processed via Vodafone Cash, InstaPay, or bank transfer within 3-7 business days.`,
          },
          {
            num: '4', title: 'Prohibited Content',
            content: `The following are strictly prohibited on EgyBay:
• Counterfeit, forged, or stolen goods.
• Weapons, ammunition, or dangerous materials.
• Drugs, pharmaceuticals, or controlled substances without proper licensing.
• Adult content or services.
• Items subject to legal trade restrictions in Egypt.
Violations may result in immediate account suspension and legal referral.`,
          },
          {
            num: '5', title: 'Account Termination',
            content: 'EgyBay reserves the right to suspend or permanently delete accounts that violate these terms, engage in fraudulent activity, or harm other users or the platform. Users may also delete their own accounts at any time from the profile settings page.',
          },
          {
            num: '6', title: 'Limitation of Liability',
            content: 'EgyBay acts as a marketplace platform and is not responsible for the quality, safety, legality, or accuracy of items listed by sellers. While we provide escrow protection and dispute resolution tools, EgyBay is not liable for losses arising from user misconduct, item defects, or shipping delays beyond our control.',
          },
          {
            num: '7', title: 'Changes to Terms',
            content: 'EgyBay reserves the right to modify these terms at any time. Significant changes will be communicated via email or in-app notifications. Continued use of EgyBay after changes constitutes acceptance of the revised terms.',
          },
        ].map((section) => (
          <div key={section.num} className="p-6 sm:p-8">
            <h2 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 text-xs font-black flex items-center justify-center flex-shrink-0">
                {section.num}
              </span>
              {section.title}
            </h2>
            <p className="text-gray-600 text-sm leading-relaxed whitespace-pre-line">{section.content}</p>
          </div>
        ))}

        <div className="p-6 sm:p-8 bg-gray-50 rounded-b-2xl">
          <p className="text-sm text-gray-500">
            For questions about these terms, contact us at{' '}
            <a href="mailto:support@egbay.market" className="text-blue-600 hover:underline font-semibold">
              support@egbay.market
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
