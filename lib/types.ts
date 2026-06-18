export const roles = [
  "super_admin",
  "national_admin",
  "provincial_admin",
  "school_owner",
  "instructor",
] as const;

export type UserRole = (typeof roles)[number];
export const publicRegistrationRoles = ["provincial_admin", "school_owner", "instructor"] as const satisfies readonly UserRole[];

export type ApprovalStatus = "pending" | "approved" | "rejected";

export type Profile = {
  id: string;
  email: string;
  full_name: string;
  requested_role: UserRole;
  role: UserRole | null;
  approval_status: ApprovalStatus;
  province_id: string | null;
  school_id: string | null;
  rejection_reason: string | null;
  created_at: string;
};

export type Organisation = {
  id: string;
  name: string;
  slug: string;
};

export type Province = {
  id: string;
  organisation_id?: string;
  name: string;
  code: string;
  created_at?: string;
  school_count?: number;
  student_count?: number;
  active_student_count?: number;
};

export type School = {
  id: string;
  province_id: string;
  name: string;
  registration_number: string | null;
  city: string | null;
  address: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  logo_url: string | null;
  affiliation_status: string;
  provinces?: Pick<Province, "name" | "code"> | null;
  student_count?: number;
  male_student_count?: number;
  female_student_count?: number;
  little_dragons_count?: number;
  karate_kids_count?: number;
  teens_adults_count?: number;
  race_counts?: Record<string, number>;
  outstanding_compliance_count?: number;
  expired_compliance_count?: number;
  submitted_compliance_count?: number;
  instructor_count?: number;
};

export type Student = {
  id: string;
  school_id: string;
  instructor_id: string | null;
  first_name: string;
  last_name: string;
  date_of_birth: string | null;
  gender: string | null;
  race: string | null;
  belt_rank: string | null;
  membership_status: string;
  schools?: Pick<School, "name"> | null;
};

export type ComplianceRequirement = {
  id: string;
  name: string;
  description: string | null;
  category: string;
  applies_to: string;
  renewal_period_months: number | null;
  active: boolean;
};

export type Tournament = {
  id: string;
  province_id: string | null;
  name: string;
  venue: string | null;
  starts_at: string;
  ends_at: string | null;
  registration_closes_at: string | null;
  provinces?: Pick<Province, "name" | "code"> | null;
};

export type TournamentEntry = {
  id: string;
  tournament_id: string;
  student_id: string;
  school_id: string;
  category: string | null;
  result_label: string | null;
  medal: string | null;
  points: number | null;
  status: string;
  students?: Pick<Student, "first_name" | "last_name" | "belt_rank"> | null;
  schools?: Pick<School, "name"> | null;
  tournaments?: Pick<Tournament, "name"> | null;
};

export type Event = {
  id: string;
  province_id: string | null;
  school_id: string | null;
  title: string;
  event_type: string;
  description: string | null;
  venue: string | null;
  starts_at: string;
  ends_at: string | null;
  capacity: number | null;
  status: string;
  provinces?: Pick<Province, "name" | "code"> | null;
  schools?: Pick<School, "name"> | null;
  booking_count?: number;
};

export type EventBooking = {
  id: string;
  event_id: string;
  profile_id: string | null;
  school_id: string | null;
  student_id?: string | null;
  instructor_id?: string | null;
  attendee_name: string;
  attendee_email: string | null;
  attendee_phone: string | null;
  attendee_type: string | null;
  notes: string | null;
  status: string;
  created_at: string;
  events?: Pick<Event, "title" | "starts_at"> | null;
  schools?: Pick<School, "name"> | null;
  students?: Pick<Student, "first_name" | "last_name"> | null;
  instructors?: Pick<Instructor, "full_name"> | null;
};

export type Instructor = {
  id: string;
  profile_id: string | null;
  school_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  certification_level: string | null;
  rank: string | null;
  collar_level: string | null;
  certification_date: string | null;
  training_status: string;
  training_expires_at: string | null;
  active: boolean;
  schools?: Pick<School, "name"> | null;
};

export type ComplianceDocument = {
  id: string;
  school_id: string | null;
  instructor_id: string | null;
  student_id: string | null;
  requirement_id: string | null;
  document_name: string;
  storage_path: string | null;
  file_name: string | null;
  file_type: string | null;
  file_size: number | null;
  status: string;
  expires_at: string | null;
  compliance_requirements?: Pick<ComplianceRequirement, "name" | "category"> | null;
  schools?: Pick<School, "name"> | null;
  instructors?: Pick<Instructor, "full_name"> | null;
  students?: Pick<Student, "first_name" | "last_name"> | null;
};

export type PortalDocument = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  storage_path: string;
  file_name: string;
  file_type: string | null;
  file_size: number | null;
  active: boolean;
  created_at: string;
  signed_url?: string;
};

export type SchoolOrderItem = {
  id: string;
  order_id: string;
  catalog_item_id: string;
  section: string;
  item: string;
  size: string | null;
  quantity: number;
  currency: string;
  instructor_price: number | null;
  student_price: number | null;
  line_total: number;
  note: string | null;
  special_order: boolean;
};

export type SchoolOrder = {
  id: string;
  school_id: string;
  submitted_by: string | null;
  contact_name: string | null;
  contact_email: string | null;
  notes: string | null;
  status: string;
  admin_notes: string | null;
  total_zar: number;
  total_usd: number;
  created_at: string;
  schools?: Pick<School, "name" | "contact_email"> | null;
  school_order_items?: SchoolOrderItem[];
};

export type OrderCatalogItem = {
  id: string;
  section: string;
  item: string;
  size: string | null;
  instructor_price: number | null;
  student_price: number | null;
  currency: "ZAR" | "USD";
  note: string | null;
  special_order: boolean;
  in_stock: boolean;
  active: boolean;
  sort_order: number;
};
