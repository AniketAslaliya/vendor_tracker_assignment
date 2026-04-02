import { startTransition, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'

const currencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
})

const numberFormatter = new Intl.NumberFormat('en-IN')

function formatCurrency(value) {
  return currencyFormatter.format(value)
}

function formatDate(value) {
  if (!value) {
    return 'No memo saved yet'
  }

  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function calculateScore(vendor, priceWeight, speedWeight, minimumPrice, fastestLeadTime) {
  const priceScore = minimumPrice / vendor.quote.quotedPrice
  const speedScore = fastestLeadTime / vendor.quote.leadTimeDays
  return priceScore * priceWeight + speedScore * speedWeight
}

function ThemedSelect({ value, onChange, options, ariaLabel }) {
  const [isOpen, setIsOpen] = useState(false)
  const rootRef = useRef(null)

  const selectedOption = options.find((option) => option.value === value) ?? options[0]

  useEffect(() => {
    function handleDocumentClick(event) {
      if (!rootRef.current?.contains(event.target)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleDocumentClick)
    return () => document.removeEventListener('mousedown', handleDocumentClick)
  }, [])

  return (
    <div className={`themed-select ${isOpen ? 'open' : ''}`} ref={rootRef}>
      <button
        type="button"
        className="themed-select-trigger"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={ariaLabel}
        onClick={() => setIsOpen((open) => !open)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            setIsOpen(false)
          }
        }}
      >
        <span>{selectedOption?.label ?? ''}</span>
        <span className="themed-select-caret" aria-hidden="true" />
      </button>

      {isOpen ? (
        <ul className="themed-select-menu" role="listbox" aria-label={ariaLabel}>
          {options.map((option) => {
            const isSelected = option.value === value

            return (
              <li key={option.value} role="option" aria-selected={isSelected}>
                <button
                  type="button"
                  className={`themed-option ${isSelected ? 'selected' : ''}`}
                  onClick={() => {
                    onChange(option.value)
                    setIsOpen(false)
                  }}
                >
                  {option.label}
                </button>
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}

function App() {
  const [vendors, setVendors] = useState([])
  const [categories, setCategories] = useState([])
  const [summary, setSummary] = useState({
    vendorCount: 0,
    averageQuotedPrice: 0,
    averageLeadTimeDays: 0,
  })
  const [searchInput, setSearchInput] = useState('')
  const [searchSuggestions, setSearchSuggestions] = useState([])
  const [isSuggestionOpen, setIsSuggestionOpen] = useState(false)
  const [category, setCategory] = useState('')
  const [selectedVendorId, setSelectedVendorId] = useState(null)
  const [selectedVendorSummary, setSelectedVendorSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState(null)
  const [error, setError] = useState('')
  const [priceWeight, setPriceWeight] = useState(60)
  const [sortBy, setSortBy] = useState('weighted_desc')
  const [exportScope, setExportScope] = useState('filtered')
  const [decisionMemo, setDecisionMemo] = useState({
    vendorId: null,
    content: '',
    updatedAt: null,
  })
  const [memoDraft, setMemoDraft] = useState('')
  const [memoSaving, setMemoSaving] = useState(false)
  const [isMemoOpen, setIsMemoOpen] = useState(false)
  const [activeNav, setActiveNav] = useState('Dashboard')
  const [analyticsWindow, setAnalyticsWindow] = useState('30d')

  const deferredSearch = useDeferredValue(searchInput)
  const leadTimeWeight = 100 - priceWeight

  useEffect(() => {
    let ignore = false

    async function loadVendors() {
      setLoading(true)
      setError('')

      try {
        const params = new URLSearchParams()
        if (deferredSearch.trim()) {
          params.set('search', deferredSearch.trim())
        }
        if (category) {
          params.set('category', category)
        }

        const suffix = params.toString()
        const response = await fetch(`/api/vendors${suffix ? `?${suffix}` : ''}`)
        if (!response.ok) {
          throw new Error('Unable to load vendor data.')
        }

        const payload = await response.json()
        if (ignore) {
          return
        }

        setVendors(payload.vendors)
        setCategories(payload.categories)
        setSummary(payload.summary)
        setSearchSuggestions(payload.searchSuggestions ?? [])
        setSelectedVendorId(payload.selectedVendorId)
        setSelectedVendorSummary(payload.selectedVendor ?? null)
        setDecisionMemo(
          payload.decisionMemo ?? {
            vendorId: null,
            content: '',
            updatedAt: null,
          },
        )
        setMemoDraft(payload.decisionMemo?.content ?? '')
      } catch (loadError) {
        if (!ignore) {
          setError(loadError.message)
        }
      } finally {
        if (!ignore) {
          setLoading(false)
        }
      }
    }

    loadVendors()

    return () => {
      ignore = true
    }
  }, [deferredSearch, category])

  useEffect(() => {
    if (!isMemoOpen) {
      return undefined
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setIsMemoOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isMemoOpen])

  const comparison = useMemo(() => {
    if (vendors.length === 0) {
      return {
        cheapestVendorId: null,
        fastestVendorId: null,
        lowestTotalVendorId: null,
        rankedVendors: [],
      }
    }

    const cheapestVendor = vendors.reduce((best, vendor) =>
      vendor.quote.quotedPrice < best.quote.quotedPrice ? vendor : best,
    )
    const fastestVendor = vendors.reduce((best, vendor) =>
      vendor.quote.leadTimeDays < best.quote.leadTimeDays ? vendor : best,
    )
    const lowestTotalVendor = vendors.reduce((best, vendor) =>
      vendor.quote.totalCost < best.quote.totalCost ? vendor : best,
    )

    const rankedVendors = vendors
      .map((vendor) => ({
        ...vendor,
        weightedScore: calculateScore(
          vendor,
          priceWeight / 100,
          leadTimeWeight / 100,
          cheapestVendor.quote.quotedPrice,
          fastestVendor.quote.leadTimeDays,
        ),
      }))
      .sort((left, right) => right.weightedScore - left.weightedScore)

    return {
      cheapestVendorId: cheapestVendor.id,
      fastestVendorId: fastestVendor.id,
      lowestTotalVendorId: lowestTotalVendor.id,
      rankedVendors,
    }
  }, [leadTimeWeight, priceWeight, vendors])

  async function handleSelectVendor(vendorId) {
    setSavingId(vendorId)
    setError('')

    try {
      const response = await fetch('/api/selection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ vendorId }),
      })

      if (!response.ok) {
        throw new Error('Selection could not be saved.')
      }

      setSelectedVendorId(vendorId)
      setSelectedVendorSummary(
        vendors.find((vendor) => vendor.id === vendorId) ?? selectedVendorSummary,
      )

      if (decisionMemo.vendorId !== vendorId) {
        setMemoDraft('')
      }
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setSavingId(null)
    }
  }

  async function handleSaveMemo() {
    if (!selectedVendorId) {
      setError('Select a vendor before saving a decision memo.')
      return
    }

    setMemoSaving(true)
    setError('')

    try {
      const response = await fetch('/api/decision-memo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          vendorId: selectedVendorId,
          content: memoDraft,
        }),
      })

      if (!response.ok) {
        throw new Error('Decision memo could not be saved.')
      }

      const payload = await response.json()
      setDecisionMemo(payload.decisionMemo)
      setMemoDraft(payload.decisionMemo.content)
      setIsMemoOpen(false)
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setMemoSaving(false)
    }
  }

  const selectedVendor = selectedVendorSummary

  const categoryOptions = useMemo(
    () => [
      { value: '', label: 'All categories' },
      ...categories.map((item) => ({ value: item, label: item })),
    ],
    [categories],
  )

  const sortOptions = [
    { value: 'weighted_desc', label: 'Weighted score (best first)' },
    { value: 'total_asc', label: 'Total cost (low to high)' },
    { value: 'quote_asc', label: 'Quoted price (low to high)' },
    { value: 'lead_asc', label: 'Lead time (fastest first)' },
    { value: 'name_asc', label: 'Vendor name (A to Z)' },
  ]

  const exportOptions = [
    { value: 'filtered', label: 'Current filtered view' },
    { value: 'top10', label: 'Top 10 ranked vendors' },
    { value: 'selected', label: 'Selected vendor only' },
    { value: 'all', label: 'All vendors' },
  ]

  const navOptions = ['Dashboard', 'Vendors', 'Analytics', 'Finance']
  const analyticsWindowOptions = [
    { value: '7d', label: '7D' },
    { value: '30d', label: '30D' },
    { value: '90d', label: '90D' },
  ]

  const sortedVendors = useMemo(() => {
    const list = [...comparison.rankedVendors]

    if (sortBy === 'total_asc') {
      list.sort((left, right) => left.quote.totalCost - right.quote.totalCost)
    } else if (sortBy === 'quote_asc') {
      list.sort((left, right) => left.quote.quotedPrice - right.quote.quotedPrice)
    } else if (sortBy === 'lead_asc') {
      list.sort((left, right) => left.quote.leadTimeDays - right.quote.leadTimeDays)
    } else if (sortBy === 'name_asc') {
      list.sort((left, right) => left.name.localeCompare(right.name, 'en-IN'))
    } else {
      list.sort((left, right) => right.weightedScore - left.weightedScore)
    }

    return list
  }, [comparison.rankedVendors, sortBy])

  const exportIds = useMemo(() => {
    if (exportScope === 'filtered') {
      return sortedVendors.map((vendor) => vendor.id)
    }

    if (exportScope === 'top10') {
      return sortedVendors.slice(0, 10).map((vendor) => vendor.id)
    }

    return []
  }, [exportScope, sortedVendors])

  const exportHref = useMemo(() => {
    const params = new URLSearchParams()

    if (exportScope === 'all') {
      params.set('scope', 'all')
    } else if (exportScope === 'selected') {
      params.set('scope', 'selected')
    } else {
      params.set('scope', 'ids')
      params.set('ids', exportIds.join(','))
    }

    return `/api/vendors/export.csv?${params.toString()}`
  }, [exportIds, exportScope])

  const totalQuotedValue = useMemo(
    () => sortedVendors.reduce((total, vendor) => total + vendor.quote.quotedPrice, 0),
    [sortedVendors],
  )

  const totalShippingValue = useMemo(
    () => sortedVendors.reduce((total, vendor) => total + vendor.quote.shippingCost, 0),
    [sortedVendors],
  )

  const totalLandedValue = useMemo(
    () => sortedVendors.reduce((total, vendor) => total + vendor.quote.totalCost, 0),
    [sortedVendors],
  )

  const topRankedVendor = sortedVendors[0] ?? null
  const cheapestVendor = sortedVendors.find((vendor) => vendor.id === comparison.cheapestVendorId) ?? null
  const fastestVendor = sortedVendors.find((vendor) => vendor.id === comparison.fastestVendorId) ?? null

  const analyticsVendorLimit = analyticsWindow === '7d' ? 4 : analyticsWindow === '90d' ? 8 : 6
  const analyticsTopVendors = sortedVendors.slice(0, analyticsVendorLimit)
  const maxAnalyticsScore = analyticsTopVendors.reduce(
    (max, vendor) => Math.max(max, vendor.weightedScore),
    1,
  )
  const maxAnalyticsTotal = analyticsTopVendors.reduce(
    (max, vendor) => Math.max(max, vendor.quote.totalCost),
    1,
  )

  const moduleCopy = {
    Vendors: {
      title: 'Vendor workspace',
      description: 'Review and manage supplier records, shortlist vendors, and finalize selections.',
    },
    Analytics: {
      title: 'Analytics overview',
      description: 'Track performance signals, scoring confidence, and shortlist quality in one place.',
    },
    Finance: {
      title: 'Finance console',
      description: 'Monitor landed costs, shipping impact, and commercial totals across all visible vendors.',
    },
  }

  const dashboardQuickLinks = [
    {
      key: 'Vendors',
      title: 'Vendor Operations',
      text: 'Open vendor workspace to filter, compare, and finalize suppliers.',
      cta: 'Manage vendor workflow',
      highlights: [
        `${numberFormatter.format(summary.vendorCount)} active vendors`,
        `${selectedVendor ? selectedVendor.name : 'No vendor selected'} current pick`,
      ],
    },
    {
      key: 'Analytics',
      title: 'Performance Analytics',
      text: 'Review scoring trends and procurement performance diagrams.',
      cta: 'Open analytics dashboard',
      highlights: [
        `${topRankedVendor ? topRankedVendor.name : 'No top ranked vendor'} top ranked`,
        `${summary.averageLeadTimeDays.toFixed(1)} day avg lead-time`,
      ],
    },
    {
      key: 'Finance',
      title: 'Finance Overview',
      text: 'Track total quoted, shipping, and landed commercial value.',
      cta: 'Review commercial totals',
      highlights: [
        `${formatCurrency(totalLandedValue)} landed spend`,
        `${formatCurrency(totalShippingValue)} shipping contribution`,
      ],
    },
  ]

  const showSummaryStrip = activeNav === 'Dashboard'
  const showWorkspaceModule = activeNav === 'Vendors'
  const showDecisionHub = activeNav === 'Vendors'
  const showTableSection = activeNav === 'Vendors'
  const showShortlist = activeNav === 'Vendors'

  return (
    <main className="app-shell">
      <header className="top-nav" aria-label="Main navigation">
        <nav className="nav-links" aria-label="Primary links">
          {navOptions.map((option) => {
            const isActive = option === activeNav

            return (
              <button
                key={option}
                type="button"
                className={`nav-link ${isActive ? 'active' : ''}`}
                onClick={() => setActiveNav(option)}
              >
                {option}
              </button>
            )
          })}
        </nav>

        <div className="nav-meta">
          <span>{numberFormatter.format(summary.vendorCount)} vendors</span>
        </div>
      </header>

      {activeNav !== 'Dashboard' ? (
        <section className="module-hero">
          <div>
            <p className="eyebrow">{activeNav}</p>
            <h1>{moduleCopy[activeNav]?.title ?? 'Workspace'}</h1>
            <p>{moduleCopy[activeNav]?.description ?? ''}</p>
          </div>
        </section>
      ) : null}

      {activeNav === 'Dashboard' ? (
        <section className="hero-panel">
        <div className="hero-copy">
          <p className="eyebrow">Ops Procurement Workspace</p>
          <p className="hero-kicker">Live sourcing cockpit</p>
          <h1>Vendor Tracker</h1>
          <p className="hero-text">
            Use this dashboard as your control center. Jump into Vendors for execution,
            Analytics for insights, and Finance for commercial totals.
          </p>

          <div className="hero-actions">
            {dashboardQuickLinks.map((item) => (
              <button
                key={item.key}
                type="button"
                className={item.key === 'Vendors' ? 'memo-button' : 'modal-secondary'}
                onClick={() => setActiveNav(item.key)}
              >
                Open {item.key}
              </button>
            ))}
          </div>
        </div>

        <aside className="hero-side">
          <p className="hero-side-label">Platform status</p>
          <strong>{selectedVendor ? `${selectedVendor.name} is currently selected` : 'No vendor selected yet'}</strong>
          <p>{decisionMemo.content ? 'Decision memo is available for audit trail.' : 'Decision memo not captured yet.'}</p>
        </aside>
        </section>
      ) : null}

      {activeNav === 'Dashboard' ? (
        <section className="dashboard-portal">
          {dashboardQuickLinks.map((item) => (
            <article key={item.key} className="portal-card">
              <h3>{item.title}</h3>
              <p>{item.text}</p>
              <div className="portal-highlights">
                {item.highlights.map((highlight) => (
                  <span key={`${item.key}-${highlight}`}>{highlight}</span>
                ))}
              </div>
              <button type="button" className="modal-secondary" onClick={() => setActiveNav(item.key)}>
                {item.cta}
              </button>
            </article>
          ))}
        </section>
      ) : null}

      {showSummaryStrip ? (
        <section className="summary-strip" aria-label="Summary metrics">
        <article>
          <span>Visible vendors</span>
          <strong>{numberFormatter.format(summary.vendorCount)}</strong>
        </article>
        <article>
          <span>Average quote</span>
          <strong>{formatCurrency(summary.averageQuotedPrice)}</strong>
        </article>
        <article>
          <span>Average lead time</span>
          <strong>{summary.averageLeadTimeDays.toFixed(1)} days</strong>
        </article>
        <article>
          <span>Scoring model</span>
          <strong>{priceWeight}% price / {leadTimeWeight}% speed</strong>
        </article>
        </section>
      ) : null}

      {showWorkspaceModule ? (
        <section className="workspace-module">
        <section className="workspace-bar">
          <div className="workspace-copy">
            <p className="eyebrow">Procurement desk</p>
            <h2>Shortlist vendors, save the final call, and keep the reason attached</h2>
          </div>
          <div className="export-controls">
            <label className="export-field">
              <span>Export scope</span>
              <ThemedSelect
                value={exportScope}
                onChange={setExportScope}
                options={exportOptions}
                ariaLabel="Export scope"
              />
            </label>
            <a
              className="export-link"
              href={exportHref}
              aria-disabled={exportScope !== 'all' && exportScope !== 'selected' && exportIds.length === 0}
            >
              Export CSV
            </a>
          </div>
        </section>

        <section className="control-panel">
          <label className="field search-field">
            <span>Search vendors</span>
            <input
              type="search"
              value={searchInput}
              autoComplete="off"
              onChange={(event) => {
                const value = event.target.value
                startTransition(() => setSearchInput(value))
                setIsSuggestionOpen(true)
              }}
              onFocus={() => setIsSuggestionOpen(true)}
              onBlur={() => {
                window.setTimeout(() => setIsSuggestionOpen(false), 120)
              }}
              placeholder="Search by vendor or contact"
            />

            {isSuggestionOpen && searchInput.trim() && searchSuggestions.length > 0 ? (
              <div className="search-suggestions" role="listbox" aria-label="Vendor suggestions">
                {searchSuggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    className="suggestion-item"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      startTransition(() => setSearchInput(suggestion))
                      setIsSuggestionOpen(false)
                    }}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            ) : null}
          </label>

          <label className="field">
            <span>Category</span>
            <ThemedSelect
              value={category}
              onChange={setCategory}
              options={categoryOptions}
              ariaLabel="Category"
            />
          </label>

          <label className="field">
            <span>Sort by</span>
            <ThemedSelect
              value={sortBy}
              onChange={setSortBy}
              options={sortOptions}
              ariaLabel="Sort vendors"
            />
          </label>

          <label className="field field-slider">
            <span>Weighted scoring</span>
            <input
              type="range"
              min="0"
              max="100"
              value={priceWeight}
              onChange={(event) => setPriceWeight(Number(event.target.value))}
            />
            <small>Adjust the balance between commercial value and speed.</small>
          </label>
        </section>

        {error ? <p className="status-message error">{error}</p> : null}
        {loading ? <p className="status-message">Loading vendor quotes...</p> : null}
        </section>
      ) : null}

      {showDecisionHub ? (
        <section className="decision-hub">
        <div className="decision-flow-heading">
          <p className="eyebrow">Decision flow</p>
          <h2>Review to Select to Memo to Finalize</h2>
        </div>

        <div className="decision-strip" role="group" aria-label="Decision flow steps">
          <span className="flow-chip">
            <span className="step-no">01</span>
            <strong>Review</strong>
            <small className="flow-detail">Scan ledger, compare rank and price.</small>
          </span>
          <span className="flow-chip">
            <span className="step-no">02</span>
            <strong>{selectedVendor ? 'Selected' : 'Select'}</strong>
            <small className="flow-detail">{selectedVendor ? selectedVendor.name : 'Pick one vendor to continue.'}</small>
          </span>
          <span className="flow-chip">
            <span className="step-no">03</span>
            <strong>{decisionMemo.content ? 'Memo saved' : 'Memo'}</strong>
            <small className="flow-detail">{decisionMemo.content ? 'Reason captured and timestamped.' : 'Add business rationale.'}</small>
          </span>
          <span className="flow-chip end-chip">
            <span className="step-no">04</span>
            <strong>Finalize</strong>
            <small className="flow-detail">Lock decision and export if needed.</small>
          </span>
          <button
            type="button"
            className="memo-button decision-open-button strip-button"
            onClick={() => setIsMemoOpen(true)}
            disabled={!selectedVendorId}
          >
            {decisionMemo.content ? 'Open memo' : 'Add memo'}
          </button>
        </div>
        </section>
      ) : null}

      {activeNav === 'Analytics' ? (
        <section className="analytics-module">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Analytics</p>
              <h2>Performance and ranking intelligence</h2>
            </div>
            <div className="analytics-tools">
              <p>Keep a fast read on shortlist quality before approving final procurement decisions.</p>
              <div className="window-switch" role="group" aria-label="Analytics time window">
                {analyticsWindowOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`window-btn ${analyticsWindow === option.value ? 'active' : ''}`}
                    onClick={() => setAnalyticsWindow(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="analytics-grid">
            <article>
              <span>Top ranked vendor</span>
              <strong>{topRankedVendor ? topRankedVendor.name : 'No vendor available'}</strong>
              <p>{topRankedVendor ? `Weighted score ${topRankedVendor.weightedScore.toFixed(3)}` : 'Waiting for data'}</p>
            </article>
            <article>
              <span>Best commercial value</span>
              <strong>{cheapestVendor ? cheapestVendor.name : 'No vendor available'}</strong>
              <p>Lowest quoted price in current filtered list.</p>
            </article>
            <article>
              <span>Fastest delivery</span>
              <strong>{fastestVendor ? fastestVendor.name : 'No vendor available'}</strong>
              <p>Shortest lead-time from visible vendor options.</p>
            </article>
            <article>
              <span>Average lead-time</span>
              <strong>{summary.averageLeadTimeDays.toFixed(1)} days</strong>
              <p>Based on currently filtered vendors.</p>
            </article>
          </div>

          <div className="diagram-grid">
            <article className="diagram-card">
              <div className="diagram-header">
                <h3>Top weighted scores</h3>
                <p>Ranked vendors by weighted model</p>
              </div>
              <div className="bars-chart" role="img" aria-label="Top weighted score bars">
                {analyticsTopVendors.map((vendor) => (
                  <div key={vendor.id} className="bar-row">
                    <span className="bar-label">{vendor.name}</span>
                    <div className="bar-track">
                      <span
                        className="bar-fill"
                        style={{ width: `${(vendor.weightedScore / maxAnalyticsScore) * 100}%` }}
                      />
                      <span className="chart-tooltip">
                        {vendor.name} | score {vendor.weightedScore.toFixed(3)}
                      </span>
                    </div>
                    <strong>{vendor.weightedScore.toFixed(3)}</strong>
                  </div>
                ))}
              </div>
            </article>

            <article className="diagram-card">
              <div className="diagram-header">
                <h3>Cost and lead-time profile</h3>
                <p>Top vendors: total cost and lead days</p>
              </div>
              <div className="dual-metric-chart" role="img" aria-label="Cost and lead time comparison">
                {analyticsTopVendors.map((vendor) => (
                  <div key={`${vendor.id}-metrics`} className="metric-row">
                    <span className="metric-label">{vendor.name}</span>
                    <div className="metric-bars">
                      <div className="metric-track">
                        <span
                          className="metric-cost"
                          style={{ width: `${(vendor.quote.totalCost / maxAnalyticsTotal) * 100}%` }}
                        />
                      </div>
                      <div className="metric-track">
                        <span
                          className="metric-lead"
                          style={{ width: `${Math.min((vendor.quote.leadTimeDays / 30) * 100, 100)}%` }}
                        />
                      </div>
                      <span className="chart-tooltip">
                        {vendor.name} | total {formatCurrency(vendor.quote.totalCost)} | lead {vendor.quote.leadTimeDays} days
                      </span>
                    </div>
                    <small>{vendor.quote.leadTimeDays}d</small>
                  </div>
                ))}
              </div>
            </article>
          </div>
        </section>
      ) : null}

      {activeNav === 'Finance' ? (
        <section className="finance-module">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Finance</p>
              <h2>Commercial totals and landed spend</h2>
            </div>
            <p>Understand the financial impact of supplier choices before confirming invoice workflow.</p>
          </div>

          <div className="analytics-grid finance-grid">
            <article>
              <span>Total quoted value</span>
              <strong>{formatCurrency(totalQuotedValue)}</strong>
              <p>Combined quoted value across visible vendors.</p>
            </article>
            <article>
              <span>Total shipping value</span>
              <strong>{formatCurrency(totalShippingValue)}</strong>
              <p>Combined shipping impact in filtered scope.</p>
            </article>
            <article>
              <span>Total landed value</span>
              <strong>{formatCurrency(totalLandedValue)}</strong>
              <p>Quote and shipping together for finance review.</p>
            </article>
            <article>
              <span>Selected vendor cost</span>
              <strong>{selectedVendor ? formatCurrency(selectedVendor.quote.totalCost) : 'No vendor selected'}</strong>
              <p>{selectedVendor ? `${selectedVendor.name} is currently selected.` : 'Select a vendor to lock this value.'}</p>
            </article>
          </div>
        </section>
      ) : null}

      {showTableSection ? (
        <section id="vendor-ledger" className="table-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Vendor ledger</p>
            <h2>Operational view of all current quotes</h2>
          </div>
          <p>Use the table to review vendors quickly, then move to the decision memo only after a vendor is selected.</p>
        </div>

        <div className="table-shell">
          <table className="vendor-table">
            <thead>
              <tr>
                <th>Vendor</th>
                <th>Category</th>
                <th>Contact</th>
                <th>Quoted</th>
                <th>Shipping</th>
                <th>Total</th>
                <th>Lead time</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {sortedVendors.map((vendor) => {
                const isSelected = vendor.id === selectedVendorId
                const isCheapest = vendor.id === comparison.cheapestVendorId
                const isFastest = vendor.id === comparison.fastestVendorId
                const hasLowestTotal = vendor.id === comparison.lowestTotalVendorId

                return (
                  <tr key={vendor.id} className={isSelected ? 'is-selected-row' : ''}>
                    <td>
                      <div className="vendor-primary">
                        <strong>{vendor.name}</strong>
                        <span>{vendor.notes}</span>
                      </div>
                    </td>
                    <td>{vendor.category}</td>
                    <td>
                      <div className="vendor-contact">
                        <strong>{vendor.contact.name}</strong>
                        <span>{vendor.contact.email}</span>
                        <span>{vendor.contact.phone}</span>
                      </div>
                    </td>
                    <td>{formatCurrency(vendor.quote.quotedPrice)}</td>
                    <td>{formatCurrency(vendor.quote.shippingCost)}</td>
                    <td>{formatCurrency(vendor.quote.totalCost)}</td>
                    <td>{vendor.quote.leadTimeDays} days</td>
                    <td>
                      <div className="table-badges">
                        {isSelected ? <span className="selected-pill">Selected</span> : null}
                        {isCheapest ? <span className="highlight-chip">Best price</span> : null}
                        {isFastest ? <span className="highlight-chip">Fastest</span> : null}
                        {hasLowestTotal ? <span className="highlight-chip">Lowest total</span> : null}
                      </div>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="table-action"
                        onClick={() => handleSelectVendor(vendor.id)}
                        disabled={savingId === vendor.id}
                      >
                        {savingId === vendor.id
                          ? 'Saving...'
                          : isSelected
                            ? 'Selected'
                            : 'Select'}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        </section>
      ) : null}

      {showShortlist ? (
        <section className="shortlist-module">
        <section className="section-heading ranked-heading">
          <div>
            <p className="eyebrow">Ranked shortlist</p>
            <h2>Final comparison cards</h2>
          </div>
          <p>Use these to review the top vendors in more detail before locking the final selection and opening the memo.</p>
        </section>

        <section className="comparison-grid">
          {sortedVendors.map((vendor, index) => {
            const isSelected = vendor.id === selectedVendorId
            const isCheapest = vendor.id === comparison.cheapestVendorId
            const isFastest = vendor.id === comparison.fastestVendorId
            const hasLowestTotal = vendor.id === comparison.lowestTotalVendorId

            return (
              <article
                key={vendor.id}
                className={`vendor-card ${isSelected ? 'selected' : ''}`}
                style={{ animationDelay: `${index * 80}ms` }}
              >
                <div className="card-topline">
                  <span className="rank-pill">Rank #{index + 1}</span>
                  <span className="category-pill">{vendor.category}</span>
                </div>

                <div className="card-header">
                  <div>
                    <h2>{vendor.name}</h2>
                    <p>{vendor.contact.name} | {vendor.contact.email}</p>
                  </div>
                  {isSelected ? <span className="selected-pill">Saved pick</span> : null}
                </div>

                <div className="stat-grid">
                  <div>
                    <span>Quoted price</span>
                    <strong>{formatCurrency(vendor.quote.quotedPrice)}</strong>
                  </div>
                  <div>
                    <span>Shipping</span>
                    <strong>{formatCurrency(vendor.quote.shippingCost)}</strong>
                  </div>
                  <div>
                    <span>Total cost</span>
                    <strong>{formatCurrency(vendor.quote.totalCost)}</strong>
                  </div>
                  <div>
                    <span>Lead time</span>
                    <strong>{vendor.quote.leadTimeDays} days</strong>
                  </div>
                </div>

                <div className="score-track" aria-hidden="true">
                  <span style={{ width: `${Math.min(vendor.weightedScore * 100, 100)}%` }} />
                </div>

                <div className="table-badges">
                  {isCheapest ? <span className="highlight-chip">Best price</span> : null}
                  {isFastest ? <span className="highlight-chip">Fastest delivery</span> : null}
                  {hasLowestTotal ? <span className="highlight-chip">Lowest total</span> : null}
                </div>

                <p className="notes">{vendor.notes}</p>

                <div className="card-footer">
                  <p>
                    Weighted score <strong>{vendor.weightedScore.toFixed(3)}</strong>
                  </p>
                  <button
                    type="button"
                    onClick={() => handleSelectVendor(vendor.id)}
                    disabled={savingId === vendor.id}
                  >
                    {savingId === vendor.id
                      ? 'Saving...'
                      : isSelected
                        ? 'Selected'
                        : 'Select vendor'}
                  </button>
                </div>
              </article>
            )
          })}
        </section>
        </section>
      ) : null}

      {isMemoOpen ? (
        <div className="modal-backdrop" onClick={() => setIsMemoOpen(false)}>
          <section
            className="memo-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="memo-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="memo-modal-header">
              <div>
                <p className="eyebrow">Decision memo</p>
                <h2 id="memo-modal-title">Capture the final procurement reasoning</h2>
              </div>
              <button
                type="button"
                className="modal-close"
                onClick={() => setIsMemoOpen(false)}
                aria-label="Close memo dialog"
              >
                X
              </button>
            </div>

            <div className="memo-modal-grid">
              <div className="memo-modal-summary">
                <div className="memo-highlight">
                  <span>Attached to</span>
                  <strong>{selectedVendor ? selectedVendor.name : 'No vendor selected'}</strong>
                  <p>
                    {selectedVendor
                      ? `${formatCurrency(selectedVendor.quote.totalCost)} total landed cost with ${selectedVendor.quote.leadTimeDays} day lead time`
                      : 'Select a vendor before saving a memo.'}
                  </p>
                </div>

                <div className="memo-highlight">
                  <span>Last updated</span>
                  <strong>{formatDate(decisionMemo.updatedAt)}</strong>
                  <p>Use this space for negotiation context, approval notes, or why one vendor was chosen over the others.</p>
                </div>
              </div>

              <label className="memo-field">
                <span>Decision notes</span>
                <textarea
                  value={memoDraft}
                  onChange={(event) => setMemoDraft(event.target.value.slice(0, 400))}
                  placeholder="Add why this vendor was chosen, negotiation notes, commercial considerations, or next follow-up."
                />
              </label>
            </div>

            <div className="memo-modal-footer">
              <span className="memo-meta">{memoDraft.length}/400 characters</span>
              <div className="memo-modal-actions">
                <button
                  type="button"
                  className="modal-secondary"
                  onClick={() => setIsMemoOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="memo-button"
                  onClick={handleSaveMemo}
                  disabled={memoSaving || !selectedVendorId}
                >
                  {memoSaving ? 'Saving memo...' : 'Save memo'}
                </button>
              </div>
            </div>
          </section>
        </div>
      ) : null}

      <footer className="app-footer">
        <div className="footer-block">
          <p className="eyebrow">Vendor Tracker</p>
          <strong>Premium procurement workspace for fast and auditable supplier decisions.</strong>
        </div>
        <div className="footer-meta">
          <span>Selected vendor: {selectedVendor ? selectedVendor.name : 'Not selected'}</span>
          <span>Last memo update: {formatDate(decisionMemo.updatedAt)}</span>
          <span>{new Date().getFullYear()} Ops Procurement Suite</span>
        </div>
      </footer>
    </main>
  )
}

export default App
