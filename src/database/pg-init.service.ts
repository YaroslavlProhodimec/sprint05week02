import { Injectable, Inject, OnModuleInit } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from './postgres.module';

@Injectable()
export class PgInitService implements OnModuleInit {
  constructor(@Inject(PG_POOL) private pool: Pool) {}

  async onModuleInit() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        login VARCHAR(255) NOT NULL UNIQUE,
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        password_salt VARCHAR(255) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        confirmation_code VARCHAR(255),
        is_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
        confirmation_expiration_date TIMESTAMP WITH TIME ZONE,
        recovery_code VARCHAR(255),
        recovery_code_expiration TIMESTAMP WITH TIME ZONE
      );

      CREATE TABLE IF NOT EXISTS device_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR(255) NOT NULL,
        device_id VARCHAR(255) NOT NULL UNIQUE,
        issued_at TIMESTAMP WITH TIME ZONE NOT NULL,
        expiration_date TIMESTAMP WITH TIME ZONE NOT NULL,
        last_active_date TIMESTAMP WITH TIME ZONE NOT NULL,
        ip VARCHAR(255) NOT NULL DEFAULT 'unknown',
        device_name VARCHAR(500) NOT NULL DEFAULT 'unknown'
      );

      CREATE INDEX IF NOT EXISTS idx_device_sessions_user_id
        ON device_sessions (user_id);

      CREATE INDEX IF NOT EXISTS idx_device_sessions_device_id
        ON device_sessions (device_id);

      CREATE TABLE IF NOT EXISTS blogs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(15) NOT NULL,
        description VARCHAR(500) NOT NULL,
        website_url VARCHAR(100) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        is_membership BOOLEAN NOT NULL DEFAULT FALSE
      );

      CREATE TABLE IF NOT EXISTS posts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title VARCHAR(30) NOT NULL,
        short_description VARCHAR(100) NOT NULL,
        content VARCHAR(1000) NOT NULL,
        blog_id UUID NOT NULL REFERENCES blogs(id) ON DELETE CASCADE,
        blog_name VARCHAR(15) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_posts_blog_id ON posts (blog_id);
    `);

    console.log('PostgreSQL tables initialized');
  }
}
