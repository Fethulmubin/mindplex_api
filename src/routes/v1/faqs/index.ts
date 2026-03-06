import { Hono } from 'hono';
import { and, asc, eq, ilike, or } from 'drizzle-orm';
import { validator } from 'hono-openapi';
import type { AppContext } from '$src/types';
import { faqCategories, faqQuestions } from '$src/db/schema';
import {
    faqListDocs,
    faqSearchDocs,
    faqSingleDocs,
    FaqIdentifierParamSchema,
    FaqSearchQuerySchema,
} from './schema';

const app = new Hono<AppContext>();

const SEARCH_PAGE_SIZE = 10;

// GET /faqs
app.get('/', faqListDocs, async (c) => {
    const db = c.get('db');

    const data = await db.query.faqCategories.findMany({
        with: {
            questions: {
                where: { isPublished: true },
                orderBy: (q, { asc }) => [asc(q.displayOrder), asc(q.id)],
            },
        },
        orderBy: (cat, { asc }) => [asc(cat.displayOrder), asc(cat.id)],
    });

    return c.json({ data });
});

// GET /faqs/search?q={query}&page={page}
app.get('/search', faqSearchDocs, validator('query', FaqSearchQuerySchema), async (c) => {
    const db = c.get('db');
    const { q, page } = c.req.valid('query');

    const data = await db
        .select({
            id: faqQuestions.id,
            question: faqQuestions.question,
            answer: faqQuestions.answer,
            displayOrder: faqQuestions.displayOrder,
            category: {
                id: faqCategories.id,
                name: faqCategories.name,
                slug: faqCategories.slug,
                parentId: faqCategories.parentId,
                displayOrder: faqCategories.displayOrder,
            },
        })
        .from(faqQuestions)
        .innerJoin(faqCategories, eq(faqQuestions.categoryId, faqCategories.id))
        .where(
            and(
                eq(faqQuestions.isPublished, true),
                or(
                    ilike(faqQuestions.question, `%${q}%`),
                    ilike(faqQuestions.answer, `%${q}%`),
                ),
            ),
        )
        .orderBy(
            asc(faqCategories.displayOrder),
            asc(faqQuestions.displayOrder),
            asc(faqQuestions.id),
        )
        .limit(SEARCH_PAGE_SIZE)
        .offset((page - 1) * SEARCH_PAGE_SIZE);

    return c.json({ data, page });
});

// GET /faqs/:identifier
app.get('/:identifier', faqSingleDocs, validator('param', FaqIdentifierParamSchema), async (c) => {
    const db = c.get('db');
    const { identifier } = c.req.valid('param');

    if (/^\d+$/.test(identifier)) {
        const data = await db.query.faqQuestions.findFirst({
            where: { id: Number(identifier), isPublished: true },
            with: {
                category: {
                    columns: {
                        id: true,
                        name: true,
                        slug: true,
                        parentId: true,
                        displayOrder: true,
                    },
                },
            },
            columns: {
                id: true,
                question: true,
                answer: true,
                displayOrder: true,
            },
        });

        if (!data) return c.json({ error: 'FAQ not found' }, 404);

        return c.json({ data });
    }

    const data = await db.query.faqCategories.findFirst({
        where: { slug: identifier },
        with: {
            questions: {
                where: { isPublished: true },
                orderBy: (q, { asc }) => [asc(q.displayOrder), asc(q.id)],
            },
        },
    });

    if (!data) return c.json({ error: 'FAQ not found' }, 404);

    return c.json({ data });
});

export default app;