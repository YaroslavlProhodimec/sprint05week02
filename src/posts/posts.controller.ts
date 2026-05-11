import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { OutputPostType } from '../types/post/output';
import { PostsService } from './posts.service';
import { OptionalJwtGuard } from '../auth/guards/optional-jwt.guard';

@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Get()
  @UseGuards(OptionalJwtGuard)
  async getPosts(
    @Query() query: any,
    @Req() req: { user?: { userId: string } },
  ) {
    try {
      const userId = req.user?.userId;
      return await this.postsService.getAllPosts(query, userId);
    } catch {
      throw new BadRequestException('Failed to get posts');
    }
  }

  @Get(':id')
  @UseGuards(OptionalJwtGuard)
  async getPost(
    @Param('id') id: string,
    @Req() req: { user?: { userId: string } },
  ): Promise<OutputPostType> {
    const userId = req.user?.userId;
    const post = await this.postsService.getPostById(id, userId);
    if (!post) {
      throw new NotFoundException(`Post with ID ${id} not found`);
    }
    return post;
  }
}
