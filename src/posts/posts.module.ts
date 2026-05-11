import { Module, forwardRef } from '@nestjs/common';
import { PostsRepository } from './posts.repository';
import { PostsController } from './posts.controller';
import { PostsService } from './posts.service';
import { BlogsModule } from '../blogs/blogs.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [forwardRef(() => BlogsModule), AuthModule],
  controllers: [PostsController],
  providers: [PostsService, PostsRepository],
  exports: [PostsService, PostsRepository],
})
export class PostsModule {}
