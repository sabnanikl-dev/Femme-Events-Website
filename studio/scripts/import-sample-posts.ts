import fs from "node:fs";
import path from "node:path";
import { getCliClient } from "sanity/cli";
import { posts } from "../../src/data/posts";

type Span = {
  _type: "span";
  _key: string;
  text: string;
  marks: string[];
};

type Block = {
  _type: "block";
  _key: string;
  style: "normal" | "h2";
  markDefs: Array<{ _key: string; _type: "link"; href: string }>;
  children: Span[];
  listItem?: "bullet";
  level?: number;
};

const client = getCliClient({ apiVersion: "2024-01-01" });

function key(prefix: string, index: number) {
  return `${prefix}${index.toString(36)}`;
}

function childrenFromMarkdown(text: string, blockIndex: number) {
  const markDefs: Block["markDefs"] = [];
  const children: Span[] = [];
  const linkPattern = /\[([^\]]+)\]\(([^)]+)\)/g;
  let cursor = 0;
  let childIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = linkPattern.exec(text)) !== null) {
    if (match.index > cursor) {
      children.push({
        _type: "span",
        _key: key(`s${blockIndex}_`, childIndex++),
        text: text.slice(cursor, match.index),
        marks: [],
      });
    }

    const markKey = key(`m${blockIndex}_`, markDefs.length);
    markDefs.push({ _key: markKey, _type: "link", href: match[2] });
    children.push({
      _type: "span",
      _key: key(`s${blockIndex}_`, childIndex++),
      text: match[1],
      marks: [markKey],
    });
    cursor = match.index + match[0].length;
  }

  if (cursor < text.length || children.length === 0) {
    children.push({
      _type: "span",
      _key: key(`s${blockIndex}_`, childIndex++),
      text: text.slice(cursor),
      marks: [],
    });
  }

  return { children, markDefs };
}

function toPortableText(body: string) {
  const blocks: Block[] = [];
  let blockIndex = 0;

  for (const rawBlock of body.split("\n\n")) {
    const block = rawBlock.trim();
    if (!block || block === "---") continue;

    if (block.startsWith("## ")) {
      const { children, markDefs } = childrenFromMarkdown(block.slice(3), blockIndex);
      blocks.push({
        _type: "block",
        _key: key("b", blockIndex++),
        style: "h2",
        markDefs,
        children,
      });
      continue;
    }

    if (block.startsWith("- ")) {
      for (const line of block.split("\n").filter((line) => line.startsWith("- "))) {
        const { children, markDefs } = childrenFromMarkdown(line.slice(2), blockIndex);
        blocks.push({
          _type: "block",
          _key: key("b", blockIndex++),
          style: "normal",
          listItem: "bullet",
          level: 1,
          markDefs,
          children,
        });
      }
      continue;
    }

    const { children, markDefs } = childrenFromMarkdown(block, blockIndex);
    blocks.push({
      _type: "block",
      _key: key("b", blockIndex++),
      style: "normal",
      markDefs,
      children,
    });
  }

  return blocks;
}

function toIsoDate(displayDate: string) {
  const parsed = new Date(`${displayDate} 12:00:00 UTC`);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Could not parse date: ${displayDate}`);
  }
  return parsed.toISOString().slice(0, 10);
}

async function uploadImage(imagePath: string) {
  const absolutePath = path.resolve(process.cwd(), "..", "public", imagePath.replace(/^\//, ""));
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Missing image: ${absolutePath}`);
  }

  return client.assets.upload("image", fs.createReadStream(absolutePath), {
    filename: path.basename(absolutePath),
  });
}

async function main() {
  for (const post of posts) {
    const asset = await uploadImage(post.image);
    const doc = {
      _id: `post-${post.slug}`,
      _type: "post",
      title: post.title,
      slug: { _type: "slug", current: post.slug },
      excerpt: post.excerpt,
      category: post.category,
      date: toIsoDate(post.date),
      readTime: post.readTime,
      image: {
        _type: "image",
        asset: { _type: "reference", _ref: asset._id },
      },
      body: toPortableText(post.body),
    };

    await client.createOrReplace(doc);
    console.log(`Imported: ${post.title}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
