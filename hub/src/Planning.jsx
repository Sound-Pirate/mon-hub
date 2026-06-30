import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

const JOURS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const MOIS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']

const CATEGORIES = [
  { id: 'horaire', label: 'Horaires' },
  { id: 'rayon', label: 'Rayons' },
  { id: 'activite', label: 'Activités' },
]

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

  const [calendriers, setCalendriers] = useState([])
  const [calendrierActif, setCalendrierActif] = useState(null) // celui qu'on édite
  const [calendriersVisibles, setCalendriersVisibles] = useState([]) // ceux qu'on affiche

  const [presets, setPresets] = useState([])
  const [application, setApplication] = useState([])
  const [presetActif, setPresetActif] = useState(null)
  const [loading, setLoading] = useState(true)

  // Formulaires
  const [formPresetOuvert, setFormPresetOuvert] = useState(false)
  const [nouveauNom, setNouveauNom] = useState('')
  const [nouvelleCategorie, setNouvelleCategorie] = useState('horaire')
  const [nouvelleCouleur, setNouvelleCouleur] = useState(PALETTE[0])

  const [formCalOuvert, setFormCalOuvert] = useState(false)
  const [nouveauCalNom, setNouveauCalNom] = useState('')
  const [nouveauCalCouleur, setNouveauCalCouleur] = useState(PALETTE[10])

  // --- Chargements ---
  async function chargerCalendriers() {
    const { data } = await supabase.from('calendriers').select('*').order('ordre')
    if (data) {
      setCalendriers(data)
      if (data.length > 0) {
        setCalendrierActif(prev => prev || data[0].id)
        setCalendriersVisibles(prev => prev.length ? prev : data.map(c => c.id))
      }
    }
  }

  async function chargerPresets() {
    const { data } = await supabase.from('presets').select('*').order('nom')
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

  useEffect(() => { chargerCalendriers(); chargerPresets() }, [])
  useEffect(() => { chargerMois() }, [annee, mois])

  // --- Calendriers ---
  async function creerCalendrier() {
    if (!nouveauCalNom.trim()) return
    const ordreMax = calendriers.reduce((max, c) => Math.max(max, c.ordre), 0)
    const { data } = await supabase.from('calendriers').insert({
      nom: nouveauCalNom.trim(), couleur: nouveauCalCouleur, ordre: ordreMax + 1,
    }).select()
    setNouveauCalNom('')
    setFormCalOuvert(false)
    await chargerCalendriers()
    if (data && data[0]) {
      setCalendriersVisibles(v => [...v, data[0].id])
    }
  }

  async function supprimerCalendrier(id) {
    if (!confirm('Supprimer ce calendrier ? Tous ses presets et jours seront supprimés.')) return
    await supabase.from('calendriers').delete().eq('id', id)
    setCalendriersVisibles(v => v.filter(x => x !== id))
    if (calendrierActif === id) setCalendrierActif(null)
    await chargerCalendriers()
    await chargerPresets()
    await chargerMois()
  }

  function toggleVisible(id) {
    setCalendriersVisibles(v =>
      v.includes(id) ? v.filter(x => x !== id) : [...v, id]
    )
  }

  // --- Presets ---
  async function creerPreset() {
    if (!nouveauNom.trim() || !calendrierActif) return
    await supabase.from('presets').insert({
      nom: nouveauNom.trim(), couleur: nouvelleCouleur,
      type: nouvelleCategorie, calendrier_id: calendrierActif,
    })
    setNouveauNom('')
    setFormPresetOuvert(false)
    chargerPresets()
  }

  async function supprimerPreset(id) {
    if (!confirm('Supprimer ce preset ?')) return
    await supabase.from('presets').delete().eq('id', id)
    if (presetActif === id) setPresetActif(null)
    chargerPresets()
    chargerMois()
  }

  // --- Peinture ---
  async function peindreJour(cle) {
    if (!presetActif || !calendrierActif) return
    const existe = application.find(
      a => a.jour === cle && a.preset_id === presetActif
    )
    if (existe) {
      await supabase.from('planning_jours').delete().eq('id', existe.id)
    } else {
      await supabase.from('planning_jours').insert({
        jour: cle, preset_id: presetActif, calendrier_id: calendrierActif,
      })
    }
    chargerMois()
  }

  // presets du calendrier actuellement édité
  const presetsCalendrierActif = presets.filter(p => p.calendrier_id === calendrierActif)

  // infos d'un jour, regroupées par calendrier visible
  function infosDuJour(cle) {
    const lignes = application.filter(a => a.jour === cle && calendriersVisibles.includes(a.calendrier_id))
    const parCalendrier = {}
    for (const ligne of lignes) {
      const preset = presets.find(p => p.id === ligne.preset_id)
      if (!preset) continue
      if (!parCalendrier[ligne.calendrier_id]) parCalendrier[ligne.calendrier_id] = []
      parCalendrier[ligne.calendrier_id].push(preset)
    }
    return parCalendrier
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

  const calActifObj = calendriers.find(c => c.id === calendrierActif)

  return (
    <div style={{ maxWidth: 950, margin: '30px auto', padding: '0 16px' }}>
      <button onClick={onRetour} style={{ marginBottom: 16 }}>← Retour au hub</button>
      <h1>📅 Planning</h1>

      {/* === GESTION DES CALENDRIERS === */}
      <div style={{ border: '1px solid #e5e5e5', borderRadius: 10, padding: 16, marginBottom: 20, background: '#fafafa' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <strong>Mes calendriers</strong>
          <button onClick={() => setFormCalOuvert(!formCalOuvert)} style={{ padding: '4px 10px' }}>
            {formCalOuvert ? '✕' : '＋ Calendrier'}
          </button>
        </div>

        {formCalOuvert && (
          <div style={{ marginBottom: 12, padding: 12, background: '#fff', borderRadius: 8, border: '1px solid #eee' }}>
            <input value={nouveauCalNom} onChange={e => setNouveauCalNom(e.target.value)}
              placeholder="Nom (ex : Perso, Anniversaires)"
              style={{ padding: 8, width: '100%', maxWidth: 260, marginBottom: 8 }} />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 }}>
              {PALETTE.map(c => (
                <div key={c} onClick={() => setNouveauCalCouleur(c)}
                  style={{ width: 24, height: 24, borderRadius: 5, background: c, cursor: 'pointer',
                    border: nouveauCalCouleur === c ? '3px solid #000' : '1px solid #ccc' }} />
              ))}
            </div>
            <button onClick={creerCalendrier} style={{ padding: '6px 14px', fontWeight: 'bold' }}>Créer</button>
          </div>
        )}

        {/* Liste des calendriers : visible (œil) + édité (radio) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {calendriers.map(c => (
            <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={calendriersVisibles.includes(c.id)}
                onChange={() => toggleVisible(c.id)} title="Afficher sur le calendrier" />
              <span style={{ width: 14, height: 14, borderRadius: '50%', background: c.couleur, display: 'inline-block' }} />
              <button
                onClick={() => setCalendrierActif(c.id)}
                style={{
                  padding: '4px 10px', borderRadius: 6, cursor: 'pointer',
                  border: calendrierActif === c.id ? '2px solid #333' : '1px solid #ccc',
                  background: calendrierActif === c.id ? '#eef' : '#fff',
                  fontWeight: calendrierActif === c.id ? 'bold' : 'normal'
                }}>
                {c.nom} {calendrierActif === c.id ? '(en édition)' : ''}
              </button>
              <button onClick={() => supprimerCalendrier(c.id)}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#bbb' }}>✕</button>
            </div>
          ))}
        </div>
        <p style={{ fontSize: 12, color: '#888', marginTop: 8, marginBottom: 0 }}>
          ☑️ = affiché sur le calendrier &nbsp;|&nbsp; bouton = calendrier en cours d'édition (celui qu'on peint)
        </p>
      </div>

      {/* === ÉDITION DU CALENDRIER ACTIF === */}
      {calActifObj && (
        <div style={{ marginBottom: 20 }}>
          <p style={{ fontWeight: 'bold', marginBottom: 8 }}>
            Tu édites : <span style={{ color: calActifObj.couleur }}>{calActifObj.nom}</span>
          </p>

          <button onClick={() => setFormPresetOuvert(!formPresetOuvert)} style={{ padding: '6px 12px', marginBottom: 10 }}>
            {formPresetOuvert ? '✕ Fermer' : '＋ Nouveau preset'}
          </button>

          {formPresetOuvert && (
            <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: 16, marginBottom: 14, background: '#fff' }}>
              <input value={nouveauNom} onChange={e => setNouveauNom(e.target.value)}
                placeholder="Ex : 10:00 - 18:30"
                style={{ padding: 8, width: '100%', maxWidth: 260, marginBottom: 10 }} />
              <div style={{ marginBottom: 10 }}>
                <select value={nouvelleCategorie} onChange={e => setNouvelleCategorie(e.target.value)} style={{ padding: 8 }}>
                  {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                {PALETTE.map(c => (
                  <div key={c} onClick={() => setNouvelleCouleur(c)}
                    style={{ width: 28, height: 28, borderRadius: 6, background: c, cursor: 'pointer',
                      border: nouvelleCouleur === c ? '3px solid #000' : '1px solid #ccc' }} />
                ))}
              </div>
              <button onClick={creerPreset} style={{ padding: '8px 16px', fontWeight: 'bold' }}>Créer</button>
            </div>
          )}

          {/* Sélecteur de preset ergonomique : liste déroulante par catégorie */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <label style={{ fontWeight: 'bold' }}>Pinceau :</label>
            <select
              value={presetActif || ''}
              onChange={e => setPresetActif(e.target.value || null)}
              style={{ padding: 10, fontSize: 16, minWidth: 220 }}>
              <option value="">— Aucun (ne pas peindre) —</option>
              {CATEGORIES.map(cat => {
                const dedans = presetsCalendrierActif.filter(p => p.type === cat.id)
                if (dedans.length === 0) return null
                return (
                  <optgroup key={cat.id} label={cat.label}>
                    {dedans.map(p => (
                      <option key={p.id} value={p.id}>{p.nom}</option>
                    ))}
                  </optgroup>
                )
              })}
            </select>
            {presetActif && (
              <button onClick={() => supprimerPreset(presetActif)} style={{ padding: '6px 10px', color: '#c00' }}>
                Supprimer ce preset
              </button>
            )}
          </div>
          {presetActif && (
            <p style={{ color: '#16a34a', marginTop: 8 }}>
              ✏️ Clique sur un jour pour appliquer (reclique pour enlever).
            </p>
          )}
        </div>
      )}

      {/* === NAVIGATION MOIS === */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <button onClick={moisPrecedent}>← Précédent</button>
        <h2 style={{ margin: 0 }}>{MOIS[mois]} {annee}</h2>
        <button onClick={moisSuivant}>Suivant →</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 4 }}>
        {JOURS.map(j => (
          <div key={j} style={{ textAlign: 'center', fontWeight: 'bold', color: '#666' }}>{j}</div>
        ))}
      </div>

      {/* === GRILLE === */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
        {cases.map((jour, idx) => {
          if (jour === null) return <div key={idx} />
          const cle = cleJour(annee, mois, jour)
          const infos = infosDuJour(cle)
          const calendriersConcernes = Object.keys(infos)
          return (
            <div key={idx}
              onClick={() => peindreJour(cle)}
              style={{
                minHeight: 95, border: '1px solid #ddd', borderRadius: 8, padding: 4,
                cursor: presetActif ? 'pointer' : 'default', background: '#fff'
              }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                {/* Pastilles des calendriers présents ce jour */}
                <div style={{ display: 'flex', gap: 3 }}>
                  {calendriersConcernes.map(cid => {
                    const cal = calendriers.find(c => c.id === cid)
                    if (!cal) return null
                    return <span key={cid} title={cal.nom}
                      style={{ width: 9, height: 9, borderRadius: '50%', background: cal.couleur, display: 'inline-block' }} />
                  })}
                </div>
                <div style={{ fontSize: 12, color: '#999' }}>{jour}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 2 }}>
                {calendriersConcernes.flatMap(cid =>
                  infos[cid].map((p, i) => (
                    <div key={cid + '-' + i} style={{
                      background: p.couleur, borderRadius: 4, padding: '2px 4px',
                      fontSize: 11, color: '#000', overflow: 'hidden', whiteSpace: 'nowrap',
                      textOverflow: 'ellipsis'
                    }}>{p.nom}</div>
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>

      {loading && <p>Chargement…</p>}
    </div>
  )
}