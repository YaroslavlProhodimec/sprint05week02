import { Controller, Delete, HttpCode, HttpStatus, Inject } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Pool } from 'pg';
import { PostLike, PostLikeDocument } from '../schemas/postLike.schema';
import { Comment, CommentDocument } from '../schemas/comment.schema';
import { CommentLike, CommentLikeDocument } from '../schemas/commentLike.schema';
import { PG_POOL } from '../database/postgres.module';

@Controller('testing')
export class TestingController {
  constructor(
    @InjectModel(PostLike.name) private postLikeModel: Model<PostLikeDocument>,
    @InjectModel(Comment.name) private commentModel: Model<CommentDocument>,
    @InjectModel(CommentLike.name) private commentLikeModel: Model<CommentLikeDocument>,
    @Inject(PG_POOL) private pool: Pool,
  ) {}

  @Delete('all-data')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteAllData() {
    await Promise.all([
      this.postLikeModel.deleteMany({}),
      this.commentModel.deleteMany({}),
      this.commentLikeModel.deleteMany({}),
      this.pool.query('DELETE FROM posts'),
      this.pool.query('DELETE FROM blogs'),
      this.pool.query('DELETE FROM device_sessions'),
      this.pool.query('DELETE FROM users'),
    ]);
  }
}
