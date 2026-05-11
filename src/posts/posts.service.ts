import { Injectable, NotFoundException } from '@nestjs/common';
import { PostsRepository } from './posts.repository';
import { PostLikesRepository } from '../post-likes/post-likes.repository';
import { CreatePostDto, UpdatePostDto } from '../dto/postsDTO/create-post.dto';
import { OutputPostType } from '../types/post/output';

@Injectable()
export class PostsService {
  constructor(
    private readonly postsRepository: PostsRepository,
    private readonly postLikesRepository: PostLikesRepository,
  ) {}

  async getAllPosts(query: any, userId?: string) {
    return this.postsRepository.getPosts(query, userId);
  }

  async getPostById(
    id: string,
    userId?: string,
  ): Promise<OutputPostType | null> {
    return this.postsRepository.getPostById(id, userId);
  }

  async createPost(createPostDto: CreatePostDto): Promise<OutputPostType> {
    return this.postsRepository.createPost(createPostDto);
  }

  async updatePost(id: string, updatePostDto: UpdatePostDto): Promise<boolean> {
    return this.postsRepository.updatePost(id, updatePostDto);
  }

  async deletePost(id: string): Promise<boolean> {
    return this.postsRepository.deletePost(id);
  }

  async getBlogPosts(blogId: string, query: any, userId?: string) {
    return this.postsRepository.getBlogPosts(blogId, query, userId);
  }

  async createPostForBlog(
    blogId: string,
    postData: CreatePostDto,
  ): Promise<OutputPostType> {
    return this.postsRepository.createPostForBlog(blogId, postData);
  }

  async setPostLikeStatus(
    postId: string,
    userId: string,
    likeStatus: 'Like' | 'Dislike' | 'None',
  ): Promise<void> {
    const post = await this.postsRepository.getPostById(postId);
    if (!post) {
      throw new NotFoundException();
    }
    if (likeStatus === 'None') {
      await this.postLikesRepository.removeLike(postId, userId);
    } else {
      await this.postLikesRepository.setLike(postId, userId, likeStatus);
    }
  }
}
