import { useEffect, useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Link, Route, Router as WouterRouter, Switch, useLocation } from 'wouter';
import {
  Activity, AlertTriangle, ArrowRight, BadgeCheck, BarChart3, Bell, Bot, Building2,
  CalendarDays, Check, ChevronDown, ClipboardCheck, Clock3, Cloud, Database, FileCheck2,
  HeartPulse, History, Home, Layers3, ListChecks, LockKeyhole, Menu, MessageSquare,
  Network, RefreshCcw, Search, Send, ShieldCheck, Stethoscope, UserRound, UsersRound,
  X, Zap,
} from 'lucide-react';
import {
  getGetDemoAppointmentQueryKey, getGetDemoAppointmentsQueryKey, getGetDemoAuditQueryKey, getGetDemoAnalyticsQueryKey,
  getGetDemoQuestionnaireQueryKey, getGetDemoWorkflowsQueryKey, useCreateDemoAppointment,
  useGetDemoAnalytics, useGetDemoAppointments, useGetDemoAppointment, useGetDemoAudit,
  useGetDemoAvailability, useGetDemoDoctors, useGetDemoHospitals, useGetDemoOverview,
  useGetDemoQuestionnaire, useGetDemoWorkflows, useHealthCheck, useRunFailureSimulation,
  useSendDemoAiMessage, useSubmitDemoQuestionnaire,
} from '@workspace/api-client-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import './index.css';

const queryClient = new QueryClient();
const today = new Date().toISOString().slice(0, 10);
const roles = [
  { value: 'PATIENT', label: 'Patient', icon: UserRound },
  { value: 'DOCTOR', label: 'Doctor', icon: Stethoscope },
  { value: 'HOSPITAL_ADMIN', label: 'Hospital admin', icon: Building2 },
  { value: 'PLATFORM_ADMIN', label: 'Platform admin', icon: Network },
] as const;

const navGroups = [
  { label: 'Workspace', items: [
    { href: '/', label: 'Overview', icon: Home },
    { href: '/patient', label: 'Patient access', icon: MessageSquare },
    { href: '/appointments', label: 'Appointments', icon: CalendarDays },
    { href: '/doctor', label: 'Doctor review', icon: Stethoscope },
  ]},
  { label: 'Operations', items: [
    { href: '/admin', label: 'Hospital operations', icon: Building2 },
    { href: '/platform', label: 'Platform view', icon: Layers3 },
    { href: '/analytics', label: 'Analytics', icon: BarChart3 },
    { href: '/audit', label: 'Audit trail', icon: History },
  ]},
];

