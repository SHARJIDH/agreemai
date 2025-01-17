import { NextResponse } from 'next/server';
import axios from 'axios';
import crypto from 'crypto';

const DOCUSIGN_INTEGRATION_KEY = process.env.DOCUSIGN_INTEGRATION_KEY;
const DOCUSIGN_CLIENT_SECRET = process.env.DOCUSIGN_CLIENT_SECRET;
const DOCUSIGN_ACCOUNT_ID = process.env.DOCUSIGN_ACCOUNT_ID;
const DOCUSIGN_BASE_PATH = 'https://demo.docusign.net/restapi';
const DOCUSIGN_OAUTH_BASE_PATH = 'https://account-d.docusign.com';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL;
const REDIRECT_URI = `${APP_URL}/api/docusign/callback`;

// Generate PKCE values
function generatePKCE() {
  const verifier = crypto.randomBytes(32).toString('base64url');
  const challenge = crypto
    .createHash('sha256')
    .update(verifier)
    .digest('base64url');
  return { verifier, challenge };
}

// Get authorization URL
export async function GET() {
  try {
    const { verifier, challenge } = generatePKCE();
    
    // Log the request details (masking sensitive info)
    console.log('Authorization request:', {
      integrationKey: DOCUSIGN_INTEGRATION_KEY?.substring(0, 8) + '...',
      redirectUri: REDIRECT_URI,
      verifier: verifier.substring(0, 8) + '...',
      challenge: challenge.substring(0, 8) + '...',
      APP_URL,
    });

    const authUrl = `${DOCUSIGN_OAUTH_BASE_PATH}/oauth/auth?` +
      `response_type=code&` +
      `scope=signature&` + // Simplified scope
      `client_id=${DOCUSIGN_INTEGRATION_KEY}&` +
      `redirect_uri=${encodeURIComponent(REDIRECT_URI)}&` +
      `code_challenge=${challenge}&` +
      `code_challenge_method=S256&` +
      `state=${verifier}&` + // Pass verifier in state parameter
      `prompt=login`; // Force login prompt

    return NextResponse.json({ url: authUrl });
  } catch (error) {
    console.error('Error generating authorization URL:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Handle document signing
export async function POST(request) {
  try {
    const { documentBase64, signerEmail, signerName, documentName, accessToken } = await request.json();

    const envelopeDefinition = {
      emailSubject: 'Please sign this document',
      documents: [
        {
          documentBase64,
          name: documentName,
          fileExtension: 'pdf',
          documentId: '1',
        },
      ],
      recipients: {
        signers: [
          {
            email: signerEmail,
            name: signerName,
            recipientId: '1',
            routingOrder: '1',
            tabs: {
              signHereTabs: [
                {
                  documentId: '1',
                  pageNumber: '1',
                  xPosition: '100',
                  yPosition: '100',
                },
              ],
            },
          },
        ],
      },
      status: 'sent',
    };

    const response = await axios.post(
      `${DOCUSIGN_BASE_PATH}/v2.1/accounts/${DOCUSIGN_ACCOUNT_ID}/envelopes`,
      envelopeDefinition,
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    return NextResponse.json(response.data);
  } catch (error) {
    console.error('Error creating envelope:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
