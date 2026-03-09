import { defineRelations } from "drizzle-orm";
import * as schema from "$src/db/schema";

export const relations = defineRelations(schema, (r) => ({
  // ***************** users *****************
  users: {
    profile: r.one.userProfiles({
      from: r.users.id,
      to: r.userProfiles.userId,
    }),
    preferences: r.one.userPreferences({
      from: r.users.id,
      to: r.userPreferences.userId,
    }),
    notificationSettings: r.one.userNotificationSettings({
      from: r.users.id,
      to: r.userNotificationSettings.userId,
    }),
    socialAuths: r.many.userSocialAuths({
      from: r.users.id,
      to: r.userSocialAuths.userId,
    }),
    refreshTokens: r.many.refreshTokens({
      from: r.users.id,
      to: r.refreshTokens.userId,
    }),
    activationTokens: r.many.activationTokens({
      from: r.users.id,
      to: r.activationTokens.userId,
    }),

    posts: r.many.posts({
      from: r.users.id,
      to: r.posts.authorId,
    }),

    coAuthoredPosts: r.many.posts({
      from: r.users.id.through(r.postAuthors.userId),
      to: r.posts.id.through(r.postAuthors.postId),
    }),

    comments: r.many.comments({
      from: r.users.id,
      to: r.comments.authorId,
    }),
    commentClassifications: r.many.commentClassifications({
      from: r.users.id,
      to: r.commentClassifications.classifiedById,
    }),

    followers: r.many.follows({
      from: r.users.id,
      to: r.follows.followingId,
      alias: "followers",
    }),
    following: r.many.follows({
      from: r.users.id,
      to: r.follows.followerId,
      alias: "following",
    }),
    sentFriendRequests: r.many.friendRequests({
      from: r.users.id,
      to: r.friendRequests.requesterId,
      alias: "sentFriendRequests",
    }),
    receivedFriendRequests: r.many.friendRequests({
      from: r.users.id,
      to: r.friendRequests.requestedId,
      alias: "receivedFriendRequests",
    }),

    postReactions: r.many.postReactions({
      from: r.users.id,
      to: r.postReactions.userId,
    }),
    commentReactions: r.many.commentReactions({
      from: r.users.id,
      to: r.commentReactions.userId,
    }),
    postEmojis: r.many.postEmojis({
      from: r.users.id,
      to: r.postEmojis.userId,
    }),
    bookmarks: r.many.bookmarks({
      from: r.users.id,
      to: r.bookmarks.userId,
    }),
    shares: r.many.shares({
      from: r.users.id,
      to: r.shares.userId,
    }),
    peoplesChoiceVotes: r.many.peoplesChoiceVotes({
      from: r.users.id,
      to: r.peoplesChoiceVotes.userId,
    }),

    interactions: r.many.interactions({
      from: r.users.id,
      to: r.interactions.userId,
    }),
    readingSessions: r.many.readingSessions({
      from: r.users.id,
      to: r.readingSessions.userId,
    }),

    createdPolls: r.many.polls({
      from: r.users.id,
      to: r.polls.createdById, // Extrapolating based on your polls relation
    }),
    pollVotes: r.many.pollVotes({
      from: r.users.id,
      to: r.pollVotes.userId,
    }),

    wallets: r.many.userWallets({
      from: r.users.id,
      to: r.userWallets.userId,
    }),

    interests: r.many.userInterests({
      from: r.users.id,
      to: r.userInterests.userId,
    }),
    education: r.many.userEducation({
      from: r.users.id,
      to: r.userEducation.userId,
    }),

    notifications: r.many.notifications({
      from: r.users.id,
      to: r.notifications.userId,
      alias: "notificationUser",
    }),
  },

  // ***************** comments *****************
  comments: {
    post: r.one.posts({
      from: r.comments.postId,
      to: r.posts.id,
    }),
    author: r.one.users({
      from: r.comments.authorId,
      to: r.users.id,
    }),
    parent: r.one.comments({
      from: r.comments.parentId,
      to: r.comments.id,
      alias: "commentThread",
    }),
    replies: r.many.comments({
      from: r.comments.id,
      to: r.comments.parentId,
      alias: "commentThread",
    }),
    classifications: r.many.commentClassifications({
      from: r.comments.id,
      to: r.commentClassifications.commentId,
    }),
  },
  commentClassifications: {
    comment: r.one.comments({
      from: r.commentClassifications.commentId,
      to: r.comments.id,
    }),
    classifiedBy: r.one.users({
      from: r.commentClassifications.classifiedById,
      to: r.users.id,
    }),
  },

  // ***************** faqs *****************
  faqCategories: {
    parent: r.one.faqCategories({
      from: r.faqCategories.parentId,
      to: r.faqCategories.id,
      alias: "faqCategoryHierarchy",
    }),
    children: r.many.faqCategories({
      from: r.faqCategories.id,
      to: r.faqCategories.parentId,
      alias: "faqCategoryHierarchy",
    }),
    questions: r.many.faqQuestions({
      from: r.faqCategories.id,
      to: r.faqQuestions.categoryId,
    }),
  },
  faqQuestions: {
    category: r.one.faqCategories({
      from: r.faqQuestions.categoryId,
      to: r.faqCategories.id,
    }),
  },

  // ***************** feeds *****************
  contentSources: {
    user: r.one.users({
      from: r.contentSources.userId,
      to: r.users.id,
    }),
  },

  // ***************** mailings *****************
  emailCampaigns: {
    sentBy: r.one.users({
      from: r.emailCampaigns.sentById,
      to: r.users.id,
    }),
    deliveries: r.many.emailDeliveries({
      from: r.emailCampaigns.id,
      to: r.emailDeliveries.campaignId,
    }),
  },
  emailDeliveries: {
    campaign: r.one.emailCampaigns({
      from: r.emailDeliveries.campaignId,
      to: r.emailCampaigns.id,
    }),
  },

  // ***************** notifications *****************
  notifications: {
    user: r.one.users({
      from: r.notifications.userId,
      to: r.users.id,
      alias: "notificationUser",
    }),
    actor: r.one.users({
      from: r.notifications.actorId,
      to: r.users.id,
      alias: "notificationActor",
    }),
  },

  // ***************** polls *****************
  polls: {
    post: r.one.posts({
      from: r.polls.postId,
      to: r.posts.id,
    }),
    createdBy: r.one.users({
      from: r.polls.createdById,
      to: r.users.id,
    }),
    options: r.many.pollOptions({
      from: r.polls.id,
      to: r.pollOptions.pollId,
    }),
    votes: r.many.pollVotes({
      from: r.polls.id,
      to: r.pollVotes.pollId,
    }),
  },
  pollOptions: {
    poll: r.one.polls({
      from: r.pollOptions.pollId,
      to: r.polls.id,
    }),
    votes: r.many.pollVotes({
      from: r.pollOptions.id,
      to: r.pollVotes.optionId,
    }),
  },
  pollVotes: {
    poll: r.one.polls({
      from: r.pollVotes.pollId,
      to: r.polls.id,
    }),
    option: r.one.pollOptions({
      from: r.pollVotes.optionId,
      to: r.pollOptions.id,
    }),
    user: r.one.users({
      from: r.pollVotes.userId,
      to: r.users.id,
    }),
  },

  // ***************** posts *****************
  posts: {
    author: r.one.users({
      from: r.posts.authorId,
      to: r.users.id,
    }),
    stats: r.one.postStats({
      from: r.posts.id,
      to: r.postStats.postId,
    }),

    coAuthors: r.many.users({
      from: r.posts.id.through(r.postAuthors.postId),
      to: r.users.id.through(r.postAuthors.userId),
    }),
    postMedia: r.many.postMedia({
      from: r.posts.id,
      to: r.postMedia.postId,
    }),
    postAuthors: r.many.postAuthors(),
    taxonomies: r.many.taxonomies({
      from: r.posts.id.through(r.postTaxonomies.postId),
      to: r.taxonomies.id.through(r.postTaxonomies.taxonomyId),
    }),
  },
  postMedia: {
    post: r.one.posts({
      from: r.postMedia.postId,
      to: r.posts.id,
    }),
    media: r.one.media({
      from: r.postMedia.mediaId,
      to: r.media.id,
    }),
  },
  postAuthors: {
    post: r.one.posts({
      from: r.postAuthors.postId,
      to: r.posts.id,
    }),
    user: r.one.users({
      from: r.postAuthors.userId,
      to: r.users.id,
    }),
  },
  postStats: {
    post: r.one.posts({
      from: r.postStats.postId,
      to: r.posts.id,
    }),
  },
  // ***************** profiles *****************
  userInterests: {
    user: r.one.users({
      from: r.userInterests.userId,
      to: r.users.id,
    }),
  },
  userEducation: {
    user: r.one.users({
      from: r.userEducation.userId,
      to: r.users.id,
    }),
  },

  // ***************** reputations *****************
  interactions: {
    user: r.one.users({
      from: r.interactions.userId,
      to: r.users.id,
    }),
  },
  postEmojis: {
    post: r.one.posts({
      from: r.postEmojis.postId,
      to: r.posts.id,
    }),
    user: r.one.users({
      from: r.postEmojis.userId,
      to: r.users.id,
    }),
  },
  shares: {
    post: r.one.posts({
      from: r.shares.postId,
      to: r.posts.id,
    }),
    user: r.one.users({
      from: r.shares.userId,
      to: r.users.id,
    }),
  },
  peoplesChoiceVotes: {
    post: r.one.posts({
      from: r.peoplesChoiceVotes.postId,
      to: r.posts.id,
    }),
    user: r.one.users({
      from: r.peoplesChoiceVotes.userId,
      to: r.users.id,
    }),
  },
  readingSessions: {
    post: r.one.posts({
      from: r.readingSessions.postId,
      to: r.posts.id,
    }),
    user: r.one.users({
      from: r.readingSessions.userId,
      to: r.users.id,
    }),
  },

  // ***************** social *****************
  follows: {
    follower: r.one.users({
      from: r.follows.followerId,
      to: r.users.id,
      alias: "followers",
    }),
    following: r.one.users({
      from: r.follows.followingId,
      to: r.users.id,
      alias: "following",
    }),
  },
  friendRequests: {
    requester: r.one.users({
      from: r.friendRequests.requesterId,
      to: r.users.id,
      alias: "sentFriendRequests",
    }),
    requested: r.one.users({
      from: r.friendRequests.requestedId,
      to: r.users.id,
      alias: "receivedFriendRequests",
    }),
  },
  postReactions: {
    post: r.one.posts({
      from: r.postReactions.postId,
      to: r.posts.id,
    }),
    user: r.one.users({
      from: r.postReactions.userId,
      to: r.users.id,
    }),
  },
  commentReactions: {
    comment: r.one.comments({
      from: r.commentReactions.commentId,
      to: r.comments.id,
    }),
    user: r.one.users({
      from: r.commentReactions.userId,
      to: r.users.id,
    }),
  },
  bookmarks: {
    post: r.one.posts({
      from: r.bookmarks.postId,
      to: r.posts.id,
    }),
    user: r.one.users({
      from: r.bookmarks.userId,
      to: r.users.id,
    }),
  },

  // ***************** taxonomies *****************
  taxonomies: {
    parent: r.one.taxonomies({
      from: r.taxonomies.parentId,
      to: r.taxonomies.id,
      alias: "taxonomyHierarchy",
    }),
    children: r.many.taxonomies({
      from: r.taxonomies.id,
      to: r.taxonomies.parentId,
      alias: "taxonomyHierarchy",
    }),
    posts: r.many.posts({
      from: r.taxonomies.id.through(r.postTaxonomies.taxonomyId),
      to: r.posts.id.through(r.postTaxonomies.postId),
    }),
  },
  postTaxonomies: {
    post: r.one.posts({
      from: r.postTaxonomies.postId,
      to: r.posts.id,
    }),
    taxonomy: r.one.taxonomies({
      from: r.postTaxonomies.taxonomyId,
      to: r.taxonomies.id,
    }),
  },

  // ***************** wallets *****************
  userWallets: {
    user: r.one.users({
      from: r.userWallets.userId,
      to: r.users.id,
    }),
  },
}));
