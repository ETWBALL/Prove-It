// apps/web/app/page.tsx
import Link from 'next/link';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold mb-8">Prove-It Dev Environment</h1>
      
      {/* Adds a button linking to your HTML file */}
      <Link 
        href="/api_sandbox.html" 
        className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition"
      >
        Open API Sandbox
      </Link>

      {/* Optional: If you want to EMBED the HTML file directly on the page instead of linking to it, uncomment this iframe: */}
      {/* <div className="mt-12 w-full max-w-5xl h-[600px] border-2 border-gray-300 rounded-lg overflow-hidden">
        <iframe src="/api_sandbox.html" className="w-full h-full" />
      </div> 
      */}
    </main>
  );
}