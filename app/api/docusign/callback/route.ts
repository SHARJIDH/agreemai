import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import docusign from 'docusign-esign';

const DOCUSIGN_INTEGRATION_KEY = process.env.DOCUSIGN_INTEGRATION_KEY;
const DOCUSIGN_SECRET_KEY = process.env.DOCUSIGN_SECRET_KEY;
const DOCUSIGN_BASE_PATH = 'https://demo.docusign.net/restapi';
const REDIRECT_URI = 'http://localhost:3000/api/docusign/callback';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    
    if (!code) {
      return NextResponse.json({ error: 'No authorization code provided' }, { status: 400 });
    }

    const dsApiClient = new docusign.ApiClient({
      basePath: DOCUSIGN_BASE_PATH,
      oAuthBasePath: 'https://account-d.docusign.com'
    });

    // Exchange authorization code for access token
    const response = await dsApiClient.generateAccessToken(
      DOCUSIGN_INTEGRATION_KEY,
      DOCUSIGN_SECRET_KEY,
      code,
      REDIRECT_URI
    );

    // Store the access token in a secure HTTP-only cookie
    cookies().set('docusign_access_token', response.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 3600 // 1 hour
    });

    // Redirect back to the application
    return NextResponse.redirect(new URL('/agreements', request.url));
  } catch (error) {
    console.error('DocuSign Callback Error:', error);
    return NextResponse.redirect(new URL('/error?source=docusign', request.url));
  }
}
