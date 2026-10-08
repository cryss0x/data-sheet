# How to use My Data Sheet

## 1. The one page version

Everything you need is on this page.

**To start.** Open the app. Click **Reconnect to your saved documents** (or **Choose a
different folder**) and pick a folder on your computer - a new folder called
`My Data Sheet` inside your Documents is a good place. The app needs
Chrome, Edge, Opera or Arc for this. If it cannot choose a folder, it saves
inside the browser instead and still works - see section 4.

**To make a document.** Click **+ New document**. Give it a title, then choose a
template or a blank page. Every change you make from now on is saved for you.

**To add columns.** Click **Design columns** in the toolbar. Add a column, give it a
name, and choose what goes in it:

| Type | Use it for | Adds up at the bottom? |
|---|---|---|
| Text | Descriptions, names, notes | No |
| Date | Any day, or words like `July 2026` | No |
| Amount | Money: salaries, fuel, maintenance | Yes, and into the grand total |
| Quantity | A number like litres or trips | Yes, kept out of the grand total |
| Pick from list | One saved word chosen from a list | No |
| Pick several from list | One box holding several words | No |

Money and quantity boxes ignore anything that is not a number, so a note in the
wrong place cannot break your totals.

**To type rows.** Fill in the row along the top and press **Add row** or the
`Enter` key. Two boxes below the row save you work: **Keep the same date for the
next row**, so today's date stays for the whole day, and **Repeat the previous
row's words**, so the same driver and truck fill themselves in for every trip
of that trip. Untick either one if it gets in the way.

**To fix a mistake.** The app asks before it deletes a row, and a deleted row can
be put straight back with **Undo the delete**. Older copies of the whole document are kept
in the `_history` folder - click **Restore an earlier version** to bring one
back.

**To save a copy.** Click **⬇ Export PDF** for a file, or **🖨 Print** for paper. The
PDF has your title at the top, the totals at the bottom and a page number on
every page.

**To keep it safe.** Put the folder you chose in Google Drive, OneDrive or
Dropbox and your documents follow you to the other computer. Click **Back up
everything** on the home page for a single file you can keep as a spare.

---

## 2. Things that save you time

**Typing the same value again?** Start typing a value the app has not seen
before and it offers what you used before. `T537EER` brings up **Did you mean
T537 EBR?** - click **Use T537 EBR** and the box is filled in.

**Typing numbers with commas.** Type `405200`, `405,200` or `405.50` - the box shows
`405,200` as you go, and all three add up the same. Anything that is not a
number is ignored, so a total can never come out broken.

**One row, several trucks.** Use a **Pick several from list** column. A row can then
hold `T537 EBR, T715 EQQ, T123 ABC` together, and the amount columns on that
line still add up as one amount.

**Filling in a truck's driver?** In **Design columns**, tick **Fill this
automatically from a saved list** on the `Driver Name` column, then choose
**Trucks** and **Driver Name**. Now choosing a truck fills in the driver by
itself. Do the same for `Phone Number`, and both fill in at once. New trucks you
type are added to the list as you go.

**A long list of trucks or drivers?** Click **Manage lists** on the home page.
Add them once there and every document can use them.

**Repeating words down a column?** Turn on **Group rows**. A word repeated on
the lines below it is shown once, the money underneath is still added up, and
the PDF prints the same tidy way.

**Lost in a long sheet?** Use **Find rows** in the toolbar: pick a truck, a driver or
a date and only those lines show. **Show rows in date order** puts the oldest or
newest first. Neither one changes the order in your file.

---

## 3. Reading the small signs

| What you see | What it means |
|---|---|
| `Ready` (grey) | Nothing has changed yet. |
| `Saving…` (amber) | A row was typed and is being written. |
| `Saved ✓ 10:42` (green) | Everything is written. Nothing to do. |
| `Not saved — see the red message` (red) | Something went wrong writing. The message on the screen says what. |
| `Not in your folder yet — it will go up when you reconnect` | The folder is not connected. See section 4. Nothing is lost. |
| `Folder not connected` on a red badge | The app cannot reach the folder. Click **Reconnect to your saved documents**. |
| `This document changed somewhere else` | Somebody, or another computer, changed it. Choose which version to keep. |

---

## 4. Which browsers work, and what to do about it

Your files are saved as normal files inside a folder you choose. Only some
browsers allow a website to use a folder. That is the browser's rule, not
something the app can change.

| Browser | Choose a folder | Where data is saved | Offline |
|---|---|---|---|
| Chrome - Windows, Mac, Linux, Android | Yes | Your folder | Yes |
| Edge - Windows, Mac | Yes | Your folder | Yes |
| Opera, Arc, Brave | Yes | Your folder | Yes |
| Firefox - any computer | No | Inside the browser | Yes |
| Safari - Mac and iPhone | No | Inside the browser | Partly |
| Any browser on iPhone | No | Inside the browser | Partly |

**If you use Firefox or Safari**, the app still works. The badge says
`Saved in this browser` and everything is stored inside the browser. It is fast
and safe from crashes, but remember three things:

- the files live only on this device and this browser;
- clearing the browser's data deletes them;
- they are not shared with another computer or another browser.

So click **Back up everything** on the home page from time to time, keep the file,
and use **Restore from backup** to put it back. On a phone, the same advice
applies.

**If you must use another computer too**, use Chrome or Edge and a folder in
Google Drive, OneDrive or Dropbox.

**As an installed app.** Chrome, Edge and Opera can install the site as an app
with its own window and desktop icon. In Chrome, click the install icon in the
address bar, or use the menu: **Cast, save and share → Install page as app**.
Once installed it opens and works with no internet. On iPhone, use
**Share → Add to Home Screen**; it will open with no internet but, like Safari,
keeps its files inside the browser.

**A note on shared computers.** Anyone using the same browser profile on the
same computer can get at what the app saved in the browser. Your folder is not
like that - it is only as open as that folder is.

---

## 5. If something looks wrong

| Problem | What to try |
|---|---|
| The badge says `Folder not connected` | Click **Reconnect to your saved documents** in the banner or on the home page, and pick the folder again. |
| A document is missing | Check the folder on your computer. The app reads the folder again every few seconds, so fix whatever is wrong with the file and it will appear. |
| A file was changed somewhere else | The app will not choose for you. Open the two versions and keep the right one, or take one from **Restore an earlier version**. |
| Totals look wrong | Money and quantity are added separately, and only `Money` columns go into the grand total. Check the column type in **Design columns**. |
| A total looks like `NaN` | Tell us - it is a bug, and it should not be possible. Empty boxes are ignored. |
| The PDF is missing a row | It prints what the table is showing. Set **Find rows** back to **All** first. |
| The app looks out of date after I changed the code | Close every tab of the app and open it again. |
| I want to start again | Delete the documents you do not want, either in the app or in your folder. Both places are cleaned up. |

---

## 6. Where your files are, in one picture

```
Your folder                     <- you choose this, e.g. Documents/Data Sheet
├── TOTAL EXPENSES OF KBL TRUCKS SEPTEMBER.json   one document
├── EXPENSES.json                              another document
├── _lists.json                 the values used by your lists
└── _history/                   the last five older copies of each document
```

Every file is plain text, so you can look inside it, copy it, or move it
somewhere else whenever you like. Nothing is locked up in this app.