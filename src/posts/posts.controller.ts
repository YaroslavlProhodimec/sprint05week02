import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { OutputPostType } from '../types/post/output';
import { PostsService } from './posts.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtGuard } from '../auth/guards/optional-jwt.guard';
import { UserId } from '../auth/decorators/user-id.decorator';
import { LikeStatusDto } from '../dto/postsDTO/like-status.dto';

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

  @Put(':postId/like-status')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async setPostLikeStatus(
    @Param('postId') postId: string,
    @Body() dto: LikeStatusDto,
    @UserId() userId: string,
  ): Promise<void> {
    await this.postsService.setPostLikeStatus(postId, userId, dto.likeStatus);
  }
}
