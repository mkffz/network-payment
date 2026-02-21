export const metadata = {
  title: "N-Genius Link Generator",
  description: "Generate N-Genius invoice payment links"
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
