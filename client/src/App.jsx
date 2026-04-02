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
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState(null)
  const [error, setError] = useState('')
  const [priceWeight, setPriceWeight] = useState(60)

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
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setSavingId(null)
    }
  }

  const selectedVendor = vendors.find((vendor) => vendor.id === selectedVendorId)

  return (
    <main className="app-shell">
      <section className="hero-panel">
        <div className="hero-copy">
          <p className="eyebrow">Ops Procurement Workspace</p>
          <h1>Vendor Tracker</h1>
          <p className="hero-text">
            Compare supplier quotes, spot the fastest delivery, and lock in a vendor
            choice that survives reloads.
          </p>
        </div>

        <div className="hero-metrics">
          <article className="metric-card">
            <span>Visible vendors</span>
            <strong>{numberFormatter.format(summary.vendorCount)}</strong>
          </article>
          <article className="metric-card">
            <span>Average quote</span>
            <strong>{formatCurrency(summary.averageQuotedPrice)}</strong>
          </article>
          <article className="metric-card">
            <span>Average lead time</span>
            <strong>{summary.averageLeadTimeDays.toFixed(1)} days</strong>
          </article>
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
          <small>{priceWeight}% price / {leadTimeWeight}% speed</small>
        </label>

        <a className="export-link" href="/api/vendors/export.csv">
          Export CSV
        </a>
      </section>

      {error ? <p className="status-message error">{error}</p> : null}
      {loading ? <p className="status-message">Loading vendor quotes...</p> : null}

      <section className="selection-banner">
        <div>
          <p className="eyebrow">Current saved choice</p>
          <strong>
            {selectedVendor ? selectedVendor.name : 'No vendor selected yet'}
          </strong>
          <p>
            {selectedVendor
              ? `${formatCurrency(selectedVendor.quote.totalCost)} landed cost, ${selectedVendor.quote.leadTimeDays} day lead time`
              : 'Pick a vendor and the backend will persist it in SQLite.'}
          </p>
        </div>
        <div className="badge-group">
          <span className="chip">SQLite persistence</span>
          <span className="chip">REST API</span>
          <span className="chip">Mock seeded data</span>
        </div>
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
            >
              <div className="card-topline">
                <span className="rank-pill">Rank #{index + 1}</span>
                <span className="category-pill">{vendor.category}</span>
              </div>

              <div className="card-header">
                <div>
                  <h2>{vendor.name}</h2>
                  <p>{vendor.contact.name}</p>
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

              <div className="badge-group">
                {isCheapest ? <span className="highlight-chip">Best price</span> : null}
                {isFastest ? <span className="highlight-chip">Fastest delivery</span> : null}
                {hasLowestTotal ? <span className="highlight-chip">Lowest total</span> : null}
              </div>

              <p className="notes">{vendor.notes}</p>

              <div className="contact-list">
                <span>{vendor.contact.email}</span>
                <span>{vendor.contact.phone}</span>
              </div>

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
    </main>
  )
}

export default App
