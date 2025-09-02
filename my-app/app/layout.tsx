import "./globals.css";
import BottomNav from "@/app/components/BottomNav";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="border-b">
          <div className="max-w-5xl mx-auto p-3 font-semibold">Daily Plus</div>
        </header>
        <main className="max-w-5xl mx-auto p-4">{children}</main>
        <BottomNav />
      </body>
    </html>
  );
}
