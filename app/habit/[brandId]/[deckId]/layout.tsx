// Server component để generate static params
const brandNames = [
  'rider-waite',
  'thoth',
  'marseille',
  'wild-unknown',
  'everyday-witch',
];

const deckNames = [
  'major-arcana',
  'cups',
  'wands',
  'swords',
  'pentacles',
];

export function generateStaticParams() {
  return brandNames.flatMap((brandId) =>
    deckNames.map((deckId) => ({
      brandId,
      deckId,
    }))
  );
}

export default function DeckLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

