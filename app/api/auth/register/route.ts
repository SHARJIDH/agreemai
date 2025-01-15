import { NextResponse } from 'next/server';
import { hash } from 'bcrypt';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(request: Request) {
  try {
    const { name, email, password, organizationName } = await request.json();

    // Validate input
    if (!name || !email || !password) {
      return NextResponse.json(
        { error: 'Name, email and password are required' },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'User already exists' },
        { status: 400 }
      );
    }

    // Hash password
    const hashedPassword = await hash(password, 10);

    // Create user and organization in a transaction if organizationName is provided
    const result = await prisma.$transaction(async (tx) => {
      let organization;
      
      if (organizationName) {
        organization = await tx.organization.create({
          data: {
            name: organizationName
          }
        });
      }

      const user = await tx.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
          orgId: organization?.id
        },
        select: {
          id: true,
          name: true,
          email: true,
          organization: true
        }
      });

      return { user, organization };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'Failed to create user' },
      { status: 500 }
    );
  }
}
