# FAQs: List, Single & Search — Implementation Guide

This guide documents how the new FAQ endpoints are implemented in this codebase.

## Target Endpoints

- `GET /api/v1/faqs`
- `GET /api/v1/faqs/:slug`
- `GET /api/v1/faqs/search?q={query}&page={page}`

In the current server structure, routes are mounted under `app.route('/v1', v1Router)`, so the local path is `/v1/faqs/*` (often exposed as `/api/v1/faqs/*` via gateway/proxy).

## Legacy Endpoints Replaced

- `GET /mp_gl/v1/faqs/list` → `GET /api/v1/faqs`
- `GET /mp_gl/v1/faqs/question/{slug}` → `GET /api/v1/faqs/:slug`
- `GET /mp_gl/v1/faqs/search/{page}?query={query}` → `GET /api/v1/faqs/search?q={query}&page={page}`

## Step-by-Step Implementation

### 1) Add FAQ route module

Create:

- `src/routes/v1/faqs/index.ts`
- `src/routes/v1/faqs/schema.ts`

This matches the existing pattern used by `posts` and `comments` route groups.

### 2) Define validation schemas and OpenAPI docs

In `src/routes/v1/faqs/schema.ts`:

- `FaqIdentifierParamSchema` validates `:identifier` for single endpoint.
- `FaqSearchQuerySchema` validates `q` and `page` for search endpoint.
- Response schemas are defined for list, single, and search responses.
- `describeRoute(...)` docs are exported as:
  - `faqListDocs`
  - `faqSingleDocs`
  - `faqSearchDocs`

### 3) Implement public route handlers (no auth)

In `src/routes/v1/faqs/index.ts`, all three handlers are public (no `guard(...)`):

#### A. `GET /faqs`

- Query `faqCategories` with nested `questions` relation.
- Filter nested questions with `isPublished = true`.
- Order categories by `displayOrder` (with deterministic `id` tie-breaker).
- Order questions by `displayOrder` (with deterministic `id` tie-breaker).

#### B. `GET /faqs/:identifier`

Decision made and documented:

- If `:identifier` is numeric, resolve as `faqQuestions.id` (published only), and include parent category.
- Otherwise, resolve as `faqCategories.slug`, and return category with nested published questions.

Why this decision:

- Current schema has `faqCategories.slug`, but `faqQuestions` does not have a slug column.
- This supports both legacy-style single question fetch and category slug fetch through one endpoint.

Not found behavior:

- Return `404` with `{ error: 'FAQ not found' }` when no record matches.

#### C. `GET /faqs/search?q={query}&page={page}`

- Use SQL `ilike` on both:
  - `faqQuestions.question`
  - `faqQuestions.answer`
- Only return published questions (`isPublished = true`).
- Join parent category and return it with each match.
- Paginate using `page` with fixed page size of `10`.

### 4) Register routes in V1 router

Update `src/routes/v1/index.ts`:

- Import FAQ module.
- Mount with `v1.route('/faqs', faq)`.

### 5) Verify behavior

Run and test:

- `GET /v1/faqs`
- `GET /v1/faqs/{category-slug}`
- `GET /v1/faqs/{question-id}`
- `GET /v1/faqs/search?q=token&page=1`

Expected:

- All endpoints are public.
- List and single category results only include published questions.
- Search returns question hits with parent category information.
- Missing record on single endpoint returns `404`.
