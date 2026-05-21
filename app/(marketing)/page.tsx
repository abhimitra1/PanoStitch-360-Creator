import Link from 'next/link'
import { GrainOverlay } from '@/components/shared/GrainOverlay'

export default function LandingPage() {
  return (
    <div className="min-h-dvh bg-background text-ink overflow-x-hidden">
      <GrainOverlay />

      {/* Nav */}
      <nav className="flex items-center justify-between px-6 sm:px-12 h-14 border-b border-line">
        <span className="font-display font-bold text-lg">PanoStitch</span>
        <Link
          href="/projects"
          className="font-mono text-xs tracking-widest text-ink-dim hover:text-ink transition-colors"
        >
          open app →
        </Link>
      </nav>

      {/* Hero */}
      <section className="px-6 sm:px-12 pt-24 pb-20 max-w-4xl">
        <p className="font-mono text-xs tracking-widest text-ink-faint mb-6 uppercase">
          360° Virtual Tours
        </p>
        <h1 className="font-display font-bold text-5xl sm:text-7xl leading-[1.05] text-ink mb-8">
          Turn any room into
          <br />
          <span className="text-accent">a virtual tour.</span>
        </h1>
        <p className="text-ink-dim text-lg sm:text-xl font-light leading-relaxed max-w-xl mb-12">
          Stitch regular photos into immersive 360° panoramas and build
          multi-scene tours — right in your browser. No 360° camera needed.
          No account. Nothing uploaded.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 items-start">
          <Link
            href="/projects"
            className="inline-flex items-center gap-2 bg-accent text-background px-6 py-3 text-sm font-medium rounded-[2px] hover:bg-accent/90 transition-colors"
          >
            Start building
          </Link>
          <a
            href="#how-it-works"
            className="inline-flex items-center gap-2 text-ink-dim hover:text-ink transition-colors text-sm px-6 py-3"
          >
            See how it works →
          </a>
        </div>
      </section>

      {/* Divider */}
      <div className="border-t border-line mx-6 sm:mx-12" />

      {/* How it works */}
      <section id="how-it-works" className="px-6 sm:px-12 py-20">
        <p className="font-mono text-xs tracking-widest text-ink-faint mb-12 uppercase">
          How it works
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-12">
          {[
            {
              n: '01',
              title: 'Photograph',
              body: 'Walk to the center of a room and spin in place, taking 8–15 overlapping photos. Lock your exposure. Keep the horizon level.',
            },
            {
              n: '02',
              title: 'Stitch',
              body: 'Drop your photos in and PanoStitch assembles them into a 360° panorama using OpenCV — entirely in your browser, nothing sent anywhere.',
            },
            {
              n: '03',
              title: 'Connect',
              body: 'Add hotspot arrows linking rooms together. Name your scenes, set starting views, preview the tour — then export or share.',
            },
          ].map(({ n, title, body }) => (
            <div key={n}>
              <p className="font-mono text-xs tracking-widest text-accent mb-4">{n}</p>
              <h3 className="font-display font-bold text-2xl mb-3">{title}</h3>
              <p className="text-ink-dim font-light leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Divider */}
      <div className="border-t border-line mx-6 sm:mx-12" />

      {/* Features */}
      <section className="px-6 sm:px-12 py-20">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 max-w-2xl">
          {[
            {
              title: 'Private by design',
              body: 'Every photo, panorama, and tour lives in your browser\'s IndexedDB. Nothing ever leaves your device.',
            },
            {
              title: 'Multi-scene tours',
              body: 'Link panoramas with clickable hotspots. Visitors click arrows to walk from room to room.',
            },
            {
              title: 'Shareable without servers',
              body: 'Export any tour as a standalone HTML file. Recipients open it in any browser — no app, no login.',
            },
            {
              title: 'Completely free',
              body: 'No account, no subscription, no storage limits beyond your own device. It\'s just a web page.',
            },
          ].map(({ title, body }) => (
            <div key={title} className="border-t border-line pt-6">
              <h4 className="font-medium text-ink mb-2">{title}</h4>
              <p className="text-ink-dim text-sm font-light leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 sm:px-12 py-20 border-t border-line">
        <h2 className="font-display font-bold text-4xl sm:text-5xl text-ink mb-6">
          Ready to build your first tour?
        </h2>
        <Link
          href="/projects"
          className="inline-flex items-center gap-2 bg-accent text-background px-6 py-3 text-sm font-medium rounded-[2px] hover:bg-accent/90 transition-colors"
        >
          Get started — it&apos;s free
        </Link>
      </section>

      {/* Footer */}
      <footer className="px-6 sm:px-12 py-8 border-t border-line">
        <p className="font-mono text-xs text-ink-faint">
          PanoStitch — 100% browser-based · no account · no servers
        </p>
      </footer>
    </div>
  )
}
