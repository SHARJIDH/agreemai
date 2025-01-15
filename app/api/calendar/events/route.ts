import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]/route';
import { PrismaClient } from '@prisma/client';
import { addDays } from 'date-fns';

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
      return NextResponse.json([]);
    }

    // Get all agreements for the organization
    const agreements = await prisma.agreement.findMany({
      where: {
        orgId: user.organization.id
      }
    });

    // Convert agreements to calendar events
    const events = agreements.flatMap(agreement => {
      const events = [];

      // Add deadline event if expiresAt is set
      if (agreement.expiresAt) {
        events.push({
          id: `deadline-${agreement.id}`,
          title: `${agreement.title} - Deadline`,
          date: agreement.expiresAt,
          type: 'deadline'
        });
      }

      // Add review event 7 days before expiry if expiresAt is set
      if (agreement.expiresAt) {
        const reviewDate = addDays(agreement.expiresAt, -7);
        events.push({
          id: `review-${agreement.id}`,
          title: `${agreement.title} - Review`,
          date: reviewDate,
          type: 'review'
        });
      }

      // Add renewal event if status is 'signed'
      if (agreement.status === 'signed') {
        const renewalDate = addDays(agreement.expiresAt || new Date(), -30);
        events.push({
          id: `renewal-${agreement.id}`,
          title: `${agreement.title} - Renewal`,
          date: renewalDate,
          type: 'renewal'
        });
      }

      return events;
    });

    return NextResponse.json(events);
  } catch (error) {
    console.error('Error fetching calendar events:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
