# Ghost MCP Server

A Model Context Protocol (MCP) server for Ghost CMS. Manage your Ghost blog content directly from Claude, Cursor, or any MCP-compatible client.

## Features

- 📝 **Create & Edit Posts** - Draft and publish blog posts
- 🔍 **Search Posts** - Find posts by status, tags, or query
- 🏷️ **Tag Management** - List and organize your tags
- 📊 **Analytics** - Basic analytics integration support
- 🗑️ **Delete Posts** - Remove unwanted content
- 📚 **Resource Access** - Browse posts as MCP resources

## Installation

### NPM (recommended)
```bash
npm install -g ghost-mcp
```

### From Source
```bash
git clone https://github.com/mcpanvil/ghost-mcp.git
cd ghost-mcp
npm install
npm run build
npm link
```

## Configuration

1. Get your Ghost API keys:
   - Log into your Ghost Admin
   - Go to Settings > Integrations
   - Create a new Custom Integration
   - Copy the Admin API Key and Content API Key

2. Set up environment variables:
```bash
# Create a .env file or set these in your environment
GHOST_URL=https://your-site.ghost.io
GHOST_ADMIN_API_KEY=your-admin-api-key
GHOST_CONTENT_API_KEY=your-content-api-key
```

## Usage

### With Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "ghost": {
      "command": "npx",
      "args": ["ghost-mcp"],
      "env": {
        "GHOST_URL": "https://your-site.ghost.io",
        "GHOST_ADMIN_API_KEY": "your-admin-key",
        "GHOST_CONTENT_API_KEY": "your-content-key"
      }
    }
  }
}
```

### With Claude Code

```bash
# Add to Claude Code with your Ghost credentials
claude mcp add ghost \
  -e GHOST_URL=https://your-site.ghost.io \
  -e GHOST_ADMIN_API_KEY=your-admin-key \
  -e GHOST_CONTENT_API_KEY=your-content-key \
  -- npx ghost-mcp
```

Get your API keys from Ghost Admin → Settings → Integrations.

### With Cursor

Add to Cursor's MCP settings:

```json
{
  "ghost": {
    "command": "npx",
    "args": ["@mcpanvil/ghost-mcp"],
    "env": {
      "GHOST_URL": "https://your-site.ghost.io",
      "GHOST_ADMIN_API_KEY": "your-admin-key",
      "GHOST_CONTENT_API_KEY": "your-content-key"
    }
  }
}
```

## Available Tools

### create_post
Create a new blog post.

```typescript
{
  title: string;        // Required
  content: string;      // Required (HTML or Markdown)
  status?: 'draft' | 'published';  // Default: 'draft' - set to 'published' to make live
  tags?: string[];
  excerpt?: string;
  featured?: boolean;
}
```

**⚠️ Important Notes:**
- Posts are created as **drafts by default**. To publish immediately, set `status: 'published'`
- Ghost v5 uses Lexical format internally, but this MCP handles HTML/Markdown conversion automatically
- When viewing draft posts in Ghost admin, they may appear empty due to format conversion - this is normal

### update_post
Update an existing post.

```typescript
{
  id: string;          // Required (post ID)
  title?: string;
  content?: string;
  status?: 'draft' | 'published';
  tags?: string[];
  excerpt?: string;
  featured?: boolean;
}
```

### search_posts
Search and list posts.

```typescript
{
  query?: string;
  status?: 'draft' | 'published' | 'all';
  limit?: number;      // 1-100, default 10
  tags?: string[];
}
```

### get_post
Get a specific post by ID or slug.

```typescript
{
  id: string;         // Post ID or slug
}
```

### delete_post
Delete a post.

```typescript
{
  id: string;         // Post ID
}
```

### list_tags
List all available tags.

```typescript
{
  limit?: number;     // 1-100, default 20
}
```

### get_analytics
Get analytics information (requires additional setup).

```typescript
{
  days?: number;      // 1-365, default 30
}
```

## Troubleshooting

### Updates Not Working
If post updates don't seem to be applying:
1. Check browser cache - Ghost aggressively caches content
2. Verify the post status - drafts may not show updates immediately
3. Ensure you're using ghost-mcp v0.1.6 or later (earlier versions had an update bug)

### Empty Content in Ghost Admin
When viewing posts in Ghost admin, content may appear empty. This is because:
- Ghost v5 uses Lexical format internally
- The MCP creates posts in HTML format
- The admin panel may not display HTML content in the editor
- **Your published posts will display correctly** on your site

### Common Issues
- **"Validation error, cannot save post"**: Usually means required fields are missing
- **"Cannot read post"**: The post ID may be incorrect or the post was deleted
- **Draft posts not visible**: Check your Ghost admin's post filter settings

## Example Workflows

### Writing a New Blog Post
```
Human: Create a published blog post about building MCP servers