'use client';

import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import Starfield from '@/components/Starfield';
import ShootingStars from '@/components/ShootingStars';
import Navbar from '@/components/Navbar';

interface TarotDeck {
  id: string;
  name: string;
  nameVi: string;
  description: string;
  cardCount: number;
}

const tarotDecks: TarotDeck[] = [
  {
    id: 'major-arcana',
    name: 'Major Arcana',
    nameVi: 'Bộ Ẩn Chính',
    description: '22 lá bài đại diện cho những bài học lớn trong cuộc sống',
    cardCount: 22,
  },
  {
    id: 'cups',
    name: 'Cups',
    nameVi: 'Bộ Cốc',
    description: 'Liên quan đến cảm xúc, tình yêu và trực giác',
    cardCount: 14,
  },
  {
    id: 'wands',
    name: 'Wands',
    nameVi: 'Bộ Gậy',
    description: 'Đại diện cho năng lượng, đam mê và sáng tạo',
    cardCount: 14,
  },
  {
    id: 'swords',
    name: 'Swords',
    nameVi: 'Bộ Kiếm',
    description: 'Liên quan đến tư duy, trí tuệ và quyết định',
    cardCount: 14,
  },
  {
    id: 'pentacles',
    name: 'Pentacles',
    nameVi: 'Bộ Tiền',
    description: 'Đại diện cho vật chất, tài chính và thực tế',
    cardCount: 14,
  },
];

const brandNames: Record<string, { name: string; nameVi: string }> = {
  'rider-waite': { name: 'Rider-Waite Tarot', nameVi: 'Rider-Waite Tarot' },
  'thoth': { name: 'Thoth Tarot', nameVi: 'Thoth Tarot' },
  'marseille': { name: 'Marseille Tarot', nameVi: 'Tarot Marseille' },
  'wild-unknown': { name: 'The Wild Unknown', nameVi: 'The Wild Unknown' },
  'everyday-witch': { name: 'Everyday Witch', nameVi: 'Everyday Witch Tarot' },
};


export default function BrandDetailPage() {
  const params = useParams();
  const router = useRouter();
  const brandId = params.brandId as string;
  
  const brandInfo = brandNames[brandId] || { name: 'Unknown', nameVi: 'Không xác định' };

  const handleDeckClick = (deckId: string) => {
    router.push(`/habit/${brandId}/${deckId}`);
  };

  return (
    <main className="relative min-h-screen">
      <Starfield />
      <ShootingStars />
      <Navbar />
      
      <div className="container mx-auto px-6 py-20 pt-32">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="mb-12"
        >
          <button
            onClick={() => router.push('/habit')}
            className="mb-6 text-gray-400 hover:text-white transition-colors flex items-center gap-2"
          >
            ← Quay lại
          </button>
          <h1 className="text-5xl md:text-6xl font-bold mb-4 bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent">
            {brandInfo.nameVi}
          </h1>
          <p className="text-xl text-gray-400 mb-2">{brandInfo.name}</p>
          <p className="text-gray-500 text-sm">Chọn một bộ bài để xem các lá bài</p>
        </motion.div>

        {/* Decks Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {tarotDecks.map((deck, index) => (
            <motion.div
              key={deck.id}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1, duration: 0.5 }}
              whileHover={{ y: -10, scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleDeckClick(deck.id)}
              className="glass rounded-3xl p-8 cursor-pointer group hover:border-purple-500/50 transition-all relative overflow-hidden"
            >
              {/* Deck Icon/Image */}
              <div className="relative h-40 mb-6 rounded-2xl bg-gradient-to-br from-purple-500/20 via-pink-500/20 to-blue-500/20 flex items-center justify-center group-hover:from-purple-500/30 group-hover:via-pink-500/30 group-hover:to-blue-500/30 transition-all">
                <div className="absolute inset-0 opacity-20" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")` }}></div>
                <div className="relative z-10">
                  <div className="w-20 h-28 mx-auto bg-gradient-to-br from-purple-400/30 to-pink-400/30 rounded-lg shadow-xl transform rotate-6 group-hover:rotate-12 transition-transform border-2 border-white/20">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-3xl opacity-30">🃏</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="text-center">
                <h3 className="text-2xl font-bold text-white mb-2">{deck.nameVi}</h3>
                <p className="text-purple-400 font-semibold mb-3 text-sm">{deck.name}</p>
                <p className="text-gray-400 text-sm mb-4 line-clamp-2">{deck.description}</p>
                <div className="flex items-center justify-center gap-2 text-gray-500 text-sm">
                  <span>{deck.cardCount} lá bài</span>
                </div>
              </div>

              {/* Hover effect overlay */}
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/0 to-pink-500/0 group-hover:from-purple-500/10 group-hover:to-pink-500/10 transition-all rounded-3xl"></div>
            </motion.div>
          ))}
        </div>
      </div>
    </main>
  );
}

