import { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'
import { feature } from 'topojson-client'
import world from 'world-atlas/countries-110m.json'
import './App.css'

// ===== 1. The data =====
const data = [
  { country: "United States", students: 68 },
  { country: "France", students: 21 },
  { country: "United Kingdom", students: 21 },
  { country: "Germany", students: 20 },
  { country: "Switzerland", students: 13 },
  { country: "Spain", students: 10 },
  { country: "Netherlands", students: 9 },
  { country: "India", students: 9 },
  { country: "Singapore", students: 8 },
  { country: "Ireland", students: 8 },
  { country: "Sweden", students: 7 },
  { country: "Australia", students: 7 },
  { country: "Canada", students: 6 },
  { country: "Finland", students: 5 },
  { country: "Mexico", students: 4 },
  { country: "Brazil", students: 4 },
  { country: "Saudi Arabia", students: 3 },
  { country: "Romania", students: 3 },
  { country: "Philippines", students: 3 },
  { country: "New Zealand", students: 3 },
];

// Where the globe should turn for each country: [longitude, latitude]
const countryCenters = {
  "United States": [-98.5, 39.8],
  "France": [2.5, 46.6],
  "United Kingdom": [-2.0, 54.0],
  "Germany": [10.4, 51.2],
  "Switzerland": [8.2, 46.8],
  "Spain": [-3.7, 40.2],
  "Netherlands": [5.3, 52.1],
  "India": [79.0, 22.0],
  "Singapore": [103.8, 1.35],
  "Ireland": [-8.0, 53.4],
  "Sweden": [16.0, 62.0],
  "Australia": [134.0, -25.5],
  "Canada": [-100.0, 58.0],
  "Finland": [26.0, 64.0],
  "Mexico": [-102.5, 23.6],
  "Brazil": [-52.0, -10.0],
  "Saudi Arabia": [45.0, 24.0],
  "Romania": [25.0, 45.9],
  "Philippines": [122.0, 12.5],
  "New Zealand": [172.5, -41.5],
}

// The map file names one country differently than our data does
const mapNames = { "United States": "United States of America" }
const mapName = country => mapNames[country] ?? country

// Country shapes, unpacked from the map file once
const countries = feature(world, world.objects.countries).features
const graticule = d3.geoGraticule10()   // the faint latitude and longitude grid
const sphere = { type: "Sphere" }        // the globe's outline

// ===== 2. Chart settings (safe to change) =====
const width = 560
const barHeight = 28
const margin = { top: 10, right: 40, bottom: 10, left: 140 }
const height = margin.top + margin.bottom + data.length * barHeight

const GLOBE_SIZE = 340       // width and height of the globe area, in pixels
const SPIN_SPEED = 0.006     // degrees per millisecond (about 6 degrees a second)
const TURN_DURATION = 1200   // how long the globe takes to turn to a country, in milliseconds
const DEFAULT_TILT = -15     // how much the globe tilts while spinning

// ===== 3. Sort largest to smallest =====
const sorted = [...data].sort((a, b) => b.students - a.students)

// ===== 4. Bar chart scales =====
const x = d3.scaleLinear()
  .domain([0, d3.max(sorted, d => d.students)])
  .range([margin.left, width - margin.right])

const y = d3.scaleBand()
  .domain(sorted.map(d => d.country))
  .range([margin.top, height - margin.bottom])
  .padding(0.2)

// ===== 5. The page =====
function App() {
  const [selected, setSelected] = useState(null)          // the clicked country, or null
  const [rotation, setRotation] = useState([0, DEFAULT_TILT, 0])
  const rotationRef = useRef(rotation)                    // the latest rotation, for the animations

  // ----- Globe motion: spin when nothing is selected, turn to a country when one is -----
  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let frame
    let last = performance.now()

    function update(newRotation) {
      rotationRef.current = newRotation
      setRotation(newRotation)
    }

    if (selected === null) {
      if (reduceMotion) return
      // Spin: each frame, turn a little, and ease the tilt back to normal
      const spin = now => {
        const elapsed = now - last
        last = now
        const [lon, lat] = rotationRef.current
        update([lon + elapsed * SPIN_SPEED, lat + (DEFAULT_TILT - lat) * 0.03, 0])
        frame = requestAnimationFrame(spin)
      }
      frame = requestAnimationFrame(spin)
    } else {
      // Turn: glide from the current position to face the selected country
      const [lon, lat] = countryCenters[selected]
      const start = rotationRef.current
      const shortestTurn = ((-lon - start[0]) % 360 + 540) % 360 - 180
      const glide = d3.interpolate(start, [start[0] + shortestTurn, -lat, 0])
      const startTime = performance.now()
      const duration = reduceMotion ? 1 : TURN_DURATION

      const turn = now => {
        const t = Math.min(1, (now - startTime) / duration)
        update([...glide(d3.easeCubicInOut(t))])
        if (t < 1) frame = requestAnimationFrame(turn)
      }
      frame = requestAnimationFrame(turn)
    }

    return () => cancelAnimationFrame(frame)
  }, [selected])

  // ----- Globe math (D3), recalculated as the globe moves -----
  const projection = d3.geoOrthographic()
    .scale(GLOBE_SIZE / 2 - 10)
    .translate([GLOBE_SIZE / 2, GLOBE_SIZE / 2])
    .rotate(rotation)
  const path = d3.geoPath(projection)

  // The far side of the globe, seen through the near side, like looking through glass
  const backProjection = d3.geoOrthographic()
    .scale(GLOBE_SIZE / 2 - 10)
    .translate([GLOBE_SIZE / 2, GLOBE_SIZE / 2])
    .rotate([rotation[0] + 180, -rotation[1], -rotation[2]])
    .reflectX(true)
  const backPath = d3.geoPath(backProjection)

  const marker = selected ? projection(countryCenters[selected]) : null

  // Clicking a selected bar again releases the globe
  const toggle = country => setSelected(selected === country ? null : country)

  return (
    <main className="chart-page">
      <h1>D3 React cohort 1 students by country</h1>
      <p className="subtitle">
        Number of students by country. Select a bar to find that country on the globe.
      </p>

      <div className="chart-layout">
        {/* ===== Bar chart ===== */}
        <svg
          className="bar-chart"
          viewBox={`0 0 ${width} ${height}`}
          role="group"
          aria-label="Bar chart of students by country, led by the United States with 68"
        >
          {sorted.map(d => {
            const isSelected = d.country === selected
            const middle = y(d.country) + y.bandwidth() / 2
            return (
              <g
                key={d.country}
                className={isSelected ? "bar-row selected" : "bar-row"}
                role="button"
                tabIndex={0}
                aria-pressed={isSelected}
                aria-label={`${d.country}, ${d.students} students`}
                onClick={() => toggle(d.country)}
                onKeyDown={event => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault()
                    toggle(d.country)
                  }
                }}
              >
                {/* An invisible strip across the whole row, so it's easy to click */}
                <rect className="row-hit" x={0} y={y(d.country)}
                  width={width} height={y.bandwidth()} />

                <text className="country-label"
                  x={margin.left - 10} y={middle} dy="0.35em" textAnchor="end">
                  {d.country}
                </text>

                <rect className="bar"
                  x={x(0)} y={y(d.country)}
                  width={x(d.students) - x(0)} height={y.bandwidth()} />

                <text className="value-label"
                  x={x(d.students) + 6} y={middle} dy="0.35em">
                  {d.students}
                </text>
              </g>
            )
          })}

          {/* A light baseline where every bar starts */}
          <line className="axis-line"
            x1={x(0)} x2={x(0)} y1={margin.top} y2={height - margin.bottom} />
        </svg>

        {/* ===== Globe ===== */}
        <svg
          className="globe"
          viewBox={`0 0 ${GLOBE_SIZE} ${GLOBE_SIZE}`}
          role="img"
          aria-label={selected ? `Globe turned to ${selected}` : "Slowly spinning globe"}
        >
          <path className="globe-ocean" d={path(sphere)} />

          {/* Far side first, so the near side draws on top of it */}
          <path className="globe-grid-back" d={backPath(graticule)} />
          {countries.map(c => (
            <path key={`back-${c.id}-${c.properties.name}`} className="land-back" d={backPath(c)} />
          ))}

          <path className="globe-grid" d={path(graticule)} />
          {countries.map(c => (
            <path
              key={`front-${c.id}-${c.properties.name}`}
              className={selected && c.properties.name === mapName(selected) ? "land highlighted" : "land"}
              d={path(c)}
            />
          ))}

          {marker && (
            <circle key={selected} className="marker" cx={marker[0]} cy={marker[1]} r={9} />
          )}

          <path className="globe-outline" d={path(sphere)} />
        </svg>
      </div>
    </main>
  )
}

export default App
