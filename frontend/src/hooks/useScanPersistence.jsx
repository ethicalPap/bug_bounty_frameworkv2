/**
 * useScanPersistence - Shared hook for persisting scan state
 * Used by all scanner pages to save/restore scan logs and progress
 */

import { useState, useEffect, useCallback } from 'react'

const STORAGE_PREFIX = 'scan_state_'

/**
 * Hook for persisting scan state across navigation
 * @param {string} pageKey - Unique key for the page (e.g., 'subdomain', 'livehosts', 'content', 'ports', 'vulns')
 * @param {object} initialState - Initial state values
 */
export function useScanPersistence(pageKey, initialState = {}) {
  const storageKey = `${STORAGE_PREFIX}${pageKey}`
  
  // Load persisted state
  const loadState = () => {
    try {
      const saved = localStorage.getItem(storageKey)
      if (saved) {
        const parsed = JSON.parse(saved)
        return {
          ...initialState,
          ...parsed,
          // Always start with isScanning false (can't persist active scans)
          isScanning: false
        }
      }
    } catch (e) {
      console.error(`Error loading ${pageKey} scan state:`, e)
    }
    return initialState
  }

  const [state, setState] = useState(loadState)

  // Save state whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify({
        ...state,
        savedAt: new Date().toISOString()
      }))
    } catch (e) {
      console.error(`Error saving ${pageKey} scan state:`, e)
    }
  }, [state, storageKey])

  // Update specific fields
  const updateState = useCallback((updates) => {
    setState(prev => ({ ...prev, ...updates }))
  }, [])

  // Add log entry
  const addLog = useCallback((message, type = 'info') => {
    const newLog = {
      timestamp: new Date().toISOString(),
      message,
      type // info, success, error, warning
    }
    setState(prev => ({
      ...prev,
      logs: [...(prev.logs || []), newLog]
    }))
  }, [])

  // Clear all state
  const clearState = useCallback(() => {
    localStorage.removeItem(storageKey)
    setState(initialState)
  }, [storageKey, initialState])

  // Get last saved time
  const getSavedAt = useCallback(() => {
    try {
      const saved = localStorage.getItem(storageKey)
      if (saved) {
        const parsed = JSON.parse(saved)
        return parsed.savedAt
      }
    } catch (e) {
      return null
    }
  }, [storageKey])

  return {
    state,
    setState,
    updateState,
    addLog,
    clearState,
    getSavedAt,
    hasPersistedState: !!localStorage.getItem(storageKey)
  }
}

/**
 * Get all scan states across pages
 */
export function getAllScanStates() {
  const pages = ['autoscan', 'subdomain', 'livehosts', 'content', 'ports', 'vulns']
  const states = {}
  
  pages.forEach(page => {
    try {
      const saved = localStorage.getItem(`${STORAGE_PREFIX}${page}`)
      if (saved) {
        states[page] = JSON.parse(saved)
      }
    } catch (e) {
      // Ignore errors
    }
  })
  
  return states
}

/**
 * Clear all scan states
 */
export function clearAllScanStates() {
  const pages = ['autoscan', 'subdomain', 'livehosts', 'content', 'ports', 'vulns']
  pages.forEach(page => {
    localStorage.removeItem(`${STORAGE_PREFIX}${page}`)
  })
  // Also clear the autoscan_state key used by AutoScan
  localStorage.removeItem('autoscan_state')
}

export default useScanPersistence