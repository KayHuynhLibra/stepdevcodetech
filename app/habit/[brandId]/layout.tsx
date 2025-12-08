// Server component để generate static params
const brandNames = [
  'rider-waite',
  'thoth',
  'marseille',
  'wild-unknown',
  'everyday-witch',
];

export function generateStaticParams() {
  return brandNames.map((brandId) => ({
    brandId,
  }));
}

export default function BrandLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

