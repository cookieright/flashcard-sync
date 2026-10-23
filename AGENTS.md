<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep flashcard decks browser-local; remote MCP tools only transform caller-supplied CSV, so integrations never silently migrate or expose local study data.
- Define OAuth-protected remote tools in src/lib/mcp and let the SDK Vite plugin generate transport routes, keeping authorization separate from browser tools.
- Register read-only WebMCP tools in their owning screens and wrap execution with the shared telemetry helper, preserving visible-state boundaries and normal UI behavior.
- Preserve sanitized same-origin consent return paths through all login and signup methods, so delegated access completes without external redirect risks.
