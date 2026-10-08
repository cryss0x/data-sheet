/**
 * components/SetupBanner.tsx
 * --------------------------
 * The bar at the top of the app that explains where the work is kept, and gives
 * one clear button when the browser needs to be told about the folder again.
 *
 * Three situations are possible:
 *   - the folder is connected: nothing to show, everything is fine;
 *   - the browser has forgotten the folder (this happens every time the browser
 *     is closed): one button, "Reconnect to your saved documents";
 *   - the browser cannot open folders at all (Firefox, Safari, phones): a
 *     friendly explanation, the work is still kept in the browser, and the two
 *     backup buttons are offered.
 */

import { Button, Card } from './ui'

export function SetupBanner({
  mode,
  connected,
  locationName,
  hasRememberedFolder,
  onReconnect,
  onChooseFolder,
  onBackup,
  onRestore,
}: {
  mode: 'folder' | 'browser'
  connected: boolean
  locationName: string
  hasRememberedFolder: boolean
  onReconnect: () => void
  onChooseFolder: () => void
  onBackup: () => void
  onRestore: () => Promise<{ documents: number } | null>
}) {
  // Everything is fine: show nothing.
  if (mode === 'folder' && connected) return null

  if (mode === 'browser') {
    return (
      <Card className="mb-4 border-brand-200 bg-brand-50 p-4">
        <p className="font-bold text-brand-900">Your work is being kept in this browser</p>
        <p className="mt-1 text-sm text-brand-900">
          This browser cannot open folders on your computer, so your documents are stored inside the browser
          itself. Everything still works, and nothing is sent anywhere. To move your work to another computer,
          save a backup file below and open it there.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button kind="primary" onClick={onBackup}>
            Save a backup file
          </Button>
          <Button
            onClick={async () => {
              await onRestore()
            }}
          >
            Open a backup file
          </Button>
        </div>
      </Card>
    )
  }

  if (hasRememberedFolder) {
    return (
      <Card className="mb-4 border-amber-300 bg-amber-50 p-4">
        <p className="font-bold text-amber-900">Please reconnect to your saved documents</p>
        <p className="mt-1 text-sm text-amber-900">
          When the browser is closed it forgets which folder you chose, so it asks once more each time you
          come back. Your documents are still safe in the folder
          {locationName ? ` called “${locationName}”` : ''}.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button kind="primary" big onClick={onReconnect}>
            Click here to reconnect to your saved documents
          </Button>
          <Button onClick={onChooseFolder}>Choose a different folder</Button>
        </div>
      </Card>
    )
  }

  return (
    <Card className="mb-4 border-brand-200 bg-brand-50 p-4">
      <p className="font-bold text-brand-900">Choose where to keep your documents</p>
      <p className="mt-1 text-sm text-brand-900">
        Pick one folder on your computer, for example one called “My Data Sheets”. Every document becomes one
        small file inside it, and you will be able to see, copy and back up your own work. Nothing is ever
        sent to the internet.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button kind="primary" big onClick={onChooseFolder}>
          Choose my folder
        </Button>
      </div>
    </Card>
  )
}
