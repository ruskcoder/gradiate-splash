# Gradiate Splash Page

Gradiate is your favorite grade calculator, designed to help students easily calculate their grades and manage their academic performance.
This is the splash page hosted on [https://gradiate.com/](https://gradiate.com/)

## Setup Instructions

1. Clone the repository:
   ```
   git clone <repository-url>
   ``` 

2. Navigate to the project directory:
   ```
   cd gradiate-app
   ```

3. Run `npx wrangler dev` and open the URL it prints (links like `/districts` need a server).

## Deploying

The site is a static-assets-only Cloudflare Worker (`wrangler.jsonc`): `npx wrangler deploy`. Files listed in `.assetsignore` are not published; `_headers` sets CORS on `districts.json` for the web and mobile apps.
