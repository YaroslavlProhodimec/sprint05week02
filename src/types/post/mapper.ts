export type ExtendedLikesInfo = {
  likesCount: number;
  dislikesCount: number;
  myStatus: 'Like' | 'Dislike' | 'None';
  newestLikes: Array<{ addedAt: string; userId: string; login: string }>;
};

export async function postMapper(post: any, _userId?: string) {
  const postId = post.id ?? post._id?.toString?.() ?? '';

  const rawCreatedAt = post.createdAt;
  const createdAt =
    rawCreatedAt instanceof Date
      ? rawCreatedAt.toISOString()
      : typeof rawCreatedAt === 'string'
        ? rawCreatedAt
        : String(rawCreatedAt ?? '');

  const extendedLikesInfo: ExtendedLikesInfo = {
    likesCount: 0,
    dislikesCount: 0,
    myStatus: 'None',
    newestLikes: [],
  };

  return {
    id: postId,
    title: post.title,
    shortDescription: post.shortDescription,
    content: post.content,
    blogId: post.blogId,
    blogName: post.blogName,
    createdAt,
    extendedLikesInfo,
  };
}
