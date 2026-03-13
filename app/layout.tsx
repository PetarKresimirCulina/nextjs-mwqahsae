import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'CryptoPulse AI',
  description: 'AI crypto prediction dashboard',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="hr">
      <body>{children}</body>
    </html>
  );
}
