# AGENT_ID Usage in AlexListens Codebase

## Primary Usage Location

### `app/api/call/route.ts` - Main API Route

The `AGENT_ID` environment variable is used in the `/api/call` route to determine which Ultravox agent to use for voice conversations.

#### Key Usage Points:

1. **Environment Variable Check** (Line 13-18):
```typescript
if (!process.env.AGENT_ID) {
  return NextResponse.json(
    { error: 'Server configuration error: Missing Agent ID' },
    { status: 500 }
  );
}
```

2. **Default Agent Selection** (Line 23):
```typescript
let agentId = process.env.AGENT_ID; // Default English agent
```

3. **Multi-language Agent Logic** (Lines 31-44):
```typescript
switch (alexEthnicity) {
  case 'Spanish':
    agentId = process.env.SPANISH_AGENT_ID || process.env.AGENT_ID;
    break;
  case 'Aussie':
    agentId = process.env.AUSSIE_AGENT_ID || process.env.AGENT_ID;
    break;
  case 'English':
  default:
    agentId = process.env.AGENT_ID;
    break;
}
```

4. **Ultravox API URL Construction** (Line 56):
```typescript
const apiUrl = `https://api.ultravox.ai/api/agents/${agentId}/calls`;
```

5. **Logging for Debugging** (Lines 58-66 and 75-78):
```typescript
console.log('🚀 Calling Ultravox API:', {
  url: apiUrl,
  hasApiKey: !!process.env.ULTRAVOX_API_KEY,
  firstName,
  userLocation,
  totalCalls,
  agentType: agentId === process.env.SPANISH_AGENT_ID ? 'Spanish' : 
             agentId === process.env.AUSSIE_AGENT_ID ? 'Aussie' : 'English'
});
```

## How It Works

### Agent Selection Flow:
1. **Default**: Uses `AGENT_ID` for English conversations
2. **Spanish**: Uses `SPANISH_AGENT_ID` if available, falls back to `AGENT_ID`
3. **Australian**: Uses `AUSSIE_AGENT_ID` if available, falls back to `AGENT_ID`

### User Preference Detection:
- Reads user's `alexEthnicity` preference from Firestore
- This preference is set in the Dashboard (`app/dashboard/page.tsx`)
- Users can choose between "English", "Spanish", or "Aussie"

### API Integration:
- The selected `agentId` is used to construct the Ultravox API endpoint
- Each agent ID corresponds to a different AI personality/language model
- The agent handles the actual voice conversation logic

## Environment Variables Required:

- `AGENT_ID` - **Required** - Default English agent
- `SPANISH_AGENT_ID` - Optional - Spanish-speaking agent
- `AUSSIE_AGENT_ID` - Optional - Australian English agent

## Error Handling:

If `AGENT_ID` is missing, the API returns a 500 error with the message:
"Server configuration error: Missing Agent ID"

## Related Files:

- `app/dashboard/page.tsx` - Where users set their language preference
- `components/AuthModals.tsx` - Sets default "English" preference for new users
- `.env.local` - Where these environment variables are defined