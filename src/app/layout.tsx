import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Live Translation',
  description: 'Real-time French to English translation overlay',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body
        className="bg-transparent h-full overflow-hidden"
      >
        {children}
      </body>
    </html>
  );
}

