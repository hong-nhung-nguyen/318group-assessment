import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowRight, CalendarDays, Check, Clock3, Compass, Copy, MapPin, Plane, Search, Send, Sparkles, Users, Wallet, X } from 'lucide-react';
import { getPackages, askAssistant } from './api';
import { photos, samplePackages, packageImage, matchingDepartures } from './data';
import './styles.css';

const blankFilters = { destination: '', date: '', travellers: '', budget: '', interests: '' };
const money = value => new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);
const clock = date => date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
const suggestions = ['Inspire me for a weekend getaway', 'Somewhere warm with great food for two'];
const greeting = 'Hello! I’m your Voyage travel concierge. I can help you find the right trip from our catalogue, compare departures, or just brainstorm ideas.\n\nTell me what you’re looking for! You can be as vague or specific as you like.';
const plainText = text => text.replace(/\*\*(.*?)\*\*/g, '$1').replace(/^#+\s*/gm, '').replace(/^\s*[*-]\s+/gm, '• ').trim();

function tripSummary(item, filters = blankFilters) {
  if (item.sample) return { price: item.price, days: item.days };
  const first = matchingDepartures(item, filters).sort((a, b) => a.price - b.price)[0];
  return { price: first?.price, days: first ? Math.round((Date.parse(first.endDate) - Date.parse(first.startDate)) / 86400000) : null };
}

// The assistant answers in prose, so recommendation cards come from the catalogue packages it names.
function findMatches(text, packages) {
  const lower = text.toLowerCase();
  const sentences = text.split(/(?<=[.!?])\s+/);
  return packages.map(item => {
    const keys = [item.name, item.destination, item.destination.split(',')[0]].map(k => k.trim().toLowerCase()).filter(k => k.length > 2);
    const found = keys.map(k => lower.indexOf(k)).filter(p => p >= 0);
    if (!found.length) return null;
    const reason = sentences.find(s => keys.some(k => s.toLowerCase().includes(k)));
    return { item, at: Math.min(...found), reason: reason ? reason.trim() : item.description };
  }).filter(Boolean).sort((a, b) => a.at - b.at).slice(0, 3);
}

function Modal({ title, children, close }) {
  const ref = useRef(null);
  useEffect(() => { const dialog = ref.current; dialog.showModal(); return () => dialog.close(); }, []);
  return <dialog ref={ref} onCancel={close} onClick={e => { if (e.target === ref.current) close(); }} aria-labelledby="dialog-title">
    <div className="modal-heading"><h2 id="dialog-title">{title}</h2><button className="icon-button" onClick={close} aria-label="Close dialog"><X size={21}/></button></div>{children}
  </dialog>;
}

function TripCard({ match, top, onSelect }) {
  const { item, reason } = match;
  const { price, days } = tripSummary(item);
  return <article className="trip-card">
    <div className="trip-photo"><img src={packageImage(item)} alt={`Travel inspiration for ${item.destination}`} loading="lazy"/>{top && <span className="badge"><Sparkles size={11}/>Top Match</span>}{price != null && <span className="price-tag">{item.sample ? '$' : ''}{money(price)}</span>}</div>
    <div className="trip-body">
      <h3>{item.name}</h3>
      <p className="trip-meta"><Plane size={12}/>{item.destination}{days != null && ` • ${days} Days`}</p>
      <div className="why"><span className="why-label"><Compass size={11}/>WHY WE RECOMMEND</span><p>{reason}</p></div>
      <button className="button secondary select-trip" onClick={() => onSelect(item)}>Select This Trip</button>
    </div>
  </article>;
}

function ConciergeMessage({ children }) {
  return <div className="msg bot"><span className="avatar-ai" aria-hidden="true"><Sparkles size={15}/></span><div className="msg-content"><span className="sender">Voyage Concierge</span>{children}</div></div>;
}

function AssistantView({ messages, asking, error, draft, setDraft, send, retry, openPackage, started }) {
  const endRef = useRef(null);
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [messages, asking, error]);
  const shortlist = [...messages].reverse().find(m => m.matches?.length)?.matches;
  return <main id="main" className="assistant-main">
    <div className="thread" role="log" aria-label="Conversation with your travel concierge">
      <p className="time-divider">TODAY, {clock(started)}</p>
      {messages.map((m, i) => m.role === 'user'
        ? <div className="msg user" key={i}><span className="sender">You</span><div className="row"><div className="bubble">{m.text}</div><button className="copy" onClick={() => navigator.clipboard?.writeText(m.text)} aria-label="Copy your message"><Copy size={14}/></button></div></div>
        : <ConciergeMessage key={i}>
            <div className="bubble">{m.text}</div>
            {m.matches?.length > 0 && <div className="trip-cards">{m.matches.map((match, n) => <TripCard key={match.item.packageId} match={match} top={n === 0} onSelect={openPackage}/>)}</div>}
            {i === 0 && messages.length === 1 && <div className="chips">{suggestions.map(s => <button key={s} className="chip" onClick={() => send(s)}>{s}</button>)}</div>}
          </ConciergeMessage>)}
      {asking && <ConciergeMessage><div className="bubble typing" role="status" aria-label="Your concierge is thinking"><span/><span/><span/></div></ConciergeMessage>}
      {error && <ConciergeMessage><div className="bubble error-bubble" role="alert">{error} <button onClick={retry}>Try again</button></div></ConciergeMessage>}
      {shortlist && !asking && <button className="draft-pill" onClick={() => openPackage(shortlist[0].item)}><span className="dot"/>TRIP SHORTLIST READY BASED ON YOUR REQUEST<span className="pill-arrow"><ArrowRight size={13}/></span></button>}
      <div ref={endRef}/>
    </div>
    <form className="composer" onSubmit={e => { e.preventDefault(); send(draft); }}>
      <div className="composer-inner"><input aria-label="Message your travel concierge" value={draft} onChange={e => setDraft(e.target.value)} placeholder="Describe your ideal trip…" maxLength={3000}/><button className="send" type="submit" disabled={asking || !draft.trim()} aria-label="Send message"><Send size={17}/></button></div>
      <p className="fine-print">Suggestions are a starting point. Confirm prices, dates and availability in the package details.</p>
    </form>
  </main>;
}

