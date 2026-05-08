import "./globals.css";

export const metadata = {
  title: "Infer134",
  description: "Private offchain inference with signed execution receipts and programmable payment settlement."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
