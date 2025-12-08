import Starfield from '@/components/Starfield'
import ShootingStars from '@/components/ShootingStars'
import Navbar from '@/components/Navbar'
import Hero from '@/components/Hero'
import About from '@/components/About'
import Projects from '@/components/Projects'
import Contact from '@/components/Contact'

// Static page - không cần server, có thể export
export default function StaticPage() {
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

