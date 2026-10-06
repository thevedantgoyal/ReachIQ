/** localStorage helpers for user preferences and campaign defaults. */

export const SETTINGS_KEY = 'reachiq_settings'
export const BATCH_KEY = 'reachiq_default_batch'
export const CANDIDATE_NAME_KEY = 'reachiq_candidate_name'
export const ROLE_KEY = 'reachiq_default_role'
export const RESUME_PATH_KEY = 'reachiq_resume_path'

const DEFAULTS = {
  defaultBatch: 30,
  candidateName: '',
  role: 'Software Development Engineer',
  resumePath: '',
}

export function loadSettings() {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      return { ...DEFAULTS, ...parsed }
    }
  } catch {
    /* ignore invalid JSON */
  }

  return {
    defaultBatch: parseInt(localStorage.getItem(BATCH_KEY) || '30', 10) || 30,
    candidateName: localStorage.getItem(CANDIDATE_NAME_KEY) || '',
    role: localStorage.getItem(ROLE_KEY) || DEFAULTS.role,
    resumePath: localStorage.getItem(RESUME_PATH_KEY) || '',
  }
}

export function saveSettings(settings) {
  const payload = {
    defaultBatch: settings.defaultBatch,
    candidateName: settings.candidateName,
    role: settings.role,
    resumePath: settings.resumePath,
  }
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(payload))
  localStorage.setItem(BATCH_KEY, String(settings.defaultBatch))
  localStorage.setItem(CANDIDATE_NAME_KEY, settings.candidateName)
  localStorage.setItem(ROLE_KEY, settings.role)
  localStorage.setItem(RESUME_PATH_KEY, settings.resumePath)
}
