import type { PostStatus, PostType } from "$src/db/schema/types";

export const TEST_PREFIX = "test-";

// ─── Helpers ────────────────────────────────────────────

const hoursAgo = (h: number) => new Date(Date.now() - h * 60 * 60 * 1000);

// ─── Users ──────────────────────────────────────────────

export const USER_ROLES = ["admin", "editor", "moderator", "user"] as const;

// ─── Posts ──────────────────────────────────────────────

export type PostFixture = {
    authorRole: "admin" | "editor";
    title: string;
    slug: string;
    status: PostStatus;
    type: PostType;
    content: string;
    commentEnabled?: boolean;
    isEditorsPick?: boolean;
    publishedAt?: Date;
};

export const POSTS: PostFixture[] = [
    {
        authorRole: "editor",
        title: "Test Commentable Post",
        slug: `${TEST_PREFIX}comment-post`,
        status: "published",
        type: "article",
        content: "Post with comments",
        commentEnabled: true,
        publishedAt: hoursAgo(24),
    },
    {
        authorRole: "editor",
        title: "Test Comments Disabled",
        slug: `${TEST_PREFIX}no-comments-post`,
        status: "published",
        type: "article",
        content: "Comments disabled",
        commentEnabled: false,
        publishedAt: hoursAgo(20),
    },
    {
        authorRole: "admin",
        title: "Test Draft Post",
        slug: `${TEST_PREFIX}draft-post`,
        status: "draft",
        type: "article",
        content: "Draft content",
    },

    // ── Used by: sort/feed/type filter tests ──
    {
        authorRole: "editor",
        title: "Test News Post",
        slug: `${TEST_PREFIX}news-post`,
        status: "published",
        type: "news",
        content: "News content",
        publishedAt: hoursAgo(2),
    },
    {
        authorRole: "editor",
        title: "Test Podcast Post",
        slug: `${TEST_PREFIX}podcast-post`,
        status: "published",
        type: "podcast",
        content: "Podcast content",
        publishedAt: hoursAgo(10),
    },
    {
        authorRole: "editor",
        title: "Test Popular Article",
        slug: `${TEST_PREFIX}popular-article`,
        status: "published",
        type: "article",
        content: "Popular content",
        publishedAt: hoursAgo(48),
    },
    {
        authorRole: "editor",
        title: "Test Recent Article",
        slug: `${TEST_PREFIX}recent-article`,
        status: "published",
        type: "article",
        content: "Recent content",
        publishedAt: hoursAgo(1),
    },
    {
        authorRole: "editor",
        title: "Test Editors Pick",
        slug: `${TEST_PREFIX}editors-pick`,
        status: "published",
        type: "article",
        content: "Editors pick content",
        isEditorsPick: true,
        publishedAt: hoursAgo(5),
    },
    {
        authorRole: "editor",
        title: "Test Draft Hidden",
        slug: `${TEST_PREFIX}draft-hidden`,
        status: "draft",
        type: "news",
        content: "Draft content",
    },
];

// ─── Comments ───────────────────────────────────────────

export type CommentFixture = {
    key: string;
    postSlug: string;
    authorRole: "user" | "editor";
    content: string;
    status: "approved" | "pending";
    parentKey?: string;
};

export const COMMENTS: CommentFixture[] = [
    {
        key: "byUser",
        postSlug: `${TEST_PREFIX}comment-post`,
        authorRole: "user",
        content: "Approved comment by user",
        status: "approved",
    },
    {
        key: "byEditor",
        postSlug: `${TEST_PREFIX}comment-post`,
        authorRole: "editor",
        content: "Approved comment by editor",
        status: "approved",
    },
    {
        key: "pending",
        postSlug: `${TEST_PREFIX}comment-post`,
        authorRole: "user",
        content: "Pending comment awaiting moderation",
        status: "pending",
    },
    // Replies to editor's comment (for pagination testing)
    ...Array.from({ length: 5 }, (_, i) => ({
        key: `reply-${i}`,
        postSlug: `${TEST_PREFIX}comment-post`,
        authorRole: "user" as const,
        content: `Reply ${i + 1} to editor`,
        status: "approved" as const,
        parentKey: "byEditor",
    })),
];

