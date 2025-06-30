import './globals.css';

export const metadata = {
  title: 'VoiceAI Assistant',
  description: 'Your AI Conversation Partner',
  icons: {
    icon: 'https://storage.googleapis.com/msgsndr/JBLl8rdfV29DRcGjQ7Rl/media/67fe14cfc7a015d190da94a0.png',
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
