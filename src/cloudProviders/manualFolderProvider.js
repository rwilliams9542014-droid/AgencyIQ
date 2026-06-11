export const manualFolderProvider = {
  id: 'manual_folder',
  status: 'active',
  open(folderUrl) {
    window.open(folderUrl, '_blank', 'noopener,noreferrer')
  },
}
