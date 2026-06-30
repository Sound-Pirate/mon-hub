import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

const JOURS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const MOIS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']

// Les 3 catégories fixes
const CATEGORIES = [
  { id: 'horaire', label: 'Horaires' },
  { id: 'rayon', label: 'Rayons' },
  { id: 'activite', label: 'Activités' },
]

// Palette de couleurs prédéfinies
const PALETTE = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308',
  '#84cc16', '#22c55e', '#10b981', '#14b8a6',
  '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1',
  '#8b5cf6', '#a855f7', '#d946ef', '#ec4899',
  '#f43f5e', '#78716c', '#6b7280', '#1f2937',
]

function cleJour(annee, mois, jour) {
  const m = String(mois + 1).padStart(2, '0')
  const j = String(jour).padStart(2, '0')
  return `${annee}-${m}-${j}`
}

export function Planning({ onRetour }) {
  const today = new Date()
  const [annee, setAnnee] = useState(today.getFullYear())
  const [mois, setMois] = useState(today.getMonth())
  const [presets, setPresets] = useState([])
  const [application, setApplication] = useState([])
  const [presetActif, setPresetActif] = useState(null)
  const [loading, setLoading] = useState(true)

  // Formulaire nouveau preset
  const [nouveauNom, setNouveauNom] = useState('')
  const [nouvelleCategorie, setNouvelleCategorie] = useState('horaire')
  const [nouvelleCouleur, setNouvelleCouleur] = useState(PALETTE[0])
  const [formOuvert, setFormOuvert] = useState(false)

  async function chargerPresets() {
    const { data } = await supabase.from('presets').select('*').order('ordre')
    if (data) setPresets(data)
  }

  async function chargerMois() {
    setLoading(true)
    const debut = cleJour(annee, mois, 1)
    const finJour = new Date(annee, mois + 1, 0).getDate()
    const fin = cleJour(annee, mois, finJour)
    const { data } = await supabase
      .from('planning_jours')
      .select('*')
      .gte('jour', debut)
      .lte('jour', fin)
    if (data) setApplication(data)
    setLoading(false)
  }

  useEffect(() => { chargerPresets() }, [])
  useEffect(() => { chargerMois() }, [annee, mois])

  async function creerPreset() {
    if (!nouveauNom.trim()) return
    const ordreMax = presets.reduce((max, p) => Math.max(max, p.ordre), 0)
    await supabase.from('presets').insert({
      nom: nouveauNom.trim(),
      couleur: nouvelleCouleur,
      type: nouvelleCategorie,
      ordre: ordreMax + 1,
    })
    setNouveauNom('')
    setFormOuvert(false)
    chargerPresets()
  }

  async function supprimerPreset(id) {
    if (!confirm('Supprimer ce preset ? Il sera retiré de tous les jours où il est appliqué.')) return
    await supabase.from('presets').delete().eq('id', id)
    if (presetActif === id) setPresetActif(null)
    chargerPresets()
    chargerMois()
  }

  async function peindreJour(cle) {
    if (!presetActif) return
    const existe = application.find(a => a.jour === cle && a.preset_id === presetActif)
    if (existe) {
      await supabase.from('planning_jours').delete().eq('id', existe.id)
    } else {
      await supabase.from('planning_jours').insert({ jour: cle, preset_id: presetActif })
    }
    chargerMois()
  }

  function presetsDuJour(cle) {
    return application
      .filter(a => a.jour === cle)
      .map(a => presets.find(p => p.id === a.preset_id))
      .filter(Boolean)
  }

  function moisPrecedent() {
    if (mois === 0) { setMois(11); setAnnee(annee - 1) } else setMois(mois - 1)
  }
  function moisSuivant() {
    if (mois === 11) { setMois(0); setAnnee(annee + 1) } else setMois(mois + 1)
  }

  const premierJour = new Date(annee, mois, 1)
  let decalage = premierJour.getDay() - 1
  if (decalage < 0) decalage = 6
  const nbJours = new Date(annee, mois + 1, 0).getDate()
  const cases = []
  for (let i = 0; i < decalage; i++) cases.push(null)
  for (let j = 1; j <= nbJours; j++) cases.push(j)

  return (
    <div style={{ maxWidth: 900, margin: '30px auto', padding: '0 16px' }}>
      <button onClick={onRetour} style={{ marginBottom: 16 }}>← Retour au hub</button>

      <h1>📅 Planning</h1>

      {/* Bouton ouvrir le formulaire */}
      <div style={{ marginBottom: 16 }}>
        <button onClick={() => setFormOuvert(!formOuvert)} style={{ padding: '8px 12px' }}>
          {formOuvert ? '✕ Fermer' : '＋ Nouveau preset'}
        </button>
      </div>

      {/* Formulaire nouveau preset */}
      {formOuvert && (
        <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: 16, marginBottom: 20, background: '#fafafa' }}>
          <h3 style={{ marginTop: 0 }}>Créer un preset</h3>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', marginBottom: 4, fontWeight: 'bold' }}>Nom</label>
            <input value={nouveauNom} onChange={e => setNouveauNom(e.target.value)}
              placeholder="Ex : Rayon 13" style={{ padding: 8, width: '100%', maxWidth: 300 }} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', marginBottom: 4, fontWeight: 'bold' }}>Catégorie</label>
            <select value={nouvelleCategorie} onChange={e => setNouvelleCategorie(e.target.value)}
              style={{ padding: 8 }}>
              {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', marginBottom: 4, fontWeight: 'bold' }}>Couleur</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {PALETTE.map(c => (
                <div key={c} onClick={() => setNouvelleCouleur(c)}
                  style={{
                    width: 28, height: 28, borderRadius: 6, background: c, cursor: 'pointer',
                    border: nouvelleCouleur === c ? '3px solid #000' : '1px solid #ccc'
                  }} />
              ))}
            </div>
          </div>
          <button onClick={creerPreset} style={{ padding: '8px 16px', fontWeight: 'bold' }}>
            Créer
          </button>
        </div>
      )}

      {/* Palette groupée par catégorie */}
      <div style={{ marginBottom: 20 }}>
        <p style={{ fontWeight: 'bold', marginBottom: 8 }}>
          Choisis un preset, puis clique sur les jours pour l'appliquer :
        </p>
        {CATEGORIES.map(cat => {
          const presetsCat = presets.filter(p => p.type === cat.id)
          if (presetsCat.length === 0) return null
          return (
            <div key={cat.id} style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 13, color: '#888', textTransform: 'uppercase', marginBottom: 4 }}>
                {cat.label}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {presetsCat.map(p => (
                  <div key={p.id} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
                    <button
                      onClick={() => setPresetActif(presetActif === p.id ? null : p.id)}
                      style={{
                        padding: '8px 12px', borderRadius: 8, cursor: 'pointer',
                        border: presetActif === p.id ? '3px solid #333' : '1px solid #ccc',
                        background: p.couleur, color: '#000',
                        fontWeight: presetActif === p.id ? 'bold' : 'normal'
                      }}>
                      {p.nom}
                    </button>
                    <button onClick={() => supprimerPreset(p.id)}
                      title="Supprimer ce preset"
                      style={{
                        marginLeft: 2, border: 'none', background: 'transparent',
                        cursor: 'pointer', color: '#999', fontSize: 14
                      }}>✕</button>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
        {presetActif && (
          <p style={{ color: '#16a34a', marginTop: 8 }}>
            ✏️ Mode peinture actif — clique sur un jour (reclique pour enlever).
          </p>
        )}
      </div>

      {/* Navigation mois */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <button onClick={moisPrecedent}>← Précédent</button>
        <h2 style={{ margin: 0 }}>{MOIS[mois]} {annee}</h2>
        <button onClick={moisSuivant}>Suivant →</button>
      </div>

      {/* En-têtes jours */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 4 }}>
        {JOURS.map(j => (
          <div key={j} style={{ textAlign: 'center', fontWeight: 'bold', color: '#666' }}>{j}</div>
        ))}
      </div>

      {/* Grille */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
        {cases.map((jour, idx) => {
          if (jour === null) return <div key={idx} />
          const cle = cleJour(annee, mois, jour)
          const presetsJour = presetsDuJour(cle)
          return (
            <div key={idx}
              onClick={() => peindreJour(cle)}
              style={{
                minHeight: 90, border: '1px solid #ddd', borderRadius: 8, padding: 4,
                cursor: presetActif ? 'pointer' : 'default', background: '#fff'
              }}>
              <div style={{ fontSize: 12, color: '#999', textAlign: 'right' }}>{jour}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 2 }}>
                {presetsJour.map((p, i) => (
                  <div key={i} style={{
                    background: p.couleur, borderRadius: 4, padding: '2px 4px',
                    fontSize: 11, color: '#000', overflow: 'hidden', whiteSpace: 'nowrap',
                    textOverflow: 'ellipsis'
                  }}>{p.nom}</div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {loading && <p>Chargement…</p>}
    </div>
  )
}