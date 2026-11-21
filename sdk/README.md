# GuideKit SDK · From Project to Your First Guide

**Add helpful chat and step-by-step product tours to your website.**

This guide explains what to enter in the dashboard, why each setting exists, and how to connect your app—even if you did not build its login system yourself.

> **The quick answer:** create a project → generate a **Publishable** key → add your website’s **origin** → configure login detection if needed → publish a workflow → install the SDK.
>
> You do **not** need a Secret key for the browser SDK. You do **not** need to give GuideKit your users’ passwords or paste their session tokens into the dashboard.

---

## Your setup checklist

| What you need | Example | When you need it |
| --- | --- | --- |
| A GuideKit project | `My Customer Portal` | Always |
| A publishable key from that project | Starts with `gk_pk_live_` | Always |
| Your website’s origin | `http://localhost:5173` | For the website running the SDK |
| The GuideKit API address | `http://127.0.0.1:8000/api/v1` for local development | Always |
| A published workflow | `Create your first invoice` | To run a product tour |
| A login-detection rule | A cookie **name** or signed-in page marker | For tours that require login |
| A role-detection rule | `admin`, `member`, `driver` | For tours limited to a particular role |

**Two different websites are involved:** the GuideKit dashboard is where you manage guides; **your website** is where your customers see them. Use your website’s address when adding an origin.

### Jump to a step

