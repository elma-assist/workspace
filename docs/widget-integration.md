# Embedded service branding and topics

Branding is configured per script embed. Other publications retain their existing
labels. The backend stores the branding, language, demo flag and selected topic
in the conversation configuration, returns them in the session and preserves
these values on resume and shared conversations. Names are display data, not
agent instructions or authorization. Attribute values are escaped before HTML
insertion; names have a 120-character limit.

```html
<script src="https://elma-assist.de/widget.js" lang="de"
  data-agent="423ca3c4-3c93-406c-abb6-aa250140ad1f"
  data-brand-name="Tristar Hausmanagement"
  data-assistant-name="Tristar Service"
  data-launcher-label="Anliegen mitteilen"
  data-demo="true" defer></script>
```

`data-brand-name` enables neutral service copy and formal German Sie.
`data-assistant-name` overrides the conversation name and model greeting.
`data-launcher-label` overrides only the launcher text. `data-demo="true"`
marks a concept demo in the opening notice, greeting and model instructions.
The AI disclosure remains visible. Agent knowledge and form definitions still
come from the selected publication; branding does not change organization data
or create a real external delivery integration.

```js
window.dispatchEvent(new CustomEvent('elma:open', {
  detail: { agent: '423ca3c4-3c93-406c-abb6-aa250140ad1f', scenario: 'damage' }
}));
```

Supported topics:

- `damage`: property, damage/malfunction, urgency, photos and contact.
- `management_question`: management, documents or charges, with relevant context.
- `management_inquiry`: property, type/number of units, desired management and contact.

Each explicit topic event opens the start window and starts a fresh conversation
when the visitor selects text or voice. It does not submit a hidden customer
message. The topic is stored server-side and given to the model; the initial
assistant question depends on the topic. Existing conversations and drafts are
preserved. Ordinary `new Event('elma:open')` continues normal opening/resume.
Unknown topics are ignored. The optional `agent` targets a specific embed.

The host URL keeps `elma-scenario` with the existing `elma-*` route state.
Refresh of an unstarted topic retains fresh-conversation intent. Conversation
IDs still require the browser's visitor secret; URL state grants no access.

After installing handlers the loader emits `elma:widget-ready` with
`detail = { version: 2, agent, features: ['branding', 'scenarios', 'demo'] }`.
It also stores that object in `window.elmaWidgets[publicationId]`, so a listener
installed after the event can check the registry. Check `version >= 2` and the
required feature names before enabling scenario cards. Merely finding a
launcher or loading an old cached widget.js does not prove topic support.

The demo never guarantees delivery to Tristar, urgent repair or a confirmed
callback. 24/7 refers only to intake. Model instructions reduce misleading
claims but are not a deterministic guarantee for every generated response.
