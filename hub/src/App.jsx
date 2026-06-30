import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import './App.css'

function App() {
  const [session, setSession] = useState(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
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
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ display: 'block', width: '100%', margin: '8px 0', padding: 8 }}
        />
        <input
          type="password"
          placeholder="Mot de passe"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ display: 'block', width: '100%', margin: '8px 0', padding: 8 }}
        />
        <button onClick={handleLogin} style={{ width: '100%', padding: 10, marginTop: 8 }}>
          Se connecter
        </button>
        {message && <p style={{ color: 'crimson' }}>{message}</p>}
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 600, margin: '80px auto', textAlign: 'center' }}>
      <h1>Bienvenue dans ton Hub 🎉</h1>
      <p>Tu es connecté en tant que <strong>{session.user.email}</strong>.</p>
      <p>C'est ici que tes applications apparaîtront bientôt.</p>
      <button onClick={handleLogout} style={{ padding: 10, marginTop: 16 }}>
        Se déconnecter
      </button>
    </div>
  )
}

export default App