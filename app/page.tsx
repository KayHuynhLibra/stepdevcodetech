'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Starfield from '@/components/Starfield'
import ShootingStars from '@/components/ShootingStars'
import Navbar from '@/components/Navbar'

// Home page - hỗ trợ cả static và dynamic
export default function Home() {
  const [isServerRunning, setIsServerRunning] = useState(false);
  const isStaticBuild = process.env.NEXT_PUBLIC_STATIC_BUILD === 'true';

  useEffect(() => {
    if (isStaticBuild) {
      // Khi build static, không cần check server
      return;
    }
    // Chỉ check server khi không phải static build
    fetch('/api/health')
      .then(() => setIsServerRunning(true))
      .catch(() => setIsServerRunning(false));
  }, [isStaticBuild]);

  return (
    <main className="relative min-h-screen">
      <Starfield />
      <ShootingStars />
      <Navbar />
      
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 pt-28 sm:pt-32">
        <div className="text-center max-w-4xl mx-auto">
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold mb-4 sm:mb-6 bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent px-4">
            Welcome to StepDevCode.Tech
          </h1>
          
          <p className="text-base sm:text-lg md:text-xl text-gray-400 mb-6 sm:mb-8 px-4">
            {isStaticBuild 
              ? '🌟 Portfolio Website - Xem portfolio tĩnh bên dưới'
              : isServerRunning 
                ? '✅ Server đang chạy - Bạn có thể truy cập các tính năng dynamic'
                : '⚠️ Server chưa chạy - Chạy npm run dev để sử dụng các tính năng'}
          </p>

          <div className="grid md:grid-cols-2 gap-6 mt-12">
            {/* Static Portfolio */}
            <Link href="/static" className="glass rounded-2xl sm:rounded-3xl p-6 sm:p-8 hover:border-purple-500/50 transition-all group min-h-[200px] flex items-center">
              <div className="text-center w-full">
                <div className="text-4xl sm:text-5xl mb-3 sm:mb-4">📄</div>
                <h2 className="text-xl sm:text-2xl font-bold text-white mb-2 sm:mb-3">Static Portfolio</h2>
                <p className="text-gray-400 mb-3 sm:mb-4 text-sm sm:text-base">
                  Xem portfolio tĩnh - Không cần server, có thể export static
                </p>
                <div className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-green-500/20 text-green-300 text-xs sm:text-sm inline-block">
                  Không cần npm
                </div>
              </div>
            </Link>

            {/* Dynamic Features */}
            <div className={`glass rounded-2xl sm:rounded-3xl p-6 sm:p-8 ${isServerRunning ? 'hover:border-purple-500/50 transition-all cursor-pointer' : 'opacity-60'} min-h-[200px] flex items-center`}>
              <div className="text-center w-full">
                <div className="text-4xl sm:text-5xl mb-3 sm:mb-4">⚡</div>
                <h2 className="text-xl sm:text-2xl font-bold text-white mb-2 sm:mb-3">Dynamic Features</h2>
                <p className="text-gray-400 mb-3 sm:mb-4 text-sm sm:text-base">
                  {isServerRunning 
                    ? 'Truy cập các tính năng dynamic như Habit (Tarot Research)'
                    : 'Cần chạy npm run dev để sử dụng'}
                </p>
                {isServerRunning ? (
                  <Link href="/habit" className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-purple-500/20 text-purple-300 text-xs sm:text-sm inline-block min-h-[36px] flex items-center justify-center">
                    Mở Habit →
                  </Link>
                ) : (
                  <div className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-gray-500/20 text-gray-400 text-xs sm:text-sm inline-block min-h-[36px] flex items-center justify-center">
                    Cần server
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Quick Links */}
          {(isServerRunning || isStaticBuild) && (
            <div className="mt-8 sm:mt-12 glass rounded-2xl sm:rounded-3xl p-4 sm:p-6">
              <h3 className="text-lg sm:text-xl font-bold text-white mb-3 sm:mb-4">Quick Links</h3>
              <div className="flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-4 justify-center">
                {isServerRunning && (
                  <Link href="/habit" className="px-5 sm:px-6 py-2.5 sm:py-3 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold hover:scale-105 transition-transform text-sm sm:text-base min-h-[44px] flex items-center justify-center">
                    Habit - Tarot Research
                  </Link>
                )}
                <Link href="/static" className="px-5 sm:px-6 py-2.5 sm:py-3 rounded-full glass text-white font-semibold hover:bg-white/10 transition-colors text-sm sm:text-base min-h-[44px] flex items-center justify-center">
                  Static Portfolio
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}