1. [Create your project](#1-create-your-project)
2. [Choose the right API key](#2-generate-a-publishable-key)
3. [Add your website’s origin](#3-add-your-websites-origin)
4. [Choose how to detect signed-in visitors](#4-set-up-auth-detection-if-your-guides-need-it)
5. [Publish your first workflow](#5-publish-your-first-workflow)
6. [Add the SDK to your website](#6-add-the-sdk-to-your-website)
7. [Check that everything works](#7-check-that-everything-works)
8. [Troubleshooting](#troubleshooting)

---

## 1. Create your project

Sign in to the GuideKit dashboard with Google. If this is your first visit, name your workspace, then select **New Project**.

| Field | What to enter | Why it matters |
| --- | --- | --- |
| **Project Name** | A recognizable name, such as `Customer Portal` | Keeps this app’s guides and settings together. |
| **Framework** | The tool your website uses: Next.js, React, Vue, Svelte, or plain JavaScript | Identifies the app you are integrating. Ask whoever built your site if unsure. |
| **Default Locale** | `en` for English, for example | Sets the project’s default language. |
| **Supported Locales** | `en`, or a comma-separated list such as `en, hi` | Lists the languages your guide content supports; adding a language does not translate content automatically. |
| **Origin URL** | Your app’s base address | Optional during project creation; you can add it in the next steps. |
| **Environment** | Development, Staging, or Production | Labels where that origin is used. |

Open the project and select **Keys, Origins & Auth**.

> A project is a container for one product’s guides, keys, allowed websites, and settings. The SDK’s key tells GuideKit which project to load—you do not need to pass a project ID or slug to `GuideKit.init()`.

## 2. Generate a Publishable key

Under **API Keys**:

1. Set **Key Type** to **Publishable**.
2. Give it a helpful label, such as `Customer portal website`.
3. Select **Generate Key**.
4. Copy the **full key**, not only the shortened preview in the list.

### Publishable or Secret: which should I choose?

| Key type | Plain-language meaning | Put it in the website SDK? |
| --- | --- | --- |
| **Publishable** (`gk_pk_live_…`) | The project’s public identification badge. The browser uses it to request your project’s guides. | **Yes. This is the one you need.** |
| **Secret** (`gk_sk_live_…`) | A private credential intended for supported server-side integrations. | **No. The browser SDK expects a publishable key.** |

Publishable keys are visible in browser code by design. They do not sign a visitor into your app. Secret keys must stay on a server; do not put them in HTML, frontend JavaScript, screenshots, or public environment variables such as `NEXT_PUBLIC_*` or `VITE_*`.

**If you accidentally expose a Secret key:** revoke it in the dashboard and generate a replacement if your server integration needs one. Removing it from the latest code does not invalidate an exposed key.

> **For a normal SDK installation, create only a Publishable key.** Creating both types does not make the SDK work better.

## 3. Add your website’s origin

An **origin** is the base address of a website:

```text
protocol + hostname + port, if there is one

http://localhost:5173
https://app.example.com
```

Think of **Allowed Origins** as the list of websites you expect to use this project’s SDK. GuideKit checks browser requests against this list. This helps prevent a different website from using your public key in its pages.

Under **Allowed Origins**, enter the **Origin URL**, choose its **Environment**, and select **Add**.

### Which part of my URL should I enter?

| The page you visit | Enter this origin |
| --- | --- |
| `http://localhost:5173/dashboard` | `http://localhost:5173` |
| `http://localhost:3000/settings?tab=billing` | `http://localhost:3000` |
| `https://app.example.com/invoices/123` | `https://app.example.com` |
| `https://staging.example.com/home` | `https://staging.example.com` |

Do not include a page path, query string, or `#fragment`. Add each actual origin separately; do not enter `*` or a wildcard subdomain.

**These are different origins:**

- `http://localhost:3000` and `http://localhost:5173` — different ports.
- `http://localhost:3000` and `http://127.0.0.1:3000` — different hostnames.
- `http://app.example.com` and `https://app.example.com` — different protocols.
- `https://example.com` and `https://www.example.com` — different hostnames.

If you are unsure, open your website’s browser console and run:

```js
window.location.origin
```

Copy that result into **Origin URL**. It contains the address, not a password or token.

### What does Environment do?

| Environment | Use it for |
| --- | --- |
| **Development** | Your local computer, such as `http://localhost:5173`. |
| **Staging** | A hosted test version of your app. |
| **Production** | The real website your customers use. |

The environment is a label on the origin. It does not change your app’s URL or automatically create separate content, keys, or projects.

> **Origin is not API URL.** If your app runs at `http://localhost:5173` and GuideKit’s backend runs at `http://127.0.0.1:8000`, add `http://localhost:5173` as the origin. Use `http://127.0.0.1:8000/api/v1` as the SDK’s API URL.
>
> Allowed origins are a browser integration control, not user authentication or a replacement for protecting private backend data. If the browser reports a CORS error, the GuideKit backend’s CORS configuration must also allow your app’s origin.

## 4. Set up Auth Detection if your guides need it

**Auth detection means: “How can GuideKit tell whether this visitor is already signed into my website?”**

For example, a “Create an invoice” tour might need a signed-in account. A visitor who is signed out should be prompted to sign in before following it.

This setting observes your app’s existing login state. It does not create accounts, log users in, or replace your app’s authentication system. Your Google login to the **GuideKit dashboard** is separate from your customers’ login to **your website**.

### Do I need to configure it?

| Your guides | What to do |
| --- | --- |
| Public guides anyone can follow | You can leave Auth Detection empty. Keep **Requires Authentication** off on those workflows. |
| Guides that require any signed-in account | Configure a reliable signed-in signal and enable **Requires Authentication** on those workflows. |
| Guides for a particular account type | Also configure role detection and set the workflow’s required role. |

Choose **one reliable signal** that your app already has. You do not need to configure every detection type.

### The three detection types

| Detection Type | What it looks for | What you enter | Example |
| --- | --- | --- | --- |
| **Cookie** | A named, JavaScript-readable browser cookie exists. | The cookie’s **name**, never its value. | `app_session` |
| **localStorage** | A named browser-storage entry contains a value. | The storage entry’s **key**, never its value. | `current_user` |
| **DOM Selector** | A particular element exists in the rendered page. | A CSS selector for an element shown only while signed in. | `[data-app-signed-in]` |

**Cookie, session, token—what do those words mean?**

- A **cookie** is a small piece of data stored by the browser for a website.
- A **session** is the app remembering that a visitor has signed in. Apps can represent sessions in different ways; there is no universal cookie called `session`.
- A **token** is often a private value used to prove a session. GuideKit’s detection setting needs the name of the signal to look for, not the private token itself.
- **localStorage** is a browser storage area that persists across visits. It is different from **sessionStorage**, which is scoped to a browser tab. Direct sessionStorage auth detection is not implemented in this SDK.
- The **DOM** is the page’s elements: buttons, menus, text, and other markup. A selector identifies one of those elements.

### Option A · Cookie

If your app creates a readable cookie named `app_session` after login, choose **Cookie** and enter:

```text
app_session
```

Do not enter `app_session=...` or paste the cookie’s contents.

**Important:** secure login cookies often have the `HttpOnly` flag. Browser JavaScript cannot read them, even when they appear in the browser’s cookie inspector. In that case, use a signed-in page marker instead. Keep the cookie’s security settings intact.

### Option B · localStorage

If your app already stores a user record under `current_user`, choose **localStorage** and enter:

```text
current_user
```

That entry should be removed when the visitor signs out. A preference such as `theme` or `language` is not a login signal because it may exist for signed-out visitors too.

Do not move private login tokens into localStorage just for GuideKit. Use the state your app already exposes, or the page-marker option below.

### Option C · DOM Selector

This is useful when your authentication is managed by a provider or uses HttpOnly cookies.

Have your app render a small marker **only after it knows the visitor is signed in**:

```html
<!-- Render only for a signed-in visitor; remove it after sign-out. -->
<span data-app-signed-in hidden></span>
```

Choose **DOM Selector** and enter:

```css
[data-app-signed-in]
```

GuideKit checks whether the element exists, not whether it is visible. Adding it permanently to a shared layout would incorrectly mark everyone as signed in.

### How do I find the correct cookie name or storage key?

Open your app, sign in, and use the browser’s developer tools:

1. In Chrome, open **Inspect → Application**.
2. Look under **Cookies** or **Local Storage** for your website.
3. Compare the entry names before login, after login, and after logout.
4. Choose a signal that actually follows the login state.

If someone else built your login, ask: **“Which browser-readable signal reliably tells us that this visitor is signed in?”** You only need the name or selector; do not share credential values.

### Roles: who is allowed to follow this tour?

A role is an account category, such as `admin`, `member`, `driver`, or `passenger`.

You only need role detection if workflows have a **Required Role**. For example, an admin-only billing tour needs to know whether the signed-in visitor is an admin.

The SDK can read a role from localStorage or an element’s text/attribute. It normalizes the detected role to lowercase; use matching lowercase role names in your workflow settings. Cookie-based role extraction is not implemented.

> Auth and role detection help choose relevant guides. They are browser-provided hints, not proof of permission. Your app must continue enforcing access on its backend.

<details>
<summary><strong>Current-version note: the dashboard auth form and SDK need a compatibility fix</strong></summary>

The current dashboard’s **Config Preview** uses flat fields such as:

```json
{ "type": "cookie", "cookie_name": "app_session" }
```

The SDK currently reads the nested configuration below instead. Saving the flat preview does not make that custom rule take effect in this SDK. If you need authenticated or role-specific tours today, have the project maintainer apply the supported configuration through the authenticated project-update API, then republish the manifest. For public tours, leave detection empty.

Supported cookie configuration:

```json
{
  "signed_in": { "type": "cookie", "name": "app_session" }
}
```

Supported localStorage configuration:

```json
{
  "signed_in": { "type": "localStorage", "key": "current_user" }
}
```

Supported DOM configuration, with an optional role attribute:

```json
{
  "signed_in": { "type": "dom", "selector": "[data-app-signed-in]" },
  "role_source": {
    "type": "dom",
    "selector": "[data-app-role]",
    "attribute": "data-app-role"
  }
}
```

For that role example, render an element such as `<span data-app-role="admin" hidden></span>` only with the actual signed-in account’s role.

The API request body is `{ "auth_detection_config": ... }` at `PATCH /api/v1/projects/{project_id}`. It requires the project owner/member’s authenticated developer session; the SDK publishable key is not a dashboard management credential.

The SDK also tries common localStorage names such as `token` and `access_token` as fallbacks, even when a configured rule does not match. Do not rely on those guesses as your final setup. Test both signed-in and signed-out states, especially if your site has multiple account types.

</details>

## 5. Publish your first workflow

Installing the SDK does not automatically create tours for your app.

1. Create or sync a workflow from the GuideKit VS Code extension into this project.
2. In the dashboard, open **Workflows & Steps**.
3. Review the steps, page routes, login requirement, and any required role.
4. Select **Publish Manifest to CDN**.

A **manifest** is the published bundle of guide instructions and project settings that the SDK downloads. Draft changes are not automatically available to visitors.

**After changing auth detection, republish the manifest** so the SDK receives the new rules. Refresh your app and test the updated guide.

## 6. Add the SDK to your website

Choose **one** installation method. Load the SDK once per page/app; do not add both the script tag and programmatic initialization.

### Option A · Script tag — simplest setup

Add this to your website’s HTML, using your own full publishable key:

```html
<script
  src="http://127.0.0.1:8000/sdk/guidekit-sdk.js"
  data-guidekit-key="YOUR_FULL_PUBLISHABLE_KEY"
  data-api-url="http://127.0.0.1:8000/api/v1"
  data-locale="en"
  defer
></script>
```

This is a **local development** example. The GuideKit backend must be running and its SDK bundle must have been built. The script initializes itself from the `data-*` attributes.

| Setting | What it means |
| --- | --- |
| `src` | Where the browser downloads the GuideKit SDK JavaScript. |
| `data-guidekit-key` | The full Publishable key for your project. |
| `data-api-url` | The GuideKit backend address, including `/api/v1`. |
| `data-locale` | The visitor’s guide language, such as `en`. |

For a hosted deployment, use your real HTTPS addresses instead of localhost. For example, if your GuideKit backend is hosted at `https://guidekit-api.example.com`, use `https://guidekit-api.example.com/sdk/guidekit-sdk.js` for `src` and `https://guidekit-api.example.com/api/v1` for the API URL. These example domains are placeholders, not a provided public service.

> `localhost` and `127.0.0.1` mean **the visitor’s own computer**. A production website pointing there will not reach your GuideKit server.

#### Using the script in Next.js

Add the following inside the `<body>` of your root layout, alongside your existing app content:

```tsx
import Script from 'next/script'

// Inside your existing layout's <body>:
<Script
  src="http://127.0.0.1:8000/sdk/guidekit-sdk.js"
  data-guidekit-key={process.env.NEXT_PUBLIC_GUIDEKIT_KEY}
  data-api-url="http://127.0.0.1:8000/api/v1"
  data-locale="en"
  strategy="afterInteractive"
/>
```

Set the public key in your Next.js app’s `.env.local`, then restart that app’s dev server:

```dotenv
NEXT_PUBLIC_GUIDEKIT_KEY=YOUR_FULL_PUBLISHABLE_KEY
```

### Option B · JavaScript module

If `@guidekit/sdk` is available in your configured package registry:

```bash
npm install @guidekit/sdk
```

Then initialize it in browser code after the page is ready:

```js
import { GuideKit } from '@guidekit/sdk'

await GuideKit.init({
  apiKey: 'YOUR_FULL_PUBLISHABLE_KEY',
  apiUrl: 'http://127.0.0.1:8000/api/v1',
  locale: 'en',
})
```

### Customize the guide widget

The default widget is centered above the bottom safe area. Its Shadow DOM includes compiled Tailwind CSS, so host-page styles cannot accidentally change it. Pass only the options you want to override:

```js
await GuideKit.init({
  apiKey: 'YOUR_FULL_PUBLISHABLE_KEY',
  apiUrl: 'http://127.0.0.1:8000/api/v1',
  locale: 'en',
  widget: {
    position: 'bottom-center', // bottom-center | bottom-left | bottom-right
    bottomOffset: 24,
    panelWidth: 420,
    panelHeight: 560,
    launcherLabel: 'Ask Guide',
    assistantName: 'Product help',
    maxSuggestions: 3,
    showLocaleControl: true,
    showVoiceControl: false,
    soundEnabled: true, // subtle send feedback; set false for a silent widget
    theme: {
      accent: '#52a9ff',
      accentHover: '#75bbef',
      accentText: '#06121f',
      canvas: '#0b0e13',
      surface: '#171c25',
      surfaceHover: '#1b222d',
      border: '#344052',
      text: '#f1f4f9',
      mutedText: '#b8c0ce',
    },
  },
})
```

You can update presentation later without restarting chat or tour services:

```js
GuideKit.configureWidget({
  position: 'bottom-right',
  theme: { accent: '#38bdf8' },
})

GuideKit.openWidget()
GuideKit.closeWidget()
```

Numeric dimensions are clamped to safe ranges, and the panel always stays within narrow phone viewports.

For server-rendered frameworks, load the SDK in browser-only code, after mounting. The SDK uses browser APIs and should not be imported into server components.

If the package is not published in your registry, use the script method or build this repository’s `sdk` package and install that built package locally. From the repository root:

```bash
cd sdk
npm install
npm run build
```

From your target app, install it using the actual relative path to the built SDK directory:

```bash
npm install /absolute/path/to/guidekit/sdk
```

> **Current SDK API:** use `GuideKit.init({ apiKey, apiUrl, locale, widget })`. Some dashboard quickstart snippets currently refer to `GuideKitProvider`, `initGuideKit`, `publishableKey`, or `projectSlug`; those helpers/options are not exported by this SDK version. Use the examples in this README.

## 7. Check that everything works

Run this quick acceptance check on **your app**, not just inside the GuideKit dashboard:

- [ ] The app’s exact origin is listed in the same project as the publishable key.
- [ ] The SDK script loads successfully in the browser’s **Network** panel.
- [ ] The GuideKit chat widget appears.
- [ ] `/api/v1/sdk/manifest` returns a successful response. `304 Not Modified` is also normal when a published version is cached.
- [ ] A question matching a published workflow starts the expected guide.
- [ ] A signed-out visitor gets the expected login guidance for a workflow that requires authentication.
- [ ] A signed-in visitor can follow that workflow.
- [ ] If roles matter, the correct account type gets the correct guide.
- [ ] Signing out clears your app’s login signal or removes its signed-in marker.

The widget appearing alone does not prove that the key, origin, or published manifest is correct—the widget can mount before guide data finishes loading.

### GuideKit sessions versus your app’s sessions

The SDK keeps its own visitor identifier, language preference, cached guide data, chat-session reference, and tour progress in browser storage. These help it remember a conversation or resume a guide.

**Those are not your app’s login credentials.** A `guidekit_session_id` does not mean that a visitor is authenticated to your app. Do not use it as your auth-detection signal.

---

## Troubleshooting

| What you see | What to check |
| --- | --- |
| **Invalid/revoked key**, or a `401` SDK response | Use the full **Publishable** key from the correct project. Confirm it has not been revoked. A Secret key will not work here. |
| **Origin not allowed**, or a `403` SDK response | Compare `window.location.origin` with the project’s Allowed Origins. Check protocol, hostname, and port. |
| **CORS error** | Confirm both the project origin and the backend’s CORS allowlist include your app’s origin. Ask whoever hosts the API to update the backend setting if necessary. |
| **SDK script not found**, or `404` on the `.js` URL | Check the `src` address and that the SDK bundle has been built and is being served. |
| Widget appears, but guides do not load | Check the manifest request and publish a workflow. A mounted widget can still have a failed manifest request. |
| Guide changes are missing | Publish again, then refresh your app. Saving a draft or changing auth settings alone does not update the published manifest. |
| GuideKit thinks everyone is signed out | Check the auth configuration compatibility note above. Verify the cookie is readable or use a conditional DOM marker. |
| GuideKit thinks everyone is signed in | Remove stale storage entries on logout. Make sure the DOM marker is conditional. Check the SDK’s fallback localStorage signals. |
| Admin/member guides are mixed up | Verify the actual role source and the workflow’s lowercase required role. Login detection alone does not establish a role. |
| Works locally, fails after deployment | Replace localhost SDK/API URLs with hosted HTTPS URLs, and add the production website’s exact origin. |
| `GuideKitProvider` or `initGuideKit` is not exported | Use the script method or `GuideKit.init()` shown above. |

## Ready-to-fill setup card

Copy this into your project notes before integrating:

```text
Project name:
Website framework:
Full publishable key:
Local website origin:
Production website origin:
GuideKit API URL:
SDK script URL, if using a script tag:
Guide language:

Do any workflows require login? Yes / No
If yes, detection type: Cookie / localStorage / DOM Selector
Cookie name, storage key, or selector — never a token value:

Do any workflows require a role? Yes / No
If yes, role source and expected role names:

First workflow to publish and test:
```

**Your first successful setup:** the right project, a Publishable key, your app’s allowed origin, a reachable GuideKit API, and a published guide. Add login and role detection when your workflows need that context.

