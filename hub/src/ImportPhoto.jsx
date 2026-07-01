import { useState } from 'react'
import { supabase } from './supabaseClient'

const STATUTS = [
  { id: 'ouverture', label: 'Ouverture', couleur: '#22c55e' },
  { id: 'fermeture', label: 'Fermeture', couleur: '#ef4444' },
  { id: 'intermediaire', label: 'Intermédiaire', couleur: '#f97316' },
]
const MOIS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']
const JOURS_ORDRE = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche']

function couleurStatut(s) {
  const x = STATUTS.find(v => v.id === s)
  return x ? x.couleur : '#9ca3af'
}
function similarite(a, b) {
  a = (a || '').toLowerCase().trim(); b = (b || '').toLowerCase().trim()
  if (!a || !b) return 0
  if (a === b) return 1
  if (a.includes(b) || b.includes(a)) return 0.85
  const m = a.length, n = b.length
  const d = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
  for (let i = 0; i <= m; i++) d[i][0] = i
  for (let j = 0; j <= n; j++) d[0][j] = j
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++)
    d[i][j] = Math.min(d[i-1][j]+1, d[i][j-1]+1, d[i-1][j-1]+(a[i-1]===b[j-1]?0:1))
  return 1 - d[m][n] / Math.max(m, n)
}
// Normalise un horaire détecté vers le format "HH:MM - HH:MM"
function normaliserHoraire(h) {
  if (!h) return h
  // Normalise "8:30 - 17:00" → "08:30 - 17:00"
  return h.replace(/(\d{1,2})[h:](\d{2})/g, (_, hh, mm) => String(hh).padStart(2, '0') + ':' + mm)
    .replace(/\s*-\s*/g, ' - ').trim()
}

