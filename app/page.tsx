'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Starfield from '@/components/Starfield'
import ShootingStars from '@/components/ShootingStars'
import Navbar from '@/components/Navbar'

// Dynamic page - chỉ hiển thị khi có server chạy
export default function Home() {
  const [isServerRunning, setIsServerRunning] = useState(false);

  useEffect(() => {
    // Kiểm tra xem server có đang chạy không
    fetch('/api/health')
      .then(() => setIsServerRunning(true))
      .catch(() => setIsServerRunning(false));
  }, []);

  return (
    <main className="relative min-h-screen">
      <Starfield />
      <ShootingStars />
      <Navbar />
      
      <div className="container mx-auto px-6 py-20 pt-32">
        <div className="text-center max-w-4xl mx-auto">
          <h1 className="text-6xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent">
            Welcome to StepDevCode.Tech
          </h1>
          
          <p className="text-xl text-gray-400 mb-8">
            {isServerRunning 
              ? '✅ Server đang chạy - Bạn có thể truy cập các tính năng dynamic'
              : '⚠️ Server chưa chạy - Chạy npm run dev để sử dụng các tính năng'}
          </p>

          <div className="grid md:grid-cols-2 gap-6 mt-12">
            {/* Static Portfolio */}
            <Link href="/static" className="glass rounded-3xl p-8 hover:border-purple-500/50 transition-all group">
              <div className="text-center">
                <div className="text-5xl mb-4">📄</div>
                <h2 className="text-2xl font-bold text-white mb-3">Static Portfolio</h2>
                <p className="text-gray-400 mb-4">
                  Xem portfolio tĩnh - Không cần server, có thể export static
                </p>
                <div className="px-4 py-2 rounded-full bg-green-500/20 text-green-300 text-sm inline-block">
                  Không cần npm
                </div>
              </div>
            </Link>

            {/* Dynamic Features */}
            <div className={`glass rounded-3xl p-8 ${isServerRunning ? 'hover:border-purple-500/50 transition-all cursor-pointer' : 'opacity-60'}`}>
              <div className="text-center">
                <div className="text-5xl mb-4">⚡</div>
                <h2 className="text-2xl font-bold text-white mb-3">Dynamic Features</h2>
                <p className="text-gray-400 mb-4">
                  {isServerRunning 
                    ? 'Truy cập các tính năng dynamic như Habit (Tarot Research)'
                    : 'Cần chạy npm run dev để sử dụng'}
                </p>
                {isServerRunning ? (
                  <Link href="/habit" className="px-4 py-2 rounded-full bg-purple-500/20 text-purple-300 text-sm inline-block">
                    Mở Habit →
                  </Link>
                ) : (
                  <div className="px-4 py-2 rounded-full bg-gray-500/20 text-gray-400 text-sm inline-block">
                    Cần server
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Quick Links */}
          {isServerRunning && (
            <div className="mt-12 glass rounded-3xl p-6">
              <h3 className="text-xl font-bold text-white mb-4">Quick Links</h3>
              <div className="flex flex-wrap gap-4 justify-center">
                <Link href="/habit" className="px-6 py-3 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold hover:scale-105 transition-transform">
                  Habit - Tarot Research
                </Link>
                <Link href="/static" className="px-6 py-3 rounded-full glass text-white font-semibold hover:bg-white/10 transition-colors">
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


