import * as v from 'valibot';
import { describeRoute, resolver } from 'hono-openapi';
import { PaginationPageSchema } from '$src/lib/validators';

export const FaqIdentifierParamSchema = v.object({
    identifier: v.pipe(v.string(), v.minLength(1), v.maxLength(255)),
});

export const FaqSearchQuerySchema = v.object({
    q: v.pipe(v.string(), v.minLength(1), v.maxLength(500)),
    page: PaginationPageSchema,
});

const FaqQuestionSchema = v.object({
    id: v.number(),
    categoryId: v.number(),
    question: v.string(),
    answer: v.string(),
    displayOrder: v.nullable(v.number()),
    isPublished: v.boolean(),
});

const FaqCategorySchema = v.object({
    id: v.number(),
    name: v.string(),
    slug: v.string(),
    parentId: v.nullable(v.number()),
    displayOrder: v.nullable(v.number()),
});

export const FaqCategoryWithQuestionsSchema = v.object({
    id: v.number(),
    name: v.string(),
    slug: v.string(),
    parentId: v.nullable(v.number()),
    displayOrder: v.nullable(v.number()),
    questions: v.array(FaqQuestionSchema),
});

export const FaqQuestionWithCategorySchema = v.object({
    id: v.number(),
    question: v.string(),
    answer: v.string(),
    displayOrder: v.nullable(v.number()),
    category: FaqCategorySchema,
});

export const FaqListResponseSchema = v.object({
    data: v.array(FaqCategoryWithQuestionsSchema),
});

export const FaqSingleResponseSchema = v.object({
    data: v.union([FaqCategoryWithQuestionsSchema, FaqQuestionWithCategorySchema]),
});

export const FaqSearchResultSchema = v.object({
    id: v.number(),
    question: v.string(),
    answer: v.string(),
    displayOrder: v.nullable(v.number()),
    category: FaqCategorySchema,
});

export const FaqSearchResponseSchema = v.object({
    data: v.array(FaqSearchResultSchema),
    page: v.number(),
});

export const faqListDocs = describeRoute({
    tags: ['FAQs'],
    summary: 'List FAQs',
    description: 'Returns FAQ categories with nested published questions. Ordered by category and question display order.',
    responses: {
        200: { description: 'OK', content: { 'application/json': { schema: resolver(FaqListResponseSchema) } } },
    },
});

export const faqSingleDocs = describeRoute({
    tags: ['FAQs'],
    summary: 'Get FAQ by category slug or question id',
    description: 'If :identifier is numeric, resolves a published question by id and returns it with parent category. Otherwise resolves category by slug and returns its published questions.',
    responses: {
        200: { description: 'OK', content: { 'application/json': { schema: resolver(FaqSingleResponseSchema) } } },
        404: { description: 'FAQ not found' },
    },
});

export const faqSearchDocs = describeRoute({
    tags: ['FAQs'],
    summary: 'Search FAQ questions',
    description: 'Searches published FAQ questions by question/answer text and returns each match with its parent category.',
    responses: {
        200: { description: 'OK', content: { 'application/json': { schema: resolver(FaqSearchResponseSchema) } } },
    },
});