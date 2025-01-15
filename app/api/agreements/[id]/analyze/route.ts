import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../auth/[...nextauth]/route';
import { PrismaClient } from '@prisma/client';
import { analyzeAgreement } from '@/lib/gemini';

const prisma = new PrismaClient();

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    console.log('Starting agreement analysis for ID:', params.id);
    
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      console.log('Unauthorized: No session or email');
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
      console.log('Organization not found for user:', session.user.email);
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    // Get the agreement
    const agreement = await prisma.agreement.findUnique({
      where: {
        id: params.id
      },
      include: {
        aiAnalysis: true
      }
    });

    if (!agreement) {
      console.log('Agreement not found:', params.id);
      return NextResponse.json(
        { error: 'Agreement not found' },
        { status: 404 }
      );
    }

    if (agreement.orgId !== user.organization.id) {
      console.log('Unauthorized: Agreement belongs to different organization');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('Starting Gemini analysis for agreement:', agreement.id);
    
    // Check if content exists
    if (!agreement.content) {
      console.log('Agreement has no content:', agreement.id);
      return NextResponse.json(
        { error: 'Agreement has no content to analyze' },
        { status: 400 }
      );
    }

    // Analyze the agreement using Gemini
    const analysis = await analyzeAgreement(agreement.content);
    console.log('Analysis completed successfully');

    // Store the analysis results
    const aiAnalysis = await prisma.aiAnalysis.upsert({
      where: {
        agreementId: agreement.id
      },
      update: {
        summary: analysis.summary,
        keyTerms: analysis.keyTerms,
        risks: analysis.risks,
        category: analysis.category,
        confidenceScore: analysis.confidenceScore
      },
      create: {
        agreementId: agreement.id,
        summary: analysis.summary,
        keyTerms: analysis.keyTerms,
        risks: analysis.risks,
        category: analysis.category,
        confidenceScore: analysis.confidenceScore
      }
    });

    console.log('Analysis saved to database');
    return NextResponse.json(aiAnalysis);
  } catch (error) {
    console.error('Error in analyze route:', error);
    // Log the full error details
    if (error instanceof Error) {
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    return NextResponse.json(
      { error: 'Internal Server Error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
