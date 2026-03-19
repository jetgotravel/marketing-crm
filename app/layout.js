export const metadata = {
  title: "Marketing CRM",
  description: "API-only marketing CRM",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
