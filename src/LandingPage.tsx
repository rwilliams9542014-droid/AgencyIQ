import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Bot, BriefcaseBusiness, CalendarClock, CircleCheck as CheckCircle2, ChevronDown, CircleDollarSign, Gauge, Handshake, Lock, Mail, MessageSquare, Phone, RefreshCcw, Shield, Sparkles, Star, Users, X, Zap, Menu } from 'lucide-react'
import agencyIqLogo from './assets/agencyiq-logo.png'
import mascotImg from './assets/IQ_MASCOT-removebg-preview.png'
import './LandingPage.css'

// ─── Data ─────────────────────────────────────────────────────────────────────
const FEATURES = [
  { icon: <Users size={22} />, title: 'Full Client CRM', desc: 'Complete 360° client profiles — policies, billing, tasks, notes, and activity history all in one place.' },
  { icon: <CalendarClock size={22} />, title: 'Renewal Pipeline', desc: 'Automated 90/60/30-day renewal alerts. Your pipeline is always current so you never miss an expiration.' },
  { icon: <Bot size={22} />, title: 'Ask IQ — AI Assistant', desc: 'Built-in AI explains policy terms, coverage gaps, and client scenarios in plain English, right inside your workflow.' },
  { icon: <RefreshCcw size={22} />, title: 'IVANS Integration', desc: 'Sync policy and billing data directly from carriers via IVANS. Keep your book of business accurate automatically.' },
  { icon: <CircleDollarSign size={22} />, title: 'Billing & Commission', desc: 'Track Direct Bill, Agency Bill, financed policies, and escrow. Commission calculations are built right in.' },
  { icon: <Gauge size={22} />, title: 'Agency Dashboard', desc: 'Real-time KPIs — premium in force, renewal rate, active clients, open leads, and revenue at a glance.' },
  { icon: <BriefcaseBusiness size={22} />, title: 'Lead Management', desc: 'Move prospects through a structured pipeline from New Lead to Bound. Never lose a quote opportunity again.' },
  { icon: <MessageSquare size={22} />, title: 'Communication Hub', desc: 'Email and SMS templates for renewals, follow-ups, and payment reminders — with full message history per client.' },
  { icon: <Shield size={22} />, title: 'Role-Based Access', desc: 'Owner, Producer, CSR, and read-only roles. Every user sees only what they need — nothing more, nothing less.' },
]

const PLANS = [
  {
    name: 'Monthly',
    price: '$199',
    period: '/month',
    tag: null as string | null,
    desc: 'Flexible billing. No annual commitment required.',
    features: ['1 user included', 'Full CRM access', 'Renewal pipeline', 'Ask IQ assistant', 'IVANS carrier sync', 'Cancel anytime'],
    cta: 'Get started',
    highlight: false,
  },
  {
    name: 'Annual',
    price: '$1,999',
    period: '/year',
    tag: 'Best Value',
    desc: 'Save $389 vs monthly. Billed once per year.',
    features: ['1 user included', 'Full CRM access', 'Renewal pipeline', 'Ask IQ assistant', 'IVANS carrier sync', 'Priority support'],
    cta: 'Start annual plan',
    highlight: true,
  },
  {
    name: '5-Year Lock',
    price: '$7,999',
    period: 'one-time',
    tag: 'Price Locked',
    desc: 'Lock your rate for 5 years. Best long-term value.',
    features: ['1 user included', 'Full CRM access', 'Renewal pipeline', 'Ask IQ assistant', 'IVANS carrier sync', 'White-glove onboarding'],
    cta: 'Lock my rate',
    highlight: false,
  },
]

const ADD_ONS = [
  { label: 'Additional user', monthly: '$39/mo', annual: '$390/yr', lock: '$1,499 one-time' },
  { label: 'SMS + Email Upgrade', monthly: '$99/mo', annual: '$999/yr', lock: '$3,999 one-time' },
]

const SMS_FEATURES = [
  'Send email directly from CRM', 'Send SMS directly from CRM',
  'Client communication history', 'Renewal follow-up messages',
  'Payment reminder messages', 'Quote follow-up sequences',
  'Task-based follow-up reminders', 'Agency message templates',
  'Full activity log of sent messages',
]

