/**
 * App.tsx
 * -------
 * The outer shell. It decides which of the three screens is showing:
 *
 *   home    - the list of all your documents,
 *   editor  - one open document, with the boxes, the table and the totals,
 *   lists   - the saved words used by the drop-downs.
 *
 * It also owns the one big warning box, the question about a document that was
 * changed outside the app, and the small note that the data never leaves the
 * computer.
 */

import { useCallback, useEffect, useState } from 'react'
import { APP_NAME } from './constants'
import { EditorScreen } from './components/EditorScreen'
import { HomeScreen } from './components/HomeScreen'
import { ImportDocumentDialog } from './components/ImportDocumentDialog'
import { ListsScreen } from './components/ListsScreen'
import { NewDocumentDialog } from './components/NewDocumentDialog'
import { SetupBanner } from './components/SetupBanner'
import { AlertBox, Button, NoteBox } from './components/ui'
import { useAppStore } from './hooks/useAppStore'
import { FolderStore } from './storage/folderStore'
import type { SheetDocument } from './types'
import { chooseFileToOpen } from './utils/download'

type Screen = 'home' | 'editor' | 'lists'

export default function App() {
  const store = useAppStore()
  const [screen, setScreen] = useState<Screen>('home')
  const [openId, setOpenId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [rememberedFolder, setRememberedFolder] = useState(false)
  const [folderState, setFolderState] = useState(0) // used to re-read the remembered folder

  // The document that is open, if any.
  const openDocument = store.documents.find((document) => document.id === openId) ?? null

  // The store needs to know which document is on screen, so a change made
  // outside the app can be spotted and asked about.
  useEffect(() => {
    store.setOpenDocument(screen === 'editor' ? openId : null)
  }, [openId, screen, store.setOpenDocument])

  // The tab title follows the document, which helps when many tabs are open.
  useEffect(() => {
    document.title = openDocument ? `${openDocument.title} — ${APP_NAME}` : APP_NAME
  }, [openDocument])

  // On start-up, find out whether a folder was chosen on a previous visit.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const folder = new FolderStore()
      await folder.restoreRememberedFolder()
      if (!cancelled) setRememberedFolder(folder.isConnected())
    })()
    return () => {
      cancelled = true
    }
  }, [folderState])

  /** Opens a document and saves anything still waiting from the last one. */
  const open = useCallback(
    (id: string) => {
      if (openId) store.saveOneDocument(openId)
      setOpenId(id)
      setScreen('editor')
    },
    [openId, store],
  )

  const goHome = useCallback(() => {
    if (openId) store.saveOneDocument(openId)
    setOpenId(null)
    setScreen('home')
  }, [openId, store])

  // ------------------------------------------------------------- new document

  /** Saves a brand new document and opens it. */
  const openNewDocument = async (document: SheetDocument) => {
    const made = await store.createDocument(document)
    setOpenId(made.id)
    setScreen('editor')
    return made
  }

  const createDocument = async (document: SheetDocument) => {
    setCreating(false)
    return openNewDocument(document)
  }

  // ---------------------------------------------------------- importing a PDF

  /** Asks for a PDF file on this computer, then shows what was found in it. */
  const choosePdfToImport = async () => {
    const file = await chooseFileToOpen('.pdf,application/pdf')
    if (file) setImportFile(file)
  }

  const importDocument = async (document: SheetDocument) => {
    const made = await openNewDocument(document)
    setImportFile(null)
    return made
  }

  // ------------------------------------------------------------------ the app

  if (store.loading) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8 text-center">
        <div>
          <p className="text-xl font-bold text-ink-900">{APP_NAME}</p>
          <p className="mt-2 text-ink-500">Opening your documents…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-[1600px] px-4 py-4">
        {/* The one big warning, shown above everything else. */}
        {store.alert ? (
          <div className="screen-only">
            <AlertBox title={store.alert.title} message={store.alert.message} onClose={store.setAlert.bind(null, null)}>
              {store.mode === 'folder' && !store.connected && store.foldersSupported ? (
                <Button
                  kind="danger"
                  onClick={() => {
                    void store.connectFolder()
                  }}
                >
                  Click here to reconnect to your saved documents
                </Button>
              ) : null}
              <Button onClick={store.backupEverything}>Back up everything</Button>
            </AlertBox>
          </div>
        ) : null}

        {screen !== 'editor' ? (
          <div className="screen-only">
            <SetupBanner
              mode={store.mode}
              connected={store.connected}
              locationName={store.locationName}
              hasRememberedFolder={rememberedFolder}
              onReconnect={() => void store.connectFolder()}
              onChooseFolder={() => void store.connectFolder()}
              onBackup={store.backupEverything}
              onRestore={store.restoreFromBackup}
            />
          </div>
        ) : null}

        {screen === 'home' ? (
          <HomeScreen
            documents={store.documents}
            locationName={store.locationName}
            foldersSupported={store.foldersSupported}
            savingHint={
              store.foldersSupported
                ? 'No folder has been chosen yet. Choose one and your documents will be saved as files inside it.'
                : 'Your documents are stored inside this browser, because this browser cannot open folders.'
            }
            onOpen={open}
            onCreate={() => setCreating(true)}
            onImport={() => void choosePdfToImport()}
            onDelete={(id) => void store.deleteDocument(id)}
            onManageLists={() => setScreen('lists')}
            onBackup={store.backupEverything}
            onRestore={store.restoreFromBackup}
            onConnectFolder={() => void store.connectFolder()}
            onChooseFolder={() => {
              setFolderState((value) => value + 1)
              void store.connectFolder()
            }}
          />
        ) : null}

        {screen === 'lists' ? (
          <ListsScreen lists={store.lists} onSaveLists={store.saveLists} onBack={() => setScreen('home')} />
        ) : null}

        {screen === 'editor' && openDocument ? (
          <EditorScreen
            key={openDocument.id}
            document={openDocument}
            lists={store.lists}
            saveState={store.saveState}
            lastSavedAt={store.lastSavedAt}
            mode={store.mode}
            connected={store.connected}
            conflict={store.conflict}
            onResolveConflict={store.resolveConflict}
            onBack={goHome}
            onChangeTitle={(title) => store.updateDocument(openDocument.id, (document) => ({ ...document, title }))}
            onChangeSubtitle={(subtitle) =>
              store.updateDocument(openDocument.id, (document) => ({ ...document, subtitle }))
            }
            onAddRow={(row) => store.addRow(openDocument.id, row)}
            onUpdateRow={(rowId, values) => store.updateRow(openDocument.id, rowId, values)}
            onDeleteRow={(rowId) => store.deleteRow(openDocument.id, rowId)}
            onUndoDeleteRow={(row, index) => store.undoDeleteRow(openDocument.id, row, index)}
            onDuplicateRow={(rowId) => store.duplicateRow(openDocument.id, rowId)}
            onSetColumns={(columns) => store.setColumns(openDocument.id, columns)}
            onSetSettings={(settings) => store.setSettings(openDocument.id, settings)}
            onCreateListValue={store.addListValue}
            onDeleteDocument={async () => {
              await store.deleteDocument(openDocument.id)
              setOpenId(null)
              setScreen('home')
            }}
            onListVersions={() => store.listVersions(openDocument.id)}
            onRestoreVersion={(stamp) => store.restoreVersion(openDocument.id, stamp)}
            onSaveVersionNow={() => store.saveVersionNow(openDocument.id)}
          />
        ) : null}

        {screen === 'editor' && !openDocument ? (
          <div className="py-10 text-center">
            <NoteBox>
              That document is no longer here. It may have been deleted from your folder.
            </NoteBox>
            <div className="mt-4">
              <Button onClick={goHome}>← Back to my documents</Button>
            </div>
          </div>
        ) : null}
      </div>

      {creating ? (
        <NewDocumentDialog
          existingTitles={store.documents.map((document) => document.title)}
          onCreate={createDocument}
          onClose={() => setCreating(false)}
        />
      ) : null}

      {importFile ? (
        <ImportDocumentDialog file={importFile} onImport={importDocument} onClose={() => setImportFile(null)} />
      ) : null}
    </div>
  )
}
