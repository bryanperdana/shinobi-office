# Privacy & safety principles

Shinobi Office runs **locally** inside Hermes Desktop or as a static page. It has no telemetry and makes no
network calls of its own.

| Rule | How |
|---|---|
| **Read-only** | The only Hermes requests are `profiles.list`, `session.active_list`, `session.list` and `cli.exec kanban list --json`. The only actions are navigation (open a chat, start a new chat, open Kanban). It never steers, interrupts or approves. |
| **No message content** | The activity feed and laptop screens show only status, the tool **name** (never arguments or results), signal age and Kanban mission **titles**. Prompts, replies, tool arguments, session previews and file contents are never displayed or stored. |
| **Kanban bodies dropped** | Task bodies are removed while parsing. Only id, title, status, assignee, priority and timestamps survive. |
| **Honest status** | An unclear status shows `unknown`. Silence after work shows `stale`. Idle activities such as roaming, sparring and chatting are visual only and never appear in the activity feed as work. |
| **Curated chatter** | Idle conversations come from a fixed phrase bank. A unit test checks that no line claims work was done, or contains URLs, file names or money. Dynamic slots are safe aggregates only: mission count, approvals waiting, genin count, the name of the agent that just finished, and the hour. |
| **Local settings only** | UI settings (night mode, chat level, quality) are stored with the plugin storage API on your machine. |

If you find a way the office could leak content, please open an issue (or a private security advisory once
the repository is public).