function cn(...parts: Array<string | false | undefined>) { return parts.filter(Boolean).join(' '); }
function initials(value = '') { return value.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase() || 'CF'; }
function prettyDate(value?: string) {
  if (!value) return '—';
  if (!/^\d{4}-\d{2}-\d{2}/.test(value)) return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function prettyTime(value?: string) {
  if (!value) return '—';
  const parsed = new Date(`1970-01-01T${value.length === 5 ? `${value}:00` : value}`);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}
function statusTone(status = '') {
  const value = status.toLowerCase();
  if (value.includes('verified') || value.includes('success') || value.includes('connected') || value.includes('complete') || value === 'active' || value === 'confirmed') return 'status-good';
  if (value.includes('pending') || value.includes('retry') || value.includes('review') || value.includes('sync')) return 'status-warn';
  if (value.includes('fail') || value.includes('timeout') || value.includes('error') || value === 'offline') return 'status-bad';
  return 'status-neutral';
}

function Logo() {
  return <Link href="/" className="flex items-center gap-3" data-testid="link-brand">
    <span className="brand-mark"><HeartPulse size={18} strokeWidth={2.5} /></span>
    <span className="font-display text-[17px] font-bold tracking-[-0.03em] text-sidebar-foreground">care<span className="text-sidebar-primary">flow</span></span>
  </Link>;
}

function AppData({ children }: { children: (data: AppDataValue) => ReactNode }) {
  const [role, setRole] = useState<(typeof roles)[number]['value']>('PATIENT');
  const [hospitalId, setHospitalId] = useState('');
  const [selectedAppointmentId, setSelectedAppointmentId] = useState('');
  const hospitalsQuery = useGetDemoHospitals();
  const hospitals = hospitalsQuery.data ?? [];
  useEffect(() => {
    if (!hospitalId && hospitals[0]?.id) setHospitalId(hospitals[0].id);
  }, [hospitalId, hospitals]);
  const hospital = hospitals.find((item) => item.id === hospitalId) ?? hospitals[0];
  const overviewQuery = useGetDemoOverview({ role: role as any, hospitalId: hospital?.id });
  const doctorsQuery = useGetDemoDoctors({ hospitalId: hospital?.id });
  const doctors = doctorsQuery.data ?? [];
  const availabilityQuery = useGetDemoAvailability(
    { doctorId: doctors[0]?.id ?? '', date: today, hospitalId: hospital?.id },
    { query: { enabled: Boolean(hospital?.id && doctors[0]?.id), queryKey: ['/api/demo/availability', doctors[0]?.id ?? '', today, hospital?.id] } },
  );
  const appointmentsQuery = useGetDemoAppointments({ role: role as any, hospitalId: hospital?.id });
  const detailId = selectedAppointmentId || appointmentsQuery.data?.[0]?.id || '';
  const detailQuery = useGetDemoAppointment(detailId, { query: { enabled: Boolean(detailId), queryKey: getGetDemoAppointmentQueryKey(detailId) } });
  const analyticsQuery = useGetDemoAnalytics({ hospitalId: hospital?.id });
  const auditQuery = useGetDemoAudit({ hospitalId: hospital?.id });
  const workflowsQuery = useGetDemoWorkflows({ hospitalId: hospital?.id });
  const questionnaireQuery = useGetDemoQuestionnaire();
  const healthQuery = useHealthCheck();
  const ai = useSendDemoAiMessage();
  const book = useCreateDemoAppointment();
  const submitQuestionnaire = useSubmitDemoQuestionnaire();
  const failure = useRunFailureSimulation();

  return children({
    role, setRole, hospitalId: hospital?.id ?? hospitalId, setHospitalId, hospital, hospitals,
    overview: overviewQuery.data, doctors, availability: availabilityQuery.data ?? [],
    appointments: appointmentsQuery.data ?? [], selectedAppointmentId, setSelectedAppointmentId,
    appointmentDetail: detailQuery.data, analytics: analyticsQuery.data, audit: auditQuery.data ?? [],
    workflows: workflowsQuery.data ?? [], questionnaire: questionnaireQuery.data,
    health: healthQuery.data, loading: hospitalsQuery.isLoading || overviewQuery.isLoading,
    queries: { overviewQuery, appointmentsQuery, analyticsQuery, auditQuery, workflowsQuery, questionnaireQuery },
    mutations: { ai, book, submitQuestionnaire, failure },
    invalidate: () => {
      queryClient.invalidateQueries({ queryKey: getGetDemoAppointmentsQueryKey({ role: role as any, hospitalId: hospital?.id }) });
      queryClient.invalidateQueries({ queryKey: getGetDemoAuditQueryKey({ hospitalId: hospital?.id }) });
      queryClient.invalidateQueries({ queryKey: getGetDemoAnalyticsQueryKey({ hospitalId: hospital?.id }) });
      queryClient.invalidateQueries({ queryKey: getGetDemoQuestionnaireQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetDemoWorkflowsQueryKey({ hospitalId: hospital?.id }) });
    },
  });
}

type AppDataValue = {
  role: (typeof roles)[number]['value']; setRole: (role: (typeof roles)[number]['value']) => void;
  hospitalId: string; setHospitalId: (id: string) => void; hospital: any; hospitals: any[];
  overview: any; doctors: any[]; availability: any[]; appointments: any[];
  selectedAppointmentId: string; setSelectedAppointmentId: (id: string) => void; appointmentDetail: any;
  analytics: any; audit: any[]; workflows: any[]; questionnaire: any; health: any; loading: boolean;
  queries: any; mutations: any; invalidate: () => void;
};

function Shell({ data, children }: { data: AppDataValue; children: ReactNode }) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const role = roles.find((item) => item.value === data.role) ?? roles[0];
  const RoleIcon = role.icon;
  return <div className="noise-layer min-h-[100dvh] bg-background">
    <aside className={cn('app-sidebar', mobileOpen && 'mobile-open')}>
      <div className="flex items-center justify-between px-5 py-5">
        <Logo />
        <button className="icon-button md:hidden" onClick={() => setMobileOpen(false)} aria-label="Close navigation" data-testid="button-close-nav"><X size={17} /></button>
      </div>
      <div className="mx-4 rounded-xl border border-sidebar-border bg-sidebar-accent/70 p-3">
        <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-sidebar-primary"><span className="live-dot" /> Demo workspace</div>
        <div className="text-xs leading-5 text-sidebar-foreground/70">Live data · {data.hospital?.shortName || data.hospital?.name || 'CareFlow network'}</div>
      </div>
      <nav className="mt-7 flex-1 px-3">
        {navGroups.map((group) => <div key={group.label} className="mb-7">
          <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-sidebar-foreground/45">{group.label}</div>
          <div className="space-y-1">
            {group.items.map((item) => {
              const Icon = item.icon;
              const active = location === item.href;
              return <Link href={item.href} onClick={() => setMobileOpen(false)} className={cn('sidebar-link', active && 'active')} data-testid={`link-nav-${item.label.toLowerCase().replaceAll(' ', '-')}`} key={item.href}>
                <Icon size={16} strokeWidth={active ? 2.4 : 1.8} /><span>{item.label}</span>{item.href === '/appointments' && <span className="ml-auto nav-count">{data.appointments.length}</span>}
              </Link>;
            })}
          </div>
        </div>)}
      </nav>
      <div className="mx-4 mb-5 rounded-xl border border-sidebar-border/80 bg-sidebar-accent/45 p-3">
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-sidebar-foreground"><ShieldCheck size={15} className="text-sidebar-primary" /> Protected workspace</div>
        <p className="text-[11px] leading-4 text-sidebar-foreground/55">Every access decision is logged and traceable.</p>
      </div>
      <div className="border-t border-sidebar-border px-4 py-4">
        <div className="flex items-center gap-3"><div className="avatar avatar-small bg-sidebar-primary text-sidebar-primary-foreground">JC</div><div className="min-w-0"><div className="truncate text-xs font-semibold text-sidebar-foreground">Jordan Chen</div><div className="truncate text-[11px] text-sidebar-foreground/50">{role.label}</div></div><button className="ml-auto text-sidebar-foreground/50 hover:text-sidebar-primary" aria-label="Open profile" data-testid="button-profile"><ChevronDown size={15} /></button></div>
      </div>
    </aside>
    {mobileOpen && <button className="sidebar-scrim md:hidden" onClick={() => setMobileOpen(false)} aria-label="Close menu" data-testid="button-sidebar-scrim" />}
    <main className="md:pl-[248px]">
      <header className="topbar">
        <button className="icon-button md:hidden" onClick={() => setMobileOpen(true)} aria-label="Open navigation" data-testid="button-open-nav"><Menu size={19} /></button>
        <div className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex"><span className="text-foreground/45">CareFlow</span><span>/</span><span className="font-medium text-foreground">{pageName(location)}</span></div>
        <div className="ml-auto flex items-center gap-2">
          <div className="health-chip"><span className={cn('health-dot', data.health?.status === 'ok' ? 'online' : '')} /> API {data.health?.status === 'ok' ? 'operational' : 'checking'}</div>
          <button className="icon-button" aria-label="Notifications" data-testid="button-notifications"><Bell size={17} /></button>
          <select value={data.role} onChange={(event) => data.setRole(event.target.value as AppDataValue['role'])} className="role-select" data-testid="select-role">
            {roles.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}
          </select>
        </div>
      </header>
      <div className="mx-auto max-w-[1500px] px-4 pb-12 sm:px-7 lg:px-10">{children}</div>
    </main>
  </div>;
}

