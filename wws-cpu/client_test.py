import socketio
import pyaudio
import base64
import wave
import time
import asyncio

class WhisperClient:
    def __init__(self, server_url='http://localhost:5000'):
        self.sio = socketio.Client()
        self.server_url = server_url
        
        # Audio settings
        self.CHUNK = 1024  # Smaller chunks
        self.FORMAT = pyaudio.paInt16
        self.CHANNELS = 1
        self.RATE = 16000
        
        print(f"Audio settings: {self.RATE}Hz, {self.CHANNELS} channel(s), 16-bit PCM")
        
        # Setup event handlers
        self.setup_handlers()
    
    def setup_handlers(self):
        @self.sio.on('connect')
        def on_connect():
            print('✓ Connected to server')
        
        @self.sio.on('status')
        def on_status(data):
            print(f"Server status: {data}")
        
        @self.sio.on('transcription')
        def on_transcription(data):
            print(f"\n📝 Transcription: {data['text']}")
            if data.get('final'):
                print("   (final)")
        
        @self.sio.on('disconnect')
        def on_disconnect():
            print('✗ Disconnected from server')
    
    def send_audio_file(self, filepath):
        """Send a WAV file to the server"""
        print(f"Connecting to {self.server_url}...")
        self.sio.connect(self.server_url)
        
        print(f"Sending audio file: {filepath}")
        
        with wave.open(filepath, 'rb') as wf:
            # Send in chunks
            chunk_size = self.CHUNK * 10  # Larger chunks for file
            
            while True:
                data = wf.readframes(chunk_size)
                if not data:
                    break
                
                # Encode and send
                encoded = base64.b64encode(data).decode('utf-8')
                self.sio.emit('audio_chunk', encoded)
                time.sleep(0.1)  # Small delay between chunks
        
        # Signal end of recording
        self.sio.emit('stop_recording')
        
        print("\nWaiting for final transcription...")
        time.sleep(2)
        
        self.sio.disconnect()
    
    def record_microphone(self, duration=10):
        """Record from microphone and stream to server"""
        print(f"Connecting to {self.server_url}...")
        self.sio.connect(self.server_url)
        
        p = pyaudio.PyAudio()
        
        # List available devices
        print("\nAvailable audio devices:")
        for i in range(p.get_device_count()):
            info = p.get_device_info_by_index(i)
            if info['maxInputChannels'] > 0:
                print(f"  [{i}] {info['name']}")
        
        print(f"\n🎤 Recording for {duration} seconds...")
        print("Speak clearly and loudly!\n")
        
        stream = p.open(
            format=self.FORMAT,
            channels=self.CHANNELS,
            rate=self.RATE,
            input=True,
            frames_per_buffer=self.CHUNK
        )
        
        try:
            start_time = time.time()
            buffer = b''
            send_interval = 0.3  # Send every 0.3 seconds (4800 samples)
            last_send = time.time()
            chunk_count = 0
            
            while time.time() - start_time < duration:
                data = stream.read(self.CHUNK, exception_on_overflow=False)
                buffer += data
                
                # Send buffered data every 0.3 seconds
                if time.time() - last_send >= send_interval:
                    if buffer:
                        # Verify buffer size
                        samples = len(buffer) // 2  # 16-bit = 2 bytes per sample
                        duration_ms = (samples / self.RATE) * 1000
                        
                        print(f"Sending chunk {chunk_count}: {samples} samples ({duration_ms:.0f}ms)")
                        
                        encoded = base64.b64encode(buffer).decode('utf-8')
                        self.sio.emit('audio_chunk', encoded)
                        buffer = b''
                        last_send = time.time()
                        chunk_count += 1
            
            # Send remaining buffer
            if buffer:
                encoded = base64.b64encode(buffer).decode('utf-8')
                self.sio.emit('audio_chunk', encoded)
            
            print("\n✓ Recording finished")
            
            # Signal end of recording
            self.sio.emit('stop_recording')
            
            # Wait for final transcription
            time.sleep(3)
            
        finally:
            stream.stop_stream()
            stream.close()
            p.terminate()
            self.sio.disconnect()

def main():
    client = WhisperClient()
    
    print("=" * 60)
    print("Socket.IO Whisper Client")
    print("=" * 60)
    print("1. Send WAV file")
    print("2. Record from microphone")
    print("=" * 60)
    
    choice = input("\nChoose option (1 or 2): ").strip()
    
    if choice == "1":
        filepath = input("Enter WAV file path: ").strip()
        client.send_audio_file(filepath)
    elif choice == "2":
        duration = input("Recording duration in seconds (default 10): ").strip()
        duration = int(duration) if duration else 10
        client.record_microphone(duration)
    else:
        print("Invalid choice")

if __name__ == "__main__":
    main()