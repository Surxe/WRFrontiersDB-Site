---
trigger: always_on
---

# Not Yet Implemented Features

This document provides context for features and areas of the WRFrontiersDB-Site that are currently under development or have not yet been implemented. The agent should not expect functional components, tests to pass, or complete data in these specified areas.

## Known Gaps

The following areas are currently missing, not yet implemented, or in need of work.

- [ ] **Modules page headers**: [On the modules page, the headers are currently id's / refs instead of localized texts.]
- [ ] **Module page descriptions not embedded**: [On detail module pages, the descriptions do not yet support localization or stat embedment.]
- [ ] **Modern CSS**: [Modern CSS Design philosophy is not a current priority, so styles such as fonts, hyperlinks, and classes are all default.]
- [ ] **Mobile support**: [Mobile is not yet supported.]
- [ ] **Faction object type**: [Faction object type is not yet supported on the site, so other objects that reference it will display placeholders, id's, or refs]
- [ ] **Currency object type**: [Currency object type is not yet supported on the site, so other objects that reference it will display placeholders, id's, or refs]

---

> [!IMPORTANT]
> When running the `playwright-test-site` skill or any verification suite, failures in the above-mentioned areas should be noted briefly but NOT considered a regression or a blocker unless otherwise specified.
