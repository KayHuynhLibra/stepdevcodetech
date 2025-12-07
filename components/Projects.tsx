'use client';

import { motion } from 'framer-motion';

const projects = [
  {
    title: 'Project One',
    description: 'A beautiful web application built with Next.js and TypeScript',
    tech: ['Next.js', 'TypeScript', 'Tailwind'],
    image: 'https://via.placeholder.com/600x400',
  },
  {
    title: 'Project Two',
    description: 'An innovative mobile-first design solution',
    tech: ['React', 'Framer Motion', 'CSS'],
    image: 'https://via.placeholder.com/600x400',
  },
  {
    title: 'Project Three',
    description: 'A full-stack application with modern architecture',
    tech: ['Node.js', 'MongoDB', 'Express'],
    image: 'https://via.placeholder.com/600x400',
  },
];

export default function Projects() {
  return (
    <section id="projects" className="min-h-screen flex items-center justify-center py-20 px-6">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="text-center mb-16"
        >
          <h2 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
            My Projects
          </h2>
          <div className="w-24 h-1 bg-gradient-to-r from-blue-500 to-purple-500 mx-auto"></div>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8">
          {projects.map((project, index) => (
            <motion.div
              key={project.title}
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.2, duration: 0.8 }}
              whileHover={{ y: -10 }}
              className="glass rounded-3xl overflow-hidden group cursor-pointer"
            >
              <div className="relative h-48 bg-gradient-to-br from-blue-500/20 to-purple-500/20 overflow-hidden">
                <div className="absolute inset-0 bg-black/50 group-hover:bg-black/30 transition-colors" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-white/50 text-sm">Project Image</span>
                </div>
              </div>
              <div className="p-6">
                <h3 className="text-2xl font-bold mb-3 text-white">{project.title}</h3>
                <p className="text-gray-400 mb-4">{project.description}</p>
                <div className="flex flex-wrap gap-2">
                  {project.tech.map((tech) => (
                    <span
                      key={tech}
                      className="px-3 py-1 rounded-full bg-white/5 text-xs text-gray-300"
                    >
                      {tech}
                    </span>
                  ))}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

