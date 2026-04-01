import { eq, and, inArray } from "drizzle-orm";
import { db } from "~/db";
import { lessonBookmarks, lessons, modules } from "~/db/schema";

// ─── Bookmark Service ───
// Handles per-student lesson bookmarks. Bookmarks are private and persist
// until manually removed. One bookmark per user per lesson.

export function isLessonBookmarked(
  userId: number,
  lessonId: number
): boolean {
  const result = db
    .select({ id: lessonBookmarks.id })
    .from(lessonBookmarks)
    .where(
      and(
        eq(lessonBookmarks.userId, userId),
        eq(lessonBookmarks.lessonId, lessonId)
      )
    )
    .get();

  return result !== undefined;
}

export function toggleBookmark(
  userId: number,
  lessonId: number
): { bookmarked: boolean } {
  const existing = db
    .select({ id: lessonBookmarks.id })
    .from(lessonBookmarks)
    .where(
      and(
        eq(lessonBookmarks.userId, userId),
        eq(lessonBookmarks.lessonId, lessonId)
      )
    )
    .get();

  if (existing) {
    db.delete(lessonBookmarks)
      .where(eq(lessonBookmarks.id, existing.id))
      .run();
    return { bookmarked: false };
  }

  db.insert(lessonBookmarks)
    .values({ userId, lessonId })
    .run();
  return { bookmarked: true };
}

export function getBookmarkedLessonIds(
  userId: number,
  courseId: number
): number[] {
  // Find all module IDs for this course
  const courseModules = db
    .select({ id: modules.id })
    .from(modules)
    .where(eq(modules.courseId, courseId))
    .all();

  if (courseModules.length === 0) return [];

  // Find all lesson IDs in those modules
  const courseLessons = db
    .select({ id: lessons.id })
    .from(lessons)
    .where(inArray(lessons.moduleId, courseModules.map((m) => m.id)))
    .all();

  if (courseLessons.length === 0) return [];

  // Find bookmarks for this user that belong to those lessons
  const bookmarks = db
    .select({ lessonId: lessonBookmarks.lessonId })
    .from(lessonBookmarks)
    .where(
      and(
        eq(lessonBookmarks.userId, userId),
        inArray(
          lessonBookmarks.lessonId,
          courseLessons.map((l) => l.id)
        )
      )
    )
    .all();

  return bookmarks.map((b) => b.lessonId);
}
