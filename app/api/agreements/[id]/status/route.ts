import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../auth/[...nextauth]/route';

const prisma = new PrismaClient();

export async function GET(
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

    // Set up SSE headers
    const headers = new Headers({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    const stream = new ReadableStream({
      async start(controller) {
        // Initial status
        const agreement = await prisma.agreement.findUnique({
          where: { id: params.id },
          include: { signatures: true }
        });

        if (!agreement) {
          controller.close();
          return;
        }

        // Send initial data
        const data = JSON.stringify({
          status: agreement.status,
          signatures: agreement.signatures
        });
        controller.enqueue(`data: ${data}\n\n`);

        // Keep connection alive with a heartbeat
        const heartbeat = setInterval(() => {
          controller.enqueue(': heartbeat\n\n');
        }, 30000);

        // Clean up on close
        request.signal.addEventListener('abort', () => {
          clearInterval(heartbeat);
          controller.close();
        });
      }
    });

    return new Response(stream, { headers });
  } catch (error) {
    console.error('Error streaming agreement status:', error);
    return NextResponse.json(
      { error: 'Failed to stream status' },
      { status: 500 }
    );
  }
}
