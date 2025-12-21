import { NextRequest, NextResponse } from 'next/server';

// Dynamic import to handle WebSocket dependencies properly
let ttsModule: any = null;
let getVoicesModule: any = null;

async function getTTSModule() {
    if (!ttsModule) {
        try {
            const edgeTTS = await import('edge-tts');
            console.log('[TTS API] edge-tts imported successfully');
            console.log('[TTS API] Available exports:', Object.keys(edgeTTS));
            
            // edge-tts exports: communicate, getVoices
            // communicate(text, options) returns a ReadableStream
            if (edgeTTS.communicate) {
                ttsModule = edgeTTS.communicate;
                console.log('[TTS API] Using communicate function');
            } else if (edgeTTS.tts) {
                ttsModule = edgeTTS.tts;
                console.log('[TTS API] Using tts function');
            } else {
                throw new Error('edge-tts does not export communicate or tts');
            }
            
            getVoicesModule = edgeTTS.getVoices;
            if (!getVoicesModule) {
                console.warn('[TTS API] getVoices not found in edge-tts');
            }
        } catch (error: any) {
            console.error('[TTS API] Failed to import edge-tts:', error);
            console.error('[TTS API] Error details:', {
                message: error?.message,
                stack: error?.stack
            });
            throw error;
        }
    }
    return { tts: ttsModule, getVoices: getVoicesModule };
}

/**
 * TTS API Route - Converts text to speech audio using Edge TTS
 * Returns audio data directly (no speakers, prevents feedback loop)
 */
export async function POST(request: NextRequest) {
    try {
        const { text, language = 'en-US' } = await request.json();

        if (!text || typeof text !== 'string') {
            return NextResponse.json(
                { error: 'Text is required' },
                { status: 400 }
            );
        }

        console.log('[TTS API] Generating audio for:', text.substring(0, 50), 'Language:', language);

        // Get TTS module (dynamic import to handle WebSocket dependencies)
        const { tts, getVoices } = await getTTSModule();

        // Get available voices and find one matching the language
        let voice = 'en-US-AriaNeural'; // Default voice (US English)
        
        if (getVoices) {
            try {
                console.log('[TTS API] Getting available voices...');
                const voices = await getVoices();
                console.log('[TTS API] Found', voices?.length || 0, 'voices');
                
                // Find a voice matching the language (e.g., 'en-US' -> find 'en-US-*')
                const langPrefix = language.split('-')[0]; // 'en' from 'en-US'
                const matchingVoice = voices?.find((v: any) => 
                    (v.Locale && v.Locale.startsWith(langPrefix)) || 
                    (v.ShortName && v.ShortName.startsWith(langPrefix)) ||
                    (v.Name && v.Name.startsWith(langPrefix))
                );
                
                if (matchingVoice) {
                    voice = matchingVoice.ShortName || matchingVoice.Name || voice;
                    console.log('[TTS API] Using voice:', voice);
                } else {
                    console.warn('[TTS API] No voice found for', language, ', using default:', voice);
                }
            } catch (voiceError: any) {
                console.warn('[TTS API] Failed to get voices:', voiceError?.message);
                console.warn('[TTS API] Using default voice:', voice);
            }
        } else {
            console.warn('[TTS API] getVoices not available, using default voice:', voice);
        }
        
        // Generate audio using Edge TTS
        console.log('[TTS API] Calling tts function with voice:', voice);
        console.log('[TTS API] Text length:', text.length);
        
        let audioBuffer: Uint8Array;
        
        try {
            // Try calling tts function - it may return a stream or buffer
            const result = await tts(text, {
                voice: voice,
            });
            
            console.log('[TTS API] TTS function returned, type:', typeof result, 'constructor:', result?.constructor?.name);
            
            // Handle ReadableStream (most common case)
            if (result instanceof ReadableStream) {
                console.log('[TTS API] Converting ReadableStream to buffer...');
                const reader = result.getReader();
                const chunks: Uint8Array[] = [];
                
                try {
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;
                        if (value) {
                            chunks.push(value instanceof Uint8Array ? value : new Uint8Array(value));
                        }
                    }
                } finally {
                    reader.releaseLock();
                }
                
                // Combine chunks
                const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
                audioBuffer = new Uint8Array(totalLength);
                let offset = 0;
                for (const chunk of chunks) {
                    audioBuffer.set(chunk, offset);
                    offset += chunk.length;
                }
            } 
            // Handle Buffer (Node.js)
            else if (typeof Buffer !== 'undefined' && Buffer.isBuffer(result)) {
                console.log('[TTS API] Result is a Buffer, converting to Uint8Array...');
                audioBuffer = new Uint8Array(result);
            }
            // Handle Uint8Array
            else if (result instanceof Uint8Array) {
                console.log('[TTS API] Result is already Uint8Array');
                audioBuffer = result;
            }
            // Handle ArrayBuffer
            else if (result instanceof ArrayBuffer) {
                console.log('[TTS API] Result is ArrayBuffer, converting to Uint8Array...');
                audioBuffer = new Uint8Array(result);
            }
            // Try to convert array-like object
            else {
                console.log('[TTS API] Attempting to convert result to Uint8Array...');
                audioBuffer = new Uint8Array(result as ArrayLike<number>);
            }
        } catch (ttsError: any) {
            console.error('[TTS API] Error calling tts function:', ttsError);
            console.error('[TTS API] Error details:', {
                name: ttsError?.name,
                message: ttsError?.message,
                stack: ttsError?.stack
            });
            throw new Error(`TTS generation failed: ${ttsError.message}`);
        }

        console.log('[TTS API] ✓ Audio generated, size:', audioBuffer.byteLength, 'bytes');

        // Return audio as ArrayBuffer
        return new NextResponse(audioBuffer.buffer, {
            status: 200,
            headers: {
                'Content-Type': 'audio/mpeg',
                'Content-Length': audioBuffer.byteLength.toString(),
            },
        });
    } catch (error: any) {
        console.error('[TTS API] Error:', error);
        console.error('[TTS API] Error name:', error?.name);
        console.error('[TTS API] Error message:', error?.message);
        console.error('[TTS API] Error stack:', error?.stack);
        return NextResponse.json(
            { 
                error: error.message || 'Failed to process TTS request',
                details: error?.stack || 'No stack trace available'
            },
            { status: 500 }
        );
    }
}

