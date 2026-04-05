---
trigger: always_on
---

When starting a dev server with `npm run dev`, instead run it with a timeout. By default, use a 2 minute timeout, but you may use up to a 10 minute timeout if you are performing a lengthy skill. When the server closes itself and you detect its closed, you may restart it with a new timeout.

To run `npm run dev` in the background and check the localhost port:
1. Use the `run_command` tool to execute `timeout 120 npm run dev` and set `WaitMsBeforeAsync` (> 2000) so the task runs in the background.
2. Obtain the background **Command ID** from the result and track its output using the `command_status` tool to discover the exact localhost port it assigns.