function pageName(location: string) {
  const names: Record<string, string> = { '/': 'Overview', '/patient': 'Patient access', '/assistant': 'Access assistant', '/appointments': 'Appointments', '/doctor': 'Doctor review', '/admin': 'Hospital operations', '/platform': 'Platform view', '/analytics': 'Analytics', '/audit': 'Audit trail' };
  return names[location] ?? 'Workspace';
}

function PageHeader({ eyebrow, title, description, actions }: { eyebrow: string; title: string; description?: string; actions?: ReactNode }) {
  return <div className="page-header"><div><div className="eyebrow">{eyebrow}</div><h1 className="page-title">{title}</h1>{description && <p className="page-description">{description}</p>}</div>{actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}</div>;
}

function Skeleton({ className = '' }: { className?: string }) { return <div className={cn('skeleton', className)} />; }
function LoadingBlock() { return <div className="space-y-4"><Skeleton className="h-28 w-full" /><div className="grid gap-4 md:grid-cols-3"><Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" /></div><Skeleton className="h-72 w-full" /></div>; }
function EmptyState({ icon: Icon = ClipboardCheck, title, description, action }: { icon?: any; title: string; description: string; action?: ReactNode }) { return <div className="empty-state"><div className="empty-icon"><Icon size={22} /></div><div className="font-display text-lg font-bold">{title}</div><p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>{action && <div className="mt-4">{action}</div>}</div>; }
function ErrorState({ retry }: { retry?: () => void }) { return <div className="rounded-2xl border border-destructive/25 bg-destructive/5 p-6 text-center"><AlertTriangle className="mx-auto mb-2 text-destructive" size={22} /><div className="font-semibold">This view could not load</div><p className="mt-1 text-sm text-muted-foreground">The workspace is still safe. Try the request again.</p>{retry && <button className="button button-secondary mt-4" onClick={retry} data-testid="button-retry"><RefreshCcw size={14} /> Retry</button>}</div>; }
function MetricCard({ label, value, change, tone = 'teal', icon: Icon = Activity }: { label: string; value: string | number; change?: string; tone?: string; icon?: any }) { return <div className="metric-card"><div className="flex items-start justify-between"><div className={cn('metric-icon', `metric-${tone}`)}><Icon size={17} /></div>{change && <span className="metric-change">{change}</span>}</div><div className="mt-4 text-2xl font-bold tracking-[-0.04em] text-foreground">{value}</div><div className="mt-1 text-xs font-medium text-muted-foreground">{label}</div></div>; }
function StatusBadge({ value }: { value?: string }) { return <span className={cn('status-badge', statusTone(value))}><span className="status-pip" />{value || 'Unknown'}</span>; }
function SectionTitle({ title, meta, action }: { title: string; meta?: string; action?: ReactNode }) { return <div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="section-title">{title}</h2>{meta && <p className="mt-1 text-xs text-muted-foreground">{meta}</p>}</div>{action}</div>; }

function OverviewPage({ data }: { data: AppDataValue }) {
  const metrics = data.overview?.metrics ?? [];
  const activities = data.overview?.activity ?? [];
  const nextAppointment = data.appointments[0];
  return <div className="animate-enter">
    <PageHeader eyebrow={`Good morning, Jordan · ${data.hospital?.city || 'CareFlow network'}`} title="Access at a glance" description="A calm view of every request, verification, and handoff in motion." actions={<><Link href="/assistant" className="button button-primary" data-testid="link-start-access"><Bot size={15} /> Start access request</Link><Link href="/analytics" className="button button-secondary" data-testid="link-view-analytics"><BarChart3 size={15} /> View health</Link></>} />
    <div className="overview-banner"><div className="banner-grid" /><div className="relative z-10 flex flex-col gap-5 md:flex-row md:items-end md:justify-between"><div><div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-primary"><span className="live-dot bg-primary" /> {data.hospital?.shortName || 'CareFlow network'}</div><h2 className="font-display max-w-xl text-2xl font-bold tracking-[-0.04em] text-foreground sm:text-3xl">From “I need help” to a verified appointment.</h2><p className="mt-2 max-w-lg text-sm leading-6 text-muted-foreground">CareFlow keeps the patient conversation human while giving your team a clear, auditable operating trail.</p></div><Link href="/patient" className="button button-primary shrink-0" data-testid="link-open-patient-access">Open patient access <ArrowRight size={15} /></Link></div></div>
    {data.loading ? <LoadingBlock /> : <><div className="metric-grid mt-6">{metrics.slice(0, 4).map((metric: any, index: number) => <MetricCard key={metric.label} label={metric.label} value={metric.value} change={metric.change} tone={['teal', 'gold', 'blue', 'coral'][index]} icon={[BadgeCheck, ShieldCheck, Clock3, UsersRound][index]} />)}{metrics.length === 0 && <MetricCard label="Verified requests today" value="—" change="Waiting for data" />}</div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[1.35fr_.65fr]"><section className="panel"><SectionTitle title="Next in the access queue" meta="The next patient handoff your team can act on" action={<Link href="/appointments" className="text-xs font-bold text-primary hover:underline" data-testid="link-all-appointments">All appointments <ArrowRight size={13} className="inline" /></Link>} />{nextAppointment ? <AppointmentRow appointment={nextAppointment} onClick={() => data.setSelectedAppointmentId(nextAppointment.id)} /> : <EmptyState title="No appointments in view" description="Verified bookings will appear here as soon as patients select a slot." action={<Link href="/assistant" className="button button-secondary" data-testid="link-empty-start">Start a request</Link>} />}</section><section className="panel"><SectionTitle title="Recent activity" meta="A quiet, chronological pulse" />{activities.length ? <div className="space-y-4">{activities.slice(0, 5).map((item: any) => <div className="activity-row" key={item.id}><div className={cn('activity-marker', `activity-${item.tone || 'teal'}`)}><Check size={12} /></div><div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold">{item.label}</div><div className="truncate text-xs text-muted-foreground">{item.detail}</div></div><span className="whitespace-nowrap text-[11px] text-muted-foreground">{item.time}</span></div>)}</div> : <EmptyState icon={History} title="No recent activity" description="System events will settle here as work moves through the network." />}</section></div>
    </>}
  </div>;
}

