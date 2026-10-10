export function resolveOfflineCourseState({ downloads, currentCourse, currentCourses, preferredId }) {
  const downloadedCourses = downloads.map((record) => record.course);
  const currentCourseId = currentCourse?.id || preferredId;
  const matchingDownload = downloads.find((record) => record.courseId === currentCourseId);

  if (matchingDownload) {
    return {
      courses: downloadedCourses,
      course: matchingDownload.course,
      offlineOnly: true,
      offlineUnavailable: false,
      error: "",
    };
  }

  if (currentCourse) {
    return {
      courses: currentCourses,
      course: currentCourse,
      offlineOnly: false,
      offlineUnavailable: true,
      error: "",
    };
  }

  const selected = downloadedCourses.find((item) => item.id === preferredId) || downloadedCourses[0] || null;
  return {
    courses: downloadedCourses,
    course: selected,
    offlineOnly: Boolean(selected),
    offlineUnavailable: false,
    error: selected ? "" : "No downloaded courses are available on this device yet.",
  };
}
