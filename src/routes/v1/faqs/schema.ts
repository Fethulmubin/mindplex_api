import * as v from 'valibot';
import { describeRoute, resolver } from 'hono-openapi';
import { faqCategories, faqQuestions } from '$src/db/schema';
import { PaginationLimitSchema, PaginationPageSchema } from '$src/lib/validators';
import { createFieldsSchema, createIncludesSchema, getAllowedFields } from '$src/utils';

export const FAQ_CATEGORY_FORBIDDEN = new Set<string>(['createdAt', 'updatedAt']);
export const FAQ_QUESTION_FORBIDDEN = new Set<string>(['createdAt', 'updatedAt']);
export const FAQ_CATEGORY_INCLUDES = ['questions'];
export const FAQ_QUESTION_INCLUDES = ['category'];
export const FAQ_SINGLE_INCLUDES = ['category', 'questions'];
const FAQ_SINGLE_ALLOWED_FIELDS = new Set<string>([
    ...getAllowedFields(faqCategories, FAQ_CATEGORY_FORBIDDEN),
    ...getAllowedFields(faqQuestions, FAQ_QUESTION_FORBIDDEN),
]);

export const FaqIdentifierParamSchema = v.object({
    identifier: v.pipe(v.string(), v.minLength(1), v.maxLength(255)),
});

export const FaqListQuerySchema = v.object({
    fields: createFieldsSchema(faqCategories, FAQ_CATEGORY_FORBIDDEN),
    include: createIncludesSchema(FAQ_CATEGORY_INCLUDES),
});

export const FaqSingleQuerySchema = v.object({
    fields: v.optional(
        v.pipe(
            v.string(),
            v.check(
                (input) => {
                    if (!input) return true;

                    return input
                        .split(',')
                        .map((field) => field.trim())
                        .every((field) => FAQ_SINGLE_ALLOWED_FIELDS.has(field));
                },
                `Invalid field(s). Allowed: ${Array.from(FAQ_SINGLE_ALLOWED_FIELDS).join(', ')}`,
            ),
        ),
    ),
    include: createIncludesSchema(FAQ_SINGLE_INCLUDES),
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

export const FaqSingleResponseSchema = v.object({
    data: v.union([FaqCategoryWithQuestionsSchema, FaqQuestionWithCategorySchema]),
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

export const faqSingleDocs = describeRoute({
    tags: ['FAQs'],
    summary: 'Get FAQ by category slug or question id',
    description: `If :identifier is numeric, resolves a published question by id. Otherwise resolves category by slug. Includes: ${FAQ_SINGLE_INCLUDES.join(', ')}. Fields: ${Array.from(FAQ_SINGLE_ALLOWED_FIELDS).join(', ')}`,
    responses: {
        200: { description: 'OK', content: { 'application/json': { schema: resolver(FaqSingleResponseSchema) } } },
        404: { description: 'FAQ not found' },
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