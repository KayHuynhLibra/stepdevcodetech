'use client';

import React from 'react';
import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import Starfield from '@/components/Starfield';
import ShootingStars from '@/components/ShootingStars';
import Navbar from '@/components/Navbar';
import TarotCardForm from '@/components/TarotCardForm';

interface TarotCard {
  id: number;
  name: string;
  number: string;
  suit?: string;
  meaning: string;
  upright: string[];
  reversed: string[];
  description: string;
  image?: string;
}

const deckCards: Record<string, TarotCard[]> = {
  'major-arcana': [
    {
      id: 1,
      name: 'The Fool',
      number: '0',
      suit: 'Major Arcana',
      meaning: 'New Beginnings, Innocence, Spontaneity',
      upright: ['New beginnings', 'Innocence', 'Spontaneity', 'Free spirit'],
      reversed: ['Recklessness', 'Taken advantage of', 'Inconsideration'],
      description: 'The Fool represents new beginnings, having faith in the future, being inexperienced, not knowing what to expect, having beginner\'s luck, improvisation and believing in the universe.',
    },
    {
      id: 2,
      name: 'The Magician',
      number: 'I',
      suit: 'Major Arcana',
      meaning: 'Manifestation, Resourcefulness, Power, Inspired Action',
      upright: ['Manifestation', 'Resourcefulness', 'Power', 'Inspired action'],
      reversed: ['Manipulation', 'Poor planning', 'Untapped talents'],
      description: 'The Magician card represents manifestation, resourcefulness, power, and inspired action. It\'s a card of having all the tools you need to succeed.',
    },
    {
      id: 3,
      name: 'The High Priestess',
      number: 'II',
      suit: 'Major Arcana',
      meaning: 'Intuition, Unconscious, Inner Voice',
      upright: ['Intuition', 'Unconscious', 'Inner voice', 'Divine feminine'],
      reversed: ['Lack of center', 'Lost inner voice', 'Repressed feelings'],
      description: 'The High Priestess represents intuition, the unconscious mind, and inner voice. She sits between the conscious and unconscious worlds.',
    },
  ],
  'cups': [
    {
      id: 101,
      name: 'Ace of Cups',
      number: 'Ace',
      suit: 'Cups',
      meaning: 'New feelings, spirituality, intuition',
      upright: ['New feelings', 'Spirituality', 'Intuition', 'Creativity'],
      reversed: ['Emotional loss', 'Blocked creativity', 'Emptiness'],
      description: 'The Ace of Cups represents new feelings, spirituality, and intuition. It signifies the beginning of emotional fulfillment.',
    },
  ],
  'wands': [],
  'swords': [],
  'pentacles': [],
};

const deckNames: Record<string, { name: string; nameVi: string }> = {
  'major-arcana': { name: 'Major Arcana', nameVi: 'Bộ Ẩn Chính' },
  'cups': { name: 'Cups', nameVi: 'Bộ Cốc' },
  'wands': { name: 'Wands', nameVi: 'Bộ Gậy' },
  'swords': { name: 'Swords', nameVi: 'Bộ Kiếm' },
  'pentacles': { name: 'Pentacles', nameVi: 'Bộ Tiền' },
};

const brandNames: Record<string, { name: string; nameVi: string }> = {
  'rider-waite': { name: 'Rider-Waite Tarot', nameVi: 'Rider-Waite Tarot' },
  'thoth': { name: 'Thoth Tarot', nameVi: 'Thoth Tarot' },
  'marseille': { name: 'Marseille Tarot', nameVi: 'Tarot Marseille' },
  'wild-unknown': { name: 'The Wild Unknown', nameVi: 'The Wild Unknown' },
  'everyday-witch': { name: 'Everyday Witch', nameVi: 'Everyday Witch Tarot' },
};

