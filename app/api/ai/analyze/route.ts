import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(request: Request) {
  try {
    const { content } = await request.json();
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

    const prompt = `Analyze the following agreement and provide:
    1. A brief summary (2-3 sentences)
    2. Key points (bullet points)
    3. Potential risks or concerns
    4. Overall sentiment (positive, neutral, or negative)
    
    Agreement text:
    ${content}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Parse the response into structured data
    const sections = text.split('\n\n');
    const analysis = {
      summary: sections[0],
      keyPoints: sections[1].split('\n').filter(point => point.trim()),
      risks: sections[2].split('\n').filter(risk => risk.trim()),
      sentiment: sections[3].toLowerCase().includes('positive') ? 1 :
                sections[3].toLowerCase().includes('negative') ? -1 : 0
    };

    return NextResponse.json(analysis);
  } catch (error) {
    console.error('AI Analysis Error:', error);
    return NextResponse.json(
      { error: 'Failed to analyze agreement' },
      { status: 500 }
    );
  }
}
