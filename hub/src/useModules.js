import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

export function useModules(session) {
  const [modules, setModules] = useState([])
  const [loading, setLoading] = useState(true)

  async function charger() {
    setLoading(true)
    const { data, error } = await supabase
      .from('modules')
      .select('*')
      .order('ordre')
    if (!error) setModules(data)
    setLoading(false)
  }

  useEffect(() => {
    if (session) {
      charger()
    }
  }, [session])

  async function basculer(id, actif) {
    await supabase.from('modules').update({ actif }).eq('id', id)
    charger()
  }

  return { modules, loading, basculer, recharger: charger }
}