function AppointmentRow({ appointment, onClick }: { appointment: any; onClick: () => void }) {
  return <button className="appointment-row" onClick={onClick} data-testid={`button-appointment-${appointment.id}`}><div className="date-tile"><span>{new Date(appointment.date).toLocaleDateString('en-US', { weekday: 'short' })}</span><strong>{new Date(appointment.date).getDate()}</strong></div><div className="min-w-0 flex-1 text-left"><div className="truncate text-sm font-bold">{appointment.patientName}</div><div className="mt-1 truncate text-xs text-muted-foreground">{appointment.doctorName} · {appointment.specialty}</div></div><div className="hidden text-right sm:block"><div className="text-sm font-semibold">{prettyTime(appointment.time)}</div><div className="mt-1 text-[11px] text-muted-foreground">{appointment.type}</div></div><StatusBadge value={appointment.verificationStatus || appointment.status} /><ArrowRight size={15} className="text-muted-foreground" /></button>;
}

function AssistantPage({ data, compact = false }: { data: AppDataValue; compact?: boolean }) {
  const [message, setMessage] = useState('');
  const [conversationId, setConversationId] = useState(`careflow-${Date.now()}`);
  const [chat, setChat] = useState<Array<{ role: string; text: string }>>([{ role: 'assistant', text: 'Tell me what kind of care you are looking for. I will check the right hospital team and only show times we can verify.' }]);
  const [selectedSlot, setSelectedSlot] = useState<any>();
  const sendMessage = (text: string) => {
    const next = text.trim();
    if (!next || data.mutations.ai.isPending) return;
    setMessage('');
    setChat((current) => [...current, { role: 'user', text: next }]);
    data.mutations.ai.mutate({ data: { message: next, conversationId, hospitalId: data.hospitalId, selectedDoctorId: null, selectedSlotId: selectedSlot?.id ?? null } }, {
      onSuccess: (result: any) => { setConversationId(result.conversationId); setChat(result.messages?.map((item: any) => ({ role: item.role, text: item.text })) ?? [...chat, { role: 'assistant', text: result.reply }]); },
    });
  };
  const suggested = data.mutations.ai.data?.suggestedSlots?.length ? data.mutations.ai.data.suggestedSlots : data.availability;
  const bookSlot = () => {
    if (!selectedSlot || !data.doctors[0]) return;
    data.mutations.book.mutate({ data: { hospitalId: data.hospitalId, doctorId: selectedSlot.doctorId || data.doctors[0].id, slotId: selectedSlot.id, patientName: 'Jordan Chen', appointmentType: selectedSlot.type || 'Consultation' } }, {
      onSuccess: () => { data.invalidate(); },
    });
  };
  return <div className={cn('animate-enter', compact && 'assistant-compact')}><PageHeader eyebrow="Patient access agent" title={compact ? 'Ask for the care you need' : 'Access assistant'} description={compact ? 'A structured conversation, not a chatbot promise.' : 'The assistant gathers intent, clarifies safely, and offers only bookable, verifiable care.'} actions={!compact && <Link href="/patient" className="button button-secondary" data-testid="link-patient-dashboard"><UserRound size={15} /> Patient dashboard</Link>} />
    <div className="grid gap-6 xl:grid-cols-[1fr_350px]"><section className="assistant-panel"><div className="assistant-panel-head"><div><div className="flex items-center gap-2"><span className="assistant-orb"><Bot size={17} /></span><span className="font-bold">CareFlow access agent</span><span className="status-badge status-good">Structured</span></div><p className="mt-2 text-xs text-muted-foreground">Connected to {data.hospital?.shortName || 'the selected care network'} · clinical escalation stays human</p></div><span className="font-mono text-[10px] text-muted-foreground">{conversationId.slice(0, 18)}</span></div>
      <div className="chat-area">{chat.map((item, index) => <div className={cn('chat-row', item.role === 'user' && 'user')} key={`${item.role}-${index}`}><div className={cn('chat-avatar', item.role === 'user' ? 'user-avatar' : 'agent-avatar')}>{item.role === 'user' ? 'JC' : <Bot size={15} />}</div><div className={cn('chat-bubble', item.role === 'user' ? 'user-bubble' : 'agent-bubble')}><p>{item.text}</p>{item.role !== 'user' && index === chat.length - 1 && <div className="mt-3 flex flex-wrap gap-2"><button className="suggestion-chip" onClick={() => sendMessage('I need a cardiology appointment')} data-testid="button-suggest-cardiology">Cardiology</button><button className="suggestion-chip" onClick={() => sendMessage('I need a follow-up visit')} data-testid="button-suggest-followup">Follow-up visit</button><button className="suggestion-chip" onClick={() => sendMessage('Show me the earliest available time')} data-testid="button-suggest-earliest">Earliest availability</button></div>}</div></div>)}{data.mutations.ai.isPending && <div className="chat-row"><div className="chat-avatar agent-avatar"><Bot size={15} /></div><div className="chat-bubble agent-bubble"><div className="typing-dots"><span /><span /><span /></div></div></div>}</div>
      <form className="chat-composer" onSubmit={(event) => { event.preventDefault(); sendMessage(message); }}><input value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Describe what you need help with…" aria-label="Message the access assistant" data-testid="input-assistant-message" /><button className="send-button" type="submit" disabled={!message.trim() || data.mutations.ai.isPending} aria-label="Send message" data-testid="button-send-message"><Send size={16} /></button></form><div className="px-5 pb-4 text-[10px] leading-4 text-muted-foreground"><LockKeyhole size={11} className="mr-1 inline" /> Do not use this space for emergencies. For urgent symptoms, call local emergency services.</div>
     </section><section className="space-y-5"><div className="panel"><SectionTitle title="Available next" meta="Times returned by the selected hospital" />{suggested.length ? <div className="space-y-2">{suggested.slice(0, 5).map((slot: any) => <button className={cn('slot-card', selectedSlot?.id === slot.id && 'selected')} onClick={() => setSelectedSlot(slot)} key={slot.id} data-testid={`button-slot-${slot.id}`}><div><div className="text-sm font-bold">{prettyDate(slot.date)}</div><div className="mt-1 text-xs text-muted-foreground">{prettyTime(slot.time)} · {slot.duration} min</div></div><div className="text-right"><div className="text-xs font-semibold text-primary">{slot.type || 'Consultation'}</div><div className="mt-1 text-[10px] text-muted-foreground">{selectedSlot?.id === slot.id ? 'Selected' : 'Select time'}</div></div></button>)}{selectedSlot && <button className="button button-primary mt-4 w-full justify-center" onClick={bookSlot} disabled={data.mutations.book.isPending} data-testid="button-confirm-booking">{data.mutations.book.isPending ? 'Verifying with hospital…' : <><BadgeCheck size={15} /> Verify & book this time</>}</button>} {!data.availability.length && <EmptyState icon={Clock3} title="Checking availability" description="Ask the agent for a specialty to reveal live slots." />}</div> : <EmptyState icon={Clock3} title="Checking availability" description="Ask the agent for a specialty to reveal live slots." />}</div><div className="safety-card"><ShieldCheck size={18} /><div><div className="text-sm font-bold">Safe by design</div><p className="mt-1 text-xs leading-5 text-muted-foreground">{data.mutations.ai.data?.safetyNote || 'Every booking is checked against a hospital record before it is shown as confirmed.'}</p></div></div></section></div>
  </div>;
}