// ─── Reactions (for sort=popular tests) ─────────────────

export type ReactionFixture = {
    postSlug: string;
    userRole: "user" | "editor" | "admin";
    reaction: "like" | "dislike";
};

export const REACTIONS: ReactionFixture[] = [
    // popular-article gets 3 likes (most liked)
    { postSlug: `${TEST_PREFIX}popular-article`, userRole: "user", reaction: "like" },
    { postSlug: `${TEST_PREFIX}popular-article`, userRole: "editor", reaction: "like" },
    { postSlug: `${TEST_PREFIX}popular-article`, userRole: "admin", reaction: "like" },
    // news-post gets 1 like
    { postSlug: `${TEST_PREFIX}news-post`, userRole: "user", reaction: "like" },
];

// ─── People's Choice Votes (for feed=peoples-choice) ────

export type PeoplesChoiceFixture = {
    postSlug: string;
    userRole: "user" | "editor" | "admin";
};

export const PEOPLES_CHOICE_VOTES: PeoplesChoiceFixture[] = [
    // news-post gets 3 votes (most voted)
    { postSlug: `${TEST_PREFIX}news-post`, userRole: "user" },
    { postSlug: `${TEST_PREFIX}news-post`, userRole: "editor" },
    { postSlug: `${TEST_PREFIX}news-post`, userRole: "admin" },
    // popular-article gets 1 vote
    { postSlug: `${TEST_PREFIX}popular-article`, userRole: "user" },
];

// ─── Interests ──────────────────────────────────────────

export type InterestFixture = {
    userRole: "user" | "editor";
    interest: string;
    isPrimary: boolean;
};

export const INTERESTS: InterestFixture[] = [
    { userRole: "user", interest: "Artificial Intelligence", isPrimary: true },
    { userRole: "user", interest: "Blockchain", isPrimary: false },
    { userRole: "editor", interest: "Neuroscience", isPrimary: true },
];

// ─── Education ──────────────────────────────────────────

export type EducationFixture = {
    userRole: "user" | "editor";
    educationalBackground: string;
};

export const EDUCATION: EducationFixture[] = [
    { userRole: "user", educationalBackground: "MSc Computer Science" },
    { userRole: "user", educationalBackground: "BSc Mathematics" },
    { userRole: "editor", educationalBackground: "PhD Cognitive Science" },
];

// ─── Wallets ────────────────────────────────────────────

export type WalletFixture = {
    userRole: "user";
    publicAddress: string;
};

export const WALLETS: WalletFixture[] = [{ userRole: "user", publicAddress: `${TEST_PREFIX}0xabc123def456` }];

// ─── Friend Requests ────────────────────────────────────

export type FriendRequestFixture = {
    requesterRole: "user" | "editor" | "admin";
    requestedRole: "user" | "editor" | "admin";
    status: "pending" | "accepted" | "rejected";
};

export const FRIEND_REQUESTS: FriendRequestFixture[] = [
    { requesterRole: "editor", requestedRole: "user", status: "pending" },
    { requesterRole: "admin", requestedRole: "user", status: "accepted" },
];

// ─── Follows ────────────────────────────────────────────

export type FollowFixture = {
    followerRole: "user" | "editor" | "admin" | "moderator";
    followingRole: "user" | "editor" | "admin" | "moderator";
    status: "follow" | "block";
};

export const FOLLOWS: FollowFixture[] = [
    // editor and admin follow user (for GET /:username/followers)
    { followerRole: "editor", followingRole: "user", status: "follow" },
    { followerRole: "admin", followingRole: "user", status: "follow" },
    // user follows editor (for GET /:username/following)
    { followerRole: "user", followingRole: "editor", status: "follow" },
    // moderator blocks user (for block/unblock tests)
    { followerRole: "moderator", followingRole: "user", status: "block" },
];
