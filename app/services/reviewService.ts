import { eq, and, sql } from "drizzle-orm";
import { db } from "~/db";
import { courseReviews } from "~/db/schema";

// ─── Review Service ───
// Handles course star ratings (1–5). One rating per enrolled student per course.

export function getAverageRatingForCourse(courseId: number): {
  avgRating: number | null;
  ratingCount: number;
} {
  const result = db
    .select({
      avgRating: sql<number | null>`ROUND(AVG(${courseReviews.rating}), 1)`,
      ratingCount: sql<number>`COUNT(${courseReviews.id})`,
    })
    .from(courseReviews)
    .where(eq(courseReviews.courseId, courseId))
    .get();

  return {
    avgRating: result?.avgRating ?? null,
    ratingCount: result?.ratingCount ?? 0,
  };
}

export function getUserRatingForCourse(
  userId: number,
  courseId: number
): number | null {
  const result = db
    .select({ rating: courseReviews.rating })
    .from(courseReviews)
    .where(
      and(
        eq(courseReviews.userId, userId),
        eq(courseReviews.courseId, courseId)
      )
    )
    .get();

  return result?.rating ?? null;
}

export function upsertCourseReview(
  userId: number,
  courseId: number,
  rating: number
) {
  return db
    .insert(courseReviews)
    .values({
      userId,
      courseId,
      rating,
    })
    .onConflictDoUpdate({
      target: [courseReviews.userId, courseReviews.courseId],
      set: {
        rating,
        updatedAt: new Date().toISOString(),
      },
    })
    .returning()
    .get();
}
