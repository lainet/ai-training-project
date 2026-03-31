import { eq, and } from "drizzle-orm";
import { db } from "~/db";
import { lessonComments, courseComments, users, CommentStatus } from "~/db/schema";

// ─── Lesson Comments ───────────────────────────────────────────────────────────

export function createComment(lessonId: number, userId: number, content: string) {
  return db
    .insert(lessonComments)
    .values({ lessonId, userId, content, status: CommentStatus.Pending })
    .returning()
    .get();
}

export function getCommentById(commentId: number) {
  return db.select().from(lessonComments).where(eq(lessonComments.id, commentId)).get();
}

export function getApprovedCommentsByLesson(lessonId: number) {
  return db
    .select({
      id: lessonComments.id,
      content: lessonComments.content,
      createdAt: lessonComments.createdAt,
      userId: lessonComments.userId,
      userName: users.name,
      userAvatarUrl: users.avatarUrl,
    })
    .from(lessonComments)
    .innerJoin(users, eq(lessonComments.userId, users.id))
    .where(and(eq(lessonComments.lessonId, lessonId), eq(lessonComments.status, CommentStatus.Approved)))
    .orderBy(lessonComments.createdAt)
    .all();
}

export function getPendingCommentsByLesson(lessonId: number) {
  return db
    .select({
      id: lessonComments.id,
      content: lessonComments.content,
      createdAt: lessonComments.createdAt,
      userId: lessonComments.userId,
      userName: users.name,
      userAvatarUrl: users.avatarUrl,
    })
    .from(lessonComments)
    .innerJoin(users, eq(lessonComments.userId, users.id))
    .where(and(eq(lessonComments.lessonId, lessonId), eq(lessonComments.status, CommentStatus.Pending)))
    .orderBy(lessonComments.createdAt)
    .all();
}

export function approveComment(commentId: number) {
  return db
    .update(lessonComments)
    .set({ status: CommentStatus.Approved, updatedAt: new Date().toISOString() })
    .where(eq(lessonComments.id, commentId))
    .returning()
    .get();
}

export function rejectComment(commentId: number) {
  return db
    .update(lessonComments)
    .set({ status: CommentStatus.Rejected, updatedAt: new Date().toISOString() })
    .where(eq(lessonComments.id, commentId))
    .returning()
    .get();
}

export function deleteComment(commentId: number) {
  return db.delete(lessonComments).where(eq(lessonComments.id, commentId)).returning().get();
}

// ─── Course Comments ───────────────────────────────────────────────────────────

export function createCourseComment(courseId: number, userId: number, content: string) {
  return db
    .insert(courseComments)
    .values({ courseId, userId, content, status: CommentStatus.Pending })
    .returning()
    .get();
}

export function getCourseCommentById(commentId: number) {
  return db.select().from(courseComments).where(eq(courseComments.id, commentId)).get();
}

export function getApprovedCourseComments(courseId: number) {
  return db
    .select({
      id: courseComments.id,
      content: courseComments.content,
      createdAt: courseComments.createdAt,
      userId: courseComments.userId,
      userName: users.name,
      userAvatarUrl: users.avatarUrl,
    })
    .from(courseComments)
    .innerJoin(users, eq(courseComments.userId, users.id))
    .where(and(eq(courseComments.courseId, courseId), eq(courseComments.status, CommentStatus.Approved)))
    .orderBy(courseComments.createdAt)
    .all();
}

export function approveCourseComment(commentId: number) {
  return db
    .update(courseComments)
    .set({ status: CommentStatus.Approved, updatedAt: new Date().toISOString() })
    .where(eq(courseComments.id, commentId))
    .returning()
    .get();
}

export function rejectCourseComment(commentId: number) {
  return db
    .update(courseComments)
    .set({ status: CommentStatus.Rejected, updatedAt: new Date().toISOString() })
    .where(eq(courseComments.id, commentId))
    .returning()
    .get();
}

export function deleteCourseComment(commentId: number) {
  return db.delete(courseComments).where(eq(courseComments.id, commentId)).returning().get();
}

export function getPendingCourseComments(courseId: number) {
  return db
    .select({
      id: courseComments.id,
      content: courseComments.content,
      createdAt: courseComments.createdAt,
      userId: courseComments.userId,
      userName: users.name,
      userAvatarUrl: users.avatarUrl,
    })
    .from(courseComments)
    .innerJoin(users, eq(courseComments.userId, users.id))
    .where(and(eq(courseComments.courseId, courseId), eq(courseComments.status, CommentStatus.Pending)))
    .orderBy(courseComments.createdAt)
    .all();
}
