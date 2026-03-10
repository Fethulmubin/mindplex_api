import { Hono } from 'hono';
import { validator } from 'hono-openapi';
import type { AppContext, IncludeConfig } from '$src/types';
import { ACCESS } from '$src/db/schema';
import { faqCategories, faqQuestions } from '$src/db/schema';
import {
    FAQ_CATEGORY_FORBIDDEN,
    FAQ_QUESTION_FORBIDDEN,
    faqCategorySingleDocs,
    faqListDocs,
    faqQuestionSingleDocs,
    faqSearchDocs,
    FaqCategorySingleQuerySchema,
    FaqCategorySlugParamSchema,
    FaqListQuerySchema,
    FaqQuestionIdParamSchema,
    FaqQuestionSingleQuerySchema,
    FaqSearchQuerySchema,
} from './schema';
import { buildFieldSelection, buildRelationalWith } from '$src/utils';

const app = new Hono<AppContext>();

const FAQ_CATEGORY_RELATIONS: Record<string, IncludeConfig<'faqCategories'>> = {
    questions: {
        requiredRole: ACCESS.Public,
        drizzleWith: {
            questions: {
                columns: {
                    id: true,
                    categoryId: true,
                    question: true,
                    answer: true,
                    displayOrder: true,
                    isPublished: true,
                },
                where: { isPublished: true },
                orderBy: (q, { asc }) => [asc(q.displayOrder), asc(q.id)],
            },
        },
    },
};

const FAQ_QUESTION_RELATIONS: Record<string, IncludeConfig<'faqQuestions'>> = {
    category: {
        requiredRole: ACCESS.Public,
        drizzleWith: {
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
    },
};

// GET /faqs
app.get('/', faqListDocs, validator('query', FaqListQuerySchema), async (c) => {
    const db = c.get('db');
    const { fields, include = [] } = c.req.valid('query');

    const selection = buildFieldSelection(faqCategories, fields, FAQ_CATEGORY_FORBIDDEN, { id: true });
    const relationalWith = buildRelationalWith(include, FAQ_CATEGORY_RELATIONS, ACCESS.Public);

    const data = await db.query.faqCategories.findMany({
        columns: selection,
        with: relationalWith,
        orderBy: (cat, { asc }) => [asc(cat.displayOrder), asc(cat.id)],
    });

    return c.json({ data });
});

// GET /faqs/search?q={query}&page={page}
app.get('/search', faqSearchDocs, validator('query', FaqSearchQuerySchema), async (c) => {
    const db = c.get('db');
    const { q, page, limit, fields, include = [] } = c.req.valid('query');
    const escapedQuery = q.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');

    const questionSelection = buildFieldSelection(faqQuestions, fields, FAQ_QUESTION_FORBIDDEN, {
        id: true,
    });
    const relationalWith = buildRelationalWith(include, FAQ_QUESTION_RELATIONS, ACCESS.Public);

    const data = await db.query.faqQuestions.findMany({
        where: {
            isPublished: true,
            OR: [
                { question: { ilike: `%${escapedQuery}%` } },
                { answer: { ilike: `%${escapedQuery}%` } },
            ],
        },
        columns: questionSelection,
        with: relationalWith,
        orderBy: (question, { asc }) => [asc(question.displayOrder), asc(question.id)],
        limit,
        offset: (page - 1) * limit,
    });

    return c.json({ data, page });
});

// GET /faqs/categories/:slug
app.get(
    '/categories/:slug',
    faqCategorySingleDocs,
    validator('param', FaqCategorySlugParamSchema),
    validator('query', FaqCategorySingleQuerySchema),
    async (c) => {
    const db = c.get('db');
    const { slug } = c.req.valid('param');
    const { fields, include = [] } = c.req.valid('query');

    const categorySelection = buildFieldSelection(faqCategories, fields, FAQ_CATEGORY_FORBIDDEN, {
        id: true,
    });
    const relationalWith = buildRelationalWith(include, FAQ_CATEGORY_RELATIONS, ACCESS.Public);

    const data = await db.query.faqCategories.findFirst({
        where: { slug },
        columns: categorySelection,
        with: relationalWith,
    });

    if (!data) return c.json({ error: 'FAQ category not found' }, 404);

    return c.json({ data });
    },
);

// GET /faqs/questions/:id
app.get(
    '/questions/:id',
    faqQuestionSingleDocs,
    validator('param', FaqQuestionIdParamSchema),
    validator('query', FaqQuestionSingleQuerySchema),
    async (c) => {
    const db = c.get('db');
    const { id } = c.req.valid('param');
    const { fields, include = [] } = c.req.valid('query');

    const questionSelection = buildFieldSelection(faqQuestions, fields, FAQ_QUESTION_FORBIDDEN, {
        id: true,
    });
    const relationalWith = buildRelationalWith(include, FAQ_QUESTION_RELATIONS, ACCESS.Public);

    const data = await db.query.faqQuestions.findFirst({
        where: { id, isPublished: true },
        columns: questionSelection,
        with: relationalWith,
    });

    if (!data) return c.json({ error: 'FAQ question not found' }, 404);

    return c.json({ data });
    },
);

export default app;