export function ImportPhoto({ onRetour, personnes, presets, calendrierActif, calendriers, onImportTermine }) {
  const [etape, setEtape] = useState('upload')
  const [fichier, setFichier] = useState(null)
  const [apercu, setApercu] = useState(null)
  const [erreur, setErreur] = useState('')
  const [resultat, setResultat] = useState(null)
  const [nouveauxHorairesEnAttente, setNouveauxHorairesEnAttente] = useState([])
  const [indexNouvelHoraire, setIndexNouvelHoraire] = useState(0)
  const [statutsNouveaux, setStatutsNouveaux] = useState({})
  const [lignesValidees, setLignesValidees] = useState([])
  const [indexLigne, setIndexLigne] = useState(0)
  const [ligneEnCours, setLigneEnCours] = useState(null)
  const [progression, setProgression] = useState('')
  const [presetsActuels, setPresetsActuels] = useState(presets)

  const calObj = calendriers.find(c => c.id === calendrierActif)

  function choisirFichier(e) {
    const f = e.target.files[0]
    if (!f) return
    setFichier(f); setApercu(URL.createObjectURL(f)); setErreur('')
  }
  function lireBase64(f) {
    return new Promise((res, rej) => {
      const r = new FileReader()
      r.onload = () => res(r.result.split(',')[1])
      r.onerror = rej
      r.readAsDataURL(f)
    })
  }

  async function analyser() {
    if (!fichier) return
    setEtape('analyse'); setErreur(''); setProgression('Lecture de l\'image...')
    try {
      const base64 = await lireBase64(fichier)
      const mediaType = fichier.type || 'image/jpeg'
      const presetsHoraires = presetsActuels.filter(p => p.type === 'horaire').map(p => p.nom)
      const nomsPersonnes = personnes.map(p => p.nom)

      const prompt = `Tu analyses une photo d'un planning de travail hebdomadaire (commerce de détail français).

STRUCTURE DU PLANNING :
- Les PERSONNES sont en colonnes (nom + prénom, ex: "Cloe BACHELET")
- Les JOURS sont en lignes (Lundi à Dimanche, avec leur date)
- Chaque case croise une personne et un jour, et contient :
  * Une COULEUR DE FOND : VERT = Ouverture, BLEU = Fermeture, ORANGE/JAUNE = Intermédiaire, GRIS = Repos
  * Un mot de statut ("Ouverture", "Fermeture", "Intermédiaire", "Repos")
  * Des HORAIRES au format "HH:MM / durée_pause / HH:MM" (heure début / pause / heure fin)
  * Parfois des annotations MANUSCRITES (en rouge, bleu) = commentaires exceptionnels
  * Une case avec X ou barrée = absent

PERSONNES CONNUES : ${JSON.stringify(nomsPersonnes)}
HORAIRES EXISTANTS : ${JSON.stringify(presetsHoraires)}

CONSIGNES :
- Détecte la semaine et les dates.
- Pour CHAQUE personne ET CHAQUE jour, extrais : statut, horaire (format OBLIGATOIRE "HH:MM - HH:MM" avec zéro devant si nécessaire, ex: "08:30 - 16:30"), annotation éventuelle.
- Si Repos, absent ou croix : horaire = null.
- Donne un niveau de confiance : "haute", "moyenne" ou "basse".
- Réponds UNIQUEMENT avec un objet JSON valide, sans texte autour.

FORMAT :
{
  "semaine": "S26",
  "dates": { "lundi": "2026-06-22", "mardi": "2026-06-23", "mercredi": "2026-06-24", "jeudi": "2026-06-25", "vendredi": "2026-06-26", "samedi": "2026-06-27", "dimanche": null },
  "cases": [
    { "personne": "Cloe BACHELET", "jour": "lundi", "statut": "repos", "horaire": null, "annotation": null, "confiance": "haute" },
    { "personne": "Alexandre CHANU", "jour": "lundi", "statut": "intermediaire", "horaire": "10:00 - 18:00", "annotation": null, "confiance": "haute" }
  ]
}`

      setProgression('Analyse IA en cours (15-30 secondes)...')
      const reponse = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': import.meta.env.VITE_ANTHROPIC_KEY,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-opus-4-8',
          max_tokens: 4000,
          messages: [{ role: 'user', content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
            { type: 'text', text: prompt },
          ]}],
        }),
      })

      if (!reponse.ok) {
        const txt = await reponse.text()
        throw new Error('Erreur API (' + reponse.status + ') : ' + txt.slice(0, 200))
      }
      const data = await reponse.json()
      let texte = data.content.map(c => c.text || '').join('').trim()
      texte = texte.replace(/```json/g, '').replace(/```/g, '').trim()
      const parsed = JSON.parse(texte)
      parsed.cases = (parsed.cases || []).map(c => ({ ...c, horaire: normaliserHoraire(c.horaire) }))
      setResultat(parsed)

      // Trouver les nouveaux horaires uniques
      const presetsNoms = presetsActuels.filter(p => p.type === 'horaire').map(p => p.nom.toLowerCase().replace(/\s/g,''))
      const nouveaux = []
      const vus = new Set()
      for (const c of parsed.cases) {
        if (!c.horaire) continue
        const cle = c.horaire.toLowerCase().replace(/\s/g,'')
        if (!presetsNoms.includes(cle) && !vus.has(cle)) {
          vus.add(cle)
          nouveaux.push({ horaire: c.horaire, statut: c.statut || 'ouverture' })
        }
      }
      setNouveauxHorairesEnAttente(nouveaux)
      setIndexNouvelHoraire(0)

      if (nouveaux.length > 0) setEtape('nouveaux_horaires')
      else passageValidationLignes(parsed, {}, presetsActuels)
    } catch(e) {
      setErreur('Échec : ' + e.message); setEtape('upload')
    }
  }

  // Après validation des nouveaux horaires, on crée les presets puis on passe aux lignes
  async function validerNouveauxHoraires() {
    setEtape('analyse'); setProgression('Création des nouveaux horaires...')
    const nouveauxCreees = {}
    const presetsApresCreation = [...presetsActuels]
    for (const nh of nouveauxHorairesEnAttente) {
      const statut = statutsNouveaux[nh.horaire] || nh.statut || 'ouverture'
      const { data } = await supabase.from('presets').insert({
        nom: nh.horaire, type: 'horaire', calendrier_id: calendrierActif,
        statut_horaire: statut, couleur: couleurStatut(statut), taille_icone: 28,
      }).select()
      if (data && data[0]) {
        nouveauxCreees[nh.horaire] = data[0]
        presetsApresCreation.push(data[0])
      }
    }
    setPresetsActuels(presetsApresCreation)
    passageValidationLignes(resultat, nouveauxCreees, presetsApresCreation)
  }

  function passageValidationLignes(parsed, nouveauxCreees, tousPresets) {
    const presetsHoraires = tousPresets.filter(p => p.type === 'horaire')
    const lignes = (parsed.cases || [])
      .filter(c => c.horaire && c.statut !== 'repos')
      .sort((a, b) => JOURS_ORDRE.indexOf(a.jour) - JOURS_ORDRE.indexOf(b.jour))
      .map((c, idx) => {
        let meilleurePersonne = null, meilleurScore = 0
        for (const p of personnes) {
          const s = similarite(c.personne, p.nom)
          if (s > meilleurScore) { meilleurScore = s; meilleurePersonne = p }
        }
        const personneMatch = meilleurScore >= 0.5 ? meilleurePersonne : null
        const cleHoraire = (c.horaire || '').toLowerCase().replace(/\s/g, '')
        let presetHoraire = presetsHoraires.find(p => p.nom.toLowerCase().replace(/\s/g,'') === cleHoraire)
        if (!presetHoraire && nouveauxCreees[c.horaire]) presetHoraire = nouveauxCreees[c.horaire]
        return {
          id: idx,
          personneNom: c.personne,
          personneId: personneMatch?.id || null,
          jour: c.jour,
          statut: c.statut,
          horaire: c.horaire,
          presetHoraireId: presetHoraire?.id || null,
          presetHoraire,
          annotation: c.annotation,
          confiance: c.confiance,
        }
      })
    setLignesValidees(lignes)
    setIndexLigne(0)
    if (lignes.length > 0) {
      setLigneEnCours({ ...lignes[0] })
      setEtape('validation_sequentielle')
    } else {
      terminer([])
    }
  }

  function lignesSauvegardees_ref() { return [] }
  const [lignesAcceptees, setLignesAcceptees] = useState([])

  function validerLigneEnCours() {
    if (!ligneEnCours) return
    setLignesAcceptees(prev => [...prev, ligneEnCours])
    passerSuivante()
  }
  function ignorerLigneEnCours() { passerSuivante() }
  function passerSuivante() {
    const suivant = indexLigne + 1
    if (suivant < lignesValidees.length) {
      setIndexLigne(suivant)
      setLigneEnCours({ ...lignesValidees[suivant] })
    } else {
      terminer(lignesAcceptees)
    }
  }

  // BUG FIX : on utilise une ref pour accumuler proprement
  const [lignesFinales, setLignesFinales] = useState([])
  function validerEtPasser() {
    if (!ligneEnCours) return
    const nouvelleListe = [...lignesFinales, ligneEnCours]
    setLignesFinales(nouvelleListe)
    const suivant = indexLigne + 1
    if (suivant < lignesValidees.length) {
      setIndexLigne(suivant)
      setLigneEnCours({ ...lignesValidees[suivant] })
    } else {
      terminer(nouvelleListe)
    }
  }
  function ignorer() {
    const suivant = indexLigne + 1
    if (suivant < lignesValidees.length) {
      setIndexLigne(suivant)
      setLigneEnCours({ ...lignesValidees[suivant] })
    } else {
      terminer(lignesFinales)
    }
  }

  async function terminer(lignes) {
    setEtape('analyse'); setProgression('Peinture du planning...')
    try {
      const dates = resultat?.dates || {}
      const aInserer = []
      for (const l of lignes) {
        if (!l.personneId || !l.presetHoraireId) continue
        const dateJour = dates[l.jour]
        if (!dateJour) continue
        aInserer.push({ jour: dateJour, preset_id: l.presetHoraireId, calendrier_id: calendrierActif, personne_id: l.personneId })
      }
      if (aInserer.length > 0) await supabase.from('planning_jours').insert(aInserer)
      await supabase.from('imports_photo').insert({
        semaine: resultat?.semaine || null, statut: 'valide',
        nb_cases: aInserer.length, nb_nouveaux_horaires: nouveauxHorairesEnAttente.length,
        nb_personnes: new Set(aInserer.map(a => a.personne_id)).size,
      })
      setEtape('termine')
      if (onImportTermine) onImportTermine()
        setEtape('termine')
    } catch(e) {
      setErreur('Erreur peinture : ' + e.message); setEtape('validation_sequentielle')
    }
  }

  // === RENDUS ===

  if (etape === 'upload') return (
    <div style={{ maxWidth: 600, margin: '20px auto', padding: '0 16px' }}>
      <button onClick={onRetour} style={{ marginBottom: 16 }}>← Retour</button>
      <h1>📷 Importer un planning</h1>
      <p style={{ color: '#6b7280' }}>L'IA va lire les horaires, statuts et noms, puis tu valideras case par case avant l'application.</p>
      <p style={{ fontSize: 13, color: '#6b7280' }}>Calendrier cible : <strong style={{ color: calObj?.couleur }}>{calObj?.nom || '—'}</strong></p>
      <div style={{ border: '2px dashed #cbd5e1', borderRadius: 12, padding: 24, textAlign: 'center', marginBottom: 16 }}>
        <input type="file" accept="image/*" onChange={choisirFichier} style={{ marginBottom: 12 }} />
        {apercu && <img src={apercu} alt="aperçu" style={{ maxWidth: '100%', maxHeight: 280, borderRadius: 8, marginTop: 12 }} />}
      </div>
      {erreur && <p style={{ color: '#c00' }}>{erreur}</p>}
      <button onClick={analyser} disabled={!fichier}
        style={{ padding: '10px 20px', fontWeight: 'bold', fontSize: 16, background: fichier ? '#3b82f6' : '#ccc', color: '#fff', border: 'none', borderRadius: 8 }}>
        Analyser la photo
      </button>
    </div>
  )

  if (etape === 'analyse') return (
    <div style={{ maxWidth: 600, margin: '60px auto', textAlign: 'center', padding: '0 16px' }}>
      <div style={{ fontSize: 40, marginBottom: 16 }}>⏳</div>
      <h2>Traitement en cours...</h2>
      <p style={{ color: '#6b7280' }}>{progression}</p>
    </div>
  )

  if (etape === 'nouveaux_horaires') {
    const nh = nouveauxHorairesEnAttente[indexNouvelHoraire]
    const total = nouveauxHorairesEnAttente.length
    return (
      <div style={{ maxWidth: 500, margin: '40px auto', padding: '0 16px' }}>
        <h1>✨ Nouvel horaire détecté</h1>
        <p style={{ color: '#6b7280' }}>{indexNouvelHoraire + 1} / {total}</p>
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 20, background: '#fafafa', marginBottom: 20 }}>
          <p style={{ fontSize: 22, fontWeight: 'bold', textAlign: 'center', margin: '0 0 16px' }}>{nh.horaire}</p>
          <p style={{ marginBottom: 8, fontWeight: 'bold' }}>Quel est le statut de cet horaire ?</p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            {STATUTS.map(s => (
              <button key={s.id} onClick={() => setStatutsNouveaux(v => ({ ...v, [nh.horaire]: s.id }))}
                style={{ flex: 1, padding: '12px 8px', borderRadius: 8, color: '#fff', background: s.couleur, fontWeight: 'bold',
                  border: (statutsNouveaux[nh.horaire] || nh.statut) === s.id ? '3px solid #000' : '2px solid transparent', fontSize: 14 }}>
                {s.label}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {indexNouvelHoraire > 0 && (
            <button onClick={() => setIndexNouvelHoraire(i => i - 1)} style={{ padding: '10px 16px' }}>← Précédent</button>
          )}
          {indexNouvelHoraire < total - 1 ? (
            <button onClick={() => setIndexNouvelHoraire(i => i + 1)}
              style={{ flex: 1, padding: '10px 20px', fontWeight: 'bold', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 8 }}>
              Suivant →
            </button>
          ) : (
            <button onClick={validerNouveauxHoraires}
              style={{ flex: 1, padding: '10px 20px', fontWeight: 'bold', background: '#22c55e', color: '#fff', border: 'none', borderRadius: 8 }}>
              Créer ces horaires et continuer →
            </button>
          )}
        </div>
      </div>
    )
  }

   if (etape === 'validation_sequentielle' && ligneEnCours) {
    const total = lignesValidees.length
    const progress = Math.round((indexLigne / total) * 100)
    
    // Format date lisible
    const MOIS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']
    const dateStr = resultat?.dates?.[ligneEnCours.jour]
    let dateLisible = ligneEnCours.jour.charAt(0).toUpperCase() + ligneEnCours.jour.slice(1)
    if (dateStr) {
      const d = new Date(dateStr + 'T00:00:00')
      dateLisible += ' ' + d.getDate() + ' ' + MOIS_FR[d.getMonth()]
    }

    return (
      <div style={{ maxWidth: 500, margin: '20px auto', padding: '0 16px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <h1 style={{ margin: 0, fontSize: 22 }}>✅ Validation</h1>
          <span style={{ color: '#6b7280', fontSize: 14 }}>{indexLigne + 1} / {total}</span>
        </div>

        {/* Barre de progression */}
        <div style={{ height: 6, background: '#e5e7eb', borderRadius: 3, marginBottom: 20 }}>
          <div style={{ height: '100%', width: progress + '%', background: '#3b82f6', borderRadius: 3, transition: 'width 0.2s' }} />
        </div>

        <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 20, background: '#fff', marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Confiance */}
          <div style={{ textAlign: 'right', fontSize: 13, color: '#6b7280' }}>
            {ligneEnCours.confiance === 'haute' ? '🟢 Haute' : ligneEnCours.confiance === 'moyenne' ? '🟠 Moyenne' : '🔴 Basse'}
          </div>

          {/* Personne */}
          <select value={ligneEnCours.personneId || ''}
            onChange={e => setLigneEnCours(l => ({ ...l, personneId: e.target.value || null }))}
            style={{ padding: 12, width: '100%', fontSize: 15, borderRadius: 8,
              border: !ligneEnCours.personneId ? '2px solid #f87171' : '1px solid #d1d5db' }}>
            <option value="">⚠️ {ligneEnCours.personneNom}</option>
            {personnes.map(p => <option key={p.id} value={p.id}>{p.nom}</option>)}
          </select>

          {/* Date */}
          <select value={ligneEnCours.jour}
            onChange={e => setLigneEnCours(l => ({ ...l, jour: e.target.value }))}
            style={{ padding: 12, width: '100%', fontSize: 15, borderRadius: 8, border: '1px solid #d1d5db' }}>
            {JOURS_ORDRE.map(j => {
              const ds = resultat?.dates?.[j]
              let label = j.charAt(0).toUpperCase() + j.slice(1)
              if (ds) { const d = new Date(ds + 'T00:00:00'); label += ' ' + d.getDate() + ' ' + MOIS_FR[d.getMonth()] }
              return <option key={j} value={j}>{label}</option>
            })}
          </select>

          {/* Preset horaire — liste simple */}
          <select value={ligneEnCours.presetHoraireId || ''}
            onChange={e => setLigneEnCours(l => ({ ...l, presetHoraireId: e.target.value || null }))}
            style={{ padding: 12, width: '100%', fontSize: 15, borderRadius: 8,
              border: !ligneEnCours.presetHoraireId ? '2px solid #f87171' : '1px solid #d1d5db' }}>
            <option value="">— Choisir un horaire —</option>
            {presetsActuels.filter(p => p.type === 'horaire').map(p => (
              <option key={p.id} value={p.id}>{p.nom}</option>
            ))}
          </select>

          {/* Annotation manuscrite si présente */}
          {ligneEnCours.annotation && (
            <div style={{ background: '#fef3c7', borderRadius: 8, padding: 10, fontSize: 13 }}>
              📝 {ligneEnCours.annotation}
            </div>
          )}
        </div>

        {/* Boutons */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={ignorer}
            style={{ padding: '14px 16px', borderRadius: 8, border: '1px solid #d1d5db', background: '#f9fafb', color: '#6b7280', fontSize: 15, cursor: 'pointer' }}>
            Ignorer
          </button>
          <button onClick={validerEtPasser}
            style={{ flex: 1, padding: '14px 20px', fontWeight: 'bold', fontSize: 16, background: '#22c55e', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
            {indexLigne < lignesValidees.length - 1 ? '✓ Valider →' : '✓ Terminer'}
          </button>
        </div>

        <p style={{ textAlign: 'center', fontSize: 12, color: '#9ca3af', marginTop: 8 }}>
          {lignesFinales.length} validée(s) sur {indexLigne} vues
        </p>
      </div>
    )
  }

  return null
}