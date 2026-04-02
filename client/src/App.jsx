import { startTransition, useDeferredValue, useEffect, useMemo, useState } from 'react'
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

function App() {
  const [vendors, setVendors] = useState([])
  const [categories, setCategories] = useState([])
  const [summary, setSummary] = useState({
    vendorCount: 0,
    averageQuotedPrice: 0,
    averageLeadTimeDays: 0,
  })
  const [searchInput, setSearchInput] = useState('')
  const [category, setCategory] = useState('')
  const [selectedVendorId, setSelectedVendorId] = useState(null)
  const [selectedVendorSummary, setSelectedVendorSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState(null)
  const [error, setError] = useState('')
  const [priceWeight, setPriceWeight] = useState(60)
  const [exportScope, setExportScope] = useState('filtered')
  const [decisionMemo, setDecisionMemo] = useState({
    vendorId: null,
    content: '',
    updatedAt: null,
  })
  const [memoDraft, setMemoDraft] = useState('')
  const [memoSaving, setMemoSaving] = useState(false)
  const [isMemoOpen, setIsMemoOpen] = useState(false)

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
  const topVendor = comparison.rankedVendors[0]

  const exportIds = useMemo(() => {
    if (exportScope === 'filtered') {
      return comparison.rankedVendors.map((vendor) => vendor.id)
    }

    if (exportScope === 'top10') {
      return comparison.rankedVendors.slice(0, 10).map((vendor) => vendor.id)
    }

    return []
  }, [comparison.rankedVendors, exportScope])

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

  return (
    <main className="app-shell">
      <section className="hero-panel">
        <div className="hero-copy">
          <p className="eyebrow">Ops Procurement Workspace</p>
          <h1>Vendor Tracker</h1>
          <p className="hero-text">
            Compare supplier quotes, evaluate tradeoffs between price and delivery,
            and move from vendor review to final decision without losing context.
          </p>
        </div>

        <aside className="hero-side">
          <p className="hero-side-label">Current decision</p>
          <strong>{selectedVendor ? selectedVendor.name : 'No vendor selected'}</strong>
          <p>
            {selectedVendor
              ? `${formatCurrency(selectedVendor.quote.totalCost)} total landed cost | ${selectedVendor.quote.leadTimeDays} day lead time`
              : 'Review the shortlist and lock a vendor when you are ready.'}
          </p>
        </aside>
      </section>

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

      <section className="workspace-bar">
        <div className="workspace-copy">
          <p className="eyebrow">Procurement desk</p>
          <h2>Shortlist vendors, save the final call, and keep the reason attached</h2>
        </div>
        <div className="export-controls">
          <label className="export-field">
            <span>Export scope</span>
            <select value={exportScope} onChange={(event) => setExportScope(event.target.value)}>
              <option value="filtered">Current filtered view</option>
              <option value="top10">Top 10 ranked vendors</option>
              <option value="selected">Selected vendor only</option>
              <option value="all">All vendors</option>
            </select>
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
        <label className="field">
          <span>Search vendors</span>
          <input
            type="search"
            value={searchInput}
            onChange={(event) => {
              const value = event.target.value
              startTransition(() => setSearchInput(value))
            }}
            placeholder="Search by vendor or contact"
          />
        </label>

        <label className="field">
          <span>Category</span>
          <select value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="">All categories</option>
            {categories.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
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

      <section className="operational-grid">
        <section className="table-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Vendor ledger</p>
              <h2>Operational view of all current quotes</h2>
            </div>
            <p>Use the table to review vendors quickly, then use the ranked shortlist for the final decision.</p>
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
                {comparison.rankedVendors.map((vendor) => {
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

        <aside className="memo-panel">
          <div className="memo-panel-header">
            <p className="eyebrow">Decision memo</p>
            <h2>Capture the final rationale without crowding the main screen</h2>
          </div>

          <div className="memo-highlight">
            <span>Top ranked vendor</span>
            <strong>{topVendor ? topVendor.name : 'Not available yet'}</strong>
            <p>
              {topVendor
                ? `${formatCurrency(topVendor.quote.totalCost)} landed cost with ${topVendor.quote.leadTimeDays} day lead time`
                : 'Ranked results will appear here once vendor data is loaded.'}
            </p>
          </div>

          <div className="memo-preview">
            <span className="memo-meta">Attached to</span>
            <strong>{selectedVendor ? selectedVendor.name : 'No vendor selected'}</strong>
            <span className="memo-meta">Updated {formatDate(decisionMemo.updatedAt)}</span>
            <p>
              {decisionMemo.content || 'No memo saved yet. Open the memo editor to capture commercial reasoning, negotiation context, or follow-up notes.'}
            </p>
          </div>

          <button
            type="button"
            className="memo-button memo-open-button"
            onClick={() => setIsMemoOpen(true)}
          >
            {decisionMemo.content ? 'Open memo editor' : 'Add decision memo'}
          </button>
        </aside>
      </section>

      <section className="section-heading ranked-heading">
        <div>
          <p className="eyebrow">Ranked shortlist</p>
          <h2>Final comparison cards</h2>
        </div>
        <p>Use these to review the top vendors in more detail before locking the final selection.</p>
      </section>

      <section className="comparison-grid">
        {comparison.rankedVendors.map((vendor, index) => {
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
                ×
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
    </main>
  )
}

export default App
