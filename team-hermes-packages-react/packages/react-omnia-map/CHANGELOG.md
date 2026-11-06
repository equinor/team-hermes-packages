# Changelog

## [1.1.0](https://github.com/equinor/team-hermes-packages/compare/team-hermes-react-omnia-map-v1.0.0...team-hermes-react-omnia-map-v1.1.0) (2026-11-06)


### Features

* add nearest-first feature popups ([8c9af83](https://github.com/equinor/team-hermes-packages/commit/8c9af834e28a4e21f94e3d997f270395f74da5f6))
* Implement a reusable minimap ([a5f36c4](https://github.com/equinor/team-hermes-packages/commit/a5f36c4e32ab6587f1af70afcb09322454d2f3d1)), closes [#85](https://github.com/equinor/team-hermes-packages/issues/85)
* support fitting the initial extent to selected layers ([fd38bce](https://github.com/equinor/team-hermes-packages/commit/fd38bcee31cf31a20105bb8c46a036dd6ae88c3b))

## 1.0.0 (2026-11-05)


### Features

* add story for on-map controls ([1c659df](https://github.com/equinor/team-hermes-packages/commit/1c659dfab234859cf07e1ed4b65efefbcbef9061))
* improve the InitialFit story by adding a toggle to show the difference with and without ([e793c54](https://github.com/equinor/team-hermes-packages/commit/e793c541436053559df3e7e8feb7fdbea235ac42))
* **react-omnia-map:** add @team-hermes/react-omnia-map package ([5010175](https://github.com/equinor/team-hermes-packages/commit/5010175ecb5c93a84aeaa9dec808c4239ec89741))


### Bug Fixes

* add `backing-map-key.ts` helper to reset the map whenever the itemid changes ([b445ea6](https://github.com/equinor/team-hermes-packages/commit/b445ea61f293548229697fc79eeec188c1c746ea))
* **react-omnia-map:** ignore failed and stale hit tests on map clicks ([b5ddf52](https://github.com/equinor/team-hermes-packages/commit/b5ddf52f38e8703a3cd3e79a273bc0d795120d0f))
* **react-omnia-map:** remount arcgis-map when its backing map changes ([ac3d998](https://github.com/equinor/team-hermes-packages/commit/ac3d998b8b7b5c237ad348636c88867f0c09f11a))
* **react-omnia-map:** ship the arcgis-map JSX types reference in the declarations ([b2a87a9](https://github.com/equinor/team-hermes-packages/commit/b2a87a9addb2ec06ec8dcf4939711c3c0604146b))
* use manual snippets on omnia maps stories (because it was rendering as `m`) ([270dd73](https://github.com/equinor/team-hermes-packages/commit/270dd73aef7be2dbe9f2d64dd1db6e76978ccbc9))
