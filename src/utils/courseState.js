const read = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key) || "null") || fallback; }
  catch { return fallback; }
};

export const getCourses = () => {
  const courses = read("adapt_courses", []);
  const legacy = read("adapt_course", null);
  if (!legacy || courses.some((course) => course.id === legacy.id)) return courses;
  const assessment = legacy.assessment || read("adapt_assessment", null);
  const migrated = {
    ...legacy,
    id: legacy.id || `course_${legacy.subject?.id || "saved"}_legacy`,
    selectedTopicId: legacy.selectedTopicId || assessment?.result?.recommendedTopicId || null,
    recommendedTopicId: legacy.recommendedTopicId || assessment?.result?.recommendedTopicId,
    assessment,
    status: assessment ? "active" : legacy.status || "setup"
  };
  const migratedCourses = [...courses, migrated];
  localStorage.setItem("adapt_courses", JSON.stringify(migratedCourses));
  localStorage.setItem("adapt_course", JSON.stringify(migrated));
  if (!localStorage.getItem("adapt_active_course_id")) localStorage.setItem("adapt_active_course_id", migrated.id);
  return migratedCourses;
};

export const getActiveCourse = () => {
  const courses = getCourses();
  const activeId = localStorage.getItem("adapt_active_course_id");
  return courses.find((course) => course.id === activeId) || read("adapt_course", null) || courses[0] || null;
};

export const saveCourse = (course) => {
  const courses = getCourses();
  const next = [...courses.filter((item) => item.id !== course.id), course];
  localStorage.setItem("adapt_courses", JSON.stringify(next));
  localStorage.setItem("adapt_course", JSON.stringify(course));
  localStorage.setItem("adapt_active_course_id", course.id);
  return course;
};

export const activateCourse = (courseId) => {
  const course = getCourses().find((item) => item.id === courseId);
  if (!course) return null;
  localStorage.setItem("adapt_active_course_id", courseId);
  localStorage.setItem("adapt_course", JSON.stringify(course));
  if (course.assessment) localStorage.setItem("adapt_assessment", JSON.stringify(course.assessment));
  else localStorage.removeItem("adapt_assessment");
  return course;
};
