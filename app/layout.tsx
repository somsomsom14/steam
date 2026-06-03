import type { Metadata } from "next";
import { JetBrains_Mono, Space_Grotesk, Space_Mono } from "next/font/google";
import "pretendard/dist/web/static/pretendard.css";
import "./globals.css";

const spaceMono = Space_Mono({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-space-mono-next",
});

const spaceGrotesk = Space_Grotesk({
  weight: ["300", "400", "500", "700"],
  subsets: ["latin"],
  variable: "--font-space-grotesk-next",
});

const jetbrainsMono = JetBrains_Mono({
  weight: ["100", "300", "400", "700"],
  subsets: ["latin"],
  variable: "--font-jetbrains-mono-next",
});

export const metadata: Metadata = {
  title: "MI-TEAM | Find Your Steam Partner",
  description: "MI-TEAM에서 스팀 팀원을 찾는 인터랙티브 랜딩 페이지",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`${spaceMono.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
