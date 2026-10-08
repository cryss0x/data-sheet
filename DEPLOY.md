# Putting My Data Sheet online

There are two ways. **Option 1 (drag and drop)** needs no typing of commands and
is the one to use. Option 2 is for anyone who already works with code, or who
wants the files on their own computer as well as online.

Whichever you pick, you end up with a web address that looks like
`https://data-sheet-abc123.vercel.app`, and the finished app in a folder called
`dist`.

Before you start: you need a free **GitHub** account and a free **Vercel**
account. Both sign in with Google or GitHub. Nothing here costs money, because
the app is a static website - it is just files being handed out.

---

## Option 1 - drag and drop (easiest)

### Step 1: get the files onto GitHub

1. Go to [github.com](https://github.com) and sign in.
2. Click the `+` in the top right, then **New repository**.
3. Type `data-sheet` as the name. Set it to **Private** so only you can see it.
4. Click **Create repository**.
5. On the page you land on, click the link **uploading an existing file**.
6. Open the `data-sheet` project folder on your computer, select everything
   inside it, and drag it onto that GitHub page.

   Skip these, they will not upload:

   - `node_modules`
   - `dist`
   - `.tmp-check`

7. Near the bottom of the page click **Commit changes**.

### Step 2: turn it into a website with Vercel

1. Go to [vercel.com](https://vercel.com) and sign in.
2. Click **Add New → Project**.
3. Find your `data-sheet` repository and click **Import**. If Vercel cannot find
   it, click **Adjust GitHub App Permissions** and allow it, then try again.
4. Vercel fills in the settings for you. Do not change them:

   | Setting | Value |
   |---|---|
   | Framework preset | Vite |
   | Install command | `npm install` |
   | Build command | `npm run build` |
   | Output directory | `dist` |

5. Click **Deploy**. Wait a minute or two. When the screen goes green you have a
   working web address - click it and try the app.

Vercel also does this for you every time you push, so from now on you just push
your changes and the website updates itself.

### Step 3: use it on your computer

Open the web address in Chrome or Edge. Click **Choose a folder** and point it
at a folder on your computer. Everything you type is written into that folder.

For it to be an app rather than a web page, use the install button in your
browser's address bar (the little install icon in Chrome's bar), or from the
browser menu: **Cast, save and share → Install page as app**. Installed apps get
their own window and a desktop icon, and they work with no internet.

---

## Option 2 - the command line

Useful if you want the files on your computer too, or if you want to change the
code.

```bash
# 1. Check Node.js is installed. You need version 20 or newer.
node -v

# 2. Download the project and install its pieces.
git clone https://github.com/YOUR-NAME/data-sheet.git
cd data-sheet
npm install

# 3. Check the code, then build the finished website.
npm run check
npm run build

# 4. Put the project on GitHub.
git add .
git commit -m "First version of Data Sheet"
git branch -M main
git remote add origin https://github.com/YOUR-NAME/data-sheet.git
git push -u origin main
```

If you already have the project on your computer and want to publish it, skip the
`git clone` line and make sure `node_modules`, `dist` and `.tmp-check` are not
added. The `.gitignore` in the project already keeps them out:

```bash
npm install
npm run build
git add .
git commit -m "First version of Data Sheet"
git push
```

Then carry on from **Step 2** above, from "go to vercel.com".

You can also deploy without GitHub at all. Install Vercel once, then any time:

```bash
npm i -g vercel
vercel          # asks a few questions, safe to press Enter for all of them
vercel --prod   # the real one, for other people to use
```

---

## If something goes wrong

| What you see | What it means | What to do |
|---|---|---|
| **Build failed** on Vercel | The project could not be built. The log is on the Deployments page. | Scroll up in the log to the first red line. Nine times in ten it is a typo in `package.json`, so check that `"devDependencies"` really is in square brackets. |
| **Build failed**, `Cannot find module` | `node_modules` was uploaded. | Delete the `node_modules` folder from the files you uploaded, or start again with Option 2. |
| The app loads but choosing a folder does nothing | The browser will not let it. | Use Chrome, Edge, Opera or Arc. See `HOW-TO-USE.md`. |
| A blank white page | An old version is cached. | Press `Ctrl` + `Shift` + `R`. Then close the app and open it again. |
| Changes on GitHub are not live | The build failed, or it is still building. | Check the Deployments page for a red X. |
| The website opens but shows the old version | The service worker is holding on to the old copy. | Close every tab of the app, then open it again. |
| `vercel` says `command not found` | It is not installed. | `npm i -g vercel`, then close and reopen the terminal. |

---

## Where the data lives

The app has no server and no database, so there is nothing to configure and no
backup to pay for. The folder you pick on your computer holds the real files, one
`.json` per document.

If that folder is in Google Drive, OneDrive or Dropbox, the same documents show
up on your other computers, because the syncing tool copies the folder for you.
That is also the whole backup plan: your folder, in your cloud drive.

The only copy the app keeps itself is a quick safety net in the browser's own
storage, so a closed tab or a crash cannot lose a row you just typed. Use
**Back up everything** on the home page to turn that safety net into a file you
can put somewhere safe.