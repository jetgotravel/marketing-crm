@AGENTS.md

## Deployment

**IMPORTANT**: Always deploy from the project root `/Users/novasilver/marketing-crm/`, never from subdirectories like `packages/mcp-server/`. The deploy command must always be:

```bash
cd /Users/novasilver/marketing-crm && npx vercel --prod
```

The MCP server at `packages/mcp-server/` is NOT a Vercel project — it runs locally via the agent platform's `.mcp.json`. Do NOT deploy it to Vercel.

- Production URL: https://marketing-crm-ten.vercel.app
- Vercel project: doozis-projects/marketing-crm
- Supabase project ref: wanntyyjwrakzrkxkass
