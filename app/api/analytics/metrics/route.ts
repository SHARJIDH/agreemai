import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]/route';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { organization: true }
    });

    if (!user || !user.organization) {
      return NextResponse.json({
        agreementCount: 0,
        pendingCount: 0,
        signedCount: 0
      });
    }

    // Get agreement counts
    const [agreementCount, pendingCount, signedCount] = await Promise.all([
      prisma.agreement.count({
        where: {
          orgId: user.organization.id,
          userId: user.id
        }
      }),
      prisma.agreement.count({
        where: {
          orgId: user.organization.id,
          userId: user.id,
          status: 'pending'
        }
      }),
      prisma.agreement.count({
        where: {
          orgId: user.organization.id,
          userId: user.id,
          status: 'signed'
        }
      })
    ]);

    return NextResponse.json({
      agreementCount,
      pendingCount,
      signedCount
    });
  } catch (error) {
    console.error('Error fetching metrics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch metrics' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
