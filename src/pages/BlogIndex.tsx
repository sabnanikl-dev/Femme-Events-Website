import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { posts } from "../data/posts";

export default function BlogIndex() {
  return (
    <div className="min-h-screen bg-femme-cream">
      {/* Header */}
      <section className="pt-40 pb-16 px-6 md:px-24 bg-femme-pale border-b border-femme-plum/10">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
        >
          <h1 className="text-8xl md:text-9xl text-femme-dark italic mb-4">The Journal</h1>
          <div className="h-1 w-32 bg-femme-orange" />
          <p className="mt-6 text-femme-dark/60 text-xl font-system max-w-xl">
            Real talk on weddings, planning, and everything in between — from the people running the show.
          </p>
        </motion.div>
      </section>

      {/* Post grid */}
      <section className="py-20 px-6 md:px-24">
        <div className="grid md:grid-cols-3 gap-8">
          {posts.map((post, index) => (
            <motion.article
              key={post.slug}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1, duration: 0.6, ease: "easeOut" }}
            >
              <Link to={`/journal/${post.slug}`} className="group block">
                {/* Image */}
                <div className="overflow-hidden rounded-2xl aspect-[4/3] mb-5">
                  <img
                    src={post.image}
                    alt={post.title}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>

                {/* Meta */}
                <div className="flex items-center gap-3 mb-3 font-system">
                  <span className="text-xs font-bold uppercase tracking-widest text-femme-plum">
                    {post.category}
                  </span>
                  <span className="text-femme-dark/30">·</span>
                  <span className="text-xs text-femme-dark/50">{post.readTime}</span>
                </div>

                {/* Title */}
                <h2 className="text-2xl text-femme-dark leading-snug mb-3 group-hover:text-femme-plum transition-colors duration-200">
                  {post.title}
                </h2>

                {/* Excerpt */}
                <p className="text-femme-dark/60 text-base leading-relaxed font-system line-clamp-3">
                  {post.excerpt}
                </p>

                {/* Date */}
                <p className="mt-4 text-xs text-femme-dark/40 font-system uppercase tracking-widest">
                  {post.date}
                </p>
              </Link>
            </motion.article>
          ))}
        </div>
      </section>
    </div>
  );
}
