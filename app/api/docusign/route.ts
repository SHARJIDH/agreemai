import { NextResponse } from 'next/server';
import docusign from 'docusign-esign';
import crypto from 'crypto';

const DOCUSIGN_INTEGRATION_KEY = process.env.DOCUSIGN_INTEGRATION_KEY;
const DOCUSIGN_SECRET_KEY = process.env.DOCUSIGN_SECRET_KEY;
const DOCUSIGN_ACCOUNT_ID = process.env.DOCUSIGN_ACCOUNT_ID;
const DOCUSIGN_BASE_PATH = 'https://demo.docusign.net/restapi';
const DOCUSIGN_OAUTH_BASE_PATH = 'https://account-d.docusign.com';
const REDIRECT_URI = 'http://localhost:3000/api/docusign/callback';

// Initialize DocuSign API client
const dsApiClient = new docusign.ApiClient({
  basePath: DOCUSIGN_BASE_PATH,
  oAuthBasePath: DOCUSIGN_OAUTH_BASE_PATH
});

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
    
    // Store verifier in session (you'll need to implement session storage)
    // For now, we'll store it in memory (not recommended for production)
    global.codeVerifier = verifier;

    const authUri = dsApiClient.getAuthorizationUri(
      DOCUSIGN_INTEGRATION_KEY,
      REDIRECT_URI,
      'signature',
      challenge,
      'S256'
    );

    return NextResponse.json({ authUrl: authUri });
  } catch (error) {
    console.error('DocuSign Auth Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate authorization URL' },
      { status: 500 }
    );
  }
}

// Handle authorization callback
export async function CALLBACK(request: Request) {
  try {
    const { code } = await request.json();

    // Get access token
    const tokenResponse = await dsApiClient.requestJWTUserToken(
      DOCUSIGN_INTEGRATION_KEY,
      DOCUSIGN_ACCOUNT_ID,
      'signature',
      DOCUSIGN_SECRET_KEY,
      3600, // 1 hour expiry
      global.codeVerifier
    );

    // Set access token in API client
    dsApiClient.addDefaultHeader('Authorization', 'Bearer ' + tokenResponse.body.access_token);

    return NextResponse.json({ message: 'Authenticated with DocuSign' });
  } catch (error) {
    console.error('DocuSign Auth Error:', error);
    return NextResponse.json(
      { error: 'Failed to authenticate with DocuSign' },
      { status: 500 }
    );
  }
}

// Handle document signing
export async function POST(request: Request) {
  try {
    const { documentBase64, signerEmail, signerName, documentName } = await request.json();

    // Ensure we have an access token
    if (!dsApiClient.getUserInfo()?.accessToken) {
      return NextResponse.json(
        { error: 'Not authenticated with DocuSign' },
        { status: 401 }
      );
    }

    // Create envelope definition
    const envDef = new docusign.EnvelopeDefinition();
    envDef.emailSubject = 'Please sign this document';

    // Create document
    const doc = new docusign.Document();
    doc.documentBase64 = documentBase64;
    doc.name = documentName;
    doc.fileExtension = 'pdf';
    doc.documentId = '1';

    // Add document to envelope
    envDef.documents = [doc];

    // Create signer
    const signer = docusign.Signer.constructFromObject({
      email: signerEmail,
      name: signerName,
      recipientId: '1',
      routingOrder: '1'
    });

    // Create signHere tab
    const signHere = docusign.SignHere.constructFromObject({
      anchorString: '/sig1/',
      anchorUnits: 'pixels',
      anchorXOffset: '20',
      anchorYOffset: '10'
    });

    // Add tab to signer
    const tabs = docusign.Tabs.constructFromObject({
      signHereTabs: [signHere]
    });
    signer.tabs = tabs;

    // Add signer to recipients
    const recipients = docusign.Recipients.constructFromObject({
      signers: [signer]
    });
    envDef.recipients = recipients;

    // Set envelope status
    envDef.status = 'sent';

    // Create envelope API instance
    const envelopesApi = new docusign.EnvelopesApi(dsApiClient);

    // Send envelope
    const results = await envelopesApi.createEnvelope(DOCUSIGN_ACCOUNT_ID, {
      envelopeDefinition: envDef
    });

    return NextResponse.json({
      envelopeId: results.envelopeId,
      status: results.status
    });
  } catch (error) {
    console.error('DocuSign Error:', error);
    return NextResponse.json(
      { error: 'Failed to send document for signature' },
      { status: 500 }
    );
  }
}
