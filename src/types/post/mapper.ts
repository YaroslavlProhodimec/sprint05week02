import type { PostLikesRepository } from '../../post-likes/post-likes.repository';
import type { UsersRepository } from '../../users/users-sql.repository';

export type ExtendedLikesInfo = {
  likesCount: number;
  dislikesCount: number;
  myStatus: 'Like' | 'Dislike' | 'None';
  newestLikes: Array<{ addedAt: string; userId: string; login: string }>;
};

export interface PostMapperDeps {
  postLikesRepository: PostLikesRepository;
  usersRepository: UsersRepository;
}

export async function postMapper(
  post: any,
  userId: string | undefined,
  deps?: PostMapperDeps,
) {
  const postId = post.id ?? post._id?.toString?.() ?? '';

  const rawCreatedAt = post.createdAt;
  const createdAt =
    rawCreatedAt instanceof Date
      ? rawCreatedAt.toISOString()
      : typeof rawCreatedAt === 'string'
        ? rawCreatedAt
        : String(rawCreatedAt ?? '');

  let extendedLikesInfo: ExtendedLikesInfo = {
    likesCount: 0,
    dislikesCount: 0,
    myStatus: 'None',
    newestLikes: [],
  };

  if (deps) {
    const [likesCount, dislikesCount] = await Promise.all([
      deps.postLikesRepository.countByPostAndStatus(postId, 'Like'),
      deps.postLikesRepository.countByPostAndStatus(postId, 'Dislike'),
    ]);

    let myStatus: 'Like' | 'Dislike' | 'None' = 'None';
    if (userId) {
      const status = await deps.postLikesRepository.findMyStatus(postId, userId);
      if (status) myStatus = status;
    }

    const newestLikesRaw = await deps.postLikesRepository.findNewestLikes(postId, 3);
    const newestLikes = await Promise.all(
      newestLikesRaw.map(async (like) => {
        const login = await deps.usersRepository.getLoginByUserId(like.userId);
        return {
          addedAt:
            like.addedAt instanceof Date
              ? like.addedAt.toISOString()
              : String(like.addedAt),
          userId: like.userId,
          login: login ?? 'unknown',
        };
      }),
    );

    extendedLikesInfo = { likesCount, dislikesCount, myStatus, newestLikes };
  }

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
