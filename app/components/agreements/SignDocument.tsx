'use client';

import { useState } from 'react';

interface SignDocumentProps {
  documentId: string;
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

export function SignDocument({ documentId, onSuccess, onError }: SignDocumentProps) {
  const [loading, setLoading] = useState(false);

  const handleSignRequest = async () => {
    setLoading(true);
    try {
      // First, initiate OAuth flow
      const authResponse = await fetch('/api/docusign');
      const { authUrl, error } = await authResponse.json();

      if (error) {
        throw new Error(error);
      }

      if (authUrl) {
        // Redirect to DocuSign OAuth page
        window.location.href = authUrl;
        return;
      }

      // If we're already authenticated, proceed with signing
      const docResponse = await fetch(`/api/agreements/${documentId}/document`);
      const { documentBase64, documentName } = await docResponse.json();

      const response = await fetch('/api/docusign', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          documentBase64,
          documentName,
          signerEmail: 'user@example.com', // You'll want to get this from your user context
          signerName: 'John Doe', // You'll want to get this from your user context
        }),
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to send document for signature');
      }

      onSuccess?.();
    } catch (error) {
      console.error('Error sending document for signature:', error);
      onError?.(error instanceof Error ? error.message : 'Failed to send document for signature');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleSignRequest}
      disabled={loading}
      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
    >
      {loading ? 'Sending...' : 'Sign with DocuSign'}
    </button>
  );
}
