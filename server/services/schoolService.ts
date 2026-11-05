import { db, sqlite } from '../db/index.js';
import * as schema from '../db/schema.js';
import { eq, desc, and } from 'drizzle-orm';
import { hashPassword, verifyPassword } from '../utils/auth.js';

export class SchoolService {
  // Audit Logger
  logAudit(actor: { id: number; fullName: string; role: string }, action: string, entityType: string, entityId: string | number, summary: string, metadata?: unknown) {
    db.insert(schema.auditLogs).values({
      actorUserId: actor.id,
      actorName: actor.fullName,
      actorRole: actor.role,
      action,
      entityType,
      entityId: String(entityId),
      summary,
      metadataJson: metadata ? JSON.stringify(metadata) : null,
      createdAt: new Date().toISOString(),
    }).run();
  }

  // Notification Dispatcher
  createNotification(userId: number, title: string, message: string, category: string, linkUrl: string, priority = 'normal') {
    db.insert(schema.notifications).values({
      userId,
      title,
      message,
      category,
      linkUrl,
      isRead: false,
      priority,
      createdAt: new Date().toISOString(),
    }).run();
  }

  broadcastNotification(targetRoles: string[], title: string, message: string, category: string, linkUrl: string, priority = 'normal') {
    const allUsers = db.select().from(schema.users).all();
    const now = new Date().toISOString();
    for (const u of allUsers) {
      if (u.isActive && targetRoles.includes(u.role)) {
        db.insert(schema.notifications).values({
          userId: u.id,
          title,
          message,
          category,
          linkUrl,
          isRead: false,
          priority,
          createdAt: now,
        }).run();
      }
    }
  }

  // User Context Loader
  getUserProfile(userId: number) {
    const user = db.select().from(schema.users).where(eq(schema.users.id, userId)).get();
    if (!user) return null;

    const { passwordHash: _, ...safeUser } = user;
    let roleDetails: Record<string, unknown> | null = null;

    if (user.role === 'student') {
      const student = db.select().from(schema.students).where(eq(schema.students.userId, user.id)).get();
      if (student) {
        const cls = db.select().from(schema.classes).where(eq(schema.classes.id, student.classId)).get();
        const sec = db.select().from(schema.sections).where(eq(schema.sections.id, student.sectionId)).get();
        const route = student.routeId
          ? db.select().from(schema.transportRoutes).where(eq(schema.transportRoutes.id, student.routeId)).get()
          : null;
        roleDetails = {
          ...student,
          className: cls?.name || 'Grade 10',
          gradeLevel: cls?.gradeLevel || 10,
          sectionName: sec?.name || 'A',
          roomNumber: sec?.roomNumber || 'Room 302',
          routeName: route?.routeName || null,
          routeNumber: route?.routeNumber || null,
        };
      }
    } else if (user.role === 'teacher') {
      const teacher = db.select().from(schema.teachers).where(eq(schema.teachers.userId, user.id)).get();
      if (teacher) {
        const assigned = db.select().from(schema.teacherAssignments).where(eq(schema.teacherAssignments.teacherId, teacher.id)).all();
        roleDetails = { ...teacher, assignments: assigned };
      }
    } else if (user.role === 'coordinator') {
      const coordinator = db.select().from(schema.coordinators).where(eq(schema.coordinators.userId, user.id)).get();
      roleDetails = coordinator || null;
    }

    return {
      ...safeUser,
      preferences: JSON.parse(safeUser.preferencesJson || '{}'),
      roleDetails,
    };
  }

  // Enriched Reference Data
  getReferenceMaps() {
    const allUsers = db.select().from(schema.users).all();
    const allClasses = db.select().from(schema.classes).all();
    const allSections = db.select().from(schema.sections).all();
    const allSubjects = db.select().from(schema.subjects).all();
    const allStudents = db.select().from(schema.students).all();
    const allTeachers = db.select().from(schema.teachers).all();
    const allCoordinators = db.select().from(schema.coordinators).all();

    const userMap = new Map(allUsers.map(u => [u.id, u]));
    const classMap = new Map(allClasses.map(c => [c.id, c]));
    const sectionMap = new Map(allSections.map(s => [s.id, s]));
    const subjectMap = new Map(allSubjects.map(s => [s.id, s]));
    const studentMap = new Map(allStudents.map(s => [s.id, { ...s, user: userMap.get(s.userId) }]));
    const teacherMap = new Map(allTeachers.map(t => [t.id, { ...t, user: userMap.get(t.userId) }]));

    return {
      allUsers,
      allClasses,
      allSections,
      allSubjects,
      allStudents,
      allTeachers,
      allCoordinators,
      userMap,
      classMap,
      sectionMap,
      subjectMap,
      studentMap,
      teacherMap,
    };
  }

  getEnrichedStudents() {
    const { allStudents, userMap, classMap, sectionMap } = this.getReferenceMaps();
    const allAttendance = db.select().from(schema.attendance).all();
    const allMarks = db.select().from(schema.marks).all();

    return allStudents.map(s => {
      const u = userMap.get(s.userId);
      const cls = classMap.get(s.classId);
      const sec = sectionMap.get(s.sectionId);
      const stuAtt = allAttendance.filter(a => a.studentId === s.id && a.subjectId === null);
      const presentCount = stuAtt.filter(a => a.status === 'present' || a.status === 'excused' || a.status === 'late').length;
      const attendancePercentage = stuAtt.length > 0 ? Math.round((presentCount / stuAtt.length) * 1000) / 10 : 95;

      const stuMarks = allMarks.filter(m => m.studentId === s.id);
      const avgPercentage = stuMarks.length > 0
        ? Math.round((stuMarks.reduce((acc, m) => acc + (m.marksObtained / m.maxMarks) * 100, 0) / stuMarks.length) * 10) / 10
        : 88;

      return {
        ...s,
        fullName: u?.fullName || 'Student',
        schoolId: u?.schoolId || '',
        email: u?.email || '',
        phone: u?.phone || '',
        isActive: u?.isActive ?? true,
        className: cls?.name || 'Grade 10',
        gradeLevel: cls?.gradeLevel || 10,
        sectionName: sec?.name || 'A',
        roomNumber: sec?.roomNumber || '',
        attendancePercentage,
        avgAcademicPercentage: avgPercentage,
        totalClassesTracked: stuAtt.length,
      };
    });
  }

  getEnrichedTeachers() {
    const { allTeachers, userMap, classMap, sectionMap, subjectMap } = this.getReferenceMaps();
    const assignments = db.select().from(schema.teacherAssignments).all();
    const teacherAtt = db.select().from(schema.teacherAttendance).all();

    return allTeachers.map(t => {
      const u = userMap.get(t.userId);
      const tAssigns = assignments
        .filter(a => a.teacherId === t.id)
        .map(a => ({
          ...a,
          className: classMap.get(a.classId)?.name || '',
          sectionName: sectionMap.get(a.sectionId)?.name || '',
          subjectName: subjectMap.get(a.subjectId)?.name || '',
          subjectCode: subjectMap.get(a.subjectId)?.code || '',
        }));

      const todayAtt = teacherAtt.find(a => a.teacherId === t.id && a.date === '2026-11-05') || teacherAtt.find(a => a.teacherId === t.id);

      return {
        ...t,
        fullName: u?.fullName || '',
        schoolId: u?.schoolId || '',
        email: u?.email || '',
        phone: u?.phone || '',
        isActive: u?.isActive ?? true,
        assignedMappings: tAssigns,
        todayAttendance: todayAtt || { status: 'present', checkInTime: '07:45 AM' },
      };
    });
  }
}

export const schoolService = new SchoolService();

