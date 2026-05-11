import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../database/postgres.module';
import { v4 as uuidv4 } from 'uuid';
import { CreatePostDto, UpdatePostDto } from '../dto/postsDTO/create-post.dto';
import { OutputPostType } from '../types/post/output';
import { postMapper } from '../types/post/mapper';
import { BlogsRepository } from '../blogs/blogs.repository';

function rowToPostRecord(row: any) {
  return {
    id: row.id,
    title: row.title,
    shortDescription: row.short_description,
    content: row.content,
    blogId: row.blog_id,
    blogName: row.blog_name,
    createdAt:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : String(row.created_at),
  };
}

const SORT_COLUMN_MAP: Record<string, string> = {
  createdAt: 'created_at',
  title: 'title',
  shortDescription: 'short_description',
  content: 'content',
  blogId: 'blog_id',
  blogName: 'blog_name',
};

@Injectable()
export class PostsRepository {
  constructor(
    @Inject(PG_POOL) private pool: Pool,
    @Inject(forwardRef(() => BlogsRepository))
    private blogsRepository: BlogsRepository,
  ) {}

  async getPosts(query: any = {}, userId?: string) {
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

    const countRes = await this.pool.query(`SELECT COUNT(*) FROM posts`);
    const totalCount = parseInt(countRes.rows[0].count, 10);

    const rowsRes = await this.pool.query(
      `SELECT * FROM posts
       ORDER BY ${sortColumn} ${sortDir}
       LIMIT $1 OFFSET $2`,
      [numSize, offset],
    );

    const items = await Promise.all(
      rowsRes.rows.map((r) => postMapper(rowToPostRecord(r), userId)),
    );

    return {
      pagesCount: Math.ceil(totalCount / numSize),
      page: numPage,
      pageSize: numSize,
      totalCount,
      items,
    };
  }

  async getPostById(
    id: string,
    userId?: string,
  ): Promise<OutputPostType | null> {
    try {
      const res = await this.pool.query(
        `SELECT * FROM posts WHERE id = $1`,
        [id],
      );
      if (res.rows.length === 0) return null;
      return postMapper(rowToPostRecord(res.rows[0]), userId);
    } catch {
      return null;
    }
  }

  async createPost(dto: CreatePostDto): Promise<OutputPostType> {
    const blog = await this.blogsRepository.getBlogById(dto.blogId);
    if (!blog) {
      throw new Error('Blog not found');
    }

    const id = uuidv4();
    const res = await this.pool.query(
      `INSERT INTO posts (id, title, short_description, content, blog_id, blog_name, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       RETURNING *`,
      [id, dto.title, dto.shortDescription, dto.content, dto.blogId, blog.name],
    );
    return postMapper(rowToPostRecord(res.rows[0]));
  }

  async updatePost(id: string, dto: UpdatePostDto): Promise<boolean> {
    let blogName: string | null = null;
    let blogId: string | null = null;
    if (dto.blogId) {
      const blog = await this.blogsRepository.getBlogById(dto.blogId);
      if (!blog) {
        throw new Error('Blog not found');
      }
      blogName = blog.name;
      blogId = blog.id;
    }

    try {
      const res = await this.pool.query(
        `UPDATE posts
         SET title = $2,
             short_description = $3,
             content = $4,
             blog_id = COALESCE($5, blog_id),
             blog_name = COALESCE($6, blog_name)
         WHERE id = $1`,
        [id, dto.title, dto.shortDescription, dto.content, blogId, blogName],
      );
      return (res.rowCount ?? 0) > 0;
    } catch {
      return false;
    }
  }

  async deletePost(id: string): Promise<boolean> {
    try {
      const res = await this.pool.query(
        `DELETE FROM posts WHERE id = $1`,
        [id],
      );
      return (res.rowCount ?? 0) > 0;
    } catch {
      return false;
    }
  }

  async getBlogPosts(blogId: string, query: any, userId?: string) {
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
      `SELECT COUNT(*) FROM posts WHERE blog_id = $1`,
      [blogId],
    );
    const totalCount = parseInt(countRes.rows[0].count, 10);

    const rowsRes = await this.pool.query(
      `SELECT * FROM posts
       WHERE blog_id = $1
       ORDER BY ${sortColumn} ${sortDir}
       LIMIT $2 OFFSET $3`,
      [blogId, numSize, offset],
    );

    const items = await Promise.all(
      rowsRes.rows.map((r) => postMapper(rowToPostRecord(r), userId)),
    );

    return {
      pagesCount: Math.ceil(totalCount / numSize),
      page: numPage,
      pageSize: numSize,
      totalCount,
      items,
    };
  }

  async createPostForBlog(
    blogId: string,
    postData: Omit<CreatePostDto, 'blogId'> & { blogId?: string },
  ): Promise<OutputPostType> {
    return this.createPost({ ...postData, blogId } as CreatePostDto);
  }
}
