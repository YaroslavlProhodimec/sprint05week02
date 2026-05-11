import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TestingController } from './testing.controller';
import { PostLike, PostLikeSchema } from '../schemas/postLike.schema';
import { Comment, CommentSchema } from '../schemas/comment.schema';
import { CommentLike, CommentLikeSchema } from '../schemas/commentLike.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PostLike.name, schema: PostLikeSchema },
      { name: Comment.name, schema: CommentSchema },
      { name: CommentLike.name, schema: CommentLikeSchema },
    ]),
  ],
  controllers: [TestingController],
})
export class TestingModule {}
