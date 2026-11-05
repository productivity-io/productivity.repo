import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

export const academicYears = sqliteTable('academic_years', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(), // e.g., "2026-2027"
  startDate: text('start_date').notNull(),
  endDate: text('end_date').notNull(),
  isCurrent: integer('is_current', { mode: 'boolean' }).notNull().default(false),
  status: text('status').notNull().default('active'), // active | archived | upcoming
});

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  schoolId: text('school_id').notNull().unique(), // e.g., STU-2026-001, TCH-101, CRD-01, PRN-01
  username: text('username').notNull().unique(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: text('role').notNull(), // 'student' | 'teacher' | 'coordinator' | 'principal'
  fullName: text('full_name').notNull(),
  avatarUrl: text('avatar_url'),
  phone: text('phone'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  preferencesJson: text('preferences_json').notNull().default('{"emailAlerts":true,"inAppAlerts":true,"emergencySound":true,"assignmentReminders":true}'),
  lastLoginAt: text('last_login_at'),
  createdAt: text('created_at').notNull(),
});

export const classes = sqliteTable('classes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(), // e.g., "Grade 10"
  gradeLevel: integer('grade_level').notNull(),
  academicYearId: integer('academic_year_id').notNull(),
  coordinatorId: integer('coordinator_id'),
});

export const sections = sqliteTable('sections', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  classId: integer('class_id').notNull(),
  name: text('name').notNull(), // e.g., "A", "B"
  roomNumber: text('room_number').notNull(),
  classTeacherId: integer('class_teacher_id'),
  capacity: integer('capacity').notNull().default(35),
});

export const subjects = sqliteTable('subjects', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  code: text('code').notNull().unique(), // e.g., "MAT-101"
  name: text('name').notNull(),
  department: text('department').notNull(),
  description: text('description'),
  isElective: integer('is_elective', { mode: 'boolean' }).notNull().default(false),
  curriculumProgress: integer('curriculum_progress').notNull().default(68),
});

export const students = sqliteTable('students', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().unique(),
  admissionNo: text('admission_no').notNull().unique(),
  rollNo: integer('roll_no').notNull(),
  classId: integer('class_id').notNull(),
  sectionId: integer('section_id').notNull(),
  dob: text('dob').notNull(),
  gender: text('gender').notNull(),
  bloodGroup: text('blood_group').notNull(),
  address: text('address').notNull(),
  guardianName: text('guardian_name').notNull(),
  guardianRelation: text('guardian_relation').notNull(),
  guardianPhone: text('guardian_phone').notNull(),
  guardianEmail: text('guardian_email').notNull(),
  routeId: integer('route_id'),
  pickupPoint: text('pickup_point'),
  dropoffPoint: text('dropoff_point'),
  house: text('house').notNull().default('Valiant House'),
  disciplinaryNotes: text('disciplinary_notes'),
  status: text('status').notNull().default('active'), // active | graduated | suspended | inactive
});

export const teachers = sqliteTable('teachers', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().unique(),
  employeeCode: text('employee_code').notNull().unique(),
  department: text('department').notNull(),
  qualification: text('qualification').notNull(),
  specialization: text('specialization').notNull(),
  joinDate: text('join_date').notNull(),
  designation: text('designation').notNull(),
  workloadHours: integer('workload_hours').notNull().default(24),
  canPublishClassAnnouncements: integer('can_publish_class_announcements', { mode: 'boolean' }).notNull().default(true),
});

export const coordinators = sqliteTable('coordinators', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().unique(),
  employeeCode: text('employee_code').notNull().unique(),
  department: text('department').notNull(), // e.g., "Senior Secondary Wing (Grades 9-10)"
  assignedGradesJson: text('assigned_grades_json').notNull(), // e.g., "[9,10]"
  scopeDescription: text('scope_description').notNull(),
});

export const teacherAssignments = sqliteTable('teacher_assignments', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  teacherId: integer('teacher_id').notNull(),
  classId: integer('class_id').notNull(),
  sectionId: integer('section_id').notNull(),
  subjectId: integer('subject_id').notNull(),
  academicYearId: integer('academic_year_id').notNull(),
});

