# EmitKit Events API v1

Bruno API collection for testing the EmitKit Events API v1.

## Table of Contents

- [Setup](#setup)
- [Environments](#environments)
- [Available Requests](#available-requests)
- [API Reference](#api-reference)
- [Authentication](#authentication)
- [Channel Auto-Creation](#channel-auto-creation)
- [Rate Limiting](#rate-limiting)
- [Best Practices](#best-practices)
- [Migration from v0 API](#migration-from-v0-api)

## Setup

1. **Install Bruno**: Download from [usebruno.com](https://www.usebruno.com/)

2. **Open Collection**: File → Open Collection → Select the `bruno` directory

3. **Configure Environment**:
   - Select either `Development` or `Production` environment
   - Set the `api_key` secret variable:
     - Click the environment dropdown
     - Click "Configure"
     - Enter your API key (format: `blip_xxxxxxxxxxxxxxxxxxxxx`)

## Environments

### Development

- **API URL**: `http://localhost:5173/api/v1`
- Use this for local development

### Production

- **API URL**: `https://useblip.dev/api/v1`
- Use this for testing against production

## Available Requests

### 1. Create Event - Basic

**File**: `Track.bru`

Simple event creation with commonly used fields. Good for quick testing.

Fields included:

- `channelName`
- `title`
- `description`
- `icon`
- `notify`

### 2. Create Event - Full Example

**File**: `Create Event - Full.bru`

Demonstrates all available fields in the Events API.

Fields included:

- `channelName`
- `title`
- `description`
- `icon`
- `tags`
- `metadata` (custom object)
- `userId`
- `notify`
- `displayAs`
- `source`

### 3. Create Event - Payment Example

**File**: `Create Event - Payment.bru`

Real-world example for tracking payment events.

Use case: Payment notifications, subscription upgrades

### 4. Create Event - Minimal

**File**: `Create Event - Minimal.bru`

Minimum required fields only (channelName + title).

Use case: Quick system logs, simple notifications

### 5. Create Event - User Signup

**File**: `Create Event - User Signup.bru`

Real-world example for tracking user registrations.

Use case: User onboarding, signup tracking

## Running the Collection

### Single Request

1. Select a request
2. Click "Send"
3. View response in the right panel

### Run All Requests

1. Right-click on the collection name
2. Select "Run Collection"
3. Optionally filter by tags (e.g., only run `payment` requests)

### Tags for Filtering

Requests are tagged for easy filtering during collection runs:

- `events` - All event-related requests
- `v1` - API version
- `payment`, `signup`, etc. - Use case specific tags

---

## API Reference

### Endpoint

```
POST /api/v1/events
```

API endpoint for creating events with automatic channel management.

### Request Headers

```
Authorization: Bearer <your-api-key>
Content-Type: application/json
```

### Request Body

```typescript
{
  channelName: string;                    // Auto-creates if doesn't exist
  title: string;                          // Event title
  description?: string;                   // Optional description
  icon?: string;                          // Optional icon (emoji)
  tags?: string[];                        // Optional tags
  metadata?: Record<string, JSONValue>;   // Optional custom metadata
  userId?: string | null;                 // Optional user ID
  notify?: boolean;                       // Send notification (default: true)
  displayAs?: 'message' | 'notification'; // Display style
  source?: string;                        // Source identifier
}
```

### Example Request

```bash
curl -X POST https://your-domain.com/api/v1/events \
  -H "Authorization: Bearer blip_xxxxxxxxxxxxxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "channelName": "payments",
    "title": "Payment Received",
    "description": "User upgraded to Pro plan",
    "icon": "💰",
    "tags": ["payment", "upgrade"],
    "metadata": {
      "amount": 99.99,
      "plan": "pro",
      "userId": "user_123"
    },
    "notify": true,
    "displayAs": "notification"
  }'
```

### Success Response

**Status:** `201 Created`

```json
{
	"success": true,
	"data": {
		"id": "event_xxxxxxxxxxxxxxxxxxxxx",
		"channelId": "channel_xxxxxxxxxxxxxxxxxxxxx",
		"channelName": "payments",
		"title": "Payment Received",
		"createdAt": "2025-01-15T10:30:00.000Z"
	}
}
```

### Error Responses

#### Validation Error

**Status:** `400 Bad Request`

```json
{
	"success": false,
	"error": "Validation error",
	"details": [
		{
			"code": "invalid_type",
			"expected": "string",
			"received": "undefined",
			"path": ["channelName"],
			"message": "Required"
		}
	]
}
```

#### Authentication Error

**Status:** `401 Unauthorized`

```json
{
	"success": false,
	"error": "Unauthorized"
}
```

#### Server Error

**Status:** `500 Internal Server Error`

```json
{
	"success": false,
	"error": "Failed to create event"
}
```

## Authentication

All requests must include a valid API key in the `Authorization` header:

```
Authorization: Bearer blip_xxxxxxxxxxxxxxxxxxxxx
```

The API key automatically scopes requests to:

- **Organization**: Extracted from API key metadata
- **Site**: Extracted from API key metadata

## Channel Auto-Creation

When you send an event to a channel that doesn't exist, it will be automatically created within your site with:

- **Name**: The `channelName` you specified
- **Icon**: The `icon` from the event (if provided)
- **Description**: The `description` from the event (if provided)

This allows you to start sending events immediately without pre-creating channels.

## Rate Limiting

API keys have built-in rate limiting:

- **Default**: 100 requests per minute
- Rate limits are configurable per API key
- When rate limited, you'll receive a `429 Too Many Requests` response

## Best Practices

1. **Channel Names**: Use consistent, kebab-case names (e.g., `user-signups`, `payment-received`)
   - ✅ `user-signups`, `payment-received`
   - ❌ `UserSignups`, `payment_received`

2. **Icons**: Use single emoji characters for better display
   - ✅ `🚀`, `💰`, `👋`
   - ❌ `:rocket:`, multiple emojis

3. **Metadata**: Keep metadata JSON-serializable and avoid deeply nested objects

4. **Error Handling**: Always check the `success` field in responses

5. **Idempotency**: Events are not idempotent - each request creates a new event

## Migration from v0 API

If you're upgrading from the previous API:

### Old API (v0)

```json
{
	"channelId": "channel_xxx",
	"organizationId": "org_xxx",
	"title": "Event Title"
}
```

### New API (v1)

```json
{
	"channelName": "my-channel",
	"title": "Event Title"
}
```

**Key Changes:**

- No need to specify `channelId` - use `channelName` instead
- No need to specify `organizationId` - extracted from API key
- Channels are auto-created if they don't exist
- API key required in `Authorization` header
