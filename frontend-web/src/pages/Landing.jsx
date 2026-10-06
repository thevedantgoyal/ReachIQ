/** Public marketing landing page with hero, stats, and how-it-works sections. */

import { useNavigate } from 'react-router-dom'
import { Upload, Sparkles, Bell, ArrowRight } from 'lucide-react'

function Logo({ className = '' }) {
  return (
    <span className={`font-serif text-2xl ${className}`}>
      <span className="text-brand-600 font-semibold">Reach</span>
      <span className="text-gray-400">IQ</span>
    </span>
  )
}

export default function Landing() {
  const navigate = useNavigate()

  const goOnboarding = () => navigate('/onboarding')

  const scrollToHow = () => {
    document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })
  }

  const stats = [
    { value: '100+', label: 'Recruiters reached per campaign' },
    { value: 'AI', label: 'Unique email per contact' },
    { value: '< 2min', label: 'Setup to first send' },
  ]

  const steps = [
    {
      num: 1,
      title: 'Upload your contacts',
      desc: 'Import a CSV with name, email, and company.',
      icon: Upload,
      color: 'bg-brand-600',
    },
    {
      num: 2,
      title: 'AI writes every email',
      desc: 'Gemini personalises each message for the recipient.',
      icon: Sparkles,
      color: 'bg-violet-600',
    },
    {
      num: 3,
      title: 'Get notified on WhatsApp',
      desc: 'Instant alert when a recruiter replies.',
      icon: Bell,
      color: 'bg-emerald-500',
    },
  ]

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      {/* Navbar */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100 animate-fade-in">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Logo />
          <button type="button" onClick={goOnboarding} className="btn-primary text-sm py-2 px-4">
            Get Started
            <ArrowRight className="inline w-4 h-4 ml-1 -mt-0.5" />
          </button>
        </div>
      </header>

      {/* Hero */}
      <section className="relative pt-36 pb-20 px-6 overflow-hidden">
        <div
          className="absolute top-24 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full bg-gradient-to-br from-brand-600/20 to-violet-600/20 blur-3xl animate-pulse pointer-events-none"
          aria-hidden="true"
        />
        <div className="relative max-w-3xl mx-auto text-center animate-fade-up">
          <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-brand-50 text-brand-700 text-sm font-medium mb-8">
            ✦ AI-powered job outreach
          </span>
          <h1 className="font-serif text-5xl md:text-6xl text-gray-900 leading-tight mb-6">
            Send <em className="italic">smarter</em>.
            <br />
            Land interviews.
          </h1>
          <p className="text-lg text-gray-500 max-w-xl mx-auto mb-10 leading-relaxed">
            ReachIQ personalises every cold email to recruiters using AI, sends from your
            Gmail, and notifies you the moment someone replies.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button type="button" onClick={goOnboarding} className="btn-primary text-base px-8 py-3">
              Connect Gmail &amp; Start
              <ArrowRight className="inline w-5 h-5 ml-2 -mt-0.5" />
            </button>
            <button type="button" onClick={scrollToHow} className="btn-secondary text-base px-8 py-3">
              See how it works ↓
            </button>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="max-w-5xl mx-auto px-6 pb-20">
        <div className="grid md:grid-cols-3 gap-6">
          {stats.map((stat, i) => (
            <div
              key={stat.label}
              className="card text-center hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 animate-fade-up"
              style={{ animationDelay: `${i * 0.1}s`, animationFillMode: 'both' }}
            >
              <p className="font-serif text-4xl text-brand-600 mb-2">{stat.value}</p>
              <p className="text-sm text-gray-500">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="max-w-5xl mx-auto px-6 pb-24">
        <h2 className="font-serif text-3xl text-center text-gray-900 mb-16">How it works</h2>
        <div className="grid md:grid-cols-3 gap-8 md:gap-4 relative">
          {steps.map((step, i) => {
            const Icon = step.icon
            return (
              <div key={step.num} className="relative flex flex-col items-center text-center animate-fade-up">
                {i < steps.length - 1 && (
                  <div
                    className="hidden md:block absolute top-8 left-[calc(50%+2rem)] w-[calc(100%-4rem)] border-t-2 border-dashed border-gray-200"
                    aria-hidden="true"
                  />
                )}
                <div
                  className={`w-16 h-16 rounded-2xl ${step.color} flex items-center justify-center text-white mb-4 shadow-lg`}
                >
                  <Icon className="w-8 h-8" />
                </div>
                <span className="text-xs font-semibold text-brand-600 mb-2">Step {step.num}</span>
                <h3 className="font-semibold text-gray-900 mb-2">{step.title}</h3>
                <p className="text-sm text-gray-500 max-w-xs">{step.desc}</p>
              </div>
            )
          })}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-10 text-center">
        <p className="text-sm text-gray-400">Built for developers who job hunt smarter.</p>
      </footer>
    </div>
  )
}
