import { NextResponse } from 'next/server';
import axios from 'axios';

const DOCUSIGN_INTEGRATION_KEY = process.env.DOCUSIGN_INTEGRATION_KEY;
const DOCUSIGN_CLIENT_SECRET = process.env.DOCUSIGN_CLIENT_SECRET;
const DOCUSIGN_OAUTH_BASE_PATH = 'https://account-d.docusign.com';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL;
const REDIRECT_URI = `${APP_URL}/api/docusign/callback`;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');
    const state = searchParams.get('state'); // This should contain the verifier if we passed it

    console.log('Callback received:', {
      code: code?.substring(0, 8) + '...',
      error,
      errorDescription,
      state: state?.substring(0, 8) + '...',
      url: request.url,
      APP_URL,
      REDIRECT_URI,
    });

    if (error) {
      console.error('DocuSign authorization error:', error, errorDescription);
      return NextResponse.redirect(`${APP_URL}/error?message=${errorDescription}`);
    }

    if (!code) {
      return NextResponse.redirect(`${APP_URL}/error?message=No authorization code received`);
    }

    try {
      const tokenRequestData = {
        grant_type: 'authorization_code',
        code,
        code_verifier: state || '', // Use the verifier from state parameter
        redirect_uri: REDIRECT_URI, // Add redirect URI to token request
        client_id: DOCUSIGN_INTEGRATION_KEY,
        client_secret: DOCUSIGN_CLIENT_SECRET,
      };

      // Log the request details (masking sensitive info)
      console.log('Token request:', {
        url: `${DOCUSIGN_OAUTH_BASE_PATH}/oauth/token`,
        code: code.substring(0, 8) + '...',
        verifier: state?.substring(0, 8) + '...',
        integrationKey: DOCUSIGN_INTEGRATION_KEY?.substring(0, 8) + '...',
        redirectUri: REDIRECT_URI,
        requestData: {
          ...tokenRequestData,
          code: tokenRequestData.code.substring(0, 8) + '...',
          client_id: tokenRequestData.client_id.substring(0, 8) + '...',
          client_secret: '***',
        },
      });

      // Exchange the code for an access token
      const tokenResponse = await axios.post(
        `${DOCUSIGN_OAUTH_BASE_PATH}/oauth/token`,
        new URLSearchParams(tokenRequestData).toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Accept: 'application/json',
          },
          validateStatus: null, // Don't throw on any status
        }
      );

      // Log the response (without sensitive data)
      console.log('Token response:', {
        status: tokenResponse.status,
        statusText: tokenResponse.statusText,
        data: {
          ...tokenResponse.data,
          access_token: tokenResponse.data?.access_token ? '***' : undefined,
          refresh_token: tokenResponse.data?.refresh_token ? '***' : undefined,
        },
        headers: tokenResponse.headers,
      });

      if (tokenResponse.status !== 200) {
        throw new Error(`Token request failed: ${JSON.stringify(tokenResponse.data)}`);
      }

      // Store the access token in a secure way (session, cookie, etc.)
      // For now, we'll pass it as a URL parameter (not recommended for production)
      const accessToken = tokenResponse.data.access_token;
      
      // Redirect to test endpoint with the access token
      return NextResponse.redirect(
        `${APP_URL}/api/docusign/test?mode=test&access_token=${accessToken}`
      );
    } catch (tokenError) {
      console.error('Error exchanging code for token:', {
        error: tokenError.response?.data || tokenError,
        status: tokenError.response?.status,
        headers: tokenError.response?.headers,
        request: {
          url: tokenError.config?.url,
          method: tokenError.config?.method,
          headers: {
            ...tokenError.config?.headers,
            Authorization: '***',
          },
        },
      });
      return NextResponse.redirect(
        `${APP_URL}/error?message=Failed to exchange code for token: ${tokenError.message}`
      );
    }
  } catch (error) {
    console.error('Error in DocuSign callback:', error);
    return NextResponse.redirect(`${APP_URL}/error?message=${error.message}`);
  }
}
