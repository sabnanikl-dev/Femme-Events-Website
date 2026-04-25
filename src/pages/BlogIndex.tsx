import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { ArrowRight } from "lucide-react";
import { getInitialPosts, getPosts, type Post } from "../lib/posts";

function FeaturedPost({ post }: { post: Post }) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease: "easeOut" }}
      className="grid md:grid-cols-[28%_72%] gap-0 rounded-2xl overflow-hidden border border-femme-plum/10 shadow-sm"
    >
      {/* Image */}
      <div className="overflow-hidden aspect-[4/3] md:aspect-auto">
        <img
          src={post.image}
          alt={post.title}
          fetchPriority="high"
          decoding="async"
          className="w-full h-full object-cover"
        />
      </div>

      {/* Content */}
      <div className="bg-femme-pale flex flex-col justify-center px-10 py-12 gap-5">
        <div className="flex items-center gap-3 font-system">
          <span className="text-xs font-bold uppercase tracking-widest text-femme-plum bg-femme-plum/10 px-3 py-1 rounded-full">
            {post.category}
          </span>
          <span className="text-xs text-femme-dark/40">{post.date}</span>
        </div>

        <h2 className="text-[2.475rem] md:text-[3.3rem] text-femme-dark leading-tight italic">
          {post.title}
        </h2>

        <p className="text-femme-dark/65 text-[1.2375rem] leading-relaxed font-system">
          {post.excerpt}
        </p>

        <Link
          to={`/journal/${post.slug}`}
          className="inline-flex items-center gap-2 text-femme-plum font-bold text-sm uppercase tracking-widest font-system hover:gap-4 transition-all duration-200 w-fit"
        >
          Read Story <ArrowRight size={15} strokeWidth={2.5} />
        </Link>
      </div>
    </motion.article>
  );
}

function PostCard({ post, index }: { post: Post; index: number }) {
  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ delay: index * 0.08, duration: 0.5, ease: "easeOut" }}
      className="group flex flex-col gap-4 border-b border-femme-plum/10 pb-10"
    >
      {/* Image */}
      <div className="overflow-hidden rounded-xl aspect-[16/5.04]">
        <img
          src={post.image}
          alt={post.title}
          loading="lazy"
          decoding="async"
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      </div>

      {/* Meta */}
      <div className="flex items-center gap-3 font-system">
        <span className="text-xs font-bold uppercase tracking-widest text-femme-plum">
          {post.category}
        </span>
        <span className="text-femme-dark/25">·</span>
        <span className="text-xs text-femme-dark/45">{post.readTime}</span>
        <span className="text-femme-dark/25">·</span>
        <span className="text-xs text-femme-dark/45">{post.date}</span>
      </div>

      {/* Title */}
      <h3 className="text-[1.65rem] text-femme-dark leading-snug group-hover:text-femme-plum transition-colors duration-200">
        {post.title}
      </h3>

      {/* Excerpt */}
      <p className="text-femme-dark/60 text-[1.1rem] leading-relaxed font-system line-clamp-2 flex-1">
        {post.excerpt}
      </p>

      {/* CTA */}
      <Link
        to={`/journal/${post.slug}`}
        className="inline-flex items-center gap-2 text-femme-plum font-bold text-sm uppercase tracking-widest font-system hover:gap-4 transition-all duration-200 w-fit"
      >
        Read Story <ArrowRight size={14} strokeWidth={2.5} />
      </Link>
    </motion.article>
  );
}

export default function BlogIndex() {
  const [activeCategory, setActiveCategory] = useState("All");
  const [posts, setPosts] = useState<Post[] | null>(getInitialPosts);

  useEffect(() => {
    let cancelled = false;
    getPosts().then((data) => {
      if (!cancelled) setPosts(data);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const categories = useMemo(
    () =>
      posts
        ? ["All", ...Array.from(new Set(posts.map((p) => p.category)))]
        : ["All"],
    [posts],
  );

  if (!posts || posts.length === 0) {
    return (
      <div className="min-h-screen bg-femme-cream pt-40 px-6 md:px-24">
        <p className="text-femme-dark/40 font-system">Loading the journal…</p>
      </div>
    );
  }

  const featured = posts[0];
  const rest = posts.slice(1);
  const filtered = activeCategory === "All"
    ? rest
    : rest.filter((p) => p.category === activeCategory);

  return (
    <div className="min-h-screen bg-femme-cream">
      {/* Header */}
      <section className="pt-40 pb-16 px-6 md:px-24 border-b border-femme-plum/10">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="flex flex-col md:flex-row md:items-end justify-between gap-6"
        >
          <div>
            <p className="text-femme-plum text-sm uppercase tracking-widest font-bold font-system mb-3">
              Femme Events
            </p>
            <h1 className="text-7xl md:text-8xl lg:text-9xl text-femme-dark italic leading-none mb-4">
              The Journal
            </h1>
            <div className="h-1 w-32 bg-femme-orange" />
          </div>
          <p className="text-femme-dark/55 text-xl font-system max-w-sm md:text-right leading-relaxed">
            Real stories, honest planning advice, and the things we wish more couples knew.
          </p>
        </motion.div>
      </section>

      {/* Featured post */}
      <section className="py-14 px-6 md:px-24">
        <p className="text-xs uppercase tracking-widest font-bold text-femme-dark/35 font-system mb-6">
          Latest Story
        </p>
        <FeaturedPost post={featured} />
      </section>

      {/* Category filter + grid */}
      <section className="px-6 md:px-24 pb-24">
        {/* Divider + filter */}
        <div className="flex flex-wrap items-center gap-2 border-t border-femme-plum/10 pt-10 mb-12">
          <p className="text-xs uppercase tracking-widest font-bold text-femme-dark/35 font-system mr-4">
            Browse by
          </p>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-5 py-2 rounded-full text-xs font-bold uppercase tracking-widest font-system transition-colors duration-200 cursor-pointer border ${
                activeCategory === cat
                  ? "bg-femme-plum text-white border-femme-plum"
                  : "bg-transparent text-femme-dark/55 border-femme-dark/15 hover:border-femme-plum hover:text-femme-plum"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Post grid */}
        <AnimatePresence mode="wait">
          {filtered.length > 0 ? (
            <motion.div
              key={activeCategory}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="grid md:grid-cols-2 gap-x-12 gap-y-0"
            >
              {filtered.map((post, index) => (
                <PostCard key={post.slug} post={post} index={index} />
              ))}
            </motion.div>
          ) : (
            <motion.p
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-femme-dark/40 font-system py-16 text-center"
            >
              No posts in this category yet — check back soon.
            </motion.p>
          )}
        </AnimatePresence>
      </section>
    </div>
  );
}
