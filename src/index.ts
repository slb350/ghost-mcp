#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import GhostAdminAPI from '@tryghost/admin-api';
import GhostContentAPI from '@tryghost/content-api';
import { z } from 'zod';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Configuration schema
const ConfigSchema = z.object({
  GHOST_URL: z.string().url(),
  GHOST_ADMIN_API_KEY: z.string().min(1),
  GHOST_CONTENT_API_KEY: z.string().min(1),
});

// Parse and validate configuration
const config = ConfigSchema.parse({
  GHOST_URL: process.env.GHOST_URL,
  GHOST_ADMIN_API_KEY: process.env.GHOST_ADMIN_API_KEY,
  GHOST_CONTENT_API_KEY: process.env.GHOST_CONTENT_API_KEY,
});

// Initialize Ghost API clients
const adminApi = new GhostAdminAPI({
  url: config.GHOST_URL,
  key: config.GHOST_ADMIN_API_KEY,
  version: 'v5.0',
});

const contentApi = new GhostContentAPI({
  url: config.GHOST_URL,
  key: config.GHOST_CONTENT_API_KEY,
  version: 'v5.0',
});

// Tool schemas
const CreatePostSchema = z.object({
  title: z.string(),
  content: z.string(),
  status: z.enum(['draft', 'published']).default('draft'),
  tags: z.array(z.string()).optional(),
  excerpt: z.string().optional(),
  featured: z.boolean().optional(),
});

const UpdatePostSchema = z.object({
  id: z.string(),
  title: z.string().optional(),
  content: z.string().optional(),
  status: z.enum(['draft', 'published']).optional(),
  tags: z.array(z.string()).optional(),
  excerpt: z.string().optional(),
  featured: z.boolean().optional(),
});

const SearchPostsSchema = z.object({
  query: z.string().optional(),
  status: z.enum(['draft', 'published', 'all']).default('all'),
  limit: z.number().min(1).max(100).default(10),
  tags: z.array(z.string()).optional(),
});

const GetAnalyticsSchema = z.object({
  days: z.number().min(1).max(365).default(30),
});

// Create MCP server
const server = new Server(
  {
    name: 'ghost-mcp',
    version: '0.1.0',
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  }
);

// Handle tool listing
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'create_post',
        description: 'Create a new Ghost blog post',
        inputSchema: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'Post title' },
            content: { type: 'string', description: 'Post content in HTML or Markdown' },
            status: { type: 'string', enum: ['draft', 'published'], default: 'draft' },
            tags: { type: 'array', items: { type: 'string' } },
            excerpt: { type: 'string', description: 'Custom excerpt' },
            featured: { type: 'boolean', description: 'Feature this post' },
          },
          required: ['title', 'content'],
        },
      },
      {
        name: 'update_post',
        description: 'Update an existing Ghost blog post',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Post ID' },
            title: { type: 'string' },
            content: { type: 'string' },
            status: { type: 'string', enum: ['draft', 'published'] },
            tags: { type: 'array', items: { type: 'string' } },
            excerpt: { type: 'string' },
            featured: { type: 'boolean' },
          },
          required: ['id'],
        },
      },
      {
        name: 'search_posts',
        description: 'Search and list Ghost blog posts',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query' },
            status: { type: 'string', enum: ['draft', 'published', 'all'], default: 'all' },
            limit: { type: 'number', minimum: 1, maximum: 100, default: 10 },
            tags: { type: 'array', items: { type: 'string' } },
          },
        },
      },
      {
        name: 'get_post',
        description: 'Get a specific Ghost blog post by ID or slug',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Post ID or slug' },
          },
          required: ['id'],
        },
      },
      {
        name: 'delete_post',
        description: 'Delete a Ghost blog post',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Post ID' },
          },
          required: ['id'],
        },
      },
      {
        name: 'list_tags',
        description: 'List all tags in Ghost',
        inputSchema: {
          type: 'object',
          properties: {
            limit: { type: 'number', minimum: 1, maximum: 100, default: 20 },
          },
        },
      },
      {
        name: 'get_analytics',
        description: 'Get basic analytics for your Ghost blog',
        inputSchema: {
          type: 'object',
          properties: {
            days: { type: 'number', minimum: 1, maximum: 365, default: 30 },
          },
        },
      },
    ],
  };
});

// Handle resource listing
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  const posts = await contentApi.posts.browse({ limit: 5 });
  
  return {
    resources: posts.map(post => ({
      uri: `ghost://posts/${post.slug}`,
      name: post.title,
      description: post.excerpt || 'No excerpt available',
      mimeType: 'text/html',
    })),
  };
});

