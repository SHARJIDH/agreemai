import { Suspense } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import Analysis from './analysis';
import Sign from './sign';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { redirect } from 'next/navigation';

const prisma = new PrismaClient();

async function getAgreement(id: string) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    redirect('/login');
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: { organization: true }
  });

  if (!user || !user.organization) {
    throw new Error('Organization not found');
  }

  const agreement = await prisma.agreement.findUnique({
    where: {
      id: id
    },
    include: {
      signatures: true,
      aiAnalysis: true
    }
  });

  if (!agreement) {
    throw new Error('Agreement not found');
  }

  if (agreement.orgId !== user.organization.id) {
    throw new Error('Unauthorized');
  }

  return agreement;
}

function AgreementSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-[200px]" />
      <Skeleton className="h-[200px] w-full" />
    </div>
  );
}

function AgreementContent({ agreement }: { agreement: any }) {
  return (
    <>
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-900">{agreement.title}</h1>
          <Badge
            className={
              agreement.status === 'signed'
                ? 'bg-green-100 text-green-800'
                : agreement.status === 'pending'
                ? 'bg-yellow-100 text-yellow-800'
                : agreement.status === 'expired'
                ? 'bg-red-100 text-red-800'
                : 'bg-gray-100 text-gray-800'
            }
          >
            {agreement.status.charAt(0).toUpperCase() + agreement.status.slice(1)}
          </Badge>
        </div>
        <div className="mt-2 text-sm text-gray-500">
          Created {new Date(agreement.createdAt).toLocaleDateString()}
          {agreement.expiresAt && ` · Expires ${new Date(agreement.expiresAt).toLocaleDateString()}`}
        </div>
      </div>

      <Tabs defaultValue="content" className="space-y-4">
        <TabsList>
          <TabsTrigger value="content">Content</TabsTrigger>
          <TabsTrigger value="analysis">Analysis</TabsTrigger>
          <TabsTrigger value="signatures">Signatures</TabsTrigger>
        </TabsList>

        <TabsContent value="content" className="space-y-4">
          <Card className="p-6">
            <div className="prose max-w-none">
              <pre className="whitespace-pre-wrap">{agreement.content}</pre>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="analysis">
          <Analysis agreementId={agreement.id} />
        </TabsContent>

        <TabsContent value="signatures" className="space-y-4">
          <div className="space-y-6">
            <Sign agreementId={agreement.id} />
            {agreement.signatures && agreement.signatures.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Signature Status</h3>
                <div className="grid gap-4">
                  {agreement.signatures.map((signature: any) => (
                    <Card key={signature.id} className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{signature.signerEmail}</p>
                          <p className="text-sm text-gray-500">
                            {signature.signedAt
                              ? `Signed on ${new Date(signature.signedAt).toLocaleDateString()}`
                              : 'Pending signature'}
                          </p>
                        </div>
                        <Badge
                          className={
                            signature.status === 'completed' ? 'bg-green-100 text-green-800' :
                            signature.status === 'declined' ? 'bg-red-100 text-red-800' :
                            'bg-yellow-100 text-yellow-800'
                          }
                        >
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
        </TabsContent>
      </Tabs>
    </>
  );
}

export default async function AgreementPage({ params }: { params: { id: string } }) {
  const agreement = await getAgreement(params.id);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Suspense fallback={<AgreementSkeleton />}>
        <AgreementContent agreement={agreement} />
      </Suspense>
    </div>
  );
}
