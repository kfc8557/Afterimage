# Afterimage

A local visual novel web app built with Next.js.

The app includes:
- Default Mode: a local premade story, The Friction Protocol.
- Experimental AI Mode: a setup-driven story mode that is only accessible if OpenAI providers is configured.
- Local save, load, replay, and local package import/export.

## Requirements

- Node.js 20 or newer
- pnpm 9 or newer


## Install

Unzip the package, open a terminal in the project folder, then run:

```bash
pnpm install
```

## Run Locally

For the premade local story only:

```bash
TEXT_PROVIDER=stub IMAGE_PROVIDER=stub pnpm dev --hostname 0.0.0.0
```

Open in broswer:

```text
http://localhost:3000
```


## Experimental AI Mode

Experimental AI Mode needs provider configuration. To run with OpenAI, create a local `.env.local` file:

```env
OPENAI_API_KEY=<your_api_key_here>
TEXT_PROVIDER=openai
IMAGE_PROVIDER=openai
OPENAI_TEXT_MODEL=gpt-5.4-mini
OPENAI_IMAGE_MODEL=gpt-image-1-mini
```

Then run:

```bash
pnpm dev --hostname 0.0.0.0
```

Do not commit or share `.env.local`.

## Notes

- Experimental AI Mode generation can take a bit a wait time (up to 2 min).
- Save data is stored locally in the browser.
- Default Mode does not make text or image API calls.
