import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../auth/[...nextauth]/route';
import { PrismaClient } from '@prisma/client';
import { docuSignService } from '@/lib/docusign';

const prisma = new PrismaClient();

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get the signer information from the request body
    const { signerEmail, signerName } = await request.json();

    if (!signerEmail || !signerName) {
      return NextResponse.json(
        { error: 'Signer email and name are required' },
        { status: 400 }
      );
    }

    // Get the agreement
    const agreement = await prisma.agreement.findUnique({
      where: { id: params.id },
      include: {
        signatures: true,
        organization: true
      }
    });

    if (!agreement) {
      return NextResponse.json(
        { error: 'Agreement not found' },
        { status: 404 }
      );
    }

    // Create the signing request
    const signingRequest = await docuSignService.createSigningRequest({
      agreementId: agreement.id,
      signerEmail,
      signerName,
      documentName: agreement.title,
      documentContent: agreement.content
    });

    // Create or update the signature record
    const signature = await prisma.signature.upsert({
      where: {
        agreementId_signerEmail: {
          agreementId: agreement.id,
          signerEmail: signerEmail
        }
      },
      update: {
        status: 'pending',
        docuSignEnvelopeId: signingRequest.envelopeId
      },
      create: {
        agreementId: agreement.id,
        signerEmail: signerEmail,
        signerName: signerName,
        status: 'pending',
        docuSignEnvelopeId: signingRequest.envelopeId
      }
    });

    // Update agreement status if it's the first signature request
    if (agreement.status === 'draft') {
      await prisma.agreement.update({
        where: { id: agreement.id },
        data: { status: 'pending' }
      });
    }

    return NextResponse.json({
      signature,
      redirectUrl: signingRequest.redirectUrl
    });
  } catch (error) {
    console.error('Error creating signing request:', error);
    return NextResponse.json(
      { error: 'Failed to create signing request' },
      { status: 500 }
    );
  }
}