export const timetables = sqliteTable('timetables', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  classId: integer('class_id').notNull(),
  sectionId: integer('section_id').notNull(),
  dayOfWeek: text('day_of_week').notNull(), // Monday, Tuesday, Wednesday, Thursday, Friday
  periodNumber: integer('period_number').notNull(),
  startTime: text('start_time').notNull(),
  endTime: text('end_time').notNull(),
  subjectId: integer('subject_id'),
  teacherId: integer('teacher_id'),
  roomNumber: text('room_number').notNull(),
  isBreak: integer('is_break', { mode: 'boolean' }).notNull().default(false),
  breakLabel: text('break_label'),
  status: text('status').notNull().default('scheduled'), // scheduled | substituted | cancelled
  substitutionTeacherId: integer('substitution_teacher_id'),
  statusNote: text('status_note'),
});

export const attendance = sqliteTable('attendance', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  studentId: integer('student_id').notNull(),
  classId: integer('class_id').notNull(),
  sectionId: integer('section_id').notNull(),
  subjectId: integer('subject_id'), // null for daily homeroom attendance, or populated for subject-wise
  date: text('date').notNull(), // YYYY-MM-DD
  status: text('status').notNull(), // 'present' | 'absent' | 'late' | 'excused'
  markedById: integer('marked_by_id').notNull(),
  remarks: text('remarks'),
  updatedAt: text('updated_at').notNull(),
});

export const attendanceCorrections = sqliteTable('attendance_corrections', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  attendanceId: integer('attendance_id').notNull(),
  studentId: integer('student_id').notNull(),
  date: text('date').notNull(),
  currentStatus: text('current_status').notNull(),
  requestedStatus: text('requested_status').notNull(),
  reason: text('reason').notNull(),
  status: text('status').notNull().default('pending'), // 'pending' | 'approved' | 'rejected'
  reviewedById: integer('reviewed_by_id'),
  reviewRemarks: text('review_remarks'),
  createdAt: text('created_at').notNull(),
});

export const teacherAttendance = sqliteTable('teacher_attendance', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  teacherId: integer('teacher_id').notNull(),
  date: text('date').notNull(),
  status: text('status').notNull(), // 'present' | 'absent' | 'late' | 'on_leave'
  checkInTime: text('check_in_time'),
  checkOutTime: text('check_out_time'),
  remarks: text('remarks'),
});

export const assignments = sqliteTable('assignments', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  description: text('description').notNull(),
  instructions: text('instructions').notNull(),
  classId: integer('class_id').notNull(),
  sectionId: integer('section_id').notNull(),
  subjectId: integer('subject_id').notNull(),
  teacherId: integer('teacher_id').notNull(),
  dueDate: text('due_date').notNull(),
  maxMarks: integer('max_marks').notNull().default(100),
  attachmentUrl: text('attachment_url'),
  attachmentName: text('attachment_name'),
  academicYearId: integer('academic_year_id').notNull(),
  createdAt: text('created_at').notNull(),
});

export const assignmentSubmissions = sqliteTable('assignment_submissions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  assignmentId: integer('assignment_id').notNull(),
  studentId: integer('student_id').notNull(),
  status: text('status').notNull().default('assigned'), // 'assigned' | 'in_progress' | 'submitted' | 'under_review' | 'graded' | 'overdue'
  textContent: text('text_content'),
  fileUrl: text('file_url'),
  fileName: text('file_name'),
  submittedAt: text('submitted_at'),
  marksObtained: real('marks_obtained'),
  grade: text('grade'),
  teacherRemarks: text('teacher_remarks'),
  resubmissionRequested: integer('resubmission_requested', { mode: 'boolean' }).notNull().default(false),
  gradedById: integer('graded_by_id'),
  gradedAt: text('graded_at'),
});

export const examinations = sqliteTable('examinations', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(), // e.g., "Mid-Term Assessment I", "Unit Test II", "Final Term Examination"
  term: text('term').notNull(),
  academicYearId: integer('academic_year_id').notNull(),
  classId: integer('class_id').notNull(),
  startDate: text('start_date').notNull(),
  endDate: text('end_date').notNull(),
  status: text('status').notNull().default('upcoming'), // 'upcoming' | 'ongoing' | 'completed' | 'published'
  description: text('description'),
});

