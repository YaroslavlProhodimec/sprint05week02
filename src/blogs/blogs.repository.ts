import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../database/postgres.module';
import { v4 as uuidv4 } from 'uuid';
import {
  CreateBlogDto,
  UpdateBlogDto,
  SortDataType,
} from '../types/blog/input';
import { BlogType } from '../types/blog/output';
import { PostsRepository } from '../posts/posts.repository';

function rowToBlog(row: any): BlogType {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    websiteUrl: row.website_url,
    createdAt:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : String(row.created_at),
    isMembership: Boolean(row.is_membership),
  };
}

@Injectable()
export class BlogsRepository {
  constructor(
    @Inject(PG_POOL) private pool: Pool,
    @Inject(forwardRef(() => PostsRepository))
    private postsRepository: PostsRepository,
  ) {}

  async getBlogs(sortData: SortDataType = {}) {
    const {
      searchNameTerm = null,
      sortBy = 'createdAt',
      sortDirection = 'desc',
      pageNumber = 1,
      pageSize = 10,
    } = sortData;

    const sortColumnMap: Record<string, string> = {
      createdAt: 'created_at',
      name: 'name',
      description: 'description',
      websiteUrl: 'website_url',
      isMembership: 'is_membership',
    };
    const sortColumn = sortColumnMap[sortBy] || 'created_at';
    const sortDir = sortDirection === 'asc' ? 'ASC' : 'DESC';

    const params: any[] = [];
    let where = '';
    if (searchNameTerm) {
      params.push(`%${searchNameTerm}%`);
      where = `WHERE name ILIKE $1`;
    }

    const numPage = +pageNumber;
    const numSize = +pageSize;
    const offset = (numPage - 1) * numSize;

    const countRes = await this.pool.query(
      `SELECT COUNT(*) FROM blogs ${where}`,
      params,
    );
    const totalCount = parseInt(countRes.rows[0].count, 10);

    const rowsRes = await this.pool.query(
      `SELECT * FROM blogs ${where}
       ORDER BY ${sortColumn} ${sortDir}
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, numSize, offset],
    );

    return {
      pagesCount: Math.ceil(totalCount / numSize),
      page: numPage,
      pageSize: numSize,
      totalCount,
      items: rowsRes.rows.map(rowToBlog),
    };
  }

  async getBlogById(id: string): Promise<BlogType | null> {
    try {
      const res = await this.pool.query(
        `SELECT * FROM blogs WHERE id = $1`,
        [id],
      );
      if (res.rows.length === 0) return null;
      return rowToBlog(res.rows[0]);
    } catch {
      return null;
    }
  }

  async createBlog(dto: CreateBlogDto): Promise<BlogType> {
    const id = uuidv4();
    const res = await this.pool.query(
      `INSERT INTO blogs (id, name, description, website_url, created_at, is_membership)
       VALUES ($1, $2, $3, $4, NOW(), FALSE)
       RETURNING *`,
      [id, dto.name, dto.description, dto.websiteUrl],
    );
    return rowToBlog(res.rows[0]);
  }

  async updateBlog(id: string, dto: UpdateBlogDto): Promise<boolean> {
    try {
      const res = await this.pool.query(
        `UPDATE blogs
         SET name = $2,
             description = $3,
             website_url = $4
         WHERE id = $1`,
        [id, dto.name, dto.description, dto.websiteUrl],
      );
      return (res.rowCount ?? 0) > 0;
    } catch {
      return false;
    }
  }

  async deleteBlog(id: string): Promise<boolean> {
    try {
      const res = await this.pool.query(
        `DELETE FROM blogs WHERE id = $1`,
        [id],
      );
      return (res.rowCount ?? 0) > 0;
    } catch {
      return false;
    }
  }

  async getPostsByBlogId(blogId: string, sortData: any, userId?: string) {
    return this.postsRepository.getBlogPosts(blogId, sortData, userId);
  }
}
