import wave
import numpy as np
from faster_whisper import WhisperModel

def analyze_wav_file(filepath):
    """Analyze WAV file properties"""
    print("=" * 60)
    print("WAV File Analysis")
    print("=" * 60)
    
    with wave.open(filepath, 'rb') as wf:
        print(f"File: {filepath}")
        print(f"Channels: {wf.getnchannels()}")
        print(f"Sample Width: {wf.getsampwidth()} bytes ({wf.getsampwidth() * 8}-bit)")
        print(f"Frame Rate: {wf.getframerate()} Hz")
        print(f"Frames: {wf.getnframes()}")
        print(f"Duration: {wf.getnframes() / wf.getframerate():.2f} seconds")
        
        # Read audio data
        audio_data = wf.readframes(wf.getnframes())
        
        # Convert to numpy
        if wf.getsampwidth() == 2:
            samples = np.frombuffer(audio_data, dtype=np.int16)
        elif wf.getsampwidth() == 4:
            samples = np.frombuffer(audio_data, dtype=np.int32)
        else:
            print("Unsupported sample width!")
            return None
        
        # Handle stereo
        if wf.getnchannels() == 2:
            samples = samples.reshape(-1, 2).mean(axis=1)
            print("Converted stereo to mono")
        
        # Normalize to float32
        samples = samples.astype(np.float32) / (2 ** (wf.getsampwidth() * 8 - 1))
        
        # Audio statistics
        print(f"\nAudio Statistics:")
        print(f"Min: {samples.min():.4f}")
        print(f"Max: {samples.max():.4f}")
        print(f"Mean: {samples.mean():.4f}")
        print(f"RMS: {np.sqrt(np.mean(samples**2)):.4f}")
        print(f"Peak: {np.max(np.abs(samples)):.4f}")
        
        # Check if audio is silent
        if np.max(np.abs(samples)) < 0.001:
            print("\n⚠️ WARNING: Audio appears to be silent or very quiet!")
        
        return samples, wf.getframerate()

def test_transcription(samples, sample_rate, model_size="base"):
    """Test transcription directly"""
    print("\n" + "=" * 60)
    print(f"Testing Transcription with {model_size} model")
    print("=" * 60)
    
    # Load model
    print(f"Loading {model_size} model...")
    model = WhisperModel(model_size, device="cpu", compute_type="int8")
    
    # Transcribe full audio
    print("Transcribing full audio...")
    segments, info = model.transcribe(
        samples,
        language="en",
        beam_size=5,
        vad_filter=True
    )
    
    print(f"\nDetected language: {info.language} (confidence: {info.language_probability:.2f})")
    print("\nTranscription:")
    print("-" * 60)
    
    full_text = []
    for segment in segments:
        text = segment.text.strip()
        print(f"[{segment.start:.2f}s -> {segment.end:.2f}s] {text}")
        full_text.append(text)
    
    print("-" * 60)
    print("\nFull text:")
    print(" ".join(full_text))
    
    # Test chunks
    print("\n" + "=" * 60)
    print("Testing 5-second chunks with 1s overlap (like updated server)")
    print("=" * 60)
    
    chunk_duration = 5
    overlap_duration = 1
    chunk_size = int(sample_rate * chunk_duration)
    overlap_size = int(sample_rate * overlap_duration)
    step_size = chunk_size - overlap_size
    
    for i in range(0, len(samples), step_size):
        chunk = samples[i:i+chunk_size]
        if len(chunk) < sample_rate * 0.5:  # Skip very short chunks
            continue
        
        # Pad if needed
        if len(chunk) < chunk_size:
            chunk = np.pad(chunk, (0, chunk_size - len(chunk)))
        
        segments, _ = model.transcribe(
            chunk,
            language="en",
            beam_size=5,
            vad_filter=True,
            condition_on_previous_text=False
        )
        
        text = " ".join([s.text.strip() for s in segments])
        chunk_time = i / sample_rate
        chunk_end = min((i + chunk_size) / sample_rate, len(samples) / sample_rate)
        print(f"[{chunk_time:.1f}s -> {chunk_end:.1f}s] {text}")

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: python diagnostic.py <wav_file>")
        sys.exit(1)
    
    filepath = sys.argv[1]
    
    # Analyze file
    result = analyze_wav_file(filepath)
    
    if result is not None:
        samples, sample_rate = result
        
        # Test transcription
        test_transcription(samples, sample_rate, model_size="base")