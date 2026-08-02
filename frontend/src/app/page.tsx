export default function Home() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Media Basket",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    description:
      "Media Basket is a social media management platform that connects your YouTube, Reddit, WhatsApp, and other media accounts in one place. It lets you sync, moderate, and manage content and conversations from a single dashboard.",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: "4.8",
      ratingCount: "52",
    },
  };

  return (
    <main className="min-h-screen bg-gray-900 text-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="max-w-4xl mx-auto px-6 py-16 sm:py-24 text-center">
        <h1 className="text-4xl sm:text-6xl font-extrabold mb-4 text-white">
          Media Basket
        </h1>
        <p className="text-lg sm:text-2xl text-gray-300 mb-8">
          All your media accounts in one basket
        </p>
        <p className="text-base sm:text-lg text-gray-400 max-w-2xl mx-auto mb-10">
          Media Basket is a social media management platform that brings your
          YouTube, Reddit, WhatsApp, and other media accounts together in one
          place. Sync your content, moderate conversations, and manage all your
          channels from a single dashboard.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <a
            href="/login"
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-center"
          >
            Get Started
          </a>
          <a
            href="/dashboard"
            className="px-6 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition text-center"
          >
            Dashboard
          </a>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 pb-20">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="bg-gray-800 rounded-xl p-6 text-center">
            <h2 className="text-xl font-semibold text-white mb-2">
              Connect Accounts
            </h2>
            <p className="text-gray-400 text-sm">
              Link YouTube, Facebook, Instagram, TikTok, WhatsApp, Reddit, and
              other social media accounts securely with OAuth.
            </p>
          </div>
          <div className="bg-gray-800 rounded-xl p-6 text-center">
            <h2 className="text-xl font-semibold text-white mb-2">
              Sync Content
            </h2>
            <p className="text-gray-400 text-sm">
              Automatically sync content, comments, and conversations from all
              your channels into one unified content tree.
            </p>
          </div>
          <div className="bg-gray-800 rounded-xl p-6 text-center">
            <h2 className="text-xl font-semibold text-white mb-2">
              Moderate & Manage
            </h2>
            <p className="text-gray-400 text-sm">
              Moderate conversations, reply to comments, and manage your media
              from a single unified dashboard.
            </p>
          </div>
        </div>

        <div className="mt-16 grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="bg-gray-800 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-2">Unified Inbox</h2>
            <p className="text-gray-400 text-sm">
              Every comment and message from every connected platform lands in
              one inbox, so nothing slips through.
            </p>
          </div>
          <div className="bg-gray-800 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-2">Team Collaboration</h2>
            <p className="text-gray-400 text-sm">
              Invite team members, assign tasks, set up approval workflows, and
              moderate together with full audit logs.
            </p>
          </div>
          <div className="bg-gray-800 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-2">Analytics & Insights</h2>
            <p className="text-gray-400 text-sm">
              Track engagement, sentiment, and performance across all channels
              with built-in analytics and ROI tracking.
            </p>
          </div>
          <div className="bg-gray-800 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-2">Enterprise-Grade Security</h2>
            <p className="text-gray-400 text-sm">
              OAuth-based connections, encrypted credential vault, and granular
              role-based access control protect your accounts.
            </p>
          </div>
        </div>
      </div>

      <footer className="border-t border-gray-800">
        <div className="max-w-5xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-gray-500">
            © 2026 Media Basket. All rights reserved.
          </p>
          <nav className="flex gap-6">
            <a href="/privacy" className="text-sm text-gray-400 hover:text-white underline">
              Privacy Policy
            </a>
            <a href="/terms" className="text-sm text-gray-400 hover:text-white underline">
              Terms of Service
            </a>
          </nav>
        </div>
      </footer>
    </main>
  );
}
