# Chrome Web Store — dashboard justification strings

Paste these into the "Privacy practices" tab of the developer dashboard. Each
declared permission needs a justification; reviewers compare them against actual usage.

## Single purpose

> Crystal is a private, on-device AI chat side panel. A multimodal language model
> runs entirely in the browser via WebGPU, so prompts and responses never leave the
> device. Users can also right-click a page to send a screenshot, a selected region,
> or the page's text into the chat.

## Permission justifications

**sidePanel**
> Crystal's entire UI is a chat panel rendered in Chrome's side panel; this permission
> is required to open and display it.

**storage**
> Stores the user's settings (chosen model, precision, temperature, theme) and,
> optionally, their chat history in local `storage.local`. No data is transmitted.

**contextMenus**
> Adds the "Send to Crystal" right-click menu so users can send a screenshot, a
> selected screen region, or the current page's text into the chat.

**activeTab**
> Granted only for the tab the user right-clicks. It lets Crystal capture or read that
> single page when the user explicitly invokes the context menu, avoiding any broad,
> standing host access to the user's browsing.

**scripting**
> Injects a one-shot region-selection overlay and a page-text extractor into the active
> tab when the user chooses the "select a region" or "send page text" actions. Nothing
> is injected until the user triggers it.

## Host permission justification

**huggingface.co / *.hf.co / CDN hosts**
> Used solely to download the AI model weights once from the Hugging Face Hub. The
> weights are data, cached by the browser after first download. No prompts, page
> content, or personal data are ever sent to these or any other hosts.

## Data usage disclosures (certification checkboxes)

- Does NOT collect or use data for purposes unrelated to the single purpose.
- Does NOT sell or transfer user data to third parties.
- Does NOT use or transfer data for creditworthiness / lending.
- "Does your extension handle personal/sensitive user data?" — No data leaves the
  device; all processing is local. (If chat content counts as "handled," disclose it
  as stored locally only, never transmitted.)

## Remote code

> Crystal executes no remote code. All JavaScript and WebAssembly is bundled in the
> package. The only network fetch is the model weights (data), loaded by
> onnxruntime-web / transformers.js from the Hugging Face Hub.

## Privacy policy URL

Host `PRIVACY.md` at a public URL (e.g. the GitHub raw/blob link) and enter it in the
listing.
