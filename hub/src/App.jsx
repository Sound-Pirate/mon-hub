import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { useModules } from './useModules'
import { Admin } from './Admin'
import { Planning } from './Planning'
import { Notes } from './Notes'
import './App.css'

function App() {
  const [session, setSession] = useState(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [vue, setVue] = useState('hub') // 'hub' ou 'admin'
  const { modules, loading, basculer } = useModules(session)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: listener } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => listener.subscription.unsubscribe()
  }, [])

  async function handleLogin() {
    setMessage('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setMessage('Erreur : ' + error.message)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
  }

  if (!session) {
    return (
      <div style={{ maxWidth: 320, margin: '80px auto', textAlign: 'center' }}>
        <h1>Mon Hub</h1>
        <p>Connecte-toi pour accéder à ton espace.</p>
        <input type="email" placeholder="Email" value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ display: 'block', width: '100%', margin: '8px 0', padding: 8 }} />
        <input type="password" placeholder="Mot de passe" value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ display: 'block', width: '100%', margin: '8px 0', padding: 8 }} />
        <button onClick={handleLogin} style={{ width: '100%', padding: 10, marginTop: 8 }}>
          Se connecter
        </button>
        {message && <p style={{ color: 'crimson' }}>{message}</p>}
      </div>
    )
  }
   if (vue === 'notes') {
    return <Notes onRetour={() => setVue('hub')} />
  }
  if (vue === 'planning') {
    return <Planning onRetour={() => setVue('hub')} />
  }
  if (vue === 'admin') {
    return <Admin modules={modules} basculer={basculer} onRetour={() => setVue('hub')} />
  }

  const modulesActifs = modules.filter((m) => m.actif)

  return (
    <div style={{ maxWidth: 800, margin: '40px auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Mon Hub</h1>
        <div>
          <button onClick={() => setVue('admin')} style={{ marginRight: 8 }}>⚙️ Admin</button>
          <button onClick={handleLogout}>Se déconnecter</button>
        </div>
      </div>
      <p>Connecté en tant que <strong>{session.user.email}</strong></p>

      {loading ? (
        <p>Chargement…</p>
      ) : modulesActifs.length === 0 ? (
        <p>Aucune application active. Va dans ⚙️ Admin pour en activer.</p>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 24 }}>
          {modulesActifs.map((m) => (
            <div key={m.id}
              style={{ width: 140, height: 140, border: '1px solid #ddd', borderRadius: 12,
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', cursor: 'pointer' }}
              onClick={() => m.id === 'planning' ? setVue('planning') : m.id === 'notes' ? setVue('notes') : alert('Bientôt : ' + m.nom)}>
              <div style={{ fontSize: 48 }}>{m.icone}</div>
              <div style={{ marginTop: 8 }}>{m.nom}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default App