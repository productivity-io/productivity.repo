import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import multer from 'multer';
import path from 'node:path';
import { eq, desc, and } from 'drizzle-orm';
import { db, sqlite } from './db/index.js';
import * as schema from './db/schema.js';
import { seedDatabase } from './db/seed.js';
import { createSessionToken, verifySessionToken, verifyPassword, hashPassword, SessionPayload } from './utils/auth.js';
import { fileStorage } from './services/fileStorage.js';
import { schoolService } from './services/schoolService.js';
import { getEchoWidgetConfig } from './services/echo.js';

const app = express();
const PORT = Number(process.env.PORT) || 3001;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '5mb' }));
app.use(cookieParser());

// Serve uploaded files locally
app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads')));

// Initialize & seed database on boot
seedDatabase(false);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

// Extend Express Request
declare global {
  namespace Express {
    interface Request {
      auth?: SessionPayload;
      currentUser?: typeof schema.users.$inferSelect;
    }
  }
}

// Authentication Middleware
function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = (authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null) || req.cookies?.veritas_session;

  if (!token) {
    res.status(401).json({ error: 'Authentication required. Please log in.' });
    return;
  }

  const payload = verifySessionToken(token);
  if (!payload) {
    res.status(401).json({ error: 'Session expired or invalid. Please log in again.' });
    return;
  }

  const user = db.select().from(schema.users).where(eq(schema.users.id, payload.userId)).get();
  if (!user || !user.isActive) {
    res.status(403).json({ error: 'Account is deactivated or does not exist.' });
    return;
  }

  req.auth = payload;
  req.currentUser = user;
  next();
}

function requireRoles(...roles: Array<'student' | 'teacher' | 'coordinator' | 'principal'>) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.auth || !roles.includes(req.auth.role)) {
      res.status(403).json({ error: `Access denied. Required role: ${roles.join(' or ')}.` });
      return;
    }
    next();
  };
}

// ==========================================
// 1. AUTHENTICATION ENDPOINTS
// ==========================================

app.get('/api/echo/config', requireAuth, (_req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store');
  try {
    res.json(getEchoWidgetConfig());
  } catch {
    res.status(503).json({ error: 'The ECHO assistant is not configured. Contact the portal administrator.' });
  }
});

app.get('/api/auth/demo-accounts', (_req: Request, res: Response) => {
  const allUsers = db.select().from(schema.users).all();
  const demoList = allUsers.map(u => ({
    id: u.id,
    schoolId: u.schoolId,
    username: u.username,
    email: u.email,
    role: u.role,
    fullName: u.fullName,
    isActive: u.isActive,
    samplePassword: 'password123',
  }));
  res.json({ accounts: demoList });
});

app.post('/api/auth/login', (req: Request, res: Response) => {
  const { identifier, password, rememberMe } = req.body;
  if (!identifier || !password) {
    res.status(400).json({ error: 'Please enter both your Username/School ID and password.' });
    return;
  }

  const cleanId = String(identifier).trim().toLowerCase();
  const allUsers = db.select().from(schema.users).all();
  const user = allUsers.find(
    u =>
      u.username.toLowerCase() === cleanId ||
      u.schoolId.toLowerCase() === cleanId ||
      u.email.toLowerCase() === cleanId
  );

  if (!user || !verifyPassword(String(password), user.passwordHash)) {
    res.status(401).json({ error: 'Invalid credentials. Please verify your School ID/username and password.' });
    return;
  }

  if (!user.isActive) {
    res.status(403).json({ error: 'Your account has been deactivated by the Principal’s Office. Please contact administration.' });
    return;
  }

  const now = new Date().toISOString();
  db.update(schema.users).set({ lastLoginAt: now }).where(eq(schema.users.id, user.id)).run();

  const token = createSessionToken(
    {
      userId: user.id,
      role: user.role as SessionPayload['role'],
      schoolId: user.schoolId,
    },
    Boolean(rememberMe)
  );

  res.cookie('veritas_session', token, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: rememberMe ? 30 * 24 * 3600 * 1000 : 24 * 3600 * 1000,
  });

  const profile = schoolService.getUserProfile(user.id);
  res.json({ token, user: profile });
});

app.post('/api/auth/logout', (_req: Request, res: Response) => {
  res.clearCookie('veritas_session');
  res.json({ success: true });
});

app.get('/api/auth/me', requireAuth, (req: Request, res: Response) => {
  const profile = schoolService.getUserProfile(req.currentUser!.id);
  const settings = db.select().from(schema.schoolSettings).get();
  const academicYears = db.select().from(schema.academicYears).all();
  res.json({ user: profile, schoolSettings: settings, academicYears });
});

app.post('/api/auth/forgot-password', (req: Request, res: Response) => {
  const { identifier } = req.body;
  if (!identifier) {
    res.status(400).json({ error: 'Please provide your School ID or registered email.' });
    return;
  }
  const cleanId = String(identifier).trim().toLowerCase();
  const allUsers = db.select().from(schema.users).all();
  const matched = allUsers.find(
    u => u.schoolId.toLowerCase() === cleanId || u.email.toLowerCase() === cleanId || u.username.toLowerCase() === cleanId
  );

  if (!matched) {
    res.status(404).json({ error: 'No account found matching that School ID or email address.' });
    return;
  }

  res.json({
    success: true,
    message: `Local recovery token generated for ${matched.fullName} (${matched.schoolId}). In local development mode, demo accounts use "password123" or can be reset directly by the Principal.`,
  });
});

app.post('/api/auth/change-password', requireAuth, (req: Request, res: Response) => {
  const { currentPassword, newPassword } = req.body;
  const user = req.currentUser!;
  if (!currentPassword || !newPassword || String(newPassword).length < 6) {
    res.status(400).json({ error: 'New password must be at least 6 characters long.' });
    return;
  }
  if (!verifyPassword(String(currentPassword), user.passwordHash)) {
    res.status(400).json({ error: 'Current password is incorrect.' });
    return;
  }
  db.update(schema.users)
    .set({ passwordHash: hashPassword(String(newPassword)) })
    .where(eq(schema.users.id, user.id))
    .run();
  schoolService.logAudit(user, 'CHANGE_PASSWORD', 'user', user.id, 'User updated their account password.');
  res.json({ success: true, message: 'Password updated successfully.' });
});

app.patch('/api/profile', requireAuth, (req: Request, res: Response) => {
  const user = req.currentUser!;
  const { phone, preferences, address, guardianPhone, guardianEmail } = req.body;

  if (phone !== undefined) {
    db.update(schema.users).set({ phone: String(phone) }).where(eq(schema.users.id, user.id)).run();
  }
  if (preferences !== undefined) {
    db.update(schema.users)
      .set({ preferencesJson: JSON.stringify(preferences) })
      .where(eq(schema.users.id, user.id))
      .run();
  }
  if (user.role === 'student' && (address || guardianPhone || guardianEmail)) {
    const stu = db.select().from(schema.students).where(eq(schema.students.userId, user.id)).get();
    if (stu) {
      db.update(schema.students)
        .set({
          address: address ?? stu.address,
          guardianPhone: guardianPhone ?? stu.guardianPhone,
          guardianEmail: guardianEmail ?? stu.guardianEmail,
        })
        .where(eq(schema.students.id, stu.id))
        .run();
    }
  }

  res.json({ user: schoolService.getUserProfile(user.id) });
});

// ==========================================
// 2. FILE UPLOAD ENDPOINT
// ==========================================

app.post('/api/upload', requireAuth, upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file provided.' });
      return;
    }
    const folder = String(req.body.folder || 'general').replace(/[^a-zA-Z0-9_-]/g, '');
    const saved = await fileStorage.saveFile(req.file.buffer, req.file.originalname, req.file.mimetype, folder);
    res.json(saved);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'File upload failed';
    res.status(400).json({ error: msg });
  }
});

// ==========================================
// 3. UNIFIED DASHBOARD AGGREGATION ENDPOINT
// ==========================================

