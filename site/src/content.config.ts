// The content collections of the site (P1-A4; SPEC.md 7.3; CONTRACTS.md 7). Astro 7 content layer:
// each collection reads its MDX files with the glob loader; an entry's id is its file name without
// the extension (`m0-start`, `glossary`). Both schemas are strict, so a frontmatter field the schema
// does not know fails the build, as does a value of the wrong type or a source key that SOURCES.md
// does not define (the message names the key).
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { hasKey } from './lib/sources';

const OUTCOMES = ['LO1', 'LO2', 'LO3', 'LO4', 'LO5', 'LO6', 'LO7', 'LO8', 'LO9', 'LO10'] as const;

/** Every key must be defined in SOURCES.md; an unknown one fails the build with its name. */
const sourceKeys = z.array(z.string()).superRefine((list, ctx) => {
  for (const k of list) {
    if (!hasKey(k)) ctx.addIssue({ code: 'custom', message: `unknown source key "${k}": it is not defined in SOURCES.md as **[${k}]**` });
  }
});

/** The frontmatter of a lesson (CONTRACTS.md 7). */
export const moduleSchema = z.strictObject({
  title: z.string().min(1),
  module: z.number().int().min(0).max(10),
  question: z.string().min(1),
  phase: z.number().int().min(1).max(6),
  released: z.boolean(),
  // D17: a lesson stays a draft until the owner approves it.
  draft: z.boolean().default(true),
  outcomes: z.array(z.enum(OUTCOMES)),
  sources: sourceKeys,
});

/** The frontmatter of a page other than a lesson or a tool (plan). */
export const pageSchema = z.strictObject({
  title: z.string().min(1),
  phase: z.number().int().min(0).max(7),
  released: z.boolean(),
  description: z.string().optional(),
  // 'dependencies': Page.astro renders the generated table of dependencies after the content.
  generated: z.literal('dependencies').optional(),
});

const modules = defineCollection({
  loader: glob({ pattern: '*.mdx', base: './src/content/modules' }),
  schema: moduleSchema,
});

const pages = defineCollection({
  loader: glob({ pattern: '*.mdx', base: './src/content/pages' }),
  schema: pageSchema,
});

export const collections = { modules, pages };