export const examSchedules = sqliteTable('exam_schedules', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  examinationId: integer('examination_id').notNull(),
  subjectId: integer('subject_id').notNull(),
  examDate: text('exam_date').notNull(),
  startTime: text('start_time').notNull(),
  endTime: text('end_time').notNull(),
  roomNumber: text('room_number').notNull(),
  maxMarks: integer('max_marks').notNull().default(100),
  passingMarks: integer('passing_marks').notNull().default(35),
  syllabusNotes: text('syllabus_notes'),
});

export const marks = sqliteTable('marks', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  examinationId: integer('examination_id').notNull(),
  examScheduleId: integer('exam_schedule_id'),
  studentId: integer('student_id').notNull(),
  subjectId: integer('subject_id').notNull(),
  marksObtained: real('marks_obtained').notNull(),
  maxMarks: integer('max_marks').notNull().default(100),
  grade: text('grade').notNull(),
  teacherRemarks: text('teacher_remarks'),
  enteredById: integer('entered_by_id').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const reportCards = sqliteTable('report_cards', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  studentId: integer('student_id').notNull(),
  examinationId: integer('examination_id').notNull(),
  academicYearId: integer('academic_year_id').notNull(),
  totalMarks: real('total_marks').notNull(),
  maxTotalMarks: integer('max_total_marks').notNull(),
  percentage: real('percentage').notNull(),
  overallGrade: text('overall_grade').notNull(),
  rankInClass: integer('rank_in_class'),
  attendancePercentage: real('attendance_percentage').notNull(),
  classTeacherRemarks: text('class_teacher_remarks'),
  principalRemarks: text('principal_remarks'),
  publishedAt: text('published_at').notNull(),
});

export const announcements = sqliteTable('announcements', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  content: text('content').notNull(),
  category: text('category').notNull(), // 'school_wide' | 'class_specific' | 'academic' | 'event' | 'emergency' | 'transport'
  priority: text('priority').notNull().default('normal'), // 'normal' | 'important' | 'critical'
  targetRolesJson: text('target_roles_json').notNull().default('["student","teacher","coordinator","principal"]'),
  targetClassIdsJson: text('target_class_ids_json').notNull().default('[]'),
  authorId: integer('author_id').notNull(),
  authorName: text('author_name').notNull(),
  authorRole: text('author_role').notNull(),
  attachmentUrl: text('attachment_url'),
  attachmentName: text('attachment_name'),
  approvalStatus: text('approval_status').notNull().default('approved'), // 'approved' | 'pending_approval' | 'rejected'
  approvedById: integer('approved_by_id'),
  rejectionRemarks: text('rejection_remarks'),
  publishedAt: text('published_at').notNull(),
  expiresAt: text('expires_at'),
  isEmergency: integer('is_emergency', { mode: 'boolean' }).notNull().default(false),
  emergencyInstructions: text('emergency_instructions'),
  createdAt: text('created_at').notNull(),
});

export const announcementReads = sqliteTable('announcement_reads', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  announcementId: integer('announcement_id').notNull(),
  userId: integer('user_id').notNull(),
  readAt: text('read_at').notNull(),
});

export const notifications = sqliteTable('notifications', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull(),
  title: text('title').notNull(),
  message: text('message').notNull(),
  category: text('category').notNull(), // 'announcement' | 'emergency' | 'assignment' | 'grading' | 'attendance' | 'leave' | 'exam' | 'timetable' | 'communication' | 'lost_found' | 'transport' | 'event'
  linkUrl: text('link_url').notNull(),
  isRead: integer('is_read', { mode: 'boolean' }).notNull().default(false),
  priority: text('priority').notNull().default('normal'),
  createdAt: text('created_at').notNull(),
});

