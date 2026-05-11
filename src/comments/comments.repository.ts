import { Injectable, Inject } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../database/postgres.module';
import { v4 as uuidv4 } from 'uuid';
import { commentsMapper } from '../types/comments/mapper';

function rowToCommentRecord(row: any) {
  return {
    id: row.id,
    content: row.content,
    postId: row.post_id,
    commentatorInfo: {
      userId: row.user_id,
      userLogin: row.user_login,
    },
    createdAt:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : String(row.created_at),
  };
}

const SORT_COLUMN_MAP: Record<string, string> = {
  createdAt: 'created_at',
  content: 'content',
};

@Injectable()
export class CommentsRepository {
  constructor(@Inject(PG_POOL) private pool: Pool) {}

  async createComment(
    postId: string,
    content: string,
    userId: string,
    userLogin: string,
  ) {
    const id = uuidv4();
    const res = await this.pool.query(
      `INSERT INTO comments (id, content, post_id, user_id, user_login, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING *`,
      [id, content, postId, userId, userLogin],
    );
    return commentsMapper(rowToCommentRecord(res.rows[0]), 'None', 0, 0);
  }

  async getCommentById(id: string, userId?: string) {
    try {
      const res = await this.pool.query(
        `SELECT * FROM comments WHERE id = $1`,
        [id],
      );
      if (res.rows.length === 0) return null;
      const record = rowToCommentRecord(res.rows[0]);

      const [likesCount, dislikesCount] = await Promise.all([
        this.countByCommentAndStatus(id, 'Like'),
        this.countByCommentAndStatus(id, 'Dislike'),
      ]);

      let myStatus: 'Like' | 'Dislike' | 'None' = 'None';
      if (userId) {
        const status = await this.findMyStatus(id, userId);
        if (status) myStatus = status;
      }

      return commentsMapper(record, myStatus, likesCount, dislikesCount);
    } catch {
      return null;
    }
  }

  async getCommentsByPostId(postId: string, query: any = {}, userId?: string) {
    const {
      sortBy = 'createdAt',
      sortDirection = 'desc',
      pageNumber = 1,
      pageSize = 10,
    } = query;

    const sortColumn = SORT_COLUMN_MAP[sortBy] || 'created_at';
    const sortDir = sortDirection === 'asc' ? 'ASC' : 'DESC';
    const numPage = +pageNumber;
    const numSize = +pageSize;
    const offset = (numPage - 1) * numSize;

    const countRes = await this.pool.query(
      `SELECT COUNT(*) FROM comments WHERE post_id = $1`,
      [postId],
    );
    const totalCount = parseInt(countRes.rows[0].count, 10);

    const rowsRes = await this.pool.query(
      `SELECT * FROM comments
       WHERE post_id = $1
       ORDER BY ${sortColumn} ${sortDir}
       LIMIT $2 OFFSET $3`,
      [postId, numSize, offset],
    );

    const items = await Promise.all(
      rowsRes.rows.map(async (row) => {
        const record = rowToCommentRecord(row);
        const [likesCount, dislikesCount] = await Promise.all([
          this.countByCommentAndStatus(record.id, 'Like'),
          this.countByCommentAndStatus(record.id, 'Dislike'),
        ]);
        let myStatus: 'Like' | 'Dislike' | 'None' = 'None';
        if (userId) {
          const status = await this.findMyStatus(record.id, userId);
          if (status) myStatus = status;
        }
        return commentsMapper(record, myStatus, likesCount, dislikesCount);
      }),
    );

    return {
      pagesCount: Math.ceil(totalCount / numSize),
      page: numPage,
      pageSize: numSize,
      totalCount,
      items,
    };
  }

  async updateComment(id: string, content: string): Promise<boolean> {
    try {
      const res = await this.pool.query(
        `UPDATE comments SET content = $2 WHERE id = $1`,
        [id, content],
      );
      return (res.rowCount ?? 0) > 0;
    } catch {
      return false;
    }
  }

  async deleteComment(id: string): Promise<boolean> {
    try {
      const res = await this.pool.query(
        `DELETE FROM comments WHERE id = $1`,
        [id],
      );
      return (res.rowCount ?? 0) > 0;
    } catch {
      return false;
    }
  }

  async findCommentByIdRaw(id: string) {
    try {
      const res = await this.pool.query(
        `SELECT * FROM comments WHERE id = $1`,
        [id],
      );
      if (res.rows.length === 0) return null;
      return rowToCommentRecord(res.rows[0]);
    } catch {
      return null;
    }
  }

  async countByCommentAndStatus(
    commentId: string,
    likeStatus: 'Like' | 'Dislike',
  ): Promise<number> {
    const res = await this.pool.query(
      `SELECT COUNT(*) FROM comment_likes WHERE comment_id = $1 AND like_status = $2`,
      [commentId, likeStatus],
    );
    return parseInt(res.rows[0].count, 10);
  }

  async findMyStatus(
    commentId: string,
    userId: string,
  ): Promise<'Like' | 'Dislike' | null> {
    const res = await this.pool.query(
      `SELECT like_status FROM comment_likes WHERE comment_id = $1 AND user_id = $2`,
      [commentId, userId],
    );
    return res.rows[0]?.like_status ?? null;
  }

  async setLike(
    commentId: string,
    userId: string,
    likeStatus: 'Like' | 'Dislike',
  ): Promise<void> {
    await this.pool.query(
      `INSERT INTO comment_likes (comment_id, user_id, like_status, added_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (comment_id, user_id)
       DO UPDATE SET like_status = EXCLUDED.like_status, added_at = NOW()`,
      [commentId, userId, likeStatus],
    );
  }

  async removeLike(commentId: string, userId: string): Promise<void> {
    await this.pool.query(
      `DELETE FROM comment_likes WHERE comment_id = $1 AND user_id = $2`,
      [commentId, userId],
    );
  }
}
