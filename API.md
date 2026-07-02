# API Reference

All API calls POST to `index.php?action=handler:subaction` with a JSON body.

## Response Format

```json
{"success": true}
{"page": {"id": 1, "name": "General", ...}}
{"blocks": [...]}
```

Errors:

```json
{"error": "page_id is required"}
```

## Pages

| Action | Description | Body |
|---|---|---|
| `pages:get` | List all pages | — |
| `pages:add` | Create a page | `{ name: "Work" }` |
| `pages:rename` | Rename a page | `{ id: 1, name: "Work" }` |
| `pages:delete` | Delete a page | `{ id: 1 }` |
| `pages:reorder` | Reorder pages | `{ order: [1, 3, 2] }` |

## Blocks

| Action | Description | Body |
|---|---|---|
| `blocks:get` | List blocks for a page | `page_id` in GET or POST |
| `blocks:add` | Create a block | `{ page_id: 1, title: "Tools", type: "link_list" }` |
| `blocks:update` | Update a block | `{ id: 1, title: "Dev Tools" }` |
| `blocks:delete` | Delete a block | `{ id: 1 }` |
| `blocks:reorder` | Reorder blocks | `{ page_id: 1, order: [1, 3, 2] }` |

## Items

| Action | Description | Body |
|---|---|---|
| `items:add` | Add a link | `{ block_id: 5, url: "https://...", title: "Name" }` |
| `items:update` | Update a link | `{ id: 7, title: "New Name" }` |
| `items:delete` | Delete a link | `{ id: 7 }` |
| `items:reorder` | Reorder/move items | `{ moves: [{ id: 7, block_id: 3, sort_order: 0 }] }` |

## Export / Import

| Action | Description | Body |
|---|---|---|
| `export:export` | Download layout as JSON file | — |
| `export:import` | Restore layout from JSON | JSON payload (versioned format) |

`export:export` returns JSON with `Content-Disposition: attachment` to trigger a file download.
`export:import` validates the version field, clears existing data, and restores the imported layout.

## JavaScript Helper

Use the bundled `api()` helper from `app.js`:

```js
const result = await api('pages:add', { name: 'Work' });
// result: { success: true } or { error: '...' }
```
