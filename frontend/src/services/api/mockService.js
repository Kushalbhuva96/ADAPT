import { questions, dashboard, learningProfile, studyPlan, progress, user, recommendations, tutorMessages, voiceSession, voiceQuizResult, topics, subjects } from "../../data/mock/index.js";
import { activateCourse, getActiveCourse, getCourses, saveCourse } from "../../utils/courseState.js";

const state = { attempts: [], studyPlan: JSON.parse(JSON.stringify(studyPlan)), profile: JSON.parse(JSON.stringify(learningProfile)), progress: JSON.parse(JSON.stringify(progress)) };

const delay = (value, ms=180) => new Promise(resolve => setTimeout(() => resolve(value), ms));
const nextIndex = () => state.attempts.length % questions.length;

export const mockService = {
  async courses(){ return delay(getCourses().map((course) => ({ ...course, assessmentStatus: course.assessment?.result ? "COMPLETED" : "NOT_STARTED", assessmentResult: course.assessment?.result || null }))); },
  async course(courseId){ return delay(getCourses().find((course) => course.id === courseId) || null); },
  async activateCourse(courseId){ const course=activateCourse(courseId); return delay({course,activeCourseId:course?.id}); },
  async activateTopic(courseId,topicId){ const course=getCourses().find((item)=>item.id===courseId); if(!course?.topics?.some((topic)=>topic.id===topicId)) throw new Error("Course topic not found."); saveCourse({...course,activeTopicId:topicId}); return delay({courseId,topicId}); },
  async assessment(courseId){
    const course=getCourses().find((item)=>item.id===courseId);
    if(!course) throw new Error("Course not found.");
    if(course.assessment?.result) return delay({status:"COMPLETED",assessmentId:`mock_${courseId}`,result:course.assessment.result});
    let session=JSON.parse(localStorage.getItem(`adapt_assessment_session_${courseId}`)||"null");
    if(!session){ const questions=await this.diagnosticQuestions({subjectId:course.subject.id,courseId}); session={status:"IN_PROGRESS",assessmentId:`mock_${courseId}`,questions,answers:[]}; localStorage.setItem(`adapt_assessment_session_${courseId}`,JSON.stringify(session)); }
    return delay(session);
  },
  async saveAssessmentProgress(assessmentId,answers){ const course=getActiveCourse(); const key=`adapt_assessment_session_${course?.id}`; const session=JSON.parse(localStorage.getItem(key)||"null"); if(session){session.answers=answers;localStorage.setItem(key,JSON.stringify(session));} return delay(session); },
  async generateCourse({ learningRequest }) {
    const request = String(learningRequest || "").trim();
    if (!request) throw new Error("Tell us what you'd like to learn.");
    const lower = request.toLowerCase();
    const match = lower.includes("operating system") || /\bos\b/.test(lower)
      ? { id: "os", name: "Operating Systems", topicNames: ["Process Management", "CPU Scheduling", "Process Synchronization", "Deadlocks", "Memory Management", "File Systems"] }
      : lower.includes("java") ? { id: "java", name: "Java Programming", topicNames: ["Java Fundamentals", "Classes & Objects", "Inheritance", "Polymorphism", "Encapsulation", "Exception Handling", "Practice & Application"] }
      : lower.includes("sql") ? { id: "sql", name: "SQL", topicNames: ["Relational Data", "SQL Queries", "Filtering & Joins", "Aggregation", "Transactions", "Practice & Application"] }
      : lower.includes("machine learning") ? { id: "ml", name: "Machine Learning", topicNames: ["Machine Learning Foundations", "Data Preparation", "Supervised Learning", "Model Evaluation", "Neural Networks", "Practice & Application"] }
      : lower.includes("python") ? { id: "python", name: "Python Programming", topicNames: ["Python Fundamentals", "Data Structures", "Functions & Modules", "Data Analysis", "Practice & Application"] }
      : { id: "custom", name: request.split(/[,.!?]/)[0].replace(/^i want to learn |^teach me |^help me learn |^i want to master /i, "").trim() || "Personalized Learning", topicNames: ["Foundations", "Core Concepts", "Essential Techniques", "Application", "Practice & Review"] };
    const subject = { id: match.id, name: match.name, icon: "brain", description: "A personalized course built around your learning goal.", totalTopics: match.topicNames.length, completedTopics: 0 };
    const existingTopics = match.id === "os" ? topics.filter((topic) => topic.subjectId === "os") : [];
    const courseId = `course_${match.id}_${Date.now()}`;
    const courseTopics = match.topicNames.map((name, index) => {
      const existing = existingTopics.find((topic) => topic.name === name);
      return existing || { id: `${courseId}_topic_${index + 1}`, subjectId: match.id, name, description: `${name} and its practical applications`, mastery: 0, accuracy: 0, attempts: 0, status: "not_started", difficulty: "easy" };
    });
    const details = lower.includes("cpu scheduling") || lower.includes("deadlock")
      ? "Build a clear understanding of Operating Systems, with focused practice in CPU scheduling and deadlocks."
      : lower.includes("oop") || lower.includes("exception handling")
        ? `Build a strong understanding of ${match.name}, with focused practice in ${[lower.includes("oop") && "object-oriented programming", lower.includes("exception handling") && "exception handling"].filter(Boolean).join(" and ")}.`
        : `Build a practical understanding of ${match.name}, tailored to your request: “${request}”.`;
    const response = {
      course: { id: courseId, title: match.name, subject, topics: courseTopics, estimatedLearningTimeMinutes: courseTopics.length * 35, moduleCount: courseTopics.length },
      understanding: { learningGoal: details, detectedDifficulty: /beginner|basics|from scratch/i.test(request) ? "Beginner" : "Personalized after assessment", startingAssumption: "Starting level will be confirmed by the diagnostic." }
    };
    return delay(response, 700);
  },
  async subjectCatalog(){ return delay(subjects); },
  async diagnosticQuestions(payload){
    const { subjectId, selectedTopicId, courseId } = typeof payload === "string" ? { subjectId: payload } : payload;
    const savedCourse = getActiveCourse();
    const courseTopics = savedCourse?.id === courseId ? savedCourse.topics : null;
    const selectedTopics = courseTopics?.length ? courseTopics : topics.filter((topic) => topic.subjectId === subjectId);
    let courseQuestions = questions.filter((question) => selectedTopics.some((topic) => topic.id === question.topicId));
    if (!courseQuestions.length) courseQuestions = selectedTopics.slice(0, 5).map((topic, index) => ({
      id: `q_${courseId}_${index + 1}`, topicId: topic.id, difficulty: index > 2 ? "medium" : "easy",
      question: `Which statement best describes ${topic.name}?`,
      options: [{ id: "a", text: `A core concept in ${topic.name}` }, { id: "b", text: "A file storage format" }, { id: "c", text: "A user interface color" }, { id: "d", text: "An unrelated network protocol" }],
      correctOptionId: "a", explanation: `${topic.name} is one of the core modules in this course.`
    }));
    const balanced = selectedTopics.map((topic) => courseQuestions.find((question) => question.topicId === topic.id)).filter(Boolean);
    const ordered = [...balanced, ...courseQuestions.filter((question) => !balanced.includes(question))];
    if (selectedTopicId) ordered.sort((a, b) => Number(b.topicId === selectedTopicId) - Number(a.topicId === selectedTopicId));
    return delay(ordered.slice(0, Math.min(10, Math.max(5, courseTopics?.length || 5))));
  },
  async evaluateDiagnostic({ subjectId, courseId, answers }){
    const activeCourse = getActiveCourse();
    const selectedSubject = (activeCourse?.id === courseId && activeCourse.subject) || subjects.find((subject) => subject.id === subjectId) || subjects[0];
    const courseTopics = activeCourse?.id === courseId && activeCourse.topics?.length ? activeCourse.topics : topics.filter((topic) => topic.subjectId === selectedSubject.id);
    const byTopic = courseTopics.map((topic) => {
      const topicAnswers = answers.filter((answer) => answer.topicId === topic.id);
      const correct = topicAnswers.filter((answer) => answer.correct).length;
      return { topicId: topic.id, name: topic.name, total: topicAnswers.length, correct, accuracy: topicAnswers.length ? Math.round(correct / topicAnswers.length * 100) : null };
    });
    const totalCorrect = answers.filter((answer) => answer.correct).length;
    const accuracy = answers.length ? totalCorrect / answers.length : 0;
    const level = accuracy >= 0.75 ? "Advanced" : accuracy >= 0.4 ? "Intermediate" : "Beginner";
    const assessed = byTopic.filter((topic) => topic.total > 0);
    const startingTopic = [...assessed].sort((a, b) => a.accuracy - b.accuracy)[0] || byTopic[0];
    const result = { subject: selectedSubject, level, accuracy: Math.round(accuracy * 100), total: answers.length, topicPerformance: byTopic, strengths: assessed.filter((topic) => topic.accuracy >= 70).map((topic) => topic.name), weaknesses: assessed.filter((topic) => topic.accuracy < 70).map((topic) => topic.name), recommendedTopicId: startingTopic?.topicId, recommendedTopic: startingTopic?.name, explanation: startingTopic ? `Your diagnostic answers showed the most room to build confidence in ${startingTopic.name}. Topics with stronger results can be treated as familiar for now.` : "Start with the first topic and build a baseline as you learn." };
    const assessment = { result, answers };
    localStorage.setItem("adapt_assessment", JSON.stringify(assessment));
    const course = activeCourse;
    if (course && (!courseId || course.id === courseId)) saveCourse({ ...course, status: "active", learnerLevel: level, recommendedTopicId: result.recommendedTopicId, activeTopicId: result.recommendedTopicId, assessment, progress: course.progress || 0 });
    localStorage.setItem("adapt_learner_profile", JSON.stringify({ subjectId: selectedSubject.id, learnerLevel: level, diagnosticAccuracy: result.accuracy, answers, topicPerformance: byTopic, recommendedTopicId: result.recommendedTopicId, updatedAt: new Date().toISOString() }));
    return delay(result);
  },
  async register(payload){
    const account={...user,id:`user_${Date.now()}`,name:payload.name,email:payload.email};
    localStorage.setItem("adapt_account", JSON.stringify({...account,password:payload.password}));
    return delay({user:account,token:"mock-token"});
  },
  async login(payload){
    const saved=JSON.parse(localStorage.getItem("adapt_account")||"null");
    if(saved && saved.email===payload.email && saved.password===payload.password){
      const safe={...saved}; delete safe.password;
      return delay({user:safe,token:"mock-token"});
    }
    if(!saved && payload.email===user.email && payload.password){ return delay({user,token:"mock-token"}); }
    throw new Error("Email or password is incorrect. Create an account first if you are new.");
  },
  async me(){
    const saved=JSON.parse(localStorage.getItem("adapt_account")||"null");
    if(saved){ const safe={...saved}; delete safe.password; return delay({user:safe}); }
    return delay({user});
  },
  async dashboard(){
    const saved=JSON.parse(localStorage.getItem("adapt_account")||"null");
    const dashboardUser=saved?.name ? {name:saved.name} : dashboard.user;
    return delay({...dashboard,user:dashboardUser,learningHealth:{...dashboard.learningHealth,score:state.profile.overallScore}});
  },
  async subjects(){ return delay(subjects); },
  async profile(){ return delay(state.profile); },
  async nextPractice(){
    const course = getActiveCourse();
    const activeTopicId = course?.activeTopicId || course?.recommendedTopicId || course?.selectedTopicId;
    const courseTopics = course?.topics?.length ? course.topics : topics.filter((topic) => topic.subjectId === course?.subject?.id);
    const courseQuestions = questions.filter((question) => courseTopics.some((topic) => topic.id === question.topicId));
    const activeTopicQuestions = activeTopicId ? courseQuestions.filter((question) => question.topicId === activeTopicId) : [];
    const pool = activeTopicQuestions.length ? activeTopicQuestions : courseQuestions.length ? courseQuestions : [];
    const topic = courseTopics.find((item) => item.id === activeTopicId) || courseTopics[0] || topics[2];
    const q = pool.length ? pool[(course?.topicAttempts?.[activeTopicId] || 0) % pool.length] : {
      id: `practice_${topic.id}`, topicId: topic.id, difficulty: "easy", question: `Which statement best describes ${topic.name}?`,
      options: [{ id: "a", text: `A core concept in ${topic.name}` }, { id: "b", text: "A file storage format" }, { id: "c", text: "A user interface color" }, { id: "d", text: "An unrelated network protocol" }], correctOptionId: "a", explanation: `${topic.name} is a core module in your course.`
    };
    return delay({...q, adaptiveContext:{accuracy:topic.accuracy,topicMastery:topic.mastery,reason:"Your recent accuracy indicates this concept needs reinforcement.",strategy:state.attempts.length%2?"example_first":"foundation_first"}});
  },
  async answerPractice({questionId,selectedOptionId,timeTakenSeconds=0}){
    const activeCourse = getActiveCourse();
    const courseTopics = activeCourse?.topics?.length ? activeCourse.topics : topics.filter((item) => item.subjectId === activeCourse?.subject?.id);
    const q=questions.find(x=>x.id===questionId)||{ id: questionId, topicId: courseTopics.find((topic) => questionId === `practice_${topic.id}`)?.id || activeCourse?.activeTopicId, correctOptionId:"a", explanation:"Review this module's core concept, then try applying it in a new example." };
    const correct=q.correctOptionId===selectedOptionId;
    state.attempts.push({questionId,selectedOptionId,correct,timeTakenSeconds,topicId:q.topicId});
    const topic=topics.find(t=>t.id===q.topicId);
    const previous=topic?.mastery||42;
    const next=Math.max(0,Math.min(100,previous+(correct?4:-2)));
    const idx=state.profile.topicMastery.findIndex(x=>x.topicId===q.topicId);
    if(idx>=0) state.profile.topicMastery[idx].score=next;
    state.profile.overallScore=Math.max(0,Math.min(100,state.profile.overallScore+(correct?1:0)));
    state.progress.statistics.questionsCompleted+=1;
    if (activeCourse) {
      const topicAttempts = { ...(activeCourse.topicAttempts || {}), [q.topicId]: (activeCourse.topicAttempts?.[q.topicId] || 0) + 1 };
      const completedTopicIds = [...new Set([...(activeCourse.completedTopicIds || []), ...(topicAttempts[q.topicId] >= 3 ? [q.topicId] : [])])];
      const topicId = courseTopics.find((item) => !completedTopicIds.includes(item.id))?.id || q.topicId;
      const courseProgress = courseTopics.length ? Math.round(completedTopicIds.length / courseTopics.length * 100) : 0;
      saveCourse({ ...activeCourse, topicAttempts, completedTopicIds, progress: courseProgress, activeTopicId: topicId, recommendedTopicId: topicId });
    }
    state.progress.statistics.accuracy=Math.round(((state.progress.statistics.accuracy*20)+(correct?100:0))/21);
    return delay({attempt:{questionId,selectedOptionId,correct,timeTakenSeconds},feedback:{status:correct?"correct":"incorrect",correctOptionId:q.correctOptionId,explanation:q.explanation,whatAdaptLearned:correct?"You recognized the concept correctly. ADAPT can increase application difficulty.":"You need reinforcement on this concept. ADAPT will change the explanation strategy.",mastery:{previous,current:next,change:next-previous}},adaptation:{nextDifficulty:correct?"hard":"easy",nextStrategy:correct?"application":"example_first",reason:correct?"Your recent answer shows readiness for application.":"Repeated difficulty detected; rebuilding the foundation."}});
  },
  async tutorMessage({message,mode="explain",topicId,topicName="your selected topic"}){
    const text=message?.toLowerCase().includes("deadlock")?"A deadlock happens when processes wait indefinitely for resources held by one another. I’ll explain it with a simple real-world example, because your profile responds well to examples.":`Let's work through ${topicName} step by step. I’ll keep this ${mode.replaceAll("_"," ")} concise and example-driven.`;
    return delay({id:`msg_${Date.now()}`,role:"assistant",content:text,messageType:"explanation",topicId:topicId || "",difficulty:state.profile.adaptiveLevel,timestamp:new Date().toISOString()});
  },
  async studyPlan(){ return delay(state.studyPlan); },
  async completePlanItem(itemId){ state.studyPlan.items=state.studyPlan.items.map(x=>x.id===itemId?{...x,status:"completed"}:x); return delay(state.studyPlan); },
  async progress(){ return delay(state.progress); },
  async voiceStart(){ return delay({...voiceSession,status:"listening"}); },
  async voiceMessage({text}){ return delay({session:{...voiceSession,status:"speaking",transcript:[{role:"user",text},{role:"assistant",text:"I understand. I’ll adapt the explanation to your current learning profile and use a concrete example."} ]}}); },
  async voiceQuizEvaluate(){ return delay(voiceQuizResult); },
  async sync(){ return delay({status:"synced",pendingSyncCount:0,lastSyncedAt:new Date().toISOString()}); },
  async getRecommendations(){ return delay(recommendations); }
};
