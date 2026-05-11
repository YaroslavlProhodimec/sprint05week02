import {
  Controller,
  Get,
  Param,
  Query,
  Req,
  UseGuards,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { SortDataType } from '../types/blog/input';
import { BlogType } from '../types/blog/output';
import { BlogsService } from './blog.service';
import { OptionalJwtGuard } from '../auth/guards/optional-jwt.guard';

@Controller('blogs')
export class BlogsController {
  constructor(private readonly blogsService: BlogsService) {}

  @Get()
  async getBlogs(@Query() query: SortDataType) {
    try {
      return await this.blogsService.getAllBlogs(query);
    } catch {
      throw new BadRequestException('Failed to get blogs');
    }
  }

  @Get(':id')
  async getBlog(@Param('id') id: string): Promise<BlogType> {
    const blog = await this.blogsService.getBlogById(id);
    if (!blog) {
      throw new NotFoundException(`Blog with ID ${id} not found`);
    }
    return blog;
  }

  @Get(':id/posts')
  @UseGuards(OptionalJwtGuard)
  async getBlogPosts(
    @Param('id') id: string,
    @Query() query: any,
    @Req() req: { user?: { userId: string } },
  ) {
    const blog = await this.blogsService.getBlogById(id);
    if (!blog) {
      throw new NotFoundException(`Blog with ID ${id} not found`);
    }
    const sortData = {
      sortBy: query.sortBy,
      sortDirection: query.sortDirection,
      pageNumber: query.pageNumber,
      pageSize: query.pageSize,
    };
    const userId = req.user?.userId;
    return this.blogsService.getPostsByBlogId(id, sortData, userId);
  }
}
