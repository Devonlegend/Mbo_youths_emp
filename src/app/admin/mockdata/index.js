// ─────────────────────────────────────────────────────────────────────────────
// RMHCDT Admin Portal — Mock Data
// Field names match the real backend exactly.
// Replace each section with real API calls when ready.
//
// Backend endpoints:
//   GET /auth/me/              → currentAdmin
//   GET /students/             → students
//   GET /schemes/              → schemes
//   GET /applications/         → applications (admin sees all)
//   GET /applications/{id}/    → single application detail
//   POST /applications/{id}/review/ → approve or reject
// ─────────────────────────────────────────────────────────────────────────────


// ── CURRENT ADMIN USER ────────────────────────────────────────────────────────
// Source: GET /auth/me/
// Real fields: id, email, firstname, lastname, phone_number, role
export const currentAdmin = {
  id:           "uuid-admin-001",
  email:        "admin@rmhcdt.org",
  firstname:    "Joshua",
  lastname:     "Ita",
  phone_number: "08031234567",
  role:         "admin", // "admin" | "superadmin" | "verifier"
  avatar:       null,    // will use initials fallback
};


// ── SCHEMES ───────────────────────────────────────────────────────────────────
// Source: GET /schemes/
// Real fields match ScholarshipSchemeSerializer exactly
export const schemes = [
  {
    id:                      "uuid-scheme-001",
    provider:                "uuid-provider-001",
    name:                    "2026/2027 University Scholarship Award",
    award_type:              "scholarship",  // "scholarship" | "vocational" | "empowerment" | "grant"
    description:             "Financial support for secondary, tertiary, vocational, and professional studies. Covers tuition, exam fees, and educational materials.",
    academic_year:           "2026/2027",
    award_amount:            "500000.00",
    total_slots:             50,
    remaining_slots:         43,
    stacking_policy:         "major_only",  // "exclusive" | "major_only" | "open"
    eligibility_criteria:    { min_cgpa: 2.20, allowed_levels: ["200", "300", "400"] },
    application_open_date:   "2026-04-01",
    application_close_date:  "2026-06-15",
    is_active:               true,
    is_published:            true,
    created_at:              "2026-03-20T10:00:00Z",
    updated_at:              "2026-03-20T10:00:00Z",
  },
  {
    id:                      "uuid-scheme-002",
    provider:                "uuid-provider-001",
    name:                    "Youth Empowerment Starter Pack 2026",
    award_type:              "empowerment",
    description:             "Direct support to individuals or small groups to establish or expand income-generating activities.",
    academic_year:           "2026/2027",
    award_amount:            "250000.00",
    total_slots:             30,
    remaining_slots:         27,
    stacking_policy:         "major_only",
    eligibility_criteria:    { min_age: 18, max_age: 35 },
    application_open_date:   "2026-04-01",
    application_close_date:  "2026-06-01",
    is_active:               true,
    is_published:            true,
    created_at:              "2026-03-20T10:00:00Z",
    updated_at:              "2026-03-20T10:00:00Z",
  },
  {
    id:                      "uuid-scheme-003",
    provider:                "uuid-provider-001",
    name:                    "Digital Skills Training 2026",
    award_type:              "vocational",
    description:             "Structured skill development programme covering digital skills, vocational training, and capacity building.",
    academic_year:           "2026/2027",
    award_amount:            "0.00",
    total_slots:             100,
    remaining_slots:         84,
    stacking_policy:         "open",
    eligibility_criteria:    {},
    application_open_date:   "2026-04-01",
    application_close_date:  "2026-07-05",
    is_active:               true,
    is_published:            true,
    created_at:              "2026-03-20T10:00:00Z",
    updated_at:              "2026-03-20T10:00:00Z",
  },
  {
    id:                      "uuid-scheme-004",
    provider:                "uuid-provider-001",
    name:                    "2026 SME Business Startup Grant",
    award_type:              "grant",
    description:             "Financial awards for business start-up capital, project funding, and research support.",
    academic_year:           "2026/2027",
    award_amount:            "1000000.00",
    total_slots:             20,
    remaining_slots:         18,
    stacking_policy:         "exclusive",
    eligibility_criteria:    {},
    application_open_date:   "2026-04-01",
    application_close_date:  "2026-05-31",
    is_active:               false, // closed
    is_published:            true,
    created_at:              "2026-03-20T10:00:00Z",
    updated_at:              "2026-05-31T00:00:00Z",
  },
];


