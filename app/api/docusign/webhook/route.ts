import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { headers } from 'next/headers';
import crypto from 'crypto';

const prisma = new PrismaClient();

// DocuSign Connect includes the following in its payload
interface DocuSignEnvelopeStatus {
  status: string;
  emailSubject: string;
  envelopeId: string;
  recipients: {
    signers: Array<{
      email: string;
      status: string;
      signedDateTime?: string;
      declinedDateTime?: string;
      deliveredDateTime?: string;
    }>;
  };
}

interface DocuSignWebhookPayload {
  event: string;
  apiVersion: string;
  uri: string;
  retryCount: number;
  configurationId: string;
  generatedDateTime: string;
  data: {
    envelopeStatus: DocuSignEnvelopeStatus;
  };
}

function verifyDocuSignWebhook(payload: string, signature: string): boolean {
  try {
    const connectKey = process.env.DOCUSIGN_WEBHOOK_SECRET;
    if (!connectKey) {
      console.error('DOCUSIGN_WEBHOOK_SECRET not configured');
      return false;
    }

    // DocuSign uses base64-encoded HMAC SHA256
    const hmac = crypto.createHmac('sha256', connectKey);
    const digest = hmac.update(payload).digest('base64');
    
    return digest === signature;
  } catch (error) {
    console.error('Error verifying webhook signature:', error);
    return false;
  }
}

async function updateSignatureStatus(
  envelopeId: string,
  status: string,
  signedDateTime?: string
) {
  const signature = await prisma.signature.findFirst({
    where: { docuSignEnvelopeId: envelopeId },
    include: { agreement: true }
  });

  if (!signature) {
    console.log(`No signature found for envelope ${envelopeId}`);
    return;
  }

  // Update signature status
  await prisma.signature.update({
    where: { id: signature.id },
    data: {
      status: status.toLowerCase(),
      signedAt: signedDateTime ? new Date(signedDateTime) : null
    }
  });

  // If completed, check if all signatures are done
  if (status.toLowerCase() === 'completed') {
    const allSignatures = await prisma.signature.findMany({
      where: { agreementId: signature.agreementId }
    });

    const allSigned = allSignatures.every(sig => sig.status === 'completed');

    if (allSigned) {
      await prisma.agreement.update({
        where: { id: signature.agreementId },
        data: { status: 'signed' }
      });
    }
  }
}

export async function POST(request: Request) {
  try {
    const headersList = headers();
    const signature = headersList.get('X-DocuSign-Signature-1');
    const body = await request.text();

    // Verify the webhook signature
    if (!signature || !verifyDocuSignWebhook(body, signature)) {
      console.error('Invalid webhook signature');
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }

    const data: DocuSignWebhookPayload = JSON.parse(body);
    const envelope = data.data.envelopeStatus;

    // Process each signer in the envelope
    for (const signer of envelope.recipients.signers) {
      await updateSignatureStatus(
        envelope.envelopeId,
        signer.status,
        signer.signedDateTime || signer.declinedDateTime
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error processing DocuSign webhook:', error);
    return NextResponse.json(
      { error: 'Failed to process webhook' },
      { status: 500 }
    );
  }
}
