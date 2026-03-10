import * as v from 'valibot';
import { describeRoute, resolver } from 'hono-openapi';
import { faqCategories, faqQuestions } from '$src/db/schema';
import { PaginationLimitSchema, PaginationPageSchema } from '$src/lib/validators';
import { createFieldsSchema, createIncludesSchema, getAllowedFields } from '$src/utils';

export const FAQ_CATEGORY_FORBIDDEN = new Set<string>(['createdAt', 'updatedAt']);
export const FAQ_QUESTION_FORBIDDEN = new Set<string>(['createdAt', 'updatedAt']);
export const FAQ_CATEGORY_INCLUDES = ['questions'];
export const FAQ_QUESTION_INCLUDES = ['category'];

export const FaqCategorySlugParamSchema = v.object({
    slug: v.pipe(v.string(), v.minLength(1), v.maxLength(255)),
});

export const FaqQuestionIdParamSchema = v.object({
    id: v.pipe(v.string(), v.transform(Number), v.integer(), v.minValue(1)),
});

export const FaqListQuerySchema = v.object({
    fields: createFieldsSchema(faqCategories, FAQ_CATEGORY_FORBIDDEN),
    include: createIncludesSchema(FAQ_CATEGORY_INCLUDES),
});

export const FaqCategorySingleQuerySchema = v.object({
    fields: createFieldsSchema(faqCategories, FAQ_CATEGORY_FORBIDDEN),
    include: createIncludesSchema(FAQ_CATEGORY_INCLUDES),
});

export const FaqQuestionSingleQuerySchema = v.object({
    fields: createFieldsSchema(faqQuestions, FAQ_QUESTION_FORBIDDEN),
    include: createIncludesSchema(FAQ_QUESTION_INCLUDES),
});

export const FaqSearchQuerySchema = v.object({
    q: v.pipe(v.string(), v.minLength(1), v.maxLength(500)),
    page: PaginationPageSchema,
    limit: PaginationLimitSchema,
    fields: createFieldsSchema(faqQuestions, FAQ_QUESTION_FORBIDDEN),
    include: createIncludesSchema(FAQ_QUESTION_INCLUDES),
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
    name: v.optional(v.string()),
    slug: v.optional(v.string()),
    parentId: v.optional(v.nullable(v.number())),
    displayOrder: v.optional(v.nullable(v.number())),
});

export const FaqCategoryWithQuestionsSchema = v.object({
    id: v.number(),
    name: v.string(),
    slug: v.string(),
    parentId: v.nullable(v.number()),
    displayOrder: v.nullable(v.number()),
    questions: v.optional(v.array(FaqQuestionSchema)),
});

export const FaqQuestionWithCategorySchema = v.object({
    id: v.number(),
    question: v.optional(v.string()),
    answer: v.optional(v.string()),
    displayOrder: v.optional(v.nullable(v.number())),
    categoryId: v.optional(v.number()),
    isPublished: v.optional(v.boolean()),
    category: v.optional(FaqCategorySchema),
});

export const FaqListResponseSchema = v.object({
    data: v.array(FaqCategoryWithQuestionsSchema),
});

export const FaqCategorySingleResponseSchema = v.object({
    data: FaqCategoryWithQuestionsSchema,
});

export const FaqQuestionSingleResponseSchema = v.object({
    data: FaqQuestionWithCategorySchema,
});

export const FaqSearchResultSchema = v.object({
    id: v.number(),
    question: v.optional(v.string()),
    answer: v.optional(v.string()),
    displayOrder: v.optional(v.nullable(v.number())),
    categoryId: v.optional(v.number()),
    isPublished: v.optional(v.boolean()),
    category: v.optional(FaqCategorySchema),
});

export const FaqSearchResponseSchema = v.object({
    data: v.array(FaqSearchResultSchema),
    page: v.number(),
});

export const faqListDocs = describeRoute({
    tags: ['FAQs'],
    summary: 'List FAQs',
    description: `Returns FAQ categories ordered by display order. Includes: ${FAQ_CATEGORY_INCLUDES.join(', ')}. Fields: ${getAllowedFields(faqCategories, FAQ_CATEGORY_FORBIDDEN).join(', ')}`,
    responses: {
        200: { description: 'OK', content: { 'application/json': { schema: resolver(FaqListResponseSchema) } } },
    },
});

export const faqCategorySingleDocs = describeRoute({
    tags: ['FAQs'],
    summary: 'Get FAQ category by slug',
    description: `Gets a FAQ category by slug. Includes: ${FAQ_CATEGORY_INCLUDES.join(', ')}. Fields: ${getAllowedFields(faqCategories, FAQ_CATEGORY_FORBIDDEN).join(', ')}`,
    responses: {
        200: {
            description: 'OK',
            content: { 'application/json': { schema: resolver(FaqCategorySingleResponseSchema) } },
        },
        404: { description: 'FAQ category not found' },
    },
});

export const faqQuestionSingleDocs = describeRoute({
    tags: ['FAQs'],
    summary: 'Get FAQ question by id',
    description: `Gets a published FAQ question by id. Includes: ${FAQ_QUESTION_INCLUDES.join(', ')}. Fields: ${getAllowedFields(faqQuestions, FAQ_QUESTION_FORBIDDEN).join(', ')}`,
    responses: {
        200: {
            description: 'OK',
            content: { 'application/json': { schema: resolver(FaqQuestionSingleResponseSchema) } },
        },
        404: { description: 'FAQ question not found' },
    },
});

export const faqSearchDocs = describeRoute({
    tags: ['FAQs'],
    summary: 'Search FAQ questions',
    description: `Searches published FAQ questions by question/answer text. Includes: ${FAQ_QUESTION_INCLUDES.join(', ')}. Fields: ${getAllowedFields(faqQuestions, FAQ_QUESTION_FORBIDDEN).join(', ')}`,
    responses: {
        200: { description: 'OK', content: { 'application/json': { schema: resolver(FaqSearchResponseSchema) } } },
    },
});