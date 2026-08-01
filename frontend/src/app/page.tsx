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
              Link YouTube, Reddit, WhatsApp, and other social media accounts
              securely with OAuth.
            </p>
          </div>
          <div className="bg-gray-800 rounded-xl p-6 text-center">
            <h2 className="text-xl font-semibold text-white mb-2">
              Sync Content
            </h2>
            <p className="text-gray-400 text-sm">
              Automatically sync content, comments, and conversations from all
              your channels.
            </p>
          </div>
          <div className="bg-gray-800 rounded-xl p-6 text-center">
            <h2 className="text-xl font-semibold text-white mb-2">
              Moderate & Manage
            </h2>
            <p className="text-gray-400 text-sm">
              Moderate conversations and manage your media from a single unified
              dashboard.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
