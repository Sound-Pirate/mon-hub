export function Admin({ modules, basculer, onRetour }) {
  return (
    <div style={{ maxWidth: 600, margin: '40px auto' }}>
      <button onClick={onRetour} style={{ marginBottom: 16 }}>← Retour au hub</button>
      <h1>Console admin</h1>
      <p>Active ou désactive tes applications. Les changements sont instantanés.</p>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 16 }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #ccc', textAlign: 'left' }}>
            <th style={{ padding: 8 }}>Icône</th>
            <th style={{ padding: 8 }}>Application</th>
            <th style={{ padding: 8 }}>Identifiant</th>
            <th style={{ padding: 8 }}>État</th>
          </tr>
        </thead>
        <tbody>
          {modules.map((m) => (
            <tr key={m.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: 8, fontSize: 24 }}>{m.icone}</td>
              <td style={{ padding: 8 }}>{m.nom}</td>
              <td style={{ padding: 8, color: '#888', fontFamily: 'monospace' }}>{m.id}</td>
              <td style={{ padding: 8 }}>
                <button onClick={() => basculer(m.id, !m.actif)}>
                  {m.actif ? '✅ Activé' : '⬜ Désactivé'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}