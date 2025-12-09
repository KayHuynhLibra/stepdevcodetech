'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import Starfield from '@/components/Starfield';
import ShootingStars from '@/components/ShootingStars';
import Navbar from '@/components/Navbar';

interface TarotBrand {
  id: string;
  name: string;
  nameVi: string;
  description: string;
  image?: string;
}

const tarotBrands: TarotBrand[] = [
  {
    id: 'rider-waite',
    name: 'Rider-Waite',
    nameVi: 'Rider-Waite Tarot',
    description: 'Bộ bài Tarot cổ điển và phổ biến nhất, được thiết kế bởi A.E. Waite và vẽ bởi Pamela Colman Smith',
  },
  {
    id: 'thoth',
    name: 'Thoth Tarot',
    nameVi: 'Thoth Tarot',
    description: 'Bộ bài được thiết kế bởi Aleister Crowley, phức tạp và mang tính triết học sâu sắc',
  },
  {
    id: 'marseille',
    name: 'Marseille Tarot',
    nameVi: 'Tarot Marseille',
    description: 'Bộ bài Tarot truyền thống của Pháp, một trong những bộ bài lâu đời nhất',
  },
  {
    id: 'wild-unknown',
    name: 'The Wild Unknown',
    nameVi: 'The Wild Unknown',
    description: 'Bộ bài hiện đại với thiết kế tối giản và nghệ thuật đương đại',
  },
  {
    id: 'everyday-witch',
    name: 'Everyday Witch',
    nameVi: 'Everyday Witch Tarot',
    description: 'Bộ bài thân thiện và dễ tiếp cận, phù hợp cho người mới bắt đầu',
  },
];

export default function HabitPage() {
  const router = useRouter();

  const handleBrandClick = (brandId: string) => {
    router.push(`/habit/${brandId}`);
  };

  return (
    <main className="relative min-h-screen">
      <Starfield />
      <ShootingStars />
      <Navbar />
      
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 pt-28 sm:pt-32">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center mb-16"
        >
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold mb-4 sm:mb-6 bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent px-4">
            Habit - Tarot Research
          </h1>
          <p className="text-base sm:text-lg md:text-xl text-gray-400 max-w-2xl mx-auto px-4">
            Chọn một hãng bộ bài để xem các bộ bài và lá bài Tarot
          </p>
        </motion.div>

        {/* Brands Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {tarotBrands.map((brand, index) => (
            <motion.div
              key={brand.id}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1, duration: 0.5 }}
              whileHover={{ y: -10, scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleBrandClick(brand.id)}
              className="glass rounded-3xl p-8 cursor-pointer group hover:border-purple-500/50 transition-all relative overflow-hidden"
            >
              {/* Brand Box Image Placeholder */}
              <div className="relative h-56 mb-6 rounded-2xl bg-gradient-to-br from-purple-500/20 via-pink-500/20 to-blue-500/20 flex items-center justify-center group-hover:from-purple-500/30 group-hover:via-pink-500/30 group-hover:to-blue-500/30 transition-all overflow-hidden">
                {/* Pattern background */}
                <div className="absolute inset-0 opacity-20" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")` }}></div>
                
                {/* Box image placeholder - có thể thay bằng hình ảnh thật sau */}
                <div className="relative z-10 text-center">
                  <div className="w-32 h-40 mx-auto bg-gradient-to-br from-purple-400/40 to-pink-400/40 rounded-lg shadow-2xl transform rotate-3 group-hover:rotate-6 transition-transform border-2 border-white/30 relative">
                    {/* Decorative elements */}
                    <div className="absolute top-2 left-2 w-3 h-3 rounded-full bg-white/20"></div>
                    <div className="absolute top-2 right-2 w-3 h-3 rounded-full bg-white/20"></div>
                    <div className="absolute bottom-2 left-2 w-3 h-3 rounded-full bg-white/20"></div>
                    <div className="absolute bottom-2 right-2 w-3 h-3 rounded-full bg-white/20"></div>
                    {/* Center symbol */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-5xl opacity-40">🃏</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="text-center">
                <h3 className="text-2xl font-bold text-white mb-2">{brand.nameVi}</h3>
                <p className="text-purple-400 font-semibold mb-3 text-sm">{brand.name}</p>
                <p className="text-gray-400 text-sm mb-4 line-clamp-3">{brand.description}</p>
              </div>

              {/* Hover effect overlay */}
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/0 to-pink-500/0 group-hover:from-purple-500/10 group-hover:to-pink-500/10 transition-all rounded-3xl"></div>
            </motion.div>
          ))}
        </div>

        {/* Info Section */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.8 }}
          className="mt-16 text-center"
        >
          <p className="text-gray-500 text-sm">
            Click vào hộp bài để xem các bộ bài (Cups, Wands, Swords, Pentacles, Major Arcana)
          </p>
        </motion.div>
      </div>
    </main>
  );
}