// Handle resource reading
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const match = request.params.uri.match(/^ghost:\/\/posts\/(.+)$/);
  if (!match) {
    throw new Error('Invalid resource URI');
  }
  
  const slug = match[1];
  const post = await contentApi.posts.read({ slug }, { formats: ['html', 'plaintext'] });
  
  return {
    contents: [
      {
        uri: request.params.uri,
        mimeType: 'text/html',
        text: `# ${post.title}\n\n${post.html}`,
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'create_post': {
        const params = CreatePostSchema.parse(args);
        const post = await adminApi.posts.add({
          title: params.title,
          html: params.content,
          status: params.status,
          tags: params.tags,
          custom_excerpt: params.excerpt,
          featured: params.featured,
        }, { source: 'ghost-mcp' });
        
        return {
          content: [
            {
              type: 'text',
              text: `Post created successfully!\n\nID: ${post.id}\nSlug: ${post.slug}\nURL: ${post.url}\nStatus: ${post.status}`,
            },
          ],
        };
      }

      case 'update_post': {
        const params = UpdatePostSchema.parse(args);
        const updateData: any = {};
        
        if (params.title) updateData.title = params.title;
        if (params.content) updateData.html = params.content;
        if (params.status) updateData.status = params.status;
        if (params.tags) updateData.tags = params.tags;
        if (params.excerpt) updateData.custom_excerpt = params.excerpt;
        if (params.featured !== undefined) updateData.featured = params.featured;
        
        const post = await adminApi.posts.edit({
          id: params.id,
          ...updateData,
        }, { source: 'ghost-mcp' });
        
        return {
          content: [
            {
              type: 'text',
              text: `Post updated successfully!\n\nTitle: ${post.title}\nStatus: ${post.status}\nURL: ${post.url}`,
            },
          ],
        };
      }

      case 'search_posts': {
        const params = SearchPostsSchema.parse(args);
        const filter: any = {};
        
        if (params.status !== 'all') {
          filter.status = params.status;
        }
        if (params.tags?.length) {
          filter.tags = params.tags;
        }
        
        const posts = await contentApi.posts.browse({
          limit: params.limit,
          filter: Object.keys(filter).length ? filter : undefined,
          fields: ['id', 'title', 'slug', 'status', 'published_at', 'excerpt'],
        });
        
        const postList = posts.map(post => 
          `- ${post.title} (${post.status})\n  ID: ${post.id}\n  Slug: ${post.slug}\n  ${post.excerpt || 'No excerpt'}`
        ).join('\n\n');
        
        return {
          content: [
            {
              type: 'text',
              text: `Found ${posts.length} posts:\n\n${postList}`,
            },
          ],
        };
      }

      case 'get_post': {
        const { id } = args as { id: string };
        const post = await contentApi.posts.read({ id }, { formats: ['html'] });
        
        return {
          content: [
            {
              type: 'text',
              text: `# ${post.title}\n\nStatus: ${post.status}\nPublished: ${post.published_at || 'Not published'}\nURL: ${post.url}\n\n## Content:\n${post.html}`,
            },
          ],
        };
      }

      case 'delete_post': {
        const { id } = args as { id: string };
        await adminApi.posts.delete({ id });
        
        return {
          content: [
            {
              type: 'text',
              text: `Post ${id} deleted successfully.`,
            },
          ],
        };
      }

      case 'list_tags': {
        const { limit = 20 } = args as { limit?: number };
        const tags = await contentApi.tags.browse({ limit });
        
        const tagList = tags.map(tag => 
          `- ${tag.name} (${tag.slug}) - ${tag.count?.posts || 0} posts`
        ).join('\n');
        
        return {
          content: [
            {
              type: 'text',
              text: `Tags (${tags.length}):\n\n${tagList}`,
            },
          ],
        };
      }

      case 'get_analytics': {
        const params = GetAnalyticsSchema.parse(args);
        
        // Note: Ghost doesn't have built-in analytics API
        // This would need integration with Ghost's analytics or external service
        return {
          content: [
            {
              type: 'text',
              text: `Analytics for last ${params.days} days:\n\nNote: Ghost doesn't provide analytics via API. Consider integrating:\n- Plausible Analytics\n- Fathom Analytics\n- Google Analytics\n\nFor now, you can check analytics in your Ghost Admin dashboard.`,
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`,
        },
      ],
    };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Ghost MCP server running...');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});