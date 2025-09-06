export default function Custom500() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="text-center">
        <h1 className="mb-4 text-6xl font-bold">500</h1>
        <h2 className="mb-4 text-2xl font-semibold">Internal Server Error</h2>
        <p className="mb-6 text-gray-600 dark:text-gray-400">
          Something went wrong on our servers. Please try again later.
        </p>
        <a 
          href="/dashboard"
          className="inline-block px-6 py-3 bg-primary text-white rounded-md hover:bg-primary/90"
        >
          Go to Dashboard
        </a>
      </div>
    </div>
  )
}