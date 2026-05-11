import { Injectable, Inject } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../database/postgres.module';

@Injectable()
export class PostLikesRepository {
  constructor(@Inject(PG_POOL) private pool: Pool) {}

  async countByPostAndStatus(
    postId: string,
    likeStatus: 'Like' | 'Dislike',
  ): Promise<number> {
    const res = await this.pool.query(
      `SELECT COUNT(*) FROM post_likes WHERE post_id = $1 AND like_status = $2`,
      [postId, likeStatus],
    );
    return parseInt(res.rows[0].count, 10);
  }

  async findMyStatus(
    postId: string,
    userId: string,
  ): Promise<'Like' | 'Dislike' | null> {
    const res = await this.pool.query(
      `SELECT like_status FROM post_likes WHERE post_id = $1 AND user_id = $2`,
      [postId, userId],
    );
    return res.rows[0]?.like_status ?? null;
  }

  async findNewestLikes(
    postId: string,
    limit: number = 3,
  ): Promise<Array<{ userId: string; addedAt: Date }>> {
    const res = await this.pool.query(
      `SELECT user_id, added_at
       FROM post_likes
       WHERE post_id = $1 AND like_status = 'Like'
       ORDER BY added_at DESC
       LIMIT $2`,
      [postId, limit],
    );
    return res.rows.map((r: any) => ({
      userId: r.user_id,
      addedAt: r.added_at instanceof Date ? r.added_at : new Date(r.added_at),
    }));
  }

  async setLike(
    postId: string,
    userId: string,
    likeStatus: 'Like' | 'Dislike',
  ): Promise<void> {
    await this.pool.query(
      `INSERT INTO post_likes (post_id, user_id, like_status, added_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (post_id, user_id)
       DO UPDATE SET like_status = EXCLUDED.like_status, added_at = NOW()`,
      [postId, userId, likeStatus],
    );
  }

  async removeLike(postId: string, userId: string): Promise<void> {
    await this.pool.query(
      `DELETE FROM post_likes WHERE post_id = $1 AND user_id = $2`,
      [postId, userId],
    );
  }
}
