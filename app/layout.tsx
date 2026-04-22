import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MediSuccess — Q&A Generator",
  description: "Generate MCQ questions and flashcards from medical PDFs",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" style={{ height: "100%" }}>
      <body style={{ height: "100%", margin: 0 }}>
        {children}
      </body>
    </html>
  );
}
