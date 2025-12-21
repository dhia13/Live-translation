import { NextRequest, NextResponse } from 'next/server';
import * as deepl from 'deepl-node';

export async function POST(request: NextRequest) {
  try {
    const { text, apiKey } = await request.json();

    if (!text || !apiKey) {
      return NextResponse.json(
        { error: 'Missing text or API key' },
        { status: 400 }
      );
    }

    // Initialize DeepL translator
    const translator = new deepl.Translator(apiKey);

    // Translate with formality setting
    const result = await translator.translateText(
      text,
      'fr', // Source language
      'en-US', // Target language
      {
        formality: 'more', // Professional/formal tone
      }
    );

    return NextResponse.json({
      translatedText: result.text,
    });
  } catch (error: any) {
    console.error('Translation API error:', error);
    return NextResponse.json(
      { error: error.message || 'Translation failed' },
      { status: 500 }
    );
  }
}

