import './globals.css';

export const metadata = {
  title: 'VoiceAI Assistant',
  description: 'Your AI Conversation Partner',
  icons: {
    icon: 'https://storage.googleapis.com/msgsndr/JBLl8rdfV29DRcGjQ7Rl/media/6862391e5cf8a548ab7a0741.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}