export const communicationRequests = sqliteTable('communication_requests', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  requesterId: integer('requester_id').notNull(),
  recipientId: integer('recipient_id').notNull(),
  subject: text('subject').notNull(),
  issueDescription: text('issue_description').notNull(),
  category: text('category').notNull().default('academic'), // 'academic' | 'attendance' | 'counseling' | 'general' | 'administrative'
  status: text('status').notNull().default('pending'), // 'pending' | 'accepted' | 'rejected' | 'closed'
  responseNote: text('response_note'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const messages = sqliteTable('messages', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  requestId: integer('request_id').notNull(),
  senderId: integer('sender_id').notNull(),
  content: text('content').notNull(),
  attachmentUrl: text('attachment_url'),
  isRead: integer('is_read', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').notNull(),
});

export const studentPortfolios = sqliteTable('student_portfolios', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  studentId: integer('student_id').notNull().unique(),
  headline: text('headline').notNull(),
  introduction: text('introduction').notNull(),
  skillsJson: text('skills_json').notNull().default('[]'),
  extracurricularJson: text('extracurricular_json').notNull().default('[]'),
  careerGoals: text('career_goals'),
  updatedAt: text('updated_at').notNull(),
});

export const portfolioEntries = sqliteTable('portfolio_entries', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  studentId: integer('student_id').notNull(),
  title: text('title').notNull(),
  category: text('category').notNull(), // 'academic' | 'certificate' | 'award' | 'sports' | 'arts_cultural' | 'project' | 'extracurricular' | 'competition' | 'milestone'
  description: text('description').notNull(),
  dateAchieved: text('date_achieved').notNull(),
  issuerOrEvent: text('issuer_or_event').notNull(),
  attachmentUrl: text('attachment_url'),
  verificationStatus: text('verification_status').notNull().default('approved'), // 'approved' | 'pending' | 'rejected'
  verifiedById: integer('verified_by_id'),
  teacherRemarks: text('teacher_remarks'),
  createdAt: text('created_at').notNull(),
});

export const teacherFeedback = sqliteTable('teacher_feedback', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  studentId: integer('student_id').notNull(),
  teacherId: integer('teacher_id').notNull(),
  category: text('category').notNull(), // 'academic_progress' | 'participation' | 'behaviour' | 'communication' | 'creativity' | 'leadership' | 'improvement_area'
  rating: integer('rating').notNull(), // 1-5
  comment: text('comment').notNull(),
  areasOfImprovement: text('areas_of_improvement'),
  createdAt: text('created_at').notNull(),
});

export const leaveRequests = sqliteTable('leave_requests', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  applicantUserId: integer('applicant_user_id').notNull(),
  studentId: integer('student_id'),
  startDate: text('start_date').notNull(),
  endDate: text('end_date').notNull(),
  leaveType: text('leave_type').notNull(), // 'medical' | 'family' | 'competition' | 'personal'
  reason: text('reason').notNull(),
  documentUrl: text('document_url'),
  documentName: text('document_name'),
  status: text('status').notNull().default('pending'), // 'pending' | 'approved' | 'rejected'
  reviewedById: integer('reviewed_by_id'),
  reviewerRemarks: text('reviewer_remarks'),
  createdAt: text('created_at').notNull(),
});

export const vehicles = sqliteTable('vehicles', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  busNumber: text('bus_number').notNull().unique(),
  registrationNo: text('registration_no').notNull().unique(),
  capacity: integer('capacity').notNull(),
  model: text('model').notNull(),
  status: text('status').notNull().default('active'), // 'active' | 'maintenance'
  lastMaintenanceDate: text('last_maintenance_date').notNull(),
});

export const drivers = sqliteTable('drivers', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  fullName: text('full_name').notNull(),
  licenseNumber: text('license_number').notNull().unique(),
  phone: text('phone').notNull(),
  experienceYears: integer('experience_years').notNull(),
  assignedBusNumber: text('assigned_bus_number').notNull(),
});

export const transportRoutes = sqliteTable('transport_routes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  routeNumber: text('route_number').notNull().unique(),
  routeName: text('route_name').notNull(),
  vehicleId: integer('vehicle_id').notNull(),
  driverId: integer('driver_id').notNull(),
  attendantName: text('attendant_name').notNull(),
  attendantPhone: text('attendant_phone').notNull(),
  transportContact: text('transport_contact').notNull(),
  morningDeparture: text('morning_departure').notNull(),
  afternoonDeparture: text('afternoon_departure').notNull(),
  stopsJson: text('stops_json').notNull(), // JSON array of { name, morningTime, afternoonTime }
  status: text('status').notNull().default('operational'),
  notice: text('notice'),
});

export const transportIssues = sqliteTable('transport_issues', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  reporterUserId: integer('reporter_user_id').notNull(),
  routeId: integer('route_id').notNull(),
  issueType: text('issue_type').notNull(),
  description: text('description').notNull(),
  status: text('status').notNull().default('open'), // 'open' | 'investigating' | 'resolved'
  resolutionNote: text('resolution_note'),
  createdAt: text('created_at').notNull(),
});

