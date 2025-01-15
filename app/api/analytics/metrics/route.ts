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
        signedCount: 0,
        agreementsByStatus: [],
        agreementsByType: [],
        agreementTrends: []
      });
    }

    // Get agreement counts
    const [agreementCount, pendingCount, signedCount, draftCount, expiredCount] = await Promise.all([
      prisma.agreement.count({
        where: {
          orgId: user.organization.id
        }
      }),
      prisma.agreement.count({
        where: {
          orgId: user.organization.id,
          status: 'pending'
        }
      }),
      prisma.agreement.count({
        where: {
          orgId: user.organization.id,
          status: 'signed'
        }
      }),
      prisma.agreement.count({
        where: {
          orgId: user.organization.id,
          status: 'draft'
        }
      }),
      prisma.agreement.count({
        where: {
          orgId: user.organization.id,
          status: 'expired'
        }
      })
    ]);

    // Get agreements created in the last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentAgreements = await prisma.agreement.findMany({
      where: {
        orgId: user.organization.id,
        createdAt: {
          gte: sevenDaysAgo
        }
      },
      orderBy: {
        createdAt: 'asc'
      }
    });

    // Process agreements into daily counts
    const dailyCounts = new Map();
    for (let i = 0; i < 7; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      dailyCounts.set(dateStr, 0);
    }

    recentAgreements.forEach(agreement => {
      const dateStr = agreement.createdAt.toISOString().split('T')[0];
      if (dailyCounts.has(dateStr)) {
        dailyCounts.set(dateStr, dailyCounts.get(dateStr) + 1);
      }
    });

    const agreementTrends = Array.from(dailyCounts.entries())
      .map(([date, count]) => ({
        date,
        count
      }))
      .reverse();

    return NextResponse.json({
      agreementCount,
      pendingCount,
      signedCount,
      agreementsByStatus: [
        { name: 'Draft', value: draftCount },
        { name: 'Pending', value: pendingCount },
        { name: 'Signed', value: signedCount },
        { name: 'Expired', value: expiredCount }
      ],
      agreementsByType: [
        { name: 'Total', value: agreementCount },
        { name: 'Active', value: pendingCount + signedCount },
        { name: 'Completed', value: signedCount }
      ],
      agreementTrends
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
