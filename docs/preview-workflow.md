# Android preview workflow

The workflow is defined in [`.github/workflows/preview.yml`](../.github/workflows/preview.yml). It runs in the **diskartech-frontend** repository, whose root already contains `package.json`. It uses Node 22 and `npm ci` with `package-lock.json`.

| Event | Result |
| --- | --- |
| Push to the Git branch `preview` | Publish JavaScript and assets to EAS channel `preview`, using EAS environment `preview` |
| Actions → Preview App → Run workflow, native option unchecked | Publish the same preview update |
| Actions → Preview App → Run workflow, native option checked | Queue a new Android preview APK build |

The Git branch, EAS Update channel and EAS environment are separate settings; this workflow deliberately names all three `preview`. Native builds are requested only through the manual option, not on every push. It uses existing signing credentials; initialize Android credentials with an interactive local EAS build first if they do not already exist.

The manual build uses `--no-wait`. A successful GitHub job means Expo accepted the build request. Follow the Expo build link in the job logs to wait for the APK and obtain its download link.

## Update configuration

EAS Update is configured locally with the SDK 54-compatible `expo-updates` dependency. The workflow checks the configuration before either publishing an update or requesting a native build:

- `app.json` uses the existing project's update URL, `https://u.expo.dev/b686c1c8-e796-4d0c-9bb4-87fa94802a3e`.
- `runtimeVersion` uses `{ "policy": "fingerprint" }`, which separates incompatible native runtimes.
- The preview build profile uses channel `preview` and environment `preview`.
- Production builds use the separate `production` channel.

Commit `package.json`, `package-lock.json`, `app.json`, `eas.json`, this guide and the workflow before using GitHub Actions. Local configuration changes do not activate the workflow on GitHub.

Create and install **one new preview APK after this setup**. APKs built before EAS Update was configured cannot receive these updates. A matching new APK must also be installed after native dependencies/configuration change.

If recreating this setup in another checkout, install the compatible package with `npx expo install expo-updates`, configure the existing EAS project's update URL/runtime with `eas update:configure`, and retain the channel and environment settings above.

## Authentication and environment values

1. Create an Expo access token at [Expo account access tokens](https://expo.dev/settings/access-tokens) for an account with access to the DiskarTech project.
2. In the frontend GitHub repository, open **Settings → Secrets and variables → Actions → New repository secret**.
3. Name the secret **`EXPO_TOKEN`** and paste the token as its value. Do not put it in the YAML or commit it in `.env`.
4. Keep the Google client IDs configured in the EAS **preview** environment:
   - `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`
   - `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`

EAS Update explicitly selects the `preview` environment. The native build selects the environment from its build profile. `EXPO_PUBLIC_*` values are included in the app bundle; backend credentials and `GOOGLE_CLIENT_SECRET` do not belong in them.

The workflow requires `google-services.json` for the current app configuration. That file is already tracked in this repository. Private Firebase service-account keys are different files and are not needed for this checkout's app configuration.

## Enable and use

The workflow must be committed and present on the repository's default branch for GitHub to show the **Run workflow** button. This repository currently uses `main` as its default branch.

The `preview` Git branch has already been created. In a new clone, switch to that branch before publishing:

```bash
git switch preview
git push origin preview
```

Commit the intended changes before pushing. Each push to that branch triggers the update path. For a native build, choose **Actions → Preview App → Run workflow**, select the intended branch, check the native-build option, and run it.

Use the manual native option after changing native libraries, Expo config plugins, permissions or other native configuration. UI/JavaScript changes can use the update path when the installed build has a compatible runtime. The native-build option is manual; this workflow does not automatically classify changes as native or JavaScript-only.

For group testing, install the compatible APK first. With the default update behavior, close and reopen the app to download an update; close and reopen again to run the downloaded update. It does not replace the currently running screen immediately.

GitHub Actions publishes the checked-out Git commit. Local edits and untracked files on your laptop are not included unless committed and pushed.

References: [Expo GitHub Actions](https://docs.expo.dev/eas-update/github-actions/), [EAS Update setup](https://docs.expo.dev/eas-update/getting-started/), [runtime compatibility](https://docs.expo.dev/eas-update/runtime-versions/).
