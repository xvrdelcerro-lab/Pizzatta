import Sidebar from '../components/Sidebar';
import './globals.css';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="flex">
        <Sidebar />
        {/* Changed bg-gray-100 to bg-white below */}
        <main className="ml-64 flex-1 p-8 bg-white min-h-screen">
          {children}
        </main>
      </body>
    </html>
  );
}