// ── STUDENTS ──────────────────────────────────────────────────────────────────
// Source: GET /students/
// Real fields match StudentSerializer exactly
// Note: StudentSerializer returns firstname/lastname (no underscore)
export const students = [
  {
    id:               "uuid-student-001",
    firstname:        "Emmanuel",
    lastname:         "Etim",
    email:            "e.etim@gmail.com",
    phone_number:     "08031234521",
    ward:             "Efiat",
    lga:              "Mbo LGA",
    level:            300,
    cgpa:             "4.21",
    is_verified:      true,
    active_award:     "",
    has_active_award: false,
    academic_records: [],
    date_of_birth:    "1998-04-12",
    gender:           "male",
    nin_hash:         "12345678901",
    created_at:       "2026-01-10T08:00:00Z",
  },
  {
    id:               "uuid-student-002",
    firstname:        "Blessing",
    lastname:         "Okon",
    email:            "b.okon@gmail.com",
    phone_number:     "08129876543",
    ward:             "Enwang I",
    lga:              "Mbo LGA",
    level:            400,
    cgpa:             "4.50",
    is_verified:      true,
    active_award:     "",
    has_active_award: false,
    academic_records: [],
    date_of_birth:    "2000-07-22",
    gender:           "female",
    nin_hash:         "98765432101",
    created_at:       "2026-01-12T08:00:00Z",
  },
  {
    id:               "uuid-student-003",
    firstname:        "Chukwu",
    lastname:         "Harrison",
    email:            "c.harrison@mail.com",
    phone_number:     "08031234522",
    ward:             "Ebughu I",
    lga:              "Mbo LGA",
    level:            200,
    cgpa:             "3.80",
    is_verified:      false,
    active_award:     "",
    has_active_award: false,
    academic_records: [],
    date_of_birth:    "2002-01-09",
    gender:           "male",
    nin_hash:         "11223344556",
    created_at:       "2026-01-15T08:00:00Z",
  },
  {
    id:               "uuid-student-004",
    firstname:        "Arit",
    lastname:         "Ekong",
    email:            "a.ekong@gmail.com",
    phone_number:     "08167890123",
    ward:             "Ibaka",
    lga:              "Mbo LGA",
    level:            500,
    cgpa:             "4.10",
    is_verified:      true,
    active_award:     "uuid-scheme-001",
    has_active_award: true,
    academic_records: [],
    date_of_birth:    "1999-11-30",
    gender:           "female",
    nin_hash:         "55667788990",
    created_at:       "2026-01-18T08:00:00Z",
  },
  {
    id:               "uuid-student-005",
    firstname:        "Mfoniso",
    lastname:         "Udoh",
    email:            "m.udoh@gmail.com",
    phone_number:     "08098765432",
    ward:             "Uda I",
    lga:              "Mbo LGA",
    level:            300,
    cgpa:             "3.60",
    is_verified:      false,
    active_award:     "",
    has_active_award: false,
    academic_records: [],
    date_of_birth:    "2001-05-17",
    gender:           "male",
    nin_hash:         "44332211009",
    created_at:       "2026-01-20T08:00:00Z",
  },
];