function PatientPage({ data }: { data: AppDataValue }) {
  const questionnaire = data.questionnaire;
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const submit = () => data.mutations.submitQuestionnaire.mutate({ data: { answers } }, { onSuccess: () => { setSubmitted(true); data.invalidate(); } });
  return <div className="animate-enter"><PageHeader eyebrow="Patient dashboard" title="Your care, clearly held" description="Review verified visits, complete your pre-visit details, or start a new access request." actions={<Link href="/assistant" className="button button-primary" data-testid="link-patient-new-request"><MessageSquare size={15} /> New care request</Link>} /><div className="grid gap-6 xl:grid-cols-[1.25fr_.75fr]"><section className="panel"><SectionTitle title="Upcoming care" meta="Appointments verified with your hospital" />{data.appointments.length ? <div className="space-y-2">{data.appointments.slice(0, 4).map((appointment: any) => <AppointmentRow key={appointment.id} appointment={appointment} onClick={() => data.setSelectedAppointmentId(appointment.id)} />)}</div> : <EmptyState icon={CalendarDays} title="Nothing booked yet" description="Start with a short description of the care you need. CareFlow will ask only what is necessary." action={<Link href="/assistant" className="button button-primary" data-testid="link-patient-empty-request">Ask the access agent</Link>} />}</section><section className="panel"><SectionTitle title="Before your visit" meta="One small step for a smoother handoff" />{questionnaire ? <div><div className="questionnaire-progress"><div><div className="text-sm font-bold">{questionnaire.title}</div><div className="mt-1 text-xs text-muted-foreground">{questionnaire.description}</div></div><span className="font-mono text-xs text-primary">{questionnaire.questions?.filter((q: any) => answers[q.id] || q.answer).length || 0}/{questionnaire.questions?.length || 0}</span></div><div className="mt-5 space-y-4">{questionnaire.questions?.slice(0, 3).map((question: any) => <label className="question" key={question.id}><span>{question.label}{question.required && <b className="text-destructive"> *</b>}</span>{question.type === 'select' ? <select value={answers[question.id] ?? question.answer ?? ''} onChange={(event) => setAnswers({ ...answers, [question.id]: event.target.value })} data-testid={`select-question-${question.id}`}><option value="">Choose an answer</option>{question.options?.map((option: string) => <option key={option} value={option}>{option}</option>)}</select> : <input value={answers[question.id] ?? question.answer ?? ''} onChange={(event) => setAnswers({ ...answers, [question.id]: event.target.value })} placeholder="Your answer" data-testid={`input-question-${question.id}`} />}</label>)}</div><button className="button button-primary mt-5 w-full justify-center" onClick={submit} disabled={data.mutations.submitQuestionnaire.isPending || submitted} data-testid="button-submit-questionnaire">{submitted ? <><Check size={15} /> Submitted for review</> : data.mutations.submitQuestionnaire.isPending ? 'Saving securely…' : <><ClipboardCheck size={15} /> Submit questionnaire</>}</button></div> : <EmptyState icon={ClipboardCheck} title="Questionnaire loading" description="Your pre-visit details will appear here when they are assigned." />}</section></div></div>;
}

