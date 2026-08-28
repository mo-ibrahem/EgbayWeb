import type { Metadata } from 'next';
import { Shield, Mail } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'EgyBay privacy policy — how we collect, use, and protect your personal data.',
};

export default function PrivacyPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center w-14 h-14 bg-emerald-100 rounded-2xl mb-4">
          <Shield className="w-7 h-7 text-emerald-600" />
        </div>
        <h1 className="text-3xl font-black text-gray-900 mb-2">Privacy Policy</h1>
        <p className="text-gray-500 text-sm">Last updated: August 2026 · سياسة الخصوصية</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50">
        {[
          {
            num: '1',
            title: 'Information We Collect',
            content: `To provide a safe, secure, and reliable marketplace experience, we collect the following data:
• Contact Information: Full name, email address, phone number, and physical shipping address (for delivery and courier fulfillment).
• Authentication & Identifiers: Account credentials managed securely via Supabase Auth, and a unique User ID.
• Financial & Transaction Information: Purchase history, escrow status, and payout records. Payment card details are processed securely by certified payment gateways (Paymob) and are never stored on our servers.
• User Content: Photos of items listed for sale and in-app chat messages between buyers and sellers.
• Identity Verification (Optional – Verified Sellers): Identification documents required strictly for seller fraud prevention.`,
          },
          {
            num: '2',
            title: 'How We Use Your Information',
            content: `We use collected information solely for the following purposes:
• Enabling secure sign-in and account management.
• Processing product listings, buyer-seller communications, and order deliveries.
• Managing escrow payments and seller earnings payouts.
• Preventing fraud, spam, and ensuring platform trust and safety.
• Communicating service updates and important account notifications.`,
          },
          {
            num: '3',
            title: 'Third-Party Data Sharing',
            content: `We do not sell, rent, or trade your personal data with advertisers or data brokers. Data is shared exclusively with certified service providers essential for app operations:
• Payment Processing (Paymob): For processing electronic card transactions securely, compliant with Egyptian Central Bank standards.
• Courier & Logistics (Bosta): Delivery address and phone number provided solely to fulfill package delivery.
• Cloud Infrastructure (Supabase): Secure database and authentication hosting with 256-bit encryption.`,
          },
          {
            num: '4',
            title: 'User Rights & Account Deletion',
            content: `In full compliance with Apple App Store Guidelines and global privacy laws (GDPR):
• You have the right to access, update, or permanently delete your account and all associated personal data at any time.
• Account Deletion: You can delete your account instantly inside the app by going to Profile → Delete Account, or by emailing us at privacy@egbay.market.
• Data Portability: You may request an export of your personal data at any time.`,
          },
          {
            num: '5',
            title: 'Security Standards',
            content: `We use industry-leading security measures to protect your data:
• All data transmission uses SSL/TLS 256-bit encryption.
• Authentication is managed via Supabase Auth with Row Level Security (RLS) enabled on all database tables.
• Financial transactions are processed through PCI DSS–compliant payment gateways.
• We conduct regular security audits and vulnerability assessments.`,
          },
          {
            num: '6',
            title: 'Cookies & Local Storage',
            content: `EgyBay uses browser local storage and session cookies exclusively to maintain your login session and preferences (such as your chosen language). We do not use tracking cookies or third-party advertising cookies. You can clear your browser storage at any time to log out and remove all locally stored preferences.`,
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

        {/* Contact */}
        <div className="p-6 sm:p-8 bg-blue-50 rounded-b-2xl">
          <h2 className="text-lg font-bold text-gray-900 mb-2 flex items-center gap-2">
            <Mail className="w-5 h-5 text-blue-600" />
            Contact Us
          </h2>
          <p className="text-gray-600 text-sm">
            For any privacy questions, data requests, or account deletion, contact us at:
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            <a href="mailto:privacy@egbay.market" className="bg-blue-600 text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-blue-700 transition-colors">
              privacy@egbay.market
            </a>
            <a href="mailto:support@egbay.market" className="bg-white text-blue-600 border border-blue-200 text-sm font-semibold px-4 py-2 rounded-xl hover:bg-blue-50 transition-colors">
              support@egbay.market
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
