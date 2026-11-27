# livebuy-react-native-reference-ui

The **reference-ui pixel layer** of the Livebuy React Native SDK — the drop-in turnkey containers
(`LivebuyPlayer` / `LivebuyWidget` / `CollapsibleLivebuyPlayer` / `LivebuyLiveEntry`) that bind
the `livebuy-react-native-ui` view-models and render actual pixels. Most integrators depend on
this package for the fastest path to a working UI.

> **Distribution.** This repository is a **mirror** — a public, organization-owned consumption
> copy synced from the private Livebuy SDK monorepo (`react-native-reference-ui/` package
> directory). It is not the primary development repository; source changes happen upstream and
> are synced here at release time.

> **Part of a three-package chain.** Requires
> [`livebuy-react-native-ui`](https://github.com/ariesweng/livebuy-react-native-ui) (view-model
> layer, peer dependency), which in turn requires
> [`livebuy-react-native`](https://github.com/ariesweng/livebuy-react-native) (headless core).
> Declare all three packages, one git dependency line each — see Installation for why a missing
> line is not harmless.

---

## Installation

```json
{
  "dependencies": {
    "livebuy-react-native": "git+https://github.com/ariesweng/livebuy-react-native.git#v2.0.0",
    "livebuy-react-native-ui": "git+https://github.com/ariesweng/livebuy-react-native-ui.git#v1.3.0",
    "livebuy-react-native-reference-ui": "git+https://github.com/ariesweng/livebuy-react-native-reference-ui.git#v1.3.0"
  }
}
```

Then `npm install` (or `yarn` / `pnpm install`). No registry account or `.npmrc` token needed —
these are plain public git dependencies.

> **Declare every package you need.** This package declares
> `peerDependencies.livebuy-react-native-ui`, and `livebuy-react-native-ui` declares
> `peerDependencies.livebuy-react-native`, both as ordinary registry version ranges. npm 7+
> installs missing peers automatically, so if either of them is not in your `dependencies`, npm
> fetches a package with that name from registry.npmjs.org — where Livebuy does not publish it.
> Only the packages you declare yourself are installed from this git channel — **so declare each
> Livebuy package you use as its own `git+https://…` dependency line** (do not rely on
> `legacy-peer-deps` to silence the peer).

> **Why a git dependency and not npm registry?** The SDK is not (yet) published to the public npm
> registry; this mirror repository is the supported remote consumption channel. The tag you pin
> (`#v1.3.0`) corresponds to this package's `package.json` `version` field at release time — the
> channel itself does not hard-code any particular version string.

> **Peer dependencies.** This package also peer-depends on `react-native-svg` (`15.15.5`) and
> `react-native-video` — install those in your app as usual.

---

## Getting Started

Call `LivebuyUI.install()` once at app startup (from `livebuy-react-native-ui`) before mounting
any drop-in container — otherwise containers render bare data with no interactive overlays:

```tsx
import { LivebuySDK } from 'livebuy-react-native';
import { LivebuyUI } from 'livebuy-react-native-ui';
import { LivebuyPlayer, LivebuyWidget } from 'livebuy-react-native-reference-ui';

LivebuyUI.install();
LivebuySDK.configure({ apiKey: 12345, secret: '<your-secret>', shopId: 'Pw8PJ99J' });

// Player (live / replay / shoppable VOD)
<LivebuyPlayer videoId="abc123" />

// Video list (carousel / grid)
<LivebuyWidget shopId="Pw8PJ99J" />
```

Full integration guide (login / add-to-cart / view-cart, TypeScript + React Native): request it
from Livebuy.

---

## Related packages

| Package | Role |
|---|---|
| `livebuy-react-native` | headless core |
| `livebuy-react-native-ui` | view-model layer (call `LivebuyUI.install()` once) |
| `livebuy-react-native-reference-ui` (this repo) | drop-in turnkey pixel layer |

---

## Changelog

See [CHANGELOG.md](CHANGELOG.md).

---

## License

Copyright © Livebuy. All rights reserved.
