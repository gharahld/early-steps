import { useCallback, useEffect, useState } from 'react'
import { getProfile, saveProfile } from '../lib/localStore.js'

/** Provider name, title and license, saved once on this device and reused on both forms. */
export function useProviderProfile() {
  const [profile, setProfile] = useState({ name: '', title: '', license: '' })
  const [loaded,  setLoaded]  = useState(false)

  useEffect(() => {
    setProfile(getProfile())
    setLoaded(true)
  }, [])

  const save = useCallback((next) => {
    const saved = saveProfile(next)
    setProfile(saved)
    return saved
  }, [])

  return { profile, loaded, saveProfile: save }
}