function AppointmentsPage({ data }: { data: AppDataValue }) {
  const detail = data.appointmentDetail;
  const [filter, setFilter] = useState('All');
  const rows = data.appointments.filter((item: any) => filter === 'All' || item.status === filter || item.verificationStatus === filter);
  return <div className="animate-enter"><PageHeader eyebrow="Care coordination" title="Appointments" description="A verified schedule with the external record status beside it." actions={<Link href="/assistant" className="button button-primary" data-testid="link-appointments-new"><MessageSquare size={15} /> New request</Link>} /><div className="filter-bar"><div className="flex items-center gap-2 text-xs font-bold text-muted-foreground"><Search size={14} /> Showing</div>{['All', 'Confirmed', 'Pending', 'Needs review'].map((item) => <button className={cn('filter-pill', filter === item && 'active')} onClick={() => setFilter(item)} key={item} data-testid={`button-filter-${item.toLowerCase().replaceAll(' ', '-')}`}>{item}</button>)}<span className="ml-auto text-xs text-muted-foreground">{rows.length} records</span></div><div className="grid gap-6 xl:grid-cols-[1fr_380px]"><section className="panel overflow-hidden p-0"><div className="table-head"><span>Patient & care team</span><span>Time</span><span>Verification</span><span>Record</span><span /></div>{rows.length ? <div>{rows.map((appointment: any) => <button className={cn('table-row', data.selectedAppointmentId === appointment.id && 'selected')} key={appointment.id} onClick={() => data.setSelectedAppointmentId(appointment.id)} data-testid={`button-open-appointment-${appointment.id}`}><div className="min-w-0"><div className="truncate text-sm font-bold">{appointment.patientName}</div><div className="mt-1 truncate text-xs text-muted-foreground">{appointment.doctorName} · {appointment.specialty}</div></div><div><div className="text-sm font-semibold">{prettyDate(appointment.date)}</div><div className="mt-1 text-xs text-muted-foreground">{prettyTime(appointment.time)}</div></div><StatusBadge value={appointment.verificationStatus} /><StatusBadge value={appointment.synchronizationStatus || appointment.externalStatus} /><ArrowRight size={15} className="text-muted-foreground" /></button>)}</div> : <EmptyState icon={CalendarDays} title="No appointments match" description="Try another filter or create a new verified request." />}</section>{detail ? <AppointmentDetail detail={detail} onClose={() => data.setSelectedAppointmentId('')} /> : <div className="panel flex min-h-[320px] items-center justify-center"><EmptyState icon={FileCheck2} title="Select an appointment" description="Open a row to inspect its verification and external synchronization trail." /></div>}</div></div>;
}

function AppointmentDetail({ detail, onClose }: { detail: any; onClose: () => void }) {
  const appointment = detail.appointment;
  return <aside className="panel detail-panel"><div className="flex items-start justify-between"><div><div className="eyebrow">Appointment detail</div><h2 className="mt-1 font-display text-xl font-bold">{appointment.patientName}</h2><p className="mt-1 text-xs text-muted-foreground">{appointment.doctorName} · {appointment.specialty}</p></div><button className="icon-button" onClick={onClose} aria-label="Close appointment detail" data-testid="button-close-appointment"><X size={16} /></button></div><div className="detail-date"><CalendarDays size={17} /><div><div className="text-sm font-bold">{prettyDate(appointment.date)} at {prettyTime(appointment.time)}</div><div className="mt-1 text-xs text-muted-foreground">{appointment.type}</div></div></div><div className="detail-statuses"><div><span>Verification</span><StatusBadge value={appointment.verificationStatus} /></div><div><span>External record</span><StatusBadge value={appointment.externalStatus} /></div><div><span>Synchronization</span><StatusBadge value={appointment.synchronizationStatus} /></div></div><div className="mt-7"><SectionTitle title="Operation trail" meta={`Correlation ${appointment.correlationId}`} /><div className="timeline">{detail.timeline?.map((event: any) => <div className="timeline-item" key={event.id}><div className={cn('timeline-dot', statusTone(event.status))}>{event.status?.toLowerCase().includes('success') || event.status?.toLowerCase().includes('complete') ? <Check size={11} /> : <Clock3 size={11} />}</div><div className="min-w-0"><div className="text-xs font-bold">{event.label}</div><div className="mt-1 text-[11px] leading-4 text-muted-foreground">{event.detail}</div><div className="mt-1 font-mono text-[10px] text-muted-foreground">{event.timestamp}</div></div></div>)}</div></div></aside>;
}

function DoctorPage({ data }: { data: AppDataValue }) {
  const pending = data.appointments.filter((item: any) => item.questionnaireStatus && item.questionnaireStatus !== 'complete');
  return <div className="animate-enter"><PageHeader eyebrow="Clinician workspace" title="Good morning, Dr. Rivera" description="Review only what needs clinical attention. Access operations stay out of the way." actions={<button className="button button-secondary" onClick={() => data.queries.appointmentsQuery.refetch()} data-testid="button-refresh-doctor"><RefreshCcw size={15} /> Refresh queue</button>} /><div className="metric-grid">{<MetricCard label="Patients today" value={data.appointments.length || '—'} change="Across your schedule" icon={CalendarDays} tone="teal" />}<MetricCard label="Questionnaires to review" value={pending.length || '0'} change={pending.length ? 'Needs your attention' : 'All caught up'} icon={ClipboardCheck} tone="gold" /><MetricCard label="Next available" value={data.doctors[0]?.nextAvailable ? prettyTime(data.doctors[0].nextAvailable) : '—'} change={data.doctors[0]?.specialty || 'Care team'} icon={Clock3} tone="blue" /></div><div className="mt-6 grid gap-6 xl:grid-cols-[1fr_.8fr]"><section className="panel"><SectionTitle title="Today’s schedule" meta="Verified appointments with patient context" />{data.appointments.length ? <div className="space-y-2">{data.appointments.map((appointment: any) => <AppointmentRow key={appointment.id} appointment={appointment} onClick={() => data.setSelectedAppointmentId(appointment.id)} />)}</div> : <EmptyState title="Schedule is clear" description="New verified appointments will surface here with a complete audit trail." />}</section><section className="panel"><SectionTitle title="Questionnaire review" meta="Pre-visit context ready for you" />{pending.length ? pending.slice(0, 3).map((appointment: any) => <div className="review-row" key={appointment.id}><div className="avatar bg-secondary text-primary">{initials(appointment.patientName)}</div><div className="min-w-0 flex-1"><div className="truncate text-sm font-bold">{appointment.patientName}</div><div className="mt-1 text-xs text-muted-foreground">{appointment.specialty} · {appointment.questionnaireStatus}</div></div><button className="button button-small button-secondary" onClick={() => data.setSelectedAppointmentId(appointment.id)} data-testid={`button-review-${appointment.id}`}>Review</button></div>) : <EmptyState icon={BadgeCheck} title="No reviews waiting" description="Completed questionnaires will be marked here for the care team." />}</section></div></div>;
}

