import * as crypto from 'crypto';

interface SigningRequest {
  agreementId: string;
  signerEmail: string;
  signerName: string;
  documentName: string;
  documentContent: string;
}

interface SigningResponse {
  envelopeId: string;
  redirectUrl: string;
}

class DocuSignService {
  private accountId: string;
  private baseUrl: string;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;
  private clientId: string;
  private clientSecret: string;

  constructor() {
    this.accountId = process.env.DOCUSIGN_ACCOUNT_ID || '';
    this.baseUrl = process.env.DOCUSIGN_BASE_URL || 'https://demo.docusign.net/restapi';
    this.clientId = process.env.DOCUSIGN_INTEGRATION_KEY || '';
    this.clientSecret = process.env.DOCUSIGN_CLIENT_SECRET || '';
  }

  getAuthorizationUrl(): string {
    const scopes = ['signature', 'impersonation'];
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/docusign/callback`;
    
    const params = new URLSearchParams({
      response_type: 'code',
      scope: scopes.join(' '),
      client_id: this.clientId,
      redirect_uri: redirectUri,
    });

    return `https://account-d.docusign.com/oauth/auth?${params.toString()}`;
  }

  async exchangeCodeForToken(code: string): Promise<void> {
    try {
      const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/docusign/callback`;
      
      const response = await fetch('https://account-d.docusign.com/oauth/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: redirectUri
        })
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('DocuSign OAuth error:', error);
        throw new Error(`Failed to exchange code for token: ${error}`);
      }

      const data = await response.json();
      this.accessToken = data.access_token;
      this.tokenExpiry = Date.now() + (data.expires_in * 1000);
      
      // Store the account ID if it's in the response
      if (data.accounts && data.accounts.length > 0) {
        this.accountId = data.accounts[0].account_id;
      }
    } catch (error) {
      console.error('Error exchanging code for token:', error);
      throw error;
    }
  }

  private async refreshAccessToken(): Promise<void> {
    // Implementation for refreshing the token will be added later
    throw new Error('Token expired. Please reauthorize.');
  }

  private async getAccessToken(): Promise<string> {
    if (!this.accessToken) {
      throw new Error('Not authenticated. Please authorize first.');
    }

    if (Date.now() >= this.tokenExpiry - 60000) {
      await this.refreshAccessToken();
    }

    return this.accessToken;
  }

  async createSigningRequest({
    agreementId,
    signerEmail,
    signerName,
    documentName,
    documentContent
  }: SigningRequest): Promise<SigningResponse> {
    try {
      const accessToken = await this.getAccessToken();

      // Create envelope
      const envelope = {
        emailSubject: `Please sign: ${documentName}`,
        documents: [{
          documentBase64: Buffer.from(documentContent).toString('base64'),
          name: documentName,
          fileExtension: 'html',
          documentId: '1'
        }],
        recipients: {
          signers: [{
            email: signerEmail,
            name: signerName,
            recipientId: '1',
            routingOrder: '1',
            tabs: {
              signHereTabs: [{
                documentId: '1',
                pageNumber: '1',
                xPosition: '200',
                yPosition: '200'
              }]
            }
          }]
        },
        status: 'sent'
      };

      // Create envelope
      const envelopeResponse = await fetch(`${this.baseUrl}/v2.1/accounts/${this.accountId}/envelopes`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(envelope)
      });

      if (!envelopeResponse.ok) {
        const error = await envelopeResponse.text();
        throw new Error(`Failed to create envelope: ${error}`);
      }

      const envelopeResult = await envelopeResponse.json();

      // Create recipient view
      const viewRequest = {
        authenticationMethod: 'none',
        clientUserId: agreementId,
        recipientId: '1',
        returnUrl: `${process.env.NEXT_PUBLIC_APP_URL}/agreements/${agreementId}/signed`,
        userName: signerName,
        email: signerEmail
      };

      const viewResponse = await fetch(
        `${this.baseUrl}/v2.1/accounts/${this.accountId}/envelopes/${envelopeResult.envelopeId}/views/recipient`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(viewRequest)
        }
      );

      if (!viewResponse.ok) {
        const error = await viewResponse.text();
        throw new Error(`Failed to create recipient view: ${error}`);
      }

      const viewResult = await viewResponse.json();

      return {
        envelopeId: envelopeResult.envelopeId,
        redirectUrl: viewResult.url
      };
    } catch (error) {
      console.error('Error creating signing request:', error);
      throw error;
    }
  }

  async getEnvelopeStatus(envelopeId: string): Promise<string> {
    try {
      const accessToken = await this.getAccessToken();

      const response = await fetch(
        `${this.baseUrl}/v2.1/accounts/${this.accountId}/envelopes/${envelopeId}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to get envelope status: ${error}`);
      }

      const envelope = await response.json();
      return envelope.status || 'unknown';
    } catch (error) {
      console.error('Error getting envelope status:', error);
      throw error;
    }
  }
}

// Export a singleton instance
export const docuSignService = new DocuSignService();
