import { useState } from 'react';
import {
  AlertTriangle, ArrowRight, Bot, Building2, CalendarDays, HeartPulse,
  Network, ShieldCheck, Stethoscope, UserRound, Zap,
} from 'lucide-react';
import { useAuth, type DemoRole } from '@/lib/auth-context';

const personas: Array<{
  role: DemoRole;
  label: string;
  name: string;
  icon: typeof UserRound;
  tagline: string;
  bullets: string[];
}> = [
  {
    role: 'PATIENT',
    label: 'Patient',
    name: 'Maya Nair',
    icon: UserRound,
    tagline: 'Describe what you need in plain language and get a verified booking.',
    bullets: ['Talk to the access assistant', 'Book, reschedule, or cancel', 'Complete pre-visit questionnaires'],
  },
  {
    role: 'DOCTOR',
    label: 'Doctor',
    name: 'Dr. Anika Rao',
    icon: Stethoscope,
    tagline: 'See today\u2019s schedule and the pre-visit context patients shared.',
    bullets: ['Review upcoming appointments', 'Manage availability', 'Read authorized pre-visit answers'],
  },
  {
    role: 'HOSPITAL_ADMIN',
    label: 'Hospital admin',
    name: 'Nisha Kulkarni',
    icon: Building2,
    tagline: 'Run one hospital: doctors, calendars, integrations, and recovery.',
    bullets: ['Configure doctors & availability', 'Watch the EHR connection', 'Test the failure-recovery console'],
  },
  {
    role: 'PLATFORM_ADMIN',
    label: 'Platform admin',
    name: 'Aarav Shah',
    icon: Network,
    tagline: 'See every hospital on the network and the full audit trail.',
    bullets: ['Monitor the hospital network', 'Review platform-wide analytics', 'Trace any booking end-to-end'],
  },
];

function Logo() {
  return <span className="flex items-center gap-3">
    <span className="brand-mark"><HeartPulse size={18} strokeWidth={2.5} /></span>
    <span className="font-display text-[17px] font-bold tracking-[-0.03em] text-foreground">care<span className="text-primary">flow</span></span>
  </span>;
}

export default function Hero() {
  const { loginAs, loggingIn, error } = useAuth();
  const [selected, setSelected] = useState<DemoRole | null>(null);

  const handleSelect = (role: DemoRole) => {
    setSelected(role);
    void loginAs(role);
  };

  return <div className="noise-layer min-h-[100dvh] bg-background">
    <header className="mx-auto flex max-w-[1200px] items-center justify-between px-5 py-6 sm:px-8">
      <Logo />
      <span className="hidden items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground sm:inline-flex">
        <span className="live-dot" /> Prototype demo
      </span>
    </header>

    <main className="mx-auto max-w-[1200px] px-5 pb-20 sm:px-8">
      <section className="mx-auto max-w-3xl pt-6 text-center sm:pt-12">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-primary">
          <Bot size={13} /> AI-native healthcare access
        </div>
        <h1 className="font-display text-[2.1rem] font-extrabold leading-[1.05] tracking-[-0.05em] text-foreground sm:text-[3rem]">
          From &ldquo;I need a doctor&rdquo; to a verified appointment.
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">
          CareFlow lets patients describe what they need in plain language, checks real availability across a
          hospital network, books through a controlled integration layer, and verifies the result &mdash; with every
          step observable by the people who run it.
        </p>
      </section>

      <section className="mt-12">
        <p className="mb-5 text-center text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
          This is a demo &mdash; step into any of the four roles, no password needed
        </p>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {personas.map((persona) => {
            const Icon = persona.icon;
            const isLoading = loggingIn === persona.role;
            return <button
              key={persona.role}
              type="button"
              onClick={() => handleSelect(persona.role)}
              disabled={loggingIn !== null}
              data-testid={`button-demo-login-${persona.role.toLowerCase()}`}
              className="panel group flex flex-col items-start text-left transition-transform duration-200 hover:-translate-y-1 hover:border-primary/40 disabled:cursor-not-allowed disabled:opacity-70"
            >
              <div className="metric-icon metric-teal"><Icon size={18} /></div>
              <div className="mt-4 text-sm font-bold text-foreground">{persona.label}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">Demo persona &middot; {persona.name}</div>
              <p className="mt-3 text-xs leading-5 text-muted-foreground">{persona.tagline}</p>
              <ul className="mt-4 space-y-1.5">
                {persona.bullets.map((bullet) => (
                  <li key={bullet} className="flex items-start gap-2 text-[11px] text-muted-foreground">
                    <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-primary" /> {bullet}
                  </li>
                ))}
              </ul>
              <span className="button button-primary mt-5 w-full justify-center">
                {isLoading ? 'Signing you in\u2026' : <>Continue as {persona.label} <ArrowRight size={14} /></>}
              </span>
            </button>;
          })}
        </div>
        {error && selected && (
          <div className="mx-auto mt-5 flex max-w-md items-center gap-2 rounded-xl border border-destructive/25 bg-destructive/5 px-4 py-3 text-xs text-destructive">
            <AlertTriangle size={15} /> {error}
          </div>
        )}
      </section>

      <section className="mt-16 grid gap-4 sm:grid-cols-3">
        <div className="panel">
          <div className="metric-icon metric-blue"><CalendarDays size={17} /></div>
          <div className="mt-3 text-sm font-bold">Real availability</div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">Every slot shown comes from live scheduling data, never invented.</p>
        </div>
        <div className="panel">
          <div className="metric-icon metric-coral"><ShieldCheck size={17} /></div>
          <div className="mt-3 text-sm font-bold">Tenant isolation</div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">One hospital can never see another hospital&rsquo;s patients or config.</p>
        </div>
        <div className="panel">
          <div className="metric-icon metric-gold"><Zap size={17} /></div>
          <div className="mt-3 text-sm font-bold">Verified, recoverable</div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">Bookings are confirmed only after the external system verifies them.</p>
        </div>
      </section>
    </main>
  </div>;
}
