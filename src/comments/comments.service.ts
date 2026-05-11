import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { CommentsRepository } from './comments.repository';
import { PostsRepository } from '../posts/posts.repository';
import { UsersRepository } from '../users/users-sql.repository';

@Injectable()
export class CommentsService {
  constructor(
    private readonly commentsRepository: CommentsRepository,
    private readonly postsRepository: PostsRepository,
    private readonly usersRepository: UsersRepository,
  ) {}

  async createComment(postId: string, content: string, userId: string) {
    const post = await this.postsRepository.getPostById(postId);
    if (!post) {
      throw new NotFoundException();
    }

    const userLogin = await this.usersRepository.getLoginByUserId(userId);
    if (!userLogin) {
      throw new NotFoundException('User not found');
    }

    return this.commentsRepository.createComment(
      postId,
      content,
      userId,
      userLogin,
    );
  }

  async getCommentById(id: string, userId?: string) {
    return this.commentsRepository.getCommentById(id, userId);
  }

  async getCommentsByPostId(postId: string, query: any, userId?: string) {
    const post = await this.postsRepository.getPostById(postId);
    if (!post) {
      throw new NotFoundException();
    }
    return this.commentsRepository.getCommentsByPostId(postId, query, userId);
  }

  async updateComment(commentId: string, content: string, userId: string) {
    const comment = await this.commentsRepository.findCommentByIdRaw(commentId);
    if (!comment) {
      throw new NotFoundException();
    }
    if (comment.commentatorInfo.userId !== userId) {
      throw new ForbiddenException();
    }
    await this.commentsRepository.updateComment(commentId, content);
  }

  async deleteComment(commentId: string, userId: string) {
    const comment = await this.commentsRepository.findCommentByIdRaw(commentId);
    if (!comment) {
      throw new NotFoundException();
    }
    if (comment.commentatorInfo.userId !== userId) {
      throw new ForbiddenException();
    }
    await this.commentsRepository.deleteComment(commentId);
  }

  async setCommentLikeStatus(
    commentId: string,
    userId: string,
    likeStatus: 'Like' | 'Dislike' | 'None',
  ) {
    const comment = await this.commentsRepository.findCommentByIdRaw(commentId);
    if (!comment) {
      throw new NotFoundException();
    }
    if (likeStatus === 'None') {
      await this.commentsRepository.removeLike(commentId, userId);
    } else {
      await this.commentsRepository.setLike(commentId, userId, likeStatus);
    }
  }
}
