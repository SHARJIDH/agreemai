import { NextResponse } from 'next/server';
import axios from 'axios';

const DOCUSIGN_BASE_PATH = 'https://demo.docusign.net/restapi';
const DOCUSIGN_ACCOUNT_ID = process.env.DOCUSIGN_ACCOUNT_ID;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const accessToken = searchParams.get('access_token');

    if (!accessToken) {
      return NextResponse.json({ error: 'No access token provided' }, { status: 400 });
    }

    // Create a test signing request
    const documentContent = `
      <!DOCTYPE html>
      <html>
        <body style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #333;">Test Agreement</h1>
          <p>This is a test document for DocuSign integration.</p>
          <p>Date: <span style="color: #666;">${new Date().toLocaleDateString()}</span></p>
          <div style="margin: 40px 0;">
            <p>Please sign below to confirm:</p>
            <p style="border-bottom: 1px solid #999; margin-top: 50px;">Signature: <span style="color: #0000ff;">/sig1/</span></p>
          </div>
        </body>
      </html>
    `;

    const envelopeDefinition = {
      emailSubject: 'Test Document for Signing',
      documents: [
        {
          documentBase64: Buffer.from(documentContent).toString('base64'),
          name: 'Test Document.html',
          fileExtension: 'html',
          documentId: '1',
        },
      ],
      recipients: {
        signers: [
          {
            email: 'test@example.com',
            name: 'Test Signer',
            recipientId: '1',
            routingOrder: '1',
            tabs: {
              signHereTabs: [
                {
                  anchorString: '/sig1/',
                  anchorUnits: 'pixels',
                  anchorXOffset: '20',
                  anchorYOffset: '10',
                },
              ],
            },
          },
        ],
      },
      status: 'sent',
    };

    // Send envelope using the access token
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

    // Return success page
    return new NextResponse(
      `
      <!DOCTYPE html>
      <html>
        <head>
          <title>DocuSign Test Success</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              max-width: 800px;
              margin: 40px auto;
              padding: 20px;
              line-height: 1.6;
            }
            .success {
              color: #0a0;
              margin-bottom: 20px;
            }
            .info {
              background: #f5f5f5;
              padding: 20px;
              border-radius: 4px;
              margin: 20px 0;
            }
          </style>
        </head>
        <body>
          <h1 class="success">✓ DocuSign Integration Test Successful!</h1>
          <div class="info">
            <p><strong>Envelope ID:</strong> ${response.data.envelopeId}</p>
            <p><strong>Status:</strong> ${response.data.status}</p>
            <p>A test document has been sent to test@example.com for signing.</p>
          </div>
          <p>Check your DocuSign account to view the envelope and track its status.</p>
        </body>
      </html>
      `,
      {
        headers: {
          'Content-Type': 'text/html',
        },
      }
    );
  } catch (error) {
    console.error('Error in test endpoint:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
