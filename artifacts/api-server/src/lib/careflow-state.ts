export type Role = "PLATFORM_ADMIN" | "HOSPITAL_ADMIN" | "DOCTOR" | "PATIENT";

export type Hospital = {
  id: string;
  name: string;
  shortName: string;
  city: string;
  address: string;
  status: string;
  integrationStatus: string;
  doctors: number;
  nextAppointment: string;
  accent: string;
};

export type Doctor = {
  id: string;
  hospitalId: string;
  name: string;
  specialty: string;
  department: string;
  qualifications: string;
  languages: string[];
  status: string;
  nextAvailable: string;
  avatar: string;
  experience: number;
};

export type Slot = {
  id: string;
  doctorId: string;
  date: string;
  time: string;
  duration: number;
  type: string;
  status: string;
};

export type Appointment = {
  id: string;
  hospitalId: string;
  patientName: string;
  doctorName: string;
  specialty: string;
  date: string;
  time: string;
  type: string;
  status: string;
  externalStatus: string;
  verificationStatus: string;
  synchronizationStatus: string;
  correlationId: string;
  externalId: string | null;
  questionnaireStatus: string;
  createdAt: string;
  doctorId: string;
};

export type TimelineEvent = {
  id: string;
  label: string;
  detail: string;
  status: string;
  timestamp: string;
  operationId: string | null;
};

export type AuditEvent = {
  id: string;
  action: string;
  actor: string;
  resource: string;
  status: string;
  timestamp: string;
  correlationId: string;
  hospitalId: string;
};

export type WorkflowExecution = {
  id: string;
  name: string;
  trigger: string;
  status: string;
  scheduledFor: string;
  completedAt: string | null;
  steps: { label: string; status: string }[];
  hospitalId: string;
};

const dayKey = (offset: number) => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
};

const displayDay = (offset: number) =>
  new Intl.DateTimeFormat("en-IN", { weekday: "short", month: "short", day: "numeric" }).format(
    new Date(`${dayKey(offset)}T12:00:00`),
  );

export const hospitals: Hospital[] = [
  {
    id: "hospital-a",
    name: "Northstar Medical Center",
    shortName: "Northstar",
    city: "Bengaluru",
    address: "18 Richmond Road, Bengaluru 560025",
    status: "APPROVED",
    integrationStatus: "HEALTHY",
    doctors: 4,
    nextAppointment: displayDay(1),
    accent: "teal",
  },
  {
    id: "hospital-b",
    name: "Harborview Specialty Hospital",
    shortName: "Harborview",
    city: "Hyderabad",
    address: "42 Jubilee Hills, Hyderabad 500033",
    status: "APPROVED",
    integrationStatus: "HEALTHY",
    doctors: 3,
    nextAppointment: displayDay(2),
    accent: "indigo",
  },
];

export const doctors: Doctor[] = [
  {
    id: "dr-rao",
    hospitalId: "hospital-a",
    name: "Dr. Anika Rao",
    specialty: "Orthopedics",
    department: "Musculoskeletal Care",
    qualifications: "MBBS, MS (Ortho), FRCS",
    languages: ["English", "Hindi", "Kannada"],
    status: "ACTIVE",
    nextAvailable: displayDay(1),
    avatar: "AR",
    experience: 14,
  },
  {
    id: "dr-mehta",
    hospitalId: "hospital-a",
    name: "Dr. Vikram Mehta",
    specialty: "Sports Medicine",
    department: "Rehabilitation & Sports",
    qualifications: "MBBS, DNB (Sports Medicine)",
    languages: ["English", "Hindi"],
    status: "ACTIVE",
    nextAvailable: displayDay(1),
    avatar: "VM",
    experience: 11,
  },
  {
    id: "dr-shah",
    hospitalId: "hospital-a",
    name: "Dr. Priya Shah",
    specialty: "Physiotherapy",
    department: "Rehabilitation & Sports",
    qualifications: "MPT, Certified Ergonomics Specialist",
    languages: ["English", "Hindi", "Gujarati"],
    status: "ACTIVE",
    nextAvailable: displayDay(2),
    avatar: "PS",
    experience: 9,
  },
  {
    id: "dr-iyer",
    hospitalId: "hospital-a",
    name: "Dr. Rohan Iyer",
    specialty: "General Medicine",
    department: "Primary Care",
    qualifications: "MBBS, MD (Internal Medicine)",
    languages: ["English", "Tamil", "Kannada"],
    status: "ACTIVE",
    nextAvailable: displayDay(1),
    avatar: "RI",
    experience: 16,
  },
  {
    id: "dr-wilson",
    hospitalId: "hospital-b",
    name: "Dr. Leah Wilson",
    specialty: "Orthopedics",
    department: "Bone & Joint Center",
    qualifications: "MBBS, MS (Ortho), FRCS",
    languages: ["English", "Telugu"],
    status: "ACTIVE",
    nextAvailable: displayDay(2),
    avatar: "LW",
    experience: 17,
  },
  {
    id: "dr-reddy",
    hospitalId: "hospital-b",
    name: "Dr. Arjun Reddy",
    specialty: "Cardiology",
    department: "Heart Institute",
    qualifications: "MBBS, MD, DM (Cardiology)",
    languages: ["English", "Telugu", "Hindi"],
    status: "ACTIVE",
    nextAvailable: displayDay(3),
    avatar: "AR",
    experience: 20,
  },
  {
    id: "dr-kapoor",
    hospitalId: "hospital-b",
    name: "Dr. Neha Kapoor",
    specialty: "Dermatology",
    department: "Skin & Aesthetics",
    qualifications: "MBBS, MD (Dermatology)",
    languages: ["English", "Hindi"],
    status: "ACTIVE",
    nextAvailable: displayDay(2),
    avatar: "NK",
    experience: 8,
  },
];

