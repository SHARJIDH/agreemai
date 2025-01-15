import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';

// GET /api/agreements - Get all agreements for the current user
export async function GET() {
  try {
    // 1. Get and validate session
    const session = await getServerSession(authOptions);
    console.log('[GET /api/agreements] Session:', session ? JSON.stringify(session, null, 2) : 'No session');

    if (!session?.user?.id) {
      return new NextResponse(
        JSON.stringify({ error: 'You must be signed in to view agreements' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 2. Get user with organization data
    const user = await prisma.user.findUnique({
      where: { 
        id: session.user.id 
      },
      include: {
        organization: true
      }
    });
    console.log('[GET /api/agreements] User data:', user ? JSON.stringify(user, null, 2) : 'User not found');

    if (!user) {
      return new NextResponse(
        JSON.stringify({ error: 'User not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 3. Check if user has an organization
    if (!user.organization) {
      return new NextResponse(
        JSON.stringify({ error: 'User has no organization', code: 'NO_ORGANIZATION' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 4. Get agreements
    const agreements = await prisma.agreement.findMany({
      where: {
        orgId: user.organization.id
      },
      include: {
        signatures: {
          select: {
            id: true,
            status: true,
            signedAt: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    console.log('[GET /api/agreements] Found agreements:', JSON.stringify(agreements, null, 2));

    return new NextResponse(
      JSON.stringify({ data: agreements }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    const errorDetails = {
      message: errorMessage,
      type: error instanceof Error ? error.name : 'UnknownError',
      stack: error instanceof Error ? error.stack : undefined
    };
    
    console.error('[GET /api/agreements] Error:', errorDetails);

    return new NextResponse(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// POST /api/agreements - Create a new agreement
export async function POST(request: Request) {
  try {
    // 1. Get and validate session
    const session = await getServerSession(authOptions);
    console.log('[POST /api/agreements] Session:', session ? JSON.stringify(session, null, 2) : 'No session');

    if (!session?.user?.id) {
      return new NextResponse(
        JSON.stringify({ error: 'You must be signed in to create agreements' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 2. Get user with organization data
    const user = await prisma.user.findUnique({
      where: { 
        id: session.user.id 
      },
      include: {
        organization: true
      }
    });
    console.log('[POST /api/agreements] User data:', user ? JSON.stringify(user, null, 2) : 'User not found');

    if (!user) {
      return new NextResponse(
        JSON.stringify({ error: 'User not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 3. Check if user has an organization
    if (!user.organization) {
      return new NextResponse(
        JSON.stringify({ error: 'User has no organization', code: 'NO_ORGANIZATION' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 4. Parse request body
    const body = await request.json();
    console.log('[POST /api/agreements] Request body:', JSON.stringify(body, null, 2));

    const { title, content } = body;

    if (!title || !content) {
      return new NextResponse(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 5. Create agreement
    console.log('[POST /api/agreements] Creating agreement');
    try {
      const agreement = await prisma.agreement.create({
        data: {
          title,
          content,
          organization: {
            connect: { id: user.organization.id }
          }
        },
        include: {
          signatures: true
        }
      });
      console.log('[POST /api/agreements] Created agreement:', JSON.stringify(agreement, null, 2));

      return new NextResponse(
        JSON.stringify({ data: agreement }),
        { status: 201, headers: { 'Content-Type': 'application/json' } }
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      const errorDetails = {
        message: errorMessage,
        type: error instanceof Error ? error.name : 'UnknownError',
        stack: error instanceof Error ? error.stack : undefined
      };
      
      console.error('[POST /api/agreements] Error:', errorDetails);

      return new NextResponse(
        JSON.stringify({ error: errorMessage }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    const errorDetails = {
      message: errorMessage,
      type: error instanceof Error ? error.name : 'UnknownError',
      stack: error instanceof Error ? error.stack : undefined
    };
    
    console.error('[POST /api/agreements] Error:', errorDetails);

    return new NextResponse(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
