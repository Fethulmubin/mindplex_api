export const ROLE = {
  User: "user",
  Admin: "admin",
  Moderator: "moderator",
  Collaborator: "collaborator",
  Editor: "editor",
} as const;

export const ACCESS = {
  Public: "*",
  ...ROLE,
} as const;

export const ROLE_HIERARCHY = [
  ACCESS.Public,
  ROLE.User,
  ROLE.Collaborator,
  ROLE.Editor,
  ROLE.Moderator,
  ROLE.Admin,
] as const;

export const POST_MEDIA_ROLE = {
  Thumbnail: "thumbnail",
  Banner: "banner",
  Audio: "audio",
  Gallery: "gallery",
  Attachment: "attachment",
} as const;

export const THEME = {
  Light: "light",
  Dark: "dark",
  System: "system",
} as const;

export const PRIVACY_LEVEL = {
  Public: "public",
  Private: "private",
  FollowersOnly: "followersOnly",
} as const;

export const SOCIAL_AUTH_PROVIDER = {
  Google: "google",
  Apple: "apple",
  Facebook: "facebook",
} as const;

export type SocialMedia = {
  twitter?: string;
  linkedin?: string;
  github?: string;
  website?: string;
};

export type SessionMetadata = {
  ip?: string;
  userAgent?: string;
  deviceType?: string;
  location?: string;
};

// --- Content ---
export const POST_STATUS = {
  Draft: "draft",
  Pending: "pending",
  Published: "published",
  Scheduled: "scheduled",
  Archived: "archived",
  Trashed: "trashed",
} as const;

export const POST_TYPE = {
  Article: "article",
  Podcast: "podcast",
  News: "news",
  Video: "video",
  Community: "community",
  Topics: "topics",
  Mindbytes: "mindbytes",
} as const;

// --- Comments ---
export const COMMENT_STATUS = {
  Pending: "pending",
  Approved: "approved",
  Spam: "spam",
  Trashed: "trashed",
} as const;

export const COMMENT_CLASS = {
  Best: "best",
  Good: "good",
  Average: "average",
  HateSpeech: "hate_speech",
  Bullying: "bullying",
  Vulgar: "vulgar",
  Spamming: "spamming",
  Expedient: "expedient",
  PeoplesChoice: "peoples_choice",
} as const;

export const SENTIMENT = {
  Positive: "positive",
  Negative: "negative",
  Neutral: "neutral",
  Expedient: "expedient",
  PeoplesChoice: "peoples_choice",
} as const;

// --- Social ---
export const REACTION_TYPE = {
  Like: "like",
  Dislike: "dislike",
} as const;

export const EMOJI_SENTIMENT = {
  Positive: "positive",
  Negative: "negative",
} as const;

export const FOLLOW_STATUS = {
  Follow: "follow",
  Block: "block",
} as const;

export const FRIEND_REQUEST_STATUS = {
  Pending: "pending",
  Accepted: "accepted",
  Rejected: "rejected",
  Blocked: "blocked",
} as const;

// --- Notifications ---
export const NOTIFICATION_STATUS = {
  Unread: "unread",
  Read: "read",
  Dismissed: "dismissed",
} as const;

// --- Polls ---
export const POLL_TYPE = {
  SingleChoice: "single_choice",
  MultipleChoice: "multiple_choice",
} as const;

export type PollType = (typeof POLL_TYPE)[keyof typeof POLL_TYPE];

export type PollStyles = {
  theme?: string;
  customCss?: string;
  showTitle?: boolean;
};

// --- Taxonomy ---
export const TAXONOMY_TYPE = {
  Category: "category",
  Tag: "tag",
  Topic: "topic",
} as const;

// --- Mailing ---
export const EMAIL_DELIVERY_STATUS = {
  Pending: "pending",
  Sent: "sent",
  Delivered: "delivered",
  Bounced: "bounced",
  Failed: "failed",
} as const;

export type Role = (typeof ROLE)[keyof typeof ROLE];
export type Access = (typeof ACCESS)[keyof typeof ACCESS];

export type PostMediaRole = (typeof POST_MEDIA_ROLE)[keyof typeof POST_MEDIA_ROLE];

export type Theme = (typeof THEME)[keyof typeof THEME];
export type PrivacyLevel = (typeof PRIVACY_LEVEL)[keyof typeof PRIVACY_LEVEL];
export type SocialAuthProvider = (typeof SOCIAL_AUTH_PROVIDER)[keyof typeof SOCIAL_AUTH_PROVIDER];

export type PostStatus = (typeof POST_STATUS)[keyof typeof POST_STATUS];
export type PostType = (typeof POST_TYPE)[keyof typeof POST_TYPE];

export type CommentClass = (typeof COMMENT_CLASS)[keyof typeof COMMENT_CLASS];
export type CommentStatus = (typeof COMMENT_STATUS)[keyof typeof COMMENT_STATUS];
export type Sentiment = (typeof SENTIMENT)[keyof typeof SENTIMENT];

export type ReactionType = (typeof REACTION_TYPE)[keyof typeof REACTION_TYPE];
export type EmojiSentiment = (typeof EMOJI_SENTIMENT)[keyof typeof EMOJI_SENTIMENT];
export type FollowStatus = (typeof FOLLOW_STATUS)[keyof typeof FOLLOW_STATUS];
export type FriendRequestStatus = (typeof FRIEND_REQUEST_STATUS)[keyof typeof FRIEND_REQUEST_STATUS];

export type NotificationStatus = (typeof NOTIFICATION_STATUS)[keyof typeof NOTIFICATION_STATUS];
export type TaxonomyType = (typeof TAXONOMY_TYPE)[keyof typeof TAXONOMY_TYPE];
export type EmailDeliveryStatus = (typeof EMAIL_DELIVERY_STATUS)[keyof typeof EMAIL_DELIVERY_STATUS];