function App() {
  const [packages, setPackages] = useState([]);
  const [state, setState] = useState('loading');
  const [filters, setFilters] = useState(blankFilters);
  const [applied, setApplied] = useState(null);
  const [showAll, setShowAll] = useState(false);
  const [modal, setModal] = useState(null);
  const [view, setView] = useState('explore');
  const [headerQuery, setHeaderQuery] = useState('');
  const [messages, setMessages] = useState([{ role: 'assistant', text: greeting }]);
  const [draft, setDraft] = useState('');
  const [lastSent, setLastSent] = useState('');
  const [aiError, setAiError] = useState('');
  const [asking, setAsking] = useState(false);
  const [started] = useState(() => new Date());

  async function load() {
    setState('loading');
    try { const data = await getPackages(); setPackages(data); setState(data.length ? 'live' : 'empty'); }
    catch { setPackages([]); setState('offline'); }
  }
  useEffect(() => { load(); }, []);
  const demo = state === 'offline' || state === 'empty';
  const source = demo ? samplePackages : packages;
  const results = source.filter(item => {
    if (!applied) return true;
    if (!item.destination.toLowerCase().includes(applied.destination.trim().toLowerCase())) return false;
    if (item.sample) return !applied.date && !applied.travellers && (!applied.budget || item.price <= Number(applied.budget));
    return !(applied.date || applied.travellers || applied.budget) || matchingDepartures(item, applied).length > 0;
  });
  const visible = applied || showAll ? results : results.slice(0, 3);
  function update(event) { setFilters(current => ({ ...current, [event.target.name]: event.target.value })); }
  function scrollToPackages() { requestAnimationFrame(() => document.getElementById('packages')?.scrollIntoView({ behavior: 'smooth', block: 'start' })); }
  function search(event) { event.preventDefault(); setApplied({ ...filters }); scrollToPackages(); }
  function headerSearch(event) {
    event.preventDefault();
    const destination = headerQuery.trim();
    setFilters(current => ({ ...current, destination })); setApplied({ ...filters, destination }); setView('explore'); scrollToPackages();
  }
  function openAssistant(prefill = false) {
    if (prefill) setDraft(`Help me plan a trip${filters.destination ? ` to ${filters.destination}` : ''}${filters.date ? ` departing ${filters.date}` : ''}${filters.travellers ? ` for ${filters.travellers} travellers` : ''}${filters.budget ? ` with a budget of ${filters.budget} per person` : ''}${filters.interests ? `. My interests: ${filters.interests}` : ''}.`);
    setView('assistant'); window.scrollTo(0, 0);
  }
  async function ask(message) {
    setAsking(true); setAiError('');
    try {
      const data = await askAssistant(message);
      const text = plainText(String(data.response ?? ''));
      // Prefer the assistant's structured picks; fall back to packages it names in prose.
      const picks = (Array.isArray(data.recommendations) ? data.recommendations : []).map(pick => {
        const item = source.find(p => String(p.packageId) === String(pick.packageId)) || source.find(p => pick.name && p.name.toLowerCase() === String(pick.name).toLowerCase());
        return item ? { item, reason: String(pick.reason ?? '').trim() || item.description } : null;
      }).filter(Boolean).slice(0, 3);
      setMessages(current => [...current, { role: 'assistant', text, matches: picks.length ? picks : findMatches(text, source) }]);
    } catch { setAiError('Your travel concierge is unavailable right now. Please try again in a moment.'); }
    finally { setAsking(false); }
  }
  function send(text) {
    const message = text.trim(); if (!message || asking) return;
    setMessages(current => [...current, { role: 'user', text: message }]); setDraft(''); setLastSent(message); ask(message);
  }

  return <>
    <a className="skip-link" href="#main">Skip to content</a>
    <header className="header"><a className="brand" href="./" aria-label="Voyage home">Voyage<span className="brand-dot">.</span></a>
      {view === 'assistant' && <form className="header-search" onSubmit={headerSearch}><Search size={14}/><input aria-label="Search destinations" value={headerQuery} onChange={e => setHeaderQuery(e.target.value)} placeholder="Where to?"/></form>}
      <nav aria-label="Main navigation"><button className={view === 'explore' ? 'active' : ''} aria-current={view === 'explore' ? 'page' : undefined} onClick={() => { setView('explore'); window.scrollTo(0, 0); }}>Explore</button><button onClick={() => setModal('bookings')}>My Bookings</button><button className={view === 'assistant' ? 'active' : ''} aria-current={view === 'assistant' ? 'page' : undefined} onClick={() => openAssistant()}><Sparkles size={14}/>AI Assistant</button></nav>
      <button className="profile" onClick={() => setModal('profile')}>Profile<span className="avatar">V</span></button>
    </header>
    {view === 'assistant' ? <AssistantView messages={messages} asking={asking} error={aiError} draft={draft} setDraft={setDraft} send={send} retry={() => ask(lastSent)} openPackage={setModal} started={started}/> : <>
    <main id="main">
      <section className="hero" aria-labelledby="hero-title"><img className="hero-photo" src={photos.hero} alt="Tropical coastline with turquoise water and lush island cliffs" fetchPriority="high"/><div className="hero-shade"/>
        <div className="hero-copy"><span className="eyebrow"><span/> A WORLD OF POSSIBILITIES</span><h1 id="hero-title">Find your next unforgettable trip.</h1><p>Discover curated destinations tailored just for you, powered by intelligent AI.</p></div>
        <span className="photo-caption"><MapPin size={13}/> Somewhere you’d rather be</span>
      </section>
      <form className="search-panel" onSubmit={search}>
        <div className="search-fields">
          <label>Destination<div className="input-wrap"><MapPin/><input name="destination" value={filters.destination} onChange={update} placeholder="Where to?"/></div></label>
          <label>Departure date<div className="input-wrap"><CalendarDays/><input aria-label="Departure date" name="date" type="date" value={filters.date} min={new Date().toLocaleDateString('en-CA')} onChange={update}/></div></label>
          <label>Travellers<div className="input-wrap"><Users/><select name="travellers" value={filters.travellers} onChange={update}><option value="">Add guests</option>{[1,2,3,4,5,6,7,8].map(n => <option key={n} value={n}>{n} {n === 1 ? 'traveller' : 'travellers'}</option>)}</select></div></label>
          <label>Budget per person<div className="input-wrap"><Wallet/><select name="budget" value={filters.budget} onChange={update}><option value="">Any budget</option><option value="1500">Up to 1,500</option><option value="2500">Up to 2,500</option><option value="5000">Up to 5,000</option></select></div></label>
        </div>
        <div className="search-bottom"><input className="interests" name="interests" aria-label="Interests for your AI request" value={filters.interests} onChange={update} placeholder="Add interests for AI (e.g. food, hiking)"/><div className="search-actions"><button type="button" className="button secondary" onClick={() => openAssistant(true)}><Sparkles size={16}/>Ask AI Instead</button><button className="button primary" type="submit"><Search size={16}/>Search Trips</button></div></div>
      </form>
      <section className="packages-section" id="packages" aria-labelledby="packages-title">
        <div className="section-heading"><div><span className="section-kicker">A LITTLE INSPIRATION</span><h2 id="packages-title">{applied ? 'Your next adventure' : showAll ? 'Explore all packages' : 'Featured Packages'}</h2><p>{applied ? `${results.length} ${results.length === 1 ? 'trip' : 'trips'} to explore. Your next story starts here.` : 'Extraordinary places. Thoughtfully chosen experiences.'}</p></div><button className="text-button" onClick={() => { setShowAll(!showAll); setApplied(null); }}>{showAll || applied ? 'Back to featured' : 'See all'}<ArrowRight size={16}/></button></div>
        {demo && <div className="notice" role="status">{state === 'offline' ? 'Showing sample trips while the catalogue is unavailable.' : 'Your catalogue is empty. Explore these sample trips for inspiration.'} <button onClick={load}>Retry catalogue</button></div>}
        {state === 'loading' ? <div className="cards" aria-label="Loading trips" aria-busy="true">{[1,2,3].map(n => <div className="skeleton" key={n}/>)}</div> : <div className="cards">{visible.map((item, index) => {
          const { price, days } = tripSummary(item, applied || blankFilters);
          return <article className="card" key={item.packageId}><div className="card-photo"><img src={packageImage(item)} alt={`Travel inspiration for ${item.destination}`} loading="lazy"/>{index === 0 && !applied && <span className="badge"><Sparkles size={12}/>{demo ? 'Top Pick' : 'Discover'}</span>}{item.sample && <span className="sample-badge">Sample trip</span>}</div><div className="card-body"><span className="destination">{item.destination}</span><h3>{item.name}</h3><p className="duration"><Clock3 size={14}/>{days != null ? `${days} Days` : 'Dates coming soon'}</p><div className="card-bottom"><div>{price != null ? <><strong>{item.sample ? '$' : ''}{money(price)}</strong><span> / person</span></> : <span>Price unavailable</span>}</div><button className="text-button" onClick={() => setModal(item)}>View Details<ArrowRight size={13}/></button></div></div></article>;
        })}</div>}
        {state !== 'loading' && !results.length && <div className="empty-state"><Compass size={32}/><h3>A different adventure awaits</h3><p>Try another destination or fewer filters.{demo && ' Sample trips do not have bookable dates or availability.'}</p><button className="button secondary" onClick={() => { setFilters(blankFilters); setApplied(null); }}>Clear filters</button></div>}
        <div className="section-footnote"><Check size={14}/><span>A little inspiration today. An unforgettable journey tomorrow.</span></div>
      </section>
    </main>
    <footer><a className="brand" href="./">Voyage<span className="brand-dot">.</span></a><span>Go somewhere that stays with you.</span><span>Made for the curious.</span></footer>
    <button className="floating-assistant" onClick={() => openAssistant()} aria-label="Open AI travel assistant"><Sparkles size={25}/></button>
    </>}
    {(modal === 'profile' || modal === 'bookings') && <Modal title={modal === 'profile' ? 'Your Voyage profile' : 'Your journeys'} close={() => setModal(null)}><p className="modal-description">{modal === 'profile' ? 'Personal profiles are coming soon. You can already explore destinations and plan with the AI assistant.' : 'Personal booking history is coming soon. In the meantime, discover where your next journey could take you.'}</p><button className="button primary" onClick={() => setModal(null)}>Keep exploring<ArrowRight size={16}/></button></Modal>}
    {modal && typeof modal === 'object' && <Modal title={modal.name} close={() => setModal(null)}><img className="detail-image" src={packageImage(modal)} alt={modal.destination}/><p className="detail-location"><MapPin size={16}/>{modal.destination}</p><p className="modal-description">{modal.description}</p>{modal.sample ? <p className="notice">This is a sample itinerary for inspiration. Live departure dates and booking are not available.</p> : <><h3>Departures</h3>{modal.departureError ? <p>Departure details are temporarily unavailable.</p> : modal.departures.length ? <div className="departures">{modal.departures.map(d => <div className="departure" key={d.departureId}><strong>{d.startDate} → {d.endDate}</strong><span>{money(d.price)} per person · {d.status.toLowerCase().replaceAll('_', ' ')}</span><span>{d.availableCapacity == null ? 'Availability unconfirmed' : `${d.availableCapacity} spaces remaining`}</span></div>)}</div> : <p>Departure dates are coming soon.</p>}<p className="fine-print">Currency is not supplied by the catalogue. Confirm the currency before booking. Images are destination inspiration.</p></>}</Modal>}
  </>;
}

createRoot(document.getElementById('root')).render(<App/>);