export const lostAndFound = sqliteTable('lost_and_found', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  reporterUserId: integer('reporter_user_id').notNull(),
  type: text('type').notNull(), // 'lost' | 'found'
  itemName: text('item_name').notNull(),
  description: text('description').notNull(),
  category: text('category').notNull(), // 'electronics' | 'books' | 'apparel' | 'accessories' | 'sports_gear' | 'id_cards'
  location: text('location').notNull(),
  dateReported: text('date_reported').notNull(),
  photoUrl: text('photo_url'),
  contactInfo: text('contact_info').notNull(),
  status: text('status').notNull().default('reported'), // 'reported' | 'claim_pending' | 'verified' | 'claimed' | 'archived'
  claimedByUserId: integer('claimed_by_user_id'),
  claimNote: text('claim_note'),
  verifiedByUserId: integer('verified_by_user_id'),
  verificationNote: text('verification_note'),
  createdAt: text('created_at').notNull(),
});

export const libraryBooks = sqliteTable('library_books', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  isbn: text('isbn').notNull().unique(),
  title: text('title').notNull(),
  author: text('author').notNull(),
  category: text('category').notNull(),
  publisher: text('publisher').notNull(),
  rackLocation: text('rack_location').notNull(),
  totalCopies: integer('total_copies').notNull(),
  availableCopies: integer('available_copies').notNull(),
  description: text('description').notNull(),
});

export const bookTransactions = sqliteTable('book_transactions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  bookId: integer('book_id').notNull(),
  studentId: integer('student_id').notNull(),
  userId: integer('user_id').notNull(),
  issueDate: text('issue_date').notNull(),
  dueDate: text('due_date').notNull(),
  returnDate: text('return_date'),
  status: text('status').notNull().default('issued'), // 'issued' | 'returned' | 'overdue'
  fineAmount: real('fine_amount').notNull().default(0),
  remarks: text('remarks'),
});

export const schoolEvents = sqliteTable('school_events', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  description: text('description').notNull(),
  category: text('category').notNull(), // 'holiday' | 'cultural' | 'sports' | 'competition' | 'examination' | 'deadline' | 'academic' | 'personal'
  startDate: text('start_date').notNull(),
  endDate: text('end_date').notNull(),
  startTime: text('start_time'),
  location: text('location').notNull(),
  organizerId: integer('organizer_id'),
  assignedTeacherIdsJson: text('assigned_teacher_ids_json').notNull().default('[]'),
  targetClassIdsJson: text('target_class_ids_json').notNull().default('[]'),
  participantCount: integer('participant_count').notNull().default(0),
  isPersonalReminder: integer('is_personal_reminder', { mode: 'boolean' }).notNull().default(false),
  ownerUserId: integer('owner_user_id'),
});

export const quickContacts = sqliteTable('quick_contacts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  department: text('department').notNull(),
  roleTitle: text('role_title').notNull(),
  contactPerson: text('contact_person').notNull(),
  linkedUserId: integer('linked_user_id'),
  email: text('email').notNull(),
  phone: text('phone').notNull(),
  extension: text('extension').notNull(),
  officeLocation: text('office_location').notNull(),
  availableHours: text('available_hours').notNull(),
  category: text('category').notNull(), // 'academic' | 'administration' | 'transport' | 'emergency' | 'support'
});

export const schoolSettings = sqliteTable('school_settings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  schoolName: text('school_name').notNull(),
  tagline: text('tagline').notNull(),
  code: text('code').notNull(),
  affiliationNo: text('affiliation_no').notNull(),
  address: text('address').notNull(),
  phone: text('phone').notNull(),
  email: text('email').notNull(),
  website: text('website').notNull(),
  currentAcademicYearId: integer('current_academic_year_id').notNull(),
  primaryColor: text('primary_color').notNull().default('#1d4ed8'),
  enableNotifications: integer('enable_notifications', { mode: 'boolean' }).notNull().default(true),
  rolePermissionsJson: text('role_permissions_json').notNull(),
  backupLastRunAt: text('backup_last_run_at'),
});

export const auditLogs = sqliteTable('audit_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  actorUserId: integer('actor_user_id').notNull(),
  actorName: text('actor_name').notNull(),
  actorRole: text('actor_role').notNull(),
  action: text('action').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  summary: text('summary').notNull(),
  metadataJson: text('metadata_json'),
  createdAt: text('created_at').notNull(),
});
