import { defineCollection, z } from 'astro:content';

const articles = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    kind: z.enum(['author', 'genre']).default('author'),
    author: z.string(),
    description: z.string(),
    published_at: z.coerce.date(),
    updated_at: z.coerce.date(),
    tags: z.array(z.string()).default([]),
    sources: z.array(
      z.object({
        title: z.string(),
        url: z.string().url(),
        siteName: z.string().optional(),
      })
    ),
    books: z.array(
      z.object({
        title: z.string(),
        count: z.number(),
        asin: z.string().optional(),
        amazonUrl: z.string().url().optional(),
        imageUrl: z.string().url().optional(),
        price: z.string().optional(),
        author: z.string().optional(),
      })
    ),
  }),
});

export const collections = { articles };