function AdminPage({ data }: { data: AppDataValue }) {
  const [recovery, setRecovery] = useState<any>();
  const runRecovery = () => data.mutations.failure.mutate({ data: { hospitalId: data.hospitalId } }, { onSuccess: (result: any) => { setRecovery(result); data.invalidate(); } });
  return <div className="animate-enter"><PageHeader eyebrow="Hospital operations" title={data.hospital?.name || 'Hospital operations'} description="Keep access moving across the hospital without losing the why behind each decision." actions={<button className="button button-secondary" onClick={runRecovery} disabled={data.mutations.failure.isPending} data-testid="button-run-timeout-simulation"><Zap size={15} /> {data.mutations.failure.isPending ? 'Running recovery…' : 'Simulate EHR timeout'}</button>} /><div className="integration-banner"><div className="integration-icon"><Database size={19} /></div><div className="flex-1"><div className="flex flex-wrap items-center gap-2"><span className="font-bold">EHR connection</span><StatusBadge value={data.hospital?.integrationStatus || 'Connected'} /></div><p className="mt-1 text-xs text-muted-foreground">Last heartbeat 28 seconds ago · reconciliation is automatic when an external system pauses.</p></div><span className="font-mono text-xs text-muted-foreground">FHIR / R4</span></div><div className="metric-grid mt-6">{(data.overview?.metrics ?? []).slice(0, 4).map((metric: any, index: number) => <MetricCard key={metric.label} label={metric.label} value={metric.value} change={metric.change} icon={[Activity, BadgeCheck, Clock3, UsersRound][index]} tone={['teal', 'gold', 'blue', 'coral'][index]} />)}</div><div className="mt-6 grid gap-6 xl:grid-cols-[.85fr_1.15fr]"><section className="panel"><SectionTitle title="Hospital snapshot" meta="A quick operating brief" /><div className="info-list"><div><span>Location</span><strong>{data.hospital?.address || data.hospital?.city || '—'}</strong></div><div><span>Connected doctors</span><strong>{data.hospital?.doctors ?? data.doctors.length}</strong></div><div><span>Next appointment</span><strong>{prettyDate(data.hospital?.nextAppointment)}</strong></div><div><span>Workspace status</span><StatusBadge value={data.hospital?.status || 'Active'} /></div></div></section><section className="panel"><SectionTitle title="Recovery console" meta="Visible failure handling, not hidden magic" />{recovery ? <div className="recovery-result"><div className="flex items-center gap-3"><div className="recovery-check"><Check size={17} /></div><div><div className="font-bold">Timeout reconciled safely</div><div className="mt-1 text-xs text-muted-foreground">{recovery.classification} · {recovery.retryCount} retry · final state {recovery.finalState}</div></div></div><div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4"><MiniStatus label="External" value={recovery.externalStatus} /><MiniStatus label="Verified" value={recovery.verificationStatus} /><MiniStatus label="Sync" value={recovery.synchronizationStatus} /><MiniStatus label="Operation" value={recovery.operationId?.slice(0, 10)} /></div></div> : <div className="recovery-empty"><div className="recovery-illustration"><RefreshCcw size={27} /></div><div className="font-display text-lg font-bold">A safe place to test the edge case</div><p className="mt-1 max-w-md text-sm leading-6 text-muted-foreground">Run the simulation to see how CareFlow classifies an EHR timeout, retries with the same correlation ID, and exposes the reconciliation trail.</p><button className="button button-secondary mt-4" onClick={runRecovery} data-testid="button-run-recovery-empty">Run recovery simulation <ArrowRight size={14} /></button></div>}</section></div></div>;
}
function MiniStatus({ label, value }: { label: string; value?: string }) { return <div className="mini-status"><div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{label}</div><div className="mt-1 truncate text-xs font-bold text-primary">{value || '—'}</div></div>; }

function PlatformPage({ data }: { data: AppDataValue }) {
  return <div className="animate-enter"><PageHeader eyebrow="Network command center" title="Platform view" description="A global read on hospital connectivity, care coverage, and trust signals." actions={<button className="button button-secondary" onClick={() => data.queries.overviewQuery.refetch()} data-testid="button-refresh-platform"><RefreshCcw size={15} /> Refresh network</button>} /><div className="metric-grid"><MetricCard label="Hospitals in network" value={data.hospitals.length || '—'} change="Approved care sites" icon={Building2} tone="teal" /><MetricCard label="Connected now" value={data.hospitals.filter((h: any) => statusTone(h.integrationStatus) === 'status-good').length || '—'} change="Integration heartbeat" icon={Cloud} tone="gold" /><MetricCard label="Care team members" value={data.doctors.length || '—'} change="Across this workspace" icon={UsersRound} tone="blue" /><MetricCard label="Audit coverage" value="100%" change="Every operation traceable" icon={ShieldCheck} tone="coral" /></div><section className="panel mt-6"><SectionTitle title="Hospital network" meta="Each site is ready for the same verified access workflow" /><div className="hospital-grid">{data.hospitals.length ? data.hospitals.map((hospital: any) => <div className="hospital-card" key={hospital.id}><div className="flex items-start justify-between"><div className="hospital-monogram" style={{ background: hospital.accent || 'hsl(var(--primary))' }}>{initials(hospital.shortName || hospital.name)}</div><StatusBadge value={hospital.integrationStatus} /></div><div className="mt-5 text-base font-bold">{hospital.name}</div><div className="mt-1 text-xs text-muted-foreground">{hospital.city} · {hospital.doctors} doctors</div><div className="mt-5 flex items-center justify-between border-t border-border pt-4"><span className="text-[11px] text-muted-foreground">Next appointment</span><span className="text-xs font-bold">{prettyDate(hospital.nextAppointment)}</span></div></div>) : <EmptyState icon={Building2} title="No hospitals connected" description="Approved sites will appear here once the network is configured." />}</div></section></div>;
}

function AnalyticsPage({ data }: { data: AppDataValue }) {
  const analytics = data.analytics;
  const max = Math.max(...(analytics?.weeklyVolume?.map((point: any) => point.value) ?? [1]));
  return <div className="animate-enter"><PageHeader eyebrow="Operational health" title="What the network is telling us" description="Signals that help teams decide where to focus next." actions={<button className="button button-secondary" onClick={() => data.queries.analyticsQuery.refetch()} data-testid="button-refresh-analytics"><RefreshCcw size={15} /> Refresh metrics</button>} />{analytics ? <><div className="metric-grid"><MetricCard label="Booking success" value={`${analytics.bookingSuccess}%`} change="Verified on first attempt" icon={BadgeCheck} tone="teal" /><MetricCard label="Verification rate" value={`${analytics.verificationRate}%`} change="External record confirmed" icon={ShieldCheck} tone="gold" /><MetricCard label="Median latency" value={`${analytics.medianLatency} ms`} change="Request to confirmation" icon={Clock3} tone="blue" /><MetricCard label="Utilization" value={`${analytics.utilization}%`} change="Available slots used" icon={Activity} tone="coral" /></div><div className="mt-6 grid gap-6 xl:grid-cols-[1.25fr_.75fr]"><section className="panel"><SectionTitle title="Weekly access volume" meta="Requests that entered the verified workflow" /><div className="bar-chart">{analytics.weeklyVolume?.map((point: any) => <div className="bar-column" key={point.label}><div className="bar-value">{point.value}</div><div className="bar-track"><div className="bar-fill" style={{ height: `${Math.max(8, (point.value / max) * 100)}%` }} /></div><div className="bar-label">{point.label}</div></div>)}</div></section><section className="panel"><SectionTitle title="Workflow status" meta="Where records are sitting right now" />{analytics.statusCounts?.map((point: any, index: number) => <div className="progress-row" key={point.label}><div className="flex items-center justify-between text-xs"><span className="font-semibold">{point.label}</span><span className="font-mono text-muted-foreground">{point.value}</span></div><div className="progress-track"><div className={cn('progress-fill', `fill-${index}`)} style={{ width: `${Math.min(100, point.value)}%` }} /></div></div>)}</section></div></> : <LoadingBlock />}</div>;
}

function AuditPage({ data }: { data: AppDataValue }) {
  return <div className="animate-enter"><PageHeader eyebrow="Trust & traceability" title="Audit trail" description="The complete operational record, from a patient phrase to a synchronized hospital record." actions={<button className="button button-secondary" onClick={() => { data.queries.auditQuery.refetch(); data.queries.workflowsQuery.refetch(); }} data-testid="button-refresh-audit"><RefreshCcw size={15} /> Refresh trail</button>} /><div className="grid gap-6 xl:grid-cols-[1fr_.8fr]"><section className="panel"><SectionTitle title="Audited events" meta={`${data.audit.length} events in the selected hospital`} />{data.audit.length ? <div className="audit-list">{data.audit.map((event: any) => <div className="audit-row" key={event.id}><div className={cn('audit-icon', statusTone(event.status))}>{event.action?.toLowerCase().includes('booking') ? <CalendarDays size={15} /> : event.action?.toLowerCase().includes('verify') ? <BadgeCheck size={15} /> : <Activity size={15} />}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="text-sm font-bold">{event.action}</span><StatusBadge value={event.status} /></div><div className="mt-1 truncate text-xs text-muted-foreground">{event.actor} · {event.resource}</div><div className="mt-2 font-mono text-[10px] text-muted-foreground">{event.correlationId} · {event.timestamp}</div></div></div>)}</div> : <EmptyState icon={History} title="Audit trail is quiet" description="Verified access events will be retained here as the network moves." />}</section><section className="panel"><SectionTitle title="Workflow executions" meta="Background work with a visible owner" />{data.workflows.length ? <div className="space-y-3">{data.workflows.map((workflow: any) => <div className="workflow-card" key={workflow.id}><div className="flex items-start justify-between gap-3"><div><div className="text-sm font-bold">{workflow.name}</div><div className="mt-1 text-xs text-muted-foreground">{workflow.trigger}</div></div><StatusBadge value={workflow.status} /></div><div className="mt-4 space-y-2">{workflow.steps?.map((step: any) => <div className="flex items-center gap-2 text-xs" key={step.label}><span className={cn('step-check', statusTone(step.status))}>{step.status?.toLowerCase().includes('complete') || step.status?.toLowerCase().includes('success') ? <Check size={10} /> : <Clock3 size={10} />}</span><span>{step.label}</span><span className="ml-auto text-muted-foreground">{step.status}</span></div>)}</div></div>)}</div> : <EmptyState icon={ListChecks} title="No workflow runs" description="Reconciliation and questionnaire workflows will appear here." />}</section></div></div>;
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) { const [location] = useLocation(); return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>; }

function Router() {
  return <AppData>{(data) => <Shell data={data}><RoutedErrorBoundary><Switch>
    <Route path="/"><OverviewPage data={data} /></Route>
    <Route path="/patient"><PatientPage data={data} /></Route>
    <Route path="/assistant"><AssistantPage data={data} /></Route>
    <Route path="/appointments"><AppointmentsPage data={data} /></Route>
    <Route path="/doctor"><DoctorPage data={data} /></Route>
    <Route path="/admin"><AdminPage data={data} /></Route>
    <Route path="/platform"><PlatformPage data={data} /></Route>
    <Route path="/analytics"><AnalyticsPage data={data} /></Route>
    <Route path="/audit"><AuditPage data={data} /></Route>
    <Route component={NotFound} />
  </Switch></RoutedErrorBoundary></Shell>}</AppData>;
}

function App() { return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Router /></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>; }
export default App;