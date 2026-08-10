# Instagram image publish hotfix

- Image containers follow create -> publish. Processing polling is reserved for video media.
- Publication failures are now surfaced to the Studio using the real server reason/detail instead of a generic unknown error.
- No credential is stored in this file or in GitHub.
