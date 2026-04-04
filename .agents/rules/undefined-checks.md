---
trigger: always_on
---

When considering wrapping a displayed component in a check for if its undefined/null, first check the typescript chain to see if the object should always exist or not. For example, in `pilots.ts`, the Pilot interface specifies that `faction_ref` is required, and not optional. Therefore, when evaluating the faction ref to a Faction object, there should be no wrapped check for undefined/null.