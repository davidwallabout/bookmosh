import React from 'react'

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-midnight px-4 py-12">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Privacy Policy</h1>
          <p className="text-white/60">Last updated: January 7, 2026</p>
        </div>

        <div className="space-y-8 text-white/80">
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">Introduction</h2>
            <p>
              BookMosh ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our mobile application and website (collectively, the "Service").
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">Information We Collect</h2>
            
            <h3 className="text-xl font-semibold text-white mb-3 mt-6">Personal Information</h3>
            <p className="mb-3">When you create an account, we collect:</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Email address</li>
              <li>Username</li>
              <li>Password (encrypted)</li>
              <li>Profile information (optional profile picture, bio)</li>
            </ul>

            <h3 className="text-xl font-semibold text-white mb-3 mt-6">Usage Information</h3>
            <p className="mb-3">We collect information about how you use the Service:</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Books you add to your library</li>
              <li>Reading status and progress</li>
              <li>Reviews and ratings you create</li>
              <li>Messages sent in book discussions (Pits)</li>
              <li>Friend connections and interactions</li>
              <li>Book recommendations you send and receive</li>
            </ul>

            <h3 className="text-xl font-semibold text-white mb-3 mt-6">Device Information</h3>
            <p className="mb-3">We may collect:</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Device type and operating system</li>
              <li>IP address</li>
              <li>Browser type</li>
              <li>App version</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">How We Use Your Information</h2>
            <p className="mb-3">We use your information to:</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Provide, maintain, and improve the Service</li>
              <li>Create and manage your account</li>
              <li>Enable social features (friend connections, book discussions, recommendations)</li>
              <li>Send you notifications about friend requests, messages, and recommendations</li>
              <li>Respond to your comments, questions, and requests</li>
              <li>Detect, prevent, and address technical issues and security threats</li>
              <li>Analyze usage patterns to improve user experience</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">Information Sharing and Disclosure</h2>
            
            <h3 className="text-xl font-semibold text-white mb-3 mt-6">With Other Users</h3>
            <p className="mb-3">
              Your profile information, book library, reviews, and activity may be visible to other users based on your privacy settings. You can control your profile visibility in your account settings.
            </p>

            <h3 className="text-xl font-semibold text-white mb-3 mt-6">With Service Providers</h3>
            <p className="mb-3">We share information with third-party service providers who help us operate the Service:</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li><strong>Supabase</strong> - Database and authentication services</li>
              <li><strong>Resend</strong> - Email delivery services</li>
              <li><strong>Vercel</strong> - Web hosting</li>
              <li><strong>Open Library API</strong> - Book metadata and cover images</li>
            </ul>

            <h3 className="text-xl font-semibold text-white mb-3 mt-6">Legal Requirements</h3>
            <p>
              We may disclose your information if required by law or in response to valid requests by public authorities.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">Data Security</h2>
            <p>
              We implement appropriate technical and organizational measures to protect your personal information. However, no method of transmission over the Internet or electronic storage is 100% secure. While we strive to protect your information, we cannot guarantee absolute security.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">Your Rights and Choices</h2>
            <p className="mb-3">You have the right to:</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li><strong>Access</strong> - Request a copy of your personal information</li>
              <li><strong>Correction</strong> - Update or correct your information through your account settings</li>
              <li><strong>Deletion</strong> - Request deletion of your account and associated data</li>
              <li><strong>Privacy Settings</strong> - Control who can see your profile and activity</li>
              <li><strong>Email Preferences</strong> - Opt out of promotional emails (transactional emails may still be sent)</li>
            </ul>
            <p className="mt-4">
              To exercise these rights, contact us at <a href="mailto:privacy@bookmosh.com" className="text-aurora hover:underline">privacy@bookmosh.com</a>
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">Children's Privacy</h2>
            <p>
              BookMosh is not intended for children under 13 years of age. We do not knowingly collect personal information from children under 13. If you believe we have collected information from a child under 13, please contact us immediately.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">International Data Transfers</h2>
            <p>
              Your information may be transferred to and processed in countries other than your country of residence. These countries may have data protection laws different from your country. By using the Service, you consent to such transfers.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">Changes to This Privacy Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last updated" date. You are advised to review this Privacy Policy periodically for any changes.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">Contact Us</h2>
            <p className="mb-3">If you have questions about this Privacy Policy, please contact us:</p>
            <ul className="space-y-2">
              <li>Email: <a href="mailto:privacy@bookmosh.com" className="text-aurora hover:underline">privacy@bookmosh.com</a></li>
              <li>Email: <a href="mailto:support@bookmosh.com" className="text-aurora hover:underline">support@bookmosh.com</a></li>
            </ul>
          </section>

          <section className="border-t border-white/10 pt-8 mt-8">
            <h2 className="text-2xl font-semibold text-white mb-4">California Privacy Rights</h2>
            <p className="mb-3">
              If you are a California resident, you have additional rights under the California Consumer Privacy Act (CCPA):
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Right to know what personal information is collected, used, shared, or sold</li>
              <li>Right to delete personal information</li>
              <li>Right to opt-out of the sale of personal information (we do not sell your information)</li>
              <li>Right to non-discrimination for exercising your privacy rights</li>
            </ul>
          </section>

          <section className="border-t border-white/10 pt-8 mt-8">
            <h2 className="text-2xl font-semibold text-white mb-4">European Privacy Rights (GDPR)</h2>
            <p className="mb-3">
              If you are in the European Economic Area (EEA), you have rights under the General Data Protection Regulation (GDPR):
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Right to access your personal data</li>
              <li>Right to rectification of inaccurate data</li>
              <li>Right to erasure ("right to be forgotten")</li>
              <li>Right to restrict processing</li>
              <li>Right to data portability</li>
              <li>Right to object to processing</li>
              <li>Right to withdraw consent</li>
            </ul>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-white/10">
          <a href="/" className="text-aurora hover:underline">← Back to BookMosh</a>
        </div>
      </div>
    </div>
  )
}