const seedTimes = ["09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00", "12:30", "14:00", "14:30", "15:00", "15:30", "16:00"];

export const slots: Slot[] = doctors.flatMap((doctor) =>
  Array.from({ length: 6 }, (_, offset) =>
    seedTimes.map((time, index) => ({
      id: `${doctor.id}-${dayKey(offset + 1)}-${time.replace(":", "")}`,
      doctorId: doctor.id,
      date: dayKey(offset + 1),
      time,
      duration: 30,
      type: index % 4 === 0 ? "In-person consultation" : "Clinic consultation",
      status: "AVAILABLE",
    })),
  ).flat(),
);

const initialDate = dayKey(1);
const initialSlot = slots.find((slot) => slot.doctorId === "dr-rao" && slot.date === initialDate && slot.time === "10:30");

export const appointments: Appointment[] = [
  {
    id: "apt-2048",
    hospitalId: "hospital-a",
    patientName: "Maya Nair",
    doctorName: "Dr. Anika Rao",
    specialty: "Orthopedics",
    date: initialDate,
    time: "10:30",
    type: "In-person consultation",
    status: "CONFIRMED",
    externalStatus: "VERIFIED",
    verificationStatus: "VERIFIED",
    synchronizationStatus: "SYNCHRONIZED",
    correlationId: "corr-8f31b2",
    externalId: "NSMC-EXT-98431",
    questionnaireStatus: "ASSIGNED",
    createdAt: new Date(Date.now() - 1000 * 60 * 28).toISOString(),
    doctorId: "dr-rao",
  },
  {
    id: "apt-2032",
    hospitalId: "hospital-b",
    patientName: "Ravi Menon",
    doctorName: "Dr. Leah Wilson",
    specialty: "Orthopedics",
    date: dayKey(2),
    time: "14:00",
    type: "In-person consultation",
    status: "CONFIRMED",
    externalStatus: "VERIFIED",
    verificationStatus: "VERIFIED",
    synchronizationStatus: "SYNCHRONIZED",
    correlationId: "corr-31d90a",
    externalId: "HSH-EXT-74012",
    questionnaireStatus: "COMPLETED",
    createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    doctorId: "dr-wilson",
  },
  {
    id: "apt-1984",
    hospitalId: "hospital-a",
    patientName: "Arjun Pillai",
    doctorName: "Dr. Rohan Iyer",
    specialty: "General Medicine",
    date: dayKey(-2),
    time: "09:00",
    type: "Video consultation",
    status: "COMPLETED",
    externalStatus: "VERIFIED",
    verificationStatus: "VERIFIED",
    synchronizationStatus: "SYNCHRONIZED",
    correlationId: "corr-83d110",
    externalId: "NSMC-EXT-97108",
    questionnaireStatus: "COMPLETED",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(),
    doctorId: "dr-iyer",
  },
];

if (initialSlot) initialSlot.status = "BOOKED";
const secondSeedSlot = slots.find((slot) => slot.doctorId === "dr-wilson" && slot.date === dayKey(2) && slot.time === "14:00");
if (secondSeedSlot) secondSeedSlot.status = "BOOKED";

export const auditEvents: AuditEvent[] = [
  { id: "audit-1", action: "EXTERNAL_VERIFICATION_COMPLETED", actor: "system / verifier", resource: "Appointment apt-2048", status: "SUCCESS", timestamp: new Date(Date.now() - 1000 * 60 * 6).toISOString(), correlationId: "corr-8f31b2", hospitalId: "hospital-a" },
  { id: "audit-2", action: "QUESTIONNAIRE_ASSIGNED", actor: "workflow / pre-visit", resource: "Appointment apt-2048", status: "SUCCESS", timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(), correlationId: "corr-8f31b2", hospitalId: "hospital-a" },
  { id: "audit-3", action: "CAPABILITY_EXECUTED", actor: "patient-access-agent", resource: "check_availability", status: "SUCCESS", timestamp: new Date(Date.now() - 1000 * 60 * 8).toISOString(), correlationId: "corr-8f31b2", hospitalId: "hospital-a" },
  { id: "audit-4", action: "EHR_OPERATION_COMPLETED", actor: "mock-healthcare-connector", resource: "create_appointment", status: "SUCCESS", timestamp: new Date(Date.now() - 1000 * 60 * 9).toISOString(), correlationId: "corr-31d90a", hospitalId: "hospital-b" },
  { id: "audit-5", action: "HOSPITAL_APPROVED", actor: "platform admin", resource: "Harborview Specialty Hospital", status: "SUCCESS", timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), correlationId: "corr-onboard-19", hospitalId: "hospital-b" },
];

