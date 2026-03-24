'use client';
import { useState } from 'react';

export default function ProveItApp() {
  const [statement, setStatement] = useState("");
  const [proof, setProof] = useState("");

  // This will eventually call your Python Flask API
  const handleVerify = async () => {
    // Example: fetch('/api/verify', { method: 'POST', body: JSON.stringify({ statement, proof }) })
    console.log("Verifying...", { statement, proof });
  };

  return (
    <div className="flex h-screen bg-white">
      {/* Left Column: Input Areas */}
      <div className="w-2/3 p-8 border-r">
        <h1 className="text-2xl font-bold mb-4">Statement to Prove</h1>
        <textarea 
          className="w-full h-32 p-4 border rounded shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Enter the mathematical statement you want to prove..."
          value={statement}
          onChange={(e) => setStatement(e.target.value)}
        />

        <h2 className="text-2xl font-bold mt-8 mb-4">Proof</h2>
        <textarea 
          className="w-full h-64 p-4 border rounded shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Enter your proof here..."
          value={proof}
          onChange={(e) => setProof(e.target.value)}
        />
        
        <button 
          onClick={handleVerify}
          className="mt-4 px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Check Proof
        </button>
      </div>

      {/* Right Column: Definitions & Errors */}
      <div className="w-1/3 bg-[#1e2330] text-white flex flex-col">
        <div className="flex-1 p-6 border-b border-gray-600">
          <h3 className="text-lg font-semibold mb-2">Relevant Definitions & Theorems</h3>
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
             <p>No Statement Yet</p>
          </div>
        </div>
        <div className="flex-1 p-6">
          <h3 className="text-lg font-semibold mb-2 text-red-400">Errors Detected</h3>
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
             <p>No Proof Yet</p>
          </div>
        </div>
      </div>
    </div>
  );
}