import Link from 'next/link'
import { GrainOverlay } from '@/components/shared/GrainOverlay'
import { PanoMark } from '@/components/shared/PanoMark'

export default function LandingPage() {
  return (
    <div className="min-h-dvh bg-background text-ink overflow-x-hidden">
      <GrainOverlay />

      {/* Nav */}
      <nav className="flex items-center justify-between px-6 sm:px-12 h-14 border-b border-line">
        <div className="flex items-center gap-2.5">
          <PanoMark className="h-7 w-7 text-ink shrink-0" />
          <div className="flex flex-col leading-none gap-0.5">
            <span className="font-display font-bold text-sm text-ink tracking-wide">PanoStitch</span>
            <span className="font-mono text-[9px] text-ink-faint tracking-widest uppercase">360° Virtual Tours</span>
          </div>
        </div>
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
          Turn any space into
          <br />
          <span className="text-accent">a virtual tour.</span>
        </h1>
        <p className="text-ink-dim text-lg sm:text-xl font-light leading-relaxed max-w-xl mb-12">
          Capture 360° photos on your phone, import them into PanoStitch, add
          hotspots, and share an immersive tour — entirely in your browser.
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
              title: 'Capture',
              body: 'Use the 360° Photo Cam app on your phone to shoot your space. It stitches a full equirectangular panorama automatically.',
            },
            {
              n: '02',
              title: 'Import',
              body: 'Create a project in PanoStitch, import your 360° images, and give each scene a name. All processing stays on your device.',
            },
            {
              n: '03',
              title: 'Share',
              body: 'Add hotspot arrows linking scenes together, preview the tour, then export a standalone HTML file to share anywhere.',
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
              body: 'Every photo, panorama, and tour lives in your browser\'s local storage. Nothing ever leaves your device.',
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
      <footer className="px-6 sm:px-12 py-6 border-t border-line flex flex-wrap items-center gap-3">
        <p className="font-mono text-[10px] tracking-widest text-ink-faint uppercase">
          developed by{' '}
          <a
            href="https://abhimitra.com"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-ink transition-colors"
          >
            Abhi Mitra
          </a>
        </p>
        <span className="text-ink-faint/30">·</span>
        <a
          href="https://github.com/abhimitra1/PanoStitch-360-Creator"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 font-mono text-[10px] tracking-widest text-ink-faint uppercase hover:text-ink transition-colors"
        >
          <svg viewBox="0 0 24 24" className="h-3 w-3 shrink-0" fill="currentColor" aria-hidden="true">
            <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z" />
          </svg>
          source code
        </a>
        <span className="ml-auto font-mono text-[10px] text-ink-faint/40 uppercase tracking-widest">
          100% browser-based · no account · no servers
        </span>
      </footer>
    </div>
  )
}
