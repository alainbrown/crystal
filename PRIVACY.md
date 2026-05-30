# Privacy Policy

**Last updated: May 29, 2026**

Crystal is a private, on-device AI chat panel for Chrome. It is designed so that your
conversations never leave your browser. This policy explains exactly what data Crystal
handles and what it does not.

## The short version

- Crystal runs a Qwen3.5 language model **entirely on your device** via WebGPU.
- We operate **no servers** and have **no API**. We never receive, see, or store your
  data.
- Your chats, prompts, and settings stay in your browser's local storage.
- The only network request Crystal makes is a one-time download of the model weights
  from the Hugging Face Hub.

## What Crystal stores

All storage is local to your browser, on your device. Crystal uses Chrome's
`storage.local` API and the browser's built-in cache. Specifically:

- **Settings** — your chosen model, precision, temperature, max tokens, theme, and
  other preferences, saved under a single `crystal.settings` key in
  `chrome.storage.local`.
- **Conversations** — if "Remember conversations" is enabled in settings, your chat
  history is kept in local browser storage so it persists between sessions. You can
  disable this, and clearing it removes the history.
- **Model weights** — downloaded model files are kept in the browser cache so they do
  not need to be re-downloaded on every use.

None of this data is transmitted anywhere. It is readable only by the Crystal extension
on your machine and is removed if you uninstall the extension or clear its storage.

## What Crystal sends over the network

Crystal makes exactly one kind of outbound request: downloading the model weights it
needs to run. These files are fetched from the **Hugging Face Hub** and its content
delivery hosts (`huggingface.co`, `*.hf.co`, and the associated CDN domains listed in
the extension's host permissions).

This download happens once per model; afterward the weights are served from the browser
cache. The request retrieves files — it does **not** send your prompts, conversations,
or any personal data. Your interaction with the Hugging Face Hub during this download is
governed by [Hugging Face's privacy policy](https://huggingface.co/privacy).

**Crystal sends no other network traffic.** Your prompts and the model's responses are
processed locally by WebGPU and never transmitted.

## What Crystal does not do

- It does **not** collect analytics, telemetry, or usage statistics.
- It does **not** use cookies or tracking technologies.
- It does **not** contain advertising or share data with advertisers.
- It does **not** send your conversations to us or any third party.
- It does **not** require an account, login, or API key.

## Permissions

Crystal requests only the permissions it needs to function:

- **`sidePanel`** — to display the chat UI in Chrome's side panel.
- **`storage`** — to save your settings and (optionally) conversations locally.
- **`contextMenus`** — to add the "Send to Crystal" right-click menu (screenshot
  visible area, select a region, or send page text to the chat).
- **`activeTab`** — granted only for the tab you right-click. It lets Crystal read
  that one page when you explicitly ask it to, without any standing access to your
  browsing. No page is ever touched unless you invoke the menu on it.
- **`scripting`** — to inject the one-shot region-selection overlay and the page-text
  extractor into the active tab when you choose those capture actions. Nothing is
  injected until you trigger it.
- **Host access to Hugging Face domains** — solely to download model weights.

The capture actions process everything locally: a screenshot or the extracted page
text is handed to the on-device model and is never uploaded.

## Children's privacy

Crystal does not knowingly collect any personal information from anyone, including
children, because it does not collect personal information at all.

## Changes to this policy

If this policy changes, the "Last updated" date above will be revised and the updated
policy will be published in this repository.

## Contact

Questions about this policy can be directed to the project maintainer at
**alain.brown@gmail.com**.
