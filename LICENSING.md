# Rethos licensing

Rethos is derived from [OpenMausBot](https://github.com/milind-soni/OpenMausBot)
and distributed under the [Apache License 2.0](LICENSE), with third-party
components retaining their own licenses.

The upstream proprietary `enterprise/` directory has been removed from this
edition, together with its packaging steps and enterprise contributor agreement.
`pnpm check:oss` verifies that enterprise source and built artifacts are absent.
The Apache-licensed compatibility hook in `server/enterprise.ts` remains so
ordinary standalone behavior and existing access-control checks continue to work.
This distribution reports the OSS edition with no enterprise entitlements.

## Attribution and modifications

Copyright and attribution notices from OpenMausBot and its dependencies are
preserved in [NOTICE](NOTICE), source headers and `third_party/`.
Rethos modifications dated 2026-11-08 remove the proprietary enterprise layer,
change product branding and distribution metadata, and add OSS packaging checks.
See [docs/rethos.md](docs/rethos.md) for maintained differences and compatibility.

OpenMausBot and MausBot names and the upstream mascot belong to their respective
owners. Rethos uses its own product name and application icon. References to the
upstream project and its external services identify their origin.

Contributions to Rethos are accepted under Apache-2.0. Submit only work you wrote
or have the right to contribute; retain applicable third-party notices.
