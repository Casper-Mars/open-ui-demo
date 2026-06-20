---
name: a2ui
description: "Generate A2UI v0.9 JSONL messages for agent-driven UI rendering. MUST use this skill whenever the response would benefit from structured UI — cards, lists, forms, dashboards, data tables, pickers, or any interactive component. Use A2UI when: the user asks for structured data display, multi-step interactions, visual dashboards, or when a plain text reply would be too long, hard to read, or require back-and-forth. Default to A2UI when in doubt — it's the primary interaction mode, not a fallback."
---

# A2UI — Agent-to-User Interface Protocol v0.9

Generate A2UI v0.9 messages to drive dynamic, streaming UI rendering on the client side.

## Core Concepts

A2UI is a **declarative, streaming UI protocol**. The agent sends a stream of JSON objects (JSONL format), and the client incrementally builds the UI. The key design principles:

- **Flat adjacency list**: Components reference each other by ID, not nesting. This makes it easy for LLMs to generate incrementally.
- **Separation of structure and data**: `updateComponents` defines the UI tree; `updateDataModel` populates the data.
- **Progressive rendering**: The client renders as messages arrive — components can reference children that haven't been sent yet.

## Output Format

All A2UI messages MUST be placed inside a ` ```a2ui ` code block. Each line inside the block must be a **complete, valid JSON object** — no line breaks inside JSON.

```
```a2ui
{"version":"v0.9","createSurface":{"surfaceId":"main","catalogId":"https://a2ui.org/specification/v0_9/catalogs/basic/catalog.json"}}
{"version":"v0.9","updateComponents":{"surfaceId":"main","components":[...]}}
```
```

### Critical JSONL Rules

- **One complete JSON object per line** — the client parses line-by-line
- **No pretty-printing** — no indentation, no line breaks inside JSON
- **No trailing commas** — standard JSON rules apply
- **Every message must have `"version":"v0.9"`**

## Message Types

Four message types drive the entire protocol:

### 1. createSurface — Initialize a rendering surface

Must be sent before any `updateComponents` or `updateDataModel` for that surface. Send only once per surface (skip if the surface already exists).

```json
{"version":"v0.9","createSurface":{"surfaceId":"main","catalogId":"https://a2ui.org/specification/v0_9/catalogs/basic/catalog.json"}}
```

Properties:
- `surfaceId` (string, required): Unique ID for this surface. Must be globally unique for the renderer's lifetime.
- `catalogId` (string, required): Identifies the component catalog. Use `https://a2ui.org/specification/v0_9/catalogs/basic/catalog.json` for the standard basic catalog.
- `theme` (object, optional): Theme overrides like `{"primaryColor":"#00BFFF"}`.

### 2. updateComponents — Define/update the UI component tree

The core message. Provides a flat list of components that reference each other by ID.

```json
{"version":"v0.9","updateComponents":{"surfaceId":"main","components":[...]}}
```

Properties:
- `surfaceId` (string, required): Target surface.
- `components` (array, required): Flat list of component objects.

**Every surface MUST have a component with `"id":"root"`** — this is the root of the component tree.

When updating an existing surface, send ALL components (not just changed ones) — the new list replaces the old one entirely.

### 3. updateDataModel — Update data without changing structure

```json
{"version":"v0.9","updateDataModel":{"surfaceId":"main","path":"/user/name","value":"Alice"}}
```

Properties:
- `surfaceId` (string, required)
- `path` (string, optional): JSON Pointer to the data location. Defaults to `/` (replace entire model).
- `value` (any, optional): New value. Omit to remove the key at path.

### 4. deleteSurface — Remove a surface

```json
{"version":"v0.9","deleteSurface":{"surfaceId":"main"}}
```

## Component Reference

All components share these common fields:
- `id` (string, required): Unique component ID within the surface
- `component` (string, required): Component type name (e.g., "Text", "Button", "Column")

### Layout Components

**Column** — Vertical layout container
- `children` (array of component IDs, required): Child component IDs in order
- `justify` (optional): `"start"` (default), `"center"`, `"end"`, `"spaceBetween"`, `"spaceAround"`, `"spaceEvenly"`, `"stretch"`
- `align` (optional): `"stretch"` (default), `"start"`, `"center"`, `"end"`

**Row** — Horizontal layout container
- `children` (array of component IDs, required)
- `justify` (optional): `"start"` (default), `"center"`, `"end"`, `"spaceBetween"`, `"spaceAround"`, `"spaceEvenly"`, `"stretch"`
- `align` (optional): `"stretch"` (default), `"start"`, `"center"`, `"end"`