// ── APPLICATIONS ──────────────────────────────────────────────────────────────
// Source: GET /applications/
// Real fields match ApplicationSerializer exactly
// status values: "submitted" | "eligibility_check" | "double_dip_flag" |
//                "document_review" | "shortlisted" | "approved" |
//                "rejected" | "waiver_required" | "withdrawn" | "draft"
export const applications = [
  {
    id:                  "uuid-app-001",
    scheme_name:         "2026/2027 University Scholarship Award",
    scheme_category:     "scholarship",
    status:              "submitted",       // pending in UI
    submission_date:     "2026-05-14T10:23:00Z",
    rejection_reason:    "",
    reviewer_notes:      "",
    has_conflict:        false,
    waiver_submitted:    false,
    eligibility_passed:  true,
    created_at:          "2026-05-14T10:23:00Z",
    // Student info — available when admin views detail
    student: {
      id:           "uuid-student-001",
      firstname:    "Emmanuel",
      lastname:     "Etim",
      email:        "e.etim@gmail.com",
      lga:          "Mbo LGA",
      ward:         "Efiat",
    },
    // Form data — available once backend adds form_data field
    form_data: {
      institution:        "University of Uyo",
      level:              "Undergraduate",
      department:         "Computer Science",
      current_level:      "300",
      matric_number:      "UU/2022/001234",
      cgpa:               "4.21",
      declared_external:  "no",
      declaration_details: "",
      bank_name:          "Access Bank",
      account_number:     "0123456789",
      account_name:       "Emmanuel Etim",
    },
  },
  {
    id:                  "uuid-app-002",
    scheme_name:         "2026/2027 University Scholarship Award",
    scheme_category:     "scholarship",
    status:              "double_dip_flag", // flagged in UI
    submission_date:     "2026-05-15T11:00:00Z",
    rejection_reason:    "",
    reviewer_notes:      "",
    has_conflict:        true,
    waiver_submitted:    false,
    eligibility_passed:  false,
    created_at:          "2026-05-15T11:00:00Z",
    student: {
      id:           "uuid-student-002",
      firstname:    "Blessing",
      lastname:     "Okon",
      email:        "b.okon@gmail.com",
      lga:          "Mbo LGA",
      ward:         "Enwang I",
    },
    form_data: {
      institution:        "University of Calabar",
      level:              "Undergraduate",
      department:         "Nursing Science",
      current_level:      "400",
      matric_number:      "UNICAL/2020/002345",
      cgpa:               "4.50",
      declared_external:  "yes",
      declaration_details: "NDDC Scholarship, 2025",
      bank_name:          "GTBank",
      account_number:     "9876543210",
      account_name:       "Blessing Okon",
    },
  },
  {
    id:                  "uuid-app-003",
    scheme_name:         "Digital Skills Training 2026",
    scheme_category:     "vocational",
    status:              "approved",
    submission_date:     "2026-05-10T09:00:00Z",
    rejection_reason:    "",
    reviewer_notes:      "All documents verified. Applicant meets all criteria.",
    has_conflict:        false,
    waiver_submitted:    false,
    eligibility_passed:  true,
    created_at:          "2026-05-10T09:00:00Z",
    student: {
      id:           "uuid-student-003",
      firstname:    "Chukwu",
      lastname:     "Harrison",
      email:        "c.harrison@mail.com",
      lga:          "Mbo LGA",
      ward:         "Ebughu I",
    },
    form_data: {
      training_name:      "Web Development",
      education_level:    "BSc",
      prior_experience:   "Basic HTML and CSS from self-study.",
      career_goal:        "To become a full-stack developer.",
      availability:       "Full-time",
      declared_external:  "no",
      declaration_details: "",
    },
  },
  {
    id:                  "uuid-app-004",
    scheme_name:         "Youth Empowerment Starter Pack 2026",
    scheme_category:     "empowerment",
    status:              "rejected",
    submission_date:     "2026-05-08T14:00:00Z",
    rejection_reason:    "Applicant did not meet the residency requirement for Mbo LGA as of the 2026 cycle cut-off date.",
    reviewer_notes:      "Applicant did not meet the residency requirement for Mbo LGA as of the 2026 cycle cut-off date.",
    has_conflict:        false,
    waiver_submitted:    false,
    eligibility_passed:  false,
    created_at:          "2026-05-08T14:00:00Z",
    student: {
      id:           "uuid-student-004",
      firstname:    "Arit",
      lastname:     "Ekong",
      email:        "a.ekong@gmail.com",
      lga:          "Mbo LGA",
      ward:         "Ibaka",
    },
    form_data: {
      trade:              "Tailoring",
      current_status:     "Starting",
      support_needed:     "Industrial sewing machine and fabric stock.",
      equipment:          "Industrial sewing machine, Overlocker",
      business_location:  "Eket Market, Mbo LGA",
      declared_external:  "yes",
      declaration_details: "NDDC Grant, 2024",
    },
  },
  {
    id:                  "uuid-app-005",
    scheme_name:         "2026 SME Business Startup Grant",
    scheme_category:     "grant",
    status:              "submitted",       // pending in UI
    submission_date:     "2026-05-20T16:00:00Z",
    rejection_reason:    "",
    reviewer_notes:      "",
    has_conflict:        false,
    waiver_submitted:    false,
    eligibility_passed:  true,
    created_at:          "2026-05-20T16:00:00Z",
    student: {
      id:           "uuid-student-005",
      firstname:    "Mfoniso",
      lastname:     "Udoh",
      email:        "m.udoh@gmail.com",
      lga:          "Mbo LGA",
      ward:         "Uda I",
    },
    form_data: {
      grant_purpose:          "To purchase production equipment for a garment manufacturing business.",
      business_plan_desc:     "A garment manufacturing SME producing school uniforms and traditional attire.",
      amount_requested:       "500,000",
      expected_beneficiaries: "12 community members",
      declared_external:      "no",
      declaration_details:    "",
      bank_name:              "First Bank",
      account_number:         "3456789012",
      account_name:           "Mfoniso Udoh",
    },
  },
];


