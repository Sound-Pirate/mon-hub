import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from './supabaseClient'

const TYPES_BLOCS = [
  { id: 'texte', label: 'Texte', icone: '¶' },
  { id: 'h1', label: 'Titre 1', icone: 'H₁' },
  { id: 'h2', label: 'Titre 2', icone: 'H₂' },
  { id: 'h3', label: 'Titre 3', icone: 'H₃' },
  { id: 'puce', label: 'Liste à puces', icone: '•' },
  { id: 'numero', label: 'Liste numérotée', icone: '1.' },
  { id: 'coche', label: 'Case à cocher', icone: '☑' },
  { id: 'citation', label: 'Citation', icone: '❝' },
  { id: 'callout', label: 'Encadré', icone: '💡' },
  { id: 'code', label: 'Code', icone: '</>' },
  { id: 'separateur', label: 'Séparateur', icone: '―' },
]
const EMOJIS = ['📄','📝','📚','💡','🎯','🏠','⭐','🔥','📌','✅','🗂️','🧠','💼','🎨','🎵','🍕','✈️','🏋️','📅','💰','🔧','📊','🌱','❤️']

export function Notes({ onRetour }) {
  const [estMobile, setEstMobile] = useState(window.innerWidth < 768)
  useEffect(() => {
    const onResize = () => setEstMobile(window.innerWidth < 768)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const [pages, setPages] = useState([])
  const [pageActive, setPageActive] = useState(null)
  const [blocs, setBlocs] = useState([])
  const [sidebarOuverte, setSidebarOuverte] = useState(!estMobile)
  const [recherche, setRecherche] = useState('')
  const [vueCorbeille, setVueCorbeille] = useState(false)
  const [sauvegarde, setSauvegarde] = useState('idle')
  const [menuBloc, setMenuBloc] = useState(null)
  const [choixEmoji, setChoixEmoji] = useState(false)
  const [nouveauTag, setNouveauTag] = useState('')
  const [titrLocal, setTitreLocal] = useState('')
  const [focusBlocId, setFocusBlocId] = useState(null)

  const timeoutSauvegarde = useRef({})
  const timeoutTitre = useRef(null)

  function flash() { setSauvegarde('saved'); setTimeout(() => setSauvegarde('idle'), 1000) }

  // --- Chargements ---
  async function chargerPages() {
    const { data } = await supabase.from('pages').select('*').order('ordre').order('created_at')
    if (data) setPages(data)
  }
  async function chargerBlocs(pageId) {
    const { data } = await supabase.from('blocs').select('*').eq('page_id', pageId).order('ordre')
    if (data) setBlocs(data)
  }
  useEffect(() => { chargerPages() }, [])
  useEffect(() => {
    if (pageActive) {
      chargerBlocs(pageActive.id)
      setTitreLocal(pageActive.titre || '')
    }
  }, [pageActive?.id])

  // --- Pages ---
  async function creerPage(parentId = null) {
    setSauvegarde('saving')
    const { data } = await supabase.from('pages').insert({
      titre: 'Sans titre', parent_id: parentId, icone: '📄'
    }).select()
    if (data && data[0]) {
      const page = data[0]
      const { data: b } = await supabase.from('blocs').insert({
        page_id: page.id, type: 'texte', contenu: '', ordre: 0
      }).select()
      await chargerPages()
      setPageActive(page)
      setTitreLocal('')
      if (b && b[0]) setFocusBlocId(b[0].id)
      if (estMobile) setSidebarOuverte(false)
    }
    flash()
  }

  async function majPageServeur(id, champs) {
    await supabase.from('pages').update({ ...champs, updated_at: new Date().toISOString() }).eq('id', id)
    setPages(ps => ps.map(p => p.id === id ? { ...p, ...champs } : p))
    if (pageActive?.id === id) setPageActive(p => ({ ...p, ...champs }))
  }

  // Titre avec debounce — évite le re-render à chaque lettre
  function changerTitre(val) {
    setTitreLocal(val)
    clearTimeout(timeoutTitre.current)
    timeoutTitre.current = setTimeout(async () => {
      setSauvegarde('saving')
      await majPageServeur(pageActive.id, { titre: val })
      flash()
    }, 500)
  }

  async function majPage(id, champs) {
    setSauvegarde('saving')
    await majPageServeur(id, champs)
    flash()
  }

  async function archiverPage(id) {
    await majPage(id, { archive: true })
    if (pageActive?.id === id) setPageActive(null)
  }
  async function restaurerPage(id) { await majPage(id, { archive: false }) }
  async function supprimerDefinitif(id) {
    if (!confirm('Supprimer définitivement ?')) return
    setSauvegarde('saving')
    await supabase.from('pages').delete().eq('id', id)
    await chargerPages()
    if (pageActive?.id === id) setPageActive(null)
    flash()
  }

  // --- Blocs ---
  async function ajouterBloc(apresBloc = null, type = 'texte') {
    if (!pageActive) return
    const ordreApres = apresBloc ? apresBloc.ordre : (blocs.length ? blocs[blocs.length - 1].ordre : -1)
    setSauvegarde('saving')
    const { data } = await supabase.from('blocs').insert({
      page_id: pageActive.id, type, contenu: '', ordre: ordreApres + 1,
      coche: false
    }).select()
    if (data && data[0]) {
      const nouveau = data[0]
      setBlocs(prev => {
        const liste = [...prev, nouveau].sort((a, b) => a.ordre - b.ordre)
        return liste
      })
      setFocusBlocId(nouveau.id)
    }
    flash()
    return data?.[0]
  }

  function majBlocLocal(id, champs) {
    setBlocs(bs => bs.map(b => b.id === id ? { ...b, ...champs } : b))
    clearTimeout(timeoutSauvegarde.current[id])
    timeoutSauvegarde.current[id] = setTimeout(async () => {
      setSauvegarde('saving')
      await supabase.from('blocs').update(champs).eq('id', id)
      flash()
    }, 600)
  }

  async function supprimerBloc(id) {
    if (blocs.length <= 1) {
      // Ne pas supprimer le dernier bloc, juste vider
      majBlocLocal(id, { contenu: '', type: 'texte' })
      return
    }
    setSauvegarde('saving')
    await supabase.from('blocs').delete().eq('id', id)
    setBlocs(bs => {
      const reste = bs.filter(b => b.id !== id)
      if (reste.length > 0) setFocusBlocId(reste[reste.length - 1].id)
      return reste
    })
    flash()
  }

  async function changerTypeBloc(id, type) {
    await supabase.from('blocs').update({ type }).eq('id', id)
    setBlocs(bs => bs.map(b => b.id === id ? { ...b, type } : b))
    setMenuBloc(null)
    setFocusBlocId(id)
  }

  // --- Tags ---
  async function ajouterTag() {
    if (!nouveauTag.trim() || !pageActive) return
    const tags = [...(pageActive.tags || []), nouveauTag.trim()]
    await majPage(pageActive.id, { tags })
    setNouveauTag('')
  }
  async function retirerTag(tag) {
    const tags = (pageActive.tags || []).filter(t => t !== tag)
    await majPage(pageActive.id, { tags })
  }

  // --- Arborescence ---
  const pagesActives = pages.filter(p => !p.archive)
  const pagesArchivees = pages.filter(p => p.archive)
  const favoris = pagesActives.filter(p => p.favori)

  function enfantsDe(parentId) {
    return pagesActives.filter(p => p.parent_id === parentId)
  }

  // Recherche sur titre ET tags
  const pagesFiltrees = recherche.trim()
    ? pagesActives.filter(p =>
        p.titre.toLowerCase().includes(recherche.toLowerCase()) ||
        (p.tags || []).some(t => t.toLowerCase().includes(recherche.toLowerCase()))
      )
    : null

  function ArbrePages({ parentId = null, niveau = 0 }) {
    const enfants = enfantsDe(parentId)
    return enfants.map(page => (
      <div key={page.id}>
        <div onClick={() => { setPageActive(page); setVueCorbeille(false); if (estMobile) setSidebarOuverte(false) }}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px',
            paddingLeft: 8 + niveau * 16, borderRadius: 6, cursor: 'pointer', fontSize: 14,
            background: pageActive?.id === page.id ? '#e0e7ff' : 'transparent' }}>
          <span>{page.icone}</span>
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {page.titre || 'Sans titre'}
          </span>
          <button onClick={e => { e.stopPropagation(); creerPage(page.id) }} title="Sous-page"
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#9ca3af', fontSize: 14 }}>＋</button>
        </div>
        <ArbrePages parentId={page.id} niveau={niveau + 1} />
      </div>
    ))
  }

  // --- Bloc éditable ---
  function BlocEditable({ bloc, index }) {
    const inputRef = useRef(null)

    // Focus automatique sur ce bloc si demandé
    useEffect(() => {
      if (focusBlocId === bloc.id && inputRef.current) {
        inputRef.current.focus()
        const len = inputRef.current.value.length
        inputRef.current.setSelectionRange(len, len)
        setFocusBlocId(null)
      }
    }, [focusBlocId, bloc.id])

    // Auto-resize textarea
    useEffect(() => {
      if (inputRef.current) {
        inputRef.current.style.height = 'auto'
        inputRef.current.style.height = inputRef.current.scrollHeight + 'px'
      }
    }, [bloc.contenu])

    async function handleKeyDown(e) {
      if (e.key === 'Enter' && !e.shiftKey && bloc.type !== 'code') {
        e.preventDefault()
        // Si on tape / on vient de choisir un type, on reste sur ce bloc
        const typeNouveau = ['coche', 'puce', 'numero'].includes(bloc.type) ? bloc.type : 'texte'
        await ajouterBloc(bloc, typeNouveau)
      }
      if (e.key === 'Backspace' && bloc.contenu === '') {
        e.preventDefault()
        supprimerBloc(bloc.id)
      }
      if (e.key === 'Escape') setMenuBloc(null)
    }

    function handleChange(e) {
      const v = e.target.value
      if (v === '/') {
        setMenuBloc(bloc.id)
        majBlocLocal(bloc.id, { contenu: v })
      } else {
        majBlocLocal(bloc.id, { contenu: v })
        if (menuBloc === bloc.id && v !== '/') setMenuBloc(null)
      }
    }

    const styleParType = {
      h1: { fontSize: 28, fontWeight: 'bold', lineHeight: 1.3 },
      h2: { fontSize: 22, fontWeight: 'bold', lineHeight: 1.3 },
      h3: { fontSize: 18, fontWeight: '600', lineHeight: 1.3 },
      texte: { fontSize: 15, lineHeight: 1.6 },
      puce: { fontSize: 15, lineHeight: 1.6 },
      numero: { fontSize: 15, lineHeight: 1.6 },
      coche: { fontSize: 15, lineHeight: 1.6 },
      citation: { fontSize: 15, fontStyle: 'italic', lineHeight: 1.6 },
      callout: { fontSize: 15, lineHeight: 1.6 },
      code: { fontSize: 13, fontFamily: 'monospace', lineHeight: 1.5 },
    }

    const zoneStyle = {
      border: 'none', outline: 'none', width: '100%', resize: 'none',
      fontFamily: 'inherit', background: 'transparent', color: bloc.type === 'code' ? '#e5e7eb' : '#1f2937',
      overflow: 'hidden', ...(styleParType[bloc.type] || {}),
    }

    if (bloc.type === 'separateur') {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0' }}>
          <hr style={{ flex: 1, border: 'none', borderTop: '1px solid #e5e7eb' }} />
          <button onClick={() => supprimerBloc(bloc.id)}
            style={{ border: 'none', background: 'transparent', color: '#d1d5db', cursor: 'pointer', fontSize: 14 }}>✕</button>
        </div>
      )
    }

    const textarea = (
      <textarea ref={inputRef} rows={1} value={bloc.contenu}
        onChange={handleChange} onKeyDown={handleKeyDown}
        placeholder={index === 0 ? "Tape '/' pour insérer un bloc..." : ''}
        style={zoneStyle} />
    )

    // Bouton supprimer toujours visible (petit, discret)
    const btnSuppr = (
      <button onClick={() => supprimerBloc(bloc.id)}
        style={{ border: 'none', background: 'transparent', color: '#d1d5db', cursor: 'pointer',
          fontSize: 14, padding: '0 4px', flexShrink: 0, alignSelf: 'flex-start', marginTop: 2 }}
        title="Supprimer ce bloc">✕</button>
    )

    let contenu
    if (bloc.type === 'coche') {
      contenu = (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, width: '100%' }}>
          <input type="checkbox" checked={!!bloc.coche}
            onChange={e => majBlocLocal(bloc.id, { coche: e.target.checked })}
            style={{ marginTop: 4, flexShrink: 0 }} />
          <div style={{ flex: 1, textDecoration: bloc.coche ? 'line-through' : 'none', opacity: bloc.coche ? 0.5 : 1 }}>
            {textarea}
          </div>
        </div>
      )
    } else if (bloc.type === 'puce') {
      contenu = (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, width: '100%' }}>
          <span style={{ marginTop: 4, flexShrink: 0, color: '#6b7280' }}>•</span>
          <div style={{ flex: 1 }}>{textarea}</div>
        </div>
      )
    } else if (bloc.type === 'numero') {
      const num = blocs.filter(b => b.type === 'numero' && b.ordre <= bloc.ordre).length
      contenu = (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, width: '100%' }}>
          <span style={{ marginTop: 4, flexShrink: 0, color: '#6b7280', minWidth: 20 }}>{num}.</span>
          <div style={{ flex: 1 }}>{textarea}</div>
        </div>
      )
    } else if (bloc.type === 'citation') {
      contenu = (
        <div style={{ borderLeft: '3px solid #cbd5e1', paddingLeft: 12, color: '#6b7280', width: '100%' }}>
          {textarea}
        </div>
      )
    } else if (bloc.type === 'callout') {
      contenu = (
        <div style={{ background: '#fef3c7', borderRadius: 8, padding: '10px 12px', display: 'flex', gap: 8, width: '100%' }}>
          <span>💡</span><div style={{ flex: 1 }}>{textarea}</div>
        </div>
      )
    } else if (bloc.type === 'code') {
      contenu = (
        <div style={{ background: '#1f2937', borderRadius: 8, padding: 12, width: '100%' }}>
          {textarea}
        </div>
      )
    } else {
      contenu = <div style={{ width: '100%' }}>{textarea}</div>
    }

    return (
      <div style={{ position: 'relative', padding: '2px 0', display: 'flex', alignItems: 'flex-start', gap: 4 }}>
        <div style={{ flex: 1 }}>{contenu}</div>
        {btnSuppr}
        {/* Menu / */}
        {menuBloc === bloc.id && (
          <div style={{ position: 'absolute', left: 0, top: '100%', zIndex: 50, background: '#fff',
            border: '1px solid #e5e7eb', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
            padding: 6, maxHeight: 280, overflowY: 'auto', minWidth: 200 }}>
            {TYPES_BLOCS.map(t => (
              <div key={t.id}
                onClick={() => {
                  changerTypeBloc(bloc.id, t.id)
                  majBlocLocal(bloc.id, { contenu: '' })
                }}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px',
                  borderRadius: 6, cursor: 'pointer', fontSize: 14 }}
                onMouseEnter={e => e.currentTarget.style.background = '#f3f4f6'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <span style={{ width: 24, textAlign: 'center', color: '#6b7280' }}>{t.icone}</span>
                {t.label}
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  // === RENDU PRINCIPAL ===
  const largeurSidebar = 260
  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', position: 'relative' }}
      onClick={() => { setMenuBloc(null); setChoixEmoji(false) }}>

      {estMobile && sidebarOuverte && (
        <div onClick={() => setSidebarOuverte(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 90 }} />
      )}

      {/* SIDEBAR */}
      <div style={{
        width: largeurSidebar, background: '#f9fafb', borderRight: '1px solid #e5e7eb',
        display: 'flex', flexDirection: 'column',
        position: estMobile ? 'fixed' : 'relative', top: 0, bottom: 0, left: 0, zIndex: 100,
        transform: estMobile ? (sidebarOuverte ? 'translateX(0)' : `translateX(-${largeurSidebar}px)`) : 'none',
        transition: 'transform 0.25s ease', height: '100vh'
      }}>
        <div style={{ padding: 12, borderBottom: '1px solid #e5e7eb', display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={onRetour} style={{ padding: '4px 8px', fontSize: 13 }}>← Hub</button>
          <strong style={{ flex: 1 }}>📝 Notes</strong>
        </div>
        <div style={{ padding: 10 }}>
          <input value={recherche} onChange={e => setRecherche(e.target.value)}
            placeholder="🔍 Titre ou #tag..."
            style={{ width: '100%', padding: 8, borderRadius: 8, border: '1px solid #e5e7eb', boxSizing: 'border-box' }} />
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 10px' }}>
          {pagesFiltrees ? (
            <div>
              <div style={{ fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', margin: '8px 0 4px' }}>
                Résultats ({pagesFiltrees.length})
              </div>
              {pagesFiltrees.map(p => (
                <div key={p.id}
                  onClick={() => { setPageActive(p); setVueCorbeille(false); if (estMobile) setSidebarOuverte(false) }}
                  style={{ display: 'flex', gap: 6, padding: '6px 8px', borderRadius: 6, cursor: 'pointer', fontSize: 14,
                    background: pageActive?.id === p.id ? '#e0e7ff' : 'transparent' }}>
                  <span>{p.icone}</span>
                  <div>
                    <div>{p.titre}</div>
                    {p.tags?.length > 0 && (
                      <div style={{ fontSize: 11, color: '#9ca3af' }}>{p.tags.map(t => '#' + t).join(' ')}</div>
                    )}
                  </div>
                </div>
              ))}
              {pagesFiltrees.length === 0 && <p style={{ fontSize: 13, color: '#9ca3af' }}>Aucun résultat.</p>}
            </div>
          ) : (
            <>
              {favoris.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', margin: '8px 0 4px' }}>⭐ Favoris</div>
                  {favoris.map(p => (
                    <div key={p.id}
                      onClick={() => { setPageActive(p); setVueCorbeille(false); if (estMobile) setSidebarOuverte(false) }}
                      style={{ display: 'flex', gap: 6, padding: '6px 8px', borderRadius: 6, cursor: 'pointer', fontSize: 14,
                        background: pageActive?.id === p.id ? '#e0e7ff' : 'transparent' }}>
                      <span>{p.icone}</span><span>{p.titre}</span>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', margin: '8px 0 4px' }}>Pages</div>
              <ArbrePages parentId={null} niveau={0} />
              <button onClick={() => creerPage(null)}
                style={{ width: '100%', textAlign: 'left', padding: '6px 8px', marginTop: 6,
                  border: 'none', background: 'transparent', color: '#6b7280', cursor: 'pointer', fontSize: 14 }}>
                ＋ Nouvelle page
              </button>
            </>
          )}
        </div>
        <div style={{ padding: 10, borderTop: '1px solid #e5e7eb' }}>
          <button onClick={() => { setVueCorbeille(true); setPageActive(null); if (estMobile) setSidebarOuverte(false) }}
            style={{ width: '100%', textAlign: 'left', padding: '6px 8px', border: 'none',
              background: 'transparent', color: '#6b7280', cursor: 'pointer', fontSize: 14 }}>
            🗑️ Corbeille ({pagesArchivees.length})
          </button>
        </div>
      </div>

      {/* ZONE PRINCIPALE */}
      <div style={{ flex: 1, overflowY: 'auto', height: '100vh', position: 'relative' }}
        onClick={e => e.stopPropagation()}>
        {estMobile && (
          <div style={{ position: 'sticky', top: 0, background: '#fff', borderBottom: '1px solid #e5e7eb',
            padding: 10, display: 'flex', alignItems: 'center', gap: 10, zIndex: 40 }}>
            <button onClick={e => { e.stopPropagation(); setSidebarOuverte(true) }} style={{ fontSize: 18, padding: '4px 10px' }}>☰</button>
            <span style={{ flex: 1, fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {pageActive ? `${pageActive.icone} ${titrLocal || 'Sans titre'}` : (vueCorbeille ? '🗑️ Corbeille' : 'Notes')}
            </span>
          </div>
        )}

        {sauvegarde !== 'idle' && (
          <div style={{ position: 'fixed', top: 12, right: 12, padding: '4px 12px', borderRadius: 20,
            fontSize: 12, fontWeight: 'bold', zIndex: 300,
            background: sauvegarde === 'saving' ? '#fef3c7' : '#dcfce7',
            color: sauvegarde === 'saving' ? '#92400e' : '#166534' }}>
            {sauvegarde === 'saving' ? '💾' : '✓'}
          </div>
        )}

        {vueCorbeille ? (
          <div style={{ maxWidth: 700, margin: '0 auto', padding: 24 }}>
            <h1>🗑️ Corbeille</h1>
            {pagesArchivees.length === 0
              ? <p style={{ color: '#9ca3af' }}>La corbeille est vide.</p>
              : pagesArchivees.map(p => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10, borderBottom: '1px solid #eee' }}>
                  <span>{p.icone}</span>
                  <span style={{ flex: 1 }}>{p.titre}</span>
                  <button onClick={() => restaurerPage(p.id)} style={{ padding: '4px 10px' }}>Restaurer</button>
                  <button onClick={() => supprimerDefinitif(p.id)} style={{ padding: '4px 10px', color: '#c00' }}>Supprimer</button>
                </div>
              ))}
          </div>
        ) : pageActive ? (
          <div style={{ maxWidth: 720, margin: '0 auto', padding: estMobile ? '16px 20px 100px' : '40px 60px' }}>
            {/* En-tête */}
            <div style={{ position: 'relative', marginBottom: 8 }} onClick={e => e.stopPropagation()}>
              <button onClick={e => { e.stopPropagation(); setChoixEmoji(v => !v) }}
                style={{ fontSize: 40, border: 'none', background: 'transparent', cursor: 'pointer', padding: 0 }}>
                {pageActive.icone}
              </button>
              {choixEmoji && (
                <div onClick={e => e.stopPropagation()}
                  style={{ position: 'absolute', top: 50, left: 0, zIndex: 60, background: '#fff',
                    border: '1px solid #e5e7eb', borderRadius: 10, padding: 10,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
                    display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 4, width: 280 }}>
                  {EMOJIS.map(e => (
                    <button key={e} onClick={() => { majPage(pageActive.id, { icone: e }); setChoixEmoji(false) }}
                      style={{ fontSize: 22, border: 'none', background: 'transparent', cursor: 'pointer', padding: 4 }}>
                      {e}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Titre — state local pour éviter le vol de focus */}
            <input value={titrLocal}
              onChange={e => changerTitre(e.target.value)}
              placeholder="Sans titre"
              style={{ fontSize: 34, fontWeight: 'bold', border: 'none', outline: 'none',
                width: '100%', marginBottom: 8, color: '#1f2937', background: 'transparent' }} />

            {/* Tags + actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
              <button onClick={() => majPage(pageActive.id, { favori: !pageActive.favori })}
                style={{ padding: '2px 8px', fontSize: 13 }}>
                {pageActive.favori ? '⭐' : '☆'}
              </button>
              {(pageActive.tags || []).map(t => (
                <span key={t} style={{ background: '#e0e7ff', borderRadius: 12, padding: '2px 10px',
                  fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  #{t}
                  <button onClick={() => retirerTag(t)}
                    style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 12 }}>✕</button>
                </span>
              ))}
              <input value={nouveauTag}
                onChange={e => setNouveauTag(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && ajouterTag()}
                placeholder="+ tag"
                style={{ border: 'none', outline: 'none', fontSize: 13, width: 70, background: 'transparent' }} />
              <button onClick={() => archiverPage(pageActive.id)}
                style={{ marginLeft: 'auto', padding: '2px 8px', fontSize: 13, color: '#c00' }}>
                🗑️
              </button>
            </div>

            {/* Blocs */}
            <div>
              {blocs.map((b, i) => (
                <BlocEditable key={b.id} bloc={b} index={i} />
              ))}
            </div>
            <button onClick={() => ajouterBloc(blocs[blocs.length - 1] || null, 'texte')}
              style={{ marginTop: 12, padding: '6px 12px', border: '1px dashed #d1d5db',
                borderRadius: 8, background: 'transparent', color: '#9ca3af', cursor: 'pointer', fontSize: 14 }}>
              ＋ Ajouter un bloc
            </button>
          </div>
        ) : (
          <div style={{ maxWidth: 500, margin: '80px auto', textAlign: 'center', padding: 20, color: '#9ca3af' }}>
            <div style={{ fontSize: 50 }}>📝</div>
            <h2 style={{ color: '#6b7280' }}>Bienvenue dans tes notes</h2>
            <p>Sélectionne une page ou crée-en une nouvelle.</p>
            <button onClick={() => creerPage(null)}
              style={{ padding: '10px 20px', fontWeight: 'bold', background: '#3b82f6',
                color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
              ＋ Créer ma première page
            </button>
          </div>
        )}

        {estMobile && !vueCorbeille && (
          <button onClick={() => creerPage(null)}
            style={{ position: 'fixed', bottom: 20, right: 20, width: 56, height: 56,
              borderRadius: '50%', background: '#3b82f6', color: '#fff', border: 'none',
              fontSize: 28, boxShadow: '0 4px 12px rgba(0,0,0,0.25)', cursor: 'pointer', zIndex: 80 }}>
            ＋
          </button>
        )}
      </div>
    </div>
  )
}