// ─── Component ────────────────────────────────────────────────────────────────
export default function LandingPage({ onEnterCrm }: { onEnterCrm: () => void }) {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [heroVisible, setHeroVisible] = useState(false)
  const [addonsOpen, setAddonsOpen] = useState(false)
  const [legalOpen, setLegalOpen] = useState(false)
  const [contactSent, setContactSent] = useState(false)
  const [form, setForm] = useState({ name: '', agency: '', email: '', phone: '', message: '' })
  const [mascotClicks, setMascotClicks] = useState(0)
  const [mascotZapping, setMascotZapping] = useState(false)
  const heroRef = useRef<HTMLDivElement>(null)
  const mascotRef = useRef<HTMLImageElement>(null)

  const handleMascotClick = () => {
    if (mascotZapping) return
    const next = mascotClicks + 1
    setMascotClicks(next)
    if (next >= 3) {
      setMascotZapping(true)
      setTimeout(() => { setMascotZapping(false); setMascotClicks(0) }, 2000)
    }
  }

  const renderLpLightning = () => {
    if (!mascotZapping || !mascotRef.current) return null
    const rect = mascotRef.current.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    const W = window.innerWidth
    const H = window.innerHeight
    type BoltDef = { pts: string; delay: number; branches: string[] }
    const bolts: BoltDef[] = [
      { pts: `${cx},${cy} ${cx-40},${cy-60} ${cx*0.55},${cy*0.45} ${cx*0.3},${cy*0.18} 0,0`,
        delay: 0, branches: [`${cx*0.55},${cy*0.45} ${cx*0.38},${cy*0.55} ${cx*0.2},${cy*0.5}`, `${cx*0.3},${cy*0.18} ${cx*0.18},${cy*0.3} 0,${cy*0.22}`] },
      { pts: `${cx},${cy} ${cx+18},${cy*0.5} ${cx-22},${cy*0.22} ${cx+12},${cy*0.05} ${cx-5},0`,
        delay: 0.03, branches: [`${cx+18},${cy*0.5} ${cx+65},${cy*0.38} ${cx+90},${cy*0.48}`, `${cx-22},${cy*0.22} ${cx-55},${cy*0.28} ${cx-78},${cy*0.18}`] },
      { pts: `${cx},${cy} ${cx+(W-cx)*0.35},${cy*0.6} ${cx+(W-cx)*0.62},${cy*0.28} ${cx+(W-cx)*0.82},${cy*0.1} ${W},0`,
        delay: 0.01, branches: [`${cx+(W-cx)*0.35},${cy*0.6} ${cx+(W-cx)*0.42},${cy*0.42} ${cx+(W-cx)*0.6},${cy*0.5}`, `${cx+(W-cx)*0.62},${cy*0.28} ${cx+(W-cx)*0.72},${cy*0.42} ${cx+(W-cx)*0.68},${cy*0.55}`] },
      { pts: `${cx},${cy} ${cx+(W-cx)*0.3},${cy-18} ${cx+(W-cx)*0.58},${cy+32} ${cx+(W-cx)*0.82},${cy-12} ${W},${cy+5}`,
        delay: 0.05, branches: [`${cx+(W-cx)*0.3},${cy-18} ${cx+(W-cx)*0.36},${cy-65} ${cx+(W-cx)*0.52},${cy-55}`, `${cx+(W-cx)*0.58},${cy+32} ${cx+(W-cx)*0.62},${cy+80} ${cx+(W-cx)*0.78},${cy+68}`] },
      { pts: `${cx},${cy} ${cx+(W-cx)*0.3},${cy+(H-cy)*0.32} ${cx+(W-cx)*0.55},${cy+(H-cy)*0.6} ${cx+(W-cx)*0.78},${cy+(H-cy)*0.82} ${W},${H}`,
        delay: 0.02, branches: [`${cx+(W-cx)*0.3},${cy+(H-cy)*0.32} ${cx+(W-cx)*0.22},${cy+(H-cy)*0.48} ${cx+(W-cx)*0.12},${cy+(H-cy)*0.44}`, `${cx+(W-cx)*0.55},${cy+(H-cy)*0.6} ${cx+(W-cx)*0.65},${cy+(H-cy)*0.52} ${cx+(W-cx)*0.72},${cy+(H-cy)*0.62}`] },
      { pts: `${cx},${cy} ${cx-28},${cy+(H-cy)*0.35} ${cx+22},${cy+(H-cy)*0.62} ${cx-15},${cy+(H-cy)*0.82} ${cx+8},${H}`,
        delay: 0.04, branches: [`${cx-28},${cy+(H-cy)*0.35} ${cx-75},${cy+(H-cy)*0.42} ${cx-100},${cy+(H-cy)*0.38}`, `${cx+22},${cy+(H-cy)*0.62} ${cx+68},${cy+(H-cy)*0.68} ${cx+88},${cy+(H-cy)*0.6}`] },
      { pts: `${cx},${cy} ${cx*0.7},${cy+(H-cy)*0.28} ${cx*0.42},${cy+(H-cy)*0.55} ${cx*0.2},${cy+(H-cy)*0.8} 0,${H}`,
        delay: 0.06, branches: [`${cx*0.7},${cy+(H-cy)*0.28} ${cx*0.58},${cy+(H-cy)*0.22} ${cx*0.48},${cy+(H-cy)*0.35}`, `${cx*0.42},${cy+(H-cy)*0.55} ${cx*0.32},${cy+(H-cy)*0.48} ${cx*0.18},${cy+(H-cy)*0.55}`] },
      { pts: `${cx},${cy} ${cx*0.6},${cy+25} ${cx*0.32},${cy-30} ${cx*0.12},${cy+18} 0,${cy+8}`,
        delay: 0.07, branches: [`${cx*0.6},${cy+25} ${cx*0.5},${cy+72} ${cx*0.35},${cy+60}`, `${cx*0.32},${cy-30} ${cx*0.22},${cy-70} ${cx*0.12},${cy-58}`] },
    ]
    const sparks = Array.from({ length: 32 }, (_, i) => {
      const angle = (i / 32) * Math.PI * 2
      const r1 = 55 + (i % 5) * 18
      const r2 = r1 + 40 + (i % 7) * 22
      return { x1: cx + Math.cos(angle) * r1, y1: cy + Math.sin(angle) * r1, x2: cx + Math.cos(angle) * r2, y2: cy + Math.sin(angle) * r2, delay: 0.04 + (i % 8) * 0.018 }
    })
    return (
      <div className="lp-zap-overlay" aria-hidden="true">
        <svg className="lp-zap-svg" viewBox={`0 0 ${W} ${H}`}>
          <defs>
            <filter id="lp-zap-glow-tight" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="2.5" result="b1" />
              <feGaussianBlur stdDeviation="6" result="b2" />
              <feMerge><feMergeNode in="b2" /><feMergeNode in="b1" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <filter id="lp-zap-glow-wide" x="-120%" y="-120%" width="340%" height="340%">
              <feGaussianBlur stdDeviation="16" result="b" />
              <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <filter id="lp-zap-spark-f" x="-80%" y="-80%" width="260%" height="260%">
              <feGaussianBlur stdDeviation="1.5" result="b" />
              <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>
          {sparks.map((s, i) => (
            <line key={`lp-spark-${i}`} className="lp-zap-spark" x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} style={{ animationDelay: `${s.delay}s` }} />
          ))}
          {bolts.map((b, i) => (
            <g key={`lp-bolt-${i}`}>
              <polyline className="lp-zap-bolt-glow" points={b.pts} style={{ animationDelay: `${b.delay}s` }} />
              <polyline className="lp-zap-bolt-core" points={b.pts} style={{ animationDelay: `${b.delay}s` }} />
              {b.branches.map((br, j) => (
                <polyline key={`lp-br-${i}-${j}`} className="lp-zap-bolt-branch" points={br} style={{ animationDelay: `${b.delay + 0.05 + j * 0.03}s` }} />
              ))}
            </g>
          ))}
          <circle className="lp-zap-shockring" cx={cx} cy={cy} r="10" />
          <circle className="lp-zap-shockring lp-zap-shockring--2" cx={cx} cy={cy} r="10" />
          <circle className="lp-zap-origin" cx={cx} cy={cy} r="8" />
        </svg>
        <div className="lp-zap-flash" />
      </div>
    )
  }

  useEffect(() => {
    const t = setTimeout(() => setHeroVisible(true), 80)
    const onScroll = () => setScrolled(window.scrollY > 32)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => { clearTimeout(t); window.removeEventListener('scroll', onScroll) }
  }, [])

  const scrollTo = (id: string) => {
    setMobileOpen(false)
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const setField = (k: keyof typeof form, v: string) => setForm(f => ({ ...f, [k]: v }))

  const NAV = [
    { label: 'Features', id: 'lp-features' },
    { label: 'Pricing', id: 'lp-pricing' },
    { label: 'About', id: 'lp-about' },
    { label: 'Contact', id: 'lp-contact' },
  ]

  return (
    <div className="lp">

      {/* ── NAV ───────────────────────────────────────────────── */}
      <nav className={`lp-nav${scrolled ? ' lp-nav--scrolled' : ''}`}>
        <div className="lp-nav-inner">
          <button className="lp-logo-btn" type="button" onClick={() => scrollTo('lp-hero')}>
            <img src={agencyIqLogo} alt="AgencyIQ Insurance CRM" className="lp-logo" />
          </button>
          <ul className="lp-nav-links">
            {NAV.map(n => (
              <li key={n.id}>
                <button type="button" className="lp-nav-link" onClick={() => scrollTo(n.id)}>{n.label}</button>
              </li>
            ))}
          </ul>
          <div className="lp-nav-right">
            <button type="button" className="lp-btn-ghost" onClick={onEnterCrm}>Log In</button>
            <button type="button" className="lp-btn-primary" onClick={onEnterCrm}>
              Access CRM <ArrowRight size={14} />
            </button>
          </div>
          <button className="lp-hamburger" type="button" aria-label="Menu" onClick={() => setMobileOpen(v => !v)}>
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
        {mobileOpen && (
          <div className="lp-mobile-nav">
            {NAV.map(n => (
              <button key={n.id} type="button" className="lp-mobile-link" onClick={() => scrollTo(n.id)}>{n.label}</button>
            ))}
            <button type="button" className="lp-btn-primary lp-mobile-cta" onClick={onEnterCrm}>Access CRM</button>
          </div>
        )}
      </nav>

      {/* ── HERO ──────────────────────────────────────────────── */}
      <section id="lp-hero" className={`lp-hero${heroVisible ? ' lp-hero--in' : ''}`} ref={heroRef}>
        <div className="lp-hero-orb lp-hero-orb--a" />
        <div className="lp-hero-orb lp-hero-orb--b" />
        <div className="lp-hero-orb lp-hero-orb--c" />

        <div className="lp-hero-inner">
          <div className="lp-hero-copy">
            <span className="lp-kicker"><Sparkles size={12} />Built for insurance professionals</span>
            <h1>
              The CRM built for<br />
              <span className="lp-gradient-text">insurance agencies</span>
            </h1>
            <p className="lp-hero-sub">
              AgencyIQ brings client management, policy tracking, renewal pipelines,
              and an AI assistant together in one platform designed around how real
              insurance agents actually work.
            </p>
            <div className="lp-hero-actions">
              <button type="button" className="lp-btn-primary lp-btn-lg" onClick={onEnterCrm}>
                Access the CRM <ArrowRight size={16} />
              </button>
              <button type="button" className="lp-btn-outline-light lp-btn-lg" onClick={() => scrollTo('lp-features')}>
                See all features
              </button>
            </div>
            <div className="lp-trust-row">
              <span><CheckCircle2 size={13} />No setup fees</span>
              <span><CheckCircle2 size={13} />Cancel anytime</span>
              <span><CheckCircle2 size={13} />US-based support</span>
            </div>
          </div>

          <div className="lp-hero-visual">
            <div className="lp-hero-glow" />
            {mascotClicks === 2 && !mascotZapping && (
              <svg className="lp-charge-arcs" viewBox="0 0 200 200" aria-hidden="true">
                <defs>
                  <filter id="arc-glow">
                    <feGaussianBlur stdDeviation="3" result="b" />
                    <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
                  </filter>
                </defs>
                <polyline className="lp-arc lp-arc--a" points="100,10 88,45 105,45 78,95" filter="url(#arc-glow)" />
                <polyline className="lp-arc lp-arc--b" points="160,40 142,70 155,70 130,110" filter="url(#arc-glow)" />
                <polyline className="lp-arc lp-arc--c" points="40,50 58,80 44,80 68,115" filter="url(#arc-glow)" />
                <polyline className="lp-arc lp-arc--d" points="175,110 155,130 165,130 148,160" filter="url(#arc-glow)" />
                <polyline className="lp-arc lp-arc--e" points="25,100 45,122 34,122 52,150" filter="url(#arc-glow)" />
              </svg>
            )}
            <img
              ref={mascotRef}
              src={mascotImg}
              alt="IQ — your AgencyIQ assistant"
              className={`lp-hero-mascot lp-mascot--charge-${mascotClicks}${mascotZapping ? ' lp-mascot--zapping' : ''}`}
              onClick={handleMascotClick}
              style={{ cursor: 'pointer' }}
            />
            <div className="lp-bubble lp-bubble--top">
              <strong>Renewal in 14 days</strong>
              <span>Sarah M. — Auto policy</span>
            </div>
            <div className="lp-bubble lp-bubble--bottom">
              <strong>New lead bound!</strong>
              <span>$4,200 premium added</span>
            </div>
          </div>
        </div>

        <button className="lp-scroll-hint" type="button" onClick={() => scrollTo('lp-features')}>
          <span>Explore features</span>
          <ChevronDown size={16} />
        </button>
      </section>

      {/* ── STATS BAR ─────────────────────────────────────────── */}
      <div className="lp-stats-bar">
        <div className="lp-stats-inner">
          {[
            { val: '360°', label: 'Client visibility' },
            { val: '30-day', label: 'Renewal alerts' },
            { val: 'AI', label: 'Built-in assistant' },
            { val: 'IVANS', label: 'Carrier sync' },
            { val: '$199', label: 'Starting price' },
          ].map(s => (
            <div key={s.label} className="lp-stat">
              <strong>{s.val}</strong>
              <span>{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── FEATURES ──────────────────────────────────────────── */}
      <section id="lp-features" className="lp-section lp-features">
        <div className="lp-container">
          <div className="lp-section-head">
            <span className="lp-kicker lp-kicker--dark">Everything you need</span>
            <h2>Built for how agencies actually work</h2>
            <p>Every feature was designed around a real insurance workflow — not adapted from a generic CRM.</p>
          </div>
          <div className="lp-features-grid">
            {FEATURES.map(f => (
              <div key={f.title} className="lp-feature-card">
                <div className="lp-feature-icon">{f.icon}</div>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SPOTLIGHT: ASK IQ ─────────────────────────────────── */}
      <section className="lp-spotlight">
        <div className="lp-container lp-spotlight-inner">
          <div className="lp-spotlight-copy">
            <span className="lp-kicker">Meet Ask IQ</span>
            <h2>Your AI assistant, always on the clock</h2>
            <p>Ask IQ is woven into every part of the CRM. Get plain-language answers to coverage questions, help explaining policy terms to clients, and renewal script suggestions — without ever leaving your screen.</p>
            <ul className="lp-check-list">
              {[
                'Explains coverage terms in plain English',
                'Suggests renewal scripts by client type',
                'Answers billing and commission questions',
                'Helps agents handle difficult client conversations',
              ].map(i => <li key={i}><CheckCircle2 size={15} />{i}</li>)}
            </ul>
            <button type="button" className="lp-btn-primary" onClick={onEnterCrm}>
              Try Ask IQ <ArrowRight size={14} />
            </button>
          </div>
          <div className="lp-spotlight-visual">
            <div className="lp-chat-card">
              <div className="lp-chat-user">What's the difference between ACV and replacement cost?</div>
              <div className="lp-chat-iq">
                <span className="lp-chat-label"><Bot size={11} />Ask IQ</span>
                ACV (Actual Cash Value) pays what your property was worth at the time of loss, factoring in depreciation. Replacement Cost pays what it would cost to replace it new. For a 5-year-old roof, ACV might pay $8,000 while Replacement Cost pays $18,000.
              </div>
            </div>
            <img src={mascotImg} alt="" aria-hidden="true" className="lp-spotlight-mascot" />
          </div>
        </div>
      </section>

      {/* ── PRICING ───────────────────────────────────────────── */}
      <section id="lp-pricing" className="lp-section lp-pricing">
        <div className="lp-container">
          <div className="lp-section-head">
            <span className="lp-kicker lp-kicker--dark">Simple, transparent pricing</span>
            <h2>Invest in your agency's growth</h2>
            <p>One flat rate per agency. No per-user traps, no hidden fees. Just the tools you need at a price that makes sense.</p>
          </div>

          <div className="lp-plans-grid">
            {PLANS.map(plan => (
              <div key={plan.name} className={`lp-plan${plan.highlight ? ' lp-plan--highlight' : ''}`}>
                {plan.tag && <span className="lp-plan-tag">{plan.tag}</span>}
                <div className="lp-plan-name">{plan.name}</div>
                <div className="lp-plan-price">{plan.price}<span>{plan.period}</span></div>
                <p className="lp-plan-desc">{plan.desc}</p>
                <ul className="lp-plan-features">
                  {plan.features.map(f => <li key={f}><CheckCircle2 size={13} />{f}</li>)}
                </ul>
                <button
                  type="button"
                  className={plan.highlight ? 'lp-btn-primary' : 'lp-btn-outline-dark'}
                  onClick={onEnterCrm}
                >
                  {plan.cta}
                </button>
              </div>
            ))}
          </div>

          {/* Add-ons toggle */}
          <div className="lp-addons">
            <button type="button" className="lp-addons-toggle" onClick={() => setAddonsOpen(v => !v)}>
              <Zap size={14} />
              View add-ons &amp; upgrades
              <ChevronDown size={14} className={addonsOpen ? 'lp-flip' : ''} />
            </button>

            {addonsOpen && (
              <div className="lp-addons-body">
                <h3>Add-ons</h3>
                <div className="lp-table">
                  <div className="lp-table-head">
                    <span>Add-On</span><span>Monthly</span><span>Annual</span><span>5-Year Lock</span>
                  </div>
                  {ADD_ONS.map(a => (
                    <div key={a.label} className="lp-table-row">
                      <span>{a.label}</span>
                      <span>{a.monthly}</span>
                      <span>{a.annual}</span>
                      <span>{a.lock}</span>
                    </div>
                  ))}
                </div>

                <div className="lp-sms-box">
                  <div className="lp-sms-head"><MessageSquare size={16} /><strong>SMS + Email Communication Upgrade</strong></div>
                  <ul className="lp-sms-list">
                    {SMS_FEATURES.map(f => <li key={f}><CheckCircle2 size={12} />{f}</li>)}
                  </ul>
                  <p className="lp-sms-note"><Lock size={11} />SMS usage may be subject to fair-use limits or pass-through carrier fees.</p>
                </div>

                <div className="lp-addons-example">
                  <strong>Example:</strong> A 3-person agency on monthly pays $199 + $39 + $39 = <strong>$277/month</strong> — well below what most insurance AMS platforms charge per user.
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── ABOUT ─────────────────────────────────────────────── */}
      <section id="lp-about" className="lp-section lp-about">
        <div className="lp-container lp-about-inner">
          <div className="lp-about-mascot-wrap">
            <div className="lp-about-glow" />
            <img src={mascotImg} alt="" aria-hidden="true" className="lp-about-mascot" />
          </div>
          <div className="lp-about-copy">
            <span className="lp-kicker lp-kicker--dark">About AgencyIQ</span>
            <h2>Built by people who understand insurance</h2>
            <p>AgencyIQ was created for independent agents who are tired of generic CRM platforms that need hours of customization just to track a policy renewal. We built the platform we wished existed.</p>
            <p>Every feature — from the renewal pipeline to the AI assistant — was designed with real agency workflows in mind. Producers need fast client access. CSRs need organized task queues. Owners need clean revenue visibility.</p>
            <p>We're committed to keeping AgencyIQ focused on insurance, priced fairly, and supported by a team that actually picks up the phone.</p>
            <div className="lp-values">
              {[
                { icon: <Handshake size={17} />, label: 'Built for agents, not adapted for them' },
                { icon: <Shield size={17} />, label: 'US-based support & data security' },
                { icon: <Star size={17} />, label: 'Continuously improved based on agent feedback' },
              ].map(v => (
                <div key={v.label} className="lp-value-row">
                  {v.icon}<span>{v.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── CONTACT ───────────────────────────────────────────── */}
      <section id="lp-contact" className="lp-section lp-contact">
        <div className="lp-container lp-contact-inner">
          <div className="lp-contact-info">
            <span className="lp-kicker lp-kicker--dark">Get in touch</span>
            <h2>We'd love to hear from you</h2>
            <p>Whether you're ready to get started, have questions about features, or want a personal walkthrough — we're here.</p>
            <a href="mailto:support@agencyiq.com" className="lp-contact-link">
              <Mail size={17} />support@agencyiq.com
            </a>
            <a href="tel:+18005550100" className="lp-contact-link">
              <Phone size={17} />1-800-555-0100
            </a>
          </div>

          <form className="lp-contact-form" onSubmit={e => { e.preventDefault(); setContactSent(true) }}>
            {contactSent ? (
              <div className="lp-contact-success">
                <CheckCircle2 size={44} />
                <h3>Message received!</h3>
                <p>We'll be in touch within 1 business day.</p>
              </div>
            ) : (
              <>
                <div className="lp-form-row">
                  <label className="lp-field"><span>Your name *</span><input required value={form.name} onChange={e => setField('name', e.target.value)} placeholder="Jane Smith" /></label>
                  <label className="lp-field"><span>Agency name</span><input value={form.agency} onChange={e => setField('agency', e.target.value)} placeholder="Smith Insurance" /></label>
                </div>
                <div className="lp-form-row">
                  <label className="lp-field"><span>Email *</span><input required type="email" value={form.email} onChange={e => setField('email', e.target.value)} placeholder="jane@smithins.com" /></label>
                  <label className="lp-field"><span>Phone</span><input type="tel" value={form.phone} onChange={e => setField('phone', e.target.value)} placeholder="(555) 000-0000" /></label>
                </div>
                <label className="lp-field"><span>Message *</span><textarea required rows={4} value={form.message} onChange={e => setField('message', e.target.value)} placeholder="Tell us about your agency and what you're looking for…" /></label>
                <button type="submit" className="lp-btn-primary lp-btn-submit">Send message <ArrowRight size={14} /></button>
              </>
            )}
          </form>
        </div>
      </section>

      {/* ── FOOTER ────────────────────────────────────────────── */}
      <footer className="lp-footer">
        <div className="lp-container lp-footer-inner">
          <div className="lp-footer-brand">
            <img src={agencyIqLogo} alt="AgencyIQ" className="lp-footer-logo" />
            <p>The insurance agency CRM built for agents who want to grow, retain, and serve their book of business with confidence.</p>
          </div>
          <div className="lp-footer-cols">
            <div className="lp-footer-col">
              <strong>Product</strong>
              <button type="button" onClick={() => scrollTo('lp-features')}>Features</button>
              <button type="button" onClick={() => scrollTo('lp-pricing')}>Pricing</button>
              <button type="button" onClick={onEnterCrm}>Log In</button>
              <button type="button" onClick={onEnterCrm}>Access CRM</button>
            </div>
            <div className="lp-footer-col">
              <strong>Company</strong>
              <button type="button" onClick={() => scrollTo('lp-about')}>About Us</button>
              <button type="button" onClick={() => scrollTo('lp-contact')}>Contact</button>
            </div>
            <div className="lp-footer-col">
              <strong>Legal</strong>
              <button type="button" onClick={() => setLegalOpen(true)}>Terms of Service</button>
              <button type="button" onClick={() => setLegalOpen(true)}>Privacy Policy</button>
              <button type="button" onClick={() => setLegalOpen(true)}>Disclaimers</button>
            </div>
          </div>
        </div>
        <div className="lp-footer-bottom">
          <div className="lp-container lp-footer-bottom-inner">
            <p>© {new Date().getFullYear()} AgencyIQ. All rights reserved. AgencyIQ is a practice management and CRM platform for licensed insurance professionals. It is not a licensed insurance carrier, producer, or MGA. Use of this platform does not constitute insurance advice. All pricing subject to change. 5-year price lock applies to the original purchase only and is non-transferable. SMS usage may be subject to fair-use limits or pass-through carrier fees.</p>
            <div className="lp-footer-legal-links">
              <button type="button" onClick={() => setLegalOpen(true)}>Terms</button>
              <button type="button" onClick={() => setLegalOpen(true)}>Privacy</button>
              <button type="button" onClick={() => setLegalOpen(true)}>Disclaimers</button>
            </div>
          </div>
        </div>
      </footer>

      {renderLpLightning()}

      {/* ── LEGAL MODAL ───────────────────────────────────────── */}
      {legalOpen && (
        <div className="lp-legal-overlay" onClick={() => setLegalOpen(false)}>
          <div className="lp-legal-panel" onClick={e => e.stopPropagation()}>
            <div className="lp-legal-header">
              <h2>Legal Information</h2>
              <button type="button" onClick={() => setLegalOpen(false)}><X size={19} /></button>
            </div>
            <div className="lp-legal-body">
              <h3>Terms of Service</h3>
              <p>By accessing or using AgencyIQ, you agree to these Terms of Service. AgencyIQ provides a software-as-a-service CRM platform for licensed insurance professionals. You are responsible for maintaining the confidentiality of your login credentials and for all activities under your account.</p>
              <p>Subscriptions are billed in advance on a monthly or annual basis. Monthly subscriptions may be cancelled at any time with effect at the end of the current billing period. Annual and 5-year plans are non-refundable after 30 days from purchase. The 5-year price lock applies to the original licensee only and is non-transferable.</p>
              <p>Each subscription includes the number of users specified in your plan. Accounts are licensed per user and may not be shared or used concurrently on multiple devices under a single-user plan. Violation of this policy may result in account suspension.</p>

              <h3>Privacy Policy</h3>
              <p>AgencyIQ collects only the information necessary to provide its services, including account registration data, usage data, and client data you input. We do not sell your data to third parties. Client data entered into AgencyIQ is your data — we act as a data processor on your behalf.</p>
              <p>We use industry-standard encryption for data in transit and at rest. Access to your data is restricted to authorized personnel only. You may request deletion of your data at any time by contacting support@agencyiq.com.</p>

              <h3>Disclaimers</h3>
              <p>AgencyIQ is a practice management and client relationship management (CRM) tool for licensed insurance professionals. It is not a licensed insurance carrier, managing general agent (MGA), or insurance advisor. The platform does not provide, and is not a substitute for, licensed insurance advice.</p>
              <p>The AI assistant ("Ask IQ") provides informational responses based on general insurance knowledge. These responses do not constitute professional insurance, legal, or financial advice. Always verify coverage details, policy language, and carrier guidelines with the appropriate licensed professional or carrier representative.</p>
              <p>SMS and email communication features are for business-use purposes only. You are responsible for complying with all applicable laws including CAN-SPAM, TCPA, and any state regulations governing SMS marketing and client communication. SMS usage may be subject to fair-use limits or pass-through carrier fees.</p>
              <p>AgencyIQ makes no warranty, express or implied, regarding the accuracy, completeness, or fitness for a particular purpose of any information provided through the platform. Use of the platform is at your own risk.</p>

              <h3>Single-Session Policy</h3>
              <p>Each user license permits one concurrent active session. If a new login is detected while an existing session is active, the earlier session will be terminated. Sharing credentials or using a single-user license across multiple devices simultaneously is a violation of the Terms of Service and may result in immediate account suspension.</p>

              <h3>Contact</h3>
              <p>Legal inquiries: legal@agencyiq.com</p>
              <p>Support: support@agencyiq.com</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
