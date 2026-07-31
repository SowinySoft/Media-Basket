export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-12 sm:p-24">
      <h1 className="text-3xl sm:text-4xl font-bold mb-4 text-white text-center">
        Media Basket
      </h1>
      <p className="text-lg sm:text-xl text-gray-400 text-center">
        All your media accounts in one basket
      </p>
      <div className="mt-8 flex flex-col sm:flex-row gap-4">
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
    </main>
  );
}
