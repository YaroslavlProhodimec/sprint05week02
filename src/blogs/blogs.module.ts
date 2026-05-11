import { Module, forwardRef } from '@nestjs/common';
import { BlogsRepository } from './blogs.repository';
import { BlogsController } from './blog.controller';
import { SaBlogsController } from './sa-blogs.controller';
import { BlogsService } from './blog.service';
import { PostsModule } from '../posts/posts.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [forwardRef(() => PostsModule), AuthModule],
  controllers: [BlogsController, SaBlogsController],
  providers: [BlogsService, BlogsRepository],
  exports: [BlogsService, BlogsRepository],
})
export class BlogsModule {}
