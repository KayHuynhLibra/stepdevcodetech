'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { name: 'Home', href: '/' },
  { name: 'Static', href: '/static' },
  { name: 'Habit', href: '/habit' },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const renderLinks = (isMobile = false) => (
    <div
      className={`${
        isMobile ? 'flex flex-col gap-3 px-4 pb-4' : 'hidden md:flex items-center space-x-8'
      }`}
    >
      {navItems.map((item) => {
        const isActive = pathname === item.href;
        return (
          <Link key={item.name} href={item.href}>
            <motion.div
              onClick={() => {
                if (isMobile) setMenuOpen(false);
              }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={`relative px-3 py-2 text-sm font-medium transition-colors rounded-full cursor-pointer ${
                isActive
                  ? 'text-white bg-white/10'
                  : 'text-gray-300 hover:text-white hover:bg-white/5'
              }`}
            >
              {item.name}
            </motion.div>
          </Link>
        );
      })}
    </div>
  );

  return (
    <motion.nav
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.5 }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? 'py-3' : 'py-4'
      }`}
    >
      <div className="glass mx-auto max-w-7xl px-4 sm:px-6 rounded-full">
        <div className="flex items-center justify-between h-16">
          <motion.div
            whileHover={{ scale: 1.05 }}
            className="text-lg sm:text-xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent"
          >
            Portfolio
          </motion.div>
          
          {renderLinks(false)}

          <div className="flex items-center gap-3">
            <Link href="/static#contact">
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="hidden sm:inline-block px-5 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition-colors cursor-pointer"
              >
                Get in Touch
              </motion.div>
            </Link>
            <button
              className="md:hidden inline-flex items-center justify-center w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Toggle menu"
            >
              <span className="sr-only">Toggle navigation</span>
              <div className="space-y-1.5">
                <span className={`block h-0.5 w-5 bg-white transition ${menuOpen ? 'translate-y-2 rotate-45' : ''}`}></span>
                <span className={`block h-0.5 w-5 bg-white transition ${menuOpen ? 'opacity-0' : ''}`}></span>
                <span className={`block h-0.5 w-5 bg-white transition ${menuOpen ? '-translate-y-2 -rotate-45' : ''}`}></span>
              </div>
            </button>
          </div>
        </div>

        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="md:hidden mt-2"
          >
            {renderLinks(true)}
            <Link href="/static#contact">
              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="block mx-4 mb-4 px-4 py-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white text-sm font-semibold text-center cursor-pointer"
                onClick={() => setMenuOpen(false)}
              >
                Get in Touch
              </motion.div>
            </Link>
          </motion.div>
        )}
      </div>
    </motion.nav>
  );
}

