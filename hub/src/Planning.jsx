import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { ImportPhoto } from './ImportPhoto'

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
const STATUTS = [
  { id: 'ouverture', label: 'Ouverture', couleur: '#22c55e' },
  { id: 'fermeture', label: 'Fermeture', couleur: '#ef4444' },
  { id: 'intermediaire', label: 'Intermédiaire', couleur: '#f97316' },
]
const ORDRE_CATEGORIE = { horaire: 0, rayon: 1, activite: 2, evenement: 3 }
const PALETTE = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308',
  '#84cc16', '#22c55e', '#10b981', '#14b8a6',
  '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1',
  '#8b5cf6', '#a855f7', '#d946ef', '#ec4899',
  '#f43f5e', '#78716c', '#6b7280', '#1f2937',
]

const panel = { border: '1px solid #e5e7eb', borderRadius: 10, padding: 16, marginBottom: 20, background: '#fafafa' }
const headerRow = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }
const pastille = (couleur, taille = 14) => ({ width: taille, height: taille, borderRadius: '50%', background: couleur, display: 'inline-block', flexShrink: 0 })
const btnToggle = (actif) => ({
  padding: '4px 10px', borderRadius: 6, cursor: 'pointer',
  border: actif ? '2px solid #333' : '1px solid #ccc',
  background: actif ? '#e0e7ff' : '#fff', color: '#1f2937', fontWeight: actif ? 'bold' : 'normal'
})

function cleJour(annee, mois, jour) {
  const m = String(mois + 1).padStart(2, '0')
  const j = String(jour).padStart(2, '0')
  return `${annee}-${m}-${j}`
}
function evenementSurDate(ev, dateObj) {
  const ref = new Date(ev.date_ref + 'T00:00:00')
  if (dateObj < ref) return false
  if (ev.recurrence === 'annuelle') return ref.getDate() === dateObj.getDate() && ref.getMonth() === dateObj.getMonth()
  if (ev.recurrence === 'mensuelle') return ref.getDate() === dateObj.getDate()
  if (ev.recurrence === 'hebdomadaire') return ref.getDay() === dateObj.getDay()
  return false
}
function couleurStatut(statut) {
  const s = STATUTS.find(x => x.id === statut)
  return s ? s.couleur : '#9ca3af'
}

