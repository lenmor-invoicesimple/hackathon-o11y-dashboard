import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'O11y Dashboard',
};

const RootLayout = ({ children }: { children: React.ReactNode }) => (
  <html lang="en">
    <body className="bg-gray-950 text-gray-100 min-h-screen">{children}</body>
  </html>
);

export default RootLayout;
