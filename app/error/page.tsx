export default function ErrorPage({
  searchParams,
}: {
  searchParams: { message?: string };
}) {
  const message = searchParams?.message || 'An error occurred';

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="max-w-xl w-full bg-white shadow-lg rounded-lg p-8">
        <h1 className="text-2xl font-bold text-red-600 mb-4">Error</h1>
        <p className="text-gray-700">{message}</p>
        <a
          href="/"
          className="mt-6 inline-block bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Return Home
        </a>
      </div>
    </div>
  );
}