export default function DeckDetailPage() {
  const params = useParams();
  const router = useRouter();
  const brandId = params.brandId as string;
  const deckId = params.deckId as string;
  
  const [selectedCard, setSelectedCard] = useState<TarotCard | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [cards, setCards] = useState<TarotCard[]>(deckCards[deckId] || []);

  const deckInfo = deckNames[deckId] || { name: 'Unknown', nameVi: 'Không xác định' };
  const brandInfo = brandNames[brandId] || { name: 'Unknown', nameVi: 'Không xác định' };

  const filteredCards = cards.filter(card =>
    card.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    card.meaning.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAddCard = (formData: any) => {
    const newCard: TarotCard = {
      id: cards.length + 1,
      suit: deckInfo.name,
      ...formData,
    };
    setCards([...cards, newCard]);
    setShowForm(false);
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
            onClick={() => router.push(`/habit/${brandId}`)}
            className="mb-6 text-gray-400 hover:text-white transition-colors flex items-center gap-2"
          >
            ← Quay lại {brandInfo.nameVi}
          </button>
          <div className="flex items-center gap-3 mb-4">
            <h1 className="text-5xl md:text-6xl font-bold bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent">
              {deckInfo.nameVi}
            </h1>
            <span className="text-gray-500">•</span>
            <p className="text-xl text-gray-400">{brandInfo.nameVi}</p>
          </div>
          <p className="text-gray-500 text-sm">{deckInfo.name}</p>
        </motion.div>

        {/* Search Bar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.8 }}
          className="mb-8"
        >
          <div className="glass rounded-2xl p-4 max-w-2xl">
            <input
              type="text"
              placeholder="Tìm kiếm lá bài..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-6 py-4 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors text-lg"
            />
          </div>
        </motion.div>

        {/* Cards Grid */}
        {filteredCards.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            {filteredCards.map((card, index) => (
              <motion.div
                key={card.id}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1, duration: 0.5 }}
                whileHover={{ y: -5, scale: 1.02 }}
                onClick={() => setSelectedCard(card)}
                className="glass rounded-3xl p-6 cursor-pointer group hover:border-purple-500/50 transition-all"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-2xl font-bold text-white mb-2">{card.name}</h3>
                    <p className="text-purple-400 font-semibold">#{card.number}</p>
                  </div>
                </div>
                
                <p className="text-gray-300 mb-4 line-clamp-2">{card.description}</p>
                
                <div className="flex flex-wrap gap-2">
                  {card.upright.slice(0, 2).map((tag, i) => (
                    <span
                      key={i}
                      className="px-2 py-1 rounded-full bg-green-500/20 text-green-300 text-xs"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 glass rounded-3xl">
            <p className="text-gray-400 text-lg mb-4">Chưa có lá bài nào trong bộ này</p>
            <p className="text-gray-500 text-sm">Click nút bên dưới để thêm lá bài đầu tiên</p>
          </div>
        )}

        {/* Add New Card Button */}
        {!showForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-center"
          >
            <motion.button
              onClick={() => setShowForm(true)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="px-8 py-4 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold text-lg shadow-lg shadow-purple-500/50"
            >
              + Thêm lá bài mới
            </motion.button>
          </motion.div>
        )}

        {/* Add Card Form */}
        {showForm && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass rounded-3xl p-8 max-w-3xl mx-auto mt-8"
          >
            <h2 className="text-3xl font-bold text-white mb-6">Thêm lá bài mới vào {deckInfo.nameVi}</h2>
            <TarotCardForm
              onSubmit={handleAddCard}
              onCancel={() => setShowForm(false)}
            />
          </motion.div>
        )}
      </div>

      {/* Card Detail Modal */}
      {selectedCard && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm"
          onClick={() => setSelectedCard(null)}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            onClick={(e) => e.stopPropagation()}
            className="glass rounded-3xl p-8 max-w-3xl w-full max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="text-4xl font-bold text-white mb-2">{selectedCard.name}</h2>
                <p className="text-purple-400 font-semibold text-xl">#{selectedCard.number}</p>
                <p className="text-gray-500 text-sm mt-1">{brandInfo.nameVi} • {deckInfo.nameVi}</p>
              </div>
              <button
                onClick={() => setSelectedCard(null)}
                className="text-gray-400 hover:text-white text-2xl"
              >
                ×
              </button>
            </div>

            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-semibold text-white mb-3">Ý nghĩa</h3>
                <p className="text-gray-300">{selectedCard.meaning}</p>
              </div>

              <div>
                <h3 className="text-xl font-semibold text-white mb-3">Mô tả</h3>
                <p className="text-gray-300 leading-relaxed">{selectedCard.description}</p>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-lg font-semibold text-green-400 mb-3">Upright (Ngửa)</h3>
                  <ul className="space-y-2">
                    {selectedCard.upright.map((item, i) => (
                      <li key={i} className="text-gray-300 flex items-center">
                        <span className="w-2 h-2 rounded-full bg-green-400 mr-3"></span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-red-400 mb-3">Reversed (Ngược)</h3>
                  <ul className="space-y-2">
                    {selectedCard.reversed.map((item, i) => (
                      <li key={i} className="text-gray-300 flex items-center">
                        <span className="w-2 h-2 rounded-full bg-red-400 mr-3"></span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </main>
  );
}

