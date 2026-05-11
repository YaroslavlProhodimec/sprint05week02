import { Module, forwardRef } from '@nestjs/common';
import { PostsRepository } from './posts.repository';
import { PostsController } from './posts.controller';
import { PostsService } from './posts.service';
import { PostLikesRepository } from '../post-likes/post-likes.repository';
import { BlogsModule } from '../blogs/blogs.module';
import { UsersModule } from '../users/users.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [forwardRef(() => BlogsModule), UsersModule, AuthModule],
  controllers: [PostsController],
  providers: [PostsService, PostsRepository, PostLikesRepository],
  exports: [PostsService, PostsRepository, PostLikesRepository],
})
export class PostsModule {}