export function Planning({ onRetour }) {
  const today = new Date()
  const [annee, setAnnee] = useState(today.getFullYear())
  const [mois, setMois] = useState(today.getMonth())
  const [vue, setVue] = useState('mois')
  const [ancrageSemaine, setAncrageSemaine] = useState(new Date())

  const [estMobile, setEstMobile] = useState(window.innerWidth < 768)
  const [ongletMobile, setOngletMobile] = useState('vue')
  useEffect(() => {
    function onResize() { setEstMobile(window.innerWidth < 768) }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const [calendriers, setCalendriers] = useState([])
  const [calendrierActif, setCalendrierActif] = useState(null)
  const [calendriersVisibles, setCalendriersVisibles] = useState([])

  const [personnes, setPersonnes] = useState([])
  const [personneActive, setPersonneActive] = useState(null)
  const [personnesVisibles, setPersonnesVisibles] = useState([])

  const [presets, setPresets] = useState([])
  const [application, setApplication] = useState([])
  const [evenements, setEvenements] = useState([])
  const [presetActif, setPresetActif] = useState(null)
  const [modeGomme, setModeGomme] = useState(false)
  const [loading, setLoading] = useState(true)
  const [sauvegarde, setSauvegarde] = useState('idle')

  const [detailJour, setDetailJour] = useState(null) // popup d'infos
  const [vueImport, setVueImport] = useState(false)

  const [formPresetOuvert, setFormPresetOuvert] = useState(false)
  const [nouveauNom, setNouveauNom] = useState('')
  const [nouvelleCategorie, setNouvelleCategorie] = useState('horaire')
  const [nouvelleCouleur, setNouvelleCouleur] = useState(PALETTE[0])
  const [nouveauStatut, setNouveauStatut] = useState('ouverture')
  const [nouveauFichier, setNouveauFichier] = useState(null)
  const [nouvelleTailleIcone, setNouvelleTailleIcone] = useState(28)
  const [uploadEnCours, setUploadEnCours] = useState(false)

  const [formCalOuvert, setFormCalOuvert] = useState(false)
  const [nouveauCalNom, setNouveauCalNom] = useState('')
  const [nouveauCalCouleur, setNouveauCalCouleur] = useState(PALETTE[10])

  const [formEvOuvert, setFormEvOuvert] = useState(false)
  const [evNom, setEvNom] = useState('')
  const [evCouleur, setEvCouleur] = useState(PALETTE[15])
  const [evDate, setEvDate] = useState('')
  const [evRecurrence, setEvRecurrence] = useState('annuelle')

  const [formPersonneOuvert, setFormPersonneOuvert] = useState(false)
  const [nouvellePersonneNom, setNouvellePersonneNom] = useState('')
  const [nouvellePersonneCouleur, setNouvellePersonneCouleur] = useState(PALETTE[6])

  const [edition, setEdition] = useState(null)
  const [popupCat, setPopupCat] = useState(null)

  function flashSauvegarde() { setSauvegarde('saved'); setTimeout(() => setSauvegarde('idle'), 1200) }

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
  async function chargerPersonnes() {
    const { data } = await supabase.from('personnes').select('*').order('ordre')
    if (data) {
      setPersonnes(data)
      if (data.length > 0) {
        setPersonneActive(prev => prev || data[0].id)
        setPersonnesVisibles(prev => prev.length ? prev : data.map(p => p.id))
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
    const { data } = await supabase.from('planning_jours').select('*').gte('jour', `${annee}-01-01`).lte('jour', `${annee}-12-31`)
    if (data) setApplication(data)
    setLoading(false)
  }

  useEffect(() => { chargerCalendriers(); chargerPersonnes(); chargerPresets(); chargerEvenements() }, [])
  useEffect(() => { chargerJours() }, [annee])

  async function creerCalendrier() {
    if (!nouveauCalNom.trim()) return
    const ordreMax = calendriers.reduce((m, c) => Math.max(m, c.ordre), 0)
    setSauvegarde('saving')
    const { data } = await supabase.from('calendriers').insert({ nom: nouveauCalNom.trim(), couleur: nouveauCalCouleur, ordre: ordreMax + 1 }).select()
    setNouveauCalNom(''); setFormCalOuvert(false)
    await chargerCalendriers()
    if (data && data[0]) setCalendriersVisibles(v => [...v, data[0].id])
    flashSauvegarde()
  }
  async function supprimerCalendrier(id) {
    if (!confirm('Supprimer ce calendrier ? Tout son contenu sera supprimé.')) return
    setSauvegarde('saving')
    await supabase.from('calendriers').delete().eq('id', id)
    setCalendriersVisibles(v => v.filter(x => x !== id))
    if (calendrierActif === id) { setCalendrierActif(null); setPresetActif(null) }
    await chargerCalendriers(); await chargerPresets(); await chargerEvenements(); await chargerJours()
    flashSauvegarde()
  }
  function toggleVisible(id) { setCalendriersVisibles(v => v.includes(id) ? v.filter(x => x !== id) : [...v, id]) }
  function changerCalendrierActif(id) { setCalendrierActif(id); setPresetActif(null) }

  async function creerPersonne() {
    if (!nouvellePersonneNom.trim()) return
    const ordreMax = personnes.reduce((m, p) => Math.max(m, p.ordre), 0)
    setSauvegarde('saving')
    const { data } = await supabase.from('personnes').insert({ nom: nouvellePersonneNom.trim(), couleur: nouvellePersonneCouleur, ordre: ordreMax + 1 }).select()
    setNouvellePersonneNom(''); setFormPersonneOuvert(false)
    await chargerPersonnes()
    if (data && data[0]) setPersonnesVisibles(v => [...v, data[0].id])
    flashSauvegarde()
  }
  async function supprimerPersonne(id) {
    if (!confirm('Supprimer cette personne ? Son planning sera supprimé.')) return
    setSauvegarde('saving')
    await supabase.from('personnes').delete().eq('id', id)
    setPersonnesVisibles(v => v.filter(x => x !== id))
    if (personneActive === id) setPersonneActive(null)
    await chargerPersonnes(); await chargerJours()
    flashSauvegarde()
  }
  function togglePersonneVisible(id) { setPersonnesVisibles(v => v.includes(id) ? v.filter(x => x !== id) : [...v, id]) }

  // Upload d'image vers Supabase Storage
  async function uploaderImage(fichier) {
    const ext = fichier.name.split('.').pop()
    const nom = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const { error } = await supabase.storage.from('logos').upload(nom, fichier)
    if (error) { alert('Erreur upload : ' + error.message); return null }
    const { data } = supabase.storage.from('logos').getPublicUrl(nom)
    return data.publicUrl
  }

  async function creerPreset() {
    if (!nouveauNom.trim() || !calendrierActif) return
    setSauvegarde('saving'); setUploadEnCours(true)
    let imageUrl = null
    let couleur = nouvelleCouleur
    let statut = null
    if (nouvelleCategorie === 'horaire') {
      statut = nouveauStatut
      couleur = couleurStatut(nouveauStatut)
    } else if (nouveauFichier) {
      imageUrl = await uploaderImage(nouveauFichier)
    }
    await supabase.from('presets').insert({
      nom: nouveauNom.trim(), couleur, type: nouvelleCategorie, calendrier_id: calendrierActif,
      statut_horaire: statut, image_url: imageUrl, taille_icone: nouvelleTailleIcone,
    })
    setNouveauNom(''); setNouveauFichier(null); setFormPresetOuvert(false); setUploadEnCours(false)
    await chargerPresets()
    flashSauvegarde()
  }
  async function supprimerPreset(id) {
    if (!confirm('Supprimer ce preset ?')) return
    setSauvegarde('saving')
    await supabase.from('presets').delete().eq('id', id)
    if (presetActif === id) setPresetActif(null)
    await chargerPresets(); await chargerJours()
    flashSauvegarde()
  }

  async function creerEvenement() {
    if (!evNom.trim() || !evDate || !calendrierActif) return
    setSauvegarde('saving')
    await supabase.from('evenements').insert({ calendrier_id: calendrierActif, nom: evNom.trim(), couleur: evCouleur, date_ref: evDate, recurrence: evRecurrence })
    setEvNom(''); setEvDate(''); setFormEvOuvert(false)
    await chargerEvenements()
    flashSauvegarde()
  }
  async function supprimerEvenement(id) {
    if (!confirm('Supprimer cet événement récurrent ?')) return
    setSauvegarde('saving')
    await supabase.from('evenements').delete().eq('id', id)
    await chargerEvenements()
    flashSauvegarde()
  }

  function ouvrirEdition(type, obj) {
    if (type === 'preset') setEdition({ type, id: obj.id, nom: obj.nom, couleur: obj.couleur, categorie: obj.type, statut: obj.statut_horaire || 'ouverture', image_url: obj.image_url, fichier: null, taille_icone: obj.taille_icone || 28 })
    else if (type === 'evenement') setEdition({ type, id: obj.id, nom: obj.nom, couleur: obj.couleur, date: obj.date_ref, recurrence: obj.recurrence })
    else setEdition({ type, id: obj.id, nom: obj.nom, couleur: obj.couleur })
  }
  async function enregistrerEdition() {
    if (!edition) return
    setSauvegarde('saving')
    if (edition.type === 'preset') {
      let maj = { nom: edition.nom, type: edition.categorie }
      if (edition.categorie === 'horaire') {
        maj.statut_horaire = edition.statut
        maj.couleur = couleurStatut(edition.statut)
        maj.image_url = null
      } else {
        maj.couleur = edition.couleur
        maj.statut_horaire = null
        if (edition.fichier) maj.image_url = await uploaderImage(edition.fichier)
        else maj.image_url = edition.image_url
        maj.taille_icone = edition.taille_icone
      }
      await supabase.from('presets').update(maj).eq('id', edition.id)
      await chargerPresets()
    } else if (edition.type === 'calendrier') { await supabase.from('calendriers').update({ nom: edition.nom, couleur: edition.couleur }).eq('id', edition.id); await chargerCalendriers() }
    else if (edition.type === 'personne') { await supabase.from('personnes').update({ nom: edition.nom, couleur: edition.couleur }).eq('id', edition.id); await chargerPersonnes() }
    else if (edition.type === 'evenement') { await supabase.from('evenements').update({ nom: edition.nom, couleur: edition.couleur, date_ref: edition.date, recurrence: edition.recurrence }).eq('id', edition.id); await chargerEvenements() }
    setEdition(null)
    flashSauvegarde()
  }

  async function clicJour(cle, personneId = personneActive, dateObj = null) {
    // Mode consultation -> popup
    if (!presetActif && !modeGomme) {
      if (dateObj) setDetailJour({ cle, dateObj, personneId })
      return
    }
    if (!calendrierActif || !personneId) return
    if (modeGomme) {
      const aSupprimer = application.filter(a => a.jour === cle && a.calendrier_id === calendrierActif && a.personne_id === personneId)
      if (aSupprimer.length === 0) return
      setSauvegarde('saving')
      await supabase.from('planning_jours').delete().in('id', aSupprimer.map(a => a.id))
      await chargerJours(); flashSauvegarde(); return
    }
    const preset = presets.find(p => p.id === presetActif)
    if (!preset || preset.calendrier_id !== calendrierActif) { setPresetActif(null); return }
    setSauvegarde('saving')
    const existe = application.find(a => a.jour === cle && a.preset_id === presetActif && a.personne_id === personneId)
    if (existe) await supabase.from('planning_jours').delete().eq('id', existe.id)
    else await supabase.from('planning_jours').insert({ jour: cle, preset_id: presetActif, calendrier_id: calendrierActif, personne_id: personneId })
    await chargerJours(); flashSauvegarde()
  }

  const presetsCalendrierActif = presets.filter(p => p.calendrier_id === calendrierActif)

  // Renvoie { statut, couleurStatut, icones:[{url,nom}], presetsDetail:[], evenements:[] } pour un jour/personne
  function resumeJour(anneeJ, moisJ, jourJ, personneId) {
    const cle = cleJour(anneeJ, moisJ, jourJ)
    const dateObj = new Date(anneeJ, moisJ, jourJ)
    const lignes = application.filter(a => a.jour === cle && a.personne_id === personneId && calendriersVisibles.includes(a.calendrier_id))
    const presetsDetail = lignes.map(a => presets.find(p => p.id === a.preset_id)).filter(Boolean)
      .sort((x, y) => (ORDRE_CATEGORIE[x.type] ?? 9) - (ORDRE_CATEGORIE[y.type] ?? 9))
    const horaire = presetsDetail.find(p => p.type === 'horaire')
    const icones = presetsDetail.filter(p => (p.type === 'rayon' || p.type === 'activite'))
    const evs = evenements.filter(ev => calendriersVisibles.includes(ev.calendrier_id) && evenementSurDate(ev, dateObj))
    return { presetsDetail, horaire, icones, evenements: evs, cle, dateObj }
  }

  function moisPrecedent() { if (mois === 0) { setMois(11); setAnnee(annee - 1) } else setMois(mois - 1) }
  function moisSuivant() { if (mois === 11) { setMois(0); setAnnee(annee + 1) } else setMois(mois + 1) }
  function semainePrecedente() { const d = new Date(ancrageSemaine); d.setDate(d.getDate() - 7); setAncrageSemaine(d); setAnnee(d.getFullYear()) }
  function semaineSuivante() { const d = new Date(ancrageSemaine); d.setDate(d.getDate() + 7); setAncrageSemaine(d); setAnnee(d.getFullYear()) }

  const calActifObj = calendriers.find(c => c.id === calendrierActif)
  const personneActiveObj = personnes.find(p => p.id === personneActive)

  // Case compacte (mois + équipe) : pastille statut + icônes
  function CaseCompacte({ a, m, j, personneId, haut = 64, montrerNumero = true }) {
    const r = resumeJour(a, m, j, personneId)
    const estAujourdhui = (a === today.getFullYear() && m === today.getMonth() && j === today.getDate())
    const aDesEvenements = r.evenements.length > 0
    return (
      <div onClick={() => clicJour(r.cle, personneId, new Date(a, m, j))}
        style={{ minHeight: haut, border: estAujourdhui ? '2px solid #3b82f6' : '1px solid #e5e7eb', borderRadius: 8,
          padding: 3, cursor: 'pointer', background: '#fff', position: 'relative', overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {r.horaire
            ? <span title={r.horaire.nom} style={pastille(couleurStatut(r.horaire.statut_horaire), 12)} />
            : <span style={{ width: 12 }} />}
          {montrerNumero && <span style={{ fontSize: 11, color: '#9ca3af' }}>{j}</span>}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2, marginTop: 3, justifyContent: 'center' }}>
          {r.icones.map((p, i) => {
            const taille = `clamp(14px, 6vw, ${p.taille_icone || 28}px)`
            return p.image_url
              ? <img key={i} src={p.image_url} alt={p.nom} title={p.nom} style={{ width: taille, height: taille, objectFit: 'contain' }} />
              : <span key={i} title={p.nom} style={{ width: taille, height: taille, borderRadius: '50%', background: p.couleur, display: 'inline-block', flexShrink: 0 }} />
          })}
        </div>
        {aDesEvenements && <div style={{ position: 'absolute', bottom: 2, right: 3, fontSize: 10 }}>🎉</div>}
      </div>
    )
  }

  // Case détaillée (semaine) : texte complet
  function CaseDetaillee({ a, m, j, haut = 160 }) {
    const r = resumeJour(a, m, j, personneActive)
    const estAujourdhui = (a === today.getFullYear() && m === today.getMonth() && j === today.getDate())
    return (
      <div onClick={() => clicJour(r.cle, personneActive, new Date(a, m, j))}
        style={{ minHeight: haut, border: estAujourdhui ? '2px solid #3b82f6' : '1px solid #e5e7eb', borderRadius: 8, padding: 4,
          cursor: 'pointer', background: '#fff' }}>
        <div style={{ textAlign: 'right', fontSize: 12, color: '#9ca3af' }}>{j}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 2 }}>
          {r.presetsDetail.map((p, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, background: p.type === 'horaire' ? couleurStatut(p.statut_horaire) : p.couleur,
              borderRadius: 4, padding: '2px 4px', fontSize: 11, color: '#1f2937' }}>
              {p.image_url && <img src={p.image_url} alt="" style={{ width: 14, height: 14, objectFit: 'contain' }} />}
              <span style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{p.nom}</span>
            </div>
          ))}
          {r.evenements.map((ev, i) => (
            <div key={'e' + i} style={{ background: ev.couleur, borderRadius: 4, padding: '2px 4px', fontSize: 11 }}>🎉 {ev.nom}</div>
          ))}
        </div>
      </div>
    )
  }

  function rendreMois() {
    const premier = new Date(annee, mois, 1)
    let dec = premier.getDay() - 1; if (dec < 0) dec = 6
    const nb = new Date(annee, mois + 1, 0).getDate()
    const cells = []
    for (let i = 0; i < dec; i++) cells.push(null)
    for (let j = 1; j <= nb; j++) cells.push(j)
    return (
      <>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: estMobile ? 3 : 4, marginBottom: 4 }}>
          {JOURS.map(j => <div key={j} style={{ textAlign: 'center', fontWeight: 'bold', color: '#6b7280', fontSize: estMobile ? 11 : 14 }}>{estMobile ? j[0] : j}</div>)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: estMobile ? 3 : 4 }}>
          {cells.map((j, idx) => j === null ? <div key={idx} /> : <CaseCompacte key={idx} a={annee} m={mois} j={j} personneId={personneActive} haut={estMobile ? 60 : 80} />)}
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
    if (estMobile) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {jours.map((x, idx) => (
            <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
              <div style={{ width: 52, flexShrink: 0, textAlign: 'center', fontWeight: 'bold', color: '#6b7280', display: 'flex', flexDirection: 'column', justifyContent: 'center', background: '#f3f4f6', borderRadius: 8, padding: 4 }}>
                <div style={{ fontSize: 12 }}>{JOURS[idx]}</div>
                <div style={{ fontSize: 18 }}>{x.getDate()}</div>
              </div>
              <div style={{ flex: 1 }}><CaseDetaillee a={x.getFullYear()} m={x.getMonth()} j={x.getDate()} haut={70} /></div>
            </div>
          ))}
        </div>
      )
    }
    return (
      <>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 4, marginBottom: 4 }}>
          {JOURS.map(j => <div key={j} style={{ textAlign: 'center', fontWeight: 'bold', color: '#6b7280' }}>{j}</div>)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 4 }}>
          {jours.map((x, idx) => <CaseDetaillee key={idx} a={x.getFullYear()} m={x.getMonth()} j={x.getDate()} haut={160} />)}
        </div>
      </>
    )
  }

  function rendreAnnee() {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: estMobile ? '1fr' : 'repeat(auto-fill, minmax(230px, 1fr))', gap: 16 }}>
        {MOIS.map((nomMois, mIdx) => {
          const premier = new Date(annee, mIdx, 1)
          let dec = premier.getDay() - 1; if (dec < 0) dec = 6
          const nb = new Date(annee, mIdx + 1, 0).getDate()
          const cells = []
          for (let i = 0; i < dec; i++) cells.push(null)
          for (let j = 1; j <= nb; j++) cells.push(j)
          return (
            <div key={mIdx} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 8, background: '#fff' }}>
              <div style={{ fontWeight: 'bold', textAlign: 'center', marginBottom: 6 }}>{nomMois}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 2 }}>
                {['L','M','M','J','V','S','D'].map((d, i) => <div key={i} style={{ fontSize: 10, textAlign: 'center', color: '#9ca3af' }}>{d}</div>)}
                {cells.map((j, idx) => {
                  if (j === null) return <div key={idx} />
                  const r = resumeJour(annee, mIdx, j, personneActive)
                  const aInfos = r.presetsDetail.length > 0 || r.evenements.length > 0
                  return (
                    <div key={idx} onClick={() => clicJour(r.cle, personneActive, new Date(annee, mIdx, j))}
                      style={{ fontSize: 10, textAlign: 'center', padding: 2, borderRadius: 3, cursor: 'pointer',
                        background: r.horaire ? couleurStatut(r.horaire.statut_horaire) + '33' : (aInfos ? '#eef2ff' : 'transparent') }}>
                      <span style={{ color: r.horaire ? '#1f2937' : '#6b7280', fontWeight: r.horaire ? 'bold' : 'normal' }}>{j}</span>
                      {r.icones.length > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'center', gap: 1 }}>
                          {r.icones.slice(0, 3).map((p, i) => p.image_url
                            ? <img key={i} src={p.image_url} alt="" style={{ width: 8, height: 8, objectFit: 'contain' }} />
                            : <span key={i} style={pastille(p.couleur, 5)} />)}
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

  function rendreEquipe() {
    const d = new Date(ancrageSemaine)
    let dec = d.getDay() - 1; if (dec < 0) dec = 6
    const lundi = new Date(d); lundi.setDate(d.getDate() - dec)
    const joursSemaine = []
    for (let i = 0; i < 7; i++) { const x = new Date(lundi); x.setDate(lundi.getDate() + i); joursSemaine.push(x) }
    const personnesAffichees = personnes.filter(p => personnesVisibles.includes(p.id))
    if (personnesAffichees.length === 0) return <p>Coche au moins une personne dans l'onglet Gérer.</p>
    if (estMobile) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {personnesAffichees.map(p => (
            <div key={p.id}>
              <div style={{ fontWeight: 'bold', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}><span style={pastille(p.couleur, 10)} /> {p.nom}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 2 }}>
                {joursSemaine.map((x, i) => <CaseCompacte key={i} a={x.getFullYear()} m={x.getMonth()} j={x.getDate()} personneId={p.id} haut={56} montrerNumero={true} />)}
              </div>
            </div>
          ))}
        </div>
      )
    }
    return (
      <table style={{ borderCollapse: 'collapse', width: '100%', tableLayout: 'fixed' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', padding: 8, borderBottom: '2px solid #d1d5db', width: 110 }}>Personne</th>
            {joursSemaine.map((x, i) => <th key={i} style={{ padding: 6, borderBottom: '2px solid #d1d5db', fontSize: 12 }}>{JOURS[i]} {x.getDate()}/{x.getMonth() + 1}</th>)}
          </tr>
        </thead>
        <tbody>
          {personnesAffichees.map(p => (
            <tr key={p.id}>
              <td style={{ padding: 8, fontWeight: 'bold', whiteSpace: 'nowrap' }}><span style={pastille(p.couleur, 10)} /> {p.nom}</td>
              {joursSemaine.map((x, i) => (
                <td key={i} style={{ padding: 3, verticalAlign: 'top' }}>
                  <CaseCompacte a={x.getFullYear()} m={x.getMonth()} j={x.getDate()} personneId={p.id} haut={70} montrerNumero={false} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    )
  }

  // === BLOCS INTERFACE ===
  const blocCalendriers = (
    <div style={panel}>
      <div style={headerRow}><strong>Mes calendriers</strong><button onClick={() => setFormCalOuvert(!formCalOuvert)} style={{ padding: '4px 10px' }}>{formCalOuvert ? '✕' : '＋ Calendrier'}</button></div>
      {formCalOuvert && (
        <div style={{ marginBottom: 12, padding: 12, background: '#fff', borderRadius: 8, border: '1px solid #eee' }}>
          <input value={nouveauCalNom} onChange={e => setNouveauCalNom(e.target.value)} placeholder="Nom (ex : Perso)" style={{ padding: 8, width: '100%', maxWidth: 260, marginBottom: 8, boxSizing: 'border-box' }} />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 }}>{PALETTE.map(c => <div key={c} onClick={() => setNouveauCalCouleur(c)} style={{ width: 26, height: 26, borderRadius: 5, background: c, cursor: 'pointer', border: nouveauCalCouleur === c ? '3px solid #000' : '1px solid #ccc' }} />)}</div>
          <button onClick={creerCalendrier} style={{ padding: '6px 14px', fontWeight: 'bold' }}>Créer</button>
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {calendriers.map(c => (
          <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={calendriersVisibles.includes(c.id)} onChange={() => toggleVisible(c.id)} />
            <span style={pastille(c.couleur)} />
            <button onClick={() => changerCalendrierActif(c.id)} style={btnToggle(calendrierActif === c.id)}>{c.nom}{calendrierActif === c.id ? ' ✓' : ''}</button>
            <button onClick={() => ouvrirEdition('calendrier', c)} style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}>✏️</button>
            <button onClick={() => supprimerCalendrier(c.id)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#bbb' }}>✕</button>
          </div>
        ))}
      </div>
    </div>
  )

  const blocPersonnes = (
    <div style={panel}>
      <div style={headerRow}><strong>Mes personnes</strong><button onClick={() => setFormPersonneOuvert(!formPersonneOuvert)} style={{ padding: '4px 10px' }}>{formPersonneOuvert ? '✕' : '＋ Personne'}</button></div>
      {formPersonneOuvert && (
        <div style={{ marginBottom: 12, padding: 12, background: '#fff', borderRadius: 8, border: '1px solid #eee' }}>
          <input value={nouvellePersonneNom} onChange={e => setNouvellePersonneNom(e.target.value)} placeholder="Nom (ex : Marie)" style={{ padding: 8, width: '100%', maxWidth: 260, marginBottom: 8, boxSizing: 'border-box' }} />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 }}>{PALETTE.map(c => <div key={c} onClick={() => setNouvellePersonneCouleur(c)} style={{ width: 26, height: 26, borderRadius: 5, background: c, cursor: 'pointer', border: nouvellePersonneCouleur === c ? '3px solid #000' : '1px solid #ccc' }} />)}</div>
          <button onClick={creerPersonne} style={{ padding: '6px 14px', fontWeight: 'bold' }}>Créer</button>
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {personnes.map(p => (
          <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={personnesVisibles.includes(p.id)} onChange={() => togglePersonneVisible(p.id)} title="Afficher en vue Équipe" />
            <span style={pastille(p.couleur)} />
            <button onClick={() => setPersonneActive(p.id)} style={btnToggle(personneActive === p.id)}>{p.nom}{personneActive === p.id ? ' ✓' : ''}</button>
            <button onClick={() => ouvrirEdition('personne', p)} style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}>✏️</button>
            <button onClick={() => supprimerPersonne(p.id)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#bbb' }}>✕</button>
          </div>
        ))}
      </div>
    </div>
  )

  const blocPinceau = calActifObj && personneActiveObj && (
    <div style={{ marginBottom: 20 }}>
      <p style={{ fontWeight: 'bold', marginBottom: 8 }}>Tu modifies : <span style={{ color: calActifObj.couleur }}>{calActifObj.nom}</span> pour <span style={{ color: personneActiveObj.couleur }}>{personneActiveObj.nom}</span></p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        <button onClick={() => setFormPresetOuvert(!formPresetOuvert)} style={{ padding: '6px 12px' }}>{formPresetOuvert ? '✕ Fermer' : '＋ Nouveau preset'}</button>
        <button onClick={() => setFormEvOuvert(!formEvOuvert)} style={{ padding: '6px 12px' }}>{formEvOuvert ? '✕ Fermer' : '🎉 Événement récurrent'}</button>
      </div>
      {formPresetOuvert && (
        <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: 16, marginBottom: 14, background: '#fff' }}>
          <input value={nouveauNom} onChange={e => setNouveauNom(e.target.value)} placeholder="Ex : 10:00 - 18:30" style={{ padding: 8, width: '100%', maxWidth: 260, marginBottom: 10, boxSizing: 'border-box' }} />
          <div style={{ marginBottom: 10 }}>
            <select value={nouvelleCategorie} onChange={e => setNouvelleCategorie(e.target.value)} style={{ padding: 8 }}>{CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}</select>
          </div>
          {nouvelleCategorie === 'horaire' ? (
            <div style={{ marginBottom: 10 }}>
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 'bold' }}>Statut :</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {STATUTS.map(s => (
                  <button key={s.id} onClick={() => setNouveauStatut(s.id)} style={{ padding: '6px 12px', borderRadius: 6, border: nouveauStatut === s.id ? '3px solid #000' : '1px solid #ccc', background: s.couleur, color: '#fff', fontWeight: 'bold' }}>{s.label}</button>
                ))}
              </div>
            </div>
          ) : (
            <>
              <div style={{ marginBottom: 10 }}>
                <label style={{ display: 'block', marginBottom: 4, fontWeight: 'bold' }}>Image/logo (fond transparent conseillé) :</label>
                <input type="file" accept="image/*" onChange={e => setNouveauFichier(e.target.files[0])} />
              </div>
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 'bold' }}>Couleur de fond (si pas d'image) :</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>{PALETTE.map(c => <div key={c} onClick={() => setNouvelleCouleur(c)} style={{ width: 30, height: 30, borderRadius: 6, background: c, cursor: 'pointer', border: nouvelleCouleur === c ? '3px solid #000' : '1px solid #ccc' }} />)}</div>
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 'bold' }}>Taille de l'icône : {nouvelleTailleIcone}px</label>
              <input type="range" min="10" max="70" value={nouvelleTailleIcone} onChange={e => setNouvelleTailleIcone(Number(e.target.value))} style={{ width: '100%', marginBottom: 10 }} />
            </>
          )}
          <button onClick={creerPreset} disabled={uploadEnCours} style={{ padding: '8px 16px', fontWeight: 'bold' }}>{uploadEnCours ? 'Envoi...' : 'Créer'}</button>
        </div>
      )}
      {formEvOuvert && (
        <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: 16, marginBottom: 14, background: '#fff' }}>
          <input value={evNom} onChange={e => setEvNom(e.target.value)} placeholder="Ex : Anniversaire de Léa" style={{ padding: 8, width: '100%', maxWidth: 260, marginBottom: 10, boxSizing: 'border-box' }} />
          <div style={{ marginBottom: 10 }}><label style={{ marginRight: 8 }}>Date :</label><input type="date" value={evDate} onChange={e => setEvDate(e.target.value)} style={{ padding: 8 }} /></div>
          <div style={{ marginBottom: 10 }}><label style={{ marginRight: 8 }}>Récurrence :</label><select value={evRecurrence} onChange={e => setEvRecurrence(e.target.value)} style={{ padding: 8 }}>{RECURRENCES.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}</select></div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>{PALETTE.map(c => <div key={c} onClick={() => setEvCouleur(c)} style={{ width: 30, height: 30, borderRadius: 6, background: c, cursor: 'pointer', border: evCouleur === c ? '3px solid #000' : '1px solid #ccc' }} />)}</div>
          <button onClick={creerEvenement} style={{ padding: '8px 16px', fontWeight: 'bold' }}>Créer l'événement</button>
        </div>
      )}
      {evenements.filter(e => e.calendrier_id === calendrierActif).length > 0 && (
        <div style={{ marginBottom: 12, fontSize: 13 }}>
          <strong>Événements :</strong>
          {evenements.filter(e => e.calendrier_id === calendrierActif).map(ev => (
            <span key={ev.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, margin: '4px 8px 0 0', padding: '2px 8px', borderRadius: 12, background: ev.couleur, color: '#1f2937' }}>
              {ev.nom}
              <button onClick={() => ouvrirEdition('evenement', ev)} style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}>✏️</button>
              <button onClick={() => supprimerEvenement(ev.id)} style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}>✕</button>
            </span>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <label style={{ fontWeight: 'bold' }}>Pinceau :</label>
         {(() => {
          const presetActifObj = presetsCalendrierActif.find(p => p.id === presetActif)
          return (
            <>
              {/* Pinceau actif */}
              {presetActifObj ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8, background: '#f0fdf4', border: '2px solid #22c55e', marginBottom: 8 }}>
                  {presetActifObj.type === 'horaire'
                    ? <span style={{ width: 12, height: 12, borderRadius: '50%', background: couleurStatut(presetActifObj.statut_horaire), flexShrink: 0 }} />
                    : presetActifObj.image_url
                      ? <img src={presetActifObj.image_url} alt="" style={{ width: 16, height: 16, objectFit: 'contain' }} />
                      : <span style={{ width: 12, height: 12, borderRadius: '50%', background: presetActifObj.couleur, flexShrink: 0 }} />}
                  <span style={{ fontWeight: 'bold', flex: 1 }}>🖌️ {presetActifObj.nom}</span>
                  <button onClick={() => { setPresetActif(null); setModeGomme(false) }}
                    style={{ border: 'none', background: 'transparent', fontSize: 18, cursor: 'pointer', color: '#6b7280', padding: '0 4px' }}>✕</button>
                </div>
              ) : (
                <p style={{ color: '#9ca3af', fontSize: 13, marginBottom: 8 }}>👆 Aucun pinceau — clique sur une catégorie pour peindre</p>
              )}

              {/* Boutons catégories */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {CATEGORIES.map(cat => {
                  const dedans = presetsCalendrierActif.filter(p => p.type === cat.id)
                  if (dedans.length === 0) return null
                  const actifDansCat = dedans.find(p => p.id === presetActif)
                  return (
                    <button key={cat.id} onClick={() => setPopupCat(cat.id)}
                      style={{ padding: '10px 16px', borderRadius: 10, border: actifDansCat ? '2px solid #333' : '1px solid #e5e7eb',
                        background: actifDansCat ? '#1f2937' : '#f9fafb', color: actifDansCat ? '#fff' : '#1f2937',
                        fontWeight: actifDansCat ? 'bold' : 'normal', cursor: 'pointer', fontSize: 14 }}>
                      {cat.label} ({dedans.length})
                    </button>
                  )
                })}
              </div>

              {/* Popup plein écran catégorie */}
              {popupCat && (() => {
                const cat = CATEGORIES.find(c => c.id === popupCat)
                const dedans = presetsCalendrierActif.filter(p => p.type === popupCat)
                return (
                  <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 500, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                    <div style={{ background: '#fff', borderRadius: '16px 16px 0 0', padding: '20px 16px', maxHeight: '80vh', overflowY: 'auto' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                        <h2 style={{ margin: 0, fontSize: 20 }}>{cat.label}</h2>
                        <button onClick={() => setPopupCat(null)}
                          style={{ border: 'none', background: '#f3f4f6', borderRadius: 8, padding: '6px 12px', fontSize: 16, cursor: 'pointer' }}>✕</button>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {dedans.map(p => (
                          <button key={p.id}
                            onClick={() => { setPresetActif(p.id); setModeGomme(false); setPopupCat(null) }}
                            style={{ padding: '14px 16px', borderRadius: 12, textAlign: 'left', cursor: 'pointer',
                              border: presetActif === p.id ? '2px solid #333' : '1px solid #e5e7eb',
                              background: presetActif === p.id ? '#1f2937' : '#fff',
                              display: 'flex', alignItems: 'center', gap: 12 }}>
                            {p.type === 'horaire'
                              ? <span style={{ width: 16, height: 16, borderRadius: '50%', background: couleurStatut(p.statut_horaire), flexShrink: 0 }} />
                              : p.image_url
                                ? <img src={p.image_url} alt="" style={{ width: 24, height: 24, objectFit: 'contain' }} />
                                : <span style={{ width: 16, height: 16, borderRadius: '50%', background: p.couleur, flexShrink: 0 }} />}
                            <span style={{ fontWeight: presetActif === p.id ? 'bold' : 'normal', fontSize: 16, color: presetActif === p.id ? '#fff' : '#1f2937' }}>{p.nom}</span>
                            {presetActif === p.id && <span style={{ marginLeft: 'auto', color: '#fff' }}>✓</span>}
                          </button>
                        ))}
                      </div>
                      {/* Désélectionner depuis la popup */}
                      {presetActif && presetsCalendrierActif.find(p => p.id === presetActif)?.type === popupCat && (
                        <button onClick={() => { setPresetActif(null); setModeGomme(false); setPopupCat(null) }}
                          style={{ width: '100%', marginTop: 12, padding: '12px', borderRadius: 12, border: '1px solid #e5e7eb', background: '#fef2f2', color: '#c00', fontWeight: 'bold', cursor: 'pointer' }}>
                          ✕ Désélectionner le pinceau
                        </button>
                      )}
                    </div>
                  </div>
                )
              })()}
            </>
          )
        })()}
        <button onClick={() => { setModeGomme(!modeGomme); setPresetActif(null) }} style={{ padding: '8px 14px', borderRadius: 6, border: modeGomme ? '2px solid #c00' : '1px solid #ccc', background: modeGomme ? '#fee2e2' : '#fff', color: modeGomme ? '#c00' : '#1f2937', fontWeight: modeGomme ? 'bold' : 'normal' }}>🧹 Gomme</button>
        {presetActif && (<>
          <button onClick={() => ouvrirEdition('preset', presets.find(p => p.id === presetActif))} style={{ padding: '6px 10px' }}>✏️</button>
          <button onClick={() => supprimerPreset(presetActif)} style={{ padding: '6px 10px', color: '#c00' }}>🗑️</button>
        </>)}
      </div>
      {(presetActif || modeGomme) ? (
        <p style={{ color: modeGomme ? '#c00' : '#16a34a', marginTop: 8 }}>{modeGomme ? '🧹 Clique sur un jour pour effacer.' : '✏️ Clique sur un jour pour peindre.'}</p>
      ) : (
        <p style={{ color: '#6b7280', marginTop: 8, fontSize: 13 }}>👆 Mode consultation : clique sur un jour pour voir son détail.</p>
      )}
    </div>
  )

  const selecteurVue = (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {[['semaine','Semaine'],['mois','Mois'],['annee','Année'],['equipe','Équipe']].map(([id, label]) => (
          <button key={id} onClick={() => setVue(id)} style={{ padding: '6px 14px', borderRadius: 6, border: vue === id ? '2px solid #333' : '1px solid #ccc', background: vue === id ? '#333' : '#fff', color: vue === id ? '#fff' : '#1f2937', fontWeight: vue === id ? 'bold' : 'normal' }}>{label}</button>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {vue === 'mois' && <><button onClick={moisPrecedent}>←</button><h2 style={{ margin: 0, fontSize: estMobile ? 16 : 20 }}>{MOIS[mois]} {annee}</h2><button onClick={moisSuivant}>→</button></>}
        {(vue === 'semaine' || vue === 'equipe') && <><button onClick={semainePrecedente}>←</button><h2 style={{ margin: 0, fontSize: estMobile ? 14 : 18 }}>Sem. {ancrageSemaine.toLocaleDateString('fr-FR')}</h2><button onClick={semaineSuivante}>→</button></>}
        {vue === 'annee' && <><button onClick={() => setAnnee(annee - 1)}>←</button><h2 style={{ margin: 0, fontSize: estMobile ? 16 : 20 }}>{annee}</h2><button onClick={() => setAnnee(annee + 1)}>→</button></>}
      </div>
    </div>
  )

  const zoneCalendrier = (
    <>
      {selecteurVue}
      {vue === 'mois' && rendreMois()}
      {vue === 'semaine' && rendreSemaine()}
      {vue === 'annee' && rendreAnnee()}
      {vue === 'equipe' && rendreEquipe()}
      {loading && <p>Chargement…</p>}
    </>
  )

  return (
    vueImport ? (
      <ImportPhoto
        onRetour={() => { setVueImport(false); chargerPresets(); chargerJours() }}
        personnes={personnes}
        presets={presets}
        calendrierActif={calendrierActif}
        calendriers={calendriers}
        onImportTermine={() => { chargerPresets(); chargerJours() }}
      />
    ) : (
    <div style={{ maxWidth: 1100, margin: estMobile ? '0 auto' : '30px auto', padding: estMobile ? `12px 10px ${ongletMobile === 'vue' ? '120px' : '80px'}` : '0 16px' }}>
      {sauvegarde !== 'idle' && (
        <div style={{ position: 'fixed', top: 12, right: 12, padding: '6px 14px', borderRadius: 20, background: sauvegarde === 'saving' ? '#fef3c7' : '#dcfce7', color: sauvegarde === 'saving' ? '#92400e' : '#166534', fontSize: 13, fontWeight: 'bold', zIndex: 300, boxShadow: '0 2px 6px rgba(0,0,0,0.15)' }}>{sauvegarde === 'saving' ? '💾 Enregistrement...' : '✓ Enregistré'}</div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <button onClick={onRetour}>← Hub</button>
        <h1 style={{ fontSize: estMobile ? 22 : 28, margin: 0 }}>📅 Planning</h1>
        <button onClick={() => setVueImport(true)} title="Importer une photo de planning"
          style={{ fontSize: 22, padding: '4px 10px', border: '1px solid #ccc', borderRadius: 8, background: '#fff', cursor: 'pointer' }}>
          📷
        </button>
      </div>

      {!estMobile ? (
        <>{blocCalendriers}{blocPersonnes}{blocPinceau}{zoneCalendrier}</>
      ) : (
        <>
          {ongletMobile === 'vue' && zoneCalendrier}
          {ongletMobile === 'peindre' && (blocPinceau || <p>Crée d'abord un calendrier et une personne dans l'onglet Gérer.</p>)}
          {ongletMobile === 'gerer' && <>{blocCalendriers}{blocPersonnes}</>}
        </>
      )}

      {estMobile && (
        <>
          {/* Barre d'outils pinceau — visible uniquement sur l'onglet Vue */}
          {ongletMobile === 'vue' && (
            <div style={{ position: 'fixed', bottom: 56, left: 0, right: 0, display: 'flex', background: 'rgba(255,255,255,0.97)', borderTop: '1px solid #e5e7eb', padding: '8px 12px', gap: 8, zIndex: 190, boxShadow: '0 -1px 4px rgba(0,0,0,0.06)' }}>
              {CATEGORIES.map(cat => {
                const dedans = presetsCalendrierActif.filter(p => p.type === cat.id)
                if (dedans.length === 0) return null
                const actifDansCat = dedans.find(p => p.id === presetActif)
                return (
                  <button key={cat.id} onClick={() => setPopupCat(cat.id)}
                    style={{ flex: 1, padding: '8px 4px', borderRadius: 10, border: actifDansCat ? '2px solid #333' : '1px solid #e5e7eb',
                      background: actifDansCat ? '#1f2937' : '#f9fafb', color: actifDansCat ? '#fff' : '#1f2937',
                      fontWeight: actifDansCat ? 'bold' : 'normal', cursor: 'pointer', fontSize: 12, textAlign: 'center' }}>
                    {cat.label}
                  </button>
                )
              })}
              <button onClick={() => { setModeGomme(!modeGomme); setPresetActif(null) }}
                style={{ padding: '8px 12px', borderRadius: 10, border: modeGomme ? '2px solid #c00' : '1px solid #e5e7eb',
                  background: modeGomme ? '#fee2e2' : '#f9fafb', color: modeGomme ? '#c00' : '#6b7280',
                  fontWeight: modeGomme ? 'bold' : 'normal', cursor: 'pointer', fontSize: 16 }}>
                🧹
              </button>
            </div>
          )}

          {/* Barre de navigation en bas */}
          <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, display: 'flex', background: '#fff', borderTop: '1px solid #e5e7eb', boxShadow: '0 -2px 8px rgba(0,0,0,0.08)', zIndex: 200 }}>
            {[['vue','📅','Vue'],['peindre','🛠️','Presets'],['gerer','⚙️','Gérer']].map(([id, icone, label]) => (
              <button key={id} onClick={() => setOngletMobile(id)} style={{ flex: 1, border: 'none', borderRadius: 0, background: ongletMobile === id ? '#eef2ff' : '#fff', padding: '10px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, color: ongletMobile === id ? '#3b82f6' : '#6b7280', fontWeight: ongletMobile === id ? 'bold' : 'normal' }}>
                <span style={{ fontSize: 20 }}>{icone}</span><span style={{ fontSize: 11 }}>{label}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {/* POPUP DÉTAIL JOUR */}
      {detailJour && (() => {
        const d = detailJour.dateObj
        const r = resumeJour(d.getFullYear(), d.getMonth(), d.getDate(), detailJour.personneId)
        const pers = personnes.find(p => p.id === detailJour.personneId)
        return (
          <div onClick={() => setDetailJour(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 400, padding: 16 }}>
            <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 12, padding: 20, width: '100%', maxWidth: 360, maxHeight: '80vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ margin: 0 }}>{d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</h3>
                <button onClick={() => setDetailJour(null)} style={{ border: 'none', background: 'transparent', fontSize: 20, cursor: 'pointer' }}>✕</button>
              </div>
              {pers && <p style={{ marginTop: 0, color: '#6b7280' }}><span style={pastille(pers.couleur, 10)} /> {pers.nom}</p>}
              {r.presetsDetail.length === 0 && r.evenements.length === 0 && <p style={{ color: '#9ca3af' }}>Rien de prévu ce jour.</p>}
              {r.presetsDetail.map((p, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 8, borderRadius: 8, marginBottom: 6, background: p.type === 'horaire' ? couleurStatut(p.statut_horaire) + '22' : '#f3f4f6' }}>
                  {p.type === 'horaire'
                    ? <span style={pastille(couleurStatut(p.statut_horaire), 16)} />
                    : (p.image_url ? <img src={p.image_url} alt="" style={{ width: (p.taille_icone || 28) + 6, height: (p.taille_icone || 28) + 6, objectFit: 'contain' }} /> : <span style={pastille(p.couleur, 16)} />)}
                  <div>
                    <div style={{ fontWeight: 'bold' }}>{p.nom}</div>
                    <div style={{ fontSize: 12, color: '#6b7280' }}>{CATEGORIES.find(c => c.id === p.type)?.label}{p.type === 'horaire' ? ' — ' + (STATUTS.find(s => s.id === p.statut_horaire)?.label || '') : ''}</div>
                  </div>
                </div>
              ))}
              {r.evenements.map((ev, i) => (
                <div key={'e' + i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 8, borderRadius: 8, marginBottom: 6, background: ev.couleur + '33' }}>
                  <span style={{ fontSize: 18 }}>🎉</span><div style={{ fontWeight: 'bold' }}>{ev.nom}</div>
                </div>
              ))}
            </div>
          </div>
        )
      })()}

      {/* POPUP ÉDITION */}
      {edition && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 400, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 10, padding: 20, width: '100%', maxWidth: 340, maxHeight: '85vh', overflowY: 'auto' }}>
            <h3 style={{ marginTop: 0 }}>Modifier {edition.type === 'preset' ? 'le preset' : edition.type === 'calendrier' ? 'le calendrier' : edition.type === 'personne' ? 'la personne' : "l'événement"}</h3>
            <input value={edition.nom} onChange={e => setEdition({ ...edition, nom: e.target.value })} style={{ padding: 8, width: '100%', marginBottom: 10, boxSizing: 'border-box' }} />
            {edition.type === 'preset' && (<>
              <select value={edition.categorie} onChange={e => setEdition({ ...edition, categorie: e.target.value })} style={{ padding: 8, marginBottom: 10, width: '100%' }}>{CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}</select>
              {edition.categorie === 'horaire' ? (
                <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                  {STATUTS.map(s => <button key={s.id} onClick={() => setEdition({ ...edition, statut: s.id })} style={{ padding: '6px 10px', borderRadius: 6, border: edition.statut === s.id ? '3px solid #000' : '1px solid #ccc', background: s.couleur, color: '#fff', fontWeight: 'bold', fontSize: 12 }}>{s.label}</button>)}
                </div>
              ) : (<>
                {edition.image_url && <div style={{ marginBottom: 8 }}><img src={edition.image_url} alt="" style={{ width: 40, height: 40, objectFit: 'contain' }} /> <span style={{ fontSize: 12, color: '#6b7280' }}>image actuelle</span></div>}
                <div style={{ marginBottom: 10 }}><label style={{ fontSize: 13 }}>Changer l'image : </label><input type="file" accept="image/*" onChange={e => setEdition({ ...edition, fichier: e.target.files[0] })} /></div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 10 }}>{PALETTE.map(c => <div key={c} onClick={() => setEdition({ ...edition, couleur: c })} style={{ width: 24, height: 24, borderRadius: 5, background: c, cursor: 'pointer', border: edition.couleur === c ? '3px solid #000' : '1px solid #ccc' }} />)}</div>
                <label style={{ fontSize: 13, fontWeight: 'bold' }}>Taille de l'icône : {edition.taille_icone}px</label>
                <input type="range" min="10" max="70" value={edition.taille_icone} onChange={e => setEdition({ ...edition, taille_icone: Number(e.target.value) })} style={{ width: '100%', marginBottom: 10 }} />
              </>)}
            </>)}
            {(edition.type === 'calendrier' || edition.type === 'personne') && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 14 }}>{PALETTE.map(c => <div key={c} onClick={() => setEdition({ ...edition, couleur: c })} style={{ width: 26, height: 26, borderRadius: 5, background: c, cursor: 'pointer', border: edition.couleur === c ? '3px solid #000' : '1px solid #ccc' }} />)}</div>
            )}
            {edition.type === 'evenement' && (<>
              <input type="date" value={edition.date} onChange={e => setEdition({ ...edition, date: e.target.value })} style={{ padding: 8, marginBottom: 10, width: '100%', boxSizing: 'border-box' }} />
              <select value={edition.recurrence} onChange={e => setEdition({ ...edition, recurrence: e.target.value })} style={{ padding: 8, marginBottom: 10, width: '100%' }}>{RECURRENCES.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}</select>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 14 }}>{PALETTE.map(c => <div key={c} onClick={() => setEdition({ ...edition, couleur: c })} style={{ width: 26, height: 26, borderRadius: 5, background: c, cursor: 'pointer', border: edition.couleur === c ? '3px solid #000' : '1px solid #ccc' }} />)}</div>
            </>)}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setEdition(null)} style={{ padding: '6px 14px' }}>Annuler</button>
              <button onClick={enregistrerEdition} style={{ padding: '6px 14px', fontWeight: 'bold' }}>Enregistrer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
)
}