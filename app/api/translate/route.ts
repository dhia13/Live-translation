import * as deepl from 'deepl-node';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
    try {
        const { text, apiKey, targetLanguage, sourceLanguage } = await request.json();

        if (!text || !apiKey) {
            return NextResponse.json(
                { error: 'Missing text or API key' },
                { status: 400 }
            );
        }

        // Convert language names to DeepL language codes
        const langMap: { [key: string]: deepl.SourceLanguageCode | deepl.TargetLanguageCode } = {
            'English': 'en-US',
            'French': 'fr',
            'Spanish': 'es',
            'German': 'de',
            'Italian': 'it',
            'Portuguese': 'pt',
            'Russian': 'ru',
            'Japanese': 'ja',
            'Chinese': 'zh',
            'Korean': 'ko',
            'Arabic': 'ar',
            'Dutch': 'nl',
            'Polish': 'pl',
            'Turkish': 'tr',
            'Thai': 'th',
        };

        const sourceLangCode = (langMap[sourceLanguage] || 'en-US') as deepl.SourceLanguageCode;
        const targetLangCode = (langMap[targetLanguage] || 'fr') as deepl.TargetLanguageCode;

        // Initialize DeepL translator (reuse instance for better performance)
        const translator = new deepl.Translator(apiKey);

        // Translate with formality setting - optimized for speed
        const result = await translator.translateText(
            text,
            sourceLangCode,
            targetLangCode,
            {
                formality: 'more', // Professional/formal tone
                // No additional options to minimize processing time
            }
        );

        // Handle both single result and array results
        let translatedText: string;
        if (Array.isArray(result)) {
            translatedText = result.map(r => r.text).join(' ');
        } else {
            translatedText = result.text;
        }

        return NextResponse.json({
            translatedText,
        });
    } catch (error: any) {
        console.error('Translation API error:', error);
        return NextResponse.json(
            { error: error.message || 'Translation failed' },
            { status: 500 }
        );
    }
}
