export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold mb-8">Privacy Policy</h1>
        
        <div className="space-y-6 text-gray-300">
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">1. Information We Collect</h2>
            <p>
              Media Basket collects information you provide directly, including:
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Account information (email, name)</li>
              <li>Social media account connections (YouTube, Reddit, WhatsApp)</li>
              <li>Content you manage through our platform</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">2. How We Use Your Information</h2>
            <p>
              We use your information to provide, maintain, and improve our services, including:
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Syncing content from your connected social media accounts</li>
              <li>Providing moderation and management tools</li>
              <li>Sending notifications about your content</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">3. Data Sharing</h2>
            <p>
              We do not sell or share your personal information with third parties except as necessary to provide our services or as required by law.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">4. Data Security</h2>
            <p>
              We implement appropriate security measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">5. Your Rights</h2>
            <p>
              You can access, update, or delete your information at any time through your account settings. You can also disconnect your social media accounts.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">6. Contact Us</h2>
            <p>
              If you have questions about this Privacy Policy, please contact us at: softlab.hub@gmail.com
            </p>
          </section>
        </div>

        <div className="mt-12 pt-6 border-t border-gray-700 text-sm text-gray-500">
          <p>Last updated: July 30, 2026</p>
        </div>
      </div>
    </div>
  );
}
