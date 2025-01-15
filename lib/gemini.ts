import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Gemini API
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  throw new Error('GEMINI_API_KEY is not set in environment variables');
}

const genAI = new GoogleGenerativeAI(apiKey);

interface AnalysisResult {
  summary: string;
  keyTerms: {
    paymentTerms?: string;
    renewalConditions?: string;
    terminationClauses?: string;
    confidentialityTerms?: string;
    [key: string]: string | undefined;
  };
  risks: {
    type: string;
    description: string;
    severity: 'low' | 'medium' | 'high';
  }[];
  category: string;
  confidenceScore: number;
}

export async function analyzeAgreement(content: string): Promise<AnalysisResult> {
  try {
    console.log('Initializing Gemini analysis...');
    
    if (!content.trim()) {
      throw new Error('Agreement content is empty');
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

    // Create a structured prompt for agreement analysis
    const prompt = `Analyze this legal agreement and provide a structured response with the following:
1. A brief summary (2-3 sentences)
2. Key terms including payment terms, renewal conditions, termination clauses, and confidentiality terms
3. Potential risks or issues, with severity levels (low/medium/high)
4. The most appropriate category for this agreement
5. Your confidence score (0-1) in this analysis

Agreement content:
${content}

Respond in the following JSON format:
{
  "summary": "string",
  "keyTerms": {
    "paymentTerms": "string",
    "renewalConditions": "string",
    "terminationClauses": "string",
    "confidentialityTerms": "string"
  },
  "risks": [
    {
      "type": "string",
      "description": "string",
      "severity": "low|medium|high"
    }
  ],
  "category": "string",
  "confidenceScore": number
}`;

    console.log('Sending request to Gemini API...');
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    console.log('Received response from Gemini API');
    
    try {
      // Parse the JSON response
      const analysis: AnalysisResult = JSON.parse(text);
      
      // Validate the response structure
      if (!analysis.summary || !analysis.keyTerms || !analysis.risks || !analysis.category || analysis.confidenceScore === undefined) {
        throw new Error('Invalid response structure from Gemini API');
      }
      
      return analysis;
    } catch (parseError) {
      console.error('Error parsing Gemini response:', parseError);
      console.error('Raw response:', text);
      throw new Error('Failed to parse Gemini API response');
    }
  } catch (error) {
    console.error('Error in analyzeAgreement:', error);
    if (error instanceof Error) {
      throw new Error(`Gemini analysis failed: ${error.message}`);
    }
    throw new Error('Unknown error during Gemini analysis');
  }
}
