/**
 * types/file-system-access.d.ts
 * -----------------------------
 * TypeScript's built-in browser types know about file handles but not about the
 * "choose a folder" window. These few lines describe the extra parts we use, so
 * the project type-checks cleanly. They describe a browser feature - they do not
 * add any code to the app.
 *
 * The feature works in Chrome and Edge (on a computer). Firefox and Safari do
 * not have it, and the app notices and uses a different way of saving instead.
 */

interface FileSystemHandlePermissionDescriptor {
  mode?: 'read' | 'readwrite'
}

interface FileSystemHandle {
  /** Asks the browser whether we may use this folder. */
  queryPermission?(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>
  /** Shows the browser's "allow?" question for this folder. */
  requestPermission?(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>
}

interface DirectoryPickerOptions {
  id?: string
  mode?: 'read' | 'readwrite'
  startIn?: string | FileSystemHandle
}

/** Opens the browser's "choose a folder" window. */
declare function showDirectoryPicker(options?: DirectoryPickerOptions): Promise<FileSystemDirectoryHandle>
