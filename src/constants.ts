/**
 * constants.ts
 * ------------
 * Fixed words, file names and the "Quick start" examples used by the app.
 */

import type { ColumnType, SavedList, SheetSettings } from './types'

/** App name shown in the header and on the install button. */
export const APP_NAME = 'My Data Sheet'

/** The short privacy note shown in the footer. */
export const PRIVACY_NOTE = 'Your data stays on this computer.'

/** The file that holds all the saved lists (drop-down lists). */
export const LISTS_FILE = '_lists.json'

/** The folder (inside the chosen folder) that holds the older copies. */
export const HISTORY_FOLDER = '_history'

/** How many older copies of each document we keep. */
export const KEEP_VERSIONS = 5

/** How often we look at the folder to see if anything changed there. */
export const SYNC_INTERVAL_MS = 10_000

/** How long we wait after the last keystroke before saving (about one second). */
export const AUTOSAVE_DELAY_MS = 900

/** A quick way to describe a column type in the column designer. */
export const COLUMN_TYPES: { value: ColumnType; label: string; hint: string }[] = [
  { value: 'text', label: 'Text', hint: 'Any words you like' },
  { value: 'date', label: 'Date', hint: 'A date, or words like "July 2026"' },
  { value: 'amount', label: 'Amount', hint: 'Money - goes into the grand total' },
  { value: 'quantity', label: 'Quantity', hint: 'A number like litres or trips - not in the grand total' },
  { value: 'pick', label: 'Pick from list', hint: 'Choose one saved word from a list' },
  { value: 'multi', label: 'Pick several from list', hint: 'One box can hold several words' },
]

/** The default settings of a brand new document. */
export const DEFAULT_SETTINGS: SheetSettings = {
  groupRows: false,
  keepDate: true,
  repeatLast: true,
  showRowCount: false,
  sortMode: 'none',
}

/**
 * A "Quick start" example. Each one is only a starting point - every column can
 * be renamed, moved or removed afterwards.
 */
export interface Template {
  key: string
  label: string
  description: string
  columns: { name: string; type: ColumnType; listName?: string }[]
}

export const TEMPLATES: Template[] = [
  {
    key: 'expenses',
    label: 'Expenses',
    description: 'Money spent for a fleet of trucks, day by day.',
    columns: [
      { name: 'Date', type: 'date' },
      { name: 'Description', type: 'text' },
      { name: 'Truck Number', type: 'pick', listName: 'Trucks' },
      { name: 'Mileage', type: 'amount' },
      { name: 'Salary', type: 'amount' },
      { name: 'Maintenance', type: 'amount' },
      { name: 'Road Offence', type: 'amount' },
      { name: 'Fine / Parking', type: 'amount' },
      { name: 'Other Expenses', type: 'amount' },
      { name: 'Quantity (Litres)', type: 'quantity' },
      { name: 'Fuel', type: 'amount' },
      { name: 'Spare Parts', type: 'amount' },
    ],
  },
  {
    key: 'transport',
    label: 'Transport report',
    description: 'Trips made, with the driver and truck for each trip.',
    columns: [
      { name: 'SN', type: 'text' },
      { name: 'Driver Name', type: 'pick', listName: 'Drivers' },
      { name: 'Truck Number', type: 'pick', listName: 'Trucks' },
      { name: 'Description', type: 'text' },
      { name: 'Number of Trips', type: 'quantity' },
    ],
  },
  {
    key: 'drivers',
    label: 'Drivers list',
    description: 'Which driver is on which truck, with a phone number.',
    columns: [
      { name: 'Truck Number', type: 'pick', listName: 'Trucks' },
      { name: 'Driver Name', type: 'text' },
      { name: 'Phone Number', type: 'text' },
    ],
  },
  { key: 'blank', label: 'Blank', description: 'Start empty and add my own columns.', columns: [] },
]

/**
 * The lists that exist on a new installation, so the drop-downs are never empty
 * and the app can show a sensible first screen. All of these can be changed or
 * emptied on the "Manage lists" screen.
 */
export const STARTER_LISTS: SavedList[] = [
  {
    name: 'Trucks',
    items: [
      { value: 'T537 EBR', linked: {} },
      { value: 'T715 EQQ', linked: {} },
      { value: 'T123 ABC', linked: {} },
    ],
  },
  {
    name: 'Drivers',
    items: [
      { value: 'RAMADHAN HASSAN MJATA', linked: {} },
      { value: 'JOSEPH MBALAME', linked: {} },
      { value: 'SAID MWINJUMAE', linked: {} },
    ],
  },
  {
    name: 'Descriptions',
    items: [
      { value: 'Police Offence', linked: {} },
      { value: 'Labour Charge', linked: {} },
      { value: 'Transport and Accommodation', linked: {} },
    ],
  },
]

/** The default names offered when the user creates a new list. */
export const SUGGESTED_LIST_NAMES = ['Trucks', 'Drivers', 'Descriptions', 'Places', 'Phone Numbers']