export const workflows: WorkflowExecution[] = [
  {
    id: "workflow-1",
    name: "Appointment confirmed",
    trigger: "appointment.confirmed",
    status: "COMPLETED",
    scheduledFor: new Date(Date.now() - 1000 * 60 * 4).toISOString(),
    completedAt: new Date(Date.now() - 1000 * 60 * 3).toISOString(),
    hospitalId: "hospital-a",
    steps: [
      { label: "Questionnaire assigned", status: "COMPLETED" },
      { label: "Reminder scheduled", status: "COMPLETED" },
      { label: "Patient notification", status: "COMPLETED" },
      { label: "Doctor inbox updated", status: "COMPLETED" },
    ],
  },
  {
    id: "workflow-2",
    name: "Pre-visit reminder",
    trigger: "appointment.upcoming",
    status: "RUNNING",
    scheduledFor: new Date(Date.now() + 1000 * 60 * 60 * 18).toISOString(),
    completedAt: null,
    hospitalId: "hospital-a",
    steps: [
      { label: "Check appointment status", status: "COMPLETED" },
      { label: "Send reminder", status: "SCHEDULED" },
      { label: "Record delivery", status: "PENDING" },
    ],
  },
  {
    id: "workflow-3",
    name: "Questionnaire review",
    trigger: "questionnaire.completed",
    status: "COMPLETED",
    scheduledFor: new Date(Date.now() - 1000 * 60 * 31).toISOString(),
    completedAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    hospitalId: "hospital-b",
    steps: [
      { label: "Validate structured answers", status: "COMPLETED" },
      { label: "Notify doctor", status: "COMPLETED" },
    ],
  },
];

export const questionnaire = {
  id: "q-orthopedic-intake",
  title: "Orthopedic pre-visit intake",
  description: "A short administrative questionnaire to help the care team prepare for your visit. It does not provide a diagnosis.",
  status: "ASSIGNED",
  submittedAt: null as string | null,
  questions: [
    { id: "q1", label: "Which area would you like the doctor to focus on?", type: "choice", required: true, options: ["Shoulder", "Knee", "Back", "Other"], answer: null as string | null },
    { id: "q2", label: "When did you first notice this concern?", type: "choice", required: true, options: ["Today", "Within the last week", "More than a week ago"], answer: null as string | null },
    { id: "q3", label: "Would you like accessibility assistance at the hospital?", type: "yes/no", required: true, options: ["Yes", "No"], answer: null as string | null },
    { id: "q4", label: "Anything you would like the care team to know before the visit?", type: "long text", required: false, answer: null as string | null },
  ],
};

export const conversationMessages = new Map<string, { role: string; text: string; timestamp: string }[]>();

export function hospitalFor(id = "hospital-a") {
  return hospitals.find((hospital) => hospital.id === id) ?? hospitals[0];
}

export function doctorFor(id: string) {
  return doctors.find((doctor) => doctor.id === id);
}

export function slotsFor(doctorId: string, date: string) {
  return slots.filter((slot) => slot.doctorId === doctorId && slot.date === date && slot.status === "AVAILABLE");
}

export function timelineFor(appointment: Appointment): TimelineEvent[] {
  return [
    { id: "timeline-requested", label: "Appointment requested", detail: "Patient access agent created a request with an idempotency key.", status: "COMPLETED", timestamp: appointment.createdAt, operationId: `op-${appointment.id}-request` },
    { id: "timeline-scheduled", label: "Slot revalidated", detail: "Scheduling service confirmed the slot was still bookable before the external call.", status: "COMPLETED", timestamp: new Date(new Date(appointment.createdAt).getTime() + 420).toISOString(), operationId: `op-${appointment.id}-schedule` },
    { id: "timeline-ehr", label: "Mock EHR record created", detail: `External appointment ${appointment.externalId ?? "pending"} returned from the healthcare connector.`, status: "COMPLETED", timestamp: new Date(new Date(appointment.createdAt).getTime() + 860).toISOString(), operationId: `op-${appointment.id}-ehr` },
    { id: "timeline-verify", label: "External appointment verified", detail: "A second read confirmed the external record and provider mapping.", status: "COMPLETED", timestamp: new Date(new Date(appointment.createdAt).getTime() + 1120).toISOString(), operationId: `op-${appointment.id}-verify` },
    { id: "timeline-sync", label: "Internal state synchronized", detail: "Internal appointment transitioned to CONFIRMED and the questionnaire workflow was scheduled.", status: "COMPLETED", timestamp: new Date(new Date(appointment.createdAt).getTime() + 1480).toISOString(), operationId: `op-${appointment.id}-sync` },
  ];
}