'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

interface Risk {
  type: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
}

interface KeyTerms {
  paymentTerms?: string;
  renewalConditions?: string;
  terminationClauses?: string;
  confidentialityTerms?: string;
  [key: string]: string | undefined;
}

interface Analysis {
  summary: string;
  keyTerms: KeyTerms;
  risks: Risk[];
  category: string;
  confidenceScore: number;
}

export default function AgreementAnalysis({ agreementId }: { agreementId: string }) {
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyzeAgreement = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/agreements/${agreementId}/analyze`, {
        method: 'POST'
      });

      if (!response.ok) {
        throw new Error('Failed to analyze agreement');
      }

      const data = await response.json();
      setAnalysis(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'low':
        return 'bg-green-100 text-green-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'high':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {!analysis && (
        <Button onClick={analyzeAgreement} disabled={loading}>
          {loading ? 'Analyzing...' : 'Analyze Agreement'}
        </Button>
      )}

      {loading && (
        <div className="space-y-4">
          <Skeleton className="h-4 w-[250px]" />
          <Skeleton className="h-4 w-[200px]" />
          <Skeleton className="h-4 w-[300px]" />
        </div>
      )}

      {analysis && (
        <div className="space-y-6">
          {/* Summary */}
          <Card className="p-6">
            <h3 className="text-lg font-medium mb-2">Summary</h3>
            <p className="text-gray-600">{analysis.summary}</p>
          </Card>

          {/* Key Terms */}
          <Card className="p-6">
            <h3 className="text-lg font-medium mb-4">Key Terms</h3>
            <div className="space-y-4">
              {Object.entries(analysis.keyTerms).map(([key, value]) => (
                <div key={key}>
                  <h4 className="font-medium text-gray-700 capitalize">
                    {key.replace(/([A-Z])/g, ' $1').trim()}
                  </h4>
                  <p className="text-gray-600">{value}</p>
                </div>
              ))}
            </div>
          </Card>

          {/* Risks */}
          <Card className="p-6">
            <h3 className="text-lg font-medium mb-4">Potential Risks</h3>
            <div className="space-y-4">
              {analysis.risks.map((risk, index) => (
                <div key={index} className="border-b pb-4 last:border-b-0 last:pb-0">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-gray-700">{risk.type}</h4>
                    <Badge className={getSeverityColor(risk.severity)}>
                      {risk.severity}
                    </Badge>
                  </div>
                  <p className="text-gray-600">{risk.description}</p>
                </div>
              ))}
            </div>
          </Card>

          {/* Category and Confidence */}
          <Card className="p-6">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-medium mb-1">Category</h3>
                <p className="text-gray-600">{analysis.category}</p>
              </div>
              <div className="text-right">
                <h3 className="text-lg font-medium mb-1">Confidence Score</h3>
                <p className="text-gray-600">{(analysis.confidenceScore * 100).toFixed(1)}%</p>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
