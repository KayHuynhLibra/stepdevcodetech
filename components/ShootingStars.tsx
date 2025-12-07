'use client';

import { useEffect, useState, useRef } from 'react';

interface Meteor {
  id: number;
  x: number;
  y: number;
  length: number;
  angle: number;
  speed: number;
  opacity: number;
}

export default function ShootingStars() {
  const [meteors, setMeteors] = useState<Meteor[]>([]);
  const lastUpdateRef = useRef<number>(0);

  useEffect(() => {
    const createMeteor = (): Meteor => {
      const angle = Math.random() * Math.PI * 0.5 + Math.PI * 0.25; // 45-90 degrees
      const length = Math.random() * 150 + 80;
      const speed = Math.random() * 3 + 2;
      
      return {
        id: Math.random(),
        x: Math.random() * (typeof window !== 'undefined' ? window.innerWidth * 0.5 : 800) - 100,
        y: Math.random() * (typeof window !== 'undefined' ? window.innerHeight * 0.3 : 300) - 50,
        length,
        angle,
        speed,
        opacity: 1,
      };
    };

    // Create initial meteors
    const initialMeteors: Meteor[] = [];
    for (let i = 0; i < 8; i++) {
      initialMeteors.push(createMeteor());
    }
    setMeteors(initialMeteors);

    let animationFrameId: number;
    let lastTime = performance.now();

    const animate = (currentTime: number) => {
      const deltaTime = currentTime - lastTime;
      lastTime = currentTime;

      // Throttle updates to ~60fps
      if (deltaTime < 16) {
        animationFrameId = requestAnimationFrame(animate);
        return;
      }

      setMeteors((prev) => {
        let updated = prev
          .map((meteor) => ({
            ...meteor,
            x: meteor.x + Math.cos(meteor.angle) * meteor.speed * (deltaTime / 16),
            y: meteor.y + Math.sin(meteor.angle) * meteor.speed * (deltaTime / 16),
            opacity: Math.max(0, meteor.opacity - 0.01),
          }))
          .filter((meteor) => {
            const endX = meteor.x + Math.cos(meteor.angle) * meteor.length;
            const endY = meteor.y + Math.sin(meteor.angle) * meteor.length;
            return (
              endX < (typeof window !== 'undefined' ? window.innerWidth : 1920) + 200 &&
              endY < (typeof window !== 'undefined' ? window.innerHeight : 1080) + 200 &&
              meteor.opacity > 0
            );
          });

        // Add new meteor occasionally
        if (Math.random() > 0.92 && updated.length < 10) {
          updated.push(createMeteor());
        }

        return updated;
      });

      animationFrameId = requestAnimationFrame(animate);
    };

    animationFrameId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div className="fixed inset-0 -z-10 pointer-events-none overflow-hidden">
      {meteors.map((meteor) => {
        const endX = meteor.x + Math.cos(meteor.angle) * meteor.length;
        const endY = meteor.y + Math.sin(meteor.angle) * meteor.length;

        return (
          <div
            key={meteor.id}
            className="absolute"
            style={{
              left: `${meteor.x}px`,
              top: `${meteor.y}px`,
              width: `${meteor.length}px`,
              height: '2px',
              background: `linear-gradient(to right, 
                rgba(255, 255, 255, ${meteor.opacity}), 
                rgba(255, 255, 255, ${meteor.opacity * 0.5}), 
                transparent)`,
              transform: `rotate(${meteor.angle}rad)`,
              transformOrigin: 'left center',
              boxShadow: `0 0 ${meteor.length * 0.3}px rgba(255, 255, 255, ${meteor.opacity * 0.8})`,
            }}
          />
        );
      })}
    </div>
  );
}

