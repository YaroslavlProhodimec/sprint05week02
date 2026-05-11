import { Controller, Delete, HttpCode, HttpStatus, Inject } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../database/postgres.module';

@Controller('testing')
export class TestingController {
  constructor(@Inject(PG_POOL) private pool: Pool) {}

  @Delete('all-data')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteAllData() {
    await this.pool.query(`
      TRUNCATE TABLE
        comment_likes,
        post_likes,
        comments,
        posts,
        blogs,
        device_sessions,
        users
      RESTART IDENTITY CASCADE
    `);
  }
}