app.get('/api/dashboard', requireAuth, (req: Request, res: Response) => {
  const user = req.currentUser!;
  const enrichedStudents = schoolService.getEnrichedStudents();
  const enrichedTeachers = schoolService.getEnrichedTeachers();
  const allAnnouncements = db.select().from(schema.announcements).orderBy(desc(schema.announcements.publishedAt)).all();
  const allEvents = db.select().from(schema.schoolEvents).all();
  const allAssignments = db.select().from(schema.assignments).all();
  const allSubmissions = db.select().from(schema.assignmentSubmissions).all();
  const allExams = db.select().from(schema.examinations).all();
  const allFeedback = db.select().from(schema.teacherFeedback).orderBy(desc(schema.teacherFeedback.createdAt)).all();
  const allSubjects = db.select().from(schema.subjects).all();
  const allClasses = db.select().from(schema.classes).all();
  const allSections = db.select().from(schema.sections).all();
  const allCoordinators = db.select().from(schema.coordinators).all();
  const allTimetables = db.select().from(schema.timetables).all();
  const allCommRequests = db.select().from(schema.communicationRequests).all();
  const allLeaves = db.select().from(schema.leaveRequests).all();
  const allPortfolioEntries = db.select().from(schema.portfolioEntries).all();
  const allAttendance = db.select().from(schema.attendance).all();

  const approvedAnnouncements = allAnnouncements.filter(a => a.approvalStatus === 'approved');
  const emergencyAlerts = approvedAnnouncements.filter(a => a.isEmergency);

  if (user.role === 'student') {
    const student = enrichedStudents.find(s => s.userId === user.id) || enrichedStudents[0];
    const stuAtt = allAttendance.filter(a => a.studentId === student.id && a.subjectId === null);
    const todayAtt = stuAtt.find(a => a.date === '2026-11-05') || stuAtt[stuAtt.length - 1];

    const todayTimetable = allTimetables
      .filter(t => t.classId === student.classId && t.sectionId === student.sectionId && t.dayOfWeek === 'Thursday')
      .sort((a, b) => a.periodNumber - b.periodNumber)
      .map(t => ({
        ...t,
        subjectName: allSubjects.find(s => s.id === t.subjectId)?.name || t.breakLabel || 'Break',
        teacherName: enrichedTeachers.find(tc => tc.id === t.teacherId)?.fullName || '',
        subTeacherName: enrichedTeachers.find(tc => tc.id === t.substitutionTeacherId)?.fullName || '',
      }));

    const studentAssignments = allAssignments
      .filter(a => a.classId === student.classId && a.sectionId === student.sectionId)
      .map(a => {
        const sub = allSubmissions.find(s => s.assignmentId === a.id && s.studentId === student.id);
        return {
          ...a,
          subjectName: allSubjects.find(s => s.id === a.subjectId)?.name || '',
          teacherName: enrichedTeachers.find(t => t.id === a.teacherId)?.fullName || '',
          submissionStatus: sub?.status || 'assigned',
          marksObtained: sub?.marksObtained ?? null,
          grade: sub?.grade ?? null,
        };
      });

    const studentFeedback = allFeedback
      .filter(f => f.studentId === student.id)
      .map(f => ({
        ...f,
        teacherName: enrichedTeachers.find(t => t.id === f.teacherId)?.fullName || 'Faculty',
      }));

    const marks = db.select().from(schema.marks).where(eq(schema.marks.studentId, student.id)).all();
    const subjectPerformance = allSubjects.map(subj => {
      const m1 = marks.find(m => m.subjectId === subj.id && m.examinationId === 1);
      const m2 = marks.find(m => m.subjectId === subj.id && m.examinationId === 2);
      return {
        subject: subj.name.split(' ')[0],
        fullSubject: subj.name,
        midTerm: m1?.marksObtained || 85,
        unitTest: m2?.marksObtained || 88,
      };
    });

    res.json({
      role: 'student',
      student,
      todayAttendance: todayAtt || { status: 'present', date: '2026-11-05' },
      attendancePercentage: student.attendancePercentage,
      todayTimetable,
      pendingAssignments: studentAssignments.filter(a => ['assigned', 'in_progress', 'overdue'].includes(a.submissionStatus)),
      allAssignments: studentAssignments,
      upcomingExams: allExams.filter(e => e.classId === student.classId),
      latestAnnouncements: approvedAnnouncements.slice(0, 5),
      emergencyAlerts,
      upcomingEvents: allEvents.filter(e => !e.isPersonalReminder || e.ownerUserId === user.id).slice(0, 5),
      recentFeedback: studentFeedback,
      subjectPerformance,
    });
    return;
  }

  if (user.role === 'teacher') {
    const teacher = enrichedTeachers.find(t => t.userId === user.id) || enrichedTeachers[0];
    const assignedClassIds = Array.from(new Set(teacher.assignedMappings.map(m => m.classId)));
    const assignedStudents = enrichedStudents.filter(s => assignedClassIds.includes(s.classId));

    const teacherTimetable = allTimetables
      .filter(t => (t.teacherId === teacher.id || t.substitutionTeacherId === teacher.id) && t.dayOfWeek === 'Thursday')
      .sort((a, b) => a.periodNumber - b.periodNumber)
      .map(t => ({
        ...t,
        subjectName: allSubjects.find(s => s.id === t.subjectId)?.name || '',
        className: allClasses.find(c => c.id === t.classId)?.name || '',
        sectionName: allSections.find(s => s.id === t.sectionId)?.name || '',
      }));

    const teacherAssignmentsList = allAssignments.filter(a => a.teacherId === teacher.id);
    const pendingSubmissionsToGrade = allSubmissions.filter(
      s => ['submitted', 'under_review'].includes(s.status)
    );

    const studentRequests = allCommRequests.filter(r => r.recipientId === user.id);
    const pendingCorrections = db.select().from(schema.attendanceCorrections).where(eq(schema.attendanceCorrections.status, 'pending')).all();

    res.json({
      role: 'teacher',
      teacher,
      stats: {
        assignedClassesCount: teacher.assignedMappings.length,
        totalStudentsCount: assignedStudents.length,
        pendingToGradeCount: pendingSubmissionsToGrade.length,
        avgAttendancePercentage: Math.round(assignedStudents.reduce((acc, s) => acc + s.attendancePercentage, 0) / Math.max(1, assignedStudents.length) * 10) / 10,
        pendingRequestsCount: studentRequests.filter(r => r.status === 'pending').length + pendingCorrections.length,
      },
      todayTimetable: teacherTimetable,
      assignedStudents,
      pendingSubmissionsToGrade,
      teacherAssignments: teacherAssignmentsList,
      upcomingExams: allExams,
      studentRequests,
      latestAnnouncements: approvedAnnouncements.slice(0, 5),
      emergencyAlerts,
      upcomingEvents: allEvents.slice(0, 5),
    });
    return;
  }

  // Coordinator & Principal Executive Overview
  const pendingAnnouncements = allAnnouncements.filter(a => a.approvalStatus === 'pending_approval');
  const pendingLeaves = allLeaves.filter(l => l.status === 'pending');
  const pendingPortfolios = allPortfolioEntries.filter(p => p.verificationStatus === 'pending');
  const pendingComm = allCommRequests.filter(c => c.status === 'pending');

  const classDistribution = allClasses.map(cls => {
    const clsStudents = enrichedStudents.filter(s => s.classId === cls.id);
    const avgAtt = clsStudents.length > 0
      ? Math.round((clsStudents.reduce((a, b) => a + b.attendancePercentage, 0) / clsStudents.length) * 10) / 10
      : 94.5;
    const avgScore = clsStudents.length > 0
      ? Math.round((clsStudents.reduce((a, b) => a + b.avgAcademicPercentage, 0) / clsStudents.length) * 10) / 10
      : 87.2;
    return {
      classId: cls.id,
      className: cls.name,
      studentCount: clsStudents.length,
      avgAttendance: avgAtt,
      avgAcademicScore: avgScore,
    };
  });

  const overallAttendance = Math.round(
    (enrichedStudents.reduce((acc, s) => acc + s.attendancePercentage, 0) / Math.max(1, enrichedStudents.length)) * 10
  ) / 10;

  const overallAcademic = Math.round(
    (enrichedStudents.reduce((acc, s) => acc + s.avgAcademicPercentage, 0) / Math.max(1, enrichedStudents.length)) * 10
  ) / 10;

  const completedSubmissions = allSubmissions.filter(s => ['submitted', 'under_review', 'graded'].includes(s.status)).length;
  const assignmentCompletionRate = allSubmissions.length > 0
    ? Math.round((completedSubmissions / allSubmissions.length) * 100)
    : 78;

  res.json({
    role: user.role,
    stats: {
      totalStudents: enrichedStudents.length,
      totalTeachers: enrichedTeachers.length,
      totalCoordinators: allCoordinators.length,
      totalClasses: allClasses.length,
      overallAttendance,
      overallAcademic,
      assignmentCompletionRate,
      pendingApprovalsCount: pendingAnnouncements.length + pendingLeaves.length + pendingPortfolios.length,
    },
    classDistribution,
    students: enrichedStudents,
    teachers: enrichedTeachers,
    subjects: allSubjects,
    pendingAnnouncements,
    pendingLeaves,
    pendingPortfolios,
    pendingComm,
    latestAnnouncements: approvedAnnouncements.slice(0, 6),
    emergencyAlerts,
    upcomingEvents: allEvents.slice(0, 6),
    auditLogs: db.select().from(schema.auditLogs).orderBy(desc(schema.auditLogs.id)).limit(8).all(),
  });
});

// ==========================================
// 4. GLOBAL SEARCH ENDPOINT (Role-Scoped)
// ==========================================

app.get('/api/search', requireAuth, (req: Request, res: Response) => {
  const q = String(req.query.q || '').trim().toLowerCase();
  const role = req.auth!.role;

  if (!q) {
    res.json({ results: [] });
    return;
  }

  const results: Array<{ id: string; title: string; subtitle: string; category: string; url: string }> = [];

  // Students (visible to teacher, coordinator, principal; students see only themselves)
  const students = schoolService.getEnrichedStudents();
  for (const s of students) {
    if (role === 'student' && s.userId !== req.auth!.userId) continue;
    if (
      s.fullName.toLowerCase().includes(q) ||
      s.schoolId.toLowerCase().includes(q) ||
      s.admissionNo.toLowerCase().includes(q) ||
      s.className.toLowerCase().includes(q)
    ) {
      results.push({
        id: `stu-${s.id}`,
        title: s.fullName,
        subtitle: `${s.schoolId} • ${s.className}-${s.sectionName}`,
        category: 'Students',
        url: role === 'student' ? '/profile' : '/students',
      });
    }
  }

  // Teachers
  const teachers = schoolService.getEnrichedTeachers();
  for (const t of teachers) {
    if (
      t.fullName.toLowerCase().includes(q) ||
      t.department.toLowerCase().includes(q) ||
      t.designation.toLowerCase().includes(q)
    ) {
      results.push({
        id: `tch-${t.id}`,
        title: t.fullName,
        subtitle: `${t.designation} • ${t.department}`,
        category: 'Teachers',
        url: role === 'student' ? '/contacts' : role === 'teacher' ? '/timetable' : '/staff',
      });
    }
  }

  // Subjects
  const subjects = db.select().from(schema.subjects).all();
  for (const sub of subjects) {
    if (sub.name.toLowerCase().includes(q) || sub.code.toLowerCase().includes(q) || sub.department.toLowerCase().includes(q)) {
      results.push({
        id: `sub-${sub.id}`,
        title: `${sub.name} (${sub.code})`,
        subtitle: `${sub.department} Department`,
        category: 'Subjects',
        url: '/timetable',
      });
    }
  }

  // Assignments
  const assignments = db.select().from(schema.assignments).all();
  for (const a of assignments) {
    if (a.title.toLowerCase().includes(q) || a.description.toLowerCase().includes(q)) {
      results.push({
        id: `asg-${a.id}`,
        title: a.title,
        subtitle: `Due: ${a.dueDate} • Max Marks: ${a.maxMarks}`,
        category: 'Assignments',
        url: '/assignments',
      });
    }
  }

  // Announcements
  const announcements = db.select().from(schema.announcements).all();
  for (const ann of announcements) {
    if (role === 'student' && ann.approvalStatus !== 'approved') continue;
    if (ann.title.toLowerCase().includes(q) || ann.content.toLowerCase().includes(q)) {
      results.push({
        id: `ann-${ann.id}`,
        title: ann.title,
        subtitle: `${ann.category.toUpperCase()} • By ${ann.authorName}`,
        category: 'Announcements',
        url: '/announcements',
      });
    }
  }

  // Events
  const events = db.select().from(schema.schoolEvents).all();
  for (const ev of events) {
    if (ev.isPersonalReminder && ev.ownerUserId !== req.auth!.userId) continue;
    if (ev.title.toLowerCase().includes(q) || ev.location.toLowerCase().includes(q)) {
      results.push({
        id: `evt-${ev.id}`,
        title: ev.title,
        subtitle: `${ev.startDate} • ${ev.location}`,
        category: 'Events',
        url: '/calendar',
      });
    }
  }

  // Library Books
  const books = db.select().from(schema.libraryBooks).all();
  for (const b of books) {
    if (b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q) || b.isbn.toLowerCase().includes(q)) {
      results.push({
        id: `bk-${b.id}`,
        title: b.title,
        subtitle: `${b.author} • ${b.availableCopies} available`,
        category: 'Library',
        url: '/library',
      });
    }
  }

  // Lost & Found
  const lfItems = db.select().from(schema.lostAndFound).all();
  for (const lf of lfItems) {
    if (lf.itemName.toLowerCase().includes(q) || lf.location.toLowerCase().includes(q)) {
      results.push({
        id: `lf-${lf.id}`,
        title: lf.itemName,
        subtitle: `${lf.type.toUpperCase()} at ${lf.location}`,
        category: 'Lost & Found',
        url: '/lost-and-found',
      });
    }
  }

  res.json({ results: results.slice(0, 25) });
});

// ==========================================
// 5. ANNOUNCEMENTS & EMERGENCY ALERTS
// ==========================================

app.get('/api/announcements', requireAuth, (req: Request, res: Response) => {
  const user = req.currentUser!;
  const all = db.select().from(schema.announcements).orderBy(desc(schema.announcements.createdAt)).all();
  const reads = db.select().from(schema.announcementReads).where(eq(schema.announcementReads.userId, user.id)).all();
  const readSet = new Set(reads.map(r => r.announcementId));
  const allReads = db.select().from(schema.announcementReads).all();

  const filtered = all.filter(a => {
    if (user.role === 'principal' || user.role === 'coordinator') return true;
    if (a.authorId === user.id) return true;
    return a.approvalStatus === 'approved';
  });

  const enriched = filtered.map(a => ({
    ...a,
    isRead: readSet.has(a.id),
    readCount: allReads.filter(r => r.announcementId === a.id).length,
  }));

  res.json({ announcements: enriched });
});

