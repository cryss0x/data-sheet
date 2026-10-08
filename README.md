# My Data Sheet

A small tool for typing rows of data into tables, exactly like a notebook in
Excel but much simpler. It saves itself as you type, works out the totals for
you, and can print or save a PDF.

It is a normal website. There is no account, no monthly fee, no server and no
database. **Your data stays on this computer.**

---

## What it does

- **Make any document you like.** Give a document a title, then add columns.
  Each column can be words, a date, money, a quantity, a picked-from-a-list
  box, or a box that holds several answers at once.
- **Start from a ready-made template**, or build your own from a blank page.
- **It adds up the money for you.** Money columns are totalled at the bottom
  of the table, and there is a grand total. Quantity columns are counted
  separately so litres and bags never get mixed up with shillings.
- **It saves itself while you type.** A full row is written to your folder
  about one second after you finish it. You never need to press "Save".
- **It follows your folder.** Keep the folder in Google Drive, OneDrive,
  Dropbox or anything else that syncs to another computer, and the same
  document is there when you open the app somewhere else.
- **It notices outside changes.** Edit a file in Excel while it is open, or
  delete it, and the app tells you and refreshes itself.
- **Multiple values in one cell.** One row can hold several trucks, several
  drivers or several descriptions - useful for trips with more than one truck.
- **Typed-once suggestions.** When you start typing a value the app offers
  similar ones you used before, so `T537EER` offers `T537 EBR`.
- **Linked lists.** Make `Truck Number` pull from a list, and the driver and
  phone number can fill themselves in.
- **Old versions are kept.** The last five copies of every document are saved
  in a `_history` folder, so you can go back if you delete the wrong row.
- **Group repeated rows.** Turn on grouping and repeated words are shown once,
  with the money still added up underneath.
- **Print and PDF.** Print on paper, or save a tidy PDF with the title, the
  totals and page numbers.
- **Keeps working offline.** Once it is installed, it opens and works with no
  internet, and keeps syncing to your folder whenever you are back online.

---

## Getting it onto a website of your own

You do not need to know how websites work. There are two ways, both about five
minutes. Pick **Option 1** unless you already use the command line.

| | Option 1: drag and drop | Option 2: the command line |
|---|---|---|
| You need | A GitHub account and a Vercel account | Node.js, a GitHub account, a Vercel account |
| Hardest part | Copying and pasting one link | Typing four commands |
| Full guide | [DEPLOY.md](DEPLOY.md) | [DEPLOY.md](DEPLOY.md) |

A free Vercel account is enough. This is a static site, so it will not cost
anything to host unless you go far beyond ordinary use.

---

## Running it on your own computer

You need [Node.js](https://nodejs.org) version 20 or newer.

```bash
npm install     # once, to fetch the pieces
npm run dev     # start it, then open the address it prints
```

Useful commands:

| Command | What it does |
|---|---|
| `npm install` | Fetches the pieces the app needs. Do this once. |
| `npm run dev` | Starts the app for trying it out, at `http://localhost:5173`. |
| `npm run build` | Checks the code and builds the finished website into `dist/`. |
| `npm run preview` | Opens the finished build so you can see the real thing. |
| `npm run check` | Runs the automatic checks on totals, hints and the PDF. |
| `npm run icons` | Redraws the app icons. Only needed if the icon changes. |

The finished site is just the `dist` folder. Anything that can serve static
files can host it, so Vercel is only the easiest choice, not the only one.

---

## How it saves your work

This is the one part worth understanding.

When you choose a folder, the app asks your browser for permission to use that
folder and to keep that permission next time. **The folder you choose is the
real copy.** One document is one plain `.json` file with the title inside it, so
your files work in Excel, Notepad, Google Sheets or anywhere else.

If you ever say no, or use a browser that will not ask, the app falls back to
saving inside the browser itself. That still works and the green badge says
`Saved in this browser`, but those files live only on this device and this
browser, and clearing the browser's data deletes them. Use
**Back up everything** on the home page to keep a copy you can put back later.

To use the same documents on two computers, choose the same synced folder on
both. The app never overwrites your work quietly: if a file changed on one
computer while it was open elsewhere, it asks first.

---

## The checks

`npm run check` proves the parts that would be expensive to get wrong: the
grand total really is 5,140,380 for the 12-column, 40-row September example,
empty boxes never break a total, `T537EBR` and `t537 ebr` are the same truck,
choosing a truck fills in the driver, and the PDF is a real, readable file with
the title, totals and page numbers in it. Add `WRITE_PDF=1` to leave a sample
PDF behind to open and look at.

---

## Which browsers work

Full support in **Chrome, Edge, Opera and Arc** on a computer, and in Chrome on
Android. **Firefox and Safari** work, but they will not let you choose a
folder, so the app saves inside the browser instead and you use the backup
buttons. Phones other than Android cannot save to a folder at all.

| Browser | Pick a folder | Save inside browser | Works offline |
|---|---|---|---|
| Chrome (computer + Android) | Yes | Yes | Yes |
| Edge, Opera, Arc | Yes | Yes | Yes |
| Firefox | No | Yes | Yes |
| Safari | No | Yes | Partly |
| iPhone, Firefox on iPhone | No | Yes | Partly |

Full details, and what to do instead, are in [HOW-TO-USE.md](HOW-TO-USE.md).

---

## For anyone reading the code

React 19, TypeScript in strict mode, Vite, Tailwind CSS 4, jsPDF for the
report. No router, because there are no pages to navigate between - one home
screen, one editor, one list screen. The interesting parts are:

- `src/hooks/useAppStore.ts` - all state, autosave, syncing and conflict checks
- `src/storage/folderStore.ts` - writing real files into a real folder
- `src/storage/localStore.ts` - the browser-only fallback
- `src/utils/totals.ts` - all the adding up, grouping, finding and sorting
- `src/utils/links.ts` - filling one column from another
- `src/pdf/exportPdf.ts` - the PDF report
- `scripts/check.mjs` - the automatic checks