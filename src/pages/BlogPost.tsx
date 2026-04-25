import { useEffect, useState } from "react";
import { useParams, Link, Navigate } from "react-router-dom";
import { motion } from "motion/react";
import { ArrowLeft } from "lucide-react";
import { PortableText, type PortableTextComponents } from "@portabletext/react";
import { getInitialPost, getPost, formatPostDate, type Post } from "../lib/posts";

// Custom serializers so Portable Text output matches the visual style of
// the existing markdown-ish renderer (italic h2, plum-dot bullets, etc.).
const portableTextComponents: PortableTextComponents = {
  block: {
    h2: ({ children }) => (
      <h2 className="text-3xl text-femme-dark mt-10 mb-4 italic">{children}</h2>
    ),
    normal: ({ children }) => (
      <p className="text-femme-dark/80 text-lg leading-relaxed font-system">
        {children}
      </p>
    ),
  },
  list: {
    bullet: ({ children }) => (
      <ul className="flex flex-col gap-2 my-4 pl-2">{children}</ul>
    ),
  },
  listItem: {
    bullet: ({ children }) => (
      <li className="flex gap-3 items-start font-system text-femme-dark/80 text-lg leading-relaxed">
        <span className="w-1.5 h-1.5 rounded-full bg-femme-plum shrink-0 mt-[10px]" />
        <span>{children}</span>
      </li>
    ),
  },
  marks: {
    link: ({ value, children }) => (
      <a
        href={value?.href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-femme-plum hover:opacity-70 transition-opacity"
      >
        {children}
      </a>
    ),
  },
};

function renderMarkdownBody(body: string) {
  return body.split("\n\n").map((block, i) => {
    if (block.startsWith("## ")) {
      return (
        <h2 key={i} className="text-3xl text-femme-dark mt-10 mb-4 italic">
          {block.replace("## ", "")}
        </h2>
      );
    }
    if (block.startsWith("- ")) {
      const items = block.split("\n").filter((l) => l.startsWith("- "));
      return (
        <ul key={i} className="flex flex-col gap-2 my-4 pl-2">
          {items.map((item, j) => (
            <li key={j} className="flex gap-3 items-start font-system text-femme-dark/80 text-lg leading-relaxed">
              <span className="w-1.5 h-1.5 rounded-full bg-femme-plum shrink-0 mt-[10px]" />
              {item.replace("- ", "")}
            </li>
          ))}
        </ul>
      );
    }
    if (block === "---") {
      return <hr key={i} className="border-femme-plum/15 my-10" />;
    }
    return (
      <p key={i} className="text-femme-dark/80 text-lg leading-relaxed font-system">
        {block}
      </p>
    );
  });
}

function renderBody(body: Post["body"]) {
  if (typeof body === "string") return renderMarkdownBody(body);
  return <PortableText value={body} components={portableTextComponents} />;
}

export default function BlogPost() {
  const { slug } = useParams<{ slug: string }>();
  // undefined = still loading (Sanity path); null = loaded, not found.
  const [post, setPost] = useState<Post | null | undefined>(() =>
    slug ? getInitialPost(slug) : null,
  );

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    getPost(slug).then((data) => {
      if (!cancelled) setPost(data);
    });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (post === undefined) return null;
  if (post === null) return <Navigate to="/journal" replace />;

  return (
    <div className="min-h-screen bg-femme-cream">
      {/* Hero image */}
      <div className="relative h-[55vh] w-full overflow-hidden">
        <img
          src={post.image}
          alt={post.title}
          fetchPriority="high"
          decoding="async"
          className="w-full h-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-femme-dark/70 via-femme-dark/20 to-transparent" />
      </div>

      {/* Article */}
      <div className="max-w-3xl mx-auto px-6 md:px-0 pb-24">
        {/* Back link */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="pt-10 mb-8"
        >
          <Link
            to="/journal"
            className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-femme-plum hover:text-femme-dark transition-colors duration-200 font-system"
          >
            <ArrowLeft size={15} strokeWidth={2.5} />
            Back to Journal
          </Link>
        </motion.div>

        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1, ease: "easeOut" }}
          className="mb-12"
        >
          <div className="flex items-center gap-3 mb-5 font-system">
            <span className="text-xs font-bold uppercase tracking-widest text-femme-plum">
              {post.category}
            </span>
            <span className="text-femme-dark/30">·</span>
            <span className="text-xs text-femme-dark/50">{post.readTime}</span>
            <span className="text-femme-dark/30">·</span>
            <span className="text-xs text-femme-dark/50">{formatPostDate(post.date)}</span>
          </div>
          <h1 className="text-5xl md:text-6xl text-femme-dark leading-tight italic mb-4">
            {post.title}
          </h1>
          <p className="text-femme-dark/60 text-xl leading-relaxed font-system">
            {post.excerpt}
          </p>
          <div className="h-px bg-femme-plum/15 mt-8" />
        </motion.header>

        {/* Body */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
          className="flex flex-col gap-5"
        >
          {renderBody(post.body)}
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3, ease: "easeOut" }}
          className="mt-16 bg-femme-pale rounded-2xl p-10 flex flex-col gap-4"
        >
          <p className="text-femme-dark text-2xl italic">
            Ready to start planning?
          </p>
          <p className="text-femme-dark/60 text-base font-system">
            We'd love to hear about your wedding. Fill out an inquiry and we'll be in touch within 48 hours.
          </p>
          <Link
            to="/#inquiry"
            className="inline-block bg-femme-plum text-white px-8 py-3.5 rounded-full font-bold text-sm uppercase tracking-widest font-system hover:bg-femme-dark transition-colors duration-200 w-fit mt-2"
          >
            Get in Touch
          </Link>
        </motion.div>
      </div>
    </div>
  );
}
