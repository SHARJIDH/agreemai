import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';

// POST /api/organizations/default - Create a default organization for the current user if they don't have one
export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    console.log('Session in default org creation:', session);

    if (!session?.user?.id || !session?.user?.email) {
      console.error('No user session found');
      return NextResponse.json(
        { error: 'You must be signed in to create an organization' },
        { status: 401 }
      );
    }

    // Get user with current organization if any
    const user = await prisma.user.findUnique({
      where: { 
        id: session.user.id 
      },
      include: { 
        organization: true 
      }
    });
    console.log('User found:', user);

    if (!user) {
      console.error('User not found in database');
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // If user already has an organization, return it
    if (user.organization) {
      console.log('User already has organization:', user.organization);
      return NextResponse.json(user.organization);
    }

    // Create a default organization for the user
    const defaultOrgName = `${user.name}'s Organization`;
    console.log('Creating organization:', defaultOrgName);
    
    // Create organization and update user in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: {
          name: defaultOrgName,
        },
      });
      console.log('Organization created:', org);

      const updatedUser = await tx.user.update({
        where: { 
          id: user.id 
        },
        data: {
          orgId: org.id,
        },
        include: {
          organization: true,
        },
      });
      console.log('User updated:', updatedUser);

      return { org, user: updatedUser };
    });

    console.log('Transaction completed successfully:', result);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in default organization creation:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create default organization' },
      { status: 500 }
    );
  }
}