**List** — Scrollable list container
- `children` (array of component IDs, required)
- `direction` (optional): `"vertical"` (default), `"horizontal"`
- `align` (optional): `"stretch"` (default), `"start"`, `"center"`, `"end"`

**Card** — Elevated card container wrapping a single child
- `child` (component ID, required): Single child ID. To show multiple elements, wrap them in a Column/Row and pass that container's ID.

**Tabs** — Tabbed container
- `tabs` (array, required): Array of `{"title": "Tab Name", "child": "component-id"}` objects

**Modal** — Modal dialog
- `trigger` (component ID, required): Component that opens the modal (e.g., a button)
- `content` (component ID, required): Component displayed inside the modal

**Divider** — Visual separator
- `axis` (optional): `"horizontal"` (default), `"vertical"`

### Display Components

**Text** — Text content with optional Markdown
- `text` (string, required): The text to display. Supports simple Markdown (bold, italic, lists, headers via `#`).
- `variant` (optional): `"body"` (default), `"h1"`, `"h2"`, `"h3"`, `"h4"`, `"h5"`, `"caption"`

**Image** — Display an image
- `url` (string, required): Image URL
- `description` (string, optional): Accessibility text
- `fit` (optional): `"fill"` (default), `"contain"`, `"cover"`, `"none"`, `"scaleDown"`
- `variant` (optional): `"mediumFeature"` (default), `"icon"`, `"avatar"`, `"smallFeature"`, `"largeFeature"`, `"header"`

**Icon** — Material-style icon
- `name` (string, required): Icon name from the catalog. Common values: `"person"`, `"mail"`, `"phone"`, `"home"`, `"search"`, `"settings"`, `"edit"`, `"delete"`, `"add"`, `"check"`, `"close"`, `"menu"`, `"info"`, `"warning"`, `"error"`, `"favorite"`, `"share"`, `"download"`, `"upload"`, `"play"`, `"pause"`, `"stop"`, `"calendarToday"`, `"locationOn"`, `"lock"`, `"visibility"`, `"camera"`, `"photo"`, `"send"`, `"refresh"`, `"arrowBack"`, `"arrowForward"`, `"attachFile"`, `"folder"`, `"call"`, `"print"`, `"shoppingCart"`, `"star"`, `"notifications"`, `"accountCircle"`, `"event"`, `"payment"`, `"help"`, `"moreVert"`, `"moreHoriz"`, `"fastForward"`, `"rewind"`, `"skipNext"`, `"skipPrevious"`, `"volumeUp"`, `"volumeDown"`, `"volumeMute"`, `"volumeOff"`, `"visibilityOff"`, `"notificationsOff"`, `"favoriteOff"`, `"starOff"`, `"starHalf"`, `"lockOpen"`

**Video** — Display a video
- `url` (string, required): Video URL

**AudioPlayer** — Audio playback
- `url` (string, required): Audio URL
- `description` (string, optional): Title or summary

### Interactive Components

**Button** — Clickable button
- `child` (component ID, required): The button's content — typically a Text component. Use Icon only for icon-only buttons.
- `action` (object, required): `{"name": "action_name", "context": [{"key": "param", "value": "literal"}]}`
- `variant` (optional): `"default"` (default), `"primary"`, `"borderless"`

**TextField** — Text input field
- `label` (string, required): Field label
- `value` (string, optional): Current value (use data binding path for reactive forms)
- `variant` (optional): `"shortText"` (default), `"longText"`, `"number"`, `"obscured"`
- `validationRegexp` (string, optional): Client-side validation regex

**CheckBox** — Checkbox toggle
- `label` (string, required): Label text
- `value` (boolean, required): Current state (true/false)

**ChoicePicker** — Option selector
- `options` (array, required): Array of `{"label": "Option", "value": "opt_value"}` objects
- `value` (array, required): Currently selected values
- `label` (string, optional): Group label
- `variant` (optional): `"mutuallyExclusive"` (default, radio), `"multipleSelection"` (checkboxes)
- `displayStyle` (optional): `"checkbox"` (default), `"chips"`
- `filterable` (boolean, optional): Show search input. Default false.

**Slider** — Range slider
- `value` (number, required): Current value
- `min` (number, optional): Minimum value. Default 0.
- `max` (number, required): Maximum value
- `label` (string, optional): Slider label

**DateTimeInput** — Date/time picker
- `value` (string, required): ISO 8601 value. Empty string if not set.
- `enableDate` (boolean, optional): Allow date selection. Default false.
- `enableTime` (boolean, optional): Allow time selection. Default false.
- `label` (string, optional): Field label
- `min` (string, optional): Minimum allowed date/time (ISO 8601)
- `max` (string, optional): Maximum allowed date/time (ISO 8601)

