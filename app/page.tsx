import Starfield from '@/components/Starfield'
import ShootingStars from '@/components/ShootingStars'
import Navbar from '@/components/Navbar'
import Hero from '@/components/Hero'
import About from '@/components/About'
import Projects from '@/components/Projects'
import Contact from '@/components/Contact'

export default function Home() {
  return (
    <main className="relative min-h-screen">
      <Starfield />
      <ShootingStars />
      <Navbar />
      <Hero />
      <About />
      <Projects />
      <Contact />
    </main>
  )
}

