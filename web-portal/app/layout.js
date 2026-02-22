import './globals.css';

export const metadata = {
  title: 'Condo Manager Portal',
  description: 'Condo management portal powered by Notion',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 min-h-screen">
        {children}
      </body>
    </html>
  );
}