## Generation Workflow

Follow this sequence when generating A2UI:

### Step 1: Understand the UI requirements

Ask yourself:
- What is the user trying to display or collect?
- What layout pattern fits best? (single column, cards, form, dashboard, list)
- What data needs to be shown? What interactions are needed?

### Step 2: Design the component tree

Sketch the component hierarchy mentally:
- Start with `root` (usually a Column or Card)
- Plan the ID naming scheme — use descriptive prefixes like `header-`, `form-`, `list-`, `btn-`
- Every component gets a unique ID
- Container components reference children by ID only

### Step 3: Output the messages

1. **First message**: `createSurface` — always first for a new surface
2. **Second message**: `updateComponents` — the full flat component list
3. **Optional**: `updateDataModel` — if using data bindings

### Step 4: For updates, resend all components

When modifying an existing UI, send a new `updateComponents` with the complete component list — not just the changed ones. The new list replaces the old one.

## Complete Example: User Profile Card

```a2ui
{"version":"v0.9","createSurface":{"surfaceId":"profile","catalogId":"https://a2ui.org/specification/v0_9/catalogs/basic/catalog.json"}}
{"version":"v0.9","updateComponents":{"surfaceId":"profile","components":[{"id":"root","component":"Card","child":"profile-col"},{"id":"profile-col","component":"Column","children":["avatar-row","name-text","bio-text","divider-1","stats-row"]},{"id":"avatar-row","component":"Row","children":["avatar-icon","title-col"],"align":"center"},{"id":"avatar-icon","component":"Icon","name":"accountCircle"},{"id":"title-col","component":"Column","children":["name-text","role-text"],"align":"start"},{"id":"name-text","component":"Text","text":"张三","variant":"h3"},{"id":"role-text","component":"Text","text":"高级软件工程师","variant":"caption"},{"id":"bio-text","component":"Text","text":"热爱开源，专注于后端架构设计。"},{"id":"divider-1","component":"Divider"},{"id":"stats-row","component":"Row","children":["stat-projects","stat-stars"],"justify":"spaceAround"},{"id":"stat-projects","component":"Column","children":["stat-projects-num","stat-projects-label"],"align":"center"},{"id":"stat-projects-num","component":"Text","text":"47","variant":"h4"},{"id":"stat-projects-label","component":"Text","text":"项目","variant":"caption"},{"id":"stat-stars","component":"Column","children":["stat-stars-num","stat-stars-label"],"align":"center"},{"id":"stat-stars-num","component":"Text","text":"1.2k","variant":"h4"},{"id":"stat-stars-label","component":"Text","text":"Stars","variant":"caption"}]}}
```

## Example: Simple Form

```a2ui
{"version":"v0.9","createSurface":{"surfaceId":"form","catalogId":"https://a2ui.org/specification/v0_9/catalogs/basic/catalog.json"}}
{"version":"v0.9","updateComponents":{"surfaceId":"form","components":[{"id":"root","component":"Card","child":"form-col"},{"id":"form-col","component":"Column","children":["form-title","name-field","email-field","msg-field","submit-btn"]},{"id":"form-title","component":"Text","text":"# 联系我们","variant":"h2"},{"id":"name-field","component":"TextField","label":"姓名"},{"id":"email-field","component":"TextField","label":"邮箱","variant":"shortText"},{"id":"msg-field","component":"TextField","label":"留言","variant":"longText"},{"id":"submit-btn","component":"Button","child":"submit-text","action":{"name":"submit"},"variant":"primary"},{"id":"submit-text","component":"Text","text":"提交"}]}}
```

## Best Practices

1. **Root first**: Always put the root component as the first item in the components array
2. **Descriptive IDs**: Use meaningful prefixes — `header-`, `form-`, `list-`, `btn-`, `card-`, `section-`
3. **Flat is correct**: Never nest component definitions. Always use ID references.
4. **One surface at a time**: Each `updateComponents` targets exactly one surface
5. **Card wraps one child**: To show multiple items in a Card, wrap them in a Column first
6. **Button needs Text child**: Buttons require a child component (usually Text) — don't put text directly on Button
7. **Delete before recreate**: To change a surface's catalogId, delete it first then recreate
8. **Natural language first**: Always explain the UI in natural language before the A2UI block, so the user knows what to expect
9. **Progressive enhancement**: Start simple, add complexity in subsequent updates
10. **Surface ID naming**: Use short, descriptive surface IDs like `"profile"`, `"form"`, `"dashboard"` — they must be unique across all active surfaces
