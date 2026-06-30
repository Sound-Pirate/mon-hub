import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

const JOURS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const MOIS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']

const CATEGORIES = [
  { id: 'horaire', label: 'Horaires' },
  { id: 'rayon', label: 'Rayons' },
  { id: 'activite', label: 'Activités' },
]

const RECURRENCES = [
  { id: 'annuelle', label: 'Chaque année' },
  { id: 'mensuelle', label: 'Chaque mois' },
  { id: 'hebdomadaire', label: 'Chaque semaine' },
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

// Un événement récurrent tombe-t-il sur cette date ?
function evenementSurDate(ev, dateObj) {
  const ref = new Date(ev.date_ref + 'T00:00:00')
  if (dateObj < ref) return false // pas avant la date de référence
  if (ev.recurrence === 'annuelle') {
    return ref.getDate() === dateObj.getDate() && ref.getMonth() === dateObj.getMonth()
  }
  if (ev.recurrence === 'mensuelle') {
    return ref.getDate() === dateObj.getDate()
  }
  if (ev.recurrence === 'hebdomadaire') {
    return ref.getDay() === dateObj.getDay()
  }
  return false
}

export function Planning({ onRetour }) {
  const today = new Date()
  const [annee, setAnnee] = useState(today.getFullYear())
  const [mois, setMois] = useState(today.getMonth())
  const [vue, setVue] = useState('mois') // 'semaine' | 'mois' | 'annee'
  const [ancrageSemaine, setAncrageSemaine] = useState(new Date()) // date dans la semaine affichée

  const [calendriers, setCalendriers] = useState([])
  const [calendrierActif, setCalendrierActif] = useState(null)
  const [calendriersVisibles, setCalendriersVisibles] = useState([])

  const [presets, setPresets] = useState([])
  const [application, setApplication] = useState([])
  const [evenements, setEvenements] = useState([])
  const [presetActif, setPresetActif] = useState(null)
  const [loading, setLoading] = useState(true)

  const [formPresetOuvert, setFormPresetOuvert] = useState(false)
  const [nouveauNom, setNouveauNom] = useState('')
  const [nouvelleCategorie, setNouvelleCategorie] = useState('horaire')
  const [nouvelleCouleur, setNouvelleCouleur] = useState(PALETTE[0])

  const [formCalOuvert, setFormCalOuvert] = useState(false)
  const [nouveauCalNom, setNouveauCalNom] = useState('')
  const [nouveauCalCouleur, setNouveauCalCouleur] = useState(PALETTE[10])

  const [formEvOuvert, setFormEvOuvert] = useState(false)
  const [evNom, setEvNom] = useState('')
  const [evCouleur, setEvCouleur] = useState(PALETTE[15])
  const [evDate, setEvDate] = useState('')
  const [evRecurrence, setEvRecurrence] = useState('annuelle')

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
  async function chargerEvenements() {
    const { data } = await supabase.from('evenements').select('*')
    if (data) setEvenements(data)
  }
  async function chargerJours() {
    setLoading(true)
    // on charge large (toute l'année affichée) pour simplifier les 3 vues
    const debut = `${annee}-01-01`
    const fin = `${annee}-12-31`
    const { data } = await supabase
      .from('planning_jours').select('*')
      .gte('jour', debut).lte('jour', fin)
    if (data) setApplication(data)
    setLoading(false)
  }

  useEffect(() => { chargerCalendriers(); chargerPresets(); chargerEvenements() }, [])
  useEffect(() => { chargerJours() }, [annee])

  // --- Calendriers ---
  async function creerCalendrier() {
    if (!nouveauCalNom.trim()) return
    const ordreMax = calendriers.reduce((max, c) => Math.max(max, c.ordre), 0)
    const { data } = await supabase.from('calendriers').insert({
      nom: nouveauCalNom.trim(), couleur: nouveauCalCouleur, ordre: ordreMax + 1,
    }).select()
    setNouveauCalNom(''); setFormCalOuvert(false)
    await chargerCalendriers()
    if (data && data[0]) setCalendriersVisibles(v => [...v, data[0].id])
  }
  async function supprimerCalendrier(id) {
    if (!confirm('Supprimer ce calendrier ? Tous ses presets, jours et événements seront supprimés.')) return
    await supabase.from('calendriers').delete().eq('id', id)
    setCalendriersVisibles(v => v.filter(x => x !== id))
    if (calendrierActif === id) { setCalendrierActif(null); setPresetActif(null) }
    await chargerCalendriers(); await chargerPresets(); await chargerEvenements(); await chargerJours()
  }
  function toggleVisible(id) {
    setCalendriersVisibles(v => v.includes(id) ? v.filter(x => x !== id) : [...v, id])
  }
  // CORRECTION DU BUG : changer de calendrier désarme le pinceau
  function changerCalendrierActif(id) {
    setCalendrierActif(id)
    setPresetActif(null)
  }

  // --- Presets ---
  async function creerPreset() {
    if (!nouveauNom.trim() || !calendrierActif) return
    await supabase.from('presets').insert({
      nom: nouveauNom.trim(), couleur: nouvelleCouleur,
      type: nouvelleCategorie, calendrier_id: calendrierActif,
    })
    setNouveauNom(''); setFormPresetOuvert(false)
    chargerPresets()
  }
  async function supprimerPreset(id) {
    if (!confirm('Supprimer ce preset ?')) return
    await supabase.from('presets').delete().eq('id', id)
    if (presetActif === id) setPresetActif(null)
    chargerPresets(); chargerJours()
  }

  // --- Événements récurrents ---
  async function creerEvenement() {
    if (!evNom.trim() || !evDate || !calendrierActif) return
    await supabase.from('evenements').insert({
      calendrier_id: calendrierActif, nom: evNom.trim(),
      couleur: evCouleur, date_ref: evDate, recurrence: evRecurrence,
    })
    setEvNom(''); setEvDate(''); setFormEvOuvert(false)
    chargerEvenements()
  }
  async function supprimerEvenement(id) {
    if (!confirm('Supprimer cet événement récurrent ?')) return
    await supabase.from('evenements').delete().eq('id', id)
    chargerEvenements()
  }

  // --- Peinture (avec garde-fou) ---
  async function peindreJour(cle) {
    if (!presetActif || !calendrierActif) return
    // garde-fou : le preset doit appartenir au calendrier édité
    const preset = presets.find(p => p.id === presetActif)
    if (!preset || preset.calendrier_id !== calendrierActif) {
      setPresetActif(null)
      return
    }
    const existe = application.find(a => a.jour === cle && a.preset_id === presetActif)
    if (existe) {
      await supabase.from('planning_jours').delete().eq('id', existe.id)
    } else {
      await supabase.from('planning_jours').insert({
        jour: cle, preset_id: presetActif, calendrier_id: calendrierActif,
      })
    }
    chargerJours()
  }

  const presetsCalendrierActif = presets.filter(p => p.calendrier_id === calendrierActif)

  // Infos d'un jour (presets peints + événements récurrents), regroupées par calendrier visible
  function infosDuJour(anneeJ, moisJ, jourJ) {
    const cle = cleJour(anneeJ, moisJ, jourJ)
    const dateObj = new Date(anneeJ, moisJ, jourJ)
    const parCalendrier = {}

    application.filter(a => a.jour === cle && calendriersVisibles.includes(a.calendrier_id)).forEach(a => {
      const preset = presets.find(p => p.id === a.preset_id)
      if (!preset) return
      if (!parCalendrier[a.calendrier_id]) parCalendrier[a.calendrier_id] = []
      parCalendrier[a.calendrier_id].push({ nom: preset.nom, couleur: preset.couleur })
    })
    evenements.filter(ev => calendriersVisibles.includes(ev.calendrier_id) && evenementSurDate(ev, dateObj)).forEach(ev => {
      if (!parCalendrier[ev.calendrier_id]) parCalendrier[ev.calendrier_id] = []
      parCalendrier[ev.calendrier_id].push({ nom: '🎉 ' + ev.nom, couleur: ev.couleur })
    })
    return parCalendrier
  }

  // --- Navigation ---
  function moisPrecedent() { if (mois === 0) { setMois(11); setAnnee(annee - 1) } else setMois(mois - 1) }
  function moisSuivant() { if (mois === 11) { setMois(0); setAnnee(annee + 1) } else setMois(mois + 1) }
  function semainePrecedente() { const d = new Date(ancrageSemaine); d.setDate(d.getDate() - 7); setAncrageSemaine(d); setAnnee(d.getFullYear()) }
  function semaineSuivante() { const d = new Date(ancrageSemaine); d.setDate(d.getDate() + 7); setAncrageSemaine(d); setAnnee(d.getFullYear()) }

  const calActifObj = calendriers.find(c => c.id === calendrierActif)

  // Cellule réutilisable
  function Cellule({ a, m, j, haut = 95, fontJour = 12 }) {
    const infos = infosDuJour(a, m, j)
    const cals = Object.keys(infos)
    const estAujourdhui = (a === today.getFullYear() && m === today.getMonth() && j === today.getDate())
    return (
      <div onClick={() => peindreJour(cleJour(a, m, j))}
        style={{
          minHeight: haut, border: estAujourdhui ? '2px solid #3b82f6' : '1px solid #ddd',
          borderRadius: 8, padding: 4, cursor: presetActif ? 'pointer' : 'default', background: '#fff'
        }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 3 }}>
            {cals.map(cid => {
              const cal = calendriers.find(c => c.id === cid)
              return cal ? <span key={cid} title={cal.nom}
                style={{ width: 9, height: 9, borderRadius: '50%', background: cal.couleur, display: 'inline-block' }} /> : null
            })}
          </div>
          <div style={{ fontSize: fontJour, color: '#999' }}>{j}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 2 }}>
          {cals.flatMap(cid => infos[cid].map((it, i) => (
            <div key={cid + '-' + i} style={{
              background: it.couleur, borderRadius: 4, padding: '2px 4px',
              fontSize: 11, color: '#000', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis'
            }}>{it.nom}</div>
          )))}
        </div>
      </div>
    )
  }

  // --- Rendus des 3 vues ---
  function rendreMois() {
    const premier = new Date(annee, mois, 1)
    let dec = premier.getDay() - 1; if (dec < 0) dec = 6
    const nb = new Date(annee, mois + 1, 0).getDate()
    const cells = []
    for (let i = 0; i < dec; i++) cells.push(null)
    for (let j = 1; j <= nb; j++) cells.push(j)
    return (
      <>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 4 }}>
          {JOURS.map(j => <div key={j} style={{ textAlign: 'center', fontWeight: 'bold', color: '#666' }}>{j}</div>)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
          {cells.map((j, idx) => j === null ? <div key={idx} /> : <Cellule key={idx} a={annee} m={mois} j={j} />)}
        </div>
      </>
    )
  }

  function rendreSemaine() {
    const d = new Date(ancrageSemaine)
    let dec = d.getDay() - 1; if (dec < 0) dec = 6
    const lundi = new Date(d); lundi.setDate(d.getDate() - dec)
    const jours = []
    for (let i = 0; i < 7; i++) { const x = new Date(lundi); x.setDate(lundi.getDate() + i); jours.push(x) }
    return (
      <>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 4 }}>
          {JOURS.map(j => <div key={j} style={{ textAlign: 'center', fontWeight: 'bold', color: '#666' }}>{j}</div>)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
          {jours.map((x, idx) => <Cellule key={idx} a={x.getFullYear()} m={x.getMonth()} j={x.getDate()} haut={160} />)}
        </div>
      </>
    )
  }

  function rendreAnnee() {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 16 }}>
        {MOIS.map((nomMois, mIdx) => {
          const premier = new Date(annee, mIdx, 1)
          let dec = premier.getDay() - 1; if (dec < 0) dec = 6
          const nb = new Date(annee, mIdx + 1, 0).getDate()
          const cells = []
          for (let i = 0; i < dec; i++) cells.push(null)
          for (let j = 1; j <= nb; j++) cells.push(j)
          return (
            <div key={mIdx} style={{ border: '1px solid #eee', borderRadius: 8, padding: 8 }}>
              <div style={{ fontWeight: 'bold', textAlign: 'center', marginBottom: 6 }}>{nomMois}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
                {['L','M','M','J','V','S','D'].map((d, i) => <div key={i} style={{ fontSize: 10, textAlign: 'center', color: '#aaa' }}>{d}</div>)}
                {cells.map((j, idx) => {
                  if (j === null) return <div key={idx} />
                  const infos = infosDuJour(annee, mIdx, j)
                  const cals = Object.keys(infos)
                  return (
                    <div key={idx} title={cals.length ? 'Des infos ce jour' : ''}
                      style={{ fontSize: 10, textAlign: 'center', padding: 2, borderRadius: 3,
                        background: cals.length ? '#f0f0f0' : 'transparent', position: 'relative' }}>
                      {j}
                      {cals.length > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'center', gap: 1 }}>
                          {cals.slice(0, 3).map(cid => {
                            const cal = calendriers.find(c => c.id === cid)
                            return cal ? <span key={cid} style={{ width: 4, height: 4, borderRadius: '50%', background: cal.couleur }} /> : null
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 1100, margin: '30px auto', padding: '0 16px' }}>
      <button onClick={onRetour} style={{ marginBottom: 16 }}>← Retour au hub</button>
      <h1>📅 Planning</h1>

      {/* CALENDRIERS */}
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
              placeholder="Nom (ex : Perso, Anniversaires)" style={{ padding: 8, width: '100%', maxWidth: 260, marginBottom: 8 }} />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 }}>
              {PALETTE.map(c => <div key={c} onClick={() => setNouveauCalCouleur(c)}
                style={{ width: 24, height: 24, borderRadius: 5, background: c, cursor: 'pointer',
                  border: nouveauCalCouleur === c ? '3px solid #000' : '1px solid #ccc' }} />)}
            </div>
            <button onClick={creerCalendrier} style={{ padding: '6px 14px', fontWeight: 'bold' }}>Créer</button>
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {calendriers.map(c => (
            <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={calendriersVisibles.includes(c.id)} onChange={() => toggleVisible(c.id)} />
              <span style={{ width: 14, height: 14, borderRadius: '50%', background: c.couleur, display: 'inline-block' }} />
              <button onClick={() => changerCalendrierActif(c.id)}
                style={{ padding: '4px 10px', borderRadius: 6, cursor: 'pointer',
                  border: calendrierActif === c.id ? '2px solid #333' : '1px solid #ccc',
                  background: calendrierActif === c.id ? '#eef' : '#fff',
                  fontWeight: calendrierActif === c.id ? 'bold' : 'normal' }}>
                {c.nom} {calendrierActif === c.id ? '(en édition)' : ''}
              </button>
              <button onClick={() => supprimerCalendrier(c.id)}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#bbb' }}>✕</button>
            </div>
          ))}
        </div>
        <p style={{ fontSize: 12, color: '#888', marginTop: 8, marginBottom: 0 }}>
          ☑️ = affiché &nbsp;|&nbsp; bouton = calendrier en édition (celui qu'on peint)
        </p>
      </div>

      {/* ÉDITION CALENDRIER ACTIF */}
      {calActifObj && (
        <div style={{ marginBottom: 20 }}>
          <p style={{ fontWeight: 'bold', marginBottom: 8 }}>
            Tu édites : <span style={{ color: calActifObj.couleur }}>{calActifObj.nom}</span>
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
            <button onClick={() => setFormPresetOuvert(!formPresetOuvert)} style={{ padding: '6px 12px' }}>
              {formPresetOuvert ? '✕ Fermer' : '＋ Nouveau preset'}
            </button>
            <button onClick={() => setFormEvOuvert(!formEvOuvert)} style={{ padding: '6px 12px' }}>
              {formEvOuvert ? '✕ Fermer' : '🎉 Nouvel événement récurrent'}
            </button>
          </div>

          {formPresetOuvert && (
            <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: 16, marginBottom: 14, background: '#fff' }}>
              <input value={nouveauNom} onChange={e => setNouveauNom(e.target.value)}
                placeholder="Ex : 10:00 - 18:30" style={{ padding: 8, width: '100%', maxWidth: 260, marginBottom: 10 }} />
              <div style={{ marginBottom: 10 }}>
                <select value={nouvelleCategorie} onChange={e => setNouvelleCategorie(e.target.value)} style={{ padding: 8 }}>
                  {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                {PALETTE.map(c => <div key={c} onClick={() => setNouvelleCouleur(c)}
                  style={{ width: 28, height: 28, borderRadius: 6, background: c, cursor: 'pointer',
                    border: nouvelleCouleur === c ? '3px solid #000' : '1px solid #ccc' }} />)}
              </div>
              <button onClick={creerPreset} style={{ padding: '8px 16px', fontWeight: 'bold' }}>Créer</button>
            </div>
          )}

          {formEvOuvert && (
            <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: 16, marginBottom: 14, background: '#fff' }}>
              <input value={evNom} onChange={e => setEvNom(e.target.value)}
                placeholder="Ex : Anniversaire de Léa" style={{ padding: 8, width: '100%', maxWidth: 260, marginBottom: 10 }} />
              <div style={{ marginBottom: 10 }}>
                <label style={{ marginRight: 8 }}>Date :</label>
                <input type="date" value={evDate} onChange={e => setEvDate(e.target.value)} style={{ padding: 8 }} />
              </div>
              <div style={{ marginBottom: 10 }}>
                <label style={{ marginRight: 8 }}>Récurrence :</label>
                <select value={evRecurrence} onChange={e => setEvRecurrence(e.target.value)} style={{ padding: 8 }}>
                  {RECURRENCES.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                {PALETTE.map(c => <div key={c} onClick={() => setEvCouleur(c)}
                  style={{ width: 28, height: 28, borderRadius: 6, background: c, cursor: 'pointer',
                    border: evCouleur === c ? '3px solid #000' : '1px solid #ccc' }} />)}
              </div>
              <button onClick={creerEvenement} style={{ padding: '8px 16px', fontWeight: 'bold' }}>Créer l'événement</button>
            </div>
          )}

          {/* Liste des événements du calendrier actif */}
          {evenements.filter(e => e.calendrier_id === calendrierActif).length > 0 && (
            <div style={{ marginBottom: 12, fontSize: 13 }}>
              <strong>Événements récurrents :</strong>
              {evenements.filter(e => e.calendrier_id === calendrierActif).map(ev => (
                <span key={ev.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, margin: '4px 8px 0 0',
                  padding: '2px 8px', borderRadius: 12, background: ev.couleur, color: '#000' }}>
                  {ev.nom}
                  <button onClick={() => supprimerEvenement(ev.id)}
                    style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}>✕</button>
                </span>
              ))}
            </div>
          )}

          {/* Pinceau */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <label style={{ fontWeight: 'bold' }}>Pinceau :</label>
            <select value={presetActif || ''} onChange={e => setPresetActif(e.target.value || null)}
              style={{ padding: 10, fontSize: 16, minWidth: 220 }}>
              <option value="">— Aucun (ne pas peindre) —</option>
              {CATEGORIES.map(cat => {
                const dedans = presetsCalendrierActif.filter(p => p.type === cat.id)
                if (dedans.length === 0) return null
                return (
                  <optgroup key={cat.id} label={cat.label}>
                    {dedans.map(p => <option key={p.id} value={p.id}>{p.nom}</option>)}
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
          {presetActif && <p style={{ color: '#16a34a', marginTop: 8 }}>✏️ Clique sur un jour (reclique pour enlever).</p>}
        </div>
      )}

      {/* SÉLECTEUR DE VUE + NAVIGATION */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {[['semaine','Semaine'],['mois','Mois'],['annee','Année']].map(([id, label]) => (
            <button key={id} onClick={() => setVue(id)}
              style={{ padding: '6px 14px', borderRadius: 6,
                border: vue === id ? '2px solid #333' : '1px solid #ccc',
                background: vue === id ? '#333' : '#fff', color: vue === id ? '#fff' : '#000',
                fontWeight: vue === id ? 'bold' : 'normal' }}>{label}</button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {vue === 'mois' && <>
            <button onClick={moisPrecedent}>←</button>
            <h2 style={{ margin: 0, fontSize: 20 }}>{MOIS[mois]} {annee}</h2>
            <button onClick={moisSuivant}>→</button>
          </>}
          {vue === 'semaine' && <>
            <button onClick={semainePrecedente}>←</button>
            <h2 style={{ margin: 0, fontSize: 18 }}>Semaine du {ancrageSemaine.toLocaleDateString('fr-FR')}</h2>
            <button onClick={semaineSuivante}>→</button>
          </>}
          {vue === 'annee' && <>
            <button onClick={() => setAnnee(annee - 1)}>←</button>
            <h2 style={{ margin: 0, fontSize: 20 }}>{annee}</h2>
            <button onClick={() => setAnnee(annee + 1)}>→</button>
          </>}
        </div>
      </div>

      {/* VUE ACTIVE */}
      {vue === 'mois' && rendreMois()}
      {vue === 'semaine' && rendreSemaine()}
      {vue === 'annee' && rendreAnnee()}

      {loading && <p>Chargement…</p>}
    </div>
  )
}