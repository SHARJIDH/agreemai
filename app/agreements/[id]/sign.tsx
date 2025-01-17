'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface Signature {
  id: string;
  signerEmail: string;
  signerName: string;
  status: string;
  signedAt: string | null;
}

interface SignProps {
  agreementId: string;
  onSigningComplete?: () => void;
}

export default function Sign({ agreementId, onSigningComplete }: SignProps) {
  const [signerEmail, setSignerEmail] = useState('');
  const [signerName, setSignerName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signatures, setSignatures] = useState<Signature[]>([]);

  useEffect(() => {
    let eventSource: EventSource;

    const connectSSE = () => {
      eventSource = new EventSource(`/api/agreements/${agreementId}/status`);

      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        setSignatures(data.signatures);
      };

      eventSource.onerror = () => {
        eventSource.close();
        // Retry connection after 5 seconds
        setTimeout(connectSSE, 5000);
      };
    };

    connectSSE();

    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [agreementId]);

  const handleSign = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/agreements/${agreementId}/sign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          signerEmail,
          signerName,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create signing request');
      }

      const { redirectUrl } = await response.json();
      
      // Redirect to DocuSign
      window.location.href = redirectUrl;
      
      if (onSigningComplete) {
        onSigningComplete();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <form onSubmit={handleSign} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="signerEmail">Signer Email</Label>
            <Input
              id="signerEmail"
              type="email"
              value={signerEmail}
              onChange={(e) => setSignerEmail(e.target.value)}
              placeholder="Enter signer's email"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="signerName">Signer Name</Label>
            <Input
              id="signerName"
              type="text"
              value={signerName}
              onChange={(e) => setSignerName(e.target.value)}
              placeholder="Enter signer's name"
              required
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button type="submit" disabled={loading}>
            {loading ? 'Sending...' : 'Send for Signature'}
          </Button>
        </form>
      </Card>

      {signatures.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Signature Status</h3>
          <div className="grid gap-4">
            {signatures.map((signature) => (
              <Card key={signature.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{signature.signerName}</p>
                    <p className="text-sm text-gray-500">{signature.signerEmail}</p>
                  </div>
                  <Badge variant={
                    signature.status === 'completed' ? 'success' :
                    signature.status === 'declined' ? 'destructive' :
                    'default'
                  }>
                    {signature.status}
                  </Badge>
                </div>
                {signature.signedAt && (
                  <p className="text-sm text-gray-500 mt-2">
                    Signed at: {new Date(signature.signedAt).toLocaleString()}
                  </p>
                )}
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