app.post('/api/announcements', requireAuth, requireRoles('teacher', 'coordinator', 'principal'), (req: Request, res: Response) => {
  const user = req.currentUser!;
  const {
    title,
    content,
    category,
    priority,
    targetRoles,
    targetClassIds,
    attachmentUrl,
    attachmentName,
    expiresAt,
    isEmergency,
    emergencyInstructions,
  } = req.body;

  if (!title || !content) {
    res.status(400).json({ error: 'Announcement title and content are required.' });
    return;
  }

  // Teachers cannot publish school-wide emergency alerts
  if (user.role === 'teacher' && (isEmergency || category === 'emergency' || category === 'school_wide')) {
    res.status(403).json({ error: 'Teachers can only publish class-specific or academic announcements, not school-wide or emergency alerts.' });
    return;
  }

  // Determine approval status:
  // - Principal announcements & Emergency alerts bypass queue and publish immediately.
  // - Coordinator normal announcements go to 'pending_approval' for Principal review unless emergency.
  // - Teacher class announcements are approved immediately.
  let approvalStatus = 'approved';
  if (user.role === 'coordinator' && !isEmergency && category !== 'emergency') {
    approvalStatus = 'pending_approval';
  }

  const now = new Date().toISOString();
  const result = db.insert(schema.announcements).values({
    title: String(title).trim(),
    content: String(content).trim(),
    category: isEmergency ? 'emergency' : (category || 'academic'),
    priority: isEmergency ? 'critical' : (priority || 'normal'),
    targetRolesJson: JSON.stringify(targetRoles || ['student', 'teacher', 'coordinator', 'principal']),
    targetClassIdsJson: JSON.stringify(targetClassIds || []),
    authorId: user.id,
    authorName: `${user.fullName} (${user.role.charAt(0).toUpperCase() + user.role.slice(1)})`,
    authorRole: user.role,
    attachmentUrl: attachmentUrl || null,
    attachmentName: attachmentName || null,
    approvalStatus,
    approvedById: approvalStatus === 'approved' ? user.id : null,
    publishedAt: now,
    expiresAt: expiresAt || null,
    isEmergency: Boolean(isEmergency),
    emergencyInstructions: emergencyInstructions || null,
    createdAt: now,
  }).run();

  if (approvalStatus === 'approved') {
    schoolService.broadcastNotification(
      targetRoles || ['student', 'teacher', 'coordinator', 'principal'],
      isEmergency ? `EMERGENCY ALERT: ${title}` : `New Announcement: ${title}`,
      String(content).slice(0, 120),
      isEmergency ? 'emergency' : 'announcement',
      '/announcements',
      isEmergency ? 'critical' : 'normal'
    );
  } else {
    // Notify Principal of pending approval
    schoolService.broadcastNotification(
      ['principal'],
      `Approval Required: ${title}`,
      `${user.fullName} submitted an announcement for executive approval.`,
      'announcement',
      '/announcements',
      'important'
    );
  }

  schoolService.logAudit(
    user,
    isEmergency ? 'PUBLISH_EMERGENCY_ALERT' : 'CREATE_ANNOUNCEMENT',
    'announcement',
    Number(result.lastInsertRowid),
    `${user.fullName} created announcement "${title}" (${approvalStatus}).`
  );

  res.json({ success: true, id: Number(result.lastInsertRowid), approvalStatus });
});

app.patch('/api/announcements/:id/approval', requireAuth, requireRoles('principal', 'coordinator'), (req: Request, res: Response) => {
  const user = req.currentUser!;
  const annId = Number(req.params.id);
  const { approvalStatus, rejectionRemarks, title, content } = req.body;

  const existing = db.select().from(schema.announcements).where(eq(schema.announcements.id, annId)).get();
  if (!existing) {
    res.status(404).json({ error: 'Announcement not found.' });
    return;
  }

  // Coordinator can edit & resubmit a rejected announcement
  if (user.role === 'coordinator') {
    db.update(schema.announcements)
      .set({
        title: title ?? existing.title,
        content: content ?? existing.content,
        approvalStatus: 'pending_approval',
        rejectionRemarks: null,
      })
      .where(eq(schema.announcements.id, annId))
      .run();
    res.json({ success: true });
    return;
  }

  // Principal approves or rejects
  db.update(schema.announcements)
    .set({
      approvalStatus,
      approvedById: user.id,
      rejectionRemarks: approvalStatus === 'rejected' ? (rejectionRemarks || 'Requires revision.') : null,
      publishedAt: new Date().toISOString(),
    })
    .where(eq(schema.announcements.id, annId))
    .run();

  if (approvalStatus === 'approved') {
    schoolService.broadcastNotification(
      ['student', 'teacher', 'coordinator'],
      `Announcement Published: ${existing.title}`,
      existing.content.slice(0, 120),
      'announcement',
      '/announcements',
      existing.priority
    );
  } else if (approvalStatus === 'rejected') {
    schoolService.createNotification(
      existing.authorId,
      `Announcement Returned for Revision: ${existing.title}`,
      `Principal Remarks: ${rejectionRemarks || 'Please revise and resubmit.'}`,
      'announcement',
      '/announcements',
      'important'
    );
  }

  schoolService.logAudit(user, `ANNOUNCEMENT_${String(approvalStatus).toUpperCase()}`, 'announcement', annId, `Marked "${existing.title}" as ${approvalStatus}.`);
  res.json({ success: true });
});

app.post('/api/announcements/:id/read', requireAuth, (req: Request, res: Response) => {
  const user = req.currentUser!;
  const annId = Number(req.params.id);
  const existing = db
    .select()
    .from(schema.announcementReads)
    .where(and(eq(schema.announcementReads.announcementId, annId), eq(schema.announcementReads.userId, user.id)))
    .get();

  if (!existing) {
    db.insert(schema.announcementReads).values({
      announcementId: annId,
      userId: user.id,
      readAt: new Date().toISOString(),
    }).run();
  }
  res.json({ success: true });
});

// ==========================================
// 6. NOTIFICATIONS ENDPOINTS
// ==========================================

app.get('/api/notifications', requireAuth, (req: Request, res: Response) => {
  const list = db
    .select()
    .from(schema.notifications)
    .where(eq(schema.notifications.userId, req.currentUser!.id))
    .orderBy(desc(schema.notifications.createdAt))
    .all();
  res.json({
    notifications: list,
    unreadCount: list.filter(n => !n.isRead).length,
  });
});

app.patch('/api/notifications/:id/read', requireAuth, (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const { isRead } = req.body;
  db.update(schema.notifications)
    .set({ isRead: isRead !== undefined ? Boolean(isRead) : true })
    .where(and(eq(schema.notifications.id, id), eq(schema.notifications.userId, req.currentUser!.id)))
    .run();
  res.json({ success: true });
});

app.post('/api/notifications/read-all', requireAuth, (req: Request, res: Response) => {
  db.update(schema.notifications)
    .set({ isRead: true })
    .where(eq(schema.notifications.userId, req.currentUser!.id))
    .run();
  res.json({ success: true });
});

app.delete('/api/notifications/clear', requireAuth, (req: Request, res: Response) => {
  db.delete(schema.notifications)
    .where(eq(schema.notifications.userId, req.currentUser!.id))
    .run();
  res.json({ success: true });
});

// ==========================================
// 7. ATTENDANCE & CORRECTIONS
// ==========================================

app.get('/api/attendance', requireAuth, (req: Request, res: Response) => {
  const user = req.currentUser!;
  const allAtt = db.select().from(schema.attendance).orderBy(desc(schema.attendance.date)).all();
  const corrections = db.select().from(schema.attendanceCorrections).orderBy(desc(schema.attendanceCorrections.createdAt)).all();
  const students = schoolService.getEnrichedStudents();
  const subjects = db.select().from(schema.subjects).all();
  const classes = db.select().from(schema.classes).all();
  const sections = db.select().from(schema.sections).all();
  const teachers = schoolService.getEnrichedTeachers();

  if (user.role === 'student') {
    const stu = students.find(s => s.userId === user.id);
    if (!stu) {
      res.status(404).json({ error: 'Student profile not found.' });
      return;
    }
    const ownRecords = allAtt
      .filter(a => a.studentId === stu.id)
      .map(a => ({
        ...a,
        subjectName: a.subjectId ? subjects.find(sub => sub.id === a.subjectId)?.name || 'Subject' : 'Daily Homeroom',
      }));
    const ownCorrections = corrections.filter(c => c.studentId === stu.id);

    res.json({
      student: stu,
      records: ownRecords,
      corrections: ownCorrections,
      subjects,
    });
    return;
  }

  // Staff view (Teacher, Coordinator, Principal)
  const enrichedCorrections = corrections.map(c => {
    const stu = students.find(s => s.id === c.studentId);
    return {
      ...c,
      studentName: stu?.fullName || 'Student',
      className: stu?.className || '',
      sectionName: stu?.sectionName || '',
    };
  });

  res.json({
    records: allAtt,
    corrections: enrichedCorrections,
    students,
    teachers,
    classes,
    sections,
    subjects,
  });
});

app.post('/api/attendance/mark', requireAuth, requireRoles('teacher', 'coordinator', 'principal'), (req: Request, res: Response) => {
  const user = req.currentUser!;
  const { date, classId, sectionId, subjectId, entries } = req.body;
  // entries: Array<{ studentId: number, status: string, remarks?: string }>
  if (!date || !classId || !sectionId || !Array.isArray(entries)) {
    res.status(400).json({ error: 'Date, class, section, and student attendance entries are required.' });
    return;
  }

  const now = new Date().toISOString();
  const targetSubjectId = subjectId ? Number(subjectId) : null;
  const students = schoolService.getEnrichedStudents();

  for (const entry of entries) {
    const existing = db
      .select()
      .from(schema.attendance)
      .where(
        and(
          eq(schema.attendance.studentId, Number(entry.studentId)),
          eq(schema.attendance.date, String(date))
        )
      )
      .all()
      .find(r => r.subjectId === targetSubjectId);

    if (existing) {
      db.update(schema.attendance)
        .set({
          status: entry.status,
          remarks: entry.remarks || null,
          markedById: user.id,
          updatedAt: now,
        })
        .where(eq(schema.attendance.id, existing.id))
        .run();
    } else {
      db.insert(schema.attendance).values({
        studentId: Number(entry.studentId),
        classId: Number(classId),
        sectionId: Number(sectionId),
        subjectId: targetSubjectId,
        date: String(date),
        status: entry.status,
        markedById: user.id,
        remarks: entry.remarks || null,
        updatedAt: now,
      }).run();
    }

    // Notify student if marked absent or late
    if (entry.status === 'absent' || entry.status === 'late') {
      const stu = students.find(s => s.id === Number(entry.studentId));
      if (stu) {
        schoolService.createNotification(
          stu.userId,
          `Attendance Marked: ${entry.status.toUpperCase()} (${date})`,
          `Your attendance for ${date} was recorded as ${entry.status} by ${user.fullName}.`,
          'attendance',
          '/attendance',
          entry.status === 'absent' ? 'important' : 'normal'
        );
      }
    }
  }

  schoolService.logAudit(
    user,
    'MARK_ATTENDANCE',
    'attendance',
    `${classId}-${sectionId}-${date}`,
    `Marked attendance for ${entries.length} students on ${date}.`
  );

  res.json({ success: true });
});

app.post('/api/attendance/correction', requireAuth, requireRoles('student'), (req: Request, res: Response) => {
  const user = req.currentUser!;
  const stu = db.select().from(schema.students).where(eq(schema.students.userId, user.id)).get();
  if (!stu) {
    res.status(404).json({ error: 'Student profile not found.' });
    return;
  }

  const { attendanceId, requestedStatus, reason } = req.body;
  const att = db.select().from(schema.attendance).where(eq(schema.attendance.id, Number(attendanceId))).get();
  if (!att || att.studentId !== stu.id) {
    res.status(404).json({ error: 'Attendance record not found.' });
    return;
  }

  db.insert(schema.attendanceCorrections).values({
    attendanceId: att.id,
    studentId: stu.id,
    date: att.date,
    currentStatus: att.status,
    requestedStatus: String(requestedStatus),
    reason: String(reason),
    status: 'pending',
    createdAt: new Date().toISOString(),
  }).run();

  schoolService.broadcastNotification(
    ['teacher', 'coordinator'],
    `Attendance Correction Request: ${user.fullName}`,
    `Requested change from ${att.status} to ${requestedStatus} for ${att.date}.`,
    'attendance',
    '/attendance'
  );

  res.json({ success: true });
});

