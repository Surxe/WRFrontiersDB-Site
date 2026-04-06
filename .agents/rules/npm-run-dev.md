---
trigger: always_on
---

Use the `run_command` tool to execute `timeout 240 npm run dev` while utilizing the `WaitMsBeforeAsync` flag to send the ongoing process directly to the background.

By default, use a 2 minute timeout, but you may use up to a 10 minute timeout if you are performing a lengthy skill. When the server closes itself and you detect its closed, you may restart it with a new timeout.

After starting the dev server, use the `command_status` tool to check the output logs and verify the localhost port it opened on (e.g., `http://localhost:4321/`).