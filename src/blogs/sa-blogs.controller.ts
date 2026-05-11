import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
  forwardRef,
} from '@nestjs/common';
import { SortDataType } from '../types/blog/input';
import { BlogType } from '../types/blog/output';
import { BlogsService } from './blog.service';
import { PostsService } from '../posts/posts.service';
import { CreateBlogDto, UpdateBlogDto } from '../dto/blogsDTO/create-blog.dto';
import { CreatePostForBlogDto } from '../dto/postsDTO/create-post-for-blog.dto';
import { BasicAuthGuard } from '../auth/guards/basic-auth.guard';

@Controller('sa/blogs')
@UseGuards(BasicAuthGuard)
export class SaBlogsController {
  constructor(
    private readonly blogsService: BlogsService,
    @Inject(forwardRef(() => PostsService))
    private readonly postsService: PostsService,
  ) {}

  @Get()
  async getBlogs(@Query() query: SortDataType) {
    return this.blogsService.getAllBlogs(query);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createBlog(@Body() dto: CreateBlogDto): Promise<BlogType> {
    return this.blogsService.createBlog(dto);
  }

  @Put(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async updateBlog(
    @Param('id') id: string,
    @Body() dto: UpdateBlogDto,
  ): Promise<void> {
    const updated = await this.blogsService.updateBlog(id, dto);
    if (!updated) {
      throw new NotFoundException(`Blog with ID ${id} not found`);
    }
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteBlog(@Param('id') id: string): Promise<void> {
    const deleted = await this.blogsService.deleteBlog(id);
    if (!deleted) {
      throw new NotFoundException(`Blog with ID ${id} not found`);
    }
  }

  @Get(':blogId/posts')
  async getBlogPosts(
    @Param('blogId') blogId: string,
    @Query() query: any,
  ) {
    const blog = await this.blogsService.getBlogById(blogId);
    if (!blog) {
      throw new NotFoundException(`Blog with ID ${blogId} not found`);
    }
    return this.blogsService.getPostsByBlogId(blogId, query);
  }

  @Post(':blogId/posts')
  @HttpCode(HttpStatus.CREATED)
  async createPostForBlog(
    @Param('blogId') blogId: string,
    @Body() dto: CreatePostForBlogDto,
  ) {
    const blog = await this.blogsService.getBlogById(blogId);
    if (!blog) {
      throw new NotFoundException(`Blog with ID ${blogId} not found`);
    }
    return this.postsService.createPostForBlog(blogId, dto as any);
  }

  @Put(':blogId/posts/:postId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async updatePostForBlog(
    @Param('blogId') blogId: string,
    @Param('postId') postId: string,
    @Body() dto: CreatePostForBlogDto,
  ): Promise<void> {
    const blog = await this.blogsService.getBlogById(blogId);
    if (!blog) {
      throw new NotFoundException(`Blog with ID ${blogId} not found`);
    }
    const post = await this.postsService.getPostById(postId);
    if (!post || post.blogId !== blogId) {
      throw new NotFoundException(`Post with ID ${postId} not found`);
    }
    const updated = await this.postsService.updatePost(postId, {
      ...dto,
      blogId,
    });
    if (!updated) {
      throw new NotFoundException(`Post with ID ${postId} not found`);
    }
  }

  @Delete(':blogId/posts/:postId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deletePostForBlog(
    @Param('blogId') blogId: string,
    @Param('postId') postId: string,
  ): Promise<void> {
    const blog = await this.blogsService.getBlogById(blogId);
    if (!blog) {
      throw new NotFoundException(`Blog with ID ${blogId} not found`);
    }
    const post = await this.postsService.getPostById(postId);
    if (!post || post.blogId !== blogId) {
      throw new NotFoundException(`Post with ID ${postId} not found`);
    }
    await this.postsService.deletePost(postId);
  }
}
