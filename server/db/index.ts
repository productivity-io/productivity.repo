import * as schema from './schema.js';
import { SqliteClientAdapter, createDrizzleSqlite } from './sqliteAdapter.js';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const dataDir = process.env.VERITAS_DATA_DIR
  ? path.resolve(process.env.VERITAS_DATA_DIR)
  : isServerless
    ? path.join(os.tmpdir(), 'veritas-data')
    : path.resolve(process.cwd(), 'data');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

export const dbFilePath = path.join(dataDir, 'veritas_school.db');
export const sqlite = new SqliteClientAdapter(dbFilePath);
try {
  sqlite.pragma('journal_mode = WAL');
} catch {
  sqlite.pragma('journal_mode = DELETE');
}
sqlite.pragma('foreign_keys = ON');

export const db = createDrizzleSqlite(sqlite, schema);

export function initializeDatabaseTables() {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS academic_years (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      is_current INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active'
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      school_id TEXT NOT NULL UNIQUE,
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL,
      full_name TEXT NOT NULL,
      avatar_url TEXT,
      phone TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      preferences_json TEXT NOT NULL DEFAULT '{"emailAlerts":true,"inAppAlerts":true,"emergencySound":true,"assignmentReminders":true}',
      last_login_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS classes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      grade_level INTEGER NOT NULL,
      academic_year_id INTEGER NOT NULL,
      coordinator_id INTEGER
    );

    CREATE TABLE IF NOT EXISTS sections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      class_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      room_number TEXT NOT NULL,
      class_teacher_id INTEGER,
      capacity INTEGER NOT NULL DEFAULT 35
    );

    CREATE TABLE IF NOT EXISTS subjects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      department TEXT NOT NULL,
      description TEXT,
      is_elective INTEGER NOT NULL DEFAULT 0,
      curriculum_progress INTEGER NOT NULL DEFAULT 68
    );

    CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE,
      admission_no TEXT NOT NULL UNIQUE,
      roll_no INTEGER NOT NULL,
      class_id INTEGER NOT NULL,
      section_id INTEGER NOT NULL,
      dob TEXT NOT NULL,
      gender TEXT NOT NULL,
      blood_group TEXT NOT NULL,
      address TEXT NOT NULL,
      guardian_name TEXT NOT NULL,
      guardian_relation TEXT NOT NULL,
      guardian_phone TEXT NOT NULL,
      guardian_email TEXT NOT NULL,
      route_id INTEGER,
      pickup_point TEXT,
      dropoff_point TEXT,
      house TEXT NOT NULL DEFAULT 'Valiant House',
      disciplinary_notes TEXT,
      status TEXT NOT NULL DEFAULT 'active'
    );

    CREATE TABLE IF NOT EXISTS teachers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE,
      employee_code TEXT NOT NULL UNIQUE,
      department TEXT NOT NULL,
      qualification TEXT NOT NULL,
      specialization TEXT NOT NULL,
      join_date TEXT NOT NULL,
      designation TEXT NOT NULL,
      workload_hours INTEGER NOT NULL DEFAULT 24,
      can_publish_class_announcements INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS coordinators (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE,
      employee_code TEXT NOT NULL UNIQUE,
      department TEXT NOT NULL,
      assigned_grades_json TEXT NOT NULL,
      scope_description TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS teacher_assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      teacher_id INTEGER NOT NULL,
      class_id INTEGER NOT NULL,
      section_id INTEGER NOT NULL,
      subject_id INTEGER NOT NULL,
      academic_year_id INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS timetables (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      class_id INTEGER NOT NULL,
      section_id INTEGER NOT NULL,
      day_of_week TEXT NOT NULL,
      period_number INTEGER NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      subject_id INTEGER,
      teacher_id INTEGER,
      room_number TEXT NOT NULL,
      is_break INTEGER NOT NULL DEFAULT 0,
      break_label TEXT,
      status TEXT NOT NULL DEFAULT 'scheduled',
      substitution_teacher_id INTEGER,
      status_note TEXT
    );

    CREATE TABLE IF NOT EXISTS attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      class_id INTEGER NOT NULL,
      section_id INTEGER NOT NULL,
      subject_id INTEGER,
      date TEXT NOT NULL,
      status TEXT NOT NULL,
      marked_by_id INTEGER NOT NULL,
      remarks TEXT,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS attendance_corrections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      attendance_id INTEGER NOT NULL,
      student_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      current_status TEXT NOT NULL,
      requested_status TEXT NOT NULL,
      reason TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      reviewed_by_id INTEGER,
      review_remarks TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS teacher_attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      teacher_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      status TEXT NOT NULL,
      check_in_time TEXT,
      check_out_time TEXT,
      remarks TEXT
    );

    CREATE TABLE IF NOT EXISTS assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      instructions TEXT NOT NULL,
      class_id INTEGER NOT NULL,
      section_id INTEGER NOT NULL,
      subject_id INTEGER NOT NULL,
      teacher_id INTEGER NOT NULL,
      due_date TEXT NOT NULL,
      max_marks INTEGER NOT NULL DEFAULT 100,
      attachment_url TEXT,
      attachment_name TEXT,
      academic_year_id INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS assignment_submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      assignment_id INTEGER NOT NULL,
      student_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'assigned',
      text_content TEXT,
      file_url TEXT,
      file_name TEXT,
      submitted_at TEXT,
      marks_obtained REAL,
      grade TEXT,
      teacher_remarks TEXT,
      resubmission_requested INTEGER NOT NULL DEFAULT 0,
      graded_by_id INTEGER,
      graded_at TEXT
    );

    CREATE TABLE IF NOT EXISTS examinations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      term TEXT NOT NULL,
      academic_year_id INTEGER NOT NULL,
      class_id INTEGER NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'upcoming',
      description TEXT
    );

    CREATE TABLE IF NOT EXISTS exam_schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      examination_id INTEGER NOT NULL,
      subject_id INTEGER NOT NULL,
      exam_date TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      room_number TEXT NOT NULL,
      max_marks INTEGER NOT NULL DEFAULT 100,
      passing_marks INTEGER NOT NULL DEFAULT 35,
      syllabus_notes TEXT
    );

    CREATE TABLE IF NOT EXISTS marks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      examination_id INTEGER NOT NULL,
      exam_schedule_id INTEGER,
      student_id INTEGER NOT NULL,
      subject_id INTEGER NOT NULL,
      marks_obtained REAL NOT NULL,
      max_marks INTEGER NOT NULL DEFAULT 100,
      grade TEXT NOT NULL,
      teacher_remarks TEXT,
      entered_by_id INTEGER NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS report_cards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      examination_id INTEGER NOT NULL,
      academic_year_id INTEGER NOT NULL,
      total_marks REAL NOT NULL,
      max_total_marks INTEGER NOT NULL,
      percentage REAL NOT NULL,
      overall_grade TEXT NOT NULL,
      rank_in_class INTEGER,
      attendance_percentage REAL NOT NULL,
      class_teacher_remarks TEXT,
      principal_remarks TEXT,
      published_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS announcements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      category TEXT NOT NULL,
      priority TEXT NOT NULL DEFAULT 'normal',
      target_roles_json TEXT NOT NULL DEFAULT '["student","teacher","coordinator","principal"]',
      target_class_ids_json TEXT NOT NULL DEFAULT '[]',
      author_id INTEGER NOT NULL,
      author_name TEXT NOT NULL,
      author_role TEXT NOT NULL,
      attachment_url TEXT,
      attachment_name TEXT,
      approval_status TEXT NOT NULL DEFAULT 'approved',
      approved_by_id INTEGER,
      rejection_remarks TEXT,
      published_at TEXT NOT NULL,
      expires_at TEXT,
      is_emergency INTEGER NOT NULL DEFAULT 0,
      emergency_instructions TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS announcement_reads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      announcement_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      read_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      category TEXT NOT NULL,
      link_url TEXT NOT NULL,
      is_read INTEGER NOT NULL DEFAULT 0,
      priority TEXT NOT NULL DEFAULT 'normal',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS communication_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      requester_id INTEGER NOT NULL,
      recipient_id INTEGER NOT NULL,
      subject TEXT NOT NULL,
      issue_description TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'academic',
      status TEXT NOT NULL DEFAULT 'pending',
      response_note TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      request_id INTEGER NOT NULL,
      sender_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      attachment_url TEXT,
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS student_portfolios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL UNIQUE,
      headline TEXT NOT NULL,
      introduction TEXT NOT NULL,
      skills_json TEXT NOT NULL DEFAULT '[]',
      extracurricular_json TEXT NOT NULL DEFAULT '[]',
      career_goals TEXT,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS portfolio_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT NOT NULL,
      date_achieved TEXT NOT NULL,
      issuer_or_event TEXT NOT NULL,
      attachment_url TEXT,
      verification_status TEXT NOT NULL DEFAULT 'approved',
      verified_by_id INTEGER,
      teacher_remarks TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS teacher_feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      teacher_id INTEGER NOT NULL,
      category TEXT NOT NULL,
      rating INTEGER NOT NULL,
      comment TEXT NOT NULL,
      areas_of_improvement TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS leave_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      applicant_user_id INTEGER NOT NULL,
      student_id INTEGER,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      leave_type TEXT NOT NULL,
      reason TEXT NOT NULL,
      document_url TEXT,
      document_name TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      reviewed_by_id INTEGER,
      reviewer_remarks TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS vehicles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bus_number TEXT NOT NULL UNIQUE,
      registration_no TEXT NOT NULL UNIQUE,
      capacity INTEGER NOT NULL,
      model TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      last_maintenance_date TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS drivers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      license_number TEXT NOT NULL UNIQUE,
      phone TEXT NOT NULL,
      experience_years INTEGER NOT NULL,
      assigned_bus_number TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS transport_routes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      route_number TEXT NOT NULL UNIQUE,
      route_name TEXT NOT NULL,
      vehicle_id INTEGER NOT NULL,
      driver_id INTEGER NOT NULL,
      attendant_name TEXT NOT NULL,
      attendant_phone TEXT NOT NULL,
      transport_contact TEXT NOT NULL,
      morning_departure TEXT NOT NULL,
      afternoon_departure TEXT NOT NULL,
      stops_json TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'operational',
      notice TEXT
    );

    CREATE TABLE IF NOT EXISTS transport_issues (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reporter_user_id INTEGER NOT NULL,
      route_id INTEGER NOT NULL,
      issue_type TEXT NOT NULL,
      description TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      resolution_note TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS lost_and_found (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reporter_user_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      item_name TEXT NOT NULL,
      description TEXT NOT NULL,
      category TEXT NOT NULL,
      location TEXT NOT NULL,
      date_reported TEXT NOT NULL,
      photo_url TEXT,
      contact_info TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'reported',
      claimed_by_user_id INTEGER,
      claim_note TEXT,
      verified_by_user_id INTEGER,
      verification_note TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS library_books (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      isbn TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      author TEXT NOT NULL,
      category TEXT NOT NULL,
      publisher TEXT NOT NULL,
      rack_location TEXT NOT NULL,
      total_copies INTEGER NOT NULL,
      available_copies INTEGER NOT NULL,
      description TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS book_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      book_id INTEGER NOT NULL,
      student_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      issue_date TEXT NOT NULL,
      due_date TEXT NOT NULL,
      return_date TEXT,
      status TEXT NOT NULL DEFAULT 'issued',
      fine_amount REAL NOT NULL DEFAULT 0,
      remarks TEXT
    );

    CREATE TABLE IF NOT EXISTS school_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      category TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      start_time TEXT,
      location TEXT NOT NULL,
      organizer_id INTEGER,
      assigned_teacher_ids_json TEXT NOT NULL DEFAULT '[]',
      target_class_ids_json TEXT NOT NULL DEFAULT '[]',
      participant_count INTEGER NOT NULL DEFAULT 0,
      is_personal_reminder INTEGER NOT NULL DEFAULT 0,
      owner_user_id INTEGER
    );

    CREATE TABLE IF NOT EXISTS quick_contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      department TEXT NOT NULL,
      role_title TEXT NOT NULL,
      contact_person TEXT NOT NULL,
      linked_user_id INTEGER,
      email TEXT NOT NULL,
      phone TEXT NOT NULL,
      extension TEXT NOT NULL,
      office_location TEXT NOT NULL,
      available_hours TEXT NOT NULL,
      category TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS school_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      school_name TEXT NOT NULL,
      tagline TEXT NOT NULL,
      code TEXT NOT NULL,
      affiliation_no TEXT NOT NULL,
      address TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT NOT NULL,
      website TEXT NOT NULL,
      current_academic_year_id INTEGER NOT NULL,
      primary_color TEXT NOT NULL DEFAULT '#1d4ed8',
      enable_notifications INTEGER NOT NULL DEFAULT 1,
      role_permissions_json TEXT NOT NULL,
      backup_last_run_at TEXT
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor_user_id INTEGER NOT NULL,
      actor_name TEXT NOT NULL,
      actor_role TEXT NOT NULL,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      summary TEXT NOT NULL,
      metadata_json TEXT,
      created_at TEXT NOT NULL
    );
  `);
}