app.patch('/api/attendance/correction/:id', requireAuth, requireRoles('teacher', 'coordinator', 'principal'), (req: Request, res: Response) => {
  const user = req.currentUser!;
  const corrId = Number(req.params.id);
  const { status, reviewRemarks } = req.body;

  const corr = db.select().from(schema.attendanceCorrections).where(eq(schema.attendanceCorrections.id, corrId)).get();
  if (!corr) {
    res.status(404).json({ error: 'Correction request not found.' });
    return;
  }

  db.update(schema.attendanceCorrections)
    .set({
      status,
      reviewedById: user.id,
      reviewRemarks: reviewRemarks || null,
    })
    .where(eq(schema.attendanceCorrections.id, corrId))
    .run();

  if (status === 'approved') {
    db.update(schema.attendance)
      .set({
        status: corr.requestedStatus,
        remarks: `Corrected via request #${corr.id}: ${reviewRemarks || 'Approved'}`,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(schema.attendance.id, corr.attendanceId))
      .run();
  }

  const stu = db.select().from(schema.students).where(eq(schema.students.id, corr.studentId)).get();
  if (stu) {
    schoolService.createNotification(
      stu.userId,
      `Attendance Correction ${status.toUpperCase()} (${corr.date})`,
      reviewRemarks || `Your attendance correction request for ${corr.date} was ${status}.`,
      'attendance',
      '/attendance'
    );
  }

  schoolService.logAudit(user, 'REVIEW_ATTENDANCE_CORRECTION', 'attendance_correction', corrId, `Marked correction #${corrId} as ${status}.`);
  res.json({ success: true });
});

// ==========================================
// 8. TIMETABLE ENDPOINTS
// ==========================================

app.get('/api/timetable', requireAuth, (_req: Request, res: Response) => {
  const allTimetables = db.select().from(schema.timetables).all();
  const subjects = db.select().from(schema.subjects).all();
  const classes = db.select().from(schema.classes).all();
  const sections = db.select().from(schema.sections).all();
  const teachers = schoolService.getEnrichedTeachers();

  const enriched = allTimetables.map(t => ({
    ...t,
    subjectName: subjects.find(s => s.id === t.subjectId)?.name || t.breakLabel || 'Break',
    subjectCode: subjects.find(s => s.id === t.subjectId)?.code || '',
    teacherName: teachers.find(tc => tc.id === t.teacherId)?.fullName || '',
    substitutionTeacherName: teachers.find(tc => tc.id === t.substitutionTeacherId)?.fullName || '',
    className: classes.find(c => c.id === t.classId)?.name || '',
    sectionName: sections.find(s => s.id === t.sectionId)?.name || '',
  }));

  res.json({ timetables: enriched, classes, sections, subjects, teachers });
});

app.patch('/api/timetable/:id', requireAuth, requireRoles('coordinator', 'principal', 'teacher'), (req: Request, res: Response) => {
  const user = req.currentUser!;
  const id = Number(req.params.id);
  const { status, substitutionTeacherId, statusNote, roomNumber } = req.body;

  db.update(schema.timetables)
    .set({
      status: status || 'scheduled',
      substitutionTeacherId: substitutionTeacherId ? Number(substitutionTeacherId) : null,
      statusNote: statusNote || null,
      roomNumber: roomNumber || undefined,
    })
    .where(eq(schema.timetables.id, id))
    .run();

  schoolService.broadcastNotification(
    ['student', 'teacher'],
    `Timetable Update: Period Status Changed (${status})`,
    statusNote || 'A timetable slot has been updated.',
    'timetable',
    '/timetable'
  );

  schoolService.logAudit(user, 'UPDATE_TIMETABLE', 'timetable', id, `Updated timetable slot #${id} to ${status}.`);
  res.json({ success: true });
});

// ==========================================
// 9. ASSIGNMENTS & SUBMISSIONS
// ==========================================

app.get('/api/assignments', requireAuth, (req: Request, res: Response) => {
  const user = req.currentUser!;
  const allAssignments = db.select().from(schema.assignments).orderBy(desc(schema.assignments.createdAt)).all();
  const allSubmissions = db.select().from(schema.assignmentSubmissions).all();
  const subjects = db.select().from(schema.subjects).all();
  const classes = db.select().from(schema.classes).all();
  const sections = db.select().from(schema.sections).all();
  const teachers = schoolService.getEnrichedTeachers();
  const students = schoolService.getEnrichedStudents();

  if (user.role === 'student') {
    const stu = students.find(s => s.userId === user.id) || students[0];
    const filtered = allAssignments
      .filter(a => a.classId === stu.classId && a.sectionId === stu.sectionId)
      .map(a => {
        const sub = allSubmissions.find(s => s.assignmentId === a.id && s.studentId === stu.id);
        return {
          ...a,
          subjectName: subjects.find(s => s.id === a.subjectId)?.name || '',
          subjectCode: subjects.find(s => s.id === a.subjectId)?.code || '',
          teacherName: teachers.find(t => t.id === a.teacherId)?.fullName || '',
          submission: sub || {
            id: 0,
            assignmentId: a.id,
            studentId: stu.id,
            status: 'assigned',
            textContent: null,
            fileUrl: null,
            fileName: null,
            submittedAt: null,
            marksObtained: null,
            grade: null,
            teacherRemarks: null,
            resubmissionRequested: false,
          },
        };
      });

    res.json({ assignments: filtered, subjects, classes, sections });
    return;
  }

  // Teacher, Coordinator, Principal view
  const enriched = allAssignments.map(a => {
    const subs = allSubmissions
      .filter(s => s.assignmentId === a.id)
      .map(s => {
        const stu = students.find(st => st.id === s.studentId);
        return {
          ...s,
          studentName: stu?.fullName || 'Student',
          admissionNo: stu?.admissionNo || '',
          rollNo: stu?.rollNo || 0,
        };
      });

    return {
      ...a,
      subjectName: subjects.find(s => s.id === a.subjectId)?.name || '',
      subjectCode: subjects.find(s => s.id === a.subjectId)?.code || '',
      teacherName: teachers.find(t => t.id === a.teacherId)?.fullName || '',
      className: classes.find(c => c.id === a.classId)?.name || '',
      sectionName: sections.find(s => s.id === a.sectionId)?.name || '',
      submissions: subs,
    };
  });

  res.json({ assignments: enriched, subjects, classes, sections, students });
});

app.post('/api/assignments', requireAuth, requireRoles('teacher', 'coordinator', 'principal'), (req: Request, res: Response) => {
  const user = req.currentUser!;
  const { title, description, instructions, classId, sectionId, subjectId, dueDate, maxMarks, attachmentUrl, attachmentName } = req.body;

  if (!title || !classId || !sectionId || !subjectId || !dueDate) {
    res.status(400).json({ error: 'Title, class, section, subject, and due date are required.' });
    return;
  }

  const teacherRecord = db.select().from(schema.teachers).where(eq(schema.teachers.userId, user.id)).get();
  const teacherId = teacherRecord ? teacherRecord.id : 1;

  const now = new Date().toISOString();
  const result = db.insert(schema.assignments).values({
    title: String(title).trim(),
    description: String(description || ''),
    instructions: String(instructions || ''),
    classId: Number(classId),
    sectionId: Number(sectionId),
    subjectId: Number(subjectId),
    teacherId,
    dueDate: String(dueDate),
    maxMarks: Number(maxMarks || 100),
    attachmentUrl: attachmentUrl || null,
    attachmentName: attachmentName || null,
    academicYearId: 1,
    createdAt: now,
  }).run();

  const newAssignmentId = Number(result.lastInsertRowid);

  // Automatically create 'assigned' submission rows and notify all students in that class/section!
  const targetStudents = db
    .select()
    .from(schema.students)
    .where(and(eq(schema.students.classId, Number(classId)), eq(schema.students.sectionId, Number(sectionId))))
    .all();

  for (const stu of targetStudents) {
    db.insert(schema.assignmentSubmissions).values({
      assignmentId: newAssignmentId,
      studentId: stu.id,
      status: 'assigned',
      resubmissionRequested: false,
    }).run();

    schoolService.createNotification(
      stu.userId,
      `New Assignment: ${title}`,
      `Due on ${dueDate}. Check instructions and reference files.`,
      'assignment',
      '/assignments'
    );
  }

  schoolService.logAudit(user, 'CREATE_ASSIGNMENT', 'assignment', newAssignmentId, `Created assignment "${title}" for Class ${classId}-${sectionId}.`);
  res.json({ success: true, id: newAssignmentId });
});

app.post('/api/assignments/:id/submit', requireAuth, requireRoles('student'), (req: Request, res: Response) => {
  const user = req.currentUser!;
  const assignmentId = Number(req.params.id);
  const { textContent, fileUrl, fileName, status } = req.body;

  const stu = db.select().from(schema.students).where(eq(schema.students.userId, user.id)).get();
  if (!stu) {
    res.status(404).json({ error: 'Student profile not found.' });
    return;
  }

  const assignment = db.select().from(schema.assignments).where(eq(schema.assignments.id, assignmentId)).get();
  if (!assignment) {
    res.status(404).json({ error: 'Assignment not found.' });
    return;
  }

  const existing = db
    .select()
    .from(schema.assignmentSubmissions)
    .where(and(eq(schema.assignmentSubmissions.assignmentId, assignmentId), eq(schema.assignmentSubmissions.studentId, stu.id)))
    .get();

  const targetStatus = status === 'in_progress' ? 'in_progress' : 'submitted';
  const now = new Date().toISOString();

  if (existing) {
    db.update(schema.assignmentSubmissions)
      .set({
        status: targetStatus,
        textContent: textContent ?? existing.textContent,
        fileUrl: fileUrl ?? existing.fileUrl,
        fileName: fileName ?? existing.fileName,
        submittedAt: targetStatus === 'submitted' ? now : existing.submittedAt,
        resubmissionRequested: false,
      })
      .where(eq(schema.assignmentSubmissions.id, existing.id))
      .run();
  } else {
    db.insert(schema.assignmentSubmissions).values({
      assignmentId,
      studentId: stu.id,
      status: targetStatus,
      textContent: textContent || null,
      fileUrl: fileUrl || null,
      fileName: fileName || null,
      submittedAt: targetStatus === 'submitted' ? now : null,
      resubmissionRequested: false,
    }).run();
  }

  if (targetStatus === 'submitted') {
    const teacher = db.select().from(schema.teachers).where(eq(schema.teachers.id, assignment.teacherId)).get();
    if (teacher) {
      schoolService.createNotification(
        teacher.userId,
        `Assignment Submitted: ${user.fullName}`,
        `${user.fullName} submitted "${assignment.title}".`,
        'assignment',
        '/assignments'
      );
    }
  }

  res.json({ success: true });
});

app.patch('/api/submissions/:id/grade', requireAuth, requireRoles('teacher', 'coordinator', 'principal'), (req: Request, res: Response) => {
  const user = req.currentUser!;
  const subId = Number(req.params.id);
  const { marksObtained, grade, teacherRemarks, status, resubmissionRequested } = req.body;

  const existing = db.select().from(schema.assignmentSubmissions).where(eq(schema.assignmentSubmissions.id, subId)).get();
  if (!existing) {
    res.status(404).json({ error: 'Submission not found.' });
    return;
  }

  const finalStatus = resubmissionRequested ? 'in_progress' : (status || 'graded');
  db.update(schema.assignmentSubmissions)
    .set({
      marksObtained: marksObtained !== undefined ? Number(marksObtained) : existing.marksObtained,
      grade: grade || existing.grade,
      teacherRemarks: teacherRemarks ?? existing.teacherRemarks,
      status: finalStatus,
      resubmissionRequested: Boolean(resubmissionRequested),
      gradedById: user.id,
      gradedAt: new Date().toISOString(),
    })
    .where(eq(schema.assignmentSubmissions.id, subId))
    .run();

  const stu = db.select().from(schema.students).where(eq(schema.students.id, existing.studentId)).get();
  const assignment = db.select().from(schema.assignments).where(eq(schema.assignments.id, existing.assignmentId)).get();
  if (stu && assignment) {
    schoolService.createNotification(
      stu.userId,
      resubmissionRequested
        ? `Resubmission Requested: ${assignment.title}`
        : `Assignment Graded: ${assignment.title} (${marksObtained}/${assignment.maxMarks})`,
      teacherRemarks || `Your submission has been reviewed by ${user.fullName}.`,
      'grading',
      '/assignments'
    );
  }

  schoolService.logAudit(user, 'GRADE_SUBMISSION', 'assignment_submission', subId, `Graded submission #${subId} (${marksObtained} marks, ${grade}).`);
  res.json({ success: true });
});

// ==========================================
// 10. EXAMINATIONS, MARKS & REPORT CARDS
// ==========================================

app.get('/api/examinations', requireAuth, (req: Request, res: Response) => {
  const user = req.currentUser!;
  const exams = db.select().from(schema.examinations).all();
  const schedules = db.select().from(schema.examSchedules).all();
  const allMarks = db.select().from(schema.marks).all();
  const reportCards = db.select().from(schema.reportCards).all();
  const subjects = db.select().from(schema.subjects).all();
  const classes = db.select().from(schema.classes).all();
  const students = schoolService.getEnrichedStudents();

  const enrichedSchedules = schedules.map(s => ({
    ...s,
    subjectName: subjects.find(sub => sub.id === s.subjectId)?.name || '',
    subjectCode: subjects.find(sub => sub.id === s.subjectId)?.code || '',
  }));

  const enrichedMarks = allMarks.map(m => ({
    ...m,
    subjectName: subjects.find(sub => sub.id === m.subjectId)?.name || '',
    subjectCode: subjects.find(sub => sub.id === m.subjectId)?.code || '',
    studentName: students.find(st => st.id === m.studentId)?.fullName || '',
    examinationName: exams.find(e => e.id === m.examinationId)?.name || '',
  }));

  if (user.role === 'student') {
    const stu = students.find(s => s.userId === user.id) || students[0];
    res.json({
      examinations: exams.filter(e => e.classId === stu.classId),
      schedules: enrichedSchedules,
      marks: enrichedMarks.filter(m => m.studentId === stu.id),
      reportCards: reportCards.filter(r => r.studentId === stu.id),
      subjects,
      student: stu,
    });
    return;
  }

  res.json({
    examinations: exams,
    schedules: enrichedSchedules,
    marks: enrichedMarks,
    reportCards,
    subjects,
    classes,
    students,
  });
});

app.post('/api/examinations', requireAuth, requireRoles('teacher', 'coordinator', 'principal'), (req: Request, res: Response) => {
  const user = req.currentUser!;
  const { name, term, classId, startDate, endDate, status, description } = req.body;
  if (!name || !classId || !startDate || !endDate) {
    res.status(400).json({ error: 'Examination name, class, start date, and end date are required.' });
    return;
  }

  const result = db.insert(schema.examinations).values({
    name: String(name),
    term: String(term || 'Term 1'),
    academicYearId: 1,
    classId: Number(classId),
    startDate: String(startDate),
    endDate: String(endDate),
    status: status || 'upcoming',
    description: description || null,
  }).run();

  schoolService.broadcastNotification(
    ['student', 'teacher'],
    `New Examination Scheduled: ${name}`,
    `Scheduled from ${startDate} to ${endDate}.`,
    'exam',
    '/examinations'
  );

  schoolService.logAudit(user, 'CREATE_EXAMINATION', 'examination', Number(result.lastInsertRowid), `Scheduled examination "${name}".`);
  res.json({ success: true, id: Number(result.lastInsertRowid) });
});

app.post('/api/examinations/:id/marks', requireAuth, requireRoles('teacher', 'coordinator', 'principal'), (req: Request, res: Response) => {
  const user = req.currentUser!;
  const examinationId = Number(req.params.id);
  const { studentId, subjectId, marksObtained, maxMarks, grade, teacherRemarks } = req.body;

  if (!studentId || !subjectId || marksObtained === undefined) {
    res.status(400).json({ error: 'Student, subject, and marks obtained are required.' });
    return;
  }

  const numMarks = Number(marksObtained);
  const numMax = Number(maxMarks || 100);
  const pct = (numMarks / numMax) * 100;
  const computedGrade = grade || (pct >= 90 ? 'A+' : pct >= 80 ? 'A' : pct >= 70 ? 'B+' : pct >= 60 ? 'B' : pct >= 50 ? 'C' : 'D');
  const now = new Date().toISOString();

  const existing = db
    .select()
    .from(schema.marks)
    .where(
      and(
        eq(schema.marks.examinationId, examinationId),
        eq(schema.marks.studentId, Number(studentId)),
        eq(schema.marks.subjectId, Number(subjectId))
      )
    )
    .get();

  if (existing) {
    db.update(schema.marks)
      .set({
        marksObtained: numMarks,
        maxMarks: numMax,
        grade: computedGrade,
        teacherRemarks: teacherRemarks ?? existing.teacherRemarks,
        enteredById: user.id,
        updatedAt: now,
      })
      .where(eq(schema.marks.id, existing.id))
      .run();
  } else {
    db.insert(schema.marks).values({
      examinationId,
      examScheduleId: null,
      studentId: Number(studentId),
      subjectId: Number(subjectId),
      marksObtained: numMarks,
      maxMarks: numMax,
      grade: computedGrade,
      teacherRemarks: teacherRemarks || null,
      enteredById: user.id,
      updatedAt: now,
    }).run();
  }

  const stu = db.select().from(schema.students).where(eq(schema.students.id, Number(studentId))).get();
  if (stu) {
    schoolService.createNotification(
      stu.userId,
      `Examination Marks Updated (${computedGrade})`,
      `Your marks (${numMarks}/${numMax}) have been published in the Examinations portal.`,
      'exam',
      '/examinations'
    );
  }

  schoolService.logAudit(user, 'ENTER_EXAM_MARKS', 'marks', `${examinationId}-${studentId}-${subjectId}`, `Entered ${numMarks}/${numMax} (${computedGrade}) for student #${studentId}.`);
  res.json({ success: true });
});

// ==========================================
// 11. STUDENT PORTFOLIOS & TEACHER FEEDBACK
// ==========================================

app.get('/api/portfolios', requireAuth, (req: Request, res: Response) => {
  const user = req.currentUser!;
  const students = schoolService.getEnrichedStudents();
  const teachers = schoolService.getEnrichedTeachers();
  const portfolios = db.select().from(schema.studentPortfolios).all();
  const entries = db.select().from(schema.portfolioEntries).orderBy(desc(schema.portfolioEntries.dateAchieved)).all();
  const feedbacks = db.select().from(schema.teacherFeedback).orderBy(desc(schema.teacherFeedback.createdAt)).all();

  const enrichedFeedbacks = feedbacks.map(f => ({
    ...f,
    teacherName: teachers.find(t => t.id === f.teacherId)?.fullName || 'Faculty Member',
    studentName: students.find(s => s.id === f.studentId)?.fullName || 'Student',
  }));

  const enrichedEntries = entries.map(e => ({
    ...e,
    studentName: students.find(s => s.id === e.studentId)?.fullName || 'Student',
    className: students.find(s => s.id === e.studentId)?.className || '',
  }));

  if (user.role === 'student') {
    const stu = students.find(s => s.userId === user.id) || students[0];
    const portfolio = portfolios.find(p => p.studentId === stu.id) || {
      id: 0,
      studentId: stu.id,
      headline: `${stu.className} Scholar at Veritas Collegiate Academy`,
      introduction: 'Dedicated student passionate about academic inquiry and leadership.',
      skillsJson: '["Critical Thinking","Research"]',
      extracurricularJson: '["Debate Society"]',
      careerGoals: 'Higher Education & Research',
      updatedAt: new Date().toISOString(),
    };

    res.json({
      student: stu,
      portfolio: {
        ...portfolio,
        skills: JSON.parse(portfolio.skillsJson || '[]'),
        extracurriculars: JSON.parse(portfolio.extracurricularJson || '[]'),
      },
      entries: enrichedEntries.filter(e => e.studentId === stu.id),
      feedback: enrichedFeedbacks.filter(f => f.studentId === stu.id),
    });
    return;
  }

  res.json({
    students,
    portfolios: portfolios.map(p => ({
      ...p,
      skills: JSON.parse(p.skillsJson || '[]'),
      extracurriculars: JSON.parse(p.extracurricularJson || '[]'),
    })),
    entries: enrichedEntries,
    feedback: enrichedFeedbacks,
  });
});

app.patch('/api/portfolios/profile', requireAuth, requireRoles('student'), (req: Request, res: Response) => {
  const user = req.currentUser!;
  const stu = db.select().from(schema.students).where(eq(schema.students.userId, user.id)).get();
  if (!stu) {
    res.status(404).json({ error: 'Student not found.' });
    return;
  }

  const { headline, introduction, skills, extracurriculars, careerGoals } = req.body;
  const existing = db.select().from(schema.studentPortfolios).where(eq(schema.studentPortfolios.studentId, stu.id)).get();
  const now = new Date().toISOString();

  if (existing) {
    db.update(schema.studentPortfolios)
      .set({
        headline: headline ?? existing.headline,
        introduction: introduction ?? existing.introduction,
        skillsJson: skills ? JSON.stringify(skills) : existing.skillsJson,
        extracurricularJson: extracurriculars ? JSON.stringify(extracurriculars) : existing.extracurricularJson,
        careerGoals: careerGoals ?? existing.careerGoals,
        updatedAt: now,
      })
      .where(eq(schema.studentPortfolios.id, existing.id))
      .run();
  } else {
    db.insert(schema.studentPortfolios).values({
      studentId: stu.id,
      headline: String(headline || ''),
      introduction: String(introduction || ''),
      skillsJson: JSON.stringify(skills || []),
      extracurricularJson: JSON.stringify(extracurriculars || []),
      careerGoals: String(careerGoals || ''),
      updatedAt: now,
    }).run();
  }

  res.json({ success: true });
});

app.post('/api/portfolios/entries', requireAuth, (req: Request, res: Response) => {
  const user = req.currentUser!;
  const { studentId, title, category, description, dateAchieved, issuerOrEvent, attachmentUrl } = req.body;

  let targetStudentId = Number(studentId);
  if (user.role === 'student') {
    const stu = db.select().from(schema.students).where(eq(schema.students.userId, user.id)).get();
    if (!stu) {
      res.status(404).json({ error: 'Student not found.' });
      return;
    }
    targetStudentId = stu.id;
  }

  const isStaff = user.role !== 'student';
  const result = db.insert(schema.portfolioEntries).values({
    studentId: targetStudentId,
    title: String(title),
    category: String(category || 'academic'),
    description: String(description || ''),
    dateAchieved: String(dateAchieved || new Date().toISOString().slice(0, 10)),
    issuerOrEvent: String(issuerOrEvent || 'Veritas Collegiate Academy'),
    attachmentUrl: attachmentUrl || null,
    verificationStatus: isStaff ? 'approved' : 'pending',
    verifiedById: isStaff ? user.id : null,
    teacherRemarks: isStaff ? 'Added and verified by faculty.' : null,
    createdAt: new Date().toISOString(),
  }).run();

  if (!isStaff) {
    schoolService.broadcastNotification(
      ['teacher', 'coordinator'],
      `Portfolio Entry Submitted: ${user.fullName}`,
      `${user.fullName} submitted "${title}" for faculty verification.`,
      'announcement',
      '/portfolio'
    );
  }

  res.json({ success: true, id: Number(result.lastInsertRowid) });
});

app.patch('/api/portfolios/entries/:id/verify', requireAuth, requireRoles('teacher', 'coordinator', 'principal'), (req: Request, res: Response) => {
  const user = req.currentUser!;
  const entryId = Number(req.params.id);
  const { verificationStatus, teacherRemarks } = req.body;

  const entry = db.select().from(schema.portfolioEntries).where(eq(schema.portfolioEntries.id, entryId)).get();
  if (!entry) {
    res.status(404).json({ error: 'Portfolio entry not found.' });
    return;
  }

  db.update(schema.portfolioEntries)
    .set({
      verificationStatus,
      verifiedById: user.id,
      teacherRemarks: teacherRemarks || null,
    })
    .where(eq(schema.portfolioEntries.id, entryId))
    .run();

  const stu = db.select().from(schema.students).where(eq(schema.students.id, entry.studentId)).get();
  if (stu) {
    schoolService.createNotification(
      stu.userId,
      `Portfolio Milestone ${verificationStatus.toUpperCase()}: ${entry.title}`,
      teacherRemarks || `Reviewed by ${user.fullName}.`,
      'grading',
      '/portfolio'
    );
  }

  schoolService.logAudit(user, 'VERIFY_PORTFOLIO_ENTRY', 'portfolio_entry', entryId, `Marked portfolio entry "${entry.title}" as ${verificationStatus}.`);
  res.json({ success: true });
});

app.post('/api/feedback', requireAuth, requireRoles('teacher', 'coordinator', 'principal'), (req: Request, res: Response) => {
  const user = req.currentUser!;
  const { studentId, category, rating, comment, areasOfImprovement } = req.body;
  if (!studentId || !category || !comment) {
    res.status(400).json({ error: 'Student, category, and feedback comment are required.' });
    return;
  }

  const teacherRecord = db.select().from(schema.teachers).where(eq(schema.teachers.userId, user.id)).get();
  const teacherId = teacherRecord ? teacherRecord.id : 1;

  db.insert(schema.teacherFeedback).values({
    studentId: Number(studentId),
    teacherId,
    category: String(category),
    rating: Number(rating || 5),
    comment: String(comment),
    areasOfImprovement: areasOfImprovement || null,
    createdAt: new Date().toISOString(),
  }).run();

  const stu = db.select().from(schema.students).where(eq(schema.students.id, Number(studentId))).get();
  if (stu) {
    schoolService.createNotification(
      stu.userId,
      `New Faculty Feedback from ${user.fullName}`,
      comment.slice(0, 100),
      'grading',
      '/portfolio'
    );
  }

  res.json({ success: true });
});

// ==========================================
// 12. TRANSPORT ENDPOINTS
// ==========================================

app.get('/api/transport', requireAuth, (req: Request, res: Response) => {
  const user = req.currentUser!;
  const routes = db.select().from(schema.transportRoutes).all();
  const vehicles = db.select().from(schema.vehicles).all();
  const drivers = db.select().from(schema.drivers).all();
  const issues = db.select().from(schema.transportIssues).orderBy(desc(schema.transportIssues.createdAt)).all();
  const students = schoolService.getEnrichedStudents();

  const enrichedRoutes = routes.map(r => {
    const vehicle = vehicles.find(v => v.id === r.vehicleId);
    const driver = drivers.find(d => d.id === r.driverId);
    const assignedStudents = students.filter(s => s.routeId === r.id);
    return {
      ...r,
      stops: JSON.parse(r.stopsJson || '[]'),
      vehicle,
      driver,
      assignedStudentCount: assignedStudents.length,
      assignedStudents,
    };
  });

  let studentRoute = null;
  if (user.role === 'student') {
    const stu = students.find(s => s.userId === user.id);
    if (stu && stu.routeId) {
      studentRoute = enrichedRoutes.find(r => r.id === stu.routeId) || null;
    }
  }

  res.json({
    routes: enrichedRoutes,
    vehicles,
    drivers,
    issues,
    studentRoute,
    students,
  });
});

app.post('/api/transport/issues', requireAuth, (req: Request, res: Response) => {
  const user = req.currentUser!;
  const { routeId, issueType, description } = req.body;
  if (!routeId || !issueType || !description) {
    res.status(400).json({ error: 'Route, issue type, and description are required.' });
    return;
  }

  db.insert(schema.transportIssues).values({
    reporterUserId: user.id,
    routeId: Number(routeId),
    issueType: String(issueType),
    description: String(description),
    status: 'open',
    createdAt: new Date().toISOString(),
  }).run();

  schoolService.broadcastNotification(
    ['principal', 'coordinator'],
    `Transport Issue Reported: ${issueType}`,
    description.slice(0, 100),
    'transport',
    '/transport'
  );

  res.json({ success: true });
});

app.patch('/api/transport/issues/:id', requireAuth, requireRoles('principal', 'coordinator'), (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const { status, resolutionNote } = req.body;
  db.update(schema.transportIssues)
    .set({ status, resolutionNote: resolutionNote || null })
    .where(eq(schema.transportIssues.id, id))
    .run();
  res.json({ success: true });
});

app.patch('/api/transport/routes/:id', requireAuth, requireRoles('principal', 'coordinator'), (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const { notice, status, morningDeparture, afternoonDeparture } = req.body;
  db.update(schema.transportRoutes)
    .set({
      notice: notice !== undefined ? notice : undefined,
      status: status || undefined,
      morningDeparture: morningDeparture || undefined,
      afternoonDeparture: afternoonDeparture || undefined,
    })
    .where(eq(schema.transportRoutes.id, id))
    .run();

  if (notice) {
    schoolService.broadcastNotification(
      ['student', 'teacher'],
      `Transport Route Advisory Updated`,
      String(notice),
      'transport',
      '/transport'
    );
  }
  res.json({ success: true });
});

app.patch('/api/transport/assign-student', requireAuth, requireRoles('principal', 'coordinator'), (req: Request, res: Response) => {
  const { studentId, routeId, pickupPoint, dropoffPoint } = req.body;
  db.update(schema.students)
    .set({
      routeId: routeId ? Number(routeId) : null,
      pickupPoint: pickupPoint || null,
      dropoffPoint: dropoffPoint || pickupPoint || null,
    })
    .where(eq(schema.students.id, Number(studentId)))
    .run();
  res.json({ success: true });
});

// ==========================================
// 13. QUICK CONTACTS
// ==========================================

app.get('/api/contacts', requireAuth, (_req: Request, res: Response) => {
  const contacts = db.select().from(schema.quickContacts).all();
  res.json({ contacts });
});

// ==========================================
// 14. LOST AND FOUND
// ==========================================

app.get('/api/lost-found', requireAuth, (_req: Request, res: Response) => {
  const items = db.select().from(schema.lostAndFound).orderBy(desc(schema.lostAndFound.createdAt)).all();
  res.json({ items });
});

app.post('/api/lost-found', requireAuth, (req: Request, res: Response) => {
  const user = req.currentUser!;
  const { type, itemName, description, category, location, dateReported, photoUrl, contactInfo } = req.body;
  if (!type || !itemName || !location) {
    res.status(400).json({ error: 'Type, item name, and location are required.' });
    return;
  }

  db.insert(schema.lostAndFound).values({
    reporterUserId: user.id,
    type: String(type),
    itemName: String(itemName),
    description: String(description || ''),
    category: String(category || 'accessories'),
    location: String(location),
    dateReported: String(dateReported || new Date().toISOString().slice(0, 10)),
    photoUrl: photoUrl || null,
    contactInfo: String(contactInfo || `${user.fullName} (${user.email})`),
    status: 'reported',
    createdAt: new Date().toISOString(),
  }).run();

  res.json({ success: true });
});

app.patch('/api/lost-found/:id', requireAuth, (req: Request, res: Response) => {
  const user = req.currentUser!;
  const id = Number(req.params.id);
  const { action, claimNote, verificationNote, status } = req.body;

  const item = db.select().from(schema.lostAndFound).where(eq(schema.lostAndFound.id, id)).get();
  if (!item) {
    res.status(404).json({ error: 'Item not found.' });
    return;
  }

  if (action === 'claim') {
    db.update(schema.lostAndFound)
      .set({
        status: 'claim_pending',
        claimedByUserId: user.id,
        claimNote: String(claimNote || `Claimed by ${user.fullName}`),
      })
      .where(eq(schema.lostAndFound.id, id))
      .run();

    schoolService.broadcastNotification(
      ['coordinator', 'principal'],
      `Lost & Found Claim Request: ${item.itemName}`,
      `${user.fullName} submitted a claim for "${item.itemName}".`,
      'lost_found',
      '/lost-and-found'
    );
    res.json({ success: true });
    return;
  }

  // Coordinator / Principal verification & archival
  if (user.role === 'student') {
    res.status(403).json({ error: 'Only coordinators or the principal can verify or archive Lost & Found claims.' });
    return;
  }

  db.update(schema.lostAndFound)
    .set({
      status: status || 'verified',
      verifiedByUserId: user.id,
      verificationNote: verificationNote ?? item.verificationNote,
    })
    .where(eq(schema.lostAndFound.id, id))
    .run();

  if (item.claimedByUserId) {
    schoolService.createNotification(
      item.claimedByUserId,
      `Lost & Found Update: ${item.itemName} (${status})`,
      verificationNote || `Your claim status is now ${status}.`,
      'lost_found',
      '/lost-and-found'
    );
  }

  schoolService.logAudit(user, 'UPDATE_LOST_FOUND', 'lost_and_found', id, `Updated Lost & Found item "${item.itemName}" to ${status}.`);
  res.json({ success: true });
});

// ==========================================
// 15. LEAVE REQUESTS
// ==========================================

app.get('/api/leaves', requireAuth, (req: Request, res: Response) => {
  const user = req.currentUser!;
  const allLeaves = db.select().from(schema.leaveRequests).orderBy(desc(schema.leaveRequests.createdAt)).all();
  const students = schoolService.getEnrichedStudents();
  const users = db.select().from(schema.users).all();

  const enriched = allLeaves.map(l => {
    const stu = students.find(s => s.id === l.studentId);
    const applicant = users.find(u => u.id === l.applicantUserId);
    const reviewer = users.find(u => u.id === l.reviewedById);
    return {
      ...l,
      applicantName: applicant?.fullName || stu?.fullName || 'Applicant',
      className: stu ? `${stu.className}-${stu.sectionName}` : 'Staff',
      reviewerName: reviewer?.fullName || null,
    };
  });

  if (user.role === 'student') {
    res.json({ leaves: enriched.filter(l => l.applicantUserId === user.id) });
    return;
  }

  res.json({ leaves: enriched });
});

app.post('/api/leaves', requireAuth, (req: Request, res: Response) => {
  const user = req.currentUser!;
  const { startDate, endDate, leaveType, reason, documentUrl, documentName } = req.body;
  if (!startDate || !endDate || !reason) {
    res.status(400).json({ error: 'Start date, end date, and reason are required.' });
    return;
  }

  const stu = db.select().from(schema.students).where(eq(schema.students.userId, user.id)).get();

  db.insert(schema.leaveRequests).values({
    applicantUserId: user.id,
    studentId: stu?.id || null,
    startDate: String(startDate),
    endDate: String(endDate),
    leaveType: String(leaveType || 'personal'),
    reason: String(reason),
    documentUrl: documentUrl || null,
    documentName: documentName || null,
    status: 'pending',
    createdAt: new Date().toISOString(),
  }).run();

  schoolService.broadcastNotification(
    ['teacher', 'coordinator'],
    `New Leave Application: ${user.fullName}`,
    `${startDate} to ${endDate} (${leaveType}).`,
    'leave',
    '/leave-requests'
  );

  res.json({ success: true });
});

app.patch('/api/leaves/:id', requireAuth, requireRoles('teacher', 'coordinator', 'principal'), (req: Request, res: Response) => {
  const user = req.currentUser!;
  const id = Number(req.params.id);
  const { status, reviewerRemarks } = req.body;

  const leave = db.select().from(schema.leaveRequests).where(eq(schema.leaveRequests.id, id)).get();
  if (!leave) {
    res.status(404).json({ error: 'Leave request not found.' });
    return;
  }

  db.update(schema.leaveRequests)
    .set({
      status,
      reviewedById: user.id,
      reviewerRemarks: reviewerRemarks || null,
    })
    .where(eq(schema.leaveRequests.id, id))
    .run();

  schoolService.createNotification(
    leave.applicantUserId,
    `Leave Request ${status.toUpperCase()} (${leave.startDate})`,
    reviewerRemarks || `Reviewed by ${user.fullName}.`,
    'leave',
    '/leave-requests'
  );

  schoolService.logAudit(user, 'REVIEW_LEAVE', 'leave_request', id, `Marked leave request #${id} as ${status}.`);
  res.json({ success: true });
});

// ==========================================
// 16. LIBRARY & BOOK TRANSACTIONS
// ==========================================

app.get('/api/library', requireAuth, (req: Request, res: Response) => {
  const user = req.currentUser!;
  const books = db.select().from(schema.libraryBooks).all();
  const txs = db.select().from(schema.bookTransactions).orderBy(desc(schema.bookTransactions.issueDate)).all();
  const students = schoolService.getEnrichedStudents();

  const enrichedTxs = txs.map(t => {
    const book = books.find(b => b.id === t.bookId);
    const stu = students.find(s => s.id === t.studentId);
    return {
      ...t,
      bookTitle: book?.title || 'Book',
      bookIsbn: book?.isbn || '',
      bookAuthor: book?.author || '',
      studentName: stu?.fullName || 'Student',
    };
  });

  if (user.role === 'student') {
    res.json({
      books,
      transactions: enrichedTxs.filter(t => t.userId === user.id),
    });
    return;
  }

  res.json({ books, transactions: enrichedTxs, students });
});

app.post('/api/library/issue', requireAuth, (req: Request, res: Response) => {
  const user = req.currentUser!;
  const { bookId, studentId, dueDate } = req.body;
  const book = db.select().from(schema.libraryBooks).where(eq(schema.libraryBooks.id, Number(bookId))).get();
  if (!book || book.availableCopies <= 0) {
    res.status(400).json({ error: 'Book is currently out of stock.' });
    return;
  }

  let targetStu = db.select().from(schema.students).where(eq(schema.students.userId, user.id)).get();
  if (studentId && user.role !== 'student') {
    targetStu = db.select().from(schema.students).where(eq(schema.students.id, Number(studentId))).get();
  }
  if (!targetStu) {
    targetStu = db.select().from(schema.students).get();
  }

  const issueDate = new Date().toISOString().slice(0, 10);
  const due = dueDate || '2026-11-20';

  db.insert(schema.bookTransactions).values({
    bookId: book.id,
    studentId: targetStu!.id,
    userId: targetStu!.userId,
    issueDate,
    dueDate: String(due),
    status: 'issued',
    fineAmount: 0,
    remarks: 'Issued via Digital Library Portal',
  }).run();

  db.update(schema.libraryBooks)
    .set({ availableCopies: book.availableCopies - 1 })
    .where(eq(schema.libraryBooks.id, book.id))
    .run();

  res.json({ success: true });
});

app.patch('/api/library/transactions/:id/return', requireAuth, (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const tx = db.select().from(schema.bookTransactions).where(eq(schema.bookTransactions.id, id)).get();
  if (!tx || tx.status === 'returned') {
    res.status(400).json({ error: 'Transaction already returned or invalid.' });
    return;
  }

  db.update(schema.bookTransactions)
    .set({
      status: 'returned',
      returnDate: new Date().toISOString().slice(0, 10),
    })
    .where(eq(schema.bookTransactions.id, id))
    .run();

  const book = db.select().from(schema.libraryBooks).where(eq(schema.libraryBooks.id, tx.bookId)).get();
  if (book) {
    db.update(schema.libraryBooks)
      .set({ availableCopies: Math.min(book.totalCopies, book.availableCopies + 1) })
      .where(eq(schema.libraryBooks.id, book.id))
      .run();
  }

  res.json({ success: true });
});

// ==========================================
// 17. CALENDAR & EVENTS
// ==========================================

app.get('/api/events', requireAuth, (req: Request, res: Response) => {
  const user = req.currentUser!;
  const all = db.select().from(schema.schoolEvents).all();
  const teachers = schoolService.getEnrichedTeachers();

  const visible = all
    .filter(e => !e.isPersonalReminder || e.ownerUserId === user.id)
    .map(e => {
      const assignedIds: number[] = JSON.parse(e.assignedTeacherIdsJson || '[]');
      return {
        ...e,
        assignedTeacherIds: assignedIds,
        assignedTeacherNames: teachers.filter(t => assignedIds.includes(t.id)).map(t => t.fullName),
      };
    });

  res.json({ events: visible, teachers });
});

app.post('/api/events', requireAuth, (req: Request, res: Response) => {
  const user = req.currentUser!;
  const { title, description, category, startDate, endDate, startTime, location, isPersonalReminder, assignedTeacherIds, participantCount } = req.body;

  if (!title || !startDate) {
    res.status(400).json({ error: 'Event title and start date are required.' });
    return;
  }

  const personal = user.role === 'student' ? true : Boolean(isPersonalReminder);

  db.insert(schema.schoolEvents).values({
    title: String(title),
    description: String(description || ''),
    category: String(category || 'academic'),
    startDate: String(startDate),
    endDate: String(endDate || startDate),
    startTime: startTime || '09:00 AM',
    location: String(location || 'Campus'),
    organizerId: user.id,
    assignedTeacherIdsJson: JSON.stringify(assignedTeacherIds || []),
    targetClassIdsJson: '[]',
    participantCount: Number(participantCount || 0),
    isPersonalReminder: personal,
    ownerUserId: personal ? user.id : null,
  }).run();

  if (!personal) {
    schoolService.broadcastNotification(
      ['student', 'teacher', 'coordinator'],
      `New School Event: ${title}`,
      `${startDate} at ${location}.`,
      'event',
      '/calendar'
    );
  }

  res.json({ success: true });
});

app.delete('/api/events/:id', requireAuth, (req: Request, res: Response) => {
  const id = Number(req.params.id);
  db.delete(schema.schoolEvents).where(eq(schema.schoolEvents.id, id)).run();
  res.json({ success: true });
});

// ==========================================
// 18. COMMUNICATION & MESSAGING
// ==========================================

app.get('/api/communication', requireAuth, (req: Request, res: Response) => {
  const user = req.currentUser!;
  const allReqs = db.select().from(schema.communicationRequests).orderBy(desc(schema.communicationRequests.updatedAt)).all();
  const allMsgs = db.select().from(schema.messages).all();
  const allUsers = db.select().from(schema.users).all();

  const visibleReqs = allReqs.filter(r => {
    if (user.role === 'principal' || user.role === 'coordinator') return true;
    return r.requesterId === user.id || r.recipientId === user.id;
  });

  const enriched = visibleReqs.map(r => {
    const requester = allUsers.find(u => u.id === r.requesterId);
    const recipient = allUsers.find(u => u.id === r.recipientId);
    const threadMessages = allMsgs
      .filter(m => m.requestId === r.id)
      .map(m => ({
        ...m,
        senderName: allUsers.find(u => u.id === m.senderId)?.fullName || 'User',
        senderRole: allUsers.find(u => u.id === m.senderId)?.role || '',
      }));

    return {
      ...r,
      requesterName: requester?.fullName || 'User',
      requesterRole: requester?.role || '',
      recipientName: recipient?.fullName || 'Staff',
      recipientRole: recipient?.role || '',
      messages: threadMessages,
    };
  });

  const availableRecipients = allUsers
    .filter(u => u.id !== user.id && u.isActive)
    .map(u => ({
      id: u.id,
      fullName: u.fullName,
      role: u.role,
      schoolId: u.schoolId,
    }));

  res.json({ requests: enriched, recipients: availableRecipients });
});

app.post('/api/communication', requireAuth, (req: Request, res: Response) => {
  const user = req.currentUser!;
  const { recipientId, subject, issueDescription, category } = req.body;
  if (!recipientId || !subject || !issueDescription) {
    res.status(400).json({ error: 'Recipient, subject, and description are required.' });
    return;
  }

  const now = new Date().toISOString();
  const result = db.insert(schema.communicationRequests).values({
    requesterId: user.id,
    recipientId: Number(recipientId),
    subject: String(subject),
    issueDescription: String(issueDescription),
    category: String(category || 'academic'),
    status: user.role === 'student' ? 'pending' : 'accepted',
    createdAt: now,
    updatedAt: now,
  }).run();

  const reqId = Number(result.lastInsertRowid);
  db.insert(schema.messages).values({
    requestId: reqId,
    senderId: user.id,
    content: String(issueDescription),
    isRead: false,
    createdAt: now,
  }).run();

  schoolService.createNotification(
    Number(recipientId),
    `New Communication Request from ${user.fullName}`,
    subject,
    'communication',
    '/communication'
  );

  res.json({ success: true, id: reqId });
});

app.patch('/api/communication/:id/status', requireAuth, (req: Request, res: Response) => {
  const user = req.currentUser!;
  const id = Number(req.params.id);
  const { status, responseNote } = req.body;

  const existing = db.select().from(schema.communicationRequests).where(eq(schema.communicationRequests.id, id)).get();
  if (!existing) {
    res.status(404).json({ error: 'Request not found.' });
    return;
  }

  db.update(schema.communicationRequests)
    .set({
      status,
      responseNote: responseNote || null,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(schema.communicationRequests.id, id))
    .run();

  schoolService.createNotification(
    existing.requesterId,
    `Conversation Request ${status.toUpperCase()}: ${existing.subject}`,
    responseNote || `${user.fullName} updated your request status to ${status}.`,
    'communication',
    '/communication'
  );

  res.json({ success: true });
});

app.post('/api/communication/:id/messages', requireAuth, (req: Request, res: Response) => {
  const user = req.currentUser!;
  const requestId = Number(req.params.id);
  const { content } = req.body;
  if (!content || !String(content).trim()) {
    res.status(400).json({ error: 'Message content cannot be empty.' });
    return;
  }

  const commReq = db.select().from(schema.communicationRequests).where(eq(schema.communicationRequests.id, requestId)).get();
  if (!commReq) {
    res.status(404).json({ error: 'Conversation not found.' });
    return;
  }

  if (commReq.status === 'rejected') {
    res.status(400).json({ error: 'Cannot send messages in a rejected request.' });
    return;
  }

  const now = new Date().toISOString();
  db.insert(schema.messages).values({
    requestId,
    senderId: user.id,
    content: String(content).trim(),
    isRead: false,
    createdAt: now,
  }).run();

  db.update(schema.communicationRequests).set({ updatedAt: now }).where(eq(schema.communicationRequests.id, requestId)).run();

  const targetUserId = commReq.requesterId === user.id ? commReq.recipientId : commReq.requesterId;
  schoolService.createNotification(
    targetUserId,
    `New Message from ${user.fullName}`,
    String(content).slice(0, 100),
    'communication',
    '/communication'
  );

  res.json({ success: true });
});

// ==========================================
// 19. ADMINISTRATION: STUDENTS, STAFF, ACADEMICS, SETTINGS
// ==========================================

app.get('/api/admin/directory', requireAuth, requireRoles('teacher', 'coordinator', 'principal'), (_req: Request, res: Response) => {
  const students = schoolService.getEnrichedStudents();
  const teachers = schoolService.getEnrichedTeachers();
  const coordinators = db.select().from(schema.coordinators).all();
  const users = db.select().from(schema.users).all();
  const classes = db.select().from(schema.classes).all();
  const sections = db.select().from(schema.sections).all();
  const subjects = db.select().from(schema.subjects).all();
  const academicYears = db.select().from(schema.academicYears).all();
  const routes = db.select().from(schema.transportRoutes).all();

  const enrichedCoordinators = coordinators.map(c => {
    const u = users.find(usr => usr.id === c.userId);
    return {
      ...c,
      fullName: u?.fullName || '',
      schoolId: u?.schoolId || '',
      email: u?.email || '',
      phone: u?.phone || '',
      isActive: u?.isActive ?? true,
    };
  });

  res.json({
    students,
    teachers,
    coordinators: enrichedCoordinators,
    classes,
    sections,
    subjects,
    academicYears,
    routes,
  });
});

app.post('/api/admin/students', requireAuth, requireRoles('principal', 'coordinator'), (req: Request, res: Response) => {
  const actor = req.currentUser!;
  const { fullName, email, phone, classId, sectionId, dob, gender, bloodGroup, guardianName, guardianRelation, guardianPhone, guardianEmail, address, house } = req.body;
  if (!fullName || !email || !classId || !sectionId) {
    res.status(400).json({ error: 'Full name, email, class, and section are required.' });
    return;
  }

  const countStu = db.select().from(schema.students).all().length + 1;
  const schoolId = `STU-2026-0${countStu + 10}`;
  const admissionNo = `ADM-2026-${100 + countStu}`;
  const username = String(fullName).toLowerCase().replace(/[^a-z0-9]/g, '') + countStu;
  const now = new Date().toISOString();

  const userRes = db.insert(schema.users).values({
    schoolId,
    username,
    email: String(email),
    passwordHash: hashPassword('password123'),
    role: 'student',
    fullName: String(fullName),
    phone: String(phone || '+1 (555) 300-0000'),
    isActive: true,
    createdAt: now,
  }).run();

  const newUserId = Number(userRes.lastInsertRowid);
  db.insert(schema.students).values({
    userId: newUserId,
    admissionNo,
    rollNo: countStu,
    classId: Number(classId),
    sectionId: Number(sectionId),
    dob: String(dob || '2011-06-15'),
    gender: String(gender || 'Female'),
    bloodGroup: String(bloodGroup || 'O+'),
    address: String(address || 'Northridge Campus District'),
    guardianName: String(guardianName || 'Guardian'),
    guardianRelation: String(guardianRelation || 'Parent'),
    guardianPhone: String(guardianPhone || '+1 (555) 400-0000'),
    guardianEmail: String(guardianEmail || 'guardian@example.com'),
    house: String(house || 'Valiant House'),
    status: 'active',
  }).run();

  schoolService.logAudit(actor, 'CREATE_STUDENT', 'student', schoolId, `Enrolled student ${fullName} (${schoolId}).`);
  res.json({ success: true, schoolId });
});

app.patch('/api/admin/students/:id', requireAuth, requireRoles('principal', 'coordinator'), (req: Request, res: Response) => {
  const actor = req.currentUser!;
  const id = Number(req.params.id);
  const { fullName, classId, sectionId, status, disciplinaryNotes, house } = req.body;
  const stu = db.select().from(schema.students).where(eq(schema.students.id, id)).get();
  if (!stu) {
    res.status(404).json({ error: 'Student not found.' });
    return;
  }

  db.update(schema.students)
    .set({
      classId: classId ? Number(classId) : stu.classId,
      sectionId: sectionId ? Number(sectionId) : stu.sectionId,
      status: status || stu.status,
      disciplinaryNotes: disciplinaryNotes !== undefined ? disciplinaryNotes : stu.disciplinaryNotes,
      house: house || stu.house,
    })
    .where(eq(schema.students.id, id))
    .run();

  if (fullName) {
    db.update(schema.users).set({ fullName: String(fullName) }).where(eq(schema.users.id, stu.userId)).run();
  }

  schoolService.logAudit(actor, 'UPDATE_STUDENT', 'student', id, `Updated student record #${id}.`);
  res.json({ success: true });
});

app.post('/api/admin/staff', requireAuth, requireRoles('principal'), (req: Request, res: Response) => {
  const actor = req.currentUser!;
  const { role, fullName, email, phone, department, qualification, specialization, designation } = req.body;
  if (!fullName || !email || !role) {
    res.status(400).json({ error: 'Full name, email, and role are required.' });
    return;
  }

  const allUsers = db.select().from(schema.users).all();
  const idx = allUsers.length + 1;
  const prefix = role === 'coordinator' ? 'CRD' : 'TCH';
  const schoolId = `${prefix}-2026-${100 + idx}`;
  const username = String(fullName).toLowerCase().replace(/[^a-z0-9]/g, '') + idx;
  const now = new Date().toISOString();

  const userRes = db.insert(schema.users).values({
    schoolId,
    username,
    email: String(email),
    passwordHash: hashPassword('password123'),
    role: role === 'coordinator' ? 'coordinator' : 'teacher',
    fullName: String(fullName),
    phone: String(phone || '+1 (555) 201-0199'),
    isActive: true,
    createdAt: now,
  }).run();

  const newUserId = Number(userRes.lastInsertRowid);
  if (role === 'coordinator') {
    db.insert(schema.coordinators).values({
      userId: newUserId,
      employeeCode: schoolId,
      department: String(department || 'Academic Operations Wing'),
      assignedGradesJson: '[9, 10]',
      scopeDescription: String(designation || 'Academic & Faculty Coordination'),
    }).run();
  } else {
    db.insert(schema.teachers).values({
      userId: newUserId,
      employeeCode: schoolId,
      department: String(department || 'Sciences'),
      qualification: String(qualification || 'M.Sc., B.Ed.'),
      specialization: String(specialization || 'Subject Specialist'),
      joinDate: now.slice(0, 10),
      designation: String(designation || 'Senior Faculty'),
      workloadHours: 22,
      canPublishClassAnnouncements: true,
    }).run();
  }

  schoolService.logAudit(actor, 'CREATE_STAFF', 'user', schoolId, `Added ${role} ${fullName} (${schoolId}).`);
  res.json({ success: true, schoolId });
});

app.patch('/api/admin/users/:userId/status', requireAuth, requireRoles('principal'), (req: Request, res: Response) => {
  const actor = req.currentUser!;
  const targetUserId = Number(req.params.userId);
  const { isActive, resetPassword } = req.body;

  if (isActive !== undefined) {
    db.update(schema.users).set({ isActive: Boolean(isActive) }).where(eq(schema.users.id, targetUserId)).run();
    schoolService.logAudit(actor, isActive ? 'ACTIVATE_USER' : 'DEACTIVATE_USER', 'user', targetUserId, `Changed active status of user #${targetUserId} to ${isActive}.`);
  }

  if (resetPassword) {
    db.update(schema.users)
      .set({ passwordHash: hashPassword(String(resetPassword)) })
      .where(eq(schema.users.id, targetUserId))
      .run();
    schoolService.logAudit(actor, 'RESET_USER_PASSWORD', 'user', targetUserId, `Reset password for user #${targetUserId}.`);
  }

  res.json({ success: true });
});

app.post('/api/admin/subjects', requireAuth, requireRoles('principal', 'coordinator'), (req: Request, res: Response) => {
  const { code, name, department, description, isElective, curriculumProgress } = req.body;
  if (!code || !name || !department) {
    res.status(400).json({ error: 'Subject code, name, and department are required.' });
    return;
  }
  db.insert(schema.subjects).values({
    code: String(code).toUpperCase(),
    name: String(name),
    department: String(department),
    description: description || null,
    isElective: Boolean(isElective),
    curriculumProgress: Number(curriculumProgress || 50),
  }).run();
  res.json({ success: true });
});

app.post('/api/admin/classes', requireAuth, requireRoles('principal', 'coordinator'), (req: Request, res: Response) => {
  const { name, gradeLevel, sectionName, roomNumber, capacity } = req.body;
  if (!name || !gradeLevel) {
    res.status(400).json({ error: 'Class name and grade level are required.' });
    return;
  }
  const clsRes = db.insert(schema.classes).values({
    name: String(name),
    gradeLevel: Number(gradeLevel),
    academicYearId: 1,
    coordinatorId: 1,
  }).run();
  const classId = Number(clsRes.lastInsertRowid);
  db.insert(schema.sections).values({
    classId,
    name: String(sectionName || 'A'),
    roomNumber: String(roomNumber || `Room ${gradeLevel}01`),
    capacity: Number(capacity || 32),
  }).run();
  res.json({ success: true });
});

app.get('/api/settings', requireAuth, (_req: Request, res: Response) => {
  const settings = db.select().from(schema.schoolSettings).get();
  const academicYears = db.select().from(schema.academicYears).all();
  const auditLogs = db.select().from(schema.auditLogs).orderBy(desc(schema.auditLogs.id)).limit(50).all();
  res.json({
    settings: settings ? { ...settings, rolePermissions: JSON.parse(settings.rolePermissionsJson || '{}') } : null,
    academicYears,
    auditLogs,
  });
});

app.patch('/api/settings', requireAuth, requireRoles('principal'), (req: Request, res: Response) => {
  const actor = req.currentUser!;
  const { schoolName, tagline, address, phone, email, website, currentAcademicYearId, enableNotifications, rolePermissions } = req.body;
  const existing = db.select().from(schema.schoolSettings).get();
  if (existing) {
    db.update(schema.schoolSettings)
      .set({
        schoolName: schoolName ?? existing.schoolName,
        tagline: tagline ?? existing.tagline,
        address: address ?? existing.address,
        phone: phone ?? existing.phone,
        email: email ?? existing.email,
        website: website ?? existing.website,
        currentAcademicYearId: currentAcademicYearId ? Number(currentAcademicYearId) : existing.currentAcademicYearId,
        enableNotifications: enableNotifications !== undefined ? Boolean(enableNotifications) : existing.enableNotifications,
        rolePermissionsJson: rolePermissions ? JSON.stringify(rolePermissions) : existing.rolePermissionsJson,
      })
      .where(eq(schema.schoolSettings.id, existing.id))
      .run();
  }
  schoolService.logAudit(actor, 'UPDATE_SCHOOL_SETTINGS', 'school_settings', 1, 'Updated institutional configuration and permissions.');
  res.json({ success: true });
});

app.get('/api/settings/backup', requireAuth, requireRoles('principal'), (req: Request, res: Response) => {
  const actor = req.currentUser!;
  const now = new Date().toISOString();
  db.update(schema.schoolSettings).set({ backupLastRunAt: now }).run();
  schoolService.logAudit(actor, 'EXPORT_LOCAL_BACKUP', 'database', 'sqlite', 'Exported complete JSON snapshot of local SQLite database.');

  const snapshot = {
    exportedAt: now,
    school: db.select().from(schema.schoolSettings).get(),
    academicYears: db.select().from(schema.academicYears).all(),
    classes: db.select().from(schema.classes).all(),
    sections: db.select().from(schema.sections).all(),
    subjects: db.select().from(schema.subjects).all(),
    students: schoolService.getEnrichedStudents(),
    teachers: schoolService.getEnrichedTeachers(),
    announcements: db.select().from(schema.announcements).all(),
    assignments: db.select().from(schema.assignments).all(),
    examinations: db.select().from(schema.examinations).all(),
    events: db.select().from(schema.schoolEvents).all(),
    auditLogs: db.select().from(schema.auditLogs).all(),
  };

  res.json(snapshot);
});

app.post('/api/settings/reset-seed', requireAuth, requireRoles('principal'), (req: Request, res: Response) => {
  seedDatabase(true);
  schoolService.logAudit(req.currentUser!, 'RESET_DEMO_DATA', 'database', 'sqlite', 'Re-seeded local database to baseline sample records.');
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`Veritas School Management API Server running on http://localhost:${PORT}`);
});

