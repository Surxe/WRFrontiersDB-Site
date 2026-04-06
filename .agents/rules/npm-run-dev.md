---
trigger: always_on
---

When starting a dev server with `npm run dev`, instead run it with a timeout. By default, use a 4 minute timeout, but you may use up to a 10 minute timeout if you are performing a lengthy skill. When the server closes itself and you detect its closed, you may restart it with a new timeout.