// ── BENEFICIARY REGISTER ──────────────────────────────────────────────────────
// Source: derived from applications where status === "approved"
// In production this will be a dedicated endpoint or filtered applications list
export const beneficiaries = applications
  .filter((a) => a.status === "approved")
  .map((a) => ({
    id:           a.id,
    student_id:   a.student.id,
    student_name: `${a.student.firstname} ${a.student.lastname}`,
    scheme_name:  a.scheme_name,
    category:     a.scheme_category,
    lga:          a.student.lga,
    ward:         a.student.ward,
    approved_at:  a.created_at,
    // reviewed_by will come from the real API
  }));


// ── DISQUALIFICATION REGISTER ─────────────────────────────────────────────────
// Source: derived from applications where status === "rejected"
// In production your backend will have a dedicated disqualifications register
export const disqualifications = applications
  .filter((a) => a.status === "rejected")
  .map((a) => ({
    id:              a.id,
    student_id:      a.student.id,
    student_name:    `${a.student.firstname} ${a.student.lastname}`,
    scheme_name:     a.scheme_name,
    rejection_reason: a.rejection_reason,
    reviewer_notes:  a.reviewer_notes,
    disqualified_at: a.created_at,
  }));


// ── AUDIT LOG ─────────────────────────────────────────────────────────────────
// Source: no dedicated endpoint yet — mock only
// When backend adds audit logging, replace with GET /audit-logs/
export const auditLog = [
  {
    id:          "uuid-log-001",
    admin_id:    currentAdmin.id,
    admin_name:  `${currentAdmin.firstname} ${currentAdmin.lastname}`,
    action:      "Approved application — Digital Skills Training 2026",
    entity_type: "Application",
    entity_id:   "uuid-app-003",
    timestamp:   "2026-05-22T09:23:00Z",
  },
  {
    id:          "uuid-log-002",
    admin_id:    currentAdmin.id,
    admin_name:  `${currentAdmin.firstname} ${currentAdmin.lastname}`,
    action:      "Rejected application — Youth Empowerment Starter Pack 2026",
    entity_type: "Application",
    entity_id:   "uuid-app-004",
    timestamp:   "2026-05-22T10:45:00Z",
  },
  {
    id:          "uuid-log-003",
    admin_id:    currentAdmin.id,
    admin_name:  `${currentAdmin.firstname} ${currentAdmin.lastname}`,
    action:      "Flagged application — Scholarship duplicate NIN conflict",
    entity_type: "Application",
    entity_id:   "uuid-app-002",
    timestamp:   "2026-05-21T14:10:00Z",
  },
  {
    id:          "uuid-log-004",
    admin_id:    currentAdmin.id,
    admin_name:  `${currentAdmin.firstname} ${currentAdmin.lastname}`,
    action:      "Published scheme — 2026/2027 University Scholarship Award",
    entity_type: "Scheme",
    entity_id:   "uuid-scheme-001",
    timestamp:   "2026-04-01T08:00:00Z",
  },
  {
    id:          "uuid-log-005",
    admin_id:    currentAdmin.id,
    admin_name:  `${currentAdmin.firstname} ${currentAdmin.lastname}`,
    action:      "Closed scheme — 2026 SME Business Startup Grant",
    entity_type: "Scheme",
    entity_id:   "uuid-scheme-004",
    timestamp:   "2026-05-31T17:00:00Z",
  },
  {
    id:          "uuid-log-006",
    admin_id:    currentAdmin.id,
    admin_name:  `${currentAdmin.firstname} ${currentAdmin.lastname}`,
    action:      "Verified student profile — Chukwu Harrison",
    entity_type: "Student",
    entity_id:   "uuid-student-003",
    timestamp:   "2026-05-20T09:00:00Z",
  },
];


// ── OVERVIEW STATS ────────────────────────────────────────────────────────────
// Source: derived from applications and students arrays above
// In production replace with GET /applications/my-stats/ or a dedicated admin stats endpoint
export const overviewStats = {
  total_applications: applications.length,
  // "pending" in UI = submitted + eligibility_check + document_review + shortlisted
  pending:  applications.filter((a) =>
    ["submitted", "eligibility_check", "document_review", "shortlisted"].includes(a.status)
  ).length,
  flagged:  applications.filter((a) => a.status === "double_dip_flag").length,
  approved: applications.filter((a) => a.status === "approved").length,
  rejected: applications.filter((a) => a.status === "rejected").length,
  total_students: students.length,
  verified_students: students.filter((s) => s.is_verified).length,
  open_schemes: schemes.filter((s) => s.is_active && s.is_published).length,
};


// ── RECENT ACTIVITY (for overview feed) ───────────────────────────────────────
export const recentActivity = [...auditLog]
  .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
  .slice(0, 6);